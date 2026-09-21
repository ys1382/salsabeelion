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
    assert "Çampire" in mara["scripted_lines"][0]
    interior = world["interiors"]["dragons_brew"]
    beats = {it["beat"] for it in interior["interactables"] if it.get("beat")}
    assert "menu_read" in beats and "house_rules" in beats
    seats = {it["id"] for it in interior["interactables"]}
    assert "cafe_seat" in seats
    print("dragons_brew_world.json: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
