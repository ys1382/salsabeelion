"""Day-8 elder check-in: natural report, hidden score, card refill. No overlay."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "ui" / "elder_report.gd"
PLAYER = ROOT / "actors" / "player.gd"
DIALOGUE = ROOT / "ui" / "dialogue_ui.gd"
STATE = ROOT / "ui" / "game_state.gd"
PROJECT = ROOT / "project.godot"


def main() -> int:
    report = REPORT.read_text(encoding="utf-8")
    player = PLAYER.read_text(encoding="utf-8")
    dialogue = DIALOGUE.read_text(encoding="utf-8")
    state = STATE.read_text(encoding="utf-8")
    project = PROJECT.read_text(encoding="utf-8")
    assert "ElderReport" in project
    assert "day_index >= 8" in report
    assert "That sounds lovely, dear." in report
    assert "Can you go back and find out more for me?" in report
    assert "I haven't been to Dragon's Brew" in report
    assert "PASS_BUCKETS" in report
    assert "80%" not in report and "percentage" not in report.lower()
    assert "refill_card" in report and "refill_card" in state
    assert "npc_id == \"elder\"" in player
    assert "show_order_box" in dialogue
    assert "Type your order, then Enter" in dialogue
    print("elder report: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
