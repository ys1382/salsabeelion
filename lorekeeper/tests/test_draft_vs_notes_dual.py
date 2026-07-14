"""Draft vs notes dual Ask layout — librarian-only, no invented winner."""
from __future__ import annotations

import json
import unittest

from lorekeeper_character_compose import (
    DRAFT_VS_NOTES_DRAFT_LABEL,
    DRAFT_VS_NOTES_NOTES_LABEL,
    compose_draft_vs_notes_dual,
)
from lorekeeper_inference import draft_vs_notes_conflict
from lorekeeper_recall import recall_from_user_data


class DraftVsNotesDualTests(unittest.TestCase):
    def _ask(self, question: str, entries: list[dict]) -> dict:
        return recall_from_user_data(
            question,
            {"lorekeeper_entries_v1": json.dumps(entries)},
            mode="full",
        )

    def test_compose_orders_draft_then_notes(self):
        out = compose_draft_vs_notes_dual(
            "Mira is married to Ken. — From your notes only. Nothing invented.",
            "Mira is married to Leo. — Pulled from your notes only. Nothing invented.",
        )
        self.assertTrue(out.startswith(DRAFT_VS_NOTES_DRAFT_LABEL))
        self.assertIn(DRAFT_VS_NOTES_NOTES_LABEL, out)
        draft_i = out.index(DRAFT_VS_NOTES_DRAFT_LABEL)
        notes_i = out.index(DRAFT_VS_NOTES_NOTES_LABEL)
        self.assertLess(draft_i, notes_i)
        self.assertIn("Ken", out)
        self.assertIn("Leo", out)
        self.assertNotIn("From your notes only", out)

    def test_conflict_when_spouses_differ_across_sides(self):
        entries = [
            {
                "id": "n1",
                "kind": "note",
                "title": "Mira",
                "tags": ["Ashford Saga"],
                "body": "Mira is married to Ken.",
            },
            {
                "id": "d1",
                "kind": "document",
                "title": "Chapter 1",
                "tags": ["Ashford Saga"],
                "body": "Mira is married to Leo.",
            },
        ]
        self.assertTrue(draft_vs_notes_conflict("Mira", entries))

    def test_no_conflict_when_only_notes(self):
        entries = [
            {
                "id": "n1",
                "kind": "note",
                "title": "Mira",
                "tags": ["Ashford Saga"],
                "body": "Mira is married to Ken.",
            },
        ]
        self.assertFalse(draft_vs_notes_conflict("Mira", entries))

    def test_ask_dual_layout_on_who_is(self):
        entries = [
            {
                "id": "n1",
                "kind": "note",
                "title": "Mira notes",
                "tags": ["Ashford Saga"],
                "body": "Mira is the protagonist. Mira is married to Ken.",
            },
            {
                "id": "d1",
                "kind": "document",
                "title": "Chapter 1",
                "tags": ["Ashford Saga"],
                "body": "Mira is the antagonist. Mira is married to Leo.",
            },
        ]
        res = self._ask("In Ashford Saga, who is Mira?", entries)
        self.assertTrue(res.get("ok"))
        answer = res.get("answer") or ""
        self.assertIn(DRAFT_VS_NOTES_DRAFT_LABEL, answer)
        self.assertIn(DRAFT_VS_NOTES_NOTES_LABEL, answer)
        self.assertLess(
            answer.index(DRAFT_VS_NOTES_DRAFT_LABEL),
            answer.index(DRAFT_VS_NOTES_NOTES_LABEL),
        )


if __name__ == "__main__":
    unittest.main()
