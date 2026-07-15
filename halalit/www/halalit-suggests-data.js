/**
 * Halalit Suggests — curated display pool (hand-vetted titles only).
 * Not every VERIFIED_CLEAN regex; owner-seeded themes + series for browse.
 * Age bands match Book Quest: young_child | older_child_young_teen | older_teen_adult
 */
(function (global) {
  var BAND = {
    young_child: "young_child",
    older_child_young_teen: "older_child_young_teen",
    older_teen_adult: "older_teen_adult",
  };

  /** Map hand-vet roster ageBand → Book Quest reader band */
  var ROSTER_TO_QUEST = {
    kids: BAND.young_child,
    older_kids: BAND.older_child_young_teen,
    teens_adults: BAND.older_teen_adult,
  };

  var THEMES = [
    {
      id: "nature",
      name: "Nature & animals",
      blurb: "Wild places, creatures, and Earth-minded reads Halalit trusts.",
      occasion: "earth",
    },
    {
      id: "cozy_family",
      name: "Cozy family",
      blurb: "Warm homes, siblings, and family figures who matter.",
      occasion: "family",
    },
    {
      id: "adventure",
      name: "Adventure",
      blurb: "Quests, mysteries, and bold journeys on the hand-vetted shelf.",
      occasion: null,
    },
    {
      id: "fathers",
      name: "Father figures",
      blurb: "Dads and father-figures at the heart of the story.",
      occasion: "fathers",
    },
    {
      id: "mothers",
      name: "Mother figures",
      blurb: "Moms and mother-figures woven into the tale.",
      occasion: "mothers",
    },
  ];

  /**
   * Series lobby entries. volumes are in reading order (book 1 first).
   * Prefer concrete volume titles when known; umbrella titles OK when that is the roster row.
   */
  var SERIES = [
    {
      id: "ramona",
      name: "Ramona Quimby",
      themeIds: ["cozy_family"],
      volumes: [
        { title: "Beezus and Ramona", author: "Beverly Cleary", ageBand: BAND.young_child },
        { title: "Ramona and Her Father", author: "Beverly Cleary", ageBand: BAND.young_child },
        { title: "Ramona Quimby", author: "Beverly Cleary", ageBand: BAND.young_child },
      ],
    },
    {
      id: "spirit-animals",
      name: "Spirit Animals",
      themeIds: ["adventure", "nature"],
      volumes: [
        { title: "Spirit Animals", author: "Scholastic", ageBand: BAND.older_child_young_teen },
      ],
    },
    {
      id: "fablehaven",
      name: "Fablehaven",
      themeIds: ["adventure"],
      volumes: [
        { title: "Fablehaven", author: "Brandon Mull", ageBand: BAND.older_child_young_teen },
      ],
    },
    {
      id: "prydain",
      name: "Chronicles of Prydain",
      themeIds: ["adventure"],
      volumes: [
        { title: "Chronicles of Prydain", author: "Lloyd Alexander", ageBand: BAND.older_child_young_teen },
      ],
    },
    {
      id: "sisters-grimm",
      name: "The Sisters Grimm",
      themeIds: ["adventure", "cozy_family"],
      volumes: [
        { title: "The Sisters Grimm", author: "Michael Buckley", ageBand: BAND.older_child_young_teen },
      ],
    },
    {
      id: "savvy",
      name: "Savvy (Beaumont)",
      themeIds: ["cozy_family", "fathers"],
      volumes: [
        { title: "Savvy", author: "Ingrid Law", ageBand: BAND.older_child_young_teen },
      ],
    },
    {
      id: "artemis-fowl",
      name: "Artemis Fowl",
      themeIds: ["adventure"],
      volumes: [{ title: "Artemis Fowl", author: "", ageBand: BAND.older_child_young_teen }],
    },
    {
      id: "amulet",
      name: "Amulet",
      themeIds: ["adventure"],
      volumes: [{ title: "Amulet", author: "Kazu Kibuishi", ageBand: BAND.older_teen_adult }],
    },
    {
      id: "wild-rescuers",
      name: "Wild Rescuers",
      themeIds: ["nature", "adventure"],
      volumes: [{ title: "Wild Rescuers", author: "StacyPlays", ageBand: BAND.older_child_young_teen }],
    },
    {
      id: "berenstain",
      name: "Berenstain Bears",
      themeIds: ["cozy_family", "fathers", "mothers", "nature"],
      volumes: [
        { title: "Berenstain Bears", author: "", ageBand: BAND.young_child },
        {
          title: "The Berenstain Bears and the Papa's Day Surprise",
          author: "Stan Berenstain",
          ageBand: BAND.young_child,
        },
      ],
    },
  ];

  /** Standalone (or single-title) cards — not folded into SERIES above */
  var STANDALONES = [
    {
      title: "Fortunately, the Milk",
      author: "Neil Gaiman",
      ageBand: BAND.young_child,
      themeIds: ["fathers", "cozy_family"],
      spotlight: true,
    },
    {
      title: "Charlotte’s Web",
      author: "E. B. White",
      ageBand: BAND.young_child,
      themeIds: ["nature", "cozy_family"],
      spotlight: true,
    },
    {
      title: "The Lorax",
      author: "Dr. Seuss",
      ageBand: BAND.young_child,
      themeIds: ["nature"],
      spotlight: true,
    },
    {
      title: "The Girl Who Drank the Moon",
      author: "Kelly Barnhill",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["mothers", "adventure"],
      spotlight: true,
    },
    {
      title: "Echo Mountain",
      author: "Lauren Wolk",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["mothers", "cozy_family", "nature"],
      spotlight: true,
    },
    {
      title: "To Kill a Mockingbird",
      author: "Harper Lee",
      ageBand: BAND.older_teen_adult,
      themeIds: ["fathers"],
      spotlight: true,
    },
    {
      title: "Snow and Rose",
      author: "Emily Winfield Martin",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["fathers", "cozy_family"],
      spotlight: true,
    },
    {
      title: "Pax",
      author: "Sara Pennypacker",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["nature"],
      spotlight: true,
    },
    {
      title: "The Last Bear",
      author: "Hannah Gold",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["nature"],
      spotlight: true,
    },
    {
      title: "Jinx",
      author: "Sage Blackwood",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["nature", "adventure"],
      spotlight: true,
    },
    {
      title: "Manatee Summer",
      author: "Evan Griffith",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["nature"],
      spotlight: true,
    },
    {
      title: "Spark",
      author: "Sarah Beth Durst",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["nature"],
      spotlight: true,
    },
    {
      title: "Green Deen",
      author: "Ibrahim Abdul-Matin",
      ageBand: BAND.older_teen_adult,
      themeIds: ["nature"],
      spotlight: false,
    },
    {
      title: "Watership Down",
      author: "Richard Adams",
      ageBand: BAND.older_teen_adult,
      themeIds: ["nature", "adventure"],
      spotlight: false,
    },
    {
      title: "The Magic School Bus",
      author: "",
      ageBand: BAND.young_child,
      themeIds: ["nature"],
      spotlight: false,
    },
    {
      title: "Heidi",
      author: "Johanna Spyri",
      ageBand: BAND.young_child,
      themeIds: ["nature", "cozy_family"],
      spotlight: false,
    },
    {
      title: "Happy Happy Clover",
      author: "Sayuri Tatsuyama",
      ageBand: BAND.young_child,
      themeIds: ["nature"],
      spotlight: false,
    },
    {
      title: "The Animal Healer",
      author: "Lauren St John",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["nature"],
      spotlight: false,
    },
    {
      title: "The Grace of Wild Things",
      author: "Heather Fawcett",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["nature"],
      spotlight: false,
    },
    {
      title: "This Changes Everything",
      author: "Naomi Klein",
      ageBand: BAND.older_teen_adult,
      themeIds: ["nature"],
      spotlight: false,
    },
    {
      title: "The Magic Finger",
      author: "Roald Dahl",
      ageBand: BAND.young_child,
      themeIds: ["nature"],
      spotlight: false,
    },
    {
      title: "Seekers of the Wild Realm",
      author: "Alexandra Ott",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["nature", "adventure", "cozy_family"],
      spotlight: false,
    },
    {
      title: "Castle Glower",
      author: "Jessica Day George",
      ageBand: BAND.young_child,
      themeIds: ["cozy_family", "adventure"],
      spotlight: false,
    },
    {
      title: "Piper McCloud",
      author: "Victoria Forester",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["cozy_family", "adventure"],
      spotlight: false,
    },
    {
      title: "Guess How Much I Love You",
      author: "",
      ageBand: BAND.young_child,
      themeIds: ["cozy_family", "mothers", "fathers"],
      spotlight: false,
    },
    {
      title: "Love You Forever",
      author: "",
      ageBand: BAND.young_child,
      themeIds: ["cozy_family", "mothers"],
      spotlight: false,
    },
    {
      title: "Hop on Pop",
      author: "Dr. Seuss",
      ageBand: BAND.young_child,
      themeIds: ["fathers", "cozy_family"],
      spotlight: false,
    },
    {
      title: "Are You My Mother?",
      author: "",
      ageBand: BAND.young_child,
      themeIds: ["mothers", "cozy_family"],
      spotlight: false,
    },
    {
      title: "The Witches",
      author: "Roald Dahl",
      ageBand: BAND.young_child,
      themeIds: ["adventure"],
      spotlight: false,
    },
    {
      title: "Airman",
      author: "Eoin Colfer",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["adventure"],
      spotlight: false,
    },
    {
      title: "Gregor the Overlander",
      author: "Suzanne Collins",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["adventure"],
      spotlight: false,
    },
    {
      title: "Wonder",
      author: "R.J. Palacio",
      ageBand: BAND.older_child_young_teen,
      themeIds: ["cozy_family"],
      spotlight: false,
    },
    {
      title: "Hatchet",
      author: "Gary Paulsen",
      ageBand: BAND.older_teen_adult,
      themeIds: ["adventure", "nature"],
      spotlight: false,
    },
    {
      title: "The Hobbit",
      author: "J. R. R. Tolkien",
      ageBand: BAND.older_teen_adult,
      themeIds: ["adventure"],
      spotlight: false,
    },
    {
      title: "Anne of Green Gables",
      author: "L.M. Montgomery",
      ageBand: BAND.older_teen_adult,
      themeIds: ["cozy_family"],
      spotlight: false,
    },
    {
      title: "Winnie-the-Pooh",
      author: "A. A. Milne",
      ageBand: BAND.young_child,
      themeIds: ["cozy_family"],
      spotlight: false,
    },
    {
      title: "Matilda",
      author: "Roald Dahl",
      ageBand: BAND.young_child,
      themeIds: ["adventure"],
      spotlight: false,
    },
    {
      title: "The BFG",
      author: "Roald Dahl",
      ageBand: BAND.young_child,
      themeIds: ["adventure"],
      spotlight: false,
    },
  ];

  global.HalalitSuggestsData = {
    BAND: BAND,
    ROSTER_TO_QUEST: ROSTER_TO_QUEST,
    THEMES: THEMES,
    SERIES: SERIES,
    STANDALONES: STANDALONES,
    SPOTLIGHT_COUNT: 12,
    SEE_MORE_PAGE: 24,
  };
})(typeof window !== "undefined" ? window : globalThis);
