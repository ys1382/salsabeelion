"""Tests for bookstore inventory (fixtures only — no live store hits)."""
from __future__ import annotations

import asyncio
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HALALIT = ROOT.parent
sys.path.insert(0, str(HALALIT))

from bookstore_inventory.adapters import get_adapter  # noqa: E402
from bookstore_inventory.freshness import freshness_status  # noqa: E402
from bookstore_inventory.jsonld import listings_from_html, listings_from_ld_document  # noqa: E402
from bookstore_inventory.matching import CatalogBook, best_match, score_listing_against_book  # noqa: E402
from bookstore_inventory.models import connect, init_schema  # noqa: E402
from bookstore_inventory.normalize import (  # noqa: E402
    normalize_author,
    normalize_isbn_pair,
    normalize_title,
    validate_isbn13,
)
from bookstore_inventory.security import SecurityError, parse_allowed_url, sanitize_public_text  # noqa: E402
from bookstore_inventory.service import (  # noqa: E402
    mark_missing_listings,
    public_listings_for_book,
    public_places,
    run_adapter_job,
    upsert_listing,
)


class NormalizeTests(unittest.TestCase):
    def test_isbn13_valid(self) -> None:
        self.assertEqual(validate_isbn13("9780064400558"), "9780064400558")
        self.assertIsNone(validate_isbn13("9780064400559"))

    def test_isbn_pair(self) -> None:
        i10, i13 = normalize_isbn_pair("9780064400558")
        self.assertEqual(i13, "9780064400558")
        self.assertEqual(i10, "0064400557")

    def test_title_author_norm(self) -> None:
        self.assertEqual(normalize_title("The Hobbit: There and Back Again"), "hobbit")
        self.assertEqual(normalize_author("White, E. B."), "e b white")


class MatchingTests(unittest.TestCase):
    def test_isbn_match(self) -> None:
        book = CatalogBook(id="b1", title="Charlotte's Web", author="E. B. White", isbn_13="9780064400558")
        listing = {"title": "Charlotte's Web", "isbn_13": "9780064400558", "format": "Paperback"}
        r = score_listing_against_book(listing, book)
        self.assertEqual(r.book_id, "b1")
        self.assertGreaterEqual(r.confidence, 0.99)

    def test_audiobook_not_merged_with_print(self) -> None:
        book = CatalogBook(id="b1", title="The Hobbit", author="Tolkien", isbn_13="9780547928227", format="Paperback")
        listing = {
            "title": "The Hobbit",
            "author": "Tolkien",
            "isbn_13": "9780007525492",
            "format": "Audiobook",
        }
        r = best_match(listing, [book])
        self.assertTrue(r.needs_review or r.book_id is None)


class FreshnessTests(unittest.TestCase):
    def test_recent(self) -> None:
        import time

        f = freshness_status(time.time(), availability="in_stock")
        self.assertEqual(f["status"], "recently_verified")
        self.assertIn("confirm", f["disclaimer"].lower())

    def test_unavailable_after_misses(self) -> None:
        f = freshness_status(None, availability="in_stock", consecutive_misses=3)
        self.assertEqual(f["status"], "unavailable")


class SecurityTests(unittest.TestCase):
    def test_domain_allowlist(self) -> None:
        u = parse_allowed_url("https://www.keplers.com/book/1", ["keplers.com"])
        self.assertTrue(u.startswith("https://"))
        with self.assertRaises(SecurityError):
            parse_allowed_url("https://evil.example/x", ["keplers.com"])
        with self.assertRaises(SecurityError):
            parse_allowed_url("http://127.0.0.1/x", ["127.0.0.1"])

    def test_sanitize(self) -> None:
        self.assertEqual(sanitize_public_text("<script>alert(1)</script>Hi"), "Hi")


class FixtureAdapterTests(unittest.TestCase):
    def test_sample_search_and_product(self) -> None:
        adapter = get_adapter("sample_fixture")
        items = asyncio.run(adapter.search_inventory("charlotte"))
        self.assertTrue(any(i.get("isbn_13") == "9780064400558" for i in items))
        product = asyncio.run(adapter.check_listing("https://sample-bookstore.local/book/9780064400558"))
        self.assertIsNotNone(product)
        self.assertEqual(product.get("availability"), "in_stock")

    def test_keplers_fixture_ld(self) -> None:
        path = ROOT / "fixtures" / "keplers_product_ld.json"
        doc = json.loads(path.read_text(encoding="utf-8"))
        listings = listings_from_ld_document(doc, store_id="keplers")
        self.assertTrue(listings)
        self.assertEqual(listings[0].get("isbn_13"), "9780064400558")

    def test_bn_fixture_ld(self) -> None:
        path = ROOT / "fixtures" / "barnes_noble_product_ld.json"
        doc = json.loads(path.read_text(encoding="utf-8"))
        listings = listings_from_ld_document(doc, store_id="barnes_noble")
        self.assertTrue(len(listings) >= 1)

    def test_html_product_fixture(self) -> None:
        html = (ROOT / "fixtures" / "sample_store_product.html").read_text(encoding="utf-8")
        listings = listings_from_html(html, store_id="sample_fixture")
        self.assertEqual(listings[0]["isbn_13"], "9780064400558")


class ServiceIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self.db = str(Path(self._tmpdir.name) / "test.sqlite")
        import bookstore_inventory.models as models
        import bookstore_inventory.service as service

        self._old = models.default_db_path
        models.default_db_path = lambda: self.db  # type: ignore
        service.default_db_path = models.default_db_path  # type: ignore
        # Patch connect callers via env
        import os

        os.environ["HALALIT_BOOKSTORE_DB"] = self.db

    def tearDown(self) -> None:
        self._tmpdir.cleanup()

    def test_place_specific_listings(self) -> None:
        run_adapter_job("sample_fixture", job_type="fixture_refresh")
        places = public_places()
        sample = [p for p in places if p["placeId"] == "sample-main-street"]
        self.assertTrue(sample)
        pub = public_listings_for_book(
            isbn="9780064400558",
            place_ids=["sample-main-street"],
        )
        self.assertTrue(pub["listings"])
        self.assertIn("Main Street", pub["listings"][0]["place_label"])
        # Unrelated favorite should not invent a B&N card from sample ISBN alone
        bn_only = public_listings_for_book(
            isbn="9780064400558",
            place_ids=["bn-stevens-creek"],
        )
        # May be empty or verification_failed card for B&N location with no listing
        for item in bn_only["listings"]:
            self.assertEqual(item["place_id"], "bn-stevens-creek")

    def test_stale_miss_handling(self) -> None:
        from bookstore_inventory.service import seed_stores_from_config

        conn = connect(self.db)
        init_schema(conn)
        seed_stores_from_config(conn)
        upsert_listing(
            conn,
            {
                "store_id": "sample_fixture",
                "title": "Gone Book",
                "source_identifier": "isbn:999",
                "isbn_13": None,
                "availability": "in_stock",
            },
            run_match=False,
        )
        n = mark_missing_listings(conn, "sample_fixture", set())
        self.assertGreaterEqual(n, 1)
        mark_missing_listings(conn, "sample_fixture", set())
        mark_missing_listings(conn, "sample_fixture", set())
        row = conn.execute(
            "SELECT availability, consecutive_misses FROM bookstore_listings WHERE source_identifier='isbn:999'"
        ).fetchone()
        self.assertEqual(row["availability"], "unavailable")
        conn.close()

    def test_robots_blocked_search_returns_empty(self) -> None:
        adapter = get_adapter("keplers")
        items = asyncio.run(adapter.search_inventory("hobbit"))
        self.assertEqual(items, [])


class PaginationPlaceholderTests(unittest.TestCase):
    """Pagination rules live in store config; fixture search has no pages."""

    def test_fixture_has_multiple_rows(self) -> None:
        adapter = get_adapter("sample_fixture")
        items = asyncio.run(adapter.scrape_inventory())
        self.assertGreaterEqual(len(items), 2)


if __name__ == "__main__":
    unittest.main()
