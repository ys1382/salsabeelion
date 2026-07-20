"""Confirm-sources Ask — preview candidates, then answer only from selected ids."""
from __future__ import annotations

import json
import unittest

from lorekeeper_recall import recall_from_user_data


class ConfirmSourcesTests(unittest.TestCase):
    def setUp(self) -> None:
        entries = [
            {
                "id": "n-good",
                "title": "Galloxidor bond",
                "kind": "relationship",
                "tags": ["Cities Of Rust"],
                "body": (
                    "In Cities Of Rust, Galloxidor and the protagonist grow from "
                    "uneasy allies before the war into wary partners after it starts."
                ),
            },
            {
                "id": "n-noise",
                "title": "Market prices",
                "kind": "note",
                "tags": ["Cities Of Rust"],
                "body": "Rust city scrap prices rose in spring. Unrelated to Galloxidor.",
            },
        ]
        self.user_data = {
            "lorekeeper_entries_v1": json.dumps(entries),
            "lorekeeper_documents_v1": json.dumps([]),
        }
        self.question = (
            "In Cities Of Rust, summarize the relationship that develops between "
            "the protagonist and Galloxidor before and after the war"
        )

    def test_preview_returns_candidates_without_full_summary(self) -> None:
        res = recall_from_user_data(
            self.question,
            self.user_data,
            ask_phase="preview",
        )
        self.assertTrue(res.get("ok"))
        self.assertTrue(res.get("needsConfirm"))
        self.assertEqual(res.get("askPhase"), "preview")
        candidates = res.get("candidates") or []
        self.assertGreaterEqual(len(candidates), 1)
        ids = {c.get("id") for c in candidates}
        self.assertIn("n-good", ids)
        answer = (res.get("answer") or "").lower()
        self.assertIn("found", answer)
        self.assertNotIn("uneasy allies", answer)

    def test_answer_uses_only_confirmed_ids(self) -> None:
        res = recall_from_user_data(
            self.question,
            self.user_data,
            ask_phase="answer",
            confirmed_source_ids=["n-good"],
        )
        self.assertTrue(res.get("ok"))
        self.assertFalse(res.get("needsConfirm"))
        answer = (res.get("answer") or "").lower()
        self.assertNotIn("scrap prices", answer)
        self.assertTrue(
            "galloxidor" in answer
            or "allies" in answer
            or "partner" in answer
            or "war" in answer
            or "nothing" in answer
        )

    def test_default_phase_still_answers_without_preview(self) -> None:
        res = recall_from_user_data(self.question, self.user_data)
        self.assertTrue(res.get("ok"))
        self.assertFalse(res.get("needsConfirm"))
        self.assertNotEqual(res.get("askPhase"), "preview")

    def test_spot_check_skips_preview(self) -> None:
        res = recall_from_user_data(
            self.question,
            self.user_data,
            ask_phase="preview",
            spot_check=True,
        )
        self.assertTrue(res.get("ok"))
        self.assertFalse(res.get("needsConfirm"))


if __name__ == "__main__":
    unittest.main()


class ConfirmSourcesFalseGapTests(unittest.TestCase):
    def test_empty_claim_detector_catches_spell_out_phrasing(self) -> None:
        from lorekeeper_confirmed_ask import answer_looks_like_empty_claim

        msg = (
            "No sources in your notes spell out any interaction, alliance, rivalry, or shift "
            "between the protagonist and Galloxidor — pre-war or post-war — in *Cities of Rust*."
        )
        self.assertTrue(answer_looks_like_empty_claim(msg))

    def test_confirmed_answer_uses_selected_body_not_false_gap(self) -> None:
        entries = [
            {
                "id": "n-good",
                "title": "Galloxidor scenes",
                "kind": "note",
                "tags": ["Cities Of Rust"],
                "body": (
                    "Galloxidor meets the protagonist in the scrap yards before the war. "
                    "After the war begins, Galloxidor shields her and their trust hardens "
                    "into an uneasy alliance."
                ),
            },
        ]
        user_data = {
            "lorekeeper_entries_v1": json.dumps(entries),
            "lorekeeper_documents_v1": json.dumps([]),
        }
        q = (
            "In Cities Of Rust, summarize the relationship that develops between "
            "the protagonist and Galloxidor pre and post war"
        )
        res = recall_from_user_data(
            q, user_data, ask_phase="answer", confirmed_source_ids=["n-good"]
        )
        answer = (res.get("answer") or "").lower()
        self.assertTrue(res.get("ok"))
        self.assertIn("galloxidor", answer)
        self.assertNotIn("spell out", answer)
