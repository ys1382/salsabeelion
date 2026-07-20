"""Odd Trove — shared reader SSO cookie (one Google login for all public sites)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time
from typing import Any
from urllib.parse import urlparse

COOKIE_NAME = "oddtrove_session"
COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days
PUBLIC_ORIGIN = (os.environ.get("ODDTROVE_PUBLIC_ORIGIN") or "https://oddtrove.art").rstrip("/")


def sso_secret() -> bytes:
    raw = (
        os.environ.get("ODDTROVE_SSO_SECRET")
        or os.environ.get("ODDTROVE_GOOGLE_STATE_SECRET")
        or os.environ.get("ODDTROVE_GOOGLE_CLIENT_SECRET")
        or "oddtrove-sso-dev-only"
    ).encode("utf-8")
    return hashlib.sha256(raw).digest()


def google_redirect_uri() -> str:
    override = (os.environ.get("ODDTROVE_GOOGLE_REDIRECT_URI") or "").strip()
    if override:
        return override
    return f"{PUBLIC_ORIGIN}/hub/api/auth/google/callback"


def sign_identity(email: str, google_sub: str = "", exp: int | None = None) -> str:
    email_n = str(email or "").strip().lower()
    sub = str(google_sub or "").strip()
    if not email_n:
        raise ValueError("email required")
    if exp is None:
        exp = int(time.time()) + COOKIE_MAX_AGE
    payload = f"{email_n}|{sub}|{exp}"
    sig = hmac.new(sso_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    raw = f"{payload}|{sig}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def verify_token(token: str) -> dict[str, str] | None:
    raw = str(token or "").strip()
    if not raw:
        return None
    pad = "=" * (-len(raw) % 4)
    try:
        decoded = base64.urlsafe_b64decode((raw + pad).encode("ascii")).decode("utf-8")
        parts = decoded.rsplit("|", 3)
        if len(parts) != 4:
            return None
        email, sub, exp_s, sig = parts
        email_n = email.strip().lower()
        if not email_n:
            return None
        exp = int(exp_s)
        if exp < int(time.time()):
            return None
        payload = f"{email_n}|{sub}|{exp}"
        expect = hmac.new(sso_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expect):
            return None
        return {"email": email_n, "google_sub": (sub or "").strip()}
    except (ValueError, UnicodeDecodeError, TypeError):
        return None


def parse_cookies(header: str | None) -> dict[str, str]:
    out: dict[str, str] = {}
    if not header:
        return out
    for part in header.split(";"):
        if "=" in part:
            k, v = part.strip().split("=", 1)
            out[k] = v
    return out


def identity_from_cookie_header(cookie_header: str | None) -> dict[str, str] | None:
    token = parse_cookies(cookie_header).get(COOKIE_NAME)
    if not token:
        return None
    return verify_token(token)


def _cookie_secure(headers: Any) -> bool:
    if os.environ.get("ODDTROVE_COOKIE_SECURE", "1") == "0":
        return False
    get = headers.get if hasattr(headers, "get") else (lambda _k, _d=None: None)
    proto = (get("X-Forwarded-Proto") or "").lower()
    if proto == "https" or get("X-Forwarded-Ssl") == "on":
        return True
    return False


def _use_domain(headers: Any) -> bool:
    get = headers.get if hasattr(headers, "get") else (lambda _k, _d=None: None)
    host = (get("Host") or "").split(":")[0].lower()
    return host.endswith("oddtrove.art")


def cookie_header_value(token: str, *, headers: Any = None, clear: bool = False) -> str:
    """Build Set-Cookie value for shared Odd Trove session."""
    max_age = 0 if clear else COOKIE_MAX_AGE
    value = "" if clear else token
    parts = [
        f"{COOKIE_NAME}={value}",
        "Path=/",
        f"Max-Age={max_age}",
        "HttpOnly",
        "SameSite=Lax",
    ]
    if headers is not None and _use_domain(headers):
        parts.append("Domain=.oddtrove.art")
    if headers is not None and _cookie_secure(headers):
        parts.append("Secure")
    elif headers is None:
        # Hub production default when headers not passed
        parts.extend(["Domain=.oddtrove.art", "Secure"])
    return "; ".join(parts)


def safe_return_url(raw: str | None, default: str | None = None) -> str:
    """Allow only same-site oddtrove.art paths (or relative site paths)."""
    fallback = default or f"{PUBLIC_ORIGIN}/"
    path = str(raw or "").strip()
    if not path:
        return fallback
    if path.startswith("/") and not path.startswith("//"):
        allowed_prefixes = (
            "/halalit/",
            "/crocheter/",
            "/lorekeeper/",
            "/hub/",
            "/halalyrics/",
        )
        if path == "/" or any(path.startswith(p) for p in allowed_prefixes):
            return f"{PUBLIC_ORIGIN}{path}"
        return fallback
    if path.startswith("./") or path.startswith("../"):
        # Relative returns belong to the site that started login — keep as path under origin
        return path
    try:
        parsed = urlparse(path)
    except ValueError:
        return fallback
    if parsed.scheme in ("http", "https") and (parsed.hostname or "").endswith("oddtrove.art"):
        return path
    return fallback
