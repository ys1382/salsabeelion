/* Short village. Next chapter continues from the scene id "thu_stop". */
(function () {
  var SAVE_KEY = "mo-village-short-v2";
  var VILLAGE_NAME = "Alderhart";

  var LOOKS = {
    es: {
      home: function () {
        return "Both houses are limewashed, with clay tile roofs.";
      },
      homeAlt: "Elvora talks with a young person between two limewashed houses.",
      street: [
        "The street is one street. Limewashed houses, clay tile roofs, and a small café with a cloth awning run the whole way, and people use them together.",
        "Neighbors come along with the groceries, talking as they go. A blue-green visitor walks with them, only passing through."
      ],
      streetAlt: "Neighbors carry groceries down a limewashed street, talking, with one blue-green visitor among them.",
      shore: [
        "The cove is quiet. People stand on the rocks with small nets, talking while a boat waits on the clear water."
      ],
      shoreAlt: "People stand on calm rocks with small nets, a boat waiting offshore.",
      shop: [
        "The café door is open. Limewashed walls and a cloth awning shade the step. The shopkeeper waves from the doorway while neighbors gather with baskets. A visitor comes in with them. Nobody is turned away."
      ],
      shopAlt: "A shopkeeper waves neighbors with baskets into an open café.",
      station: [
        "The platform is quiet. The little station matches the limewashed houses, and a short train waits on the track. This is the way toward the towns people have been telling you about.",
        "A traveler with a small bag stands on the boards, already looking back toward the village."
      ],
      stationAlt: "A young person from the town stands on the platform, looking at a short train."
    },
    ar: {
      home: function () {
        return "Both houses are pale stone, with arched doors.";
      },
      homeAlt: "Elvora talks with a young person between two stone houses.",
      street: [
        "The street is one street. Pale stone houses with arched doors, and a courtyard café, run the whole way, and people use them together.",
        "Neighbors come along with baskets of groceries, talking as they go. A blue-green visitor walks with them, only passing through."
      ],
      streetAlt: "Neighbors carry baskets down a stone street, talking, with one blue-green visitor among them.",
      shore: [
        "The cove is quiet. People stand in the shallows with small nets, talking beside a boat on the clear water."
      ],
      shoreAlt: "People stand in calm shallows with small nets, a boat beside them.",
      shop: [
        "The café door is open. Stone arches shade the step. The shopkeeper waves from the doorway as neighbors come across the courtyard, a child among them. A visitor comes in with them. Nobody is turned away."
      ],
      shopAlt: "A shopkeeper waves neighbors across a courtyard café, a child with them.",
      station: [
        "The platform is quiet. The little station is pale stone, like the houses, and a short train waits on the track. This is the way toward the towns people have been telling you about.",
        "A traveler with a small bag stands on the boards, already looking back toward the village."
      ],
      stationAlt: "A young person from the town stands on the platform, looking at a short train."
    },
    ga: {
      home: function () {
        return "Both houses are whitewashed, with stone walls.";
      },
      homeAlt: "Elvora talks with a young person between two whitewashed cottages.",
      street: [
        "The street is one street. Whitewashed cottages, stone walls, and a small tea shop run the whole way, and people use them together.",
        "Neighbors come along the lane with the groceries, talking as they go. A blue-green visitor walks with them, only passing through."
      ],
      streetAlt: "Neighbors carry groceries along a whitewashed lane, talking, with one blue-green visitor among them.",
      shore: [
        "The cove is quiet. People stand along the rocks with small nets, looking out over the clear water."
      ],
      shoreAlt: "People stand on calm rocks with small nets, looking out over the water.",
      shop: [
        "The tea shop door is open. Whitewashed walls shade the step. The shopkeeper waves neighbors in as they come up the path. A visitor comes in with them. Nobody is turned away."
      ],
      shopAlt: "A shopkeeper waves neighbors in from the path at an open tea shop.",
      station: [
        "The platform is quiet. The little station is whitewashed, like the cottages, and a short train waits on the track. This is the way toward the towns people have been telling you about.",
        "A traveler with a small bag stands on the boards, already looking back toward the village."
      ],
      stationAlt: "A young person from the town stands on the platform, looking at a short train."
    },
    ja: {
      home: function () {
        return "Both houses are wood, with dark tile roofs.";
      },
      homeAlt: "Elvora talks with a young person between two wooden houses.",
      street: [
        "The street is one street. Wooden houses, dark tile roofs, and a small café with a plain curtain run the whole way, and people use them together.",
        "Neighbors come along with the groceries, talking as they go. A blue-green visitor walks with them, only passing through."
      ],
      streetAlt: "Neighbors carry groceries along a wooden lane, talking, with one blue-green visitor among them.",
      shore: [
        "The cove is quiet. People gather on the rocks with small nets, talking near the boats at the pier. The water is clear."
      ],
      shoreAlt: "People gather on calm rocks with small nets, boats tied at the pier.",
      shop: [
        "The café door is open. A plain curtain hangs in the wooden doorway. The shopkeeper waves from the step while neighbors come along with baskets, a small child holding a hand. A visitor comes in with them. Nobody is turned away."
      ],
      shopAlt: "A shopkeeper waves neighbors with baskets into an open café, a child with them.",
      station: [
        "The platform is quiet. The little station is wood and tile, like the houses, and a short train waits on the track. This is the way toward the towns people have been telling you about.",
        "A traveler with a small bag stands on the boards, already looking back toward the village."
      ],
      stationAlt: "A young person from the town stands on the platform, looking at a short train."
    },
    tr: {
      home: function () {
        return "Both houses are plaster, with red tile roofs.";
      },
      homeAlt: "Elvora talks with a young person between two plaster houses.",
      street: [
        "The street is one street. Plaster houses, red tile roofs, and a tea house run the whole way, and people use them together.",
        "Neighbors come along with baskets, talking as they go. People sit over tea at the tables. A blue-green visitor walks with them, only passing through."
      ],
      streetAlt: "Neighbors carry baskets down a plaster-house street, talking, with one blue-green visitor among them.",
      shore: [
        "The cove is quiet. People sort nets and baskets on the rocks, with small boats pulled up on the clear water."
      ],
      shoreAlt: "People sort nets and baskets on calm rocks, boats pulled up nearby.",
      shop: [
        "The tea house door is open. Plaster walls and red tile shade the step. The shopkeeper waves from the doorway as neighbors come up, a child with them. A visitor comes in with them. Nobody is turned away."
      ],
      shopAlt: "A shopkeeper waves neighbors in at an open tea house, a child with them.",
      station: [
        "The platform is quiet. The little station is plaster and red tile, like the houses, and a short train waits on the track. This is the way toward the towns people have been telling you about.",
        "A traveler with a small bag stands on the boards, already looking back toward the village."
      ],
      stationAlt: "A young person from the town stands on the platform, looking at a short train."
    }
  };

  function look() {
    return LOOKS[langPack().id] || LOOKS.es;
  }

  function womanName() {
    var names = { es: "Rosa", ar: "Fatima", ga: "Aoife", ja: "Hana", tr: "Elif" };
    return names[langPack().id] || names.es;
  }

  function manName() {
    var names = { es: "Miguel", ar: "Tariq", ga: "Sean", ja: "Kenji", tr: "Yusuf" };
    return names[langPack().id] || names.es;
  }

  function womanSays() {
    return womanName() + " says";
  }

  function manSays() {
    return manName() + " says";
  }

  function rockName() {
    return "Neris";
  }

  function fisherName() {
    var names = { es: "Diego", ar: "Hassan", ga: "Cian", ja: "Daichi", tr: "Emre" };
    return names[langPack().id] || names.es;
  }

  function rockSays() {
    return rockName() + " says";
  }

  function fisherSays() {
    return fisherName() + " says";
  }

  var scenes = {
    mon_home: {
      day: "Monday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: function () { return look().homeAlt; },
      paragraphs: function () {
        return [
          "You are already home in Alderhart. The house next to yours is Elvora’s, and the gate between them has been there longer than this morning.",
          look().home(),
          "Elvora leans on her stick."
        ];
      },
      speaker: "Elvora says",
      say: "mon_home",
      choices: [{ label: "Go to the street.", next: "mon_street" }]
    },
    mon_street: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: function () { return look().streetAlt; },
      paragraphs: function () { return look().street; },
      choices: function () {
        var list = [];
        if (!alreadySaid("ch_hi_scarf")) list.push({ say: "ch_hi_scarf", next: "scarf_hi" });
        list.push({ label: "Back to Elvora.", next: "mon_return" });
        return list;
      }
    },
    mon_eyes: {
      day: "Monday",
      picture: function () { return womanPicture("eyes-mon"); },
      alt: function () { return womanName() + " on the lane. Her eyes hold a smoky street, a shut gate, and her brother."; },
      paragraphs: [],
      speaker: womanSays,
      say: "eyes_mon",
      learn: "mon-elif",
      eyes: "mon",
      choices: function () {
        var next = state.afterEyes || "mon_street";
        return [{ label: "Back to the street.", next: next, doneEyes: true }];
      }
    },
    scarf_hi: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: function () { return womanName() + " smiles, groceries in her arms."; },
      paragraphs: function () { return [womanName() + " shifts the groceries and makes room for you on the lane."]; },
      speaker: womanSays,
      say: "scarf_well",
      choices: [
        { say: "ch_hi_friend", next: "scarf_fine" },
        { say: "ask_towns", next: "scarf_there" },
        { say: "bye", next: "mon_street" }
      ]
    },
    scarf_fine: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: function () { return womanName() + " answers you."; },
      paragraphs: [],
      speaker: womanSays,
      say: "friend_far",
      choices: [
        { say: "ask_towns", next: "scarf_there" },
        { say: "bye", next: "mon_street" }
      ]
    },
    scarf_there: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: function () { return womanName() + " keeps walking with her neighbors."; },
      paragraphs: function () { return [womanName() + " glances toward the hills, then back at the street you share."]; },
      speaker: womanSays,
      say: "scarf_apart",
      face: "heavy",
      learn: "mon-walk",
      mark: "street",
      choices: [
        { say: "bye", next: "mon_street" }
      ]
    },
    scarf_bad: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: function () { return womanName() + " answers gently."; },
      paragraphs: function () { return [womanName() + " does not lower her voice. This street is not the place she means."]; },
      speaker: womanSays,
      say: "scarf_little",
      face: "gentle",
      mark: "street",
      choices: [
        { say: "ask_family", next: "scarf_family" },
        { say: "bye", next: "mon_street" }
      ]
    },
    scarf_family: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: function () { return womanName() + " speaks about family far away."; },
      paragraphs: function () { return [womanName() + " nods toward the road out of town."]; },
      speaker: womanSays,
      say: "scarf_family",
      face: "road",
      mark: "street",
      choices: [
        { say: "ask_towns", next: "scarf_there" },
        { say: "bye", next: "mon_street" }
      ]
    },
    friend_hi: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: function () { return manName() + " turns to you."; },
      paragraphs: function () { return [manName() + " is walking with " + womanName() + ". He looks glad you stopped."]; },
      speaker: manSays,
      say: "friend_far",
      choices: [
        { say: "ask_cousin", next: "friend_there" },
        { say: "bye", next: "mon_street" }
      ]
    },
    friend_there: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: function () { return manName() + " talks, still among friends."; },
      paragraphs: function () { return [manName() + " keeps his voice ordinary. The news is not about this lane."]; },
      speaker: manSays,
      say: "friend_apart",
      face: "heavy",
      learn: "mon-letter",
      mark: "street",
      choices: [
        { say: "bye", next: "mon_street" }
      ]
    },
    friend_here: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: function () { return manName() + " smiles at the shared street."; },
      paragraphs: function () { return [manName() + " tips his head at the benches, the lamps, the people passing."]; },
      speaker: manSays,
      say: "friend_here",
      face: "here",
      mark: "street",
      choices: [
        { say: "ask_cousin", next: "friend_there" },
        { say: "bye", next: "mon_street" }
      ]
    },
    mon_return: {
      day: "Monday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "Elvora listens at the gate.",
      paragraphs: function () { return reportIntro("mon"); },
      speaker: "Elvora says",
      say: "report_ask",
      report: "mon",
      choices: []
    },
    mon_said: {
      day: "Monday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "Elvora answers at the gate.",
      paragraphs: function () { return reportTaken("mon"); },
      speaker: "Elvora says",
      pick: function () { return reportSay("mon"); },
      face: "heard",
      notesDay: "mon",
      choices: function () { return afterReport("mon", "tue_home"); }
    },
    tue_home: {
      day: "Tuesday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "Elvora speaks with you at the cottage gate.",
      paragraphs: function () {
        return [morningEcho("mon"), "Elvora is at the gate."];
      },
      speaker: "Elvora says",
      pick: function () {
        return state.reports.mon && state.reports.mon !== "none" ? "tue_open_yes" : "tue_open_no";
      },
      choices: [
        { label: "Go to the garden.", next: "tue_meet" },
        { label: "Go to the shore.", next: "tue_shore" }
      ]
    },
    tue_meet: {
      day: "Tuesday",
      picture: function () { return womanPicture("scarf"); },
      alt: function () { return womanName() + " is in the garden."; },
      paragraphs: function () { return [womanName() + " is in the garden."]; },
      choices: [
        { say: "ch_garden", next: "hana_flowers" },
        { say: "ch_tends", next: "hana_flowers" }
      ]
    },
    hana_flowers: {
      day: "Tuesday",
      picture: function () { return womanPicture("eyes-tue"); },
      alt: function () { return womanName() + " in the garden. Her eyes hold a gate, a path, and red camellias."; },
      paragraphs: [],
      speaker: womanSays,
      say: "eyes_tue",
      learn: "tue-flowers",
      choices: [{ label: "Stay with her.", next: "hana_office" }]
    },
    hana_office: {
      day: "Tuesday",
      picture: function () { return womanPicture("eyes-office"); },
      alt: function () { return womanName() + " in the same garden. Her eyes hold a lit office and a last train."; },
      paragraphs: [],
      speaker: womanSays,
      say: "eyes_office",
      learn: "tue-office",
      choices: [{ label: "Back to Elvora.", next: "tue_return" }]
    },
    tue_shore: {
      day: "Tuesday",
      image: "village-art/shore-calm.jpg?v=20261006n",
      alt: function () { return look().shoreAlt; },
      paragraphs: function () { return look().shore; },
      choices: [
        { label: "Go to the garden.", next: "tue_meet" },
        { say: "ch_hi_mer", next: "mer_hi" },
        { say: "ch_hi_fish", next: "fish_hi" },
        { label: "Back to Elvora.", next: "tue_return" }
      ]
    },
    mer_hi: {
      day: "Tuesday",
      image: "village-art/shore-calm.jpg?v=20261006n",
      alt: function () { return rockName() + " turns to you, a small net in hand."; },
      paragraphs: function () { return [rockName() + " rests the net on the rock and makes space beside you."]; },
      speaker: rockSays,
      say: "mer_here",
      choices: [
        { say: "ask_waters", next: "mer_there" },
        { say: "ask_net", next: "mer_net" },
        { say: "bye", next: "tue_shore" }
      ]
    },
    mer_there: {
      day: "Tuesday",
      image: "village-art/shore-calm.jpg?v=20261006n",
      alt: function () { return rockName() + " looks out toward a far shore."; },
      paragraphs: function () { return [rockName() + " nods at the far water, not at the cove under your feet."]; },
      speaker: rockSays,
      say: "mer_there",
      face: "heavy",
      learn: "tue-cove",
      mark: "shore",
      choices: [
        { say: "bye", next: "tue_shore" }
      ]
    },
    mer_net: {
      day: "Tuesday",
      image: "village-art/shore-calm.jpg?v=20261006n",
      alt: "Small nets rest on the rocks beside clear water.",
      paragraphs: function () { return [rockName() + " lifts the net so you can see how small it is."]; },
      speaker: rockSays,
      say: "mer_net",
      face: "net",
      learn: "tue-net",
      mark: "shore",
      choices: [
        { say: "bye", next: "tue_shore" }
      ]
    },
    fish_hi: {
      day: "Tuesday",
      image: "village-art/shore-calm.jpg?v=20261006n",
      alt: function () { return fisherName() + " stands with the others."; },
      paragraphs: function () { return [fisherName() + " has been talking with " + rockName() + " already. He includes you without a fuss."]; },
      speaker: fisherSays,
      say: "fish_here",
      choices: [
        { say: "ask_waters", next: "fish_there" },
        { say: "ask_water", next: "fish_water" },
        { say: "bye", next: "tue_shore" }
      ]
    },
    fish_there: {
      day: "Tuesday",
      image: "village-art/shore-calm.jpg?v=20261006n",
      alt: function () { return fisherName() + " looks toward distant water."; },
      paragraphs: function () { return [fisherName() + " means a shore you cannot see from here."]; },
      speaker: fisherSays,
      say: "fish_there",
      face: "heavy",
      learn: "tue-fish",
      mark: "shore",
      choices: [
        { say: "bye", next: "tue_shore" }
      ]
    },
    fish_water: {
      day: "Tuesday",
      image: "village-art/shore-calm.jpg?v=20261006n",
      alt: "Clear water beside the rocks.",
      paragraphs: function () { return [fisherName() + " watches the cove, easy about it."]; },
      speaker: fisherSays,
      say: "fish_water",
      face: "easy",
      choices: [
        { say: "bye", next: "tue_shore" }
      ]
    },
    tue_return: {
      day: "Tuesday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "Elvora nods at the cottage gate.",
      paragraphs: function () { return reportIntro("tue"); },
      speaker: "Elvora says",
      say: "report_ask",
      report: "tue",
      choices: []
    },
    tue_said: {
      day: "Tuesday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "Elvora answers at the cottage gate.",
      paragraphs: function () { return reportTaken("tue"); },
      speaker: "Elvora says",
      pick: function () { return reportSay("tue"); },
      face: "heard",
      notesDay: "tue",
      choices: function () { return afterReport("tue", "wed_home"); }
    },
    wed_home: {
      day: "Wednesday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "Elvora at the gate on a quieter morning.",
      paragraphs: function () {
        return [morningEcho("tue"), "Elvora is at the gate."];
      },
      speaker: "Elvora says",
      pick: function () {
        return state.reports.tue && state.reports.tue !== "none" ? "wed_open_yes" : "wed_open_no";
      },
      choices: [
        { label: "Go to the lane.", next: "wed_meet" },
        { label: "Go to the shop.", next: "wed_porch" }
      ]
    },
    wed_meet: {
      day: "Wednesday",
      picture: function () { return womanPicture("scarf"); },
      alt: function () { return womanName() + " stands by a cart. One seat is empty."; },
      paragraphs: function () { return [womanName() + " is by the cart. One seat is empty."]; },
      choices: [
        { say: "ch_cart", next: "wed_eyes" },
        { say: "ch_brother", next: "wed_eyes" }
      ]
    },
    wed_eyes: {
      day: "Wednesday",
      picture: function () { return womanPicture("eyes-wed"); },
      alt: function () { return womanName() + " by the cart. Her eyes hold a suburb and fire in the streets."; },
      paragraphs: [],
      speaker: womanSays,
      say: "eyes_wed",
      learn: "wed-lucia",
      choices: [{ label: "Back to Elvora.", next: "wed_return" }]
    },
    wed_porch: {
      day: "Wednesday",
      image: "village-art/porch-open.jpg?v=20261006n",
      alt: function () { return look().shopAlt; },
      paragraphs: function () { return look().shop; },
      choices: [
        { label: "The cart is here.", next: "wed_meet" },
        { say: "ch_hi_shop", next: "shop_hi" },
        { say: "ch_hi_pair", next: "pair_hi" },
        { label: "Back to Elvora.", next: "wed_return" }
      ]
    },
    shop_hi: {
      day: "Wednesday",
      image: "village-art/porch-open.jpg?v=20261006n",
      alt: "The shopkeeper smiles in the doorway.",
      paragraphs: ["He keeps the door wide while he answers."],
      speaker: "The shopkeeper says",
      say: "shop_here",
      choices: [
        { say: "ask_door", next: "shop_there" },
        { say: "bye", next: "wed_porch" }
      ]
    },
    shop_there: {
      day: "Wednesday",
      image: "village-art/porch-open.jpg?v=20261006n",
      alt: "The shopkeeper speaks of another town.",
      paragraphs: ["His hand stays open toward his own door. The cold welcome he means is somewhere else."],
      speaker: "The shopkeeper says",
      say: "shop_there",
      face: "heavy",
      learn: "wed-door",
      mark: "shop",
      choices: [
        { say: "bye", next: "wed_porch" }
      ]
    },
    pair_hi: {
      day: "Wednesday",
      image: "village-art/porch-open.jpg?v=20261006n",
      alt: "Two neighbors wait together on the shop step.",
      paragraphs: ["They were already going in side by side."],
      speaker: "A neighbor says",
      say: "pair_here",
      choices: [
        { say: "ask_door", next: "pair_there" },
        { say: "bye", next: "wed_porch" }
      ]
    },
    pair_there: {
      day: "Wednesday",
      image: "village-art/porch-open.jpg?v=20261006n",
      alt: "The neighbor speaks quietly about somewhere else.",
      paragraphs: ["She looks down the road, not at the shopkeeper."],
      speaker: "A neighbor says",
      say: "pair_there",
      face: "quiet",
      learn: "wed-pair",
      mark: "shop",
      choices: [
        { say: "bye", next: "wed_porch" }
      ]
    },
    wed_return: {
      day: "Wednesday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "Elvora at the gate.",
      paragraphs: function () { return reportIntro("wed"); },
      speaker: "Elvora says",
      say: "report_ask",
      report: "wed",
      choices: []
    },
    wed_said: {
      day: "Wednesday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "Elvora answers at the gate.",
      paragraphs: function () { return reportTaken("wed"); },
      speaker: "Elvora says",
      pick: function () { return reportSay("wed"); },
      face: "heard",
      notesDay: "wed",
      choices: function () { return afterReport("wed", "thu_home"); }
    },
    thu_home: {
      day: "Thursday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "Elvora stays by the cottages while the lane leads away.",
      paragraphs: function () {
        return [morningEcho("wed"), "Elvora stays by the houses. You walk the last of the lane alone."];
      },
      speaker: "Elvora says",
      say: "thu_home",
      choices: [{ label: "Go to the station.", next: "thu_station" }]
    },
    thu_station: {
      day: "Thursday",
      image: "village-art/station.jpg?v=20261006b",
      alt: function () { return look().stationAlt; },
      paragraphs: function () { return look().station; },
      choices: [
        { say: "ch_from", next: "trav_from" },
        { say: "ch_how", next: "trav_how" },
        { say: "ch_stayq", next: "trav_stay" }
      ]
    },
    trav_from: {
      day: "Thursday",
      image: "village-art/station.jpg?v=20261006b",
      alt: "The traveler answers on the platform.",
      paragraphs: ["The train is still there. Nobody has asked you to board."],
      speaker: "The traveler says",
      say: "trav_from",
      choices: [
        { say: "ch_tomorrow", next: "trav_bye", note: "from" }
      ]
    },
    trav_how: {
      day: "Thursday",
      image: "village-art/station.jpg?v=20261006b",
      alt: "The traveler speaks of towns that live apart.",
      paragraphs: ["They mean the places past this line, not the village behind you."],
      speaker: "The traveler says",
      say: "trav_how",
      face: "heavy",
      choices: [
        { say: "ch_tomorrow", next: "trav_bye", note: "how" }
      ]
    },
    trav_stay: {
      day: "Thursday",
      image: "village-art/station.jpg?v=20261006b",
      alt: "The traveler looks back toward the village.",
      paragraphs: ["They are not settling a bag on the train."],
      speaker: "The traveler says",
      say: "trav_stay",
      face: "back",
      choices: [
        { say: "ch_tomorrow", next: "trav_bye", note: "stay" }
      ]
    },
    scarf_bye: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: function () { return womanName() + " answers the goodbye."; },
      paragraphs: [],
      speaker: womanSays,
      say: "bye_back",
      after: ["You step off the lane."],
      face: "bye",
      choices: [{ label: "Step back to the street.", next: "mon_street" }]
    },
    friend_bye: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: function () { return manName() + " answers the goodbye."; },
      paragraphs: [],
      speaker: manSays,
      say: "bye_back",
      after: ["You step off the lane."],
      face: "bye",
      choices: [{ label: "Step back to the street.", next: "mon_street" }]
    },
    mer_bye: {
      day: "Tuesday",
      image: "village-art/shore-calm.jpg?v=20261006n",
      alt: function () { return rockName() + " answers the goodbye."; },
      paragraphs: [],
      speaker: rockSays,
      say: "bye_back",
      after: ["You leave the rocks."],
      face: "bye",
      choices: [{ label: "Step back from the rocks.", next: "tue_shore" }]
    },
    fish_bye: {
      day: "Tuesday",
      image: "village-art/shore-calm.jpg?v=20261006n",
      alt: function () { return fisherName() + " answers the goodbye."; },
      paragraphs: [],
      speaker: fisherSays,
      say: "bye_back",
      after: ["You leave the rocks."],
      face: "bye",
      choices: [{ label: "Step back from the rocks.", next: "tue_shore" }]
    },
    shop_bye: {
      day: "Wednesday",
      image: "village-art/porch-open.jpg?v=20261006n",
      alt: "The shopkeeper answers the goodbye.",
      paragraphs: ["He says it back before you leave the step."],
      speaker: "The shopkeeper says",
      say: "bye_back",
      face: "bye",
      choices: [{ label: "Step back from the shop.", next: "wed_porch" }]
    },
    pair_bye: {
      day: "Wednesday",
      image: "village-art/porch-open.jpg?v=20261006n",
      alt: "The neighbor answers the goodbye.",
      paragraphs: ["She says it back before you leave the step."],
      speaker: "A neighbor says",
      say: "bye_back",
      face: "bye",
      choices: [{ label: "Step back from the shop.", next: "wed_porch" }]
    },
    trav_bye: {
      day: "Thursday",
      image: "village-art/station.jpg?v=20261006b",
      alt: "The traveler answers the goodbye.",
      paragraphs: ["They say it back. The train is still there."],
      speaker: "The traveler says",
      say: "morn_back",
      face: "bye",
      choices: [{ label: "Stay on the platform.", next: "thu_stop" }]
    },
    thu_stop: {
      day: "Thursday",
      image: "village-art/station.jpg?v=20261006b",
      alt: "The train waits. You stay on the platform.",
      paragraphs: function () {
        var stay = "You stay on the platform. The train does not leave with you.";
        var again = "The next walk is the same days, and people speak the next language the whole way.";
        if (state.note === "how") {
          return [stay, "You keep what the traveler said: out there, people live apart. Here, they do not.", again];
        }
        if (state.note === "from") {
          return [stay, "The traveler came from far away, and is not staying today.", again];
        }
        return [stay, "You live here. You tell them you will see people tomorrow.", again];
      },
      choices: [
        { label: "Walk these days again.", next: "mon_home", nextLang: true }
      ]
    }
  };


  var NOTES = {
    "mon-elif": function () { return womanName() + " is here in clear air. In Bozkale, after dark, they burn cheap coal in the lower streets. The ridge shut the gates, and her brother is still on the coal side."; },
    "mon-walk": function () { return womanName() + " stays with her neighbors on this street, and it is bad there."; },
    "mon-letter": function () { return manName() + " stays with " + womanName() + " on this street, and they are not here."; },
    "tue-flowers": function () { return womanName() + " tends red tsubaki here. In Kirioka they grow them by the gate, and they open in the cold even when the walk is empty."; },
    "tue-office": function () { return "At home " + womanName() + " does not leave the office until the last train. She only meets the flowers by the porch lamp, and some nights that lamp is already out."; },
    "tue-cove": function () { return rockName() + " is at this water, and the water is bad there."; },
    "tue-net": function () { return "The net in " + rockName() + "'s hands is small."; },
    "tue-fish": function () { return fisherName() + " is fishing here with the others, and there they do not fish."; },
    "wed-lucia": function () { return "The cart is here and " + womanName() + "’s brother is not on it. The fire is in the streets of Jarales. A line sparked over the mill pines and came down into the houses. Her parents are still in theirs. The ridge road is shut."; },
    "wed-door": "His door is open, and there the door is shut.",
    "wed-pair": "They come in together, and there they do not."
  };

  var BACK = { mon: ["Back to the street.", "mon_street"], tue: ["Back to the shore.", "tue_shore"], wed: ["Back to the shop.", "wed_porch"] };
  var NEXT = { mon: "tue_home", tue: "wed_home", wed: "thu_home" };

  function blankNotes() {
    return { mon: [], tue: [], wed: [] };
  }

  function learned(day) {
    return (state.notes && state.notes[day]) || [];
  }

  function addLearn(id) {
    if (!id || !NOTES[id]) return;
    var day = id.slice(0, 3);
    if (!state.notes) state.notes = blankNotes();
    if (!state.notes[day]) state.notes[day] = [];
    if (state.notes[day].indexOf(id) === -1) state.notes[day].push(id);
  }

  function noteText(id) {
    var text = NOTES[id];
    if (typeof text === "function") text = text();
    return text || "";
  }

  function heardSentence(day) {
    return learned(day).map(function (id) {
      return noteText(id);
    }).filter(Boolean).join(" ");
  }

  function reportPack(day) {
    var ids = learned(day);
    var heard = heardSentence(day);
    if (!ids.length || !heard) return null;
    var onlyNet = ids.length === 1 && ids[0] === "tue-net";
    var hasNet = ids.indexOf("tue-net") !== -1;
    var full = onlyNet
      ? heard + " That is the net in their hands, here."
      : (hasNet
        ? heard + " The small net is the one in their hands. The rest is about somewhere else, and the people speaking are here."
        : heard + " The people who said it are here, together. What they named is somewhere else.");
    var only = onlyNet
      ? heard + " The net does not matter."
      : heard + " That is the whole story. Where they were standing does not matter.";
    var here = onlyNet
      ? heard + " So the small net is somewhere else."
      : heard + " So it is that way here, with the people who said it.";
    return {
      right: day + "-full",
      heard: heard,
      options: [
        { id: day + "-only", label: only },
        { id: day + "-here", label: here },
        { id: day + "-full", label: full }
      ]
    };
  }

  function rightReport(day) {
    var pack = reportPack(day);
    return pack ? pack.right : "";
  }

  function reportIntro(day) {
    if (!learned(day).length) return ["You are back at the gate. There is nothing from today to tell yet."];
    return [
      "Elvora is at the gate.",
      "You tell the day in your own words."
    ];
  }

  function reportSay(day) {
    var id = state.reports[day];
    if (id && id === rightReport(day)) return "report_yes";
    return "report_part";
  }

  function reportTaken(day) {
    var id = state.reports[day];
    if (id && id === rightReport(day)) {
      return ["Elvora nods. The day you brought is enough to sit with."];
    }
    return ["Elvora is quiet a moment. From the life she has lived, a day like this often keeps a little more than the first telling."];
  }

  function afterReport(day, next) {
    return [{ label: "That's enough for today.", next: next }];
  }

  function choicesFor(day) {
    var pack = reportPack(day);
    if (!pack) {
      return [
        { label: BACK[day][0], next: BACK[day][1] },
        { label: "That's enough for today.", report: "none", reportDay: day, next: NEXT[day] }
      ];
    }
    return pack.options.map(function (option) {
      return { label: option.label, report: option.id, reportDay: day, next: day + "_said" };
    });
  }

  function morningEcho(day) {
    var id = state.reports[day];
    if (!id) return "The morning is quiet at the gate.";
    if (id === "none") return "Yesterday stayed where you left it. Elvora does not press.";
    var pack = reportPack(day);
    if (pack && id === pack.right) return "Elvora still carries yesterday, quietly.";
    return "Elvora still has the sense that yesterday kept a little back.";
  }

  var dayEl = document.getElementById("day");
  var pictureEl = document.getElementById("picture");
  var proseEl = document.getElementById("prose");
  var choicesEl = document.getElementById("choices");
  var notesEl = document.getElementById("notes");
  var notePlaceEl = document.getElementById("note-place");
  var noteListEl = document.getElementById("note-list");
  var WHO_KEY = "mo-village-who-v1";
  var state = {
    scene: "mon_home",
    gender: "",
    langIndex: 0,
    email: "",
    flags: {},
    note: "",
    notes: blankNotes(),
    reports: {},
    said: { mon: [], tue: [], wed: [], thu: [] }
  };
  var voices = [];
  var speakGen = 0;
  var practiceGen = 0;
  var activeRec = null;
  var WORD_GAP_MS = 300;
  var bannerEl = document.createElement("div");
  bannerEl.className = "listen-banner";
  bannerEl.hidden = true;
  var bannerTitle = document.createElement("strong");
  var bannerHeard = document.createElement("p");
  bannerEl.appendChild(bannerTitle);
  bannerEl.appendChild(bannerHeard);
  var pageMain = document.querySelector("main");
  if (pageMain) pageMain.appendChild(bannerEl);

  if (window.speechSynthesis) {
    voices = window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", function () {
      voices = window.speechSynthesis.getVoices();
    });
  }

  function readCookieGender() {
    var match = /(?:^|; )mo-village-gender=(boy|girl)/.exec(document.cookie || "");
    return match ? match[1] : "";
  }

  function writeCookieGender() {
    if (state.gender !== "boy" && state.gender !== "girl") return;
    document.cookie = "mo-village-gender=" + state.gender + "; Path=/; Max-Age=31536000; SameSite=Lax; Secure";
  }

  function hardRefresh() {
    try {
      var nav = performance.getEntriesByType("navigation")[0];
      return !!(nav && nav.type === "reload");
    } catch (err) {
      return false;
    }
  }

  function readSave() {
    var restart = hardRefresh();
    try {
      var data = JSON.parse(localStorage.getItem(SAVE_KEY) || "");
      if (data) {
        if (data.gender === "boy" || data.gender === "girl") state.gender = data.gender;
        if (!restart && scenes[data.scene]) state.scene = data.scene;
        if (!restart && data.flags && typeof data.flags === "object") state.flags = data.flags;
        if (!restart && data.note) state.note = data.note;
        if (!restart && data.notes && typeof data.notes === "object") state.notes = data.notes;
        if (!restart && data.reports && typeof data.reports === "object") state.reports = data.reports;
        if (!restart && data.said && typeof data.said === "object") state.said = data.said;
        if (typeof data.langIndex === "number") state.langIndex = data.langIndex;
      }
    } catch (err) {}
    if (!state.notes) state.notes = blankNotes();
    if (!state.reports) state.reports = {};
    if (restart) {
      state.scene = "mon_home";
      state.flags = {};
      state.note = "";
      state.notes = blankNotes();
      state.reports = {};
      state.said = blankSaid();
    }
    if (state.gender !== "boy" && state.gender !== "girl") state.gender = readCookieGender();
  }

  function readWho() {
    try {
      return JSON.parse(localStorage.getItem(WHO_KEY) || "{}") || {};
    } catch (err) {
      return {};
    }
  }

  function writeWho() {
    if (!state.email || (state.gender !== "boy" && state.gender !== "girl")) return;
    try {
      var all = readWho();
      all[state.email] = {
        gender: state.gender,
        langIndex: state.langIndex || 0,
        scene: state.scene,
        flags: state.flags || {},
        note: state.note || "",
        notes: state.notes || blankNotes(),
        reports: state.reports || {},
        said: state.said || blankSaid()
      };
      localStorage.setItem(WHO_KEY, JSON.stringify(all));
    } catch (err) {}
  }

  function writeSave() {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          scene: state.scene,
          gender: state.gender,
          langIndex: state.langIndex || 0,
          flags: state.flags || {},
          note: state.note || "",
          notes: state.notes || blankNotes(),
          reports: state.reports || {},
          said: state.said || blankSaid()
        })
      );
      writeCookieGender();
    } catch (err) {}
    writeWho();
  }

  function langPack() {
    var langs = window.VILLAGE_LANGS || [{ id: "es", name: "Spanish", voice: "es-ES" }];
    var i = state.langIndex || 0;
    if (i < 0 || i >= langs.length) i = 0;
    return langs[i];
  }

  function lineTokens(id) {
    var table = (window.VILLAGE_LINES && window.VILLAGE_LINES[langPack().id]) || {};
    return table[id] || [];
  }

  function stopVoice() {
    speakGen += 1;
    practiceGen += 1;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (activeRec) {
      try { activeRec.abort(); } catch (err) {}
      activeRec = null;
    }
  }

  function pickVoice(voiceLang) {
    var want = String(voiceLang || "").slice(0, 2).toLowerCase();
    return voices.filter(function (voice) {
      return String(voice.lang || "").toLowerCase().indexOf(want) === 0;
    })[0] || null;
  }

  function speak(text, voiceLang) {
    speakPaced(text ? [text] : [], voiceLang);
  }

  function speakPaced(words, voiceLang, done, nodes) {
    speakGen += 1;
    var gen = speakGen;
    if (activeRec) {
      try { activeRec.abort(); } catch (err) {}
      activeRec = null;
    }
    function finish() {
      if (nodes) {
        nodes.forEach(function (node) {
          if (node && node.el) node.el.classList.remove("now");
        });
      }
      if (done) done(gen);
    }
    if (!window.speechSynthesis || !words || !words.length) {
      finish();
      return;
    }
    window.speechSynthesis.cancel();
    var i = 0;
    function step() {
      if (gen !== speakGen) return;
      if (nodes) {
        nodes.forEach(function (node) {
          if (node && node.el) node.el.classList.remove("now");
        });
      }
      if (i >= words.length) {
        finish();
        return;
      }
      if (nodes && nodes[i] && nodes[i].el) nodes[i].el.classList.add("now");
      var utterance = new SpeechSynthesisUtterance(words[i]);
      utterance.lang = voiceLang;
      utterance.rate = 0.8;
      var match = pickVoice(voiceLang);
      if (match) utterance.voice = match;
      var moved = false;
      function advance() {
        if (moved || gen !== speakGen) return;
        moved = true;
        i += 1;
        if (i >= words.length) {
          finish();
          return;
        }
        setTimeout(step, WORD_GAP_MS);
      }
      var wait = setTimeout(advance, 2600);
      utterance.onend = function () {
        clearTimeout(wait);
        advance();
      };
      utterance.onerror = function () {
        clearTimeout(wait);
        advance();
      };
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    }
    setTimeout(step, 60);
  }

  function armMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error("none"));
    }
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      stream.getTracks().forEach(function (track) { track.stop(); });
    });
  }

  function cleanHeard(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function addChunk(chunks, said) {
    said = cleanHeard(said);
    if (!said) return;
    var have = cleanHeard(chunks.join(" "));
    if (!have) {
      chunks.push(said);
      return;
    }
    if (said === have || have.slice(-said.length) === said) return;
    if (said.indexOf(have) === 0) {
      chunks.splice(0, chunks.length, said);
      return;
    }
    chunks.push(said);
  }

  function listenOnce(voiceLang, maxMs, onUpdate, shouldStop) {
    return new Promise(function (resolve, reject) {
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        reject(new Error("none"));
        return;
      }
      var texts = [];
      var chunks = [];
      var live = "";
      var settled = false;
      var lastHeard = 0;
      var started = Date.now();
      var limit = maxMs || 12000;
      var quietTimer = null;
      var rec = null;
      function displayLine() {
        var base = cleanHeard(chunks.join(" "));
        var now = cleanHeard(live);
        if (!now) return base;
        if (!base || now.indexOf(base) === 0) return now;
        return cleanHeard(base + " " + now);
      }
      function notify() {
        if (onUpdate && !settled) onUpdate(displayLine());
      }
      function snapshot() {
        var heard = displayLine();
        var sample = texts.slice();
        if (heard) sample.push(heard);
        return sample;
      }
      function caught() {
        if (!shouldStop || settled) return false;
        var sample = snapshot();
        if (!sample.length) return false;
        try {
          return !!shouldStop(sample);
        } catch (err) {
          return false;
        }
      }
      function ok() {
        if (settled) return;
        settled = true;
        clearTimeout(quietTimer);
        if (live) addChunk(chunks, live);
        live = "";
        var heard = displayLine();
        if (heard) texts.push(heard);
        if (activeRec === rec) activeRec = null;
        try { if (rec) rec.abort(); } catch (err) {}
        resolve({ texts: texts, heard: heard });
      }
      function bad(code) {
        if (settled) return;
        settled = true;
        clearTimeout(quietTimer);
        if (activeRec === rec) activeRec = null;
        try { if (rec) rec.abort(); } catch (err) {}
        reject(new Error(code));
      }
      function scheduleQuiet() {
        clearTimeout(quietTimer);
        if (!displayLine()) return;
        quietTimer = setTimeout(function () {
          if (!settled) ok();
        }, 2800);
      }
      function arm() {
        if (settled) return;
        if (Date.now() - started > limit) {
          if (displayLine()) ok();
          else bad("quiet");
          return;
        }
        rec = new SR();
        activeRec = rec;
        rec.lang = voiceLang;
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 5;
        rec.onresult = function (event) {
          lastHeard = Date.now();
          var row = event.results[event.results.length - 1];
          var said = row && row[0] ? row[0].transcript : "";
          var a;
          if (row) {
            for (a = 0; a < row.length; a++) texts.push(row[a].transcript);
          }
          if (row && row.isFinal) {
            live = "";
            addChunk(chunks, said);
          } else {
            live = said;
          }
          notify();
          if (caught()) {
            ok();
            return;
          }
          scheduleQuiet();
        };
        rec.onerror = function (event) {
          var code = (event && event.error) || "error";
          if (code === "aborted" || code === "no-speech") return;
          if (code === "not-allowed" || code === "service-not-allowed") bad("denied");
          else if (code !== "network") bad(code);
        };
        rec.onend = function () {
          if (settled) return;
          if (live) {
            addChunk(chunks, live);
            live = "";
            notify();
          }
          if (caught()) {
            ok();
            return;
          }
          if (lastHeard && Date.now() - lastHeard > 2800 && displayLine()) {
            ok();
            return;
          }
          if (Date.now() - started > limit) {
            if (displayLine()) ok();
            else bad("quiet");
            return;
          }
          setTimeout(arm, 250);
        };
        try { rec.start(); }
        catch (err) {
          setTimeout(function () {
            if (!settled) arm();
          }, 400);
        }
      }
      arm();
    });
  }

  function needRatio() {
    var day = scenes[state.scene] && scenes[state.scene].day;
    if (day === "Thursday") return 1;
    if (day === "Wednesday") return 0.8;
    if (day === "Tuesday") return 0.66;
    return 0.6;
  }

  function dayKeyFromScene() {
    var day = scenes[state.scene] && scenes[state.scene].day;
    if (day === "Tuesday") return "tue";
    if (day === "Wednesday") return "wed";
    if (day === "Thursday") return "thu";
    return "mon";
  }

  function blankSaid() {
    return { mon: [], tue: [], wed: [], thu: [] };
  }

  function rememberSaid(english) {
    if (!english) return;
    var key = dayKeyFromScene();
    if (!state.said) state.said = blankSaid();
    if (!state.said[key]) state.said[key] = [];
    if (state.said[key].indexOf(english) === -1) state.said[key].push(english);
    writeSave();
  }

  function choiceEnglish(sayId) {
    return lineTokens(sayId).map(function (tok) {
      return tok.en || "";
    }).join(" ").replace(/\s+/g, " ").trim();
  }

  function alreadySaid(sayId) {
    var key = dayKeyFromScene();
    var list = (state.said && state.said[key]) || [];
    var english = choiceEnglish(sayId);
    return !!english && list.indexOf(english) !== -1;
  }

  function withoutRepeats(list) {
    var full = list || [];
    var open = full.filter(function (choice) {
      return !choice.say || !alreadySaid(choice.say);
    });
    if (open.length) return open;
    var exit = null;
    full.forEach(function (choice) {
      if (!choice.say) exit = choice;
    });
    if (exit) return [exit];
    return full.length ? [full[full.length - 1]] : [];
  }

  function setSayLabel(button, text) {
    var label = button.querySelector(".say-this");
    if (label) label.textContent = text;
  }

  function hideBanner() {
    bannerEl.hidden = true;
    bannerTitle.textContent = "";
    bannerHeard.textContent = "";
  }

  function showBanner(title, detail) {
    bannerEl.hidden = false;
    bannerEl.className = "listen-banner";
    bannerTitle.textContent = title;
    bannerHeard.textContent = detail || "";
  }

  function clearGrade() {
    hideBanner();
    bannerEl.className = "listen-banner";
  }

  function showGrade(kind, text) {
    bannerEl.hidden = false;
    bannerEl.className = "listen-banner " + (kind === "pass" ? "pass" : "miss");
    bannerTitle.textContent = kind === "pass" ? "That landed" : "Not yet";
    bannerHeard.textContent = text;
  }

  function gradeSentence(graded, heard, passed) {
    var heardBit = heard ? " I heard: " + heard + "." : "";
    if (!heard) return "I didn't catch that. Try again.";
    if (graded.need === 1) {
      return (passed ? "That word landed." : "That word didn't land.") + heardBit;
    }
    if (passed && graded.got === graded.need) {
      return "All " + graded.need + " words landed." + heardBit;
    }
    return graded.got + " of " + graded.need + " words landed." + heardBit;
  }

  function markHits(nodes, hits) {
    nodes.forEach(function (node, index) {
      node.el.classList.remove("now", "hit", "miss");
      if (!hits) return;
      node.el.classList.add(hits[index] ? "hit" : "miss");
    });
  }

  function practiceChoice(button, choice, onPick) {
    var line = button.querySelector(".speech");
    var nodes = (line && line._sayWords) || [];
    var words = nodes.map(function (node) { return node.text; });
    var sense = button.querySelector(".sense");
    var english = sense ? sense.textContent : "";
    var pack = langPack();
    var mine = ++practiceGen;
    button._busy = true;
    clearGrade();
    speakGen += 1;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSayLabel(button, "Your turn");
    showBanner("Listening now", "Say the whole line. A pause between words is fine.");
    armMic().then(function () {
      if (mine !== practiceGen) return;
      var maxMs = Math.min(18000, 5000 + words.length * 3200);
      listenOnce(pack.voice, maxMs, function (heard) {
        if (mine !== practiceGen) return;
        showBanner("Listening now", heard ? "Heard so far: " + heard : "Say the whole line. A pause between words is fine.");
      }, function (sample) {
        return !!(window.villageGrade && window.villageGrade(pack.id, words, sample, needRatio()).passed);
      }).then(function (result) {
          if (mine !== practiceGen) return;
          var graded = window.villageGrade(pack.id, words, result.texts, needRatio());
          markHits(nodes, graded.hits);
          showGrade(graded.passed ? "pass" : "miss", gradeSentence(graded, result.heard, graded.passed));
          if (graded.passed) {
            setSayLabel(button, "That landed");
            rememberSaid(english);
            setTimeout(function () {
              if (mine !== practiceGen) return;
              button._busy = false;
              onPick(choice);
            }, 1600);
          } else {
            button._busy = false;
            setSayLabel(button, "Try again");
          }
      }).catch(function (err) {
        if (mine !== practiceGen) return;
        button._busy = false;
        var code = err && err.message;
        if (code === "none" || code === "language-not-supported") {
          setSayLabel(button, "Go on");
          showGrade("miss", "This browser can't check the mic. Tap again to go on.");
          button._skipMic = true;
        } else if (code === "denied") {
          setSayLabel(button, "Allow the mic");
          showGrade("miss", "Allow the microphone, then try again.");
        } else {
          setSayLabel(button, "Try again");
          showGrade("miss", "I didn't catch that. Try again.");
        }
      });
    }).catch(function () {
      if (mine !== practiceGen) return;
      button._busy = false;
      setSayLabel(button, "Allow the mic");
      showGrade("miss", "Allow the microphone, then try again.");
    });
  }

  function normKey(lang, word) {
    var s = String(word || "");
    if (lang === "tr") s = s.replace(/\u0130/g, "i").replace(/\u0049/g, "\u0131");
    if (lang === "ar" || lang === "ja") return s;
    return s.toLowerCase();
  }

  function glossFor(lang, word, next) {
    var key = normKey(lang, word);
    var nextKey = next ? normKey(lang, next) : "";
    var table = (window.VILLAGE_GLOSS && window.VILLAGE_GLOSS[lang]) || {};
    if (lang === "ga" && key === "an") {
      if (nextKey === "olc" || nextKey === "bhfuil") return "is";
      if (nextKey === "bhfanfaidh") return "will";
      if (nextKey === "mbíonn" || nextKey === "dtagann") return "do";
      return "the";
    }
    if (lang === "ga" && key === "ar") {
      if (nextKey === "chuala") return "did";
      if (nextKey === "ball") return "in";
      return "on";
    }
    if (lang === "ga" && key === "a") {
      if (nextKey === "fheiceáil") return "to";
      return "that";
    }
    if (lang === "ga" && key === "go") {
      if (nextKey === "maith") return "so";
      if (nextKey === "dtí") return "to";
      return "that";
    }
    if (lang === "ga" && key === "do") {
      if (nextKey === "mhuintir" || nextKey === "chol") return "your";
      return "to";
    }
    if (lang === "ja" && key === "の") {
      if (!next) return "right";
      return "of";
    }
    if (lang === "ja" && key === "に") {
      if (next === "いる" || next === "住んでる" || next === "住む") return "in";
      if (next === "ある") return "at";
      return "to";
    }
    return table[key] || "";
  }

  function isWordChar(ch) {
    if (ch === "'" || ch === "’" || ch === "-") return true;
    return /[\p{L}\p{M}\p{N}]/u.test(ch);
  }

  function peelToken(token, out) {
    var i = 0;
    while (i < token.length) {
      if (!isWordChar(token.charAt(i))) {
        var j = i + 1;
        while (j < token.length && !isWordChar(token.charAt(j))) j += 1;
        out.push({ kind: "plain", text: token.slice(i, j) });
        i = j;
        continue;
      }
      var k = i + 1;
      while (k < token.length && isWordChar(token.charAt(k))) k += 1;
      out.push({ kind: "word", text: token.slice(i, k) });
      i = k;
    }
  }

  function segmentJa(text) {
    var table = (window.VILLAGE_GLOSS && window.VILLAGE_GLOSS.ja) || {};
    var keys = Object.keys(table).sort(function (a, b) { return b.length - a.length; });
    var punct = "、。？！「」… ";
    var out = [];
    var i = 0;
    while (i < text.length) {
      if (punct.indexOf(text.charAt(i)) !== -1) {
        var j = i + 1;
        while (j < text.length && punct.indexOf(text.charAt(j)) !== -1) j += 1;
        out.push({ kind: "plain", text: text.slice(i, j) });
        i = j;
        continue;
      }
      var found = "";
      var n;
      for (n = 0; n < keys.length; n++) {
        if (text.slice(i, i + keys[n].length) === keys[n]) {
          found = keys[n];
          break;
        }
      }
      if (!found) {
        out.push({ kind: "word", text: text.charAt(i) });
        i += 1;
        continue;
      }
      out.push({ kind: "word", text: found });
      i += found.length;
    }
    return out;
  }

  function piecesOf(text, lang) {
    if (lang === "ja") return segmentJa(String(text || ""));
    var out = [];
    String(text || "").split(/(\s+)/).forEach(function (part) {
      if (!part) return;
      if (/^\s+$/.test(part)) out.push({ kind: "plain", text: part });
      else peelToken(part, out);
    });
    return out;
  }

  function addWords(parent, tokens) {
    var pack = langPack();
    var spoken = [];
    var english = [];
    var sayWords = [];
    var line = document.createElement("span");
    line.className = "speech";
    line.dir = pack.id === "ar" ? "rtl" : "ltr";
    line.lang = pack.voice;
    var utter = document.createElement("span");
    utter.className = "utter";
    tokens.forEach(function (tok, index) {
      if (index) {
        var gap = document.createElement("span");
        gap.className = "plain";
        gap.textContent = " ";
        utter.appendChild(gap);
      }
      var bits = piecesOf(tok.w, pack.id);
      bits.forEach(function (bit, bitIndex) {
        if (bit.kind !== "word") {
          var plain = document.createElement("span");
          plain.className = "plain";
          plain.textContent = bit.text;
          utter.appendChild(plain);
          return;
        }
        var next = "";
        var n;
        for (n = bitIndex + 1; n < bits.length; n++) {
          if (bits[n].kind === "word") {
            next = bits[n].text;
            break;
          }
        }
        var word = document.createElement("span");
        word.className = "word";
        word.tabIndex = 0;
        var face = document.createElement("span");
        face.className = "face";
        face.textContent = bit.text;
        word.appendChild(face);
        var glossText = glossFor(pack.id, bit.text, next);
        if (glossText) {
          var gloss = document.createElement("span");
          gloss.className = "gloss";
          gloss.dir = "ltr";
          gloss.textContent = glossText;
          word.appendChild(gloss);
        }
        function markWord(on) {
          word.classList.toggle("mark", on);
        }
        word.addEventListener("mouseenter", function () { markWord(true); });
        word.addEventListener("mouseleave", function () { markWord(false); });
        word.addEventListener("focus", function () { markWord(true); });
        word.addEventListener("blur", function () { markWord(false); });
        word.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          markWord(true);
          speak(bit.text, pack.voice);
        });
        sayWords.push({ text: bit.text, el: word });
        utter.appendChild(word);
      });
      spoken.push(tok.w);
      if (tok.en) english.push(tok.en);
    });
    line._sayWords = sayWords;
    line.appendChild(utter);
    var hear = document.createElement("span");
    hear.className = "hear";
    hear.tabIndex = 0;
    hear.setAttribute("role", "button");
    hear.textContent = "Hear";
    function playLine(event) {
      event.preventDefault();
      event.stopPropagation();
      speakPaced(sayWords.map(function (node) { return node.text; }), pack.voice, null, sayWords);
    }
    hear.addEventListener("click", playLine);
    hear.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") playLine(event);
    });
    utter.appendChild(document.createTextNode(" "));
    utter.appendChild(hear);
    var sense = document.createElement("span");
    sense.className = "sense";
    sense.dir = "ltr";
    sense.textContent = english.join(" ");
    line.appendChild(sense);
    parent.appendChild(line);
    return spoken.join(" ");
  }

  function fill(text) {
    var boy = state.gender === "boy";
    return text
      .replace(/\{Sub\}/g, boy ? "He" : "She")
      .replace(/\{sub\}/g, boy ? "he" : "she")
      .replace(/\{pos\}/g, boy ? "his" : "her");
  }

  function placeShot(scene) {
    var src = String(scene.image || "").split("?")[0];
    var who = state.gender === "boy" ? "boy" : "girl";
    if (src.indexOf("elder") !== -1) return "elder-" + who;
    if (src.indexOf("station") !== -1) return "station-" + who;
    if (src.indexOf("shore") !== -1) return "shore";
    if (src.indexOf("porch") !== -1) return "shop";
    return "street";
  }

  function talkBase(id, scene) {
    if (scene && scene.shot) return scene.shot;
    if (id.indexOf("scarf_") === 0) return "scarf";
    if (id.indexOf("friend_") === 0) return "friend";
    if (id.indexOf("mer_") === 0) return "mer";
    if (id.indexOf("fish_") === 0) return "fish";
    if (id.indexOf("shop_") === 0) return "shopkeep";
    if (id.indexOf("pair_") === 0) return "pair";
    if (id.indexOf("trav_") === 0) return "traveler";
    return "";
  }

  function artUrl(name) {
    return "village-art/" + (langPack().id || "es") + "/" + name + ".jpg?v=20261007q";
  }

  function womanPicture(name) {
    return "village-art/" + (langPack().id || "es") + "/" + name + ".jpg?v=20261008c";
  }

  function pictureCandidates(id, scene) {
    var urls = [];
    var base = talkBase(id, scene);
    var place = placeShot(scene);
    if (scene && scene.face) urls.push(artUrl((base || place) + "-" + scene.face));
    if (base) urls.push(artUrl(base));
    urls.push(artUrl(place));
    var unique = [];
    urls.forEach(function (url) {
      if (unique.indexOf(url) === -1) unique.push(url);
    });
    return unique;
  }

  function showPicture(id, scene) {
    var pic = scene && scene.picture;
    if (typeof pic === "function") pic = pic();
    if (pic) {
      pictureEl.src = pic;
      return;
    }
    var urls = pictureCandidates(id, scene);
    var i = 0;
    function tryNext() {
      if (i >= urls.length) return;
      var probe = new Image();
      var url = urls[i];
      probe.onload = function () { pictureEl.src = url; };
      probe.onerror = function () {
        i += 1;
        tryNext();
      };
      probe.src = url;
    }
    tryNext();
  }

  function buttons(list, onPick) {
    choicesEl.replaceChildren();
    list.forEach(function (choice) {
      var button = document.createElement("button");
      button.type = "button";
      if (choice.say) {
        addWords(button, lineTokens(choice.say));
        var say = document.createElement("span");
        say.className = "say-this";
        say.textContent = "Say this";
        button.appendChild(say);
      } else {
        button.textContent = choice.label;
      }
      button.addEventListener("click", function (event) {
        if (event.target.closest && event.target.closest(".hear, .word")) return;
        if (!choice.say) {
          onPick(choice);
          return;
        }
        if (button._skipMic) {
          onPick(choice);
          return;
        }
        if (button._busy) return;
        practiceChoice(button, choice, onPick);
      });
      choicesEl.appendChild(button);
    });
  }

  function renderNotes(day) {
    if (!notesEl) return;
    if (!day) {
      notesEl.hidden = true;
      return;
    }
    notesEl.hidden = false;
    notePlaceEl.textContent = VILLAGE_NAME;
    noteListEl.replaceChildren();
    var ids = learned(day);
    if (!ids.length) {
      var empty = document.createElement("li");
      empty.textContent = "Nothing from today yet.";
      noteListEl.appendChild(empty);
      return;
    }
    ids.forEach(function (id) {
      var item = document.createElement("li");
      item.textContent = noteText(id);
      noteListEl.appendChild(item);
    });
  }

  function showPick() {
    document.body.classList.add("picking");
    renderNotes("");
    dayEl.textContent = "";
    pictureEl.removeAttribute("src");
    pictureEl.alt = "";
    proseEl.replaceChildren();
    ["You already live here, next to Elvora.", "Elvora is the same as you."].forEach(function (text) {
      var p = document.createElement("p");
      p.textContent = text;
      proseEl.appendChild(p);
    });
    buttons(
      [
        { label: "A boy", gender: "boy" },
        { label: "A girl", gender: "girl" }
      ],
      function (choice) {
        state.gender = choice.gender;
        document.body.classList.remove("picking");
        show(state.scene || "mon_home");
      }
    );
  }

  function show(id) {
    stopVoice();
    clearGrade();
    if (!state.gender) {
      state.scene = scenes[id] ? id : "mon_home";
      showPick();
      return;
    }
    if (!scenes[id]) id = "mon_home";
    document.body.classList.remove("picking");
    state.scene = id;
    var scene = scenes[id];
    if (scene.mark) state.flags[scene.mark] = true;
    if (scene.eyes) state.flags["eyes" + scene.eyes] = true;
    if (scene.learn) addLearn(scene.learn);
    writeSave();
    dayEl.textContent = scene.day + " · " + VILLAGE_NAME + " · " + langPack().name;
    document.title = scene.day + " · " + VILLAGE_NAME + " · " + langPack().name + " — Maestro's Odyssey";
    renderNotes(scene.notesDay || scene.report || "");
    showPicture(id, scene);
    pictureEl.alt = fill(typeof scene.alt === "function" ? scene.alt() : scene.alt);
    proseEl.replaceChildren();
    var paras = typeof scene.paragraphs === "function" ? scene.paragraphs() : scene.paragraphs;
    paras.forEach(function (text) {
      var p = document.createElement("p");
      p.textContent = fill(text);
      proseEl.appendChild(p);
    });
    var sayId = scene.pick ? scene.pick() : scene.say;
    if (scene.report && !learned(scene.report).length) sayId = "";
    if (sayId) {
      var speaker = scene.speaker;
      if (typeof speaker === "function") speaker = speaker();
      if (speaker) {
        var who = document.createElement("p");
        who.className = "speaker";
        who.textContent = speaker;
        proseEl.appendChild(who);
      }
      addWords(proseEl, lineTokens(sayId));
    }
    var tail = scene.after;
    if (typeof tail === "function") tail = tail();
    if (tail && tail.length) {
      tail.forEach(function (text) {
        var p = document.createElement("p");
        p.textContent = fill(text);
        proseEl.appendChild(p);
      });
    }
    var list = typeof scene.choices === "function" ? scene.choices() : scene.choices;
    if (scene.report && !state.reports[scene.report]) list = choicesFor(scene.report);
    list = withoutRepeats(list);
    buttons(list, function (choice) {
      if (choice.say === "bye") {
        var byeId = choice.next;
        if (state.scene.indexOf("scarf_") === 0) byeId = "scarf_bye";
        else if (state.scene.indexOf("friend_") === 0) byeId = "friend_bye";
        else if (state.scene.indexOf("mer_") === 0) byeId = "mer_bye";
        else if (state.scene.indexOf("fish_") === 0) byeId = "fish_bye";
        else if (state.scene.indexOf("shop_") === 0) byeId = "shop_bye";
        else if (state.scene.indexOf("pair_") === 0) byeId = "pair_bye";
        choice.next = byeId;
      }
      if (!state.flags.eyesmon && state.scene.indexOf("scarf_") === 0) {
        var leaveHer = choice.next === "scarf_bye" || choice.next === "mon_street" || choice.next === "scarf_there";
        if (leaveHer) {
          state.afterEyes = choice.next === "scarf_there" ? "mon_street" : choice.next;
          choice.next = "mon_eyes";
        }
      }
      if (choice.doneEyes) state.afterEyes = "";
      if (choice.nextLang) {
        var total = (window.VILLAGE_LANGS || []).length || 1;
        state.langIndex = ((state.langIndex || 0) + 1) % total;
        state.scene = "mon_home";
        state.flags = {};
        state.note = "";
        state.notes = blankNotes();
        state.reports = {};
        state.said = blankSaid();
      }
      if (choice.note) state.note = choice.note;
      if (choice.clearReport) delete state.reports[choice.clearReport];
      if (choice.report) state.reports[choice.reportDay || scene.report] = choice.report;
      show(choice.next);
    });
  }

  function applyAccount(email) {
    state.email = email || "";
    if (!state.email) return;
    var row = readWho()[state.email];
    if (row && (row.gender === "boy" || row.gender === "girl")) {
      state.gender = row.gender;
      if (typeof row.langIndex === "number") state.langIndex = row.langIndex;
      if (!hardRefresh()) {
        if (row.scene && scenes[row.scene]) state.scene = row.scene;
        if (row.flags && typeof row.flags === "object") state.flags = row.flags;
        if (row.note) state.note = row.note;
        if (row.notes && typeof row.notes === "object") state.notes = row.notes;
        if (row.reports && typeof row.reports === "object") state.reports = row.reports;
        if (row.said && typeof row.said === "object") state.said = row.said;
      }
      return;
    }
    if (state.gender === "boy" || state.gender === "girl") writeWho();
  }

  function loadJson(url) {
    return fetch(url, { credentials: "include", cache: "no-store" })
      .then(function (response) { return response.json(); })
      .catch(function () { return null; });
  }

  function boot() {
    readSave();
    var started = false;
    function go() {
      if (started) return;
      started = true;
      show(state.scene);
    }
    var timer = setTimeout(go, 4000);
    Promise.all([
      loadJson("/hub/api/owner-me"),
      loadJson("/hub/api/auth/me")
    ]).then(function (pair) {
      var owner = pair[0] || {};
      var google = pair[1] || {};
      if (owner.signedIn && owner.username) {
        applyAccount("hub:" + String(owner.username).toLowerCase());
      }
      if (state.gender !== "boy" && state.gender !== "girl" && google.signedIn && google.email) {
        applyAccount(String(google.email).toLowerCase());
      }
      clearTimeout(timer);
      if (!started) go();
      else if (state.gender === "boy" || state.gender === "girl") show(state.scene);
    });
  }

  boot();
})();
