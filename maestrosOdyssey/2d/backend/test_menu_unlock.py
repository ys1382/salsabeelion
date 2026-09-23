"""Café board opens through the week (#26), not by ordering the starter trio."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAFE = ROOT / "ui" / "cafe_order.gd"
INTERACT = ROOT / "actors" / "interactable.gd"
DIALOGUE = ROOT / "ui" / "dialogue_ui.gd"
BOARD = ROOT / "world" / "menu_board.gd"
INTERIOR = ROOT / "world" / "interior.gd"
STREET = ROOT / "world" / "street_sign.gd"


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
    assert "leche" in cafe
    assert "crema" in cafe
    assert "calentado" in cafe
    assert "frío" in cafe
    assert '"needles": ["frío", "frio"]' in cafe
    assert '"needles": ["frío", "frio", "iced", "chilled"]' not in cafe
    assert "espresso" in cafe and '"unlock_day": 7' in cafe
    assert "needs_con" in cafe
    assert "Extras use con" in cafe
    assert '"needles": ["azúcar", "azucar"]' in cafe
    assert '"needles": ["azúcar", "azucar", "sugar"]' not in cafe
    assert '"pesos": 48' in cafe and '"pesos": 40' in cafe
    assert '"pesos": 22' in cafe and '"pesos": 32' in cafe
    assert "drink_menu" in interact and "board_text" in interact
    board = BOARD.read_text(encoding="utf-8")
    assert 'label := "MENU"' in board
    interior = INTERIOR.read_text(encoding="utf-8")
    assert 'entry.get("id", "")) == "drink_menu"' in interior
    assert "MenuBoard" in interior
    street = STREET.read_text(encoding="utf-8")
    assert "drink_menu" not in street
    assert "MENU" not in street
    assert "custom_minimum_size" in dialogue
    assert "I'll get that started" not in cafe
    print("menu unlock: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
