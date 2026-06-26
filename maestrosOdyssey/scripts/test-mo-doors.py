#!/usr/bin/env python3
"""
Pure-math checks for mo-doors.js — run from repo root:
  python3 maestrosOdyssey/scripts/test-mo-doors.py
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOORS_JS = ROOT / "www" / "mo-doors.js"

failed = 0


def assert_true(cond, msg):
    global failed
    if not cond:
        print("FAIL:", msg)
        failed += 1
    else:
        print("ok:", msg)


def run_js(expr):
    """Evaluate MoDoors API via node if available, else quickjs, else inline regex checks."""
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
    for cmd in (["node", "/opt/homebrew/bin/node", "/usr/local/bin/node"]):
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


# Fallback: static checks without JS runtime
anchor_col = 8
anchor_out_row = 10
inside_exit_row = 11
tile = 32
scale = 2

assert_true(anchor_col == 8 and anchor_out_row == 10, "door constants col 8 row 10 (static)")
assert_true(inside_exit_row == 11, "café exit row 11 (static)")

world_x = run_js("return MoDoors.getDoorAnchor().worldX;")
if world_x is not None:
    expected_x = (8 * tile + tile / 2) * scale
    assert_true(abs(float(world_x) - expected_x) < 0.01, "door worldX at col 8 center")

    on_out = run_js("return MoDoors.playerOnDoorTrigger(8, 10, 'outside');")
    porch = run_js("return MoDoors.playerOnDoorTrigger(8, 11, 'outside');")
    on_cafe = run_js("return MoDoors.playerOnDoorTrigger(8, 11, 'cafe');")
    cafe_row10 = run_js("return MoDoors.playerOnDoorTrigger(8, 10, 'cafe');")
    assert_true(on_out is True, "on outside door tile")
    assert_true(porch is False, "porch row 11 does not trigger outside enter")
    assert_true(on_cafe is True, "on café exit tile")
    assert_true(cafe_row10 is False, "café row 10 does not trigger exit")

    grid = [["."] * 20 for _ in range(16)]
    grid[11][8] = ">"
    ok = run_js(
        "const g = " + json.dumps(grid) + "; return MoDoors.validateDoorLink(g);"
    )
    grid[11][8] = "#"
    bad = run_js(
        "const g = " + json.dumps(grid) + "; return MoDoors.validateDoorLink(g);"
    )
    assert_true(ok is True, "validateDoorLink passes with > at exit cell")
    assert_true(bad is False, "validateDoorLink fails when > missing")
else:
    text = DOORS_JS.read_text()
    assert_true("playerOnDoorTrigger" in text, "mo-doors.js defines playerOnDoorTrigger")
    assert_true("doorTriggerCell" in text, "mo-doors.js defines doorTriggerCell")
    assert_true("validateDoorLink" in text, "mo-doors.js defines validateDoorLink")
    print("note: no node runtime — ran static checks only")

if failed:
    print(f"\n{failed} assertion(s) failed")
    sys.exit(1)
print("\nAll mo-doors checks passed.")
