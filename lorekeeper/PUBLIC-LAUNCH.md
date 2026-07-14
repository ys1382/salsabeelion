# LoreKeeper — public launch checklist (#25)

**Manual steps only.** Do not remove the nginx owner gate until you have run Phase 0, trust Ask on your usual questions, and want real sign-ups.

## Before launch

- [ ] Phase 0 Tier A checklist complete (Owner's Office)
- [ ] Ask feels trustworthy on your usual scoped questions
- [ ] Off-server backups running (`lorekeeper/scripts/install-backup-cron.sh`)
- [ ] Account delete + export tested on a throwaway account (#31)
- [ ] Owner's Office → **New sign-ups** ON when ready

## Launch steps (you run)

1. Deploy latest LoreKeeper: `bash top/scripts/deploy-lorekeeper.sh` from repo root (does not restart Halalit).
2. Edit `top/nginx/oddtrove.art.conf` — remove `auth_basic` from the `/lorekeeper/` location (or create a public location block per your nginx layout).
3. On server: `nginx -t && systemctl reload nginx`
4. Verify https://oddtrove.art/lorekeeper/ loads **without** the nginx password prompt.
5. LoreKeeper **user** sign-in still required — only the outer owner gate comes off.

## After launch

- Monitor Owner's Office account count and private feedback only — never other writers' note text.
- Keep JSON export habit; optional email reminders ship when mail is configured (#23–24).
- **Loose-ends Layer 3 (optional)** — richer cross-note compare (skip `planned` lines in audits), in-app tag helpers for writers, help copy on home Ask. See roadmap **Your additions** post-launch pin.

## Roll back

- Restore nginx owner gate on `/lorekeeper/` and reload nginx.
- Turn **New sign-ups** OFF in Owner's Office if needed.
