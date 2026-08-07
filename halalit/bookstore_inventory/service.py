"""Bookstore inventory service — seed, upsert, match, public views."""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any

from .adapters import get_adapter, list_configured_store_ids, load_store_config
from .freshness import FreshnessRules, freshness_status
from .matching import CatalogBook, best_match
from .models import connect, init_schema, row_to_dict, upsert_location, upsert_store
from .normalize import normalize_author, normalize_isbn_pair, normalize_title, safe_float
from .security import sanitize_public_text

logger = logging.getLogger("halalit.bookstore.service")


def seed_stores_from_config(conn=None) -> list[str]:
    own = conn is None
    conn = conn or connect()
    try:
        init_schema(conn)
        seeded = []
        for store_id in list_configured_store_ids():
            cfg = load_store_config(store_id)
            upsert_store(
                conn,
                {
                    "store_id": cfg["store_id"],
                    "name": cfg.get("name") or store_id,
                    "website": cfg.get("website"),
                    "inventory_source": cfg.get("inventory_source"),
                    "online_ordering": cfg.get("online_ordering", True),
                    "active": cfg.get("active", True),
                    "paused": cfg.get("paused", False),
                    "needs_repair": cfg.get("needs_repair", False),
                    "refresh_frequency_minutes": cfg.get("refresh_frequency_minutes", 360),
                    "stale_threshold_hours": cfg.get("stale_threshold_hours", 168),
                    "request_delay_seconds": cfg.get("request_delay_seconds", 10),
                    "approved_domains": cfg.get("approved_domains") or [],
                    "config": cfg,
                },
            )
            for loc in cfg.get("locations") or []:
                upsert_location(
                    conn,
                    {
                        "store_id": cfg["store_id"],
                        "location_id": loc.get("location_id") or "main",
                        **loc,
                    },
                )
            seeded.append(store_id)
        conn.commit()
        return seeded
    finally:
        if own:
            conn.close()


def ensure_catalog_book(
    conn,
    *,
    title: str | None,
    author: str | None = None,
    isbn: str | None = None,
    fmt: str | None = None,
    publisher: str | None = None,
) -> str:
    isbn10, isbn13 = normalize_isbn_pair(isbn)
    if isbn13:
        row = conn.execute(
            "SELECT id FROM bookstore_catalog_books WHERE isbn_13 = ?",
            (isbn13,),
        ).fetchone()
        if row:
            return row["id"]
    nt, na = normalize_title(title), normalize_author(author)
    if nt and na:
        row = conn.execute(
            """
            SELECT id FROM bookstore_catalog_books
            WHERE normalized_title = ? AND normalized_author = ?
            LIMIT 1
            """,
            (nt, na),
        ).fetchone()
        if row:
            return row["id"]
    book_id = str(uuid.uuid4())
    now = time.time()
    conn.execute(
        """
        INSERT INTO bookstore_catalog_books(
          id, title, normalized_title, author, normalized_author,
          isbn_10, isbn_13, publisher, format, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            book_id,
            sanitize_public_text(title, 300),
            nt,
            sanitize_public_text(author, 200),
            na,
            isbn10,
            isbn13,
            sanitize_public_text(publisher, 200),
            sanitize_public_text(fmt, 60),
            now,
            now,
        ),
    )
    return book_id


def _catalog_books(conn) -> list[CatalogBook]:
    rows = conn.execute("SELECT * FROM bookstore_catalog_books").fetchall()
    return [
        CatalogBook(
            id=r["id"],
            title=r["title"],
            author=r["author"],
            isbn_10=r["isbn_10"],
            isbn_13=r["isbn_13"],
            publisher=r["publisher"],
            edition=r["edition"],
            format=r["format"],
        )
        for r in rows
    ]


def upsert_listing(conn, listing: dict[str, Any], *, run_match: bool = True) -> int:
    now = time.time()
    isbn10, isbn13 = normalize_isbn_pair(
        listing.get("isbn_13") or listing.get("isbn_10") or listing.get("isbn")
    )
    if listing.get("isbn_13"):
        _, isbn13 = normalize_isbn_pair(str(listing["isbn_13"]))
    if listing.get("isbn_10"):
        isbn10, _ = normalize_isbn_pair(str(listing["isbn_10"]))
    title = sanitize_public_text(listing.get("title"), 300)
    author = sanitize_public_text(listing.get("author"), 200)
    source_id = sanitize_public_text(listing.get("source_identifier"), 300) or f"anon:{uuid.uuid4()}"
    store_id = str(listing["store_id"])
    price = safe_float(listing.get("price"))
    raw = listing.get("raw_source_data")
    raw_json = json.dumps(raw)[:20_000] if raw is not None else None

    existing = conn.execute(
        "SELECT id, first_seen_at, consecutive_misses FROM bookstore_listings WHERE store_id = ? AND source_identifier = ?",
        (store_id, source_id),
    ).fetchone()

    catalog_book_id = listing.get("catalog_book_id")
    match_confidence = listing.get("match_confidence")
    needs_review = False
    review_meta = None

    if run_match and not catalog_book_id:
        result = best_match(listing, _catalog_books(conn))
        match_confidence = result.confidence
        if result.book_id and not result.needs_review:
            catalog_book_id = result.book_id
        elif result.needs_review and result.confidence > 0:
            needs_review = True
            review_meta = result

    if existing:
        listing_id = int(existing["id"])
        conn.execute(
            """
            UPDATE bookstore_listings SET
              store_location_id=?, catalog_book_id=COALESCE(?, catalog_book_id),
              title=?, normalized_title=?, author=?, normalized_author=?,
              isbn_10=?, isbn_13=?, publisher=?, publication_date=?, edition=?,
              format=?, language=?, condition=?, price=?, currency=?, availability=?,
              inventory_quantity=?, product_url=?, image_url=?, match_confidence=?,
              last_seen_at=?, last_checked_at=?, is_stale=0, consecutive_misses=0,
              raw_source_data=COALESCE(?, raw_source_data)
            WHERE id=?
            """,
            (
                listing.get("store_location_id"),
                catalog_book_id,
                title,
                normalize_title(title),
                author,
                normalize_author(author),
                isbn10,
                isbn13,
                sanitize_public_text(listing.get("publisher"), 200),
                sanitize_public_text(listing.get("publication_date"), 40),
                sanitize_public_text(listing.get("edition"), 80),
                sanitize_public_text(listing.get("format"), 60),
                sanitize_public_text(listing.get("language"), 40),
                sanitize_public_text(listing.get("condition"), 40),
                price,
                sanitize_public_text(listing.get("currency"), 8),
                sanitize_public_text(listing.get("availability"), 40),
                listing.get("inventory_quantity"),
                sanitize_public_text(listing.get("product_url"), 2000),
                sanitize_public_text(listing.get("image_url"), 2000),
                match_confidence,
                now,
                now,
                raw_json,
                listing_id,
            ),
        )
    else:
        cur = conn.execute(
            """
            INSERT INTO bookstore_listings(
              store_id, store_location_id, catalog_book_id, title, normalized_title,
              author, normalized_author, isbn_10, isbn_13, publisher, publication_date,
              edition, format, language, condition, price, currency, availability,
              inventory_quantity, product_url, image_url, source_identifier, match_confidence,
              first_seen_at, last_seen_at, last_checked_at, is_stale, consecutive_misses, raw_source_data
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,?)
            """,
            (
                store_id,
                listing.get("store_location_id"),
                catalog_book_id,
                title,
                normalize_title(title),
                author,
                normalize_author(author),
                isbn10,
                isbn13,
                sanitize_public_text(listing.get("publisher"), 200),
                sanitize_public_text(listing.get("publication_date"), 40),
                sanitize_public_text(listing.get("edition"), 80),
                sanitize_public_text(listing.get("format"), 60),
                sanitize_public_text(listing.get("language"), 40),
                sanitize_public_text(listing.get("condition"), 40),
                price,
                sanitize_public_text(listing.get("currency"), 8),
                sanitize_public_text(listing.get("availability"), 40),
                listing.get("inventory_quantity"),
                sanitize_public_text(listing.get("product_url"), 2000),
                sanitize_public_text(listing.get("image_url"), 2000),
                source_id,
                match_confidence,
                now,
                now,
                now,
                raw_json,
            ),
        )
        listing_id = int(cur.lastrowid)

    if needs_review and review_meta:
        conn.execute(
            """
            INSERT INTO bookstore_match_review(
              listing_id, candidate_book_id, confidence, method, reason, status, created_at
            ) VALUES (?,?,?,?,?,'pending',?)
            """,
            (
                listing_id,
                review_meta.book_id,
                review_meta.confidence,
                review_meta.method,
                review_meta.reason,
                now,
            ),
        )
    return listing_id


def mark_missing_listings(conn, store_id: str, seen_source_ids: set[str]) -> int:
    """Increment miss counters for listings not seen in this refresh; stale after threshold."""
    rows = conn.execute(
        "SELECT id, consecutive_misses FROM bookstore_listings WHERE store_id = ? AND availability != 'unavailable'",
        (store_id,),
    ).fetchall()
    store = conn.execute(
        "SELECT stale_threshold_hours FROM bookstores WHERE store_id = ?",
        (store_id,),
    ).fetchone()
    # miss_before_unavailable default 3
    marked = 0
    now = time.time()
    for row in rows:
        src = conn.execute(
            "SELECT source_identifier FROM bookstore_listings WHERE id = ?",
            (row["id"],),
        ).fetchone()
        if src and src["source_identifier"] in seen_source_ids:
            continue
        misses = int(row["consecutive_misses"] or 0) + 1
        if misses >= 3:
            conn.execute(
                """
                UPDATE bookstore_listings
                SET consecutive_misses=?, availability='unavailable', is_stale=1, last_checked_at=?
                WHERE id=?
                """,
                (misses, now, row["id"]),
            )
        else:
            conn.execute(
                """
                UPDATE bookstore_listings
                SET consecutive_misses=?, is_stale=1, last_checked_at=?
                WHERE id=?
                """,
                (misses, now, row["id"]),
            )
        marked += 1
    _ = store  # reserved for per-store stale hours on age-based jobs
    return marked


def public_places(conn=None) -> list[dict[str, Any]]:
    """Flat list of specific bookstore locations (not generic chain-only rows)."""
    own = conn is None
    conn = conn or connect()
    try:
        init_schema(conn)
        seed_stores_from_config(conn)
        rows = conn.execute(
            """
            SELECT loc.*, s.name AS store_name, s.paused AS store_paused
            FROM bookstore_locations loc
            JOIN bookstores s ON s.store_id = loc.store_id
            WHERE loc.active = 1 AND s.active = 1
            ORDER BY loc.place_label COLLATE NOCASE, loc.location_name COLLATE NOCASE
            """
        ).fetchall()
        out = []
        for r in rows:
            try:
                extra = json.loads(r["extra_json"] or "{}")
            except (TypeError, json.JSONDecodeError):
                extra = {}
            place_id = r["place_id"] or f"{r['store_id']}-{r['location_id']}"
            label = r["place_label"] or f"{r['store_name']} — {r['location_name']}"
            tier = "unknown"
            try:
                tier = str(load_store_config(r["store_id"]).get("capability_tier") or "unknown")
            except Exception:
                tier = "unknown"
            out.append(
                {
                    "placeId": place_id,
                    "storeId": r["store_id"],
                    "locationId": r["location_id"],
                    "placeLabel": label,
                    "shortLabel": r["short_label"] or r["location_name"] or label,
                    "initials": r["initials"] or (r["store_name"] or "?")[:2].upper(),
                    "storeName": r["store_name"],
                    "locationName": r["location_name"],
                    "streetAddress": r["street_address"],
                    "city": r["city"],
                    "state": r["state"],
                    "postalCode": r["postal_code"],
                    "county": r["county"],
                    "phone": r["phone"],
                    "hours": r["hours"],
                    "website": r["website"],
                    "onlineOrdering": bool(r["online_ordering"]),
                    "favoriteDefault": bool(r["favorite_default"]),
                    "storePaused": bool(r["store_paused"]),
                    "bnStoreNumber": extra.get("bn_store_number") or extra.get("store_number"),
                    "capabilityTier": tier,
                }
            )
        for r in conn.execute(
            """
            SELECT * FROM bookstore_reader_places WHERE active=1
            ORDER BY place_label COLLATE NOCASE
            """
        ).fetchall():
            out.append(
                {
                    "placeId": r["place_id"],
                    "storeId": r["store_id"],
                    "locationId": None,
                    "placeLabel": r["place_label"],
                    "shortLabel": r["short_label"] or r["location_name"],
                    "initials": (r["short_label"] or r["location_name"] or "BK")[:2].upper(),
                    "storeName": None,
                    "locationName": r["location_name"],
                    "streetAddress": r["street_address"],
                    "city": r["city"],
                    "state": r["state"],
                    "postalCode": r["postal_code"],
                    "county": r["county"],
                    "phone": r["phone"],
                    "hours": None,
                    "website": r["website"],
                    "onlineOrdering": True,
                    "favoriteDefault": False,
                    "storePaused": False,
                    "readerAdded": True,
                }
            )
        return out
    finally:
        if own:
            conn.close()


def add_reader_place(
    *,
    label: str,
    website: str | None = None,
    street_address: str | None = None,
    city: str | None = None,
    state: str | None = None,
    postal_code: str | None = None,
    county: str | None = None,
    store_id: str | None = None,
    user_id: int | None = None,
) -> dict[str, Any]:
    """Reader-saved specific bookstore location (link-out; no scrape of submitted URLs)."""
    label = sanitize_public_text(label, 200)
    if not label:
        return {"ok": False, "error": "label_required"}
    website = sanitize_public_text(website, 500)
    if website and not (website.startswith("http://") or website.startswith("https://")):
        return {"ok": False, "error": "website_must_be_http"}
    conn = connect()
    try:
        init_schema(conn)
        slug = normalize_title(label) or "place"
        slug = (slug or "place").replace(" ", "-")[:60]
        place_id = f"reader-{slug}-{int(time.time()) % 100000}"
        conn.execute(
            """
            INSERT INTO bookstore_reader_places(
              place_id, store_id, location_name, place_label, short_label,
              street_address, city, state, postal_code, county, website,
              created_by_user_id, active, created_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?)
            """,
            (
                place_id,
                sanitize_public_text(store_id, 80),
                label,
                label,
                label[:40],
                sanitize_public_text(street_address, 200),
                sanitize_public_text(city, 80),
                sanitize_public_text(state, 40),
                sanitize_public_text(postal_code, 20),
                sanitize_public_text(county, 80),
                website,
                user_id,
                time.time(),
            ),
        )
        conn.commit()
        return {"ok": True, "placeId": place_id, "placeLabel": label}
    finally:
        conn.close()


def _location_rows_for_place_ids(conn, place_ids: list[str]) -> list[Any]:
    if not place_ids:
        return []
    qmarks = ",".join("?" * len(place_ids))
    return conn.execute(
        f"""
        SELECT loc.*, s.name AS store_name, s.website AS store_website
        FROM bookstore_locations loc
        JOIN bookstores s ON s.store_id = loc.store_id
        WHERE loc.active=1 AND s.active=1 AND loc.place_id IN ({qmarks})
        """,
        place_ids,
    ).fetchall()


_HIT_AVAIL = frozenset(
    {"in_stock", "available", "limited", "preorder", "orderable"}
)


def _store_cfg(store_id: str) -> dict[str, Any]:
    try:
        return load_store_config(store_id)
    except Exception:
        return {}


def _public_claim_for_listing(
    store_id: str, listing: Any | None
) -> dict[str, Any] | None:
    """
    Map a listing to an honest public claim, or None to hide the card.

    - in_stock_here: product page listed in stock at that shop
    - order_online: can get it through the store's online ordering
    Hide misses, verification failures, and unclear availability.
    """
    if listing is None:
        return None
    avail = str(listing["availability"] or "").strip().lower()
    if avail not in _HIT_AVAIL:
        return None
    cfg = _store_cfg(store_id)
    tier = str(cfg.get("capability_tier") or "unknown")
    if tier == "in_stock_here":
        headline = cfg.get("claim_headline_in_stock") or "Listed in stock at this shop"
        return {
            "claim_kind": "in_stock_here",
            "claim_headline": headline,
            "cta_primary": cfg.get("claim_cta") or "Open product page",
            "capability_tier": tier,
        }
    if tier == "order_online":
        headline = cfg.get("claim_headline_orderable") or "Available through online ordering"
        return {
            "claim_kind": "order_online",
            "claim_headline": headline,
            "cta_primary": cfg.get("claim_cta") or "Order online",
            "capability_tier": tier,
        }
    # Unknown tier: only show if clearly in stock, with cautious copy
    if avail in ("in_stock", "available", "limited", "preorder"):
        return {
            "claim_kind": "in_stock_here",
            "claim_headline": "Listed on this store’s product page",
            "cta_primary": "Open product page",
            "capability_tier": tier,
        }
    return None


def live_check_isbn_for_places(
    isbn: str,
    *,
    place_ids: list[str] | None = None,
    title: str | None = None,
    author: str | None = None,
) -> dict[str, Any]:
    """
    Live ISBN product-page “shelf check” for enabled stores.

    Not a full catalog crawl — robots block /search and /books/.
    Checks each store’s ISBN product URL and upserts hits.
    """
    isbn10, isbn13 = normalize_isbn_pair(isbn)
    dig = isbn13 or isbn10
    if not dig:
        return {"ok": False, "error": "isbn_required", "checked": []}

    conn = connect()
    checked: list[dict[str, Any]] = []
    try:
        init_schema(conn)
        seed_stores_from_config(conn)
        ensure_catalog_book(conn, title=title, author=author, isbn=dig)
        conn.commit()

        wanted = [str(p).strip() for p in (place_ids or []) if str(p).strip()]
        if wanted:
            loc_rows = _location_rows_for_place_ids(conn, wanted)
            store_ids = sorted({r["store_id"] for r in loc_rows})
        else:
            store_ids = [
                r["store_id"]
                for r in conn.execute(
                    "SELECT store_id FROM bookstores WHERE active=1 AND paused=0"
                ).fetchall()
            ]

        for store_id in store_ids:
            if store_id in ("sample_fixture", "reader"):
                continue
            row = conn.execute(
                "SELECT paused, active FROM bookstores WHERE store_id=?",
                (store_id,),
            ).fetchone()
            if not row or not row["active"] or row["paused"]:
                checked.append({"store_id": store_id, "ok": False, "error": "paused_or_inactive"})
                continue
            cfg = _store_cfg(store_id)
            if not cfg.get("enabled", False):
                checked.append({"store_id": store_id, "ok": False, "error": "disabled"})
                continue
            try:
                adapter = get_adapter(store_id, cfg)
                item = asyncio.run(adapter.check_isbn(dig))
                if not item:
                    checked.append({"store_id": store_id, "ok": True, "hit": False})
                    continue
                item = dict(item)
                item["store_id"] = store_id
                # Keep the requested ISBN as the lookup key (product pages may
                # redirect to a related edition with a different ISBN in JSON-LD).
                if isbn13:
                    item["isbn_13"] = isbn13
                if isbn10:
                    item["isbn_10"] = isbn10
                # Attach first matching location when favorites are set
                if wanted:
                    for loc in loc_rows:
                        if loc["store_id"] == store_id:
                            item["store_location_id"] = loc["location_id"]
                            break
                avail = str(item.get("availability") or "").strip().lower()
                if avail in _HIT_AVAIL:
                    upsert_listing(conn, item)
                    checked.append(
                        {
                            "store_id": store_id,
                            "ok": True,
                            "hit": True,
                            "availability": avail,
                        }
                    )
                else:
                    checked.append(
                        {
                            "store_id": store_id,
                            "ok": True,
                            "hit": False,
                            "availability": avail or None,
                        }
                    )
            except Exception as e:
                logger.info("live ISBN check failed for %s: %s", store_id, e)
                _log_error(conn, store_id, type(e).__name__, str(e)[:500], None)
                checked.append(
                    {
                        "store_id": store_id,
                        "ok": False,
                        "error": type(e).__name__,
                        "message": str(e)[:200],
                    }
                )
        conn.commit()
        return {"ok": True, "isbn": dig, "checked": checked}
    finally:
        conn.close()


def public_listings_for_book(
    *,
    title: str | None = None,
    author: str | None = None,
    isbn: str | None = None,
    place_ids: list[str] | None = None,
    conn=None,
) -> dict[str, Any]:
    """
    Inventory for a book, keyed to specific bookstore locations.

    With place_ids (favorites), only those locations appear —
    e.g. B&N Stevens Creek, not a generic Barnes & Noble card.
    """
    own = conn is None
    conn = conn or connect()
    try:
        init_schema(conn)
        seed_stores_from_config(conn)
        isbn10, isbn13 = normalize_isbn_pair(isbn)
        nt, na = normalize_title(title), normalize_author(author)
        wanted = [str(p).strip() for p in (place_ids or []) if str(p).strip()]
        loc_rows = _location_rows_for_place_ids(conn, wanted) if wanted else []

        listing_rows = []
        if isbn13:
            listing_rows = conn.execute(
                """
                SELECT l.*, s.name AS store_name, s.website AS store_website
                FROM bookstore_listings l
                JOIN bookstores s ON s.store_id = l.store_id
                WHERE l.isbn_13 = ? AND s.active = 1
                ORDER BY l.last_checked_at DESC
                """,
                (isbn13,),
            ).fetchall()
        if not listing_rows and isbn10:
            listing_rows = conn.execute(
                """
                SELECT l.*, s.name AS store_name, s.website AS store_website
                FROM bookstore_listings l
                JOIN bookstores s ON s.store_id = l.store_id
                WHERE l.isbn_10 = ? AND s.active = 1
                ORDER BY l.last_checked_at DESC
                """,
                (isbn10,),
            ).fetchall()
        if not listing_rows and nt:
            sql = """
                SELECT l.*, s.name AS store_name, s.website AS store_website
                FROM bookstore_listings l
                JOIN bookstores s ON s.store_id = l.store_id
                WHERE l.normalized_title = ? AND s.active = 1
            """
            params: list[Any] = [nt]
            if na:
                sql += " AND (l.normalized_author = ? OR l.normalized_author IS NULL)"
                params.append(na)
            sql += " ORDER BY l.last_checked_at DESC"
            listing_rows = conn.execute(sql, params).fetchall()

        by_store: dict[str, list[Any]] = {}
        for r in listing_rows:
            by_store.setdefault(r["store_id"], []).append(r)

        listings: list[dict[str, Any]] = []

        def _append_for_location(loc: Any, listing: Any | None) -> None:
            claim = _public_claim_for_listing(loc["store_id"], listing)
            if claim is None:
                return
            place_id = loc["place_id"] if loc["place_id"] else f"{loc['store_id']}-{loc['location_id']}"
            place_label = loc["place_label"] or f"{loc['store_name']} — {loc['location_name']}"
            address_bits = [
                x for x in (loc["street_address"], loc["city"], loc["state"], loc["postal_code"]) if x
            ]
            address = ", ".join(address_bits) if address_bits else None
            fresh = freshness_status(
                listing["last_checked_at"] if listing else None,
                availability=(listing["availability"] if listing else None),
                consecutive_misses=int(listing["consecutive_misses"] or 0) if listing else 0,
                verification_failed=False,
            )
            product_url = listing["product_url"] if listing else None
            store_url = loc["website"] or loc["store_website"]
            county = None
            try:
                county = loc["county"]
            except (KeyError, IndexError):
                county = None
            kind = claim["claim_kind"]
            listings.append(
                {
                    "place_id": place_id,
                    "store_id": loc["store_id"],
                    "store_name": loc["store_name"],
                    "location_name": loc["location_name"],
                    "place_label": place_label,
                    "location": place_label,
                    "street_address": loc["street_address"],
                    "address": address,
                    "city": loc["city"],
                    "state": loc["state"],
                    "county": county,
                    "phone": loc["phone"],
                    "hours": loc["hours"],
                    "availability": listing["availability"] if listing else None,
                    "condition": listing["condition"] if listing else None,
                    "format": listing["format"] if listing else None,
                    "price": listing["price"] if listing else None,
                    "currency": listing["currency"] if listing else None,
                    "freshness": fresh,
                    "product_url": product_url,
                    "store_url": store_url,
                    "claim_kind": kind,
                    "claim_headline": claim["claim_headline"],
                    "cta_primary": claim["cta_primary"],
                    "capability_tier": claim["capability_tier"],
                    "online_or_instore": (
                        "online_ordering" if kind == "order_online" else "in_store"
                    ),
                    "stock_scope": (
                        "online_ordering"
                        if kind == "order_online"
                        else (
                            "location"
                            if listing and listing["store_location_id"] == loc["location_id"]
                            else "shop_product_page"
                        )
                    ),
                    "seller_note": (
                        f"Sold by {place_label} — Halalit does not sell or fulfill this book. "
                        + (
                            "Confirm with the shop before visiting."
                            if kind == "in_stock_here"
                            else "Online ordering — not a promise it’s on this store’s shelf."
                        )
                    ),
                }
            )

        if wanted:
            for loc in loc_rows:
                store_listings = by_store.get(loc["store_id"]) or []
                chosen = None
                for item in store_listings:
                    if item["store_location_id"] == loc["location_id"]:
                        chosen = item
                        break
                if chosen is None and store_listings:
                    chosen = store_listings[0]
                _append_for_location(loc, chosen)
            # Reader-added places: no automated scrape — do not invent availability cards.
        else:
            for store_id, items in by_store.items():
                locs = conn.execute(
                    """
                    SELECT loc.*, s.name AS store_name, s.website AS store_website
                    FROM bookstore_locations loc
                    JOIN bookstores s ON s.store_id = loc.store_id
                    WHERE loc.store_id=? AND loc.active=1
                    """,
                    (store_id,),
                ).fetchall()
                if not locs:
                    continue
                for item in items:
                    matched = [loc for loc in locs if loc["location_id"] == item["store_location_id"]]
                    targets = matched or locs
                    for loc in targets:
                        _append_for_location(loc, item)

        return {
            "ok": True,
            "listings": listings,
            "placesUsed": wanted,
            "empty_message": (
                None
                if listings
                else (
                    "None of your favorite bookstores showed this title as in stock or orderable. "
                    "Try opening the store’s product page, or pick another favorite."
                )
            ),
            "disclaimer": (
                "Results are for specific bookstore locations you chose — not a generic chain page. "
                "“In stock” means the shop’s product page listed it; "
                "“online ordering” is not a shelf promise. "
                "Confirm before visiting. Halalit does not process bookstore purchases."
            ),
        }
    finally:
        if own:
            conn.close()


def run_adapter_job(store_id: str, job_type: str = "isbn_watchlist") -> dict[str, Any]:
    """
    Run one store job. Failures are isolated per store.

    job_type:
      - scrape: full scrape when adapter/robots allow
      - isbn_watchlist: check catalog ISBNs via product URLs
      - fixture_refresh: sample store only
    """
    conn = connect()
    init_schema(conn)
    seed_stores_from_config(conn)
    started = time.time()
    run_id = None
    try:
        store_row = conn.execute(
            "SELECT * FROM bookstores WHERE store_id = ?",
            (store_id,),
        ).fetchone()
        if not store_row:
            return {"ok": False, "error": "unknown_store"}
        if store_row["paused"] and job_type != "fixture_refresh":
            return {"ok": False, "error": "store_paused"}

        cur = conn.execute(
            """
            INSERT INTO bookstore_scraper_runs(store_id, job_type, started_at)
            VALUES (?,?,?)
            """,
            (store_id, job_type, started),
        )
        run_id = int(cur.lastrowid)
        conn.execute(
            "UPDATE bookstores SET last_attempt_at = ? WHERE store_id = ?",
            (started, store_id),
        )
        conn.commit()

        adapter = get_adapter(store_id)
        listings: list[dict[str, Any]] = []
        if job_type in ("scrape", "fixture_refresh"):
            listings = asyncio.run(adapter.scrape_inventory())
        elif job_type == "isbn_watchlist":
            isbns = [
                r["isbn_13"]
                for r in conn.execute(
                    "SELECT DISTINCT isbn_13 FROM bookstore_catalog_books WHERE isbn_13 IS NOT NULL LIMIT 50"
                ).fetchall()
            ]
            for isbn in isbns:
                try:
                    item = asyncio.run(adapter.check_isbn(isbn))
                    if item:
                        listings.append(item)
                except Exception as e:
                    _log_error(conn, store_id, type(e).__name__, str(e)[:500], None)
        else:
            return {"ok": False, "error": "unknown_job_type"}

        seen: set[str] = set()
        new_count = 0
        for item in listings:
            item = dict(item)
            item["store_id"] = store_id
            before = conn.execute(
                "SELECT id FROM bookstore_listings WHERE store_id=? AND source_identifier=?",
                (store_id, item.get("source_identifier")),
            ).fetchone()
            upsert_listing(conn, item)
            sid = item.get("source_identifier")
            if sid:
                seen.add(str(sid))
            if not before:
                new_count += 1

        unavailable = 0
        if job_type in ("scrape", "fixture_refresh") and listings:
            unavailable = mark_missing_listings(conn, store_id, seen)

        finished = time.time()
        conn.execute(
            """
            UPDATE bookstore_scraper_runs SET
              finished_at=?, ok=1, listings_seen=?, listings_new=?, listings_unavailable=?
            WHERE id=?
            """,
            (finished, len(listings), new_count, unavailable, run_id),
        )
        conn.execute(
            "UPDATE bookstores SET last_success_at=?, last_error=NULL WHERE store_id=?",
            (finished, store_id),
        )
        conn.commit()
        return {
            "ok": True,
            "store_id": store_id,
            "job_type": job_type,
            "listings_seen": len(listings),
            "listings_new": new_count,
            "listings_unavailable": unavailable,
        }
    except Exception as e:
        logger.exception("store job failed: %s", store_id)
        _log_error(conn, store_id, type(e).__name__, str(e)[:500], None)
        if run_id:
            conn.execute(
                """
                UPDATE bookstore_scraper_runs SET finished_at=?, ok=0, error_summary=?
                WHERE id=?
                """,
                (time.time(), str(e)[:500], run_id),
            )
        conn.execute(
            "UPDATE bookstores SET last_error=? WHERE store_id=?",
            (str(e)[:500], store_id),
        )
        conn.commit()
        return {"ok": False, "store_id": store_id, "error": type(e).__name__, "message": str(e)[:300]}
    finally:
        conn.close()


def _log_error(conn, store_id: str, error_type: str, message: str, url: str | None) -> None:
    hint = None
    if "layout" in message.lower() or "no_ld_json" in message:
        hint = "possible_page_layout_change"
    if "robots" in message.lower():
        hint = "robots_or_permission_block"
    conn.execute(
        """
        INSERT INTO bookstore_scraper_errors(store_id, created_at, error_type, message, url, hint)
        VALUES (?,?,?,?,?,?)
        """,
        (store_id, time.time(), error_type, message, url, hint),
    )


def owner_dashboard(conn=None) -> dict[str, Any]:
    own = conn is None
    conn = conn or connect()
    try:
        init_schema(conn)
        seed_stores_from_config(conn)
        stores = []
        for row in conn.execute("SELECT * FROM bookstores ORDER BY name").fetchall():
            sid = row["store_id"]
            active = conn.execute(
                "SELECT COUNT(*) AS c FROM bookstore_listings WHERE store_id=? AND availability='in_stock'",
                (sid,),
            ).fetchone()["c"]
            stale = conn.execute(
                "SELECT COUNT(*) AS c FROM bookstore_listings WHERE store_id=? AND is_stale=1",
                (sid,),
            ).fetchone()["c"]
            unavailable = conn.execute(
                "SELECT COUNT(*) AS c FROM bookstore_listings WHERE store_id=? AND availability='unavailable'",
                (sid,),
            ).fetchone()["c"]
            pending = conn.execute(
                """
                SELECT COUNT(*) AS c FROM bookstore_match_review r
                JOIN bookstore_listings l ON l.id = r.listing_id
                WHERE l.store_id=? AND r.status='pending'
                """,
                (sid,),
            ).fetchone()["c"]
            errors = [
                row_to_dict(e)
                for e in conn.execute(
                    """
                    SELECT * FROM bookstore_scraper_errors
                    WHERE store_id=? ORDER BY created_at DESC LIMIT 5
                    """,
                    (sid,),
                ).fetchall()
            ]
            stores.append(
                {
                    **{k: row[k] for k in row.keys() if k != "config_json"},
                    "active_listings": active,
                    "stale_listings": stale,
                    "unavailable_listings": unavailable,
                    "match_review_pending": pending,
                    "recent_errors": errors,
                    "paused": bool(row["paused"]),
                    "needs_repair": bool(row["needs_repair"]),
                    "active": bool(row["active"]),
                }
            )
        reviews = [
            row_to_dict(r)
            for r in conn.execute(
                """
                SELECT r.*, l.title AS listing_title, l.author AS listing_author, l.store_id
                FROM bookstore_match_review r
                JOIN bookstore_listings l ON l.id = r.listing_id
                WHERE r.status='pending'
                ORDER BY r.created_at DESC LIMIT 50
                """
            ).fetchall()
        ]
        return {"ok": True, "stores": stores, "match_reviews": reviews}
    finally:
        if own:
            conn.close()


def set_store_flags(
    store_id: str,
    *,
    paused: bool | None = None,
    needs_repair: bool | None = None,
    active: bool | None = None,
    refresh_frequency_minutes: int | None = None,
) -> dict[str, Any]:
    conn = connect()
    try:
        init_schema(conn)
        row = conn.execute("SELECT store_id FROM bookstores WHERE store_id=?", (store_id,)).fetchone()
        if not row:
            return {"ok": False, "error": "unknown_store"}
        if paused is not None:
            conn.execute("UPDATE bookstores SET paused=?, updated_at=? WHERE store_id=?", (1 if paused else 0, time.time(), store_id))
        if needs_repair is not None:
            conn.execute("UPDATE bookstores SET needs_repair=?, updated_at=? WHERE store_id=?", (1 if needs_repair else 0, time.time(), store_id))
        if active is not None:
            conn.execute("UPDATE bookstores SET active=?, updated_at=? WHERE store_id=?", (1 if active else 0, time.time(), store_id))
        if refresh_frequency_minutes is not None:
            conn.execute(
                "UPDATE bookstores SET refresh_frequency_minutes=?, updated_at=? WHERE store_id=?",
                (int(refresh_frequency_minutes), time.time(), store_id),
            )
        conn.commit()
        return {"ok": True, "store_id": store_id}
    finally:
        conn.close()


def resolve_match_review(
    review_id: int,
    *,
    action: str,
    book_id: str | None = None,
    resolved_by: str = "owner",
) -> dict[str, Any]:
    conn = connect()
    try:
        init_schema(conn)
        row = conn.execute("SELECT * FROM bookstore_match_review WHERE id=?", (review_id,)).fetchone()
        if not row:
            return {"ok": False, "error": "not_found"}
        now = time.time()
        if action == "assign" and book_id:
            conn.execute(
                "UPDATE bookstore_listings SET catalog_book_id=?, match_confidence=1.0 WHERE id=?",
                (book_id, row["listing_id"]),
            )
            status = "assigned"
        elif action == "false_match":
            status = "false_match"
        else:
            return {"ok": False, "error": "invalid_action"}
        conn.execute(
            """
            UPDATE bookstore_match_review
            SET status=?, resolved_at=?, resolved_by=?
            WHERE id=?
            """,
            (status, now, resolved_by, review_id),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
