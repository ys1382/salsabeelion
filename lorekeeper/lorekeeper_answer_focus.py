"""LoreKeeper — focused Ask answers (#41–47): facet, length, trim, sources."""
from __future__ import annotations

import re
from typing import Any, Literal

from lorekeeper_character_compose import is_audit_question, is_coverage_question
from lorekeeper_loose_ends import is_flagged_fix_question, is_planned_gap_question
from lorekeeper_character_summary import character_targets, is_who_is_question
from lorekeeper_relations import is_relationship_between_question
from lorekeeper_knowledge_pov import is_awareness_question
from lorekeeper_question_routes import (
    is_character_portrait_question,
    is_look_expression_question,
)

Facet = Literal[
    "relationship",
    "role",
    "appearance",
    "voice",
    "politics",
    "general",
]

_BROAD_RE = re.compile(
    r"\b("
    r"summarize|summary|everything (?:i wrote|about|on)|what have i (?:done|written|saved)|"
    r"coverage|tell me everything|full profile|everything about|all (?:notes|mentions) (?:on|about)"
    r")\b",
    re.I,
)

_FACET_RULES: list[tuple[Facet, re.Pattern[str]]] = [
    (
        "appearance",
        re.compile(
            r"\b("
            r"look like|looks like|appearance|physically|what does .+ look|"
            r"look on .{0,40} face|facial expression|expression on|"
            r"notes on (?:that |the )?expression|all my notes on (?:that |the )?expression"
            r")\b",
            re.I,
        ),
    ),
    ("voice", re.compile(r"\b(dialogue voice|how does .+ speak|speaking style|voice of)\b", re.I)),
    ("role", re.compile(r"\b(what (?:is|is the) .+ role|role of|cast role|protagonist or antagonist)\b", re.I)),
    (
        "politics",
        re.compile(
            r"\b(politic|political|faction|alliance|alliances|war between|government|"
            r"who rules|situation with|power struggle)\b",
            re.I,
        ),
    ),
    (
        "relationship",
        re.compile(
            r"\b(married to|spouse of|parent of|child of|sibling of|"
            r"relationship with(?! the work))\b",
            re.I,
        ),
    ),
]

_APPEARANCE_WORDS = re.compile(
    r"\b(grey|gray|skin|hair|eyes|tall|short|arcanist|elf|look|appearance|"
    r"dressed|robes|build|species|face|expression|eyes?|jaw|smile|grimace|"
    r"pale|flush|tense|soft)\b",
    re.I,
)

_FOOTER_MARKERS = (
    "— From your notes only",
    "— From your notes vs draft only",
    "— Restated from what you wrote",
    "— Pulled from your notes only",
    "— Combined from your notes only",
)

_INVENTED_EQUIV = re.compile(
    r"\s*\([^)]*\b(?:human counterpart|counterpart of)\b[^)]*\)",
    re.I,
)
_DESPITE_BIO = re.compile(
    r"\bdespite\s+their\s+biological\s+relation\b",
    re.I,
)
_CAST_CARD_HEADER = re.compile(
    r"^#+\s*.+?\s*(?:cast card|— cast card)\s*$",
    re.I | re.M,
)


def wants_broad_answer(question: str, *, question_kind: str = "") -> bool:
    """Explicit summarize / coverage / audit — allow wider answers (#46)."""
    if question_kind in (
        "coverage",
        "planned_gaps",
        "flagged_fix",
        "notes_not_in_draft",
    ):
        return True
    if question_kind == "relationship":
        from lorekeeper_relations import is_story_arc_relationship_question

        # Pre/post story dynamics need room; kinship stays narrow.
        return is_story_arc_relationship_question(question)
    if is_planned_gap_question(question) or is_flagged_fix_question(question):
        return True
    from lorekeeper_notes_vs_draft import is_notes_not_in_draft_question

    if is_notes_not_in_draft_question(question):
        return True
    if is_character_portrait_question(question):
        return True
    if is_coverage_question(question) or is_audit_question(question):
        return True
    if is_relationship_between_question(question):
        return False
    return bool(_BROAD_RE.search(question or ""))


def detect_narrow_facet(question: str) -> Facet | None:
    if not question or wants_broad_answer(question):
        return None
    if is_relationship_between_question(question):
        return None
    paren = " ".join(_parenthetical_hint_terms(question))
    if paren:
        q_with_paren = f"{question} {paren}"
        for facet, pattern in _FACET_RULES:
            if pattern.search(q_with_paren):
                return facet
    for facet, pattern in _FACET_RULES:
        if pattern.search(question):
            return facet
    if is_who_is_question(question):
        return None
    return None


def apply_facet_to_compose_buckets(
    facet: Facet | None,
    *,
    roles: list[str],
    identity: list[str],
    relationships: list[str],
    details: list[str],
    dialogue: list[str],
    scenes: list[str],
    stated_relationships: list[str] | None,
) -> tuple[list[str], list[str], list[str], list[str], list[str], list[str], list[str] | None]:
    if not facet or facet == "general":
        return roles, identity, relationships, details, dialogue, scenes, stated_relationships
    empty: list[str] = []
    stated = stated_relationships or []
    if facet == "relationship":
        return empty, empty, relationships, empty, empty, empty, stated
    if facet == "role":
        return roles, identity[:1], empty, empty, empty, empty, None
    if facet == "appearance":
        ident = [x for x in identity if _APPEARANCE_WORDS.search(x)]
        det = [x for x in details if _APPEARANCE_WORDS.search(x)]
        return empty, ident, empty, det, empty, empty, None
    if facet == "voice":
        return empty, empty, empty, empty, dialogue[:2], empty, None
    if facet == "politics":
        return empty, empty, relationships, details[:2], empty, scenes[:1], None
    return roles, identity, relationships, details, dialogue, scenes, stated_relationships


def _split_footer(answer: str) -> tuple[str, str]:
    for marker in _FOOTER_MARKERS:
        idx = answer.find(marker)
        if idx >= 0:
            return answer[:idx].rstrip(), answer[idx:].strip()
    return answer.strip(), ""


def _parenthetical_hint_terms(question: str) -> set[str]:
    """Words inside (…) — narrow facet hints the writer typed in the question."""
    terms: set[str] = set()
    for m in re.finditer(r"\(([^)]+)\)", question or ""):
        chunk = m.group(1)
        for part in re.findall(r"[a-z0-9']+", chunk.lower()):
            if len(part) > 2 and part not in {
                "the",
                "and",
                "who",
                "what",
                "that",
                "this",
                "with",
                "from",
                "about",
            }:
                terms.add(part)
    return terms


def _question_terms(question: str) -> set[str]:
    terms: set[str] = set()
    terms.update(_parenthetical_hint_terms(question))
    for t in character_targets(question):
        for part in re.findall(r"[a-z0-9']+", t.lower()):
            if len(part) > 2:
                terms.add(part)
    for part in re.findall(r"[a-z0-9']+", (question or "").lower()):
        if len(part) > 3 and part not in {
            "what",
            "when",
            "where",
            "who",
            "does",
            "about",
            "tell",
            "have",
            "your",
            "from",
            "that",
            "this",
            "with",
            "they",
            "them",
        }:
            terms.add(part)
    return terms


def trim_off_topic_sentences(question: str, answer: str, *, allow_broad: bool) -> str:
    if allow_broad or not answer:
        return answer
    body, footer = _split_footer(answer)
    if not body:
        return answer
    terms = _question_terms(question)
    if not terms:
        return answer
    title_line = ""
    rest = body
    parts = body.split("\n\n", 1)
    if len(parts) == 2 and len(parts[0].split()) <= 4 and not parts[0].startswith("•"):
        title_line = parts[0].strip()
        rest = parts[1]
    if rest.strip().startswith("•") or "• From" in rest:
        return answer
    sentences = re.split(r"(?<=[.!?])\s+", rest)
    kept: list[str] = []
    for sentence in sentences:
        s = sentence.strip()
        if not s:
            continue
        low = s.lower()
        if any(t in low for t in terms):
            kept.append(s)
            continue
        if is_who_is_question(question) and re.search(
            r"\b(protagonist|antagonist|married|brother|sister|role|guardian)\b", low
        ):
            kept.append(s)
    if not kept:
        return answer
    if len(kept) >= len([x for x in sentences if x.strip()]):
        return answer
    rebuilt = title_line + ("\n\n" if title_line else "") + " ".join(kept[:3])
    if footer:
        rebuilt = rebuilt.rstrip() + "\n\n" + footer
    return rebuilt


def _looks_incomplete_tail(text: str) -> bool:
    t = (text or "").rstrip()
    if not t:
        return True
    if t.count("**") % 2 == 1:
        return True
    if re.search(
        r"\b(the|a|an|however|but|and|or|of|to|for|with|as|than|that|this|"
        r"describe|none|not|no|your|notes?)\s*$",
        t,
        re.I,
    ):
        return True
    if not re.search(r"[.!?…][\"')\]]*\s*$", t):
        return True
    return False


def drop_trailing_unfinished_clause(text: str) -> str:
    """Drop a hanging last clause so answers never end mid-phrase."""
    t = (text or "").rstrip()
    if not t or not _looks_incomplete_tail(t):
        return t
    # Prefer last complete sentence boundary.
    matches = list(re.finditer(r"[.!?…][\"')\]]*", t))
    while matches:
        end = matches[-1].end()
        candidate = t[:end].rstrip()
        if candidate and not _looks_incomplete_tail(candidate):
            return candidate
        matches.pop()
    # Unclosed bold — cut before the orphan **
    if t.count("**") % 2 == 1:
        idx = t.rfind("**")
        if idx > 0:
            return drop_trailing_unfinished_clause(t[:idx].rstrip())
    return t


def _trim_to_complete_sentences(body: str, max_chars: int) -> str:
    """Trim under max_chars at a sentence end — never mid-phrase."""
    body = (body or "").strip()
    if len(body) <= max_chars:
        return drop_trailing_unfinished_clause(body)
    window = body[:max_chars]
    ends = [m.end() for m in re.finditer(r"[.!?…][\"')\]]*(?=\s|$)", window)]
    if ends:
        trimmed = window[: ends[-1]].rstrip()
        return drop_trailing_unfinished_clause(trimmed)
    # No sentence end in the window — keep the first full sentence (may slightly exceed).
    first = re.search(r"[.!?…][\"')\]]*(?=\s|$)", body)
    if first:
        return drop_trailing_unfinished_clause(body[: first.end()].rstrip())
    # Fallback: word boundary, then scrub hanging connectors.
    trimmed = window.rsplit(" ", 1)[0].rstrip()
    return drop_trailing_unfinished_clause(trimmed)


def apply_length_policy(
    question: str,
    answer: str,
    *,
    question_kind: str,
    allow_broad: bool,
) -> str:
    if not answer:
        return answer
    # Look/expression beats need room to finish the gap sentence.
    if allow_broad or is_look_expression_question(question):
        body, footer = _split_footer(answer)
        body = drop_trailing_unfinished_clause(body)
        if footer:
            return (body + "\n\n" + footer).strip() if body else answer
        return body or answer
    body, footer = _split_footer(answer)
    facet = detect_narrow_facet(question)
    limits = {
        "relationship": 280,
        "who": 900,
        "topic": 1200,
        "fallback": 900,
        "knowledge": 900,
    }
    max_chars = limits.get(question_kind, 900)
    if facet in ("appearance", "role", "voice"):
        max_chars = min(max_chars, 900)
    if question_kind == "relationship":
        max_chars = 280
    if len(body) <= max_chars:
        body = drop_trailing_unfinished_clause(body)
        if footer:
            return body + "\n\n" + footer if body else answer
        return body or answer
    trimmed = _trim_to_complete_sentences(body, max_chars)
    if not trimmed:
        trimmed = _trim_to_complete_sentences(body, max(max_chars, 200))
    if footer:
        return trimmed + "\n\n" + footer
    if trimmed and not trimmed.endswith(("…", ".", "!", "?")):
        return trimmed + "…"
    return trimmed


def focus_topic_gather_answer(question: str, answer: str, *, allow_broad: bool) -> str:
    """Cap bullet dumps; lead with the first on-topic bit (#43)."""
    if allow_broad or not answer or "•" not in answer:
        return answer
    body, footer = _split_footer(answer)
    lines = body.splitlines()
    bullets = [ln for ln in lines if ln.strip().startswith("•")]
    if len(bullets) <= 4:
        return answer
    header_lines = [ln for ln in lines if not ln.strip().startswith("•")]
    lead = bullets[0].lstrip("•").strip()
    if lead.lower().startswith("from "):
        lead = bullets[1].lstrip("•").strip() if len(bullets) > 1 else lead
    capped = bullets[:4]
    new_body = "\n".join(header_lines).strip()
    if lead and not lead.lower().startswith("what you've written"):
        new_body = (new_body + "\n\n" + lead).strip() if new_body else lead
    new_body = (new_body + "\n\n" + "\n".join(capped)).strip()
    if footer:
        return new_body + "\n\n" + footer
    return new_body


def filter_sources_for_answer(
    sources: list[dict[str, Any]], answer: str, question: str
) -> list[dict[str, Any]]:
    if not sources or not answer:
        return sources
    answer_low = answer.lower()
    terms = _question_terms(question)
    matched: list[dict[str, Any]] = []
    for src in sources:
        title = str(src.get("title") or "").lower()
        excerpt = str(src.get("excerpt") or src.get("body") or "").lower()
        if title and title in answer_low:
            matched.append(src)
            continue
        if excerpt and len(excerpt) > 24 and excerpt[:40] in answer_low:
            matched.append(src)
            continue
        if any(t in title or t in excerpt for t in terms):
            matched.append(src)
    if matched:
        return matched[:6]
    return sources[:3]


_SOURCES_META = re.compile(
    r"\b(?:the\s+)?sources?\s+(?:establish|indicate|show|suggest|state|say)\s+"
    r"(?:that\s+)?",
    re.I,
)
_SAME_TWO_CHARS = re.compile(
    r"\b(?:this is |that this is )?(?:the )?relationship between (?:the )?same two characters\b[^.?!]*[.?!]?\s*",
    re.I,
)
_FALSE_ARC_GAP = re.compile(
    r"(?is)\b(?:the\s+)?notes?\s+(?:saved\s+)?(?:for\s+[^.]{0,80}\s+)?"
    r"do not contain\s+story[- ]dynamic\s+material\b[^.?!]*[.?!]?\s*"
    r"|\bstory[- ]dynamic\s+material\s+(?:covering|about|on)\b[^.?!]*[.?!]?\s*"
    r"|\bno sources?\b[^.?!]{0,120}spell out\b[^.?!]*[.?!]?\s*"
    r"|\bno sources?\b[^.?!]{0,120}(?:interaction|alliance|rivalry|shift)\b[^.?!]*[.?!]?\s*"
    r"|\bonly contain\s+one\s+(?:saved\s+)?draft\s+block\b[^.?!]*[.?!]?\s*"
    r"|\bcovers?\s+their\s+origin\b[^.?!]*[.?!]?\s*"
    r"|\bnot\s+the\s+pre[- ]?war\b[^.?!]*[.?!]?\s*"
    r"|\brelationship is not yet spelled out\b[^.?!]*[.?!]?\s*"
    r"|\bnot yet spelled out in the saved notes\b[^.?!]*[.?!]?\s*",
)


def scrub_rag_artifacts(question: str, answer: str, *, allow_broad: bool) -> str:
    if not answer:
        return answer
    body, footer = _split_footer(answer)
    body = _INVENTED_EQUIV.sub("", body)
    body = _DESPITE_BIO.sub("", body)
    body = _SOURCES_META.sub("", body)
    body = _SAME_TWO_CHARS.sub("", body)
    body = _FALSE_ARC_GAP.sub("", body)
    body = re.sub(r"^[a-z]", lambda m: m.group(0).upper(), body.strip(), count=1) if body.strip() else body
    if allow_broad:
        body = re.sub(r"\n{3,}", "\n\n", body).strip()
        if footer:
            return body + "\n\n" + footer
        return body
    if not is_who_is_question(question) and (
        _CAST_CARD_HEADER.search(body) or "**Role" in body or "**Key Ties" in body
    ):
        lines = [ln.strip() for ln in body.splitlines() if ln.strip()]
        kept: list[str] = []
        terms = _question_terms(question)
        for ln in lines:
            if _CAST_CARD_HEADER.match(ln) or ln.startswith("**"):
                continue
            if terms and any(t in ln.lower() for t in terms):
                kept.insert(0, ln)
            elif kept:
                kept.append(ln)
        if kept:
            body = " ".join(kept[:4])
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    if footer:
        return body + "\n\n" + footer
    return body


def focus_ask_response(
    question: str, result: dict[str, Any], *, spot_check: bool = False
) -> dict[str, Any]:
    if not result or not result.get("ok", True):
        return result
    answer = str(result.get("answer") or "")
    if not answer:
        return result
    if spot_check:
        out = dict(result)
        if is_awareness_question(question) or str(result.get("askIntent") or "") == "narrow_fact":
            answer = scrub_rag_artifacts(question, answer, allow_broad=False)
            if not is_awareness_question(question):
                answer = apply_length_policy(
                    question,
                    answer,
                    question_kind=str(result.get("questionKind") or "knowledge"),
                    allow_broad=False,
                )
            out["answer"] = answer
        sources = result.get("sources")
        if isinstance(sources, list):
            out["sources"] = filter_sources_for_answer(sources, answer, question)
        return out
    kind = str(result.get("questionKind") or "fallback")
    allow_broad = wants_broad_answer(question, question_kind=kind)
    if result.get("askIntent") in ("character_portrait", "summarize_story", "story_resume"):
        allow_broad = True
    # Compare/tag lists must stay intact — never trim bullets as off-topic.
    if kind in ("notes_not_in_draft", "planned_gaps", "flagged_fix"):
        allow_broad = True
        out = dict(result)
        sources = result.get("sources")
        if isinstance(sources, list):
            out["sources"] = filter_sources_for_answer(sources, answer, question)
        return out
    # Kinship stays narrow; story-arc relationship (pre/post dynamics) needs room.
    if kind == "relationship" or result.get("askIntent") == "relationship":
        from lorekeeper_relations import is_story_arc_relationship_question

        allow_broad = is_story_arc_relationship_question(question)
    if kind == "resume":
        allow_broad = True
    answer = focus_topic_gather_answer(question, answer, allow_broad=allow_broad)
    answer = scrub_rag_artifacts(question, answer, allow_broad=allow_broad)
    answer = trim_off_topic_sentences(question, answer, allow_broad=allow_broad)
    answer = apply_length_policy(
        question, answer, question_kind=kind, allow_broad=allow_broad
    )
    sources = result.get("sources")
    if isinstance(sources, list):
        sources = filter_sources_for_answer(sources, answer, question)
    out = dict(result)
    out["answer"] = answer
    if sources is not None:
        out["sources"] = sources
    return out
