#!/usr/bin/env python3
"""Build compact US-RIIS latin-name lookup for Bane of Extinction.

Source: USGS US-RIIS ver. 2.0 MasterList CSV (CC0 1.0).
DOI: https://doi.org/10.5066/P9KFFTOD

Usage:
  python3 baneOfExtinction/scripts/build_us_riis_lookup.py \\
    /path/to/USRIISv2_MasterList.csv
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

SEVERITY = {"widespread_invasive": 3, "invasive": 2, "introduced": 1}
OUT = Path(__file__).resolve().parents[1] / "data" / "us_riis_lookup.json"


def norm_latin(name: str) -> str:
    s = re.sub(r"\s+", " ", (name or "").strip().lower())
    parts = s.split()
    if len(parts) >= 2:
        return f"{parts[0]} {parts[1]}"
    return s


def degree_key(raw: str) -> str:
    low = (raw or "").lower()
    if "widespread invasive" in low:
        return "widespread_invasive"
    if "invasive" in low:
        return "invasive"
    return "introduced"


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: build_us_riis_lookup.py USRIISv2_MasterList.csv", file=sys.stderr)
        return 2
    src = Path(sys.argv[1])
    if not src.is_file():
        print(f"Missing CSV: {src}", file=sys.stderr)
        return 1

    by: dict[str, dict] = {}
    with src.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            key = norm_latin(row.get("scientificName") or "")
            if not key or " " not in key:
                continue
            loc = (row.get("locality") or "").strip().upper()
            if loc not in ("L48", "AK", "HI"):
                continue
            deg = degree_key(row.get("degreeOfEstablishment") or "")
            vern = (row.get("vernacularName") or "").strip()
            entry = by.setdefault(key, {"locs": {}})
            prev = entry["locs"].get(loc)
            if prev is None or SEVERITY[deg] > SEVERITY[prev]:
                entry["locs"][loc] = deg
            if vern and not entry.get("common"):
                entry["common"] = vern[:80]

    compact: dict[str, dict] = {}
    for k, v in sorted(by.items()):
        item = dict(v["locs"])
        if v.get("common"):
            item["c"] = v["common"]
        compact[k] = item

    payload = {
        "v": "2.0",
        "doi": "10.5066/P9KFFTOD",
        "src": "USGS US-RIIS",
        "attr": (
            "U.S. Geological Survey. United States Register of Introduced and "
            "Invasive Species (US-RIIS) ver. 2.0 "
            "(https://doi.org/10.5066/P9KFFTOD). CC0 1.0."
        ),
        "n": len(compact),
        "by": compact,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=True) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT} ({payload['n']} taxa)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
