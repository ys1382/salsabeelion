"""Doc Ask scope filters (#19)."""
from __future__ import annotations

import json
import unittest

from lorekeeper_recall import recall_from_user_data
from lorekeeper_recall_scope import check_work_disambiguation
from lorekeeper_reliability import (
    augment_question_with_scope_work,
    filter_entries_by_recall_scope,
)


def _entry(eid: str, body: str, *, tags=None, linked=None, parent=None, title="Entry"):
    row = {
        "id": eid,
        "title": title,
        "body": body,
        "tags": tags or ["Ashford Saga"],
        "kind": "note",
    }
    if linked:
        row["linkedDocId"] = linked
    if parent:
        row["parentDocId"] = parent
    return row


class RecallScopeTests(unittest.TestCase):
    def test_work_scope_filters_tags(self):
        entries = [
            _entry("n1", "Northern politics.", tags=["Ashford Saga"]),
            _entry("n2", "Garden roses.", tags=["Garden"]),
        ]
        scoped, hints, strict = filter_entries_by_recall_scope(
            entries, work_title="Ashford Saga", scope_mode="work"
        )
        self.assertEqual(len(scoped), 1)
        self.assertEqual(scoped[0]["id"], "n1")
        self.assertTrue(strict)

    def test_document_scope_keeps_doc_and_linked_notes(self):
        entries = [
            _entry("doc1", "Draft prose.", tags=["Ashford Saga"]),
            _entry("doc1#p0", "Scene beat.", tags=["Ashford Saga"], parent="doc1"),
            _entry("n1", "Character scrap.", tags=["Ashford Saga"], linked="doc1"),
            _entry("n2", "Other doc note.", tags=["Ashford Saga"], linked="doc9"),
        ]
        scoped, _, _ = filter_entries_by_recall_scope(
            entries,
            work_title="Ashford Saga",
            document_id="doc1",
            scope_mode="document",
        )
        ids = {e["id"] for e in scoped}
        self.assertIn("doc1", ids)
        self.assertIn("doc1#p0", ids)
        self.assertIn("n1", ids)
        self.assertNotIn("n2", ids)

    def test_work_mode_without_work_falls_back_to_document(self):
        entries = [
            _entry("doc1", "Protagonist walks north.", tags=[]),
            _entry("n2", "Other project scrap.", tags=["Garden"]),
        ]
        scoped, _, strict = filter_entries_by_recall_scope(
            entries,
            work_title="",
            document_id="doc1",
            scope_mode="work",
        )
        ids = {e["id"] for e in scoped}
        self.assertEqual(ids, {"doc1"})
        self.assertTrue(strict)

    def test_document_id_skips_disambiguation(self):
        entries = [
            _entry(
                "doc-fire",
                "The protagonist flees the ice hall.",
                tags=["Fire and Ice"],
                title="Fire draft",
            ),
            _entry(
                "n-iso",
                "The protagonist seals the gate.",
                tags=["Ice and Isolation"],
                title="Isolation note",
            ),
        ]
        self.assertIsNone(
            check_work_disambiguation(
                "remind me what the protagonist does next",
                entries,
                scope_document_id="doc-fire",
            )
        )

    def test_doc_ask_vague_question_no_which_project(self):
        entries = [
            {
                "id": "doc-fire",
                "title": "Fire draft",
                "body": (
                    "Mira is the protagonist. Next, Mira crosses the frozen bridge "
                    "and meets the ice lady at dawn."
                ),
                "tags": ["Fire and Ice"],
                "kind": "document",
            },
            {
                "id": "n-iso",
                "title": "Isolation note",
                "body": "Ken is the protagonist. Next, Ken seals the northern gate.",
                "tags": ["Ice and Isolation"],
                "kind": "note",
            },
            {
                "id": "n-lady",
                "title": "Ice lady",
                "body": "The ice lady is the antagonist in Ice and Isolation.",
                "tags": ["Ice and Isolation"],
                "kind": "note",
            },
        ]
        res = recall_from_user_data(
            "ok remind me what the protagonist does next according to my notes",
            {"lorekeeper_entries_v1": json.dumps(entries)},
            scope={
                "mode": "document",
                "workTitle": "",
                "documentId": "doc-fire",
            },
        )
        answer = (res.get("answer") or "").lower()
        self.assertNotIn("more than one project", answer)
        self.assertNotIn("ice and isolation", answer)
        self.assertNotEqual(res.get("materialState"), "nothing_saved")

    def test_who_is_document_scope_uses_unlinked_work_notes(self):
        """Who-is from Doc Ask must read work notes, not only the open draft."""
        entries = [
            {
                "id": "d1",
                "title": "Ashford draft",
                "body": (
                    "Character M is the protagonist of the story, the White Rabbit "
                    "from Alice in Wonderland. Character M is known by the name "
                    "Chroniker by Character D."
                ),
                "tags": ["Ashford Saga"],
                "kind": "document",
            },
            {
                "id": "n1",
                "title": "Character M",
                "body": (
                    "Character M is younger brother to Obsidian and Stygian. "
                    "Character M is the chosen one meant to defeat the dragon demon king."
                ),
                "tags": ["Ashford Saga"],
                "kind": "character",
                "linkedDocId": "",
            },
        ]
        res = recall_from_user_data(
            "who is Character M?",
            {"lorekeeper_entries_v1": json.dumps(entries)},
            scope={
                "mode": "document",
                "workTitle": "Ashford Saga",
                "documentId": "d1",
            },
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "who")
        self.assertIn("obsidian", answer)
        self.assertIn("stygian", answer)
        self.assertTrue(
            "chosen" in answer or "dragon" in answer or "brother" in answer,
            msg=res.get("answer"),
        )


if __name__ == "__main__":
    unittest.main()
