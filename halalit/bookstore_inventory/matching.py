"""Match bookstore listings to Halalit catalog books."""
from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Iterable

from .normalize import (
    match_key,
    normalize_author,
    normalize_isbn_pair,
    normalize_text,
    normalize_title,
    validate_isbn10,
    validate_isbn13,
)

# Below this, listing goes to admin review instead of auto-attach.
DEFAULT_AUTO_ATTACH_THRESHOLD = 0.88


@dataclass(frozen=True)
class CatalogBook:
    id: str
    title: str | None = None
    author: str | None = None
    isbn_10: str | None = None
    isbn_13: str | None = None
    publisher: str | None = None
    edition: str | None = None
    format: str | None = None


@dataclass(frozen=True)
class MatchResult:
    book_id: str | None
    confidence: float
    method: str
    needs_review: bool
    reason: str


def _formats_compatible(a: str | None, b: str | None) -> bool:
    na, nb = normalize_text(a), normalize_text(b)
    if not na or not nb:
        return True
    audio = {"audiobook", "audio cd", "audio", "cd", "mp3"}
    printish = {"paperback", "hardcover", "hardback", "trade paperback", "mass market", "board book"}
    a_audio = any(x in na for x in audio)
    b_audio = any(x in nb for x in audio)
    if a_audio != b_audio and (a_audio or b_audio):
        return False
    if na == nb:
        return True
    if na in printish and nb in printish and na != nb:
        # Different print formats — do not auto-merge.
        return False
    return True


def score_listing_against_book(listing: dict[str, Any], book: CatalogBook) -> MatchResult:
    """Priority: ISBN-13 → ISBN-10 → normalized key → fuzzy (review)."""
    l10, l13 = normalize_isbn_pair(listing.get("isbn_13") or listing.get("isbn_10") or listing.get("isbn"))
    if listing.get("isbn_13"):
        l13 = validate_isbn13(str(listing["isbn_13"])) or l13
    if listing.get("isbn_10"):
        l10 = validate_isbn10(str(listing["isbn_10"])) or l10

    b10 = validate_isbn10(book.isbn_10) if book.isbn_10 else None
    b13 = validate_isbn13(book.isbn_13) if book.isbn_13 else None
    if not b13 and b10:
        from .normalize import isbn10_to_isbn13

        b13 = isbn10_to_isbn13(b10)
    if not b10 and b13:
        from .normalize import isbn13_to_isbn10

        b10 = isbn13_to_isbn10(b13)

    if l13 and b13 and l13 == b13:
        if not _formats_compatible(listing.get("format"), book.format):
            return MatchResult(None, 0.4, "isbn13_format_conflict", True, "isbn_match_format_conflict")
        return MatchResult(book.id, 1.0, "isbn13", False, "isbn13_exact")

    if l10 and b10 and l10 == b10:
        if not _formats_compatible(listing.get("format"), book.format):
            return MatchResult(None, 0.4, "isbn10_format_conflict", True, "isbn_match_format_conflict")
        return MatchResult(book.id, 0.99, "isbn10", False, "isbn10_exact")

    key_l = match_key(
        listing.get("title"),
        listing.get("author"),
        listing.get("publisher"),
        listing.get("edition"),
        listing.get("format"),
    )
    key_b = match_key(book.title, book.author, book.publisher, book.edition, book.format)
    if key_l and key_b and key_l == key_b:
        return MatchResult(book.id, 0.95, "normalized_key", False, "normalized_exact")

    # Soft key without edition/format — still high but review if formats differ.
    soft_l = match_key(listing.get("title"), listing.get("author"), listing.get("publisher"))
    soft_b = match_key(book.title, book.author, book.publisher)
    if soft_l and soft_b and soft_l == soft_b:
        if not _formats_compatible(listing.get("format"), book.format):
            return MatchResult(None, 0.5, "soft_key_format_conflict", True, "format_or_edition_differs")
        return MatchResult(book.id, 0.9, "soft_normalized_key", False, "title_author_publisher")

    nt = normalize_title(listing.get("title"))
    na = normalize_author(listing.get("author"))
    bt = normalize_title(book.title)
    ba = normalize_author(book.author)
    if not nt or not bt:
        return MatchResult(None, 0.0, "none", True, "insufficient_fields")

    title_ratio = SequenceMatcher(None, nt, bt).ratio()
    author_ratio = SequenceMatcher(None, na or "", ba or "").ratio() if (na and ba) else 0.0
    conf = 0.65 * title_ratio + 0.35 * author_ratio
    if title_ratio < 0.86:
        return MatchResult(None, conf, "fuzzy", True, "title_too_different")
    if na and ba and author_ratio < 0.8:
        return MatchResult(None, conf, "fuzzy", True, "author_too_different")
    if not _formats_compatible(listing.get("format"), book.format):
        return MatchResult(None, conf * 0.5, "fuzzy_format_conflict", True, "format_conflict")
    needs = conf < DEFAULT_AUTO_ATTACH_THRESHOLD
    return MatchResult(
        book.id if not needs else None,
        round(conf, 4),
        "fuzzy",
        needs,
        "fuzzy_candidate" if needs else "fuzzy_auto",
    )


def best_match(
    listing: dict[str, Any],
    books: Iterable[CatalogBook],
    *,
    threshold: float = DEFAULT_AUTO_ATTACH_THRESHOLD,
) -> MatchResult:
    best: MatchResult | None = None
    for book in books:
        result = score_listing_against_book(listing, book)
        if best is None or result.confidence > best.confidence:
            best = result
    if best is None:
        return MatchResult(None, 0.0, "none", True, "no_candidates")
    if best.book_id and best.confidence >= threshold and not best.needs_review:
        return best
    # Force review queue when below threshold.
    if best.confidence > 0 and (best.needs_review or best.confidence < threshold):
        return MatchResult(
            None,
            best.confidence,
            best.method,
            True,
            best.reason if best.needs_review else "below_threshold",
        )
    return best
