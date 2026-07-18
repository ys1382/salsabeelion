"""LoreKeeper — recall reliability gates (#7–10): work scope, material states, synthesis quality."""
from __future__ import annotations

import re
from typing import Any, Literal

from lorekeeper_character_compose import is_composed_reference_answer
from lorekeeper_section_scope import is_section_scope_phrase, work_hint_from_section_phrase
from lorekeeper_work_membership import note_visible_for_work

MaterialState = Literal["nothing_saved", "fragments_only", "summarizable"]

MIN_CONFIDENT_SCORE = 7
DEMOTE_BULLET_THRESHOLD = 3

_SUMMARY_HINT = re.compile(
    r"\b("
    r"summary|summarize|who is|tell me about|what do i (?:have|know|written)|"
    r"what about|anything about|notes on|"
    r"everything (?:i (?:have )?)?(?:written|saved)(?:\s+on|\s+about)?|"
    r"everything (?:i wrote|about|on)|character profile|remind me about|"
    r"tell me everything|all i (?:have )?(?:written|saved)|"
    r"what(?:'s| is) .+ (?:like|about)|gather|pull together|collect|show me"
    r")\b",
    re.I,
)


_GENERIC_WORK_WORDS = frozenset(
    {"task", "tasks", "note", "notes", "fix", "fixes", "list", "draft", "project", "work"}
)

# Topic language after "my notes on …" / similar — never a work title.
_JUNK_WORK_HINT = re.compile(
    r"^(?:"
    r"notes?\s+(?:on|about|for|regarding)\b|"
    r"all\s+notes?\b|"
    r"that\s+\w+|"
    r"this\s+\w+|"
    r"the\s+(?:look|expression|face|scene|beat|moment)\b|"
    r"expression\b|look\b|face\b"
    r")",
    re.I,
)

_MY_WORK_TAIL = re.compile(
    r"\bmy\s+(.+?)\s+(?:task\s+list|notes?\b|fix(?:es)?\b|list\b)",
    re.I,
)


def _normalize_work_key(text: str) -> str:
    """Fold trailing possessive 's so near-duplicate tags compare alike."""
    cleaned = re.sub(r"\s+", " ", (text or "").strip().lower())
    return re.sub(r"['']s\b", "", cleaned).replace("'", "").replace("’", "")


def _is_junk_work_hint(hint: str) -> bool:
    h = re.sub(r"\s+", " ", (hint or "").strip().lower().rstrip("?.!"))
    if not h or len(h) <= 2:
        return True
    if h in _GENERIC_WORK_WORDS:
        return True
    return bool(_JUNK_WORK_HINT.match(h))


def _hints_from_my_phrase(question: str) -> set[str]:
    """'my Smoke and Mirrors task list' — same intent as 'In Smoke and Mirrors, …'.

    Requires a work name *between* 'my' and notes/task list/list.
    'all my notes on that expression' is topic language, not a work title.
    """
    hints: set[str] = set()
    for m in _MY_WORK_TAIL.finditer(question or ""):
        hint = re.sub(r"\s+", " ", m.group(1).strip().lower().rstrip("?.!"))
        if _is_junk_work_hint(hint):
            continue
        if is_section_scope_phrase(hint):
            work = work_hint_from_section_phrase(hint)
            if work:
                hints.add(work)
            continue
        hints.add(hint)
    return hints


def primary_work_hints(question: str) -> set[str]:
    hints: set[str] = set()
    for m in re.finditer(r"\bin\s+([^,?]+)", question, re.I):
        hint = re.sub(r"\s+", " ", m.group(1).strip().lower().rstrip("?.!"))
        if len(hint) <= 2 or _is_junk_work_hint(hint):
            continue
        if is_section_scope_phrase(hint):
            work = work_hint_from_section_phrase(hint)
            if work:
                hints.add(work)
            continue
        hints.add(hint)
    hints.update(_hints_from_my_phrase(question))
    return hints


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        row = [i]
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            row.append(min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost))
        prev = row
    return prev[-1]


def work_tags_are_typo_variants(a: str, b: str) -> bool:
    """Same project with a letter dropped, added, or a possessive tweak."""
    na = _normalize_work_key(a)
    nb = _normalize_work_key(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    if na in nb or nb in na:
        return abs(len(na) - len(nb)) <= 2
    min_len = min(len(na), len(nb))
    if min_len < 6:
        return False
    max_dist = 1 if min_len < 14 else 2
    return _levenshtein(na, nb) <= max_dist


def work_tag_matches_text(work: str, text: str) -> bool:
    wl = (work or "").strip().lower()
    tl = (text or "").strip().lower()
    if len(wl) <= 2:
        return False
    if wl in tl or tl in wl:
        return True
    nw = _normalize_work_key(work)
    nt = _normalize_work_key(text)
    if nw in nt or nt in nw:
        return abs(len(nw) - len(nt)) <= 2
    return work_tags_are_typo_variants(work, text)


def cluster_same_project_tags(works: list[str]) -> list[list[str]]:
    clusters: list[list[str]] = []
    for work in works:
        if not str(work or "").strip():
            continue
        placed = False
        for cluster in clusters:
            if any(work_tags_are_typo_variants(work, other) for other in cluster):
                cluster.append(work)
                placed = True
                break
        if not placed:
            clusters.append([work])
    return clusters


def _pick_canonical_work_tag(question: str, candidates: list[str]) -> str:
    hints = primary_work_hints(question)

    def score(work: str) -> tuple[int, int]:
        hint_hit = 1 if any(work_tag_matches_text(work, h) for h in hints) else 0
        return (hint_hit, len(work))

    return max(candidates, key=score)


def work_tag_in_question(work: str, question: str) -> bool:
    if work_tag_matches_text(work, question):
        return True
    for hint in primary_work_hints(question):
        if work_tag_matches_text(work, hint):
            return True
    return False


def collapse_near_duplicate_work_tags(question: str, works: list[str]) -> list[str]:
    """Typo-tagged duplicates (Snow Leopard / Snow Leopar) count as one project."""
    matched = [w for w in works if work_tag_in_question(w, question)]
    if not matched:
        return []
    if len(matched) == 1:
        return matched
    clusters = cluster_same_project_tags(matched)
    return [_pick_canonical_work_tag(question, cluster) for cluster in clusters]


_LEADING_QUESTION_START = re.compile(
    r"^(who|what|where|when|how|list|tell me|can you|show me)\b",
    re.I,
)


def _leading_title_boundary_ok(rest: str) -> bool:
    if not rest:
        return True
    if rest[0] in ",:;—-?":
        return True
    return bool(_LEADING_QUESTION_START.match(rest))


def _hints_from_leading_work_tag(question: str, known_works: list[str]) -> set[str]:
    """'Smoke and Mirrors, who is…' — same intent as 'In Smoke and Mirrors, …'."""
    q = (question or "").strip()
    if not q or not known_works:
        return set()
    ql = q.lower()
    candidates: list[str] = []
    for work in known_works:
        wl = str(work or "").strip()
        if len(wl) <= 2:
            continue
        wlow = wl.lower()
        if not ql.startswith(wlow):
            continue
        rest = q[len(wl) :].lstrip()
        if _leading_title_boundary_ok(rest):
            candidates.append(wl)
    if not candidates:
        return set()
    max_len = max(len(c) for c in candidates)
    longest = [c for c in candidates if len(c) == max_len]
    collapsed = collapse_near_duplicate_work_tags(question, longest)
    return {w.lower() for w in collapsed}


def explicit_work_hints(
    question: str,
    known_works: list[str],
    entries: list[dict[str, Any]],
) -> set[str]:
    hints = set(primary_work_hints(question))
    hints.update(_hints_from_leading_work_tag(question, known_works))
    return _collapse_work_hint_set(question, hints, entries)


def _collapse_work_hint_set(question: str, hints: set[str], entries: list[dict[str, Any]]) -> set[str]:
    cleaned = {h for h in hints if h and not _is_junk_work_hint(h)}
    if not cleaned:
        return cleaned
    tag_by_lower = {str(t).strip().lower(): str(t).strip() for e in entries if isinstance(e, dict) for t in (e.get("tags") or []) if str(t).strip()}
    canonical = [tag_by_lower.get(h, h) for h in cleaned]
    collapsed = collapse_near_duplicate_work_tags(question, canonical)
    if not collapsed:
        return cleaned
    return {w.lower() for w in collapsed}


def prefer_known_work_hints(
    hints: set[str], known_works: list[str]
) -> set[str]:
    """Keep only hints that match a known work tag when any such match exists."""
    if not hints or not known_works:
        return set(hints or ())
    matched: set[str] = set()
    for hint in hints:
        for work in known_works:
            wl = str(work or "").strip()
            if not wl:
                continue
            if _hint_matches_tag(hint, wl) or work_tags_are_typo_variants(hint, wl):
                matched.add(wl.lower())
                break
    return matched if matched else set(hints)


def extract_work_hints(question: str, entries: list[dict[str, Any]]) -> set[str]:
    hints = set(primary_work_hints(question))
    hints = _collapse_work_hint_set(question, hints, entries)
    if hints:
        return hints
    q = (question or "").lower()
    m = re.search(r"\bin\s+(.+?)(?:\?|$)", question, re.I)
    if m:
        hint = re.sub(r"\s+", " ", m.group(1).strip().lower().rstrip("?.!"))
        if len(hint) > 2 and not is_section_scope_phrase(hint) and not _is_junk_work_hint(hint):
            hints.add(hint)
    tag_hits: list[str] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        title_base = str(entry.get("title") or "").split(" / ")[0].strip().lower()
        if len(title_base) > 2 and title_base in q:
            tag_hits.append(title_base)
        for tag in entry.get("tags") or []:
            raw = str(tag).strip()
            if len(raw) > 2 and work_tag_in_question(raw, question):
                tag_hits.append(raw)
    if tag_hits:
        collapsed = collapse_near_duplicate_work_tags(question, tag_hits)
        hints.update(w.lower() for w in collapsed)
    return _collapse_work_hint_set(question, hints, entries)


def work_named_in_question(
    question: str,
    *,
    known_works: list[str] | None = None,
    entries: list[dict[str, Any]] | None = None,
) -> bool:
    if known_works is not None and entries is not None:
        return bool(explicit_work_hints(question, known_works, entries))
    if known_works is not None:
        hints = set(primary_work_hints(question))
        hints.update(_hints_from_leading_work_tag(question, known_works))
        return bool(hints)
    return bool(primary_work_hints(question))


def _hint_matches_tag(hint: str, tag: str) -> bool:
    h = (hint or "").strip().lower()
    t = (tag or "").strip().lower()
    if not h or not t:
        return False
    if h in t or t in h:
        return True
    return work_tags_are_typo_variants(h, t)


def entry_matches_work(entry: dict[str, Any], work_hints: set[str]) -> bool:
    if not work_hints:
        return True
    title = str(entry.get("title") or "").lower()
    title_base = title.split(" / ")[0].strip()
    tags = [str(t).strip().lower() for t in (entry.get("tags") or [])]
    for hint in work_hints:
        if hint in title or hint in title_base:
            return True
        if any(_hint_matches_tag(hint, t) for t in tags):
            return True
    return False


def filter_entries_by_work(
    entries: list[dict[str, Any]],
    work_hints: set[str],
    *,
    strict: bool,
    document_id: str = "",
) -> list[dict[str, Any]]:
    """Work scope: this work + unassigned/idk notes (unless ruled out), never other works."""
    if not work_hints:
        return entries
    work_title = max(work_hints, key=len)
    filtered = [
        e
        for e in entries
        if isinstance(e, dict)
        and note_visible_for_work(e, work_title, document_id=document_id)
    ]
    if strict:
        return filtered
    return filtered or entries


def _normalize_scope_hint(raw: str) -> str:
    return re.sub(r"\s+", " ", (raw or "").strip().lower())


def filter_entries_by_recall_scope(
    entries: list[dict[str, Any]],
    *,
    work_title: str = "",
    document_id: str = "",
    scope_mode: str = "work",
) -> tuple[list[dict[str, Any]], set[str], bool]:
    """Doc Ask scope (#19): this work (default) or this document only."""
    work_hint = _normalize_scope_hint(work_title)
    work_hints: set[str] = {work_hint} if work_hint else set()
    mode = (scope_mode or "work").strip().lower()
    doc_id = str(document_id or "").strip()

    if mode == "document" and doc_id:
        scoped: list[dict[str, Any]] = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            eid = str(entry.get("id") or "")
            parent = str(entry.get("parentDocId") or "")
            linked = str(entry.get("linkedDocId") or "")
            if eid == doc_id or eid.startswith(f"{doc_id}#") or parent == doc_id:
                scoped.append(entry)
            elif linked == doc_id:
                scoped.append(entry)
        return scoped, work_hints, bool(work_hints or scoped)

    if work_hints:
        return (
            filter_entries_by_work(
                entries, work_hints, strict=True, document_id=doc_id
            ),
            work_hints,
            True,
        )
    return entries, work_hints, False


def augment_question_with_scope_work(question: str, work_title: str) -> str:
    """Prefix work name when the writer scoped Ask to a project (#19)."""
    q = (question or "").strip()
    work = (work_title or "").strip()
    if not q or not work:
        return q
    if work_named_in_question(q):
        return q
    if re.search(rf"\b{re.escape(work)}\b", q, re.I):
        return q
    return f"In {work}, {q}"


def _name_in_text(name: str, text: str) -> bool:
    if not name or not text:
        return False
    return bool(re.search(rf"\b{re.escape(name)}\b", text, re.I))


def entries_mentioning_targets(
    entries: list[dict[str, Any]], targets: list[str]
) -> list[dict[str, Any]]:
    if not targets:
        return []
    hits: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        blob = f"{entry.get('title') or ''} {entry.get('body') or ''}"
        if any(_name_in_text(name, blob) for name in targets):
            hits.append(entry)
    return hits


def augment_ranked_for_targets(
    question: str,
    scoped: list[dict[str, Any]],
    ranked: list[dict[str, Any]],
    *,
    rank_entry,
    kind_label,
    best_excerpt,
    tokenize,
) -> list[dict[str, Any]]:
    """Surface name mentions in drafts even when token scores are zero (#8)."""
    from lorekeeper_aliases import expand_name_list
    from lorekeeper_character_summary import character_targets

    targets = expand_name_list(
        character_targets(question),
        scoped,
        extract_work_hints(question, scoped),
    )
    if not targets:
        return ranked
    ranked_ids = {r.get("id") for r in ranked}
    question_tokens = tokenize(question)
    extra: list[dict[str, Any]] = []
    for entry in entries_mentioning_targets(scoped, targets):
        eid = str(entry.get("id") or "")
        if eid in ranked_ids:
            continue
        score = rank_entry(question, entry)
        if score <= 0:
            score = 4
        extra.append(
            {
                "id": eid,
                "title": str(entry.get("title") or "Untitled"),
                "kind": str(entry.get("kind") or "note"),
                "kindLabel": kind_label(str(entry.get("kind") or "note")),
                "score": score,
                "excerpt": best_excerpt(str(entry.get("body") or ""), question_tokens),
                "body": str(entry.get("body") or "")[:8000],
            }
        )
    if not extra:
        return ranked
    merged = ranked + extra
    merged.sort(key=lambda row: row["score"], reverse=True)
    return merged


def filter_ranked_by_threshold(
    ranked: list[dict[str, Any]], question: str
) -> list[dict[str, Any]]:
    from lorekeeper_character_summary import character_targets, is_who_is_question

    if not ranked:
        return ranked
    if is_who_is_question(question) or character_targets(question):
        return [r for r in ranked if r.get("score", 0) >= 4] or ranked[:3]
    return [r for r in ranked if r.get("score", 0) >= MIN_CONFIDENT_SCORE] or ranked[:1]


def work_label_from_hints(hints: set[str]) -> str:
    if not hints:
        return "this work"
    return next(iter(sorted(hints, key=len, reverse=True))).title()


def format_nothing_saved(
    question: str, work_hints: set[str], target_label: str | None = None
) -> str:
    work = work_label_from_hints(work_hints)
    if target_label:
        return (
            f"Nothing saved on {target_label} in {work} yet — only in your head until you "
            "add a note or draft for that project."
        )
    if work_hints:
        return (
            f"Nothing saved for {work} yet — only in your head until you add notes or a "
            "draft tagged with that work title."
        )
    return (
        "You don't have any saved entries yet. Add notes or a document first, then ask again."
    )


def format_scattered_fallback(ranked: list[dict[str, Any]]) -> str:
    lines = [
        "What you've saved is too scattered to summarize cleanly yet. "
        "Here's the closest bit from your notes:\n"
    ]
    for row in ranked[:2]:
        lines.append(f"• {row['title']} ({row['kindLabel']}): {row['excerpt']}")
    lines.append("\n— Pulled from your notes only. Nothing invented.")
    return "\n".join(lines)


def wants_summary_style(question: str) -> bool:
    from lorekeeper_character_summary import is_who_is_question

    return bool(_SUMMARY_HINT.search(question)) or is_who_is_question(question)


def answer_looks_fragmented(answer: str) -> bool:
    a = answer or ""
    heading = "What isn't spelled out yet in your notes:"
    if heading in a:
        clear = a.split(heading, 1)[0].strip()
        if is_composed_reference_answer(
            clear + "\n\n— From your notes only. Nothing invented."
        ):
            return False
        if len(clear) > 80 and re.search(
            r"\b(protagonist|antagonist|married|brother|sister|is the|was the)\b",
            clear,
            re.I,
        ):
            return False
    if re.search(r"&(?:nbsp|#\d+;)", a, re.I):
        return True
    if "haven't fleshed them out yet" in a:
        return True
    if "little is spelled out yet" in a:
        return True
    if "mostly lines of dialogue" in a:
        return True
    if "mostly scene beats" in a:
        return True
    if "mostly dialogue or scene beats" in a:
        return True
    if "That's a gap you might want to fill" in a:
        return True
    if "couldn't find anything about" in a and "mention" in a:
        return True
    return False


def answer_looks_summarizable(answer: str) -> bool:
    a = answer or ""
    if "What isn't spelled out yet in your notes:" in a:
        a = a.split("What isn't spelled out yet in your notes:", 1)[0].strip()
    if is_composed_reference_answer(answer):
        return True
    a = answer or ""
    if answer_looks_fragmented(a):
        return False
    if "too scattered to summarize" in a:
        return False
    if "Nothing saved" in a and "only in your head" in a:
        return False
    if "don't have any saved entries" in a:
        return False
    if "— From your notes only. Nothing invented." in a and a.count("•") < 2:
        if re.search(r"\b(is|was)\s+(?:the\s+)?(?:protagonist|antagonist|married|brother|sister)\b", a, re.I):
            return True
        if re.search(rf"^Character\s+[A-Z0-9]+\n\n", a):
            return True
    if "Family ties:" in a:
        return True
    if re.search(r"\b(is|was)\s+(?:the\s+)?(?:protagonist|antagonist|hero|villain)\b", a, re.I):
        return True
    if "— from what you've saved:" in a and "•" not in a.split("— from what you've saved:")[-1][:200]:
        return True
    if "— Read from your draft only" in a:
        return True
    if "— Pulled from your draft only" in a and a.count("•") < 2:
        return True
    return False


def classify_material(
    question: str,
    scoped: list[dict[str, Any]],
    ranked: list[dict[str, Any]],
    answer: str,
    *,
    strict_work: bool,
    work_hints: set[str],
) -> MaterialState:
    from lorekeeper_character_summary import character_targets, is_who_is_question

    targets = character_targets(question)
    if strict_work and not scoped:
        return "nothing_saved"
    if not scoped and not ranked:
        return "nothing_saved"
    if targets and not entries_mentioning_targets(scoped, targets) and not ranked:
        return "nothing_saved"
    if not ranked and not answer_looks_summarizable(answer):
        if targets or is_who_is_question(question):
            return "fragments_only"
        return "nothing_saved"
    if answer_looks_summarizable(answer):
        return "summarizable"
    if answer_looks_fragmented(answer):
        return "fragments_only"
    if is_composed_reference_answer(answer):
        return "summarizable"
    if "From what you've written:" in (answer or "") or (answer or "").count("•") >= 2:
        return "fragments_only"
    if "too scattered to summarize cleanly yet" in (answer or ""):
        return "fragments_only"
    if ranked and ranked[0].get("score", 0) < MIN_CONFIDENT_SCORE and wants_summary_style(question):
        if not is_composed_reference_answer(answer):
            return "fragments_only"
    if ranked and len(ranked) >= 1 and not wants_summary_style(question):
        return "summarizable"
    return "fragments_only"


def should_demote_synthesis(
    question: str, answer: str, ranked: list[dict[str, Any]], state: MaterialState
) -> bool:
    if is_composed_reference_answer(answer):
        return False
    if state == "summarizable":
        return False
    if not wants_summary_style(question):
        return False
    if "too scattered to summarize" in (answer or ""):
        return False
    bullets = (answer or "").count("•")
    if bullets >= DEMOTE_BULLET_THRESHOLD:
        return True
    if state == "fragments_only" and bullets >= 2:
        return True
    if ranked and len(ranked) == 1 and ranked[0].get("score", 0) < MIN_CONFIDENT_SCORE:
        if bullets >= 1 or "From what you've written" in (answer or ""):
            return True
    if (answer or "").count(";") >= 3:
        return True
    return False


def demote_synthesis(
    question: str,
    answer: str,
    ranked: list[dict[str, Any]],
    state: MaterialState,
) -> str:
    from lorekeeper_character_summary import character_targets, is_who_is_question

    if is_who_is_question(question) or character_targets(question):
        return answer
    if not should_demote_synthesis(question, answer, ranked, state):
        return answer
    if not ranked:
        return answer
    return format_scattered_fallback(ranked)


def sources_from_ranked(
    ranked: list[dict[str, Any]], state: MaterialState
) -> list[dict[str, Any]]:
    limit = 6 if state == "summarizable" else 3
    threshold = 4 if state == "fragments_only" else MIN_CONFIDENT_SCORE
    picked = [r for r in ranked if r.get("score", 0) >= threshold]
    if not picked:
        picked = ranked[:limit]
    return [
        {
            "id": row["id"],
            "title": row["title"],
            "kind": row["kind"],
            "kindLabel": row["kindLabel"],
            "excerpt": row["excerpt"],
        }
        for row in picked[:limit]
    ]
