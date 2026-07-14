# Maestro's Odyssey — roadmap & todo

**Planning doc only** — not deployed unless you say deploy.

**Live site today:** basic café mechanics (`www/`) — still messy. **Do not deploy** for tasks below until owner approves per task after local smoke test.

**Plot tone:** `docs/DRAGONS-BREW-PRE-TRAIN.md` — **week-one direction revised in “Your additions” below** (mellow room; detective later). Full plot-doc rewrite when owner asks.  
**Capabilities:** `ODDTROVE-CAPABILITIES.md`

---

## Waiting queue (pinned — build later, not live yet)

Design and tasks **committed here**; implementation waits until you approve task-by-task. **No `www/` deploy batch** for this block.

### Canon (done — reference when building)

- [x] **Design pillars** — natural language checks, no punishment, no flashcard UI (see section below)
- [x] **Dragon’s Brew menu canon** — **generic core:** 4 drinks, 5 foods (owner trim 2026-06); commonplace only
- [x] **Café week arc** — 7 days → card empty → day-8 elder report → upgrade → train

### Build queue (in order — all `[ ]` until shipped locally + owner OK)

- [x] **#10** — Prologue elder + card grant (`www/` — shipped locally; deploy when owner OK)
- [ ] **#11** — Café lane vocab — **Spanish or Arabic** menu lemmas (`mo-cafe-language.js` + menu `ar` labels; owner review Arabic per `docs/LANGUAGE-VOCAB-WORKFLOW.md`)
- [x] **#12** — In-game days (same weekday tracking)
- [x] **#26** — Menu unlock schedule (3 drinks day 1 → espresso day 2; stagger 5 foods through day 4)
- [ ] **#27** — Day-2+ order depth (con/sin azúcar, upsell, Mara read-back)
- [ ] **#13–19** — Week-one **mellow room** (species + language basics; one day per task — see **Your additions**)
- [ ] **#25** — Vocab progress tracker (familiarity bands, **menu fade**, tourism gate, elder prompts — no grade UI)
- [x] **#28** — Day-8 elder report call (two lines only; not a quiz screen)
- [ ] **#29** — Café revisit when elder asks player to go back and find out more
- [ ] **#24** — Train gate / next stage (after #28)
- [ ] **#23** — Plaza floor (echo café words)
- [ ] **#20–22** — Optional order check; **evening werewolf/vampire table (week one)**; goblin watch → **post–train / later arc** (not week one)
- [x] **Menu trim + language picker (owner 2026-06)** — generic core; ES/AR popup at start + restart; 1–2 new lemmas/day; extras → `MOUNTAIN_MENU_POOL`
- [ ] **Day-8 balance tuning** — script 7 café days → 0 pesos on same weekday next week

**Next approved build when mechanics stable:** #10 → Arabic lemma review (#11) → #27 → #13 Monday (mellow species beat).

---

## Design pillars (committed — game-wide)

**One line:** Language shows up in real situations. Progress means *can you follow life here?* — never *did you memorize the deck?*

| Do | Don’t |
|----|--------|
| Someone **needs** something in fiction (directions, a report, help reading a sign, order without a mistake) | Flashcards, match games, “Incorrect,” visible grades |
| **No punishment** — thin answer → kind rephrase, optional revisit, world still opens | Fail screens, lost progress, soft-lock train |
| **Two NPC moods only** when checking depth — *“That sounds lovely, dear.”* / *“I love that place. Can you go back and find out more for me?”* | *“That sounds like a start,”* *“Try again,”* *“You’ll notice more next time”* |
| **English frame + Spanish slots** early (*For your té — con azúcar or sin azúcar?*); fade hints as familiarity rises | Pop-up vocabulary lessons |
| **Context guessing** — new word in a scene they mostly understand | Ten new lemmas per beat |
| **Tracker (#25)** for echoes, elder prompts, subtitle fade — **private**, not a grade UI | Leaderboards, public posting |

**Voice:** Not every NPC is a sweet elder — Mara, minotaur clerk, pegasus platform agent each match their place. **Same philosophy**, different character.

**Optional hard mode (#20):** typing / strict order check — player opt-in only; default path stays recognition + natural conversation.

---

## Dragon’s Brew menu canon (committed)

**Vibe:** Neighborhood café + light panadería — **generic core** only; not a specialty bar.

| Scope | Rule |
|-------|------|
| **Drinks (4)** | Visit 1: café, té · day 2: chocolate caliente · day 7: espresso (cognate — no new lemma). |
| **Food (5)** | Muffin day 1 (cognate) · new lemmas: tostada D3, galleta D4, bolillo D5 · croissant D6 (cognate). |
| **Add-ons** | Azúcar / سكر day 6 · creamer day 7. |
| **Here** | café, té, chocolate caliente, espresso · muffin, tostada (bread), croissant, galleta, bolillo |
| **Not here (mountain / later)** | americano, descafeinado, té de hierbas, café de olla · bagel, concha, empanada, churro, tortilla tostada · lattes, syrup pumps, smoothies |
| **Teaching** | Wall = **one chosen lane** (ES or AR) + English gloss + **lane money** (pesos / dirham — درهم) · **1–2 new lemmas/day** · Arabic wall: **translit — script — English** · culture keywords elsewhere stay in native tongue |

**Do not** expand Dragon’s Brew past this generic core without owner OK. Trimmed items live in `MOUNTAIN_MENU_POOL` in `mo-dragons-brew-menu.js` for post-train / mountain café.

---

## Café week arc (committed)

| Beat | Fiction |
|------|---------|
| **#10 prologue** | Community elder grants learning card — **about one week** of neighborhood meals (MXN). |
| **Days 1–7 (#12 + visits)** | Menu unlocks; plot (#13–19); card balance **predesigned** to reach **0** after **7 completed café days**. |
| **Day 8 (same weekday next week)** | Card empty → elder **calls** (or visit). Not a quiz — *“I haven’t been to Dragon’s Brew in quite some time. Tell me about it — the food, the room, the community.”* Player **reports** what they saw (drinks, food, Mara, vibes, house rules — **not gossip**). |
| **Enough detail** | Elder: *“That sounds lovely, dear.”* → card **upgraded** → eligible for train when **week 3** arrives (#24). |
| **Wants more** | Elder: *“I love that place. Can you go back and find out more for me?”* → card **still upgraded**; **train waits** until a later elder check passes → café revisit (#29) to bring back what she asked for. **No** “barely visited” branch; **no** grading tone out loud. |
| **Under the hood** | Elder report scored (**≥80%** pass); **elder test only** — not café quiz or menu familiarity. Player **never** hears a percentage or fail label. |

---

## How to ask Cursor (read this first)

Say a **task number** (or a **safe pair**). Always start with **verdict first** unless you already approved that task.

| You say | Meaning |
|--------|---------|
| `MO task #2 — verdict first` | One numbered item below |
| `MO tasks #1–2 — verdict first` | Safe pair (see table) |
| `Approved. Do MO #3.` | Build after verdict |

### Safe batches (won’t fight smooth play)

| Batch | Tasks | Why OK together |
|-------|-------|-----------------|
| **A** | **#1 + #2** | Same file, both “physical café” — doors + collision. **Acceptance: smoke test (doors + Mara E-talk).** |
| **B** | **#3** | One complete visit — **do alone**. **Acceptance: full smoke test including order + exit + re-enter.** |
| **C** | **#4** or **#5** | One map polish — pick one chat each |
| **D** | **#6** then **#7** | Canon MXN prices → show on menu wall |
| **E** | **#8** | Learning card HUD + balance storage — alone |
| **F** | **#9** | Pay with card at Mara — alone (needs #7 + #8) |
| **G** | **#10** | Prologue elder grants card — alone; owner gate for `www/` |
| **H** | **#11** | Tourist money vocab — alone |
| **I** | **#12** | Day clock — alone (needs #3) |
| **J** | **#13–19** | **One day per chat** — never bundle two days |
| **K** | **#20+** | One item per chat |
| **L** | **#26** | Menu unlock schedule — alone |
| **M** | **#27** | Day-2+ order depth (con/sin, upsell) — alone |
| **N** | **#28** then **#29** | Elder week-end call (#28) → optional revisit quest (#29) if needed |

### Do not batch (gets janky fast)

- #3 + #13 (order loop + Monday NPCs)
- #1–2 + #3 (foundation + plot loop in one mega-diff)
- #12 + #13 (day system + first plot day — OK only if #12 is already done)
- #8 + #9 (card HUD + pay — do #8 before #9)
- #9 + #13 (pay + Monday plot)
- #10 prologue + anything else in one message (elder scene is its own ship)
- **Any new feature while door or Mara is broken** — fix regression first

---

## Master list (in order — do not skip ahead for plot)

Check when shipped to `www/` and play-tested locally.

### Foundation — smooth Dragon’s Brew first (#1–3)

- [x] **#1 — Doors** — trigger from porch/threshold; spawn flush inside/outside; same column both maps; no gap. (`mo-farm-rpg.js`)
- [x] **#2 — Collision** — can’t walk on roof/through walls; depth behind building when north; door + porch only walkable through facade. (`mo-farm-rpg.js`)
- [x] **#3 — Complete one visit** — order submit → Mara reply → stub pay → drink → clear “done”. Any non-empty order OK. (`mo-farm-rpg.js`, `mo-dragons-brew-menu.js`)
- [x] **#3 polish (cup + sit)** — cup on counter at drink beat; cup follows player after; T sit at floor tables; **required dine** (sit, D sip, F eat) before visit completes; table cup orientation + sip drain fix (2026-06)

**Smoke test after #1–3:** walk in → order → pay → drink → **see cup on counter** → continue → **cup with you** → T sit at floor table (south of brown table) → walk out.

**Example — batch A (recommended first ask):**
```
MO tasks #1–2 — verdict first.
Fix door enter/exit + outside café collision. mo-farm-rpg.js only. No plot. No deploy.
```

**Example — task #3:**
```
MO task #3 — verdict first.
Complete café visit after order (reply, stub pay, drink, done). mo-farm-rpg.js + mo-dragons-brew-menu.js. No deploy.
```

---

### Space polish — optional before plot (#4–5)

Can wait until after #12 if you want story sooner; do before #13 if the room still feels wrong.

- [x] **#4 — Outside looks natural** — storefront, sidewalk, sign read as one building. (`mo-farm-rpg.js`)
- [x] **#5 — Inside looks natural** — counter, tables, boards; Mara reads behind counter. (`mo-farm-rpg.js`)

**Example:** `MO task #4 — verdict first. Natural outside storefront. mo-farm-rpg.js only. No NPCs.`

---

### Prologue, learning card & pesos (#6–#11)

**Fiction (canon):** Before Dragon’s Brew, a **community elder** gives a **prepaid learning card** — in-world debit for purchases only, **no borrow past 0**. **Spanish lane → Mexican pesos (MXN). Arabic lane → dirham (درهم).** Dragon’s Brew is the **first spend** in play. See **Prologue fiction** below.

**Money is NOT US dollars.** In Mexico **$** often means **pesos**. On screen always say **pesos** or **MXN** (e.g. `35 pesos`) — never a bare number that reads like US dollars.

**Build order:** #7 menu prices → #8 card HUD → #9 pay → (#10 prologue when owner ships) → #11 vocab. Stub card balance in **#8** until **#10** elder scene replaces it.

- [x] **#6 — Day-1 MXN price canon** — owner-approved indie café prices (table below). Rotation items priced when they join the board.
- [x] **#7 — Prices on menu wall** — `pricePesos` per item; display `NN pesos` or `NN MXN` (`mo-dragons-brew-menu.js`)
- [x] **#8 — Learning card (stub)** — on-screen balance; `localStorage` wallet; stub start **200 MXN** until #10. Copy says **learning card**, not “pretend coins.” No real payment APIs.
- [x] **#9 — Pay with card at Mara** — order total in pesos; confirm; **balance down**; at **0** can’t complete sale. Replaces stub pay dialogue.
- [x] **#10 — Prologue elder + card grant** — Stardew-shaped opener → language/look picker → gender-matched elder overlay → **400** week budget on grant. Replaces #8 stub for new runs.
- [ ] **#11 — Tourist money vocab** — draft `mo-tourist-vocab.js`; owner review per `docs/LANGUAGE-VOCAB-WORKFLOW.md`

**Example — task #7:**  
`MO task #7 — skip verdict, implement now. Day-1 MXN prices on menu wall (roadmap table). Label pesos/MXN — not US dollars.`

---

### Time engine (#12)

Needs **#3**.

- [x] **#12 — In-game days** — start Monday; advance after completed visit; day label on screen

---

### Week-one room — mellow, not mystery (#13–19)

Needs **#3** and **#12**. **Tone:** nature-wonder café week — friendly regulars, species glimpses, language in context. **Not** mystery-novel infodumps. See **Your additions** (owner pinned 2026-06). Old detective / sea-policy beats in `DRAGONS-BREW-PRE-TRAIN.md` → **later arc**, not week one.

- [ ] **#13 — Monday** — warm room; Mara + wall + strike board; **friendly customers**; optional muted **TV headline** (soft world color, not crime blotter)
- [ ] **#14 — Tuesday** — strike board tick; **minotaur** as pleasant morning regular (not lore courier)
- [ ] **#15 — Wednesday** — **family night** human table; blue-night **vampire** usual; light species beat
- [ ] **#16 — Thursday** — **werewolf fiancé + chaperone twin** (evening); calm public life — no centaur/detective overlap
- [ ] **#17 — Friday** — mellow Friday regulars; **no** dragonfolk mafia beat in week one
- [ ] **#18 — Saturday** — **pegasus + griffin** as nice Saturday regulars (wonder, not worry-plot)
- [ ] **#19 — Sunday** — quiet Sunday room; one soft species or language echo

---

### Later (#20–29)

- [ ] **#20 — Real order check** (optional hard mode — ES or AR lane; not default path; see Design pillars)
- [ ] **#21 — Goblin detective visual watch** — **post–train / later arc** (not week one)
- [ ] **#22 — Evening werewolf + vampire table** (week-one evenings Thu+; innocent vampire regular)
- [ ] **#23 — Plaza floor** (same learning card rules; echo café words on signs)
- [ ] **#24 — Train gate / wider world** (after #28 elder upgrade)
- [ ] **#25 — Wire vocab into progress tracker** (familiarity bands, **bilingual menu fade**, **tourism competence gate**, elder prompt source, subtitle fade — no grade UI)
- [x] **#26 — Menu unlock schedule** — visit 1: 3 drinks + 2 foods; day 2: espresso + croissant; foods through day 4 per **generic menu canon**; chalkboard “new today” ticks
- [ ] **#27 — Day-2+ order depth** — *For your té — con azúcar or sin azúcar?* (or AR lane equivalent); same-or-different; one food upsell; Mara read-back in player’s **active café lane** before pay; no new specialty drinks
- [x] **#28 — Day-8 elder report** — fiction week 2 + language week goal; natural report conversation (not quiz UI); two elder lines only; card upgrade; revisit flag when under hood pass
- [ ] **#29 — Café revisit quest** — when #28 “go back and find out more” branch; player brings back one asked detail; train opens after elder pass (≥80% under hood)

**Build order note:** #12 days → #26 unlocks → #27 order depth → #13–19 plot → #25 tracker (can start earlier for elder) → #28 → #24.

---

## Prologue fiction (canon — for agents)

Community elder → **prepaid learning card** (debit, in-game only, **no overdraft**). Spanish → **MXN**. **#10** elder scene → **#9** first spend at Dragon’s Brew. Elder frames it as **about one week** of neighborhood meals — foreshadows **#28** refill on day 8. Until #10 ships, **#8 stub balance** is OK.

---

## Your additions (decisions)

### Week-one tone + café language (owner — pinned 2026-06)

- [ ] **Week one = mellow, not mystery** — nature-wonder vibe at Dragon’s Brew: warm room, friendly fellow customers, species lore in small beats. **Detective / goblin / centaur / mafia / sea-policy infodumps → later in game**, not the first in-game week. Optional **muted café TV** for soft headlines instead of table lectures.
- [ ] **Week one teaches species + language basics** — fictional peoples get **key words/concepts in their native tongues** (stable; does not fade). **Café menu = one lane** (Spanish **or** Arabic — player picks at start / restart). **Culture keywords stay native** even when the café lane is Spanish.
- [ ] **Player frame language** — UI + Mara’s chat frame use whatever language the player already speaks in practice (not forever locked; reduces overwhelm). Irish / Japanese / Turkish / other region lanes stay **locked until train / wider world** — not a day-one pile.
- [x] **Café lane picker** — popup at first load and after Restart; wall = one target language + English gloss (not ES+AR+EN side by side).
- [ ] **Optional lane switch (#25)** — in-game switch to other café language later; dual-label fade / tourism gate deferred.
- [ ] **Revise `DRAGONS-BREW-PRE-TRAIN.md`** when owner asks — move old week-one detective/sea table to a **later-arc** section; align week table with #13–19 above.

- [ ] **Starting balance / day-8 depletion** — tune so **7 completed café days** → **0 pesos** on day 8 (same weekday). Stub **200 MXN** until scripted week budget is wired in **#10** / **#28**.

- [x] **Day-1 prices (MXN pesos)** — indie café; **≈17–18 MXN = $1 USD** for your math only — **not** “40 US dollars” for a muffin.

  | Item | MXN (pesos) | ~USD (owner only; not in game) |
  |------|-------------|-------------------------------|
  | coffee (café) | 35 | ~$2 |
  | tea (té) | 30 | ~$1.75 |
  | hot chocolate | 48 | ~$2.85 |
  | espresso | 40 | ~$2.35 |
  | muffin | 28 | ~$1.65 |
  | croissant | 32 | ~$1.90 |
  | galleta (cookie) | 24 | ~$1.40 |
  | bolillo | 20 | ~$1.15 |
  | toast (tostada) | 22 | ~$1.30 |
  | sugar / creamer | 0 | included |

  **Sample orders:** café + muffin **63 pesos** · té + tostada **52 pesos** · espresso + galleta **64 pesos**.

  **On menu:** `café — 35 pesos` — never bare `$40` without “pesos”.

### Elder report + Mara echo + train (owner — pinned 2026-06)

- [x] **Mara order echo — week 1** — repeat matched items in **native café script** (e.g. `qahwa` → `قهوة`), not the player’s romanization or English.
- [x] **Mara order echo — week 2+** — basic joined phrase in the active lane (e.g. `قهوة وشاي`, `café y té`); not full free-form sentences week one.
- [x] **Day-8 elder report (#28)** — natural conversation, not a quiz UI. **Pass (≥80%)** under hood → *“That sounds lovely, dear.”* **Not yet** → *“I love that place. Can you go back and find out more for me?”* Player never sees a score or percentage; **80% is elder test only** (not café quiz / menu familiarity). **Language week goal** (3+ distinct orders + 1 memorized, or 4+ orders, or 2 memorized) gates the call — not balance = 0.
- [ ] **Week 3 train (#24)** — station opens when fiction week 3 starts **if** elder pass; otherwise more neighborhood time (#29 revisit) until pass — no fail screen, no lost progress.

---

## Quick reference — live `/maestros/`

| Works | Not built |
|-------|-----------|
| Visit + cup + T sit + required dine + Mara intro + learning card HUD + pay (#8–9) | Mellow week-one room (#13+), bilingual fade + gate (#25), order depth (#27) |
| Prologue elder + card grant (#10) + day-8 elder report (#28) | Café revisit (#29), train (#24), detective arc (later) |
| Doors + collision + complete visit (#1–3) + café space (#4–5) + fiction days (#12) + menu unlocks (#26) | Bilingual ES+AR wall (#11), plaza (#23), train (#24), detective arc (later) |
| MXN menu prices (#7) | |

---

## Doors + Mara keep breaking — what that means for tasks

**Door stabilization (2026-06):** `mo-doors.js` owns façade math, derived `gridCol`, collision passage vs transition triggers, and `validateDoorLink`. **`bash maestrosOdyssey/scripts/verify-maestros.sh`** runs before Maestro's deploy; any change to `mo-doors.js` or door logic in `mo-farm-rpg.js` must pass verify + smoke test below (include Mara).

**Why:** Almost all of it lives in **one file** (`mo-farm-rpg.js`) in **one `update()` loop** — movement, door transition, dialogue open/close, order typing, and map change all step on each other. Fixing spawn/collision often moves the player tile Mara checks. Adding dialogue after order changes what E / Space / R do. So regressions are normal until the loop is stable.

**What to do:**

1. **Treat #1–3 as one “interaction foundation”** — not three unrelated features. After **every** Cursor build from #1 through #3, run verify + smoke test below before starting #4.
2. **Never approve a door-only task** without “Mara still works” in the ask. Never approve #3 without “door round-trip still works.”
3. **If something breaks again** — stop adding plot/pesos/polish. One chat: **regression fix only** (same numbers, no new scope).
4. **#4–5 (looks)** are high-risk for doors/Mara — only after smoke test passes; say “don’t change door or dialogue logic unless required.”
5. **#13+ plot** adds more dialogue and NPCs on the same loop — **do not start** until smoke test is boringly reliable.

### Smoke test (you, 2 minutes — after tasks #1, #2, #3, and any later task that touches `mo-farm-rpg.js` or `mo-doors.js`)

- [ ] `bash maestrosOdyssey/scripts/verify-maestros.sh` passes

- [ ] Outside → walk to porch → enter **without** standing on the door graphic wrong
- [ ] Inside → spawn flush at door, not floating
- [ ] **E** Mara → intro or order line appears
- [ ] Close dialogue → if order, type + Enter → (when #3 done) full visit finishes
- [ ] Exit → outside spawn correct
- [ ] Re-enter → Mara order path still works (menu read if needed)

**Regression ask when something broke again:**
```
MO — verdict first. Regression only: [door / Mara / both] broke after [last task].
Fix without adding new features. mo-farm-rpg.js only. Include smoke test above. No deploy.
```

---

## Deploy

Owner-only `/maestros/` — **auto-deploy after smoke pass** (`owner-only-auto-deploy`). Public sites (Halalit, Crocheter) only when owner says deploy.

---

## Handoff for a new agent (paste at top of chat)

```
Maestro's Odyssey — read maestrosOdyssey/MO-ROADMAP-AND-TODO.md.
Skip verdict — implement now unless blocked.

LIVE (?v=20260702): #1–3 café loop, cup, T sit, Mara intro, learning card + pay (#8–9).

DESIGN: natural language, no punishment — see "Design pillars" in this file. No flashcard UI.

FICTION: prepaid learning card; elder prologue #10 + day-8 report #28. Spanish = MXN pesos.
Menu: 4 drinks / 5 foods — one ES or AR lane at Dragon's Brew (see menu canon).
WEEK ONE (owner pinned): mellow room, not mystery; ES+AR bilingual café + attunement fade + tourism gate + emergency switch; peoples keep native key words; detective later.

NEXT BUILD ORDER: #10 prologue → #11 vocab (ES+AR café) → #27 order depth → #13 Monday mellow beat.

Do ONLY: [ONE task — e.g. MO task #12]

Owner-only — auto-deploy after smoke pass. No Halalit/Crocheter.
```

**Next tasks:** #10 prologue → #11 (ES+AR café) → #27 → #13 Monday mellow → … → #25 fade/gate → #28 elder report → #24 train. Detective (#21+) after train / later arc.
