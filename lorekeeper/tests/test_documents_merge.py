"""Stale shorter document saves must not wipe a slightly longer draft."""
from __future__ import annotations

import json
import unittest

from lorekeeper_api import merge_documents_payload


def _doc(did: str, words: int, title: str = "Draft") -> dict:
    body = " ".join(["word"] * words)
    return {
        "id": did,
        "title": title,
        "bodyHtml": f"<p>{body}</p>",
        "updatedAt": 1,
    }


class DocumentsMergeTests(unittest.TestCase):
    def test_small_shrink_keeps_longer_server_body(self):
        stored = [_doc("a", 100)]
        incoming = [_doc("a", 96)]
        merged = json.loads(merge_documents_payload(json.dumps(stored), json.dumps(incoming)))
        self.assertEqual(merged[0]["bodyHtml"], stored[0]["bodyHtml"])

    def test_real_cut_over_five_percent_is_allowed(self):
        stored = [_doc("a", 100)]
        incoming = [_doc("a", 80)]
        merged = json.loads(merge_documents_payload(json.dumps(stored), json.dumps(incoming)))
        self.assertEqual(merged[0]["bodyHtml"], incoming[0]["bodyHtml"])

    def test_longer_incoming_wins(self):
        stored = [_doc("a", 90)]
        incoming = [_doc("a", 110)]
        merged = json.loads(merge_documents_payload(json.dumps(stored), json.dumps(incoming)))
        self.assertEqual(merged[0]["bodyHtml"], incoming[0]["bodyHtml"])

    def test_empty_incoming_body_does_not_wipe(self):
        stored = [_doc("a", 40)]
        incoming = [{"id": "a", "title": "Draft", "bodyHtml": "", "updatedAt": 2}]
        merged = json.loads(merge_documents_payload(json.dumps(stored), json.dumps(incoming)))
        self.assertEqual(merged[0]["bodyHtml"], stored[0]["bodyHtml"])

    def test_dropped_duplicate_id_cannot_return(self):
        stored = [_doc("a", 10), _doc("d_mqhnkq78_5qoy4h2", 20)]
        incoming = [_doc("a", 10), _doc("d_mqhnkq78_5qoy4h2", 20)]
        merged = json.loads(merge_documents_payload(json.dumps(stored), json.dumps(incoming)))
        self.assertEqual([row["id"] for row in merged], ["a"])

    def test_normal_other_doc_delete_is_allowed(self):
        stored = [_doc("a", 10), _doc("b", 10)]
        incoming = [_doc("a", 10)]
        merged = json.loads(merge_documents_payload(json.dumps(stored), json.dumps(incoming)))
        self.assertEqual([row["id"] for row in merged], ["a"])


if __name__ == "__main__":
    unittest.main()
