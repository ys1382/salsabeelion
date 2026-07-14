"""Shared helpers for email password-reset tokens (stdlib only)."""
from __future__ import annotations

import hashlib
import os
import secrets
import time

RESET_TOKEN_TTL_SEC = int(os.environ.get("ODDTROVE_RESET_TOKEN_TTL_SEC", "3600"))
RESET_RATE_LIMIT_PER_EMAIL = int(os.environ.get("ODDTROVE_RESET_RATE_LIMIT_EMAIL", "3"))
RESET_RATE_LIMIT_PER_IP = int(os.environ.get("ODDTROVE_RESET_RATE_LIMIT_IP", "10"))
RESET_RATE_WINDOW_SEC = int(os.environ.get("ODDTROVE_RESET_RATE_WINDOW_SEC", "3600"))

_ip_attempts: dict[str, list[float]] = {}


def new_reset_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(str(raw or "").encode("utf-8")).hexdigest()


def token_expires_at(now: float | None = None) -> float:
    return (now if now is not None else time.time()) + RESET_TOKEN_TTL_SEC


def within_rate_limit(timestamps: list[float], now: float | None = None) -> bool:
    now = now if now is not None else time.time()
    cutoff = now - RESET_RATE_WINDOW_SEC
    recent = [t for t in timestamps if t >= cutoff]
    return len(recent) < RESET_RATE_LIMIT_PER_EMAIL


def client_ip_from_headers(forwarded_for: str | None, remote_addr: str | None) -> str:
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return (remote_addr or "").strip() or "unknown"


def ip_rate_allowed(ip: str, now: float | None = None) -> bool:
    now = now if now is not None else time.time()
    cutoff = now - RESET_RATE_WINDOW_SEC
    recent = [t for t in _ip_attempts.get(ip, []) if t >= cutoff]
    _ip_attempts[ip] = recent
    return len(recent) < RESET_RATE_LIMIT_PER_IP


def record_ip_attempt(ip: str, now: float | None = None) -> None:
    now = now if now is not None else time.time()
    _ip_attempts.setdefault(ip, []).append(now)
