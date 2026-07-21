(function () {
  "use strict";

  var STORAGE_KEY = "habitTree.v0";
  var CARE_PER_STAGE = 2;

  var STAGE_LABELS = {
    hatch: ["Egg", "Cracking", "Hatched", "Grown"],
    grow: ["Young", "Growing", "Nearly grown", "Grown"],
  };

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

  function stageFromCare(care) {
    var s = Math.floor(care / CARE_PER_STAGE);
    if (s > 3) s = 3;
    if (s < 0) s = 0;
    return s;
  }

  function eggSvg(extra) {
    return (
      '<g class="layer layer-0 egg-sway">' +
      '<ellipse cx="100" cy="118" rx="34" ry="44" fill="#f4e8d4" stroke="#c9b28a" stroke-width="3"/>' +
      '<ellipse cx="88" cy="100" rx="10" ry="14" fill="#fff8ea" opacity="0.55"/>' +
      (extra || "") +
      "</g>"
    );
  }

  function crackEggSvg() {
    return (
      '<g class="layer layer-1 egg-sway">' +
      '<ellipse cx="100" cy="118" rx="34" ry="44" fill="#f4e8d4" stroke="#c9b28a" stroke-width="3"/>' +
      '<path class="crack-line" d="M86 96 L96 108 L90 118 L102 128 L94 140" fill="none" stroke="#8a6d45" stroke-width="2.5" stroke-linecap="round"/>' +
      '<ellipse cx="100" cy="118" rx="34" ry="44" fill="none" stroke="#c9b28a" stroke-width="3"/>' +
      "</g>"
    );
  }

  function orchidBloom(cx, cy, scale, late) {
    var s = scale || 1;
    return (
      '<g transform="translate(' +
      cx +
      " " +
      cy +
      ") scale(" +
      s +
      ')">' +
      '<g class="bloom' +
      (late ? " bloom-late" : "") +
      '">' +
      '<ellipse cx="0" cy="4" rx="16" ry="9" fill="#ef9fba"/>' +
      '<ellipse cx="-8" cy="-4" rx="8" ry="12" fill="#f5bdd0"/>' +
      '<ellipse cx="8" cy="-4" rx="8" ry="12" fill="#f5bdd0"/>' +
      '<ellipse cx="0" cy="-2" rx="6" ry="8" fill="#f9d4e2"/>' +
      '<circle cx="0" cy="0" r="3.5" fill="#f2b6c8"/>' +
      "</g></g>"
    );
  }

  function mantisFigure(grown) {
    var g = grown ? 1 : 0.88;
    var bodyY = grown ? 108 : 112;
    var headY = grown ? 58 : 64;
    return (
      '<g class="mantis-idle">' +
      /* mid + hind legs — thick tapered segments, connected */
      '<g class="leg-mid leg-l">' +
      '<path d="M90 ' +
      (bodyY + 6) +
      " L78 " +
      (bodyY + 22) +
      " L70 " +
      (bodyY + 38) +
      " L64 " +
      (bodyY + 48) +
      '" fill="none" stroke="#d992ab" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<ellipse cx="64" cy="' +
      (bodyY + 50) +
      '" rx="5" ry="3" fill="#c97f9a"/>' +
      "</g>" +
      '<g class="leg-mid leg-r">' +
      '<path d="M110 ' +
      (bodyY + 6) +
      " L122 " +
      (bodyY + 22) +
      " L130 " +
      (bodyY + 38) +
      " L136 " +
      (bodyY + 48) +
      '" fill="none" stroke="#d992ab" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<ellipse cx="136" cy="' +
      (bodyY + 50) +
      '" rx="5" ry="3" fill="#c97f9a"/>' +
      "</g>" +
      '<g class="leg-hind leg-l">' +
      '<path d="M94 ' +
      (bodyY + 16) +
      " L86 " +
      (bodyY + 32) +
      " L80 " +
      (bodyY + 48) +
      '" fill="none" stroke="#c97f9a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<ellipse cx="80" cy="' +
      (bodyY + 50) +
      '" rx="4.5" ry="2.8" fill="#b86f8c"/>' +
      "</g>" +
      '<g class="leg-hind leg-r">' +
      '<path d="M106 ' +
      (bodyY + 16) +
      " L114 " +
      (bodyY + 32) +
      " L120 " +
      (bodyY + 48) +
      '" fill="none" stroke="#c97f9a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<ellipse cx="120" cy="' +
      (bodyY + 50) +
      '" rx="4.5" ry="2.8" fill="#b86f8c"/>' +
      "</g>" +
      /* abdomen + thorax — elongated mantis silhouette */
      '<g class="mantis-body">' +
      '<ellipse cx="100" cy="' +
      (bodyY + 26) +
      '" rx="' +
      13 * g +
      '" ry="' +
      28 * g +
      '" fill="#f0b8cc"/>' +
      '<ellipse cx="100" cy="' +
      (bodyY + 8) +
      '" rx="' +
      12 * g +
      '" ry="' +
      11 * g +
      '" fill="#f4c4d4"/>' +
      '<ellipse cx="100" cy="' +
      (bodyY - 8) +
      '" rx="' +
      17 * g +
      '" ry="' +
      13 * g +
      '" fill="#f7d2de"/>' +
      '<path d="M88 ' +
      (bodyY - 4) +
      " Q100 " +
      (bodyY + 12) +
      " 112 " +
      (bodyY - 4) +
      '" fill="none" stroke="#e8a8bc" stroke-width="1.5" opacity="0.55"/>' +
      /* neck bridge */
      '<ellipse cx="100" cy="' +
      (bodyY - 20) +
      '" rx="' +
      8 * g +
      '" ry="' +
      7 * g +
      '" fill="#f4c4d4"/>' +
      "</g>" +
      /* raptorial forelegs — folded, thick filled segments */
      '<g class="forearm forearm-l">' +
      '<ellipse cx="78" cy="' +
      (bodyY - 4) +
      '" rx="11" ry="6.5" fill="#e8a8bc" transform="rotate(-42 78 ' +
      (bodyY - 4) +
      ')"/>' +
      '<ellipse cx="60" cy="' +
      (bodyY + 2) +
      '" rx="10" ry="5.5" fill="#f0b8cc" transform="rotate(48 60 ' +
      (bodyY + 2) +
      ')"/>' +
      '<ellipse cx="50" cy="' +
      (bodyY - 8) +
      '" rx="8" ry="4.5" fill="#e09ab2" transform="rotate(-55 50 ' +
      (bodyY - 8) +
      ')"/>' +
      '<path d="M46 ' +
      (bodyY - 2) +
      " L42 " +
      (bodyY + 10) +
      " M48 " +
      (bodyY + 0) +
      " L46 " +
      (bodyY + 12) +
      " M50 " +
      (bodyY + 1) +
      " L50 " +
      (bodyY + 12) +
      '" stroke="#c97f9a" stroke-width="2.2" stroke-linecap="round"/>' +
      "</g>" +
      '<g class="forearm forearm-r">' +
      '<ellipse cx="122" cy="' +
      (bodyY - 4) +
      '" rx="11" ry="6.5" fill="#e8a8bc" transform="rotate(42 122 ' +
      (bodyY - 4) +
      ')"/>' +
      '<ellipse cx="140" cy="' +
      (bodyY + 2) +
      '" rx="10" ry="5.5" fill="#f0b8cc" transform="rotate(-48 140 ' +
      (bodyY + 2) +
      ')"/>' +
      '<ellipse cx="150" cy="' +
      (bodyY - 8) +
      '" rx="8" ry="4.5" fill="#e09ab2" transform="rotate(55 150 ' +
      (bodyY - 8) +
      ')"/>' +
      '<path d="M154 ' +
      (bodyY - 2) +
      " L158 " +
      (bodyY + 10) +
      " M152 " +
      (bodyY + 0) +
      " L154 " +
      (bodyY + 12) +
      " M150 " +
      (bodyY + 1) +
      " L150 " +
      (bodyY + 12) +
      '" stroke="#c97f9a" stroke-width="2.2" stroke-linecap="round"/>' +
      "</g>" +
      /* triangular mantis head + antennae */
      '<g class="mantis-head">' +
      '<path d="M100 ' +
      (headY - 16) +
      " L120 " +
      (headY + 10) +
      " L80 " +
      (headY + 10) +
      ' Z" fill="#f7d2de"/>' +
      '<ellipse cx="100" cy="' +
      (headY + 4) +
      '" rx="15" ry="9" fill="#f4c4d4"/>' +
      '<circle cx="91" cy="' +
      (headY + 2) +
      '" r="3.4" fill="#3a2a30"/>' +
      '<circle cx="109" cy="' +
      (headY + 2) +
      '" r="3.4" fill="#3a2a30"/>' +
      '<circle cx="92" cy="' +
      headY +
      '" r="1.1" fill="#f9e8ef"/>' +
      '<circle cx="110" cy="' +
      headY +
      '" r="1.1" fill="#f9e8ef"/>' +
      '<g class="antenna antenna-l">' +
      '<path d="M88 ' +
      (headY - 10) +
      " Q74 " +
      (headY - 26) +
      " 66 " +
      (headY - 38) +
      '" fill="none" stroke="#e09ab2" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="66" cy="' +
      (headY - 38) +
      '" r="2" fill="#f0b8cc"/>' +
      "</g>" +
      '<g class="antenna antenna-r">' +
      '<path d="M112 ' +
      (headY - 10) +
      " Q126 " +
      (headY - 26) +
      " 134 " +
      (headY - 38) +
      '" fill="none" stroke="#e09ab2" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="134" cy="' +
      (headY - 38) +
      '" r="2" fill="#f0b8cc"/>' +
      "</g>" +
      "</g>" +
      "</g>"
    );
  }

  function drawMantis() {
    return (
      '<svg viewBox="0 0 200 180" role="img" aria-label="Orchid mantis">' +
      eggSvg() +
      crackEggSvg() +
      '<g class="layer layer-2">' +
      orchidBloom(36, 118, 0.8, false) +
      orchidBloom(164, 122, 0.7, true) +
      mantisFigure(false) +
      "</g>" +
      '<g class="layer layer-3">' +
      orchidBloom(28, 112, 0.95, false) +
      orchidBloom(172, 108, 0.9, true) +
      orchidBloom(100, 162, 0.65, true) +
      mantisFigure(true) +
      "</g>" +
      "</svg>"
    );
  }

  function moonSpot(cx, cy, r) {
    return (
      '<circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="' +
      r +
      '" fill="#1e2a44"/>' +
      '<circle cx="' +
      (cx - r * 0.25) +
      '" cy="' +
      (cy - r * 0.15) +
      '" r="' +
      r * 0.55 +
      '" fill="#dfe7f5"/>'
    );
  }

  function peacockFeather(qx, qy, tipX, tipY, stroke, width, moonR) {
    return (
      '<g class="feather">' +
      '<path d="M100 124 Q' +
      qx +
      " " +
      qy +
      " " +
      tipX +
      " " +
      tipY +
      '" fill="none" stroke="' +
      stroke +
      '" stroke-width="' +
      width +
      '" stroke-linecap="round"/>' +
      moonSpot(tipX, tipY, moonR) +
      "</g>"
    );
  }

  function peacockBody(grown) {
    var s = grown ? 1 : 0.92;
    var bodyY = grown ? 124 : 122;
    return (
      '<g class="peacock-idle">' +
      '<g class="peacock-leg peacock-leg-l">' +
      '<path d="M94 ' +
      (bodyY + 16) +
      " L90 " +
      (bodyY + 34) +
      '" stroke="#c9a24a" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M90 ' +
      (bodyY + 34) +
      " L84 " +
      (bodyY + 36) +
      '" stroke="#c9a24a" stroke-width="2.5" stroke-linecap="round"/>' +
      "</g>" +
      '<g class="peacock-leg peacock-leg-r">' +
      '<path d="M106 ' +
      (bodyY + 16) +
      " L110 " +
      (bodyY + 34) +
      '" stroke="#c9a24a" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M110 ' +
      (bodyY + 34) +
      " L116 " +
      (bodyY + 36) +
      '" stroke="#c9a24a" stroke-width="2.5" stroke-linecap="round"/>' +
      "</g>" +
      '<g class="peacock-body">' +
      '<ellipse cx="100" cy="' +
      bodyY +
      '" rx="' +
      22 * s +
      '" ry="' +
      26 * s +
      '" fill="#2a6f8f"/>' +
      '<ellipse cx="100" cy="' +
      (bodyY - 6) +
      '" rx="' +
      14 * s +
      '" ry="' +
      12 * s +
      '" fill="#3486a8"/>' +
      '<path d="M100 ' +
      (bodyY - 28) +
      " Q108 " +
      (bodyY - 18) +
      " 106 " +
      (bodyY - 6) +
      " Q100 " +
      (bodyY - 12) +
      " 94 " +
      (bodyY - 6) +
      " Q92 " +
      (bodyY - 18) +
      " 100 " +
      (bodyY - 28) +
      '" fill="#245f7a"/>' +
      "</g>" +
      '<g class="peacock-head">' +
      '<ellipse cx="100" cy="' +
      (bodyY - 34) +
      '" rx="' +
      11 * s +
      '" ry="' +
      10 * s +
      '" fill="#245f7a"/>' +
      '<circle cx="96" cy="' +
      (bodyY - 35) +
      '" r="2" fill="#f4f0e4"/>' +
      '<circle cx="104" cy="' +
      (bodyY - 35) +
      '" r="2" fill="#f4f0e4"/>' +
      '<path d="M100 ' +
      (bodyY - 40) +
      " L100 " +
      (bodyY - 50) +
      '" stroke="#c9a24a" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M100 ' +
      (bodyY - 50) +
      " Q96 " +
      (bodyY - 56) +
      " 94 " +
      (bodyY - 54) +
      " M100 " +
      (bodyY - 50) +
      " Q104 " +
      (bodyY - 56) +
      " 106 " +
      (bodyY - 54) +
      '" fill="none" stroke="#3a7f6a" stroke-width="2" stroke-linecap="round"/>' +
      "</g>" +
      "</g>"
    );
  }

  function drawPeacock() {
    return (
      '<svg viewBox="0 0 200 180" role="img" aria-label="Peacock">' +
      eggSvg('<ellipse cx="100" cy="118" rx="34" ry="44" fill="#d6e8ef" opacity="0.25"/>') +
      crackEggSvg() +
      '<g class="layer layer-2">' +
      '<g class="tail-fan">' +
      peacockFeather(60, 78, 42, 52, "#2f6b5a", 7, 7.5) +
      peacockFeather(100, 55, 100, 38, "#3a7f6a", 8, 8) +
      peacockFeather(140, 78, 158, 52, "#2f6b5a", 7, 7.5) +
      "</g>" +
      peacockBody(false) +
      "</g>" +
      '<g class="layer layer-3">' +
      '<g class="tail-fan">' +
      peacockFeather(48, 82, 26, 46, "#245a4c", 6.5, 8.5) +
      peacockFeather(70, 58, 52, 28, "#2f6b5a", 7, 7.5) +
      peacockFeather(100, 48, 100, 18, "#3a7f6a", 8, 9.5) +
      peacockFeather(130, 58, 148, 28, "#2f6b5a", 7, 7.5) +
      peacockFeather(152, 82, 174, 46, "#245a4c", 6.5, 8.5) +
      "</g>" +
      peacockBody(true) +
      "</g>" +
      "</svg>"
    );
  }

  function deerBody(fill, stageScale) {
    var s = stageScale || 1;
    var cy = 118;
    var hx = 100 + 28 * s;
    var hy = cy - 14 * s;
    return (
      '<g class="deer-idle">' +
      '<g class="deer-leg deer-leg-bl">' +
      '<path d="M' +
      (100 - 14 * s) +
      " " +
      (cy + 12 * s) +
      " L" +
      (100 - 16 * s) +
      " " +
      (cy + 36 * s) +
      '" stroke="' +
      fill +
      '" stroke-width="' +
      6.5 * s +
      '" stroke-linecap="round"/>' +
      '<ellipse cx="' +
      (100 - 16 * s) +
      '" cy="' +
      (cy + 38 * s) +
      '" rx="' +
      3.5 * s +
      '" ry="' +
      2 * s +
      '" fill="#3a2a18"/>' +
      "</g>" +
      '<g class="deer-leg deer-leg-br">' +
      '<path d="M' +
      (100 + 6 * s) +
      " " +
      (cy + 12 * s) +
      " L" +
      (100 + 8 * s) +
      " " +
      (cy + 36 * s) +
      '" stroke="' +
      fill +
      '" stroke-width="' +
      6.5 * s +
      '" stroke-linecap="round"/>' +
      '<ellipse cx="' +
      (100 + 8 * s) +
      '" cy="' +
      (cy + 38 * s) +
      '" rx="' +
      3.5 * s +
      '" ry="' +
      2 * s +
      '" fill="#3a2a18"/>' +
      "</g>" +
      '<g class="deer-leg deer-leg-fl">' +
      '<path d="M' +
      (100 - 2 * s) +
      " " +
      (cy + 10 * s) +
      " L" +
      (100 + 0 * s) +
      " " +
      (cy + 34 * s) +
      '" stroke="' +
      fill +
      '" stroke-width="' +
      6 * s +
      '" stroke-linecap="round"/>' +
      '<ellipse cx="' +
      (100 + 0 * s) +
      '" cy="' +
      (cy + 36 * s) +
      '" rx="' +
      3.2 * s +
      '" ry="' +
      2 * s +
      '" fill="#3a2a18"/>' +
      "</g>" +
      '<g class="deer-leg deer-leg-fr">' +
      '<path d="M' +
      (100 + 18 * s) +
      " " +
      (cy + 10 * s) +
      " L" +
      (100 + 22 * s) +
      " " +
      (cy + 34 * s) +
      '" stroke="' +
      fill +
      '" stroke-width="' +
      6 * s +
      '" stroke-linecap="round"/>' +
      '<ellipse cx="' +
      (100 + 22 * s) +
      '" cy="' +
      (cy + 36 * s) +
      '" rx="' +
      3.2 * s +
      '" ry="' +
      2 * s +
      '" fill="#3a2a18"/>' +
      "</g>" +
      '<g class="deer-body">' +
      '<ellipse cx="100" cy="' +
      cy +
      '" rx="' +
      30 * s +
      '" ry="' +
      20 * s +
      '" fill="' +
      fill +
      '"/>' +
      '<ellipse cx="' +
      (100 - 22 * s) +
      '" cy="' +
      (cy + 4 * s) +
      '" rx="' +
      8 * s +
      '" ry="' +
      6 * s +
      '" fill="' +
      fill +
      '" opacity="0.85"/>' +
      "</g>" +
      '<g class="deer-neck">' +
      '<path d="M' +
      (100 + 16 * s) +
      " " +
      (cy - 6 * s) +
      " Q" +
      (100 + 24 * s) +
      " " +
      (cy - 18 * s) +
      " " +
      hx +
      " " +
      hy +
      '" fill="none" stroke="' +
      fill +
      '" stroke-width="' +
      14 * s +
      '" stroke-linecap="round"/>' +
      "</g>" +
      '<g class="deer-head">' +
      '<ellipse cx="' +
      hx +
      '" cy="' +
      hy +
      '" rx="' +
      15 * s +
      '" ry="' +
      12 * s +
      '" fill="' +
      fill +
      '"/>' +
      '<ellipse cx="' +
      (hx + 10 * s) +
      '" cy="' +
      (hy + 2 * s) +
      '" rx="' +
      7 * s +
      '" ry="' +
      5 * s +
      '" fill="' +
      fill +
      '"/>' +
      '<circle cx="' +
      (hx + 6 * s) +
      '" cy="' +
      (hy - 2 * s) +
      '" r="' +
      2.1 * s +
      '" fill="#1a2418"/>' +
      '<g class="deer-ear deer-ear-l">' +
      '<ellipse cx="' +
      (hx - 6 * s) +
      '" cy="' +
      (hy - 12 * s) +
      '" rx="' +
      4 * s +
      '" ry="' +
      7 * s +
      '" fill="' +
      fill +
      '" transform="rotate(-18 ' +
      (hx - 6 * s) +
      " " +
      (hy - 12 * s) +
      ')"/>' +
      "</g>" +
      '<g class="deer-ear deer-ear-r">' +
      '<ellipse cx="' +
      (hx + 4 * s) +
      '" cy="' +
      (hy - 14 * s) +
      '" rx="' +
      4 * s +
      '" ry="' +
      7 * s +
      '" fill="' +
      fill +
      '" transform="rotate(12 ' +
      (hx + 4 * s) +
      " " +
      (hy - 14 * s) +
      ')"/>' +
      "</g>" +
      "</g>" +
      "</g>"
    );
  }

  function antlerPair(pathL, pathR, stroke, width) {
    return (
      '<g class="antler">' +
      '<path d="' +
      pathL +
      '" fill="none" stroke="' +
      stroke +
      '" stroke-width="' +
      (width || 3) +
      '" stroke-linecap="round"/>' +
      '<path d="' +
      pathR +
      '" fill="none" stroke="' +
      stroke +
      '" stroke-width="' +
      (width || 3) +
      '" stroke-linecap="round"/>' +
      "</g>"
    );
  }

  function drawDeerFamily(opts) {
    var fill = opts.fill;
    var youngFill = opts.youngFill || fill;
    var antlerStroke = opts.antlerStroke;
    var antlerL = opts.antlerL;
    var antlerR = opts.antlerR;
    var tipExtra = opts.tipExtra || "";
    var label = opts.label;

    return (
      '<svg viewBox="0 0 200 180" role="img" aria-label="' +
      label +
      '">' +
      '<g class="layer layer-0">' +
      deerBody(youngFill, 0.72) +
      "</g>" +
      '<g class="layer layer-1">' +
      deerBody(youngFill, 0.85) +
      antlerPair("M118 95 Q112 78 108 68", "M132 95 Q138 78 142 68", antlerStroke, 2.2) +
      "</g>" +
      '<g class="layer layer-2">' +
      deerBody(fill, 0.95) +
      antlerPair(antlerL, antlerR, antlerStroke, 2.8) +
      tipExtra +
      "</g>" +
      '<g class="layer layer-3">' +
      deerBody(fill, 1) +
      antlerPair(antlerL, antlerR, antlerStroke, 3.2) +
      tipExtra +
      "</g>" +
      "</svg>"
    );
  }

  var DRAW = {
    mantis: drawMantis,
    peacock: drawPeacock,
    reindeer: function () {
      return drawDeerFamily({
        label: "Reindeer",
        fill: "#d8e4ef",
        youngFill: "#e8eef4",
        antlerStroke: "#b8d4ea",
        antlerL: "M118 94 Q108 70 98 52 Q104 58 110 48 Q112 62 118 70",
        antlerR: "M132 94 Q142 70 152 52 Q146 58 140 48 Q138 62 132 70",
      });
    },
    "red-stag": function () {
      return drawDeerFamily({
        label: "Red stag",
        fill: "#a85a32",
        youngFill: "#c48458",
        antlerStroke: "#6b3a22",
        antlerL: "M118 94 Q110 72 104 52 Q100 44 96 40",
        antlerR: "M132 94 Q140 72 146 52 Q150 44 154 40",
        tipExtra:
          '<g class="antler">' +
          '<path d="M96 40 Q94 32 96 26" stroke="#e8a23a" stroke-width="3" stroke-linecap="round"/>' +
          '<path d="M154 40 Q156 32 154 26" stroke="#e8a23a" stroke-width="3" stroke-linecap="round"/>' +
          "</g>",
      });
    },
    "deer-fern": function () {
      return drawDeerFamily({
        label: "Barasingha fern antlers",
        fill: "#8b6a45",
        antlerStroke: "#4f7a3e",
        antlerL: "M118 94 Q112 76 108 60 M108 72 Q100 66 96 58 M108 66 Q102 60 98 52",
        antlerR: "M132 94 Q138 76 142 60 M142 72 Q150 66 154 58 M142 66 Q148 60 152 52",
      });
    },
    "deer-vine": function () {
      return drawDeerFamily({
        label: "Eld’s deer vine antlers",
        fill: "#7a5a3a",
        antlerStroke: "#3f6b38",
        antlerL: "M118 94 Q108 80 100 70 Q92 62 88 54 Q96 58 104 52",
        antlerR: "M132 94 Q142 80 150 70 Q158 62 162 54 Q154 58 146 52",
      });
    },
    "deer-twig": function () {
      return drawDeerFamily({
        label: "Red deer twig antlers",
        fill: "#8a5a36",
        antlerStroke: "#5a3a22",
        antlerL: "M118 94 L110 70 L104 52 M110 70 L102 64 M110 62 L116 56",
        antlerR: "M132 94 L140 70 L146 52 M140 70 L148 64 M140 62 L134 56",
      });
    },
    "deer-coral": function () {
      return drawDeerFamily({
        label: "Barasingha coral antlers",
        fill: "#8b6a45",
        antlerStroke: "#c46b6b",
        antlerL: "M118 94 Q112 78 106 64 Q98 58 100 50 Q108 56 112 48 Q110 60 118 66",
        antlerR: "M132 94 Q138 78 144 64 Q152 58 150 50 Q142 56 138 48 Q140 60 132 66",
      });
    },
    "deer-seafan": function () {
      return drawDeerFamily({
        label: "Reindeer sea-fan antlers",
        fill: "#d8e4ef",
        youngFill: "#e8eef4",
        antlerStroke: "#6aa8b8",
        antlerL: "M118 94 Q108 78 96 66 Q90 58 84 52 M96 66 Q92 56 88 48 M100 70 Q104 58 108 50",
        antlerR: "M132 94 Q142 78 154 66 Q160 58 166 52 M154 66 Q158 56 162 48 M150 70 Q146 58 142 50",
      });
    },
    "deer-sponge": function () {
      return drawDeerFamily({
        label: "Fallow deer sponge antlers",
        fill: "#9a7a4a",
        antlerStroke: "#c49a72",
        antlerL: "M118 94 Q112 80 106 68 Q100 60 102 52 Q108 58 112 50 Q110 62 118 70",
        antlerR: "M132 94 Q138 80 144 68 Q150 60 148 52 Q142 58 138 50 Q140 62 132 70",
      });
    },
    "deer-lightning": function () {
      return drawDeerFamily({
        label: "Reindeer lightning antlers",
        fill: "#d8e4ef",
        youngFill: "#e8eef4",
        antlerStroke: "#6ec8ff",
        antlerL: "M118 94 L112 78 L118 70 L108 58 L114 50 L104 40",
        antlerR: "M132 94 L138 78 L132 70 L142 58 L136 50 L146 40",
      });
    },
    "deer-mineral": function () {
      return drawDeerFamily({
        label: "Deer mineral antlers",
        fill: "#8b6a45",
        antlerStroke: "#9bb0c4",
        antlerL: "M118 94 Q110 80 104 68 Q98 56 92 48 M104 68 Q108 58 112 50 M100 62 Q94 54 90 46",
        antlerR: "M132 94 Q140 80 146 68 Q152 56 158 48 M146 68 Q142 58 138 50 M150 62 Q156 54 160 46",
      });
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
    var stage = stageFromCare(state.care);
    var draw = DRAW[c.draw] || drawMantis;
    creatureEl.innerHTML = draw();
    sceneEl.dataset.kind = c.kind;
    sceneEl.dataset.stage = String(stage);
    stageLabelEl.textContent = STAGE_LABELS[c.kind][stage];
    careMeterEl.textContent = "Care " + state.care;
  }

  function render() {
    renderPick();
    renderCreature();
  }

  function feed(habitName, btn) {
    var prevStage = stageFromCare(state.care);
    state.care += 1;
    saveState(state);
    var nextStage = stageFromCare(state.care);

    btn.classList.remove("is-pop");
    void btn.offsetWidth;
    btn.classList.add("is-pop");

    sceneEl.classList.remove("is-fed");
    void sceneEl.offsetWidth;
    sceneEl.classList.add("is-fed");

    renderCreature();

    if (nextStage !== prevStage) {
      sceneEl.dataset.stage = String(nextStage);
    }

    window.setTimeout(function () {
      sceneEl.classList.remove("is-fed");
      btn.classList.remove("is-pop");
    }, 700);
  }

  document.querySelectorAll(".habit-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      feed(btn.getAttribute("data-habit"), btn);
    });
  });

  render();
})();
