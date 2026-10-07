/* Short village. Next chapter continues from the scene id "thu_stop". */
(function () {
  var SAVE_KEY = "mo-village-short-v2";
  var VILLAGE_NAME = "Alderhart";

  var scenes = {
    mon_home: {
      day: "Monday",
      image: "village-art/elder.jpg?v=20261006b",
      alt: "The elder talks with a young person between two cottages.",
      paragraphs: [
        "You are already home in Alderhart. The cottage next to yours is the elder’s, and the gate between them has been there longer than this morning.",
        "{Sub} leans on {pos} stick."
      ],
      speaker: "The elder says",
      say: "mon_home",
      choices: [{ label: "Go to the street.", next: "mon_street" }]
    },
    mon_street: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: "Four neighbors walk one village street together, talking and carrying groceries.",
      paragraphs: [
        "The street is one street. Lamps, benches, and flower boxes run the whole way, and people use them together.",
        "A woman in a headscarf and a pale neighbor carry groceries between them, talking easily. A blue-green neighbor walks with them, and a man in a long coat laughs at something just said."
      ],
      choices: [
        { say: "ch_hi_scarf", next: "scarf_hi" },
        { say: "ch_hi_friend", next: "friend_hi" },
        { label: "Back to the elder.", next: "mon_return" }
      ]
    },
    scarf_hi: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: "The woman in the headscarf smiles, groceries in her arms.",
      paragraphs: ["She shifts the bag and makes room for you on the lane."],
      speaker: "The woman in the headscarf says",
      say: "scarf_well",
      choices: [
        { say: "ask_towns", next: "scarf_there" },
        { say: "bye", next: "mon_street" }
      ]
    },
    scarf_there: {
      day: "Monday",
      image: "village-art/street-together.jpg?v=20261006n",
      alt: "The woman in the headscarf keeps walking with her neighbors.",
      paragraphs: ["She glances toward the hills, then back at the street you share."],
      speaker: "The woman in the headscarf says",
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
      alt: "The woman in the headscarf answers gently.",
      paragraphs: ["She does not lower her voice. This street is not the place she means."],
      speaker: "The woman in the headscarf says",
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
      alt: "The woman in the headscarf speaks about family far away.",
      paragraphs: ["She nods toward the road out of town."],
      speaker: "The woman in the headscarf says",
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
      alt: "Merfolk and fishers stand together on calm rocks with small nets.",
      paragraphs: [
        "The cove is quiet. People with blue-green faces stand on the rocks in work coats beside the fishers. The nets in their hands are small, the kind for water this size. The water is clear."
      ],
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
      learn: "tue-cove",
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
      alt: "A shopkeeper waves neighbors into an open shop.",
      paragraphs: [
        "The shop door is open. The shopkeeper waves people in as they arrive together. Baskets, coats, and headscarves pass the threshold in no hurry. Nobody is turned away."
      ],
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
        return [morningEcho("wed"), "{Sub} stays by the cottages. You walk the last of the lane alone."];
      },
      speaker: "The elder says",
      say: "thu_home",
      choices: [{ label: "Go to the station.", next: "thu_station" }]
    },
    thu_station: {
      day: "Thursday",
      image: "village-art/station.jpg?v=20261006b",
      alt: "A young person stands on a wooden platform, looking at a short train.",
      paragraphs: [
        "The platform is quiet. A short train waits on the track. This is the way toward the towns people have been telling you about.",
        "A traveler with a small bag stands on the boards, already looking back toward the village."
      ],
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
    "mon-walk": "She glanced toward the hills, then back at the neighbors beside her, when other towns came up.",
    "mon-letter": "His cousin's letter came from another town. He kept walking in step with her while he told it.",
    "tue-cove": "On the rocks they talked about what is farther out, and the small net stayed in their hands.",
    "tue-fish": "He was already among them. Farther off, he said, people do not fish together.",
    "wed-door": "His hand stayed open toward his own door while he spoke of a friend turned away somewhere else.",
    "wed-pair": "They were going in side by side. She looked down the road, not at him, when she said other towns would refuse that."
  };

  var REPORTS = {
    mon: {
      both: {
        right: "mon-sum",
        options: [
          { id: "mon-kinder", label: "Alderhart is simply kinder than those other towns, and kindness is the whole story." },
          { id: "mon-letter-place", label: "The cousin's letter is the real news. The street was only where he happened to say it." },
          { id: "mon-sum", label: "In Alderhart they keep sharing the street while news arrives that other towns keep people apart. The walk is the life that news is set against." }
        ]
      },
      "mon-walk": {
        right: "mon-walk-full",
        options: [
          { id: "mon-walk-chat", label: "She was only making talk about far-off places. It does not bear on life in Alderhart." },
          { id: "mon-walk-hills", label: "The trouble is off toward the hills she looked at. This street stands aside from it." },
          { id: "mon-walk-full", label: "She could look toward other towns and still be in the middle of a shared walk in Alderhart. The separation is elsewhere. The company is here." }
        ]
      },
      "mon-letter": {
        right: "mon-letter-full",
        options: [
          { id: "mon-letter-private", label: "A family letter is private news. Daily life in Alderhart is a separate matter." },
          { id: "mon-letter-worry", label: "He is worried about his cousin. Alderhart is only the place he happened to say so." },
          { id: "mon-letter-full", label: "He could speak of a town that keeps people apart without stepping out of the walk he was already sharing in Alderhart." }
        ]
      }
    },
    tue: {
      both: {
        right: "tue-sum",
        options: [
          { id: "tue-water", label: "The far water is the story. This cove is only a quiet contrast." },
          { id: "tue-calm", label: "They fish together because the day is calm, not because the farther trouble matters." },
          { id: "tue-sum", label: "On Alderhart's cove the shared work is what they are doing. What is worse, or more divided, is the water they are not standing in." }
        ]
      },
      "tue-cove": {
        right: "tue-cove-full",
        options: [
          { id: "tue-cove-far", label: "They were really talking about a different shore. The net in their hands was beside the point." },
          { id: "tue-cove-tools", label: "It was a practical remark about nets and dirty water, with no bearing on who stands together." },
          { id: "tue-cove-full", label: "They could describe a harder shore somewhere else without putting down the small net they were using here in Alderhart." }
        ]
      },
      "tue-fish": {
        right: "tue-fish-full",
        options: [
          { id: "tue-fish-them", label: "He was describing other people's habits. His own company on the rocks was incidental." },
          { id: "tue-fish-news", label: "The news is that some shores do not share the work. Alderhart's cove was just the setting." },
          { id: "tue-fish-full", label: "He named a place where people do not fish together, while he himself was already among them on Alderhart's cove." }
        ]
      }
    },
    wed: {
      both: {
        right: "wed-sum",
        options: [
          { id: "wed-rude", label: "The shopkeeper is generous, and the other towns are simply rude." },
          { id: "wed-road", label: "What matters is the road she looked down. This doorway is incidental." },
          { id: "wed-sum", label: "Alderhart's shop door stays open to people arriving together. The refusal they describe belongs on another town's threshold." }
        ]
      },
      "wed-door": {
        right: "wed-door-full",
        options: [
          { id: "wed-door-kind", label: "He is a kind shopkeeper. The friend he mentioned belongs to a different story." },
          { id: "wed-door-shut", label: "The point is that somewhere a door is shut. His open hand was only a gesture." },
          { id: "wed-door-full", label: "He could speak of a friend turned away somewhere else while his own hand stayed open toward Alderhart's door." }
        ]
      },
      "wed-pair": {
        right: "wed-pair-full",
        options: [
          { id: "wed-pair-them", label: "She was speaking about her own pair, not about how Alderhart keeps a door." },
          { id: "wed-pair-road", label: "The road she looked down is the real subject. Going in together was just how they were standing." },
          { id: "wed-pair-full", label: "She could say that other towns would refuse them, while the two of them were already crossing Alderhart's threshold together." }
        ]
      }
    }
  };

  var ECHO = {
    "mon-sum": "{Sub} answers from the reading you gave: in Alderhart, people keep sharing the street while news of separation comes from outside.",
    "mon-kinder": "{Sub} answers the part you named: that Alderhart is simply kinder.",
    "mon-letter-place": "{Sub} answers the part you named: the cousin's letter, as if the street were only where he said it.",
    "mon-walk-full": "{Sub} answers from the reading you gave: other towns can be looked toward, and the shared walk in Alderhart still holds.",
    "mon-walk-chat": "{Sub} answers the part you named: far-off talk, with no bearing on Alderhart.",
    "mon-walk-hills": "{Sub} answers the part you named: trouble toward the hills, and this street aside from it.",
    "mon-letter-full": "{Sub} answers from the reading you gave: he could name a divided town and stay inside the walk he was sharing.",
    "mon-letter-private": "{Sub} answers the part you named: a private letter, separate from Alderhart's day.",
    "mon-letter-worry": "{Sub} answers the part you named: a cousin's worry, spoken here only by chance.",
    "tue-sum": "{Sub} answers from the reading you gave: the shared cove is the work, and the harder water is the water they are not standing in.",
    "tue-water": "{Sub} answers the part you named: the far water, with this cove as a contrast.",
    "tue-calm": "{Sub} answers the part you named: a calm day of fishing, and the farther trouble left aside.",
    "tue-cove-full": "{Sub} answers from the reading you gave: they could describe a harder shore and keep the small net in their hands.",
    "tue-cove-far": "{Sub} answers the part you named: a different shore, and the net beside the point.",
    "tue-cove-tools": "{Sub} answers the part you named: nets and dirty water, as a practical remark.",
    "tue-fish-full": "{Sub} answers from the reading you gave: he named a divided shore while already standing among the others.",
    "tue-fish-them": "{Sub} answers the part you named: other people's habits, and his company left incidental.",
    "tue-fish-news": "{Sub} answers the part you named: shores that do not share the work.",
    "wed-sum": "{Sub} answers from the reading you gave: Alderhart's door stays open to people together, and the refusal belongs somewhere else.",
    "wed-rude": "{Sub} answers the part you named: a kind shopkeeper, and rude towns elsewhere.",
    "wed-road": "{Sub} answers the part you named: the road she looked down, and the doorway left incidental.",
    "wed-door-full": "{Sub} answers from the reading you gave: a friend turned away elsewhere, and his hand still open toward this door.",
    "wed-door-kind": "{Sub} answers the part you named: a kind shopkeeper.",
    "wed-door-shut": "{Sub} answers the part you named: a shut door somewhere else.",
    "wed-pair-full": "{Sub} answers from the reading you gave: other towns would refuse them, and they were already crossing this threshold together.",
    "wed-pair-them": "{Sub} answers the part you named: the pair themselves, not the door.",
    "wed-pair-road": "{Sub} answers the part you named: the road, and going in together left as how they stood.",
    none: "You did not bring a reading back. {Sub} does not fill one in for you."
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

  function reportPack(day) {
    var ids = learned(day);
    var book = REPORTS[day];
    if (!book || !ids.length) return null;
    if (ids.length >= 2 && book.both) return book.both;
    return book[ids[0]] || null;
  }

  function rightReport(day) {
    var pack = reportPack(day);
    return pack ? pack.right : "";
  }

  function reportIntro(day) {
    if (!learned(day).length) return ["You are back at the gate. You have no notes from today yet."];
    return [
      "{Sub} is at the gate. Your notes are beside you.",
      "This is what you are learning about " + VILLAGE_NAME + " and the people who live here."
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
    return ECHO[id] || ECHO.none;
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
    reports: {}
  };
  var voices = [];

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
        reports: state.reports || {}
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
          reports: state.reports || {}
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

  function speak(text, voiceLang) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voiceLang;
    utterance.rate = 0.85;
    var want = String(voiceLang || "").slice(0, 2).toLowerCase();
    var match = voices.filter(function (voice) {
      return String(voice.lang || "").toLowerCase().indexOf(want) === 0;
    })[0];
    if (match) utterance.voice = match;
    window.speechSynthesis.speak(utterance);
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
        utter.appendChild(word);
      });
      spoken.push(tok.w);
      if (tok.en) english.push(tok.en);
    });
    line.appendChild(utter);
    var hear = document.createElement("span");
    hear.className = "hear";
    hear.tabIndex = 0;
    hear.setAttribute("role", "button");
    hear.textContent = "Hear";
    function playLine(event) {
      event.preventDefault();
      event.stopPropagation();
      speak(spoken.join(" "), pack.voice);
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
    if (src.indexOf("elder.jpg") !== -1) src = "village-art/elder-" + state.gender + ".jpg";
    else if (src.indexOf("station.jpg") !== -1 && state.gender === "girl") src = "village-art/station-girl.jpg";
    return src + "?v=20261006c";
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
      button.addEventListener("click", function () {
        onPick(choice);
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
    pictureEl.alt = fill(scene.alt);
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
    buttons(list, function (choice) {
      if (choice.nextLang) {
        var total = (window.VILLAGE_LANGS || []).length || 1;
        state.langIndex = ((state.langIndex || 0) + 1) % total;
        state.scene = "mon_home";
        state.flags = {};
        state.note = "";
        state.notes = blankNotes();
        state.reports = {};
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
