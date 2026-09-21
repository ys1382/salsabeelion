"""Café board opens through the week (#26), not by ordering the starter trio."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAFE = ROOT / "ui" / "cafe_order.gd"
INTERACT = ROOT / "actors" / "interactable.gd"
DIALOGUE = ROOT / "ui" / "dialogue_ui.gd"


def main() -> int:
    cafe = CAFE.read_text(encoding="utf-8")
    interact = INTERACT.read_text(encoding="utf-8")
    dialogue = DIALOGUE.read_text(encoding="utf-8")
    assert "unlock_day" in cafe and "board_text" in cafe
    assert "visible_items" in cafe and "new_today" in cafe
    assert '"unlock_day": 1' in cafe
    assert "chocolate caliente" in cafe and '"unlock_day": 2' in cafe
    assert "tostada" in cafe and '"unlock_day": 3' in cafe
    assert "galleta" in cafe and '"unlock_day": 4' in cafe
    assert "bolillo" in cafe and '"unlock_day": 5' in cafe
    assert "croissant" in cafe and '"unlock_day": 6' in cafe
    assert "azúcar" in cafe
    assert "espresso" in cafe and '"unlock_day": 7' in cafe
    assert "creamer" in cafe
    assert '"pesos": 48' in cafe and '"pesos": 40' in cafe
    assert '"pesos": 22' in cafe and '"pesos": 32' in cafe
    assert "drink_menu" in interact and "board_text" in interact
    assert "custom_minimum_size" in dialogue
    assert "I'll get that started" not in cafe
    print("menu unlock: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
