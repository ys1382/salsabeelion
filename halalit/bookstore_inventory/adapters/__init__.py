"""Bookstore adapter registry."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .base import BookstoreAdapter
from .registry import get_registered, register_adapter

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config" / "stores"

__all__ = [
    "BookstoreAdapter",
    "CONFIG_DIR",
    "get_adapter",
    "list_configured_store_ids",
    "load_store_config",
    "register_adapter",
]


def load_store_config(store_id: str) -> dict[str, Any]:
    path = CONFIG_DIR / f"{store_id}.json"
    if not path.is_file():
        raise FileNotFoundError(store_id)
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("invalid store config")
    return data


def _ensure_registered() -> None:
    from . import (  # noqa: F401
        barnes_noble,
        green_apple,
        indiecommerce_generic,
        keplers,
        kinokuniya_sf,
        sample_fixture,
    )


def get_adapter(store_id: str, config: dict[str, Any] | None = None) -> BookstoreAdapter:
    _ensure_registered()
    cfg = config or load_store_config(store_id)
    adapter_key = str(cfg.get("adapter") or store_id)
    cls = get_registered(store_id) or get_registered(adapter_key)
    if cls is None:
        raise KeyError(f"unknown adapter for {store_id}")
    return cls(cfg)  # type: ignore[call-arg]


def list_configured_store_ids() -> list[str]:
    if not CONFIG_DIR.is_dir():
        return []
    return sorted(p.stem for p in CONFIG_DIR.glob("*.json"))
