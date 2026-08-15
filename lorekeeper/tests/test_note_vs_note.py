"""Note-vs-note compare — synthetic corpus only, no winner, no inventing."""
from __future__ import annotations

import json
import unittest

from lorekeeper_character_compose import (
    DRAFT_VS_NOTES_DRAFT_LABEL,
    DRAFT_VS_NOTES_NOTES_LABEL,
)
from lorekeeper_note_compare import (
    NOT_IN_DRAFT_LINE,
    compose_note_compare_answer,
    compose_planned_vs_draft_mentions,
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
        "tags": tags or ["Project Alpha"],
        "kind": kind,
        "createdAt": 1,
        "updatedAt": 1,
    }


class NoteVsNoteCompareTests(unittest.TestCase):
    def _ask(self, question: str, entries: list[dict]) -> dict:
        return recall_from_user_data(
            question,
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )

    def test_two_notes_named_plainly(self):
        entries = [
            _entry("n1", "Marriage A", "Character A is married to Character C."),
            _entry("n2", "Marriage B", "Character A is married to Character D."),
        ]
        answer, ids = compose_note_compare_answer("Character A", entries)
        low = answer.lower()
        self.assertIn("this note", low)
        self.assertIn("that note", low)
        self.assertIn("marriage a", low)
        self.assertIn("marriage b", low)
        self.assertIn("character c", low)
        self.assertIn("character d", low)
        self.assertIn(NOT_IN_DRAFT_LINE.lower(), low)
        self.assertNotIn(DRAFT_VS_NOTES_DRAFT_LABEL.lower(), low)
        self.assertNotIn(DRAFT_VS_NOTES_NOTES_LABEL.lower(), low)
        self.assertTrue(ids)

    def test_skips_planned_and_planned_later(self):
        entries = [
            _entry("n1", "Marriage A", "Character A is married to Character C."),
            _entry(
                "p1",
                "planned: Character A marriage",
                "Character A is married to Character D.",
                tags=["Project Alpha", "planned later"],
            ),
        ]
        answer, _ids = compose_note_compare_answer("Character A", entries)
        low = answer.lower()
        self.assertNotIn("character d", low)
        self.assertIn("no clear disagreements", low)

    def test_mentions_draft_contradiction_without_dual_labels(self):
        entries = [
            _entry("n1", "Marriage A", "Character A is married to Character C."),
            _entry("n2", "Marriage B", "Character A is married to Character D."),
            _entry(
                "d1",
                "Chapter 1",
                "Character A is married to Character E.",
                kind="document",
            ),
        ]
        answer, _ids = compose_note_compare_answer("Character A", entries)
        low = answer.lower()
        self.assertIn("this note", low)
        self.assertIn("that note", low)
        self.assertIn("the main draft says", low)
        self.assertIn("character e", low)
        self.assertNotIn(NOT_IN_DRAFT_LINE.lower(), low)
        self.assertNotIn(DRAFT_VS_NOTES_DRAFT_LABEL.lower(), low)
        self.assertNotIn(DRAFT_VS_NOTES_NOTES_LABEL.lower(), low)

    def test_ask_discrepancy_uses_note_vs_note(self):
        entries = [
            _entry("n1", "Marriage A", "Character A is married to Character C."),
            _entry("n2", "Marriage B", "Character A is married to Character D."),
        ]
        res = self._ask(
            "In Project Alpha, what discrepancies do I have for Character A?",
            entries,
        )
        answer = (res.get("answer") or "").lower()
        self.assertIn("this note", answer)
        self.assertIn("that note", answer)
        self.assertIn("character c", answer)
        self.assertIn("character d", answer)

    def test_planned_gaps_mentions_draft_conflict_not_absence(self):
        entries = [
            _entry(
                "p1",
                "planned: Character A is married to Character D",
                "Character A is married to Character D.",
                tags=["Project Alpha", "planned"],
            ),
            _entry(
                "d1",
                "Chapter 1",
                "Character A is married to Character C.",
                kind="document",
            ),
        ]
        extra = compose_planned_vs_draft_mentions(entries)
        self.assertIn("the main draft says", extra.lower())
        self.assertIn("character c", extra.lower())
        self.assertNotIn(NOT_IN_DRAFT_LINE.lower(), extra.lower())

        res = self._ask(
            "In Project Alpha, what do I have planned for the main draft that's in my notes?",
            entries,
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "planned_gaps")
        self.assertIn("character d", answer)
        self.assertIn("the main draft says", answer)
        self.assertNotIn("not in the main draft", answer)
        self.assertNotIn(DRAFT_VS_NOTES_DRAFT_LABEL.lower(), answer)
        self.assertNotIn(DRAFT_VS_NOTES_NOTES_LABEL.lower(), answer)

    def test_who_is_keeps_draft_vs_notes_dual(self):
        entries = [
            _entry(
                "n1",
                "Mira notes",
                "Mira is the protagonist. Mira is married to Ken.",
                tags=["Ashford Saga"],
            ),
            _entry(
                "d1",
                "Chapter 1",
                "Mira is the antagonist. Mira is married to Leo.",
                tags=["Ashford Saga"],
                kind="document",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Mira?", entries)
        answer = res.get("answer") or ""
        self.assertIn(DRAFT_VS_NOTES_DRAFT_LABEL, answer)
        self.assertIn(DRAFT_VS_NOTES_NOTES_LABEL, answer)


if __name__ == "__main__":
    unittest.main()
