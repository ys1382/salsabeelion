"""Normalize writer corpus text (HTML entities, whitespace) — local only."""
from __future__ import annotations

import html
import re


def normalize_corpus_text(text: str) -> str:
    """Decode entities and collapse odd whitespace from Quill/HTML exports."""
    t = html.unescape(text or "")
    t = t.replace("\u00a0", " ")
    t = re.sub(r"\s+", " ", t)
    return t.strip()
