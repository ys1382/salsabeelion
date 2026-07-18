"""Tests for doc/work note membership (synthetic only)."""
from __future__ import annotations

import json
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


class FloatersAskTests(unittest.TestCase):
    def test_detect_floaters_phrasing(self):
        from lorekeeper_work_membership import (
            is_floaters_inventory_question,
            is_floaters_question,
        )

        self.assertTrue(is_floaters_question("give me all my floating ideas"))
        self.assertTrue(is_floaters_question("summarize my unspecified notes"))
        self.assertTrue(is_floaters_inventory_question("list my jumbled ideas"))
        self.assertFalse(is_floaters_question("who is Character A in Ice and Fire"))

    def test_floaters_filter_excludes_work_tagged(self):
        from lorekeeper_work_membership import filter_entries_floaters_only

        notes = [
            _note("a", "Spark", body="frog princess secret"),
            _note("b", "Saga bit", tags=["Ice and Fire"], body="tagged plot"),
            _note("c", "Idk", tags=["idk"], body="maybe later"),
            _note("d", "Doc", kind="document", body="manuscript"),
        ]
        ids = {n["id"] for n in filter_entries_floaters_only(notes)}
        self.assertEqual(ids, {"a", "c"})

    def test_digest_lists_all_and_skips_tagged(self):
        from lorekeeper_work_membership import compose_floaters_digest

        notes = [
            _note("1", "Frog princess", body="The prince's secret identity is a swan."),
            _note("2", "Work only", tags=["Ice and Isolation"], body="should not appear"),
            _note("3", "Empty spark"),
        ]
        answer, ids = compose_floaters_digest(notes)
        self.assertIn("Frog princess", answer)
        self.assertIn("swan", answer)
        self.assertIn("Empty spark", answer)
        self.assertNotIn("should not appear", answer)
        self.assertNotIn("Work only", answer)
        self.assertEqual(set(ids), {"1", "3"})

    def test_recall_floaters_inventory(self):
        from lorekeeper_recall import recall_from_user_data

        user_data = {
            "lorekeeper_entries_v1": json.dumps(
                [
                    {
                        "id": "f1",
                        "title": "Frog princess",
                        "body": "Prince has a secret identity.",
                        "tags": [],
                        "kind": "note",
                    },
                    {
                        "id": "w1",
                        "title": "Isolation plot",
                        "body": "Tagged work beat.",
                        "tags": ["Ice and Isolation"],
                        "kind": "note",
                    },
                ]
            )
        }
        res = recall_from_user_data(
            "Give me all my floating ideas in a clear and concise manner",
            user_data,
            mode="full",
        )
        self.assertTrue(res.get("ok"))
        self.assertEqual(res.get("recallScope"), "floaters")
        self.assertIn("Frog princess", res.get("answer") or "")
        self.assertIn("secret identity", res.get("answer") or "")
        self.assertNotIn("Tagged work beat", res.get("answer") or "")
        self.assertNotIn("Isolation plot", res.get("answer") or "")


if __name__ == "__main__":
    unittest.main()
