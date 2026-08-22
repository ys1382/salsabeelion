"""Stale shorter note lists must not wipe notes on bulk save."""
from __future__ import annotations

import json
import unittest

from lorekeeper_api import merge_entries_payload


def _note(nid: str, title: str, updated: int = 1) -> dict:
    return {"id": nid, "title": title, "body": title, "tags": [], "updatedAt": updated}


class EntriesMergeTests(unittest.TestCase):
    def test_stale_short_list_keeps_missing_notes(self):
        stored = [_note("a", "Keep A"), _note("b", "Keep B"), _note("c", "Keep C")]
        incoming = [_note("a", "Keep A")]
        merged = json.loads(merge_entries_payload(json.dumps(stored), json.dumps(incoming)))
        ids = [row["id"] for row in merged]
        self.assertEqual(set(ids), {"a", "b", "c"})

    def test_deleting_one_note_is_allowed(self):
        stored = [_note("a", "A"), _note("b", "B")]
        incoming = [_note("a", "A")]
        merged = json.loads(merge_entries_payload(json.dumps(stored), json.dumps(incoming)))
        self.assertEqual([row["id"] for row in merged], ["a"])

    def test_deleting_two_notes_at_once_keeps_them(self):
        stored = [_note("a", "A"), _note("b", "B"), _note("c", "C")]
        incoming = [_note("a", "A")]
        merged = json.loads(merge_entries_payload(json.dumps(stored), json.dumps(incoming)))
        self.assertEqual({row["id"] for row in merged}, {"a", "b", "c"})

    def test_newer_updated_at_wins_for_same_id(self):
        stored = [_note("a", "Old", updated=10)]
        incoming = [_note("a", "New", updated=20)]
        merged = json.loads(merge_entries_payload(json.dumps(stored), json.dumps(incoming)))
        self.assertEqual(merged[0]["title"], "New")
        stored_newer = [_note("a", "Server newer", updated=30)]
        incoming_older = [_note("a", "Phone older", updated=5)]
        merged2 = json.loads(
            merge_entries_payload(json.dumps(stored_newer), json.dumps(incoming_older))
        )
        self.assertEqual(merged2[0]["title"], "Server newer")

    def test_new_incoming_note_is_added(self):
        stored = [_note("a", "A")]
        incoming = [_note("a", "A"), _note("b", "B")]
        merged = json.loads(merge_entries_payload(json.dumps(stored), json.dumps(incoming)))
        self.assertEqual([row["id"] for row in merged], ["a", "b"])

    def test_empty_incoming_does_not_wipe_store(self):
        stored = [_note("a", "A"), _note("b", "B"), _note("c", "C")]
        merged = json.loads(merge_entries_payload(json.dumps(stored), "[]"))
        self.assertEqual({row["id"] for row in merged}, {"a", "b", "c"})


if __name__ == "__main__":
    unittest.main()
