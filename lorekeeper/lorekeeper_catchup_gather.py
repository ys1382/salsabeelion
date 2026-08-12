"""LoreKeeper — thin-draft / catch-up gather Ask (orientation brief).

Librarian only: restates what the writer already saved for a named work.
Not who-is, not leave-off alone, not write-next alone.
"""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_loose_ends import collect_loose_end_items, entry_is_planned
from lorekeeper_notes_vs_draft import (
    _claim_is_usable,
    _draft_corpus,
    _is_draft_entry,
    _near_dedupe_items,
    _normalize,
    _split_claims,
    _tidy_claim_line,
    _work_phrase,
)

MAX_CAST = 8
MAX_BEATS = 6
MAX_OPEN = 6
MAX_SCRAPS = 8
_MAX_LINE = 180

_CATCHUP_Q = re.compile(
    r"\b("
    r"catch[\s-]?me[\s-]?up|"
    r"catch[\s-]?up\s+(?:on|for|with)\s+(?:this\s+|my\s+|the\s+)?"
    r"(?:work|draft|notes?|story|project)|"
    r"catch[\s-]?up\s+gather|"
    r"what\s+have\s+i\s+got(?:\s+so\s+far)?|"
    r"what\s+do\s+i\s+already\s+have|"
    r"what\s+have\s+i\s+already\s+(?:got|saved|written|noted|gathered)|"
    r"what(?:'s|\s+is)\s+already\s+(?:here|saved|in\s+(?:my\s+)?notes?)|"
    r"remind\s+me\s+what\s+i\s+(?:have|got|already)|"
    r"reorient(?:\s+me)?(?:\s+on|\s+for|\s+with)?|"
    r"gather\s+what\s+i\s+(?:have|got|already)|"
    r"what\s+have\s+i\s+(?:got|saved)\s+for|"
    r"inventory\s+(?:of\s+)?(?:this\s+|my\s+)?(?:work|draft|notes?)|"
    r"orientation\s+(?:brief|pass)|"
    r"planning\s+brief\s+(?:for|on)\s+(?:this\s+|my\s+)?"
    r"(?:work|draft|story)|"
    r"what(?:'s|\s+is)\s+in\s+(?:this\s+|the\s+)?(?:work|silo)\s+so\s+far"
    r")\b",
    re.I,
)

_OPEN_Q_LINE = re.compile(
    r"(?:\?|\b(?:open\s*(?:question|q)?\s*:|unsure|not\s+sure(?:\s+yet)?|"
    r"tbd|unresolved|still\s+deciding|need\s+to\s+decide)\b)",
    re.I,
)

_CAST_TITLE_JUNK = frozenset(
    {
        "untitled",
        "untitled note",
        "note",
        "notes",
        "ideas",
        "random ideas",
        "scraps",
        "scrap",
        "planned",
        "todo",
        "fix",
        "draft",
        "main draft",
        "document",
        "page",
        "chapter",
        "prologue",
        "world",
        "setting",
        "plot",
        "beats",
        "outline",
        "open questions",
        "questions",
    }
)

_CAST_IDENTITY = re.compile(
    r"^\s*(?:character\s+[a-z0-9]+|[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,2})\s+"
    r"(?:is|are|was|were)\b",
    re.I,
)

_NAME_IN_TITLE = re.compile(
    r"^(?:character\s+[a-z0-9]+|[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,2})$"
)

_FOOTER = (
    "— Catch-up orientation from your notes and draft only. Nothing invented. "
    "Ask leave-off for latest plot position, or write-next for tasks."
)


def is_catchup_gather_question(question: str) -> bool:
    """Writer asked for a thin-draft / catch-up gather — not leave-off or write-next."""
    q = (question or "").strip()
    if not q or not _CATCHUP_Q.search(q):
        return False
    # Never steal locked / neighboring Ask shapes.
    from lorekeeper_character_summary import is_who_is_question
    from lorekeeper_loose_ends import is_flagged_fix_question, is_planned_gap_question
    from lorekeeper_notes_vs_draft import is_notes_not_in_draft_question
    from lorekeeper_question_routes import is_story_position_question
    from lorekeeper_writing_next import is_writing_next_task_list_question

    if is_story_position_question(q):
        return False
    if is_writing_next_task_list_question(q):
        return False
    if is_notes_not_in_draft_question(q):
        return False
    if is_planned_gap_question(q) or is_flagged_fix_question(q):
        return False
    if is_who_is_question(q):
        return False
    return True


def _clip(text: str, limit: int = _MAX_LINE) -> str:
    s = _tidy_claim_line(text)
    if len(s) <= limit:
        return s
    cut = s[: limit - 1].rsplit(" ", 1)[0].strip()
    return (cut or s[: limit - 1]).rstrip(".,;:") + "…"


def _title_looks_like_cast(title: str) -> bool:
    t = (title or "").strip()
    if not t or t.lower() in _CAST_TITLE_JUNK:
        return False
    if "/" in t or ":" in t:
        # "Cast / Mira" or "Mira: notes"
        tail = re.split(r"[/:]", t, maxsplit=1)[-1].strip()
        if tail and tail.lower() not in _CAST_TITLE_JUNK:
            t = tail
    if t.lower() in _CAST_TITLE_JUNK:
        return False
    if re.match(r"^character\s+[a-z0-9]+$", t, re.I):
        return True
    if _NAME_IN_TITLE.match(t) and len(t.split()) <= 3:
        return True
    return False


def _cast_label_from_title(title: str) -> str:
    t = (title or "").strip()
    if "/" in t or ":" in t:
        tail = re.split(r"[/:]", t, maxsplit=1)[-1].strip()
        if tail:
            return tail
    return t


def _collect_cast(entries: list[dict[str, Any]]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict) or _is_draft_entry(entry):
            continue
        eid = str(entry.get("id") or "")
        title = str(entry.get("title") or "").strip() or "Untitled"
        body = str(entry.get("body") or "").strip()
        label = ""
        blurb = ""
        if _title_looks_like_cast(title):
            label = _cast_label_from_title(title)
        claims = _split_claims(body) if body else []
        for claim in claims[:4]:
            if _CAST_IDENTITY.match(claim):
                if not label:
                    m = re.match(
                        r"^\s*((?:character\s+[a-z0-9]+|[A-Z][\w'-]*"
                        r"(?:\s+[A-Z][\w'-]*){0,2}))\b",
                        claim,
                        re.I,
                    )
                    label = m.group(1).strip() if m else label
                blurb = _clip(claim)
                break
        if not label:
            continue
        key = _normalize(label)
        if key in seen:
            continue
        seen.add(key)
        line = f"{label} — {blurb}" if blurb and _normalize(blurb) != key else label
        rows.append({"entryId": eid, "noteTitle": title, "line": _clip(line)})
        if len(rows) >= MAX_CAST:
            break
    return rows


def _collect_draft_beats(entries: list[dict[str, Any]]) -> list[dict[str, str]]:
    draft = _draft_corpus(entries).strip()
    if not draft:
        return []
    # Thin drafts: restatement of early sentences (orientation, not leave-off tail).
    chunks = _split_claims(draft)
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    draft_id = ""
    for entry in entries:
        if isinstance(entry, dict) and _is_draft_entry(entry):
            draft_id = str(entry.get("id") or "")
            break
    for claim in chunks:
        cleaned = _clip(claim)
        if not _claim_is_usable(cleaned) and len(cleaned) < 24:
            continue
        key = _normalize(cleaned)[:120]
        if not key or key in seen:
            continue
        seen.add(key)
        rows.append(
            {
                "entryId": draft_id,
                "noteTitle": "Main draft",
                "line": cleaned,
            }
        )
        if len(rows) >= MAX_BEATS:
            break
    return rows


def _collect_open_questions(entries: list[dict[str, Any]]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict) or _is_draft_entry(entry):
            continue
        eid = str(entry.get("id") or "")
        title = str(entry.get("title") or "").strip() or "Untitled"
        body = str(entry.get("body") or "").strip()
        title_is_open = bool(
            re.search(r"\b(open\s+questions?|questions?|unresolved)\b", title, re.I)
        )
        for claim in _split_claims(body) if body else []:
            if not (title_is_open or _OPEN_Q_LINE.search(claim)):
                continue
            cleaned = _clip(claim)
            if len(cleaned) < 8:
                continue
            key = _normalize(cleaned)[:120]
            if key in seen:
                continue
            seen.add(key)
            rows.append({"entryId": eid, "noteTitle": title, "line": cleaned})
            if len(rows) >= MAX_OPEN:
                return rows
        if title_is_open and not body:
            key = _normalize(title)
            if key not in seen:
                seen.add(key)
                rows.append({"entryId": eid, "noteTitle": title, "line": title})
    return rows


def _collect_planned_scraps(entries: list[dict[str, Any]]) -> list[dict[str, str]]:
    planned = collect_loose_end_items(entries, "planned")
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in planned:
        line = _clip(str(row.get("line") or ""))
        if not line:
            continue
        key = _normalize(line)[:120]
        if key in seen:
            continue
        seen.add(key)
        rows.append(
            {
                "entryId": str(row.get("entryId") or ""),
                "noteTitle": str(row.get("noteTitle") or "Note"),
                "line": line,
            }
        )
        if len(rows) >= MAX_SCRAPS:
            return rows

    # Short leftover scraps from notes titled scraps/ideas (not cast cards).
    for entry in entries:
        if not isinstance(entry, dict) or _is_draft_entry(entry):
            continue
        title = str(entry.get("title") or "").strip()
        low = title.lower()
        if not any(k in low for k in ("scrap", "idea", "random", "jumble", "todo")):
            if not entry_is_planned(entry):
                continue
        eid = str(entry.get("id") or "")
        body = str(entry.get("body") or "").strip()
        for claim in (_split_claims(body) if body else [title])[:4]:
            cleaned = _clip(claim)
            if not cleaned or len(cleaned) < 10:
                continue
            if _CAST_IDENTITY.match(cleaned):
                continue
            key = _normalize(cleaned)[:120]
            if key in seen:
                continue
            seen.add(key)
            rows.append({"entryId": eid, "noteTitle": title or "Note", "line": cleaned})
            if len(rows) >= MAX_SCRAPS:
                return rows
    return rows


def collect_catchup_gather(
    entries: list[dict[str, Any]],
) -> tuple[dict[str, list[dict[str, str]]], bool, bool]:
    """Return sections + has_notes + has_draft. Never invents."""
    notes = [
        e
        for e in entries
        if isinstance(e, dict)
        and not _is_draft_entry(e)
        and (
            str(e.get("body") or "").strip()
            or str(e.get("title") or "").strip()
        )
    ]
    has_notes = bool(notes)
    has_draft = bool(_draft_corpus(entries).strip())
    sections = {
        "cast": _collect_cast(entries),
        "beats": _collect_draft_beats(entries),
        "open": _collect_open_questions(entries),
        "scraps": _near_dedupe_items(_collect_planned_scraps(entries))[:MAX_SCRAPS],
    }
    return sections, has_notes, has_draft


def _section_block(heading: str, items: list[dict[str, str]], empty: str) -> str:
    lines = [heading]
    if items:
        for row in items:
            lines.append(f"• {_clip(str(row.get('line') or ''))}")
    else:
        lines.append(f"• {empty}")
    return "\n".join(lines)


def compose_catchup_gather(
    work_hints: set[str],
    sections: dict[str, list[dict[str, str]]],
    *,
    has_notes: bool,
    has_draft: bool,
) -> str:
    work = _work_phrase(work_hints)
    cast = sections.get("cast") or []
    beats = sections.get("beats") or []
    open_qs = sections.get("open") or []
    scraps = sections.get("scraps") or []
    any_material = bool(cast or beats or open_qs or scraps)

    head = (
        f"Catch-up for {work} — what you already have saved "
        f"(notes + draft; nothing invented):\n"
    )
    if not has_notes and not has_draft:
        return (
            f"Catch-up for {work}: nothing saved yet for this work — "
            f"no notes and no main draft to gather.\n\n{_FOOTER}"
        )
    if not any_material:
        bits = []
        if has_notes:
            bits.append("notes")
        if has_draft:
            bits.append("a draft")
        have = " and ".join(bits) if bits else "material"
        return (
            f"Catch-up for {work}: you have {have}, but nothing clear enough "
            f"to list as cast, draft beats, open questions, or planned scraps yet. "
            f"Add short cast notes, beat lines, `open:` questions, or `planned:` scraps.\n\n"
            f"{_FOOTER}"
        )

    parts = [
        head,
        _section_block(
            "Cast",
            cast,
            "No clear cast notes yet.",
        ),
        "",
        _section_block(
            "Draft so far",
            beats,
            "No main draft prose yet."
            if not has_draft
            else "Draft is present but too thin to restate as clear beats.",
        ),
        "",
        _section_block(
            "Open questions",
            open_qs,
            "None marked (use ? or `open:` in a note).",
        ),
        "",
        _section_block(
            "Planned scraps",
            scraps,
            "None tagged planned / scraps yet.",
        ),
        "",
        _FOOTER,
    ]
    return "\n".join(parts).strip()


def answer_catchup_gather(
    entries: list[dict[str, Any]],
    *,
    work_hints: set[str],
    question: str = "",
) -> tuple[str, list[str]]:
    """Work-scoped catch-up gather. question kept for API symmetry."""
    _ = question
    sections, has_notes, has_draft = collect_catchup_gather(entries)
    answer = compose_catchup_gather(
        work_hints, sections, has_notes=has_notes, has_draft=has_draft
    )
    source_ids: list[str] = []
    seen: set[str] = set()
    for key in ("cast", "beats", "open", "scraps"):
        for row in sections.get(key) or []:
            eid = str(row.get("entryId") or "").strip()
            if eid and eid not in seen:
                seen.add(eid)
                source_ids.append(eid)
            if len(source_ids) >= 12:
                break
    return answer, source_ids
