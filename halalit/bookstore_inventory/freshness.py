"""Inventory freshness labels — never claim real-time stock."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(float(value), tz=timezone.utc)
    s = str(value).strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


@dataclass(frozen=True)
class FreshnessRules:
    recently_verified_hours: float = 6.0
    checked_today_hours: float = 24.0
    few_days_hours: float = 72.0
    stale_hours: float = 168.0  # 7 days
    miss_before_unavailable: int = 3


DEFAULT_RULES = FreshnessRules()


def freshness_status(
    last_checked_at: Any,
    *,
    availability: str | None = None,
    consecutive_misses: int = 0,
    verification_failed: bool = False,
    rules: FreshnessRules = DEFAULT_RULES,
    now: datetime | None = None,
) -> dict[str, Any]:
    """
    Return public-safe freshness fields.

    Labels: recently_verified | checked_today | checked_few_days |
            possibly_stale | unavailable | verification_failed
    """
    now = now or _utcnow()
    if verification_failed:
        return {
            "status": "verification_failed",
            "label": "Verification failed",
            "last_checked_at": None,
            "disclaimer": (
                "Halalit could not verify this listing. "
                "Please confirm availability with the bookstore before visiting."
            ),
        }

    avail = (availability or "").strip().lower()
    if avail in ("unavailable", "out_of_stock", "not_found") or consecutive_misses >= rules.miss_before_unavailable:
        checked = _parse_ts(last_checked_at)
        return {
            "status": "unavailable",
            "label": "Unavailable",
            "last_checked_at": checked.isoformat() if checked else None,
            "disclaimer": (
                "Listed as unavailable or no longer found. "
                "Please confirm with the bookstore before visiting."
            ),
        }

    checked = _parse_ts(last_checked_at)
    if not checked:
        return {
            "status": "possibly_stale",
            "label": "Possibly stale",
            "last_checked_at": None,
            "disclaimer": (
                "Inventory is not guaranteed real-time. "
                "Please confirm availability with the bookstore before visiting."
            ),
        }

    age_h = (now - checked).total_seconds() / 3600.0
    if age_h <= rules.recently_verified_hours:
        status, label = "recently_verified", "Recently verified"
    elif age_h <= rules.checked_today_hours:
        status, label = "checked_today", "Checked today"
    elif age_h <= rules.few_days_hours:
        status, label = "checked_few_days", "Checked within the last few days"
    else:
        status, label = "possibly_stale", "Possibly stale"

    human = _human_age(age_h)
    stock_bit = "Listed as in stock" if avail in ("in_stock", "available", "preorder", "") else f"Listed as {avail.replace('_', ' ')}"
    return {
        "status": status,
        "label": label,
        "last_checked_at": checked.isoformat(),
        "age_hours": round(age_h, 2),
        "summary": f"{stock_bit} — last checked {human}.",
        "disclaimer": "Please confirm availability with the bookstore before visiting.",
    }


def _human_age(age_hours: float) -> str:
    if age_hours < 1:
        mins = max(1, int(round(age_hours * 60)))
        return f"{mins} minute{'s' if mins != 1 else ''} ago"
    if age_hours < 48:
        h = int(round(age_hours))
        return f"{h} hour{'s' if h != 1 else ''} ago"
    days = int(round(age_hours / 24))
    return f"{days} day{'s' if days != 1 else ''} ago"
