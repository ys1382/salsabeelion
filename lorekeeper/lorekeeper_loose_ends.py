"""LoreKeeper — writer-tagged loose ends (planned gaps vs fix flags)."""
from __future__ import annotations

import re
from typing import Any, Literal

LooseEndKind = Literal["planned", "fix", "draft_only"]

_PLANNED_GAP_Q = re.compile(
    r"\b("
    r"what(?:'s|\s+is|\s+has)\s+not\s+(?:been\s+)?written(?:\s+yet)?|"
    r"what(?:'s|\s+is)\s+(?:still\s+)?unwritten|"
    r"what(?:'s|\s+is)\s+marked\s+(?:as\s+)?planned|"
    r"marked\s+for\s+later|"
    r"planned(?:\s+gaps?|\s+later|\s+but\s+not\s+drafted)?|"
    r"not\s+drafted\s+yet|"
    r"intentional\s+gaps?|"
    r"what\s+(?:am\s+i|have\s+i)\s+left\s+(?:to\s+write|for\s+later)|"
    r"what\s+have\s+i\s+not\s+written"
    r")\b",
    re.I,
)

_FLAGGED_FIX_Q = re.compile(
    r"\b("
    r"what(?:'s|\s+is)\s+flagged\s+to\s+fix|"
    r"flagged\s+to\s+fix|"
    r"things?\s+(?:to\s+|i\s+need\s+to\s+)fix|"
    r"what\s+needs\s+fixing|"
    r"fix\s+tags?|"
    r"todo\s+fix(?:\s+list)?|"
    r"list\s+(?:my\s+)?fix(?:es)?"
    r")\b",
    re.I,
)

_PLANNED_MARKER = re.compile(
    r"(?:^|\b)(?:planned\s*:|planned\b|not\s+drafted(?:\s+yet)?|act\s+\d+\s*[—–-]\s*not\s+drafted)",
    re.I,
)
_FIX_MARKER = re.compile(r"(?:^|\b)(?:todo\s+fix|fix\s*:)", re.I)
_DRAFT_ONLY_MARKER = re.compile(r"\bdraft\s+only\b", re.I)

_LINE_PREFIX = re.compile(
    r"^\s*(?:[-*•]\s*)?(?:planned\s*:|fix\s*:|todo\s+fix\s*:?)\s*(.+)$",
    re.I,
)


def is_planned_gap_question(question: str) -> bool:
    """Writer asked what is intentionally not written yet."""
    return bool(_PLANNED_GAP_Q.search(question or ""))


def is_flagged_fix_question(question: str) -> bool:
    """Writer asked for notes they tagged to fix — not full canon audit."""
    q = question or ""
    if not _FLAGGED_FIX_Q.search(q):
        return False
    from lorekeeper_character_compose import is_audit_question

    if is_audit_question(q) and not re.search(
        r"\b(flagged|fix\s+tags?|todo\s+fix|things?\s+to\s+fix)\b", q, re.I
    ):
        return False
    return True


def loose_end_kind_in_text(text: str) -> LooseEndKind | None:
    blob = (text or "").strip()
    if not blob:
        return None
    if _FIX_MARKER.search(blob):
        return "fix"
    if _PLANNED_MARKER.search(blob):
        return "planned"
    if _DRAFT_ONLY_MARKER.search(blob):
        return "draft_only"
    return None


def entry_is_planned(entry: dict[str, Any]) -> bool:
    """True when the whole entry is marked intentional gap — skip in canon audit."""
    if not isinstance(entry, dict):
        return False
    title = str(entry.get("title") or "")
    tags = " ".join(str(t) for t in (entry.get("tags") or []))
    body_head = str(entry.get("body") or "")[:240]
    for blob in (title, tags, body_head):
        kind = loose_end_kind_in_text(blob)
        if kind == "planned":
            return True
    return False


def _entry_matches_kind(entry: dict[str, Any], want: LooseEndKind) -> list[str]:
    if not isinstance(entry, dict):
        return []
    lines: list[str] = []
    title = str(entry.get("title") or "").strip()
    if title and loose_end_kind_in_text(title) == want:
        cleaned = re.sub(r"^(?:planned\s*:|fix\s*:|todo\s+fix\s*:?)\s*", "", title, flags=re.I).strip()
        lines.append(cleaned or title)
    for tag in entry.get("tags") or []:
        tag_s = str(tag).strip()
        if not tag_s:
            continue
        tag_kind = loose_end_kind_in_text(tag_s)
        if tag_kind != want:
            continue
        if tag_kind == "planned" and re.fullmatch(r"planned", tag_s, re.I):
            continue
        if tag_kind == "fix" and re.fullmatch(r"(?:todo\s+)?fix", tag_s, re.I):
            continue
        cleaned = re.sub(r"^(?:planned\s*:|fix\s*:|todo\s+fix\s*:?)\s*", "", tag_s, flags=re.I).strip()
        lines.append(cleaned or tag_s)
    body = str(entry.get("body") or "")
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if loose_end_kind_in_text(line) == want:
            m = _LINE_PREFIX.match(line)
            if m:
                lines.append(m.group(1).strip())
            else:
                lines.append(re.sub(r"^(?:planned\s*:|fix\s*:|todo\s+fix\s*:?)\s*", "", line, flags=re.I).strip())
        elif want == "planned" and _PLANNED_MARKER.search(line):
            lines.append(line)
        elif want == "fix" and _FIX_MARKER.search(line):
            m = _LINE_PREFIX.match(line)
            lines.append((m.group(1) if m else line).strip())
    seen: set[str] = set()
    out: list[str] = []
    for item in lines:
        key = item.lower()[:120]
        if not item or key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def collect_loose_end_items(
    entries: list[dict[str, Any]],
    kind: LooseEndKind,
) -> list[dict[str, str]]:
    """Tagged lines from saved notes only — never invented."""
    items: list[dict[str, str]] = []
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        title = str(entry.get("title") or "Untitled").strip()
        for line in _entry_matches_kind(entry, kind):
            key = line.lower()[:160]
            if key in seen:
                continue
            seen.add(key)
            items.append({"entryId": eid, "noteTitle": title, "line": line})
    return items


def _work_phrase(work_hints: set[str]) -> str:
    if not work_hints:
        return "your saved notes"
    label = sorted(work_hints, key=len, reverse=True)[0]
    return f"{label}"


def compose_planned_gaps_answer(work_hints: set[str], items: list[dict[str, str]]) -> str:
    work = _work_phrase(work_hints)
    lines = [f"Marked for later in {work} — from your labels only:\n"]
    if items:
        for row in items[:12]:
            note = row.get("noteTitle") or "Note"
            text = row.get("line") or ""
            if text.lower() == note.lower():
                lines.append(f"• {text}")
            else:
                lines.append(f"• {text} ({note})")
    else:
        lines.append(
            "Nothing tagged as planned yet. Add labels like "
            "`planned:` in a note title, tag, or body line — e.g. "
            "`planned: climax alliance` or `Act 3 — not drafted`."
        )
    lines.append(
        "\n— Only lines you tagged planned / not drafted. "
        "Untagged silence is not listed here."
    )
    return "\n".join(lines)


def compose_flagged_fix_answer(work_hints: set[str], items: list[dict[str, str]]) -> str:
    work = _work_phrase(work_hints)
    lines = [f"Flagged to fix in {work} — from your labels only:\n"]
    if items:
        for row in items[:12]:
            note = row.get("noteTitle") or "Note"
            text = row.get("line") or ""
            if text.lower() == note.lower():
                lines.append(f"• {text}")
            else:
                lines.append(f"• {text} ({note})")
    else:
        lines.append(
            "Nothing tagged to fix yet. Use `fix:` or `TODO fix` in a title, tag, or body line — "
            "e.g. `fix: Character A eye color`."
        )
    lines.append("\n— Only lines you tagged fix / TODO fix. Nothing invented.")
    return "\n".join(lines)


def answer_planned_gaps(
    entries: list[dict[str, Any]],
    *,
    work_hints: set[str],
) -> tuple[str, list[str]]:
    from lorekeeper_note_compare import (
        compose_planned_vs_draft_mentions,
        splice_before_footer,
    )

    items = collect_loose_end_items(entries, "planned")
    answer = compose_planned_gaps_answer(work_hints, items)
    extra = compose_planned_vs_draft_mentions(entries)
    if extra:
        answer = splice_before_footer(answer, extra)
    source_ids = [row["entryId"] for row in items if row.get("entryId")][:8]
    return answer, source_ids


def answer_flagged_fixes(
    entries: list[dict[str, Any]],
    *,
    work_hints: set[str],
) -> tuple[str, list[str]]:
    items = collect_loose_end_items(entries, "fix")
    answer = compose_flagged_fix_answer(work_hints, items)
    source_ids = [row["entryId"] for row in items if row.get("entryId")][:8]
    return answer, source_ids
