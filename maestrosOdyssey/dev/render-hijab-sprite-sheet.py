#!/usr/bin/env python3
"""Preview sheet + pixel asserts for hijab face (synced with mo-farm-rpg.js markers)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RPG = ROOT / "www" / "mo-farm-rpg.js"
OUT = Path(__file__).resolve().parent / "hijab-sprite-preview.png"

CHAR_W, CHAR_H = 16, 24
SCALE = 8

HIJAB_FACE_LAYOUT = {
    0: {
        "faceSkin": {"x": 5, "y": 4, "w": 7, "h": 8},
        "eyes": [{"x": 6, "y": 7}, {"x": 9, "y": 7}],
        "hijabCheeks": [
            {"col": 4, "crownX": 3, "crownW": 2},
            {"col": 12, "crownX": 11, "crownW": 2},
        ],
    },
    1: {
        "faceSkin": {"x": 5, "y": 4, "w": 3, "h": 7},
        "eyes": [{"x": 5, "y": 7}],
        "hijabCheeks": [{"col": 4, "crownX": 4, "crownW": 1}],
    },
    2: {
        "faceSkin": {"x": 9, "y": 4, "w": 3, "h": 7},
        "eyes": [{"x": 9, "y": 7}],
        "hijabCheeks": [{"col": 8, "crownX": 8, "crownW": 1}],
    },
}

HIJAB_COLORS = {
    "skin": (0xF0, 0xC0, 0x80),
    "hijab": (0x5A, 0x68, 0x78),
    "hijabDark": (0x4A, 0x56, 0x68),
    "eye": (0x1A, 0x0A, 0x00),
    "lip": (0xC0, 0x70, 0x50),
}


def verify_layout_matches_js() -> None:
    src = RPG.read_text(encoding="utf-8")
    start = src.index("// BEGIN HIJAB_FACE_DRAW")
    end = src.index("// END HIJAB_FACE_DRAW")
    block = src[start:end]
    for key in (
        "faceSkin: { x: 5, y: 4, w: 7, h: 8",
        "eyes: [{ x: 6, y: 7 }, { x: 9, y: 7 }]",
        "col: 12, crownX: 11",
        "faceSkin: { x: 5, y: 4, w: 3, h: 7",
    ):
        if key not in block:
            raise SystemExit(f"Layout drift: expected {key!r} in mo-farm-rpg.js")


class Ctx:
    def __init__(self, img: Image.Image) -> None:
        self.img = img

    def rect(self, x: int, y: int, w: int, h: int, color) -> None:
        if isinstance(color, str):
            color = tuple(int(color[i : i + 2], 16) for i in (1, 3, 5))
        for dy in range(h):
            for dx in range(w):
                self.img.putpixel((x + dx, y + dy), color + (255,))

    def px(self, x: int, y: int, color) -> None:
        self.rect(x, y, 1, 1, color)


def draw_hijab_smile(ctx: Ctx, ox: int, oy: int, dir_: int) -> None:
    lip = HIJAB_COLORS["lip"]
    if dir_ == 0:
        ctx.px(ox + 7, oy + 10, lip)
        ctx.px(ox + 9, oy + 10, lip)
        ctx.rect(ox + 7, oy + 11, 3, 1, lip)
    elif dir_ == 1:
        ctx.px(ox + 5, oy + 10, lip)
        ctx.px(ox + 6, oy + 11, lip)
        ctx.px(ox + 7, oy + 11, lip)
    elif dir_ == 2:
        ctx.px(ox + 10, oy + 10, lip)
        ctx.px(ox + 8, oy + 11, lip)
        ctx.px(ox + 9, oy + 11, lip)


def draw_hijab_cheek_accents(ctx: Ctx, ox: int, oy: int, cheeks, hijab, hijab_dark) -> None:
    for c in cheeks:
        ctx.rect(ox + c["crownX"], oy + 5, c["crownW"], 2, hijab)
        ctx.px(ox + c["col"], oy + 6, hijab_dark)
        ctx.rect(ox + c["col"], oy + 7, 1, 2, hijab)


def draw_hijab_face_from_layout(ctx: Ctx, ox: int, oy: int, dir_: int) -> None:
    skin = HIJAB_COLORS["skin"]
    hijab = HIJAB_COLORS["hijab"]
    hijab_dark = HIJAB_COLORS["hijabDark"]
    eye = HIJAB_COLORS["eye"]

    if dir_ == 3:
        ctx.rect(ox + 2, oy + 2, 12, 9, hijab)
        ctx.rect(ox + 3, oy + 3, 10, 7, hijab_dark)
        ctx.rect(ox + 4, oy + 5, 8, 2, hijab)
        return

    layout = HIJAB_FACE_LAYOUT[dir_]
    if dir_ == 0:
        ctx.rect(ox + 3, oy + 1, 10, 3, hijab)
        ctx.rect(ox + 4, oy + 4, 8, 1, hijab_dark)
        ctx.rect(ox + 2, oy + 3, 2, 3, hijab)
        ctx.rect(ox + 12, oy + 3, 2, 3, hijab)
        ctx.rect(ox + 1, oy + 9, 2, 2, hijab)
        ctx.rect(ox + 13, oy + 9, 2, 2, hijab)
        ctx.rect(ox + 3, oy + 12, 10, 1, hijab_dark)
    elif dir_ == 1:
        ctx.rect(ox + 8, oy + 1, 7, 10, hijab)
        ctx.rect(ox + 2, oy + 1, 12, 3, hijab)
        ctx.rect(ox + 2, oy + 3, 2, 3, hijab)
        ctx.rect(ox + 4, oy + 4, 3, 1, hijab_dark)
        ctx.rect(ox + 1, oy + 9, 2, 2, hijab)
        ctx.rect(ox + 1, oy + 10, 3, 2, hijab_dark)
    elif dir_ == 2:
        ctx.rect(ox + 1, oy + 1, 7, 10, hijab)
        ctx.rect(ox + 2, oy + 1, 12, 3, hijab)
        ctx.rect(ox + 12, oy + 3, 2, 3, hijab)
        ctx.rect(ox + 9, oy + 4, 3, 1, hijab_dark)
        ctx.rect(ox + 13, oy + 9, 2, 2, hijab)
        ctx.rect(ox + 12, oy + 10, 3, 2, hijab_dark)

    fs = layout["faceSkin"]
    ctx.rect(ox + fs["x"], oy + fs["y"], fs["w"], fs["h"], skin)
    for e in layout["eyes"]:
        ctx.rect(ox + e["x"], oy + e["y"], 2, 2, eye)
    draw_hijab_smile(ctx, ox, oy, dir_)
    draw_hijab_cheek_accents(ctx, ox, oy, layout["hijabCheeks"], hijab, hijab_dark)


def pixel(img: Image.Image, x: int, y: int):
    return img.getpixel((x, y))[:3]


def assert_pixels(img: Image.Image, dir_: int) -> list[str]:
    errors: list[str] = []
    if dir_ == 3:
        return errors
    layout = HIJAB_FACE_LAYOUT[dir_]
    C = HIJAB_COLORS

    for e in layout["eyes"]:
        cx, cy = e["x"] + 1, e["y"] + 1
        if pixel(img, cx, cy) != C["eye"]:
            errors.append(f"dir {dir_}: eye center ({cx},{cy}) wrong color")

    for cheek in layout["hijabCheeks"]:
        col = cheek["col"]
        p = pixel(img, col, 7)
        if p == C["skin"]:
            errors.append(f"dir {dir_}: hijab cheek col {col} row 7 is skin (overlap)")
        if p not in (C["hijab"], C["hijabDark"]):
            errors.append(f"dir {dir_}: hijab cheek col {col} row 7 not hijab")

    fs = layout["faceSkin"]
    mid = pixel(img, fs["x"] + fs["w"] // 2, fs["y"] + 2)
    if mid != C["skin"]:
        errors.append(f"dir {dir_}: face interior not skin")

    if dir_ == 1 and pixel(img, 4, 7) == C["skin"]:
        errors.append("dir 1: col 4 row 7 must not be skin")
    if dir_ == 2 and pixel(img, 8, 7) == C["skin"]:
        errors.append("dir 2: col 8 row 7 must not be skin")
    if dir_ == 0 and pixel(img, 10, 5) in (C["hijab"], C["hijabDark"]):
        errors.append("dir 0: col 10 row 5 must not be hijab")

    if dir_ == 0:
        if pixel(img, 5, 7) != C["skin"]:
            errors.append("dir 0: col 5 row 7 must be skin gap (left of left eye)")
        if pixel(img, 11, 7) != C["skin"]:
            errors.append("dir 0: col 11 row 7 must be skin gap (right of right eye)")
        if pixel(img, 8, 7) != C["skin"]:
            errors.append("dir 0: col 8 row 7 must be skin bridge between eyes")
        if pixel(img, 6, 7) != C["eye"]:
            errors.append("dir 0: col 6 row 7 must be eye (left eye inner)")
        if pixel(img, 10, 7) != C["eye"]:
            errors.append("dir 0: col 10 row 7 must be eye (right eye inner)")
        if pixel(img, 4, 7) not in (C["hijab"], C["hijabDark"]):
            errors.append("dir 0: col 4 row 7 must be hijab cheek")
        if pixel(img, 12, 7) not in (C["hijab"], C["hijabDark"]):
            errors.append("dir 0: col 12 row 7 must be hijab cheek")

    return errors


def main() -> int:
    verify_layout_matches_js()
    dirs = [(0, "front"), (1, "left"), (2, "right"), (3, "back")]
    pad = 8
    panel_w = CHAR_W * SCALE
    panel_h = CHAR_H * SCALE + 20
    sheet = Image.new("RGBA", (panel_w * 4 + pad * 5, panel_h + pad * 2), (0x1A, 0x1A, 0x2E, 255))
    draw_sheet = ImageDraw.Draw(sheet)
    all_errors: list[str] = []

    for i, (dir_, label) in enumerate(dirs):
        head = Image.new("RGBA", (CHAR_W, CHAR_H), (0, 0, 0, 0))
        draw_hijab_face_from_layout(Ctx(head), 0, 0, dir_)
        all_errors.extend(assert_pixels(head, dir_))
        big = head.resize((panel_w, CHAR_H * SCALE), Image.NEAREST)
        dx = pad + i * (panel_w + pad)
        dy = pad
        sheet.paste(big, (dx, dy))
        draw_sheet.text((dx, dy + CHAR_H * SCALE + 4), label, fill=(0xE8, 0xE0, 0xD0))

    sheet.save(OUT)
    print("Wrote", OUT)
    if all_errors:
        print("ASSERT FAILURES:")
        for e in all_errors:
            print(" -", e)
        return 1
    print("All pixel asserts passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
