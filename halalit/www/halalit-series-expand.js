/**
 * Halalit — expand "… series", "first N books of … series", and
 * "books 1, 4 and 5 of …" (specific volumes) import lines into individual titles
 * via Open Library search (CORS fetch from the reader's browser).
 */
(function (global) {
  var Lib = function () {
    return global.HalalitPersonalLibrary || null;
  };

  var JUNK_TITLE_RE =
    /study\s+guide|supersummary|sparknotes|cliffsnotes|complete\s+collection|complete\s+works|boxed\s+set|gift\s+set|slip\s*case|slipcased|bind[- ]?up|omnibus|compendium|\blib\s*\/\s*e\b|audiobook|graphic\s+novel\s+adaptation|teacher['']?s\s+edition|workbook|\b\d+\s*[-–]?\s*volumes?\s+sets?\b|\bmulti[- ]?volume\b|\bset\s+of\s+\d+\s*books?\b|\b\d+\s*books?\s+(box\s+set|boxed|collection)\b|\bpowerpack\b/i;
  /** “by Scholastic” etc. — publishers are not Open Library author_name values; do not filter hits on them. */
  var PUBLISHER_AUTHOR_RE =
    /\b(scholastic|penguin|random\s+house|harper\s*collins|harpercollins|simon\s*[&,]\s*schuster|disney|hyperion|hachette|macmillan|little[\s,]+brown|oxford\s+university\s+press|\boup\b)\b/i;
  var OMNIBUS_MULTI_RE =
    /\b1\s*[-–]\s*\d|\b\d+\s*[-–]\s*\d+\s*\(|\b\d+\s*[-–]\s*book/i;
  /** Obvious novelty / drink-meme lines — not the MG “Spirit Animals” type series. */
  var FAMILY_NOISE_TITLE_RE =
    /\b(coffee|wine|beer|vodka|whiskey|tequila)\s+is\s+my\s+spirit\b|\bmy\s+spirit\s+animal\s+is\s+(a\s+)?(coffee|wine|beer|vodka|chicken|gummy|tuna)\b/i;
  /** Retail / misfiled rows that share the series phrase but are not numbered volumes. */
  var CATALOG_SHELF_NOISE_RE =
    /\bmixed\s+display\b|declaration\s+of\s+independence|know+ledge\s+is\s+power|display\s+only\b|promotional\s+pack\b/i;

  var WORD_TO_NUM = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
  };

  function parseFirstCount(tok) {
    var t = String(tok || "")
      .trim()
      .toLowerCase();
    if (!t) return NaN;
    var n = parseInt(t, 10);
    if (!isNaN(n) && n > 0) return n;
    return WORD_TO_NUM[t] || NaN;
  }

  /** Alternation for regex: one … fifteen (same span as parseFirstCount). */
  var VOL_WORD_ALT =
    "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen";

  /**
   * Parse "1, 4 and 5" / "1 and five" into sorted unique volume indices (1-based).
   * @returns {number[] | null}
   */
  function parseVolumeListChunk(chunk) {
    var c = String(chunk || "")
      .trim()
      .toLowerCase()
      .replace(/\s+and\s+/g, ",");
    var parts = c.split(",");
    var out = [];
    var seen = {};
    for (var i = 0; i < parts.length; i++) {
      var n = parseFirstCount(parts[i]);
      if (!(n > 0 && n <= 99)) return null;
      if (seen[n]) continue;
      seen[n] = true;
      out.push(n);
    }
    if (!out.length) return null;
    out.sort(function (a, b) {
      return a - b;
    });
    return out;
  }

  function stripTrailingSeriesPhrase(s) {
    return String(s || "")
      .replace(/\s+series\s*$/i, "")
      .trim();
  }

  /**
   * @param {string} rest — one line after extractFinishedFromLine().rest
   * @returns {null | { mode: 'all' | 'first' | 'volumes', firstCount?: number, volumeNumbers?: number[], searchTitle: string, author: string }}
   */
  function parseSeriesImportIntent(rest) {
    var L = Lib();
    if (!L) return null;
    var s = String(rest || "").trim();
    if (!s || s.charAt(0) === "#") return null;

    var mFirst = s.match(/^(?:the\s+)?first\s+(.+?)\s+books?\s+of\s+(.+)$/i);
    if (mFirst) {
      var n = parseFirstCount(mFirst[1]);
      var tail = stripTrailingSeriesPhrase(mFirst[2].trim());
      if (!(n > 0 && n <= 50 && tail)) return null;
      var p0 = L.parseTitlePlain(tail);
      var st = String(p0.title || tail).trim();
      if (!st) return null;
      return {
        mode: "first",
        firstCount: n,
        searchTitle: st,
        author: String(p0.author || "").trim(),
      };
    }

    var mBooksOf = s.match(
      new RegExp(
        "^(?:the\\s+)?(?:books?|volumes?)\\s+((?:\\d+|"+VOL_WORD_ALT+")(?:(?:\\s*,\\s*|\\s+and\\s+)(?:\\d+|"+VOL_WORD_ALT+"))*)\\s+of\\s+(.+)$",
        "i"
      )
    );
    if (mBooksOf) {
      var vols = parseVolumeListChunk(mBooksOf[1]);
      var tailB = stripTrailingSeriesPhrase(mBooksOf[2].trim());
      if (vols && tailB) {
        var pB = L.parseTitlePlain(tailB);
        var stB = String(pB.title || tailB).trim();
        if (stB) {
          return {
            mode: "volumes",
            volumeNumbers: vols,
            searchTitle: stB,
            author: String(pB.author || "").trim(),
          };
        }
      }
    }

    var p = L.parseTitlePlain(s);
    var t = String(p.title || "").trim();
    if (!/\bseries\s*$/i.test(t)) return null;
    var core = stripTrailingSeriesPhrase(t);
    if (!core) return null;
    return {
      mode: "all",
      searchTitle: core,
      author: String(p.author || "").trim(),
    };
  }

  function normBlob(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[''’]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function significantTokens(phrase) {
    var STOP = {
      the: 1,
      and: 1,
      for: 1,
      but: 1,
      with: 1,
      from: 1,
      that: 1,
      this: 1,
      those: 1,
      into: 1,
      upon: 1,
      over: 1,
      a: 1,
      an: 1,
      of: 1,
      to: 1,
      in: 1,
      on: 1,
      at: 1,
      by: 1,
    };
    var raw = String(phrase || "")
      .toLowerCase()
      .match(/[a-z0-9']+/g);
    if (!raw) return [];
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var w = raw[i].replace(/[''’]/g, "");
      if (w.length < 2 || STOP[w]) continue;
      out.push(w);
    }
    return out;
  }

  function titleMatchesTokens(docTitle, tokens) {
    if (!tokens.length) return true;
    var blob = normBlob(docTitle);
    for (var i = 0; i < tokens.length; i++) {
      if (blob.indexOf(normBlob(tokens[i])) === -1) return false;
    }
    return true;
  }

  /** Normalized slug for “does this work belong to this series phrase?” */
  function seriesPhraseNeedle(searchTitle) {
    var full = normBlob(searchTitle);
    if (full.indexOf("the") === 0 && full.length > 9) return full.slice(3);
    return full;
  }

  function docTitleMatchesSeriesPhrase(docTitle, searchTitle) {
    var hay = normBlob(docTitle);
    var needle = seriesPhraseNeedle(searchTitle);
    if (needle.length >= 8) return hay.indexOf(needle) !== -1;
    var toks = significantTokens(searchTitle);
    if (toks.length < 2) {
      var one = toks.length === 1 ? normBlob(toks[0]) : "";
      if (!one || one.length < 9) return false;
    }
    return titleMatchesTokens(docTitle, toks);
  }

  /**
   * When the reader did not name an author, collapse stray same‑prefix hits
   * (e.g. another “Hero’s Guide …” by a different writer) to the most common primary author.
   */
  function refineByDominantAuthor(docs) {
    if (!docs || docs.length < 4) return docs;
    var counts = {};
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i];
      var a0 = d.author_name && d.author_name.length ? String(d.author_name[0]) : "";
      if (!a0) continue;
      counts[a0] = (counts[a0] || 0) + 1;
    }
    var best = "";
    var bestN = 0;
    for (var k in counts) {
      if (Object.prototype.hasOwnProperty.call(counts, k) && counts[k] > bestN) {
        bestN = counts[k];
        best = k;
      }
    }
    if (bestN < 3) return docs;
    if (bestN / docs.length < 0.42) return docs;
    var out = [];
    for (var j = 0; j < docs.length; j++) {
      var d2 = docs[j];
      var a1 = d2.author_name && d2.author_name.length ? String(d2.author_name[0]) : "";
      if (a1 === best) out.push(d2);
    }
    return out.length ? out : docs;
  }

  function isPublisherAuthorHint(authorStr) {
    return PUBLISHER_AUTHOR_RE.test(String(authorStr || "").trim());
  }

  function firstListedAuthor(doc) {
    var names = doc && doc.author_name;
    if (!names || !names.length) return "";
    return String(names[0] || "").trim();
  }

  /**
   * Authors who appear on ≥2 phrase hits, or alone on all phrase hits — used to
   * pull in same‑author volumes whose titles omit the series phrase (Prydain).
   */
  function collectAnchorAuthorKeys(phraseRows) {
    if (!phraseRows || !phraseRows.length) return [];
    var counts = {};
    for (var i = 0; i < phraseRows.length; i++) {
      var a0 = firstListedAuthor(phraseRows[i].doc);
      if (!a0) continue;
      var lk = a0.toLowerCase();
      counts[lk] = (counts[lk] || 0) + 1;
    }
    var keys = Object.keys(counts);
    if (!keys.length) return [];
    var mx = 0;
    for (var j = 0; j < keys.length; j++) {
      if (counts[keys[j]] > mx) mx = counts[keys[j]];
    }
    var out = [];
    for (var k = 0; k < keys.length; k++) {
      var kk = keys[k];
      if (counts[kk] >= 2 || (keys.length === 1 && counts[kk] >= 1)) out.push(kk);
    }
    return out;
  }

  /** Median first_publish_year from earliest phrase hits — guards sibling/halo from drifting centuries. */
  function medianYearFromPhraseRows(phraseRows) {
    if (!phraseRows || phraseRows.length < 2) return null;
    var pr = phraseRows.slice().sort(function (a, b) {
      return a.rank - b.rank;
    });
    var ys = [];
    for (var i = 0; i < Math.min(10, pr.length); i++) {
      var y = pr[i].doc.first_publish_year;
      if (typeof y === "number" && !isNaN(y) && y > 1200 && y < 2100) ys.push(y);
    }
    if (ys.length < 2) return null;
    ys.sort(function (a, b) {
      return a - b;
    });
    return ys[Math.floor(ys.length / 2)];
  }

  function publishYearPlausibleForSeries(doc, medY, band) {
    band = typeof band === "number" ? band : 52;
    if (medY == null) return true;
    var y = doc.first_publish_year;
    if (typeof y !== "number" || isNaN(y)) return true;
    return y >= medY - band && y <= medY + band;
  }

  function authorLikely(doc, authorNeedle) {
    var need = String(authorNeedle || "").trim().toLowerCase();
    if (!need) return true;
    var names = doc.author_name;
    if (!names || !names.length) return false;
    for (var i = 0; i < names.length; i++) {
      var a = String(names[i] || "").toLowerCase();
      if (!a) continue;
      if (a.indexOf(need) !== -1 || need.indexOf(a) !== -1) return true;
    }
    return false;
  }

  function isJunkDoc(doc) {
    var tit = String((doc && doc.title) || "");
    if (JUNK_TITLE_RE.test(tit)) return true;
    if (OMNIBUS_MULTI_RE.test(tit)) return true;
    if (isCatalogShelfNoiseTitle(tit)) return true;
    return false;
  }

  function isFamilyNoiseTitle(doc) {
    var tit = String((doc && doc.title) || "");
    return FAMILY_NOISE_TITLE_RE.test(tit);
  }

  function isCatalogShelfNoiseTitle(title) {
    return CATALOG_SHELF_NOISE_RE.test(String(title || ""));
  }

  function isMainSeriesSpinoffLine(title) {
    return /\bsuper\s+special\b|\bmixed\s+display\b|\bpowerpack\b/i.test(String(title || ""));
  }

  /**
   * Parse a 1-based volume index from a catalog binding line (#14, (2005) (1), …).
   * Prefers “(The Amazing Days of Abby Hayes, #4)” over a leading “#11” on the same line.
   * @returns {number | null}
   */
  function extractCatalogVolumeNumber(title) {
    var t = String(title || "").trim();
    if (!t) return null;
    var mInline = t.match(/\(([^()]+?),\s*#\s*0*(\d{1,3})\s*\)\s*$/i);
    if (mInline) {
      var iv = parseInt(mInline[2], 10);
      if (iv > 0 && iv < 1000) return iv;
    }
    var mYV = t.match(/\(\s*\d{4}\s*\)\s*\(\s*0*(\d{1,2})\s*\)\s*$/);
    if (mYV) {
      var yv = parseInt(mYV[1], 10);
      if (yv > 0 && yv < 100) return yv;
    }
    if (isMainSeriesSpinoffLine(t)) return null;
    var lastHash = null;
    var hashRe = /#\s*0*(\d{1,3})(?:\s*[):.\-]|$|\s)/gi;
    var hm;
    while ((hm = hashRe.exec(t)) !== null) {
      var hn = parseInt(hm[1], 10);
      if (hn > 0 && hn < 1000) lastHash = hn;
    }
    if (lastHash != null) return lastHash;
    return null;
  }

  /**
   * Pick catalog rows by volume number in the title, not by sort position in the list.
   * @param {Array<{ title: string, author: string }>} books
   * @param {number[]} wantVolumes
   * @returns {{ books: Array<{ title: string, author: string }>, missVol: number[] }}
   */
  function pickBooksForVolumeNumbers(books, wantVolumes) {
    var byVol = {};
    var parsed = 0;
    for (var i = 0; i < books.length; i++) {
      if (isMainSeriesSpinoffLine(books[i].title)) continue;
      var v = extractCatalogVolumeNumber(books[i].title);
      if (v == null) continue;
      parsed++;
      if (!byVol[v]) byVol[v] = books[i];
    }
    var chosen = [];
    var missVol = [];
    for (var wi = 0; wi < wantVolumes.length; wi++) {
      var vn = wantVolumes[wi];
      if (byVol[vn]) chosen.push(byVol[vn]);
      else missVol.push(vn);
    }
    if (!missVol.length) return { books: chosen, missVol: [] };
  /** When most hits carry #N, do not fall back to “Nth row” — that mis-assigns (Abby Hayes #11 as “book 4”). */
    if (parsed >= 3 || parsed >= books.length * 0.35) {
      return { books: chosen, missVol: missVol };
    }
    for (var wj = 0; wj < wantVolumes.length; wj++) {
      var vn2 = wantVolumes[wj];
      if (byVol[vn2]) continue;
      var ix = vn2 - 1;
      if (ix >= 0 && ix < books.length) {
        chosen.push(books[ix]);
        var mi = missVol.indexOf(vn2);
        if (mi >= 0) missVol.splice(mi, 1);
      }
    }
    chosen.sort(function (a, b) {
      var va = extractCatalogVolumeNumber(a.title);
      var vb = extractCatalogVolumeNumber(b.title);
      if (va == null || vb == null) return 0;
      return va - vb;
    });
    return { books: chosen, missVol: missVol };
  }

  /** Text before subtitle / parenthetical (first “column” of the binding line). */
  function mainTitleSegment(title) {
    var t = String(title || "").trim();
    var cut = t.split(/[:—–(\[]/)[0].trim();
    return cut || t;
  }

  /** First two words after optional “The”, for franchise clustering (Spirit Animals vs Discover Your …). */
  function twoWordLeadFromTitle(title) {
    var seg = mainTitleSegment(title)
      .replace(/^\s*the\s+/i, "")
      .trim();
    var parts = seg.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return normBlob(seg);
    if (parts.length === 1) return normBlob(parts[0]);
    return normBlob(parts[0] + " " + parts[1]);
  }

  /**
   * When the catalog returns several unrelated franchises for one vague phrase,
   * keep the single strongest franchise bucket (editions + count + search rank).
   * Skipped when the reader named an author (they already narrowed scope).
   */
  function pickDominantFranchiseCluster(picked, intent) {
    if (!picked || picked.length < 6) return picked;
    if (String((intent && intent.author) || "").trim()) return picked;

    var groups = {};
    var leads = [];
    for (var i = 0; i < picked.length; i++) {
      var d = picked[i];
      var lead = twoWordLeadFromTitle(d.title);
      if (!lead) lead = "_";
      if (!groups[lead]) {
        groups[lead] = [];
        leads.push(lead);
      }
      groups[lead].push(d);
    }
    if (leads.length < 3) return picked;

    function groupScore(arr) {
      var s = 0;
      for (var j = 0; j < arr.length; j++) {
        var ec = arr[j].edition_count;
        s += Math.log(1 + (typeof ec === "number" && ec > 0 ? ec : 0));
      }
      return s + arr.length * 0.35;
    }

    var bestLead = "";
    var bestScore = -1;
    var bestMinRank = 1e9;
    for (var k = 0; k < leads.length; k++) {
      var L = leads[k];
      var arr = groups[L];
      var sc = groupScore(arr);
      var minRank = 1e9;
      for (var m = 0; m < arr.length; m++) {
        var r = arr[m]._halalitDocRank;
        if (typeof r === "number" && r < minRank) minRank = r;
      }
      if (sc > bestScore || (sc === bestScore && minRank < bestMinRank)) {
        bestScore = sc;
        bestMinRank = minRank;
        bestLead = L;
      }
    }
    var winner = groups[bestLead] || picked;
    /** Do not keep a minority bucket when the query already names one series (multi‑author lines). */
    if (winner.length / picked.length < 0.52) return picked;
    return winner;
  }

  function yearOr(doc) {
    var y = doc.first_publish_year;
    if (typeof y === "number" && !isNaN(y)) return y;
    return 9999;
  }

  /** One slug per logical volume: ignores “The”, punctuation, hero’s vs heros, etc. */
  function volumeDedupeSlug(title, author) {
    var tb = normBlob(title);
    if (tb.indexOf("the") === 0 && tb.length > 6) tb = tb.slice(3);
    return tb + "|" + normBlob(author);
  }

  /** Drop duplicate /works/OL…W rows the API can return more than once. */
  function dedupePickedByWorkKey(arr) {
    var seen = {};
    var out = [];
    for (var z = 0; z < arr.length; z++) {
      var w = String(arr[z].key || "");
      if (!w || seen[w]) continue;
      seen[w] = true;
      out.push(arr[z]);
    }
    return out;
  }

  /**
   * Rows whose binding line is basically the series name plus a short affix
   * (“The”, “First”, “Complete”) — not a distinct volume title. Open Library
   * often lists these next to real novels; drop them when at least one real
   * volume remains.
   */
  function isShortSeriesBannerTitle(title, searchTitle) {
    var needle = seriesPhraseNeedle(searchTitle);
    if (!needle || needle.length < 8) return false;
    var mainN = normBlob(mainTitleSegment(title));
    if (mainN.indexOf(needle) === -1) return false;
    return mainN.length <= needle.length + 18;
  }

  function dropSeriesBannerDuplicates(books, searchTitle) {
    if (!books || books.length < 2) return books;
    var kept = [];
    for (var i = 0; i < books.length; i++) {
      if (!isShortSeriesBannerTitle(books[i].title, searchTitle)) kept.push(books[i]);
    }
    return kept.length ? kept : books;
  }

  var expandCache = Object.create(null);
  var EXPAND_CACHE_MAX = 56;

  function expandCacheKey(intent) {
    if (!intent) return "";
    var vols = intent.volumeNumbers;
    var volStr = Array.isArray(vols) ? vols.join(",") : "";
    return [
      String(intent.mode || ""),
      String(intent.searchTitle || ""),
      String(intent.author || ""),
      intent.firstCount != null ? String(intent.firstCount) : "",
      volStr,
    ].join("\t");
  }

  function trimExpandCache() {
    var keys = Object.keys(expandCache);
    if (keys.length <= EXPAND_CACHE_MAX) return;
    for (var ti = 0; ti < keys.length - EXPAND_CACHE_MAX; ti++) {
      delete expandCache[keys[ti]];
    }
  }

  /**
   * @param {{ mode: string, firstCount?: number, volumeNumbers?: number[], searchTitle: string, author: string }} intent
   * @returns {Promise<{ books: Array<{ title: string, author: string }>, message: string }>}
   */
  function expandIntentToBooks(intent) {
    var L = Lib();
    if (!L || !intent) {
      return Promise.resolve({ books: [], message: "" });
    }
    var cacheKey = expandCacheKey(intent);
    if (cacheKey && expandCache[cacheKey]) {
      return Promise.resolve(expandCache[cacheKey]);
    }
    var qParts = [intent.searchTitle];
    if (intent.author) qParts.push(intent.author);
    var q = qParts.join(" ").trim();
    var searchLimit = intent.mode === "volumes" ? "60" : "100";
    var url =
      "https://openlibrary.org/search.json?" +
      new URLSearchParams({ q: q, limit: searchLimit }).toString();

    var ac = new AbortController();
    var timer = global.setTimeout(function () {
      ac.abort();
    }, 14000);

    return global
      .fetch(url, { signal: ac.signal, mode: "cors" })
      .then(function (res) {
        global.clearTimeout(timer);
        if (!res.ok) throw new Error("search " + res.status);
        return res.json();
      })
      .then(function (data) {
        var docs = data.docs || [];
        var pubRelaxed = isPublisherAuthorHint(intent.author);
        var effectiveAuthor = pubRelaxed ? "" : String(intent.author || "").trim();

        var phraseRows = [];
        var minPhraseRank = null;
        for (var pi = 0; pi < docs.length; pi++) {
          var dp = docs[pi];
          if (!dp || String(dp.key || "").indexOf("/works/") !== 0) continue;
          if (isJunkDoc(dp)) continue;
          if (isFamilyNoiseTitle(dp)) continue;
          if (docTitleMatchesSeriesPhrase(dp.title, intent.searchTitle)) {
            phraseRows.push({ rank: pi, doc: dp });
            if (minPhraseRank === null || pi < minPhraseRank) minPhraseRank = pi;
          }
        }

        var seenWork = {};
        var picked = [];
        function tryAddDoc(d, rankIdx) {
          var wk = String(d.key || "");
          if (!wk || seenWork[wk]) return false;
          seenWork[wk] = true;
          d._halalitDocRank = rankIdx;
          picked.push(d);
          return true;
        }

        for (var i = 0; i < docs.length; i++) {
          var d = docs[i];
          if (!d || String(d.key || "").indexOf("/works/") !== 0) continue;
          if (isJunkDoc(d)) continue;
          if (isFamilyNoiseTitle(d)) continue;
          if (!docTitleMatchesSeriesPhrase(d.title, intent.searchTitle)) continue;
          if (!authorLikely(d, effectiveAuthor)) continue;
          tryAddDoc(d, i);
        }

        var usedHalo = false;
        /** Halo only when an early catalog row titles the series — never 0..14 without that anchor (avoids unrelated classics). */
        var phraseMedYear = medianYearFromPhraseRows(phraseRows);
        var HALO_FIRST_PHRASE_MAX = 22;
        var HALO_ABS_END = 26;
        if (minPhraseRank != null && minPhraseRank <= HALO_FIRST_PHRASE_MAX) {
          var haloStart = Math.max(0, minPhraseRank - 2);
          var haloEnd = Math.min(
            minPhraseRank + 10,
            HALO_ABS_END,
            docs.length - 1
          );
          if (haloEnd >= haloStart) {
            for (var hi = haloStart; hi <= haloEnd; hi++) {
              var dh = docs[hi];
              if (!dh || String(dh.key || "").indexOf("/works/") !== 0) continue;
              if (isJunkDoc(dh)) continue;
              if (isFamilyNoiseTitle(dh)) continue;
              if (docTitleMatchesSeriesPhrase(dh.title, intent.searchTitle)) continue;
              var ec = dh.edition_count;
              if (typeof ec !== "number" || ec < 4) continue;
              if (!authorLikely(dh, effectiveAuthor)) continue;
              if (!publishYearPlausibleForSeries(dh, phraseMedYear, 52)) continue;
              if (tryAddDoc(dh, hi)) usedHalo = true;
            }
          }
        }

        var anchorKeys = collectAnchorAuthorKeys(phraseRows);
        if (anchorKeys.length) {
          for (var si = 0; si < docs.length; si++) {
            var ds = docs[si];
            if (!ds || String(ds.key || "").indexOf("/works/") !== 0) continue;
            if (isJunkDoc(ds)) continue;
            if (isFamilyNoiseTitle(ds)) continue;
            if (docTitleMatchesSeriesPhrase(ds.title, intent.searchTitle)) continue;
            var ak = firstListedAuthor(ds).toLowerCase();
            if (!ak) continue;
            var matchA = false;
            for (var ax = 0; ax < anchorKeys.length; ax++) {
              if (ak === anchorKeys[ax]) {
                matchA = true;
                break;
              }
            }
            if (!matchA) continue;
            if (!authorLikely(ds, effectiveAuthor)) continue;
            if (!publishYearPlausibleForSeries(ds, phraseMedYear, 55)) continue;
            tryAddDoc(ds, si);
          }
        }

        var nBeforeFranchise = picked.length;
        picked = pickDominantFranchiseCluster(picked, intent);
        var franchiseTrimmed =
          typeof nBeforeFranchise === "number" &&
          picked.length < nBeforeFranchise &&
          picked.length > 0;
        if (!String(intent.author || "").trim() && !usedHalo) {
          picked = refineByDominantAuthor(picked);
        }
        picked = dedupePickedByWorkKey(picked);
        picked.sort(function (a, b) {
          return yearOr(a) - yearOr(b);
        });

        var seenVol = {};
        var books = [];
        for (var j = 0; j < picked.length; j++) {
          var p = picked[j];
          var title = String(p.title || "").trim();
          if (!title || isCatalogShelfNoiseTitle(title)) continue;
          var auth =
            p.author_name && p.author_name.length ? String(p.author_name[0]).trim() : "";
          var volSlug = volumeDedupeSlug(title, auth);
          if (seenVol[volSlug]) continue;
          seenVol[volSlug] = true;
          books.push({ title: title, author: auth });
        }

        books = dropSeriesBannerDuplicates(books, intent.searchTitle);

        var orderedTotal = books.length;
        var missVol = [];
        if (intent.mode === "first" && intent.firstCount) {
          books = books.slice(0, intent.firstCount);
        } else if (
          intent.mode === "volumes" &&
          intent.volumeNumbers &&
          intent.volumeNumbers.length
        ) {
          var pickedVol = pickBooksForVolumeNumbers(books, intent.volumeNumbers);
          books = pickedVol.books;
          missVol = pickedVol.missVol;
        }

        var msg = "";
        if (books.length === 0) {
          if (
            intent.mode === "volumes" &&
            intent.volumeNumbers &&
            intent.volumeNumbers.length &&
            orderedTotal > 0
          ) {
            msg =
              "The public catalog ordered " +
              orderedTotal +
              " volume(s) for “" +
              intent.searchTitle +
              "”, but none of the requested volumes (" +
              intent.volumeNumbers.join(", ") +
              ") fall within that list — try “" +
              intent.searchTitle +
              " series” to see the full ordered list, or add “by Author”.";
          } else {
            msg =
              "No catalog matches for “" +
              q +
              "”. Try the main book title without “series”, or add “by Author”.";
          }
        } else {
          if (intent.mode === "volumes" && intent.volumeNumbers && intent.volumeNumbers.length) {
            msg =
              "Series lookup added " +
              books.length +
              " title" +
              (books.length === 1 ? "" : "s") +
              " (volumes " +
              intent.volumeNumbers.join(", ") +
              ") from the public catalog for “" +
              intent.searchTitle +
              "”.";
            if (missVol.length) {
              msg +=
                " No row for volume " +
                missVol.join(", ") +
                " (only " +
                orderedTotal +
                " in this ordered list).";
            }
            if (franchiseTrimmed) {
              msg +=
                " Mixed catalog hits were narrowed to the strongest single franchise match (family-friendly default).";
            }
          } else {
            msg =
              "Series lookup added " +
              books.length +
              " title" +
              (books.length === 1 ? "" : "s") +
              " from the public catalog for “" +
              intent.searchTitle +
              "”.";
            if (franchiseTrimmed) {
              msg +=
                " Mixed catalog hits were narrowed to the strongest single franchise match (family-friendly default).";
            }
          }
        }
        var result = { books: books, message: msg };
        if (cacheKey) {
          expandCache[cacheKey] = result;
          trimExpandCache();
        }
        return result;
      })
      .catch(function () {
        try {
          global.clearTimeout(timer);
        } catch (e) {}
        return {
          books: [],
          message:
            "Could not reach the book catalog to expand that series line. Check your connection and try again.",
        };
      });
  }

  global.HalalitSeriesExpand = {
    parseSeriesImportIntent: parseSeriesImportIntent,
    expandIntentToBooks: expandIntentToBooks,
    extractCatalogVolumeNumber: extractCatalogVolumeNumber,
  };
})(typeof window !== "undefined" ? window : this);
