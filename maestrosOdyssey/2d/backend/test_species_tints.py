"""Species body tints on the shared villager sheet (no new animation)."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOOKS = ROOT / "actors" / "looks.gd"
WORLD = Path(__file__).resolve().parent / "dragons_brew_world.json"

WANTED = {
    "campire": "#241c1e",
    "vampire": "#e8e6ee",
    "werewolf": "#6e6e72",
    "lizardfolk": "#3f8f5a",
    "merfolk": "#3a6db0",
    "dragonfolk": "#b33a32",
}


def _palette() -> dict[str, str]:
    found = dict(re.findall(
        r'"(\w+)":\s*\{"hex":\s*"(#[0-9a-fA-F]{6})"',
        LOOKS.read_text(),
    ))
    return found


def main() -> int:
    palette = _palette()
    assert palette == WANTED, palette
    world = json.loads(WORLD.read_text())
    mara = next(n for n in world["npcs"] if n["id"] == "mara")
    iguana = next(n for n in world["npcs"] if n["id"] == "iguana_neighbor")
    assert mara.get("look") == "campire"
    assert mara.get("tint") == WANTED["campire"]
    assert iguana.get("species") == "lizardfolk"
    assert iguana.get("tint") == WANTED["lizardfolk"]
    for npc_id, species in (
        ("werewolf_fiance", "werewolf"),
        ("werewolf_sister", "werewolf"),
        ("vampire_neighbor", "vampire"),
    ):
        npc = next(n for n in world["npcs"] if n["id"] == npc_id)
        assert npc.get("species") == species
        assert npc.get("tint") == WANTED[species]
        assert npc.get("weekdays") == ["Tuesday"]
    print("species tints: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
