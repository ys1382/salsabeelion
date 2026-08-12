"""LoreKeeper — writing-next Ask: short task list from notes not yet in draft."""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_notes_vs_draft import (
    _content_tokens,
    _is_draft_entry,
    _near_dedupe_items,
    _normalize,
    _tidy_claim_line,
    _work_phrase,
    collect_notes_not_in_draft,
    extract_after_anchors,
    extract_notes_not_in_draft_subject,
    filter_unused_by_after_anchors,
    filter_unused_by_subject,
)

MAX_TASK_ITEMS = 8
_MAX_TASK_LINE = 180

_TASK_LIST_Q = re.compile(
    r"\b("
    r"(?:my\s+)?task\s*lists?|"
    r"writing[\s-]?next|"
    r"what\s+(?:should|can|do)\s+i\s+write\s+next|"
    r"what\s+to\s+write\s+next|"
    r"what\s+(?:am\s+i\s+)?(?:supposed\s+to\s+)?write\s+next|"
    r"here(?:'s|\s+is)\s+(?:my\s+)?task\s*list|"
    r"list\s+(?:my\s+)?(?:writing\s+)?tasks?"
    r")\b",
    re.I,
)

_TOPIC_FOR = re.compile(
    r"\b(?:task\s*lists?|writing[\s-]?next|write\s+next|writing\s+tasks?)\s+"
    r"(?:for|about|of|on|regarding|concerning)\s+"
    r"(.+?)(?=\s*[?.!]?\s*$|\s+aside\b|\s+that\b|\s+which\b)",
    re.I,
)

_TOPIC_JUNK = frozenset(
    {
        "me",
        "this",
        "that",
        "it",
        "now",
        "next",
        "later",
        "the draft",
        "the main draft",
        "main draft",
        "the document",
        "my notes",
        "the notes",
        "this work",
        "the story",
        "smoke and mirrors",
    }
)

_FOOTER = (
    "— From your notes vs draft only. Nothing invented. "
    "Name a topic for a tighter list, or ask again for more."
)


def is_writing_next_task_list_question(question: str) -> bool:
    """Writer asked for a short write-next task list (not inventing chores)."""
    return bool(_TASK_LIST_Q.search(question or ""))


def extract_writing_next_topic(question: str) -> str:
    """
    Topic filter from the ask — e.g. 'Predator Court politics' from
    'task list for Predator Court politics'. Empty = whole-work short list.
    """
    q = (question or "").strip()
    if not q:
        return ""
    m = _TOPIC_FOR.search(q)
    if m:
        raw = m.group(1).strip().rstrip("?.!,")
        cleaned = re.sub(r"\s+", " ", raw).strip(" \t\"'“”‘’")
        # Drop trailing work/meta: "chase scene in Smoke and Mirrors"
        cleaned = re.sub(
            r"\s+(?:in|for|from)\s+(?:my\s+|the\s+)?"
            r"(?:notes?|draft|document|story|work).*$",
            "",
            cleaned,
            flags=re.I,
        ).strip()
        low = cleaned.lower()
        if cleaned and low not in _TOPIC_JUNK and len(cleaned) <= 80:
            return cleaned
    # Fall back to notes-vs-draft subject extractors ("relating to Dijon").
    return extract_notes_not_in_draft_subject(q)


def filter_unused_by_topic(
    items: list[dict[str, str]], topic: str
) -> list[dict[str, str]]:
    """
    Keep unused claims that match the asked topic.
    Character-style subject filter first; thematic token overlap as fallback
    (chase scene / Court politics / secret reveals).
    """
    topic_s = (topic or "").strip()
    if not topic_s:
        return items
    by_subject = filter_unused_by_subject(items, topic_s)
    if by_subject:
        return by_subject
    toks = _content_tokens(topic_s)
    if not toks:
        return items
    need = max(1, (len(toks) + 1) // 2)
    out: list[dict[str, str]] = []
    for row in items:
        blob = f"{row.get('noteTitle') or ''} {row.get('line') or ''}"
        norm = _normalize(blob)
        blob_toks = set(_content_tokens(blob))
        hits = sum(1 for t in toks if t in blob_toks or t in norm)
        if hits >= need:
            out.append(row)
    return out


def _draft_tail_token_set(entries: list[dict[str, Any]]) -> set[str]:
    try:
        from lorekeeper_story_position import (
            _collect_draft_pages,
            _tail_sentences_for_answer,
        )
    except Exception:
        return set()
    pages = _collect_draft_pages(entries)
    if not pages:
        return set()
    sents = _tail_sentences_for_answer(pages)
    return set(_content_tokens(" ".join(sents)))


def _rank_tasks_leave_off_first(
    items: list[dict[str, str]],
    entries: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """Prefer unused notes that touch the current draft-tail cast/place words."""
    tail = _draft_tail_token_set(entries)
    scored: list[tuple[int, int, int, dict[str, str]]] = []
    for i, row in enumerate(items):
        line = str(row.get("line") or "")
        title = str(row.get("noteTitle") or "")
        toks = set(_content_tokens(f"{line} {title}"))
        overlap = len(toks & tail) if tail else 0
        # Slightly prefer medium-length planning claims over tiny scraps.
        length_bonus = min(len(line), 160) // 20
        scored.append((-overlap, -length_bonus, i, row))
    scored.sort()
    return [row for _o, _l, _i, row in scored]


def _task_bullet_line(text: str) -> str:
    s = _tidy_claim_line(text)
    if not s:
        return ""
    if len(s) > _MAX_TASK_LINE:
        cut = s[: _MAX_TASK_LINE - 1].rsplit(" ", 1)[0].rstrip(",;:")
        s = (cut or s[: _MAX_TASK_LINE - 1]) + "…"
    if s[-1] not in ".!?…\"'”’":
        s = s + "."
    return s


def compose_writing_next_task_list(
    work_hints: set[str],
    items: list[dict[str, str]],
    *,
    has_notes: bool,
    has_draft: bool,
    topic: str = "",
    total_before_cap: int = 0,
) -> str:
    """Short bullet task list — planning shape, not scrap paragraphs."""
    work = _work_phrase(work_hints)
    topic_s = (topic or "").strip()
    if topic_s:
        lead = (
            f"Here's a short task list for {work} about {topic_s} — "
            f"from your notes, not yet in the main draft:\n"
        )
    else:
        lead = (
            f"Here's a short task list for {work} — "
            f"from your notes, not yet in the main draft:\n"
        )
    lines = [lead]
    if not has_notes:
        lines.append(
            "No notes found for this work to compare. Add notes, then ask again."
        )
    elif not has_draft:
        lines.append(
            "No main document/draft found for this work to compare against. "
            "Open or save a document for this work, then ask again."
        )
    elif items:
        for row in items[:MAX_TASK_ITEMS]:
            bullet = _task_bullet_line(str(row.get("line") or ""))
            if bullet:
                lines.append(f"• {bullet}")
        shown = min(len(items), MAX_TASK_ITEMS)
        extra = max(0, int(total_before_cap) - shown)
        if extra > 0:
            lines.append(
                f"\n…and {extra} more unused note detail(s). "
                "Name a topic (chase, Court politics, …) or ask again for more."
            )
    elif topic_s:
        lines.append(
            f"Nothing clear stood out as unused notes about {topic_s} — "
            "either those lines also show up in the draft by phrase match, "
            "or no notes for that topic were found."
        )
    else:
        lines.append(
            "Nothing clear stood out as notes-only — clear note lines also show up "
            "in the draft by phrase match."
        )
    lines.append("\n" + _FOOTER)
    return "\n".join(lines)


def answer_writing_next_task_list(
    entries: list[dict[str, Any]],
    *,
    work_hints: set[str],
    question: str = "",
) -> tuple[str, list[str]]:
    """
    Compare story notes vs main draft; return a short ranked task list.
    Librarian only — never invents tasks.
    """
    items, has_notes, has_draft = collect_notes_not_in_draft(entries)
    topic = extract_writing_next_topic(question)
    if topic:
        items = filter_unused_by_topic(items, topic)
    anchors = extract_after_anchors(question)
    if anchors:
        items = filter_unused_by_after_anchors(items, anchors)

    cleaned = _near_dedupe_items(items) if items else []
    ranked = (
        _rank_tasks_leave_off_first(cleaned, entries) if cleaned else []
    )
    total = len(ranked)
    shown = ranked[:MAX_TASK_ITEMS]

    answer = compose_writing_next_task_list(
        work_hints,
        shown,
        has_notes=has_notes,
        has_draft=has_draft,
        topic=topic,
        total_before_cap=total,
    )

    source_ids: list[str] = []
    seen_ids: set[str] = set()
    for row in shown:
        eid = str(row.get("entryId") or "")
        if eid and eid not in seen_ids:
            seen_ids.add(eid)
            source_ids.append(eid)
        if len(source_ids) >= 12:
            break
    if not source_ids and has_notes and not topic:
        for entry in entries:
            if (
                isinstance(entry, dict)
                and not _is_draft_entry(entry)
                and entry.get("id")
            ):
                source_ids.append(str(entry["id"]))
                if len(source_ids) >= 6:
                    break
    return answer, source_ids
