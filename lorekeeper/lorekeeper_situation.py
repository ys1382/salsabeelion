"""LoreKeeper — phased situation summaries for politics, factions, alliances (#17)."""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_reliability import (
    extract_work_hints,
    filter_entries_by_work,
    work_named_in_question,
)

SITUATION_HINT = re.compile(
    r"\b("
    r"politic\w*|intrigue|faction|factions|alliance|alliances|loyalt|"
    r"coup|rebellion|revolt|uprising|treaty|betray|betrayal|"
    r"power struggle|succession|regime|government|ruling|"
    r"political situation|political landscape|who controls|"
    r"coalition|bloc|factional|court intrigue"
    r")\b",
    re.I,
)

_PLANNING_RE = re.compile(
    r"\b("
    r"i think|i thought|maybe|perhaps|not sure|wonder if|"
    r"not decided|not written|haven't written|have not written|"
    r"tbd|to be decided|figure out|work out later|fix later|"
    r"don't know yet|do not know yet|need to decide|still deciding|"
    r"planning note|outline|todo|note to self|might change"
    r")\b",
    re.I,
)

_SHIFTING_RE = re.compile(
    r"\b("
    r"formerly|once allied|no longer|broke (?:the )?alliance|"
    r"betrayed|shifted sides|changed sides|turned against|"
    r"was allied|used to support|before the (?:war|coup|treaty)|"
    r"after the (?:war|coup|betrayal)|might ally|considering an alliance|"
    r"unclear|unsettled|undecided|in flux|wavering|splintered|"
    r"defected|rebelled|switched allegiance|loyalty is unknown"
    r")\b",
    re.I,
)

_GAP_RE = re.compile(
    r"\b("
    r"not (?:yet )?(?:written|decided|established|clear)|"
    r"haven't (?:written|decided)|have not (?:written|decided)|"
    r"tbd|to be decided|still open|open question|"
    r"don't know (?:yet )?whether|unsure whether|"
    r"need to (?:write|decide)|figure out whether"
    r")\b",
    re.I,
)

_POLITICS_KINDS = frozenset({"politics", "faction", "event"})

_POLITICS_BODY = re.compile(
    r"\b("
    r"allied|alliance|faction|loyal|betray|coup|treaty|rebel|"
    r"controls?|rules?|governs?|throne|crown|coalition|succession|"
    r"intrigue|scheme|power|regime|uprising|revolt"
    r")\b",
    re.I,
)


def is_situation_question(question: str) -> bool:
    return bool(SITUATION_HINT.search(question or ""))


def _split_sentences(text: str) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [p.strip() for p in parts if p.strip()]


def _scope_entries(question: str, entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    work_hints = extract_work_hints(question, entries)
    if not work_hints:
        return [e for e in entries if isinstance(e, dict)]
    return filter_entries_by_work(
        entries, work_hints, strict=work_named_in_question(question)
    )


def _entry_relevant(entry: dict[str, Any], terms: list[str]) -> bool:
    kind = str(entry.get("kind") or "").lower()
    title = str(entry.get("title") or "")
    body = str(entry.get("body") or "")
    blob = f"{title}\n{body}".lower()
    if kind in _POLITICS_KINDS:
        return bool(body.strip())
    if _POLITICS_BODY.search(blob):
        return True
    for term in terms:
        if len(term) > 3 and term in blob:
            return True
    return False


def _classify_sentence(sentence: str) -> str:
    s = (sentence or "").strip()
    if not s or len(s) < 12:
        return "skip"
    if _GAP_RE.search(s):
        return "gap"
    if _PLANNING_RE.search(s):
        return "gap"
    if _SHIFTING_RE.search(s):
        return "shifting"
    if _POLITICS_BODY.search(s):
        return "settled"
    return "skip"


def _to_reference_line(sentence: str) -> str:
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    if not s:
        return ""
    s = re.sub(
        r"^(?:I think|I thought|Maybe|Perhaps|Note:|Planning:)\s+",
        "",
        s,
        flags=re.I,
    )
    s = s.rstrip(".!?") + "."
    return s


def _situation_heading(question: str, work_title: str | None) -> str:
    q = (question or "").lower()
    if re.search(r"political situation", q):
        topic = "Political situation"
    elif "politics" in q:
        topic = "Politics"
    elif re.search(r"\bfaction", q):
        topic = "Factions"
    elif re.search(r"\balliance", q):
        topic = "Alliances"
    else:
        topic = "Political situation"
    if work_title:
        return f"{topic} ({work_title})"
    return topic


def _dedupe_lines(lines: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        key = re.sub(r"\s+", " ", line.lower())[:120]
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(line)
    return out


def collect_situation_phases(
    question: str,
    entries: list[dict[str, Any]],
    *,
    terms: list[str] | None = None,
) -> tuple[list[str], list[str], list[str], list[str]]:
    """Return settled, shifting, gap lines and source ids."""
    scope = _scope_entries(question, entries)
    settled: list[str] = []
    shifting: list[str] = []
    gaps: list[str] = []
    source_ids: list[str] = []

    for entry in scope:
        if not isinstance(entry, dict):
            continue
        if not _entry_relevant(entry, terms or []):
            continue
        eid = str(entry.get("id") or "")
        body = str(entry.get("body") or "").strip()
        if not body:
            continue
        if eid:
            parent = eid.split("#", 1)[0] if "#p" in eid else eid
            if parent and parent not in source_ids:
                source_ids.append(parent)

        for sentence in _split_sentences(body):
            bucket = _classify_sentence(sentence)
            line = _to_reference_line(sentence)
            if not line:
                continue
            if bucket == "settled":
                settled.append(line)
            elif bucket == "shifting":
                shifting.append(line)
            elif bucket == "gap":
                gaps.append(line)

    return (
        _dedupe_lines(settled)[:6],
        _dedupe_lines(shifting)[:5],
        _dedupe_lines(gaps)[:4],
        source_ids[:12],
    )


def compose_situation_summary(
    question: str,
    settled: list[str],
    shifting: list[str],
    gaps: list[str],
    *,
    work_title: str | None = None,
) -> str:
    """Reference-voice phased summary — settled, in flux, not written yet (#17)."""
    heading = _situation_heading(question, work_title)
    paragraphs: list[str] = []

    if settled:
        body = " ".join(settled[:4])
        paragraphs.append(body)

    if shifting:
        prefix = "In flux: " if paragraphs else ""
        body = prefix + " ".join(shifting[:3])
        paragraphs.append(body)

    if gaps:
        gap_text = " ".join(gaps[:3])
        if not re.match(r"^(not|whether|tbd)", gap_text, re.I):
            gap_text = f"Not yet written in your notes: {gap_text}"
        paragraphs.append(gap_text)

    if not paragraphs:
        return ""

    return f"{heading}\n\n" + "\n\n".join(paragraphs) + "\n\n— From your notes only. Nothing invented."


def compose_situation_gap(question: str, *, work_title: str | None = None) -> str:
    heading = _situation_heading(question, work_title)
    return (
        f"{heading}\n\n"
        "Nothing substantial yet on factions, alliances, or who holds power in what you've saved.\n\n"
        "— From your notes only. Nothing invented."
    )


def situation_blocks_for_prompt(
    question: str, entries: list[dict[str, Any]]
) -> dict[str, list[str]]:
    """Structured phases for RAG user prompt."""
    settled, shifting, gaps, _ = collect_situation_phases(question, entries)
    return {"settled": settled, "shifting": shifting, "gaps": gaps}


def build_situation_answer(
    question: str, entries: list[dict[str, Any]]
) -> tuple[str | None, list[str]]:
    if not is_situation_question(question):
        return None, []
    settled, shifting, gaps, source_ids = collect_situation_phases(question, entries)
    work_hints = extract_work_hints(question, entries)
    work_title = next(iter(sorted(work_hints, key=len, reverse=True)), None)
    work_title = work_title.title() if work_title else None

    if not settled and not shifting and not gaps:
        return compose_situation_gap(question, work_title=work_title), source_ids

    summary = compose_situation_summary(
        question,
        settled,
        shifting,
        gaps,
        work_title=work_title,
    )
    return summary or None, source_ids
