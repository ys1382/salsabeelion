"""Owner Office — Bookcheck scan summaries + Bookchecks vs TBR bucket."""
from __future__ import annotations

import json
import os
import sqlite3
import time
from typing import Any

from halalit_lookup_log import lookup_group_key

# Themes that mean “essentially not Halalit material” if review/scan signals are right.
# Soft reader-preference themes (magic, light romance, etc.) stay off this list.
HARD_AUTO_REJECT_THEME_IDS: frozenset[str] = frozenset(
    {
        "lgbtq",
        "adult_romance",
        "illegitimate_children",
        "romanticized_crime",
        "group_demonization",
        "pro_colonial_narrative",
        "crude_profanity",
    }
)

THEME_SUMMARY_LABELS: dict[str, str] = {
    "lgbtq": "LGBTQ themes in reviews/scans",
    "adult_romance": "adult romance",
    "illegitimate_children": "plot centered on illegitimate children",
    "romanticized_crime": "glorified toxic or criminal behavior",
    "group_demonization": "group demonization",
    "pro_colonial_narrative": "pro-colonial narrative",
    "crude_profanity": "harsh/crude profanity",
}


def _db_path() -> str:
    return os.environ.get(
        "HALALIT_ACCOUNTS_DB",
        os.path.expanduser("~/kids-sites/halalit-server/halalit_accounts.sqlite"),
    )


def _connect() -> sqlite3.Connection:
    path = _db_path()
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_signals_table(conn: sqlite3.Connection | None = None) -> None:
    own = conn is None
    if own:
        conn = _connect()
    assert conn is not None
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS owner_lookup_signals (
            group_key TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT NOT NULL DEFAULT '',
            summary TEXT NOT NULL DEFAULT '',
            bucket TEXT NOT NULL DEFAULT 'tbr',
            themes_json TEXT NOT NULL DEFAULT '[]',
            auto_reject INTEGER NOT NULL DEFAULT 0,
            updated_at REAL NOT NULL
        )
        """
    )
    if own:
        conn.commit()
        conn.close()


def present_hard_theme_ids(themes: list[dict[str, Any]] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for row in themes or []:
        if not isinstance(row, dict):
            continue
        tid = str(row.get("id") or "").strip()
        if tid not in HARD_AUTO_REJECT_THEME_IDS or tid in seen:
            continue
        if not row.get("present"):
            continue
        brief = str(row.get("brief") or "")
        # Skip obvious denial briefs when present slipped through.
        if tid == "lgbtq" and (
            "not confirmed on-page" in brief.lower()
            or "subtext only" in brief.lower()
            or "reader speculation" in brief.lower()
        ):
            continue
        seen.add(tid)
        out.append(tid)
    return out


def build_owner_summary(
    themes: list[dict[str, Any]] | None = None,
    *,
    auto_reject: bool = False,
    explainers: list[str] | None = None,
    fallback: str = "",
) -> str:
    hard = present_hard_theme_ids(themes)
    if hard:
        labels = [THEME_SUMMARY_LABELS.get(t, t) for t in hard]
        return "HalaLit scanners found: " + "; ".join(labels) + "."
    if explainers:
        bits = [str(e).strip().rstrip(".") for e in explainers if str(e).strip()]
        if bits:
            joined = "; ".join(bits[:3])
            if len(joined) > 220:
                joined = joined[:217].rstrip() + "…"
            return "HalaLit flagged: " + joined + "."
    if auto_reject and fallback:
        return str(fallback).strip()[:240]
    if fallback:
        return str(fallback).strip()[:240]
    return ""


def classify_bucket(
    themes: list[dict[str, Any]] | None = None,
    *,
    auto_reject: bool = False,
) -> str:
    if auto_reject or present_hard_theme_ids(themes):
        return "bookcheck"
    return "tbr"


def upsert_lookup_signal(
    title: str,
    author: str = "",
    *,
    summary: str = "",
    bucket: str = "",
    themes: list[dict[str, Any]] | None = None,
    auto_reject: bool = False,
) -> dict[str, Any]:
    title = (title or "").strip()[:300]
    author = (author or "").strip()[:200]
    if not title:
        return {"ok": False, "error": "title_required"}
    ensure_signals_table()
    themes_list = [t for t in (themes or []) if isinstance(t, dict)]
    hard = present_hard_theme_ids(themes_list)
    auto = bool(auto_reject) or bool(hard)
    use_bucket = (bucket or "").strip()
    if use_bucket not in ("bookcheck", "tbr"):
        use_bucket = classify_bucket(themes_list, auto_reject=auto)
    use_summary = (summary or "").strip()[:400]
    if not use_summary:
        use_summary = build_owner_summary(themes_list, auto_reject=auto)
    if use_bucket == "tbr" and not use_summary:
        use_summary = "Little or no clear auto-reject signal yet — candidate for hand-read."
    key = lookup_group_key(title, author)
    now = time.time()
    themes_json = json.dumps(
        [{"id": t.get("id"), "present": bool(t.get("present")), "brief": str(t.get("brief") or "")[:280]} for t in themes_list],
        ensure_ascii=False,
    )
    with _connect() as conn:
        ensure_signals_table(conn)
        conn.execute(
            """
            INSERT INTO owner_lookup_signals
                (group_key, title, author, summary, bucket, themes_json, auto_reject, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(group_key) DO UPDATE SET
                title = excluded.title,
                author = excluded.author,
                summary = CASE
                    WHEN excluded.summary != '' THEN excluded.summary
                    ELSE owner_lookup_signals.summary
                END,
                bucket = CASE
                    WHEN excluded.bucket = 'bookcheck' OR owner_lookup_signals.bucket = 'bookcheck'
                    THEN 'bookcheck'
                    ELSE excluded.bucket
                END,
                themes_json = CASE
                    WHEN excluded.themes_json != '[]' THEN excluded.themes_json
                    ELSE owner_lookup_signals.themes_json
                END,
                auto_reject = CASE
                    WHEN excluded.auto_reject = 1 OR owner_lookup_signals.auto_reject = 1 THEN 1
                    ELSE 0
                END,
                updated_at = excluded.updated_at
            """,
            (key, title, author, use_summary, use_bucket, themes_json, 1 if auto else 0, now),
        )
        conn.commit()
    return {
        "ok": True,
        "groupKey": key,
        "summary": use_summary,
        "bucket": use_bucket,
        "autoReject": auto,
        "hardThemes": hard,
    }


def get_signal_map() -> dict[str, dict[str, Any]]:
    ensure_signals_table()
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT group_key, title, author, summary, bucket, themes_json, auto_reject, updated_at
            FROM owner_lookup_signals
            """
        ).fetchall()
    out: dict[str, dict[str, Any]] = {}
    for r in rows:
        try:
            themes = json.loads(r["themes_json"] or "[]")
        except json.JSONDecodeError:
            themes = []
        out[str(r["group_key"])] = {
            "title": r["title"],
            "author": r["author"],
            "summary": r["summary"] or "",
            "bucket": r["bucket"] or "tbr",
            "themes": themes if isinstance(themes, list) else [],
            "autoReject": bool(r["auto_reject"]),
            "updatedAt": r["updated_at"],
        }
    return out


def attach_signals_to_lookups(lookups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    signals = get_signal_map()
    out: list[dict[str, Any]] = []
    for row in lookups:
        item = dict(row)
        key = lookup_group_key(str(row.get("title") or ""), str(row.get("author") or ""))
        sig = signals.get(key)
        if sig:
            item["summary"] = sig.get("summary") or ""
            item["bucket"] = sig.get("bucket") or "tbr"
            item["autoReject"] = bool(sig.get("autoReject"))
            item["signalThemes"] = sig.get("themes") or []
            item["hasSignal"] = True
        else:
            item["summary"] = ""
            item["bucket"] = "unknown"
            item["autoReject"] = False
            item["signalThemes"] = []
            item["hasSignal"] = False
        item["groupKey"] = key
        out.append(item)
    return out


def list_missing_signal_titles(
    lookups: list[dict[str, Any]], limit: int = 8
) -> list[dict[str, str]]:
    signals = get_signal_map()
    missing: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in lookups:
        title = str(row.get("title") or "").strip()
        author = str(row.get("author") or "").strip()
        if not title:
            continue
        key = lookup_group_key(title, author)
        if key in seen or key in signals:
            continue
        seen.add(key)
        missing.append({"title": title, "author": author, "groupKey": key})
        if len(missing) >= limit:
            break
    return missing


def signal_from_theme_scan_result(
    title: str, author: str, result: dict[str, Any]
) -> dict[str, Any]:
    themes = result.get("themes") if isinstance(result.get("themes"), list) else []
    return upsert_lookup_signal(title, author, themes=themes, auto_reject=False)
