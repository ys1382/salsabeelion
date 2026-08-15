"""Tests for what vs who routing and section scope."""
from __future__ import annotations

import json
import unittest

from lorekeeper_question_routes import (
    extract_what_subject,
    is_character_portrait_question,
    is_story_position_question,
    is_what_question,
)
from lorekeeper_section_scope import extract_section_hints, filter_entries_by_section
from lorekeeper_work_recall import route_question


class QuestionRouteTests(unittest.TestCase):
    def test_what_in_prologue_not_who(self) -> None:
        q = "In Smoke and Mirrors, what happens in the prologue?"
        self.assertTrue(is_what_question(q))
        self.assertEqual(route_question(q), "topic")

    def test_who_still_who(self) -> None:
        q = "In Smoke and Mirrors, who is Etherei?"
        self.assertEqual(route_question(q), "who")

    def test_story_position_route(self) -> None:
        q = "In Smoke and Mirrors, what is going on where I left off in the story?"
        self.assertTrue(is_story_position_question(q))
        self.assertEqual(route_question(q), "resume")

    def test_where_have_i_left_off_main_draft_plot_is_resume(self) -> None:
        q = "Where have I left off in the main draft in terms of plot?"
        self.assertTrue(is_story_position_question(q))
        self.assertEqual(route_question(q), "resume")
        from lorekeeper_reliability import primary_work_hints

        self.assertFalse(primary_work_hints(q))

    def test_summarize_whats_going_on_is_resume_not_person(self) -> None:
        q = "In Cities Of Rust For Me, summarize what's going on"
        self.assertTrue(is_story_position_question(q))
        self.assertEqual(route_question(q), "resume")
        self.assertEqual(extract_what_subject(q), "")

    def test_story_so_far_is_resume(self) -> None:
        q = "Cities Of Rust For Me, what's the story so far"
        self.assertTrue(is_story_position_question(q))
        self.assertEqual(route_question(q), "resume")

    def test_planned_between_leave_off_is_not_resume(self) -> None:
        q = (
            "What do I have planned between the place where I leave off in the "
            "main draft and the warren underground POV?"
        )
        self.assertFalse(is_story_position_question(q))
        self.assertEqual(route_question(q), "writing_next")

    def test_prologue_section_filter(self) -> None:
        hints = extract_section_hints("In Work, what happens in the prologue?")
        self.assertEqual(hints.get("section"), "prologue")
        entries = [
            {
                "id": "p1",
                "title": "Prologue",
                "body": "The gate opens.",
                "tags": ["Work"],
                "kind": "document",
            },
            {
                "id": "c1",
                "title": "Chapter 3",
                "body": "Later events.",
                "tags": ["Work"],
                "kind": "document",
            },
        ]
        scoped = filter_entries_by_section(entries, hints)
        self.assertEqual(len(scoped), 1)
        self.assertIn("Prologue", scoped[0]["title"])

    def test_prologue_from_draft_heading_and_body(self) -> None:
        hints = extract_section_hints("What happens in the prologue?")
        doc_id = "doc-smoke"
        entries = [
            {
                "id": doc_id,
                "title": "Smoke and Mirrors",
                "body": (
                    "Prologue\n\n"
                    "The mirror cracked at dawn.\n\n"
                    "Etherei watched the shards fall.\n\n"
                    "Chapter 1\n\n"
                    "Weeks later the court convened."
                ),
                "tags": ["Smoke and Mirrors"],
                "kind": "document",
            },
            {
                "id": f"{doc_id}#p0",
                "title": "Smoke and Mirrors",
                "body": "Prologue",
                "tags": ["Smoke and Mirrors"],
                "kind": "document",
                "parentDocId": doc_id,
            },
            {
                "id": f"{doc_id}#p1",
                "title": "Smoke and Mirrors",
                "body": "The mirror cracked at dawn.",
                "tags": ["Smoke and Mirrors"],
                "kind": "document",
                "parentDocId": doc_id,
            },
            {
                "id": f"{doc_id}#p2",
                "title": "Smoke and Mirrors",
                "body": "Etherei watched the shards fall.",
                "tags": ["Smoke and Mirrors"],
                "kind": "document",
                "parentDocId": doc_id,
            },
            {
                "id": f"{doc_id}#p3",
                "title": "Smoke and Mirrors",
                "body": "Chapter 1",
                "tags": ["Smoke and Mirrors"],
                "kind": "document",
                "parentDocId": doc_id,
            },
            {
                "id": f"{doc_id}#p4",
                "title": "Smoke and Mirrors",
                "body": "Weeks later the court convened.",
                "tags": ["Smoke and Mirrors"],
                "kind": "document",
                "parentDocId": doc_id,
            },
        ]
        scoped = filter_entries_by_section(entries, hints)
        ids = {str(e.get("id") or "") for e in scoped}
        self.assertIn(f"{doc_id}#p0", ids)
        self.assertIn(f"{doc_id}#p1", ids)
        self.assertIn(f"{doc_id}#p2", ids)
        self.assertNotIn(f"{doc_id}#p3", ids)
        self.assertNotIn(f"{doc_id}#p4", ids)
        self.assertNotIn(doc_id, ids)

    def test_gate_is_not_character_portrait(self) -> None:
        q = "In Ashford Saga, what is the Gate?"
        self.assertFalse(is_character_portrait_question(q))

    def test_kind_of_person_extracts_name(self) -> None:
        q = "In Ashford Saga, what kind of person is Ella?"
        self.assertTrue(is_character_portrait_question(q))
        self.assertEqual(extract_what_subject(q), "Ella")


if __name__ == "__main__":
    unittest.main()
