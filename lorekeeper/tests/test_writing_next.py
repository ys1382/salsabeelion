"""Writing-next Ask — short task list from notes not in draft (synthetic only)."""
from __future__ import annotations

import json
import re
import unittest
from unittest.mock import patch

from lorekeeper_recall import recall_from_user_data
from lorekeeper_work_recall import route_question
from lorekeeper_writing_next import (
    MAX_TASK_ITEMS,
    assign_plan_recall_frames,
    claim_is_write_next_task,
    compose_writing_next_task_list,
    densify_task_phrasing,
    extract_writing_next_span,
    extract_writing_next_topic,
    frame_plan_recall,
    is_writing_next_task_list_question,
    line_is_later_book,
    plan_recall_core,
    restate_as_task_line,
    topic_looks_like_cast,
    topic_looks_like_moment,
    wants_later_book_scope,
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

    def test_moment_topics_are_not_cast(self):
        for q, expect in (
            ("task list for this chapter", "this chapter"),
            ("task list for this capture", "this capture"),
            ("task list for this Court scene", "this court scene"),
            ("task list for this moment", "this moment"),
            ("In Smoke and Mirrors, task list for chapter 2", "chapter 2"),
            ("task list for the manor scene", "the manor scene"),
        ):
            topic = extract_writing_next_topic(q)
            self.assertEqual(topic.lower(), expect, msg=q)
            self.assertTrue(topic_looks_like_moment(topic), msg=q)
            self.assertFalse(topic_looks_like_cast(topic), msg=q)
        self.assertTrue(topic_looks_like_cast("Etherei"))
        self.assertTrue(topic_looks_like_cast("Character E"))
        self.assertFalse(topic_looks_like_moment("the chase scene"))
        self.assertFalse(topic_looks_like_moment("Predator Court politics"))

    def test_between_capture_and_arrival_is_a_span(self):
        q = (
            "give me the task list for what happens between the wolf capturing "
            "Character E and the wolf's arrival at the manor."
        )
        span = extract_writing_next_span(q)
        self.assertIsNotNone(span)
        self.assertEqual(span["kind"], "capture_to_arrival")
        self.assertEqual(extract_writing_next_topic(q), "")

    def test_after_flashback_until_manor_is_named_span(self):
        q = (
            "In Ashford Saga, give me the task list for what happens after "
            "the flashback until they reach the manor."
        )
        span = extract_writing_next_span(q)
        self.assertIsNotNone(span)
        self.assertEqual(span["kind"], "named_span")
        self.assertNotEqual(span["kind"], "capture_to_arrival")


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
        self.assertIn("resents", answer.lower())
        self.assertIn("court", answer.lower())
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

    def _moment_corpus(self):
        return [
            _entry(
                "n_cap",
                "Capture beat",
                "After Character E is captured on the mountain path, the vision "
                "reveal still needs to be written at the manor — a reveal even "
                "he has not faced yet.",
            ),
            _entry(
                "n_court",
                "Court",
                "At the Court scene, Character D still needs to write the heavier "
                "political load while Character T stays out of Predator Court duties.",
            ),
            _entry(
                "n_early",
                "Earlier chapter",
                "In chapter 1 the lantern ritual still needs a snapped bridge rope.",
            ),
            _entry(
                "d1",
                "Draft",
                "Chapter 2\n"
                "Character E bolted down the mountain path. The wolf closed in.",
                kind="document",
            ),
        ]

    def test_capture_moment_keeps_capture_drops_court(self):
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for this capture",
            {"lorekeeper_entries_v1": json.dumps(self._moment_corpus())},
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "writing_next")
        self.assertIn("task list", answer)
        self.assertIn("captured", answer)
        self.assertIn("vision", answer)
        self.assertNotIn("political load", answer)
        self.assertNotIn("lantern", answer)
        self.assertNotIn("bridge rope", answer)
        self.assertIn("your plan was for this", answer)

    def test_court_scene_moment_keeps_court_drops_capture(self):
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for this Court scene",
            {"lorekeeper_entries_v1": json.dumps(self._moment_corpus())},
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "writing_next")
        self.assertIn("court", answer)
        self.assertIn("political", answer)
        self.assertNotIn("vision", answer)
        self.assertNotIn("captured", answer)
        self.assertNotIn("lantern", answer)

    def test_this_chapter_uses_current_draft_stretch(self):
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for this chapter",
            {"lorekeeper_entries_v1": json.dumps(self._moment_corpus())},
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "writing_next")
        self.assertIn("task list", answer)
        self.assertIn("captured", answer)
        self.assertNotIn("lantern", answer)
        self.assertNotIn("political load", answer)

    def test_between_capture_and_arrival_excludes_before_and_after(self):
        entries = [
            _entry(
                "n_gap",
                "After the capture",
                "After Character E is captured, find a way to write the carry "
                "down the mountain before they arrive at the manor.",
            ),
            _entry(
                "n_arrive",
                "Arrival",
                "Upon arrival at the manor, find a way to write how the wolf "
                "hands Character E over.",
            ),
            _entry(
                "n_chase",
                "Chase",
                "Find a way to write the chase swiftly but not hastily "
                "when the wolf shows up.",
            ),
            _entry(
                "n_after",
                "Quarters",
                "After Character E is captured, the vision reveal still needs "
                "to be written at the manor quarters.",
            ),
            _entry(
                "n_rescue",
                "Later",
                "After they rescue Character E, brothers discover he is ticklish.",
            ),
            _entry(
                "n_lore",
                "Court",
                "Character D resents Character T for skipping Predator Court duties.",
            ),
            _entry(
                "d1",
                "Draft",
                "Character E was in the wolf's grasp, being carried down the "
                "mountain path.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, give me the task list for what happens "
            "between the wolf capturing Character E and the wolf's arrival "
            "at the manor.",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "writing_next")
        self.assertIn("between capture and arrival", answer)
        self.assertIn("carry", answer)
        self.assertIn("hands", answer)
        self.assertNotIn("swift", answer)
        self.assertNotIn("vision", answer)
        self.assertNotIn("ticklish", answer)
        self.assertNotIn("predator court", answer)
        self.assertNotIn("flashback", answer)

    def test_between_span_keeps_musing_gap_notes(self):
        entries = [
            _entry(
                "n_gap",
                "After the capture",
                "Ok so Character E has been captured. The carry down the mountain "
                "is still off-the-page before they arrive at the manor.",
            ),
            _entry(
                "n_chase",
                "Chase",
                "Find a way to write the chase swiftly but not hastily "
                "when the wolf shows up.",
            ),
            _entry(
                "d1",
                "Draft",
                "Character E was in the wolf's grasp.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, give me the task list for what happens "
            "between the wolf capturing Character E and the wolf's arrival "
            "at the manor.",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertIn("between capture and arrival", answer)
        self.assertIn("carry", answer)
        self.assertNotIn("swift", answer)

    def test_between_span_keeps_overnight_stop_and_grammar(self):
        entries = [
            _entry(
                "n_stop",
                "After the capture",
                "It takes them several days, so when he stops for the night/day, "
                "he firmly (not gently, not roughly-enough to worsen) binds "
                "Character E's injuries -- along with his limbs in such a manner "
                "that Character E cannot run off again.",
            ),
            _entry(
                "n_fed",
                "After the capture",
                "He also finds a way to keep Character E fed, but whenever he "
                "attempts to engage Character E in conversation, Character E "
                "keeps his mouth determinedly shut and will not speak at all.",
            ),
            _entry(
                "n_gap",
                "Capture POVs",
                "But what happens in between?",
            ),
            _entry(
                "n_wonder",
                "Canon asides",
                "Mind you, it would be interesting to have an idea of where "
                "Character E was going when off-the-page in another series.",
            ),
            _entry(
                "n_chase",
                "Chase",
                "Find a way to write the chase swiftly but not hastily "
                "when the wolf shows up.",
            ),
            _entry(
                "d1",
                "Draft",
                "Character E was in the wolf's grasp, being carried down the "
                "mountain path. He keeps still whenever conversation is "
                "attempted and will not speak if he can help it.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, give me the task list for what happens "
            "between the wolf capturing Character E and the wolf's arrival "
            "at the manor.",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        bullets = [
            ln.strip()
            for ln in (res.get("answer") or "").splitlines()
            if ln.strip().startswith("•")
        ]
        self.assertGreaterEqual(len(bullets), 3)
        self.assertIn("several days", answer)
        self.assertIn("when he stops", answer)
        self.assertIn("injur", answer)
        self.assertIn("fed", answer)
        self.assertIn("mouth", answer)
        self.assertIn("your notes say", answer)
        self.assertNotIn("call for it takes", answer)
        self.assertNotIn("you wanted the still-open", answer)
        self.assertIn("unspecified", answer)
        self.assertNotIn("write what happens between capture and arrival", answer)
        self.assertNotIn("swift", answer)
        self.assertNotIn("mind you", answer)
        self.assertNotIn("another series", answer)

    def test_capture_to_arrival_writing_next_gold_shape_locked(self):
        """
        Owner-locked capture→arrival writing-next gold (2026-08-13).
        Do not edit the fixture or soften this test without owner OK.
        """
        from pathlib import Path

        gold_path = (
            Path(__file__).resolve().parent
            / "fixtures"
            / "capture_to_arrival_writing_next_gold.txt"
        )
        gold = gold_path.read_text(encoding="utf-8")
        self.assertIn("about the stretch between capture and arrival", gold)
        self.assertIn(
            "Your notes say he keeps him fed on the journey; when conversation "
            "is attempted, he keeps his mouth shut and will not speak.",
            gold,
        )
        self.assertIn(
            "Your notes say the journey takes several days. When he stops for "
            "the night, he binds the injuries firmly — not gently, and not "
            "roughly enough to worsen them — and binds the limbs so he cannot "
            "run off.",
            gold,
        )
        self.assertIn(
            "Your notes still leave the rest of this stretch unspecified.",
            gold,
        )
        self.assertNotIn("write what happens between capture and arrival", gold)
        self.assertNotIn("swift", gold.lower())
        self.assertNotIn("ticklish", gold.lower())
        self.assertNotIn("respect", gold.lower())

        entries = [
            _entry(
                "n_stop",
                "After the capture",
                "It takes them several days, so when he stops for the night/day, "
                "he firmly (not gently, not roughly-enough to worsen) binds "
                "Character E's injuries -- along with his limbs in such a manner "
                "that Character E cannot run off again.",
            ),
            _entry(
                "n_fed",
                "After the capture",
                "He also finds a way to keep Character E fed, but whenever he "
                "attempts to engage Character E in conversation, Character E "
                "keeps his mouth determinedly shut and will not speak at all.",
            ),
            _entry(
                "n_gap",
                "Capture POVs",
                "But what happens in between?",
            ),
            _entry(
                "n_wonder",
                "Canon asides",
                "Mind you, it would be interesting to have an idea of where "
                "Character E was going when off-the-page in another series.",
            ),
            _entry(
                "n_chase",
                "Chase",
                "Find a way to write the chase swiftly but not hastily "
                "when the wolf shows up.",
            ),
            _entry(
                "n_respect",
                "Capture musing",
                "So the wolf respects Character E for keeping up the chase "
                "this long.",
            ),
            _entry(
                "d1",
                "Draft",
                "Character E was in the wolf's grasp, being carried down the "
                "mountain path. He keeps still whenever conversation is "
                "attempted and will not speak if he can help it.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, give me the task list for what happens "
            "between the wolf capturing Character E and the wolf's arrival "
            "at the manor.",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = res.get("answer") or ""
        low = answer.lower()
        for needle in (
            "keeps him fed",
            "mouth shut",
            "several days",
            "when he stops for the night",
            "rest of this stretch unspecified",
        ):
            self.assertIn(needle, low)
        for banned in (
            "write what happens between capture and arrival",
            "swift",
            "ticklish",
            "mind you",
            "respects",
        ):
            self.assertNotIn(banned, low)
        bullets = [
            ln.strip()
            for ln in answer.splitlines()
            if ln.strip().startswith("•")
        ]
        self.assertEqual(len(bullets), 3)
        self.assertIn("fed", bullets[0].lower())
        self.assertIn("several days", bullets[1].lower())
        self.assertIn("unspecified", bullets[2].lower())

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
                },
                {
                    "entryId": "2",
                    "noteTitle": "Chase",
                    "line": "The chase scene needs a snapped bridge rope.",
                },
            ],
            has_notes=True,
            has_draft=True,
            topic="",
            total_before_cap=2,
        )
        self.assertIn("Here's a short task list", out)
        self.assertIn("•", out)
        self.assertIn("write-next", out.lower())
        # Blank line between bullets (digestible spacing).
        self.assertRegex(out, r"• .+\n\n• ")

    def test_drops_notes_already_paraphrased_in_draft(self):
        entries = [
            _entry(
                "n1",
                "Early beat",
                "Not long after Character E mentions his theory that they are no longer "
                "in their home dimension, he reflects on the fact that a Predator is "
                "tracking them (it is a wolf who works for the baron).",
            ),
            _entry(
                "n2",
                "Still open",
                "Need to write Character E's secret bitterness about the Court load.",
            ),
            _entry(
                "d1",
                "Draft",
                "Character E said they were no longer in their home dimension. "
                "Soon after, he reflected that a Predator was tracking them — "
                "a wolf working for the baron along the ridge.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for Character E",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertNotIn("home dimension", answer)
        self.assertNotIn("tracking them", answer)
        self.assertIn("bitterness", answer)

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
        self.assertFalse(
            claim_is_write_next_task(
                "However, I think he misunderstands the tension between Predators "
                "and Preyfolk; he thinks that the Predators have ordered the Prey around."
            )
        )
        self.assertFalse(
            claim_is_write_next_task(
                "Also something in Character E's expression should hint at his knowledge "
                "that the Cat does not want him dead even while he's fleeing."
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
        later = (
            "Character E set in motion the eventual reveal that Preyfolk of this "
            "Dimension are just like those in the other world — this does not happen "
            "until a later book."
        )
        self.assertTrue(line_is_later_book(later))
        self.assertFalse(claim_is_write_next_task(later))
        self.assertTrue(
            claim_is_write_next_task(later, allow_later_book=True)
        )
        self.assertTrue(wants_later_book_scope("task list for later book"))

    def test_drops_later_book_from_current_task_list(self):
        entries = [
            _entry(
                "n1",
                "Far reveal",
                "So Character E, by being discovered, set in motion the eventual reveal "
                "that Preyfolk of this Dimension are just like the others — this does "
                "not happen until a later book.",
            ),
            _entry(
                "n2",
                "Near craft",
                "Need to write the chase swiftly but not hastily so Character E "
                "earns respect from the larger predator through stamina.",
            ),
            _entry(
                "d1",
                "Draft",
                "They crossed the plaza at noon without speaking.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for Character E",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertNotIn("eventual reveal", answer)
        self.assertNotIn("preyfolk of this dimension", answer)
        self.assertIn("chase", answer)

    def test_restate_has_no_ellipsis_trailoff(self):
        long_ok = (
            "Need to write Character E's secret bitterness about Court political "
            "pressures after the manor arrival."
        )
        out = restate_as_task_line(long_ok)
        self.assertTrue(out)
        self.assertNotIn("…", out)
        self.assertFalse(
            restate_as_task_line(
                "So Character E set in motion the eventual reveal that Preyfolk "
                "of this Dimension are just…"
            )
        )

    def test_soft_show_all_when_list_is_small(self):
        from lorekeeper_writing_next import SOFT_SHOW_ALL_MAX, _select_tasks_for_display

        ranked = [
            {"entryId": str(i), "noteTitle": "n", "line": f"unique-task-line-{i}"}
            for i in range(SOFT_SHOW_ALL_MAX)
        ]
        shown, hidden = _select_tasks_for_display(ranked)
        self.assertEqual(len(shown), SOFT_SHOW_ALL_MAX)
        self.assertEqual(hidden, 0)
        ranked_over = ranked + [
            {"entryId": "x", "noteTitle": "n", "line": "unique-task-line-extra"}
        ]
        shown2, hidden2 = _select_tasks_for_display(ranked_over)
        self.assertEqual(len(shown2), MAX_TASK_ITEMS)
        self.assertEqual(hidden2, len(ranked_over) - MAX_TASK_ITEMS)

    def test_drops_other_cast_attitude_from_etherei_list(self):
        entries = [
            _entry(
                "n1",
                "Etherei",
                "Serias respects Etherei for having picked up on his presence AND "
                "for keeping up the chase this long.\n"
                "They would still be in control, but think closer to ethical captives "
                "of war but longer-lasting, not able to take power — not in the first book.\n"
                "Find a way to write the chase swiftly but not hastily.\n"
                "Obsidian has a fractured-shattered flashback similar to Stygian's, "
                "but different memory and reveals additional secrets about Etherei "
                "and Obsidian himself.",
            ),
            _entry(
                "d1",
                "Draft",
                "Obsidian staggered as a fractured flashback of childhood hit him. "
                "Stygian also broke into a shattered flashback on the chase. "
                "Etherei kept running the mountain path.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for Etherei",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertNotIn("serias respects", answer)
        self.assertNotIn("ethical captives", answer)
        self.assertNotIn("take power", answer)
        self.assertIn("chase", answer)
        self.assertIn("secret", answer)

    def test_partly_done_flashback_keeps_secret_reveal_polish(self):
        entries = [
            _entry(
                "n1",
                "Twins",
                "Obsidian has a fractured-shattered flashback similar to Stygian's, "
                "but different memory and reveals additional secrets about Etherei "
                "and Obsidian himself.",
            ),
            _entry(
                "n2",
                "Mush",
                "I mean i mentioned some flashback stuff but i dont want to make "
                "that the meat of this scene.",
            ),
            _entry(
                "d1",
                "Draft",
                "Obsidian staggered as a fractured flashback of childhood hit him. "
                "Stygian also broke into a shattered flashback on the chase.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for Etherei",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertNotIn("meat of this scene", answer)
        self.assertNotIn("i mean", answer)
        self.assertIn("secret", answer)
        self.assertIn("obsidian", answer)
        self.assertIn("flashback", answer)

    def test_cast_list_includes_ticklish_and_eyesight_facts(self):
        entries = [
            _entry(
                "n1",
                "Character E's age",
                'Note: I was thinking the "never do that again" thing could include '
                "discovering that Etherei is ticklish and that's how they get him "
                "to swear never to do that again.",
            ),
            _entry(
                "n2",
                "Etherei's Eyesight",
                "Tenebris mentions that Etherei, as an albino, might in fact have "
                "trouble with his eyesight.\n"
                "Also, I think Etherei lost his glasses by the events of this book.",
            ),
            _entry(
                "n3",
                "Later mush",
                "They would still be in control — not in the first book.\n"
                "Serias respects Etherei for keeping up the chase.",
            ),
            _entry(
                "d1",
                "Draft",
                "Etherei ran the mountain path. Obsidian and Stygian followed later.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for Etherei",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertIn("ticklish", answer)
        self.assertTrue(
            "eyesight" in answer
            or "vision" in answer
            or "albino" in answer
            or "glasses" in answer
        )
        self.assertNotIn("serias respects", answer)
        self.assertNotIn("not in the first book", answer)
        self.assertNotIn("in canon", answer)
        self.assertNotIn("wonderland", answer)

    def test_flashback_polish_names_edit_location(self):
        entries = [
            _entry(
                "n1",
                "POV order",
                "As Stygian is giving chase, he begins having a fractured/shattered "
                "flashback regarding Etherei getting in trouble during Ethie's early "
                "childhood, a flashback that reveals something surprising about "
                "Etherei and about Stygian.\n"
                "Obsidian has a fractured-shattered flashback similar to Stygian's, "
                "but different memory and reveals additional secrets about Etherei "
                "and Obsidian himself.",
            ),
            _entry(
                "d1",
                "Draft",
                "Obsidian staggered as a fractured flashback of childhood hit him. "
                "Stygian also broke into a shattered flashback on the chase. "
                "Etherei kept running.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for Etherei",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertIn("during", answer)
        self.assertIn("flashback", answer)
        self.assertTrue("stygian" in answer or "obsidian" in answer)
        self.assertIn("secret", answer)

    def test_tasks_include_draft_timeline_seats_from_related_notes(self):
        entries = [
            _entry(
                "n1",
                "Etherei's age",
                "So I'm thinking his brothers force him into kicking back after they "
                "catch up to Serias and rescue Etherei. Note: I was thinking the "
                '"never again" thing could include discovering that Etherei is '
                "ticklish.",
            ),
            _entry(
                "n2",
                "Etherei's Eyesight",
                "Tenebris mentions that Etherei, as an albino, might have trouble "
                "with his eyesight.",
            ),
            _entry(
                "n3",
                "Etherei's Blurry Sight Revealed",
                "None of the characters, including Ethie himself, realize that he "
                "has trouble with his eyesight when he's not wearing glasses. So "
                "i'm thinking that's a revelation that happens at the Cheshire "
                "Cat's quarters, after Etherei is captured.",
            ),
            _entry(
                "n4",
                "Etherei Captured: More Notes",
                "When Serias shows up, Etherei begins to run faster. He keeps "
                "running for a bit (find a way to write the chase swiftly but not "
                "hastily) and then the Wolf scoops him up.",
            ),
            _entry(
                "d1",
                "Draft",
                "Etherei ran the mountain path. Obsidian and Stygian followed later.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for Etherei",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertIn("ticklish", answer)
        self.assertRegex(answer, r"rescue|serias")
        self.assertTrue("eyesight" in answer or "vision" in answer or "albino" in answer)
        self.assertRegex(answer, r"cheshire|quarters|captured|capture")
        self.assertIn("chase", answer)
        self.assertRegex(answer, r"serias|capture")

    def test_collapses_duplicate_vision_and_glasses_bullets(self):
        entries = [
            _entry(
                "n1",
                "Etherei's Eyesight",
                "Also, I think Etherei lost his glasses by the events of this book.\n"
                "Tenebris will give him a proper pair at some point after Etherei "
                "is brought in by the Wolf.",
            ),
            _entry(
                "n2",
                "Etherei's Blurry Sight Revealed",
                "None of the characters, including Ethie himself, realize that he "
                "has trouble with his eyesight when he's not wearing glasses. So "
                "i'm thinking that's a revelation that happens at the Cheshire "
                "Cat's quarters, after Etherei is captured.",
            ),
            _entry(
                "d1",
                "Draft",
                "Etherei ran the mountain path.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for Etherei",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        vision_hits = answer.count("albino-rabbit vision") + answer.count(
            "without glasses and struggling"
        )
        self.assertEqual(vision_hits, 1)
        self.assertIn("quarters", answer)
        self.assertNotIn("without glasses and struggling", answer)

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

    def test_voice_densifies_craft_vision_and_flashback_phrasing(self):
        craft = restate_as_task_line(
            "He keeps running (find a way to write the chase swiftly but not hastily)."
        )
        self.assertIn("swiftly, not hastily", craft.lower())
        self.assertNotIn("find a way", craft.lower())
        framed_chase = frame_plan_recall(craft, you_lead=False)
        self.assertTrue(framed_chase.lower().startswith("for the chase scene"))
        self.assertIn("your plan was", framed_chase.lower())

        vision = restate_as_task_line(
            "Tenebris mentions that Etherei, as an albino, might have trouble "
            "with his eyesight."
        )
        self.assertIn("albino-rabbit vision trouble", vision.lower())
        self.assertNotIn("/", vision)
        framed_v = frame_plan_recall(vision, you_lead=True)
        self.assertTrue(framed_v.lower().startswith("you "))
        self.assertRegex(framed_v.lower(), r"you (wanted|were planning)")

        fb = densify_task_phrasing(
            "During Obsidian's flashback, different memory and reveals additional "
            "secrets about Etherei and Obsidian himself"
        )
        core = plan_recall_core(fb)
        framed = frame_plan_recall(core, you_lead=False)
        self.assertTrue(framed.lower().startswith("for obsidian's flashback"))
        self.assertIn("you meant to", framed.lower())
        self.assertNotIn("different memory", framed.lower())
        self.assertNotIn("himself", framed.lower())

        fb2 = densify_task_phrasing(
            "During Stygian's flashback, reveals something surprising about "
            "Etherei and about Stygian"
        )
        framed2 = frame_plan_recall(plan_recall_core(fb2), you_lead=False)
        self.assertTrue(framed2.lower().startswith("for stygian's flashback"))
        self.assertIn("you meant to", framed2.lower())
        self.assertNotIn("and about", framed2.lower())

    def test_plan_recall_staggers_you_openers(self):
        cores = [
            "Write the chase swiftly, not hastily",
            "Brothers find out Etherei is ticklish",
            "Show Etherei's albino-rabbit vision trouble",
            "During Obsidian's flashback, reveal additional secrets about Etherei "
            "and Obsidian",
            "During Stygian's flashback, reveal something surprising about Etherei "
            "and Stygian",
        ]
        framed = assign_plan_recall_frames(cores)
        starts_you = [bool(re.match(r"^you\b", f, re.I)) for f in framed]
        # At least two non-You lines between any You… openers.
        last_you = None
        for i, is_you in enumerate(starts_you):
            if is_you:
                if last_you is not None:
                    self.assertGreaterEqual(i - last_you - 1, 2)
                last_you = i
        joined = " ".join(framed).lower()
        self.assertIn("for the chase scene, your plan was", joined)
        self.assertIn("you meant to", joined)
        self.assertTrue(any(starts_you))  # still uses some You… plan recall

    def test_etherei_voice_adds_clarifiers_and_warmth(self):
        entries = [
            _entry(
                "n1",
                "Etherei's age",
                "So I'm thinking his brothers force him into kicking back after they "
                "catch up to Serias and rescue Etherei. Note: I was thinking the "
                '"never again" thing could include discovering that Etherei is '
                "ticklish and that's how they get him to swear never to do that "
                "again. Ever.",
            ),
            _entry(
                "n2",
                "Etherei's Eyesight",
                "Tenebris mentions that Etherei, as an albino, might have trouble "
                "with his eyesight.",
            ),
            _entry(
                "n3",
                "Etherei's Blurry Sight Revealed",
                "None of the characters, including Ethie himself, realize that he "
                "has trouble with his eyesight when he's not wearing glasses. So "
                "i'm thinking that's a revelation that happens at the Cheshire "
                "Cat's quarters, after Etherei is captured.",
            ),
            _entry(
                "n4",
                "Etherei Captured: More Notes",
                "When Serias shows up, Etherei begins to run faster--deliberately "
                "outrunning both his brothers and the Wolf, but not the latter for "
                "long. He keeps running for a bit (find a way to write the chase "
                "swiftly but not hastily) and then the Wolf scoops him up.",
            ),
            _entry(
                "n5",
                "POV order",
                "As Stygian is giving chase, he begins having a fractured/shattered "
                "flashback regarding Etherei getting in trouble during Ethie's early "
                "childhood, a flashback that reveals something surprising about "
                "Etherei and about Stygian.\n"
                "Obsidian has a fractured-shattered flashback similar to Stygian's, "
                "but different memory and reveals additional secrets about Etherei "
                "and Obsidian himself. I think the trouble is Etherei getting "
                "attacked by brown rats.\n"
                "POV Order of Events after Etherei spots Serias.\n"
                "I was thinking something of a mix of secret about personality and "
                "secret about physical ability/disadvantage, discluding Etherei's "
                "inability to see well because that is a revelation set for a later "
                "event.",
            ),
            _entry(
                "d1",
                "Draft",
                "Obsidian staggered as a fractured flashback of childhood hit him. "
                "Stygian also broke into a shattered flashback on the chase. "
                "Etherei ran the mountain path.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for Etherei",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = res.get("answer") or ""
        low = answer.lower()
        self.assertIn("for the chase scene, your plan was", low)
        self.assertIn("deliberately outruns", low)
        self.assertIn("ticklish", low)
        self.assertIn("swear never", low)
        self.assertIn("albino-rabbit vision trouble", low)
        self.assertIn("have not faced yet", low)
        self.assertIn("cheshire", low)
        self.assertIn("for obsidian's flashback, you meant to", low)
        self.assertIn("for stygian's flashback, you meant to", low)
        self.assertRegex(low, r"you (wanted|were planning)")
        self.assertIn("your plan was for this", low)
        self.assertNotRegex(answer, r"• .+\([^)]*(?:during|after|at the)[^)]*\)")
        self.assertIn("—", answer)
        self.assertNotIn("find a way to write", low)
        self.assertNotIn("let the chase", low)
        self.assertNotIn("have his brothers find out", low)
        self.assertNotIn("bring out etherei", low)
        self.assertNotIn("different memory", low)
        self.assertNotIn("serias respects", low)
        self.assertNotIn("without glasses and struggling", low)
        self.assertNotRegex(low, r"\b(fun|delightful|adorable|yay)\b")
        self.assertEqual(low.count("albino-rabbit vision"), 1)
        self.assertRegex(answer, r"• .+\n\n• ")
        # You-stack guard on displayed bullets.
        starts = []
        for line in answer.splitlines():
            if line.startswith("• "):
                starts.append(bool(re.match(r"• you\b", line, re.I)))
        last = None
        for i, is_you in enumerate(starts):
            if is_you:
                if last is not None:
                    self.assertGreaterEqual(i - last - 1, 2)
                last = i

    def test_etherei_voice_keeps_gold_beats_with_denser_phrasing(self):
        entries = [
            _entry(
                "n1",
                "Etherei's age",
                "So I'm thinking his brothers force him into kicking back after they "
                "catch up to Serias and rescue Etherei. Note: I was thinking the "
                '"never again" thing could include discovering that Etherei is '
                "ticklish.",
            ),
            _entry(
                "n2",
                "Etherei's Eyesight",
                "Tenebris mentions that Etherei, as an albino, might have trouble "
                "with his eyesight.",
            ),
            _entry(
                "n3",
                "Etherei's Blurry Sight Revealed",
                "None of the characters, including Ethie himself, realize that he "
                "has trouble with his eyesight when he's not wearing glasses. So "
                "i'm thinking that's a revelation that happens at the Cheshire "
                "Cat's quarters, after Etherei is captured.",
            ),
            _entry(
                "n4",
                "Etherei Captured: More Notes",
                "When Serias shows up, Etherei begins to run faster. He keeps "
                "running for a bit (find a way to write the chase swiftly but not "
                "hastily) and then the Wolf scoops him up.",
            ),
            _entry(
                "n5",
                "POV order",
                "As Stygian is giving chase, he begins having a fractured/shattered "
                "flashback regarding Etherei getting in trouble during Ethie's early "
                "childhood, a flashback that reveals something surprising about "
                "Etherei and about Stygian.\n"
                "Obsidian has a fractured-shattered flashback similar to Stygian's, "
                "but different memory and reveals additional secrets about Etherei "
                "and Obsidian himself.\n"
                "POV Order of Events after Etherei spots Serias.",
            ),
            _entry(
                "d1",
                "Draft",
                "Obsidian staggered as a fractured flashback of childhood hit him. "
                "Stygian also broke into a shattered flashback on the chase. "
                "Etherei ran the mountain path.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for Etherei",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = res.get("answer") or ""
        low = answer.lower()
        self.assertIn("chase", low)
        self.assertIn("swift", low)
        self.assertIn("ticklish", low)
        self.assertIn("albino-rabbit vision trouble", low)
        self.assertIn("cheshire", low)
        self.assertIn("obsidian's flashback", low)
        self.assertIn("stygian's flashback", low)
        self.assertNotIn("find a way to write", low)
        self.assertNotIn("different memory", low)
        self.assertNotIn("serias respects", low)
        self.assertNotIn("without glasses and struggling", low)
        self.assertEqual(low.count("albino-rabbit vision"), 1)


    def test_etherei_writing_next_gold_shape_locked(self):
        """
        Owner-locked Etherei writing-next gold shape (2026-08-12).
        Fixture documents the gold sample; synthetic Ask must keep must-keep beats,
        plan-recall seats as sentences (not parentheses), and one vision family.
        """
        from pathlib import Path

        gold_path = (
            Path(__file__).resolve().parent
            / "fixtures"
            / "etherei_writing_next_gold.txt"
        )
        gold = gold_path.read_text(encoding="utf-8")
        self.assertIn("For the chase scene, your plan was", gold)
        self.assertIn("You wanted his brothers to find out Etherei is ticklish", gold)
        self.assertIn("albino-rabbit vision trouble", gold)
        self.assertIn("For Obsidian's flashback, you meant to", gold)
        self.assertIn("For Stygian's flashback, you meant to", gold)
        self.assertIn(
            "Your plan was for this reveal to take place shortly after brothers "
            "rescue Etherei from Serias",
            gold,
        )
        self.assertNotRegex(gold, r"\([^)]*(?:during|after|at the)[^)]*\)")

        entries = [
            _entry(
                "n1",
                "Etherei's age",
                "So I'm thinking his brothers force him into kicking back after they "
                "catch up to Serias and rescue Etherei. Note: I was thinking the "
                '"never again" thing could include discovering that Etherei is '
                "ticklish and that's how they get him to swear never to do that "
                "again. Ever.",
            ),
            _entry(
                "n2",
                "Etherei's Eyesight",
                "Tenebris mentions that Etherei, as an albino, might have trouble "
                "with his eyesight.",
            ),
            _entry(
                "n3",
                "Etherei's Blurry Sight Revealed",
                "None of the characters, including Ethie himself, realize that he "
                "has trouble with his eyesight when he's not wearing glasses. So "
                "i'm thinking that's a revelation that happens at the Cheshire "
                "Cat's quarters, after Etherei is captured.",
            ),
            _entry(
                "n4",
                "Etherei Captured: More Notes",
                "When Serias shows up, Etherei begins to run faster--deliberately "
                "outrunning both his brothers and the Wolf. He keeps running for a "
                "bit (find a way to write the chase swiftly but not hastily) and "
                "then the Wolf scoops him up.",
            ),
            _entry(
                "n5",
                "POV order",
                "As Stygian is giving chase, he begins having a fractured/shattered "
                "flashback regarding Etherei getting in trouble during Ethie's early "
                "childhood, a flashback that reveals something surprising about "
                "Etherei and about Stygian.\n"
                "Obsidian has a fractured-shattered flashback similar to Stygian's, "
                "but different memory and reveals additional secrets about Etherei "
                "and Obsidian himself.\n"
                "POV Order of Events after Etherei spots Serias.",
            ),
            _entry(
                "d1",
                "Draft",
                "Obsidian staggered as a fractured flashback of childhood hit him. "
                "Stygian also broke into a shattered flashback on the chase. "
                "Etherei ran the mountain path from Serias.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, task list for Etherei",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = res.get("answer") or ""
        low = answer.lower()
        for needle in (
            "chase",
            "ticklish",
            "albino-rabbit vision",
            "obsidian's flashback",
            "stygian's flashback",
            "your plan was for this",
            "cheshire",
            "serias",
        ):
            self.assertIn(needle, low)
        self.assertNotRegex(
            answer, r"• .+\([^)]*(?:during|after|at the)[^)]*\)"
        )
        self.assertEqual(low.count("albino-rabbit vision"), 1)


class WritingNextGeneralPathTests(unittest.TestCase):
    """Raise the floor for non-Etherei / non-capture→arrival task lists."""

    def _ashford(self, eid, title, body, *, kind="note"):
        return _entry(
            eid, title, body, tags=["Ashford Saga"], kind=kind
        )

    def test_other_cast_keeps_unused_beats_and_seat_sentences(self):
        entries = [
            self._ashford(
                "n1",
                "Character D",
                "Character D deeply cares for Character T but resents him for "
                "leaving him to dry with political pressures at Court. Your plan "
                "was for this to take place during the Court scene.",
            ),
            self._ashford(
                "n2",
                "Character D",
                "Need to write discovering that Character D still keeps a manor "
                "key he never mentioned — a reveal even Character T has not faced.",
            ),
            self._ashford(
                "n3",
                "Character D",
                "Character D is a lynx with grey fur.",
            ),
            self._ashford(
                "n4",
                "Chase",
                "The chase scene needs a snapped bridge rope over the gorge.",
            ),
            self._ashford(
                "d1",
                "Draft",
                "Character D walked the hall and nodded once at Character T.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Ashford Saga, task list for Character D",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = res.get("answer") or ""
        low = answer.lower()
        self.assertEqual(res.get("questionKind"), "writing_next")
        self.assertIn("resents", low)
        self.assertIn("manor key", low)
        self.assertNotIn("grey fur", low)
        self.assertNotIn("snapped bridge", low)
        self.assertIn("your plan was for this", low)
        self.assertNotRegex(
            answer, r"• .+\([^)]*(?:during|after|at the)[^)]*\)"
        )
        self.assertNotIn("call for it takes", low)
        bullets = [
            ln for ln in answer.splitlines() if ln.strip().startswith("•")
        ]
        self.assertGreaterEqual(len(bullets), 2)

    def test_theme_wolf_keeps_on_topic(self):
        entries = [
            self._ashford(
                "n1",
                "The wolf",
                "The wolf still needs a scene where he keeps Character E fed "
                "on the way to the manor.",
            ),
            self._ashford(
                "n2",
                "Court",
                "Character D resents Character T for skipping Predator Court duties.",
            ),
            self._ashford(
                "d1",
                "Draft",
                "The wolf closed in along the ridge. Character E ran.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Ashford Saga, task list for the wolf",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "writing_next")
        self.assertIn("fed", answer)
        self.assertNotIn("predator court", answer)
        self.assertNotIn("what should i write next", answer)

    def test_whole_work_does_not_echo_ask_and_keeps_unused(self):
        entries = [
            self._ashford(
                "n1",
                "Manor",
                "The manor still needs a snapped gate scene before they go inside.",
            ),
            self._ashford(
                "n2",
                "Awareness",
                "Character E is aware that Character T does not yet want him dead.",
            ),
            self._ashford(
                "d1",
                "Draft",
                "They walked the garden path until dusk.",
                kind="document",
            ),
        ]
        q = "In Ashford Saga, what should I write next?"
        res = recall_from_user_data(
            q, {"lorekeeper_entries_v1": json.dumps(entries)}
        )
        answer = res.get("answer") or ""
        low = answer.lower()
        self.assertEqual(res.get("questionKind"), "writing_next")
        self.assertIn("snapped gate", low)
        self.assertNotIn("does not yet want him dead", low)
        bullets = [
            ln[2:].strip()
            for ln in answer.splitlines()
            if ln.strip().startswith("•")
        ]
        self.assertTrue(bullets)
        for b in bullets:
            self.assertNotIn("what should i write next", b.lower())
            self.assertFalse(
                re.match(r"^write what happens between", b, re.I)
            )
        openers = [bool(re.match(r"^you\b", b, re.I)) for b in bullets]
        if sum(openers) >= 2:
            last = None
            for i, is_you in enumerate(openers):
                if is_you:
                    if last is not None:
                        self.assertGreaterEqual(i - last - 1, 2)
                    last = i

    def test_later_book_list_uses_plan_recall(self):
        entries = [
            self._ashford(
                "n1",
                "Far",
                "Character E returns to the home dimension — this does not happen "
                "until a later book, when the manor secret is finally revealed.",
            ),
            self._ashford(
                "n2",
                "Near",
                "Need to write the chase swiftly but not hastily so Character E "
                "reaches the ridge.",
            ),
            self._ashford(
                "d1",
                "Draft",
                "They walked the garden path until dusk.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Ashford Saga, task list for later book",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "writing_next")
        self.assertIn("home dimension", answer)
        self.assertNotIn("swiftly", answer)
        self.assertRegex(
            answer, r"your notes (?:say|call for)|you wanted|you were planning"
        )
        self.assertNotIn("call for it takes", answer)

    def test_manor_scene_moment_drops_chase(self):
        entries = [
            self._ashford(
                "n1",
                "Manor",
                "At the manor scene, Character D still needs to write the heavier "
                "political load while Character T stays out.",
            ),
            self._ashford(
                "n2",
                "Chase",
                "The chase scene needs a snapped bridge rope over the gorge.",
            ),
            self._ashford(
                "d1",
                "Draft",
                "They stood at the manor steps. Character D waited.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Ashford Saga, task list for the manor scene",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "writing_next")
        self.assertIn("political", answer)
        self.assertNotIn("bridge rope", answer)
        self.assertNotIn("what should i write next", answer)

    def test_named_span_after_flashback_until_manor(self):
        entries = [
            self._ashford(
                "n_walk",
                "After the flashback",
                "After the flashback, Character E still needs to write the quiet "
                "walk toward the manor.",
            ),
            self._ashford(
                "n_stop",
                "After the flashback",
                "It takes two nights, so when he stops for the night he firmly "
                "binds Character E's injuries — along with his limbs so Character E "
                "cannot run off again.",
            ),
            self._ashford(
                "n_flash",
                "Flashback",
                "During Character D's flashback, reveal a childhood secret about "
                "the manor key.",
            ),
            self._ashford(
                "n_guest",
                "Arrival",
                "Upon arrival at the manor, Character E is treated as a guest "
                "rather than a prisoner.",
            ),
            self._ashford(
                "n_chase",
                "Chase",
                "The chase scene needs a snapped bridge rope over the gorge.",
            ),
            self._ashford(
                "d1",
                "Draft",
                "Character D's flashback broke. They were already on the path.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Ashford Saga, give me the task list for what happens after "
            "the flashback until they reach the manor.",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "writing_next")
        self.assertIn("walk", answer)
        self.assertIn("your notes say", answer)
        self.assertIn("injur", answer)
        self.assertNotIn("call for it takes", answer)
        self.assertNotIn("childhood secret", answer)
        self.assertNotIn("treated as a guest", answer)
        self.assertNotIn("bridge rope", answer)
        self.assertNotIn("write what happens between", answer)

    def test_other_work_whole_list(self):
        entries = [
            self._ashford(
                "n1",
                "Gate",
                "The manor still needs a snapped gate scene before they go inside.",
            ),
            self._ashford(
                "d1",
                "Draft",
                "They walked the garden until the lanterns came on.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Ashford Saga, list my task list",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertEqual(res.get("questionKind"), "writing_next")
        self.assertIn("snapped gate", answer)
        self.assertIn("ashford", answer)
        self.assertNotIn("list my task list", answer.split("•", 1)[-1])

    def test_foothold_quiets_pure_future_manor_guest(self):
        entries = [
            self._ashford(
                "n1",
                "Later",
                "Upon arrival at the manor, Character E is treated as a guest "
                "rather than a prisoner.",
            ),
            self._ashford(
                "n2",
                "Path",
                "Need to write the quiet walk toward the manor after the flashback.",
            ),
            self._ashford(
                "d1",
                "Draft",
                "They were still on the mountain path after the flashback broke.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Ashford Saga, what should I write next?",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertIn("walk", answer)
        self.assertNotIn("treated as a guest", answer)


if __name__ == "__main__":
    unittest.main()
