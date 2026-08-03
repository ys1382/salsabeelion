# HalalFlicks — roadmap & todo

**Planning doc only** — not deployed unless you say deploy (owner-only for now).

**Working title:** HalalFlicks (rename later OK).

**Capabilities:** `ODDTROVE-CAPABILITIES.md`

---

## Product direction (pinned 2026-08-01)

**HalalFlicks is a filter + companion for now — not a movie player or streaming service.**

- Between **HalaLit** (check + shelf) and **HalaLyrics** (screener + curated picks), for **movies**.
- **Does not host or stream video.** Link-out after a title passes (or you override).
- **Hand-vetted notes always win** over automated scan.
- **ForeWarner** stays the future “warn on Netflix/YouTube click” tool — do not merge products.

**One-line pitch:** Check before watch — family-friendly movie filter + shelf + curated picks.

**Access:** **Owner-only** on Odd Trove until you say otherwise.

---

## Shipped (v0)

- [x] Owner-only on Odd Trove (`/halalflicks/` + hub owner list)
- [x] **Flickcheck** — title + optional year + optional synopsis/trailer notes; Wikipedia plot fallback; Gemini theme scan (Halalit / HalaLyrics lines: modesty, LGBTQ, romance, etc.)
- [x] Hand-vetted overrides (`config/hand_vetted.json`) with optional YouTube `trailer_url` + Wikipedia `poster_url`
- [x] Wikipedia posters when not fanservice / adult-sexual flagged (`poster_ok` hand override); Recommend uses stored posters when present
- [x] Specific YouTube trailer links for hand-vetted titles when an RT/Movieclips trailer match exists; otherwise trailer search fallback
- [x] **Recommend** — owner-curated catalog (`config/rec_catalog.json`), theme search, device prefs, link-out only
- [x] **My shelf** — localStorage only (want / watched / favorite)
- [x] Quiet owner-beta copy

---

## Suggested build order

| Phase | What | Why |
|-------|------|-----|
| **1** | Grow hand-vetted list + tune scan false positives/negatives | Trust layer |
| **2** | Shelf ↔ Flickcheck — saved titles show verdict | Personal companion |
| **3** | Grow curated OK / Recommend catalog | Useful before any extension |
| **4** | Better metadata (OMDb/TMDB if you add keys) | Stronger plots when Wikipedia misses |
| **5** | Public quiet beta (when you say) | Match HalaLyrics access model |
| **6** | Accounts + shelf sync | When shelves matter across devices |

**Avoid for now:** hosting video, in-app streaming, ForeWarner extension scope, public comment walls.

---

## Your additions

### Owner movie-vet batches (do not re-offer)

Titles already shown in chat vet batches — **do not re-ask** unless the owner parks them and asks later, or clearly opts in (e.g. “ask me about Shrek again”).

**Batch 1 (shown):** Toy Story 1–4; Finding Nemo / Finding Dory; Monsters, Inc. / Monsters University; The Incredibles / Incredibles 2; Ratatouille; Up (film); WALL·E; How to Train Your Dragon films; Kung Fu Panda 1–3; Paddington 1–2; My Neighbor Totoro; The Iron Giant; Chicken Run; Despicable Me franchise; The Lego Movie 1–2; Coco; Moana; Inside Out; A Bug’s Life.

**Batch 2 (shown):** Brave; Tangled; Lilo & Stitch; Big Hero 6; Cars 1–3; The Emperor’s New Groove; Encanto; Wreck-It Ralph / Ralph Breaks the Internet; Zootopia; Shrek films; Madagascar films; Ice Age (earlier films); Horton Hears a Who!; The Lorax; Shaun the Sheep Movie; The Wizard of Oz; Mary Poppins; The Jungle Book (1967); Babe; Spirited Away.

**Batch 3 (shown):** The Lion King (1994); Aladdin (1992); Beauty and the Beast (1991); The Little Mermaid (1989); Mulan (1998); Hercules (1997); Tarzan (1999); The Princess and the Frog (2009); Peter Pan (1953); Cinderella (1950); Sleeping Beauty (1959); Pinocchio (1940); Bambi (1942); Dumbo (1941); 101 Dalmatians (1961); Lady and the Tramp (1955); The Aristocats (1970); Robin Hood (1973); The Rescuers (1977); Oliver & Company (1988).

**Batch 4 (shown):** The Fox and the Hound; The Black Cauldron; The Great Mouse Detective; Beauty and the Beast: The Enchanted Christmas; Fantasia; Fantasia 2000; Alice in Wonderland (1951); The Rescuers Down Under (replacement #8); The Sword in the Stone; The Many Adventures of Winnie the Pooh; Pooh’s Grand Adventure; The Tigger Movie; Meet the Robinsons; Bolt; Chicken Little; Home on the Range; Brother Bear; Treasure Planet; Atlantis: The Lost Empire; The Hunchback of Notre Dame (1996).

**Owner catalog rule — holidays:** If a film is **about** Christmas or another Christian / Jewish / otherwise non-Muslim holiday, it is pretty much off the recommend list. *Home Alone* isn’t only Christmas, but titles with Christmas in the name tend to be out. (Pinned from batch 4.)

**Batch 5 (shown):** Ponyo; Kiki’s Delivery Service; Castle in the Sky; Nausicaä; Princess Mononoke; Howl’s Moving Castle; The Secret World of Arrietty; When Marnie Was There; The Tale of the Princess Kaguya; Whisper of the Heart; The Croods; The Mitchells vs. the Machines; Klaus; Song of the Sea; The Secret of Kells; Wolfwalkers; Ernest & Celestine; A Town Called Panic; Fantastic Mr. Fox; Isle of Dogs.

**Batch 6 (shown):** Wallace & Gromit: Curse of the Were-Rabbit; Shaun the Sheep: Farmageddon; Early Man; The Pirates! Band of Misfits; Flushed Away; Spirit: Stallion of the Cimarron; The Prince of Egypt; Balto; An American Tail; The Land Before Time; The Secret of NIMH; All Dogs Go to Heaven; Coraline; Kubo and the Two Strings; The Boxtrolls; ParaNorman; Onward; Soul; Luca; The Good Dinosaur.

**Batch 7 (shown):** Rio; Rio 2; Epic; Rise of the Guardians; Megamind; Over the Hedge; Bee Movie; Shark Tale; Antz; The Road to El Dorado; Anastasia; Sinbad: Legend of the Seven Seas; Quest for Camelot; The Swan Princess; Thumbelina; FernGully; Once Upon a Forest; Cats Don’t Dance; The King and I (1999 animated); Rock-A-Doodle.

**Batch 8 (shown):** Raya and the Last Dragon; Strange World; Wish; Elemental; Turning Red; Lightyear; Frozen; Frozen II; Tangled: Before Ever After; Planes; Planes: Fire & Rescue; Dinosaur; The Wild; Open Season; Surf’s Up; Cloudy with a Chance of Meatballs 2; Hotel Transylvania; The Smurfs; Hop; The Adventures of Tintin.

**Batch 9 (shown):** Cloudy with a Chance of Meatballs; Hotel Transylvania 2–3; Abominable; Vivo; The Star; Sing 1–2; Trolls / Trolls World Tour; The Boss Baby; Captain Underpants; Mr. Peabody & Sherman; Home; The Emoji Movie; Storks; The Lego Batman Movie; The Lego Ninjago Movie; Spider-Man: Into the Spider-Verse; Spider-Man: Across the Spider-Verse.

**Parked idk / do not re-ask until owner asks:** Up TV series; HTTYD live-action + TV; Kung Fu Panda 4+ / spin-offs; Inside Out 2; Big Hero 6 series; Zootopia sequel / rest of franchise; Ice Age last film; Babe + Babe: Pig in the City; Shrek films; The Rescuers; Oliver & Company; Fox and the Hound; Black Cauldron; Great Mouse Detective; Fantasia / Fantasia 2000; Sword in the Stone; Meet the Robinsons; Home on the Range; Brother Bear; Treasure Planet; Hunchback of Notre Dame (1996); The Rescuers Down Under; Arrietty; When Marnie Was There; Song of the Sea; The Secret of Kells; A Town Called Panic; Wallace & Gromit Were-Rabbit; Farmageddon; Early Man; Pirates! Band of Misfits; Flushed Away; Spirit; Balto; An American Tail; The Boxtrolls; Shark Tale; Antz; Road to El Dorado; Anastasia; Sinbad; Quest for Camelot; Swan Princess; Thumbelina; FernGully; Once Upon a Forest; Cats Don’t Dance; The King and I (1999 animated); Rock-A-Doodle; Tangled: Before Ever After; Dinosaur; The Wild; Surf’s Up; The Smurfs.

**Logged reject / no auto-rec (hand_vetted):** Incredibles (discretion); Ratatouille; Chicken Run; Despicable Me line; Coco; Moana; Brave / Tangled / Lilo & Stitch; Baymax! TV; Emperor’s New Groove; Madagascar; Shrek (parked); Aladdin (heavy); Beauty and the Beast (discretion); Mulan (discretion); Hercules; Tarzan; Peter Pan; Dumbo (discretion); Robin Hood (discretion); The Little Mermaid (hard reject — fanservice); Enchanted Christmas (holiday rule); Atlantis (heavy — immodesty); Ponyo (discretion); Castle in the Sky (discretion); Nausicaä; Mononoke; Kaguya; The Croods; Mitchells vs. the Machines (LGBTQ credits); Klaus (holiday); Wolfwalkers (discretion); Ernest & Celestine (discretion); Fantastic Mr. Fox (alcohol); Isle of Dogs (discretion); The Prince of Egypt (religious misrepresentation); All Dogs Go to Heaven (gambling); Coraline (naked women); The Good Dinosaur (intoxication as humor); Rio (parade immodesty); Epic (immodesty); Bee Movie (human–bee attraction); Strange World (LGBTQ); Wish (discretion — magical wishes); Elemental (discretion — adult romance refs); Turning Red; Lightyear (LGBTQ); Frozen / Frozen II (discretion — Elsa outfits); Hop (Easter); Tintin (humorous alcohol); The Star (holiday); Storks (LGBTQ); Boss Baby (discretion — potty humor); Captain Underpants (discretion — potty humor).

---
