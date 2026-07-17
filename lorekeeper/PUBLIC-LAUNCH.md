# LoreKeeper — public launch checklist (#25)

Repo side is ready (hub public card, quiet beta copy, nginx gate removed in `top/nginx/oddtrove.art.conf`). Live ship still needs deploy + nginx reload + New sign-ups ON.

## Before launch

- [ ] Phase 0 Tier A checklist complete (Owner's Office)
- [ ] Ask feels trustworthy on your usual scoped questions
- [ ] Off-server backups running (`lorekeeper/scripts/install-backup-cron.sh`)
- [ ] Account delete + export tested on a throwaway account (#31)
- [ ] Owner's Office → **New sign-ups** ON when ready

## Launch steps (you run / say deploy)

1. Deploy LoreKeeper: `bash top/scripts/deploy-lorekeeper.sh` from repo root (does not restart Halalit).
2. Deploy hub: `bash top/scripts/deploy-kids-sites.sh --site=hub` (public LoreKeeper card).
3. Copy `top/nginx/oddtrove.art.conf` to the VPS — `/lorekeeper/` must **not** use `auth_request /hub/api/owner-check` (or `auth_basic`). Leave `/lorekeeper/api/` alone.
4. On server: `nginx -t && systemctl reload nginx`
5. Verify https://oddtrove.art/lorekeeper/ loads **without** hub owner redirect.
6. LoreKeeper **user** sign-in still required — only the outer owner gate comes off.
7. Turn **New sign-ups** ON in Owner's Office so new Google accounts can join.

## After launch

- Monitor Owner's Office account count and private feedback only — never other writers' note text.
- Keep JSON export habit; optional email reminders ship when mail is configured (#23–24).
- **Loose-ends Layer 3 (optional)** — richer cross-note compare (skip `planned` lines in audits), in-app tag helpers for writers, help copy on home Ask. See roadmap **Your additions** post-launch pin.

## Roll back

- Restore `auth_request /hub/api/owner-check` (+ `error_page 401 = @owner_login_redirect`) on `/lorekeeper/` and reload nginx.
- Turn **New sign-ups** OFF in Owner's Office if needed.
