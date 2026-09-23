"""Favorite lines ramp English → Spanish. First ones must still be readable."""
from __future__ import annotations

from pathlib import Path

PHRASES = Path(__file__).resolve().parents[1] / "ui" / "cafe_phrases.gd"


def main() -> int:
    text = PHRASES.read_text(encoding="utf-8")
    assert "El té es mi favorito." not in text
    assert "Té is my favorite." in text
    assert "El café is my favorite." in text
    assert "Ramp English" in text
    print("cafe phrases: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
