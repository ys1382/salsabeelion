#!/usr/bin/env python3
"""LoreKeeper — per-writer accounts and note storage (isolated from Halalit/Crocheter)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from lorekeeper_recall import recall_from_user_data

PORT = int(os.environ.get("LOREKEEPER_API_PORT", "8080"))
BIND = os.environ.get("LOREKEEPER_API_BIND", "127.0.0.1")
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.environ.get(
    "LOREKEEPER_DATA_PATH",
    os.path.join(_SCRIPT_DIR, "lorekeeper-data", "lorekeeper-store.json"),
)
SECRET_PATH = os.environ.get(
    "LOREKEEPER_SECRET_PATH",
    os.path.join(_SCRIPT_DIR, "lorekeeper-data", "lorekeeper.secret"),
)
OWNER_EMAIL = os.environ.get(
    "ODDTROVE_LOREKEEPER_OWNER_EMAIL", "nightofhonour@gmail.com"
).strip().lower()
COOKIE_NAME = "lorekeeper_session"
COOKIE_MAX_AGE = 60 * 60 * 24 * 30
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_store_lock = threading.Lock()


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


def _load_store() -> dict[str, Any]:
    if not os.path.isfile(DATA_PATH):
        return {"users": {}, "feedback": [], "settings": {"signupsEnabled": False}}
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        return {"users": {}, "feedback": [], "settings": {"signupsEnabled": False}}
    data.setdefault("users", {})
    data.setdefault("feedback", [])
    data.setdefault("settings", {"signupsEnabled": False})
    return data


def _save_store(data: dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(DATA_PATH) or ".", exist_ok=True)
    tmp = DATA_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, sort_keys=True)
        f.write("\n")
    os.replace(tmp, DATA_PATH)
    os.chmod(DATA_PATH, 0o600)


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


def _sign_token(email: str, exp: int) -> str:
    payload = f"{email}|{exp}"
    sig = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
    raw = f"{payload}|{sig}".encode()
    return base64.urlsafe_b64encode(raw).decode()


def _verify_token(token: str) -> str | None:
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        email, exp_s, sig = raw.rsplit("|", 2)
        exp = int(exp_s)
        if exp < int(time.time()):
            return None
        payload = f"{email}|{exp}"
        expect = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expect, sig):
            return None
        return email
    except (ValueError, UnicodeDecodeError):
        return None


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
    parts = [f"Path=/lorekeeper/", f"Max-Age={COOKIE_MAX_AGE}", "HttpOnly", "SameSite=Lax"]
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

    def _json(self, status: int, payload: dict[str, Any], set_cookie: str | None = None, clear_cookie: bool = False) -> None:
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
        self.wfile.write(body)

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

        if path == "/auth/me":
            if not email:
                self._json(200, {"ok": True, "signedIn": False})
                return
            self._json(
                200,
                {
                    "ok": True,
                    "signedIn": True,
                    "email": email,
                    "isOwner": _is_owner_email(email),
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
                settings = store.get("settings") or {}
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
                        "writerAccounts": len(accounts),
                        "readerMessages": len(feedback),
                    },
                    "accounts": accounts,
                    "readerMessages": feedback[-50:],
                    "settings": {
                        "signupsEnabled": bool(settings.get("signupsEnabled")),
                    },
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
                signups_on = bool(settings.get("signupsEnabled"))
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
                    "data": {},
                }
                _save_store(store)
            exp = int(time.time()) + COOKIE_MAX_AGE
            self._json(200, {"ok": True, "email": norm, "isOwner": is_owner}, set_cookie=_sign_token(norm, exp))
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
            self._json(
                200,
                {"ok": True, "email": norm, "isOwner": _is_owner_email(norm)},
                set_cookie=_sign_token(norm, exp),
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
                if "signupsEnabled" in flags:
                    settings["signupsEnabled"] = bool(flags["signupsEnabled"])
                _save_store(store)
            self._json(200, {"ok": True, "settings": settings})
            return

        if path == "/recall/ask":
            if not email:
                self._json(401, {"ok": False, "error": "not_signed_in"})
                return
            question = str(body.get("question") or "").strip()
            if not question:
                self._json(400, {"ok": False, "error": "empty_question"})
                return
            with _store_lock:
                store = _load_store()
                user = store.get("users", {}).get(email)
                if not user:
                    self._json(401, {"ok": False, "error": "not_signed_in"})
                    return
                user_data = dict(user.get("data") or {})
            client_docs = body.get("documents")
            client_entries = body.get("entries")
            result = recall_from_user_data(
                question,
                user_data,
                client_documents=client_docs,
                client_entries=client_entries,
            )
            if not result.get("ok"):
                self._json(400, result)
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
    _secret()
    os.makedirs(os.path.dirname(DATA_PATH) or ".", exist_ok=True)
    server = ThreadingHTTPServer((BIND, PORT), Handler)
    print(f"LoreKeeper API on http://{BIND}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
