#!/usr/bin/env bash
# Pre-deploy checks for Maestro's Odyssey.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WWW="$ROOT/maestrosOdyssey/www"

if grep -q 'new Engine' "$WWW/index.html" 2>/dev/null && ls "$WWW"/*.wasm >/dev/null 2>&1; then
  echo "Maestro's verify: Godot web build..."
  if ! grep -q 'Engine' "$WWW/index.html"; then
    echo "Maestro's verify: index.html does not look like a Godot export" >&2
    exit 1
  fi
  python3 "$ROOT/maestrosOdyssey/2d/backend/test_dragons_brew.py"
  echo "Maestro's verify: OK (Godot web)"
  exit 0
fi

echo "Maestro's verify: Phaser door invariants..."
python3 "$SCRIPT_DIR/test-mo-doors.py"

if command -v node >/dev/null 2>&1; then
  node "$SCRIPT_DIR/test-mo-doors.mjs"
elif [[ -x /opt/homebrew/bin/node ]]; then
  /opt/homebrew/bin/node "$SCRIPT_DIR/test-mo-doors.mjs"
elif [[ -x /usr/local/bin/node ]]; then
  /usr/local/bin/node "$SCRIPT_DIR/test-mo-doors.mjs"
else
  echo "note: node not found — python door checks only"
fi

echo "Maestro's verify: OK"
