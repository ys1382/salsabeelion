/* Short village. Next chapter continues from the scene id "thu_stop". */
(function () {
  var SAVE_KEY = "mo-village-short-v1";

  var scenes = {
    mon_home: {
      day: "Monday",
      image: "village-art/elder.jpg",
      alt: "An older woman with a walking stick talks with a young person between two cottages.",
      paragraphs: [
        "You are already home. The cottage next to yours is the elder’s, and the gate between them has been there longer than this morning.",
        "She leans on her stick. “I used to walk this county and keep good terms with the other peoples. I cannot take the road the way I used to. So you will. Not the far road yet. Today, the split street. Come back and tell me what you saw, not what you guessed.”"
      ],
      choices: [{ label: "Go to the split street.", next: "mon_street" }]
    },
    mon_street: {
      day: "Monday",
      image: "village-art/street.jpg",
      alt: "A town divided by a grass strip. Both sides are equally kept. A woman in a headscarf talks with a neighbor. One man frowns across the gap. Pale people shop on the far side.",
      paragraphs: [
        "A wide grass strip divides the town. Both sides have the same lamps, the same benches, the same flowers. People stay on their own side, and most of them look content.",
        "On your side, a woman in a headscarf laughs with an older neighbor over a bag of groceries. Farther down, one man frowns across the grass with his arms folded. On the other side, pale people in ordinary coats shop and talk. Nobody crosses. Nobody shouts."
      ],
      choices: [
        {
          label: "Both sides are kept the same. Most people accept the gap. One man does not.",
          next: "mon_heard"
        },
        {
          label: "The woman in the headscarf is being hounded.",
          next: "mon_scarf"
        },
        {
          label: "The pale people are the trouble.",
          next: "mon_blame"
        }
      ]
    },
    mon_heard: {
      day: "Monday",
      image: "village-art/elder.jpg",
      alt: "The elder listens at the gate between the cottages.",
      paragraphs: [
        "She nods. “Yes. The peace is real, and so is the gap. They think living apart, equally kept, is enough. One sour face is how a gap turns into the old harm. Rest. Tomorrow is the shore.”"
      ],
      choices: [{ label: "Leave it until tomorrow.", next: "tue_home" }]
    },
    mon_scarf: {
      day: "Monday",
      image: "village-art/elder.jpg",
      alt: "The elder waits, leaning on her stick.",
      paragraphs: [
        "“Look again, dear. She was welcome. A headscarf is an ordinary thing here. See whether the two sides are kept the same, and who is actually sour.”"
      ],
      choices: [{ label: "Look again.", next: "mon_street" }]
    },
    mon_blame: {
      day: "Monday",
      image: "village-art/elder.jpg",
      alt: "The elder waits, leaning on her stick.",
      paragraphs: [
        "“They were only shopping. Do not put the trouble on a whole people. The gap is the trouble, and the one man glaring across it. Go see that.”"
      ],
      choices: [{ label: "Look again.", next: "mon_street" }]
    },
    tue_home: {
      day: "Tuesday",
      image: "village-art/elder.jpg",
      alt: "The elder speaks with you at the cottage gate in the morning light.",
      paragraphs: [
        "“The shore today. Terms with the merfolk are tight. Do not pick anything up. Listen, and tell me what the water is holding.”"
      ],
      choices: [{ label: "Go to the shore.", next: "tue_shore" }]
    },
    tue_shore: {
      day: "Tuesday",
      image: "village-art/shore.jpg",
      alt: "Merfolk in work coats stand on the rocks. Fishers hold a wide net. A thin oil sheen colors the water.",
      paragraphs: [
        "People with blue-green faces stand on the rocks in work coats. Out on the cove, fishers hold a net too wide for this water. A thin rainbow film lies on the surface. Both sides watch. Nobody raises a hand."
      ],
      choices: [
        {
          label: "The net is too wide, and there is oil on the water. They are tense, not fighting.",
          next: "tue_heard"
        },
        { label: "Haul the net in.", next: "tue_hands" },
        { label: "The merfolk are only angry at fishing.", next: "tue_mood" }
      ]
    },
    tue_hands: {
      day: "Tuesday",
      image: "village-art/shore.jpg",
      alt: "You stay on the rocks above the cove and the wide net.",
      paragraphs: [
        "You step toward the water and stop. The net is not yours to lift, and taking it would not make the terms any better. You stay on the rocks and look."
      ],
      choices: [{ label: "Look again.", next: "tue_shore" }]
    },
    tue_mood: {
      day: "Tuesday",
      image: "village-art/elder.jpg",
      alt: "The elder listens at the gate.",
      paragraphs: [
        "“Anger is not the whole of it. Look at what is in the water, and how wide that net is. Then tell me the harm, not a mood.”"
      ],
      choices: [{ label: "Look again.", next: "tue_shore" }]
    },
    tue_heard: {
      day: "Tuesday",
      image: "village-art/elder.jpg",
      alt: "The elder nods at the cottage gate.",
      paragraphs: [
        "“Tight, and still peace. The harm is the net and the slick, not a battle. You left it in their hands. That is right for now. Tomorrow, the shop porch.”"
      ],
      choices: [{ label: "Leave it until tomorrow.", next: "wed_home" }]
    },
    wed_home: {
      day: "Wednesday",
      image: "village-art/elder.jpg",
      alt: "The elder at the gate on a quieter morning.",
      paragraphs: [
        "“The shop porch. A cold look can miss its mark and hit the person standing beside it. See where it lands. Then come home.”"
      ],
      choices: [{ label: "Go to the shop porch.", next: "wed_porch" }]
    },
    wed_porch: {
      day: "Wednesday",
      image: "village-art/porch.jpg",
      alt: "A pale vampire and a human neighbor stand on a shop porch while the shopkeeper looks at both of them.",
      paragraphs: [
        "A vampire in an ordinary coat waits on the porch beside a human neighbor. The shopkeeper’s face goes cold. The look is aimed at the vampire, and it does not stop there. It takes in the human too, as if standing together were the offense. The other customers keep to their own errands."
      ],
      choices: [
        {
          label: "The look was for the vampire, and it landed on the human beside them.",
          next: "wed_heard"
        },
        { label: "Step away before it matters.", next: "wed_leave" },
        { label: "Tell the human to move away from the vampire.", next: "wed_move" }
      ]
    },
    wed_leave: {
      day: "Wednesday",
      image: "village-art/elder.jpg",
      alt: "The elder waits for a clearer account.",
      paragraphs: [
        "“If you leave, you do not know who the look hit. Go back and see. It is safe. It is only a porch.”"
      ],
      choices: [{ label: "Look again.", next: "wed_porch" }]
    },
    wed_move: {
      day: "Wednesday",
      image: "village-art/elder.jpg",
      alt: "The elder shakes her head, gently.",
      paragraphs: [
        "“That is the look doing its work through you. The human was only standing there. Go back and see who it actually lands on.”"
      ],
      choices: [{ label: "Look again.", next: "wed_porch" }]
    },
    wed_heard: {
      day: "Wednesday",
      image: "village-art/elder.jpg",
      alt: "The elder at the gate, ready to send you on.",
      paragraphs: [
        "“Yes. Prejudice aimed at one person can mark the person next to them. You saw it, and you did not pass it on. Tomorrow I can send you as far as the station. I will not be taking the train.”"
      ],
      choices: [{ label: "Leave it until tomorrow.", next: "thu_home" }]
    },
    thu_home: {
      day: "Thursday",
      image: "village-art/elder.jpg",
      alt: "The elder stays by the cottages while the lane leads away.",
      paragraphs: [
        "“You saw the gap, the shore, and the porch. That is enough for the station. I cannot travel the way I used to, so you walk the last of this lane alone. Do not board. Arriving is the work for today. The line after that can wait until we continue.”"
      ],
      choices: [{ label: "Go to the station.", next: "thu_station" }]
    },
    thu_station: {
      day: "Thursday",
      image: "village-art/station.jpg",
      alt: "A young person stands on a wooden platform, looking at a short train in the trees.",
      paragraphs: [
        "The platform is quiet. A short train waits on the track. You are here because she asked you to see that the way out is real, and to stop.",
        "The county past this platform is the same job: keeping terms where old harm still has a shadow. Not today."
      ],
      choices: [{ label: "This is as far as today goes.", next: "thu_stop" }]
    },
    thu_stop: {
      day: "Thursday",
      image: "village-art/station.jpg",
      alt: "The train waits at the forest platform. You stay on the boards.",
      paragraphs: [
        "You stay on the platform. The train does not leave with you. When the next part starts, it starts here."
      ],
      choices: [{ label: "Walk these days again.", next: "mon_home" }]
    }
  };

  var dayEl = document.getElementById("day");
  var pictureEl = document.getElementById("picture");
  var proseEl = document.getElementById("prose");
  var choicesEl = document.getElementById("choices");

  function readSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return "mon_home";
      var data = JSON.parse(raw);
      if (data && scenes[data.scene]) return data.scene;
    } catch (err) {}
    return "mon_home";
  }

  function writeSave(id) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ scene: id }));
    } catch (err) {}
  }

  function show(id) {
    if (!scenes[id]) id = "mon_home";
    var scene = scenes[id];
    writeSave(id);
    dayEl.textContent = scene.day;
    pictureEl.src = scene.image;
    pictureEl.alt = scene.alt;
    proseEl.replaceChildren();
    scene.paragraphs.forEach(function (text) {
      var p = document.createElement("p");
      p.textContent = text;
      proseEl.appendChild(p);
    });
    choicesEl.replaceChildren();
    scene.choices.forEach(function (choice) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.label;
      button.addEventListener("click", function () {
        show(choice.next);
      });
      choicesEl.appendChild(button);
    });
  }

  show(readSave());
})();
