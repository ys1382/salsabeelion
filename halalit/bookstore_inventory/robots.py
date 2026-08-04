"""robots.txt helpers — never crawl Disallow paths."""
from __future__ import annotations

import logging
import time
import urllib.parse
import urllib.robotparser
from typing import Any

from .http_client import fetch_url

logger = logging.getLogger("halalit.bookstore.robots")

_CACHE: dict[str, tuple[float, urllib.robotparser.RobotFileParser | None]] = {}
_CACHE_TTL = 3600.0


class RobotsBlockedError(RuntimeError):
    """Raised when robots.txt disallows the requested path."""


def _robots_url(base_website: str) -> str:
    p = urllib.parse.urlparse(base_website)
    return f"{p.scheme}://{p.netloc}/robots.txt"


def load_robots(
    website: str,
    *,
    approved_domains: list[str],
    min_interval: float = 10.0,
    user_agent: str,
) -> urllib.robotparser.RobotFileParser | None:
    robots_url = _robots_url(website)
    now = time.time()
    hit = _CACHE.get(robots_url)
    if hit and hit[0] > now:
        return hit[1]
    rp = urllib.robotparser.RobotFileParser()
    try:
        resp = fetch_url(
            robots_url,
            approved_domains=approved_domains,
            min_interval=min_interval,
            cache_ttl=0,
            user_agent=user_agent,
            timeout=15,
        )
        if resp.status != 200:
            logger.info("robots.txt missing or blocked for %s (%s) — treat as cautious deny for scrapes", website, resp.status)
            _CACHE[robots_url] = (now + _CACHE_TTL, None)
            return None
        text = resp.body.decode("utf-8", errors="replace")
        rp.parse(text.splitlines())
        _CACHE[robots_url] = (now + _CACHE_TTL, rp)
        return rp
    except Exception as e:
        logger.warning("robots fetch failed for %s: %s", website, e)
        _CACHE[robots_url] = (now + 300, None)
        return None


def allowed(
    website: str,
    url: str,
    *,
    approved_domains: list[str],
    user_agent: str,
    min_interval: float = 10.0,
) -> bool:
    rp = load_robots(
        website,
        approved_domains=approved_domains,
        min_interval=min_interval,
        user_agent=user_agent,
    )
    if rp is None:
        # Fail closed for automated scrapes when robots cannot be read.
        return False
    return bool(rp.can_fetch(user_agent, url))


def assert_allowed(
    website: str,
    url: str,
    *,
    approved_domains: list[str],
    user_agent: str,
    min_interval: float = 10.0,
) -> None:
    if not allowed(
        website,
        url,
        approved_domains=approved_domains,
        user_agent=user_agent,
        min_interval=min_interval,
    ):
        raise RobotsBlockedError(f"robots_disallow:{url}")
