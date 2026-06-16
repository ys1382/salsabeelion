#!/usr/bin/env python3
"""Odd Trove hub — owner session cookie (one sign-in for homepage + owner paths)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

PORT = int(os.environ.get("HUB_OWNER_API_PORT", "8077"))
BIND = os.environ.get("HUB_OWNER_API_BIND", "127.0.0.1")
HTPASSWD = os.environ.get("ODDTROVE_HTPASSWD", "/etc/nginx/oddtrove-owner.htpasswd")
SECRET_PATH = os.environ.get("ODDTROVE_HUB_SECRET", "/etc/nginx/oddtrove-hub.secret")
COOKIE_NAME = "oddtrove_hub_owner"
COOKIE_MAX_AGE = 60 * 60 * 24 * 14  # 14 days


def _secret() -> bytes:
    if os.path.isfile(SECRET_PATH):
        with open(SECRET_PATH, "rb") as f:
            return f.read().strip()
    return b"dev-only-change-me"


def _htpasswd_username(username: str) -> str | None:
    if not os.path.isfile(HTPASSWD):
        return None
    want = username.strip().lower()
    with open(HTPASSWD, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or ":" not in line:
                continue
            user = line.split(":", 1)[0]
            if user.lower() == want:
                return user
    return None


def _check_htpasswd(username: str, password: str) -> bool:
    actual = _htpasswd_username(username)
    if not actual:
        return False
    try:
        proc = subprocess.run(
            ["htpasswd", "-vb", HTPASSWD, actual, password],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        return proc.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def _sign_token(username: str, exp: int) -> str:
    payload = f"{username}|{exp}"
    sig = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
    raw = f"{payload}|{sig}".encode()
    return base64.urlsafe_b64encode(raw).decode()


def _verify_token(token: str) -> str | None:
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        username, exp_s, sig = raw.rsplit("|", 2)
        exp = int(exp_s)
        if exp < int(time.time()):
            return None
        payload = f"{username}|{exp}"
        expect = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expect, sig):
            return None
        return username
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


def _cookie_user(handler: BaseHTTPRequestHandler) -> str | None:
    cookies = _parse_cookies(handler.headers.get("Cookie"))
    token = cookies.get(COOKIE_NAME)
    if not token:
        return None
    return _verify_token(token)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.end_headers()
        self.wfile.write(body)

    def _set_session_cookie(self, username: str) -> None:
        exp = int(time.time()) + COOKIE_MAX_AGE
        token = _sign_token(username, exp)
        self.send_header(
            "Set-Cookie",
            f"{COOKIE_NAME}={token}; Domain=.oddtrove.art; Path=/; Max-Age={COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax",
        )

    def _clear_session_cookie(self) -> None:
        self.send_header(
            "Set-Cookie",
            f"{COOKIE_NAME}=; Domain=.oddtrove.art; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
        )

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path.rstrip("/")
        if path == "/owner-check":
            user = _cookie_user(self)
            if user:
                self.send_response(200)
                self.end_headers()
            else:
                self.send_response(401)
                self.end_headers()
            return
        if path == "/owner-me":
            user = _cookie_user(self)
            if user:
                self._json(200, {"ok": True, "signedIn": True, "username": user})
            else:
                self._json(200, {"ok": True, "signedIn": False})
            return
        self._json(404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path.rstrip("/")
        length = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._json(400, {"ok": False, "error": "invalid_json"})
            return
        if not isinstance(body, dict):
            body = {}

        if path == "/owner-login":
            username = str(body.get("username") or "").strip()
            password = str(body.get("password") or "")
            if not username or not password:
                self._json(400, {"ok": False, "error": "missing_credentials"})
                return
            actual = _htpasswd_username(username)
            if not actual or not _check_htpasswd(username, password):
                self._json(401, {"ok": False, "error": "invalid_credentials"})
                return
            self.send_response(200)
            self._set_session_cookie(actual)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            body_out = json.dumps({"ok": True, "username": username}).encode()
            self.send_header("Content-Length", str(len(body_out)))
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.end_headers()
            self.wfile.write(body_out)
            return

        if path == "/owner-logout":
            self.send_response(200)
            self._clear_session_cookie()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            body_out = json.dumps({"ok": True}).encode()
            self.send_header("Content-Length", str(len(body_out)))
            self.end_headers()
            self.wfile.write(body_out)
            return

        self._json(404, {"ok": False, "error": "not_found"})


def main() -> None:
    if not os.path.isfile(SECRET_PATH):
        secret = base64.urlsafe_b64encode(os.urandom(32))
        with open(SECRET_PATH, "wb") as f:
            f.write(secret)
        os.chmod(SECRET_PATH, 0o600)
    server = ThreadingHTTPServer((BIND, PORT), Handler)
    print(f"Hub owner API on http://{BIND}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
