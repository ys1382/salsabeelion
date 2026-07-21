# Bane of Extinction — roadmap & todo

**Working title:** Bane of Extinction (for now).  
**Status:** Owner-only beta shell on Odd Trove (live stub). Walk / camera / Trail Guide not built yet.  
**Live URL:** https://oddtrove.art/bane-of-extinction/ (hub owner cookie — same gate as Maestro’s / CleanScreen)  
**Related Cursor plan:** `.cursor/plans/wildlife_walk_game_17209669.plan.md` (keep in sync when possible).

**What it is:** A family-friendly, conservation-minded walk game with Pokémon Go–style motivation (walk, buddy, streaks, collection) aimed at **real wildlife** — without bothering animals. Players **learn** organisms into a **wildlife codex** — never “catch” them.

**North star:** Learn the living neighborhood without bothering it.

---

## Hosting (locked 2026-07-18)

| Item | Decision |
|------|----------|
| Visibility | **Owner-only beta** on Odd Trove (not public) |
| Path | **`/bane-of-extinction/`** (port **8085**) |
| Do not use | **`/bane/`** — still Climatic Mysteries redirect |
| Desktop | **Wildlife codex** browse OK |
| Camera / scan | **Phone or tablet only** when built (Halalit scanner–style handheld gate). Desktop shows copy to open on phone. |
| Deploy | `bash top/scripts/deploy-bane-of-extinction.sh` |

---

## Product rules (locked)

### Non-invasive / ethics

- No chasing wildlife, nest pins, lures at sensitive sites, flash prompts, or radar-style animal hunts.
- Collection language: **“learned”** / codex entry — never “caught.”
- Quiet-walk mode encouraged.
- Stops (if any) = QR at **human** places (signs, gardens), not animal spots.

### Privacy (Halalit-style camera)

- Camera is **optional** (see ID paths).
- Scan identifies the **organism only**. If it is perched on a hand (or shoe, face, etc.), do **not** keep or treat the person/body part as part of the find — crop/mask to organism.
- After recording the wildlife (species → codex), **delete the raw photo** (and usually the crop). Do not store personal or unrelated image data.
- Result / codex art is **never** the player’s raw camera frame.

### Location (no GPS)

- **No GPS**, no map pins on wildlife, no step tracker required.
- Optional **region + habitat** at walk start (e.g. SoCal beach vs NorCal beach) to shrink the species pool.
- If place is **skipped**, Trail Guide still works — a few extra place-like questions first, hard-capped so it does not drag.
- Season can come from the date.

### Place lens stack (locked 2026-07-21 — personalized facts, no tracking)

All of these ship together as one stack. BoE never claims “you are here” — only **“facts for the place you’re looking at.”**

1. **Chosen lens** — player picks a region/habitat (or skips).
2. **Favorite places (Halalit-style)** — checkboxes on this device, like favorite libraries; **Looking at** defaults to first favorite / last choice.
3. **Compare two places** — optional second place for contrast (native here / invasive there).
4. **Fact variants** — Claude callouts + localStatus / compareNote personalized to the lens.
5. **Habitat-only** — coarser places (garden / beach / forest / city) when they skip named region.
6. **Season + place** — device date season + chosen place.
7. **Browse-by-area species list** — native + invasive (and planted/houseplant) for the chosen place.

Privacy copy: for all the game knows, they’re reading about somewhere they know — not where they stand.

### Size as a first-class ID clue

- When species differ mainly by size (e.g. **raven bigger than crow**), the game must use size — do not flatten them into one “black bird.”
- Trail Guide: early size questions (“bigger than a crow?” / “about crow-sized?”).
- Camera path: size is harder without scale — use proportions + one follow-up size question when crow vs raven (or similar) is ambiguous.
- Result copy may say “likely raven — larger” / “likely crow — smaller” when unsure.

---

## Core loop

1. **Start walk** — timer; optional quiet/curious mood.
2. **Set place (optional)** — region + habitat; or skip.
3. **Walk prompts** — listen, look up, notice habitat clues.
4. **Identify** — Trail Guide and/or optional Seek-style camera (below).
5. **Codex reveal + buddy/streak** — stylized still on blueprint-style page; rewards from walk time and IDs.

---

## Two ways to identify

### A. Trail Guide (primary — Akinator-style)

Yes/no or either/or questions until a species (or short shortlist):

- Habitat / place cues when needed.
- Size cues when they matter (crow vs raven, etc.).
- Features: webbed feet, colors, posture, etc.

**Speeds:**

| Place | Rough question count |
|-------|----------------------|
| Region + habitat set | ~3–4 |
| Place skipped | ~5–6 max (hard cap), then top match or 2–3 guesses + “maybe” |

**Confirm:** “Is this your [bird / mammal / fungus / …]?” with common + Latin name. Yes / close (next guess) / not sure (“maybe”).

### B. Camera (Seek-like — optional)

Inspired by **iNaturalist Seek**, with Halalit photo privacy:

1. Player photographs the organism.
2. App isolates **organism only** (not hand/person/background clutter meant as PII).
3. ID runs on that crop (plus optional region/habitat pool).
4. Photo deleted after wildlife is recorded.
5. Player gets a **natural field-guide still** of the organism (generated from the crop + ID — not a Live Photo / moving raw video). Matches color and form of *this* scan (e.g. red sunflower stays red). Subtle idle (bob/sway) on the still is OK; full “animate the photo into video” stays out of scope.

**v1 note:** Trail Guide can ship first; camera + stylize may be v2 if needed — but privacy + codex rules above stay locked either way.

---

## Wildlife codex (field guide)

PoGo “new Pokédex entry” energy, for real organisms:

- After a confirmed ID, reveal the stylized still on a **blueprint / codex page** background.
- Under the art: **common name** + **Latin (scientific) name**.
- Quiet caption under the still (same photo frame): **native range** (region / NorCal–SoCal level) + **conservation status**.
- Status/range: **NatureServe Explorer** when the scientific name matches (CC BY; attribution in disclaimer). No IUCN site/API. Claude may refine CA to NorCal/SoCal; curated fallbacks for demos / misses. Not Wikipedia-as-sole-source.
- That page is the permanent **wildlife codex** entry for that organism type.
- Subtle still-image idle animation OK; not a live moving photo of the real animal.
- Curated royalty-free reference art may fill entries when camera stylize is not used (Trail Guide–only path).

### Callout labels (locked direction 2026-07-18)

After the still “freezes” on the codex card:

- Show a **reasonable list of callout text boxes** to the right of the organism (leader-line feel).
- Each callout points at a **visible part or clue** (beak, belly, petals, track shape, etc.) with a short fact.
- Examples: toucan beak color/size role; belly → fruit diet; poppy petals / cream center / drought habit.
- Not an internal anatomy scan — educational facts about the organism (or **evidence** of it: tracks, nest, seed pod, chewed plant, bloom patch).
- **Claude API** builds / helps the facts base when the player encounters the organism or evidence (server key; never in public `www/`).
- **No Wikipedia-as-sole-source** and no open-web scrape for callout facts — Claude helper knowledge + curated packs. Status/range may use **NatureServe Explorer** (CC BY) by scientific name; never IUCN site/API.
- Tone: useful learning helper, not a guaranteed field guide.
- **Player-world facts (2026-07-20):** most callouts tie the organism to everyday life (walks, yards, shared air/food webs, what you’d notice) — not a textbook dump. **Exactly one** fact per set can be a cooler species-own wonder with less direct human impact. Goal: feel more understanding of wildlife around you, not become a field-guide expert.
- **Small-help tip + fresh rescans (2026-07-21):** among the everyday facts, **exactly one** is a gentle, species-specific “what you can do for this organism’s world” tip (no guilt; don’t blame staple foods or systems people don’t control). Device remembers recent fact text per species (not photos) so Load / rescan can ask Claude for a fresh set.
- Desktop can browse callouts once an entry exists; phone not required for browsing.

### First stubs — California poppies + common sunflower + sweetheart philodendron

- Live demo lives on the **main wildlife codex**: `/bane-of-extinction/codex.html` (also from hub → Bane → Open wildlife codex)
- `/bane-of-extinction/poppy.html` redirects to the codex (old bookmarks still work)
- Species: **California poppy** (*Eschscholzia californica*) — works for California poppies **generally**
- Species: **common sunflower** (*Helianthus annuus*) — camera + callouts prefer species when clear; cultivar names only if obvious
- Species: **sweetheart philodendron** (*Philodendron hederaceum*) — heartleaf / sweetheart plant; cultivar names only if obvious
- Optional cultivar preference: **Watermelon Heaven** (pink petals, creamy center) when the toggle is on (poppy)
- Claude callouts via `/bane-of-extinction/api/callouts` (port **8086**)
- Fallback curated facts for poppy, sunflower, and philodendron if Claude is down
- Codex still switches between poppy / sunflower / philodendron subject cutouts from the ID

---

## PoGo feel, safely

- **Buddy** — illustrated; grows with walk minutes.
- **Stops** — QR at signs/gardens only.
- **Collection** — codex by habitat / region packs.
- **Seasons** — new pools and conservation stories.

---

## Borrow from existing Odd Trove work

- **envDyst** — habitat-matched species, observe from distance, illustrated finds (reference only — this is not MCOC).
- **Halalit Scroll Scanner / camera option** — tap-to-scan, minimal retention, no personal photo storage pattern.

---

## Active tasks

- [x] Owner-only beta shell on Odd Trove (`/bane-of-extinction/`, hub link, nginx + deploy script)
- [x] Wildlife codex stub page (desktop + phone browse)
- [x] Handheld gate messaging (camera later; desktop = codex)
- [x] Codex callout panel direction (Claude facts; organism + evidence; no Wikipedia)
- [x] California poppy stub (`poppy.html` + Claude `/api/callouts`; Watermelon Heaven optional)
- [ ] Core loop: walk → optional place → ID → codex → buddy/streak
- [ ] Trail Guide engine (fast path + skip-place path with hard cap)
- [ ] Size-first disambiguation (crow vs raven as test case)
- [ ] Ethics / non-invasive onboarding copy
- [ ] First regional content pack (species, questions, reference art + common + Latin)
- [x] Wildlife codex UI — blueprint reveal + permanent entries (device-local learned shelf; real IDs beyond demos)
- [x] Seek-style camera path — organism-only crop, delete photo, Halalit privacy (phone only)
- [x] Codex still uses royalty-free photo + visible idle animation (CC0 California poppy)
- [x] ID accuracy rule: facts match the **guessed** organism (e.g. golden poppy facts if that’s the ID)
- [x] Scan → matching field-guide still (Gemini image; color/form follow ID; no generic stub swap)
- [x] Codex still: semi-realistic **new** portrait (not raw photo); same species + **life stage** as the scan
- [x] Device-local learned collection (PoGo-style shelf on codex; one entry per species)
- [x] Learned shelf syncs to Odd Trove **Google sign-in** (server + device cache; cross-device)
- [x] Codex still caption: native range + NatureServe status (no IUCN scrape)
- [x] Place lens stack on codex (favorites like Halalit libraries; looking-at + compare; browse-by-area; season; no GPS)
- [x] Callouts API accepts place lens (localStatus / compareNote; place-aware help tips)
- [ ] Per-species permanent art library / cloud cache (optional later)
- [ ] Leader-lines from callouts to exact body-part anchors on stylized art
- [ ] Platform polish (PWA optional; no GPS required)

## MVP (v1) — suggested order

1. ~~Owner-only shell + empty codex~~ **shipped**
2. ~~California poppy Claude callout stub~~ **shipped** (`poppy.html`)
3. Walk + buddy + streak  
4. Trail Guide for one region, 2–3 habitats  
5. Codex from IDs (blueprint reveal; curated stills OK)  
6. Ethics onboarding  
7. Optional: a few test QR trail stops  
8. Phone Seek-style camera + stylize (after Trail Guide)

## Later / parked

- [ ] Camera + stylize as full Seek-like path (if not in v1)
- [ ] Remember last region/habitat on device
- [x] Favorite / looking-at places on device (Halalit favorite-library pattern); compare + browse packs
- [ ] Odd Trove hosting vs standalone brand
- [ ] More regional packs beyond first biome

---

## Your additions

Owner pins from chat go here.

### 2026-07-18 — this agent session

- [x] Seek-like camera with Halalit privacy (organism-only; delete photo after record)
- [x] Stylized cartoonish semi-realistic **still** from organism (not Live Photo / full video animation)
- [x] Crow/raven: size must be a first-class recognition clue (ravens bigger)
- [x] Codex reveal: blueprint-style background like PoGo new Pokédex entry; wildlife codex holds that still (+ light idle OK)
- [x] Owner-only Odd Trove beta at `/bane-of-extinction/`; desktop codex; camera phone-only when built
- [x] Stub site + deploy script shipped (empty codex; scan not built yet)
- [x] Codex callouts to the right of organism still (part/clue facts; not insides scan)
- [x] Claude API for facts base on organism **or evidence** encounter (no Wikipedia / no scrape)
- [x] California poppy stub for testing (species-wide; Watermelon Heaven optional cultivar)
- [x] Phone wildlife camera scan (Gemini + Claude); facts follow the guessed ID
- [x] Fix codex still animation with CC0 poppy photo + clearer idle motion
- [x] Common sunflower stub (species-aimed ID hints, fallback callouts, codex still cutout)
- [x] Sweetheart philodendron stub (Philodendron hederaceum; ID hints, fallback callouts, codex still)
- [x] Callouts: one small-help tip per set (no guilt) + remember recent facts for fresh rescans
- [x] Place lens stack (all layers): favorites, looking-at default, compare, fact variants, habitat-only, season, browse-by-area — no GPS

### 2026-07-10 — original design chat

- [x] PoGo-style motivation + real wildlife + non-invasive
- [x] Trail Guide (Akinator) primary; camera optional
- [x] Region/habitat without GPS; skip place still works (capped extra questions)
- [x] Result: “Is this your [type]?” + common + Latin; royalty-free reference (not user’s photo)
- [x] Working title: **Bane of Extinction**
