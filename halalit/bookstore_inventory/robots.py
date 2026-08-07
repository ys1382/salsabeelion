"""robots.txt helpers — never crawl Disallow paths."""
from __future__ import annotations

import logging
import time
import urllib.parse
import urllib.robotparser
from pathlib import Path

from .http_client import fetch_url

logger = logging.getLogger("halalit.bookstore.robots")

_CACHE: dict[str, tuple[float, urllib.robotparser.RobotFileParser | None]] = {}
_CACHE_TTL = 3600.0

BUNDLED_DIR = Path(__file__).resolve().parent / "fixtures" / "robots"

# When live robots.txt is Cloudflare-blocked, use a previously captured
# IndieCommerce robots (Disallow /search/ and /books/; /book/{isbn} allowed).
_BUNDLED_BY_HOST = {
    "greenapplebooks.com": "indiecommerce_default.txt",
    "www.greenapplebooks.com": "indiecommerce_default.txt",
}


class RobotsBlockedError(RuntimeError):
    """Raised when robots.txt disallows the requested path."""


def _robots_url(base_website: str) -> str:
    p = urllib.parse.urlparse(base_website)
    return f"{p.scheme}://{p.netloc}/robots.txt"


def _looks_like_robots_text(text: str) -> bool:
    low = (text or "")[:2000].lower()
    if "<html" in low or "just a moment" in low or "cf-chl" in low:
        return False
    return "user-agent" in low or "disallow" in low or "allow:" in low


def _bundled_parser(website: str) -> urllib.robotparser.RobotFileParser | None:
    host = urllib.parse.urlparse(website).netloc.lower()
    if host.startswith("www."):
        bare = host[4:]
    else:
        bare = host
    name = _BUNDLED_BY_HOST.get(host) or _BUNDLED_BY_HOST.get(bare)
    if not name:
        return None
    path = BUNDLED_DIR / name
    if not path.is_file():
        return None
    rp = urllib.robotparser.RobotFileParser()
    rp.parse(path.read_text(encoding="utf-8").splitlines())
    logger.info("using bundled robots for %s (%s)", host, name)
    return rp


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
            bundled = _bundled_parser(website)
            _CACHE[robots_url] = (now + _CACHE_TTL, bundled)
            if bundled is None:
                logger.info(
                    "robots.txt missing or blocked for %s (%s) — no bundled fallback",
                    website,
                    resp.status,
                )
            return bundled
        text = resp.body.decode("utf-8", errors="replace")
        if not _looks_like_robots_text(text):
            bundled = _bundled_parser(website)
            _CACHE[robots_url] = (now + _CACHE_TTL, bundled)
            logger.info("robots.txt for %s looked like a challenge page — bundled=%s", website, bool(bundled))
            return bundled
        rp.parse(text.splitlines())
        _CACHE[robots_url] = (now + _CACHE_TTL, rp)
        return rp
    except Exception as e:
        logger.warning("robots fetch failed for %s: %s", website, e)
        bundled = _bundled_parser(website)
        _CACHE[robots_url] = (now + 300, bundled)
        return bundled


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
