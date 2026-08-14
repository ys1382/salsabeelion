"""When-will Ask — later-book vs this-book timing (synthetic only)."""
from __future__ import annotations

import json
import unittest

from lorekeeper_rag import _system_for_kind
from lorekeeper_recall import recall_from_user_data
from lorekeeper_shaped_recall import (
    answer_meets_when_will_gold_bar,
    ensure_when_timing_completeness,
    is_when_timing_question,
    notes_mark_later_book_for_question,
)
from lorekeeper_work_recall import route_question


def _entry(eid, title, body, *, kind="note", tags=None):
    return {
        "id": eid,
        "title": title,
        "body": body,
        "tags": tags or ["Ashford Saga"],
        "kind": kind,
        "createdAt": 1,
        "updatedAt": 1,
    }


Q = (
    "In Ashford Saga, when will the Predators find out that the Herdfolk "
    "from their realm are sentient?"
)


class WhenTimingTests(unittest.TestCase):
    def test_detects_when_will(self):
        self.assertTrue(is_when_timing_question(Q))
        self.assertEqual(route_question(Q), "when")
        self.assertFalse(
            is_when_timing_question("Who is Character E when the wolf arrives?")
        )

    def test_rag_when_prompt_asks_for_timing_first(self):
        system = _system_for_kind(Q, "when", brief=False)
        self.assertIn("WHEN", system.upper())
        self.assertIn("later book", system.lower())
        self.assertIn("first sentence", system.lower())
        self.assertNotIn("leave the timing unspecified", system.lower())

    def test_notes_mark_later_book(self):
        entries = [
            _entry(
                "n1",
                "Herdfolk sentience",
                "Predators learning that Herdfolk in their realm are sentient "
                "does not happen until a later book.",
            ),
            _entry(
                "n2",
                "Unrelated later",
                "Character E returns home — this does not happen until a later book.",
            ),
        ]
        self.assertTrue(notes_mark_later_book_for_question(Q, entries))
        self.assertFalse(
            notes_mark_later_book_for_question(Q, [entries[1]])
        )

    def test_completeness_leads_with_later_book_and_drops_extra(self):
        entries = [
            _entry(
                "n1",
                "Herdfolk sentience",
                "The Herdfolk sentience reveal does not happen until a later book "
                "and is not a plot point for the first book.",
            )
        ]
        essay = (
            "Ashford Saga depicts a world where Predators operate under a "
            "fundamental misunderstanding about Herdfolk sentience. "
            "This ignorance is deliberate on the Herdfolk's part. "
            "The birds hide through plumage and environmental camouflage. "
            "Some masquerade as parrots to survive.\n\n"
            "— From your notes only. Nothing invented."
        )
        out, did = ensure_when_timing_completeness(Q, entries, essay)
        self.assertTrue(did)
        self.assertTrue(
            answer_meets_when_will_gold_bar(out, work="Ashford Saga"),
            out[:240],
        )
        low = out.lower()
        self.assertTrue(low.startswith("the notes indicate this is not happening"))
        self.assertIn("ashford saga", low)
        self.assertNotIn("parrot", low)
        self.assertNotIn("plumage", low)
        self.assertIn("from your notes only", low)

    def test_focus_keeps_later_book_lead(self):
        from lorekeeper_answer_focus import (
            focus_ask_response,
            trim_off_topic_sentences,
        )

        live_q = (
            "When will the Predators find out that the Preyfolk from their "
            "realm are sentient?"
        )
        entries = [
            _entry(
                "n1",
                "Preyfolk sentience",
                "The Preyfolk sentience reveal is for future books in the series.",
                tags=["Smoke and Mirrors"],
            )
        ]
        essay = (
            "The Predators of this realm currently operate under a foundational "
            "misunderstanding: they believe the Preyfolk are not sentient. "
            "Preyfolk hide their sentience with body language.\n\n"
            "— From your notes only. Nothing invented."
        )
        out, did = ensure_when_timing_completeness(live_q, entries, essay)
        self.assertTrue(did)
        self.assertTrue(
            answer_meets_when_will_gold_bar(out, work="Smoke and Mirrors"),
            out[:240],
        )
        trimmed = trim_off_topic_sentences(live_q, out, allow_broad=False)
        self.assertTrue(
            answer_meets_when_will_gold_bar(trimmed, work="Smoke and Mirrors"),
            trimmed[:240],
        )
        focused = focus_ask_response(
            live_q,
            {
                "ok": True,
                "answer": out,
                "questionKind": "when",
                "sources": [],
            },
        )
        fans = focused.get("answer") or ""
        self.assertTrue(
            answer_meets_when_will_gold_bar(fans, work="Smoke and Mirrors"),
            fans[:240],
        )
        self.assertNotIn("body language", fans.lower())

    def test_drops_invented_whether_when_notes_place_later(self):
        live_q = (
            "When will the Predators find out that the Preyfolk from their "
            "realm are sentient?"
        )
        entries = [
            _entry(
                "n1",
                "Preyfolk sentience",
                "The Preyfolk sentience reveal is for future books in the series.",
                tags=["Smoke and Mirrors"],
            )
        ]
        essay = (
            "Smoke and Mirrors does not yet spell out when—or even whether—"
            "Predators will learn the sentience of the Preyfolk from their own realm. "
            "Tenebris has discovered that Preyfolk can be sentient, as proven by "
            "Etherei, but he remains unaware that the Preyfolk native to his own "
            "world are similarly sentient.\n\n"
            "— From your notes only. Nothing invented."
        )
        out, did = ensure_when_timing_completeness(live_q, entries, essay)
        self.assertTrue(did)
        self.assertTrue(
            answer_meets_when_will_gold_bar(out, work="Smoke and Mirrors"),
            out[:240],
        )
        low = out.lower()
        self.assertNotIn("whether", low)
        self.assertNotIn("spell out", low)
        self.assertIn("tenebris", low)

    def test_does_not_invent_later_book_when_notes_do_not_place_it(self):
        entries = [
            _entry(
                "n1",
                "Herdfolk",
                "Herdfolk are mostly herbivores with considerable cunning.",
            )
        ]
        essay = (
            "Herdfolk are mostly herbivores with considerable cunning.\n\n"
            "— From your notes only. Nothing invented."
        )
        out, did = ensure_when_timing_completeness(Q, entries, essay)
        self.assertFalse(did)
        self.assertNotIn("later book", out.lower())

    def test_recall_when_will_names_later_book(self):
        entries = [
            _entry(
                "n1",
                "Herdfolk sentience",
                "Predators currently believe Herdfolk are not sentient. "
                "The reveal that Herdfolk of their realm are sentient does not "
                "happen until a later book, not in the first book of Ashford Saga.",
            ),
            _entry(
                "n2",
                "Birds",
                "The birds hide through plumage and masquerade as parrots.",
            ),
            _entry(
                "d1",
                "Draft",
                "Character E walked the manor garden at dusk.",
                kind="document",
            ),
        ]
        import os

        os.environ["LOREKEEPER_RAG"] = "0"
        res = recall_from_user_data(
            Q, {"lorekeeper_entries_v1": json.dumps(entries)}
        )
        answer = (res.get("answer") or "")
        self.assertEqual(res.get("questionKind"), "when")
        self.assertTrue(
            answer_meets_when_will_gold_bar(answer, work="Ashford Saga"),
            answer[:240],
        )
        self.assertNotIn("write what happens between", answer.lower())

    def test_preyfolk_when_will_gold_shape_locked(self):
        """
        Owner-locked when-will gold (2026-08-14).
        Fixture is the live Preyfolk Ask. Other when-will questions must meet
        this bar: short, this-book vs later-book first, no invented whether.
        """
        from pathlib import Path

        gold_path = (
            Path(__file__).resolve().parent
            / "fixtures"
            / "when_will_preyfolk_sentience_gold.txt"
        )
        gold = gold_path.read_text(encoding="utf-8").strip()
        self.assertTrue(
            answer_meets_when_will_gold_bar(gold, work="Smoke and Mirrors"),
            gold[:240],
        )
        low = gold.lower()
        self.assertIn("not happening during the events of", low)
        self.assertIn("later books", low)
        self.assertIn("tenebris", low)
        self.assertIn("foundational misunderstanding", low)
        self.assertNotIn("whether", low)
        self.assertNotIn("body language", low)
        body = gold.split("—")[0].strip()
        sents = [s.strip() for s in body.split(". ") if s.strip()]
        self.assertLessEqual(len(sents), 2)

        live_q = (
            "When will the Predators find out that the Preyfolk from their "
            "realm are sentient?"
        )
        entries = [
            _entry(
                "n1",
                "Preyfolk sentience",
                "The Preyfolk sentience reveal is for future books in the series. "
                "Tenebris and the Predators currently believe the Preyfolk of "
                "their world lack sentience.",
                tags=["Smoke and Mirrors"],
            )
        ]
        bad = (
            "Smoke and Mirrors does not yet spell out when—or even whether—"
            "Predators will learn the sentience of the Preyfolk from their own realm. "
            "Preyfolk hide their sentience with body language that mimics "
            "non-sentient animals.\n\n"
            "— From your notes only. Nothing invented."
        )
        out, did = ensure_when_timing_completeness(live_q, entries, bad)
        self.assertTrue(did)
        self.assertTrue(
            answer_meets_when_will_gold_bar(out, work="Smoke and Mirrors"),
            out[:240],
        )
        self.assertNotIn("whether", out.lower())
        self.assertNotIn("body language", out.lower())

    def test_other_when_will_meets_same_gold_bar(self):
        q = "When will Character E return home?"
        entries = [
            _entry(
                "n1",
                "Return",
                "Character E returns home — this does not happen until a later book.",
            )
        ]
        essay = (
            "Character E left the manor years ago and still writes letters. "
            "The orchard wall is made of pale stone. "
            "A raven keeps watch from the gate.\n\n"
            "— From your notes only. Nothing invented."
        )
        out, did = ensure_when_timing_completeness(q, entries, essay)
        self.assertTrue(did)
        self.assertTrue(
            answer_meets_when_will_gold_bar(out, work="Ashford Saga"),
            out[:240],
        )
        self.assertNotIn("orchard", out.lower())
        self.assertNotIn("raven", out.lower())


if __name__ == "__main__":
    unittest.main()
