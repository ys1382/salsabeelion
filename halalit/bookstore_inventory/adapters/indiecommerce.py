"""Shared helpers for IndieCommerce stores (Kepler's, Green Apple)."""
from __future__ import annotations

import logging
from typing import Any

from ..http_client import DEFAULT_UA, fetch_url
from ..jsonld import listings_from_html
from ..robots import assert_allowed
from ..security import parse_allowed_url

logger = logging.getLogger("halalit.bookstore.indiecommerce")


async def check_product_url(
    *,
    store_id: str,
    website: str,
    product_url: str,
    approved_domains: list[str],
    request_delay: float,
    user_agent: str | None = None,
) -> dict[str, Any] | None:
    ua = user_agent or DEFAULT_UA
    url = parse_allowed_url(product_url, approved_domains)
    assert_allowed(
        website,
        url,
        approved_domains=approved_domains,
        user_agent=ua,
        min_interval=request_delay,
    )
    resp = fetch_url(
        url,
        approved_domains=approved_domains,
        min_interval=request_delay,
        user_agent=ua,
    )
    if resp.status == 404:
        return {
            "store_id": store_id,
            "availability": "unavailable",
            "product_url": url,
            "source_identifier": f"url:{url}",
            "title": None,
            "raw_source_data": {"status": 404},
        }
    if resp.status != 200:
        raise RuntimeError(f"http_{resp.status}")
    html = resp.body.decode("utf-8", errors="replace")
    listings = listings_from_html(html, store_id=store_id)
    if not listings:
        return {
            "store_id": store_id,
            "availability": None,
            "product_url": resp.url,
            "source_identifier": f"url:{resp.url}",
            "title": None,
            "raw_source_data": {"parse": "no_ld_json", "hint": "possible_layout_change"},
        }
    best = listings[0]
    best["product_url"] = best.get("product_url") or resp.url
    return best


def catalog_scrape_blocked_by_robots() -> list[dict[str, Any]]:
    """
    IndieCommerce robots.txt Disallow: /books/ and /search/ (crawl-delay: 10).
    Full inventory scrape and search are not permitted without a store feed/API.
    """
    logger.info("catalog scrape/search skipped — robots disallow /books/ and /search/")
    return []
