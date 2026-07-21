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
_FOOTER = (
    "— From your notes vs draft only. Nothing invented. "
    "Not a full literary read of whether something was 'touched upon.'"
)
MAX_UNUSED_LINES = 40

# Subject focus: "…relating to Dijon", "notes about Dijon that haven't…"
_SUBJECT_AFTER_SCOPE = re.compile(
    r"(?:document|draft|manuscript)\s+"
    r"(?:relating\s+to|related\s+to|regarding|concerning|about)\s+"
    r"(.+?)\s*[?.!]?\s*$",
    re.I,
)
_SUBJECT_NOTES_ABOUT = re.compile(
    r"\bnotes?\s+(?:that\s+(?:i(?:'?ve| have)\s+)?(?:written|saved)\s+)?"
    r"(?:relating\s+to|related\s+to|regarding|concerning|about)\s+"
    r"(.+?)(?=\s+that\b|\s+which\b|\s+haven|\s+hasn|\s+have\s+not|"
    r"\s+has\s+not|\s+not\b|,|\?|$)",
    re.I,
)
_SUBJECT_RELATING = re.compile(
    r"\b(?:relating\s+to|related\s+to|regarding|concerning)\s+"
    r"(.+?)\s*[?.!]?\s*$",
    re.I,
)
_SUBJECT_JUNK = frozenset(
    {
        "the main document",
        "the document",
        "the draft",
        "the manuscript",
        "main document",
        "this work",
        "my notes",
        "the notes",
        "notes",
        "it",
        "them",
        "that",
        "this",
    }
)


def is_notes_not_in_draft_question(question: str) -> bool:
    """Writer asked what note material is not yet in the main draft."""
    q = question or ""
    if is_planned_gap_question(q):
        return False
    return bool(_NOTES_NOT_IN_DRAFT_Q.search(q))


def extract_notes_not_in_draft_subject(question: str) -> str:
    """
    Optional subject filter from the ask — e.g. 'dijon' from
    '…main document relating to dijon' or 'notes about Dijon that haven't…'.
    Empty string = whole-work unused dump (legacy behavior).
    """
    q = (question or "").strip()
    if not q:
        return ""
    candidates: list[str] = []
    for pattern in (_SUBJECT_AFTER_SCOPE, _SUBJECT_NOTES_ABOUT, _SUBJECT_RELATING):
        m = pattern.search(q)
        if m:
            candidates.append(m.group(1).strip().rstrip("?.!,"))
    for raw in candidates:
        cleaned = re.sub(r"\s+", " ", raw).strip(" \t\"'“”‘’")
        if not cleaned or len(cleaned) > 60:
            continue
        low = cleaned.lower()
        if low in _SUBJECT_JUNK:
            continue
        # Drop trailing filler: "dijon in my notes" → "dijon"
        cleaned = re.sub(
            r"\s+(?:in|from|with)\s+(?:my\s+|the\s+)?(?:notes?|draft|document).*$",
            "",
            cleaned,
            flags=re.I,
        ).strip()
        if not cleaned or cleaned.lower() in _SUBJECT_JUNK:
            continue
        # Single junk token
        toks = _content_tokens(cleaned)
        if not toks:
            continue
        return cleaned[:80]
    return ""


def _subject_hits_text(subject: str, text: str) -> bool:
    """True when subject phrase or all its content tokens appear in text."""
    subj = _normalize(subject)
    blob = _normalize(text)
    if not subj or not blob:
        return False
    if subj in blob:
        return True
    toks = _content_tokens(subj)
    if not toks:
        return False
    return all(t in blob for t in toks)


def filter_unused_by_subject(
    items: list[dict[str, str]], subject: str
) -> list[dict[str, str]]:
    """Keep unused claim rows that mention the subject (title or line)."""
    subj = (subject or "").strip()
    if not subj:
        return items
    out: list[dict[str, str]] = []
    for row in items:
        title = str(row.get("noteTitle") or "")
        line = str(row.get("line") or "")
        if _subject_hits_text(subj, title) or _subject_hits_text(subj, line):
            out.append(row)
    return out


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
        # Prefer line / bullet splits whenever there are multiple lines.
        if len(lines) > 1:
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
    if len(claim.strip()) < 16:
        return False
    return True


def _claim_touched_in_draft(claim: str, draft_norm: str) -> bool:
    """
    True only when draft clearly restates this claim via a contiguous phrase.
    Bag-of-words is intentionally NOT used — shared cast names made almost
    every note look 'touched.'
    """
    if not claim.strip() or not draft_norm:
        return False
    claim_norm = _normalize(claim)
    if len(claim_norm) >= 20 and claim_norm in draft_norm:
        return True
    words = claim_norm.split()
    # Need a real multi-word span present as written (or near-as-written).
    window = 5 if len(words) >= 8 else 4
    if len(words) < window:
        # Short claims: whole claim must appear, or all content tokens as a phrase.
        if len(claim_norm) >= 16 and claim_norm in draft_norm:
            return True
        content = _content_tokens(claim)
        if len(content) >= 3:
            phrase = " ".join(content)
            if phrase in draft_norm:
                return True
        return False
    for i in range(len(words) - window + 1):
        phrase = " ".join(words[i : i + window])
        if len(phrase) >= 18 and phrase in draft_norm:
            return True
    return False


def _draft_corpus(entries: list[dict[str, Any]]) -> str:
    """Prefer full documents; fall back to paragraph chunks. Dedupe by base id."""
    full_docs: list[str] = []
    chunks: list[str] = []
    seen_full: set[str] = set()
    seen_chunk: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict) or not _is_draft_entry(entry):
            continue
        body = str(entry.get("body") or "").strip()
        if not body:
            continue
        eid = str(entry.get("id") or "")
        base = eid.split("#", 1)[0]
        if "#p" in eid:
            if base in seen_full or eid in seen_chunk:
                continue
            seen_chunk.add(eid)
            chunks.append(body)
        else:
            if base in seen_full:
                continue
            seen_full.add(base)
            full_docs.append(body)
    if full_docs:
        return "\n\n".join(full_docs)
    return "\n\n".join(chunks)


def _dedupe_key(claim: str) -> str:
    return _normalize(claim)[:160]


def collect_notes_not_in_draft(
    entries: list[dict[str, Any]],
) -> tuple[list[dict[str, str]], bool, bool]:
    """
    Return (unused claim rows, has_notes, has_draft).
    Rows: entryId, noteTitle, line.
    """
    notes: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if entry_is_planned(entry):
            # Intentional gaps stay on the planned route; skip here.
            continue
        if _is_draft_entry(entry):
            continue
        if str(entry.get("body") or "").strip() or str(entry.get("title") or "").strip():
            notes.append(entry)

    draft_blob = _draft_corpus(entries)
    has_notes = bool(notes)
    has_draft = bool(draft_blob.strip())
    if not has_notes or not has_draft:
        return [], has_notes, has_draft

    draft_norm = _normalize(draft_blob)

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
            cleaned = claim.strip()
            # Drop orphan closing/opening from mid-sentence splits.
            cleaned = re.sub(r"^[)\],;:\-–—]+\s*", "", cleaned)
            cleaned = re.sub(r"\s+[(\[]+$", "", cleaned)
            if not _claim_is_usable(cleaned):
                continue
            if _claim_touched_in_draft(cleaned, draft_norm):
                continue
            key = _dedupe_key(cleaned)
            if key in seen:
                continue
            seen.add(key)
            unused.append({"entryId": eid, "noteTitle": title, "line": cleaned})
    return unused, has_notes, has_draft


def _work_phrase(work_hints: set[str]) -> str:
    if not work_hints:
        return "this work"
    return sorted(work_hints, key=len, reverse=True)[0]


def _tidy_claim_line(text: str) -> str:
    s = re.sub(r"\s+", " ", (text or "").strip())
    if not s:
        return s
    s = re.sub(r"^[)\],;:\-–—]+\s*", "", s)
    s = re.sub(r"\s+[(\[]+$", "", s)
    if s and s[0].islower():
        s = s[0].upper() + s[1:]
    return s


def _near_dedupe_items(items: list[dict[str, str]]) -> list[dict[str, str]]:
    """Drop near-duplicate / subsumed lines — keep the clearer longer claim."""
    # Longest first so shorter scraps lose to fuller lines.
    ranked = sorted(
        (
            {
                **row,
                "line": _tidy_claim_line(str(row.get("line") or "")),
                "_orig": i,
            }
            for i, row in enumerate(items)
        ),
        key=lambda r: len(_normalize(str(r.get("line") or ""))),
        reverse=True,
    )
    kept: list[dict[str, str]] = []
    kept_norms: list[str] = []
    for row in ranked:
        line = str(row.get("line") or "")
        if not line:
            continue
        norm = _normalize(line)
        if not norm:
            continue
        if any(
            (norm in kn or kn in norm)
            for kn in kept_norms
            if min(len(norm), len(kn)) >= 24
        ):
            continue
        toks = set(_content_tokens(line))
        skip = False
        for prev in kept:
            prev_toks = set(_content_tokens(str(prev.get("line") or "")))
            if not toks or not prev_toks:
                continue
            overlap = len(toks & prev_toks) / max(1, min(len(toks), len(prev_toks)))
            if overlap >= 0.85 and abs(len(toks) - len(prev_toks)) <= 2:
                skip = True
                break
        if skip:
            continue
        kept.append(
            {
                "entryId": str(row.get("entryId") or ""),
                "noteTitle": str(row.get("noteTitle") or "Note"),
                "line": line,
                "_orig": row.get("_orig", 0),
            }
        )
        kept_norms.append(norm)
    kept.sort(
        key=lambda r: (
            str(r.get("noteTitle") or "").lower(),
            int(r.get("_orig") or 0),
        )
    )
    return [
        {
            "entryId": str(r.get("entryId") or ""),
            "noteTitle": str(r.get("noteTitle") or "Note"),
            "line": str(r.get("line") or ""),
        }
        for r in kept
    ]


def _group_items_by_note(
    items: list[dict[str, str]],
) -> list[tuple[str, list[str]]]:
    groups: list[tuple[str, list[str]]] = []
    index: dict[str, int] = {}
    for row in items:
        title = str(row.get("noteTitle") or "Note").strip() or "Note"
        line = str(row.get("line") or "").strip()
        if not line:
            continue
        key = title.lower()
        if key not in index:
            index[key] = len(groups)
            groups.append((title, []))
        bucket = groups[index[key]][1]
        if line.lower() not in {b.lower() for b in bucket}:
            bucket.append(line)
    return groups


def _claims_to_paragraph(claims: list[str]) -> str:
    """Join claim scraps into one readable paragraph."""
    parts: list[str] = []
    for raw in claims:
        c = _tidy_claim_line(raw)
        if not c:
            continue
        if c[-1] not in ".!?…\"'”’":
            c = c + "."
        parts.append(c)
    return " ".join(parts)


def compose_notes_not_in_draft_local(
    work_hints: set[str],
    items: list[dict[str, str]],
    *,
    has_notes: bool,
    has_draft: bool,
    subject: str = "",
) -> str:
    """Grouped local layout — short paragraphs by note, no bullet walls."""
    work = _work_phrase(work_hints)
    subj = (subject or "").strip()
    if subj:
        lead = (
            f"In your notes for {work} relating to {subj}, "
            f"but not clearly in the main document yet:\n"
        )
    else:
        lead = f"In your notes for {work}, but not clearly in the main document yet:\n"
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
        cleaned = _near_dedupe_items(items)[:MAX_UNUSED_LINES]
        groups = _group_items_by_note(cleaned)
        for title, claims in groups:
            para = _claims_to_paragraph(claims)
            if not para:
                continue
            lines.append(title)
            lines.append(para)
            lines.append("")
        extra = len(items) - len(cleaned)
        if extra > 0:
            lines.append(f"…and {extra} more note detail(s) not shown here.")
            lines.append("")
        while lines and lines[-1] == "":
            lines.pop()
    elif subj:
        lines.append(
            f"Nothing clear stood out as unused notes relating to {subj} — "
            "either those note lines also show up in the draft by phrase match, "
            "or no notes for that subject were found. Try another name spelling if this feels wrong."
        )
    else:
        lines.append(
            "Nothing clear stood out as notes-only — clear note lines also show up "
            "in the draft by phrase match. Try shorter note lines if this feels wrong."
        )
    lines.append("\n" + _FOOTER)
    return "\n".join(lines)


# Back-compat alias for tests / callers
compose_notes_not_in_draft_answer = compose_notes_not_in_draft_local

_ORGANIZE_SYSTEM = """You are LoreKeeper — a librarian organizing one writer's private note scraps.

Rules (non-negotiable):
- ONLY restate and organize the NOTE LINES below. Never add facts, motives, plot, or themes.
- Group under clear headings (prefer the note titles given).
- Under each heading, write ONE short calm paragraph — not bullet lists, not a scrap dump.
- Keep every distinct fact from the note lines; do not drop unique details.
- Do not invent what the draft is missing beyond what these note lines say.
- Start with one short lead line naming the work, then the headed paragraphs.
- No bullet points (•) and no dash lists.
- End with a blank line then exactly: — From your notes vs draft only. Nothing invented. Not a full literary read of whether something was 'touched upon.'"""


def _organize_with_librarian(
    work_hints: set[str],
    items: list[dict[str, str]],
    local_fallback: str,
    *,
    subject: str = "",
) -> str:
    """Optional Haiku tidy-up of already-filtered unused lines — librarian only."""
    try:
        from lorekeeper_ask_plan import ANSWER_MODEL_HAIKU
        from lorekeeper_rag import _call_anthropic, rag_enabled
    except ImportError:
        return local_fallback
    if not rag_enabled() or not items:
        return local_fallback

    work = _work_phrase(work_hints)
    cleaned = _near_dedupe_items(items)[:MAX_UNUSED_LINES]
    blocks: list[str] = []
    for i, row in enumerate(cleaned, start=1):
        title = row.get("noteTitle") or "Note"
        line = row.get("line") or ""
        blocks.append(f"{i}. [{title}] {line}")
    focus = ""
    if (subject or "").strip():
        focus = f"Subject focus (keep only this angle): {subject.strip()}\n"
    user = (
        f"Work: {work}\n"
        + focus
        + "\nThese note lines are NOT clearly in the main draft yet "
        "(already filtered — do not re-judge that):\n\n"
        + "\n".join(blocks)
        + "\n\nOrganize them into calm paragraph sections — no bullets."
    )
    try:
        answer, _ = _call_anthropic(
            system=_ORGANIZE_SYSTEM,
            user_content=user,
            max_tokens=900,
            model=ANSWER_MODEL_HAIKU,
        )
    except Exception:
        return local_fallback
    text = (answer or "").strip()
    if not text or len(text) < 40:
        return local_fallback
    # Prefer paragraph answers; if the model returns a bullet wall, fall back.
    if text.count("•") >= 3 or text.count("\n- ") >= 3:
        return local_fallback
    if _FOOTER.split(".")[0] not in text and "From your notes vs draft only" not in text:
        text = text.rstrip() + "\n\n" + _FOOTER
    return text


def answer_notes_not_in_draft(
    entries: list[dict[str, Any]],
    *,
    work_hints: set[str],
    question: str = "",
) -> tuple[str, list[str]]:
    items, has_notes, has_draft = collect_notes_not_in_draft(entries)
    subject = extract_notes_not_in_draft_subject(question)
    if subject:
        items = filter_unused_by_subject(items, subject)
    local = compose_notes_not_in_draft_local(
        work_hints,
        items,
        has_notes=has_notes,
        has_draft=has_draft,
        subject=subject,
    )
    if items and has_notes and has_draft:
        answer = _organize_with_librarian(
            work_hints, items, local, subject=subject
        )
    else:
        answer = local
    source_ids: list[str] = []
    seen_ids: set[str] = set()
    for row in items:
        eid = str(row.get("entryId") or "")
        if eid and eid not in seen_ids:
            seen_ids.add(eid)
            source_ids.append(eid)
        if len(source_ids) >= 12:
            break
    # Unfocused empty: still point at a few notes so sources aren't blank.
    # Subject focus with no hits: leave sources empty (honest "nothing for X").
    if not source_ids and has_notes and not subject:
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
