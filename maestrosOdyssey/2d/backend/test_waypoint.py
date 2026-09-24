"""Spawn at the cottage; a small arrow points to the next stop — not a map."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import worldgen

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend" / "dragons_brew_world.json"
GENERATED = ROOT / "generated" / "dragons_brew_world.json"
WAYPOINT = ROOT / "ui" / "waypoint_hud.gd"
PROJECT = ROOT / "project.godot"
VERIFY = ROOT.parents[0] / "scripts" / "verify-maestros.sh"
HUD = ROOT / "ui" / "hud.gd"

HOUSE_TILES = (6, 6)


def _check_world(path: Path) -> None:
    world = json.loads(path.read_text(encoding="utf-8"))
    worldgen.add_item_fields(world)
    worldgen.validate_world(world)
    start = (int(world["player_start"]["x"]), int(world["player_start"]["y"]))
    house = next(o for o in world["objects"] if o["id"] == "player_house")
    hx, hy = int(house["x"]), int(house["y"])
    fw, fh = HOUSE_TILES
    inside = hx <= start[0] < hx + fw and hy <= start[1] < hy + fh
    assert not inside, f"spawn {start} is inside the cottage footprint"
    assert start[1] >= hy + fh, f"spawn {start} should be south of the cottage"
    assert abs(start[0] - (hx + fw // 2)) <= 2, f"spawn {start} should face the door"


def main() -> int:
    _check_world(BACKEND)
    _check_world(GENERATED)
    backend = json.loads(BACKEND.read_text(encoding="utf-8"))
    generated = json.loads(GENERATED.read_text(encoding="utf-8"))
    assert backend["player_start"] == generated["player_start"]

    gd = WAYPOINT.read_text(encoding="utf-8")
    assert "func current_id()" in gd
    assert "func at_destination()" in gd
    for stop in ("elder", "card_basket", "dragons_brew", "player_house"):
        assert stop in gd, f"arrow must know {stop}"
    assert "ARRIVE_PX" not in gd, "do not hide just because a nearby house is close"
    assert "_focus_id" in gd
    assert "npc_id" in gd
    assert "it.enters" in gd
    assert "building_id" in gd
    assert "Doorway" in gd
    assert "FADE_OUT" in gd
    assert "minimap" not in gd.lower()
    assert "PROCESS_MODE_ALWAYS" in gd
    assert "func marker_name" in gd
    assert "Café" in gd
    assert "Elder" in gd
    assert "BOUNCE_PX" in gd
    assert "_edge_point" in gd
    assert "blunt end" in gd
    assert "_pointing_outside" in gd
    assert "_over_person" not in gd
    assert "_add_mark" not in gd
    assert "nav_target" in gd
    assert "leave" in gd

    project = PROJECT.read_text(encoding="utf-8")
    assert "WaypointHud=" in project
    assert "TaskList=" in project
    tasks = (ROOT / "ui" / "task_list.gd").read_text(encoding="utf-8")
    assert "Today" in tasks
    assert "_toggle" in tasks
    assert "Talk to the elder" in tasks
    assert "Go home" in tasks
    signs = (ROOT / "world" / "street_sign.gd").read_text(encoding="utf-8")
    assert "Dragon's Brew" in signs
    assert "player_house" not in signs
    assert "elder_house" not in signs
    assert "PLANK_A" in signs
    assert "drink_menu" not in signs
    assert "house_board" not in signs
    builder = (ROOT / "world" / "world_builder.gd").read_text(encoding="utf-8")
    assert "_place_street_signs" in builder
    player = (ROOT / "actors" / "player.gd").read_text(encoding="utf-8")
    assert "caption_for" in player
    assert 'id == "house_board"' in player
    hud = HUD.read_text(encoding="utf-8")
    assert "♥" not in hud and "MAX_HP" not in hud
    verify = VERIFY.read_text(encoding="utf-8")
    assert "test_waypoint.py" in verify
    print("waypoint: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
