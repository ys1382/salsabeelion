"""LoreKeeper — local contextual inference from the writer's draft (no third party, no invention)."""
from __future__ import annotations

import re
from collections import Counter
from typing import Any

_NAME_STOP = frozenset(
    """
    the and but for with from into over under after before when while because
    though although however she he they his her their its our your who what
    where there here then than that this these those once upon chapter page
    smoke mirrors said asked replied whispered muttered shouted
    yes no well oh ah hey look please thanks thank sorry wait stop listen maybe
    truly indeed why how never always really fine okay sure right wrong gods god
    help hello goodbye good dear lad lass boy girl man woman sire mercy forgive
    """.split()
)

_INTERJECTIONS = frozenset(
    """
    yes no well oh ah hey please wait listen look sure okay fine right indeed truly
    really gods god forgive mercy help hello goodbye dear
    """.split()
)

# Capitalized like names in drafts but are ordinary verbs/actions — not people.
_VERB_STOP = frozenset(
    """
    goes went going gone come comes came get gets got make makes made take takes took
    look looks looked turn turns turned walk walks walked run runs ran stand stands stood
    sit sits sat speak speaks spoke talk talks talked tell tells told ask asks asked
    feel feels felt know knows knew think thinks thought see sees saw hear hears heard
    leave leaves left find finds found hold holds held keep keeps kept want wants need
    needs try tries tried start starts started begin begins began return returns returned
    move moves moved watch watches watched wait waits waited pull pulls pushed push
    pushes reach reaches reached open opens opened close closes closed read reads write
    writes give gives gave bring brings brought send sends sent call calls called
    whisper whispers whispered shout shouts shouted reply replies replied mutter mutters
    """.split()
)

_FAMILY_WORDS = (
    "brother|sister|mother|father|wife|husband|son|daughter|cousin|parent|child"
)

_PROTAGONIST_REF = re.compile(r"\bthe protagonist\b", re.I)
_POV_ROLE_REF = re.compile(
    r"\b(point of view|pov|narrator|viewpoint character)\b", re.I
)

_VOCATIVE_PATTERNS: tuple[tuple[str, str, re.Pattern[str]], ...] = (
    ("brother", "Brother to", re.compile(
        r"(?:^|[\s,\"“])(?:my\s+)?(?:little\s+|older\s+|younger\s+)?brother\b|"
        r"[,!?\s\"“]\s*brother\b|\bbrother\s*[,!?\"]",
        re.I,
    )),
    ("sister", "Sister to", re.compile(
        r"(?:^|[\s,\"“])(?:my\s+)?(?:little\s+|older\s+|younger\s+)?sister\b|"
        r"[,!?\s\"“]\s*sister\b|\bsister\s*[,!?\"]",
        re.I,
    )),
    ("mother", "Child of", re.compile(
        r"(?:^|[\s,\"“])(?:my\s+)?mother\b|[,!?\s\"“]\s*mother\b|\bmother\s*[,!?\"]",
        re.I,
    )),
    ("father", "Child of", re.compile(
        r"(?:^|[\s,\"“])(?:my\s+)?father\b|[,!?\s\"“]\s*father\b|\bfather\s*[,!?\"]",
        re.I,
    )),
    ("wife", "Married to", re.compile(
        r"(?:^|[\s,\"“])(?:my\s+)?wife\b|[,!?\s\"“]\s*wife\b|\bwife\s*[,!?\"]",
        re.I,
    )),
    ("husband", "Married to", re.compile(
        r"(?:^|[\s,\"“])(?:my\s+)?husband\b|[,!?\s\"“]\s*husband\b|\bhusband\s*[,!?\"]",
        re.I,
    )),
    ("son", "Parent of", re.compile(
        r"(?:^|[\s,\"“])(?:my\s+)?(?:little\s+)?son\b|[,!?\s\"“]\s*son\b",
        re.I,
    )),
    ("daughter", "Parent of", re.compile(
        r"(?:^|[\s,\"“])(?:my\s+)?(?:little\s+)?daughter\b|[,!?\s\"“]\s*daughter\b",
        re.I,
    )),
    ("cousin", "Cousin to", re.compile(
        r"(?:^|[\s,\"“])(?:my\s+)?cousin\b|[,!?\s\"“]\s*cousin\b|\bcousin\s*[,!?\"]",
        re.I,
    )),
)

_SHARED_LIFE = re.compile(
    r"\b("
    r"grew up together|grew up with|raised together|same (?:mother|father|parents|home|house)|"
    r"shared (?:childhood|past|history|life)|childhood (?:together|friends)|"
    r"all our lives|our whole lives|since we were (?:kids|children|young|little)|"
    r"life together|our whole lives|years together"
    r")\b",
    re.I,
)

_SPEAKER_VERB = re.compile(
    r"\b(said|says|asked|asks|replied|replies|whispered|shouted|muttered|murmured|called)\b",
    re.I,
)


def _split_sentences(text: str) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [p.strip() for p in parts if p.strip()]


def _name_in_text(name: str, text: str) -> bool:
    if not name or not text:
        return False
    return bool(re.search(rf"\b{re.escape(name)}\b", text, re.I))


def _merged_bodies(entries: list[dict[str, Any]]) -> str:
    chunks: list[str] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        body = str(entry.get("body") or "").strip()
        if body:
            chunks.append(body)
    return "\n\n".join(chunks)


def _display_person_name(name: str) -> str:
    name = (name or "").strip()
    if not name:
        return name
    if name.lower().startswith("character "):
        return _normalize_character_name(name)
    return name[0].upper() + name[1:]


def _normalize_character_name(raw: str) -> str:
    m = re.fullmatch(r"character\s+([a-z0-9]+)", raw.strip(), re.I)
    if m:
        return f"Character {m.group(1).upper()}"
    return raw.strip()


def _is_person_name(name: str) -> bool:
    if not name or len(name) < 3:
        return False
    parts = name.lower().split()
    if any(part in _NAME_STOP or part in _VERB_STOP or part in _INTERJECTIONS for part in parts):
        return False
    if name.isupper() and len(name) <= 4:
        return False
    return True


def _name_has_character_signal(name: str, text: str) -> bool:
    """True when the draft treats this token like a person, not a stray capitalized word."""
    if not name or not text:
        return False
    if _name_mention_counts(text, [name]).get(name, 0) >= 2:
        return True
    return bool(
        re.search(
            rf"\b{re.escape(name)}\s+(?:said|says|asked|asks|whispered|muttered|replied|replies|called)\b|"
            rf"\b{re.escape(name)}'s\s+\w+|"
            rf"\b{re.escape(name)}\s*,\s*(?:brother|sister|twin|wife|husband)\b|"
            rf"(?:named|called)\s+{re.escape(name)}\b|"
            rf"\b{re.escape(name)}\s+and\s+(?:his|her|their)\s+twin\b|"
            rf"\btwins?\s+{re.escape(name)}\s+and\b|"
            rf"\band\s+{re.escape(name)}\b",
            text,
            re.I,
        )
    )


def _candidate_names(text: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for m in re.finditer(r"character\s+([a-z0-9]+)", text, re.I):
        name = f"Character {m.group(1).upper()}"
        key = name.lower()
        if key not in seen:
            seen.add(key)
            found.append(name)
    for m in re.finditer(r"\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b", text):
        name = m.group(0)
        if not _is_person_name(name):
            continue
        key = name.lower()
        if key not in seen:
            seen.add(key)
            found.append(name)
    return found


def _name_mention_counts(text: str, names: list[str]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for name in names:
        counts[name] = len(re.findall(rf"\b{re.escape(name)}\b", text, re.I))
    return counts


def _is_story_center(label: str, text: str) -> bool:
    names = _candidate_names(text)
    if not _name_in_text(label, text):
        return False
    counts = _name_mention_counts(text, names)
    label_hits = counts.get(label, 0)
    if label_hits < 2:
        return False
    ranked = counts.most_common()
    if not ranked or ranked[0][0].lower() != label.lower():
        return False
    if len(ranked) == 1:
        return True
    second_hits = ranked[1][1]
    if second_hits <= 1:
        return True
    return label_hits >= second_hits * 1.4


def _infer_role_line(label: str, entries: list[dict[str, Any]]) -> str | None:
    text = _merged_bodies(entries)
    if not text or not _name_in_text(label, text):
        return None
    if re.search(rf"\b{re.escape(label)}\s+(?:was|is)\s+the protagonist\b", text, re.I):
        return f"{label} reads as the protagonist — the story keeps centering on them."
    has_protagonist_word = bool(_PROTAGONIST_REF.search(text))
    centered = _is_story_center(label, text)
    if has_protagonist_word and centered:
        return f"{label} reads as the protagonist — the story keeps centering on them."
    if centered and _POV_ROLE_REF.search(text):
        return f"{label} appears to be the viewpoint character."
    if centered:
        return f"{label} appears to be the main character the draft stays close to."
    return None


def _other_character_speaks(label: str, prior: str, sentence: str) -> bool:
    for name in _candidate_names(sentence):
        if name.lower() == label.lower():
            continue
        if re.search(
            rf"\b{re.escape(name)}\s+(?:said|says|asked|asks|whispered|muttered|called|replied)\b",
            sentence,
            re.I,
        ):
            return True
    return False


def _family_line_about_someone_else(label: str, sentence: str) -> bool:
    for name in _candidate_names(sentence):
        if name.lower() == label.lower():
            continue
        if re.search(
            rf"\b{re.escape(name)}'s\s+(?:{_FAMILY_WORDS})\b",
            sentence,
            re.I,
        ):
            return True
    return False


def _label_owns_family_beat(label: str, prior: str, sentence: str) -> bool:
    blob = f"{prior} {sentence}".strip()
    if _family_line_about_someone_else(label, sentence):
        return False
    if _other_character_speaks(label, prior, sentence):
        return False
    if re.search(
        rf"\b{re.escape(label)}'s\s+(?:{_FAMILY_WORDS})\b",
        blob,
        re.I,
    ):
        return True
    if re.search(
        rf"\b{re.escape(label)}\s+[^.?!]{{0,55}}(?:said|says|asked|asks|whispered|muttered|called|replied)\b",
        blob,
        re.I,
    ):
        return True
    return False


def _extract_addressee_name(sentence: str, label: str, rel_word: str = "") -> str | None:
    label_low = label.lower()
    rel = rel_word or _FAMILY_WORDS

    def accept(raw: str | None) -> str | None:
        if not raw:
            return None
        name = raw.strip()
        low = name.lower()
        if low == label_low or low in _INTERJECTIONS or low in _VERB_STOP or not _is_person_name(name):
            return None
        return name

    m = re.search(
        rf'["\u201c]\s*([A-Z][a-z]{{2,}}(?:\s+[A-Z][a-z]{{2,}})?)\s*,\s*{rel}\b',
        sentence,
        re.I,
    )
    if accepted := accept(m.group(1) if m else None):
        return accepted
    for m in re.finditer(
        rf"\b([A-Z][a-z]{{2,}}(?:\s+[A-Z][a-z]{{2,}})?)\s*,\s*{rel}\b",
        sentence,
        re.I,
    ):
        if accepted := accept(m.group(1)):
            return accepted
    m = re.search(
        rf'\b(?:{rel})\s*,\s*([A-Z][a-z]{{2,}}(?:\s+[A-Z][a-z]{{2,}})?)\b',
        sentence,
        re.I,
    )
    if accepted := accept(m.group(1) if m else None):
        return accepted
    return None


def _shorten_stated_tie(line: str, label: str) -> str | None:
    line = line.strip()
    low = line.lower()
    label_low = label.lower()
    if " is married to " in low:
        parts = re.split(r"\s+is married to\s+", line, maxsplit=1, flags=re.I)
        if len(parts) == 2:
            a, b = parts[0].strip(), parts[1].split(".")[0].strip()
            if a.lower() == label_low:
                return f"Married to {b}."
            if b.lower() == label_low:
                return f"Married to {a}."
    m = re.match(
        rf"^{re.escape(label)}\s+is\s+(.+?)'s\s+(brother|sister|cousin|mother|father|son|daughter)\.",
        line,
        re.I,
    )
    if m:
        other, rel = m.group(1), m.group(2).lower()
        if rel in ("brother", "sister"):
            return f"{'Brother' if rel == 'brother' else 'Sister'} to {other}."
        if rel == "cousin":
            return f"Cousin to {other}."
        if rel in ("mother", "father"):
            return f"Child of {other} ({rel})."
        if rel in ("son", "daughter"):
            return f"Parent of {other} ({rel})."
    if "'s daughter" in low or "'s son" in low or "'s child" in low:
        return line if len(line) < 120 else line[:117] + "…"
    if low.startswith(label_low) or f" {label_low} " in low:
        return line if len(line) < 120 else line[:117] + "…"
    return None


def _vocative_ties(
    label: str,
    entries: list[dict[str, Any]],
) -> list[str]:
    text = _merged_bodies(entries)
    if not text:
        return []
    sentences = _split_sentences(text)
    ties: list[str] = []
    seen: set[str] = set()

    for rel_word, tie_prefix, pattern in _VOCATIVE_PATTERNS:
        by_other: Counter[str] = Counter()
        unnamed = 0
        shared = False

        for i, sentence in enumerate(sentences):
            if not pattern.search(sentence):
                continue
            prior = sentences[i - 1] if i else ""
            if not _label_owns_family_beat(label, prior, sentence):
                continue
            other = _extract_addressee_name(sentence, label, rel_word)
            if other:
                by_other[other] += 1
            else:
                unnamed += 1
            if _SHARED_LIFE.search(sentence) or (
                i + 1 < len(sentences) and _SHARED_LIFE.search(sentences[i + 1])
            ):
                shared = True

        for other_name, count in by_other.items():
            key = f"{tie_prefix}|{other_name.lower()}"
            if key in seen:
                continue
            seen.add(key)
            extra = ""
            if count >= 2:
                extra = " (shown repeatedly in dialogue)"
            elif shared:
                extra = " (with shared past in nearby scenes)"
            ties.append(f"{tie_prefix} {other_name}.{extra}")

        if unnamed and not by_other:
            key = f"{tie_prefix}|unnamed"
            if key not in seen:
                seen.add(key)
                ties.append(f"{tie_prefix} someone unnamed in scene.")

    return ties[:8]


def _brother_names_from_ties(ties: list[str]) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for tie in ties:
        m = re.match(r"Brother to\s+(.+?)\.", tie, re.I)
        if not m:
            continue
        name = m.group(1).split("(")[0].strip()
        key = name.lower()
        if name and key not in seen and _is_person_name(name):
            seen.add(key)
            names.append(name)
    return names


def brother_names_from_brief(ties: list[str]) -> list[str]:
    return _brother_names_from_ties(ties)


_NAMED_BROTHER = re.compile(
    r"(?:another|other|second)\s+brother(?:\s+(?:named|called)\s+|\s*[,—–-]\s*)([A-Za-z][a-z]{2,})",
    re.I,
)
_BROTHERS_AND = re.compile(
    r"\bbrothers?\s+([A-Za-z][a-z]{2,})\s+and\s+([A-Za-z][a-z]{2,})\b",
    re.I,
)
_BROTHER_HAD_ANOTHER = re.compile(
    r"\b(?:the|his|her|their)\s+brother\s+had\s+another\s+brother|"
    r"\bbrother\s+had\s+another\s+brother|"
    r"\bsaid\s+(?:the\s+|his\s+|her\s+|their\s+)?brother\s+had\s+another\s+brother"
    r"(?:\s+(?:named|called)\s+|\s*[,—–-]\s*)?([A-Za-z][a-z]{2,})?",
    re.I,
)
_FAMILY_CHAIN = re.compile(
    r"\b(?:"
    r"(?:the|his|her|their)\s+brother\s+had\s+another\s+brother|"
    r"brother\s+had\s+another\s+brother|"
    r"said\s+(?:the\s+|his\s+|her\s+|their\s+)?brother\s+had\s+another|"
    r"(?:another|other|second)\s+brother|"
    r"twin\s+brother|twin\s+sister|\btwins?\b"
    r")\b",
    re.I,
)
_SIBLING_NOTE = re.compile(
    r"\b(?:brother|sister|sibling|cousin|parent|mother|father|family|twin)\b",
    re.I,
)


def family_chain_in_body(body: str) -> bool:
    return bool(_FAMILY_CHAIN.search(body or ""))


def _register_brother_name(
    raw: str | None,
    label_low: str,
    seen: set[str],
    names: list[str],
    *,
    text: str = "",
    explicit: bool = False,
) -> None:
    if not raw or not _is_person_name(raw):
        return
    if raw.lower() == label_low:
        return
    if not explicit and text and not _name_has_character_signal(raw, text):
        return
    key = raw.lower()
    if key in seen:
        return
    seen.add(key)
    names.append(_display_person_name(raw))


def _apply_twin_brother_inference(
    text: str,
    label: str,
    label_low: str,
    names: list[str],
    reg: Any,
) -> None:
    """Link a second brother when twin language appears with a known brother."""
    known_keys = {n.lower() for n in names}
    label_linked = _name_in_text(label, text)

    for m in re.finditer(
        r"\btwins?\s+([A-Za-z][a-z]{2,})\s+and\s+([A-Za-z][a-z]{2,})\b",
        text,
        re.I,
    ):
        a, b = m.group(1), m.group(2)
        if label_linked or a.lower() in known_keys or b.lower() in known_keys:
            reg(a, True)
            reg(b, True)

    for m in re.finditer(
        r"\b([A-Za-z][a-z]{2,})\s+and\s+(?:his|her|their)\s+twin"
        r"(?:\s+brother)?(?:\s+(?:named|called)\s+|\s*[,—–-]\s*|\s+)([A-Za-z][a-z]{2,})\b",
        text,
        re.I,
    ):
        anchor, twin_name = m.group(1), m.group(2)
        if anchor.lower() in known_keys or label_linked:
            reg(anchor, True)
            if twin_name:
                reg(twin_name, True)

    for m in re.finditer(
        r"\b([A-Za-z][a-z]{2,})'s\s+twin(?:\s+brother)?"
        r"(?:\s+(?:named|called)\s+|\s*[,—–-]\s*)([A-Za-z][a-z]{2,})\b",
        text,
        re.I,
    ):
        anchor, twin_name = m.group(1), m.group(2)
        if anchor.lower() in known_keys or label_linked:
            reg(anchor, True)
            reg(twin_name, True)

    for m in re.finditer(
        r"\b(?:his|her|their)\s+twin\s+brother"
        r"(?:\s+(?:named|called)\s+|\s*[,—–-]\s*)([A-Za-z][a-z]{2,})\b",
        text,
        re.I,
    ):
        if label_linked or known_keys:
            reg(m.group(1), True)

    sentences = _split_sentences(text)
    for i, sentence in enumerate(sentences):
        if not re.search(r"\btwins?\b", sentence, re.I):
            continue
        prior = sentences[i - 1] if i else ""
        blob = f"{prior} {sentence}"
        if not (
            label_linked
            or _name_in_text(label, blob)
            or _label_owns_family_beat(label, prior, sentence)
            or any(_name_in_text(k, blob) for k in names)
        ):
            continue
        for m in re.finditer(r"\b([A-Za-z][a-z]{2,})\s*,\s*twin\b", sentence, re.I):
            reg(m.group(1), True)
        for m in re.finditer(r"\btwin\s*,\s*([A-Za-z][a-z]{2,})\b", sentence, re.I):
            reg(m.group(1), True)
        people = [
            n
            for n in _candidate_names(sentence)
            if _is_person_name(n) and n.lower() != label_low
        ]
        known_here = [n for n in people if n.lower() in known_keys]
        others = [n for n in people if n.lower() not in known_keys]
        if known_here and others:
            for other in others:
                reg(other)


def collect_brother_names(label: str, entries: list[dict[str, Any]]) -> list[str]:
    """Every distinct brother name linked to this character in scoped notes/docs."""
    label_low = label.lower()
    seen: set[str] = set()
    names: list[str] = []

    def reg(raw: str | None, explicit: bool = False) -> None:
        _register_brother_name(raw, label_low, seen, names, text=text, explicit=explicit)

    text = _merged_bodies(entries)
    if not text:
        return names

    sentences = _split_sentences(text)
    for i, sentence in enumerate(sentences):
        prior = sentences[i - 1] if i else ""
        linked = (
            _name_in_text(label, sentence)
            or _name_in_text(label, prior)
            or _label_owns_family_beat(label, prior, sentence)
            or family_chain_in_body(sentence)
            or bool(re.search(r"\btwins?\b", sentence, re.I))
        )
        if not linked:
            continue
        for m in re.finditer(r"\b([A-Za-z][a-z]{2,})\s*,\s*brother\b", sentence, re.I):
            reg(m.group(1), False)
        for m in re.finditer(
            r"(?:another|other|second|younger|older)\s+brother"
            r"(?:\s+(?:named|called|is)\s+|\s*[,—–-]\s*)([A-Za-z][a-z]{2,})",
            sentence,
            re.I,
        ):
            reg(m.group(1), True)

    for m in _BROTHERS_AND.finditer(text):
        if _name_in_text(label, text) or family_chain_in_body(text):
            reg(m.group(1), True)
            reg(m.group(2), True)
    if _name_in_text(label, text) or family_chain_in_body(text):
        for m in re.finditer(
            rf"\b{re.escape(label)}'?s?\s+brothers?\s+(?:are\s+)?([A-Za-z][a-z]{{2,}})\s+and\s+([A-Za-z][a-z]{{2,}})\b",
            text,
            re.I,
        ):
            reg(m.group(1), True)
            reg(m.group(2), True)
        for m in re.finditer(
            r"(?:two brothers|brothers are|brothers:?)\s+([A-Za-z][a-z]{2,})\s+and\s+([A-Za-z][a-z]{2,})\b",
            text,
            re.I,
        ):
            reg(m.group(1), True)
            reg(m.group(2), True)
        for m in re.finditer(
            r"\bbrother\s+([A-Za-z][a-z]{2,})\s+and\s+(?:brother\s+)?([A-Za-z][a-z]{2,})\b",
            text,
            re.I,
        ):
            reg(m.group(1), True)
            reg(m.group(2), True)
    for m in re.finditer(
        r"\b([A-Za-z][a-z]{2,})\s+had\s+another\s+brother"
        r"(?:\s+(?:named|called)\s+|\s*[,—–-]\s*)([A-Za-z][a-z]{2,})\b",
        text,
        re.I,
    ):
        reg(m.group(2), True)
    for m in re.finditer(
        r"\b(?:the|his|her|their)\s+brother\s+had\s+another\s+brother"
        r"(?:\s+(?:named|called)\s+|\s*[,—–-]\s*)([A-Za-z][a-z]{2,})\b",
        text,
        re.I,
    ):
        reg(m.group(1), True)

    from lorekeeper_relations import plain_relationship_lines_for

    for line in plain_relationship_lines_for(label, entries):
        m = re.match(rf"^{re.escape(label)}\s+is\s+(.+?)'s\s+brother\.", line, re.I)
        if m:
            reg(m.group(1), True)
        m = re.match(rf"^(.+?)\s+is\s+{re.escape(label)}'s\s+brother\.", line, re.I)
        if m:
            reg(m.group(1), True)

    _apply_twin_brother_inference(text, label, label_low, names, reg)

    return names


def _freeform_family_ties(label: str, entries: list[dict[str, Any]]) -> list[str]:
    """Read plain family lines from relationship notes and similar free text."""
    ties: list[str] = []
    seen: set[str] = set()
    label_low = label.lower()

    def add(tie: str) -> None:
        key = tie.lower()[:80]
        if key in seen:
            return
        seen.add(key)
        ties.append(tie)

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        body = str(entry.get("body") or "").strip()
        if not body:
            continue
        kind = str(entry.get("kind") or "")
        if kind != "relationship" and not _SIBLING_NOTE.search(body):
            continue
        if kind != "relationship" and not _name_in_text(label, body):
            continue
        for m in _BROTHERS_AND.finditer(body):
            for name in (m.group(1), m.group(2)):
                if name.lower() != label_low and _is_person_name(name):
                    add(f"Brother to {_display_person_name(name)}.")
        for m in _NAMED_BROTHER.finditer(body):
            name = m.group(1)
            if name.lower() != label_low and _is_person_name(name):
                add(f"Brother to {_display_person_name(name)}.")
        for m in _BROTHER_HAD_ANOTHER.finditer(body):
            name = m.group(1)
            if name and _is_person_name(name) and name.lower() != label_low:
                add(f"Brother to {_display_person_name(name)}.")
            elif _name_in_text(label, body) or _FAMILY_CHAIN.search(body):
                add("Another brother mentioned in your notes (not named).")

    return ties[:8]


def _another_brother_ties(
    label: str,
    entries: list[dict[str, Any]],
    known_brothers: list[str],
) -> list[str]:
    text = _merged_bodies(entries)
    if not text:
        return []
    ties: list[str] = []
    seen: set[str] = set()

    def add(tie: str) -> None:
        key = tie.lower()[:80]
        if key in seen:
            return
        seen.add(key)
        ties.append(tie)

    named_pat = re.compile(
        r"(?:another|other|second)\s+brother(?:\s+(?:named|called)\s+|\s*[,—–-]\s*)([A-Za-z][a-z]{2,})",
        re.I,
    )
    loose_context = re.compile(
        r"\b(?:"
        r"(?:the|his|her|their)\s+brother\s+had\s+another\s+brother|"
        r"brother\s+had\s+another\s+brother|"
        r"said\s+(?:the\s+|his\s+|her\s+|their\s+)?brother\s+had\s+another"
        r")\b",
        re.I,
    )
    sentences = _split_sentences(text)
    for i, sentence in enumerate(sentences):
        if not _FAMILY_CHAIN.search(sentence):
            continue
        prior = sentences[i - 1] if i else ""
        blob = f"{prior} {sentence}"
        if not (
            _name_in_text(label, blob)
            or re.search(rf"\b{re.escape(label)}'s\s+brother\b", blob, re.I)
            or loose_context.search(sentence)
            or (known_brothers and _FAMILY_CHAIN.search(sentence))
        ):
            continue
        m = named_pat.search(sentence)
        if m and _is_person_name(m.group(1)):
            add(f"Brother to {_display_person_name(m.group(1))}.")
        elif loose_context.search(sentence) or (
            known_brothers and _FAMILY_CHAIN.search(sentence)
        ):
            add("Another brother mentioned in your notes (not named).")

    for known in known_brothers:
        for m in re.finditer(
            rf"\b{re.escape(known)}\s+had\s+another\s+brother(?:\s+(?:named|called)\s+|\s*[,—–-]\s*)([A-Za-z]{{2,}})\b",
            text,
            re.I,
        ):
            if _is_person_name(m.group(1)):
                add(f"Brother to {_display_person_name(m.group(1))}.")
        if re.search(
            rf"\b{re.escape(known)}\s+(?:had\s+)?(?:another|other|a)\s+brother\b", text, re.I
        ):
            add("Another brother mentioned in your notes (not named).")

    return ties[:6]


def _is_brother_tie(tie: str) -> bool:
    low = tie.lower()
    return low.startswith("brother to") or "another brother mentioned" in low


def build_character_brief(
    label: str, entries: list[dict[str, Any]]
) -> dict[str, Any]:
    """Role line + relationship ties for one character only."""
    from lorekeeper_relations import plain_relationship_lines_for

    role = _infer_role_line(label, entries)
    ties: list[str] = []
    seen: set[str] = set()

    def add(tie: str | None) -> None:
        if not tie:
            return
        key = tie.lower()[:80]
        if key in seen:
            return
        seen.add(key)
        ties.append(tie)

    for stated in plain_relationship_lines_for(label, entries):
        shortened = _shorten_stated_tie(stated, label) or stated
        if not _is_brother_tie(shortened):
            add(shortened)
    for tie in _vocative_ties(label, entries):
        if not tie.lower().startswith("brother to"):
            add(tie)
    for tie in _freeform_family_ties(label, entries):
        if not _is_brother_tie(tie):
            add(tie)
    for tie in _another_brother_ties(label, entries, collect_brother_names(label, entries)):
        if not _is_brother_tie(tie):
            add(tie)

    brother_names = collect_brother_names(label, entries)
    ties = [t for t in ties if not _is_brother_tie(t)]
    seen = {t.lower()[:80] for t in ties}
    for name in brother_names:
        add(f"Brother to {name}.")
    merged = _merged_bodies(entries)
    if len(brother_names) == 1:
        if re.search(r"\btwins?\b", merged or "", re.I):
            add("Another brother (twin) mentioned in your notes — name not stated.")
        elif family_chain_in_body(merged):
            add("Another brother mentioned in your notes (not named).")

    return {"role": role, "ties": ties[:10]}


def build_context_inferences(
    label: str, entries: list[dict[str, Any]]
) -> list[str]:
    """Backward-compatible flat list (prefer build_character_brief for formatting)."""
    brief = build_character_brief(label, entries)
    out: list[str] = []
    if brief.get("role"):
        out.append(str(brief["role"]))
    out.extend(brief.get("ties") or [])
    return out
