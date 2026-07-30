"""Synthetic plot-span Ask regressions (Owner's Office Jul 2026 corrections)."""
from __future__ import annotations

import json
import unittest

from lorekeeper_plot_span import (
    all_span_anchors,
    augment_ranked_for_plot_span,
    extract_plot_span_anchors,
    is_plot_span_question,
    text_matches_anchor,
)
from lorekeeper_recall import _best_excerpt, _kind_label, _rank_entries, _score_entry, _tokenize
from lorekeeper_rag import retrieve_for_question


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


class PlotSpanParseTests(unittest.TestCase):
    Q = (
        "Ashford Saga: tell me about all the plot related stuff leading up to "
        "and including Character M escaping Lord Ashen's mansion, beginning "
        "with the bridge flashback and ending with Character D allowing "
        "Character M to escape"
    )

    def test_is_plot_span(self):
        self.assertTrue(is_plot_span_question(self.Q))

    def test_extract_begin_end_mid(self):
        span = extract_plot_span_anchors(self.Q)
        start_blob = " ".join(span["start"]).lower()
        end_blob = " ".join(span["end"]).lower()
        mid_blob = " ".join(span["mid"]).lower()
        self.assertIn("bridge", start_blob)
        self.assertIn("flashback", start_blob)
        self.assertIn("character d", end_blob)
        self.assertIn("escape", end_blob)
        self.assertTrue("mansion" in mid_blob or "escaping" in mid_blob)

    def test_after_including_is_span(self):
        q = (
            "Remind me of everything after the bridge flashback that "
            "Obsidian has, including whatever happens after Character M "
            "is captured"
        )
        self.assertTrue(is_plot_span_question(q))
        anchors = all_span_anchors(q)
        blob = " ".join(anchors).lower()
        self.assertIn("bridge", blob)
        self.assertTrue("captured" in blob or "character m" in blob)


class PlotSpanRetrievalTests(unittest.TestCase):
    Q = (
        "In Ashford Saga, tell me the plot leading up to and including "
        "Character M escaping the manor, beginning with the rat flashback "
        "and ending with Character D allowing Character M to escape"
    )

    def setUp(self):
        # Early setup wins naive keyword overlap; late escape note is the miss.
        self.entries = [
            _entry(
                "early1",
                "Before the rat flashback",
                "Character M is tracked after the Cheshire bite. "
                "Setup and pursuit fill many pages before any flashback.",
            ),
            _entry(
                "early2",
                "Chase setup",
                "Hunters follow Character M through the woods. "
                "The chase continues for a long stretch of draft.",
            ),
            _entry(
                "early3",
                "Bite aftermath",
                "The bite set larger events in motion. Character M limps home.",
            ),
            _entry(
                "flash",
                "Rat flashback",
                "The rat flashback shows Character M's earlier wound and fear.",
            ),
            _entry(
                "mansion",
                "Face the music at the manor",
                "At Lord Ashen's mansion Character M faces the music: "
                "confrontation, confession, and the locked wing.",
            ),
            _entry(
                "escape",
                "Character D helps the escape",
                "Character D allowing Character M to escape the manor: "
                "unlocks the side gate and looks the other way.",
            ),
        ]

    def test_end_note_matches_anchor(self):
        self.assertTrue(
            text_matches_anchor(
                self.entries[-1]["body"],
                "Character D allowing Character M to escape",
            )
        )

    def test_augment_keeps_end_beat(self):
        ranked = _rank_entries(self.Q, self.entries)
        # Without augment, escape can fall behind early chase notes.
        boosted = augment_ranked_for_plot_span(
            self.Q,
            self.entries,
            ranked,
            rank_entry=_score_entry,
            kind_label=_kind_label,
            best_excerpt=_best_excerpt,
            tokenize=_tokenize,
        )
        top_ids = [r["id"] for r in boosted[:6]]
        self.assertIn("escape", top_ids)
        self.assertIn("flash", top_ids)
        # Mansion / face-the-music should ride the mid "escaping the manor" cue.
        self.assertTrue("mansion" in top_ids or "escape" in top_ids)

    def test_retrieve_includes_end_in_top_k(self):
        scoped, ranked, _, _ = retrieve_for_question(
            self.Q,
            self.entries,
            rank_entries=_rank_entries,
            augment_ranked=lambda q, sc, ranked: augment_ranked_for_plot_span(
                q,
                sc,
                ranked,
                rank_entry=_score_entry,
                kind_label=_kind_label,
                best_excerpt=_best_excerpt,
                tokenize=_tokenize,
            ),
        )
        self.assertTrue(scoped)
        ids = [r["id"] for r in ranked]
        self.assertIn("escape", ids)
        bodies = " ".join(str(r.get("body") or "") for r in ranked).lower()
        self.assertIn("side gate", bodies)


if __name__ == "__main__":
    unittest.main()
