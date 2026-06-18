/**
 * Halalit — render Personal Library spines as miniature publishing-style covers.
 *
 * Goals:
 *  - Distinct surname / centered title / publisher mark / occasional volume
 *  - Deterministic per-book variation (font family, palette, layout, alignment jitter)
 *  - Optional wear overlay scaled to years since the reader finished the book
 *  - Mounts cleanly on any container that holds book entries from
 *    HalalitPersonalLibrary.load()
 */
(function (global) {
  var doc = global.document;

  var TITLE_FONTS = [
    "\"Georgia\", \"Times New Roman\", serif",
    "\"Palatino\", \"Book Antiqua\", serif",
    "\"Iowan Old Style\", \"Baskerville\", serif",
    "\"Didot\", \"Bodoni 72\", serif",
  ];
  var DISPLAY_FONTS = [
    "\"Trajan Pro\", \"Cinzel\", \"Georgia\", serif",
    "\"Optima\", \"Avenir\", system-ui, sans-serif",
    "\"Garamond\", \"EB Garamond\", serif",
    "\"Iowan Old Style\", \"Baskerville\", serif",
  ];
  var END_FONTS = [
    "\"Optima\", \"Avenir Next\", system-ui, sans-serif",
    "\"Helvetica Neue\", \"Inter\", sans-serif",
    "\"Trajan Pro\", \"Cinzel\", serif",
  ];

  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

  /**
   * Tiny stable-publisher catalog. Each entry is glyph + short imprint.
   * Glyphs are restrained Unicode marks chosen to read at 8-12px.
   */
  var PUBLISHERS = [
    { glyph: "❦", imprint: "ALDINE" },
    { glyph: "✦", imprint: "ASTOR" },
    { glyph: "◇", imprint: "OBELISK" },
    { glyph: "❧", imprint: "PRESS" },
    { glyph: "✥", imprint: "MARLOWE" },
    { glyph: "✜", imprint: "QUARTO" },
    { glyph: "❖", imprint: "EMERY" },
    { glyph: "⚜", imprint: "FOLIO" },
    { glyph: "✸", imprint: "NORTHWIND" },
    { glyph: "✺", imprint: "GASLIGHT" },
    { glyph: "❂", imprint: "MERIDIAN" },
    { glyph: "✤", imprint: "HALCYON" },
  ];

  function hash32(str) {
    var h = 2166136261;
    var s = String(str || "");
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rngFor(seedStr) {
    var state = hash32(seedStr) || 1;
    return function next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state = state >>> 0;
      return state / 4294967296;
    };
  }

  function pick(arr, rnd) {
    return arr[Math.floor(rnd() * arr.length) % arr.length];
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /**
   * Map Open Library edition page-count medians to shelf spine size. Thicker/taller for
   * long books, slimmer/shorter for novellas — only when `book.olPagesMedian` is set.
   * @returns {{ w: number, h: number } | null}
   */
  function physicalSpineBasePixels(book) {
    var med = book && book.olPagesMedian;
    if (typeof med !== "number" || !isFinite(med) || med < 12) return null;
    var p = clamp(med, 20, 1050);
    var lo = Math.log(20);
    var hi = Math.log(1050);
    var t = (Math.log(p) - lo) / (hi - lo);
    t = clamp(t, 0, 1);
    var w = Math.round(20 + t * 44);
    var h = Math.round(92 + t * 62);
    return { w: w, h: h };
  }

  /** Rough per-glyph width for mixed-case serif spine type (scaled by font px). */
  function approxGlyphWidthPx(ch, sizePx) {
    if (!ch || ch === " ") return 0.28 * sizePx;
    var cp = ch.charCodeAt(0);
    if (cp >= 0x3040) return 0.62 * sizePx;
    var u = ch.toUpperCase();
    var lo = ch.toLowerCase();
    if (ch === u && ch !== lo) return 0.6 * sizePx;
    var narrow = "ijlft1!:.,;'|";
    if (narrow.indexOf(lo) !== -1) return 0.42 * sizePx;
    var wide = "mw@%~";
    if (wide.indexOf(lo) !== -1) return 0.68 * sizePx;
    return 0.5 * sizePx;
  }

  /** Approximate rendered width (px) for spine title text with letter-spacing in em. */
  function approxTitleWidthPx(str, sizePx, trackEm) {
    var s = String(str || "");
    var len = s.length;
    if (len <= 0) return 0;
    var sum = 0;
    for (var i = 0; i < len; i++) sum += approxGlyphWidthPx(s.charAt(i), sizePx);
    var trackExtra = len > 1 ? (len - 1) * trackEm * sizePx : 0;
    return sum + trackExtra;
  }

  /** Serif + weight + font variance: keep measured width ≤ this × reality so scale fits. */
  var TITLE_WIDTH_SAFETY = 1.24;
  var SPINE_HEIGHT_MAX = 460;
  /** Inset inside the painted spine (must match index.html .book-spine padding). */
  var SPINE_EDGE_PAD_V = 5;
  var SPINE_EDGE_PAD_H = 3;
  var FACE_INNER_CHROME_PX = 10;
  var TITLE_END_GUTTER_PX = 4;
  /** Room inside the title band so ascenders are not clipped by overflow:hidden. */
  var TITLE_SLOT_EXTRA_PX = 12;

  function titleWidthForFit(str, sizePx, trackEm) {
    return approxTitleWidthPx(str, sizePx, trackEm) * TITLE_WIDTH_SAFETY;
  }

  /** Block-axis length for upright vertical-rl title (along the spine). */
  var TITLE_LINE_HEIGHT = 1.12;

  function approxTitleAlongSpinePx(str, sizePx, trackEm) {
    var s = String(str || "");
    var len = s.length;
    if (len <= 0) return 0;
    var trackExtra = len > 1 ? (len - 1) * trackEm * sizePx : 0;
    return len * sizePx * TITLE_LINE_HEIGHT + trackExtra;
  }

  var _measureCanvas = null;
  function getMeasureCtx() {
    if (!doc) return null;
    if (!_measureCanvas) _measureCanvas = doc.createElement("canvas");
    return _measureCanvas.getContext("2d");
  }

  /**
   * Length of the title along the spine (vertical-rl block axis, upright letters).
   * Uses canvas per-glyph bounds in the browser; vertical stack estimate otherwise.
   */
  function measureTitleAlongSpinePx(str, sizePx, trackEm, fontFamily, fontWeight) {
    var s = String(str || "");
    if (!s) return 0;
    var stack = approxTitleAlongSpinePx(s, sizePx, trackEm);
  /* Browser canvas horizontal metrics do not match vertical-rl layout; use stack estimate. */
    return stack * TITLE_WIDTH_SAFETY + sizePx * 0.35;
  }

  /** Widest glyph across the spine (inline axis for vertical-rl). */
  function measureTitleAcrossSpinePx(sizePx, str, fontFamily, fontWeight) {
    var s = String(str || "");
    var floor = sizePx * 1.34 + 6;
    if (!s) return floor;
    var ctx = getMeasureCtx();
    if (ctx) {
      var fw = fontWeight || 600;
      ctx.font = fw + " " + sizePx.toFixed(2) + "px " + (fontFamily || "Georgia, serif");
      var maxW = 0;
      for (var i = 0; i < s.length; i++) {
        var w = ctx.measureText(s.charAt(i)).width;
        if (w > maxW) maxW = w;
      }
      return Math.max(floor, maxW + 5);
    }
    var maxG = 0;
    for (var j = 0; j < s.length; j++) {
      var gw = approxGlyphWidthPx(s.charAt(j), sizePx);
      if (gw > maxG) maxG = gw;
    }
    return Math.max(floor, maxG + 5);
  }

  /** Strip HTML tags and collapse whitespace so we can measure visible content. */
  function plainTextOf(html) {
    return String(html || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Approximate px extent of top/bottom bands along the spine (vertical-flow
   * type). Matches ~6–6.5px caps with imprint/glyph stacking.
   */
  function approxEndWidthPx(html) {
    var text = plainTextOf(html);
    var len = text.length;
    if (len === 0) return 0;
    /* Slightly conservative so title math leaves readable room for author / imprint. */
    return Math.min(len * 5.0 + 5, 114);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function surnameOf(author) {
    var s = String(author || "").trim();
    if (!s) return "";
    var stripped = s.replace(/,.*$/, "").trim();
    var parts = stripped.split(/\s+/);
    var last = parts[parts.length - 1] || "";
    return last.toUpperCase();
  }

  /**
   * Pull a clean title surface for the spine (drops a trailing subtitle after a
   * colon if the title is long enough that both wouldn't fit). Preserves
   * capitalization from the saved title. Returns the sanitized title.
   */
  function spineTitle(rawTitle) {
    var t = String(rawTitle || "").trim();
    if (!t) return "";
    var trimmed = t;
    if (t.length > 26) {
      var colonAt = t.indexOf(":");
      if (colonAt > 6) trimmed = t.slice(0, colonAt).trim();
    }
    return trimmed;
  }

  /**
   * Tighten long spine lines like a real binder: remove a *second* " the "
   * (case-insensitive, and optionally " and ") without mangling single-the
   * titles like "The Lord of the Rings". Preserves original letter casing.
   */
  function compactSpineGlance(title) {
    var orig = String(title || "").replace(/\s+/g, " ").trim();
    var s = orig;
    /* Dropping a second "the" mangles real titles ("…Meets the Moon"). Only squeeze very long strings. */
    if (s.length <= 28) return s;
    var reThe = /\s+the\s+/gi;
    var matches = [];
    var m;
    while ((m = reThe.exec(s)) !== null) matches.push({ start: m.index, len: m[0].length });
    if (s.length > 44 && matches.length >= 2) {
      var second = matches[1];
      s = (s.slice(0, second.start) + " " + s.slice(second.start + second.len)).replace(/\s+/g, " ").trim();
    }
    if (s.length > 40) {
      var reAnd = /\s+and\s+/i;
      var ma = reAnd.exec(s);
      if (ma && ma.index > 10 && ma.index < s.length - 8) {
        s = (s.slice(0, ma.index) + " " + s.slice(ma.index + ma[0].length)).replace(/\s+/g, " ").trim();
      }
    }
    return s.length >= 10 ? s : orig;
  }

  /** Last resort: clip at a word boundary so a home reader still spots the book. */
  function truncateSpineGlance(title, maxChars) {
    var s = String(title || "").trim();
    if (s.length <= maxChars) return s;
    var cut = s.slice(0, maxChars);
    var sp = cut.lastIndexOf(" ");
    if (sp >= Math.min(14, maxChars - 6)) return cut.slice(0, sp).trim();
    return cut.trim();
  }

  /** Title string used on shelf entries before `spineTitle` (strip " by Author" from titlePlain). */
  function rawBookTitle(book) {
    var raw = String(book.title || "").trim();
    if (raw) return raw;
    var plain = String(book.titlePlain || "").trim();
    if (!plain) return "";
    var m = plain.match(/^(.+?)\s+by\s+(.+)$/i);
    return m ? m[1].trim() : plain;
  }

  /** Author for spine ends when `book.author` is missing but titlePlain has "Title by Author". */
  function authorForSpine(book) {
    var a = String(book.author || "").trim();
    if (a) return a;
    var plain = String(book.titlePlain || "").trim();
    var m = plain.match(/^(.+?)\s+by\s+(.+)$/i);
    return m ? m[2].trim() : "";
  }

  /**
   * Minimum spine height (px) so the full title fits with light horizontal
   * squash only. Uses the same display string as the spine. Returns 0 when
   * the random shelf height is likely enough.
   */
  function recommendedSpineHeightPixels(book) {
    var st = spineTitle(rawBookTitle(book));
    var shown = compactSpineGlance(st || "");
    var len = shown.length;
    if (len <= 10) return 0;
    var minFont = 6.38;
    var track = 0.042;
    var need = measureTitleAlongSpinePx(shown, minFont, track, TITLE_FONTS[0], 600);
    /* End caps + padding/gaps + title↔end gutters (must stay in sync with buildSpineHtml). */
    var chrome = SPINE_EDGE_PAD_V * 2 + FACE_INNER_CHROME_PX + 44;
    /* +14: buildSpineHtml may add titleBoost, jitter, and extra height when type still needs room. */
    var h = Math.ceil(need * 1.12 + chrome) + 14;
    return clamp(h, 96, SPINE_HEIGHT_MAX);
  }

  /** Years between today and finishedAt (YYYY, YYYY-MM-DD, or YYYY-MM with implied day). */
  function yearsSinceFinished(finishedAt) {
    var s = String(finishedAt || "").trim();
    if (!s) return null;
    // Full ISO timestamps from older saves / imports: use the calendar date only.
    var isoHead = s.match(/^(\d{4}-\d{2}-\d{2})[Tt\s]/);
    if (isoHead) s = isoHead[1];
    else if (/^\d{4}-\d{2}-\d{2}/.test(s) && s.length > 10) s = s.slice(0, 10);
    var now = new Date();
    var then;

    // Year alone (no month): anchor at Jan 1 so each calendar year ages distinctly,
    // and "finished this year" never jumps to mid-year (which could lie in the future).
    var yo = s.match(/^(\d{4})$/);
    if (yo) {
      var yy = parseInt(yo[1], 10);
      if (yy < 1500 || yy > 9999) return null;
      then = new Date(yy, 0, 1);
      if (isNaN(then.getTime())) return null;
    } else {
      var ymd = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
      if (!ymd) return null;
      var y = parseInt(ymd[1], 10);
      var m = ymd[2] ? parseInt(ymd[2], 10) - 1 : 6;
      var d = ymd[3] ? parseInt(ymd[3], 10) : 15;
      then = new Date(y, m, d);
      if (isNaN(then.getTime())) return null;
    }

    var diffMs = now - then;
    if (diffMs < 0) return 0;
    return diffMs / (365.25 * 24 * 60 * 60 * 1000);
  }

  /** Years since an ISO timestamp (e.g. `addedAt`), or null if unparseable. */
  function yearsSinceIsoTimestamp(isoStr) {
    var t = Date.parse(String(isoStr || "").trim());
    if (isNaN(t)) return null;
    var diffMs = Date.now() - t;
    if (diffMs < 0) return null;
    return diffMs / (365.25 * 24 * 60 * 60 * 1000);
  }

  /**
   * Years used for patina: prefers `finishedAt` (when you read it). If that
   * is missing, uses `addedAt` (first save in this browser), capped so
   * unknown-read books never look decades-old.
   */
  function yearsForPatina(book) {
    var yf = yearsSinceFinished(book && book.finishedAt);
    if (yf != null && yf >= 0) return yf;
    var ya = yearsSinceIsoTimestamp(book && book.addedAt);
    if (ya == null || ya < 0.25) return null;
    return Math.min(ya, 6);
  }

  /**
   * Build a deterministic palette. The base hue is hashed from the title so
   * the same book keeps the same color across renders. Cloth/leather/cream
   * variants use distinct lightness ranges with second band to suggest the
   * raised cords seen on hardback spines.
   */
  function paletteFor(rnd, seedStr) {
    var baseHue = hash32(seedStr + "|hue") % 360;
    var family = pick(["leather", "cloth", "linen", "vellum"], rnd);
    if (family === "leather") {
      var hL = (baseHue + 12) % 360;
      var top = "hsl(" + hL + ", 38%, 28%)";
      var mid = "hsl(" + hL + ", 36%, 22%)";
      var foot = "hsl(" + hL + ", 30%, 14%)";
      return {
        family: family,
        ink: "rgba(245, 222, 175, 0.92)",
        gold: "rgba(232, 197, 124, 0.88)",
        bg:
          "linear-gradient(180deg," +
          top + " 0%," + top + " 8%," +
          mid + " 9%," + mid + " 92%," +
          foot + " 93%," + foot + " 100%)",
        bandTint: "rgba(0,0,0,0.18)",
      };
    }
    if (family === "linen") {
      var hLi = (baseHue + 30) % 360;
      var topLi = "hsl(" + hLi + ", 14%, 78%)";
      var midLi = "hsl(" + hLi + ", 12%, 70%)";
      var footLi = "hsl(" + hLi + ", 10%, 56%)";
      return {
        family: family,
        ink: "rgba(38, 28, 18, 0.92)",
        gold: "rgba(110, 78, 38, 0.92)",
        bg:
          "linear-gradient(180deg," +
          topLi + " 0%," + topLi + " 9%," +
          midLi + " 10%," + midLi + " 90%," +
          footLi + " 91%," + footLi + " 100%)",
        bandTint: "rgba(0,0,0,0.10)",
      };
    }
    if (family === "vellum") {
      var hV = (baseHue + 38) % 360;
      var topV = "hsl(" + hV + ", 28%, 82%)";
      var midV = "hsl(" + hV + ", 22%, 75%)";
      var footV = "hsl(" + hV + ", 18%, 64%)";
      return {
        family: family,
        ink: "rgba(36, 24, 14, 0.92)",
        gold: "rgba(126, 78, 30, 0.95)",
        bg:
          "linear-gradient(180deg," +
          topV + " 0%," + topV + " 7%," +
          midV + " 8%," + midV + " 92%," +
          footV + " 93%," + footV + " 100%)",
        bandTint: "rgba(0,0,0,0.08)",
      };
    }
    var hC = baseHue;
    var topC = "hsl(" + hC + ", 38%, 42%)";
    var midC = "hsl(" + hC + ", 34%, 32%)";
    var bandC = "hsl(" + ((hC + 18) % 360) + ", 30%, 24%)";
    var footC = "hsl(" + hC + ", 32%, 22%)";
    return {
      family: family,
      ink: "rgba(245, 234, 214, 0.95)",
      gold: "rgba(232, 197, 124, 0.92)",
      bg:
        "linear-gradient(180deg," +
        topC + " 0%," + topC + " 7%," +
        midC + " 8%," + midC + " 38%," +
        bandC + " 39%," + bandC + " 56%," +
        midC + " 57%," + midC + " 88%," +
        footC + " 89%," + footC + " 100%)",
      bandTint: "rgba(0,0,0,0.16)",
    };
  }

  /**
   * Spine palette from Open Library cover sampling (H/S/L 0–360 / 0–100 / 0–100).
   * Keeps saturation moderate so pastels stay pastel and neons don’t dominate.
   */
  function paletteFromCoverSample(h, s, l) {
    var hN = ((Number(h) % 360) + 360) % 360;
    var sIn = clamp(Number(s) || 0, 0, 100);
    var lIn = clamp(Number(l) || 40, 0, 100);
    var sUse = clamp(sIn * 0.72 + 6, 10, 46);
    if (sIn > 55) sUse = clamp(26 + (sIn - 55) * 0.25, 10, 48);
    var lBase = clamp(lIn, 26, 76);
    var top = "hsl(" + hN + "," + sUse.toFixed(1) + "%," + Math.min(86, lBase + 12).toFixed(1) + "%)";
    var mid = "hsl(" + hN + "," + (sUse * 0.95).toFixed(1) + "%," + lBase.toFixed(1) + "%)";
    var foot = "hsl(" + hN + "," + (sUse * 0.88).toFixed(1) + "%," + Math.max(16, lBase - 16).toFixed(1) + "%)";
    var darkSpine = lBase < 40;
    return {
      family: "cloth",
      ink: darkSpine ? "rgba(245, 234, 214, 0.95)" : "rgba(38, 28, 18, 0.92)",
      gold: darkSpine ? "rgba(232, 197, 124, 0.92)" : "rgba(110, 78, 38, 0.92)",
      bg:
        "linear-gradient(180deg," +
        top +
        " 0%," +
        top +
        " 7%," +
        mid +
        " 8%," +
        mid +
        " 92%," +
        foot +
        " 93%," +
        foot +
        " 100%)",
      bandTint: darkSpine ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.09)",
    };
  }

  /**
   * Decorative cords for hardback feel: two thin embossed bands that cross
   * the spine near top and bottom, plus a hairline rule above the publisher.
   */
  function bandsLayer(rnd, palette) {
    var hasCords = palette.family === "leather" || palette.family === "vellum" || rnd() < 0.4;
    if (!hasCords) return "";
    var topCord = (10 + rnd() * 6).toFixed(1);
    var botCord = (78 + rnd() * 8).toFixed(1);
    return (
      '<span class="bs-cords" style="' +
      "background:" +
      "linear-gradient(180deg, transparent 0%, transparent " + (parseFloat(topCord) - 0.7).toFixed(1) + "%," +
      "rgba(0,0,0,0.32) " + topCord + "%, rgba(255,255,255,0.10) " + (parseFloat(topCord) + 0.6).toFixed(1) + "%," +
      "transparent " + (parseFloat(topCord) + 1.4).toFixed(1) + "%, transparent " + (parseFloat(botCord) - 0.7).toFixed(1) + "%," +
      "rgba(0,0,0,0.32) " + botCord + "%, rgba(255,255,255,0.08) " + (parseFloat(botCord) + 0.6).toFixed(1) + "%," +
      "transparent " + (parseFloat(botCord) + 1.4).toFixed(1) + "%, transparent 100%);" +
      '" aria-hidden="true"></span>'
    );
  }

  /**
   * Material age 0..1 from years since finished — drives patina, not decay.
   * Week-old ~ pristine; then depth, warmth, and tactile richness build like
   * fine leather or wood (graceful evolution, always cared-for).
   * Year-only dates use a Jan 1 anchor, so the 1y vs 2y+ shelf gap stays obvious.
   */
  function wearStrength(years) {
    if (years == null) return 0;
    if (years <= 0) return 0;

    function smooth01(x) {
      x = clamp(x, 0, 1);
      return x * x * (3 - 2 * x); // smootherstep
    }

    // Very recent reads stay light; keep a short “fresh” window (~3 weeks).
    if (years < 0.06) return 0;

    var w;
    // Light wear through the first ~year; stronger step from 1y → 2.5y so
    // "finished two+ calendar years ago" reads clearly older on the wall.
    if (years < 1) {
      var t = (years - 0.06) / (1 - 0.06);
      w = 0.14 * smooth01(t);
    } else if (years < 2.5) {
      var t2 = (years - 1) / 1.5;
      w = 0.14 + 0.30 * smooth01(t2);
    } else if (years < 8) {
      var t3 = (years - 2.5) / 5.5;
      w = 0.44 + 0.22 * smooth01(t3);
    } else if (years < 16) {
      var t4 = (years - 8) / 8;
      w = 0.66 + 0.18 * smooth01(t4);
    } else {
      var t5 = (years - 16) / 24;
      w = 0.84 + 0.16 * smooth01(t5);
    }
    return clamp(w, 0, 1);
  }

  /**
   * Inset edge darkening from years alone — normal blend, so aging stays visible
   * even when soft-light wear reads flat inside the library diorama stack.
   * (Warm patina / sheen continues in wearLayerHtml.)
   */
  function ageVignetteHtml(yearsPatina) {
    if (yearsPatina == null || yearsPatina < 0.06) return "";
    var u = clamp(yearsPatina / 6, 0, 1);
    var edge = (0.15 + Math.pow(u, 0.85) * 0.85).toFixed(3);
    return (
      '<span class="bs-age-vignette" style="--age-edge:' + edge + '" aria-hidden="true"></span>'
    );
  }

  function wearLayerHtml(years) {
    var w = wearStrength(years);
    if (w <= 0.001) return "";
    var patina = (0.2 + w * 0.48).toFixed(3);
    var edge = (0.1 + w * 0.28).toFixed(3);
    var sheen = (0.1 + w * 0.4).toFixed(3);
    var grain = (0.03 + w * 0.14).toFixed(3);
    var depth = (0.06 + w * 0.2).toFixed(3);
    return (
      '<span class="bs-wear bs-wear--patina" style="--wear:' + w.toFixed(3) +
      ";--wear-patina:" + patina +
      ";--wear-edge:" + edge +
      ";--wear-sheen:" + sheen +
      ";--wear-grain:" + grain +
      ";--wear-depth:" + depth +
      '" aria-hidden="true"></span>'
    );
  }

  /**
   * Build the inner face HTML. The face is laid out left→right in a
   * Narrow column (true spine proportions): surname / imprint at head and tail,
   * title as vertical Latin in the middle — same geometry as shelf spines without
   * rotating whole lines or horizontally squashing letterforms.
   */
  function faceHtml(parts, opts) {
    var titleInnerStyle =
      "writing-mode:vertical-rl;" +
      "text-orientation:mixed;" +
      "font-family:" + opts.titleFont + ";" +
      "font-size:" + opts.titleSize.toFixed(2) + "px;" +
      "letter-spacing:" + opts.titleTracking.toFixed(3) + "em;" +
      "color:" + opts.ink + ";" +
      "font-weight:" + opts.titleWeight + ";" +
      "white-space:nowrap;line-height:" +
      TITLE_LINE_HEIGHT +
      ";max-height:100%;";
    var displayStyle =
      "font-family:" + opts.displayFont + ";" +
      "color:" + opts.gold + ";";
    var endStyle =
      "font-family:" + opts.endFont + ";" +
      "color:" + opts.gold + ";";
    if (opts.endFontSize) {
      endStyle += "font-size:" + opts.endFontSize.toFixed(2) + "px;";
    }

    var topZone = parts.top
      ? '<span class="bs-end bs-end--top" style="' + endStyle + '">' + parts.top + "</span>"
      : '<span class="bs-end bs-end--top" aria-hidden="true"></span>';
    var bottomZone = parts.bottom
      ? '<span class="bs-end bs-end--bottom" style="' + endStyle + '">' + parts.bottom + "</span>"
      : '<span class="bs-end bs-end--bottom" aria-hidden="true"></span>';
    var slot = Math.max(12, opts.titleAlongPx != null ? opts.titleAlongPx : 28);
    var slotPx = slot.toFixed(0);
    var titleZone =
      '<span class="bs-title" style="flex:0 0 ' +
      slotPx +
      "px;height:" +
      slotPx +
      "px;max-height:" +
      slotPx +
      'px;">' +
      '<span class="bs-title-inner" style="' +
      titleInnerStyle +
      '">' +
      parts.title +
      "</span></span>";
    var rule = parts.rule ? '<span class="bs-rule" style="background:' + opts.gold + '" aria-hidden="true"></span>' : "";
    var ornament = parts.ornament
      ? '<span class="bs-orn" style="' + displayStyle + '">' + parts.ornament + "</span>"
      : "";

    return (
      '<span class="bs-face">' + topZone + rule + titleZone + ornament + bottomZone + "</span>"
    );
  }

  /**
   * Build a single spine HTML string for `book` (entry from
   * HalalitPersonalLibrary.load()), sized to `spineW` × `spineH` px.
   */
  function buildSpineHtml(book, spineW, spineH) {
    var titlePlain = book.titlePlain || (book.author ? book.title + " by " + book.author : book.title);
    var seedStr = String(titlePlain || "spine");
    var rnd = rngFor(seedStr);
    var hasOlColor =
      typeof book.olCoverH === "number" &&
      !isNaN(book.olCoverH) &&
      typeof book.olCoverS === "number" &&
      !isNaN(book.olCoverS) &&
      typeof book.olCoverL === "number" &&
      !isNaN(book.olCoverL);
    var palette = hasOlColor ? paletteFromCoverSample(book.olCoverH, book.olCoverS, book.olCoverL) : paletteFor(rnd, seedStr);

    var spineAuthor = authorForSpine(book);
    var rawSurname = surnameOf(spineAuthor);
    var titleSrc = spineTitle(rawBookTitle(book));
    var titleShown = compactSpineGlance(titleSrc || "");

    var hasSeries = rnd() < 0.18 && titleShown.length <= 22;
    var volumeRoman = hasSeries ? ROMAN[Math.floor(rnd() * ROMAN.length)] : "";
    var publisher = PUBLISHERS[Math.floor(rnd() * PUBLISHERS.length)];

    /* Trade spines usually put the author toward the foot; keep variation but bias downward. */
    var surnameAtTop = rnd() < 0.28;
    var topText = "";
    var bottomText = "";
    if (rawSurname) {
      var spacedSurname = rawSurname;
      if (surnameAtTop) {
        topText = escapeHtml(spacedSurname);
        bottomText = volumeRoman
          ? '<span class="bs-vol">' + escapeHtml(volumeRoman) + "</span> " +
            '<span class="bs-pub">' + escapeHtml(publisher.glyph) + "</span>"
          : '<span class="bs-pub">' + escapeHtml(publisher.glyph) + "</span> " +
            '<span class="bs-imprint">' + escapeHtml(publisher.imprint) + "</span>";
      } else {
        topText = volumeRoman
          ? '<span class="bs-vol">' + escapeHtml(volumeRoman) + "</span>"
          : '<span class="bs-imprint">' + escapeHtml(publisher.imprint) + "</span>";
        bottomText =
          escapeHtml(spacedSurname) +
          ' <span class="bs-pub">' + escapeHtml(publisher.glyph) + "</span>";
      }
    } else {
      /* No author: keep the foot clean — long faux imprints clip as odd letter clusters beside the title. */
      topText = volumeRoman ? '<span class="bs-vol">' + escapeHtml(volumeRoman) + "</span>" : "";
      bottomText = '<span class="bs-pub">' + escapeHtml(publisher.glyph) + "</span>";
    }

    /* Long titles need vertical room — keep author, drop decorative imprint stacks. */
    if (titleShown.length > 32 && rawSurname) {
      topText = volumeRoman
        ? '<span class="bs-vol">' + escapeHtml(volumeRoman) + "</span>"
        : "";
      bottomText = escapeHtml(rawSurname);
    }

    var titleFont = pick(TITLE_FONTS, rnd);
    var displayFont = pick(DISPLAY_FONTS, rnd);
    var endFont = pick(END_FONTS, rnd);
    var titleWeight = rnd() < 0.4 ? 700 : 600;
    var lenForCap = titleShown.length;
    var maxTitlePx = lenForCap > 30 ? 7.55 : lenForCap > 22 ? 8.05 : 9.15;
    var thickRng = rngFor(seedStr + "|thick");
    var titleBoost = titleShown.length > 26 ? 10 : titleShown.length > 20 ? 6 : 0;
    var hasPageSizing =
      typeof book.olPagesMedian === "number" &&
      !isNaN(book.olPagesMedian) &&
      book.olPagesMedian >= 12;
    var jH = hasPageSizing ? Math.round((thickRng() - 0.5) * 2) : Math.round((thickRng() - 0.5) * 6);
    var jW = hasPageSizing ? Math.round((thickRng() - 0.5) * 2) : Math.round((thickRng() - 0.5) * 4);
    var spineHUse = clamp(spineH + jH + titleBoost, 96, SPINE_HEIGHT_MAX);
    var spineWUse = clamp(spineW + jW, 22, 72);
    var titleSize = clamp(7.6 + (Math.min(spineHUse, 160) - 100) * 0.035, 6.62, maxTitlePx);
    if (titleShown.length > 14) titleSize -= 0.45;
    if (titleShown.length > 20) titleSize -= 0.55;
    if (titleShown.length > 26) titleSize -= 0.45;
    var titleTracking = clamp(0.05 + rnd() * 0.07 - (titleShown.length > 18 ? 0.04 : 0), 0.0, 0.12);
    var titleLen = titleShown.length;

    // Compute available title room from the actual end-zone content widths
    // rather than the worst-case 36%/side reservation. Padding is 5px on each
    // side of the face plus a 4px gap on either side of the title.
    var topEndWidth = approxEndWidthPx(topText);
    var bottomEndWidth = approxEndWidthPx(bottomText);
    var innerH = spineHUse - SPINE_EDGE_PAD_V * 2;
    function recomputeAvailTitle() {
      availTitlePx = Math.max(
        20,
        innerH - topEndWidth - bottomEndWidth - FACE_INNER_CHROME_PX - 2 * TITLE_END_GUTTER_PX
      );
    }
    var availTitlePx = 28;
    recomputeAvailTitle();

    /* Grow before shrinking type so long titles are not squashed on a short spine. */
    var roughAlong =
      approxTitleAlongSpinePx(titleShown, titleSize, titleTracking) * TITLE_WIDTH_SAFETY;
    var roughStack =
      topEndWidth +
      Math.ceil(roughAlong) +
      TITLE_SLOT_EXTRA_PX +
      bottomEndWidth +
      FACE_INNER_CHROME_PX +
      2 * TITLE_END_GUTTER_PX +
      SPINE_EDGE_PAD_V * 2 +
      6;
    if (spineHUse < roughStack) {
      spineHUse = clamp(roughStack, spineHUse, SPINE_HEIGHT_MAX);
      innerH = spineHUse - SPINE_EDGE_PAD_V * 2;
      recomputeAvailTitle();
    }

    var hardMinTitlePx = 5.35;
    var minTitlePx = titleLen > 20 ? 6.08 : Math.max(hardMinTitlePx, 4.85);
    var innerW = Math.max(12, spineWUse - SPINE_EDGE_PAD_H * 2 - 2);
    var maxTitlePxForWidth = Math.max(minTitlePx, innerW * 0.82 - 3);
    if (titleSize > maxTitlePxForWidth) titleSize = Math.max(minTitlePx, maxTitlePxForWidth);
    var endFontSize = innerW < 24 ? Math.min(5.8, 0.42 * innerW) : 6.4;
    function titleFitCapPx() {
      return Math.max(12, availTitlePx - TITLE_SLOT_EXTRA_PX);
    }
    function measureAlong() {
      return measureTitleAlongSpinePx(
        titleShown,
        titleSize,
        titleTracking,
        titleFont,
        titleWeight
      );
    }
    function measureAcross() {
      return measureTitleAcrossSpinePx(titleSize, titleShown, titleFont, titleWeight);
    }
    function ensureSpineWideEnoughForType() {
      var across = measureAcross();
      var needW = Math.ceil(across) + SPINE_EDGE_PAD_H * 2 + 4;
      if (spineWUse < needW) {
        spineWUse = clamp(needW, spineWUse, 72);
        innerW = Math.max(12, spineWUse - SPINE_EDGE_PAD_H * 2 - 2);
        maxTitlePxForWidth = Math.max(minTitlePx, innerW * 0.82 - 3);
        if (titleSize > maxTitlePxForWidth) {
          titleSize = Math.max(minTitlePx, maxTitlePxForWidth);
        }
      }
    }
    function shrinkTypeToFit() {
      ensureSpineWideEnoughForType();
      var cap = titleFitCapPx();
      while (titleSize > minTitlePx && measureAlong() > cap) {
        titleSize -= 0.085;
      }
      ensureSpineWideEnoughForType();
      while (titleSize > minTitlePx && measureAcross() > innerW - 1) {
        ensureSpineWideEnoughForType();
        if (measureAcross() <= innerW - 1) break;
        titleSize -= 0.085;
      }
      while (titleTracking > 0.002 && measureAlong() > cap) {
        titleTracking = Math.max(0, titleTracking - 0.018);
      }
    }
    shrinkTypeToFit();
    var wFit = measureAlong();
    function truncateAndRemeasure(maxChars) {
      titleShown = truncateSpineGlance(titleShown, maxChars);
      titleLen = titleShown.length;
      minTitlePx = titleLen > 20 ? 6.08 : Math.max(hardMinTitlePx, 4.85);
      titleSize = clamp(titleSize + 0.35, minTitlePx, maxTitlePx);
      shrinkTypeToFit();
      wFit = measureAlong();
    }
    function titleOverflowsCap() {
      return wFit > titleFitCapPx() || measureAcross() > innerW - 1;
    }
    function titleSlotNeededPx() {
      return Math.ceil(wFit) + TITLE_SLOT_EXTRA_PX;
    }
    var titleAcrossPx = Math.ceil(measureAcross());

    while (titleSlotNeededPx() > availTitlePx && spineHUse < SPINE_HEIGHT_MAX) {
      spineHUse = Math.min(
        SPINE_HEIGHT_MAX,
        spineHUse + Math.ceil(titleSlotNeededPx() - availTitlePx + 10)
      );
      innerH = spineHUse - SPINE_EDGE_PAD_V * 2;
      recomputeAvailTitle();
      if (titleSize > maxTitlePxForWidth) titleSize = Math.max(minTitlePx, maxTitlePxForWidth);
      shrinkTypeToFit();
      wFit = measureAlong();
      titleAcrossPx = Math.ceil(measureAcross());
    }

    var titleSlotRender = titleSlotNeededPx();
    var stackNeed =
      topEndWidth +
      titleSlotRender +
      bottomEndWidth +
      FACE_INNER_CHROME_PX +
      2 * TITLE_END_GUTTER_PX;
    var minSpineForContent = stackNeed + SPINE_EDGE_PAD_V * 2 + 6;
    if (spineHUse < minSpineForContent) {
      spineHUse = clamp(minSpineForContent, spineHUse, SPINE_HEIGHT_MAX);
      innerH = spineHUse - SPINE_EDGE_PAD_V * 2;
      recomputeAvailTitle();
      shrinkTypeToFit();
      wFit = measureAlong();
      titleSlotRender = titleSlotNeededPx();
    }

    function ensureTitleFitsInSpine() {
      var guard = 0;
      while (guard < 12) {
        ensureSpineWideEnoughForType();
        shrinkTypeToFit();
        wFit = measureAlong();
        titleSlotRender = titleSlotNeededPx();
        var stackFloor =
          topEndWidth +
          titleSlotRender +
          bottomEndWidth +
          FACE_INNER_CHROME_PX +
          2 * TITLE_END_GUTTER_PX +
          SPINE_EDGE_PAD_V * 2 +
          6;
        var changed = false;
        if (spineHUse < stackFloor && spineHUse < SPINE_HEIGHT_MAX) {
          spineHUse = clamp(stackFloor, spineHUse, SPINE_HEIGHT_MAX);
          innerH = spineHUse - SPINE_EDGE_PAD_V * 2;
          recomputeAvailTitle();
          changed = true;
        }
        while (titleSlotNeededPx() > availTitlePx && spineHUse < SPINE_HEIGHT_MAX) {
          spineHUse = Math.min(
            SPINE_HEIGHT_MAX,
            spineHUse + Math.ceil(titleSlotNeededPx() - availTitlePx + 8)
          );
          innerH = spineHUse - SPINE_EDGE_PAD_V * 2;
          recomputeAvailTitle();
          changed = true;
        }
        if (!changed) break;
        guard++;
      }
      titleSlotRender = titleSlotNeededPx();
    }
    ensureTitleFitsInSpine();

    /* Only shorten the title when the spine is already as tall as we allow. */
    if (spineHUse >= SPINE_HEIGHT_MAX - 1 && titleOverflowsCap()) {
      if (titleLen > 28) truncateAndRemeasure(36);
      if (titleOverflowsCap() && titleLen > 22) truncateAndRemeasure(30);
      if (titleOverflowsCap() && titleLen > 16) truncateAndRemeasure(24);
      if (titleOverflowsCap()) {
        minTitlePx = hardMinTitlePx;
        shrinkTypeToFit();
        wFit = measureAlong();
      }
      if (titleOverflowsCap() && titleLen > 12) truncateAndRemeasure(18);
      if (titleOverflowsCap() && titleLen > 8) truncateAndRemeasure(14);
      ensureTitleFitsInSpine();
    }

    var ornament =
      titleLen > 18 || titleOverflowsCap()
        ? ""
        : rnd() < 0.22
          ? pick(["·", "❦"], rnd)
          : "";

    var bands = bandsLayer(rnd, palette);
    var yearsPatina = yearsForPatina(book);
    var patinaW = wearStrength(yearsPatina);
    var ageTint = ageVignetteHtml(yearsPatina);
    var wear = wearLayerHtml(yearsPatina);

    var face = faceHtml(
      {
        top: topText,
        bottom: bottomText,
        title: escapeHtml(titleShown),
        rule: rnd() < 0.6,
        ornament: ornament ? escapeHtml(ornament) : "",
      },
      {
        titleAlongPx: titleSlotRender,
        titleFont: titleFont,
        displayFont: displayFont,
        endFont: endFont,
        endFontSize: endFontSize,
        titleSize: titleSize,
        titleTracking: titleTracking,
        titleWeight: titleWeight,
        ink: palette.ink,
        gold: palette.gold,
      }
    );

    /* Older spines: slightly softer lean and slower sway (“relaxed” binding). */
    var leanDeg = (rnd() - 0.5) * (1.35 + patinaW * 0.55);
    var animDelayS = -rnd() * 8;
    var animDurS = (4.6 + rnd() * 3.4) * (1 + patinaW * 0.28);

    var brTl = (2 + patinaW * 1.35).toFixed(2);
    var brTr = (3 + patinaW * 1.55).toFixed(2);
    var brBr = (3 + patinaW * 1.55).toFixed(2);
    var brBl = (2 + patinaW * 1.35).toFixed(2);

    var labTitle = rawBookTitle(book) || String(book.title || "").trim() || titlePlain;
    var ariaLabel = spineAuthor ? labTitle + " by " + spineAuthor : labTitle;
    if (book.finishedAt) ariaLabel += " · finished " + book.finishedAt;
    else if (yearsPatina != null && yearsPatina >= 0.25 && book.addedAt)
      ariaLabel += " · patina from save date; set Date read for finish date";

    var titleAttr =
      titlePlain +
      (book.finishedAt
        ? " — finished " + book.finishedAt
        : yearsPatina != null && yearsPatina >= 0.25
          ? " — patina from save date; long-press → Edit Date read for finish date"
          : "");

    return (
      '<div class="book-spine book-spine--rich"' +
      ' style="--spine-w:' + spineWUse + "px;--spine-h:" + spineHUse + "px;" +
      "--spine-bg:" + palette.bg + ";" +
      "--spine-band-tint:" + palette.bandTint + ";" +
      "--spine-patina:" +
      patinaW.toFixed(3) +
      ";border-radius:" +
      brTl +
      "px " +
      brTr +
      "px " +
      brBr +
      "px " +
      brBl +
      "px;--spine-lean:" +
      leanDeg.toFixed(2) +
      "deg;--spine-anim-delay:" +
      animDelayS.toFixed(2) +
      "s;--spine-anim-dur:" +
      animDurS.toFixed(2) +
      's;"' +
      ' data-family="' + escapeAttr(palette.family) + '"' +
      ' title="' + escapeAttr(titleAttr) + '"' +
      ' aria-label="' + escapeAttr(ariaLabel) + '">' +
      bands +
      ageTint +
      face +
      wear +
      "</div>"
    );
  }

  global.HalalitBookSpine = {
    buildSpineHtml: buildSpineHtml,
    physicalSpineBasePixels: physicalSpineBasePixels,
    recommendedSpineHeightPixels: recommendedSpineHeightPixels,
    rawBookTitle: rawBookTitle,
    yearsSinceFinished: yearsSinceFinished,
    yearsForPatina: yearsForPatina,
    wearStrength: wearStrength,
    surnameOf: surnameOf,
    spineTitle: spineTitle,
    compactSpineGlance: compactSpineGlance,
  };
})(typeof window !== "undefined" ? window : this);
