"""When the card is short, Mara practices a board word not yet ordered."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAFE = ROOT / "ui" / "cafe_order.gd"
STATE = ROOT / "ui" / "game_state.gd"
DIALOGUE = ROOT / "ui" / "dialogue_ui.gd"


def main() -> int:
    cafe = CAFE.read_text(encoding="utf-8")
    state = STATE.read_text(encoding="utf-8")
    dialogue = DIALOGUE.read_text(encoding="utf-8")
    assert "too_broke_to_order" in cafe
    assert "cheapest_pair_price" in cafe
    assert "A drink and a food" in cafe
    assert "something to eat with it" in cafe
    assert "a drink to go with it" in cafe
    assert "PRACTICE_PESOS" in cafe and "PRACTICE_MAX_DAY" in cafe
    assert "_remember" in cafe and "ordered" in cafe
    practice = cafe.split("func _practice_reply", 1)[1].split("\nfunc ", 1)[0]
    assert "_remember" in practice
    assert "note_cafe_meal_done" in practice
    pick = cafe.split("func _practice_pick", 1)[1].split("\nfunc ", 1)[0]
    assert "rotated" in pick
    broke = cafe.split("func too_broke_to_order", 1)[1].split("\nfunc ", 1)[0]
    assert "cheapest_pair_price" in broke
    assert "bal <= 0" not in broke
    assert "practice what's on the board" in cafe
    assert "learning program added" in cafe
    assert "show_order_box" in dialogue
    assert "Type your order, then Enter" in dialogue
    assert "Here you go" in cafe and "that's ready" in cafe
    assert "I'll get that started" not in cafe
    assert "add_balance" in state
    assert "reset_session" in cafe and "reset_session" in state
    print("cafe practice: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
