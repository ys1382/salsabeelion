# Odd Trove — what each site can do *right now*

Agents: read this **before** building. If the ask conflicts with a row here, say so plainly — do not keep retrying the same dead end.

Last updated: 2026-07-17

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
- **2026-08-09 — LoreKeeper:** Document **page split** (real stacked pages / Google Docs–style overflow) — tall growing page is OK for now; multi-page split kept failing (cutoff, top-of-chapter clip, scroll/caret). Rolled back. **Needs more work than Cursor solo**; don’t retry the same page-box/paginate loop without a new agreed approach.
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
| Nginx + basic auth / hub cookie | Maestro's, envDyst, Climatic Mysteries (and other owner betas) are **owner-only** unless the owner explicitly asks to go public. LoreKeeper is **public** (account gate). |
| Owner + reader SSO API | `top/_shared/hub_owner_api.py` — owner htpasswd cookie for private paths; **Google SSO** (`oddtrove_session`) for Halalit / Crocheter / LoreKeeper via `/hub/api/auth/google/*`. **Owner Google email** (`ODDTROVE_OWNER_EMAIL`, default `nightofhonour@gmail.com`) also unlocks private nginx paths. Shared env: `~/kids-sites/oddtrove-server/.env`. Site data stores stay separate (keyed by email). |

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
- Bookstore inventory (`halalit/bookstore_inventory/`) — SQLite + adapters + Wishlist UI. **Live ISBN shelf checks enabled** for yes-tier Indies (Kepler’s, Green Apple, Book Passage, Booksmith, Copperfield’s) and partly-tier online ordering (B&N Stevens Creek, Kinokuniya SF). No purchase checkout. Full `/search`/`/books/` crawl still robots-blocked; Cloudflare may block some shops.

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

**Planning:** `envDyst/MCOC-ROADMAP-AND-TODO.md` (current; not deployed). **Archived detail:** `envDyst/MCOC-ARCHIVED-PLANS.md` (jobs, multi-day retreats, bingo/keepsake — parked, not deleted). **Archive rule:** owner discards → archive file; **never delete** discarded MCOC ideas. **Live scope (owner):** brief enclosed prologue → short nature reveal → return soft-horror **alarm** (background → foreground); picture-first; determination after alarm; **no** job campaign / multi-day vacation / animal bingo. Domestic filler stays cut.

**Can do now:** Copy, styling, light client-side interaction on one page.

**Not built yet:** Map, quests, save system, multiplayer, backend.

---

### LoreKeeper (`lorekeeper/www/` → public `/lorekeeper/` — beta)

**Is:** Private notes for scatter-plotted writers — human-written entries (species, places, factions, etc.) saved per account. No AI-generated content. Public on Odd Trove with a quiet beta mark; LoreKeeper account sign-in still required.

**Can do now:**
- Sign-in required; notes on server per account (`lorekeeper/lorekeeper_api.py`)
- New accounts: email/password for now (junk email OK); Google when OAuth keys are on the VPS
- Entry list, edit, search, export/import JSON
- **Ask LoreKeeper** — recall and restate relationships from your own entries (local only; nothing sent to outside AI)
- Owner’s Office — account list, sign-up switch, private feedback (never other writers’ note text)
- Hub public link (same list as Halalit / Crocheter)

**Cannot do without new work:**
- Owner reading another account’s entries (by design)

**Deploy:** Treat as **public** (ask before deploy). LoreKeeper-only: `bash top/scripts/deploy-lorekeeper.sh` (does **not** restart Halalit). Hub link: `deploy-kids-sites.sh --site=hub`. Nginx: `/lorekeeper/` and `/lorekeeper/api/` in `top/nginx/oddtrove.art.conf` (reload nginx separately after gate changes).

---

### HalalFlicks (`halalflicks/www/` → owner-only `/halalflicks/`)

**Is:** Movie red-flag screener (**Flickcheck**) plus owner-curated movie recommendations and a device shelf. Between HalaLit and HalaLyrics, for films — **not** a streaming player. Working title may change. **Owner-only** until you say otherwise. Separate from ForeWarner (click-warn extension, not built yet).

**Can do now:**
- Flickcheck via optional pasted synopsis + Wikipedia plot fallback + Gemini theme scan; hand-vetted overrides win
- Same content lines as Halalit / HalaLyrics (modesty, no LGBTQ, non-married romance, etc.)
- Wikipedia posters when not flagged for fanservice / adult-sexual (hand `poster_ok` can override)
- My shelf in localStorage
- **Recommend** — theme search over owner `config/rec_catalog.json` only; link-out search; prefs on device for ranking
- Deploy: `bash top/scripts/deploy-halalflicks.sh` (ports 8088/8089; nginx owner gate)

**Cannot do without new work:**
- Public access (nginx owner gate on until you ask)
- Accounts / shelf sync
- In-app playback or streaming filters
- Auto-growing the rec catalog (owner hand-adds only)
- OMDb/TMDB metadata keys (not needed — Wikipedia posters/plot)

**Needs owner:** Hand-vet list growth; rec catalog titles; rename if desired.

**Owner vet batches:** Before offering titles, always read `halalflicks/config/vet_shown.json` and `halalflicks/config/parked.json` — never re-offer shown/parked titles across chats. Rule: `.cursor/rules/halalflicks-vet-no-repeat.mdc`. After showing a batch or logging decisions, **commit the vet config JSON same turn** via `bash halalflicks/scripts/commit-vet-config.sh` (standing owner OK for that path only).

---

### HalaLyrics (`halalyrics/www/` → public `/halalyrics/`)

**Is:** Lyrics red-flag screener (Songcheck) plus owner-curated song recommendations. Separate from HalaLit. Shelf and prefs are device-local. Quiet **beta** on hub and site — helper, not a guarantee; listeners should still preview.

**Can do now:**
- Songcheck via LRCLIB + Gemini scan; hand-vetted overrides win
- Flagged songs stay flags-only; OK / leaning OK can expand lyrics
- My shelf in localStorage
- **Recommend** — theme search over owner `config/rec_catalog.json` only; link-out search; stated prefs on device for ranking
- Recommend excludes songs from culturally inaccurate, racist, or sexist sources (e.g. Aladdin) — catalog curation rule, not an auto-filter

**Cannot do without new work:**
- Rate limits on the API
- Accounts / shelf sync
- Streaming-app filters or in-app playback
- Open-web or AI-invented recommendation titles (catalog only)
- Auto-detecting every culturally inaccurate / harmful franchise (owner judgment when growing the catalog)

**Deploy:** `bash top/scripts/deploy-halalyrics.sh` — restarts 8083/8084 and reloads nginx by default (also syncs hub `index.html`). Hub-only: `deploy-kids-sites.sh --site=hub`. Treat as **public** (ask before deploy).

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

### Bane of Extinction (`baneOfExtinction/` → public quiet beta `/bane-of-extinction/`)

**Is:** Wildlife-learning game (real organisms; Pokémon Go–style motivation planned for a later Wildlife Walk rebuild). **Public quiet beta** on Odd Trove — **Odd Trove Google sign-in required** (app gate). Roadmap: [`baneOfExtinction/BANE-OF-EXTINCTION-ROADMAP-AND-TODO.md`](baneOfExtinction/BANE-OF-EXTINCTION-ROADMAP-AND-TODO.md).

**Can do now:**
- Browse **wildlife codex** on desktop or phone after Google sign-in — Claude callouts; demos use CC0 cutouts
- **Learned shelf** — past scans sync to **Odd Trove Google sign-in** (server store + device cache; **one entry per species + life stage**; stylized still + ID; never raw camera)
- **Shared stage still library** — first successful generate for a species/cultivar + life stage is saved server-side; later scans reuse that picture (no new Gemini image)
- **Gemini-first ID** — Claude vision only when confidence isn’t high, shelf lookalike risk, or Gemini fails; camera always runs Gemini
- **Focus mode picker** — Walk / wild, Garden, **Hiking**, **Seashore**, **Crops & Domestic Animals** (internal key `food`), **Objects / built world** (internal key `objects`). Hiking / Seashore = engaged trail-walker / beachgoer stances (people–place relationship lean; not GPS; other modes may still mention relationship). Crops mode lanes: Claude OK for domestication/crop timelines, light everyday kindness (reuse bottles / durable goods), + not-your-fault company/system pollution; **banned** from human-injustice history and from inventing deeper environmental practices (regen ag is one example) until owner notes. Objects mode: built-world noticing; hope/agency ≥ half of each set; **banned** until owner hand-vet: named brands, specific green building / place-of-worship examples, environmental justice stories. Separate fact pools per mode. Pigs = husbandry/ancestry only (never encourage eating; health claims later).
- **Fact pools** — different callouts each Load from a local pool; Claude refills when the pool runs low (NatureServe CC BY + USGS US-RIIS CC0 credited for range/status)
- **Fact book** — callout facts collected into an account-synced book (Splash Aquapedia–style progress). Soft `n / ~x` totals until curated packs. **Fact levels** (Curious notice → Neighbor kindness → Species wonder → Field learner) are **separate from mission levels**; kinds unlock with learning commitment (notice → help → wonder)
- **Phone wildlife camera scan** — `/bane-of-extinction/wildlife-scan.html` (EcoLens: Gemini + Claude ID + life stage; **living neighbors, natural nonliving** — rocks, minerals, empty shells, fossils — **and everyday outdoor manufactured categories** — plastic bottles/bags/packaging, asphalt, pavement, concrete, glass bottles, metal cans, curbs — category names only, never brands; still refuse cars/vehicles, phones, indoor furniture; confirm **This looks right** / **Not this** / **Google this**; photo held in memory only until confirm, dry guesses, leave, or idle wipe; then Gemini semi-realistic still; facts follow the confirmed find — **geology-style** for rocks/minerals/empty shells; **Objects-lane** for manufactured categories (hope/agency lean); **while-you-wait** rotating generic eco wisdom — justice / small daily help / systems+agency — not species trivia)
- Claude facts via `/bane-of-extinction/api/` (shared `anthropic.key` + Halalit Gemini env on server) — player-world tone, one small-help tip per set, one wonder fact; geology lane for natural nonliving; **garden focus** toggle splits garden-world eco facts (seed dispersal, grower kindness) vs walk/wild eco facts; device remembers recent fact text so rescans can stay fresh (no photo retention); **later Loads** deepen exactly one prior fact, rotating which prior set the hook comes from
- **Looking-at places** — Halalit-style favorite places on device; facts + browse lists follow chosen region/habitat (optional compare); season from date; **no GPS**
- Codex still caption: **conservation status** when possible + **native range** + **elsewhere** (USGS **US-RIIS** CC0 for U.S. introduced/invasive when latin matches; else NatureServe exotic + soft caution; no compare place required; no IUCN)
- **Neighborhood missions** — `/bane-of-extinction/missions.html`
  - **Level 1** = scans (codex faces)
  - **Level 2** after ~15 finds — signature-sign quests; ant mound with/without + cutaway
  - **Level 3** after a handful of Level 2 missions (**5**) — same organism healthy/meh/warning by place + under-the-hood landscape stories (not tourist postcard facts)
- **Owner’s Office** — `/bane-of-extinction/office.html` (owner email): player accounts (email + joined), private feedback, **new sign-ups** on/off. Never other players’ learns / scan photos / fact text.
- **Owner-only logic grid** — `/bane-of-extinction/grid-example.html`. Own **Logic grid** tab for `isOwner` only (not in Owner’s Office, not in public nav). Classic L-shaped board: every pair of sides intersects (so “mountain animal hunts blue sheep” marks mountains × blue sheep). Click X / lock match; strike clues to the bottom.
- Deploy: `bash top/scripts/deploy-bane-of-extinction.sh` (ports **8085** static + **8086** API; reloads nginx by default)

**Cannot do without new work:**
- Permanent curated art library beyond per-account learned stills
- **Wildlife Walk** (on-screen trail + buddy / notice prompts) — **off live 2026-08-10**; rebuild from roadmap **Your additions → 2026-07-24** only when owner asks
- Full visual packs for non-ant missions (story cards only until art catches up)
- Perfect organism-only segmentation (best-effort framing coach for now)
- Full video / Live Photo of the raw camera frame (out of scope; subtle idle on the generated still only)
- PoGo-quality 3D / skeletal buddy animation — web CSS/JS can do simple idle, slide-walk, state swaps from stills/sprites; not rich game-engine locomotion

**Parked / not building:** Trail Guide (Akinator yes/no ID) — EcoLens is the ID path (roadmap 2026-07-23). **Wildlife Walk** — removed from live; design parked on roadmap (not deleted from planning).

**Not:** Climatic Mysteries. Path **`/bane/`** still redirects to Climatic Mysteries — do not reuse it.

---

### Habit Tree (`habitTree/www/` → owner-only `/habit-tree/`)

**Is:** Private habit companion stub (Odd Trove owner beta). Working name Habit Tree. Not public.

**Can do now:**
- Pick a companion (orchid mantis, peacock, reindeer, stag / deer variants)
- Care advances hatch (egg → grown) or grow (young → adult) as **still flipbook frames** (no looping creature motion); about **10** taps per stage
- After adult size, **creature elegance keeps growing** (richer plumage / antlers on SVG companions; orchid mantis uses painted stills **0–15** in a sparse additive ladder — forward only, holds peak until more frames are added)
- **Orchid mantis** painted PNGs in `art/orchid-mantis/` (egg case → full bloom → poised…timeless); painting fills the scene panel; other companions still use SVG stills for now
- Quiet scene backdrop; progress in browser localStorage on this device
- Deploy: `bash top/scripts/deploy-habit-tree.sh` (port **8087**; reloads nginx by default)

**Not built yet:** Full habit menu design, accounts/sync, real art assets, story, co-op.

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

**Is:** Link hub on oddtrove.art root (Halalit + Crocheter + LoreKeeper + HalaLyrics public entry).

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
