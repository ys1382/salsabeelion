/**
 * LoreKeeper — document fonts (system + self-hosted open fonts).
 * Categories: one anchor per semi-category; see CATEGORIES + CATEGORY_MAP.
 * Hosted files: scripts/fetch-doc-fonts.sh → ./fonts/woff2/
 *
 * De-dupe (#3): one picker voice per category + typeface family. Weight variants
 * stay in FONTS for saved docs; pickerFonts() shows a single representative.
 * Before adding a face: LoreKeeperFontCatalog.propose({ ... }) — skip same job twice.
 */
(function (global) {
  var CATEGORIES = [
    { id: "basic-sans", label: "Basic sans" },
    { id: "formal-serif", label: "Formal serif" },
    { id: "book-serif", label: "Book / reading serif" },
    { id: "display-serif", label: "Display serif" },
    { id: "slab-serif", label: "Slab serif" },
    { id: "rounded-sans", label: "Rounded sans" },
    { id: "geometric-sans", label: "Geometric sans" },
    { id: "condensed-display", label: "Condensed display" },
    { id: "blackletter", label: "Blackletter / gothic" },
    { id: "monospace", label: "Monospace" },
    { id: "casual-script", label: "Casual script" },
    { id: "formal-script", label: "Formal script" },
    { id: "handwriting-print", label: "Handwriting print" },
    { id: "comic-informal", label: "Comic / informal" },
    { id: "marker-display", label: "Marker / display" },
    { id: "swash-decorative", label: "Swash / decorative" },
    { id: "brush-script", label: "Brush script" },
    { id: "fantasy-display", label: "Fantasy display" },
    { id: "uncial-medieval", label: "Uncial / medieval" },
    { id: "typewriter", label: "Typewriter" },
    { id: "distressed-typewriter", label: "Distressed typewriter" },
  ];

  function gfStack(cssName) {
    var n = String(cssName || "").toLowerCase();
    if (/mono|code|console|courier|inconsolata|cousine|prime/i.test(n)) return "monospace";
    if (/serif|garamond|baskerville|merriweather|lora|playfair|spectral|bitter|cardo|vollkorn|tinos|crimson|pt serif|source serif|libre baskerville|dm serif|eb garamond|alegreya(?! sans)|cinzel|elsie/i.test(n)) {
      return "serif";
    }
    if (/script|caveat|dancing|pacifico|lobster|amatic|indie flower|permanent marker|great vibes|satisfy|shadows|comic neue|grenze|kaushan|uncial|special elite/i.test(n)) {
      return "cursive";
    }
    return "sans-serif";
  }

  function sys(name, family, opts) {
    opts = opts || {};
    return {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name: name,
      family: family,
      hosted: false,
      weight: opts.weight || 400,
      systemFallback: !!opts.systemFallback,
      fallbackNote: opts.fallbackNote || "",
    };
  }

  function gf(name, cssName, opts) {
    opts = opts || {};
    var stack = opts.stack || gfStack(cssName);
    var weight = opts.weight || 400;
    var id = opts.id || cssName.toLowerCase().replace(/\s+/g, "-");
    if (weight !== 400 && !opts.id) id = id + "-" + weight;
    return {
      id: id,
      name: name,
      family: '"' + cssName + '", ' + stack,
      hosted: true,
      cssName: cssName,
      weight: weight,
      category: opts.category,
      role: opts.role || "alternate",
    };
  }

  var FONTS = [
    sys("Arial", 'Arial, Helvetica, sans-serif'),
    sys("Arial Black", '"Arial Black", Gadget, sans-serif'),
    sys("Comic Sans MS", '"Comic Sans MS", cursive, sans-serif'),
    sys("Courier New", '"Courier New", Courier, monospace'),
    sys("Garamond", 'Garamond, "Times New Roman", serif'),
    sys("Georgia", "Georgia, serif"),
    sys("Impact", "Impact, Haettenschweiler, sans-serif"),
    sys("Times New Roman", '"Times New Roman", Times, serif'),
    sys("Trebuchet MS", '"Trebuchet MS", Helvetica, sans-serif'),
    sys("Verdana", "Verdana, Geneva, sans-serif"),
    sys("Palatino", '"Palatino Linotype", Palatino, serif'),
    sys("Tahoma", "Tahoma, Geneva, sans-serif"),
    sys("Calibri", "Calibri, Candara, Segoe, sans-serif", {
      systemFallback: true,
      fallbackNote: "Calibri is not hosted here — your device uses Calibri if installed, or a similar sans.",
    }),
    sys("Cambria", "Cambria, Georgia, serif", {
      systemFallback: true,
      fallbackNote: "Cambria is not hosted here — your device uses Cambria if installed, or a similar serif.",
    }),
    sys("Century Gothic", '"Century Gothic", CenturyGothic, AppleGothic, sans-serif', {
      systemFallback: true,
      fallbackNote: "Century Gothic is not hosted — uses the system face or a substitute.",
    }),
    sys("Consolas", "Consolas, monaco, monospace", {
      systemFallback: true,
      fallbackNote: "Consolas is not hosted — uses the system monospace or a substitute.",
    }),
    sys("Lucida Console", '"Lucida Console", Monaco, monospace', {
      systemFallback: true,
      fallbackNote: "Lucida Console is not hosted — uses the system face or a substitute.",
    }),
    sys("Lucida Sans Unicode", '"Lucida Sans Unicode", "Lucida Grande", sans-serif', {
      systemFallback: true,
      fallbackNote: "Lucida Sans is not hosted — uses the system face or a substitute.",
    }),
    sys("Segoe UI", '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', {
      systemFallback: true,
      fallbackNote: "Segoe UI is not hosted — common on Windows; other devices use a similar sans.",
    }),
    sys("Book Antiqua", '"Book Antiqua", Palatino, serif', {
      systemFallback: true,
      fallbackNote: "Book Antiqua is not hosted — uses the system face or Palatino.",
    }),
    sys("Franklin Gothic Medium", '"Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif', {
      systemFallback: true,
      fallbackNote: "Franklin Gothic is not hosted — uses the system face or a substitute.",
    }),
    gf("Amatic SC", "Amatic SC"),
    gf("Caveat", "Caveat"),
    gf("Comfortaa", "Comfortaa"),
    gf("Comic Neue", "Comic Neue"),
    gf("Courier Prime", "Courier Prime"),
    gf("Crimson Text", "Crimson Text"),
    gf("Dancing Script", "Dancing Script"),
    gf("EB Garamond", "EB Garamond"),
    gf("Grenze Gotisch", "Grenze Gotisch", { category: "blackletter", role: "anchor", weight: 400 }),
    gf("Grenze Gotisch Medium", "Grenze Gotisch", { category: "blackletter", weight: 500 }),
    gf("Grenze Gotisch SemiBold", "Grenze Gotisch", { category: "blackletter", weight: 600 }),
    gf("Grenze Gotisch Bold", "Grenze Gotisch", { category: "blackletter", weight: 700 }),
    gf("Grenze Gotisch Black", "Grenze Gotisch", { category: "blackletter", weight: 900 }),
    gf("Indie Flower", "Indie Flower"),
    gf("Lato", "Lato"),
    gf("Lexend", "Lexend"),
    gf("Lobster", "Lobster"),
    gf("Lora", "Lora"),
    gf("Merriweather", "Merriweather"),
    gf("Montserrat", "Montserrat"),
    gf("Nunito", "Nunito"),
    gf("Open Sans", "Open Sans"),
    gf("Oswald", "Oswald"),
    gf("Pacifico", "Pacifico"),
    gf("Playfair Display", "Playfair Display"),
    gf("Poppins", "Poppins"),
    gf("PT Sans", "PT Sans"),
    gf("PT Serif", "PT Serif"),
    gf("Raleway", "Raleway"),
    gf("Roboto", "Roboto"),
    gf("Roboto Mono", "Roboto Mono"),
    gf("Roboto Slab", "Roboto Slab"),
    gf("Rubik", "Rubik"),
    gf("Source Sans 3", "Source Sans 3"),
    gf("Source Serif 4", "Source Serif 4"),
    gf("Spectral", "Spectral", { category: "book-serif", weight: 400 }),
    gf("Spectral Medium", "Spectral", { category: "book-serif", weight: 500 }),
    gf("Spectral SemiBold", "Spectral", { category: "book-serif", weight: 600 }),
    gf("Spectral Bold", "Spectral", { category: "book-serif", weight: 700 }),
    gf("Spectral ExtraBold", "Spectral", { category: "book-serif", weight: 800 }),
    gf("Ubuntu", "Ubuntu"),
    gf("Work Sans", "Work Sans"),
    gf("Inter", "Inter"),
    gf("Libre Baskerville", "Libre Baskerville"),
    gf("Fira Sans", "Fira Sans"),
    gf("Bitter", "Bitter"),
    gf("Cormorant", "Cormorant"),
    gf("Josefin Sans", "Josefin Sans"),
    gf("Manrope", "Manrope"),
    gf("Noto Sans", "Noto Sans"),
    gf("Noto Serif", "Noto Serif"),
    gf("Oxygen", "Oxygen"),
    gf("Quicksand", "Quicksand"),
    gf("Barlow", "Barlow"),
    gf("Anton", "Anton"),
    gf("Permanent Marker", "Permanent Marker"),
    gf("Great Vibes", "Great Vibes"),
    gf("Satisfy", "Satisfy"),
    gf("Shadows Into Light", "Shadows Into Light"),
    gf("Bebas Neue", "Bebas Neue"),
    gf("Inconsolata", "Inconsolata"),
    gf("DM Sans", "DM Sans"),
    gf("DM Serif Display", "DM Serif Display"),
    gf("Mukta", "Mukta"),
    gf("Karla", "Karla"),
    gf("Archivo", "Archivo"),
    gf("Titillium Web", "Titillium Web"),
    gf("Heebo", "Heebo"),
    gf("Kanit", "Kanit"),
    gf("Signika", "Signika"),
    gf("Signika Negative", "Signika Negative"),
    gf("Arimo", "Arimo"),
    gf("Tinos", "Tinos"),
    gf("Cousine", "Cousine"),
    gf("Cardo", "Cardo"),
    gf("Vollkorn", "Vollkorn"),
    gf("Alegreya", "Alegreya"),
    gf("Alegreya Sans", "Alegreya Sans"),
    gf("IBM Plex Sans", "IBM Plex Sans"),
    gf("IBM Plex Serif", "IBM Plex Serif"),
    gf("IBM Plex Mono", "IBM Plex Mono"),
    gf("Elsie Swash Caps", "Elsie Swash Caps", { category: "swash-decorative", role: "anchor" }),
    gf("Kaushan Script", "Kaushan Script", { category: "brush-script", role: "anchor" }),
    gf("Cinzel", "Cinzel", { category: "fantasy-display", role: "anchor" }),
    gf("Uncial Antiqua", "Uncial Antiqua", { category: "uncial-medieval", role: "anchor" }),
    gf("Special Elite", "Special Elite", { category: "distressed-typewriter", role: "anchor" }),
  ];

  var CATEGORY_MAP = {
    arial: { category: "basic-sans", role: "anchor" },
    "times-new-roman": { category: "formal-serif", role: "anchor" },
    merriweather: { category: "book-serif", role: "anchor" },
    spectral: { category: "book-serif", role: "alternate" },
    "spectral-500": { category: "book-serif", role: "alternate" },
    "spectral-600": { category: "book-serif", role: "alternate" },
    "spectral-700": { category: "book-serif", role: "alternate" },
    "spectral-800": { category: "book-serif", role: "alternate" },
    "playfair-display": { category: "display-serif", role: "anchor" },
    "roboto-slab": { category: "slab-serif", role: "anchor" },
    nunito: { category: "rounded-sans", role: "anchor" },
    montserrat: { category: "geometric-sans", role: "anchor" },
    oswald: { category: "condensed-display", role: "anchor" },
    "grenze-gotisch": { category: "blackletter", role: "anchor" },
    "grenze-gotisch-500": { category: "blackletter", role: "alternate" },
    "grenze-gotisch-600": { category: "blackletter", role: "alternate" },
    "grenze-gotisch-700": { category: "blackletter", role: "alternate" },
    "grenze-gotisch-900": { category: "blackletter", role: "alternate" },
    "courier-new": { category: "monospace", role: "anchor" },
    caveat: { category: "casual-script", role: "anchor" },
    "great-vibes": { category: "formal-script", role: "anchor" },
    "indie-flower": { category: "handwriting-print", role: "anchor" },
    "comic-sans-ms": { category: "comic-informal", role: "anchor" },
    "permanent-marker": { category: "marker-display", role: "anchor" },
    "courier-prime": { category: "typewriter", role: "anchor" },
    verdana: { category: "basic-sans", role: "alternate" },
    tahoma: { category: "basic-sans", role: "alternate" },
    "segoe-ui": { category: "basic-sans", role: "alternate" },
    "open-sans": { category: "basic-sans", role: "alternate" },
    roboto: { category: "basic-sans", role: "alternate" },
    lato: { category: "basic-sans", role: "alternate" },
    inter: { category: "basic-sans", role: "alternate" },
    "noto-sans": { category: "basic-sans", role: "alternate" },
    "source-sans-3": { category: "basic-sans", role: "alternate" },
    "pt-sans": { category: "basic-sans", role: "alternate" },
    georgia: { category: "formal-serif", role: "alternate" },
    garamond: { category: "formal-serif", role: "alternate" },
    cambria: { category: "formal-serif", role: "alternate" },
    palatino: { category: "formal-serif", role: "alternate" },
    "book-antiqua": { category: "formal-serif", role: "alternate" },
    lora: { category: "book-serif", role: "alternate" },
    bitter: { category: "book-serif", role: "alternate" },
    "crimson-text": { category: "book-serif", role: "alternate" },
    "pt-serif": { category: "book-serif", role: "alternate" },
    "source-serif-4": { category: "book-serif", role: "alternate" },
    "noto-serif": { category: "book-serif", role: "alternate" },
    "libre-baskerville": { category: "book-serif", role: "alternate" },
    cardo: { category: "book-serif", role: "alternate" },
    vollkorn: { category: "book-serif", role: "alternate" },
    alegreya: { category: "book-serif", role: "alternate" },
    "ibm-plex-serif": { category: "book-serif", role: "alternate" },
    cormorant: { category: "display-serif", role: "alternate" },
    "dm-serif-display": { category: "display-serif", role: "alternate" },
    "eb-garamond": { category: "display-serif", role: "alternate" },
    comfortaa: { category: "rounded-sans", role: "alternate" },
    quicksand: { category: "rounded-sans", role: "alternate" },
    poppins: { category: "geometric-sans", role: "alternate" },
    raleway: { category: "geometric-sans", role: "alternate" },
    rubik: { category: "geometric-sans", role: "alternate" },
    "work-sans": { category: "geometric-sans", role: "alternate" },
    ubuntu: { category: "geometric-sans", role: "alternate" },
    manrope: { category: "geometric-sans", role: "alternate" },
    "bebas-neue": { category: "condensed-display", role: "alternate" },
    anton: { category: "condensed-display", role: "alternate" },
    consolas: { category: "monospace", role: "alternate" },
    "lucida-console": { category: "monospace", role: "alternate" },
    "roboto-mono": { category: "monospace", role: "alternate" },
    inconsolata: { category: "monospace", role: "alternate" },
    "ibm-plex-mono": { category: "monospace", role: "alternate" },
    cousine: { category: "monospace", role: "alternate" },
    "dancing-script": { category: "casual-script", role: "alternate" },
    "amatic-sc": { category: "casual-script", role: "alternate" },
    pacifico: { category: "casual-script", role: "alternate" },
    satisfy: { category: "casual-script", role: "alternate" },
    lobster: { category: "casual-script", role: "alternate" },
    "comic-neue": { category: "comic-informal", role: "alternate" },
    "shadows-into-light": { category: "handwriting-print", role: "alternate" },
    impact: { category: "marker-display", role: "alternate" },
    "arial-black": { category: "marker-display", role: "alternate" },
    "franklin-gothic-medium": { category: "marker-display", role: "alternate" },
  };

  FONTS.forEach(function (f) {
    if (!f.weight) f.weight = 400;
    if (!f.category && CATEGORY_MAP[f.id]) {
      f.category = CATEGORY_MAP[f.id].category;
      f.role = CATEGORY_MAP[f.id].role || f.role || "alternate";
    }
    if (!f.category) f.category = "uncategorized";
    if (!f.role) f.role = "alternate";
  });

  var byId = {};
  FONTS.forEach(function (f) {
    if (!byId[f.id]) byId[f.id] = f;
  });
  FONTS = Object.keys(byId).map(function (k) {
    return byId[k];
  });
  FONTS.sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });

  function get(id) {
    return byId[id] || byId["arial"] || FONTS[0];
  }

  function voiceBase(f) {
    if (f.cssName) return String(f.cssName).toLowerCase().replace(/\s+/g, " ").trim();
    return String(f.name || f.id || "")
      .replace(/\s+(medium|semibold|bold|extrabold|black|light)$/i, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function voiceKey(f) {
    return (f.category || "uncategorized") + "\0" + voiceBase(f);
  }

  function pickerRank(f) {
    if (f.role === "anchor") return 0;
    if ((f.weight || 400) === 400) return 1;
    return 2 + (f.weight || 400);
  }

  /** One distinct voice per category + family — for the doc font dropdown (#3). */
  function pickerFonts() {
    var best = {};
    FONTS.forEach(function (f) {
      var key = voiceKey(f);
      if (!best[key] || pickerRank(f) < pickerRank(best[key])) {
        best[key] = f;
      }
    });
    return Object.keys(best)
      .map(function (k) {
        return best[k];
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
  }

  /** Map any catalog id to the picker representative in the same voice cluster. */
  function pickerIdFor(id) {
    var f = get(id);
    var key = voiceKey(f);
    var list = pickerFonts();
    for (var i = 0; i < list.length; i++) {
      if (voiceKey(list[i]) === key) return list[i].id;
    }
    return f.id;
  }

  /**
   * Gate new catalog entries — returns { ok, reason }.
   * opts: { name, cssName?, category, role?, weight?, hosted? }
   */
  function propose(opts) {
    opts = opts || {};
    var category = opts.category || "uncategorized";
    var draft = {
      id: opts.id || "draft",
      name: opts.name || "",
      cssName: opts.cssName,
      category: category,
      role: opts.role || "alternate",
      weight: opts.weight || 400,
      hosted: !!opts.hosted,
    };
    if (!draft.name) return { ok: false, reason: "Font needs a display name." };
    var key = voiceKey(draft);
    var clash = null;
    FONTS.some(function (f) {
      if (voiceKey(f) === key) {
        clash = f;
        return true;
      }
      return false;
    });
    if (clash) {
      return {
        ok: false,
        reason:
          "Same voice already in “" +
          category +
          "”: " +
          clash.name +
          ". Pick a different semi-category or a clearly different typeface.",
      };
    }
    if (opts.role === "anchor") {
      var anchorExists = FONTS.some(function (f) {
        return f.category === category && f.role === "anchor";
      });
      if (anchorExists) {
        return {
          ok: false,
          reason: "Category “" + category + "” already has an anchor font.",
        };
      }
    }
    return { ok: true, reason: "" };
  }

  /** Maintainer check — run via scripts/check-font-catalog.mjs */
  function validate() {
    var errors = [];
    var warnings = [];
    var anchors = {};
    var voices = {};
    FONTS.forEach(function (f) {
      var cat = f.category || "uncategorized";
      var vk = voiceKey(f);
      if (!voices[vk]) voices[vk] = [];
      voices[vk].push(f);
      if (f.role === "anchor") {
        if (!anchors[cat]) anchors[cat] = [];
        anchors[cat].push(f.name);
      }
    });
    Object.keys(anchors).forEach(function (cat) {
      if (anchors[cat].length > 1) {
        errors.push("Multiple anchors in “" + cat + "”: " + anchors[cat].join(", "));
      }
    });
    CATEGORIES.forEach(function (c) {
      if (!anchors[c.id] || !anchors[c.id].length) {
        warnings.push("No anchor font for category “" + c.label + "” (" + c.id + ").");
      }
    });
    Object.keys(voices).forEach(function (vk) {
      if (voices[vk].length > 6) {
        warnings.push("Many variants for one voice (" + voices[vk][0].name + "): " + voices[vk].length);
      }
    });
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  function categoryLabel(categoryId) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].id === categoryId) return CATEGORIES[i].label;
    }
    if (categoryId === "uncategorized") return "Other";
    return categoryId || "Other";
  }

  function fontMatchesQuery(font, query) {
    var q = String(query || "")
      .toLowerCase()
      .trim();
    if (!q) return true;
    if (String(font.name || "").toLowerCase().indexOf(q) >= 0) return true;
    if (categoryLabel(font.category).toLowerCase().indexOf(q) >= 0) return true;
    if (String(font.category || "").toLowerCase().indexOf(q) >= 0) return true;
    return false;
  }

  /** Picker list grouped by semi-category (#4), deduped voices (#3). */
  function pickerFontsGrouped(query) {
    var list = pickerFonts().filter(function (f) {
      return fontMatchesQuery(f, query);
    });
    var byCat = {};
    CATEGORIES.forEach(function (c) {
      byCat[c.id] = [];
    });
    list.forEach(function (f) {
      var cat = f.category || "uncategorized";
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(f);
    });
    var groups = [];
    CATEGORIES.forEach(function (c) {
      if (byCat[c.id] && byCat[c.id].length) {
        groups.push({ id: c.id, label: c.label, fonts: byCat[c.id] });
      }
    });
    if (byCat.uncategorized && byCat.uncategorized.length) {
      groups.push({ id: "uncategorized", label: "Other", fonts: byCat.uncategorized });
    }
    return groups;
  }

  /** Picker label — flags proprietary / unhosted system faces (#5). */
  function pickerDisplayName(font) {
    if (!font) return "";
    if (font.systemFallback) {
      return font.name + " (system fallback)";
    }
    return font.name;
  }

  function byCategory() {
    var out = {};
    CATEGORIES.forEach(function (c) {
      out[c.id] = [];
    });
    FONTS.forEach(function (f) {
      if (!out[f.category]) out[f.category] = [];
      out[f.category].push(f);
    });
    return out;
  }

  function getAnchor(categoryId) {
    var list = byCategory()[categoryId] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].role === "anchor") return list[i];
    }
    return list[0] || null;
  }

  function paintFont(font) {
    var weight = font.weight || 400;
    var sheet = global.document && global.document.getElementById("docSheet");
    var editor = global.document && global.document.querySelector("#docEditor .ql-editor");
    var container = global.document && global.document.getElementById("docEditor");
    if (sheet) {
      sheet.style.setProperty("--lk-doc-font", font.family);
      sheet.style.setProperty("--lk-doc-font-weight", String(weight));
      sheet.setAttribute("data-lk-font", font.id);
    }
    [editor, container].forEach(function (node) {
      if (!node) return;
      node.style.setProperty("font-family", font.family, "important");
      node.style.setProperty("font-weight", String(weight), "important");
    });
  }

  function applyToElement(el, id) {
    var font = get(id || "arial");
    var loader = global.LoreKeeperFontLoader;
    var afterLoad = function () {
      paintFont(font);
      if (font.hosted && global.document && global.document.fonts && global.document.fonts.load) {
        var spec = font.weight + " 16px " + font.family;
        global.document.fonts.load(spec).then(function () {
          paintFont(font);
        }).catch(function () {});
      }
    };
    if (font.hosted && loader && loader.ensureHostedFont) {
      loader.ensureHostedFont(font).then(afterLoad).catch(afterLoad);
    } else {
      afterLoad();
    }
    return font;
  }

  global.LoreKeeperFontCatalog = {
    CATEGORIES: CATEGORIES,
    FONTS: FONTS,
    get: get,
    byCategory: byCategory,
    getAnchor: getAnchor,
    pickerFonts: pickerFonts,
    pickerIdFor: pickerIdFor,
    pickerFontsGrouped: pickerFontsGrouped,
    pickerDisplayName: pickerDisplayName,
    categoryLabel: categoryLabel,
    fontMatchesQuery: fontMatchesQuery,
    voiceKey: voiceKey,
    propose: propose,
    validate: validate,
    applyToElement: applyToElement,
    paintFont: paintFont,
    defaultId: "arial",
  };
})(typeof window !== "undefined" ? window : this);
