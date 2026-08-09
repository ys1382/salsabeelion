"""LoreKeeper — alternate names and identity disclosure (writer's words only)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Literal

from lorekeeper_reliability import entry_matches_work, extract_work_hints

CHAR = r"(?i:character\s+[a-z0-9]+)"
PROPER = r"[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?"
NAME = rf"({CHAR}|{PROPER})"
ALIAS = (
    rf'(?:"([^"]+)"|\'([^\']+)\'|({PROPER}))'
)

_NAME_STOP = frozenset(
    """
    the and but for with from into such this that these those people name names
    """.split()
)


@dataclass(frozen=True)
class AliasFact:
    kind: Literal["same_person", "known_to", "shared_name", "world_known"]
    subject: str
    other: str | None = None
    alias: str | None = None


def _clean_name(raw: str) -> str:
    name = re.sub(r"\s+", " ", (raw or "").strip(" \t.,;:!?\"'"))
    if not name:
        return ""
    if any(part in _NAME_STOP for part in name.lower().split()):
        return ""
    m = re.fullmatch(r"character\s+([a-z0-9]+)", name, re.I)
    if m:
        return f"Character {m.group(1).upper()}"
    return name


def _name_key(name: str) -> str:
    return re.sub(r"\s+", " ", (name or "").strip().lower())


def _names_match(a: str, b: str) -> bool:
    return _name_key(a) == _name_key(b)


def _pick_alias(*groups: str | None) -> str:
    for g in groups:
        if g and g.strip():
            cleaned = _clean_name(g.strip())
            if cleaned and cleaned.lower() not in _NAME_STOP:
                return cleaned
    return ""


def _split_sentences(text: str) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if p.strip()]


def _scoped_entries(
    entries: list[dict[str, Any]], work_hints: set[str]
) -> list[dict[str, Any]]:
    if not work_hints:
        return [e for e in entries if isinstance(e, dict)]
    return [e for e in entries if isinstance(e, dict) and entry_matches_work(e, work_hints)]


_SAME_PERSON = re.compile(
    rf"{NAME}\s+is\s+also\s+known\s+as\s+{ALIAS}",
    re.I,
)
_SAME_PERSON_COMMA = re.compile(
    rf"{NAME}\s*,\s*also\s+known\s+as\s+{ALIAS}",
    re.I,
)
_AKA = re.compile(
    rf"{NAME}\s+(?:\(|\[)?\s*aka\s+{ALIAS}",
    re.I,
)
# Fairytale / outside-world recognition (writer's framing — not a cast member).
_KNOWN_TO_WORLD = re.compile(
    rf"{NAME}\s+is\s+known\s+to\s+(?:the\s+)?"
    rf"(?:fairytale|fairy[- ]tale|wider|outside)\s+world(?:\s+at\s+large)?\s+as\s+"
    rf"(?:the\s+)?(.+?)(?:\.|$)",
    re.I,
)
_KNOWN_AS_PLAIN = re.compile(
    rf"{NAME}\s+is\s+known\s+as\s+(?:the\s+)?(.+?)(?:\.|$)",
    re.I,
)

# A is known BY B — B knows A (never reverse).
_KNOWN_BY = re.compile(
    rf"{NAME}\s+is\s+known\s+by\s+{NAME}\s+"
    rf"(?:as|by(?:\s+the\s+name(?:\s+of)?)?)\s+{ALIAS}",
    re.I,
)
# "X is known by the name Chroniker by the Cheshire Cat…"
_KNOWN_BY_THE_NAME = re.compile(
    rf"{NAME}\s+is\s+known\s+by\s+the\s+name(?:\s+of)?\s+"
    rf"(?:the\s+)?(.+?)"
    rf"\s+by\s+(?:the\s+)?{NAME}",
    re.I,
)
_KNOWN_BY_THE_NAME_PLAIN = re.compile(
    rf"{NAME}\s+is\s+known\s+by\s+the\s+name(?:\s+of)?\s+"
    rf"(?:the\s+)?(.+?)(?:\.|$)",
    re.I,
)
_KNOWS_AS = re.compile(
    rf"{NAME}\s+knows\s+{NAME}\s+(?:as|by(?:\s+the\s+name(?:\s+of)?)?)\s+{ALIAS}",
    re.I,
)

_SHARED_NAME = re.compile(
    rf"{NAME}\s+has\s+shared\s+"
    rf"(?:this\s+name(?:\s+of\s+{NAME}'s)?|(?:the\s+name\s+)?{ALIAS}|{NAME}'s\s+name)\s+"
    rf"with\s+people\s+\1\s+trusts",
    re.I,
)


def _clean_alias_phrase(raw: str) -> str:
    """Normalize 'Chroniker/the Chroniker' style alias phrases."""
    text = re.sub(r"\s+", " ", (raw or "").strip().rstrip(".,;:"))
    if not text:
        return ""
    # Prefer the first slash alternative when both name the same role.
    if "/" in text:
        left, right = [p.strip() for p in text.split("/", 1)]
        right = re.sub(r"^(?:the\s+)", "", right, flags=re.I).strip()
        left_core = re.sub(r"^(?:the\s+)", "", left, flags=re.I).strip()
        if left_core and right and left_core.lower() == right.lower():
            text = left_core
        elif left_core:
            text = left_core
    text = re.sub(r"^(?:the\s+)", "", text, flags=re.I).strip()
    return _clean_name(text) or text


def _parse_sentence(sentence: str) -> list[AliasFact]:
    s = (sentence or "").strip()
    if not s:
        return []
    facts: list[AliasFact] = []

    for pat in (_SAME_PERSON, _SAME_PERSON_COMMA, _AKA):
        m = pat.search(s)
        if m:
            left = _clean_name(m.group(1))
            alias = _pick_alias(m.group(2), m.group(3), m.group(4))
            if left and alias and not _names_match(left, alias):
                facts.append(AliasFact("same_person", left, alias=alias))
            return facts

    m = _KNOWN_TO_WORLD.search(s)
    if m:
        left = _clean_name(m.group(1))
        alias_raw = re.sub(r"\s+", " ", (m.group(2) or "").strip().rstrip("."))
        if left and alias_raw:
            facts.append(
                AliasFact(
                    "world_known",
                    left,
                    other="the fairytale world at large",
                    alias=alias_raw,
                )
            )
        return facts

    m = _KNOWN_BY.search(s)
    if m:
        subject = _clean_name(m.group(1))
        other = _clean_name(m.group(2))
        alias = _pick_alias(m.group(3), m.group(4), m.group(5))
        if subject and other and alias and not _names_match(subject, other):
            facts.append(AliasFact("known_to", subject, other=other, alias=alias))
        return facts

    m = _KNOWN_BY_THE_NAME.search(s)
    if m:
        subject = _clean_name(m.group(1))
        alias = _clean_alias_phrase(m.group(2) or "")
        other = _clean_name(m.group(3) or "")
        if subject and alias and other and not _names_match(subject, other):
            facts.append(AliasFact("known_to", subject, other=other, alias=alias))
            return facts
        if subject and alias and not _names_match(subject, alias):
            facts.append(AliasFact("same_person", subject, alias=alias))
            return facts

    m = _KNOWN_BY_THE_NAME_PLAIN.search(s)
    if m and " known by the name" in f" {s.lower()}":
        # Avoid stealing "known by NAME as ALIAS" which _KNOWN_BY handles.
        if not re.search(rf"\bknown\s+by\s+{NAME}\s+(?:as|by)\b", s, re.I):
            subject = _clean_name(m.group(1))
            alias = _clean_alias_phrase(m.group(2) or "")
            if subject and alias and not _names_match(subject, alias):
                facts.append(AliasFact("same_person", subject, alias=alias))
                return facts

    m = _KNOWS_AS.search(s)
    if m:
        other = _clean_name(m.group(1))
        subject = _clean_name(m.group(2))
        alias = _pick_alias(m.group(3), m.group(4), m.group(5))
        if subject and other and alias and not _names_match(subject, other):
            facts.append(AliasFact("known_to", subject, other=other, alias=alias))
        return facts

    m = _KNOWN_AS_PLAIN.search(s)
    if m and not re.search(r"\bknown\s+by\b", s, re.I):
        left = _clean_name(m.group(1))
        alias_raw = re.sub(r"\s+", " ", (m.group(2) or "").strip().rstrip("."))
        if left and alias_raw and len(alias_raw) >= 3:
            facts.append(AliasFact("same_person", left, alias=alias_raw))
        return facts

    m = _SHARED_NAME.search(s)
    if m:
        actor = _clean_name(m.group(1))
        owner = _clean_name(m.group(2)) if m.lastindex and m.lastindex >= 2 else ""
        alias = _pick_alias(
            m.group(3) if m.lastindex and m.lastindex >= 3 else None,
            m.group(4) if m.lastindex and m.lastindex >= 4 else None,
            m.group(5) if m.lastindex and m.lastindex >= 5 else None,
        )
        if not owner:
            owner = alias
        if actor and owner and not _names_match(actor, owner):
            facts.append(AliasFact("shared_name", owner, other=actor))
        return facts

    return facts


def collect_alias_facts(
    entries: list[dict[str, Any]], work_hints: set[str] | None = None
) -> list[AliasFact]:
    hints = work_hints or set()
    scope = _scoped_entries(entries, hints) if hints else entries
    facts: list[AliasFact] = []
    seen: set[tuple[str, str, str, str, str]] = set()
    for entry in scope:
        if not isinstance(entry, dict):
            continue
        for blob in (
            str(entry.get("body") or ""),
            str(entry.get("title") or ""),
        ):
            if not blob.strip():
                continue
            for sentence in _split_sentences(blob):
                for fact in _parse_sentence(sentence):
                    key = (
                        fact.kind,
                        _name_key(fact.subject),
                        _name_key(fact.other or ""),
                        _name_key(fact.alias or ""),
                        "",
                    )
                    if key in seen:
                        continue
                    seen.add(key)
                    facts.append(fact)
    return facts


def _linked_names(label: str, facts: list[AliasFact]) -> set[str]:
    changed = True
    names: set[str] = {label}
    while changed:
        changed = False
        for fact in facts:
            if fact.kind == "same_person" and fact.alias:
                if any(_names_match(n, fact.subject) for n in names):
                    if not any(_names_match(n, fact.alias) for n in names):
                        names.add(fact.alias)
                        changed = True
                elif any(_names_match(n, fact.alias) for n in names):
                    if not any(_names_match(n, fact.subject) for n in names):
                        names.add(fact.subject)
                        changed = True
            elif fact.kind == "known_to" and fact.other and fact.alias:
                # Alias only — the knower (other) is a different cast member.
                if any(_names_match(n, fact.subject) for n in names):
                    if not any(_names_match(n, fact.alias) for n in names):
                        names.add(fact.alias)
                        changed = True
                elif any(_names_match(n, fact.alias) for n in names):
                    if not any(_names_match(n, fact.subject) for n in names):
                        names.add(fact.subject)
                        changed = True
                # Do not expand through the knower: "known to Lord Tenebris as Chroniker"
                # must not treat Lord Tenebris as the same person as Etherei.
            elif fact.kind == "shared_name" and fact.other:
                if any(_names_match(n, fact.subject) for n in names):
                    if not any(_names_match(n, fact.other) for n in names):
                        names.add(fact.other)
                        changed = True
                elif any(_names_match(n, fact.other) for n in names):
                    if not any(_names_match(n, fact.subject) for n in names):
                        names.add(fact.subject)
                        changed = True
    return {_name_key(n) for n in names}


def expand_character_names(
    label: str,
    entries: list[dict[str, Any]],
    work_hints: set[str] | None = None,
) -> list[str]:
    """All name variants linked to this character in scoped notes."""
    hints = work_hints if work_hints is not None else extract_work_hints("", entries)
    facts = collect_alias_facts(entries, hints)
    linked = _linked_names(label, facts)
    ordered: list[str] = [label]
    seen = {_name_key(label)}
    for fact in facts:
        for candidate in (fact.subject, fact.other, fact.alias):
            if not candidate:
                continue
            if _name_key(candidate) in linked and _name_key(candidate) not in seen:
                seen.add(_name_key(candidate))
                ordered.append(candidate)
    return ordered


def expand_name_list(
    names: list[str],
    entries: list[dict[str, Any]],
    work_hints: set[str] | None = None,
) -> list[str]:
    hints = work_hints if work_hints is not None else extract_work_hints("", entries)
    out: list[str] = []
    seen: set[str] = set()
    for name in names:
        for expanded in expand_character_names(name, entries, hints):
            key = _name_key(expanded)
            if key in seen:
                continue
            seen.add(key)
            out.append(expanded)
    return out or names


def alias_reference_lines_for(
    label: str,
    entries: list[dict[str, Any]],
    work_hints: set[str] | None = None,
) -> list[str]:
    """Direction-correct cast-card lines about names and disclosure."""
    hints = work_hints if work_hints is not None else extract_work_hints("", entries)
    facts = collect_alias_facts(entries, hints)
    lines: list[str] = []
    seen: set[str] = set()

    def add(line: str) -> None:
        key = line.lower()[:120]
        if key in seen:
            return
        seen.add(key)
        lines.append(line)

    for fact in facts:
        if fact.kind == "same_person" and fact.alias:
            if _names_match(label, fact.subject):
                add(f"{fact.subject} is also known as {fact.alias}.")
            elif _names_match(label, fact.alias):
                add(f"{fact.alias} is also known as {fact.subject}.")

        elif fact.kind == "known_to" and fact.other and fact.alias:
            if _names_match(label, fact.subject):
                add(f"{fact.subject} is known to {fact.other} as {fact.alias}.")
            elif _names_match(label, fact.other):
                add(f"{fact.other} knows {fact.subject} as {fact.alias}.")
            elif _names_match(label, fact.alias):
                add(f"{fact.alias} is the name {fact.other} uses for {fact.subject}.")

        elif fact.kind == "world_known" and fact.alias:
            if _names_match(label, fact.subject):
                scope = fact.other or "the fairytale world at large"
                add(f"{fact.subject} is known to {scope} as {fact.alias}.")

        elif fact.kind == "shared_name" and fact.other:
            if _names_match(label, fact.subject) or _names_match(label, fact.other):
                add(
                    f"{fact.other} has shared {fact.subject}'s name with people "
                    f"{fact.other} trusts."
                )

    return lines
