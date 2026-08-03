#!/usr/bin/env python3
"""HalalFlicks — Flickcheck API (synopsis + Gemini scan)."""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from typing import Any

from halalflicks_scan import scan_synopsis

PORT = int(os.environ.get("HALALFLICKS_API_PORT", "8089"))
BIND = os.environ.get("HALALFLICKS_API_BIND", "127.0.0.1")
_SCRIPT_DIR = Path(__file__).resolve().parent
VETTED_PATH = Path(os.environ.get("HALALFLICKS_VETTED_PATH", _SCRIPT_DIR / "config" / "hand_vetted.json"))
REC_CATALOG_PATH = Path(
    os.environ.get("HALALFLICKS_REC_CATALOG_PATH", _SCRIPT_DIR / "config" / "rec_catalog.json")
)
FLICKCHECK_CACHE_DIR = Path(
    os.environ.get("HALALFLICKS_CACHE_DIR", _SCRIPT_DIR / "cache" / "flickcheck")
)
WIKI_UA = "HalalFlicks/0.1 (Odd Trove; https://oddtrove.art/halalflicks/; owner-beta)"
CACHE_VERSION = "20260803trailer"
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_LOCK = Lock()
_CACHE_TTL = int(os.environ.get("HALALFLICKS_CACHE_TTL", "3600"))
_CACHE_MAX = 200


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
    raw = handler.rfile.read(min(length, 131072))
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _normalize_key(title: str, year: str) -> str:
    def norm(s: str) -> str:
        s = re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()
        return re.sub(r"\s+", " ", s)

    return norm(title) + "|" + norm(year)


def _load_vetted() -> dict[str, dict[str, Any]]:
    if not VETTED_PATH.is_file():
        return {}
    try:
        data = json.loads(VETTED_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    rows = data.get("movies") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        title = str(row.get("title") or "")
        year = str(row.get("year") or "")
        key = str(row.get("key") or "") or _normalize_key(title, year)
        if key:
            out[key] = row
            # Also index title-only so year-optional matches work when year blank in file
            title_key = _normalize_key(title, "")
            if title_key and title_key not in out:
                out[title_key] = row
    return out


def _load_rec_catalog() -> list[dict[str, Any]]:
    if not REC_CATALOG_PATH.is_file():
        return []
    try:
        data = json.loads(REC_CATALOG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    rows = data.get("movies") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return []
    return [row for row in rows if isinstance(row, dict)]


def _theme_query_tokens(q: str) -> list[str]:
    return [t for t in re.sub(r"[^a-z0-9]+", " ", (q or "").lower()).split() if len(t) > 2]


def _movie_search_blob(movie: dict[str, Any]) -> str:
    themes = movie.get("themes") or []
    theme_s = " ".join(str(t) for t in themes) if isinstance(themes, list) else ""
    return " ".join(
        [
            str(movie.get("title") or ""),
            str(movie.get("year") or ""),
            str(movie.get("note") or ""),
            theme_s,
        ]
    ).lower()


def _hand_for_title(title: str, year: str = "") -> dict[str, Any] | None:
    vetted = _load_vetted()
    return vetted.get(_normalize_key(title, year)) or vetted.get(_normalize_key(title, ""))


def _trailer_url_from_hand(hand: dict[str, Any] | None) -> str:
    if not hand:
        return ""
    raw = str(hand.get("trailer_url") or hand.get("trailerUrl") or "").strip()
    if not raw:
        return ""
    if not (raw.startswith("https://www.youtube.com/") or raw.startswith("https://youtu.be/")):
        return ""
    return raw[:500]


def _enrich_catalog_movie(movie: dict[str, Any]) -> dict[str, Any]:
    """Attach hand-vetted trailer + stored Wikipedia poster for Recommend cards."""
    out = dict(movie)
    title = str(out.get("title") or "")
    year = str(out.get("year") or "")
    hand = _hand_for_title(title, year)
    trailer = _trailer_url_from_hand(hand)
    if trailer:
        out["trailerUrl"] = trailer
    elif hand is None:
        # Catalog row may carry its own trailer_url
        own = _trailer_url_from_hand(out)
        if own:
            out["trailerUrl"] = own
    stored_poster = ""
    if hand:
        stored_poster = str(hand.get("poster_url") or hand.get("posterUrl") or "").strip()
    if not stored_poster:
        stored_poster = str(out.get("poster_url") or out.get("posterUrl") or "").strip()
    if stored_poster.startswith("http") and _poster_allowed(hand, None):
        out["posterUrl"] = stored_poster[:800]
    elif "posterUrl" not in out:
        out["posterUrl"] = ""
    return out


def recommend_catalog(theme: str = "") -> dict[str, Any]:
    movies = _load_rec_catalog()
    tokens = _theme_query_tokens(theme)
    if tokens:
        filtered = []
        for movie in movies:
            blob = _movie_search_blob(movie)
            if all(tok in blob for tok in tokens) or any(tok in blob for tok in tokens):
                filtered.append(movie)
        movies = filtered
    enriched = [_enrich_catalog_movie(m) for m in movies]
    return {"ok": True, "movies": enriched, "count": len(enriched)}


def _cache_get(key: str) -> dict[str, Any] | None:
    now = time.time()
    with _CACHE_LOCK:
        row = _CACHE.get(key)
        if not row:
            return None
        ts, payload = row
        if now - ts > _CACHE_TTL:
            _CACHE.pop(key, None)
            return None
        return dict(payload)


def _cache_put(key: str, payload: dict[str, Any]) -> None:
    with _CACHE_LOCK:
        if len(_CACHE) >= _CACHE_MAX:
            oldest = sorted(_CACHE.items(), key=lambda kv: kv[1][0])[: max(1, _CACHE_MAX // 5)]
            for k, _ in oldest:
                _CACHE.pop(k, None)
        _CACHE[key] = (time.time(), dict(payload))


def _disk_path(key: str) -> Path:
    safe = re.sub(r"[^a-z0-9]+", "_", key)[:120] or "blank"
    return FLICKCHECK_CACHE_DIR / f"{safe}.json"


def _disk_get(key: str) -> dict[str, Any] | None:
    path = _disk_path(key)
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict) or not data.get("ok"):
        return None
    return data


def _disk_put(key: str, payload: dict[str, Any]) -> None:
    try:
        FLICKCHECK_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _disk_path(key).write_text(json.dumps(payload), encoding="utf-8")
    except OSError:
        pass


def _wiki_get(url: str) -> dict[str, Any] | None:
    req = urllib.request.Request(url, headers={"User-Agent": WIKI_UA})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def _wikipedia_summary(title: str, year: str) -> dict[str, Any] | None:
    """Best-effort Wikipedia extract for a film title."""
    queries = []
    t = (title or "").strip()
    y = (year or "").strip()
    if not t:
        return None
    if y:
        queries.append(f"{t} ({y} film)")
    queries.append(f"{t} (film)")
    queries.append(t)

    for q in queries:
        search_url = (
            "https://en.wikipedia.org/w/api.php?"
            + urllib.parse.urlencode(
                {
                    "action": "query",
                    "list": "search",
                    "srsearch": q,
                    "srlimit": 5,
                    "format": "json",
                }
            )
        )
        search = _wiki_get(search_url)
        if not search:
            continue
        hits = ((search.get("query") or {}).get("search")) or []
        if not isinstance(hits, list) or not hits:
            continue
        for hit in hits:
            if not isinstance(hit, dict):
                continue
            page_title = str(hit.get("title") or "")
            if not page_title:
                continue
            lower = page_title.lower()
            if "soundtrack" in lower or "album" in lower:
                continue
            summary_url = (
                "https://en.wikipedia.org/api/rest_v1/page/summary/"
                + urllib.parse.quote(page_title.replace(" ", "_"), safe="")
            )
            summary = _wiki_get(summary_url)
            if not summary:
                continue
            extract = str(summary.get("extract") or "").strip()
            if len(extract) < 40:
                continue
            thumb = summary.get("thumbnail") if isinstance(summary.get("thumbnail"), dict) else {}
            original = (
                summary.get("originalimage") if isinstance(summary.get("originalimage"), dict) else {}
            )
            poster_url = str(original.get("source") or thumb.get("source") or "").strip()
            return {
                "title": str(summary.get("title") or page_title),
                "extract": extract[:6000],
                "url": str(
                    ((summary.get("content_urls") or {}).get("desktop") or {}).get("page") or ""
                ),
                "description": str(summary.get("description") or ""),
                "posterUrl": poster_url,
            }
    return None


def _theme_present(scan: dict[str, Any] | None, theme_id: str) -> bool:
    if not scan or not isinstance(scan.get("themes"), list):
        return False
    for row in scan["themes"]:
        if isinstance(row, dict) and row.get("id") == theme_id and row.get("present"):
            return True
    return False


def _poster_allowed(hand: dict[str, Any] | None, scan: dict[str, Any] | None) -> bool:
    """Show Wikipedia posters unless fanservice/adult_sexual is flagged (or hand says no)."""
    if hand is not None and "poster_ok" in hand:
        return bool(hand.get("poster_ok"))
    if _theme_present(scan, "adult_sexual"):
        return False
    return True


def _attach_poster(
    payload: dict[str, Any],
    wiki: dict[str, Any] | None,
    hand: dict[str, Any] | None,
    scan: dict[str, Any] | None,
) -> dict[str, Any]:
    poster_url = ""
    if wiki and wiki.get("posterUrl"):
        poster_url = str(wiki.get("posterUrl") or "")
    allowed = _poster_allowed(hand, scan)
    payload["posterUrl"] = poster_url if allowed and poster_url else ""
    payload["posterShown"] = bool(payload["posterUrl"])
    payload["posterHiddenReason"] = (
        ""
        if payload["posterShown"]
        else ("fanservice_or_adult" if poster_url and not allowed else "no_wikipedia_image")
    )
    return payload


def flickcheck(title: str, year: str = "", synopsis: str = "") -> dict[str, Any]:
    title = (title or "").strip()[:200]
    year = (year or "").strip()[:10]
    synopsis = (synopsis or "").strip()[:12000]
    if not title:
        return {"ok": False, "error": "title_required"}

    cache_key = CACHE_VERSION + "|" + _normalize_key(title, year) + "|" + str(hash(synopsis[:500]))
    cached = _cache_get(cache_key) or _disk_get(cache_key)
    if cached:
        return cached

    vetted = _load_vetted()
    hand = vetted.get(_normalize_key(title, year)) or vetted.get(_normalize_key(title, ""))
    wiki = _wikipedia_summary(title, year)
    synopsis_source = "user"
    text = synopsis
    if not text and wiki and wiki.get("extract"):
        text = str(wiki["extract"])
        synopsis_source = "wikipedia"

    if hand:
        payload = {
            "ok": True,
            "title": title,
            "year": year,
            "handVetted": True,
            "handNote": str(hand.get("note") or ""),
            "recOk": bool(hand.get("rec_ok")),
            "recStatus": "hand_vetted",
            "synopsisSource": synopsis_source if text else "none",
            "synopsisText": text[:4000] if text else "",
            "trailerUrl": _trailer_url_from_hand(hand),
            "wikipedia": wiki,
            "aiScan": {
                "ok": True,
                "skipped": True,
                "summary": "Hand-vetted note wins over automated scan.",
                "themes": [],
                "problem_notes": [],
                "rec_hint": "likely_ok" if hand.get("rec_ok") else "likely_no_recommend",
            },
        }
        _attach_poster(payload, wiki, hand, None)
        # Prefer stored hand poster when Wikipedia miss
        if not payload.get("posterUrl"):
            stored = str(hand.get("poster_url") or hand.get("posterUrl") or "").strip()
            if stored.startswith("http") and _poster_allowed(hand, None):
                payload["posterUrl"] = stored[:800]
                payload["posterShown"] = True
                payload["posterHiddenReason"] = ""
        _cache_put(cache_key, payload)
        _disk_put(cache_key, payload)
        return payload

    if not text:
        payload = {
            "ok": True,
            "title": title,
            "year": year,
            "handVetted": False,
            "recOk": False,
            "recStatus": "unknown",
            "synopsisSource": "none",
            "synopsisText": "",
            "trailerUrl": "",
            "wikipedia": wiki,
            "aiScan": {"ok": False, "error": "no_synopsis"},
        }
        _attach_poster(payload, wiki, None, None)
        return payload

    scan = scan_synopsis(title, year, text)
    rec_hint = str(scan.get("rec_hint") or "caution") if scan.get("ok") else "caution"
    rec_ok = bool(scan.get("ok")) and rec_hint == "likely_ok"
    payload = {
        "ok": True,
        "title": title,
        "year": year,
        "handVetted": False,
        "handNote": "",
        "recOk": rec_ok,
        "recStatus": rec_hint if scan.get("ok") else "unknown",
        "synopsisSource": synopsis_source,
        "synopsisText": text[:4000],
        "trailerUrl": "",
        "wikipedia": wiki,
        "aiScan": scan,
    }
    _attach_poster(payload, wiki, None, scan if scan.get("ok") else None)
    if scan.get("ok"):
        _cache_put(cache_key, payload)
        _disk_put(cache_key, payload)
    return payload


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        return

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        if path in ("/api/health", "/health"):
            _json_response(self, 200, {"ok": True, "service": "halalflicks"})
            return
        if path in ("/api/recommend/catalog", "/recommend/catalog", "/api/recommend", "/recommend"):
            qs = urllib.parse.parse_qs(parsed.query)
            theme = (qs.get("theme") or [""])[0]
            _json_response(self, 200, recommend_catalog(theme))
            return
        _json_response(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        data = _read_json(self)
        try:
            if path in ("/api/flickcheck", "/flickcheck"):
                payload = flickcheck(
                    str(data.get("title") or ""),
                    str(data.get("year") or ""),
                    str(data.get("synopsis") or ""),
                )
                code = 200 if payload.get("ok") or payload.get("error") == "title_required" else 500
                if payload.get("error") == "title_required":
                    code = 400
                _json_response(self, code, payload)
                return
        except Exception as exc:  # noqa: BLE001 — keep API alive
            _json_response(self, 500, {"ok": False, "error": "server_error", "detail": str(exc)[:200]})
            return
        _json_response(self, 404, {"ok": False, "error": "not_found"})


def main() -> None:
    FLICKCHECK_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((BIND, PORT), Handler)
    print(f"HalalFlicks API on http://{BIND}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
