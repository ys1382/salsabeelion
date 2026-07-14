"""LoreKeeper — evidence-only reference / allusion reading (#18)."""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_reliability import (
    extract_work_hints,
    filter_entries_by_work,
    work_named_in_question,
)

_TALE_OF = r"(?:(?:the\s+)?(?:(?:fairy\s+)?tale|story|myth|legend)\s+of\s+)?"
_SOURCE_NAME = r"([A-Z][\w'’\-]+(?:\s+[A-Z][\w'’\-]+){0,5})"


def _question_targets(question: str) -> list[str]:
    from lorekeeper_character_summary import character_targets

    return character_targets(question)

ALLUSION_QUESTION = re.compile(
    r"\b("
    r"allusion|allusions|reference|references|inspo|inspiration|"
    r"based on|inspired by|retelling of|source material|source tale|"
    r"allusion to|reference to|homage|parallel to|draws? from|"
    r"what tale|which tale|what story|which story|"
    r"literary roots?|story roots?"
    r")\b",
    re.I,
)

_REFERENCE_KINDS = frozenset({"reference", "theme", "note"})

# Explicit writer-stated ties only — never infer from names or outside knowledge.
_EVIDENCE: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "based_on",
        re.compile(
            rf"\b(?:based on|inspired by|homage to|draws? from|retelling of)\s+"
            rf"{_TALE_OF}{_SOURCE_NAME}",
            re.I,
        ),
    ),
    (
        "reference_to",
        re.compile(
            rf"\b(?:reference to|allusion to|parallel (?:to|with)|connect(?:s|ed)? to)\s+"
            rf"{_TALE_OF}{_SOURCE_NAME}",
            re.I,
        ),
    ),
    (
        "events_of",
        re.compile(
            rf"\b(?:in|during|after|before)\s+the events of\s+{_SOURCE_NAME}",
            re.I,
        ),
    ),
    (
        "character_tie",
        re.compile(
            rf"\b([A-Z][\w'’\-]+(?:\s+[A-Z][\w'’\-]+)?)\s+"
            rf"(?:is|was)\s+(?:a\s+)?(?:based on|inspired by|a retelling of|drawn from)\s+"
            rf"{_TALE_OF}{_SOURCE_NAME}",
            re.I,
        ),
    ),
    (
        "writer_labels",
        re.compile(
            rf"\b(?:known tale|source tale|reference tale|alludes to)\s*[:—–-]\s*"
            rf"{_SOURCE_NAME}",
            re.I,
        ),
    ),
)

_INVENTION_GUARD = re.compile(
    r"\b(?:probably|likely|clearly|obviously|must be|reminiscent of|"
    r"echoes|similar to|like the famous)\b",
    re.I,
)


def is_allusion_question(question: str) -> bool:
    return bool(ALLUSION_QUESTION.search(question or ""))


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


def _clean_source(raw: str) -> str:
    s = re.sub(r"^[\"“']|[\"”']$", "", (raw or "").strip())
    s = re.sub(r"\s+", " ", s).strip(" .,;:")
    s = re.split(r"\s+(?:in this|for this|where|when|who)\b", s, maxsplit=1, flags=re.I)[0]
    return s.strip(" .,;:")


def _name_in_text(name: str, text: str) -> bool:
    if not name or not text:
        return False
    return bool(re.search(rf"\b{re.escape(name)}\b", text, re.I))


def _entry_id(entry: dict[str, Any]) -> str:
    eid = str(entry.get("id") or "")
    if "#p" in eid:
        return eid.split("#", 1)[0]
    return eid


def _sentence_ok(sentence: str) -> bool:
    if not sentence or len(sentence) < 15:
        return False
    if _INVENTION_GUARD.search(sentence):
        return False
    return True


def _reference_line(
    *,
    subject: str | None,
    source: str,
    sentence: str,
    tie_type: str,
) -> str:
    source = _clean_source(source)
    if not source:
        return ""
    subj = (subject or "").strip()
    if subj and tie_type == "character_tie":
        return f"{subj} is tied in your notes to {source}."
    if subj and _name_in_text(subj, sentence):
        return f"{subj} is tied in your notes to {source}."
    if re.search(rf"\b{re.escape(source)}\b", sentence, re.I):
        return sentence.rstrip(".") + "."
    return f"Your notes tie this work to {source}."


def collect_allusion_evidence(
    question: str,
    entries: list[dict[str, Any]],
) -> tuple[list[dict[str, str]], list[str]]:
    """Return evidence rows and source ids — explicit ties only."""
    scope = _scope_entries(question, entries)
    targets = _question_targets(question)
    target_low = {t.lower() for t in targets}
    rows: list[dict[str, str]] = []
    source_ids: list[str] = []
    seen: set[str] = set()

    def add_row(
        *,
        subject: str | None,
        source: str,
        sentence: str,
        tie_type: str,
        eid: str,
    ) -> None:
        line = _reference_line(
            subject=subject, source=source, sentence=sentence, tie_type=tie_type
        )
        if not line:
            return
        key = (line.lower()[:100], _clean_source(source).lower())
        if key in seen:
            return
        seen.add(key)
        rows.append(
            {
                "subject": subject or "",
                "source": _clean_source(source),
                "line": line,
                "tie_type": tie_type,
            }
        )
        if eid and eid not in source_ids:
            source_ids.append(eid)

    for entry in scope:
        if not isinstance(entry, dict):
            continue
        body = str(entry.get("body") or "").strip()
        title = str(entry.get("title") or "").strip()
        kind = str(entry.get("kind") or "").lower()
        if not body and not title:
            continue
        blob = f"{title}\n{body}".strip()
        eid = _entry_id(entry)

        if targets:
            if not any(_name_in_text(t, blob) for t in targets):
                if kind not in _REFERENCE_KINDS and kind != "character":
                    continue

        for sentence in _split_sentences(blob):
            if not _sentence_ok(sentence):
                continue
            for tie_type, pattern in _EVIDENCE:
                if tie_type == "character_tie":
                    for m in pattern.finditer(sentence):
                        subj = m.group(1).strip()
                        source = m.group(2)
                        if targets and subj.lower() not in target_low:
                            if not any(_name_in_text(t, sentence) for t in targets):
                                continue
                        add_row(
                            subject=subj,
                            source=source,
                            sentence=sentence,
                            tie_type=tie_type,
                            eid=eid,
                        )
                else:
                    m = pattern.search(sentence)
                    if not m:
                        continue
                    source = m.group(1)
                    subj = targets[0] if len(targets) == 1 else None
                    add_row(
                        subject=subj,
                        source=source,
                        sentence=sentence,
                        tie_type=tie_type,
                        eid=eid,
                    )

    return rows[:10], source_ids[:12]


def _heading(question: str, work_title: str | None) -> str:
    targets = _question_targets(question)
    if targets:
        label = targets[0]
        if work_title:
            return f"Reference ties — {label} ({work_title})"
        return f"Reference ties — {label}"
    if work_title:
        return f"Reference / allusion ties ({work_title})"
    return "Reference / allusion ties"


def compose_allusion_summary(
    question: str,
    evidence: list[dict[str, str]],
    *,
    work_title: str | None = None,
) -> str:
    if not evidence:
        return ""
    heading = _heading(question, work_title)
    lines = [line for row in evidence if (line := str(row.get("line") or "").strip())]
    body = " ".join(lines[:4])
    return f"{heading}\n\n{body}\n\n— From your notes only. Nothing invented."


def compose_allusion_gap(question: str, *, work_title: str | None = None) -> str:
    heading = _heading(question, work_title)
    targets = _question_targets(question)
    if targets:
        subj = targets[0]
        gap = (
            f"No tale or source ties are stated in your saved notes for {subj}. "
            "Similar names alone are not treated as evidence."
        )
    else:
        gap = (
            "No tale or source ties are stated in your saved notes for this work. "
            "Similar names alone are not treated as evidence."
        )
    return f"{heading}\n\n{gap}\n\n— From your notes only. Nothing invented."


def allusion_lines_for_prompt(
    question: str, entries: list[dict[str, Any]]
) -> list[str]:
    rows, _ = collect_allusion_evidence(question, entries)
    return [str(r.get("line") or "").strip() for r in rows if r.get("line")]


def build_allusion_answer(
    question: str, entries: list[dict[str, Any]]
) -> tuple[str | None, list[str]]:
    if not is_allusion_question(question):
        return None, []
    evidence, source_ids = collect_allusion_evidence(question, entries)
    work_hints = extract_work_hints(question, entries)
    work_title = next(iter(sorted(work_hints, key=len, reverse=True)), None)
    work_title = work_title.title() if work_title else None

    if not evidence:
        return compose_allusion_gap(question, work_title=work_title), source_ids

    summary = compose_allusion_summary(
        question, evidence, work_title=work_title
    )
    return summary or None, source_ids
