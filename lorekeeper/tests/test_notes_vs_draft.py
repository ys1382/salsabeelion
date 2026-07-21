"""Notes not yet in main draft — Ask route (synthetic corpus only)."""
from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from lorekeeper_answer_focus import focus_ask_response
from lorekeeper_character_compose import is_coverage_question
from lorekeeper_notes_vs_draft import (
    collect_notes_not_in_draft,
    extract_notes_not_in_draft_subject,
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
        self.assertEqual(extract_notes_not_in_draft_subject(q), "")

    def test_subject_relating_to(self):
        q = (
            "in smoke and mirrors, tell me what ive written in notes that "
            "hasn't been touched upon in the main document relating to dijon"
        )
        self.assertTrue(is_notes_not_in_draft_question(q))
        self.assertEqual(
            extract_notes_not_in_draft_subject(q).lower(), "dijon"
        )

    def test_subject_notes_about(self):
        q = (
            "In Smoke and Mirrors, notes about Duke Dijon that haven't "
            "been touched upon in the main document"
        )
        self.assertEqual(
            extract_notes_not_in_draft_subject(q).lower(), "duke dijon"
        )

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

    def test_shared_names_do_not_count_as_touched(self):
        """Cast names in the draft must not hide unused note facts."""
        entries = [
            _entry(
                "n1",
                "Etherei",
                "Not older by enough to be mistaken for Etherei's father "
                "but by a decent year gap.\n"
                "Etherei keeps a brass attic key hidden in a boot.",
            ),
            _entry(
                "n2",
                "Places",
                "The glass market only opens at dusk.",
            ),
            _entry(
                "d1",
                "Main draft",
                "Etherei walked beside Etherei's father through the city. "
                "Etherei spoke softly. Etherei waited. Etherei turned back.",
                kind="document",
            ),
        ]
        unused, _, _ = collect_notes_not_in_draft(entries)
        texts = " ".join(row["line"].lower() for row in unused)
        self.assertIn("brass attic key", texts)
        self.assertIn("glass market", texts)
        self.assertIn("decent year gap", texts)
        self.assertGreaterEqual(len(unused), 3)

    def test_no_draft_is_honest(self):
        entries = [_entry("n1", "Idea", "A secret tunnel under the library.")]
        unused, has_notes, has_draft = collect_notes_not_in_draft(entries)
        self.assertTrue(has_notes)
        self.assertFalse(has_draft)
        self.assertEqual(unused, [])


class NotesNotInDraftAskTests(unittest.TestCase):
    def _ask(self, question: str, entries: list[dict], **kwargs) -> dict:
        return recall_from_user_data(
            question,
            {"lorekeeper_entries_v1": json.dumps(entries)},
            mode="full",
            **kwargs,
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

    def test_ask_filters_to_subject(self):
        """Subject focus must change the answer — not dump every unused note."""
        entries = [
            _entry(
                "n_dijon",
                "Duke Dijon",
                "Duke Dijon keeps a silver cufflink from the northern court. "
                "He owes Lord Tenebris a quiet favor.",
            ),
            _entry(
                "n_other",
                "Places",
                "The glass market only opens at dusk.",
            ),
            _entry(
                "d1",
                "Main draft",
                "Someone walked through the hall and left.",
                kind="document",
            ),
        ]
        q_all = (
            "In Smoke and Mirrors, tell me what I've written in notes that "
            "hasn't been touched upon in the main document"
        )
        q_dijon = q_all + " relating to dijon"
        res_all = self._ask(q_all, entries)
        res_dijon = self._ask(q_dijon, entries)
        all_ans = (res_all.get("answer") or "").lower()
        dijon_ans = (res_dijon.get("answer") or "").lower()
        self.assertIn("glass market", all_ans)
        self.assertIn("silver cufflink", all_ans)
        self.assertIn("silver cufflink", dijon_ans)
        self.assertIn("dijon", dijon_ans)
        self.assertNotIn("glass market", dijon_ans)
        self.assertNotEqual(all_ans, dijon_ans)

    def test_ask_stays_local_even_when_rag_on(self):
        """Regression: full RAG retrieve must not run; organize may use Haiku."""
        entries = [
            _entry(
                "n1",
                "World notes",
                "Character Mira keeps a brass key that opens the attic.",
            ),
            _entry(
                "d1",
                "Main draft",
                "Mira climbed the stairs and paused at the landing.",
                kind="document",
            ),
        ]
        q = (
            "in smoke and mirrors, tell me what ive written in notes that "
            "hasn't been touched upon in the main document"
        )
        with patch("lorekeeper_recall.rag_enabled", return_value=True):
            with patch(
                "lorekeeper_recall.answer_with_rag",
                side_effect=AssertionError("RAG must not run for notes_not_in_draft"),
            ):
                def _fake_organize(work_hints, items, local_fallback, subject=""):
                    return local_fallback

                with patch(
                    "lorekeeper_notes_vs_draft._organize_with_librarian",
                    side_effect=_fake_organize,
                ):
                    res = self._ask(q, entries)
        self.assertEqual(res.get("questionKind"), "notes_not_in_draft")
        self.assertEqual(res.get("recallEngine"), "local")
        self.assertIn("brass key", (res.get("answer") or "").lower())
        self.assertNotIn("nothing clear enough", (res.get("answer") or "").lower())

    def test_local_compose_groups_by_note(self):
        from lorekeeper_notes_vs_draft import compose_notes_not_in_draft_local

        items = [
            {
                "entryId": "n1",
                "noteTitle": "Etherei",
                "line": "Not older by enough to be mistaken for Etherei's father "
                "but by a decent year gap.",
            },
            {
                "entryId": "n1",
                "noteTitle": "Etherei",
                "line": "Etherei keeps a brass attic key hidden in a boot.",
            },
            {
                "entryId": "n2",
                "noteTitle": "Places",
                "line": "The glass market only opens at dusk.",
            },
        ]
        out = compose_notes_not_in_draft_local(
            {"Smoke and Mirrors"}, items, has_notes=True, has_draft=True
        )
        self.assertIn("\nEtherei\n", "\n" + out)
        self.assertIn("\nPlaces\n", "\n" + out)
        self.assertNotIn("(Etherei)", out)
        self.assertNotIn("•", out)
        self.assertIn("brass attic key", out.lower())
        self.assertIn("glass market", out.lower())

    def test_focus_does_not_strip_paragraph_sections(self):
        q = (
            "In Smoke and Mirrors, tell me what I've written in notes that "
            "hasn't been touched upon in the main document"
        )
        answer = (
            "In your notes for smoke and mirrors, but not clearly in the main document yet:\n"
            "\n"
            "Etherei\n"
            "Not older by enough to be mistaken for Etherei's father "
            "but by a decent year gap. Etherei keeps a brass attic key hidden in a boot.\n"
            "\n"
            "Places\n"
            "The glass market only opens at dusk.\n"
            "\n"
            "— From your notes vs draft only. Nothing invented. "
            "Not a full literary read of whether something was 'touched upon.'"
        )
        out = focus_ask_response(
            q,
            {
                "ok": True,
                "answer": answer,
                "questionKind": "notes_not_in_draft",
                "sources": [],
            },
        )
        result = out.get("answer") or ""
        self.assertEqual(result.count("decent year gap"), 1)
        self.assertIn("brass attic key", result.lower())
        self.assertIn("glass market", result.lower())
        self.assertNotIn("•", result)
        self.assertTrue(result.strip().endswith("touched upon.'") or "touched upon" in result)

    def test_doc_scope_still_sees_unlinked_work_notes(self):
        """Document Ask scope must not hide work notes that aren't linked to the open doc."""
        entries = [
            _entry(
                "n_linked",
                "Linked",
                "Linked scrap about a red lantern.",
            ),
            {
                **_entry(
                    "n_other",
                    "Other note",
                    "Unlinked scrap about a silver flute.",
                ),
                "linkedDocId": "",
            },
            _entry(
                "d1",
                "Main draft",
                "Someone walked past a red lantern in the street.",
                kind="document",
            ),
        ]
        # Mark only n_linked as linked to the document.
        entries[0]["linkedDocId"] = "d1"
        q = (
            "tell me what I've written in notes that hasn't been touched "
            "upon in the main document"
        )
        res = self._ask(
            q,
            entries,
            scope={"mode": "document", "workTitle": "Smoke and Mirrors", "documentId": "d1"},
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "notes_not_in_draft")
        self.assertIn("silver flute", answer)


if __name__ == "__main__":
    unittest.main()
