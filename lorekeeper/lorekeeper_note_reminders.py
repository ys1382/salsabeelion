"""LoreKeeper — draft-foothold reminders for writing-next Ask.

1) Update-your-notes: draft already has the beat; a related note still reads
   like the whole beat is unwritten — soft nudge, never invent.
2) Task-list foothold: prefer unused notes tied to threads the draft already
   introduces; quiet pure-future scenes with no foothold yet.
"""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_notes_vs_draft import (
    _content_tokens,
    _draft_corpus,
    _normalize,
    _primary_name_token,
)

# Scene beats that stay quiet until the draft actually starts them —
# destination name alone (e.g. Tenebris) is not enough.
_UNINTRODUCED_FUTURE_SCENE = re.compile(
    r"\b("
    r"facing the music|"
    r"treated as a guest(?: rather than a prisoner)?|"
    r"upon arrival at|"
    r"after arriving at|"
    r"when (?:he|she|they|[\w'-]+) arrives? at|"
    r"after (?:he|she|they|[\w'-]+) (?:is|are) (?:settled|received) (?:at|in)|"
    r"once (?:he|she|they|[\w'-]+) (?:is|are) (?:inside|settled) (?:at|in)"
    r")\b",
    re.I,
)

_FLASHBACK_SETUP = re.compile(
    r"\b("
    r"begins having|has a fractured|starts? (?:having )?a (?:fractured[-/ ])?flashback|"
    r"will have a flashback|needs? a flashback|flashback regarding"
    r")\b",
    re.I,
)

_MAX_NUDGES = 3


def draft_norms(entries: list[dict[str, Any]]) -> tuple[str, str]:
    """Return (full draft normalized, draft-tail normalized)."""
    full = _normalize(_draft_corpus(entries))
    tail = ""
    try:
        from lorekeeper_story_position import (
            _collect_draft_pages,
            _tail_sentences_for_answer,
        )

        pages = _collect_draft_pages(entries)
        if pages:
            tail = _normalize(" ".join(_tail_sentences_for_answer(pages)))
    except Exception:
        tail = ""
    return full, tail


def foothold_score(
    claim: str,
    *,
    draft_norm: str,
    draft_tail_norm: str = "",
    note_title: str = "",
) -> int:
    """
    How strongly this note beat already has a foothold in the main draft.
    0 = pure ahead / no overlap; higher = draft already introducing it.
    """
    blob = f"{note_title} {claim}".strip()
    if not blob or not draft_norm:
        return 0
    toks = [
        t
        for t in _content_tokens(blob)
        if len(t) >= 4
        and t
        not in {
            "that",
            "this",
            "with",
            "from",
            "have",
            "been",
            "will",
            "would",
            "about",
            "after",
            "before",
            "during",
            "notes",
            "draft",
            "scene",
            "write",
            "wanted",
            "planning",
        }
    ]
    if not toks:
        return 0
    score = 0
    pool = draft_tail_norm or draft_norm
    for t in toks:
        if t in pool:
            score += 3 if draft_tail_norm and t in draft_tail_norm else 2
        elif t in draft_norm:
            score += 1
    if re.search(r"\bflashback\b", blob, re.I) and re.search(
        r"\bflashback\b", draft_norm, re.I
    ):
        score += 4
    if re.search(r"\bchase\b|serias|capture", blob, re.I) and re.search(
        r"\bchase\b|serias|wolf|capture|bolted|running", draft_norm, re.I
    ):
        score += 4
    return score


def is_unintroduced_future_scene(
    claim: str,
    *,
    draft_norm: str,
    note_title: str = "",
) -> bool:
    """
    True for pure-future scene notes the draft has not begun —
    e.g. facing the music at Tenebris when that scene isn't on the page yet.
    """
    blob = f"{note_title} {claim}"
    if not _UNINTRODUCED_FUTURE_SCENE.search(blob):
        return False
    if _UNINTRODUCED_FUTURE_SCENE.search(draft_norm or ""):
        return False
    return True


def filter_tasks_by_draft_foothold(
    items: list[dict[str, str]],
    entries: list[dict[str, Any]],
    *,
    allow_span_arrival: bool = False,
) -> list[dict[str, str]]:
    """Prefer write-next items the draft already introduces; drop pure-future scenes."""
    draft_norm, draft_tail = draft_norms(entries)
    if not draft_norm:
        return items
    kept: list[dict[str, str]] = []
    for row in items:
        line = str(row.get("line") or "")
        title = str(row.get("noteTitle") or "")
        if is_unintroduced_future_scene(
            line, draft_norm=draft_norm, note_title=title
        ):
            arrival_ok = bool(
                allow_span_arrival
                and re.search(
                    r"\bupon arrival|arrives? at|during (?:the )?arrival|"
                    r"hands? .{0,24}over",
                    line,
                    re.I,
                )
                and not re.search(
                    r"treated as a guest|facing the music|settled",
                    line,
                    re.I,
                )
            )
            if not arrival_ok:
                continue
        score = foothold_score(
            line,
            draft_norm=draft_norm,
            draft_tail_norm=draft_tail,
            note_title=title,
        )
        kept.append({**row, "footholdScore": str(score)})
    kept.sort(key=lambda r: (-int(r.get("footholdScore") or 0),))
    return kept


def _flashback_owner_in_line(line: str) -> str:
    patterns = (
        r"\bAs\s+([A-Z][\w'-]{2,})\b.{0,100}\bflashback\b",
        r"\b([A-Z][\w'-]{2,})\s+has\s+a\b.{0,80}\bflashback\b",
        r"\b([A-Z][\w'-]{2,})(?:'s|\u2019s)\s+(?:fractured[-/ ]\s*)?flashback\b",
        r"\b([A-Z][\w'-]{2,})\s+begins\s+having\b.{0,60}\bflashback\b",
        r"^During\s+([A-Z][\w'-]{2,})(?:'s|\u2019s)?\s+flashback\b",
    )
    for pat in patterns:
        m = re.search(pat, line or "")
        if not m:
            continue
        cand = m.group(1)
        if cand.lower() in {
            "the",
            "and",
            "both",
            "character",
            "different",
            "fractured",
            "shattered",
            "during",
        }:
            continue
        return cand
    return ""


def collect_update_notes_nudges(
    entries: list[dict[str, Any]],
    *,
    topic: str = "",
    unused_rows: list[dict[str, str]] | None = None,
) -> list[str]:
    """
    Soft 'update your notes?' lines — only when the draft already has the beat.
    Never invents the corrected plan.
    """
    from lorekeeper_writing_next import (
        _flashback_already_in_draft,
        is_flashback_claim,
        topic_looks_like_cast,
    )

    draft_norm, _tail = draft_norms(entries)
    if not draft_norm:
        return []

    rows = unused_rows
    if rows is None:
        from lorekeeper_notes_vs_draft import collect_notes_not_in_draft

        rows, has_notes, has_draft = collect_notes_not_in_draft(entries)
        if not has_notes or not has_draft:
            return []

    topic_s = (topic or "").strip()
    nudges: list[str] = []
    seen: set[str] = set()

    for row in rows:
        line = str(row.get("line") or "").strip()
        title = str(row.get("noteTitle") or "").strip()
        if not line:
            continue
        if topic_s and topic_looks_like_cast(topic_s):
            name = _primary_name_token(topic_s)
            blob = f"{title} {line}"
            if name and not re.search(rf"\b{re.escape(name)}\b", blob, re.I):
                if not is_flashback_claim(line.lower() + " " + title.lower()):
                    continue

        if is_unintroduced_future_scene(
            line, draft_norm=draft_norm, note_title=title
        ):
            continue

        owner = _flashback_owner_in_line(line)
        if owner and is_flashback_claim(line.lower()):
            if not _flashback_already_in_draft(line, draft_norm):
                continue
            if _FLASHBACK_SETUP.search(line) or re.search(
                r"\bhas a fractured-shattered flashback\b",
                line,
                re.I,
            ):
                key = f"flashback:{owner.lower()}"
                if key in seen:
                    continue
                seen.add(key)
                nudges.append(
                    f"Update your notes? Your draft already includes {owner}'s "
                    f"flashback, but a related note still reads like that beat "
                    f"is only planned — revise the note if your plan changed."
                )
                if len(nudges) >= _MAX_NUDGES:
                    break

    return nudges[:_MAX_NUDGES]


def format_update_notes_block(nudges: list[str]) -> str:
    """Compose the soft reminder block for task-list answers."""
    if not nudges:
        return ""
    lines = ["", "— Note check (draft already has a foothold here):"]
    for n in nudges:
        lines.append(f"• {n}")
    return "\n".join(lines)
