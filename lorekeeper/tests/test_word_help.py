"""Tests for LoreKeeper word help."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from lorekeeper_word_help import answer_word_help, word_help_enabled


class WordHelpTests(unittest.TestCase):
    def test_empty_query(self) -> None:
        self.assertEqual(answer_word_help(""), {"ok": False, "error": "empty_query"})
        self.assertEqual(answer_word_help("   "), {"ok": False, "error": "empty_query"})

    @patch("lorekeeper_word_help.word_help_enabled", return_value=False)
    def test_unavailable_without_key(self, _enabled: object) -> None:
        self.assertEqual(
            answer_word_help("synonyms for furtive"),
            {"ok": False, "error": "word_help_unavailable"},
        )

    @patch("lorekeeper_word_help._call_anthropic", return_value="- sneaky\n- secretive")
    @patch("lorekeeper_word_help.word_help_enabled", return_value=True)
    def test_success(self, _enabled: object, _call: object) -> None:
        res = answer_word_help("synonyms for furtive")
        self.assertTrue(res.get("ok"))
        self.assertIn("sneaky", res.get("answer", ""))

    def test_enabled_is_bool(self) -> None:
        self.assertIsInstance(word_help_enabled(), bool)


if __name__ == "__main__":
    unittest.main()
