"""LoreKeeper — reference-voice character summaries (#12–13), local only."""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_cast_roles import (
    ROLE_TERMS_RE,
    merge_explicit_and_inferred,
)

_ROLE_WORDS_RE = ROLE_TERMS_RE

_INFERRED_ROLE = re.compile(
    r"\breads as the\b|\bstory keeps centering on them\b|\bappears as the viewpoint\b",
    re.I,
)

_META_IN_TIE = re.compile(
    r"\b(?:in your notes|mentioned in your|name not stated|not named)\b",
    re.I,
)

_UNCLEAR_SECTION_HEADING = "What isn't spelled out yet in your notes:"
_FOOTER_REFERENCE = "— From your notes only. Nothing invented."
_FOOTER_COVERAGE = "— Pulled from your notes only. Nothing invented."


def is_coverage_question(question: str) -> bool:
    q = question or ""
    if re.search(
        r"\b("
        r"what have i (?:done|written|saved)|what(?:'s| is) missing|"
        r"what do i have|what have i got|coverage|how much (?:have|do) i"
        r")\b",
        q,
        re.I,
    ):
        return True
    if re.search(
        r"\bwhat (?:have )?i (?:written|saved)\s+(?:on|about|for|regarding)\b",
        q,
        re.I,
    ):
        return True
    if re.search(
        r"\b("
        r"tell me everything|everything i (?:have )?(?:written|saved)|"
        r"all i (?:have )?(?:written|saved)|show me everything i"
        r")\b",
        q,
        re.I,
    ):
        return True
    return False


def is_audit_question(question: str) -> bool:
    """Writer asked about discrepancies, fixes, or planning — not identity."""
    q = (question or "").lower()
    return bool(
        re.search(
            r"(?:"
            r"\bdiscrepanc\w*|\binconsist\w*|\bcontradict\w*|"
            r"\bplot holes?\b|\bcanon conflicts?\b|"
            r"\bthings to fix\b|\bneed to fix\b|\bwhat(?:'s| is) wrong\b|"
            r"\bworried about\b|\bconcerned about\b|\bflagged\b|\bto do about\b"
            r")",
            q,
            re.I,
        )
    )


_PLOT_ARC_RE = re.compile(
    r"\b("
    r"by the events of|throughout the series|as the story progresses|"
    r"caught between|emotional and narrative|narrative center|"
    r"forms the (?:heart|center|core)|journey through|arc of|"
    r"becomes caught|story follows|what they go through|"
    r"life story|backstory unfolds|over the course of"
    r")\b",
    re.I,
)


def _is_plot_arc_clause(clause: str) -> bool:
    s = (clause or "").strip()
    if not s:
        return False
    if _PLOT_ARC_RE.search(s):
        return True
    if re.search(r"\bby the (?:end|close|events)\b", s, re.I):
        return True
    return False


def work_title_from_hints(hints: set[str]) -> str | None:
    if not hints:
        return None
    return next(iter(sorted(hints, key=len, reverse=True))).strip().title()


def _dedupe_key(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())[:140]


def _dedupe_clauses(clauses: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for clause in clauses:
        key = _dedupe_key(clause)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(clause.strip())
    return out


def _ensure_period(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return ""
    if t.endswith(("…", "...", ".", "!", "?")):
        return t
    return t + "."


def _strip_meta_from_line(line: str) -> str:
    line = re.sub(r"^\(Entry titled .+\)\s*", "", line or "", flags=re.I)
    return line.strip()


def _tie_to_reference(label: str, tie: str) -> str:
    tie = _strip_meta_from_line(tie)
    if not tie:
        return ""
    if _META_IN_TIE.search(tie):
        return tie
    m = re.match(r"^(Brother|Sister|Mother|Father|Son|Daughter|Child)\s+to\s+(.+?)\.?\s*$", tie, re.I)
    if m:
        rel, other = m.group(1).lower(), m.group(2).split("(")[0].strip().rstrip(".")
        if rel == "brother":
            return f"{label} is brother to {other}."
        if rel == "sister":
            return f"{label} is sister to {other}."
        return f"{label} is {rel} to {other}."
    if tie.lower().startswith(label.lower()):
        return _ensure_period(tie)
    if re.match(rf"^{re.escape(label)}\s", tie, re.I):
        return _ensure_period(tie)
    return _ensure_period(tie)


def _to_reference_clause(sentence: str, label: str) -> str:
    s = _strip_meta_from_line(sentence)
    if not s:
        return ""
    s = re.sub(rf"^{re.escape(label)}\s*[—–\-:,]\s*", "", s, flags=re.I)
    married = re.match(r"^Married to\s+(.+?)\.?\s*$", s, re.I)
    if married:
        return f"{label} is married to {married.group(1).rstrip('.')}."
    if re.match(rf"^{re.escape(label)}\s", s, re.I):
        return _ensure_period(s)
    if re.match(r"^(He|She|They)\b", s, re.I):
        s = re.sub(r"^(He|She|They)\b", label, s, count=1)
        return _ensure_period(s)
    if not re.search(r"\b(is|was|are|were)\b", s, re.I) and re.match(
        r"^[A-Za-z\-]+(?:\s+[a-z\-]+){0,4}\.?$", s
    ):
        return f"{label} is {s.rstrip('.')}."
    if _ROLE_WORDS_RE.search(s) or re.search(
        rf"\b{re.escape(label)}\s+(?:is|was|are|were)\b", s, re.I
    ):
        return _ensure_period(s)
    if re.search(r"\b(married|brother|sister|son|daughter|grey|skin|arcanist)\b", s, re.I):
        if re.search(r"\b(married|engaged)\b", s, re.I):
            m2 = re.search(r"\b(?:married|engaged)\s+to\s+(.+?)\.?\s*$", s, re.I)
            if m2:
                return f"{label} is married to {m2.group(1).rstrip('.')}."
        return f"{label} — {s.rstrip('.')}."
    return _ensure_period(s)


def _prefer_explicit_over_inferred(explicit: list[str], inferred: str | None) -> list[str]:
    return merge_explicit_and_inferred(explicit, inferred, label="")


def _join_paragraph(clauses: list[str], max_clauses: int = 6) -> str:
    picked = _dedupe_clauses(clauses)[:max_clauses]
    if not picked:
        return ""
    text = " ".join(picked)
    if not text.endswith((".", "!", "?", "…")):
        text += "."
    return text


_PROFILE_CLAUSE_RE = re.compile(
    r"\b("
    r"is|was|are|were|married|engaged|brother|sister|mother|father|son|daughter|"
    r"protagonist|antagonist|main character|viewpoint|point of view|pov|narrator|"
    r"guardian|spirit|villain|hero|grey|gray|skin|tall|short|arcanist|elf|wolf|"
    r"male|female|going after|hunts?|hunting|"
    r"husband|wife|spouse|cousin|species|looks like|known as|called"
    r")\b",
    re.I,
)

_NARRATIVE_OPENERS = re.compile(
    r"^(Opening|Closing|Then|When|After|Before|Suddenly|Meanwhile|Later|Finally|"
    r"As\s|While\s|The\s+(?:door|sun|wind|night|morning|room|hall|gate))\b",
    re.I,
)

_AUTHOR_META_RE = re.compile(
    r"\b("
    r"i think|i thought|could start|should start|same time as the|chapter\s+\d+|"
    r"plot note|planning note|outline|note to self|maybe|perhaps|"
    r"find more ways|ways to mention|need to mention|todo|fix later"
    r")\b",
    re.I,
)

_BIOGRAPHY_RE = re.compile(
    r"\b(?:is|was|were)\s+(?:born|raised|growing up|lived|fled|escaped|sent|brought|"
    r"created|written|introduced|first seen|only)\b",
    re.I,
)


def _clause_adds_profile(clause: str, label: str) -> bool:
    s = (clause or "").strip()
    if not s or _skip_planning_line(s, label):
        return False
    if _is_plot_arc_clause(s):
        return False
    if _BIOGRAPHY_RE.search(s):
        return False
    if re.search(r"&(?:nbsp|#160;)|\u00a0", s, re.I):
        return False
    if len(s) > 220 and not re.search(rf"\b{re.escape(label)}\b", s, re.I):
        return False
    if _NARRATIVE_OPENERS.search(s) and not re.search(rf"\b{re.escape(label)}\b", s, re.I):
        return False
    if re.search(rf"\b{re.escape(label)}\s+(?:is|was|are|were)\b", s, re.I):
        return True
    if re.search(rf"\b{re.escape(label)}\s*[—–\-:,]", s, re.I):
        return True
    if _ROLE_WORDS_RE.search(s):
        return True
    if re.search(r"\b(main character|viewpoint character|protagonist|antagonist)\b", s, re.I):
        return True
    if re.search(
        r"\b(married|engaged|brother|sister|mother|father|son|daughter|guardian|spirit|"
        r"husband|wife|spouse|cousin|grey|gray|arcanist|elf|villain|hero|species)\b",
        s,
        re.I,
    ):
        return True
    if _DIALOGUE_VERB.search(s):
        return bool(
            re.search(
                r"\b(brother|sister|mother|father|married|wife|husband|cousin)\b",
                s,
                re.I,
            )
        )
    return False


_DIALOGUE_VERB = re.compile(
    r"\b(said|says|asked|asks|replied|replies|whispered|shouted|muttered|murmured)\b",
    re.I,
)


def _skip_planning_line(line: str, label: str) -> bool:
    s = (line or "").strip()
    if not s:
        return True
    if _AUTHOR_META_RE.search(s):
        return True
    if re.match(r"^I\s+(think|thought|feel|want|should|could|might|need)\b", s, re.I):
        return True
    if re.search(
        r"\b("
        r"find more ways|need to mention|ways to mention|remember(?:s|ed)? this if|"
        r"todo|fix later|rewrite|outline|note to self"
        r")\b",
        s,
        re.I,
    ):
        return True
    if re.search(r"\bchapter\s+\d+\b", s, re.I) and not re.search(
        rf"\b{re.escape(label)}\b", s, re.I
    ):
        return True
    return False


def _composed_has_substance(paragraphs: list[str], label: str) -> bool:
    body = " ".join(paragraphs)
    if not body.strip():
        return False
    if _ROLE_WORDS_RE.search(body):
        return True
    if re.search(r"\bmain character\b", body, re.I):
        return True
    if re.search(rf"\b{re.escape(label)}\s+(?:is|was)\b", body, re.I):
        return True
    if re.search(
        r"\b(married|brother|sister|son|daughter|guardian|spirit|protagonist|antagonist|"
        r"grey|gray|arcanist|elf|villain|hero)\b",
        body,
        re.I,
    ):
        return True
    if _AUTHOR_META_RE.search(body):
        return False
    if re.search(r"\b(also known as|known to|knows .+ as)\b", body, re.I):
        return True
    return False


def compose_character_reference(
    label: str,
    *,
    brief: dict[str, Any] | None,
    roles: list[str],
    identity: list[str],
    relationships: list[str],
    details: list[str],
    dialogue: list[str],
    scenes: list[str],
    work_title: str | None = None,
    stated_relationships: list[str] | None = None,
    alias_lines: list[str] | None = None,
    facet: str | None = None,
) -> str:
    """Wikipedia-shaped, reference voice — facts about the character, not meta coach copy."""
    brief = brief or {}
    lead: list[str] = []
    rel_clauses: list[str] = []

    explicit_roles = [
        _to_reference_clause(r, label)
        for r in roles
        if not _skip_planning_line(r, label)
        if _ROLE_WORDS_RE.search(r) or re.search(rf"\b{re.escape(label)}\s+is\b", r, re.I)
    ]
    explicit_roles = [r for r in explicit_roles if r]

    role_lines = _prefer_explicit_over_inferred(explicit_roles, brief.get("role"))
    lead.extend(c for c in role_lines if _clause_adds_profile(c, label))

    for line in alias_lines or []:
        clause = _ensure_period((line or "").strip())
        if clause and clause not in lead:
            lead.append(clause)

    # Species / gender traits early — before identity can fill the clause cap.
    for trait in brief.get("traits") or []:
        t = str(trait).strip()
        if re.match(r"^An\s+", t, re.I):
            clause = _ensure_period(f"{label} is {t[3:].lstrip()}")
        elif re.match(r"^A\s+", t, re.I):
            clause = _ensure_period(f"{label} is {t[2:].lstrip()}")
        elif re.match(rf"^{re.escape(label)}\s+is\s+", t, re.I):
            clause = _ensure_period(t)
        else:
            clause = _to_reference_clause(t, label) or _ensure_period(t)
        if clause and clause not in lead and _clause_adds_profile(clause, label):
            lead.append(clause)

    for line in identity:
        if _skip_planning_line(line, label):
            continue
        clause = _to_reference_clause(line, label)
        if clause and clause not in lead and _clause_adds_profile(clause, label):
            lead.append(clause)

    for line in relationships:
        if _skip_planning_line(line, label):
            continue
        clause = _to_reference_clause(line, label)
        if clause and _clause_adds_profile(clause, label):
            rel_clauses.append(clause)

    for tie in brief.get("ties") or []:
        clause = _tie_to_reference(label, str(tie))
        if clause:
            rel_clauses.append(clause)

    for line in details:
        if _skip_planning_line(line, label):
            continue
        clause = _to_reference_clause(line, label)
        if not clause:
            continue
        if facet == "appearance":
            if clause not in lead and clause not in rel_clauses:
                lead.append(clause)
            continue
        if not _clause_adds_profile(clause, label):
            continue
        if clause not in lead and clause not in rel_clauses:
            if re.search(
                r"\b(married|spouse|brother|sister|son|daughter|species|skin|tall|short|arcanist|wizard|elf)\b",
                clause,
                re.I,
            ):
                rel_clauses.append(clause)
            else:
                lead.append(clause)

    if facet == "appearance":
        for line in scenes[:4]:
            if _skip_planning_line(line, label):
                continue
            clause = _to_reference_clause(line, label) or _ensure_period((line or "").strip())
            if clause and clause not in lead and clause not in rel_clauses:
                lead.append(clause)

    for line in stated_relationships or []:
        clause = _to_reference_clause(line, label)
        if clause and clause not in rel_clauses and _clause_adds_profile(clause, label):
            rel_clauses.append(clause)

    for line in dialogue[:2]:
        if _skip_planning_line(line, label):
            continue
        clause = _to_reference_clause(line, label)
        if clause and _clause_adds_profile(clause, label):
            rel_clauses.append(clause)

    if work_title and lead and not any(work_title.lower() in c.lower() for c in lead):
        if role_lines and _ROLE_WORDS_RE.search(role_lines[0]):
            if not re.search(rf"\bin\s+{re.escape(work_title)}\b", lead[0], re.I):
                lead[0] = lead[0].rstrip(".") + f" in {work_title}."

    paragraphs: list[str] = []
    if facet == "appearance":
        clause_cap = 4
    elif facet in ("role", "voice", "relationship"):
        clause_cap = 1
    else:
        clause_cap = 5
    p1 = _join_paragraph(lead, max_clauses=clause_cap)
    if p1:
        paragraphs.append(p1)
    p2 = _join_paragraph(rel_clauses, max_clauses=clause_cap if facet == "relationship" else 3)
    if p2:
        paragraphs.append(p2)

    if not paragraphs:
        return ""
    if not _composed_has_substance(paragraphs, label):
        return ""

    body = "\n\n".join(paragraphs)
    return f"{label}\n\n{body}\n\n{_FOOTER_REFERENCE}"


def character_unclear_body(
    label: str,
    *,
    mention_places: int,
    dialogue_only: bool,
    scene_only: bool,
    work_title: str | None = None,
    coverage: bool = False,
    has_clear_facts: bool = False,
) -> str:
    """Bottom paragraph: honest gaps — sources only, no invented missing detail."""
    where = f" in {work_title}" if work_title else ""
    parts: list[str] = []

    if has_clear_facts:
        if dialogue_only and scene_only:
            parts.append(
                "Mostly scenes and dialogue in your notes — not a full character sketch beyond the facts above."
            )
        elif scene_only:
            parts.append(
                "Mostly scene beats in your notes — not who they are in the story beyond the facts above."
            )
        elif dialogue_only:
            parts.append(
                "Mostly dialogue lines in your notes — not a character sketch beyond the facts above."
            )
        elif mention_places > 0:
            parts.append(
                "Role, family ties, motives, or look beyond the facts above aren't spelled out yet in your notes."
            )
        else:
            return ""
    elif mention_places > 0:
        place_word = "place" if mention_places == 1 else "places"
        if coverage:
            parts.append(
                f"You mention {label} in your draft ({mention_places} {place_word}), "
                "but you haven't fleshed them out yet — no clear role or family ties in your notes."
            )
        else:
            parts.append(
                f"{label} appears{where} in {mention_places} saved {place_word}, but little is "
                "spelled out yet about their role, ties, or look beyond what shows up in scenes."
            )
    else:
        if coverage:
            parts.append(f"I couldn't find anything about {label} in your saved notes for this work.")
        else:
            parts.append(f"Nothing saved yet{where} that describes {label}.")

    if not has_clear_facts:
        if dialogue_only and scene_only:
            parts.append("What exists is mostly scenes and dialogue — not a full character sketch.")
        elif scene_only:
            parts.append("What exists is mostly scene beats rather than a character sketch.")
        elif dialogue_only:
            parts.append("What exists is mostly dialogue lines rather than a character sketch.")

    if coverage and not has_clear_facts:
        parts.append(
            "That's a gap you might want to fill — a short character note on who they are, "
            "what they want, and how they connect to the rest of the cast."
        )

    return "\n\n".join(parts)


def append_unclear_section(
    answer: str,
    unclear_body: str,
    *,
    footer: str = _FOOTER_REFERENCE,
) -> str:
    body = (unclear_body or "").strip()
    if not body:
        return answer
    marker = footer
    idx = answer.find(marker)
    insert = f"\n\n{_UNCLEAR_SECTION_HEADING}\n\n{body}\n\n"
    if idx >= 0:
        return answer[:idx].rstrip() + insert + answer[idx:]
    return answer.rstrip() + insert + marker


def format_two_part_character_answer(
    label: str,
    clear_body: str,
    unclear_body: str,
    *,
    coverage: bool = False,
) -> str:
    footer = _FOOTER_COVERAGE if coverage else _FOOTER_REFERENCE
    lines = [label, ""]
    clear = (clear_body or "").strip()
    unclear = (unclear_body or "").strip()
    if clear:
        lines.append(clear)
    if unclear:
        if clear:
            lines.append("")
        lines.append(_UNCLEAR_SECTION_HEADING)
        lines.append("")
        lines.append(unclear)
    lines.append("")
    lines.append(footer)
    return "\n".join(lines)


def compose_character_gap_reference(
    label: str,
    *,
    mention_places: int,
    dialogue_only: bool,
    scene_only: bool,
    work_title: str | None = None,
) -> str:
    """Reference voice for thin material on a who-is question (not coverage/meta)."""
    unclear = character_unclear_body(
        label,
        mention_places=mention_places,
        dialogue_only=dialogue_only,
        scene_only=scene_only,
        work_title=work_title,
        coverage=False,
        has_clear_facts=False,
    )
    return format_two_part_character_answer(label, "", unclear)


def cast_answer_is_thin(answer: str, label: str) -> bool:
    """True when a who-is answer lacks real cast role/status (gap or stub)."""
    a = (answer or "").strip()
    if not a:
        return True
    low = a.lower()
    # Species/role scrap leaks — never treat as a finished cast card.
    if re.search(
        rf"\b{re.escape(label.lower())}\s+is\s+(?:side|of|one)\s*\.?\s*(?:$|\n)",
        low,
    ):
        return True
    if re.search(r"\bmale\s+or\s+female\b|\bfemale\s+or\s+male\b", low):
        return True
    if _UNCLEAR_SECTION_HEADING in a:
        before = a.split(_UNCLEAR_SECTION_HEADING, 1)[0]
        chunks = [p.strip() for p in before.split("\n\n") if p.strip()]
        body_chunks = [c for c in chunks if c != label and not c.startswith("—")]
        if body_chunks and len(" ".join(body_chunks)) > 45:
            if is_composed_reference_answer(a):
                return _composed_only_weak_pov(label, "\n\n".join(body_chunks))
            low_body = " ".join(body_chunks).lower()
            if re.search(
                r"\b(protagonist|antagonist|villain|hero|married|brother|sister|queen|king|"
                r"guardian|viewpoint|main character|arcanist|also known as|known to|knows .+ as)\b",
                low_body,
            ):
                return False
    if "little is spelled out yet" in low or "but little is" in low:
        return True
    if "nothing saved yet" in low and "describes" in low:
        return True
    if "too scattered to summarize" in low:
        return True
    if is_composed_reference_answer(a):
        core = a.split(_UNCLEAR_SECTION_HEADING, 1)[0]
        core = re.split(r"\n\n— From your notes only", core, maxsplit=1)[0]
        parts = [p.strip() for p in core.split("\n\n") if p.strip()]
        body_parts = [p for p in parts if p != label and not p.startswith("—")]
        if _composed_only_weak_pov(label, "\n\n".join(body_parts)):
            return True
        return False
    if re.search(
        r"\b(protagonist|antagonist|villain|hero|married|brother|sister|queen|king|"
        r"guardian|viewpoint|main character|arcanist|also known as|known to|knows .+ as)\b",
        low,
    ):
        return False
    label_low = label.lower()
    if label_low in low and re.search(rf"\b{re.escape(label_low)}\s+is\b", low):
        main = next(
            (p for p in a.split("\n\n") if p.strip() and not p.strip().startswith("—")),
            a,
        )
        if len(main.strip()) > 45:
            return False
    return True


def _composed_only_weak_pov(label: str, body: str) -> bool:
    """True when the card is only inferred viewpoint/main — prefer RAG."""
    text = re.sub(r"\s+", " ", (body or "").strip())
    if not text:
        return True
    return bool(
        re.fullmatch(
            rf"{re.escape(label)}\s+is the (?:viewpoint character|main character)"
            rf"(?:\s+in [^.]{{1,80}})?\.?",
            text,
            re.I,
        )
    )


def is_composed_reference_answer(answer: str) -> bool:
    """True when #12–13 reference-voice composition succeeded (not bullet scrap fallback)."""
    a = (answer or "").strip()
    if re.search(r"&(?:nbsp|#\d+;|[a-z]+;)", a, re.I):
        return False
    if _FOOTER_REFERENCE not in a and "— From your notes only" not in a:
        return False
    if "From what you've written:" in a:
        return False
    if "too scattered to summarize cleanly yet" in a:
        return False
    if _UNCLEAR_SECTION_HEADING not in a and "little is spelled out yet" in a:
        return False
    if a.count("•") >= 2:
        return False
    if "— from what you've saved:" in a.lower():
        return False
    core = a.split(_UNCLEAR_SECTION_HEADING, 1)[0] if _UNCLEAR_SECTION_HEADING in a else a
    if "\n\n" not in core:
        return False
    parts = core.split("\n\n")
    label = parts[0].strip()
    body_parts = [p for p in parts[1:] if not p.strip().startswith("—")]
    if not label or not body_parts:
        return False
    if not _composed_has_substance(body_parts, label):
        return False
    body = " ".join(body_parts).strip()
    if _BIOGRAPHY_RE.search(body) and not _ROLE_WORDS_RE.search(body):
        return False
    if re.match(
        rf"^{re.escape(label)}\s+is the main character\.?\s*$",
        body,
        re.I,
    ):
        return False
    return True


def compose_audit_summary(label: str, contradictions: list[str]) -> str:
    """Meta voice for discrepancy / audit questions — never smooth disagreements (#16)."""
    lines = [f"{label} — discrepancies in your notes:\n"]
    if contradictions:
        for item in contradictions[:6]:
            text = str(item).strip().rstrip(".")
            if text:
                lines.append(f"• {text}.")
    else:
        lines.append("No clear contradictions surfaced from what you saved.")
    lines.append("\n— Pulled from your notes only. Nothing invented.")
    return "\n".join(lines)


DRAFT_VS_NOTES_DRAFT_LABEL = "This is what the main draft says:"
DRAFT_VS_NOTES_NOTES_LABEL = "This is what your notes say:"


def _strip_compose_footer(text: str) -> str:
    out = (text or "").strip()
    for footer in (_FOOTER_REFERENCE, _FOOTER_COVERAGE):
        if out.endswith(footer):
            out = out[: -len(footer)].rstrip()
    # Also strip common ending dash lines writers' answers use
    lines = out.splitlines()
    while lines and lines[-1].strip().startswith("—"):
        lines.pop()
    return "\n".join(lines).strip()


def compose_draft_vs_notes_dual(draft_body: str, notes_body: str) -> str:
    """Neutral dual blocks when main draft and notes disagree — draft first."""
    draft = _strip_compose_footer(draft_body)
    notes = _strip_compose_footer(notes_body)
    if not draft or not notes:
        return draft or notes or ""
    return "\n".join(
        [
            DRAFT_VS_NOTES_DRAFT_LABEL,
            "",
            draft,
            "",
            DRAFT_VS_NOTES_NOTES_LABEL,
            "",
            notes,
        ]
    )


def compose_coverage_summary(
    label: str,
    findings: list[str],
    *,
    mention_places: int,
    dialogue_only: bool = False,
    scene_only: bool = False,
) -> str:
    clear_lines: list[str] = []
    if findings:
        for item in findings[:12]:
            clear_lines.append(f"• {item}")
    elif mention_places > 0:
        place_word = "place" if mention_places == 1 else "places"
        clear_lines.append(
            f"You mention {label} in {mention_places} {place_word}, but nothing substantial yet."
        )
    clear = "\n".join(clear_lines)
    unclear = ""
    if dialogue_only or scene_only or not findings:
        unclear = character_unclear_body(
            label,
            mention_places=mention_places,
            dialogue_only=dialogue_only,
            scene_only=scene_only,
            coverage=True,
            has_clear_facts=bool(findings),
        )
    if unclear and clear:
        return append_unclear_section(
            f"{label} — from what you've saved:\n\n{clear}\n\n{_FOOTER_COVERAGE}",
            unclear,
            footer=_FOOTER_COVERAGE,
        )
    if unclear:
        return format_two_part_character_answer(label + " — from what you've saved", "", unclear, coverage=True)
    lines = [f"{label} — from what you've saved:\n"]
    if clear:
        lines.append(clear)
    else:
        lines.append(f"Nothing saved yet that describes {label}.")
    lines.append(f"\n{_FOOTER_COVERAGE}")
    return "\n".join(lines)


def compose_coverage_gap(
    label: str,
    mention_places: int,
    dialogue_only: bool,
    scene_only: bool = False,
) -> str:
    """Meta voice when the writer asked about coverage, not identity."""
    unclear = character_unclear_body(
        label,
        mention_places=mention_places,
        dialogue_only=dialogue_only,
        scene_only=scene_only,
        coverage=True,
        has_clear_facts=False,
    )
    return format_two_part_character_answer(
        f"{label} — from what you've saved",
        "",
        unclear,
        coverage=True,
    )
