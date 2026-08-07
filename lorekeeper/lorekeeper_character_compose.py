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
    from lorekeeper_notes_vs_draft import is_notes_not_in_draft_question

    if is_notes_not_in_draft_question(q):
        return False
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
        r"tell me everything|remind me of everything|"
        r"everything i (?:have )?(?:written|saved)|"
        r"all i (?:have )?(?:written|saved)|show me everything(?:\s+i)?"
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

# Story-role significance — ONLY explicit role stakes about the subject.
# Do NOT list world words (preyfolk/predator/sentient) alone — that let plot dumps pass.
_STORY_SIGNIFICANCE_RE = re.compile(
    r"\b("
    r"storywalks?|story[- ]walks?|storywalker|"
    r"sets? in motion|set in motion|"
    r"changes? (?:their|the|his|her) world(?:\s+forever)?"
    r")\b",
    re.I,
)

# Chronology / POV-order language — not cast-card identity.
# Keep this narrow: "the POV cuts" / look-on-face notes must NOT match.
_PLOT_SEQUENCE_RE = re.compile(
    r"\b("
    r"right after|soon after|just after|not long after|"
    r"next (?:POV|section|chapter|scene|beat)|"
    r"switches? to .{0,48}(?:POV|point of view)|"
    r"(?:his|her|their) next POV|"
    r"the next POV|"
    r"in (?:his|her|their) (?:first|second|third|opening|early) POV|"
    r"POV (?:shows?|is when|will be)|"
    r"section begins|"
    r"about to (?:slip|disappear|escape|vanish)|"
    r"looks? back with|"
    r"mouthed (?:an? )?(?:apology|words?)|"
    r"scene[- ]by[- ]scene|plot walkthrough|"
    r"what happens next|the next beat|"
    r"chasing them|stalking them|"
    r"lunge(?:s|d)? to (?:his|her|their) feet|"
    r"isn'?t surprised|wasn'?t surprised|badly injured"
    r")\b",
    re.I,
)

# Draft/awareness/plot bloat — never keep on who-is cast cards.
_WHO_IS_BLOAT_RE = re.compile(
    r"(?i)("
    r"\bnot long after\b|\bso right now\b|\bright now,?\s+"
    r"|\bis aware\b|\bare aware\b|\baware that\b|\breflects? on\b"
    r"|\bmentions? (?:his|her|their|the) theory\b|\btheory that\b"
    r"|\bbackground\s*:"
    r"|\btracking (?:them|him|her)\b|\bworks for\b"
    r"|\bno reason to realize\b|\bcould have killed\b|\bgot bit\b|\bfirst got\b"
    r"|\bspecifically\s*;"
    r"|\banother chance\b|\bout of shock\b"
    r"|\bdoesn'?t remember much\b|\bwould surprise his brothers\b"
    r"|\bmain victim\b|\bannoyance to\b"
    r"|\bis roused\b|\broused from\b|\bfurtively glancing\b"
    r"|\bforcibly groomed\b|\bcarrying (?:their|his|her)\b"
    r"|\bsoothed (?:the|his|her)\b|\bworris?ed for\b"
    r")"
)

# "X is <scene action…>" — not cast identity.
_SCENE_AFTER_IS_RE = re.compile(
    r"\b(?:is|was|are|were)\s+(?:roused|worried|glancing|carrying|groomed|soothed|"
    r"tracking|thinking|reflecting|sitting|standing|looking|walking|running|"
    r"watching|turning|reaching|holding|pulling|pushing|approaching|"
    r"startled|surprised|relieved|afraid|frightened)\b",
    re.I,
)

_CAST_CARD_ANCHOR_RE = re.compile(
    r"\b("
    r"protagonist|antagonist|villain|hero|heroine|married|brother|sister|"
    r"queen|king|guardian|viewpoint|main character|side character|"
    r"arcanist|species|rabbit|wolf|fox|lynx|also known as|"
    r"known to|knows .+ as|younger brother|older brother|"
    r"subject of|quarry|sentient|male|female|"
    r"storywalks?|sets? in motion|father|mother|parent|son of|daughter of"
    r")\b",
    re.I,
)

_OTHER_CHAR_EVENT_RE = re.compile(
    r"\b("
    r"isn'?t surprised|wasn'?t surprised|surprised to (?:see|find|learn)|"
    r"sees? that|saw that|notices? that|noticed that|"
    r"finds? (?:that|him|her|them)|found (?:that|him|her|them)|"
    r"watches?|watched|badly injured|wounded|bleeding|"
    r"in (?:his|her|their) (?:first|second|third|opening|early) POV"
    r")\b",
    re.I,
)

_KINSHIP_RE = re.compile(
    r"\b("
    r"brother|sister|sibling|mother|father|parent|son|daughter|child|"
    r"married|spouse|wife|husband|cousin|younger brother|older brother|"
    r"subject of|quarry|known by|known as|also known as|aka\b"
    r")\b",
    re.I,
)


def _is_plot_arc_clause(clause: str) -> bool:
    s = (clause or "").strip()
    if not s:
        return False
    # Story-role significance is allowed on who-is — not the same as plot dump.
    if is_story_significance_clause(s):
        return False
    if _PLOT_ARC_RE.search(s):
        return True
    if _PLOT_SEQUENCE_RE.search(s):
        return True
    if re.search(r"\bby the (?:end|close|events)\b", s, re.I):
        return True
    return False


def is_story_significance_clause(clause: str, label: str = "") -> bool:
    """True for subject-led role stakes (storywalk / sets in motion), not world-word hits."""
    s = (clause or "").strip()
    if not s or not _STORY_SIGNIFICANCE_RE.search(s):
        return False
    if label and is_other_character_scene_beat(s, label):
        return False
    if _WHO_IS_BLOAT_RE.search(s):
        return False
    if _PLOT_SEQUENCE_RE.search(s):
        return False
    # Must be about the subject when a label is known.
    if label and not re.search(rf"\b{re.escape(label)}\b", s, re.I):
        return False
    if label and not (
        re.match(rf"^{re.escape(label)}\b", s, re.I)
        or re.search(rf"\b{re.escape(label)}\s+(?:is|was|storywalks?|sets?)\b", s, re.I)
    ):
        return False
    return True


def who_is_answer_has_bloat(text: str) -> bool:
    """True when a who-is answer mixes in awareness/plot/background dump."""
    t = (text or "").strip()
    if not t:
        return False
    if _WHO_IS_BLOAT_RE.search(t):
        return True
    # Many sentences + plot-sequence markers = dump even if anchors present.
    sentences = [s for s in re.split(r"(?<=[.!?])\s+|(?<=;)\s+", t) if s.strip()]
    if len(sentences) >= 4 and _PLOT_SEQUENCE_RE.search(t):
        return True
    if len(sentences) >= 5 and not _KINSHIP_RE.search(t):
        # Long identity dump without ties still counts as bloated walkthrough.
        plotish = sum(1 for s in sentences if _PLOT_SEQUENCE_RE.search(s) or _WHO_IS_BLOAT_RE.search(s))
        if plotish >= 2:
            return True
    return False


def is_plausible_cast_person_name(name: str) -> bool:
    """Reject English stopwords mistaken for cast names (Especially, Are, …)."""
    raw = (name or "").strip().rstrip(".")
    if not raw or len(raw) < 3:
        return False
    # Multi-word: each part must be plausible (allows "Character B").
    from lorekeeper_inference import _NAME_STOP, _VERB_STOP, _INTERJECTIONS

    parts = re.findall(r"[A-Za-z0-9']+", raw)
    if not parts:
        return False
    for part in parts:
        low = part.lower()
        if low in _NAME_STOP or low in _VERB_STOP or low in _INTERJECTIONS:
            return False
        if low in {
            "especially",
            "somewhat",
            "although",
            "considering",
            "rather",
            "ironically",
            "furtively",
            "approach",
            "beneath",
            "prone",
            "vigor",
            "latter",
            "former",
            "are",
            "is",
            "was",
            "were",
            "been",
            "being",
        }:
            return False
    # Prefer Capitalized / Character N — reject all-lowercase English scraps.
    if raw.islower():
        return False
    return True


def _kinship_shape_sentence(sentence: str, label: str) -> bool:
    """True for short kinship / standing / raised-by lines — not plot that mentions 'brother'."""
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    if not s or len(s) > 240:
        return False
    lab = re.escape(label)
    patterns = (
        rf"^{lab}\s+is\s+(?:(?:younger|older|twin)\s+)?(?:brother|sister|son|daughter)\s+to\s+.+$",
        rf"^{lab}\s+is\s+(?:married|engaged)\s+to\s+.+$",
        rf"^{lab}\s+is\s+(?:the\s+)?(?:subject|quarry)\s+of\s+.+$",
        rf"^{lab}\s+is\s+(?:son|daughter|child)\s+of\s+.+$",
        rf"^(?:(?:younger|older|twin)\s+)?(?:brother|sister)\s+to\s+.+$",
        rf"^married\s+to\s+.+$",
        rf"^{lab}\s*[—–\-:,]\s*(?:(?:younger|older|twin)\s+)?(?:brother|sister)\s+to\s+.+$",
        # Family facts in gold-tone cards
        rf"^{lab}\s+is\b.{{0,120}}\braised by\b.+$",
        rf"^{lab}\s+is\b.{{0,160}}\b(?:father died|widow mother|mother struggled)\b.+$",
    )
    return any(re.match(p, s, re.I) for p in patterns)


def _is_gold_tone_cast_sentence(sentence: str, label: str) -> bool:
    """
    Pinned good shape: role + identity type and/or family standing in one woven sentence.
    Example: protagonist + Preyfolk rabbit + raised by brothers / father died…
    """
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    if not s or not label:
        return False
    if not re.match(rf"^{re.escape(label)}\s+is\b", s, re.I):
        return False
    if len(s) > 360:
        return False
    if _WHO_IS_BLOAT_RE.search(s) or _SCENE_AFTER_IS_RE.search(s) or _PLOT_SEQUENCE_RE.search(s):
        return False
    has_role = bool(
        re.search(r"\b(protagonist|antagonist|main character|side character)\b", s, re.I)
    )
    has_type = bool(
        re.search(
            r"\b(rabbit|preyfolk|wolf|fox|lynx|arcanist|male|female|sentient|white rabbit)\b",
            s,
            re.I,
        )
    )
    has_family = bool(
        re.search(
            r"\b("
            r"brother|sister|father|mother|widow|raised by|parent|"
            r"subject of|quarry|known as|known by|also known"
            r")\b",
            s,
            re.I,
        )
    )
    return has_role and (has_type or has_family)


def _kinship_targets_plausible(sentence: str, label: str) -> bool:
    """Drop 'brother to Especially/Are' style scraps."""
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    m = re.search(
        r"\b(?:brother|sister|son|daughter|married|engaged|subject|quarry|child)\s+"
        r"(?:of|to)\s+(.+?)\.?$",
        s,
        re.I,
    )
    if not m:
        return True
    tail = m.group(1).strip()
    # "Character D's curiosity" / "Obsidian and Stygian"
    chunks = re.split(r"\s+and\s+|,\s*", tail)
    for chunk in chunks:
        chunk = chunk.strip()
        # Allow "X's curiosity" standing phrases.
        if re.search(r"'s\s+\w+$", chunk, re.I):
            head = chunk.split("'")[0].strip()
            if head and not is_plausible_cast_person_name(head):
                return False
            continue
        # Strip trailing role phrases.
        chunk = re.sub(r"\s*\(.*\)$", "", chunk).strip()
        if not chunk:
            continue
        if not is_plausible_cast_person_name(chunk.split()[0] if chunk else ""):
            # Multi-word names: check full chunk without trailing common nouns
            cleaned = re.sub(
                r"\b(curiosity|interest|attention|trust)\b.*$",
                "",
                chunk,
                flags=re.I,
            ).strip()
            if cleaned and is_plausible_cast_person_name(cleaned):
                continue
            if not is_plausible_cast_person_name(chunk):
                return False
    return True


def is_who_is_cast_fact_sentence(sentence: str, label: str) -> bool:
    """
    Keep-list for who-is: role, species/type identity, kinship/ties, aliases,
    optional subject-led story stakes — nothing else.
    """
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    label = (label or "").strip()
    if not s or not label:
        return False
    if len(s) > 360:
        return False
    if _WHO_IS_BLOAT_RE.search(s):
        return False
    if _SCENE_AFTER_IS_RE.search(s):
        return False
    if is_other_character_scene_beat(s, label):
        return False
    if _PLOT_SEQUENCE_RE.search(s):
        return False

    # Pinned gold-tone woven card (role + type/family in one sentence).
    if _is_gold_tone_cast_sentence(s, label):
        return True

    # Kinship / standing — short shapes only; validate name targets.
    if _kinship_shape_sentence(s, label):
        return _kinship_targets_plausible(s, label)

    if not re.search(rf"\b{re.escape(label)}\b", s, re.I):
        return False

    # Subject-led identity / role / species / gender / alias — NOT kinship-via-plot.
    if re.match(rf"^{re.escape(label)}\s+(?:is|was|are|were)\b", s, re.I):
        # Long "X is …" with scene/plot language is out even if "brother" appears.
        if len(s) > 160 and not re.search(
            r"\b(protagonist|antagonist|rabbit|wolf|known as|known by|also known)\b",
            s,
            re.I,
        ):
            return False
        if re.search(
            r"\b("
            r"protagonist|antagonist|villain|hero|heroine|main character|side character|"
            r"side antagonist|rabbit|wolf|fox|lynx|arcanist|male|female|sentient|"
            r"known|called|aka|white rabbit|from .+ wonderland|guardian|spirit"
            r")\b",
            s,
            re.I,
        ):
            return True
        if len(s) <= 120 and not _PLOT_ARC_RE.search(s):
            if re.fullmatch(
                rf"{re.escape(label)}\s+is\s+[\w'-]+\.?",
                s,
                re.I,
            ) and not re.search(
                r"\b("
                r"male|female|protagonist|antagonist|villain|hero|rabbit|wolf|fox|"
                r"lynx|arcanist|sentient|guardian|spirit|married"
                r")\b",
                s,
                re.I,
            ):
                return False
            return True
        return False

    # "Etherei — grey-skinned arcanist…" identity dash lines (not plot).
    if re.match(rf"^{re.escape(label)}\s*[—–\-:,]", s, re.I):
        if re.search(
            r"\b("
            r"arcanist|rabbit|wolf|guardian|spirit|protagonist|antagonist|"
            r"male|female|sentient|grey|gray|skin"
            r")\b",
            s,
            re.I,
        ):
            return len(s) < 200
        return False

    if re.search(
        rf"\b{re.escape(label)}\s+is\s+(?:known|also known|called)\b",
        s,
        re.I,
    ):
        return len(s) < 260
    if re.search(rf"\b{re.escape(label)}\s+is\s+known by\b", s, re.I):
        return len(s) < 260
    # Storywalk / world-change stakes are not who-is cast-card slots.
    return False


def is_other_character_scene_beat(sentence: str, label: str) -> bool:
    """
    True for another cast member's POV/event observation about the subject —
    not a who-is identity line ("Etherei is the protagonist").
    """
    s = (sentence or "").strip()
    label = (label or "").strip()
    if not s or not label:
        return False
    # Keep subject-led identity / status lines.
    if re.match(rf"^{re.escape(label)}\s+(?:is|was|are|were)\b", s, re.I):
        return False
    if re.match(rf"^{re.escape(label)}\s*[—–\-:,]", s, re.I):
        return False
    if not re.search(rf"\b{re.escape(label)}\b", s, re.I):
        return False
    # "Serias, in his first POV, … Etherei …"
    if re.search(
        r"\bin (?:his|her|their) (?:first|second|third|opening|early) POV\b",
        s,
        re.I,
    ):
        return True
    # Led by a different proper name, then an event/observation about the subject.
    m = re.match(
        r"^([A-Z][\w'-]+(?:\s+(?:of|[A-Z][\w'-]+)){0,2})\b",
        s,
    )
    if not m:
        return False
    other = m.group(1).strip()
    if other.lower() == label.lower():
        return False
    # Skip work titles / filler openers mistaken for names.
    if other.lower() in {
        "the",
        "in",
        "from",
        "what",
        "this",
        "that",
        "smoke",
        "ashford",
    }:
        return False
    return bool(_OTHER_CHAR_EVENT_RE.search(s))


def is_plot_walkthrough_text(text: str) -> bool:
    """True when text is mostly scene/POV chronology, not a cast card."""
    t = (text or "").strip()
    if not t:
        return False
    hits = len(_PLOT_SEQUENCE_RE.findall(t))
    if hits >= 2:
        return True
    if hits >= 1 and not _CAST_CARD_ANCHOR_RE.search(t):
        return True
    return False


def has_cast_card_anchors(text: str) -> bool:
    return bool(_CAST_CARD_ANCHOR_RE.search(text or ""))


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
        if not is_plausible_cast_person_name(other):
            return ""
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
    r"husband|wife|spouse|cousin|species|looks like|known as|called|"
    r"storywalks?|sets? in motion|younger brother|older brother"
    r")\b",
    re.I,
)

_NARRATIVE_OPENERS = re.compile(
    r"^(Opening|Closing|Then|When|After|Before|Suddenly|Meanwhile|Later|Finally|"
    r"So\s+right\s+after|As\s|While\s|"
    r"The\s+(?:door|sun|wind|night|morning|room|hall|gate))\b",
    re.I,
)

_AUTHOR_META_RE = re.compile(
    r"\b("
    r"i think|i thought|could start|should start|same time as the|chapter\s+\d+|"
    r"plot note|planning note|outline|note to self|maybe|perhaps|"
    r"find more ways|ways to mention|need to mention|todo|fix later|"
    r"next (?:POV|section)|POV will be|switches? to .{0,40}POV"
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
    if is_other_character_scene_beat(s, label):
        return False
    if _is_plot_arc_clause(s):
        return False
    # Who-is slots only — storywalk / "sets in motion" are not cast-card profile.
    if is_story_significance_clause(s, label):
        return False
    if _BIOGRAPHY_RE.search(s):
        # Allow pinned family facts (raised-by / parents) on a role-or-identity card.
        if label and (
            _is_gold_tone_cast_sentence(s, label)
            or (
                re.search(rf"^{re.escape(label)}\s+is\b", s, re.I)
                and re.search(
                    r"\b(raised by|father died|widow mother|widow mother)\b",
                    s,
                    re.I,
                )
                and len(s) <= 360
            )
        ):
            return True
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
        r"husband|wife|spouse|cousin|grey|gray|arcanist|elf|villain|hero|species|"
        r"subject of|quarry|raised by|rabbit|preyfolk)\b",
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
                r"\b(married|spouse|brother|sister|son|daughter|subject of|quarry)\b",
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

    # Who-is / cast reference: weave family slots into plain formal prose.
    if facet is None:
        woven = weave_who_is_gold_tone(label, work_title, lead, rel_clauses)
        if woven:
            body = smooth_who_is_prose(label, woven)
            return f"{label}\n\n{body}\n\n{_FOOTER_REFERENCE}"

    paragraphs: list[str] = []
    if facet == "appearance":
        clause_cap = 4
    elif facet in ("role", "voice", "relationship"):
        clause_cap = 1
    else:
        clause_cap = 7
    p1 = _join_paragraph(lead, max_clauses=clause_cap)
    if p1:
        paragraphs.append(p1)
    p2 = _join_paragraph(rel_clauses, max_clauses=clause_cap if facet == "relationship" else 5)
    if p2:
        paragraphs.append(p2)

    if not paragraphs:
        return ""
    if not _composed_has_substance(paragraphs, label):
        return ""

    body = "\n\n".join(paragraphs)
    body = smooth_who_is_prose(label, body)
    return f"{label}\n\n{body}\n\n{_FOOTER_REFERENCE}"


def who_is_has_family_slots(answer: str) -> bool:
    """True when answer includes brother/parent/raised-by/curiosity-standing facts."""
    return bool(
        re.search(
            r"\b("
            r"brother|sister|father|mother|widow|raised by|parent|"
            r"subject of|quarry"
            r")\b",
            answer or "",
            re.I,
        )
    )


def weave_who_is_gold_tone(
    label: str,
    work_title: str | None,
    lead: list[str],
    rel_clauses: list[str],
) -> str:
    """
    Merge role/identity + brother/parent/standing into plain formal cast prose.
    Returns empty string when there is not enough material.
    """
    lead = [c for c in _dedupe_clauses(lead) if c]
    rel = [c for c in _dedupe_clauses(rel_clauses) if c]
    if not lead and not rel:
        return ""

    def _gender_only(c: str) -> bool:
        return bool(
            re.match(
                rf"^{re.escape(label)}\s+is\s+(?:male|female)\.?$",
                c,
                re.I,
            )
        )

    brothers: list[str] = []
    seen_b: set[str] = set()
    other_family: list[str] = []
    extras_from_rel: list[str] = []

    def _brother_tail(c: str) -> str | None:
        for pat in (
            rf"^{re.escape(label)}\s+is\s+(?:(?:younger|older|twin)\s+)?brother to\s+(.+?)\.?$",
            rf"^{re.escape(label)}\s*[—–\-:,]\s*(?:(?:younger|older|twin)\s+)?brother to\s+(.+?)\.?$",
            rf"^(?:(?:younger|older|twin)\s+)?brother to\s+(.+?)\.?$",
        ):
            m = re.search(pat, c, re.I)
            if m:
                return m.group(1).strip()
        return None

    for c in list(lead) + list(rel):
        tail = _brother_tail(c)
        if tail:
            for part in re.split(r"\s+and\s+|,\s*", tail):
                name = part.strip().rstrip(".")
                if not name or not is_plausible_cast_person_name(name.split()[0]):
                    continue
                key = name.lower()
                if key in seen_b:
                    continue
                seen_b.add(key)
                brothers.append(name)
            continue
        if re.search(
            r"\b(sister|father|mother|widow|raised|parent|subject of|quarry|married|"
            r"son|daughter)\b",
            c,
            re.I,
        ) and not re.search(r"\b(protagonist|antagonist|main character)\b", c, re.I):
            # Keep standing/parent/spouse lines; gold role+raised stays in lead base.
            if c not in other_family and not _is_gold_tone_cast_sentence(c, label):
                # Normalize bare "Subject of X" standing lines.
                standing = c
                if re.match(r"^(?:subject|quarry)\s+of\b", c, re.I):
                    standing = f"{label} is the {c[0].lower()}{c[1:]}"
                    if not standing.endswith("."):
                        standing += "."
                other_family.append(standing)
            continue
        # Identity scraps that landed in rel (legacy routing) — keep as extras.
        if re.search(
            r"\b(rabbit|preyfolk|wolf|fox|lynx|arcanist|sentient|guardian|grey|gray|skin)\b",
            c,
            re.I,
        ):
            if c not in extras_from_rel:
                extras_from_rel.append(c)

    # Only weave when family/standing slots exist — otherwise keep normal join
    # so species/guardian lines are not dropped.
    if not brothers and not other_family:
        return ""

    # Prefer a role-bearing lead sentence; never start from bare gender.
    base = next(
        (
            c
            for c in lead
            if re.search(r"\b(protagonist|antagonist|main character)\b", c, re.I)
        ),
        None,
    )
    if not base:
        base = next(
            (
                c
                for c in lead
                if not _gender_only(c)
                and re.search(
                    r"\b(rabbit|preyfolk|wolf|fox|lynx|arcanist|guardian|sentient)\b",
                    c,
                    re.I,
                )
            ),
            None,
        )
    if not base:
        base = next((c for c in lead if not _gender_only(c)), lead[0] if lead else "")
    if not base:
        return ""

    # Attach work title if missing.
    if work_title and work_title.lower() not in base.lower():
        if re.search(r"\b(protagonist|antagonist|main character)\b", base, re.I):
            base = base.rstrip(".") + f" of {work_title}."

    # Fold remaining identity scraps (species, guardian, alias, gender).
    extras: list[str] = list(extras_from_rel)
    gender_bit = ""
    for c in lead:
        if c == base:
            continue
        if _gender_only(c):
            gender_bit = "male" if re.search(r"\bmale\b", c, re.I) else "female"
            continue
        if c in other_family:
            continue
        if re.search(
            rf"^{re.escape(label)}\s+is\s+(?:(?:younger|older|twin)\s+)?brother to\b",
            c,
            re.I,
        ):
            continue
        extras.append(c)

    # Weave gender into role line when present.
    if gender_bit and re.search(r"\b(protagonist|antagonist|main character)\b", base, re.I):
        if not re.search(rf"\b{gender_bit}\b", base, re.I):
            base = re.sub(
                rf"({re.escape(label)}\s+is\s+(?:the\s+)?)",
                rf"\1{gender_bit} ",
                base,
                count=1,
                flags=re.I,
            )

    # Attach short species appositive when base lacks it.
    for c in list(extras):
        if re.search(
            r"\b(rabbit|preyfolk|wolf|fox|lynx|arcanist|sentient|guardian)\b",
            c,
            re.I,
        ):
            frag = re.sub(
                rf"^{re.escape(label)}\s+is\s+",
                "",
                c,
                count=1,
                flags=re.I,
            ).rstrip(".")
            if frag and frag.lower() not in base.lower():
                if re.search(r"\b(protagonist|antagonist|main character)\b", base, re.I):
                    base = base.rstrip(".") + f", {frag}."
                    extras.remove(c)

    sentences = [base if base.endswith((".", "!", "?")) else base + "."]

    if brothers:
        if len(brothers) == 1:
            sentences.append(f"{label} is brother to {brothers[0]}.")
        elif len(brothers) == 2:
            sentences.append(
                f"{label} is brother to {brothers[0]} and {brothers[1]}."
            )
        else:
            joined = ", ".join(brothers[:-1]) + f", and {brothers[-1]}"
            sentences.append(f"{label} is brother to {joined}.")

    for c in other_family[:3]:
        clause = c if c.endswith((".", "!", "?")) else c + "."
        if clause not in sentences:
            sentences.append(clause)

    for c in extras[:3]:
        clause = c if c.endswith((".", "!", "?")) else c + "."
        if clause not in sentences:
            sentences.append(clause)

    body = " ".join(sentences)
    if not _composed_has_substance([body], label):
        return ""
    return body


def smooth_who_is_prose(label: str, body: str) -> str:
    """Fold bare gender lines into flowing cast prose — avoid stuttered 'X is male.'"""
    text = (body or "").strip()
    label = (label or "").strip()
    if not text or not label:
        return text
    parts = text.split("\n\n")
    out_parts: list[str] = []
    for part in parts:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", part) if s.strip()]
        gender: str | None = None
        kept: list[str] = []
        for s in sentences:
            m = re.match(rf"^{re.escape(label)}\s+is\s+(male|female)\.?$", s, re.I)
            if m:
                gender = m.group(1).lower()
                continue
            kept.append(s)
        if gender and kept:
            first = kept[0]
            if re.match(rf"^{re.escape(label)}\s+is\s+the\b", first, re.I):
                kept[0] = re.sub(
                    rf"^({re.escape(label)}\s+is\s+the)\b",
                    rf"\1 {gender}",
                    first,
                    count=1,
                    flags=re.I,
                )
            elif re.match(rf"^{re.escape(label)}\s+is\b", first, re.I):
                kept[0] = re.sub(
                    rf"^({re.escape(label)}\s+is)\b",
                    rf"\1 a {gender}",
                    first,
                    count=1,
                    flags=re.I,
                )
            else:
                kept[0] = re.sub(
                    rf"^({re.escape(label)})\b",
                    rf"\1 ({gender})",
                    first,
                    count=1,
                    flags=re.I,
                )
        out_parts.append(" ".join(kept) if kept else part)
    return "\n\n".join(p for p in out_parts if p.strip())


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
    # Plot/POV chronology or awareness dump is not a finished who-is answer.
    if is_plot_walkthrough_text(a) and not has_cast_card_anchors(a):
        return True
    if who_is_answer_has_bloat(a):
        return True
    if _UNCLEAR_SECTION_HEADING in a:
        before = a.split(_UNCLEAR_SECTION_HEADING, 1)[0]
        chunks = [p.strip() for p in before.split("\n\n") if p.strip()]
        body_chunks = [c for c in chunks if c != label and not c.startswith("—")]
        if body_chunks and len(" ".join(body_chunks)) > 45:
            if is_composed_reference_answer(a):
                return _composed_only_weak_pov(label, "\n\n".join(body_chunks))
            low_body = " ".join(body_chunks).lower()
            if has_cast_card_anchors(low_body):
                return False
            if is_plot_walkthrough_text("\n\n".join(body_chunks)):
                return True
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
        body_joined = "\n\n".join(body_parts)
        if _composed_only_weak_pov(label, body_joined):
            return True
        if is_plot_walkthrough_text(body_joined) and not has_cast_card_anchors(body_joined):
            return True
        return False
    if has_cast_card_anchors(a) and not is_plot_walkthrough_text(a) and not who_is_answer_has_bloat(a):
        return False
    label_low = label.lower()
    if label_low in low and re.search(rf"\b{re.escape(label_low)}\s+is\b", low):
        main = next(
            (p for p in a.split("\n\n") if p.strip() and not p.strip().startswith("—")),
            a,
        )
        if len(main.strip()) > 45:
            if is_plot_walkthrough_text(main):
                return True
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
