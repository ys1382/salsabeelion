"""Generic IndieCommerce adapter — ISBN product pages only (/book/{isbn})."""
from __future__ import annotations

from typing import Any

from .base import BookstoreAdapter
from .indiecommerce import catalog_scrape_blocked_by_robots, check_product_url
from .registry import register_adapter


@register_adapter
class IndieCommerceGenericAdapter(BookstoreAdapter):
    """Reusable for Book Passage, Booksmith, Copperfield's, etc."""

    store_id = "indiecommerce"

    async def search_inventory(self, query: str) -> list[dict[str, Any]]:
        return catalog_scrape_blocked_by_robots()

    async def scrape_inventory(self) -> list[dict[str, Any]]:
        # robots Disallow: /books/ and /search/ — no full shelf crawl
        return catalog_scrape_blocked_by_robots()

    async def check_listing(self, product_url: str) -> dict[str, Any] | None:
        if not self.enabled and not self.config.get("allow_isbn_check_when_disabled"):
            return None
        return await check_product_url(
            store_id=self.store_id,
            website=self.website,
            product_url=product_url,
            approved_domains=self.approved_domains,
            request_delay=self.request_delay,
        )
