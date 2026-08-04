"""Fixture-based sample bookstore — no live network."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..jsonld import listings_from_html, listings_from_ld_document
from .base import BookstoreAdapter
from .registry import register_adapter

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"


@register_adapter
class SampleFixtureAdapter(BookstoreAdapter):
    store_id = "sample_fixture"

    def _load_search_fixture(self) -> list[dict[str, Any]]:
        path = FIXTURES / "sample_store_search.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return [dict(x, store_id=self.store_id) for x in data if isinstance(x, dict)]
        return listings_from_ld_document(data, store_id=self.store_id)

    def _load_product_fixture(self) -> dict[str, Any] | None:
        path = FIXTURES / "sample_store_product.html"
        if path.is_file():
            listings = listings_from_html(path.read_text(encoding="utf-8"), store_id=self.store_id)
            return listings[0] if listings else None
        ld_path = FIXTURES / "sample_store_product.json"
        listings = listings_from_ld_document(
            json.loads(ld_path.read_text(encoding="utf-8")),
            store_id=self.store_id,
        )
        return listings[0] if listings else None

    async def search_inventory(self, query: str) -> list[dict[str, Any]]:
        q = (query or "").strip().lower()
        items = self._load_search_fixture()
        if not q:
            return items
        out = []
        for item in items:
            blob = f"{item.get('title') or ''} {item.get('author') or ''} {item.get('isbn_13') or ''}".lower()
            if q in blob:
                out.append(item)
        return out

    async def scrape_inventory(self) -> list[dict[str, Any]]:
        return self._load_search_fixture()

    async def check_listing(self, product_url: str) -> dict[str, Any] | None:
        item = self._load_product_fixture()
        if not item:
            return None
        # Echo requested URL only when it looks like our fixture domain.
        if "sample-bookstore.local" in (product_url or ""):
            item = dict(item)
            item["product_url"] = product_url
        return item
