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

**Batches 10–16 (shown — films):** Through Porco Rosso / Cat Returns / Poppy Hill / Wind Rises / Boy and the Heron / Wolf Children / Girl Who Leapt / Sailor Moon R, plus Migration, Mario, Puss in Boots, Moana 2, live-action remakes, Spy Kids, Sonic, Minecraft, Garfield, etc. Full titles live in chat history + `hand_vetted.json`.

**Owner note (batch 16):** Film batches thinning — **switch to TV series batches** from **TV batch 1**.

**Catalog rules:** Holidays (non-Muslim religious holiday–centered titles off list); The Rock (never recommend); Harry Potter series (author).

**Parked idk / do not re-ask until owner asks:** Prior parks (Up TV; HTTYD live-action + TV; KFP 4+; Inside Out 2; Big Hero 6 series; Zootopia sequel; Ice Age last; Babe; Shrek; Rescuers; …) plus later parks from batches 10–16 (Paddington in Peru; Wild Robot; Flow; IF; Cat in the Hat; Red Turtle; Earwig; Digimon/Pokémon/Yu-Gi-Oh/Cardcaptor movies; etc.). See chat batches — do not re-offer shown titles.

**TV batch 1 (shown):** Bluey; Phineas and Ferb; Gravity Falls; Recess; Kim Possible; DuckTales (2017); DuckTales (1987); TaleSpin; Chip ’n Dale: Rescue Rangers; Darkwing Duck; Avatar: The Last Airbender; The Legend of Korra; Batman: TAS; Superman: TAS; Justice League (2001); Teen Titans (2003); My Little Pony: Friendship Is Magic; The Magic School Bus; Arthur; Wild Kratts.

**Parked idk / do not re-ask until owner asks:** Prior film parks…; Recess; DuckTales 2017/1987 (parked — owner said probably fine); TaleSpin; Rescue Rangers; Darkwing Duck; Arthur.

**TV batch 2 (shown):** Octonauts; Paw Patrol; Dora the Explorer; Go, Diego, Go!; Peppa Pig; Daniel Tiger’s Neighborhood; Sesame Street; Mister Rogers’ Neighborhood; Curious George; Clifford the Big Red Dog; Cyberchase; WordGirl; Maya & Miguel; The Backyardigans; Wonder Pets!; Bubble Guppies; Team Umizoomi; Blaze and the Monster Machines; Thomas & Friends; Fireman Sam.

**Owner process (pinned):** Titles the owner **parks** are written to `config/parked.json` + hand_vetted (`parked: true`) and **must not be re-offered** until the owner asks. Mixed movie+TV batches from here: **10 films + 10 series**, newest first; when newer releases appear, they go to the top.

**Catalog rules:** Holidays (non-Muslim religious holiday–centered titles off list); slice-of-life kids TV often has Christian-holiday episodes (parental flag); The Rock; Harry Potter series (author).

**Mixed batch A (shown):** Dog Man; Iwájú; Thelma the Unicorn; Young Jedi Adventures; Spellbound; SuperKitties; Harold and the Purple Crayon; Work It Out Wombats!; Transformers One; Moon Girl and Devil Dinosaur; Piece by Piece; The Creature Cases; Mufasa; Hamster & Gretel; Leo; Gabby’s Dollhouse; Under the Boardwalk; Spidey and His Amazing Friends; Chicken for Linda!; Donkey Hodie.

**Mixed batch B (shown):** The Bad Guys 2; Primos; Fixed; Kiff; In Your Dreams; Hailey’s On It!; Plankton: The Movie; Big City Greens; Ne Zha 2; Amphibia; Smurfs (2025); Craig of the Creek; The Day the Earth Blew Up; We Bare Bears; Memoir of a Snail; Mickey Mouse Funhouse; Kensuke’s Kingdom; Pupstruction; Sirocco; Alma’s Way.

**Mixed batch C (shown):** PAW Patrol: The Mighty Movie; Firebuds; DC League of Super-Pets; Alice’s Wonderland Bakery; Ron’s Gone Wrong; Eureka!; The Willoughbys; Rosie’s Rules; Over the Moon; Xavier Riddle; Spies in Disguise; Odd Squad; Missing Link; Nature Cat; Smallfoot; Molly of Denali; Ferdinand; The Fairly OddParents; The Secret Life of Pets; SpongeBob SquarePants.

**Logged reject / no auto-rec:** See `config/hand_vetted.json`. Parked registry: `config/parked.json`.

---
