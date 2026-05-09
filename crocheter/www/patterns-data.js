(function (root) {
  const FB_LEVELS = ["beginner", "easy", "intermediate", "intermediate-advanced", "advanced"];
  const FB_LABELS = {
    beginner: "Beginner",
    easy: "Easy",
    intermediate: "Intermediate",
    "intermediate-advanced": "Intermediate–Advanced",
    advanced: "Advanced",
  };

  function attachFallbackDifficultyApi() {
    console.warn(
      "[Crocheter] pattern-difficulty-core.js did not load — using fallback difficulty. " +
        "Fix script paths or redeploy so the core file loads; meanwhile patterns show under every skill filter."
    );
    function fallbackDifficulty() {
      return {
        label: "easy",
        labelHuman: "Easy — fallback estimate",
        score: 30,
        reasons: [
          "Full scorer unavailable (pattern-difficulty-core.js missing or blocked). Showing all filters until fixed.",
        ],
        featuresDetected: {},
        matchingLevels: FB_LEVELS.slice(),
      };
    }
    root.CrocheterDifficulty = {
      LEVEL_ORDER: FB_LEVELS,
      DISPLAY_LABEL: FB_LABELS,
      canonicalLevel(v) {
        if (!v || typeof v !== "string") return null;
        const k = v.trim().toLowerCase().replace(/\s+/g, "-");
        if (k === "intermediate–advanced") return "intermediate-advanced";
        if (FB_LEVELS.includes(k)) return k;
        return null;
      },
      classifyPattern(pat) {
        void pat;
        return fallbackDifficulty();
      },
      classifyFromFeatures() {
        return fallbackDifficulty();
      },
      mergeFeatures(pat) {
        return Object.assign(
          {},
          typeof pat.features === "object" && pat.features ? pat.features : {}
        );
      },
      difficultyDisplay(overrideSlug, classification) {
        const o = root.CrocheterDifficulty.canonicalLevel(overrideSlug);
        if (o) return { effectiveSlug: o, effectiveHuman: FB_LABELS[o] || o, overridden: true };
        return {
          effectiveSlug: classification.label,
          effectiveHuman: classification.labelHuman || FB_LABELS[classification.label] || classification.label,
          overridden: false,
        };
      },
      filterLevels(result, difficultyOverride) {
        const o = root.CrocheterDifficulty.canonicalLevel(difficultyOverride);
        if (o) return [o];
        return result.matchingLevels.slice();
      },
    };
  }

  const Diff = root.CrocheterDifficulty || (attachFallbackDifficultyApi(), root.CrocheterDifficulty);

  const OVERRIDE_STORAGE_KEY = "crocheter_difficulty_overrides_v1";

  const rawById = {
    washcloth: {
      id: "washcloth",
      slug: "washcloth",
      route: "washcloth.html",
      title: "Simple cotton washcloth",
      blurb: "Straight rows of single crochet—great first project.",
      meta: "Worsted cotton · 5 mm hook · ~25 minutes · saved in your browser",
      preview: "../washcloth-preview.png",
      difficultyOverride: null,
      features: {
        construction: "flat_rectangle",
        shaping: "none",
        joining: "none",
        gaugeSensitivity: "low",
        sizingSensitivity: "low",
        repeatComplexity: "simple_same_row",
        stitches: "basic_only",
        meshOrLace: false,
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [
        { title: "Foundation", html: "Make a slip knot. Work 31 <span class=\"gloss\" data-tip=\"Yarn over, pull through loop on hook—repeat.\">chains (ch)</span>." },
        { title: "Row 1", html: "Skip 1 ch. Work 1 <span class=\"gloss\" data-tip=\"Insert hook, yarn over, pull up a loop, yarn over, pull through both loops.\">single crochet (sc)</span> in each ch across (30 sc)." },
        { title: "Rows 2–12", html: "Ch 1, turn. Sc in each st across. Repeat until fabric feels square." },
        { title: "Finish", html: "Fasten off, weave ends gently. Block flat with a damp cloth if you like." },
      ],
    },
    "simple-scarf": {
      id: "simple-scarf",
      slug: "simple-scarf",
      route: "simple-scarf.html",
      title: "Simple scarf",
      blurb: "Long rectangle in one repeat—no shaping.",
      meta: "Worsted yarn · 5.5 mm hook · ~2 hours · saved in your browser",
      preview: "../washcloth-preview.png",
      difficultyOverride: null,
      features: {
        construction: "simple_scarf_rectangle",
        shaping: "none",
        joining: "none",
        gaugeSensitivity: "low",
        sizingSensitivity: "low",
        repeatComplexity: "simple_same_row",
        stitches: "basic_only",
        meshOrLace: false,
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [
        { title: "Foundation", html: "Ch 22 (or any width you like)." },
        { title: "Row 1", html: "Sc in second ch from hook and in each ch across." },
        { title: "Following rows", html: "Ch 1, turn. Sc in each st until scarf is long enough." },
        { title: "Finish", html: "Fasten off and weave ends." },
      ],
    },
    "basic-granny-square": {
      id: "basic-granny-square",
      slug: "basic-granny-square",
      route: "basic-granny-square.html",
      title: "Basic granny square",
      blurb: "Classic clusters and corners—small motifs add up fast.",
      meta: "Worsted cotton · 4 mm hook · ~45 minutes · saved in your browser",
      preview: "../granny-square-preview.svg",
      difficultyOverride: null,
      features: {
        construction: "motif_square",
        shaping: "none",
        joining: "simple_slip_join_rounds",
        gaugeSensitivity: "low",
        sizingSensitivity: "low",
        repeatComplexity: "tracked_multistep",
        stitches: "mostly_basic",
        meshOrLace: false,
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [
        { title: "Round 1", html: "Start with a magic ring or ch 4 and join. Ch 3 (counts as dc), 2 dc in ring, ch 3, *3 dc, ch 3* three times. Join." },
        { title: "Round 2+", html: "Sl st into ch-3 corner sp. Work groups of 3 dc with ch-3 corners in each space." },
        { title: "Finish", html: "Fasten off and weave ends. Block lightly if corners curl." },
      ],
    },
    "easy-dishcloth": {
      id: "easy-dishcloth",
      slug: "easy-dishcloth",
      route: "easy-dishcloth.html",
      title: "Easy dishcloth",
      blurb: "Dense fabric like the washcloth—quick kitchen gift.",
      meta: "Cotton worsted · 5 mm hook · ~25 minutes · saved in your browser",
      preview: "../washcloth-preview.png",
      difficultyOverride: null,
      features: {
        construction: "flat_rectangle",
        shaping: "none",
        joining: "none",
        gaugeSensitivity: "low",
        sizingSensitivity: "low",
        repeatComplexity: "simple_same_row",
        stitches: "basic_only",
        meshOrLace: false,
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [
        { title: "Foundation", html: "Ch 31." },
        { title: "Row 1", html: "Sc in second ch from hook and in each across." },
        { title: "Body", html: "Ch 1, turn. Sc across until roughly square." },
        { title: "Finish", html: "Fasten off, weave ends." },
      ],
    },
    laceEdging: {
      id: "laceEdging",
      slug: "lace-edging",
      route: "lace-edging.html",
      title: "Simple Lace Edging",
      blurb: "Shell rhythm along an edge.",
      meta: "Light cotton · 3 mm hook · ~20 minutes · saved in your browser",
      preview: "../laceEdging-preview.png",
      difficultyOverride: null,
      features: {
        construction: "lace_edging",
        shaping: "none",
        joining: "none",
        gaugeSensitivity: "low",
        sizingSensitivity: "low",
        repeatComplexity: "tracked_multistep",
        stitches: "mostly_basic",
        meshOrLace: true,
        laceComplexity: "light",
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [
        { title: "Set-up", html: "Work along fabric edge. Attach yarn, ch 1, sc evenly across edge." },
        { title: "Row 1", html: "*Skip 1 st, 5 dc in next st (shell), skip 1 st, sc in next st* repeat." },
        { title: "Row 2", html: "Sl st to shell center. Ch 1, *shell in each sc from previous row* repeat." },
        { title: "Finish", html: "Fasten off and weave ends. Lightly block if you want sharper lace points." },
      ],
    },
    doily: {
      id: "doily",
      slug: "doily",
      route: "doily.html",
      title: "Simple Round Crochet Doily",
      blurb: "Rounds, increases, and shells in the round.",
      meta: "Cotton thread · 2.5 mm hook · ~35 minutes · saved in your browser",
      preview: "../doily-preview.png",
      difficultyOverride: null,
      features: {
        construction: "in_the_round",
        shaping: "simple_inc_dec",
        joining: "simple_slip_join_rounds",
        gaugeSensitivity: "low",
        sizingSensitivity: "low",
        repeatComplexity: "tracked_multistep",
        stitches: "mostly_basic",
        meshOrLace: false,
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [
        { title: "Round 1", html: "Start with a <span class=\"gloss\" data-tip=\"Wrap yarn around fingers, crochet into ring, then tighten.\">magic ring</span>. Ch 2, work 12 dc in ring. Join with sl st. (12 sts)" },
        { title: "Round 2", html: "Ch 2. Work 2 dc in each st around. Join. (24 sts)" },
        { title: "Round 3", html: "Ch 3, *dc in next st, 2 dc in next st* around. Join. (36 sts)" },
        { title: "Round 4", html: "Ch 1, *sc in next 2 sts, shell (5 dc) in next st* around. Join and fasten off gently." },
      ],
    },
    pineapple: {
      id: "pineapple",
      slug: "pineapple-lace-motif",
      route: "pineapple-lace-motif.html",
      title: "Pineapple Lace Motif",
      blurb: "Open mesh and stacked shaping for lace practice.",
      meta: "Thread cotton · 2 mm hook · motif practice · saved in your browser",
      preview: "../pineapple-preview.png",
      difficultyOverride: null,
      features: {
        construction: "complex_motif",
        shaping: "moderate",
        joining: "none",
        gaugeSensitivity: "medium",
        sizingSensitivity: "low",
        repeatComplexity: "chart_like_complex",
        stitches: "mixed_including_specialty",
        meshOrLace: true,
        laceComplexity: "heavy",
        colorwork: "none",
        finishing: "blocking",
        smallPartsPieces: 0,
      },
      steps: [
        { title: "Base", html: "Begin with a small ring. Work dc clusters to form the base fan shape." },
        { title: "Open mesh", html: "Chain spaces between dc groups create the open lattice that frames the motif." },
        { title: "Pineapple body", html: "Work stacked shells and chain arches to narrow toward the pineapple tip." },
        { title: "Finish", html: "Close the motif with picot edging or a final shell row, then block gently." },
      ],
    },
  };

  function rowSteps(from, to, html) {
    var a = [];
    for (var r = from; r <= to; r++) {
      a.push({ title: "Row " + r, html: html });
    }
    return a;
  }
  function roundSteps(from, to, html) {
    var a = [];
    for (var r = from; r <= to; r++) {
      a.push({ title: "Round " + r, html: html });
    }
    return a;
  }
  function labelRows(label, from, to, html) {
    var a = [];
    for (var r = from; r <= to; r++) {
      a.push({ title: label + r, html: html });
    }
    return a;
  }

  Object.assign(rawById, {
    "beginner-cotton-dishcloth": {
      id: "beginner-cotton-dishcloth",
      slug: "beginner-cotton-dishcloth",
      route: "beginner-cotton-dishcloth.html",
      title: "Beginner cotton dishcloth",
      blurb: "Tidy single-crochet rows—great first kitchen cloth.",
      meta: "Cotton worsted · 5 mm hook · saved in your browser",
      preview: "../washcloth-preview.png",
      difficultyOverride: null,
      features: {
        construction: "flat_rectangle",
        shaping: "none",
        joining: "none",
        gaugeSensitivity: "low",
        sizingSensitivity: "low",
        repeatComplexity: "simple_same_row",
        stitches: "basic_only",
        meshOrLace: false,
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [{ title: "Foundation", html: "Ch 26." }, { title: "Row 1", html: "Sc in 2nd ch from hook and in each ch across. Turn." }]
        .concat(rowSteps(2, 24, "Ch 1, sc in each st across. Turn."))
        .concat([{ title: "Finish", html: "Fasten off and weave in ends." }]),
    },
    "simple-washcloth-hdc": {
      id: "simple-washcloth-hdc",
      slug: "simple-washcloth-hdc",
      route: "simple-washcloth-hdc.html",
      title: "Simple washcloth (half double crochet)",
      blurb: "Soft, slightly taller stitches than single crochet.",
      meta: "Cotton worsted · 5 mm hook · saved in your browser",
      preview: "../washcloth-preview.png",
      difficultyOverride: null,
      features: {
        construction: "flat_rectangle",
        shaping: "none",
        joining: "none",
        gaugeSensitivity: "low",
        sizingSensitivity: "low",
        repeatComplexity: "simple_same_row",
        stitches: "mostly_basic",
        meshOrLace: false,
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [{ title: "Foundation", html: "Ch 31." }, { title: "Row 1", html: "Hdc in 2nd ch from hook and in each ch across. Turn." }]
        .concat(rowSteps(2, 22, "Ch 1, hdc in each st across. Turn."))
        .concat([{ title: "Finish", html: "Fasten off." }]),
    },
    "easy-pot-holder": {
      id: "easy-pot-holder",
      slug: "easy-pot-holder",
      route: "easy-pot-holder.html",
      title: "Easy pot holder",
      blurb: "Thick square, folded and seamed—add a hanging loop if you like.",
      meta: "Cotton worsted · two layers · saved in your browser",
      preview: "../washcloth-finished.png",
      difficultyOverride: null,
      features: {
        construction: "flat_rectangle",
        shaping: "none",
        joining: "simple_slip_join_rounds",
        gaugeSensitivity: "low",
        sizingSensitivity: "low",
        repeatComplexity: "simple_same_row",
        stitches: "basic_only",
        meshOrLace: false,
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [{ title: "Foundation", html: "Ch 25." }, { title: "Row 1", html: "Sc in 2nd ch from hook and in each ch across. Turn." }]
        .concat(rowSteps(2, 25, "Ch 1, sc in each st across. Turn."))
        .concat([
          { title: "Fold", html: "Fold the square in half with wrong sides together (or as you prefer for thickness)." },
          { title: "Join edges", html: "Sc through both thicknesses along the open sides to join." },
          { title: "Hanging loop (optional)", html: "Ch 10, sl st to a corner; weave in ends." },
        ]),
    },
    "basic-market-bag": {
      id: "basic-market-bag",
      slug: "basic-market-bag",
      route: "basic-market-bag.html",
      title: "Basic market bag",
      blurb: "Solid base rows, then open mesh body and long straps.",
      meta: "Sturdy cotton · saved in your browser",
      preview: "../washcloth-preview.png",
      difficultyOverride: null,
      features: {
        construction: "flat_rectangle",
        shaping: "none",
        joining: "none",
        gaugeSensitivity: "low",
        sizingSensitivity: "low",
        repeatComplexity: "simple_same_row",
        stitches: "mostly_basic",
        meshOrLace: true,
        laceComplexity: "light",
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [{ title: "Foundation", html: "Ch 41." }, { title: "Row 1", html: "Sc in 2nd ch from hook and in each ch across. Turn." }]
        .concat(rowSteps(2, 10, "Sc in each st across. Turn."))
        .concat(
          rowSteps(
            11,
            30,
            "*Ch 5, skip 2 sts, sc in next st; repeat from * across the row."
          )
        )
        .concat([
          { title: "Strap 1", html: "Ch 60 (or desired strap length), fasten to bag top edge with sl st or sc." },
          { title: "Strap 2", html: "Ch 60 (or match first strap), attach to opposite side of bag opening." },
          { title: "Finish", html: "Fasten off and weave in all ends." },
        ]),
    },
    "mini-storage-basket": {
      id: "mini-storage-basket",
      slug: "mini-storage-basket",
      route: "mini-storage-basket.html",
      title: "Mini storage basket",
      blurb: "Worked in the round from a tight base, then straight sides.",
      meta: "Worsted weight · saved in your browser",
      preview: "../washcloth-preview.png",
      difficultyOverride: null,
      features: {
        construction: "in_the_round",
        shaping: "simple_inc_dec",
        joining: "simple_slip_join_rounds",
        gaugeSensitivity: "low",
        sizingSensitivity: "low",
        repeatComplexity: "tracked_multistep",
        stitches: "mostly_basic",
        meshOrLace: false,
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [
        { title: "Start", html: "Make a <span class=\"gloss\" data-tip=\"Wrap yarn around fingers, crochet into ring, then tighten.\">magic ring</span>." },
        { title: "Round 1", html: "Work 6 sc in ring. Join with sl st to first sc. (6 sts)" },
        { title: "Round 2", html: "Ch 1, 2 sc in each st around. Join. (12 sts)" },
        { title: "Round 3", html: "Ch 1, *sc in next st, 2 sc in next st* around. Join. (18 sts)" },
        { title: "Round 4", html: "Ch 1, *sc in each of next 2 sts, 2 sc in next st* around. Join. (24 sts)" },
        { title: "Round 5", html: "Ch 1, *sc in each of next 3 sts, 2 sc in next st* around. Join. (30 sts)" },
        { title: "Round 6", html: "Ch 1, *sc in each of next 4 sts, 2 sc in next st* around. Join. (36 sts)" },
        { title: "Round 7", html: "Ch 1, *sc in each of next 5 sts, 2 sc in next st* around. Join. (42 sts)" },
        { title: "Round 8", html: "Ch 1, sc in each st around. Join." },
      ]
        .concat(roundSteps(9, 14, "Ch 1, sc in each st around. Join."))
        .concat([{ title: "Round 15", html: "Ch 1, working in <span class=\"gloss\" data-tip=\"Back loop only—ridge forms basket rim.\">back loops only</span>, sc in each st around. Join." }])
        .concat(roundSteps(16, 24, "Ch 1, sc in each st around. Join."))
        .concat([{ title: "Finish", html: "Fasten off; weave ends to inside of basket." }]),
    },
    "pillow-cover-panel": {
      id: "pillow-cover-panel",
      slug: "pillow-cover-panel",
      route: "pillow-cover-panel.html",
      title: "Simple pillow cover (two panels)",
      blurb: "Two matching rectangles, then seam around a pillow form.",
      meta: "Worsted acrylic or cotton · saved in your browser",
      preview: "../washcloth-preview.png",
      difficultyOverride: null,
      features: {
        construction: "flat_rectangle",
        shaping: "none",
        joining: "simple_slip_join_rounds",
        gaugeSensitivity: "low",
        sizingSensitivity: "medium",
        repeatComplexity: "simple_same_row",
        stitches: "mostly_basic",
        meshOrLace: false,
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [{ title: "Panel 1 — foundation", html: "Ch to match pillow width (example: Ch 61 for a small accent pillow)." }]
        .concat(labelRows("Panel 1 — row ", 1, 1, "Dc in 3rd ch from hook and in each ch across. Turn."))
        .concat(labelRows("Panel 1 — row ", 2, 18, "Ch 2, dc in each st across. Turn."))
        .concat([{ title: "Panel 2 — foundation", html: "Repeat the same starting chain count as panel 1." }])
        .concat(labelRows("Panel 2 — row ", 1, 1, "Dc in 3rd ch from hook and in each ch across. Turn."))
        .concat(labelRows("Panel 2 — row ", 2, 18, "Ch 2, dc in each st across. Turn."))
        .concat([
          { title: "Join panels", html: "Hold panels with right sides together around pillow form; sc or slip stitch through both layers along three sides, insert pillow, then close remaining side." },
          { title: "Finish", html: "Fasten off; weave in ends." },
        ]),
    },
    "basic-throw-blanket": {
      id: "basic-throw-blanket",
      slug: "basic-throw-blanket",
      route: "basic-throw-blanket.html",
      title: "Basic throw blanket",
      blurb: "Wide rows of double crochet with a simple border.",
      meta: "Multiple skeins worsted · saved in your browser",
      preview: "../washcloth-preview.png",
      difficultyOverride: null,
      features: {
        construction: "flat_rectangle",
        shaping: "none",
        joining: "none",
        gaugeSensitivity: "low",
        sizingSensitivity: "low",
        repeatComplexity: "simple_same_row",
        stitches: "mostly_basic",
        meshOrLace: false,
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [{ title: "Foundation", html: "Ch 121." }, { title: "Row 1", html: "Dc in 3rd ch from hook and in each ch across. Turn." }]
        .concat(rowSteps(2, 40, "Ch 2, dc in each st across. Turn."))
        .concat([
          { title: "Border", html: "With right side facing, work sc evenly around entire blanket (3 sc in each corner space)." },
          { title: "Finish", html: "Fasten off and weave in ends." },
        ]),
    },
    "simple-beanie": {
      id: "simple-beanie",
      slug: "simple-beanie",
      route: "simple-beanie.html",
      title: "Simple beanie",
      blurb: "Ribbed strip in back-loop single crochet, then seam and gather.",
      meta: "Worsted wool or acrylic · saved in your browser",
      preview: "../washcloth-preview.png",
      difficultyOverride: null,
      features: {
        construction: "flat_rectangle",
        shaping: "none",
        joining: "simple_slip_join_rounds",
        gaugeSensitivity: "low",
        sizingSensitivity: "low",
        repeatComplexity: "simple_same_row",
        stitches: "basic_only",
        meshOrLace: false,
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [{ title: "Foundation", html: "Ch 31." }, { title: "Row 1", html: "Sc in 2nd ch from hook and in each ch across. Turn." }].concat(
        rowSteps(
          2,
          40,
          "Ch 1, working in <span class=\"gloss\" data-tip=\"Insert hook under the loop farthest from you on each stitch.\">back loops only</span>, sc in each st across. Turn."
        )
      ).concat([
        { title: "Seam", html: "Bring short ends together; seam with sl st or whip stitch to form a tube." },
        { title: "Crown", html: "Gather top opening closed with yarn needle and tail; secure." },
        { title: "Finish", html: "Weave in ends." },
      ]),
    },
    "mug-cozy": {
      id: "mug-cozy",
      slug: "mug-cozy",
      route: "mug-cozy.html",
      title: "Mug cozy",
      blurb: "Short band with a button and loop to fit your mug.",
      meta: "Small amount cotton · saved in your browser",
      preview: "../washcloth-preview.png",
      difficultyOverride: null,
      features: {
        construction: "flat_rectangle",
        shaping: "none",
        joining: "none",
        gaugeSensitivity: "low",
        sizingSensitivity: "medium",
        repeatComplexity: "simple_same_row",
        stitches: "basic_only",
        meshOrLace: false,
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [
        { title: "Foundation", html: "Ch enough sts to wrap snugly around your mug (try 28–36; check fit)." },
        { title: "Row 1", html: "Sc in 2nd ch from hook and in each ch across. Turn." },
      ]
        .concat(rowSteps(2, 6, "Ch 1, sc in each st across. Turn."))
        .concat([
          { title: "Button", html: "Sew a button firmly to one short end of the band." },
          { title: "Button loop", html: "On opposite end, ch 6 (or size to fit button), skip same number of sts, sc to end; turn and work back or sl st border to stabilize loop." },
          { title: "Finish", html: "Fasten off; weave in ends." },
        ]),
    },
    "basic-coaster": {
      id: "basic-coaster",
      slug: "basic-coaster",
      route: "basic-coaster.html",
      title: "Basic coaster",
      blurb: "Small rounds that sit flat under a cup.",
      meta: "Cotton · small hook · saved in your browser",
      preview: "../doily-preview.png",
      difficultyOverride: null,
      features: {
        construction: "in_the_round",
        shaping: "simple_inc_dec",
        joining: "simple_slip_join_rounds",
        gaugeSensitivity: "low",
        sizingSensitivity: "low",
        repeatComplexity: "simple_same_row",
        stitches: "mostly_basic",
        meshOrLace: false,
        colorwork: "none",
        finishing: "minimal",
        smallPartsPieces: 0,
      },
      steps: [
        { title: "Start", html: "Make a magic ring." },
        { title: "Round 1", html: "Ch 2 (counts as first dc here), work 9 more dc in ring—10 dc total. Join with sl st to top of ch-2." },
        { title: "Round 2", html: "Ch 2, 2 dc in each st around. Join. (20 sts)" },
        { title: "Round 3", html: "Ch 2, *dc in next st, 2 dc in next st* around. Join. (30 sts)" },
        { title: "Finish", html: "Fasten off; weave ends; steam block lightly if edges curl." },
      ],
    },
  });

  /** Shipped editorial override (canonical slug) or null. */
  function dataOverride(pat) {
    return Diff.canonicalLevel(pat.difficultyOverride);
  }

  function localOverride(pat) {
    if (typeof root.localStorage === "undefined") return null;
    try {
      const map = JSON.parse(root.localStorage.getItem(OVERRIDE_STORAGE_KEY) || "{}");
      if (!map || typeof map !== "object") return null;
      const v = map[pat.id];
      return Diff.canonicalLevel(v);
    } catch {
      return null;
    }
  }

  /**
   * Active admin/editor override: localStorage wins over JSON default (demo site has no backend).
   */
  function mergedDifficultyOverride(pat) {
    return localOverride(pat) || dataOverride(pat);
  }

  /** `'local'` = demo admin toolbar in browser; `'data'` = shipped `difficultyOverride` field. */
  function overrideSource(pat) {
    if (localOverride(pat)) return "local";
    if (dataOverride(pat)) return "data";
    return null;
  }

  function filterBucketsFor(pat) {
    const o = mergedDifficultyOverride(pat);
    if (o) return [o];
    return pat.difficulty.matchingLevels.slice();
  }

  /** Easiest (lowest score) first, then title — so advanced lace sits after dishcloths. */
  function sortPatternsByHubDifficulty(a, b) {
    const sa = a.difficulty && typeof a.difficulty.score === "number" ? a.difficulty.score : 0;
    const sb = b.difficulty && typeof b.difficulty.score === "number" ? b.difficulty.score : 0;
    if (sa !== sb) return sa - sb;
    return a.title.localeCompare(b.title);
  }

  const byId = {};
  Object.keys(rawById).forEach((key) => {
    const p = rawById[key];
    byId[p.id] = p;
    p.difficulty = Diff.classifyPattern(p);
  });

  function patternsForLevel(level) {
    let list;
    if (level === "all") {
      list = Object.values(byId);
    } else {
      list = Object.values(byId).filter((p) => filterBucketsFor(p).includes(level));
    }
    return list.slice().sort(sortPatternsByHubDifficulty);
  }

  function effectiveDifficultyDisplay(pat) {
    return Diff.difficultyDisplay(mergedDifficultyOverride(pat), pat.difficulty);
  }

  root.CrocheterPatterns = {
    byId,
    patternsForLevel,
    mergedDifficultyOverride,
    filterBucketsFor,
    effectiveDifficultyDisplay,
    overrideSource,
    OVERRIDE_STORAGE_KEY,
  };
})(typeof window !== "undefined" ? window : globalThis);
