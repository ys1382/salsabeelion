"""House-rules wall sign: one paper, no thin title bar."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORLD = ROOT / "backend" / "dragons_brew_world.json"
DIALOGUE = ROOT / "ui" / "dialogue_ui.gd"
PLAYER = ROOT / "actors" / "player.gd"
JOURNAL = ROOT / "ui" / "journal.gd"


def main() -> int:
    world = json.loads(WORLD.read_text(encoding="utf-8"))
    board = next(
        it
        for it in world["interiors"]["dragons_brew"]["interactables"]
        if it["id"] == "house_board"
    )
    text = board["text"]
    assert text.startswith("House rules")
    assert "No customer" in text
    assert "Smoking" in text
    assert "Drinking Alcohol" in text

    dialogue = DIALOGUE.read_text(encoding="utf-8")
    assert "func show_sign" in dialogue
    assert "_sign_body" in dialogue
    assert "_sign_title" not in dialogue
    assert "text.strip_edges()" in dialogue
    player = PLAYER.read_text(encoding="utf-8")
    assert 'it.data.get("id", "")) == "house_board"' in player
    assert "DialogueUI.show_sign(line)" in player
    assert 'DialogueUI.show_line("", line)' in player, "drink menu still uses the chat panel"
    journal = JOURNAL.read_text(encoding="utf-8")
    assert 'beat.get("id", "")) == "house_rules"' in journal
    print("house_rules_sign: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
