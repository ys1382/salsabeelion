# Odd Trove — what each site can do *right now*

Agents: read this **before** building. If the ask conflicts with a row here, say so plainly — do not keep retrying the same dead end.

Last updated: 2026-06-14

---

## Shared infrastructure

| What exists | What it means |
|-------------|----------------|
| Static HTML/CSS/JS sites | Most features must run in the browser or call public APIs. No Postgres, no always-on app server for Halalit/Maestro's/envDyst. |
| Deploy via SSH + rsync | Needs working SSH to `root@157.230.130.12`. Run `bash top/scripts/deploy-kids-sites.sh` from repo root. |
| Python static HTTPS on localhost | Backends bind **127.0.0.1** only; nginx on `oddtrove.art` proxies to them. |
| Nginx + basic auth | Maestro's, envDyst, and Climatic Mysteries are **owner-only** unless the owner explicitly asks to go public. |
| Owner session API | `top/_shared/hub_owner_api.py` — owner sign-in cookie for hub paths; not a general user database. |

**Deploy cannot run** if SSH is down, keys missing, or `halalit/www` is absent from this checkout (script leaves server copy as-is).

---

## Site-by-site

### Halalit (`halalit/www/` → https://oddtrove.art/halalit/)

**Is:** Family-friendly reading companion — Personal Library, Book Quest, Bookcheck, Open Library enrich, localStorage on the device.

**Can do now:**
- UI/copy/CSS/JS changes in `halalit/www/`
- Client-side shelves, import, series expand, Book Quest branches
- Block or allow titles via `halalit-family-shelf-policy.js` and `halalit-curated-shelf-warnings.js`
- Private owner lists in `halalit/.cursor/private/` (not deployed)

**Cannot do without new work:**
- Real user accounts or sync across devices (no Halalit auth backend today)
- Public comments, reviews, “what everyone is reading,” live chat
- Auto-recommending comics/manga/graphic novels not on **`VERIFIED_CLEAN`**
- Shipping My TBR or plot-vet staging to the live site unless the owner asks
- Generative shelf art that must match flat spine UI (Pollinations nook was **removed** — see `halalit/.cursor/demos/reader-nook-lofi/README.md`)

**Needs owner:**
- Hand-vet before a title joins recommendations
- Roadmap pins: `halalit/HALALIT-ROADMAP-AND-TODO.md` (when present in checkout)

**Checkout note:** Some clones omit `halalit/www/`. Do not assume files exist — check before editing.

---

### Crocheter (`crocheter/www/` → https://oddtrove.art/crocheter/)

**Is:** Pattern hub with **account sign-in** (gate on all pages except account).

**Can do now:**
- Static pattern pages, calculators, gallery assets
- Auth-gated UX via `crocheter-auth-gate.js` and `/api/auth/*` (nginx-routed)

**Cannot do without new work:**
- Anonymous public browsing (auth is intentional)
- Features that need a full backend stack beyond the existing auth API

---

### Maestro's Odyssey (`maestrosOdyssey/www/` → owner-only `/maestros/`)

**Is:** Language-adventure **prototype** — magical-realism city, Spanish civic vocab module live.

**Can do now:**
- Static scene copy, vocab JS files, styling
- Draft new vocab modules (owner review required before deploy — see `docs/LANGUAGE-VOCAB-WORKFLOW.md`)

**Not built yet (do not wire story as if live):**
- Train gate, wider world map, attunement flow
- Irish / Japanese / Arabic / Turkish regions and vocab wired into gameplay
- Full story spine: Dragon's Brew → plaza → train → world choice

**Hard content rules:** `docs/LOREBOOK.md`, `CONTRIBUTOR-GUIDELINES.txt` — lorebook wins over live `www/` when they conflict.

---

### envDyst (`envDyst/www/` → owner-only `/envdyst/`)

**Is:** Single-page **concept pitch** — perception/aliveness meter, not a full game.

**Planning:** `envDyst/MCOC-ROADMAP-AND-TODO.md` (plot + phases; not deployed). **Live game scope (owner):** chore minigames (Phase 3 dishes/laundry) documented in roadmap but **not** planned for live ship; other minigames may ship when built.

**Can do now:** Copy, styling, light client-side interaction on one page.

**Not built yet:** Map, quests, save system, multiplayer, backend.

---

### LoreKeeper (`lorekeeper/www/` → owner-only `/lorekeeper/`)

**Is:** Private notes for scatter-plotted writers — human-written entries (species, places, factions, etc.) saved per account. No AI-generated content.

**Can do now:**
- Sign-in required; notes on server per account (`lorekeeper/lorekeeper_api.py`)
- Entry list, edit, search, export/import JSON
- **Ask LoreKeeper** — recall and restate relationships from your own entries (local only; nothing sent to outside AI)
- Owner’s Office — account list, sign-up switch, private feedback (never other writers’ note text)
- Hub **Owner sites** link (visible only after hub owner sign-in)

**Cannot do without new work:**
- Public access (nginx owner gate still on)
- Owner reading another account’s entries (by design)

**Deploy:** `deploy-kids-sites.sh` + nginx `/lorekeeper/` and `/lorekeeper/api/` blocks in `top/nginx/oddtrove.art.conf`.

---

### Climatic Mysteries (`climaticMysteries/` → owner-only `/climatic-mysteries/`)

**Is:** Godot web export shell (`app.html`, `godot.html`, wasm/js) + HTML/JS narrative shell.

**Can do now:**
- Edit live `climaticMysteries/app.html`, assets, deploy via `climaticMysteries/scripts/deploy.sh`
- Stage overhauls under `climaticMysteries/overhaul/` — promote only via manifest + `climaticMysteries/scripts/complete-overhaul.sh` when owner asks

**Cannot do without new work:**
- Full Godot rebuild if `index.wasm` / `index.pck` are missing from checkout (deploy keeps server binaries)
- Shipping overhaul staging without explicit owner promote command

---

### Hub (`top/directory/www/`)

**Is:** Link hub on oddtrove.art root (Halalit + Crocheter public entry).

**Not served** as a full directory listing on production nginx except root redirect behavior — see `oddtrove-owner-only-sites` rule.

---

## Cross-site product rules (feasibility, not optional)

- **Warmth without social:** no public posting surfaces (comments, forums, shared walls, live chat) unless the owner clearly asks in that conversation.
- **Production edits:** smallest change; no fake features; if the ask cannot be met, say so — do not imply it shipped.
- **Ask before deleting** significant content or features.

---

## Feasibility verdict labels

Before coding, reply with one of:

| Verdict | Meaning |
|---------|---------|
| **Feasible now** | Fits this doc; proceed with a small plan. |
| **Feasible with tradeoffs** | Possible but weaker, slower, or uglier — name the tradeoff. |
| **Not yet** | Right idea, missing prerequisite (e.g. train gate, hand-vet, backend). |
| **Not feasible** | Conflicts with architecture or owner rules; suggest an alternative or pin for roadmap. |
| **Needs you** | Requires owner decision, credential, vet, or explicit approval. |

If the same approach fails **twice**, stop retrying and report which verdict applies and why.
