"""Loose-ends tagging — planned gaps vs fix flags (synthetic corpus only)."""
from __future__ import annotations

import json
import unittest

from lorekeeper_loose_ends import (
    collect_loose_end_items,
    entry_is_planned,
    is_flagged_fix_question,
    is_planned_gap_question,
)
from lorekeeper_inference import audit_contradiction_lines_for
from lorekeeper_recall import recall_from_user_data


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
        "tags": tags or ["Project Alpha"],
        "kind": kind,
        "createdAt": 1,
        "updatedAt": 1,
    }


class LooseEndsDetectionTests(unittest.TestCase):
    def test_planned_question_shapes(self):
        self.assertTrue(is_planned_gap_question("In Project Alpha, what's not written yet?"))
        self.assertTrue(is_planned_gap_question("What have I left for later in Project Alpha?"))
        self.assertFalse(is_planned_gap_question("Who is Character A?"))

    def test_fix_question_shapes(self):
        self.assertTrue(is_flagged_fix_question("What's flagged to fix in Project Alpha?"))
        self.assertTrue(is_flagged_fix_question("List my fixes for Project Alpha"))
        self.assertFalse(is_flagged_fix_question("Who is Character A?"))

    def test_collect_planned_from_title_tag_and_body(self):
        entries = [
            _entry("p1", "planned: climax alliance", ""),
            _entry("p2", "Act beats", "• planned: northern treaty\nOther line", tags=["planned"]),
            _entry("p3", "Character A", "Role: guard", tags=["Project Alpha"]),
        ]
        items = collect_loose_end_items(entries, "planned")
        texts = [i["line"].lower() for i in items]
        self.assertTrue(any("climax" in t for t in texts))
        self.assertTrue(any("northern treaty" in t for t in texts))
        self.assertEqual(len(items), 2)

    def test_collect_fix_lines(self):
        entries = [
            _entry("f1", "fix: Character A eye color", "Still debating."),
            _entry("f2", "Notes", "TODO fix: timeline in chapter 2"),
        ]
        items = collect_loose_end_items(entries, "fix")
        self.assertEqual(len(items), 2)

    def test_entry_is_planned(self):
        self.assertTrue(entry_is_planned(_entry("x", "planned: gap", "")))
        self.assertFalse(entry_is_planned(_entry("x", "Character A", "guard")))


class LooseEndsAskTests(unittest.TestCase):
    def _ask(self, question: str, entries: list[dict]) -> dict:
        return recall_from_user_data(
            question,
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )

    def test_ask_planned_gaps_lists_tags_only(self):
        entries = [
            _entry("p1", "planned: finale reveal", ""),
            _entry("c1", "Character A", "Guard captain — fully written."),
        ]
        res = self._ask("In Project Alpha, what's not written yet?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("finale reveal", answer)
        self.assertNotIn("guard captain", answer)
        self.assertEqual(res.get("questionKind"), "planned_gaps")

    def test_ask_planned_empty_is_honest(self):
        entries = [_entry("c1", "Character A", "Guard captain.")]
        res = self._ask("In Project Alpha, what's not written yet?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("nothing tagged as planned", answer)

    def test_ask_flagged_fix_lists_tags_only(self):
        entries = [
            _entry("f1", "fix: Character A age", ""),
            _entry("c1", "Character A", "Tall, quiet."),
        ]
        res = self._ask("In Project Alpha, what's flagged to fix?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("character a age", answer)
        self.assertEqual(res.get("questionKind"), "flagged_fix")

    def test_audit_skips_planned_entry_for_contradictions(self):
        entries = [
            _entry(
                "planned1",
                "planned: Character A is villain",
                "Act 3 — not drafted.",
            ),
            _entry("c1", "Character A", "Character A is the protagonist."),
        ]
        lines = audit_contradiction_lines_for("Character A", entries)
        self.assertEqual(lines, [])


if __name__ == "__main__":
    unittest.main()
