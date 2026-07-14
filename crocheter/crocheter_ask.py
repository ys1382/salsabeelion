"""Crocheter — factual crochet Q&A (no creators, no brand rankings)."""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any

DEFAULT_MODEL = os.environ.get("CROCHETER_ASK_MODEL", "claude-sonnet-4-20250514")

_SYSTEM = """You are a calm, factual crochet helper on Cozy Crocheter's Sanctum.

Answer only crochet craft questions: stitches, techniques, hooks, gauge, reading patterns, fiber types, care, and similar practical topics.

Rules:
- Do NOT discuss YouTube creators, influencers, channels, or social media personalities.
- Do NOT rank or compare yarn brands or say one brand is better than another.
- For a named yarn or yarn cake: give fiber content and weight category if you know them from public product info; if unsure, say to check the ball band or manufacturer label.
- Use US crochet terms unless the question asks for UK terms.
- Keep answers short (usually 2–5 sentences). No fluff.
- If the question is outside crochet craft, say you only help with crochet technique and materials."""

_CREATOR_PATTERNS = (
    re.compile(r"\b(youtube|youtu\.be|tiktok|instagram|twitch|patreon|onlyfans)\b", re.I),
    re.compile(
        r"\b(influencer|content creator|you\s*tuber|youtuber|crochet\s*channel|"
        r"subscribe to|who should i watch|best channel)\b",
        re.I,
    ),
    re.compile(r"\b(follow (her|him|them)|@)\b", re.I),
)

_BRAND_COMPARE_PATTERNS = (
    re.compile(r"\b(better than|worse than|best brand|worst brand)\b", re.I),
    re.compile(r"\bwhich (yarn|brand) (is )?(better|best|worst)\b", re.I),
    re.compile(r"\brecommend a brand\b", re.I),
)


def _anthropic_api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if key:
        return key
    base = os.environ.get("KIDS_SITES_BASE", os.path.expanduser("~/kids-sites"))
    for path in (
        os.path.join(base, "anthropic.key"),
        os.path.join(os.path.dirname(__file__), "anthropic.key"),
    ):
        if os.path.isfile(path):
            with open(path, encoding="utf-8") as f:
                return f.read().strip()
    return ""


def ask_available() -> bool:
    return bool(_anthropic_api_key())


def classify_question(question: str) -> str | None:
    """Return refusal code if out of scope, else None."""
    q = (question or "").strip()
    if not q:
        return "empty_question"
    for pat in _CREATOR_PATTERNS:
        if pat.search(q):
            return "creators_out_of_scope"
    for pat in _BRAND_COMPARE_PATTERNS:
        if pat.search(q):
            return "brand_compare_out_of_scope"
    return None


def refusal_message(code: str) -> str:
    if code == "creators_out_of_scope":
        return (
            "I stick to stitches, yarn, and technique — not YouTube or social media creators. "
            "Try asking about a stitch, fiber, or pattern step instead."
        )
    if code == "brand_compare_out_of_scope":
        return (
            "I don't compare brands or pick favorites. "
            "You can ask what fiber a specific yarn is made of, or how a fiber behaves in crochet."
        )
    if code == "empty_question":
        return "Type a crochet question first."
    if code == "ask_unavailable":
        return "The crochet helper isn't available right now. Try again later."
    return "I couldn't answer that. Try rephrasing your crochet question."


def _call_anthropic(*, user_content: str, max_tokens: int = 700) -> str:
    api_key = _anthropic_api_key()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    payload = {
        "model": DEFAULT_MODEL,
        "max_tokens": max_tokens,
        "system": _SYSTEM,
        "messages": [{"role": "user", "content": user_content}],
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    blocks = data.get("content") or []
    text_parts = [
        b.get("text", "")
        for b in blocks
        if isinstance(b, dict) and b.get("type") == "text"
    ]
    answer = "".join(text_parts).strip()
    if not answer:
        raise RuntimeError("Anthropic returned empty content")
    return answer


def answer_crochet_question(question: str) -> dict[str, Any]:
    q = (question or "").strip()
    blocked = classify_question(q)
    if blocked:
        return {"ok": False, "error": blocked, "answer": refusal_message(blocked)}

    if not ask_available():
        return {"ok": False, "error": "ask_unavailable", "answer": refusal_message("ask_unavailable")}

    if len(q) > 2000:
        q = q[:2000]

    try:
        answer = _call_anthropic(user_content=q)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        return {"ok": False, "error": "ask_failed", "detail": f"HTTP {exc.code}: {detail}"}
    except Exception as exc:
        return {"ok": False, "error": "ask_failed", "detail": str(exc)[:300]}

    return {"ok": True, "answer": answer, "question": q}
