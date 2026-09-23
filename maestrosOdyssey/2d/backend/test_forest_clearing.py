"""Forest clearing is its own screen, reached through the tree gap left of the house."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import catalog
import worldgen

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend" / "dragons_brew_world.json"
GENERATED = ROOT / "generated" / "dragons_brew_world.json"


def _cells(entry: dict) -> set[tuple[int, int]]:
    w, h = catalog.footprint(entry["asset"])
    x0, y0 = int(entry["x"]), int(entry["y"])
    return {(x0 + dx, y0 + dy) for dx in range(w) for dy in range(h)}


def _rect(spec: dict) -> set[tuple[int, int]]:
    x0, y0 = int(spec["x"]), int(spec["y"])
    return {
        (x0 + dx, y0 + dy)
        for dx in range(int(spec["w"]))
        for dy in range(int(spec["h"]))
    }


def _check(path: Path) -> None:
    world = json.loads(path.read_text(encoding="utf-8"))
    worldgen.add_item_fields(world)
    worldgen.validate_world(world)

    house = next(o for o in world["objects"] if o["id"] == "player_house")
    shade = world["map"]["shade_paths"]
    assert len(shade) == 1
    path_spec = shade[0]
    assert path_spec["enters"] == "forest_clearing"
    assert path_spec["id"] == "forest_path"
    # Trigger only — no outdoor dark strip, and never a dirt road.
    assert path_spec not in world["map"]["paths"]
    assert "points" not in path_spec
    mouth_spec = path_spec["mouth"]
    assert "w" in mouth_spec or "h" in mouth_spec
    mouth = _rect(mouth_spec)
    assert mouth
    assert all(x < int(house["x"]) for x, _y in mouth)
    # Forest front on the west edge — several trees/bushes, gap left empty.
    border = [
        o for o in world["objects"]
        if o["id"] in ("tree_n", "tree_s") or str(o["id"]).startswith("border_")
    ]
    assert len(border) >= 8
    assert sum(1 for o in border if str(o["asset"]).startswith("tree.tree_")) >= 5
    border_cells: set[tuple[int, int]] = set()
    for tree in border:
        assert int(tree["x"]) <= 3
        border_cells |= _cells(tree)
    assert mouth.isdisjoint(border_cells)
    houses = [
        o for o in world["objects"]
        if o["id"] in ("player_house", "elder_house", "dragons_brew")
    ]
    for house_obj in houses:
        assert border_cells.isdisjoint(_cells(house_obj))
    # Stay on the forest side — do not spill into the café column.
    cafe = next(o for o in houses if o["id"] == "dragons_brew")
    assert all(max(x for x, _y in _cells(o)) < int(cafe["x"]) for o in border)
    back = (int(path_spec["return"]["x"]), int(path_spec["return"]["y"]))
    assert back not in mouth
    assert back[0] < int(house["x"])
    blocked, _w, _h = worldgen._solid_map(world)
    start = (world["player_start"]["x"], world["player_start"]["y"])
    open_cells = worldgen._reachable(blocked, _w, _h, start)
    assert mouth <= open_cells
    assert back in open_cells

    clearing = world["clearings"]["forest_clearing"]
    room_w = int(clearing["room"]["x"])
    room_h = int(clearing["room"]["y"])
    assert room_w <= 24 and room_h <= 16
    # Whole clearing is dark grass in code — no path-strip shade in JSON.
    assert "shade" not in clearing
    exit_cells = _rect(clearing["exit"])
    entry = (int(clearing["entry"]["x"]), int(clearing["entry"]["y"]))
    assert entry not in exit_cells
    assert 0 <= entry[0] < room_w and 0 <= entry[1] < room_h
    for obj in clearing["objects"]:
        asset = obj["asset"]
        assert asset in catalog.objects()
        got = _cells(obj)
        assert all(0 <= x < room_w and 0 <= y < room_h for x, y in got)
        assert got.isdisjoint(exit_cells)
        assert entry not in got
    assets = {obj["asset"] for obj in clearing["objects"]}
    assert any(a.startswith("tree.tree_") for a in assets)
    assert any(a.startswith("tree.bush_") for a in assets)
    assert any(a.startswith("rock.") for a in assets)
    assert "prop.chopped_tree_1" in assets
    names = {n["id"] for n in world["npcs"]}
    assert "forest" not in names
    for n in world["npcs"]:
        assert n.get("inside") != "forest_clearing"


def main() -> int:
    _check(BACKEND)
    _check(GENERATED)
    gd = (ROOT / "world" / "interiors.gd").read_text(encoding="utf-8")
    assert "enter_clearing" in gd
    assert "try_night_pass" in gd
    forest = gd.split("func enter_clearing", 1)[1].split("\nfunc enter(", 1)[0]
    assert "try_night_pass" not in forest
    house = gd.split("func enter(", 1)[1].split("func _show_night_pass", 1)[0]
    assert 'building_id == "player_house"' in house
    clearing_gd = (ROOT / "world" / "clearing.gd").read_text(encoding="utf-8")
    assert "Shade.paint(_floor, cells)" in clearing_gd
    builder = (ROOT / "world" / "world_builder.gd").read_text(encoding="utf-8")
    assert "Shade.paint(_ground" not in builder
    print("forest clearing: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
