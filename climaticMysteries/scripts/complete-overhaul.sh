#!/usr/bin/env bash
# Promote staged Boe overhaul files into live boe/ per a MANIFEST.json.
# Usage: bash boe/scripts/complete-overhaul.sh boe/overhaul/MANIFEST.json
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <manifest.json>" >&2
  echo "Example: $0 boe/overhaul/MANIFEST.json" >&2
  exit 1
fi

MANIFEST_INPUT="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$BOE_ROOT/.." && pwd)"

if [[ "$MANIFEST_INPUT" = /* ]]; then
  MANIFEST="$MANIFEST_INPUT"
else
  MANIFEST="$REPO_ROOT/$MANIFEST_INPUT"
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "Manifest not found: $MANIFEST" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to read the manifest." >&2
  exit 1
fi

read -r LABEL ARCHIVE_BEFORE DEPLOY <<EOF
$(python3 - "$MANIFEST" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    m = json.load(f)
if m.get("version") != 1:
    raise SystemExit(f"Unsupported manifest version: {m.get('version')!r} (expected 1)")
print(m.get("label", "overhaul"))
print("1" if m.get("archive_before", True) else "0")
print("1" if m.get("deploy", False) else "0")
PY
)
EOF

PROMOTE_LINES="$(python3 - "$MANIFEST" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    m = json.load(f)
for item in m.get("promote", []):
    print(f"{item['from']}\t{item['to']}")
PY
)"

if [[ -z "$PROMOTE_LINES" ]]; then
  echo "Manifest has no promote entries: $MANIFEST" >&2
  exit 1
fi

STAMP="$(date +%Y-%m-%d)"
SAFE_LABEL="$(echo "$LABEL" | tr ' /' '__' | tr -cd '[:alnum:]_.-')"
ARCHIVE_DIR="$BOE_ROOT/_archive/pre-promote-${STAMP}-${SAFE_LABEL}"

if [[ "$ARCHIVE_BEFORE" == "1" ]]; then
  mkdir -p "$ARCHIVE_DIR"
  echo "Archiving current live boe/ -> $ARCHIVE_DIR ..."
  rsync -a --exclude='_archive/' --exclude='overhaul/' "$BOE_ROOT/" "$ARCHIVE_DIR/"
  cp -f "$MANIFEST" "$ARCHIVE_DIR/MANIFEST-used.json"
fi

echo "Promoting from manifest: $MANIFEST"
while IFS=$'\t' read -r FROM_REL TO_REL; do
  [[ -z "$FROM_REL" ]] && continue
  FROM="$BOE_ROOT/$FROM_REL"
  TO="$BOE_ROOT/$TO_REL"
  if [[ ! -e "$FROM" ]]; then
    echo "Missing source (from): $FROM_REL" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$TO")"
  if [[ -d "$FROM" ]]; then
    echo "  $FROM_REL/ -> $TO_REL/"
    rsync -a --delete "$FROM/" "$TO/"
  else
    echo "  $FROM_REL -> $TO_REL"
    cp -f "$FROM" "$TO"
  fi
done <<< "$PROMOTE_LINES"

if [[ "$DEPLOY" == "1" ]]; then
  echo "Deploying to server (boe/scripts/deploy.sh) ..."
  bash "$SCRIPT_DIR/deploy.sh"
else
  echo "Skipping deploy (manifest deploy: false)."
fi

echo "Overhaul promote complete (label: $LABEL)."
