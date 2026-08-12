"""Draft-foothold reminders — update-notes nudge + task-list future filter."""
from __future__ import annotations

import json
import unittest

from lorekeeper_note_reminders import (
    collect_update_notes_nudges,
    filter_tasks_by_draft_foothold,
    is_unintroduced_future_scene,
)
from lorekeeper_recall import recall_from_user_data


def _entry(eid, title, body, *, kind="note", tags=None):
    return {
        "id": eid,
        "title": title,
        "body": body,
        "tags": tags or ["Smoke and Mirrors"],
        "kind": kind,
        "createdAt": 1,
        "updatedAt": 1,
    }


class NoteReminderTests(unittest.TestCase):
    def test_drops_unintroduced_future_scene(self):
        draft = _normalize_draft(
            "Etherei ran from Serias. The wolf carried him down the path."
        )
        self.assertTrue(
            is_unintroduced_future_scene(
                "Facing the music at Tenebris's place will be awkward.",
                draft_norm=draft,
            )
        )
        self.assertFalse(
            is_unintroduced_future_scene(
                "Find a way to write the chase swiftly but not hastily.",
                draft_norm=draft,
            )
        )

    def test_filter_removes_facing_music_without_draft_scene(self):
        entries = [
            _entry(
                "n1",
                "Later",
                "Facing the music at Tenebris's place — Etherei as a guest.",
            ),
            _entry(
                "n2",
                "Chase",
                "Find a way to write the chase swiftly but not hastily.",
            ),
            _entry(
                "d1",
                "Draft",
                "Etherei bolted sideways. Serias the Wolf chased him along the ridge.",
                kind="document",
            ),
        ]
        items = [
            {
                "entryId": "n1",
                "noteTitle": "Later",
                "line": "Facing the music at Tenebris's place — Etherei as a guest.",
            },
            {
                "entryId": "n2",
                "noteTitle": "Chase",
                "line": "Find a way to write the chase swiftly but not hastily.",
            },
        ]
        kept = filter_tasks_by_draft_foothold(items, entries)
        joined = " ".join(r["line"].lower() for r in kept)
        self.assertIn("chase", joined)
        self.assertNotIn("facing the music", joined)

    def test_update_nudge_when_flashback_already_in_draft(self):
        entries = [
            _entry(
                "n1",
                "POV",
                "Obsidian has a fractured-shattered flashback similar to Stygian's, "
                "but different memory and reveals additional secrets about Etherei "
                "and Obsidian himself.",
            ),
            _entry(
                "d1",
                "Draft",
                "Obsidian staggered as a fractured flashback of childhood hit him "
                "on the chase. Etherei kept running.",
                kind="document",
            ),
        ]
        nudges = collect_update_notes_nudges(
            entries,
            unused_rows=[
                {
                    "entryId": "n1",
                    "noteTitle": "POV",
                    "line": "Obsidian has a fractured-shattered flashback similar to "
                    "Stygian's, but different memory and reveals additional secrets "
                    "about Etherei and Obsidian himself.",
                }
            ],
        )
        self.assertTrue(nudges)
        self.assertIn("update your notes?", nudges[0].lower())
        self.assertIn("obsidian", nudges[0].lower())
        self.assertIn("flashback", nudges[0].lower())

    def test_no_nudge_for_pure_future_tenebris_scene(self):
        entries = [
            _entry(
                "n1",
                "Later",
                "Facing the music at Tenebris's place will change everything.",
            ),
            _entry(
                "d1",
                "Draft",
                "Serias carried Etherei down the mountain path.",
                kind="document",
            ),
        ]
        nudges = collect_update_notes_nudges(
            entries,
            unused_rows=[
                {
                    "entryId": "n1",
                    "noteTitle": "Later",
                    "line": "Facing the music at Tenebris's place will change everything.",
                }
            ],
        )
        self.assertEqual(nudges, [])

    def test_task_list_includes_nudge_block(self):
        entries = [
            _entry(
                "n1",
                "POV",
                "Obsidian has a fractured-shattered flashback similar to Stygian's, "
                "but different memory and reveals additional secrets about Etherei "
                "and Obsidian himself.",
            ),
            _entry(
                "n2",
                "Chase",
                "Find a way to write the chase swiftly but not hastily.",
            ),
            _entry(
                "d1",
                "Draft",
                "Obsidian staggered as a fractured flashback of childhood hit him. "
                "Etherei ran from Serias along the mountain path.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for Etherei",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertIn("note check", answer)
        self.assertIn("update your notes?", answer)
        self.assertIn("chase", answer)


def _normalize_draft(text: str) -> str:
    from lorekeeper_notes_vs_draft import _normalize

    return _normalize(text)


if __name__ == "__main__":
    unittest.main()
