"""LoreKeeper — plot-span Ask anchors (beginning with / ending with).

When the writer names a story stretch, retrieval must surface notes for
*both* ends — not only early setup that wins keyword rank.
"""
from __future__ import annotations

import re
from typing import Any

_STOPWORDS = frozenset(
    {
        "a",
        "an",
        "the",
        "and",
        "or",
        "but",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "as",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "with",
        "from",
        "by",
        "into",
        "about",
        "that",
        "this",
        "these",
        "those",
        "whatever",
        "happens",
        "happened",
        "stuff",
        "related",
        "plot",
        "all",
        "me",
        "tell",
        "remind",
        "show",
    }
)

_BEGIN = re.compile(
    r"\b(?:beginning|starting)\s+with\s+(?:the\s+)?(.+?)(?="
    r"\s+and\s+ending\b|"
    r"\s+ending\s+with\b|"
    r"\s*,\s*ending\b|"
    r"\s*[?.!]?\s*$"
    r")",
    re.I,
)
_END = re.compile(
    r"\bending\s+with\s+(.+?)(?=\s*[?.!]?\s*$)",
    re.I,
)
_LEADING = re.compile(
    r"\bleading\s+up\s+to\s+(?:and\s+including\s+)?(.+?)(?="
    r"\s*,\s*beginning\b|"
    r"\s+beginning\s+with\b|"
    r"\s+starting\s+with\b|"
    r"\s+ending\s+with\b|"
    r"\s*[?.!]?\s*$"
    r")",
    re.I,
)
_THROUGH = re.compile(
    r"\bfrom\s+(?:the\s+)?(.+?)\s+(?:through|to|until)\s+(?:the\s+)?(.+?)(?="
    r"\s*[?.!]?\s*$|"
    r"\s*,\s*beginning\b|"
    r"\s+beginning\s+with\b"
    r")",
    re.I,
)
_SPAN_CUE = re.compile(
    r"\b("
    r"beginning\s+with|ending\s+with|leading\s+up\s+to|"
    r"from\s+.+\s+(?:through|to|until)\b|"
    r"plot[- ]related|all\s+the\s+plot|"
    r"what\s+happens\s+after|after\s+the\s+.+\s+including"
    r")\b",
    re.I,
)


def _normalize(text: str) -> str:
    t = (text or "").lower()
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _content_tokens(text: str) -> list[str]:
    return [
        tok
        for tok in _normalize(text).split()
        if len(tok) >= 3 and tok not in _STOPWORDS
    ]


def _clean_anchor(raw: str) -> str:
    cleaned = re.sub(r"\s+", " ", (raw or "").strip()).strip(" \t\"'“”‘’?.!,")
    cleaned = re.sub(
        r"\s+that\s+\w+\s+has\b.*$",
        "",
        cleaned,
        flags=re.I,
    ).strip()
    if not cleaned or len(cleaned) > 120:
        return ""
    if not _content_tokens(cleaned):
        return ""
    return cleaned[:100]


def extract_plot_span_anchors(question: str) -> dict[str, list[str]]:
    """
    Parse begin / end / mid story-beat anchors from a plot-span question.

    Returns {"start": [...], "end": [...], "mid": [...]} — lists may be empty.
    """
    q = (question or "").strip()
    out: dict[str, list[str]] = {"start": [], "end": [], "mid": []}
    if not q:
        return out
    seen: set[str] = set()

    def add(bucket: str, raw: str) -> None:
        cleaned = _clean_anchor(raw)
        if not cleaned:
            return
        key = cleaned.lower()
        if key in seen:
            return
        seen.add(key)
        out[bucket].append(cleaned)

    m = _BEGIN.search(q)
    if m:
        add("start", m.group(1))
    m = _END.search(q)
    if m:
        add("end", m.group(1))
    m = _LEADING.search(q)
    if m:
        add("mid", m.group(1))
    m = _THROUGH.search(q)
    if m:
        add("start", m.group(1))
        add("end", m.group(2))

    # Reuse notes-vs-draft "after X / including after Y" as mid/start cues.
    try:
        from lorekeeper_notes_vs_draft import extract_after_anchors

        for a in extract_after_anchors(q):
            # First after-anchor is usually the start beat.
            if not out["start"]:
                add("start", a)
            else:
                add("mid", a)
    except Exception:
        pass

    return out


def is_plot_span_question(question: str) -> bool:
    """True when the ask names a story stretch with begin/end (or after+including)."""
    q = question or ""
    if not _SPAN_CUE.search(q):
        return False
    anchors = extract_plot_span_anchors(q)
    named = len(anchors["start"]) + len(anchors["end"]) + len(anchors["mid"])
    if named >= 2:
        return True
    # Explicit begin+end phrasing even if one parse failed lightly.
    if _BEGIN.search(q) and _END.search(q):
        return True
    if re.search(r"\bafter\b.+\bincluding\b", q, re.I):
        return True
    return False


def all_span_anchors(question: str) -> list[str]:
    """Flat unique anchors, end first (highest retrieval priority)."""
    a = extract_plot_span_anchors(question)
    ordered: list[str] = []
    seen: set[str] = set()
    for bucket in ("end", "start", "mid"):
        for phrase in a[bucket]:
            key = phrase.lower()
            if key in seen:
                continue
            seen.add(key)
            ordered.append(phrase)
    return ordered


def text_matches_anchor(text: str, anchor: str) -> bool:
    """True when enough distinctive tokens from the beat phrase appear in text."""
    hay = _normalize(text)
    if not hay or not anchor:
        return False
    if _normalize(anchor) in hay:
        return True
    toks = _content_tokens(anchor)
    if not toks:
        return False
    hits = sum(1 for t in toks if t in hay)
    need = 1 if len(toks) <= 2 else max(2, (len(toks) + 1) // 2)
    return hits >= need


def entry_matches_anchor(entry: dict[str, Any], anchor: str) -> bool:
    title = str(entry.get("title") or "")
    body = str(entry.get("body") or "")
    tags = " ".join(str(t) for t in (entry.get("tags") or []))
    return text_matches_anchor(f"{title} {body} {tags}", anchor)


def score_boost_for_plot_span(question: str, entry: dict[str, Any]) -> int:
    """Extra rank points so start/end notes beat early-setup keyword wins."""
    if not is_plot_span_question(question):
        return 0
    anchors = extract_plot_span_anchors(question)
    boost = 0
    for phrase in anchors.get("end") or []:
        if entry_matches_anchor(entry, phrase):
            boost = max(boost, 36)
    for phrase in anchors.get("start") or []:
        if entry_matches_anchor(entry, phrase):
            boost = max(boost, 28)
    for phrase in anchors.get("mid") or []:
        if entry_matches_anchor(entry, phrase):
            boost = max(boost, 24)
    return boost


def augment_ranked_for_plot_span(
    question: str,
    scoped: list[dict[str, Any]],
    ranked: list[dict[str, Any]],
    *,
    rank_entry,
    kind_label,
    best_excerpt,
    tokenize,
) -> list[dict[str, Any]]:
    """
    Force-include notes that match begin/end/mid anchors.

    End-anchor matches get the strongest score so they survive top-K trim.
    """
    if not is_plot_span_question(question):
        return ranked

    anchors = all_span_anchors(question)
    if not anchors:
        return ranked

    by_id: dict[str, dict[str, Any]] = {}
    for row in ranked:
        eid = str(row.get("id") or "")
        if eid:
            by_id[eid] = dict(row)

    question_tokens = tokenize(question)
    span = extract_plot_span_anchors(question)
    end_set = {p.lower() for p in span.get("end") or []}
    start_set = {p.lower() for p in span.get("start") or []}

    for entry in scoped:
        if not isinstance(entry, dict):
            continue
        matched: list[str] = []
        for phrase in anchors:
            if entry_matches_anchor(entry, phrase):
                matched.append(phrase)
        if not matched:
            continue
        eid = str(entry.get("id") or "")
        if not eid:
            continue
        base = rank_entry(question, entry) if callable(rank_entry) else 0
        if base < 0:
            base = 0
        # Floor high enough to pass retrieval thresholds and outrank early setup.
        floor = 20
        for phrase in matched:
            low = phrase.lower()
            if low in end_set:
                floor = max(floor, 48)
            elif low in start_set:
                floor = max(floor, 40)
            else:
                floor = max(floor, 34)
        score = max(int(base), floor) + score_boost_for_plot_span(question, entry)
        body = str(entry.get("body") or "")
        row = {
            "id": eid,
            "title": str(entry.get("title") or "Untitled"),
            "kind": str(entry.get("kind") or "note"),
            "kindLabel": kind_label(str(entry.get("kind") or "note")),
            "score": score,
            "excerpt": best_excerpt(body, question_tokens),
            "body": body[:8000],
            "plotSpanHit": True,
        }
        prev = by_id.get(eid)
        if prev is None or int(prev.get("score") or 0) < score:
            by_id[eid] = row

    merged = list(by_id.values())
    merged.sort(key=lambda r: int(r.get("score") or 0), reverse=True)
    return merged


def plot_span_prompt_hint(question: str) -> str:
    """Extra RAG instruction when the writer named a begin→end stretch."""
    if not is_plot_span_question(question):
        return ""
    span = extract_plot_span_anchors(question)
    parts: list[str] = []
    if span["start"]:
        parts.append("start: " + "; ".join(span["start"]))
    if span["end"]:
        parts.append("end: " + "; ".join(span["end"]))
    if span["mid"]:
        parts.append("also cover: " + "; ".join(span["mid"]))
    labels = " | ".join(parts) if parts else "the named begin→end stretch"
    return (
        "PLOT SPAN — the writer asked for the full stretch "
        f"({labels}). "
        "Walk the span in order using sources. "
        "Do not stop after the opening beat. "
        "If sources include the end beat (escape, helper, mansion climax, etc.), "
        "include those facts. "
        "Only say an end beat is thin when no matching sources were provided.\n"
    )
