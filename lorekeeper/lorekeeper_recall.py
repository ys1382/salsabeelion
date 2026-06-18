"""LoreKeeper — recall assist on the writer's own notes only (librarian, not author)."""
from __future__ import annotations

import json
import re
from typing import Any

from lorekeeper_character_summary import (
    build_gathered_answer,
    character_summary_sources,
    character_targets,
    is_who_is_question,
)
from lorekeeper_relations import restate_relationships

ENTRIES_KEY = "lorekeeper_entries_v1"
DOCUMENTS_KEY = "lorekeeper_documents_v1"

STOP = frozenset(
    """
    a an the and or of in on at to for with from by is was are were be been being
    have has had do does did will would could should may might must can i me my you your
    it its this that these those what which who how when where why hey hi hello please
    remind tell about the
    """.split()
)

KIND_LABELS = {
    "note": "Note",
    "document": "Document",
    "character": "Character",
    "relationship": "Relationship",
    "politics": "Politics & intrigue",
    "place": "Place / setting",
    "scene": "Scene",
    "visual": "Visual / illustration",
    "design": "Design & typography",
    "dialogue": "Dialogue & voice",
    "plot": "Plot & structure",
    "script": "Script",
    "event": "Event",
    "faction": "Faction / group",
    "species": "Species / world rules",
    "theme": "Theme & motif",
    "reference": "Reference / inspo",
}


def _tokenize(text: str) -> list[str]:
    return [
        w
        for w in re.findall(r"[a-z0-9']+", (text or "").lower())
        if len(w) > 1 and w not in STOP
    ]


def _kind_label(kind: str) -> str:
    return KIND_LABELS.get(kind or "note", "Note")


def _best_excerpt(body: str, question_tokens: list[str], max_len: int = 360) -> str:
    body = (body or "").strip()
    if not body:
        return "(No body text in this entry.)"
    sentences = re.split(r"(?<=[.!?])\s+", body)
    if len(sentences) <= 1:
        sentences = [body]
    best = sentences[0]
    best_score = -1
    q_set = set(question_tokens)
    for sentence in sentences:
        score = len(q_set & set(_tokenize(sentence)))
        if score > best_score:
            best_score = score
            best = sentence
    if len(best) > max_len:
        trimmed = best[: max_len - 1].rsplit(" ", 1)[0]
        return trimmed + "…"
    return best


def _score_entry(question: str, entry: dict[str, Any]) -> int:
    question_tokens = _tokenize(question)
    q_lower = (question or "").lower()
    title = str(entry.get("title") or "")
    body = str(entry.get("body") or "")
    tag_list = entry.get("tags") or []
    tags = " ".join(str(t) for t in tag_list)
    kind = str(entry.get("kind") or "")
    hay_text = " ".join([title, body, tags, kind]).lower()
    hay_tokens = _tokenize(hay_text)
    hay_set = set(hay_tokens)
    q_set = set(question_tokens)
    score = len(q_set & hay_set) * 2
    for token in question_tokens:
        if token in _tokenize(title):
            score += 4
        if token in _tokenize(tags):
            score += 5
    for tag in tag_list:
        tag_clean = str(tag).strip().lower()
        if len(tag_clean) > 2 and tag_clean in q_lower:
            score += 20
    title_clean = title.strip().lower()
    if len(title_clean) > 3 and title_clean in q_lower:
        score += 10
    for i in range(len(question_tokens) - 1):
        bigram = question_tokens[i] + " " + question_tokens[i + 1]
        if bigram in hay_text:
            score += 6
    return score


def _parse_entries(raw: str | None) -> list[dict[str, Any]]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def _strip_html(html: str) -> str:
    text = re.sub(r"</p>\s*", "\n\n", html, flags=re.I)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</h[1-6]>\s*", "\n\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n ", "\n", text)
    return text.strip()


def _paragraph_chunks(body: str, min_len: int = 40) -> list[str]:
    text = (body or "").strip()
    if not text:
        return []
    parts = re.split(r"\n\s*\n+", text)
    if len(parts) <= 1:
        parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if len(p.strip()) >= min_len]


def _entries_from_documents(raw: str | None) -> list[dict[str, Any]]:
    if not raw:
        return []
    try:
        docs = json.loads(raw) if isinstance(raw, str) else raw
    except json.JSONDecodeError:
        return []
    if not isinstance(docs, list):
        return []
    entries: list[dict[str, Any]] = []
    for doc in docs:
        if not isinstance(doc, dict):
            continue
        doc_id = str(doc.get("id") or "")
        doc_title = str(doc.get("title") or "Untitled document")
        work_tag = str(doc.get("workTag") or doc_title)
        tags = [work_tag] if work_tag else []
        if doc.get("bodyFormat") == "html":
            body = _strip_html(str(doc.get("bodyHtml") or ""))
            if body:
                entries.append(
                    {
                        "id": doc_id,
                        "title": doc_title,
                        "body": body,
                        "tags": tags,
                        "kind": "document",
                    }
                )
                for idx, chunk in enumerate(_paragraph_chunks(body)):
                    entries.append(
                        {
                            "id": f"{doc_id}#p{idx}",
                            "title": doc_title,
                            "body": chunk,
                            "tags": tags,
                            "kind": "document",
                            "parentDocId": doc_id,
                        }
                    )
            continue
        for page in doc.get("pages") or []:
            if not isinstance(page, dict):
                continue
            page_title = str(page.get("title") or "Page")
            entries.append(
                {
                    "id": str(page.get("id") or ""),
                    "title": f"{doc_title} / {page_title}",
                    "body": str(page.get("body") or ""),
                    "tags": tags,
                    "kind": str(page.get("kind") or "note"),
                }
            )
    return entries


def _all_entries(user_data: dict[str, Any]) -> list[dict[str, Any]]:
    legacy = _parse_entries(user_data.get(ENTRIES_KEY))
    from_docs = _entries_from_documents(user_data.get(DOCUMENTS_KEY))
    if not from_docs:
        return legacy
    if not legacy:
        return from_docs
    seen = {e.get("id") for e in from_docs if e.get("id")}
    merged = from_docs[:]
    for entry in legacy:
        if entry.get("id") not in seen:
            merged.append(entry)
    return merged


def _rank_entries(question: str, entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    question_tokens = _tokenize(question)
    ranked: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        score = _score_entry(question, entry)
        if score <= 0:
            continue
        ranked.append(
            {
                "id": str(entry.get("id") or ""),
                "title": str(entry.get("title") or "Untitled"),
                "kind": str(entry.get("kind") or "note"),
                "kindLabel": _kind_label(str(entry.get("kind") or "note")),
                "score": score,
                "excerpt": _best_excerpt(str(entry.get("body") or ""), question_tokens),
                "body": str(entry.get("body") or "")[:8000],
            }
        )
    ranked.sort(key=lambda row: row["score"], reverse=True)
    return ranked


def _local_answer(question: str, ranked: list[dict[str, Any]], entries: list[dict[str, Any]]) -> str:
    ranked_ids = {row["id"] for row in ranked if row.get("id")}

    character_answer, gather_ids = build_gathered_answer(question, entries)
    if character_answer:
        if character_targets(question) or is_who_is_question(question):
            return character_answer
        rel = restate_relationships(
            question, entries, set(gather_ids) or ranked_ids
        )
        if rel:
            return character_answer + "\n\n" + rel
        return character_answer

    restated = restate_relationships(question, entries, ranked_ids)
    if restated and not is_who_is_question(question):
        event_bits: list[str] = []
        q_tokens = _tokenize(question)
        for row in ranked[:3]:
            for sentence in re.split(r"(?<=[.!?])\s+", row.get("body") or ""):
                st = sentence.strip()
                if not st:
                    continue
                st_low = st.lower()
                if any(t in st_low for t in q_tokens if len(t) > 3):
                    if not re.search(r"'s\s+(husband|wife|son|daughter|child)\b", st, re.I):
                        event_bits.append(st)
                        break
        if event_bits:
            restated += "\n\nAlso in your notes:\n• " + event_bits[0]
        return restated

    if character_targets(question) or is_who_is_question(question):
        label = character_targets(question)[0] if character_targets(question) else "that character"
        return (
            f"I couldn't find anything about {label} in your saved notes for this work. "
            "Tag entries with the work name on every note for that project, then ask again — "
            "e.g. “In Smoke and Mirrors, who is Character B?”"
        )

    if not ranked:
        return (
            "I looked through your saved notes and documents and didn't find anything that clearly matches. "
            "Tag entries with the title of the work — the book, script, skit, or game name "
            "(same tag on every note for that project), then ask again and name it — "
            "e.g. “In Smoke and Mirrors, who is…?”"
        )
    if len(ranked) == 1:
        row = ranked[0]
        return (
            f"From your entry “{row['title']}” ({row['kindLabel']}):\n\n"
            f"{row['excerpt']}\n\n"
            "— Pulled from your notes only. Nothing invented."
        )

    lines = ["From what you've written:\n"]
    for row in ranked[:4]:
        lines.append(f"• {row['title']} ({row['kindLabel']}): {row['excerpt']}")
    lines.append("\n— Pulled from your notes only. Nothing invented.")
    return "\n".join(lines)


def recall_from_user_data(
    question: str,
    user_data: dict[str, Any],
    *,
    client_documents: list[dict[str, Any]] | str | None = None,
    client_entries: list[dict[str, Any]] | str | None = None,
) -> dict[str, Any]:
    question = (question or "").strip()
    if not question:
        return {"ok": False, "error": "empty_question"}
    if len(question) > 2000:
        question = question[:2000]

    data = dict(user_data or {})
    if client_documents is not None:
        if isinstance(client_documents, list):
            data[DOCUMENTS_KEY] = json.dumps(client_documents)
        elif isinstance(client_documents, str):
            data[DOCUMENTS_KEY] = client_documents
    if client_entries is not None:
        if isinstance(client_entries, list):
            data[ENTRIES_KEY] = json.dumps(client_entries)
        elif isinstance(client_entries, str):
            data[ENTRIES_KEY] = client_entries

    entries = _all_entries(data)
    if not entries:
        return {
            "ok": True,
            "answer": "You don't have any saved entries yet. Add notes first, then ask again.",
            "sources": [],
            "mode": "local",
            "entryCount": 0,
        }

    ranked = _rank_entries(question, entries)
    summary_ids = character_summary_sources(question, entries)
    if summary_ids:
        id_set = set(summary_ids)
        ranked = [r for r in ranked if r["id"] in id_set] + [r for r in ranked if r["id"] not in id_set]
    answer = _local_answer(question, ranked, entries)

    sources = [
        {
            "id": row["id"],
            "title": row["title"],
            "kind": row["kind"],
            "kindLabel": row["kindLabel"],
            "excerpt": row["excerpt"],
        }
        for row in ranked[:6]
    ]
    return {
        "ok": True,
        "answer": answer,
        "sources": sources,
        "mode": "local",
        "entryCount": len(entries),
    }
