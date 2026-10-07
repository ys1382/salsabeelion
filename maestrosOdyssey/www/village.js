/* Short village. Next chapter continues from the scene id "thu_stop". */
(function () {
  var SAVE_KEY = "mo-village-short-v2";
  var VILLAGE_NAME = "Alderhart";

  var LOOKS = {
    es: {
      home: function () {
        return state.gender === "boy"
          ? "Both houses are limewashed, with clay tile roofs. His clothes are the plain daily ones men wear in this town."
          : "Both houses are limewashed, with clay tile roofs. A rebozo covers her hair.";
      },
      homeAlt: "The elder talks with a young person between two limewashed houses.",
      street: [
        "The street is one street. Limewashed houses, clay tile roofs, and a small café with a cloth awning run the whole way, and people use them together.",
        "Most of the people here are from this town. Women wear rebozos over their hair, and the men with them wear the town’s everyday clothes. They carry groceries and talk easily. A blue-green visitor walks with them, only passing through."
      ],
      streetAlt: "Townspeople in rebozos walk a limewashed street, with one blue-green visitor among them.",
      shore: [
        "The cove is quiet. Most of the people on the rocks are from this town, in work clothes, with rebozos on the women, and the nets in their hands are small. The water is clear."
      ],
      shoreAlt: "Local fishers stand on calm rocks with small nets.",
      shop: [
        "The café door is open. Limewashed walls and a cloth awning shade the step. The shopkeeper waves people in as they arrive together. Most of them are from this town, rebozos and everyday clothes passing the threshold. A visitor comes in with them. Nobody is turned away."
      ],
      shopAlt: "A shopkeeper waves townspeople in rebozos into an open café.",
      station: [
        "The platform is quiet. The little station matches the limewashed houses, and a short train waits on the track. This is the way toward the towns people have been telling you about.",
        "A traveler with a small bag stands on the boards, already looking back toward the village."
      ],
      stationAlt: "A young person from the town stands on the platform, looking at a short train."
    },
    ar: {
      home: function () {
        return state.gender === "boy"
          ? "Both houses are pale stone, with arched doors. His clothes are the plain daily ones men wear in this town."
          : "Both houses are pale stone, with arched doors. A headscarf covers her hair and neck.";
      },
      homeAlt: "The elder talks with a young person between two stone houses.",
      street: [
        "The street is one street. Pale stone houses with arched doors, and a courtyard café, run the whole way, and people use them together.",
        "Most of the people here are from this town. Women wear headscarves that cover the hair and neck, with long modest coats, and the men with them wear the town’s everyday clothes. They carry groceries and talk easily. A blue-green visitor walks with them, only passing through."
      ],
      streetAlt: "Townspeople in headscarves and long coats walk a stone street, with one blue-green visitor among them.",
      shore: [
        "The cove is quiet. Most of the people on the rocks are from this town, in work clothes, with headscarves on the women, and the nets in their hands are small. The water is clear."
      ],
      shoreAlt: "Local fishers in headscarves stand on calm rocks with small nets.",
      shop: [
        "The café door is open. Stone arches shade the step. The shopkeeper waves people in as they arrive together. Most of them are from this town, headscarves and long coats passing the threshold. A visitor comes in with them. Nobody is turned away."
      ],
      shopAlt: "A shopkeeper waves townspeople in headscarves into an open courtyard café.",
      station: [
        "The platform is quiet. The little station is pale stone, like the houses, and a short train waits on the track. This is the way toward the towns people have been telling you about.",
        "A traveler with a small bag stands on the boards, already looking back toward the village."
      ],
      stationAlt: "A young person from the town stands on the platform, looking at a short train."
    },
    ga: {
      home: function () {
        return state.gender === "boy"
          ? "Both houses are whitewashed, with stone walls. His clothes are the plain daily ones men wear in this town."
          : "Both houses are whitewashed, with stone walls. A wool shawl covers her hair.";
      },
      homeAlt: "The elder talks with a young person between two whitewashed cottages.",
      street: [
        "The street is one street. Whitewashed cottages, stone walls, and a small tea shop run the whole way, and people use them together.",
        "Most of the people here are from this town. Women wear wool shawls over their hair, and the men with them wear the town’s everyday clothes. They carry groceries and talk easily. A blue-green visitor walks with them, only passing through."
      ],
      streetAlt: "Townspeople in wool shawls walk a whitewashed lane, with one blue-green visitor among them.",
      shore: [
        "The cove is quiet. Most of the people on the rocks are from this town, in work clothes, with wool shawls on the women, and the nets in their hands are small. The water is clear."
      ],
      shoreAlt: "Local fishers in shawls stand on calm rocks with small nets.",
      shop: [
        "The tea shop door is open. Whitewashed walls shade the step. The shopkeeper waves people in as they arrive together. Most of them are from this town, wool shawls and everyday clothes passing the threshold. A visitor comes in with them. Nobody is turned away."
      ],
      shopAlt: "A shopkeeper waves townspeople in wool shawls into an open tea shop.",
      station: [
        "The platform is quiet. The little station is whitewashed, like the cottages, and a short train waits on the track. This is the way toward the towns people have been telling you about.",
        "A traveler with a small bag stands on the boards, already looking back toward the village."
      ],
      stationAlt: "A young person from the town stands on the platform, looking at a short train."
    },
    ja: {
      home: function () {
        return state.gender === "boy"
          ? "Both houses are wood, with dark tile roofs. His clothes are the plain daily ones men wear in this town."
          : "Both houses are wood, with dark tile roofs. A cloth covers her hair.";
      },
      homeAlt: "The elder talks with a young person between two wooden houses.",
      street: [
        "The street is one street. Wooden houses, dark tile roofs, and a small café with a plain curtain run the whole way, and people use them together.",
        "Most of the people here are from this town. Women wear a cloth over their hair, with modest everyday kimono, and the men with them wear plain work clothes. They carry groceries and talk easily. A blue-green visitor walks with them, only passing through."
      ],
      streetAlt: "Townspeople in modest kimono walk a wooden lane, with one blue-green visitor among them.",
      shore: [
        "The cove is quiet. Most of the people on the rocks are from this town, in work clothes, with a cloth over the women’s hair, and the nets in their hands are small. The water is clear."
      ],
      shoreAlt: "Local fishers stand on calm rocks with small nets.",
      shop: [
        "The café door is open. A plain curtain hangs in the wooden doorway. The shopkeeper waves people in as they arrive together. Most of them are from this town, modest kimono passing the threshold. A visitor comes in with them. Nobody is turned away."
      ],
      shopAlt: "A shopkeeper waves townspeople in modest kimono into an open café.",
      station: [
        "The platform is quiet. The little station is wood and tile, like the houses, and a short train waits on the track. This is the way toward the towns people have been telling you about.",
        "A traveler with a small bag stands on the boards, already looking back toward the village."
      ],
      stationAlt: "A young person from the town stands on the platform, looking at a short train."
    },
    tr: {
      home: function () {
        return state.gender === "boy"
          ? "Both houses are plaster, with red tile roofs. His clothes are the plain daily ones men wear in this town."
          : "Both houses are plaster, with red tile roofs. A headscarf is tied over her hair.";
      },
      homeAlt: "The elder talks with a young person between two plaster houses.",
      street: [
        "The street is one street. Plaster houses, red tile roofs, and a tea house run the whole way, and people use them together.",
        "Most of the people here are from this town. Women wear headscarves tied over the hair and neck, with long modest coats, and the men with them wear the town’s everyday clothes. They carry groceries and talk easily. A blue-green visitor walks with them, only passing through."
      ],
      streetAlt: "Townspeople in headscarves walk a plaster-house street, with one blue-green visitor among them.",
      shore: [
        "The cove is quiet. Most of the people on the rocks are from this town, in work clothes, with headscarves on the women, and the nets in their hands are small. The water is clear."
      ],
      shoreAlt: "Local fishers in headscarves stand on calm rocks with small nets.",
      shop: [
        "The tea house door is open. Plaster walls and red tile shade the step. The shopkeeper waves people in as they arrive together. Most of them are from this town, headscarves and long coats passing the threshold. A visitor comes in with them. Nobody is turned away."
      ],
      shopAlt: "A shopkeeper waves townspeople in headscarves into an open tea house.",
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

  var scenes = {
    mon_home: {
      day: "Monday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: function () { return look().homeAlt; },
      paragraphs: function () {
        return [
          "You are already home in Alderhart. The house next to yours is the elder’s, and the gate between them has been there longer than this morning.",
          look().home(),
          "{Sub} leans on {pos} stick."
        ];
      },
      speaker: "The elder says",
      say: "mon_home",
      choices: [{ label: "Go to the street.", next: "mon_street" }]
    },
    mon_street: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: function () { return look().streetAlt; },
      paragraphs: function () { return look().street; },
      choices: [
        { say: "ch_hi_scarf", next: "scarf_hi" },
        { say: "ch_hi_friend", next: "friend_hi" },
        { label: "Back to the elder.", next: "mon_return" }
      ]
    },
    scarf_hi: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: "A neighbor in a headscarf smiles, groceries in her arms.",
      paragraphs: ["She shifts the bag and makes room for you on the lane."],
      speaker: "A neighbor in a headscarf says",
      say: "scarf_well",
      choices: [
        { say: "ask_towns", next: "scarf_there" },
        { say: "bye", next: "mon_street" }
      ]
    },
    scarf_there: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: "A neighbor in a headscarf keeps walking with her neighbors.",
      paragraphs: ["She glances toward the hills, then back at the street you share."],
      speaker: "A neighbor in a headscarf says",
      say: "scarf_apart",
      learn: "mon-walk",
      mark: "street",
      choices: [
        { say: "bye", next: "mon_street" }
      ]
    },
    scarf_bad: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: "A neighbor in a headscarf answers gently.",
      paragraphs: ["She does not lower her voice. This street is not the place she means."],
      speaker: "A neighbor in a headscarf says",
      say: "scarf_little",
      mark: "street",
      choices: [
        { say: "ask_family", next: "scarf_family" },
        { say: "bye", next: "mon_street" }
      ]
    },
    scarf_family: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: "A neighbor in a headscarf speaks about family far away.",
      paragraphs: ["She nods toward the road out of town."],
      speaker: "A neighbor in a headscarf says",
      say: "scarf_family",
      mark: "street",
      choices: [
        { say: "ask_towns", next: "scarf_there" },
        { say: "bye", next: "mon_street" }
      ]
    },
    friend_hi: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: "The pale neighbor with the groceries turns to you.",
      paragraphs: ["He is walking in step with her. He looks glad you stopped."],
      speaker: "Her neighbor says",
      say: "friend_far",
      choices: [
        { say: "ask_cousin", next: "friend_there" },
        { say: "bye", next: "mon_street" }
      ]
    },
    friend_there: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: "The neighbor talks, still among friends.",
      paragraphs: ["He keeps his voice ordinary. The news is not about this lane."],
      speaker: "Her neighbor says",
      say: "friend_apart",
      learn: "mon-letter",
      mark: "street",
      choices: [
        { say: "bye", next: "mon_street" }
      ]
    },
    friend_here: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: "The neighbor smiles at the shared street.",
      paragraphs: ["He tips his head at the benches, the lamps, the people passing."],
      speaker: "Her neighbor says",
      say: "friend_here",
      mark: "street",
      choices: [
        { say: "ask_cousin", next: "friend_there" },
        { say: "bye", next: "mon_street" }
      ]
    },
    mon_return: {
      day: "Monday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "The elder listens at the gate.",
      paragraphs: function () { return reportIntro("mon"); },
      speaker: "The elder says",
      say: "report_ask",
      report: "mon",
      choices: []
    },
    mon_said: {
      day: "Monday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "The elder listens at the gate.",
      paragraphs: function () { return reportTaken("mon"); },
      notesDay: "mon",
      choices: function () { return afterReport("mon", "tue_home"); }
    },
    tue_home: {
      day: "Tuesday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "The elder speaks with you at the cottage gate.",
      paragraphs: function () {
        return [morningEcho("mon"), "{Sub} is at the gate."];
      },
      speaker: "The elder says",
      pick: function () {
        return state.reports.mon && state.reports.mon !== "none" ? "tue_open_yes" : "tue_open_no";
      },
      choices: [{ label: "Go to the shore.", next: "tue_shore" }]
    },
    tue_shore: {
      day: "Tuesday",
      image: "village-art/shore-calm.jpg?v=20261006n",
      alt: function () { return look().shoreAlt; },
      paragraphs: function () { return look().shore; },
      choices: [
        { say: "ch_hi_mer", next: "mer_hi" },
        { say: "ch_hi_fish", next: "fish_hi" },
        { label: "Back to the elder.", next: "tue_return" }
      ]
    },
    mer_hi: {
      day: "Tuesday",
      image: "village-art/shore-calm.jpg?v=20261006n",
      alt: "A blue-green person with a small net turns to you.",
      paragraphs: ["They rest the net on the rock and make space beside them."],
      speaker: "A person on the rocks says",
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
      alt: "The person on the rocks looks out toward a far shore.",
      paragraphs: ["They nod at the far water, not at the cove under your feet."],
      speaker: "A person on the rocks says",
      say: "mer_there",
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
      paragraphs: ["They lift their net so you can see how small it is."],
      speaker: "A person on the rocks says",
      say: "mer_net",
      learn: "tue-net",
      mark: "shore",
      choices: [
        { say: "bye", next: "tue_shore" }
      ]
    },
    fish_hi: {
      day: "Tuesday",
      image: "village-art/shore-calm.jpg?v=20261006n",
      alt: "A fisher in a long coat stands with the others.",
      paragraphs: ["He has been talking with them already. He includes you without a fuss."],
      speaker: "A fisher says",
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
      alt: "The fisher looks toward distant water.",
      paragraphs: ["He means a shore you cannot see from here."],
      speaker: "A fisher says",
      say: "fish_there",
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
      paragraphs: ["He watches the cove, easy about it."],
      speaker: "A fisher says",
      say: "fish_water",
      choices: [
        { say: "bye", next: "tue_shore" }
      ]
    },
    tue_return: {
      day: "Tuesday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "The elder nods at the cottage gate.",
      paragraphs: function () { return reportIntro("tue"); },
      speaker: "The elder says",
      say: "report_ask",
      report: "tue",
      choices: []
    },
    tue_said: {
      day: "Tuesday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "The elder nods at the cottage gate.",
      paragraphs: function () { return reportTaken("tue"); },
      notesDay: "tue",
      choices: function () { return afterReport("tue", "wed_home"); }
    },
    wed_home: {
      day: "Wednesday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "The elder at the gate on a quieter morning.",
      paragraphs: function () {
        return [morningEcho("tue"), "{Sub} is at the gate."];
      },
      speaker: "The elder says",
      pick: function () {
        return state.reports.tue && state.reports.tue !== "none" ? "wed_open_yes" : "wed_open_no";
      },
      choices: [{ label: "Go to the shop.", next: "wed_porch" }]
    },
    wed_porch: {
      day: "Wednesday",
      image: "village-art/porch-open.jpg?v=20261006n",
      alt: function () { return look().shopAlt; },
      paragraphs: function () { return look().shop; },
      choices: [
        { say: "ch_hi_shop", next: "shop_hi" },
        { say: "ch_hi_pair", next: "pair_hi" },
        { label: "Back to the elder.", next: "wed_return" }
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
      learn: "wed-pair",
      mark: "shop",
      choices: [
        { say: "bye", next: "wed_porch" }
      ]
    },
    wed_return: {
      day: "Wednesday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "The elder at the gate.",
      paragraphs: function () { return reportIntro("wed"); },
      speaker: "The elder says",
      say: "report_ask",
      report: "wed",
      choices: []
    },
    wed_said: {
      day: "Wednesday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "The elder at the gate.",
      paragraphs: function () { return reportTaken("wed"); },
      notesDay: "wed",
      choices: function () { return afterReport("wed", "thu_home"); }
    },
    thu_home: {
      day: "Thursday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "The elder stays by the cottages while the lane leads away.",
      paragraphs: function () {
        return [morningEcho("wed"), "{Sub} stays by the houses. You walk the last of the lane alone."];
      },
      speaker: "The elder says",
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
        { say: "ch_tomorrow", next: "thu_stop", note: "from" }
      ]
    },
    trav_how: {
      day: "Thursday",
      image: "village-art/station.jpg?v=20261006b",
      alt: "The traveler speaks of towns that live apart.",
      paragraphs: ["They mean the places past this line, not the village behind you."],
      speaker: "The traveler says",
      say: "trav_how",
      choices: [
        { say: "ch_tomorrow", next: "thu_stop", note: "how" }
      ]
    },
    trav_stay: {
      day: "Thursday",
      image: "village-art/station.jpg?v=20261006b",
      alt: "The traveler looks back toward the village.",
      paragraphs: ["They are not settling a bag on the train."],
      speaker: "The traveler says",
      say: "trav_stay",
      choices: [
        { say: "ch_tomorrow", next: "thu_stop", note: "stay" }
      ]
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
    "mon-walk": "She stays with her neighbors on this street, and it is bad there.",
    "mon-letter": "He stays with her on this street, and they are not here.",
    "tue-cove": "They are at this water, and the water is bad there.",
    "tue-net": "The net in their hands is small.",
    "tue-fish": "He is fishing here with the others, and there they do not fish.",
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

  function heardSentence(day) {
    return learned(day).map(function (id) {
      return NOTES[id] || "";
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
    if (!learned(day).length) return ["You are back at the gate. You have no notes from today yet."];
    return [
      "{Sub} is at the gate. Your notes are beside you.",
      "These are the notes from what you noticed today."
    ];
  }

  function reportTaken(day) {
    var id = state.reports[day];
    if (id && id === rightReport(day)) {
      return ["{Sub} takes that in. That is what your notes add up to about " + VILLAGE_NAME + "."];
    }
    return ["{Sub} takes that in. It is a fair reading of part of the day."];
  }

  function afterReport(day, next) {
    var right = rightReport(day);
    var list = [];
    if (state.reports[day] && right && state.reports[day] !== right) {
      list.push({ label: "Choose again.", clearReport: day, next: day + "_return" });
    }
    list.push({ label: "Leave it until tomorrow.", next: next });
    return list;
  }

  function choicesFor(day) {
    var pack = reportPack(day);
    if (!pack) {
      return [
        { label: BACK[day][0], next: BACK[day][1] },
        { label: "Leave it until tomorrow.", report: "none", reportDay: day, next: NEXT[day] }
      ];
    }
    return pack.options.map(function (option) {
      return { label: option.label, report: option.id, reportDay: day, next: day + "_said" };
    });
  }

  function morningEcho(day) {
    var id = state.reports[day];
    if (!id) return "The morning is quiet at the gate.";
    if (id === "none") return "You did not bring a reading back. {Sub} does not fill one in for you.";
    var heard = heardSentence(day);
    if (!heard) return "{Sub} answers from what you brought back.";
    var pack = reportPack(day);
    if (pack && id === pack.right) {
      var ids = learned(day);
      if (ids.length === 1 && ids[0] === "tue-net") {
        return "{Sub} answers from the reading you gave: " + heard + " That is the net in their hands, here.";
      }
      if (ids.indexOf("tue-net") !== -1) {
        return "{Sub} answers from the reading you gave: " + heard + " The small net is here in their hands. The rest is about somewhere else.";
      }
      return "{Sub} answers from the reading you gave: " + heard + " They were here together. What they named is somewhere else.";
    }
    return "{Sub} answers the part you named: " + heard;
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
  var WORD_GAP_MS = 900;
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

  function pictureFor(scene) {
    var src = String(scene.image || "").split("?")[0];
    var shot = "street";
    var who = state.gender === "boy" ? "boy" : "girl";
    if (src.indexOf("elder") !== -1) shot = "elder-" + who;
    else if (src.indexOf("station") !== -1) shot = "station-" + who;
    else if (src.indexOf("shore") !== -1) shot = "shore";
    else if (src.indexOf("porch") !== -1) shot = "shop";
    return "village-art/" + (langPack().id || "es") + "/" + shot + ".jpg?v=20261007a";
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
      item.textContent = NOTES[id] || "";
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
    ["You already live here, next to the elder.", "The elder is the same as you."].forEach(function (text) {
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
    if (scene.learn) addLearn(scene.learn);
    writeSave();
    dayEl.textContent = scene.day + " · " + VILLAGE_NAME + " · " + langPack().name;
    document.title = scene.day + " · " + VILLAGE_NAME + " · " + langPack().name + " — Maestro's Odyssey";
    renderNotes(scene.notesDay || scene.report || "");
    pictureEl.src = pictureFor(scene);
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
      if (scene.speaker) {
        var who = document.createElement("p");
        who.className = "speaker";
        who.textContent = scene.speaker;
        proseEl.appendChild(who);
      }
      addWords(proseEl, lineTokens(sayId));
    }
    var list = typeof scene.choices === "function" ? scene.choices() : scene.choices;
    if (scene.report && !state.reports[scene.report]) list = choicesFor(scene.report);
    list = withoutRepeats(list);
    buttons(list, function (choice) {
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
