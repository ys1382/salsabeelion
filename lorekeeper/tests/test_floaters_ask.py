"""Tests for floaters Ask clarify / topic / no-clash (synthetic only)."""
from __future__ import annotations

import json
import unittest

from lorekeeper_floaters_ask import (
    FLOATERS_CLARIFY_MIN,
    answer_floaters_ask,
    cluster_floaters_no_clash,
    extract_floaters_topic,
    filter_floaters_by_topic,
)
from lorekeeper_recall import recall_from_user_data


def _note(nid: str, title: str, body: str = "", *, tags: list[str] | None = None):
    return {
        "id": nid,
        "title": title,
        "body": body,
        "tags": tags or [],
        "kind": "note",
    }


class FloatersConversationTests(unittest.TestCase):
    def test_topic_extract(self):
        self.assertEqual(
            extract_floaters_topic("i want everything regarding princesses in my notes"),
            "princesses",
        )
        self.assertIn("cactus", extract_floaters_topic("floating notes about cactus with eyes"))

    def test_topic_filter(self):
        notes = [
            _note("1", "Spark", "frog princess idea"),
            _note("2", "Other", "dragon scales"),
            _note("3", "Work", "princess", tags=["Ice and Fire"]),
        ]
        from lorekeeper_work_membership import filter_entries_floaters_only

        floaters = filter_entries_floaters_only(notes)
        hits = filter_floaters_by_topic(floaters, "princesses")
        self.assertEqual([h["id"] for h in hits], ["1"])

    def test_no_clash_clusters(self):
        notes = [
            _note("g", "Girl lead", "The protagonist is a girl who talks to frogs."),
            _note("b", "Boy lead", "The protagonist is a boy with a secret."),
            _note("n", "Neutral", "cactus with eyes on the windowsill"),
        ]
        buckets = cluster_floaters_no_clash(notes)
        self.assertEqual({e["id"] for e in buckets["female"]}, {"g"})
        self.assertEqual({e["id"] for e in buckets["male"]}, {"b"})
        self.assertEqual({e["id"] for e in buckets["uncommitted"]}, {"n"})

    def test_clarify_when_pile_large(self):
        notes = [
            _note(str(i), f"Idea {i}", f"scrap {i}") for i in range(FLOATERS_CLARIFY_MIN)
        ]
        hit = answer_floaters_ask("Give me all my floating ideas", notes)
        self.assertIsNotNone(hit)
        assert hit is not None
        self.assertIn("What should Ask gather", hit["answer"])
        self.assertEqual(
            hit.get("askContinue"),
            {"scope": "floaters", "stage": "awaiting_narrow"},
        )

    def test_followup_topic(self):
        notes = [
            _note("1", "Spark", "princess in the tower"),
            _note("2", "Other", "dragon"),
        ] + [_note(str(i), f"Pad {i}", "misc") for i in range(3, 12)]
        cont = {"scope": "floaters", "stage": "awaiting_narrow"}
        hit = answer_floaters_ask(
            "princesses",
            notes,
            ask_continue=cont,
        )
        self.assertIsNotNone(hit)
        assert hit is not None
        self.assertIn("princess", hit["answer"].lower())
        self.assertNotIn("dragon", hit["answer"].lower())
        self.assertIsNone(hit.get("askContinue"))

    def test_followup_no_clash(self):
        notes = [
            _note("g", "A", "The protagonist is a girl."),
            _note("b", "B", "The protagonist is a boy."),
        ]
        hit = answer_floaters_ask(
            "only notes that don't contradict each other",
            notes,
            ask_continue={"scope": "floaters", "stage": "awaiting_narrow"},
        )
        self.assertIsNotNone(hit)
        assert hit is not None
        self.assertIn("Pile A", hit["answer"])
        self.assertIn("Pile B", hit["answer"])

    def test_recall_followup_end_to_end(self):
        notes = [
            _note("1", "Cactus", "cactus with eyes"),
            _note("2", "Tagged", "cactus", tags=["Ice and Isolation"]),
        ] + [_note(f"p{i}", f"Pad {i}", f"pad body {i}") for i in range(10)]
        user_data = {"lorekeeper_entries_v1": json.dumps(notes)}
        first = recall_from_user_data(
            "Give me all my floating ideas",
            user_data,
        )
        self.assertTrue(first.get("ok"))
        self.assertTrue(first.get("askContinue"))
        second = recall_from_user_data(
            "cactus with eyes",
            user_data,
            ask_continue=first.get("askContinue"),
        )
        self.assertTrue(second.get("ok"))
        self.assertIn("Cactus", second.get("answer") or "")
        self.assertNotIn("Tagged", second.get("answer") or "")
        self.assertIsNone(second.get("askContinue"))


if __name__ == "__main__":
    unittest.main()
