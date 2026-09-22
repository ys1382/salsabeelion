"""Dragon's Brew authored world must stay playable without an API key."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import worldgen

WORLD = Path(__file__).resolve().parent / "dragons_brew_world.json"


def main() -> int:
    world = json.loads(WORLD.read_text())
    worldgen.add_item_fields(world)
    worldgen.validate_world(world)
    assert world["title"] == "Dragon's Brew"
    assert world["rival"] == {}
    assert world["enemies"] == []
    names = {n["id"] for n in world["npcs"]}
    assert names == {"elder", "mara", "iguana_neighbor", "riverfolk_neighbor"}
    mara = next(n for n in world["npcs"] if n["id"] == "mara")
    assert mara["inside"] == "dragons_brew"
    assert mara.get("look") == "campire"
    iguana = next(n for n in world["npcs"] if n["id"] == "iguana_neighbor")
    riverfolk = next(n for n in world["npcs"] if n["id"] == "riverfolk_neighbor")
    assert iguana["inside"] == "dragons_brew"
    assert riverfolk["inside"] == "dragons_brew"
    assert int(iguana["inside_x"]) == 11 and int(iguana["inside_y"]) == 7
    assert int(riverfolk["inside_x"]) == 11 and int(riverfolk["inside_y"]) == 3
    assert iguana.get("facing") == "up"
    assert riverfolk.get("facing") == "down"
    cafe_ids = {o["id"] for o in world["interiors"]["dragons_brew"]["objects"]}
    assert "cafe_table" in cafe_ids
    assert "cafe_neighbors_table" in cafe_ids
    assert "Çampire" in mara["scripted_lines"][0]
    interior = world["interiors"]["dragons_brew"]
    beats = {it["beat"] for it in interior["interactables"] if it.get("beat")}
    assert "menu_read" in beats and "house_rules" in beats
    seats = {it["id"] for it in interior["interactables"]}
    assert "cafe_seat" in seats
    houses = {o["id"] for o in world["objects"]}
    assert "player_house" in houses
    home = world["interiors"]["player_house"]
    assert home.get("floor") == "planks"
    home_objects = {o["asset"] for o in home.get("objects", [])}
    assert "prop.crate_medium_closed" in home_objects
    assert "prop.table_medium_1" in home_objects
    assert "prop.fireplace_1" not in home_objects
    cafe_objects = {o["asset"] for o in world["interiors"]["dragons_brew"]["objects"]}
    assert "prop.fireplace_1" not in cafe_objects
    assert "prop.sack_3" not in home_objects
    assert "prop.plant_2" not in home_objects
    print("dragons_brew_world.json: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
