"""LoreKeeper — Word help: language suggestions on writer-typed phrases (not lore)."""

from __future__ import annotations

from lorekeeper_rag import _call_anthropic, anthropic_api_key

_SYSTEM = """You are a concise writing assistant for word and phrase help only.

Rules:
- Answer ONLY what the writer asked about language: synonyms, antonyms, rhymes, alliterations, tone shifts, formality, idioms, shorter/longer phrasing, etc.
- Do NOT invent story, characters, plot, or world details.
- Do NOT write scene drafts, dialogue, or prose paragraphs.
- Format: short and scannable — use a bullet or numbered list when giving multiple options.
- If the request is unclear, ask one brief clarifying question.
- If they ask for story ideas or lore, decline briefly and suggest Idea spinner or their own notes instead."""

MAX_QUERY_CHARS = 500


def word_help_enabled() -> bool:
    return bool(anthropic_api_key())


def answer_word_help(query: str) -> dict:
    """Return language help for a writer-typed query. Does not read account notes."""
    text = (query or "").strip()
    if not text:
        return {"ok": False, "error": "empty_query"}
    if len(text) > MAX_QUERY_CHARS:
        text = text[:MAX_QUERY_CHARS]
    if not word_help_enabled():
        return {"ok": False, "error": "word_help_unavailable"}
    try:
        answer, _stop = _call_anthropic(
            system=_SYSTEM,
            user_content=text,
            max_tokens=800,
        )
    except Exception:
        return {"ok": False, "error": "word_help_failed"}
    return {"ok": True, "answer": answer}
