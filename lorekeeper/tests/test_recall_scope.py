"""Doc Ask scope filters (#19)."""
from __future__ import annotations

import unittest

from lorekeeper_reliability import (
    augment_question_with_scope_work,
    filter_entries_by_recall_scope,
)


def _entry(eid: str, body: str, *, tags=None, linked=None, parent=None):
    row = {
        "id": eid,
        "title": "Entry",
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

    def test_scope_work_prefixes_question(self):
        q = augment_question_with_scope_work("who is Character A?", "Ashford Saga")
        self.assertIn("Ashford Saga", q)
        self.assertTrue(q.lower().startswith("in ashford saga"))


if __name__ == "__main__":
    unittest.main()
