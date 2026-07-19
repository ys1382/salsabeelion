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
        self.assertIn("RELATIONSHIP-BETWEEN", system)
        self.assertNotIn("This needs a SUMMARY from the writer's saved notes", system)
        self.assertIn("pre/post", system.lower())
        self.assertIn("earlier persona", system.lower())

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


if __name__ == "__main__":
    unittest.main()
