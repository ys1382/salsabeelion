#!/usr/bin/env python3
"""Quick checks for Bookcheck theme-scan helper fixes."""
from __future__ import annotations

import sys
import types
import unittest
from pathlib import Path

SERVER = Path(__file__).resolve().parent
sys.path.insert(0, str(SERVER))

# Stub server-only imports so helper logic can load without full API stack.
for mod_name in (
    "halalit_accounts",
    "halalit_lookup_log",
    "halalit_lookup_quality",
):
    stub = types.ModuleType(mod_name)
    if mod_name == "halalit_accounts":
        stub.handle_get = lambda *a, **k: None
        stub.handle_post = lambda *a, **k: None
        stub.log_scanner_alert = lambda *a, **k: None
        stub.session_user = lambda *a, **k: None
    elif mod_name == "halalit_lookup_log":
        stub.record_bookcheck_lookup = lambda *a, **k: None
        stub.lookup_group_key = lambda *a, **k: ""
    elif mod_name == "halalit_lookup_quality":
        stub.is_garbage_lookup = lambda *a, **k: False
    sys.modules[mod_name] = stub

# theme_scan_cache imports lookup_group_key from the real module; keep stub complete.
sys.modules["halalit_lookup_log"].lookup_group_key = lambda *a, **k: ""  # type: ignore

from bookcheck_theme_api import (  # noqa: E402
    _merge_sensitive_present,
    is_clean_ya_only_brief,
    language_brief_is_harsh,
    language_brief_is_mild_note,
    lgbtq_affirmative_evidence,
    merge_theme_scans,
    positive_representation_brief_is_usable,
    theme_brief_denies_presence,
)


class BookcheckThemeHelperTests(unittest.TestCase):
    def test_lgbtq_denial_is_not_affirmative(self) -> None:
        denial = (
            "no confirmed on-page LGBTQ characters or relationships found in reviews or summaries; "
            "any perceived subtext is reader projection only."
        )
        self.assertFalse(lgbtq_affirmative_evidence(denial))

    def test_clean_ya_romance_brief_denies_romantic_tension(self) -> None:
        brief = (
            "the romance is a YA-level clean romantic subplot between two teenage protagonists, "
            "not a mature-rated or explicit relationship."
        )
        self.assertTrue(theme_brief_denies_presence("romantic_tension", brief))
        self.assertTrue(is_clean_ya_only_brief("romantic_tension", brief))

    def test_sensitive_merge_prefers_deny_when_models_disagree(self) -> None:
        prev = {
            "id": "lgbtq",
            "present": True,
            "brief": "Gay supporting character confirmed in reviews.",
            "confidence": "medium",
        }
        row = {
            "id": "lgbtq",
            "present": False,
            "brief": "no confirmed on-page LGBTQ characters in reviews or summaries.",
            "confidence": "high",
        }
        self.assertFalse(_merge_sensitive_present("lgbtq", prev, row))

    def test_merge_scan_does_not_flip_lgbtq_from_denial_blob(self) -> None:
        scan_a = {
            "ok": True,
            "seriesNote": "",
            "themes": [
                {
                    "id": "lgbtq",
                    "present": False,
                    "confidence": "high",
                    "brief": "no confirmed on-page LGBTQ characters in reviews.",
                },
                {
                    "id": "teen_ya_age",
                    "present": True,
                    "confidence": "high",
                    "brief": "published as a Young Adult fantasy novel with a teenage protagonist.",
                },
            ],
        }
        scan_b = dict(scan_a)
        themes, _ = merge_theme_scans(scan_a, scan_b)
        lgbtq = next(t for t in themes if t["id"] == "lgbtq")
        self.assertFalse(lgbtq["present"])

    def test_client_supplement_patterns_exclude_clean_ya(self) -> None:
        """Mirror buildAiSupplementText exclusion for Darkest Stars-style scan."""
        brief = (
            "the romance is a YA-level clean romantic subplot between two teenage protagonists, "
            "not a mature-rated or explicit relationship."
        )
        self.assertTrue(theme_brief_denies_presence("romantic_tension", brief))
        teen_brief = "the book is published as a Young Adult fantasy novel with a teenage protagonist."
        self.assertTrue(is_clean_ya_only_brief("teen_ya_age", teen_brief))

    def test_mild_language_note_is_kept(self) -> None:
        brief = "A character says heck once during an argument."
        self.assertTrue(language_brief_is_mild_note(brief))
        self.assertFalse(language_brief_is_harsh(brief))
        self.assertFalse(theme_brief_denies_presence("crude_profanity", brief))

    def test_harsh_language_absence_still_denies(self) -> None:
        brief = "No harsh swearing in the reviews."
        self.assertTrue(theme_brief_denies_presence("crude_profanity", brief))
        self.assertTrue(language_brief_is_harsh("The dialogue uses the f-word often."))

    def test_positive_representation_needs_a_real_portrayal(self) -> None:
        self.assertFalse(positive_representation_brief_is_usable("Positive representation."))
        self.assertFalse(
            positive_representation_brief_is_usable("A diverse cast of friends goes on an adventure together.")
        )
        self.assertTrue(
            positive_representation_brief_is_usable(
                "A Muslim family is shown at home before a trip. The daughter wears hijab and they pray together. "
                "Reviews describe this as everyday life."
            )
        )

    def test_scan_never_publishes_positive_representation(self) -> None:
        from bookcheck_theme_api import scrub_positive_representation

        rows = scrub_positive_representation(
            [
                {
                    "id": "positive_representation",
                    "present": True,
                    "brief": (
                        "A Muslim family is shown at home before a trip. The daughter wears hijab and they pray together. "
                        "Reviews describe this as everyday life."
                    ),
                }
            ]
        )
        self.assertFalse(rows[0]["present"])
        self.assertEqual(rows[0]["brief"], "")


if __name__ == "__main__":
    unittest.main()
