"""Abstract bookstore adapter."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BookstoreAdapter(ABC):
    store_id: str = ""

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self.config = dict(config or {})
        if self.config.get("store_id"):
            self.store_id = str(self.config["store_id"])

    @property
    def approved_domains(self) -> list[str]:
        return list(self.config.get("approved_domains") or [])

    @property
    def enabled(self) -> bool:
        return bool(self.config.get("enabled", False))

    @property
    def request_delay(self) -> float:
        return float(self.config.get("request_delay_seconds", 10))

    @property
    def website(self) -> str:
        return str(self.config.get("website") or "")

    @abstractmethod
    async def search_inventory(self, query: str) -> list[dict[str, Any]]:
        pass

    @abstractmethod
    async def scrape_inventory(self) -> list[dict[str, Any]]:
        pass

    @abstractmethod
    async def check_listing(self, product_url: str) -> dict[str, Any] | None:
        pass

    async def check_isbn(self, isbn: str) -> dict[str, Any] | None:
        template = self.config.get("isbn_product_url_template")
        if not template:
            return None
        url = str(template).format(isbn=isbn)
        return await self.check_listing(url)
