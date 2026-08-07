"""SQLite models for bookstore inventory (Halalit's existing DB stack)."""
from __future__ import annotations

import json
import os
import sqlite3
import time
from typing import Any

SCHEMA_VERSION = 1


def default_db_path() -> str:
    return os.environ.get(
        "HALALIT_BOOKSTORE_DB",
        os.environ.get(
            "HALALIT_ACCOUNTS_DB",
            os.path.expanduser("~/kids-sites/oddtrove-server/halalit_accounts.sqlite"),
        ),
    )


def connect(db_path: str | None = None) -> sqlite3.Connection:
    path = db_path or default_db_path()
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    conn = sqlite3.connect(path, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_schema(conn: sqlite3.Connection | None = None) -> None:
    own = conn is None
    conn = conn or connect()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS bookstore_meta (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bookstores (
              store_id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              website TEXT,
              inventory_source TEXT,
              online_ordering INTEGER NOT NULL DEFAULT 1,
              active INTEGER NOT NULL DEFAULT 1,
              paused INTEGER NOT NULL DEFAULT 0,
              needs_repair INTEGER NOT NULL DEFAULT 0,
              refresh_frequency_minutes INTEGER NOT NULL DEFAULT 360,
              stale_threshold_hours REAL NOT NULL DEFAULT 168,
              request_delay_seconds REAL NOT NULL DEFAULT 10,
              approved_domains_json TEXT NOT NULL DEFAULT '[]',
              config_json TEXT NOT NULL DEFAULT '{}',
              last_attempt_at REAL,
              last_success_at REAL,
              last_error TEXT,
              created_at REAL NOT NULL,
              updated_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bookstore_locations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              store_id TEXT NOT NULL REFERENCES bookstores(store_id),
              location_id TEXT NOT NULL,
              place_id TEXT,
              location_name TEXT,
              place_label TEXT,
              short_label TEXT,
              initials TEXT,
              street_address TEXT,
              city TEXT,
              state TEXT,
              postal_code TEXT,
              county TEXT,
              latitude REAL,
              longitude REAL,
              website TEXT,
              phone TEXT,
              hours TEXT,
              online_ordering INTEGER NOT NULL DEFAULT 1,
              inventory_source TEXT,
              favorite_default INTEGER NOT NULL DEFAULT 0,
              extra_json TEXT NOT NULL DEFAULT '{}',
              active INTEGER NOT NULL DEFAULT 1,
              UNIQUE(store_id, location_id)
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_bookstore_locations_place_id
              ON bookstore_locations(place_id) WHERE place_id IS NOT NULL;

            CREATE TABLE IF NOT EXISTS bookstore_reader_places (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              place_id TEXT NOT NULL UNIQUE,
              store_id TEXT,
              location_name TEXT NOT NULL,
              place_label TEXT NOT NULL,
              short_label TEXT,
              street_address TEXT,
              city TEXT,
              state TEXT,
              postal_code TEXT,
              county TEXT,
              website TEXT,
              phone TEXT,
              notes TEXT,
              created_by_user_id INTEGER,
              active INTEGER NOT NULL DEFAULT 1,
              created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bookstore_catalog_books (
              id TEXT PRIMARY KEY,
              title TEXT,
              normalized_title TEXT,
              author TEXT,
              normalized_author TEXT,
              isbn_10 TEXT,
              isbn_13 TEXT,
              publisher TEXT,
              edition TEXT,
              format TEXT,
              language TEXT,
              created_at REAL NOT NULL,
              updated_at REAL NOT NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_bookstore_catalog_isbn13
              ON bookstore_catalog_books(isbn_13) WHERE isbn_13 IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_bookstore_catalog_norm
              ON bookstore_catalog_books(normalized_title, normalized_author);

            CREATE TABLE IF NOT EXISTS bookstore_listings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              store_id TEXT NOT NULL REFERENCES bookstores(store_id),
              store_location_id TEXT,
              catalog_book_id TEXT REFERENCES bookstore_catalog_books(id),
              title TEXT,
              normalized_title TEXT,
              author TEXT,
              normalized_author TEXT,
              isbn_10 TEXT,
              isbn_13 TEXT,
              publisher TEXT,
              publication_date TEXT,
              edition TEXT,
              format TEXT,
              language TEXT,
              condition TEXT,
              price REAL,
              currency TEXT,
              availability TEXT,
              inventory_quantity INTEGER,
              product_url TEXT,
              image_url TEXT,
              source_identifier TEXT,
              match_confidence REAL,
              first_seen_at REAL NOT NULL,
              last_seen_at REAL NOT NULL,
              last_checked_at REAL,
              is_stale INTEGER NOT NULL DEFAULT 0,
              consecutive_misses INTEGER NOT NULL DEFAULT 0,
              raw_source_data TEXT,
              UNIQUE(store_id, source_identifier)
            );

            CREATE INDEX IF NOT EXISTS idx_bookstore_listings_isbn13
              ON bookstore_listings(isbn_13);
            CREATE INDEX IF NOT EXISTS idx_bookstore_listings_catalog
              ON bookstore_listings(catalog_book_id);
            CREATE INDEX IF NOT EXISTS idx_bookstore_listings_store_avail
              ON bookstore_listings(store_id, availability, is_stale);

            CREATE TABLE IF NOT EXISTS bookstore_match_review (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              listing_id INTEGER NOT NULL REFERENCES bookstore_listings(id) ON DELETE CASCADE,
              candidate_book_id TEXT,
              confidence REAL,
              method TEXT,
              reason TEXT,
              status TEXT NOT NULL DEFAULT 'pending',
              created_at REAL NOT NULL,
              resolved_at REAL,
              resolved_by TEXT
            );

            CREATE TABLE IF NOT EXISTS bookstore_scraper_runs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              store_id TEXT NOT NULL,
              job_type TEXT NOT NULL,
              started_at REAL NOT NULL,
              finished_at REAL,
              ok INTEGER,
              listings_seen INTEGER DEFAULT 0,
              listings_new INTEGER DEFAULT 0,
              listings_unavailable INTEGER DEFAULT 0,
              failed_pages INTEGER DEFAULT 0,
              error_summary TEXT,
              details_json TEXT
            );

            CREATE TABLE IF NOT EXISTS bookstore_scraper_errors (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              store_id TEXT NOT NULL,
              created_at REAL NOT NULL,
              error_type TEXT,
              message TEXT,
              url TEXT,
              hint TEXT
            );

            CREATE TABLE IF NOT EXISTS bookstore_job_locks (
              lock_key TEXT PRIMARY KEY,
              holder TEXT NOT NULL,
              expires_at REAL NOT NULL
            );
            """
        )
        conn.execute(
            "INSERT OR REPLACE INTO bookstore_meta(key, value) VALUES ('schema_version', ?)",
            (str(SCHEMA_VERSION),),
        )
        _ensure_location_columns(conn)
        conn.commit()
    finally:
        if own:
            conn.close()


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {k: row[k] for k in row.keys()}


def upsert_store(conn: sqlite3.Connection, store: dict[str, Any]) -> None:
    now = time.time()
    conn.execute(
        """
        INSERT INTO bookstores(
          store_id, name, website, inventory_source, online_ordering, active, paused,
          needs_repair, refresh_frequency_minutes, stale_threshold_hours, request_delay_seconds,
          approved_domains_json, config_json, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(store_id) DO UPDATE SET
          name=excluded.name,
          website=excluded.website,
          inventory_source=excluded.inventory_source,
          online_ordering=excluded.online_ordering,
          active=excluded.active,
          paused=excluded.paused,
          needs_repair=excluded.needs_repair,
          refresh_frequency_minutes=excluded.refresh_frequency_minutes,
          stale_threshold_hours=excluded.stale_threshold_hours,
          request_delay_seconds=excluded.request_delay_seconds,
          approved_domains_json=excluded.approved_domains_json,
          config_json=excluded.config_json,
          updated_at=excluded.updated_at
        """,
        (
            store["store_id"],
            store["name"],
            store.get("website"),
            store.get("inventory_source"),
            1 if store.get("online_ordering", True) else 0,
            1 if store.get("active", True) else 0,
            1 if store.get("paused", False) else 0,
            1 if store.get("needs_repair", False) else 0,
            int(store.get("refresh_frequency_minutes", 360)),
            float(store.get("stale_threshold_hours", 168)),
            float(store.get("request_delay_seconds", 10)),
            json.dumps(store.get("approved_domains") or []),
            json.dumps(store.get("config") or {}),
            now,
            now,
        ),
    )


def _ensure_location_columns(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(bookstore_locations)").fetchall()}
    alters = [
        ("place_id", "TEXT"),
        ("place_label", "TEXT"),
        ("short_label", "TEXT"),
        ("initials", "TEXT"),
        ("county", "TEXT"),
        ("favorite_default", "INTEGER NOT NULL DEFAULT 0"),
        ("extra_json", "TEXT NOT NULL DEFAULT '{}'"),
    ]
    for name, decl in alters:
        if name not in cols:
            conn.execute(f"ALTER TABLE bookstore_locations ADD COLUMN {name} {decl}")


def upsert_location(conn: sqlite3.Connection, loc: dict[str, Any]) -> None:
    _ensure_location_columns(conn)
    known = {
        "store_id",
        "location_id",
        "place_id",
        "location_name",
        "place_label",
        "short_label",
        "initials",
        "street_address",
        "city",
        "state",
        "postal_code",
        "county",
        "latitude",
        "longitude",
        "website",
        "phone",
        "hours",
        "online_ordering",
        "inventory_source",
        "favorite_default",
        "active",
    }
    extra = {k: v for k, v in loc.items() if k not in known and k not in ("store_id",)}
    # Keep store-specific ids (e.g. bn_store_number) in extra_json.
    for key in ("bn_store_number", "store_number", "pickup_hint"):
        if key in loc:
            extra[key] = loc[key]
    place_id = loc.get("place_id") or f"{loc['store_id']}-{loc.get('location_id') or 'main'}"
    place_label = loc.get("place_label") or loc.get("location_name") or place_id
    conn.execute(
        """
        INSERT INTO bookstore_locations(
          store_id, location_id, place_id, location_name, place_label, short_label, initials,
          street_address, city, state, postal_code, county, latitude, longitude, website, phone,
          hours, online_ordering, inventory_source, favorite_default, extra_json, active
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(store_id, location_id) DO UPDATE SET
          place_id=excluded.place_id,
          location_name=excluded.location_name,
          place_label=excluded.place_label,
          short_label=excluded.short_label,
          initials=excluded.initials,
          street_address=excluded.street_address,
          city=excluded.city,
          state=excluded.state,
          postal_code=excluded.postal_code,
          county=excluded.county,
          latitude=excluded.latitude,
          longitude=excluded.longitude,
          website=excluded.website,
          phone=excluded.phone,
          hours=excluded.hours,
          online_ordering=excluded.online_ordering,
          inventory_source=excluded.inventory_source,
          favorite_default=excluded.favorite_default,
          extra_json=excluded.extra_json,
          active=excluded.active
        """,
        (
            loc["store_id"],
            loc.get("location_id") or "main",
            place_id,
            loc.get("location_name"),
            place_label,
            loc.get("short_label") or loc.get("location_name"),
            loc.get("initials"),
            loc.get("street_address"),
            loc.get("city"),
            loc.get("state"),
            loc.get("postal_code"),
            loc.get("county"),
            loc.get("latitude"),
            loc.get("longitude"),
            loc.get("website"),
            loc.get("phone"),
            loc.get("hours"),
            1 if loc.get("online_ordering", True) else 0,
            loc.get("inventory_source"),
            1 if loc.get("favorite_default", False) else 0,
            json.dumps(extra),
            1 if loc.get("active", True) else 0,
        ),
    )
