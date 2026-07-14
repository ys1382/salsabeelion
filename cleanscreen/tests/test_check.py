#!/usr/bin/env python3
from __future__ import annotations

import unittest

from cleanscreen_api import check_url


class CleanScreenCheckTests(unittest.TestCase):
    def test_requires_url(self) -> None:
        result = check_url("")
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "url_required")

    def test_requires_http_url(self) -> None:
        result = check_url("ftp://example.com/x")
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "url_must_be_http")

    def test_blocks_unvetted_youtube(self) -> None:
        result = check_url(
            "https://www.youtube.com/watch?v=abc",
            title="How to knit",
            snippet="A calm knitting tutorial.",
        )
        self.assertTrue(result["ok"])
        self.assertFalse(result["allow"])
        self.assertEqual(result["reason"], "video_heavy")

    def test_allows_vetted_site(self) -> None:
        result = check_url(
            "https://www.khanacademy.org/science/biology",
            title="Biology lessons",
            snippet="Free school lessons.",
        )
        self.assertTrue(result["ok"])
        self.assertTrue(result["allow"])

    def test_kidshealth_parent_only_until_survey(self) -> None:
        result = check_url(
            "https://kidshealth.org/en/kids/",
            title="KidsHealth",
            snippet="Health information for families.",
            parent_mode=False,
        )
        self.assertTrue(result["ok"])
        self.assertFalse(result["allow"])
        self.assertEqual(result["reason"], "parent_only_site")

    def test_parent_mode_flag_echoed(self) -> None:
        result = check_url(
            "https://www.amazon.com/dp/example",
            title="Yarn sale",
            snippet="Shop craft supplies.",
            parent_mode=True,
        )
        self.assertTrue(result["ok"])
        self.assertTrue(result["parentMode"])


if __name__ == "__main__":
    unittest.main()
