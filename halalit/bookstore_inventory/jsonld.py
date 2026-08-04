"""Parse JSON-LD / Offer nodes into normalized listing dicts."""
from __future__ import annotations

import json
import re
from typing import Any

from .normalize import normalize_author, normalize_isbn_pair, normalize_title, safe_float
from .security import sanitize_public_text

_LD_RE = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.I | re.S,
)


def extract_ld_json_blocks(html: str) -> list[Any]:
    out: list[Any] = []
    for raw in _LD_RE.findall(html or ""):
        text = raw.strip()
        if not text:
            continue
        try:
            out.append(json.loads(text))
        except json.JSONDecodeError:
            continue
    return out


def _walk(node: Any, acc: list[dict[str, Any]]) -> None:
    if isinstance(node, dict):
        acc.append(node)
        for v in node.values():
            _walk(v, acc)
    elif isinstance(node, list):
        for item in node:
            _walk(item, acc)


def _availability_from_schema(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value)
    low = s.lower()
    if "instock" in low or low.endswith("/instock"):
        return "in_stock"
    if "outofstock" in low or "soldout" in low:
        return "out_of_stock"
    if "preorder" in low:
        return "preorder"
    if "limitedavailability" in low:
        return "limited"
    if "discontinued" in low:
        return "unavailable"
    return sanitize_public_text(s.split("/")[-1], 40)


def _condition_from_schema(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value).lower()
    if "newcondition" in s or s.endswith("/new"):
        return "new"
    if "usedcondition" in s or "used" in s:
        return "used"
    return sanitize_public_text(str(value).split("/")[-1], 40)


def _format_from_schema(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value)
    if "/" in s:
        s = s.rsplit("/", 1)[-1]
    return sanitize_public_text(s, 60)


def _author_name(node: dict[str, Any]) -> str | None:
    author = node.get("author")
    if isinstance(author, dict):
        return sanitize_public_text(author.get("name"), 200)
    if isinstance(author, list) and author:
        return _author_name({"author": author[0]})
    if isinstance(author, str):
        return sanitize_public_text(author, 200)
    return None


def listing_from_book_node(node: dict[str, Any], *, store_id: str) -> dict[str, Any] | None:
    types = node.get("@type")
    type_list = types if isinstance(types, list) else [types]
    type_list = [str(t) for t in type_list if t]
    if not any(t in ("Book", "Product", "ProductGroup") for t in type_list):
        # Offer nested under workExample
        pass

    title = sanitize_public_text(node.get("name") or node.get("headline"), 300)
    url = sanitize_public_text(node.get("url"), 2000)
    isbn_raw = node.get("isbn") or node.get("gtin13") or node.get("sku")
    image = node.get("image")
    if isinstance(image, dict):
        image = image.get("url")
    if isinstance(image, list) and image:
        image = image[0] if isinstance(image[0], str) else (image[0] or {}).get("url")

    offer = None
    work = node.get("workExample")
    if isinstance(work, dict):
        isbn_raw = isbn_raw or work.get("isbn") or work.get("gtin13")
        url = url or sanitize_public_text(work.get("url"), 2000)
        action = work.get("potentialAction") if isinstance(work.get("potentialAction"), dict) else None
        if action and isinstance(action.get("expectsAcceptanceOf"), dict):
            offer = action["expectsAcceptanceOf"]
        if not offer and isinstance(work.get("offers"), dict):
            offer = work["offers"]
    if offer is None and isinstance(node.get("offers"), dict):
        offer = node["offers"]
    if offer is None and isinstance(node.get("offers"), list) and node["offers"]:
        offer = node["offers"][0] if isinstance(node["offers"][0], dict) else None

    # ProductGroup variants
    if not title and not isbn_raw and "hasVariant" in node:
        return None

    price = None
    currency = None
    availability = None
    condition = None
    if isinstance(offer, dict):
        price = safe_float(offer.get("price") or offer.get("lowPrice"))
        currency = sanitize_public_text(offer.get("priceCurrency"), 8)
        availability = _availability_from_schema(offer.get("availability"))
        condition = _condition_from_schema(offer.get("itemCondition"))
        url = url or sanitize_public_text(offer.get("url"), 2000)

    isbn10, isbn13 = normalize_isbn_pair(str(isbn_raw) if isbn_raw else None)
    if not title and not isbn13 and not isbn10:
        return None

    fmt = _format_from_schema(node.get("bookFormat") or node.get("encodingFormat"))
    author = _author_name(node)
    source_id = isbn13 or isbn10 or url or title
    return {
        "store_id": store_id,
        "title": title,
        "normalized_title": normalize_title(title),
        "author": author,
        "normalized_author": normalize_author(author),
        "isbn_10": isbn10,
        "isbn_13": isbn13,
        "publisher": sanitize_public_text(node.get("publisher") if isinstance(node.get("publisher"), str) else None, 200),
        "publication_date": sanitize_public_text(node.get("datePublished"), 40),
        "edition": sanitize_public_text(node.get("bookEdition"), 80),
        "format": fmt,
        "language": sanitize_public_text(node.get("inLanguage"), 40),
        "condition": condition,
        "price": price,
        "currency": currency or ("USD" if price is not None else None),
        "availability": availability,
        "inventory_quantity": None,
        "product_url": url,
        "image_url": sanitize_public_text(image, 2000) if isinstance(image, str) else None,
        "source_identifier": f"isbn:{isbn13 or isbn10}" if (isbn13 or isbn10) else f"url:{url}",
        "raw_source_data": {"ld_type": type_list, "name": title, "isbn": isbn13 or isbn10},
    }


def listings_from_html(html: str, *, store_id: str) -> list[dict[str, Any]]:
    blocks = extract_ld_json_blocks(html)
    nodes: list[dict[str, Any]] = []
    for block in blocks:
        _walk(block, nodes)

    listings: list[dict[str, Any]] = []
    seen: set[str] = set()

    # Prefer concrete Product / Book with offers; also expand ProductGroup variants.
    for node in nodes:
        types = node.get("@type")
        tlist = [str(x) for x in (types if isinstance(types, list) else [types]) if x]
        if "ProductGroup" in tlist and isinstance(node.get("hasVariant"), list):
            for variant in node["hasVariant"]:
                if isinstance(variant, dict):
                    item = listing_from_book_node(variant, store_id=store_id)
                    if item and item["source_identifier"] not in seen:
                        seen.add(item["source_identifier"])
                        listings.append(item)
            continue
        if any(t in ("Book", "Product") for t in tlist):
            item = listing_from_book_node(node, store_id=store_id)
            if item and item["source_identifier"] not in seen:
                seen.add(item["source_identifier"])
                listings.append(item)
    return listings


def listings_from_ld_document(doc: Any, *, store_id: str) -> list[dict[str, Any]]:
    """Parse a saved JSON-LD document (fixture) into listings."""
    return listings_from_html(
        f'<script type="application/ld+json">{json.dumps(doc)}</script>',
        store_id=store_id,
    )
