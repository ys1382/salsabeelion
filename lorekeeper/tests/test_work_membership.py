"""Tests for doc/work note membership (synthetic only)."""
from __future__ import annotations

import unittest

from lorekeeper_work_membership import (
    filter_entries_visible_for_work,
    note_excludes_work,
    note_is_unassigned,
    note_visible_for_work,
)


def _note(nid: str, title: str, body: str = "", *, tags: list[str] | None = None, **extra):
    e = {
        "id": nid,
        "title": title,
        "body": body,
        "tags": tags or [],
        "kind": "note",
    }
    e.update(extra)
    return e


class WorkMembershipTests(unittest.TestCase):
    def test_other_work_hidden(self):
        isolation = "Ice and Isolation"
        notes = [
            _note("a", "Belong", tags=["Ice and Isolation"]),
            _note("b", "Other saga", tags=["Ice and Fire"]),
            _note("c", "Floating idea", body="idk which work this belongs to"),
            _note(
                "d",
                "Ruled out",
                body="idk what this is but it doesn't belong in Ice and Isolation",
            ),
            _note("e", "Not tag", tags=["not:Ice and Isolation"]),
            _note("f", "Linked", linkedDocId="d_iso"),
        ]
        visible = filter_entries_visible_for_work(notes, isolation, document_id="d_iso")
        ids = {n["id"] for n in visible}
        self.assertEqual(ids, {"a", "c", "f"})

    def test_unassigned_empty_tags(self):
        self.assertTrue(note_is_unassigned(_note("1", "Idea")))
        self.assertFalse(note_is_unassigned(_note("2", "Idea", tags=["Ice and Fire"])))

    def test_exclude_phrases(self):
        n = _note(
            "1",
            "Twist",
            "idk what this is but it doesn't belong in Ice and Isolation",
        )
        self.assertTrue(note_excludes_work(n, "Ice and Isolation"))
        self.assertFalse(note_excludes_work(n, "Ice and Fire"))

    def test_belongs_shows_even_if_exclude_other(self):
        n = _note(
            "1",
            "Fire note",
            "doesn't belong in Ice and Isolation",
            tags=["Ice and Fire"],
        )
        self.assertTrue(note_visible_for_work(n, "Ice and Fire"))
        self.assertFalse(note_visible_for_work(n, "Ice and Isolation"))


if __name__ == "__main__":
    unittest.main()
