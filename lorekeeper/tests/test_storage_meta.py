"""Storage meta for Owner's Office (#32)."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from lorekeeper_api import DATA_PATH, _storage_meta_for_owner


class StorageMetaTests(unittest.TestCase):
    def test_storage_meta_shape(self):
        meta = _storage_meta_for_owner()
        self.assertIn("storeExists", meta)
        self.assertIn("exportReminder", meta)
        self.assertNotIn("users", meta)

    def test_storage_meta_reads_file_mtime(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Path(tmp) / "lorekeeper-store.json"
            store.write_text('{"users": {}, "feedback": [], "settings": {}}', encoding="utf-8")
            import lorekeeper_api as api

            old = api.DATA_PATH
            try:
                api.DATA_PATH = str(store)
                meta = api._storage_meta_for_owner()
                self.assertTrue(meta["storeExists"])
                self.assertIsNotNone(meta["storeModifiedAt"])
                self.assertGreater(meta["storeSizeBytes"] or 0, 0)
            finally:
                api.DATA_PATH = old


if __name__ == "__main__":
    unittest.main()
