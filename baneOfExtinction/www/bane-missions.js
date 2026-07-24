/**
 * Bane of Extinction — neighborhood missions.
 * Level 1 = basic scans (elsewhere). Level 2 = signature-sign beginnings.
 * Level 3 = place-meaning / under-the-hood big picture (not tourist postcard facts).
 * No GPS. No photo-vs-screen checks. No "found outside" checkbox.
 */
(function () {
  "use strict";

  var UNLOCK_FINDS = 15;
  var L3_NEED_L2 = 5;
  var PROGRESS_KEY = "bane_missions_done_v1";
  var PEEK_KEY = "bane_missions_peek_v1";

  /**
   * Level 2 — signature signs anyone can meet (gardens, streets, beaches).
   * No GPS — skip world-geography locks (deserts, mountain ranges, regional specialists).
   * Dropped earlier: squirrel fruit, slug trails, paper nests, oak galls.
   * Swapped off: leafcutter circles, shrike pantry, ice plant, oak-ivy, “plant a native.”
   */
  var QUESTS_L2 = [
    {
      id: "ant-mound",
      level: 2,
      title: "The city under the lawn",
      placeTags: ["suburban", "urban", "city", "woodland"],
      placeHint: "Garden · lawn · park edge",
      blurb: "A living mound — workers on a dirt door. Safe up close; don’t dig.",
      lookFor:
        "A swarm or steady trail of ants pouring into a hole or mound in bare dirt or lawn.",
      story:
        "That mound isn’t clutter. Below it is a working city — tunnels that loosen soil and pull air down where roots drink. Starve that underground traffic, and watering harder won’t save a tired bed.",
      care: "Leave the mound be while you learn it. Skip the spray if you can — you’re looking at soil engineers, not a mess to erase.",
      visual: "ant",
    },
    {
      id: "signature-feather",
      level: 2,
      title: "A feather with a name",
      placeTags: ["suburban", "urban", "city", "coast", "woodland"],
      placeHint: "Any looking-at place",
      blurb: "Only bold, patterned feathers — never plain brown fluff.",
      lookFor:
        "A feather you could match to a field-guide plate: jay blue, cardinal red, mallard flash, large gull gray-white on the shore.",
      story:
        "Most fluff stays “a songbird.” This one doesn’t. Color and shape are a calling card left on the path — a chapter of molt or flight you can read without chasing anyone.",
      care: "Look, don’t pocket nests or disturb birds. A feather on the ground is already a gift.",
      visual: "story",
    },
    {
      id: "woodpecker-work",
      level: 2,
      title: "The hole that keeps giving",
      placeTags: ["suburban", "urban", "city", "woodland"],
      placeHint: "Street trees · park · garden edge",
      blurb: "Neat bark work visible from the path — rows or deeper chips.",
      lookFor:
        "Fresh or older holes in a trunk you can see without leaving the path. Sap wells in neat rows hint sapsucker; bigger chips hint a larger woodpecker.",
      story:
        "That hole isn’t damage for nothing. One bird opens a door; next season someone else may move in. The tree becomes a small apartment building — if it stays standing.",
      care: "Watch from the path. Don’t tap nests or climb for a closer shot.",
      visual: "story",
    },
    {
      id: "leaf-chew",
      level: 2,
      title: "Someone’s been eating here",
      placeTags: ["suburban", "urban", "city", "woodland"],
      placeHint: "Garden · planter · park planting",
      blurb: "Ragged chew edges on a leaf — not neat scissors cuts.",
      lookFor:
        "Leaves with irregular bites or skeletonized patches — caterpillars, beetles, or other small diners, obvious from the path.",
      story:
        "A tidy garden isn’t an empty one. Those ragged edges mean something is turning leaf into energy — the quiet start of a food web right next to the sidewalk.",
      care: "Leave the plant. The chew is the lesson; don’t spray the first hole you see.",
      visual: "story",
    },
    {
      id: "working-web",
      level: 2,
      title: "A web still on the job",
      placeTags: ["suburban", "urban", "city", "coast", "woodland"],
      placeHint: "Garden corners · fences · porch rails · dune grass",
      blurb: "A spider web with dew, prey, or a resident — not yesterday’s shreds only.",
      lookFor:
        "A complete web in a corner, hedge, fence, or grass — dew beads, wrapped prey, or the builder waiting — visible without poking it.",
      story:
        "That silk isn’t decoration. It’s a trap line in the neighborhood economy — insects pause here so birds and lizards have a buffet later.",
      care: "Look, don’t swipe. A working web is a living tool, not clutter.",
      visual: "story",
    },
    {
      id: "wrack-line",
      level: 2,
      title: "The tide’s leftover line",
      placeTags: ["coast"],
      placeHint: "Beach · shore (any coast)",
      blurb: "A strand of seaweed, shells, or drift along the high-water mark.",
      lookFor:
        "A clear wrack line on sand or pebbles — kelp ribbons, shells, wood, or foam — obvious from the dry path without walking fragile dunes.",
      story:
        "The ocean writes a grocery list twice a day. That line feeds shorebirds, crabs, and the tiny lives that start the beach food web — if we leave the buffet where it landed.",
      care: "Stay on firm sand or the path. Don’t rake the wrack “clean” for a postcard beach.",
      visual: "story",
    },
    {
      id: "vine-curtain",
      level: 2,
      title: "The curtain on the trunk",
      placeTags: ["suburban", "urban", "city", "woodland"],
      placeHint: "Garden wall · park tree · fence line",
      blurb: "A climbing vine sleeve on a trunk or fence — clear from the path.",
      lookFor:
        "Ivy, creeper, or other vine blanketing a trunk, wall, or understory — thick enough to notice without leaving the path.",
      story:
        "Vines can shade a wall into a soft habitat — or steal light until the host tree’s own understory thins. Same curtain, different ending, depending how far it runs.",
      care: "Watch from the path. If you manage vines at home, never yank through active nests.",
      visual: "story",
    },
    {
      id: "busy-bloom",
      level: 2,
      title: "A bloom with visitors",
      placeTags: ["suburban", "urban", "city", "coast", "woodland"],
      placeHint: "Garden · park bed · beach path flowers",
      blurb: "A flower already hosting bees, butterflies, or hoverflies — you notice, you don’t plant.",
      lookFor:
        "Any open bloom with a visitor landing or feeding — sidewalk planter, yard, park bed, or path-side flowers — whole scene obvious from where you stand.",
      story:
        "One busy flower won’t save the planet. It still proves the neighborhood has a door open — nectar in, pollinators out, season after season. You’re reading a hub that already exists.",
      care: "Don’t chase or trap the visitor. The win is noticing the traffic, not rearranging someone’s yard.",
      visual: "story",
    },
    {
      id: "leave-it-be",
      level: 2,
      title: "Leave it be",
      placeTags: ["suburban", "urban", "city", "coast", "woodland"],
      placeHint: "Any place",
      blurb: "You found a sign from the path. Log the restraint — that’s the win.",
      lookFor:
        "Any mission sign you already know how to spot — mound, feather, holes, web, wrack, chew — seen from a safe distance.",
      story:
        "The adventure isn’t getting closer. It’s knowing enough to walk on. Quiet wins count.",
      care: "No flash, no dig, no chase. Your reward is still knowing the neighborhood.",
      visual: "story",
    },
    {
      id: "kind-act",
      level: 2,
      title: "One kind act",
      placeTags: ["suburban", "urban", "city", "coast", "woodland"],
      placeHint: "Tied to something you already learned",
      blurb: "A small real-world help for a species or place you know.",
      lookFor:
        "Something you already scanned or a mission you finished — then one gentle action that fits it.",
      story:
        "Skip the spray on that mound. Leave a leaf-litter corner. Leave the wrack line. Don’t swipe the working web. Tiny moves, louder neighborhood over time.",
      care: "No guilt lecture — just one act you control on your block.",
      visual: "story",
    },
  ];

  /**
   * Level 3 — same face, different meaning by place; under-the-hood landscape stories.
   * Beach + garden scale only — not desert / mountain / regional flora checklists.
   */
  var QUESTS_L3 = [
    {
      id: "l3-wrack-meanings",
      level: 3,
      title: "Wrack: three readings",
      placeTags: ["coast", "suburban", "urban", "city"],
      placeHint: "Wild shore vs “cleaned” beach vs inland décor",
      blurb: "Same seaweed strand — healthy buffet, meh tidy-up, or a warning when the line is gone.",
      lookFor:
        "A wrack line of seaweed, shells, or drift — or a beach scraped bare where that line should sit.",
      story:
        "Tourists see mess. The under-the-hood story is whether shore life still gets a twice-daily grocery delivery.",
      care: "Leave wrack where it lands on wild shores. A postcard-smooth beach can be a quieter food web.",
      visual: "meanings",
      meanings: [
        {
          tone: "healthy",
          placeLabel: "Natural high-water line on a working beach",
          text: "Healthy sign. Kelp, shells, and foam feed birds, crabs, and the tiny starters of the shore food web.",
        },
        {
          tone: "meh",
          placeLabel: "A managed swimming beach after light grooming",
          text: "Meh. Some cleanup for people is normal — still leave a strip of wrack if you can; bare sand isn’t automatically “better.”",
        },
        {
          tone: "warning",
          placeLabel: "Shore scraped bare or wrack hauled inland as trash",
          text: "Warning when the buffet is erased daily — shorebirds and beach insects lose the line that kept them fed.",
        },
      ],
    },
    {
      id: "l3-vine-meanings",
      level: 3,
      title: "Vine: curtain or cage?",
      placeTags: ["woodland", "suburban", "urban", "city"],
      placeHint: "Garden wall vs smothered tree",
      blurb: "A climbing vine reads different on a fence than as a sleeve sealing a trunk.",
      lookFor: "Ivy or creeper on a wall, fence, or trunk — from the path only.",
      story:
        "Postcard gardens love a green curtain. Park and garden trees tell a harder story when that curtain seals out light and air.",
      care: "Trim when safe and allowed; never rip through active nests.",
      visual: "meanings",
      meanings: [
        {
          tone: "healthy",
          placeLabel: "Contained on a fence or wall, host tree still open",
          text: "Healthy-enough when the vine is a border, not a full-body sleeve — birds still get cover without choking the trunk.",
        },
        {
          tone: "meh",
          placeLabel: "Decorative climber, watched and cut back",
          text: "Meh if truly managed — still watch for seedlings escaping into hedges and park edges.",
        },
        {
          tone: "warning",
          placeLabel: "Thick sleeve blanketing trunk and understory",
          text: "Warning. Steals light, carpets the floor, and can mean the tree’s own plants are already losing.",
        },
      ],
    },
    {
      id: "l3-bloom-meanings",
      level: 3,
      title: "Bloom: buffet vs décor",
      placeTags: ["suburban", "coast", "urban", "city", "woodland"],
      placeHint: "Busy flower vs pretty-only planting",
      blurb: "An open flower can mean “food for visitors” — or just a pretty costume with no traffic.",
      lookFor: "Any open bloom in sun — with or without insect visitors — from the path.",
      story:
        "Vacation photos love the splash of color. The deeper read is whether anyone is actually eating here.",
      care: "Notice visitors before you judge a bed. Pretty alone isn’t a food-web score.",
      visual: "meanings",
      meanings: [
        {
          tone: "healthy",
          placeLabel: "Bloom with bees, butterflies, or hoverflies landing",
          text: "Healthy sign. Nectar and pollen are moving — the neighborhood door is open.",
        },
        {
          tone: "meh",
          placeLabel: "Showy flower, no visitors in a fair watch",
          text: "Meh. Lovely décor; not proof the local cast can feed here (season, scent, and shape all matter).",
        },
        {
          tone: "warning",
          placeLabel: "Sterile doubles / sprayed beds where nothing lands",
          text: "Warning when beauty is all surface — heavy spray or closed blooms can mean a quiet buffet for pollinators.",
        },
      ],
    },
    {
      id: "l3-street-tree-meanings",
      level: 3,
      title: "Street tree: neighbor or leftover",
      placeTags: ["suburban", "urban", "city", "coast", "woodland"],
      placeHint: "Park · sidewalk · garden edge",
      blurb: "A planted tree can host life — or stand alone with bare ground and no visitors.",
      lookFor: "A street or park tree from the sidewalk — bark, shade, and what’s under it.",
      story:
        "Tourists remember height and shade. The everyday truth is what’s living in the bark, litter, and understory — or what’s missing.",
      care: "Don’t carve bark or dig roots. Read the tree as a small neighborhood, not a lamppost.",
      visual: "meanings",
      meanings: [
        {
          tone: "healthy",
          placeLabel: "Birds, holes, litter life, or underplanting sharing the shade",
          text: "Healthy sign. The tree is hosting someone — apartments in the bark, food in the canopy, or green underfoot.",
        },
        {
          tone: "meh",
          placeLabel: "Lone ornamental over bare mulch or gravel",
          text: "Meh. Shade for people; thin credit for the food web until something else moves in.",
        },
        {
          tone: "warning",
          placeLabel: "Dying, girdled, or sprayed sterile with nothing allowed under it",
          text: "Warning when the tree is only furniture — no litter layer, no visitors, no room for the small lives that stitch a block together.",
        },
      ],
    },
    {
      id: "l3-missing-apex",
      level: 3,
      title: "Missing pieces (under the postcard)",
      placeTags: ["suburban", "urban", "city", "coast", "woodland"],
      placeHint: "Big-picture landscape story",
      blurb: "Why a “pretty” park or shore can still feel empty — the tourist view skips this.",
      lookFor:
        "No close-up needed. Notice a quiet wood, heavy browse, a tidy lawn desert, or a beach with birds but no wrack — then open this card.",
      story:
        "Green hills and clean sand photograph like a vacation dream. Under that polish, a place can be running on empty when the top of the food web — or the daily buffet — was removed. Too many browsers, quieter woods, shorebirds with nowhere to feed. You don’t see that on the tour bus. Same idea anywhere: what’s missing matters as much as what’s cute in the frame.",
      care: "Don’t chase predators or stage encounters. The mission is understanding the system — then supporting the living neighborhood you can actually help (habitat, restraint, not harassing wildlife).",
      visual: "story",
    },
    {
      id: "l3-houseplant-boundary",
      level: 3,
      title: "Houseplant vs wild",
      placeTags: ["suburban", "urban", "city"],
      placeHint: "Indoor sweetheart vs outdoor world",
      blurb: "A philodendron on a sill is fine. “Freed” outdoors is a different story.",
      lookFor: "Sweetheart / heartleaf philodendron indoors — or someone planting tropicals outside.",
      story:
        "Gift-shop green isn’t the same as neighborhood wildlife. Level 3 is noticing the boundary tourists skip: indoor pet plant vs outdoor living web.",
      care: "Keep tropical houseplants indoors. Don’t dump them in parks or creek edges.",
      visual: "meanings",
      meanings: [
        {
          tone: "healthy",
          placeLabel: "On a windowsill (indoors)",
          text: "Fine. It’s a house companion — not a claim about local wild health.",
        },
        {
          tone: "meh",
          placeLabel: "Patio décor, still contained",
          text: "Meh if it never escapes — still zero neighborhood food-web credit.",
        },
        {
          tone: "warning",
          placeLabel: "Dumped or planted into parks / creek edges",
          text: "Warning. Wrong place outdoors; dumping houseplants can seed problems local wild plants didn’t ask for.",
        },
      ],
    },
  ];

  function totalFinds(entries) {
    var n = 0;
    (entries || []).forEach(function (e) {
      n += Math.max(1, Number(e.encounterCount) || 1);
    });
    return n;
  }

  function readDone() {
    if (
      window.BaneCodexCollection &&
      typeof window.BaneCodexCollection.readMissionDone === "function"
    ) {
      return window.BaneCodexCollection.readMissionDone() || {};
    }
    try {
      var raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function writeDone(map) {
    if (
      window.BaneCodexCollection &&
      typeof window.BaneCodexCollection.writeMissionDone === "function"
    ) {
      window.BaneCodexCollection.writeMissionDone(map || {});
      if (window.BaneCodexCollection.schedulePush) {
        window.BaneCodexCollection.schedulePush();
      }
      return;
    }
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(map || {}));
    } catch (e) {}
  }

  function countDoneIn(list) {
    var done = readDone();
    var n = 0;
    (list || []).forEach(function (q) {
      if (done[q.id]) n += 1;
    });
    return n;
  }

  function isPeeking() {
    try {
      return localStorage.getItem(PEEK_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setPeeking(on) {
    try {
      if (on) localStorage.setItem(PEEK_KEY, "1");
      else localStorage.removeItem(PEEK_KEY);
    } catch (e) {}
  }

  function currentHabitat() {
    var lens = globalPlaceLens();
    if (!lens || !lens.activePlace) return "";
    var place = lens.activePlace();
    return (place && place.habitat) || "";
  }

  function globalPlaceLens() {
    return typeof window !== "undefined" ? window.BanePlaceLens : null;
  }

  function questsForHabitat(list, habitat) {
    if (!habitat) return list.slice();
    return list.filter(function (q) {
      return q.placeTags.indexOf(habitat) >= 0;
    });
  }

  function antAliveSvg() {
    return (
      '<svg viewBox="0 0 220 160" role="img" aria-label="Garden with ants and healthy plants">' +
      '<rect width="220" height="160" fill="#14281c"/>' +
      '<rect y="95" width="220" height="65" fill="#3a5c2e"/>' +
      '<ellipse cx="110" cy="108" rx="28" ry="10" fill="#5a4028"/>' +
      '<circle cx="110" cy="100" r="7" fill="#2a1a10"/>' +
      '<g class="leaf-sway">' +
      '<path d="M40 95 C40 70 55 55 70 95 Z" fill="#6bc48a"/>' +
      '<path d="M55 95 C60 75 75 65 85 95 Z" fill="#4fa86c"/>' +
      "</g>" +
      '<g class="leaf-sway" style="animation-delay:-1s">' +
      '<path d="M150 95 C155 68 175 60 185 95 Z" fill="#6bc48a"/>' +
      '<path d="M165 95 C170 78 188 72 195 95 Z" fill="#4fa86c"/>' +
      "</g>" +
      '<circle class="ant-crawl-a" cx="95" cy="104" r="2.2" fill="#1a120c"/>' +
      '<circle class="ant-crawl-b" cx="118" cy="106" r="2" fill="#1a120c"/>' +
      '<circle class="ant-crawl-a" cx="108" cy="112" r="1.8" fill="#1a120c" style="animation-delay:-0.7s"/>' +
      '<circle cx="48" cy="42" r="3" fill="#d4b46a"/>' +
      '<circle cx="170" cy="36" r="2.5" fill="#7ec8d8"/>' +
      '<path d="M48 42 C60 50 70 48 78 40" stroke="#d4b46a" stroke-width="1" fill="none" opacity="0.7"/>' +
      '<text x="12" y="22" fill="#8fa898" font-size="9" font-family="system-ui,sans-serif">birds · bees · green</text>' +
      "</svg>"
    );
  }

  function antBareSvg() {
    return (
      '<svg viewBox="0 0 220 160" role="img" aria-label="Garden without ant helpers">' +
      '<rect width="220" height="160" fill="#1a1512"/>' +
      '<rect y="95" width="220" height="65" fill="#4a3a2a"/>' +
      '<ellipse cx="110" cy="108" rx="22" ry="6" fill="#3a2a1c" opacity="0.5"/>' +
      '<g class="wilt-plant">' +
      '<path d="M50 95 C48 80 42 70 38 95 Z" fill="#8a7a55"/>' +
      '<path d="M62 95 C66 82 70 78 72 95 Z" fill="#7a6a48"/>' +
      "</g>" +
      '<g class="wilt-plant" style="animation-delay:-1.2s">' +
      '<path d="M160 95 C168 78 178 74 182 95 Z" fill="#8a7a55"/>' +
      '<path d="M172 95 C176 84 186 80 190 95 Z" fill="#7a6a48"/>' +
      "</g>" +
      '<rect x="30" y="100" width="160" height="8" fill="#2a2218" opacity="0.45"/>' +
      '<text x="12" y="22" fill="#a89080" font-size="9" font-family="system-ui,sans-serif">quiet · compacted · tired</text>' +
      "</svg>"
    );
  }

  function antCutawaySvg() {
    return (
      '<svg viewBox="0 0 320 200" role="img" aria-label="Anthill cross-section under the lawn">' +
      '<defs>' +
      '<linearGradient id="soilGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#4a6b3a"/>' +
      '<stop offset="18%" stop-color="#5a4028"/>' +
      '<stop offset="100%" stop-color="#2a1a10"/>' +
      "</linearGradient>" +
      "</defs>" +
      '<rect width="320" height="200" fill="#0c1a14"/>' +
      '<rect y="0" width="320" height="48" fill="url(#soilGrad)"/>' +
      '<rect y="48" width="320" height="152" fill="#3d2918"/>' +
      '<ellipse cx="160" cy="42" rx="36" ry="12" fill="#6a4a2a"/>' +
      '<circle cx="160" cy="34" r="6" fill="#1a1008"/>' +
      '<path d="M160 40 C150 70 130 90 125 120" stroke="#1a1008" stroke-width="10" fill="none" stroke-linecap="round"/>' +
      '<path d="M160 55 C175 85 195 100 210 125" stroke="#1a1008" stroke-width="9" fill="none" stroke-linecap="round"/>' +
      '<path d="M145 95 C120 110 100 140 95 165" stroke="#1a1008" stroke-width="8" fill="none" stroke-linecap="round"/>' +
      '<ellipse class="root-glow" cx="125" cy="120" rx="18" ry="12" fill="#241810" stroke="#6bc48a" stroke-width="1.5"/>' +
      '<ellipse class="root-glow" cx="210" cy="125" rx="16" ry="11" fill="#241810" stroke="#6bc48a" stroke-width="1.5" style="animation-delay:-0.8s"/>' +
      '<ellipse class="root-glow" cx="95" cy="165" rx="20" ry="13" fill="#241810" stroke="#d4b46a" stroke-width="1.5" style="animation-delay:-1.4s"/>' +
      '<circle class="ant-crawl-a" cx="148" cy="58" r="2.2" fill="#c4a882"/>' +
      '<circle class="ant-crawl-b" cx="155" cy="78" r="2" fill="#c4a882"/>' +
      '<circle class="ant-crawl-a" cx="132" cy="110" r="2.2" fill="#c4a882" style="animation-delay:-0.5s"/>' +
      '<circle class="ant-crawl-b" cx="200" cy="118" r="2" fill="#c4a882" style="animation-delay:-1s"/>' +
      '<circle class="ant-crawl-a" cx="100" cy="160" r="2.4" fill="#e8c9a0" style="animation-delay:-0.3s"/>' +
      '<path class="root-glow" d="M40 70 C55 90 50 110 45 130" stroke="#6bc48a" stroke-width="2" fill="none" opacity="0.65"/>' +
      '<path class="root-glow" d="M280 65 C265 95 270 120 275 145" stroke="#6bc48a" stroke-width="2" fill="none" opacity="0.65" style="animation-delay:-1s"/>' +
      '<text x="14" y="22" fill="#c8e0d0" font-size="10" font-family="system-ui,sans-serif">lawn</text>' +
      '<text x="118" y="118" fill="#8fa898" font-size="8" font-family="system-ui,sans-serif">brood</text>' +
      '<text x="198" y="124" fill="#8fa898" font-size="8" font-family="system-ui,sans-serif">stores</text>' +
      '<text x="78" y="164" fill="#d4b46a" font-size="8" font-family="system-ui,sans-serif">queen hall</text>' +
      '<text x="14" y="190" fill="#8fa898" font-size="9" font-family="system-ui,sans-serif">Tunnels loosen soil · air reaches roots</text>' +
      "</svg>"
    );
  }

  function antRevealHtml() {
    return (
      '<div class="ant-reveal">' +
      '<p class="ant-reveal__label">Adventure reveal — same block, two futures</p>' +
      '<div class="ant-compare">' +
      '<div class="ant-panel ant-panel--alive">' +
      '<p class="ant-panel__caption">With the mound’s helpers</p>' +
      antAliveSvg() +
      "</div>" +
      '<div class="ant-panel ant-panel--bare">' +
      '<p class="ant-panel__caption">Without them</p>' +
      antBareSvg() +
      "</div>" +
      "</div>" +
      '<div class="ant-cutaway">' +
      '<p class="ant-cutaway__caption">Under the mound — cross-section</p>' +
      antCutawaySvg() +
      "</div>" +
      "</div>"
    );
  }

  function meaningsHtml(meanings) {
    if (!meanings || !meanings.length) return "";
    var bits = [
      '<div class="meaning-stack">',
      '<p class="ant-reveal__label">Same organism · different place meaning</p>',
    ];
    meanings.forEach(function (m) {
      bits.push(
        '<article class="meaning-card meaning-card--' +
          (m.tone || "meh") +
          '">' +
          '<p class="meaning-card__tone"></p>' +
          '<p class="meaning-card__place"></p>' +
          '<p class="meaning-card__text"></p>' +
          "</article>"
      );
    });
    bits.push("</div>");
    var wrap = document.createElement("div");
    wrap.innerHTML = bits.join("");
    var cards = wrap.querySelectorAll(".meaning-card");
    meanings.forEach(function (m, i) {
      var toneLabel =
        m.tone === "healthy" ? "Healthy sign" : m.tone === "warning" ? "Warning" : "Meh";
      cards[i].querySelector(".meaning-card__tone").textContent = toneLabel;
      cards[i].querySelector(".meaning-card__place").textContent = m.placeLabel || "";
      cards[i].querySelector(".meaning-card__text").textContent = m.text || "";
    });
    return wrap.innerHTML;
  }

  function appendQuestCards(grid, list, done) {
    list.forEach(function (q) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mission-card" + (done[q.id] ? " mission-card--done" : "");
      btn.setAttribute("data-mission-id", q.id);
      btn.innerHTML =
        '<p class="mission-card__place"></p>' +
        '<p class="mission-card__title"></p>' +
        '<p class="mission-card__blurb"></p>' +
        '<span class="mission-card__badge"></span>';
      btn.querySelector(".mission-card__place").textContent = q.placeHint;
      btn.querySelector(".mission-card__title").textContent = q.title;
      btn.querySelector(".mission-card__blurb").textContent = q.blurb;
      var badge = btn.querySelector(".mission-card__badge");
      if (done[q.id]) {
        badge.textContent = "Done";
        badge.className = "mission-card__badge mission-card__badge--done";
      } else if (q.level === 3) {
        badge.textContent = q.visual === "meanings" ? "Place meanings" : "Big picture";
      } else if (q.visual === "ant") {
        badge.textContent = "Full visual";
      } else {
        badge.textContent = "Story card";
      }
      btn.addEventListener("click", function () {
        openMission(q);
      });
      grid.appendChild(btn);
    });
  }

  function renderBoard(l2Open, l3Open) {
    var habitat = currentHabitat();
    var done = readDone();
    var board2 = document.getElementById("missionBoard");
    var board3 = document.getElementById("missionBoardL3");
    var grid2 = document.getElementById("missionGrid");
    var grid3 = document.getElementById("missionGridL3");
    var hint2 = document.getElementById("boardHint");
    var hint3 = document.getElementById("boardHintL3");
    var list2 = questsForHabitat(QUESTS_L2, habitat);
    var list3 = questsForHabitat(QUESTS_L3, habitat);

    if (hint2) {
      hint2.textContent = habitat
        ? "Level 2 · habitat " + habitat + " · signature signs only · no dangerous close-ups."
        : "Level 2 · beginning missions · signature signs · pick a looking-at place or browse all.";
    }
    if (hint3) {
      hint3.textContent = habitat
        ? "Level 3 · habitat " +
          habitat +
          " · same face, different meaning · under-the-hood (not tourist postcard)."
        : "Level 3 · place meanings + landscape stories tourists usually miss.";
    }

    if (board2) board2.hidden = !l2Open;
    if (board3) board3.hidden = !l3Open;

    if (grid2) {
      grid2.innerHTML = "";
      if (l2Open) {
        if (!list2.length) {
          grid2.innerHTML =
            '<p class="mission-board__hint">No Level 2 missions for this habitat — try suburban, urban, city, coast, or woodland.</p>';
        } else {
          appendQuestCards(grid2, list2, done);
        }
      }
    }

    if (grid3) {
      grid3.innerHTML = "";
      if (l3Open) {
        if (!list3.length) {
          grid3.innerHTML =
            '<p class="mission-board__hint">No Level 3 missions for this habitat — try another looking-at place.</p>';
        } else {
          appendQuestCards(grid3, list3, done);
        }
      }
    }
  }

  function openMission(q) {
    var dialog = document.getElementById("missionDialog");
    var body = document.getElementById("missionDialogBody");
    if (!dialog || !body) return;

    var done = readDone();
    var visualBlock = "";
    if (q.visual === "ant") visualBlock = antRevealHtml();
    else if (q.visual === "meanings") visualBlock = meaningsHtml(q.meanings);

    body.innerHTML =
      '<p class="mission-story__kicker" id="missionDialogTitle"></p>' +
      '<h3 class="mission-story__title"></h3>' +
      '<p class="note mission-story__distance" role="note"><strong>Don’t get too close.</strong> This quest works from a safe distance or from signs — never crowd animals that can bite, scratch, or surprise you.</p>' +
      '<p class="mission-story__look"><strong>Look for:</strong> <span data-look></span></p>' +
      '<p class="mission-story__body" data-story></p>' +
      '<p class="mission-story__care"><strong>Care:</strong> <span data-care></span></p>' +
      visualBlock +
      '<div class="mission-story__actions">' +
      '<button type="button" class="btn primary" id="missionCompleteBtn"></button>' +
      "</div>";

    var kicker =
      q.level === 3
        ? q.visual === "meanings"
          ? "Level 3 · place meanings"
          : "Level 3 · under the postcard"
        : q.visual === "ant"
          ? "Level 2 · signature sign · visual adventure"
          : "Level 2 · signature sign · story adventure";
    body.querySelector(".mission-story__kicker").textContent = kicker;
    body.querySelector(".mission-story__title").textContent = q.title;
    body.querySelector("[data-look]").textContent = q.lookFor;
    body.querySelector("[data-story]").textContent = q.story;
    body.querySelector("[data-care]").textContent = q.care;

    var completeBtn = body.querySelector("#missionCompleteBtn");
    if (done[q.id]) {
      completeBtn.textContent = "Completed";
      completeBtn.disabled = true;
    } else {
      completeBtn.textContent = "Mark as done";
      completeBtn.addEventListener("click", function () {
        var map = readDone();
        map[q.id] = Date.now();
        writeDone(map);
        completeBtn.textContent = "Completed";
        completeBtn.disabled = true;
        refresh();
      });
    }

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "open");
  }

  function updateUnlockUi(finds, l2Done, l2Open, l3Open) {
    var copy = document.getElementById("unlockCopy");
    var meta = document.getElementById("unlockMeta");
    var fill = document.getElementById("unlockFill");
    var bar = document.getElementById("unlockBar");
    var peekBtn = document.getElementById("peekBtn");
    var l3Meta = document.getElementById("unlockL3Meta");
    var pct = Math.min(100, Math.round((finds / UNLOCK_FINDS) * 100));
    var peek = isPeeking();

    if (fill) fill.style.width = pct + "%";
    if (bar) {
      bar.setAttribute("aria-valuenow", String(Math.min(finds, UNLOCK_FINDS)));
      bar.setAttribute("aria-valuemax", String(UNLOCK_FINDS));
    }

    if (l3Meta) {
      l3Meta.textContent = l3Open
        ? "Level 3 open — place meanings & under-the-hood stories (not tourist postcard facts)."
        : "Level 3 unlocks after " +
          L3_NEED_L2 +
          " Level 2 missions done (" +
          l2Done +
          " / " +
          L3_NEED_L2 +
          ").";
    }

    if (peek) {
      if (copy) {
        copy.textContent =
          "Peek mode (owner beta). Real unlocks: " +
          UNLOCK_FINDS +
          " finds → Level 2; " +
          L3_NEED_L2 +
          " Level 2 missions → Level 3.";
      }
      if (meta) {
        meta.textContent =
          finds +
          " / " +
          UNLOCK_FINDS +
          " finds · Level 2 done " +
          l2Done +
          " / " +
          L3_NEED_L2 +
          ".";
      }
      if (peekBtn) {
        peekBtn.hidden = false;
        peekBtn.textContent = "Exit peek";
      }
      return;
    }

    if (l2Open) {
      if (copy) {
        copy.textContent = l3Open
          ? "Levels 2 and 3 open. Level 1 was scans — now signs, care, and place meanings."
          : "Level 2 open. Finish " +
            L3_NEED_L2 +
            " of these beginning missions to unlock Level 3.";
      }
      if (meta) {
        meta.textContent =
          finds +
          " finds · Level 2 missions done " +
          l2Done +
          " / " +
          L3_NEED_L2 +
          ".";
      }
      if (peekBtn) peekBtn.hidden = true;
      return;
    }

    if (copy) {
      copy.textContent =
        "Level 1 = scans. Level 2 opens after " +
        UNLOCK_FINDS +
        " finds. Level 3 after " +
        L3_NEED_L2 +
        " Level 2 missions.";
    }
    if (meta) meta.textContent = finds + " / " + UNLOCK_FINDS + " finds so far.";
    if (peekBtn) {
      peekBtn.hidden = false;
      peekBtn.textContent = "Peek the boards (owner beta)";
    }
  }

  function refresh() {
    var coll = window.BaneCodexCollection;
    var entries = coll && coll.readAll ? coll.readAll() : [];
    var finds = totalFinds(entries);
    var l2Done = countDoneIn(QUESTS_L2);
    var peek = isPeeking();
    var l2Open = finds >= UNLOCK_FINDS || peek;
    var l3Open = (l2Open && l2Done >= L3_NEED_L2) || peek;
    updateUnlockUi(finds, l2Done, l2Open, l3Open);
    renderBoard(l2Open, l3Open);
  }

  function boot() {
    var lens = globalPlaceLens();
    var root = document.getElementById("placeLensRoot");
    if (lens && lens.renderPlaceLensUi && root) {
      lens.renderPlaceLensUi(root);
    }
    window.addEventListener("bane-place-lens-change", function () {
      refresh();
    });

    var peekBtn = document.getElementById("peekBtn");
    if (peekBtn) {
      peekBtn.addEventListener("click", function () {
        if (isPeeking()) setPeeking(false);
        else setPeeking(true);
        refresh();
      });
    }

    var coll = window.BaneCodexCollection;
    if (coll && coll.syncNow) {
      coll.syncNow().then(refresh).catch(refresh);
    } else {
      refresh();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
