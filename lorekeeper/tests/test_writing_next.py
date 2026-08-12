"""Writing-next Ask — short task list from notes not in draft (synthetic only)."""
from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from lorekeeper_recall import recall_from_user_data
from lorekeeper_work_recall import route_question
from lorekeeper_writing_next import (
    MAX_TASK_ITEMS,
    claim_is_write_next_task,
    compose_writing_next_task_list,
    extract_writing_next_topic,
    is_writing_next_task_list_question,
)


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


class WritingNextDetectionTests(unittest.TestCase):
    def test_task_list_phrases(self):
        self.assertTrue(
            is_writing_next_task_list_question(
                "In Smoke and Mirrors, list my task list"
            )
        )
        self.assertTrue(
            is_writing_next_task_list_question(
                "What should I write next in Smoke and Mirrors?"
            )
        )
        self.assertTrue(
            is_writing_next_task_list_question(
                "Can you tell me my Smoke and Mirrors task list?"
            )
        )
        self.assertEqual(
            route_question("In Smoke and Mirrors, list my task list"),
            "writing_next",
        )

    def test_does_not_steal_leave_off_or_who(self):
        self.assertFalse(
            is_writing_next_task_list_question(
                "Where did I leave off in the main draft in terms of plot?"
            )
        )
        self.assertFalse(is_writing_next_task_list_question("Who is Character A?"))
        self.assertFalse(
            is_writing_next_task_list_question(
                "What's in my notes but not in the main document?"
            )
        )

    def test_topic_for_chase(self):
        q = "In Smoke and Mirrors, task list for the chase scene"
        self.assertEqual(extract_writing_next_topic(q).lower(), "the chase scene")

    def test_topic_for_politics(self):
        q = "task list about Predator Court politics"
        self.assertIn("predator court", extract_writing_next_topic(q).lower())


class WritingNextAnswerTests(unittest.TestCase):
    def test_lists_unused_note_as_bullet_task(self):
        entries = [
            _entry(
                "n1",
                "Court notes",
                "Character D deeply cares for Character T but resents him for "
                "not helping out in court, but also understands why Character T "
                "is disgusted by Predator Court politics.",
            ),
            _entry(
                "n2",
                "Chase scraps",
                "The chase needs ice on the mountain path and a snapped bridge rope.",
            ),
            _entry(
                "d1",
                "Main draft",
                "Character D walked through the hall and nodded once. "
                "Then Character D left for the gardens.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, list my task list",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        self.assertEqual(res.get("questionKind"), "writing_next")
        answer = res.get("answer") or ""
        self.assertIn("task list", answer.lower())
        self.assertIn("•", answer)
        self.assertIn("character d", answer.lower())
        self.assertIn("predator court", answer.lower())
        self.assertNotIn("SOURCE", answer)

    def test_topic_filter_keeps_chase_only(self):
        entries = [
            _entry(
                "n1",
                "Court",
                "Character D resents Character T for skipping Predator Court duties.",
            ),
            _entry(
                "n2",
                "Chase",
                "The chase scene needs a snapped bridge rope over the gorge.",
            ),
            _entry(
                "d1",
                "Draft",
                "They sat quietly in the manor library until dusk.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for the chase scene",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "writing_next")
        self.assertIn("bridge rope", answer)
        self.assertNotIn("predator court", answer)

    def test_caps_at_max_and_mentions_more(self):
        note_lines = [
            f"Unused plot beat number {i} about the silver lantern ritual."
            for i in range(1, 14)
        ]
        entries = [
            _entry("n1", "Pile", "\n".join(note_lines)),
            _entry(
                "d1",
                "Draft",
                "She opened the door and stepped into rain.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, what should I write next?",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = res.get("answer") or ""
        bullets = [ln for ln in answer.splitlines() if ln.strip().startswith("•")]
        self.assertLessEqual(len(bullets), MAX_TASK_ITEMS)
        self.assertIn("more", answer.lower())

    def test_leave_off_adjacent_ranks_higher(self):
        entries = [
            _entry(
                "n1",
                "Far future",
                "Years later planned: write the empire collapse after the treaty fails.",
            ),
            _entry(
                "n2",
                "Near now",
                "Need to write Character E's secret dread of what Lord Character T "
                "intends after the mountain path.",
            ),
            _entry(
                "d1",
                "Draft",
                "Character E stumbled down the mountain path in Character S's grasp. "
                "The mountain path wound toward the manor.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, my task list",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = res.get("answer") or ""
        bullets = [ln for ln in answer.splitlines() if ln.strip().startswith("•")]
        self.assertGreaterEqual(len(bullets), 1)
        self.assertIn("dread", bullets[0].lower())

    def test_compose_shape(self):
        out = compose_writing_next_task_list(
            {"Smoke and Mirrors"},
            [
                {
                    "entryId": "1",
                    "noteTitle": "Court",
                    "line": "Character D cares for Character T but resents Court load.",
                }
            ],
            has_notes=True,
            has_draft=True,
            topic="",
            total_before_cap=1,
        )
        self.assertIn("Here's a short task list", out)
        self.assertIn("•", out)
        self.assertIn("write-next", out.lower())

    def test_drops_continuity_awareness_and_trailoffs(self):
        entries = [
            _entry(
                "n1",
                "Awareness",
                "Character E is aware that the Cheshire Cat does not yet want him dead "
                "(or else he could have killed him that day when he first got bit--and even if that delay was…",
            ),
            _entry(
                "n2",
                "Standing",
                "Character E is known by the name Chroniker by the Cheshire Cat and those he trusts.",
            ),
            _entry(
                "n3",
                "Dramatize",
                "Character D deeply cares for Character T but resents him for not helping "
                "out in court under political pressures.",
            ),
            _entry(
                "d1",
                "Draft",
                "Character D walked through the hall and nodded once.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for Character E",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "writing_next")
        self.assertNotIn("does not yet want him dead", answer)
        self.assertNotIn("chroniker", answer)
        # Topic Character E — Dijon-style note may be filtered out by topic;
        # honest empty / unused-but-not-tasks is fine.
        self.assertTrue(
            "write-next" in answer
            or "continuity" in answer
            or "nothing clear" in answer
        )

    def test_keeps_dijon_style_bitterness_on_general_list(self):
        entries = [
            _entry(
                "n1",
                "Awareness",
                "Character E is aware that Character T does not yet want him dead.",
            ),
            _entry(
                "n2",
                "Court",
                "Character D deeply cares for Character T but resents him for leaving "
                "him to dry with political pressures at Court.",
            ),
            _entry(
                "d1",
                "Draft",
                "They crossed the plaza at noon without speaking.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, list my task list",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertIn("resents", answer)
        self.assertIn("political", answer)
        self.assertNotIn("does not yet want him dead", answer)

    def test_claim_filter_unit(self):
        self.assertFalse(
            claim_is_write_next_task(
                "Character E is aware that the Cat does not yet want him dead "
                "(or else he could have killed him--and even if that delay was…"
            )
        )
        self.assertFalse(
            claim_is_write_next_task(
                "Character E is known by the name Chroniker by the Cat."
            )
        )
        self.assertTrue(
            claim_is_write_next_task(
                "Character D cares for Character T but resents him for not helping "
                "with Court political pressures."
            )
        )
        self.assertTrue(
            claim_is_write_next_task(
                "The chase scene needs a snapped bridge rope over the gorge."
            )
        )

    def test_local_only_no_rag(self):
        entries = [
            _entry("n1", "Idea", "A secret tunnel under the glass market."),
            _entry(
                "d1",
                "Draft",
                "They crossed the plaza at noon.",
                kind="document",
            ),
        ]
        with patch(
            "lorekeeper_recall.answer_with_rag",
            side_effect=AssertionError("RAG must not run for writing_next"),
        ):
            res = recall_from_user_data(
                "In Smoke and Mirrors, task list",
                {"lorekeeper_entries_v1": json.dumps(entries)},
            )
        self.assertEqual(res.get("questionKind"), "writing_next")
        self.assertEqual(res.get("recallEngine"), "local")
        self.assertIn("tunnel", (res.get("answer") or "").lower())


if __name__ == "__main__":
    unittest.main()
