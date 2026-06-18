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
- [x] Documents with pages — new doc, add pages, auto-save, continue where you left off
- [x] Owner’s Office — accounts, sign-up switch, private feedback (no other writers’ note text)
- [x] Junk / throwaway email recommended on sign-up (Halalit-style copy)
- [x] Idea spinner — user-filled word banks, private nudge prompts (`spinner.html`)

---

## Your additions

### Future — optional email notifications

- [ ] **Optional notifications** — if LoreKeeper ever sends mail (reminders, export ready, etc.), send only to the **junk / throwaway address the writer chose** at sign-up, and only if they **opt in**. Not required for the app to work; reason TBD.

---

## Not yet

- [x] Recall / sort assist on the writer’s own words (librarian only — no generated lore) — **v0 shipped; major upgrades below**
- [ ] Public launch — drop nginx owner gate; open sign-ups via Owner’s Office
- [ ] Per-account notification preferences UI (blocked on decision above)

---

## Planned — reliable story-agent recall (local only)

**Goal:** Cursor/ChatGPT-like **comprehension and composition** over the writer’s own account — but **no third-party model**, no authorship. Like a **story agent** or **Wikipedia-shaped summary**, not the author and not a dictionary.

**Non-negotiables (same as product rules):** librarian only; never invent canon; every claim traceable to notes or draft; sources available; never worse than opening the raw notes.

### Composed recall (upgrade Ask)

- [ ] **Wikipedia-shaped answers** — one coherent read (paragraph or two when warranted), not bullet scraps or semicolon telegrams; length scales with material (full when there’s enough, honest when thin).
- [ ] **Reference voice for “who is / summarize / political situation”** — state facts about characters and the work (“Character A is the protagonist…”), **not** “you wrote…” / “you made him a cat” unless the question is explicitly about **coverage** (“what have I done with A so far?” / “what’s missing?”).
- [ ] **Standard cast roles when supported** — protagonist, antagonist, main antagonist, side character, mentor, foil, etc.; use the writer’s words first; reserve viewpoint-only wording (“narration stays with them in ch. 3”) for when role isn’t established but perspective is — **not** vague “POV figure” as default.
- [ ] **Draft-aware** — read long documents and scattered notes; extract and connect facts from draft prose, not just short entries.
- [ ] **Supported inference (“logic puzzle”)** — e.g. “brother” in dialogue → sibling tie when nothing contradicts; POV from whose head the draft is in; cross-link species/world notes when the draft ties in. **Never** fill gaps, genre-default, or smooth contradictions into false canon.
- [ ] **Complex / shifting topics** — factions, politics, alliances that change over time: structured situation summary with **phases** and what’s settled vs not written yet; time-aware when the corpus shows change.
- [ ] **Reference / allusion reading (evidence-only)** — when notes or in-text references clearly tie a character or work to a known tale/source (twist, prequel, continuation), say so in reference voice; **never** attribute fairy-tale or other roots without support in the account (no vibes, no name coincidences).
- [ ] **Shared backend: `brief` vs `full` modes** — same recall pipeline; full for Ask; ultra-short for press-and-hold (below).

### Reliability bar (must pass before this counts as “done”)

- [ ] **Three honest states:** nothing saved (in author’s head only) · fragments only · enough for a solid summary — each with distinct, specific copy.
- [ ] **No false empty** — if it’s in a note, relationship entry, or draft page, surface it; don’t say “couldn’t find anything.”
- [ ] **No false full** — no confident answers from wrong work, wrong character, or one stray keyword match.
- [ ] **No bad synthesis** — if composition would be jumbled or less clear than the source notes, show less or say “too scattered to summarize cleanly yet”; never output worse than raw search.

### In-document UX (while writing)

- [ ] **Collapsible doc sidebar (Safari favorites-bar style)** — the existing left panel (`docTitle`, work title, page setup, font, save status, spell flags, delete, etc.) should **collapse and expand** — hidden by default or one click to tuck away — so the writing surface isn’t always split; thin strip or toggle to reopen (like Safari’s favorites bar). Remember open/closed per session or in `localStorage`.
- [ ] **Ask LoreKeeper in the document editor** — move Ask off home into `doc.html` as a **collapsible / extendable sidebar** (closed by default); default scope to **this document / this work**; same composed recall as above.
- [ ] **Quick notes from the document (not inline comments)** — while staying on `doc.html`, open a **compact “New note” panel** (sidebar tab or dropdown — same tuck-away pattern as Ask / collapsible sidebar). **Not** the full saved-notes list; **not** notes pasted onto the document like Google Docs comments. New scraps save to the **same account notes** as home; pre-fill **work title** (and optional link to current doc) so recall can find them later. Home notes list unchanged — notes exist in both places logically (one store), writer never has to leave the draft to capture a scrap.
- [ ] **Press-and-hold word lookup (Libby/Kindle-style)** — long-press a word in the draft → **1–2 sentence max**, work-scoped, in-world/reference gloss from **the writer’s** notes (author’s glossary / specific sense), not a dictionary and not all matching notes; sources on tap; empty case: “No saved lore for this term in this work yet.”

### Spellcheck (document editor)

- [ ] **Press-and-hold typo → jump to occurrences** — long-press a flagged word in the doc (or a word in the “Possible typos” list) → show **where in this document** that spelling appears (scroll/highlight each occurrence). **Skip** for words on the personal list (**My spelling words** / Personal Dictionary) — those are intentional, not errors; no “find typo locations” for them.

### Document fonts (category coverage, not clones)

**Today:** ~20 system/web-safe faces + ~70 self-hosted Google Fonts (`lk-font-catalog.js`, `scripts/fetch-doc-fonts.sh`) — build-time fetch, **no Google contact at write time** on Odd Trove.

**Goal (owner):** **One strong pick per semi-category** — swirly/display script (e.g. Elsie Swash Caps), formal serif (e.g. Times New Roman), super-basic sans (e.g. Arial), dramatic/blackletter (e.g. Grenze Gotisch), etc. **Add breadth without near-duplicates** (not ten interchangeable sans serifs). Expand from there only when a new face is clearly a different *role*, not the same look twice.

- [ ] **Category map + gaps** — define semi-categories (basic sans, humanist sans, geometric sans, formal serif, book serif, mono, handwriting/script, swash/display, blackletter/dramatic, slab, condensed, etc.); audit catalog for **missing roles**; add one hosted Google Font (or system fallback) per gap. Examples to include if missing: **Elsie Swash Caps**, keep **Grenze Gotisch**, **Times New Roman** / **Arial** as system staples.
- [ ] **De-dupe rule** — when adding a font, skip if an existing entry is the same job (e.g. another neutral sans indistinguishable in a paragraph); prefer variety of *voice* over count.
- [ ] **Font picker UX** — group or filter by semi-category + search (so ~40–80 distinct voices stay browsable without a 1,900-item list).
- [ ] **Later (optional):** lazy/on-demand woff2 for extra categories only if the curated set grows large — not required for the “one per category to start” goal.
- [ ] **Honest gaps** — proprietary Docs names (exact Calibri/Cambria files) stay as **system fallbacks** or closest open match; label in picker if it isn’t the real file.

**Feasibility:** **Fully realistic** for the starting bar — roughly **40–100 well-chosen families** self-hosted is a normal deploy size. No need for 1,900 fonts or custom bundles; category-first + de-dupe is the right scope.