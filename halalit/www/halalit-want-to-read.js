/**
 * Halalit — titles the reader hopes to read (signed-in account).
 * Quest suggestions land here until the reader saves a note about Halalit’s pick;
 * then the title moves to Personal Library.
 */
(function (global) {
  var KEY = "halalitWantToReadBooks";
  var CAP = 2000;

  function helpers() {
    return global.HalalitPersonalLibrary || null;
  }

  function entryKey(e) {
    var Lib = helpers();
    if (!Lib) return "";
    return Lib.normalizeKey(e.title, e.author);
  }

  function titlePlainForEntry(entry) {
    if (!entry) return "";
    if (entry.titlePlain) return entry.titlePlain;
    var t = String(entry.title || "").trim();
    var a = String(entry.author || "").trim();
    return a ? t + " by " + a : t;
  }

  function entryPassesFamilyShelf(entry) {
    var Policy = global.HalalitFamilyShelfPolicy;
    if (!Policy || typeof Policy.isTitlePlainEligible !== "function") return true;
    var Lib = helpers();
    var parse = Lib && typeof Lib.parseTitlePlain === "function" ? Lib.parseTitlePlain.bind(Lib) : null;
    return Policy.isTitlePlainEligible(titlePlainForEntry(entry), parse);
  }

  /** Drop quest suggestions that no longer meet family-shelf rules (e.g. after policy alignment). */
  function pruneDisqualifiedQuestSuggestions(list) {
    if (!list || !list.length) return list || [];
    var next = [];
    var changed = false;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.source === "quest_suggestion" && !entryPassesFamilyShelf(e)) {
        changed = true;
        continue;
      }
      next.push(e);
    }
    if (changed) save(next);
    return next;
  }

  function store() {
    return global.HalalitAccountStorage || null;
  }

  function load() {
    try {
      var raw = store() ? store().getItem(KEY) : null;
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return pruneDisqualifiedQuestSuggestions(arr);
    } catch (e) {
      return [];
    }
  }

  function save(list) {
    try {
      if (store()) store().setItem(KEY, JSON.stringify(list));
    } catch (e) {}
  }

  /**
   * @param {{ title?: string, author?: string, titlePlain?: string, bookId?: string|null, source?: string, addedAt?: string }} entry
   */
  function add(entry) {
    var Lib = helpers();
    if (!Lib) return false;
    var title = String(entry.title || "").trim();
    var author = String(entry.author || "").trim();
    if (!title && entry.titlePlain) {
      var p = Lib.parseTitlePlain(entry.titlePlain);
      title = p.title;
      author = p.author;
    }
    if (!title) return false;
    var recProbe = {
      title: title,
      author: author,
      titlePlain: author ? title + " by " + author : title,
    };
    if (entry.source === "quest_suggestion" && !entryPassesFamilyShelf(recProbe)) return false;
    var list = load();
    var k = Lib.normalizeKey(title, author);
    for (var i = list.length - 1; i >= 0; i--) {
      if (entryKey(list[i]) === k) list.splice(i, 1);
    }
    var rec = {
      title: title,
      author: author,
      titlePlain: author ? title + " by " + author : title,
      bookId: entry.bookId != null ? entry.bookId : null,
      source: entry.source || "manual",
      addedAt: entry.addedAt || new Date().toISOString(),
    };
    if (entry.seriesName != null && String(entry.seriesName).trim()) {
      rec.seriesName = String(entry.seriesName).trim();
    }
    if (entry.seriesIndex != null && entry.seriesIndex === entry.seriesIndex) {
      var si = parseInt(String(entry.seriesIndex), 10);
      if (!isNaN(si) && si > 0 && si < 10000) rec.seriesIndex = si;
    }
    list.push(rec);
    if (list.length > CAP) list = list.slice(list.length - CAP);
    save(list);
    return true;
  }

  function removeAt(index) {
    var list = load();
    var i = typeof index === "number" ? index : parseInt(index, 10);
    if (isNaN(i) || i < 0 || i >= list.length) return false;
    list.splice(i, 1);
    save(list);
    return true;
  }

  function patchBookAt(index, patch) {
    var list = load();
    var i = typeof index === "number" ? index : parseInt(index, 10);
    if (isNaN(i) || i < 0 || i >= list.length || !patch || typeof patch !== "object") return false;
    var cur = list[i];
    for (var k in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) cur[k] = patch[k];
    }
    cur.titlePlain = cur.author ? cur.title + " by " + cur.author : cur.title;
    save(list);
    return true;
  }

  /**
   * Drop one entry matching quest bookId or title+author from titlePlain.
   * @param {{ bookId?: string|null, titlePlain?: string }} spec
   * @returns {boolean}
   */
  function removeMatching(spec) {
    var Lib = helpers();
    if (!Lib || !spec) return false;
    var bookId = spec.bookId != null ? String(spec.bookId) : "";
    var vp = Lib.parseTitlePlain(spec.titlePlain || "");
    var vKey = Lib.normalizeKey(vp.title, vp.author);
    var list = load();
    var changed = false;
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];
      if (bookId && e.bookId != null && String(e.bookId) === bookId) {
        list.splice(i, 1);
        changed = true;
        continue;
      }
      var ep =
        e.title != null || e.author != null
          ? { title: e.title || "", author: e.author || "" }
          : Lib.parseTitlePlain(e.titlePlain);
      if (Lib.normalizeKey(ep.title, ep.author) === vKey) {
        list.splice(i, 1);
        changed = true;
      }
    }
    if (changed) save(list);
    return changed;
  }

  function importLines(text) {
    var Lib = helpers();
    if (!Lib) return { processed: 0, shortTitleNoAuthor: [] };
    var lines = String(text || "").split(/\r?\n/);
    var n = 0;
    var shortNoAuthorSeen = {};
    var shortNoAuthorList = [];
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i].trim();
      if (!raw || raw.charAt(0) === "#") continue;
      var stripped = Lib.extractFinishedFromLine(raw);
      var p = Lib.parseTitlePlain(stripped.rest);
      if (p.title) {
        add({
          title: p.title,
          author: p.author,
          source: "manual_import",
        });
        n++;
        if (!String(p.author || "").trim() && !Lib.shelfTitleDistinctiveEnough(p.title)) {
          var key = Lib.normalizeKey(p.title, "");
          if (!shortNoAuthorSeen[key]) {
            shortNoAuthorSeen[key] = true;
            shortNoAuthorList.push(p.title);
          }
        }
      }
    }
    return { processed: n, shortTitleNoAuthor: shortNoAuthorList };
  }

  function parseTitlePlain(s) {
    var Lib = helpers();
    return Lib ? Lib.parseTitlePlain(s) : { title: String(s || "").trim(), author: "" };
  }

  global.HalalitWantToRead = {
    KEY: KEY,
    load: load,
    save: save,
    add: add,
    removeAt: removeAt,
    patchBookAt: patchBookAt,
    removeMatching: removeMatching,
    importLines: importLines,
    parseTitlePlain: parseTitlePlain,
  };
})(typeof window !== "undefined" ? window : this);
