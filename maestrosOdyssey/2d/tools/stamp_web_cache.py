#!/usr/bin/env python3
"""Point the Godot shell at a versioned pck/js so a re-export actually loads."""
from __future__ import annotations

from pathlib import Path

WWW = Path(__file__).resolve().parents[2] / "www"


def _stamp(html: Path, token: str) -> None:
    text = html.read_text(encoding="utf-8")
    text = text.replace('src="brew.js"', f'src="brew.js?v={token}"', 1)
    needle = "const engine = new Engine(GODOT_CONFIG);"
    patch = (
        "const engine = new Engine(GODOT_CONFIG);\n"
        "const _preload = engine.preloadFile.bind(engine);\n"
        "engine.preloadFile = function (file, path) {\n"
        f"\tif (file === 'brew.pck') return _preload('brew.pck?v={token}', 'brew.pck');\n"
        "\treturn _preload(file, path);\n"
        "};"
    )
    if needle in text and "brew.pck?v=" not in text:
        text = text.replace(needle, patch, 1)
    html.write_text(text, encoding="utf-8")


def main() -> int:
    pck = WWW / "brew.pck"
    token = str(pck.stat().st_size if pck.exists() else 0)
    for name in ("brew.html", "index.html"):
        path = WWW / name
        if path.exists():
            _stamp(path, token)
    print(f"web cache stamp: {token}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
