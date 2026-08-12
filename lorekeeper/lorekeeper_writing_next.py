"""LoreKeeper — writing-next Ask: short task list from notes not yet in draft."""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_notes_vs_draft import (
    _claim_touched_in_draft,
    _content_tokens,
    _draft_corpus,
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
# If the ranked list is small, show all instead of hiding 1–4 behind "…and N more".
SOFT_SHOW_ALL_MAX = 12
_MAX_TASK_LINE = 160

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
    "— Short write-next tasks restated from your notes vs draft only. "
    "Nothing invented. Continuity sticky-notes, later-book setup, and standing "
    "lore stay out unless you ask for a later book. "
    "Name a topic for a tighter list, or ask again for more."
)

# Incomplete scraps — trail-offs, mid-clause cuts (never ship with … truncation).
_INCOMPLETE_TAIL = re.compile(
    r"(?:--+|…|\.\.\.)\s*$|"
    r"\([^)]*$|"
    r"\b(?:and even if|or else|or so he thinks|because (?:he|she|they)|"
    r"considering how|even while|he does|that are just)\s*$|"
    r"[,;:]\s*$|"
    r"\b(?:was|were|the|a|an|to|for|that|when|if|but|and|or|of|just)\s*$",
    re.I,
)

# Later-book / far-horizon — only for task lists scoped to a later book.
_LATER_BOOK = re.compile(
    r"\b("
    r"later\s+book|future\s+book|next\s+book|another\s+book|"
    r"book\s+(?:two|three|2|3)|sequel|"
    r"(?:doesn'?t|does\s+not|won'?t|will\s+not)\s+happen\s+until\s+"
    r"(?:a\s+)?(?:later|future|next)|"
    r"not\s+until\s+(?:a\s+)?(?:later|future)\s+book|"
    r"until\s+(?:likely\s+)?a\s+later\s+book|"
    r"later\s+in\s+the\s+series|"
    r"eventual(?:ly)?(?:\s+\([^)]*\))?\s+reveal|"
    r"set\s+in\s+motion\s+the\s+eventual|"
    r"not\s+yet\s+but\s+within\s+a\s+few\s+months|"
    r"within\s+a\s+few\s+months"
    r")\b",
    re.I,
)

_LATER_BOOK_QUESTION = re.compile(
    r"\b("
    r"later\s+book|future\s+book|next\s+book|another\s+book|"
    r"book\s+(?:two|three|2|3)|sequel|later\s+in\s+the\s+series"
    r")\b",
    re.I,
)

# Author continuity / awareness sticky — not near-term write-next.
_CONTINUITY_STICKY = re.compile(
    r"\b("
    r"(?:is|are|was|were|becomes?|remains?)\s+aware\s+that|"
    r"(?:does not|doesn't|doesnt)\s+yet\s+(?:want|realize|know|understand)|"
    r"not yet\s+(?:realize|know|understand)|"
    r"doesn'?t\s+yet\s+realize|"
    r"misunderstands?|"
    r"he thinks that the|"
    r"she thinks that the|"
    r"should hint at (?:his |her |their )?knowledge|"
    r"expression should hint|"
    r"i think i mentioned|"
    r"i(?:'?m| am)\s+also\s+thinking|"
    r"i(?:'?m| am)\s+thinking\s+that|"
    r"however,?\s+i\s+think|"
    r"how (?:he|she|they|the character)\s+feels\s+until|"
    r"for (?:me|myself)\s+as\s+i\s+write|"
    r"keep(?:s|ing)?\s+(?:in\s+mind|aware)\s+when\s+writing|"
    r"stuff for me to be aware|"
    r"until a particular point|"
    r"at the present timeline"
    r")\b",
    re.I,
)

_AUTHOR_MUSING_LEAD = re.compile(
    r"^\s*(?:"
    r"so\s+right\s+now\b|"
    r"so\s+the\b|"
    r"so\s+he\s+probably\b|"
    r"so\s+i(?:'?m| am)\s+thinking\b|"
    r"so\s+this\s+climax\b|"
    r"so\s+the\s+chase\b|"
    r"so\s+\w+,?\s+by\s+being\b|"
    r"however,?\s+i\s+think\b|"
    r"and\s+also\b|"
    r"also\s+something\b|"
    r"i\s+think\s+i\b|"
    r"i(?:'?m| am)\s+(?:also\s+)?thinking\b"
    r")",
    re.I,
)

# Dramatizable write-next — scene/gap/conflict you might put on the page soon.
_DRAMATIZABLE = re.compile(
    r"\b("
    r"secret|secrets|reveal|reveals|revealed|bitterness|resents?|resentment|"
    r"power|powers|ability|abilities|condition|conditions|identity|"
    r"planned\s*:|need(?:s)?\s+to\s+(?:write|draft)|"
    r"should\s+(?:write|draft)|"
    r"must be written|well-rounded|"
    r"still\s+(?:need|have)\s+to\s+(?:write|draft)|"
    r"chase|snapped|bridge|ritual|plot\s+beat|flashback|"
    r"court\s+politics|political\s+pressures?|not helping|"
    r"left (?:him|her|them) to dry|heavier load|"
    r"scene needs|write the|dramatize|on (?:the\s+)?page|"
    r"find a way to write|haven'?t specified|not yet specified|"
    r"who killed|fascinated study|guest rather than|open gap"
    r")\b",
    re.I,
)

_RELATIONSHIP_TENSION = re.compile(
    r"\b("
    r"resents?|resentment|bitterness|grudge|cold(?:er)? on the surface|"
    r"cares? for .{0,40} but|understands? why|"
    r"conflict|rivalry|betrayed|abandoned"
    r")\b",
    re.I,
)


def is_writing_next_task_list_question(question: str) -> bool:
    """Writer asked for a short write-next task list (not inventing chores)."""
    return bool(_TASK_LIST_Q.search(question or ""))


def wants_later_book_scope(question: str) -> bool:
    """True when the ask is scoped to a later book / sequel task list."""
    return bool(_LATER_BOOK_QUESTION.search(question or ""))


def line_is_later_book(line: str) -> bool:
    """Note marks this beat for a later book / far-horizon reveal."""
    return bool(_LATER_BOOK.search(line or ""))


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
        cleaned = re.sub(
            r"\s+(?:in|for|from)\s+(?:my\s+|the\s+)?"
            r"(?:notes?|draft|document|story|work).*$",
            "",
            cleaned,
            flags=re.I,
        ).strip()
        # Don't treat "later book" as a character topic.
        if _LATER_BOOK_QUESTION.search(cleaned):
            return ""
        low = cleaned.lower()
        if cleaned and low not in _TOPIC_JUNK and len(cleaned) <= 80:
            return cleaned
    return extract_notes_not_in_draft_subject(q)


def filter_unused_by_topic(
    items: list[dict[str, str]], topic: str
) -> list[dict[str, str]]:
    """
    Keep unused claims that match the asked topic.
    Character-style subject hits plus soft token overlap (including possessives).
    """
    topic_s = (topic or "").strip()
    if not topic_s:
        return items
    by_subject = filter_unused_by_subject(items, topic_s)
    toks = _content_tokens(topic_s)
    name_bits = [
        t
        for t in _normalize(topic_s).split()
        if len(t) >= 2 and t not in {"the", "and", "for"}
    ]
    need_toks = toks or name_bits
    soft: list[dict[str, str]] = []
    if need_toks:
        need = max(1, (len(need_toks) + 1) // 2)
        for row in items:
            blob = f"{row.get('noteTitle') or ''} {row.get('line') or ''}"
            norm = _normalize(blob)
            blob_toks = set(_content_tokens(blob)) | set(norm.split())
            hits = sum(1 for t in need_toks if t in blob_toks or t in norm)
            if hits >= need:
                soft.append(row)
    if not by_subject and not soft:
        return []
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for row in by_subject + soft:
        key = _normalize(str(row.get("line") or ""))[:160]
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def _line_is_incomplete(line: str) -> bool:
    """True for mid-trail-off scraps — not usable as a task bullet."""
    s = (line or "").strip()
    if not s:
        return True
    if _INCOMPLETE_TAIL.search(s):
        return True
    if re.search(r"(--|—|–)\s*$", s):
        return True
    open_parens = s.count("(") - s.count(")")
    if open_parens > 0:
        return True
    return False


def _is_continuity_or_musing(line: str) -> bool:
    """Author sticky / awareness continuity — not a write-next task."""
    s = (line or "").strip()
    if not s:
        return True
    if _CONTINUITY_STICKY.search(s):
        return True
    if _AUTHOR_MUSING_LEAD.search(s):
        return True
    return False


def claim_is_write_next_task(
    line: str, *, allow_later_book: bool = False
) -> bool:
    """
    Task-list only: dramatizable unused lore for near write-next work.
    Drops incomplete scraps, continuity sticky-notes, later-book setup
    (unless the ask is later-book scoped), and soft standing lore.
    """
    s = (line or "").strip()
    if not s or _line_is_incomplete(s):
        return False
    if _is_continuity_or_musing(s):
        return False
    if line_is_later_book(s) and not allow_later_book:
        return False
    if allow_later_book and not line_is_later_book(s):
        # Later-book ask: only lines marked for later books.
        return False
    if _DRAMATIZABLE.search(s) or _RELATIONSHIP_TENSION.search(s):
        return True
    return False


def filter_write_next_tasks(
    items: list[dict[str, str]],
    *,
    allow_later_book: bool = False,
) -> list[dict[str, str]]:
    """Keep only write-next-shaped unused claims for the task-list Ask."""
    out: list[dict[str, str]] = []
    for row in items:
        line = str(row.get("line") or "")
        if claim_is_write_next_task(line, allow_later_book=allow_later_book):
            out.append(row)
    return out


def _claim_touched_for_task_list(claim: str, draft_norm: str) -> bool:
    """
    Task-list unused check: exact/near phrase match, plus paraphrase coverage
    for distinctive note tokens (not bare cast-name bag-of-words).
    """
    if _claim_touched_in_draft(claim, draft_norm):
        return True
    content = _content_tokens(claim)
    if len(content) < 5 or not draft_norm:
        return False
    draft_words = draft_norm.split()
    if not draft_words:
        return False
    from collections import Counter

    freq = Counter(draft_words)
    distinctive = [
        t for t in content if len(t) >= 4 and freq.get(t, 0) <= 6
    ]
    if len(distinctive) < 4:
        distinctive = [t for t in content if len(t) >= 4] or content
    for i in range(len(distinctive) - 2):
        phrase = " ".join(distinctive[i : i + 3])
        if len(phrase) >= 14 and phrase in draft_norm:
            return True
    hits = sum(1 for t in distinctive if t in freq)
    n = len(distinctive)
    if n >= 6 and hits / n >= 0.65:
        return True
    if n >= 4 and hits / n >= 0.8:
        return True
    return False


def filter_already_in_draft_for_tasks(
    items: list[dict[str, str]],
    entries: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """Drop task candidates the main draft already covers (incl. paraphrase)."""
    draft_norm = _normalize(_draft_corpus(entries))
    if not draft_norm:
        return items
    out: list[dict[str, str]] = []
    for row in items:
        line = str(row.get("line") or "")
        if _claim_touched_for_task_list(line, draft_norm):
            continue
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
        length_bonus = min(len(line), 160) // 20
        scored.append((-overlap, -length_bonus, i, row))
    scored.sort()
    return [row for _o, _l, _i, row in scored]


def restate_as_task_line(raw: str) -> str:
    """
    Librarian short task line from a note claim — compress/reframe, never invent.
    Returns empty if the line cannot be stated cleanly (no … trail-offs).
    """
    s = _tidy_claim_line(raw)
    if not s or _line_is_incomplete(s):
        return ""

    # Prefer explicit craft instruction in parentheses when present.
    craft = re.search(
        r"\(([^)]*(?:write|draft|show|clarify|swiftly)[^)]*)\)",
        s,
        re.I,
    )
    if craft:
        inner = _tidy_claim_line(craft.group(1))
        if inner and not _line_is_incomplete(inner) and len(inner) <= _MAX_TASK_LINE:
            s = inner

    # Strip author mush leads (same facts, tighter task voice).
    s = re.sub(
        r"^(?:so|however),?\s+(?:i(?:'?m| am)\s+thinking\s+)?",
        "",
        s,
        flags=re.I,
    ).strip()
    s = re.sub(r"^i think\s+", "", s, flags=re.I).strip()
    s = re.sub(r"^also\s+something\s+in\s+", "", s, flags=re.I).strip()

    # Keep first complete chunk when the note stacks clauses.
    if ";" in s and len(s) > 110:
        left = s.split(";", 1)[0].strip()
        if len(left) >= 36 and not _line_is_incomplete(left):
            s = left

    # First sentence only when multiple.
    parts = re.split(r"(?<=[.!?])\s+", s)
    if parts and len(parts[0].strip()) >= 28:
        cand = parts[0].strip()
        if not _line_is_incomplete(cand):
            s = cand

    if len(s) > _MAX_TASK_LINE:
        for sep in (", but also ", ", and also ", "; ", " — ", " - "):
            if sep in s:
                left = s.split(sep, 1)[0].strip()
                if 40 <= len(left) <= _MAX_TASK_LINE and not _line_is_incomplete(
                    left
                ):
                    s = left
                    break
    if _line_is_incomplete(s) or len(s) > _MAX_TASK_LINE:
        # Never truncate with ellipsis — drop rather than trail off.
        return ""

    if s and s[0].islower():
        s = s[0].upper() + s[1:]
    if s[-1] not in ".!?\"'”’":
        s = s + "."
    return s


def _select_tasks_for_display(
    ranked: list[dict[str, str]],
) -> tuple[list[dict[str, str]], int]:
    """Return (shown rows, hidden count). Soft-show all when the list is small."""
    if len(ranked) <= SOFT_SHOW_ALL_MAX:
        return ranked, 0
    return ranked[:MAX_TASK_ITEMS], len(ranked) - MAX_TASK_ITEMS


def compose_writing_next_task_list(
    work_hints: set[str],
    items: list[dict[str, str]],
    *,
    has_notes: bool,
    has_draft: bool,
    topic: str = "",
    total_before_cap: int = 0,
    unused_but_not_tasks: bool = False,
    later_book_scope: bool = False,
) -> str:
    """Short bullet task list — restated write-next tasks only."""
    work = _work_phrase(work_hints)
    topic_s = (topic or "").strip()
    scope_bit = "later-book " if later_book_scope else ""
    if topic_s:
        lead = (
            f"Here's a short {scope_bit}task list for {work} about {topic_s} — "
            f"write-next items from your notes, not yet in the main draft:\n"
        )
    else:
        lead = (
            f"Here's a short {scope_bit}task list for {work} — "
            f"write-next items from your notes, not yet in the main draft:\n"
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
        first = True
        bullet_count = 0
        for row in items:
            bullet = restate_as_task_line(str(row.get("line") or ""))
            if not bullet:
                continue
            if not first:
                lines.append("")  # one blank line between bullets
            lines.append(f"• {bullet}")
            first = False
            bullet_count += 1
        if first:
            lines.append(
                "Nothing could be restated as a clean write-next task line "
                "(incomplete scraps were skipped)."
            )
        else:
            extra = max(0, int(total_before_cap) - bullet_count)
            if extra > 0:
                lines.append(
                    f"\n…and {extra} more write-next item(s). "
                    "Name a topic (chase, Court politics, …) or ask again for more."
                )
    elif unused_but_not_tasks:
        if topic_s:
            lines.append(
                f"Notes about {topic_s} have unused lines, but none looked like "
                "near write-next tasks. Continuity sticky-notes, later-book setup, "
                "and standing lore stay out of this list."
            )
        else:
            lines.append(
                "Notes have unused lines, but none looked like near write-next tasks. "
                "Continuity sticky-notes, later-book setup, and standing lore stay "
                "out of this list."
            )
    elif topic_s:
        lines.append(
            f"Nothing clear stood out as write-next tasks about {topic_s} — "
            "either those lines also show up in the draft by phrase match, "
            "or no notes for that topic were found."
        )
    else:
        lines.append(
            "Nothing clear stood out as write-next tasks — clear note lines also "
            "show up in the draft by phrase match."
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
    Compare story notes vs main draft; return a short write-next task list.
    Librarian only — restates, never invents. Continuity / later-book stay out
    unless the ask is later-book scoped.
    """
    allow_later = wants_later_book_scope(question)
    items, has_notes, has_draft = collect_notes_not_in_draft(entries)
    topic = extract_writing_next_topic(question)
    if topic:
        items = filter_unused_by_topic(items, topic)
    anchors = extract_after_anchors(question)
    if anchors:
        items = filter_unused_by_after_anchors(items, anchors)

    cleaned = _near_dedupe_items(items) if items else []
    cleaned = filter_already_in_draft_for_tasks(cleaned, entries)
    tasks = filter_write_next_tasks(cleaned, allow_later_book=allow_later)
    unused_but_not_tasks = bool(cleaned) and not bool(tasks)
    ranked = (
        _rank_tasks_leave_off_first(tasks, entries) if tasks else []
    )
    # Restate first so incomplete long scraps don't consume the soft cap.
    restatable: list[dict[str, str]] = []
    for row in ranked:
        if restate_as_task_line(str(row.get("line") or "")):
            restatable.append(row)
    shown, _hidden = _select_tasks_for_display(restatable)

    answer = compose_writing_next_task_list(
        work_hints,
        shown,
        has_notes=has_notes,
        has_draft=has_draft,
        topic=topic,
        total_before_cap=len(restatable),
        unused_but_not_tasks=unused_but_not_tasks,
        later_book_scope=allow_later,
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
    return answer, source_ids
