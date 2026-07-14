"""Phased politics/faction summaries (#17) — synthetic names only."""
from __future__ import annotations

import json
import unittest

from lorekeeper_situation import (
    build_situation_answer,
    collect_situation_phases,
    compose_situation_summary,
    is_situation_question,
)
from lorekeeper_recall import recall_from_user_data


def _entry(
    eid: str,
    title: str,
    body: str,
    *,
    tags: list[str] | None = None,
    kind: str = "note",
) -> dict:
    return {
        "id": eid,
        "title": title,
        "body": body,
        "tags": tags or ["Ashford Saga"],
        "kind": kind,
        "createdAt": 1,
        "updatedAt": 1,
    }


class SituationTests(unittest.TestCase):
    def _ask(self, question: str, entries: list[dict]) -> dict:
        return recall_from_user_data(
            question,
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )

    def test_detects_situation_questions(self):
        self.assertTrue(is_situation_question("In Ashford Saga, summarize politics"))
        self.assertTrue(
            is_situation_question("What is the political situation in Ashford Saga?")
        )
        self.assertFalse(is_situation_question("Who is Character A?"))

    def test_phased_summary_settled_shifting_gaps(self):
        entries = [
            _entry(
                "p1",
                "Northern alliance",
                "The northern tribes are allied with Kael. The river council controls the eastern ports.",
                kind="politics",
            ),
            _entry(
                "p2",
                "Western barons",
                "The western barons were formerly sworn to the crown; their present loyalty is unsettled.",
                kind="politics",
            ),
            _entry(
                "p3",
                "Southern gap",
                "Not yet decided whether the southern alliance survives the treaty breach.",
                kind="politics",
            ),
        ]
        settled, shifting, gaps, _ = collect_situation_phases(
            "In Ashford Saga, political situation", entries
        )
        self.assertTrue(settled)
        self.assertTrue(shifting)
        self.assertTrue(gaps)

        answer, _ = build_situation_answer(
            "In Ashford Saga, what is the political situation?", entries
        )
        self.assertIsNotNone(answer)
        low = (answer or "").lower()
        self.assertIn("northern tribes", low)
        self.assertIn("in flux", low)
        self.assertTrue("not yet" in low or "not decided" in low or "survives" in low)
        self.assertNotIn("you wrote", low)

    def test_no_politics_invented_from_unrelated_notes(self):
        entries = [
            _entry("g1", "Garden", "The roses faced north."),
            _entry("k1", "Kitchen", "Soup with thyme."),
        ]
        answer, ids = build_situation_answer(
            "In Ashford Saga, summarize politics", entries
        )
        self.assertTrue(answer)
        self.assertIn("nothing substantial", (answer or "").lower())
        self.assertEqual(ids, [])

    def test_recall_uses_phased_answer(self):
        entries = [
            _entry(
                "p1",
                "Court",
                "Faction Red holds the capital. Faction Blue controls the western marches.",
                kind="faction",
            ),
        ]
        res = self._ask("In Ashford Saga, summarize politics and factions", entries)
        answer = res.get("answer") or ""
        self.assertIn("faction red", answer.lower())
        self.assertNotIn("•", answer)

    def test_compose_reference_voice(self):
        text = compose_situation_summary(
            "political situation",
            ["The northern tribes are allied with Kael."],
            [],
            [],
            work_title="Ashford Saga",
        )
        self.assertIn("Political situation (Ashford Saga)", text)
        self.assertIn("northern tribes", text.lower())
        self.assertNotIn("you wrote", text.lower())


if __name__ == "__main__":
    unittest.main()
