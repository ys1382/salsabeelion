/**
 * Halalit — match titles against owner-approved static theme lists (not crowd shelves).
 */
(function (global) {
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function dataEntries() {
    var d = global.HalalitThemeIndexData;
    return Array.isArray(d) ? d : [];
  }

  /**
   * @param {string} title
   * @param {string} [author]
   * @returns {{ themes: string[], detail: string, listName: string, shelfTier?: string }|null}
   */
  function match(title, author) {
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    var list = dataEntries();
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e.titleRe || !e.titleRe.test(tl)) continue;
      if (e.authorRe && al && !e.authorRe.test(al)) continue;
      var themes = e.themes || [];
      var ST = global.HalalitShelfThemes;
      var shelfTier = e.tier;
      if (!shelfTier && ST && typeof ST.worstShelfTier === "function") {
        shelfTier = ST.worstShelfTier(themes);
      }
      if (!shelfTier) shelfTier = "flag_review";
      return {
        themes: themes,
        detail: e.detail || "On Halalit’s approved theme list.",
        listName: e.listName || "Halalit approved theme list",
        shelfTier: shelfTier,
      };
    }
    return null;
  }

  global.HalalitThemeIndex = {
    match: match,
  };
})(typeof window !== "undefined" ? window : this);
