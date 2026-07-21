"""LoreKeeper — notes material not yet reflected in the main draft (librarian only)."""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_loose_ends import entry_is_planned, is_planned_gap_question

_NOTES_NOT_IN_DRAFT_Q = re.compile(
    r"\b("
    r"notes?\s+that\s+(?:haven'?t|have\s+not|hasn'?t|has\s+not)\s+"
    r"(?:been\s+)?(?:touched|used|covered|reflected|included|drafted)|"
    r"(?:written|saved)\s+in\s+(?:my\s+|the\s+)?notes?\s+that\s+"
    r"(?:haven'?t|have\s+not|hasn'?t|has\s+not)|"
    r"notes?\s+(?:only|material)?\s*(?:not|never)\s+(?:in|in\s+the)\s+"
    r"(?:main\s+)?(?:document|draft|manuscript)|"
    r"(?:not|never)\s+(?:in|touched\s+(?:in|upon)\s+(?:in\s+)?(?:the\s+)?)"
    r"(?:main\s+)?(?:document|draft|manuscript)|"
    r"touched\s+upon\s+in\s+(?:the\s+)?(?:main\s+)?(?:document|draft)|"
    r"unused\s+(?:in\s+(?:the\s+)?)?(?:draft|document|notes?)|"
    r"notes?\s+(?:vs\.?|versus|compared\s+to)\s+(?:the\s+)?(?:main\s+)?"
    r"(?:document|draft)|"
    r"what(?:'s|\s+is)\s+in\s+(?:my\s+)?notes?\s+(?:but|that)\s+(?:is\s+)?"
    r"not\s+(?:in|yet\s+in)\s+(?:the\s+)?(?:main\s+)?(?:document|draft)|"
    r"notes?\s+(?:I\s+)?haven'?t\s+(?:used|put)\s+(?:in|into)\s+(?:the\s+)?"
    r"(?:draft|document)"
    r")\b",
    re.I,
)

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
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "must",
        "shall",
        "can",
        "this",
        "that",
        "these",
        "those",
        "with",
        "from",
        "into",
        "onto",
        "about",
        "over",
        "under",
        "again",
        "further",
        "then",
        "once",
        "here",
        "there",
        "when",
        "where",
        "why",
        "how",
        "all",
        "each",
        "few",
        "more",
        "most",
        "other",
        "some",
        "such",
        "no",
        "nor",
        "not",
        "only",
        "own",
        "same",
        "so",
        "than",
        "too",
        "very",
        "just",
        "also",
        "his",
        "her",
        "their",
        "them",
        "they",
        "she",
        "he",
        "it",
        "its",
        "who",
        "whom",
        "which",
        "what",
        "my",
        "your",
        "our",
        "note",
        "notes",
        "draft",
        "document",
        "chapter",
        "scene",
    }
)

_BULLET_PREFIX = re.compile(r"^\s*[-*•–—]\s+")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")


def is_notes_not_in_draft_question(question: str) -> bool:
    """Writer asked what note material is not yet in the main draft."""
    q = question or ""
    if is_planned_gap_question(q):
        return False
    return bool(_NOTES_NOT_IN_DRAFT_Q.search(q))


def _is_draft_entry(entry: dict[str, Any]) -> bool:
    kind = str(entry.get("kind") or "")
    eid = str(entry.get("id") or "")
    return kind == "document" or "#p" in eid


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


def _split_claims(body: str) -> list[str]:
    """Break a note body into claim-sized lines — never invent."""
    raw = (body or "").strip()
    if not raw:
        return []
    chunks: list[str] = []
    for block in re.split(r"\n\s*\n+", raw):
        block = block.strip()
        if not block:
            continue
        lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        if len(lines) > 1 and all(_BULLET_PREFIX.match(ln) or len(ln) < 120 for ln in lines):
            for ln in lines:
                cleaned = _BULLET_PREFIX.sub("", ln).strip()
                if cleaned:
                    chunks.append(cleaned)
            continue
        for piece in _SENTENCE_SPLIT.split(block):
            cleaned = _BULLET_PREFIX.sub("", piece).strip()
            if cleaned:
                chunks.append(cleaned)
    return chunks


def _claim_is_usable(claim: str) -> bool:
    tokens = _content_tokens(claim)
    if len(tokens) < 2:
        return False
    if len(claim.strip()) < 18:
        return False
    # Skip pure meta / labels
    if re.match(r"^(planned|fix|todo\s+fix)\s*:", claim.strip(), re.I):
        return True  # still list planned note lines as unused if not in draft
    return True


def _claim_touched_in_draft(claim: str, draft_norm: str, draft_token_set: set[str]) -> bool:
    """True when draft clearly reflects this note claim (overlap only — not themes)."""
    if not claim.strip() or not draft_norm:
        return False
    claim_norm = _normalize(claim)
    if len(claim_norm) >= 24 and claim_norm in draft_norm:
        return True
    # Contiguous multi-word phrase from the claim
    words = claim_norm.split()
    if len(words) >= 4:
        for i in range(len(words) - 3):
            phrase = " ".join(words[i : i + 4])
            if len(phrase) >= 16 and phrase in draft_norm:
                return True
    tokens = _content_tokens(claim)
    if not tokens:
        return False
    hits = sum(1 for t in tokens if t in draft_token_set)
    # Need most distinctive words present in the draft corpus
    if len(tokens) <= 3:
        return hits == len(tokens)
    return hits / len(tokens) >= 0.65


def collect_notes_not_in_draft(
    entries: list[dict[str, Any]],
) -> tuple[list[dict[str, str]], bool, bool]:
    """
    Return (unused claim rows, has_notes, has_draft).
    Rows: entryId, noteTitle, line.
    """
    notes: list[dict[str, Any]] = []
    drafts: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if entry_is_planned(entry):
            # Intentional gaps stay on the planned route; skip here.
            continue
        if _is_draft_entry(entry):
            if str(entry.get("body") or "").strip():
                drafts.append(entry)
        else:
            if str(entry.get("body") or "").strip() or str(entry.get("title") or "").strip():
                notes.append(entry)

    has_notes = bool(notes)
    has_draft = bool(drafts)
    if not has_notes or not has_draft:
        return [], has_notes, has_draft

    draft_blob = "\n\n".join(str(d.get("body") or "") for d in drafts)
    draft_norm = _normalize(draft_blob)
    draft_token_set = set(_content_tokens(draft_blob))

    unused: list[dict[str, str]] = []
    seen: set[str] = set()
    for entry in notes:
        eid = str(entry.get("id") or "")
        title = str(entry.get("title") or "Untitled").strip() or "Untitled"
        body = str(entry.get("body") or "").strip()
        claims = _split_claims(body) if body else []
        if not claims and title.lower() not in ("untitled", "untitled note", "note"):
            claims = [title]
        for claim in claims:
            if not _claim_is_usable(claim):
                continue
            if _claim_touched_in_draft(claim, draft_norm, draft_token_set):
                continue
            key = _normalize(claim)[:140]
            if key in seen:
                continue
            seen.add(key)
            unused.append({"entryId": eid, "noteTitle": title, "line": claim})
    return unused, has_notes, has_draft


def _work_phrase(work_hints: set[str]) -> str:
    if not work_hints:
        return "this work"
    return sorted(work_hints, key=len, reverse=True)[0]


def compose_notes_not_in_draft_answer(
    work_hints: set[str],
    items: list[dict[str, str]],
    *,
    has_notes: bool,
    has_draft: bool,
) -> str:
    work = _work_phrase(work_hints)
    lines = [
        f"In your notes for {work}, but not clearly in the main document yet "
        f"(word overlap only — not a theme judgment):\n"
    ]
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
        for row in items[:14]:
            note = row.get("noteTitle") or "Note"
            text = (row.get("line") or "").strip()
            if not text:
                continue
            if text.lower() == note.lower():
                lines.append(f"• {text}")
            else:
                lines.append(f"• {text} ({note})")
    else:
        lines.append(
            "Nothing clear stood out as notes-only — clear note lines also show up "
            "in the draft by word overlap. Narrower notes or a longer draft may help."
        )
    lines.append(
        "\n— From your notes vs draft only. Nothing invented. "
        "Not a full literary read of whether something was 'touched upon.'"
    )
    return "\n".join(lines)


def answer_notes_not_in_draft(
    entries: list[dict[str, Any]],
    *,
    work_hints: set[str],
) -> tuple[str, list[str]]:
    items, has_notes, has_draft = collect_notes_not_in_draft(entries)
    answer = compose_notes_not_in_draft_answer(
        work_hints, items, has_notes=has_notes, has_draft=has_draft
    )
    source_ids = [row["entryId"] for row in items if row.get("entryId")][:10]
    if not source_ids and has_notes:
        # Still cite a note so the UI can show sources when empty-unused.
        for entry in entries:
            if (
                isinstance(entry, dict)
                and not _is_draft_entry(entry)
                and not entry_is_planned(entry)
                and entry.get("id")
            ):
                source_ids.append(str(entry["id"]))
                if len(source_ids) >= 3:
                    break
    return answer, source_ids
