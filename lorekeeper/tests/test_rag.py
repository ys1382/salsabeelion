"""RAG retrieval tests — synthetic corpus only; no live Anthropic calls."""
from __future__ import annotations

import json
import os
import unittest
from pathlib import Path
from unittest import mock

from lorekeeper_rag import (
    RAG_VERSION,
    _system_for_kind,
    answer_with_rag,
    rag_enabled,
    retrieve_for_question,
)
from lorekeeper_recall import _rank_entries

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "smoke_and_mirrors_corpus.json"


class RagTests(unittest.TestCase):
    def setUp(self):
        self._env = mock.patch.dict(os.environ, {"LOREKEEPER_RAG": "0"}, clear=False)
        self._env.start()

    def tearDown(self):
        self._env.stop()

    def test_rag_disabled_without_key(self):
        with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "", "LOREKEEPER_RAG": "1"}, clear=False):
            with mock.patch("lorekeeper_rag.anthropic_api_key", return_value=""):
                self.assertFalse(rag_enabled())

    def test_system_who_is_cast_card(self):
        system = _system_for_kind("In Fairy Tale, who is Ella?", "who", brief=False)
        self.assertIn("CAST CARD", system)
        self.assertIn("prior-story hook", system)
        self.assertNotIn("contradictory, say so honestly", system)

    def test_system_audit_meta(self):
        system = _system_for_kind("What discrepancies do I have for Ella?", "fallback", brief=False)
        self.assertIn("AUDIT", system)
        self.assertIn("discrepancies", system.lower())

    def test_retrieve_finds_etherei_chunks(self):
        data = json.loads(FIXTURE.read_text(encoding="utf-8"))
        work = str(data["workTag"])
        entries = list(data["entries"])
        question = f"In {work}, who is Etherei?"
        scoped, ranked, hints, strict = retrieve_for_question(
            question,
            entries,
            rank_entries=_rank_entries,
        )
        self.assertTrue(strict)
        self.assertIn(work.lower(), {h.lower() for h in hints})
        self.assertGreaterEqual(len(ranked), 1)
        joined = " ".join(r.get("body", "") for r in ranked).lower()
        self.assertIn("etherei", joined)

    def test_answer_with_rag_mocked(self):
        data = json.loads(FIXTURE.read_text(encoding="utf-8"))
        work = str(data["workTag"])
        entries = list(data["entries"])
        question = f"In {work}, who is Etherei?"
        fake_answer = (
            "Etherei is the protagonist of Smoke and Mirrors, married to Rowan.\n\n"
            "— From your notes only. Nothing invented."
        )
        with mock.patch("lorekeeper_rag._call_anthropic", return_value=fake_answer):
            result = answer_with_rag(
                question,
                entries,
                mode="full",
                rank_entries=_rank_entries,
                question_kind="who",
            )
        self.assertIn("protagonist", result["answer"].lower())
        self.assertEqual(result["materialState"], "summarizable")
        self.assertGreater(result["retrievalCount"], 0)
        self.assertTrue(result["sources"])


if __name__ == "__main__":
    unittest.main()
