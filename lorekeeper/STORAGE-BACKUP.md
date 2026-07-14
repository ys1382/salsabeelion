# LoreKeeper storage backup & restore

**Owner-only.** This file describes paths and procedure only — never put `lorekeeper-store.json` or draft content in git.

## What gets backed up

- **Live store:** `~/kids-sites/lorekeeper-data/lorekeeper-store.json` on the VPS (all signed-in accounts’ note/document blobs).
- **Rotated copies:** `~/lorekeeper-backups/lorekeeper-store-*.json` on the VPS (30 kept by default).
- **Off-server copy (recommended):** run `pull-lorekeeper-backup.sh` from your computer on a schedule.

## Automated backup on the VPS

After deploy, once on the server:

```bash
bash ~/kids-sites/lorekeeper/scripts/install-backup-cron.sh
```

Manual run:

```bash
bash ~/kids-sites/lorekeeper/scripts/backup-lorekeeper-store.sh
```

## Pull off the VPS (your machine)

```bash
bash lorekeeper/scripts/pull-lorekeeper-backup.sh
```

Default destination: `~/LoreKeeper-backups/`. Add to your own calendar or local cron.

## Recovery drill (#30)

1. Verify a backup: `bash lorekeeper/scripts/verify-store-json.sh ~/lorekeeper-backups/lorekeeper-store-latest.json`
2. On the VPS: `bash ~/kids-sites/lorekeeper/scripts/restore-lorekeeper-store.sh`
3. Restart LoreKeeper API (re-run deploy or start `lorekeeper_api.py`).
4. Sign in — check home notes and a document. Export JSON as a second sanity check.

The restore script keeps a `*.pre-restore-*` copy of the live file before overwriting.

## Owner’s Office

**Storage meta** shows last backup age, store size, and an export reminder — counts only, never note text.
