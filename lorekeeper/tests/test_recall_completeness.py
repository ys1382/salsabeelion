"""Phase 3 recall completeness tests (#34–40) — synthetic corpus only."""
from __future__ import annotations

import json
import unittest

from lorekeeper_recall import recall_from_user_data
from lorekeeper_recall_scope import merge_recall_user_data
from lorekeeper_work_recall import route_question


class RecallCompletenessTests(unittest.TestCase):
    def test_merge_client_overrides_server_by_id(self):
        server = {
            "lorekeeper_entries_v1": json.dumps(
                [{"id": "a", "title": "Old", "body": "stale", "tags": ["Work A"], "kind": "note"}]
            ),
            "lorekeeper_documents_v1": json.dumps(
                [{"id": "d1", "title": "Old doc", "workTag": "Work A", "bodyHtml": "<p>old</p>", "bodyFormat": "html"}]
            ),
        }
        merged = merge_recall_user_data(
            server,
            client_entries=[
                {"id": "a", "title": "Fresh", "body": "current note", "tags": ["Work A"], "kind": "note"},
                {"id": "b", "title": "New", "body": "only on device", "tags": ["Work A"], "kind": "note"},
            ],
            client_documents=[
                {
                    "id": "d1",
                    "title": "Fresh doc",
                    "workTag": "Work A",
                    "bodyHtml": "<p>draft paragraph about the northern gate.</p>",
                    "bodyFormat": "html",
                }
            ],
        )
        entries = json.loads(merged["lorekeeper_entries_v1"])
        by_id = {e["id"]: e for e in entries}
        self.assertEqual(by_id["a"]["body"], "current note")
        self.assertIn("b", by_id)
        docs = json.loads(merged["lorekeeper_documents_v1"])
        self.assertEqual(docs[0]["title"], "Fresh doc")

    def test_draft_only_client_doc_is_searchable(self):
        res = recall_from_user_data(
            "In Ember Vale, where is the northern gate?",
            {},
            client_documents=[
                {
                    "id": "doc-1",
                    "title": "Ember Vale draft",
                    "workTag": "Ember Vale",
                    "bodyHtml": "<p>The northern gate stands at the cliff edge above the river.</p>",
                    "bodyFormat": "html",
                }
            ],
        )
        self.assertTrue(res.get("ok"))
        answer = (res.get("answer") or "").lower()
        self.assertIn("northern gate", answer)
        self.assertNotEqual(res.get("materialState"), "nothing_saved")

    def test_work_disambiguation_same_name_two_projects(self):
        entries = [
            {
                "id": "1",
                "title": "Ashford note",
                "body": "Character M is the captain.",
                "tags": ["Ashford Saga"],
                "kind": "note",
            },
            {
                "id": "2",
                "title": "Mirrors note",
                "body": "Character M is the healer.",
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            },
        ]
        res = recall_from_user_data(
            "Who is Character M?",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = res.get("answer") or ""
        self.assertIn("Ashford Saga", answer)
        self.assertIn("Smoke and Mirrors", answer)
        self.assertIn("does not mix projects", answer)

    def test_named_work_skips_disambiguation(self):
        entries = [
            {
                "id": "1",
                "title": "Ashford note",
                "body": "Character M is the captain of the guard.",
                "tags": ["Ashford Saga"],
                "kind": "note",
            },
            {
                "id": "2",
                "title": "Mirrors note",
                "body": "Character M is the healer.",
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            },
        ]
        res = recall_from_user_data(
            "In Ashford Saga, who is Character M?",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertNotIn("more than one project", answer)
        self.assertTrue("captain" in answer or "character m" in answer)

    def test_leading_title_skips_disambiguation(self):
        entries = [
            {
                "id": "1",
                "title": "Mirrors note",
                "body": "Character M is the healer.",
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            },
            {
                "id": "2",
                "title": "Mirror typo tag",
                "body": "Character M is the captain.",
                "tags": ["Smoke and Mirror"],
                "kind": "note",
            },
        ]
        for q in (
            "Smoke and Mirrors, who is Character M?",
            "Smoke and Mirrors who is Character M?",
        ):
            res = recall_from_user_data(
                q,
                {"lorekeeper_entries_v1": json.dumps(entries)},
            )
            answer = (res.get("answer") or "").lower()
            self.assertNotIn("more than one project", answer, msg=q)
            self.assertTrue("healer" in answer or "character m" in answer, msg=q)

    def test_leading_title_scopes_other_work(self):
        entries = [
            {
                "id": "1",
                "title": "Ashford note",
                "body": "Character M is the captain of the guard.",
                "tags": ["Ashford Saga"],
                "kind": "note",
            },
            {
                "id": "2",
                "title": "Mirrors note",
                "body": "Character M is the healer.",
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            },
        ]
        res = recall_from_user_data(
            "Ashford Saga: who is Character M?",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertNotIn("more than one project", answer)
        self.assertTrue("captain" in answer or "character m" in answer)

    def test_my_work_phrase_skips_disambiguation(self):
        entries = [
            {
                "id": "1",
                "title": "Mirrors note",
                "body": "planned: write the ballroom scene.",
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            },
            {
                "id": "2",
                "title": "Mirror typo tag",
                "body": "planned: other project.",
                "tags": ["Smoke and Mirror"],
                "kind": "note",
            },
        ]
        q = (
            "Can you tell me my Smoke and Mirrors task list, "
            "aside from sections that come after the point I have just left off?"
        )
        res = recall_from_user_data(
            q,
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = res.get("answer") or ""
        self.assertNotIn("more than one project", answer)

    def test_near_duplicate_work_tags_no_false_disambiguation(self):
        from lorekeeper_recall_scope import check_work_disambiguation

        entries = [
            {"id": "1", "title": "n", "body": "x", "tags": ["Smoke and Mirrors"], "kind": "note"},
            {"id": "2", "title": "n", "body": "x", "tags": ["Smoke and Mirror"], "kind": "note"},
        ]
        q = "List notes for Smoke and Mirrors"
        self.assertIsNone(check_work_disambiguation(q, entries))

    def test_typed_full_title_beats_tag_missing_trailing_s(self):
        entries = [
            {
                "id": "1",
                "title": "n",
                "body": "planned: ballroom scene.",
                "tags": ["Smoke and Mirrors"],
                "kind": "note",
            },
            {
                "id": "2",
                "title": "n",
                "body": "planned: stray tag.",
                "tags": ["Smoke and Mirror"],
                "kind": "note",
            },
        ]
        q = "In Smoke and Mirrors, list my task list"
        res = recall_from_user_data(
            q,
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        self.assertNotIn("more than one project", res.get("answer") or "")
        from lorekeeper_reliability import extract_work_hints

        self.assertEqual(extract_work_hints(q, entries), {"smoke and mirrors"})

    def test_one_letter_typo_tags_are_same_project(self):
        from lorekeeper_recall_scope import check_work_disambiguation
        from lorekeeper_reliability import extract_work_hints, work_tags_are_typo_variants

        self.assertTrue(work_tags_are_typo_variants("The Snow Leopard", "The Snow Leopar"))
        entries = [
            {
                "id": "1",
                "title": "n",
                "body": "planned: opening hunt scene.",
                "tags": ["The Snow Leopard"],
                "kind": "note",
            },
            {
                "id": "2",
                "title": "n",
                "body": "planned: typo tag note.",
                "tags": ["The Snow Leopar"],
                "kind": "note",
            },
        ]
        q = "In The Snow Leopard, list my task list"
        self.assertIsNone(check_work_disambiguation(q, entries))
        hints = extract_work_hints(q, entries)
        self.assertEqual(len(hints), 1)
        self.assertIn("snow leopard", next(iter(hints)))
        res = recall_from_user_data(q, {"lorekeeper_entries_v1": json.dumps(entries)})
        self.assertNotIn("more than one project", res.get("answer") or "")

    def test_fallback_prefers_single_best_excerpt(self):
        entries = [
            {
                "id": "1",
                "title": "Loose note",
                "body": "The northern gate rusted hinges need oil sometimes.",
                "tags": ["Ashford Saga"],
                "kind": "note",
            },
            {
                "id": "2",
                "title": "Other note",
                "body": "Northern winds blow through the gate at dawn.",
                "tags": ["Ashford Saga"],
                "kind": "note",
            },
        ]
        res = recall_from_user_data(
            "In Ashford Saga, northern gate",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = res.get("answer") or ""
        self.assertTrue("Closest match" in answer or "From your entry" in answer)
        self.assertNotIn("• Loose note", answer)

    def test_route_where_when_list(self):
        self.assertEqual(route_question("In Ashford Saga, where is the northern gate?"), "where")
        self.assertEqual(route_question("In Ashford Saga, when did the war start?"), "when")
        self.assertEqual(route_question("In Ashford Saga, list the factions"), "list")


if __name__ == "__main__":
    unittest.main()
