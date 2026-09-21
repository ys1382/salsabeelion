"""Learning card HUD: pickup from the basket, no silent grant, no hearts."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORLD = ROOT / "backend" / "dragons_brew_world.json"
GENERATED = ROOT / "generated" / "dragons_brew_world.json"
HUD = ROOT / "ui" / "hud.gd"
STATE = ROOT / "ui" / "game_state.gd"


def _check_world(path: Path) -> None:
    world = json.loads(path.read_text(encoding="utf-8"))
    elder = next(n for n in world["npcs"] if n["id"] == "elder")
    assert elder.get("gives_item", "") == "", (
        "elder must not silently put the card in the bag")
    assert elder.get("reveal_beat", "") == "", (
        "card_granted should fire on pickup, not on the first hello")
    last = str(elder["scripted_lines"][-1]).lower()
    assert "basket" in last, "elder should point at the basket"
    basket = next(i for i in world["interactables"] if i["id"] == "card_basket")
    assert basket.get("gives_item") == "learning_card"
    assert basket.get("beat") == "card_granted"


def main() -> int:
    _check_world(WORLD)
    _check_world(GENERATED)
    hud = HUD.read_text(encoding="utf-8")
    assert "♥" not in hud and "♡" not in hud
    assert "MAX_HP" not in hud
    assert "learning_card" in hud
    assert "Week %d" in hud
    assert "pesos" in hud
    state = STATE.read_text(encoding="utf-8")
    assert "CARD_START_PESOS" in state
    assert "weekday" in state and "week_number" in state
    assert "card_balance" in state
    assert "refill_card" in state
    print("learning card hud: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
