#!/usr/bin/env bash
# Install daily LoreKeeper store backup on the VPS (#26).
set -euo pipefail

SCRIPT="${LOREKEEPER_BACKUP_SCRIPT:-$HOME/kids-sites/lorekeeper/scripts/backup-lorekeeper-store.sh}"
MARK="# lorekeeper-store-backup"
CRON_LINE="15 3 * * * LOREKEEPER_BASE=\$HOME/kids-sites bash $SCRIPT >> \$HOME/lorekeeper-backups/backup.log 2>&1"

if [[ ! -x "$SCRIPT" ]] && [[ ! -f "$SCRIPT" ]]; then
  echo "Backup script missing: $SCRIPT" >&2
  exit 1
fi
chmod +x "$SCRIPT" 2>/dev/null || true

TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v "$MARK" >"$TMP" || true
echo "$CRON_LINE $MARK" >>"$TMP"
crontab "$TMP"
rm -f "$TMP"
echo "Installed daily backup at 03:15 UTC."
echo "Log: ~/lorekeeper-backups/backup.log"
