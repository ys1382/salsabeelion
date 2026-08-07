"""Synthetic character compose tests (#11–13) — fake names only."""
from __future__ import annotations

import json
import unittest

from lorekeeper_character_compose import (
    _is_plot_arc_clause,
    compose_character_gap_reference,
    compose_character_reference,
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
        "tags": tags or [],
        "kind": kind,
        "createdAt": 1,
        "updatedAt": 1,
    }


class CharacterComposeTests(unittest.TestCase):
    def _ask(self, question: str, entries: list[dict]) -> dict:
        return recall_from_user_data(
            question,
            {"lorekeeper_entries_v1": json.dumps(entries)},
        )

    def test_who_is_composed_paragraph_not_scraps(self):
        entries = [
            _entry(
                "e1",
                "Cast",
                "Character M is the protagonist of Ashford. Grey-skinned arcanist. Married to Character C.",
                tags=["Ashford Saga"],
                kind="character",
            ),
            _entry(
                "e2",
                "Ashford draft",
                'Character M turned. "Brother," he said to Character B at the northern gate.',
                tags=["Ashford Saga"],
                kind="document",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        self.assertTrue(res.get("ok"))
        answer = res.get("answer") or ""
        self.assertEqual(res.get("materialState"), "summarizable")
        self.assertNotIn("from what you've saved", answer.lower())
        self.assertNotIn("•", answer)
        self.assertIn("protagonist", answer.lower())
        self.assertIn("married", answer.lower())
        self.assertIn("Character C", answer)
        self.assertIn("grey", answer.lower())

    def test_draft_paragraph_chunks_merged(self):
        entries = [
            _entry(
                "d1#p0",
                "Ashford draft",
                "Character M is the antagonist who rules the northern gate.",
                tags=["Ashford Saga"],
                kind="document",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        answer = res.get("answer") or ""
        self.assertIn("antagonist", answer.lower())

    def test_proper_name_who_is_summarizable_not_demoted(self):
        entries = [
            _entry(
                "e1",
                "Marcus",
                "Marcus is the antagonist. Tall, grey-skinned. Brother to Character B.",
                tags=["River Crown"],
                kind="character",
            ),
        ]
        res = self._ask("In River Crown, who is Marcus?", entries)
        answer = res.get("answer") or ""
        self.assertEqual(res.get("materialState"), "summarizable")
        self.assertNotIn("From what you've written:", answer)
        self.assertNotIn("too scattered", answer)
        self.assertIn("Marcus", answer)
        self.assertIn("antagonist", answer.lower())

    def test_composed_not_replaced_by_scrap_demotion(self):
        entries = [
            _entry(
                "e1",
                "Cast",
                "Character M is the protagonist. Married to Character C.",
                tags=["Ashford Saga"],
                kind="character",
            ),
            _entry("e2", "A", "Northern wind.", tags=["Ashford Saga"]),
            _entry("e3", "B", "Southern rain.", tags=["Ashford Saga"]),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        answer = res.get("answer") or ""
        self.assertEqual(res.get("materialState"), "summarizable")
        self.assertNotIn("•", answer)
        self.assertIn("protagonist", answer.lower())

    def test_who_is_never_demoted_to_ranked_scraps(self):
        long_draft = " ".join(
            ["Etherei turned. The hall went dark. Etherei spoke softly."] * 20
        )
        entries = [
            _entry(
                "e1",
                "Etherei",
                "Etherei is the shadow guardian.",
                tags=["Veil Chronicle"],
                kind="character",
            ),
            _entry(
                "e2",
                "Veil draft",
                long_draft,
                tags=["Veil Chronicle"],
                kind="document",
            ),
        ]
        res = self._ask("In Veil Chronicle, who is Etherei?", entries)
        answer = res.get("answer") or ""
        self.assertNotIn("From what you've written", answer)
        self.assertNotIn("too scattered", answer)
        self.assertNotIn("turned", answer.lower())
        self.assertIn("guardian", answer.lower())

    def test_draft_only_scenes_get_partial_not_scrap_bullets(self):
        entries = [
            _entry(
                "e1",
                "Veil draft",
                "Etherei turned. Etherei walked. Etherei said hello.",
                tags=["Veil Chronicle"],
                kind="document",
            ),
        ]
        res = self._ask("In Veil Chronicle, who is Etherei?", entries)
        answer = res.get("answer") or ""
        self.assertNotIn("From what you've written", answer)
        self.assertNotIn("•", answer)
        self.assertNotIn("turned", answer.lower())
        self.assertTrue(
            "main character" in answer.lower() or "appears" in answer.lower()
        )

    def test_html_entities_stripped_and_narrative_excluded(self):
        entries = [
            _entry(
                "e1",
                "Etherei",
                "Etherei is the shadow guardian. Grey-skinned.",
                tags=["Veil Chronicle"],
                kind="character",
            ),
            _entry(
                "e2",
                "Veil draft",
                "It is the same shape as a large leaf&nbsp;. Etherei watched the gate.",
                tags=["Veil Chronicle"],
                kind="document",
            ),
        ]
        res = self._ask("In Veil Chronicle, who is Etherei?", entries)
        answer = res.get("answer") or ""
        self.assertNotIn("&nbsp;", answer)
        self.assertNotIn("large leaf", answer.lower())
        self.assertIn("guardian", answer.lower())

    def test_notes_plus_draft_no_scene_scraps(self):
        long_draft = " ".join(
            [
                "Etherei turned toward the gate and watched the rain.",
                "The hall fell silent when Etherei entered.",
                "Etherei crossed the room without speaking.",
            ]
            * 4
        )
        entries = [
            _entry(
                "e1",
                "Etherei",
                "Etherei is the shadow guardian of the north gate. Grey-skinned arcanist.",
                tags=["Veil Chronicle"],
                kind="character",
            ),
            _entry(
                "e2",
                "Veil draft",
                long_draft,
                tags=["Veil Chronicle"],
                kind="document",
            ),
            _entry(
                "e3",
                "Relations",
                "Etherei is married to Character C.",
                tags=["Veil Chronicle"],
                kind="relationship",
            ),
        ]
        res = self._ask("In Veil Chronicle, who is Etherei?", entries)
        answer = res.get("answer") or ""
        self.assertEqual(res.get("materialState"), "summarizable")
        self.assertNotIn("turned toward", answer.lower())
        self.assertNotIn("fell silent", answer.lower())
        self.assertIn("guardian", answer.lower())
        self.assertIn("married", answer.lower())

    def test_planning_line_in_draft_excluded(self):
        entries = [
            _entry(
                "e1",
                "Draft plan",
                (
                    "I think Chapter 2 could start at the same time as the Etherei reveal. "
                    "Maybe move the gate scene earlier. Etherei is the shadow guardian of the north gate."
                ),
                tags=["Veil Chronicle"],
                kind="document",
            ),
        ]
        res = self._ask("In Veil Chronicle, who is Etherei?", entries)
        answer = res.get("answer") or ""
        self.assertNotIn("Chapter 2", answer)
        self.assertNotIn("I think", answer)
        self.assertIn("guardian", answer.lower())

    def test_planning_only_gets_partial_not_false_summary(self):
        entries = [
            _entry(
                "e1",
                "Outline",
                "I think Chapter 2 could start at the same time as the Etherei confrontation.",
                tags=["Veil Chronicle"],
            ),
        ]
        res = self._ask("In Veil Chronicle, who is Etherei?", entries)
        answer = res.get("answer") or ""
        self.assertNotIn("Chapter 2", answer)
        self.assertNotIn("I think", answer)
        self.assertIn(res.get("materialState"), ("fragments_only", "nothing_saved"))

    def test_background_note_not_treated_as_full_cast_sheet(self):
        entries = [
            _entry(
                "e1",
                "Etherei's background",
                (
                    "Etherei was born in the northern district. "
                    "He grew up among the traders. His childhood was difficult."
                ),
                tags=["Smoke and Mirrors"],
                kind="character",
            ),
        ]
        res = self._ask("In Smoke and Mirrors, who is Etherei?", entries)
        answer = res.get("answer") or ""
        self.assertNotIn("born in the northern", answer.lower())
        self.assertNotIn("childhood was difficult", answer.lower())
        self.assertIn(res.get("materialState"), ("fragments_only", "summarizable"))
        if res.get("materialState") == "summarizable":
            self.assertRegex(answer.lower(), r"etherei is (the )?(protagonist|antagonist|main character|married|brother|guardian)")

        entries = [
            _entry("n1", "Scrap A", "Etherei at the gate.", tags=["Smoke and Mirrors"]),
            _entry("n2", "Scrap B", "Etherei speaks.", tags=["Smoke and Mirrors"]),
            _entry("n3", "Scrap C", "Etherei waits.", tags=["Smoke and Mirrors"]),
        ]
        res = self._ask("In Smoke and Mirrors, who is Etherei?", entries)
        answer = res.get("answer") or ""
        self.assertNotIn("1 saved place", answer)
        self.assertTrue(
            "3 saved places" in answer
            or "three saved places" in answer.lower()
            or "protagonist" in answer.lower()
            or "main character" in answer.lower()
        )

    def test_character_note_among_many_gets_summary(self):
        entries = [
            _entry(
                "c1",
                "Etherei",
                "Etherei is the protagonist. Grey-skinned arcanist.",
                tags=["Smoke and Mirrors"],
                kind="character",
            ),
            _entry("n1", "Scene A", "Etherei turned.", tags=["Smoke and Mirrors"]),
            _entry("n2", "Scene B", "Etherei ran.", tags=["Smoke and Mirrors"]),
        ]
        res = self._ask("In Smoke and Mirrors, who is Etherei?", entries)
        answer = res.get("answer") or ""
        self.assertEqual(res.get("materialState"), "summarizable")
        self.assertIn("protagonist", answer.lower())
        self.assertNotIn("turned", answer.lower())

        entries = [
            _entry(
                "e1",
                "Bit",
                "Character M walked in.",
                tags=["Ashford Saga"],
            ),
        ]
        res = self._ask("What have I done with Character M in Ashford Saga?", entries)
        answer = res.get("answer") or ""
        self.assertIn("from what you've saved", answer.lower())

    def test_plot_arc_clause_filtered_from_compose(self):
        self.assertTrue(_is_plot_arc_clause("By the events of the series, Ella has become caught between realities."))
        self.assertTrue(_is_plot_arc_clause("Ella forms the emotional and narrative center of the work."))
        self.assertTrue(
            _is_plot_arc_clause(
                "So right after Ella tells his brothers, the next POV will be the Wolf."
            )
        )
        self.assertTrue(_is_plot_arc_clause("Next section begins with Ella's POV."))
        answer = compose_character_reference(
            "Ella",
            brief={"role": "Ella is the protagonist.", "ties": []},
            roles=["Ella is the protagonist."],
            identity=["By the events of the series, Ella has become caught between realities."],
            relationships=[],
            details=[],
            dialogue=[],
            scenes=[],
            work_title="Fairy Tale",
        )
        self.assertIn("protagonist", answer.lower())
        self.assertNotIn("caught between", answer.lower())

    def test_who_is_rejects_plot_walkthrough_as_thin(self):
        from lorekeeper_character_compose import (
            cast_answer_is_thin,
            is_other_character_scene_beat,
            is_plot_walkthrough_text,
        )

        dump = (
            "So right after Character M tells his brothers about multiverse theory, "
            "Character M's POV shows him thinking on the hunter. The next POV will be "
            "that of the Wolf stalking them. Next section begins with Character M "
            "about to slip pursuit."
        )
        self.assertTrue(is_plot_walkthrough_text(dump))
        self.assertTrue(cast_answer_is_thin(dump, "Character M"))
        card = (
            "Character M is the protagonist. Character M is a sentient white rabbit. "
            "Younger brother to Character B."
        )
        self.assertFalse(is_plot_walkthrough_text(card))
        self.assertFalse(cast_answer_is_thin(card, "Character M"))
        other = (
            "Character S, in his first POV, isn't surprised to see that Character M "
            "is badly injured in Ashford Saga."
        )
        self.assertTrue(is_other_character_scene_beat(other, "Character M"))
        self.assertTrue(_is_plot_arc_clause(other))

    def test_who_is_scrubs_other_character_pov_event(self):
        from lorekeeper_answer_focus import scrub_who_is_plot_walkthrough

        mixed = (
            "Character S, in his first POV, isn't surprised to see that Character M "
            "is badly injured in Ashford Saga. Character M is the protagonist of the "
            "story, the white rabbit. Character M is male."
        )
        cleaned = scrub_who_is_plot_walkthrough(
            mixed, question="In Ashford Saga, who is Character M?"
        )
        self.assertIn("protagonist", cleaned.lower())
        self.assertIn("rabbit", cleaned.lower())
        self.assertNotIn("character s", cleaned.lower())
        self.assertNotIn("first pov", cleaned.lower())
        self.assertNotIn("badly injured", cleaned.lower())
        self.assertNotIn("isn't surprised", cleaned.lower())

    def test_who_is_prefers_cast_note_over_plot_draft(self):
        entries = [
            _entry(
                "c1",
                "Character M",
                "Character M is the protagonist. Character M is a sentient white rabbit. "
                "Younger brother to Character B and Character C. "
                "Subject of Character D's curiosity.",
                tags=["Ashford Saga"],
                kind="character",
            ),
            _entry(
                "d1",
                "Ashford draft",
                "So right after Character M tells his brothers about multiverse theory, "
                "Character M's POV shows him thinking on the hunter coming after him. "
                "The next POV will be that of the Wolf stalking them. "
                "Next section begins with Character M's POV while he is about to slip pursuit.",
                tags=["Ashford Saga"],
                kind="document",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        answer = res.get("answer") or ""
        self.assertEqual(res.get("materialState"), "summarizable")
        self.assertIn("protagonist", answer.lower())
        self.assertIn("rabbit", answer.lower())
        self.assertIn("brother", answer.lower())
        self.assertNotIn("right after", answer.lower())
        self.assertNotIn("next pov", answer.lower())
        self.assertNotIn("multiverse", answer.lower())

    def test_gap_reference_puts_unclear_section_last(self):
        answer = compose_character_gap_reference(
            "Character Z",
            mention_places=1,
            dialogue_only=True,
            scene_only=False,
            work_title="Ashford Saga",
        )
        self.assertIn("What isn't spelled out yet in your notes:", answer)
        self.assertLess(answer.index("Character Z"), answer.index("What isn't spelled out yet"))


if __name__ == "__main__":
    unittest.main()
