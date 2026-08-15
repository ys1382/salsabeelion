/**
 * Halalit — hand-checked warnings when public catalogs miss themes (romance threads,
 * mature tone, group demonization, etc.) that still matter for the family shelf even when they are not the main plot.
 * flag_review entries block recommendations; verified_clean may use comfort toggles (family, romance, deity, magic, substance); family portrayal notes are advisory only (see FAMILY_PORTRAYAL_NOTES).
 * deity_comfort entries are catalog or not-yet-verified deity notes—Book Quest skips them only when the reader excludes deity/mythology; hand-verified clean deity titles use VERIFIED_CLEAN + requiresDeityMythologyOptIn instead.
 * verified_clean entries are owner (or future team) hand-checks — required before Halalit recommends comics, manga, or graphic novels (see VERIFIED_CLEAN).
 * no_recommend_known_fanservice — plot may be vetted clean, but Halalit will not recommend when the series is known to include fanservice (see NO_RECOMMEND_KNOWN_FANSERVICE).
 * fanservice_caution_graphic — hand-vetted comics with lighter fanservice risk; caution + no auto-recommend, not the heavy list (see FANSERVICE_CAUTION_GRAPHIC).
 */
(function (global) {
  /** First line = title in Bookcheck; following lines = short bullets. */
  function bookNote(title, bullets, closing) {
    var lines = [title];
    if (bullets) {
      for (var i = 0; i < bullets.length; i++) lines.push(bullets[i]);
    }
    if (closing) lines.push(closing);
    return lines.join("\n");
  }

  /** Shown on hand-checked graphic novels and comics when panels may show outfit/posing modesty issues. */
  var GRAPHIC_PHYSICAL_IMMODESTY_NOTE =
    "Graphic novels and comics often show physical immodesty in panels (outfits, poses) that blurbs won’t mention—preview the art even when the story seems clean.";

  var LITTLE_HOUSE_SERIES_TITLE_RE =
    /little house on the prairie|little house in the big woods|farmer boy|on the banks of plum creek|by the shores of silver lake|the long winter|little town on the prairie|these happy golden years|\blittle house\b/i;

  /** Agatha Christie — Hercule Poirot mysteries only (not Miss Marple or other lines). Author required at match time. */
  var CHRISTIE_POIROT_TITLE_RE =
    /\bpoirot\b|\bhercule poirot\b|\bmysterious affair at styles\b|\bmurder on the orient express\b|\bmurder of roger ackroyd\b|\broger ackroyd\b|\babc murders\b|\ba\.?\s*b\.?\s*c\.?\s*murders\b|\bdeath on the nile\b|\bmurder in mesopotamia\b|\bappointment with death\b|\bevil under the sun\b|\bfive little pigs\b|\bmurder in retrospect\b|\bcards on the table\b|\bdumb witness\b|\bthe hollow\b|\btaken at the flood\b|\bmrs mcginty'?s dead\b|\bafter the funeral\b|\bhickory dickory dock\b|\bdead man'?s folly\b|\bthird girl\b|\bhallowe'?en party\b|\belephants can remember\b|\bcurtain\b|\blabours of hercules\b|\blabor of hercules\b|\bproblem at pollensa\b|\bone,?\s*two,?\s*buckle my shoe\b|\bthree act tragedy\b|\bdeath in the clouds\b|\bthe clocks\b|\bperil at end house\b|\blord edgware dies\b|\bthirteen at dinner\b|\bmurder on the links\b|\bthe big four\b|\bmystery of the blue train\b|\bhercule poirot'?s christmas\b|\bmurder at christmas\b|\bblack coffee\b|\bsad cypress\b|\bsparkling cyanide\b|\bmonogram murders\b|\bclosed casket\b|\bone,?\s*two,?\s*buckle\b/i;

  var DEITY_COMFORT_LABEL = "Deity or mythology (comfort note)";

  var DEITY_COMFORT_DETAIL =
    "Deity, spirits, or folklore treated as real—some readers skip these. Not calling it inappropriate.";

  var DEITY_COMFORT_DETAIL_VERIFIED =
    "Hand-checked clean, but tags still mention deity or mythology—comfort note for readers who avoid that theme.";

  var GRACE_LIN_FOLKLORE_TRILOGY_TITLE_RE =
    /\bwhere the mountain meets the moon\b|\bstarry river of the sky\b|\bwhen the sea turned to silver\b/i;

  var GRACE_LIN_FOLKLORE_TRILOGY_DETAIL = bookNote(
    "Grace Lin folklore trilogy",
    [
      "Chinese mythology and spirits treated as real—comfort note for readers who avoid deity themes.",
      "Wine in all three books; at least one scene presents wine positively in a magical fix.",
      "Serious family-bashing tone (cold or unfair parents—not physical abuse).",
      "Light side-character romance in book 1 only (they marry later; not a heavy dating plot).",
      "Otherwise clean middle-grade fantasy.",
    ],
    "Won’t Book Quest—not inappropriate."
  );

  /**
   * Optional hand entries when catalogs miss deity/mythology (automatic scan handles most titles).
   * @type {Array<{titleRe: RegExp, authorRe?: RegExp, detail?: string}>}
   */
  var ANZU_REALM_OF_DARKNESS_DETAIL = bookNote(
    "Anzu and the Realm of Darkness (Mai K. Nguyen)",
    [
      "Very deity- and mythology-heavy—Shinto-style spirits, gods, demons, Yomi treated as real.",
      "Ancestors honored and prayed to; spirits answer (e.g. grandmother in the spirit realm).",
      "Some underworld scenes scary for sensitive readers.",
      "Brief mild language; graphic novel—preview comics pacing if your family is cautious.",
      "Plot otherwise clean for Halalit’s check.",
    ],
    "Won’t Book Quest—not inappropriate."
  );

  var DEITY_COMFORT = [
    {
      titleRe: GRACE_LIN_FOLKLORE_TRILOGY_TITLE_RE,
      detail: GRACE_LIN_FOLKLORE_TRILOGY_DETAIL,
    },
    {
      titleRe: /\banzu\b.*\brealm of darkness\b|\brealm of darkness\b.*\banzu\b/i,
      authorRe: /nguyen|mai\s*k/i,
      detail: ANZU_REALM_OF_DARKNESS_DETAIL,
    },
    {
      titleRe: /\bhow the grinch stole christmas\b|\bgrinch stole christmas\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail: bookNote("How the Grinch Stole Christmas! (Dr. Seuss)", [
        "Christian Christmas story—comfort note for readers who avoid religious-holiday or deity themes.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bwarriors\b|\bwarrior cats\b|\binto the wild\b|\ba forest divided\b|\bdawn of the clans\b/i,
      authorRe: /hunter|erin/i,
      detail: bookNote("Warriors (Warrior Cats)", [
        "Cat-clan fiction with romance threads; nothing explicit in owner scope.",
        "StarClan and related spirit afterlife read as mythology/deity comfort for some families.",
        "Halalit won’t auto-recommend the line; not calling it inappropriate.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\briordan presents\b|\badventures on the roof of the world\b/i,
      authorRe: /riordan/i,
      detail: bookNote("Rick Riordan Presents", [
        "Most titles lean heavily on deity or mythology from many cultures—comfort note for readers who avoid that theme.",
        "Individual books not owner-vetted here—preview each title.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\baru shah\b|\baru shah and the end of time\b/i,
      authorRe: /chokshi|roshani/i,
      detail: bookNote("Aru Shah (Roshani Chokshi)", [
        "Hindu mythology and gods treated as real—deity/mythology comfort note.",
        "Rest of plot not fully owner-vetted in this note—preview before sharing.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bcity of dragons\b|\bawakening storm\b|\brise of the shadowfire\b/i,
      authorRe: /yogis|jaimal/i,
      detail: bookNote("City of Dragons (Jaimal Yogis)", [
        "Deity/mythology treated as real in owner scope.",
        "Book 3: jealous-girl dating situation gets weird—preview that volume.",
      ], "Won’t Book Quest—not inappropriate."),
    },
  ];
  /**
   * Owner hand-verified clean for the family shelf (whole series or title pattern).
   * @type {Array<{titleRe: RegExp, authorRe?: RegExp, detail: string}>}
   */
  var VERIFIED_CLEAN = [
    {
      titleRe: /\bthe dragon'?s eye\b/i,
      authorRe: /chadda|sarwat\s*chadda|khan|joshua\s*khan/i,
      requiresMagicOptIn: true,
      detail: bookNote("The Dragon's Eye (Spirit Animals, Fall of the Beasts #8 — Sarwat Chadda)", [
        "Hand-verified clean for this volume in owner scope—not a blanket pass for the whole Spirit Animals line or for this author's other books.",
        "Shared-world fantasy magic—exclude magic in Advanced recommendations settings on the play page if needed.",
        "See the WARNING note below about Sarwat Chadda (pen name Joshua Khan) and his other titles.",
      ]),
    },
    {
      titleRe: /\bspirit animals\b/i,
      authorRe: /mull|stiefvater|chibnall|hunter|hale|lu|scholastic/i,
      requiresMagicOptIn: true,
      detail: bookNote("Spirit Animals (Scholastic)", [
        "Hand-verified clean cover to cover.",
        "Light romance hints and some strained family moments—not enough to break shelf rules.",
        "Fantasy magic—Book Quest includes these when otherwise clean; exclude magic in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe:
        /\bwild born\b|\bhunted\b|\bblood ties\b|\bfire and ice\b|\bagainst the tide\b|\brise and fall\b|\btree of life\b|\bthe eres problem\b|\bimmortal guardians\b|\bthe burning tide\b|\bwild and free\b|\bheart of the land\b/i,
      authorRe: /mull|stiefvater|chibnall|hunter|hale|lu|scholastic/i,
      requiresMagicOptIn: true,
      detail: bookNote("Spirit Animals (Scholastic)", [
        "Hand-verified clean cover to cover.",
        "Light romance hints and some strained family moments—not enough to break shelf rules.",
        "Fantasy magic—Book Quest includes these when otherwise clean; exclude magic in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bunicorn chronicles\b/i,
      detail: bookNote("Unicorn Chronicles (Bruce Coville)", [
        "Hand-verified clean overall—no dirty romance.",
        "Book 3 (Dark Whispers): brief one-line nod to immodesty; rest of the line stays modest.",
      ]),
    },
    {
      titleRe:
        /\binto the land of the unicorns\b|\bsong of the wanderer\b|\bdark whispers\b|\bthe last hunt\b/i,
      authorRe: /coville/i,
      detail: bookNote("Unicorn Chronicles (Bruce Coville)", [
        "Hand-verified clean overall—no dirty romance.",
        "Book 3 (Dark Whispers): brief one-line nod to immodesty; rest of the line stays modest.",
      ]),
    },
    {
      titleRe: /\bchronicles of prydain\b|\bprydain chronicles\b/i,
      authorRe: /alexander/i,
      requiresMagicOptIn: true,
      requiresSubstanceOptIn: true,
      detail: bookNote("Chronicles of Prydain (Lloyd Alexander)", [
        "Hand-verified clean overall.",
        "Old-world feast objects and brief drink mentions—not glamorized alcohol culture.",
        "Fantasy magic—Book Quest includes these when otherwise clean—exclude magic and/or alcohol/drug-related content in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe:
        /\bbook of three\b|\bblack cauldron\b|\bcastle of llyr\b|\btaran wanderer\b|\bhigh king\b/i,
      authorRe: /alexander/i,
      requiresMagicOptIn: true,
      requiresSubstanceOptIn: true,
      detail: bookNote("Chronicles of Prydain (Lloyd Alexander)", [
        "Hand-verified clean overall.",
        "Old-world feast objects and brief drink mentions—not glamorized alcohol culture.",
        "Fantasy magic—Book Quest includes these when otherwise clean—exclude magic and/or alcohol/drug-related content in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bunicorn quest\b/i,
      authorRe: /benko/i,
      detail:
        "Hand-verified for Halalit’s family shelf: the Unicorn Quest trilogy by Kamilla Benko is clean overall.",
    },
    {
      titleRe: /\bwolf princess\b/i,
      authorRe: /constable|cathryn/i,
      detail: bookNote("The Wolf Princess (Cathryn Constable)", [
        "Hand-verified clean in owner scope.",
        "Owner Earth Week medium-maybe—wild setting and nature mood; stewardship message not as central as Jinx-tier picks.",
      ]),
    },
    {
      titleRe: /\bprince of nowhere\b/i,
      authorRe: /hassan|rochelle/i,
      requiresMagicOptIn: true,
      detail: bookNote("The Prince of Nowhere (Rochelle Hassan)", [
        "Hand-verified clean cover to cover in owner scope.",
        "Enchanted mist, magic letters, and a shape-shifting friend. A pass if your family doesn’t read fantasy magic.",
      ]),
    },
    {
      titleRe: /\bgreen deen\b/i,
      authorRe: /abdul-?matin|ibrahim/i,
      detail: bookNote("Green Deen (Ibrahim Abdul-Matin)", [
        "Hand-verified clean in owner scope.",
        "Nonfiction on faith and caring for the planet—Book Quest nonfiction shelf only.",
      ]),
    },
    {
      titleRe: /\bgirls who look(?:ed)? under rocks\b/i,
      authorRe: /atkins|jeannine/i,
      detail: bookNote("Girls Who Looked Under Rocks (Jeannine Atkins)", [
        "Hand-verified clean in owner scope—owner called it a fun younger nonfiction read.",
        "Chapter-book biographies of women naturalists—not a toddler board book; best for school-age readers.",
        "Book Quest nonfiction nature track when reader age band fits.",
      ]),
    },
    {
      titleRe: /\bbioluminescence\b/i,
      authorRe: /zimmer|marc/i,
      detail: bookNote("Bioluminescence (Marc Zimmer)", [
        "Hand-verified clean in owner scope—nature and science nonfiction; animal photos only, no human pictures.",
        "Thin volume; best for Older kids—not a learn-to-read board book, not a dense teen science text in owner scope.",
        "Book Quest nonfiction nature track when reader age band fits.",
      ]),
    },
    {
      titleRe: /\bescape\b.*\bsurvivor(?:'s|s)?\s*guide\b|\bsurvivor(?:'s|s)?\s*guide\b/i,
      authorRe: /hynes|margaret/i,
      detail: bookNote("Escape: A Survivor's Guide (Margaret Hynes)", [
        "Hand-verified clean in owner scope—juvenile nonfiction survival guide with playful fantasy escape scenarios (e.g. vampires, aliens).",
        "Comic-style illustrated characters; owner scope: possible mild physical immodesty, not bikini-level fanservice.",
        "Book Quest nonfiction when reader age band fits.",
      ]),
    },
    {
      titleRe: /\beasy guide to american sign language\b/i,
      authorRe: /heller|lora/i,
      detail: bookNote("Easy Guide to American Sign Language (Lora Heller, ed.)", [
        "Hand-verified clean in owner scope—nonfiction ASL reference with illustrated signs and basic phrases.",
        "Content is fine for kids; younger children probably would not choose this on their own—best fit for Older kids learning practical signs.",
        "Book Quest nonfiction when reader age band fits.",
      ]),
    },
    {
      titleRe: /\bseekers of the (?:wild )?realm\b|\blegend of the realm\b/i,
      authorRe: /ott|alexandra/i,
      detail: bookNote("Seekers of the Wild Realm (Alexandra Ott, duology)", [
        "Hand-verified clean across both books in owner scope.",
        "Owner Parents Week pick—book 1 only (duology on Earth Week list separately).",
        "Halalit may recommend.",
      ]),
    },
    {
      titleRe: /\bameena'?s ramadan diary\b/i,
      authorRe: /kabil|sara/i,
      requiresIslamicLiteratureInterest: true,
      detail: bookNote("Ameena's Ramadan Diary (Sara Kabil)", [
        "Hand-verified clean in owner scope—realistic fiction for Muslim readers.",
        "Halalit recommends only when your shelf already shows interest in Islamic literature (titles you added or read).",
      ]),
    },
    {
      titleRe: /\bat first bite\b/i,
      authorRe: /ames|friedman|aimee|ruth/i,
      requiresLightRomanceOptIn: true,
      detail: bookNote("At First Bite (Poison Apple #8, Ruth Ames)", [
        "Hand-verified clean in owner scope.",
        "Light romance and crush beats—not adult, dark, or LGBTQ.",
        "Book Quest includes these when otherwise clean—exclude light romance in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bthis totally bites\b/i,
      authorRe: /ames|friedman|aimee|ruth/i,
      requiresLightRomanceOptIn: true,
      detail: bookNote("This Totally Bites! (Poison Apple #2, Ruth Ames)", [
        "Hand-verified clean in owner scope.",
        "Light romance, crushes, and a prom—preview if school dances matter for your family.",
        "Not adult, dark, or LGBTQ romance.",
        "Book Quest includes these when otherwise clean—exclude light romance in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bdragon slippers\b|\bdragon flight\b|\bdragon spear\b/i,
      authorRe: /george|jessica/i,
      requiresLightRomanceOptIn: true,
      requiresDeityMythologyOptIn: true,
      detail: bookNote("Dragon Slippers (Jessica Day George, trilogy)", [
        "Hand-verified clean in owner scope.",
        "Greek-style deity/mythology treated as real—comfort note for readers who avoid that theme.",
        "Light dating romance—kissing/hugging only in owner scope.",
        "Extended family mostly annoying or friction—not villainized parents.",
        "Book Quest includes these when otherwise clean—exclude light romance and/or deity/mythology in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\brose legacy\b|\bqueen'?s secret\b|\brider'?s reign\b/i,
      authorRe: /george|jessica/i,
      requiresLightRomanceOptIn: true,
      negativeFamilyPortrayal: true,
      detail: bookNote("The Rose Legacy (Jessica Day George, trilogy)", [
        "Hand-verified clean across the series in owner scope.",
        "Mother cast as irredeemable villain—not merely annoying family friction.",
        "Light romance—preview if crush or dating beats matter.",
        "Book Quest includes these when otherwise clean—exclude light romance and/or negative family portrayal in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bshadow of the dragon\b(?!:\s*elspeth)/i,
      authorRe: /o'hearn|hearn|kate/i,
      requiresDeityMythologyOptIn: true,
      detail: bookNote("Shadow of the Dragon: Kira (Kate O'Hearn, book 1)", [
        "Hand-verified clean in owner scope (book 1 only).",
        "Brief deity or mythology mentions—comfort note for readers who avoid that theme.",
        "Book 2 (Elspeth) and any later volumes not owner-vetted—Halalit won’t recommend those until vetted.",
        "Book Quest includes book 1 when otherwise clean—exclude deity/mythology in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bwingbearer\b/i,
      authorRe: /liu|marjorie\s*m/i,
      requiresDeityMythologyOptIn: true,
      requiresMagicOptIn: true,
      detail: bookNote("Wingbearer (Marjorie M. Liu — graphic novel)", [
        "Hand-verified clean in owner scope—graphic novel.",
        "Afterlife mythology treated as real—comfort note for readers who avoid deity/mythology themes.",
        "Owner: no fanservice in owner scope—still preview panel art.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
        "Different book: Nicki Pau Preto's prose Wingbearer series is not this title—catalog may match the wrong author.",
        "Book Quest includes when otherwise clean—exclude magic and/or deity/mythology in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bspy force\b|\bmax remy\b/i,
      authorRe: /abela/i,
      detail: bookNote("Spy Force", [
        "Hand-verified clean overall.",
        "Romance hints (in love, a few kisses) and some family-bashing toward the mother.",
      ]),
    },
    {
      titleRe: /\bartemis fowl\b/i,
      authorRe: /colfer/i,
      requiresMagicOptIn: true,
      requiresSubstanceOptIn: true,
      detail: bookNote("Artemis Fowl", [
        "Hand-verified clean overall.",
        "Early family-bashing around the father valuing money (shifts later).",
        "Confession of love and a kiss in the final book.",
        "Alcohol mentions, including legal minor drinking in book one.",
        "Fantasy magic—Book Quest includes these when otherwise clean—exclude magic and/or alcohol/drug-related content in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe:
        /\btale dark and grimm\b|\bin a glass grimmly\b|\bthe grimm conclusion\b|\bgrimm conclusion\b/i,
      authorRe: /gidwitz|adam\s*gidwitz/i,
      detail: bookNote("A Tale Dark and Grimm (Adam Gidwitz)", [
        "Hand-verified clean on romance for the series in owner scope.",
        "Very dark Grimm violence and horror—Teens/Adults only; not for young-child or older-kid picks.",
        "Owner: largely not sexist—preview if that matters for your family.",
        "Fractured fairy-tale retellings—preview for sensitive readers.",
      ]),
    },
    {
      titleRe: /\bairman\b/i,
      authorRe: /eoin\s*colfer/i,
      detail: bookNote("Airman (Eoin Colfer)", [
        "Hand-verified clean overall.",
        "Heavier adventure—airship stakes, kidnapping, and thriller beats; not always dark but above light middle grade.",
        "Older kids and up for interest and intensity; not a young-child or board-book pick.",
      ]),
    },
    {
      titleRe: /half moon investigations/i,
      authorRe: /eoin\s*colfer/i,
      detail: bookNote("Half Moon Investigations (Eoin Colfer)", [
        "Hand-verified clean overall.",
        "Mystery with sharper humor and some heavier beats than light MG—still not a dark teen title.",
        "Older kids and up for interest; preview before the youngest readers.",
      ]),
    },
    {
      titleRe:
        /\branger'?s apprentice\b|\bruins of gorlan\b|\bburning bridge\b|\bicebound land\b|\bbattle for skandia\b|\bsorcerer in the north\b|\bsiege of macindaw\b|\bkings of clonmel\b|\bhalt'?s peril\b|\bempire of nihon-ja\b|\blost stories\b|\broyal ranger\b/i,
      authorRe: /flanagan|john/i,
      requiresSubstanceOptIn: true,
      requiresCulturalMisrepresentationOptIn: true,
      detail: bookNote("Ranger's Apprentice (John Flanagan)", [
        "Hand-verified clean in owner scope—for now on the OK list.",
        "Alcohol and light drug-related mentions—about Hobbit-level; some drug beats are called out in the story itself.",
        "Cultural misrepresentation note is separate below—not group demonization.",
        "Book Quest includes when otherwise clean—exclude alcohol/drug-related or cultural misrepresentation in Advanced recommendations settings if needed.",
      ]),
    },
    {
      titleRe: /\banimal healer\b/i,
      authorRe: /st\.?\s*john|lauren/i,
      detail: bookNote("The Animal Healer (Lauren St John)", [
        "Hand-verified clean overall.",
        "Alcohol addiction mentioned by book 3—the addiction is condemned.",
      ]),
    },
    {
      titleRe: /\bfancy nancy\b/i,
      authorRe: /o'?\s*connor|glasser/i,
      detail:
        "Hand-verified for Halalit’s family shelf: the Fancy Nancy series (Jane O’Connor) reads as clean kids’ books.",
    },
    {
      titleRe:
        /\blion,?\s+the\s+witch\s+and\s+the\s+wardrobe\b|\bthe\s+lion,?\s+the\s+witch\s+and\s+the\s+wardrobe\b/i,
      authorRe: /c\.?\s*s\.?\s*lewis|cs\s*lewis/i,
      requiresMagicOptIn: true,
      requiresDeityMythologyOptIn: true,
      detail: bookNote("The Lion, the Witch and the Wardrobe (C. S. Lewis)", [
        "Hand-verified clean in owner scope for this book (Chronicles of Narnia book 1).",
        "Fantasy magic—witch, enchantments, and the winter spell—comfort note for families who skip magic in stories.",
        "Christian allegory and theology (Aslan as Christ-figure, creation and resurrection parallels)—comfort note for readers who exclude deity/mythology in Advanced recommendations settings.",
        "Later Narnia volumes are not owner-vetted on Halalit—preview each title separately.",
        "Book Quest includes book 1 when otherwise clean—exclude magic and/or deity/mythology in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bthe hobbit\b|\bhobbit, or there and back again\b/i,
      authorRe: /tolkien|j\.?\s*r\.?\s*r\.?\s*tolkien/i,
      requiresMagicOptIn: true,
      requiresSubstanceOptIn: true,
      detail: bookNote("The Hobbit (J. R. R. Tolkien)", [
        "Hand-verified clean in core plot.",
        "Owner Earth Week maybe—beauty and wonder in wild landscapes (same lane as Heidi), not an ecology advocacy book.",
        "Fantasy magic, wizards, and enchanted objects—comfort note for families who skip magic in stories.",
        "Alcohol references (beer, wine)—not drunkard-normalizing in owner scope.",
        "Book Quest includes when otherwise clean—exclude magic and/or alcohol/drug-related content in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe:
        /\blord of the rings\b|\bfellowship of the ring\b|\bthe two towers\b|\breturn of the king\b/i,
      authorRe: /tolkien|j\.?\s*r\.?\s*r\.?\s*tolkien/i,
      requiresMagicOptIn: true,
      requiresSubstanceOptIn: true,
      detail: bookNote("The Lord of the Rings (J. R. R. Tolkien)", [
        "Hand-verified clean in owner scope for the main trilogy.",
        "Owner Earth Week maybe—beauty in wild country and stewardship-of-land themes in places; not a modern environmentalism book.",
        "Medieval-style alcohol (ale, wine at feasts)—not a hard ban; preview if you avoid alcohol mentions.",
        "Fantasy magic, wizards, and enchanted objects—comfort note for families who skip magic in stories.",
        "War and dark tone—Teens/Adults interest band; not for young-child readers.",
        "Book Quest includes for Older Teen/Adult readers when otherwise clean—exclude magic and/or alcohol/drug-related content in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe:
        /\bluck uglies\b|\bfork[- ]?tongue charmers\b|\brise of the ragged clover\b|\blast reckoning\b/i,
      authorRe: /durham|paul\s*durham/i,
      detail: bookNote("Luck Uglies (Paul Durham)", [
        "Owner family-week on hold—some negative family portrayal; not abuse; idk; may assign to a week later.",
        "Books 1–2 firm; book 3 looks plot-clean but not fully re-checked here.",
        "Often upper MG / mild teen level—not a content fail.",
        "Father is outlaw/thief who also protects the village; mother disapproves of thievery.",
        "Non-graphic backstory violence toward Bog Noblins; inn alcohol (setting, not drunkard culture).",
        "Preview if you avoid gray-morality fathers, creature-violence backstory, or inn alcohol.",
      ]),
    },
    {
      titleRe: /\ba wrinkle in time\b|\ba wind in the door\b/i,
      authorRe: /l[’'`]?engle|lengle|madeleine/i,
      requiresMagicOptIn: true,
      detail: bookNote("A Wrinkle in Time / A Wind in the Door (first two books)", [
        "Hand-verified plot-clean overall.",
        "Protagonist sometimes framed harshly for not handling crisis pressure perfectly.",
      ]),
    },
    {
      titleRe: /\bramona\b|\bramona quimby\b/i,
      authorRe: /cleary/i,
      detail: bookNote("Ramona Quimby", [
        "Hand-verified plot-clean overall.",
        "Owner Parents Week pick—pretty good family books overall.",
        "Second-to-last book in the line: wedding/menu wine mention (not drunkard framing).",
        "Mostly imperfect-family conflict, not villain-parent framing.",
        "Ramona and Her Father: smoking addiction/recovery.",
      ]),
    },
    {
      titleRe: /\bboxcar children\b|\bthe boxcar children\b/i,
      authorRe: /warner/i,
      detail: bookNote("The Boxcar Children (Gertrude Chandler Warner, book 1 only)", [
        "Hand-verified clean in owner scope—book 1 only; rest of series not owner-vetted here.",
        "Owner Grandparents Week pick.",
        "Parent/grandfather conflict implied in backstory—not active family-bashing in owner scope.",
      ]),
    },
    {
      titleRe: /\bcharlotte'?s web\b/i,
      authorRe: /white|e\.?\s*b\.?\s*white/i,
      detail:
        "Hand-verified for Halalit’s family shelf: Charlotte’s Web reads as clean.",
    },
    {
      titleRe: /\bthe bfg\b|\bbfg\b/i,
      authorRe: /dahl|roald/i,
      detail: bookNote("The BFG", [
        "Hand-verified plot-clean overall.",
        "Frobscottle party can feel like a jokey wine-drinking analog (playful, not drunkard framing).",
      ]),
    },
    {
      titleRe: /\bharriet the spy\b/i,
      authorRe: /fitzhugh/i,
      detail: bookNote("Harriet the Spy", [
        "Hand-verified clean overall.",
        "Later book in the line: kid crush on an adult—preview if that matters for your family.",
      ]),
    },
    {
      titleRe: /\bwatership down\b/i,
      authorRe: /adams|richard\s*adams/i,
      detail: bookNote("Watership Down (Richard Adams)", [
        "Hand-verified plot-clean overall for Halalit’s shelf rules.",
        "Heavy tone: rabbits face real peril and horror—preview for sensitive readers.",
        "Lapine phrases can imply crude ideas (e.g. “eat poop”) without English profanity in the prose novel.",
        "Graphic-novel / comics editions: at least one real English cuss word—preview that format separately.",
      ]),
    },
    {
      titleRe: /\bedgar\b.*\ballen\b.*\bpoe\b|\bedgar and allen poe\b/i,
      authorRe: /jansen/i,
      detail:
        "Hand-verified for Halalit’s family shelf: Edgar and Allan Poe (the kids' twins series) is clean overall.",
    },
    {
      titleRe:
        /\bnevermore\b|\bthe tell-tale start\b|\bthe pet and the pendulum\b|\bonce upon a midnight dreary\b|\bbest of all possible worlds\b|\btell-tale surprise\b|\bpoe must die\b|\bjoin the club\b/i,
      authorRe: /jansen/i,
      detail:
        "Hand-verified for Halalit’s family shelf: Edgar and Allan Poe (the kids' twins series) is clean overall.",
    },
    {
      titleRe: /\bthat can be arranged\b/i,
      authorRe: /fahmy|huda\s*fahmy/i,
      detail: bookNote("That Can Be Arranged (Huda Fahmy)", [
        "Hand-verified clean overall for Halalit’s family shelf—not the Huda F graphic series (those titles stay off the shelf).",
        "Some community-bashing beats (mosque/social crowd friction)—preview if that tone bothers your family.",
      ]),
    },
    {
      titleRe: /\bmagic tree house\b/i,
      authorRe: /osborne|mary\s*pope/i,
      detail: bookNote("Magic Tree House (Mary Pope Osborne)", [
        "Hand-verified for Halalit’s family shelf: core Magic Tree House reads as clean kids’ adventure.",
        "Merlin Missions and Fact Trackers not fully re-vetted here—preview separately.",
        "Some titles include holiday representation; parents are present without a sustained parent-bashing tone.",
      ]),
    },
    {
      titleRe: /\bwinnie[- ]the[- ]?pooh\b|\bhouse at pooh corner\b/i,
      authorRe: /milne|a\.?\s*a\.?\s*milne/i,
      detail: "Hand-verified for Halalit’s family shelf: Winnie-the-Pooh reads as clean.",
    },
    {
      titleRe: /\bwhere the wild things are\b/i,
      authorRe: /sendak|maurice/i,
      detail: "Hand-verified for Halalit’s family shelf: Where the Wild Things Are reads as clean.",
    },
    {
      titleRe: /\bthe cat in the hat\b|\bcat in the hat\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail: "Hand-verified for Halalit’s family shelf: The Cat in the Hat reads as clean.",
    },
    {
      titleRe: /\bmysterious benedict society\b|\bextraordinary education of nicholas benedict\b/i,
      authorRe: /stewart|trenton/i,
      detail: bookNote("The Mysterious Benedict Society (Trenton Lee Stewart)", [
        "Hand-verified clean overall.",
        "Some brother-bashing friction—not solely because they’re family.",
        "Book 3: brief dark moment near the end—preview for sensitive readers.",
      ]),
    },
    {
      titleRe: /\bfablehaven\b/i,
      authorRe: /mull|brandon/i,
      requiresMagicOptIn: true,
      detail: bookNote("Fablehaven (Brandon Mull)", [
        "Hand-verified clean overall.",
        "Some parent-bashing tone—parents aren’t trusted with the truth while kids take on dangerous world-saving stakes.",
      ]),
    },
    {
      titleRe: /\bgirl with the silver eyes\b|\bthe girl with the silver eyes\b/i,
      authorRe: /willo\s*davis\s*roberts|w\.?\s*d\.?\s*roberts/i,
      detail: bookNote("The Girl with the Silver Eyes (Willo Davis Roberts)", [
        "Hand-verified clean in owner scope for this title only.",
        "Illustrated novel—not a board book; older kids and up for interest.",
        "Other Willo Davis Roberts books are not hand-vetted on Halalit—preview each title separately.",
      ]),
    },
    {
      titleRe:
        /\balice'?s adventures in wonderland\b|\bthrough the looking[- ]glass\b|\blooking[- ]glass and what alice found there\b|\balice in wonderland\b/i,
      authorRe: /carroll|lewis\s*carroll|dodgson/i,
      detail:
        "Hand-verified for Halalit’s family shelf: Alice’s Adventures in Wonderland and Through the Looking-Glass read as clean.",
    },
    {
      titleRe: /\bhatchet\b/i,
      authorRe: /paulsen|gary/i,
      requiresMentalHealthComfortOptIn: true,
      negativeFamilyPortrayal: true,
      detail: bookNote("Hatchet (Gary Paulsen)", [
        "Hand-verified clean overall.",
        "Mental-illness mention—mental-health comfort note for older-child and teen+ readers.",
        "Parent-bashing tone—Brian’s mother secretly dating a stranger; painful family fracture.",
        "Book Quest includes when otherwise clean—exclude mental-health weight and/or negative family portrayal in Advanced recommendations settings if needed.",
      ]),
    },
    {
      titleRe: /\bbrian'?s winter\b/i,
      authorRe: /paulsen|gary/i,
      detail: bookNote("Brian’s Winter (Gary Paulsen)", [
        "Hand-verified clean overall.",
        "Survival beat where Brian marks territory the way animals do—not rear-end or toilet humor.",
      ]),
    },
    {
      titleRe: /\bbrown girl dreaming\b/i,
      authorRe: /woodson|jacqueline/i,
      detail: "Hand-verified for Halalit’s family shelf: Brown Girl Dreaming reads as clean.",
    },
    {
      titleRe: /\bwonder\b/i,
      authorRe: /palacio|r\.?\s*j\.?\s*palacio/i,
      excludesBookQuest: true,
      detail: bookNote("Wonder (R.J. Palacio)", [
        "Hand-verified mostly clean in owner scope.",
        "Childish gross-out humor—passing wind, peeing on a tree; flag for parents who skip that tone (not why Book Quest is parked).",
        "Jokey insult: one boy calls another boy’s friend their “boyfriend”—teasing, not LGBTQ representation; flag for parents (not why Book Quest is parked).",
        "Notes for parents: passing mention or two—the father was married to his first wife, had a relationship with another unmarried woman, and when her baby was on the way was about to marry her; owner unsure how much younger kids will catch the meaning—that beat is why Halalit won’t suggest it in Book Quest.",
        "Not a hard shelf ban—you can still look it up here before you share.",
      ]),
    },
    {
      titleRe: /\becho mountain\b/i,
      authorRe: /wolk|lauren\s*wolk/i,
      detail: bookNote("Echo Mountain (Lauren Wolk)", [
        "Hand-verified clean in owner scope.",
        "Historical family survival on a mountain homestead—mother and father both central; grief and a seriously injured father.",
        "Owner Mother’s Week pick.",
        "Preview for sensitive readers.",
      ]),
    },
    {
      titleRe: /fortunately,?\s*the milk/i,
      authorRe: /gaiman|neil/i,
      requiresMagicOptIn: true,
      detail: bookNote("Fortunately, the Milk (Neil Gaiman)", [
        "Hand-verified clean overall.",
        "Owner Father’s Week pick.",
        "Illustrated short novel—not a board book or a full chapter book; best as read-aloud for young children; older kids can enjoy it too.",
        "Whimsical fantasy (pirates, dinosaurs, time-travel aliens)—Book Quest includes when otherwise clean; exclude magic in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bgirl who drank the moon\b/i,
      authorRe: /barnhill|kelly/i,
      requiresMagicOptIn: true,
      detail: bookNote("The Girl Who Drank the Moon (Kelly Barnhill)", [
        "Hand-verified clean overall.",
        "Owner Mother’s Week and Grandparents Week pick.",
        "Fantasy magic—Book Quest includes when otherwise clean; exclude magic in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\blast kids on earth\b/i,
      authorRe: /brallier|max/i,
      detail: bookNote("The Last Kids on Earth (Max Brallier)", [
        "Hand-verified clean overall—no LGBTQ threads in owner scope.",
        "Childish gross-out humor (zombie-apocalypse jokes, bodily grossness)—preview if that bothers your family.",
      ]),
    },
    {
      titleRe: /\bgoodnight moon\b/i,
      authorRe: /brown|margaret\s*wise/i,
      detail: "Hand-verified for Halalit’s family shelf: Goodnight Moon reads as clean.",
    },
    {
      titleRe: /\bheidi\b/i,
      authorRe: /spyri|johanna/i,
      detail: bookNote("Heidi (Johanna Spyri)", [
        "Hand-verified clean in owner scope—fine for Halalit to recommend.",
        "Glowing praise for living in the natural mountain environment—owner Earth Week pick.",
        "Owner family-week on hold—some negative family portrayal; not abuse; may assign to a week later.",
        "See the faith-in-story note in Bookcheck—not Halalit’s deity/mythology tier.",
      ]),
    },
    {
      titleRe: LITTLE_HOUSE_SERIES_TITLE_RE,
      authorRe: /wilder|laura\s*ingalls/i,
      excludesBookQuest: true,
      detail: bookNote("Little House books (Laura Ingalls Wilder)", [
        "Hand-verified clean on Halalit's core content rules.",
        "If reading this series, keep in mind the pro-colonial narrative—look it up in Bookcheck for the full note.",
        "Halalit won't suggest it in Book Quest.",
      ]),
    },
    {
      titleRe: /\bcurious george\b/i,
      authorRe: /rey|h\.?\s*a\.?\s*rey|margret/i,
      detail: bookNote("Curious George (H.A. / Margret Rey)", [
        "Hand-verified clean overall for the line.",
        "Original book specifically: the Man in the Yellow Hat takes George from the wild like a kidnapping—don’t normalize that beat; preview or skip the first book.",
        "Some later books include holiday representation—preview if your family skips seasonal holiday stories.",
      ]),
    },
    {
      titleRe: /\bgeronimo stilton\b/i,
      authorRe: /stilton|geronimo/i,
      detail: "Hand-verified for Halalit’s family shelf: Geronimo Stilton reads very clean.",
    },
    {
      titleRe: /\bwho was\b|\bwho is\b|\bwho were\b/i,
      detail: bookNote("Who Was / Who Is (biography series)", [
        "Generally clean on content in owner scope—not full history coverage, but nothing flagged.",
        "Individual titles may touch war, tragedy, or mature lives—preview like any biography.",
      ]),
    },
    {
      titleRe: /\bmagic school bus\b/i,
      authorRe: /cole|joanna|degen|bruce\s*degen/i,
      detail: bookNote("The Magic School Bus (original series)", [
        "Generally fine in owner scope.",
        "Gross-out body humor (e.g. inside a dog’s nose, fire-hydrant smells)—not adult content.",
      ]),
    },
    {
      titleRe: /\bberenstain bears\b|\bthe berenstain bears\b/i,
      authorRe: /berenstain/i,
      detail: bookNote("Berenstain Bears", [
        "Generally fine in owner scope.",
        "Owner Parents Week pick—pretty good family series overall.",
        "Mother’s Day titles from the series—owner Mother’s Week picks; Father’s Day titles—owner Father’s Week picks.",
        "The Berenstain Bears Go Green / Earth Day title—owner Earth Week pick (pro-nature message).",
        "Some books include Christian holiday content—preview for families who skip religious holidays.",
      ]),
    },
    {
      titleRe: /\bclifford\b|\bclifford the big red dog\b/i,
      authorRe: /bridwell|norman/i,
      detail: bookNote("Clifford the Big Red Dog", [
        "Generally fine in owner scope.",
        "Some books include Christian holiday content—preview for families who skip religious holidays.",
      ]),
    },
    {
      titleRe: /\bsisters\b/i,
      authorRe: /telgemeier|raina/i,
      detail: bookNote("Sisters (Raina Telgemeier)", [
        "Hand-verified clean overall.",
        "Family-bashing tone in places—not only imperfect-family friction.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe:
        /\bthe unwanteds\b|\bisland of silence\b|\bisland of fire\b|\bisland of legends\b|\bisland of shipwrecks\b/i,
      authorRe: /mcmann|lisa/i,
      detail: bookNote("The Unwanteds (first series)", [
        "Hand-verified clean in owner scope for the first series.",
        "Serious parent-bashing tone; light romance—still clean on Halalit’s romance rules.",
        "Sequel series (Unwanteds Quests) adds LGBTQ storylines—Halalit won’t recommend that follow-up line.",
      ]),
    },
    {
      titleRe: /\bmeet samantha\b|\bsamantha\b.*\bamerican girl\b|\bamerican girl\b.*\bsamantha\b/i,
      authorRe: /adler|susan|tripp|valerie/i,
      detail: bookNote("American Girl — Samantha (scope)", [
        "Hand-verified clean for Samantha books in owner scope.",
        "Other American Girl lines and characters not owner-vetted here—check each separately.",
      ]),
    },
    {
      titleRe: /\bvery hungry caterpillar\b|\bhungry caterpillar\b/i,
      authorRe: /carle|eric/i,
      detail:
        "Hand-verified for Halalit’s family shelf: The Very Hungry Caterpillar reads as clean.",
    },
    {
      titleRe: /\bdon'?t let the pigeon drive the bus\b|\bpigeon drive the bus\b/i,
      authorRe: /willems|mo/i,
      detail:
        "Hand-verified for Halalit’s family shelf: Don’t Let the Pigeon Drive the Bus reads as clean.",
    },
    {
      titleRe: /\bthe lorax\b|\blorax\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail: "Hand-verified for Halalit’s family shelf: The Lorax reads as clean.",
    },
    {
      titleRe: /\bharold and the purple crayon\b|\bharold\b.*\bpurple crayon\b/i,
      authorRe: /johnson|crockett/i,
      detail:
        "Hand-verified for Halalit’s family shelf: Harold and the Purple Crayon reads as clean.",
    },
    {
      titleRe: /\btreasure island\b/i,
      authorRe: /stevenson|robert\s*louis/i,
      detail: bookNote("Treasure Island (Robert Louis Stevenson)", [
        "Hand-verified clean overall.",
        "Alcohol mentions; Jim helps his mother run an inn—preview if you avoid inn/alcohol settings.",
      ]),
    },
    {
      titleRe: /\bella enchanted\b/i,
      authorRe: /levine|gail/i,
      detail: bookNote("Ella Enchanted (Gail Carson Levine)", [
        "Hand-verified clean overall.",
        "Father and stepfamily bashing—not only imperfect-family friction.",
      ]),
    },
    {
      titleRe: /\bgregor the overlander\b|\bunderland chronicles\b/i,
      authorRe: /collins|suzanne/i,
      requiresMagicOptIn: true,
      detail: bookNote("Gregor the Overlander (Suzanne Collins)", [
        "Hand-verified clean overall.",
        "Romance hints—nothing heavier in scope reviewed.",
      ]),
    },
    {
      titleRe: /\bwonder\s*light\b|\bunicorns of the mist\b/i,
      authorRe: /russell|r\.?\s*r/i,
      detail: bookNote("Wonder Light / Unicorns of the Mist (R.R. Russell)", [
        "Hand-verified clean overall.",
        "Some family negativity—not only imperfect-family friction.",
      ]),
    },
    {
      titleRe: /\bthe giving tree\b|\bgiving tree\b|\bwhere the sidewalk ends\b|\bsidewalk ends\b/i,
      authorRe: /silverstein|shel/i,
      detail:
        "Hand-verified for Halalit’s family shelf: The Giving Tree and Where the Sidewalk Ends read as clean.",
    },
    {
      titleRe: /\bchicka chicka boom boom\b/i,
      authorRe: /martin|archambault|ehlert/i,
      detail: "Hand-verified for Halalit’s family shelf: Chicka Chicka Boom Boom reads as clean.",
    },
    {
      titleRe: /\bbrown bear, brown bear\b|\bbrown bear\b.*\bwhat do you see\b/i,
      authorRe: /martin|carle/i,
      detail:
        "Hand-verified for Halalit’s family shelf: Brown Bear, Brown Bear, What Do You See? reads as clean.",
    },
    {
      titleRe: /\blittle engine that could\b|\bthe little engine that could\b/i,
      authorRe: /piper|watty|long/i,
      detail: "Hand-verified for Halalit’s family shelf: The Little Engine That Could reads as clean.",
    },
    {
      titleRe: /\bsecret of the old clock\b/i,
      authorRe: /keene|drew|carolyn/i,
      detail: bookNote("Nancy Drew — The Secret of the Old Clock", [
        "Hand-verified clean for this book.",
        "Rest of the Nancy Drew line not owner-vetted—preview other titles separately.",
      ]),
    },
    {
      titleRe: /\brainbow fish\b|\bthe rainbow fish\b/i,
      authorRe: /pfister|marcus/i,
      detail: "Hand-verified for Halalit’s family shelf: The Rainbow Fish reads as clean.",
    },
    {
      titleRe: /\bcloudy with a chance of meatballs\b|\bcloudy\b.*\bmeatballs\b/i,
      authorRe: /barrett|judi/i,
      detail:
        "Hand-verified for Halalit’s family shelf: Cloudy with a Chance of Meatballs reads as clean.",
    },
    {
      titleRe: /\bthe witches\b|\bwitches\b/i,
      authorRe: /dahl|roald/i,
      detail: bookNote("The Witches (Roald Dahl)", [
        "Hand-verified for Halalit’s family shelf.",
        "Owner Grandparents Week pick.",
      ]),
    },
    {
      titleRe: /\bthe twits\b|\btwits\b/i,
      authorRe: /dahl|roald/i,
      detail: "Hand-verified for Halalit’s family shelf: The Twits reads as clean.",
    },
    {
      titleRe: /\bthe graveyard book\b|\bgraveyard book\b/i,
      authorRe: /gaiman|neil/i,
      detail: bookNote("The Graveyard Book (Neil Gaiman)", [
        "Hand-verified clean overall.",
        "Dark tone—preview for sensitive readers.",
      ]),
    },
    {
      titleRe: /\bthe sneetches\b|\bsneetches and other stories\b|\bsneetches\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail: "Hand-verified for Halalit’s family shelf: The Sneetches and Other Stories reads as clean.",
    },
    {
      titleRe: /\bfox in socks\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail: "Hand-verified for Halalit’s family shelf: Fox in Socks reads as clean.",
    },
    {
      titleRe: /\bhop on pop\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail: bookNote("Hop on Pop (Dr. Seuss)", [
        "Hand-verified for Halalit’s family shelf.",
        "Owner family-week candidate—Father’s Week idk.",
      ]),
    },
    {
      titleRe: /\blove you forever\b/i,
      authorRe: /munsch|robert/i,
      detail: bookNote("Love You Forever", [
        "Hand-verified for Halalit’s family shelf.",
        "Owner Parents Week pick.",
      ]),
    },
    {
      titleRe: /\bare you my mother\b/i,
      authorRe: /eastman|p\.?\s*d\.?\s*eastman/i,
      detail: "Hand-verified for Halalit’s family shelf: Are You My Mother? reads as clean.",
    },
    {
      titleRe: /\bthe enormous crocodile\b|\benormous crocodile\b/i,
      authorRe: /dahl|roald/i,
      detail: "Hand-verified for Halalit’s family shelf: The Enormous Crocodile reads as clean.",
    },
    {
      titleRe: /\bthe magic finger\b|\bmagic finger\b/i,
      authorRe: /dahl|roald/i,
      negativeFamilyPortrayal: true,
      detail: bookNote("The Magic Finger (Roald Dahl)", [
        "Hand-verified plot-clean overall.",
        "Family portrayed negatively—the hunting family is cast as cruel antagonists (turnabout via magic).",
        "Book Quest includes when otherwise clean—exclude negative family portrayal in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bhenry huggins\b/i,
      authorRe: /cleary|beverly/i,
      detail: "Hand-verified for Halalit’s family shelf: Henry Huggins reads as clean.",
    },
    {
      titleRe: /\bone fish two fish red fish blue fish\b|\bone fish, two fish\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail:
        "Hand-verified for Halalit’s family shelf: One Fish Two Fish Red Fish Blue Fish reads as clean.",
    },
    {
      titleRe: /\bthe cat in the hat comes back\b|\bcat in the hat comes back\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail: "Hand-verified for Halalit’s family shelf: The Cat in the Hat Comes Back reads as clean.",
    },
    {
      titleRe: /\byertle the turtle\b|\byertle the turtle and other stories\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail: "Hand-verified for Halalit’s family shelf: Yertle the Turtle and Other Stories reads as clean.",
    },
    {
      titleRe: /\bbartholomew and the oobleck\b|\boobleck\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail: "Hand-verified for Halalit’s family shelf: Bartholomew and the Oobleck reads as clean.",
    },
    {
      titleRe: /\bthe very busy spider\b|\bvery busy spider\b/i,
      authorRe: /carle|eric/i,
      detail: "Hand-verified for Halalit’s family shelf: The Very Busy Spider reads as clean.",
    },
    {
      titleRe: /\bribsy\b/i,
      authorRe: /cleary|beverly/i,
      detail: "Hand-verified for Halalit’s family shelf: Ribsy reads as clean.",
    },
    {
      titleRe: /\bbeezus and ramona\b/i,
      authorRe: /cleary|beverly/i,
      detail: bookNote("Beezus and Ramona (Beverly Cleary)", [
        "Hand-verified clean overall.",
        "Light family friction—a lesson that you don’t have to love your sister all the time; preview if that tone bothers your family.",
      ]),
    },
    {
      titleRe: /\bwhere'?s spot\b|\bwheres spot\b/i,
      authorRe: /hill|eric/i,
      detail: "Hand-verified for Halalit’s family shelf: Where’s Spot? reads as clean.",
    },
    {
      titleRe: /\bthe giraffe and the pelly and me\b|\bgiraffe and the pelly and me\b/i,
      authorRe: /dahl|roald/i,
      detail:
        "Hand-verified for Halalit’s family shelf: The Giraffe and the Pelly and Me reads as clean.",
    },
    {
      titleRe: /\bhorton hears a who\b|\bhorton hears a who!\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail: "Hand-verified for Halalit’s family shelf: Horton Hears a Who! reads as clean.",
    },
    {
      titleRe: /\bdr\.?\s*seuss'?s sleep book\b|\bsleep book\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail: "Hand-verified for Halalit’s family shelf: Dr. Seuss’s Sleep Book reads as clean.",
    },
    {
      titleRe: /\b500 hats of bartholomew cubbins\b|\bthe 500 hats of bartholomew cubbins\b|\bbartholomew cubbins\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail:
        "Hand-verified for Halalit’s family shelf: The 500 Hats of Bartholomew Cubbins reads as clean.",
    },
    {
      titleRe: /\bif i ran the zoo\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail: "Hand-verified for Halalit’s family shelf: If I Ran the Zoo reads as clean.",
    },
    {
      titleRe: /\bif i ran the circus\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail: "Hand-verified for Halalit’s family shelf: If I Ran the Circus reads as clean.",
    },
    {
      titleRe:
        /\bthe king'?s stilts\b|\bon beyond zebra\b|\bscrambled eggs super\b|\bthe foot book\b|\bthidwick the big[- ]hearted moose\b|\bdid i ever tell you how lucky you are\b|\bi can read with my eyes shut\b|\boh, the places you'?ll go\b|\bthe butter battle book\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      detail:
        "Hand-verified for Halalit’s family shelf: these Dr. Seuss titles read as clean.",
    },
    {
      titleRe: /\bhouse at pooh corner\b|\bwhen we were very young\b|\bnow we are six\b/i,
      authorRe: /milne|a\.?\s*a\.?\s*milne/i,
      detail: bookNote("Winnie-the-Pooh companion books (A.A. Milne)", [
        "Hand-verified for Halalit’s family shelf—same line as Winnie-the-Pooh.",
        "Owner has not re-read these three cover to cover; verdict follows the Pooh legacy.",
      ]),
    },
    {
      titleRe: /\bguess how much i love you\b/i,
      authorRe: /mcbratney|sam/i,
      detail: bookNote("Guess How Much I Love You", [
        "Hand-verified for Halalit’s family shelf.",
        "Owner Parents Week pick.",
      ]),
    },
    {
      titleRe: /\bwonderful wizard of oz\b|\bthe wizard of oz\b/i,
      authorRe: /baum|l\.?\s*frank/i,
      detail: bookNote("The Wonderful Wizard of Oz (L. Frank Baum)", [
        "Hand-verified clean overall.",
        "Inadvertent villain deaths—the house lands on one witch; a splash kills another without Dorothy realizing at first.",
        "Preview for sensitive readers.",
      ]),
    },
    {
      titleRe:
        /\bozma of oz\b|\bdorothy and the wizard in oz\b|\bthe road to oz\b|\bemerald city of oz\b|\bthe patchwork girl of oz\b|\btik[- ]tok of oz\b|\bthe scarecrow of oz\b|\brinkitink in oz\b|\bthe lost princess of oz\b|\bthe tin woodman of oz\b|\bthe magic of oz\b|\bglinda of oz\b/i,
      authorRe: /baum|l\.?\s*frank/i,
      detail: bookNote("Oz series (L. Frank Baum, volumes after book 1)", [
        "Hand-verified clean in owner scope for the rest of the line.",
        "Book 2—The Marvelous Land of Oz—is flagged separately; owner is still re-checking that volume.",
      ]),
    },
    {
      titleRe:
        /\bsisters grimm\b|\bfairy[- ]tale detectives\b|\bunusual suspects\b|\bproblem child\b|\bonce upon a crime\b|\bmagic mirror\b|\bespecially peculiar\b|\bbe grimm\b|\binside the story\b|\bcouncil of mirrors\b/i,
      authorRe: /buckley|michael/i,
      detail: bookNote("The Sisters Grimm (Michael Buckley)", [
        "Hand-verified clean overall.",
        "Owner Parents Week and Grandparents Week pick—great family series.",
        "Some books carry a darker mentality—preview for sensitive readers.",
        "Parent-bashing tone in places—not only imperfect-family friction.",
      ]),
    },
    {
      titleRe: /\bspiderwick\b|\bfield guide\b.*\bspiderwick\b|\blucinda'?s secret\b|\bseeing stone\b|\bironwood tree\b|\bwrath of mulgarath\b|\bnectar of dreams\b|\bnixie'?s song\b|\bgiant problem\b|\bwyrm king\b/i,
      authorRe: /black|holly|diterlizzi|tony/i,
      detail:
        "Hand-verified for Halalit’s family shelf: The Spiderwick Chronicles (and Beyond) read as clean across the series.",
    },
    {
      titleRe: /\bbook scavenger\b|\buncharted\b|\balcatraz escape\b|\barchive of the unlucky\b/i,
      authorRe: /bertman|chambliss/i,
      detail: bookNote("Book Scavenger (Jennifer Chambliss Bertman)", [
        "Hand-verified clean in owner scope.",
        "Light parent friction about moving—not sustained parent-bashing.",
      ]),
    },
    {
      titleRe: /\bcastle glower\b|\btuesdays at the castle\b|\bwednesdays in the tower\b|\bthursdays with the crown\b|\bfridays with the wizards\b|\bsaturdays at sea\b/i,
      authorRe: /george|jessica/i,
      detail: bookNote("Castle Glower (Jessica Day George)", [
        "Hand-verified clean in owner scope.",
        "Owner Parents Week pick.",
        "Light romance threads—nothing beyond kissing/hugging in owner scope.",
      ]),
    },
    {
      titleRe: /\bdragons in a bag\b|\bdragon thief\b|\bwitch's boy\b|\benchanted bridge\b|\bwar of the witches\b/i,
      authorRe: /elliott|zetta/i,
      detail: "Hand-verified for Halalit’s family shelf: Dragons in a Bag reads as clean in owner scope.",
    },
    {
      titleRe: /\beva evergreen\b/i,
      authorRe: /abe|julie/i,
      detail: bookNote("Eva Evergreen (Julie Abe)", [
        "Book 1 hand-verified clean in owner scope.",
        "Book 2 not owner-vetted here—preview before sharing.",
      ]),
    },
    {
      titleRe: /\bjinx\b|\bjinx'?s magic\b/i,
      authorRe: /blackwood|sage/i,
      detail: bookNote("Jinx (Sage Blackwood)", [
        "Hand-verified clean in owner scope—Halalit may auto-recommend.",
        "Major side character faces serious parent-bashing from a guardian—not the lead’s parents throughout.",
      ]),
    },
    {
      titleRe: /\bthe gilded girl\b|\bcrimson twilight\b/i,
      authorRe: /colman|alyssa/i,
      detail: bookNote("The Gilded Girl duology (Alyssa Colman)", [
        "Hand-verified clean so far in owner scope.",
        "Grief/deceased-parent beats and light romance in book 2—preview if that tone matters.",
      ]),
    },
    {
      titleRe: /\bmeesh the bad demon\b|\bmeesh\b.*\bbad demon\b/i,
      authorRe: /lam|michelle/i,
      ownerAiThemeAbsent: { lgbtq: true, deity_mythology: true },
      detail: bookNote("Meesh the Bad Demon (Michelle Lam)", [
        "Hand-verified clean in owner scope.",
        "Owner read: no explicit LGBTQ—awkward girl friendship reads as introversion and demon/fairy tension, not romance.",
        "Fantasy “demons” are a species—not religious demonology or worship.",
        "Some parent-bashing beats toward family—not only imperfect-family friction.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    /* Owner vet batch — Jun 2026: recommend with comfort toggles / flags (not hard ban) */
    {
      titleRe: /\bmatilda\b/i,
      authorRe: /dahl|roald/i,
      negativeFamilyPortrayal: true,
      detail: bookNote("Matilda (Roald Dahl)", [
        "Hand-verified clean in owner scope.",
        "Severe family-bashing toward parents—sustained neglect/hostility, not physical abuse.",
        "Book Quest includes when otherwise clean—exclude negative family portrayal in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bjames and the giant peach\b|\bthe giant peach\b/i,
      authorRe: /dahl|roald/i,
      negativeFamilyPortrayal: true,
      detail: bookNote("James and the Giant Peach (Roald Dahl)", [
        "Hand-verified clean in owner scope.",
        "Severe family-bashing toward the protagonist's family—cruel/neglectful, not physical abuse.",
        "Book Quest includes when otherwise clean—exclude negative family portrayal in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bcharlie and the chocolate factory\b|\bcharlie and the great glass elevator\b/i,
      authorRe: /dahl|roald/i,
      detail: bookNote("Charlie and the Chocolate Factory (Roald Dahl)", [
        "Hand-verified clean for Halalit’s family shelf—no crass wording that would keep it off recommend.",
        "Includes the Great Glass Elevator sequel under the same hand-check line.",
      ]),
    },
    {
      titleRe: /\bgeorge'?s marvelous medicine\b|\bgeorge'?s marvellous medicine\b|\bmarvelous medicine\b/i,
      authorRe: /dahl|roald/i,
      negativeFamilyPortrayal: true,
      detail: bookNote("George’s Marvelous Medicine (Roald Dahl)", [
        "Hand-verified plot-clean overall for Halalit’s shelf rules.",
        "Severe grandmother-bashing—family portrayed very negatively (poisoning framed without remorse).",
        "Book Quest includes when otherwise clean—exclude negative family portrayal in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bpax\b|pax, journey home/i,
      authorRe: /pennypacker|sara/i,
      negativeFamilyPortrayal: true,
      requiresMentalHealthComfortOptIn: true,
      detail: bookNote("Pax (Sara Pennypacker)", [
        "Hand-verified clean in owner scope.",
        "Journey Home (book 2): protagonist helps heal land scarred by war his father fought in—strong Earth Week stewardship angle.",
        "Mental-health weight and dark-mentality moments—comfort note for older-child and teen+ readers.",
        "Negative family portrayal beats in owner scope.",
        "Book Quest includes when otherwise clean—exclude mental-health weight and/or negative family portrayal in Advanced recommendations settings if needed.",
      ]),
    },
    {
      titleRe: /\bgirl who could fly|piper mccloud|boy who knew everything|girl who fell out of the sky/i,
      authorRe: /forester|victoria/i,
      negativeFamilyPortrayal: true,
      requiresLightRomanceOptIn: true,
      detail: bookNote("Piper McCloud (Victoria Forester)", [
        "Hand-verified clean in owner scope with some dark moments and parent-bashing beats.",
        "Owner Parents Week pick.",
        "Brief romance hints—flag for parents.",
        "Book Quest includes when otherwise clean—exclude light romance and/or negative family portrayal in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bgirl and the witch'?s garden\b/i,
      authorRe: /bowman|erin/i,
      negativeFamilyPortrayal: true,
      detail: bookNote("The Girl and the Witch's Garden (Erin Bowman)", [
        "Hand-verified clean in owner scope.",
        "Heavier parent negativity—not dark adult abuse in owner scope.",
        "Book Quest includes when otherwise clean—exclude negative family portrayal in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bhappily for now\b/i,
      authorRe: /jones|kelly/i,
      negativeFamilyPortrayal: true,
      requiresSubstanceOptIn: true,
      detail: bookNote("Happily for Now (Kelly Jones)", [
        "Hand-verified clean in owner scope.",
        "Family negativity and addiction/rehab themes for a parent character.",
        "Book Quest includes when otherwise clean—exclude negative family portrayal and/or alcohol/drug-related content in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\banne of green gables\b/i,
      authorRe: /montgomery|l\.?\s*m\.?\s*montgomery/i,
      requiresSubstanceOptIn: true,
      detail: bookNote("Anne of Green Gables (L.M. Montgomery)", [
        "Hand-verified clean in owner scope.",
        "Mild romance overall.",
        "Key scene: Anne (a minor) serves currant wine as cordial; another minor gets very drunk.",
        "Book Quest includes when otherwise clean—exclude alcohol/drug-related content in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\banne of green gables\b.*\bgraphic\b|\bgraphic\b.*\banne of green gables\b/i,
      requiresSubstanceOptIn: true,
      detail: bookNote("Anne of Green Gables (graphic novel adaptation)", [
        "Graphic adaptation—hand-verified clean in owner scope.",
        "Same substance/romance notes as the prose novel (currant-wine cordial scene).",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
        "Book Quest includes when otherwise clean—exclude alcohol/drug-related content in Advanced recommendations settings if needed.",
      ]),
    },
    {
      titleRe: /\bflunked\b|\bfairy tale reform school\b|\bcharmed\b|\btricked\b|\bspellbound\b|\bwished\b/i,
      authorRe: /calonita|jen/i,
      requiresLightRomanceOptIn: true,
      detail: bookNote("Fairy Tale Reform School (Jen Calonita)", [
        "Hand-verified clean in owner scope with light/dating romance mentions.",
        "Series ends on a cliffhanger—note for parents finishing the arc.",
        "Book Quest includes when otherwise clean—exclude light romance in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\btwo princesses of bamarre\b/i,
      authorRe: /levine|gail/i,
      requiresLightRomanceOptIn: true,
      detail: bookNote("The Two Princesses of Bamarre (Gail Carson Levine)", [
        "Hand-verified clean with light romance—no kissing until after marriage in owner scope.",
        "Flag possible Stockholm-style attachment toward a dragon captor—parent preview.",
        "Book Quest includes when otherwise clean—exclude light romance in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bframed\b|\bvanished\b|\btrapped\b/i,
      authorRe: /ponti|james/i,
      detail: bookNote("Framed! (James Ponti)", [
        "Hand-verified clean in owner scope.",
        "Book 3: parent-bashing beats—preview that volume.",
      ]),
    },
    {
      titleRe: /\bsamurai kids|owl ninja|shaolin tiger/i,
      authorRe: /fussell|sandy/i,
      detail: bookNote("Samurai Kids (Sandy Fussell)", [
        "Hand-verified largely clean in owner scope (books 1–3).",
        "Serious dark parts in places—preview intensity.",
        "Other-religion representation—flag for parents.",
        "Scene helping an elderly naked man out of a shower/bath—preview modesty.",
        "Text calls out a sexism beat within the story.",
        "Rest of series not owner-vetted.",
      ]),
    },
    {
      titleRe: /\bhappy happy clover\b/i,
      authorRe: /tatsuyama|sayuri/i,
      requiresDeityMythologyOptIn: true,
      detail: bookNote("Happy Happy Clover (Sayuri Tatsuyama, manga)", [
        "Hand-verified clean in owner scope.",
        "Owner Earth Week pick—gentle meadow/rabbit nature story.",
        "Brief deity-style mythology in a later volume—comfort note.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
        "Book Quest includes when otherwise clean—exclude deity/mythology in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bwhen you trap a tiger\b/i,
      authorRe: /keller|tae/i,
      requiresDeityMythologyOptIn: true,
      negativeFamilyPortrayal: true,
      detail: bookNote("When You Trap a Tiger (Tae Keller)", [
        "Hand-verified clean in owner scope.",
        "Deity or folklore treated as real; possible family negativity.",
        "Book Quest includes when otherwise clean—exclude deity/mythology and/or negative family portrayal in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\btrials of morrigan crow\b|\bnevermoor:\s*the trials of morrigan crow\b/i,
      authorRe: /townsend|jessica/i,
      requiresMagicOptIn: true,
      negativeFamilyPortrayal: true,
      detail: bookNote("Nevermoor: The Trials of Morrigan Crow (Jessica Townsend, book 1)", [
        "Hand-verified clean in owner scope—book 1 only.",
        "Very negative family portrayal—not merely annoying family friction.",
        "Fantasy magic—Book Quest includes when otherwise clean; exclude magic and/or negative family portrayal in Advanced recommendations settings on the play page if needed.",
        "Rest of the Nevermoor series not owner-vetted here—books 2+ add LGBTQ storylines and an Israfel angel beat with Muslim-beliefs misrepresentation; preview before sharing later volumes.",
      ]),
    },
    {
      titleRe: /\bcity of fire\b|\bcity of ice\b|\bcity of death\b|\bcity trilogy\b/i,
      authorRe: /yep|laurence/i,
      requiresDeityMythologyOptIn: true,
      requiresLightRomanceOptIn: true,
      requiresSubstanceOptIn: true,
      negativeFamilyPortrayal: true,
      detail: bookNote("City Trilogy (Laurence Yep) — City of Fire, City of Ice, City of Death", [
        "Hand-verified largely clean in owner scope.",
        "Very deity- and mythology-heavy—Chinese-style spirits, gods, and folklore treated as real.",
        "Wine in all three books; at least one scene presents wine positively in a magical fix.",
        "Some one-sided romantic tension between two tanukis in book 1—preview if that bothers you.",
        "Parent negativity toward mostly absent biological family—not only imperfect-family friction.",
        "Book Quest includes when otherwise clean—exclude deity/mythology, light romance, alcohol/drug-related content, and/or negative family portrayal in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bland of roar\b|\breturn to roar\b|\bbattle for roar\b/i,
      authorRe: /mclachlan|jenny/i,
      requiresMagicOptIn: true,
      detail: bookNote("The Land of Roar (Jenny McLachlan, trilogy)", [
        "Hand-verified clean cover to cover — trilogy (books 1–3) in owner scope.",
        "Imaginary-world fantasy adventure with dragons and magic.",
        "Later Land of Roar spin-offs not owner-vetted here—preview separately.",
        "Book Quest includes when otherwise clean—exclude magic in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bland of elyon\b|\bdark hills divide\b|\bbeyond the valley of thorns\b/i,
      authorRe: /carman|patrick/i,
      requiresDeityMythologyOptIn: true,
      detail: bookNote("The Land of Elyon (Patrick Carman)", [
        "Hand-verified clean in owner scope.",
        "Owner Earth Week strong-maybe—forest/wild-world adventure; vet message strength when you read.",
        "Some deity or mythology treated as real later—comfort note for parents.",
        "Book Quest includes when otherwise clean—exclude deity/mythology in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bcall of the wild\b/i,
      authorRe: /london|jack/i,
      detail: bookNote("The Call of the Wild (Jack London)", [
        "Hand-verified for Halalit's family shelf.",
        "Classic survival tale—preview intensity and darkness for younger readers.",
      ]),
    },
    {
      titleRe: /\bwhite fang\b/i,
      authorRe: /london|jack/i,
      detail: bookNote("White Fang (Jack London)", [
        "Hand-verified for Halalit's family shelf.",
        "Classic survival tale—preview intensity and darkness for younger readers.",
      ]),
    },
    {
      titleRe: /\bqueenie peavy\b/i,
      authorRe: /burch|robert/i,
      requiresSubstanceOptIn: true,
      detail: bookNote("Queenie Peavy (Robert Burch)", [
        "Hand-verified largely clean in owner scope.",
        "Protagonist and best friend smoke at one point and it isn't called out—parent preview.",
        "Book Quest includes when otherwise clean—exclude alcohol/drug-related content in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bsave me a seat\b/i,
      authorRe: /weeks|sarah/i,
      detail: bookNote("Save Me a Seat (Sarah Weeks)", [
        "Hand-verified clean in owner scope.",
        "Bullying not always called out—parent preview.",
      ]),
    },
    {
      titleRe: /\bpumpkin princess\b/i,
      authorRe: /banbury|steven/i,
      detail: bookNote("The Pumpkin Princess (Steven Banbury)", [
        "Hand-verified clean in owner scope.",
        "Flag Christian holiday references and family negativity—parent preview.",
      ]),
    },
    {
      titleRe: /\bto kill a mockingbird\b/i,
      authorRe: /lee|harper/i,
      requiresSubstanceOptIn: true,
      detail: bookNote("To Kill a Mockingbird (Harper Lee)", [
        "Hand-verified in owner scope.",
        "Owner Father’s Week pick—Atticus/father figure central.",
        "Racism and drugs shown; story condemns them in owner scope.",
        "Morphine-for-the-dying beat—parent discretion.",
        "Book Quest includes when otherwise clean—exclude alcohol/drug-related content in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bto kill a mockingbird\b.*\bgraphic\b|\bgraphic\b.*\bto kill a mockingbird\b/i,
      authorRe: /fordham|fred/i,
      requiresSubstanceOptIn: true,
      detail: bookNote("To Kill a Mockingbird: A Graphic Novel (Fred Fordham)", [
        "Owner Father’s Week pick—same story as Harper Lee novel.",
        "Racism, drugs, morphine beat; parent discretion.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
        "Book Quest includes when otherwise clean—exclude alcohol/drug-related content in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bbabymouse\b/i,
      authorRe: /holm|jennifer/i,
      detail: bookNote("Babymouse (Jennifer L. Holm, graphic novels)", [
        "Most volumes hand-verified clean in owner scope—Book Quest includes when otherwise clean.",
        "Skip the “Beach Babe” installment (beach/bikini immodesty)—see that separate hand note when the title matches.",
        "Christian holiday beats may appear in some volumes—preview if that matters.",
        "No fanservice in owner scope for most volumes—still preview panel art.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\bellie makes her move\b/i,
      authorRe: /kaye|marilyn/i,
      detail: bookNote("Ellie Makes Her Move (Marilyn Kaye)", [
        "Book 1 hand-verified clean—rest of series not owner-vetted yet.",
      ]),
    },
    {
      titleRe: /\bfloors\b/i,
      authorRe: /carman|patrick/i,
      detail: bookNote("Floors (Patrick Carman)", [
        "Books 1–2 fine in owner scope—rest not owner-vetted yet.",
        "Owner family-week maybe—does not center dad; week not assigned.",
      ]),
    },
    {
      titleRe: /\boperation sisterhood\b/i,
      authorRe: /rhuday|olugbemisola/i,
      detail: bookNote("Operation Sisterhood (Olugbemisola Rhuday-Perkovich)", [
        "Book 1 fine in owner scope—rest not owner-vetted yet.",
        "Owner family-week maybe—does not center mom; week not assigned.",
      ]),
    },
    {
      titleRe: /\blost rainforest\b|\bmez'?s magic\b/i,
      authorRe: /schrefer|eliot/i,
      detail: bookNote("The Lost Rainforest (Eliot Schrefer)", [
        "Hand-verified clean in owner scope for book 1 (Mez's Magic)—rainforest animal-POV fantasy.",
        "Owner unsure how strong the pro-environmental message is—nature setting yes; stewardship advocacy idk for Earth Week framing.",
        "Volumes after book 1 not owner-vetted yet—preview before sharing the full series.",
      ]),
    },
    {
      titleRe: /\brevenge of magic\b|\btimeless one\b/i,
      authorRe: /riley|james/i,
      detail: bookNote("The Revenge of Magic (James Riley)", [
        "Books 1–4 clean in owner scope with family negativity.",
        "Book 5 not owner-vetted—recheck before recommending the full set.",
      ]),
    },
    {
      titleRe: /\bhexbridge castle\b/i,
      authorRe: /kent|gabrielle/i,
      detail: bookNote("The Secrets of Hexbridge Castle (Gabrielle Kent)", [
        "Book 1 clean—rest not owner-vetted yet.",
      ]),
    },
    {
      titleRe: /\bdragon of trelian\b|\btrelian\b/i,
      authorRe: /knudsen|michelle/i,
      detail: bookNote("Trelian (Michelle Knudsen)", [
        "Book 1 likely fine—rest not owner-vetted yet.",
      ]),
    },
    {
      titleRe: /\bsci-fi junior high\b/i,
      authorRe: /martin|john/i,
      detail: bookNote("Sci-Fi Junior High", [
        "Book 1 hand-verified clean—rest of series not owner-vetted yet.",
      ]),
    },
    {
      titleRe: /\bsheets\b/i,
      authorRe: /thummler|brenna/i,
      detail: bookNote("Sheets (Brenna Thummler, graphic novels)", [
        "Book 1 reads clean in owner scope.",
        "Book 2 leans into mental-health themes—series not fully owner-vetted.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\bpocket peaches\s*:\s*at the fair\b|\bpocket peaches\b(?!\s*:)/i,
      authorRe: /wang|dora\s*wang/i,
      detail: bookNote("Pocket Peaches (Dora Wang, graphic novels — books 1–2)", [
        "Hand-verified clean in owner scope for book 1 (Pocket Peaches) and book 2 (At the Fair).",
        "Graphic novels—not chapter books; cozy little-kids comics tone, better suited to younger readers than older kids or teens.",
        "Book 3 (Game On) and later volumes not owner-vetted—preview separately.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\blittle snow fairy sugar\b/i,
      authorRe: /aoi|haruka/i,
      detail: bookNote("A Little Snow Fairy Sugar (Haruka Aoi, manga)", [
        "Hand-verified clean in owner scope—owner still checking outfit art in panels.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\bsummer vamp\b/i,
      authorRe: /karim|violet/i,
      detail: bookNote("Summer Vamp (Violet Chan Karim, graphic novels)", [
        "Hand-verified fine in owner scope.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\bmidwatch institute\b/i,
      authorRe: /rossell|judith/i,
      detail: bookNote("The Midwatch Institute for Wayward Girls (Judith Rossell)", [
        "Hand-verified clean in owner scope.",
        "Cover art: cartoon girls in dresses with bare knees—preview covers.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\brebel genius\b|\bwarrior genius\b|\bgeniuses\b/i,
      authorRe: /dimartino|michael/i,
      detail: bookNote("Geniuses (Michael Dante DiMartino)", [
        "Hand-verified largely clean in owner scope.",
        "Darker tone—preview intensity; books 1–2 read cleaner—preview the rest.",
      ]),
    },
    {
      titleRe: /\boh, the places you'?ll go\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      requiresSubstanceOptIn: true,
      detail: bookNote("Oh, the Places You'll Go! (Dr. Seuss)", [
        "Hand-verified in owner scope with caution notes.",
        "Human-worship framing, alcohol, and racism beats in owner scope—parent preview.",
        "Book Quest includes when otherwise clean—exclude alcohol/drug-related content in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bmagisterium\b|\biron trial\b|\bcopper gauntlet\b|\bbronze key\b|\bsilver mask\b|\bgolden boy\b/i,
      authorRe: /black|holly|clare|cassandra/i,
      detail: bookNote("Magisterium (Holly Black & Cassandra Clare)", [
        "Hand-verified largely clean but dark with okayed manipulation in owner scope.",
        "Parent discretion—preview darkness for younger readers.",
      ]),
    },
    {
      titleRe: /\bmrs\. smith'?s spy school|spy school for girls\b/i,
      authorRe: /mcmullen|beth/i,
      detail: bookNote("Mrs. Smith's Spy School for Girls", [
        "Hand-verified clean in owner scope.",
        "Some side-character parent-bashing—not the lead's parents throughout.",
      ]),
    },
    {
      titleRe: /\bnever after\b|\bthirteenth fairy\b/i,
      authorRe: /de la cruz|melissa/i,
      detail: bookNote("Never After (Melissa de la Cruz)", [
        "Books 1–2 read largely clean in owner scope with some dark-mentality beats.",
        "Rest of series not owner-vetted—preview later volumes.",
      ]),
    },
    {
      titleRe: /\boutlaws\b.*royal academy rebels/i,
      authorRe: /calonita|jen/i,
      detail: bookNote("Royal Academy Rebels — Outlaws (Jen Calonita)", [
        "Hand-verified clean in owner scope—owner may recheck the full series.",
      ]),
    },
    {
      titleRe: /\bsavvy\b|\bscumble\b|\bswitch\b/i,
      authorRe: /law|ingrid/i,
      requiresMagicOptIn: true,
      detail: bookNote("Savvy (Ingrid Law)", [
        "Hand-verified very clean for the series in owner scope.",
        "Owner Parents Week and Father’s Week pick—book 1 only; not Mother’s Week (mother shown non-negatively).",
        "Some romance—characters clearly in love; no dating plot in owner scope.",
        "Family savvy (magical gifts on a milestone birthday)—fantasy magic.",
        "Book Quest includes when otherwise clean—exclude magic in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bsnow and rose\b|\bsnow & rose\b/i,
      authorRe: /winfield\s*martin|emily\s*winfield/i,
      requiresMagicOptIn: true,
      detail: bookNote("Snow and Rose (Emily Winfield Martin)", [
        "Hand-verified clean in owner scope—great family read; sisters, mother, and a father who vanishes into the woods.",
        "Owner Mother’s Week and Father’s Week pick.",
        "Some scary beats—a huntsman who enjoys killing forest animals, not only for food; preview for sensitive readers.",
        "Fairy-tale fantasy (enchanted woods, spells)—Book Quest includes when otherwise clean; exclude magic in Advanced recommendations settings on the play page if needed.",
        "Best for Older kids—not a learn-to-read picture book.",
      ]),
    },
    {
      titleRe: /\bsquire & knight|squire and knight\b/i,
      authorRe: /chantler|scott/i,
      detail: bookNote("Squire & Knight (Scott Chantler, graphic novels)", [
        "Hand-verified clean so far in owner scope.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\bshrunken head\b|\bcuriosity house\b/i,
      authorRe: /oliver|lauren/i,
      detail: bookNote("The Curiosity House (Lauren Oliver)", [
        "Hand-verified clean in owner scope.",
        "Brief dark-mindset beat (reads as a villain's lie) in book 1.",
        "Rest of series not owner-vetted—preview later volumes.",
      ]),
    },
    {
      titleRe: /\blast bear\b/i,
      authorRe: /gold|hannah/i,
      detail: bookNote("The Last Bear (Hannah Gold)", [
        "Hand-verified clean in owner scope—pro-nature climate and Arctic wildlife care.",
        "The Lost Whale, Finding Bear, and any later Hannah Gold titles not owner-vetted here—preview separately.",
      ]),
    },
    {
      titleRe: /\bwolf called wander\b|\bwhale of the wild\b|\ba whale of the wild\b/i,
      authorRe: /parry|rosanne/i,
      detail: bookNote("Voice of the Wilderness (Rosanne Parry — A Wolf Called Wander, A Whale of the Wild)", [
        "Hand-verified clean in owner scope for both books—wolf migration and orca/ocean wildness; respect for wild country.",
        "Pro-nature animal POV survival stories; preview intensity for sensitive readers.",
      ]),
    },
    {
      titleRe: /\btwistrose key\b/i,
      authorRe: /almhjell|tone/i,
      detail: bookNote("The Twistrose Key (Tone Almhjell)", [
        "Book 1 clean—book 2 got scary; may suit older children.",
        "Book 2 not fully owner-vetted—preview before sharing the series.",
      ]),
    },
    {
      titleRe: /\bhero'?s guide\b|\bthe hero'?s guide\b|\bleague of princes\b/i,
      authorRe: /healy|christopher/i,
      negativeFamilyPortrayal: true,
      requiresLightRomanceOptIn: true,
      requiresSubstanceOptIn: true,
      detail: bookNote("The Hero's Guide / League of Princes (Christopher Healy)", [
        "Hand-verified clean in owner scope.",
        "Romance hints; little kissing until late book three.",
        "Bar scene with drinking/barfight—brief alcohol beat.",
        "Notable family-bashing tone—advisory, not a hard ban.",
        "Book Quest includes when otherwise clean—exclude light romance, alcohol/drug-related content, and/or negative family portrayal in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe:
        /\bamulet\b|\bstonekeeper\b|\bstonekeeper'?s curse\b|\bcloud searchers\b|\blast council\b|\bprince of the elves\b|\bsword of ages\b|\bescape from lucien\b|\bfirelight\b|\bsupernova\b/i,
      authorRe: /kibuishi|kazu/i,
      detail: bookNote("Amulet (Kazu Kibuishi, graphic novels)", [
        "Hand-verified overall clean; brief mental-health representation in some volumes.",
        "Father read as possessed/corpse—strained parent beats, not sustained villain-parent framing.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\bgreen eggs and ham\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      requiresSubstanceOptIn: true,
      detail: bookNote("Green Eggs and Ham (Dr. Seuss)", [
        "Hand-verified in owner scope with caution notes.",
        "Human-worship framing, alcohol, and racism beats in owner scope—parent preview.",
        "Book Quest includes when otherwise clean—exclude alcohol/drug-related content in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe:
        /\bjedi academy\b|\bstar wars:\s*jedi academy\b|\breturn of the padawan\b|\bphantom bully\b|\bnew class\b|\bforce oversleeps\b|\bprincipal strikes back\b|\battack of the furball\b|\bat last,?\s*jedi\b|\battack of the journal\b/i,
      authorRe: /brown|jeffrey|krosoczka|jarrett|ignatow|amy/i,
      detail: bookNote("Star Wars: Jedi Academy (graphic novels)", [
        "Hand-verified mostly clean in owner scope.",
        "Sequel beats: parent-bashing and a younger boy's crush on a girl normalized in ways that felt odd—preview later volumes.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\bkindred dragons\b/i,
      authorRe: /mensinga|sarah/i,
      detail: bookNote("Kindred Dragons (Sarah Mensinga, graphic novels)", [
        "Book 1 hand-verified clean in owner scope—Book Quest includes book 1 when otherwise clean; rest of series not owner-vetted yet.",
        "Book 1 includes a line like “ANOTHER secret baby?”—may nod at secret or out-of-wedlock children; owner reads it as minor, not a main plot beat (preview if that topic bothers you).",
        "No fanservice in owner scope—still preview panel art.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\btidesong\b|\btide song\b/i,
      authorRe: /wendy\s*xu|\bxu,?\s*wendy/i,
      requiresMagicOptIn: true,
      detail: bookNote("Tidesong (Wendy Xu, graphic novel)", [
        "Standalone graphic novel—hand-verified clean in owner scope.",
        "No fanservice in owner scope—still preview panel art.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
        "Fantasy magic—Book Quest includes when otherwise clean; exclude magic in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe:
        /\bwild rescuers\b|\bguardians of the taiga\b|\bescape to the mesa\b|\bexpedition on the tundra\b|\bsentinels in the deep ocean\b/i,
      authorRe: /stacyplays|stacy/i,
      requiresMagicOptIn: true,
      detail: bookNote("Wild Rescuers (StacyPlays)", [
        "Hand-verified clean across the series in owner scope—wildlife rescue in wild places.",
        "Pro-nature stewardship tone; some fantasy-magic beats—comfort note for families who skip magic.",
        "Book Quest includes when otherwise clean—exclude magic in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bgrace of wild things\b/i,
      authorRe: /fawcett|heather/i,
      requiresMagicOptIn: true,
      detail: bookNote("The Grace of Wild Things (Heather Fawcett)", [
        "Hand-verified clean in owner scope—caring for wild creatures with a pro-nature heart.",
        "Fantasy magic—Book Quest includes when otherwise clean; exclude magic in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bthis changes everything\b/i,
      authorRe: /klein|naomi/i,
      detail: bookNote("This Changes Everything (Naomi Klein)", [
        "Hand-verified clean in owner scope—climate justice nonfiction; systemic stewardship argument.",
        "Teens/Adults interest—dense nonfiction, not a young-child pick.",
      ]),
    },
    {
      titleRe: /\bspark\b/i,
      authorRe: /durst|sarah\s*beth/i,
      requiresMagicOptIn: true,
      detail: bookNote("Spark (Sarah Beth Durst)", [
        "Hand-verified clean in owner scope—volcanic island, geothermal disaster, living with the land.",
        "Pro-nature stewardship blended with fantasy magic (lightning/dragon)—not Chris Baron’s different novel titled Spark.",
        "Book Quest includes when otherwise clean—exclude magic in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bspark\b/i,
      authorRe: /baron|chris/i,
      negativeFamilyPortrayal: true,
      detail: bookNote("Spark (Chris Baron)", [
        "Hand-verified clean in owner scope—verse novel; owner Earth Week pick (floor of Earth Week list).",
        "Some parent negativity—comfort note, not a ban.",
        "Book Quest includes when otherwise clean—exclude negative family portrayal in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe: /\bmanatee summer\b/i,
      authorRe: /griffith|evan/i,
      negativeFamilyPortrayal: true,
      detail: bookNote("Manatee Summer (Evan Griffith)", [
        "Hand-verified clean in owner scope—summer manatee rescue and Florida wild-water care.",
        "Owner family-week on hold—negative family portrayal; not abuse; may assign to a week later.",
        "Parent negativity around a divorced absent father—not only imperfect-family friction.",
        "Book Quest includes when otherwise clean—exclude negative family portrayal in Advanced recommendations settings on the play page if needed.",
      ]),
    },
    {
      titleRe:
        /\bwing & claw\b|\bwing and claw\b|\bforest of wonders\b|\bcavern of secrets\b|\bbeast of stone\b/i,
      authorRe: /park|linda sue/i,
      requiresMagicOptIn: true,
      detail: bookNote("Wing & Claw (Linda Sue Park, trilogy)", [
        "Hand-verified clean across the series in owner scope—botanical/animal fantasy with herbal magic.",
        "Book Quest includes when otherwise clean—exclude magic in Advanced recommendations settings on the play page if needed.",
        "Owner unsure whether the line belongs on an Earth Week stewardship list—fine for general shelf and Book Quest.",
      ]),
    },

  ];

  var FANSERVICE_NO_RECOMMEND_CLOSING =
    "Halalit will not recommend series known to include fanservice.";

  var USER_DISCRETION_PARENT_WARNING_CLOSING =
    "Parent discretion—see as we go, not a hardest auto-reject. Preview panels and outfits arc by arc; you decide for your home.";

  var USER_DISCRETION_PREVIEW_CLOSING =
    "Parent discretion—not a hardest auto-reject. Halalit won't suggest it in Book Quest—preview and decide for your home.";

  var POKEMON_GOLD_SILVER_CRYSTAL_TITLE_RE =
    /\bpokemon\b.*\b(gold|silver)\b|\b(gold and silver|gold & silver|goldsilver)\b.*\bpokemon\b|\bpokemon adventures\b.*\bcrystal\b|\bcrystal\b.*\b(pokemon adventures|pocket monsters)\b/i;

  var POKEMON_XY_TITLE_RE =
    /\bpokemon\b.*\b(x and y|x & y|x\/y)\b|\b(x and y|x & y|x\/y)\b.*\bpokemon\b|\bpokemon adventures\b.*\b(x and y|x & y|x\/y)\b|\bpocket monsters special\b.*\b(x and y|x & y|x\/y)\b/i;

  var TRANSFORMERS_ENERGON_UNIVERSE_RE =
    /\btransformers[\s:—-]*energon\b|\benergon universe\b|\btransformers\b.*\b(skybound|energon)\b|\bskybound\b.*\btransformers\b/i;

  /**
   * Hand-vetted titles parked on parent discretion—not hardest auto-reject (e.g. Pokemon manga while owner decides).
   * @type {Array<{titleRe: RegExp, authorRe?: RegExp, detail: string, requiresMentalHealthComfortOptIn?: boolean, requiresCulturalMisrepresentationOptIn?: boolean}>}
   */
  var USER_DISCRETION_PARKED = [
    {
      titleRe: /\bblack beauty\b/i,
      authorRe: /sewell|anna/i,
      requiresCulturalMisrepresentationOptIn: true,
      detail: bookNote("Black Beauty (Anna Sewell)", [
        "Parked on Halalit's parent-discretion list—not a hardest auto-reject.",
        "Plot reads clean in owner scope—horse autobiography with sad, realistic beats about horse abuse and cruelty; best for Older kids, not young children.",
        "Uses the outdated word \"gypsies\" (Roma stereotyping)—flag for readers.",
        "Ridicules the Muslim name Abdullah—cultural misrepresentation flag; preview if that matters for your family.",
        "Not on Book Quest; Halalit won't auto-recommend.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: POKEMON_GOLD_SILVER_CRYSTAL_TITLE_RE,
      detail: bookNote("Pokemon Adventures — Gold & Silver arc (Crystal main character)", [
        "Parked on Halalit’s parent-discretion list—not the hardest fanservice auto-reject.",
        "Clothes become more revealing in this arc than Red & Blue–Lance—Crystal’s outfits are often very short and tight; preview every volume.",
        "Heavier modesty concern than the early arcs; owner hasn’t compared every volume here to Satoko and Nada—still preview.",
      ], USER_DISCRETION_PARENT_WARNING_CLOSING),
    },
    {
      titleRe: POKEMON_XY_TITLE_RE,
      detail: bookNote("Pokemon Adventures — X & Y storyline", [
        "Parked on Halalit’s parent-discretion list—not the hardest fanservice auto-reject.",
        "Clothes become more revealing again in the X & Y storyline—preview human characters and outfits volume by volume.",
        "Owner still weighing how X & Y compares to Satoko and Nada and to the early Red & Blue–Lance arc—plot not fully re-checked in this note.",
      ], USER_DISCRETION_PARENT_WARNING_CLOSING),
    },
    {
      titleRe: /ポケットモンスター|ポケモン/i,
      authorRe: /kusaka|hidenori|日下|mato/i,
      detail: bookNote("Pokemon Adventures manga (Halalit scope: Red & Blue through Lance antagonist arc)", [
        "Japanese catalog title (Pocket Monsters Special)—same parent-discretion series as Pokemon Adventures in English.",
        "Plot largely clean in this scope—crush mentions; no main-character dating or kissing through the Lance arc.",
        "Modesty (checked arc): worst recurring outfits are short pants and short shirts; boy swimming scenes may be the other preview beat—lighter than Satoko and Nada in owner scope (e.g. no bikini beat in book 1 of that series).",
        "Later in the series, clothes become more revealing in the Gold & Silver arc and again in the X & Y storyline—use those hand notes when the title matches; owner still weighing later arcs vs Satoko and Nada.",
        "Comic violence (some blood); Halalit won’t auto-recommend—parent preview, then you decide.",
      ], USER_DISCRETION_PARENT_WARNING_CLOSING),
    },
    {
      titleRe: /\bpokemon\b.*\bmanga\b|\bpokemon adventures\b|\bpocket monsters special\b/i,
      detail: bookNote("Pokemon Adventures manga (Halalit scope: Red & Blue through Lance antagonist arc)", [
        "Parked on Halalit’s parent-discretion list—preview panels and outfits; you decide for your home.",
        "Plot largely clean in this scope—crush mentions; no main-character dating or kissing through the Lance arc.",
        "Modesty (checked arc): worst recurring outfits are short pants and short shirts; boy swimming scenes may be the other preview beat—lighter than Satoko and Nada in owner scope (e.g. no bikini beat in book 1 of that series).",
        "Later in the series, clothes become more revealing in the Gold & Silver arc and again in the X & Y storyline—use those hand notes when the title matches; owner still weighing later arcs vs Satoko and Nada.",
        "Comic violence (some blood); Halalit won’t auto-recommend.",
      ], USER_DISCRETION_PARENT_WARNING_CLOSING),
    },
    {
      titleRe: TRANSFORMERS_ENERGON_UNIVERSE_RE,
      requiresMentalHealthComfortOptIn: true,
      detail: bookNote("Transformers — Energon Universe (Skybound, current series)", [
        "Parked on Halalit’s parent-discretion list—see as we go, not hardest fanservice auto-reject.",
        "Skybound Energon Universe line only—other Transformers publishers or eras aren’t covered here.",
        "Robot leads mean less panel fanservice than human-led manga; humans still appear—main human girl wears short pants and a short shirt in checked volumes; preview panels.",
        "Modesty in checked volumes reads lighter than Satoko and Nada (e.g. no bikini beat in book 1 of that series)—still preview humans when they appear.",
        "Book 4: mental-health weight—comfort note for Older Child / Young Teen and Older Teen / Adult readers.",
        "Halalit won’t auto-recommend—preview volume by volume, then you decide.",
      ], USER_DISCRETION_PARENT_WARNING_CLOSING),
    },
    {
      titleRe: /\bsatoko and nada\b|\bsatoko to nada\b|\bsatoko & nada\b/i,
      authorRe: /yupechika/i,
      requiresCulturalMisrepresentationOptIn: true,
      detail: bookNote("Satoko and Nada (Yupechika, manga)", [
        "Parked on Halalit’s parent-discretion list—see as we go, not hardest rom-com manga fanservice auto-reject.",
        "Plot reads largely clean in owner scope—slice-of-life friendship between a Japanese college student and a Saudi roommate.",
        "Heavier fanservice in owner scope than early Pokemon Adventures (Red & Blue–Lance) and Energon Universe in checked volumes—e.g. bikini in book 1; preview human characters and outfits when it shows up.",
        "Later Pokemon arcs (Gold & Silver, X & Y) may spike more; owner still weighing those against this series volume by volume.",
        "Cross-cultural and faith portrayals get a separate cultural-misrepresentation note—preview before sharing.",
        "Halalit won’t auto-recommend—volume by volume, then you decide.",
      ], USER_DISCRETION_PARENT_WARNING_CLOSING),
    },
    {
      titleRe: /\bbabymouse\b.*\bbeach babe\b|\bbeach babe\b.*\babymouse\b/i,
      authorRe: /holm|jennifer/i,
      detail: bookNote("Babymouse: Beach Babe (Jennifer L. Holm)", [
        "Parked parent discretion—beach/bikini immodesty flag; not a series-wide Babymouse ban.",
        "Not on Book Quest; most other Babymouse volumes are hand-verified for Book Quest when otherwise clean.",
      ], USER_DISCRETION_PARENT_WARNING_CLOSING),
    },
    {
      titleRe:
        /\bbaby[- ]?sitters? club\b|\bbsc\b.*\b(graphic|novel)\b|\bboy[- ]?crazy stacey\b|\bthe truth about stacey\b|\bjessi'?s secret language\b|\bkristy'?s great idea\b|\bkristy'?s big day\b|\bclaudia and mean janine\b|\bdawn and the impossible three\b/i,
      detail: bookNote("The Baby-Sitters Club (Ann M. Martin)", [
        "Parked parent discretion—not fanservice-level for most volumes; not on Book Quest.",
        "Beach scenes in some volumes or graphic editions may show bikinis—preview those; otherwise dating/kissing and light wine or smoking notes apply.",
        "Often harsh family attitude in some volumes—e.g. Jessi’s Secret Language: parents won’t learn sign for their deaf child.",
        "Halalit won’t auto-recommend—preview volume by volume, then you decide.",
      ], USER_DISCRETION_PARENT_WARNING_CLOSING),
    },
    {
      titleRe:
        /\baspca\b.*\b(guide to cats|complete guide to cats)\b|\b(guide to cats|complete guide to cats)\b.*\baspca\b|\baspca complete guide to cats\b/i,
      authorRe: /aspca|american society|prevention of cruelty|o'?neil|oneil|jacqueline/i,
      requiresCulturalMisrepresentationOptIn: true,
      detail: bookNote("ASPCA Complete Guide to Cats", [
        "Parked parent discretion—not a hardest auto-reject.",
        "Owner scope: at least one brief beat of cultural misrepresentation—preview before you share.",
        "Pet-care nonfiction; not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PARENT_WARNING_CLOSING),
    },
    {
      titleRe: /\bfireborn\b/i,
      authorRe: /forward|toby/i,
      detail: bookNote("Fireborn (Toby Forward)", [
        "Parked on Halalit’s parent-discretion list—not a hardest auto-reject.",
        "Not treated as affirming LGBTQ or LGBTQ advocacy.",
        "Plot beat: the main antagonist (a male wizard) becomes a woman through a disastrous attempt to steal one of the protagonist’s magic—forced/magic gender-change, not an identity arc.",
        "No “I feel like a woman / free from being a man” storyline; that character stays irredeemably evil.",
        "Soft note for LGBTQ-avoiders: not explicitly LGBTQ, but a forced/magic gender-change beat may still feel uncomfortable—preview and decide for your home.",
        "Not on Book Quest; Halalit won’t auto-recommend.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bfantastic mr\.?\s*fox\b|\bfantastic mister fox\b/i,
      authorRe: /dahl|roald/i,
      detail: bookNote("Fantastic Mr Fox (Roald Dahl)", [
        "Parked on Halalit’s parent-discretion list—not a hardest auto-reject.",
        "Serious positivity toward alcohol—nuance note for parents.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bdanny, the champion of the world\b|\bdanny the champion of the world\b|\bchampion of the world\b/i,
      authorRe: /dahl|roald/i,
      detail: bookNote("Danny, the Champion of the World (Roald Dahl)", [
        "Parked on Halalit’s parent-discretion list—not a hardest auto-reject.",
        "Thievery is glorified to a certain extent when it isn’t required for survival—parent discretion.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\ba little princess\b|\blittle princess\b/i,
      authorRe: /burnett/i,
      detail: bookNote("A Little Princess (Frances Hodgson Burnett)", [
        "Parked on Halalit’s parent-discretion list—not a hardest auto-reject.",
        "Pro-colonial narrative—imperial or colonial framing treated as natural or good.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bthe secret garden\b|\bsecret garden\b/i,
      authorRe: /burnett/i,
      detail: bookNote("The Secret Garden (Frances Hodgson Burnett)", [
        "Parked on Halalit’s parent-discretion list—not a hardest auto-reject.",
        "Pro-colonial narrative—imperial or colonial framing treated as natural or good.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
  ];

  /**
   * Owner plot-vet with known fanservice — not on VERIFIED_CLEAN; blocks recommendations and Book Quest.
   * @type {Array<{titleRe: RegExp, authorRe?: RegExp, detail: string}>}
   */
  var NO_RECOMMEND_KNOWN_FANSERVICE = [
    {
      titleRe: /\bkaguya-?sama\b|\blove is war\b|\bkaguyasama\b|\bかぐや様\b/i,
      detail: bookNote("Kaguya-sama: Love Is War (manga)", [
        "Hardest auto-reject—outright fanservice and sexualized presentation in panels.",
        "Not a parent-discretion ‘see as we go’ title—off Halalit’s family shelf and Book Quest.",
      ], FANSERVICE_NO_RECOMMEND_CLOSING),
    },
    {
      titleRe: /\bsorceline\b/i,
      authorRe: /douy[eé]|antista/i,
      detail: bookNote("Sorceline (Sylvia Douyé / Paola Antista)", [
        "Plot hand-checked largely clean in scope reviewed.",
        "Graphic novel series with stronger visual fanservice in panels than Pokemon manga—preview every volume.",
        "Family-bashing tone toward the mother—not only imperfect-family friction.",
      ], FANSERVICE_NO_RECOMMEND_CLOSING),
    },
    {
      titleRe:
        /\bbeet the vandel buster\b|\bbouken ou beet\b|\bboken ou beet\b|\bboukenoh beet\b|\badventure king beet\b|\bvandel buster excellion\b/i,
      authorRe: /sanjo|riku|inada|koji/i,
      detail: bookNote("Beet the Vandel Buster (Riku Sanjo / Koji Inada, manga)", [
        "Firm never—Halalit won’t recommend this series on the family shelf or in Book Quest.",
        "Hardest no: fanservice in panels (primary reason)—same heavy known-fanservice list as Sorceline and outright rom-com manga fanservice.",
        "Without the fanservice, owner scope might be reader discretion; fanservice plus creepy sexist moments together are a firm never.",
        "Heavier content in owner scope—not a light middle-grade read.",
        "Little girl worshipping her mother—preview that beat for your family.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], FANSERVICE_NO_RECOMMEND_CLOSING),
    },
  ];

  var FANSERVICE_CAUTION_CLOSING =
    "Lighter fanservice caution than Sorceline or outright rom-com manga fanservice—not the heavy auto-reject list. Preview human characters and outfits.";

  /**
   * Hand-vetted comics with some fanservice risk but not the heavy no-recommend list (e.g. robot-led lines).
   * @type {Array<{titleRe: RegExp, authorRe?: RegExp, detail: string}>}
   */
  var FANSERVICE_CAUTION_GRAPHIC = [];

  /**
   * @type {Array<{titleRe: RegExp, authorRe?: RegExp, tier: string, detail: string}>}
   */
  var PHOEBE_AND_HER_UNICORN_SERIES_TITLE_RE =
    /\bphoebe\b.*\bunicorn\b|\bheavenly nostrils\b|\bmarigold heavenly nostrils\b|\bunicorn on a roll\b|\bunicorn vs\.?\s*goblins\b|\brazzle dazzle unicorn\b|\bunicorn crossing\b|\bunicorn\b.*\bmagic storm\b|\bmagic storm\b.*\bunicorn\b|\bunicorn of many hats\b|\bunicorn theater\b|\bunicorn bowling\b|\bthe unicorn whisperer\b|\bcamping with unicorns\b|\bvirtual unicorn experience\b|\bunicorn famous\b|\bunicorn playlist\b|\bunicorn selfies\b|\bunicornado\b|\bpunk rock unicorn\b|\bunicorn for a day\b|\bunicorn crush\b|\bunicorn time machine\b|\bunicorn book club\b|\bgalactic unicorn\b|\bunicorn secrets\b/i;

  var ENOLA_HOLMES_NOVEL_TITLE_RE =
    /\benola holmes and the case of\b|\benola holmes and the black barouche\b|\bthe case of the (?:missing marquess|left[- ]handed lady|bizarre bouquets|peculiar pink fan|cryptic crinoline|gypsy good|disappearing duchess)\b|\bthe case of the gypsy good[- ]?bye\b|\bthe boy in buttons\b|\bthe elegant escapade\b|\bthe mark of the mongoose\b/i;

  var ENOLA_HOLMES_GRAPHIC_TITLE_RE =
    /\benola holmes\b.*\bgraphic\b|\bgraphic\b.*\benola holmes\b|\benola holmes\b.*\bblasco\b|\bmycroft'?s dangerous game\b/i;

  var HUDA_F_GRAPHIC_TITLE_RE =
    /\bhuda f\s+are you\b|\bhuda f\s+cares\b|\bhuda f\s+wants to know\b|\bhuda f\s+would love you\b|\bhuda f\b/i;

  var HUDA_F_GRAPHIC_DETAIL = bookNote(
    "Huda F graphic novels (Huda Fahmy)",
    [
      "Hand-checked plot tone: largely clean; romance outside marriage is called out when it comes up.",
      "Every series title is a pun on a crude three-letter swear phrase—Halalit won't recommend that joke on the family shelf or in Book Quest.",
      "Middle-grade / YA graphic memoir—preview comics pacing if your family is cautious.",
    ],
    "Outside Halalit recommendations and Book Quest."
  );

  var ENOLA_HOLMES_NOVEL_DETAIL = bookNote(
    "Enola Holmes — Springer novels books 1–6 (not graphic editions)",
    [
      "Parent discretion for books 1–6—not a hardest auto-reject.",
      "Plot mostly clean mystery in owner scope.",
      "Romani called “Gypsy/Gypsies”; book six title/wording flagged.",
      "Strong family-bashing and period sexism; painful escape beat (not fistfight gore).",
      "Adult references off the main plots (Cryptic Crinoline prologue; mistaken illegitimacy rumor; book six procuress).",
      "Preview for younger tweens.",
      "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
    ],
    USER_DISCRETION_PREVIEW_CLOSING
  );

  /**
   * Owner-rejected pro-colonial titles — hardest never-recommend; lookup via Bookcheck title search.
   * @type {Array<{titleRe: RegExp, authorRe?: RegExp, displayTitle: string, displayAuthor: string, detail: string}>}
   */
  /**
   * Hardest never-recommend pro-colonial list — empty while Burnett titles sit on parent discretion
   * (see USER_DISCRETION_PARKED + PRO_COLONIAL_CAUTION_NOTES). Keep array for API callers.
   */
  var PRO_COLONIAL_NO_RECOMMEND = [];

  var WARNINGS = [
    {
      titleRe: /\bthe chosen\b|\bcontender\b/i,
      authorRe: /matharu|taran\s*matharu/i,
      tier: "flag_review",
      detail: bookNote("The Chosen / Contender (Taran Matharu)", [
        "Harsh crude profanity in dialogue—not Halalit's all-ages shelf.",
        "Brief mild immodesty beat (skinny-dip scene reported).",
        "YA gladiatorial sci-fi with intense arena violence.",
        "No on-page LGBTQ; age-appropriate crush subplot only.",
      ]),
    },
    {
      titleRe: /\bmornings in jenin\b/i,
      authorRe: /abulhawa|susan/i,
      tier: "flag_review",
      detail: bookNote("Mornings in Jenin (Susan Abulhawa)", [
        "Outside Halalit’s family shelf—owner rejected for sexual content.",
        "Owner also flags cultural misrepresentation in this line.",
        "No Book Quest or auto-recommend.",
      ]),
    },
    {
      titleRe: CHRISTIE_POIROT_TITLE_RE,
      authorRe: /christie|agatha\s*christie/i,
      tier: "flag_review",
      detail: bookNote("Hercule Poirot mysteries (Agatha Christie)", [
        "Owner parked this line for now—not verified clean; no Book Quest or auto-recommend until the owner clears parked.",
        "Heavier mystery content—if cleared later, Older Teen / Adult readers only; not for younger bands.",
        "Owner may reject the line if adult romance shows up on re-read—preview before you share.",
        "Miss Marple and other Christie titles are not covered by this entry—look up each separately.",
      ]),
    },
    {
      titleRe: /\bharry potter\b/i,
      authorRe: /rowling|j\.?\s*k\.?\s*rowling/i,
      tier: "flag_review",
      detail: bookNote("Harry Potter (J.K. Rowling)", [
        "Owner parked the series for now—recommendation copy and shelf notes are being edited.",
        "Was hand-verified clean; no Book Quest or auto-recommend until the owner clears parked.",
        "When re-enabled, expect magic and light alcohol (feast wine, butterbeer) comfort notes.",
      ]),
    },
    {
      titleRe: /\bencyclopedia brown\b/i,
      authorRe: /sobol|donald/i,
      tier: "flag_review",
      detail: bookNote("Encyclopedia Brown (Donald J. Sobol)", [
        "Owner parked—was briefly hand-verified clean; back on the parked list until re-checked.",
        "Some minority characters lean on older, culturally insensitive stereotypes (e.g. “Pablo the phony artist,” “Tyrone with multiple girlfriends”)—preview before sharing.",
        "No Book Quest or auto-recommend until the owner clears parked.",
      ]),
    },
    {
      titleRe: ENOLA_HOLMES_GRAPHIC_TITLE_RE,
      tier: "user_discretion",
      detail: bookNote(
        "Enola Holmes — graphic novel editions",
        [
          "Parent discretion—not a hardest auto-reject.",
          "Crossdressing treated as an active, supported solution—not the Springer prose novels.",
          "Graphic adaptations lean toward LGBTQ/crossdressing sympathy in certain books without explicit LGBTQ promotion on the page.",
          "See the prose Enola entry for notes on novels 1–6.",
          "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
        ],
        USER_DISCRETION_PREVIEW_CLOSING
      ),
    },
    {
      titleRe: ENOLA_HOLMES_NOVEL_TITLE_RE,
      authorRe: /springer|nancy\s*springer/i,
      tier: "user_discretion",
      detail: ENOLA_HOLMES_NOVEL_DETAIL,
    },
    {
      titleRe: /\benola holmes\b/i,
      authorRe: /springer|nancy\s*springer/i,
      tier: "user_discretion",
      detail: ENOLA_HOLMES_NOVEL_DETAIL,
    },
    {
      titleRe: PHOEBE_AND_HER_UNICORN_SERIES_TITLE_RE,
      authorRe: /simpson|dana\s*simpson/i,
      tier: "flag_review",
      detail: bookNote(
        "Phoebe and Her Unicorn (Dana Simpson, graphic novels)",
        [
          "Early books milder; later volumes leave Halalit’s all-ages shelf.",
          "LGBTQ representation builds (two-mom family, they/them unicorn crush on Phoebe, and related threads).",
          "Narcissism humor escalates (including a unicorn marrying herself).",
          "Little sexual content, but tone and representation build over the series.",
        ],
        "Outside Halalit recommendations and Book Quest."
      ),
    },
    {
      titleRe: /\bmy aunt is a monster\b/i,
      authorRe: /yee|reimena\s*yee/i,
      tier: "flag_review",
      detail: bookNote(
        "My Aunt Is a Monster (Reimena Yee, graphic novel)",
        [
          "Hand-checked—supporting-cast LGBTQ: Professor Doctor Cecilia Choi (Pineapple Tart) is non-binary (author-confirmed).",
          "Not plot-centered LGBTQ advocacy—the adventure stands alone—but the rep is on the page.",
          "Middle-grade graphic novel; blind heroine Safia is capable—preview Aunt Whimsy’s early deception about Safia’s curse.",
          GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
        ],
        "Outside Halalit recommendations and Book Quest."
      ),
    },
    {
      titleRe: /\btwins\b/i,
      authorRe: /varian\s*johnson|johnson\s*&\s*shannon|shannon\s*wright/i,
      tier: "flag_review",
      agentFlag: true,
      detail: bookNote("Twins (Varian Johnson & Shannon Wright, graphic novel)", [
        "Middle-school twin-sister story—sister rivalry, crushes, and friendship tension (not adult romance).",
        "Explicit in-story LGBTQ beat: stepbrother Curtis tells Maureen it would not matter if she were attracted to her female friend Amber—don’t assume straight.",
        "Catalog/AI scans often miss that line while only flagging mild romance.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Outside Halalit recommendations and Book Quest."),
    },
    {
      titleRe:
        /\bwereworld\b|war of the werelords|rise of the wolf|rage of lions|shadow of the hawk|nest of serpents|storm of sharks/i,
      authorRe: /jobling/i,
      tier: "flag_review",
      detail: bookNote("Wereworld", [
        "Firm no—Halalit won’t recommend the series.",
        "Adult romance at different points in the line.",
        "Nudity at different points in owner scope.",
        "Teen/YA fantasy—ongoing romantic tension, crushes, and betrothal even when war is the plot.",
        "Fantasy violence; catalogs often omit relationship themes.",
      ]),
    },
    {
      titleRe:
        /\bwings of fire\b|\bdragonet prophecy\b|\blost heir\b|\bhidden kingdom\b|\bdark secret\b|\bbrightest night\b|\bmoon rising\b|\bwinter turning\b|\bescaping peril\b|\btalons of power\b|\bdarkness of dragons\b|\bpoison jungle\b|\bhive queen\b/i,
      authorRe: /sutherland|tui/i,
      tier: "flag_review",
      detail: bookNote("Wings of Fire (Tui T. Sutherland)", [
        "Early arcs read cleaner; sustained family-bashing tone builds.",
        "Later books add major LGBTQ storylines (from about book 10 onward in owner scope).",
        "Halalit won’t recommend the series.",
      ]),
    },
    {
      titleRe: /\bskandar\b|\bunicorn thief\b/i,
      authorRe: /steadman|a\.?\s*f\.?/i,
      tier: "flag_review",
      detail: bookNote("Skandar and the Unicorn Thief (A. F. Steadman)", [
        "Not owner-hand-vetted—catalog/reports suggest LGBTQ content in a later volume.",
        "Halalit won’t recommend the series per shelf rules until owner reads it.",
      ]),
    },
    {
      titleRe:
        /\bkane chronicles\b|\bred pyramid\b|\bthrone of fire\b|\bserpent'?s shadow\b|\bson of sobek\b|\bcrown of ptolemy\b/i,
      authorRe: /riordan/i,
      tier: "flag_review",
      detail: bookNote("The Kane Chronicles (Rick Riordan)", [
        "Dating and romance threads; LGBTQ content in owner scope.",
        "Egyptian gods and magic treated as real—deity/mythology comfort note.",
        "Gods sometimes appear as both siblings and parent/child to the leads—preview if that bothers you.",
        "Halalit won’t recommend the series.",
      ]),
    },
    {
      titleRe: /\bfive nights at freddy\b|\bfazbear\b|\bfreddy fazbear\b/i,
      tier: "flag_review",
      detail: bookNote("Five Nights at Freddy’s books", [
        "Firm no for now—Halalit won’t recommend.",
        "Brief adult-content mentions in owner scope—enough to keep it off Halalit’s recommend list.",
        "Preview if kids pick it up from the game tie-in.",
      ]),
    },
    {
      titleRe: /\bunwanteds quests\b|\bdragon captives\b|\bdragon ghosts\b|\bdragon ruins\b/i,
      authorRe: /mcmann|lisa/i,
      tier: "flag_review",
      detail: bookNote("Unwanteds Quests (sequel series)", [
        "Follow-up to The Unwanteds; adds LGBTQ storylines in owner scope.",
        "Halalit won’t recommend this sequel line—the first Unwanteds series is noted separately.",
      ]),
    },
    {
      titleRe: /\brainbow magic\b/i,
      tier: "flag_review",
      detail: bookNote("Rainbow Magic", [
        "Plot reads clean in owner scope; one source checked had no LGBTQ lines—re-check your edition if that matters.",
        "Some books include Christian holiday content—comfort note for readers who skip religious holidays.",
        "Cover art can show short tutus or similar—not bikini level, but preview covers if modesty matters.",
      ], "Halalit won’t auto-recommend; not inappropriate—parents can decide."),
    },
    {
      titleRe: /\bdrama\b/i,
      authorRe: /telgemeier|raina/i,
      tier: "user_discretion",
      detail: bookNote("Drama (Raina Telgemeier)", [
        "Parent discretion—not a hardest auto-reject.",
        "Romance is the main plot driver—crushes and a love triangle; nothing explicit in owner scope.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bguts\b/i,
      authorRe: /telgemeier|raina/i,
      tier: "flag_review",
      detail: bookNote("Guts (Raina Telgemeier)", [
        "Plot reads clean in owner scope—centers on anxiety and stress.",
        "Halalit won’t recommend mental-health-centered titles until more reader feedback—parents can still choose it.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Won’t recommend from Halalit picks—not calling it inappropriate."),
    },
    {
      titleRe:
        /\bpercy jackson\b|olympians|the lightning thief|sea of monsters|titan'?s curse|battle of the labyrinth|last olympian/i,
      authorRe: /riordan|rick/i,
      tier: "user_discretion",
      detail: bookNote("Percy Jackson & the Olympians", [
        "Parent discretion—not a hardest auto-reject.",
        "Centers on demigod children of gods and mortals—children born outside marriage.",
        "Halalit flags stories centered on illegitimate children even with kids’ catalog tags—preview and decide for your home.",
        "Not on Book Quest; Halalit won’t auto-recommend.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe:
        /\bheroes of olympus\b|house of hades|the mark of athena|blood of olympus|the lost hero|son of neptune|trials of apollo/i,
      authorRe: /riordan/i,
      tier: "flag_review",
      detail: bookNote("Heroes of Olympus", [
        "Prominent LGBTQ character storylines.",
        "Continues the demigod / out-of-wedlock parent premise.",
      ]),
    },
    {
      titleRe: /\bestranged\b/i,
      authorRe: /aldridge/i,
      tier: "flag_review",
      detail: bookNote("Estranged (Ethan M. Aldridge)", [
        "Book 1: LGBTQ references as jokes; boyfriend/girlfriend pairing; alcohol references.",
        "Book 2: direct LGBTQ relationship.",
        "Strong family-bashing toward fae parents.",
      ]),
    },
    {
      titleRe: /\bpizza face\b/i,
      authorRe: /ogle|rex\s*ogle/i,
      tier: "flag_review",
      detail: bookNote("Pizza Face (Rex Ogle)", [
        "Firm no—Halalit won’t recommend this title or the Rex Ogle line when the same flags apply.",
        "Sexism and early dating tone normalized (some behavior criticized).",
        "Smoking/weed-like behavior not clearly called out.",
        "Strong family-bashing toward the mother and around the bully's father.",
        "Bullying and heavy body-image anxiety around zits.",
      ]),
    },
    {
      titleRe: /\bfour eyes\b|\bfree lunch\b|\bfree soccer\b|\bfree verse\b/i,
      authorRe: /ogle|rex\s*ogle/i,
      tier: "flag_review",
      detail: bookNote("Rex Ogle (Four Eyes / Free Lunch line and related)", [
        "Same owner reject lane as Pizza Face—Halalit won’t recommend.",
        "Sexism and early dating tone normalized (some behavior criticized).",
        "Smoking/weed-like behavior not clearly called out.",
        "Strong family-bashing; bullying and body-image anxiety threads in the line.",
        "Look up Pizza Face for the full hand note; this entry catches other Rex Ogle searches in the same lane.",
      ]),
    },
    {
      titleRe: /\bin real life\b/i,
      authorRe: /doctorow|wang/i,
      tier: "flag_review",
      detail: bookNote("In Real Life (Doctorow/Wang)", [
        "Immodesty fanservice on cover art.",
        "Normalizes attachment to virtual strangers.",
        "Theft treated as morally nuanced outside survival poverty.",
        "Labor-strike beat can read as blame toward the girl lead.",
      ]),
    },
    {
      titleRe: /\blibrary of unruly treasures\b/i,
      tier: "user_discretion",
      detail: bookNote("The Library of Unruly Treasures", [
        "Parent discretion—not a hardest auto-reject.",
        "Family negativity flags: sustained parent-neglect tone—not the uncle figure.",
        "Ending: parents comfortable giving up custody; relief at being cared for elsewhere.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bsquished\b/i,
      authorRe: /lloyd|wagner/i,
      tier: "flag_review",
      detail: bookNote("Squished (Megan Wagner Lloyd)", [
        "Owner reject—not verified clean; Halalit won’t recommend.",
        "Sibling stress and moving.",
        "Nursing-mother modesty beat is only one panel—easy to miss if you don’t read the whole book; still flagged.",
      ]),
    },
    {
      titleRe: /\bcoraline\b/i,
      authorRe: /gaiman/i,
      tier: "user_discretion",
      detail: bookNote("Coraline", [
        "Parent discretion leaning reject—not a hardest auto-reject.",
        "Serious immodesty scene—two female characters undressing (book and film).",
        "Not on Book Quest; Halalit won’t auto-recommend—read the flag and decide for your home.",
      ], "Parent discretion leaning reject—preview the immodesty beat; Halalit won’t Book Quest."),
    },
    {
      titleRe: /\bdiary of a wimpy kid\b|\bwimpy kid\b/i,
      authorRe: /kinney|jeff/i,
      tier: "user_discretion",
      detail: bookNote("Diary of a Wimpy Kid (Jeff Kinney)", [
        "Parent discretion—not fully hand-checked cover to cover; not a hardest auto-reject.",
        "Series gets grosser and weirder over time—flag for parents.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe:
        /\bhow to train your dragon\b|\bhow to be a pirate\b|\bhow to speak dragonese\b|\bhow to cheat a dragon\b|\bhow to twist a dragon\b|\ba hero'?s guide to deadly dragons\b|\bhow to ride a dragon\b|\bhow to break a dragon\b|\bhow to steal a dragon\b|\bhow to seize a dragon\b|\bhow to fight a dragon\b/i,
      authorRe: /cowell|cressida/i,
      tier: "user_discretion",
      detail: bookNote("How to Train Your Dragon (Cressida Cowell)", [
        "Parent discretion—not a hardest auto-reject.",
        "Major side character tied to illegitimate-child premise.",
        "Brief alcohol mentions.",
        "Serious crude humor—including a character known as Big Boobied Bertha.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\beragon\b|\beldest\b|\bbrisingr\b|\binheritance\b|\binheritance cycle\b/i,
      authorRe: /paolini|christopher/i,
      tier: "flag_review",
      detail: bookNote("Eragon / Inheritance Cycle (Christopher Paolini)", [
        "Firm no—Halalit won’t recommend this series or any volume.",
        "Book 1 (Eragon): male lead treats injuries on a less- or unclothed female character—preview that opening.",
        "Whole Inheritance Cycle stays off the family shelf and Book Quest.",
      ]),
    },
    {
      titleRe: /\ball four stars\b|\bstars of summer\b|\bstars so sweet\b/i,
      authorRe: /dairman|tara\s*dairman/i,
      tier: "flag_review",
      detail: bookNote("All Four Stars (Tara Dairman)", [
        "Mostly clean in owner scope.",
        "Books 2–3: middle-grade romance throughout—not LGBTQ romance; not family-unfriendly on romance alone.",
        "Book 3 (series finale): a girl is portrayed as LGBTQ toward the end.",
        "Halalit won't recommend the series.",
      ]),
    },
    {
      titleRe:
        /\bvenom of the serpent'?s crown\b|\bsoul of the deep\b|\bway of the owls\b/i,
      authorRe: /pau\s*preto|nicki\s*pau/i,
      tier: "flag_review",
      detail: bookNote("Wingbearer series (Nicki Pau Preto, books 2+)", [
        "Prose middle-grade series—not Marjorie M. Liu's graphic novel Wingbearer (hand-verified clean separately).",
        "Later volumes not owner-vetted here—preview before sharing.",
        "Halalit won't recommend these until vetted.",
      ]),
    },
    {
      titleRe:
        /\bwundersmith\b|\bthe calling of morrigan crow\b|\bhollowpox\b|\bthe hunt for morrigan crow\b|\bsilverborn\b|\bgingerbread\b.*\bmorrigan crow\b/i,
      authorRe: /townsend|jessica/i,
      tier: "flag_review",
      detail: bookNote("Nevermoor (Jessica Townsend, books 2+)", [
        "Book 1 (The Trials of Morrigan Crow) is hand-verified clean separately.",
        "Book 2 onward: LGBTQ representation begins and increases through the rest of the series.",
        "Israfel angel beat—misrepresentation of Muslim beliefs; see cultural-misrepresentation note.",
        "Halalit won't recommend these volumes or the series line for Book Quest.",
      ]),
    },
    {
      titleRe:
        /\bescape from mr\.?\s*lemoncello\b|\bmr\.?\s*lemoncello'?s library\b|\blemoncello'?s library olympics\b|\blemoncello'?s great library race\b|\blemoncello and the titanium ticket\b|\bsuper library showdown\b|\bfantastic library race\b/i,
      authorRe: /grabenstein|chris/i,
      tier: "flag_review",
      detail: bookNote("Mr. Lemoncello’s Library (Chris Grabenstein)", [
        "Book 1 reads cleaner in owner scope; later volumes in the series add LGBTQ storylines.",
        "Halalit won’t recommend the series.",
      ]),
    },
    {
      titleRe: /\bboy who harnessed the wind\b/i,
      authorRe: /kamkwamba|mealer|william|bryan/i,
      tier: "user_discretion",
      detail: bookNote("The Boy Who Harnessed the Wind — Young Readers Edition (William Kamkwamba and Bryan Mealer)", [
        "Parent discretion—not hand-vetted cover to cover by the owner; not a hardest auto-reject.",
        "True-story beat where the protagonist’s sister elopes with their teacher—flag for parents.",
        "Preview the full memoir or film if your family wants the invention story without that subplot.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe:
        /\bkeeper of the lost cities\b|\bkeepers of the lost cities\b|\beverblaze\b|\bneverseen\b|\blodestar\b|\bnightfall\b|\bstellarlune\b|\bunraveling\b|\bflashback\b/i,
      authorRe: /messenger|shannon/i,
      tier: "flag_review",
      detail: bookNote("Keeper of the Lost Cities (Shannon Messenger)", [
        "Book Quest will not suggest this series.",
        "Lots of cheesy middle-grade romance throughout; up through book 9 is otherwise clean in owner scope.",
        "Book 9.5 (Unlocking) adds LGBTQ storylines—Halalit won’t recommend the series.",
        "Owner is still re-checking books 1–9 cover to cover—preview any volume before you share.",
      ]),
    },
    {
      titleRe:
        /\bschool for good and evil\b|\ba school for good and evil\b|\bworld without princes\b|\blast ever after\b|\bever never handbook\b|\bquests for glory\b|\bcrystal of time\b|\bone true king\b|\brise of the school for good and evil\b|\bfall of the school for good and evil\b/i,
      authorRe: /chainani|soman\s*chainani/i,
      tier: "flag_review",
      detail: bookNote("The School for Good and Evil (Soman Chainani)", [
        "Firm no—Halalit won’t recommend this series or any volume in Book Quest.",
        "Adult-toned references appear in the line—not only book 1.",
        "Later book: a girl is turned into a boy and kisses a male character—LGBTQ beat in owner scope; Halalit’s hardest never-recommend line for that kind of plot.",
        "Fantasy magic is everywhere in the series—shows as a magic theme if you use exclude-magic settings, but magic is not why this is a firm no.",
        "Book 1 alone is enough to hold the whole series until owner says otherwise.",
      ]),
    },
    {
      titleRe:
        /\bland of stories\b|\bwishing spell\b|\benchantress returns\b|\bgrimm warning\b|\bworlds collide\b|\ban author'?s odyssey\b|\bbeyond the kingdoms\b/i,
      authorRe: /colfer|chris/i,
      tier: "user_discretion",
      detail: bookNote("The Land of Stories (Chris Colfer)", [
        "Parent discretion leaning reject—not a hardest auto-reject.",
        "Core plot reads largely clean in scope reviewed.",
        "Between-the-lines hint of illegitimate birth—not the main focus; Halalit can’t call this fully clean for shelf rules.",
        "Major side character with alcohol problems.",
        "Light dating and lighter romance.",
        "Not on Book Quest; read the flags and decide for your home.",
      ], "Parent discretion leaning reject—Halalit won’t Book Quest; preview the flags."),
    },
    {
      titleRe: /\barabian nights\b|\bthousand and one nights\b|\bone thousand and one nights\b|\b1001 nights\b|\bbook of the thousand nights\b/i,
      tier: "flag_review",
      detail: bookNote("Arabian Nights / One Thousand and One Nights", [
        "Firm no—Halalit won’t recommend this collection or suggest it in Book Quest.",
        "Mostly clean in owner scope, but the frame story opens with the king executing his wife for adultery / romantic relations outside marriage.",
      ]),
    },
    {
      titleRe: /\banimorphs\b/i,
      authorRe: /applegate|k\.?\s*a\.?\s*applegate|katherine/i,
      tier: "flag_review",
      detail: bookNote("Animorphs (K.A. Applegate)", [
        "Owner parked — re-checking whole series; might be ok after a full read.",
        "Book 3: male teenager stuck in bird morph feels attracted to a female real bird of the same species—preview that beat.",
        "Separate note: author comments suggest LGBTQ subtext—nothing reads that way on the page in owner scope.",
        "Dark war and mental-strain tone still worth previewing.",
        "Halalit won't Book Quest until owner clears.",
      ]),
    },
    {
      titleRe: /\bhunger games\b|\bcatching fire\b|\bmockingjay\b|\bballad of songbirds and snakes\b/i,
      authorRe: /collins|suzanne/i,
      tier: "flag_review",
      detail: bookNote("The Hunger Games (Suzanne Collins)", [
        "Serious adult-romance references and dark mental/war tone.",
        "Halalit won’t recommend the series.",
      ]),
    },
    {
      titleRe: /\bcaptain underpants\b|\badventures of captain underpants\b/i,
      authorRe: /pilkey|dav/i,
      tier: "user_discretion",
      detail: bookNote("Captain Underpants (Dav Pilkey)", [
        "Parent discretion—not fully hand-checked cover to cover; not a hardest auto-reject.",
        "Crude humor—flag for parents.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bjulie of the wolves\b/i,
      authorRe: /george|jean\s*craighead/i,
      tier: "flag_review",
      detail: bookNote("Julie of the Wolves (Jean Craighead George)", [
        "Owner still reviewing this title—if approved would be a strong Earth Week wild-nature pick.",
        "Brief weird beat tied to marriage—preview if that matters.",
        "Deity and mythology treated as real (Inuit spiritual world)—comfort note.",
        "Halalit won't recommend until owner finishes vet.",
      ]),
    },
    {
      titleRe: /\bmadeline\b|\bmadeline'?s rescue\b|\bmadeline and the bad hat\b|\bmadeline and the gypsies\b|\bmadeline in london\b/i,
      authorRe: /bemelmans|ludwig/i,
      tier: "user_discretion",
      detail: bookNote("Madeline (Ludwig Bemelmans)", [
        "Parent discretion—not a hardest auto-reject.",
        "Series includes negative, derogatory “Gypsy” portrayal of Romani people.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bhorton hatches the egg\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      tier: "user_discretion",
      detail: bookNote("Horton Hatches the Egg (Dr. Seuss)", [
        "Parent discretion—not a hardest auto-reject.",
        "Plot reads clean in owner scope overall.",
        "Flag: Horton sits on and hatches another bird’s egg—reads like taking someone else’s child.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe:
        /\ba series of unfortunate events\b|\bbad beginning\b|\breptile room\b|\bwide window\b|\bmiserable mill\b|\bvile village\b|\bersatz elevator\b|\bhostile hospital\b|\bcarnivorous carnival\b|\bslippery slope\b|\bgrim grotto\b|\bpenultimate peril\b|\bend\b/i,
      authorRe: /snicket|handler|lemony/i,
      tier: "flag_review",
      detail: bookNote("A Series of Unfortunate Events (Lemony Snicket)", [
        "Firm no for now—Halalit won’t recommend; Book Quest will never suggest this series.",
        "Adult-toned and inappropriate-for-young-children references appear alongside heavy death, tragedy, and scary tone.",
        "If you decide to read: keep that in mind—owner discretion, not a hand-vetted clean call on the site.",
      ]),
    },
    {
      titleRe: /\bthe last unicorn\b|\blast unicorn\b|\btwo hearts\b/i,
      authorRe: /beagle|peter\s*s\.?\s*beagle|peter\s*beagle/i,
      tier: "flag_review",
      detail: bookNote("The Last Unicorn (Peter S. Beagle)", [
        "Firm no for now—Halalit won’t recommend.",
        "Book Quest will never suggest this book or the rest of the Beagle unicorn line—book 1 is enough to hold the whole series.",
        "Reader discretion: keep in mind if you look it up—owner vet of book 1 only, not a hand-verified clean call on the site.",
        "Alcohol in the story.",
        "Possible immodest woman scene (not illustrated in typical editions—still preview).",
        "Family negativity in owner scope.",
        "Shmendrick accidentally turns a tree into a sentient woman-tree who falls in love with him—odd romantic/magic beat.",
        "Halalit won’t recommend this title.",
      ]),
    },
    {
      titleRe: /\bamina'?s voice\b|\bamina'?s song\b|\bamina'?s picture\b/i,
      authorRe: /khan|hena\s*khan/i,
      tier: "user_discretion",
      detail: bookNote("Amina's Voice / Amina's Song (Hena Khan)", [
        "Parent discretion—not a hardest auto-reject.",
        "Plot reads largely clean in owner scope—not verified clean for Halalit recommendations or Book Quest.",
        "Book 2 (Amina's Song): older brother's smoking addiction in owner scope—preview substance beats.",
        "Negative family portrayal—parents clash with other parents over families framed as too religiously strict (hostile/unfair community friction, not only everyday arguments).",
        "Partial culture misrepresentation in owner scope on that beat.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bsecret world of briar rose\b/i,
      authorRe: /pham|cindy\s*pham/i,
      tier: "flag_review",
      detail: bookNote("The Secret World of Briar Rose (Cindy Pham)", [
        "Firm no—Halalit won’t recommend this title or suggest it in Book Quest.",
        "Queer retelling of Sleeping Beauty—LGBTQ-centered plot in owner and publisher scope; outside Halalit’s family shelf.",
        "Young-adult / teen audience (14+) in catalog—not all-ages; preview only if you read outside Halalit’s rules.",
      ]),
    },
    {
      titleRe:
        /\bether witch\b|\bconfronting the crafty concubine\b|\bcrafty concubine\b|\bdivining of a devil\b/i,
      authorRe: /delemhach|emilie\s*nikota/i,
      tier: "flag_review",
      detail: bookNote("The Ether Witch (Delemhach, trilogy)", [
        "Firm no—Halalit won’t recommend this series or any volume in Book Quest.",
        "A concubine is one of the main villains in owner scope—outside Halalit’s family shelf.",
        "Fantasy magic throughout—Book Quest and family shelf stay off regardless of magic settings.",
        "Volumes include The Casting Call, Confronting the Crafty Concubine, and The Divining of a Devil—any match holds the line.",
      ]),
    },
    {
      titleRe: /\bcruel is the light\b/i,
      authorRe: /clark|sophie\s*clark/i,
      tier: "flag_review",
      detail: bookNote("Cruel is the Light (Sophie Clark)", [
        "Firm no—Halalit won’t recommend this title or suggest it in Book Quest.",
        "Adult romance as the main story plus heavier content in owner scope—outside Halalit’s family shelf.",
      ]),
    },
    {
      titleRe: /\bshadow magic\b|\bdream magic\b|\bburning magic\b/i,
      authorRe: /khan|joshua\s*khan|chadda|sarwat\s*chadda/i,
      tier: "flag_review",
      detail: bookNote("Shadow Magic (Joshua Khan / Sarwat Chadda, trilogy)", [
        "Joshua Khan is the only known pen name for Sarwat Chadda (Shadow Magic trilogy); his other books use Sarwat Chadda—look up either name for this flag.",
        "Firm no—Halalit won’t recommend this series or any volume in Book Quest.",
        "Fantasy shadow magic throughout the line—not a comfort opt-in title; it stays off the family shelf.",
        "A later book centers plot on a child born out of wedlock—Halalit’s hardest never-recommend line for story focus.",
        "The protagonist’s father is named from the Arabic word for Devil—owner vet: harmful misrepresentation of Arabic culture, not a neutral fantasy name.",
        "Trilogy: Shadow Magic, Dream Magic, Burning Magic—book 1 is enough to hold the whole series.",
      ]),
    },
    {
      titleRe: /\bthe jungle book\b|\bjungle book\b|\bmowgli\b/i,
      authorRe: /kipling|rudyard/i,
      tier: "flag_review",
      detail: bookNote("The Jungle Book (Rudyard Kipling)", [
        "Firm no—Halalit won’t recommend this book.",
        "Mowgli is described without clothing in the jungle—serious immodesty / nudity concern.",
      ]),
    },
    {
      titleRe: /\bthe marvelous land of oz\b|\bthe marvellous land of oz\b|\bmarvelous land of oz\b|\bmarvellous land of oz\b/i,
      authorRe: /baum|l\.?\s*frank/i,
      tier: "flag_review",
      detail: bookNote("The Marvelous Land of Oz (L. Frank Baum, Oz book 2)", [
        "Book Quest will not suggest this volume.",
        "Owner still re-checking this volume cover to cover—Halalit won’t auto-recommend it until cleared.",
        "A boy character is transformed back into a girl (Tip becomes Princess Ozma)—preview if gender-transformation beats matter for your family.",
        "Sexist tone: homemaking and “women’s place at home” are framed as where women do their only real work—not a critique of stay-at-home wives, but the book’s tone treats domestic life as women’s sole sphere; General Jinjur’s army satire is layered on that.",
        "Rest of the Oz series is treated as clean in owner vet—see Wonderful Wizard and other Oz volume notes.",
      ]),
    },
    {
      titleRe: /\bamazing adventures of kavalier\b|\bkavalier (&|and) clay\b/i,
      authorRe: /chabon|michael/i,
      tier: "flag_review",
      detail: bookNote("The Amazing Adventures of Kavalier & Clay (Michael Chabon)", [
        "Owner hand-rejected (Jun 2026).",
        "Adult literary fiction—not all-ages.",
        "LGBTQ storylines, mature romance, and adult language in owner scope.",
        "Halalit won’t recommend this title.",
      ]),
    },
    {
      titleRe: /\bcruel prince\b|\bfolk of the air\b|\bqueen of nothing\b|\bwicked king\b/i,
      authorRe: /black|holly/i,
      tier: "flag_review",
      detail: bookNote("The Folk of the Air / The Cruel Prince (Holly Black)", [
        "Owner hand-rejected (Jun 2026).",
        "Confirmed LGBTQ content in the series—owner certainty.",
        "Teen/YA dark romance with sexual relationship beats later in the trilogy—not all-ages.",
        "Halalit won’t recommend the series.",
      ]),
    },
    {
      titleRe: /\bpatrik the vampire\b|\bpatrik\b.*\bvampire\b/i,
      authorRe: /bree|paulsen/i,
      tier: "flag_review",
      detail: bookNote("Patrik the Vampire (Bree Paulsen)", [
        "Owner hand-rejected (Jun 2026).",
        "Adult webcomic / graphic-novel line—not middle grade.",
        "Vampire and adult-humor tone; not Halalit’s family shelf.",
        "Halalit won’t recommend this title.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    /* Owner shelf vet — Personal Library paste items 117+ (May 2026) */
    {
      titleRe: /\bmiss peregrine\b/i,
      authorRe: /riggs|ransom/i,
      tier: "user_discretion",
      detail: bookNote("Miss Peregrine's Peculiar Children (Ransom Riggs)", [
        "Parent discretion—not a hardest auto-reject.",
        "Drug references in owner scope.",
        "Nudity beats—including an invisible boy who must stay unclothed, and a de-transformation scene.",
        "Romance threads though not adult in owner scope.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bmrs\. smith'?s spy school|spy school for girls\b/i,
      authorRe: /mcmullen|beth/i,
      tier: "flag_review",
      detail: bookNote("Mrs. Smith's Spy School for Girls", [
        "Hand-verified clean in owner scope.",
        "Some side-character parent-bashing—not the lead’s parents throughout.",
      ], "Halalit won’t auto-recommend—parents can decide."),
    },
    {
      titleRe: /\bnat enough\b/i,
      authorRe: /scrivan|maria/i,
      tier: "flag_review",
      detail: bookNote("Nat Enough (Maria Scrivan, graphic novels)", [
        "Hand-verified clean across the series in owner scope.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Halalit may auto-recommend after graphic hand-check."),
    },
    {
      titleRe: /\bnever after\b|\bthirteenth fairy\b/i,
      authorRe: /de la cruz|melissa/i,
      tier: "flag_review",
      detail: bookNote("Never After (Melissa de la Cruz)", [
        "Books 1–2 read largely clean in owner scope with some dark-mentality beats.",
        "Rest of series not owner-vetted—Halalit won’t auto-recommend.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bonyeka\b/i,
      authorRe: /okogwu|tola/i,
      tier: "flag_review",
      detail: bookNote("Onyeka (Tọlá Okogwu)", [
        "Owner has not finished vetting this line yet.",
        "Early books read clean in owner scope with adoptive-family bashing and light crush beats.",
        "Halalit won't recommend until owner finishes vet.",
      ]),
    },
    {
      titleRe: /\bshadow of the dragon\b.*\belspeth\b|\bshadow of the dragon:\s*elspeth/i,
      authorRe: /o'hearn|hearn|kate/i,
      tier: "flag_review",
      detail: bookNote("Shadow of the Dragon: Elspeth (Kate O'Hearn, book 2)", [
        "Book 1 (Kira) hand-verified clean in owner scope—this sequel not owner-vetted yet.",
        "Halalit won’t recommend book 2 until you’ve read it or we get a vet call.",
      ]),
    },
    {
      titleRe: /\bpegasus\b|\bflame of olympus\b|\bolympus at war\b|\bnew olympians\b|\borigins of olympus\b|\brise of the titans\b|\bend of olympus\b/i,
      authorRe: /o'?hearn|kate\s*o'?hearn/i,
      tier: "user_discretion",
      detail: bookNote("Pegasus (Kate O'Hearn)", [
        "Parent discretion—not a hardest auto-reject.",
        "Dating romance in owner scope—nothing beyond hugging in owner scope.",
        "Greek-style deity/mythology treated as real.",
        "Book 1: normalization of child sacrifice—flag for parents.",
        "Sequel line not owner-vetted here—preview before sharing.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bgirl who could fly|piper mccloud|boy who knew everything|girl who fell out of the sky/i,
      authorRe: /forester|victoria/i,
      tier: "flag_review",
      detail: bookNote("Piper McCloud (Victoria Forester)", [
        "Reads clean in owner scope with some dark moments and parent-bashing beats.",
        "Brief romance hints—flag for parents; not a hard ban.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\boutlaws\b.*royal academy rebels/i,
      authorRe: /calonita|jen/i,
      tier: "flag_review",
      detail: bookNote("Royal Academy Rebels — Outlaws (Jen Calonita)", [
        "Reads clean in owner scope—owner may recheck the series.",
      ], "Halalit won’t auto-recommend until rechecked."),
    },
    {
      titleRe: /\bsamurai kids|owl ninja|shaolin tiger/i,
      authorRe: /fussell|sandy/i,
      tier: "flag_review",
      detail: bookNote("Samurai Kids (Sandy Fussell)", [
        "Books 1–3: serious dark parts but otherwise largely clean in owner scope.",
        "Other-religion representation—flag for parents.",
        "Scene helping an elderly naked man out of a shower/bath—preview modesty.",
        "Text calls out a sexism beat within the story.",
        "Rest of series not owner-vetted.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bsci-fi junior high\b/i,
      authorRe: /martin|john/i,
      tier: "flag_review",
      detail: bookNote("Sci-Fi Junior High", [
        "Book 1 hand-verified clean—rest of series not owner-vetted here.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bstudy hall of justice|secret hero society|fort solitude\b/i,
      authorRe: /fridolfs|derek/i,
      tier: "flag_review",
      detail: bookNote("Secret Hero Society (Derek Fridolfs, graphic novels)", [
        "Fort Solitude (book 2): Harley Quinn says winning does not matter when her partner went missing—on-page hint at canonical Ivy/Harley LGBTQ relationship.",
        "Plot otherwise reads clean in owner scope but panels include fanservice risk.",
        "Halalit won’t recommend without a graphic hand-check.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Outside Halalit recommendations and Book Quest."),
    },
    {
      titleRe: /\bsheets\b/i,
      authorRe: /thummler|brenna/i,
      tier: "flag_review",
      detail: bookNote("Sheets (Brenna Thummler, graphic novels)", [
        "Book 1 reads clean in owner scope.",
        "Book 2 leans into mental-health themes—series not fully owner-vetted.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bsimon thorn\b/i,
      authorRe: /carter|aimee/i,
      tier: "flag_review",
      detail: bookNote("Simon Thorn (Aimee Carter)", [
        "Halalit won’t recommend the series.",
        "Book 1 fine in owner scope.",
        "Book 3 jokes about potential half-sibling romance—rest unavailable in English.",
        "The series never finished being published in English.",
        "Family-bashing beats.",
      ]),
    },
    {
      titleRe: /\bthunder of monsters|songs of magic\b/i,
      authorRe: /patrick|s\.?\s*a/i,
      tier: "flag_review",
      detail: bookNote("Songs of Magic (S.A. Patrick)", [
        "Hand-verified largely clean in owner scope.",
        "Dark magic and deity/mythology; passing-wind jokes—not adult in owner scope.",
        "Halalit may auto-recommend with comfort notes.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bsquire & knight|squire and knight\b/i,
      authorRe: /chantler|scott/i,
      tier: "flag_review",
      detail: bookNote("Squire & Knight (Scott Chantler, graphic novels)", [
        "Duology hand-verified clean so far in owner scope.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Halalit won’t auto-recommend until graphic hand-check completes."),
    },
    /* Owner shelf vet — Personal Library 169+ batch (May 2026) */
    {
      titleRe: /\bstorm keeper\b/i,
      authorRe: /doyle|catherine/i,
      tier: "flag_review",
      detail: bookNote("Storm Keeper (Catherine Doyle)", [
        "Brief dark-magic beats in owner scope.",
        "Otherwise clean—Halalit may auto-recommend with that note.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bsweet valley twins\b|\bsweet valley\b.*\btwins\b|\btwins\b.*\bsweet valley\b/i,
      authorRe: /pascal|francine|sweet\s*valley/i,
      tier: "user_discretion",
      detail: bookNote("Sweet Valley Twins (prose and graphic novel adaptations)", [
        "Parent discretion—not a hardest auto-reject—for both prose and graphic adaptations.",
        "Later volume includes an illegitimate-child storyline—flag for parents.",
        "Protagonists lie and join in cruel behavior in owner scope.",
        "Graphic novels: fanservice and panel modesty issues.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bbliss bakery\b|\bbliss\b.*littlewood|\bdash of magic\b|\bbite-sized magic\b/i,
      authorRe: /littlewood|kathryn/i,
      tier: "flag_review",
      detail: bookNote("The Bliss Bakery (Kathryn Littlewood)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bcandy shop war\b/i,
      authorRe: /mull|brandon/i,
      tier: "flag_review",
      detail: bookNote("The Candy Shop War (Brandon Mull)", [
        "Hand-verified clean in owner scope.",
        "Theme that parents can’t be trusted with big secrets—flag for parents.",
      ], "Halalit may auto-recommend with that note."),
    },
    {
      titleRe: /\bshrunken head\b|\bcuriosity house\b/i,
      authorRe: /oliver|lauren/i,
      tier: "flag_review",
      detail: bookNote("The Curiosity House (Lauren Oliver)", [
        "Brief dark-mindset beat (reads as a villain’s lie) in book 1.",
        "Rest of series not owner-vetted—Halalit won’t auto-recommend yet.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bhaunted high\b/i,
      authorRe: /alsop|cheree/i,
      tier: "flag_review",
      detail: bookNote("The Haunted High (Cheree Alsop)", [
        "Firm no—Halalit won’t recommend the series.",
        "Plot turns dark; bully uses very crude explicit insults in owner scope.",
      ]),
    },
    {
      titleRe: /\bhouse with chicken legs\b/i,
      authorRe: /anderson|sophie/i,
      tier: "flag_review",
      detail: bookNote("The House with Chicken Legs (Sophie Anderson)", [
        "Hand-verified clean with one brief dark-mindset moment.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\blast bear\b/i,
      authorRe: /gold|hannah/i,
      tier: "flag_review",
      detail: bookNote("The Last Bear (Hannah Gold)", [
        "The Last Bear is verified clean on Halalit’s main hand list—pro-nature climate stewardship.",
        "The Lost Whale, Finding Bear, and later Hannah Gold titles not owner-vetted here.",
      ], "Halalit may auto-recommend for vetted volumes."),
    },
    {
      titleRe: /\bhero'?s guide\b|\bleague of princes\b/i,
      authorRe: /healy|christopher/i,
      tier: "flag_review",
      detail: bookNote("The League of Princes / Hero’s Guide (Christopher Healy)", [
        "Hand-verified clean: gross humor and a rumor about underwear on a flagpole—nothing adult.",
        "Quite a bit of family negativity—advisory, not a ban.",
      ], "Halalit may auto-recommend with family-tone note."),
    },
    {
      titleRe: /\blost rainforest\b|\bmez'?s magic\b/i,
      authorRe: /schrefer|eliot/i,
      tier: "flag_review",
      detail: bookNote("The Lost Rainforest (Eliot Schrefer)", [
        "Book 1 verified clean on Halalit’s main hand list—owner unsure pro-environmental message strength for Earth Week.",
        "Volumes after book 1 not owner-vetted yet.",
      ], "Halalit may auto-recommend book 1 only."),
    },
    {
      titleRe: /\bmagic misfits\b/i,
      authorRe: /harris|neil patrick/i,
      tier: "flag_review",
      detail: bookNote("The Magic Misfits (Neil Patrick Harris)", [
        "Major side character has two dads—Halalit won’t recommend the series.",
      ]),
    },
    {
      titleRe: /\bpumpkin princess\b/i,
      authorRe: /banbury|steven/i,
      tier: "flag_review",
      detail: bookNote("The Pumpkin Princess (Steven Banbury)", [
        "Clean so far in owner scope.",
        "Flag Christian holiday references and family negativity.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\braven crown\b|\braven heir\b/i,
      authorRe: /burgis|stephanie/i,
      tier: "flag_review",
      detail: bookNote("The Raven Crown (Stephanie Burgis)", [
        "Hand-verified clean with some family negativity.",
      ], "Halalit may auto-recommend with family-tone note."),
    },
    {
      titleRe: /\brevenge of magic\b|\btimeless one\b/i,
      authorRe: /riley|james/i,
      tier: "flag_review",
      detail: bookNote("The Revenge of Magic (James Riley)", [
        "Books 1–4 clean in owner scope with family negativity.",
        "Book 5 not owner-vetted—recheck before recommending the full set.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\btwistrose key\b/i,
      authorRe: /almhjell|tone/i,
      tier: "flag_review",
      detail: bookNote("The Twistrose Key (Tone Almhjell)", [
        "Book 1 clean—book 2 got scary; may suit older children, not mature/R-rated.",
        "Book 2 not fully owner-vetted—Halalit won’t auto-recommend the series yet.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\btwo princesses of bamarre\b/i,
      authorRe: /levine|gail/i,
      tier: "flag_review",
      detail: bookNote("The Two Princesses of Bamarre (Gail Carson Levine)", [
        "Clean with light romance—no kissing until after marriage in owner scope.",
        "Flag possible Stockholm-style attachment toward a dragon captor—parent preview.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bwizards of once\b|\btwice magic\b/i,
      authorRe: /cowell|cressida/i,
      tier: "flag_review",
      detail: bookNote("The Wizards of Once (Cressida Cowell)", [
        "Clean with brief romance, a dark-mindset moment, and family negativity.",
      ], "Halalit may auto-recommend with notes."),
    },
    {
      titleRe: /\bzee files\b/i,
      authorRe: /wells|tina/i,
      tier: "user_discretion",
      detail: bookNote("The Zee Files (Tina Wells)", [
        "Strong parent discretion—not a hardest auto-reject.",
        "Generally clean but protagonist keeps noticing boys more than some parents want—stays at dating level.",
        "Brief dark-mindset moment.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview carefully and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\btheodore boono\b|\btheodore boone\b/i,
      authorRe: /grisham|john/i,
      tier: "flag_review",
      detail: bookNote("Theodore Boone (John Grisham)", [
        "Hand-verified clean but serious legal tone—better for teens.",
      ], "Halalit may auto-recommend for teen shelf context."),
    },
    {
      titleRe: /\bdragon of trelian\b|\btrelian\b/i,
      authorRe: /knudsen|michelle/i,
      tier: "flag_review",
      detail: bookNote("Trelian (Michelle Knudsen)", [
        "Book 1 likely fine—rest not owner-vetted.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bunseen magic\b/i,
      authorRe: /lloyd-jones|emily/i,
      tier: "flag_review",
      detail: bookNote("Unseen Magic (Emily Lloyd-Jones)", [
        "Duology: book 1 clean in owner scope.",
        "Book 2: brief LGBTQ reference and parent negativity—Halalit won’t recommend book 2.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe:
        /\bwild rescuers\b|\bguardians of the taiga\b|\bescape to the mesa\b|\bexpedition on the tundra\b|\bsentinels in the deep ocean\b/i,
      authorRe: /stacyplays|stacy/i,
      tier: "flag_review",
      detail: bookNote("Wild Rescuers (StacyPlays)", [
        "Verified clean on Halalit’s main hand list—whole series in owner scope.",
        "Fantasy magic comfort note—exclude magic in Advanced recommendations settings if needed.",
      ], "Halalit may auto-recommend when magic is allowed."),
    },
    {
      titleRe:
        /\bwing & claw\b|\bwing and claw\b|\bforest of wonders\b|\bcavern of secrets\b|\bbeast of stone\b/i,
      authorRe: /park|linda sue/i,
      tier: "flag_review",
      detail: bookNote("Wing & Claw (Linda Sue Park, trilogy)", [
        "Verified clean on Halalit’s main hand list—whole trilogy in owner scope.",
        "Botanical/animal fantasy—magic comfort note; owner unsure Earth Week stewardship fit.",
      ], "Halalit may auto-recommend when magic is allowed."),
    },
    {
      titleRe: /\bwolven\b/i,
      authorRe: /toft|di/i,
      tier: "flag_review",
      detail: bookNote("Wolven (Di Toft)", [
        "Brief dark-mindset moment—otherwise fine in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bsecrets of the crown\b|\bthe familiars\b|\bcircle of heroes\b|\bpalace of dreams\b/i,
      authorRe: /epstein|adam jay/i,
      tier: "flag_review",
      detail: bookNote("The Familiars (Adam Jay Epstein)", [
        "Hand-verified clean across the line in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\banimal farm\b/i,
      authorRe: /orwell|george/i,
      tier: "flag_review",
      detail: bookNote("Animal Farm (George Orwell)", [
        "Hand-verified clean but gets intense—better for teens.",
      ], "Halalit may auto-recommend for teen readers."),
    },
    {
      titleRe: /\brunaway bunny\b/i,
      authorRe: /brown|margaret wise/i,
      tier: "flag_review",
      detail: bookNote("The Runaway Bunny (Margaret Wise Brown)", [
        "Owner thinks it’s probably fine—not fully finished vet.",
      ], "Parked—not finished vet."),
    },
    {
      titleRe: /\belephant in the room\b/i,
      authorRe: /sloan|holly goldberg/i,
      tier: "flag_review",
      detail: bookNote("The Elephant in the Room (Holly Goldberg Sloan)", [
        "Owner has not finished vet—parked.",
      ], "Parked—not finished vet."),
    },
    {
      titleRe: /\bpersuasion\b/i,
      authorRe: /austen|jane/i,
      tier: "flag_review",
      detail: bookNote("Persuasion (Jane Austen)", [
        "Clean romance in owner scope—flag for parents who preview dating threads.",
      ], "Halalit may auto-recommend with romance note."),
    },
    {
      titleRe: /\bgreen eggs and ham\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      tier: "flag_review",
      detail: bookNote("Green Eggs and Ham (Dr. Seuss)", [
        "Human-worship framing, alcohol, and racism beats in owner scope.",
        "Halalit won’t auto-recommend.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\boh, the places you'?ll go\b/i,
      authorRe: /seuss|dr\.?\s*seuss|geisel/i,
      tier: "flag_review",
      detail: bookNote("Oh, the Places You'll Go! (Dr. Seuss)", [
        "Human-worship framing, alcohol, and racism beats in owner scope.",
        "Halalit won’t auto-recommend.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bfloors\b/i,
      authorRe: /carman|patrick/i,
      tier: "flag_review",
      detail: bookNote("Floors (Patrick Carman)", [
        "Books 1–2 fine in owner scope—rest not owner-vetted.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bice dragon\b/i,
      authorRe: /martin|george|g\.?\s*r\.?\s*r/i,
      tier: "flag_review",
      detail: bookNote("The Ice Dragon (George R.R. Martin)", [
        "Hand-verified fine in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bminecraft:\s*adventure school\b/i,
      authorRe: /sanz|monica/i,
      tier: "flag_review",
      detail: bookNote("Minecraft: Adventure School (Monica Sanz)", [
        "Clean with some family negativity in owner scope.",
      ], "Halalit may auto-recommend with family-tone note."),
    },
    {
      titleRe: /\bmidwatch institute\b/i,
      authorRe: /rossell|judith/i,
      tier: "flag_review",
      detail: bookNote("The Midwatch Institute for Wayward Girls (Judith Rossell)", [
        "Plot clean in owner scope.",
        "Cover art: cartoon girls in dresses with bare knees—preview covers.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bstitched up\b/i,
      authorRe: /o'connell|joanne/i,
      tier: "flag_review",
      detail: bookNote("Stitched Up (Joanne O'Connell)", [
        "Fine aside from one page asking what’s wrong with “putting skin on show” and family negativity.",
      ], "Halalit may auto-recommend with notes."),
    },
    {
      titleRe: /\bhexbridge castle\b/i,
      authorRe: /kent|gabrielle/i,
      tier: "flag_review",
      detail: bookNote("The Secrets of Hexbridge Castle (Gabrielle Kent)", [
        "Book 1 clean—rest not owner-vetted.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bto kill a mockingbird\b/i,
      authorRe: /lee|harper/i,
      tier: "flag_review",
      detail: bookNote("To Kill a Mockingbird (Harper Lee)", [
        "Racism and drugs shown; story condemns them in owner scope.",
        "Morphine-for-the-dying beat—parent discretion; Halalit won’t auto-recommend.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\boperation sisterhood\b/i,
      authorRe: /rhuday|olugbemisola/i,
      tier: "flag_review",
      detail: bookNote("Operation Sisterhood (Olugbemisola Rhuday-Perkovich)", [
        "Book 1 fine—rest not owner-vetted.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bsecret of honeycake\b/i,
      authorRe: /fusco|kimberly/i,
      tier: "flag_review",
      detail: bookNote("The Secret of Honeycake (Kimberly Newton Fusco)", [
        "Hand-verified fine in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bfrozen 2\b.*\bmanga\b/i,
      authorRe: /tanemura|arina/i,
      tier: "flag_review",
      detail: bookNote("Frozen 2: The Manga (Arina Tanemura)", [
        "Clean Disney plot with brief romantic beats.",
        "Flag comic format and Elsa in tight outfits—Halalit won’t auto-recommend.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\blittle snow fairy sugar\b/i,
      authorRe: /aoi|haruka/i,
      tier: "flag_review",
      detail: bookNote("A Little Snow Fairy Sugar (Haruka Aoi)", [
        "Plot clean in owner scope—owner still checking outfit art in panels.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bdanny phantom\b/i,
      tier: "user_discretion",
      detail: bookNote("Danny Phantom (graphic novel)", [
        "Parent discretion—not a hardest auto-reject.",
        "Not official fanservice in owner scope, but immodesty runs throughout the graphic series—preview panels.",
        "Clean plot with some boyfriend/girlfriend beats.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bbotticelli'?s apprentice\b/i,
      authorRe: /husted|ursula/i,
      tier: "flag_review",
      detail: bookNote("Botticelli's Apprentice (Ursula Murray Husted)", [
        "Hand-verified fine in owner scope.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Halalit may auto-recommend after graphic hand-check."),
    },
    {
      titleRe: /\bwhen dinosaurs came with everything\b/i,
      authorRe: /broach|elise/i,
      tier: "flag_review",
      detail: bookNote("When Dinosaurs Came with Everything (Elise Broach)", [
        "Hand-verified fine in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bpromised neverland\b/i,
      authorRe: /shirai|demizu|kaiu|posuka/i,
      tier: "flag_review",
      detail: bookNote("The Promised Neverland (manga)", [
        "Firm no—Halalit won’t recommend the series.",
        "Fanservice, parent negativity, and very dark-mindset material in owner scope.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\bweirn books\b|\bbe wary of the silent woods\b/i,
      authorRe: /chmakova|svetlana/i,
      tier: "flag_review",
      detail: bookNote("The Weirn Books (Svetlana Chmakova)", [
        "Series clean in owner scope; book 2 includes they/them representation.",
        "Halalit won’t auto-recommend without parent preview.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bchi'?s sweet home\b|\bchi'?s sweet adventures\b/i,
      authorRe: /konami|kanata|natsume|kinoko/i,
      tier: "flag_review",
      detail: bookNote("Chi's Sweet Home / Chi's Sweet Adventures (manga)", [
        "Hand-verified clean in owner scope.",
        "May be the same franchise in different editions—treat as one cozy cat line.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Halalit may auto-recommend after graphic hand-check."),
    },
    {
      titleRe: /\bhappy happy clover\b/i,
      authorRe: /tatsuyama|sayuri/i,
      tier: "flag_review",
      detail: bookNote("Happy Happy Clover (Sayuri Tatsuyama)", [
        "Hand-verified clean; brief deity-style mythology in a later volume—comfort note.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bstrange academy\b/i,
      authorRe: /young|skottie/i,
      tier: "flag_review",
      detail: bookNote("Strange Academy (Skottie Young)", [
        "Book 1 plot okay in owner scope—full series and comic fanservice not vetted.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bsea in winter\b/i,
      authorRe: /day|christine/i,
      tier: "flag_review",
      detail: bookNote("The Sea in Winter (Christine Day)", [
        "Owner suspects depression themes—parked; Halalit won’t auto-recommend yet.",
      ], "Parked—not finished vet."),
    },
    {
      titleRe: /\bnever cry wolf\b/i,
      authorRe: /mowat|farley/i,
      tier: "flag_review",
      detail: bookNote("Never Cry Wolf (Farley Mowat)", [
        "Mostly plot clean in owner scope, but leave out of Halalit recommends.",
        "Personal references to adult romance—outside the family shelf for that reason.",
        "Halalit won’t recommend or Book Quest this title.",
      ]),
    },
    {
      titleRe: /\bglister\b/i,
      authorRe: /watson|andi/i,
      tier: "flag_review",
      detail: bookNote("Glister (Andi Watson)", [
        "Hand-verified clean with extended-family negativity.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Halalit may auto-recommend after graphic hand-check."),
    },
    {
      titleRe: /\bsummer vamp\b/i,
      authorRe: /karim|violet/i,
      tier: "flag_review",
      detail: bookNote("Summer Vamp (Violet Chan Karim)", [
        "Fine in owner scope—graphic novel; preview panels.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bgrace of wild things\b/i,
      authorRe: /fawcett|heather/i,
      tier: "flag_review",
      detail: bookNote("The Grace of Wild Things (Heather Fawcett)", [
        "Verified clean on Halalit’s main hand list—pro-nature wild-creature care.",
        "Fantasy magic comfort note—exclude magic in Advanced recommendations settings if needed.",
      ], "Halalit may auto-recommend when magic is allowed."),
    },
    {
      titleRe: /\bglobal\b/i,
      authorRe: /colfer|eoin/i,
      tier: "flag_review",
      detail: bookNote("Global (Eoin Colfer)", [
        "Some parent negativity in owner scope.",
      ], "Halalit may auto-recommend with family-tone note."),
    },
    {
      titleRe: /\bsisterhood of sleuths\b/i,
      authorRe: /bertman|jennifer chambliss/i,
      tier: "flag_review",
      detail: bookNote("Sisterhood of Sleuths (Jennifer Chambliss Bertman)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bmanatee summer\b/i,
      authorRe: /griffith|evan/i,
      tier: "flag_review",
      detail: bookNote("Manatee Summer (Evan Griffith)", [
        "Verified clean on Halalit’s main hand list—manatee rescue and wild-water summer care.",
        "Parent negativity around a divorced absent father—family-tone note.",
      ], "Halalit may auto-recommend with family-tone note when allowed."),
    },
    {
      titleRe: /\bcastle of tangled magic\b/i,
      authorRe: /anderson|sophie/i,
      tier: "flag_review",
      detail: bookNote("The Castle of Tangled Magic (Sophie Anderson)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bhappily for now\b/i,
      authorRe: /jones|kelly/i,
      tier: "flag_review",
      detail: bookNote("Happily for Now (Kelly Jones)", [
        "Family negativity and addiction/rehab themes for a parent character.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bbad kitty\b/i,
      authorRe: /bruel|nick/i,
      tier: "flag_review",
      detail: bookNote("Bad Kitty (Nick Bruel)", [
        "Series reads clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bjust pretend\b/i,
      authorRe: /sharp|tori/i,
      tier: "flag_review",
      detail: bookNote("Just Pretend (Tori Sharp, graphic novels)", [
        "Owner hasn't finished vet—graphic novel; preview panels for fanservice risk.",
        "Serious family negativity and brief deity-mythology mentions in owner scope.",
        "Halalit won't recommend until owner finishes graphic hand-check.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\bdiscovery of dragons\b/i,
      authorRe: /galvin|lindsay/i,
      tier: "flag_review",
      detail: bookNote("A Discovery of Dragons (Lindsay Galvin)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bone kid'?s trash\b/i,
      authorRe: /sumner|jamie/i,
      tier: "flag_review",
      detail: bookNote("One Kid's Trash (Jamie Sumner)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bnot if i can help it\b/i,
      authorRe: /mackler|carolyn/i,
      tier: "flag_review",
      detail: bookNote("Not If I Can Help It (Carolyn Mackler)", [
        "Clean plot but parent negativity and LGBTQ reference—Halalit won’t recommend.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bcurse of the phoenix\b/i,
      authorRe: /carter|aimee/i,
      tier: "flag_review",
      detail: bookNote("Curse of the Phoenix (Aimee Carter)", [
        "Dark curse premise but clean plot in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bellie makes her move\b/i,
      authorRe: /kaye|marilyn/i,
      tier: "flag_review",
      detail: bookNote("Ellie Makes Her Move (Marilyn Kaye)", [
        "Book 1 clean—rest not owner-vetted.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bschool between winter and fairyland\b/i,
      authorRe: /fawcett|heather/i,
      tier: "flag_review",
      detail: bookNote("The School Between Winter and Fairyland (Heather Fawcett)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\blast rabbit\b/i,
      authorRe: /thomas|shelley moore/i,
      tier: "flag_review",
      detail: bookNote("The Last Rabbit (Shelley Moore Thomas)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\brez dogs\b/i,
      authorRe: /bruchac|joseph/i,
      tier: "flag_review",
      detail: bookNote("Rez Dogs (Joseph Bruchac)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bfrankenstein\b/i,
      authorRe: /shelley|wollstonecraft|mary/i,
      tier: "user_discretion",
      detail: bookNote("Frankenstein (Mary Shelley)", [
        "Parent discretion—not a hardest auto-reject.",
        "Dark classic—not dirty, but teen-level darkness—flag for parents.",
        "Also keep in mind colonial-era themes and framing in the classic text.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bgirl and the witch'?s garden\b/i,
      authorRe: /bowman|erin/i,
      tier: "flag_review",
      detail: bookNote("The Girl and the Witch's Garden (Erin Bowman)", [
        "Heavier parent negativity—not dark adult abuse in owner scope.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\brival magic\b/i,
      authorRe: /fagan|deva/i,
      tier: "flag_review",
      detail: bookNote("Rival Magic (Deva Fagan)", [
        "Hand-verified clean with some parent negativity.",
      ], "Halalit may auto-recommend with family-tone note."),
    },
    {
      titleRe: /\bdragon egg princess\b/i,
      authorRe: /oh|ellen/i,
      tier: "flag_review",
      detail: bookNote("The Dragon Egg Princess (Ellen Oh)", [
        "Hand-verified clean with some parent negativity.",
      ], "Halalit may auto-recommend with family-tone note."),
    },
    {
      titleRe: /\bgirl who speaks bear\b/i,
      authorRe: /anderson|sophie/i,
      tier: "flag_review",
      detail: bookNote("The Girl Who Speaks Bear (Sophie Anderson)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bdark lord clementine\b/i,
      authorRe: /horwitz|sarah jean/i,
      tier: "flag_review",
      detail: bookNote("The Dark Lord Clementine (Sarah Jean Horwitz)", [
        "Hand-verified clean with parent negativity and a crossdressing reference.",
      ], "Halalit may auto-recommend with notes."),
    },
    {
      titleRe: /\bdragonfell\b/i,
      authorRe: /prineas|sarah/i,
      tier: "flag_review",
      detail: bookNote("Dragonfell (Sarah Prineas)", [
        "Some parent negativity—plot clean in owner scope.",
      ], "Halalit may auto-recommend with family-tone note."),
    },
    {
      titleRe: /\bmiss ellicott\b/i,
      authorRe: /blackwood|sage/i,
      tier: "flag_review",
      detail: bookNote("Miss Ellicott's School for the Magically Minded (Sage Blackwood)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\blosers club\b/i,
      authorRe: /clements|andrew/i,
      tier: "flag_review",
      detail: bookNote("The Losers Club (Andrew Clements)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\boddity\b/i,
      authorRe: /cannon|sarah/i,
      tier: "flag_review",
      detail: bookNote("Oddity (Sarah Cannon)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bsave me a seat\b/i,
      authorRe: /weeks|sarah/i,
      tier: "flag_review",
      detail: bookNote("Save Me a Seat (Sarah Weeks)", [
        "Clean but bullying not always called out in owner scope—parent preview.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bcastle behind thorns\b/i,
      authorRe: /haskell|merrie/i,
      tier: "flag_review",
      detail: bookNote("The Castle Behind Thorns (Merrie Haskell)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bsparkers\b/i,
      authorRe: /glewwe|eleanor/i,
      tier: "flag_review",
      detail: bookNote("Sparkers (Eleanor Glewwe)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bsartor\b/i,
      authorRe: /smith|sherwood/i,
      tier: "flag_review",
      detail: bookNote("Sartor (Sherwood Smith)", [
        "Brief dark-mindset moment and light romantic hints—nothing adult in owner scope.",
      ], "Halalit may auto-recommend with notes."),
    },
    {
      titleRe: /\bwhizz pop chocolate shop\b/i,
      authorRe: /saunders|kate/i,
      tier: "flag_review",
      detail: bookNote("The Whizz Pop Chocolate Shop (Kate Saunders)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bpower of poppy pendle\b/i,
      authorRe: /lowe|natasha/i,
      tier: "flag_review",
      detail: bookNote("The Power of Poppy Pendle (Natasha Lowe)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bprincess curse\b/i,
      authorRe: /haskell|merrie/i,
      tier: "user_discretion",
      detail: bookNote("The Princess Curse (Merrie Haskell)", [
        "Parent discretion—not a hardest auto-reject.",
        "Illegitimate-child references in owner scope—flag for parents.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bbreadcrumbs\b/i,
      authorRe: /ursu|anne/i,
      tier: "flag_review",
      detail: bookNote("Breadcrumbs (Anne Ursu)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bdragon'?s egg\b/i,
      authorRe: /thomson|sarah/i,
      tier: "flag_review",
      detail: bookNote("Dragon's Egg (Sarah L. Thomson)", [
        "Hand-verified clean in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bmother[- ]daughter book club\b/i,
      authorRe: /frederick|vogel/i,
      tier: "user_discretion",
      detail: bookNote("The Mother-Daughter Book Club (Heather Vogel Frederick)", [
        "Parent discretion—not a hardest auto-reject.",
        "Clean but heavier character negativity, gossip, and dating romance—flag for parents.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bida b\b/i,
      authorRe: /hannigan|katherine/i,
      tier: "flag_review",
      detail: bookNote("Ida B . . . and Her Plans to Maximize Fun (Katherine Hannigan)", [
        "Likely clean in owner scope—owner wants author name kept with title in lists.",
      ], "Halalit may auto-recommend after confirm."),
    },
    {
      titleRe: /\bnausicaa\b|\bnausicaä\b|\bvalley of the wind\b/i,
      authorRe: /miyazaki|hayao/i,
      tier: "flag_review",
      detail: bookNote("Nausicaä of the Valley of the Wind (Hayao Miyazaki)", [
        "Firm no—Halalit won’t recommend.",
        "Fanservice and teen-level darkness in owner scope.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\bjekyll\b|\bmr\.?\s*hyde\b|\bstrange case of\b.*\bjekyll\b|\bjekyll and\b.*\bhyde\b/i,
      authorRe: /stevenson|robert\s*louis/i,
      tier: "user_discretion",
      detail: bookNote("Dr. Jekyll and Mr. Hyde (Robert Louis Stevenson)", [
        "Parent discretion—not a hardest auto-reject.",
        "Dark themes—ends quite dark; teen-level tone—flag for parents.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bgiving tree\b/i,
      authorRe: /silverstein|shel/i,
      tier: "flag_review",
      detail: bookNote("The Giving Tree (Shel Silverstein)", [
        "Owner thinks fine in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bwhere the sidewalk ends\b/i,
      authorRe: /silverstein|shel/i,
      tier: "flag_review",
      detail: bookNote("Where the Sidewalk Ends (Shel Silverstein)", [
        "Owner thinks fine in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\blight in the attic\b/i,
      authorRe: /silverstein|shel/i,
      tier: "flag_review",
      detail: bookNote("A Light in the Attic (Shel Silverstein)", [
        "Owner thinks fine in owner scope.",
      ], "Halalit may auto-recommend."),
    },
    {
      titleRe: /\bso b\.?\s*it\b/i,
      authorRe: /weeks|sarah/i,
      tier: "flag_review",
      detail: bookNote("So B. It (Sarah Weeks)", [
        "Owner has not finished vet—parked.",
      ], "Parked—not finished vet."),
    },
    {
      titleRe: /\bfires of calderon\b|\bbalance keepers\b/i,
      authorRe: /cummings|lindsay/i,
      tier: "flag_review",
      detail: bookNote("The Balance Keepers (Lindsay Cummings)", [
        "On shelf but owner has not read—no vet call yet.",
        "Halalit won’t recommend until owner reads or removes from shelf list.",
      ]),
    },
    {
      titleRe: /\bsalted caramel dreams\b|\bapple pie promises\b|\bswirl\b/i,
      authorRe: /bardenwerper|homzie|jackie|hillary/i,
      tier: "flag_review",
      detail: bookNote("Swirl novels (Jackie Nastri Bardenwerper / Hillary Homzie)", [
        "Hand-verified largely clean in owner scope.",
        "Some light romance beats at times—flag for parents.",
      ], "Halalit may auto-recommend with romance note."),
    },
    {
      titleRe: /\bstory thieves\b|\bsecret origins\b|\bstolen prince\b|\bsecret of the story\b/i,
      authorRe: /riley|james/i,
      tier: "flag_review",
      detail: bookNote("Story Thieves (James Riley)", [
        "Book 3 (Secret Origins on your shelf): dark beats in owner scope.",
        "Author notes LGBTQ content later in the series—Halalit won’t recommend the line.",
      ]),
    },
    {
      titleRe: /\bcall of the wild\b/i,
      authorRe: /london|jack/i,
      tier: "flag_review",
      detail: bookNote("The Call of the Wild (Jack London)", [
        "Owner shelf vet (May 2026)—already ruled; coded so it stays off the ask list.",
        "Classic survival tale—preview intensity for younger readers.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bwhite fang\b/i,
      authorRe: /london|jack/i,
      tier: "flag_review",
      detail: bookNote("White Fang (Jack London)", [
        "Owner shelf vet (May 2026)—already ruled; coded so it stays off the ask list.",
        "Classic survival tale—preview intensity for younger readers.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bto kill a mockingbird\b.*\bgraphic\b|\bgraphic\b.*\bto kill a mockingbird\b/i,
      authorRe: /fordham|fred/i,
      tier: "flag_review",
      detail: bookNote("To Kill a Mockingbird: A Graphic Novel (Fred Fordham)", [
        "Same story as Harper Lee novel—see prose edition note (racism, drugs, morphine beat).",
        "Owner shelf vet (May 2026)—already ruled; parent discretion, no auto-recommend.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Won’t Book Quest—not inappropriate."),
    },
    /* Owner shelf vet — Personal Library paste items 1–116 (May 2026) */
    {
      titleRe: /\bamelia bedelia\b/i,
      authorRe: /parish|herman|lynne/i,
      tier: "flag_review",
      detail: bookNote("Amelia Bedelia Chapter Books", [
        "Generally fine in owner scope.",
        "Book 7 hints at a cousin who may be an illegitimate child—Halalit won’t auto-recommend the line.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe:
        /\bamulet\b|\bstonekeeper\b|\bstonekeeper'?s curse\b|\bcloud searchers\b|\blast council\b|\bprince of the elves\b|\bsword of ages\b|\bescape from lucien\b|\bfirelight\b|\bsupernova\b/i,
      authorRe: /kibuishi|kazu/i,
      tier: "flag_review",
      detail: bookNote("Amulet (Kazu Kibuishi, graphic novels)", [
        "Owner-vetted overall clean; brief mental-health representation in some volumes.",
        "Father read as possessed/corpse—strained parent beats, not sustained villain-parent framing.",
        "Halalit won’t auto-recommend; not a hard content ban.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\barchibald finch\b/i,
      authorRe: /guyon|michel/i,
      tier: "flag_review",
      detail: bookNote("Archibald Finch (Michel Guyon)", [
        "Light romance—not adult in owner scope.",
        "Book 1: serious grandma-bashing; rest of series not owner-vetted.",
        "Halalit won't recommend until the series is owner-vetted.",
      ]),
    },
    {
      titleRe: /\bwolf brother\b|\bspirit walker\b|\bsoul eater\b|\boutcast\b|\boath breaker\b/i,
      authorRe: /paver|michelle/i,
      tier: "flag_review",
      detail: bookNote("Chronicles of Ancient Darkness (Michelle Paver)", [
        "Owner can't vet this series yet.",
        "Gets dark in places; book 1 largely clean in owner scope.",
        "Halalit won't recommend until owner finishes vet.",
      ]),
    },
    {
      titleRe: /\bcordelia hatmaker\b|\bhatmakers\b|\btroublemakers\b/i,
      authorRe: /merchant|tamzin/i,
      tier: "flag_review",
      detail: bookNote("Cordelia Hatmaker (Tamzin Merchant)", [
        "Book 1: major LGBTQ moment—outside Halalit’s family shelf.",
        "Book 3 not owner-vetted.",
      ]),
    },
    {
      titleRe: /\bclick\b/i,
      authorRe: /miller|kayla/i,
      tier: "flag_review",
      detail: bookNote("Click (Kayla Miller, graphic novels)", [
        "Plot reads clean in owner scope but mentions LGBTQ threads.",
        "Halalit won’t recommend the series.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\bcupcake diaries\b/i,
      authorRe: /simon|coco/i,
      tier: "user_discretion",
      detail: bookNote("Cupcake Diaries (Coco Simon)", [
        "Parent discretion—not a hardest auto-reject.",
        "Plot reads clean in owner scope—not “dirty,” but heavy **romance / boy-obsessed** focus between books.",
        "Too much romance emphasis for younger audiences—flag for parents.",
        "Not on Book Quest; Halalit won’t auto-recommend—preview and decide for your home.",
      ], USER_DISCRETION_PREVIEW_CLOSING),
    },
    {
      titleRe: /\bdead city\b|\bblue moon\b|\bdark days\b/i,
      authorRe: /ponti|james/i,
      tier: "flag_review",
      detail: bookNote("Dead City (James Ponti)", [
        "Owner parked—off Halalit recommend list for now (same future-flagging lane as Harry Potter / J.K. Rowling).",
        "Plot reads clean in owner scope for books 1–2; book 3 turns darker—preview if you read on your own.",
        "No Book Quest or auto-recommend until owner clears parked.",
      ]),
    },
    {
      titleRe: /\bdefender of the realm\b/i,
      authorRe: /huckerby|mark/i,
      tier: "flag_review",
      detail: bookNote("Defender of the Realm (Mark Huckerby)", [
        "Otherwise clean in owner scope.",
        "Intense parent-bashing, evil brother, and a brief non-graphic nudity beat after a de-transformation scene.",
        "Rest of series not owner-vetted.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe:
        /\benchanted forest chronicles\b|\bdealing with dragons\b|\bsearching for dragons\b|\bcalling on dragons\b|\btalking to dragons\b/i,
      authorRe: /wrede|patricia/i,
      tier: "flag_review",
      detail: bookNote("Enchanted Forest Chronicles (Patricia C. Wrede)", [
        "LGBTQ representation including they/them gender-choice beats in owner scope.",
        "Halalit won’t recommend the series.",
      ]),
    },
    {
      titleRe: /\bflunked\b|\bfairy tale reform school\b|\bcharmed\b|\btricked\b|\bspellbound\b|\bwished\b/i,
      authorRe: /calonita|jen/i,
      tier: "flag_review",
      detail: bookNote("Fairy Tale Reform School (Jen Calonita)", [
        "Reads clean in owner scope with light/dating romance mentions.",
        "Series ends on a cliffhanger—note for parents finishing the arc.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bfoxcraft\b|\bthe elders\b|\bthe taken\b|\bthe return\b/i,
      authorRe: /iserles|inbali/i,
      tier: "flag_review",
      detail: bookNote("Foxcraft (Inbali Iserles)", [
        "Includes dark-magic tone in owner scope.",
        "Halalit won’t auto-recommend the series.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bframed\b|\bvanished\b|\btrapped\b/i,
      authorRe: /ponti|james/i,
      tier: "flag_review",
      detail: bookNote("Framed! (James Ponti)", [
        "Mostly clean in owner scope.",
        "Book 3: parent-bashing beats—preview that volume.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bfunjungle\b|\bbelly up\b|\bpoached\b|\bbig game\b|\bpanda-monium\b|\bkiller species\b|\bbear bottom\b/i,
      authorRe: /gibbs|stuart/i,
      tier: "flag_review",
      detail: bookNote("FunJungle (Stuart Gibbs)", [
        "Early books: light dating romance in owner scope.",
        "Book 7 reveals LGBTQ threads—Halalit won’t recommend the series.",
      ]),
    },
    {
      titleRe: /\brebel genius\b|\bwarrior genius\b|\bgeniuses\b/i,
      authorRe: /dimartino|michael/i,
      tier: "flag_review",
      detail: bookNote("Geniuses (Michael Dante DiMartino)", [
        "Darker tone in owner scope—Halalit won’t auto-recommend.",
        "Books 1–2 read cleaner in owner scope—preview the rest.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bgreenwild\b|\bforest in the sky\b/i,
      authorRe: /thomson|pari/i,
      tier: "flag_review",
      detail: bookNote("Greenwild (Pari Thomson)", [
        "LGBTQ threads and parent-bashing in owner scope—not explicit, but off Halalit’s shelf.",
      ]),
    },
    {
      titleRe: /\bgreystone secrets\b|\bstrangers\b|\bdeceivers\b|\brememberers\b/i,
      authorRe: /haddix|margaret/i,
      tier: "flag_review",
      detail: bookNote("Greystone Secrets (Margaret Peterson Haddix)", [
        "Book 1 reads clean in owner scope with parent-bashing beats.",
        "Rest of series not owner-vetted.",
        "Halalit won't recommend until the series is owner-vetted.",
      ]),
    },
    {
      titleRe: /\bhatter m\b|\blooking glass wars\b|\bghost in the hatbox\b|\bhatter madigan\b/i,
      authorRe: /beddor|frank/i,
      tier: "flag_review",
      detail: bookNote("Hatter M / Looking Glass Wars tie-ins (Frank Beddor)", [
        "Reads largely clean in owner scope.",
        "Romance mentions and brief dark-mentality beats—Halalit won’t auto-recommend.",
        "Parent-bashing toward the queen in owner scope.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bimpossible creatures\b/i,
      authorRe: /rundell|katherine/i,
      tier: "flag_review",
      detail: bookNote("Impossible Creatures (Katherine Rundell)", [
        "No LGBTQ main plot in owner scope; end matter briefly mentions related themes.",
        "They/them framing for a creature race—parent discretion.",
        "Halalit won’t auto-recommend; not a hard ban.",
      ], "Won’t Book Quest—parent discretion."),
    },
    {
      titleRe: /\bjack blank\b|\baccidental hero\b|\bsecret war\b|\bend of infinity\b/i,
      authorRe: /myklusch|matt/i,
      tier: "flag_review",
      detail: bookNote("Jack Blank (Matt Myklusch)", [
        "Generally clean in owner scope.",
        "One volume turns dark; possible illegitimate-child beat—Halalit won’t auto-recommend.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe:
        /\bjedi academy\b|\bstar wars:\s*jedi academy\b|\breturn of the padawan\b|\bphantom bully\b|\bnew class\b|\bforce oversleeps\b|\bprincipal strikes back\b|\battack of the furball\b|\bat last,?\s*jedi\b|\battack of the journal\b/i,
      authorRe: /brown|jeffrey|krosoczka|jarrett|ignatow|amy/i,
      tier: "flag_review",
      detail: bookNote("Star Wars: Jedi Academy (graphic novels)", [
        "Mostly clean in owner scope.",
        "Sequel beats: parent-bashing and a younger boy’s crush on a girl normalized in ways that felt odd.",
        "Halalit won’t auto-recommend the series.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bkat,?\s*incorrigible\b|\brenegade magic\b|\bstolen magic\b/i,
      authorRe: /burgis|stephanie/i,
      tier: "flag_review",
      detail: bookNote("Kat, Incorrigible (Stephanie Burgis)", [
        "Reject because of a later book—Halalit won’t recommend the series.",
        "Books 1–3 mostly parent-discretion territory: family-bashing and odd marriage-plot beats; book 3 illegitimate-child beat.",
        "Book 4: hard reject—immodest cover and jokes in owner scope.",
      ]),
    },
    {
      titleRe: /\bkatie the catsitter\b/i,
      authorRe: /venable|colleen/i,
      tier: "flag_review",
      detail: bookNote("Katie the Catsitter (Colleen A.F. Venable, graphic novels)", [
        "LGBTQ representation in owner scope.",
        "Characters in tights—preview modesty in panels.",
        "Halalit won’t recommend the series.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\blightfall\b|\bgirl and the galdurian\b/i,
      authorRe: /probert|tim/i,
      tier: "flag_review",
      detail: bookNote("Lightfall (Tim Probert, graphic novels)", [
        "Plot reads clean in owner scope.",
        "Brief immodest outfit image—not worn by a character in owner scope, but preview panels.",
        "Halalit won’t auto-recommend.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bmagisterium\b|\biron trial\b|\bcopper gauntlet\b|\bbronze key\b|\bsilver mask\b|\bgolden boy\b/i,
      authorRe: /black|holly|clare|cassandra/i,
      tier: "flag_review",
      detail: bookNote("Magisterium (Holly Black & Cassandra Clare)", [
        "Reads largely clean but dark with okayed manipulation in owner scope.",
        "Parent discretion—Halalit won’t auto-recommend.",
      ], "Won’t Book Quest—parent discretion."),
    },
    {
      titleRe: /\bmarch:\s*book\b|\bmarch\b.*\bthree crowns\b/i,
      authorRe: /lewis|john/i,
      tier: "flag_review",
      detail: bookNote("March (John Lewis, graphic memoir)", [
        "Includes nakedness and adult scenes (drawn as mice)—not Halalit’s all-ages shelf.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\bmary poppins\b/i,
      authorRe: /travers|p\.?\s*l/i,
      tier: "flag_review",
      detail: bookNote("Mary Poppins (P.L. Travers)", [
        "Book 1 largely clean; brief see-through child-clothing moment.",
        "Book 2: mythology about Prophet Nuh (a) and his daughters—deity/religious comfort note.",
        "Rest of series not owner-vetted—Halalit won’t auto-recommend.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: /\bmaus\b/i,
      authorRe: /spiegelman|art/i,
      tier: "flag_review",
      detail: bookNote("Maus (Art Spiegelman)", [
        "Firm no for now—Halalit won’t recommend.",
        "Holocaust memoir—dark throughout.",
        "Nudity and adult scenes even in animal metaphor art.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
      ]),
    },
    {
      titleRe: /\bqueenie peavy\b/i,
      authorRe: /burch|robert/i,
      tier: "flag_review",
      detail: bookNote("Queenie Peavy (Robert Burch)", [
        "Mostly fine in owner scope—the protagonist and best friend smoke at one point and it isn’t called out.",
        "Halalit can’t call this fully clean—parents should decide.",
      ], "Won’t Book Quest—not inappropriate."),
    },
    {
      titleRe: HUDA_F_GRAPHIC_TITLE_RE,
      authorRe: /fahmy|huda\s*fahmy/i,
      tier: "flag_review",
      detail: HUDA_F_GRAPHIC_DETAIL,
    },
  ];

  /** Advisory only — does not block the family shelf (unlike flag_review entries above). */
  var FAMILY_PORTRAYAL_NOTES = [
    {
      titleRe: /\bsmile\b/i,
      authorRe: /telgemeier|raina/i,
      detail: bookNote("Smile (Raina Telgemeier)", [
        "Schoolyard pantsing played for laughs—the victim is wearing pants under the skirt, but still preview.",
        GRAPHIC_PHYSICAL_IMMODESTY_NOTE,
        "Advisory only—Halalit still requires a graphic-novel hand-check before auto-recommend.",
      ]),
    },
    {
      titleRe: /\bfresh start\b/i,
      authorRe: /galligan/i,
      detail: bookNote("Fresh Start (Gale Galligan)", [
        "Otherwise mild middle-grade fiction.",
        "Parents and siblings often hostile, unfair, or emotionally unsafe—home as the main wound.",
        "Advisory only—not a romance or teen ban; preview if family-as-antagonist bothers you.",
      ]),
    },
    {
      titleRe: GRACE_LIN_FOLKLORE_TRILOGY_TITLE_RE,
      detail: bookNote("Grace Lin folklore trilogy — family tone", [
        "Parents and relatives often unfair, cold, or emotionally unsafe—not only imperfect-family friction.",
        "No physical abuse; main plot is otherwise clean middle-grade fantasy.",
        "Preview if sustained family-as-wound bothers you.",
      ]),
    },
    {
      titleRe: /\bwonder\s*light\b|\bunicorns of the mist\b/i,
      authorRe: /russell|r\.?\s*r/i,
      detail: bookNote("Wonder Light / Unicorns of the Mist (R.R. Russell)", [
        "Some family negativity in owner scope—not only imperfect-family friction.",
        "Preview if sustained family-as-wound bothers you.",
      ]),
    },
    {
      titleRe: /\bcity of fire\b|\bcity of ice\b|\bcity of death\b|\bcity trilogy\b/i,
      authorRe: /yep|laurence/i,
      detail: bookNote("City Trilogy (Laurence Yep) — family tone", [
        "Parent negativity toward mostly absent biological family—not only imperfect-family friction.",
        "Otherwise largely clean middle-grade fantasy in owner scope.",
        "Preview if sustained family-as-wound bothers you.",
      ]),
    },
    {
      titleRe: /\brose legacy\b|\bqueen'?s secret\b|\brider'?s reign\b/i,
      authorRe: /george|jessica/i,
      detail: bookNote("The Rose Legacy (Jessica Day George) — family tone", [
        "Mother cast as irredeemable villain—not merely annoying family friction.",
        "Otherwise hand-verified clean across the trilogy.",
      ]),
    },
    {
      titleRe: /\btrials of morrigan crow\b|\bnevermoor:\s*the trials of morrigan crow\b/i,
      authorRe: /townsend|jessica/i,
      detail: bookNote("Nevermoor: The Trials of Morrigan Crow (Jessica Townsend, book 1) — family tone", [
        "Very negative family portrayal—not merely annoying family friction.",
        "Otherwise hand-verified clean in owner scope—book 1 only; rest of series flagged separately.",
      ]),
    },
    {
      titleRe: /\bamina'?s voice\b|\bamina'?s song\b|\bamina'?s picture\b/i,
      authorRe: /khan|hena\s*khan/i,
      detail: bookNote("Amina's Voice / Amina's Song (Hena Khan) — family tone", [
        "Negative family portrayal—parents clash with other parents over religious strictness; other families read as hostile or unfair toward stricter Muslim homes—not only everyday friction.",
        "Book 2 (Amina's Song): older brother's smoking addiction in owner scope.",
        "Plot largely clean otherwise in owner scope—Halalit won't Book Quest this line; preview before you share.",
      ]),
    },
  ];

  var FAMILY_PORTRAYAL_LABEL = "Family is portrayed negatively";

  /** Advisory only — stereotyping/shallow representation, not group demonization (see shelf-themes cultural_stereotype). */
  var CULTURAL_REPRESENTATION_NOTES = [
    {
      titleRe: /\bsatoko and nada\b|\bsatoko to nada\b|\bsatoko & nada\b/i,
      authorRe: /yupechika/i,
      detail: bookNote("Satoko and Nada (Yupechika) — cultural representation", [
        "Cross-cultural college roommates (Japan / Saudi Muslim)—owner scope flags shallow or inaccurate beats at times.",
        "Faith and cultural customs deserve a parent preview—not group demonization, but cultural misrepresentation notes still apply.",
        "Parent-discretion series—exclude cultural misrepresentation in Advanced recommendations settings if needed.",
      ]),
    },
    {
      titleRe: /\bamina'?s voice\b|\bamina'?s song\b|\bamina'?s picture\b/i,
      authorRe: /khan|hena\s*khan/i,
      detail: bookNote("Amina's Voice / Amina's Song (Hena Khan) — cultural representation", [
        "Muslim-American community story—plot largely clean in owner scope, but not a Halalit verified-clean or Book Quest pick.",
        "Parents vs parents clash over families being too religiously strict—reads as partial culture misrepresentation in owner scope.",
        "Halalit won't suggest this line in Book Quest; preview before you share.",
      ]),
    },
    {
      titleRe:
        /\branger'?s apprentice\b|\bruins of gorlan\b|\bburning bridge\b|\bicebound land\b|\bbattle for skandia\b|\bsorcerer in the north\b|\bsiege of macindaw\b|\bkings of clonmel\b|\bhalt'?s peril\b|\bempire of nihon-ja\b|\blost stories\b|\broyal ranger\b/i,
      authorRe: /flanagan|john/i,
      detail: bookNote("Ranger's Apprentice (John Flanagan) — cultural misrepresentation", [
        "Some cultural misrepresentation or shallow portrayals of some peoples.",
        "Does not demonize an entire race, religion, or ethnicity, and does not portray anyone as less intelligent for having a different culture.",
        "Preview if those portrayals matter to your readers—not a blanket family-shelf ban.",
      ]),
    },
    {
      titleRe:
        /\bwundersmith\b|\bthe calling of morrigan crow\b|\bhollowpox\b|\bthe hunt for morrigan crow\b|\bsilverborn\b|\bgingerbread\b.*\bmorrigan crow\b/i,
      authorRe: /townsend|jessica/i,
      detail: bookNote("Nevermoor (Jessica Townsend, books 2+) — cultural misrepresentation", [
        "Israfel angel beat—misrepresentation of Muslim beliefs in owner scope.",
        "Books 2+ also add LGBTQ storylines that increase through the rest of the series.",
        "Book 1 (The Trials of Morrigan Crow) is hand-verified clean separately—preview these volumes before sharing.",
      ]),
    },
  ];

  var CULTURAL_REPRESENTATION_LABEL = "Cultural misrepresentation";

  /**
   * Hand-verified clean but pro-colonial / dated portrayals—Bookcheck caution; not the won't-recommend list.
   * @type {Array<{titleRe: RegExp, authorRe?: RegExp, detail: string}>}
   */
  var PRO_COLONIAL_CAUTION_NOTES = [
    {
      titleRe: LITTLE_HOUSE_SERIES_TITLE_RE,
      authorRe: /wilder|laura\s*ingalls/i,
      detail: bookNote("Little House books (Laura Ingalls Wilder)", [
        "Hand-verified clean on Halalit's core content rules.",
        "If reading this series, keep in mind the pro-colonial narrative—especially portrayals of Native Americans, with scattered dated portrayals of African Americans.",
        "Halalit won't suggest it in Book Quest; you can still look it up here before you share.",
      ]),
    },
    {
      titleRe: /\ba little princess\b|\blittle princess\b/i,
      authorRe: /burnett/i,
      detail: bookNote("A Little Princess (Frances Hodgson Burnett)", [
        "Parent discretion—pro-colonial narrative flag still applies.",
        "Imperial or colonial framing treated as natural or good—preview before you share.",
      ]),
    },
    {
      titleRe: /\bthe secret garden\b|\bsecret garden\b/i,
      authorRe: /burnett/i,
      detail: bookNote("The Secret Garden (Frances Hodgson Burnett)", [
        "Parent discretion—pro-colonial narrative flag still applies.",
        "Imperial or colonial framing treated as natural or good—preview before you share.",
      ]),
    },
  ];

  var PRO_COLONIAL_CAUTION_LABEL = "Pro-colonial narrative (read with care)";

  /**
   * Advisory only — on-page Christian faith or gratitude in realistic classics; not fantasy deity/mythology.
   * Suppresses generic catalog deity-comfort on the same hand-checked title.
   */
  var FAITH_IN_STORY_NOTES = [
    {
      titleRe: /\bheidi\b/i,
      authorRe: /spyri|johanna/i,
      detail: bookNote("Heidi (Johanna Spyri) — faith in the story", [
        "Christian gratitude, prayer, and church life in the classic text (Alm-Uncle’s return to faith, Clara’s household, and similar beats).",
        "Not fantasy gods, mythology treated as real, or a worship-Jesus deity plot—the separate deity/mythology comfort note is for that kind of beat.",
        "Halalit still recommends; preview if your family skips on-page Christian faith in otherwise clean stories.",
      ]),
    },
  ];

  var FAITH_IN_STORY_LABEL = "Christian faith in the story (not deity/mythology)";

  /**
   * Advisory only — kid-facing books with a beat parents may want to preview first (not a hard ban).
   * @type {Array<{titleRe: RegExp, authorRe?: RegExp, detail: string}>}
   */
  var PARENT_NOTES = [
    {
      titleRe: /\bwonder\b/i,
      authorRe: /palacio|r\.?\s*j\.?\s*palacio/i,
      detail: bookNote("Wonder (R.J. Palacio) — notes for parents", [
        "Passing mention or two: the father was married to his first wife, had a relationship with another unmarried woman, and when her baby was on the way was about to marry her.",
        "Owner unsure how much younger kids will catch the meaning—preview that beat if your readers are young.",
        "This family-situation beat is why Halalit parks it off Book Quest—not the gross humor or jokey “boyfriend” insult (those are flagged separately in the hand note).",
        "Hand-verified mostly clean otherwise—not a won’t-recommend flag.",
      ]),
    },
  ];

  var PARENT_NOTE_LABEL = "Notes for parents";

  /**
   * Book Quest — prose originals you’ve hand-vetted that also have graphic novel remakes.
   * Site line means the original book; remakes aren’t always as modest (outfit panels, etc.).
   * Skip when the looked-up / recommended title is already a graphic/comic edition.
   */
  var PROSE_GRAPHIC_ADAPTATION_SITE_LINE =
    "This pick is the original book. A graphic novel remake of the same story isn’t always as modest — preview that edition separately if that’s what you’re getting.";

  var PROSE_WITH_GRAPHIC_ADAPTATION = [
    { titleRe: /\banne of green gables\b/i },
    { titleRe: /\bto kill a mockingbird\b/i },
    { titleRe: /\benola holmes\b/i },
    { titleRe: /\bcupcake diaries\b/i },
    { titleRe: /\bsweet valley twins\b/i },
    { titleRe: /\bbaby[- ]?sitters? club\b/i },
    { titleRe: /\bcharlotte'?s web\b/i },
    { titleRe: /\ba wrinkle in time\b/i },
    { titleRe: /\bthe hobbit\b/i },
  ];

  var GRAPHIC_EDITION_TITLE_RE = /\bgraphic\b|\bcomic\b|\bmanga\b/i;

  /**
   * @param {string} title
   * @param {string} [author]
   * @returns {{ label: string, detail: string, siteLine: string }|null}
   */
  function proseGraphicAdaptationMatch(title, author) {
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    if (GRAPHIC_EDITION_TITLE_RE.test(tl)) return null;
    for (var i = 0; i < PROSE_WITH_GRAPHIC_ADAPTATION.length; i++) {
      var w = PROSE_WITH_GRAPHIC_ADAPTATION[i];
      if (!w.titleRe.test(tl)) continue;
      if (w.authorRe && al && !w.authorRe.test(al)) continue;
      return {
        label: "Original book vs graphic remake",
        detail: PROSE_GRAPHIC_ADAPTATION_SITE_LINE,
        siteLine: PROSE_GRAPHIC_ADAPTATION_SITE_LINE,
      };
    }
    return null;
  }

  /**
   * Advisory only — this title is clean; same author’s other books may not be (shown as WARNING in Bookcheck).
   */
  var AUTHOR_OTHER_WORKS_NOTES = [
    {
      titleRe: /\bthe dragon'?s eye\b/i,
      authorRe: /chadda|sarwat\s*chadda|khan|joshua\s*khan/i,
      detail: bookNote("WARNING: Sarwat Chadda (pen name Joshua Khan)", [
        "This Spirit Animals volume is hand-verified clean; many of this author's other books are not family-friendly on Halalit.",
        "Shadow Magic trilogy (Joshua Khan pen)—firm no: fantasy magic, illegitimacy-centered plot in a later book, and harmful misrepresentation in naming (Arabic Devil word used for a character).",
        "Devil's Kiss / Dark Goddess—active culture misrepresentation in the title and framing in owner scope.",
        "Ash Mistry, City of the Plague God, Spiritstone Saga, and related lines—preview each title separately; no blanket clean call.",
      ]),
    },
  ];

  var AUTHOR_OTHER_WORKS_LABEL = "WARNING:";

  function foldAccents(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function norm(s) {
    return foldAccents(String(s || ""))
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * @param {string} title
   * @param {string} author
   * @returns {{ tier: string, detail: string }|null}
   */
  function userDiscretionParkedMatch(title, author) {
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    for (var i = 0; i < USER_DISCRETION_PARKED.length; i++) {
      var e = USER_DISCRETION_PARKED[i];
      if (!e.titleRe.test(tl)) continue;
      if (e.authorRe && al && !e.authorRe.test(al)) continue;
      return {
        tier: "user_discretion",
        detail: e.detail,
        requiresMentalHealthComfortOptIn: !!e.requiresMentalHealthComfortOptIn,
        requiresCulturalMisrepresentationOptIn: !!e.requiresCulturalMisrepresentationOptIn,
      };
    }
    return null;
  }

  function noRecommendKnownFanserviceMatch(title, author) {
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    for (var i = 0; i < NO_RECOMMEND_KNOWN_FANSERVICE.length; i++) {
      var e = NO_RECOMMEND_KNOWN_FANSERVICE[i];
      if (!e.titleRe.test(tl)) continue;
      if (e.authorRe && al && !e.authorRe.test(al)) continue;
      return { tier: "flag_review", detail: e.detail };
    }
    return null;
  }

  function graphicFanserviceCautionMatch(title, author) {
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    for (var i = 0; i < FANSERVICE_CAUTION_GRAPHIC.length; i++) {
      var e = FANSERVICE_CAUTION_GRAPHIC[i];
      if (!e.titleRe.test(tl)) continue;
      if (e.authorRe && al && !e.authorRe.test(al)) continue;
      return { tier: "fanservice_caution", detail: e.detail };
    }
    return null;
  }

  /** Shelf titles/authors that show the reader already seeks Islamic literature. */
  var ISLAMIC_LITERATURE_INTEREST_TITLE_RE =
    /\b(green deen|that can be arranged|ameena'?s ramadan|ramadan diary|muslim love story|islamic literature|islamic fiction|islamic |muslim |ramadan |eid al|eid mubarak|hijab|hijabi|mosque|quran|inshallah|salaam|prophet muhammad|life of muhammad|\bdeen\b)/i;

  var ISLAMIC_LITERATURE_INTEREST_AUTHOR_RE =
    /abdul-?matin|ibrahim abdul|fahmy|huda\s*f|kabil|sara\s*kabil|faruqi|reem\s*faruqi|saadia|asma\s*hussein|ruqaya|s\.?\s*k\.?\s*ali|aisha\s*saeed/i;

  /**
   * @param {string} title
   * @param {string} author
   * @returns {boolean}
   */
  function readerTitleSignalsIslamicLiteratureInterest(title, author) {
    var tl = norm(title);
    var al = norm(author);
    var blob = (tl + " " + al).trim();
    if (!blob) return false;
    if (ISLAMIC_LITERATURE_INTEREST_TITLE_RE.test(blob)) return true;
    if (al && ISLAMIC_LITERATURE_INTEREST_AUTHOR_RE.test(al)) return true;
    return false;
  }

  function verifiedCleanMatch(title, author) {
    if (noRecommendKnownFanserviceMatch(title, author)) return null;
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    if (/\bbabymouse\b/i.test(tl) && /\bbeach babe\b/i.test(tl)) return null;
    for (var i = 0; i < VERIFIED_CLEAN.length; i++) {
      var e = VERIFIED_CLEAN[i];
      if (!e.titleRe.test(tl)) continue;
      if (e.authorRe && al && !e.authorRe.test(al)) continue;
      return {
        tier: "verified_clean",
        detail: e.detail,
        requiresIslamicLiteratureInterest: !!e.requiresIslamicLiteratureInterest,
        requiresLightRomanceOptIn: !!e.requiresLightRomanceOptIn,
        requiresDeityMythologyOptIn: !!e.requiresDeityMythologyOptIn,
        requiresMagicOptIn: !!e.requiresMagicOptIn,
        requiresSubstanceOptIn: !!e.requiresSubstanceOptIn,
        requiresCulturalMisrepresentationOptIn: !!e.requiresCulturalMisrepresentationOptIn,
        requiresMentalHealthComfortOptIn: !!e.requiresMentalHealthComfortOptIn,
        negativeFamilyPortrayal: !!e.negativeFamilyPortrayal,
        excludesBookQuest: !!e.excludesBookQuest,
        ownerAiThemeAbsent: e.ownerAiThemeAbsent || null,
      };
    }
    return null;
  }

  function proColonialCautionMatch(title, author) {
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    for (var i = 0; i < PRO_COLONIAL_CAUTION_NOTES.length; i++) {
      var w = PRO_COLONIAL_CAUTION_NOTES[i];
      if (!w.titleRe.test(tl)) continue;
      if (w.authorRe && al && !w.authorRe.test(al)) continue;
      return { label: PRO_COLONIAL_CAUTION_LABEL, detail: w.detail };
    }
    return null;
  }

  function proColonialNoRecommendMatch(title, author) {
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    for (var i = 0; i < PRO_COLONIAL_NO_RECOMMEND.length; i++) {
      var e = PRO_COLONIAL_NO_RECOMMEND[i];
      if (!e.titleRe.test(tl)) continue;
      if (e.authorRe && al && !e.authorRe.test(al)) continue;
      return { tier: "flag_review", detail: e.detail, proColonial: true };
    }
    return null;
  }

  function proColonialNoRecommendList() {
    var out = [];
    for (var i = 0; i < PRO_COLONIAL_NO_RECOMMEND.length; i++) {
      out.push({
        title: PRO_COLONIAL_NO_RECOMMEND[i].displayTitle,
        author: PRO_COLONIAL_NO_RECOMMEND[i].displayAuthor,
      });
    }
    return out;
  }

  function match(title, author) {
    var parked = userDiscretionParkedMatch(title, author);
    if (parked) return parked;
    var fanservice = noRecommendKnownFanserviceMatch(title, author);
    if (fanservice) return fanservice;
    var proColonial = proColonialNoRecommendMatch(title, author);
    if (proColonial) return proColonial;
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    for (var i = 0; i < WARNINGS.length; i++) {
      var w = WARNINGS[i];
      if (!w.titleRe.test(tl)) continue;
      if (w.authorRe && al && !w.authorRe.test(al)) continue;
      return { tier: w.tier, detail: w.detail, agentFlag: !!w.agentFlag };
    }
    return null;
  }

  /**
   * @param {string} title
   * @param {string} author
   * @returns {{ tier: string, detail: string }|null}
   */
  function deityComfortMatch(title, author) {
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    for (var i = 0; i < DEITY_COMFORT.length; i++) {
      var e = DEITY_COMFORT[i];
      if (!e.titleRe.test(tl)) continue;
      if (e.authorRe && al && !e.authorRe.test(al)) continue;
      return { tier: "deity_comfort", detail: e.detail || DEITY_COMFORT_DETAIL };
    }
    return null;
  }

  /**
   * @param {string} title
   * @param {string} author
   * @returns {{ label: string, detail: string }|null}
   */
  function familyPortrayalMatch(title, author) {
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    for (var i = 0; i < FAMILY_PORTRAYAL_NOTES.length; i++) {
      var w = FAMILY_PORTRAYAL_NOTES[i];
      if (!w.titleRe.test(tl)) continue;
      if (w.authorRe && al && !w.authorRe.test(al)) continue;
      return { label: FAMILY_PORTRAYAL_LABEL, detail: w.detail };
    }
    return null;
  }

  function culturalRepresentationMatch(title, author) {
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    for (var i = 0; i < CULTURAL_REPRESENTATION_NOTES.length; i++) {
      var w = CULTURAL_REPRESENTATION_NOTES[i];
      if (!w.titleRe.test(tl)) continue;
      if (w.authorRe && al && !w.authorRe.test(al)) continue;
      return { label: CULTURAL_REPRESENTATION_LABEL, detail: w.detail };
    }
    return null;
  }

  function faithInStoryMatch(title, author) {
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    for (var i = 0; i < FAITH_IN_STORY_NOTES.length; i++) {
      var w = FAITH_IN_STORY_NOTES[i];
      if (!w.titleRe.test(tl)) continue;
      if (w.authorRe && al && !w.authorRe.test(al)) continue;
      return { label: FAITH_IN_STORY_LABEL, detail: w.detail };
    }
    return null;
  }

  function parentNoteMatch(title, author) {
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    for (var i = 0; i < PARENT_NOTES.length; i++) {
      var w = PARENT_NOTES[i];
      if (!w.titleRe.test(tl)) continue;
      if (w.authorRe && al && !w.authorRe.test(al)) continue;
      return { label: PARENT_NOTE_LABEL, detail: w.detail };
    }
    return null;
  }

  function authorOtherWorksMatch(title, author) {
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    for (var i = 0; i < AUTHOR_OTHER_WORKS_NOTES.length; i++) {
      var w = AUTHOR_OTHER_WORKS_NOTES[i];
      if (!w.titleRe.test(tl)) continue;
      if (w.authorRe && al && !w.authorRe.test(al)) continue;
      return { label: AUTHOR_OTHER_WORKS_LABEL, detail: w.detail };
    }
    return null;
  }

  /** Bullets/closings that mean family or community strain—not a hard shelf ban on its own. */
  var FAMILY_COMMUNITY_TONE_SIGNAL_RE =
    /family negativity|parent negativity|extended-family negativity|family-bash|community-bash|family-as-wound|imperfect-family|family tone|family-or-community|mosque\/social crowd|extended-family|divorced absent father|family is portrayed negatively/i;

  /** Other concerns in the same note—family opt-in must not override these. */
  var FAMILY_COMMUNITY_TONE_HARD_BLOCK_RE =
    /\blgbtq\b|two dads|same[- ]sex|illegitim|born out of wedlock|explicit insult|crude insult|fanservice|not owner-vetted|rest not owner|series not owner|christian holiday|christian christmas|deity or folklore|deity or mythology|deity-mythology|deity\/mythology|addiction|rehab|stockholm|won't recommend the series|won't recommend the line|won't recommend book|magic misfits|legal tone|underwear on a flagpole|dark classic|plot turns dark|bully uses|book \d+ not|book \d+ got|book \d+:|author notes lgbtq|wine in all three|graphic novels and comics often|jealous-girl dating|starclan|hindu mythology|individual books not owner|scary for sensitive/i;

  /** Book Quest pick titles that imply fantasy magic in the name. */
  var FANTASY_MAGIC_TITLE_RE =
    /\bmagic\b|\bwizard|\bwitch|\bspell|\bsorcery|\benchant|\bfablehaven|\bhobbit|\blord of the rings\b|\bfellowship of the ring\b|\bthe two towers\b|\breturn of the king\b|\bwardrobe|\boverlander|\bdrank the moon|\bprince of nowhere|\bpoison apple|\btuck everlasting|\bwrinkle in time|\bvampire|\beragon|\bunicorn chronicles|\bunicorn quest|\bspirit animals|\bprydain|\bharry potter|\bnevermoor|\bgregor the\b|\bschool for good and evil\b/i;

  /**
   * @param {string} title
   * @returns {boolean}
   */
  function titleSuggestsFantasyMagic(title) {
    var tl = norm(title);
    if (!tl) return false;
    return FANTASY_MAGIC_TITLE_RE.test(tl);
  }

  /** Bullets that mean fantasy magic—not a hard Book Quest ban when the reader opts in. */
  var MAGIC_SIGNAL_RE =
    /fantasy magic|\bmagic\b|\bwizard|\bwitch|\bspell|\bsorcery|\benchant|\bdark-magic|\bfantasy\b.*\bclean|\bhand-checked clean.*\bfantasy/i;

  /** Magic opt-in must not override these. */
  var MAGIC_HARD_BLOCK_RE =
    /\blgbtq\b|won't recommend|not owner-vetted|illegitim|born out of wedlock|fanservice|dark classic|plot turns dark|explicit insult|addiction|rehab|stockholm|book \d+ not|major side character tied to illegitimate/i;

  /** Light alcohol/drug/smoking beats—Starry River / Ranger's Apprentice / Hobbit level, not Haymitch. */
  var SUBSTANCE_LIGHT_SIGNAL_RE =
    /brief alcohol|alcohol mentions|wine mention|feast wine|butterbeer|inn alcohol|drink mentions|old-world feast|legal minor drinking|light dinner wine|frobscottle|currant wine|smoking mention|alcohol normalized|wine in all three|light drug|drug-related mentions|drug beats are called out|about hobbit-level/i;

  /** Substance opt-in must not override heavier mentions (e.g. Haymitch-level addiction). */
  var SUBSTANCE_HARD_BLOCK_RE =
    /addiction|rehab|drunkard|glamorized|serious positivity toward alcohol|major side character with alcohol problems|gets very drunk|bar scene with drinking|smoking addiction|alcohol addiction|won't recommend|morphine beat|drugs shown|illegitim|born out of wedlock|crude humor/i;

  /**
   * Hand-checked deity-comfort detail with light substance only (e.g. Grace Lin wine).
   * @param {string} title
   * @param {string} author
   * @returns {boolean}
   */
  function curatedDetailSubstanceOptIn(title, author) {
    var dc = deityComfortMatch(title, author);
    if (!dc || !dc.detail) return false;
    var d = String(dc.detail);
    if (!SUBSTANCE_LIGHT_SIGNAL_RE.test(d)) return false;
    if (SUBSTANCE_HARD_BLOCK_RE.test(d)) return false;
    return true;
  }

  /**
   * Book Quest: when the reader has not excluded negative family portrayal, allow curated picks
   * blocked only for sustained parent/guardian negativity—not everyday family arguments.
   * @param {string} _title
   * @param {string} _author
   * @param {{ tier?: string, detail?: string }|null} warning
   * @returns {boolean}
   */
  function bookQuestFamilyCommunityToneUnblocks(_title, _author, warning) {
    if (!warning || !warning.detail) return false;
    var d = String(warning.detail);
    if (/family-tone note/i.test(d)) return true;
    if (!FAMILY_COMMUNITY_TONE_SIGNAL_RE.test(d)) return false;
    if (FAMILY_COMMUNITY_TONE_HARD_BLOCK_RE.test(d)) return false;
    return true;
  }

  var NEGATIVE_FAMILY_PORTRAYAL_DETAIL_RE =
    /hostile|unfair|emotionally unsafe|family-as-wound|family-as-antagonist|sustained family-as-wound|irredeemable villain|cast as (?:an )?(?:irredeemable )?villain|portrayed as (?:an )?(?:irredeemable )?villain|(?:parent|mother|father|guardian).{0,40}(?:villain|antagonist|irredeemable)|(?:villain|antagonist|irredeemable).{0,40}(?:parent|mother|father|guardian)/i;

  /**
   * Book Quest: advisory or verified-clean notes with villainized or unfair parents/guardians.
   * Annoying-family friction alone does not count.
   * @param {string} title
   * @param {string} author
   * @returns {{ label: string, detail: string }|null}
   */
  function bookQuestNegativeFamilyPortrayalMatch(title, author) {
    var vc = verifiedCleanMatch(title, author);
    if (vc && vc.negativeFamilyPortrayal) {
      return { label: FAMILY_PORTRAYAL_LABEL, detail: vc.detail };
    }
    var fp = familyPortrayalMatch(title, author);
    if (fp && fp.detail && NEGATIVE_FAMILY_PORTRAYAL_DETAIL_RE.test(String(fp.detail))) return fp;
    return null;
  }

  /** Light crush / dating / prom beats—not adult, dark, or LGBTQ romance. */
  var LIGHT_ROMANCE_SIGNAL_RE =
    /light romance|light dating|dating romance|romance hints|romance threads|romance beat|crush|crushes|\bprom\b|kissing\/hugging|clean romance/i;

  var LIGHT_ROMANCE_HARD_BLOCK_RE =
    /\blgbtq\b|same[- ]sex|two dads|two moms|adult romance|erotic|dark romance|sexual tension|illegitim|won't recommend|won't auto-recommend|not owner-vetted|rest not owner|series not owner|author notes lgbtq|stockholm|jealous-girl dating gets weird/i;

  /**
   * Book Quest: hand-checked flag_review entries blocked only for light romance—opt-in on play page.
   * @param {string} _title
   * @param {string} _author
   * @param {{ tier?: string, detail?: string }|null} warning
   * @returns {boolean}
   */
  function bookQuestLightRomanceUnblocks(_title, _author, warning) {
    if (!warning || warning.tier !== "flag_review" || !warning.detail) return false;
    var d = String(warning.detail);
    if (/romance note/i.test(d) && /may auto-recommend with romance/i.test(d)) return true;
    if (!LIGHT_ROMANCE_SIGNAL_RE.test(d)) return false;
    if (LIGHT_ROMANCE_HARD_BLOCK_RE.test(d)) return false;
    return true;
  }

  /**
   * Book Quest: when the reader opts in, allow curated picks blocked only for fantasy magic.
   * @param {string} _title
   * @param {string} _author
   * @param {{ tier?: string, detail?: string }|null} warning
   * @returns {boolean}
   */
  function bookQuestMagicUnblocks(_title, _author, warning) {
    if (!warning || !warning.detail) return false;
    var d = String(warning.detail);
    if (/magic note/i.test(d) && /may auto-recommend with magic/i.test(d)) return true;
    if (!MAGIC_SIGNAL_RE.test(d)) return false;
    if (MAGIC_HARD_BLOCK_RE.test(d)) return false;
    return true;
  }

  /**
   * Book Quest: light alcohol/drug/smoking—Starry River / Ranger's Apprentice level, not Haymitch.
   * @param {string} _title
   * @param {string} _author
   * @param {{ tier?: string, detail?: string }|null} warning
   * @returns {boolean}
   */
  function bookQuestSubstanceUnblocks(_title, _author, warning) {
    if (!warning || !warning.detail) return false;
    var d = String(warning.detail);
    if (/substance note/i.test(d) && /may auto-recommend with alcohol/i.test(d)) return true;
    if (!SUBSTANCE_LIGHT_SIGNAL_RE.test(d)) return false;
    if (SUBSTANCE_HARD_BLOCK_RE.test(d)) return false;
    return true;
  }

  /** Book Quest: hand-checked deity/mythology—opt-in on play page, not a ban. */
  function bookQuestDeityUnblocks(_title, _author, warning) {
    if (!warning || !warning.detail) return false;
    var d = String(warning.detail);
    if (/deity note/i.test(d) && /may auto-recommend with deity/i.test(d)) return true;
    if (!/book quest includes/i.test(d)) return false;
    if (
      !/deity|mythology|folklore|gods treated|spirit realm|christian allegory|christian christmas|hindu mythology|egyptian gods|shinto-style spirits|yomi treated/i.test(
        d
      )
    ) {
      return false;
    }
    if (LIGHT_ROMANCE_HARD_BLOCK_RE.test(d) || SUBSTANCE_HARD_BLOCK_RE.test(d)) return false;
    return true;
  }

  /**
   * Agatha Christie — Hercule Poirot mysteries (parked). Miss Marple / other Christie not included.
   * @param {string} title
   * @param {string} author
   * @returns {boolean}
   */
  function christiePoirotMysteryMatch(title, author) {
    var tl = norm(title);
    var al = norm(author);
    if (!tl || !CHRISTIE_POIROT_TITLE_RE.test(tl)) return false;
    if (al && !/christie|agatha/i.test(al)) return false;
    return true;
  }

  var MENTAL_HEALTH_COMFORT_LABEL = "Mental-health comfort note";

  var MENTAL_HEALTH_SIGNAL_RE =
    /mental[- ]health|mental illness|mental-health weight|dark-mentality|anxiety and stress|suicide-related|mental-health-centered|centers on anxiety/i;

  /**
   * Hand-checked titles with mental-health weight (older-child / teen+ comfort opt-out).
   * @param {string} title
   * @param {string} author
   * @returns {{ label: string, detail: string, tier?: string }|null}
   */
  function mentalHealthComfortMatch(title, author) {
    var vc = verifiedCleanMatch(title, author);
    if (vc && vc.requiresMentalHealthComfortOptIn) {
      return {
        label: MENTAL_HEALTH_COMFORT_LABEL,
        detail:
          "Hand-checked mental-health weight for Older Child / Young Teen and Older Teen / Adult readers—not a ban. Halalit’s Book Quest includes these by default unless you exclude mental-health weight in Advanced recommendations settings.",
        tier: "verified_clean",
      };
    }
    var parked = userDiscretionParkedMatch(title, author);
    if (parked && parked.requiresMentalHealthComfortOptIn) {
      return {
        label: MENTAL_HEALTH_COMFORT_LABEL,
        detail:
          "Hand-checked mental-health weight for Older Child / Young Teen and Older Teen / Adult readers—not a ban. Exclude mental-health weight in Advanced recommendations settings if needed.",
        tier: "user_discretion",
      };
    }
    return null;
  }

  /** Bookcheck advanced filter: which comfort-note categories a line of text matches. */
  function comfortNoteCategories(text) {
    var d = String(text || "");
    if (!d.trim()) return [];
    var cats = [];
    if (
      /deity|mythology|folklore|starclan|mythological|gods treated|spirit realm|christian christmas|hindu mythology|egyptian gods|shinto-style spirits|yomi treated/i.test(
        d
      )
    ) {
      cats.push("deity");
    }
    if (FAMILY_COMMUNITY_TONE_SIGNAL_RE.test(d) && !FAMILY_COMMUNITY_TONE_HARD_BLOCK_RE.test(d)) cats.push("family");
    if (LIGHT_ROMANCE_SIGNAL_RE.test(d) && !LIGHT_ROMANCE_HARD_BLOCK_RE.test(d)) cats.push("romance");
    if (MAGIC_SIGNAL_RE.test(d) && !MAGIC_HARD_BLOCK_RE.test(d)) cats.push("magic");
    if (SUBSTANCE_LIGHT_SIGNAL_RE.test(d) && !SUBSTANCE_HARD_BLOCK_RE.test(d)) cats.push("substance");
    if (
      /cultural misrepresentation|cultural stereotyp|shallow or false representation|culture misrepresentation|misrepresentation of some peoples|partial culture misrepresentation|other-religion representation/i.test(
        d
      ) &&
      !/\bdemonizes an entire race|group-demonization|won't recommend the series|won't recommend the line/i.test(d)
    ) {
      cats.push("cultural");
    }
    if (MENTAL_HEALTH_SIGNAL_RE.test(d) && !/won't recommend mental-health-centered/i.test(d)) cats.push("mental_health");
    return cats;
  }

  global.HalalitCuratedShelfWarnings = {
    match: match,
    proColonialNoRecommendMatch: proColonialNoRecommendMatch,
    proColonialNoRecommendList: proColonialNoRecommendList,
    proColonialNoRecommend: PRO_COLONIAL_NO_RECOMMEND,
    userDiscretionParkedMatch: userDiscretionParkedMatch,
    userDiscretionParked: USER_DISCRETION_PARKED,
    userDiscretionParentWarningClosing: USER_DISCRETION_PARENT_WARNING_CLOSING,
    noRecommendKnownFanserviceMatch: noRecommendKnownFanserviceMatch,
    graphicFanserviceCautionMatch: graphicFanserviceCautionMatch,
    fanserviceNoRecommendClosing: FANSERVICE_NO_RECOMMEND_CLOSING,
    fanserviceCautionClosing: FANSERVICE_CAUTION_CLOSING,
    noRecommendKnownFanservice: NO_RECOMMEND_KNOWN_FANSERVICE,
    fanserviceCautionGraphic: FANSERVICE_CAUTION_GRAPHIC,
    deityComfortDetail: DEITY_COMFORT_DETAIL,
    deityComfortDetailVerified: DEITY_COMFORT_DETAIL_VERIFIED,
    deityComfortLabel: DEITY_COMFORT_LABEL,
    deityComfortMatch: deityComfortMatch,
    verifiedCleanMatch: verifiedCleanMatch,
    warnings: WARNINGS,
    deityComfort: DEITY_COMFORT,
    verifiedClean: VERIFIED_CLEAN,
    familyPortrayalMatch: familyPortrayalMatch,
    familyPortrayalLabel: FAMILY_PORTRAYAL_LABEL,
    familyPortrayalNotes: FAMILY_PORTRAYAL_NOTES,
    culturalRepresentationMatch: culturalRepresentationMatch,
    culturalRepresentationLabel: CULTURAL_REPRESENTATION_LABEL,
    culturalRepresentationNotes: CULTURAL_REPRESENTATION_NOTES,
    proColonialCautionMatch: proColonialCautionMatch,
    proColonialCautionLabel: PRO_COLONIAL_CAUTION_LABEL,
    proColonialCautionNotes: PRO_COLONIAL_CAUTION_NOTES,
    faithInStoryMatch: faithInStoryMatch,
    faithInStoryLabel: FAITH_IN_STORY_LABEL,
    faithInStoryNotes: FAITH_IN_STORY_NOTES,
    parentNoteMatch: parentNoteMatch,
    parentNoteLabel: PARENT_NOTE_LABEL,
    parentNotes: PARENT_NOTES,
    proseGraphicAdaptationMatch: proseGraphicAdaptationMatch,
    proseGraphicAdaptationSiteLine: PROSE_GRAPHIC_ADAPTATION_SITE_LINE,
    proseWithGraphicAdaptation: PROSE_WITH_GRAPHIC_ADAPTATION,
    authorOtherWorksMatch: authorOtherWorksMatch,
    authorOtherWorksLabel: AUTHOR_OTHER_WORKS_LABEL,
    authorOtherWorksNotes: AUTHOR_OTHER_WORKS_NOTES,
    bookQuestFamilyCommunityToneUnblocks: bookQuestFamilyCommunityToneUnblocks,
    bookQuestNegativeFamilyPortrayalMatch: bookQuestNegativeFamilyPortrayalMatch,
    bookQuestLightRomanceUnblocks: bookQuestLightRomanceUnblocks,
    bookQuestMagicUnblocks: bookQuestMagicUnblocks,
    bookQuestDeityUnblocks: bookQuestDeityUnblocks,
    bookQuestSubstanceUnblocks: bookQuestSubstanceUnblocks,
    titleSuggestsFantasyMagic: titleSuggestsFantasyMagic,
    curatedDetailSubstanceOptIn: curatedDetailSubstanceOptIn,
    comfortNoteCategories: comfortNoteCategories,
    mentalHealthComfortLabel: MENTAL_HEALTH_COMFORT_LABEL,
    mentalHealthComfortMatch: mentalHealthComfortMatch,
    christiePoirotMysteryMatch: christiePoirotMysteryMatch,
    readerTitleSignalsIslamicLiteratureInterest: readerTitleSignalsIslamicLiteratureInterest,
  };
})(typeof window !== "undefined" ? window : this);
