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
    extract_writing_next_topic,
    frame_plan_recall,
    is_writing_next_task_list_question,
    line_is_later_book,
    plan_recall_core,
    restate_as_task_line,
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


if __name__ == "__main__":
    unittest.main()
