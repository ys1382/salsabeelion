 #!/usr/bin/env python3
"""Crop unpack close-ups from rental_unpack_scene.png using unpack_masks/.

Same pixels as the wide room. Each crop wraps the item mask with breathing room (sharp — no upscale)
with the item mask centroid at the center of the frame when possible.

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

# Padding around each mask bbox (× width/height). Tight close-ups, not wide-room crops.
ITEM_PAD = {
    "duffel": 2.15,
    "folder": 2.05,
    "notebook": 2.05,
    "bottle": 2.05,
    "keys": 2.2,
}
MIN_HALF_W = 100


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


def half_w_from_bbox(name: str, x0: int, y0: int, x1: int, y1: int) -> int:
    """3:2 crop half-width that wraps the mask bbox with item-specific breathing room."""
    pad = ITEM_PAD.get(name, 2.05)
    bw = x1 - x0 + 1
    bh = y1 - y0 + 1
    req_w = bw * pad
    req_h = bh * pad
    if req_w / max(req_h, 1) >= ASPECT:
        crop_w = req_w
        crop_h = crop_w / ASPECT
    else:
        crop_h = req_h
        crop_w = crop_h * ASPECT
    return max(int(crop_w / 2), MIN_HALF_W)


KEYS_HALF_W = 88  # preview F — best center so far


def keys_crop_box(
    sw: int,
    sh: int,
    cx: int,
    cy: int,
    y0: int,
    y1: int,
) -> tuple[int, int, int, int]:
    """Key ring centered like preview F, zoomed in tighter."""
    half_w = KEYS_HALF_W
    half_h = max(int(half_w / ASPECT), 24)
    left = max(0, min(cx - half_w, sw - half_w * 2))
    right = min(sw, left + half_w * 2)
    left = max(0, right - half_w * 2)
    top = max(0, min(cy - half_h, sh - half_h * 2))
    bottom = min(sh, top + half_h * 2)
    top = max(0, bottom - half_h * 2)
    return left, top, right, bottom


def clamp_crop_to_scene(
    sw: int,
    sh: int,
    cx: int,
    cy: int,
    half_w: int,
) -> tuple[int, int, int, int]:
    """Shift a centered crop box inward if it crosses scene edges."""
    half_h = max(int(half_w / ASPECT), 27)
    left = max(0, min(cx - half_w, sw - half_w * 2))
    top = max(0, min(cy - half_h, sh - half_h * 2))
    right = min(sw, left + half_w * 2)
    bottom = min(sh, top + half_h * 2)
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
        half_w = half_w_from_bbox(name, x0, y0, x1, y1)
        if name == "keys":
            box = keys_crop_box(sw, sh, cx, cy, y0, y1)
        else:
            box = clamp_crop_to_scene(sw, sh, cx, cy, half_w)
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
