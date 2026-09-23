"""Outdoor day/night look: night falls in the café; morning restores day."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DAY_NIGHT = ROOT / "world" / "day_night.gd"
BUILDER = ROOT / "world" / "world_builder.gd"
STATE = ROOT / "ui" / "game_state.gd"
PROJECT = ROOT / "project.godot"


def main() -> int:
    dn = DAY_NIGHT.read_text(encoding="utf-8")
    builder = BUILDER.read_text(encoding="utf-8")
    state = STATE.read_text(encoding="utf-8")
    project = PROJECT.read_text(encoding="utf-8")

    assert 'DayNight="*res://world/day_night.gd"' in project
    assert "DayNight.attach(self)" in builder
    assert "DayNight.begin_day()" in state

    assert 'building_id == "dragons_brew"' in dn
    assert "begin_night" in dn
    assert "ensure_night" in dn
    assert "begin_day" in dn
    assert "_want_night" in dn
    assert "WINDOWS" in dn
    assert "building.house_hay_1" in dn
    assert "building.house_hay_2" in dn
    assert "prop.lamppost_3" in dn
    assert "BLEND_MODE_ADD" in dn
    assert "NightFx" in dn
    # Richer glass (sun / moon / stars) stays post-upgrade — not drawn here.
    assert "make_star" not in dn and "draw_moon" not in dn
    print("day/night outdoor look: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
