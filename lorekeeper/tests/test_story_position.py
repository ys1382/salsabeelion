"""Tests for where-I-left-off / story resume draft tail."""
from __future__ import annotations

import os
import unittest

from lorekeeper_ask_router import AskPlan
from lorekeeper_recall import local_pipeline_skips_rag, recall_from_user_data
from lorekeeper_story_position import build_story_position_answer


def _smoke_doc_chunks() -> list[dict]:
    doc_id = "doc-smoke"
    tag = "Smoke and Mirrors"
    bodies = [
        "Weeks earlier the court had gathered for ordinary business and adjourned without incident.",
        "Etherei crossed the marble hall while servants whispered about the coming trial.",
        "The herald announced the trial at dawn. Everyone in the gallery fell silent.",
    ]
    entries: list[dict] = [
        {
            "id": doc_id,
            "title": tag,
            "body": "\n\n".join(bodies),
            "tags": [tag],
            "kind": "document",
            "updatedAt": 100,
        }
    ]
    for idx, body in enumerate(bodies):
        entries.append(
            {
                "id": f"{doc_id}#p{idx}",
                "title": tag,
                "body": body,
                "tags": [tag],
                "kind": "document",
                "parentDocId": doc_id,
                "updatedAt": 100,
            }
        )
    return entries


class StoryPositionAnswerTests(unittest.TestCase):
    def test_includes_most_recent_event_from_final_page(self) -> None:
        q = "In Smoke and Mirrors, where did I leave off?"
        answer, _ids = build_story_position_answer(q, _smoke_doc_chunks())
        self.assertIsNotNone(answer)
        assert answer is not None
        low = answer.lower()
        self.assertIn("herald", low)
        self.assertIn("fell silent", low)
        self.assertNotIn("ordinary business", low)

    def test_short_final_beat_still_surfaces(self) -> None:
        doc_id = "doc-short"
        tag = "Ashford Saga"
        entries = [
            {
                "id": doc_id,
                "title": tag,
                "body": "Long earlier scene with plenty of detail about the road and the rain.",
                "tags": [tag],
                "kind": "document",
            },
            {
                "id": f"{doc_id}#p0",
                "title": tag,
                "body": "Long earlier scene with plenty of detail about the road and the rain.",
                "tags": [tag],
                "kind": "document",
                "parentDocId": doc_id,
            },
            {
                "id": f"{doc_id}#p1",
                "title": tag,
                "body": "The gate slammed shut.",
                "tags": [tag],
                "kind": "document",
                "parentDocId": doc_id,
            },
        ]
        answer, _ids = build_story_position_answer(
            "In Ashford Saga, where did I leave off?", entries
        )
        self.assertIsNotNone(answer)
        assert answer is not None
        self.assertIn("gate slammed", answer.lower())

    def test_local_resume_prefers_rag_synthesis(self) -> None:
        q = "In Smoke and Mirrors, where did I leave off?"
        answer, _ids = build_story_position_answer(q, _smoke_doc_chunks())
        self.assertIsNotNone(answer)
        plan = AskPlan(
            intent="story_resume",
            pipeline="rag_resume",
            answer_model="sonnet",
            question_kind="resume",
            use_draft_tail=True,
            router_engine="local",
        )
        pipeline = {
            "questionKind": "resume",
            "materialState": "ok",
            "answer": answer,
            "sources": [],
        }
        self.assertFalse(
            local_pipeline_skips_rag(q, pipeline, _smoke_doc_chunks(), plan=plan)
        )

    def test_draft_tail_block_lists_named_characters(self) -> None:
        from lorekeeper_story_position import draft_tail_prompt_block, named_characters_in_draft_tail

        entries = _smoke_doc_chunks()
        tag = "Smoke and Mirrors"
        for title, body in (
            ("Etherei", "Etherei is the protagonist."),
            ("Mira", "Mira is Etherei's ally."),
            ("Cassian", "Cassian is a court lord."),
        ):
            entries.append(
                {
                    "id": f"note-{title.lower()}",
                    "title": title,
                    "body": body,
                    "tags": [tag],
                    "kind": "note",
                }
            )
        entries.append(
            {
                "id": "note-concept",
                "title": "Predator-Prey situation",
                "body": "The unspoken rules between hunter and hunted.",
                "tags": [tag],
                "kind": "note",
            }
        )
        for idx, entry in enumerate(entries):
            if str(entry.get("id") or "") == "doc-smoke#p2":
                entries[idx] = {
                    **entry,
                    "body": (
                        "Etherei weighed whether to warn Mira and Cassian before the herald "
                        "announced the trial at dawn."
                    ),
                }
                break
        names = named_characters_in_draft_tail(
            entries, "In Smoke and Mirrors, where did I leave off?"
        )
        self.assertIn("Mira", names)
        self.assertIn("Cassian", names)
        self.assertIn("Etherei", names)
        self.assertNotIn("Predator", names)
        self.assertNotIn("Gate", names)
        block = draft_tail_prompt_block(
            entries, "In Smoke and Mirrors, where did I leave off?"
        )
        self.assertIn("Cast names in this beat", block)
        self.assertIn("Mira", block)
        self.assertIn("Cassian", block)
        self.assertNotIn("Predator", block)

    def test_recall_uses_local_tail_without_rag(self) -> None:
        os.environ["LOREKEEPER_RAG"] = "0"
        q = "In Smoke and Mirrors, where did I leave off?"
        res = recall_from_user_data(
            q, {"lorekeeper_entries_v1": __import__("json").dumps(_smoke_doc_chunks())}
        )
        self.assertTrue(res.get("ok"))
        answer = str(res.get("answer") or "").lower()
        self.assertEqual(res.get("recallEngine"), "local")
        self.assertIn("herald", answer)
        self.assertIn("fell silent", answer)

    def test_left_off_main_draft_plot_not_fake_work_title(self) -> None:
        """Owner regression: meta 'main draft / plot' must not become a work title."""
        os.environ["LOREKEEPER_RAG"] = "0"
        doc_id = "doc-chase"
        tag = "Project Alpha"
        entries = [
            {
                "id": doc_id,
                "title": tag,
                "body": "Earlier calm setup in the manor.",
                "tags": [tag],
                "kind": "document",
                "updatedAt": 200,
            },
            {
                "id": f"{doc_id}#p0",
                "title": tag,
                "body": "Earlier calm setup in the manor.",
                "tags": [tag],
                "kind": "document",
                "parentDocId": doc_id,
                "updatedAt": 200,
            },
            {
                "id": f"{doc_id}#p1",
                "title": tag,
                "body": (
                    "Character A sprinted through the alley while Character B closed the gap. "
                    "The chase was for the stolen seal; Character A was tiring and Character B "
                    "still had the longer stride."
                ),
                "tags": [tag],
                "kind": "document",
                "parentDocId": doc_id,
                "updatedAt": 200,
            },
        ]
        q = "Where have I left off in the main draft in terms of plot?"
        res = recall_from_user_data(
            q,
            {"lorekeeper_entries_v1": __import__("json").dumps(entries)},
            scope={"mode": "work", "workTitle": tag},
        )
        self.assertTrue(res.get("ok"))
        answer = str(res.get("answer") or "")
        low = answer.lower()
        self.assertNotIn("nothing is tagged", low)
        self.assertNotIn("the main draft in terms of plot", low)
        self.assertEqual(res.get("questionKind"), "resume")
        self.assertIn("chase", low)
        self.assertIn("stolen seal", low)
        self.assertIn("character a", low)
        self.assertIn("character b", low)

    def test_leave_off_prompt_includes_just_before_and_stakes_notes(self) -> None:
        """Planning brief: prior capture + mistaken-fear note, not sensory-only latest beat."""
        from lorekeeper_story_position import draft_tail_prompt_block

        doc_id = "doc-capture"
        tag = "Project Alpha"
        entries = [
            {
                "id": doc_id,
                "title": tag,
                "body": "setup",
                "tags": [tag],
                "kind": "document",
                "updatedAt": 300,
            },
            {
                "id": f"{doc_id}#p0",
                "title": tag,
                "body": (
                    "Character A outstripped his brothers so they would not be caught "
                    "with him, believing Character B would eat them all."
                ),
                "tags": [tag],
                "kind": "document",
                "parentDocId": doc_id,
                "updatedAt": 300,
            },
            {
                "id": f"{doc_id}#p1",
                "title": tag,
                "body": (
                    "Character B captured Character A and carried him toward the Baron's manor. "
                    "Character A tried once to twist free and failed."
                ),
                "tags": [tag],
                "kind": "document",
                "parentDocId": doc_id,
                "updatedAt": 300,
            },
            {
                "id": f"{doc_id}#p2",
                "title": tag,
                "body": (
                    "Character A's paws were not even touching the ground as Character B "
                    "continued down the path, and Character A dreaded what awaited him."
                ),
                "tags": [tag],
                "kind": "document",
                "parentDocId": doc_id,
                "updatedAt": 300,
            },
            {
                "id": "note-a",
                "title": "Character A",
                "body": (
                    "Character A fears he will be eaten. That fear is incorrect — "
                    "Character B is taking him to the Baron, not as prey."
                ),
                "tags": [tag],
                "kind": "character",
            },
            {
                "id": "note-b",
                "title": "Character B",
                "body": "Character B is a wolf escort, not a simple predator meal.",
                "tags": [tag],
                "kind": "character",
            },
        ]
        q = "In Project Alpha, where did I leave off in the main draft in terms of plot?"
        block = draft_tail_prompt_block(entries, q)
        self.assertIn("[LATEST]", block)
        self.assertIn("[JUST_BEFORE]", block)
        self.assertIn("outstripped his brothers", block)
        self.assertIn("Baron's manor", block)
        self.assertIn("Related notes for this beat", block)
        self.assertIn("fear is incorrect", block.lower())
        self.assertIn("planning brief", block.lower())
        self.assertIn("formal librarian", block.lower())


if __name__ == "__main__":
    unittest.main()
