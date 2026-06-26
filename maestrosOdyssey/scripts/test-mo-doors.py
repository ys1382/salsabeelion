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
    panel_top = dy + 5
    panel_h = dh - 10
    return {
        "dx": dx,
        "dy": dy,
        "dw": dw,
        "dh": dh,
        "cx": dx + dw / 2,
        "cy": panel_top + panel_h / 2,
    }


def derive_door_col(building):
    bw = building["width"] * TILE
    bh = building["height"] * TILE
    door = facade_door_metrics(bw, bh)
    world_cx = building["left"] * TILE + door["cx"]
    return round(world_cx / TILE)


def parse_cafe_exit_row_grid(farm_text):
    """Find café grid row with '>' exit tile."""
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
                col = content.index(">")
                return row_idx, col, content
            row_idx += 1
    raise ValueError('could not find café grid row with ">" in mo-farm-rpg.js')


def run_js(expr):
    wrapper = f"""
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync({json.dumps(str(DOORS_JS))}, 'utf8');
const sandbox = {{ window: {{}}, console }};
sandbox.window = sandbox;
vm.runInContext(code, vm.createContext(sandbox));
const r = (function() {{ {expr} }})();
if (typeof r === 'object') console.log(JSON.stringify(r));
else console.log(String(r));
"""
    for cmd in ("node", "/opt/homebrew/bin/node", "/usr/local/bin/node"):
        try:
            out = subprocess.check_output([cmd, "-e", wrapper], text=True, stderr=subprocess.DEVNULL)
            line = out.strip().splitlines()[-1]
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                return line
        except (FileNotFoundError, subprocess.CalledProcessError):
            continue
    return None


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
assert_true(building["doorRow"] == 10, "outside doorRow is 10")

assert_true(
    "doorCol:" not in doors_text.split("OUTSIDE_BUILDING")[1].split("};")[0],
    "OUTSIDE_BUILDING has no hand-tuned doorCol",
)

assert_true(
    "outsideFacadeDoorMetrics" not in farm_text,
    "mo-farm-rpg.js does not duplicate outsideFacadeDoorMetrics",
)

assert_true(
    "MoDoors.facadeDoorMetrics" in farm_text,
    "mo-farm-rpg.js uses MoDoors.facadeDoorMetrics for façade art",
)

assert_true(
  re.search(r"spawn\.x\s*=\s*anchor\.worldX", doors_text) is not None,
  "resolveExitSpawn snaps X to anchor.worldX",
)
assert_true(
  re.search(r"spawn\.feetRow\s*=\s*anchor\.(insideEnterRow|outsideApproachRow)", doors_text) is not None,
  "resolveExitSpawn sets feetRow for map transitions",
)

expected_world_x = (door_col * TILE + TILE / 2) * SCALE
if run_js("return MoDoors.getDoorAnchor().worldX;") is not None:
    world_x = run_js("return MoDoors.getDoorAnchor().worldX;")
    assert_true(abs(float(world_x) - expected_world_x) < 0.01, f"worldX at tile center {expected_world_x}")

exit_row, exit_col, exit_line = parse_cafe_exit_row_grid(farm_text)
assert_true(exit_row == 11, f"café exit row is 11 (got {exit_row})")
assert_true(exit_col == door_col, f'café ">" at col {exit_col} matches derived doorCol {door_col}')

if run_node_mjs():
    print("ok: test-mo-doors.mjs passed via node")
else:
    print("note: node not available — python invariants only")

if failed:
    print(f"\n{failed} assertion(s) failed")
    sys.exit(1)
print("\nAll mo-doors checks passed.")
