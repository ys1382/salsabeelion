/**
 * Halalit — short series expectation notes (open arc, hiatus, long gaps, US print gaps).
 * Wording is dated and curated; not a verdict on shelf rules.
 * Dismissals are stored on the signed-in reader account.
 */
(function (global) {
  /**
   * @type {Array<{
   *   id: string,
   *   label: string,
   *   seriesRe?: RegExp,
   *   titleRe: RegExp,
   *   authorRe?: RegExp,
   *   kind: string,
   *   before: string,
   *   invested: string,
   *   reviewed?: string
   * }>}
   */
  var DISMISS_KEY = "halalit_dismissed_series_expectations";

  function store() {
    return global.HalalitAccountStorage || null;
  }

  function dismissedIdMap() {
    try {
      if (!store()) return {};
      var raw = store().getItem(DISMISS_KEY);
      if (!raw) return {};
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return {};
      var out = {};
      for (var i = 0; i < arr.length; i++) {
        var id = String(arr[i] || "").trim();
        if (id) out[id] = true;
      }
      return out;
    } catch (e) {
      return {};
    }
  }

  function isDismissed(id) {
    return !!dismissedIdMap()[String(id || "").trim()];
  }

  function dismissId(id) {
    var key = String(id || "").trim();
    if (!key || !store()) return;
    var map = dismissedIdMap();
    if (map[key]) return;
    map[key] = true;
    try {
      store().setItem(DISMISS_KEY, JSON.stringify(Object.keys(map)));
    } catch (e) {
      /* ignore */
    }
  }

  var NOTES = [
    {
      id: "winterborne",
      label: "Winterborne Home",
      seriesRe: /winterborne/i,
      titleRe: /winterborne|last gallery of wonder|secrets of winterborne/i,
      authorRe: /carter/i,
      kind: "open_arc",
      before: "Last book out may not finish the arc.",
      invested: "You may be caught up; the last book can still feel open.",
      reviewed: "2026-05",
    },
    {
      id: "simon_thorn",
      label: "Simon Thorn",
      seriesRe: /simon thorn/i,
      titleRe: /simon thorn/i,
      authorRe: /aimee|carter/i,
      kind: "regional_gap",
      before: "US printing stopped early; more volumes exist elsewhere.",
      invested: "US run stopped early—not a volume you skipped here.",
      reviewed: "2026-05",
    },
  ];

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s+series\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function entryMatches(entry, title, author, seriesName) {
    var tl = norm(title);
    var al = norm(author);
    var sl = norm(seriesName);
    if (!tl && !sl) return false;
    if (entry.authorRe && al && !entry.authorRe.test(al)) return false;
    if (sl && entry.seriesRe && entry.seriesRe.test(sl)) return entry;
    if (tl && entry.titleRe.test(tl)) return entry;
    if (sl && entry.titleRe.test(sl)) return entry;
    return null;
  }

  /**
   * @param {string} title
   * @param {string} [author]
   * @param {string} [seriesName]
   * @returns {typeof NOTES[0]|null}
   */
  function match(title, author, seriesName) {
    for (var i = 0; i < NOTES.length; i++) {
      var hit = entryMatches(NOTES[i], title, author, seriesName);
      if (hit) return hit;
    }
    return null;
  }

  /**
   * @param {"before"|"invested"} audience
   * @param {typeof NOTES[0]} entry
   * @returns {string}
   */
  function line(audience, entry) {
    if (!entry) return "";
    return audience === "invested" ? entry.invested : entry.before;
  }

  /**
   * @param {string} seriesSearchTitle
   * @param {string} [author]
   * @returns {string|null}
   */
  function lineForImport(seriesSearchTitle, author) {
    var ent = match("", author, seriesSearchTitle);
    if (!ent) ent = match(seriesSearchTitle, author, seriesSearchTitle);
    return ent ? line("before", ent) : null;
  }

  /**
   * @param {Array<object>} readBooks
   * @param {object} [Lib]
   * @returns {Array<{ id: string, label: string, line: string }>}
   */
  function collectInvested(readBooks, Lib) {
    var seen = {};
    var out = [];
    var list = Array.isArray(readBooks) ? readBooks : [];
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (!b) continue;
      var title = b.titlePlain || b.title || "";
      var author = b.author || "";
      if ((!title || !author) && Lib && Lib.parseTitlePlain && b.titlePlain) {
        var p = Lib.parseTitlePlain(b.titlePlain);
        title = title || p.title;
        author = author || p.author;
      }
      var seriesName = b.seriesName || b.shelfGroupLabel || "";
      var ent = match(title, author, seriesName);
      if (!ent || seen[ent.id] || isDismissed(ent.id)) continue;
      seen[ent.id] = true;
      out.push({ id: ent.id, label: ent.label, line: line("invested", ent) });
    }
    return out;
  }

  global.HalalitSeriesExpectation = {
    match: match,
    line: line,
    lineForImport: lineForImport,
    collectInvested: collectInvested,
    isDismissed: isDismissed,
    dismissId: dismissId,
    notes: NOTES,
  };
})(typeof window !== "undefined" ? window : this);
