(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CrocheterDifficulty = factory();
  }
})(typeof self !== "undefined" ? self : this, function difficultyFactory() {
  const LEVEL_ORDER = ["beginner", "easy", "intermediate", "intermediate-advanced", "advanced"];

  const DISPLAY_LABEL = {
    beginner: "Beginner",
    easy: "Easy",
    intermediate: "Intermediate",
    "intermediate-advanced": "Intermediate–Advanced",
    advanced: "Advanced",
  };

  /** Overlapping inclusion bands per hub filter tier (scores 0 = easiest … 100 = hardest). */
  const LEVEL_BANDS = [
    { id: "beginner", low: 0, high: 26 },
    { id: "easy", low: 17, high: 44 },
    { id: "intermediate", low: 36, high: 62 },
    { id: "intermediate-advanced", low: 54, high: 80 },
    { id: "advanced", low: 72, high: 100 },
  ];

  function canonicalLevel(v) {
    if (!v || typeof v !== "string") return null;
    const k = v.trim().toLowerCase().replace(/\s+/g, "-");
    if (k === "intermediate–advanced" || k === "intermediate-advanced") return "intermediate-advanced";
    if (LEVEL_ORDER.includes(k)) return k;
    return null;
  }

  function defaultFeatures() {
    return {
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
    };
  }

  function inferFromSteps(steps) {
    if (!Array.isArray(steps) || !steps.length) return {};
    const text = steps
      .map((s) => (s && (s.html || s.title || "")).toLowerCase())
      .join(" \n ");

    const out = {};

    if (/\bmagic\b|\bring\b|\bjoined\b|\bjoin\b|\bmotif\b|\bin the round\b|\brnd\b|\beach\b.*\brown/.test(text)) {
      if (!out.construction) out.construction = "in_the_round";
    }
    if (/\bgranny\b|\bcorner\b.*\bch\b|\bmagic ring\b|\b3 dc\b.*\bch\s*3/.test(text)) {
      out.construction = "motif_square";
    }
    if (/\bshell\b|\blace\b|\bmesh\b|\bpicot\b|\bpineapple\b|\bchain space/.test(text)) {
      out.meshOrLace = true;
    }
    if (/\bedge\b|\balong fabric\b|\battach yarn\b/.test(text)) {
      out.construction = "lace_edging";
    }
    if (/\bincrease\b|\bdecrease\b|\bsc2tog\b|\bdec\b|\btog\b|\b2 dc in\b/.test(text)) {
      out.shaping = "simple_inc_dec";
    }
    if (/\bfitted\b|\bsleeve\b|\bcollar\b|\bbrim\b.*\bjoin\b|\bsweater\b|\bcardigan\b/.test(text)) {
      out.construction = "fitted_garment";
      out.sizingSensitivity = "high";
    }
    if (/\bassembly\b|\bsew\b|\bseam\b|\bweave\b.*\bparts\b/.test(text)) {
      out.joining = "heavy_assembly";
    }
    if (/\bpanel\b|\bsew together\b|\bjoin pieces\b/.test(text)) {
      out.joining = "seaming_panels";
      out.construction = out.construction === "flat_rectangle" ? "multi_panel" : out.construction;
    }
    if (/\bgauge\b|\bswatch\b/.test(text)) {
      out.gaugeSensitivity = "high";
    }
    if (/\bamigurumi\b|\bstuffed\b|\blimbs\b/.test(text)) {
      out.construction = "amigurumi";
      out.smallPartsPieces = Math.max(out.smallPartsPieces || 0, 4);
    }
    if (/\brepeat rows\b|\brows \d+[–-]\d+\b/.test(text)) {
      out.repeatComplexity = "tracked_multistep";
    }
    if (/\btr\b|\btreble\b|\bpopcorn\b|\bpost\b|\bfront post\b|\bback post\b/.test(text)) {
      out.stitches = "advanced_specialty";
    } else if (/\b(dc|double crochet|hdc|half double)\b/.test(text)) {
      out.stitches = out.stitches || "mostly_basic";
    }

    return out;
  }

  function inferFromTitle(title) {
    if (!title || typeof title !== "string") return {};
    const t = title.toLowerCase();
    const out = {};
    if (/doily|lace|pineapple/.test(t)) out.meshOrLace = true;
    if (/pineapple/.test(t)) out.construction = "complex_motif";
    if (/edging/.test(t)) out.construction = "lace_edging";
    return out;
  }

  function mergeFeatures(pattern) {
    const base = defaultFeatures();
    const fromTitle = inferFromTitle(pattern.title);
    const fromSteps = inferFromSteps(pattern.steps);
    const explicit = pattern.features && typeof pattern.features === "object" ? pattern.features : {};
    return {
      ...base,
      ...fromTitle,
      ...fromSteps,
      ...explicit,
    };
  }

  function scoreConstruction(f, reasons, featuresDetected) {
    const c = f.construction;
    const table = {
      flat_rectangle: 4,
      /** Long repeats / yardage stamina—edges into Easy overlap without requiring new skills. */
      simple_scarf_rectangle: 14,
      motif_square: 10,
      in_the_round: 14,
      lace_edging: 18,
      wrap_shawl: 28,
      simple_wearable: 26,
      multi_panel: 40,
      fitted_garment: 52,
      amigurumi: 48,
      complex_motif: 34,
      mixed: 30,
    };
    const pts = table[c] != null ? table[c] : 18;
    if (pts >= 22) reasons.push(`Construction (“${String(c).replace(/_/g, " ")}”) adds notable complexity.`);
    featuresDetected.construction = c;
    return pts;
  }

  function scoreShaping(f, reasons, featuresDetected) {
    const w = {
      none: 0,
      simple_inc_dec: 12,
      moderate: 22,
      complex: 38,
    };
    const s = f.shaping;
    const pts = w[s] != null ? w[s] : 16;
    if (pts >= 12) reasons.push(`Shaping level (“${String(s).replace(/_/g, " ")}”) increases complexity.`);
    featuresDetected.shaping = s;
    return pts;
  }

  function scoreJoining(f, reasons, featuresDetected) {
    const w = {
      none: 0,
      simple_slip_join_rounds: 5,
      seaming_panels: 24,
      heavy_assembly: 40,
    };
    const j = f.joining;
    const pts = w[j] != null ? w[j] : 10;
    if (pts >= 12) reasons.push(`Joining / assembly (“${String(j).replace(/_/g, " ")}”) adds coordination work.`);
    featuresDetected.joining = j;
    return pts;
  }

  function scoreGaugeSizing(f, reasons, featuresDetected) {
    let pts = 0;
    const g = f.gaugeSensitivity;
    const z = f.sizingSensitivity;
    if (g === "medium") {
      pts += 8;
      reasons.push("Gauge matters somewhat (fit or drape).");
    } else if (g === "high") {
      pts += 18;
      reasons.push("Gauge is important for success.");
    }
    if (z === "medium") {
      pts += 10;
      reasons.push("Sizing or measurements need modest attention.");
    } else if (z === "high") {
      pts += 22;
      reasons.push("Sizing or grading is central to this project.");
    }
    featuresDetected.gaugeSensitivity = g;
    featuresDetected.sizingSensitivity = z;
    return pts;
  }

  function scoreRepeat(f, reasons, featuresDetected) {
    const w = {
      simple_same_row: 2,
      tracked_multistep: 8,
      chart_like_complex: 28,
    };
    const r = f.repeatComplexity;
    const pts = w[r] != null ? w[r] : 10;
    if (pts >= 14) reasons.push("Row or round repeats need consistent tracking.");
    featuresDetected.repeatComplexity = r;
    return pts;
  }

  function scoreStitches(f, reasons, featuresDetected) {
    const w = {
      basic_only: 2,
      mostly_basic: 8,
      mixed_including_specialty: 18,
      advanced_specialty: 32,
    };
    const s = f.stitches;
    const pts = w[s] != null ? w[s] : 12;
    if (pts >= 18) reasons.push("Stitch vocabulary goes beyond chains and basic US stitches.");
    featuresDetected.stitches = s;
    return pts;
  }

  function scoreMeshColorFinishing(f, reasons, featuresDetected) {
    let pts = 0;
    if (f.meshOrLace) {
      const density = f.laceComplexity === "heavy" ? "heavy" : "light";
      featuresDetected.laceComplexity = density;
      const bump = density === "heavy" ? 16 : 10;
      pts += bump;
      reasons.push("Openwork, mesh, or lace sections need stitch placement awareness.");
    }
    featuresDetected.meshOrLace = !!f.meshOrLace;
    const cw = f.colorwork;
    if (cw === "simple_stripes") {
      pts += 6;
      reasons.push("Simple color changes add yarn management.");
    } else if (cw === "stranded_intarsia") {
      pts += 16;
      reasons.push("Stranded or intarsia-style colorwork increases difficulty.");
    }
    featuresDetected.colorwork = cw;
    const fin = f.finishing;
    if (fin === "blocking") {
      pts += 8;
      reasons.push("Blocking or shaping the finish matters for the look.");
    } else if (fin === "structural_assembly") {
      pts += 20;
      reasons.push("Structural finishing or stiffening steps are non-trivial.");
    }
    featuresDetected.finishing = fin;
    return pts;
  }

  function scoreSmallParts(f, reasons, featuresDetected) {
    const n = Number(f.smallPartsPieces) || 0;
    const capped = Math.min(Math.max(n, 0), 12);
    if (capped <= 0) {
      featuresDetected.smallPartsPieces = 0;
      return 0;
    }
    const pts = Math.min(capped * 7, 36);
    reasons.push(`Several small pieces (${capped}+) imply tracking and attachment.`);
    featuresDetected.smallPartsPieces = capped;
    return pts;
  }

  function clampScore(score) {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function primaryLabelFromScore(score) {
    if (score <= 22) return "beginner";
    if (score <= 40) return "easy";
    if (score <= 56) return "intermediate";
    if (score <= 72) return "intermediate-advanced";
    return "advanced";
  }

  function matchingLevels(score) {
    return LEVEL_BANDS.filter((b) => score >= b.low && score <= b.high).map((b) => b.id);
  }

  /** Ensure every score yields at least one bucket (floating edge case). */
  function ensureLevels(levels, score, primaryLabel) {
    const out = levels.length ? levels.slice() : [primaryLabel];
    if (!LEVEL_ORDER.some((id) => out.includes(id))) out.push(primaryLabel);
    return out;
  }

  /**
   * @param {Record<string, unknown>} featuresMerged — already merged defaults + inferred + explicit
   */
  function classifyFromFeatures(featuresMerged) {
    const reasons = [];
    const featuresDetected = {};

    let score =
      scoreConstruction(featuresMerged, reasons, featuresDetected) +
      scoreShaping(featuresMerged, reasons, featuresDetected) +
      scoreJoining(featuresMerged, reasons, featuresDetected) +
      scoreGaugeSizing(featuresMerged, reasons, featuresDetected) +
      scoreRepeat(featuresMerged, reasons, featuresDetected) +
      scoreStitches(featuresMerged, reasons, featuresDetected) +
      scoreMeshColorFinishing(featuresMerged, reasons, featuresDetected) +
      scoreSmallParts(featuresMerged, reasons, featuresDetected);

    score = clampScore(score);
    const primaryLabel = primaryLabelFromScore(score);
    let levels = matchingLevels(score);
    levels = ensureLevels(levels, score, primaryLabel);

    const labelHuman = DISPLAY_LABEL[primaryLabel] || primaryLabel;

    return {
      label: primaryLabel,
      labelHuman,
      score,
      reasons,
      featuresDetected,
      matchingLevels: levels,
    };
  }

  /**
   * @param {{ title?: string, steps?: Array<{title?: string, html?: string}> , features?: Record<string, unknown> }} pattern
   */
  function classifyPattern(pattern) {
    const mergedFeatures = mergeFeatures(pattern);
    return classifyFromFeatures(mergedFeatures);
  }

  /**
   * @param result — from classifyPattern
   * @param {string|null|undefined} difficultyOverride canonical level id or null
   */
  function filterLevels(result, difficultyOverride) {
    const o = canonicalLevel(difficultyOverride);
    if (o) return [o];
    return result.matchingLevels.slice();
  }

  function difficultyDisplay(overrideSlug, classification) {
    const o = canonicalLevel(overrideSlug);
    if (o)
      return {
        effectiveSlug: o,
        effectiveHuman: DISPLAY_LABEL[o] || o,
        overridden: true,
      };
    return {
      effectiveSlug: classification.label,
      effectiveHuman: classification.labelHuman || DISPLAY_LABEL[classification.label],
      overridden: false,
    };
  }

  return {
    LEVEL_ORDER,
    DISPLAY_LABEL,
    LEVEL_BANDS,
    canonicalLevel,
    classifyPattern,
    classifyFromFeatures,
    mergeFeatures,
    filterLevels,
    difficultyDisplay,
  };
});
