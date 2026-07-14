/**
 * LoreKeeper — lazy @font-face injection for self-hosted doc fonts.
 * Replaces loading all faces via lk-fonts-hosted.css on every doc open.
 */
(function (global) {
  var loaded = Object.create(null);
  var styleEl = null;

  function cssSlug(cssName) {
    return String(cssName || "")
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function fontBasePath() {
    var loc = global.location;
    if (!loc || !loc.pathname) return "./fonts/woff2/";
    var path = String(loc.pathname || "");
    if (path.indexOf("/lorekeeper") !== -1) {
      var basePath = path.replace(/\/?[^/]*\.html?$/i, "").replace(/\/$/, "");
      if (basePath.slice(-11) !== "/lorekeeper") {
        var idx = basePath.indexOf("/lorekeeper");
        if (idx !== -1) basePath = basePath.slice(0, idx + "/lorekeeper".length);
      }
      return basePath + "/fonts/woff2/";
    }
    return "./fonts/woff2/";
  }

  function woff2File(font) {
    var slug = cssSlug(font.cssName);
    var weight = font.weight || 400;
    var style = font.fontStyle || "normal";
    if (style === "italic") {
      return slug + "-" + weight + "-italic.woff2";
    }
    return slug + "-" + weight + ".woff2";
  }

  function faceKey(font) {
    return [font.cssName, font.weight || 400, font.fontStyle || "normal"].join("|");
  }

  function ensureStyleEl() {
    if (styleEl && styleEl.parentNode) return styleEl;
    styleEl = global.document.createElement("style");
    styleEl.id = "lk-font-faces-lazy";
    global.document.head.appendChild(styleEl);
    return styleEl;
  }

  function ensureHostedFont(font) {
    if (!font || !font.hosted || !font.cssName) return Promise.resolve();
    var key = faceKey(font);
    if (loaded[key]) return loaded[key];

    var cssName = String(font.cssName).replace(/"/g, '\\"');
    var weight = font.weight || 400;
    var style = font.fontStyle || "normal";
    var url = fontBasePath() + woff2File(font);

    var rule =
      '@font-face{font-family:"' +
      cssName +
      '";font-style:' +
      style +
      ";font-weight:" +
      weight +
      ';font-display:swap;src:url("' +
      url +
      '") format("woff2");}';

    loaded[key] = new Promise(function (resolve) {
      var el = ensureStyleEl();
      el.appendChild(global.document.createTextNode(rule));
      if (global.document.fonts && global.document.fonts.load) {
        global.document.fonts
          .load(weight + ' 16px "' + cssName + '"')
          .then(function () {
            resolve();
          })
          .catch(function () {
            resolve();
          });
      } else {
        resolve();
      }
    });
    return loaded[key];
  }

  global.LoreKeeperFontLoader = {
    ensureHostedFont: ensureHostedFont,
  };
})(typeof window !== "undefined" ? window : this);
