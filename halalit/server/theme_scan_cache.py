"""Shared Bookcheck theme-scan cache — reuse answers across readers for the same book.

Stored on disk (SQLite). Bump CACHE_VERSION when theme-scan prompts/rules change enough
that old answers should not be reused.
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from typing import Any

from halalit_lookup_log import lookup_group_key

# Bump when dual-scan merge rules or theme prompt meaning changes materially.
CACHE_VERSION = "v1"

_lock = threading.Lock()
_table_ready = False


def _db_path() -> str:
    explicit = os.environ.get("HALALIT_THEME_SCAN_CACHE_DB", "").strip()
    if explicit:
        return explicit
    accounts = os.environ.get(
        "HALALIT_ACCOUNTS_DB",
        os.path.expanduser("~/kids-sites/oddtrove-server/halalit_accounts.sqlite"),
    )
    base = os.path.dirname(accounts) or "."
    return os.path.join(base, "halalit_theme_scan_cache.sqlite")


def _connect() -> sqlite3.Connection:
    path = _db_path()
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    conn = sqlite3.connect(path, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_table(conn: sqlite3.Connection) -> None:
    global _table_ready
    if _table_ready:
        return
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS theme_scan_cache (
            cache_key TEXT PRIMARY KEY,
            cache_version TEXT NOT NULL,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            is_graphic INTEGER NOT NULL DEFAULT 0,
            payload_json TEXT NOT NULL,
            created_at REAL NOT NULL,
            hit_count INTEGER NOT NULL DEFAULT 0,
            last_hit_at REAL
        )
        """
    )
    conn.commit()
    _table_ready = True


def make_cache_key(title: str, author: str, is_graphic: bool) -> str:
    group = lookup_group_key(title or "", author or "")
    graphic = "1" if is_graphic else "0"
    return f"{CACHE_VERSION}|{group}|g{graphic}"


def get_cached_theme_scan(title: str, author: str, is_graphic: bool) -> dict[str, Any] | None:
    key = make_cache_key(title, author, is_graphic)
    with _lock:
        try:
            conn = _connect()
            try:
                _ensure_table(conn)
                row = conn.execute(
                    "SELECT payload_json FROM theme_scan_cache WHERE cache_key = ? AND cache_version = ?",
                    (key, CACHE_VERSION),
                ).fetchone()
                if not row:
                    return None
                payload = json.loads(row["payload_json"])
                if not isinstance(payload, dict) or not payload.get("ok"):
                    return None
                now = time.time()
                conn.execute(
                    "UPDATE theme_scan_cache SET hit_count = hit_count + 1, last_hit_at = ? WHERE cache_key = ?",
                    (now, key),
                )
                conn.commit()
                out = dict(payload)
                out["cached"] = True
                out["cacheVersion"] = CACHE_VERSION
                return out
            finally:
                conn.close()
        except (OSError, sqlite3.Error, json.JSONDecodeError, TypeError, ValueError):
            return None


def put_cached_theme_scan(
    title: str,
    author: str,
    is_graphic: bool,
    result: dict[str, Any],
) -> None:
    if not result or not result.get("ok"):
        return
    # Never persist error-shaped payloads.
    if result.get("error"):
        return
    key = make_cache_key(title, author, is_graphic)
    store = {k: v for k, v in result.items() if k not in ("cached", "cacheVersion")}
    store["ok"] = True
    now = time.time()
    with _lock:
        try:
            conn = _connect()
            try:
                _ensure_table(conn)
                conn.execute(
                    """
                    INSERT INTO theme_scan_cache (
                        cache_key, cache_version, title, author, is_graphic,
                        payload_json, created_at, hit_count, last_hit_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)
                    ON CONFLICT(cache_key) DO UPDATE SET
                        cache_version = excluded.cache_version,
                        title = excluded.title,
                        author = excluded.author,
                        is_graphic = excluded.is_graphic,
                        payload_json = excluded.payload_json,
                        created_at = excluded.created_at
                    """,
                    (
                        key,
                        CACHE_VERSION,
                        (title or "").strip()[:300],
                        (author or "").strip()[:200],
                        1 if is_graphic else 0,
                        json.dumps(store, ensure_ascii=False),
                        now,
                    ),
                )
                conn.commit()
            finally:
                conn.close()
        except (OSError, sqlite3.Error, TypeError, ValueError):
            return
