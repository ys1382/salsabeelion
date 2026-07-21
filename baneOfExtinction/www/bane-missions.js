/**
 * Bane of Extinction — neighborhood missions.
 * Level 1 = basic scans (elsewhere). Level 2 = signature-sign beginnings.
 * Level 3 = place-meaning / under-the-hood big picture (not tourist postcard facts).
 * No GPS. No photo-vs-screen checks. No "found outside" checkbox.
 */
(function () {
  "use strict";

  var UNLOCK_FINDS = 15;
  var L3_NEED_L2 = 3;
  var PROGRESS_KEY = "bane_missions_done_v1";
  var PEEK_KEY = "bane_missions_peek_v1";

  /** Level 2 — signature signs. Dropped: squirrel fruit, slug trails, paper nests, oak galls. */
  var QUESTS_L2 = [
    {
      id: "ant-mound",
      level: 2,
      title: "The city under the lawn",
      placeTags: ["garden", "urban", "woodland"],
      placeHint: "Yard · park · woodland edge",
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
      placeTags: ["garden", "urban", "coast", "woodland"],
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
      placeTags: ["garden", "urban", "woodland"],
      placeHint: "Yard · street trees · oak woodland",
      blurb: "Neat bark work visible from the path — rows or deeper chips.",
      lookFor:
        "Fresh or older holes in a trunk you can see without leaving the path. Sap wells in neat rows hint sapsucker; bigger chips hint a larger woodpecker.",
      story:
        "That hole isn’t damage for nothing. One bird opens a door; next season someone else may move in. The tree becomes a small apartment building — if it stays standing.",
      care: "Watch from the path. Don’t tap nests or climb for a closer shot.",
      visual: "story",
    },
    {
      id: "leaf-circles",
      level: 2,
      title: "Perfect circles in a leaf",
      placeTags: ["garden", "urban"],
      placeHint: "Garden · yard · city plantings",
      blurb: "Clean round cuts — leafcutter bee signature.",
      lookFor:
        "Leaves with neat circular or oval bites removed — not ragged chew. Often on roses, lilacs, or soft garden leaves.",
      story:
        "Those circles aren’t vandalism. A leafcutter bee carries the discs home to line a nest. Your garden just funded tiny architecture.",
      care: "Leave the plant. She’s working for blooms you’ll want later.",
      visual: "story",
    },
    {
      id: "shrike-pantry",
      level: 2,
      title: "The butcher’s pantry",
      placeTags: ["garden", "coast", "woodland"],
      placeHint: "Open edges · fences · scrub",
      blurb: "Prey pinned on a thorn or wire — the shrike tell.",
      lookFor:
        "An insect, lizard, or small prey stuck on a fence barb, thorn, or wire — visible from the path.",
      story:
        "Shrikes hunt like falcons and store like butchers. That fence isn’t random; it’s a pantry. A true neighborhood drama — no museum wolves required.",
      care: "Stay back. The pantry is the lesson; the bird doesn’t need an audience.",
      visual: "story",
    },
    {
      id: "ice-plant-carpet",
      level: 2,
      title: "The carpet that crowds the shore",
      placeTags: ["coast"],
      placeHint: "Beach · coast (SoCal coast / shore)",
      blurb: "A thick mat of ice plant you can see from the path.",
      lookFor:
        "A sprawling succulent carpet on dunes or bluffs — often Carpobrotus — obvious without stepping into fragile habitat.",
      story:
        "Ice plant looks soft and finished. Under that shine it can choke out the plants that belong on this coast. One mat today can mean a quieter dune tomorrow.",
      care: "Don’t plant it on wild shorelines. Native dune plants keep more life in the long run.",
      visual: "story",
    },
    {
      id: "ivy-trunk",
      level: 2,
      title: "The curtain on the oak",
      placeTags: ["woodland"],
      placeHint: "Oak woodland · forest",
      blurb: "English ivy climbing a trunk — clear from the trail.",
      lookFor:
        "A curtain or sleeve of ivy on a tree trunk or blanketing the understory, visible without leaving the path.",
      story:
        "Ivy doesn’t ask permission. It climbs, carpets, and steals light from the oak’s own understory. The woodland keeps its shape only if something pushes back.",
      care: "Remove when it’s safe and allowed where you are — never yank wildlife nests with it.",
      visual: "story",
    },
    {
      id: "hotspot-patch",
      level: 2,
      title: "Plant a hotspot",
      placeTags: ["garden", "urban"],
      placeHint: "Backyard · garden · city plantings",
      blurb: "A native patch (poppy, sunflower, milkweed where it belongs) that invites more life.",
      lookFor:
        "A sunny native or wildlife plant already in your looking-at place — California poppy, sunflower, or local milkweed — whole plant obvious from the path.",
      story:
        "One right plant won’t save the planet. It can still turn a quiet yard into a busy little hub — bees, butterflies, birds — season after season. You’re not decorating. You’re opening a door.",
      care: "Choose natives that fit your region. Milkweed only where it belongs; skip “freeing” houseplants outdoors.",
      visual: "story",
    },
    {
      id: "leave-it-be",
      level: 2,
      title: "Leave it be",
      placeTags: ["garden", "urban", "coast", "woodland"],
      placeHint: "Any place",
      blurb: "You found a sign from the path. Log the restraint — that’s the win.",
      lookFor:
        "Any mission sign you already know how to spot — mound, pantry, feather, holes — seen from a safe distance.",
      story:
        "The adventure isn’t getting closer. It’s knowing enough to walk on. Quiet wins count.",
      care: "No flash, no dig, no chase. Your reward is still knowing the neighborhood.",
      visual: "story",
    },
    {
      id: "kind-act",
      level: 2,
      title: "One kind act",
      placeTags: ["garden", "urban", "coast", "woodland"],
      placeHint: "Tied to something you already learned",
      blurb: "A small real-world help for a species or place you know.",
      lookFor:
        "Something you already scanned or a mission you finished — then one gentle action that fits it.",
      story:
        "Skip the spray on that mound. Leave a leaf-litter corner. Don’t plant ice plant. Put the right milkweed in the right garden. Tiny moves, louder yard over time.",
      care: "No guilt lecture — just one act you control on your block.",
      visual: "story",
    },
  ];

  /**
   * Level 3 — same face, different meaning by place; under-the-hood landscape stories.
   * Not generic tips. Not vacation-postcard facts.
   */
  var QUESTS_L3 = [
    {
      id: "l3-ice-plant-meanings",
      level: 3,
      title: "Ice plant: three readings",
      placeTags: ["coast", "garden", "urban"],
      placeHint: "Coast vs yard vs “just planted”",
      blurb: "Same shiny carpet — healthy, meh, or a warning, depending on the place you’re looking at.",
      lookFor:
        "Ice plant (Carpobrotus-type mats) from the path — or a native dune plant that should be there instead.",
      story:
        "Tourists see a soft green blanket. The under-the-hood story is whether this place can still host what belongs here.",
      care: "Don’t plant ice plant on wild shorelines. Prefer natives that keep the dune’s own cast employed.",
      visual: "meanings",
      meanings: [
        {
          tone: "warning",
          placeLabel: "SoCal / West Coast dunes & bluffs",
          text: "Bad sign. Invasive here — it crowds natives. A thick mat often means the shoreline’s own plants already lost ground.",
        },
        {
          tone: "meh",
          placeLabel: "A managed yard far from wild dunes",
          text: "Meh. Not a native hero, not automatically a dune crisis on a city patio — still don’t “share” cuttings onto wild coasts.",
        },
        {
          tone: "healthy",
          placeLabel: "Native dune / bluff plant cover (looking at healthy shore)",
          text: "Healthy sign when natives hold the ground instead — more room for the insects and birds that evolved with this coast.",
        },
      ],
    },
    {
      id: "l3-ivy-meanings",
      level: 3,
      title: "Ivy: curtain or cage?",
      placeTags: ["woodland", "garden", "urban"],
      placeHint: "Oak woodland vs garden wall",
      blurb: "English ivy reads different on an oak trail than on a trimmed fence.",
      lookFor: "Ivy on a trunk or understory — from the path only.",
      story:
        "Postcard England loves ivy on stone. California oak woodland tells a harder story when that curtain seals the understory shut.",
      care: "Remove when safe and allowed in wild or semi-wild woods; never rip through active nests.",
      visual: "meanings",
      meanings: [
        {
          tone: "warning",
          placeLabel: "NorCal oak woodland / forest understory",
          text: "Warning. Invasive climber — steals light, carpets the floor, and can mean the woodland’s own plants are already losing.",
        },
        {
          tone: "meh",
          placeLabel: "Contained garden wall or planter",
          text: "Meh if truly contained — still a hitchhiker risk if birds or trimmings move it into wild edges.",
        },
        {
          tone: "healthy",
          placeLabel: "Oak woodland without an ivy sleeve",
          text: "Healthy sign: open understory, room for the plants and insects that belong with coast live oak.",
        },
      ],
    },
    {
      id: "l3-poppy-meanings",
      level: 3,
      title: "Poppy: belonging vs décor",
      placeTags: ["garden", "coast", "urban", "woodland"],
      placeHint: "CA places vs planted-elsewhere",
      blurb: "California poppy can mean “home team” here — or just a pretty transplant elsewhere.",
      lookFor: "California poppy in sun — whole plant from the path.",
      story:
        "Vacation photos love the orange splash. The deeper read is whether this flower is a neighbor or a costume.",
      care: "In its range, lean soil and sun beat heavy water. Don’t treat every orange bloom as interchangeable with rare local endemics.",
      visual: "meanings",
      meanings: [
        {
          tone: "healthy",
          placeLabel: "SoCal / NorCal yard, coast edge, oak openings (CA)",
          text: "Healthy sign. Native here — bees notice; lean dry ground is a feature, not a failure.",
        },
        {
          tone: "meh",
          placeLabel: "Garden outside its native story (planted ornamental)",
          text: "Meh. Lovely décor, not proof this landscape’s own cast is thriving.",
        },
        {
          tone: "warning",
          placeLabel: "If it’s replacing a rarer local native community",
          text: "Warning only when plantings erase what was rarer and local — pretty can still be a quiet takeover.",
        },
      ],
    },
    {
      id: "l3-eucalyptus-meanings",
      level: 3,
      title: "Eucalyptus: planted giant",
      placeTags: ["garden", "urban", "coast", "woodland"],
      placeHint: "CA plantings & parks",
      blurb: "Tall, famous, and not a native California teammate.",
      lookFor: "Eucalyptus from a path or park edge — no need to stand under shedding bark.",
      story:
        "Tourists remember the smell and the height. The everyday truth is introduced trees reshaping shade, litter, and what can live underneath.",
      care: "Check local guidance before planting more; don’t pretend it’s a stand-in for oak woodland.",
      visual: "meanings",
      meanings: [
        {
          tone: "meh",
          placeLabel: "City park / street / older CA planting",
          text: "Meh-to-complicated. Introduced — wildlife may use it, but it isn’t the oak’s story.",
        },
        {
          tone: "warning",
          placeLabel: "Where it crowds out native woodland structure",
          text: "Warning when it dominates: different litter, different understory, fewer of the partnerships natives built over time.",
        },
        {
          tone: "healthy",
          placeLabel: "Looking at native oak / chaparral instead",
          text: "Healthy contrast: coast live oak and local shrubs keep the cast that evolved here.",
        },
      ],
    },
    {
      id: "l3-missing-apex",
      level: 3,
      title: "Missing pieces (under the postcard)",
      placeTags: ["garden", "urban", "coast", "woodland"],
      placeHint: "Big-picture landscape story",
      blurb: "Why a “pretty” countryside can still be running on empty — the tourist view skips this.",
      lookFor:
        "No close-up needed. Notice a quiet wood, heavy deer browse, or a landscape that feels full of plants but thin on balance — then open this card.",
      story:
        "England’s green hills photograph like a vacation dream. Under that polish, wildlife has been doing poorly in places where certain apex predators were wiped out — the top of the food web removed, and everything downstream gone weird: too many browsers, quieter woods, species hanging on in a system already off-kilter. You don’t see that on the tour bus. Same idea anywhere: what’s missing matters as much as what’s cute in the frame.",
      care: "Don’t chase predators or stage encounters. The mission is understanding the system — then supporting the living neighborhood you can actually help (habitat, natives, not harassing wildlife).",
      visual: "story",
    },
    {
      id: "l3-houseplant-boundary",
      level: 3,
      title: "Houseplant vs wild",
      placeTags: ["garden", "urban"],
      placeHint: "Indoor sweetheart vs outdoor world",
      blurb: "A philodendron on a sill is fine. “Freed” into a CA yard is a different story.",
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
          text: "Meh if it never escapes — still zero native food-web credit.",
        },
        {
          tone: "warning",
          placeLabel: "Dumped or planted into CA wild / creek edges",
          text: "Warning. Wrong climate story outdoors; dumping houseplants can seed problems natives didn’t ask for.",
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
            '<p class="mission-board__hint">No Level 2 missions for this habitat — try garden, coast, or woodland.</p>';
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
