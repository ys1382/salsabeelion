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
    assert "PRACTICE_PESOS" in cafe and "PRACTICE_MAX_DAY" in cafe
    assert "_remember" in cafe and "ordered" in cafe
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
