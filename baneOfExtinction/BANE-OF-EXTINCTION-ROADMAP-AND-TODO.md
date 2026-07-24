# Bane of Extinction — roadmap & todo

**Working title:** Bane of Extinction (for now).  
**Status:** Public quiet beta on Odd Trove. **Google sign-in required** (app gate). EcoLens + wildlife codex shipped; walk timer / buddy not built yet. **Trail Guide (Akinator yes/no) is parked — not building** (pre-EcoLens idea).  
**Live URL:** https://oddtrove.art/bane-of-extinction/ (hub public card; Odd Trove Google SSO)  
**Owner’s Office:** `/bane-of-extinction/office.html` — player accounts, private feedback, new sign-ups switch (never other players’ learns).  
**Related Cursor plan:** `.cursor/plans/wildlife_walk_game_17209669.plan.md` (keep in sync when possible).

**What it is:** A family-friendly, conservation-minded walk game with Pokémon Go–style motivation (walk, buddy, streaks, collection) aimed at **real wildlife** — without bothering animals. Players **learn** organisms into a **wildlife codex** — never “catch” them.

**North star:** Learn the living neighborhood without bothering it.

---

## Hosting (locked 2026-07-23 — public quiet beta)

| Item | Decision |
|------|----------|
| Visibility | **Public quiet beta** on Odd Trove (Google sign-in required in the app) |
| Path | **`/bane-of-extinction/`** (port **8085**) |
| Do not use | **`/bane/`** — still Climatic Mysteries redirect |
| Desktop | **Wildlife codex** browse OK (after sign-in) |
| Camera / scan | **Phone or tablet** (Halalit scanner–style handheld gate). Desktop shows copy to open on phone. |
| Accounts | Odd Trove **Google** SSO; learns + fact book sync; Owner’s Office for accounts / feedback / sign-ups switch |
| Deploy | `bash top/scripts/deploy-bane-of-extinction.sh` |

---

## Product rules (locked)

### Non-invasive / ethics

- No chasing wildlife, nest pins, lures at sensitive sites, flash prompts, or radar-style animal hunts.
- Collection language: **“learned”** / codex entry — never “caught.”
- Quiet-walk mode encouraged.
- Stops (if any) = QR at **human** places (signs, gardens), not animal spots.
- **Don’t get too close (rule of thumb):** No scan or mission needs a risky close-up. Calm animals you already share space with (e.g. a squirrel a few feet away in a yard) are one thing; animals that can bite, scratch, or surprise you (opossum, raccoon, skunk, coyote, snakes, nest defenders, etc.) are another — stay back, use zoom/path distance, or switch to **signs** (tracks, nests, feathers, mounds). Prefer evidence over crowding the animal.

### Privacy (Halalit-style camera)

- Camera is **optional** (see ID paths).
- Scan identifies the **organism only**. If it is perched on a hand (or shoe, face, etc.), do **not** keep or treat the person/body part as part of the find — crop/mask to organism.
- After the player confirms the wildlife ID (**This looks right** → species → codex), **delete the raw photo** (and usually the crop). Also wipe if guesses run dry, they leave the page, or the confirm sits idle too long. Do not store personal or unrelated image data.
- Result / codex art is **never** the player’s raw camera frame.

### Location (no GPS)

- **No GPS**, no map pins on wildlife, no step tracker required.
- Optional **region + habitat** at walk start (e.g. SoCal beach vs NorCal beach) to shrink the species pool.
- If place is **skipped**, EcoLens / browse still work — species pool stays broader; no yes/no question tree.
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
- EcoLens: size is harder without scale — use proportions + one follow-up size question when crow vs raven (or similar) is ambiguous.
- Result copy may say “likely raven — larger” / “likely crow — smaller” when unsure.

---

## Core loop

1. **Start walk** — timer; optional quiet/curious mood.
2. **Set place (optional)** — region + habitat; or skip.
3. **Walk prompts** — listen, look up, notice habitat clues.
4. **Identify** — **EcoLens** (Seek-style camera; below).
5. **Codex reveal + buddy/streak** — stylized still on blueprint-style page; rewards from walk time and IDs.

---

## How to identify — EcoLens (locked)

**Primary ID path:** phone camera (Seek-like), with Halalit photo privacy. **Not building:** Trail Guide / Akinator yes-no question tree (parked 2026-07-23 — that was the plan before EcoLens).

1. Player photographs the organism.
2. App isolates **organism only** (not hand/person/background clutter meant as PII).
3. ID runs on that crop (plus optional region/habitat pool).
4. Player confirms (**This looks right**) or rejects (**Not this** → alternatives / re-ID). Photo deleted on confirm, when guesses run dry, on leave, or idle timeout — never kept for later.
5. Player gets a **natural field-guide still** of the organism (generated from the crop + ID — not a Live Photo / moving raw video). Matches color and form of *this* scan (e.g. red sunflower stays red). Subtle idle (bob/sway) on the still is OK; full “animate the photo into video” stays out of scope.

Privacy + codex rules above stay locked.

---

## Wildlife codex (field guide)

PoGo “new Pokédex entry” energy, for real organisms:

- After a confirmed ID, reveal the stylized still on a **blueprint / codex page** background.
- Under the art: **common name** + **Latin (scientific) name**.
- Quiet caption under the still (same photo frame): **native range** (region / NorCal–SoCal level) + **conservation status**.
- Status/range: **NatureServe Explorer** when the scientific name matches (CC BY; attribution in disclaimer). No IUCN site/API. Claude may refine CA to NorCal/SoCal; curated fallbacks for demos / misses. Not Wikipedia-as-sole-source.
- That page is the permanent **wildlife codex** entry for that organism type.
- Subtle still-image idle animation OK; not a live moving photo of the real animal.
- Curated royalty-free reference art may fill entries when camera stylize is not used (browse / demo stubs).

### Callout labels (locked direction 2026-07-18)

After the still “freezes” on the codex card:

- Show a **reasonable list of callout text boxes** to the right of the organism (leader-line feel).
- Each callout points at a **visible part or clue** (beak, belly, petals, track shape, etc.) with a short fact.
- Examples: toucan beak color/size role; belly → fruit diet; poppy petals / cream center / drought habit.
- Not an internal anatomy scan — educational facts about the organism (or **evidence** of it: tracks, nest, seed pod, chewed plant, bloom patch).
- **Claude API** builds / helps the facts base when the player encounters the organism or evidence (server key; never in public `www/`).
- **No Wikipedia-as-sole-source** and no open-web scrape for callout facts — Claude helper knowledge + curated packs. Status/range may use **NatureServe Explorer** (CC BY) by scientific name; never IUCN site/API.
- Tone: useful learning helper, not a guaranteed field guide.
- **Player-world facts (2026-07-20):** most callouts tie the organism to everyday life (walks, yards, shared air/food webs, what you’d notice) — not a textbook dump. **Exactly one** fact per set can be a cooler species-own wonder with less direct human impact. Goal: feel more understanding of wildlife around you, not become a field-guide expert. Lean toward helping the living world (**Bane of Extinction**) without making every line a chore.
- **Garden focus (2026-07-22):** device toggle. **On** = garden-world eco facts (beds, seed dispersal, grower kindness). **Off** = walk/wild-neighbor eco facts — no gardening how-tos. Same soft eco lean; different lens.
- **Hiking + Seashore focuses (2026-07-23):** engaged stances (not GPS). Hiking = trail/forest-walker relationship facts; Seashore = beachgoer relationship facts — how people act in that kind of place and how that touches the organism (not fun-trivia-only). Other modes may still mention people–nature links; these lean into it for players who want more. Aquarium/shelf finds still get the chosen stance.
- **Crops & Domestic Animals focus (2026-07-23):** renamed from Food history stub. Crops, farm animals, and companions (cats/dogs OK). Claude: domestication eras, plain crop discovery dates (not settler/Indigenous conflict), husbandry noticing, light everyday kindness (reuse bottles / durable goods), and **not-your-fault** system/company pollution notes. **Claude banned** from human-injustice history and from inventing **deeper environmental practices** (regen ag is one example — also complex farm systems, soil-carbon doctrine, specialized protocols) until owner notes. Pigs: ancestry/litter/husbandry OK; never encourage eating; “pork unhealthy” = later pin.
- **Objects / built world focus (2026-07-23):** fact lens on nature finds that meet everyday human-made categories (plastic bottles, asphalt, buildings, curbs — as types). **EcoLens may ID** outdoor manufactured categories (plastic, asphalt, pavement, glass bottle, metal can, curb, packaging) — category names only, never brands. **Claude safe lane:** material noticing, built/nature connection, not-your-fault systems, **≥ half hope/agency**. **Claude banned until owner hand-vet:** named brands, specific named buildings or places of worship as green examples, environmental justice stories, unverifiable “this photo proves recycled beams.” Still refuses cars/vehicles, phones, indoor furniture as the find.
- **Small-help tip + fresh rescans (2026-07-21):** among the everyday facts, **exactly one** is a gentle, species-specific “what you can do for this organism’s world” tip (no guilt; don’t blame staple foods or systems people don’t control). Device remembers recent fact text per species + focus mode (not photos) so Load / rescan can ask Claude for a fresh set.
- **Build-on prior facts (2026-07-23):** on later Loads for the same find, **exactly one** callout deepens something already learned. Hooks rotate across prior fact sets (and unused facts within a set) — e.g. first set teaches water vapor; a later set may name who depends on that vapor; the next Load picks a different prior set/fact. Does not lock the whole set to one theme.
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
- [x] Public quiet beta + Google sign-in gate + Owner’s Office (accounts, feedback, sign-ups switch) — 2026-07-23
- [x] Wildlife codex stub page (desktop + phone browse)
- [x] Handheld gate messaging (camera later; desktop = codex)
- [x] Codex callout panel direction (Claude facts; organism + evidence; no Wikipedia)
- [x] California poppy stub (`poppy.html` + Claude `/api/callouts`; Watermelon Heaven optional)
- [ ] Core loop: walk → optional place → EcoLens ID → codex → buddy/streak
- [x] ~~Trail Guide engine~~ — **parked / not building** (pre-EcoLens; EcoLens is the ID path)
- [ ] Size-first disambiguation on EcoLens (crow vs raven as test case)
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
- [x] Neighborhood missions v1 — unlock after ~15 finds; signature-sign quests; ant mound full visual (with/without + cutaway); other quests story cards
- [x] Level ladder labeled: L1 scans → L2 beginning missions → L3 place meanings / under-the-hood (after a handful of L2 missions — **5**, not 2 and not 15)
- [x] Fact book on account — collected callout facts sync with Google; soft `n / ~x` progress; **fact levels separate from mission levels** (notice → help → wonder unlock with commitment); book-style codex cover + pages
- [ ] Per-species permanent art library / cloud cache (optional later)
- [ ] Leader-lines from callouts to exact body-part anchors on stylized art
- [ ] Platform polish (PWA optional; no GPS required)

## MVP (v1) — suggested order

1. ~~Owner-only shell + empty codex~~ **shipped**
2. ~~California poppy Claude callout stub~~ **shipped** (`poppy.html`)
3. ~~EcoLens camera + stylize + confirm~~ **shipped**
4. Walk + buddy + streak  
5. Codex from IDs (blueprint reveal; curated stills OK) — largely shipped; keep polishing  
6. Ethics onboarding  
7. Optional: a few test QR trail stops  
8. ~~Trail Guide~~ — **parked / not building**

## Later / parked

- [x] ~~Camera + stylize as full Seek-like path~~ **shipped** (EcoLens)
- [x] **Trail Guide / Akinator yes-no** — **parked / not building** (2026-07-23). Do not rebuild unless owner reopens it.
- [ ] Remember last region/habitat on device
- [x] Favorite / looking-at places on device (Halalit favorite-library pattern); compare + browse packs
- [ ] Odd Trove hosting vs standalone brand
- [ ] More regional packs beyond first biome

---

## Your additions

Owner pins from chat go here.

### 2026-07-21 — status / native / invasive captions (call this up in a new agent)

**Intent (owner):** After a scan, always see **conservation status** when possible, plus **native where** and **invasive/introduced elsewhere** — without needing compare places. Soft **Caution:** wording when it’s a learning heads-up, not a legal noxious list.

**Already shipped (do not rebuild):**
- Codex caption: Status + native range + elsewhere (no compare place required)
- NatureServe CC BY for status / native / exotic flags
- USGS **US-RIIS** CC0 for U.S. introduced/invasive (AK / Hawaii / contiguous L48) when latin matches
- Caption leads with **Caution:** on elsewhere lines; US-RIIS wins over NatureServe exotic soft text

**Not yet — pull this section when owner says “BoE status captions,” “scan-page status,” “state-level invasive,” or “call up invasive captions from roadmap”:**

- [ ] **Show status + native + elsewhere on the scan result screen** — today the immediate scan page mostly shows confidence / stage / color; status & range appear after codex callouts. Surface the same caption (or a short version) right on the scan result before / without waiting for a full Load.
- [ ] **State-level invasive elsewhere** — US-RIIS is only AK / HI / lower-48 buckets (e.g. “invasive in the contiguous U.S.”), not “often invasive in OK, CA.” Owner wants captions like *Native in Mexico; Caution: often invasive in U.S. states such as Oklahoma, California* when reliable data exists. Options later: NatureServe exotic-state lists refined into captions; owner-curated packs for favorite species; other open lists with attribution — not IUCN, not anti-bot scrapes.
- [ ] **Owner-curated invasive packs (favorites)** — optional hand list for species where US-RIIS/NatureServe are too coarse or missing; curated wins over soft Claude guesses.

**Do NOT:** treat captions as a legal invasive registry; cite IUCN / Red List; scrape park or anti-bot sites for invasive data.

### 2026-07-23 — public launch, cost shields, other sources (call this up in a new agent)

**Intent (owner):** Public quiet beta with Google sign-in so progress syncs. Cost shields (daily caps) deferred — owner said cost is fine for now. Prefer open/permissioned sources over silent scrapes. **Not** Trail Guide — that path is parked.

**Already shipped (do not rebuild):** Shared stage-still library (one portrait per species+stage); Gemini-first ID + safe shelf match; fact pools; Focus mode picker; NatureServe CC BY + USGS US-RIIS CC0 with credit; **public quiet beta** (nginx owner gate off; hub public card); **Google sign-in gate**; **Owner’s Office** (accounts + private feedback + new sign-ups switch).

**Not yet — pull this section when owner says “BoE daily quests,” “Pl@ntNet,” “park facts permission,” or “call up cost shields from roadmap”:**

- [x] **Public quiet beta** — drop nginx owner gate on `/bane-of-extinction/`; hub card with public sites + beta tag. Keep `/bane/` → Climatic Mysteries redirect. Update capabilities + ops. **Shipped 2026-07-23** with Google sign-in required (not open anonymous play).
- [x] **Accounts required for play** — browse/scan/callouts after Odd Trove Google sign-in; Owner’s Office for accounts + feedback.
- [ ] **Daily quest / scan budget + healthy break copy** — optional later if bills spike; hard daily cap on expensive play; warm “come back tomorrow.” Still allow browsing past learns.
- [ ] **Pl@ntNet plant ID** — optional later (official API + attribution + owner account). Not Seek / not iNat CV (no public CV API for us).
- [x] ~~Trail Guide engine~~ — **parked / not building** (2026-07-23). Was listed here as zero-photo cost shield; owner chose EcoLens-only ID instead.
- [ ] **Park / zoo / museum facts the honest way** — no silent bot scrape. Options: link-out; owner rewrites after reading; ask written permission; or open-license collections (Smithsonian Open Access, Commons, etc.) with credit. Example inspiration (not free to copy wholesale): Santa Clara Valley Open Space Authority salamander pages; Sanborn-area species lists via iNat checklists for *learning*, not scraping.
- [ ] **Deepen Seashore + Food history focus packs** — replace early stubs with richer curated / prompt packs (food history injustice lines stay owner-curated only — see crops section below).
- [ ] **Rate limits / soft kill switch** — Owner Office or env toggle to pause scans if bill/quota spikes.

**Do NOT:** scrape park/zoo sites; wire unofficial iNaturalist Seek CV; rebuild Trail Guide unless owner reopens it.

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
- [x] Later Loads: exactly one fact can deepen a prior fact, rotating which prior set the hook comes from
- [x] Place lens stack (all layers): favorites, looking-at default, compare, fact variants, habitat-only, season, browse-by-area — no GPS
- [x] Garden focus toggle: garden-world eco facts (incl. seed dispersal) vs walk/wild eco facts — lean toward helping, not every line a chore
- [x] Hiking + Seashore focuses: engaged beachgoer / trail-walker relationship lens (not GPS; not trivia-only)
- [x] Crops & Domestic Animals focus: crop/domestication lens; Claude no injustice history; pigs no eat-encourage
- [ ] Later: owner-curated packs from real sources for left-out human-injustice / famine history (not Claude)
  - **Split:** Claude may do ecological complications (monoculture blight risk, invasive escape, overgrazing) and not-your-fault company pollution notes. Justice-linked “environment” stories (who was starved, stolen land, forced labor) → curated packs only.
  - **Starter sources (owner picks; credit in packs):**
    - Potato / Irish famine: National Famine Museum (Strokestown), Irish government’s Great Famine pages, British Library / National Archives (Ireland + UK) catalog essays; Christine Kinealy (*This Great Calamity*); Cecil Woodham-Smith (*The Great Hunger*) — read critically; note Ottoman aid is often under-taught (cross-check museum / academic summaries before packing).
    - Crop / domestication timelines (safer Claude-adjacent topics to vet by hand): FAO crop histories, USDA / GRIN, Smithsonian / Kew species pages when they cite dates.
    - Indigenous foodways & land (curated only, never Claude freeform): tribal nation cultural pages the author publishes; museum exhibits with clear provenance; avoid scraping or inventing.
- [ ] Later: deeper environmental practice facts (regen ag and similar) — only after owner notes / line check
- [ ] Later: pig health / “why pork can be unhealthy” facts (only after owner asks — not in current prompts)

### 2026-07-23 — Objects / built world (safe lane)

- [x] Focus mode **Objects / built world** on codex (separate fact pool)
- [x] Claude safe lane: categories + material noticing + not-your-fault systems + hope/agency ≥ half; practice *kinds* OK
- [x] Claude banned until hand-vet: named brands, specific green buildings / places of worship examples, justice stories, photo-proof material claims
- [x] EcoLens scan lane for everyday outdoor manufactured categories (plastic, asphalt, pavement, glass, metal can, curb, packaging — no brands; still refuse cars/phones/furniture)

### 2026-07-23 — Objects later (needs owner hand-vet — call this up in a new agent)

**Intent (owner):** Everyday built things help people see how the built world meets nature. Not a doom lecture — players may conclude systems often weren’t built with enough care for living systems, but **≥ half of facts** stay hope/agency (what you can do, what people already do, learning itself counts). Optional set shape: calm problem lines, then a stronger “people rising” landing.

**Already shipped (do not rebuild):** Objects focus mode; EcoLens category IDs (plastic/asphalt/etc.); Claude safe lane (no brands / no named green places / no justice inventing).

**Not yet — owner hand-vet packs only (Claude must not invent these):**

- [ ] **Named green buildings** — curated cards: “Did you know? *This place* was built with water-conscious design / recycled steel / …?” Owner vets name + practice + source before shipping. Camera cannot prove recycled beams from a photo alone — unlock via plaque/confirm or curated match.
- [ ] **Named places of worship with green practices** — same pattern as green buildings. Not “every masjid/church.” Only specific owner-approved examples of environmentally friendly building practices. Never faith critique; places of worship are not framed as anti-environmental.
- [ ] **Named brand stories** — praise or dig only after owner personally vets the line. Default Claude stays on packaging/material *patterns*, not “Brand X is evil/good.”
- [ ] **Environmental justice stories** — who was harmed, which community, lawsuits, policy fights — owner-curated from real sources only (same spirit as crops injustice packs). Not Claude freeform.
- [ ] **Photo-proof material claims** — “this beam is recycled steel,” “this brand’s packaging is #1 ocean plastic,” etc. — blocked until owner has a vetted claim path (label/plaque/curated ID).
- [ ] **Wire curated packs into EcoLens / callouts** — when a scan or lookup matches an owner pack, prefer pack facts over Claude inventing; keep safe-lane Claude for unmatched categories.
- [ ] **Optional wider object categories** — only if owner asks (e.g. more street furniture types); still category names, still refuse cars/phones/indoor furniture unless owner expands that list.

**Agent cue:** Owner says “Objects hand-vet packs” / “BoE named green buildings” / “call up Objects later from roadmap” → read this section; do not unlock Claude freeform for brands/justice/named places.

### 2026-07-23 — camera confirm loop

- [x] Hold raw photo in memory until **This looks right**; wipe on leave / dry guesses / idle; never store for later
- [x] **Not this** cycles alternatives then re-ID with rejected names
- [x] **Google this** link-out to check the name against the web
- [x] EcoLens wait-screen rotating wisdom (justice / small daily help / systems+agency; short; not species facts)
- [x] EcoLens natural nonliving finds (rocks, minerals, empty shells, fossils) + geology-style facts
- [x] EcoLens everyday outdoor manufactured categories (plastic/asphalt/etc.) — see Objects sections above

### 2026-07-22 — fact book

- [x] Store learned callout facts on account (device cache + Google sync with learned blob)
- [x] Soft progress `n / ~x` + facts-to-next-fact-level (separate from mission levels)
- [x] Fact levels unlock kinds: Curious notice → Neighbor kindness (help) → Species wonder → Field learner
- [x] Book-style codex cover + pages (Splash Aquapedia–feel reference)

### 2026-07-21 — neighborhood missions

- [x] Unlock after ~15 learned finds (device shelf encounter total); owner-beta peek while learning
- [x] Signature-sign missions only (easy tells → real species); filtered by looking-at habitat
- [x] Quests live: ant mound (full visual), signature feather, woodpecker work, leafcutter circles, shrike pantry, ice plant carpet, ivy on trunk, hotspot patch, leave it be, one kind act
- [x] Explicitly not shipping: squirrel fruit, slug trails, paper nests, oak galls, outside checkbox, photo-vs-screen detection
- [x] Beginner scans = meet the neighbor; missions = homes / signs / care + adventure reveals (dramatic without melodrama)
- [x] Ant mission: animated with/without garden compare + underground cross-section
- [x] Don’t-get-too-close rule of thumb on home, scan, missions (and each mission card) — no risky close-ups; signs OK for biting/surprising animals
- [x] Level 3 starter pack: ice plant / ivy / poppy / eucalyptus place meanings; missing-apex under-the-postcard story; houseplant boundary

### 2026-07-10 — original design chat

- [x] PoGo-style motivation + real wildlife + non-invasive
- [x] Early design had Trail Guide (Akinator) primary — **superseded 2026-07-23:** EcoLens is the ID path; Trail Guide parked
- [x] Region/habitat without GPS; skip place still works (broader pool, no question tree)
- [x] Result: “Is this your [type]?” + common + Latin; royalty-free reference (not user’s photo)
- [x] Working title: **Bane of Extinction**
