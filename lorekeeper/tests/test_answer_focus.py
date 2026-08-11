"""Focused Ask answer helpers (#41–47)."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

from lorekeeper_answer_focus import (
    apply_length_policy,
    detect_narrow_facet,
    drop_trailing_unfinished_clause,
    focus_ask_response,
    focus_topic_gather_answer,
    wants_broad_answer,
)
from lorekeeper_recall import recall_from_user_data

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "smoke_and_mirrors_corpus.json"


def _looks_cut_mid_phrase(text: str) -> bool:
    t = (text or "").rstrip()
    if t.endswith((" the", " a", " an", " however,", " However,")):
        return True
    if t.count("**") % 2 == 1:
        return True
    return False


class AnswerFocusTests(unittest.TestCase):
    def test_wants_broad_on_summarize(self):
        self.assertTrue(wants_broad_answer("In Work, summarize Character A"))
        self.assertFalse(wants_broad_answer("In Work, who is Character A?"))

    def test_detect_role_facet(self):
        self.assertEqual(
            detect_narrow_facet("In Ashford Saga, what is Character M's role?"),
            "role",
        )

    def test_focus_topic_caps_bullets(self):
        raw = (
            "What you've written about gate (across your notes):\n\n"
            "• From “A”: one\n• From “B”: two\n• From “C”: three\n"
            "• From “D”: four\n• From “E”: five\n\n"
            "— Combined from your notes only. Nothing invented."
        )
        out = focus_topic_gather_answer("In Work, northern gate", raw, allow_broad=False)
        self.assertLessEqual(out.count("•"), 4)

    def test_relationship_stays_short_after_focus(self):
        data = json.loads(FIXTURE.read_text(encoding="utf-8"))
        q = f"In {data['workTag']}, how are Etherei and Character B related?"
        res = recall_from_user_data(
            q,
            {"lorekeeper_entries_v1": json.dumps(data["entries"])},
        )
        res = focus_ask_response(q, res)
        answer = res.get("answer") or ""
        self.assertIn("brother", answer.lower())
        self.assertNotIn("protagonist", answer.lower())
        self.assertLess(len(answer), 220)

    def test_parenthetical_hint_sets_facet(self):
        self.assertEqual(
            detect_narrow_facet(
                "In Smoke and Mirrors, who is Etherei (political role in the north)?"
            ),
            "politics",
        )

    def test_spot_check_skips_length_trim(self):
        long_body = "Etherei is the protagonist. " + (
            "Detail sentence about Etherei. " * 80
        )
        payload = {
            "ok": True,
            "answer": long_body + "\n\n— From your notes only. Nothing invented.",
            "sources": [],
            "questionKind": "who",
        }
        trimmed = focus_ask_response("In Work, who is Etherei?", payload, spot_check=False)
        full = focus_ask_response("In Work, who is Etherei?", payload, spot_check=True)
        self.assertLess(len(trimmed.get("answer") or ""), len(full.get("answer") or ""))

    def test_length_policy_does_not_cut_mid_sentence(self):
        body = (
            "Character A softens at the POV cut. "
            "However, **none of your notes describe the look on Character A's face "
            "beyond that stunned beat. "
            "Add more if you want a full expression note later."
        )
        cut = body.index("describe the") + len("describe the")
        truncated_mid = body[:cut]
        self.assertTrue(truncated_mid.endswith("describe the"))
        repaired = drop_trailing_unfinished_clause(truncated_mid)
        self.assertFalse(repaired.endswith("describe the"))
        self.assertTrue(
            repaired.endswith((".", "!", "?", "…"))
            or "stunned" in repaired.lower()
            or "softens" in repaired.lower()
        )

        long = (
            "Character A softens at the POV cut. " * 5
            + "However, **none of your notes describe the full expression from that beat. "
            + "You only wrote the stunned look. "
        ) * 3
        q = (
            "Ashford Saga: Describe for me the look on Character A's face "
            "right as Character A's POV ends. all my notes on that expression"
        )
        footer = "— From your notes only. Nothing invented."
        out = apply_length_policy(
            q,
            long + "\n\n" + footer,
            question_kind="topic",
            allow_broad=False,
        )
        self.assertIn(footer, out)
        body_out = out.split(footer)[0].strip()
        self.assertFalse(body_out.endswith("the"))
        self.assertFalse(_looks_cut_mid_phrase(body_out))

    def test_appearance_hard_trim_ends_on_sentence(self):
        long = (
            "Character A has grey eyes in your notes. "
            "However, **none of your notes describe the "
        )
        pad = "Extra complete sentence about posture and height. " * 12
        q = "In Ashford Saga, what does Character A look like?"
        footer = "— From your notes only. Nothing invented."
        out = apply_length_policy(
            q,
            pad + long + "\n\n" + footer,
            question_kind="topic",
            allow_broad=False,
        )
        body = out.split("— From your notes only")[0].strip()
        self.assertFalse(body.endswith("the"))
        self.assertFalse(body.endswith("describe the"))
        self.assertTrue(
            body.endswith((".", "!", "?", "…")) or "grey eyes" in body.lower()
        )

    def test_scrub_source_label_leak(self):
        from lorekeeper_answer_focus import scrub_rag_artifacts

        raw = (
            'His working fear is punishment; SOURCE 9 makes clear this belief is '
            "incorrect, as the Baron intends guest reception instead.\n\n"
            "— From your notes only. Nothing invented."
        )
        q = "Where did I leave off in the main draft in terms of plot?"
        cleaned = scrub_rag_artifacts(q, raw, allow_broad=True)
        self.assertNotIn("SOURCE 9", cleaned)
        self.assertNotIn("SOURCE", cleaned)
        self.assertIn("notes make clear", cleaned.lower())
        self.assertIn("incorrect", cleaned.lower())


if __name__ == "__main__":
    unittest.main()
