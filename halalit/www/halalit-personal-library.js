/**
 * Halalit — titles the reader has finished (this device or signed-in account).
 * Shared by index.html (shelf UI + import) and play.html (quest review → shelf).
 */
(function (global) {
  var KEY = "halalitAlreadyReadBooks";
  var DEVICE_BACKUP_KEY = "halalitAlreadyReadBooks_device_backup";
  var CAP = 2000;

  function normalizeKey(title, author) {
    return (
      String(title || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim() +
      "|" +
      String(author || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  function parseTitlePlain(titlePlain) {
    var s = String(titlePlain || "").trim();
    if (!s) return { title: "", author: "" };
    var m = s.match(/^(.+?)\s+by\s+(.+)$/i);
    if (m) return { title: m[1].trim(), author: m[2].trim() };
    return { title: s, author: "" };
  }

  /** One line for lists, copy/paste, and chat export. */
  function plainLine(book) {
    if (!book) return "";
    var t = String(book.titlePlain || "").trim();
    if (t) return t;
    var title = String(book.title || "").trim();
    var author = String(book.author || "").trim();
    if (title && author) return title + " by " + author;
    return title;
  }

  /**
   * One-of-a-kind style titles (long phrase, many words, subtitle, digits) rarely
   * collide with another book on the shelf, so authors can skip "by Lastname".
   * Short or generic-looking titles benefit from Author so duplicates like two
   * different novels titled "Magic" stay distinct — not because we lookup ISBNs.
   */
  function shelfTitleDistinctiveEnough(title) {
    var s = String(title || "")
      .trim()
      .replace(/\s+/g, " ");
    if (!s) return false;
    var words = s.split(" ").filter(Boolean);
    var nWords = words.length;
    var n = s.length;
    if (nWords >= 5) return true;
    if (n >= 26) return true;
    if (nWords >= 4 && n >= 18) return true;
    if (nWords >= 3 && n >= 22) return true;
    if (/[0-9]/.test(s)) return true;
    if (/[:.;]/.test(s) && n >= 14) return true;
    return false;
  }

  /**
   * Coerce arbitrary input (Date, ISO string, "2018", "2018-6-5", "6/5/2018") into either
   * a YYYY or YYYY-MM-DD string. Month/day/year slash or dot forms use U.S. order (M/D/Y).
   * Returns "" for unrecognized input.
   */
  function normalizeFinishedAt(input) {
    if (input == null || input === "") return "";
    if (input instanceof Date && !isNaN(input.getTime())) {
      var y = input.getFullYear();
      var mo = String(input.getMonth() + 1).padStart(2, "0");
      var d = String(input.getDate()).padStart(2, "0");
      return y + "-" + mo + "-" + d;
    }
    var s0 = String(input).trim();
    if (!s0) return "";

    function pad2(v) {
      var n = typeof v === "number" ? v : parseInt(String(v), 10);
      if (isNaN(n)) return null;
      return String(n).padStart(2, "0");
    }

    /** @returns {string} */
    function ymdOrEmpty(y, m, d) {
      var yi = parseInt(String(y), 10);
      var mi = parseInt(String(m), 10);
      var di = parseInt(String(d), 10);
      if (yi < 1500 || yi > 9999 || mi < 1 || mi > 12 || di < 1 || di > 31) return "";
      var cal = new Date(yi, mi - 1, di);
      if (cal.getFullYear() !== yi || cal.getMonth() !== mi - 1 || cal.getDate() !== di) return "";
      return yi + "-" + pad2(mi) + "-" + pad2(di);
    }

    var prefixes = [
      /^(?:(?:date\s*)?(?:finished|read)|(?:(?:finished|read)\s*date))\s*[:\-]?\s*/i,
    ];
    var toTry = [s0];
    for (var pi = 0; pi < prefixes.length; pi++) {
      var cut = s0.replace(prefixes[pi], "").trim();
      if (cut && cut !== s0) toTry.push(cut);
    }

    for (var ti = 0; ti < toTry.length; ti++) {
      var s = toTry[ti];
      if (!s) continue;

      var isoStart = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[ Tt])/);
      if (isoStart) {
        var isoOut = ymdOrEmpty(isoStart[1], isoStart[2], isoStart[3]);
        if (isoOut) return isoOut;
      }

      var ymMatch = s.match(/^(\d{4})-(\d{1,2})$/);
      if (ymMatch) {
        var ymY = parseInt(ymMatch[1], 10);
        var ymM = parseInt(ymMatch[2], 10);
        if (ymY >= 1500 && ymY <= 9999 && ymM >= 1 && ymM <= 12) {
          return ymMatch[1] + "-" + pad2(ymM) + "-01";
        }
      }

      var yMatch = s.match(/^(\d{4})$/);
      if (yMatch) {
        var yy = parseInt(yMatch[1], 10);
        if (yy >= 1500 && yy <= 9999) return yMatch[1];
      }

      var mdySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (mdySlash) {
        var mdyOut = ymdOrEmpty(mdySlash[3], mdySlash[1], mdySlash[2]);
        if (mdyOut) return mdyOut;
      }

      var mdyDot = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (mdyDot) {
        var dotOut = ymdOrEmpty(mdyDot[3], mdyDot[1], mdyDot[2]);
        if (dotOut) return dotOut;
      }

      var mdyHyphen = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (mdyHyphen) {
        var mhOut = ymdOrEmpty(mdyHyphen[3], mdyHyphen[1], mdyHyphen[2]);
        if (mhOut) return mhOut;
      }

      var ymdSlash = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (ymdSlash) {
        var ysOut = ymdOrEmpty(ymdSlash[1], ymdSlash[2], ymdSlash[3]);
        if (ysOut) return ysOut;
      }
    }

    var isoAny = s0.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoAny) {
      var anyIso = ymdOrEmpty(isoAny[1], isoAny[2], isoAny[3]);
      if (anyIso) return anyIso;
    }
    var mdyAny = s0.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mdyAny) {
      var anyMdy = ymdOrEmpty(mdyAny[3], mdyAny[1], mdyAny[2]);
      if (anyMdy) return anyMdy;
    }
    var ymdSlashAny = s0.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (ymdSlashAny) {
      var anyYs = ymdOrEmpty(ymdSlashAny[1], ymdSlashAny[2], ymdSlashAny[3]);
      if (anyYs) return anyYs;
    }

    return "";
  }

  function finishedYear(finishedAt) {
    var s = String(finishedAt || "");
    var m = s.match(/^(\d{4})/);
    return m ? parseInt(m[1], 10) : null;
  }

  /**
   * Extract a trailing date marker like " (2018)" or " (2018-06-15)" from a
   * raw import line. Returns { rest, finishedAt } where rest is the line
   * without the date suffix.
   *
   * The marker may also appear as " [2018]" or be preceded by "finished" or
   * "read" (including "date finished"/"date read" phrasing).
   */
  function extractFinishedFromLine(line) {
    var s = String(line || "");
    var patterns = [
      /\s*[\(\[]\s*(?:(?:date\s*)?(?:finished|read)|(?:(?:finished|read)\s*date))\s*[:\-]?\s*(\d{4}(?:-\d{2}(?:-\d{2})?)?)\s*[\)\]]\s*$/i,
      /\s*[\(\[]\s*(\d{4}(?:-\d{2}(?:-\d{2})?)?)\s*[\)\]]\s*$/,
      /\s*[\-—|,]\s*(?:(?:date\s*)?(?:finished|read)|(?:(?:finished|read)\s*date))\s*[:\-]?\s*(\d{4}(?:-\d{2}(?:-\d{2})?)?)\s*$/i,
      /\s*[\-—|,]\s*(\d{4}(?:-\d{2}(?:-\d{2})?)?)\s*$/,
      /\s+(?:(?:date\s*)?(?:finished|read)|(?:(?:finished|read)\s*date))\s*[:\-]?\s*(\d{4}(?:-\d{2}(?:-\d{2})?)?)\s*$/i,
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = s.match(patterns[i]);
      if (m) {
        var f = normalizeFinishedAt(m[1]);
        if (f) return { rest: s.slice(0, m.index).trim(), finishedAt: f };
      }
    }
    return { rest: s.trim(), finishedAt: "" };
  }

  function store() {
    return global.HalalitAccountStorage || null;
  }

  function readDeviceBackup() {
    try {
      if (global.localStorage) return global.localStorage.getItem(DEVICE_BACKUP_KEY);
    } catch (e) {}
    return null;
  }

  function writeDeviceBackup(json) {
    try {
      if (global.localStorage) global.localStorage.setItem(DEVICE_BACKUP_KEY, json);
    } catch (e) {}
  }

  function load() {
    try {
      var raw = store() ? store().getItem(KEY) : null;
      if (!raw) {
        raw = readDeviceBackup();
        if (raw && store()) store().setItem(KEY, raw);
      }
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      var changed = false;
      for (var i = 0; i < arr.length; i++) {
        var e = arr[i];
        if (e && e.finishedAt != null && String(e.finishedAt).trim() !== "") {
          var fn = normalizeFinishedAt(e.finishedAt);
          if (fn && fn !== String(e.finishedAt).trim()) {
            e.finishedAt = fn;
            changed = true;
          } else if (!fn) {
            delete e.finishedAt;
            changed = true;
          }
        }
      }
      if (changed) save(arr);
      return arr;
    } catch (e) {
      return [];
    }
  }

  function save(list) {
    try {
      var json = JSON.stringify(list);
      if (store()) store().setItem(KEY, json);
      writeDeviceBackup(json);
    } catch (e) {}
  }

  function entryKey(e) {
    return normalizeKey(e.title, e.author);
  }

  function seriesVolumeIndex(e) {
    if (!e || e.seriesIndex == null) return null;
    var si = parseInt(String(e.seriesIndex), 10);
    if (isNaN(si) || si < 1 || si >= 10000) return null;
    return si;
  }

  /** Same title + author is not enough when two different volumes share a catalog banner line. */
  function isSameShelfSlot(existing, incoming) {
    if (!existing || !incoming) return false;
    if (entryKey(existing) !== entryKey(incoming)) return false;
    if (!authorsCompatible(existing.author, incoming.author)) return false;
    var a = seriesVolumeIndex(existing);
    var b = seriesVolumeIndex(incoming);
    if (a != null && b != null) return a === b;
    if (a == null && b == null) return true;
    return false;
  }

  function authorsCompatible(a, b) {
    var aa = String(a || "")
      .trim()
      .toLowerCase();
    var bb = String(b || "")
      .trim()
      .toLowerCase();
    if (!aa || !bb) return true;
    return aa === bb;
  }

  function mergeEntryFields(into, from) {
    if (!into || !from) return;
    var fields = [
      "author",
      "titlePlain",
      "bookId",
      "seriesName",
      "seriesIndex",
      "shelfGroupKey",
      "shelfGroupLabel",
      "finishedAt",
      "olSubjects",
      "olFirstPublishYear",
      "olWorkKey",
      "olCoverUrl",
    ];
    for (var fi = 0; fi < fields.length; fi++) {
      var f = fields[fi];
      if (into[f] == null || into[f] === "" || (Array.isArray(into[f]) && !into[f].length)) {
        if (from[f] != null && from[f] !== "") into[f] = from[f];
      }
    }
    if (!into.author && from.author) into.author = from.author;
    if (!into.titlePlain && from.titlePlain) into.titlePlain = from.titlePlain;
    else if (into.title && into.author) into.titlePlain = into.title + " by " + into.author;
    else if (into.title) into.titlePlain = into.title;
  }

  /**
   * Merge duplicate rows that are the same title (and compatible author) — e.g. one import with
   * "by Author" and one without.
   * @returns {boolean} true if the stored list was shortened
   */
  function compactDuplicateEntries() {
    var list;
    try {
      var raw = store() ? store().getItem(KEY) : null;
      if (!raw) return false;
      list = JSON.parse(raw);
      if (!Array.isArray(list)) return false;
    } catch (e) {
      return false;
    }
    if (list.length < 2) return false;
    var out = [];
    var keyToOut = {};
    var changed = false;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || !String(e.title || "").trim()) continue;
      var k = entryKey(e);
      var found = -1;
      if (keyToOut[k] !== undefined) found = keyToOut[k];
      else {
        for (var j = 0; j < out.length; j++) {
          var o = out[j];
          if (normalizeKey(o.title, "") !== normalizeKey(e.title, "")) continue;
          if (!authorsCompatible(o.author, e.author)) continue;
          found = j;
          break;
        }
      }
      if (found >= 0 && isSameShelfSlot(out[found], e)) {
        mergeEntryFields(out[found], e);
        changed = true;
        continue;
      }
      if (found >= 0) {
        found = -1;
      }
      keyToOut[k] = out.length;
      out.push(e);
    }
    if (changed && out.length < list.length) {
      save(out);
      return true;
    }
    return false;
  }

  /**
   * @param {{ title?: string, author?: string, titlePlain?: string, bookId?: string|null, source?: string, addedAt?: string }} entry
   * @returns {boolean} true if a title was stored
   */
  function add(entry) {
    var title = String(entry.title || "").trim();
    var author = String(entry.author || "").trim();
    if (!title && entry.titlePlain) {
      var p = parseTitlePlain(entry.titlePlain);
      title = p.title;
      author = p.author;
    }
    if (!title) return false;
    var list = load();
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
    var finished = normalizeFinishedAt(entry.finishedAt);
    if (finished) rec.finishedAt = finished;
    for (var ri = list.length - 1; ri >= 0; ri--) {
      if (isSameShelfSlot(list[ri], rec)) list.splice(ri, 1);
    }
    list.push(rec);
    if (list.length > CAP) list = list.slice(list.length - CAP);
    save(list);
    return true;
  }

  /**
   * Remove one shelf entry by its index in the stored array order (matches the Personal Library wall).
   * @param {number} index
   * @returns {boolean} true if an entry was removed
   */
  function removeAt(index) {
    var list = load();
    var i = typeof index === "number" ? index : parseInt(index, 10);
    if (isNaN(i) || i < 0 || i >= list.length) return false;
    list.splice(i, 1);
    save(list);
    return true;
  }

  /**
   * Drop every entry matching quest bookId or title+author from titlePlain.
   * @param {{ bookId?: string|null, titlePlain?: string }} spec
   * @returns {boolean}
   */
  function removeMatching(spec) {
    if (!spec) return false;
    var bookId = spec.bookId != null ? String(spec.bookId) : "";
    var vp = parseTitlePlain(spec.titlePlain || "");
    var vKey = normalizeKey(vp.title, vp.author);
    var list = load();
    var changed = false;
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];
      if (bookId && e.bookId != null && String(e.bookId) === bookId) {
        list.splice(i, 1);
        changed = true;
        continue;
      }
      if (vKey && entryKey(e) === vKey) {
        list.splice(i, 1);
        changed = true;
      }
    }
    if (changed) save(list);
    return changed;
  }

  /**
   * Shallow-merge fields into one shelf entry and refresh `titlePlain` from title + author.
   * @param {number} index
   * @param {Record<string, unknown>} patch
   * @returns {boolean}
   */
  function patchBookAt(index, patch) {
    var list = load();
    var i = typeof index === "number" ? index : parseInt(index, 10);
    if (isNaN(i) || i < 0 || i >= list.length || !patch || typeof patch !== "object") return false;
    var cur = list[i];
    for (var k in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      if (k === "finishedAt") {
        var fn = normalizeFinishedAt(patch.finishedAt);
        if (fn) cur.finishedAt = fn;
        else delete cur.finishedAt;
      } else {
        cur[k] = patch[k];
      }
    }
    cur.titlePlain = cur.author ? cur.title + " by " + cur.author : cur.title;
    save(list);
    return true;
  }

  function addFromSuggestedReview(spec) {
    return add({
      titlePlain: spec.titlePlain,
      bookId: spec.bookId,
      source: "quest_review",
      finishedAt: spec.finishedAt,
    });
  }

  /**
   * Non-empty lines; # starts a comment.
   * Accepts "Title", "Title by Author", or any of those followed by an
   * optional finished marker like " (2018)", " [2018-06-15]",
   * " — 2018", " | finished 2018".
   */
  function importLines(text) {
    var lines = String(text || "").split(/\r?\n/);
    var n = 0;
    var shortNoAuthorSeen = {};
    var shortNoAuthorList = [];
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i].trim();
      if (!raw || raw.charAt(0) === "#") continue;
      var stripped = extractFinishedFromLine(raw);
      var p = parseTitlePlain(stripped.rest);
      if (p.title) {
        add({
          title: p.title,
          author: p.author,
          source: "manual_import",
          finishedAt: stripped.finishedAt,
        });
        n++;
        if (!String(p.author || "").trim() && !shelfTitleDistinctiveEnough(p.title)) {
          var key = normalizeKey(p.title, "");
          if (!shortNoAuthorSeen[key]) {
            shortNoAuthorSeen[key] = true;
            shortNoAuthorList.push(p.title);
          }
        }
      }
    }
    return { processed: n, shortTitleNoAuthor: shortNoAuthorList };
  }

  global.HalalitPersonalLibrary = {
    KEY: KEY,
    load: load,
    save: save,
    add: add,
    removeAt: removeAt,
    removeMatching: removeMatching,
    patchBookAt: patchBookAt,
    addFromSuggestedReview: addFromSuggestedReview,
    importLines: importLines,
    parseTitlePlain: parseTitlePlain,
    plainLine: plainLine,
    normalizeKey: normalizeKey,
    compactDuplicateEntries: compactDuplicateEntries,
    normalizeFinishedAt: normalizeFinishedAt,
    finishedYear: finishedYear,
    extractFinishedFromLine: extractFinishedFromLine,
    shelfTitleDistinctiveEnough: shelfTitleDistinctiveEnough,
  };
})(typeof window !== "undefined" ? window : this);
