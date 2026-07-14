"""Alias and identity-direction tests — synthetic names only."""
from __future__ import annotations

import json
import os
import unittest
from unittest import mock

from lorekeeper_aliases import (
    alias_reference_lines_for,
    collect_alias_facts,
    expand_character_names,
)
from lorekeeper_recall import recall_from_user_data


def _entry(eid: str, body: str, *, tags: list[str] | None = None) -> dict:
    return {
        "id": eid,
        "title": "Names",
        "body": body,
        "tags": tags or ["Fairy Tale"],
        "kind": "note",
    }


class AliasTests(unittest.TestCase):
    def setUp(self):
        self._env = mock.patch.dict(os.environ, {"LOREKEEPER_RAG": "0"}, clear=False)
        self._env.start()

    def tearDown(self):
        self._env.stop()

    def test_known_by_direction_not_flipped(self):
        entries = [
            _entry(
                "n1",
                "Character A is known by Character B by the name Ella. "
                "Character B has shared this name of Character A's with people Character B trusts.",
            )
        ]
        hints = {"fairy tale"}
        a_lines = alias_reference_lines_for("Character A", entries, hints)
        b_lines = alias_reference_lines_for("Character B", entries, hints)
        self.assertTrue(any("known to Character B as Ella" in line for line in a_lines))
        self.assertFalse(any("known to Character A" in line for line in a_lines))
        self.assertTrue(any("knows Character A as Ella" in line for line in b_lines))
        self.assertFalse(any("known by Character A" in line for line in b_lines))
        self.assertTrue(
            any("shared Character A's name" in line for line in a_lines + b_lines)
        )

    def test_expand_links_alias_name(self):
        entries = [
            _entry("n1", "Character A is known by Character B by the name Ella."),
        ]
        expanded = expand_character_names("Character A", entries, {"fairy tale"})
        keys = {n.lower() for n in expanded}
        self.assertIn("character a", keys)
        self.assertIn("ella", keys)
        self.assertIn("character b", keys)

    def test_same_person_also_known_as(self):
        entries = [_entry("n1", "Ella is also known as Cinder Ella.")]
        facts = collect_alias_facts(entries, {"fairy tale"})
        self.assertEqual(len(facts), 1)
        self.assertEqual(facts[0].kind, "same_person")
        lines = alias_reference_lines_for("Ella", entries, {"fairy tale"})
        self.assertTrue(any("also known as" in line for line in lines))

    def test_who_is_includes_alias_in_local_recall(self):
        entries = [
            _entry(
                "n1",
                "Character A is the protagonist. "
                "Character A is known by Character B by the name Ella.",
            )
        ]
        res = recall_from_user_data(
            "In Fairy Tale, who is Character A?",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertIn("known to character b as ella", answer)
        self.assertNotIn("known to character a", answer)
        self.assertNotIn("known by character a", answer)


    def test_thin_note_rich_document_who_is(self):
        entries = [
            _entry(
                "n1",
                "Character M is mentioned in the opening chapter.",
                tags=["Ashford Saga"],
            ),
        ]
        docs = [
            {
                "id": "d1",
                "title": "Ashford draft",
                "workTag": "Ashford Saga",
                "bodyFormat": "html",
                "bodyHtml": (
                    "<p>Character M stood at the northern gate, a grey-skinned arcanist. "
                    "Commanders deferred to Character M whenever the bridge was threatened.</p>"
                ),
            }
        ]
        res = recall_from_user_data(
            "In Ashford Saga, who is Character M?",
            {},
            client_documents=docs,
            client_entries=entries,
        )
        answer = (res.get("answer") or "").lower()
        self.assertTrue(res.get("ok"))
        self.assertNotIn("little is spelled out yet", answer)
        self.assertTrue(
            "arcanist" in answer or "grey" in answer or "commanders" in answer,
            msg=answer,
        )


if __name__ == "__main__":
    unittest.main()
