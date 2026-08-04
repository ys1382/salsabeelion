"""Conservative HTTP client with rate limits, cache, and domain allowlists."""
from __future__ import annotations

import hashlib
import logging
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any

from .security import SecurityError, is_redirect_host_allowed, parse_allowed_url

logger = logging.getLogger("halalit.bookstore.http")

DEFAULT_UA = os.environ.get(
    "HALALIT_BOOKSTORE_USER_AGENT",
    "HalalitBookstoreInventory/0.1 (+https://oddtrove.art/halalit/; family reading companion)",
)
MAX_RESPONSE_BYTES = int(os.environ.get("HALALIT_BOOKSTORE_MAX_BYTES", str(2_500_000)))


@dataclass
class DomainLimiter:
    min_interval: float = 10.0
    _last: dict[str, float] = field(default_factory=dict)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def wait(self, domain: str) -> None:
        with self._lock:
            now = time.time()
            last = self._last.get(domain, 0.0)
            delay = self.min_interval - (now - last)
            if delay > 0:
                time.sleep(delay)
            self._last[domain] = time.time()


_LIMITERS: dict[str, DomainLimiter] = {}
_LIMITERS_LOCK = threading.Lock()
_CACHE: dict[str, tuple[float, bytes, dict[str, str]]] = {}
_CACHE_LOCK = threading.Lock()


def _limiter_for(domain: str, min_interval: float) -> DomainLimiter:
    with _LIMITERS_LOCK:
        lim = _LIMITERS.get(domain)
        if lim is None or lim.min_interval != min_interval:
            lim = DomainLimiter(min_interval=min_interval)
            _LIMITERS[domain] = lim
        return lim


@dataclass
class HttpResponse:
    url: str
    status: int
    body: bytes
    headers: dict[str, str]


def fetch_url(
    url: str,
    *,
    approved_domains: list[str],
    min_interval: float = 10.0,
    timeout: float = 25.0,
    method: str = "GET",
    cache_ttl: float = 900.0,
    max_redirects: int = 4,
    user_agent: str | None = None,
) -> HttpResponse:
    current = parse_allowed_url(url, approved_domains)
    cache_key = hashlib.sha256(f"{method}:{current}".encode()).hexdigest()
    if method == "GET" and cache_ttl > 0:
        with _CACHE_LOCK:
            hit = _CACHE.get(cache_key)
            if hit and hit[0] > time.time():
                return HttpResponse(url=current, status=200, body=hit[1], headers=hit[2])

    redirects = 0
    while True:
        host = urllib.parse.urlparse(current).hostname or ""
        _limiter_for(host, min_interval).wait(host)
        req = urllib.request.Request(
            current,
            method=method,
            headers={
                "User-Agent": user_agent or DEFAULT_UA,
                "Accept": "text/html,application/json,application/ld+json;q=0.9,*/*;q=0.8",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read(MAX_RESPONSE_BYTES + 1)
                if len(raw) > MAX_RESPONSE_BYTES:
                    raise SecurityError("response_too_large")
                headers = {k.lower(): v for k, v in resp.headers.items()}
                final = resp.geturl() or current
                parse_allowed_url(final, approved_domains)
                out = HttpResponse(
                    url=final,
                    status=getattr(resp, "status", 200) or 200,
                    body=raw,
                    headers=headers,
                )
                if method == "GET" and cache_ttl > 0 and out.status == 200:
                    with _CACHE_LOCK:
                        _CACHE[cache_key] = (time.time() + cache_ttl, out.body, out.headers)
                        if len(_CACHE) > 300:
                            oldest = sorted(_CACHE.items(), key=lambda kv: kv[1][0])[:50]
                            for k, _ in oldest:
                                _CACHE.pop(k, None)
                return out
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308) and redirects < max_redirects:
                loc = e.headers.get("Location")
                if not loc:
                    raise
                if loc.startswith("/"):
                    p = urllib.parse.urlparse(current)
                    loc = f"{p.scheme}://{p.netloc}{loc}"
                if not is_redirect_host_allowed(loc, approved_domains):
                    raise SecurityError("redirect_domain_not_approved") from e
                current = parse_allowed_url(loc, approved_domains)
                redirects += 1
                continue
            body = e.read(MAX_RESPONSE_BYTES) if hasattr(e, "read") else b""
            return HttpResponse(url=current, status=e.code, body=body, headers={})
        except urllib.error.URLError as e:
            logger.warning("fetch failed for %s: %s", current, e)
            raise
