/**
 * Halalit — optional Open Library enrichment for Personal Library spines:
 * fills missing author when the catalog agrees, derives a soft spine palette
 * from the dominant patch of the cover thumbnail (never overwrites a user author),
 * and estimates spine thickness/height from edition page-count medians (automatic).
 */
(function (global) {
  var doc = global.document;

  function sleep(ms) {
    return new Promise(function (resolve) {
      global.setTimeout(resolve, ms);
    });
  }

  function normTitle(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function docTitle(doc) {
    var t = doc.title;
    if (Array.isArray(t)) return String(t[0] || "");
    return String(t || "");
  }

  function titleScore(query, candidateTitle) {
    var q = normTitle(query);
    var c = normTitle(candidateTitle);
    if (!q || !c) return 0;
    if (c === q) return 100;
    if (c.indexOf(q) !== -1 || q.indexOf(c) !== -1) return 88;
    var qt = q.split(" ").filter(Boolean);
    var cs = {};
    var ct = c.split(" ").filter(Boolean);
    for (var i = 0; i < ct.length; i++) cs[ct[i]] = true;
    var inter = 0;
    for (var j = 0; j < qt.length; j++) if (cs[qt[j]]) inter++;
    if (qt.length === 0) return 0;
    return (inter / qt.length) * 72;
  }

  function pickBestDoc(docs, queryTitle) {
    if (!docs || !docs.length) return null;
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i];
      var sc = titleScore(queryTitle, docTitle(d)) + (1 - i / (docs.length + 4)) * 3;
      if (sc > bestScore) {
        bestScore = sc;
        best = d;
      }
    }
    if (bestScore < 22) return null;
    return best;
  }

  function coverUrlFromDoc(doc) {
    if (doc.cover_i != null && doc.cover_i === doc.cover_i) {
      return "https://covers.openlibrary.org/b/id/" + String(doc.cover_i) + "-M.jpg";
    }
    var isbns = doc.isbn;
    if (!isbns || !isbns.length) return null;
    for (var i = 0; i < isbns.length; i++) {
      var isbn = String(isbns[i]).replace(/[^0-9Xx]/g, "");
      if (isbn.length === 10 || isbn.length === 13) {
        return "https://covers.openlibrary.org/b/isbn/" + isbn + "-M.jpg";
      }
    }
    return null;
  }

  var JUNK_EDITION_TITLE_RE =
    /journal|notebook|calendar|bookmark|poster|boxed|box\s*set|slipcase|ruler|coloring|film|movie|screenplay|study guide|\bteacher\b|\bworkbook\b/i;
  var SKIP_PHYSICAL_FORMAT_RE = /\bebook\b|\bkindle\b|digital(?:\s+edition)?|epub/i;

  function editionPagesFromEntry(e) {
    var n = e && e.number_of_pages;
    if (typeof n === "number" && !isNaN(n) && n >= 16 && n <= 2400) return Math.round(n);
    var p = e && e.pagination;
    if (typeof p === "string") {
      var m = p.match(/(\d{2,4})\s*p(?:ages?)?\b/i);
      if (m) {
        var v = parseInt(m[1], 10);
        if (!isNaN(v) && v >= 16 && v <= 2400) return v;
      }
      var m2 = p.match(/(\d{2,4})\s*pages?\b/i);
      if (m2) {
        var v2 = parseInt(m2[1], 10);
        if (!isNaN(v2) && v2 >= 16 && v2 <= 2400) return v2;
      }
    }
    return null;
  }

  function editionIsEnglish(e) {
    var langs = e && e.languages;
    if (!langs || !langs.length) return false;
    for (var i = 0; i < langs.length; i++) {
      var L = langs[i];
      var k = typeof L === "object" && L ? L.key : "";
      if (String(k).indexOf("/languages/eng") !== -1) return true;
    }
    return false;
  }

  function medianInts(arr) {
    if (!arr.length) return null;
    var s = arr.slice().sort(function (a, b2) {
      return a - b2;
    });
    return s[Math.floor(s.length / 2)];
  }

  /**
   * Robust page estimate from a work's editions (Open Library): median count,
   * prefers English-language editions when enough samples exist.
   */
  async function fetchEditionPageMedian(workKey) {
    var path = String(workKey || "");
    if (path.indexOf("/works/") !== 0) return null;
    var url = "https://openlibrary.org" + path + "/editions.json?limit=40";

    var ac = new AbortController();
    var timer = global.setTimeout(function () {
      ac.abort();
    }, 4500);

    try {
      var res = await global.fetch(url, { signal: ac.signal, mode: "cors" });
      global.clearTimeout(timer);
      if (!res.ok) return null;
      var data = await res.json();
      var entries = data.entries || [];
      var all = [];
      var eng = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var tit = String((e && e.title) || "");
        if (JUNK_EDITION_TITLE_RE.test(tit)) continue;
        var pf = String((e && e.physical_format) || "");
        if (SKIP_PHYSICAL_FORMAT_RE.test(pf)) continue;
        var np = editionPagesFromEntry(e);
        if (np == null) continue;
        all.push(np);
        if (editionIsEnglish(e)) eng.push(np);
      }
      if (eng.length >= 3) return medianInts(eng);
      return medianInts(all);
    } catch (e2) {
      try {
        global.clearTimeout(timer);
      } catch (e3) {}
      return null;
    }
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var h = 0;
    var s = 0;
    var l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        default:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  /**
   * Dominant RGB from cover art: widest similar-color region (coarse buckets),
   * not a muddy average across title art + borders. Prefers colorful fields over
   * near-white bleed when a strong second-place exists.
   */
  function dominantRgbFromImageData(ctx2, cw, ch) {
    var marginX = Math.floor(cw * 0.10);
    var marginY = Math.floor(ch * 0.10);
    var cx = (cw - 1) / 2;
    var cy = (ch - 1) / 2;
    var maxR = Math.max(1, cw - marginX * 2 - 1);
    var imgd = ctx2.getImageData(0, 0, cw, ch);
    var d = imgd.data;
    var NB = 4096;
    var binsC = new Array(NB);
    var binsR = new Array(NB);
    var binsG = new Array(NB);
    var binsB = new Array(NB);
    for (var z = 0; z < NB; z++) {
      binsC[z] = binsR[z] = binsG[z] = binsB[z] = 0;
    }
    var totalW = 0;
    for (var y = marginY; y < ch - marginY; y++) {
      for (var x = marginX; x < cw - marginX; x++) {
        var o = (y * cw + x) * 4;
        if (d[o + 3] < 28) continue;
        var rdx = (x - cx) / maxR;
        var rdy = (y - cy) / Math.max(1, (ch - marginY * 2) / 2);
        var w = 1 + 0.45 * Math.max(0, 1 - Math.sqrt(rdx * rdx + rdy * rdy) * 1.15);
        var rq = d[o] >> 4;
        var gq = d[o + 1] >> 4;
        var bq = d[o + 2] >> 4;
        var ix = ((rq << 8) | (gq << 4) | bq) % NB;
        var wi = Math.round(w * 1000);
        binsC[ix] += wi;
        binsR[ix] += d[o] * wi;
        binsG[ix] += d[o + 1] * wi;
        binsB[ix] += d[o + 2] * wi;
        totalW += wi;
      }
    }
    if (totalW < 2000) return null;

    var scores = [];
    for (var b = 0; b < NB; b++) {
      if (binsC[b] < 1200) continue;
      var br = binsR[b] / binsC[b];
      var bg = binsG[b] / binsC[b];
      var bb = binsB[b] / binsC[b];
      var hsl = rgbToHsl(br, bg, bb);
      scores.push({ ix: b, w: binsC[b], hsl: hsl, r: br, g: bg, b: bb });
    }
    scores.sort(function (a, b2) {
      return b2.w - a.w;
    });

    function pickAcceptable(ranked) {
      if (!ranked || !ranked.length) return null;
      for (var k = 0; k < ranked.length && k < 8; k++) {
        var u = ranked[k];
        var s = u.hsl.s;
        var lt = u.hsl.l;
        if (lt > 93 && s < 18) continue;
        if (lt < 5 && s < 12) continue;
        return u;
      }
      return ranked[0];
    }

    var best = pickAcceptable(scores);
    if (!best) return null;

    /* If champion is bland paper/sky while a sizable second-place is colorful, prefer that. */
    var top = scores[0];
    if (scores.length >= 2) {
      var tS = top.hsl.s;
      var tL = top.hsl.l;
      if ((tS < 14 && (tL > 82 || tL < 12)) || tL > 93) {
        var second = scores[1];
        if (second.w >= top.w * 0.38 && second.hsl.s > tS + 8) {
          var alt = pickAcceptable(scores.slice(1));
          if (alt) best = alt;
        }
      }
    }

    return { r: best.r, g: best.g, b: best.b };
  }

  function sampleCoverHsl(url) {
    return new Promise(function (resolve, reject) {
      var img = new global.Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        try {
          var c = doc.createElement("canvas");
          var cw = 56;
          var ch = Math.max(76, Math.round((img.naturalHeight / Math.max(1, img.naturalWidth)) * cw));
          if (ch > 120) ch = 120;
          c.width = cw;
          c.height = ch;
          var ctx2 = c.getContext("2d");
          if (!ctx2) {
            reject(new Error("no_ctx"));
            return;
          }
          ctx2.drawImage(img, 0, 0, cw, ch);
          var dom = dominantRgbFromImageData(ctx2, cw, ch);
          if (!dom) {
            reject(new Error("sparse"));
            return;
          }
          resolve(rgbToHsl(dom.r, dom.g, dom.b));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = function () {
        reject(new Error("img"));
      };
      img.src = url;
    });
  }

  function spineMetrics(ctx, book, shelfIdx) {
    // Salt by storage index so spine proportions stay stable when rows reflow by width.
    var salt = shelfIdx;
    var w = ctx.spineWidthFor(book, salt);
    var h = ctx.spineHeightFor(book, salt);
    if (ctx.spine && typeof ctx.spine.recommendedSpineHeightPixels === "function") {
      var need = ctx.spine.recommendedSpineHeightPixels(book);
      if (need > 0) h = Math.max(h, need);
    }
    return { w: w, h: h };
  }

  function shouldDeferShelfVisuals(ctx) {
    return typeof ctx.deferShelfVisuals === "function" && ctx.deferShelfVisuals();
  }

  function markLayoutReflowPending(ctx) {
    if (!ctx) return;
    ctx._layoutReflowPending = true;
    scheduleLayoutReflow(ctx);
  }

  /** One batched full-shelf reflow (after enrich batch), not per spine. */
  function scheduleLayoutReflow(ctx) {
    if (!ctx || typeof ctx.isStale !== "function" || ctx.isStale()) return;
    if (ctx._layoutReflowTimer) return;
    ctx._layoutReflowTimer = global.setTimeout(function () {
      ctx._layoutReflowTimer = null;
      if (shouldDeferShelfVisuals(ctx)) {
        scheduleLayoutReflow(ctx);
        return;
      }
      flushShelfVisualUpdates(ctx);
    }, 360);
  }

  function spineWidthPx(el) {
    if (!el) return 0;
    var raw = el.style.getPropertyValue("--spine-w");
    if (raw) {
      var n = parseFloat(String(raw).replace(/px$/i, ""));
      if (!isNaN(n) && n > 0) return n;
    }
    return el.offsetWidth || 0;
  }

  function replaceSpineElNow(ctx, shelfIdx, book) {
    if (!ctx || (typeof ctx.isStale === "function" && ctx.isStale())) return false;
    var stage = ctx.stage;
    var spineApi = ctx.spine;
    var tag = ctx.spineHtmlTaggedWithIndex;
    if (
      !stage ||
      !spineApi ||
      typeof spineApi.buildSpineHtml !== "function" ||
      typeof tag !== "function"
    ) {
      return false;
    }
    var existing = stage.querySelector('[data-halalit-index="' + String(shelfIdx) + '"]');
    if (!existing) return false;
    var m = spineMetrics(ctx, book, shelfIdx);
    var oldW = spineWidthPx(existing);
    var html = tag(spineApi.buildSpineHtml(book, m.w, m.h), shelfIdx);
    var wrap = doc.createElement("div");
    wrap.innerHTML = html;
    var neu = wrap.firstElementChild;
    if (!neu) return false;
    existing.replaceWith(neu);
    if (Math.abs(m.w - oldW) > 2) ctx._layoutReflowPending = true;
    return true;
  }

  function queueSpineUpdate(ctx, shelfIdx, book) {
    if (!ctx._deferredSpines) ctx._deferredSpines = Object.create(null);
    ctx._deferredSpines[shelfIdx] = book;
  }

  function flushShelfVisualUpdates(ctx) {
    if (!ctx || (typeof ctx.isStale === "function" && ctx.isStale())) return;
    if (shouldDeferShelfVisuals(ctx)) {
      scheduleLayoutReflow(ctx);
      return;
    }
    if (ctx._deferredSpines) {
      var pending = ctx._deferredSpines;
      ctx._deferredSpines = null;
      var keys = Object.keys(pending);
      for (var i = 0; i < keys.length; i++) {
        var idx = parseInt(keys[i], 10);
        if (!isNaN(idx) && pending[keys[i]]) replaceSpineElNow(ctx, idx, pending[keys[i]]);
      }
    }
    if (!ctx._layoutReflowPending) return;
    ctx._layoutReflowPending = false;
    if (typeof ctx.refreshShelf === "function") {
      try {
        ctx.refreshShelf();
      } catch (eRf) {}
    }
  }

  /** Swap one spine in place; defer while the reader is scrolling; batch row reflow. */
  function replaceSpineEl(ctx, shelfIdx, book) {
    if (!ctx || (typeof ctx.isStale === "function" && ctx.isStale())) return;
    if (shouldDeferShelfVisuals(ctx)) {
      queueSpineUpdate(ctx, shelfIdx, book);
      return;
    }
    if (!replaceSpineElNow(ctx, shelfIdx, book)) markLayoutReflowPending(ctx);
    else if (ctx._layoutReflowPending) scheduleLayoutReflow(ctx);
  }

  function resolveQueryTitle(book, lib) {
    var t = String(book.title || "").trim();
    if (t) return t;
    if (lib && typeof lib.parseTitlePlain === "function") {
      var p = lib.parseTitlePlain(book.titlePlain || "");
      if (p.title) return p.title;
    }
    return "";
  }

  function hasCoverRgb(book) {
    return (
      typeof book.olCoverH === "number" &&
      book.olCoverH === book.olCoverH &&
      typeof book.olCoverS === "number" &&
      book.olCoverS === book.olCoverS &&
      typeof book.olCoverL === "number" &&
      book.olCoverL === book.olCoverL
    );
  }

  async function fetchOpenLibraryDoc(book, lib) {
    var qTitle = resolveQueryTitle(book, lib);
    if (!qTitle) return null;

    var authorHint = String(book.author || "").trim();
    var url =
      "https://openlibrary.org/search.json?limit=12&fields=key,title,author_name,subject,first_publish_year,cover_i,isbn&title=" +
      encodeURIComponent(qTitle) +
      (authorHint ? "&author=" + encodeURIComponent(authorHint) : "");

    var ac = new AbortController();
    var timer = global.setTimeout(function () {
      ac.abort();
    }, 6000);

    try {
      var res = await global.fetch(url, { signal: ac.signal, mode: "cors" });
      global.clearTimeout(timer);
      if (!res.ok) return null;
      var data = await res.json();
      var docs = data.docs || [];
      var Pins = global.HalalitCatalogPins;
      if (Pins && typeof Pins.filterCatalogDocs === "function") {
        var pinPack = Pins.filterCatalogDocs(docs, qTitle, authorHint);
        docs = pinPack.docs || docs;
      }
      return pickBestDoc(docs, qTitle);
    } catch (e) {
      try {
        global.clearTimeout(timer);
      } catch (e2) {}
      return null;
    }
  }

  async function enrichIndex(ctx, index) {
    var lib = ctx.lib;
    if (!lib || typeof lib.load !== "function" || typeof lib.patchBookAt !== "function") return;
    var book = lib.load()[index];
    if (!book || book.olLookupDone) return;

    var qTitle = resolveQueryTitle(book, lib);
    if (!qTitle) {
      lib.patchBookAt(index, { olLookupDone: true, olLookupOk: false, olPagesEditionLookupDone: true });
      return;
    }

    var authorHint = String(book.author || "").trim();

    try {
      var doc = await fetchOpenLibraryDoc(book, lib);
      if (!doc) {
        lib.patchBookAt(index, { olLookupDone: true, olLookupOk: false, olPagesEditionLookupDone: true });
        return;
      }

      var patch = { olLookupDone: true, olLookupOk: true };
      var names = doc.author_name;
      if (!authorHint && names && names.length) {
        patch.author = String(names[0]);
      }
      if (doc.subject && doc.subject.length) {
        patch.olSubjects = doc.subject.slice(0, 48);
      }
      if (doc.first_publish_year != null && doc.first_publish_year === doc.first_publish_year) {
        patch.olFirstPublishYear = parseInt(String(doc.first_publish_year), 10);
      }

      var coverUrl = coverUrlFromDoc(doc);
      if (coverUrl) patch.olCoverUrl = coverUrl;

      var hsl = null;
      if (coverUrl) {
        patch.olDominantResampled = true;
        try {
          hsl = await sampleCoverHsl(coverUrl);
          if (hsl && hsl.h === hsl.h) {
            patch.olCoverH = hsl.h;
            patch.olCoverS = hsl.s;
            patch.olCoverL = hsl.l;
            patch.olCoverFailCount = 0;
          }
        } catch (e1) {
          patch.olCoverFailCount = (book.olCoverFailCount || 0) + 1;
        }
      }

      var wk = doc.key;
      if (wk && String(wk).indexOf("/works/") === 0) {
        patch.olWorkKey = wk;
        try {
          var med = await fetchEditionPageMedian(wk);
          if (typeof med === "number" && isFinite(med)) {
            patch.olPagesMedian = Math.round(med);
          }
        } catch (eMed) {}
      }
      patch.olPagesEditionLookupDone = true;

      lib.patchBookAt(index, patch);
      var fresh = lib.load()[index];
      replaceSpineEl(ctx, index, fresh);
    } catch (e) {}
  }

  async function enrichCoverFromStoredUrl(ctx, index) {
    var lib = ctx.lib;
    if (!lib || typeof lib.load !== "function" || typeof lib.patchBookAt !== "function") return;
    var book = lib.load()[index];
    if (!book || !book.olCoverUrl || hasCoverRgb(book)) return;
    if ((book.olCoverFailCount || 0) >= 5) return;

    try {
      var hsl = await sampleCoverHsl(String(book.olCoverUrl));
      if (hsl && hsl.h === hsl.h) {
        lib.patchBookAt(index, {
          olCoverH: hsl.h,
          olCoverS: hsl.s,
          olCoverL: hsl.l,
          olCoverFailCount: 0,
          olDominantResampled: true,
        });
        replaceSpineEl(ctx, index, lib.load()[index]);
      }
    } catch (e) {
      lib.patchBookAt(index, { olCoverFailCount: (book.olCoverFailCount || 0) + 1 });
    }
  }

  /** Older saves have no olCoverUrl; one more catalogue hit can attach a cover link. */
  async function enrichRecoverCoverUrl(ctx, index) {
    var lib = ctx.lib;
    if (!lib || typeof lib.load !== "function" || typeof lib.patchBookAt !== "function") return;
    var book = lib.load()[index];
    if (
      !book ||
      !book.olLookupDone ||
      !book.olLookupOk ||
      book.olCoverUrl ||
      hasCoverRgb(book) ||
      (book.olRecoverAttempts || 0) >= 3
    ) {
      return;
    }

    var doc = await fetchOpenLibraryDoc(book, lib);
    lib.patchBookAt(index, { olRecoverAttempts: (book.olRecoverAttempts || 0) + 1 });
    book = lib.load()[index];
    if (!doc) return;

    var coverUrl = coverUrlFromDoc(doc);
    if (!coverUrl) return;

    var patch = { olCoverUrl: coverUrl, olDominantResampled: true };
    if ((!book.olWorkKey || String(book.olWorkKey).indexOf("/works/") !== 0) && doc.key && String(doc.key).indexOf("/works/") === 0) {
      patch.olWorkKey = doc.key;
    }
    try {
      var hsl = await sampleCoverHsl(coverUrl);
      if (hsl && hsl.h === hsl.h) {
        patch.olCoverH = hsl.h;
        patch.olCoverS = hsl.s;
        patch.olCoverL = hsl.l;
        patch.olCoverFailCount = 0;
      }
    } catch (e1) {
      patch.olCoverFailCount = (book.olCoverFailCount || 0) + 1;
    }
    lib.patchBookAt(index, patch);
    replaceSpineEl(ctx, index, lib.load()[index]);
  }

  /** Backfill spine page estimates for saves from before automatic sizing. */
  async function enrichSubjectsBackfill(ctx, index) {
    var lib = ctx.lib;
    if (!lib || typeof lib.load !== "function" || typeof lib.patchBookAt !== "function") return;
    var book = lib.load()[index];
    if (!book || !book.olLookupOk || (book.olSubjects && book.olSubjects.length)) return;

    var doc = await fetchOpenLibraryDoc(book, lib);
    if (!doc) {
      lib.patchBookAt(index, { olSubjects: [], olSubjectsBackfillDone: true });
      return;
    }
    var patch = { olSubjectsBackfillDone: true };
    if (doc.subject && doc.subject.length) patch.olSubjects = doc.subject.slice(0, 48);
    if (doc.first_publish_year != null && doc.first_publish_year === doc.first_publish_year) {
      patch.olFirstPublishYear = parseInt(String(doc.first_publish_year), 10);
    }
    lib.patchBookAt(index, patch);
  }

  async function enrichPagesOnly(ctx, index) {
    var lib = ctx.lib;
    if (!lib || typeof lib.load !== "function" || typeof lib.patchBookAt !== "function") return;
    var book = lib.load()[index];
    if (!book || !book.olLookupOk || book.olPagesEditionLookupDone) return;

    var patch = { olPagesEditionLookupDone: true };

    try {
      var wk = book.olWorkKey;
      if (!wk || String(wk).indexOf("/works/") !== 0) {
        var docR = await fetchOpenLibraryDoc(book, lib);
        if (docR && docR.key && String(docR.key).indexOf("/works/") === 0) {
          wk = docR.key;
          patch.olWorkKey = wk;
        }
      }
      if (wk && String(wk).indexOf("/works/") === 0) {
        var med2 = await fetchEditionPageMedian(wk);
        if (typeof med2 === "number" && isFinite(med2)) {
          patch.olPagesMedian = Math.round(med2);
        }
      }
    } catch (ePo) {}

    lib.patchBookAt(index, patch);
    replaceSpineEl(ctx, index, lib.load()[index]);
  }

  async function processNextBook(ctx) {
    var lib = ctx.lib;
    if (!lib || typeof lib.load !== "function") return false;
    var list = lib.load();
    var n = list.length;
    var i;
    for (i = 0; i < n; i++) {
      if (!list[i].olLookupDone) {
        await enrichIndex(ctx, i);
        return true;
      }
    }
    for (i = 0; i < n; i++) {
      var bSub = list[i];
      if (
        bSub &&
        bSub.olLookupOk &&
        !bSub.olSubjectsBackfillDone &&
        (!bSub.olSubjects || !bSub.olSubjects.length)
      ) {
        await enrichSubjectsBackfill(ctx, i);
        return true;
      }
    }
    for (i = 0; i < n; i++) {
      var b0 = list[i];
      if (!b0.olLookupOk || b0.olPagesEditionLookupDone) continue;
      await enrichPagesOnly(ctx, i);
      return true;
    }
    for (i = 0; i < n; i++) {
      var b = list[i];
      if (!b.olCoverUrl || hasCoverRgb(b)) continue;
      if ((b.olCoverFailCount || 0) >= 5) continue;
      await enrichCoverFromStoredUrl(ctx, i);
      return true;
    }
    for (i = 0; i < n; i++) {
      var b2 = list[i];
      if (
        !b2.olLookupDone ||
        !b2.olLookupOk ||
        b2.olCoverUrl ||
        hasCoverRgb(b2) ||
        (b2.olRecoverAttempts || 0) >= 3
      )
        continue;
      await enrichRecoverCoverUrl(ctx, i);
      return true;
    }
    for (i = 0; i < n; i++) {
      if (await tryRecoverStale(ctx, i)) return true;
    }
    return false;
  }

  /**
   * Re-sample when we already have color from the old muddy average — dominant pass is sharper.
   */
  async function tryRecoverStale(ctx, index) {
    var lib = ctx.lib;
    if (!lib || !lib.load) return false;
    var book = lib.load()[index];
    if (!book || !book.olCoverUrl || !hasCoverRgb(book)) return false;
    if (book.olDominantResampled) return false;

    try {
      var hsl = await sampleCoverHsl(String(book.olCoverUrl));
      if (hsl && hsl.h === hsl.h) {
        lib.patchBookAt(index, {
          olCoverH: hsl.h,
          olCoverS: hsl.s,
          olCoverL: hsl.l,
          olDominantResampled: true,
        });
        replaceSpineEl(ctx, index, lib.load()[index]);
        return true;
      }
    } catch (e) {}
    lib.patchBookAt(index, { olDominantResampled: true });
    return false;
  }

  async function runQueue(ctx) {
    if (global.navigator && global.navigator.onLine === false) return;
    var lib = ctx.lib;
    if (!lib || typeof lib.load !== "function") return;
    var cap = typeof ctx.maxBooksPerVisit === "number" ? ctx.maxBooksPerVisit : 320;
    var drained = false;
    for (var step = 0; step < cap; step++) {
      if (ctx.isStale()) return;
      if (shouldDeferShelfVisuals(ctx)) {
        global.setTimeout(function () {
          if (!ctx.isStale()) runQueue(ctx).catch(function () {});
        }, 300);
        return;
      }
      var did = await processNextBook(ctx);
      if (!did) {
        drained = true;
        break;
      }
      if (ctx.delayMs > 0) await sleep(ctx.delayMs);
    }
    flushShelfVisualUpdates(ctx);
    if (drained && typeof ctx.onQueueDrained === "function") {
      try {
        ctx.onQueueDrained();
      } catch (eDrain) {}
    }
  }

  /**
   * Fire-and-forget queue after shelf paint (debounced by caller generation).
   * @param {{
   *   stage: HTMLElement,
   *   lib: object,
   *   spine: object,
   *   shelfPerRow: number (legacy; spine sizing uses shelf index, not grid position),
   *   spineWidthFor: function,
   *   spineHeightFor: function,
   *   spineHtmlTaggedWithIndex: function,
   *   isStale: function(): boolean,
   *   delayMs?: number,
   *   maxBooksPerVisit?: number
   * }} ctx
   */
  function runAfterLibraryRender(ctx) {
    if (!ctx || !ctx.stage || !ctx.lib || !ctx.spine) return;
    if (typeof ctx.isStale !== "function") return;
    if (ctx.stage.closest && ctx.stage.closest("[hidden]")) return;
    if (global.document && global.document.visibilityState === "hidden") return;
    var delayMs = typeof ctx.delayMs === "number" ? ctx.delayMs : 200;
    var wrapped = Object.assign({}, ctx, { delayMs: delayMs });
    var startDelay =
      typeof ctx.startDelayMs === "number" && ctx.startDelayMs >= 0 ? ctx.startDelayMs : 450;
    global.setTimeout(function () {
      if (wrapped.isStale()) return;
      if (wrapped.stage.closest && wrapped.stage.closest("[hidden]")) return;
      if (global.document && global.document.visibilityState === "hidden") return;
      runQueue(wrapped).catch(function () {});
    }, startDelay);
  }

  global.HalalitOpenLibraryEnrich = {
    runAfterLibraryRender: runAfterLibraryRender,
    flushPendingVisuals: flushShelfVisualUpdates,
  };
})(typeof window !== "undefined" ? window : this);
