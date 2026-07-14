#!/usr/bin/env bash
# Vendor Quill editor on Odd Trove — no CDN while writing (privacy).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/www/vendor/quill/1.3.7/dist"
mkdir -p "$DEST"
BASE="https://cdn.jsdelivr.net/npm/quill@1.3.7/dist"
for FILE in quill.min.js quill.snow.css; do
  curl -fsSL "$BASE/$FILE" -o "$DEST/$FILE"
  echo "ok: $FILE"
done
echo "Quill vendored in $DEST"
