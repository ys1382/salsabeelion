"""HTTP handlers for bookstore inventory (wired from Halalit theme/accounts API)."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

_SERVER_DIR = Path(__file__).resolve().parent
_HALALIT_ROOT = _SERVER_DIR.parent
for _p in (_SERVER_DIR, _HALALIT_ROOT):
    if (_p / "bookstore_inventory").is_dir() and str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from bookstore_inventory.service import (  # noqa: E402
    add_reader_place,
    ensure_catalog_book,
    owner_dashboard,
    public_listings_for_book,
    public_places,
    resolve_match_review,
    run_adapter_job,
    seed_stores_from_config,
    set_store_flags,
)
from bookstore_inventory.models import connect, init_schema  # noqa: E402
from bookstore_inventory.security import sanitize_public_text  # noqa: E402


def handle_get(path: str, handler, json_response, session_user) -> bool:
    if path == "/api/bookstore/places":
        seed_stores_from_config()
        json_response(handler, 200, {"ok": True, "places": public_places()})
        return True

    if path.startswith("/api/bookstore/inventory"):
        from urllib.parse import parse_qs, urlparse

        qs = parse_qs(urlparse(handler.path).query)
        title = (qs.get("title") or [""])[0]
        author = (qs.get("author") or [""])[0]
        isbn = (qs.get("isbn") or [""])[0]
        place_ids = qs.get("placeId") or qs.get("placeIds") or []
        if len(place_ids) == 1 and "," in place_ids[0]:
            place_ids = [p.strip() for p in place_ids[0].split(",") if p.strip()]
        result = public_listings_for_book(
            title=title or None,
            author=author or None,
            isbn=isbn or None,
            place_ids=place_ids or None,
        )
        json_response(handler, 200, result)
        return True

    if path == "/api/owner/bookstore/dashboard":
        user = session_user(handler)
        if not user or not user.get("isOwner"):
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        json_response(handler, 200, owner_dashboard())
        return True

    return False


def handle_post(path: str, handler, body: dict[str, Any], json_response, session_user) -> bool:
    if path == "/api/bookstore/places/add":
        user = session_user(handler)
        result = add_reader_place(
            label=str(body.get("label") or body.get("name") or ""),
            website=body.get("website") or body.get("url"),
            street_address=body.get("streetAddress") or body.get("address"),
            city=body.get("city"),
            state=body.get("state"),
            postal_code=body.get("postalCode") or body.get("zip"),
            county=body.get("county"),
            store_id=body.get("storeId"),
            user_id=int(user["id"]) if user and user.get("id") else None,
        )
        code = 200 if result.get("ok") else 400
        json_response(handler, code, result)
        return True

    if path == "/api/bookstore/inventory":
        title = sanitize_public_text(body.get("title"), 300)
        author = sanitize_public_text(body.get("author"), 200)
        isbn = sanitize_public_text(body.get("isbn"), 32)
        raw_places = body.get("placeIds") or body.get("placeId") or []
        if isinstance(raw_places, str):
            place_ids = [p.strip() for p in raw_places.split(",") if p.strip()]
        elif isinstance(raw_places, list):
            place_ids = [str(p).strip() for p in raw_places if str(p).strip()]
        else:
            place_ids = []
        if title or isbn:
            conn = connect()
            try:
                init_schema(conn)
                ensure_catalog_book(conn, title=title, author=author, isbn=isbn)
                conn.commit()
            finally:
                conn.close()
        result = public_listings_for_book(
            title=title, author=author, isbn=isbn, place_ids=place_ids or None
        )
        if not result.get("listings"):
            try:
                run_adapter_job("sample_fixture", job_type="fixture_refresh")
                result = public_listings_for_book(
                    title=title, author=author, isbn=isbn, place_ids=place_ids or None
                )
            except Exception:
                pass
        if os.environ.get("HALALIT_BOOKSTORE_LIVE_CHECKS", "").strip() in ("1", "true", "yes"):
            if isbn:
                for store_id in ("barnes_noble", "keplers", "green_apple"):
                    try:
                        run_adapter_job(store_id, job_type="isbn_watchlist")
                    except Exception:
                        pass
                result = public_listings_for_book(
                    title=title, author=author, isbn=isbn, place_ids=place_ids or None
                )
        json_response(handler, 200, result)
        return True

    if path == "/api/owner/bookstore/run":
        user = session_user(handler)
        if not user or not user.get("isOwner"):
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        store_id = str(body.get("storeId") or body.get("store_id") or "").strip()
        job_type = str(body.get("jobType") or body.get("job_type") or "fixture_refresh").strip()
        if not store_id:
            json_response(handler, 400, {"ok": False, "error": "store_id_required"})
            return True
        if job_type not in ("scrape", "isbn_watchlist", "fixture_refresh"):
            json_response(handler, 400, {"ok": False, "error": "invalid_job_type"})
            return True
        json_response(handler, 200, run_adapter_job(store_id, job_type=job_type))
        return True

    if path == "/api/owner/bookstore/flags":
        user = session_user(handler)
        if not user or not user.get("isOwner"):
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        store_id = str(body.get("storeId") or body.get("store_id") or "").strip()
        json_response(
            handler,
            200,
            set_store_flags(
                store_id,
                paused=body.get("paused") if "paused" in body else None,
                needs_repair=body.get("needsRepair") if "needsRepair" in body else None,
                active=body.get("active") if "active" in body else None,
                refresh_frequency_minutes=body.get("refreshFrequencyMinutes"),
            ),
        )
        return True

    if path == "/api/owner/bookstore/match-review":
        user = session_user(handler)
        if not user or not user.get("isOwner"):
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        review_id = int(body.get("reviewId") or body.get("id") or 0)
        action = str(body.get("action") or "").strip()
        book_id = body.get("bookId") or body.get("book_id")
        json_response(
            handler,
            200,
            resolve_match_review(
                review_id,
                action=action,
                book_id=str(book_id) if book_id else None,
                resolved_by=str(user.get("email") or "owner"),
            ),
        )
        return True

    return False
