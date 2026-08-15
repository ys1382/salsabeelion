"""Note-vs-note fact compare — librarian only, no winner, no inventing.

Shows two of the writer's notes when they disagree on saved spouse or
cast-role facts. Mentions the main draft when it contradicts those notes.
Skips planned / planned-later notes in the usual compare.
"""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_cast_roles import extract_explicit_cast_role
from lorekeeper_inference import _is_draft_entry
from lorekeeper_loose_ends import entry_is_planned
from lorekeeper_relations import _fact_matches_character, extract_relationships

_PRO_ROLES = frozenset({"protagonist", "hero", "deuteragonist", "main character"})
_ANTI_ROLES = frozenset({"antagonist", "villain"})
_ROLE_WORD = re.compile(
    r"\b(protagonist|antagonist|villain|hero|deuteragonist|main character)\b",
    re.I,
)
_CHAR_LABEL = re.compile(r"\bCharacter\s+[A-Z0-9]+\b", re.I)

NOT_IN_DRAFT_LINE = "These notes are not in the main draft yet."
FOOTER = "— Pulled from your notes only. Nothing invented."
DRAFT_VS_NOTES_DRAFT_LABEL = "This is what the main draft says:"
DRAFT_VS_NOTES_NOTES_LABEL = "This is what your notes say:"


def _title_of(entry: dict[str, Any]) -> str:
    title = str(entry.get("title") or "").strip()
    return title or "Untitled"


def _display_name(raw: str, label: str) -> str:
    name = re.sub(r"\s+", " ", (raw or "").strip())
    if not name:
        return label
    m = re.fullmatch(r"character\s+([a-z0-9]+)", name, re.I)
    if m:
        return f"Character {m.group(1).upper()}"
    if name.lower() == label.lower():
        return label
    return name


def _role_bucket(role: str) -> str | None:
    key = (role or "").strip().lower()
    if key in _PRO_ROLES:
        return "pro"
    if key in _ANTI_ROLES:
        return "anti"
    return None


def _role_article(role: str) -> str:
    word = (role or "").strip().lower()
    if word in {"antagonist", "protagonist"} or word[:1] in "aeiou":
        return "the"
    return "the"


def _spouse_claim(label: str, partner: str) -> str:
    return f"{label} is married to {_display_name(partner, partner)}"


def _role_claim(label: str, role: str) -> str:
    word = (role or "").strip().lower() or "cast member"
    return f"{label} is {_role_article(word)} {word}"


def _collect_entry_facts(
    label: str,
    entry: dict[str, Any],
) -> list[dict[str, str]]:
    """Spouse and pro/anti role facts from one entry — writer's words only."""
    if not isinstance(entry, dict):
        return []
    body = str(entry.get("body") or "")
    title = str(entry.get("title") or "")
    if not body.strip() and not title.strip():
        return []
    blob = f"{title}\n{body}"
    out: list[dict[str, str]] = []
    seen: set[str] = set()

    def add(kind: str, value: str, claim: str) -> None:
        value_key = value.strip().lower()
        if not value_key:
            return
        key = f"{kind}|{value_key}"
        if key in seen:
            return
        seen.add(key)
        out.append({"kind": kind, "value": value_key, "claim": claim})

    for fact in extract_relationships(body, title):
        if not _fact_matches_character(fact, label):
            continue
        if fact.get("kind") != "spouse":
            continue
        a = str(fact.get("a") or "")
        b = str(fact.get("b") or "")
        partner = ""
        if a.lower() == label.lower():
            partner = b
        elif b.lower() == label.lower():
            partner = a
        if partner:
            add("spouse", partner, _spouse_claim(label, partner))

    role_line = extract_explicit_cast_role(label, blob)
    if role_line:
        m = _ROLE_WORD.search(role_line)
        if m:
            word = m.group(1).lower()
            bucket = _role_bucket(word)
            if bucket:
                add("role", bucket, _role_claim(label, word))
    return out


def _partition_entries(
    entries: list[dict[str, Any]],
    *,
    include_planned_notes: bool,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    notes: list[dict[str, Any]] = []
    drafts: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if _is_draft_entry(entry):
            drafts.append(entry)
            continue
        if not include_planned_notes and entry_is_planned(entry):
            continue
        if include_planned_notes and not entry_is_planned(entry):
            continue
        notes.append(entry)
    return notes, drafts


def _sides_for_kind(
    label: str,
    entries: list[dict[str, Any]],
    kind: str,
) -> dict[str, list[dict[str, str]]]:
    grouped: dict[str, list[dict[str, str]]] = {}
    for entry in entries:
        eid = str(entry.get("id") or "")
        title = _title_of(entry)
        for fact in _collect_entry_facts(label, entry):
            if fact["kind"] != kind:
                continue
            side = {
                "id": eid,
                "title": title,
                "claim": fact["claim"],
                "value": fact["value"],
            }
            grouped.setdefault(fact["value"], []).append(side)
    return grouped


def _first_side(grouped: dict[str, list[dict[str, str]]]) -> dict[str, str] | None:
    for sides in grouped.values():
        if sides:
            return sides[0]
    return None


def _unique_sides(
    grouped: dict[str, list[dict[str, str]]], *, limit: int = 3
) -> list[dict[str, str]]:
    """One side per distinct value, in a stable order."""
    picked: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    for value in sorted(grouped.keys()):
        for side in grouped[value]:
            sid = side.get("id") or ""
            if sid and sid in seen_ids:
                continue
            if sid:
                seen_ids.add(sid)
            picked.append(side)
            break
        if len(picked) >= limit:
            break
    return picked


def _draft_claim_for_kind(
    label: str, drafts: list[dict[str, Any]], kind: str
) -> str | None:
    grouped = _sides_for_kind(label, drafts, kind)
    if not grouped:
        return None
    # One representative claim — do not list every chapter.
    side = _first_side(grouped)
    return side["claim"] if side else None


def _draft_values(label: str, drafts: list[dict[str, Any]], kind: str) -> set[str]:
    return set(_sides_for_kind(label, drafts, kind).keys())


def _side_sentence(which: str, title: str, claim: str) -> str:
    text = (claim or "").strip().rstrip(".")
    safe_title = (title or "Untitled").strip() or "Untitled"
    return f"{which} (“{safe_title}”) says {text}."


def _draft_sentence(claim: str) -> str:
    text = (claim or "").strip().rstrip(".")
    return f"The main draft says {text}."


def build_note_compare(
    label: str,
    entries: list[dict[str, Any]],
    *,
    include_planned_notes: bool = False,
) -> dict[str, Any]:
    """Structured note-vs-note (and optional draft) facts for one character."""
    notes, drafts = _partition_entries(
        entries, include_planned_notes=include_planned_notes
    )
    rows: list[dict[str, Any]] = []
    source_ids: list[str] = []
    seen_ids: set[str] = set()

    def take_id(sid: str) -> None:
        if sid and sid not in seen_ids:
            seen_ids.add(sid)
            source_ids.append(sid)

    for kind in ("spouse", "role"):
        note_grouped = _sides_for_kind(label, notes, kind)
        if not note_grouped:
            continue
        note_values = set(note_grouped.keys())
        notes_disagree = len(note_values) > 1
        draft_vals = _draft_values(label, drafts, kind)
        draft_claim = _draft_claim_for_kind(label, drafts, kind)
        draft_contradicts = bool(draft_vals) and draft_vals != note_values
        if not notes_disagree and not draft_contradicts:
            continue
        sides = _unique_sides(note_grouped, limit=3)
        if not notes_disagree:
            sides = sides[:1]
        for side in sides:
            take_id(str(side.get("id") or ""))
        if draft_contradicts or (notes_disagree and draft_vals):
            for entry in drafts:
                take_id(str(entry.get("id") or ""))
        rows.append(
            {
                "kind": kind,
                "sides": sides,
                "notes_disagree": notes_disagree,
                "draft_claim": draft_claim if (draft_contradicts or draft_vals) else None,
                "draft_contradicts": draft_contradicts,
                "not_in_draft": notes_disagree and not draft_vals,
            }
        )
    return {"label": label, "rows": rows, "source_ids": source_ids[:8]}


def compose_note_compare_lines(
    label: str,
    entries: list[dict[str, Any]],
    *,
    mention_not_in_draft: bool = True,
    include_planned_notes: bool = False,
) -> list[str]:
    """Body lines only — no winner, no scolding, no draft-vs-notes dual labels."""
    built = build_note_compare(
        label, entries, include_planned_notes=include_planned_notes
    )
    lines: list[str] = []
    which_cycle = ("This note", "That note", "Another note")
    for row in built["rows"]:
        sides = row.get("sides") or []
        for i, side in enumerate(sides):
            which = which_cycle[min(i, len(which_cycle) - 1)]
            lines.append(
                _side_sentence(which, str(side.get("title") or ""), str(side.get("claim") or ""))
            )
        if row.get("draft_contradicts") and row.get("draft_claim"):
            lines.append(_draft_sentence(str(row["draft_claim"])))
        elif mention_not_in_draft and row.get("not_in_draft"):
            if NOT_IN_DRAFT_LINE not in lines:
                lines.append(NOT_IN_DRAFT_LINE)
    return lines


def compose_note_compare_answer(
    label: str,
    entries: list[dict[str, Any]],
    *,
    mention_not_in_draft: bool = True,
) -> tuple[str, list[str]]:
    """Ask answer for discrepancy / audit questions."""
    built = build_note_compare(label, entries, include_planned_notes=False)
    body = compose_note_compare_lines(
        label,
        entries,
        mention_not_in_draft=mention_not_in_draft,
        include_planned_notes=False,
    )
    heading = f"{label} — from your notes:\n"
    if body:
        text = heading + "\n".join(body) + "\n\n" + FOOTER
    else:
        text = (
            heading
            + "No clear disagreements between your notes (on marriage or cast role).\n\n"
            + FOOTER
        )
    return text, list(built.get("source_ids") or [])


def _planned_character_labels(entries: list[dict[str, Any]]) -> list[str]:
    labels: list[str] = []
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        blob = f"{entry.get('title') or ''}\n{entry.get('body') or ''}"
        for match in _CHAR_LABEL.finditer(blob):
            raw = match.group(0)
            m = re.fullmatch(r"character\s+([a-z0-9]+)", raw, re.I)
            name = f"Character {m.group(1).upper()}" if m else raw
            key = name.lower()
            if key not in seen:
                seen.add(key)
                labels.append(name)
        for fact in extract_relationships(
            str(entry.get("body") or ""), str(entry.get("title") or "")
        ):
            for part in (fact.get("a"), fact.get("b")):
                name = _display_name(str(part or ""), str(part or ""))
                key = name.lower()
                if name and key not in seen:
                    seen.add(key)
                    labels.append(name)
    return labels[:8]


def compose_planned_vs_draft_mentions(entries: list[dict[str, Any]]) -> str:
    """Draft contradictions against planned notes — never 'not in the main draft'."""
    planned, drafts = _partition_entries(entries, include_planned_notes=True)
    if not planned or not drafts:
        return ""
    lines: list[str] = []
    seen: set[str] = set()
    for label in _planned_character_labels(planned):
        for row_line in compose_note_compare_lines(
            label,
            planned + drafts,
            mention_not_in_draft=False,
            include_planned_notes=True,
        ):
            if row_line == NOT_IN_DRAFT_LINE:
                continue
            if DRAFT_VS_NOTES_DRAFT_LABEL in row_line or DRAFT_VS_NOTES_NOTES_LABEL in row_line:
                continue
            if not row_line.lower().startswith("the main draft says"):
                continue
            key = row_line.lower()
            if key in seen:
                continue
            seen.add(key)
            lines.append(row_line)
    return "\n".join(lines)


def splice_before_footer(answer: str, extra: str) -> str:
    extra = (extra or "").strip()
    if not extra:
        return answer
    text = (answer or "").rstrip()
    marker = "\n—"
    idx = text.rfind(marker)
    if idx == -1:
        return text + "\n\n" + extra
    return text[:idx].rstrip() + "\n\n" + extra + "\n" + text[idx + 1 :]
