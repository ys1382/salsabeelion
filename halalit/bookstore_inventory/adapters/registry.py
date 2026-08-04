"""Adapter class registry (import-safe)."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .base import BookstoreAdapter

_REGISTRY: dict[str, type] = {}


def register_adapter(cls: type) -> type:
    sid = getattr(cls, "store_id", None)
    if not sid:
        raise ValueError("adapter missing store_id")
    _REGISTRY[str(sid)] = cls
    return cls


def get_registered(store_id: str) -> type | None:
    return _REGISTRY.get(store_id)


def all_registered() -> dict[str, type]:
    return dict(_REGISTRY)
