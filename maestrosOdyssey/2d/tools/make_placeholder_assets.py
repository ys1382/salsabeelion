#!/usr/bin/env python3
"""Write solid-color PNG stand-ins under assets/ so Godot can boot without the
third-party art packs (those packs are gitignored and not redistributable).

Real pack files win: this never overwrites an existing PNG.
"""
from __future__ import annotations

import json
import re
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
CATALOG = ROOT / "generated" / "assets_catalog.json"

SHEETS = {
    "mystic_woods_free_2/sprites/characters/player.png": (288, 480, (90, 70, 55)),
    "mystic_woods_free_2/sprites/characters/slime.png": (224, 416, (80, 140, 80)),
    "The Fan-tasy Tileset (Free)/Art/Characters/Main Character/Character_Idle.png": (
        160, 192, (180, 120, 90)),
    "The Fan-tasy Tileset (Free)/Art/Characters/Main Character/Character_Walk.png": (
        160, 192, (170, 110, 80)),
}

TILESET_SIZE = (512, 512)


def _png(width: int, height: int, rgb: tuple[int, int, int]) -> bytes:
    r, g, b = rgb
    raw = b"".join(b"\x00" + bytes([r, g, b, 255]) * width for _ in range(height))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(
            ">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(
        b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def _write(rel: str, w: int, h: int, rgb: tuple[int, int, int]) -> bool:
    path = ASSETS / rel
    if path.exists():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(_png(w, h, rgb))
    return True


def _paths_from_generated() -> set[str]:
    found: set[str] = set()
    pat = re.compile(r'res://assets/([^"]+)')
    for folder in (ROOT / "generated", ROOT / "actors"):
        for f in folder.rglob("*"):
            if f.suffix not in {".tscn", ".tres", ".gd"}:
                continue
            found.update(pat.findall(f.read_text(encoding="utf-8")))
    return found


def main() -> int:
    catalog = json.loads(CATALOG.read_text())
    by_file: dict[str, tuple[int, int]] = {}
    for entry in catalog["objects"].values():
        scene = Path(ROOT, entry["scene"].replace("res://", ""))
        if not scene.exists():
            continue
        m = re.search(r'res://assets/([^"]+)', scene.read_text(encoding="utf-8"))
        if not m:
            continue
        w, h = entry["px"]
        by_file[m.group(1)] = (int(w), int(h))

    wrote = 0
    for rel, (w, h, rgb) in SHEETS.items():
        if _write(rel, w, h, rgb):
            wrote += 1

    colors = {
        "Buildings": (140, 90, 60),
        "Ground": (90, 130, 70),
        "Water": (60, 100, 150),
        "Props": (160, 130, 80),
        "Rocks": (110, 100, 90),
        "Trees": (50, 110, 55),
        "Rock Slopes": (120, 110, 100),
    }
    for rel in sorted(_paths_from_generated()):
        if rel in SHEETS:
            continue
        if rel in by_file:
            w, h = by_file[rel]
        else:
            w, h = TILESET_SIZE
        rgb = (120, 110, 90)
        for key, col in colors.items():
            if key.lower() in rel.lower() or key.replace(" ", "") in rel:
                rgb = col
                break
        if _write(rel, max(w, 16), max(h, 16), rgb):
            wrote += 1

    print(f"placeholder assets: wrote {wrote} new PNGs under {ASSETS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
