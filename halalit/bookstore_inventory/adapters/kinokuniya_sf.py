"""Kinokuniya USA — online ordering product pages (SF favorite location)."""
from __future__ import annotations

import logging
from typing import Any

from ..http_client import DEFAULT_UA, fetch_url
from ..jsonld import listings_from_html
from ..robots import assert_allowed
from ..security import parse_allowed_url
from .base import BookstoreAdapter
from .registry import register_adapter

logger = logging.getLogger("halalit.bookstore.kinokuniya")


@register_adapter
class KinokuniyaSfAdapter(BookstoreAdapter):
    store_id = "kinokuniya_sf"

    async def search_inventory(self, query: str) -> list[dict[str, Any]]:
        logger.info("Kinokuniya search skipped — no permitted catalog crawl")
        return []

    async def scrape_inventory(self) -> list[dict[str, Any]]:
        logger.info("Kinokuniya full scrape skipped — ISBN product checks only")
        return []

    async def check_listing(self, product_url: str) -> dict[str, Any] | None:
        if not self.enabled and not self.config.get("allow_isbn_check_when_disabled"):
            return None
        ua = DEFAULT_UA
        url = parse_allowed_url(product_url, self.approved_domains)
        assert_allowed(
            self.website,
            url,
            approved_domains=self.approved_domains,
            user_agent=ua,
            min_interval=self.request_delay,
        )
        resp = fetch_url(
            url,
            approved_domains=self.approved_domains,
            min_interval=self.request_delay,
            user_agent=ua,
        )
        if resp.status == 404:
            return {
                "store_id": self.store_id,
                "availability": "unavailable",
                "product_url": url,
                "source_identifier": f"url:{url}",
                "raw_source_data": {"status": 404},
            }
        if resp.status in (401, 403):
            raise RuntimeError(f"http_{resp.status}_bot_block")
        if resp.status != 200:
            raise RuntimeError(f"http_{resp.status}")
        listings = listings_from_html(
            resp.body.decode("utf-8", errors="replace"),
            store_id=self.store_id,
        )
        if not listings:
            # Kinokuniya pages may lack JSON-LD; treat as unverified (caller hides).
            return {
                "store_id": self.store_id,
                "product_url": resp.url,
                "source_identifier": f"url:{resp.url}",
                "availability": None,
                "raw_source_data": {"parse": "no_ld_json", "hint": "possible_layout_change"},
            }
        best = listings[0]
        best["product_url"] = best.get("product_url") or resp.url
        # Partly tier: product availability means orderable online, not SF shelf.
        if best.get("availability") in ("in_stock", "available", "limited", "preorder"):
            best["availability"] = "orderable"
            best["stock_scope"] = "online_ordering"
        return best
