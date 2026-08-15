"""Tests for Haiku Ask router and portrait vs who routing."""
from __future__ import annotations

import json
import unittest
from unittest import mock

from lorekeeper_ask_plan import AskPlan
from lorekeeper_ask_router import (
    _normalize_plan,
    character_labels_for_plan,
    default_ask_plan,
    local_ask_plan,
    route_ask_question,
)
from lorekeeper_cast_roles import labels_for_cast_role
from lorekeeper_question_routes import (
    extract_what_subject,
    is_character_portrait_question,
)
from lorekeeper_rag import _system_for_kind, _uses_cast_card
from lorekeeper_recall import local_pipeline_skips_rag


class AskRouterTests(unittest.TestCase):
    def test_local_plan_awareness_skips_haiku_shape(self) -> None:
        q = (
            "How aware is Etherei of the Predator-Prey situation right now "
            "in Smoke and Mirrors?"
        )
        plan = local_ask_plan(q)
        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.router_engine, "local")
        self.assertEqual(plan.question_kind, "knowledge")
        self.assertEqual(plan.intent, "narrow_fact")

    def test_local_plan_portrait(self) -> None:
        q = "In Smoke and Mirrors, what is Duke Dijon?"
        plan = local_ask_plan(q)
        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.intent, "character_portrait")
        self.assertEqual(plan.router_engine, "local")

    def test_local_plan_planned_between_leave_off_is_writing_next(self) -> None:
        q = (
            "What do I have planned between the place where I leave off in the "
            "main draft and the warren underground POV?"
        )
        plan = local_ask_plan(q)
        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.intent, "writing_next")
        self.assertEqual(plan.question_kind, "writing_next")
        self.assertFalse(plan.use_draft_tail)
        self.assertNotEqual(plan.pipeline, "rag_resume")

    def test_haiku_resume_corrected_to_writing_next_span(self) -> None:
        payload = {
            "intent": "story_resume",
            "pipeline": "rag_resume",
            "answer_model": "sonnet",
            "role_terms": [],
            "character_names": [],
            "section": None,
            "question_kind": "resume",
        }
        q = (
            "What do I have planned between the place where I leave off in the "
            "main draft and the warren underground POV?"
        )
        with mock.patch(
            "lorekeeper_ask_router._call_haiku_router",
            return_value=json.dumps(payload),
        ):
            plan = route_ask_question(q)
        self.assertEqual(plan.intent, "writing_next")
        self.assertEqual(plan.question_kind, "writing_next")
        self.assertFalse(plan.use_draft_tail)

    def test_default_plan_summarizes_with_sonnet(self) -> None:
        plan = default_ask_plan("anything")
        self.assertEqual(plan.pipeline, "rag_summarize")
        self.assertEqual(plan.answer_model, "sonnet")

    def test_what_is_name_is_portrait(self) -> None:
        q = "In Smoke and Mirrors, what is Etherei?"
        self.assertTrue(is_character_portrait_question(q))
        self.assertEqual(extract_what_subject(q), "Etherei")

    def test_portrait_guard_overrides_haiku_who(self) -> None:
        plan = _normalize_plan(
            {
                "intent": "who_is",
                "pipeline": "rag_cast_card",
                "answer_model": "sonnet",
                "role_terms": [],
                "character_names": ["Etherei"],
                "section": None,
                "question_kind": "who",
            },
            "In Smoke and Mirrors, what is Etherei?",
        )
        self.assertEqual(plan.intent, "character_portrait")
        self.assertEqual(plan.pipeline, "rag_summarize")
        self.assertEqual(plan.question_kind, "topic")

    def test_rag_uses_portrait_not_cast_card(self) -> None:
        plan = AskPlan(
            intent="character_portrait",
            pipeline="rag_summarize",
            answer_model="sonnet",
            question_kind="topic",
            character_names=["Etherei"],
        )
        q = "In Smoke and Mirrors, what is Etherei?"
        self.assertFalse(_uses_cast_card(q, "who", plan))
        system = _system_for_kind(q, "topic", brief=False, plan=plan)
        self.assertIn("CHARACTER PORTRAIT", system)
        self.assertNotIn("CAST CARD", system)

    def test_haiku_misroute_corrected(self) -> None:
        payload = {
            "intent": "who_is",
            "pipeline": "rag_cast_card",
            "answer_model": "sonnet",
            "role_terms": [],
            "character_names": ["Ella"],
            "section": None,
            "question_kind": "who",
        }
        with mock.patch(
            "lorekeeper_ask_router._call_haiku_router",
            return_value=json.dumps(payload),
        ):
            plan = route_ask_question("In Ashford Saga, what kind of person is Ella?")
        self.assertEqual(plan.intent, "character_portrait")
        self.assertEqual(plan.pipeline, "rag_summarize")

    def test_portrait_local_can_skip_rag(self) -> None:
        plan = AskPlan(
            intent="character_portrait",
            pipeline="rag_summarize",
            answer_model="sonnet",
            question_kind="topic",
            character_names=["Etherei"],
        )
        pipeline = {
            "questionKind": "topic",
            "materialState": "summarizable",
            "answer": (
                "Etherei is the protagonist and grey-skinned arcanist who guards the north gate. "
                "She speaks softly at the threshold and is married to Character C.\n\n"
                "— From your notes only. Nothing invented."
            ),
            "sources": [],
        }
        self.assertTrue(
            local_pipeline_skips_rag(
                "In Smoke and Mirrors, what is Etherei?",
                pipeline,
                [{"id": "n1", "body": "Etherei is the protagonist.", "tags": ["Smoke and Mirrors"]}],
                plan=plan,
            )
        )

    def test_portrait_spot_check_skips_rag_when_local_is_good(self) -> None:
        plan = AskPlan(
            intent="character_portrait",
            pipeline="rag_summarize",
            answer_model="sonnet",
            question_kind="topic",
            character_names=["Duke Dijon"],
        )
        pipeline = {
            "questionKind": "topic",
            "materialState": "summarizable",
            "answer": (
                "Duke Dijon is a Eurasian Lynx and second cousin of Lord Tenebris. "
                "He keeps to the old hunting grounds.\n\n"
                "— From your notes only. Nothing invented."
            ),
            "sources": [{"id": "n1"}],
        }
        q = "In Smoke and Mirrors, what is Duke Dijon?"
        scoped = [
            {
                "id": "n1",
                "title": "Duke Dijon",
                "body": "Duke Dijon is a Eurasian Lynx. Second cousin of Lord Tenebris.",
                "tags": ["Smoke and Mirrors"],
            }
        ]
        self.assertTrue(
            local_pipeline_skips_rag(q, pipeline, scoped, spot_check=True, plan=plan)
        )

    def test_summarize_plan_skips_local(self) -> None:
        plan = AskPlan(
            intent="summarize_story",
            pipeline="rag_summarize",
            answer_model="sonnet",
            question_kind="topic",
        )
        pipeline = {
            "questionKind": "topic",
            "materialState": "fragments_only",
            "answer": "• scrap",
            "sources": [],
        }
        self.assertFalse(local_pipeline_skips_rag("motivation?", pipeline, [], plan=plan))

    def test_role_to_name_from_notes(self) -> None:
        entries = [
            {
                "id": "n1",
                "title": "Cast",
                "body": "Marcus is the antagonist. Cold and patient.",
                "tags": ["Smoke and Mirrors"],
            }
        ]
        names = labels_for_cast_role("antagonist", entries)
        self.assertIn("Marcus", names)
        plan = AskPlan(
            intent="character_portrait",
            pipeline="rag_summarize",
            answer_model="sonnet",
            question_kind="topic",
            role_terms=["antagonist"],
        )
        self.assertIn("Marcus", character_labels_for_plan(plan, entries))


if __name__ == "__main__":
    unittest.main()
