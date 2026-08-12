"""LoreKeeper — thin-draft / catch-up gather Ask (orientation brief).

Librarian only: restates what the writer already saved for a named work.
Planning-brief voice (like leave-off) — not who-is cast cards, not write-next alone.
Gold baseline: owner catch-up sample must not get worse (voice + density).
"""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_loose_ends import collect_loose_end_items, entry_is_planned
from lorekeeper_notes_vs_draft import (
    _claim_is_usable,
    _draft_corpus,
    _is_draft_entry,
    _near_dedupe_items,
    _normalize,
    _split_claims,
    _tidy_claim_line,
    _work_phrase,
)

MAX_CAST = 8
MAX_BEATS = 8
MAX_OPEN = 6
MAX_SCRAPS = 8
_MAX_LINE = 220

_CATCHUP_Q = re.compile(
    r"\b("
    r"get\s+me\s+caught[\s-]?up|"
    r"caught[\s-]?up\s+(?:on|for|with)\s+(?:this\s+|my\s+|the\s+)?"
    r"(?:work|draft|notes?|story|project)|"
    r"catch[\s-]?me[\s-]?up|"
    r"catch[\s-]?up\s+(?:on|for|with)\s+(?:this\s+|my\s+|the\s+)?"
    r"(?:work|draft|notes?|story|project)|"
    r"catch[\s-]?up\s+gather|"
    r"what\s+have\s+i\s+got(?:\s+so\s+far)?|"
    r"what\s+do\s+i\s+already\s+have|"
    r"what\s+have\s+i\s+already\s+(?:got|saved|written|noted|gathered)|"
    r"what(?:'s|\s+is)\s+already\s+(?:here|saved|in\s+(?:my\s+)?notes?)|"
    r"remind\s+me\s+what\s+i\s+(?:have|got|already)|"
    r"reorient(?:\s+me)?(?:\s+on|\s+for|\s+with)?|"
    r"gather\s+what\s+i\s+(?:have|got|already)|"
    r"what\s+have\s+i\s+(?:got|saved)\s+for|"
    r"inventory\s+(?:of\s+)?(?:this\s+|my\s+)?(?:work|draft|notes?)|"
    r"orientation\s+(?:brief|pass)|"
    r"planning\s+brief\s+(?:for|on)\s+(?:this\s+|my\s+)?"
    r"(?:work|draft|story)|"
    r"what(?:'s|\s+is)\s+in\s+(?:this\s+|the\s+)?(?:work|silo)\s+so\s+far"
    r")\b",
    re.I,
)

_OPEN_Q_LINE = re.compile(
    r"(?:\?|\b(?:open\s*(?:question|q)?\s*:|unsure|not\s+sure(?:\s+yet)?|"
    r"tbd|unresolved|still\s+deciding|need\s+to\s+decide)\b)",
    re.I,
)

_ANTAGONIST_SIGNAL = re.compile(
    r"\b("
    r"antagonist|villain|boss|mafia|don|capo|underboss|crime\s+lord|"
    r"main\s+(?:antagonist|villain|boss)|higher-?ups?|his\s+leader|"
    r"the\s+leader|domain\s+lord|overlord"
    r")\b",
    re.I,
)

_ORIGIN_SIGNAL = re.compile(
    r"\b("
    r"before\s+(?:this\s+)?(?:adventure|journey|trip|mission)|"
    r"started\s+out|came\s+from|home\s+(?:world|realm|city|town)|"
    r"ordinary\s+life|back\s+home|used\s+to\s+live|grew\s+up|"
    r"from\s+(?:the\s+)?(?:human\s+)?(?:world|realm|side)|"
    r"before\s+she\s+(?:was|got)|before\s+he\s+(?:was|got)"
    r")\b",
    re.I,
)

_ENTRY_SIGNAL = re.compile(
    r"\b("
    r"brought\s+(?:her|him|them)|took\s+(?:her|him|them)|"
    r"offer(?:ed)?|accepted|refusal|refused|how\s+she\s+(?:got|ended)|"
    r"how\s+he\s+(?:got|ended)|ended\s+up\s+in|crossed\s+(?:over|into)|"
    r"pulled\s+(?:into|through)|entered\s+(?:the|this)|"
    r"under\s+the\s+premise|somewhere\s+she\s+could\s+get|"
    r"reason\s+(?:she|he|they)\s+(?:is|are|was|were)\s+there|"
    r"why\s+(?:she|he|they)\s+(?:is|are|was|were)\s+(?:there|in)|"
    r"winds?\s+up\s+in|right\s+hand|sparrow"
    r")\b",
    re.I,
)

_CANT_LEAVE_SIGNAL = re.compile(
    r"\b("
    r"can'?t\s+leave|cannot\s+leave|must\s+(?:not\s+)?leave|"
    r"leave\s+too\s+quickly|can'?t\s+go\s+(?:yet|now)|"
    r"must\s+stay|have\s+to\s+stay|dare\s+not\s+leave|"
    r"arous(?:e|ing)\s+suspicion|slip\s+could|exposure|"
    r"unmask|registration|flagged"
    r")\b",
    re.I,
)

_CAST_TITLE_JUNK = frozenset(
    {
        "untitled",
        "untitled note",
        "note",
        "notes",
        "ideas",
        "random ideas",
        "scraps",
        "scrap",
        "planned",
        "todo",
        "fix",
        "draft",
        "main draft",
        "document",
        "page",
        "chapter",
        "prologue",
        "world",
        "setting",
        "plot",
        "beats",
        "outline",
        "open questions",
        "questions",
    }
)

_CAST_IDENTITY = re.compile(
    r"^\s*(?:character\s+[a-z0-9]+|[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,2})\s+"
    r"(?:is|are|was|were)\b",
    re.I,
)

_NAME_IN_TITLE = re.compile(
    r"^(?:character\s+[a-z0-9]+|[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,2})$"
)

_FOOTER = (
    "— Catch-up orientation from your notes and draft only. Nothing invented."
)

# Owner gold baseline markers — premise / thin-draft catch-up (locked 2026-08-12).
CATCHUP_GOLD_BASELINE_MARKERS = (
    "fall",
    "author",
    "sparrow",
    "brought her",
    "cannot simply leave",
    "registered",
    "paranoia",
    "way out of that domain",
)


def is_catchup_gather_question(question: str) -> bool:
    """Writer asked for a thin-draft / catch-up gather — not leave-off or write-next."""
    q = (question or "").strip()
    if not q or not _CATCHUP_Q.search(q):
        return False
    from lorekeeper_character_summary import is_who_is_question
    from lorekeeper_loose_ends import is_flagged_fix_question, is_planned_gap_question
    from lorekeeper_notes_vs_draft import is_notes_not_in_draft_question
    from lorekeeper_question_routes import is_story_position_question
    from lorekeeper_writing_next import is_writing_next_task_list_question

    # Explicit catch-up phrasing wins over incidental "story so far" in the same ask.
    if is_story_position_question(q) and not re.search(
        r"\b(?:get\s+me\s+caught|catch(?:\s+me)?[\s-]?up|caught[\s-]?up)\b",
        q,
        re.I,
    ):
        return False
    if is_writing_next_task_list_question(q):
        return False
    if is_notes_not_in_draft_question(q):
        return False
    if is_planned_gap_question(q) or is_flagged_fix_question(q):
        return False
    if is_who_is_question(q):
        return False
    return True


def _clip(text: str, limit: int = _MAX_LINE) -> str:
    s = _tidy_claim_line(text)
    if len(s) <= limit:
        return s
    cut = s[: limit - 1].rsplit(" ", 1)[0].strip()
    return (cut or s[: limit - 1]).rstrip(".,;:") + "…"


def _title_looks_like_cast(title: str) -> bool:
    t = (title or "").strip()
    if not t or t.lower() in _CAST_TITLE_JUNK:
        return False
    if "/" in t or ":" in t:
        tail = re.split(r"[/:]", t, maxsplit=1)[-1].strip()
        if tail and tail.lower() not in _CAST_TITLE_JUNK:
            t = tail
    if t.lower() in _CAST_TITLE_JUNK:
        return False
    if re.match(r"^character\s+[a-z0-9]+$", t, re.I):
        return True
    if _NAME_IN_TITLE.match(t) and len(t.split()) <= 3:
        return True
    return False


def _cast_label_from_title(title: str) -> str:
    t = (title or "").strip()
    if "/" in t or ":" in t:
        tail = re.split(r"[/:]", t, maxsplit=1)[-1].strip()
        if tail:
            return tail
    return t


def _draft_pages(entries: list[dict[str, Any]]) -> list[tuple[str, str]]:
    """(entry_id, body) for draft pages in order."""
    pages: list[tuple[int, int, str, str]] = []
    for entry in entries:
        if not isinstance(entry, dict) or not _is_draft_entry(entry):
            continue
        body = str(entry.get("body") or "").strip()
        if not body:
            continue
        eid = str(entry.get("id") or "")
        page_idx = 0
        if "#p" in eid:
            try:
                page_idx = int(eid.split("#p", 1)[1])
            except ValueError:
                page_idx = 0
        try:
            updated = int(entry.get("updatedAt") or 0)
        except (TypeError, ValueError):
            updated = 0
        pages.append((updated, page_idx, eid, body))
    pages.sort(key=lambda row: (row[0], row[1]))
    return [(eid, body) for _u, _i, eid, body in pages]


def _collect_cast(entries: list[dict[str, Any]]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict) or _is_draft_entry(entry):
            continue
        eid = str(entry.get("id") or "")
        title = str(entry.get("title") or "").strip() or "Untitled"
        body = str(entry.get("body") or "").strip()
        label = ""
        blurb = ""
        if _title_looks_like_cast(title):
            label = _cast_label_from_title(title)
        claims = _split_claims(body) if body else []
        for claim in claims[:4]:
            if _CAST_IDENTITY.match(claim):
                if not label:
                    m = re.match(
                        r"^\s*((?:character\s+[a-z0-9]+|[A-Z][\w'-]*"
                        r"(?:\s+[A-Z][\w'-]*){0,2}))\b",
                        claim,
                        re.I,
                    )
                    label = m.group(1).strip() if m else label
                blurb = _clip(claim)
                break
        if not label:
            # Sparse antagonist note titled by role still counts as cast.
            if _ANTAGONIST_SIGNAL.search(title) or _ANTAGONIST_SIGNAL.search(body[:200]):
                label = _cast_label_from_title(title) if _title_looks_like_cast(title) else title
                if claims:
                    blurb = _clip(claims[0])
            else:
                continue
        key = _normalize(label)
        if key in seen:
            continue
        seen.add(key)
        line = f"{label} — {blurb}" if blurb and _normalize(blurb) != key else label
        rows.append({"entryId": eid, "noteTitle": title, "line": _clip(line)})
        if len(rows) >= MAX_CAST:
            break
    return rows


def _collect_signal_notes(
    entries: list[dict[str, Any]], signal: re.Pattern[str], *, limit: int = 4
) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict) or _is_draft_entry(entry):
            continue
        eid = str(entry.get("id") or "")
        title = str(entry.get("title") or "").strip() or "Untitled"
        body = str(entry.get("body") or "").strip()
        blob = f"{title}\n{body}"
        if not signal.search(blob):
            continue
        for claim in (_split_claims(body) if body else [title])[:3]:
            if not signal.search(claim) and not signal.search(title):
                # Keep first claim when title alone matched.
                if body and claim != (_split_claims(body) or [""])[0]:
                    continue
            cleaned = _clip(claim)
            if len(cleaned) < 10:
                continue
            key = _normalize(cleaned)[:120]
            if key in seen:
                continue
            seen.add(key)
            rows.append({"entryId": eid, "noteTitle": title, "line": cleaned})
            if len(rows) >= limit:
                return rows
    return rows


def _collect_draft_beats(entries: list[dict[str, Any]]) -> list[dict[str, str]]:
    pages = _draft_pages(entries)
    if not pages:
        return []
    # Origin (early) + NOW (late) — orientation, not leave-off-only tail.
    early = pages[:2]
    late = pages[-2:] if len(pages) > 2 else pages
    ordered: list[tuple[str, str]] = []
    seen_ids: set[str] = set()
    for eid, body in early + late:
        if eid in seen_ids:
            continue
        seen_ids.add(eid)
        ordered.append((eid, body))
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for eid, body in ordered:
        for claim in _split_claims(body):
            cleaned = _clip(claim)
            if not _claim_is_usable(cleaned) and len(cleaned) < 24:
                continue
            key = _normalize(cleaned)[:120]
            if not key or key in seen:
                continue
            seen.add(key)
            rows.append({"entryId": eid, "noteTitle": "Main draft", "line": cleaned})
            if len(rows) >= MAX_BEATS:
                return rows
    return rows


def _collect_open_questions(entries: list[dict[str, Any]]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict) or _is_draft_entry(entry):
            continue
        eid = str(entry.get("id") or "")
        title = str(entry.get("title") or "").strip() or "Untitled"
        body = str(entry.get("body") or "").strip()
        title_is_open = bool(
            re.search(r"\b(open\s+questions?|questions?|unresolved)\b", title, re.I)
        )
        for claim in _split_claims(body) if body else []:
            if not (title_is_open or _OPEN_Q_LINE.search(claim)):
                continue
            cleaned = _clip(claim)
            if len(cleaned) < 8:
                continue
            key = _normalize(cleaned)[:120]
            if key in seen:
                continue
            seen.add(key)
            rows.append({"entryId": eid, "noteTitle": title, "line": cleaned})
            if len(rows) >= MAX_OPEN:
                return rows
        if title_is_open and not body:
            key = _normalize(title)
            if key not in seen:
                seen.add(key)
                rows.append({"entryId": eid, "noteTitle": title, "line": title})
    return rows


def _collect_planned_scraps(entries: list[dict[str, Any]]) -> list[dict[str, str]]:
    planned = collect_loose_end_items(entries, "planned")
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in planned:
        line = _clip(str(row.get("line") or ""))
        if not line:
            continue
        key = _normalize(line)[:120]
        if key in seen:
            continue
        seen.add(key)
        rows.append(
            {
                "entryId": str(row.get("entryId") or ""),
                "noteTitle": str(row.get("noteTitle") or "Note"),
                "line": line,
            }
        )
        if len(rows) >= MAX_SCRAPS:
            return rows

    for entry in entries:
        if not isinstance(entry, dict) or _is_draft_entry(entry):
            continue
        title = str(entry.get("title") or "").strip()
        low = title.lower()
        if not any(k in low for k in ("scrap", "idea", "random", "jumble", "todo")):
            if not entry_is_planned(entry):
                continue
        eid = str(entry.get("id") or "")
        body = str(entry.get("body") or "").strip()
        for claim in (_split_claims(body) if body else [title])[:4]:
            cleaned = _clip(claim)
            if not cleaned or len(cleaned) < 10:
                continue
            if _CAST_IDENTITY.match(cleaned):
                continue
            key = _normalize(cleaned)[:120]
            if key in seen:
                continue
            seen.add(key)
            rows.append({"entryId": eid, "noteTitle": title or "Note", "line": cleaned})
            if len(rows) >= MAX_SCRAPS:
                return rows
    return rows


def collect_catchup_gather(
    entries: list[dict[str, Any]],
) -> tuple[dict[str, list[dict[str, str]]], bool, bool]:
    """Return sections + has_notes + has_draft. Never invents."""
    notes = [
        e
        for e in entries
        if isinstance(e, dict)
        and not _is_draft_entry(e)
        and (
            str(e.get("body") or "").strip()
            or str(e.get("title") or "").strip()
        )
    ]
    has_notes = bool(notes)
    has_draft = bool(_draft_corpus(entries).strip())
    sections = {
        "cast": _collect_cast(entries),
        "beats": _collect_draft_beats(entries),
        "open": _collect_open_questions(entries),
        "scraps": _near_dedupe_items(_collect_planned_scraps(entries))[:MAX_SCRAPS],
        "boss": _collect_signal_notes(entries, _ANTAGONIST_SIGNAL, limit=4),
        "origin": _collect_signal_notes(entries, _ORIGIN_SIGNAL, limit=4),
        "entry": _collect_signal_notes(entries, _ENTRY_SIGNAL, limit=5),
        "cant_leave": _collect_signal_notes(entries, _CANT_LEAVE_SIGNAL, limit=4),
    }
    # Draft claims that look like origin/entry/can't-leave also count.
    for row in sections["beats"]:
        line = str(row.get("line") or "")
        if _ORIGIN_SIGNAL.search(line):
            sections["origin"].append(row)
        if _ENTRY_SIGNAL.search(line):
            sections["entry"].append(row)
        if _ANTAGONIST_SIGNAL.search(line):
            sections["boss"].append(row)
        if _CANT_LEAVE_SIGNAL.search(line):
            sections["cant_leave"].append(row)
    sections["origin"] = _near_dedupe_items(sections["origin"])[:4]
    sections["entry"] = _near_dedupe_items(sections["entry"])[:5]
    sections["boss"] = _near_dedupe_items(sections["boss"])[:4]
    sections["cant_leave"] = _near_dedupe_items(sections["cant_leave"])[:4]
    return sections, has_notes, has_draft


def catchup_prompt_block(entries: list[dict[str, Any]], question: str = "") -> str:
    """Pinned context for RAG catch-up synthesis (not shown to the writer)."""
    _ = question
    sections, has_notes, has_draft = collect_catchup_gather(entries)
    if not has_notes and not has_draft:
        return ""
    pages = _draft_pages(entries)
    lines: list[str] = []
    if pages:
        early = pages[:2]
        late = pages[-2:] if len(pages) > 2 else pages
        for label, bundle in (("ORIGIN / EARLY DRAFT", early), ("NOW / LATEST DRAFT", late)):
            for eid, body in bundle:
                excerpt = re.sub(r"\s+", " ", body).strip()
                if len(excerpt) > 1800:
                    excerpt = excerpt[:1797].rstrip() + "…"
                lines.append(f"[{label}] ({eid})\n{excerpt}")
    for key, heading in (
        ("boss", "ANTAGONIST / BOSS NOTES (even sparse — use proper names)"),
        (
            "entry",
            "ENTRY REASON — who/why they are in the domain (offer/premise/"
            "brought-by; do NOT invent transport mechanics)",
        ),
        (
            "cant_leave",
            "CAN'T LEAVE YET — why they must stay / can't leave too quickly",
        ),
        ("origin", "ORIGIN / BEFORE THE ADVENTURE"),
        ("cast", "CAST NOTES"),
        ("open", "OPEN QUESTIONS"),
        ("scraps", "PLANNED SCRAPS"),
    ):
        rows = sections.get(key) or []
        if not rows:
            continue
        lines.append(heading + ":")
        for row in rows[:5]:
            title = str(row.get("noteTitle") or "Note")
            text = str(row.get("line") or "")
            lines.append(f"- {title}: {text}")
    if not lines:
        return ""
    return (
        "Catch-up orientation pack (planning brief — use ONLY what is here; "
        "invent nothing; prefer proper names over role-only labels when notes name them):\n\n"
        + "\n\n".join(lines)
        + "\n\n"
    )


def compose_catchup_gather(
    work_hints: set[str],
    sections: dict[str, list[dict[str, str]]],
    *,
    has_notes: bool,
    has_draft: bool,
) -> str:
    """Local fallback — continuous planning brief (gold baseline voice), not bullet cards."""
    work = _work_phrase(work_hints)
    cast = sections.get("cast") or []
    beats = sections.get("beats") or []
    boss = sections.get("boss") or []
    origin = sections.get("origin") or []
    entry = sections.get("entry") or []
    cant_leave = sections.get("cant_leave") or []
    open_qs = sections.get("open") or []
    scraps = sections.get("scraps") or []
    any_material = bool(
        cast or beats or boss or origin or entry or cant_leave or open_qs or scraps
    )

    if not has_notes and not has_draft:
        return (
            f"Catch-up for {work}: nothing saved yet for this work — "
            f"no notes and no main draft to gather.\n\n{_FOOTER}"
        )
    if not any_material:
        bits = []
        if has_notes:
            bits.append("notes")
        if has_draft:
            bits.append("a draft")
        have = " and ".join(bits) if bits else "material"
        return (
            f"Catch-up for {work}: you have {have}, but nothing clear enough "
            f"yet to restate as an orientation brief. "
            f"Add draft prose plus short notes for cast, origin, entry path, "
            f"or the antagonist — even sparse lines help.\n\n{_FOOTER}"
        )

    parts: list[str] = []
    # NOW from late-ish beats.
    if beats:
        now_bits = [str(r.get("line") or "") for r in beats[-3:] if r.get("line")]
        if now_bits:
            parts.append(" ".join(now_bits))
    # Origin + entry when saved.
    for row in origin[:2]:
        line = str(row.get("line") or "").strip()
        if line and _normalize(line) not in _normalize(" ".join(parts)):
            parts.append(line if line.endswith((".", "!", "?", "…")) else line + ".")
    # Entry reason before extra cast lore — never drop when saved.
    for row in entry[:3]:
        line = str(row.get("line") or "").strip()
        if line and _normalize(line) not in _normalize(" ".join(parts)):
            parts.append(line if line.endswith((".", "!", "?", "…")) else line + ".")
    for row in cant_leave[:2]:
        line = str(row.get("line") or "").strip()
        if line and _normalize(line) not in _normalize(" ".join(parts)):
            parts.append(line if line.endswith((".", "!", "?", "…")) else line + ".")
    # Named / sparse boss — never leave as invisible role-only if notes exist.
    for row in boss[:2]:
        line = str(row.get("line") or "").strip()
        if line and _normalize(line) not in _normalize(" ".join(parts)):
            parts.append(line if line.endswith((".", "!", "?", "…")) else line + ".")
    # Cast blurbs not already covered.
    for row in cast[:3]:
        line = str(row.get("line") or "").strip()
        if line and _normalize(line) not in _normalize(" ".join(parts)):
            parts.append(line if line.endswith((".", "!", "?", "…")) else line + ".")
    if open_qs:
        qlines = "; ".join(str(r.get("line") or "") for r in open_qs[:2] if r.get("line"))
        if qlines:
            parts.append(f"Open in your notes: {qlines}")
    if scraps:
        slines = "; ".join(str(r.get("line") or "") for r in scraps[:2] if r.get("line"))
        if slines:
            parts.append(f"Planned scraps include {slines}")

    body = " ".join(p.strip() for p in parts if p.strip())
    body = re.sub(r"\s+", " ", body).strip()
    if body and body[-1] not in ".!?…":
        body += "."
    return f"{body}\n\n{_FOOTER}"


def answer_looks_at_or_above_catchup_baseline(answer: str) -> bool:
    """True when answer keeps continuous planning-brief voice (never worse than gold)."""
    text = (answer or "").strip()
    if not text:
        return False
    low = text.lower()
    # Bullet / section-card dumps are a regression vs the gold baseline voice.
    if re.search(r"(?m)^(cast|draft so far|open questions|planned scraps)\s*$", low):
        return False
    if text.count("•") >= 4:
        return False
    if len(text) < 180 and "nothing saved" not in low and "nothing clear" not in low:
        return False
    return True


def answer_catchup_gather(
    entries: list[dict[str, Any]],
    *,
    work_hints: set[str],
    question: str = "",
) -> tuple[str, list[str]]:
    """Work-scoped catch-up gather (local). question kept for API symmetry."""
    _ = question
    sections, has_notes, has_draft = collect_catchup_gather(entries)
    answer = compose_catchup_gather(
        work_hints, sections, has_notes=has_notes, has_draft=has_draft
    )
    source_ids: list[str] = []
    seen: set[str] = set()
    for key in ("beats", "entry", "cant_leave", "boss", "origin", "cast", "open", "scraps"):
        for row in sections.get(key) or []:
            eid = str(row.get("entryId") or "").strip()
            if eid and eid not in seen:
                seen.add(eid)
                source_ids.append(eid)
            if len(source_ids) >= 14:
                break
    return answer, source_ids
