# Halalit — roadmap & todo

**How to use**

- **You:** Say “add to my todo list” (or similar) in chat — agents append under [Your additions](#your-additions) here. This file is **not** on the live site; only `halalit/www/` is reader-facing.
- **Agents:** When Halalit is in scope, read this file for **direction** and **tasks**. Check off `[x]` when something is done; do not drop roadmap ideas when planning.
- **Showing the list:** Owner **active todo** = [Active tasks](#active-tasks) + [Your additions](#your-additions) only. **Direction / later** = entire [Product direction](#product-direction-roadmap) section (museum walk, reading weather, gifts, lofi nook, personal accounts—including **shelf feedback to owner**, friend codes). Do not mix direction into active todo unless the owner asks for direction too.
- **Default when owner asks for “the todo list” (Jun 2026):** Give **active todo** only—**exclude** items that are **not shippable yet**: library reader nook / home “Your reader in the library” animation, gifts / Reader Points while nook is off, personal accounts / login / friend codes / shelf-feedback-to-owner, hub-wide **better animation** polish. Say they’re parked if helpful. Give the **full** overview (active + direction + additions) only when they ask for **whole thing**, **full roadmap**, or **everything**.

---

## Active tasks

### Reading milestones — earned badges (Jul 2026)

- [x] **Milestone badges v1** — Private Personal Library panel; thresholds 10 / 25 / 50 / 100 / 250 / 500; soft toast on new unlock; account/device storage via `halalitReadingMilestonesEarned`.
- [ ] Themed month badges + banner (after milestone polish)
- [ ] Rare keepsakes / year wrap (not one per book)

### Book Wander — browse trusted books (Jul 2026)

- [x] **Book Wander** tab (`#suggests`; redirect from `suggests.html`) — age band first, spotlight + see more, themed rooms, series lobby (next unread vs Already read), trusted-only search, seasonal room highlight (Father’s/Mother’s weeks). Hand-vetted display pool only; cards open Bookcheck. No public reviews. (Formerly called Halalit Suggests.)
- [ ] Grow theme membership + multi-volume series order as owner hand-vets / assigns rooms
- [ ] Later: mood / Book Quest doors (#5) and museum walk (#7) — parked on purpose

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

**Timing (Jul 2026):** **Earned** badges / keepsakes can ship **without** the nook — see [Earned rewards first](#earned-rewards-first-owner-jul-2026--no-spend-shop-yet). **Spend** shop (Reader Points → decor) stays tied to the animated reader + personal space pipeline while the nook is off (`libraryReaderNookEnabled = false`).

- Avoid **print-first** or disposable **paper** gifts (bookmarks, etc.) as the default path because of waste and low use.
- Prefer **non-tangible gifts**: copy-to-clipboard, save-in-site, optional **screen-sized** share image, unlock extra on-site content — not “print this slip.”

#### Earned rewards first (owner Jul 2026) — no spend shop yet

**Ship now (no nook required):** private **earned** objects only — milestone badges, themed-month badges/banners (later), rare keepsakes (later). **Not** one prize per book. Favors people who want to read more; no public leaderboard.

- [x] **Milestone badges (v1)** — Count distinct finished Personal Library titles; soft landmarks at 10 / 25 / 50 / 100 / 250 / 500; private panel on Personal Library; “oh, here’s a…” when a new threshold is crossed. `halalit-reading-milestones.js`.
- [ ] **Themed month banner + badge** — BHM / WHM etc.; owner disclaimer; badge as memento; modest in-month points bump only when a spend economy exists.
- [ ] **Rare keepsakes** — year wrap / big landmarks only — not one card per finish.
- [ ] **Year reading challenge** — Goodreads-shaped self-set yearly number; near-deadline finishable suggestions later.

**Spend shop / Reader Points — parked** until there is something interesting to buy without nook animation (cosmetics were judged not worth it for now). Nook decor shop stays tied to the lofi reader when that ships.

#### Reader Points (or similar name) + decor shop (later / with nook)

- Users earn points and **spend them on site decor** for their avatar / personal space: e.g. reading chairs, animals, outfits — **family-friendly, modest presentation**.
- **Outfit rules:** non–form-fitting; **no** emphasis on body shape. For anything shown **below the face**, visible skin is **limited to the hand and a very small amount of wrist** (no broader “below the neck” skin show).
- Implementation details TBD; preserve this direction when designing economy and art. Do not build while earned-only pass is the focus.

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
- [ ] **Gifts / Reader Points + decor shop** — With or after nook; see [Gifts](#3-gifts--intangible-by-default). Earned badges/keepsakes ship **without** waiting on the nook.
- [x] **Milestone badges (Jul 2026)** — See [Earned rewards first](#earned-rewards-first-owner-jul-2026--no-spend-shop-yet).

### Cross-cutting

- Do not assume **public comments** or stranger-posted text for warmth; prefer curated voice, local/private saves, and non-toxic patterns (see `warmth-without-social.mdc` if present).

---

## Your additions

### Book Quest — prose vs comic adaptations (owner Aug 2026)

Pin only — decide scope later; not built yet.

- [ ] **Original vs graphic adaptation note** — For titles whose **prose originals** you’ve hand-vetted, Book Quest should clarify that a **graphic novel / comic adaptation is not always modest** even when the original book was. Keep the line short. Example concern: swimsuit / outfit panels in some *Cupcake Diaries* graphics (*Emma All Stirred Up*) that the prose didn’t show; not every adaptation does this (*Anne of Green Gables* graphic was fine in owner scope). Mean the **original prose edition** when recommending, not “the comic plot is wrong.”
- **Open decisions:** which titles get the line; whether *Cupcake Diaries* stays off Book Quest (current: parent discretion / romance-heavy, won’t auto-recommend) or joins with this note; Bookcheck-only vs Book Quest blurb vs both.

### AI vet batch logged (Jun 2026)

- [x] **AI staging live on Bookcheck (Jun 2026)** — `HALALIT-AI-VET-STAGING.md` → `halalit-ai-vet-staging.js`; banners: *AI likely okay — not hand-checked*, *AI flagged for review — not hand-checked*, *AI likely rejection — not manually checked*. Hand-vet always wins.
- Owner mirror: `halalit/.cursor/private/HALALIT-MY-TBR-LIST.md`
- **Howl's Moving Castle** — AI manual queue only; owner did **not** hand-reject.
- **Watership Down** — AI manual queue; owner roster still Teens/Adults hand-clean until reconciled.

### Reader accounts — owner choices (Jun 2026)

- **Halalit only** (not oddtrove-wide / not Maestro’s, envDyst, etc.).
- **Login required, with a free trial (owner Jul 2026)** — Halalit generally **requires sign-in**, but new visitors get a **free taste** first: they can run a **few Book Quests and Bookchecks without an account** so they know what they're getting into, then are prompted to sign up to keep going. Goal: turn triers into real customers. Trial limits (how many quests/checks, per device vs per browser session, how the wall is worded) TBD at build time. Everything else (saving shelves, prefs, wishlist, favorites) still needs an account.
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

### Eco / lighter Bookcheck (Jul 2026)

- [x] **Scroll Scanner barcode-only (Jul 2026)** — Removed front-cover photo / lettering vision; ISBN barcode or type the title → Bookcheck.
- [x] **Shared theme-scan cache (Jul 2026)** — Server stores successful AI theme-scan answers by book; later lookups of the same title reuse the save (hand-vet still wins). No new extensions required.
- [x] **Gemini-only theme scan (Jul 2026)** — Bookcheck red-flag scan no longer runs Claude in parallel; Gemini only (hand-vet still wins).
- [x] **Owner shelf photo scan removed from live (Jul 2026)** — Multi-title shelf camera + `/api/owner/shelf-identify` taken off Owner’s Office / API (410). **Parked:** may restore later from git; Owner scanned TBR + barcode owner scanner remain.
- [x] **Cover-identify API removed (Jul 2026)** — `/api/cover-identify` returns 410; Scroll Scanner is barcode/type only. **Parked on roadmap** if ever reconsidered.

### Bookstores — in-person first + scraping (owner Aug 2026)

Pinned under [Library & bookstore availability](#library--bookstore-availability-direction--later--jun-2026-clarified-jul-2026-bookstore-in-person-goal-aug-2026) (full detail there).

- [ ] **In-person bookstore efficiency** — Foot traffic to favorite shops (B&N Stevens Creek, Kepler’s, etc.) over Amazon/eBay mail-order; directions / check-stock CTAs first.
- [ ] **Live ISBN scraping (when enabled)** — ~~Paused.~~ Product-page checks **on** for yes/partly stores; robots-safe; honest tiers (hit / order online / hide).
- [ ] **UX honesty pass** — No fake “online listing found” on verification failed; no stock claims from popularity alone.

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

- [x] **Google theme scan (live Jun 2026)** — Bookcheck calls server API on port 8075; needs `HALALIT_GEMINI_API_KEY` in `oddtrove-server/.env` on VPS. See `halalit/server/README-BOOKCHECK-AI.md`. Themes: LGBTQ, magic, deity/mythology, pro-colonial, romance, substance, etc.—**never fanservice** (comics: “not checked yet” for panels; owner: Pokemon manga). Rules unchanged; hand-vet wins.
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
- [x] **Owner Office — Bookchecks vs My TBR + dismiss (Jul 2026)** — Auto-reject–style scan signals go under Bookchecks (with short summary), thin/indie under My TBR; dismiss → trash / dismiss forever on notification lists (not site settings). Existing lookups backfill on Office open.
- [x] **Owner scanner — shelf photo + Owner scanned TBR (Jul 2026)** — Shipped then **shelf photo removed from live (Jul 2026)**; see Eco / lighter Bookcheck. Owner scanned TBR + owner barcode Scroll Scanner remain.
- [x] **Owner shelf scanner — coach-only + honest reads (Jul 2026)** — One capture path (camera coach → Capture & scan); coach rejects mostly-empty frames without nose-to-shelf; Gemini requires title+author, flags obstruction / unclear author, avoids invented lookalikes.

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

### Library & bookstore availability (direction / later — Jun 2026; clarified Jul 2026; bookstore in-person goal Aug 2026)

**Direction:** help readers find where a Wishlist title actually shows up — not Libby checkout, no library card required for v1.

**Bookstore product goal (owner Aug 2026):** Make **going into bookstores in person** more common than buying the same title from Amazon/eBay (or other mail-order) without a visit. Libraries still matter when they have the book; bookstores matter when libraries don’t (or the reader wants to buy). Halalit is a **foot-traffic helper**, not a checkout cart. Prefer local shop CTAs (directions, hours, “check stock at [this store]”, open that store’s title page) over ship-to-home / marketplace links.

**Honest capability tiers (don’t invent shelf stock):**
- Library clear yes → show borrowable / initials as today.
- Bookstore clearly doesn’t have it → **don’t** list as a hit.
- Might have it / online listing only / can’t prove shelf → **“Check stock at [Stevens Creek / Menlo Park / …]”** + link-out — not “in stock here.”
- Verification failed / nothing known → hide from hits or one quiet “couldn’t verify” — never a fake availability card.
- If the site doesn’t mention pickup → say **unknown**, not “no pickup.”
- Popularity / Netflix / “biggest books” may **prioritize check order** only — never claim stock from fame alone.

**Site reality (Bay Area starters):**
- **Libraries** — best in-person signal when catalog says borrowable.
- **Kepler’s / similar indies** — product page often closer to “this shop”; robots block `/search/` and `/books/`; ISBN `/book/{isbn}` checks when enabled + permitted.
- **B&N (e.g. Stevens Creek #1944)** — stronger online product / order signals; weaker guaranteed “on this store’s shelf”; robots block `/search`; ISBN/`ean` product checks when enabled. Store page + directions are the main in-person lever when shelf stock isn’t proven.
- No bypass of CAPTCHA, login walls, or Disallow paths. Prefer official feeds/APIs if a store offers them.

- [x] **Practice — Santa Clara Central Park Library (Jul 2026)** — Wishlist library check via Halalit API `POST /api/library/check` + BiblioCommons gateway. **Yes** = borrowable copy at branch code `C` (checked out OK). Citywide / Northside not yet.
- [x] **Practice — Santa Clara Mission Branch Library (Jul 2026)** — Same city catalog (`sclibrary`), `placeId: santa-clara-mission`, branch code `M`. **Yes** = borrowable at Mission only (not citywide).
- [x] **Practice — Cupertino Library / Santa Clara County (Jul 2026)** — Same API with `placeId: sccld-cupertino` (SCCLD BiblioCommons `sccl`). **Yes** = borrowable somewhere in the **county** system (holds between branches count); not Cupertino-shelf-only. Wishlist UI: **Choose library** dropdown, then Check. Title match tightened so short titles don’t false-uncertain against longer different titles.
- [x] **Wishlist favorites + soft tip (Jul 2026)** — Reader saves favorite placeIds (`halalitLibraryFavoritePlaces`, device/account). Hover or focus a wishlist spine/list row checks **all** favorites (client cache + sequential delay); tip e.g. “Currently available at Central Park and Cupertino.” Batch dropdown check kept as fallback. Three practice libraries only (no bookstores yet; no freeform place typing).
- [x] **Wishlist library initials on spines (Jul 2026)** — Hover tip removed. After **Check libraries** (favorites only), matching wishlist spines/list rows show readable initials (**SC** Central Park, **M** Mission, **C** Cupertino county) plus a short legend under the panel. First 10 wishlist titles per run.
- [x] **Reader-added libraries — community, not BiblioCommons-only (Jul 2026, local)** — Policy gate admits community public libraries (homepage or catalog). **BiblioCommons** → auto borrowable checks. **Other community systems** (e.g. Berkeley CARL) → auto-add as **open catalog** favorites (Check opens search; no fake spine initials). Pending only if name-only / not clearly community. Scam/deny → hard reject. Not deployed until owner says deploy.
- [ ] **Wishlist → library & bookstore catalog check** — From Wishlist, check **public** catalogs for places the reader saves or types in (library name, bookstore, catalog URL). Only list places where the title/ISBN **actually matches** — skip fuzzy “did you mean…” junk when the real book isn’t there. **Libraries:** “in catalog” is enough (not live shelf status). **Bookstores:** only claim what that location’s source can prove (see tiers above). Start with a **short local list**; expand later. *(UI: “Choose library/bookstore” when bookstores are wired.)*
- [ ] **In-person bookstore efficiency (Wishlist)** — Favorite specific shops; batch “check my bookstore locations”; hero actions = directions / hours / phone / “check stock at [store]” / open that store’s title page. Rank local bookstore before Amazon/eBay/mail-order. Soft demote or omit ship-to-home as the primary CTA. Fix misleading “online listing found” when verification actually failed.
- [ ] **Live ISBN checks (paused → enable when owner OK)** — ~~Per-store adapters paused.~~ **Enabled Aug 2026** for yes-tier Indies + partly-tier B&N / Kinokuniya — ISBN product pages only; no `/search` or `/books/` crawl. Opt out: `HALALIT_BOOKSTORE_LIVE_CHECKS=0`.
- [ ] **Check-order priority** — When running live bookstore jobs, check high-signal ISBNs first (wishlist + popular / adaptation titles) as a **queue order**, then other wishlist ISBNs — still no stock claims from popularity alone.
- [ ] **Availability on Bookcheck + Book Quest (later)** — Same “where can I get it?” next to pass/recommend — after Wishlist pattern is solid. Not instead of safety copy. Still in-person-first for bookstores.
- [ ] **Linked library cards / accounts (later / optional)** — Deeper than public-catalog “in catalog.” Needs [Personal accounts](#4-personal-accounts) or scoped library links; **minimal sensitive data**; no public borrow profile. **Not** required for Wishlist catalog-check v1.
- [ ] **Bookstore connectors — catalog-backed only** — Prefer retailers/indies with a real inventory or honest product page. **Exclude** recycle / used shops that don’t know stock online. Copy must match what each connector can honestly say. Seek store feeds/APIs when scrapes are blocked (Green Apple / Kinokuniya often Cloudflare-403).
- [x] **Bookstore inventory aggregation scaffold (Aug 2026)** — Modular adapters + SQLite models + matching/freshness + Owner’s Office + Wishlist UI. **Location-first favorites** (e.g. B&N Stevens Creek #1944, Kepler’s Menlo Park, Green Apple Clement)—not generic chains; readers can add locations. Fixture + tests. Docs: `bookstore_inventory/README.md`.
- [x] **Live ISBN shelf checks enabled (Aug 2026)** — Yes-tier in-stock claims: Kepler’s, Green Apple, Book Passage, Booksmith, Copperfield’s. Partly-tier online-ordering claims: B&N Stevens Creek, Kinokuniya SF. Hide misses / bot blocks. Product pages only.
- **Open questions:** Per-area seed list vs only reader-saved places; how hard to demote marketplace links in UI; store-ID shelf signals for B&N when/if available; written permission or feeds from Kepler’s / Green Apple / B&N; rate limits; always “Halalit is not the library/store.”

### Community, awards & reading life (owner Jul 2026)

**Not built yet** — pins for later; no public comment walls (warmth-without-social). Prizes and challenges stay private to the reader (or curated one-way from Halalit), not stranger posting.

- [ ] **Reading challenges — yearly self-set number** — Goodreads-shaped; reader picks N for the year (not Halalit assigning 100). Near-deadline finishable suggestions + optional reflection reread later. Themed months (BHM, WHM…) are banners/badges, not a second quota — see [Earned rewards first](#earned-rewards-first-owner-jul-2026--no-spend-shop-yet).
- [ ] **Halalit Awards — single Book of the Halalit** — One clear award-style recommendation (not a long list)—owner-curated title that reflects Halalit values. Cadence TBD (annual / seasonal).
- [ ] **Recently published — definite recommends** — Updates highlighting new books that match Halalit values and are **firm recommends** (hand-vetted), not “parent discretion / you decide” titles. Separate lane from soft or caution notes.
- [ ] **Complete-series rule for firm recommends** — If a title is part of a series, Halalit only marks it a **for-sure recommend** when the **entire series is published** (and ethics/morals are otherwise clear). Incomplete / ongoing series stay out of the definite-recommend lane (or softer status) until the line is finished—or owner explicitly exceptions a standalone-safe book 1.
- [ ] **Halalit newsletter** — One-way owner newsletter (new firm recommends, awards, challenges, tips)—not a discussion forum. Opt-in; spare/junk email OK. Scope TBD (email only vs also on-site digest).
- [x] **On-site prizes — milestone badges (Jul 2026)** — Earned-only first slice; spend/points parked. Further prizes (themed-month badges, rare keepsakes) still todo under [Earned rewards first](#earned-rewards-first-owner-jul-2026--no-spend-shop-yet). No public leaderboard.
- [ ] **Category reading prizes (Halalit lens, not Goodreads)** — Themed-month badges + later category prizes for **clean minority-voice** / underserved-causes reads. Modest in-month points bump only when spend exists.
- [ ] **Year in books** — End-of-year (or school-year) private wrap for the reader’s own shelf: what they finished, challenges done, categories touched. Device/account only—no public sharing wall.
- [ ] **Bookcheck load screen — rotating tips** — Loading UI should **not** show the same line every time; rotate Halalit tips / how-to / values notes. Also a lasting place on-site for readers to browse those tips (FAQ-adjacent or Home/Bookcheck help), not only during load.
- [ ] **Author notes on recommended books (curated)** — Optional short comments from authors on titles Halalit would recommend. **Owner-vetted, one-way display only**—not an open author/reader comment thread. Logistics TBD (invite, quote rights, series-complete rule above).

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
- **Verified clean:** Magic Tree House, Winnie-the-Pooh, Where the Wild Things Are, The Cat in the Hat, The Mysterious Benedict Society, Fablehaven, *The Girl with the Silver Eyes* (Willo Davis Roberts), Alice in Wonderland / Through the Looking-Glass, Hatchet (parent/mental-health notes), Goodnight Moon, Curious George (original kidnapping beat flagged), Very Hungry Caterpillar, Don’t Let the Pigeon Drive the Bus, The Lorax, Green Eggs and Ham, Harold and the Purple Crayon, Treasure Island (inn/alcohol note), Ella Enchanted (stepfamily bashing note), Gregor the Overlander (romance hints), The Giving Tree / Where the Sidewalk Ends, Chicka Chicka Boom Boom, Brown Bear Brown Bear, The Little Engine That Could, Nancy Drew — The Secret of the Old Clock (title only), The Rainbow Fish, Cloudy with a Chance of Meatballs, The Witches, Black Beauty (racist Muslim-name reference flagged), The Twits, The Graveyard Book (dark tone note), The Sneetches and Other Stories, Fox in Socks, Hop on Pop, Love You Forever, Are You My Mother?, The Enormous Crocodile, The Magic Finger (family negativity note), Charlie and the Chocolate Factory / Great Glass Elevator, George’s Marvelous Medicine (grandmother / family negativity note), Henry Huggins, One Fish Two Fish Red Fish Blue Fish, The Cat in the Hat Comes Back, Yertle the Turtle and Other Stories, Bartholomew and the Oobleck, The Very Busy Spider, Ribsy, Beezus and Ramona (sister-love lesson flagged), Where’s Spot?, The Giraffe and the Pelly and Me, Horton Hears a Who!, Dr. Seuss’s Sleep Book, The 500 Hats of Bartholomew Cubbins, If I Ran the Zoo, If I Ran the Circus, additional Dr. Seuss batch (King’s Stilts through Butter Battle Book), The House at Pooh Corner / When We Were Very Young / Now We Are Six (Pooh-line; owner hasn’t re-read), Guess How Much I Love You, The Wonderful Wizard of Oz (inadvertent villain deaths noted), Oz series (clean except Marvelous Land of Oz / General Jinjur sexism flag), Sisters Grimm (dark beats + parent bashing noted), Spiderwick Chronicles (series clean)
- **Firm no (owner Jun 2026):** *Cruel is the Light* (Sophie Clark)—adult romance + heavier content; no Book Quest or family shelf.
- **Firm no (owner Jun 2026):** *The Ether Witch* trilogy (Delemhach)—concubine as a main villain; no Book Quest or family shelf.
- **Firm no (owner Jun 2026):** *The Secret World of Briar Rose* (Cindy Pham)—queer Sleeping Beauty retelling; teen/YA; no Book Quest or family shelf.
- **Won’t Book Quest (owner Jun 2026):** *Amina's Voice* / *Amina's Song* (Hena Khan)—plot largely clean; book 2 brother smoking addiction; parent clashes over “too strict” religion (culture misrepresentation + family negativity flags); not verified clean.
- **Parent discretion (Dahl, Jul 2026):** Fantastic Mr Fox (alcohol positivity); Danny the Champion of the World (thievery glorified)—not hardest reject; not Book Quest recommend.
- **No recommend / flag:** Diary of a Wimpy Kid, How to Train Your Dragon, Eragon (book 1 opening), All Four Stars (Tara Dairman — book 3 LGBTQ portrayal; MG romance 2–3 OK), Nevermoor books 2+ (Jessica Townsend — LGBTQ + Israfel/Muslim-beliefs misrepresentation; book 1 verified clean separately), *Mr. Lemoncello’s Library* (series — later LGBTQ), *The Boy Who Harnessed the Wind* young readers edition (sister/teacher elopement beat), Keeper of the Lost Cities (series — later LGBTQ), The School for Good and Evil (firm no—whole series; adult refs + later LGBTQ beat; magic noted but not the ban reason), Wings of Fire (whole series — family bashing + later LGBTQ), The Hunger Games, Land of Stories (won’t Book Quest—parent decide), Animorphs (parked—book 3 bird-morph attraction beat; author LGBTQ subtext comments; re-checking), Captain Underpants (crude humor), Julie of the Wolves (won’t Book Quest—parent discretion; marriage beat; deity/mythology), Madeline (series — derogatory Romani / “Gypsy” portrayal), Horton Hatches the Egg (taking another animal’s egg/child), Howl’s Moving Castle (adult relationships—not fully vetted), The Jungle Book (immodesty—Mowgli unclothed), The Marvelous Land of Oz (General Jinjur—sexist toward women in power)
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
