"""ISBN / title / author normalization — never invent missing fields."""
from __future__ import annotations

import re
import unicodedata
from typing import Any

_ISBN_STRIP = re.compile(r"[^0-9Xx]")
_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)


def digits_only_isbn(raw: str | None) -> str | None:
    if raw is None:
        return None
    s = _ISBN_STRIP.sub("", str(raw).strip())
    if not s:
        return None
    return s.upper()


def isbn10_to_isbn13(isbn10: str) -> str | None:
    s = digits_only_isbn(isbn10)
    if not s or len(s) != 10:
        return None
    core = "978" + s[:9]
    total = sum((1 if i % 2 == 0 else 3) * int(core[i]) for i in range(12))
    check = (10 - (total % 10)) % 10
    return core + str(check)


def isbn13_to_isbn10(isbn13: str) -> str | None:
    s = digits_only_isbn(isbn13)
    if not s or len(s) != 13 or not s.startswith("978"):
        return None
    core = s[3:12]
    total = sum((10 - i) * int(core[i]) for i in range(9))
    check_n = (11 - (total % 11)) % 11
    check = "X" if check_n == 10 else str(check_n)
    return core + check


def validate_isbn13(isbn13: str | None) -> str | None:
    s = digits_only_isbn(isbn13)
    if not s or len(s) != 13 or not s.isdigit():
        return None
    total = sum((1 if i % 2 == 0 else 3) * int(s[i]) for i in range(12))
    check = (10 - (total % 10)) % 10
    if check != int(s[12]):
        return None
    return s


def validate_isbn10(isbn10: str | None) -> str | None:
    s = digits_only_isbn(isbn10)
    if not s or len(s) != 10:
        return None
    if not s[:9].isdigit():
        return None
    if s[9] not in "0123456789X":
        return None
    total = sum((10 - i) * (10 if s[i] == "X" else int(s[i])) for i in range(10))
    if total % 11 != 0:
        return None
    return s


def normalize_isbn_pair(raw: str | None) -> tuple[str | None, str | None]:
    """Return (isbn_10, isbn_13) when valid; else (None, None) for that side."""
    s = digits_only_isbn(raw)
    if not s:
        return None, None
    if len(s) == 13:
        i13 = validate_isbn13(s)
        i10 = isbn13_to_isbn10(i13) if i13 else None
        i10 = validate_isbn10(i10) if i10 else None
        return i10, i13
    if len(s) == 10:
        i10 = validate_isbn10(s)
        i13 = isbn10_to_isbn13(i10) if i10 else None
        i13 = validate_isbn13(i13) if i13 else None
        return i10, i13
    return None, None


def normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    s = unicodedata.normalize("NFKC", str(value)).strip().lower()
    if not s:
        return None
    s = _PUNCT.sub(" ", s)
    s = _WS.sub(" ", s).strip()
    return s or None


def normalize_title(title: str | None) -> str | None:
    if title is None:
        return None
    raw = unicodedata.normalize("NFKC", str(title)).strip()
    if not raw:
        return None
    # Drop subtitle before punctuation stripping so "Title: Subtitle" keys on title.
    if ":" in raw:
        head, _tail = raw.split(":", 1)
        if len(head.strip()) >= 4:
            raw = head.strip()
    s = normalize_text(raw)
    if not s:
        return None
    for prefix in ("the ", "a ", "an "):
        if s.startswith(prefix) and len(s) > len(prefix) + 2:
            s = s[len(prefix) :]
            break
    return s or None


def normalize_author(author: str | None) -> str | None:
    if author is None:
        return None
    raw = unicodedata.normalize("NFKC", str(author)).strip()
    if not raw:
        return None
    # Flip "Last, First" before punctuation stripping removes the comma.
    if "," in raw:
        parts = [p.strip() for p in raw.split(",", 1)]
        if len(parts) == 2 and parts[0] and parts[1]:
            raw = f"{parts[1]} {parts[0]}"
    s = normalize_text(raw)
    return s or None


def match_key(
    title: str | None,
    author: str | None,
    publisher: str | None = None,
    edition: str | None = None,
    fmt: str | None = None,
) -> str | None:
    parts = [
        normalize_title(title),
        normalize_author(author),
        normalize_text(publisher),
        normalize_text(edition),
        normalize_text(fmt),
    ]
    filled = [p for p in parts if p]
    if len(filled) < 2:
        return None
    return "|".join(filled)


def safe_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        f = float(str(value).replace("$", "").replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    if f < 0 or f > 100_000:
        return None
    return f
