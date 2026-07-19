# Odd Trove — operations (deploy, ports, errors)

Quick reference when a site shows 502/500 or you need to ship one project without touching the others.

Last updated: 2026-06-24

---

## Which deploy script to run

From **repo root**:

| What you changed | Command | Restarts |
|------------------|---------|----------|
| **LoreKeeper only** (`lorekeeper/`) | `bash top/scripts/deploy-lorekeeper.sh` | LoreKeeper static (8079) + API (8080) only |
| **CleanScreen only** (`cleanscreen/`) | `bash top/scripts/deploy-cleanscreen.sh` | CleanScreen static (8081) + API (8082) only |
| **Bane of Extinction only** (`baneOfExtinction/`) | `bash top/scripts/deploy-bane-of-extinction.sh` | Bane static (8085) + API (8086) + hub index; reloads nginx by default |
| **LoreKeeper code/API only** | `bash top/scripts/deploy-lorekeeper.sh --lk-code-only` | Same; skips `fonts/` rsync |
| **Halalit** (`halalit/www/`) | `bash top/scripts/deploy-kids-sites.sh --site=halalit` | Halalit static (8074) + Bookcheck API (8075) |
| **Maestro's** | `bash top/scripts/deploy-kids-sites.sh --site=maestros` | Maestro's (8071) only |
| **envDyst** | `bash top/scripts/deploy-kids-sites.sh --site=envdyst` | envDyst (8072) only |
| **Crocheter** | `bash top/scripts/deploy-kids-sites.sh --site=crocheter` | Crocheter (8073) only |
| **Hub** | `bash top/scripts/deploy-kids-sites.sh --site=hub` | Hub (8070) + hub owner API (8077) |
| **Several kids sites / full sync** | `bash top/scripts/deploy-kids-sites.sh` | All kids backends (rolling, one port at a time) |
| **Climatic Mysteries** | `bash climaticMysteries/scripts/deploy.sh` | CM only (8060, separate server dir) |

**Rule of thumb:** LoreKeeper edits → `deploy-lorekeeper.sh`. That keeps Halalit and the hub up.

Nginx config (`top/nginx/oddtrove.art.conf`) is **not** applied by deploy scripts. After nginx edits: copy to server, `nginx -t`, reload.

---

## Port map (production)

| URL | Backend port | Notes |
|-----|--------------|-------|
| `https://oddtrove.art/` | 8070 | Hub |
| `/halalit/` | 8074 | Public |
| `/halalit/api/` | 8075 | Bookcheck + accounts |
| `/crocheter/` | 8073 | Public (app sign-in gate in JS) |
| `/crocheter/api/` | 8076 | Crocheter auth (not started by deploy script — must already run on VPS) |
| `/maestros/` | 8071 | Owner hub cookie |
| `/envdyst/` | 8072 | Owner hub cookie |
| `/lorekeeper/` | 8079 | Public (LoreKeeper account sign-in in JS) |
| `/lorekeeper/api/` | 8080 | LoreKeeper API |
| `/halalyrics/` | 8083 | Public (Songcheck screener) |
| `/halalyrics/api/` | 8084 | HalaLyrics Songcheck API |
| `/cleanscreen/` | 8081 | Owner hub cookie |
| `/cleanscreen/api/` | 8082 | CleanScreen search API |
| `/bane-of-extinction/` | 8085 | Owner hub cookie; wildlife walk / codex beta |
| `/bane-of-extinction/api/` | 8086 | Claude callout facts (uses shared `anthropic.key`) |
| `/hub/api/` | 8077 | Hub owner sign-in |
| `/climatic-mysteries/` | 8060 | Owner hub cookie; separate deploy |

All backends bind **127.0.0.1** except optional RPG (8078). Nginx terminates TLS on `oddtrove.art`.

---

## Error codes

| Code | Usually means |
|------|----------------|
| **502** | Nginx is up but nothing is listening on that backend port — common during deploy or if a Python process crashed |
| **500** | Backend is running but failed on that request — common on LoreKeeper Ask/save if API or RAG misconfigured |
| **401 → redirect to `/?owner=1`** | Owner gate — sign in on the hub first (not a crash) |

After deploy: wait ~30 seconds and hard-refresh. Halalit shelves on device are **not** wiped by a restart.

---

## LoreKeeper deploy safety

`deploy-lorekeeper.sh`:

1. Optionally runs `pytest lorekeeper/tests/` if pytest is installed locally
2. Rsyncs `lorekeeper/www/` and `lorekeeper_*.py` only
3. **Import smoke test** on the server before killing the old API — if import fails, old API stays running
4. Restarts 8079 and 8080 only

If Ask returns 500 after deploy, check Anthropic key on server (`~/kids-sites/anthropic.key`). Temporary escape: set `LOREKEEPER_RAG=0` in the API environment on the VPS.

Export JSON from LoreKeeper home before risky deploys. Server backups: `lorekeeper/STORAGE-BACKUP.md`.

---

## SSH health checks (on the VPS)

```bash
curl -sk -o /dev/null -w "%{http_code}\n" https://127.0.0.1:8074/    # Halalit static
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/api/auth/me  # LoreKeeper API
tail -30 /tmp/lorekeeper-api.log
tail -30 /tmp/kids-site-8074.log
```

`ImportError` or `SyntaxError` in `lorekeeper-api.log` → fix code and redeploy with `deploy-lorekeeper.sh`.

---

## Password reset email (Halalit, Crocheter, LoreKeeper)

**Legacy password accounts only.** Forgot password still exists for people who signed up with email + password before Google login. New accounts use Google (no password reset mail needed).

Uses shared helpers in `top/_shared/oddtrove_transactional_mail.py` (rsynced to `~/kids-sites/_shared/` on deploy).

**Recommended:** Gmail SMTP with a [Google App Password](https://myaccount.google.com/apppasswords) for `nightofhonour@gmail.com`. Add to **`~/kids-sites/halalit-server/.env`** on the VPS (same vars are read by all three APIs via their process env — copy into crocheter/lorekeeper startup if you split env files later):

```bash
ODDTROVE_MAIL_MODE=smtp
ODDTROVE_MAIL_FROM=nightofhonour@gmail.com
ODDTROVE_SMTP_HOST=smtp.gmail.com
ODDTROVE_SMTP_PORT=587
ODDTROVE_SMTP_USER=nightofhonour@gmail.com
ODDTROVE_SMTP_PASS=<app-password>
```

**Test send** (on VPS after `.env` is set):

```bash
bash top/scripts/test-oddtrove-mail.sh nightofhonour@gmail.com
```

Until mail is configured, the reset UI still works but **no email is delivered** (the API always returns a neutral success message for unknown emails).

**Not covered:** nginx owner login (`SmokyInk11`) — rotate with `ODDTROVE_ROTATE_AUTH=1 bash top/scripts/setup-oddtrove-owner-auth.sh`.

---

## Google login (new accounts — Halalit, Crocheter, LoreKeeper)

New accounts use **Continue with Google**. Existing email/password accounts still sign in under “Already have an email & password account?”

1. In [Google Cloud Console](https://console.cloud.google.com/) create (or reuse) a project → **APIs & Services → Credentials → Create OAuth client ID → Web application**.
2. Authorized redirect URIs (all three):
   - `https://oddtrove.art/halalit/api/auth/google/callback`
   - `https://oddtrove.art/crocheter/api/auth/google/callback`
   - `https://oddtrove.art/lorekeeper/api/auth/google/callback`
3. OAuth consent screen: External; publish when ready for real readers (Testing mode only allows listed test users).
4. Put on the VPS in **`~/kids-sites/halalit-server/.env`** (Halalit `start-api.sh` sources this; deploy scripts pass the same vars to Crocheter and LoreKeeper):

```bash
ODDTROVE_GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
ODDTROVE_GOOGLE_CLIENT_SECRET=<client-secret>
```

5. Redeploy: `bash top/scripts/deploy-kids-sites.sh` (or site filters) so APIs restart and pick up the env.

Shared code: `top/_shared/oddtrove_google_oauth.py`.

---

## Cursor / agent habits

- LoreKeeper-only work: agents should use **`deploy-lorekeeper.sh`**, not the full kids script
- Say **local only** to skip deploy for that chat
- Batch LoreKeeper deploys when you can
- Verdict-first: `CURSOR-TASK-TEMPLATE.md` Phase 1 before big changes

See also: `ODDTROVE-CAPABILITIES.md`, `.cursor/rules/owner-only-auto-deploy.mdc`, `.cursor/rules/warn-before-live-user-impact.mdc`.

---

## Keep deploys and pages fast

### Deploy habits

1. **LoreKeeper-only** → `bash top/scripts/deploy-lorekeeper.sh` (not the full kids script).
2. **Python/API-only LoreKeeper change** → `bash top/scripts/deploy-lorekeeper.sh --lk-code-only` (skips `fonts/` rsync — much faster).
3. **Batch LoreKeeper deploys** — ship once after several edits, not every small tweak.
4. **Say “local only”** in Cursor to skip auto-deploy for that chat.
5. **Never set `LOREKEEPER_FETCH_FONTS=1`** unless you intentionally re-download all fonts (very slow).
6. **Keep Quill + fonts vendored in git** — deploy should not fetch from the internet.
7. **Single-site deploys** — `--site=halalit`, `--site=maestros`, etc. on `deploy-kids-sites.sh`.
8. **Stable network for SSH** — VPN drops and weak Wi‑Fi can make deploy hang for many minutes.

### Browser habits

9. **Hard-refresh once after deploy** if a page looks stuck (often a short 502 blip).
10. **Open LoreKeeper home first** — `index.html` is light; `doc.html` loads the editor stack.
11. **LoreKeeper is public** — no hub owner sign-in needed for `/lorekeeper/`; unsigned visitors land on the LoreKeeper account page.

### Slow SSH troubleshooting

If deploy sits on “Syncing…” for more than ~2 minutes:

```bash
ssh -o ConnectTimeout=30 root@157.230.130.12 "echo ok"
```

- **Times out** — check VPN, Wi‑Fi, or whether the VPS is up in your hosting panel.
- **Works but slow** — normal on some networks; use wired connection if you can.
- **Fails with permission denied** — SSH key not loaded; fix keys before retrying deploy.

Deploy scripts use `ConnectTimeout=30` and keepalive so a dead connection fails instead of hanging ~20 minutes.

### LoreKeeper doc editor weight

The doc editor lazy-loads hosted fonts (only the font you use + picker choices), loads Quill/spellcheck after the page shell paints, and static assets get browser cache headers after first visit.

