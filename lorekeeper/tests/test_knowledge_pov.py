"""Tests for knowledge-from-POV Ask routing."""
from __future__ import annotations

import os
import unittest

from lorekeeper_knowledge_pov import (
    build_awareness_answer,
    build_knowledge_pov_answer,
    awareness_parts,
    answer_meets_does_know_name_gold_bar,
    is_awareness_question,
    is_does_know_question,
    is_knowledge_pov_question,
    knowledge_pov_parts,
    names_in_knowledge_topic,
)
from lorekeeper_answer_focus import scrub_rag_artifacts
from lorekeeper_character_summary import character_targets
from lorekeeper_ask_router import AskPlan, local_ask_plan
from lorekeeper_recall import local_pipeline_skips_rag, recall_from_user_data


class KnowledgePovTests(unittest.TestCase):
    def test_detects_knowledge_question(self) -> None:
        q = "In Smoke and Mirrors, what does Elara know about Marcus's interest in Elara?"
        self.assertTrue(is_knowledge_pov_question(q))
        parts = knowledge_pov_parts(q)
        self.assertIsNotNone(parts)
        assert parts is not None
        self.assertEqual(parts[0], "Elara")
        self.assertIn("Marcus", parts[1])

    def test_character_targets_use_knower_not_about_tail(self) -> None:
        q = "In Smoke and Mirrors, what does Elara know about Marcus's interest in Elara?"
        targets = character_targets(q)
        self.assertIn("Elara", targets)
        self.assertNotIn("Marcus's Interest In Elara", targets)

    def test_names_in_topic(self) -> None:
        names = names_in_knowledge_topic("Marcus's interest in Elara")
        self.assertIn("Marcus", names)
        self.assertIn("Elara", names)

    def test_build_answer_from_notes(self) -> None:
        entries = [
            {
                "id": "k1",
                "title": "Elara POV",
                "body": "Elara knows Marcus watches her at the gate. She suspects his interest is political.",
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            }
        ]
        q = "In Smoke and Mirrors, what does Elara know about Marcus's interest in Elara?"
        answer, ids = build_knowledge_pov_answer(q, entries)
        self.assertIsNotNone(answer)
        assert answer is not None
        self.assertIn("Marcus", answer)
        self.assertNotIn("Interest In Elara", answer)
        self.assertTrue(ids)

    def test_regression_no_fake_gap_stub(self) -> None:
        os.environ["LOREKEEPER_RAG"] = "0"
        entries = [
            {
                "id": "k1",
                "title": "Elara POV",
                "body": "Elara knows Marcus watches her at the gate.",
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            }
        ]
        res = recall_from_user_data(
            "In Smoke and Mirrors, what does Elara know about Marcus's interest in Elara?",
            {"lorekeeper_entries_v1": __import__("json").dumps(entries)},
        )
        self.assertTrue(res.get("ok"))
        answer = str(res.get("answer") or "")
        self.assertNotIn("Interest In Elara", answer)
        self.assertNotRegex(answer.lower(), r"nothing saved yet.*interest in elara")


    def test_awareness_with_trailing_work(self) -> None:
        q = (
            "How aware is Character M of the predator-prey situation right now "
            "in Ashford Saga?"
        )
        self.assertTrue(is_awareness_question(q))
        parts = awareness_parts(q)
        self.assertIsNotNone(parts)
        assert parts is not None
        self.assertEqual(parts[0], "Character M")

    def test_detects_awareness_question(self) -> None:
        q = "How aware is Character M of the northern alliance right now?"
        self.assertTrue(is_awareness_question(q))
        self.assertTrue(is_knowledge_pov_question(q))

    def test_scrub_invented_counterpart(self) -> None:
        raw = (
            "Etherei met CC Baron (the Cheshire Cat's human counterpart) at the gate.\n\n"
            "— From your notes only. Nothing invented."
        )
        q = "How aware is Etherei of the predator-prey situation right now?"
        cleaned = scrub_rag_artifacts(q, raw, allow_broad=False)
        self.assertNotIn("human counterpart", cleaned.lower())

    def test_build_awareness_answer(self) -> None:
        entries = [
            {
                "id": "a1",
                "title": "Alliance note",
                "body": "Character M is barely aware of the northern alliance.",
                "tags": ["Ashford Saga"],
                "kind": "note",
            }
        ]
        q = "In Ashford Saga, how aware is Character M of the northern alliance right now?"
        answer, ids = build_awareness_answer(q, entries)
        self.assertIsNotNone(answer)
        assert answer is not None
        self.assertIn("barely aware", answer.lower())
        self.assertTrue(ids)

    def test_awareness_prefers_knowledge_over_scene_noise(self) -> None:
        entries = [
            {
                "id": "n1",
                "title": "Scene",
                "body": (
                    "Agitated, but not with the fury on the faces of predators in the meadow, "
                    "as Etherei's blood glittered on his fangs."
                ),
                "tags": ["Smoke and Mirrors"],
            },
            {
                "id": "n2",
                "title": "Awareness",
                "body": (
                    "Etherei is barely aware of the predator-prey rules in the capital."
                ),
                "tags": ["Smoke and Mirrors"],
            },
        ]
        q = "How aware is Etherei of the Predator-Prey situation right now in Smoke and Mirrors?"
        answer, ids = build_awareness_answer(q, entries)
        self.assertIsNotNone(answer)
        assert answer is not None
        self.assertIn("barely aware", answer.lower())
        self.assertNotIn("fangs", answer.lower())
        self.assertTrue(ids)

    def test_awareness_right_now_skips_future_plans(self) -> None:
        entries = [
            {
                "id": "n1",
                "title": "Plan",
                "body": (
                    "Etherei deliberately plans to draw the Predator's attention to himself "
                    "alone rather than warn his brothers, believing this will protect them."
                ),
                "tags": ["Smoke and Mirrors"],
            },
            {
                "id": "n2",
                "title": "Awareness",
                "body": (
                    "Etherei suspects the unspoken rules of the predator-prey situation "
                    "but has not yet spoken to any lord about it."
                ),
                "tags": ["Smoke and Mirrors"],
            },
        ]
        q = (
            "How aware is Etherei of the Predator-Prey situation right now "
            "in Smoke and Mirrors?"
        )
        answer, ids = build_awareness_answer(q, entries)
        self.assertIsNotNone(answer)
        assert answer is not None
        self.assertIn("suspects", answer.lower())
        self.assertNotIn("plans to draw", answer.lower())
        self.assertNotIn("believing this will", answer.lower())
        self.assertNotIn("…", answer)
        self.assertIn("right now", answer.lower())
        self.assertTrue(ids)

    def test_awareness_plan_skips_rag_when_local_is_substantive(self) -> None:
        q = (
            "How aware is Etherei of the Predator-Prey situation right now "
            "in Smoke and Mirrors?"
        )
        plan = local_ask_plan(q)
        self.assertIsNotNone(plan)
        assert plan is not None
        pipeline = {
            "questionKind": "knowledge",
            "materialState": "summarizable",
            "answer": (
                "From what you've saved in Smoke and Mirrors, Etherei's awareness of "
                "the Predator-Prey situation: Etherei is barely aware of the predator-prey rules.\n\n"
                "— From your notes only. Nothing invented."
            ),
            "sources": [{"id": "n1"}],
        }
        scoped = [
            {
                "id": "n1",
                "title": "Predator prey",
                "body": "Etherei is barely aware of the predator-prey rules in the capital.",
                "tags": ["Smoke and Mirrors"],
            }
        ]
        self.assertTrue(local_pipeline_skips_rag(q, pipeline, scoped, plan=plan))


class DoesKnowNameTests(unittest.TestCase):
    Q = "Does the beaver mayor know Etherei's name?"

    def _entries(self) -> list[dict]:
        return [
            {
                "id": "m1",
                "title": "Mayor Sepior",
                "body": (
                    "The Beaver Mayor, Mayor Sepior, knows that Etherei is a strange "
                    "Rabbit. When addressing Etherei, he calls Etherei \"Stranger.\" "
                    "Etherei's name is never spoken in his presence."
                ),
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            },
            {
                "id": "blurb",
                "title": "Overview",
                "body": (
                    "Smoke and Mirrors follows Etherei as he becomes entangled in a "
                    "dangerous political hunt orchestrated by predators. The central "
                    "crisis arrives when Etherei is captured by Serias."
                ),
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            },
        ]

    def test_detects_does_know_name(self) -> None:
        self.assertTrue(is_does_know_question(self.Q))
        self.assertTrue(is_knowledge_pov_question(self.Q))
        parts = knowledge_pov_parts(self.Q)
        self.assertIsNotNone(parts)
        assert parts is not None
        self.assertIn("Beaver Mayor", parts[0])
        self.assertIn("name", parts[1].lower())

    def test_does_not_steal_what_does_know_about(self) -> None:
        q = "In Smoke and Mirrors, what does Elara know about Marcus's interest in Elara?"
        self.assertFalse(is_does_know_question(q))
        self.assertTrue(is_knowledge_pov_question(q))

    def test_local_plan_is_knowledge(self) -> None:
        plan = local_ask_plan(self.Q)
        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.question_kind, "knowledge")
        self.assertEqual(plan.intent, "narrow_fact")
        self.assertEqual(plan.router_engine, "local")

    def test_compose_matches_candidate_gold_bar(self) -> None:
        answer, ids = build_knowledge_pov_answer(self.Q, self._entries())
        self.assertIsNotNone(answer)
        assert answer is not None
        self.assertTrue(answer_meets_does_know_name_gold_bar(answer), answer)
        self.assertIn("strange", answer.lower())
        self.assertIn("rabbit", answer.lower())
        self.assertNotIn("political hunt", answer.lower())
        self.assertNotIn("captured by serias", answer.lower())
        self.assertTrue(ids)

    def test_recall_does_not_dump_story_blurb(self) -> None:
        os.environ["LOREKEEPER_RAG"] = "0"
        res = recall_from_user_data(
            self.Q,
            {"lorekeeper_entries_v1": __import__("json").dumps(self._entries())},
        )
        self.assertTrue(res.get("ok"))
        self.assertEqual(res.get("questionKind"), "knowledge")
        answer = str(res.get("answer") or "")
        self.assertTrue(answer_meets_does_know_name_gold_bar(answer), answer)
        self.assertNotIn("becomes entangled", answer.lower())

    def test_gold_shape_locked(self) -> None:
        """
        Owner-locked does-know name gold (2026-09-19). Floor only.
        Spoken-address scan is also locked — do not soften vocative tests.
        Do not edit the fixture or soften this test without owner OK.
        """
        from pathlib import Path

        gold_path = (
            Path(__file__).resolve().parent
            / "fixtures"
            / "beaver_mayor_knows_etherei_name_gold.txt"
        )
        gold = gold_path.read_text(encoding="utf-8")
        expected = (
            "The only times we see him addressing Etherei, he calls Etherei "
            '"Stranger." Therefore, it is unlikely that Mayor Sepior knows '
            "Etherei's name yet.\n"
            "\n"
            "— From your notes only. Nothing invented.\n"
        )
        self.assertEqual(gold, expected)
        self.assertTrue(answer_meets_does_know_name_gold_bar(gold), gold)
        self.assertIn("Stranger", gold)
        self.assertIn("Mayor Sepior", gold)
        self.assertNotIn("very far", gold.lower())
        self.assertNotIn("strange Rabbit", gold)

    def test_floor_only_answer_meets_bar(self) -> None:
        floor = (
            "The only times we see him addressing Etherei, he calls Etherei "
            '"Stranger." Therefore, it is unlikely that Mayor Sepior knows '
            "Etherei's name yet.\n\n"
            "— From your notes only. Nothing invented."
        )
        self.assertTrue(answer_meets_does_know_name_gold_bar(floor), floor)

    def test_curly_apostrophe_still_name_status(self) -> None:
        q = "Does the beaver mayor know Etherei\u2019s name?"
        self.assertTrue(is_does_know_question(q))
        answer, _ids = build_knowledge_pov_answer(q, self._entries())
        self.assertIsNotNone(answer)
        assert answer is not None
        self.assertTrue(answer_meets_does_know_name_gold_bar(answer), answer)
        self.assertNotIn("knowledge about", answer.lower())

    def test_does_not_dump_draft_scenes(self) -> None:
        entries = self._entries() + [
            {
                "id": "scene",
                "title": "Draft",
                "body": (
                    "Etherei shakes his face, ridding himself of his blank expression "
                    "that is likely to only further incense the beaver mayor. "
                    '"But, if you follow me, I know someone who can give you a better '
                    'answer than me!" '
                    + ("*" * 80)
                    + " Somewhere in a different underground burrow, "
                    '"I cannot tell you how much I appreciate you agreeing to meet '
                    'with us here," the Beaver mayor tells the Moonshadow Twins. '
                    '"Perhaps you could explain further than that, now that you are '
                    'in our hidey hole so to speak?"'
                ),
                "tags": ["Smoke and Mirrors"],
                "kind": "doc",
            }
        ]
        os.environ["LOREKEEPER_RAG"] = "0"
        res = recall_from_user_data(
            "Does the beaver mayor know Etherei\u2019s name?",
            {"lorekeeper_entries_v1": __import__("json").dumps(entries)},
        )
        answer = str(res.get("answer") or "")
        self.assertTrue(answer_meets_does_know_name_gold_bar(answer), answer)
        self.assertNotIn("knowledge about", answer.lower())
        self.assertNotIn("includes:", answer.lower())
        self.assertNotIn("further incense", answer.lower())
        self.assertNotIn("hidey hole", answer.lower())
        self.assertNotIn("Moonshadow", answer)
        self.assertNotIn("*" * 20, answer)

    def test_does_not_treat_description_quote_as_name(self) -> None:
        entries = [
            {
                "id": "m1",
                "title": "Mayor Sepior",
                "body": (
                    "The Beaver Mayor, Mayor Sepior, knows that Etherei is a strange "
                    "Rabbit. The beaver mayor said Etherei was \"a very far way away.\" "
                    "When addressing Etherei, he calls Etherei \"Stranger.\" "
                    "Etherei's name is never spoken in his presence."
                ),
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            }
        ]
        answer, _ids = build_knowledge_pov_answer(self.Q, entries)
        self.assertIsNotNone(answer)
        assert answer is not None
        self.assertTrue(answer_meets_does_know_name_gold_bar(answer), answer)
        self.assertIn("Stranger", answer)
        self.assertNotIn("very far", answer.lower())
        self.assertNotIn("way away", answer.lower())

    def test_does_not_treat_let_as_name(self) -> None:
        entries = [
            {
                "id": "m1",
                "title": "Mayor Sepior",
                "body": (
                    '"Let me show you the way," the beaver mayor tells Etherei. '
                    '"Let," he adds, before the twins arrive. '
                    "When addressing Etherei, he calls Etherei \"Stranger.\" "
                    "Etherei's name is never spoken in his presence."
                ),
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            }
        ]
        answer, _ids = build_knowledge_pov_answer(self.Q, entries)
        self.assertIsNotNone(answer)
        assert answer is not None
        self.assertTrue(answer_meets_does_know_name_gold_bar(answer), answer)
        self.assertIn("Stranger", answer)
        self.assertNotRegex(answer, r'["\']Let["\']')

    def test_does_not_treat_white_rabbit_epithet_as_name(self) -> None:
        entries = [
            {
                "id": "m1",
                "title": "Mayor Sepior",
                "body": (
                    "Etherei is also known as TheWhiteRabbit. "
                    "The beaver mayor has heard of the White Rabbit. "
                    "When addressing Etherei, he calls Etherei \"Stranger.\" "
                    "Etherei's name is never spoken in his presence."
                ),
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            }
        ]
        answer, _ids = build_knowledge_pov_answer(self.Q, entries)
        self.assertIsNotNone(answer)
        assert answer is not None
        self.assertTrue(answer_meets_does_know_name_gold_bar(answer), answer)
        self.assertIn("Stranger", answer)
        self.assertNotIn("TheWhiteRabbit", answer)
        self.assertNotIn("White Rabbit", answer)

    def test_does_not_use_another_characters_name_for_him(self) -> None:
        entries = [
            {
                "id": "t1",
                "title": "Tenebris",
                "body": (
                    "Tenebris knows Etherei as Chroniker. "
                    "Tenebris calls Etherei \"Chroniker.\""
                ),
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            },
            {
                "id": "m1",
                "title": "Mayor Sepior",
                "body": (
                    "The Beaver Mayor, Mayor Sepior, meets Etherei. "
                    "When addressing Etherei, he calls Etherei \"Stranger.\" "
                    "Etherei's name is never spoken in his presence."
                ),
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            },
        ]
        answer, _ids = build_knowledge_pov_answer(self.Q, entries)
        self.assertIsNotNone(answer)
        assert answer is not None
        self.assertTrue(answer_meets_does_know_name_gold_bar(answer), answer)
        self.assertIn("Stranger", answer)
        self.assertNotIn("Chroniker", answer)


class WhoRagEscalationTests(unittest.TestCase):
    def test_thin_who_does_not_skip_rag(self) -> None:
        pipeline = {
            "questionKind": "who",
            "materialState": "fragments_only",
            "answer": "Etherei — from what you've saved:\n\nNothing saved yet in Smoke and Mirrors that describes Etherei.",
            "sources": [],
        }
        scoped = [{"id": "e1", "title": "Draft", "body": "Etherei guards the gate.", "tags": ["Smoke and Mirrors"]}]
        self.assertFalse(
            local_pipeline_skips_rag("In Smoke and Mirrors, who is Etherei?", pipeline, scoped)
        )

    def test_good_who_skips_rag(self) -> None:
        pipeline = {
            "questionKind": "who",
            "materialState": "summarizable",
            "answer": "Etherei is the protagonist.\n\n— From your notes only. Nothing invented.",
            "sources": [{"id": "e1"}],
        }
        scoped = [{"id": "e1", "title": "Etherei", "body": "Etherei is the protagonist.", "tags": ["Smoke and Mirrors"]}]
        self.assertTrue(
            local_pipeline_skips_rag("In Smoke and Mirrors, who is Etherei?", pipeline, scoped)
        )


class TopicRagEscalationTests(unittest.TestCase):
    def test_topic_prefers_rag_over_local_scraps(self) -> None:
        pipeline = {
            "questionKind": "topic",
            "materialState": "fragments_only",
            "answer": "• From “Draft”: a mirror cracked.",
            "sources": [{"id": "e1"}],
        }
        self.assertFalse(
            local_pipeline_skips_rag(
                "In Smoke and Mirrors, what happens in the prologue?", pipeline, []
            )
        )

    def test_spot_check_prefers_rag_for_non_who(self) -> None:
        pipeline = {
            "questionKind": "resume",
            "materialState": "ok",
            "answer": "From the latest draft you've saved, the story currently stands roughly here:\n\nA court met.",
            "sources": [],
        }
        self.assertFalse(
            local_pipeline_skips_rag(
                "In Smoke and Mirrors, what is going on where I left off?",
                pipeline,
                [],
                spot_check=True,
            )
        )

    def test_spot_check_awareness_finds_buried_note(self) -> None:
        """Spot-check uses full recall (not fast cap) — awareness beyond entry 90."""
        os.environ["LOREKEEPER_RAG"] = "0"
        entries = [
            {
                "id": f"f{i}",
                "title": "Filler",
                "body": f"Unrelated scene detail number {i}.",
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            }
            for i in range(120)
        ]
        entries.append(
            {
                "id": "aware",
                "title": "Etherei awareness",
                "body": (
                    "Etherei suspects the unspoken rules of the predator-prey situation "
                    "but has not spoken to any lord about it yet."
                ),
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            }
        )
        q = (
            "How aware is Etherei of the Predator-Prey situation right now "
            "in Smoke and Mirrors?"
        )
        res = recall_from_user_data(q, {"lorekeeper_entries_v1": __import__("json").dumps(entries)}, spot_check=True)
        self.assertTrue(res.get("ok"))
        answer = str(res.get("answer") or "").lower()
        self.assertIn("suspects", answer)
        self.assertNotIn("unrelated scene detail number 0", answer)


if __name__ == "__main__":
    unittest.main()
