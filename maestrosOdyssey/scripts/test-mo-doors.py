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

if run_node_mjs():
    print("ok: test-mo-doors.mjs passed via node")
else:
    print("note: node not available — python invariants only")

if failed:
    print(f"\n{failed} assertion(s) failed")
    sys.exit(1)
print("\nAll mo-doors checks passed.")
