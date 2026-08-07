"""LoreKeeper — recall assist on the writer's own notes only (librarian, not author)."""
from __future__ import annotations

import json
import re
import hashlib
from typing import Any

from lorekeeper_character_summary import (
    character_summary_sources,
    character_targets,
    is_who_is_question,
)
from lorekeeper_character_compose import cast_answer_is_thin, work_title_from_hints
from lorekeeper_ask_plan import AskPlan
from lorekeeper_ask_router import (
    character_labels_for_plan,
    default_ask_plan,
    entry_hints_for_router,
    local_ask_plan,
    route_ask_question,
    section_hints_from_plan,
)
from lorekeeper_rag import RAG_VERSION, answer_with_rag, rag_enabled
from lorekeeper_knowledge_pov import awareness_parts, is_awareness_question, is_knowledge_pov_question
from lorekeeper_notes_vs_draft import is_notes_not_in_draft_question
from lorekeeper_question_routes import is_story_position_question
from lorekeeper_section_scope import (
    extract_section_hints,
    filter_entries_by_section,
    format_section_nothing_saved,
)
from lorekeeper_story_position import ranked_draft_tail_rows
from lorekeeper_work_recall import answer_for_work, route_question

RECALL_VERSION = RAG_VERSION
from lorekeeper_corpus_text import normalize_corpus_text
from lorekeeper_answer_focus import focus_ask_response
from lorekeeper_relations import (
    is_relationship_between_question,
    relationship_between_pair,
    restate_relationships,
)
from lorekeeper_recall_scope import (
    check_work_disambiguation,
    distinct_work_tags,
    merge_recall_user_data,
)
from lorekeeper_reliability import (
    augment_ranked_for_targets,
    augment_question_with_scope_work,
    classify_material,
    demote_synthesis,
    explicit_work_hints,
    extract_work_hints,
    filter_entries_by_recall_scope,
    filter_entries_by_work,
    filter_ranked_by_threshold,
    format_nothing_saved,
    prefer_known_work_hints,
    sources_from_ranked,
)
from lorekeeper_work_membership import (
    filter_entries_floaters_only,
    is_floaters_question,
)
from lorekeeper_floaters_ask import answer_floaters_ask, is_floaters_followup_context
from lorekeeper_confirmed_ask import (
    answer_looks_like_empty_claim,
    summarize_confirmed_entries,
)

ENTRIES_KEY = "lorekeeper_entries_v1"
DOCUMENTS_KEY = "lorekeeper_documents_v1"

_entries_cache: dict[str, list[dict[str, Any]]] = {}
_ENTRIES_CACHE_MAX = 12

STOP = frozenset(
    """
    a an the and or of in on at to for with from by is was are were be been being
    have has had do does did will would could should may might must can i me my you your
    it its this that these those what which who how when where why hey hi hello please
    remind tell about the
    """.split()
)

# Beat / visual cues — keep thin scene notes findable even when "expression" isn't in the note.
_SCENE_BEAT_Q = re.compile(
    r"\b("
    r"look on .{0,40} face|expression|facial|pov ends|point of view|"
    r"catches? up|caught up|before .+ catches"
    r")\b",
    re.I,
)

KIND_LABELS = {
    "note": "Note",
    "document": "Document",
    "character": "Character",
    "relationship": "Relationship",
    "politics": "Politics & intrigue",
    "place": "Place / setting",
    "scene": "Scene",
    "visual": "Visual / illustration",
    "design": "Design & typography",
    "dialogue": "Dialogue & voice",
    "plot": "Plot & structure",
    "script": "Script",
    "event": "Event",
    "faction": "Faction / group",
    "species": "Species / world rules",
    "theme": "Theme & motif",
    "reference": "Reference / inspo",
}


def _tokenize(text: str) -> list[str]:
    return [
        w
        for w in re.findall(r"[a-z0-9']+", (text or "").lower())
        if len(w) > 1 and w not in STOP
    ]


def _kind_label(kind: str) -> str:
    return KIND_LABELS.get(kind or "note", "Note")


def _best_excerpt(body: str, question_tokens: list[str], max_len: int = 360) -> str:
    body = (body or "").strip()
    if not body:
        return "(No body text in this entry.)"
    sentences = re.split(r"(?<=[.!?])\s+", body)
    if len(sentences) <= 1:
        sentences = [body]
    best = sentences[0]
    best_score = -1
    q_set = set(question_tokens)
    for sentence in sentences:
        score = len(q_set & set(_tokenize(sentence)))
        if score > best_score:
            best_score = score
            best = sentence
    if len(best) > max_len:
        trimmed = best[: max_len - 1].rsplit(" ", 1)[0]
        return trimmed + "…"
    return best


def _score_entry(
    question: str,
    entry: dict[str, Any],
    *,
    resolved_pair_names: list[str] | None = None,
) -> int:
    question_tokens = _tokenize(question)
    q_lower = (question or "").lower()
    title = str(entry.get("title") or "")
    body = str(entry.get("body") or "")
    tag_list = entry.get("tags") or []
    tags = " ".join(str(t) for t in tag_list)
    kind = str(entry.get("kind") or "")
    hay_text = " ".join([title, body, tags, kind]).lower()
    hay_tokens = _tokenize(hay_text)
    hay_set = set(hay_tokens)
    q_set = set(question_tokens)
    score = len(q_set & hay_set) * 2
    for token in question_tokens:
        if token in _tokenize(title):
            score += 4
        if token in _tokenize(tags):
            score += 5
    for tag in tag_list:
        tag_clean = str(tag).strip().lower()
        if len(tag_clean) > 2 and tag_clean in q_lower:
            score += 20
    title_clean = title.strip().lower()
    if len(title_clean) > 3 and title_clean in q_lower:
        score += 10
    for i in range(len(question_tokens) - 1):
        bigram = question_tokens[i] + " " + question_tokens[i + 1]
        if bigram in hay_text:
            score += 6
    # Named cast + scene-beat questions: surface sparse notes that mention the people,
    # even when the aspect word (expression/look) was never written into the note.
    targets = character_targets(question)
    if targets:
        name_hits = sum(
            1
            for name in targets
            if name and re.search(rf"\b{re.escape(name)}\b", hay_text, re.I)
        )
        if name_hits:
            score += 4 + min(name_hits, 3) * 2
            if _SCENE_BEAT_Q.search(question or ""):
                score += 6
    # Who-is: prefer cast/relationship notes over scene/draft chronology.
    if is_who_is_question(question):
        if kind in ("character", "relationship"):
            score += 18
        elif kind in ("species", "politics"):
            score += 10
        elif kind in ("document", "scene"):
            if re.search(
                r"\b(protagonist|antagonist|married|brother|sister|species|"
                r"is a |is an |known as)\b",
                hay_text,
            ):
                score += 4
            else:
                score -= 10
            if re.search(
                r"\b(right after|next (?:POV|section)|POV (?:shows?|will be)|"
                r"section begins|stalking them|chasing them)\b",
                hay_text,
            ):
                score -= 12
    # Relationship + timeline questions: prefer notes that name the asked people and era.
    pair = relationship_between_pair(question)
    if pair:
        from lorekeeper_relations import is_story_arc_relationship_question

        role_skip = ("protagonist", "antagonist", "hero", "heroine", "villain")
        pair_names = list(resolved_pair_names or [])
        if not pair_names:
            pair_names = [
                n
                for n in pair
                if n and n.lower() not in role_skip
            ]
        pair_hits = sum(
            1
            for name in pair_names
            if name and re.search(rf"\b{re.escape(name)}\b", hay_text, re.I)
        )
        if pair_hits:
            score += 8 + pair_hits * 4
        if re.search(r"\b(pre|post|before|after|during|war|timeline)\b", q_lower):
            if re.search(r"\b(pre|post|before|after|during|war|timeline)\b", hay_text):
                score += 10
        if is_story_arc_relationship_question(question):
            # Prefer dynamics; downrank pure kinship blurbs for arc asks.
            if re.search(
                r"\b(trust|ally|alliance|rival|enemy|betray|sided|loyal|"
                r"use|used|using|attach|villain|plan)\b",
                hay_text,
            ):
                score += 12
            if re.search(
                r"\b(brother|sister|sibling|biological|blood|mother|father)\b",
                hay_text,
            ) and not re.search(
                r"\b(trust|ally|alliance|rival|war|before|after|use|plan)\b",
                hay_text,
            ):
                score -= 8
            # Long parent drafts score high on token overlap but hide late arcs;
            # slight downrank so paragraph chunks can surface.
            if (
                kind == "document"
                and "#" not in str(entry.get("id") or "")
                and len(body) > 2000
            ):
                score -= 6
    try:
        from lorekeeper_plot_span import score_boost_for_plot_span

        score += score_boost_for_plot_span(question, entry)
    except Exception:
        pass
    return score


def _resolved_pair_names_for_question(
    question: str, entries: list[dict[str, Any]]
) -> list[str]:
    pair = relationship_between_pair(question)
    if not pair:
        return []
    from lorekeeper_relations import resolve_pair_name_sets

    left, right = resolve_pair_name_sets(pair[0], pair[1], entries)
    role_skip = ("protagonist", "antagonist", "hero", "heroine", "villain")
    out: list[str] = []
    seen: set[str] = set()
    for n in left + right:
        key = (n or "").strip().lower()
        if not key or key in role_skip or key in seen:
            continue
        seen.add(key)
        out.append(n.strip())
    return out


def _parse_entries(raw: str | None) -> list[dict[str, Any]]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def _strip_html(html: str) -> str:
    text = re.sub(r"</p>\s*", "\n\n", html, flags=re.I)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</h[1-6]>\s*", "\n\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n ", "\n", text)
    return normalize_corpus_text(text)


_DOC_WORK_SUFFIX = re.compile(
    r"\s+(?:storywriting\s+)?(?:draft|manuscript|document|doc)\s*$",
    re.I,
)


def _document_work_tag(doc: dict[str, Any]) -> str:
    """Prefer explicit work field; else title with draft/document suffix stripped."""
    explicit = str(
        doc.get("workTag") or doc.get("workTitle") or doc.get("work") or ""
    ).strip()
    if explicit:
        return explicit
    title = str(doc.get("title") or "").strip()
    if not title:
        return "Untitled document"
    stripped = _DOC_WORK_SUFFIX.sub("", title).strip()
    return stripped or title


def _paragraph_chunks(body: str, min_len: int = 40) -> list[str]:
    text = (body or "").strip()
    if not text:
        return []
    parts = re.split(r"\n\s*\n+", text)
    if len(parts) <= 1:
        parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if len(p.strip()) >= min_len]


def _entries_from_documents(raw: str | None) -> list[dict[str, Any]]:
    if not raw:
        return []
    try:
        docs = json.loads(raw) if isinstance(raw, str) else raw
    except json.JSONDecodeError:
        return []
    if not isinstance(docs, list):
        return []
    entries: list[dict[str, Any]] = []
    for doc in docs:
        if not isinstance(doc, dict):
            continue
        doc_id = str(doc.get("id") or "")
        doc_title = str(doc.get("title") or "Untitled document")
        work_tag = _document_work_tag(doc)
        tags = [work_tag] if work_tag else []
        if doc.get("bodyFormat") == "html":
            body = _strip_html(str(doc.get("bodyHtml") or ""))
            if body:
                entries.append(
                    {
                        "id": doc_id,
                        "title": doc_title,
                        "body": body,
                        "tags": tags,
                        "kind": "document",
                    }
                )
                for idx, chunk in enumerate(_paragraph_chunks(body)):
                    entries.append(
                        {
                            "id": f"{doc_id}#p{idx}",
                            "title": doc_title,
                            "body": chunk,
                            "tags": tags,
                            "kind": "document",
                            "parentDocId": doc_id,
                        }
                    )
            continue
        page_bodies: list[str] = []
        for page in doc.get("pages") or []:
            if not isinstance(page, dict):
                continue
            page_title = str(page.get("title") or "Page")
            page_body = normalize_corpus_text(str(page.get("body") or ""))
            page_bodies.append(page_body)
            entries.append(
                {
                    "id": str(page.get("id") or ""),
                    "title": f"{doc_title} / {page_title}",
                    "body": page_body,
                    "tags": tags,
                    "kind": str(page.get("kind") or "note"),
                    "parentDocId": doc_id,
                }
            )
        if page_bodies:
            full_body = "\n\n".join(b for b in page_bodies if b).strip()
            if full_body:
                entries.insert(
                    0,
                    {
                        "id": doc_id,
                        "title": doc_title,
                        "body": full_body,
                        "tags": tags,
                        "kind": "document",
                    },
                )
                for idx, chunk in enumerate(_paragraph_chunks(full_body)):
                    entries.append(
                        {
                            "id": f"{doc_id}#p{idx}",
                            "title": doc_title,
                            "body": chunk,
                            "tags": tags,
                            "kind": "document",
                            "parentDocId": doc_id,
                        }
                    )
    return entries


def _entries_cache_key(user_data: dict[str, Any]) -> str:
    entries_raw = user_data.get(ENTRIES_KEY) or ""
    docs_raw = user_data.get(DOCUMENTS_KEY) or ""
    if not isinstance(entries_raw, str):
        entries_raw = json.dumps(entries_raw, sort_keys=True)
    if not isinstance(docs_raw, str):
        docs_raw = json.dumps(docs_raw, sort_keys=True)
    digest = hashlib.sha256(
        (str(len(entries_raw)) + "\n" + str(len(docs_raw)) + "\n" + entries_raw[:4096] + docs_raw[:4096]).encode(
            "utf-8", errors="replace"
        )
    ).hexdigest()[:24]
    return digest


def _all_entries(user_data: dict[str, Any]) -> list[dict[str, Any]]:
    cache_key = _entries_cache_key(user_data)
    cached = _entries_cache.get(cache_key)
    if cached is not None:
        return cached

    legacy = _parse_entries(user_data.get(ENTRIES_KEY))
    from_docs = _entries_from_documents(user_data.get(DOCUMENTS_KEY))
    if not from_docs:
        result = legacy
    elif not legacy:
        result = from_docs
    else:
        seen = {e.get("id") for e in from_docs if e.get("id")}
        merged = from_docs[:]
        for entry in legacy:
            if entry.get("id") not in seen:
                body = normalize_corpus_text(str(entry.get("body") or ""))
                merged.append({**entry, "body": body})
        result = merged

    if len(_entries_cache) >= _ENTRIES_CACHE_MAX:
        _entries_cache.pop(next(iter(_entries_cache)))
    _entries_cache[cache_key] = result
    return result


def _prefer_chunks_over_long_parents(
    ranked: list[dict[str, Any]], *, max_parent_chars: int = 1800
) -> list[dict[str, Any]]:
    """Drop huge parent drafts when paragraph/page chunks from the same doc exist."""
    by_base: dict[str, list[dict[str, Any]]] = {}
    for row in ranked:
        eid = str(row.get("id") or "")
        base = eid.split("#")[0] if "#" in eid else eid
        by_base.setdefault(base or eid, []).append(row)

    skip_parents: set[str] = set()
    for base, rows in by_base.items():
        has_chunk = any("#" in str(r.get("id") or "") for r in rows)
        parent_long = any(
            "#" not in str(r.get("id") or "")
            and len(str(r.get("body") or "")) > max_parent_chars
            for r in rows
        )
        if has_chunk and parent_long:
            skip_parents.add(base)

    if not skip_parents:
        return ranked
    return [
        row
        for row in ranked
        if not (
            "#" not in str(row.get("id") or "")
            and (str(row.get("id") or "").split("#")[0] in skip_parents)
        )
    ]


def _rank_entries(question: str, entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    question_tokens = _tokenize(question)
    ranked: list[dict[str, Any]] = []
    # Large corpora: score a capped slice so Ask stays responsive on nginx timeouts.
    scan = entries
    if len(scan) > 1200:
        scan = scan[:1200]
    resolved_names = _resolved_pair_names_for_question(question, scan)
    for entry in scan:
        if not isinstance(entry, dict):
            continue
        score = _score_entry(
            question, entry, resolved_pair_names=resolved_names
        )
        if score <= 0:
            continue
        ranked.append(
            {
                "id": str(entry.get("id") or ""),
                "title": str(entry.get("title") or "Untitled"),
                "kind": str(entry.get("kind") or "note"),
                "kindLabel": _kind_label(str(entry.get("kind") or "note")),
                "score": score,
                "excerpt": _best_excerpt(str(entry.get("body") or ""), question_tokens),
                "body": str(entry.get("body") or "")[:8000],
            }
        )
    ranked.sort(key=lambda row: row["score"], reverse=True)
    return _prefer_chunks_over_long_parents(ranked)


def _legacy_fallback_answer(
    question: str,
    ranked: list[dict[str, Any]],
    entries: list[dict[str, Any]],
    *,
    work_hints: set[str] | None = None,
    strict_work: bool = False,
) -> str:
    ranked_ids = {row["id"] for row in ranked if row.get("id")}
    hints = work_hints or set()

    restated = restate_relationships(question, entries, ranked_ids)
    if restated and not is_who_is_question(question):
        event_bits: list[str] = []
        q_tokens = _tokenize(question)
        for row in ranked[:3]:
            for sentence in re.split(r"(?<=[.!?])\s+", row.get("body") or ""):
                st = sentence.strip()
                if not st:
                    continue
                st_low = st.lower()
                if any(t in st_low for t in q_tokens if len(t) > 3):
                    if not re.search(r"'s\s+(husband|wife|son|daughter|child)\b", st, re.I):
                        event_bits.append(st)
                        break
        if event_bits:
            restated += "\n\nAlso in your notes:\n• " + event_bits[0]
        return restated

    if character_targets(question) or is_who_is_question(question):
        label = character_targets(question)[0] if character_targets(question) else "that character"
        if strict_work and not entries:
            return format_nothing_saved(
                question, hints, target_label=label, corpus_nonempty=False
            )
        return (
            f"I couldn't find anything about {label} in your saved notes for this work. "
            "Tag entries with the work name on every note for that project, then ask again — "
            "e.g. “In Ashford Saga, who is Character M?”"
        )

    if not ranked:
        if strict_work:
            return format_nothing_saved(
                question, hints, corpus_nonempty=bool(entries)
            )
        return (
            "I looked through your saved notes and documents and didn't find anything that clearly matches. "
            "Tag entries with the title of the work — the book, script, skit, or game name "
            "(same tag on every note for that project), then ask again and name it — "
            "e.g. “In Ashford Saga, who is…?”"
        )
    top = ranked[0]
    if top.get("score", 0) >= 7:
        return (
            f"From your entry “{top['title']}” ({top['kindLabel']}):\n\n"
            f"{top['excerpt']}\n\n"
            "— Pulled from your notes only. Nothing invented."
        )

    if len(ranked) == 1:
        row = ranked[0]
        return (
            f"From your entry “{row['title']}” ({row['kindLabel']}):\n\n"
            f"{row['excerpt']}\n\n"
            "— Pulled from your notes only. Nothing invented."
        )

    best = ranked[0]
    hint = (
        "Try naming the work in your question — e.g. “In Ashford Saga, …” — "
        "or ask a narrower who / where / when question."
    )
    return (
        f"Closest match from “{best['title']}” ({best['kindLabel']}):\n\n"
        f"{best['excerpt']}\n\n"
        f"{hint}\n\n"
        "— Pulled from your notes only. Nothing invented."
    )


def _who_or_knowledge_label(question: str, local_pipeline: dict[str, Any]) -> str:
    targets = character_targets(question)
    if targets:
        return targets[0]
    if is_who_is_question(question):
        return "that character"
    return ""


def _merge_ranked_for_plan(
    question: str,
    scoped: list[dict[str, Any]],
    ranked: list[dict[str, Any]],
    plan: AskPlan | None,
) -> list[dict[str, Any]]:
    if not plan:
        return ranked
    merged = list(ranked)
    seen = {str(r.get("id") or "") for r in merged}
    if plan.use_draft_tail:
        for row in ranked_draft_tail_rows(scoped, question, kind_label=_kind_label):
            rid = str(row.get("id") or "")
            if rid and rid not in seen:
                seen.add(rid)
                merged.insert(0, row)
    labels = character_labels_for_plan(plan, scoped)
    if labels:
        portrait = plan.intent == "character_portrait"
        cap = 14 if portrait else 8
        added = 0
        for entry in scoped:
            if added >= cap:
                break
            if not isinstance(entry, dict):
                continue
            blob = f"{entry.get('title') or ''} {entry.get('body') or ''}".lower()
            if not any(lab.lower() in blob for lab in labels):
                continue
            eid = str(entry.get("id") or "")
            if eid in seen:
                for row in merged:
                    if row.get("id") == eid:
                        row["score"] = int(row.get("score") or 0) + 25
                continue
            merged.append(
                {
                    "id": eid,
                    "title": str(entry.get("title") or "Untitled"),
                    "kind": str(entry.get("kind") or "note"),
                    "kindLabel": _kind_label(str(entry.get("kind") or "note")),
                    "score": 50 if portrait else 40,
                    "excerpt": str(entry.get("body") or "")[:400],
                    "body": str(entry.get("body") or "")[:8000],
                }
            )
            seen.add(eid)
            added += 1
    merged.sort(key=lambda r: r.get("score", 0), reverse=True)
    return merged


def local_pipeline_skips_rag(
    question: str,
    local_pipeline: dict[str, Any],
    scoped: list[dict[str, Any]],
    *,
    spot_check: bool = False,
    plan: AskPlan | None = None,
) -> bool:
    """True when local answer is good enough — do not call RAG (#3, knowledge POV)."""
    if plan:
        knowledge_narrow = plan.intent == "narrow_fact" and (
            is_knowledge_pov_question(question) or is_awareness_question(question)
        )
        if (
            plan.pipeline == "rag_summarize"
            and plan.intent not in ("character_portrait", "relationship")
            and not knowledge_narrow
        ):
            return False
        if plan.pipeline == "rag_cast_card":
            kind = "who"
        else:
            kind = plan.question_kind
    else:
        kind = str(local_pipeline.get("questionKind") or route_question(question))
    state = str(local_pipeline.get("materialState") or "")
    answer = str(local_pipeline.get("answer") or "")

    if plan and (plan.intent == "relationship" or kind == "relationship"):
        from lorekeeper_relations import is_story_arc_relationship_question

        # Story-arc needs a synthesized answer — never treat a note dump as final.
        if is_story_arc_relationship_question(question):
            return False
        return bool(answer.strip())

    if spot_check and kind not in ("who", "knowledge"):
        if plan and plan.intent in ("character_portrait", "narrow_fact"):
            pass
        elif kind == "topic" and extract_section_hints(question) and state == "summarizable":
            return bool(answer.strip())
        else:
            return False

    if kind == "resume" or is_story_position_question(question):
        if plan and plan.pipeline == "rag_resume":
            return False
        if not answer.strip():
            return False
        if answer.count("•") >= 2 or answer.count("\n- ") >= 2:
            return False
        if "latest draft" in answer.lower() and len(answer) > 100:
            return True
        return len(answer) > 180

    if plan and plan.intent == "character_portrait":
        if not answer.strip():
            return False
        low = answer.lower()
        if "nothing saved" in low or "couldn't find" in low:
            return False
        if answer.count("•") >= 3 and "what you've written" in low:
            return False
        labels = character_labels_for_plan(plan, scoped) or character_targets(question)
        label = labels[0] if labels else ""
        if label and cast_answer_is_thin(answer, label):
            return False
        return len(answer.strip()) > 100

    if kind in ("planned_gaps", "flagged_fix", "notes_not_in_draft"):
        return bool(answer.strip())

    # Prefer pipeline kind when local compare/tag routes already composed.
    pipe_kind = str(local_pipeline.get("questionKind") or "")
    if pipe_kind in ("planned_gaps", "flagged_fix", "notes_not_in_draft"):
        return bool(answer.strip())

    if kind in ("who", "knowledge") or is_who_is_question(question) or is_knowledge_pov_question(
        question
    ):
        label = _who_or_knowledge_label(question, local_pipeline)
        if state == "nothing_saved" and scoped:
            return False
        if label and cast_answer_is_thin(answer, label):
            return False
        if kind == "knowledge" and not answer.strip():
            return False
        if kind == "knowledge" and "nothing saved yet" in answer.lower():
            return False
        return bool(answer.strip())

    if kind == "coverage":
        if not answer.strip():
            return False
        low = answer.lower()
        if "nothing saved" in low or "couldn't find" in low:
            return False
        if "from what you've saved" in low or "•" in answer:
            return len(answer.strip()) > 60
        return False

    # What/topic and other shapes — local gather is a stub; prefer RAG.
    return False


def _entry_matches_confirmed(entry_id: str, confirmed: set[str]) -> bool:
    eid = str(entry_id or "").strip()
    if not eid or not confirmed:
        return False
    if eid in confirmed:
        return True
    base = eid.split("#", 1)[0]
    if base in confirmed:
        return True
    for cid in confirmed:
        if cid.startswith(eid + "#") or eid.startswith(cid + "#"):
            return True
    return False


def _filter_entries_by_confirmed(
    entries: list[dict[str, Any]], confirmed_ids: list[str]
) -> list[dict[str, Any]]:
    confirmed = {str(x).strip() for x in confirmed_ids if str(x).strip()}
    if not confirmed:
        return list(entries)
    return [
        e
        for e in entries
        if isinstance(e, dict) and _entry_matches_confirmed(str(e.get("id") or ""), confirmed)
    ]


def _build_confirm_candidates(
    question: str,
    scoped: list[dict[str, Any]],
    ask_plan: AskPlan | None,
    *,
    limit: int = 12,
) -> list[dict[str, Any]]:
    """Rank notes/draft bits for the confirm-sources preview step."""
    ranked = _rank_entries(question, scoped)
    ranked = augment_ranked_for_targets(
        question,
        scoped,
        ranked,
        rank_entry=_score_entry,
        kind_label=_kind_label,
        best_excerpt=_best_excerpt,
        tokenize=_tokenize,
    )
    ranked = _merge_ranked_for_plan(question, scoped, ranked, ask_plan)
    filtered = filter_ranked_by_threshold(ranked, question)
    if not filtered:
        filtered = ranked
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in filtered:
        eid = str(row.get("id") or "").strip()
        if not eid or eid in seen:
            continue
        seen.add(eid)
        out.append(
            {
                "id": eid,
                "title": str(row.get("title") or "Untitled"),
                "kind": str(row.get("kind") or "note"),
                "kindLabel": str(row.get("kindLabel") or _kind_label(str(row.get("kind") or "note"))),
                "excerpt": str(row.get("excerpt") or "")[:220],
                "score": int(row.get("score") or 0),
            }
        )
        if len(out) >= limit:
            break
    return out


def recall_from_user_data(
    question: str,
    user_data: dict[str, Any],
    *,
    client_documents: list[dict[str, Any]] | str | None = None,
    client_entries: list[dict[str, Any]] | str | None = None,
    mode: str = "full",
    scope: dict[str, Any] | None = None,
    spot_check: bool = False,
    ask_continue: dict[str, Any] | None = None,
    ask_phase: str | None = None,
    confirmed_source_ids: list[str] | None = None,
) -> dict[str, Any]:
    question = (question or "").strip()
    if not question:
        return {"ok": False, "error": "empty_question"}
    if len(question) > 2000:
        question = question[:2000]

    phase = (ask_phase or "").strip().lower()
    confirmed_ids: list[str] = []
    if isinstance(confirmed_source_ids, list):
        confirmed_ids = [str(x).strip() for x in confirmed_source_ids if str(x).strip()]
    if confirmed_ids:
        phase = "answer"
    if phase not in ("preview", "answer"):
        phase = "answer"

    floaters_only = False

    def _finish(payload: dict[str, Any]) -> dict[str, Any]:
        if payload.get("ok"):
            if floaters_only:
                payload.setdefault("recallScope", "floaters")
                # Floater digests / clarify turns are already gathered lists — don't trim.
                if payload.get("askContinue") or payload.get("questionKind") == "list":
                    return payload
            # Confirm-sources preview: keep the pick list; don't focus/trim the prompt.
            if payload.get("needsConfirm") or payload.get("askPhase") == "preview":
                return payload
            return focus_ask_response(question, payload, spot_check=spot_check)
        return payload

    scope_mode = "work"
    scope_work = ""
    scope_doc_id = ""
    if isinstance(scope, dict):
        scope_mode = str(scope.get("mode") or "work").strip().lower()
        scope_work = str(scope.get("workTitle") or "").strip()
        scope_doc_id = str(scope.get("documentId") or "").strip()
    # Notes-vs-draft needs every note for the work, not only notes linked to the open doc.
    if is_notes_not_in_draft_question(question):
        scope_mode = "work"
    if scope_work and scope_mode not in ("random_ideas", "floaters"):
        question = augment_question_with_scope_work(question, scope_work)

    data = merge_recall_user_data(
        user_data or {},
        client_documents=client_documents,
        client_entries=client_entries,
    )

    entries = _all_entries(data)
    if is_notes_not_in_draft_question(question) and not scope_work and scope_doc_id:
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            eid = str(entry.get("id") or "")
            if eid != scope_doc_id and not eid.startswith(f"{scope_doc_id}#"):
                continue
            for tag in entry.get("tags") or []:
                tag_s = str(tag).strip()
                if tag_s and len(tag_s) > 2:
                    scope_work = tag_s
                    question = augment_question_with_scope_work(question, scope_work)
                    break
            if scope_work:
                break
    recall_mode = "brief" if (mode or "").strip().lower() == "brief" else "full"
    continue_ctx = ask_continue if isinstance(ask_continue, dict) else None
    if continue_ctx is None and isinstance(scope, dict):
        raw_cont = scope.get("askContinue")
        if isinstance(raw_cont, dict):
            continue_ctx = raw_cont
    floaters_only = (
        scope_mode in ("random_ideas", "floaters")
        or is_floaters_question(question)
        or is_floaters_followup_context(continue_ctx)
    )
    # Home silo already chose Random ideas — stamp the question so floaters
    # inventory/clarify routes fire even without saying "floaters" again.
    if scope_mode in ("random_ideas", "floaters") and not is_floaters_question(question):
        question = f"In my random ideas: {question}"
        floaters_only = True

    section_hints = extract_section_hints(question)
    if section_hints and not floaters_only:
        section_scoped = filter_entries_by_section(entries, section_hints)
        if section_scoped:
            entries = section_scoped
        else:
            work_hints_early = extract_work_hints(question, entries)
            return _finish({
                "ok": True,
                "answer": format_section_nothing_saved(work_hints_early, section_hints),
                "sources": [],
                "materialState": "nothing_saved",
                "mode": recall_mode,
                "questionKind": route_question(question),
                "recallVersion": RECALL_VERSION,
                "recallEngine": "local",
                "entryCount": len(_all_entries(data)),
            })

    if floaters_only:
        # Floaters Ask: never mix in work-tagged notes; ignore doc/work scope.
        floater_entries = filter_entries_floaters_only(entries)
        floater_hit = answer_floaters_ask(
            question, entries, ask_continue=continue_ctx
        )
        if floater_hit is not None:
            source_ids = list(floater_hit.get("sourceIds") or [])
            ranked_rows = []
            for eid in source_ids:
                for entry in floater_entries:
                    if str(entry.get("id") or "") != eid:
                        continue
                    ranked_rows.append(
                        {
                            "id": eid,
                            "title": str(entry.get("title") or "Untitled"),
                            "kind": str(entry.get("kind") or "note"),
                            "kindLabel": _kind_label(str(entry.get("kind") or "note")),
                            "excerpt": _best_excerpt(
                                str(entry.get("body") or ""), _tokenize(question), 220
                            ),
                            "score": 10,
                        }
                    )
                    break
            material_state = floater_hit.get("materialState") or (
                "summarizable" if source_ids else "nothing_saved"
            )
            payload = {
                "ok": True,
                "answer": floater_hit.get("answer") or "",
                "sources": sources_from_ranked(ranked_rows, material_state),
                "materialState": material_state,
                "mode": recall_mode,
                "questionKind": floater_hit.get("questionKind") or "list",
                "recallVersion": RECALL_VERSION,
                "recallEngine": "local",
                "recallScope": "floaters",
                "entryCount": len(floater_entries),
            }
            if "askContinue" in floater_hit:
                payload["askContinue"] = floater_hit.get("askContinue")
            return _finish(payload)
        entries = floater_entries
        scope_hints: set[str] = set()
        scope_strict = False
    elif scope_work or scope_doc_id:
        entries, scope_hints, scope_strict = filter_entries_by_recall_scope(
            entries,
            work_title=scope_work,
            document_id=scope_doc_id,
            scope_mode=scope_mode,
        )
    else:
        scope_hints = set()
        scope_strict = False

    if not entries:
        return _finish({
            "ok": True,
            "answer": format_nothing_saved(question, set()),
            "sources": [],
            "materialState": "nothing_saved",
            "mode": recall_mode,
            "questionKind": "fallback",
            "recallVersion": RECALL_VERSION,
            "recallEngine": "local",
            "recallScope": "floaters" if floaters_only else "",
            "entryCount": 0,
        })

    known_works = distinct_work_tags(entries)
    if floaters_only:
        # Stay inside the floater pile — no work filter, no disambiguation.
        work_hints: set[str] = set()
        strict_work = False
        scoped = list(entries)
    else:
        explicit = prefer_known_work_hints(
            explicit_work_hints(question, known_works, entries), known_works
        )
        work_hints = prefer_known_work_hints(
            extract_work_hints(question, entries), known_works
        )
        strict_work = bool(explicit)
        # Document-scoped Ask is always strict, even with an empty work_hints set.
        if scope_doc_id and scope_strict:
            strict_work = True
        if scope_hints:
            work_hints = set(scope_hints)
            strict_work = scope_strict or bool(scope_doc_id)
            # Known explicit work titles refine scope; junk never wipes doc/work scope.
            if explicit and not is_notes_not_in_draft_question(question):
                work_hints = explicit | set(scope_hints)
                strict_work = True
        elif scope_doc_id and scope_strict:
            # Already filtered to this document; keep corpus as-is.
            work_hints = set()
            strict_work = True
        elif explicit:
            work_hints = explicit
            strict_work = True
        elif work_hints:
            strict_work = False

        # Notes-vs-draft: trust the scoped work title; ignore meta phrases from the question.
        if is_notes_not_in_draft_question(question) and scope_work:
            work_hints = {scope_work.strip()}
            strict_work = True

        disambiguation = check_work_disambiguation(
            question,
            entries,
            scope_work=scope_work,
            scope_document_id=scope_doc_id,
            strict_work=strict_work,
        )
        if disambiguation:
            return _finish({
                "ok": True,
                "answer": disambiguation,
                "sources": [],
                "materialState": "fragments_only",
                "mode": recall_mode,
                "questionKind": "fallback",
                "recallVersion": RECALL_VERSION,
                "recallEngine": "local",
                "entryCount": len(entries),
            })

        scoped = filter_entries_by_work(entries, work_hints, strict=strict_work)

    if strict_work and not scoped:
        label = character_targets(question)
        target = label[0] if label else None
        return _finish({
            "ok": True,
            "answer": format_nothing_saved(
                question,
                work_hints,
                target_label=target,
                corpus_nonempty=bool(entries),
            ),
            "sources": [],
            "materialState": "nothing_saved",
            "mode": recall_mode,
            "questionKind": route_question(question),
            "recallVersion": RECALL_VERSION,
            "recallEngine": "local",
            "entryCount": len(entries),
        })

    ask_plan: AskPlan | None = local_ask_plan(question)
    if ask_plan is None and rag_enabled():
        ask_plan = route_ask_question(question, entry_hints_for_router(scoped))
    elif ask_plan is None:
        ask_plan = default_ask_plan(question)

    plan_section = section_hints_from_plan(ask_plan)
    if plan_section:
        section_scoped = filter_entries_by_section(scoped, plan_section)
        if section_scoped:
            scoped = section_scoped
        elif not section_hints:
            return _finish({
                "ok": True,
                "answer": format_section_nothing_saved(work_hints, plan_section),
                "sources": [],
                "materialState": "nothing_saved",
                "mode": recall_mode,
                "questionKind": ask_plan.question_kind,
                "recallVersion": RECALL_VERSION,
                "recallEngine": "local",
                "entryCount": len(entries),
            })

    if confirmed_ids:
        scoped = _filter_entries_by_confirmed(scoped, confirmed_ids)
        if not scoped:
            scoped = _filter_entries_by_confirmed(entries, confirmed_ids)
        if not scoped:
            return _finish({
                "ok": True,
                "answer": (
                    "None of the notes you selected are available anymore. "
                    "Ask again to pick from what is saved now."
                ),
                "sources": [],
                "candidates": [],
                "needsConfirm": False,
                "askPhase": "answer",
                "materialState": "nothing_saved",
                "mode": recall_mode,
                "questionKind": ask_plan.question_kind if ask_plan else route_question(question),
                "recallVersion": RECALL_VERSION,
                "recallEngine": "local",
                "entryCount": len(entries),
            })

    # Confirm-sources preview: show ranked notes/draft bits before summarizing.
    # Skip for spot-check, floaters (own clarify flow), and when ids already confirmed.
    if (
        phase == "preview"
        and not spot_check
        and not floaters_only
        and not confirmed_ids
    ):
        candidates = _build_confirm_candidates(question, scoped, ask_plan)
        if candidates:
            return _finish({
                "ok": True,
                "answer": (
                    "Here is what I found in your saved writing. "
                    "Uncheck anything that does not belong, then Summarize selected."
                ),
                "sources": [],
                "candidates": candidates,
                "needsConfirm": True,
                "askPhase": "preview",
                "materialState": "summarizable",
                "mode": recall_mode,
                "questionKind": ask_plan.question_kind if ask_plan else route_question(question),
                "recallVersion": RECALL_VERSION,
                "recallEngine": "local",
                "entryCount": len(entries),
                "routerEngine": ask_plan.router_engine if ask_plan else "",
                "askIntent": ask_plan.intent if ask_plan else "",
                "askPipeline": ask_plan.pipeline if ask_plan else "",
            })

    effective_kind = ask_plan.question_kind if ask_plan else route_question(question)

    def _attach_router_meta(payload: dict[str, Any]) -> dict[str, Any]:
        if ask_plan:
            payload["routerEngine"] = ask_plan.router_engine
            payload["askIntent"] = ask_plan.intent
            payload["askPipeline"] = ask_plan.pipeline
        return payload

    def _finish_local_pipeline(pipeline: dict[str, Any]) -> dict[str, Any]:
        return _finish(_attach_router_meta({
            "ok": True,
            "answer": pipeline["answer"],
            "sources": pipeline["sources"],
            "materialState": pipeline["materialState"],
            "mode": recall_mode,
            "questionKind": pipeline.get("questionKind") or effective_kind,
            "recallVersion": RECALL_VERSION,
            "recallEngine": "local",
            "entryCount": len(entries),
        }))

    knowledge_narrow = ask_plan and ask_plan.intent == "narrow_fact" and (
        is_knowledge_pov_question(question) or is_awareness_question(question)
    )
    # Tag/compare routes are local-only — never skip to RAG (Haiku used to steal them).
    local_only_kinds = frozenset(
        {"planned_gaps", "flagged_fix", "notes_not_in_draft"}
    )
    routed_kind = route_question(question)
    skip_local = (
        ask_plan
        and ask_plan.pipeline == "rag_summarize"
        and ask_plan.intent not in ("character_portrait",)
        and not knowledge_narrow
        and routed_kind not in local_only_kinds
        and not (
            ask_plan
            and ask_plan.question_kind in local_only_kinds
        )
    )
    # Story-arc relationship asks need synthesis — skip the local note-dump and use RAG.
    if (
        ask_plan
        and ask_plan.intent == "relationship"
        and ask_plan.pipeline == "rag_summarize"
    ):
        from lorekeeper_relations import is_story_arc_relationship_question

        if is_story_arc_relationship_question(question):
            skip_local = True
        else:
            # Kinship can stay local (short family-tie restatement).
            skip_local = False
    local_pipeline = None
    if not skip_local:
        local_pipeline = answer_for_work(
            question,
            scoped,
            work_hints=work_hints,
            strict_work=strict_work,
            mode=recall_mode,
            tokenize=_tokenize,
            best_excerpt=_best_excerpt,
            kind_label=_kind_label,
        )
    if local_pipeline is not None:
        pipe_kind = str(local_pipeline.get("questionKind") or "")
        if pipe_kind in local_only_kinds and str(local_pipeline.get("answer") or "").strip():
            return _finish_local_pipeline(local_pipeline)
        if local_pipeline_skips_rag(
            question, local_pipeline, scoped, spot_check=spot_check, plan=ask_plan
        ):
            return _finish_local_pipeline(local_pipeline)

    if ask_plan and is_awareness_question(question):
        if local_pipeline and str(local_pipeline.get("answer") or "").strip():
            return _finish_local_pipeline(local_pipeline)
        parts = awareness_parts(question)
        subject = parts[0] if parts else "they"
        topic = parts[1] if parts else "that topic"
        work_title = work_title_from_hints(work_hints) if work_hints else ""
        where = f" in {work_title}" if work_title else ""
        return _finish(_attach_router_meta({
            "ok": True,
            "answer": (
                f"From what you've saved{where}, {subject}'s awareness of {topic} "
                f"isn't spelled out yet in a clear note — add what they know right now."
            ),
            "sources": [],
            "materialState": "nothing_saved",
            "mode": recall_mode,
            "questionKind": "knowledge",
            "recallVersion": RECALL_VERSION,
            "recallEngine": "local",
            "entryCount": len(entries),
        }))

    if rag_enabled():
        try:
            def _augment_with_plan(q: str, sc: list[dict[str, Any]], ranked: list[dict[str, Any]]):
                boosted = augment_ranked_for_targets(
                    q,
                    sc,
                    ranked,
                    rank_entry=_score_entry,
                    kind_label=_kind_label,
                    best_excerpt=_best_excerpt,
                    tokenize=_tokenize,
                )
                try:
                    from lorekeeper_plot_span import augment_ranked_for_plot_span

                    boosted = augment_ranked_for_plot_span(
                        q,
                        sc,
                        boosted,
                        rank_entry=_score_entry,
                        kind_label=_kind_label,
                        best_excerpt=_best_excerpt,
                        tokenize=_tokenize,
                    )
                except Exception:
                    pass
                return _merge_ranked_for_plan(q, sc, boosted, ask_plan)

            rag_result = answer_with_rag(
                question,
                scoped,
                mode=recall_mode,
                rank_entries=_rank_entries,
                augment_ranked=_augment_with_plan,
                question_kind=effective_kind,
                plan=ask_plan,
                writer_confirmed=bool(confirmed_ids),
            )
            # Writer pinned sources: never keep a false "nothing there" answer.
            if confirmed_ids and answer_looks_like_empty_claim(
                str(rag_result.get("answer") or "")
            ):
                conf_answer, conf_rows = summarize_confirmed_entries(question, scoped)
                conf_state = classify_material(
                    question,
                    scoped,
                    conf_rows,
                    conf_answer,
                    strict_work=strict_work,
                    work_hints=work_hints,
                )
                return _finish(_attach_router_meta({
                    "ok": True,
                    "answer": conf_answer,
                    "sources": sources_from_ranked(conf_rows, conf_state),
                    "materialState": conf_state,
                    "mode": recall_mode,
                    "questionKind": effective_kind,
                    "askPhase": "answer",
                    "needsConfirm": False,
                    "recallVersion": RECALL_VERSION,
                    "recallEngine": "local",
                    "entryCount": len(entries),
                }))
            targets = character_labels_for_plan(ask_plan, scoped) if ask_plan else character_targets(question)
            label = targets[0] if targets else ""
            if (
                ask_plan
                and ask_plan.intent == "relationship"
                and is_relationship_between_question(question)
            ):
                from lorekeeper_relations import (
                    answer_story_arc_relationship,
                    is_story_arc_relationship_question,
                )

                rag_ans = str(rag_result.get("answer") or "")
                if is_story_arc_relationship_question(question) and re.search(
                    r"(?i)do not contain\s+story[- ]dynamic|no story[- ]dynamic|"
                    r"nothing (?:clear |saved )?about how .{0,40}relationship develops|"
                    r"no sources?\b.{0,100}spell out|"
                    r"no sources?\b.{0,100}(?:interaction|alliance|rivalry)|"
                    r"only contain\s+one\s+(?:saved\s+)?draft|"
                    r"covers?\s+their\s+origin|"
                    r"relationship is not yet spelled out|"
                    r"not yet spelled out.{0,40}(?:pre[- ]?war|post[- ]?war|window|dynamic)",
                    rag_ans,
                ):
                    if confirmed_ids:
                        conf_answer, conf_rows = summarize_confirmed_entries(
                            question, scoped
                        )
                        conf_state = classify_material(
                            question,
                            scoped,
                            conf_rows,
                            conf_answer,
                            strict_work=strict_work,
                            work_hints=work_hints,
                        )
                        return _finish(_attach_router_meta({
                            "ok": True,
                            "answer": conf_answer,
                            "sources": sources_from_ranked(conf_rows, conf_state),
                            "materialState": conf_state,
                            "mode": recall_mode,
                            "questionKind": "relationship",
                            "askPhase": "answer",
                            "needsConfirm": False,
                            "recallVersion": RECALL_VERSION,
                            "recallEngine": "local",
                            "entryCount": len(entries),
                        }))
                    local_arc = answer_story_arc_relationship(question, scoped)
                    if (
                        local_arc
                        and local_arc[0]
                        and "nothing clear is saved yet about how" not in local_arc[0].lower()
                    ):
                        pipeline = answer_for_work(
                            question,
                            scoped,
                            work_hints=work_hints,
                            strict_work=strict_work,
                            mode=recall_mode,
                            tokenize=_tokenize,
                            best_excerpt=_best_excerpt,
                            kind_label=_kind_label,
                        )
                        if pipeline and str(pipeline.get("answer") or "").strip():
                            return _finish_local_pipeline(pipeline)
                        # Direct gatherer hit when work pipeline is empty.
                        answer, source_ids = local_arc
                        ranked = [
                            {
                                "id": sid,
                                "title": "Note",
                                "kind": "note",
                                "kindLabel": "Note",
                                "score": 50,
                                "excerpt": answer[:200],
                                "body": answer,
                            }
                            for sid in source_ids[:4]
                        ]
                        state = classify_material(
                            question,
                            scoped,
                            ranked,
                            answer,
                            strict_work=strict_work,
                            work_hints=work_hints,
                        )
                        return _finish(_attach_router_meta({
                            "ok": True,
                            "answer": answer,
                            "sources": sources_from_ranked(ranked, state),
                            "materialState": state,
                            "mode": recall_mode,
                            "questionKind": "relationship",
                            "recallVersion": RECALL_VERSION,
                            "recallEngine": "local",
                            "entryCount": len(entries),
                        }))
            if (
                effective_kind == "who"
                and label
                and cast_answer_is_thin(rag_result.get("answer") or "", label)
            ):
                pipeline = answer_for_work(
                    question,
                    scoped,
                    work_hints=work_hints,
                    strict_work=strict_work,
                    mode=recall_mode,
                    tokenize=_tokenize,
                    best_excerpt=_best_excerpt,
                    kind_label=_kind_label,
                )
                if pipeline and not cast_answer_is_thin(
                    pipeline.get("answer") or "", label
                ):
                    return _finish({
                        "ok": True,
                        "answer": pipeline["answer"],
                        "sources": pipeline["sources"],
                        "materialState": pipeline["materialState"],
                        "mode": recall_mode,
                        "questionKind": pipeline["questionKind"],
                        "recallVersion": RECALL_VERSION,
                        "recallEngine": "local",
                        "entryCount": len(entries),
                    })
            return _finish(_attach_router_meta({
                "ok": True,
                "answer": rag_result["answer"],
                "sources": rag_result["sources"],
                "materialState": rag_result["materialState"],
                "mode": recall_mode,
                "questionKind": rag_result.get("questionKind", effective_kind),
                "recallVersion": RECALL_VERSION,
                "recallEngine": "rag",
                "retrievalCount": rag_result.get("retrievalCount", 0),
                "entryCount": len(entries),
                "answerModel": rag_result.get("answerModel"),
            }))
        except Exception as exc:
            import sys

            print(f"LoreKeeper RAG failed, falling back to local: {exc}", file=sys.stderr)

    # Confirmed notes: summarize those bodies rather than a second fuzzy search.
    if confirmed_ids:
        conf_answer, conf_rows = summarize_confirmed_entries(question, scoped)
        conf_state = classify_material(
            question,
            scoped,
            conf_rows,
            conf_answer,
            strict_work=strict_work,
            work_hints=work_hints,
        )
        return _finish(_attach_router_meta({
            "ok": True,
            "answer": conf_answer,
            "sources": sources_from_ranked(conf_rows, conf_state),
            "materialState": conf_state,
            "mode": recall_mode,
            "questionKind": effective_kind,
            "askPhase": "answer",
            "needsConfirm": False,
            "recallVersion": RECALL_VERSION,
            "recallEngine": "local",
            "entryCount": len(entries),
        }))

    pipeline = answer_for_work(
        question,
        scoped,
        work_hints=work_hints,
        strict_work=strict_work,
        mode=recall_mode,
        tokenize=_tokenize,
        best_excerpt=_best_excerpt,
        kind_label=_kind_label,
    )
    if pipeline is not None:
        return _finish_local_pipeline(pipeline)

    ranked = _rank_entries(question, scoped)
    ranked = augment_ranked_for_targets(
        question,
        scoped,
        ranked,
        rank_entry=_score_entry,
        kind_label=_kind_label,
        best_excerpt=_best_excerpt,
        tokenize=_tokenize,
    )
    try:
        from lorekeeper_plot_span import augment_ranked_for_plot_span

        ranked = augment_ranked_for_plot_span(
            question,
            scoped,
            ranked,
            rank_entry=_score_entry,
            kind_label=_kind_label,
            best_excerpt=_best_excerpt,
            tokenize=_tokenize,
        )
    except Exception:
        pass
    summary_ids = character_summary_sources(question, scoped)
    if summary_ids:
        id_set = set(summary_ids)
        ranked = [r for r in ranked if r["id"] in id_set] + [
            r for r in ranked if r["id"] not in id_set
        ]
    ranked = filter_ranked_by_threshold(ranked, question)

    answer = _legacy_fallback_answer(
        question, ranked, scoped, work_hints=work_hints, strict_work=strict_work
    )
    material_state = classify_material(
        question,
        scoped,
        ranked,
        answer,
        strict_work=strict_work,
        work_hints=work_hints,
    )
    answer = demote_synthesis(question, answer, ranked, material_state)
    material_state = classify_material(
        question,
        scoped,
        ranked,
        answer,
        strict_work=strict_work,
        work_hints=work_hints,
    )

    sources = sources_from_ranked(ranked, material_state)
    return _finish({
        "ok": True,
        "answer": answer,
        "sources": sources,
        "materialState": material_state,
        "mode": recall_mode,
        "questionKind": "fallback",
        "recallVersion": RECALL_VERSION,
        "recallEngine": "local",
        "entryCount": len(entries),
    })
