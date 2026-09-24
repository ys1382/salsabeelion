"""After a finished meal, dishes go in the cart and the Spanish goodbye is required."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAFE = ROOT / "ui" / "cafe_order.gd"
INTERIORS = ROOT / "world" / "interiors.gd"
DIALOGUE = ROOT / "ui" / "dialogue_ui.gd"
WAYPOINT = ROOT / "ui" / "waypoint_hud.gd"
BACKEND = ROOT / "backend" / "dragons_brew_world.json"
GENERATED = ROOT / "generated" / "dragons_brew_world.json"


def _fn(src: str, name: str) -> str:
    marker = f"func {name}("
    rest = src.split(marker, 1)[1]
    return rest.split("\nfunc ", 1)[0]


def _cart(path: Path) -> None:
    world = json.loads(path.read_text(encoding="utf-8"))
    cafe = world["interiors"]["dragons_brew"]
    obj = next(o for o in cafe["objects"] if o["id"] == "dish_cart")
    assert obj["asset"] == "prop.crate_large_empty"
    it = next(i for i in cafe["interactables"] if i["id"] == "dish_cart")
    assert it.get("on") == "dish_cart"


def main() -> int:
    cafe = CAFE.read_text(encoding="utf-8")
    interiors = INTERIORS.read_text(encoding="utf-8")
    dialogue = DIALOGUE.read_text(encoding="utf-8")
    waypoint = WAYPOINT.read_text(encoding="utf-8")

    _cart(BACKEND)
    _cart(GENERATED)

    assert "Adiós, and buenas noches" in cafe
    assert "Adiós, y buenas noches" in cafe
    assert "goodbye, and good night" in cafe
    spoken = _fn(cafe, "_goodbye_spoken")
    expected = _fn(cafe, "_goodbye_expected")
    assert "day_index >= 2" in spoken
    assert "day_index >= 2" in expected
    assert "day_index >= 3" not in spoken
    assert "day_index >= 3" not in expected
    assert "day_index >= 2" in _fn(cafe, "needs_y")
    assert "day_index >= 3" in _fn(cafe, "needs_con")
    assert "day_index >= 4" in _fn(cafe, "needs_article")
    assert "carrying_dishes" in cafe
    assert "awaiting_bye" in cafe
    bye = _fn(cafe, "_bye_reply")
    assert "Mara smiles and nods." in bye
    assert "Adiós" not in bye
    assert "buenas noches" not in bye
    assert "goodbye_done = true" in bye
    assert "advance_day" not in bye
    blocked_line = _fn(cafe, "leave_blocked_line")
    assert "buenas noches" not in blocked_line
    assert "Adiós" not in blocked_line
    leave = _fn(cafe, "leave_cafe")
    assert "advance_day" not in leave
    blocked = _fn(interiors, "leave")
    assert "may_leave" in blocked
    assert "leave_cafe()" in blocked
    assert blocked.index("may_leave") < blocked.index("leave_cafe()")
    assert "goodbye_box_hint" in dialogue
    assert "Type your order, then Enter" in dialogue
    arrow = _fn(waypoint, "current_id")
    assert "dish_cart" in arrow
    assert arrow.index("dish_cart") < arrow.index("player_house")
    arrived = _fn(waypoint, "at_destination")
    assert 'id == "dish_cart"' in arrived
    target = _fn(waypoint, "_target_pos")
    assert "Objects/dish_cart" in target
    print("cafe closeout: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
