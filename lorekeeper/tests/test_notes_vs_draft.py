"""Notes not yet in main draft — Ask route (synthetic corpus only)."""
from __future__ import annotations

import json
import unittest

from lorekeeper_character_compose import is_coverage_question
from lorekeeper_notes_vs_draft import (
    collect_notes_not_in_draft,
    is_notes_not_in_draft_question,
)
from lorekeeper_recall import recall_from_user_data
from lorekeeper_work_recall import route_question


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
        "tags": tags or ["Smoke and Mirrors"],
        "kind": kind,
        "createdAt": 1,
        "updatedAt": 1,
    }


class NotesNotInDraftDetectionTests(unittest.TestCase):
    def test_owner_phrasing(self):
        q = (
            "in smoke and mirrors, tell me what ive written in notes that "
            "hasn't been touched upon in the main document"
        )
        self.assertTrue(is_notes_not_in_draft_question(q))
        self.assertEqual(route_question(q), "notes_not_in_draft")
        self.assertFalse(is_coverage_question(q))

    def test_other_phrasings(self):
        self.assertTrue(
            is_notes_not_in_draft_question(
                "In Project Alpha, what is in my notes but not in the draft?"
            )
        )
        self.assertTrue(
            is_notes_not_in_draft_question(
                "Notes I haven't used in the document for Project Alpha"
            )
        )

    def test_does_not_steal_planned_or_who(self):
        self.assertFalse(
            is_notes_not_in_draft_question(
                "In Project Alpha, what's not written yet?"
            )
        )
        self.assertFalse(is_notes_not_in_draft_question("Who is Character A?"))


class NotesNotInDraftCollectTests(unittest.TestCase):
    def test_lists_note_only_claims(self):
        entries = [
            _entry(
                "n1",
                "Mirror lore",
                "The silver mirror only reflects lies. Also the protagonist owns a blue scarf.",
            ),
            _entry(
                "d1",
                "Chapter 1",
                "She walked into the hall. The silver mirror only reflects lies. "
                "Then she left.",
                kind="document",
            ),
        ]
        unused, has_notes, has_draft = collect_notes_not_in_draft(entries)
        self.assertTrue(has_notes and has_draft)
        texts = " ".join(row["line"].lower() for row in unused)
        self.assertIn("blue scarf", texts)
        self.assertNotIn("silver mirror only reflects lies", texts)

    def test_no_draft_is_honest(self):
        entries = [_entry("n1", "Idea", "A secret tunnel under the library.")]
        unused, has_notes, has_draft = collect_notes_not_in_draft(entries)
        self.assertTrue(has_notes)
        self.assertFalse(has_draft)
        self.assertEqual(unused, [])


class NotesNotInDraftAskTests(unittest.TestCase):
    def _ask(self, question: str, entries: list[dict]) -> dict:
        return recall_from_user_data(
            question,
            {"lorekeeper_entries_v1": json.dumps(entries)},
            mode="full",
        )

    def test_ask_lists_unused_note_material(self):
        entries = [
            _entry(
                "n1",
                "World notes",
                "Character Mira keeps a brass key that opens the attic. "
                "The attic smells like rain.",
            ),
            _entry(
                "d1",
                "Main draft",
                "Mira climbed the stairs. The attic smells like rain. She paused.",
                kind="document",
            ),
        ]
        q = (
            "In Smoke and Mirrors, tell me what I've written in notes that "
            "hasn't been touched upon in the main document"
        )
        res = self._ask(q, entries)
        self.assertTrue(res.get("ok"))
        self.assertEqual(res.get("questionKind"), "notes_not_in_draft")
        self.assertEqual(res.get("recallEngine"), "local")
        answer = (res.get("answer") or "").lower()
        self.assertIn("brass key", answer)
        self.assertNotIn("nothing clear enough to answer", answer)
        self.assertNotIn("attic smells like rain", answer)

    def test_ask_no_document_honest(self):
        entries = [_entry("n1", "World notes", "A brass key opens the attic.")]
        q = (
            "In Smoke and Mirrors, what is in my notes but not in the main document?"
        )
        res = self._ask(q, entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("no main document", answer)
        self.assertEqual(res.get("questionKind"), "notes_not_in_draft")


if __name__ == "__main__":
    unittest.main()
