"""Catch-up gather Ask — thin-draft orientation brief (synthetic only)."""
from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from lorekeeper_catchup_gather import (
    compose_catchup_gather,
    is_catchup_gather_question,
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
        "tags": tags or ["The Waking Dream"],
        "kind": kind,
        "createdAt": 1,
        "updatedAt": 1,
    }


class CatchupDetectionTests(unittest.TestCase):
    def test_catchup_phrases(self):
        phrases = [
            "In The Waking Dream, catch me up",
            "What have I got so far for The Waking Dream?",
            "What do I already have in The Waking Dream?",
            "Remind me what I have for The Waking Dream",
            "Reorient me on The Waking Dream",
            "Gather what I already have for The Waking Dream",
            "Catch-up gather for The Waking Dream",
            "Orientation brief for this work",
        ]
        for q in phrases:
            self.assertTrue(is_catchup_gather_question(q), q)
            self.assertEqual(route_question(q), "catchup_gather", q)

    def test_does_not_steal_neighbors(self):
        self.assertFalse(
            is_catchup_gather_question(
                "Where did I leave off in the main draft in terms of plot?"
            )
        )
        self.assertFalse(is_catchup_gather_question("Who is Character A?"))
        self.assertFalse(
            is_catchup_gather_question(
                "What should I write next in The Waking Dream?"
            )
        )
        self.assertFalse(
            is_catchup_gather_question(
                "What's in my notes but not in the main document?"
            )
        )
        self.assertFalse(
            is_catchup_gather_question(
                "What's not written yet in The Waking Dream?"
            )
        )
        self.assertEqual(
            route_question(
                "Where did I leave off in the main draft in terms of plot?"
            ),
            "resume",
        )
        self.assertEqual(
            route_question("What should I write next in The Waking Dream?"),
            "writing_next",
        )


class CatchupAnswerTests(unittest.TestCase):
    def test_gathers_cast_beats_open_scraps(self):
        entries = [
            _entry(
                "n1",
                "Mira",
                "Mira is a quiet cartographer who maps dream-edges.",
            ),
            _entry(
                "n2",
                "Open questions",
                "open: Does the lighthouse remember her?\n"
                "Not sure yet whether the tide is a character.",
            ),
            _entry(
                "n3",
                "Scraps",
                "planned: a fog market scene\n"
                "planned: letter from the absent twin",
            ),
            _entry(
                "d1",
                "The Waking Dream",
                "Mira woke on the pier with salt in her mouth. "
                "The lighthouse beam stuttered once, then held.",
                kind="document",
            ),
        ]
        data = {"lorekeeper_entries_v1": json.dumps(entries)}
        with patch("lorekeeper_recall.answer_with_rag") as rag:
            rag.side_effect = AssertionError("RAG must not run for catchup_gather")
            res = recall_from_user_data(
                "In The Waking Dream, what have I got so far?",
                data,
                scope={"mode": "work", "workTitle": "The Waking Dream"},
            )
        self.assertTrue(res.get("ok"))
        self.assertEqual(res.get("questionKind"), "catchup_gather")
        ans = str(res.get("answer") or "")
        low = ans.lower()
        self.assertIn("catch-up", low)
        self.assertIn("mira", low)
        self.assertIn("lighthouse", low)
        self.assertIn("open", low)
        self.assertIn("fog market", low)
        self.assertIn("nothing invented", low)
        self.assertNotIn("SOURCE", ans)
        # Orientation — not a write-next task list opener.
        self.assertNotIn("write-next items", low)

    def test_honest_empty_when_nothing_saved(self):
        # Other work exists — this silo is empty.
        entries = [
            _entry(
                "n_other",
                "Etherei",
                "Etherei is a white rabbit twin.",
                tags=["Smoke and Mirrors"],
            ),
        ]
        data = {"lorekeeper_entries_v1": json.dumps(entries)}
        res = recall_from_user_data(
            "Catch me up on The Waking Dream",
            data,
            scope={"mode": "work", "workTitle": "The Waking Dream"},
        )
        self.assertTrue(res.get("ok"))
        self.assertEqual(res.get("questionKind"), "catchup_gather")
        low = str(res.get("answer") or "").lower()
        self.assertTrue(
            "nothing saved" in low or "no notes and no main draft" in low,
            res.get("answer"),
        )
        self.assertNotIn("etherei", low)

    def test_work_scope_does_not_mix_silos(self):
        entries = [
            _entry(
                "n1",
                "Mira",
                "Mira is a quiet cartographer.",
                tags=["The Waking Dream"],
            ),
            _entry(
                "n2",
                "Etherei",
                "Etherei is a white rabbit twin.",
                tags=["Smoke and Mirrors"],
            ),
            _entry(
                "d1",
                "The Waking Dream",
                "Mira woke on the pier.",
                tags=["The Waking Dream"],
                kind="document",
            ),
        ]
        data = {"lorekeeper_entries_v1": json.dumps(entries)}
        res = recall_from_user_data(
            "In The Waking Dream, catch me up",
            data,
            scope={"mode": "work", "workTitle": "The Waking Dream"},
        )
        ans = str(res.get("answer") or "")
        self.assertIn("Mira", ans)
        self.assertNotIn("Etherei", ans)
        self.assertNotIn("white rabbit", ans.lower())

    def test_compose_shape_has_four_sections(self):
        sections = {
            "cast": [{"entryId": "1", "noteTitle": "Mira", "line": "Mira — Mira is a cartographer"}],
            "beats": [{"entryId": "d", "noteTitle": "Main draft", "line": "Mira woke on the pier."}],
            "open": [{"entryId": "2", "noteTitle": "Q", "line": "open: Does the lighthouse remember her?"}],
            "scraps": [{"entryId": "3", "noteTitle": "S", "line": "planned: a fog market scene"}],
        }
        out = compose_catchup_gather(
            {"The Waking Dream"},
            sections,
            has_notes=True,
            has_draft=True,
        )
        low = out.lower()
        self.assertIn("cast", low)
        self.assertIn("draft so far", low)
        self.assertIn("open questions", low)
        self.assertIn("planned scraps", low)
        self.assertIn("leave-off", low)
        self.assertIn("write-next", low)


if __name__ == "__main__":
    unittest.main()
