"""
Santa Clara Central Park Library catalog check (practice connector).

Uses BiblioCommons public gateway JSON (same host the catalog UI calls).
"Yes" = Central Park (branch code C) has a borrowable copy — checked out OK.
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
LIBRARY_ID = "sclibrary"
BRANCH_CODE = "C"
BRANCH_NAME = "Central Park Library"
PLACE_ID = "santa-clara-central-park"
PLACE_LABEL = "Santa Clara Central Park Library"

GATEWAY = "https://gateway.bibliocommons.com/v2/libraries"
CATALOG_SEARCH = "https://sclibrary.bibliocommons.com/v2/search"
CATALOG_RECORD = "https://sclibrary.bibliocommons.com/v2/record"

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
_ARTICLES = re.compile(r"^(the|a|an)\s+")


def _norm_text(s: str) -> str:
    t = str(s or "").strip().lower()
    t = t.replace("'", "").replace("'", "").replace("'", "")
    t = _NON_ALNUM.sub(" ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _title_core(title: str) -> str:
    t = _norm_text(title)
    t = _ARTICLES.sub("", t)
    # Drop subtitle / series noise after colon or slash when comparing
    for sep in (":", "/", "—", "–"):
        if sep in t:
            t = t.split(sep, 1)[0].strip()
    return t


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
    a = _author_core(author)
    if not a:
        return ""
    toks = a.split()
    # Prefer last non-initial token
    for tok in reversed(toks):
        if len(tok) > 1:
            return tok
    return toks[-1] if toks else ""


def _cache_key(title: str, author: str, isbn: str) -> str:
    return "|".join([_title_core(title), _author_core(author), re.sub(r"[^0-9Xx]", "", isbn or "")])


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


def catalog_search_url(title: str, author: str = "") -> str:
    q = title.strip()
    if author.strip():
        q = f"{q} {author.strip()}"
    params = urllib.parse.urlencode({"query": q, "searchType": "title"})
    return f"{CATALOG_SEARCH}?{params}"


def catalog_record_url(metadata_id: str) -> str:
    mid = str(metadata_id or "").strip()
    if not mid:
        return catalog_search_url("")
    return f"{CATALOG_RECORD}/{urllib.parse.quote(mid)}"


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


def _title_matches(query_title: str, bib_title: str) -> bool:
    q = _title_core(query_title)
    b = _title_core(bib_title)
    if not q or not b:
        return False
    if q == b:
        return True
    # Allow short cores contained as whole phrase (e.g. query shorter)
    if len(q) >= 6 and (q in b or b in q):
        # Reject if bib adds a long unrelated prefix like "Spiritual Insights From Classic Literature"
        if b.startswith(q) or q.startswith(b):
            return True
        # Contained as phrase but require similar length (avoid "web" in long titles)
        shorter, longer = (q, b) if len(q) <= len(b) else (b, q)
        if len(shorter) / max(len(longer), 1) >= 0.72:
            return True
    return False


def _author_matches(query_author: str, bib_authors: list[str]) -> bool:
    q = _author_core(query_author)
    if not q:
        return True  # author unknown — rely on title strictness
    surname = _author_surname(query_author)
    for raw in bib_authors:
        a = _author_core(raw)
        if not a:
            continue
        if q == a or q in a or a in q:
            return True
        if surname and len(surname) >= 3 and surname in a:
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
    bibs: list[tuple[str, dict[str, Any]]], title: str, author: str
) -> list[tuple[str, dict[str, Any]]]:
    matched: list[tuple[str, dict[str, Any]]] = []
    for mid, bib in bibs:
        bt = _bib_title(bib)
        if not _title_matches(title, bt):
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


def _search_bibs(title: str, author: str, isbn: str) -> list[tuple[str, dict[str, Any]]]:
    if isbn.strip():
        clean = re.sub(r"[^0-9Xx]", "", isbn.strip())
        if len(clean) in (10, 13):
            params = urllib.parse.urlencode(
                {"query": clean, "searchType": "keyword", "locale": "en-US"}
            )
            url = f"{GATEWAY}/{LIBRARY_ID}/bibs/search?{params}"
            data = _fetch_json(url, SEARCH_TIMEOUT_SEC)
            bibs = (data.get("entities") or {}).get("bibs") or {}
            if isinstance(bibs, dict) and bibs:
                return [(str(k), v) for k, v in bibs.items() if isinstance(v, dict)]

    q = title.strip()
    params = urllib.parse.urlencode({"query": q, "searchType": "title", "locale": "en-US"})
    url = f"{GATEWAY}/{LIBRARY_ID}/bibs/search?{params}"
    data = _fetch_json(url, SEARCH_TIMEOUT_SEC)
    bibs = (data.get("entities") or {}).get("bibs") or {}
    if not isinstance(bibs, dict):
        return []
    return [(str(k), v) for k, v in bibs.items() if isinstance(v, dict)]


def _item_is_central_park(item: dict[str, Any]) -> bool:
    branch = item.get("branch") if isinstance(item.get("branch"), dict) else {}
    code = str(branch.get("code") or "").strip().upper()
    name = str(branch.get("name") or item.get("branchName") or "").strip().lower()
    if code == BRANCH_CODE:
        return True
    return "central park" in name


def _item_borrowable_at_cp(item: dict[str, Any]) -> bool:
    if not _item_is_central_park(item):
        return False
    av = item.get("availability") if isinstance(item.get("availability"), dict) else {}
    if av.get("libraryUseOnly") is True:
        return False
    # circulationType REQUEST / LOAN means they circulate; empty -> allow if not use-only
    circ = str(av.get("circulationType") or "").strip().upper()
    if circ in {"", "REQUEST", "LOAN", "NORMAL"}:
        return True
    # Explicit non-circulating
    if circ in {"NONE", "NO_CIRC", "IN_LIBRARY"}:
        return False
    return True


def _probe_availability(metadata_id: str) -> tuple[bool, bool, dict[str, Any] | None]:
    """
    Returns (has_any_cp_item, has_borrowable_cp, sample_item).
    has_any_cp_item: CP owns a copy (may be use-only).
    has_borrowable_cp: CP has a borrowable/requestable copy.
    """
    params = urllib.parse.urlencode({"locale": "en-US"})
    url = f"{GATEWAY}/{LIBRARY_ID}/bibs/{urllib.parse.quote(metadata_id)}/availability?{params}"
    data = _fetch_json(url, AVAIL_TIMEOUT_SEC)
    entities = data.get("entities") if isinstance(data.get("entities"), dict) else {}
    bib_items = entities.get("bibItems") if isinstance(entities.get("bibItems"), dict) else {}
    has_cp = False
    sample: dict[str, Any] | None = None
    for _iid, item in bib_items.items():
        if not isinstance(item, dict):
            continue
        if not _item_is_central_park(item):
            continue
        has_cp = True
        if _item_borrowable_at_cp(item):
            return True, True, item
        if sample is None:
            sample = item
    return has_cp, False, sample


def check_title(title: str, author: str = "", isbn: str = "") -> dict[str, Any]:
    """
    Check one title against Santa Clara Central Park Library.

    status:
      yes — borrowable copy at Central Park
      no — strict match in city catalog, but no borrowable CP copy
      uncertain — no strict match / catalog error
    """
    title = str(title or "").strip()[:300]
    author = str(author or "").strip()[:200]
    isbn = str(isbn or "").strip()[:32]
    search_url = catalog_search_url(title, author)

    base = {
        "ok": True,
        "placeId": PLACE_ID,
        "placeLabel": PLACE_LABEL,
        "branchCode": BRANCH_CODE,
        "branchName": BRANCH_NAME,
        "title": title,
        "author": author,
        "catalogUrl": search_url,
    }

    if not title:
        return {
            **base,
            "ok": False,
            "status": "uncertain",
            "reason": "title_required",
            "error": "title_required",
        }

    key = _cache_key(title, author, isbn)
    cached = _cache_get(key)
    if cached is not None:
        cached["cached"] = True
        return cached

    try:
        bibs = _search_bibs(title, author, isbn)
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

    matches = _pick_strict_matches(bibs, title, author)
    if not matches:
        out = {
            **base,
            "status": "uncertain",
            "reason": "no_strict_match",
            "matchTitle": None,
            "matchId": None,
            "libraryStatus": None,
        }
        _cache_set(key, out)
        return out

    saw_cp_non_borrowable = False
    last_match: tuple[str, dict[str, Any]] | None = None
    for mid, bib in matches[:MAX_BIBS_TO_PROBE]:
        last_match = (mid, bib)
        try:
            has_cp, borrowable, sample = _probe_availability(mid)
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
                "reason": "borrowable_at_central_park",
                "matchTitle": _bib_title(bib),
                "matchId": mid,
                "matchFormat": _bib_format(bib),
                "catalogUrl": catalog_record_url(mid),
                "libraryStatus": lib_status,
                "checkedOutOk": True,
            }
            _cache_set(key, out)
            return out
        if has_cp:
            saw_cp_non_borrowable = True

    mid, bib = last_match if last_match else matches[0]
    if saw_cp_non_borrowable:
        out = {
            **base,
            "status": "no",
            "reason": "central_park_not_borrowable",
            "matchTitle": _bib_title(bib),
            "matchId": mid,
            "matchFormat": _bib_format(bib),
            "catalogUrl": catalog_record_url(mid),
            "libraryStatus": None,
        }
    else:
        out = {
            **base,
            "status": "no",
            "reason": "not_at_central_park",
            "matchTitle": _bib_title(bib),
            "matchId": mid,
            "matchFormat": _bib_format(bib),
            "catalogUrl": catalog_record_url(mid),
            "libraryStatus": None,
        }
    _cache_set(key, out)
    return out
