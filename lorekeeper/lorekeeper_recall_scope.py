"""LoreKeeper — recall scope: work disambiguation, merge, name collisions (#34–40)."""
from __future__ import annotations

import json
import re
from typing import Any

from lorekeeper_character_summary import character_targets
from lorekeeper_reliability import (
    collapse_near_duplicate_work_tags,
    entries_mentioning_targets,
    entry_matches_work,
    work_named_in_question,
)

ENTRIES_KEY = "lorekeeper_entries_v1"
DOCUMENTS_KEY = "lorekeeper_documents_v1"


def _parse_json_list(raw: str | list | None) -> list[dict[str, Any]]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [e for e in raw if isinstance(e, dict)]
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def merge_recall_user_data(
    server_data: dict[str, Any],
    *,
    client_documents: list[dict[str, Any]] | str | None = None,
    client_entries: list[dict[str, Any]] | str | None = None,
) -> dict[str, Any]:
    """Client editor state wins on id collision (#40)."""
    data = dict(server_data or {})

    server_entries = _parse_json_list(data.get(ENTRIES_KEY))
    if client_entries is not None:
        client_list = _parse_json_list(client_entries)
        by_id: dict[str, dict[str, Any]] = {}
        for entry in server_entries:
            eid = str(entry.get("id") or "")
            if eid:
                by_id[eid] = entry
        for entry in client_list:
            eid = str(entry.get("id") or "")
            if eid:
                by_id[eid] = entry
            else:
                by_id[f"__anon_{len(by_id)}"] = entry
        data[ENTRIES_KEY] = json.dumps(list(by_id.values()))

    server_docs = _parse_json_list(data.get(DOCUMENTS_KEY))
    if client_documents is not None:
        client_docs = _parse_json_list(client_documents)
        by_doc: dict[str, dict[str, Any]] = {}
        for doc in server_docs:
            did = str(doc.get("id") or "")
            if did:
                by_doc[did] = doc
        for doc in client_docs:
            did = str(doc.get("id") or "")
            if did:
                by_doc[did] = doc
            else:
                by_doc[f"__anon_{len(by_doc)}"] = doc
        data[DOCUMENTS_KEY] = json.dumps(list(by_doc.values()))

    return data


def distinct_work_tags(entries: list[dict[str, Any]]) -> list[str]:
    """Stable list of work tags from entry tags only."""
    seen: set[str] = set()
    ordered: list[str] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        for tag in entry.get("tags") or []:
            raw = str(tag).strip()
            if len(raw) <= 2:
                continue
            key = raw.lower()
            if key in seen:
                continue
            seen.add(key)
            ordered.append(raw)
    return ordered


def _works_mentioning_targets(
    entries: list[dict[str, Any]], targets: list[str]
) -> list[str]:
    """Work tags where every target appears in at least one entry."""
    if not targets:
        return []
    hits: list[str] = []
    for work in distinct_work_tags(entries):
        work_hint = {work.lower()}
        scoped = [e for e in entries if entry_matches_work(e, work_hint)]
        if not scoped:
            continue
        if all(entries_mentioning_targets(scoped, [t]) for t in targets):
            hits.append(work)
    return hits


def _format_work_list(works: list[str]) -> str:
    if len(works) == 1:
        return f"“{works[0]}”"
    if len(works) == 2:
        return f"“{works[0]}” and “{works[1]}”"
    head = ", ".join(f"“{w}”" for w in works[:-1])
    return f"{head}, and “{works[-1]}”"


def format_work_disambiguation(
    *,
    works: list[str],
    target_label: str | None = None,
    reason: str = "multiple_works",
) -> str:
    listed = _format_work_list(works)
    if reason == "name_collision" and target_label:
        return (
            f"You have notes about {target_label} in more than one project ({listed}). "
            f"Name the work in your question — e.g. “In {works[0]}, who is {target_label}?” — "
            "so LoreKeeper does not mix projects."
        )
    if target_label:
        return (
            f"Your question could apply to more than one project ({listed}). "
            f"Name the work — e.g. “In {works[0]}, who is {target_label}?”"
        )
    return (
        f"Your question could apply to more than one project ({listed}). "
        f"Start with the project name — e.g. “In {works[0]}, who is Character M?”"
    )


def check_work_disambiguation(
    question: str,
    entries: list[dict[str, Any]],
    *,
    scope_work: str = "",
    strict_work: bool = False,
) -> str | None:
    """Return a clarifying answer when work scope is ambiguous (#35, #37)."""
    known_works = distinct_work_tags(entries)
    if (
        strict_work
        or work_named_in_question(question, known_works=known_works, entries=entries)
        or scope_work.strip()
    ):
        return None

    targets = character_targets(question)
    if targets:
        works = _works_mentioning_targets(entries, targets)
        if len(works) >= 2:
            reason = "name_collision" if len(targets) == 1 else "multiple_works"
            return format_work_disambiguation(
                works=works[:5],
                target_label=targets[0] if len(targets) == 1 else None,
                reason=reason,
            )
        return None

    q = (question or "").lower()
    if not re.search(r"\b(who|what|where|when|how|list|tell me about)\b", q):
        return None

    matching = collapse_near_duplicate_work_tags(
        question, distinct_work_tags(entries)
    )
    if len(matching) >= 2:
        return format_work_disambiguation(works=matching[:5])
    return None
