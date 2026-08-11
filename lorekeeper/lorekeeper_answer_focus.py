"""LoreKeeper — focused Ask answers (#41–47): facet, length, trim, sources."""
from __future__ import annotations

import re
from typing import Any, Literal

from lorekeeper_character_compose import (
    _is_plot_arc_clause,
    is_audit_question,
    is_coverage_question,
    is_formal_awareness_status_clause,
    is_incomplete_cast_clause,
    is_knower_pov_about_label,
    is_other_character_scene_beat,
    is_overview_significance_clause,
    is_plot_walkthrough_text,
    is_rename_infodump_clause,
    is_who_is_cast_fact_sentence,
    smooth_who_is_prose,
    who_is_answer_has_bloat,
    who_is_answer_has_upheaval_reason,
)
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
# "X is a/an … species" claims — used to drop invented hybrids vs sources.
_IDENTITY_CLAIM = re.compile(
    r"\b([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,3})\s+"
    r"(?:is|was|are|were)\s+(?:a|an)\s+"
    r"((?:[\w'-]+\s+){0,4}"
    r"(?:lynx|rabbit|wolf|fox|cat|dog|bear|eagle|hawk|owl|raven|crow|"
    r"mouse|rat|deer|bird|feline|canine|sentinel|creature|beast)s?)\b",
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
            r"\b("
            r"protagonist|antagonist|married|brother|sister|role|guardian|"
            r"mother|father|cousin|quarry|baron|lord|lady|duke|duchess|"
            r"faeble|fairy[- ]?tale|conceal(?:s|ed|ing)?|known as|young woman|young man|"
            r"parent stock|kinship|subject of|rivalry-care|both care|"
            r"cold on the surface|fascination|disgusted|mixed parentage|"
            r"from another realm|does not grudge|among the few|"
            r"refuses to associate|larger politics|underestimates|"
            r"political influence|does not realize|"
            r"cold shoulder|heavier load|outsider|"
            r"political nuance|unspoken line|not yet fully aware|rediscovery"
            r")\b",
            low,
        ):
            kept.append(s)
            continue
    if not kept:
        return answer
    if len(kept) >= len([x for x in sentences if x.strip()]):
        return answer
    rebuilt = title_line + ("\n\n" if title_line else "") + " ".join(
        kept[:6] if is_who_is_question(question) else kept[:3]
    )
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
    # "… exception and." — period glued onto an unfinished conjunction.
    if re.search(r"\b(and|or|but|with|of|to|for|as)\s*\.\s*$", t, re.I):
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
    # Whole answer was an unfinished scrap — drop it rather than return "X is … and."
    return ""


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


def _trim_who_is_preserving_stakes(body: str, max_chars: int, label: str) -> str:
    """
    Who-is cast cards: when over budget, drop lower-priority sentences first.
    Keep role, kin, and upheaval type/reason ahead of long extras.
    """
    body = (body or "").strip()
    if len(body) <= max_chars:
        return drop_trailing_unfinished_clause(body)
    parts = [
        re.sub(r"\s+", " ", p.strip())
        for p in re.split(r"(?<=[.!?])\s+", body)
        if p.strip()
    ]
    if not parts:
        return _trim_to_complete_sentences(body, max_chars)

    def _priority(s: str) -> tuple[int, int]:
        low = s.lower()
        if re.match(rf"^{re.escape(label)}\s+(?:is|was)\b", s, re.I) and re.search(
            r"\b(protagonist|antagonist|white rabbit|rabbit|wolf)\b", low
        ):
            return (0, len(s))
        if is_overview_significance_clause(s, label) and who_is_answer_has_upheaval_reason(
            s
        ):
            return (1, len(s))
        if is_overview_significance_clause(s, label):
            return (2, len(s))
        if re.search(
            r"\b(brother|sister|son of|daughter of|father|mother|parent|"
            r"up against|rival|nemesis|opposed)\b",
            low,
        ):
            return (3, len(s))
        if is_rename_infodump_clause(s, label):
            return (6, -len(s))
        if re.search(r"\b(known as|known by|known to|chroniker|birth name)\b", low):
            return (4, len(s))
        return (5, -len(s))

    ranked = sorted(enumerate(parts), key=lambda it: (_priority(it[1]), it[0]))
    keep_idx: set[int] = set()
    total = 0
    for idx, sentence in ranked:
        add = len(sentence) + (1 if keep_idx else 0)
        if keep_idx and total + add > max_chars:
            # Always try to keep at least one upheaval-reason line if present.
            if _priority(sentence)[0] <= 1 and not any(
                _priority(parts[i])[0] <= 1 for i in keep_idx
            ):
                # Drop a lowest-priority kept sentence to make room.
                victims = sorted(
                    keep_idx, key=lambda i: (-_priority(parts[i])[0], -len(parts[i]))
                )
                if victims:
                    drop_i = victims[0]
                    total -= len(parts[drop_i]) + (1 if len(keep_idx) > 1 else 0)
                    keep_idx.discard(drop_i)
                    if total + add <= max_chars:
                        keep_idx.add(idx)
                        total += add
            continue
        keep_idx.add(idx)
        total += add
    if not keep_idx:
        return _trim_to_complete_sentences(body, max_chars)
    ordered = [parts[i] for i in sorted(keep_idx)]
    return drop_trailing_unfinished_clause(" ".join(ordered))


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
        "who": 1100,
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
    # Who-is: prefer upheaval reason / cast stakes over chopping the tail.
    if question_kind == "who" or is_who_is_question(question):
        labels = character_targets(question)
        label = labels[0] if labels else ""
        if label:
            trimmed = _trim_who_is_preserving_stakes(body, max_chars, label)
        else:
            trimmed = _trim_to_complete_sentences(body, max_chars)
    else:
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
    if is_who_is_question(question):
        body = scrub_who_is_plot_walkthrough(body, question=question)
        labels = character_targets(question)
        if labels:
            body = smooth_who_is_prose(labels[0], body)
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


def scrub_who_is_plot_walkthrough(body: str, *, question: str = "") -> str:
    """Hard keep-list: who-is answers may only keep cast-card fact sentences."""
    text = (body or "").strip()
    if not text:
        return text
    labels = character_targets(question) if question else []
    label = labels[0] if labels else ""
    # Drop the lone title line ("Etherei\n\n…") so it cannot glue onto the first fact.
    if label:
        text = re.sub(
            rf"^{re.escape(label)}\s*\n+",
            "",
            text,
            count=1,
            flags=re.I,
        ).strip()
    # Split by paragraphs first, then sentence ends / semicolons.
    sentences: list[str] = []
    for block in re.split(r"\n+", text):
        block = block.strip()
        if not block:
            continue
        if label and re.fullmatch(rf"{re.escape(label)}", block, re.I):
            continue
        parts = re.split(r"(?<=[.!?])\s+", block)
        sentences.extend(parts)
    kept: list[str] = []
    for sentence in sentences:
        s = re.sub(r"\s+", " ", sentence.strip().strip(";"))
        if not s:
            continue
        if is_incomplete_cast_clause(s, label):
            continue
        if label and is_knower_pov_about_label(s, label):
            continue
        if not label:
            if _is_plot_arc_clause(s) or who_is_answer_has_bloat(s):
                continue
            kept.append(s)
            continue
        if is_who_is_cast_fact_sentence(s, label):
            kept.append(s)
            continue
        # Librarian cast-card gaps / open parent sketches — keep on who-is.
        if re.match(
            r"^Your notes don't yet (?:spell out|pin a clear cast role)\b|"
            r"^Notes don't yet (?:spell out|pin a clear cast role)\b|"
            r"^Close relations for .+ aren't spelled out yet\.?$|"
            r"^A clear cast role for .+ isn't pinned yet\b|"
            r"^Your notes (?:sketch|say|leave)\b.+\b(?:father|mother)\b",
            s,
            re.I,
        ):
            kept.append(s)
            continue
        if label and re.match(
            rf"^(?:{re.escape(label)}'s|His|Her)\s+(?:father|mother)\s+is\b",
            s,
            re.I,
        ):
            kept.append(s)
            continue
        if re.match(r"^(?:He|She)\s+conceals\b", s, re.I):
            kept.append(s)
            continue
        if re.match(r"^(?:He|She)\s+is\s+(?:also\s+)?known\s+as\b", s, re.I):
            kept.append(s)
            continue
        if re.match(r"^(?:He|She)\s+leads\b", s, re.I):
            kept.append(s)
            continue
        if re.search(r"\b(?:his|her)\s+(?:second\s+)?cousin\b", s, re.I) and re.search(
            r"\b(?:may be|calls|kinship)\b", s, re.I
        ):
            kept.append(s)
            continue
        if re.search(r"\bis\s+(?:his|her)\s+quarry\b", s, re.I):
            kept.append(s)
            continue
        # Drop everything else — awareness, plot, background dumps.
    if not kept:
        # Fall back to first subject-led identity sentence if any.
        only_incomplete = True
        for sentence in sentences:
            s = re.sub(r"\s+", " ", sentence.strip().strip(";"))
            if not s:
                continue
            if is_incomplete_cast_clause(s, label):
                continue
            only_incomplete = False
            if label and re.match(rf"^{re.escape(label)}\s+(?:is|was)\b", s, re.I):
                if not who_is_answer_has_bloat(s) and len(s) < 280:
                    return s
        # Incomplete scraps only → clear; otherwise keep original for gap/inference paths.
        return "" if only_incomplete else text
    # Prefer identity + ties + overview stakes; cap so dumps cannot return through volume.
    if label:
        identityish: list[str] = []
        tiesish: list[str] = []
        stakesish: list[str] = []
        renameish: list[str] = []
        other: list[str] = []
        for s in kept:
            if is_rename_infodump_clause(s, label):
                renameish.append(s)
            elif is_overview_significance_clause(s, label) or is_formal_awareness_status_clause(
                s, label
            ):
                stakesish.append(s)
            elif re.search(
                r"\b(faeble|fairy[- ]?tale character|not entirely of this world|social rank)\b",
                s,
                re.I,
            ) and re.search(
                rf"\b{re.escape(label)}\b|"
                rf"^(?:Lord|Lady|Duke|Duchess|Baron|Baroness)\s+{re.escape(label)}\b",
                s,
                re.I,
            ):
                stakesish.append(s)
            # Essay-hook open: "In Work, Name is the main antagonist… with X as his quarry"
            # must stay identity — never drop into ties just because "quarry" appears.
            elif re.match(
                rf"^In\s+.{{1,80}}?,\s*{re.escape(label)}\s+is\b",
                s,
                re.I,
            ) and re.search(
                r"\b("
                r"protagonist|antagonist|villain|hero|baron|lord|lady|"
                r"cheshire cat|white rabbit|main character"
                r")\b",
                s,
                re.I,
            ):
                identityish.append(s)
            elif re.match(
                rf"^(?:{re.escape(label)}|He|She)\s+(?:is|was)\b",
                s,
                re.I,
            ) and re.search(
                r"\b("
                r"protagonist|antagonist|villain|hero|baron|lord|lady|"
                r"cheshire cat|white rabbit|from (?:alice in )?wonderland|"
                r"main character|side character|young woman|young man|author"
                r")\b",
                s,
                re.I,
            ):
                # Role / title / fairy-tale origin — identity, not a kin "tie".
                identityish.append(s)
            elif re.match(
                rf"^(?:{re.escape(label)}|He|She)\s+conceals\b",
                s,
                re.I,
            ) or (
                re.search(r"\bconceals?\b", s, re.I)
                and re.search(r"\b(human|author|identity|fae)\b", s, re.I)
            ):
                stakesish.append(s)
            elif re.search(
                r"\b(brother|sister|father|mother|parent|married|subject of|quarry|"
                r"known|rival|up against|nemesis|opposed|cousin|ally|allies|"
                r"co-?conspir|esteemed cousin|refers to|your notes treat|"
                r"don'?t yet spell out|don'?t yet pin a clear cast role|"
                r"Notes don't yet|rivalry-care|both care|"
                r"cold on the surface|fascination|disgusted|mixed parentage|"
                r"refuses to associate|larger politics|underestimates|"
                r"political influence|does not realize|"
                r"cold shoulder|heavier load|outsider|"
                r"father|mother|kinship is left open|kinship remains open|parent stock|hunts?\b)\b",
                s,
                re.I,
            ):
                tiesish.append(s)
            elif re.match(rf"^(?:{re.escape(label)}|He|She)\s+(?:is|was)\b", s, re.I):
                identityish.append(s)
            else:
                other.append(s)
        # Essay open / antagonist role first; never lead with parents.
        identityish.sort(
            key=lambda s: (
                0 if re.match(r"^In\s+", s, re.I) else 1,
                0
                if re.search(
                    r"\b(protagonist|antagonist|main antagonist|villain|"
                    r"cheshire cat|white rabbit|baron|rabbit|wolf|fox|lynx|arcanist)\b",
                    s,
                    re.I,
                )
                else 1,
                0 if re.search(r"\b(male|female|sentient)\b", s, re.I) else 1,
                len(s),
            )
        )
        # Essay voice: care / politics / cousin before parents (parents kept, not cut, but late).
        def _tie_rank(s: str) -> tuple[int, int]:
            low = (s or "").lower()
            if re.search(r"rivalry-care|both care|cold on the surface|heavier load", low):
                return (0, -len(s))
            if re.search(
                r"disgusted|refuses to associate|underestimates|"
                r"political influence|does not realize|fascination|mixed parentage|"
                r"cold shoulder",
                low,
            ):
                return (1, -len(s))
            if re.search(r"\b(?:first|second|third)\s+cousin\b", low):
                return (2, len(s))
            if re.search(r"\b(subject of|quarry|hunts?\b|nemesis)\b", low):
                return (3, len(s))
            if re.search(r"\bcousin\b", low):
                return (4, len(s))
            if re.search(r"\b(father|mother|parent stock|outsider)\b", low):
                return (5, len(s))
            return (6, len(s))

        tiesish.sort(key=_tie_rank)
        # Identity open → standing ties → faeble/stakes → scraps. Parents ride in ties (rank 5).
        ordered = identityish[:4] + tiesish[:8] + stakesish[:3] + other[:1] + renameish[:1]
        kept = ordered or kept[:5]
    else:
        kept = kept[:4]
    return " ".join(kept)


def scrub_unsupported_identity_claims(
    answer: str, sources: list[Any] | None
) -> str:
    """
    Drop 'Name is a Species' sentences when sources never place that name
    near that species — blocks invented hybrids (e.g. sentinel bird).
    """
    if not answer or not sources:
        return answer
    corpus_parts: list[str] = []
    for row in sources:
        if not isinstance(row, dict):
            continue
        corpus_parts.append(str(row.get("excerpt") or ""))
        corpus_parts.append(str(row.get("title") or ""))
        corpus_parts.append(str(row.get("body") or ""))
    corpus = " ".join(corpus_parts).lower()
    if len(corpus.strip()) < 20:
        return answer

    def _supported(name: str, species: str) -> bool:
        sp = species.split()[-1]
        for art in ("a", "an"):
            if (
                f"{name} is {art} {species}" in corpus
                or f"{name} was {art} {species}" in corpus
                or f"{name} is {art} {sp}" in corpus
                or f"{name} was {art} {sp}" in corpus
            ):
                return True
        for m in re.finditer(rf"\b{re.escape(name)}\b", corpus):
            window = corpus[max(0, m.start() - 40) : m.end() + 90]
            if re.search(rf"\b{re.escape(sp)}\b", window):
                return True
        return False

    body, footer = _split_footer(answer)
    sentences = re.split(r"(?<=[.!?])\s+", body)
    kept: list[str] = []
    for sentence in sentences:
        s = sentence.strip()
        if not s:
            continue
        # Heritage / parentage cast facts are not hybrid identity claims.
        if re.search(
            r"\b(?:his|her|their)\s+(?:father|mother)\s+is\b|"
            r"\bmixed parentage\b|"
            r"\bcold shoulder\b|"
            r"\bfrom another realm\b|"
            r"\boutsider\b",
            s,
            re.I,
        ):
            kept.append(s)
            continue
        m = _IDENTITY_CLAIM.search(s)
        if not m:
            kept.append(s)
            continue
        name = m.group(1).strip().lower()
        species = m.group(2).strip().lower()
        if name in {
            "father",
            "mother",
            "brother",
            "sister",
            "cousin",
            "son",
            "daughter",
            "parent",
            "parents",
            "husband",
            "wife",
            "spouse",
        }:
            kept.append(s)
            continue
        if _supported(name, species):
            kept.append(s)
    if not kept:
        return answer
    rebuilt = " ".join(kept)
    if footer:
        return rebuilt.rstrip() + "\n\n" + footer
    return rebuilt


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
    sources = result.get("sources")
    answer = focus_topic_gather_answer(question, answer, allow_broad=allow_broad)
    answer = scrub_rag_artifacts(question, answer, allow_broad=allow_broad)
    answer = scrub_unsupported_identity_claims(
        answer, sources if isinstance(sources, list) else None
    )
    answer = trim_off_topic_sentences(question, answer, allow_broad=allow_broad)
    answer = apply_length_policy(
        question, answer, question_kind=kind, allow_broad=allow_broad
    )
    if isinstance(sources, list):
        sources = filter_sources_for_answer(sources, answer, question)
    out = dict(result)
    out["answer"] = answer
    if sources is not None:
        out["sources"] = sources
    return out
