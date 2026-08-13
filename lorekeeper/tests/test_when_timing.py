"""When-will Ask — later-book vs this-book timing (synthetic only)."""
from __future__ import annotations

import json
import unittest

from lorekeeper_rag import _system_for_kind
from lorekeeper_recall import recall_from_user_data
from lorekeeper_shaped_recall import (
    ensure_when_timing_completeness,
    is_when_timing_question,
    notes_mark_later_book_for_question,
)
from lorekeeper_work_recall import route_question


def _entry(eid, title, body, *, kind="note", tags=None):
    return {
        "id": eid,
        "title": title,
        "body": body,
        "tags": tags or ["Ashford Saga"],
        "kind": kind,
        "createdAt": 1,
        "updatedAt": 1,
    }


Q = (
    "In Ashford Saga, when will the Predators find out that the Herdfolk "
    "from their realm are sentient?"
)


class WhenTimingTests(unittest.TestCase):
    def test_detects_when_will(self):
        self.assertTrue(is_when_timing_question(Q))
        self.assertEqual(route_question(Q), "when")
        self.assertFalse(
            is_when_timing_question("Who is Character E when the wolf arrives?")
        )

    def test_rag_when_prompt_asks_for_timing_first(self):
        system = _system_for_kind(Q, "when", brief=False)
        self.assertIn("WHEN", system.upper())
        self.assertIn("later book", system.lower())
        self.assertIn("first sentence", system.lower())

    def test_notes_mark_later_book(self):
        entries = [
            _entry(
                "n1",
                "Herdfolk sentience",
                "Predators learning that Herdfolk in their realm are sentient "
                "does not happen until a later book.",
            ),
            _entry(
                "n2",
                "Unrelated later",
                "Character E returns home — this does not happen until a later book.",
            ),
        ]
        self.assertTrue(notes_mark_later_book_for_question(Q, entries))
        self.assertFalse(
            notes_mark_later_book_for_question(Q, [entries[1]])
        )

    def test_completeness_leads_with_later_book_and_drops_extra(self):
        entries = [
            _entry(
                "n1",
                "Herdfolk sentience",
                "The Herdfolk sentience reveal does not happen until a later book "
                "and is not a plot point for the first book.",
            )
        ]
        essay = (
            "Ashford Saga depicts a world where Predators operate under a "
            "fundamental misunderstanding about Herdfolk sentience. "
            "This ignorance is deliberate on the Herdfolk's part. "
            "The birds hide through plumage and environmental camouflage. "
            "Some masquerade as parrots to survive.\n\n"
            "— From your notes only. Nothing invented."
        )
        out, did = ensure_when_timing_completeness(Q, entries, essay)
        self.assertTrue(did)
        low = out.lower()
        self.assertTrue(low.startswith("your notes mark this as a concern for later"))
        self.assertIn("ashford saga", low)
        self.assertNotIn("parrot", low)
        self.assertNotIn("plumage", low)
        self.assertIn("from your notes only", low)

    def test_does_not_invent_later_book_when_notes_do_not_place_it(self):
        entries = [
            _entry(
                "n1",
                "Herdfolk",
                "Herdfolk are mostly herbivores with considerable cunning.",
            )
        ]
        essay = (
            "Herdfolk are mostly herbivores with considerable cunning.\n\n"
            "— From your notes only. Nothing invented."
        )
        out, did = ensure_when_timing_completeness(Q, entries, essay)
        self.assertFalse(did)
        self.assertNotIn("later book", out.lower())

    def test_recall_when_will_names_later_book(self):
        entries = [
            _entry(
                "n1",
                "Herdfolk sentience",
                "Predators currently believe Herdfolk are not sentient. "
                "The reveal that Herdfolk of their realm are sentient does not "
                "happen until a later book, not in the first book of Ashford Saga.",
            ),
            _entry(
                "n2",
                "Birds",
                "The birds hide through plumage and masquerade as parrots.",
            ),
            _entry(
                "d1",
                "Draft",
                "Character E walked the manor garden at dusk.",
                kind="document",
            ),
        ]
        import os

        os.environ["LOREKEEPER_RAG"] = "0"
        res = recall_from_user_data(
            Q, {"lorekeeper_entries_v1": json.dumps(entries)}
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "when")
        self.assertIn("later", answer)
        self.assertNotIn("write what happens between", answer)


if __name__ == "__main__":
    unittest.main()
