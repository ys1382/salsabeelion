"""Relationship + pre/post war routing — synthetic names only."""
from __future__ import annotations

import unittest

from lorekeeper_answer_focus import scrub_rag_artifacts
from lorekeeper_ask_router import local_ask_plan
from lorekeeper_rag import _system_for_kind
from lorekeeper_relations import (
    is_relationship_between_question,
    relationship_between_pair,
)
from lorekeeper_reliability import primary_work_hints
from lorekeeper_work_recall import route_question


class RelationshipTimelineTests(unittest.TestCase):
    Q = (
        "I want you to summarize the relationship that develops between "
        "the protagonist and galloxidor pre and post beginning of the war "
        "in Cities of Rust"
    )

    def test_detects_develops_between_with_war_tail(self):
        self.assertTrue(is_relationship_between_question(self.Q))
        pair = relationship_between_pair(self.Q)
        self.assertIsNotNone(pair)
        assert pair is not None
        self.assertEqual(pair[0], "protagonist")
        self.assertEqual(pair[1], "Galloxidor")

    def test_routes_as_relationship_not_topic(self):
        self.assertEqual(route_question(self.Q), "relationship")
        plan = local_ask_plan(self.Q)
        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.intent, "relationship")
        self.assertEqual(plan.question_kind, "relationship")

    def test_work_hint_is_cities_not_whole_question(self):
        hints = primary_work_hints(self.Q)
        self.assertIn("cities of rust", hints)
        self.assertFalse(any("relationship" in h for h in hints))

    def test_system_prompt_is_relationship_not_summarize(self):
        plan = local_ask_plan(self.Q)
        system = _system_for_kind(
            self.Q, "relationship", brief=False, plan=plan
        )
        self.assertIn("STORY-RELATIONSHIP", system)
        self.assertNotIn("This needs a SUMMARY from the writer's saved notes", system)
        self.assertIn("pre/post", system.lower())
        self.assertNotIn("KINSHIP / FAMILY-TIE", system)

    def test_scrubs_sources_indicate_meta(self):
        raw = (
            "The sources indicate that this is the relationship between the same "
            "two characters. Before the war they were allies.\n\n"
            "— From your notes only. Nothing invented."
        )
        cleaned = scrub_rag_artifacts(self.Q, raw, allow_broad=True)
        self.assertNotIn("sources indicate", cleaned.lower())
        self.assertNotIn("same two characters", cleaned.lower())
        self.assertIn("Before the war", cleaned)

    def test_story_arc_not_kinship_local(self):
        from lorekeeper_relations import (
            is_kinship_relationship_question,
            is_story_arc_relationship_question,
            answer_story_arc_relationship,
        )

        self.assertTrue(is_story_arc_relationship_question(self.Q))
        self.assertFalse(is_kinship_relationship_question(self.Q))
        self.assertTrue(
            is_kinship_relationship_question(
                "In Cities of Rust, how are the protagonist and Galloxidor related?"
            )
        )

        entries = [
            {
                "id": "k1",
                "title": "Blood",
                "body": "Galloxidor is the protagonist's half-brother by blood.",
                "tags": ["Cities of Rust"],
                "kind": "relationship",
            },
            {
                "id": "a1",
                "title": "Before war",
                "body": "Before the war, the protagonist and Galloxidor trusted each other and traded scrap.",
                "tags": ["Cities of Rust"],
                "kind": "relationship",
            },
            {
                "id": "a2",
                "title": "After war",
                "body": "After the war began, Galloxidor sided with the council against the protagonist.",
                "tags": ["Cities of Rust"],
                "kind": "relationship",
            },
        ]
        answer, _ = answer_story_arc_relationship(self.Q, entries)
        assert answer is not None
        low = answer.lower()
        self.assertIn("trusted", low)
        self.assertNotIn("half-brother", low)
        self.assertNotIn("biological", low)
        self.assertNotIn("before/through the arc", low)
        self.assertNotIn("•", answer)

    def test_pair_names_reach_ask_plan(self):
        q = (
            "summarize the relationship that develops between Platinus and Galloxidor "
            "pre and post beginning of the war in Cities of Rust"
        )
        plan = local_ask_plan(q)
        self.assertIsNotNone(plan)
        assert plan is not None
        names = {n.lower() for n in plan.character_names}
        self.assertIn("platinus", names)
        self.assertIn("galloxidor", names)

    def test_false_arc_gap_scrubbed(self):
        raw = (
            "The notes saved for Cities of Rust do not contain story-dynamic material "
            "covering how Platinus and Galloxidor's relationship develops before or after "
            "the start of any war. Before the war they traded scrap.\n\n"
            "— From your notes only. Nothing invented."
        )
        cleaned = scrub_rag_artifacts(self.Q, raw, allow_broad=True)
        self.assertNotIn("story-dynamic", cleaned.lower())
        self.assertIn("traded scrap", cleaned.lower())

    def test_either_name_with_arc_cue_counts(self):
        from lorekeeper_relations import answer_story_arc_relationship

        q = (
            "summarize the relationship that develops between Platinus and Galloxidor "
            "pre and post beginning of the war in Cities of Rust"
        )
        entries = [
            {
                "id": "1",
                "title": "Before",
                "body": "Platinus trusted Galloxidor with the scrap routes before the war.",
                "tags": ["Cities of Rust"],
                "kind": "note",
            },
            {
                "id": "2",
                "title": "Solo beat",
                "body": "Galloxidor later sided against the council's enemies after the war began.",
                "tags": ["Cities of Rust"],
                "kind": "note",
            },
        ]
        answer, ids = answer_story_arc_relationship(q, entries)
        assert answer is not None
        self.assertIn("trusted", answer.lower())
        self.assertTrue(ids)


if __name__ == "__main__":
    unittest.main()
