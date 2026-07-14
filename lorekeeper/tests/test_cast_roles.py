"""Cast role tests (#14) — synthetic names only."""
from __future__ import annotations

import json
import unittest

from lorekeeper_cast_roles import (
    extract_explicit_cast_role,
    format_cast_role_reference,
    merge_explicit_and_inferred,
)
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
        "tags": tags or ["Ashford Saga"],
        "kind": kind,
        "createdAt": 1,
        "updatedAt": 1,
    }


class CastRoleTests(unittest.TestCase):
    def _ask(self, question: str, entries: list[dict]) -> dict:
        return recall_from_user_data(
            question,
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )

    def test_format_cast_role_reference(self):
        self.assertEqual(
            format_cast_role_reference("Character M", "protagonist"),
            "Character M is the protagonist.",
        )
        self.assertEqual(
            format_cast_role_reference("Character M", "side character"),
            "Character M is a side character.",
        )
        self.assertEqual(
            format_cast_role_reference("Character M", "villain"),
            "Character M is the villain.",
        )

    def test_extract_explicit_cast_role_patterns(self):
        self.assertEqual(
            extract_explicit_cast_role(
                "Character M", "Character M is the antagonist of the northern gate."
            ),
            "Character M is the antagonist.",
        )
        self.assertEqual(
            extract_explicit_cast_role(
                "Character M", "Character M, the deuteragonist, watches the gate."
            ),
            "Character M is the deuteragonist.",
        )
        self.assertEqual(
            extract_explicit_cast_role(
                "Character M", "Character M — supporting character in the rebellion."
            ),
            "Character M is a supporting character.",
        )

    def test_explicit_role_wins_over_inferred(self):
        explicit = ["Character M is married to Character C."]
        inferred = "Character M is the main character."
        merged = merge_explicit_and_inferred(explicit, inferred, label="Character M")
        self.assertEqual(merged, explicit + [inferred])

        explicit_role = ["Character M is the villain."]
        merged = merge_explicit_and_inferred(explicit_role, inferred, label="Character M")
        self.assertEqual(merged, explicit_role)

    def test_explicit_side_character_in_who_is(self):
        entries = [
            _entry(
                "e1",
                "Cast notes",
                "Character M is a side character. Appears in the market scenes.",
                kind="character",
            ),
            _entry(
                "e2",
                "Ashford draft",
                " ".join(["Character M walked. Character M spoke. Character M waited."] * 8),
                kind="document",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        answer = res.get("answer") or ""
        self.assertIn("side character", answer.lower())
        self.assertNotIn("main character", answer.lower())

    def test_explicit_villain_not_relabeled(self):
        entries = [
            _entry(
                "e1",
                "Villain sheet",
                "Character M is the villain. Commands the northern gate.",
                kind="character",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("villain", answer)
        self.assertNotIn("antagonist", answer)

    def test_draft_centering_without_role_uses_main_character(self):
        entries = [
            _entry(
                "e1",
                "Ashford draft",
                " ".join(
                    [
                        "Character M turned toward the gate.",
                        "Character M crossed the hall.",
                        "Character M waited in silence.",
                    ]
                    * 5
                ),
                kind="document",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertTrue(
            "main character" in answer or "appears" in answer or "viewpoint" in answer
        )
        self.assertNotIn("protagonist", answer)

    def test_explicit_protagonist_beats_draft_noise(self):
        entries = [
            _entry(
                "e1",
                "Cast",
                "Character M is the protagonist.",
                kind="character",
            ),
            _entry(
                "e2",
                "Other lead",
                "Character C is the protagonist of the southern arc.",
                kind="character",
            ),
            _entry(
                "e3",
                "Draft",
                "Character C walked. Character C spoke. Character C ran.",
                kind="document",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("protagonist", answer)
        self.assertNotIn("character c", answer)


if __name__ == "__main__":
    unittest.main()
