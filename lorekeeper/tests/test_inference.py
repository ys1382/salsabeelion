"""Logic-puzzle inference tests (#16) — synthetic names only."""
from __future__ import annotations

import json
import unittest

from lorekeeper_inference import (
    audit_contradiction_lines_for,
    build_character_brief,
    inference_reference_lines_for,
    _detect_contradictions,
    _infer_species_traits,
    _vocative_ties,
)
from lorekeeper_character_compose import compose_character_reference
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
        "tags": tags or ["Smoke and Mirrors"],
        "kind": kind,
        "createdAt": 1,
        "updatedAt": 1,
    }


class InferenceTests(unittest.TestCase):
    def _ask(self, question: str, entries: list[dict]) -> dict:
        return recall_from_user_data(
            question,
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )

    def test_brother_from_dialogue_prior_sentence(self):
        entries = [
            _entry(
                "d1#p0",
                "Smoke draft",
                'Character B turned. "Brother," Character A said.',
                kind="document",
            ),
            _entry(
                "c1",
                "Character A scrap",
                "Character A — grey skin, tall.",
                kind="character",
            ),
        ]
        brief = build_character_brief("Character A", entries)
        ties = [t.lower() for t in brief.get("ties") or []]
        self.assertTrue(any("brother to character b" in t for t in ties), msg=brief)

        res = self._ask("In Smoke and Mirrors, who is Character A?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("brother", answer)
        self.assertIn("character b", answer)

    def test_species_cross_link_when_writer_tied_character(self):
        entries = [
            _entry(
                "sp1",
                "Species note",
                "Arcanists: grey-skinned, long-lived. Character A is one.",
                kind="species",
            ),
            _entry(
                "c1",
                "Character A scrap",
                "Character A — tall, speaks softly.",
                kind="character",
            ),
        ]
        traits = _infer_species_traits("Character A", entries)
        self.assertTrue(traits, msg=traits)
        self.assertRegex(" ".join(traits).lower(), r"arcanist")

        res = self._ask("In Smoke and Mirrors, who is Character A?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("arcanist", answer)

    def test_species_not_inferred_without_writer_link(self):
        entries = [
            _entry(
                "sp1",
                "Species note",
                "Arcanists: grey-skinned, long-lived.",
                kind="species",
            ),
            _entry(
                "c1",
                "Character A scrap",
                "Character A — grey skin, tall.",
                kind="character",
            ),
        ]
        traits = _infer_species_traits("Character A", entries)
        self.assertEqual(traits, [])

    def test_side_antagonist_not_species_token(self):
        entries = [
            _entry(
                "c1",
                "Character M",
                "Character M is a side antagonist in Smoke and Mirrors. He is a Wolf.",
                kind="character",
            ),
            _entry(
                "sp1",
                "Species",
                "Wolf: male or female. Character M is one of them.",
                kind="species",
            ),
        ]
        traits = _infer_species_traits("Character M", entries)
        joined = " ".join(traits).lower()
        self.assertNotIn("an side", joined)
        self.assertNotIn("an of", joined)
        self.assertNotIn("male or female", joined)
        self.assertIn("male", joined)
        self.assertIn("wolf", joined)

    def test_pov_from_draft_prose(self):
        entries = [
            _entry(
                "d1#p0",
                "Smoke draft",
                "Character A walked the northern gate. Character A felt the wind rise.",
                kind="document",
            ),
        ]
        brief = build_character_brief("Character A", entries)
        role = (brief.get("role") or "").lower()
        self.assertTrue(
            "main character" in role or "viewpoint" in role or "protagonist" in role,
            msg=brief,
        )

    def test_contradictions_surface_without_smoothing(self):
        entries = [
            _entry("r1", "Marriage A", "Character A is married to Character C."),
            _entry("r2", "Marriage B", "Character A is married to Character D."),
        ]
        contradictions = audit_contradiction_lines_for("Character A", entries)
        self.assertTrue(contradictions)
        self.assertIn("disagree", contradictions[0].lower())

        res = self._ask(
            "In Smoke and Mirrors, what discrepancies do I have for Character A?",
            entries,
        )
        answer = res.get("answer") or ""
        low = answer.lower()
        self.assertIn("this note", low)
        self.assertIn("that note", low)
        self.assertIn("character c", low)
        self.assertIn("character d", low)
        self.assertNotIn("this is what the main draft says:", low)
        self.assertNotIn("this is what your notes say:", low)

    def test_whois_omits_contradictions(self):
        entries = [
            _entry("r1", "Marriage A", "Character A is married to Character C."),
            _entry("r2", "Marriage B", "Character A is married to Character D."),
        ]
        brief = build_character_brief("Character A", entries)
        composed = compose_character_reference(
            "Character A",
            brief=brief,
            roles=[],
            identity=[],
            relationships=[],
            details=[],
            dialogue=[],
            scenes=[],
            work_title="Smoke and Mirrors",
        )
        self.assertNotIn("disagree", composed.lower())

    def test_inference_reference_lines_bundle(self):
        entries = [
            _entry(
                "d1#p0",
                "Smoke draft",
                'Character B turned. "Brother," Character A said.',
                kind="document",
            ),
            _entry(
                "sp1",
                "Species note",
                "Arcanists: grey-skinned. Character A is one.",
                kind="species",
            ),
        ]
        lines = inference_reference_lines_for("Character A", entries)
        joined = " ".join(lines).lower()
        self.assertIn("brother", joined)
        self.assertIn("arcanist", joined)

    def test_vocative_tie_cross_sentence(self):
        entries = [
            _entry(
                "d1#p0",
                "Scene",
                'Character B turned. "Brother," Character A said.',
                kind="document",
            ),
        ]
        ties = _vocative_ties("Character A", entries)
        self.assertTrue(any("Character B" in t for t in ties), msg=ties)


if __name__ == "__main__":
    unittest.main()
