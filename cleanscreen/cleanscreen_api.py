#!/usr/bin/env python3
"""CleanScreen — owner-only filtered web search API."""
from __future__ import annotations

import json
import html as html_lib
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from cleanscreen_filter import (
    filter_result,
    filter_results,
    load_block_domains,
    load_kids_news_domains,
    load_parent_only_domains,
    load_policy_rules,
    load_vetted_domains,
    load_vetted_youtube_channels,
)

PORT = int(os.environ.get("CLEANSCREEN_API_PORT", "8082"))
BIND = os.environ.get("CLEANSCREEN_API_BIND", "127.0.0.1")
_SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("CLEANSCREEN_DATA_PATH", _SCRIPT_DIR / "cleanscreen-data"))
FEEDBACK_LOG = DATA_DIR / "feedback.jsonl"

FEEDBACK_MAX_LEN = 2000
FEEDBACK_RATE_LIMIT = 5
FEEDBACK_RATE_WINDOW_SEC = 3600

_feedback_lock = threading.Lock()
_feedback_hits: dict[str, list[float]] = {}


def _json_response(handler: BaseHTTPRequestHandler, code: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def _read_json(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _client_ip(handler: BaseHTTPRequestHandler) -> str:
    forwarded = handler.headers.get("X-Real-IP") or handler.headers.get("X-Forwarded-For") or ""
    if forwarded:
        return forwarded.split(",")[0].strip()
    return handler.client_address[0]


def _feedback_allowed(ip: str) -> bool:
    now = time.time()
    with _feedback_lock:
        hits = [t for t in _feedback_hits.get(ip, []) if now - t < FEEDBACK_RATE_WINDOW_SEC]
        if len(hits) >= FEEDBACK_RATE_LIMIT:
            _feedback_hits[ip] = hits
            return False
        hits.append(now)
        _feedback_hits[ip] = hits
        return True


def _append_feedback(entry: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with FEEDBACK_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


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
            "User-Agent": "CleanScreen/0.1 (Odd Trove; owner-only beta)",
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


def _ddg_lite_search(query: str, count: int = 20) -> tuple[list[dict[str, str]], str]:
    body = urllib.parse.urlencode({"q": query}).encode("utf-8")
    req = urllib.request.Request(
        "https://lite.duckduckgo.com/lite/",
        data=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "CleanScreen/0.1 (Odd Trove; owner-only beta)",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        page_html = resp.read().decode("utf-8", errors="replace")

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
    if not rows:
        raise RuntimeError("ddg_parse_empty")
    return rows, "duckduckgo_lite"


def web_search(query: str, count: int = 20) -> tuple[list[dict[str, str]], str]:
    if os.environ.get("BRAVE_SEARCH_API_KEY", "").strip():
        return _brave_search(query, count=count)
    return _ddg_lite_search(query, count=count)


def check_url(
    url: str,
    *,
    title: str = "",
    snippet: str = "",
    parent_mode: bool = False,
) -> dict[str, Any]:
    url = (url or "").strip()
    title = str(title or "").strip()
    snippet = str(snippet or "").strip()
    if not url:
        return {"ok": False, "error": "url_required"}
    if len(url) > 2000:
        return {"ok": False, "error": "url_too_long"}
    if len(title) > 500:
        return {"ok": False, "error": "title_too_long"}
    if len(snippet) > 2000:
        return {"ok": False, "error": "snippet_too_long"}
    if not url.startswith(("http://", "https://")):
        return {"ok": False, "error": "url_must_be_http"}
    verdict = filter_result(title, url, snippet, parent_mode=parent_mode)
    return {
        "ok": True,
        "url": url,
        "title": title,
        "snippet": snippet,
        "parentMode": parent_mode,
        "allow": verdict.allow,
        "reason": verdict.reason,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "CleanScreenAPI/0.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        return

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        path = urllib.parse.urlparse(self.path).path.rstrip("/") or "/"
        if path == "/api/health":
            _json_response(
                self,
                200,
                {
                    "ok": True,
                    "braveConfigured": bool(os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()),
                    "vettedDomainCount": len(load_vetted_domains()),
                    "kidsNewsDomainCount": len(load_kids_news_domains()),
                    "parentOnlyDomainCount": len(load_parent_only_domains()),
                    "vettedYoutubeChannelCount": len(load_vetted_youtube_channels()),
                    "policyVersion": load_policy_rules().get("version"),
                },
            )
            return
        _json_response(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        path = urllib.parse.urlparse(self.path).path.rstrip("/") or "/"
        if path == "/api/search":
            self._handle_search()
            return
        if path == "/api/check":
            self._handle_check()
            return
        if path == "/api/feedback":
            self._handle_feedback()
            return
        _json_response(self, 404, {"ok": False, "error": "not_found"})

    def _handle_search(self) -> None:
        data = _read_json(self)
        query = str(data.get("q") or data.get("query") or "").strip()
        if len(query) < 2:
            _json_response(self, 400, {"ok": False, "error": "query_too_short"})
            return
        if len(query) > 300:
            _json_response(self, 400, {"ok": False, "error": "query_too_long"})
            return
        parent_mode = bool(data.get("parentMode") or data.get("parent_mode"))
        try:
            raw, provider = web_search(query, count=20)
        except RuntimeError as exc:
            code = str(exc)
            _json_response(
                self,
                503,
                {
                    "ok": False,
                    "error": code,
                    "hint": (
                        "Set BRAVE_SEARCH_API_KEY on the server for Brave Search, "
                        "or retry — DuckDuckGo lite is the fallback."
                    ),
                },
            )
            return
        except urllib.error.HTTPError as exc:
            _json_response(
                self,
                502,
                {"ok": False, "error": "search_upstream_http", "status": exc.code},
            )
            return
        except Exception:
            _json_response(self, 502, {"ok": False, "error": "search_upstream_failed"})
            return

        kept, dropped = filter_results(raw, parent_mode=parent_mode)
        _json_response(
            self,
            200,
            {
                "ok": True,
                "query": query,
                "parentMode": parent_mode,
                "provider": provider,
                "rawCount": len(raw),
                "keptCount": len(kept),
                "droppedCount": len(dropped),
                "results": kept,
                "dropped": dropped,
            },
        )

    def _handle_check(self) -> None:
        data = _read_json(self)
        url = str(data.get("url") or "").strip()
        title = str(data.get("title") or "")
        snippet = str(data.get("snippet") or "")
        parent_mode = bool(data.get("parentMode") or data.get("parent_mode"))
        result = check_url(url, title=title, snippet=snippet, parent_mode=parent_mode)
        if not result.get("ok"):
            code = 400
            if result.get("error") == "url_required":
                code = 400
            _json_response(self, code, result)
            return
        _json_response(self, 200, result)

    def _handle_feedback(self) -> None:
        ip = _client_ip(self)
        if not _feedback_allowed(ip):
            _json_response(self, 429, {"ok": False, "error": "rate_limited"})
            return
        data = _read_json(self)
        message = str(data.get("message") or "").strip()
        if not message:
            _json_response(self, 400, {"ok": False, "error": "message_required"})
            return
        if len(message) > FEEDBACK_MAX_LEN:
            _json_response(self, 400, {"ok": False, "error": "message_too_long"})
            return
        entry = {
            "ts": int(time.time()),
            "ip": ip,
            "message": message,
            "kind": str(data.get("kind") or "general")[:40],
            "query": str(data.get("query") or "")[:300],
            "url": str(data.get("url") or "")[:500],
            "parentMode": bool(data.get("parentMode") or data.get("parent_mode")),
        }
        try:
            _append_feedback(entry)
        except OSError:
            _json_response(self, 500, {"ok": False, "error": "write_failed"})
            return
        _json_response(self, 200, {"ok": True})


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    load_block_domains()
    server = ThreadingHTTPServer((BIND, PORT), Handler)
    print(f"CleanScreen API on http://{BIND}:{PORT} (data: {DATA_DIR})")
    server.serve_forever()


if __name__ == "__main__":
    main()
