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
- [x] **Day-8 balance tuning** — **superseded 2026-09-21:** leftover pesos OK; not forced to 0. See elder-before-buy below.

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
| **Add-ons** | Leche + azúcar day 1 (Spanish only). **con** taught Wednesday with **y**. Crema Saturday. Drink **frío** (iced) Sunday. Food **calentado** (warmed) from day 1. |
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
| **Day 8 (same weekday next week)** | **Elder first, then buy** (owner 2026-09-21) — leftover pesos OK; no café purchase until the report. Not a quiz. She asks for a **favorite drink and a favorite food**, the way the café says it, **with an add-on** (*café con leche*, *con azúcar*, *y leche*). |
| **Enough detail** | Elder: *“That sounds lovely, dear.”* → card **upgraded** → eligible for train when **week 3** arrives (#24). |
| **Wants more** | Elder: *“I love that place. Can you go back and find out more for me?”* → card **still upgraded**; **train waits** until a later elder check passes → café revisit (#29) to bring back what she asked for. **No** “barely visited” branch; **no** grading tone out loud. |
| **Under the hood** | Day 8 passes when the line has a drink, a food, *favorito/a*, and an add-on with *con* or *y*. No score spoken. A thin line sends them back; the table then says the shape out loud. |

---

## How to ask Cursor (read this first)

Say a **task number** (or a **safe pair**). Always start with **verdict first** unless you already approved that task.

**Paste prompts (owner — 2026-09-24):** When writing a prompt for another chat to build a Maestro’s change, include **go ahead and deploy immediately** after the check passes. Owner-only. Do not tell that chat to wait for a deploy yes.

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
| **O** | **Say goodbye to Mara + put dishes away** | Same café close-out. If owner asks for **either or both**, ship **both** in that chat. |

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

Needs **#3** and **#12**. **Tone:** nature-wonder café week — friendly regulars, species glimpses, language in context. **Not** mystery-novel infodumps. See **Your additions** (owner pinned 2026-06). **Pre-upgrade café plot uses people the current villager sheet can carry** (human, lizardfolk, crocodilian riverfolk, werewolf-as-person, vampire, Mara). **Pegasus, griffin, and other very detailed creatures wait** until after animation upgrades — do not placeholder them (owner 2026-09-22). **Minotaurs and the like** wait for the same reason. A **muted café TV** is a potential **post-upgrade** beat; before that it would look flat. Old detective / sea-policy beats in `DRAGONS-BREW-PRE-TRAIN.md` → **later arc**, not week one.

- [ ] **#13 — Monday** — warm room; Mara + wall + strike board; **friendly customers**. No café TV yet (that waits until after animation upgrades).
- [x] **#14 — Tuesday** — **daytime** table: werewolf fiancé + chaperone twin + vampire woman, all looking like people (werewolves **not transformed** — no wolf-form animation yet). Pale vampire tint. Strike board can still tick. **Not** a minotaur. Shipped 2026-09-22 (Tuesday only; gray / pale on the villager sheet). Mara teaches **y** this day (instead of *and*).
- [ ] **#15 — Wednesday** — **family night** human table; light species beat. Vampire usual now sits Tuesday with the couple (not a separate blue-night mystery). Mara teaches **con** this day (extras).
- [ ] **#16 — Thursday** — mellow Thursday room; **un / una** enter café talk. Evening **werewolf form** waits until animation upgrades. No centaur/detective overlap.
- [ ] **#17 — Friday** — mellow Friday regulars; **no** dragonfolk mafia beat in week one
- [ ] **#18 — Saturday** — mellow Saturday regulars the current sheet can carry. **Pegasus + griffin** wait until after animation upgrades (very detailed creatures; do not placeholder them).
- [ ] **#19 — Sunday** — quiet Sunday room; one soft species or language echo

---

### Later (#20–29)

- [ ] **#20 — Real order check** (optional hard mode — ES or AR lane; not default path; see Design pillars)
- [ ] **#21 — Goblin detective visual watch** — **post–train / later arc** (not week one)
- [ ] **#22 — Evening werewolf + vampire table** — daytime people shipped 2026-09-22 (Tuesday only, no wolf form). Transformed Thu+ evenings still wait on animation.
- [ ] **#23 — Plaza floor** (same learning card rules; echo café words on signs)
- [ ] **#24 — Train gate / arrive at station** (after #28 elder upgrade) — **end of the demo** when this plot deploys. Wider world after. Non-humanoid **animation upgrades** wait until after this ships. Mechanics still rank above that animation work.
- [ ] **#25 — Wire vocab into progress tracker** (familiarity bands, **bilingual menu fade**, **tourism competence gate**, elder prompt source, subtitle fade — no grade UI)
- [x] **#26 — Menu unlock schedule** — visit 1: 3 drinks + 2 foods; day 2: espresso + croissant; foods through day 4 per **generic menu canon**; chalkboard “new today” ticks
- [ ] **#27 — Day-2+ order depth** — player extras shipped. Still later: *For your té — con azúcar or sin azúcar?*; same-or-different; one food upsell; Mara read-back before pay; no new specialty drinks
- [x] **#28 — Day-8 elder report** — fiction week 2 + language week goal; natural report conversation (not quiz UI); two elder lines only; card upgrade; revisit flag when under hood pass
- [ ] **#29 — Café revisit quest** — when #28 “go back and find out more” branch; player brings back one asked detail; train opens after elder pass (≥80% under hood)

**Build order note:** #12 days → #26 unlocks → #27 order depth → #13–19 plot → #25 tracker (can start earlier for elder) → #28 → #24.

---

## Prologue fiction (canon — for agents)

Community elder → **prepaid learning card** (debit, in-game only, **no overdraft**). Spanish → **MXN**. **#10** elder scene → **#9** first spend at Dragon’s Brew. Elder frames it as **about one week** of neighborhood meals — foreshadows **#28** refill on day 8. Until #10 ships, **#8 stub balance** is OK.

---

## Your additions (decisions)

### zij2d Godot pull (owner — 2026-09-13 / 2026-09-15)

- [x] **Old Phaser café snapshotted** — `archive/phaser-cafe-prototype/` (full `www/` copy).
- [x] **New Godot build started** — `maestrosOdyssey/2d/` (zij2d engine + authored Dragon's Brew world). Live `/maestros/` is the Godot web export. Phaser snapshot: `archive/phaser-cafe-prototype/`.
- [x] **Mara typed order (gold, 2026-09-21)** — menu first, type box, Spanish echo, visible cup/muffin. Sit and **D** sip / **F** eat. Do not drop; see `.cursor/rules/maestros-mara-order-gold.mdc`. **2026-09-22:** if anyone is seated, the cup waits at the counter until those talks finish.
- [x] **Learning-card HUD (gold, 2026-09-21)** — hearts off; take the card from the elder's basket; then weekday / week / pesos as three short lines. Matched orders deduct pesos in the same reply; **finished meal + step into your house** turns the weekday. See `.cursor/rules/maestros-learning-card-hud-gold.mdc`.
- [x] **Drink extras + warmed food (2026-09-22)** — *leche* / *azúcar* from Monday (Spanish only); *crema* Saturday; drink *frío* Sunday; food *calentado* optional. Still one drink + one food, ready in the same reply. #27 Mara *con o sin* prompt and food upsell still later.
  - **Week-one connector schedule (owner — 2026-09-23):** **Tuesday = y** (instead of *and*). **Wednesday = con** (extras). **Thursday = un / una**. Live build still taught **y** and **con** together on Wednesday — retarget when that ships.

#### Future Godot adaptations (combined — 2026-09-21)

This chat’s later list **plus** original MO items **not in the Godot build yet**. Master task numbers still live above. Phaser-only gold (lane picker, Arabic wall) counts as **not in Godot** until it is.

**When listing open todos (owner — 2026-09-22, priority later that night):** Show **only items not done**. For **pre-animation-upgrades**, list **plot**, then **mechanics**, then **look you can do on the current sprites**. Do not drop the rest when naming a priority.

**Next to deploy (owner — 2026-09-22; connectors 2026-09-23; bump shipped 2026-09-23):** Plot first: **human table**, then week-one language by day — **Tue y**, **Wed con**, **Thu un / una**. Mechanics first: **read the board**, then the **strike board**. Everything else stays on the list under that.

Demo ending = arrive at the train station (#24). **Pegasus, griffin, and other very detailed creatures** are **post-upgrade**, same as minotaurs — do not placeholder them. A **soft café TV** is a potential **post-upgrade** item; anything earlier would look flat. Mechanics still rank above the big animation work.

**From this conversation**

- [x] **Don’t walk through people or things** (owner — 2026-09-22; slip-past 2026-09-23; shipped 2026-09-23) — bump into NPCs, furniture, counters, crates, and walls. **People:** a tap bumps; holding slides you around their side. You do not walk through them. A crowd cannot trap you. **Furniture and walls** stay solid. Feet-sized collision so sprites can overlap a little. Café door-to-counter walk stays open.

- [x] **Café house-rules sign layout (2026-09-21)** — “we don’t serve human blood / smoking isn’t allowed” (etc.) is a run-on in the **thin top rectangle**; the **bigger bottom rectangle** is empty. Put the copy in the space that can hold it.
- [ ] **Something between sip/eat and day’s end** — food/drink alone feels too thin; **not** high-fantasy storyline events. Exact beat TBD. Direction: **overheard table talk** that continues/changes — **lizardfolk + merfolk** (and the Monday croc/ferry table) plus **more people talking in the room**. Pull from earlier notes in `docs/DRAGONS-BREW-PRE-TRAIN.md` and week-one mellow room **#13–19**; keep it slice-of-life, not mystery.
- [x] **Player house (first cottage, 2026-09-21)** — plank floor; table, bench, **closed crate back-right**, barrel. No campfire/fireplace (pack’s “fireplace” is a campfire — removed from home + café + random house fill). Night pass is stepping inside after a finished café meal — no bed.
- [x] **Night pass when you step into your house** (owner locked 2026-09-21) — **not** a bed / hay stand-in. After café: you must have **ordered and consumed** (sip/eat done). Then **enter your house** → short **night passes** beat → **weekday turns** → morning. Do **not** turn the day on café leave anymore for this path (or gate café-leave day-tick so home is what ends the day after a completed meal). No lie-down animation required.
- [ ] **Have to read the board to order** — you already must tap the menu once, but Mara then lists today’s items in chat (`What's your order? (café, té, muffin…)`), so you can skip the wall after that. Stop spoon-feeding the day’s words in her prompt; the player should **check the menu** for practice. Keep the type box and same-reply drink.
- [ ] **Accent letters in the type box** (owner — 2026-09-22) — press-and-hold **any** letter that has accents (E is only an example) shows the usual picker (é / á / ñ / ü…), but you **cannot click or select** it. The box keeps repeating the base letter (`eeeee`, `aaaaa`, …) instead. Make the pick land in the box (café, té, azúcar). Same box for Mara and the elder.
- [x] **Only the key on the prompt does that action** — **T** talk / close a line. **E** doors (basket and dish cart stay on **E**). **R** menu and house rules. **S** sit / stand, and **S** still walks down when you are not at a chair. **D** sip only (no stand). **F** eat. **Space** is not a second interact. Order type box still uses **Enter**.
- [x] **P is pick or place** (owner — 2026-09-24) — **mechanics.** One key, the word depends on where you are. **P — Pick** at a berry bush, and **P — Pick** / **P — Place** at the open home crate. In the order type box, P is just the letter. It does not walk, talk, open doors, sit, sip, eat, or chop. Shipped 2026-09-24.
- [x] **Elder test has a clear language aim** (2026-09-22) — still not a quiz screen. She asks for a favorite drink and a favorite food, with an add-on (*con leche*, *con azúcar*, *y leche*). Tue–Sun café neighbors say that shape with a different board item each day.
- [ ] **Journal for Spanish phrases** (owner — 2026-09-22) — not a word list. Each overheard sentence stays in the journal with that day’s food or drink, so progress is something you can open and try saying. Basic, and a bit more interesting than a list. Not built yet.
- [ ] **Week one connectors by day** (owner — 2026-09-23) — **Tuesday: y** (instead of *and*). **Wednesday: con** (extras like *con leche*). **Thursday: un / una** (one / a, with gender). Monday can still be “a café” / “a té.” Not a flashcard. After the **train station**, more numbers than un/una (dos, tres, …). Live build still joins **y** and **con** on Wednesday — retarget when this ships.
- [x] **Home crate and the bottom boxes** (owner — 2026-09-23; stacks 2026-09-23; hotbar 2026-09-23; shape 2026-09-24) — Two sets of boxes, both with a small picture and the real count. **Bottom row:** what you are carrying, on screen once the learning card is out. **Look:** the same drawn panels as the talk box and the task list — dark warm fill, dull gold edge, cream number. Pictures are berry dots and a little log. The chosen box is a brighter gold edge. The row stays in the bottom band so it does not cover “T — Talk.” One box per kind. The bottom row starts as two pockets. Empty pockets stay. The café cup and plate stay the meal. **Crate:** the closed box in the house. **E** opens storage boxes; **E** closes them. **P — Place** / **P — Pick** move the chosen stack, and the same kind adds together. No sack or basket in the boxes. Counts stay when you enter a house or the café. Shipped 2026-09-24. The learning card was pesos-only here; the card object is the next bullet.
- [x] **Learning card in a slot** (owner — 2026-09-24) — Taking it from the basket puts a **card-shaped** picture in one bottom slot. Same proportions as a credit card, small enough for the slot. **Not** a bank card: no blue, no silver, no chip, no stripe, no real brand. Warm game colors and a simple mark so it reads as this neighborhood’s learning card. Pesos stay the top-left line. One card, no stack count. **P — Place** does not move it into the crate. Shipped 2026-09-24.
- [x] **Furniture stop floating** — tables stay full size (bigger than the chairs). The two café neighbors stand on opposite sides of their table again. People draw in front of their own face, so a table no longer sits on their head.
- [x] **Tutorial directions / compass** (2026-09-22) — start in front of your cottage; a small arrow points to the next stop (elder → basket → café → home after the meal). Not a minimap.
- [ ] **Arrow waits on the elder** (owner — 2026-09-23) — **mechanics.** The compass does **not** point at the card basket until you have finished hearing the elder out (her last line that morning). Meeting her once is not enough.
- [x] **Week one wood day is Saturday** (owner — 2026-09-23) — Monday through Friday and Sunday stay café mornings. Saturday of week one is the one forest cut, sack, and campfire. No second cut or second fire that week. Shipped 2026-09-23.
- [x] **Sack and the campfire behind home** (owner — 2026-09-23) — On the wood day you start with the sack. After the cut, the wood stays in it. Behind the house: unlit stone ring, then the pack’s animated campfire. Outdoor only. Shipped 2026-09-23.
- [x] **Mara’s chilly night** (owner — 2026-09-23) — Saturday only, after she nods at goodbye: it is chilly tonight, which is why you light the fire at home. Does not block the order. Shipped 2026-09-23.
- [x] **Menu reads MENU from afar** (owner — 2026-09-23) — standing chalkboard on the menu spot with **MENU** readable before **R**; full list still opens on **R**. House rules and outdoor signs unchanged.
- [ ] **Café service counter for Mara** (owner — 2026-09-23) — drawn long wooden counter (café, not liquor bar). No bottle shelf. Invented like the cup if no pack counter exists.
- [ ] **Stepping-stone paths on grass** (owner — 2026-09-23) — open ground is **grass**. Real walkways are **invented stepping stones** on that grass (natural, not sidewalk). No big dirt rectangles. No road-tile strip for village paths.
- [x] **Blueberry bushes** (owner — 2026-09-23; size and Tuesday 2026-09-24) — **pre-animation-upgrade, before the train station.** Fuller shrubs already in the pack (about as wide as a person, about half as tall as the trees). Small blue dots sit in the leaves. A few of those in the forest are the patch. Tiny edge tufts stay ground cover. **Tuesday morning**, after you leave the house, the first job is the forest: **P** picks the berries into the bottom count. No sack on screen. The café, including **y**, still happens after. Not week-one wood day. Shipped 2026-09-24.
- [ ] **Sugarplum juice + sugarplum tree** (owner — 2026-09-23) — **pre-animation-upgrade, before the train station.** Drop **espresso** from Dragon’s Brew; that slot becomes **sugarplum juice** (Spanish lemma TBD with owner). Invent a **sugarplum tree** next to the café (same invent style as cup / blueberries). Mara or another waitress picks sugarplums there for the menu — a visible café beat, not a mystery dump. Keep café / té / chocolate; do not bring espresso back. **Once only** in this pre-upgrade stretch (same rule as golden apple pie).
- [ ] **Sugarplum sparkles** (owner — 2026-09-23) — On the day you order sugarplum juice, after you **finish drinking** it, purple sparkles appear around the player. Small blinking dots that move with you (invented, like the cup). A sparkle, not a light that reveals the forest. Café, té, and chocolate stay repeatable; the specials do not.
- [ ] **Golden apple tree by the elder** (owner — 2026-09-23; pie locked 2026-09-23) — **pre-animation-upgrade, before the train station.** The house right next to the elder **is** her house. Invent a **golden apple tree** beside it. Fruit is actually golden and edible. Menu: **golden apple pie** instead of **galleta** / cookies (not tarts). Unlocks **week-one Saturday**. **Once only** in this pre-upgrade stretch (same rule as sugarplum juice). Spanish lemma TBD.
- [ ] **Week-one Saturday: pie, then Mara’s deadwood ask** (owner — 2026-09-23) — After you finish the golden apple pie, put the dishes away, then Mara asks you to bring her some **deadwood** while you are out getting firewood for your house. A whole dead tree (even leaving the stump) is more than your house needs; the extra is for her. She is the one who tells you to **only chop dead trees** (or deadfall: logs, fallen branches). Why waits: later, **dryads live in the living trees**, so only dead wood is safe. Do not dump the dryad reveal on Saturday — advice only that day. Once-a-week wood day can be this Saturday if it fits the already-shipped loop; do not make wood every day.
- [ ] **Pie light: a small pool at your feet** (owner — 2026-09-23) — After the golden apple pie, you are your own light because the lamp posts are out (the people who tend them ran out of wood). A **small pool** moves with you, around your feet, on the walk home and in the forest. You can see the ground and trees inside that circle. The rest of the forest stays dark. It does not light the whole woods. Same idea on the street. Windows can still glow from indoors. The lamp posts themselves stay dark that night.
- [x] **Leave-café close-out (paired — shipped 2026-09-22)** — after the cup and plate are finished, put them in the dish cart by the counter. Mara says **adiós** (Wednesday: **buenas noches**) and you type it back before the doorway lets you out. The door tiles stay put. Morning still comes when you step into your house.
  - **Dishes vs the street (locked):** you **cannot** leave the café, walk the block, or end the day still holding dishes. Empty cup/plate stay in hand **inside** until the cart. Mara stops you at the door. You will not wander outside with them until you come back.
- [x] **Talk to every café customer before you leave** (owner — 2026-09-22) — after you order, an **arrow** points at the next person seated. The food stays at the counter until you have heard everyone's last line that day. Three seconds after you close that line, Mara says it is ready. Walk back and press **T**. The door waits until the food is in your hands. Not a quiz.
- [x] **Tables don’t block the café entrance** (owner — 2026-09-22) — Tuesday’s extra table sits on the left. The middle walk from the door to the counter stays open every day.
- [ ] **Face each other when talking** (owner — 2026-09-22; player added 2026-09-23) — **mechanics.** The NPC turns toward you, and you turn toward them, for the conversation.
- [ ] **No close until they finish talking** (owner — 2026-09-23) — **mechanics.** You do **not** get a discussion close (e.g. **T**) until that person has finished all their lines for this talk. Elder has four or five boxes — you cannot close after the first. Same rule for **every NPC**, not only the elder.
- [ ] **Stand between table and seat on S** (owner — 2026-09-23) — **mechanics.** When you press **S** facing a table, you stand in the gap between the table and the seat. Even if a real sit pose is unfinished, the chair must **not** draw above your head.
- [ ] **Mara reads Bombay-black, evenly** (owner — 2026-09-22) — pin only. On screen she is dark brown, and not the same brown all over. She is not black at all.
- [ ] **Merfolk read blue** (owner — 2026-09-22) — pin only. The Monday riverfolk is a crocodilian, their own people, not a merfolk subtype, so they do not take the merfolk blue. Actual merfolk still need to be blue.

**From original MO — not in Godot yet**

- [ ] **#13–19 week-one mellow room** — rotating regulars the current sheet can carry, species + language in small beats, not mystery. Monday iguana + crocodilian riverfolk are **seated at a café table** with ferry talk (2026-09-22). Tuesday werewolf fiancé (male) + sister + female vampire sit as people (2026-09-22); no wolf form. You already have to hear everyone before the food comes (2026-09-22). The door-to-counter walk stays open (2026-09-22). Still open: human table, then Thu–Sun mellow rooms. **No pegasus, griffin, minotaur, or other very detailed creatures until after animation upgrades.** No café TV until then. Keep the favorite-drink / favorite-food / add-on lines.
- [ ] **#22 evening werewolf + vampire table** — **daytime people shipped 2026-09-22** (Tuesday only, no wolf form). Transformed evening table still waits on animation.
- [ ] **#27 day-2+ order depth** — player extras shipped (con / calentado / frío). Still later: Mara *con o sin* prompt, one food upsell, read-back before pay.
- [ ] **#11 café lane + tourist money** — Spanish **or** Arabic menu lemmas; Arabic wall translit + script + English; dirham when Arabic. **Lane picker** at first load / restart (Phaser had it; Godot does not).
- [ ] **#25 vocab tracker** — private familiarity bands, menu-hint fade, tourism gate, elder prompts. No grade UI. Optional later in-game lane switch.
- [ ] **#20 optional hard mode** — stricter typed order check; opt-in only.
- [x] **Must order a drink and a food** (2026-09-22) — each café day; quiz only when no pair fits the card.
- [ ] **Day-8 elder-before-buy** — leftover pesos on day 8 are **OK**. You **cannot buy anything** on day 8 until you talk to the elder first; then she can refill. Mara turns you toward the elder if you try to order first.
- [ ] **#29 café revisit** — when the elder asks you to go back and find out more; bring one asked detail.
- [ ] **#24 train gate / arrive at station** — week 3 if elder pass; otherwise more neighborhood time. No fail screen. **This arrival is the demo ending** when it deploys.
- [ ] **#23 plaza** — same learning-card rules; echo café words on signs.
- [ ] **#21 goblin detective watch** — post-train / later arc, not week one. Detective / mafia / sea-policy plot stays later.
- [ ] **Player-frame language + Mara tail** — UI/chat in the language you already speak; Irish / Japanese / Turkish locked until the train. Mara tail overlay still later.
- [ ] **Revise `DRAGONS-BREW-PRE-TRAIN.md`** when owner asks — old week-one detective/sea table → later-arc section; align with #13–19. Pegasus, griffin, and other very detailed creatures are **post-upgrade**, not week-one placeholders.

### After demo — elder as ambassador (owner — pinned 2026-09-22)

- [ ] **Elder is a human ambassador** to supernatural peoples, after the train-station demo ending. The player is **her apprentice** — that is why she granted the learning card and the café week. She is training you to take her place because she cannot travel as much; her work now is the next generation, and keeping good terms with this county / city / suburbia. Not week one. Not a lecture on day one.

### After demo — non-humanoid animation (owner — pinned 2026-09-22, corrected same day)

**Demo ending:** arriving at the **train station** (#24). Do not spend the demo on non-humanoid **body animation** — owner does not have that art yet.

**Plot waits for very detailed creatures:** pegasus, griffin, minotaurs, and anyone else the villager sheet cannot carry. Do not placeholder them. Their café beats ship after the animation upgrades.

- [ ] **Soft café TV** (owner — 2026-09-22) — potential **post-upgrade** only. A muted headline for soft world color, not a crime blotter. Before the animation upgrades it would look flat.
- [x] **Outdoor day / night look (2026-09-23)** — night falls while you are in Dragon's Brew; street cools and dims; lamp pools + warm window/door glow in the dark rectangles. Morning fades back after night pass. **Richer glass** (sun on daytime windows; moon/stars at night) stays **post-upgrade** — see below.
- [ ] **More realistic house windows** (owner — 2026-09-23) — **post-upgrade** only. Daytime glass can catch sun; nighttime glass can catch moon and stars, or richer indoor light. Until then, night uses a simple indoor glow in the dark window rectangles.
- [ ] **Animation upgrades after train-station plot deploys** — pegasus, griffin, centaur, **minotaur horns / similar add-on pieces**, and other bodies that the villager sheet cannot carry (walk, idle, sit).
- [ ] **Minotaur as a real regular** — pleasant morning café / dairy-world beat (was Tuesday #14). Ships after horns look right; not a week-one placeholder.
- [ ] **Café pegasus + griffin** — Saturday regulars and later café beats, after their bodies exist. Plot waits on this.
- [ ] **Pegasus platform agent** — waits until the pegasus body exists. Do not put a placeholder on the platform for the demo.
- [ ] **Griffin interpreter + pegasus sky-sign / SL animation** — full teaching/animation TBD (`WORLD-AND-CAST.md`); after demo.
- [ ] **Other non-humanoid bodies** (giants’ scale, legendary dragons/wyverns, animal-level life) — animation later; legendary stay later in plot too.
- [ ] **Basket holding** (owner — 2026-09-23) — **post-upgrade** only. The player actually holds a basket in their hands (berry picking and the like). Before that, berries and other goods sit in the bottom inventory boxes and the home crate. Do not fake a held basket on the current sheet.

### Week-one tone + café language (owner — pinned 2026-06)

### Week-one tone + café language (owner — pinned 2026-06)

- [ ] **Week one = mellow, not mystery** — nature-wonder vibe at Dragon’s Brew: warm room, friendly fellow customers, species lore in small beats. **Detective / goblin / centaur / mafia / sea-policy infodumps → later in game**, not the first in-game week. The muted café TV is post-upgrade, not a week-one stand-in.
- [ ] **Week one teaches species + language basics** — fictional peoples get **key words/concepts in their native tongues** (stable; does not fade). **Café menu = one lane** (Spanish **or** Arabic — player picks at start / restart). **Culture keywords stay native** even when the café lane is Spanish.
- [ ] **Player frame language** — UI + Mara’s chat frame use whatever language the player already speaks in practice (not forever locked; reduces overwhelm). Irish / Japanese / Turkish / other region lanes stay **locked until train / wider world** — not a day-one pile.
- [x] **Café lane picker** — popup at first load and after Restart; wall = one target language + English gloss (not ES+AR+EN side by side).
- [ ] **Optional lane switch (#25)** — in-game switch to other café language later; dual-label fade / tourism gate deferred.
- [ ] **Revise `DRAGONS-BREW-PRE-TRAIN.md`** when owner asks — move old week-one detective/sea table to a **later-arc** section; align week table with #13–19 above.

- [ ] **Starting balance / day-8 depletion** — **superseded 2026-09-21:** leftover OK; day 8 **elder-before-buy** (see Future Godot adaptations). Old “land at 0” goal dropped.

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
  | sugar / milk / creamer | 0 | included |

  **Sample orders:** café + muffin **63 pesos** · té + tostada **52 pesos** · espresso + galleta **64 pesos**.

  **On menu:** `café — 35 pesos` — never bare `$40` without “pesos”.

### Elder report + Mara echo + train (owner — pinned 2026-06)

- [x] **Mara order echo — week 1** — repeat matched items in **native café script** (e.g. `qahwa` → `قهوة`), not the player’s romanization or English.
- [x] **Mara order echo — week 2+** — basic joined phrase in the active lane (e.g. `قهوة وشاي`, `café y té`); not full free-form sentences week one.
- [x] **Day-8 elder report (#28)** — natural conversation, not a quiz UI. Pass → *“That sounds lovely, dear.”* **Not yet** → *“I love that place. Can you go back and find out more for me?”* Player never sees a score. The line needs a **favorite drink, a favorite food, and an add-on** (*con leche*, *con azúcar*, *y leche*). **Language week goal** (3+ distinct orders) gates the call — not balance = 0.
- [ ] **Week 3 train (#24)** — station opens when fiction week 3 starts **if** elder pass; otherwise more neighborhood time (#29 revisit) until pass — no fail screen, no lost progress.

---

## Quick reference — live `/maestros/`

| Works | Not built |
|-------|-----------|
| Visit + cup + sit + dine + Mara intro + learning card + pay (#8–9) + drink extras | Mellow week-one room (#13+), bilingual fade + gate (#25), leftover #27 (con o sin / upsell / read-back) |
| Prologue elder + card grant (#10) + day-8 elder report (#28) | Café revisit (#29), train (#24), detective arc (later) |
| Doors + collision foundation + café space + fiction days (#12) + menu unlocks (#26) + cottage waypoint arrow + tables not on heads | Bilingual ES+AR wall (#11), plaza (#23), train (#24), don’t-walk-through people/things |
| MXN menu prices (#7) + required drink+food pair | Elder-before-buy on day 8 |

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
