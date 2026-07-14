"""LoreKeeper — prologue / chapter section scoping for Ask."""
from __future__ import annotations

import re
from typing import Any

_PROLOGUE_Q = re.compile(r"\bprologue\b", re.I)
_CHAPTER_Q = re.compile(r"\bchapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b", re.I)
_ACT_Q = re.compile(r"\bact\s+(\d+|one|two|three)\b", re.I)
_CHAPTER_HEADING = re.compile(
    r"(?:^|\n)\s*chapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b",
    re.I,
)

_WORD_NUM = {
    "one": "1",
    "two": "2",
    "three": "3",
    "four": "4",
    "five": "5",
    "six": "6",
    "seven": "7",
    "eight": "8",
    "nine": "9",
    "ten": "10",
}

_SECTION_SCOPE_PHRASE = re.compile(
    r"^(?:the\s+)?(?:prologue|epilogue|preface|introduction|"
    r"chapter\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)|"
    r"act\s+(?:\d+|one|two|three))(?:\s+of\s+.+)?\s*$",
    re.I,
)


def is_section_scope_phrase(phrase: str) -> bool:
    """True when 'in the Prologue' is a section scope, not a work title."""
    cleaned = re.sub(r"\s+", " ", (phrase or "").strip().lower().rstrip("?.!"))
    return bool(cleaned and _SECTION_SCOPE_PHRASE.match(cleaned))


def work_hint_from_section_phrase(phrase: str) -> str | None:
    """When phrase is 'the prologue of Smoke and Mirrors', return the work tag."""
    cleaned = re.sub(r"\s+", " ", (phrase or "").strip().lower().rstrip("?.!"))
    m = re.search(r"\bof\s+(.+)$", cleaned)
    if not m:
        return None
    work = m.group(1).strip()
    return work if len(work) > 2 else None


def extract_section_hints(question: str) -> dict[str, str]:
    q = question or ""
    hints: dict[str, str] = {}
    if _PROLOGUE_Q.search(q):
        hints["section"] = "prologue"
        hints["label"] = "the prologue"
    m = _CHAPTER_Q.search(q)
    if m:
        num = _WORD_NUM.get(m.group(1).lower(), m.group(1))
        hints["section"] = "chapter"
        hints["chapter"] = num
        hints["label"] = f"chapter {num}"
    m = _ACT_Q.search(q)
    if m and "section" not in hints:
        num = _WORD_NUM.get(m.group(1).lower(), m.group(1))
        hints["section"] = "act"
        hints["act"] = num
        hints["label"] = f"act {num}"
    return hints


def _entry_blob(entry: dict[str, Any]) -> str:
    title = str(entry.get("title") or "")
    body = str(entry.get("body") or "")
    tags = " ".join(str(t) for t in (entry.get("tags") or []))
    return f"{title} {tags} {body}".lower()


def _mentions_prologue(blob: str) -> bool:
    return bool(re.search(r"\bprologue\b", blob, re.I))


def _chapter_num(raw: str) -> int:
    raw = (raw or "").lower()
    if raw.isdigit():
        return int(raw)
    if raw in _WORD_NUM:
        return int(_WORD_NUM[raw])
    return 999


def _mentions_chapter(blob: str, num: str) -> bool:
    if re.search(rf"\bchapter\s+{re.escape(num)}\b", blob, re.I):
        return True
    words = {k for k, v in _WORD_NUM.items() if v == num}
    for w in words:
        if re.search(rf"\bchapter\s+{w}\b", blob, re.I):
            return True
    return False


def _mentions_later_chapter(blob: str, after: int = 1) -> bool:
    for m in _CHAPTER_Q.finditer(blob):
        if _chapter_num(m.group(1)) > after:
            return True
    return False


def _prologue_near_start(body: str, window: int = 1500) -> bool:
    head = (body or "")[:window]
    return bool(_PROLOGUE_Q.search(head))


def _first_chapter_one_pos(body: str) -> int | None:
    """Character offset where chapter 1+ begins, or None."""
    best: int | None = None
    for m in _CHAPTER_HEADING.finditer(body or ""):
        if _chapter_num(m.group(1)) >= 1:
            pos = m.start()
            if best is None or pos < best:
                best = pos
    return best


def _chunk_page_index(entry: dict[str, Any]) -> int | None:
    eid = str(entry.get("id") or "")
    if "#p" not in eid:
        return None
    try:
        return int(eid.split("#p", 1)[1])
    except ValueError:
        return None


def _group_document_entries(
    entries: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    """Group HTML draft chunks by parent document; pass through other entries."""
    groups: dict[str, dict[str, Any]] = {}
    passthrough: list[dict[str, Any]] = []

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        if "#p" in eid:
            parent = str(entry.get("parentDocId") or eid.split("#p", 1)[0])
            bucket = groups.setdefault(parent, {"full": None, "chunks": []})
            idx = _chunk_page_index(entry)
            if idx is not None:
                bucket["chunks"].append((idx, entry))
            continue
        if str(entry.get("kind") or "") == "document" and eid:
            bucket = groups.setdefault(eid, {"full": None, "chunks": []})
            bucket["full"] = entry
            continue
        passthrough.append(entry)

    return groups, passthrough


def _full_body_for_group(group: dict[str, Any]) -> str:
    full = group.get("full")
    if isinstance(full, dict):
        body = str(full.get("body") or "").strip()
        if body:
            return body
    chunks = group.get("chunks") or []
    if not chunks:
        return ""
    ordered = sorted(chunks, key=lambda row: row[0])
    return "\n\n".join(str(row[1].get("body") or "").strip() for row in ordered if row[1])


def _document_has_prologue(group: dict[str, Any], full_body: str) -> bool:
    if _prologue_near_start(full_body):
        return True
    full_entry = group.get("full")
    if isinstance(full_entry, dict):
        blob = _entry_blob(full_entry)
        if _mentions_prologue(blob) and not _mentions_later_chapter(
            str(full_entry.get("body") or ""), after=0
        ):
            return True
    return False


def _prologue_entries_for_document(group: dict[str, Any]) -> list[dict[str, Any]]:
    """All draft chunks from the start through the prologue — until chapter 1."""
    full_body = _full_body_for_group(group)
    if not _document_has_prologue(group, full_body):
        return []

    chunks: list[tuple[int, dict[str, Any]]] = sorted(
        group.get("chunks") or [], key=lambda row: row[0]
    )
    if chunks:
        selected: list[dict[str, Any]] = []
        for _idx, chunk in chunks:
            chunk_body = str(chunk.get("body") or "")
            if _mentions_later_chapter(chunk_body, after=0):
                break
            selected.append(chunk)
        if selected:
            merged_body = "\n\n".join(
                str(entry.get("body") or "").strip() for entry in selected if entry.get("body")
            ).strip()
            if len(selected) > 1 and merged_body:
                parent = str(selected[0].get("parentDocId") or "")
                if not parent and selected[0].get("id"):
                    eid = str(selected[0]["id"])
                    parent = eid.split("#p", 1)[0] if "#p" in eid else eid
                title = str(selected[0].get("title") or "Draft")
                merged: dict[str, Any] = {
                    **selected[0],
                    "id": f"{parent}#prologue-slice" if parent else "prologue-slice",
                    "title": f"{title} / Prologue",
                    "body": merged_body,
                }
                return [merged, *selected]
            return selected

    cut = _first_chapter_one_pos(full_body)
    slice_body = full_body[:cut].strip() if cut is not None else full_body.strip()
    if not slice_body:
        return []

    full_entry = group.get("full")
    if isinstance(full_entry, dict):
        return [{**full_entry, "body": slice_body}]
    return [
        {
            "id": "prologue-slice",
            "title": "Prologue",
            "body": slice_body,
            "tags": [],
            "kind": "document",
        }
    ]


def entry_matches_section(entry: dict[str, Any], hints: dict[str, str]) -> bool:
    if not hints:
        return True
    blob = _entry_blob(entry)
    section = hints.get("section") or ""
    if section == "prologue":
        if _mentions_prologue(blob) and not _mentions_later_chapter(blob, after=0):
            return True
        return False
    if section == "chapter":
        num = hints.get("chapter") or "1"
        return _mentions_chapter(blob, num)
    if section == "act":
        num = hints.get("act") or "1"
        return bool(re.search(rf"\bact\s+({re.escape(num)}|{_num_word(num)})\b", blob, re.I))
    return True


def _num_word(num: str) -> str:
    for w, n in _WORD_NUM.items():
        if n == num:
            return w
    return num


def filter_entries_by_section(
    entries: list[dict[str, Any]], hints: dict[str, str]
) -> list[dict[str, Any]]:
    if not hints:
        return entries

    section = hints.get("section") or ""
    if section == "prologue":
        groups, passthrough = _group_document_entries(entries)
        matched: list[dict[str, Any]] = []
        seen_ids: set[str] = set()

        for _doc_id, group in groups.items():
            for entry in _prologue_entries_for_document(group):
                eid = str(entry.get("id") or "")
                if eid and eid in seen_ids:
                    continue
                if eid:
                    seen_ids.add(eid)
                matched.append(entry)

        for entry in passthrough:
            if entry_matches_section(entry, hints):
                eid = str(entry.get("id") or "")
                if eid and eid in seen_ids:
                    continue
                if eid:
                    seen_ids.add(eid)
                matched.append(entry)

        return matched

    return [e for e in entries if isinstance(e, dict) and entry_matches_section(e, hints)]


def format_section_nothing_saved(work_hints: set[str], hints: dict[str, str]) -> str:
    label = hints.get("label") or "that section"
    where = ""
    if work_hints:
        where = f" in {next(iter(work_hints))}"
    if hints.get("section") == "prologue":
        return (
            f"I looked through your saved draft{where} and didn't find a prologue section — "
            f"no “Prologue” near the start of the document, and no pages scoped before Chapter 1."
        )
    return (
        f"I looked through your saved notes{where} and didn't find material for {label}. "
        f"Try a section heading in the draft (e.g. “Chapter 3”) or in the page title."
    )
