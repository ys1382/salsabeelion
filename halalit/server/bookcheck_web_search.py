"""Web review snippets for Bookcheck theme scans — DuckDuckGo lite by default, Brave when keyed."""
from __future__ import annotations

import html as html_lib
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

USER_AGENT = "HalalitBookcheck/1.0 (Odd Trove; family book guide)"


def _brave_search(query: str, count: int = 20) -> tuple[list[dict[str, str]], str]:
    key = os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()
    if not key:
        raise RuntimeError("brave_key_missing")
    params = urllib.parse.urlencode({"q": query, "count": str(count)})
    url = f"https://api.search.brave.com/res/v1/web/search?{params}"
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "X-Subscription-Token": key,
            "User-Agent": USER_AGENT,
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    rows: list[dict[str, str]] = []
    for item in (data.get("web") or {}).get("results") or []:
        if not isinstance(item, dict):
            continue
        rows.append(
            {
                "title": str(item.get("title") or ""),
                "url": str(item.get("url") or ""),
                "snippet": str(item.get("description") or ""),
            }
        )
    return rows, "brave"


def _ddg_lite_parse_rows(page_html: str, count: int) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    link_re = re.compile(
        r"<a[^>]+href=[\"']([^\"']+)[\"'][^>]*class=[\"']result-link[\"'][^>]*>(.*?)</a>"
        r"|<a[^>]+class=[\"']result-link[\"'][^>]+href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>",
        re.I | re.S,
    )
    snippet_re = re.compile(
        r"<td[^>]+class=[\"']result-snippet[\"'][^>]*>(.*?)</td>",
        re.I | re.S,
    )
    links_raw = link_re.findall(page_html)
    links: list[tuple[str, str]] = []
    for item in links_raw:
        if item[0]:
            links.append((item[0], item[1]))
        else:
            links.append((item[2], item[3]))
    snippets = snippet_re.findall(page_html)
    for i, (href, title_html) in enumerate(links):
        if len(rows) >= count:
            break
        title = html_lib.unescape(re.sub(r"<[^>]+>", "", title_html))
        title = urllib.parse.unquote(re.sub(r"\s+", " ", title).strip())
        snippet = ""
        if i < len(snippets):
            snippet = re.sub(r"<[^>]+>", "", snippets[i])
            snippet = re.sub(r"\s+", " ", snippet).strip()
        url = href.strip()
        if url.startswith("//"):
            url = "https:" + url
        if not url.startswith("http"):
            continue
        rows.append({"title": title, "url": url, "snippet": snippet})
    return rows


def _ddg_lite_fallback_parse(page_html: str, count: int) -> list[dict[str, str]]:
    """Fallback when DDG lite markup changes — grab external links near result-like blocks."""
    rows: list[dict[str, str]] = []
    for m in re.finditer(r'href="(https?://[^"]+)"[^>]*>([^<]{4,240})</a>', page_html, re.I):
        url = m.group(1).strip()
        if "duckduckgo.com" in url or "duck.com" in url:
            continue
        title = html_lib.unescape(re.sub(r"\s+", " ", m.group(2)).strip())
        if not title:
            continue
        rows.append({"title": title, "url": url, "snippet": ""})
        if len(rows) >= count:
            break
    return rows


def _ddg_lite_search(query: str, count: int = 20) -> tuple[list[dict[str, str]], str]:
    body = urllib.parse.urlencode({"q": query}).encode("utf-8")
    req = urllib.request.Request(
        "https://lite.duckduckgo.com/lite/",
        data=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        page_html = resp.read().decode("utf-8", errors="replace")

    rows = _ddg_lite_parse_rows(page_html, count)
    if not rows:
        rows = _ddg_lite_fallback_parse(page_html, count)
    if not rows:
        raise RuntimeError("ddg_parse_empty")
    return rows, "duckduckgo_lite"


def web_search(query: str, count: int = 20) -> tuple[list[dict[str, str]], str]:
    if os.environ.get("BRAVE_SEARCH_API_KEY", "").strip():
        return _brave_search(query, count=count)
    return _ddg_lite_search(query, count=count)


def _review_queries(title: str, author: str) -> list[str]:
    title = title.strip()
    author = author.strip()
    byline = f'"{title}"'
    if author:
        byline += f" {author}"
    return [
        f"{byline} book review content parents",
        f"{byline} book review profanity OR language OR LGBTQ OR romance OR violence",
        f"{byline} parents guide content warnings",
    ]


def fetch_review_snippets(
    title: str,
    author: str,
    *,
    max_results: int = 8,
    max_chars: int = 3500,
) -> dict[str, Any]:
    """Return review snippets from web search; never raises — scan continues on failure."""
    title = (title or "").strip()
    if not title:
        return {"ok": False, "provider": None, "snippets": [], "error": "title_required"}

    merged: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    provider: str | None = None
    last_error = ""

    per_query = max(4, (max_results + 1) // 2)
    for query in _review_queries(title, author):
        if len(merged) >= max_results:
            break
        try:
            rows, used_provider = web_search(query, count=per_query)
            if not provider:
                provider = used_provider
            for row in rows:
                url = (row.get("url") or "").strip()
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                merged.append(
                    {
                        "title": (row.get("title") or "").strip()[:240],
                        "url": url[:500],
                        "snippet": (row.get("snippet") or "").strip()[:600],
                    }
                )
                if len(merged) >= max_results:
                    break
        except Exception as e:
            last_error = str(e)[:200]

    if not merged:
        return {
            "ok": False,
            "provider": provider,
            "snippets": [],
            "error": last_error or "no_snippets",
        }

    total = 0
    trimmed: list[dict[str, str]] = []
    for row in merged:
        chunk_len = len(row.get("title") or "") + len(row.get("snippet") or "") + len(row.get("url") or "")
        if total + chunk_len > max_chars and trimmed:
            break
        trimmed.append(row)
        total += chunk_len

    return {"ok": True, "provider": provider, "snippets": trimmed}


def format_review_snippets_for_prompt(snippets: list[dict[str, str]]) -> str:
    if not snippets:
        return ""
    lines: list[str] = []
    for i, row in enumerate(snippets, start=1):
        title = (row.get("title") or "Untitled").strip()
        url = (row.get("url") or "").strip()
        snippet = (row.get("snippet") or "").strip()
        lines.append(f'{i}. "{title}" — {url}')
        if snippet:
            lines.append(f"   {snippet}")
    return "\n".join(lines)
