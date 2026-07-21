(function () {
  "use strict";

  var STORAGE_KEY = "habitTree.v0";
  var CARE_PER_STAGE = 10;

  var STAGE_LABELS = {
    hatch: ["Egg", "Cracking", "Hatched", "Grown"],
    grow: ["Young", "Growing", "Nearly grown", "Grown"],
    mantis: [
      "Egg case",
      "Hatching",
      "Hatched",
      "Growing",
      "Blooming",
      "Full bloom",
      "Poised",
      "Graceful",
      "Refined",
      "Radiant",
      "Noble",
      "Resplendent",
      "Luminous",
      "Ethereal",
      "Ornate",
      "Timeless",
    ],
  };

  var MANTIS_FRAMES = 16;
  var MANTIS_BLOOM = 5;

  /* After adult, creature elegance keeps changing — not the scenery. */
  var ELEGANCE_LABELS = [
    "Poised",
    "Graceful",
    "Refined",
    "Radiant",
    "Noble",
    "Resplendent",
    "Luminous",
    "Timeless",
  ];

  var COMPANIONS = [
    { id: "orchid-mantis", name: "Orchid mantis", kind: "hatch", draw: "mantis" },
    { id: "peacock", name: "Peacock", kind: "hatch", draw: "peacock" },
    { id: "reindeer", name: "Reindeer", kind: "grow", draw: "reindeer" },
    { id: "red-stag", name: "Red stag", kind: "grow", draw: "red-stag" },
    { id: "barasingha-fern", name: "Barasingha (fern)", kind: "grow", draw: "deer-fern" },
    { id: "elds-vine", name: "Eld’s deer (vine)", kind: "grow", draw: "deer-vine" },
    { id: "red-deer-twig", name: "Red deer (twig)", kind: "grow", draw: "deer-twig" },
    { id: "barasingha-coral", name: "Barasingha (coral)", kind: "grow", draw: "deer-coral" },
    { id: "reindeer-seafan", name: "Reindeer (sea fan)", kind: "grow", draw: "deer-seafan" },
    { id: "fallow-sponge", name: "Fallow deer (sponge)", kind: "grow", draw: "deer-sponge" },
    { id: "reindeer-lightning", name: "Reindeer (lightning)", kind: "grow", draw: "deer-lightning" },
    { id: "mineral-deer", name: "Deer (mineral)", kind: "grow", draw: "deer-mineral" },
  ];

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* ignore */
    }
  }

  function defaultState() {
    return { companionId: COMPANIONS[0].id, care: 0 };
  }

  function findCompanion(id) {
    for (var i = 0; i < COMPANIONS.length; i++) {
      if (COMPANIONS[i].id === id) return COMPANIONS[i];
    }
    return COMPANIONS[0];
  }

  function maxStageFor(companion) {
    if (companion.draw === "mantis") return MANTIS_FRAMES - 1;
    return 3;
  }

  function rawGrowthStep(care) {
    return Math.floor(Math.max(0, care) / CARE_PER_STAGE);
  }

  /* Painted mantis: 0–15 stills forward only; hold peak after last frame (no ping-pong). */
  function mantisFrameFromCare(care) {
    var step = rawGrowthStep(care);
    var max = MANTIS_FRAMES - 1;
    if (step < 0) return 0;
    if (step > max) return max;
    return step;
  }

  function stageFromCare(care, companion) {
    if (companion && companion.draw === "mantis") {
      return mantisFrameFromCare(care);
    }
    var max = companion ? maxStageFor(companion) : 3;
    var s = rawGrowthStep(care);
    if (s > max) s = max;
    if (s < 0) s = 0;
    return s;
  }

  /* Extra creature polish past adult — never caps. */
  function eleganceFromCare(care, companion) {
    if (companion && companion.draw === "mantis") {
      return Math.max(0, rawGrowthStep(care) - MANTIS_BLOOM);
    }
    var max = companion ? maxStageFor(companion) : 3;
    return Math.max(0, rawGrowthStep(care) - max);
  }

  function growthLabel(care, companion) {
    var step = rawGrowthStep(care);
    var e;
    var name;
    if (companion.draw === "mantis") {
      if (step < STAGE_LABELS.mantis.length) {
        return STAGE_LABELS.mantis[mantisFrameFromCare(care)];
      }
      /* Past painted ladder — stay on peak look; label can still note continued care. */
      e = step - MANTIS_BLOOM;
      return "Timeless · " + e;
    }
    var max = maxStageFor(companion);
    var labels = STAGE_LABELS[companion.kind];
    if (step <= max) return labels[Math.min(step, max)];
    e = step - max;
    name = ELEGANCE_LABELS[(e - 1) % ELEGANCE_LABELS.length];
    if (e > ELEGANCE_LABELS.length) return name + " · " + e;
    return name;
  }

  function svgDefs() {
    return (
      "<defs>" +
      '<radialGradient id="eggShine" cx="35%" cy="30%" r="55%">' +
      '<stop offset="0%" stop-color="#fffaf0"/>' +
      '<stop offset="55%" stop-color="#f4e8d4"/>' +
      '<stop offset="100%" stop-color="#e2d0b0"/>' +
      "</radialGradient>" +
      '<linearGradient id="mantisPink" x1="0%" y1="0%" x2="0%" y2="100%">' +
      '<stop offset="0%" stop-color="#fce4ec"/>' +
      '<stop offset="45%" stop-color="#f4c4d4"/>' +
      '<stop offset="100%" stop-color="#e8a8bc"/>' +
      "</linearGradient>" +
      '<linearGradient id="mantisDeep" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="#f7d2de"/>' +
      '<stop offset="100%" stop-color="#d992ab"/>' +
      "</linearGradient>" +
      '<radialGradient id="petalGlow" cx="40%" cy="40%" r="60%">' +
      '<stop offset="0%" stop-color="#fff0f5"/>' +
      '<stop offset="60%" stop-color="#f5bdd0"/>' +
      '<stop offset="100%" stop-color="#ef9fba"/>' +
      "</radialGradient>" +
      '<linearGradient id="peacockBody" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="#3a8fb0"/>' +
      '<stop offset="100%" stop-color="#1e5a72"/>' +
      "</linearGradient>" +
      '<linearGradient id="peacockNeck" x1="0%" y1="0%" x2="0%" y2="100%">' +
      '<stop offset="0%" stop-color="#2a7a58"/>' +
      '<stop offset="100%" stop-color="#245f7a"/>' +
      "</linearGradient>" +
      "</defs>"
    );
  }

  function eggStill(tint) {
    return (
      '<g class="layer layer-0">' +
      '<ellipse cx="100" cy="158" rx="28" ry="6" fill="rgba(30,50,30,0.28)"/>' +
      '<ellipse cx="100" cy="118" rx="36" ry="46" fill="url(#eggShine)" stroke="#c9b28a" stroke-width="2.5"/>' +
      '<ellipse cx="86" cy="98" rx="11" ry="16" fill="#fff8ea" opacity="0.5"/>' +
      '<ellipse cx="108" cy="130" rx="8" ry="5" fill="#e8d5b5" opacity="0.35"/>' +
      (tint || "") +
      "</g>"
    );
  }

  function crackEggStill() {
    return (
      '<g class="layer layer-1">' +
      '<ellipse cx="100" cy="158" rx="28" ry="6" fill="rgba(30,50,30,0.28)"/>' +
      '<ellipse cx="100" cy="118" rx="36" ry="46" fill="url(#eggShine)" stroke="#c9b28a" stroke-width="2.5"/>' +
      '<path d="M84 92 L94 104 L88 116 L100 124 L92 136 L104 144" fill="none" stroke="#8a6d45" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M112 98 L118 110 L110 120" fill="none" stroke="#a08050" stroke-width="1.8" stroke-linecap="round"/>' +
      '<ellipse cx="86" cy="98" rx="11" ry="16" fill="#fff8ea" opacity="0.4"/>' +
      "</g>"
    );
  }

  function orchidPetal(cx, cy, rot, sx, sy) {
    return (
      '<g transform="translate(' +
      cx +
      " " +
      cy +
      ") rotate(" +
      rot +
      ") scale(" +
      sx +
      " " +
      sy +
      ')">' +
      '<ellipse cx="0" cy="0" rx="14" ry="22" fill="url(#petalGlow)"/>' +
      '<ellipse cx="0" cy="2" rx="6" ry="12" fill="#fce4ec" opacity="0.7"/>' +
      '<path d="M0 -18 Q3 -4 0 16" fill="none" stroke="#e89ab4" stroke-width="1" opacity="0.5"/>' +
      "</g>"
    );
  }

  function orchidCluster(cx, cy, scale) {
    var s = scale || 1;
    return (
      '<g transform="translate(' +
      cx +
      " " +
      cy +
      ") scale(" +
      s +
      ')">' +
      orchidPetal(0, 0, -28, 1, 1) +
      orchidPetal(10, -2, 22, 0.92, 0.95) +
      orchidPetal(-10, 2, -50, 0.85, 0.9) +
      orchidPetal(0, -8, 5, 0.7, 0.75) +
      '<circle cx="0" cy="2" r="5" fill="#f2b6c8"/>' +
      '<circle cx="0" cy="2" r="2.2" fill="#e88aa8"/>' +
      "</g>"
    );
  }

  /* Three-quarter orchid mantis still — petal lobes on femurs, folded raptors */
  function mantisStill(grown) {
    var s = grown ? 1 : 0.9;
    var y = grown ? 0 : 4;
    return (
      '<g transform="translate(0 ' +
      y +
      ") scale(" +
      s +
      ')">' +
      '<ellipse cx="100" cy="162" rx="32" ry="7" fill="rgba(30,50,30,0.3)"/>' +
      /* hind legs */
      '<path d="M98 128 C86 138 78 150 72 158" fill="none" stroke="#d0849e" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M108 130 C118 140 126 150 132 158" fill="none" stroke="#d0849e" stroke-width="7" stroke-linecap="round"/>' +
      '<ellipse cx="72" cy="159" rx="5" ry="3" fill="#c97f9a"/>' +
      '<ellipse cx="132" cy="159" rx="5" ry="3" fill="#c97f9a"/>' +
      /* mid legs with orchid petal lobes */
      '<path d="M92 118 C74 124 60 136 52 148" fill="none" stroke="#e09ab2" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M112 118 C130 124 144 136 152 148" fill="none" stroke="#e09ab2" stroke-width="8" stroke-linecap="round"/>' +
      '<ellipse cx="68" cy="128" rx="14" ry="9" fill="url(#petalGlow)" transform="rotate(-35 68 128)"/>' +
      '<ellipse cx="132" cy="128" rx="14" ry="9" fill="url(#petalGlow)" transform="rotate(35 132 128)"/>' +
      '<ellipse cx="52" cy="149" rx="4.5" ry="2.8" fill="#c97f9a"/>' +
      '<ellipse cx="152" cy="149" rx="4.5" ry="2.8" fill="#c97f9a"/>' +
      /* long abdomen */
      '<ellipse cx="100" cy="138" rx="15" ry="28" fill="url(#mantisPink)"/>' +
      '<ellipse cx="100" cy="148" rx="11" ry="14" fill="#f0b8cc" opacity="0.55"/>' +
      '<path d="M90 122 Q100 132 110 122" fill="none" stroke="#e8a8bc" stroke-width="1.4" opacity="0.6"/>' +
      '<path d="M91 134 Q100 142 109 134" fill="none" stroke="#e8a8bc" stroke-width="1.2" opacity="0.45"/>' +
      /* thorax */
      '<ellipse cx="100" cy="102" rx="20" ry="16" fill="url(#mantisDeep)"/>' +
      '<ellipse cx="100" cy="98" rx="12" ry="8" fill="#fce4ec" opacity="0.45"/>' +
      /* folded raptorial forelegs — praying pose, thick + petal lobes */
      '<g>' +
      '<ellipse cx="78" cy="96" rx="16" ry="10" fill="url(#petalGlow)" transform="rotate(-48 78 96)"/>' +
      '<path d="M88 100 C72 108 58 104 48 92" fill="none" stroke="#e8a8bc" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M48 92 C42 82 46 72 54 68" fill="none" stroke="#f0b8cc" stroke-width="7.5" stroke-linecap="round"/>' +
      '<path d="M54 68 L46 78 M52 70 L44 80 M56 72 L50 82" stroke="#c97f9a" stroke-width="2" stroke-linecap="round"/>' +
      "</g>" +
      '<g>' +
      '<ellipse cx="122" cy="96" rx="16" ry="10" fill="url(#petalGlow)" transform="rotate(48 122 96)"/>' +
      '<path d="M112 100 C128 108 142 104 152 92" fill="none" stroke="#e8a8bc" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M152 92 C158 82 154 72 146 68" fill="none" stroke="#f0b8cc" stroke-width="7.5" stroke-linecap="round"/>' +
      '<path d="M146 68 L154 78 M148 70 L156 80 M144 72 L150 82" stroke="#c97f9a" stroke-width="2" stroke-linecap="round"/>' +
      "</g>" +
      /* neck + triangular head */
      '<ellipse cx="100" cy="84" rx="9" ry="8" fill="#f4c4d4"/>' +
      '<path d="M100 52 L122 82 L78 82 Z" fill="url(#mantisPink)" stroke="#e8a8bc" stroke-width="1"/>' +
      '<ellipse cx="100" cy="74" rx="16" ry="10" fill="#f7d2de"/>' +
      '<ellipse cx="90" cy="72" rx="5.5" ry="5" fill="#3a2a30"/>' +
      '<ellipse cx="110" cy="72" rx="5.5" ry="5" fill="#3a2a30"/>' +
      '<circle cx="91.5" cy="70.5" r="1.6" fill="#f9e8ef"/>' +
      '<circle cx="111.5" cy="70.5" r="1.6" fill="#f9e8ef"/>' +
      '<path d="M88 58 Q72 42 62 34" fill="none" stroke="#e09ab2" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M112 58 Q128 42 138 34" fill="none" stroke="#e09ab2" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="62" cy="34" r="2.2" fill="#f4c4d4"/>' +
      '<circle cx="138" cy="34" r="2.2" fill="#f4c4d4"/>' +
      "</g>"
    );
  }

  function drawMantis(stage) {
    var frame = Math.max(0, Math.min(stage || 0, MANTIS_FRAMES - 1));
    var base = "art/orchid-mantis/";
    var bust = "20260721a";
    var label = STAGE_LABELS.mantis[Math.min(frame, STAGE_LABELS.mantis.length - 1)];
    return (
      '<div class="frame-still mantis-frame">' +
      '<img src="' +
      base +
      frame +
      ".png?v=" +
      bust +
      '" alt="Orchid mantis — ' +
      label +
      '" width="512" height="512" decoding="async" />' +
      "</div>"
    );
  }

  function moonPhase(cx, cy, r, phase) {
    /* phase: 0 new, 1 crescent, 2 half, 3 gibbous, 4 full */
    var base =
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#1e2a44"/>';
    if (phase === 0) {
      return base;
    }
    if (phase === 4) {
      return (
        base +
        '<circle cx="' +
        cx +
        '" cy="' +
        cy +
        '" r="' +
        r * 0.92 +
        '" fill="#e8eef8"/>'
      );
    }
    var offset = phase === 1 ? r * 0.55 : phase === 2 ? r * 0.35 : r * 0.18;
    return (
      base +
      '<circle cx="' +
      (cx - offset) +
      '" cy="' +
      cy +
      '" r="' +
      r * 0.92 +
      '" fill="#e8eef8"/>' +
      '<circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="' +
      r +
      '" fill="none" stroke="#1e2a44" stroke-width="1"/>'
    );
  }

  function peacockFeatherStill(qx, qy, tipX, tipY, color, width, moonR, phase) {
    return (
      '<path d="M102 128 Q' +
      qx +
      " " +
      qy +
      " " +
      tipX +
      " " +
      tipY +
      '" fill="none" stroke="' +
      color +
      '" stroke-width="' +
      width +
      '" stroke-linecap="round"/>' +
      moonPhase(tipX, tipY, moonR, phase)
    );
  }

  /* Adult body size stays fixed; elegance adds plumage detail on the bird. */
  function peacockStill(grown, elegance) {
    var e = elegance || 0;
    var fan;
    var crest;
    var sheen;
    var i;
    var t;
    var tipX;
    var tipY;
    var qx;
    var qy;
    var colors = ["#1f4d42", "#2f6b5a", "#3a7f6a", "#2a6a58", "#245f4a"];
    var phases = [0, 1, 4, 2, 3, 1, 2, 4, 0, 3];

    if (!grown) {
      fan =
        peacockFeatherStill(62, 72, 40, 48, "#2f6b5a", 7, 7.5, 1) +
        peacockFeatherStill(100, 50, 100, 32, "#3a7f6a", 8, 8.5, 4) +
        peacockFeatherStill(138, 72, 160, 48, "#2f6b5a", 7, 7.5, 2);
      crest =
        '<path d="M100 54 L100 42" stroke="#c9a24a" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="M100 42 Q94 34 90 36 M100 42 Q106 34 110 36 M100 40 Q100 30 100 28" fill="none" stroke="#3a7f6a" stroke-width="2" stroke-linecap="round"/>';
    } else {
      fan =
        peacockFeatherStill(48, 78, 22, 42, "#1f4d42", 6.5, 9, 0) +
        peacockFeatherStill(68, 55, 48, 24, "#2f6b5a", 7, 8, 1) +
        peacockFeatherStill(100, 42, 100, 14, "#3a7f6a", 8.5, 10, 4) +
        peacockFeatherStill(132, 55, 152, 24, "#2f6b5a", 7, 8, 2) +
        peacockFeatherStill(152, 78, 178, 42, "#1f4d42", 6.5, 9, 3);
      /* More train feathers — same adult body, richer fan. */
      for (i = 0; i < Math.min(e, 12); i++) {
        t = (i + 0.5) / (Math.min(e, 12) + 1);
        tipX = 22 + t * 156;
        tipY = 18 + Math.abs(t - 0.5) * 36 + (i % 3) * 3;
        qx = 50 + t * 100;
        qy = 48 + (i % 2) * 8;
        fan += peacockFeatherStill(
          qx,
          qy,
          tipX,
          tipY,
          colors[i % colors.length],
          5.2 + (i % 3) * 0.4,
          6.5 + (i % 4) * 0.4,
          phases[i % phases.length]
        );
      }
      crest =
        '<path d="M100 54 L100 40" stroke="#c9a24a" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="M100 42 Q94 34 90 36 M100 42 Q106 34 110 36 M100 40 Q100 28 100 24" fill="none" stroke="#3a7f6a" stroke-width="2" stroke-linecap="round"/>';
      for (i = 0; i < Math.min(e, 6); i++) {
        crest +=
          '<path d="M100 44 Q' +
          (92 - i * 2) +
          " " +
          (30 - i) +
          " " +
          (86 - i * 3) +
          " " +
          (32 - i) +
          '" fill="none" stroke="#3a7f6a" stroke-width="1.6" stroke-linecap="round"/>' +
          '<path d="M100 44 Q' +
          (108 + i * 2) +
          " " +
          (30 - i) +
          " " +
          (114 + i * 3) +
          " " +
          (32 - i) +
          '" fill="none" stroke="#3a7f6a" stroke-width="1.6" stroke-linecap="round"/>';
      }
    }

    sheen =
      grown && e > 0
        ? '<ellipse cx="102" cy="118" rx="10" ry="8" fill="#9fd4e8" opacity="' +
          Math.min(0.35, 0.1 + e * 0.02).toFixed(3) +
          '"/>'
        : "";

    return (
      '<ellipse cx="100" cy="162" rx="30" ry="6" fill="rgba(30,50,30,0.28)"/>' +
      fan +
      '<path d="M94 140 L90 158 M90 158 L84 160" stroke="#c9a24a" stroke-width="2.8" stroke-linecap="round"/>' +
      '<path d="M108 140 L112 158 M112 158 L118 160" stroke="#c9a24a" stroke-width="2.8" stroke-linecap="round"/>' +
      '<ellipse cx="102" cy="128" rx="24" ry="28" fill="url(#peacockBody)"/>' +
      sheen +
      '<ellipse cx="102" cy="120" rx="14" ry="12" fill="#3486a8" opacity="0.5"/>' +
      '<ellipse cx="86" cy="126" rx="10" ry="16" fill="#245f7a" opacity="0.55" transform="rotate(-18 86 126)"/>' +
      '<ellipse cx="118" cy="126" rx="10" ry="16" fill="#245f7a" opacity="0.55" transform="rotate(18 118 126)"/>' +
      '<path d="M102 108 C108 92 108 78 102 68" fill="none" stroke="url(#peacockNeck)" stroke-width="12" stroke-linecap="round"/>' +
      '<ellipse cx="100" cy="62" rx="12" ry="11" fill="#245f7a"/>' +
      '<circle cx="96" cy="60" r="2.2" fill="#f4f0e4"/>' +
      '<circle cx="104" cy="60" r="2.2" fill="#f4f0e4"/>' +
      crest
    );
  }

  function drawPeacock(stage, elegance) {
    var body;
    if (stage <= 0) {
      body = eggStill('<ellipse cx="100" cy="118" rx="34" ry="44" fill="#d6e8ef" opacity="0.22"/>');
    } else if (stage === 1) {
      body = crackEggStill();
    } else if (stage === 2) {
      body = peacockStill(false, 0);
    } else {
      body = peacockStill(true, elegance || 0);
    }
    return (
      '<svg viewBox="0 0 200 180" role="img" aria-label="Peacock">' +
      svgDefs() +
      "<g>" +
      body +
      "</g>" +
      "</svg>"
    );
  }

  function deerStill(fill, s, antlerL, antlerR, antlerStroke, antlerW, tipExtra) {
    var cy = 120;
    var hx = 100 + 30 * s;
    var hy = cy - 16 * s;
    var dark = "#3a2a18";
    return (
      '<ellipse cx="100" cy="162" rx="' +
      34 * s +
      '" ry="6" fill="rgba(30,50,30,0.28)"/>' +
      '<path d="M' +
      (100 - 16 * s) +
      " " +
      (cy + 10 * s) +
      " L" +
      (100 - 18 * s) +
      " " +
      (cy + 38 * s) +
      '" stroke="' +
      fill +
      '" stroke-width="' +
      7 * s +
      '" stroke-linecap="round"/>' +
      '<path d="M' +
      (100 + 4 * s) +
      " " +
      (cy + 10 * s) +
      " L" +
      (100 + 6 * s) +
      " " +
      (cy + 38 * s) +
      '" stroke="' +
      fill +
      '" stroke-width="' +
      7 * s +
      '" stroke-linecap="round"/>' +
      '<path d="M' +
      (100 + 2 * s) +
      " " +
      (cy + 8 * s) +
      " L" +
      (100 + 4 * s) +
      " " +
      (cy + 36 * s) +
      '" stroke="' +
      fill +
      '" stroke-width="' +
      6.5 * s +
      '" stroke-linecap="round"/>' +
      '<path d="M' +
      (100 + 20 * s) +
      " " +
      (cy + 8 * s) +
      " L" +
      (100 + 24 * s) +
      " " +
      (cy + 36 * s) +
      '" stroke="' +
      fill +
      '" stroke-width="' +
      6.5 * s +
      '" stroke-linecap="round"/>' +
      '<ellipse cx="' +
      (100 - 18 * s) +
      '" cy="' +
      (cy + 40 * s) +
      '" rx="' +
      4 * s +
      '" ry="' +
      2.2 * s +
      '" fill="' +
      dark +
      '"/>' +
      '<ellipse cx="' +
      (100 + 6 * s) +
      '" cy="' +
      (cy + 40 * s) +
      '" rx="' +
      4 * s +
      '" ry="' +
      2.2 * s +
      '" fill="' +
      dark +
      '"/>' +
      '<ellipse cx="' +
      (100 + 4 * s) +
      '" cy="' +
      (cy + 38 * s) +
      '" rx="' +
      3.5 * s +
      '" ry="' +
      2 * s +
      '" fill="' +
      dark +
      '"/>' +
      '<ellipse cx="' +
      (100 + 24 * s) +
      '" cy="' +
      (cy + 38 * s) +
      '" rx="' +
      3.5 * s +
      '" ry="' +
      2 * s +
      '" fill="' +
      dark +
      '"/>' +
      '<ellipse cx="98" cy="' +
      cy +
      '" rx="' +
      32 * s +
      '" ry="' +
      20 * s +
      '" fill="' +
      fill +
      '"/>' +
      '<ellipse cx="' +
      (100 - 24 * s) +
      '" cy="' +
      (cy + 2 * s) +
      '" rx="' +
      12 * s +
      '" ry="' +
      10 * s +
      '" fill="' +
      fill +
      '"/>' +
      '<path d="M' +
      (100 + 14 * s) +
      " " +
      (cy - 8 * s) +
      " Q" +
      (100 + 22 * s) +
      " " +
      (cy - 22 * s) +
      " " +
      hx +
      " " +
      hy +
      '" fill="none" stroke="' +
      fill +
      '" stroke-width="' +
      15 * s +
      '" stroke-linecap="round"/>' +
      '<ellipse cx="' +
      hx +
      '" cy="' +
      hy +
      '" rx="' +
      16 * s +
      '" ry="' +
      12 * s +
      '" fill="' +
      fill +
      '"/>' +
      '<ellipse cx="' +
      (hx + 11 * s) +
      '" cy="' +
      (hy + 3 * s) +
      '" rx="' +
      8 * s +
      '" ry="' +
      5.5 * s +
      '" fill="' +
      fill +
      '"/>' +
      '<circle cx="' +
      (hx + 6 * s) +
      '" cy="' +
      (hy - 2 * s) +
      '" r="' +
      2.2 * s +
      '" fill="' +
      dark +
      '"/>' +
      '<ellipse cx="' +
      (hx - 4 * s) +
      '" cy="' +
      (hy - 14 * s) +
      '" rx="' +
      4.5 * s +
      '" ry="' +
      8 * s +
      '" fill="' +
      fill +
      '" transform="rotate(-20 ' +
      (hx - 4 * s) +
      " " +
      (hy - 14 * s) +
      ')"/>' +
      '<ellipse cx="' +
      (hx + 6 * s) +
      '" cy="' +
      (hy - 15 * s) +
      '" rx="' +
      4.5 * s +
      '" ry="' +
      8 * s +
      '" fill="' +
      fill +
      '" transform="rotate(14 ' +
      (hx + 6 * s) +
      " " +
      (hy - 15 * s) +
      ')"/>' +
      (antlerL
        ? '<path d="' +
          antlerL +
          '" fill="none" stroke="' +
          antlerStroke +
          '" stroke-width="' +
          antlerW +
          '" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="' +
          antlerR +
          '" fill="none" stroke="' +
          antlerStroke +
          '" stroke-width="' +
          antlerW +
          '" stroke-linecap="round" stroke-linejoin="round"/>'
        : "") +
      (tipExtra || "")
    );
  }

  /* Extra antler tines + coat sheen on the animal — body scale stays adult. */
  function deerEleganceExtra(elegance, antlerStroke, tipExtra) {
    var e = elegance || 0;
    var out = tipExtra || "";
    var i;
    var sheen;
    if (e <= 0) return out;
    sheen =
      '<ellipse cx="92" cy="112" rx="11" ry="6" fill="#fff6e8" opacity="' +
      Math.min(0.32, 0.08 + e * 0.015).toFixed(3) +
      '"/>' +
      '<circle cx="134" cy="102" r="1.4" fill="#fff8e8" opacity="' +
      Math.min(0.55, 0.2 + e * 0.02).toFixed(3) +
      '"/>';
    for (i = 0; i < Math.min(e, 10); i++) {
      out +=
        '<path d="M' +
        (118 + (i % 3) * 2) +
        " " +
        (70 - i * 2) +
        " Q" +
        (112 - i) +
        " " +
        (58 - i * 2) +
        " " +
        (108 - i * 1.5) +
        " " +
        (48 - i) +
        '" fill="none" stroke="' +
        antlerStroke +
        '" stroke-width="' +
        (1.6 + (i % 3) * 0.25) +
        '" stroke-linecap="round" opacity="0.85"/>' +
        '<path d="M' +
        (140 - (i % 3) * 2) +
        " " +
        (70 - i * 2) +
        " Q" +
        (146 + i) +
        " " +
        (58 - i * 2) +
        " " +
        (150 + i * 1.5) +
        " " +
        (48 - i) +
        '" fill="none" stroke="' +
        antlerStroke +
        '" stroke-width="' +
        (1.6 + (i % 3) * 0.25) +
        '" stroke-linecap="round" opacity="0.85"/>';
    }
    return sheen + out;
  }

  function drawDeerFamily(opts, stage, elegance) {
    var fill = opts.fill;
    var youngFill = opts.youngFill || fill;
    var antlerStroke = opts.antlerStroke;
    var antlerL = opts.antlerL;
    var antlerR = opts.antlerR;
    var tipExtra = opts.tipExtra || "";
    var label = opts.label;
    var stubL = "M122 92 Q116 76 112 64";
    var stubR = "M134 92 Q140 76 144 64";
    var e = elegance || 0;
    var s = stage || 0;
    var body;
    var antlerW;

    if (s <= 0) {
      body = deerStill(youngFill, 0.72, "", "", antlerStroke, 2, "");
    } else if (s === 1) {
      body = deerStill(youngFill, 0.85, stubL, stubR, antlerStroke, 2.4, "");
    } else if (s === 2) {
      body = deerStill(fill, 0.95, antlerL, antlerR, antlerStroke, 2.9, tipExtra);
    } else {
      /* Adult size locked; elegance deepens antlers + sheen only. */
      antlerW = 3.3 + Math.min(1.1, e * 0.06);
      body = deerStill(
        fill,
        1,
        antlerL,
        antlerR,
        antlerStroke,
        antlerW,
        deerEleganceExtra(e, antlerStroke, tipExtra)
      );
    }

    return (
      '<svg viewBox="0 0 200 180" role="img" aria-label="' +
      label +
      '">' +
      svgDefs() +
      "<g>" +
      body +
      "</g>" +
      "</svg>"
    );
  }

  var DRAW = {
    mantis: function (stage) {
      return drawMantis(stage);
    },
    peacock: function (stage, elegance) {
      return drawPeacock(stage, elegance);
    },
    reindeer: function (stage, elegance) {
      return drawDeerFamily(
        {
          label: "Reindeer",
          fill: "#d8e4ef",
          youngFill: "#e8eef4",
          antlerStroke: "#b8d4ea",
          antlerL: "M122 90 Q110 68 98 48 Q104 56 112 44 Q114 60 122 66",
          antlerR: "M136 90 Q148 68 160 48 Q154 56 146 44 Q144 60 136 66",
        },
        stage,
        elegance
      );
    },
    "red-stag": function (stage, elegance) {
      return drawDeerFamily(
        {
          label: "Red stag",
          fill: "#a85a32",
          youngFill: "#c48458",
          antlerStroke: "#6b3a22",
          antlerL: "M122 90 Q114 68 108 48 Q104 40 100 34",
          antlerR: "M136 90 Q144 68 150 48 Q154 40 158 34",
          tipExtra:
            '<path d="M100 34 Q98 26 100 20" stroke="#e8a23a" stroke-width="3" stroke-linecap="round"/>' +
            '<path d="M158 34 Q160 26 158 20" stroke="#e8a23a" stroke-width="3" stroke-linecap="round"/>',
        },
        stage,
        elegance
      );
    },
    "deer-fern": function (stage, elegance) {
      return drawDeerFamily(
        {
          label: "Barasingha fern antlers",
          fill: "#8b6a45",
          antlerStroke: "#4f7a3e",
          antlerL: "M122 90 Q116 72 112 56 M112 70 Q104 64 100 54 M112 62 Q106 56 102 48",
          antlerR: "M136 90 Q142 72 146 56 M146 70 Q154 64 158 54 M146 62 Q152 56 156 48",
        },
        stage,
        elegance
      );
    },
    "deer-vine": function (stage, elegance) {
      return drawDeerFamily(
        {
          label: "Eld’s deer vine antlers",
          fill: "#7a5a3a",
          antlerStroke: "#3f6b38",
          antlerL: "M122 90 Q112 76 104 64 Q96 56 92 46 Q100 52 108 46",
          antlerR: "M136 90 Q146 76 154 64 Q162 56 166 46 Q158 52 150 46",
        },
        stage,
        elegance
      );
    },
    "deer-twig": function (stage, elegance) {
      return drawDeerFamily(
        {
          label: "Red deer twig antlers",
          fill: "#8a5a36",
          antlerStroke: "#5a3a22",
          antlerL: "M122 90 L114 66 L108 48 M114 66 L106 60 M114 58 L120 52",
          antlerR: "M136 90 L144 66 L150 48 M144 66 L152 60 M144 58 L138 52",
        },
        stage,
        elegance
      );
    },
    "deer-coral": function (stage, elegance) {
      return drawDeerFamily(
        {
          label: "Barasingha coral antlers",
          fill: "#8b6a45",
          antlerStroke: "#c46b6b",
          antlerL: "M122 90 Q116 74 110 58 Q102 52 104 44 Q112 50 116 42 Q114 56 122 62",
          antlerR: "M136 90 Q142 74 148 58 Q156 52 154 44 Q146 50 142 42 Q144 56 136 62",
        },
        stage,
        elegance
      );
    },
    "deer-seafan": function (stage, elegance) {
      return drawDeerFamily(
        {
          label: "Reindeer sea-fan antlers",
          fill: "#d8e4ef",
          youngFill: "#e8eef4",
          antlerStroke: "#6aa8b8",
          antlerL: "M122 90 Q112 74 100 60 Q94 52 88 46 M100 60 Q96 50 92 42 M104 64 Q108 52 112 44",
          antlerR: "M136 90 Q146 74 158 60 Q164 52 170 46 M158 60 Q162 50 166 42 M154 64 Q150 52 146 44",
        },
        stage,
        elegance
      );
    },
    "deer-sponge": function (stage, elegance) {
      return drawDeerFamily(
        {
          label: "Fallow deer sponge antlers",
          fill: "#9a7a4a",
          antlerStroke: "#c49a72",
          antlerL: "M122 90 Q116 76 110 62 Q104 54 106 46 Q112 52 116 44 Q114 58 122 66",
          antlerR: "M136 90 Q142 76 148 62 Q154 54 152 46 Q146 52 142 44 Q144 58 136 66",
        },
        stage,
        elegance
      );
    },
    "deer-lightning": function (stage, elegance) {
      return drawDeerFamily(
        {
          label: "Reindeer lightning antlers",
          fill: "#d8e4ef",
          youngFill: "#e8eef4",
          antlerStroke: "#6ec8ff",
          antlerL: "M122 90 L116 74 L122 66 L112 54 L118 46 L108 36",
          antlerR: "M136 90 L142 74 L136 66 L146 54 L140 46 L150 36",
        },
        stage,
        elegance
      );
    },
    "deer-mineral": function (stage, elegance) {
      return drawDeerFamily(
        {
          label: "Deer mineral antlers",
          fill: "#8b6a45",
          antlerStroke: "#9bb0c4",
          antlerL: "M122 90 Q114 76 108 62 Q102 50 96 42 M108 62 Q112 52 116 44 M104 58 Q98 50 94 42",
          antlerR: "M136 90 Q144 76 150 62 Q156 50 162 42 M150 62 Q146 52 142 44 M154 58 Q160 50 164 42",
        },
        stage,
        elegance
      );
    },
  };

  var state = loadState() || defaultState();
  var pickEl = document.getElementById("companionPick");
  var sceneEl = document.getElementById("scene");
  var creatureEl = document.getElementById("creature");
  var stageLabelEl = document.getElementById("stageLabel");
  var careMeterEl = document.getElementById("careMeter");

  function renderPick() {
    pickEl.innerHTML = "";
    COMPANIONS.forEach(function (c) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pick-btn";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", c.id === state.companionId ? "true" : "false");
      btn.textContent = c.name;
      btn.addEventListener("click", function () {
        state.companionId = c.id;
        state.care = 0;
        saveState(state);
        render();
      });
      pickEl.appendChild(btn);
    });
  }

  function renderCreature() {
    var c = findCompanion(state.companionId);
    var stage = stageFromCare(state.care, c);
    var elegance = eleganceFromCare(state.care, c);
    var draw = DRAW[c.draw] || DRAW.mantis;
    creatureEl.innerHTML = draw(stage, elegance);
    sceneEl.dataset.kind = c.kind;
    sceneEl.dataset.stage = String(stage);
    sceneEl.dataset.elegance = String(Math.min(elegance, 99));
    sceneEl.dataset.art = c.draw === "mantis" ? "paint" : "svg";
    stageLabelEl.textContent = growthLabel(state.care, c);
    careMeterEl.textContent = "Care " + state.care;
  }

  function render() {
    renderPick();
    renderCreature();
  }

  function feed(habitName, btn) {
    state.care += 1;
    saveState(state);

    btn.classList.remove("is-pop");
    void btn.offsetWidth;
    btn.classList.add("is-pop");

    sceneEl.classList.remove("is-fed");
    void sceneEl.offsetWidth;
    sceneEl.classList.add("is-fed");

    renderCreature();

    window.setTimeout(function () {
      sceneEl.classList.remove("is-fed");
      btn.classList.remove("is-pop");
    }, 550);
  }

  document.querySelectorAll(".habit-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      feed(btn.getAttribute("data-habit"), btn);
    });
  });

  render();
})();
