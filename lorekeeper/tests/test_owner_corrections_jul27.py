"""Synthetic regressions from Owner's Office Ask corrections (Jul 2026)."""
from __future__ import annotations

import json
import unittest

from lorekeeper_answer_focus import scrub_unsupported_identity_claims
from lorekeeper_notes_vs_draft import (
    collect_notes_not_in_draft,
    extract_after_anchors,
    is_notes_not_in_draft_question,
)
from lorekeeper_recall import recall_from_user_data
from lorekeeper_work_membership import normalize_work_key
from lorekeeper_work_recall import route_question


def _entry(eid, title, body, *, tags=None, kind="note"):
    return {
        "id": eid,
        "title": title,
        "body": body,
        "tags": tags or ["Ashford Saga"],
        "kind": kind,
        "createdAt": 1,
        "updatedAt": 1,
    }


class WorkTitleFoldingTests(unittest.TestCase):
    def test_ampersand_equals_and(self):
        self.assertEqual(
            normalize_work_key("Smoke & Mirrors"),
            normalize_work_key("Smoke and Mirrors"),
        )


class NotesNotInDraftPhrasingTests(unittest.TestCase):
    def test_made_it_into_phrasing(self):
        q = (
            "Smoke and Mirrors: Remind me of everything in notes that "
            "haven't made it into the main draft"
        )
        self.assertTrue(is_notes_not_in_draft_question(q))
        self.assertEqual(route_question(q), "notes_not_in_draft")

    def test_after_anchor_extract(self):
        q = (
            "show me everything that's not yet in the main draft "
            "after the bridge chase, including whatever happens after "
            "Character M is captured"
        )
        anchors = extract_after_anchors(q)
        blob = " ".join(anchors).lower()
        self.assertIn("bridge", blob)
        self.assertTrue("captured" in blob or "character m" in blob)

    def test_planned_notes_included(self):
        entries = [
            _entry(
                "n1",
                "Later beat",
                "planned: Character M escapes the manor cellar.",
            ),
            _entry(
                "d1",
                "Draft",
                "Character M fled across the bridge.",
                kind="document",
            ),
        ]
        unused, has_notes, has_draft = collect_notes_not_in_draft(entries)
        self.assertTrue(has_notes and has_draft)
        lines = " ".join(r["line"] for r in unused).lower()
        self.assertIn("escapes", lines)


class SpeciesFromDraftTests(unittest.TestCase):
    def test_what_is_includes_draft_species(self):
        entries = [
            _entry(
                "n1",
                "Duke Marrow",
                "Duke Marrow is the second cousin of Lord Ashen.",
                kind="character",
            ),
            _entry(
                "d1",
                "Draft",
                "Duke Marrow is a Eurasian Lynx. He keeps a quiet court.",
                kind="document",
            ),
        ]
        res = recall_from_user_data(
            "In Ashford Saga, what is Duke Marrow?",
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )
        answer = (res.get("answer") or "").lower()
        self.assertIn("lynx", answer)


class NoInventionScrubTests(unittest.TestCase):
    def test_drops_unsupported_species_claim(self):
        answer = (
            "Sentinel Oakfern is a bird who watches the cliff. "
            "Preyfolk birds roost there.\n\n"
            "— From your notes only. Nothing invented."
        )
        sources = [
            {
                "title": "Sentinel Oakfern",
                "excerpt": "Sentinel Oakfern is a rabbit who guards the gate.",
            },
            {
                "title": "Birds",
                "excerpt": "Preyfolk birds roost on the cliff.",
            },
        ]
        out = scrub_unsupported_identity_claims(answer, sources)
        self.assertNotIn("is a bird", out.lower())
        self.assertIn("birds", out.lower())


if __name__ == "__main__":
    unittest.main()
