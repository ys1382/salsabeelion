"""LoreKeeper — which notes belong on a document / work view.

Visible when working on work W:
- notes tagged or linked to W
- unassigned / idk notes, unless they rule out W
Hidden: notes that belong to a different work.
"""
from __future__ import annotations

import re
from typing import Any

_IDK_TAG = re.compile(
    r"^(?:"
    r"idk(?:\s+which\s+work(?:\s+this(?:\s+(?:is|belongs(?:\s+to)?))?)?)?|"
    r"unassigned|"
    r"unknown(?:\s+work)?|"
    r"no\s+work|"
    r"any\s+work|"
    r"tbd(?:\s+work)?"
    r")\.?$",
    re.I,
)

_IDK_PHRASE = re.compile(
    r"\b(?:"
    r"idk\s+which\s+work|"
    r"don'?t\s+know\s+which\s+work|"
    r"not\s+sure\s+which\s+work|"
    r"unassigned|"
    r"no\s+specific\s+work|"
    r"which\s+work\s+this\s+(?:belongs|will\s+belong)\s+to"
    r")\b",
    re.I,
)

_NOT_TAG = re.compile(r"^not\s*:\s*(.+)$", re.I)

_EXCLUDE_PHRASE = re.compile(
    r"(?:"
    r"doesn'?t\s+(?:belong|fit)\s+(?:in|to)|"
    r"does\s+not\s+(?:belong|fit)\s+(?:in|to)|"
    r"won'?t\s+be\s+in|"
    r"will\s+not\s+be\s+in|"
    r"not\s+for|"
    r"not\s+in|"
    r"exclude(?:d)?\s+from|"
    r"rules?\s+out"
    r")\s+(.+?)(?:[.!?\n]|$)",
    re.I,
)


def normalize_work_key(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", (text or "").strip().lower())
    return re.sub(r"['']s\b", "", cleaned).replace("'", "").replace("’", "")


def _entry_blob(entry: dict[str, Any]) -> str:
    return f"{entry.get('title') or ''}\n{entry.get('body') or ''}"


def _concrete_work_tags(entry: dict[str, Any]) -> list[str]:
    """Work titles on the note — skips idk markers and not: exclusions."""
    out: list[str] = []
    for raw in entry.get("tags") or []:
        tag = str(raw or "").strip()
        if not tag:
            continue
        if _NOT_TAG.match(tag):
            continue
        if _IDK_TAG.match(tag):
            continue
        out.append(tag)
    return out


def note_is_unassigned(entry: dict[str, Any]) -> bool:
    if not isinstance(entry, dict):
        return False
    if _concrete_work_tags(entry):
        return False
    # No concrete work tag: empty, idk markers, and/or only not: exclusions.
    tags = [str(t).strip() for t in (entry.get("tags") or []) if str(t).strip()]
    if not tags:
        return True
    if any(_IDK_TAG.match(t) for t in tags):
        return True
    if all(_NOT_TAG.match(t) for t in tags):
        return True
    if _IDK_PHRASE.search(_entry_blob(entry)):
        return True
    return True


def note_excludes_work(entry: dict[str, Any], work_title: str) -> bool:
    work = normalize_work_key(work_title)
    if not work or not isinstance(entry, dict):
        return False

    for raw in entry.get("tags") or []:
        tag = str(raw or "").strip()
        m = _NOT_TAG.match(tag)
        if m and normalize_work_key(m.group(1)) == work:
            return True

    blob = _entry_blob(entry)
    for m in _EXCLUDE_PHRASE.finditer(blob):
        candidate = normalize_work_key(m.group(1))
        if not candidate:
            continue
        if candidate == work or work in candidate or candidate in work:
            return True
    return False


def note_belongs_to_work(
    entry: dict[str, Any],
    work_title: str,
    *,
    document_id: str = "",
) -> bool:
    if not isinstance(entry, dict):
        return False
    doc_id = str(document_id or "").strip()
    if doc_id and str(entry.get("linkedDocId") or "").strip() == doc_id:
        return True

    work = normalize_work_key(work_title)
    if not work:
        return False

    for tag in _concrete_work_tags(entry):
        if normalize_work_key(tag) == work:
            return True

    # Soft match: work name in note title (same spirit as entry_matches_work).
    title = normalize_work_key(str(entry.get("title") or ""))
    title_base = title.split(" / ")[0].strip()
    if work and (work in title or work in title_base):
        return True
    return False


def note_belongs_to_other_work(entry: dict[str, Any], work_title: str) -> bool:
    """Has a concrete work assignment that is not the current work."""
    if not isinstance(entry, dict):
        return False
    work = normalize_work_key(work_title)
    tags = _concrete_work_tags(entry)
    if not tags:
        return False
    if not work:
        return True
    return all(normalize_work_key(t) != work for t in tags)


def note_visible_for_work(
    entry: dict[str, Any],
    work_title: str,
    *,
    document_id: str = "",
) -> bool:
    """Sidebar / work-scoped Ask membership."""
    if not isinstance(entry, dict):
        return False
    if note_belongs_to_work(entry, work_title, document_id=document_id):
        return True
    if note_belongs_to_other_work(entry, work_title):
        return False
    if note_is_unassigned(entry):
        return not note_excludes_work(entry, work_title)
    return False


def filter_entries_visible_for_work(
    entries: list[dict[str, Any]],
    work_title: str,
    *,
    document_id: str = "",
) -> list[dict[str, Any]]:
    work = (work_title or "").strip()
    if not work and not document_id:
        return [e for e in entries if isinstance(e, dict)]
    return [
        e
        for e in entries
        if isinstance(e, dict)
        and note_visible_for_work(e, work, document_id=document_id)
    ]
