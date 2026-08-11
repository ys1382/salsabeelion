"""LoreKeeper — recall scope: work disambiguation, merge, name collisions (#34–40)."""
from __future__ import annotations

import json
import re
from typing import Any

from lorekeeper_character_summary import character_targets
from lorekeeper_reliability import (
    cluster_same_project_tags,
    collapse_near_duplicate_work_tags,
    entries_mentioning_targets,
    entry_matches_work,
    work_named_in_question,
    work_tags_are_typo_variants,
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


def _cast_label_tags(entries: list[dict[str, Any]]) -> set[str]:
    """Character / species entry titles used as tags — not story projects."""
    labels: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        kind = str(entry.get("kind") or "").lower()
        if kind not in {"character", "species", "relationship"}:
            continue
        title = str(entry.get("title") or "").split(" / ")[0].strip().lower()
        if len(title) > 2:
            labels.add(title)
            # "Lord Tenebris" / "Tenebris Notes" → also "tenebris"
            for part in re.split(r"\s+", title):
                part = part.strip(" .,:;!?\"'").lower()
                if len(part) > 2 and part not in {"lord", "lady", "duke", "notes", "and", "the"}:
                    labels.add(part)
    return labels


def _works_mentioning_targets(
    entries: list[dict[str, Any]], targets: list[str]
) -> list[str]:
    """Story projects where every target appears — not cast/faction personal tags."""
    if not targets:
        return []
    target_keys = {str(t).strip().lower() for t in targets if str(t).strip()}
    cast_labels = _cast_label_tags(entries) | target_keys
    mention_entries = entries_mentioning_targets(entries, targets)
    if not mention_entries:
        return []
    mention_ids = {str(e.get("id") or "") for e in mention_entries}

    raw_hits: list[str] = []
    for work in distinct_work_tags(entries):
        wlow = work.lower()
        if wlow in cast_labels or wlow in target_keys:
            continue
        if any(work_tags_are_typo_variants(work, t) for t in targets):
            continue
        work_hint = {wlow}
        scoped = [e for e in entries if entry_matches_work(e, work_hint)]
        if not scoped:
            continue
        if not all(entries_mentioning_targets(scoped, [t]) for t in targets):
            continue
        # Skip tags that only ride along on notes already tagged to another project.
        sole = 0
        for entry in scoped:
            if str(entry.get("id") or "") not in mention_ids:
                continue
            tags = [
                str(t).strip()
                for t in (entry.get("tags") or [])
                if str(t).strip() and len(str(t).strip()) > 2
            ]
            other = [
                t
                for t in tags
                if t.lower() != wlow
                and t.lower() not in cast_labels
                and t.lower() not in target_keys
                and not work_tags_are_typo_variants(t, work)
            ]
            if not other:
                sole += 1
        if sole == 0:
            continue
        raw_hits.append(work)

    if not raw_hits:
        return []

    # Collapse Smoke & Mirrors / Smoke and Mirrors style duplicates.
    clusters = cluster_same_project_tags(raw_hits)
    scored: list[tuple[int, str]] = []
    for cluster in clusters:
        best = ""
        best_n = -1
        for work in cluster:
            n = sum(
                1
                for e in mention_entries
                if entry_matches_work(e, {work.lower()})
            )
            if n > best_n or (n == best_n and len(work) > len(best)):
                best_n = n
                best = work
        if best:
            scored.append((best_n, best))
    scored.sort(key=lambda x: (-x[0], -len(x[1])))
    if not scored:
        return []
    # One clear home project — don't ask which story when cast tags / tiny side tags remain.
    if len(scored) >= 2 and scored[0][0] >= max(5, 5 * scored[1][0]):
        return [scored[0][1]]
    return [w for _, w in scored]


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
    scope_document_id: str = "",
    strict_work: bool = False,
) -> str | None:
    """Return a clarifying answer when work scope is ambiguous (#35, #37)."""
    known_works = distinct_work_tags(entries)
    if (
        strict_work
        or work_named_in_question(question, known_works=known_works, entries=entries)
        or scope_work.strip()
        or str(scope_document_id or "").strip()
    ):
        # Doc Ask (or named work) already pinned the context — never ask which project.
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
