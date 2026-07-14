"""Owner Bookcheck lookup log — write, canonicalize, and aggregate by title/account."""
from __future__ import annotations

import json
import os
import re
import time
from typing import Any

from halalit_lookup_quality import is_garbage_lookup

_TITLE_NORM_RE = re.compile(r"[^a-z0-9]+")
_VOLUME_RE = re.compile(
    r"\b(?:book|bk|vol\.?|volume|#)\s*(\d+)\b",
    re.IGNORECASE,
)

# Single canonical author when catalog often returns the wrong edition.
CLASSIC_AUTHORS: dict[str, str] = {
    "heidi": "Johanna Spyri",
}


def _title_norm_key(title: str) -> str:
    return _TITLE_NORM_RE.sub(" ", (title or "").strip().lower()).strip()


def _author_norm_key(author: str) -> str:
    return re.sub(r"\s+", " ", (author or "").strip().lower())


def _vet_index() -> dict[str, list[dict[str, str]]]:
    """Lazy load owner on-site vets for display canonicalization."""
    db_path = os.environ.get(
        "HALALIT_ACCOUNTS_DB",
        os.path.expanduser("~/kids-sites/halalit-server/halalit_accounts.sqlite"),
    )
    if not os.path.isfile(db_path):
        return {}
    try:
        import sqlite3

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT title, author FROM owner_vet_entries ORDER BY updated_at DESC"
        ).fetchall()
        conn.close()
    except (OSError, sqlite3.Error):
        return {}
    out: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        title = str(row["title"] or "").strip()
        author = str(row["author"] or "").strip()
        if not title:
            continue
        key = _title_norm_key(title)
        out.setdefault(key, []).append({"title": title, "author": author})
    return out


def canonical_display(title: str, author: str, vet_index: dict[str, list[dict[str, str]]] | None = None) -> tuple[str, str]:
    t = (title or "").strip()
    a = (author or "").strip()
    if not t:
        return t, a
    idx = vet_index if vet_index is not None else _vet_index()
    tk = _title_norm_key(t)
    if tk in idx and idx[tk]:
        vet = idx[tk][0]
        t = vet.get("title") or t
        if vet.get("author"):
            a = vet["author"]
    elif tk in CLASSIC_AUTHORS:
        a = CLASSIC_AUTHORS[tk]
    return t, a


def lookup_group_key(title: str, author: str, vet_index: dict[str, list[dict[str, str]]] | None = None) -> str:
    """Same title + canonical author merge; different volume wording stays separate."""
    t, a = canonical_display(title, author, vet_index)
    tk = _title_norm_key(t)
    ak = _author_norm_key(a)
    vol = _VOLUME_RE.search(t)
    vol_suffix = f"|vol{vol.group(1)}" if vol else ""
    return f"{tk}|{ak}{vol_suffix}"


def record_bookcheck_lookup(
    log_path: str,
    *,
    title: str,
    author: str = "",
    entered_title: str = "",
    entered_author: str = "",
    account_id: int | None = None,
) -> None:
    use_title = (entered_title or title or "").strip()
    use_author = (entered_author if entered_author is not None else author or "").strip()
    if is_garbage_lookup(use_title, use_author):
        return
    if not log_path:
        return
    row = {
        "title": use_title,
        "author": use_author,
        "ts": time.time(),
    }
    if account_id is not None:
        row["accountId"] = int(account_id)
    if entered_title and entered_title.strip() != use_title:
        row["enteredTitle"] = entered_title.strip()
    if entered_author is not None and str(entered_author).strip() != use_author:
        row["enteredAuthor"] = str(entered_author).strip()
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    except OSError:
        pass


def _read_log_rows(log_path: str, max_lines: int = 5000) -> list[dict[str, Any]]:
    if not log_path or not os.path.isfile(log_path):
        return []
    try:
        with open(log_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except OSError:
        return []
    rows: list[dict[str, Any]] = []
    for line in lines[-max_lines:]:
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(row, dict):
            continue
        title = str(row.get("title") or row.get("enteredTitle") or "").strip()
        author = str(row.get("author") or row.get("enteredAuthor") or "").strip()
        if not title or is_garbage_lookup(title, author):
            continue
        ts = float(row.get("ts") or 0) or time.time()
        account_id = row.get("accountId")
        rows.append(
            {
                "title": title,
                "author": author,
                "ts": ts,
                "accountId": int(account_id) if account_id is not None else None,
            }
        )
    return rows


def _aggregate_buckets(rows: list[dict[str, Any]], vet_index: dict[str, list[dict[str, str]]]) -> dict[str, dict[str, Any]]:
    buckets: dict[str, dict[str, Any]] = {}
    for row in rows:
        title = row["title"]
        author = row["author"]
        key = lookup_group_key(title, author, vet_index)
        disp_title, disp_author = canonical_display(title, author, vet_index)
        if key not in buckets:
            buckets[key] = {
                "title": disp_title,
                "author": disp_author,
                "accountIds": set(),
                "lookupCount": 0,
                "lastAt": row["ts"],
            }
        bucket = buckets[key]
        bucket["lookupCount"] += 1
        if row["ts"] >= bucket["lastAt"]:
            bucket["lastAt"] = row["ts"]
        aid = row.get("accountId")
        if aid is not None:
            bucket["accountIds"].add(aid)
    return buckets


def _public_row(bucket: dict[str, Any], *, include_count: bool) -> dict[str, Any]:
    """Owner rows include lookupCount; reader count only when more than one account."""
    account_count = len(bucket["accountIds"])
    out: dict[str, Any] = {
        "title": bucket["title"],
        "author": bucket["author"],
        "lastAt": bucket["lastAt"],
        "lookupCount": int(bucket.get("lookupCount") or 0),
    }
    if include_count and account_count > 1:
        out["accountCount"] = account_count
    elif include_count and account_count == 1:
        out["accountCount"] = 1
    return out


def _rows_excluding_account(rows: list[dict[str, Any]], account_id: int | None) -> list[dict[str, Any]]:
    if account_id is None:
        return rows
    return [r for r in rows if r.get("accountId") != account_id]


def _rows_for_account(rows: list[dict[str, Any]], account_id: int | None) -> list[dict[str, Any]]:
    if account_id is None:
        return []
    return [r for r in rows if r.get("accountId") == account_id]


def owner_lookup_aggregated(
    log_path: str, limit: int = 80, *, exclude_account_id: int | None = None
) -> list[dict[str, Any]]:
    vet_index = _vet_index()
    rows = _rows_excluding_account(_read_log_rows(log_path), exclude_account_id)
    buckets = _aggregate_buckets(rows, vet_index)
    ranked = sorted(
        buckets.values(),
        key=lambda x: (-len(x["accountIds"]), -x["lookupCount"], -x["lastAt"], x["title"].lower()),
    )
    return [_public_row(b, include_count=True) for b in ranked[:limit]]


def owner_lookup_recent(
    log_path: str, limit: int = 40, *, exclude_account_id: int | None = None
) -> list[dict[str, Any]]:
    vet_index = _vet_index()
    rows = _rows_excluding_account(_read_log_rows(log_path), exclude_account_id)
    buckets = _aggregate_buckets(rows, vet_index)
    ranked = sorted(buckets.values(), key=lambda x: (-x["lastAt"], x["title"].lower()))
    return [_public_row(b, include_count=True) for b in ranked[:limit]]


def owner_lookup_for_account(log_path: str, account_id: int | None, limit: int = 50) -> list[dict[str, Any]]:
    vet_index = _vet_index()
    rows = _rows_for_account(_read_log_rows(log_path), account_id)
    buckets = _aggregate_buckets(rows, vet_index)
    ranked = sorted(buckets.values(), key=lambda x: (-x["lastAt"], x["title"].lower()))
    return [_public_row(b, include_count=False) for b in ranked[:limit]]


_roster_cache: dict[str, Any] | None = None
_roster_cache_path: str = ""


def _load_hand_vet_roster(roster_path: str) -> dict[str, Any]:
    global _roster_cache, _roster_cache_path
    if not roster_path or not os.path.isfile(roster_path):
        return {}
    if _roster_cache is not None and _roster_cache_path == roster_path:
        return _roster_cache
    try:
        with open(roster_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        data = {}
    if not isinstance(data, dict):
        data = {}
    _roster_cache = data
    _roster_cache_path = roster_path
    return data


def _roster_settled(title: str, author: str, roster: dict[str, Any]) -> bool:
    if not roster:
        return False
    key = lookup_group_key(title, author)
    title_norm = _title_norm_key(title)
    for bucket in ("vetted", "rejected"):
        entries = roster.get(bucket)
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            et = str(entry.get("title") or "").strip()
            ea = str(entry.get("author") or "").strip()
            if lookup_group_key(et, ea) == key:
                return True
            if _title_norm_key(et) == title_norm and not ea:
                return True
    return False


def owner_review_pending_kind(
    log_path: str,
    title: str,
    author: str = "",
    *,
    roster_path: str = "",
    exclude_account_id: int | None = None,
) -> str | None:
    """Return 'popular' (on owner TBR with multiple lookups), 'queued' (first logged search), or None."""
    if not log_path or not (title or "").strip():
        return None
    if is_garbage_lookup(title, author):
        return None
    vet_index = _vet_index()
    if _title_norm_key(title) in vet_index:
        return None
    roster = _load_hand_vet_roster(roster_path)
    if _roster_settled(title, author, roster):
        return None
    key = lookup_group_key(title, author, vet_index)
    rows = _rows_excluding_account(_read_log_rows(log_path), exclude_account_id)
    buckets = _aggregate_buckets(rows, vet_index)
    if key not in buckets:
        return None
    count = int(buckets[key].get("lookupCount") or 0)
    if count >= 2:
        return "popular"
    return "queued"


def owner_review_pending_for_title(
    log_path: str,
    title: str,
    author: str = "",
    *,
    roster_path: str = "",
    exclude_account_id: int | None = None,
) -> bool:
    """True when readers have looked this up and owner has not hand-settled it (roster or on-site vet)."""
    return owner_review_pending_kind(
        log_path,
        title,
        author,
        roster_path=roster_path,
        exclude_account_id=exclude_account_id,
    ) is not None
