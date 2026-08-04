"""Background jobs for bookstore inventory (APScheduler when available)."""
from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any

from ..adapters import list_configured_store_ids
from ..models import connect, init_schema
from ..service import run_adapter_job, seed_stores_from_config

logger = logging.getLogger("halalit.bookstore.jobs")

_SCHEDULER = None
_LOCK = threading.Lock()
MAX_CONCURRENT = int(os.environ.get("HALALIT_BOOKSTORE_MAX_CONCURRENT", "2"))
_SEMAPHORE = threading.Semaphore(MAX_CONCURRENT)


def acquire_job_lock(lock_key: str, holder: str, ttl_sec: float = 3600) -> bool:
    conn = connect()
    try:
        init_schema(conn)
        now = time.time()
        conn.execute("DELETE FROM bookstore_job_locks WHERE expires_at < ?", (now,))
        row = conn.execute(
            "SELECT holder, expires_at FROM bookstore_job_locks WHERE lock_key=?",
            (lock_key,),
        ).fetchone()
        if row and row["expires_at"] > now and row["holder"] != holder:
            return False
        conn.execute(
            """
            INSERT INTO bookstore_job_locks(lock_key, holder, expires_at)
            VALUES (?,?,?)
            ON CONFLICT(lock_key) DO UPDATE SET holder=excluded.holder, expires_at=excluded.expires_at
            """,
            (lock_key, holder, now + ttl_sec),
        )
        conn.commit()
        return True
    finally:
        conn.close()


def release_job_lock(lock_key: str, holder: str) -> None:
    conn = connect()
    try:
        conn.execute(
            "DELETE FROM bookstore_job_locks WHERE lock_key=? AND holder=?",
            (lock_key, holder),
        )
        conn.commit()
    finally:
        conn.close()


def run_stale_detection() -> dict[str, Any]:
    conn = connect()
    try:
        init_schema(conn)
        now = time.time()
        # Mark listings older than store stale threshold.
        updated = 0
        for row in conn.execute("SELECT store_id, stale_threshold_hours FROM bookstores").fetchall():
            cutoff = now - float(row["stale_threshold_hours"] or 168) * 3600
            cur = conn.execute(
                """
                UPDATE bookstore_listings
                SET is_stale=1
                WHERE store_id=? AND last_checked_at IS NOT NULL AND last_checked_at < ?
                """,
                (row["store_id"], cutoff),
            )
            updated += cur.rowcount or 0
        conn.commit()
        return {"ok": True, "marked_stale": updated}
    finally:
        conn.close()


def run_all_store_jobs(job_type: str = "isbn_watchlist") -> list[dict[str, Any]]:
    seed_stores_from_config()
    results: list[dict[str, Any]] = []
    holder = f"worker-{os.getpid()}"
    for store_id in list_configured_store_ids():
        if store_id != "sample_fixture" and job_type == "fixture_refresh":
            continue
        lock_key = f"bookstore:{store_id}:{job_type}"
        if not acquire_job_lock(lock_key, holder):
            results.append({"ok": False, "store_id": store_id, "error": "job_already_running"})
            continue
        if not _SEMAPHORE.acquire(blocking=False):
            release_job_lock(lock_key, holder)
            results.append({"ok": False, "store_id": store_id, "error": "concurrency_limit"})
            continue
        try:
            # Isolate failures per store.
            results.append(run_adapter_job(store_id, job_type=job_type))
        except Exception as e:
            logger.exception("unexpected job failure %s", store_id)
            results.append({"ok": False, "store_id": store_id, "error": type(e).__name__})
        finally:
            _SEMAPHORE.release()
            release_job_lock(lock_key, holder)
    run_stale_detection()
    return results


def start_scheduler() -> Any:
    """Start APScheduler if installed and HALALIT_BOOKSTORE_JOBS=1."""
    global _SCHEDULER
    if os.environ.get("HALALIT_BOOKSTORE_JOBS", "").strip() not in ("1", "true", "yes"):
        logger.info("bookstore jobs scheduler not started (set HALALIT_BOOKSTORE_JOBS=1)")
        return None
    with _LOCK:
        if _SCHEDULER is not None:
            return _SCHEDULER
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
        except ImportError:
            logger.warning("APScheduler not installed — bookstore jobs disabled")
            return None
        sched = BackgroundScheduler()
        minutes = int(os.environ.get("HALALIT_BOOKSTORE_JOB_MINUTES", "180"))
        sched.add_job(
            lambda: run_all_store_jobs("isbn_watchlist"),
            "interval",
            minutes=minutes,
            id="bookstore_isbn_watchlist",
            max_instances=1,
            coalesce=True,
        )
        sched.add_job(
            run_stale_detection,
            "interval",
            minutes=60,
            id="bookstore_stale",
            max_instances=1,
            coalesce=True,
        )
        sched.start()
        _SCHEDULER = sched
        logger.info("bookstore jobs scheduler started (every %s minutes)", minutes)
        return sched
