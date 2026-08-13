"""Synthetic character compose tests (#11–13) — fake names only."""
from __future__ import annotations

import json
import re
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

    def test_who_is_rejects_plot_with_brother_mention_and_bogus_names(self):
        from lorekeeper_answer_focus import scrub_who_is_plot_walkthrough
        from lorekeeper_character_compose import (
            is_plausible_cast_person_name,
            is_who_is_cast_fact_sentence,
        )

        plot = (
            "Character M is roused from his thoughts by Character B's approach, "
            "the younger rabbit carrying their overclothing in his arms. Character M "
            "had been rather worried for his eldest brother, considering that Character C "
            "had gotten wet, but something in the vigor with which Character C had forcibly "
            "groomed Character M ironically soothed the latter's fears somewhat."
        )
        self.assertFalse(is_who_is_cast_fact_sentence(plot, "Character M"))
        self.assertFalse(is_plausible_cast_person_name("Especially"))
        self.assertFalse(is_plausible_cast_person_name("Are"))
        self.assertTrue(is_plausible_cast_person_name("Obsidian"))
        dump = (
            "Character M is the male protagonist in Ashford Saga. "
            + plot
            + " Character M is brother to Obsidian. Character M is brother to Especially. "
            "Character M is brother to Are."
        )
        cleaned = scrub_who_is_plot_walkthrough(
            dump, question="In Ashford Saga, who is Character M?"
        )
        low = cleaned.lower()
        self.assertIn("protagonist", low)
        self.assertIn("obsidian", low)
        self.assertNotIn("roused", low)
        self.assertNotIn("especially", low)
        self.assertNotIn("brother to are", low)
        self.assertNotIn("groomed", low)

    def test_who_is_scrubs_awareness_plot_dump(self):
        from lorekeeper_answer_focus import scrub_who_is_plot_walkthrough
        from lorekeeper_character_compose import (
            cast_answer_is_thin,
            who_is_answer_has_bloat,
        )

        dump = (
            "Character M is the male protagonist of the story, the White Rabbit from "
            "Tale Alpha in Ashford Saga. Character M is known by the name Chroniker by "
            "Character D and those Character D trusts. specifically; Character E has no "
            "reason to realize that the Preyfolk of his own reality are similarly sentient. "
            "Not long after Character M mentions his theory that they are no longer in "
            "their home dimension, he reflects on the fact that a Predator is tracking them. "
            "So right now, Character M is aware that Character D does not yet want him dead. "
            "Character M Background: his father died when Character M was very young, so he "
            "doesn't remember much, but what he does remember would surprise his brothers."
        )
        self.assertTrue(who_is_answer_has_bloat(dump))
        self.assertTrue(cast_answer_is_thin(dump, "Character M"))
        cleaned = scrub_who_is_plot_walkthrough(
            dump, question="In Ashford Saga, who is Character M?"
        )
        low = cleaned.lower()
        self.assertIn("protagonist", low)
        self.assertIn("rabbit", low)
        self.assertIn("chroniker", low)
        self.assertNotIn("aware that", low)
        self.assertNotIn("not long after", low)
        self.assertNotIn("tracking", low)
        self.assertNotIn("background", low)
        self.assertNotIn("no reason to realize", low)
        self.assertFalse(who_is_answer_has_bloat(cleaned))

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
        from lorekeeper_character_compose import smooth_who_is_prose

        cleaned = smooth_who_is_prose("Character M", cleaned)
        self.assertIn("protagonist", cleaned.lower())
        self.assertIn("rabbit", cleaned.lower())
        self.assertNotIn("character s", cleaned.lower())
        self.assertNotIn("first pov", cleaned.lower())
        self.assertNotIn("badly injured", cleaned.lower())
        self.assertNotIn("isn't surprised", cleaned.lower())
        self.assertNotRegex(cleaned, r"(?i)character m is male\.?\s*$")

    def test_smooth_who_is_weaves_gender(self):
        from lorekeeper_character_compose import smooth_who_is_prose

        raw = (
            "Character M is the protagonist, a sentient white rabbit. "
            "Character M is male. Character M is brother to Character B."
        )
        out = smooth_who_is_prose("Character M", raw)
        self.assertNotIn("male protagonist", out.lower())
        self.assertNotIn("Character M is male.", out)
        self.assertIn("brother", out.lower())

    def test_who_is_gold_tone_family_slots(self):
        entries = [
            _entry(
                "c1",
                "Character M",
                "Character M is the protagonist of Ashford Saga. Character M is a sentient "
                "white rabbit. Character M is younger brother to Obsidian and Stygian. "
                "Character M is the subject of Tenebris's curiosity.",
                tags=["Ashford Saga"],
                kind="character",
            ),
            _entry(
                "d1",
                "Draft",
                "Character M is roused from his thoughts. Next section begins with Character M.",
                tags=["Ashford Saga"],
                kind="document",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        answer = res.get("answer") or ""
        self.assertEqual(res.get("materialState"), "summarizable")
        low = answer.lower()
        self.assertIn("protagonist", low)
        self.assertIn("obsidian", low)
        self.assertIn("stygian", low)
        self.assertIn("tenebris", low)
        self.assertNotIn("male protagonist", low)
        self.assertTrue(
            "rabbit" in low or "sentient" in low,
            msg=answer,
        )
        self.assertIn("younger", low)
        # Planning-brief open: curiosity is a hook, not a lone telegram.
        first = re.split(r"(?<=[.!?])\s+", answer.strip(), maxsplit=1)[0].lower()
        self.assertIn("curiosity", first, msg=answer)
        self.assertLessEqual(low.count("he is"), 1, msg=answer)

    def test_who_is_voice_folds_species_sister_and_keeps_gap_last(self):
        """Catch-up-like warmth: flowing open, not encyclopedia stacks; gaps last."""
        entries = [
            _entry(
                "c1",
                "Character Z",
                (
                    "Character Z is the protagonist. Character Z is a young woman. "
                    "Character Z is an arcanist. Character Z is sister to Character B."
                ),
                tags=["Zeta Saga"],
                kind="character",
            ),
        ]
        res = self._ask("In Zeta Saga, who is Character Z?", entries)
        answer = res.get("answer") or ""
        low = answer.lower()
        self.assertIn("protagonist", low)
        self.assertIn("young woman", low)
        self.assertIn("arcanist", low)
        self.assertIn("sister", low)
        self.assertIn("character b", low)
        self.assertLessEqual(low.count("character z is"), 2, msg=answer)
        if "don't yet" in low:
            facts_end = max(
                low.rfind("sister"),
                low.rfind("arcanist"),
                low.rfind("young woman"),
            )
            self.assertGreater(low.find("don't yet"), facts_end, msg=answer)

    def test_who_is_concealment_hook_stays_after_identity(self):
        entries = [
            _entry(
                "c1",
                "Character E",
                (
                    "Character E is the protagonist of Ashford Saga. "
                    "Character E is a young woman and an author. "
                    "now Character E has to conceal her identity in order to not be "
                    "discovered as a human and subsequently, an Author."
                ),
                tags=["Ashford Saga"],
                kind="character",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character E?", entries)
        answer = res.get("answer") or ""
        low = answer.lower()
        self.assertIn("protagonist", low)
        self.assertIn("conceal", low)
        self.assertIn("human", low)
        self.assertNotIn("has to conceal", low)
        self.assertNotIn("in order to not be discovered", low)
        if "don't yet" in low:
            self.assertGreater(low.find("don't yet"), low.find("conceal"), msg=answer)

    def test_who_is_keeps_kinship_when_comma_follows_sibling_name(self):
        """Prose like 'Obsidian and Stygian, the Moonshadow…' must not chop at the comma."""
        entries = [
            _entry(
                "p1",
                "Protagonist Notes",
                (
                    "Character M is the protagonist of the story, the White Rabbit from "
                    "Alice in Wonderland. He is younger brother to Obsidian and Stygian, "
                    "the Moonshadow Rabbits, and the son of the buck Snow Thistle and "
                    "the doe Ebony."
                ),
                tags=["Ashford Saga", "Character M"],
                kind="note",
            ),
            _entry(
                "c1",
                "Character M",
                (
                    "Character M Background: his father died when Character M was very young, "
                    "so he doesn’t remember much, but what he does remember would surprise "
                    "his brothers. His mother took care of him and his brothers as best she "
                    "could. Not older by enough to be mistaken for Character M’s father "
                    "but by a decent year gap)."
                ),
                tags=["Ashford Saga", "Character M"],
                kind="character",
            ),
            _entry(
                "d1",
                "Ashford draft",
                (
                    "He’d been rather worried for his eldest brother, considering that "
                    "Obsidian had gotten as wet as Character M, but something in the vigor "
                    "with which Obsidian had forcibly groomed Character M ironically soothed "
                    "him. “You’re darn right that you needed to apologize, but don’t act "
                    "like your apologies aren’t enough.” Stygian looks at the white rabbit. "
                    "The face of whom is still buried in the shirt of the elder Moonshadow."
                ),
                tags=["Ashford Saga"],
                kind="document",
            ),
            _entry(
                "n1",
                "Names",
                (
                    "Character M is known by the name Chroniker by Character D and those "
                    "Character D trusts enough to share what he knows about the White Rabbit."
                ),
                tags=["Ashford Saga", "Character M"],
                kind="character",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        answer = res.get("answer") or ""
        self.assertEqual(res.get("materialState"), "summarizable")
        low = answer.lower()
        self.assertIn("protagonist", low)
        self.assertIn("obsidian", low)
        self.assertIn("stygian", low)
        self.assertTrue(
            "snow thistle" in low or "ebony" in low,
            msg=f"expected named parents in: {answer}",
        )
        self.assertNotIn("not older by enough", low)
        self.assertNotIn("brother to obsidian and.", low)
        for junk in (
            "brother to quietly",
            "brother to forced",
            "brother to you",
            "little one",
            "brother to enough",
            "brother to moonshadow",
            "brother to twins",
            "brother to platinus",
            "platinus",
        ):
            self.assertNotIn(junk, low, msg=f"junk sibling {junk!r} in: {answer}")
        # Chroniker alias from Names should survive scrub.
        self.assertIn("chroniker", low)

    def test_who_is_ignores_other_work_twin_notes(self):
        entries = [
            _entry(
                "p1",
                "Protagonist Notes",
                (
                    "Character M is the protagonist. He is younger brother to Obsidian "
                    "and Stygian."
                ),
                tags=["Ashford Saga", "Character M"],
                kind="note",
            ),
            _entry(
                "other",
                "Protagonist: Platinus",
                "The protagonist is named Platinus. Twins can Combine.",
                tags=["Cities of Rust"],
                kind="character",
            ),
            _entry(
                "twins",
                "Prism twins",
                "Twins can Combine. Galloxidor and Prism are brothers.",
                tags=["Cities of Rust"],
                kind="event",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        low = (res.get("answer") or "").lower()
        self.assertIn("obsidian", low)
        self.assertIn("stygian", low)
        self.assertNotIn("platinus", low)
        self.assertNotIn("galloxidor", low)
        self.assertNotIn("prism", low)

    def test_who_is_overview_significance_and_close_ties(self):
        entries = [
            _entry(
                "d1",
                "Draft",
                "Character M is the protagonist of the story, the White Rabbit from Alice "
                "in Wonderland in Ashford Saga. Character M is known by the name Chroniker "
                "by Character D.",
                tags=["Ashford Saga"],
                kind="document",
            ),
            _entry(
                "n1",
                "Character M",
                "Character M is the chosen one meant to defeat the dragon demon king. "
                "Character M is younger brother to Obsidian and Stygian. "
                "Character E is Character M's nemesis.",
                tags=["Ashford Saga"],
                kind="character",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        answer = res.get("answer") or ""
        low = answer.lower()
        self.assertIn("protagonist", low)
        self.assertIn("obsidian", low)
        self.assertIn("stygian", low)
        self.assertTrue(
            any(x in low for x in ("chosen", "nemesis", "dragon")),
            msg=answer,
        )
        self.assertNotIn("male protagonist", low)

    def test_who_is_keeps_accidental_world_upheaval_status(self):
        """Mirror Etherei Protagonist Notes shape: role + kin + accidental upheaval status."""
        from lorekeeper_answer_focus import scrub_who_is_plot_walkthrough
        from lorekeeper_character_compose import (
            is_overview_significance_clause,
            is_who_is_cast_fact_sentence,
            weave_who_is_gold_tone,
        )

        upheaval = (
            "Character M somehow crosses realities into the home dimension of Character D, "
            "who, in this story, is named Lord Shadow, and sets off a chain of events that "
            "will result in relationship upheaval for Predator and Preyfolk alike."
        )
        he_led = (
            "He somehow crosses realities into the home dimension of Character D, who, in "
            "this story, is named Lord Shadow, and sets off a chain of events that will "
            "result in relationship upheaval for Predator and Preyfolk alike."
        )
        self.assertTrue(is_overview_significance_clause(upheaval, "Character M"))
        self.assertTrue(is_overview_significance_clause(he_led, "Character M"))
        self.assertTrue(is_who_is_cast_fact_sentence(upheaval, "Character M"))
        reason_line = (
            "Character M storywalks into Character D's world and sets in motion "
            "the Predators' rediscovery that the Preyfolk are also sentient and "
            "thus changes their world forever."
        )
        self.assertTrue(is_overview_significance_clause(reason_line, "Character M"))
        self.assertTrue(is_who_is_cast_fact_sentence(reason_line, "Character M"))
        self.assertFalse(
            is_overview_significance_clause(
                "Character M storywalks into Character D's world.",
                "Character M",
            )
        )
        woven = weave_who_is_gold_tone(
            "Character M",
            "Ashford Saga",
            [
                "Character M is the protagonist of the story, the White Rabbit from "
                "Alice in Wonderland.",
                upheaval,
            ],
            [
                "Character M is younger brother to Obsidian and Stygian, the Moonshadow "
                "Rabbits, and the son of the buck Snow Thistle and the doe Ebony.",
                "Character M is known by the name Chroniker by Character D.",
            ],
        )
        woven_low = woven.lower()
        self.assertIn("protagonist", woven_low)
        self.assertIn("upheaval", woven_low)
        self.assertIn("crosses", woven_low)
        cleaned = scrub_who_is_plot_walkthrough(
            woven, question="In Ashford Saga, who is Character M?"
        )
        clean_low = cleaned.lower()
        self.assertIn("protagonist", clean_low)
        self.assertIn("chroniker", clean_low)
        self.assertIn("upheaval", clean_low)
        self.assertIn("crosses", clean_low)
        self.assertNotIn("storywalks", clean_low)
        self.assertNotIn("aware that", clean_low)

        entries = [
            _entry(
                "p1",
                "Protagonist Notes",
                "Character M is the protagonist of the story, the White Rabbit from "
                "Alice in Wonderland. He is younger brother to Obsidian and Stygian, "
                "the Moonshadow Rabbits, and the son of the buck Snow Thistle and the "
                "doe Ebony. " + he_led,
                tags=["Ashford Saga", "Character M"],
                kind="note",
            ),
            _entry(
                "n1",
                "Names",
                "Character M is known by the name Chroniker by Character D and those "
                "Character D trusts.",
                tags=["Ashford Saga", "Character M"],
                kind="note",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        answer = res.get("answer") or ""
        low = answer.lower()
        self.assertEqual(res.get("materialState"), "summarizable")
        self.assertIn("protagonist", low)
        self.assertIn("white rabbit", low)
        self.assertIn("obsidian", low)
        self.assertIn("stygian", low)
        self.assertIn("chroniker", low)
        self.assertTrue(
            "upheaval" in low or "crosses" in low,
            msg=answer,
        )
        self.assertNotIn("storywalks", low)
        self.assertNotIn("aware that", low)
        self.assertNotIn("sets in motion", low)

    def test_who_is_folds_draft_upheaval_reason_into_notes(self):
        """Notes say upheaval happens; draft names rediscovery/sentience reason — keep both."""
        entries = [
            _entry(
                "p1",
                "Protagonist Notes",
                "Character M is the protagonist of the story, the White Rabbit from "
                "Alice in Wonderland. He is younger brother to Obsidian and Stygian. "
                "He somehow crosses realities into the home dimension of Character D "
                "and sets off a chain of events that will result in relationship "
                "upheaval for Predator and Preyfolk alike.",
                tags=["Ashford Saga", "Character M"],
                kind="note",
            ),
            _entry(
                "n1",
                "Names",
                "Character M is known by the name Chroniker by Character D.",
                tags=["Ashford Saga", "Character M"],
                kind="note",
            ),
            _entry(
                "d1",
                "Ashford draft",
                "Character M storywalks into Character D's world and sets in motion "
                "the Predators' rediscovery that the Preyfolk are also sentient and "
                "thus changes their world forever. So right now Character M is aware "
                "that Character D does not yet want him dead.",
                tags=["Ashford Saga"],
                kind="document",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        answer = res.get("answer") or ""
        low = answer.lower()
        self.assertEqual(res.get("materialState"), "summarizable")
        self.assertIn("protagonist", low)
        self.assertIn("chroniker", low)
        self.assertTrue("upheaval" in low or "crosses" in low, msg=answer)
        self.assertTrue(
            "rediscover" in low or "sentient" in low,
            msg=answer,
        )
        self.assertNotIn("aware that", low)
        self.assertNotIn("does not yet want him dead", low)

    def test_who_is_formalizes_rediscovery_and_scrubs_faction_dump(self):
        """Chatty rediscovery → formal tone; faction-roster awareness dump dropped."""
        from lorekeeper_answer_focus import scrub_who_is_plot_walkthrough, focus_ask_response
        from lorekeeper_character_compose import (
            formalize_who_is_sentence,
            is_formal_awareness_status_clause,
            is_who_is_cast_fact_sentence,
            smooth_who_is_prose,
        )

        chatty = (
            "So Character M, by being discovered in Wonderland by the CC Baron, just set "
            "in motion the eventual (not yet but within a few months) reveal that Preyfolk "
            "of this Dimension are just as sentient as Predators."
        )
        formal = formalize_who_is_sentence(chatty, "Character M")
        low_f = formal.lower()
        self.assertTrue(formal.startswith("By being discovered"), msg=formal)
        self.assertIn("has already set in motion", low_f)
        self.assertIn("rediscovery", low_f)
        self.assertIn("cheshire cat", low_f)
        self.assertNotIn("so character m", low_f)
        self.assertNotIn("just set in motion", low_f)
        self.assertIn("several months", low_f)

        dump = (
            "Also, aside from the unspoken rule that Preyfolk can't act sentient "
            "misunderstanding, Character M doesn't know anything about how Predators work, "
            "aside from the fact that the Golden Owl, the Eurasian Lynx, and the Cheshire Cat "
            "can and do work together."
        )
        self.assertFalse(is_who_is_cast_fact_sentence(dump, "Character M"))
        status = (
            "Character M is not yet fully aware of the political nuance pertaining to the "
            "Predator-Preyfolk relations of this dimension, but he is slowly but surely "
            "becoming more attuned to an unspoken line that he has somehow recently crossed."
        )
        self.assertTrue(is_formal_awareness_status_clause(status, "Character M"))
        self.assertTrue(is_who_is_cast_fact_sentence(status, "Character M"))

        mixed = (
            "Character M is the protagonist of the story, the White Rabbit from Alice in "
            "Wonderland. Character M is known to Cheshire Cat as Chroniker. "
            + chatty
            + " "
            + dump
            + " "
            + status
        )
        cleaned = scrub_who_is_plot_walkthrough(
            mixed, question="In Ashford Saga, who is Character M?"
        )
        cleaned = smooth_who_is_prose("Character M", cleaned)
        focused = focus_ask_response(
            "In Ashford Saga, who is Character M?",
            {
                "ok": True,
                "answer": cleaned + "\n\n— From your notes only. Nothing invented.",
                "questionKind": "who",
                "sources": [],
            },
        )
        out = (focused.get("answer") or "").lower()
        self.assertIn("protagonist", out)
        self.assertIn("chroniker", out)
        self.assertTrue("by being discovered" in out or "rediscovery" in out, msg=out)
        self.assertIn("political nuance", out)
        self.assertNotIn("golden owl", out)
        self.assertNotIn("eurasian lynx", out)
        self.assertNotIn("doesn't know anything", out)
        self.assertNotIn("so character m", out)
        self.assertNotIn("can and do work together", out)

    def test_who_is_identity_alias_named_kin(self):
        entries = [
            _entry(
                "c1",
                "Character M",
                "Character M is the protagonist of Ashford Saga. Character M is known to the "
                "fairytale world at large as the White Rabbit from Alice in Wonderland. "
                "Character M is the son of buck Snow Thistle and doe Ebony. Character M is "
                "younger brother to two of the Rabbits of Death from Pinocchio, Obsidian and "
                "Stygian. Character M's father died when he was very young and his widow "
                "mother struggled to provide, so he was raised by his older brothers.",
                tags=["Ashford Saga"],
                kind="character",
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character M?", entries)
        answer = res.get("answer") or ""
        low = answer.lower()
        self.assertIn("protagonist", low)
        self.assertIn("white rabbit", low)
        self.assertTrue("fairytale" in low or "known to" in low, msg=answer)
        self.assertIn("snow thistle", low)
        self.assertIn("ebony", low)
        self.assertIn("obsidian", low)
        self.assertIn("stygian", low)
        self.assertNotIn("male protagonist", low)
        self.assertNotIn("struggled to provide", low)
        self.assertNotRegex(answer, r"(?i)character m is male\.")

    def test_weave_who_is_gold_tone_merges_brothers(self):
        from lorekeeper_character_compose import weave_who_is_gold_tone

        body = weave_who_is_gold_tone(
            "Character M",
            "Ashford Saga",
            [
                "Character M is the protagonist in Ashford Saga.",
                "Character M is a sentient white rabbit.",
            ],
            [
                "Character M is brother to Obsidian.",
                "Character M is brother to Stygian.",
                "Character M is the subject of Tenebris's curiosity.",
            ],
        )
        low = body.lower()
        self.assertIn("protagonist", low)
        self.assertIn("obsidian", low)
        self.assertIn("stygian", low)
        self.assertIn("tenebris", low)
        self.assertNotIn("male protagonist", low)
        self.assertLessEqual(body.count("brother to"), 1)

    def test_smooth_who_is_drops_bare_gender(self):
        from lorekeeper_character_compose import smooth_who_is_prose

        raw = (
            "Character M is the protagonist, a sentient white rabbit. "
            "Character M is male. Character M is brother to Character B."
        )
        out = smooth_who_is_prose("Character M", raw)
        self.assertNotIn("male protagonist", out.lower())
        self.assertNotIn("Character M is male.", out)
        self.assertIn("brother", out.lower())
        self.assertIn("protagonist", out.lower())

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

    def test_who_is_subject_lock_no_steal_from_other_sheet(self):
        """Who-is must not remap another character's kin/stakes onto a side alias."""
        entries = [
            _entry(
                "n1",
                "Protagonist Notes",
                (
                    "Character M is the protagonist of the story, the White Rabbit from "
                    "Alice in Wonderland. He is younger brother to Obsidian and Stygian, "
                    "and the son of the buck Snow Thistle and the doe Ebony. He somehow "
                    "crosses realities into the home dimension of the Cheshire Cat, who, "
                    "in this story, is named Lord Shadow, and sets off relationship "
                    "upheaval for Predator and Preyfolk alike."
                ),
                tags=["Ashford Saga", "Character M"],
            ),
            _entry(
                "n2",
                "Lord Shadow",
                (
                    "Lord Shadow is the Cheshire Cat from Alice in Wonderland. "
                    "He is a Predator noble and the main antagonist of the northern court."
                ),
                tags=["Ashford Saga", "Shadow"],
                kind="character",
            ),
            _entry(
                "n3",
                "Names",
                (
                    "Character M is known by the name Chroniker by Lord Shadow and those "
                    "Lord Shadow trusts enough to share what he knows about the White Rabbit."
                ),
                tags=["Ashford Saga", "Character M"],
            ),
        ]
        shadow = self._ask("In Ashford Saga, who is Shadow?", entries)
        s_ans = (shadow.get("answer") or "").lower()
        self.assertIn("cheshire", s_ans)
        self.assertTrue("antagonist" in s_ans or "predator" in s_ans, msg=s_ans)
        self.assertNotIn("snow thistle", s_ans)
        self.assertNotIn("obsidian", s_ans)
        self.assertNotIn("crosses realities", s_ans)

        hero = self._ask("In Ashford Saga, who is Character M?", entries)
        h_ans = (hero.get("answer") or "").lower()
        self.assertIn("protagonist", h_ans)
        self.assertIn("white rabbit", h_ans)
        self.assertIn("obsidian", h_ans)
        self.assertIn("chroniker", h_ans)
        self.assertTrue("upheaval" in h_ans or "crosses" in h_ans, msg=h_ans)
        self.assertNotIn("main antagonist", h_ans)

    def test_who_is_rejects_incomplete_exception_scrap(self):
        from lorekeeper_answer_focus import drop_trailing_unfinished_clause, scrub_who_is_plot_walkthrough
        from lorekeeper_character_compose import (
            cast_answer_is_thin,
            is_incomplete_cast_clause,
            is_scrap_identity_clause,
        )

        scrap = "Character S is a sole exception and."
        self.assertTrue(is_incomplete_cast_clause(scrap, "Character S"))
        self.assertTrue(is_scrap_identity_clause(scrap, "Character S"))
        self.assertTrue(cast_answer_is_thin(scrap, "Character S"))
        cleaned = scrub_who_is_plot_walkthrough(
            scrap, question="In Ashford Saga, who is Character S?"
        )
        self.assertNotIn("sole exception and", cleaned.lower())
        self.assertEqual(drop_trailing_unfinished_clause(scrap), "")

    def test_who_is_merges_draft_opposition_and_prefers_kin_over_rename_dump(self):
        entries = [
            _entry(
                "n1",
                "Character P",
                (
                    "Character P is the birth name of the protagonist, then he changes his name "
                    "to Cypher Prism after he flees his planet of birth, Techrontis and arrives "
                    "on the ecumenopolis, and then changes his name to Palladiar (fantasy name "
                    "based on Palladium, possible alternatives are Palladius, Palladium) when he "
                    "becomes the leader of his faction against Character G's faction."
                ),
                tags=["Rust Saga"],
                kind="character",
            ),
            _entry(
                "d1",
                "Rust draft",
                (
                    "Character P is younger brother to Character Q. "
                    "Character P is the son of Character R. "
                    "Character P is up against Character G for control of the core world."
                ),
                tags=["Rust Saga"],
                kind="document",
            ),
        ]
        res = self._ask("In Rust Saga, who is Character P?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("brother", answer)
        self.assertTrue(
            "character q" in answer or "character r" in answer or "up against" in answer,
            msg=answer,
        )
        # Rename dump must not be the whole card.
        self.assertFalse(
            answer.count("changes") >= 2 and "brother" not in answer,
            msg=answer,
        )
        self.assertNotIn("brother to character.", answer)
        self.assertNotIn("and character.", answer)

    def test_who_is_uses_draft_situation_when_notes_thin(self):
        entries = [
            _entry(
                "n1",
                "Character E",
                "Character E is a young woman. Character E is the protagonist.",
                tags=["Dream Saga"],
            ),
            _entry(
                "d1",
                "Dream draft",
                (
                    "Character E finds herself pulled into a waking dream after the lantern fails. "
                    "Character E is up against Character V, who keeps rewriting the dream's rules."
                ),
                tags=["Dream Saga"],
                kind="document",
            ),
        ]
        res = self._ask("In Dream Saga, who is Character E?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("protagonist", answer)
        self.assertTrue(
            "waking dream" in answer or "pulled into" in answer or "up against" in answer,
            msg=answer,
        )

    def test_who_is_rejects_knower_thinks_that_pov(self):
        from lorekeeper_character_compose import (
            is_knower_pov_about_label,
            is_other_character_scene_beat,
        )

        bad = (
            "Umber thinks that Theron is worried that someone will "
            "try to lay claim to the White Rabbit before Theron can."
        )
        self.assertTrue(is_knower_pov_about_label(bad, "Theron"))
        self.assertTrue(is_other_character_scene_beat(bad, "Theron"))
        entries = [
            _entry(
                "u1",
                "Umber sheet",
                bad + " Umber is a grey wolf.",
                kind="character",
                tags=["Ashford Saga"],
            ),
            _entry(
                "t1",
                "Lord Theron",
                (
                    "Lord Theron of Cheshire is not entirely of this world; "
                    "his status as a Fairy Tale character grants him social rank."
                ),
                kind="character",
                tags=["Ashford Saga"],
            ),
        ]
        res = self._ask("In Ashford Saga, who is Theron?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertNotIn("thinks that", answer)
        self.assertTrue(
            "cheshire" in answer or "fairy" in answer or "faeble" in answer,
            msg=answer,
        )

    def test_who_is_compresses_rename_dump_and_keeps_twin(self):
        entries = [
            _entry(
                "n1",
                "Protagonist: Character P",
                'The protagonist is named "Character P."',
                kind="character",
                tags=["Rust Saga"],
            ),
            _entry(
                "n2",
                "Names",
                (
                    "Character P is the birth name of the protagonist, then he changes his name "
                    "to Cypher Prism after he flees his planet of birth, Techrontis and arrives "
                    "on the ecumenopolis, and then changes his name to Palladiar (fantasy name "
                    "based on Palladium) when he becomes the leader of his faction against "
                    "Character G's faction."
                ),
                kind="character",
                tags=["Rust Saga"],
            ),
            _entry(
                "d1",
                "Rust draft",
                (
                    "one of the twins, the protagonist's elder brother Character Q, forces his "
                    "way out, and then pulls his younger twin, Character P, after himself."
                ),
                kind="document",
                tags=["Rust Saga"],
            ),
        ]
        res = self._ask("In Rust Saga, who is Character P?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("protagonist", answer)
        self.assertTrue("brother" in answer or "twin" in answer, msg=answer)
        self.assertTrue(
            "cypher" in answer or "palladiar" in answer or "against" in answer,
            msg=answer,
        )
        self.assertLess(answer.count("changes his name"), 2, msg=answer)

    def test_who_is_concealment_and_opposition_from_notes(self):
        entries = [
            _entry(
                "n1",
                "Character E",
                (
                    "Character E is the protagonist. Character E is a young woman and an author. "
                    "Character E is human, concealing that among the fae. "
                    "Character E is up against Lord Vex."
                ),
                tags=["Lantern Saga"],
                kind="character",
            ),
        ]
        res = self._ask("In Lantern Saga, who is Character E?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("protagonist", answer)
        self.assertTrue("author" in answer or "young woman" in answer, msg=answer)
        self.assertTrue(
            "human" in answer or "conceal" in answer,
            msg=answer,
        )
        self.assertTrue("vex" in answer or "up against" in answer, msg=answer)
        self.assertNotIn("thinks that", answer)

    def test_who_is_concealment_from_draft_when_notes_thin(self):
        entries = [
            _entry(
                "n1",
                "Protagonist Notes",
                "Character E is the protagonist. Character E is a young woman and an author.",
                tags=["Lantern Saga"],
                kind="character",
            ),
            _entry(
                "d1",
                "Lantern draft",
                (
                    "Character E keeps her human nature concealed among the fae court. "
                    "Character E is up against Lord Vex, who suspects she is not what she seems."
                ),
                tags=["Lantern Saga"],
                kind="document",
            ),
        ]
        res = self._ask("In Lantern Saga, who is Character E?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("protagonist", answer)
        self.assertTrue(
            "conceal" in answer or "human" in answer,
            msg=answer,
        )
        self.assertTrue("vex" in answer or "up against" in answer, msg=answer)
        self.assertNotIn("thinks that", answer)
        # Still a cast card — not a long scene dump.
        self.assertLess(len(answer), 900, msg=answer)

    def test_who_is_so_now_conceal_and_appositive_protagonist(self):
        """Live-shaped phrasing: appositive role note + 'So now X has to conceal…' draft."""
        entries = [
            _entry(
                "n1",
                "Authors' Role",
                (
                    "Authors write with pens. The protagonist, Character E, is central to "
                    "the realm's stories. But they are not capital-A Authors."
                ),
                tags=["Lantern Saga"],
                kind="species",
            ),
            _entry(
                "d1",
                "Lantern draft",
                (
                    "Premise: Character E is a young woman and an author. "
                    "So now Character E has to conceal her identity as human among Authors. "
                    "I'm thinking that the main antagonist might be Character V."
                ),
                tags=["Lantern Saga"],
                kind="document",
            ),
        ]
        res = self._ask("In Lantern Saga, who is Character E?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("protagonist", answer)
        self.assertTrue(
            "conceal" in answer or "human" in answer,
            msg=answer,
        )
        self.assertTrue(
            "young woman" in answer or "author" in answer,
            msg=answer,
        )
        # Planning voice about the antagonist must not leak.
        self.assertNotIn("i'm thinking", answer)
        self.assertNotIn("i am thinking", answer)

    def test_who_is_scrubs_tenebris_style_plot_bleed(self):
        from lorekeeper_answer_focus import scrub_who_is_plot_walkthrough
        from lorekeeper_character_compose import (
            formalize_who_is_sentence,
            is_who_is_cast_fact_sentence,
            who_is_answer_has_bloat,
        )

        mid = (
            "But anyway, Dijon arrives at some point later, Character T is keeping his "
            "'guest' under close surveillance and asking about the latter's level of "
            "sentience, the latter's travel companions, and who else is like Character E."
        )
        self.assertFalse(is_who_is_cast_fact_sentence(mid, "Character T"))
        self.assertTrue(who_is_answer_has_bloat(mid))
        bad = (
            "Character T is Baron of Cheshire. " + mid + " "
            "Lord Character T of Cheshire is a Fairy Tale character, or 'faeble.'"
        )
        scrubbed = scrub_who_is_plot_walkthrough(
            bad, question="In Ashford Saga, who is Character T?"
        ).lower()
        self.assertIn("baron", scrubbed)
        self.assertTrue("faeble" in scrubbed or "fairy" in scrubbed, msg=scrubbed)
        self.assertNotIn("dijon", scrubbed)
        self.assertNotIn("surveillance", scrubbed)
        self.assertNotIn("but anyway", scrubbed)

    def test_who_is_keeps_standing_cousin_not_plot_bleed(self):
        """Dijon cousin / ally standing stays; surveillance walkthrough stays out."""
        entries = [
            _entry(
                "n1",
                "Character T",
                "Character T is Baron of Cheshire. Lord Character T is a Fairy Tale character, or faeble.",
                kind="character",
                tags=["Ashford Saga"],
            ),
            _entry(
                "r1",
                "Duke Dijon and Lord Character T",
                (
                    "Character T refers to his 'cousin' Dijon. "
                    "Kinship may or may not be exact; open question."
                ),
                kind="relationship",
                tags=["Ashford Saga"],
            ),
            _entry(
                "r2",
                "Duke Dijon vs Character T",
                (
                    "Character T looks out for his second cousin Dijon who may or may not "
                    "have been orphaned. They are allies in court politics. "
                    "But anyway, Dijon arrives at some point later under surveillance."
                ),
                kind="relationship",
                tags=["Ashford Saga"],
            ),
            _entry(
                "d1",
                "Ashford draft",
                (
                    "To my esteemed cousin Dijon, Character T wrote carefully. "
                    "But anyway, Dijon arrives at some point later under close surveillance."
                ),
                kind="document",
                tags=["Ashford Saga"],
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character T?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("baron", answer)
        self.assertIn("dijon", answer)
        self.assertTrue("cousin" in answer, msg=answer)
        self.assertNotIn("surveillance", answer)
        self.assertNotIn("but anyway", answer)
        self.assertNotIn("tenebris suspects", answer)
        self.assertNotRegex(answer, r"(?i)calls\s+tenebris\s+suspects")
        self.assertNotIn("your notes treat", answer)
        self.assertNotIn("refers to", answer)

    def test_who_is_rejects_your_esteemed_cousin_self_mangle(self):
        from lorekeeper_relations import who_is_standing_relation_lines

        entries = [
            _entry(
                "d1",
                "Ashford draft",
                (
                    "especially if their smallest is still injured, as your esteemed "
                    "cousin Character T suspects. He shifts. "
                    "To my esteemed cousin Dijon, Character T wrote carefully."
                ),
                kind="document",
                tags=["Ashford Saga"],
            ),
            _entry(
                "n1",
                "Character T",
                "Character T is Baron of Cheshire.",
                kind="character",
                tags=["Ashford Saga"],
            ),
        ]
        lines = who_is_standing_relation_lines("Character T", entries)
        joined = " ".join(lines).lower()
        self.assertNotIn("character t suspects", joined)
        self.assertNotIn("calls character t", joined)
        self.assertTrue(
            any("dijon" in ln.lower() and "esteemed" in ln.lower() for ln in lines),
            msg=lines,
        )

    def test_who_is_pulls_court_politics_from_draft_and_care_from_notes(self):
        entries = [
            _entry(
                "n1",
                "Character T Notes",
                (
                    "Character T is the main antagonist and Baron of Cheshire. "
                    "He is the Cheshire Cat from Alice in Wonderland."
                ),
                kind="character",
                tags=["Ashford Saga"],
            ),
            _entry(
                "r1",
                "Character E and Lord Character T",
                (
                    "Character E is aware that the Cheshire Cat does not yet want him dead. "
                    "The Cat sees the hunt as a game."
                ),
                kind="relationship",
                tags=["Ashford Saga"],
            ),
            _entry(
                "r2",
                "Duke Dijon vs Character T",
                (
                    "Duke Dijon is Character T's third cousin. They share a complicated "
                    "rivalry-care bond — different in temperament, but both care. "
                    "Character T underestimates his own presence in the room."
                ),
                kind="relationship",
                tags=["Ashford Saga"],
            ),
            _entry(
                "p1",
                "Protagonist Notes",
                "Character E is the protagonist of Ashford Saga.",
                kind="note",
                tags=["Ashford Saga"],
            ),
            _entry(
                "d1",
                "Ashford Storywriting Draft",
                (
                    "the Kingdom to which Character T belongs. I can only hope that my "
                    "refusal to associate myself with the larger politics at Court has "
                    "avoided any further alienation than my mere existence."
                ),
                kind="document",
                tags=["Ashford Saga"],
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character T?", entries)
        answer = (res.get("answer") or "")
        body = re.split(r"\n—\s*From your notes", answer, maxsplit=1)[0].lower()
        self.assertIn("antagonist", body, msg=answer)
        self.assertIn("character e", body, msg=answer)
        self.assertTrue("quarry" in body, msg=answer)
        self.assertIn("third cousin", body, msg=answer)
        self.assertTrue("both care" in body or "rivalry-care" in body, msg=answer)
        self.assertIn("larger politics at court", body, msg=answer)
        self.assertTrue(
            "underestimates" in body or "political influence" in body,
            msg=answer,
        )
        self.assertNotIn("fascinat", body)
        self.assertNotIn("disgust", body)
        # Essay-hook order: role open first — never lead with mother/father.
        lead = re.split(r"(?<=[.!?])\s+", body.strip(), maxsplit=1)[0]
        self.assertRegex(
            lead,
            r"^(in ashford saga,\s*)?character t is the main antagonist",
            msg=f"lead={lead!r}\n{answer}",
        )
        self.assertNotRegex(lead, r"^(his|her)\s+(mother|father)\b")

    def test_who_is_surfaces_open_father_notes(self):
        entries = [
            _entry(
                "n1",
                "Character T Notes",
                (
                    "Character T is Baron of Cheshire. His mother is from here, but his "
                    "father, who was the Domestic Cat species parent from elsewhere, "
                    "passed coat colors. I don't think I want his father to be a Faeble "
                    "alongside him."
                ),
                kind="character",
                tags=["Ashford Saga"],
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character T?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("baron", answer)
        self.assertTrue("father" in answer, msg=answer)
        self.assertTrue(
            "domestic cat" in answer or "faeble" in answer or "open" in answer,
            msg=answer,
        )
        self.assertNotIn("parent stock", answer)
        self.assertNotIn("your notes sketch", answer)

    def test_who_is_includes_fairy_tale_origin_and_clean_standing(self):
        entries = [
            _entry(
                "n1",
                "Protagonist Notes",
                (
                    "Character E is the White Rabbit from Alice in Wonderland. "
                    "He crosses into the home dimension of the Cheshire Cat, who, "
                    "in this story, is named Lord Character T or CC Baron of Cheshire."
                ),
                kind="note",
                tags=["Ashford Saga"],
            ),
            _entry(
                "t1",
                "Lord Character T",
                (
                    "Lord Character T of Cheshire is probably not entirely of this world; "
                    "he's not the king or emperor, but his status as a Fairy Tale character, "
                    "or 'faeble,' grants him a certain social rank somehow."
                ),
                kind="politics",
                tags=["Ashford Saga"],
            ),
            _entry(
                "t2",
                "Character T Notes",
                "Character T is Baron of Cheshire.",
                kind="character",
                tags=["Ashford Saga"],
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character T?", entries)
        answer = (res.get("answer") or "")
        body = re.split(r"\n—\s*From your notes", answer, maxsplit=1)[0].lower()
        self.assertIn("cheshire", body)
        self.assertTrue(
            "wonderland" in body or "alice" in body,
            msg=answer,
        )
        self.assertTrue("baron" in body or "faeble" in body or "rank" in body, msg=answer)
        self.assertNotIn("somehow", body)
        self.assertNotIn("your notes treat", body)
        self.assertNotIn("your notes sketch", body)

    def test_who_is_keeps_mother_antagonist_and_dedupes_cousin(self):
        entries = [
            _entry(
                "p1",
                "Protagonist Notes",
                (
                    "Character E is the protagonist of the story, the White Rabbit from "
                    "Alice in Wonderland. He crosses into the home dimension of the "
                    "Cheshire Cat, who, in this story, is named Lord Character T."
                ),
                kind="note",
                tags=["Ashford Saga"],
            ),
            _entry(
                "r1",
                "Character E and Lord Character T",
                (
                    "Character E is aware that the Cheshire Cat does not yet want him dead. "
                    "The Cat sees the hunt as a game."
                ),
                kind="relationship",
                tags=["Ashford Saga"],
            ),
            _entry(
                "t1",
                "Character T Notes",
                (
                    "Character T is Baron of Cheshire. His mother is from here, but his "
                    "father, who was the Domestic Cat species parent, I don't think I want "
                    "his father to be a Faeble too. Duke Dijon may or may not be his "
                    "second cousin."
                ),
                kind="character",
                tags=["Ashford Saga"],
            ),
            _entry(
                "d1",
                "Duke Dijon and Lord Character T",
                (
                    "Duke Dijon is the second cousin of Lord Character T. Whether they "
                    "are actually cousins is left open. Dijon may feel less of the main "
                    "antagonist."
                ),
                kind="relationship",
                tags=["Ashford Saga"],
            ),
        ]
        res = self._ask("In Ashford Saga, who is Character T?", entries)
        answer = (res.get("answer") or "")
        body = re.split(r"\n—\s*From your notes", answer, maxsplit=1)[0].lower()
        self.assertIn("mother", body, msg=answer)
        self.assertIn("antagonist", body, msg=answer)
        self.assertIn("character e", body, msg=answer)
        self.assertTrue("quarry" in body or "hunt" in body, msg=answer)
        self.assertLessEqual(body.count("cousin"), 1, msg=answer)
        self.assertNotIn("sketched as", body)
        self.assertNotIn(", but is ", body)

    def test_who_is_mentions_relation_gap_when_none_written(self):
        entries = [
            _entry(
                "n1",
                "Character Z",
                "Character Z is the protagonist. Character Z is a young woman.",
                kind="character",
                tags=["Zeta Saga"],
            ),
        ]
        res = self._ask("In Zeta Saga, who is Character Z?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("protagonist", answer)
        self.assertIn("relations", answer)
        self.assertIn("don't yet", answer)

    def test_who_is_formalizes_concealment_as_identity(self):
        from lorekeeper_character_compose import formalize_who_is_sentence, smooth_who_is_prose

        raw = (
            "now Character E has to conceal her identity in order to not be discovered "
            "as a human and subsequently, an Author."
        )
        formal = formalize_who_is_sentence(raw, "Character E").lower()
        self.assertIn("conceal", formal)
        self.assertIn("human", formal)
        self.assertTrue("author" in formal, msg=formal)
        self.assertNotIn("has to conceal", formal)
        self.assertNotIn("in order to not be discovered", formal)
        self.assertIn("discovery would reveal", formal)
        body = (
            "Character E is the protagonist. Character E is a young woman. "
            "Character E is a young woman and an author. " + raw
        )
        smooth = smooth_who_is_prose("Character E", body).lower()
        self.assertEqual(smooth.count("young woman"), 1, msg=smooth)
        self.assertIn("conceal", smooth)
        self.assertNotIn("has to conceal", smooth)

    def test_who_is_preserves_twin_and_alias_brother_reveal(self):
        entries = [
            _entry(
                "n1",
                "Protagonist: Character P",
                'The protagonist is named "Character P."',
                kind="character",
                tags=["Rust Saga"],
            ),
            _entry(
                "n2",
                "Names",
                (
                    "Character P is the birth name of the protagonist, then he changes his name "
                    "to Cypher Prism, then to Palladiar when he becomes the leader of his "
                    "faction against Character G."
                ),
                kind="character",
                tags=["Rust Saga"],
            ),
            _entry(
                "n3",
                "Prism/Character P, Character Q/Character G",
                (
                    "Twins can combine. This leads to the eventual reveal that Character G "
                    "and Prism are brothers."
                ),
                kind="event",
                tags=["Rust Saga"],
            ),
            _entry(
                "d1",
                "Rust draft",
                (
                    "one of the twins, the protagonist's elder brother Character Q, forces his "
                    "way out, and then pulls his younger twin, Character P, after himself."
                ),
                kind="document",
                tags=["Rust Saga"],
            ),
        ]
        res = self._ask("In Rust Saga, who is Character P?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("protagonist", answer)
        self.assertTrue("twin" in answer, msg=answer)
        self.assertTrue("character q" in answer or "q" in answer, msg=answer)
        self.assertTrue(
            "character g" in answer or "gallox" in answer or "brother to" in answer,
            msg=answer,
        )
        self.assertTrue(
            "faction" in answer or "against" in answer or "palladiar" in answer or "cypher" in answer,
            msg=answer,
        )
        # Do not invent "seconds" or "neither knows" when not written.
        self.assertNotIn("seconds", answer)
        self.assertNotIn("neither", answer)
        # Natural cast card — not a stack of "X is… X is…" telegrams.
        self.assertLessEqual(answer.lower().count("character p is"), 3, msg=answer)
        self.assertRegex(
            answer,
            r"(?i)character p is the protagonist[^.]{0,160}twin",
            msg=answer,
        )

    def test_who_is_alias_brother_reveal_stays_on_subject(self):
        """Other cast members' rename dumps must not attach to this who-is."""
        entries = [
            _entry(
                "n1",
                "Protagonist: Character E",
                'The protagonist is named "Character E." Character E is a young woman.',
                kind="character",
                tags=["Rust Saga"],
            ),
            _entry(
                "n2",
                "Names",
                (
                    "Character P is the birth name of the protagonist, then he changes his name "
                    "to Cypher Prism, then to Palladiar when he becomes the leader of his "
                    "faction against Character G."
                ),
                kind="character",
                tags=["Rust Saga"],
            ),
            _entry(
                "n3",
                "Prism/Character P",
                (
                    "This leads to the eventual reveal that Character G and Prism are brothers."
                ),
                kind="event",
                tags=["Rust Saga"],
            ),
        ]
        res = self._ask("In Rust Saga, who is Character E?", entries)
        answer = (res.get("answer") or "").lower()
        self.assertIn("character e", answer)
        self.assertNotIn("brother to character g", answer)
        self.assertNotIn("prism", answer)
        self.assertNotIn("palladiar", answer)

    def test_who_is_tenebris_gold_locked(self):
        """
        Owner-locked Tenebris who-is gold (2026-08-11 night).

        Fixture is the exact live answer. Focus/scrub must not rearrange or
        glue the cast-card title onto the open. Scrambled order must restore.
        """
        from pathlib import Path

        from lorekeeper_answer_focus import focus_ask_response, scrub_rag_artifacts
        from lorekeeper_character_compose import (
            smooth_who_is_prose,
            strip_who_is_cast_card_header,
        )

        gold_path = (
            Path(__file__).resolve().parent
            / "fixtures"
            / "tenebris_who_is_gold.txt"
        )
        gold_body = gold_path.read_text(encoding="utf-8").strip()
        gold_sents = [
            s.strip() for s in re.split(r"(?<=[.!?])\s+", gold_body) if s.strip()
        ]
        self.assertEqual(len(gold_sents), 6, msg=gold_sents)
        self.assertTrue(
            gold_sents[0].startswith(
                "In Smoke And Mirrors, Tenebris is the main antagonist"
            )
        )
        self.assertIn("with Etherei as the subject of his fascination", gold_sents[0])
        self.assertNotIn("whose fascination", gold_sents[0])
        self.assertTrue(gold_sents[1].startswith("Duke Dijon is his third cousin"))
        self.assertTrue(gold_sents[2].startswith("His mother is from here"))
        self.assertTrue(
            gold_sents[3].startswith("He is personally disgusted by Predator Court")
        )
        self.assertNotIn("yet does not realize", gold_sents[3])
        self.assertTrue(gold_sents[4].startswith("He has mixed parentage"))
        self.assertTrue(
            gold_sents[5].startswith("Lord Tenebris of Cheshire is a faeble")
        )

        # Title strip must not leave "Tenebris In Smoke…"
        card = f"Tenebris\n\n{gold_body}\n\n— From your notes."
        stripped = strip_who_is_cast_card_header(card, "Tenebris")
        self.assertEqual(
            re.sub(r"\s+", " ", stripped.split("\n—")[0]).strip(),
            gold_body,
            msg=stripped[:200],
        )

        # Focus / scrub round-trip preserves gold wording + order
        q = "In Smoke And Mirrors, who is Tenebris?"
        for label, out in (
            (
                "focus",
                focus_ask_response(
                    q,
                    {
                        "ok": True,
                        "answer": card,
                        "questionKind": "who",
                        "sources": [],
                    },
                ).get("answer")
                or "",
            ),
            ("scrub", scrub_rag_artifacts(q, card, allow_broad=False)),
        ):
            body = re.split(r"\n—\s*From your notes", out, maxsplit=1)[0]
            body = re.sub(r"^Tenebris\s*\n+", "", body, count=1, flags=re.I).strip()
            body = re.sub(r"\s+", " ", body).strip()
            self.assertEqual(body, gold_body, msg=f"{label}: {body[:180]!r}")
            self.assertNotIn("Tenebris In Smoke", body)

        # Scrambled Dijon/parents-first must restore gold sentence order
        scrambled = " ".join(
            [
                gold_sents[1],
                gold_sents[2],
                "Tenebris In Smoke And Mirrors, "
                + gold_sents[0].split(", ", 1)[1],
                gold_sents[3],
                gold_sents[4],
                gold_sents[5],
            ]
        )
        fixed = re.sub(r"\s+", " ", smooth_who_is_prose("Tenebris", scrambled)).strip()
        self.assertEqual(fixed, gold_body, msg=fixed)
        fixed_sents = [
            s.strip() for s in re.split(r"(?<=[.!?])\s+", fixed) if s.strip()
        ]
        self.assertEqual(fixed_sents, gold_sents)

    def test_who_is_restores_gold_order_after_title_glue(self):
        """Cast-card title must not glue onto the open or float Dijon first."""
        from lorekeeper_answer_focus import focus_ask_response, scrub_rag_artifacts
        from lorekeeper_character_compose import (
            smooth_who_is_prose,
            strip_who_is_cast_card_header,
        )
        from pathlib import Path

        gold_body = (
            Path(__file__).resolve().parent
            / "fixtures"
            / "tenebris_who_is_gold.txt"
        ).read_text(encoding="utf-8").strip()
        # Compose shape: title line + body + footer
        card = f"Tenebris\n\n{gold_body}\n\n— From your notes."
        stripped = strip_who_is_cast_card_header(card, "Tenebris")
        self.assertTrue(
            stripped.lower().startswith("in smoke and mirrors"),
            msg=stripped[:120],
        )
        self.assertFalse(
            re.match(r"^tenebris\s+in\s+smoke", stripped, re.I),
            msg=stripped[:120],
        )

        # Owner regression: Dijon/parents first + garbled open mid-card
        scrambled = (
            "Duke Dijon is his third cousin, with whom he shares a relationship that is "
            "cold on the surface but more complicated — Duke Dijon is among the few cats "
            "he does not grudge, and both care; unbeknownst to him, his staying out of "
            "Court politics leaves Duke Dijon with a heavier load. His mother is from "
            "here, but his father is a Domestic Cat from another realm, with whether he "
            "is a Faeble too still open — and other cats gave him the cold shoulder "
            "because that father was an outsider. Tenebris In Smoke And Mirrors, "
            "Tenebris is the main antagonist, Baron of Cheshire, and the Cheshire Cat "
            "from Alice in Wonderland, with Etherei as the subject of his fascination. "
            "He is personally disgusted by Predator Court politics, and does not realize "
            "how much political influence he holds. He has mixed parentage, and is not "
            "entirely of this world. Lord Tenebris of Cheshire is a faeble with social "
            "rank — not a king or emperor."
        )
        fixed = smooth_who_is_prose("Tenebris", scrambled)
        lead = re.split(r"(?<=[.!?])\s+", fixed.strip(), maxsplit=1)[0]
        self.assertRegex(
            lead,
            r"^In Smoke And Mirrors,\s*Tenebris is the main antagonist",
            msg=f"lead={lead!r}\n{fixed}",
        )
        self.assertNotRegex(lead, r"^Duke Dijon\b")
        self.assertNotRegex(lead, r"^(His|Her)\s+(mother|father)\b")
        self.assertNotIn("Tenebris In Smoke", fixed)

        q = "In Smoke And Mirrors, who is Tenebris?"
        focused = focus_ask_response(
            q,
            {"ok": True, "answer": card, "questionKind": "who", "sources": []},
        )
        out = (focused.get("answer") or "")
        body = re.split(r"\n—\s*From your notes", out, maxsplit=1)[0]
        body = re.sub(r"^Tenebris\s*\n+", "", body, count=1, flags=re.I).strip()
        lead2 = re.split(r"(?<=[.!?])\s+", body.strip(), maxsplit=1)[0]
        self.assertRegex(
            lead2,
            r"^In Smoke And Mirrors,\s*Tenebris is the main antagonist",
            msg=f"lead={lead2!r}\n{out}",
        )
        # Scrub path alone must also strip title before collapse
        scrubbed = scrub_rag_artifacts(q, card, allow_broad=False)
        scrub_body = re.split(r"\n—\s*From your notes", scrubbed, maxsplit=1)[0]
        self.assertNotRegex(scrub_body, r"(?i)^Tenebris\s+In\s+Smoke")
        scrub_lead = re.split(r"(?<=[.!?])\s+", scrub_body.strip(), maxsplit=1)[0]
        self.assertRegex(
            scrub_lead,
            r"^In Smoke And Mirrors,\s*Tenebris is the main antagonist",
            msg=f"scrub_lead={scrub_lead!r}\n{scrubbed}",
        )


if __name__ == "__main__":
    unittest.main()
