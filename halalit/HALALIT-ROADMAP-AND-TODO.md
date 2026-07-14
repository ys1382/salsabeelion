# Halalit — roadmap & todo

**How to use**

- **You:** Say “add to my todo list” (or similar) in chat — agents append under [Your additions](#your-additions) here. This file is **not** on the live site; only `halalit/www/` is reader-facing.
- **Agents:** When Halalit is in scope, read this file for **direction** and **tasks**. Check off `[x]` when something is done; do not drop roadmap ideas when planning.
- **Showing the list:** Owner **active todo** = [Active tasks](#active-tasks) + [Your additions](#your-additions) only. **Direction / later** = entire [Product direction](#product-direction-roadmap) section (museum walk, reading weather, gifts, lofi nook, personal accounts—including **shelf feedback to owner**, friend codes). Do not mix direction into active todo unless the owner asks for direction too.
- **Default when owner asks for “the todo list” (Jun 2026):** Give **active todo** only—**exclude** items that are **not shippable yet**: library reader nook / home “Your reader in the library” animation, gifts / Reader Points while nook is off, personal accounts / login / friend codes / shelf-feedback-to-owner, hub-wide **better animation** polish. Say they’re parked if helpful. Give the **full** overview (active + direction + additions) only when they ask for **whole thing**, **full roadmap**, or **everything**.

---

## Active tasks

### Book Quest — review / feedback

- [x] “Not for me” → More / Less menus (neater than auto-open panels)
- [x] Works for Halalit’s suggestion **or** reader’s own title at review time
- [x] Shelf-reason checkboxes; **multiple** boxes can be selected
- [x] Warm “Learned something Halalit missed?” line above reason list (private save on device)
- **Send feedback to owner + curated follow-up** — part of [Personal accounts](#4-personal-accounts) setup (direction / later), not a pre-accounts build. Review UI on device is done; shipping to you and turning trusted signal into Bookcheck / shelf warnings waits on accounts.

### Bookcheck — copy & trust

- [x] Stop treating children’s-fiction catalog tags as “passes” — default is **not verified clean**
- [x] **Verified clean** tier (hand list in `halalit-curated-shelf-warnings.js`; Spirit Animals series first)
- [ ] More verified-clean series/titles + bulk plot check against rules
- [ ] Bulk plot check (summaries + rules, later AI) so many books can be judged without the owner reading each one
- [x] Bookcheck **what to do** line + **what we noticed** signals on lookups
- [x] Stronger automatic scan: LGBTQ/romance/fanservice in descriptions; children’s comics → preview tier
- [x] **Catalog title pins (Jun 2026)** — `halalit-catalog-pins.js`: core title only → main book (Kiki’s Delivery Service → Eiko Kadono novel); longer query (e.g. coloring book) → full catalog list. Wired in Bookcheck, Book Quest own-title lookup, library enrich. **Sketchbooks / art books** → same hand-check path as graphic novels.
- [x] Bookcheck extra sources (allowed APIs): Wikipedia **plot**, Wikidata genres, librarian tags, Halalit theme index file — see `HALALIT-BOOKCHECK-SOURCES.md`
- [ ] Optional AI plot pass (only if you add an API key; not required) — see [Google — theme detection only](#google--theme-detection-only-owner-jun-2026) below; Google finds themes, Halalit applies existing rules
- [x] **Bookcheck verdict tone (owner Jun 2026)** — Hard auto-reject stays firm; warmer/shorter copy on soft tiers; **You decide** line when not auto-reject / AI / hand-vetted.
- [x] **Hand vet in progress — per lookup (owner Jun 2026)** — No public My TBR panel. When readers have looked up a title still on owner’s private TBR (Owner’s Office), Bookcheck shows: *The owner will soon examine this text and be able to confirm whether Halalit would recommend it.* Owner list stays owner-only.
- [x] **Hand vet queue — general fallback (owner Jun 2026)** — First logged search (not yet “popular”): *The owner of the site has been informed and your search has been added to the list of books to hand-check.* Two+ lookups: *The owner will soon examine this text…* Same gates as You decide (not auto-reject, not settled).
- [ ] Optional sitewide “tell us” link (email or form) if separate from Book Quest checkboxes
- [ ] Keep adding **curated** book/series warnings where catalogs miss themes

### Book Quest — reader prefs

- [x] Exclude-from-recommendations checkboxes on play page (opt-out model; device-only): deity/mythology, negative family portrayal, light romance, magic, alcohol/drug-related content—Book Quest includes these by default when otherwise clean
- [x] **Mental-health comfort tag (owner Jun 2026)** — Advanced recommendations settings + Bookcheck filter (shared with Halalit’s Book Quest). Applies only to **Older Child–Young Teen** and **Older Teen–Adult** bands—not Young Child. Flagged on *Pax*, *Hatchet*; Book Quest skips when excluded; Bookcheck shows comfort note or “outside your settings.”
- [x] Negative family portrayal filter: parents/guardians unfair or antagonistic—not everyday family arguments; wired into recommendation eligibility
- [x] **Required reader age bands on Book Quest start** — Young Child / Older Child–Young Teen / Older Teen–Adult; gates story choices until one is picked; filters hand-vetted recommendations to owner age bands (device-only; `halalit-bookquest-age-ratings.js`)

### Book Quest — genre-specific playthrough (direction / later — owner Jun 2026)

**Nonfiction path live (Jun 2026)** — choosing **Nonfiction** at genre pick skips the corridor/guardian/riddle and routes through `nonfictionField` → nature walk, ingredient market, or sketch studio → `nonfictionShelf` → end. Recommendations filter by `nonfictionTrack` on `REC_VARIANTS` (cookbook/art entries are placeholders until owner swaps titles). **Realistic fiction** still uses the shared corridor plot for now.

**Core idea:** Right after the reader chooses nonfiction (or later, realistic fiction), the **first question** should match the **field or vibe** they’re exploring—not the generic threshold/toll corridor. End recommendation still obeys family-shelf rules and genre bucket.

**Nonfiction — example branches (draft only; refine after seeing Book Quest in use):**

| Field / vibe | Play shape (examples) | Recommendation tilt (examples) |
|--------------|----------------------|--------------------------------|
| **Environmental / nature** | A walk through a natural landscape (specific scenes TBD) | Nature / ecology / outdoor nonfiction that fits Halalit vetting |
| **Cookbook / food** | Choose favorite ingredients—**herb-garden / market energy without magic**; Halalit reads what they gravitate toward | e.g. Arab cookbook lean (za’atar, hummus-style flavors) vs “beginner baking” lean (butter, eggs, flour, sugar—not always “beginner,” just signal) |
| **Sketching / art how-to** | Meet different **art-vibe guides** (no fanservice): kawaii talking food/animals (cute, modest—**not** fanservice art); realistic nature → draw realistic creatures/people; city interest → buildings/street sketching | Art / drawing books matched to chosen vibe |

**Realistic fiction:** plot branch **TBD**—owner will decide after nonfiction prototype and watching what Book Quest does with realistic picks today.

**Build notes when ready:**

- [x] **Nonfiction play path (live Jun 2026)** — `play.html`: field pick → nature / cookbook ingredients / art vibe → fact shelf; see `nonfictionTrack` on variants.
- [ ] **Realistic fiction play path** — still shared corridor; TBD after nonfiction is tuned.
- [ ] Map choice scores / flags to recommendation buckets (cookbook sub-flavor, art sub-flavor, nature path, etc.) in `REC_VARIANTS` or new pools—hand-vet titles only.
- [ ] Copy and art: family-friendly, modest, warm—reference-only examples above are **direction**, not final text.
- [ ] Do not add public posting or crowd picks; stays Halalit-curated recommendations.

### Bookcheck — later (phased)

- [ ] Show confidence + source + concerns + unknowns on each lookup
- [x] **Parent control (practical)** — No separate Strict / Normal / Teen switch; **Book Quest + Bookcheck** share **reader age bands** and **Advanced recommendations settings** (same device storage). Revisit only if a named Strict/Normal/Teen mode is still wanted.
- [x] **Reader accounts (Jun 2026)** — email + password at `/halalit/account.html`; junk email recommended in copy; shelves/prefs/feedback sync to server when signed in
- [x] **Google login for new accounts (Jul 2026)** — Continue with Google; legacy password sign-in kept; spare/junk Google encouraged in copy
- [ ] Accounts + private weighted reports (no public comment wall) — see [Personal accounts](#4-personal-accounts)

### Parked

- [ ] **Age bands on Bookcheck UI** — owner: not needed for now; vetted titles already carry flags/comfort notes, and Book Quest filters by reader age band on the start screen.
- [ ] Full GPT “bookcheck spec” scoring engine in one build — use phases instead

---

## Product direction (roadmap)

Bring these into planning and design so they are not dropped across sessions.

### 1. Museum-style experience

- A **one-page, curated “walk”**: one narrow bookish topic, several stops with short labels and the owner’s voice — exhibit-style, not another import tool.
- **No public posting** on the walk (see `warmth-without-social.mdc` if present). Stays **owner-curated** copy on the page, not a comment wall or reader-submitted stops.
- **May reflect private reader feedback over time (owner Jun 2026):** If readers later send **direct feedback to the owner** through Book Quest (what they liked best about a recommendation, a series, or author picks)—private to owner via [accounts setup](#4-personal-accounts), not public text on the site—that signal can **inform** future walk stops. Owner **does not copy-paste** user comments; distills into general, warm exhibit lines (example: a reader praises how a character handled inner conflict via a specific choice → walk might say *“Popular for how one character works through conflict—not a plot spoiler.”*). One-way, curated voice; no attribution, no quote wall.
- Tie to [Personal accounts — shelf feedback](#4-personal-accounts) when feedback-to-owner ships; museum content stays separate from live reader-facing posts. Same private feedback lane may also inform [reading weather](#2-silly-fixed-reading-weather)—still distilled, never quoted.

### 2. Silly fixed “reading weather”

- **Inputs** (e.g. date ± optional book title) → **one** playful forecast line about the *reading day*, not the real sky.
- **Same inputs → same line** (stable / “fixed”), not a random slot machine each refresh.
- Tone: **kind** — no punching down at authors, genres, or readers.
- **May share the museum walk feedback lane (owner Jun 2026):** Like the [museum walk](#1-museum-style-experience), **no public posting** on the weather line itself. Over time, **private** Book Quest feedback to the owner (e.g. “this pick made my day better,” what they loved about a recommendation/series) can **inform** fixed forecast copy—owner distills, no copy-paste, no quotes or attribution. Example shape only: reader says a title brightened a rough day → a stable line might nod to *“a good day for a story that lifts the mood”* without naming them or their words. One-way curated voice; tie to [Personal accounts — shelf feedback](#4-personal-accounts) when feedback-to-owner ships.

### 3. Gifts — intangible by default

**Timing (Jun 2026):** Ship **with or after** the [Personal Library lofi reader nook](#5-personal-library--lofi-reader-nook-direction--later)—not before. Reader Points / decor shop are tied to the same **animated reader + personal space** pipeline that isn’t ready while the nook is off (`libraryReaderNookEnabled = false`). Keep direction below; don’t build gifts UI or economy until nook animation ships (or in the same release).

- Avoid **print-first** or disposable **paper** gifts (bookmarks, etc.) as the default path because of waste and low use.
- Prefer **non-tangible gifts**: copy-to-clipboard, save-in-site, optional **screen-sized** share image, unlock extra on-site content — not “print this slip.”

#### Reader Points (or similar name) + decor shop

- Users earn points and **spend them on site decor** for their avatar / personal space: e.g. reading chairs, animals, outfits — **family-friendly, modest presentation**.
- **Outfit rules:** non–form-fitting; **no** emphasis on body shape. For anything shown **below the face**, visible skin is **limited to the hand and a very small amount of wrist** (no broader “below the neck” skin show).
- Implementation details TBD; preserve this direction when designing economy and art.

### 4. Personal accounts

- **Personal accounts** — **v1 live (Jun 2026):** sign up / sign in, account-backed shelves and prefs; owner inbox on `account.html` when `HALALIT_OWNER_EMAIL` matches.
- **Friend codes (IRL-only)** — Part of accounts setup, not a standalone early build. Codes shared **off-site / in person** only. **No** on-site posting, discovery feed, or public “share my code” surface. Intent: connections stay between people who already know each other in real life.
- **Shelf feedback to owner (Book Quest)** — Part of accounts setup, not a pre-accounts build. Today: review reasons + “learned something Halalit missed?” save **on device only**. When accounts ship: **send** that feedback to the owner (email, export, or admin—not public). Owner may turn trusted signal into curated Bookcheck / shelf warnings and into [museum walk](#1-museum-style-experience) / [reading weather](#2-silly-fixed-reading-weather) copy (distilled, never quoted). No public comment wall.
- [ ] Send shelf feedback to owner — not only `localStorage` (with accounts)
- [ ] Turn trusted feedback into curated Bookcheck / shelf warnings (owner workflow; with accounts)
- **Privacy / abuse** — approach not finalized. Plan for **minimal sensitive data**; **throwaway / junk email encouraged** where email is used; other identity fields TBD. When proposing account flows, **bias toward low personal info** and clear security tradeoffs until the owner locks a design.

### 5. Personal Library — lofi reader nook (direction / later)

**Shelf animation:** spine / wooden-wall shelf motion is **fine — do not change** when revisiting this area.

**Book Quest:** keep scene/reader illustration generation while it follows **modesty rules** (covered clothing, no fanservice, existing prompts). Parking the library nook does **not** mean redoing Book Quest art.

**Site (May 2026):** Home **“Your reader in the library”** panel and Personal Library nook reader are **off** (`libraryReaderNookEnabled = false` in `index.html`) until animation is good enough to ship.

- [ ] **Library reader nook — full animation** — Lofi-style reader under the Personal Library shelf; home-page customize flow returns with this.
- [ ] **Home page — “Your reader in the library”** — Bring the setup panel back when the nook animation ships (outfit/hair/skin fields + modesty copy).
- [ ] **Clickable book in lap** — (after nook ships) In-progress title: book in lap **clickable** (same as spine tap; target TBD).
- [ ] **Put away book on finish** — (after nook ships) On **finished / date read**, short beat: reader **puts the book away**, then idle or next in-progress book.
- [ ] **Gifts / Reader Points + decor shop** — Same release window as nook (or right after); see [Gifts — intangible by default](#3-gifts--intangible-by-default). Not a separate early build while nook animation is unavailable.

### Cross-cutting

- Do not assume **public comments** or stranger-posted text for warmth; prefer curated voice, local/private saves, and non-toxic patterns (see `warmth-without-social.mdc` if present).

---

## Your additions

### AI vet batch logged (Jun 2026)

- [x] **AI staging live on Bookcheck (Jun 2026)** — `HALALIT-AI-VET-STAGING.md` → `halalit-ai-vet-staging.js`; banners: *AI likely okay — not hand-checked*, *AI flagged for review — not hand-checked*, *AI likely rejection — not manually checked*. Hand-vet always wins.
- Owner mirror: `halalit/.cursor/private/HALALIT-MY-TBR-LIST.md`
- **Howl's Moving Castle** — AI manual queue only; owner did **not** hand-reject.
- **Watership Down** — AI manual queue; owner roster still Teens/Adults hand-clean until reconciled.

### Reader accounts — owner choices (Jun 2026)

- **Halalit only** (not oddtrove-wide / not Maestro’s, envDyst, etc.).
- **Login optional for now** — browse without signing in; saving shelves/prefs asks for sign-in. **Agents:** when owner reviews or updates this todo list, ask once if they still want optional login or **require sign-in for all of Halalit**.
- **Sign up:** Google login for new accounts (spare/junk Google encouraged); legacy email + password sign-in still works for older accounts.

### All apps / hub (not Halalit-only)

- [ ] **Better animation** across apps in general (polish motion, transitions, ambient detail — TBD per site)

- [x] **Login — Halalit** (Jun 2026) — reader accounts on oddtrove.art/halalit; other kids apps TBD
- [ ] **Login** shared or consistent across all apps (design TBD; tie to [Personal accounts](#4-personal-accounts) when scoped)
- [ ] **Camera-inclusive feature** (camera option on all apps) — **no storage** of personal or non–Halalit-related data (no location, no unrelated photos/metadata on server; clarify use case per app, e.g. scan book spine vs profile — TBD)
- [ ] **Domain** for the kids sites / hub (replace or supplement raw IP URLs for directory + Halalit, Maestro’s Odyssey, crocheter, envDyst, etc.)

### Accessibility — special needs (inclusive use)

- [ ] **Accessibility pass (site-wide)** — So readers who can’t see well (or at all), can’t use a mouse easily, need larger type or stronger contrast, or need calmer motion can still use Halalit, Book Quest, Bookcheck, and Personal Library. Build on what’s already partial (labels, tabs, list view, reduced-motion hooks); audit gaps (keyboard-only shelf, focus when screens update, color-not-only, skip link, contrast/theme, plain-language help). No public “accessibility forum”—private feedback to owner if needed.

### Occasion weeks — parent celebration picks (later)

**Not built yet** — pin for when Father’s / Mother’s Week banners ship and owner is ready to design the page.

- [ ] **Book animations + occasion-week recommendation page(s)** (owner name) — During **Father’s Week**, **Mother’s Week**, **Parents Week**, **Grandparents Week**, and (later) other themed weeks: a dedicated page with **Book animations** (animated / cover-forward presentation—exact motion TBD) plus a **warm, celebratory** message (tone: cozy Halalit voice, not preachy). Curated picks from the [family candidate pool](#family-occasion-weeks--candidate-pool-owner-draft--jun-2026) once owner splits by week. **Grid of real book cover images** (owner still deciding source: Open Library covers API, hand-hosted assets, or mix — must respect rights/size/alt text). Each title: family figure **integral** to the story, hand-vetted for Halalit shelf rules. Link from occasion banner or Home during that week only (Pacific Time, same window as banners). No public comments or reader-submitted lists — owner-curated only.

<!-- Add new tasks or roadmap notes below -->

### Nancy Drew — AI unless readers ask (owner Jun 2026)

- **Default:** Bookcheck **AI theme scan** for Nancy Drew titles; not owner read cover-to-cover across the line.
- **Hand-vetted in code:** *The Secret of the Old Clock* only.
- **Revisit hand vetting** only if signed-in readers / owner feedback clearly ask for it.

### Bookcheck — Notes for parents (owner Jun 2026)

- [ ] **“Notes for parents” flag** — Dedicated Bookcheck label for kid-facing books with a beat parents may want to preview first (not a hard ban, not the same as negative-family or romance opt-outs). Seeded in code with `PARENT_NOTES` + `Notes for parents` label (*Wonder* first). Later: clearer UI treatment, optional Book Quest tie-in, and more titles as owner vets them.

### Earth Week / Earth Day reading list (owner draft — Jun 2026)

**Cutoff (owner Jun 2026):** Nothing *below* **Spark (Chris Baron)** on the nature browse list counts for Earth Week—that book is the **floor** of Earth Week consideration. Everything under it is general Halalit shelf only (not Earth Week picks).

**On list (confirmed — 21, closed for now):** Jinx trilogy, Seekers duology, Black Beauty, Green Deen, The Lorax, Last Bear, Wolf Called Wander, Whale of the Wild, Wild Rescuers, Grace of Wild Things, Klein (*This Changes Everything*), Durst *Spark*, Manatee Summer, Magic School Bus, Magic Finger, Animal Healer, Watership Down, Berenstain Bears Go Green / Earth Day, Happy Happy Clover, Heidi (glowing praise for living in nature), Spark (Chris Baron).

**Passed for Earth Week (still on general shelf):** Pax, Land of Elyon, Wolf Princess, Hobbit + Lord of the Rings, Lost Rainforest b1, Wing & Claw. **If vetted later:** Julie of the Wolves.

### Family occasion weeks — candidate pool (owner draft — Jun 2026)

**Not built yet** — owner building a **family list** first, then splitting into **Mother’s Week**, **Father’s Week**, **Parents Week**, and **Grandparents Week** (see [Occasion weeks](#occasion-weeks--parent-celebration-picks-later) for page/animation ship later). Not on the live site until you ask to build.

**Father’s Week:** *To Kill a Mockingbird* (+ graphic novel); *Fortunately, the Milk*; *Savvy* **book 1 only** (not Mother’s Week—mother shown non-negatively); *Hop on Pop* (idk); *Berenstain Bears* **Father’s Day** titles from the series.

**Mother’s Week:** *The Girl Who Drank the Moon*; *Echo Mountain*; *Berenstain Bears* **Mother’s Day** titles from the series.

**Parents Week:** *Seekers of the Wild Realm* **book 1 only**; *Sisters Grimm* (series); *Ramona Quimby* (series); *Guess How Much I Love You*; *Love You Forever*; *Castle Glower*; *Piper McCloud*; *Savvy* **book 1 only**; *Berenstain Bears* (series overall).

**Grandparents Week:** *The Boxcar Children* **book 1 only**; *The Girl Who Drank the Moon*; *The Witches*; *Sisters Grimm* (series).

**On hold — not assigned to a week yet (negative family portrayal; not abuse—owner may slot later):** *Manatee Summer*, *Heidi*, *Luck Uglies* (idk).

**Family maybe (doesn’t center parent):** *Floors* (not dad-centered), *Operation Sisterhood* (not mom-centered).

**Parked off Halalit list (like Harry Potter / J.K. Rowling lane):** *Dead City* (James Ponti)—clean plot in owner scope; future flagging category; no Book Quest until cleared.

- [x] **Age-rating sort file** — `HALALIT-HAND-VETTED-CLEAN-LIST.md` (Kids / Adults / TBD for whole-series hand-vet).
- [x] **Squished** + **The Library of Unruly Treasures** — owner **no** for verified clean; removed from `VERIFIED_CLEAN`, `flag_review` in Bookcheck (Jun 2026).
- [x] **ASOUE** — owner decided: **flag_review**, never Book Quest; adult/inappropriate refs + discretion if you read (coded Jun 2026; see hand-vet parked row).
- [x] **Nancy Drew line** — owner decision (Jun 2026): **AI theme scan** for the line unless readers clearly ask for hand vetting; only *The Secret of the Old Clock* stays hand-vetted in code. No series-wide owner read planned for now.

- [ ] **Personal Library — copy shelf for chat** (optional): bring back “Copy vet queue for chat” / “Copy full shelf for chat” on the Personal Library toolbar if owner wants plain-text export from the shelf again; removed from UI May 2026.

- **May 2026:** Bookcheck guidelines say **all-ages appropriate** for now; kids/adults age ratings tracked under Bookcheck — later (phased) above.
- **May 2026:** Owner numbered Personal Library vet (items 1–116) in chat; coded in `halalit-curated-shelf-warnings.js`. Continue 117–464 when ready.

### Bookcheck — product & rules (owner)

- [ ] **Learn what parents want flagged** — Find out whether families want **stricter rules** and/or clearer warnings (e.g. **violence**, intensity, scary tone) vs current Halalit themes. Use that to decide if Bookcheck needs extra concern types or stricter pass/caution thresholds before building more of the trusted-shelf flow (reader age bands + play-page opt-outs already cover the main “parent mode” lever).

### Google — theme detection only (owner Jun 2026)

**Intent:** Use **Google** (search + AI—exact product/API TBD) to help **find whether a book has themes Halalit already tracks**, not to change Halalit’s stances.

- [x] **Google theme scan (live Jun 2026)** — Bookcheck calls server API on port 8075; needs `HALALIT_GEMINI_API_KEY` in `halalit-server/.env` on VPS. See `halalit/server/README-BOOKCHECK-AI.md`. Themes: LGBTQ, magic, deity/mythology, pro-colonial, romance, substance, etc.—**never fanservice** (comics: “not checked yet” for panels; owner: Pokemon manga). Rules unchanged; hand-vet wins.
- **Halalit rules are unchanged.** Google output is **theme presence only**—it does **not** decide pass/fail, soften hardest never-recommend, or override hand-vet. Same policy engine applies after detection.
- **Trust order:** hand-vet / coded lists **beat** Google when they disagree; Google fills gaps when catalogs and Wikipedia are thin or wrong (e.g. series LGBTQ in a later volume).
- **Owner hand-vet stays separate (Cursor).** Google must **not** replace or auto-merge into owner vet tracking. Keep **your** lists in Cursor/planning files so if Google gets worse—or is weak on certain titles—you still know what **you** hand-read, parked, or put on **My TBR**:
  - `HALALIT-HAND-VETTED-CLEAN-LIST.md` — age-sorted hand-vet roster (promotes from live `VERIFIED_CLEAN` in code)
  - `halalit/.cursor/private/HALALIT-MY-TBR-LIST.md` — **not hand-read yet**; Cursor-only until you promote
  - Plot-vet / parked batches in this roadmap — owner decisions, not Google output
  - Live site: `halalit-curated-shelf-warnings.js` — only after **you** promote from the above; Google never writes there automatically
- **Owner proof-of-concept:** LGBTQ found in *Loki: A Bad God’s Guide*; correctly **no** LGBTQ in Brandon Mull’s *Dragonwatch*.
- **Bookcheck reader labels** — see [Bookcheck vet source labels](#bookcheck-vet-source-labels-owner-jun-2026); Google is theme detection only, not rule-making.
- **Phased:** (1) ~~live Bookcheck AI + vet banners~~ (Jun 2026); (2) ~~owner lookup notifications UI~~ + Owner’s Office My TBR; (3) ~~per-lookup *hand vet in progress* reader note~~ (Jun 2026)—no public TBR list.
- **Build constraints:** server-side or owner-run tooling (no API key on the static site); Google terms + cost TBD; not required for Bookcheck to work.

### Bookcheck vet source labels (owner Jun 2026)

Bookcheck should know **which kind of vet** powered the result and say so plainly—without changing Halalit’s rules.

| Owner state | Reader-facing line (draft) | Notes |
|-------------|---------------------------|--------|
| **Hand-vetted** (live code + `HALALIT-HAND-VETTED-CLEAN-LIST.md`) | Hand-checked — same as today (`verified_clean` / coded notes / firm nos) | Highest trust |
| **AI staging list (Jun 2026)** — `HALALIT-AI-VET-STAGING.md` | *AI likely okay — not hand-checked* / *AI flagged for review — not hand-checked* / *AI likely rejection — not manually checked* | AI screen (LGBTQ/adult romance/profanity etc.) **≠** full Halalit rules. **not** hand-vet or hand-reject. Hand-vet wins when both exist. |
| **Hand vet in progress** — **secondhand vetted** | *Hand vet in progress* — not built yet | `halalit/.cursor/private/HALALIT-SECONDHAND-VETTED.md` |
| **AI only** (Google per-lookup scan) | *AI-checked for themes; human vetting takes time* | Google theme scan (no fanservice) + catalog; Halalit rules applied after; not “safe” |
| **Catalog only** (no AI run yet / AI failed) | Not hand-verified — same as today | No fake AI badge |

- [x] **Vet-source flag on lookup (live Jun 2026)** — Bookcheck banners: hand-checked, AI-checked for themes, catalog-only, fanservice not checked on comics.
- [x] **Vet-source — AI staging list (Jun 2026)** — `halalit-ai-vet-staging.js` from `HALALIT-AI-VET-STAGING.md`.
- [ ] **Vet-source — secondhand** — `vet_in_progress` when secondhand list ships on site.
- [x] **Owner lookup notifications (Jun 2026)** — Reader Bookcheck lookups log to **Owner’s Office** (`owner.html`): popular + recent tables, vet/discretion/reject from rows. Private to owner—not a public wall.

  **Where pings could show (pick when building; default suggestion: owner-only page + optional email):**

  | Option | What you’d see |
  |--------|----------------|
  | **A. Owner-only page on Halalit** (needs server + login or secret link) | A private “Books readers looked up” queue: title, author, count, last checked—tap to copy into vet workflow. Not on the public site nav. |
  | **B. Email digest** | Daily or weekly mail: top unchecked lookups. Works without you logging into the site. |
  | **C. Server log / export** | A file on the VPS (or download) you open in Cursor when you want—no reader UI. |
  | **D. Bundled with [Personal accounts](#4-personal-accounts)** | Same admin lane as Book Quest “learned something Halalit missed?” feedback to owner—one owner inbox, not public. |

  Needs server-side logging of Bookcheck lookups (title/author only; no reader names required). **Rejected** titles do not ping. **Comics/manga / fanservice:** no Google AI—readers see that **panel presentation and fanservice have not been checked yet** until you hand-vet; other themes on the same lookup may still use AI if enabled.
- **Rejected** = already in live code as firm no / `flag_review` / hardest never-recommend with owner decision—**no** “please vet this” ping for those.
- **Trust order unchanged:** hand-vet beats TBR/secondhand beats AI; AI never softens hardest nos. **Fanservice on comics/manga:** no AI call—copy is *not checked yet* for panel/fanservice until hand-vet.

### Halalit — help & reader input (owner)

- [ ] **Site help: FAQ first** — Curated “how Halalit works” (tabs, Book Quest vs Bookcheck, recommendation types, **Advanced recommendations settings**, honest limits). Short in-context hints on Home / Book Quest / Bookcheck. Optional later: **help search** over that copy only (suggested questions + keyword match)—**not** an open chatbot. No book-safety or “is this okay?” answers in help (send to Bookcheck). No internal design detail in user-facing copy.
- [ ] **Reader suggestions box** — Private way for readers/parents to send suggestions (books, features, site ideas) to the owner—not a public wall. Scope TBD (email, form, export); align with warmth-without-social.

### Library & bookstore availability (direction / later — Jun 2026; clarified Jul 2026)

**Direction:** help readers find where a Wishlist title actually shows up — not Libby checkout, no library card required for v1.

- [x] **Practice — Santa Clara Central Park Library (Jul 2026)** — Wishlist library check via Halalit API `POST /api/library/check` + BiblioCommons gateway. **Yes** = borrowable copy at branch code `C` (checked out OK). Citywide / Mission / Northside not yet.
- [x] **Practice — Cupertino Library / Santa Clara County (Jul 2026)** — Same API with `placeId: sccld-cupertino` (SCCLD BiblioCommons `sccl`, branch `CU`). Wishlist UI: **Choose library** dropdown, then Check.
- [ ] **Wishlist → library & bookstore catalog check** — From Wishlist, check **public** catalogs for places the reader saves or types in (library name, bookstore, catalog URL). Only list places where the title/ISBN **actually matches** — skip fuzzy “did you mean…” junk when the real book isn’t there. **Libraries:** “in catalog” is enough (not live shelf status). **Bookstores:** in stock online or preorder when the site shows it. Start with a **short local list** (owner-configured or hand-wired for the reader’s area); expand later. In-person asks at a library/indie may unlock a reliable hook for that system. *(UI note: dropdown placeholder becomes “Choose library/bookstore” when bookstores are wired.)*

  **Example local list shape (owner’s Seattle-area notes — not the only region):** public libraries with searchable catalogs; indie shops with honest shelf/preorder lines (e.g. Third Place Books, Queen Anne Book Co, Elliott Bay); chain stores that expose **store-specific** pickup stock (e.g. B&N locations the reader actually uses). Skip used/recycle shops without reliable online inventory; skip stores whose site/Bookshop.org page does **not** reflect shelf stock.

- [ ] **Availability on Bookcheck + Book Quest (later)** — Same “where can I get it?” idea next to a pass/recommend path — after Wishlist check pattern exists. Not instead of safety copy.
- [ ] **Linked library cards / accounts (later / optional)** — Deeper than public-catalog “in catalog.” Needs [Personal accounts](#4-personal-accounts) or scoped library links; **minimal sensitive data**; no public borrow profile. **Not** required for Wishlist catalog-check v1.
- [ ] **Bookstore connectors — catalog-backed only** — Prefer retailers/indies with a real inventory or honest product page. **Exclude** recycle / used shops that don’t know stock online. Copy must match what each connector can honestly say.
- **Open questions before build:** Per-area place list vs only reader-saved places; server-side fetch + cache (don’t hammer catalogs from the browser); store-ID flows for chains; “open on their site to confirm” always; rate limits; “Halalit is not the library/store” disclaimer.

### Owner plot-vet batch (May 2026)

**Rule:** Do not re-offer titles below in new batches until the owner asks (see `.cursor/rules/halalit-plot-vet-no-repeat.mdc`).

- **Verified clean (deity/mythology + magic opt-in):** *Wingbearer* (Marjorie M. Liu graphic novel)—afterlife mythology; no fanservice; not Nicki Pau Preto prose series
- **Verified clean (deity/mythology opt-in, book 1 only):** *Shadow of the Dragon: Kira* (Kate O'Hearn)—brief mythology; book 2 *Elspeth* not vetted
- **Verified clean (light romance + deity opt-in):** *Dragon Slippers* trilogy (Jessica Day George)—annoying extended-family friction (not villainized parents), light romance, Greek-style mythology; exclude light romance and/or deity/mythology on play page if needed
- **Verified clean (negative family portrayal + magic opt-in, book 1 only):** *Nevermoor: The Trials of Morrigan Crow* (Jessica Townsend)—very negative family portrayal; books 2+ flagged separately
- **Verified clean (light romance + negative family portrayal):** *The Rose Legacy* trilogy (Jessica Day George)—mother as irredeemable villain, light romance
- **Verified clean (light romance opt-in):** *At First Bite* / *This Totally Bites!* (Poison Apple, Ruth Ames)—prom noted on latter; Book Quest fantasy picks when play-page light-romance box checked
- **Verified clean (Islamic-lit shelf signal):** *Ameena's Ramadan Diary* (Sara Kabil)—recommend / Book Quest realistic fiction only when Personal Library or want-to-read already shows Islamic-literature interest
- **Verified clean:** *Seekers of the Wild Realm* duology (Alexandra Ott), *Green Deen* (Ibrahim Abdul-Matin; Book Quest nonfiction only), *The Wolf Princess* (Cathryn Constable)
- **Verified clean (Book Quest pool, Jun 2026):** *Brian’s Winter* (territory-marking survival beat), *Brown Girl Dreaming*, *The Girl Who Drank the Moon* (magic opt-in), *The Last Kids on Earth* (childish gross humor), *Heidi* (Johanna Spyri)—owner: fine to recommend; Bookcheck faith-in-story flag (Christian gratitude/church—not deity/mythology tier)
- **Parked (off Book Quest / re-check):** *Encyclopedia Brown* — back on parked list (stereotype portrayals); *The Wild Robot* (book 1) — owner idk, not hand-vetted yet; *Harry Potter* — owner editing recommendation (off verified clean until cleared); *The Marvelous Land of Oz* (Oz #2) — owner re-checking (gender transformation, domestic sexism tone); rest of Oz line OK; *Hercule Poirot mysteries* (Agatha Christie)—heavier content, Teens/Adults only if cleared; owner may reject if adult romance found; not verified clean
- **Bookcheck flag / no Book Quest (Jun 2026):** *ASOUE* — never Book Quest; adult/inappropriate refs + “keep in mind if you read”; *Keeper of the Lost Cities* — MG romance, clean through book 9 in owner scope, LGBTQ in 9.5; owner re-checking books 1–9
- **Book Quest pool (Jun 2026):** *Fortunately, the Milk* (Neil Gaiman), *Half Moon Investigations* + *Airman* (Eoin Colfer)
- **Verified clean (standalone MG fantasy, Jun 2026):** *The Prince of Nowhere* (Rochelle Hassan)—sad beats; magic opt-in; not on Book Quest pool
- **Verified clean (deity + substance + family + light romance opt-in):** City Trilogy / *City of Fire* line (Laurence Yep) — largely clean; heavy mythology; wine; tanuki tension; absent-family negativity; Book Quest when Advanced settings allow
- **Verified clean:** Magic Tree House, Winnie-the-Pooh, Where the Wild Things Are, The Cat in the Hat, The Mysterious Benedict Society, Fablehaven, *The Girl with the Silver Eyes* (Willo Davis Roberts), Alice in Wonderland / Through the Looking-Glass, Hatchet (parent/mental-health notes), Goodnight Moon, Curious George (original kidnapping beat flagged), Very Hungry Caterpillar, Don’t Let the Pigeon Drive the Bus, The Lorax, Green Eggs and Ham, Harold and the Purple Crayon, Treasure Island (inn/alcohol note), Ella Enchanted (stepfamily bashing note), Gregor the Overlander (romance hints), The Giving Tree / Where the Sidewalk Ends, Chicka Chicka Boom Boom, Brown Bear Brown Bear, The Little Engine That Could, Nancy Drew — The Secret of the Old Clock (title only), The Rainbow Fish, Cloudy with a Chance of Meatballs, The Witches, Black Beauty (racist Muslim-name reference flagged), The Twits, The Graveyard Book (dark tone note), The Sneetches and Other Stories, Fox in Socks, Hop on Pop, Love You Forever, Are You My Mother?, The Enormous Crocodile, The Magic Finger (middle-finger joke note), Henry Huggins, One Fish Two Fish Red Fish Blue Fish, The Cat in the Hat Comes Back, Yertle the Turtle and Other Stories, Bartholomew and the Oobleck, The Very Busy Spider, Ribsy, Beezus and Ramona (sister-love lesson flagged), Where’s Spot?, The Giraffe and the Pelly and Me, Horton Hears a Who!, Dr. Seuss’s Sleep Book, The 500 Hats of Bartholomew Cubbins, If I Ran the Zoo, If I Ran the Circus, additional Dr. Seuss batch (King’s Stilts through Butter Battle Book), The House at Pooh Corner / When We Were Very Young / Now We Are Six (Pooh-line; owner hasn’t re-read), Guess How Much I Love You, The Wonderful Wizard of Oz (inadvertent villain deaths noted), Oz series (clean except Marvelous Land of Oz / General Jinjur sexism flag), Sisters Grimm (dark beats + parent bashing noted), Spiderwick Chronicles (series clean)
- **Firm no (owner Jun 2026):** *Cruel is the Light* (Sophie Clark)—adult romance + heavier content; no Book Quest or family shelf.
- **Firm no (owner Jun 2026):** *The Ether Witch* trilogy (Delemhach)—concubine as a main villain; no Book Quest or family shelf.
- **Firm no (owner Jun 2026):** *The Secret World of Briar Rose* (Cindy Pham)—queer Sleeping Beauty retelling; teen/YA; no Book Quest or family shelf.
- **Won’t Book Quest (owner Jun 2026):** *Amina's Voice* / *Amina's Song* (Hena Khan)—plot largely clean; book 2 brother smoking addiction; parent clashes over “too strict” religion (culture misrepresentation + family negativity flags); not verified clean.
- **No recommend / flag:** Charlie and the Chocolate Factory (white-savior themes), Diary of a Wimpy Kid, How to Train Your Dragon, Eragon (book 1 opening), All Four Stars (Tara Dairman — book 3 LGBTQ portrayal; MG romance 2–3 OK), Nevermoor books 2+ (Jessica Townsend — LGBTQ + Israfel/Muslim-beliefs misrepresentation; book 1 verified clean separately), *Mr. Lemoncello’s Library* (series — later LGBTQ), *The Boy Who Harnessed the Wind* young readers edition (sister/teacher elopement beat), Keeper of the Lost Cities (series — later LGBTQ), The School for Good and Evil (firm no—whole series; adult refs + later LGBTQ beat; magic noted but not the ban reason), Wings of Fire (whole series — family bashing + later LGBTQ), The Hunger Games, Land of Stories (won’t Book Quest—parent decide), Animorphs (parked—book 3 bird-morph attraction beat; author LGBTQ subtext comments; re-checking), Captain Underpants (crude humor), Fantastic Mr Fox (alcohol positivity), Danny the Champion of the World (theft normalized), George’s Marvelous Medicine (grandmother bashing), Julie of the Wolves (won’t Book Quest—parent discretion; marriage beat; deity/mythology), Madeline (series — derogatory Romani / “Gypsy” portrayal), Horton Hatches the Egg (taking another animal’s egg/child), Howl’s Moving Castle (adult relationships—not fully vetted), The Jungle Book (immodesty—Mowgli unclothed), The Marvelous Land of Oz (General Jinjur—sexist toward women in power)
- **Deity / religious comfort (won’t Book Quest):** Grace Lin folklore trilogy, Anzu and the Realm of Darkness, How the Grinch Stole Christmas! (Christian Christmas story)
- **Verified clean (off Book Quest, notes for parents):** *Wonder* (R.J. Palacio)—mostly hand-vetted clean; gross kid humor + jokey “boyfriend” insult (not LGBTQ); married father’s affair, other woman’s baby, pending remarriage parks Book Quest; `Notes for parents` in Bookcheck
- **Parked — commented idk only (do not re-ask):** Narnia, Holes, Bridge to Terabithia, The Giver, The Golden Compass, Redwall, Stuart Little
- **Parked — batch 3 unanswered (do not re-ask):** Peter Pan, Paddington, Because of Winn-Dixie, Inkheart, The Westing Game, Number the Stars, Where the Red Fern Grows, Little Women, The One and Only Ivan, The Tale of Despereaux, From the Mixed-Up Files of Mrs. Basil E. Frankweiler, Tuck Everlasting, The Phantom Tollbooth, Shiloh, The Penderwicks
- **Parked — batch 4 unanswered (do not re-ask):** Make Way for Ducklings, The Snowy Day, Corduroy, If You Give a Mouse a Cookie, The Gruffalo, The Velveteen Rabbit, The Wind in the Willows, Maniac Magee, The Indian in the Cupboard, Guardians of Ga’hoole: The Capture
- **Parked — batch 5 unanswered (do not re-ask):** We’re Going on a Bear Hunt, Room on the Broom, Dragons Love Tacos, The Day the Crayons Quit, Last Stop on Market Street, Mike Mulligan and His Steam Shovel, Island of the Blue Dolphins, The Hardy Boys: The Tower Treasure, Junie B. Jones and the Stupid Smelly Bus, The Trumpet of the Swan, A Swiftly Tilting Planet
- **Parked — batch 6 idk (do not re-ask):** Old Yeller (film had anti-Native representation—book not vetted), Press Here, Olivia, Goodnight Gorilla, Strega Nona, Sylvester and the Magic Pebble, The True Story of the Three Little Pigs, The Cricket in Times Square, Bunnicula, The Best Christmas Pageant Ever, Frindle, Hoot, Roll of Thunder Hear My Cry, Esperanza Rising, The Polar Express, Jumanji, Goosebumps: Welcome to Dead House
- **Parked — batch 7 idk (do not re-ask):** Dog Man, Mrs. Frisby and the Rats of NIMH, Mr. Popper’s Penguins, The Tale of Peter Rabbit, Owl Moon, The Kissing Hand, Goodnight Goodnight Construction Site, If You Give a Pig a Pancake, The Napping House, The City of Ember, The Sign of the Beaver, Sounder, Johnny Tremain, Call It Courage, Poppy
- **Parked — batch 8 idk (do not re-ask):** Stone Fox, My Side of the Mountain, The Borrowers, The Rescuers, The Hundred and One Dalmatians, Loser, Stargirl, The Mouse and the Motorcycle, Runaway Ralph, Dear Mr. Henshaw, A Girl Named Disaster, The Ear the Eye and the Arm, The View from Saturday, The Great Gilly Hopkins, The Cay, Stone Soup (blurb suggests blame toward townspeople who won’t share food with soldiers—not fully vetted)
- **Parked — batch 9 idk (do not re-ask):** The Paper Bag Princess, Go Dog. Go!, The Stinky Cheese Man, The Whipping Boy, Over Sea Under Stone, The Dark Is Rising, Five Children and It, Half Magic, Just So Stories, The Railway Children, Nothing but the Truth
- **Parked — batch 10 idk (do not re-ask):** The Story of Ferdinand, Caps for Sale, No David!, Llama Llama Red Pajama, The Very Quiet Cricket, From Head to Toe, The Miraculous Journey of Edward Tulane, The Pinballs, Crispin: The Cross of Lead, The True Confessions of Charlotte Doyle
- **Parked — batch 11 idk (do not re-ask):** McElligot’s Pool, My Father’s Dragon, Elmer and the Dragon, The Dragons of Blueland, The Tale of Benjamin Bunny, The Tale of Jemima Puddle-Duck, The Tale of Squirrel Nutkin, Castle in the Air, The Sign on Rosie’s Door, In the Night Kitchen
- **Parked — batch 12 idk (do not re-ask):** The Tailor of Gloucester, The Tale of Tom Kitten, The Tale of Mrs. Tiggy-Winkle, The Enchanted Castle, The Phoenix and the Carpet, The Secret of Platform 13, The Mouse and His Child, Farmer Boy
- **Parked — batch 13 idk (do not re-ask):** Little House series (entire line), Mrs. Piggle-Wiggle, The Doll People, Journey to the River Sea, Which Witch?, The Little White Horse, The Twenty-One Balloons, The Garden of Abdul Gasazi, Tuesday, Zathura, The Egypt Game, The Headless Cupid, The Witches of Worm, Outside Over There, Higglety Pigglety Pop!, Chrysanthemum, Lilly’s Purple Plastic Purse, The Runaway Bunny
- **Parked — batch 14 idk (do not re-ask):** Owen, Chester’s Way, Julius the Baby of the World, Officer Buckle and Gloria, Stellaluna, Owl Babies, Interrupting Chicken, The Relatives Came, When I Was Young in the Mountains, Sarah Plain and Tall, The Last of the Really Great Whangdoodles, The Wheel on the School, The Sheep-Pig (Babe), The Wolves of Willoughby Chase, Homer Price, Centerburg Tales, The Moffats, Blueberries for Sal, Time of Wonder
- **Parked — batch 15 idk (do not re-ask):** Black Hearts in Battersea, The Gammage Cup, The Great Brain, Bud Not Buddy, The Watsons Go to Birmingham—1963, The War That Saved My Life, The War I Finally Won, Crenshaw, The One and Only Bob, The Tale of the Flopsy Bunnies, The Tale of Pigling Bland, The Tale of Samuel Whiskers, Surprise Island, The Yellow House Mystery, Sheila Rae the Brave, Wemberly Worried, A Bargain for Frances, Bedtime for Frances
- **Parked — batch 16 idk (do not re-ask):** The Hundred Dresses, Ginger Pye, Pinky Pye, Leon (I Mean Noel), Figgs & Phantoms, The Tattooed Potato and Other Clues, A Long Way from Chicago, A Year Down Yonder, The Door in the Wall, Adam of the Road, The Witch of Blackbird Pond, The Bronze Bow, The Matchlock Gun, The Black Stallion, King of the Wind, Misty of Chincoteague, My Friend Flicka, The Silver Crown, The Master Puppeteer, The Perilous Gard, The King’s Equal, The Moves Make the Man, Midnight Hour Encores, Skellig, The Firework-Maker’s Daughter, The Scarecrow and His Servant, I Was a Rat!, The Minstrel in the Tower, The Witch of Fourth Street, The Best School Year Ever
- **Parked — batch 17 idk (do not re-ask):** The Best Halloween Ever, Among the Hidden, Among the Imposters, Running Out of Time, Crash, Wringer, Eggs, Lunch Money, The Report Card, No Talking, The School Story, A Week in the Woods, The Homework Machine, Honus & Me, Regarding the Fountain, The Castle in the Attic, The Battle for the Castle, Wait Till Helen Comes, The Doll in the Garden, The Famous Stanley Kidnapping Case, The Ghosts of Rathburn Park, Greenwitch, The Grey King, Silver on the Tree, The Boggart, Momo, The Neverending Story, Ida Early Comes Over the Mountain
- **Won’t Book Quest—parent decide:** Queenie Peavy (smoking not called out)
- **Vet batches paused:** Owner requested coverage map instead of 30-title lists until asked again
- **List A starters (May 2026):** Owner pass on untouched high-priority franchises — see `halalit/HALALIT-VET-UNTOUCHED.md`; coded notes in `halalit-curated-shelf-warnings.js`
- **Parked — batch 18 idk (do not re-ask):** Among the Betrayed, Among the Barons, Among the Brave, Among the Enemy, Among the Free, The Landry News, Room One, The Jacket, The Last Holiday Concert, Extra Credit, The Million Dollar Shot, Babe & Me, Jackie & Me, Shoeless Joe & Me, Regarding the Trees, D'Aulaires' Book of Greek Myths, D'Aulaires' Book of Norse Myths, The Dollhouse Murders, Z for Zachariah, Jim Button and Luke the Engine Driver, Jim Button and the Wild 13, Swallows and Amazons, Swallowdale, Peter Duck, Mystery Ranch (Boxcar #4), Blue Bay Mystery (Boxcar #6), The Lighthouse Mystery (Boxcar #8), All About Sam, Anastasia Krupnik
