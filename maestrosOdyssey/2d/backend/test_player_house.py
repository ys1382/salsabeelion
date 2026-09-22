"""Player house: closed crate back-right; no campfire/fireplace anywhere in homes."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend" / "dragons_brew_world.json"
GENERATED = ROOT / "generated" / "dragons_brew_world.json"
INTERIOR = ROOT / "world" / "interior.gd"


def _check_world(path: Path) -> None:
    world = json.loads(path.read_text(encoding="utf-8"))
    house = next(o for o in world["objects"] if o["id"] == "player_house")
    assert house["asset"].startswith("building.house")
    door = next(i for i in world["interactables"] if i["id"] == "home_door")
    assert door.get("on") == "player_house"
    home = world["interiors"]["player_house"]
    assert home.get("floor") == "planks"
    object_assets = {o["asset"] for o in home.get("objects", [])}
    assert "prop.crate_medium_closed" in object_assets, "closed crate must draw"
    assert "prop.crate_large_empty" not in object_assets
    assert "prop.table_medium_1" in object_assets
    assert "prop.fireplace_1" not in object_assets
    crate = next(o for o in home["objects"] if o["id"] == "home_crate")
    assert crate["x"] == 10 and crate["y"] == 1
    crate_look = next(
        i for i in home["interactables"] if i["id"] == "home_crate_look")
    assert crate_look.get("on") == "home_crate"
    assert crate_look["asset"] == "prop.crate_medium_closed"
    # Café must not keep the campfire-looking "fireplace" prop either.
    cafe_assets = {o["asset"] for o in world["interiors"]["dragons_brew"]["objects"]}
    assert "prop.fireplace_1" not in cafe_assets
    blob = path.read_text(encoding="utf-8")
    assert "cafe_hearth" not in blob
    assert "home_fire" not in blob


def main() -> int:
    _check_world(BACKEND)
    _check_world(GENERATED)
    gd = INTERIOR.read_text(encoding="utf-8")
    assert 'floor_kind == "planks"' in gd
    assert '"prop.fireplace_1"' not in gd
    assert '"prop.sack_3"' not in gd
    assert '"prop.plant_2"' not in gd
    print("player house: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
