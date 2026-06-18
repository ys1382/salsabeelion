/**
 * Halalit — infer informal series / same-franchise clusters on the Personal Library wall
 * from Open Library subjects + explicit series imports, then order spines so clusters sit together.
 */
(function (global) {
  var BROAD_SUBJECT_RE =
    /^(fiction|juvenile|juvenile fiction|children'?s fiction|juvenile literature|historical|fantasy|adventure|adventure fiction|adventure stories|folklore|fairy tales|storytelling|asia|europe|girls?(?:\s*&\s*|\s+and\s+)women|fantasy\s*&\s*magic|action\s*&\s*adventure|books and reading)$/i;
  var AWARD_OR_LIST_RE =
    /award|bestseller|nyt:|parents' choice|newbery|honor book|mythopeic|new list \d|paperback_books/i;
  var BISAC_PREFIX_RE = /^juvenile fiction\s*\/\s*/i;

  function normalizeSeriesName(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s+series\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeAuthorKey(author) {
    return String(author || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseAuthorFromBook(book, Lib) {
    var a = String((book && book.author) || "").trim();
    if (a) return a;
    if (Lib && typeof Lib.parseTitlePlain === "function") {
      var p = Lib.parseTitlePlain((book && book.titlePlain) || "");
      return String(p.author || "").trim();
    }
    return "";
  }

  function normSubject(s) {
    var t = String(s || "")
      .toLowerCase()
      .replace(/[^\w\s&]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!t) return "";
    if (BROAD_SUBJECT_RE.test(t)) return "";
    t = t.replace(BISAC_PREFIX_RE, "").trim();
    if (BROAD_SUBJECT_RE.test(t)) return "";
    t = t.replace(/\s+fiction$/, "").trim();
    if (!t || BROAD_SUBJECT_RE.test(t)) return "";
    return t;
  }

  function distinctiveSubjectSet(book) {
    var subs = book && book.olSubjects;
    if (!Array.isArray(subs)) return {};
    var out = {};
    for (var i = 0; i < subs.length; i++) {
      var raw = String(subs[i] || "").trim();
      if (!raw || raw.length < 3) continue;
      if (AWARD_OR_LIST_RE.test(raw)) continue;
      if (BISAC_PREFIX_RE.test(raw)) {
        raw = raw.replace(BISAC_PREFIX_RE, "").trim();
        if (!raw) continue;
      }
      var n = normSubject(raw);
      if (!n || n.length < 3) continue;
      out[n] = true;
    }
    return out;
  }

  function isBroadSubject(n) {
    return BROAD_SUBJECT_RE.test(n);
  }

  function sharedSubjects(a, b) {
    var shared = [];
    for (var k in a) {
      if (Object.prototype.hasOwnProperty.call(a, k) && b[k]) shared.push(k);
    }
    return shared;
  }

  function shouldClusterPair(bookA, bookB, subA, subB) {
    var explicitA = bookA.seriesName && bookA.seriesIndex;
    var explicitB = bookB.seriesName && bookB.seriesIndex;
    if (explicitA && explicitB) {
      return normalizeSeriesName(bookA.seriesName) === normalizeSeriesName(bookB.seriesName);
    }

    var sh = sharedSubjects(subA, subB);
    if (sh.length < 2) {
      if (sh.length === 1 && !isBroadSubject(sh[0])) return true;
      return false;
    }
    for (var i = 0; i < sh.length; i++) {
      if (!isBroadSubject(sh[i])) return true;
    }
    return sh.length >= 3;
  }

  function unionFindParent(parent, x) {
    if (parent[x] !== x) parent[x] = unionFindParent(parent, parent[x]);
    return parent[x];
  }

  function unionFindUnion(parent, rank, a, b) {
    var ra = unionFindParent(parent, a);
    var rb = unionFindParent(parent, b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else {
      parent[rb] = ra;
      rank[ra]++;
    }
  }

  /**
   * @param {object[]} books
   * @param {object|null} Lib HalalitPersonalLibrary
   * @returns {{ groups: Array<{ key: string, label: string, memberStorageIndices: number[] }>, patches: Array<{ index: number, patch: object }> }}
   */
  function computeClusters(books, Lib) {
    var n = books.length;
    var parent = [];
    var rank = [];
    for (var i = 0; i < n; i++) {
      parent[i] = i;
      rank[i] = 0;
    }

    var authorBuckets = {};
    var subjectSets = [];
    for (var bi = 0; bi < n; bi++) {
      var book = books[bi];
      subjectSets[bi] = distinctiveSubjectSet(book);
      var ak = normalizeAuthorKey(parseAuthorFromBook(book, Lib));
      if (!ak) continue;
      if (!authorBuckets[ak]) authorBuckets[ak] = [];
      authorBuckets[ak].push(bi);
    }

    for (var ak2 in authorBuckets) {
      if (!Object.prototype.hasOwnProperty.call(authorBuckets, ak2)) continue;
      var idxs = authorBuckets[ak2];
      if (idxs.length < 2) continue;
      for (var p = 0; p < idxs.length; p++) {
        for (var q = p + 1; q < idxs.length; q++) {
          var ia = idxs[p];
          var ib = idxs[q];
          if (shouldClusterPair(books[ia], books[ib], subjectSets[ia], subjectSets[ib])) {
            unionFindUnion(parent, rank, ia, ib);
          }
        }
      }
    }

    var explicitSeries = {};
    for (var ei = 0; ei < n; ei++) {
      var eb = books[ei];
      if (!eb || !eb.seriesName) continue;
      var sk = normalizeSeriesName(eb.seriesName);
      if (!sk) continue;
      if (!explicitSeries[sk]) explicitSeries[sk] = [];
      explicitSeries[sk].push(ei);
    }
    for (var sk2 in explicitSeries) {
      if (!Object.prototype.hasOwnProperty.call(explicitSeries, sk2)) continue;
      var members = explicitSeries[sk2];
      if (members.length < 2) continue;
      for (var m = 1; m < members.length; m++) {
        unionFindUnion(parent, rank, members[0], members[m]);
      }
    }

    var rootMembers = {};
    for (var ri = 0; ri < n; ri++) {
      var root = unionFindParent(parent, ri);
      if (!rootMembers[root]) rootMembers[root] = [];
      rootMembers[root].push(ri);
    }

    var groups = [];
    var patches = [];
    for (var rootKey in rootMembers) {
      if (!Object.prototype.hasOwnProperty.call(rootMembers, rootKey)) continue;
      var mem = rootMembers[rootKey];
      if (mem.length < 2) continue;

      var label = "";
      var groupKey = "";
      var seriesVotes = {};
      var sharedAll = null;

      for (var mi = 0; mi < mem.length; mi++) {
        var b = books[mem[mi]];
        if (b && b.seriesName) {
          var sn = String(b.seriesName).trim();
          if (sn) seriesVotes[normalizeSeriesName(sn)] = sn;
        }
        var ss = subjectSets[mem[mi]];
        if (!sharedAll) {
          sharedAll = {};
          for (var sk3 in ss) {
            if (Object.prototype.hasOwnProperty.call(ss, sk3)) sharedAll[sk3] = true;
          }
        } else {
          for (var sk4 in sharedAll) {
            if (!ss[sk4]) delete sharedAll[sk4];
          }
        }
      }

      var voteKeys = Object.keys(seriesVotes);
      if (voteKeys.length === 1) {
        label = seriesVotes[voteKeys[0]];
        groupKey = "series|" + voteKeys[0];
      } else if (voteKeys.length > 1) {
        label = seriesVotes[voteKeys[0]];
        groupKey = "series|" + voteKeys[0];
      } else {
        var sharedList = [];
        for (var shk in sharedAll) {
          if (Object.prototype.hasOwnProperty.call(sharedAll, shk)) sharedList.push(shk);
        }
        sharedList.sort();
        var authorLabel = parseAuthorFromBook(books[mem[0]], Lib);
        if (sharedList.length) {
          var pick = sharedList.filter(function (s) {
            return !isBroadSubject(s);
          });
          if (!pick.length) pick = sharedList;
          var phrase = pick.slice(0, 2).join(" · ");
          label = authorLabel ? authorLabel + " · " + phrase : phrase;
        } else {
          label = authorLabel ? authorLabel + " · same shelf cluster" : "Same series cluster";
        }
        groupKey = "cluster|" + normalizeAuthorKey(authorLabel) + "|" + normalizeSeriesName(label);
      }

      groups.push({
        key: groupKey,
        label: label,
        memberStorageIndices: mem.slice(),
      });

      for (var pi = 0; pi < mem.length; pi++) {
        var pIdx = mem[pi];
        var pb = books[pIdx];
        var patch = {
          shelfGroupKey: groupKey,
          shelfGroupLabel: label,
        };
        if (!pb.shelfGroupKey || pb.shelfGroupKey !== groupKey) {
          patches.push({ index: pIdx, patch: patch });
        }
      }
    }

    return { groups: groups, patches: patches };
  }

  /**
   * Volume hints in the title, e.g. "The Secret War (Jack Blank Adventure, #2)".
   * @returns {null | { seriesKey: string, seriesLabel: string, volume: number }}
   */
  function parseInlineSeriesVolume(book) {
    if (!book) return null;
    if (book.seriesIndex != null) {
      var si0 = parseInt(String(book.seriesIndex), 10);
      if (!isNaN(si0) && si0 > 0 && si0 < 10000 && book.seriesName) {
        return {
          seriesKey: normalizeSeriesName(book.seriesName),
          seriesLabel: String(book.seriesName).trim(),
          volume: si0,
        };
      }
    }
    var s = String(book.titlePlain || book.title || "");
    var m =
      s.match(/\(([^()]+?),\s*#\s*(\d+)\s*\)/i) ||
      s.match(/\(([^()]+?)\s*#\s*(\d+)\s*\)/i) ||
      s.match(/\(([^()]+?),\s*book\s*(\d+)\s*\)/i);
    if (!m) return null;
    var label = String(m[1])
      .trim()
      .replace(/\s*series\s*$/i, "");
    var vol = parseInt(String(m[2]), 10);
    if (!label || isNaN(vol) || vol < 1 || vol >= 10000) return null;
    return {
      seriesKey: normalizeSeriesName(label),
      seriesLabel: label,
      volume: vol,
    };
  }

  function sortKeyForBook(book) {
    var inline = parseInlineSeriesVolume(book);
    if (inline) return inline.volume;
    if (book && book.seriesIndex != null) {
      var si = parseInt(String(book.seriesIndex), 10);
      if (!isNaN(si) && si > 0) return si;
    }
    if (book && book.olFirstPublishYear != null) {
      var y = parseInt(String(book.olFirstPublishYear), 10);
      if (!isNaN(y) && y > 0) return y;
    }
    if (book && book.finishedAt) {
      var fy = String(book.finishedAt).match(/^(\d{4})/);
      if (fy) return parseInt(fy[1], 10);
    }
    return 99999;
  }

  /**
   * @param {object[]} books — storage-order list
   * @param {object|null} Lib
   * @returns {Array<{ book: object, storageIndex: number }>}
   */
  function orderBooksForShelf(books, Lib) {
    var list = books || [];
    var n = list.length;
    if (n < 2) {
      return list.map(function (b, i) {
        return { book: b, storageIndex: i };
      });
    }

    var clusters = computeClusters(list, Lib);
    var inGroup = {};
    var ordered = [];

    clusters.groups.sort(function (a, b) {
      return String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" });
    });

    for (var gi = 0; gi < clusters.groups.length; gi++) {
      var g = clusters.groups[gi];
      var members = g.memberStorageIndices.slice();
      members.sort(function (ia, ib) {
        var ka = sortKeyForBook(list[ia]);
        var kb = sortKeyForBook(list[ib]);
        if (ka !== kb) return ka - kb;
        var ta = String(list[ia].title || list[ia].titlePlain || "");
        var tb = String(list[ib].title || list[ib].titlePlain || "");
        return ta.localeCompare(tb, undefined, { sensitivity: "base" });
      });
      for (var mj = 0; mj < members.length; mj++) {
        var idx = members[mj];
        inGroup[idx] = true;
        ordered.push({ book: list[idx], storageIndex: idx });
      }
    }

    var rest = [];
    for (var ri = 0; ri < n; ri++) {
      if (inGroup[ri]) continue;
      rest.push({ book: list[ri], storageIndex: ri });
    }
    rest.sort(function (a, b) {
      var ka = sortKeyForBook(a.book);
      var kb = sortKeyForBook(b.book);
      if (ka !== kb) return kb - ka;
      return a.storageIndex - b.storageIndex;
    });

    return ordered.concat(rest);
  }

  /**
   * List view: group by series (including “(Series name, #2)” in the title) and sort volumes 1, 2, 3…
   * @param {object[]} books
   * @param {object|null} Lib
   * @returns {Array<{ book: object, storageIndex: number }>}
   */
  function orderBooksForListView(books, Lib) {
    var list = books || [];
    var n = list.length;
    if (n < 2) {
      return list.map(function (b, i) {
        return { book: b, storageIndex: i };
      });
    }

    var buckets = {};
    var loose = [];

    for (var i = 0; i < n; i++) {
      var b = list[i];
      var p = parseInlineSeriesVolume(b);
      if (!p && b.seriesName) {
        var v0 = b.seriesIndex != null ? parseInt(String(b.seriesIndex), 10) : NaN;
        p = {
          seriesKey: normalizeSeriesName(b.seriesName),
          seriesLabel: String(b.seriesName).trim(),
          volume: !isNaN(v0) && v0 > 0 ? v0 : 99999,
        };
      }
      if (p) {
        if (!buckets[p.seriesKey]) {
          buckets[p.seriesKey] = { label: p.seriesLabel, rows: [] };
        }
        buckets[p.seriesKey].rows.push({
          book: b,
          storageIndex: i,
          volume: p.volume,
        });
      } else {
        loose.push({ book: b, storageIndex: i });
      }
    }

    var ordered = [];
    var keys = Object.keys(buckets);
    keys.sort(function (a, b) {
      return String(buckets[a].label || a).localeCompare(String(buckets[b].label || b), undefined, {
        sensitivity: "base",
      });
    });

    for (var ki = 0; ki < keys.length; ki++) {
      var rows = buckets[keys[ki]].rows;
      rows.sort(function (a, b) {
        if (a.volume !== b.volume) return a.volume - b.volume;
        return a.storageIndex - b.storageIndex;
      });
      for (var ri = 0; ri < rows.length; ri++) ordered.push(rows[ri]);
    }

    if (loose.length) {
      var looseOnly = loose.map(function (x) {
        return x.book;
      });
      var looseOrdered = orderBooksForShelf(looseOnly, Lib);
      for (var li = 0; li < looseOrdered.length; li++) {
        var ob = looseOrdered[li].book;
        for (var lj = 0; lj < loose.length; lj++) {
          if (loose[lj].book === ob) {
            ordered.push({ book: ob, storageIndex: loose[lj].storageIndex });
            break;
          }
        }
      }
    }

    return ordered;
  }

  /**
   * Persist cluster labels and re-render when enough catalogue data exists.
   * @param {object} lib — HalalitPersonalLibrary
   * @param {function(): void} rerender
   */
  function applyClusterPatchesAndRerender(lib, rerender) {
    if (!lib || typeof lib.load !== "function" || typeof lib.patchBookAt !== "function") return false;
    var books = lib.load();
    var res = computeClusters(books, lib);
    var changed = false;
    for (var i = 0; i < res.patches.length; i++) {
      var p = res.patches[i];
      if (lib.patchBookAt(p.index, p.patch)) changed = true;
    }
    if (changed && typeof rerender === "function") rerender();
    return changed;
  }

  global.HalalitShelfSeriesGroup = {
    orderBooksForShelf: orderBooksForShelf,
    orderBooksForListView: orderBooksForListView,
    parseInlineSeriesVolume: parseInlineSeriesVolume,
    computeClusters: computeClusters,
    applyClusterPatchesAndRerender: applyClusterPatchesAndRerender,
    normalizeSeriesName: normalizeSeriesName,
  };
})(typeof window !== "undefined" ? window : this);
