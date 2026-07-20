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

from lorekeeper_cast_roles import (
    extract_explicit_cast_role_from_entries,
    infer_viewpoint_role_only,
    label_has_antagonist_signal,
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
            rf"\b{re.escape(name)}\s+and\s+[A-Z][a-z]{{2,}}\b|"
            rf"\b[A-Z][a-z]{{2,}}\s+and\s+{re.escape(name)}\b|"
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


_POV_NARRATIVE = re.compile(
    r"\b("
    r"walked|walks|turned|turns|looked|looks|watched|watches|felt|feels|thought|thinks|"
    r"saw|sees|heard|hears|entered|enters|whispered|whispers|said|says|stood|stands|"
    r"ran|runs|reached|reaches|opened|opens|closed|closes|nodded|nodded"
    r")\b",
    re.I,
)


def _is_draft_entry(entry: dict[str, Any]) -> bool:
    kind = str(entry.get("kind") or "")
    eid = str(entry.get("id") or "")
    return kind == "document" or "#p" in eid


def _draft_pov_leans(label: str, entries: list[dict[str, Any]]) -> bool:
    """True when draft prose keeps returning to this character's actions/perceptions (#16)."""
    draft_chunks = [
        str(e.get("body") or "")
        for e in entries
        if isinstance(e, dict) and _is_draft_entry(e) and str(e.get("body") or "").strip()
    ]
    if not draft_chunks:
        return False
    text = "\n\n".join(draft_chunks)
    if not _name_in_text(label, text):
        return False
    sentences = _split_sentences(text)
    if not sentences:
        return False
    centered = 0
    for sentence in sentences:
        if not _name_in_text(label, sentence):
            continue
        if re.search(rf"^{re.escape(label)}\b", sentence, re.I):
            centered += 1
            continue
        if re.search(rf"\b{re.escape(label)}'s\b", sentence, re.I):
            centered += 1
            continue
        if _POV_NARRATIVE.search(sentence):
            centered += 1
    if centered >= 2:
        return True
    return False


def _infer_role_line(label: str, entries: list[dict[str, Any]]) -> str | None:
    text = _merged_bodies(entries)
    explicit = extract_explicit_cast_role_from_entries(label, entries)
    if explicit:
        return explicit
    if not text or not _name_in_text(label, text):
        return None
    # Antagonist / hunter wording blocks viewpoint/main-character inference.
    if label_has_antagonist_signal(label, text):
        return None
    centered = _is_story_center(label, text) or _draft_pov_leans(label, entries)
    return infer_viewpoint_role_only(label, text=text, is_story_center=centered)


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


def _speaker_in_sentence(sentence: str, label: str) -> bool:
    if not _name_in_text(label, sentence):
        return False
    return bool(
        re.search(
            rf"\b{re.escape(label)}\s+[^.?!]{{0,40}}(?:said|says|asked|asks|whispered|muttered|called|replied|replies)\b",
            sentence,
            re.I,
        )
        or re.search(
            rf"(?:said|says|asked|asks|whispered|muttered|called|replied|replies)\s+[^.?!]{{0,20}}\b{re.escape(label)}\b",
            sentence,
            re.I,
        )
    )


def _addressee_from_nearby(
    prior: str, sentence: str, label: str, rel_word: str
) -> str | None:
    """When vocative + label speaks, the addressee is often in the prior sentence."""
    label_low = label.lower()
    if not rel_word or not _speaker_in_sentence(sentence, label):
        return None
    if not re.search(rf"\b{re.escape(rel_word)}\b", sentence, re.I):
        return None
    for blob in (prior, sentence):
        if not blob:
            continue
        for name in _candidate_names(blob):
            if name.lower() != label_low:
                return name
    return None


def _extract_addressee_name(
    sentence: str,
    label: str,
    rel_word: str = "",
    *,
    prior: str = "",
) -> str | None:
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
    if rel_word:
        return _addressee_from_nearby(prior, sentence, label, rel_word)
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
            other = _extract_addressee_name(sentence, label, rel_word, prior=prior)
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


def named_characters_in_scene_text(
    text: str,
    *,
    allowlist: set[str] | None = None,
    work_title_tokens: set[str] | None = None,
) -> list[str]:
    """Proper names the draft treats as people in a scene beat (resume / tail summaries)."""
    if not (text or "").strip():
        return []
    allow_lower = {a.lower() for a in (allowlist or set())}
    work_tokens = work_title_tokens or set()
    kept: list[str] = []
    seen: set[str] = set()
    for name in _candidate_names(text):
        key = name.lower()
        if key in seen or not _name_in_text(name, text):
            continue
        if any(part in work_tokens for part in key.split()) and key not in allow_lower:
            continue
        if _is_concept_like_name(name) and key not in allow_lower:
            continue
        on_list = key in allow_lower
        if on_list or _name_has_character_signal(name, text):
            seen.add(key)
            kept.append(_display_person_name(name))
    return kept


_CONCEPT_LIKE_NAMES = frozenset(
    """
    gate trial court herald gallery marble dawn smoke mirrors everyone servants weeks
    situation predator prey chapter prologue epilogue ritual ceremony treaty alliance
    faction magic throne crown mask shadow shadows intrigue scheme politics theme motif
    prologue epilogue narrator everyone somebody someone something somewhere
    """.split()
)


def _is_concept_like_name(name: str) -> bool:
    parts = re.findall(r"[a-z0-9']+", (name or "").lower())
    if not parts:
        return True
    if len(parts) > 2:
        return True
    if any(part in _CONCEPT_LIKE_NAMES for part in parts):
        return True
    return False


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
        for rel_word, _, pattern in _VOCATIVE_PATTERNS:
            if rel_word != "brother" or not pattern.search(sentence):
                continue
            if not _label_owns_family_beat(label, prior, sentence):
                continue
            other = _extract_addressee_name(sentence, label, rel_word, prior=prior)
            if other:
                reg(other, True)

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


_SPECIES_ENTRY = re.compile(r"\b(species|world rules|worldbuilding)\b", re.I)
_SPECIES_HEADING = re.compile(
    r"^([A-Za-z][a-z]+(?:\s+[a-z]+)?)(?:s)?:\s*(.+?)\.?\s*$",
    re.I,
)
# "is a/an/the <species-noun>" — never bare "one of …" (that only links, no species token).
_MEMBER_OF = re.compile(
    r"\b(character\s+[a-z0-9]+|[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\s+is\s+"
    r"(?:an?|the)\s+([a-z][a-z\-]+)\b",
    re.I,
)
_SPECIES_IS_MULTI = re.compile(
    r"\b(character\s+[a-z0-9]+|[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\s+is\s+"
    r"(?:an?|the)\s+([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)+)\b"
)
_SPECIES_TOKEN_STOP = frozenset(
    """
    side main one of them they their his her its this that with from into
    going after after before when while because though although however
    antagonist villain hero heroine protagonist deuteragonist narrator
    character characters person people member members
    """.split()
)
_GENDER_OPTION_RE = re.compile(
    r"\b(?:male\s+or\s+female|female\s+or\s+male)\b", re.I
)
_EXPLICIT_MALE = re.compile(
    r"\b(?:is|was)\s+male\b|\b(?:he|him)\s+is\b|"
    r"(?:^|[.!?]\s+|\n)He\s+(?:is|was|has|had|walks|walked|looks|looked|says|said|hunts|hunted)\b",
    re.I,
)
_EXPLICIT_FEMALE = re.compile(
    r"\b(?:is|was)\s+female\b|\b(?:she|her)\s+is\b|"
    r"(?:^|[.!?]\s+|\n)She\s+(?:is|was|has|had|walks|walked|looks|looked|says|said|hunts|hunted)\b",
    re.I,
)


def _species_label(name: str) -> str:
    n = name.strip().lower()
    if n.endswith("ists"):
        return n[:-1]
    if n.endswith("es") and len(n) > 4:
        return n[:-2]
    if n.endswith("s") and not n.endswith("ss"):
        return n[:-1]
    return n


def _is_usable_species_token(token: str) -> bool:
    """Reject cast-role scraps and stopwords mistaken for species."""
    from lorekeeper_cast_roles import ROLE_TERMS_RE

    raw = re.sub(r"\s+", " ", (token or "").strip())
    if not raw or len(raw) < 2:
        return False
    low = raw.lower()
    if low in _SPECIES_TOKEN_STOP:
        return False
    if any(part in _SPECIES_TOKEN_STOP for part in low.split()):
        return False
    if ROLE_TERMS_RE.search(raw):
        return False
    if _GENDER_OPTION_RE.fullmatch(low):
        return False
    return True


def _clean_species_desc(desc: str) -> str:
    """Drop open gender options from species cards — not a character fact."""
    d = _GENDER_OPTION_RE.sub("", desc or "")
    d = re.sub(r"\s{2,}", " ", d).strip(" ,;:-")
    return d


def _species_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        kind = str(entry.get("kind") or "").lower()
        title = str(entry.get("title") or "")
        body = str(entry.get("body") or "")
        if kind in ("species", "world", "worldbuilding"):
            out.append(entry)
            continue
        if _SPECIES_ENTRY.search(title) or _SPECIES_ENTRY.search(body[:200]):
            out.append(entry)
    return out


def _infer_gender_line(label: str, entries: list[dict[str, Any]]) -> str | None:
    """Settle he/she from the writer's pronouns when consistent — never invent."""
    about: list[str] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        kind = str(entry.get("kind") or "")
        eid = str(entry.get("id") or "")
        if kind == "document" or "#p" in eid:
            continue
        body = str(entry.get("body") or "")
        title = str(entry.get("title") or "")
        blob = f"{title}\n{body}".strip()
        if not blob or not _name_in_text(label, blob):
            continue
        for sentence in _split_sentences(blob):
            if _name_in_text(label, sentence):
                about.append(sentence)
            elif re.match(r"^(?:He|She)\b", sentence.strip()):
                # Continuation after a sentence that named them in the same note.
                if about or _name_in_text(label, blob):
                    about.append(sentence)
    if not about:
        return None
    joined = "\n".join(about)
    he = bool(_EXPLICIT_MALE.search(joined))
    she = bool(_EXPLICIT_FEMALE.search(joined))
    if he and not she:
        return f"{label} is male."
    if she and not he:
        return f"{label} is female."
    return None


def _infer_species_traits(label: str, entries: list[dict[str, Any]]) -> list[str]:
    """Cross-link species/world notes only when the writer tied this character in (#16)."""
    traits: list[str] = []
    seen: set[str] = set()
    label_low = label.lower()
    merged = _merged_bodies(entries)

    def add(line: str) -> None:
        key = re.sub(r"\s+", " ", (line or "").strip().lower())
        # Collapse "An wolf." vs "An wolf (…)." as one species fact.
        key = re.sub(r"\s*\([^)]*\)", "", key)
        key = re.sub(r"[^a-z0-9]+", " ", key)
        key = re.sub(r"\s+", " ", key).strip()[:100]
        if not key or key in seen:
            return
        seen.add(key)
        traits.append(line)

    gender = _infer_gender_line(label, entries)
    if gender:
        add(gender)

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        body = str(entry.get("body") or "")
        if not _name_in_text(label, body):
            continue
        for m in _MEMBER_OF.finditer(body):
            who = m.group(1)
            species = m.group(2)
            if who.lower() != label_low:
                continue
            if not _is_usable_species_token(species):
                continue
            add(f"An {species}.")
        # Pronoun continuation in the same character note: "He is a Wolf."
        kind = str(entry.get("kind") or "").lower()
        if kind == "character" or str(entry.get("title") or "").strip().lower() == label_low:
            for m in re.finditer(
                r"(?:^|[.!?]\s+|\n)(?:He|She)\s+is\s+(?:an?|the)\s+([A-Za-z][a-z\-]+)\b",
                body,
            ):
                species = m.group(1)
                if _is_usable_species_token(species):
                    add(f"An {species}.")
        for m in _SPECIES_IS_MULTI.finditer(body):
            who = m.group(1)
            species = m.group(2)
            if who.lower() != label_low:
                continue
            if not _is_usable_species_token(species):
                continue
            add(f"{label} is a {species}.")

    for entry in _species_entries(entries):
        body = str(entry.get("body") or "").strip()
        if not body:
            continue
        if not _name_in_text(label, body) and not re.search(
            rf"\b{re.escape(label)}\s+is\s+one\b", merged, re.I
        ):
            continue
        linked_in_body = bool(
            re.search(rf"\b{re.escape(label)}\s+is\s+one\b", body, re.I)
            or re.search(
                rf"\b{re.escape(label)}\s+is\s+(?:an?|the)\s+[a-z][a-z\-]+\b",
                body,
                re.I,
            )
        )
        for line in _split_sentences(body):
            heading = _SPECIES_HEADING.match(line.strip())
            if not heading:
                continue
            species_name = heading.group(1).strip()
            desc = _clean_species_desc(heading.group(2).strip().rstrip("."))
            linked = linked_in_body or bool(
                re.search(
                    rf"\b{re.escape(label)}\s+is\s+(?:an?|the)\s+{re.escape(species_name)}\b",
                    merged,
                    re.I,
                )
            )
            if not linked:
                continue
            if desc:
                add(f"An {_species_label(species_name)} ({desc}).")
            else:
                add(f"An {_species_label(species_name)}.")

    return traits[:4]


def _spouse_and_role_sets(
    label: str, entries: list[dict[str, Any]]
) -> tuple[set[str], set[str]]:
    from lorekeeper_cast_roles import extract_explicit_cast_role
    from lorekeeper_loose_ends import entry_is_planned
    from lorekeeper_relations import extract_relationships, _fact_matches_character

    spouses: set[str] = set()
    roles: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if entry_is_planned(entry):
            continue
        body = str(entry.get("body") or "")
        title = str(entry.get("title") or "")
        if not body.strip():
            continue
        blob = f"{title}\n{body}"
        for fact in extract_relationships(body, title):
            if not _fact_matches_character(fact, label):
                continue
            if fact.get("kind") != "spouse":
                continue
            a = str(fact.get("a") or "")
            b = str(fact.get("b") or "")
            if a.lower() == label.lower():
                spouses.add(b.lower())
            elif b.lower() == label.lower():
                spouses.add(a.lower())
        role_line = extract_explicit_cast_role(label, blob)
        if role_line:
            m = re.search(
                r"\b(protagonist|antagonist|villain|hero|deuteragonist|main character)\b",
                role_line,
                re.I,
            )
            if m:
                roles.add(m.group(1).lower())
    return spouses, roles


def _detect_contradictions(label: str, entries: list[dict[str, Any]]) -> list[str]:
    """Surface disagreements in the writer's notes — never pick a winner (#16)."""
    spouses, roles = _spouse_and_role_sets(label, entries)

    out: list[str] = []
    if len(spouses) > 1:
        partners = ", ".join(sorted(spouses, key=str.lower))
        out.append(
            f"Your notes disagree on who {label} is married to ({partners})."
        )
    if "protagonist" in roles and ("antagonist" in roles or "villain" in roles):
        role_list = ", ".join(sorted(roles))
        out.append(f"Your notes give {label} conflicting cast roles ({role_list}).")
    return out[:3]


def draft_vs_notes_conflict(label: str, entries: list[dict[str, Any]]) -> bool:
    """True when saved draft and notes disagree on key facts (not planned gaps)."""
    from lorekeeper_loose_ends import entry_is_planned

    draft = [
        e
        for e in entries
        if isinstance(e, dict) and _is_draft_entry(e) and not entry_is_planned(e)
    ]
    notes = [
        e
        for e in entries
        if isinstance(e, dict) and not _is_draft_entry(e) and not entry_is_planned(e)
    ]
    if not draft or not notes:
        return False

    d_spouses, d_roles = _spouse_and_role_sets(label, draft)
    n_spouses, n_roles = _spouse_and_role_sets(label, notes)
    if d_spouses and n_spouses and d_spouses != n_spouses:
        return True
    if d_roles and n_roles:
        if ("protagonist" in d_roles or "hero" in d_roles or "main character" in d_roles) and (
            "antagonist" in n_roles or "villain" in n_roles
        ):
            return True
        if ("protagonist" in n_roles or "hero" in n_roles or "main character" in n_roles) and (
            "antagonist" in d_roles or "villain" in d_roles
        ):
            return True
        if not d_roles.issubset(n_roles) and not n_roles.issubset(d_roles):
            return True

    combined = _detect_contradictions(label, draft + notes)
    if not combined:
        return False
    draft_only = _detect_contradictions(label, draft)
    notes_only = _detect_contradictions(label, notes)
    return bool(combined) and not draft_only and not notes_only


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

    return {
        "role": role,
        "ties": ties[:10],
        "traits": _infer_species_traits(label, entries),
        "contradictions": _detect_contradictions(label, entries),
    }


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


def _tie_reference_line(label: str, tie: str) -> str:
    tie = (tie or "").strip()
    if not tie:
        return ""
    m = re.match(
        r"^(Brother|Sister|Mother|Father|Son|Daughter|Child)\s+to\s+(.+?)\.?\s*$",
        tie,
        re.I,
    )
    if m:
        rel, other = m.group(1).lower(), m.group(2).split("(")[0].strip().rstrip(".")
        if rel == "brother":
            return f"{label} is brother to {other}."
        if rel == "sister":
            return f"{label} is sister to {other}."
        return f"{label} is {rel} to {other}."
    if re.match(r"^Married to\s+", tie, re.I):
        other = re.sub(r"^Married to\s+", "", tie, flags=re.I).strip().rstrip(".")
        return f"{label} is married to {other}."
    if tie.lower().startswith(label.lower()):
        return tie if tie.endswith(".") else tie + "."
    return tie if tie.endswith(".") else tie + "."


def inference_reference_lines_for(
    label: str, entries: list[dict[str, Any]]
) -> list[str]:
    """Pre-parsed logic-puzzle lines for cast cards — ties, POV lean, species; no contradictions (#16)."""
    brief = build_character_brief(label, entries)
    lines: list[str] = []
    seen: set[str] = set()

    def add(line: str) -> None:
        line = (line or "").strip()
        if not line:
            return
        if not line.endswith("."):
            line += "."
        key = line.lower()[:100]
        if key in seen:
            return
        seen.add(key)
        lines.append(line)

    role = str(brief.get("role") or "").strip()
    if role:
        add(role)

    for trait in brief.get("traits") or []:
        t = str(trait).strip()
        if not t:
            continue
        if re.match(r"^An\s+", t, re.I):
            add(f"{label} is {t[3:].lstrip()}")
        else:
            add(t)

    for tie in brief.get("ties") or []:
        add(_tie_reference_line(label, str(tie)))

    return lines[:10]


def audit_contradiction_lines_for(
    label: str, entries: list[dict[str, Any]]
) -> list[str]:
    """Disagreements in the writer's notes — audit questions only; never smooth (#16)."""
    return list(_detect_contradictions(label, entries))
