/**
 * LoreKeeper — fonts matching the common Google Docs menu (system + open Google Fonts).
 * Hosted fonts are served from ./fonts/ on Odd Trove (see scripts/fetch-doc-fonts.sh).
 */
(function (global) {
  function sys(name, family) {
    return { id: name.toLowerCase().replace(/\s+/g, "-"), name: name, family: family, hosted: false };
  }
  function gfStack(cssName) {
    var n = String(cssName || "").toLowerCase();
    if (/mono|code|console|courier|inconsolata|cousine/i.test(n)) return "monospace";
    if (/serif|garamond|baskerville|merriweather|lora|playfair|spectral|bitter|cardo|vollkorn|tinos|crimson|cardo|pt serif|source serif|libre baskerville|dm serif|eb garamond|alegreya(?! sans)/i.test(n)) {
      return "serif";
    }
    if (/script|caveat|dancing|pacifico|lobster|amatic|indie flower|permanent marker|great vibes|satisfy|shadows|comic neue|grenze/i.test(n)) {
      return "cursive";
    }
    return "sans-serif";
  }

  function gf(name, cssName, stack) {
    var id = cssName.toLowerCase().replace(/\s+/g, "-");
    return {
      id: id,
      name: name,
      family: '"' + cssName + '", ' + (stack || gfStack(cssName)),
      hosted: true,
      cssName: cssName,
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
    sys("Calibri", "Calibri, Candara, Segoe, sans-serif"),
    sys("Cambria", "Cambria, Georgia, serif"),
    sys("Century Gothic", '"Century Gothic", CenturyGothic, AppleGothic, sans-serif'),
    sys("Consolas", "Consolas, monaco, monospace"),
    sys("Lucida Console", '"Lucida Console", Monaco, monospace'),
    sys("Lucida Sans Unicode", '"Lucida Sans Unicode", "Lucida Grande", sans-serif"),
    sys("Segoe UI", '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif"),
    sys("Book Antiqua", '"Book Antiqua", Palatino, serif"),
    sys("Franklin Gothic Medium", '"Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif"),
    gf("Amatic SC", "Amatic SC"),
    gf("Caveat", "Caveat"),
    gf("Comfortaa", "Comfortaa"),
    gf("Comic Neue", "Comic Neue"),
    gf("Courier Prime", "Courier Prime"),
    gf("Crimson Text", "Crimson Text"),
    gf("Dancing Script", "Dancing Script"),
    gf("EB Garamond", "EB Garamond"),
    gf("Grenze Gotisch", "Grenze Gotisch"),
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
    gf("Spectral", "Spectral"),
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
  ];

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

  function paintFont(font) {
    var sheet = global.document && global.document.getElementById("docSheet");
    var editor = global.document && global.document.querySelector("#docEditor .ql-editor");
    var container = global.document && global.document.getElementById("docEditor");
    if (sheet) {
      sheet.style.setProperty("--lk-doc-font", font.family);
      sheet.setAttribute("data-lk-font", font.id);
    }
    [editor, container].forEach(function (node) {
      if (!node) return;
      node.style.setProperty("font-family", font.family, "important");
    });
  }

  function applyToElement(el, id) {
    var font = get(id || "arial");
    paintFont(font);
    if (font.hosted && global.document && global.document.fonts && global.document.fonts.load) {
      global.document.fonts.load("16px " + font.family).then(function () {
        paintFont(font);
      }).catch(function () {});
    }
    return font;
  }

  global.LoreKeeperFontCatalog = {
    FONTS: FONTS,
    get: get,
    applyToElement: applyToElement,
    paintFont: paintFont,
    defaultId: "arial",
  };
})(typeof window !== "undefined" ? window : this);
