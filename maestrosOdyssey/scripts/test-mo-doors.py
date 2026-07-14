#!/usr/bin/env python3
"""
Door invariant checks for mo-doors.js — run from repo root:
  python3 maestrosOdyssey/scripts/test-mo-doors.py
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOORS_JS = ROOT / "www" / "mo-doors.js"
FARM_RPG = ROOT / "www" / "mo-farm-rpg.js"
MJS = ROOT / "scripts" / "test-mo-doors.mjs"

TILE = 32
SCALE = 2
failed = 0


def assert_true(cond, msg):
    global failed
    if not cond:
        print("FAIL:", msg)
        failed += 1
    else:
        print("ok:", msg)


def parse_outside_building(text):
    m = re.search(
        r"OUTSIDE_BUILDING\s*=\s*\{\s*left:\s*(\d+),\s*top:\s*(\d+),\s*width:\s*(\d+),\s*height:\s*(\d+),\s*doorRow:\s*(\d+)\s*\}",
        text,
    )
    if not m:
        raise ValueError("could not parse OUTSIDE_BUILDING from mo-doors.js")
    return {
        "left": int(m.group(1)),
        "top": int(m.group(2)),
        "width": int(m.group(3)),
        "height": int(m.group(4)),
        "doorRow": int(m.group(5)),
    }


def facade_door_metrics(bw, bh):
    dw = 22
    dh = 40
    dx = (bw // 2) - (dw // 2)
    dy = bh - 46
    return {"cx": dx + dw / 2}


def derive_door_col(building):
    bw = building["width"] * TILE
    bh = building["height"] * TILE
    door = facade_door_metrics(bw, bh)
    world_cx = building["left"] * TILE + door["cx"]
    return round(world_cx / TILE)


def parse_cafe_exit_row_grid(farm_text):
    in_cafe = False
    row_idx = 0
    for line in farm_text.splitlines():
        stripped = line.strip()
        if stripped == "cafe: {":
            in_cafe = True
            row_idx = 0
            continue
        if in_cafe and stripped.startswith("outside:"):
            break
        if in_cafe and stripped.startswith("'#") and stripped.endswith("',"):
            content = stripped.strip("',")
            if ">" in content:
                return row_idx, content.index(">")
            row_idx += 1
    raise ValueError('could not find café grid row with ">" in mo-farm-rpg.js')


def parse_outside_grid(farm_text):
    in_outside = False
    in_grid = False
    grid = []
    for line in farm_text.splitlines():
        stripped = line.strip()
        if stripped == "outside: {":
            in_outside = True
            continue
        if in_outside and stripped.startswith("cafe:"):
            break
        if in_outside and stripped == "grid: [":
            in_grid = True
            continue
        if in_outside and in_grid:
            if stripped.startswith("'") and stripped.endswith("',"):
                grid.append(list(stripped.strip("',")))
            elif stripped.startswith("].map"):
                break
    if not grid:
        raise ValueError("could not parse outside grid from mo-farm-rpg.js")
    return grid


def parse_outside_layout(farm_text):
    block = re.search(r"const OUTSIDE_LAYOUT\s*=\s*\{([\s\S]*?)\};", farm_text)
    if not block:
        raise ValueError("could not parse OUTSIDE_LAYOUT from mo-farm-rpg.js")
    body = block.group(1)

    def field_int(name):
        m = re.search(rf"{name}:\s*(\d+)", body)
        if not m:
            raise ValueError(f"OUTSIDE_LAYOUT missing {name}")
        return int(m.group(1))

    board_col = field_int("col")
    board_row_m = re.search(r"board:\s*\{\s*col:\s*\d+,\s*row:\s*(\d+)\s*\}", body)
    if not board_row_m:
        raise ValueError("OUTSIDE_LAYOUT missing board.row")
    return {
        "propsRow": field_int("propsRow"),
        "boardCol": board_col,
        "boardRow": int(board_row_m.group(1)),
        "sidewalkRow": field_int("sidewalkRow"),
        "flowerCol": re.search(r"flowerCol:\s*(\d+)", body).group(1),
        "brewSignCol": int(re.search(r"brewSignCol:\s*(\d+)", body).group(1)),
        "sidewalkStartCol": field_int("sidewalkStartCol"),
        "sidewalkEndCol": field_int("sidewalkEndCol"),
    }


def check_outside_layout(farm_text):
    layout = parse_outside_layout(farm_text)
    grid = parse_outside_grid(farm_text)
    pr = layout["propsRow"]
    br = layout["boardRow"]
    bc = layout["boardCol"]
    sr = layout["sidewalkRow"]
    fc = int(layout["flowerCol"])
    bsc = layout["brewSignCol"]
    ss = layout["sidewalkStartCol"]
    se = layout["sidewalkEndCol"]

    assert_true(len(grid) > sr, f"outside grid has row {sr}")
    assert_true(grid[pr][fc] == "f", f"flower at col {fc} row {pr}")
    assert_true(grid[pr][bsc] == "B", f"brew sign at col {bsc} row {pr}")
    assert_true(grid[br][bc] == "S", f"community board at col {bc} row {br}")

    sidewalk = grid[sr]
    for c in range(ss, se + 1):
        assert_true(sidewalk[c] == "P", f"sidewalk P at col {c} row {sr} (got {sidewalk[c]!r})")

    for ry in range(sr):
        assert_true("P" not in grid[ry], f"no sidewalk P above row {sr} (row {ry} has P)")

    m = re.search(r"OUTSIDE_SIDEWALK_ROW\s*=\s*OUTSIDE_LAYOUT\.sidewalkRow", farm_text)
    assert_true(m is not None, "OUTSIDE_SIDEWALK_ROW derived from OUTSIDE_LAYOUT.sidewalkRow")

    m2 = re.search(
        rf"playerStart:\s*\{{\s*col:\s*\d+,\s*feetRow:\s*OUTSIDE_LAYOUT\.sidewalkRow",
        farm_text,
    )
    assert_true(m2 is not None, "player spawn feetRow uses OUTSIDE_LAYOUT.sidewalkRow")


def run_node_mjs():
    for cmd in ("node", "/opt/homebrew/bin/node", "/usr/local/bin/node"):
        try:
            subprocess.check_call([cmd, str(MJS)], cwd=ROOT.parent)
            return True
        except (FileNotFoundError, subprocess.CalledProcessError):
            continue
    return False


doors_text = DOORS_JS.read_text()
farm_text = FARM_RPG.read_text()
building = parse_outside_building(doors_text)
door_col = derive_door_col(building)

assert_true(door_col == 9, f"derived doorCol is 9 (got {door_col})")
assert_true("spawnForTransition" in doors_text, "grid-only spawnForTransition exists")
assert_true("resolveExitSpawn" not in doors_text, "legacy resolveExitSpawn removed")
assert_true("feetInDoorXBand" not in doors_text, "pixel-band triggers removed")
assert_true("outsideFacadeDoorMetrics" not in farm_text, "no duplicate façade metrics in farm-rpg")
assert_true("MoDoors.spawnForTransition" in farm_text, "farm-rpg uses spawnForTransition")
assert_true("exitSpawn:" not in farm_text, "no duplicate exitSpawn in MAPS")

exit_row, exit_col = parse_cafe_exit_row_grid(farm_text)
assert_true(exit_row == 11, f"café exit row is 11 (got {exit_row})")
assert_true(exit_col == door_col, f'café ">" col {exit_col} matches doorCol {door_col}')

check_outside_layout(farm_text)

if run_node_mjs():
    print("ok: test-mo-doors.mjs passed via node")
else:
    print("note: node not available — python invariants only")

if failed:
    print(f"\n{failed} assertion(s) failed")
    sys.exit(1)
print("\nAll mo-doors checks passed.")
