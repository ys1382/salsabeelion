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
            if cue is _WHEN_CUE:
                try:
                    from lorekeeper_writing_next import line_is_later_book

                    if line_is_later_book(sentence):
                        score += 8
                except Exception:
                    pass
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


_WHEN_WILL_Q = re.compile(
    r"\bwhen\s+(?:will|do|does|did|is|are)\b",
    re.I,
)
_TIMING_IN_ANSWER = re.compile(
    r"\b("
    r"later\s+book|future\s+book|next\s+book|first\s+book|"
    r"this\s+book|this\s+work|later\s+in\s+the\s+series|"
    r"not\s+a\s+plot\s+point|"
    r"rather\s+than.{0,48}(?:this|the first)|"
    r"unspecified|not\s+(?:yet\s+)?specified"
    r")\b",
    re.I,
)
_FOOTER_MARKS = (
    "— From your notes only",
    "— Pulled from your notes only",
    "— From your notes vs draft only",
)


def is_when_timing_question(question: str) -> bool:
    """True for 'when will / when do they find out' plot-placement asks."""
    return bool(_WHEN_WILL_Q.search(question or ""))


def _peel_footer(answer: str) -> tuple[str, str]:
    text = (answer or "").strip()
    for mark in _FOOTER_MARKS:
        idx = text.find(mark)
        if idx >= 0:
            return text[:idx].rstrip(), text[idx:].strip()
    return text, ""


def _work_label(entries: list[dict[str, Any]]) -> str:
    counts: dict[str, int] = {}
    for entry in entries or []:
        if not isinstance(entry, dict):
            continue
        for tag in entry.get("tags") or []:
            s = str(tag).strip()
            if s:
                counts[s] = counts.get(s, 0) + 1
    if not counts:
        return ""
    return max(counts.items(), key=lambda kv: kv[1])[0]


def notes_mark_later_book_for_question(
    question: str, entries: list[dict[str, Any]]
) -> bool:
    """True when a note about the asked beat places it in a later book."""
    from lorekeeper_writing_next import line_is_later_book
    from lorekeeper_notes_vs_draft import _content_tokens, _normalize

    q_toks = {
        t
        for t in _content_tokens(question or "")
        if len(t) >= 4
        and t
        not in {
            "when",
            "will",
            "does",
            "find",
            "that",
            "from",
            "their",
            "them",
            "this",
            "have",
        }
    }
    if not q_toks:
        return False
    for entry in entries or []:
        if not isinstance(entry, dict):
            continue
        blob = f"{entry.get('title') or ''} {entry.get('body') or ''}"
        if not line_is_later_book(blob):
            continue
        norm = _normalize(blob)
        hits = sum(1 for t in q_toks if t in norm)
        if hits >= 1:
            return True
    return False


def _timing_lead_sentence(work: str) -> str:
    if work:
        return (
            "Your notes mark this as a concern for later books in the series "
            f"rather than a plot point for {work} itself."
        )
    return (
        "Your notes mark this as a concern for later books rather than "
        "a plot point for this book."
    )


def ensure_when_timing_completeness(
    question: str,
    entries: list[dict[str, Any]],
    answer: str,
) -> tuple[str, bool]:
    """
    When-asks: lead with later-book vs this-book if notes say so.
    Librarian only — never invents a reveal the notes do not place.
    """
    if not is_when_timing_question(question):
        return (answer or "").strip(), False
    body, footer = _peel_footer(answer)
    if not body.strip():
        return (answer or "").strip(), False
    has_timing = bool(_TIMING_IN_ANSWER.search(body))
    later = notes_mark_later_book_for_question(question, entries)
    sentences = [
        p.strip()
        for p in re.split(r"(?<=[.!?])\s+", body.strip())
        if p.strip()
    ]
    changed = False
    if later and not has_timing:
        lead = _timing_lead_sentence(_work_label(entries))
        sentences = [lead] + [
            s for s in sentences if _normalize_sent(s) != _normalize_sent(lead)
        ]
        changed = True
    elif not later and not has_timing:
        # Notes do not place it — keep the answer; do not invent a book.
        return (answer or "").strip(), False
    # Keep the timing sentence plus at most two supporting ones.
    kept: list[str] = []
    if sentences:
        kept.append(sentences[0])
        for s in sentences[1:]:
            if len(kept) >= 3:
                break
            kept.append(s)
        if len(sentences) > 3:
            changed = True
    out = " ".join(kept).strip()
    if footer:
        out = out + "\n\n" + footer
    return out, changed or out.strip() != (answer or "").strip()


def _normalize_sent(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())
