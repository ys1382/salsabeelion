#!/usr/bin/env python3
"""Odd Trove hub API — owner session + shared Google SSO for public sites."""
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
from urllib.parse import parse_qs, quote, urlparse

from oddtrove_google_oauth import (  # noqa: E402
    authorize_url,
    exchange_code,
    google_configured,
    make_state,
    parse_state,
)
from oddtrove_sso import (  # noqa: E402
    cookie_header_value as sso_cookie_header,
    google_redirect_uri,
    identity_from_cookie_header,
    safe_return_url,
    sign_identity,
)

PORT = int(os.environ.get("HUB_OWNER_API_PORT", "8077"))
BIND = os.environ.get("HUB_OWNER_API_BIND", "127.0.0.1")
HTPASSWD = os.environ.get("ODDTROVE_HTPASSWD", "/etc/nginx/oddtrove-owner.htpasswd")
SECRET_PATH = os.environ.get("ODDTROVE_HUB_SECRET", "/etc/nginx/oddtrove-hub.secret")
COOKIE_NAME = "oddtrove_hub_owner"
COOKIE_MAX_AGE = 60 * 60 * 24 * 14  # 14 days
# Google SSO with this email unlocks private owner paths (same as hub password cookie).
OWNER_EMAIL = (
    os.environ.get("ODDTROVE_OWNER_EMAIL")
    or os.environ.get("HALALIT_OWNER_EMAIL")
    or os.environ.get("ODDTROVE_LOREKEEPER_OWNER_EMAIL")
    or "nightofhonour@gmail.com"
).strip().lower()


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


def _google_owner_email(handler: BaseHTTPRequestHandler) -> str | None:
    """Return owner email if shared Google SSO cookie matches OWNER_EMAIL."""
    if not OWNER_EMAIL:
        return None
    identity = identity_from_cookie_header(handler.headers.get("Cookie"))
    if not identity:
        return None
    email = (identity.get("email") or "").strip().lower()
    if email and email == OWNER_EMAIL:
        return email
    return None


def _owner_session(handler: BaseHTTPRequestHandler) -> dict[str, str] | None:
    """Hub password cookie or Google SSO with the owner email."""
    user = _cookie_user(handler)
    if user:
        return {"username": user, "via": "hub"}
    email = _google_owner_email(handler)
    if email:
        return {"username": email, "via": "google"}
    return None


def _hub_cookie_header(username: str, *, clear: bool = False) -> str:
    if clear:
        return (
            f"{COOKIE_NAME}=; Domain=.oddtrove.art; Path=/; Max-Age=0; "
            "HttpOnly; Secure; SameSite=Lax"
        )
    exp = int(time.time()) + COOKIE_MAX_AGE
    token = _sign_token(username, exp)
    return (
        f"{COOKIE_NAME}={token}; Domain=.oddtrove.art; Path=/; "
        f"Max-Age={COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax"
    )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _cors_headers(self) -> None:
        origin = self.headers.get("Origin")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
        else:
            self.send_header("Access-Control-Allow-Origin", "*")

    def _json(self, status: int, payload: dict[str, Any], extra_cookies: list[str] | None = None) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers()
        for cookie in extra_cookies or []:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(body)

    def _set_session_cookie(self, username: str) -> None:
        self.send_header("Set-Cookie", _hub_cookie_header(username))

    def _clear_session_cookie(self) -> None:
        self.send_header("Set-Cookie", _hub_cookie_header("", clear=True))

    def _redirect(self, location: str, extra_cookies: list[str] | None = None) -> None:
        self.send_response(302)
        self.send_header("Location", location)
        for cookie in extra_cookies or []:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors_headers()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query)

        if path == "/owner-check":
            if _owner_session(self):
                self.send_response(200)
                self.end_headers()
            else:
                self.send_response(401)
                self.end_headers()
            return
        if path == "/owner-me":
            session = _owner_session(self)
            if session:
                self._json(
                    200,
                    {
                        "ok": True,
                        "signedIn": True,
                        "username": session["username"],
                        "via": session["via"],
                    },
                )
            else:
                self._json(200, {"ok": True, "signedIn": False})
            return

        # Shared Odd Trove Google SSO
        if path == "/auth/google/start":
            if not google_configured():
                self._json(503, {"ok": False, "error": "google_not_configured"})
                return
            return_raw = (qs.get("return") or [""])[0]
            state = make_state(return_raw)
            self._redirect(authorize_url(redirect_uri=google_redirect_uri(), state=state))
            return

        if path == "/auth/google/callback":
            from oddtrove_sso import PUBLIC_ORIGIN

            code = (qs.get("code") or [""])[0]
            state = (qs.get("state") or [""])[0]
            err = (qs.get("error") or [""])[0]
            ret = safe_return_url(parse_state(state) if state else None)
            fail_url = f"{PUBLIC_ORIGIN}/halalit/account.html?google_error=google_auth_failed"
            for prefix in ("/halalit/", "/crocheter/", "/lorekeeper/"):
                if prefix in ret:
                    fail_url = f"{PUBLIC_ORIGIN}{prefix}account.html?google_error=google_auth_failed"
                    break
            if err or not code:
                self._redirect(fail_url)
                return
            profile = exchange_code(code=code, redirect_uri=google_redirect_uri())
            if not profile:
                self._redirect(fail_url)
                return
            email = str(profile.get("email") or "").strip().lower()
            token = sign_identity(email, profile["sub"])
            done = ret
            if done.startswith("./"):
                done = safe_return_url("/halalit/" + done[2:])
            sep = "&" if "?" in done else "?"
            if "google=" not in done:
                done = f"{done}{sep}google=1"
            extra = [sso_cookie_header(token, headers=self.headers)]
            # Owner Google email also unlocks private nginx paths.
            if OWNER_EMAIL and email == OWNER_EMAIL:
                extra.append(_hub_cookie_header(email))
            self._redirect(done, extra_cookies=extra)
            return

        if path == "/auth/me":
            identity = identity_from_cookie_header(self.headers.get("Cookie"))
            if identity:
                email = identity["email"]
                self._json(
                    200,
                    {
                        "ok": True,
                        "signedIn": True,
                        "email": email,
                        "googleSub": identity.get("google_sub") or "",
                        "sso": True,
                        "isOwner": bool(OWNER_EMAIL and email == OWNER_EMAIL),
                    },
                )
            else:
                self._json(200, {"ok": True, "signedIn": False, "sso": True, "isOwner": False})
            return

        if path == "/auth/logout":
            identity = identity_from_cookie_header(self.headers.get("Cookie"))
            extra = [sso_cookie_header("", headers=self.headers, clear=True)]
            if identity and OWNER_EMAIL and identity.get("email") == OWNER_EMAIL:
                extra.append(_hub_cookie_header("", clear=True))
            self._json(200, {"ok": True}, extra_cookies=extra)
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
            self._cors_headers()
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

        if path == "/auth/logout":
            identity = identity_from_cookie_header(self.headers.get("Cookie"))
            extra = [sso_cookie_header("", headers=self.headers, clear=True)]
            if identity and OWNER_EMAIL and identity.get("email") == OWNER_EMAIL:
                extra.append(_hub_cookie_header("", clear=True))
            self._json(200, {"ok": True}, extra_cookies=extra)
            return

        self._json(404, {"ok": False, "error": "not_found"})


def main() -> None:
    if not os.path.isfile(SECRET_PATH):
        secret = base64.urlsafe_b64encode(os.urandom(32))
        with open(SECRET_PATH, "wb") as f:
            f.write(secret)
        os.chmod(SECRET_PATH, 0o600)
    server = ThreadingHTTPServer((BIND, PORT), Handler)
    print(f"Hub API (owner + SSO) on http://{BIND}:{PORT}")
    print(f"  Google SSO callback: {google_redirect_uri()}")
    print(f"  Google configured: {google_configured()}")
    print(f"  Owner Google email: {OWNER_EMAIL or '(none)'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
