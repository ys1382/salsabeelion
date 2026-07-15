"""
Reader library place suggestions — policy gate + BiblioCommons probe + store.

Auto-admit bot-friendly community BiblioCommons catalogs (system scope).
Non-bot-friendly → pending for that reader; owner notified either way.
Scam / deny → hard reject.
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from library_catalog_check import GATEWAY, PLACES as SEED_PLACES, USER_AGENT, _fetch_json

POLICY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "library_place_policy.json")

_IP_HOST = re.compile(r"^\d{1,3}(?:\.\d{1,3}){3}$")
_ALNUM = re.compile(r"[^a-z0-9]+")


def _db_path() -> str:
    return os.environ.get(
        "HALALIT_ACCOUNTS_DB",
        os.path.expanduser("~/kids-sites/halalit-server/halalit_accounts.sqlite"),
    )


def _connect() -> sqlite3.Connection:
    path = _db_path()
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    conn = sqlite3.connect(path, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_library_place_tables() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS library_live_places (
                place_id TEXT PRIMARY KEY,
                place_label TEXT NOT NULL,
                short_label TEXT NOT NULL,
                initials TEXT NOT NULL,
                library_id TEXT NOT NULL,
                catalog_host TEXT NOT NULL,
                availability_scope TEXT NOT NULL DEFAULT 'system',
                branch_code TEXT NOT NULL DEFAULT '',
                branch_name TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL DEFAULT 'reader',
                suggested_by INTEGER,
                created_at REAL NOT NULL,
                disabled INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_library_live_library_id
                ON library_live_places(library_id);
            CREATE TABLE IF NOT EXISTS library_pending_suggestions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                catalog_url TEXT NOT NULL DEFAULT '',
                label TEXT NOT NULL DEFAULT '',
                reason TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                meta_json TEXT NOT NULL DEFAULT '{}',
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_library_pending_user
                ON library_pending_suggestions(user_id, status);
            """
        )
        cols = {str(r[1]) for r in conn.execute("PRAGMA table_info(library_live_places)").fetchall()}
        if "catalog_url" not in cols:
            conn.execute(
                "ALTER TABLE library_live_places ADD COLUMN catalog_url TEXT NOT NULL DEFAULT ''"
            )
        conn.commit()


def load_policy() -> dict[str, Any]:
    try:
        with open(POLICY_PATH, encoding="utf-8") as f:
            raw = json.load(f)
        return raw if isinstance(raw, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {
            "autoAllowHostSuffixes": [".bibliocommons.com"],
            "denyHostExact": [],
            "denyHostContains": [],
            "denyLabelNeedles": [],
            "probeTitle": "Charlotte's Web",
            "probeAuthor": "E. B. White",
        }


def _norm_host(host: str) -> str:
    h = str(host or "").strip().lower()
    if h.startswith("www."):
        h = h[4:]
    return h


def _parse_catalog_url(raw: str) -> dict[str, Any] | None:
    text = str(raw or "").strip()
    if not text:
        return None
    if "://" not in text:
        text = "https://" + text
    try:
        parsed = urllib.parse.urlparse(text)
    except ValueError:
        return None
    if parsed.scheme not in ("http", "https"):
        return None
    host = _norm_host(parsed.hostname or "")
    if not host:
        return None
    path = parsed.path or ""
    library_id = ""
    if host.endswith(".bibliocommons.com"):
        if host == "gateway.bibliocommons.com":
            m = re.search(r"/libraries/([a-z0-9_-]+)", path, re.I)
            if m:
                library_id = m.group(1).lower()
                host = f"{library_id}.bibliocommons.com"
        elif host != "www.bibliocommons.com" and host != "bibliocommons.com":
            library_id = host.split(".", 1)[0]
    return {
        "scheme": parsed.scheme,
        "host": host,
        "path": path,
        "libraryId": library_id,
        "normalizedUrl": f"https://{host}/",
    }


def _label_denied(label: str, policy: dict[str, Any]) -> bool:
    low = str(label or "").strip().lower()
    if not low:
        return False
    for needle in policy.get("denyLabelNeedles") or []:
        n = str(needle or "").strip().lower()
        if n and n in low:
            return True
    return False


def _host_denied(host: str, policy: dict[str, Any]) -> str | None:
    h = _norm_host(host)
    if not h:
        return "invalid_host"
    if _IP_HOST.match(h):
        return "ip_host"
    exact = {_norm_host(x) for x in (policy.get("denyHostExact") or [])}
    if h in exact:
        return "deny_host"
    for part in policy.get("denyHostContains") or []:
        p = str(part or "").strip().lower()
        if p and p in h:
            return "deny_host"
    return None


def _host_auto_allow(host: str, policy: dict[str, Any]) -> bool:
    h = _norm_host(host)
    for suf in policy.get("autoAllowHostSuffixes") or []:
        s = str(suf or "").strip().lower()
        if s and h.endswith(s) and h != s.lstrip("."):
            return True
    return False


def _looks_like_community_library(host: str, label: str, policy: dict[str, Any]) -> bool:
    """Public/community library signals — not BiblioCommons-only."""
    h = _norm_host(host)
    low_label = str(label or "").strip().lower()
    blob = f"{h} {low_label}"
    for needle in policy.get("communityHostNeedles") or ["library", "publiclibrary"]:
        n = str(needle or "").strip().lower()
        if n and n in h:
            return True
    for needle in policy.get("communityLabelNeedles") or ["library"]:
        n = str(needle or "").strip().lower()
        if n and n in low_label:
            return True
    # City/county .gov library sites often omit "library" in the host alone.
    if h.endswith(".gov") and ("lib" in blob or "library" in blob):
        return True
    if h.startswith("catalog.") and "library" in h:
        return True
    return False


def _prefer_catalog_url(host: str, normalized_url: str) -> str:
    """
    If the reader pasted a library homepage, prefer catalog.<domain> when it answers.
    """
    h = _norm_host(host)
    if not h or h.startswith("catalog."):
        return normalized_url
    if h.endswith(".bibliocommons.com"):
        return normalized_url
    # Strip www. for catalog. attempt
    base = h[4:] if h.startswith("www.") else h
    candidate_host = f"catalog.{base}"
    candidate = f"https://{candidate_host}/"
    try:
        req = urllib.request.Request(
            candidate,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            if 200 <= int(getattr(resp, "status", 200) or 200) < 400:
                return candidate
    except Exception:
        pass
    return normalized_url


def _slug_from_host(host: str) -> str:
    h = _ALNUM.sub("-", _norm_host(host)).strip("-")
    return (h or "library")[:48]


def _public_place_dict(p: dict[str, Any]) -> dict[str, str]:
    scope = str(p.get("availabilityScope") or "system").strip().lower()
    check_mode = "open_catalog" if scope == "open_catalog" else "availability"
    return {
        "placeId": str(p["placeId"]),
        "placeLabel": str(p["placeLabel"]),
        "shortLabel": str(p.get("shortLabel") or p["placeLabel"]),
        "initials": str(p.get("initials") or _initials_from_label(str(p.get("shortLabel") or ""))),
        "checkMode": check_mode,
    }


def _initials_from_label(label: str) -> str:
    words = [w for w in re.split(r"[^A-Za-z0-9]+", label or "") if w]
    skip = {"the", "a", "an", "of", "and", "library", "public", "county", "city"}
    keep = [w for w in words if w.lower() not in skip] or words
    if not keep:
        return "?"
    if len(keep) == 1:
        return keep[0][:2].upper()
    return "".join(w[0] for w in keep[:3]).upper()


def _short_label(label: str) -> str:
    s = str(label or "").strip()
    for cut in (" Library", " Public Library", " Branch"):
        if s.endswith(cut) and len(s) > len(cut) + 2:
            s = s[: -len(cut)].strip()
    return (s or "Library")[:40]


def _slug_place_id(library_id: str) -> str:
    lid = _ALNUM.sub("-", str(library_id or "").strip().lower()).strip("-")
    return f"bc-{lid}" if lid else ""


def _live_rows(include_disabled: bool = False) -> list[dict[str, Any]]:
    init_library_place_tables()
    with _connect() as conn:
        if include_disabled:
            rows = conn.execute(
                "SELECT * FROM library_live_places ORDER BY created_at ASC"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM library_live_places WHERE disabled = 0 ORDER BY created_at ASC"
            ).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        scope = str(r["availability_scope"] or "system")
        catalog_url = ""
        try:
            catalog_url = str(r["catalog_url"] or "")
        except (KeyError, IndexError):
            catalog_url = ""
        if not catalog_url and r["catalog_host"]:
            catalog_url = f"https://{r['catalog_host']}/"
        out.append(
            {
                "placeId": r["place_id"],
                "placeLabel": r["place_label"],
                "shortLabel": r["short_label"],
                "initials": r["initials"],
                "libraryId": r["library_id"],
                "catalogHost": r["catalog_host"],
                "catalogUrl": catalog_url,
                "availabilityScope": scope,
                "branchCode": r["branch_code"] or "",
                "branchName": r["branch_name"] or "",
                "branchNameNeedles": (),
                "reasonYes": "borrowable_via_system",
                "reasonNoBranch": "not_in_system_borrowable",
                "reasonNoBorrow": "system_not_borrowable",
                "source": r["source"],
            }
        )
    return out


def all_place_configs() -> dict[str, dict[str, Any]]:
    """Seed + live places for catalog checks."""
    merged: dict[str, dict[str, Any]] = {k: dict(v) for k, v in SEED_PLACES.items()}
    for p in _live_rows():
        pid = str(p["placeId"])
        if pid not in merged:
            merged[pid] = p
    return merged


def public_place_list() -> list[dict[str, str]]:
    """UI list: seed order first, then live auto-adds."""
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for pid in ("santa-clara-central-park", "santa-clara-mission", "sccld-cupertino"):
        p = SEED_PLACES.get(pid)
        if not p:
            continue
        seen.add(pid)
        item = _public_place_dict(
            {
                **p,
                "initials": {
                    "santa-clara-central-park": "SC",
                    "santa-clara-mission": "M",
                    "sccld-cupertino": "C",
                }.get(pid, _initials_from_label(str(p["shortLabel"]))),
            }
        )
        out.append(item)
    for p in _live_rows():
        pid = str(p["placeId"])
        if pid in seen:
            continue
        seen.add(pid)
        out.append(_public_place_dict(p))
    return out


def find_existing_by_library_id(library_id: str) -> dict[str, Any] | None:
    lid = str(library_id or "").strip().lower()
    if not lid:
        return None
    for p in all_place_configs().values():
        if str(p.get("libraryId") or "").strip().lower() == lid:
            return dict(p)
    return None


def find_existing_by_catalog_host(host: str) -> dict[str, Any] | None:
    want = _norm_host(host)
    if not want:
        return None
    for p in all_place_configs().values():
        ch = _norm_host(str(p.get("catalogHost") or ""))
        cu = str(p.get("catalogUrl") or "")
        try:
            cu_host = _norm_host(urllib.parse.urlparse(cu).hostname or "")
        except ValueError:
            cu_host = ""
        if ch == want or cu_host == want:
            return dict(p)
        # homepage vs catalog. subdomain of same library
        if ch.endswith("." + want) or want.endswith("." + ch):
            return dict(p)
        if cu_host and (cu_host.endswith("." + want) or want.endswith("." + cu_host)):
            return dict(p)
    return None


def probe_bibliocommons(library_id: str, policy: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return {ok, reason?} after a lightweight gateway search."""
    lid = str(library_id or "").strip()
    if not lid or not re.match(r"^[a-z0-9_-]+$", lid, re.I):
        return {"ok": False, "reason": "invalid_library_id"}
    pol = policy or load_policy()
    title = str(pol.get("probeTitle") or "Charlotte's Web").strip()
    params = urllib.parse.urlencode(
        {"query": title, "searchType": "keyword", "locale": "en-US"}
    )
    url = f"{GATEWAY}/{lid}/bibs/search?{params}"
    try:
        data = _fetch_json(url, 12)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as e:
        reason = "probe_http"
        if isinstance(e, urllib.error.HTTPError):
            reason = f"probe_http_{e.code}"
        return {"ok": False, "reason": reason, "error": type(e).__name__}
    entities = data.get("entities") if isinstance(data, dict) else None
    if not isinstance(entities, dict):
        return {"ok": False, "reason": "probe_bad_shape"}
    # Empty bibs still counts as a live catalog responding.
    return {"ok": True, "reason": "probe_ok"}


def _insert_live_place(
    *,
    place_id: str,
    place_label: str,
    short_label: str,
    initials: str,
    library_id: str,
    catalog_host: str,
    user_id: int | None,
    availability_scope: str = "system",
    catalog_url: str = "",
) -> None:
    init_library_place_tables()
    now = time.time()
    scope = str(availability_scope or "system").strip().lower() or "system"
    url = str(catalog_url or "").strip()
    if not url and catalog_host:
        url = f"https://{catalog_host}/"
    with _connect() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO library_live_places (
                place_id, place_label, short_label, initials, library_id,
                catalog_host, availability_scope, branch_code, branch_name,
                source, suggested_by, created_at, disabled, catalog_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, '', '', 'reader', ?, ?, 0, ?)
            """,
            (
                place_id,
                place_label,
                short_label,
                initials,
                library_id,
                catalog_host,
                scope,
                user_id,
                now,
                url[:500],
            ),
        )
        conn.commit()


def _place_public_payload(place: dict[str, Any]) -> dict[str, str]:
    return _public_place_dict(place)


def _resolve_pending_matching_host(host: str) -> None:
    """Clear pending rows that match a host we just auto-admitted."""
    want = _norm_host(host)
    if not want:
        return
    init_library_place_tables()
    now = time.time()
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, catalog_url, label FROM library_pending_suggestions
            WHERE status = 'pending'
            """
        ).fetchall()
        for r in rows:
            blob = f"{r['catalog_url'] or ''} {r['label'] or ''}".lower()
            if want in blob or want.replace("www.", "") in blob:
                conn.execute(
                    """
                    UPDATE library_pending_suggestions
                    SET status = 'accepted', updated_at = ?
                    WHERE id = ?
                    """,
                    (now, r["id"]),
                )
        conn.commit()


def _auto_add_open_catalog(
    *,
    uid: int | None,
    display: str,
    host: str,
    catalog_url: str,
) -> dict[str, Any]:
    existing = find_existing_by_catalog_host(host)
    if not existing:
        try:
            cu_host = _norm_host(urllib.parse.urlparse(catalog_url).hostname or "")
        except ValueError:
            cu_host = ""
        if cu_host:
            existing = find_existing_by_catalog_host(cu_host)
    if existing:
        place = _place_public_payload(existing)
        _resolve_pending_matching_host(host)
        try:
            _resolve_pending_matching_host(
                _norm_host(urllib.parse.urlparse(catalog_url).hostname or "")
            )
        except ValueError:
            pass
        notify_owner_library_event(
            uid,
            f"Library already on Halalit: {place['placeLabel']}",
            {"outcome": "already_exists", "placeId": place["placeId"], "checkMode": place.get("checkMode")},
        )
        return {
            "ok": True,
            "outcome": "already_exists",
            "place": place,
            "message": "That library is already on Halalit’s list — you can favorite it.",
        }

    place_label = display or host
    short = _short_label(place_label)
    initials = _initials_from_label(short)
    place_id = f"open-{_slug_from_host(host)}"
    try:
        catalog_host = _norm_host(urllib.parse.urlparse(catalog_url).hostname or host)
    except ValueError:
        catalog_host = host
    _insert_live_place(
        place_id=place_id,
        place_label=place_label,
        short_label=short,
        initials=initials,
        library_id="",
        catalog_host=catalog_host,
        user_id=uid,
        availability_scope="open_catalog",
        catalog_url=catalog_url,
    )
    _resolve_pending_matching_host(host)
    _resolve_pending_matching_host(catalog_host)
    place = {
        "placeId": place_id,
        "placeLabel": place_label,
        "shortLabel": short,
        "initials": initials,
        "checkMode": "open_catalog",
    }
    notify_owner_library_event(
        uid,
        f"Library auto-added (open catalog): {place_label}",
        {
            "outcome": "auto_added",
            "placeId": place_id,
            "checkMode": "open_catalog",
            "catalogUrl": catalog_url,
            "label": place_label,
        },
    )
    return {
        "ok": True,
        "outcome": "auto_added",
        "place": place,
        "message": "Added — Halalit can’t auto-check borrowable copies for this catalog system yet, but you can favorite it and open the catalog from Check.",
    }


def _insert_pending(
    *,
    user_id: int | None,
    catalog_url: str,
    label: str,
    reason: str,
    meta: dict[str, Any] | None = None,
) -> int:
    init_library_place_tables()
    now = time.time()
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO library_pending_suggestions (
                user_id, catalog_url, label, reason, status, meta_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
            """,
            (
                user_id,
                catalog_url[:500],
                label[:200],
                reason[:80],
                json.dumps(meta or {}, ensure_ascii=False),
                now,
                now,
            ),
        )
        conn.commit()
        return int(cur.lastrowid)


def notify_owner_library_event(user_id: int | None, message: str, meta: dict[str, Any]) -> None:
    try:
        from halalit_accounts import log_reader_message

        log_reader_message(user_id, "library_suggest", message[:4000], meta)
    except Exception:
        pass


def suggest_library(
    *,
    user_id: int | None = None,
    catalog_url: str = "",
    label: str = "",
) -> dict[str, Any]:
    """
    Policy → probe → auto | pending | reject.

    Sign-in optional. Returns outcome: auto_added | already_exists | pending | rejected
    """
    init_library_place_tables()
    policy = load_policy()
    raw_url = str(catalog_url or "").strip()[:500]
    display = str(label or "").strip()[:200]
    uid = int(user_id) if user_id else None
    # Anonymous suggests use user_id 0 (avoids NOT NULL issues on older local DBs).
    pending_uid = uid if uid is not None else 0

    if _label_denied(display, policy):
        return {
            "ok": False,
            "outcome": "rejected",
            "error": "not_community_library",
            "message": "Halalit only accepts community public libraries — not research-only collections.",
        }

    if not raw_url:
        # Name-only → pending (cannot auto-wire).
        if not display:
            return {
                "ok": False,
                "outcome": "rejected",
                "error": "url_or_name_required",
                "message": "Paste your library’s catalog link (for example something ending in bibliocommons.com).",
            }
        pending_id = _insert_pending(
            user_id=pending_uid,
            catalog_url="",
            label=display,
            reason="name_only",
            meta={"label": display},
        )
        notify_owner_library_event(
            uid,
            f"Library suggestion pending (name only): {display}",
            {"outcome": "pending", "reason": "name_only", "pendingId": pending_id, "label": display},
        )
        return {
            "ok": True,
            "outcome": "pending",
            "pendingId": pending_id,
            "reason": "name_only",
            "message": "Suggestion pending — Halalit needs a catalog link to check this library (often ends in bibliocommons.com), not only a name. The owner has been notified.",
        }

    parsed = _parse_catalog_url(raw_url)
    if not parsed:
        return {
            "ok": False,
            "outcome": "rejected",
            "error": "invalid_url",
            "message": "That doesn’t look like a usable catalog link.",
        }

    if parsed["scheme"] != "https":
        return {
            "ok": False,
            "outcome": "rejected",
            "error": "https_required",
            "message": "Library catalog links need to use https.",
        }

    deny = _host_denied(parsed["host"], policy)
    if deny:
        return {
            "ok": False,
            "outcome": "rejected",
            "error": deny,
            "message": "Halalit can’t use that link — it doesn’t look like a safe community library catalog.",
        }

    if not _host_auto_allow(parsed["host"], policy):
        # Not BiblioCommons — still auto-admit if it looks like a community library.
        if _looks_like_community_library(parsed["host"], display, policy):
            catalog_url = _prefer_catalog_url(parsed["host"], parsed["normalizedUrl"])
            return _auto_add_open_catalog(
                uid=uid,
                display=display or parsed["host"],
                host=parsed["host"],
                catalog_url=catalog_url,
            )
        pending_id = _insert_pending(
            user_id=pending_uid,
            catalog_url=parsed["normalizedUrl"],
            label=display or parsed["host"],
            reason="not_community_clear",
            meta={"host": parsed["host"]},
        )
        notify_owner_library_event(
            uid,
            f"Library suggestion pending (not clearly a community library): {display or parsed['host']}",
            {
                "outcome": "pending",
                "reason": "not_community_clear",
                "pendingId": pending_id,
                "catalogUrl": parsed["normalizedUrl"],
                "label": display or parsed["host"],
            },
        )
        return {
            "ok": True,
            "outcome": "pending",
            "pendingId": pending_id,
            "reason": "not_community_clear",
            "message": "Suggestion pending — Halalit couldn’t tell this is a community public library from that link. The owner has been notified.",
        }

    library_id = parsed.get("libraryId") or ""
    if not library_id:
        # BiblioCommons host without id — try open-catalog if community, else pending.
        if _looks_like_community_library(parsed["host"], display, policy):
            return _auto_add_open_catalog(
                uid=uid,
                display=display or parsed["host"],
                host=parsed["host"],
                catalog_url=parsed["normalizedUrl"],
            )
        pending_id = _insert_pending(
            user_id=pending_uid,
            catalog_url=parsed["normalizedUrl"],
            label=display or parsed["host"],
            reason="missing_library_id",
            meta={"host": parsed["host"]},
        )
        notify_owner_library_event(
            uid,
            f"Library suggestion pending (could not read catalog id): {display or parsed['host']}",
            {
                "outcome": "pending",
                "reason": "missing_library_id",
                "pendingId": pending_id,
                "catalogUrl": parsed["normalizedUrl"],
            },
        )
        return {
            "ok": True,
            "outcome": "pending",
            "pendingId": pending_id,
            "reason": "missing_library_id",
            "message": "Suggestion pending — Halalit couldn’t read a catalog id from that link. Try a bibliocommons.com catalog URL if the library has one. The owner has been notified.",
        }

    existing = find_existing_by_library_id(library_id)
    if existing:
        place = {
            "placeId": existing["placeId"],
            "placeLabel": existing["placeLabel"],
            "shortLabel": existing.get("shortLabel") or existing["placeLabel"],
            "initials": existing.get("initials")
            or _initials_from_label(str(existing.get("shortLabel") or existing["placeLabel"])),
            "checkMode": (
                "open_catalog"
                if str(existing.get("availabilityScope") or "").lower() == "open_catalog"
                else "availability"
            ),
        }
        notify_owner_library_event(
            uid,
            f"Library already on Halalit: {place['placeLabel']}",
            {"outcome": "already_exists", "placeId": place["placeId"]},
        )
        return {
            "ok": True,
            "outcome": "already_exists",
            "place": place,
            "message": "That library is already on Halalit’s list — you can favorite it.",
        }

    probe = probe_bibliocommons(library_id, policy)
    if not probe.get("ok"):
        # Still a community BiblioCommons-shaped link — admit as open-catalog.
        return _auto_add_open_catalog(
            uid=uid,
            display=display or library_id,
            host=parsed["host"],
            catalog_url=parsed["normalizedUrl"],
        )

    place_label = display or f"{library_id} Library"
    short = _short_label(place_label)
    initials = _initials_from_label(short)
    place_id = _slug_place_id(library_id)
    catalog_host = f"{library_id}.bibliocommons.com"
    _insert_live_place(
        place_id=place_id,
        place_label=place_label,
        short_label=short,
        initials=initials,
        library_id=library_id,
        catalog_host=catalog_host,
        user_id=uid,
        availability_scope="system",
        catalog_url=f"https://{catalog_host}/",
    )
    place = {
        "placeId": place_id,
        "placeLabel": place_label,
        "shortLabel": short,
        "initials": initials,
        "checkMode": "availability",
    }
    notify_owner_library_event(
        uid,
        f"Library auto-added: {place_label} ({library_id})",
        {
            "outcome": "auto_added",
            "placeId": place_id,
            "libraryId": library_id,
            "catalogUrl": parsed["normalizedUrl"],
            "label": place_label,
        },
    )
    return {
        "ok": True,
        "outcome": "auto_added",
        "place": place,
        "message": "Added — Halalit can check this library’s catalog. “Yes” means borrowable somewhere in that system.",
    }


def pending_for_user(user_id: int) -> list[dict[str, Any]]:
    init_library_place_tables()
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, catalog_url, label, reason, status, created_at, updated_at
            FROM library_pending_suggestions
            WHERE user_id = ? AND status = 'pending'
            ORDER BY created_at DESC LIMIT 40
            """,
            (user_id,),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "catalogUrl": r["catalog_url"],
            "label": r["label"],
            "reason": r["reason"],
            "status": r["status"],
            "createdAt": r["created_at"],
        }
        for r in rows
    ]


def owner_pending_list(limit: int = 60) -> list[dict[str, Any]]:
    init_library_place_tables()
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, user_id, catalog_url, label, reason, status, meta_json, created_at, updated_at
            FROM library_pending_suggestions
            WHERE status = 'pending'
            ORDER BY created_at DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
    out = []
    for r in rows:
        try:
            meta = json.loads(r["meta_json"] or "{}")
        except json.JSONDecodeError:
            meta = {}
        out.append(
            {
                "id": r["id"],
                "userId": r["user_id"],
                "catalogUrl": r["catalog_url"],
                "label": r["label"],
                "reason": r["reason"],
                "status": r["status"],
                "meta": meta if isinstance(meta, dict) else {},
                "createdAt": r["created_at"],
            }
        )
    return out


def owner_recent_auto_adds(limit: int = 40) -> list[dict[str, Any]]:
    init_library_place_tables()
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT place_id, place_label, short_label, library_id, catalog_host,
                   availability_scope, suggested_by, created_at, disabled, catalog_url
            FROM library_live_places
            WHERE source = 'reader'
            ORDER BY created_at DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
    out = []
    for r in rows:
        scope = str(r["availability_scope"] or "system")
        catalog_url = ""
        try:
            catalog_url = str(r["catalog_url"] or "")
        except (KeyError, IndexError):
            catalog_url = ""
        if not catalog_url and r["catalog_host"]:
            catalog_url = f"https://{r['catalog_host']}/"
        out.append(
            {
                "placeId": r["place_id"],
                "placeLabel": r["place_label"],
                "shortLabel": r["short_label"],
                "libraryId": r["library_id"],
                "catalogHost": r["catalog_host"],
                "catalogUrl": catalog_url,
                "checkMode": "open_catalog" if scope == "open_catalog" else "availability",
                "suggestedBy": r["suggested_by"],
                "createdAt": r["created_at"],
                "disabled": bool(r["disabled"]),
            }
        )
    return out


def owner_reject_pending(pending_id: int) -> bool:
    init_library_place_tables()
    now = time.time()
    with _connect() as conn:
        cur = conn.execute(
            """
            UPDATE library_pending_suggestions
            SET status = 'rejected', updated_at = ?
            WHERE id = ? AND status = 'pending'
            """,
            (now, pending_id),
        )
        conn.commit()
        return cur.rowcount > 0


def owner_disable_place(place_id: str) -> bool:
    init_library_place_tables()
    pid = str(place_id or "").strip()
    if not pid or pid in SEED_PLACES:
        return False
    with _connect() as conn:
        cur = conn.execute(
            "UPDATE library_live_places SET disabled = 1 WHERE place_id = ?",
            (pid,),
        )
        conn.commit()
        return cur.rowcount > 0
