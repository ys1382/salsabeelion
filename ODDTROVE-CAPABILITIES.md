# Odd Trove — what each site can do *right now*

Agents: read this **before** building. If the ask conflicts with a row here, say so plainly — do not keep retrying the same dead end.

Last updated: 2026-06-26

---

## Hard to fix right now (owner notes for Cursor)

**What this is:** Things you tried with Cursor that **did not work**, **kept failing**, or **are blocked** — so agents stop retrying the same dead end. Not the same as “not built yet” in site sections below; this is **agent/Cursor pain** you logged on purpose.

**Agents — recall:** When the owner asks **“what’s hard to fix?”** (or close wording), read **this section only**, summarize in plain English, and do not start building.

**Agents — store:** When the owner asks to **remember**, **log**, or **store** something as hard to fix with Cursor, append a dated bullet here (one line what, one line why if useful). Do not duplicate an existing bullet unless they ask to update it.

- **2026-06-26 — Maestro's Odyssey:** The door to the café keeps breaking (regresses or fails again after fixes).
- **2026-06-26 — Maestro's Odyssey:** The roof can’t fully change from being rectangular (shape stays boxy or reverts).
- **2026-06-26 — Maestro's Odyssey:** Door sounds only fire on **enter**, not on **exit** — and they aren’t real door noises; something plays on enter when it should, but exit is silent and the audio isn’t door-like.
- **2026-06-26 — Maestro's Odyssey:** Community board size — can’t get it right; asking Cursor to fix it made it **worse**.
- **2026-06-26 — Maestro's Odyssey:** Table collision — probably as good as Cursor can get **for now**; revisit later (not fully solved).
- **2026-06-26 — LoreKeeper:** Page bleed and extra fonts — can’t stop the bleed or add more font options yet with Cursor.
- **2026-06-26 — Maestro's Odyssey:** Environment layout — can’t seem to fix anymore: stepping stones don’t line up in front of the door, sidewalk isn’t extended enough, and a café sign keeps getting placed wrong again.
- **2026-06-26 — Maestro's Odyssey:** Hijabi character — seems impossible to fix with current knowledge and tools; **on hold:** man in kufi and thobe (wait to fix again).

---

## Where I'm at (owner focus snapshot)

**What this is:** What the owner is **interested in right now** — not todos, not "hard to fix."

**Agents — recall:** When the owner asks **where I'm at** (or close wording), read **`ODDTROVE-WHERE-IM-AT.local.md`** at repo root and summarize.

**Agents — store:** When they ask to save or update their "where I'm at" note, edit that file (newest dated block on top).

---

## Shared infrastructure

| What exists | What it means |
|-------------|----------------|
| Static HTML/CSS/JS sites | Most features must run in the browser or call public APIs. No Postgres, no always-on app server for Halalit/Maestro's/envDyst. |
| Deploy via SSH + rsync | Needs working SSH to `root@157.230.130.12`. LoreKeeper-only: `bash top/scripts/deploy-lorekeeper.sh`. Full sync: `bash top/scripts/deploy-kids-sites.sh`. See `ODDTROVE-OPS.md`. |
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

**Planning:** `envDyst/MCOC-ROADMAP-AND-TODO.md` (plot + phases; not deployed). **Live scope (owner):** **drift + story** = main spine; **keepsake/bingo** ships (environmental themes); **domestic filler** (chores, basket pack, etc.) cut.

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

**Deploy:** `bash top/scripts/deploy-lorekeeper.sh` for LoreKeeper-only (does **not** restart Halalit). Full fleet sync: `deploy-kids-sites.sh`. Nginx: `/lorekeeper/` and `/lorekeeper/api/` in `top/nginx/oddtrove.art.conf`.

---

### CleanScreen (`cleanscreen/www/` → owner-only `/cleanscreen/`)

**Is:** Halalit-audience **filtered web search** (owner beta)—text-first, strict open-web rules, hand-vetted site allowlist, anonymous rate-limited feedback.

**Can do now:**
- Search via Brave API (if `BRAVE_SEARCH_API_KEY` on server) or DuckDuckGo lite fallback
- **Kid mode (default)** vs **parent mode** toggle — parent unlocks hand-listed news, Amazon, bookstores, libraries in search results
- Filter results server-side (profanity, sexual, romance, LGBTQ on open web, fanfic/video/substance domains, etc.)
- Streaming (Max, Disney+, Netflix, YouTube except hand-vetted channels) blocked in **both** modes
- Private feedback log on server (`cleanscreen-data/feedback.jsonl`)

**Cannot do without new work:**
- Public access (nginx owner gate)
- Default browser search replacement
- Thumbnail or video preview vetting
- Claude summaries (not in v0)

**Deploy:** `bash top/scripts/deploy-cleanscreen.sh` — restarts 8081/8082 only. Nginx: `/cleanscreen/` and `/cleanscreen/api/` in `top/nginx/oddtrove.art.conf` (reload nginx after first ship).

---

### ForeWarner (`clickWarning/` — roadmap only, **not CleanScreen**)

**Is:** A **separate** planned product (working name **ForeWarner**) — warn before **watch / read** on Netflix, YouTube, news video, pages, etc. when content crosses owner lines (swearing, private-parts language at any age rating, LGBTQ, fanservice, hate/racism, crass sexual language, adult romance).

**CleanScreen relationship:** **Reference only** — same *kind* of content lines you want avoided, not the same codebase or API. CleanScreen stays **search**; click-warning is its own extension/backend when built.

**Not built yet:** Roadmap only — [`clickWarning/CLICK-WARNING-ROADMAP.md`](clickWarning/CLICK-WARNING-ROADMAP.md). Text/metadata first; captions later; cannot “watch the video” in early phases.

**Deploy:** None until owner approves build.

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
