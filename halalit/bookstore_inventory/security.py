"""URL / HTML / domain safety for bookstore adapters."""
from __future__ import annotations

import html
import ipaddress
import re
from typing import Iterable
from urllib.parse import urlparse, urlunparse

_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_SCRIPT = re.compile(r"<\s*script\b[^>]*>.*?<\s*/\s*script\s*>", re.I | re.S)
_TAGS = re.compile(r"<[^>]+>")


class SecurityError(Exception):
    pass


def sanitize_public_text(value: str | None, max_len: int = 500) -> str | None:
    if value is None:
        return None
    s = str(value)
    s = _SCRIPT.sub("", s)
    s = _TAGS.sub("", s)
    s = html.unescape(s)
    s = _CTRL.sub("", s).strip()
    if not s:
        return None
    return s[:max_len]


def parse_allowed_url(url: str | None, approved_domains: Iterable[str]) -> str:
    if not url or not str(url).strip():
        raise SecurityError("empty_url")
    raw = str(url).strip()
    if len(raw) > 2000:
        raise SecurityError("url_too_long")
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise SecurityError("scheme_not_allowed")
    host = (parsed.hostname or "").lower().rstrip(".")
    if not host:
        raise SecurityError("missing_host")
    try:
        ip = ipaddress.ip_address(host)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
        ):
            raise SecurityError("ssrf_blocked")
    except ValueError:
        pass  # hostname, not literal IP
    approved = {d.lower().lstrip(".").rstrip(".") for d in approved_domains}
    if not any(host == d or host.endswith("." + d) for d in approved):
        raise SecurityError("domain_not_approved")
    # Drop credentials / fragments.
    clean = urlunparse(
        (
            parsed.scheme,
            host + (f":{parsed.port}" if parsed.port else ""),
            parsed.path or "/",
            "",
            parsed.query,
            "",
        )
    )
    return clean


def is_redirect_host_allowed(location: str | None, approved_domains: Iterable[str]) -> bool:
    if not location:
        return False
    try:
        parse_allowed_url(location, approved_domains)
        return True
    except SecurityError:
        return False
