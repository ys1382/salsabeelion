"""Gold lock: Mara's typed order finishes with a visible cup/muffin, no wait."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAFE = ROOT / "ui" / "cafe_order.gd"
DIALOGUE = ROOT / "ui" / "dialogue_ui.gd"
PLAYER = ROOT / "actors" / "player.gd"


def main() -> int:
    cafe = CAFE.read_text(encoding="utf-8")
    dialogue = DIALOGUE.read_text(encoding="utf-8")
    player = PLAYER.read_text(encoding="utf-8")
    assert "menu_read" in cafe, "order still requires reading the board first"
    assert "A drink and a food" in cafe
    assert "A drink y a food" in cafe
    assert "say y instead of and" in cafe
    assert "here we say y" in cafe
    assert "needs_y" in cafe
    assert "something to eat with it" in cafe
    assert "show_order_box" in dialogue
    assert "Type your order, then Enter" in dialogue
    assert "E — Close" in dialogue
    assert "_hint.hide()" in dialogue
    assert (
        '\tif DialogueUI.is_ordering():\n'
        '\t\treturn ""\n'
        '\tif DialogueUI.is_open():\n'
        '\t\tDialogueUI.close()'
    ) in player, "E must still close speech so Mara's type box can open"
    physics = player.split("func _physics_process", 1)[1].split("func _update_focus", 1)[0]
    seated = physics.split("if seated:", 1)[1]
    assert "stand_up" not in seated, "D / WASD must not stand you up; E — Stand does"
    project = (ROOT / "project.godot").read_text(encoding="utf-8")
    interact = project.split("interact={", 1)[1].split("attack={", 1)[0]
    assert 'keycode":69' in interact
    assert 'keycode":32' not in interact, "Space must not sit, stand, talk, or close"
    assert "Here you go" in cafe and "that's ready" in cafe, (
        "successful order must hand the drink over in the same line")
    assert "I'll get that started" not in cafe, (
        "do not hang the player on a kitchen wait that never finishes")
    assert "order_ready" in cafe and "texture_for" in cafe
    assert "_draw_cup" in cafe and "_draw_muffin" in cafe
    assert "Held" in player and "_on_order_ready" in player
    assert "try_sip" in player and "try_bite" in player
    assert "Vector2(2, 2)" not in player, "cup must stay smaller than the player"
    print("mara order gold: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
