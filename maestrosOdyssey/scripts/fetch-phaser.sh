#!/usr/bin/env bash
# Vendor Phaser for Maestro's Odyssey — no CDN on load (faster, private).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/www/vendor/phaser/3.60.0/dist"
mkdir -p "$DEST"
curl -fsSL "https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js" -o "$DEST/phaser.min.js"
echo "Phaser 3.60.0 vendored in $DEST"
