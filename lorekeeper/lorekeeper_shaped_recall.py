"""LoreKeeper — shaped Ask routes: where, when, list (#39)."""
from __future__ import annotations

import re
from typing import Any, Callable, Literal

ShapedKind = Literal["where", "when", "list"]

_WHERE_Q = re.compile(r"\bwhere\b", re.I)
_WHEN_Q = re.compile(r"\bwhen\b", re.I)
_LIST_Q = re.compile(
    r"\b(list|how many|name all|which factions|what factions|all the factions)\b",
    re.I,
)

_WHERE_CUE = re.compile(
    r"\b(in|at|near|inside|outside|north|south|east|west|gate|city|hall|room|"
    r"castle|village|forest|mountain|river|bridge|tower|palace|capital|region|"
    r"located|based|lives in|lived in)\b",
    re.I,
)
_WHEN_CUE = re.compile(
    r"\b(when|before|after|during|year|years|month|day|century|era|timeline|"
    r"first|then|later|finally|once|while|until|since|ago|birth|death|born|"
    r"died|married|founded|started|ended)\b",
    re.I,
)
_FACTION_CUE = re.compile(
    r"\b(faction|factions|alliance|alliances|party|parties|house|houses|clan|"
    r"clans|order|orders|guild|guilds|tribe|tribes|side|sides)\b",
    re.I,
)


def is_where_question(question: str) -> bool:
    return bool(_WHERE_Q.search(question or ""))


def is_when_question(question: str) -> bool:
    return bool(_WHEN_Q.search(question or ""))


def is_list_question(question: str) -> bool:
    return bool(_LIST_Q.search(question or ""))


def shaped_question_kind(question: str) -> ShapedKind | None:
    if is_list_question(question):
        return "list"
    if is_where_question(question):
        return "where"
    if is_when_question(question):
        return "when"
    return None


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", (text or "").strip())
    return [p.strip() for p in parts if len(p.strip()) >= 12]


def _pick_sentences(
    question: str,
    scoped: list[dict[str, Any]],
    *,
    cue: re.Pattern[str],
    tokenize: Callable[[str], list[str]],
    best_excerpt: Callable[[str, list[str], int], str],
    max_items: int = 4,
) -> tuple[str | None, list[str]]:
    q_tokens = tokenize(question)
    hits: list[tuple[int, str, str, str]] = []
    for entry in scoped:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        title = str(entry.get("title") or "Untitled")
        body = str(entry.get("body") or "")
        for sentence in _sentences(body):
            if not cue.search(sentence):
                continue
            score = sum(1 for t in q_tokens if len(t) > 3 and t in sentence.lower())
            if score <= 0 and not cue.search(question or ""):
                continue
            hits.append((score, eid, title, sentence))
    if not hits:
        for entry in scoped:
            if not isinstance(entry, dict):
                continue
            eid = str(entry.get("id") or "")
            title = str(entry.get("title") or "Untitled")
            excerpt = best_excerpt(str(entry.get("body") or ""), q_tokens, 280)
            if excerpt and cue.search(excerpt):
                hits.append((1, eid, title, excerpt))
    if not hits:
        return None, []

    hits.sort(key=lambda row: row[0], reverse=True)
    lines: list[str] = []
    ids: list[str] = []
    for _, eid, title, sentence in hits[:max_items]:
        if eid and eid not in ids:
            ids.append(eid)
        lines.append(f"• From “{title}”: {sentence}")
    return "\n".join(lines), ids


def _answer_list(
    question: str,
    scoped: list[dict[str, Any]],
    *,
    tokenize: Callable[[str], list[str]],
    best_excerpt: Callable[[str, list[str], int], str],
) -> tuple[str | None, list[str]]:
    want_factions = bool(_FACTION_CUE.search(question or ""))
    q_tokens = tokenize(question)
    items: list[tuple[int, str, str, str]] = []
    for entry in scoped:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        title = str(entry.get("title") or "Untitled")
        body = str(entry.get("body") or "")
        for sentence in _sentences(body):
            if want_factions and not _FACTION_CUE.search(sentence):
                continue
            score = sum(1 for t in q_tokens if len(t) > 3 and t in sentence.lower())
            if want_factions:
                score += 2
            if score <= 0 and not want_factions:
                score = 1 if any(t in sentence.lower() for t in q_tokens if len(t) > 3) else 0
            if score <= 0:
                continue
            items.append((score, eid, title, sentence))
    if not items:
        return None, []
    items.sort(key=lambda row: row[0], reverse=True)
    lines = ["From your saved notes:\n"]
    ids: list[str] = []
    for _, eid, title, sentence in items[:5]:
        if eid and eid not in ids:
            ids.append(eid)
        lines.append(f"• {sentence}")
    lines.append("\n— Pulled from your notes only. Nothing invented.")
    return "\n".join(lines), ids


def answer_shaped_recall(
    question: str,
    scoped: list[dict[str, Any]],
    kind: ShapedKind,
    *,
    tokenize: Callable[[str], list[str]],
    best_excerpt: Callable[[str, list[str], int], str],
) -> tuple[str | None, list[str]]:
    if kind == "list":
        return _answer_list(question, scoped, tokenize=tokenize, best_excerpt=best_excerpt)
    cue = _WHERE_CUE if kind == "where" else _WHEN_CUE
    body, ids = _pick_sentences(
        question,
        scoped,
        cue=cue,
        tokenize=tokenize,
        best_excerpt=best_excerpt,
    )
    if not body:
        return None, []
    label = "place" if kind == "where" else "time"
    intro = f"What you've saved about {label}:\n\n{body}"
    intro += "\n\n— Pulled from your notes only. Nothing invented."
    return intro, ids
