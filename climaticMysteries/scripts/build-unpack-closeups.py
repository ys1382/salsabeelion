#!/usr/bin/env python3
"""Crop unpack close-ups from rental_unpack_scene.png using unpack_masks/.

Same pixels as the wide room. Each crop is as large as possible (sharp — no upscale)
with the item mask centroid at the exact center of the frame.

  python3 climaticMysteries/scripts/build-unpack-closeups.py
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCENES = ROOT / "assets" / "scenes"
OUT = SCENES / "unpack_closeups"
META_PATH = OUT / "focus.json"
SCENE_PATH = SCENES / "rental_unpack_scene.png"
MASK_DIR = SCENES / "unpack_masks"

ASPECT = 3 / 2  # match rental_unpack_scene.png (1536×1024)
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


def max_centered_half_w(sw: int, sh: int, cx: int, cy: int) -> int:
    """Largest 3:2 window centered on (cx, cy) that fits inside the scene."""
    hw = min(cx, sw - cx)
    hh = hw / ASPECT
    if cy - hh < 0:
        hw = min(hw, int(cy * ASPECT))
        hh = hw / ASPECT
    if cy + hh > sh:
        hw = min(hw, int((sh - cy) * ASPECT))
    return max(int(hw), 40)


def centered_crop_box(
    sw: int,
    sh: int,
    cx: int,
    cy: int,
    half_w: int,
) -> tuple[int, int, int, int]:
    half_w = max(half_w, 40)
    half_h = max(int(half_w / ASPECT), 27)
    left = cx - half_w
    top = cy - half_h
    right = cx + half_w
    bottom = cy + half_h
    return left, top, right, bottom


def main() -> None:
    scene = Image.open(SCENE_PATH).convert("RGB")
    sw, sh = scene.size
    OUT.mkdir(parents=True, exist_ok=True)
    meta: dict[str, dict[str, float | int]] = {}

    for name in ITEMS:
        mask_path = MASK_DIR / f"{name}.png"
        mask = Image.open(mask_path).convert("L")
        if mask.size != (sw, sh):
            mask = mask.resize((sw, sh), Image.NEAREST)
        x0, y0, x1, y1 = mask_bbox(mask)
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        half_w = max_centered_half_w(sw, sh, cx, cy)
        box = centered_crop_box(sw, sh, cx, cy, half_w)
        crop = scene.crop(box)
        l, t, r, b = box
        cw, ch = crop.size

        out_path = OUT / f"{name}.png"
        crop.save(out_path, optimize=True)

        fx = round((cx - l) / cw * 100, 2)
        fy = round((cy - t) / ch * 100, 2)
        meta[name] = {
            "w": cw,
            "h": ch,
            "focusX": fx,
            "focusY": fy,
            "centerX": cx,
            "centerY": cy,
        }
        print(f"{name}: {cw}x{ch} crop={box} item@{fx}%,{fy}% (no upscale)")

    META_PATH.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {META_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
