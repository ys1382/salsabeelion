#!/usr/bin/env bash
# LoreKeeper — rotate backups of lorekeeper-store.json on the VPS (#26).
# No draft content in git — run on server only.
set -euo pipefail

BASE="${LOREKEEPER_BASE:-$HOME/kids-sites}"
DATA_PATH="${LOREKEEPER_DATA_PATH:-$BASE/lorekeeper-data/lorekeeper-store.json}"
BACKUP_DIR="${LOREKEEPER_BACKUP_DIR:-$HOME/lorekeeper-backups}"
KEEP="${LOREKEEPER_BACKUP_KEEP:-30}"
META_PATH="${LOREKEEPER_BACKUP_META:-$BASE/lorekeeper-data/backup-meta.json}"

if [[ ! -f "$DATA_PATH" ]]; then
  echo "No store at $DATA_PATH — nothing to back up." >&2
  exit 0
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_DIR/lorekeeper-store-$STAMP.json"
cp -p "$DATA_PATH" "$DEST"
chmod 600 "$DEST"
ln -sfn "$(basename "$DEST")" "$BACKUP_DIR/lorekeeper-store-latest.json"

# Drop oldest beyond KEEP
mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/lorekeeper-store-2*.json 2>/dev/null || true)
if ((${#OLD[@]} > KEEP)); then
  for ((i = KEEP; i < ${#OLD[@]}; i++)); do
    rm -f "${OLD[$i]}"
  done
fi

SIZE="$(wc -c < "$DATA_PATH" | tr -d ' ')"
NOW="$(date -u +%s)"
mkdir -p "$(dirname "$META_PATH")"
python3 - <<PY
import json, os
meta = {
  "lastBackupAt": $NOW,
  "lastBackupFile": "$(basename "$DEST")",
  "backupDir": "$BACKUP_DIR",
  "storeSizeBytes": int("$SIZE"),
  "storePath": "$DATA_PATH",
}
path = "$META_PATH"
try:
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            old = json.load(f)
        if isinstance(old, dict):
            meta["backupCount"] = int(old.get("backupCount") or 0) + 1
        else:
            meta["backupCount"] = 1
    else:
        meta["backupCount"] = 1
except Exception:
    meta["backupCount"] = 1
with open(path, "w", encoding="utf-8") as f:
    json.dump(meta, f, indent=2, sort_keys=True)
    f.write("\n")
os.chmod(path, 0o600)
PY

echo "Backed up to $DEST (keeping $KEEP copies in $BACKUP_DIR)"
