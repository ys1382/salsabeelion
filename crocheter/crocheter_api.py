#!/usr/bin/env python3
"""Crocheter — accounts, reader data, owner office, and crochet Ask helper."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import signal
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from crocheter_ask import answer_crochet_question, ask_available

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
for _shared_candidate in (
    os.path.join(os.path.dirname(_SCRIPT_DIR), "_shared"),
    os.path.join(os.path.dirname(os.path.dirname(_SCRIPT_DIR)), "top", "_shared"),
    os.path.expanduser("~/kids-sites/_shared"),
):
    if os.path.isdir(_shared_candidate) and _shared_candidate not in sys.path:
        sys.path.insert(0, _shared_candidate)
        break

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

PORT = int(os.environ.get("CROCHETER_API_PORT", "8076"))
BIND = os.environ.get("CROCHETER_API_BIND", "127.0.0.1")
DATA_PATH = os.environ.get(
    "CROCHETER_DATA_PATH",
    os.path.join(_SCRIPT_DIR, "crocheter-data", "crocheter-store.json"),
)
SECRET_PATH = os.environ.get(
    "CROCHETER_SECRET_PATH",
    os.path.join(_SCRIPT_DIR, "crocheter-data", "crocheter.secret"),
)
OWNER_EMAIL = os.environ.get(
    "ODDTROVE_CROCHETER_OWNER_EMAIL", "nightofhonour@gmail.com"
).strip().lower()
COOKIE_NAME = "crocheter_session"
COOKIE_MAX_AGE = 60 * 60 * 24 * 30
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

DEFAULT_SITE_FLAGS = {
    "patternsEnabled": True,
    "stitchCalculatorEnabled": True,
    "dictionaryEnabled": True,
    "stitchLearningEnabled": True,
    "askHelperEnabled": True,
    "signupsEnabled": True,
}

_store_lock = threading.Lock()
_store_cache: dict[str, Any] | None = None
_store_mtime: float = 0.0


def _site_flags(settings: dict[str, Any] | None) -> dict[str, bool]:
    base = dict(DEFAULT_SITE_FLAGS)
    if isinstance(settings, dict):
        for key in base:
            if key in settings:
                base[key] = bool(settings[key])
    return base


def _load_store() -> dict[str, Any]:
    global _store_cache, _store_mtime
    if not os.path.isfile(DATA_PATH):
        empty = {"users": {}, "feedback": [], "password_resets": {}, "settings": dict(DEFAULT_SITE_FLAGS)}
        _store_cache = empty
        _store_mtime = 0.0
        return empty
    try:
        mtime = os.path.getmtime(DATA_PATH)
    except OSError:
        mtime = 0.0
    if _store_cache is not None and mtime == _store_mtime:
        return _store_cache
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        data = {"users": {}, "feedback": [], "settings": dict(DEFAULT_SITE_FLAGS)}
    data.setdefault("users", {})
    data.setdefault("feedback", [])
    data.setdefault("password_resets", {})
    settings = data.setdefault("settings", {})
    for key, val in DEFAULT_SITE_FLAGS.items():
        settings.setdefault(key, val)
    _store_cache = data
    _store_mtime = mtime
    return data


def _save_store(data: dict[str, Any]) -> None:
    global _store_cache, _store_mtime
    os.makedirs(os.path.dirname(DATA_PATH) or ".", exist_ok=True)
    tmp = DATA_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, sort_keys=True)
        f.write("\n")
    os.replace(tmp, DATA_PATH)
    os.chmod(DATA_PATH, 0o600)
    _store_cache = data
    try:
        _store_mtime = os.path.getmtime(DATA_PATH)
    except OSError:
        _store_mtime = time.time()


def _secret() -> bytes:
    if os.path.isfile(SECRET_PATH):
        with open(SECRET_PATH, "rb") as f:
            return f.read().strip()
    secret = base64.urlsafe_b64encode(os.urandom(32))
    os.makedirs(os.path.dirname(SECRET_PATH) or ".", exist_ok=True)
    with open(SECRET_PATH, "wb") as f:
        f.write(secret)
    os.chmod(SECRET_PATH, 0o600)
    return secret


def _hash_password(password: str, salt: bytes | None = None) -> tuple[str, str]:
    if salt is None:
        salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return base64.b64encode(dk).decode("ascii"), base64.b64encode(salt).decode("ascii")


def _verify_password(password: str, stored_hash: str, stored_salt: str) -> bool:
    try:
        salt = base64.b64decode(stored_salt.encode("ascii"))
        expect, _ = _hash_password(password, salt)
        return hmac.compare_digest(expect, stored_hash)
    except (ValueError, UnicodeDecodeError):
        return False


def _normalize_email(email: str) -> str | None:
    e = email.strip().lower()
    if not EMAIL_RE.match(e):
        return None
    return e


def _sign_token(email: str, exp: int, auth_rev: int = 0) -> str:
    payload = f"{email}|{exp}|{auth_rev}"
    sig = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
    raw = f"{payload}|{sig}".encode()
    return base64.urlsafe_b64encode(raw).decode()


def _verify_token(token: str) -> str | None:
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        parts = raw.split("|")
        if len(parts) < 3:
            return None
        sig = parts[-1]
        email = parts[0]
        exp = int(parts[1])
        if exp < int(time.time()):
            return None
        if len(parts) == 3:
            payload = f"{email}|{exp}"
            expect = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expect, sig):
                return None
            with _store_lock:
                user = (_load_store().get("users") or {}).get(email)
            if not user or int(user.get("auth_rev", 0)) > 0:
                return None
            return email
        auth_rev = int(parts[2])
        payload = f"{email}|{exp}|{auth_rev}"
        expect = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expect, sig):
            return None
        with _store_lock:
            user = (_load_store().get("users") or {}).get(email)
        if not user or int(user.get("auth_rev", 0)) != auth_rev:
            return None
        return email
    except (ValueError, UnicodeDecodeError):
        return None


def _public_site_base() -> str:
    return os.environ.get("CROCHETER_PUBLIC_BASE_URL", "https://oddtrove.art/crocheter").rstrip("/")


def _client_ip(handler: BaseHTTPRequestHandler) -> str:
    addr = handler.client_address[0] if handler.client_address else None
    return client_ip_from_headers(handler.headers.get("X-Forwarded-For"), addr)


def _prune_password_resets(store: dict[str, Any], now: float) -> None:
    resets = store.get("password_resets") or {}
    if not isinstance(resets, dict):
        store["password_resets"] = {}
        return
    expired = [
        key
        for key, row in resets.items()
        if not isinstance(row, dict) or float(row.get("expires_at") or 0) < now
    ]
    for key in expired:
        resets.pop(key, None)


def _password_reset_timestamps(store: dict[str, Any], email: str, now: float) -> list[float]:
    resets = store.get("password_resets") or {}
    out: list[float] = []
    for row in resets.values():
        if isinstance(row, dict) and row.get("email") == email:
            created = float(row.get("created_at") or 0)
            if created >= now - RESET_RATE_WINDOW_SEC:
                out.append(created)
    return out


def _parse_cookies(header: str | None) -> dict[str, str]:
    out: dict[str, str] = {}
    if not header:
        return out
    for part in header.split(";"):
        if "=" in part:
            k, v = part.strip().split("=", 1)
            out[k] = v
    return out


def _is_owner_email(email: str) -> bool:
    if OWNER_EMAIL:
        return email.lower() == OWNER_EMAIL
    with _store_lock:
        users = _load_store().get("users") or {}
    if email in users and users[email].get("is_owner"):
        return True
    return len(users) == 1 and email in users


def _cookie_attrs(handler: BaseHTTPRequestHandler) -> str:
    host = (handler.headers.get("Host") or "").split(":")[0].lower()
    secure = handler.headers.get("X-Forwarded-Proto") == "https" or handler.headers.get("X-Forwarded-Ssl") == "on"
    parts = [f"Path=/crocheter/", f"Max-Age={COOKIE_MAX_AGE}", "HttpOnly", "SameSite=Lax"]
    if host.endswith("oddtrove.art"):
        parts.append("Domain=.oddtrove.art")
    if secure:
        parts.append("Secure")
    return "; ".join(parts)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            return body if isinstance(body, dict) else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}

    def _json(
        self,
        status: int,
        payload: dict[str, Any],
        set_cookie: str | None = None,
        clear_cookie: bool = False,
    ) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        origin = self.headers.get("Origin")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
        if set_cookie:
            self.send_header("Set-Cookie", f"{COOKIE_NAME}={set_cookie}; {_cookie_attrs(self)}")
        if clear_cookie:
            self.send_header("Set-Cookie", f"{COOKIE_NAME}=; {_cookie_attrs(self)}; Max-Age=0")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            return

    def _session_email(self) -> str | None:
        cookies = _parse_cookies(self.headers.get("Cookie"))
        token = cookies.get(COOKIE_NAME)
        if not token:
            return None
        email = _verify_token(token)
        if not email:
            return None
        with _store_lock:
            store = _load_store()
            if email not in store.get("users", {}):
                return None
        return email

    def _api_path(self) -> str:
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            return path[len("/api") :].rstrip("/") or "/"
        return path.rstrip("/")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        origin = self.headers.get("Origin")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        path = self._api_path()
        email = self._session_email()

        if path == "/health":
            self._json(200, {"ok": True, "askAvailable": ask_available()})
            return

        if path == "/auth/me":
            with _store_lock:
                store = _load_store()
                flags = _site_flags(store.get("settings"))
            if not email:
                self._json(200, {"ok": True, "signedIn": False, "siteFlags": flags})
                return
            self._json(
                200,
                {
                    "ok": True,
                    "signedIn": True,
                    "email": email,
                    "isOwner": _is_owner_email(email),
                    "siteFlags": flags,
                },
            )
            return

        if path == "/user/data":
            if not email:
                self._json(401, {"ok": False, "error": "not_signed_in"})
                return
            with _store_lock:
                store = _load_store()
                user = store["users"][email]
                data = dict(user.get("data") or {})
            self._json(200, {"ok": True, "data": data})
            return

        if path == "/owner/office":
            if not email or not _is_owner_email(email):
                self._json(403, {"ok": False, "error": "forbidden"})
                return
            with _store_lock:
                store = _load_store()
                users = store.get("users") or {}
                feedback = store.get("feedback") or []
                settings = _site_flags(store.get("settings"))
            accounts = []
            for u in users.values():
                accounts.append(
                    {
                        "email": u.get("email", ""),
                        "createdAt": u.get("created_at", 0),
                        "isOwner": bool(u.get("is_owner")),
                    }
                )
            accounts.sort(key=lambda r: r.get("createdAt") or 0)
            self._json(
                200,
                {
                    "ok": True,
                    "stats": {
                        "readerAccounts": len(accounts),
                        "readerMessages": len(feedback),
                    },
                    "accounts": accounts,
                    "readerMessages": feedback[-50:],
                    "settings": settings,
                },
            )
            return

        self._json(404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        path = self._api_path()
        body = self._read_json()
        email = self._session_email()

        if path == "/auth/signup":
            raw_email = str(body.get("email") or "")
            password = str(body.get("password") or "")
            norm = _normalize_email(raw_email)
            if not norm:
                self._json(400, {"ok": False, "error": "invalid_email"})
                return
            if len(password) < 8:
                self._json(400, {"ok": False, "error": "password_too_short"})
                return
            with _store_lock:
                store = _load_store()
                users = store.setdefault("users", {})
                settings = store.setdefault("settings", {})
                user_count = len(users)
                if norm in users:
                    self._json(409, {"ok": False, "error": "email_taken"})
                    return
                signups_on = bool(settings.get("signupsEnabled", True))
                if not signups_on and user_count > 0:
                    self._json(403, {"ok": False, "error": "signups_disabled"})
                    return
                pwd_hash, salt = _hash_password(password)
                is_owner = norm == OWNER_EMAIL if OWNER_EMAIL else user_count == 0
                users[norm] = {
                    "email": norm,
                    "password_hash": pwd_hash,
                    "salt": salt,
                    "created_at": int(time.time()),
                    "is_owner": is_owner,
                    "auth_rev": 0,
                    "data": {},
                }
                _save_store(store)
            exp = int(time.time()) + COOKIE_MAX_AGE
            self._json(200, {"ok": True, "email": norm, "isOwner": is_owner}, set_cookie=_sign_token(norm, exp, 0))
            return

        if path == "/auth/forgot-password":
            norm = _normalize_email(str(body.get("email") or ""))
            if not norm:
                self._json(400, {"ok": False, "error": "invalid_email"})
                return
            ip = _client_ip(self)
            if not ip_rate_allowed(ip):
                self._json(429, {"ok": False, "error": "rate_limited"})
                return
            record_ip_attempt(ip)
            now = time.time()
            with _store_lock:
                store = _load_store()
                _prune_password_resets(store, now)
                users = store.get("users") or {}
                if norm in users:
                    if not within_rate_limit(_password_reset_timestamps(store, norm, now), now):
                        self._json(429, {"ok": False, "error": "rate_limited"})
                        return
                    raw_token, token_hash = new_reset_token()
                    store.setdefault("password_resets", {})[token_hash] = {
                        "email": norm,
                        "expires_at": token_expires_at(now),
                        "created_at": now,
                        "used": False,
                    }
                    _save_store(store)
                    reset_url = f"{_public_site_base()}/reset-password.html?token={raw_token}"
                    send_password_reset(to_email=norm, reset_url=reset_url, site_name="Crocheter")
            self._json(200, {"ok": True, "message": "reset_email_sent"})
            return

        if path == "/auth/reset-password":
            token = str(body.get("token") or "")
            password = str(body.get("password") or "")
            if len(password) < 8:
                self._json(400, {"ok": False, "error": "password_too_short"})
                return
            token_hash = hash_token(token)
            now = time.time()
            with _store_lock:
                store = _load_store()
                _prune_password_resets(store, now)
                row = (store.get("password_resets") or {}).get(token_hash)
                if not isinstance(row, dict) or row.get("used"):
                    self._json(400, {"ok": False, "error": "reset_token_invalid"})
                    return
                if float(row.get("expires_at") or 0) < now:
                    self._json(400, {"ok": False, "error": "reset_token_expired"})
                    return
                norm = str(row.get("email") or "")
                user = (store.get("users") or {}).get(norm)
                if not user:
                    self._json(400, {"ok": False, "error": "reset_token_invalid"})
                    return
                pwd_hash, salt = _hash_password(password)
                user["password_hash"] = pwd_hash
                user["salt"] = salt
                user["auth_rev"] = int(user.get("auth_rev", 0)) + 1
                row["used"] = True
                _save_store(store)
                auth_rev = int(user["auth_rev"])
            exp = int(time.time()) + COOKIE_MAX_AGE
            self._json(
                200,
                {"ok": True, "email": norm, "isOwner": _is_owner_email(norm)},
                set_cookie=_sign_token(norm, exp, auth_rev),
            )
            return

        if path == "/auth/login":
            norm = _normalize_email(str(body.get("email") or ""))
            password = str(body.get("password") or "")
            if not norm or not password:
                self._json(400, {"ok": False, "error": "invalid_credentials"})
                return
            with _store_lock:
                store = _load_store()
                user = store.get("users", {}).get(norm)
            if not user or not _verify_password(password, user["password_hash"], user["salt"]):
                self._json(401, {"ok": False, "error": "invalid_credentials"})
                return
            exp = int(time.time()) + COOKIE_MAX_AGE
            auth_rev = int((user or {}).get("auth_rev", 0))
            self._json(
                200,
                {"ok": True, "email": norm, "isOwner": _is_owner_email(norm)},
                set_cookie=_sign_token(norm, exp, auth_rev),
            )
            return

        if path == "/auth/logout":
            self._json(200, {"ok": True}, clear_cookie=True)
            return

        if path == "/user/data/bulk":
            if not email:
                self._json(401, {"ok": False, "error": "not_signed_in"})
                return
            batch = body.get("data")
            if not isinstance(batch, dict):
                self._json(400, {"ok": False, "error": "invalid_data"})
                return
            with _store_lock:
                store = _load_store()
                user = store["users"][email]
                data = user.setdefault("data", {})
                for key, value in batch.items():
                    if not isinstance(key, str):
                        continue
                    if value == "" or value is None:
                        data.pop(key, None)
                    else:
                        data[key] = str(value)
                _save_store(store)
            self._json(200, {"ok": True})
            return

        if path == "/owner/settings":
            if not email or not _is_owner_email(email):
                self._json(403, {"ok": False, "error": "forbidden"})
                return
            flags = body.get("flags")
            if not isinstance(flags, dict):
                self._json(400, {"ok": False, "error": "invalid_flags"})
                return
            with _store_lock:
                store = _load_store()
                settings = store.setdefault("settings", {})
                for key in DEFAULT_SITE_FLAGS:
                    if key in flags:
                        settings[key] = bool(flags[key])
                _save_store(store)
                out = _site_flags(settings)
            self._json(200, {"ok": True, "settings": out})
            return

        if path == "/ask":
            if not email:
                self._json(401, {"ok": False, "error": "not_signed_in"})
                return
            with _store_lock:
                store = _load_store()
                flags = _site_flags(store.get("settings"))
            if not flags.get("askHelperEnabled", True):
                self._json(503, {"ok": False, "error": "ask_disabled"})
                return
            question = str(body.get("question") or "").strip()
            if not question:
                self._json(400, {"ok": False, "error": "empty_question"})
                return
            try:
                result = answer_crochet_question(question)
            except Exception as exc:
                print(f"Crocheter ask failed: {exc}", file=sys.stderr)
                self._json(500, {"ok": False, "error": "ask_failed"})
                return
            if not result.get("ok"):
                code = str(result.get("error") or "ask_failed")
                status = 503 if code == "ask_unavailable" else 400
                self._json(status, result)
                return
            self._json(200, result)
            return

        if path == "/feedback/submit":
            if not email:
                self._json(401, {"ok": False, "error": "not_signed_in"})
                return
            message = str(body.get("message") or "").strip()
            if not message:
                self._json(400, {"ok": False, "error": "empty_message"})
                return
            if len(message) > 4000:
                message = message[:4000]
            source = str(body.get("source") or "tips_box")[:64]
            meta = body.get("meta") if isinstance(body.get("meta"), dict) else {}
            with _store_lock:
                store = _load_store()
                store.setdefault("feedback", []).append(
                    {
                        "email": email,
                        "source": source,
                        "message": message,
                        "meta": meta,
                        "createdAt": int(time.time()),
                    }
                )
                _save_store(store)
            self._json(200, {"ok": True})
            return

        self._json(404, {"ok": False, "error": "not_found"})


def main() -> None:
    try:
        signal.signal(signal.SIGPIPE, signal.SIG_IGN)
    except (AttributeError, ValueError):
        pass
    _secret()
    os.makedirs(os.path.dirname(DATA_PATH) or ".", exist_ok=True)
    server = ThreadingHTTPServer((BIND, PORT), Handler)
    print(f"Crocheter API on http://{BIND}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
