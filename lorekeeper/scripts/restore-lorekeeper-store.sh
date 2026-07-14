#!/usr/bin/env bash
# LoreKeeper — restore lorekeeper-store.json from a rotated backup (#30 drill).
# Run on the VPS. Stops LoreKeeper API briefly while restoring.
set -euo pipefail

BASE="${LOREKEEPER_BASE:-$HOME/kids-sites}"
DATA_PATH="${LOREKEEPER_DATA_PATH:-$BASE/lorekeeper-data/lorekeeper-store.json}"
BACKUP_DIR="${LOREKEEPER_BACKUP_DIR:-$HOME/lorekeeper-backups}"

SOURCE="${1:-$BACKUP_DIR/lorekeeper-store-latest.json}"

if [[ ! -f "$SOURCE" ]]; then
  echo "Backup not found: $SOURCE" >&2
  echo "Usage: $0 [path-to-backup.json]" >&2
  exit 1
fi

if ! python3 -c "import json; json.load(open('$SOURCE'))" 2>/dev/null; then
  echo "File is not valid JSON: $SOURCE" >&2
  exit 1
fi

echo "Restore $SOURCE -> $DATA_PATH"
read -r -p "Type RESTORE to continue: " CONF
if [[ "$CONF" != "RESTORE" ]]; then
  echo "Cancelled."
  exit 1
fi

PRE="${DATA_PATH}.pre-restore-$(date -u +%Y%m%dT%H%M%SZ)"
if [[ -f "$DATA_PATH" ]]; then
  cp -p "$DATA_PATH" "$PRE"
  echo "Current store copied to $PRE"
fi

pkill -f "lorekeeper_api.py" 2>/dev/null || true
sleep 1
cp -p "$SOURCE" "$DATA_PATH"
chmod 600 "$DATA_PATH"

echo "Restored. Restart LoreKeeper API (deploy script or manual start)."
echo "Sign in and spot-check documents + notes before deleting $PRE."
