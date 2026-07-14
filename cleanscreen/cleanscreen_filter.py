"""CleanScreen — Halalit-aligned web result filtering (title, snippet, URL)."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

_CONFIG_DIR = Path(__file__).resolve().parent / "config"

LGBTQ_RE = re.compile(
    r"\blgbtq?\b|lesbian|gay\b|homosexual|queer\b|transgender|non[- ]?binary|"
    r"they/them|two[- ]moms?|two[- ]mothers?|two[- ]dads?|two[- ]fathers?|"
    r"same[- ]sex marriage|gender[- ]fluid|bisexual|nonbinary",
    re.I,
)

ROMANCE_RE = re.compile(
    r"\bromance\b|romantic fiction|love stories|romantic love|dating fiction|"
    r"romantic relationships|romantic tension|romantic subplot|love triangle|"
    r"erotic romance|adult romance|dating app|hookup",
    re.I,
)

SEXUAL_RE = re.compile(
    r"\bporn\b|\bxxx\b|\bnsfw\b|\bonlyfans\b|sexual intercourse|explicit sex|"
    r"erotic\b|nude photos?|naked photos?",
    re.I,
)

FANSERVICE_RE = re.compile(
    r"\bfanservice\b|\becchi\b|panty ?shot|sexualized|sexualised|immodest",
    re.I,
)

SUBSTANCE_PROMO_RE = re.compile(
    r"\b(?:buy|shop|order|discount on|coupon for|best deals on)\s+.{0,40}"
    r"(?:wine|beer|vodka|whiskey|bourbon|tequila|cigarettes?|cigars?|vape|juul)|"
    r"\b(?:winery|brewery|distillery|liquor store|vape shop|smoke shop)\b|"
    r"\bcocktail recipes?\b|\bmixology\b",
    re.I,
)

SUBSTANCE_BRAND_RE = re.compile(
    r"\bmarlboro\b|\bphilip morris\b|\bjuul\b|\bvuse\b|\bheineken\b|\bbudweiser\b|"
    r"\bmolson\b|\bcorona beer\b|\bsmirnoff\b|\bjack daniel'?s\b",
    re.I,
)

GROUP_DEMONIZATION_RE = re.compile(
    r"\ball\s+(?:muslims?|jews?|christians?|blacks?|whites?|asians?|immigrants?|"
    r"mexicans?|arabs?|hindus?|sikhs?|catholics?|protestants?)\s+are\b|"
    r"\b(?:muslims?|jews?|blacks?|whites?)\s+(?:are\s+)?(?:all\s+)?(?:evil|scum|trash|vermin)|"
    r"\brace\s+(?:war|realism)\s+thread\b|\bwhite\s+power\b|\b14\s*words\b",
    re.I,
)

PROFANITY_PATTERNS = [
    re.compile(r"\bf+\W*u+\W*c+\W*k(?:ing|ed|er|ers|s)?\b", re.I),
    re.compile(r"\bmother\s*f+\W*u+\W*c+\W*k(?:er|ers|ing)?\b", re.I),
    re.compile(r"\bbitch(?:es)?\b", re.I),
    re.compile(r"\bsh+\W*i+\W*t+(?:ty|s|ting|ted)?\b", re.I),
    re.compile(r"\bass(?:hole|wipe)?\b", re.I),
    re.compile(r"\bcunt(?:s)?\b", re.I),
    re.compile(r"\bdick(?:head|s)?\b", re.I),
    re.compile(r"\bcock(?:sucker|s)?\b", re.I),
    re.compile(r"\bpuss(?:y|ies)\b", re.I),
    re.compile(r"\bwhor(?:e|es)\b", re.I),
    re.compile(r"\bslut(?:ty|s)?\b", re.I),
    re.compile(r"\bnigg(?:a|er|as|ers)\b", re.I),
    re.compile(r"\bgoddamn(?:ed|it)?\b", re.I),
]


@dataclass
class FilterVerdict:
    allow: bool
    reason: str = ""


@dataclass(frozen=True)
class VettedYoutubeChannel:
    handle: str = ""
    channel_id: str = ""
    names: tuple[str, ...] = ()


def _load_json(name: str) -> dict[str, Any]:
    path = _CONFIG_DIR / name
    if not path.is_file():
        return {}
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _domain(host: str) -> str:
    host = (host or "").lower().strip(".")
    if host.startswith("www."):
        host = host[4:]
    return host


def domain_from_url(url: str) -> str:
    try:
        return _domain(urlparse(url).netloc or "")
    except Exception:
        return ""


def domain_matches(host: str, patterns: list[str]) -> bool:
    host = _domain(host)
    if not host:
        return False
    for pat in patterns:
        p = _domain(pat)
        if host == p or host.endswith("." + p):
            return True
    return False


def load_block_domains() -> dict[str, list[str]]:
    raw = _load_json("block_domains.json")
    out: dict[str, list[str]] = {}
    for key, val in raw.items():
        if isinstance(val, list):
            out[key] = [str(x) for x in val]
    return out


def load_vetted_domains() -> list[str]:
    raw = _load_json("vetted_domains.json")
    domains = raw.get("domains") if isinstance(raw, dict) else []
    if not isinstance(domains, list):
        return []
    return [str(d) for d in domains]


def load_kids_news_domains() -> list[str]:
    raw = _load_json("vetted_domains.json")
    rows = raw.get("kidsNewsDomains") if isinstance(raw, dict) else []
    if not isinstance(rows, list):
        return []
    return [str(d) for d in rows if str(d).strip()]


def load_policy_rules() -> dict[str, Any]:
    raw = _load_json("policy_rules.json")
    return raw if isinstance(raw, dict) else {}


def load_parent_only_domains() -> list[str]:
    raw = _load_json("parent_only_domains.json")
    if not isinstance(raw, dict):
        return []
    out: list[str] = []
    for key, val in raw.items():
        if key == "notes" or not isinstance(val, list):
            continue
        for item in val:
            dom = str(item).strip()
            if dom:
                out.append(dom)
    return out


def is_parent_only_url(url: str, parent_only: list[str] | None = None) -> bool:
    host = domain_from_url(url)
    return domain_matches(host, parent_only or load_parent_only_domains())


def _normalize_youtube_handle(handle: str) -> str:
    return (handle or "").strip().lower().lstrip("@")


def load_vetted_youtube_channels() -> list[VettedYoutubeChannel]:
    raw = _load_json("vetted_youtube_channels.json")
    rows = raw.get("channels") if isinstance(raw, dict) else []
    if not isinstance(rows, list):
        return []
    out: list[VettedYoutubeChannel] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        names_raw = row.get("names")
        names: tuple[str, ...] = ()
        if isinstance(names_raw, list):
            names = tuple(str(n).strip() for n in names_raw if str(n).strip())
        out.append(
            VettedYoutubeChannel(
                handle=_normalize_youtube_handle(str(row.get("handle") or "")),
                channel_id=str(row.get("channel_id") or "").strip().lower(),
                names=names,
            )
        )
    return out


def is_youtube_url(url: str) -> bool:
    host = domain_from_url(url)
    return host in {"youtube.com", "youtu.be", "m.youtube.com"}


def is_youtube_content_url(url: str) -> bool:
    u = (url or "").lower()
    return (
        "/watch" in u
        or "/shorts/" in u
        or "youtu.be/" in u
        or "/@" in u
        or "/channel/" in u
        or "/c/" in u
        or "/user/" in u
    )


def youtube_url_signals(url: str) -> dict[str, str]:
    u = (url or "").lower()
    handle = ""
    channel_id = ""
    m = re.search(r"youtube\.com/@([a-z0-9._-]+)", u)
    if m:
        handle = m.group(1)
    m = re.search(r"youtube\.com/channel/([a-z0-9_-]+)", u)
    if m:
        channel_id = m.group(1)
    return {"handle": handle, "channel_id": channel_id}


def channel_name_in_text(names: tuple[str, ...], title: str, snippet: str) -> bool:
    hay = f"{title or ''} {snippet or ''}".lower()
    for name in names:
        n = name.strip().lower()
        if n and n in hay:
            return True
    return False


def is_vetted_youtube_channel(
    url: str,
    title: str = "",
    snippet: str = "",
    channels: list[VettedYoutubeChannel] | None = None,
) -> bool:
    if not is_youtube_url(url):
        return False
    channels = channels if channels is not None else load_vetted_youtube_channels()
    if not channels:
        return False
    signals = youtube_url_signals(url)
    for ch in channels:
        if ch.handle and signals["handle"] == ch.handle:
            return True
        if ch.channel_id and signals["channel_id"] == ch.channel_id:
            return True
        if ch.names and is_youtube_content_url(url) and channel_name_in_text(ch.names, title, snippet):
            return True
    return False


def mentions_profanity(text: str) -> bool:
    raw = str(text or "")
    if not raw.strip():
        return False
    lowered = raw.lower()
    for pat in PROFANITY_PATTERNS:
        if pat.search(lowered):
            return True
    collapsed = re.sub(r"[^a-z0-9]+", " ", lowered)
    return bool(re.search(r"\bfuck\b|\bbitch\b|\bshit\b|\bnigger\b|\bnigga\b|\bcunt\b", collapsed))


def combined_text(title: str, snippet: str, url: str = "") -> str:
    return f"{title or ''} {snippet or ''} {url or ''}".strip()


def hard_block_reason(text: str) -> str | None:
    if mentions_profanity(text):
        return "profanity"
    if SEXUAL_RE.search(text):
        return "sexual_content"
    if GROUP_DEMONIZATION_RE.search(text):
        return "hostile_or_hate"
    if SUBSTANCE_PROMO_RE.search(text) or SUBSTANCE_BRAND_RE.search(text):
        return "substance_promotion"
    return None


def open_web_block_reason(text: str) -> str | None:
    hard = hard_block_reason(text)
    if hard:
        return hard
    if LGBTQ_RE.search(text):
        return "lgbtq_themes"
    if ROMANCE_RE.search(text):
        return "romance"
    if FANSERVICE_RE.search(text):
        return "fanservice"
    return None


def domain_block_reason(url: str, blocks: dict[str, list[str]]) -> str | None:
    host = domain_from_url(url)
    if not host:
        return "invalid_url"
    if domain_matches(host, blocks.get("fanfic", [])):
        return "fanfic_host"
    if domain_matches(host, blocks.get("video_heavy", [])):
        return "video_heavy"
    if domain_matches(host, blocks.get("substance_retail", [])):
        return "substance_retail"
    if domain_matches(host, blocks.get("fanservice_sites", [])):
        return "fanservice_site"
    if domain_matches(host, blocks.get("bypass_tools", [])):
        return "bypass_tool"
    return None


def is_vetted_url(url: str, vetted: list[str] | None = None) -> bool:
    host = domain_from_url(url)
    return domain_matches(host, vetted or load_vetted_domains())


def is_kids_news_url(url: str, kids_news: list[str] | None = None) -> bool:
    host = domain_from_url(url)
    return domain_matches(host, kids_news or load_kids_news_domains())


def filter_result(
    title: str,
    url: str,
    snippet: str = "",
    *,
    parent_mode: bool = False,
    blocks: dict[str, list[str]] | None = None,
    vetted: list[str] | None = None,
    parent_only: list[str] | None = None,
    kids_news: list[str] | None = None,
    vetted_youtube: list[VettedYoutubeChannel] | None = None,
) -> FilterVerdict:
    blocks = blocks if blocks is not None else load_block_domains()
    vetted = vetted if vetted is not None else load_vetted_domains()
    parent_only = parent_only if parent_only is not None else load_parent_only_domains()
    kids_news = kids_news if kids_news is not None else load_kids_news_domains()
    vetted_youtube = (
        vetted_youtube if vetted_youtube is not None else load_vetted_youtube_channels()
    )
    text = combined_text(title, snippet, url)

    dom_reason = domain_block_reason(url, blocks)
    if dom_reason == "video_heavy" and is_youtube_url(url):
        if is_vetted_youtube_channel(url, title, snippet, vetted_youtube):
            hard = hard_block_reason(text)
            if hard:
                return FilterVerdict(False, hard)
            return FilterVerdict(True, "vetted_youtube_channel")
        return FilterVerdict(False, "video_heavy")
    if dom_reason:
        return FilterVerdict(False, dom_reason)

    if not parent_mode and is_kids_news_url(url, kids_news):
        hard = hard_block_reason(text)
        if hard:
            return FilterVerdict(False, hard)
        return FilterVerdict(True, "kids_news_site")

    if is_parent_only_url(url, parent_only):
        if not parent_mode:
            return FilterVerdict(False, "parent_only_site")
        hard = hard_block_reason(text)
        if hard:
            return FilterVerdict(False, hard)
        return FilterVerdict(True, "parent_only_site")

    if is_vetted_url(url, vetted):
        hard = hard_block_reason(text)
        if hard:
            return FilterVerdict(False, hard)
        return FilterVerdict(True, "vetted_site")

    open_reason = open_web_block_reason(text)
    if open_reason:
        return FilterVerdict(False, open_reason)
    return FilterVerdict(True, "")


def filter_results(
    results: list[dict[str, Any]],
    *,
    parent_mode: bool = False,
    blocks: dict[str, list[str]] | None = None,
    vetted: list[str] | None = None,
    parent_only: list[str] | None = None,
    kids_news: list[str] | None = None,
    vetted_youtube: list[VettedYoutubeChannel] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    kept: list[dict[str, Any]] = []
    dropped: list[dict[str, Any]] = []
    for row in results:
        title = str(row.get("title") or "")
        url = str(row.get("url") or "")
        snippet = str(row.get("snippet") or "")
        verdict = filter_result(
            title,
            url,
            snippet,
            parent_mode=parent_mode,
            blocks=blocks,
            vetted=vetted,
            parent_only=parent_only,
            kids_news=kids_news,
            vetted_youtube=vetted_youtube,
        )
        enriched = dict(row)
        enriched["filterReason"] = verdict.reason
        if verdict.allow:
            kept.append(enriched)
        else:
            dropped.append(enriched)
    return kept, dropped
