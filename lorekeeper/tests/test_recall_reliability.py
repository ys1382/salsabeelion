"""Synthetic recall reliability tests (#7–10) — fake names only."""
from __future__ import annotations

import unittest

from lorekeeper_recall import recall_from_user_data
from lorekeeper_reliability import (
    extract_work_hints,
    filter_entries_by_work,
    work_named_in_question,
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
        "tags": tags or [],
        "kind": kind,
        "createdAt": 1,
        "updatedAt": 1,
    }


class RecallReliabilityTests(unittest.TestCase):
    def _ask(self, question: str, entries: list[dict]) -> dict:
        return recall_from_user_data(
            question,
            {"lorekeeper_entries_v1": __import__("json").dumps(entries)},
        )

    def test_strict_work_no_entries_nothing_saved(self):
        entries = [
            _entry("e1", "Kael note", "Kael is the antagonist.", tags=["River Crown"]),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        self.assertTrue(res.get("ok"))
        self.assertEqual(res.get("materialState"), "nothing_saved")
        self.assertIn("Ashford Saga", res.get("answer", ""))
        self.assertNotIn("Kael", res.get("answer", ""))

    def test_character_in_draft_surfaces_excerpt(self):
        entries = [
            _entry(
                "d1#p0",
                "Ashford draft",
                "Character M walked the northern gate at dawn.",
                tags=["Ashford Saga"],
                kind="document",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        self.assertTrue(res.get("ok"))
        self.assertNotEqual(res.get("materialState"), "nothing_saved")
        self.assertTrue(res.get("sources"))

    def test_wrong_work_no_cross_leak(self):
        entries = [
            _entry(
                "e1",
                "Northern tribes",
                "The northern tribes allied with Kael.",
                tags=["River Crown"],
            ),
        ]
        res = self._ask("In Ashford Saga, northern tribes", entries)
        self.assertEqual(res.get("materialState"), "nothing_saved")

    def test_stray_keyword_not_confident_summary(self):
        entries = [
            _entry("e1", "Garden note", "The roses were northern facing.", tags=["Garden"]),
            _entry("e2", "Kitchen", "Soup recipe with thyme.", tags=["Cookbook"]),
        ]
        res = self._ask("northern", entries)
        self.assertTrue(res.get("ok"))
        self.assertIn(res.get("materialState"), ("fragments_only", "summarizable", "nothing_saved"))
        if res.get("sources"):
            self.assertLessEqual(len(res["sources"]), 3)

    def test_demotion_for_scattered_bullets(self):
        entries = [
            _entry("e1", "Bit A", "Northern wind.", tags=["Ashford Saga"]),
            _entry("e2", "Bit B", "Southern rain.", tags=["Ashford Saga"]),
            _entry("e3", "Bit C", "Eastern fog.", tags=["Ashford Saga"]),
            _entry("e4", "Bit D", "Western dust.", tags=["Ashford Saga"]),
        ]
        res = self._ask("In Ashford Saga, summarize politics", entries)
        self.assertTrue(res.get("ok"))
        answer = res.get("answer") or ""
        if res.get("materialState") == "fragments_only":
            self.assertTrue(
                "too scattered" in answer or answer.count("•") <= 2,
                msg=answer,
            )

    def test_character_role_summarizable(self):
        entries = [
            _entry(
                "e1",
                "Character M",
                "Character M is the protagonist of the Ashford rebellion.",
                tags=["Ashford Saga"],
                kind="character",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        self.assertTrue(res.get("ok"))
        self.assertEqual(res.get("materialState"), "summarizable")
        self.assertIn("protagonist", res.get("answer", "").lower())

    def test_work_filter_strict(self):
        entries = [
            _entry("e1", "Note", "Body", tags=["Ashford Saga"]),
            _entry("e2", "Other", "Body", tags=["River Crown"]),
        ]
        hints = extract_work_hints("In Ashford Saga, who is Kael?", entries)
        scoped = filter_entries_by_work(entries, hints, strict=True)
        self.assertEqual(len(scoped), 1)
        self.assertEqual(scoped[0]["id"], "e1")

    def test_work_named_detection(self):
        self.assertTrue(work_named_in_question("In Ashford Saga, who is M?"))
        self.assertFalse(work_named_in_question("Who is Character M?"))
        self.assertTrue(
            work_named_in_question("Can you tell me my Smoke and Mirrors task list?")
        )

    def test_leading_work_title_detection(self):
        from lorekeeper_reliability import explicit_work_hints, work_named_in_question

        known = ["Smoke and Mirrors", "Smoke and Mirror", "Ashford Saga"]
        entries = [
            _entry("e1", "note", "body", tags=["Smoke and Mirrors"]),
            _entry("e2", "note", "body", tags=["Ashford Saga"]),
        ]
        self.assertTrue(
            work_named_in_question(
                "Smoke and Mirrors, who is Character M?",
                known_works=known,
                entries=entries,
            )
        )
        self.assertTrue(
            work_named_in_question(
                "Smoke and Mirrors who is Character M?",
                known_works=known,
                entries=entries,
            )
        )
        self.assertEqual(
            explicit_work_hints("Ashford Saga: who is Character M?", known, entries),
            {"ashford saga"},
        )
        self.assertFalse(
            work_named_in_question(
                "What happened to Etherei in the Prologue?",
                known_works=known,
                entries=entries,
            )
        )

    def test_prologue_in_phrase_not_work_title(self) -> None:
        from lorekeeper_reliability import primary_work_hints, work_named_in_question
        from lorekeeper_section_scope import is_section_scope_phrase

        q = "What happened to Etherei in the Prologue?"
        self.assertTrue(is_section_scope_phrase("the prologue"))
        self.assertFalse(primary_work_hints(q))
        self.assertFalse(work_named_in_question(q))

    def test_prologue_question_finds_draft(self) -> None:
        entries = [
            _entry(
                "d1",
                "Smoke and Mirrors",
                "<p>Prologue</p><p>Etherei fled the hunters.</p><p>Chapter 1</p><p>Later.</p>",
                tags=["Smoke and Mirrors"],
                kind="document",
            ),
        ]
        res = self._ask("What happened to Etherei in the Prologue?", entries)
        self.assertNotEqual(res.get("materialState"), "nothing_saved")
        self.assertIn("Etherei", res.get("answer", ""))


    def test_prologue_of_work_not_work_title(self) -> None:
        from lorekeeper_reliability import primary_work_hints
        from lorekeeper_section_scope import is_section_scope_phrase, work_hint_from_section_phrase

        phrase = "the prologue of smoke and mirrors"
        self.assertTrue(is_section_scope_phrase(phrase))
        self.assertEqual(work_hint_from_section_phrase(phrase), "smoke and mirrors")
        q = "What happened to Etherei in the Prologue of Smoke and Mirrors?"
        self.assertEqual(primary_work_hints(q), {"smoke and mirrors"})

    def test_all_my_notes_on_expression_not_work_title(self) -> None:
        from lorekeeper_reliability import primary_work_hints, extract_work_hints

        q = (
            "Ashford Saga: Describe for me the look on Character A's face "
            "right as Character A's POV ends before Character B catches up to Character C. "
            "all my notes on that expression"
        )
        hints = primary_work_hints(q)
        self.assertNotIn("notes on that expression", hints)
        self.assertFalse(any("expression" in h for h in hints))
        entries = [
            _entry(
                "n1",
                "POV chase beat",
                "Character A — soft stunned look as the POV cuts, right before "
                "Character B catches Character C.",
                tags=["Ashford Saga"],
            )
        ]
        extracted = extract_work_hints(q, entries)
        self.assertNotIn("notes on that expression", extracted)

    def test_scene_expression_question_surfaces_thin_note(self) -> None:
        entries = [
            _entry(
                "n1",
                "POV chase beat",
                "Character A — soft stunned look as the POV cuts, right before "
                "Character B catches Character C. Jaw loose, eyes wide, not angry.",
                tags=["Ashford Saga"],
            ),
        ]
        q = (
            "Ashford Saga: Describe for me the look on Character A's face "
            "right as Character A's POV ends before Character B catches up to Character C. "
            "all my notes on that expression"
        )
        res = self._ask(q, entries)
        answer = res.get("answer") or ""
        self.assertNotEqual(res.get("materialState"), "nothing_saved")
        self.assertNotIn("Notes On That Expression", answer)
        self.assertNotIn("only in your head", answer)
        self.assertIn("stunned", answer.lower())

    def test_my_work_notes_phrase_still_extracts_work(self) -> None:
        from lorekeeper_reliability import primary_work_hints

        self.assertEqual(
            primary_work_hints("Can you tell me my Smoke and Mirrors notes?"),
            {"smoke and mirrors"},
        )
        self.assertEqual(
            primary_work_hints("Can you tell me my Smoke and Mirrors task list?"),
            {"smoke and mirrors"},
        )

    def test_untagged_draft_body_not_only_in_your_head(self) -> None:
        """Premise draft titled something else still counts when the work name is in the body."""
        import json
        from lorekeeper_recall import recall_from_user_data

        docs = [
            {
                "id": "d1",
                "title": "My draft",
                "workTag": "",
                "bodyFormat": "html",
                "bodyHtml": (
                    "<p>Cities Of Rust For Me — premise. Mara scavenges in a rusted "
                    "coastal city. The sea is poison. She finds a forbidden map. "
                    "Rival scavengers want it. The council wants silence.</p>"
                ),
            }
        ]
        res = recall_from_user_data(
            "In Cities Of Rust For Me, summarize what's going on",
            {"lorekeeper_documents_v1": json.dumps(docs)},
        )
        answer = res.get("answer") or ""
        self.assertNotEqual(res.get("materialState"), "nothing_saved")
        self.assertNotIn("only in your head", answer)
        self.assertNotIn("Nothing saved for Cities Of Rust For Me", answer)
        self.assertTrue(
            "Mara" in answer or "rust" in answer.lower() or "map" in answer.lower(),
            msg=answer[:300],
        )


if __name__ == "__main__":
    unittest.main()
