#!/usr/bin/env bash
# Pull latest LoreKeeper store backup off the VPS to this machine (#26 off-server copy).
# Run from your laptop/desktop — not on the server. No draft content in git.
set -euo pipefail

HOST="${1:-root@157.230.130.12}"
REMOTE_BACKUP="${2:-~/lorekeeper-backups/lorekeeper-store-latest.json}"
LOCAL_DIR="${LOREKEEPER_LOCAL_BACKUP_DIR:-$HOME/LoreKeeper-backups}"

mkdir -p "$LOCAL_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$LOCAL_DIR/lorekeeper-store-$STAMP.json"

scp "$HOST:$REMOTE_BACKUP" "$DEST"
chmod 600 "$DEST"
ln -sfn "$(basename "$DEST")" "$LOCAL_DIR/lorekeeper-store-latest.json"
echo "Pulled to $DEST"
