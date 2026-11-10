/**
 * Halalit — Open Library cover thumbnails (Bookcheck, Book Quest).
 */
(function (global) {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function coverUrlFromDoc(doc) {
    if (!doc) return null;
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

  function thumbHtml(url, alt) {
    if (!url) return "";
    var label = String(alt || "Book cover").trim() || "Book cover";
    return (
      '<figure class="halalit-cover-thumb">' +
      '<img class="halalit-cover-thumb__img" src="' +
      escapeHtml(url) +
      '" alt="' +
      escapeHtml(label) +
      '" width="120" height="180" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' +
      '<figcaption class="halalit-cover-thumb__cap muted">Cover from Open Library</figcaption>' +
      "</figure>"
    );
  }

  function buildSearchUrl(title, author) {
    var params = new URLSearchParams();
    params.set("limit", "10");
    params.set("fields", "key,title,author_name,cover_i,isbn,first_publish_year");
    var t = String(title || "").trim();
    var a = String(author || "").trim();
    if (t) params.set("title", t);
    if (a) params.set("author", a);
    if (!t && !a) return null;
    return "https://openlibrary.org/search.json?" + params.toString();
  }

  function buildFallbackUrl(title, author) {
    var params = new URLSearchParams();
    params.set("limit", "10");
    params.set("fields", "key,title,author_name,cover_i,isbn,first_publish_year");
    var q = [String(title || "").trim(), String(author || "").trim()].filter(Boolean).join(" ").trim();
    if (!q) return null;
    params.set("q", q);
    return "https://openlibrary.org/search.json?" + params.toString();
  }

  function normKey(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function normalizeTitle(doc) {
    var t = doc && doc.title;
    if (Array.isArray(t)) return String(t[0] || "").trim();
    return String(t || "").trim();
  }

  function pickDocWithCover(docs, title, author) {
    var list = docs && docs.length ? docs.slice() : [];
    if (!list.length) return null;
    var Pins = global.HalalitCatalogPins;
    if (Pins && typeof Pins.filterCatalogDocs === "function") {
      var pack = Pins.filterCatalogDocs(list, title, author);
      if (pack.docs && pack.docs.length) {
        for (var pi = 0; pi < pack.docs.length; pi++) {
          if (coverUrlFromDoc(pack.docs[pi])) return pack.docs[pi];
        }
      }
    }
    var qn = normKey(title);
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (!coverUrlFromDoc(d)) continue;
      var tn = normKey(normalizeTitle(d));
      var score = 0;
      if (qn && tn === qn) score = 100;
      else if (qn && (tn.indexOf(qn) !== -1 || qn.indexOf(tn) !== -1)) score = 72;
      if (author) {
        var names = d.author_name || [];
        var an = normKey(author);
        for (var j = 0; j < names.length; j++) {
          if (normKey(names[j]).indexOf(an) !== -1) score += 20;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    if (best) return best;
    for (var k = 0; k < list.length; k++) {
      if (coverUrlFromDoc(list[k])) return list[k];
    }
    return null;
  }

  /**
   * Hand-vetted display (occasion-week grid, etc.) — not blocked by Book Quest magic/substance toggles.
   */
  function shouldShowCoverThumbForHandVetted(title, author) {
    var Policy = global.HalalitFamilyShelfPolicy;
    if (!Policy) return false;
    if (typeof Policy.hardExclusionDetailForTitle === "function" && Policy.hardExclusionDetailForTitle(title, author)) {
      return false;
    }
    if (typeof Policy.noRecommendKnownFanservice === "function" && Policy.noRecommendKnownFanservice(title, author)) {
      return false;
    }
    if (typeof Policy.isHandVerifiedClean === "function" && Policy.isHandVerifiedClean(title, author)) {
      return true;
    }
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.verifiedCleanMatch === "function" && Cur.verifiedCleanMatch(title, author)) {
      return true;
    }
    return false;
  }

  var BLOCKED_COVER_TIERS = {
    flag_review: true,
    preview_caution: true,
    fanservice_caution: true,
    teen_caution: true,
    user_discretion: true,
    ai_likely_reject: true,
  };

  /** Hand-list tiers a reader may look up. Show the cover so they can tell which book it is. */
  var LOOKUP_COVER_TIERS = {
    flag_review: true,
    preview_caution: true,
    fanservice_caution: true,
    teen_caution: true,
    user_discretion: true,
  };

  /**
   * Hide the image only when the hand note says this book's own cover is immodest.
   * A later volume ("Book 4: immodest cover") does not hide the earlier books.
   * "Preview covers" (bare knees, short tutus) still shows the image.
   */
  function lineHidesCoverImage(line) {
    var s = String(line || "");
    if (/cover to cover/i.test(s)) return false;
    if (/preview covers/i.test(s) && !/immodest/i.test(s)) return false;
    if (/immodesty fanservice on cover|fanservice on cover art/i.test(s)) return true;
    if (/immodest cover imagery/i.test(s)) return true;
    if (/immodest cover/i.test(s) && !/\bbook\s+\d+\b/i.test(s)) return true;
    if (/cover focuses on/i.test(s) && /clothes/i.test(s)) return true;
    return false;
  }

  function detailHidesCoverImage(detail) {
    var parts = String(detail || "").split(/\n+/);
    for (var i = 0; i < parts.length; i++) {
      if (lineHidesCoverImage(parts[i])) return true;
    }
    return false;
  }

  function handVetForCover(title, author) {
    var VS = global.HalalitBookcheckVetSource;
    if (!VS || typeof VS.resolveHandVetHint !== "function") return null;
    return VS.resolveHandVetHint(title, author);
  }

  /**
   * Bookcheck lookup may show a cover for a discretion or hard-reject title
   * unless that cover itself is immodest. Book Wander still uses
   * shouldShowCoverThumbForHandVetted, which stays on hand-checked clean books.
   * @param {string} title
   * @param {string} author
   * @param {string|null} [catalogHintTier]
   * @param {object|null} [shelfOpts] — same opts as isEligibleForFamilyShelf (Book Quest prefs, etc.)
   */
  function shouldShowCoverThumb(title, author, catalogHintTier, shelfOpts) {
    var hand = handVetForCover(title, author);
    if (hand && detailHidesCoverImage(hand.detail)) return false;
    var handTier = hand && hand.tier;
    if (LOOKUP_COVER_TIERS[handTier]) return true;
    if (!hand && LOOKUP_COVER_TIERS[catalogHintTier]) return true;

    var Policy = global.HalalitFamilyShelfPolicy;
    if (!Policy || typeof Policy.isEligibleForFamilyShelf !== "function") return false;
    if (typeof Policy.hardExclusionDetailForTitle === "function" && Policy.hardExclusionDetailForTitle(title, author)) {
      return false;
    }
    var tier = catalogHintTier || "";
    if (BLOCKED_COVER_TIERS[tier]) return false;
    if (hand && BLOCKED_COVER_TIERS[hand.tier]) return false;
    if (typeof Policy.noRecommendKnownFanservice === "function" && Policy.noRecommendKnownFanservice(title, author)) {
      return false;
    }
    return Policy.isEligibleForFamilyShelf(title, author, tier || null, shelfOpts || null);
  }

  function fetchCoverDoc(title, author, fetchOpts) {
    fetchOpts = fetchOpts || {};
    if (
      fetchOpts.requireEligible !== false &&
      !shouldShowCoverThumb(title, author, fetchOpts.catalogHintTier || null, fetchOpts.shelfOpts || null)
    ) {
      return Promise.resolve(null);
    }
    if (!global.fetch) return Promise.resolve(null);
    var url = buildSearchUrl(title, author);
    if (!url) return Promise.resolve(null);
    return global
      .fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("cover search failed");
        return res.json();
      })
      .then(function (data) {
        var docs = (data && data.docs) || [];
        var picked = pickDocWithCover(docs, title, author);
        if (picked) return picked;
        var fallback = buildFallbackUrl(title, author);
        if (!fallback) return null;
        return global
          .fetch(fallback)
          .then(function (res2) {
            if (!res2.ok) return null;
            return res2.json();
          })
          .then(function (data2) {
            return pickDocWithCover((data2 && data2.docs) || [], title, author);
          });
      })
      .catch(function () {
        return null;
      });
  }

  global.HalalitCoverThumb = {
    coverUrlFromDoc: coverUrlFromDoc,
    thumbHtml: thumbHtml,
    shouldShowCoverThumb: shouldShowCoverThumb,
    shouldShowCoverThumbForHandVetted: shouldShowCoverThumbForHandVetted,
    fetchCoverDoc: fetchCoverDoc,
  };
})(typeof window !== "undefined" ? window : globalThis);
