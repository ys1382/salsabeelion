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
    "— Write-next items from your notes vs draft only. Nothing invented. "
    "Continuity sticky-notes and standing lore stay out of this list. "
    "Name a topic for a tighter list, or ask again for more."
)

# Incomplete scraps — trail-offs, mid-clause cuts (not display truncation).
_INCOMPLETE_TAIL = re.compile(
    r"(?:--+|…|\.\.\.)\s*$|"
    r"\([^)]*$|"
    r"\b(?:and even if|or else|or so he thinks|because (?:he|she|they)|"
    r"considering how|even while)\s*$|"
    r"[,;:]\s*$|"
    r"\b(?:was|were|the|a|an|to|for|that|when|if|but|and|or|of)\s*$",
    re.I,
)

# Author continuity / awareness sticky — keep for who-is later; not task-list.
_CONTINUITY_STICKY = re.compile(
    r"\b("
    r"(?:is|are|was|were|becomes?|remains?)\s+aware\s+that|"
    r"(?:does not|doesn't|doesnt)\s+yet\s+(?:want|realize|know|understand)|"
    r"not yet\s+(?:realize|know|understand)|"
    r"doesn'?t\s+yet\s+realize|"
    r"i think i mentioned|"
    r"i(?:'?m| am)\s+also\s+thinking|"
    r"i(?:'?m| am)\s+thinking\s+that|"
    r"how (?:he|she|they|the character)\s+feels\s+until|"
    r"for (?:me|myself)\s+as\s+i\s+write|"
    r"keep(?:s|ing)?\s+(?:in\s+mind|aware)\s+when\s+writing|"
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

# Dramatizable write-next — scene/reveal/power/conflict you might put on the page.
_DRAMATIZABLE = re.compile(
    r"\b("
    r"secret|secrets|reveal|reveals|revealed|bitterness|resents?|resentment|"
    r"power|powers|ability|abilities|condition|conditions|identity|alias|"
    r"planned\s*:|need(?:s)?\s+to\s+(?:write|draft)|"
    r"should\s+(?:write|draft|show|hint)|"
    r"still\s+(?:need|have)\s+to\s+(?:write|draft)|"
    r"chase|snapped|bridge|ritual|plot\s+beat|"
    r"court\s+politics|political\s+pressures?|not helping|"
    r"left (?:him|her|them) to dry|heavier load|"
    r"scene needs|write the|dramatize|on (?:the\s+)?page|"
    r"fascinated study|guest rather than|open gap"
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


def _line_is_incomplete(line: str) -> bool:
    """True for mid-trail-off scraps — not usable as a task bullet."""
    s = (line or "").strip()
    if not s:
        return True
    if _INCOMPLETE_TAIL.search(s):
        return True
    # Em-dash / double-dash cut mid-thought (owner failure shape).
    if re.search(r"[—–-]{2,}\s*\S*$", s) and not s.rstrip().endswith((".", "!", "?")):
        if re.search(r"(--|—|–)\s*$", s) or "—" in s[-12:]:
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


def claim_is_write_next_task(line: str) -> bool:
    """
    Task-list only: dramatizable unused lore you might put on the page.
    Drops incomplete scraps, continuity sticky-notes, and soft standing lore.
    """
    s = (line or "").strip()
    if not s or _line_is_incomplete(s):
        return False
    dramatizable = bool(_DRAMATIZABLE.search(s) or _RELATIONSHIP_TENSION.search(s))
    if _is_continuity_or_musing(s):
        # Continuity wins unless the line is clearly a dramatizable deliverable
        # that only happens to mention awareness wording.
        return dramatizable and bool(_DRAMATIZABLE.search(s))
    if dramatizable:
        return True
    return False


def filter_write_next_tasks(
    items: list[dict[str, str]],
) -> list[dict[str, str]]:
    """Keep only write-next-shaped unused claims for the task-list Ask."""
    out: list[dict[str, str]] = []
    for row in items:
        line = str(row.get("line") or "")
        if claim_is_write_next_task(line):
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
    # Tokens that flood the draft are usually cast names — weak as proof alone.
    from collections import Counter

    freq = Counter(draft_words)
    distinctive = [
        t for t in content if len(t) >= 4 and freq.get(t, 0) <= 6
    ]
    if len(distinctive) < 4:
        distinctive = [t for t in content if len(t) >= 4] or content
    # Ordered 3-token distinctive phrase still in draft (paraphrase-friendly).
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
    unused_but_not_tasks: bool = False,
) -> str:
    """Short bullet task list — dramatizable write-next only."""
    work = _work_phrase(work_hints)
    topic_s = (topic or "").strip()
    if topic_s:
        lead = (
            f"Here's a short task list for {work} about {topic_s} — "
            f"write-next items from your notes, not yet in the main draft:\n"
        )
    else:
        lead = (
            f"Here's a short task list for {work} — "
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
        for row in items[:MAX_TASK_ITEMS]:
            bullet = _task_bullet_line(str(row.get("line") or ""))
            if not bullet:
                continue
            if not first:
                lines.append("")  # one blank line between bullets
            lines.append(f"• {bullet}")
            first = False
        shown = min(len(items), MAX_TASK_ITEMS)
        extra = max(0, int(total_before_cap) - shown)
        if extra > 0:
            lines.append(
                f"\n…and {extra} more write-next item(s). "
                "Name a topic (chase, Court politics, …) or ask again for more."
            )
    elif unused_but_not_tasks:
        if topic_s:
            lines.append(
                f"Notes about {topic_s} have unused lines, but none looked like "
                "write-next tasks (reveals, scenes, powers, dramatizable conflict). "
                "Continuity sticky-notes and standing lore are left out of this list."
            )
        else:
            lines.append(
                "Notes have unused lines, but none looked like write-next tasks "
                "(reveals, scenes, powers, dramatizable conflict). "
                "Continuity sticky-notes and standing lore are left out of this list."
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
    Librarian only — never invents tasks. Continuity sticky-notes stay out.
    """
    items, has_notes, has_draft = collect_notes_not_in_draft(entries)
    topic = extract_writing_next_topic(question)
    if topic:
        items = filter_unused_by_topic(items, topic)
    anchors = extract_after_anchors(question)
    if anchors:
        items = filter_unused_by_after_anchors(items, anchors)

    cleaned = _near_dedupe_items(items) if items else []
    # Task list: second pass so paraphrased draft beats don't count as unused.
    cleaned = filter_already_in_draft_for_tasks(cleaned, entries)
    tasks = filter_write_next_tasks(cleaned)
    unused_but_not_tasks = bool(cleaned) and not bool(tasks)
    ranked = (
        _rank_tasks_leave_off_first(tasks, entries) if tasks else []
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
        unused_but_not_tasks=unused_but_not_tasks,
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
    if not source_ids and has_notes and not topic and shown:
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