#!/usr/bin/env python3
"""Preview sheet + pixel asserts for woman_jilbab (head + full body). Synced with mo-farm-rpg.js markers."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RPG = ROOT / "www" / "mo-farm-rpg.js"
OUT_HEAD = Path(__file__).resolve().parent / "hijab-sprite-preview.png"
OUT_FULL = Path(__file__).resolve().parent / "jilbab-sprite-preview.png"

CHAR_W, CHAR_H = 16, 24
SCALE = 8

HIJAB_FACE_LAYOUT = {
    0: {
        "faceSkin": {"x": 5, "y": 3, "w": 7, "h": 7},
        "eyes": [{"x": 6, "y": 5}, {"x": 9, "y": 5}],
        "hijabCheeks": [
            {"col": 4, "crownX": 3, "crownW": 2, "jawY": 7},
            {"col": 12, "crownX": 11, "crownW": 2, "jawY": 7},
        ],
    },
    1: {
        "faceSkin": {"x": 5, "y": 2, "w": 3, "h": 7},
        "eyes": [{"x": 5, "y": 5}],
        "hijabCheeks": [{"col": 4, "crownX": 3, "crownW": 1, "jawY": 7}],
    },
    2: {
        "faceSkin": {"x": 9, "y": 2, "w": 3, "h": 7},
        "eyes": [{"x": 9, "y": 5}],
        "hijabCheeks": [{"col": 8, "crownX": 8, "crownW": 1, "jawY": 7}],
    },
}

HIJAB_COLORS = {
    "skin": (0xF0, 0xC0, 0x80),
    "hijab": (0x6A, 0x78, 0x88),
    "hijabDark": (0x5A, 0x68, 0x78),
    "eye": (0x1A, 0x0A, 0x00),
    "lip": (0xC0, 0x70, 0x50),
}

JILBAB_COLORS = {
    "jilbab": (0x4A, 0x56, 0x68),
    "jilbabLight": (0x7A, 0x88, 0x98),
    "jilbabDark": (0x3A, 0x44, 0x50),
    "shoe": (0x2A, 0x30, 0x40),
    "shoeDark": (0x1A, 0x20, 0x30),
}


def verify_markers_in_js() -> None:
    src = RPG.read_text(encoding="utf-8")
    for marker in (
        "// BEGIN HIJAB_FACE_DRAW",
        "function drawHijabBase",
        "// BEGIN JILBAB_BODY_DRAW",
        "function drawJilbabBody",
        "PLAYER_LOOK_ART_REV = 'y'",
    ):
        if marker not in src:
            raise SystemExit(f"Drift: expected {marker!r} in mo-farm-rpg.js")


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


def draw_hijab_face_skin_octagon(ctx: Ctx, ox: int, oy: int, dir_: int, skin) -> None:
    if dir_ == 0:
        ctx.rect(ox + 6, oy + 3, 5, 1, skin)
        ctx.rect(ox + 5, oy + 4, 7, 1, skin)
        ctx.rect(ox + 5, oy + 5, 7, 4, skin)
        ctx.rect(ox + 6, oy + 9, 5, 1, skin)
    elif dir_ == 1:
        ctx.px(ox + 6, oy + 2, skin)
        ctx.rect(ox + 5, oy + 3, 3, 6, skin)
        ctx.px(ox + 6, oy + 9, skin)
    elif dir_ == 2:
        ctx.px(ox + 9, oy + 2, skin)
        ctx.rect(ox + 8, oy + 3, 3, 6, skin)
        ctx.px(ox + 9, oy + 9, skin)


def paint_jilbab_undercoat(ctx: Ctx, ox: int, oy: int, dir_: int, hem_y: int) -> None:
    C = JILBAB_COLORS

    if dir_ == 0:
        for y in range(10, hem_y + 1):
            left, width = 1, 14
            if y == 11:
                left, width = 2, 12
            ctx.rect(ox + left, oy + y, width, 1, C["jilbab"])
    else:
        h = hem_y - 10 + 1
        if h > 0:
            ctx.rect(ox + 1, oy + 10, 14, h, C["jilbab"])


def paint_jilbab_edge_outline(ctx: Ctx, ox: int, oy: int, hem_y: int) -> None:
    C = JILBAB_COLORS
    for y in range(10, min(hem_y + 1, CHAR_H - 1)):
        ctx.px(ox + 0, oy + y, C["jilbabDark"])
        ctx.px(ox + 15, oy + y, C["jilbabDark"])


def fill_jilbab_skirt_to_hem(ctx: Ctx, ox: int, oy: int, dir_: int, hem_y: int) -> None:
    C = JILBAB_COLORS
    top = 16
    h = hem_y - top
    if h <= 0:
        return
    if dir_ == 0:
        ctx.rect(ox + 1, oy + top, 14, h, C["jilbab"])
        ctx.rect(ox + 1, oy + 11, 2, 4, C["jilbabLight"])
        ctx.rect(ox + 13, oy + 11, 2, 4, C["jilbabLight"])
        ctx.px(ox + 8, oy + 12, C["jilbabDark"])
    elif dir_ == 1:
        ctx.rect(ox + 1, oy + top, 13, h, C["jilbab"])
        ctx.rect(ox + 2, oy + 11, 2, 4, C["jilbabLight"])
        ctx.px(ox + 4, oy + 12, C["jilbabDark"])
    elif dir_ == 2:
        ctx.rect(ox + 2, oy + top, 13, h, C["jilbab"])
        ctx.rect(ox + 12, oy + 11, 2, 4, C["jilbabLight"])
        ctx.px(ox + 11, oy + 12, C["jilbabDark"])
    elif dir_ == 3:
        ctx.rect(ox + 1, oy + top, 14, h, C["jilbab"])
        ctx.rect(ox + 1, oy + 11, 2, 4, C["jilbabLight"])
        ctx.rect(ox + 13, oy + 11, 2, 4, C["jilbabLight"])


def draw_jilbab_hem_and_feet(ctx: Ctx, ox: int, oy: int, dir_: int, hem_y: int, foot_x: int, leg_l: int) -> None:
    C = JILBAB_COLORS
    shoe_y = hem_y + 1
    shoe_h = 3

    if dir_ == 0:
        ctx.rect(ox + 1, oy + hem_y, 14, 1, C["jilbab"])
        ctx.px(ox + 1, oy + hem_y, C["jilbabDark"])
        ctx.px(ox + 14, oy + hem_y, C["jilbabDark"])
        ctx.px(ox + 7, oy + hem_y, C["jilbabDark"])
        ctx.px(ox + 8, oy + hem_y, C["jilbabDark"])
        left_shoe_x = 3 + leg_l
        right_shoe_x = 9 - leg_l
        ctx.rect(ox + left_shoe_x, oy + shoe_y, 4, shoe_h, C["shoe"])
        ctx.rect(ox + right_shoe_x, oy + shoe_y, 4, shoe_h, C["shoe"])
        ctx.rect(ox + left_shoe_x, oy + shoe_y + shoe_h - 1, 4, 1, C["shoeDark"])
        ctx.rect(ox + right_shoe_x, oy + shoe_y + shoe_h - 1, 4, 1, C["shoeDark"])
    elif dir_ in (1, 2):
        ctx.rect(ox + 1, oy + hem_y, 14, 1, C["jilbab"])
        ctx.px(ox + 1, oy + hem_y, C["jilbabDark"])
        ctx.px(ox + 14, oy + hem_y, C["jilbabDark"])
        ctx.rect(ox + foot_x, oy + shoe_y, 4, shoe_h, C["shoe"])
        ctx.rect(ox + foot_x, oy + shoe_y + shoe_h - 1, 4, 1, C["shoeDark"])
    elif dir_ == 3:
        ctx.rect(ox + 1, oy + hem_y, 14, 1, C["jilbab"])
        ctx.px(ox + 0, oy + hem_y, C["jilbabDark"])
        ctx.px(ox + 15, oy + hem_y, C["jilbabDark"])
        ctx.rect(ox + 3, oy + shoe_y, 4, shoe_h, C["shoe"])
        ctx.rect(ox + 9, oy + shoe_y, 4, shoe_h, C["shoe"])
        ctx.rect(ox + 3, oy + shoe_y + shoe_h - 1, 4, 1, C["shoeDark"])
        ctx.rect(ox + 9, oy + shoe_y + shoe_h - 1, 4, 1, C["shoeDark"])


def draw_hijab_smile(ctx: Ctx, ox: int, oy: int, dir_: int) -> None:
    lip = HIJAB_COLORS["lip"]
    if dir_ == 0:
        ctx.px(ox + 7, oy + 8, lip)
        ctx.px(ox + 9, oy + 8, lip)
        ctx.rect(ox + 7, oy + 9, 3, 1, lip)
    elif dir_ == 1:
        ctx.px(ox + 5, oy + 8, lip)
        ctx.px(ox + 6, oy + 9, lip)
        ctx.px(ox + 7, oy + 9, lip)
    elif dir_ == 2:
        ctx.px(ox + 10, oy + 8, lip)
        ctx.px(ox + 8, oy + 9, lip)
        ctx.px(ox + 9, oy + 9, lip)


def draw_hijab_base(ctx: Ctx, ox: int, oy: int, dir_: int, hijab, hijab_dark) -> None:
    if dir_ == 0:
        ctx.px(ox + 2, oy + 1, hijab)
        ctx.px(ox + 3, oy + 1, hijab)
        ctx.rect(ox + 4, oy + 1, 8, 1, hijab)
        ctx.px(ox + 12, oy + 1, hijab)
        ctx.px(ox + 13, oy + 1, hijab)
        ctx.rect(ox + 2, oy + 2, 12, 1, hijab)
        ctx.rect(ox + 2, oy + 3, 2, 4, hijab)
        ctx.rect(ox + 12, oy + 3, 2, 4, hijab)
        ctx.px(ox + 4, oy + 3, hijab_dark)
        ctx.px(ox + 5, oy + 3, hijab_dark)
        ctx.px(ox + 11, oy + 3, hijab_dark)
    elif dir_ == 1:
        ctx.px(ox + 2, oy + 1, hijab)
        ctx.px(ox + 3, oy + 1, hijab)
        ctx.rect(ox + 4, oy + 1, 7, 1, hijab)
        ctx.rect(ox + 11, oy + 1, 3, 1, hijab)
        ctx.rect(ox + 3, oy + 2, 8, 1, hijab)
        ctx.px(ox + 2, oy + 2, hijab)
        ctx.rect(ox + 2, oy + 3, 2, 4, hijab)
        ctx.rect(ox + 11, oy + 2, 4, 6, hijab)
        ctx.px(ox + 4, oy + 3, hijab_dark)
        ctx.rect(ox + 4, oy + 8, 1, 2, hijab)
    elif dir_ == 2:
        ctx.px(ox + 12, oy + 1, hijab)
        ctx.rect(ox + 5, oy + 1, 7, 1, hijab)
        ctx.rect(ox + 2, oy + 1, 3, 1, hijab)
        ctx.px(ox + 13, oy + 1, hijab)
        ctx.rect(ox + 5, oy + 2, 8, 1, hijab)
        ctx.px(ox + 13, oy + 2, hijab)
        ctx.rect(ox + 12, oy + 3, 2, 4, hijab)
        ctx.rect(ox + 1, oy + 2, 4, 6, hijab)
        ctx.px(ox + 11, oy + 3, hijab_dark)
        ctx.rect(ox + 11, oy + 8, 1, 2, hijab)
    elif dir_ == 3:
        ctx.rect(ox + 2, oy + 2, 12, 9, hijab)
        ctx.rect(ox + 5, oy + 4, 6, 1, hijab_dark)
        ctx.px(ox + 6, oy + 8, hijab_dark)
        ctx.px(ox + 9, oy + 8, hijab)


def bridge_hijab_to_jilbab(ctx: Ctx, ox: int, oy: int, dir_: int, hijab) -> None:
    if dir_ == 0:
        ctx.rect(ox + 4, oy + 9, 2, 1, hijab)
        ctx.px(ox + 11, oy + 9, hijab)
        ctx.rect(ox + 2, oy + 7, 2, 3, hijab)
        ctx.rect(ox + 12, oy + 7, 2, 3, hijab)
    elif dir_ == 1:
        ctx.rect(ox + 8, oy + 3, 3, 7, hijab)
        ctx.px(ox + 5, oy + 9, hijab)
        ctx.rect(ox + 2, oy + 7, 2, 3, hijab)
        ctx.rect(ox + 11, oy + 8, 3, 2, hijab)
    elif dir_ == 2:
        ctx.rect(ox + 5, oy + 3, 3, 7, hijab)
        ctx.rect(ox + 11, oy + 4, 1, 4, hijab)
        ctx.px(ox + 10, oy + 9, hijab)
        ctx.rect(ox + 12, oy + 7, 2, 3, hijab)
        ctx.rect(ox + 2, oy + 8, 3, 2, hijab)
    elif dir_ == 3:
        ctx.rect(ox + 1, oy + 10, 14, 1, hijab)


def draw_hijab_cheek_accents(ctx: Ctx, ox: int, oy: int, cheeks, hijab, hijab_dark, dir_: int) -> None:
    crown_y = 2 if dir_ == 0 else 3
    for c in cheeks:
        ctx.rect(ox + c["crownX"], oy + crown_y, c["crownW"], 1, hijab)
        ctx.px(ox + c["col"], oy + 4, hijab_dark)
        ctx.rect(ox + c["col"], oy + 5, 1, 2, hijab)
        if c.get("jawY") is not None:
            ctx.px(ox + c["col"], oy + c["jawY"], hijab)
        if dir_ == 0 and c["col"] == 4:
            ctx.px(ox + 4, oy + 8, hijab)
        if dir_ == 0 and c["col"] == 12:
            ctx.px(ox + 12, oy + 8, hijab)


def draw_hijab_face(ctx: Ctx, ox: int, oy: int, dir_: int) -> None:
    skin = HIJAB_COLORS["skin"]
    hijab = HIJAB_COLORS["hijab"]
    hijab_dark = HIJAB_COLORS["hijabDark"]
    eye = HIJAB_COLORS["eye"]

    if dir_ == 3:
        draw_hijab_base(ctx, ox, oy, 3, hijab, hijab_dark)
        bridge_hijab_to_jilbab(ctx, ox, oy, 3, hijab)
        return

    layout = HIJAB_FACE_LAYOUT[dir_]
    draw_hijab_base(ctx, ox, oy, dir_, hijab, hijab_dark)
    draw_hijab_face_skin_octagon(ctx, ox, oy, dir_, skin)
    for e in layout["eyes"]:
        ctx.rect(ox + e["x"], oy + e["y"], 2, 2, eye)
    draw_hijab_smile(ctx, ox, oy, dir_)
    draw_hijab_cheek_accents(ctx, ox, oy, layout["hijabCheeks"], hijab, hijab_dark, dir_)
    bridge_hijab_to_jilbab(ctx, ox, oy, dir_, hijab)


def draw_jilbab_body(ctx: Ctx, ox: int, oy: int, dir_: int, frame: int) -> None:
    C = JILBAB_COLORS
    walk_offset = 0 if frame in (1, 3) else 1
    leg_l = 1 if frame < 2 else -1
    hem_y = 19 + walk_offset

    if dir_ == 0:
        foot_x = 6 if leg_l > 0 else 8
    elif dir_ == 1:
        foot_x = 5 + leg_l
    elif dir_ == 2:
        foot_x = 8 - leg_l
    else:
        foot_x = 7

    paint_jilbab_undercoat(ctx, ox, oy, dir_, hem_y)
    paint_jilbab_edge_outline(ctx, ox, oy, hem_y)

    if dir_ == 0:
        ctx.rect(ox + 3, oy + 10, 10, 2, C["jilbab"])
        ctx.rect(ox + 2, oy + 12, 11, 4, C["jilbab"])
        fill_jilbab_skirt_to_hem(ctx, ox, oy, 0, hem_y)
        draw_jilbab_hem_and_feet(ctx, ox, oy, 0, hem_y, foot_x, leg_l)
    elif dir_ == 1:
        ctx.rect(ox + 8, oy + 10, 7, 9, C["jilbab"])
        ctx.rect(ox + 4, oy + 10, 5, 9, C["jilbab"])
        fill_jilbab_skirt_to_hem(ctx, ox, oy, 1, hem_y)
        draw_jilbab_hem_and_feet(ctx, ox, oy, 1, hem_y, foot_x, leg_l)
    elif dir_ == 2:
        ctx.rect(ox + 1, oy + 10, 7, 9, C["jilbab"])
        ctx.rect(ox + 7, oy + 10, 5, 9, C["jilbab"])
        fill_jilbab_skirt_to_hem(ctx, ox, oy, 2, hem_y)
        draw_jilbab_hem_and_feet(ctx, ox, oy, 2, hem_y, foot_x, leg_l)
    elif dir_ == 3:
        ctx.rect(ox + 1, oy + 10, 14, 9, C["jilbab"])
        ctx.rect(ox + 0, oy + 17, 15, 2, C["jilbab"])
        fill_jilbab_skirt_to_hem(ctx, ox, oy, 3, hem_y)
        draw_jilbab_hem_and_feet(ctx, ox, oy, 3, hem_y, foot_x, leg_l)


def draw_woman_jilbab(ctx: Ctx, ox: int, oy: int, dir_: int, frame: int) -> None:
    draw_jilbab_body(ctx, ox, oy, dir_, frame)
    draw_hijab_face(ctx, ox, oy, dir_)


def pixel(img: Image.Image, x: int, y: int):
    if x < 0 or y < 0 or x >= img.width or y >= img.height:
        return (0, 0, 0)
    return img.getpixel((x, y))[:3]


def is_jilbab(rgb) -> bool:
    return rgb in (JILBAB_COLORS["jilbab"], JILBAB_COLORS["jilbabLight"], JILBAB_COLORS["jilbabDark"])


def assert_head(img: Image.Image, dir_: int) -> list[str]:
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
        p = pixel(img, col, 5)
        if p == C["skin"]:
            errors.append(f"dir {dir_}: hijab cheek col {col} row 5 is skin (overlap)")
        if p not in (C["hijab"], C["hijabDark"]):
            errors.append(f"dir {dir_}: hijab cheek col {col} row 5 not hijab")

    if dir_ == 1 and pixel(img, 4, 5) == C["skin"]:
        errors.append("dir 1: col 4 row 5 must not be skin")
    if dir_ == 2 and pixel(img, 8, 5) == C["skin"]:
        errors.append("dir 2: col 8 row 5 must not be skin")
    if dir_ == 1 and pixel(img, 11, 4) not in (C["hijab"], C["hijabDark"]):
        errors.append("dir 1: rear hijab must sit behind face (col 11)")
    if dir_ == 2 and pixel(img, 4, 4) not in (C["hijab"], C["hijabDark"]):
        errors.append("dir 2: rear hijab must sit behind face (col 4)")

    if dir_ == 0:
        if pixel(img, 5, 5) != C["skin"]:
            errors.append("dir 0: col 5 row 5 must be skin gap")
        if pixel(img, 11, 5) != C["skin"]:
            errors.append("dir 0: col 11 row 5 must be skin gap")
        if pixel(img, 4, 5) not in (C["hijab"], C["hijabDark"]):
            errors.append("dir 0: col 4 row 5 must be hijab cheek")
        if pixel(img, 12, 5) not in (C["hijab"], C["hijabDark"]):
            errors.append("dir 0: col 12 row 5 must be hijab cheek")
        for ex, ey in ((0, 9), (1, 9), (14, 9), (15, 9)):
            if pixel(img, ex, ey) in (C["hijab"], C["hijabDark"]):
                errors.append(f"dir 0: ({ex},{ey}) must not be hijab (no far ear blocks)")
        if pixel(img, 5, 4) in (C["hijab"], C["hijabDark"]):
            errors.append("dir 0: no brow band above face at y=4 col 5")
        if pixel(img, 7, 8) not in (C["skin"], C["lip"]):
            errors.append("dir 0: mouth row must be skin or smile color")
        for corner in ((5, 3), (11, 3)):
            if pixel(img, corner[0], corner[1]) == C["skin"]:
                errors.append(f"dir 0: octagon corner {corner} must not be skin")
        if pixel(img, 6, 3) != C["skin"]:
            errors.append("dir 0: octagon top row must include skin at col 6")

    return errors


def alpha_at(img: Image.Image, x: int, y: int) -> int:
    if x < 0 or y < 0 or x >= img.width or y >= img.height:
        return 0
    return img.getpixel((x, y))[3]


def silhouette_regions(dir_: int, frame: int) -> list[tuple[int, int, int, int]]:
    hem_y = 19 + (0 if frame in (1, 3) else 1)
    if dir_ == 3:
        return [
            (2, 13, 2, 10),
            (0, 15, 10, hem_y),
        ]
    if dir_ == 0:
        return [
            (2, 13, 2, 10),
            (0, 15, 10, hem_y),
        ]
    if dir_ in (1, 2):
        return [
            (2, 13, 1, 9),
            (0, 15, 10, hem_y),
        ]
    return [
        (2, 13, 1, 9),
        (0, 15, 10, hem_y),
    ]


def assert_no_holes(img: Image.Image, dir_: int, frame: int) -> list[str]:
    errors: list[str] = []
    for x0, x1, y0, y1 in silhouette_regions(dir_, frame):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if alpha_at(img, x, y) == 0:
                    errors.append(f"hole dir {dir_} frame {frame} at ({x},{y})")
    return errors


def assert_body(img: Image.Image, dir_: int, frame: int = 0) -> list[str]:
    errors: list[str] = []
    C = JILBAB_COLORS
    hem_y = 19 + (0 if frame in (1, 3) else 1)
    shoe_y = hem_y + 1
    leg_l = 1 if frame < 2 else -1

    if dir_ == 0:
        if pixel(img, 8, 18) not in (C["jilbab"], C["jilbabDark"], C["jilbabLight"]):
            errors.append("dir 0: center robe must be continuous at y=18 (no leg gap)")
        if not is_jilbab(pixel(img, 1, hem_y)) or not is_jilbab(pixel(img, 14, hem_y)):
            errors.append(f"dir 0: hem must flare to cols 1 and 14 at y={hem_y}")
        left_x = 3 + leg_l
        right_x = 9 - leg_l
        if pixel(img, left_x, shoe_y) != C["shoe"]:
            errors.append(f"dir 0: left shoe at ({left_x},{shoe_y})")
        if pixel(img, right_x, shoe_y) != C["shoe"]:
            errors.append(f"dir 0: right shoe at ({right_x},{shoe_y})")
        if is_jilbab(pixel(img, 7, shoe_y)) and pixel(img, 7, shoe_y) != C["jilbabDark"]:
            errors.append(f"dir 0: gap between shoes at y={shoe_y} should not be robe cloth")
    elif dir_ in (1, 2):
        if not is_jilbab(pixel(img, 1, hem_y)):
            errors.append(f"dir {dir_}: hem must reach col 1 at y={hem_y}")
        foot_x = 5 + leg_l if dir_ == 1 else 8 - leg_l
        if pixel(img, foot_x, shoe_y) != C["shoe"]:
            errors.append(f"dir {dir_}: shoe at ({foot_x},{shoe_y})")
    elif dir_ == 3:
        if pixel(img, 3, shoe_y) != C["shoe"] or pixel(img, 9, shoe_y) != C["shoe"]:
            errors.append(f"dir 3: both shoes below hem at y={shoe_y}")

    return errors


def render_sheet(cells: list[tuple[Image.Image, str]], out_path: Path, cols: int) -> None:
    pad = 8
    panel_w = CHAR_W * SCALE
    panel_h = CHAR_H * SCALE + 20
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new(
        "RGBA",
        (panel_w * cols + pad * (cols + 1), (panel_h + pad) * rows + pad),
        (0x1A, 0x1A, 0x2E, 255),
    )
    draw_sheet = ImageDraw.Draw(sheet)
    for i, (img, label) in enumerate(cells):
        row, col = divmod(i, cols)
        big = img.resize((panel_w, CHAR_H * SCALE), Image.NEAREST)
        dx = pad + col * (panel_w + pad)
        dy = pad + row * (panel_h + pad)
        sheet.paste(big, (dx, dy))
        draw_sheet.text((dx, dy + CHAR_H * SCALE + 4), label, fill=(0xE8, 0xE0, 0xD0))
    sheet.save(out_path)
    print("Wrote", out_path)


def main() -> int:
    verify_markers_in_js()
    all_errors: list[str] = []

    head_cells: list[tuple[Image.Image, str]] = []
    for dir_, label in [(0, "front"), (1, "left"), (2, "right"), (3, "back")]:
        head = Image.new("RGBA", (CHAR_W, CHAR_H), (0, 0, 0, 0))
        draw_hijab_face(Ctx(head), 0, 0, dir_)
        all_errors.extend(assert_head(head, dir_))
        head_cells.append((head, label))

    full_cells: list[tuple[Image.Image, str]] = []
    for dir_, dlabel in [(0, "front"), (1, "left"), (2, "right"), (3, "back")]:
        for frame, flabel in [(0, "f0"), (1, "f1"), (2, "f2"), (3, "f3")]:
            body = Image.new("RGBA", (CHAR_W, CHAR_H), (0, 0, 0, 0))
            draw_woman_jilbab(Ctx(body), 0, 0, dir_, frame)
            all_errors.extend(assert_no_holes(body, dir_, frame))
            if frame == 0:
                all_errors.extend(assert_head(body, dir_))
            all_errors.extend(assert_body(body, dir_, frame))
            full_cells.append((body, f"{dlabel} {flabel}"))

    render_sheet(head_cells, OUT_HEAD, 4)
    render_sheet(full_cells, OUT_FULL, 4)

    if all_errors:
        print("ASSERT FAILURES:")
        for e in all_errors:
            print(" -", e)
        return 1
    print("All pixel asserts passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
