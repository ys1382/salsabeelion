#!/usr/bin/env bash
# Pre-deploy door + invariant checks for Maestro's Odyssey.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Maestro's verify: door invariants..."
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
