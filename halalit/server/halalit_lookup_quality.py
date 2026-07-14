"""Filter garbled cover-OCR / scroll-scanner title+author pairs from owner lookup lists."""
from __future__ import annotations

import re

_WORD_RE = re.compile(r"\s+")
_PAREN_FRAGMENT_RE = re.compile(r"(?:^\s*[A-Za-z]\)|\(\s*[A-Za-z]\s*\)|\)\s*[a-z]{1,3}\s*$)")


def _words(line: str) -> list[str]:
    return [w for w in _WORD_RE.split(line.strip()) if w]


def _core_word(word: str) -> str:
    return re.sub(r"[^A-Za-z'.-]", "", word)


def _line_garbage(line: str, kind: str) -> bool:
    line = (line or "").strip()
    if not line:
        return False
    if _PAREN_FRAGMENT_RE.search(line):
        return True
    letters = re.sub(r"[^A-Za-z]", "", line)
    if len(letters) < 3:
        return True
    if len(letters) / max(len(line), 1) < 0.55:
        return True
    words = _words(line)
    if not words:
        return True

    real_words = 0
    long_words = 0
    for w in words:
        core = _core_word(w)
        if len(core) >= 2 and re.search(r"[aeiouAEIOU]", core):
            real_words += 1
        if len(core) >= 4 and re.search(r"[aeiouAEIOU]", core):
            long_words += 1
    if not real_words:
        return True

    cores = [_core_word(w) for w in words if _core_word(w)]
    if cores and all(len(c) <= 3 for c in cores):
        return True

    if kind == "title":
        if long_words == 0 and len(" ".join(words)) < 14:
            return True
    if kind == "author":
        if long_words == 0 and len(words) <= 2 and len(letters) < 8:
            return True

    return False


def is_garbage_lookup(title: str, author: str = "") -> bool:
    title = (title or "").strip()
    author = (author or "").strip()
    if not title:
        return True
    if _line_garbage(title, "title"):
        return True
    if author and _line_garbage(author, "author"):
        return True
    return False
