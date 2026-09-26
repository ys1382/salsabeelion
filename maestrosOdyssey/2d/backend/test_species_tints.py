"""Species washes on the shared villager sheet. Mara is not one of them.

A wash on her whole picture dyes the shirt and pants. Her hair and skin are
repainted on her own copy of the same frames. The tint key in the world file
stays, and it is not applied.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOOKS = ROOT / "actors" / "looks.gd"
SHEET = ROOT / "actors" / "sheet.gd"
NPC = ROOT / "actors" / "npc.gd"
WORLD = Path(__file__).resolve().parent / "dragons_brew_world.json"
IDLE = ROOT / "assets" / "The Fan-tasy Tileset (Free)" / "Art" / "Characters" / "Main Character" / "Character_Idle.png"

WANTED = {
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


def _block(text: str, const: str) -> dict[str, str]:
    chunk = text.split(f"const {const}", 1)[1].split("}", 1)[0]
    return {
        src.lower(): dst.lower()
        for src, dst in re.findall(r'0x([0-9a-fA-F]{6}):\s*Color\("#([0-9a-fA-F]{6})"\)', chunk)
    }


def _mara_pixels_stay_clothed() -> None:
    if not IDLE.exists():
        print("species tints: sheet not on disk, skipped pixel check")
        return
    from PIL import Image

    sheet = SHEET.read_text()
    hair = _block(sheet, "MARA_HAIR")
    skin = _block(sheet, "MARA_SKIN")
    max_y = int(re.search(r"MARA_HAIR_MAX_Y := (\d+)", sheet).group(1))
    im = Image.open(IDLE).convert("RGBA")
    px = im.load()
    # Front frame, row 3. Shirt pixel, face pixel, hair pixel, boot pixel
    # that uses a hair brown.
    checks = {
        (16, 26): "clothes",
        (16, 20): "skin",
        (14, 10): "hair",
        (14, 38): "boot",
    }
    origin = (0, 3 * 48)
    for (x, y), kind in checks.items():
        r, g, b, _a = px[origin[0] + x, origin[1] + y]
        src = f"{r:02x}{g:02x}{b:02x}"
        painted = src
        if src in hair and y < max_y:
            painted = hair[src]
        elif src in skin:
            painted = skin[src]
        if kind == "clothes":
            assert src not in hair and src not in skin, src
            assert painted == src
        elif kind == "skin":
            assert painted == skin[src] and painted != src
        elif kind == "hair":
            assert painted == hair[src] and painted != src
        elif kind == "boot":
            assert src in hair and y >= max_y
            assert painted == src
    print("species tints: mara pixels split hair, skin, and clothes")


def _lum(hex6: str) -> float:
    def lin(channel: int) -> float:
        c = channel / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r = int(hex6[0:2], 16)
    g = int(hex6[2:4], 16)
    b = int(hex6[4:6], 16)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def _river_face_is_lighter_than_ocean() -> None:
    if not IDLE.exists():
        print("species tints: sheet not on disk, skipped river pixel check")
        return
    from PIL import Image

    sheet = SHEET.read_text()
    skin = _block(sheet, "RIVER_SKIN")
    ocean = WANTED["merfolk"].lstrip("#").lower()
    im = Image.open(IDLE).convert("RGBA")
    px = im.load()
    origin = (0, 3 * 48)

    def painted_at(x: int, y: int) -> str:
        r, g, b, _a = px[origin[0] + x, origin[1] + y]
        src = f"{r:02x}{g:02x}{b:02x}"
        return skin.get(src, src)

    face = painted_at(16, 20)
    shadow = painted_at(14, 20)
    shirt = painted_at(16, 26)
    hair = painted_at(14, 10)
    assert face == "a6cedc", face
    assert shadow == "6896ae", shadow
    assert shirt == "b3b094", shirt
    assert hair == "593f2d", hair
    assert face != ocean and shadow != ocean
    assert _lum(shadow) > _lum(ocean)
    assert _lum(face) > _lum(shadow)
    # Not the old crocodile green, and not a green that wins over blue.
    assert shadow != "4a6b4e"
    sr, sg, sb = (int(shadow[i:i + 2], 16) for i in (0, 2, 4))
    assert sb > sg > sr
    print("species tints: river face is light blue, clothes stay")


def main() -> int:
    palette = _palette()
    assert palette == WANTED, palette
    assert "campire" not in palette
    looks = LOOKS.read_text()
    body = looks.split("static func apply_body_tint", 1)[1]
    assert body.find('species_of(data) == "campire"') < body.find("is_valid_html_color")
    assert "Color.WHITE" in body.split("is_valid_html_color", 1)[0]
    sheet = SHEET.read_text()
    assert "func mara_frames" in sheet
    npc = NPC.read_text()
    assert 'npc_id == "mara"' in npc and "Sheet.mara_frames()" in npc
    assert npc.find("Sheet.mara_frames()") < npc.find("Sheet.villager_frames()")
    world = json.loads(WORLD.read_text())
    mara = next(n for n in world["npcs"] if n["id"] == "mara")
    iguana = next(n for n in world["npcs"] if n["id"] == "iguana_neighbor")
    assert mara.get("look") == "campire"
    # Key stays in the world file. It is not used as a wash.
    assert mara.get("tint") == "#241c1e"
    assert iguana.get("species") == "lizardfolk"
    assert iguana.get("tint") == WANTED["lizardfolk"]
    river = next(n for n in world["npcs"] if n["id"] == "riverfolk_neighbor")
    assert river.get("species") == "riverfolk"
    assert river.get("role") == "river merfolk"
    # Green key stays in the file. It is not applied as a wash.
    assert river.get("tint") == "#4a6b4e"
    assert river.get("scripted_lines") == [
        "I work the water. People still need to get home. Closing ferries doesn't make anyone safer — it just makes them late.",
        "Give the sea table room if you see it later this week. Respect, not fear. They're not the ones starting trouble.",
    ]
    assert int(river["inside_x"]) == 11 and int(river["inside_y"]) == 3
    assert not any(n.get("species") == "merfolk" for n in world["npcs"])
    assert "riverfolk" not in palette
    assert palette["merfolk"] == "#3a6db0"
    assert 'species == "riverfolk"' in looks
    assert 'species_of(data) == "riverfolk"' in body
    assert body.find('species_of(data) == "riverfolk"') < body.find("is_valid_html_color")
    assert "Sheet.riverfolk_frames()" in npc
    assert npc.find("Sheet.riverfolk_frames()") < npc.find("Sheet.villager_frames()")
    _mara_pixels_stay_clothed()
    _river_face_is_lighter_than_ocean()
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
