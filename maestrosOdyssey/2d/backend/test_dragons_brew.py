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
    assert names == {
        "elder", "mara", "iguana_neighbor", "riverfolk_neighbor",
        "werewolf_fiance", "werewolf_sister", "vampire_neighbor",
        "family_neighbor", "family_brother", "family_aunt", "family_child",
    }
    mara = next(n for n in world["npcs"] if n["id"] == "mara")
    assert mara["inside"] == "dragons_brew"
    assert mara.get("look") == "campire"
    assert mara.get("tint") == "#241c1e"
    iguana = next(n for n in world["npcs"] if n["id"] == "iguana_neighbor")
    riverfolk = next(n for n in world["npcs"] if n["id"] == "riverfolk_neighbor")
    assert iguana.get("species") == "lizardfolk"
    assert iguana["inside"] == "dragons_brew"
    assert riverfolk["inside"] == "dragons_brew"
    assert int(iguana["inside_x"]) == 11 and int(iguana["inside_y"]) == 7
    assert int(riverfolk["inside_x"]) == 11 and int(riverfolk["inside_y"]) == 3
    assert iguana.get("facing") == "up"
    assert riverfolk.get("facing") == "down"
    cafe_ids = {o["id"] for o in world["interiors"]["dragons_brew"]["objects"]}
    assert "cafe_table" in cafe_ids
    assert "cafe_neighbors_table" in cafe_ids
    assert "cafe_tuesday_table" not in cafe_ids
    tuesday = [n for n in world["npcs"] if n["id"] in {
        "werewolf_fiance", "werewolf_sister", "vampire_neighbor",
    }]
    assert len(tuesday) == 3
    for n in tuesday:
        assert n.get("weekdays") == ["Tuesday"]
        assert n["inside"] == "dragons_brew"
        assert "wolf" not in n["opener"].lower() or "no wolf" in n["opener"].lower()
    fiance = next(n for n in tuesday if n["id"] == "werewolf_fiance")
    sister = next(n for n in tuesday if n["id"] == "werewolf_sister")
    vampire = next(n for n in tuesday if n["id"] == "vampire_neighbor")
    # Door is bottom-center (x 7). Tuesday people stay off that middle walk.
    assert int(fiance["inside_x"]) == 1 and int(fiance["inside_y"]) == 8
    assert fiance.get("facing") == "right"
    assert int(sister["inside_x"]) == 5 and int(sister["inside_y"]) == 8
    assert sister.get("facing") == "left"
    assert int(vampire["inside_x"]) == 0 and int(vampire["inside_y"]) == 7
    assert vampire.get("facing") == "right"
    monday = [n for n in world["npcs"] if n["id"] in {
        "iguana_neighbor", "riverfolk_neighbor",
    }]
    for n in monday:
        assert "Wednesday" not in n.get("weekdays", [])
        assert "Monday" in n.get("weekdays", [])
    family = [n for n in world["npcs"] if n["id"] in {
        "family_neighbor", "family_brother", "family_aunt",
    }]
    assert len(family) == 3
    joined_family = []
    for n in family:
        assert n.get("weekdays") == ["Wednesday"]
        assert n["inside"] == "dragons_brew"
        assert n.get("species", "") == ""
        assert "child" not in n["name"].lower()
        assert int(n["inside_x"]) not in (6, 7, 8)
        joined_family.extend(n["scripted_lines"])
    blob = " ".join(joined_family).lower()
    assert "café con leche" in blob
    assert "tostada" in blob
    assert "humans included" in blob
    assert "merfolk" not in blob
    assert "detective" not in blob
    child = next(n for n in world["npcs"] if n["id"] == "family_child")
    assert child.get("look") == "child"
    assert child.get("movement") == "table_run"
    assert child.get("weekdays") == ["Wednesday"]
    assert int(child["inside_x"]) not in (6, 7, 8)
    for n in tuesday:
        assert int(n["inside_x"]) not in (6, 7, 8)
    assert fiance.get("species") == "werewolf"
    assert sister.get("species") == "werewolf"
    assert vampire.get("species") == "vampire"
    assert fiance.get("tint") == "#6e6e72"
    assert sister.get("tint") == "#6e6e72"
    assert vampire.get("tint") == "#e8e6ee"
    joined = " ".join(fiance["scripted_lines"] + sister["scripted_lines"])
    assert "My sister came with me. We're here for the tea." in fiance["scripted_lines"]
    assert "I came with my brother. He likes this table." in sister["scripted_lines"]
    assert "No fur" not in joined
    assert "Gray is just the color" not in joined
    assert "Çampire" in mara["scripted_lines"][0]
    interior = world["interiors"]["dragons_brew"]
    beats = {it["beat"] for it in interior["interactables"] if it.get("beat")}
    assert "menu_read" in beats and "house_rules" in beats
    seats = {it["id"] for it in interior["interactables"]}
    assert "cafe_seat" in seats
    seat = next(it for it in interior["interactables"] if it["id"] == "cafe_seat")
    assert int(seat["x"]) == 5 and int(seat["y"]) == 5
    plant = next(o for o in interior["objects"] if o["id"] == "cafe_plant")
    assert int(plant["x"]) == 1 and int(plant["y"]) == 5
    gd = (Path(__file__).resolve().parents[1] / "world" / "interiors.gd").read_text()
    assert '"id": "cafe_tuesday_table"' in gd
    assert '"x": 2,\n\t\t"y": 7,' in gd
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
