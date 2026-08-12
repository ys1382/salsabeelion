"""Catch-up gather Ask — thin-draft orientation brief (synthetic + gold baseline)."""
from __future__ import annotations

import json
import unittest
from pathlib import Path
from unittest.mock import patch

from lorekeeper_catchup_gather import (
    CATCHUP_GOLD_BASELINE_MARKERS,
    answer_looks_at_or_above_catchup_baseline,
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
            "Get me caught up on this work so far",
            "Get me caught up with this story",
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
        self.assertEqual(
            route_question(
                "Where did I leave off in the main draft in terms of plot?"
            ),
            "resume",
        )


class CatchupGoldBaselineTests(unittest.TestCase):
    def test_owner_gold_baseline_shape_locked(self):
        """Never worse than the 2026-08-12 owner catch-up answer."""
        gold_path = (
            Path(__file__).resolve().parent
            / "fixtures"
            / "catchup_waking_dream_gold.txt"
        )
        gold = gold_path.read_text(encoding="utf-8").strip()
        self.assertTrue(gold)
        self.assertTrue(answer_looks_at_or_above_catchup_baseline(gold))
        low = gold.lower()
        for marker in CATCHUP_GOLD_BASELINE_MARKERS:
            self.assertIn(marker, low, f"missing baseline marker: {marker}")
        # Continuous planning brief — not section cards.
        self.assertNotRegex(gold, r"(?mi)^Cast\s*$")
        self.assertNotRegex(gold, r"(?mi)^Draft so far\s*$")
        self.assertLess(gold.count("•"), 2)
        # Density floor of the locked “perfect” premise catch-up sample.
        self.assertGreaterEqual(len(gold), 1400)
        self.assertIn("brought her", low)
        self.assertIn("cannot simply leave", low)
        self.assertIn("from your notes only", low)


class CatchupAnswerTests(unittest.TestCase):
    def test_local_includes_boss_origin_entry(self):
        entries = [
            _entry(
                "n_boss",
                "Vesper",
                "Vesper is the mafia-esque boss of the domain — main antagonist. "
                "Notes are thin: he keeps a softer side he has never willingly disclosed.",
            ),
            _entry(
                "n_origin",
                "Elara start",
                "Before this adventure Elara started out in the human world as a quiet author.",
            ),
            _entry(
                "n_entry",
                "Entry",
                "The Finch brought her there under the premise of taking her somewhere "
                "she could get something she needed; accepting the offer was its own danger. "
                "That is why she winds up in Vesper's domain.",
            ),
            _entry(
                "n_stay",
                "Can't leave yet",
                "She can't leave too quickly — leaving now would arouse suspicion from "
                "the Finch or his leader, and a slip could unmask her.",
            ),
            _entry(
                "d1",
                "The Waking Dream",
                "Elara is now inside the main antagonist's domain and must find a way out "
                "without being discovered. Identity concealment is the immediate pressure.",
                kind="document",
            ),
        ]
        data = {"lorekeeper_entries_v1": json.dumps(entries)}
        # Force local path (no RAG) to exercise completeness gather.
        with patch("lorekeeper_recall.rag_enabled", return_value=False), patch(
            "lorekeeper_recall.answer_with_rag"
        ) as rag:
            rag.side_effect = AssertionError("RAG disabled for this test")
            res = recall_from_user_data(
                "Get me caught up with this story so far",
                data,
                scope={"mode": "work", "workTitle": "The Waking Dream"},
            )
        self.assertTrue(res.get("ok"))
        self.assertEqual(res.get("questionKind"), "catchup_gather")
        ans = str(res.get("answer") or "")
        low = ans.lower()
        self.assertTrue(answer_looks_at_or_above_catchup_baseline(ans), ans)
        self.assertIn("vesper", low)
        self.assertIn("human world", low)
        self.assertIn("finch", low)
        self.assertIn("premise", low)
        self.assertTrue(
            "can't leave" in low
            or "cannot leave" in low
            or "leave too quickly" in low,
            ans,
        )
        self.assertNotIn("SOURCE", ans)
        self.assertNotRegex(ans, r"(?mi)^Cast\s*$")

    def test_work_scope_does_not_mix_silos(self):
        entries = [
            _entry(
                "n1",
                "Mira",
                "Mira is a quiet cartographer. Before this adventure she started out by the pier.",
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
                "Mira woke on the pier inside a watched domain.",
                tags=["The Waking Dream"],
                kind="document",
            ),
        ]
        data = {"lorekeeper_entries_v1": json.dumps(entries)}
        with patch("lorekeeper_recall.rag_enabled", return_value=False), patch(
            "lorekeeper_recall.answer_with_rag",
            side_effect=AssertionError("no rag"),
        ):
            res = recall_from_user_data(
                "In The Waking Dream, catch me up",
                data,
                scope={"mode": "work", "workTitle": "The Waking Dream"},
            )
        ans = str(res.get("answer") or "")
        self.assertIn("Mira", ans)
        self.assertNotIn("Etherei", ans)

    def test_honest_empty_when_nothing_saved(self):
        entries = [
            _entry(
                "n_other",
                "Etherei",
                "Etherei is a white rabbit twin.",
                tags=["Smoke and Mirrors"],
            ),
        ]
        data = {"lorekeeper_entries_v1": json.dumps(entries)}
        with patch("lorekeeper_recall.rag_enabled", return_value=False), patch(
            "lorekeeper_recall.answer_with_rag",
            side_effect=AssertionError("no rag"),
        ):
            res = recall_from_user_data(
                "Catch me up on The Waking Dream",
                data,
                scope={"mode": "work", "workTitle": "The Waking Dream"},
            )
        self.assertEqual(res.get("questionKind"), "catchup_gather")
        low = str(res.get("answer") or "").lower()
        self.assertTrue(
            "nothing saved" in low or "no notes and no main draft" in low,
            res.get("answer"),
        )
        self.assertNotIn("etherei", low)

    def test_compose_is_continuous_brief_not_section_cards(self):
        sections = {
            "cast": [
                {
                    "entryId": "1",
                    "noteTitle": "Mira",
                    "line": "Mira — Mira is a cartographer",
                }
            ],
            "beats": [
                {
                    "entryId": "d",
                    "noteTitle": "Main draft",
                    "line": "Mira woke on the pier inside a watched domain.",
                }
            ],
            "boss": [
                {
                    "entryId": "b",
                    "noteTitle": "Vesper",
                    "line": "Vesper is the mafia-esque boss of the domain.",
                }
            ],
            "origin": [
                {
                    "entryId": "o",
                    "noteTitle": "Start",
                    "line": "Before this adventure Mira started out by the pier markets.",
                }
            ],
            "entry": [
                {
                    "entryId": "e",
                    "noteTitle": "Entry",
                    "line": "The Finch brought her there under a false-needed errand.",
                }
            ],
            "open": [],
            "scraps": [],
        }
        out = compose_catchup_gather(
            {"The Waking Dream"},
            sections,
            has_notes=True,
            has_draft=True,
        )
        self.assertTrue(answer_looks_at_or_above_catchup_baseline(out), out)
        low = out.lower()
        self.assertIn("vesper", low)
        self.assertIn("before this adventure", low)
        self.assertIn("finch", low)
        self.assertNotRegex(out, r"(?mi)^Cast\s*$")


if __name__ == "__main__":
    unittest.main()
