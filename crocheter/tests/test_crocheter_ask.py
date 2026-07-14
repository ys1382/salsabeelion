"""Tests for Crocheter Ask scope rules."""
from __future__ import annotations

import unittest
from unittest import mock

from crocheter_ask import answer_crochet_question, classify_question, refusal_message


class CrocheterAskScopeTests(unittest.TestCase):
    def test_blocks_youtube_creator_questions(self):
        self.assertEqual(
            classify_question("Who is the best YouTube crocheter to follow?"),
            "creators_out_of_scope",
        )

    def test_blocks_brand_comparison(self):
        self.assertEqual(
            classify_question("Is Red Heart better than Lion Brand?"),
            "brand_compare_out_of_scope",
        )

    def test_allows_yarn_fiber_question(self):
        self.assertIsNone(
            classify_question("What fiber is Red Heart Super Saver made of?"),
        )

    def test_allows_stitch_question(self):
        self.assertIsNone(classify_question("How do I join a round with slip stitch?"))

    def test_refusal_has_plain_message(self):
        msg = refusal_message("creators_out_of_scope")
        self.assertIn("YouTube", msg)

    @mock.patch("crocheter_ask._call_anthropic", return_value="It is 100% acrylic.")
    @mock.patch("crocheter_ask.ask_available", return_value=True)
    def test_answer_ok(self, _avail, _llm):
        res = answer_crochet_question("What is Red Heart Super Saver made of?")
        self.assertTrue(res["ok"])
        self.assertIn("acrylic", res["answer"].lower())

    @mock.patch("crocheter_ask.ask_available", return_value=True)
    def test_creator_blocked_without_llm(self, _avail):
        res = answer_crochet_question("Best crochet TikTok account?")
        self.assertFalse(res["ok"])
        self.assertEqual(res["error"], "creators_out_of_scope")


if __name__ == "__main__":
    unittest.main()
