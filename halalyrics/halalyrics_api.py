#!/usr/bin/env python3
"""HalaLyrics — Songcheck API (LRCLIB lyrics + Gemini scan)."""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from typing import Any

from halalyrics_scan import scan_lyrics, scan_lyrics_stream

PORT = int(os.environ.get("HALALYRICS_API_PORT", "8084"))
BIND = os.environ.get("HALALYRICS_API_BIND", "127.0.0.1")
_SCRIPT_DIR = Path(__file__).resolve().parent
VETTED_PATH = Path(os.environ.get("HALALYRICS_VETTED_PATH", _SCRIPT_DIR / "config" / "hand_vetted.json"))
REC_CATALOG_PATH = Path(
    os.environ.get("HALALYRICS_REC_CATALOG_PATH", _SCRIPT_DIR / "config" / "rec_catalog.json")
)

LRCLIB_UA = "HalaLyrics/0.1 (Odd Trove; https://oddtrove.art/halalyrics/)"
_NETWORK_ERRORS = (urllib.error.URLError, TimeoutError, OSError)
LRCLIB_TIMEOUT = int(os.environ.get("HALALYRICS_LRCLIB_TIMEOUT", "8"))
SCAN_CACHE_VERSION = "20260709speed"
LRCLIB_CACHE_DIR = Path(
    os.environ.get("HALALYRICS_LRCLIB_CACHE_DIR", _SCRIPT_DIR / "cache" / "lrclib")
)
SONGCHECK_CACHE_DIR = Path(
    os.environ.get("HALALYRICS_SONGCHECK_CACHE_DIR", _SCRIPT_DIR / "cache" / "songcheck")
)
LRCLIB_CACHE_TTL = int(os.environ.get("HALALYRICS_LRCLIB_CACHE_TTL", "604800"))
_SONGCHECK_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_LOCK = Lock()
_CACHE_TTL = int(os.environ.get("HALALYRICS_CACHE_TTL", "3600"))
_CACHE_MAX = 200


def _json_response(handler: BaseHTTPRequestHandler, code: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def _sse_begin(handler: BaseHTTPRequestHandler, code: int = 200) -> None:
    handler.send_response(code)
    handler.send_header("Content-Type", "text/event-stream; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Connection", "close")
    handler.send_header("X-Accel-Buffering", "no")
    handler.end_headers()


def _sse_event(handler: BaseHTTPRequestHandler, event: str, payload: dict[str, Any]) -> None:
    data = json.dumps(payload, ensure_ascii=False)
    handler.wfile.write(f"event: {event}\ndata: {data}\n\n".encode("utf-8"))
    handler.wfile.flush()


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


def _normalize_key(title: str, artist: str) -> str:
    def norm(s: str) -> str:
        s = re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()
        return re.sub(r"\s+", " ", s)

    return norm(title) + "|" + norm(artist)


def _load_vetted() -> dict[str, dict[str, Any]]:
    if not VETTED_PATH.is_file():
        return {}
    try:
        data = json.loads(VETTED_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    rows = data.get("songs") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        title = str(row.get("title") or "")
        artist = str(row.get("artist") or "")
        key = str(row.get("key") or "") or _normalize_key(title, artist)
        if key:
            out[key] = row
    return out


def _load_rec_catalog() -> list[dict[str, Any]]:
    if not REC_CATALOG_PATH.is_file():
        return []
    try:
        data = json.loads(REC_CATALOG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    rows = data.get("songs") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return []
    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        title = str(row.get("title") or "").strip()
        if not title:
            continue
        themes_raw = row.get("themes") or []
        themes = (
            [str(t).strip().lower() for t in themes_raw if str(t).strip()]
            if isinstance(themes_raw, list)
            else []
        )
        out.append(
            {
                "title": title,
                "artist": str(row.get("artist") or "").strip(),
                "note": str(row.get("note") or "").strip(),
                "themes": themes,
            }
        )
    return out


def _theme_query_tokens(q: str) -> list[str]:
    raw = re.sub(r"[^a-z0-9]+", " ", (q or "").lower()).strip()
    if not raw:
        return []
    return [t for t in raw.split() if len(t) > 1]


def _song_search_blob(song: dict[str, Any]) -> str:
    parts = [
        str(song.get("title") or ""),
        str(song.get("artist") or ""),
        str(song.get("note") or ""),
        " ".join(song.get("themes") or []),
    ]
    return re.sub(r"[^a-z0-9]+", " ", " ".join(parts).lower())


def recommend_catalog(theme: str = "") -> dict[str, Any]:
    songs = _load_rec_catalog()
    tokens = _theme_query_tokens(theme)
    if not tokens:
        return {"ok": True, "count": len(songs), "theme": "", "songs": songs}

    scored: list[tuple[int, dict[str, Any]]] = []
    for song in songs:
        blob = _song_search_blob(song)
        theme_set = set(song.get("themes") or [])
        score = 0
        for tok in tokens:
            if tok in theme_set:
                score += 3
            if tok in blob:
                score += 1
        if score > 0:
            scored.append((score, song))
    scored.sort(key=lambda pair: (-pair[0], pair[1].get("title") or ""))
    matched = [s for _, s in scored]
    return {"ok": True, "count": len(matched), "theme": theme.strip(), "songs": matched}


def _songcheck_disk_path(key: str) -> Path:
    safe = re.sub(r"[^a-z0-9]+", "_", key).strip("_")[:120] or "unknown"
    return SONGCHECK_CACHE_DIR / f"{safe}.json"


def _songcheck_disk_get(key: str) -> dict[str, Any] | None:
    path = _songcheck_disk_path(key)
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    fetched_at = float(data.get("fetched_at") or 0)
    if time.time() - fetched_at > _CACHE_TTL:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
        return None
    payload = data.get("payload")
    return json.loads(json.dumps(payload)) if isinstance(payload, dict) else None


def _songcheck_disk_put(key: str, payload: dict[str, Any]) -> None:
    try:
        SONGCHECK_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        disk_payload = {"fetched_at": time.time(), "payload": payload}
        _songcheck_disk_path(key).write_text(json.dumps(disk_payload), encoding="utf-8")
    except OSError:
        return


def _songcheck_cache_get(key: str) -> dict[str, Any] | None:
    with _CACHE_LOCK:
        row = _SONGCHECK_CACHE.get(key)
        if row:
            if time.time() - row[0] > _CACHE_TTL:
                del _SONGCHECK_CACHE[key]
            else:
                return json.loads(json.dumps(row[1]))
    disk = _songcheck_disk_get(key)
    if disk is not None:
        with _CACHE_LOCK:
            _SONGCHECK_CACHE[key] = (time.time(), json.loads(json.dumps(disk)))
    return disk


def _songcheck_cache_put(key: str, payload: dict[str, Any]) -> None:
    if payload.get("error") in ("lrclib_error", "server_error"):
        return
    copy = json.loads(json.dumps(payload))
    with _CACHE_LOCK:
        if len(_SONGCHECK_CACHE) >= _CACHE_MAX:
            oldest = min(_SONGCHECK_CACHE, key=lambda k: _SONGCHECK_CACHE[k][0])
            del _SONGCHECK_CACHE[oldest]
        _SONGCHECK_CACHE[key] = (time.time(), copy)
    _songcheck_disk_put(key, copy)


def _lrclib_cache_path(key: str) -> Path:
    safe = re.sub(r"[^a-z0-9]+", "_", key).strip("_")[:120] or "unknown"
    return LRCLIB_CACHE_DIR / f"{safe}.json"


def _lrclib_cache_get(key: str) -> dict[str, Any] | None:
    path = _lrclib_cache_path(key)
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    fetched_at = float(data.get("fetched_at") or 0)
    if time.time() - fetched_at > LRCLIB_CACHE_TTL:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
        return None
    return data


def _lrclib_cache_put(key: str, row: dict[str, Any] | None) -> None:
    try:
        LRCLIB_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        payload = {"fetched_at": time.time(), "row": row}
        _lrclib_cache_path(key).write_text(json.dumps(payload), encoding="utf-8")
    except OSError:
        return


def _lrclib_row_payload(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    return {
        "trackName": str(row.get("trackName") or ""),
        "artistName": str(row.get("artistName") or ""),
        "albumName": str(row.get("albumName") or ""),
        "plainLyrics": _plain_lyrics(row),
        "id": row.get("id"),
    }


def _lrclib_row_from_cache(data: dict[str, Any]) -> dict[str, Any] | None:
    row = data.get("row")
    if not isinstance(row, dict):
        return None
    if row.get("plainLyrics"):
        row = dict(row)
        row["plainLyrics"] = str(row["plainLyrics"])
        if not row.get("syncedLyrics"):
            row["syncedLyrics"] = ""
    return row


def _lrclib_search(query: str) -> tuple[list[dict[str, Any]], bool]:
    params = urllib.parse.urlencode({"q": query})
    url = f"https://lrclib.net/api/search?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": LRCLIB_UA}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=LRCLIB_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except _NETWORK_ERRORS:
        return [], True
    except json.JSONDecodeError:
        return [], False
    if not isinstance(data, list):
        return [], False
    return [r for r in data if isinstance(r, dict)], False


def _lrclib_search_fields(track_name: str, artist_name: str = "") -> tuple[list[dict[str, Any]], bool]:
    track_name = (track_name or "").strip()
    artist_name = (artist_name or "").strip()
    if not track_name:
        return [], False
    params: dict[str, str] = {"track_name": track_name}
    if artist_name:
        params["artist_name"] = artist_name
    url = f"https://lrclib.net/api/search?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": LRCLIB_UA}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=LRCLIB_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except _NETWORK_ERRORS:
        return [], True
    except json.JSONDecodeError:
        return [], False
    if not isinstance(data, list):
        return [], False
    return [r for r in data if isinstance(r, dict)], False


def _plain_lyrics(row: dict[str, Any]) -> str:
    text = str(row.get("plainLyrics") or row.get("syncedLyrics") or "").strip()
    if text and row.get("syncedLyrics") and not row.get("plainLyrics"):
        text = re.sub(r"\[\d{2}:\d{2}\.\d{2,3}\]", "", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


def _has_lyrics(row: dict[str, Any]) -> bool:
    return bool(_plain_lyrics(row))


def _norm_title(title: str) -> str:
    return _normalize_key(title, "").rstrip("|")


def _title_matches(want_title: str, track_name: str) -> bool:
    got = _norm_title(track_name)
    if not want_title or not got:
        return False
    if got == want_title:
        return True
    if got.startswith(want_title + " ") or got.startswith(want_title + "-"):
        return True
    return False


def _artist_matches(want_artist: str, artist_name: str) -> bool:
    want = re.sub(r"[^a-z0-9]+", " ", (want_artist or "").lower()).strip()
    got = re.sub(r"[^a-z0-9]+", " ", (artist_name or "").lower()).strip()
    if not want:
        return True
    if not got:
        return False
    if got == want or want in got or got in want:
        return True
    want_tokens = [t for t in want.split() if len(t) > 2]
    if not want_tokens:
        return False
    overlap = sum(1 for t in want_tokens if t in got)
    return overlap >= min(2, len(want_tokens))


def _pick_best_track(hits: list[dict[str, Any]], title: str, artist: str) -> dict[str, Any] | None:
    if not hits:
        return None

    want_key = _normalize_key(title, artist)
    want_title = _norm_title(title)

    for row in hits:
        track = str(row.get("trackName") or "")
        row_artist = str(row.get("artistName") or "")
        if _normalize_key(track, row_artist) == want_key:
            return row

    for row in hits:
        if _title_matches(want_title, str(row.get("trackName") or "")) and _artist_matches(
            artist, str(row.get("artistName") or "")
        ):
            return row

    for row in hits:
        if _title_matches(want_title, str(row.get("trackName") or "")):
            return row

    return None


def _pick_best_hit(hits: list[dict[str, Any]], title: str, artist: str) -> dict[str, Any] | None:
    with_lyrics = [r for r in hits if _has_lyrics(r)]
    if not with_lyrics:
        return None

    want_key = _normalize_key(title, artist)
    want_title = _norm_title(title)

    for row in with_lyrics:
        track = str(row.get("trackName") or "")
        row_artist = str(row.get("artistName") or "")
        if _normalize_key(track, row_artist) == want_key:
            return row

    for row in with_lyrics:
        if _title_matches(want_title, str(row.get("trackName") or "")) and _artist_matches(
            artist, str(row.get("artistName") or "")
        ):
            return row

    for row in with_lyrics:
        if _title_matches(want_title, str(row.get("trackName") or "")):
            return row

    return with_lyrics[0]


def _merge_hits(*groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[Any] = set()
    for group in groups:
        for row in group:
            rid = row.get("id")
            token = rid if rid is not None else id(row)
            if token in seen:
                continue
            seen.add(token)
            out.append(row)
    return out


def _lrclib_phase(title: str, artist: str) -> tuple[list[dict[str, Any]], bool]:
    """Run field search and free-text search in parallel, then merge."""
    network_failed = False
    query = f"{title} {artist}".strip()
    with ThreadPoolExecutor(max_workers=2) as pool:
        fields_future = pool.submit(_lrclib_search_fields, title, artist)
        query_future = pool.submit(_lrclib_search, query) if query else None
        fields_hits, nf1 = fields_future.result()
        network_failed = network_failed or nf1
        q_hits: list[dict[str, Any]] = []
        if query_future is not None:
            q_hits, nf2 = query_future.result()
            network_failed = network_failed or nf2
    return _merge_hits(fields_hits, q_hits), network_failed


def _lrclib_best(title: str, artist: str) -> tuple[dict[str, Any] | None, bool]:
    title = (title or "").strip()
    artist = (artist or "").strip()
    if not title:
        return None, False

    cache_key = _normalize_key(title, artist)
    cached = _lrclib_cache_get(cache_key)
    if cached is not None:
        row = _lrclib_row_from_cache(cached)
        if row is not None:
            return row, False

    network_failed = False
    hits, nf1 = _lrclib_phase(title, artist)
    network_failed = network_failed or nf1
    best = _pick_best_hit(hits, title, artist)
    if best:
        _lrclib_cache_put(cache_key, _lrclib_row_payload(best))
        return best, False

    if artist:
        hits2, nf2 = _lrclib_phase(title, "")
        network_failed = network_failed or nf2
        hits = _merge_hits(hits, hits2)
        best = _pick_best_hit(hits, title, artist)
        if best:
            _lrclib_cache_put(cache_key, _lrclib_row_payload(best))
            return best, False

    if not hits and network_failed:
        return None, True
    track = _pick_best_track(hits, title, artist)
    if track and not _has_lyrics(track):
        _lrclib_cache_put(cache_key, _lrclib_row_payload(track))
        return track, False
    return None, False


def _clip_lyrics(text: str, limit: int = 12000) -> str:
    clipped = (text or "").strip()
    if len(clipped) > limit:
        return clipped[:limit] + "\n…[truncated]"
    return clipped


def _should_show_lyrics(hand: dict[str, Any] | None, rec_hint: str) -> bool:
    if hand:
        return bool(hand.get("rec_ok"))
    return rec_hint in ("likely_ok", "caution")


def _finish_songcheck(cache_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    _songcheck_cache_put(cache_key, payload)
    return payload


def _lrclib_info(row: dict[str, Any] | None) -> dict[str, str] | None:
    if not row:
        return None
    return {
        "trackName": str(row.get("trackName") or ""),
        "artistName": str(row.get("artistName") or ""),
        "albumName": str(row.get("albumName") or ""),
    }


def _apply_scan_meta(
    result: dict[str, Any],
    hand: dict[str, Any] | None,
    lyrics: str,
) -> dict[str, Any]:
    rec_hint = "caution"
    if hand:
        result["recStatus"] = "hand_vetted"
        result["recOk"] = bool(hand.get("rec_ok"))
        result["handNote"] = str(hand.get("note") or "")
        if result.get("aiScan", {}).get("ok"):
            rec_hint = str(result["aiScan"].get("rec_hint") or "caution")
    elif result.get("aiScan", {}).get("ok"):
        rec_hint = str(result["aiScan"].get("rec_hint") or "caution")
        result["recStatus"] = "ai_hint"
        result["recOk"] = rec_hint == "likely_ok"
    else:
        result["recStatus"] = "unknown"
        result["recOk"] = False

    if _should_show_lyrics(hand, rec_hint):
        result["lyricsText"] = _clip_lyrics(lyrics)
    return result


def lookup_song(title: str, artist: str) -> dict[str, Any]:
    title = (title or "").strip()[:200]
    artist = (artist or "").strip()[:200]
    if not title:
        return {"ok": False, "error": "title_required"}

    cache_key = f"{SCAN_CACHE_VERSION}|{_normalize_key(title, artist)}"
    cached = _songcheck_cache_get(cache_key)
    if cached is not None:
        return {"ok": True, "cached": True, "full": cached}

    vetted_map = _load_vetted()
    hand = vetted_map.get(_normalize_key(title, artist))

    try:
        lrclib_row, lrclib_network_failed = _lrclib_best(title, artist)
    except _NETWORK_ERRORS as exc:
        return {
            "ok": False,
            "error": "lrclib_error",
            "detail": str(exc.reason) if hasattr(exc, "reason") else str(exc),
            "handVetted": hand,
        }
    if lrclib_network_failed and not lrclib_row:
        return {
            "ok": False,
            "error": "lrclib_error",
            "detail": "Lyrics lookup timed out or failed",
            "handVetted": hand,
        }

    lyrics = _plain_lyrics(lrclib_row) if lrclib_row else ""
    if not lyrics:
        lrclib_match = lrclib_row and _pick_best_track([lrclib_row], title, artist) is not None
        if lrclib_match and lrclib_row:
            instrumental: dict[str, Any] = {
                "ok": True,
                "instrumental": True,
                "title": title,
                "artist": artist,
                "lyricsSource": "none",
                "lyricsFound": False,
                "handVetted": hand,
                "recStatus": "instrumental",
                "recOk": False,
                "lrclib": _lrclib_info(lrclib_row),
                "aiScan": {"ok": False, "error": "instrumental"},
            }
            if hand:
                instrumental["handNote"] = str(hand.get("note") or "")
                instrumental["recOk"] = bool(hand.get("rec_ok"))
                instrumental["recStatus"] = "hand_vetted"
            return _finish_songcheck(cache_key, instrumental)
        payload = {
            "ok": False,
            "error": "no_lyrics",
            "title": title,
            "artist": artist,
            "lyricsSource": "none",
            "lyricsFound": False,
            "handVetted": hand,
            "lrclib": None,
        }
        if hand:
            payload["handNote"] = str(hand.get("note") or "")
            payload["recOk"] = bool(hand.get("rec_ok"))
        return payload

    return {
        "ok": True,
        "title": title,
        "artist": artist,
        "lyricsSource": "lrclib",
        "lyricsFound": True,
        "lyricsText": lyrics,
        "handVetted": hand,
        "lrclib": _lrclib_info(lrclib_row),
    }


def scan_song(
    title: str,
    artist: str,
    lyrics: str,
    hand: dict[str, Any] | None = None,
) -> dict[str, Any]:
    title = (title or "").strip()[:200]
    artist = (artist or "").strip()[:200]
    lyrics = (lyrics or "").strip()
    if not title:
        return {"ok": False, "error": "title_required"}
    if not lyrics:
        return {"ok": False, "error": "no_lyrics"}

    if hand is None:
        hand = _load_vetted().get(_normalize_key(title, artist))

    result: dict[str, Any] = {
        "ok": True,
        "title": title,
        "artist": artist,
        "lyricsSource": "lrclib",
        "lyricsFound": True,
        "handVetted": hand,
        "aiScan": scan_lyrics(title, artist, lyrics),
    }
    return _apply_scan_meta(result, hand, lyrics)


def scan_song_stream(
    handler: BaseHTTPRequestHandler,
    title: str,
    artist: str,
    lyrics: str,
    hand: dict[str, Any] | None = None,
    lrclib: dict[str, Any] | None = None,
) -> None:
    title = (title or "").strip()[:200]
    artist = (artist or "").strip()[:200]
    lyrics = (lyrics or "").strip()
    if not title:
        _sse_begin(handler, 400)
        _sse_event(handler, "error", {"ok": False, "error": "title_required"})
        return
    if not lyrics:
        _sse_begin(handler, 400)
        _sse_event(handler, "error", {"ok": False, "error": "no_lyrics"})
        return

    if hand is None:
        hand = _load_vetted().get(_normalize_key(title, artist))

    _sse_begin(handler, 200)
    try:
        for event, payload in scan_lyrics_stream(title, artist, lyrics):
            _sse_event(handler, event, payload)
            if event == "error":
                return
            if event == "done":
                result: dict[str, Any] = {
                    "ok": True,
                    "title": title,
                    "artist": artist,
                    "lyricsSource": "lrclib",
                    "lyricsFound": True,
                    "handVetted": hand,
                    "aiScan": payload,
                }
                _apply_scan_meta(result, hand, lyrics)
                cache_key = f"{SCAN_CACHE_VERSION}|{_normalize_key(title, artist)}"
                full = dict(result)
                full["lrclib"] = lrclib
                _finish_songcheck(cache_key, full)
                _sse_event(
                    handler,
                    "result",
                    {
                        "recOk": result.get("recOk"),
                        "recStatus": result.get("recStatus"),
                        "handNote": result.get("handNote"),
                        "lyricsText": result.get("lyricsText"),
                        "aiScan": result.get("aiScan"),
                    },
                )
    except Exception as exc:  # noqa: BLE001
        _sse_event(handler, "error", {"ok": False, "error": "server_error", "detail": str(exc)[:300]})


def songcheck(title: str, artist: str) -> dict[str, Any]:
    title = (title or "").strip()[:200]
    artist = (artist or "").strip()[:200]
    if not title:
        return {"ok": False, "error": "title_required"}

    cache_key = f"{SCAN_CACHE_VERSION}|{_normalize_key(title, artist)}"
    cached = _songcheck_cache_get(cache_key)
    if cached is not None:
        return cached

    lookup = lookup_song(title, artist)
    if lookup.get("cached") and lookup.get("full"):
        return lookup["full"]
    if not lookup.get("ok"):
        if lookup.get("error") in ("no_lyrics",) and not lookup.get("instrumental"):
            return _finish_songcheck(cache_key, lookup)
        return lookup

    if lookup.get("instrumental"):
        instrumental = {
            "ok": True,
            "instrumental": True,
            "title": title,
            "artist": artist,
            "lyricsSource": "none",
            "lyricsFound": False,
            "handVetted": lookup.get("handVetted"),
            "recStatus": "instrumental",
            "recOk": bool((lookup.get("handVetted") or {}).get("rec_ok")) if lookup.get("handNote") else False,
            "lrclib": lookup.get("lrclib"),
            "aiScan": {"ok": False, "error": "instrumental"},
        }
        if lookup.get("handNote"):
            instrumental["handNote"] = lookup["handNote"]
            instrumental["recOk"] = bool(lookup.get("recOk"))
            instrumental["recStatus"] = "hand_vetted"
        return _finish_songcheck(cache_key, instrumental)

    hand = lookup.get("handVetted")
    scanned = scan_song(title, artist, str(lookup.get("lyricsText") or ""), hand)
    result = dict(scanned)
    result["lrclib"] = lookup.get("lrclib")
    return _finish_songcheck(cache_key, result)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        return

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path in ("/api/health", "/health"):
            _json_response(
                self,
                200,
                {
                    "ok": True,
                    "service": "halalyrics",
                    "geminiConfigured": bool(
                        os.environ.get("HALALYRICS_GEMINI_API_KEY")
                        or os.environ.get("HALALIT_GEMINI_API_KEY")
                        or os.environ.get("GEMINI_API_KEY")
                    ),
                },
            )
            return
        if path in ("/api/recommend/catalog", "/recommend/catalog", "/api/recommend", "/recommend"):
            qs = urllib.parse.parse_qs(parsed.query or "")
            theme = str((qs.get("theme") or [""])[0] or "")
            payload = recommend_catalog(theme)
            _json_response(self, 200, payload)
            return
        _json_response(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        data = _read_json(self)
        title = str(data.get("title") or "")
        artist = str(data.get("artist") or "")
        try:
            if path in ("/api/songcheck/lookup", "/songcheck/lookup"):
                payload = lookup_song(title, artist)
                _json_response(self, 200 if payload.get("ok") else 400, payload)
                return
            if path in ("/api/songcheck/scan/stream", "/songcheck/scan/stream"):
                lyrics = str(data.get("lyrics") or "")
                hand = data.get("handVetted")
                hand_row = hand if isinstance(hand, dict) else None
                lrclib = data.get("lrclib")
                lrclib_row = lrclib if isinstance(lrclib, dict) else None
                scan_song_stream(self, title, artist, lyrics, hand_row, lrclib_row)
                return
            if path in ("/api/songcheck/scan", "/songcheck/scan"):
                lyrics = str(data.get("lyrics") or "")
                hand = data.get("handVetted")
                hand_row = hand if isinstance(hand, dict) else None
                payload = scan_song(title, artist, lyrics, hand_row)
                _json_response(self, 200 if payload.get("ok") else 400, payload)
                return
            if path in ("/api/songcheck", "/songcheck"):
                payload = songcheck(title, artist)
                _json_response(self, 200 if payload.get("ok") else 400, payload)
                return
            _json_response(self, 404, {"ok": False, "error": "not_found"})
        except Exception as exc:  # noqa: BLE001 — surface owner-beta failures
            _json_response(self, 500, {"ok": False, "error": "server_error", "detail": str(exc)[:300]})


def main() -> None:
    server = ThreadingHTTPServer((BIND, PORT), Handler)
    print(f"HalaLyrics API on http://{BIND}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
