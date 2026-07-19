"""LoreKeeper — which notes belong on a document / work view.

Visible when working on work W:
- notes tagged or linked to W
- unassigned / idk notes, unless they rule out W
Hidden: notes that belong to a different work.
"""
from __future__ import annotations

import re
from typing import Any

_IDK_TAG = re.compile(
    r"^(?:"
    r"idk(?:\s+which\s+work(?:\s+this(?:\s+(?:is|belongs(?:\s+to)?))?)?)?|"
    r"unassigned|"
    r"unknown(?:\s+work)?|"
    r"no\s+work|"
    r"any\s+work|"
    r"tbd(?:\s+work)?"
    r")\.?$",
    re.I,
)

_IDK_PHRASE = re.compile(
    r"\b(?:"
    r"idk\s+which\s+work|"
    r"don'?t\s+know\s+which\s+work|"
    r"not\s+sure\s+which\s+work|"
    r"unassigned|"
    r"no\s+specific\s+work|"
    r"which\s+work\s+this\s+(?:belongs|will\s+belong)\s+to"
    r")\b",
    re.I,
)

_NOT_TAG = re.compile(r"^not\s*:\s*(.+)$", re.I)

_EXCLUDE_PHRASE = re.compile(
    r"(?:"
    r"doesn'?t\s+(?:belong|fit)\s+(?:in|to)|"
    r"does\s+not\s+(?:belong|fit)\s+(?:in|to)|"
    r"won'?t\s+be\s+in|"
    r"will\s+not\s+be\s+in|"
    r"not\s+for|"
    r"not\s+in|"
    r"exclude(?:d)?\s+from|"
    r"rules?\s+out"
    r")\s+(.+?)(?:[.!?\n]|$)",
    re.I,
)


def normalize_work_key(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", (text or "").strip().lower())
    return re.sub(r"['']s\b", "", cleaned).replace("'", "").replace("’", "")


def _entry_blob(entry: dict[str, Any]) -> str:
    return f"{entry.get('title') or ''}\n{entry.get('body') or ''}"


def _concrete_work_tags(entry: dict[str, Any]) -> list[str]:
    """Work titles on the note — skips idk markers and not: exclusions."""
    out: list[str] = []
    for raw in entry.get("tags") or []:
        tag = str(raw or "").strip()
        if not tag:
            continue
        if _NOT_TAG.match(tag):
            continue
        if _IDK_TAG.match(tag):
            continue
        out.append(tag)
    return out


def note_is_unassigned(entry: dict[str, Any]) -> bool:
    if not isinstance(entry, dict):
        return False
    if _concrete_work_tags(entry):
        return False
    # No concrete work tag: empty, idk markers, and/or only not: exclusions.
    tags = [str(t).strip() for t in (entry.get("tags") or []) if str(t).strip()]
    if not tags:
        return True
    if any(_IDK_TAG.match(t) for t in tags):
        return True
    if all(_NOT_TAG.match(t) for t in tags):
        return True
    if _IDK_PHRASE.search(_entry_blob(entry)):
        return True
    return True


def note_excludes_work(entry: dict[str, Any], work_title: str) -> bool:
    work = normalize_work_key(work_title)
    if not work or not isinstance(entry, dict):
        return False

    for raw in entry.get("tags") or []:
        tag = str(raw or "").strip()
        m = _NOT_TAG.match(tag)
        if m and normalize_work_key(m.group(1)) == work:
            return True

    blob = _entry_blob(entry)
    for m in _EXCLUDE_PHRASE.finditer(blob):
        candidate = normalize_work_key(m.group(1))
        if not candidate:
            continue
        if candidate == work or work in candidate or candidate in work:
            return True
    return False


def _tags_soft_match(tag: str, work: str) -> bool:
    """Near-equal work titles (Cities Of Rust ≈ Cities Of Rust For Me)."""
    nt = normalize_work_key(tag)
    nw = normalize_work_key(work)
    if not nt or not nw:
        return False
    if nt == nw:
        return True
    shorter, longer = (nt, nw) if len(nt) <= len(nw) else (nw, nt)
    # Require a substantial shared title — avoid tiny tags matching by accident.
    if len(shorter) >= 8 and shorter in longer:
        return True
    return False


def _entry_is_documentish(entry: dict[str, Any]) -> bool:
    kind = str(entry.get("kind") or "")
    eid = str(entry.get("id") or "")
    if kind == "document" or "#p" in eid:
        return True
    return bool(str(entry.get("parentDocId") or "").strip())


def _document_body_names_work(entry: dict[str, Any], work: str) -> bool:
    """Draft prose often leads with the work title even when the work field is blank."""
    if not work or len(work) < 8 or not _entry_is_documentish(entry):
        return False
    body = normalize_work_key(str(entry.get("body") or ""))
    if not body:
        return False
    # Premise / title lines are usually near the top.
    if work in body[:800]:
        return True
    # Longer titles may appear later in a draft; short ones stay head-only.
    if len(work.split()) >= 3 and work in body:
        return True
    return False


def note_belongs_to_work(
    entry: dict[str, Any],
    work_title: str,
    *,
    document_id: str = "",
) -> bool:
    if not isinstance(entry, dict):
        return False
    doc_id = str(document_id or "").strip()
    if doc_id and str(entry.get("linkedDocId") or "").strip() == doc_id:
        return True

    work = normalize_work_key(work_title)
    if not work:
        return False

    for tag in _concrete_work_tags(entry):
        if _tags_soft_match(tag, work):
            return True

    # Soft match: work name in note title (same spirit as entry_matches_work).
    title = normalize_work_key(str(entry.get("title") or ""))
    title_base = title.split(" / ")[0].strip()
    if work and title_base:
        if work in title or work in title_base:
            return True
        # Doc titled "Cities Of Rust" asked as "Cities Of Rust For Me"
        if len(title_base) >= 8 and title_base in work:
            return True

    if _document_body_names_work(entry, work):
        return True
    return False


def note_belongs_to_other_work(entry: dict[str, Any], work_title: str) -> bool:
    """Has a concrete work assignment that is not the current work."""
    if not isinstance(entry, dict):
        return False
    work = normalize_work_key(work_title)
    tags = _concrete_work_tags(entry)
    if not tags:
        return False
    if not work:
        return True
    return all(not _tags_soft_match(t, work) for t in tags)


def note_visible_for_work(
    entry: dict[str, Any],
    work_title: str,
    *,
    document_id: str = "",
) -> bool:
    """Sidebar / work-scoped Ask membership."""
    if not isinstance(entry, dict):
        return False
    if note_belongs_to_work(entry, work_title, document_id=document_id):
        return True
    if note_belongs_to_other_work(entry, work_title):
        return False
    if note_is_unassigned(entry):
        return not note_excludes_work(entry, work_title)
    return False


def filter_entries_visible_for_work(
    entries: list[dict[str, Any]],
    work_title: str,
    *,
    document_id: str = "",
) -> list[dict[str, Any]]:
    work = (work_title or "").strip()
    if not work and not document_id:
        return [e for e in entries if isinstance(e, dict)]
    return [
        e
        for e in entries
        if isinstance(e, dict)
        and note_visible_for_work(e, work, document_id=document_id)
    ]


# --- Floaters-only Ask (unassigned notes; never mix in tagged works) ---

_FLOATERS_SCOPE_Q = re.compile(
    r"\b("
    r"floating(?:\s+ideas?)?|floaters?|"
    r"unspecified(?:\s+(?:ideas?|notes?))?|"
    r"unassigned(?:\s+(?:ideas?|notes?))?|"
    r"jumbled(?:\s+(?:ideas?|notes?))?|"
    r"idk(?:\s+(?:which\s+work|notes?|ideas?))?|"
    r"notes?\s+without\s+(?:a\s+)?work|"
    r"(?:ideas?|notes?)\s+(?:that\s+)?(?:don'?t|do\s+not)\s+belong\s+anywhere|"
    r"no\s+(?:specific\s+)?work(?:\s+yet|\s+assigned)?|"
    r"inbox(?:\s+(?:ideas?|notes?))?"
    r")\b",
    re.I,
)

_FLOATERS_INVENTORY_Q = re.compile(
    r"\b("
    r"all|list|summarize|summary|give\s+me|show\s+me|what\s+are|"
    r"dump|rundown|digest|overview"
    r")\b",
    re.I,
)

FLOATERS_DIGEST_CAP = 40


def is_floaters_question(question: str) -> bool:
    """Writer asked about floating / unspecified / no-work notes."""
    return bool(_FLOATERS_SCOPE_Q.search(question or ""))


def is_floaters_inventory_question(question: str) -> bool:
    """List or summarize the floater pile (not a single character inside it)."""
    q = question or ""
    if not is_floaters_question(q):
        return False
    return bool(_FLOATERS_INVENTORY_Q.search(q))


def filter_entries_floaters_only(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Unassigned notes only — excludes anything with a concrete work tag."""
    return [
        e
        for e in entries
        if isinstance(e, dict) and note_is_unassigned(e) and str(e.get("kind") or "") != "document"
    ]


def _floater_excerpt(body: str, limit: int = 160) -> str:
    text = re.sub(r"\s+", " ", (body or "").strip())
    if not text:
        return ""
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0]
    return (cut or text[: limit - 1]).rstrip(".,;:") + "…"


def compose_floaters_digest(
    entries: list[dict[str, Any]],
    *,
    cap: int = FLOATERS_DIGEST_CAP,
) -> tuple[str, list[str]]:
    """Clear list of every floater (capped). Returns (answer, source_ids)."""
    floaters = filter_entries_floaters_only(entries)
    if not floaters:
        return (
            "You don't have any floating / unspecified notes yet — "
            "notes with no work title (or tagged idk / unassigned) will show up here.\n\n"
            "— From your notes only. Nothing invented.",
            [],
        )

    # Stable order: newest-ish ids last often; prefer title sort for predictability.
    ordered = sorted(
        floaters,
        key=lambda e: (str(e.get("title") or "").lower(), str(e.get("id") or "")),
    )
    total = len(ordered)
    shown = ordered[: max(1, cap)]
    source_ids = [str(e.get("id") or "") for e in shown if e.get("id")]

    lines = [
        f"Your floating / unspecified ideas ({total} note"
        + ("s" if total != 1 else "")
        + " — none tagged to a specific work):\n"
    ]
    for entry in shown:
        title = str(entry.get("title") or "Untitled").strip() or "Untitled"
        excerpt = _floater_excerpt(str(entry.get("body") or ""))
        if excerpt:
            lines.append(f"• {title} — {excerpt}")
        else:
            lines.append(f"• {title} — (title only; no body saved yet)")

    if total > len(shown):
        rest = total - len(shown)
        lines.append(
            f"\n…and {rest} more floating note"
            + ("s" if rest != 1 else "")
            + ". Ask about a character or topic in your floaters to narrow, "
            "or assign work titles when you know where an idea belongs."
        )
    else:
        lines.append(
            "\nThat's the full floater pile from what you've saved. "
            "Thin scraps are listed as-is — nothing filled in."
        )
    lines.append("\n— From your notes only. Nothing invented.")
    return "\n".join(lines), source_ids
