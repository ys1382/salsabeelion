#!/usr/bin/env python3
"""Fill hand_vetted trailer_url (YouTube RT trailers) + poster_url (Wikipedia).

Uses YouTube search via yt-dlp and Wikipedia REST only — no Rotten Tomatoes site.
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VETTED_PATH = ROOT / "config" / "hand_vetted.json"
WIKI_UA = "HalalFlicks/0.1 (Odd Trove; media fill script; owner-beta)"

# Channels that host RT / Movieclips trailers on YouTube
RT_CHANNEL_HINTS = (
    "rotten tomatoes",
    "movieclips",
)


def _norm_tokens(s: str) -> list[str]:
    s = re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()
    stop = {"the", "a", "an", "of", "and", "film", "movie"}
    return [t for t in s.split() if t and t not in stop]


def _wiki_poster(title: str, year: str) -> str:
    queries = []
    t = (title or "").strip()
    y = (year or "").strip()
    if not t:
        return ""
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
        try:
            req = urllib.request.Request(search_url, headers={"User-Agent": WIKI_UA})
            with urllib.request.urlopen(req, timeout=12) as resp:
                search = json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
            continue
        hits = ((search.get("query") or {}).get("search")) or []
        if not isinstance(hits, list):
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
            try:
                req = urllib.request.Request(summary_url, headers={"User-Agent": WIKI_UA})
                with urllib.request.urlopen(req, timeout=12) as resp:
                    summary = json.loads(resp.read().decode("utf-8"))
            except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
                continue
            if not isinstance(summary, dict):
                continue
            extract = str(summary.get("extract") or "").strip()
            if len(extract) < 40:
                continue
            thumb = summary.get("thumbnail") if isinstance(summary.get("thumbnail"), dict) else {}
            original = (
                summary.get("originalimage") if isinstance(summary.get("originalimage"), dict) else {}
            )
            poster = str(original.get("source") or thumb.get("source") or "").strip()
            if poster.startswith("http"):
                return poster
    return ""


def _yt_search(query: str, limit: int = 8) -> list[dict]:
    from yt_dlp import YoutubeDL

    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": True,
    }
    rows: list[dict] = []
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)
    for e in (info or {}).get("entries") or []:
        if not isinstance(e, dict):
            continue
        vid = str(e.get("id") or "").strip()
        if not vid:
            continue
        rows.append(
            {
                "id": vid,
                "title": str(e.get("title") or ""),
                "channel": str(e.get("channel") or e.get("uploader") or ""),
            }
        )
    return rows


def _is_rt_channel(channel: str) -> bool:
    c = (channel or "").lower()
    return any(h in c for h in RT_CHANNEL_HINTS)


def _title_match_score(movie_title: str, year: str, video_title: str) -> int:
    """Higher is better; 0 = reject."""
    mt = (movie_title or "").lower().strip()
    vt = (video_title or "").lower()
    tokens = _norm_tokens(movie_title)
    if not tokens:
        return 0
    hits = sum(1 for tok in tokens if tok in vt)
    if hits < max(1, len(tokens) - (1 if len(tokens) > 2 else 0)):
        return 0
    # Reject wrong sequels when movie title has no trailing number
    if not re.search(r"\d", mt):
        for n in range(2, 7):
            if re.search(rf"{re.escape(mt)}\s*{n}\b", vt):
                return 0
            if re.search(rf"{re.escape(mt)}\s+ii+\b", vt) and n == 2:
                return 0
    score = 10 + hits
    y = (year or "").strip()
    if y and y in vt:
        score += 20
    elif y:
        score -= 5
    if "trailer" in vt:
        score += 5
    if "teaser" in vt:
        score += 2
    return score


def pick_rt_trailer(title: str, year: str) -> str | None:
    queries = [
        f"{title} {year} Rotten Tomatoes Trailer".strip(),
        f"{title} ({year}) Trailer Rotten Tomatoes".strip(),
        f"{title} Rotten Tomatoes Classic Trailer".strip(),
    ]
    best: tuple[int, str] | None = None
    for q in queries:
        try:
            rows = _yt_search(q, limit=8)
        except Exception as exc:  # noqa: BLE001
            print(f"  yt search fail ({title}): {exc}", file=sys.stderr)
            continue
        for row in rows:
            if not _is_rt_channel(row["channel"]):
                continue
            score = _title_match_score(title, year, row["title"])
            if score <= 0:
                continue
            url = f"https://www.youtube.com/watch?v={row['id']}"
            if best is None or score > best[0]:
                best = (score, url)
        if best and best[0] >= 25:
            break
        time.sleep(0.4)
    return best[1] if best else None


def main() -> None:
    data = json.loads(VETTED_PATH.read_text(encoding="utf-8"))
    movies = data.get("movies")
    if not isinstance(movies, list):
        raise SystemExit("bad hand_vetted.json")

    missing_trailer: list[str] = []
    filled_trailer = 0
    filled_poster = 0

    for i, row in enumerate(movies):
        if not isinstance(row, dict):
            continue
        title = str(row.get("title") or "").strip()
        year = str(row.get("year") or "").strip()
        label = f"{title} ({year})" if year else title
        print(f"[{i + 1}/{len(movies)}] {label}", flush=True)

        if not str(row.get("poster_url") or "").strip():
            poster = _wiki_poster(title, year)
            if poster:
                row["poster_url"] = poster
                filled_poster += 1
                print(f"  poster ok", flush=True)
            else:
                print(f"  poster miss", flush=True)
            time.sleep(0.25)

        if not str(row.get("trailer_url") or "").strip():
            url = pick_rt_trailer(title, year)
            if url:
                row["trailer_url"] = url
                filled_trailer += 1
                print(f"  trailer {url}", flush=True)
            else:
                missing_trailer.append(label)
                print(f"  trailer miss", flush=True)
            time.sleep(0.5)
        else:
            print(f"  trailer kept", flush=True)

        # Checkpoint every 10
        if (i + 1) % 10 == 0:
            VETTED_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    VETTED_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("\nDone.")
    print(f"New posters: {filled_poster}")
    print(f"New trailers: {filled_trailer}")
    print(f"Missing RT YouTube trailer ({len(missing_trailer)}):")
    for m in missing_trailer:
        print(f"  - {m}")


if __name__ == "__main__":
    main()
