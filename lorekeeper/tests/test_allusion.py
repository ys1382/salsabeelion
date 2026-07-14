"""Evidence-only reference / allusion reading (#18) — synthetic names only."""
from __future__ import annotations

import json
import unittest

from lorekeeper_allusion import (
    build_allusion_answer,
    collect_allusion_evidence,
    compose_allusion_gap,
    is_allusion_question,
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


class AllusionTests(unittest.TestCase):
    def _ask(self, question: str, entries: list[dict]) -> dict:
        return recall_from_user_data(
            question,
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )

    def test_detects_allusion_questions(self):
        self.assertTrue(
            is_allusion_question("In Ashford Saga, what tale is Character A based on?")
        )
        self.assertTrue(is_allusion_question("What references Tale Beta in my notes?"))
        self.assertFalse(is_allusion_question("Who is Character A?"))

    def test_explicit_based_on_surfaces(self):
        entries = [
            _entry(
                "c1",
                "Character A",
                "Character A is based on Tale Beta.",
                kind="character",
            ),
        ]
        evidence, ids = collect_allusion_evidence(
            "In Ashford Saga, what is Character A based on?", entries
        )
        self.assertTrue(evidence)
        self.assertIn("tale beta", evidence[0]["source"].lower())
        answer, _ = build_allusion_answer(
            "In Ashford Saga, what tale is Character A based on?", entries
        )
        self.assertIn("tale beta", (answer or "").lower())
        self.assertNotIn("you invented", (answer or "").lower())

    def test_events_of_reference(self):
        entries = [
            _entry(
                "d1#p0",
                "Draft",
                "Previously, in the events of Tale Gamma, Character A fled the tower.",
                kind="document",
            ),
        ]
        evidence, _ = collect_allusion_evidence(
            "In Ashford Saga, what references Tale Gamma?", entries
        )
        self.assertTrue(any("tale gamma" in r["source"].lower() for r in evidence))

    def test_no_invention_from_name_alone(self):
        entries = [
            _entry(
                "c1",
                "Character A",
                "Character A wears glass shoes and has a stepmother.",
                kind="character",
            ),
        ]
        answer, _ = build_allusion_answer(
            "In Ashford Saga, what fairy tale is Character A based on?", entries
        )
        low = (answer or "").lower()
        self.assertIn("no tale or source ties", low)
        self.assertNotIn("tale beta", low)

    def test_recall_allusion_answer(self):
        entries = [
            _entry(
                "r1",
                "Reference note",
                "Known tale: Tale Delta — Character B is a retelling of Tale Delta.",
                kind="reference",
            ),
        ]
        res = self._ask("In Ashford Saga, what allusions to Tale Delta?", entries)
        answer = res.get("answer") or ""
        self.assertIn("tale delta", answer.lower())
        self.assertNotIn("•", answer)

    def test_gap_copy_mentions_no_name_guessing(self):
        text = compose_allusion_gap(
            "what is Character A based on?", work_title="Ashford Saga"
        )
        self.assertIn("similar names alone", text.lower())


if __name__ == "__main__":
    unittest.main()
