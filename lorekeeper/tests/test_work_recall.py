"""Shared work recall pipeline tests (#15) — synthetic corpus only."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

from lorekeeper_recall import RECALL_VERSION, recall_from_user_data
from lorekeeper_work_recall import route_question

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "smoke_and_mirrors_corpus.json"


def _load_fixture() -> tuple[str, list[dict]]:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return str(data["workTag"]), list(data["entries"])


class WorkRecallTests(unittest.TestCase):
    def _ask(self, question: str, entries: list[dict], *, mode: str = "full") -> dict:
        return recall_from_user_data(
            question,
            {"lorekeeper_entries_v1": json.dumps(entries)},
            mode=mode,
        )

    def test_route_question_kinds(self):
        self.assertEqual(route_question("In Ashford Saga, who is Character M?"), "who")
        self.assertEqual(
            route_question("In Ashford Saga, how are Character M and Character B related?"),
            "relationship",
        )
        self.assertEqual(
            route_question("What have I done with Character M in Ashford Saga?"),
            "coverage",
        )
        self.assertEqual(
            route_question("In Ashford Saga, tell me about the northern gate"),
            "topic",
        )
        self.assertEqual(route_question("In Ashford Saga, northern gate"), "fallback")
        self.assertEqual(
            route_question("What discrepancies do I have for Character M?"),
            "coverage",
        )

    def test_recall_version_and_question_kind(self):
        work, entries = _load_fixture()
        res = self._ask(f"In {work}, who is Etherei?", entries)
        self.assertTrue(res.get("ok"))
        self.assertEqual(res.get("recallVersion"), RECALL_VERSION)
        self.assertEqual(res.get("questionKind"), "who")

    def test_smoke_and_mirrors_who_is_composed(self):
        work, entries = _load_fixture()
        res = self._ask(f"In {work}, who is Etherei?", entries)
        answer = res.get("answer") or ""
        self.assertEqual(res.get("materialState"), "summarizable")
        self.assertNotIn("•", answer)
        self.assertNotIn("turned toward", answer.lower())
        self.assertIn("protagonist", answer.lower())
        self.assertIn("married", answer.lower())
        self.assertTrue(res.get("sources"))

    def test_pipeline_never_demotes_who_is(self):
        work, entries = _load_fixture()
        entries.extend(
            [
                {
                    "id": f"noise-{i}",
                    "title": f"Noise {i}",
                    "body": "Unrelated wind and rain.",
                    "tags": [work],
                    "kind": "note",
                }
                for i in range(5)
            ]
        )
        res = self._ask(f"In {work}, who is Etherei?", entries)
        answer = res.get("answer") or ""
        self.assertNotIn("too scattered", answer)
        self.assertNotIn("From what you've written", answer)

    def test_coverage_question_uses_pipeline(self):
        work, entries = _load_fixture()
        res = self._ask(f"What have I done with Etherei in {work}?", entries)
        self.assertEqual(res.get("questionKind"), "coverage")
        answer = (res.get("answer") or "").lower()
        self.assertTrue(
            "from what you've saved" in answer
            or "what you've written about" in answer
        )

    def test_everything_written_on_character_routes_coverage(self):
        work, entries = _load_fixture()
        q = f"Tell me everything I have written on Etherei in {work}"
        self.assertEqual(route_question(q), "coverage")
        res = self._ask(q, entries)
        self.assertEqual(res.get("questionKind"), "coverage")
        answer = (res.get("answer") or "").lower()
        self.assertIn("from what you've saved", answer)
        self.assertIn("protagonist", answer)
        self.assertIn("married", answer)
        self.assertTrue(res.get("sources"))

    def test_brief_mode_shortens_who_is(self):
        work, entries = _load_fixture()
        full = self._ask(f"In {work}, who is Etherei?", entries, mode="full")
        brief = self._ask(f"In {work}, who is Etherei?", entries, mode="brief")
        self.assertEqual(brief.get("mode"), "brief")
        self.assertLess(len(brief.get("answer") or ""), len(full.get("answer") or ""))
        self.assertIn("Etherei", brief.get("answer") or "")


if __name__ == "__main__":
    unittest.main()
