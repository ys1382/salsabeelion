"""Pesos deduct on order; weekday and week turn when you leave after paying."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAFE = ROOT / "ui" / "cafe_order.gd"
STATE = ROOT / "ui" / "game_state.gd"
INTERIORS = ROOT / "world" / "interiors.gd"
HUD = ROOT / "ui" / "hud.gd"


def main() -> int:
    cafe = CAFE.read_text(encoding="utf-8")
    state = STATE.read_text(encoding="utf-8")
    interiors = INTERIORS.read_text(encoding="utf-8")
    hud = HUD.read_text(encoding="utf-8")
    assert '"pesos": 35' in cafe and '"pesos": 30' in cafe and '"pesos": 28' in cafe
    assert "order_total" in cafe and "try_pay" in cafe
    assert "Here you go" in cafe and "that's ready" in cafe
    assert "I'll get that started" not in cafe
    assert "leave_cafe" in cafe and "advance_day" in cafe
    assert "leave_cafe()" in interiors
    assert "try_pay" in state and "advance_day" in state
    assert "add_balance" in state
    assert "WEEKDAYS" in state and "day_index" in state
    assert "card_balance" in hud and "weekday" in hud
    print("cafe clock: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
