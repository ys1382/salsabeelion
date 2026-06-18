/**
 * Halalit — Bookcheck: parents look up a title against family-shelf recommendation rules.
 */
(function (global) {
  var LEGACY_SKIP_KEYS = [
    "halalit_bookcheck_skip_deity_comfort",
    "halalit_bookcheck_skip_family_community",
    "halalit_bookcheck_skip_light_romance",
    "halalit_bookcheck_skip_magic",
    "halalit_bookcheck_skip_substance",
  ];

  var GRAPHIC_FORMAT_RE =
    /\bcomic books?\b|\bgraphic novels?\b|\bgraphic books?\b|\bmanga\b|\bcomics\b|\bgraphic fiction\b|\bsketchbooks?\b|\bart books?\b/i;
  var YOUTH_CATALOG_RE =
    /juvenile fiction|juvenile works|juvenile literature|children'?s fiction|children'?s stories|young readers|picture books/i;

  var bookcheckPanels = {};

  var DEFAULT_BOOKCHECK_IDS = {
    title: "bookcheckTitle",
    author: "bookcheckAuthor",
    lookup: "bookcheckLookup",
    status: "bookcheckLookupStatus",
    matchBox: "bookcheckMatchBox",
    matchLead: "bookcheckMatchLead",
    matchList: "bookcheckMatchList",
    verdict: "bookcheckVerdict",
    seriesNote: "bookcheckSeriesNote",
    wikiNote: "bookcheckWikiNote",
    wikidataNote: "bookcheckWikidataNote",
  };

  function bookcheckEl(panel, ids, key) {
    var id = (ids && ids[key]) || DEFAULT_BOOKCHECK_IDS[key];
    return id ? panel.querySelector("#" + id) : null;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  /** Multi-line curated notes: first line title, following lines become a short list. */
  function formatNoteHtml(text) {
    var raw = String(text || "").trim();
    if (!raw) return "";
    var lines = raw
      .split(/\n+/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
    if (lines.length <= 1) return escapeHtml(raw);
    var html = '<div class="bookcheck-note-block">';
    html += '<p class="bookcheck-note-title">' + escapeHtml(lines[0]) + "</p>";
    html += '<ul class="bookcheck-note-lines">';
    for (var i = 1; i < lines.length; i++) {
      html += "<li>" + escapeHtml(lines[i]) + "</li>";
    }
    return html + "</ul></div>";
  }

  function normalizeOlTitle(doc) {
    var t = doc && doc.title;
    if (Array.isArray(t)) return String(t[0] || "").trim();
    return String(t || "").trim();
  }

  function normKey(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function authorsFromDoc(doc) {
    return Array.isArray(doc && doc.author_name) && doc.author_name.length ? doc.author_name : [];
  }

  function authorLine(doc) {
    var names = authorsFromDoc(doc);
    return names.length ? names.join(", ") : "";
  }

  function authorScore(queryAuthor, doc) {
    var q = normKey(queryAuthor);
    if (!q) return 0;
    var names = authorsFromDoc(doc);
    if (!names.length) return 0;
    var best = 0;
    for (var i = 0; i < names.length; i++) {
      var a = normKey(names[i]);
      if (!a) continue;
      if (a === q) best = Math.max(best, 100);
      else if (a.indexOf(q) !== -1 || q.indexOf(a) !== -1) best = Math.max(best, 88);
      else {
        var qt = q.split(" ").filter(Boolean);
        var at = a.split(" ").filter(Boolean);
        var as = {};
        for (var j = 0; j < at.length; j++) as[at[j]] = true;
        var inter = 0;
        for (var k = 0; k < qt.length; k++) if (as[qt[k]]) inter++;
        if (qt.length) best = Math.max(best, (inter / qt.length) * 72);
      }
    }
    return best;
  }

  function titleScore(queryTitle, candidateTitle) {
    var q = normKey(queryTitle);
    var c = normKey(candidateTitle);
    if (!q || !c) return 0;
    if (c === q) return 100;
    if (c.indexOf(q) !== -1 || q.indexOf(c) !== -1) return 88;
    var qt = q.split(" ").filter(Boolean);
    var cs = {};
    var ct = c.split(" ").filter(Boolean);
    for (var i = 0; i < ct.length; i++) cs[ct[i]] = true;
    var inter = 0;
    for (var j = 0; j < qt.length; j++) if (cs[qt[j]]) inter++;
    if (!qt.length) return 0;
    return (inter / qt.length) * 72;
  }

  /** Prefer rows with subject tags (family-shelf heuristics need them). */
  function subjectRichness(doc) {
    var n = 0;
    if (doc && doc.subject_facet && doc.subject_facet.length) n = doc.subject_facet.length;
    else if (doc && doc.subject && doc.subject.length) n = doc.subject.length;
    return Math.min(n, 24);
  }

  function scoreDoc(doc, queryTitle, queryAuthor, rankIndex) {
    var ttl = normalizeOlTitle(doc);
    var ts = titleScore(queryTitle, ttl);
    var as = authorScore(queryAuthor, doc);
    var authorWeight = queryAuthor ? 0.38 : 0;
    var titleWeight = 1 - authorWeight;
    var subN = subjectRichness(doc);
    var blended = ts * titleWeight + as * authorWeight + subN * 1.25 + (1 - rankIndex / 14) * 2;
    if (subN === 0) blended -= 48;
    return { doc: doc, score: blended, titleScore: ts, authorScore: as };
  }

  function dedupeKey(doc) {
    var workKey = doc && doc.key;
    if (workKey && String(workKey).indexOf("/works/") === 0) return "w:" + workKey;
    var ttl = normKey(normalizeOlTitle(doc));
    var auth = normKey(authorLine(doc).split(",")[0]);
    return "t:" + ttl + "|" + auth;
  }

  /**
   * Collapse duplicate catalog rows (same work or same title+author), keep strongest match.
   */
  function refineCatalogDocs(docs, queryTitle, queryAuthor) {
    if (!docs || !docs.length) return [];
    var scored = [];
    for (var i = 0; i < docs.length; i++) scored.push(scoreDoc(docs[i], queryTitle, queryAuthor, i));
    scored.sort(function (a, b) {
      return b.score - a.score;
    });
    var byKey = {};
    var out = [];
    for (var j = 0; j < scored.length; j++) {
      var row = scored[j];
      var key = dedupeKey(row.doc);
      if (byKey[key]) continue;
      byKey[key] = true;
      out.push(row);
    }
    return out;
  }

  /** Ignore catalog rows that only share loose word overlap (e.g. wonderlight → Wonder-Light). */
  var MIN_CONFIDENT_TITLE_SCORE = 72;

  function filterConfidentCatalogMatches(refined, queryAuthor) {
    if (!refined || !refined.length) return [];
    var out = [];
    for (var i = 0; i < refined.length; i++) {
      var row = refined[i];
      if (row.titleScore >= MIN_CONFIDENT_TITLE_SCORE) out.push(row);
      else if (queryAuthor && row.authorScore >= 92 && row.titleScore >= 50) out.push(row);
    }
    return out;
  }

  function shouldAutoPick(refined, queryAuthor) {
    if (!refined.length) return false;
    if (refined.length === 1) return refined[0].titleScore >= MIN_CONFIDENT_TITLE_SCORE;
    var best = refined[0];
    var second = refined[1];
    if (best.titleScore >= 98 && (!second || second.titleScore < 85)) return true;
    if (best.score - second.score >= 14 && best.titleScore >= 88) return true;
    if (queryAuthor && best.authorScore >= 92 && second.authorScore < 70) return true;
    var sameTitle = normKey(normalizeOlTitle(best.doc));
    var allSameTitle = true;
    for (var i = 1; i < refined.length; i++) {
      if (normKey(normalizeOlTitle(refined[i].doc)) !== sameTitle) {
        allSameTitle = false;
        break;
      }
    }
    if (allSameTitle && best.titleScore >= 85 && best.score - second.score >= 6) return true;
    return false;
  }

  function matchButtonLabel(doc) {
    var ttl = normalizeOlTitle(doc) || "Untitled";
    var auth = authorLine(doc) || "author unknown";
    var yr = doc && doc.first_publish_year;
    if (yr && yr === yr) return ttl + " — " + auth + " (" + String(yr) + ")";
    return ttl + " — " + auth;
  }

  function applyCatalogPinToRaw(raw, queryTitle, queryAuthor) {
    var Pins = global.HalalitCatalogPins;
    if (!Pins || typeof Pins.filterCatalogDocs !== "function") {
      return { docs: raw || [], pinMessage: null };
    }
    var pack = Pins.filterCatalogDocs(raw || [], queryTitle, queryAuthor);
    return { docs: pack.docs, pinMessage: pack.pinned ? pack.message : null };
  }

  function buildOpenLibraryQueryUrl(title, author) {
    var params = new URLSearchParams();
    params.set("limit", "12");
    params.set("fields", "key,title,author_name,subject,subject_facet,first_publish_year");
    var t = String(title || "").trim();
    var a = String(author || "").trim();
    if (t) params.set("title", t);
    if (a) params.set("author", a);
    if (!t && !a) return null;
    return "https://openlibrary.org/search.json?" + params.toString();
  }

  function normalizeLooseTitle(title) {
    var t = String(title || "").trim();
    if (!t) return "";
    return t
      .replace(/\bbook\s*#?\s*\d+\b/gi, " ")
      .replace(/\bvolume\s*#?\s*\d+\b/gi, " ")
      .replace(/\bvol\.?\s*#?\s*\d+\b/gi, " ")
      .replace(/[#]\s*\d+\b/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function buildOpenLibraryFallbackQUrl(title, author) {
    var params = new URLSearchParams();
    params.set("limit", "18");
    params.set("fields", "key,title,author_name,subject,subject_facet,first_publish_year");
    var t = String(title || "").trim();
    var loose = normalizeLooseTitle(t);
    var a = String(author || "").trim();
    var q = [t, loose !== t ? loose : "", a].filter(Boolean).join(" ").trim();
    if (!q) return null;
    params.set("q", q);
    return "https://openlibrary.org/search.json?" + params.toString();
  }

  function inferHint(doc, supplementText) {
    var Policy = global.HalalitFamilyShelfPolicy;
    if (Policy && typeof Policy.inferCatalogFamilyHint === "function") {
      var opts = supplementText ? { supplementText: supplementText } : undefined;
      return Policy.inferCatalogFamilyHint(doc, opts);
    }
    return { tier: "unclear", detail: "Catalog check unavailable—use the guidelines and your own reading." };
  }

  /** Hand-vetted or owner curated WARNINGS — skip extra catalog/AI pass. */
  function isSettledHandHint(hint, title, author) {
    if (!hint) return false;
    if (hint.tier === "verified_clean" || hint.tier === "fanservice_caution") return true;
    var VS = global.HalalitBookcheckVetSource;
    if (VS && typeof VS.curatedMatch === "function" && VS.curatedMatch(title, author)) return true;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.verifiedCleanMatch === "function" && Cur.verifiedCleanMatch(title, author)) {
      return true;
    }
    return false;
  }

  function fetchCatalogSupplement(doc) {
    var key = doc && doc.key;
    if (!key || String(key).indexOf("/works/") !== 0) return Promise.resolve({ combined: "", description: "" });
    return global
      .fetch("https://openlibrary.org" + key + ".json")
      .then(function (r) {
        if (!r.ok) return { combined: "", description: "" };
        return r.json();
      })
      .then(function (work) {
        if (!work || typeof work !== "object") return { combined: "", description: "" };
        var desc = "";
        var d = work.description;
        if (typeof d === "string") desc = d;
        else if (d && typeof d.value === "string") desc = d.value;
        var parts = [];
        if (desc) parts.push(desc);
        if (work.subjects && work.subjects.length) parts = parts.concat(work.subjects);
        return { combined: parts.join(" "), description: desc };
      })
      .catch(function () {
        return { combined: "", description: "" };
      });
  }

  function buildFamilyReport(title, author, doc, hint, supplementPack, hadWikipedia, wikipedia, wikidata, meta) {
    var Report = global.HalalitBookcheckReport;
    if (!Report || typeof Report.build !== "function") return null;
    var pack = supplementPack || { combined: "", description: "" };
    meta = meta || {};
    return Report.build({
      title: title,
      author: author,
      doc: doc,
      hint: hint,
      supplementText: pack.combined,
      descriptionOnly: pack.description,
      hadWikipedia: !!hadWikipedia,
      wikipedia: wikipedia || null,
      wikidata: wikidata || null,
      aiScanOk: !!meta.aiScanOk,
      fanserviceNotChecked: !!meta.fanserviceNotChecked,
      aiSeriesNote: meta.aiSeriesNote || "",
    });
  }

  function familyPortrayalParagraph(familyPortrayal, inlineDetail) {
    if (inlineDetail || !familyPortrayal || !familyPortrayal.detail) return "";
    var label = familyPortrayal.label || "Family is portrayed negatively";
    return " " + label + ": " + familyPortrayal.detail;
  }

  function deityComfortParagraph(deityComfort, inlineDetail) {
    if (inlineDetail || !deityComfort || !deityComfort.detail) return "";
    var label = deityComfort.label || "Deity or mythology (comfort note)";
    return " " + label + ": " + deityComfort.detail;
  }

  function bookcheckYouDecideLine() {
    var R = global.HalalitBookcheckReport;
    return (R && R.youDecideLine) || "Halalit hasn’t read this cover to cover—you decide what fits your home.";
  }

  function appendYouDecideParagraph(body, tier, opts) {
    opts = opts || {};
    var R = global.HalalitBookcheckReport;
    if (!R || typeof R.shouldShowYouDecideLine !== "function") return body;
    if (
      !R.shouldShowYouDecideLine(null, { tier: tier }, { vetSource: opts.vetSource })
    ) {
      return body;
    }
    var line = bookcheckYouDecideLine();
    if (body && body.indexOf("you decide") !== -1) return body;
    return (body ? body + " " : "") + line;
  }

  function shortVerdictBody(tier, hintDetail, inlineDetail) {
    if (!inlineDetail) return hintDetail || "";
    if (hintDetail) return "";
    if (tier === "deity_comfort") return "Comfort note—not a ban.";
    if (tier === "teen_caution") return "Teen/YA tags—not Halalit’s all-ages shelf.";
    if (tier === "verified_clean") return "Hand-checked for the family shelf.";
    if (tier === "flag_review") return "Outside Halalit’s hardest auto-reject rules.";
    if (tier === "user_discretion") {
      return "Hand-checked parent discretion—not LGBTQ, adult-romance, or hardest fanservice auto-reject.";
    }
    if (tier === "preview_caution") return "Comics or manga—preview before kids read.";
    if (tier === "fanservice_caution") return "Hand-checked comic—lighter fanservice caution.";
    if (tier === "likely_youth" || tier === "not_verified") return "Children’s tags aren’t a clean pass.";
    return bookcheckYouDecideLine();
  }

  function formatSignalsHtml(signals) {
    if (!signals || !signals.length) return "";
    var html = '<ul class="bookcheck-signals">';
    for (var i = 0; i < signals.length; i++) {
      html += "<li>" + escapeHtml(signals[i]) + "</li>";
    }
    return html + "</ul>";
  }

  function subjectBlobFromDoc(doc) {
    var parts = [];
    if (doc && doc.subject_facet && doc.subject_facet.length) parts = doc.subject_facet.slice(0, 24);
    else if (doc && doc.subject && doc.subject.length) parts = doc.subject.slice(0, 24);
    return parts.join(" ").toLowerCase();
  }

  function clearLegacyBookcheckSkipKeys() {
    try {
      if (!global.localStorage) return;
      for (var i = 0; i < LEGACY_SKIP_KEYS.length; i++) {
        global.localStorage.removeItem(LEGACY_SKIP_KEYS[i]);
      }
    } catch (e) {
      /* ignore */
    }
  }

  function filterComfortNoteText(text) {
    var lines = String(text || "").split("\n");
    var kept = [];
    for (var i = 0; i < lines.length; i++) {
      var line = String(lines[i] || "").trim();
      if (!line || shouldHideComfortText(line)) continue;
      kept.push(line);
    }
    return kept.join("\n").trim();
  }

  function shouldHideComfortText(text) {
    var Policy = global.HalalitFamilyShelfPolicy;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (!Cur || typeof Cur.comfortNoteCategories !== "function") return false;
    var cats = Cur.comfortNoteCategories(text);
    if (!cats.length || !Policy) return false;
    if (cats.indexOf("deity") !== -1 && Policy.bookQuestAllowsDeityMythology && !Policy.bookQuestAllowsDeityMythology()) {
      return true;
    }
    if (
      cats.indexOf("family") !== -1 &&
      Policy.bookQuestAllowsFamilyCommunityTone &&
      !Policy.bookQuestAllowsFamilyCommunityTone()
    ) {
      return true;
    }
    if (cats.indexOf("romance") !== -1 && Policy.bookQuestAllowsLightRomance && !Policy.bookQuestAllowsLightRomance()) {
      return true;
    }
    if (cats.indexOf("magic") !== -1 && Policy.bookQuestAllowsMagic && !Policy.bookQuestAllowsMagic()) {
      return true;
    }
    if (cats.indexOf("substance") !== -1 && Policy.bookQuestAllowsSubstance && !Policy.bookQuestAllowsSubstance()) {
      return true;
    }
    if (
      cats.indexOf("cultural") !== -1 &&
      Policy.bookQuestAllowsCulturalMisrepresentation &&
      !Policy.bookQuestAllowsCulturalMisrepresentation()
    ) {
      return true;
    }
    if (
      cats.indexOf("mental_health") !== -1 &&
      Policy.mentalHealthComfortAppliesToReaderBand &&
      Policy.mentalHealthComfortAppliesToReaderBand(Policy.getBookQuestReaderAgeBand()) &&
      Policy.bookQuestAllowsMentalHealthComfort &&
      !Policy.bookQuestAllowsMentalHealthComfort()
    ) {
      return true;
    }
    return false;
  }

  function shouldHideScanRow(row) {
    var Policy = global.HalalitFamilyShelfPolicy;
    if (!row || !row.label || !Policy) return false;
    if (/cultural misrepresentation|cultural-representation note/i.test(String(row.label))) {
      return (
        typeof Policy.bookQuestAllowsCulturalMisrepresentation === "function" &&
        !Policy.bookQuestAllowsCulturalMisrepresentation()
      );
    }
    return false;
  }

  function shouldHideThemeHit() {
    return false;
  }

  function culturalNoteVisible() {
    var Policy = global.HalalitFamilyShelfPolicy;
    return !(
      Policy &&
      typeof Policy.bookQuestAllowsCulturalMisrepresentation === "function" &&
      !Policy.bookQuestAllowsCulturalMisrepresentation()
    );
  }

  global.HalalitBookcheckPrefs = {
    shouldHideComfortText: shouldHideComfortText,
    shouldHideScanRow: shouldHideScanRow,
    shouldHideThemeHit: shouldHideThemeHit,
    filterComfortNoteText: filterComfortNoteText,
    culturalNoteVisible: culturalNoteVisible,
  };

  function displayHintTier(tier) {
    return tier;
  }

  function bookcheckShelfOpts(Policy) {
    if (!Policy || typeof Policy.getBookQuestReaderAgeBand !== "function") return null;
    var band = Policy.getBookQuestReaderAgeBand();
    return {
      allowDeityMythology:
        typeof Policy.bookQuestAllowsDeityMythology === "function" && Policy.bookQuestAllowsDeityMythology(),
      allowFamilyCommunityTone:
        typeof Policy.bookQuestAllowsFamilyCommunityTone === "function" &&
        Policy.bookQuestAllowsFamilyCommunityTone(),
      allowLightRomance:
        typeof Policy.bookQuestAllowsLightRomance === "function" && Policy.bookQuestAllowsLightRomance(),
      allowMagic: typeof Policy.bookQuestAllowsMagic === "function" && Policy.bookQuestAllowsMagic(),
      allowSubstance:
        typeof Policy.bookQuestAllowsSubstance === "function" && Policy.bookQuestAllowsSubstance(),
      allowCulturalMisrepresentation:
        typeof Policy.bookQuestAllowsCulturalMisrepresentation === "function" &&
        Policy.bookQuestAllowsCulturalMisrepresentation(),
      allowMentalHealthComfort:
        typeof Policy.bookQuestAllowsMentalHealthComfort === "function" &&
        Policy.bookQuestAllowsMentalHealthComfort(),
      requireReaderAgeBand: !!band,
      readerAgeBand: band,
      variantId: null,
    };
  }

  /** Softer verdict when a title fails only because of shared reader prefs (not a hard ban). */
  function bookcheckPrefVerdictOverride(title, author, Policy, shelfTier) {
    if (!Policy || typeof Policy.isEligibleForFamilyShelf !== "function") return null;
    var opts = bookcheckShelfOpts(Policy);
    if (!opts || Policy.isEligibleForFamilyShelf(title, author, shelfTier, opts)) return null;
    if (Policy.hardExclusionDetailForTitle && Policy.hardExclusionDetailForTitle(title, author)) return null;

    if (
      ((shelfTier === "deity_comfort" || shelfTier === "verified_clean") &&
        Policy.bookQuestDeityMythologyBlock &&
        Policy.bookQuestDeityMythologyBlock(title, author) &&
        Policy.bookQuestAllowsDeityMythology &&
        !Policy.bookQuestAllowsDeityMythology()) ||
      (shelfTier === "deity_comfort" &&
        Policy.bookQuestAllowsDeityMythology &&
        !Policy.bookQuestAllowsDeityMythology())
    ) {
      return {
        kind: "maybe",
        headline: "Outside your settings — deity or mythology",
        body:
          "Folklore or mythology treated as real—some readers skip these. You excluded deity/mythology in Advanced recommendations settings (shared with Book Quest). Not calling it inappropriate.",
      };
    }
    if (
      Policy.bookQuestNegativeFamilyPortrayalBlock &&
      Policy.bookQuestNegativeFamilyPortrayalBlock(title, author) &&
      Policy.bookQuestAllowsFamilyCommunityTone &&
      !Policy.bookQuestAllowsFamilyCommunityTone()
    ) {
      return {
        kind: "maybe",
        headline: "Outside your settings — negative family portrayal",
        body:
          "A parent or guardian is cast as unfair or villain-like—not merely annoying family friction. You excluded that theme in Advanced recommendations settings.",
      };
    }
    if (
      Policy.bookQuestLightRomanceBlock &&
      Policy.bookQuestLightRomanceBlock(title, author) &&
      Policy.bookQuestAllowsLightRomance &&
      !Policy.bookQuestAllowsLightRomance()
    ) {
      return {
        kind: "maybe",
        headline: "Outside your settings — light romance",
        body:
          "Hand-checked light romance—crushes, light dating, or a prom—not adult, dark, or LGBTQ romance. You excluded light romance in Advanced recommendations settings.",
      };
    }
    if (
      Policy.bookQuestMagicBlock &&
      Policy.bookQuestMagicBlock(title, author) &&
      Policy.bookQuestAllowsMagic &&
      !Policy.bookQuestAllowsMagic()
    ) {
      return {
        kind: "maybe",
        headline: "Outside your settings — magic",
        body:
          "Fantasy magic in an otherwise hand-verified title. You excluded magic in Advanced recommendations settings—the book may still be clean for another reader.",
      };
    }
    if (
      Policy.bookQuestSubstanceBlock &&
      Policy.bookQuestSubstanceBlock(title, author) &&
      Policy.bookQuestAllowsSubstance &&
      !Policy.bookQuestAllowsSubstance()
    ) {
      return {
        kind: "maybe",
        headline: "Outside your settings — alcohol or similar",
        body:
          "Light alcohol or similar mentions in an otherwise hand-verified title. You excluded alcohol/drug-related content in Advanced recommendations settings.",
      };
    }
    if (
      Policy.bookQuestCulturalMisrepresentationBlock &&
      Policy.bookQuestCulturalMisrepresentationBlock(title, author) &&
      Policy.bookQuestAllowsCulturalMisrepresentation &&
      !Policy.bookQuestAllowsCulturalMisrepresentation()
    ) {
      return {
        kind: "maybe",
        headline: "Outside your settings — cultural misrepresentation",
        body:
          "Hand-checked cultural misrepresentation notes—not group demonization. You excluded cultural misrepresentation in Advanced recommendations settings.",
      };
    }
    if (
      Policy.bookQuestMentalHealthComfortBlock &&
      Policy.bookQuestMentalHealthComfortBlock(title, author) &&
      Policy.mentalHealthComfortAppliesToReaderBand &&
      Policy.mentalHealthComfortAppliesToReaderBand(opts.readerAgeBand) &&
      Policy.bookQuestAllowsMentalHealthComfort &&
      !Policy.bookQuestAllowsMentalHealthComfort()
    ) {
      return {
        kind: "maybe",
        headline: "Outside your settings — mental-health weight",
        body:
          "Hand-checked mental-health comfort note—not a ban. You excluded mental-health weight in Advanced recommendations settings for Older Child/Young Teen and Older Teen/Adult readers.",
      };
    }
    if (
      opts.requireReaderAgeBand &&
      Policy.bookQuestMatchesReaderAge &&
      !Policy.bookQuestMatchesReaderAge(title, author, null, opts.readerAgeBand)
    ) {
      return {
        kind: "maybe",
        headline: "Outside your reader age band",
        body:
          "This hand-vetted title doesn’t fit the reader age band you chose above (same setting as Book Quest). Pick a different band or title if you want Halalit to treat it as a good fit.",
      };
    }
    return null;
  }

  function pickContextBlanket(doc, title, author, hintTier) {
    if (
      hintTier === "flag_review" ||
      hintTier === "verified_clean" ||
      hintTier === "user_discretion" ||
      hintTier === "deity_comfort" ||
      hintTier === "preview_caution" ||
      hintTier === "fanservice_caution"
    )
      return "";
    var titleBlob = String(title || "").toLowerCase();
    var subjectBlob = subjectBlobFromDoc(doc);
    var titleLooksGraphic = GRAPHIC_FORMAT_RE.test(titleBlob);
    var subjectLooksGraphic = GRAPHIC_FORMAT_RE.test(subjectBlob);
    if (titleLooksGraphic || subjectLooksGraphic) {
      return "Comics/manga: preview panels—even when the age label looks young.";
    }
    if (
      YOUTH_CATALOG_RE.test(subjectBlob) ||
      hintTier === "not_verified" ||
      hintTier === "unclear" ||
      hintTier === "likely_youth"
    ) {
      return "Children’s tags don’t catch everything—catalogs miss small concerns.";
    }
    return "";
  }

  function verdictFor(
    title,
    author,
    hintTier,
    hintDetail,
    matchedTitle,
    matchedAuthor,
    familyPortrayal,
    deityComfort,
    contextBlanket,
    policyTier,
    opts
  ) {
    var inlineDetail = opts && opts.detailShownInMatchLead;
    var signals = (opts && opts.signals) || [];
    var familyAction = (opts && opts.familyAction) || "";
    var Policy = global.HalalitFamilyShelfPolicy;
    var shelfTier = policyTier || hintTier;
    var shelfOpts = Policy ? bookcheckShelfOpts(Policy) : null;
    var fpPara = familyPortrayalParagraph(familyPortrayal, inlineDetail);
    var dcPara = deityComfortParagraph(deityComfort, inlineDetail);

    var matchLine = "";
    if (matchedTitle) {
      matchLine =
        "Catalog match: <strong>" +
        escapeHtml(matchedTitle) +
        "</strong>" +
        (matchedAuthor ? " · " + escapeHtml(matchedAuthor) : "");
    }

    var prefOverride =
      Policy && typeof bookcheckPrefVerdictOverride === "function"
        ? bookcheckPrefVerdictOverride(title, author, Policy, shelfTier)
        : null;
    if (prefOverride) {
      return {
        kind: prefOverride.kind,
        headline: prefOverride.headline,
        body: prefOverride.body + fpPara + dcPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: (opts && opts.familyAction) || "",
        signals: (opts && opts.signals) || [],
      };
    }
    var blocked =
      Policy && typeof Policy.hardExclusionDetailForTitle === "function" && Policy.hardExclusionDetailForTitle(title, author);
    var eligible =
      Policy && typeof Policy.isEligibleForFamilyShelf === "function"
        ? Policy.isEligibleForFamilyShelf(title, author, shelfTier, shelfOpts)
        : shelfTier !== "flag_review" && shelfTier !== "deity_comfort";

    if (shelfTier === "deity_comfort") {
      return {
        kind: "maybe",
        headline: "Deity or mythology — comfort note",
        body:
          shortVerdictBody("deity_comfort", hintDetail, inlineDetail) ||
          (hintDetail ||
            "Folklore or mythology treated as real—some readers skip these. Halalit won’t Book Quest this; not calling it inappropriate.") +
          fpPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "fanservice_caution" || shelfTier === "fanservice_caution") {
      return {
        kind: "maybe",
        headline: "Comics — lighter fanservice caution",
        body:
          shortVerdictBody("fanservice_caution", hintDetail, inlineDetail) ||
          (hintDetail || "Hand-checked comic with some panel risk—preview human characters and outfits.") + fpPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "user_discretion" || shelfTier === "user_discretion") {
      return {
        kind: "maybe",
        headline: "Parent discretion",
        body:
          shortVerdictBody("user_discretion", hintDetail, inlineDetail) ||
          (hintDetail ||
            "Hand-checked parent discretion—not LGBTQ, adult-romance, or hardest fanservice auto-reject.") +
          fpPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "ai_likely_pass") {
      return {
        kind: "maybe",
        headline: "AI likely okay — not hand-checked",
        body: (hintDetail || "AI theme scan only—not owner hand-vetted.") + fpPara + dcPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "ai_manual_review") {
      return {
        kind: "maybe",
        headline: "AI flagged for review — not hand-checked",
        body: (hintDetail || "AI flagged possible concerns—not a hand reject.") + fpPara + dcPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "ai_likely_reject") {
      return {
        kind: "maybe",
        headline: "AI likely rejection — not manually checked",
        body: (hintDetail || "AI likely fails Halalit rules—not hand-rejected by the owner.") + fpPara + dcPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (blocked || hintTier === "flag_review" || !eligible) {
      return {
        kind: "no",
        headline: "Automatic hard rejection",
        body:
          shortVerdictBody("flag_review", hintDetail, inlineDetail) ||
          hintDetail ||
          "Outside Halalit’s hardest auto-reject rules.",
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "preview_caution") {
      return {
        kind: "maybe",
        headline: "Preview before your kids read",
        body:
          shortVerdictBody("preview_caution", hintDetail, inlineDetail) ||
          (hintDetail || "Comics and manga need a quick parent preview—catalogs miss a lot.") + fpPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "teen_caution") {
      return {
        kind: "maybe",
        headline: fpPara ? "Teen/adult audience — caution + family note" : "Teen/adult audience — caution",
        body:
          shortVerdictBody("teen_caution", hintDetail, inlineDetail) ||
          (hintDetail || "Teen/YA tags—not Halalit’s all-ages shelf.") + fpPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "verified_clean") {
      return {
        kind: "yes",
        headline: dcPara ? "Good fit — deity or mythology note" : fpPara ? "Good fit — family note" : "Good fit for Halalit’s family shelf",
        body:
          shortVerdictBody("verified_clean", hintDetail, inlineDetail) ||
          (hintDetail || "Hand-checked for the family shelf.") + fpPara + dcPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "likely_youth" || hintTier === "not_verified" || hintTier === "unclear") {
      var youthHead =
        signals.length && signals.indexOf("Comics, manga, or graphic novel") !== -1
          ? "Preview recommended"
          : fpPara
            ? "Not hand-read — family note"
            : "Not hand-read yet";
      return {
        kind: "maybe",
        headline: youthHead,
        body: appendYouDecideParagraph(
          shortVerdictBody(hintTier, hintDetail, inlineDetail) ||
            (hintDetail ||
              (hintTier === "likely_youth"
                ? "Tagged children’s fiction—not a hand-read pass."
                : "Not hand-read yet.")) + fpPara,
          hintTier,
          opts
        ),
        matchLine: matchLine,
        contextBlanket: contextBlanket || "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    return {
      kind: "maybe",
      headline: fpPara ? "Not hand-read — family note" : "Not hand-read yet",
      body: appendYouDecideParagraph(
        shortVerdictBody("unclear", hintDetail, inlineDetail) || (hintDetail || bookcheckYouDecideLine()) + fpPara,
        "unclear",
        opts
      ),
      matchLine: matchLine,
      contextBlanket: contextBlanket || "",
      familyAction: familyAction,
      signals: signals,
    };
  }

  function verdictActionHtml(v, opts) {
    opts = opts || {};
    var parts = "";
    if (v.familyAction && !opts.hideFamilyAction) {
      parts +=
        '<p class="bookcheck-action"><strong>What to do:</strong> ' + escapeHtml(v.familyAction) + "</p>";
    }
    if (v.signals && v.signals.length) {
      parts += '<div class="bookcheck-signals-wrap"><p class="bookcheck-signals-title">What we noticed</p>';
      parts += formatSignalsHtml(v.signals);
      parts += "</div>";
    }
    return parts;
  }

  function init(panel, opts) {
    opts = opts || {};
    if (!panel || panel.getAttribute("data-bookcheck-wired") === "1") return;
    panel.setAttribute("data-bookcheck-wired", "1");
    clearLegacyBookcheckSkipKeys();
    var ids = Object.assign({}, DEFAULT_BOOKCHECK_IDS, opts.ids || {});
    var titleIn = bookcheckEl(panel, ids, "title");
    var authorIn = bookcheckEl(panel, ids, "author");
    var lookupBtn = bookcheckEl(panel, ids, "lookup");
    var statusEl = bookcheckEl(panel, ids, "status");
    var matchBox = bookcheckEl(panel, ids, "matchBox");
    var matchLead = bookcheckEl(panel, ids, "matchLead");
    var matchList = bookcheckEl(panel, ids, "matchList");
    var verdictBox = bookcheckEl(panel, ids, "verdict");
    var seriesNoteEl = bookcheckEl(panel, ids, "seriesNote");
    var wikiNoteEl = bookcheckEl(panel, ids, "wikiNote");
    var wikidataNoteEl = bookcheckEl(panel, ids, "wikidataNote");

    var catalogMeta = {
      hintTier: null,
      hintDetail: null,
      familyPortrayal: null,
      culturalRepresentation: null,
      faithInStory: null,
      parentNote: null,
      authorOtherWorks: null,
      deityComfort: null,
      hintSignals: [],
      hintFamilyAction: "",
      familyReport: null,
      hadWikipedia: false,
      wikipedia: null,
      wikidata: null,
      matchedTitle: "",
      matchedAuthor: "",
      lastDoc: null,
      vetSource: null,
      aiStaging: null,
      aiScanOk: false,
      aiSeriesNote: "",
      fanserviceNotChecked: false,
      lookupLogTitle: "",
      lookupLogAuthor: "",
      lookupRecorded: false,
      ownerTesting: !!opts.ownerTesting,
    };

    function lookupLogTitleAuthor(title, author, meta) {
      meta = meta || catalogMeta;
      var logTitle = (meta && meta.lookupLogTitle) || title || "";
      var logAuthor = meta && meta.lookupLogAuthor != null ? meta.lookupLogAuthor : author || "";
      var VSlog = global.HalalitBookcheckVetSource;
      if (VSlog && typeof VSlog.canonicalBarcodeBook === "function") {
        var canon = VSlog.canonicalBarcodeBook(logTitle, logAuthor);
        if (canon) {
          if (canon.title) logTitle = canon.title;
          if (canon.author) logAuthor = canon.author;
        }
      }
      var Runtime = global.HalalitOwnerVetsRuntime;
      if (Runtime && typeof Runtime.findEntry === "function" && logTitle) {
        var vet = Runtime.findEntry(logTitle, logAuthor || "");
        if (vet && vet.author) logAuthor = vet.author;
      }
      return { title: logTitle, author: logAuthor || "" };
    }

    function recordLookupForOwner(title, author) {
      if (catalogMeta.ownerTesting) {
        return Promise.resolve();
      }
      if (catalogMeta.lookupRecorded) {
        return Promise.resolve();
      }
      var Config = global.HalalitBookcheckConfig;
      var url = Config && typeof Config.lookupRecordUrl === "function" ? Config.lookupRecordUrl() : "";
      if (!url || !global.fetch) return Promise.resolve();
      var log = lookupLogTitleAuthor(title, author);
      if (!log.title) return Promise.resolve();
      catalogMeta.lookupRecorded = true;
      return global
        .fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: log.title,
            author: log.author,
            enteredTitle: catalogMeta.lookupLogTitle || log.title,
            enteredAuthor: catalogMeta.lookupLogAuthor || "",
            ownerTesting: !!catalogMeta.ownerTesting,
          }),
        })
        .catch(function () {})
        .then(function () {});
    }

    function resetUi() {
      var keepOwnerTesting = !!opts.ownerTesting || !!catalogMeta.ownerTesting;
      catalogMeta = {
        hintTier: null,
        hintDetail: null,
        familyPortrayal: null,
        deityComfort: null,
        hintSignals: [],
        hintFamilyAction: "",
        familyReport: null,
        hadWikipedia: false,
        wikipedia: null,
        wikidata: null,
        matchedTitle: "",
        matchedAuthor: "",
        lastDoc: null,
        vetSource: null,
        aiStaging: null,
        aiScanOk: false,
        aiSeriesNote: "",
        fanserviceNotChecked: false,
        lookupLogTitle: "",
        lookupLogAuthor: "",
        lookupRecorded: false,
        ownerTesting: keepOwnerTesting,
      };
      if (matchBox) {
        matchBox.classList.remove("is-visible");
        if (matchLead) matchLead.textContent = "";
        if (matchList) matchList.innerHTML = "";
      }
      if (verdictBox) {
        verdictBox.hidden = true;
        verdictBox.innerHTML = "";
        verdictBox.className = "bookcheck-verdict";
      }
      if (seriesNoteEl) {
        seriesNoteEl.hidden = true;
        seriesNoteEl.innerHTML = "";
      }
      if (statusEl) statusEl.textContent = "";
      if (wikiNoteEl) {
        wikiNoteEl.hidden = true;
        wikiNoteEl.innerHTML = "";
      }
      if (wikidataNoteEl) {
        wikidataNoteEl.hidden = true;
        wikidataNoteEl.innerHTML = "";
      }
    }

    function showWikiNote(wiki) {
      if (!wikiNoteEl || !wiki || !wiki.text) return;
      var html = "<strong>Wikipedia</strong> (verify yourself";
      if (wiki.plot) html += "; plot section scanned for all Halalit shelf themes the blurb may omit";
      html += "): ";
      if (wiki.intro) {
        var intro = wiki.intro.length > 220 ? wiki.intro.slice(0, 217) + "…" : wiki.intro;
        html += "<em>Intro:</em> " + escapeHtml(intro);
      }
      if (wiki.plot) {
        var plot = wiki.plot.length > 280 ? wiki.plot.slice(0, 277) + "…" : wiki.plot;
        html +=
          (wiki.intro ? " <em>" + escapeHtml(wiki.plotSectionTitle || "Plot") + ":</em> " : "") +
          escapeHtml(plot);
      }
      if (!wiki.intro && !wiki.plot) {
        var excerpt = wiki.text.length > 320 ? wiki.text.slice(0, 317) + "…" : wiki.text;
        html += escapeHtml(excerpt);
      }
      html +=
        ' <a href="' +
        escapeHtml(wiki.url) +
        '" target="_blank" rel="noopener noreferrer">Open “' +
        escapeHtml(wiki.pageTitle) +
        "”</a>. May be wrong or spoiler-heavy.";
      wikiNoteEl.hidden = false;
      wikiNoteEl.innerHTML = html;
    }

    function showWikidataNote(wd) {
      if (!wikidataNoteEl || !wd) return;
      var html = "<strong>Wikidata</strong> (CC0 linked data): “" + escapeHtml(wd.itemLabel) + "”";
      if (wd.itemDescription) html += " — " + escapeHtml(wd.itemDescription);
      if (wd.themeHits && wd.themeHits.length) {
        html += ". <strong>Shelf themes on this item:</strong> ";
        var parts = [];
        for (var i = 0; i < wd.themeHits.length && i < 6; i++) {
          parts.push(wd.themeHits[i].label);
        }
        html += escapeHtml(parts.join(" · "));
      } else if (wd.genreLabels && wd.genreLabels.length) {
        html += ". <strong>Linked labels:</strong> " + escapeHtml(wd.genreLabels.slice(0, 6).join(" · "));
      } else {
        html += ". No Halalit shelf themes matched on this Wikidata item.";
      }
      html +=
        ' <a href="' +
        escapeHtml(wd.url) +
        '" target="_blank" rel="noopener noreferrer">View ' +
        escapeHtml(wd.qid) +
        "</a>.";
      wikidataNoteEl.hidden = false;
      wikidataNoteEl.innerHTML = html;
    }

    function tierRank(tier) {
      if (tier === "flag_review") return 4;
      if (tier === "deity_comfort") return 3;
      if (tier === "teen_caution") return 3;
      if (tier === "verified_clean") return 3;
      if (tier === "preview_caution") return 2;
      if (tier === "user_discretion") return 2;
      if (tier === "fanservice_caution") return 2;
      if (tier === "ai_likely_reject") return 2;
      if (tier === "ai_manual_review") return 2;
      if (tier === "ai_likely_pass") return 1;
      if (tier === "unclear" || tier === "not_verified") return 2;
      if (tier === "likely_youth") return 2;
      return 0;
    }

    function strongerHint(a, b) {
      return tierRank(a.tier) >= tierRank(b.tier) ? a : b;
    }

    function syncAiStagingMeta(title, author) {
      var VS = global.HalalitBookcheckVetSource;
      catalogMeta.aiStaging = null;
      if (!VS || typeof VS.resolveHandVetHint !== "function") return;
      if (VS.resolveHandVetHint(title, author)) return;
      if (typeof VS.resolveAiStagingHint === "function") {
        catalogMeta.aiStaging = VS.resolveAiStagingHint(title, author);
      }
    }

    function applyVetSourceMeta(title, author, doc) {
      var VS = global.HalalitBookcheckVetSource;
      if (!VS || typeof VS.resolveVetSource !== "function") return;
      syncAiStagingMeta(title, author);
      var useDoc = doc || catalogMeta.lastDoc;
      var isGraphic =
        typeof VS.titleLooksGraphic === "function" && VS.titleLooksGraphic(title, author, useDoc);
      catalogMeta.fanserviceNotChecked =
        isGraphic &&
        catalogMeta.hintTier !== "verified_clean" &&
        catalogMeta.hintTier !== "fanservice_caution";
      catalogMeta.vetSource = VS.resolveVetSource(title, author, catalogMeta.hintTier, {
        aiScanOk: !!catalogMeta.aiScanOk,
        aiStaging: catalogMeta.aiStaging,
      });
    }

    function runAiThenFinish(doc, ttl, auth, hint, supplementPack, hadWikipedia, wikipedia, wikidata) {
      var enteredTitle = titleIn ? String(titleIn.value || "").trim() : ttl;
      var enteredAuthor = authorIn ? String(authorIn.value || "").trim() : auth;
      var VS = global.HalalitBookcheckVetSource;
      var AI = global.HalalitBookcheckAi;
      var isGraphic =
        VS && typeof VS.titleLooksGraphic === "function" && VS.titleLooksGraphic(ttl, auth, doc);

      if (!AI || typeof AI.fetchThemeScan !== "function") {
        catalogMeta.aiScanOk = false;
        finishApplyDoc(doc, ttl, auth, hint, supplementPack, hadWikipedia, wikipedia, wikidata);
        return;
      }

      if (statusEl) statusEl.textContent = "Scanning themes with AI (not fanservice on comics)…";

      AI.fetchThemeScan(enteredTitle, enteredAuthor, isGraphic, {
        fromScanner: !!catalogMeta.fromScanner,
      }).then(function (aiResult) {
        var nextHint = hint;
        if (aiResult && aiResult.ok) {
          catalogMeta.aiScanOk = true;
          catalogMeta.aiSeriesNote = aiResult.seriesNote || "";
          var aiText = AI.buildAiSupplementText(aiResult);
          if (aiText && doc) {
            var blobIn = ((supplementPack && supplementPack.combined) || "") + " " + aiText;
            nextHint = strongerHint(inferHint(doc, blobIn), hint);
          } else if (aiText) {
            nextHint = strongerHint(
              inferHint({
                title: enteredTitle,
                author_name: enteredAuthor
                  ? enteredAuthor.split(/\s*,\s*/).map(function (s) {
                      return s.trim();
                    }).filter(Boolean)
                  : [],
              }),
              hint
            );
          }
          nextHint.signals = AI.appendAiSignals(nextHint.signals, aiResult);
          var Pol = global.HalalitFamilyShelfPolicy;
          nextHint.familyAction =
            Pol && typeof Pol.familyActionLine === "function"
              ? Pol.familyActionLine(nextHint.tier, nextHint.signals || [], enteredTitle)
              : nextHint.familyAction;
        } else if (statusEl && aiResult && aiResult.error === "ai_unconfigured") {
          if (statusEl.textContent.indexOf("AI") === -1) {
            statusEl.textContent = "Catalog done—AI theme scan is not set up on the server yet.";
          }
        }
        finishApplyDoc(doc, ttl, auth, nextHint, supplementPack, hadWikipedia, wikipedia, wikidata);
        if (lookupBtn) lookupBtn.disabled = false;
        if (statusEl) {
          statusEl.textContent = catalogMeta.aiScanOk
            ? "Catalog + AI theme scan complete."
            : statusEl.textContent || "Lookup complete.";
        }
      });
    }

    var Policy = global.HalalitFamilyShelfPolicy;

    function enrichHintsAndFinish(doc, ttl, auth, preHint) {
      var Wiki = global.HalalitWikipediaShelfHint;
      var WD = global.HalalitWikidataShelfHint;
      var qTitle = ttl || (titleIn && titleIn.value) || "";
      var qAuth = auth || (authorIn && authorIn.value) || "";
      var olP = fetchCatalogSupplement(doc);
      var wikiP =
        Wiki && typeof Wiki.fetchShelfHint === "function" ? Wiki.fetchShelfHint(qTitle, qAuth) : Promise.resolve(null);
      var wdP =
        WD && typeof WD.fetchShelfHint === "function" ? WD.fetchShelfHint(qTitle, qAuth) : Promise.resolve(null);
      Promise.all([olP, wikiP, wdP]).then(function (parts) {
        var olPack = parts[0] || { combined: "", description: "" };
        var wiki = parts[1];
        var wd = parts[2];
        var combined = olPack.combined || "";
        var hadWiki = !!(wiki && wiki.text);
        if (hadWiki) {
          combined += (combined ? " " : "") + wiki.text;
          showWikiNote(wiki);
        }
        if (wd && wd.scanText) {
          combined += (combined ? " " : "") + wd.scanText;
          showWikidataNote(wd);
        }
        catalogMeta.wikipedia = wiki;
        catalogMeta.wikidata = wd;
        var hint = combined.trim() ? inferHint(doc, combined) : preHint;
        hint = strongerHint(hint, preHint);
        olPack.combined = combined;
        runAiThenFinish(doc, ttl, auth, hint, olPack, hadWiki, wiki, wd);
      });
    }

    function showSeriesNote(title, author) {
      if (!seriesNoteEl) return;
      var SE = global.HalalitSeriesExpectation;
      if (!SE || typeof SE.match !== "function" || typeof SE.line !== "function") {
        seriesNoteEl.hidden = true;
        seriesNoteEl.innerHTML = "";
        return;
      }
      var ent = SE.match(title, author);
      if (!ent || (typeof SE.isDismissed === "function" && SE.isDismissed(ent.id))) {
        seriesNoteEl.hidden = true;
        seriesNoteEl.innerHTML = "";
        return;
      }
      seriesNoteEl.hidden = false;
      seriesNoteEl.innerHTML =
        '<div class="series-expectation-strip__item">' +
        "<span class=\"series-expectation-strip__text\"><strong>Series · " +
        escapeHtml(ent.label) +
        "</strong> — " +
        escapeHtml(SE.line("before", ent)) +
        "</span>" +
        '<button type="button" class="series-expectation-strip__dismiss" data-dismiss-expectation="' +
        escapeHtml(ent.id) +
        '" aria-label="Dismiss ' +
        escapeHtml(ent.label) +
        ' heads-up">×</button></div>';
      var dismissBtn = seriesNoteEl.querySelector("[data-dismiss-expectation]");
      if (dismissBtn) {
        dismissBtn.onclick = function () {
          if (typeof SE.dismissId === "function") SE.dismissId(ent.id);
          seriesNoteEl.hidden = true;
          seriesNoteEl.innerHTML = "";
        };
      }
    }

    function maybeShowOwnerReviewPending(title, author, v, meta) {
      if (catalogMeta.ownerTesting) return;
      if (!verdictBox || verdictBox.hidden || !v || v.kind === "no") return;
      var Ui = global.HalalitOwnerVetUi;
      if (Ui && typeof Ui.isHandSettled === "function" && Ui.isHandSettled(title, author)) return;
      var vs = meta.vetSource || "";
      if (vs === "hand_vetted" || vs === "owner_rejected" || vs.indexOf("ai_") === 0) return;
      if (meta.familyReport && global.HalalitBookcheckReport) {
        var ar = global.HalalitBookcheckReport.autoRejectionSummary(meta.familyReport, {
          tier: meta.hintTier,
          detail: meta.hintDetail,
        });
        if (ar && ar.status === "reject") return;
      }
      var Config = global.HalalitBookcheckConfig;
      if (!Config || typeof Config.ownerReviewPendingUrl !== "function") return;

      function insertPendingNote(html) {
        if (!verdictBox || verdictBox.hidden) return;
        var old = verdictBox.querySelector(".bookcheck-owner-review-pending");
        if (old) old.remove();
        var note = document.createElement("p");
        note.className = "bookcheck-owner-review-pending muted";
        note.setAttribute("role", "note");
        note.innerHTML = html;
        var headline = verdictBox.querySelector(".bookcheck-verdict__headline");
        if (headline && headline.parentNode) {
          headline.parentNode.insertBefore(note, headline.nextSibling);
        } else {
          verdictBox.appendChild(note);
        }
      }

      recordLookupForOwner(title, author).then(function () {
        var log = lookupLogTitleAuthor(title, author, meta);
        var url =
          Config.ownerReviewPendingUrl() +
          "?title=" +
          encodeURIComponent(log.title || "") +
          "&author=" +
          encodeURIComponent(log.author || "");
        return fetch(url, { credentials: "same-origin" }).then(function (res) {
          return res.ok ? res.json() : null;
        });
      }).then(function (data) {
        if (!data || !data.pending) return;
        if (data.kind === "popular") {
          insertPendingNote(
            "<strong>Hand vet in progress:</strong> The owner will soon examine this text and be able to confirm whether Halalit would recommend it."
          );
        } else {
          insertPendingNote(
            "The owner of the site has been informed and your search has been added to the list of books to hand-check."
          );
        }
      }).catch(function () {});
    }

    function showVerdict(title, author) {
      if (!verdictBox) return;
      var displayTier = displayHintTier(catalogMeta.hintTier);
      var blanket = pickContextBlanket(
        catalogMeta.lastDoc,
        catalogMeta.matchedTitle || title,
        catalogMeta.matchedAuthor || author,
        displayTier
      );
      var detailInLead =
        matchBox &&
        matchBox.classList.contains("is-visible") &&
        matchLead &&
        String(matchLead.textContent || "").trim().length > 0;
      var v = verdictFor(
        title,
        author,
        displayTier,
        catalogMeta.hintDetail,
        catalogMeta.matchedTitle,
        catalogMeta.matchedAuthor,
        catalogMeta.familyPortrayal,
        catalogMeta.deityComfort,
        blanket,
        catalogMeta.hintTier,
        {
          detailShownInMatchLead: detailInLead,
          signals: catalogMeta.hintSignals,
          familyAction: catalogMeta.hintFamilyAction,
          vetSource: catalogMeta.vetSource,
        }
      );
      var vetBanner = "";
      var VS = global.HalalitBookcheckVetSource;
      if (VS && typeof VS.bannerHtml === "function") {
        applyVetSourceMeta(title, author, catalogMeta.lastDoc);
        vetBanner = VS.bannerHtml(catalogMeta.vetSource, {
          fanserviceNotChecked: catalogMeta.fanserviceNotChecked,
          aiSeriesNote: catalogMeta.aiSeriesNote,
        });
      }
      var headline = v.headline;
      if (catalogMeta.compactReport && catalogMeta.familyReport && global.HalalitBookcheckReport) {
        var ar =
          typeof global.HalalitBookcheckReport.autoRejectionSummary === "function"
            ? global.HalalitBookcheckReport.autoRejectionSummary(catalogMeta.familyReport, {
                tier: catalogMeta.hintTier,
                detail: catalogMeta.hintDetail,
              })
            : null;
        if (catalogMeta.vetSource === "hand_vetted" || catalogMeta.hintTier === "verified_clean") {
          headline = "Hand-checked — vetted";
        } else if (catalogMeta.hintTier === "user_discretion") {
          headline = "Hand-checked — your discretion";
        } else if (
          catalogMeta.hintTier === "fanservice_caution" ||
          catalogMeta.hintTier === "preview_caution" ||
          catalogMeta.hintTier === "deity_comfort"
        ) {
          headline = "Hand-checked — see note";
        } else if (ar && ar.status === "reject") {
          headline = "Automatic hard rejection";
        } else if (catalogMeta.vetSource === "ai_staging_likely_reject") {
          headline = "AI likely rejection — not manually checked";
        } else if (catalogMeta.vetSource === "ai_staging_manual_review") {
          headline = "AI flagged for review — not hand-checked";
        } else if (catalogMeta.vetSource === "ai_staging_likely_pass") {
          headline = "AI likely okay — not hand-checked";
        } else if (catalogMeta.vetSource === "owner_rejected" || catalogMeta.hintTier === "flag_review") {
          headline = "Hand-flagged";
        } else if (catalogMeta.fanserviceNotChecked || catalogMeta.familyReport.isGraphic) {
          headline = "Preview panels first";
        } else if (catalogMeta.vetSource === "ai_themes") {
          headline = "AI scan — no hard-rule flags";
        } else {
          headline = "Not hand-read — hard rules look clear";
        }
      } else if (catalogMeta.compactReport) {
        if (catalogMeta.vetSource === "hand_vetted" || catalogMeta.hintTier === "verified_clean") {
          headline = "Hand-checked — vetted";
        } else if (catalogMeta.hintTier === "user_discretion") {
          headline = "Hand-checked — your discretion";
        } else if (catalogMeta.vetSource === "ai_staging_likely_reject") {
          headline = "AI likely rejection — not manually checked";
        } else if (catalogMeta.vetSource === "ai_staging_manual_review") {
          headline = "AI flagged for review — not hand-checked";
        } else if (catalogMeta.vetSource === "ai_staging_likely_pass") {
          headline = "AI likely okay — not hand-checked";
        } else if (catalogMeta.vetSource === "owner_rejected" || catalogMeta.hintTier === "flag_review") {
          headline = "Hand-flagged";
        } else if (catalogMeta.vetSource === "ai_themes") {
          headline =
            v.kind === "no"
              ? "AI flagged concerns — not hand-read"
              : "Not hand-read — no AI red flags";
        } else if (catalogMeta.hintTier === "fanservice_caution" || catalogMeta.hintTier === "preview_caution") {
          headline = "Hand-checked — preview first";
        } else {
          headline =
            v.kind === "no"
              ? "Likely not clean"
              : v.kind === "yes"
                ? "Hand-checked clean"
                : "Not hand-read yet";
        }
      }
      verdictBox.className = "bookcheck-verdict bookcheck-verdict--" + v.kind;
      verdictBox.hidden = false;
      verdictBox.innerHTML =
        vetBanner +
        "<p class=\"bookcheck-verdict__headline\">" +
        escapeHtml(headline) +
        "</p>" +
        (catalogMeta.familyReport && global.HalalitBookcheckReport
          ? global.HalalitBookcheckReport.renderHtml(catalogMeta.familyReport, {
              compact: catalogMeta.compactReport,
              vetSource: catalogMeta.vetSource,
            })
          : verdictActionHtml(v, { hideFamilyAction: catalogMeta.compactReport })) +
        (v.body &&
        !(catalogMeta.familyReport && catalogMeta.familyReport.mode === "curated")
          ? '<div class="bookcheck-verdict__body">' + formatNoteHtml(v.body) + "</div>"
          : "") +
        (v.contextBlanket
          ? "<p class=\"bookcheck-verdict__blanket muted\">" + escapeHtml(v.contextBlanket) + "</p>"
          : "") +
        (v.matchLine && !catalogMeta.compactReport
          ? "<p class=\"bookcheck-verdict__match muted\">" + v.matchLine + "</p>"
          : "");
      if (catalogMeta.compactReport) {
        if (seriesNoteEl) {
          seriesNoteEl.hidden = true;
          seriesNoteEl.innerHTML = "";
        }
      } else {
        if (wikiNoteEl && catalogMeta.wikipedia) {
          showWikiNote(catalogMeta.wikipedia);
        }
        if (wikidataNoteEl && catalogMeta.wikidata) {
          showWikidataNote(catalogMeta.wikidata);
        }
        showSeriesNote(title, author);
      }
      if (catalogMeta.fromScanner) {
        scrollScannerResultIntoView();
      }
      maybeShowOwnerReviewPending(title, author, v, catalogMeta);
      try {
        global.dispatchEvent(
          new CustomEvent("halalit-bookcheck-verdict", {
            detail: { title: title, author: author },
          })
        );
      } catch (eEvt) {}
    }

    function scrollScannerResultIntoView() {
      if (!verdictBox || verdictBox.hidden) return;
      function go() {
        try {
          verdictBox.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (eScroll) {
          verdictBox.scrollIntoView(true);
        }
        try {
          verdictBox.focus({ preventScroll: true });
        } catch (eFocus) {
          /* ignore */
        }
      }
      if (typeof global.requestAnimationFrame === "function") {
        global.requestAnimationFrame(function () {
          global.requestAnimationFrame(go);
        });
      } else {
        global.setTimeout(go, 0);
      }
    }

    function catalogHintLeadHtml(hint) {
      var showTier = displayHintTier(hint.tier);
      var cls =
        showTier === "verified_clean"
          ? "catalog-hint-ok"
          : showTier === "flag_review" || showTier === "teen_caution"
            ? "catalog-hint-warn"
            : showTier === "deity_comfort" ||
                showTier === "preview_caution" ||
                showTier === "fanservice_caution" ||
                showTier === "user_discretion"
              ? "catalog-hint-neutral"
            : showTier === "not_verified" || showTier === "unclear" || showTier === "likely_youth"
              ? "catalog-hint-neutral"
              : "";
      var html = '<div class="catalog-hint-lead ' + cls + '">' + formatNoteHtml(filterComfortNoteText(hint.detail)) + "</div>";
      if (hint.familyPortrayal && hint.familyPortrayal.detail) {
        html +=
          '<div class="catalog-hint-note"><strong>' +
          escapeHtml(hint.familyPortrayal.label || "Family is portrayed negatively") +
          "</strong>" +
          formatNoteHtml(hint.familyPortrayal.detail) +
          "</div>";
      }
      if (hint.mentalHealthComfort && hint.mentalHealthComfort.detail) {
        var mhDetail = filterComfortNoteText(hint.mentalHealthComfort.detail);
        if (mhDetail) {
          html +=
            '<div class="catalog-hint-note"><strong>' +
            escapeHtml(hint.mentalHealthComfort.label || "Mental-health comfort note") +
            "</strong>" +
            formatNoteHtml(mhDetail) +
            "</div>";
        }
      }
      if (hint.culturalRepresentation && hint.culturalRepresentation.detail && culturalNoteVisible()) {
        html +=
          '<div class="catalog-hint-note"><strong>' +
          escapeHtml(hint.culturalRepresentation.label || "Cultural misrepresentation") +
          "</strong>" +
          formatNoteHtml(hint.culturalRepresentation.detail) +
          "</div>";
      }
      if (hint.proColonialCaution && hint.proColonialCaution.detail) {
        html +=
          '<div class="catalog-hint-note"><strong>' +
          escapeHtml(hint.proColonialCaution.label || "Pro-colonial narrative (read with care)") +
          "</strong>" +
          formatNoteHtml(hint.proColonialCaution.detail) +
          "</div>";
      }
      if (hint.faithInStory && hint.faithInStory.detail) {
        html +=
          '<div class="catalog-hint-note"><strong>' +
          escapeHtml(hint.faithInStory.label || "Christian faith in the story (not deity/mythology)") +
          "</strong>" +
          formatNoteHtml(hint.faithInStory.detail) +
          "</div>";
      }
      if (hint.parentNote && hint.parentNote.detail) {
        html +=
          '<div class="catalog-hint-note"><strong>' +
          escapeHtml(hint.parentNote.label || "Notes for parents") +
          "</strong>" +
          formatNoteHtml(hint.parentNote.detail) +
          "</div>";
      }
      if (hint.authorOtherWorks && hint.authorOtherWorks.detail) {
        html +=
          '<div class="catalog-hint-note catalog-hint-note--warning"><strong>' +
          escapeHtml(hint.authorOtherWorks.label || "WARNING:") +
          "</strong>" +
          formatNoteHtml(hint.authorOtherWorks.detail) +
          "</div>";
      }
      if (hint.deityComfort && hint.deityComfort.detail) {
        html +=
          '<div class="catalog-hint-note"><strong>' +
          escapeHtml(hint.deityComfort.label || "Deity or mythology (comfort note)") +
          "</strong>" +
          formatNoteHtml(hint.deityComfort.detail) +
          "</div>";
      }
      return html;
    }

    function finishApplyDoc(doc, ttl, auth, hint, supplementPack, hadWikipedia, wikipedia, wikidata) {
      catalogMeta.lastDoc = doc || null;
      catalogMeta.hintTier = hint.tier;
      catalogMeta.hintDetail = hint.detail;
      catalogMeta.familyPortrayal = hint.familyPortrayal || null;
      catalogMeta.culturalRepresentation = hint.culturalRepresentation || null;
      catalogMeta.proColonialCaution = hint.proColonialCaution || null;
      catalogMeta.faithInStory = hint.faithInStory || null;
      catalogMeta.parentNote = hint.parentNote || null;
      catalogMeta.authorOtherWorks = hint.authorOtherWorks || null;
      catalogMeta.deityComfort = hint.deityComfort || null;
      catalogMeta.hintSignals = hint.signals || [];
      catalogMeta.hintFamilyAction = hint.familyAction || "";
      catalogMeta.hadWikipedia = !!hadWikipedia;
      catalogMeta.wikipedia = wikipedia || catalogMeta.wikipedia;
      catalogMeta.wikidata = wikidata || catalogMeta.wikidata;
      var enteredTitle = titleIn ? String(titleIn.value || "").trim() : ttl;
      var enteredAuthor = authorIn ? String(authorIn.value || "").trim() : auth;
      applyVetSourceMeta(enteredTitle, enteredAuthor, doc);
      catalogMeta.familyReport = buildFamilyReport(
        enteredTitle,
        enteredAuthor,
        doc,
        hint,
        supplementPack,
        hadWikipedia,
        catalogMeta.wikipedia,
        catalogMeta.wikidata,
        {
          aiScanOk: catalogMeta.aiScanOk,
          fanserviceNotChecked: catalogMeta.fanserviceNotChecked,
          aiSeriesNote: catalogMeta.aiSeriesNote,
        }
      );
      catalogMeta.matchedTitle = ttl;
      catalogMeta.matchedAuthor = auth;
      if (matchBox && matchLead) {
        if (!catalogMeta.compactReport) {
          matchLead.innerHTML = catalogHintLeadHtml(hint);
          matchBox.classList.add("is-visible");
        } else if (matchBox) {
          matchBox.classList.remove("is-visible");
        }
        if (matchList) matchList.innerHTML = "";
      }
      showVerdict(enteredTitle, enteredAuthor);
      recordLookupForOwner(enteredTitle, enteredAuthor);
    }

    function applyDoc(doc) {
      var ttl = normalizeOlTitle(doc);
      var auth = Array.isArray(doc.author_name) && doc.author_name.length ? doc.author_name.join(", ") : "";
      var enteredTitle = titleIn ? String(titleIn.value || "").trim() : "";
      var enteredAuthor = authorIn ? String(authorIn.value || "").trim() : "";
      var VSdoc = global.HalalitBookcheckVetSource;
      var handOnEntered =
        VSdoc && typeof VSdoc.resolveHandVetHint === "function"
          ? VSdoc.resolveHandVetHint(enteredTitle, enteredAuthor)
          : null;
      if (handOnEntered) {
        finishApplyDoc(doc, ttl, auth, handOnEntered, { combined: "", description: "" }, false, null, null);
        return;
      }
      var aiPreHint = null;
      if (VSdoc && typeof VSdoc.resolveAiStagingHint === "function") {
        aiPreHint = VSdoc.resolveAiStagingHint(enteredTitle, enteredAuthor);
      }
      if (titleIn && ttl && titleScore(enteredTitle, ttl) >= 88) titleIn.value = ttl;
      var canonDoc =
        VSdoc && typeof VSdoc.canonicalBarcodeBook === "function"
          ? VSdoc.canonicalBarcodeBook(enteredTitle, enteredAuthor)
          : null;
      if (authorIn && auth) {
        if (
          canonDoc &&
          canonDoc.author &&
          (!enteredAuthor || authorScore(canonDoc.author, doc) >= authorScore(auth, doc))
        ) {
          authorIn.value = canonDoc.author;
        } else if (!enteredAuthor || authorScore(enteredAuthor, doc) >= 88) {
          authorIn.value = auth;
        }
      }
      var preHint = inferHint(doc);
      if (aiPreHint) {
        preHint = strongerHint(
          {
            tier: aiPreHint.tier,
            detail: aiPreHint.detail,
            signals: preHint.signals || [],
            familyAction: preHint.familyAction || "",
          },
          preHint
        );
      }
      if (isSettledHandHint(preHint, enteredTitle, enteredAuthor)) {
        finishApplyDoc(doc, ttl, auth, preHint, { combined: "", description: "" }, false, null, null);
        return;
      }
      enrichHintsAndFinish(doc, ttl, auth, preHint);
    }

    function mergeHandAdvisories(hint, title, author) {
      var Policy = global.HalalitFamilyShelfPolicy;
      if (!Policy || !hint) return hint;
      var merged = Object.assign({}, hint);
      if (typeof Policy.parentNoteAdvisory === "function") {
        var pn = Policy.parentNoteAdvisory(title, author);
        if (pn) merged.parentNote = pn;
      }
      if (typeof Policy.faithInStoryAdvisory === "function") {
        var fs = Policy.faithInStoryAdvisory(title, author);
        if (fs) merged.faithInStory = fs;
      }
      if (typeof Policy.familyPortrayalAdvisory === "function") {
        var fp = Policy.familyPortrayalAdvisory(title, author);
        if (fp) merged.familyPortrayal = fp;
      }
      if (typeof Policy.mentalHealthComfortAdvisory === "function") {
        var mh = Policy.mentalHealthComfortAdvisory(title, author);
        if (mh) merged.mentalHealthComfort = mh;
      }
      if (typeof Policy.proColonialCautionAdvisory === "function") {
        var pc = Policy.proColonialCautionAdvisory(title, author);
        if (pc) merged.proColonialCaution = pc;
      }
      if (typeof Policy.culturalRepresentationAdvisory === "function") {
        var cr = Policy.culturalRepresentationAdvisory(title, author);
        if (cr) merged.culturalRepresentation = cr;
      }
      if (typeof Policy.authorOtherWorksAdvisory === "function") {
        var aw = Policy.authorOtherWorksAdvisory(title, author);
        if (aw) merged.authorOtherWorks = aw;
      }
      return merged;
    }

    function applyHandVetHint(handHint, ownTitle, ownAuthor) {
      handHint = mergeHandAdvisories(handHint, ownTitle, ownAuthor);
      catalogMeta.hintTier = handHint.tier;
      catalogMeta.hintDetail = handHint.detail;
      catalogMeta.hintSignals = handHint.signals || [];
      catalogMeta.hintFamilyAction = handHint.familyAction || "";
      catalogMeta.parentNote = handHint.parentNote || null;
      catalogMeta.familyReport = buildFamilyReport(
        ownTitle,
        ownAuthor,
        null,
        handHint,
        { combined: "", description: "" },
        false,
        null,
        null
      );
      catalogMeta.aiScanOk = false;
      applyVetSourceMeta(ownTitle, ownAuthor, null);
      showVerdict(ownTitle, ownAuthor);
      recordLookupForOwner(ownTitle, ownAuthor);
      if (statusEl) {
        statusEl.textContent =
          handHint.tier === "verified_clean"
            ? "Matched Halalit’s hand-verified list."
            : handHint.tier === "preview_caution"
              ? "Children’s comic or manga—preview recommended."
              : handHint.tier === "fanservice_caution"
                ? "Hand-checked comic—lighter fanservice caution."
                : handHint.tier === "deity_comfort"
                  ? "Catalog or notes mention deity or mythology (comfort note)."
                  : "Matched Halalit’s hand-checked rules.";
      }
    }

    function runLookup() {
      var ownTitle = titleIn ? String(titleIn.value || "").trim() : "";
      var ownAuthor = authorIn ? String(authorIn.value || "").trim() : "";
      if (!ownTitle) {
        if (statusEl) statusEl.textContent = "Type a title first.";
        return;
      }
      var keepFromScanner = catalogMeta.fromScanner;
      var keepCompact = catalogMeta.compactReport;
      resetUi();
      catalogMeta.fromScanner = keepFromScanner;
      catalogMeta.compactReport = keepCompact;
      catalogMeta.lookupLogTitle = ownTitle;
      catalogMeta.lookupLogAuthor = ownAuthor;
      var Policy = global.HalalitFamilyShelfPolicy;
      if (Policy && typeof Policy.hardExclusionDetailForTitle === "function") {
        var earlyDetail = Policy.hardExclusionDetailForTitle(ownTitle, ownAuthor);
        if (earlyDetail) {
          catalogMeta.hintTier = "flag_review";
          catalogMeta.hintDetail = earlyDetail;
          catalogMeta.hintSignals = [];
          catalogMeta.hintFamilyAction =
            typeof Policy.familyActionLine === "function"
              ? Policy.familyActionLine("flag_review", [], ownTitle)
              : "";
          catalogMeta.familyReport = buildFamilyReport(
            ownTitle,
            ownAuthor,
            null,
            { tier: "flag_review", detail: earlyDetail, signals: [], familyAction: catalogMeta.hintFamilyAction },
            { combined: "", description: "" },
            false,
            null,
            null
          );
          catalogMeta.aiScanOk = false;
          applyVetSourceMeta(ownTitle, ownAuthor, null);
          showVerdict(ownTitle, ownAuthor);
          recordLookupForOwner(ownTitle, ownAuthor);
          if (statusEl) statusEl.textContent = "Matched Halalit’s never-recommend rules (hardest tier).";
          return;
        }
      }
      var VS = global.HalalitBookcheckVetSource;
      var handHint =
        VS && typeof VS.resolveHandVetHint === "function" ? VS.resolveHandVetHint(ownTitle, ownAuthor) : null;
      if (handHint) {
        applyHandVetHint(handHint, ownTitle, ownAuthor);
        return;
      }
      var preCatalogHint = inferHint({
        title: ownTitle,
        author_name: ownAuthor ? ownAuthor.split(/\s*,\s*/).map(function (s) { return s.trim(); }).filter(Boolean) : [],
      });
      if (isSettledHandHint(preCatalogHint, ownTitle, ownAuthor)) {
        applyHandVetHint(preCatalogHint, ownTitle, ownAuthor);
        return;
      }
      var url = buildOpenLibraryQueryUrl(ownTitle, ownAuthor);
      if (!url) return;
      if (lookupBtn) lookupBtn.disabled = true;
      if (statusEl) statusEl.textContent = "Searching Open Library, Wikipedia, and Wikidata…";
      function finishLookupDocs(raw, fromFallback) {
        var pinPack = applyCatalogPinToRaw(raw, ownTitle, ownAuthor);
        raw = pinPack.docs;
        var refined = filterConfidentCatalogMatches(
          refineCatalogDocs(raw || [], ownTitle, ownAuthor),
          ownAuthor
        );
        if (!refined.length) {
          var noHitHint = inferHint({
            title: ownTitle,
            author_name: ownAuthor
              ? ownAuthor.split(/\s*,\s*/).map(function (s) {
                  return s.trim();
                }).filter(Boolean)
              : [],
          });
          var VSno = global.HalalitBookcheckVetSource;
          var aiNo =
            VSno && typeof VSno.resolveAiStagingHint === "function"
              ? VSno.resolveAiStagingHint(ownTitle, ownAuthor)
              : null;
          if (aiNo) {
            noHitHint = strongerHint(
              {
                tier: aiNo.tier,
                detail: aiNo.detail,
                signals: noHitHint.signals || [],
                familyAction: noHitHint.familyAction || "",
              },
              noHitHint
            );
          }
          catalogMeta.hintTier = noHitHint.tier === "unclear" ? "unclear" : noHitHint.tier;
          catalogMeta.hintDetail =
            noHitHint.tier === "unclear"
              ? "No catalog match—judging from what you typed only."
              : noHitHint.detail;
          catalogMeta.hintSignals = noHitHint.signals || [];
          catalogMeta.hintFamilyAction = noHitHint.familyAction || "";
          if (statusEl) statusEl.textContent = "No catalog match—try AI theme scan…";
          runAiThenFinish(
            null,
            ownTitle,
            ownAuthor,
            noHitHint,
            { combined: "", description: "" },
            false,
            null,
            null
          );
          return;
        }
          if (shouldAutoPick(refined, ownAuthor)) {
            applyDoc(refined[0].doc);
            if (statusEl) {
              statusEl.textContent = pinPack.pinMessage
                ? pinPack.pinMessage
                : fromFallback
                  ? "Matched from a broader catalog search."
                  : refined.length === 1 || raw.length === refined.length
                    ? "Matched the catalog record."
                    : "Several editions looked alike—Halalit picked the closest match automatically.";
            }
            return;
          }
          if (statusEl) statusEl.textContent = "A few different books share that name—pick the one you mean:";
          if (matchBox && matchLead && matchList) {
            matchLead.textContent = "These look like different books, not just duplicate editions:";
            matchBox.classList.add("is-visible");
            matchList.innerHTML = "";
            for (var i = 0; i < refined.length; i++) {
              (function (doc) {
                var li = document.createElement("li");
                var b = document.createElement("button");
                b.type = "button";
                b.textContent = matchButtonLabel(doc);
                b.addEventListener("click", function () {
                  applyDoc(doc);
                  if (statusEl) statusEl.textContent = "Match selected.";
                });
                li.appendChild(b);
                matchList.appendChild(li);
              })(refined[i].doc);
            }
          }
      }
      global
        .fetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error("lookup failed");
          return r.json();
        })
        .then(function (data) {
          var raw = (data && data.docs) || [];
          var refined = refineCatalogDocs(raw, ownTitle, ownAuthor);
          if (refined.length) {
            if (lookupBtn) lookupBtn.disabled = false;
            finishLookupDocs(raw, false);
            return;
          }
          var fallbackUrl = buildOpenLibraryFallbackQUrl(ownTitle, ownAuthor);
          if (!fallbackUrl) {
            if (lookupBtn) lookupBtn.disabled = false;
            finishLookupDocs(raw, false);
            return;
          }
          if (statusEl) statusEl.textContent = "Trying a broader catalog search…";
          global
            .fetch(fallbackUrl)
            .then(function (r2) {
              if (!r2.ok) throw new Error("lookup failed");
              return r2.json();
            })
            .then(function (data2) {
              if (lookupBtn) lookupBtn.disabled = false;
              finishLookupDocs((data2 && data2.docs) || [], true);
            })
            .catch(function () {
              if (lookupBtn) lookupBtn.disabled = false;
              finishLookupDocs(raw, false);
            });
        })
        .catch(function () {
          if (lookupBtn) lookupBtn.disabled = false;
          catalogMeta.hintTier = "unclear";
          catalogMeta.hintDetail = "Couldn’t reach Open Library—try again when you’re online.";
          if (statusEl) statusEl.textContent = "Lookup failed.";
          showVerdict(ownTitle, ownAuthor);
        });
    }

    function refreshBookcheckDisplay() {
      if (!catalogMeta.hintTier) return;
      var title = titleIn ? titleIn.value.trim() : "";
      var author = authorIn ? authorIn.value.trim() : "";
      if (matchBox && matchLead && matchBox.classList.contains("is-visible")) {
        matchLead.innerHTML = catalogHintLeadHtml({
          tier: catalogMeta.hintTier,
          detail: catalogMeta.hintDetail,
          familyPortrayal: catalogMeta.familyPortrayal,
          culturalRepresentation: catalogMeta.culturalRepresentation,
          faithInStory: catalogMeta.faithInStory,
          parentNote: catalogMeta.parentNote,
          authorOtherWorks: catalogMeta.authorOtherWorks,
          deityComfort: catalogMeta.deityComfort,
        });
      }
      showVerdict(title, author);
    }

    function wireBookcheckExcludePref(boxId, allowsFn, setAllowsFn) {
      var Policy = global.HalalitFamilyShelfPolicy;
      var box = panel.querySelector(boxId);
      if (!box || !Policy || typeof allowsFn !== "function" || typeof setAllowsFn !== "function") return;
      box.checked = !allowsFn.call(Policy);
      box.addEventListener("change", function () {
        setAllowsFn.call(Policy, !box.checked);
        refreshBookcheckDisplay();
      });
    }

    function wireBookcheckReaderAge() {
      var Policy = global.HalalitFamilyShelfPolicy;
      var fieldset = panel.querySelector("#bookcheckReaderAgeFieldset");
      if (!fieldset || !Policy || typeof Policy.getBookQuestReaderAgeBand !== "function") return;
      var current = Policy.getBookQuestReaderAgeBand();
      fieldset.querySelectorAll('input[name="bookcheckReaderAge"]').forEach(function (radio) {
        radio.checked = current === radio.value;
        radio.addEventListener("change", function () {
          if (radio.checked && typeof Policy.setBookQuestReaderAgeBand === "function") {
            Policy.setBookQuestReaderAgeBand(radio.value);
            refreshBookcheckDisplay();
          }
        });
      });
    }

    wireBookcheckReaderAge();
    var PolicyRef = global.HalalitFamilyShelfPolicy;
    if (!Policy) Policy = PolicyRef;
    if (PolicyRef) {
      wireBookcheckExcludePref(
        "#bookcheckExcludeDeityMythology",
        PolicyRef.bookQuestAllowsDeityMythology,
        PolicyRef.setBookQuestAllowsDeityMythology
      );
      wireBookcheckExcludePref(
        "#bookcheckExcludeNegativeFamilyPortrayal",
        PolicyRef.bookQuestAllowsFamilyCommunityTone,
        PolicyRef.setBookQuestAllowsFamilyCommunityTone
      );
      wireBookcheckExcludePref(
        "#bookcheckExcludeLightRomance",
        PolicyRef.bookQuestAllowsLightRomance,
        PolicyRef.setBookQuestAllowsLightRomance
      );
      wireBookcheckExcludePref(
        "#bookcheckExcludeMagic",
        PolicyRef.bookQuestAllowsMagic,
        PolicyRef.setBookQuestAllowsMagic
      );
      wireBookcheckExcludePref(
        "#bookcheckExcludeSubstance",
        PolicyRef.bookQuestAllowsSubstance,
        PolicyRef.setBookQuestAllowsSubstance
      );
      wireBookcheckExcludePref(
        "#bookcheckExcludeCulturalMisrepresentation",
        PolicyRef.bookQuestAllowsCulturalMisrepresentation,
        PolicyRef.setBookQuestAllowsCulturalMisrepresentation
      );
      wireBookcheckExcludePref(
        "#bookcheckExcludeMentalHealth",
        PolicyRef.bookQuestAllowsMentalHealthComfort,
        PolicyRef.setBookQuestAllowsMentalHealthComfort
      );
    }

    if (lookupBtn) lookupBtn.addEventListener("click", runLookup);
    if (titleIn) {
      titleIn.addEventListener("input", resetUi);
      titleIn.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          runLookup();
        }
      });
    }
    if (authorIn) authorIn.addEventListener("input", resetUi);

    function prefillAndLookup(title, author, lookupOpts) {
      lookupOpts = lookupOpts || {};
      if (titleIn) titleIn.value = String(title || "").trim();
      if (authorIn) authorIn.value = String(author || "").trim();
      resetUi();
      catalogMeta.fromScanner = !!lookupOpts.fromScanner;
      catalogMeta.compactReport = !!lookupOpts.fromScanner || !!lookupOpts.ownerTesting;
      catalogMeta.ownerTesting = lookupOpts.ownerTesting !== undefined ? !!lookupOpts.ownerTesting : !!opts.ownerTesting;
      runLookup();
      if (!lookupOpts.fromScanner && titleIn) {
        try {
          titleIn.focus({ preventScroll: true });
        } catch (eFocus) {
          titleIn.focus();
        }
      }
    }

    if (panel.id) bookcheckPanels[panel.id] = { prefillAndLookup: prefillAndLookup };
    if (opts.primary !== false && (opts.primary || !bookcheckPanels.__primary)) {
      bookcheckPanels.__primary = bookcheckPanels[panel.id];
    }

    bookcheckPrefillAndLookup = prefillAndLookup;
  }

  var bookcheckPrefillAndLookup = null;

  global.HalalitBookcheck = {
    init: init,
    prefillAndLookup: function (title, author, lookupOpts) {
      lookupOpts = lookupOpts || {};
      var panelId = lookupOpts.panelId;
      var api =
        (panelId && bookcheckPanels[panelId]) ||
        bookcheckPanels.__primary ||
        (typeof bookcheckPrefillAndLookup === "function" ? { prefillAndLookup: bookcheckPrefillAndLookup } : null);
      if (api && typeof api.prefillAndLookup === "function") {
        api.prefillAndLookup(title, author, lookupOpts);
      }
    },
  };
})(typeof window !== "undefined" ? window : this);
