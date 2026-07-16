"""
Halalit reader accounts — email + password, session cookies, per-user JSON data blobs.
Stdlib only (sqlite3 + hashlib.scrypt). Owner role via HALALIT_OWNER_EMAIL env.
"""
from __future__ import annotations

from urllib.parse import parse_qs, quote, urlparse

from halalit_lookup_log import (
    lookup_group_key,
    owner_lookup_aggregated,
    owner_lookup_for_account,
    owner_lookup_recent,
    owner_review_pending_for_title,
    owner_review_pending_kind,
    record_bookcheck_lookup,
)
from halalit_lookup_quality import is_garbage_lookup

import hashlib
import json
import os
import re
import secrets
import sqlite3
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import BaseHTTPRequestHandler
from typing import Any


def _ensure_shared_import_path() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    for candidate in (
        os.path.join(os.path.dirname(here), "_shared"),
        os.path.join(os.path.dirname(os.path.dirname(here)), "top", "_shared"),
        os.path.expanduser("~/kids-sites/_shared"),
    ):
        if os.path.isdir(candidate) and candidate not in sys.path:
            sys.path.insert(0, candidate)
            return


_ensure_shared_import_path()

from oddtrove_google_oauth import (  # noqa: E402
    authorize_url,
    exchange_code,
    google_configured,
    make_state,
    parse_state,
)
from oddtrove_password_reset import (  # noqa: E402
    RESET_RATE_WINDOW_SEC,
    client_ip_from_headers,
    hash_token,
    ip_rate_allowed,
    new_reset_token,
    record_ip_attempt,
    token_expires_at,
    within_rate_limit,
)
from oddtrove_transactional_mail import send_password_reset  # noqa: E402

DB_PATH = os.environ.get(
    "HALALIT_ACCOUNTS_DB",
    os.path.expanduser("~/kids-sites/halalit-server/halalit_accounts.sqlite"),
)
OWNER_EMAIL = os.environ.get("HALALIT_OWNER_EMAIL", "").strip().lower()
COOKIE_NAME = "halalit_session"
SESSION_DAYS = int(os.environ.get("HALALIT_SESSION_DAYS", "30"))
MAX_VALUE_BYTES = 2_000_000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

OWNER_VET_TIERS = frozenset(
    {
        "verified_clean",
        "user_discretion",
        "flag_review",
        "parked",
        "no_recommend_fanservice",
        "fanservice_caution",
        "deity_comfort",
    }
)
OWNER_VET_AGE_BANDS = frozenset(
    {"young_child", "older_child_young_teen", "older_teen_adult"}
)
OWNER_VET_FLAG_KEYS = frozenset(
    {
        "requiresMagicOptIn",
        "requiresDeityMythologyOptIn",
        "requiresSubstanceOptIn",
        "requiresLightRomanceOptIn",
        "requiresCulturalMisrepresentationOptIn",
        "requiresIslamicLiteratureInterest",
        "excludesBookQuest",
        "negativeFamilyPortrayal",
    }
)

KNOWN_DATA_KEYS = frozenset(
    {
        "halalitAlreadyReadBooks",
        "halalitWantToReadBooks",
        "halalitShelfRuleFeedback",
        "halalitReaderSeriesFeedback",
        "halalit_dismissed_series_expectations",
        "halalitBookQuestReaderAgeBand",
        "halalit_bookquest_exclude_deity_mythology",
        "halalit_bookquest_exclude_negative_family_portrayal",
        "halalit_bookquest_exclude_light_romance",
        "halalit_bookquest_exclude_magic",
        "halalit_bookquest_exclude_alcohol_drug",
        "halalit_bookquest_exclude_cultural_misrepresentation",
        "halalitCommunityTitleSubmissions",
        "halalitContinueSeriesPrefs",
        "halalitShelfAltListView",
        "halalitContinueSeriesDiscontinued",
        "halalitLibraryFavoritePlaces",
        "halalitReaderModel",
        "halalitPendingReview",
    }
)


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                is_owner INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS user_data (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                data_key TEXT NOT NULL,
                data_value TEXT NOT NULL,
                updated_at REAL NOT NULL,
                PRIMARY KEY (user_id, data_key)
            );
            CREATE TABLE IF NOT EXISTS owner_feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                payload TEXT NOT NULL,
                created_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS owner_settings (
                setting_key TEXT PRIMARY KEY,
                setting_value TEXT NOT NULL,
                updated_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS owner_scanner_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                phase TEXT NOT NULL,
                created_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS owner_reader_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                source TEXT NOT NULL,
                message TEXT NOT NULL,
                meta TEXT NOT NULL DEFAULT '{}',
                created_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS owner_vet_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL DEFAULT '',
                title_norm TEXT NOT NULL,
                author_norm TEXT NOT NULL DEFAULT '',
                tier TEXT NOT NULL,
                age_band TEXT,
                detail TEXT NOT NULL DEFAULT '',
                flags_json TEXT NOT NULL DEFAULT '{}',
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                UNIQUE(title_norm, author_norm)
            );
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at REAL NOT NULL,
                created_at REAL NOT NULL,
                used_at REAL
            );
            CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
            CREATE TABLE IF NOT EXISTS owner_notification_dismissals (
                notif_key TEXT PRIMARY KEY,
                state TEXT NOT NULL,
                kind TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL DEFAULT '',
                author TEXT NOT NULL DEFAULT '',
                preview TEXT NOT NULL DEFAULT '',
                snapshot_json TEXT NOT NULL DEFAULT '{}',
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS owner_scanned_tbr (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL DEFAULT '',
                title_norm TEXT NOT NULL,
                author_norm TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL DEFAULT 'shelf',
                created_at REAL NOT NULL,
                UNIQUE(title_norm, author_norm)
            );
            CREATE INDEX IF NOT EXISTS idx_owner_scanned_tbr_created
            ON owner_scanned_tbr(created_at DESC);
            """
        )
        cols = {str(r[1]) for r in conn.execute("PRAGMA table_info(users)").fetchall()}
        if "google_sub" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN google_sub TEXT")
        conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
            ON users(google_sub)
            WHERE google_sub IS NOT NULL AND google_sub != ''
            """
        )
        try:
            from owner_lookup_signals import ensure_signals_table

            ensure_signals_table(conn)
        except Exception as e:
            sys.stderr.write("owner_lookup_signals init skipped: %s\n" % (e,))
        conn.commit()


DEFAULT_SITE_FLAGS: dict[str, bool] = {
    "bookQuestEnabled": True,
    "bookcheckEnabled": True,
    "scrollScannerEnabled": True,
    "signupsEnabled": True,
}

SITE_FLAG_KEYS = frozenset(DEFAULT_SITE_FLAGS.keys())


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    if hasattr(hashlib, "scrypt"):
        dk = hashlib.scrypt(
            password.encode("utf-8"),
            salt=bytes.fromhex(salt),
            n=2**14,
            r=8,
            p=1,
            dklen=32,
        )
        return f"scrypt${salt}${dk.hex()}"
    # macOS CLT Python 3.9 often lacks hashlib.scrypt — pbkdf2 is fine for local/dev.
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        200_000,
        dklen=32,
    )
    return f"pbkdf2${salt}${dk.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        algo, salt_hex, digest_hex = stored.split("$", 2)
        if algo == "scrypt":
            if not hasattr(hashlib, "scrypt"):
                return False
            dk = hashlib.scrypt(
                password.encode("utf-8"),
                salt=bytes.fromhex(salt_hex),
                n=2**14,
                r=8,
                p=1,
                dklen=32,
            )
            return secrets.compare_digest(dk.hex(), digest_hex)
        if algo == "pbkdf2":
            dk = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                bytes.fromhex(salt_hex),
                200_000,
                dklen=32,
            )
            return secrets.compare_digest(dk.hex(), digest_hex)
        return False
    except (ValueError, TypeError):
        return False


def _normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def _parse_cookies(handler: BaseHTTPRequestHandler) -> dict[str, str]:
    raw = handler.headers.get("Cookie") or ""
    out: dict[str, str] = {}
    for part in raw.split(";"):
        if "=" not in part:
            continue
        k, v = part.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def _cookie_secure(handler: BaseHTTPRequestHandler) -> bool:
    if os.environ.get("HALALIT_COOKIE_SECURE", "1") == "0":
        return False
    proto = (handler.headers.get("X-Forwarded-Proto") or "").lower()
    return proto == "https"


def _set_session_cookie(handler: BaseHTTPRequestHandler, token: str) -> None:
    max_age = SESSION_DAYS * 86400
    parts = [
        f"{COOKIE_NAME}={token}",
        "Path=/halalit/",
        "HttpOnly",
        "SameSite=Lax",
        f"Max-Age={max_age}",
    ]
    if _cookie_secure(handler):
        parts.append("Secure")
    handler.send_header("Set-Cookie", "; ".join(parts))


def _clear_session_cookie(handler: BaseHTTPRequestHandler) -> None:
    parts = [
        f"{COOKIE_NAME}=",
        "Path=/halalit/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=0",
    ]
    if _cookie_secure(handler):
        parts.append("Secure")
    handler.send_header("Set-Cookie", "; ".join(parts))


def session_user(handler: BaseHTTPRequestHandler) -> dict[str, Any] | None:
    return _session_user(handler)


def _session_user(handler: BaseHTTPRequestHandler) -> dict[str, Any] | None:
    token = _parse_cookies(handler).get(COOKIE_NAME)
    if not token:
        return None
    now = time.time()
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.email, u.is_owner, s.expires_at
            FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()
        if not row or row["expires_at"] < now:
            if row:
                conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
                conn.commit()
            return None
        return {
            "id": row["id"],
            "email": row["email"],
            "is_owner": bool(row["is_owner"]),
        }


def _create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires = time.time() + SESSION_DAYS * 86400
    with _connect() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires),
        )
        conn.commit()
    return token


def _delete_session(handler: BaseHTTPRequestHandler) -> None:
    token = _parse_cookies(handler).get(COOKIE_NAME)
    if not token:
        return
    with _connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()


def _user_public(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "signedIn": True,
        "email": row["email"],
        "isOwner": bool(row["is_owner"]),
    }


def _maybe_log_feedback(user_id: int, key: str, value: str) -> None:
    if key != "halalitShelfRuleFeedback":
        return
    try:
        payload = json.loads(value)
    except json.JSONDecodeError:
        return
    if not isinstance(payload, list) or not payload:
        return
    with _connect() as conn:
        conn.execute(
            "INSERT INTO owner_feedback (user_id, payload, created_at) VALUES (?, ?, ?)",
            (user_id, json.dumps(payload[-3:]), time.time()),
        )
        conn.commit()


def signup(email: str, password: str) -> tuple[int, dict[str, Any]]:
    """Email/password signup is closed — new accounts use Google."""
    return 403, {"ok": False, "error": "signup_google_only"}


def login(email: str, password: str) -> tuple[int, dict[str, Any]]:
    email_n = _normalize_email(email)
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash, is_owner FROM users WHERE email = ?",
            (email_n,),
        ).fetchone()
    stored = (row["password_hash"] if row else "") or ""
    if not row or not stored or not _verify_password(password, stored):
        return 401, {"ok": False, "error": "invalid_credentials"}
    if OWNER_EMAIL and email_n == OWNER_EMAIL and not row["is_owner"]:
        with _connect() as conn:
            conn.execute("UPDATE users SET is_owner = 1 WHERE id = ?", (row["id"],))
            conn.commit()
    return 200, {
        "ok": True,
        "email": row["email"],
        "isOwner": bool(row["is_owner"]) or (OWNER_EMAIL and email_n == OWNER_EMAIL),
    }


def _public_site_base() -> str:
    return os.environ.get("HALALIT_PUBLIC_BASE_URL", "https://oddtrove.art/halalit").rstrip("/")


def _api_public_base() -> str:
    return os.environ.get(
        "HALALIT_API_PUBLIC_BASE_URL", "https://oddtrove.art/halalit/api"
    ).rstrip("/")


def _google_redirect_uri() -> str:
    return f"{_api_public_base()}/auth/google/callback"


def _safe_return_url(raw: str | None) -> str:
    path = str(raw or "").strip() or "./account.html"
    if path.startswith("http://") or path.startswith("https://"):
        base = _public_site_base()
        if path.startswith(base + "/") or path == base:
            return path
        return f"{_public_site_base()}/account.html"
    if path.startswith("/halalit/"):
        return "https://oddtrove.art" + path
    if path.startswith("/"):
        return f"{_public_site_base()}{path}"
    if path.startswith("./"):
        return f"{_public_site_base()}/{path[2:]}"
    return f"{_public_site_base()}/{path}"


def google_find_or_create(sub: str, email: str) -> tuple[int, dict[str, Any]]:
    """Link Google identity to an existing email account, or create a Google-only user."""
    init_db()
    sub = str(sub or "").strip()
    email_n = _normalize_email(email)
    if not sub or not EMAIL_RE.match(email_n):
        return 400, {"ok": False, "error": "google_auth_failed"}
    is_owner = 1 if OWNER_EMAIL and email_n == OWNER_EMAIL else 0
    with _connect() as conn:
        by_sub = conn.execute(
            "SELECT id, email, is_owner FROM users WHERE google_sub = ?",
            (sub,),
        ).fetchone()
        if by_sub:
            if OWNER_EMAIL and email_n == OWNER_EMAIL and not by_sub["is_owner"]:
                conn.execute("UPDATE users SET is_owner = 1 WHERE id = ?", (by_sub["id"],))
                conn.commit()
            return 200, {
                "ok": True,
                "userId": by_sub["id"],
                "email": by_sub["email"],
                "isOwner": bool(by_sub["is_owner"]) or bool(is_owner),
            }
        by_email = conn.execute(
            "SELECT id, email, is_owner, google_sub FROM users WHERE email = ?",
            (email_n,),
        ).fetchone()
        if by_email:
            other = (by_email["google_sub"] or "").strip()
            if other and other != sub:
                return 409, {"ok": False, "error": "google_email_conflict"}
            conn.execute(
                "UPDATE users SET google_sub = ?, is_owner = CASE WHEN ? = 1 THEN 1 ELSE is_owner END WHERE id = ?",
                (sub, is_owner, by_email["id"]),
            )
            conn.commit()
            return 200, {
                "ok": True,
                "userId": by_email["id"],
                "email": by_email["email"],
                "isOwner": bool(by_email["is_owner"]) or bool(is_owner),
            }
        if not _get_site_flags().get("signupsEnabled", True):
            return 403, {"ok": False, "error": "signups_disabled"}
        try:
            conn.execute(
                """
                INSERT INTO users (email, password_hash, is_owner, created_at, google_sub)
                VALUES (?, '', ?, ?, ?)
                """,
                (email_n, is_owner, time.time(), sub),
            )
            user_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            conn.commit()
        except sqlite3.IntegrityError:
            return 409, {"ok": False, "error": "email_taken"}
    return 200, {"ok": True, "userId": user_id, "email": email_n, "isOwner": bool(is_owner)}


def _send_redirect(
    handler: BaseHTTPRequestHandler, location: str, cookie_token: str | None = None
) -> None:
    handler.send_response(302)
    handler.send_header("Location", location)
    if cookie_token:
        _set_session_cookie(handler, cookie_token)
    handler.end_headers()


def _client_ip(handler: BaseHTTPRequestHandler) -> str:
    addr = handler.client_address[0] if handler.client_address else None
    return client_ip_from_headers(handler.headers.get("X-Forwarded-For"), addr)


def _invalidate_user_sessions(user_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        conn.commit()


def forgot_password(email: str, handler: BaseHTTPRequestHandler) -> tuple[int, dict[str, Any]]:
    init_db()
    email_n = _normalize_email(email)
    if not EMAIL_RE.match(email_n):
        return 400, {"ok": False, "error": "invalid_email"}
    ip = _client_ip(handler)
    if not ip_rate_allowed(ip):
        return 429, {"ok": False, "error": "rate_limited"}
    record_ip_attempt(ip)
    now = time.time()
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, password_hash FROM users WHERE email = ?",
            (email_n,),
        ).fetchone()
        if row and (row["password_hash"] or "").strip():
            user_id = row["id"]
            rows = conn.execute(
                "SELECT created_at FROM password_reset_tokens WHERE user_id = ? AND created_at > ?",
                (user_id, now - RESET_RATE_WINDOW_SEC),
            ).fetchall()
            timestamps = [float(r["created_at"]) for r in rows]
            if not within_rate_limit(timestamps, now):
                return 429, {"ok": False, "error": "rate_limited"}
            raw_token, token_hash = new_reset_token()
            conn.execute(
                "DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL",
                (user_id,),
            )
            conn.execute(
                """
                INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (token_hash, user_id, token_expires_at(now), now),
            )
            conn.commit()
            reset_url = f"{_public_site_base()}/reset-password.html?token={raw_token}"
            if not send_password_reset(to_email=email_n, reset_url=reset_url, site_name="Halalit"):
                print(
                    "Halalit password reset: email not sent — set ODDTROVE_SMTP_* in halalit-server/.env",
                    file=sys.stderr,
                    flush=True,
                )
    return 200, {"ok": True, "message": "reset_email_sent"}


def reset_password(token: str, password: str) -> tuple[int, dict[str, Any]]:
    init_db()
    if len(password) < 8:
        return 400, {"ok": False, "error": "password_too_short"}
    token_hash = hash_token(token)
    now = time.time()
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT t.user_id, t.expires_at, t.used_at, u.email, u.is_owner
            FROM password_reset_tokens t
            JOIN users u ON u.id = t.user_id
            WHERE t.token_hash = ?
            """,
            (token_hash,),
        ).fetchone()
        if not row or row["used_at"] is not None:
            return 400, {"ok": False, "error": "reset_token_invalid"}
        if float(row["expires_at"]) < now:
            return 400, {"ok": False, "error": "reset_token_expired"}
        user_id = row["user_id"]
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (_hash_password(password), user_id),
        )
        conn.execute(
            "UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?",
            (now, token_hash),
        )
        conn.commit()
    _invalidate_user_sessions(user_id)
    return 200, {
        "ok": True,
        "email": row["email"],
        "isOwner": bool(row["is_owner"]),
        "userId": user_id,
    }


def get_all_user_data(user_id: int) -> dict[str, str]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT data_key, data_value FROM user_data WHERE user_id = ?",
            (user_id,),
        ).fetchall()
    return {r["data_key"]: r["data_value"] for r in rows}


def set_user_data_key(user_id: int, key: str, value: str) -> tuple[int, dict[str, Any]]:
    if key not in KNOWN_DATA_KEYS:
        return 400, {"ok": False, "error": "unknown_key"}
    if value == "":
        with _connect() as conn:
            conn.execute(
                "DELETE FROM user_data WHERE user_id = ? AND data_key = ?",
                (user_id, key),
            )
            conn.commit()
        return 200, {"ok": True}
    if len(value.encode("utf-8")) > MAX_VALUE_BYTES:
        return 413, {"ok": False, "error": "value_too_large"}
    now = time.time()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO user_data (user_id, data_key, data_value, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, data_key) DO UPDATE SET
                data_value = excluded.data_value,
                updated_at = excluded.updated_at
            """,
            (user_id, key, value, now),
        )
        conn.commit()
    _maybe_log_feedback(user_id, key, value)
    return 200, {"ok": True}


def merge_user_data(user_id: int, data: dict[str, str]) -> tuple[int, dict[str, Any]]:
    merged_keys: list[str] = []
    skipped: list[dict[str, str]] = []
    for key, value in data.items():
        if key not in KNOWN_DATA_KEYS:
            skipped.append({"key": key, "reason": "unknown_key"})
            continue
        if not isinstance(value, str):
            value = json.dumps(value)
        if len(value.encode("utf-8")) > MAX_VALUE_BYTES:
            skipped.append({"key": key, "reason": "too_large"})
            continue
        status, _ = set_user_data_key(user_id, key, value)
        if status == 200:
            merged_keys.append(key)
    return 200, {"ok": True, "merged": len(merged_keys), "mergedKeys": merged_keys, "skipped": skipped}


def log_reader_message(user_id: int | None, source: str, message: str, meta: dict[str, Any]) -> None:
    source = str(source or "unknown").strip()[:40]
    message = str(message or "").strip()[:4000]
    if not message and source != "bookquest":
        return
    if source == "bookquest" and not meta.get("rating") and not message:
        return
    now = time.time()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO owner_reader_messages (user_id, source, message, meta, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, source, message, json.dumps(meta or {}), now),
        )
        conn.commit()


def owner_reader_messages(limit: int = 60) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, source, message, meta, created_at FROM owner_reader_messages
            ORDER BY created_at DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
    out = []
    for r in rows:
        try:
            meta = json.loads(r["meta"])
        except json.JSONDecodeError:
            meta = {}
        out.append(
            {
                "id": r["id"],
                "source": r["source"],
                "message": r["message"],
                "meta": meta,
                "createdAt": r["created_at"],
            }
        )
    return out


def owner_feedback_list(limit: int = 50) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, payload, created_at FROM owner_feedback
            ORDER BY created_at DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
    out = []
    for r in rows:
        try:
            payload = json.loads(r["payload"])
        except json.JSONDecodeError:
            payload = r["payload"]
        out.append({"id": r["id"], "items": payload, "createdAt": r["created_at"]})
    return out


def _get_site_flags() -> dict[str, bool]:
    flags = dict(DEFAULT_SITE_FLAGS)
    with _connect() as conn:
        rows = conn.execute("SELECT setting_key, setting_value FROM owner_settings").fetchall()
    for r in rows:
        key = r["setting_key"]
        if key in SITE_FLAG_KEYS:
            flags[key] = r["setting_value"].lower() in ("1", "true", "yes", "on")
    return flags


def _set_site_flags(updates: dict[str, Any]) -> dict[str, bool]:
    now = time.time()
    with _connect() as conn:
        for key, val in updates.items():
            if key not in SITE_FLAG_KEYS:
                continue
            stored = "1" if bool(val) else "0"
            conn.execute(
                """
                INSERT INTO owner_settings (setting_key, setting_value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(setting_key) DO UPDATE SET
                    setting_value = excluded.setting_value,
                    updated_at = excluded.updated_at
                """,
                (key, stored, now),
            )
        conn.commit()
    return _get_site_flags()


def owner_user_list(limit: int = 200) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT email, is_owner, created_at FROM users
            ORDER BY created_at DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [
        {
            "email": r["email"],
            "isOwner": bool(r["is_owner"]),
            "createdAt": r["created_at"],
        }
        for r in rows
    ]


def log_scanner_alert(title: str, author: str, phase: str) -> None:
    title = str(title or "").strip()[:300]
    author = str(author or "").strip()[:200]
    phase = str(phase or "cover_read").strip()[:40]
    if not title:
        return
    now = time.time()
    with _connect() as conn:
        recent = conn.execute(
            """
            SELECT id FROM owner_scanner_alerts
            WHERE title = ? AND author = ? AND phase = ? AND created_at > ?
            LIMIT 1
            """,
            (title, author, phase, now - 86400),
        ).fetchone()
        if recent:
            return
        conn.execute(
            """
            INSERT INTO owner_scanner_alerts (title, author, phase, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (title, author, phase, now),
        )
        conn.commit()


def owner_scanner_alerts(limit: int = 40) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, title, author, phase, created_at FROM owner_scanner_alerts
            ORDER BY created_at DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "author": r["author"],
            "phase": r["phase"],
            "createdAt": r["created_at"],
        }
        for r in rows
    ]


def _lookup_row_usable(row: dict[str, Any]) -> bool:
    title = str(row.get("title") or "").strip()
    author = str(row.get("author") or "").strip()
    return not is_garbage_lookup(title, author)


def owner_stats(log_path: str, *, exclude_account_id: int | None = None) -> dict[str, int]:
    with _connect() as conn:
        users = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        feedback = conn.execute("SELECT COUNT(*) AS c FROM owner_feedback").fetchone()["c"]
        scanner = conn.execute("SELECT COUNT(*) AS c FROM owner_scanner_alerts").fetchone()["c"]
        messages = conn.execute("SELECT COUNT(*) AS c FROM owner_reader_messages").fetchone()["c"]
        vets = conn.execute("SELECT COUNT(*) AS c FROM owner_vet_entries").fetchone()["c"]
    agg = owner_lookup_aggregated(log_path, limit=500, exclude_account_id=exclude_account_id)
    return {
        "readerAccounts": int(users),
        "feedbackBatches": int(feedback),
        "uniqueLookups": len(agg),
        "scannerAlerts": int(scanner),
        "readerMessages": int(messages),
        "onSiteVets": int(vets),
    }


def _split_owner_vet_lists(
    entries: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    vetted: list[dict[str, Any]] = []
    discretion: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    for entry in entries:
        tier = entry.get("tier")
        if tier == "verified_clean":
            vetted.append(entry)
        elif tier == "user_discretion":
            discretion.append(entry)
        else:
            rejected.append(entry)
    return vetted, discretion, rejected


def _dismiss_states() -> dict[str, dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT notif_key, state, kind, title, author, preview, snapshot_json, created_at, updated_at
            FROM owner_notification_dismissals
            """
        ).fetchall()
    out: dict[str, dict[str, Any]] = {}
    for r in rows:
        try:
            snap = json.loads(r["snapshot_json"] or "{}")
        except json.JSONDecodeError:
            snap = {}
        out[str(r["notif_key"])] = {
            "key": r["notif_key"],
            "state": r["state"],
            "kind": r["kind"] or "",
            "title": r["title"] or "",
            "author": r["author"] or "",
            "preview": r["preview"] or "",
            "snapshot": snap if isinstance(snap, dict) else {},
            "createdAt": r["created_at"],
            "updatedAt": r["updated_at"],
        }
    return out


def owner_dismiss_notification(
    notif_key: str,
    *,
    forever: bool = False,
    kind: str = "",
    title: str = "",
    author: str = "",
    preview: str = "",
    snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    key = str(notif_key or "").strip()[:240]
    if not key:
        return {"ok": False, "error": "key_required"}
    state = "forever" if forever else "trash"
    now = time.time()
    snap = snapshot if isinstance(snapshot, dict) else {}
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO owner_notification_dismissals
                (notif_key, state, kind, title, author, preview, snapshot_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(notif_key) DO UPDATE SET
                state = excluded.state,
                kind = CASE WHEN excluded.kind != '' THEN excluded.kind ELSE owner_notification_dismissals.kind END,
                title = CASE WHEN excluded.title != '' THEN excluded.title ELSE owner_notification_dismissals.title END,
                author = CASE WHEN excluded.author != '' THEN excluded.author ELSE owner_notification_dismissals.author END,
                preview = CASE WHEN excluded.preview != '' THEN excluded.preview ELSE owner_notification_dismissals.preview END,
                snapshot_json = CASE
                    WHEN excluded.snapshot_json != '{}' THEN excluded.snapshot_json
                    ELSE owner_notification_dismissals.snapshot_json
                END,
                updated_at = excluded.updated_at
            """,
            (
                key,
                state,
                str(kind or "")[:60],
                str(title or "")[:300],
                str(author or "")[:200],
                str(preview or "")[:400],
                json.dumps(snap, ensure_ascii=False)[:8000],
                now,
                now,
            ),
        )
        conn.commit()
    return {"ok": True, "key": key, "state": state}


def owner_restore_notification(notif_key: str) -> dict[str, Any]:
    key = str(notif_key or "").strip()[:240]
    if not key:
        return {"ok": False, "error": "key_required"}
    with _connect() as conn:
        row = conn.execute(
            "SELECT state FROM owner_notification_dismissals WHERE notif_key = ?",
            (key,),
        ).fetchone()
        if not row:
            return {"ok": False, "error": "not_found"}
        if str(row["state"]) == "forever":
            return {"ok": False, "error": "dismissed_forever"}
        conn.execute("DELETE FROM owner_notification_dismissals WHERE notif_key = ?", (key,))
        conn.commit()
    return {"ok": True, "key": key}


def _filter_dismissed(
    items: list[dict[str, Any]],
    dismiss: dict[str, dict[str, Any]],
    key_fn,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in items:
        key = key_fn(item)
        if not key:
            out.append(item)
            continue
        state = (dismiss.get(key) or {}).get("state")
        if state in ("trash", "forever"):
            continue
        item = dict(item)
        item["notifKey"] = key
        out.append(item)
    return out


def owner_office_payload(log_path: str, owner_user_id: int | None = None) -> dict[str, Any]:
    on_site = owner_vet_list_all(200)
    vetted, discretion, rejected = _split_owner_vet_lists(on_site)
    library_pending: list[dict[str, Any]] = []
    library_auto_adds: list[dict[str, Any]] = []
    try:
        from library_place_suggest import owner_pending_list, owner_recent_auto_adds

        library_pending = owner_pending_list(60)
        library_auto_adds = owner_recent_auto_adds(40)
    except Exception as e:
        sys.stderr.write("owner_office library lists failed: %s\n" % (e,))

    popular_raw = owner_lookup_aggregated(log_path, 50, exclude_account_id=owner_user_id)
    recent_raw = owner_lookup_recent(log_path, 30, exclude_account_id=owner_user_id)
    try:
        from owner_lookup_signals import attach_signals_to_lookups, list_missing_signal_titles

        popular = attach_signals_to_lookups(popular_raw)
        recent = attach_signals_to_lookups(recent_raw)
        missing_signals = list_missing_signal_titles(popular + recent, limit=12)
    except Exception as e:
        sys.stderr.write("owner_lookup_signals attach failed: %s\n" % (e,))
        popular = popular_raw
        recent = recent_raw
        missing_signals = []

    dismiss = _dismiss_states()
    feedback = _filter_dismissed(
        owner_feedback_list(60),
        dismiss,
        lambda r: "feedback:%s" % r.get("id"),
    )
    reader_messages = _filter_dismissed(
        owner_reader_messages(60),
        dismiss,
        lambda r: "message:%s" % r.get("id"),
    )
    scanner = _filter_dismissed(
        owner_scanner_alerts(40),
        dismiss,
        lambda r: "scanner:%s" % r.get("id"),
    )
    library_pending = _filter_dismissed(
        library_pending,
        dismiss,
        lambda r: "library_pending:%s" % r.get("id"),
    )
    library_auto_adds = _filter_dismissed(
        library_auto_adds,
        dismiss,
        lambda r: "library_auto:%s" % (r.get("id") or r.get("placeId") or ""),
    )
    popular = _filter_dismissed(
        popular,
        dismiss,
        lambda r: "lookup:%s" % (r.get("groupKey") or lookup_group_key(r.get("title") or "", r.get("author") or "")),
    )
    recent = _filter_dismissed(
        recent,
        dismiss,
        lambda r: "lookup:%s" % (r.get("groupKey") or lookup_group_key(r.get("title") or "", r.get("author") or "")),
    )

    bookchecks = [r for r in popular if r.get("bucket") == "bookcheck"]
    my_tbr = [r for r in popular if r.get("bucket") != "bookcheck"]

    trash = [d for d in dismiss.values() if d.get("state") == "trash"]
    trash.sort(key=lambda d: float(d.get("updatedAt") or 0), reverse=True)

    return {
        "stats": owner_stats(log_path, exclude_account_id=owner_user_id),
        "feedback": feedback,
        "recentLookups": recent,
        "popularLookups": popular,
        "bookcheckLookups": bookchecks,
        "myTbrLookups": my_tbr,
        "missingSignalCount": len(missing_signals),
        "ownerScans": owner_lookup_for_account(log_path, owner_user_id, 60),
        "ownerVetVetted": vetted,
        "ownerVetDiscretion": discretion,
        "ownerVetRejected": rejected,
        "scannerAlerts": scanner,
        "readerMessages": reader_messages,
        "libraryPending": library_pending,
        "libraryAutoAdds": library_auto_adds,
        "dismissedNotifications": trash[:80],
        "accounts": owner_user_list(),
        "settings": _get_site_flags(),
        "onSiteVets": on_site[:80],
        "ownerScannedTbr": owner_scanned_tbr_list(300),
    }


def owner_lookup_tail(log_path: str, limit: int = 40) -> list[dict[str, Any]]:
    return owner_lookup_recent(log_path, limit)


def owner_scanned_tbr_list(limit: int = 300) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, title, author, source, created_at
            FROM owner_scanned_tbr
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (max(1, min(int(limit or 300), 500)),),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "author": r["author"] or "",
            "source": r["source"] or "shelf",
            "createdAt": r["created_at"],
        }
        for r in rows
    ]


def owner_scanned_tbr_keys() -> set[str]:
    with _connect() as conn:
        rows = conn.execute("SELECT title_norm, author_norm FROM owner_scanned_tbr").fetchall()
    return {("%s|%s" % (r["title_norm"], r["author_norm"])) for r in rows}


def add_owner_scanned_tbr(
    books: list[dict[str, Any]],
    *,
    source: str = "shelf",
) -> dict[str, Any]:
    source = str(source or "shelf").strip()[:40] or "shelf"
    if source not in ("shelf", "scroll", "manual"):
        source = "shelf"
    added: list[dict[str, Any]] = []
    skipped = 0
    now = time.time()
    with _connect() as conn:
        for item in books or []:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()[:300]
            if not title:
                continue
            author = str(item.get("author") or "").strip()[:200]
            title_norm = _vet_norm(title)
            author_norm = _vet_norm(author)
            try:
                conn.execute(
                    """
                    INSERT INTO owner_scanned_tbr
                      (title, author, title_norm, author_norm, source, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (title, author, title_norm, author_norm, source, now),
                )
                row_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
                added.append(
                    {
                        "id": row_id,
                        "title": title,
                        "author": author,
                        "source": source,
                        "createdAt": now,
                    }
                )
            except sqlite3.IntegrityError:
                skipped += 1
        conn.commit()
    return {"ok": True, "added": added, "addedCount": len(added), "skippedDuplicates": skipped}


def delete_owner_scanned_tbr(entry_id: int) -> dict[str, Any]:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM owner_scanned_tbr WHERE id = ?", (entry_id,))
        conn.commit()
        if cur.rowcount < 1:
            return {"ok": False, "error": "not_found"}
    return {"ok": True, "id": entry_id}


def _vet_norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def _vet_row_to_public(row: sqlite3.Row) -> dict[str, Any]:
    try:
        flags = json.loads(row["flags_json"])
    except json.JSONDecodeError:
        flags = {}
    if not isinstance(flags, dict):
        flags = {}
    clean_flags = {k: bool(flags[k]) for k in OWNER_VET_FLAG_KEYS if flags.get(k)}
    return {
        "id": row["id"],
        "title": row["title"],
        "author": row["author"],
        "tier": row["tier"],
        "ageBand": row["age_band"] or None,
        "detail": row["detail"],
        "flags": clean_flags,
        "updatedAt": row["updated_at"],
    }


def owner_vet_list_public() -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, title, author, tier, age_band, detail, flags_json, updated_at
            FROM owner_vet_entries
            ORDER BY updated_at DESC
            """
        ).fetchall()
    return [_vet_row_to_public(r) for r in rows]


def owner_vet_list_all(limit: int = 200) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, title, author, tier, age_band, detail, flags_json, created_at, updated_at
            FROM owner_vet_entries
            ORDER BY updated_at DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
    out = []
    for r in rows:
        item = _vet_row_to_public(r)
        item["createdAt"] = r["created_at"]
        out.append(item)
    return out


MAX_OWNER_VET_SERIES_BATCH = 50


def _parse_owner_vet_fields(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    tier = str(body.get("tier") or "").strip()
    if tier not in OWNER_VET_TIERS:
        return 400, {"ok": False, "error": "invalid_tier"}
    age_band = str(body.get("ageBand") or body.get("age_band") or "").strip()
    if tier == "verified_clean":
        if age_band and age_band not in OWNER_VET_AGE_BANDS:
            return 400, {"ok": False, "error": "invalid_age_band"}
    else:
        age_band = ""
    detail = str(body.get("detail") or "").strip()[:4000]
    if not detail:
        if tier == "verified_clean":
            detail = "Hand-vetted on site by the owner."
        elif tier == "user_discretion":
            detail = (
                "Owner marked reader discretion—some content to weigh yourself. "
                "Not fanservice, LGBTQ, or adult-romance auto-reject."
            )
        else:
            detail = "Hand-rejected on site by the owner."
    flags_in = body.get("flags") if isinstance(body.get("flags"), dict) else {}
    flags: dict[str, bool] = {}
    for k in OWNER_VET_FLAG_KEYS:
        if flags_in.get(k):
            flags[k] = True
    if tier in ("flag_review", "parked", "no_recommend_fanservice"):
        flags["excludesBookQuest"] = True
    return 200, {
        "tier": tier,
        "age_band": age_band,
        "detail": detail,
        "flags": flags,
        "flags_json": json.dumps(flags),
    }


def _upsert_owner_vet_row(
    conn: sqlite3.Connection,
    *,
    title: str,
    author: str,
    tier: str,
    age_band: str,
    detail: str,
    flags_json: str,
    now: float,
) -> sqlite3.Row | None:
    title_norm = _vet_norm(title)
    author_norm = _vet_norm(author)
    conn.execute(
        """
        INSERT INTO owner_vet_entries (
            title, author, title_norm, author_norm, tier, age_band, detail, flags_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(title_norm, author_norm) DO UPDATE SET
            title = excluded.title,
            author = excluded.author,
            tier = excluded.tier,
            age_band = excluded.age_band,
            detail = excluded.detail,
            flags_json = excluded.flags_json,
            updated_at = excluded.updated_at
        """,
        (title, author, title_norm, author_norm, tier, age_band or None, detail, flags_json, now, now),
    )
    return conn.execute(
        """
        SELECT id, title, author, tier, age_band, detail, flags_json, created_at, updated_at
        FROM owner_vet_entries WHERE title_norm = ? AND author_norm = ?
        """,
        (title_norm, author_norm),
    ).fetchone()


def upsert_owner_vet(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    title = str(body.get("title") or "").strip()[:300]
    author = str(body.get("author") or "").strip()[:200]
    if not title:
        return 400, {"ok": False, "error": "title_required"}
    status, fields = _parse_owner_vet_fields(body)
    if status != 200:
        return status, fields
    now = time.time()
    with _connect() as conn:
        row = _upsert_owner_vet_row(
            conn,
            title=title,
            author=author,
            tier=fields["tier"],
            age_band=fields["age_band"],
            detail=fields["detail"],
            flags_json=fields["flags_json"],
            now=now,
        )
        conn.commit()
    if not row:
        return 500, {"ok": False, "error": "save_failed"}
    item = _vet_row_to_public(row)
    item["createdAt"] = row["created_at"]
    return 200, {"ok": True, "entry": item}


def upsert_owner_vet_series(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    books_in = body.get("books")
    if not isinstance(books_in, list) or not books_in:
        return 400, {"ok": False, "error": "books_required"}
    if len(books_in) > MAX_OWNER_VET_SERIES_BATCH:
        return 400, {"ok": False, "error": "too_many_books"}
    status, fields = _parse_owner_vet_fields(body)
    if status != 200:
        return status, fields
    series_label = str(body.get("seriesLabel") or body.get("series") or "").strip()[:200]
    saved: list[dict[str, Any]] = []
    now = time.time()
    with _connect() as conn:
        for raw in books_in:
            if not isinstance(raw, dict):
                continue
            title = str(raw.get("title") or "").strip()[:300]
            author = str(raw.get("author") or "").strip()[:200]
            if not title:
                continue
            row = _upsert_owner_vet_row(
                conn,
                title=title,
                author=author,
                tier=fields["tier"],
                age_band=fields["age_band"],
                detail=fields["detail"],
                flags_json=fields["flags_json"],
                now=now,
            )
            if row:
                item = _vet_row_to_public(row)
                item["createdAt"] = row["created_at"]
                saved.append(item)
        conn.commit()
    if not saved:
        return 400, {"ok": False, "error": "no_titles_saved"}
    return 200, {
        "ok": True,
        "count": len(saved),
        "seriesLabel": series_label,
        "entries": saved,
    }


def delete_owner_vet(entry_id: int) -> tuple[int, dict[str, Any]]:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM owner_vet_entries WHERE id = ?", (entry_id,))
        conn.commit()
        if cur.rowcount < 1:
            return 404, {"ok": False, "error": "not_found"}
    return 200, {"ok": True}


def cors_headers(handler: BaseHTTPRequestHandler) -> None:
    origin = handler.headers.get("Origin") or ""
    if origin:
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Access-Control-Allow-Credentials", "true")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Vary", "Origin")


def _write_json_body(handler: BaseHTTPRequestHandler, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _owner_user_id() -> int | None:
    try:
        with _connect() as conn:
            row = conn.execute("SELECT id FROM users WHERE is_owner = 1 ORDER BY id LIMIT 1").fetchone()
    except sqlite3.Error:
        return None
    if not row:
        return None
    return int(row["id"])


def handle_get(path: str, handler: BaseHTTPRequestHandler, json_response) -> bool:
    if path == "/api/auth/google/start":
        if not google_configured():
            json_response(handler, 503, {"ok": False, "error": "google_not_configured"})
            return True
        qs = parse_qs(urlparse(handler.path).query)
        return_raw = str((qs.get("return") or [""])[0]).strip()
        state = make_state(return_raw)
        _send_redirect(
            handler,
            authorize_url(redirect_uri=_google_redirect_uri(), state=state),
        )
        return True

    if path == "/api/auth/google/callback":
        qs = parse_qs(urlparse(handler.path).query)
        err = str((qs.get("error") or [""])[0]).strip()
        code = str((qs.get("code") or [""])[0]).strip()
        state = str((qs.get("state") or [""])[0]).strip()
        return_path = parse_state(state)
        dest = _safe_return_url(return_path if return_path is not None else "./account.html")
        fail_url = f"{_public_site_base()}/account.html?google_error=1"
        if err or not code or return_path is None:
            _send_redirect(handler, fail_url)
            return True
        profile = exchange_code(code=code, redirect_uri=_google_redirect_uri())
        if not profile:
            _send_redirect(handler, fail_url)
            return True
        status, payload = google_find_or_create(profile["sub"], profile["email"])
        if status != 200 or not payload.get("ok") or not payload.get("userId"):
            err_code = str(payload.get("error") or "google_auth_failed")
            _send_redirect(
                handler,
                f"{_public_site_base()}/account.html?google_error={quote(err_code)}",
            )
            return True
        token = _create_session(int(payload["userId"]))
        ret = return_path if return_path else "./index.html"
        done_url = (
            f"{_public_site_base()}/account.html?google=1&return={quote(ret, safe='')}"
        )
        _send_redirect(handler, done_url, cookie_token=token)
        return True

    if path == "/api/auth/me":
        user = _session_user(handler)
        if not user:
            json_response(handler, 200, {"ok": True, "signedIn": False})
            return True
        json_response(handler, 200, {"ok": True, **_user_public(user)})
        return True

    if path == "/api/user/data":
        user = _session_user(handler)
        if not user:
            json_response(handler, 401, {"ok": False, "error": "not_signed_in"})
            return True
        json_response(handler, 200, {"ok": True, "data": get_all_user_data(user["id"])})
        return True

    if path == "/api/site/flags":
        json_response(handler, 200, {"ok": True, "flags": _get_site_flags()})
        return True

    if path == "/api/vets/public":
        json_response(handler, 200, {"ok": True, "entries": owner_vet_list_public()})
        return True

    if path == "/api/lookup/owner-review-pending":
        qs = parse_qs(urlparse(handler.path).query)
        title = str((qs.get("title") or [""])[0]).strip()[:300]
        author = str((qs.get("author") or [""])[0]).strip()[:200]
        log_path = os.environ.get("HALALIT_LOOKUP_LOG", "")
        roster_path = os.environ.get(
            "HALALIT_HAND_VET_ROSTER",
            os.path.expanduser("~/kids-sites/halalit/halalit-hand-vet-roster.json"),
        )
        owner_id = _owner_user_id()
        kind = owner_review_pending_kind(
            log_path,
            title,
            author,
            roster_path=roster_path,
            exclude_account_id=owner_id,
        )
        json_response(handler, 200, {"ok": True, "pending": kind is not None, "kind": kind})
        return True

    if path in ("/api/owner/inbox", "/api/owner/office"):
        user = _session_user(handler)
        if not user or not user["is_owner"]:
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        log_path = os.environ.get("HALALIT_LOOKUP_LOG", "")
        if path == "/api/owner/inbox":
            json_response(
                handler,
                200,
                {
                    "ok": True,
                    "feedback": owner_feedback_list(),
                    "lookups": owner_lookup_tail(log_path),
                },
            )
            return True
        json_response(handler, 200, {"ok": True, **owner_office_payload(log_path, user["id"])})
        return True

    if path == "/api/library/places":
        try:
            from library_place_suggest import init_library_place_tables, public_place_list

            init_library_place_tables()
            places = public_place_list()
        except Exception:
            from library_catalog_check import list_places

            places = list_places()
        json_response(handler, 200, {"ok": True, "places": places})
        return True

    if path == "/api/library/my-pending":
        user = _session_user(handler)
        if not user:
            json_response(handler, 401, {"ok": False, "error": "not_signed_in"})
            return True
        try:
            from library_place_suggest import pending_for_user

            pending = pending_for_user(user["id"])
        except Exception:
            pending = []
        json_response(handler, 200, {"ok": True, "pending": pending})
        return True

    return False


def handle_post(
    path: str,
    handler: BaseHTTPRequestHandler,
    body: dict[str, Any],
    json_response,
) -> bool:
    if path == "/api/feedback/submit":
        user = _session_user(handler)
        if not user:
            json_response(handler, 401, {"ok": False, "error": "not_signed_in"})
            return True
        source = str(body.get("source") or "").strip()[:40]
        message = str(body.get("message") or "").strip()[:4000]
        meta = body.get("meta") if isinstance(body.get("meta"), dict) else {}
        if source not in ("bookcheck", "tips_box", "bookquest", "library_suggest"):
            json_response(handler, 400, {"ok": False, "error": "invalid_source"})
            return True
        if source in ("bookcheck", "tips_box") and not message:
            json_response(handler, 400, {"ok": False, "error": "message_required"})
            return True
        if source == "bookquest" and not message and not meta.get("rating"):
            json_response(handler, 400, {"ok": False, "error": "message_required"})
            return True
        log_reader_message(user["id"], source, message, meta)
        json_response(handler, 200, {"ok": True})
        return True

    if path == "/api/library/suggest":
        user = _session_user(handler)
        catalog_url = str(body.get("catalogUrl") or body.get("url") or "").strip()[:500]
        label = str(body.get("label") or body.get("name") or "").strip()[:200]
        try:
            from library_place_suggest import suggest_library

            result = suggest_library(
                user_id=user["id"] if user else None,
                catalog_url=catalog_url,
                label=label,
            )
        except Exception as e:
            json_response(
                handler,
                502,
                {
                    "ok": False,
                    "outcome": "rejected",
                    "error": "suggest_failed",
                    "reason": type(e).__name__,
                },
            )
            return True
        status = 200 if result.get("ok") else 400
        json_response(handler, status, result)
        return True

    if path == "/api/owner/library/pending/reject":
        user = _session_user(handler)
        if not user or not user["is_owner"]:
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        try:
            pending_id = int(body.get("id") or body.get("pendingId") or 0)
        except (TypeError, ValueError):
            pending_id = 0
        if pending_id <= 0:
            json_response(handler, 400, {"ok": False, "error": "id_required"})
            return True
        try:
            from library_place_suggest import owner_reject_pending

            ok = owner_reject_pending(pending_id)
        except Exception:
            ok = False
        json_response(handler, 200 if ok else 404, {"ok": ok})
        return True

    if path == "/api/owner/library/places/disable":
        user = _session_user(handler)
        if not user or not user["is_owner"]:
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        place_id = str(body.get("placeId") or "").strip()[:80]
        try:
            from library_place_suggest import owner_disable_place

            ok = owner_disable_place(place_id)
        except Exception:
            ok = False
        json_response(handler, 200 if ok else 404, {"ok": ok})
        return True

    if path == "/api/lookup/record":
        user = _session_user(handler)
        log_path = os.environ.get("HALALIT_LOOKUP_LOG", "")
        title = str(body.get("title") or body.get("enteredTitle") or "").strip()[:300]
        author = str(body.get("author") or body.get("enteredAuthor") or "").strip()[:200]
        entered_title = str(body.get("enteredTitle") or title).strip()[:300]
        entered_author = str(body.get("enteredAuthor") if body.get("enteredAuthor") is not None else author).strip()[
            :200
        ]
        if not title or is_garbage_lookup(title, author):
            json_response(handler, 200, {"ok": True, "recorded": False})
            return True
        if body.get("ownerTesting") and user and user.get("is_owner"):
            json_response(handler, 200, {"ok": True, "recorded": False, "skipped": "owner_testing"})
            return True
        if user and user.get("is_owner") and body.get("fromScanner"):
            json_response(handler, 200, {"ok": True, "recorded": False, "skipped": "owner_scanner"})
            return True
        record_bookcheck_lookup(
            log_path,
            title=title,
            author=author,
            entered_title=entered_title,
            entered_author=entered_author,
            account_id=user["id"] if user else None,
        )
        signal_payload = None
        if body.get("summary") or body.get("autoReject") or body.get("themes") or body.get("bucket"):
            try:
                from owner_lookup_signals import upsert_lookup_signal

                themes = body.get("themes") if isinstance(body.get("themes"), list) else []
                signal_payload = upsert_lookup_signal(
                    title,
                    author,
                    summary=str(body.get("summary") or "")[:400],
                    bucket=str(body.get("bucket") or ""),
                    themes=themes,
                    auto_reject=bool(body.get("autoReject")),
                )
            except Exception as e:
                sys.stderr.write("lookup signal upsert failed: %s\n" % (e,))
        json_response(
            handler,
            200,
            {"ok": True, "recorded": True, "signal": signal_payload},
        )
        return True

    if path == "/api/lookup/signal":
        user = _session_user(handler)
        title = str(body.get("title") or "").strip()[:300]
        author = str(body.get("author") or "").strip()[:200]
        if not title or is_garbage_lookup(title, author):
            json_response(handler, 200, {"ok": True, "saved": False})
            return True
        if body.get("ownerTesting") and user and user.get("is_owner"):
            json_response(handler, 200, {"ok": True, "saved": False, "skipped": "owner_testing"})
            return True
        try:
            from owner_lookup_signals import upsert_lookup_signal

            themes = body.get("themes") if isinstance(body.get("themes"), list) else []
            explainers = body.get("explainers") if isinstance(body.get("explainers"), list) else []
            summary = str(body.get("summary") or "").strip()
            if not summary and explainers:
                from owner_lookup_signals import build_owner_summary

                summary = build_owner_summary(
                    themes,
                    auto_reject=bool(body.get("autoReject")),
                    explainers=[str(x) for x in explainers],
                )
            payload = upsert_lookup_signal(
                title,
                author,
                summary=summary,
                bucket=str(body.get("bucket") or ""),
                themes=themes,
                auto_reject=bool(body.get("autoReject")),
            )
        except Exception as e:
            sys.stderr.write("lookup signal failed: %s\n" % (e,))
            payload = {"ok": False, "error": "signal_failed"}
        json_response(handler, 200, {"ok": True, "saved": bool(payload.get("ok")), "signal": payload})
        return True

    if path == "/api/owner/notifications/dismiss":
        user = _session_user(handler)
        if not user or not user["is_owner"]:
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        snap = body.get("snapshot") if isinstance(body.get("snapshot"), dict) else {}
        result = owner_dismiss_notification(
            str(body.get("key") or ""),
            forever=bool(body.get("forever")),
            kind=str(body.get("kind") or ""),
            title=str(body.get("title") or ""),
            author=str(body.get("author") or ""),
            preview=str(body.get("preview") or ""),
            snapshot=snap,
        )
        json_response(handler, 200 if result.get("ok") else 400, result)
        return True

    if path == "/api/owner/notifications/restore":
        user = _session_user(handler)
        if not user or not user["is_owner"]:
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        result = owner_restore_notification(str(body.get("key") or ""))
        json_response(handler, 200 if result.get("ok") else 400, result)
        return True

    if path == "/api/owner/lookups/backfill-signals":
        user = _session_user(handler)
        if not user or not user["is_owner"]:
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        log_path = os.environ.get("HALALIT_LOOKUP_LOG", "")
        limit = int(body.get("limit") or 6)
        if limit < 1:
            limit = 1
        if limit > 12:
            limit = 12
        popular = owner_lookup_aggregated(log_path, 50, exclude_account_id=user["id"])
        recent = owner_lookup_recent(log_path, 30, exclude_account_id=user["id"])
        try:
            from owner_lookup_signals import (
                list_missing_signal_titles,
                signal_from_theme_scan_result,
                upsert_lookup_signal,
            )
            from bookcheck_theme_api import call_theme_scan

            missing = list_missing_signal_titles(popular + recent, limit=limit)
        except Exception as e:
            sys.stderr.write("backfill import failed: %s\n" % (e,))
            json_response(handler, 500, {"ok": False, "error": "backfill_unavailable", "message": str(e)})
            return True

        def _scan_missing_item(item: dict[str, Any]) -> tuple[str, dict[str, Any], Any]:
            """Run full dual theme scan only; DB writes stay on the main thread."""
            try:
                result = call_theme_scan(item["title"], item.get("author") or "", False)
                if result.get("ok"):
                    return ("ok", item, result)
                return ("fail", item, result)
            except Exception as e:
                return ("err", item, e)

        # Same accuracy as Bookcheck; parallelize books so Office clears pending faster.
        workers = min(6, max(1, len(missing)))
        scan_outcomes: list[tuple[str, dict[str, Any], Any]] = []
        if missing:
            with ThreadPoolExecutor(max_workers=workers) as pool:
                futures = [pool.submit(_scan_missing_item, item) for item in missing]
                for fut in as_completed(futures):
                    try:
                        scan_outcomes.append(fut.result())
                    except Exception as e:
                        scan_outcomes.append(("err", {"title": "?"}, e))

        filled = []
        errors = []
        for kind, item, payload in scan_outcomes:
            title = str(item.get("title") or "")
            author = str(item.get("author") or "")
            try:
                if kind == "ok":
                    sig = signal_from_theme_scan_result(title, author, payload)
                    filled.append(
                        {
                            "title": title,
                            "author": author,
                            "bucket": sig.get("bucket"),
                            "summary": sig.get("summary"),
                        }
                    )
                else:
                    # Mark tbr so we don't retry forever on AI failure / exceptions.
                    upsert_lookup_signal(
                        title,
                        author,
                        summary="Scan unavailable — kept on My TBR until a fresh Bookcheck runs.",
                        bucket="tbr",
                        auto_reject=False,
                    )
                    err = payload.get("error") if isinstance(payload, dict) else str(payload)
                    errors.append({"title": title, "error": err or "scan_failed"})
            except Exception as e:
                errors.append({"title": title or item.get("title"), "error": str(e)})
        remaining = []
        try:
            remaining = list_missing_signal_titles(
                owner_lookup_aggregated(log_path, 50, exclude_account_id=user["id"])
                + owner_lookup_recent(log_path, 30, exclude_account_id=user["id"]),
                limit=20,
            )
        except Exception:
            remaining = []
        json_response(
            handler,
            200,
            {
                "ok": True,
                "filled": filled,
                "errors": errors,
                "remaining": len(remaining),
            },
        )
        return True

    if path == "/api/scanner/malfunction-report":
        title = str(body.get("title") or "").strip()[:300]
        author = str(body.get("author") or "").strip()[:200]
        phase = str(body.get("phase") or "cover_read").strip()[:40]
        if not title or not is_garbage_lookup(title, author):
            json_response(handler, 200, {"ok": True, "recorded": False})
            return True
        log_scanner_alert(title, author, phase)
        json_response(handler, 200, {"ok": True, "recorded": True})
        return True

    if path == "/api/auth/signup":
        status, payload = signup(str(body.get("email") or ""), str(body.get("password") or ""))
        if status == 200 and payload.get("ok"):
            token = _create_session(payload["userId"])
            handler.send_response(status)
            cors_headers(handler)
            _set_session_cookie(handler, token)
            _write_json_body(handler, payload)
            return True
        json_response(handler, status, payload)
        return True

    if path == "/api/auth/login":
        status, payload = login(str(body.get("email") or ""), str(body.get("password") or ""))
        if status == 200 and payload.get("ok"):
            with _connect() as conn:
                row = conn.execute(
                    "SELECT id FROM users WHERE email = ?",
                    (_normalize_email(body.get("email") or ""),),
                ).fetchone()
            if row:
                token = _create_session(row["id"])
                handler.send_response(status)
                cors_headers(handler)
                _set_session_cookie(handler, token)
                _write_json_body(handler, payload)
                return True
        json_response(handler, status, payload)
        return True

    if path == "/api/auth/forgot-password":
        status, payload = forgot_password(str(body.get("email") or ""), handler)
        json_response(handler, status, payload)
        return True

    if path == "/api/auth/reset-password":
        status, payload = reset_password(
            str(body.get("token") or ""),
            str(body.get("password") or ""),
        )
        if status == 200 and payload.get("ok") and payload.get("userId"):
            token = _create_session(int(payload["userId"]))
            handler.send_response(status)
            cors_headers(handler)
            _set_session_cookie(handler, token)
            out = {k: v for k, v in payload.items() if k != "userId"}
            _write_json_body(handler, out)
            return True
        json_response(handler, status, payload)
        return True

    if path == "/api/auth/logout":
        _delete_session(handler)
        handler.send_response(200)
        cors_headers(handler)
        _clear_session_cookie(handler)
        _write_json_body(handler, {"ok": True})
        return True

    if path == "/api/owner/settings":
        user = _session_user(handler)
        if not user or not user["is_owner"]:
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        flags_in = body.get("flags")
        if not isinstance(flags_in, dict):
            json_response(handler, 400, {"ok": False, "error": "invalid_flags"})
            return True
        json_response(handler, 200, {"ok": True, "flags": _set_site_flags(flags_in)})
        return True

    if path == "/api/owner/vets/save":
        user = _session_user(handler)
        if not user or not user["is_owner"]:
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        status, payload = upsert_owner_vet(body)
        json_response(handler, status, payload)
        return True

    if path == "/api/owner/vets/save-series":
        user = _session_user(handler)
        if not user or not user["is_owner"]:
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        status, payload = upsert_owner_vet_series(body)
        json_response(handler, status, payload)
        return True

    if path == "/api/owner/vets/delete":
        user = _session_user(handler)
        if not user or not user["is_owner"]:
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        entry_id = body.get("id")
        try:
            eid = int(entry_id)
        except (TypeError, ValueError):
            json_response(handler, 400, {"ok": False, "error": "invalid_id"})
            return True
        status, payload = delete_owner_vet(eid)
        json_response(handler, status, payload)
        return True

    if path == "/api/owner/scanned-tbr/add":
        user = _session_user(handler)
        if not user or not user["is_owner"]:
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        books = body.get("books")
        if not isinstance(books, list):
            one = body.get("title")
            if one:
                books = [{"title": one, "author": body.get("author") or ""}]
            else:
                books = []
        if not books:
            json_response(handler, 400, {"ok": False, "error": "books_required"})
            return True
        result = add_owner_scanned_tbr(books, source=str(body.get("source") or "shelf"))
        json_response(handler, 200, result)
        return True

    if path == "/api/owner/scanned-tbr/delete":
        user = _session_user(handler)
        if not user or not user["is_owner"]:
            json_response(handler, 403, {"ok": False, "error": "owner_only"})
            return True
        try:
            eid = int(body.get("id"))
        except (TypeError, ValueError):
            json_response(handler, 400, {"ok": False, "error": "invalid_id"})
            return True
        result = delete_owner_scanned_tbr(eid)
        json_response(handler, 200 if result.get("ok") else 404, result)
        return True

    user = _session_user(handler)
    if not user:
        if path.startswith("/api/user/") or path.startswith("/api/owner/"):
            json_response(handler, 401, {"ok": False, "error": "not_signed_in"})
            return True

    if path == "/api/user/data/set":
        key = str(body.get("key") or "")
        value = body.get("value")
        if value is None:
            json_response(handler, 400, {"ok": False, "error": "value_required"})
            return True
        if not isinstance(value, str):
            value = json.dumps(value)
        status, payload = set_user_data_key(user["id"], key, value)
        json_response(handler, status, payload)
        return True

    if path == "/api/user/data/bulk":
        data = body.get("data")
        if not isinstance(data, dict):
            json_response(handler, 400, {"ok": False, "error": "invalid_data"})
            return True
        status, payload = merge_user_data(user["id"], data)
        json_response(handler, status, payload)
        return True

    return False


init_db()
