"""Campfire stays outdoors, behind the house, and the sack carries the wood."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import worldgen

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend" / "dragons_brew_world.json"
GENERATED = ROOT / "generated" / "dragons_brew_world.json"


def _cells(entry: dict) -> set[tuple[int, int]]:
    import catalog

    w, h = catalog.footprint(entry["asset"])
    x0, y0 = int(entry["x"]), int(entry["y"])
    return {(x0 + dx, y0 + dy) for dx in range(w) for dy in range(h)}


def main() -> int:
    world = json.loads(BACKEND.read_text(encoding="utf-8"))
    worldgen.add_item_fields(world)
    worldgen.validate_world(world)
    # The fire is placed in code, not baked into a room.
    blob = BACKEND.read_text(encoding="utf-8") + GENERATED.read_text(encoding="utf-8")
    assert "home_fire" not in blob
    assert "cafe_hearth" not in blob
    for key in ("player_house", "dragons_brew"):
        assets = {o["asset"] for o in world["interiors"][key]["objects"]}
        assert "prop.fireplace_1" not in assets
        assert "prop.sack_3" not in assets

    spot = {(8, 1), (9, 1), (8, 2), (9, 2)}
    house = _cells(next(o for o in world["objects"] if o["id"] == "player_house"))
    cafe = _cells(next(o for o in world["objects"] if o["id"] == "dragons_brew"))
    assert spot.isdisjoint(house)
    assert spot.isdisjoint(cafe)
    # A gap of open grass, and not tucked against the café.
    assert min(cx - sx for sx, _sy in spot for cx, _cy in cafe) >= 4
    blocked, w, h = worldgen._solid_map(world)
    start = (world["player_start"]["x"], world["player_start"]["y"])
    open_cells = worldgen._reachable(blocked, w, h, start)
    assert spot <= open_cells

    state = (ROOT / "ui" / "game_state.gd").read_text(encoding="utf-8")
    assert "func tend_campfire" in state
    assert "func carrying_sack" in state
    assert "campfire_stage" in state
    spot_gd = (ROOT / "world" / "campfire_spot.gd").read_text(encoding="utf-8")
    assert "Campfire.png" in spot_gd
    assert "Fireplace_1.png" in spot_gd
    assert "Rect2(i * 32, 0, 32, 32)" in spot_gd
    interior = (ROOT / "world" / "interior.gd").read_text(encoding="utf-8")
    assert "prop.fireplace_1" not in interior
    assert "Campfire.png" not in interior
    builder = (ROOT / "world" / "world_builder.gd").read_text(encoding="utf-8")
    assert "CAMPFIRE_CELL := Vector2i(8, 1)" in builder
    assert "_place_campfire" in builder
    player = (ROOT / "actors" / "player.gd").read_text(encoding="utf-8")
    assert "Sack_3.png" not in player
    assert "Hud.icon_for" in player
    tasks = (ROOT / "ui" / "task_list.gd").read_text(encoding="utf-8")
    assert "Light the campfire" in tasks
    arrow = (ROOT / "ui" / "waypoint_hud.gd").read_text(encoding="utf-8")
    assert "wood_for_fire" in arrow
    print("campfire: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
