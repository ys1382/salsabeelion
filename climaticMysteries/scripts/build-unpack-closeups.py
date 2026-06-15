#!/usr/bin/env python3
"""Crop unpack close-ups from rental_unpack_scene.png using unpack_masks/.

Same pixels as the wide room — lighting, wood, rug stay consistent.
Regenerate after scene or mask art changes:

  python3 climaticMysteries/scripts/build-unpack-closeups.py
"""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCENES = ROOT / "assets" / "scenes"
OUT = SCENES / "unpack_closeups"
SCENE_PATH = SCENES / "rental_unpack_scene.png"
MASK_DIR = SCENES / "unpack_masks"

PAD = {
    "duffel": 0.55,
    "folder": 0.65,
    "notebook": 0.70,
    "bottle": 0.75,
    "keys": 0.90,
}
TARGET_MIN = 1024
ITEMS = ("duffel", "folder", "notebook", "bottle", "keys")


def mask_bbox(mask: Image.Image) -> tuple[int, int, int, int]:
    px = mask.load()
    w, h = mask.size
    xs: list[int] = []
    ys: list[int] = []
    for y in range(h):
        for x in range(w):
            if px[x, y] > 10:
                xs.append(x)
                ys.append(y)
    if not xs:
        raise ValueError("empty mask")
    return min(xs), min(ys), max(xs), max(ys)


def square_crop(
    sw: int, sh: int, x0: int, y0: int, x1: int, y1: int, pad: float
) -> tuple[int, int, int, int]:
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    px_pad = int(max(bw, bh) * pad)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    half = max(bw, bh) // 2 + px_pad
    left = max(0, cx - half)
    top = max(0, cy - half)
    right = min(sw, cx + half)
    bottom = min(sh, cy + half)
    w, h = right - left, bottom - top
    if w > h:
        d = w - h
        top = max(0, top - d // 2)
        bottom = min(sh, top + w)
    elif h > w:
        d = h - w
        left = max(0, left - d // 2)
        right = min(sw, left + h)
    return left, top, right, bottom


def main() -> None:
    scene = Image.open(SCENE_PATH).convert("RGB")
    sw, sh = scene.size
    OUT.mkdir(parents=True, exist_ok=True)

    for name in ITEMS:
        mask_path = MASK_DIR / f"{name}.png"
        mask = Image.open(mask_path).convert("L")
        if mask.size != (sw, sh):
            mask = mask.resize((sw, sh), Image.NEAREST)
        x0, y0, x1, y1 = mask_bbox(mask)
        box = square_crop(sw, sh, x0, y0, x1, y1, PAD.get(name, 0.6))
        crop = scene.crop(box)
        cw, ch = crop.size
        scale = TARGET_MIN / min(cw, ch)
        if scale > 1:
            crop = crop.resize((int(cw * scale), int(ch * scale)), Image.LANCZOS)
        out_path = OUT / f"{name}.png"
        crop.save(out_path, optimize=True)
        print(f"wrote {out_path.relative_to(ROOT)} {crop.size}")


if __name__ == "__main__":
    main()
