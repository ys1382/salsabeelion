"""Odd Trove — Google OAuth (authorization code). Stdlib only."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
STATE_TTL_SEC = 600


def google_configured() -> bool:
    return bool(
        (os.environ.get("ODDTROVE_GOOGLE_CLIENT_ID") or "").strip()
        and (os.environ.get("ODDTROVE_GOOGLE_CLIENT_SECRET") or "").strip()
    )


def _client_id() -> str:
    return (os.environ.get("ODDTROVE_GOOGLE_CLIENT_ID") or "").strip()


def _client_secret() -> str:
    return (os.environ.get("ODDTROVE_GOOGLE_CLIENT_SECRET") or "").strip()


def _state_secret() -> bytes:
    raw = (
        os.environ.get("ODDTROVE_GOOGLE_STATE_SECRET")
        or _client_secret()
        or "oddtrove-google-state"
    ).encode("utf-8")
    return hashlib.sha256(raw).digest()


def make_state(return_path: str = "") -> str:
    """Signed opaque state carrying optional post-login return path."""
    path = str(return_path or "").strip()[:500]
    if path and not path.startswith("/") and not path.startswith("./") and not path.startswith("http"):
        path = "./" + path
    exp = int(time.time()) + STATE_TTL_SEC
    payload = f"{exp}|{path}"
    sig = hmac.new(_state_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()[:32]
    raw = f"{payload}|{sig}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def parse_state(state: str) -> str | None:
    """Return return_path if state is valid; None if invalid/expired. Empty string means default."""
    raw = str(state or "").strip()
    if not raw:
        return None
    pad = "=" * (-len(raw) % 4)
    try:
        decoded = base64.urlsafe_b64decode((raw + pad).encode("ascii")).decode("utf-8")
        parts = decoded.split("|", 2)
        if len(parts) != 3:
            return None
        exp_s, path, sig = parts
        expect = hmac.new(
            _state_secret(), f"{exp_s}|{path}".encode("utf-8"), hashlib.sha256
        ).hexdigest()[:32]
        if not hmac.compare_digest(sig, expect):
            return None
        if int(exp_s) < int(time.time()):
            return None
        return path
    except (ValueError, UnicodeDecodeError, TypeError):
        return None


def authorize_url(*, redirect_uri: str, state: str) -> str:
    params = {
        "client_id": _client_id(),
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return GOOGLE_AUTH_URL + "?" + urllib.parse.urlencode(params)


def exchange_code(*, code: str, redirect_uri: str) -> dict[str, str] | None:
    """
    Exchange authorization code for Google profile.
    Returns {"sub": "...", "email": "..."} or None on failure.
    """
    code = str(code or "").strip()
    if not code or not google_configured():
        return None
    body = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": _client_id(),
            "client_secret": _client_secret(),
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        GOOGLE_TOKEN_URL,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            token_payload: dict[str, Any] = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return None
    access = str(token_payload.get("access_token") or "").strip()
    if not access:
        return None
    ureq = urllib.request.Request(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(ureq, timeout=30) as resp:
            info: dict[str, Any] = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return None
    sub = str(info.get("sub") or "").strip()
    email = str(info.get("email") or "").strip().lower()
    if not sub or not email:
        return None
    if info.get("email_verified") is False:
        return None
    return {"sub": sub, "email": email}
