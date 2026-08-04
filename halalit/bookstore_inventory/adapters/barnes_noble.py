"""Barnes & Noble — product-page JSON-LD checks only (search disallowed by robots)."""
from __future__ import annotations

import logging
from typing import Any

from ..http_client import DEFAULT_UA, fetch_url
from ..jsonld import listings_from_html
from ..robots import assert_allowed
from ..security import parse_allowed_url
from .base import BookstoreAdapter
from .registry import register_adapter

logger = logging.getLogger("halalit.bookstore.bn")


@register_adapter
class BarnesNobleAdapter(BookstoreAdapter):
    store_id = "barnes_noble"

    async def search_inventory(self, query: str) -> list[dict[str, Any]]:
        # robots.txt Disallow: /search
        logger.info("B&N search skipped — robots disallow /search")
        return []

    async def scrape_inventory(self) -> list[dict[str, Any]]:
        # No official inventory feed wired; do not scrape catalog collections blindly.
        logger.info(
            "B&N full scrape skipped — prefer ISBN product checks or an official feed/API"
        )
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
        if resp.status != 200:
            raise RuntimeError(f"http_{resp.status}")
        listings = listings_from_html(
            resp.body.decode("utf-8", errors="replace"),
            store_id=self.store_id,
        )
        if not listings:
            return {
                "store_id": self.store_id,
                "product_url": resp.url,
                "source_identifier": f"url:{resp.url}",
                "raw_source_data": {"parse": "no_ld_json", "hint": "possible_layout_change"},
            }
        best = listings[0]
        best["product_url"] = best.get("product_url") or resp.url
        return best
