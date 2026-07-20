"""LoreKeeper — writer-confirmed Ask sources (never false-empty after confirm)."""
from __future__ import annotations

import re
from typing import Any

_EMPTY_CLAIM = re.compile(
    r"(?is)\b(?:"
    r"no sources?\b.{0,100}(?:spell out|mention|contain|say)|"
    r"do not contain\s+story[- ]dynamic|"
    r"no story[- ]dynamic|"
    r"only contain\s+one\s+(?:saved\s+)?draft|"
    r"covers?\s+their\s+origin|"
    r"nothing (?:clear |saved )?(?:is saved )?(?:yet )?(?:about how|on how|about).{0,60}relationship|"
    r"nothing clear is saved yet about how|"
    r"tie is not spelled out|"
    r"not spelled out yet\b.{0,40}(?:relationship|interaction|between|window|dynamic)|"
    r"relationship is not yet spelled out|"
    r"sources? (?:do not|don't|do not)\b.{0,60}(?:interaction|alliance|rivalry|relationship)"
    r")",
)

_NAME_TOKEN = re.compile(r"\b([A-Z][a-zA-Z]{2,})\b")


def answer_looks_like_empty_claim(answer: str) -> bool:
    return bool(_EMPTY_CLAIM.search(answer or ""))


def _question_name_hints(question: str) -> list[str]:
    from lorekeeper_relations import relationship_between_pair
    from lorekeeper_character_summary import character_targets

    hints: list[str] = []
    pair = relationship_between_pair(question)
    if pair:
        hints.extend(pair)
    hints.extend(character_targets(question) or [])
    for m in _NAME_TOKEN.finditer(question or ""):
        token = m.group(1)
        if token.lower() in (
            "the",
            "and",
            "for",
            "with",
            "from",
            "cities",
            "rust",
            "summarize",
            "relationship",
            "protagonist",
            "antagonist",
        ):
            continue
        hints.append(token)
    # Dedupe case-insensitive
    out: list[str] = []
    seen: set[str] = set()
    for h in hints:
        key = h.lower().strip()
        if len(key) < 2 or key in seen:
            continue
        seen.add(key)
        out.append(h.strip())
    return out


def _entry_rows_for_confirmed(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "").strip()
        body = str(entry.get("body") or "").strip()
        if not eid and not body:
            continue
        kind = str(entry.get("kind") or "note")
        rows.append(
            {
                "id": eid,
                "title": str(entry.get("title") or "Untitled"),
                "kind": kind,
                "kindLabel": str(entry.get("kindLabel") or kind.title()),
                "score": 50,
                "excerpt": body[:220],
                "body": body[:8000],
            }
        )
    return rows


def summarize_confirmed_entries(
    question: str, entries: list[dict[str, Any]]
) -> tuple[str, list[dict[str, Any]]]:
    """Build an answer from writer-selected notes only — never invent a gap when text exists."""
    rows = _entry_rows_for_confirmed(entries)
    if not rows:
        return (
            "The notes you selected have no readable text right now. Ask again after they sync.",
            [],
        )

    from lorekeeper_relations import (
        answer_story_arc_relationship,
        is_story_arc_relationship_question,
    )

    if is_story_arc_relationship_question(question):
        arc = answer_story_arc_relationship(question, entries)
        if (
            arc
            and arc[0]
            and not answer_looks_like_empty_claim(arc[0])
            and "nothing clear is saved yet about how" not in arc[0].lower()
        ):
            source_ids = set(arc[1] or [])
            used = [r for r in rows if r["id"] in source_ids] or rows[:3]
            return arc[0], used

    hints = [h.lower() for h in _question_name_hints(question)]
    snippets: list[str] = []
    used_rows: list[dict[str, Any]] = []
    for row in rows:
        body = row.get("body") or ""
        low = body.lower()
        title = row.get("title") or "Untitled"
        if hints and not any(h in low or h in title.lower() for h in hints):
            # Still include if this was explicitly confirmed — writer pinned it.
            pass
        # Prefer paragraphs that mention a asked name.
        paras = [p.strip() for p in re.split(r"\n\s*\n+", body) if p.strip()]
        picked = ""
        for para in paras:
            plow = para.lower()
            if hints and any(h in plow for h in hints):
                picked = para
                break
        if not picked and paras:
            picked = paras[0]
        if not picked:
            continue
        if len(picked) > 700:
            picked = picked[:699].rsplit(" ", 1)[0] + "…"
        snippets.append(f"From “{title}”:\n{picked}")
        used_rows.append(row)
        if len(snippets) >= 3:
            break

    if not snippets:
        # Absolute last resort: first chunks of selected notes.
        for row in rows[:2]:
            body = (row.get("body") or "")[:700]
            if not body:
                continue
            snippets.append(f"From “{row.get('title') or 'Untitled'}”:\n{body}")
            used_rows.append(row)

    if not snippets:
        return (
            "The notes you selected have no readable text right now.",
            rows[:1],
        )

    answer = (
        "From the notes you selected:\n\n"
        + "\n\n".join(snippets)
        + "\n\n— From your selected notes only. Nothing invented."
    )
    return answer, used_rows or rows[:3]
