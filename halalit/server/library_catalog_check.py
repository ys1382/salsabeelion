"""
Wishlist library catalog check (practice connectors).

Uses BiblioCommons public gateway JSON (same host the catalog UI calls).
"Yes" = selected branch has a borrowable copy — checked out OK.

Places:
  santa-clara-central-park — City of Santa Clara, branch C
  santa-clara-mission — City of Santa Clara, branch M
  sccld-cupertino — Santa Clara County Library District, Cupertino (CU)
"""
from __future__ import annotations

import json
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

USER_AGENT = "HalalitLibraryCheck/1.0 (Odd Trove; family reading companion; +https://oddtrove.art/halalit/)"

GATEWAY = "https://gateway.bibliocommons.com/v2/libraries"

# placeId → BiblioCommons library + branch filter
PLACES: dict[str, dict[str, Any]] = {
    "santa-clara-central-park": {
        "placeId": "santa-clara-central-park",
        "placeLabel": "Santa Clara Central Park Library",
        "shortLabel": "Central Park",
        "libraryId": "sclibrary",
        "branchCode": "C",
        "branchName": "Central Park Library",
        "branchNameNeedles": ("central park",),
        "catalogHost": "sclibrary.bibliocommons.com",
        # City branch: walk-in / that building only.
        "availabilityScope": "branch",
        "reasonYes": "borrowable_at_central_park",
        "reasonNoBranch": "not_at_central_park",
        "reasonNoBorrow": "central_park_not_borrowable",
    },
    "santa-clara-mission": {
        "placeId": "santa-clara-mission",
        "placeLabel": "Santa Clara Mission Branch Library",
        "shortLabel": "Mission",
        "libraryId": "sclibrary",
        "branchCode": "M",
        "branchName": "Mission Branch",
        "branchNameNeedles": ("mission",),
        "catalogHost": "sclibrary.bibliocommons.com",
        # City branch: walk-in / that building only.
        "availabilityScope": "branch",
        "reasonYes": "borrowable_at_mission",
        "reasonNoBranch": "not_at_mission",
        "reasonNoBorrow": "mission_not_borrowable",
    },
    "sccld-cupertino": {
        "placeId": "sccld-cupertino",
        "placeLabel": "Cupertino Library (Santa Clara County)",
        "shortLabel": "Cupertino",
        "libraryId": "sccl",
        "branchCode": "CU",
        "branchName": "Cupertino Library",
        "branchNameNeedles": ("cupertino",),
        "catalogHost": "sccl.bibliocommons.com",
        # County district: holds move between branches; "yes" = borrowable in SCCLD.
        "availabilityScope": "system",
        "reasonYes": "borrowable_via_cupertino_county",
        "reasonNoBranch": "not_in_sccld_borrowable",
        "reasonNoBorrow": "sccld_not_borrowable",
    },
}
DEFAULT_PLACE_ID = "santa-clara-central-park"

CACHE_TTL_SEC = 15 * 60
CACHE_MAX = 200
RATE_MIN_INTERVAL_SEC = 0.35
SEARCH_TIMEOUT_SEC = 18
AVAIL_TIMEOUT_SEC = 18
MAX_BIBS_TO_PROBE = 5

# Formats we prefer for print borrowing (skip film-only / unrelated packages when possible).
PHYSICAL_BOOK_FORMATS = frozenset(
    {
        "BK",
        "BOOK",
        "BOOKS",
        "PAPERBACK",
        "HARDCOVER",
        "LARGEPRINT",
        "LARGE_PRINT",
        "BOARD_BOOK",
        "PICTURE_BOOK",
    }
)
SKIP_FORMATS = frozenset(
    {
        "DVD",
        "BLU_RAY",
        "VIDEO",
        "MUSIC_CD",
        "MUSIC",
        "GAME",
        "KIT",
        "MAP",
        "PERIODICAL",
        "MAGAZINE",
    }
)

_cache_lock = threading.Lock()
_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_rate_lock = threading.Lock()
_last_bc_fetch = 0.0

_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_STOP = frozenset({"the", "a", "an", "and", "of", "or", "book", "vol", "volume", "bk"})


def _norm_text(s: str) -> str:
    t = str(s or "").strip().lower()
    t = t.replace("'", "").replace("'", "").replace("'", "")
    t = _NON_ALNUM.sub(" ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _tokens(s: str) -> list[str]:
    return [t for t in _norm_text(s).split() if t and t not in _STOP]


def _title_core(title: str) -> str:
    """Normalized title words (no article stopwords), keeping full phrase."""
    return " ".join(_tokens(title))


def _split_series_volume(title: str, series_name: str = "") -> tuple[str, str]:
    """
    Return (series_hint, volume_title).
    Handles "Series: Volume", "Series — Volume", and an explicit seriesName field.
    """
    raw = str(title or "").strip()
    series_hint = str(series_name or "").strip()
    volume = raw
    for sep in (":", "—", "–", " - "):
        if sep in raw:
            left, right = raw.split(sep, 1)
            left, right = left.strip(), right.strip()
            if left and right and len(right) >= 2:
                if not series_hint:
                    series_hint = left
                volume = right
                break
    return series_hint, volume


def _author_core(author: str) -> str:
    a = _norm_text(author)
    if "," in a:
        # "White, E. B." -> keep surname token first for loose contain checks
        parts = [p.strip() for p in a.split(",") if p.strip()]
        if parts:
            a = parts[0] + " " + " ".join(parts[1:])
    a = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", a)
    return re.sub(r"\s+", " ", a).strip()


def _author_surname(author: str) -> str:
    raw = str(author or "").strip()
    a = _norm_text(raw)
    if not a:
        return ""
    # "Paulsen, Gary" → prefer family name before the comma.
    if "," in raw:
        left = _norm_text(raw.split(",", 1)[0])
        toks = [t for t in left.split() if t]
        if toks:
            return toks[-1]
    a = _author_core(author)
    toks = a.split()
    for tok in reversed(toks):
        if len(tok) > 1:
            return tok
    return toks[-1] if toks else ""


def resolve_place(place_id: str | None = None) -> dict[str, Any] | None:
    """Return place config, or None if placeId is unknown (empty → default)."""
    raw = str(place_id or "").strip()
    if not raw:
        return dict(PLACES[DEFAULT_PLACE_ID])
    hit = PLACES.get(raw)
    if hit:
        return dict(hit)
    try:
        from library_place_suggest import all_place_configs

        live = all_place_configs().get(raw)
        return dict(live) if live else None
    except Exception:
        return None


def list_places() -> list[dict[str, str]]:
    """Public place options: seed libraries + reader auto-adds."""
    try:
        from library_place_suggest import public_place_list

        return public_place_list()
    except Exception:
        out: list[dict[str, str]] = []
        for pid in ("santa-clara-central-park", "santa-clara-mission", "sccld-cupertino"):
            p = PLACES[pid]
            out.append(
                {
                    "placeId": str(p["placeId"]),
                    "placeLabel": str(p["placeLabel"]),
                    "shortLabel": str(p["shortLabel"]),
                }
            )
        return out


def _cache_key(
    place_id: str, title: str, author: str, isbn: str, series_name: str = ""
) -> str:
    return "|".join(
        [
            place_id,
            _norm_text(title),
            _norm_text(series_name),
            _author_core(author),
            re.sub(r"[^0-9Xx]", "", isbn or ""),
        ]
    )


def _cache_get(key: str) -> dict[str, Any] | None:
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
        if not hit:
            return None
        ts, payload = hit
        if now - ts > CACHE_TTL_SEC:
            _cache.pop(key, None)
            return None
        return dict(payload)


def _cache_set(key: str, payload: dict[str, Any]) -> None:
    with _cache_lock:
        if len(_cache) >= CACHE_MAX:
            # Drop oldest
            oldest = sorted(_cache.items(), key=lambda kv: kv[1][0])[: max(1, CACHE_MAX // 5)]
            for k, _ in oldest:
                _cache.pop(k, None)
        _cache[key] = (time.time(), dict(payload))


def _rate_wait() -> None:
    global _last_bc_fetch
    with _rate_lock:
        now = time.time()
        wait = RATE_MIN_INTERVAL_SEC - (now - _last_bc_fetch)
        if wait > 0:
            time.sleep(wait)
        _last_bc_fetch = time.time()


def _fetch_json(url: str, timeout: float) -> dict[str, Any]:
    _rate_wait()
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("bc_non_object")
    return data


def catalog_search_url(place: dict[str, Any], title: str, author: str = "") -> str:
    scope = str(place.get("availabilityScope") or "").strip().lower()
    if scope == "open_catalog":
        base = str(place.get("catalogUrl") or "").strip()
        if not base:
            host = str(place.get("catalogHost") or "").strip()
            base = f"https://{host}/" if host else ""
        if not base:
            return ""
        q = title.strip()
        if author.strip():
            q = f"{q} {author.strip()}"
        # CARL Connect and many SPAs use hash search; also try query param for others.
        if "#" in base or "carl" in base.lower() or "catalog." in base.lower():
            root = base.split("#")[0].rstrip("/") + "/"
            return root + "#/search?query=" + urllib.parse.quote(q)
        joiner = "&" if "?" in base else "?"
        return base.rstrip("/") + joiner + urllib.parse.urlencode({"q": q})

    host = str(place.get("catalogHost") or "")
    q = title.strip()
    if author.strip():
        q = f"{q} {author.strip()}"
    params: dict[str, str] = {"query": q, "searchType": "title"}
    branch_filter = _branch_filter_value(place)
    if branch_filter:
        params["f_BRANCH"] = branch_filter
    return f"https://{host}/v2/search?{urllib.parse.urlencode(params)}"


def catalog_record_url(place: dict[str, Any], metadata_id: str) -> str:
    mid = str(metadata_id or "").strip()
    if not mid:
        return catalog_search_url(place, "")
    host = str(place.get("catalogHost") or "")
    url = f"https://{host}/v2/record/{urllib.parse.quote(mid)}"
    branch_filter = _branch_filter_value(place)
    if branch_filter:
        url += "?" + urllib.parse.urlencode({"f_BRANCH": branch_filter})
    return url


def _branch_filter_value(place: dict[str, Any]) -> str:
    """
    Branch-scoped places share a system catalog; append f_BRANCH so
    “Open on library site” lands filtered to that building (e.g. Mission).
    """
    scope = str(place.get("availabilityScope") or "branch").strip().lower()
    if scope != "branch":
        return ""
    return str(place.get("branchName") or "").strip()


def _bib_format(bib: dict[str, Any]) -> str:
    brief = bib.get("briefInfo") if isinstance(bib.get("briefInfo"), dict) else {}
    fmt = brief.get("format") or bib.get("format") or ""
    return str(fmt).strip().upper().replace(" ", "_")


def _bib_title(bib: dict[str, Any]) -> str:
    brief = bib.get("briefInfo") if isinstance(bib.get("briefInfo"), dict) else {}
    return str(brief.get("title") or bib.get("title") or "").strip()


def _bib_authors(bib: dict[str, Any]) -> list[str]:
    brief = bib.get("briefInfo") if isinstance(bib.get("briefInfo"), dict) else {}
    authors = brief.get("authors") or bib.get("authors") or []
    if isinstance(authors, str):
        return [authors]
    if not isinstance(authors, list):
        return []
    out: list[str] = []
    for a in authors:
        if isinstance(a, str) and a.strip():
            out.append(a.strip())
        elif isinstance(a, dict):
            name = str(a.get("name") or a.get("label") or "").strip()
            if name:
                out.append(name)
    return out


def _bib_series_names(bib: dict[str, Any]) -> list[str]:
    brief = bib.get("briefInfo") if isinstance(bib.get("briefInfo"), dict) else {}
    raw = brief.get("series") or bib.get("series") or []
    if isinstance(raw, str):
        return [raw] if raw.strip() else []
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for row in raw:
        if isinstance(row, str) and row.strip():
            out.append(row.strip())
        elif isinstance(row, dict):
            name = str(row.get("name") or row.get("sortName") or "").strip()
            if name:
                out.append(name)
    return out


def _super_formats(bib: dict[str, Any]) -> set[str]:
    brief = bib.get("briefInfo") if isinstance(bib.get("briefInfo"), dict) else {}
    raw = brief.get("superFormats") or []
    if not isinstance(raw, list):
        return set()
    return {str(x).strip().upper() for x in raw if str(x).strip()}


def _is_holdable_policy(bib: dict[str, Any]) -> bool:
    policy = bib.get("policy") if isinstance(bib.get("policy"), dict) else {}
    if "holdable" in policy:
        return bool(policy.get("holdable"))
    return True


def _token_equal(a: list[str], b: list[str]) -> bool:
    return bool(a) and a == b


def _token_soft_equal(query: list[str], bib: list[str]) -> bool:
    """
    Same words, or the query is the bib title plus at most one trailing word
    (wishlist subtitle). Do not treat a short query as matching a longer different
    bib title (e.g. "Hatchet" must not match "Hatchet Girls").
    """
    if _token_equal(query, bib):
        return True
    if not query or not bib:
        return False
    if len(query) == len(bib) + 1 and query[: len(bib)] == bib:
        return True
    return False


def _series_matches(series_hint: str, bib: dict[str, Any]) -> bool:
    hint_toks = _tokens(series_hint)
    if not hint_toks:
        return True
    for name in _bib_series_names(bib):
        name_toks = _tokens(name)
        if _token_soft_equal(hint_toks, name_toks):
            return True
        # "revenge of magic" vs "revenge magic" after stopword strip already aligned
        if hint_toks and all(t in name_toks for t in hint_toks):
            return True
        if name_toks and all(t in hint_toks for t in name_toks):
            return True
    # Series words sometimes appear only in the catalog title
    title_toks = _tokens(_bib_title(bib))
    if hint_toks and all(t in title_toks for t in hint_toks):
        return True
    return False


def _title_matches_bib(query_title: str, series_name: str, bib: dict[str, Any]) -> bool:
    """True when this bib is the same work the wishlist row means."""
    series_hint, volume = _split_series_volume(query_title, series_name)
    bib_title = _bib_title(bib)
    vol_toks = _tokens(volume)
    full_toks = _tokens(query_title)
    bib_toks = _tokens(bib_title)

    if not bib_toks:
        return False

    volume_hit = _token_soft_equal(vol_toks, bib_toks) or _token_soft_equal(full_toks, bib_toks)

    # "Revenge of Magic The Chosen One" (no colon): bib title is suffix, series is prefix
    if not volume_hit and len(full_toks) > len(bib_toks) and full_toks[-len(bib_toks) :] == bib_toks:
        prefix_toks = full_toks[: -len(bib_toks)]
        if prefix_toks and _series_matches(" ".join(prefix_toks), bib):
            return True
        if series_hint and _series_matches(series_hint, bib):
            return True

    if not volume_hit:
        return False

    if series_hint:
        return _series_matches(series_hint, bib)

    # No series hint: exact-ish volume title only (avoids "Chosen One" → "Chosen Ones")
    return _token_soft_equal(vol_toks, bib_toks) or _token_soft_equal(full_toks, bib_toks)


def _author_matches(query_author: str, bib_authors: list[str]) -> bool:
    q = _author_core(query_author)
    if not q:
        return True  # author unknown — rely on title/series strictness
    surname = _author_surname(query_author)
    for raw in bib_authors:
        a = _author_core(raw)
        if not a:
            continue
        if q == a or q in a or a in q:
            return True
        if surname and len(surname) >= 3 and surname in a.split():
            return True
    return False


def _format_ok(bib: dict[str, Any]) -> bool:
    fmt = _bib_format(bib)
    if fmt in SKIP_FORMATS:
        return False
    supers = _super_formats(bib)
    if supers & {"VIDEO", "MUSIC", "GAMES"} and not (supers & {"BOOKS", "MODERN_FORMATS"}):
        return False
    # Prefer books; allow unknown format through for later availability probe
    if fmt and fmt not in PHYSICAL_BOOK_FORMATS and fmt not in {
        "EBOOK",
        "EAUDIOBOOK",
        "AB",
        "BOOK_CD",
        "PLAYAWAY_AUDIOBOOK",
        "AUDIOBOOK",
    }:
        # Unknown formats still OK if BOOKS superFormat
        if "BOOKS" not in supers and "MODERN_FORMATS" not in supers:
            return fmt == ""
    return True


def _format_rank(bib: dict[str, Any]) -> int:
    """Lower is better — prefer print books over digital."""
    fmt = _bib_format(bib)
    if fmt in {"EBOOK", "EAUDIOBOOK", "AB", "BOOK_CD", "PLAYAWAY_AUDIOBOOK", "AUDIOBOOK"}:
        return 2
    supers = _super_formats(bib)
    if fmt in PHYSICAL_BOOK_FORMATS or "BOOKS" in supers:
        return 0
    return 1


def _is_digital_format(bib: dict[str, Any]) -> bool:
    fmt = _bib_format(bib)
    return fmt in {"EBOOK", "EAUDIOBOOK", "AB", "BOOK_CD", "PLAYAWAY_AUDIOBOOK", "AUDIOBOOK"}


def _pick_strict_matches(
    bibs: list[tuple[str, dict[str, Any]]],
    title: str,
    author: str,
    series_name: str = "",
) -> list[tuple[str, dict[str, Any]]]:
    matched: list[tuple[str, dict[str, Any]]] = []
    for mid, bib in bibs:
        if not _title_matches_bib(title, series_name, bib):
            continue
        if not _author_matches(author, _bib_authors(bib)):
            continue
        if not _format_ok(bib):
            continue
        if not _is_holdable_policy(bib):
            continue
        matched.append((mid, bib))
    # Prefer print; if only digital matches exist, still allow them (branch holdings rare).
    matched.sort(key=lambda pair: (_format_rank(pair[1]), pair[0]))
    print_first = [p for p in matched if not _is_digital_format(p[1])]
    return print_first if print_first else matched


def _merge_bibs(
    bags: list[list[tuple[str, dict[str, Any]]]],
) -> list[tuple[str, dict[str, Any]]]:
    seen: set[str] = set()
    out: list[tuple[str, dict[str, Any]]] = []
    for bag in bags:
        for mid, bib in bag:
            if mid in seen:
                continue
            seen.add(mid)
            out.append((mid, bib))
    return out


def _run_search(
    place: dict[str, Any], query: str, search_type: str = "title"
) -> list[tuple[str, dict[str, Any]]]:
    q = str(query or "").strip()
    if not q:
        return []
    library_id = str(place.get("libraryId") or "")
    params = urllib.parse.urlencode(
        {"query": q, "searchType": search_type, "locale": "en-US"}
    )
    url = f"{GATEWAY}/{library_id}/bibs/search?{params}"
    data = _fetch_json(url, SEARCH_TIMEOUT_SEC)
    bibs = (data.get("entities") or {}).get("bibs") or {}
    if not isinstance(bibs, dict):
        return []
    return [(str(k), v) for k, v in bibs.items() if isinstance(v, dict)]


def _search_bibs(
    place: dict[str, Any],
    title: str,
    author: str,
    isbn: str,
    series_name: str = "",
) -> list[tuple[str, dict[str, Any]]]:
    bags: list[list[tuple[str, dict[str, Any]]]] = []

    if isbn.strip():
        clean = re.sub(r"[^0-9Xx]", "", isbn.strip())
        if len(clean) in (10, 13):
            bags.append(_run_search(place, clean, "keyword"))

    series_hint, volume = _split_series_volume(title, series_name)
    queries: list[tuple[str, str]] = []

    # Prefer keyword when we have series + volume — BC title search often misses combined forms
    if series_hint and volume and _norm_text(series_hint) != _norm_text(volume):
        queries.append((f"{volume} {series_hint}", "keyword"))
        queries.append((volume, "title"))
    queries.append((title.strip(), "keyword"))
    if volume and _norm_text(volume) != _norm_text(title):
        queries.append((volume, "keyword"))
    if author.strip() and volume:
        queries.append((f"{volume} {author.strip()}", "keyword"))

    seen_q: set[str] = set()
    for q, st in queries:
        key = f"{st}:{_norm_text(q)}"
        if not q.strip() or key in seen_q:
            continue
        seen_q.add(key)
        bags.append(_run_search(place, q, st))

    return _merge_bibs(bags)


def _item_is_place_branch(place: dict[str, Any], item: dict[str, Any]) -> bool:
    branch = item.get("branch") if isinstance(item.get("branch"), dict) else {}
    code = str(branch.get("code") or "").strip().upper()
    name = str(branch.get("name") or item.get("branchName") or "").strip().lower()
    want = str(place.get("branchCode") or "").strip().upper()
    if want and code == want:
        return True
    needles = place.get("branchNameNeedles") or ()
    for needle in needles:
        n = str(needle or "").strip().lower()
        if n and n in name:
            return True
    return False


def _item_circulates(item: dict[str, Any]) -> bool:
    av = item.get("availability") if isinstance(item.get("availability"), dict) else {}
    if av.get("libraryUseOnly") is True:
        return False
    circ = str(av.get("circulationType") or "").strip().upper()
    if circ in {"", "REQUEST", "LOAN", "NORMAL"}:
        return True
    if circ in {"NONE", "NO_CIRC", "IN_LIBRARY"}:
        return False
    return True


def _item_counts_for_place(place: dict[str, Any], item: dict[str, Any]) -> bool:
    """Whether this holding row counts for the place's availability scope."""
    scope = str(place.get("availabilityScope") or "branch").strip().lower()
    if scope == "system":
        return True
    return _item_is_place_branch(place, item)


def _item_borrowable_at_place(place: dict[str, Any], item: dict[str, Any]) -> bool:
    if not _item_counts_for_place(place, item):
        return False
    return _item_circulates(item)


def _probe_availability(
    place: dict[str, Any], metadata_id: str
) -> tuple[bool, bool, dict[str, Any] | None]:
    """
    Returns (has_any_counted_item, has_borrowable, sample_item).
    Branch scope: only the configured branch.
    System scope (county): any branch in that library catalog.
    """
    library_id = str(place.get("libraryId") or "")
    params = urllib.parse.urlencode({"locale": "en-US"})
    url = f"{GATEWAY}/{library_id}/bibs/{urllib.parse.quote(metadata_id)}/availability?{params}"
    data = _fetch_json(url, AVAIL_TIMEOUT_SEC)
    entities = data.get("entities") if isinstance(data.get("entities"), dict) else {}
    bib_items = entities.get("bibItems") if isinstance(entities.get("bibItems"), dict) else {}
    has_counted = False
    borrowable_sample: dict[str, Any] | None = None
    non_borrow_sample: dict[str, Any] | None = None
    for _iid, item in bib_items.items():
        if not isinstance(item, dict):
            continue
        if not _item_counts_for_place(place, item):
            continue
        has_counted = True
        if _item_borrowable_at_place(place, item):
            # Prefer a home-branch sample when present (nicer status text).
            if _item_is_place_branch(place, item):
                return True, True, item
            if borrowable_sample is None:
                borrowable_sample = item
            continue
        if non_borrow_sample is None:
            non_borrow_sample = item
    if borrowable_sample is not None:
        return True, True, borrowable_sample
    return has_counted, False, non_borrow_sample


def check_title(
    title: str,
    author: str = "",
    isbn: str = "",
    series_name: str = "",
    place_id: str | None = None,
) -> dict[str, Any]:
    """
    Check one title against a configured library place.

    status:
      yes — borrowable copy at the selected branch
      no — not borrowable there (missing from system, other branch only, or use-only)
      uncertain — catalog unreachable / could not finish check
    """
    place = resolve_place(place_id)
    if place is None:
        return {
            "ok": False,
            "status": "uncertain",
            "reason": "unknown_place",
            "error": "unknown_place",
            "placeId": str(place_id or "").strip(),
            "title": str(title or "").strip()[:300],
            "author": str(author or "").strip()[:200],
            "catalogUrl": "",
        }

    title = str(title or "").strip()[:300]
    author = str(author or "").strip()[:200]
    isbn = str(isbn or "").strip()[:32]
    series_name = str(series_name or "").strip()[:200]
    search_url = catalog_search_url(place, title, author)

    base = {
        "ok": True,
        "placeId": place["placeId"],
        "placeLabel": place["placeLabel"],
        "shortLabel": place.get("shortLabel"),
        "branchCode": place.get("branchCode"),
        "branchName": place.get("branchName"),
        "title": title,
        "author": author,
        "seriesName": series_name or None,
        "catalogUrl": search_url,
        "checkMode": (
            "open_catalog"
            if str(place.get("availabilityScope") or "").lower() == "open_catalog"
            else "availability"
        ),
    }

    if str(place.get("availabilityScope") or "").strip().lower() == "open_catalog":
        return {
            **base,
            "status": "open_catalog",
            "reason": "open_catalog_only",
            "matchTitle": None,
            "matchId": None,
            "libraryStatus": None,
            "message": "Halalit can’t auto-check borrowable copies here — open the catalog to look up this title.",
        }

    if not title:
        return {
            **base,
            "ok": False,
            "status": "uncertain",
            "reason": "title_required",
            "error": "title_required",
        }

    key = _cache_key(str(place["placeId"]), title, author, isbn, series_name)
    cached = _cache_get(key)
    if cached is not None:
        cached["cached"] = True
        return cached

    try:
        bibs = _search_bibs(place, title, author, isbn, series_name)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, json.JSONDecodeError) as e:
        out = {
            **base,
            "status": "uncertain",
            "reason": "catalog_unreachable",
            "error": type(e).__name__,
            "matchTitle": None,
            "matchId": None,
            "libraryStatus": None,
        }
        # Don't cache hard failures long — skip cache
        return out

    matches = _pick_strict_matches(bibs, title, author, series_name)
    if not matches:
        # Common short titles without author/series can collide — stay uncertain.
        # Otherwise treat as not in this library system (hence not at the branch).
        series_hint, volume = _split_series_volume(title, series_name)
        ambiguous = (not author) and (not series_hint) and len(_tokens(volume)) <= 3
        out = {
            **base,
            "status": "uncertain" if ambiguous else "no",
            "reason": "ambiguous_title" if ambiguous else "not_in_catalog",
            "matchTitle": None,
            "matchId": None,
            "libraryStatus": None,
        }
        _cache_set(key, out)
        return out

    # If several different authors match a bare title and no author/series was given, don't guess.
    if not author and not _split_series_volume(title, series_name)[0]:
        authors_seen: set[str] = set()
        for _mid, bib in matches:
            for a in _bib_authors(bib):
                sn = _author_surname(a)
                if sn:
                    authors_seen.add(sn)
        if len(authors_seen) > 1:
            out = {
                **base,
                "status": "uncertain",
                "reason": "ambiguous_author",
                "matchTitle": None,
                "matchId": None,
                "libraryStatus": None,
            }
            _cache_set(key, out)
            return out

    saw_branch_non_borrowable = False
    last_match: tuple[str, dict[str, Any]] | None = None
    probed_ok = False
    for mid, bib in matches[:MAX_BIBS_TO_PROBE]:
        last_match = (mid, bib)
        try:
            has_branch, borrowable, sample = _probe_availability(place, mid)
            probed_ok = True
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, json.JSONDecodeError):
            continue
        if borrowable:
            av = (sample or {}).get("availability") if isinstance(sample, dict) else {}
            lib_status = None
            if isinstance(av, dict):
                lib_status = av.get("libraryStatus") or av.get("status")
            out = {
                **base,
                "status": "yes",
                "reason": place.get("reasonYes") or "borrowable_at_branch",
                "matchTitle": _bib_title(bib),
                "matchId": mid,
                "matchFormat": _bib_format(bib),
                "catalogUrl": catalog_record_url(place, mid),
                "libraryStatus": lib_status,
                "checkedOutOk": True,
            }
            _cache_set(key, out)
            return out
        if has_branch:
            saw_branch_non_borrowable = True

    if not probed_ok:
        out = {
            **base,
            "status": "uncertain",
            "reason": "availability_unreachable",
            "matchTitle": _bib_title(last_match[1]) if last_match else None,
            "matchId": last_match[0] if last_match else None,
            "libraryStatus": None,
        }
        return out

    mid, bib = last_match if last_match else matches[0]
    if saw_branch_non_borrowable:
        out = {
            **base,
            "status": "no",
            "reason": place.get("reasonNoBorrow") or "branch_not_borrowable",
            "matchTitle": _bib_title(bib),
            "matchId": mid,
            "matchFormat": _bib_format(bib),
            "catalogUrl": catalog_record_url(place, mid),
            "libraryStatus": None,
        }
    else:
        out = {
            **base,
            "status": "no",
            "reason": place.get("reasonNoBranch") or "not_at_branch",
            "matchTitle": _bib_title(bib),
            "matchId": mid,
            "matchFormat": _bib_format(bib),
            "catalogUrl": catalog_record_url(place, mid),
            "libraryStatus": None,
        }
    _cache_set(key, out)
    return out
