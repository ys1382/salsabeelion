# LoreKeeper — roadmap & todo

**Planning doc only** — not deployed unless you say deploy.

**Capabilities:** `ODDTROVE-CAPABILITIES.md`  
**Product rules:** `.cursor/rules/lorekeeper-project.mdc`

---

## Owner account

- **Owner email:** `nightofhonour@gmail.com` (via `ODDTROVE_LOREKEEPER_OWNER_EMAIL` on the server; override only if you change it on purpose).

---

## Shipped (v0)

- [x] Owner nginx gate + hub Owner sites link
- [x] Sign-in required; notes on server per account
- [x] Entry types, search, export/import JSON
- [x] **Find in your writing** — plain home search across documents + notes (not Ask / not AI); opens the matching note or doc
- [x] Documents with pages — new doc, add pages, auto-save, continue where you left off
- [x] Owner’s Office — accounts, sign-up switch, private feedback (no other writers’ note text)
- [x] Junk / throwaway email recommended on sign-up (Halalit-style copy)
- [x] Google login for new accounts (Jul 2026) — spare/junk Google encouraged; legacy password sign-in kept
- [x] Idea spinner — user-filled word banks, private nudge prompts (`spinner.html`)
- [x] Home writer tools tabs — Ask · Idea spinner · Word help (Halalit-style); `spinner.html` redirects to `#spinner`
- [x] **Site tabs on home** — Stories · Find · Idea spinner · Word help · Feedback (top-level like Halalit; Ask stays on Stories; Find is its own full tab with matching results)

---

## Not yet (product — do last)

- [x] Recall / sort assist on the writer’s own words (librarian only — no generated lore) — **v0 shipped; major upgrades: items 7–18 below**

*Notifications are **#23–24**; **public launch is #25 — last on the list.** Do phase 6 only after editor + recall are solid.*

---

## Suggested build order

**Goal:** least breakage — layout shell first, recall brain before Ask-in-doc, one long-press design before Quill gestures, fonts isolated, **public launch absolutely last (#25).**

| Phase | What | Why |
|-------|------|-----|
| **1** | Collapsible doc sidebar | Layout pattern for everything else; minimal Quill risk |
| **2** | Fonts + quick notes in doc | Isolated from recall/Quill; can parallel phase 3 |
| **3** | Recall reliability → draft → compose → brief/full → advanced inference | Bake on **home Ask** before doc Ask |
| **4** | Ask in document editor | Needs phase 1 shell + phase 3 trust |
| **5** | Long-press (typo jump, then lore) | Highest Quill interaction risk — one gesture policy first |
| **6** | Notifications (#23–24), then **public launch (#25)** | Unrelated to editor refactor; launch last so nothing else depends on it |

**Avoid:** Ask in doc before recall is trustworthy · long-press before collapse/gesture design · **public launch (#25) before everything above is solid**.

**Parallel OK:** Phase 2 (fonts, quick notes) alongside phase 3 (recall backend).

---

## Build todo (in order)

**Goal (recall):** Cursor/ChatGPT-like **comprehension and composition** over the writer’s own account — but **no third-party model**, no authorship. Like a **story agent** or **Wikipedia-shaped summary**, not the author and not a dictionary.

**Non-negotiables (same as product rules):** librarian only; never invent canon; every claim traceable to notes or draft; sources available; never worse than opening the raw notes.

### Phase 1 — Doc layout shell

- [x] **1. Collapsible doc sidebar (Safari favorites-bar style)** — the existing left panel (`docTitle`, work title, page setup, font, save status, spell flags, delete, etc.) **collapse and expand** — tuck away so the writing surface isn’t always split; thin strip or toggle to reopen. Remember open/closed in `localStorage`. *Pattern for later panels (Ask, quick note).*

### Phase 2 — Isolated (low break risk; parallel with phase 3)

**Document fonts (category coverage, not clones)** — today: ~20 system + ~70 self-hosted (`lk-font-catalog.js`, `scripts/fetch-doc-fonts.sh`); build-time fetch, no Google at write time.

**Font goal:** one strong pick per semi-category (swirly e.g. Elsie Swash Caps, formal e.g. Times New Roman, basic e.g. Arial, dramatic e.g. Grenze Gotisch) — breadth without near-duplicates (~40–100 voices is realistic).

- [x] **2. Font category map + gaps** — semi-categories (basic sans, formal serif, script/swash, blackletter, mono, etc.); audit catalog; add one hosted face (or system fallback) per missing role.
- [x] **3. Font de-dupe rule** — skip new fonts that duplicate an existing job; prefer distinct *voice* over count.
- [x] **4. Font picker UX** — group/filter by semi-category + search.
- [x] **5. Font honest gaps** — proprietary Docs names (Calibri/Cambria files) stay fallbacks; label in picker when it isn’t the real file.
- [ ] *(optional later)* **Lazy/on-demand woff2** — only if curated set grows large; not required for category-first goal.

- [x] **6. Quick notes from the document (not inline comments)** — compact **“New note”** panel on `doc.html` (tab/dropdown in tuck-away shell from #1). **Not** the full notes list; **not** Google Docs–style comments on the page. Same account store as home; pre-fill **work title** (+ optional link to current doc). Home list unchanged.

### Phase 3 — Recall backend (test on home Ask first)

**Reliability bar** — treat as gates throughout; must pass before phase 4.

- [x] **7. Three honest states** — nothing saved (in author’s head only) · fragments only · enough for a solid summary — distinct copy for each.
- [x] **8. No false empty** — if it’s in a note, relationship entry, or draft page, surface it.
- [x] **9. No false full** — no confident answers from wrong work, wrong character, or one stray keyword.
- [x] **10. No bad synthesis** — if composition is worse than raw notes, show less or say “too scattered to summarize cleanly yet.”

- [x] **11. Draft-aware** — long documents + scattered notes; extract/connect from draft prose, not just short entries.
- [x] **12. Wikipedia-shaped answers** — coherent paragraph(s) when warranted; not bullets or semicolon telegrams; length scales with material.
- [x] **13. Reference voice** — for “who is / summarize / political situation”: facts about the work (“Character A is the protagonist…”), **not** “you wrote…” unless the question is **coverage** (“what have I done with A so far?”).
- [x] **14. Standard cast roles when supported** — protagonist, antagonist, side character, etc.; writer’s words first; viewpoint-only wording only when role isn’t established.
- [x] **15. Shared backend: `brief` vs `full` modes** — one pipeline; full for Ask; ultra-short for press-and-hold lore (#19).
- [x] **16. Supported inference (“logic puzzle”)** — e.g. “brother” in dialogue when nothing contradicts; POV from draft; cross-link species/world notes when tied in. Never fill gaps or smooth contradictions into false canon.
- [x] **17. Complex / shifting topics** — politics, factions, changing alliances: phased situation summary; what’s settled vs not written yet.
- [x] **18. Reference / allusion reading (evidence-only)** — known tale/source ties when notes or in-text references support it; never attribute roots without evidence in the account.

### Phase 4 — Ask in document

- [x] **19. Ask LoreKeeper in the document editor** — collapsible sidebar on `doc.html` (closed by default); default scope **this document / this work**; uses phase 3 recall. Home Ask can remain until stable, then move or duplicate.

### Phase 5 — Quill long-press (do after editor is stable)

- [x] **20. Long-press gesture policy** — one design for Quill: e.g. hold on **spell-flagged** word → typo jump (#21); hold on **non-flagged** word → lore brief (#22); don’t fight selection/spell marks.
- [x] **21. Press-and-hold typo → jump to occurrences** — scroll/highlight each instance in this doc. **Skip** personal dictionary (**My spelling words**).
- [x] **22. Press-and-hold word lookup (Libby/Kindle-style)** — **1–2 sentences**, work-scoped, reference gloss from writer’s notes; `brief` mode (#15); sources on tap; not a dictionary, not all matching notes.

### Phase 6 — Product (when editor + recall are solid)

- [x] **23. Optional notifications** — opt-in prefs saved; export reminder + product updates toggles; **mail not sent yet** (no SMTP on VPS).
- [x] **24. Per-account notification preferences UI** — on `account.html` (#23 prefs API shipped).
- [x] **25. Public launch — last** — checklist in `PUBLIC-LAUNCH.md` + Owner's Office section; **nginx gate removal is manual** when you say go.

---

## Full plan checklist — storage + Ask recall (plan later)

**Two goals:**

1. **Storage** — trust that notes and documents stay saved (Docs-class is optional long-term).
2. **Ask LoreKeeper** — answer **any question whose answer exists in your account**, and **only what the question asks** (no infodump).

**Today:** Storage is v0 (auto-save, export JSON, 5 doc snapshots). Ask shipped phases **#7–22** (honest material states, work/doc scope, who/topic/coverage routes, brief mode, optional RAG when enabled on server). **Not 100%** — fallback questions, broad “tell me about” phrasing, and unsaved drafts still cause misses or over-answers.

**Use for plan commands** — e.g. *“Run LoreKeeper full checklist Tier A”* · *“Plan Ask recall items 33–40”* · *“Implement storage items 26–32”*.

**Ask quality playbook (owner process):** [LOREKEEPER-ASK-QUALITY-PLAYBOOK.md](LOREKEEPER-ASK-QUALITY-PLAYBOOK.md) — short Office reference + corrections loop (Tier A checkboxes retired). Spot-check Run UI deferred. Phases 5–6 deferred per owner.

---

### Part 1 — Storage

#### Tier A — Good enough for daily writing (you check; no code)

Run on your owner account. Check when true for **two weeks**:

- [ ] **Save line** — Doc sidebar shows **Saved** (not “not synced to account yet”).
- [ ] **Refresh** — Hard refresh; last edits still there (notes + documents).
- [ ] **Second device** — Same account elsewhere shows same content after save.
- [ ] **Tab close** — Reopen doc; nothing important lost (or restore backup works).
- [ ] **Export spot-check** — Home export JSON matches what you expect.
- [ ] **Deploy blip** — After deploy, sign in; nothing missing.

**When all checked:** storage OK for solo owner use. Keep exporting JSON occasionally.

#### Tier B — Before public launch (#25) — build / infra

- [x] **26. Automated off-server backups** — Scheduled copy of `lorekeeper-store.json` off VPS; documented restore; no draft content in git.
- [x] **27. Save failure is obvious** — Failed sync visible + retry; no false “Saved”.
- [x] **28. Multi-tab / multi-device policy** — Two sessions editing same doc: defined behavior + UI copy.
- [x] **29. Richer document history** — Beyond 5 snapshots (browse/restore versions).
- [x] **30. Recovery drill** — Restore store from backup once; accounts + docs recover cleanly.
- [x] **31. Account delete + export** — export-before-delete on `account.html`; `POST /auth/delete-account`; owner account protected.
- [x] **32. Storage meta in Owner’s Office (optional)** — Last sync / backup age / export reminder — meta only.
- [x] **Note restore backups (2026-08-10)** — Per-note snapshots like documents (`lorekeeper_note_backups_v1`); Restore last backup on home note editor.

#### Tier C — Google Docs parity (out of scope for v1)

- [ ] Geo-redundant DB · real-time co-editing · full revision timeline · offline merge · enterprise SLA

---

### Part 2 — Ask LoreKeeper recall

**What “good” means here**

| You want | Meaning |
|----------|---------|
| **Finds what exists** | If the fact is in a saved note or document (this account), Ask surfaces it — not “nothing saved” when it’s there. |
| **Stays on question** | Narrow question → narrow answer. No full character bible when you asked only about one relationship. |
| **Honest when it can’t** | “Too scattered”, “fragments only”, or “nothing saved” — not invented filler. |

**Already shipped (don’t rebuild)** — roadmap **#7–22**: three material states, work filter, doc Ask scope, who/topic/coverage routing, Wikipedia-shaped compose, brief mode, situation/allusion/inference (evidence-only), owner **Ask recall corrections** in Owner’s Office.

#### Tier A — What you can do without code (content + habits)

These fix a **surprising amount** of “misses” and infodumps:

- [ ] **Save before Ask** — Wait for **Saved** in doc editor (or home after notes) before asking; Ask uses server copy.
- [ ] **Name the work** — Include work title in the question (*“In Smoke and Mirrors, who is …”*) or use **doc Ask** with scope set to this work/document.
- [ ] **Tag notes** — Work title / character tags on notes so scope filters match.
- [ ] **Ask narrowly** — One facet per question (*“What is A’s role in the northern faction?”* not *“Tell me everything about A”* unless you want coverage).
- [ ] **Use coverage wording only when you want breadth** — *“What have I done with A?”* / *“Summarize A”* intentionally pulls wider material (#13 coverage route).
- [ ] **Log failures in Owner’s Office** — **It got this wrong** after a bad answer; review list before a recall fix session in Cursor.

**When Tier A habits are solid:** many “bugs” are actually scope or phrasing — not missing engine.

#### Tier B — On-account completeness (build; mostly local pipeline + tests)

Goal: **if it’s saved and the question is clear, find it.**

- [x] **33. Regression pack from your corrections** — `tests/fixtures/ask_regression_cases.json` + `test_ask_regression.py`; Owner’s Office **Download regression stubs**; merge with synthetic entries before enabling.
- [x] **34. Save-then-ask guarantee** — Doc/home Ask always flushes account storage before `/recall/ask` (doc Ask already tries; verify home notes path).
- [x] **35. Stronger work disambiguation** — When question omits work but several projects match, ask which work (or pick from doc scope) — don’t silently merge works.
- [x] **36. Fallback route upgrade** — `fallback` today can feel keyword-ish; prefer best excerpt or “be more specific” instead of weak rank dump.
- [x] **37. Alias & name collisions** — Same name in two works: never merge; tie answer to work hints + doc scope.
- [x] **38. Draft-aware retrieval gaps** — Long doc prose with no note entry: audit paths that still return `nothing_saved` when draft mentions the topic (#11 follow-up).
- [x] **39. Question-kind expansion** — Routes for common shapes not covered well: *“where”*, *“when”*, *“how many”*, *“list factions”*, relationship-only (*“how are A and B related?”*) without full profiles.
- [x] **40. Unsaved-client merge audit** — Confirm `/recall/ask` merge of client `documents`/`entries` matches what you see in editor for edge cases.

**When Tier B is largely done:** Ask should feel **reliable for your account** on clear, scoped questions — still not every vague phrasing.

#### Tier C — Focused answers (no infodump) — build

Goal: **answer only what the question asks.**

- [x] **41. Facet detection** — Parse question for single intent (relationship, role, appearance, politics, timeline, voice, etc.); compose one facet unless question asks for summary/coverage.
- [x] **42. Length policy per kind** — `who` + narrow question → short paragraph max; reserve long Wikipedia-shaped answers for explicit summarize/gather/coverage (#12, #13).
- [x] **43. “Gather” guardrails** — `_wants_gather` / topic route: don’t pull every mention; cap bullets; lead with direct answer sentence.
- [x] **44. RAG prompt: answer-only** — If RAG enabled (`lorekeeper_rag.py`): system prompt = use only provided chunks, **answer the question asked**, omit unrelated lore, cite nothing not in chunks.
- [x] **45. Post-compose trim** — If answer mentions entities/topics not in question tokens (and not coverage mode), trim or demote (#10 extension).
- [x] **46. Brief vs full policy** — Full Ask = focused by default; explicit “summarize / everything / what have I written” widens (mirror #15 for sidebar vs home).
- [x] **47. Source list matches answer** — Sources shown shouldn’t imply extra topics the answer didn’t use (reduces “feels like infodump”).

**When Tier C is largely done:** Ask should feel **ChatGPT-shaped in focus** but still **librarian-only** — no invented canon.

#### Tier D — Ceiling (honest limits; “outside programming”)

**100% on all phrasings is unlikely** with rules-only local recall. What each path buys you:

| Path | What it improves | What it doesn’t fix |
|------|------------------|---------------------|
| **Your Tier A habits** | Scope, save timing, question shape | Vague or multi-part questions |
| **Tier B–C code + tests** | Most owner daily questions | Every edge case, every typo in names |
| **Optional RAG (Anthropic on server)** | Harder paraphrase / connect scattered draft prose | Still needs tight prompts (#44); not magic; owner rule: librarian only, no invented lore |
| **Embeddings / vector search (not built)** | “I said it differently in chapter 12” retrieval | New infra, cost, tuning |
| **General LLM “understand anything”** | Theoretical upper bound | Conflicts with no-invented-lore unless heavily constrained |

Treat as **out of scope unless you explicitly approve**:

- [ ] Open-ended “discuss my novel” chat (not Ask — different product)
- [ ] Auto-training on your corrections to change behavior for everyone
- [ ] Third-party models reading your drafts without librarian-only constraints

**Practical “done enough” bar (owner-only, before #25):** Tier A checked · **most of Tier B–C** · corrections list shrinking · you trust Ask for **scoped, specific** questions.

**Practical “Docs-level storage” bar:** Part 1 Tier B — separate from Ask quality.

---

### Plan command cheat sheet

| Command | Scope |
|---------|--------|
| *Run LoreKeeper full checklist Tier A* | Manual storage + Ask habits (Parts 1–2 Tier A) |
| *Implement storage items 26–32* | Part 1 Tier B |
| *Plan Ask recall completeness 33–40* | Part 2 Tier B |
| *Plan Ask focused answers 41–47* | Part 2 Tier C |
| *Fix Ask from Owner’s Office corrections* | Read corrections on site → tests + code (item 33) |

**Verdict labels:** Part 1 Tier A = **trust saves now** · Part 1 Tier B = **safe sign-ups** · Part 2 Tier A = **free wins** · Part 2 Tier B = **finds what exists** · Part 2 Tier C = **no infodump** · Part 2 Tier D = **ceiling / needs you to approve bigger tools**

### Do in this order (maximum efficiency)

Run **one row at a time** in Cursor. Don’t skip Phase 0 — it costs nothing and fixes many “Ask bugs.”

| Phase | You or Cursor | Plan command (copy-paste) | Checklist items | Done when |
|-------|---------------|---------------------------|-----------------|-----------|
| **0** | **You** | *Run LoreKeeper full checklist Tier A* | Part 1 A1–A6 · Part 2 A1–A6 | Saves stick; you scope/narrow Ask; wrong answers go to Owner’s Office |
| **1** | Cursor | *Fix Ask from Owner’s Office corrections* | **33** (+ fixes for each logged correction) | Corrections list has tests; repeat failures shrink |
| **2** | Cursor | *Plan Ask focused answers 41–47* then implement | **41–47** (start **44** RAG answer-only if RAG is on) | Narrow questions get short answers; less infodump on spot-check set |
| **3** | Cursor | *Plan Ask recall completeness 33–40* then implement | **34–40** (33 may already be done in Phase 1) | Clear scoped questions find saved material; fewer false “nothing saved” |
| **4** | You | Re-ask a few hard questions on home/doc Ask | Part 2 A6 (log corrections) | Failures → Phase 1 again |
| **5** | Cursor | *Implement storage items 26–27* | **26–27** | Off-server backups exist; failed sync is obvious |
| **6** | Cursor | *Implement storage items 28–32* | **28–32** | Launch-grade storage (only needed before public **#25**) |
| **7** | You + Cursor | Optional: approve semantic search / embeddings | Part 2 Tier D | Only if Phases 0–4 aren’t enough — bigger build, not required for owner-only |

**Efficiency rules**

- **You before Cursor in Phase 0** — unsaved drafts and unscoped questions look like engine bugs.
- **Focus (41–47) before completeness (34–40)** if infodump annoys you more than misses; swap Phases 2 and 3 if misses hurt more.
- **Phase 1 after every recall deploy** — keep feeding Owner’s Office corrections into tests.
- **Storage Phase 5–6** can wait until you trust Ask for daily use; required before public launch, not for solo writing today.

---

## Your additions

### Ask who-is voice / hook tone (pinned 2026-08-11) — **later upgrade**

- [ ] **Voice-only pass on who-is** — keep every fact in the **Tenebris gold sample** (accuracy milestone below); soften rhythm so it feels more like the owner’s earlier essay-hook middle voice (engaging, not encyclopedia / too-factual stacks). Still librarian-only: restate notes + main draft; never invent. Do **not** trade accuracy for tone. Parked while owner works **plot summary accuracy** in a separate agent.

### Ask opt-in “include writing tasks” (pinned 2026-08-11) — **later upgrade**

- [ ] **Opt-in checkbox: include writing tasks** — when on, Ask/cast cards may surface honest “not fully developed yet” work items that belong on that card (e.g. Dijon–Tenebris relationship still thin). Off by default; never invent tasks; librarian-only from notes/gaps. Do not build until character who-is voice/accuracy bar is stable.

### Ask who-is accuracy milestone (pinned 2026-08-10, deepened 2026-08-10 evening) — **do not regress**

**Checkpoint shipped** (~`4e38d6c` and related who-is work): “Who is X?” answers are **on-subject and accurate** from notes + draft — librarian only, no inventing.

**Live bar (owner-checked — keep these shapes):**
- **Tenebris** (owner locked **2026-08-11 night** — “fine just the way it is”; prior pins 2026-08-10/11) — treat the following live answer as the **gold who-is sample**. **Do not change wording or sentence order.** Machine lock: `lorekeeper/tests/fixtures/tenebris_who_is_gold.txt` + `test_who_is_tenebris_gold_locked` — must stay green.

  > In Smoke And Mirrors, Tenebris is the main antagonist, Baron of Cheshire, and the Cheshire Cat from Alice in Wonderland, with Etherei as the subject of his fascination. Duke Dijon is his third cousin, with whom he shares a relationship that is cold on the surface but more complicated — Duke Dijon is among the few cats he does not grudge, and both care; unbeknownst to him, his staying out of Court politics leaves Duke Dijon with a heavier load. His mother is from here, but his father is a Domestic Cat from another realm, with whether he is a Faeble too still open — and other cats gave him the cold shoulder because that father was an outsider. He is personally disgusted by Predator Court politics, and does not realize how much political influence he holds. He has mixed parentage, and is not entirely of this world. Lord Tenebris of Cheshire is a faeble with social rank — not a king or emperor.

  Must keep: role/open first; Etherei fascination when noted; Dijon third cousin + cold-on-surface / few-cats-without-grudge / both-care + **Court-load (unbeknownst)**; mother here + father Domestic Cat from another realm + Faeble still open — **never** “parent stock”; cold shoulder for outsider father; Court disgust + unrealized influence; mixed parentage + not entirely of this world; faeble social rank. **Not** Umber POV; **not** Dijon cousin twice; **not** unnamed-parent scraps; **not** choppy short stacks. **Not** title-glue (“Tenebris In Smoke…”) or Dijon/parents leading.
- **Platinus** — protagonist, twin/brother Titanem, aka Cypher Prism → Palladiar, faction against Galloxidor; **not** birth-name rename dump
- **Elham** — protagonist, young woman, author — accurate; deepen with concealment / opposition / draft situation when present (2026-08-10 who-is depth pass)

**Owner voice target (essay-hook — librarian only):** Facts must match the **Tenebris gold sample** above. **Tone/hook warmth** (less encyclopedia, more engaging middle voice like the owner’s earlier sample) is a **later upgrade** — see “Ask who-is voice / hook tone” above. Restate only what notes + main draft support; never invent missing beats or writing-task gaps unless written or the opt-in writing-tasks checkbox ships later.

**Regression rules for later agents:**
- Do **not** trade this accuracy for longer answers
- Do **not** edit `tenebris_who_is_gold.txt` or soften `test_who_is_tenebris_gold_locked` without owner OK in that conversation
- Still reject knower POV (“X thinks that Y…”), rename infodumps as the whole card, and unrelated scene scraps
- Treat the **Tenebris gold sample** above as the current depth+accuracy **and sentence-order** baseline for standing relations, fairy-tale origin, parents, antagonist/fascination, Dijon clarifying, cold-shoulder heritage, and draft+notes politics stance when present
- Who-is must use **main draft + notes** for standing cast facts — not notes-only
- Essay-hook **order**: lead with role/open (“In Work, Name is…”); parents late — never mother/father first; never Dijon before the open
- Next goals (separate tasks): (1) voice/hook upgrade without losing the gold sample; (2) bring other cast cards up to that same accuracy bar **without** breaking the pins above

### Plot relation / plot summary accuracy — timing (pinned 2026-08-10; owner opened plot work 2026-08-11)

**Owner note (2026-08-11):** Who-is **accuracy** is parked as good enough for now (gold sample above). Writing-next / leave-off plot work continues in this pass. Who-is **voice/hook** upgrade stays later — do not mix it into the plot pass.

**Writing-next task list Ask — accuracy + completeness + draft-timeline seats + voice (pinned 2026-08-11 night; plan-recall + seat sentences locked 2026-08-12):** Owner gold for Etherei cast task list (sample below). **Do not regress this bar.** Machine lock: `lorekeeper/tests/fixtures/etherei_writing_next_gold.txt` + `test_etherei_writing_next_gold_shape_locked`.

- Q: *Give me the task list for Etherei.* (story silo / search-in = Smoke and Mirrors)
- **Gold sample (owner-locked shape 2026-08-12 — plan-recall voice; clarifiers; seats as follow-on sentences not parentheses; staggered You… openers; one vision beat):**

  > Here's a short task list for Smoke and Mirrors about etherei — write-next items from your notes that aren't on the page yet:
  >
  > • For the chase scene, your plan was to keep it swift, not hasty — he deliberately outruns his brothers before the Wolf takes him. Your plan was for this to take place during the Serias capture chase.
  >
  > • You wanted his brothers to find out Etherei is ticklish — so they can make him swear never to sacrifice himself that way again. Your plan was for this reveal to take place shortly after brothers rescue Etherei from Serias.
  >
  > • For the vision beat, your notes call for showing Etherei's albino-rabbit vision trouble — a reveal even Etherei and his brothers have not faced yet. Your plan was for this reveal to take place at the Cheshire Cat’s quarters, after Etherei is captured.
  >
  > • For Obsidian's flashback, you meant to open further secrets about Etherei and Obsidian — a different childhood memory with more about both still to open. Your plan was for this to take place during the chase after Etherei spots Serias.
  >
  > • For Stygian's flashback, you meant to open something surprising about Etherei and Stygian — an early-childhood fracture that surprises about both of them. Your plan was for this to take place during the chase after Etherei spots Serias.
  >
  > — Short write-next tasks restated from your notes vs draft only. Nothing invented. Continuity sticky-notes, later-book setup, and standing lore stay out unless you ask for a later book. Name a topic for a tighter list, or ask again for more.

- Must keep: Etherei-centered write-next; chase craft; ticklish + albino vision when unused; twin flashback polish with edit seat + draft-timeline seat; one clarifier when notes say why; blank lines; one vision family; **plan-recall** tone; **seats as follow-on sentences** (“Your plan was for this reveal to take place shortly after…”) — **not** parentheses; stagger You… openers; mirror note seats (e.g. Serias when notes say Serias); no inventing; leave-off + Tenebris who-is untouched.
- **Do not** edit `etherei_writing_next_gold.txt` or soften `test_etherei_writing_next_gold_shape_locked` without owner OK in that conversation.

**Follow-ups for a future agent (this gold already includes completeness + location + plan-recall voice):**
- [x] Completeness: unused Etherei facts still missing from lists when present in notes
- [x] Location: edit seat + draft-timeline seats
- [x] Vision family dedupe: Cheshire-quarters seat
- [x] Voice densify (2026-08-11 night)
- [x] Clarifiers + warm tone (2026-08-11 late) — superseded by plan-recall
- [x] Plan-recall tone (2026-08-12): mirror writer's plan; stagger You… openers; scene-led For… lines between
- [x] Draft-foothold reminders (2026-08-12): (1) soft **Update your notes?** when draft already has a beat but a related note still reads like setup-only; (2) task-list prefers threads the draft already introduces and quiets pure-future scenes with no foothold (e.g. facing the music at Tenebris before that scene begins)
- [x] Seat sentences (2026-08-12): timeline seats as follow-on “Your plan was for this reveal to take place…” — not parentheses; still mirrors notes

### Draft-foothold note reminders (pinned 2026-08-12) — **shipped v0 on writing-next**

- [x] **Update your notes?** — only when the main draft already has a foothold on the beat (e.g. flashback already on the page) and a related note still reads like the whole beat is only planned. Soft reminder; never invents the new plan; skip pure-future scenes not yet introduced.
- [x] **Task-list upgrade** — prefer unused notes for threads the draft is already introducing; do not surface pure-future scene notes (e.g. facing the music at Tenebris) until the draft begins that scene.
- [ ] Later deepen: note-vs-draft seat conflicts beyond flashback setup; optional Ask for “which seats look stale?”

### Thin draft / catch-up gather Ask (pinned 2026-08-12) — **later**

**Need:** For main drafts + notes that don’t have a lot of progress yet (owner example: *The Waking Dream* draft and its notes) — especially after time away, and when the writer has several main drafts and can’t work them all at once — Ask should **gather what is already there** so they can see the work they’ve done and decide where to go next.

- [ ] **Catch-up / “what have I got so far?” Ask** — librarian-only restatement of notes + draft for a named work (or the open doc): cast, beats, open questions, planned scraps — enough to reorient, not a novel rewrite. Never invent. Useful when material is thin or the writer hasn’t looked in a while.
- [ ] Tone: planning brief / orientation (not who-is encyclopedia, not write-next task list alone). May complement leave-off when the draft is short, and complement notes-not-in-draft / writing-next when they want “what exists” before “what’s next.”
- [ ] Multi-draft awareness: work-scoped (story silo / search-in / named work) so one thin draft doesn’t mix with another.

**Leave-off / main-draft plot — accuracy milestone (pinned 2026-08-11; gold sample updated same day):** Owner checked **excellent** for leave-off planning brief.

- Q: *Where did I leave of[f] in the main draft in terms of plot?*
- **Gold sample (keep this shape — do not regress):**

  > The draft leaves off with Etherei in Serias the Wolf's grasp, being carried down the mountain path after having deliberately sacrificed himself to draw the Wolf away from his brothers, Obsidian and Stygian. In the immediate lead-in, Etherei had outrun his brothers — despite a badly injured leg — by bolting sideways before they could stop him, ensuring Serias would follow him alone. The active pressure at the draft's tail is Etherei's dread of what Lord Tenebris intends for him, and his belief that Tenebris means to make a punishing example of a "White Rabbit" who dared display sentience. That belief is **incorrect**: the notes make clear Tenebris's intention is not punishment but fascinated study, and that upon arrival Etherei will be baffled to find himself treated as a guest rather than a prisoner. The destination is Tenebris's quarters, and what lies between the current moment on the mountain path and that arrival remains, per the notes, an open gap the writer has not yet drafted.

- Must keep: formal planning-brief voice (not novel prose); NOW + just-before sacrifice/brothers; stakes/belief; belief framed **incorrect** when notes say so (other cases may be incomplete/partly right — mirror notes); destination; honest open gap if notes say so; **no** `SOURCE N` leaks; **no** fake work titles; **no** infodump.
- Typo tolerance: “leave of” / “left of” should still route as leave-off when paired with main draft / plot.

**Still careful:** Shared Ask brain (recall + compose + ranking/focus) means plot work can fight who-is scrubbing. Prefer plot as its **own** pass; do **not** loosen who-is “no plot dump” guards to make plot answers look better. Do **not** regress the Tenebris gold sample **or** this leave-off gold shape.

**When tightening plot:**
1. Keep who-is accuracy pins intact (spot-check “Who is Tenebris?” if compose/focus changes).
2. Open plot from Owner’s Office corrections (playbook Phase 1) — not a broad character-card rewrite.
3. Exception only if owner insists: one tiny correction that clearly routes as relationship / plot-span / summary and does **not** edit character-card compose unless required.

**Already in place for later:** relationship / situation / plot-span helpers; playbook intent for “How are A and B related?”; leave-off routing fix for “main draft / in terms of plot” (`1cbe607`).

### Document page split (needs more than Cursor — 2026-08-09)

- [ ] **Real Google Docs–style page split** — stacked letter pages, whole lines to the next page, no gap bleed, no top/bottom chop. Tall growing page works for now (full draft + word count). Multi-page split was tried and rolled back (clipping, scroll/caret issues). **Needs more work; probably more than Cursor alone** (pair programming / deeper editor work). Do not treat as a small Cursor-only follow-up until a new approach is agreed.

### Ask confirm-sources (retired as default UI 2026-07-20)

- [x] **Ask confirm-sources** — preview/confirm checkbox step shipped 2026-07-19; **default Ask now answers in one step** (no tick list). Backend preview/confirm still exists for tests; home + doc Ask no longer call it.

### Doc-scoped notes sidebar (shipped 2026-07-17)

- [x] **Notes tab on document** — while writing, list only this story’s notes; Random ideas stay on Home; hide other works
- [x] **Same membership for work-scoped Ask**

### Story silos (shipped 2026-07-31)

- [x] **Home story silos** — each story shows main draft on top, that story’s notes underneath; undecided notes in **Random ideas**
- [x] **Ask one silo only** — home Ask requires choosing a story or Random ideas; LLM prompts stay inside that silo
- [x] **Migrate jumble** — clear linked/title matches attach to a story; undecided stay in Random ideas (non-destructive)
- [x] **One-shot** — move test doc “smoke and mirrors work title” into Random ideas; Smoke and Mirrors main draft stays “storywriting draft” (2026-07-31)

### Floaters-only Ask (shipped 2026-07-17)

- [x] **Ask floating / unspecified / Random ideas pile** — phrasing like “floating ideas,” “random ideas,” “unspecified notes”; lists only unassigned notes; never mixes in work-tagged notes; character Ask inside floaters stays in that pile
- [x] **Clarify + narrow** — large vague floater Ask asks what to gather (topic / everything / no-clash piles); follow-up gathers notes only (no “what you meant” narration); boy-vs-girl protagonist scraps shown as separate piles

### Draft vs notes — dual Ask + doc cadence (shipped 2026-07-13)

- [x] **Ask dual summary when draft and notes conflict** — draft first (**This is what the main draft says:**), then notes (**This is what your notes say:**); no winner / no scolding / no AI rewrite
- [x] **Ask notes not yet in main document** — work-scoped compare: list clear note lines that don't show up in the draft by word overlap (not a theme judgment); honest empty when no notes or no document (2026-07-20)
- [x] **Doc bottom “Update document?”** — ~every 3 days; Don’t show again; short Feedback path for custom schedule; focuses editor for manual paste (no Docs import)

### Mobile comfort writing — solutions table (planning; not built)

**Problem:** Long typing on phone (story, notes) — sore thumbs, small screen, accidental selection wipes, mic dictation annoying in public. **Not:** sentence guessing, cross-user learning, or replacing the OS keyboard with a tabbed alphabet.

**Owner decisions (2026-06):** #3 sure · #4 keep · #5 fine · #11 yes · **#12 yes** · #10 maybe · #14 maybe · rest fine for bundle.

| # | Solution | Owner | Status | Notes |
|---|----------|-------|--------|-------|
| 1 | Mobile writing mode | fine | [x] shipped | Hide chrome; cursor above keyboard; more room for text |
| 2 | Accessory row above keyboard | **both modes** | [x] shipped | **Mode A:** punctuation, snippets, chips. **Mode B:** scrollable bigger letters (scroll for more ABC — no ABC↔123 flip). Ship both; toggle/tabs in one row. Optional private feedback: which mode they use (site feedback / Owner’s Office meta). |
| 3 | User snippets & abbreviations | **sure** | [x] shipped | Only what they saved; feeds Mode A + #5 glossary |
| 4 | Cast / place / term chips | **keep** | [x] shipped | Work-scoped; recent + pinned from their entries; same glossary as #3/#5 |
| 5 | Prefix word completion (one word) | fine | [x] shipped | Current partial word only (`rab` → `rabbit` or cast name); tap to accept; lore glossary before English; never sentence AI |
| 6 | Spell / typo help | fine | shipped | Doc editor + notes textareas |
| 7 | Undo toast after big accidental replace | fine | [x] shipped | “Replaced a lot — Undo?” on touch wipe |
| 8 | Confirm before replacing large selection | fine | [x] shipped | Mobile-only or Comfort toggle |
| 9 | Snapshots / easy restore | fine | [x] shipped | Mobile banner + versions sheet; friendly “minutes ago” times |
| 10 | Sync + handoff to desktop | **maybe** | [x] shipped | Opt-in on account; gentle toast after mobile doc save; dismissible |
| 11 | Bluetooth keyboard mode | **yes** | [x] shipped | Shortcuts, less touch chrome when external keyboard connected |
| 12 | Plain capture on phone | **yes** | [x] shipped | Quick jot + **append to page** from doc sidebar (plain block at bottom) |
| 13 | Read vs write on phone | fine | [x] shipped | Scroll/read default; tap Edit to type |
| 14 | Gentle break reminders | **maybe** | [ ] plan | Off by default; long interval; dismiss forever |
| 15 | Doc-local term list (opt-in) | fine | [x] shipped | Words from their work → feeds #4/#5; opt-in |
| — | Mic dictation in public | skip | — | Social + editing burden |
| — | Bigger full alphabet (one screen) | skip | — | Hides what they’re typing |
| — | Tabbed / full custom in-app keyboard | skip | — | Slow; fights OS keyboard |
| — | Sentence / intent prediction | skip | — | Privacy + co-author feel |

**#12 — yes (scope):** Builds on existing **home New note** and **doc New note** — no second capture product. **In scope:** mobile writing mode + accessory row + undo/safety on note textareas; cleaner phone path to jot; **append to page** from doc sidebar (plain block at bottom of manuscript). Save note still sends to home list.

**Suggested bundle (first pass):** #1 + #2 (both modes) + #3 + #4 + #5 + #7 + #8 (mobile toggle) + #11 + #12 + #13 + #15. Defer or light-touch: #10, #14.

- [x] **Mobile comfort writing — bundle** — first pass shipped 2026-06-30 (#1–#8, #11–#13, #15, glossary #3–#5). [x] **#9 phone restore** shipped 2026-06-30. [x] **#10 handoff nudge** shipped 2026-06-30. [x] **#12 append-to-page** shipped 2026-06-30. Later: #14 breaks.

- [x] **Ask: POV / knowledge questions (misparsed “about” tail)** — `knowledge` route + `lorekeeper_knowledge_pov.py`; regression case `knowledge_pov_elara_marcus`.
- [x] **Ask: “Who is …” quality regression (local fast path skips RAG)** — `local_pipeline_skips_rag()` in `lorekeeper_recall.py`; thin / false-empty who → RAG when enabled.
- [x] **Figure out LoreKeeper debugging privacy policy** — `.cursor/rules/lorekeeper-debugging-privacy.mdc`
- [x] **Plan loose ends vs planned-later (Ask)** — verdict in `lorekeeper/LOOSE-ENDS-DESIGN.md`
- [x] **Loose-ends Ask routes (Layer 2)** — `planned:` / `fix:` / `TODO fix` tags; Ask *what's not written yet* and *what's flagged to fix*; canon audit skips `planned` entries (`lorekeeper_loose_ends.py`).
- [x] **Ask quality playbook** — `LOREKEEPER-ASK-QUALITY-PLAYBOOK.md` + Owner’s Office Phases 0–2 (categorized spot-check, pass lines, manual scoring, corrections copy, note-structure guide).
- [ ] **Ask playbook Phase 5 — Tier D (not built yet)** — embeddings / semantic retrieval; optional Owner’s Office interest UI later.
- [ ] **Ask playbook Phase 6 — launch readiness (not built yet)** — playbook tied to public launch (#25) in Owner’s Office when you say go; nginx gate stays until then.
- [ ] **Loose-ends Layer 3 — after public launch (#25)** — cross-note fact compare excluding `planned` tags; optional tag picker in note editor; public help copy for `planned` / `fix:` habits (no auto plot-hole detection). Layer 2 ships owner-only now so writers can adopt tags before gate comes off.
- [ ] **Spot-check set + Run (Owner’s Office UI)** — deferred 2026-06; use real Ask + **It got this wrong** + Cursor fixes. Stub: `lk-spot-check-runner.js`. Revisit for one-click regression pass when Ask is stable.

