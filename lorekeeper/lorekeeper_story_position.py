"""LoreKeeper — where the story stands / where I left off (draft tail)."""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_character_summary import _entries_for_work, _split_sentences
from lorekeeper_character_compose import work_title_from_hints
from lorekeeper_inference import (
    _is_person_name,
    _name_has_character_signal,
    named_characters_in_scene_text,
)
from lorekeeper_reliability import extract_work_hints

_PLANNING_NOTE = re.compile(
    r"\b(i think|todo|fix later|planning note|not sure yet)\b", re.I
)


def _page_index(entry: dict[str, Any]) -> int:
    eid = str(entry.get("id") or "")
    if "#p" not in eid:
        return 0
    try:
        return int(eid.split("#p", 1)[1])
    except ValueError:
        return 0


def _parent_doc_id(entry: dict[str, Any]) -> str:
    eid = str(entry.get("id") or "")
    parent = str(entry.get("parentDocId") or "").strip()
    if parent:
        return parent
    if "#p" in eid:
        return eid.split("#p", 1)[0]
    return eid


def _parent_updated_at(scope: list[dict[str, Any]], parent_id: str) -> int:
    for entry in scope:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        if eid == parent_id:
            try:
                return int(entry.get("updatedAt") or 0)
            except (TypeError, ValueError):
                return 0
    return 0


def _is_draft_page_entry(entry: dict[str, Any]) -> bool:
    kind = str(entry.get("kind") or "")
    eid = str(entry.get("id") or "")
    return kind == "document" or "#p" in eid


def _collect_draft_pages(
    scope: list[dict[str, Any]],
) -> list[tuple[int, int, str, dict[str, Any]]]:
    """Draft pages sorted oldest→newest: (parent_updated, page_index, body, entry)."""
    chunk_parents = {
        _parent_doc_id(entry)
        for entry in scope
        if isinstance(entry, dict) and "#p" in str(entry.get("id") or "")
    }
    pages: list[tuple[int, int, str, dict[str, Any]]] = []
    for entry in scope:
        if not isinstance(entry, dict):
            continue
        if not _is_draft_page_entry(entry):
            continue
        eid = str(entry.get("id") or "")
        kind = str(entry.get("kind") or "")
        if kind == "document" and "#p" not in eid and eid in chunk_parents:
            continue
        body = str(entry.get("body") or "").strip()
        if not body:
            continue
        parent = _parent_doc_id(entry)
        updated = _parent_updated_at(scope, parent)
        if int(entry.get("updatedAt") or 0) > updated:
            updated = int(entry.get("updatedAt") or 0)
        pages.append((updated, _page_index(entry), body, entry))

    if not pages:
        return []

    pages.sort(key=lambda row: (row[0], row[1], _parent_doc_id(row[3])))
    return pages


def _usable_sentences(
    body: str,
    *,
    min_len: int,
    is_last_page: bool = False,
) -> list[str]:
    floor = 8 if is_last_page else min_len
    kept: list[str] = []
    for sentence in _split_sentences(body):
        if not sentence:
            continue
        if len(sentence) < floor and not is_last_page:
            continue
        if _PLANNING_NOTE.search(sentence):
            continue
        kept.append(sentence)
    if is_last_page and not kept:
        for sentence in _split_sentences(body):
            s = sentence.strip()
            if s and not _PLANNING_NOTE.search(s):
                kept.append(s)
    return kept


_RESUME_NOTE_SIGNAL = re.compile(
    r"\b("
    r"fear|afraid|dread|eaten|incorrect|wrong|actually|mistaken|believes?|"
    r"escape|flee|outran|outstrip|brother|sister|captured|brought|taking|"
    r"manor|building|castle|estate|destination|intends?"
    r")\b",
    re.I,
)


def _tail_sentences_for_answer(pages: list[tuple[int, int, str, dict[str, Any]]]) -> list[str]:
    """Anchor on the final saved page; add brief just-before context from prior pages."""
    if not pages:
        return []

    _updated, _idx, last_body, _last_entry = pages[-1]
    anchor = _usable_sentences(last_body, min_len=20, is_last_page=True)[-4:]
    if not anchor:
        return []

    context: list[str] = []
    # Immediate prior page only by default — avoids dumping older setup.
    if len(pages) >= 2:
        context = _usable_sentences(pages[-2][2], min_len=20)[-3:]
    # One more prior page only when it carries capture/stakes/escape signals.
    if len(pages) >= 3 and _RESUME_NOTE_SIGNAL.search(pages[-3][2]):
        earlier = _usable_sentences(pages[-3][2], min_len=20)[-2:]
        context = earlier + context

    combined = context + anchor
    deduped: list[str] = []
    seen: set[str] = set()
    for sentence in combined:
        key = sentence.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(sentence)
    return deduped[-8:]


_CONCEPT_NOTE_WORDS = frozenset(
    """
    situation gate trial court politics intrigue scheme plot theme motif symbol concept
    predator prey magic rule rules system faction species world building relationship
    dynamics prologue epilogue chapter act scene visual design font awareness hierarchy
    ceremony ritual prophecy curse pact treaty alliance predator prey
    """.split()
)


def _work_title_tokens(question: str, entries: list[dict[str, Any]]) -> set[str]:
    hints = extract_work_hints(question, entries)
    tokens: set[str] = set()
    for hint in hints:
        for part in re.findall(r"[a-z0-9']+", hint.lower()):
            if len(part) > 2:
                tokens.add(part)
    return tokens


def _is_concept_note_title(title: str) -> bool:
    words = re.findall(r"[a-z0-9']+", (title or "").lower())
    if not words:
        return True
    if len(words) > 3:
        return True
    if any(word in _CONCEPT_NOTE_WORDS for word in words):
        return True
    if "-" in title and len(words) >= 2:
        return True
    return False


def _is_character_note_entry(entry: dict[str, Any]) -> bool:
    kind = str(entry.get("kind") or "")
    title = str(entry.get("title") or "").strip()
    if not title or not _is_person_name(title):
        return False
    if kind == "character":
        return True
    if kind != "note":
        return False
    if _is_concept_note_title(title):
        return False
    if len(title.split()) > 3:
        return False
    body = str(entry.get("body") or "")
    blob = f"{title}\n{body}"
    if _name_has_character_signal(title, blob):
        return True
    if re.search(
        rf"\b{re.escape(title)}\s+(?:is|was|are|were)\s+(?:the\s+|a\s+|an\s+)?"
        rf"(?:protagonist|antagonist|sister|brother|wife|husband|queen|king|lord|lady|"
        rf"villain|hero|heroine|guardian|mentor|narrator)\b",
        blob,
        re.I,
    ):
        return True
    if title.lower() == str(entry.get("title") or "").strip().lower() and re.search(
        rf"\b{re.escape(title)}\b", body, re.I
    ):
        return len(body.split()) <= 120
    return False


def cast_allowlist_from_entries(
    entries: list[dict[str, Any]], question: str
) -> set[str]:
    """Writer-saved cast names for this work — not concept note titles."""
    scope = _entries_for_work(entries, question)
    allow: set[str] = set()
    for entry in scope:
        if not isinstance(entry, dict):
            continue
        if not _is_character_note_entry(entry):
            continue
        title = str(entry.get("title") or "").strip()
        if title:
            allow.add(title)
    return allow


def _note_title_names_in_text(
    scope: list[dict[str, Any]], text: str, allowlist: set[str]
) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    allow_lower = {a.lower() for a in allowlist}
    for entry in scope:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("title") or "").strip()
        if not title or title.lower() not in allow_lower:
            continue
        if not re.search(rf"\b{re.escape(title)}\b", text, re.I):
            continue
        key = title.lower()
        if key in seen:
            continue
        seen.add(key)
        names.append(title)
    return names


def named_characters_in_draft_tail(
    entries: list[dict[str, Any]], question: str
) -> list[str]:
    """Cast names explicitly present in the latest draft beat — not concepts."""
    scope = _entries_for_work(entries, question)
    pages = _collect_draft_pages(scope)
    if not pages:
        return []
    allowlist = cast_allowlist_from_entries(entries, question)
    work_tokens = _work_title_tokens(question, entries)
    latest_text = pages[-1][2]
    tail_text = "\n\n".join(row[2] for row in pages[-2:])
    ordered = named_characters_in_scene_text(
        latest_text, allowlist=allowlist, work_title_tokens=work_tokens
    )
    seen = {n.lower() for n in ordered}
    for name in named_characters_in_scene_text(
        tail_text, allowlist=allowlist, work_title_tokens=work_tokens
    ):
        if name.lower() not in seen:
            seen.add(name.lower())
            ordered.append(name)
    for name in _note_title_names_in_text(scope, tail_text, allowlist):
        if name.lower() not in seen:
            seen.add(name.lower())
            ordered.append(name)
    return ordered


def draft_tail_prompt_block(entries: list[dict[str, Any]], question: str) -> str:
    """Pinned latest-draft text for RAG resume synthesis (not shown to the writer)."""
    scope = _entries_for_work(entries, question)
    pages = _collect_draft_pages(scope)
    if not pages:
        return ""
    # Slightly wider window so "just before" capture / brothers / escape can appear.
    tail = pages[-5:]
    lines: list[str] = []
    for pos, (_updated, page_idx, body, entry) in enumerate(tail):
        if pos == len(tail) - 1:
            label = "LATEST"
        elif pos == len(tail) - 2:
            label = "JUST_BEFORE"
        else:
            label = f"earlier page {page_idx}"
        title = str(entry.get("title") or "Draft").strip()
        lines.append(f"[{label}] {title}\n{body[:4000]}")
    name_block = ""
    names = named_characters_in_draft_tail(entries, question)
    if names:
        name_block = (
            "Cast names in this beat (people only — use these proper names; "
            "do not treat concepts, places, or note titles as characters):\n"
            + "\n".join(f"- {name}" for name in names)
            + "\n\n"
        )
    note_block = resume_related_note_block(entries, question)
    return (
        f"{name_block}"
        f"{note_block}"
        "Draft tail for a planning brief (focus on LATEST; use JUST_BEFORE only for "
        "immediate lead-in — capture, destination, sacrifice/outstrip, escape attempts; "
        "skip sensory fluff; formal librarian voice; not novel prose):\n\n"
        + "\n\n".join(lines)
        + "\n\n"
    )


def resume_related_note_block(entries: list[dict[str, Any]], question: str) -> str:
    """Short note snippets tied to cast in the latest beat (stakes, corrections, lead-in)."""
    names = named_characters_in_draft_tail(entries, question)
    if not names:
        return ""
    scope = _entries_for_work(entries, question)
    name_lower = {n.lower() for n in names}
    scored: list[tuple[int, str, str]] = []
    for entry in scope:
        if not isinstance(entry, dict):
            continue
        kind = str(entry.get("kind") or "").lower()
        eid = str(entry.get("id") or "")
        if kind == "document" or "#p" in eid:
            continue
        title = str(entry.get("title") or "").strip()
        body = str(entry.get("body") or "").strip()
        if not body and not title:
            continue
        blob = f"{title}\n{body}"
        blob_l = blob.lower()
        if not any(n in blob_l for n in name_lower):
            continue
        score = 2 if _RESUME_NOTE_SIGNAL.search(blob) else 0
        if any(n == title.lower() for n in name_lower):
            score += 1
        if score <= 0:
            continue
        excerpt = re.sub(r"\s+", " ", blob).strip()
        if len(excerpt) > 700:
            excerpt = excerpt[:697].rstrip() + "…"
        scored.append((score, title or "Note", excerpt))
    if not scored:
        return ""
    scored.sort(key=lambda row: (-row[0], row[1].lower()))
    lines = [f"- {title}: {excerpt}" for _score, title, excerpt in scored[:3]]
    return (
        "Related notes for this beat (use for stakes, mistaken beliefs marked wrong, "
        "destination names, brothers/escape — do not dump full cast cards):\n"
        + "\n".join(lines)
        + "\n\n"
    )


def build_story_position_answer(
    question: str, entries: list[dict[str, Any]]
) -> tuple[str | None, list[str]]:
    scope = _entries_for_work(entries, question)
    work_hints = extract_work_hints(question, entries)
    work_title = work_title_from_hints(work_hints)
    where = f" in {work_title}" if work_title else ""

    pages = _collect_draft_pages(scope)
    if not pages:
        return None, []

    tail_pages = pages[-5:]
    sentences = _tail_sentences_for_answer(tail_pages)
    ids: list[str] = []
    for _updated, _idx, _body, entry in tail_pages:
        eid = str(entry.get("id") or "")
        if eid and eid not in ids:
            ids.append(eid.split("#p", 1)[0] if "#p" in eid else eid)

    if not sentences:
        return None, ids

    lead = f"Planning brief — current draft position{where}:\n\n"
    body = " ".join(sentences)
    if not body.endswith((".", "!", "?", "…")):
        body += "."
    answer = f"{lead}{body}\n\n— From your notes only. Nothing invented."
    return answer, ids[:6]


def ranked_draft_tail_rows(
    entries: list[dict[str, Any]],
    question: str,
    *,
    kind_label: Any,
) -> list[dict[str, Any]]:
    """High-priority ranked rows for the last draft chunks (story resume retrieval)."""
    scope = _entries_for_work(entries, question)
    pages = _collect_draft_pages(scope)
    if not pages:
        return []
    tail = pages[-6:]
    rows: list[dict[str, Any]] = []
    for pos, (_updated, _idx, _body, entry) in enumerate(tail):
        eid = str(entry.get("id") or "")
        rows.append(
            {
                "id": eid,
                "title": str(entry.get("title") or "Draft"),
                "kind": str(entry.get("kind") or "document"),
                "kindLabel": kind_label(str(entry.get("kind") or "document")),
                "score": 96 + pos,
                "excerpt": str(entry.get("body") or "")[:400],
                "body": str(entry.get("body") or "")[:8000],
            }
        )
    # Boost short related notes for stakes / corrections when present.
    names = {n.lower() for n in named_characters_in_draft_tail(entries, question)}
    if names:
        for entry in scope:
            if not isinstance(entry, dict):
                continue
            kind = str(entry.get("kind") or "").lower()
            eid = str(entry.get("id") or "")
            if kind == "document" or "#p" in eid:
                continue
            blob = f"{entry.get('title') or ''} {entry.get('body') or ''}"
            if not any(n in blob.lower() for n in names):
                continue
            if not _RESUME_NOTE_SIGNAL.search(blob):
                continue
            if any(r.get("id") == eid for r in rows):
                continue
            rows.append(
                {
                    "id": eid,
                    "title": str(entry.get("title") or "Note"),
                    "kind": str(entry.get("kind") or "note"),
                    "kindLabel": kind_label(str(entry.get("kind") or "note")),
                    "score": 94,
                    "excerpt": str(entry.get("body") or "")[:400],
                    "body": str(entry.get("body") or "")[:4000],
                }
            )
            if len(rows) >= 10:
                break
    return rows
