"""Weekday turns when you enter your house after finishing a paid café meal."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAFE = ROOT / "ui" / "cafe_order.gd"
INTERIORS = ROOT / "world" / "interiors.gd"
STATE = ROOT / "ui" / "game_state.gd"
JOURNAL = ROOT / "ui" / "journal.gd"
PLAYER = ROOT / "actors" / "player.gd"


def _fn(src: str, name: str) -> str:
    marker = f"func {name}("
    rest = src.split(marker, 1)[1]
    return rest.split("\nfunc ", 1)[0]


def main() -> int:
    cafe = CAFE.read_text(encoding="utf-8")
    interiors = INTERIORS.read_text(encoding="utf-8")
    state = STATE.read_text(encoding="utf-8")
    journal = JOURNAL.read_text(encoding="utf-8")
    player = PLAYER.read_text(encoding="utf-8")

    assert "meal_done" in cafe
    assert 'NIGHT_PASS_LINE := "Night passes. It\'s morning."' in cafe
    assert "try_night_pass" in cafe
    assert "cafe_meal_done" in state
    assert "note_cafe_meal_done" in state
    assert "advance_day" in state

    leave = _fn(cafe, "leave_cafe")
    assert "advance_day" not in leave, "leaving the café must not tick the weekday"
    assert "_clear_order" in leave

    night = _fn(state, "try_night_pass")
    assert "cafe_meal_done" in night and "advance_day" in night

    sip = _fn(cafe, "sip")
    bite = _fn(cafe, "bite")
    assert "_mark_meal_if_done" in sip and "_mark_meal_if_done" in bite
    assert "cup_left = 4 if _drink" in cafe
    assert "muffin_left = 3 if _food" in cafe
    practice = _fn(cafe, "_practice_reply")
    assert "note_cafe_meal_done" in practice
    assert "_remember" in practice
    assert "if not seated" in _fn(player, "try_sip")
    assert "if not seated" in _fn(player, "try_bite")

    reset = _fn(cafe, "reset_session")
    assert "meal_done = false" in reset

    clear = _fn(cafe, "_clear_order")
    assert "meal_done" not in clear, "finishing a meal must survive leaving the café"

    assert "player_house" in interiors
    assert "try_night_pass" in interiors
    assert "show_night_pass" in interiors
    assert "call_deferred" in interiors
    assert "show_night_pass" in journal
    assert 'building_id == "dragons_brew"' in interiors
    assert "leave_cafe()" in interiors
    print("night pass: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
