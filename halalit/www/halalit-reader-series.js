/**
 * Halalit — reader-guided series progress: catalog + shelf clusters, gaps (read 1,2,4),
 * skipped volumes, and corrections when Halalit guesses wrong.
 * Series feedback and discontinue flags live on the signed-in reader account.
 */
(function (global) {
  var FEEDBACK_KEY = "halalitReaderSeriesFeedback";
  var LEGACY_DISCONTINUE_KEY = "halalitContinueSeriesDiscontinued";

  function store() {
    return global.HalalitAccountStorage || null;
  }

  function loadFeedback() {
    try {
      var raw = store() ? store().getItem(FEEDBACK_KEY) : null;
      var fb = raw ? JSON.parse(raw) : null;
      if (!fb || typeof fb !== "object") fb = {};
      if (!fb.series || typeof fb.series !== "object") fb.series = {};
      if (!fb.excludedBooks || typeof fb.excludedBooks !== "object") fb.excludedBooks = {};
      if (!fb.bookVolume || typeof fb.bookVolume !== "object") fb.bookVolume = {};
      mergeLegacyDiscontinued(fb);
      return fb;
    } catch (e) {
      return { series: {}, excludedBooks: {}, bookVolume: {} };
    }
  }

  function mergeLegacyDiscontinued(fb) {
    try {
      var raw = store() ? store().getItem(LEGACY_DISCONTINUE_KEY) : null;
      if (!raw) return;
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (var i = 0; i < arr.length; i++) {
        var sk = normalizeSeriesKey(arr[i]);
        if (!sk) continue;
        if (!fb.series[sk]) fb.series[sk] = { label: arr[i] };
        fb.series[sk].discontinued = true;
      }
    } catch (e2) {}
  }

  function saveFeedback(fb) {
    try {
      if (store()) store().setItem(FEEDBACK_KEY, JSON.stringify(fb || {}));
    } catch (e) {}
  }

  function normalizeSeriesKey(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s+series\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function bookKey(Lib, book) {
    if (!Lib || !book) return "";
    var t = book.title;
    var a = book.author;
    if ((!t || !a) && book.titlePlain && Lib.parseTitlePlain) {
      var p = Lib.parseTitlePlain(book.titlePlain);
      t = t || p.title;
      a = a || p.author;
    }
    return Lib.normalizeKey(t, a);
  }

  function isBookExcluded(book, Lib, fb) {
    var k = bookKey(Lib, book);
    return !!(k && fb.excludedBooks && fb.excludedBooks[k]);
  }

  function seriesKeyForBook(book) {
    if (!book) return "";
    if (book.seriesName) return normalizeSeriesKey(book.seriesName);
    if (book.shelfGroupKey) return String(book.shelfGroupKey).trim();
    return "";
  }

  function seriesLabelForBook(book, sk) {
    if (book && book.seriesName) return String(book.seriesName).trim();
    if (book && book.shelfGroupLabel) return String(book.shelfGroupLabel).trim();
    return sk || "";
  }

  function getSeriesEntry(fb, seriesKey) {
    if (!fb.series[seriesKey]) {
      fb.series[seriesKey] = {
        label: "",
        readVolumes: [],
        skippedVolumes: [],
        usePublishOrder: false,
        discontinued: false,
      };
    }
    return fb.series[seriesKey];
  }

  function readVolumeForBook(book, Lib, fb) {
    if (!book) return null;
    var bk = bookKey(Lib, book);
    if (bk && fb.bookVolume && fb.bookVolume[bk] != null) {
      var manual = parseInt(String(fb.bookVolume[bk]), 10);
      if (!isNaN(manual) && manual > 0 && manual < 10000) return manual;
    }
    var Shelf = global.HalalitShelfSeriesGroup;
    if (Shelf && typeof Shelf.parseInlineSeriesVolume === "function") {
      var inline = Shelf.parseInlineSeriesVolume(book);
      if (inline && inline.volume > 0) return inline.volume;
    }
    if (book.source === "series_openlibrary" && book.seriesIndex != null) {
      var siImp = parseInt(String(book.seriesIndex), 10);
      if (!isNaN(siImp) && siImp > 0 && siImp < 10000) return siImp;
    }
    if (book.seriesIndex != null) {
      var si = parseInt(String(book.seriesIndex), 10);
      if (!isNaN(si) && si > 0 && si < 10000) return si;
    }
    var Series2 = global.HalalitSeriesExpand;
    if (Series2 && typeof Series2.extractCatalogVolumeNumber === "function") {
      var ft = Series2.extractCatalogVolumeNumber(book.title || book.titlePlain);
      if (ft != null) return ft;
    }
    return null;
  }

  /**
   * Volumes still to offer on Continue Series: gaps first (e.g. read 1,2,4 → 3), then next after highest read.
   * @param {number[]} readVolumes
   * @param {number[]} skippedVolumes
   * @returns {Array<{ volume: number, kind: 'gap' | 'next' }>}
   */
  function nextVolumeTargets(readVolumes, skippedVolumes) {
    var read = {};
    var skipped = {};
    var max = 0;
    var i;
    for (i = 0; i < (readVolumes || []).length; i++) {
      var rv = parseInt(String(readVolumes[i]), 10);
      if (!isNaN(rv) && rv > 0) {
        read[rv] = true;
        if (rv > max) max = rv;
      }
    }
    for (i = 0; i < (skippedVolumes || []).length; i++) {
      var sv = parseInt(String(skippedVolumes[i]), 10);
      if (!isNaN(sv) && sv > 0) skipped[sv] = true;
    }
    var out = [];
    var n;
    var firstGap = null;
    for (n = 1; n <= max; n++) {
      if (!read[n] && !skipped[n]) {
        firstGap = n;
        break;
      }
    }
    if (firstGap != null) out.push({ volume: firstGap, kind: "gap" });
    var after = max + 1;
    if (!read[after] && !skipped[after] && after !== firstGap) {
      out.push({ volume: after, kind: "next" });
    }
    return out;
  }

  /**
   * @param {object[]} read — Personal Library list
   * @param {object|null} Lib
   * @param {object} fb — feedback
   * @returns {Record<string, { seriesKey: string, seriesName: string, author: string, readVolumes: number[], memberIndices: number[] }>}
   */
  function bookAlreadyOnShelf(read, Lib, book) {
    if (!book || !read || !read.length) return false;
    var k = bookKey(Lib, book);
    if (!k) return false;
    for (var i = 0; i < read.length; i++) {
      if (bookKey(Lib, read[i]) === k) return true;
    }
    return false;
  }

  function dedupeContinueCandidates(list, Lib) {
    var seenBook = {};
    var seenSlot = {};
    var out = [];
    for (var i = 0; i < (list || []).length; i++) {
      var c = list[i];
      if (!c || !c.book) continue;
      var bk = bookKey(Lib, c.book);
      var slot = String(c.seriesKey || "") + "|" + String(c.seriesIndex || "");
      if (bk && seenBook[bk]) continue;
      if (seenSlot[slot]) continue;
      if (bk) seenBook[bk] = true;
      seenSlot[slot] = true;
      out.push(c);
    }
    return out;
  }

  function buildSeriesMapFromRead(read, Lib, fb) {
    var map = {};
    var Shelf = global.HalalitShelfSeriesGroup;
    var assigned = {};

    function ensure(sk, label, author) {
      if (!sk) return null;
      if (!map[sk]) {
        map[sk] = {
          seriesKey: sk,
          seriesName: label || sk,
          author: author || "",
          readVolumes: [],
          memberIndices: [],
        };
      }
      if (label && !map[sk].seriesName) map[sk].seriesName = label;
      if (author && !map[sk].author) map[sk].author = author;
      return map[sk];
    }

    function addBookToSeries(bookIndex, sk, label, author) {
      if (assigned[bookIndex] != null) return;
      var b = read[bookIndex];
      if (!b || isBookExcluded(b, Lib, fb)) return;
      assigned[bookIndex] = sk;
      var ent = ensure(sk, label, String(author || b.author || "").trim());
      if (!ent) return;
      if (ent.memberIndices.indexOf(bookIndex) < 0) ent.memberIndices.push(bookIndex);
      var vol = readVolumeForBook(b, Lib, fb);
      if (vol != null && ent.readVolumes.indexOf(vol) < 0) ent.readVolumes.push(vol);
    }

    for (var i = 0; i < read.length; i++) {
      var b0 = read[i];
      if (!b0 || isBookExcluded(b0, Lib, fb) || !b0.seriesName) continue;
      var sk0 = normalizeSeriesKey(b0.seriesName);
      if (!sk0) continue;
      addBookToSeries(i, sk0, String(b0.seriesName).trim(), b0.author);
    }

    if (Shelf && typeof Shelf.computeClusters === "function") {
      var clusters = Shelf.computeClusters(read, Lib);
      for (var ci = 0; ci < clusters.groups.length; ci++) {
        var g = clusters.groups[ci];
        if (!g.memberStorageIndices || g.memberStorageIndices.length < 2) continue;
        var sk2 = g.key || normalizeSeriesKey(g.label);
        for (var mi = 0; mi < g.memberStorageIndices.length; mi++) {
          addBookToSeries(g.memberStorageIndices[mi], sk2, g.label, "");
        }
      }
    }

    for (var i2 = 0; i2 < read.length; i2++) {
      var b3 = read[i2];
      if (!b3 || assigned[i2] != null || isBookExcluded(b3, Lib, fb)) continue;
      if (!b3.shelfGroupKey) continue;
      addBookToSeries(i2, String(b3.shelfGroupKey).trim(), seriesLabelForBook(b3, b3.shelfGroupKey), b3.author);
    }

    for (var sk3 in fb.series) {
      if (!Object.prototype.hasOwnProperty.call(fb.series, sk3)) continue;
      var row = fb.series[sk3];
      var ent3 = map[sk3];
      if (!ent3) continue;
      if (row.discontinued) ent3.discontinued = true;
      if (row.usePublishOrder) ent3.usePublishOrder = true;
    }

    for (var mk in map) {
      if (!Object.prototype.hasOwnProperty.call(map, mk)) continue;
      reconcileReadVolumesFromMembers(map[mk], read, Lib, fb);
    }
    return map;
  }

  function reconcileReadVolumesFromMembers(ent, read, Lib, fb) {
    if (!ent) return;
    ent.readVolumes = [];
    for (var mi = 0; mi < ent.memberIndices.length; mi++) {
      var b = read[ent.memberIndices[mi]];
      if (!b) continue;
      var vol = readVolumeForBook(b, Lib, fb);
      if (vol != null && ent.readVolumes.indexOf(vol) < 0) ent.readVolumes.push(vol);
    }
    ent.readVolumes.sort(function (a, b) {
      return a - b;
    });
  }

  /**
   * After a series import line, align stored “read volumes” with what the reader asked for.
   * @param {string} searchTitle
   * @param {number[]} volumeNumbers
   */
  function syncSeriesImportReadVolumes(searchTitle, volumeNumbers) {
    var sk = normalizeSeriesKey(searchTitle);
    if (!sk || !volumeNumbers || !volumeNumbers.length) return;
    var fb = loadFeedback();
    var ent = getSeriesEntry(fb, sk);
    ent.label = String(searchTitle || "").trim() || ent.label;
    ent.readVolumes = [];
    for (var i = 0; i < volumeNumbers.length; i++) {
      var v = parseInt(String(volumeNumbers[i]), 10);
      if (!isNaN(v) && v > 0 && v < 10000 && ent.readVolumes.indexOf(v) < 0) ent.readVolumes.push(v);
    }
    ent.readVolumes.sort(function (a, b) {
      return a - b;
    });
    saveFeedback(fb);
  }

  function catalogSearchTitle(seriesName, author) {
    var label = String(seriesName || "").trim();
    var m = label.match(/^(.+?)\s*·\s*(.+)$/);
    if (m) {
      var left = m[1].trim();
      var right = m[2].trim();
      if (author && left.toLowerCase() === String(author).toLowerCase()) return right;
      return right || left;
    }
    return label.replace(/\s+series\s*$/i, "").trim();
  }

  function normTitleMatch(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function matchVolumeInCatalogList(book, orderedBooks) {
    var Series = global.HalalitSeriesExpand;
    var qt = normTitleMatch(book.title || (book.titlePlain && book.titlePlain.split(" by ")[0]));
    if (!qt) return null;
    for (var i = 0; i < orderedBooks.length; i++) {
      var ct = normTitleMatch(orderedBooks[i].title);
      if (!ct) continue;
      if (ct === qt || ct.indexOf(qt) !== -1 || qt.indexOf(ct) !== -1) {
        if (Series && typeof Series.extractCatalogVolumeNumber === "function") {
          var vol = Series.extractCatalogVolumeNumber(orderedBooks[i].title);
          if (vol != null) return vol;
        }
        return i + 1;
      }
    }
    return null;
  }

  /**
   * Fill missing volume numbers from catalog order (async).
   * @returns {Promise<void>}
   */
  function seriesKeysMatch(storedKey, book, ent) {
    var bk = seriesKeyForBook(book);
    if (bk && bk === storedKey) return true;
    var a = normalizeSeriesKey(book && book.seriesName);
    var b = normalizeSeriesKey(ent && ent.seriesName);
    if (a && b && a === b) return true;
    var c = normalizeSeriesKey(catalogSearchTitle(ent && ent.seriesName, ent && ent.author));
    if (a && c && a === c) return true;
    return false;
  }

  function assignMissingVolumesFromCatalog(seriesMap, read, Lib) {
    var Series = global.HalalitSeriesExpand;
    if (!Series || typeof Series.expandIntentToBooks !== "function") {
      return Promise.resolve();
    }
    var fb0 = loadFeedback();
    var keys = Object.keys(seriesMap);
    var tasks = [];
    for (var ki = 0; ki < keys.length; ki++) {
      (function (sk) {
        var ent = seriesMap[sk];
        var needs = false;
        for (var mi = 0; mi < ent.memberIndices.length; mi++) {
          var b = read[ent.memberIndices[mi]];
          if (b && readVolumeForBook(b, Lib, fb0) == null) {
            needs = true;
            break;
          }
        }
        if (!needs) return;
        var searchTitle = catalogSearchTitle(ent.seriesName, ent.author);
        if (!searchTitle) return;
        tasks.push(
          Series.expandIntentToBooks({
            mode: "all",
            searchTitle: searchTitle,
            author: ent.author || "",
          }).then(function (exp) {
            var books = exp && Array.isArray(exp.books) ? exp.books : [];
            if (!books.length) return;
            var fb = loadFeedback();
            for (var j = 0; j < ent.memberIndices.length; j++) {
              var idx = ent.memberIndices[j];
              var bk = read[idx];
              if (!bk || readVolumeForBook(bk, Lib, fb) != null) continue;
              if (bk.source === "series_openlibrary" && bk.seriesIndex != null) continue;
              var vol = null;
              if (Series && typeof Series.extractCatalogVolumeNumber === "function") {
                vol = Series.extractCatalogVolumeNumber(bk.title || bk.titlePlain);
              }
              if (vol == null) vol = matchVolumeInCatalogList(bk, books);
              if (vol == null) continue;
              var key = bookKey(Lib, bk);
              if (key) {
                fb.bookVolume[key] = vol;
                if (!bk.seriesName) {
                  Lib.patchBookAt(idx, {
                    seriesName: searchTitle,
                    seriesIndex: vol,
                    shelfGroupKey: sk,
                    shelfGroupLabel: ent.seriesName,
                  });
                } else {
                  Lib.patchBookAt(idx, { seriesIndex: vol });
                }
              }
            }
            saveFeedback(fb);
            reconcileReadVolumesFromMembers(ent, read, Lib, fb);
          })
        );
      })(keys[ki]);
    }
    if (!tasks.length) return Promise.resolve();
    return Promise.all(tasks).then(function () {});
  }

  function collectContinueCandidates(read, wish, Lib, opts) {
    opts = opts || {};
    var includeWishlisted = opts.includeWishlisted !== false;
    var Series = global.HalalitSeriesExpand;
    var fb = loadFeedback();
    var seriesMap = buildSeriesMapFromRead(read, Lib, fb);
    var candidates = [];
    var catalogTasks = [];
    var seriesKeys = Object.keys(seriesMap);

    for (var si = 0; si < seriesKeys.length; si++) {
        (function (sk) {
          var ent = seriesMap[sk];
          if (!ent.memberIndices || !ent.memberIndices.length) return;
          var row = fb.series[sk] || {};
          if (ent.discontinued || row.discontinued) return;

          var skipped = Array.isArray(row.skippedVolumes) ? row.skippedVolumes.slice() : [];
          var targets = nextVolumeTargets(ent.readVolumes, skipped);
          if (!targets.length && ent.readVolumes.length === 0) {
            targets = [{ volume: 1, kind: "next" }];
          }

          for (var ti = 0; ti < targets.length; ti++) {
            (function (target) {
              var vol = target.volume;
              if (ent.readVolumes.indexOf(vol) >= 0) return;

              if (includeWishlisted && wish && wish.length) {
                for (var wi = 0; wi < wish.length; wi++) {
                  var wb = wish[wi];
                  if (!wb) continue;
                  if (!seriesKeysMatch(sk, wb, ent)) continue;
                  var wv = readVolumeForBook(wb, Lib, fb);
                  if (wv == null) wv = wb.seriesIndex != null ? parseInt(String(wb.seriesIndex), 10) : null;
                  if (wv !== vol) continue;
                  var candW = {
                    seriesKey: sk,
                    seriesName: ent.seriesName,
                    seriesIndex: vol,
                    targetKind: target.kind,
                    wishIndex: wi,
                    book: wb,
                  };
                  if (!bookAlreadyOnShelf(read, Lib, wb)) candidates.push(candW);
                  return;
                }
              }

              if (!Series || typeof Series.expandIntentToBooks !== "function") return;
              var searchTitle = catalogSearchTitle(ent.seriesName, ent.author);
              catalogTasks.push(
                Series.expandIntentToBooks({
                  mode: "volumes",
                  volumeNumbers: [vol],
                  searchTitle: searchTitle,
                  author: ent.author || "",
                }).then(function (exp) {
                  var books = exp && Array.isArray(exp.books) ? exp.books : [];
                  if (!books.length) return;
                  var bk = books[0];
                  var candB = {
                    title: bk.title,
                    author: bk.author || ent.author || "",
                    titlePlain: bk.author ? bk.title + " by " + bk.author : bk.title,
                    seriesName: searchTitle,
                    seriesIndex: vol,
                    source: "continue_series_catalog",
                  };
                  if (bookAlreadyOnShelf(read, Lib, candB)) return;
                  candidates.push({
                    seriesKey: sk,
                    seriesName: ent.seriesName,
                    seriesIndex: vol,
                    targetKind: target.kind,
                    wishIndex: null,
                    book: candB,
                  });
                })
              );
            })(targets[ti]);
          }
        })(seriesKeys[si]);
    }

    candidates = dedupeContinueCandidates(candidates, Lib);
    return {
      sorted: sortCandidates(candidates),
      candidates: candidates,
      catalogTasks: catalogTasks,
    };
  }

  /**
   * @returns {Promise<Array<object>>} continue candidates
   */
  function buildContinueCandidates(read, wish, Lib, opts) {
    opts = opts || {};
    var afterMissing =
      opts.fillMissingVolumes === true
        ? assignMissingVolumesFromCatalog(
            buildSeriesMapFromRead(read, Lib, loadFeedback()),
            read,
            Lib
          )
        : Promise.resolve();

    return afterMissing.then(function () {
      var pack = collectContinueCandidates(read, wish, Lib, opts);
      if (!pack.catalogTasks.length) {
        return Promise.resolve(pack.sorted);
      }
      if (opts.waitForCatalog === true) {
        return Promise.all(pack.catalogTasks).then(function () {
          return sortCandidates(dedupeContinueCandidates(pack.candidates, Lib));
        });
      }
      if (typeof opts.onMoreCandidates === "function") {
        Promise.all(pack.catalogTasks)
          .then(function () {
            opts.onMoreCandidates(
              sortCandidates(dedupeContinueCandidates(pack.candidates, Lib))
            );
          })
          .catch(function () {});
      }
      return Promise.resolve(pack.sorted);
    });
  }

  function sortCandidates(list) {
    list.sort(function (a, b) {
      var an = String(a.seriesName || "").toLowerCase();
      var bn = String(b.seriesName || "").toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      if (a.seriesIndex !== b.seriesIndex) return a.seriesIndex - b.seriesIndex;
      if (a.targetKind === "gap" && b.targetKind !== "gap") return -1;
      if (b.targetKind === "gap" && a.targetKind !== "gap") return 1;
      return 0;
    });
    return list;
  }

  function excludeBookFromSet(Lib, book, rerender) {
    var fb = loadFeedback();
    var k = bookKey(Lib, book);
    if (k) fb.excludedBooks[k] = true;
    saveFeedback(fb);
    if (typeof rerender === "function") rerender();
  }

  function setBookVolume(Lib, bookIndex, volume, read, rerender) {
    var fb = loadFeedback();
    var book = read[bookIndex];
    if (!book) return;
    var k = bookKey(Lib, book);
    if (!k) return;
    fb.bookVolume[k] = volume;
    saveFeedback(fb);
    var patch = { seriesIndex: volume };
    if (!book.seriesName && book.shelfGroupLabel) {
      patch.seriesName = catalogSearchTitle(book.shelfGroupLabel, book.author);
    }
    Lib.patchBookAt(bookIndex, patch);
    if (typeof rerender === "function") rerender();
  }

  function skipVolume(seriesKey, volume, rerender) {
    var fb = loadFeedback();
    var ent = getSeriesEntry(fb, seriesKey);
    if (ent.skippedVolumes.indexOf(volume) < 0) ent.skippedVolumes.push(volume);
    ent.skippedVolumes.sort(function (a, b) {
      return a - b;
    });
    saveFeedback(fb);
    if (typeof rerender === "function") rerender();
  }

  function markWrongOrder(seriesKey, rerender) {
    var fb = loadFeedback();
    var ent = getSeriesEntry(fb, seriesKey);
    ent.usePublishOrder = true;
    ent.wrongOrderReported = true;
    saveFeedback(fb);
    if (typeof rerender === "function") rerender();
  }

  function discontinueSeries(seriesKey, rerender) {
    var fb = loadFeedback();
    var ent = getSeriesEntry(fb, seriesKey);
    ent.discontinued = true;
    saveFeedback(fb);
    try {
      if (store()) store().setItem(LEGACY_DISCONTINUE_KEY, JSON.stringify([seriesKey]));
    } catch (e) {}
    if (typeof rerender === "function") rerender();
  }

  function notTheRightNextBook(candidate, rerender) {
    if (!candidate || !candidate.seriesKey) return;
    skipVolume(candidate.seriesKey, candidate.seriesIndex, rerender);
  }

  global.HalalitReaderSeries = {
    FEEDBACK_KEY: FEEDBACK_KEY,
    loadFeedback: loadFeedback,
    saveFeedback: saveFeedback,
    normalizeSeriesKey: normalizeSeriesKey,
    bookKey: bookKey,
    isBookExcluded: isBookExcluded,
    seriesKeyForBook: seriesKeyForBook,
    readVolumeForBook: readVolumeForBook,
    nextVolumeTargets: nextVolumeTargets,
    buildSeriesMapFromRead: buildSeriesMapFromRead,
    buildContinueCandidates: buildContinueCandidates,
    excludeBookFromSet: excludeBookFromSet,
    setBookVolume: setBookVolume,
    skipVolume: skipVolume,
    markWrongOrder: markWrongOrder,
    discontinueSeries: discontinueSeries,
    notTheRightNextBook: notTheRightNextBook,
    getSeriesEntry: getSeriesEntry,
    catalogSearchTitle: catalogSearchTitle,
    syncSeriesImportReadVolumes: syncSeriesImportReadVolumes,
    reconcileReadVolumesFromMembers: reconcileReadVolumesFromMembers,
  };
})(typeof window !== "undefined" ? window : this);
