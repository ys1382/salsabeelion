/**
 * Halalit — canonical catalog pins for famous titles (Bookcheck, library enrich, Book Quest).
 * When the reader types the core title only, narrow Open Library hits to the main novel/book.
 * If they type a longer title (e.g. "… coloring book"), do not narrow — they asked for that edition.
 */
(function (global) {
  function normKey(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function normalizeOlTitle(doc) {
    var t = doc && doc.title;
    if (Array.isArray(t)) return String(t[0] || "").trim();
    return String(t || "").trim();
  }

  function authorLine(doc) {
    var names = doc && doc.author_name;
    return names && names.length ? names.join(", ") : "";
  }

  /** Reader spelled out a non-main edition in the search box — show full catalog list. */
  var VARIANT_IN_QUERY_RE =
    /\bcoloring\b|\bcolouring\b|\bactivity\s+book\b|\bworkbook\b|\bstudy\s+guide\b|\bsparknotes\b|\bcliffsnotes\b|\baudiobook\b|\bfilm\s+comic\b|\bpicture\s+book\b|\bgraphic\s+novel\b|\bcomic\s+adaptation\b|\bart\s+of\b|\bsketchbook\b|\bart\s+book\b|\bhow\s+to\s+draw\b|\bmanga\b|\bgraphic\s+novel\s+adaptation\b/i;

  /** Catalog row is a tie-in / art book / comic — not the main novel for a pin. */
  var NON_MAIN_DOC_TITLE_RE =
    /\bcoloring\b|\bcolouring\b|\bactivity\s+book\b|\bworkbook\b|\bstudy\s+guide\b|\baudiobook\b|\bfilm\s+comic\b|\bfilm\s+comics\b|\bpicture\s+book\b|\bgraphic\s+novel\b|\bcomic\s+adaptation\b|\bthe\s+art\s+of\b|\bsketchbook\b|\bart\s+book\b|\bvolume\s+\d+\b|\bvol\.?\s*\d+\b|\bpaperback,\s*reprint\b|\bby\s+hayao\s+miyazaki\b/i;

  /**
   * @typedef {object} CatalogPin
   * @property {string} id
   * @property {string} queryExactNorm — normalized query must equal this (core title only)
   * @property {string} docTitleExactNorm — catalog row title must equal this
   * @property {string} authorNeedle — substring required in author line (normalized)
   * @property {RegExp} [authorExcludeRe]
   * @property {string[]} [preferWorkKeys] — Open Library /works/… keys, best first
   */

  /** @type {CatalogPin[]} */
  var PINS = [
    {
      id: "heidi",
      queryExactNorm: "heidi",
      docTitleExactNorm: "heidi",
      authorNeedle: "spyri",
      authorExcludeRe: /abridged|retold|adaptation|picture book|coloring/i,
    },
    {
      id: "fablehaven",
      queryExactNorm: "fablehaven",
      docTitleExactNorm: "fablehaven",
      authorNeedle: "mull",
      authorExcludeRe: /cookbook|imagination|caretaker/i,
    },
    {
      id: "kiki-delivery-service",
      queryExactNorm: "kiki s delivery service",
      docTitleExactNorm: "kiki s delivery service",
      authorNeedle: "kadono",
      authorExcludeRe: /miyazaki|oniki|animejyu|studio ghibli|je park|sumino/i,
      preferWorkKeys: ["/works/OL26649W", "/works/OL20760219W", "/works/OL39182246W"],
    },
  ];

  function queryWantsNonMainEdition(queryTitle) {
    return VARIANT_IN_QUERY_RE.test(String(queryTitle || ""));
  }

  function findPinForQuery(queryTitle) {
    if (queryWantsNonMainEdition(queryTitle)) return null;
    var qn = normKey(queryTitle);
    if (!qn) return null;
    for (var i = 0; i < PINS.length; i++) {
      if (PINS[i].queryExactNorm === qn) return PINS[i];
    }
    return null;
  }

  function docMatchesPin(doc, pin) {
    var ttl = normKey(normalizeOlTitle(doc));
    if (ttl !== pin.docTitleExactNorm) return false;
    var auth = normKey(authorLine(doc));
    if (!auth || auth.indexOf(normKey(pin.authorNeedle)) === -1) return false;
    if (pin.authorExcludeRe && pin.authorExcludeRe.test(auth)) return false;
    if (NON_MAIN_DOC_TITLE_RE.test(normKey(normalizeOlTitle(doc)))) return false;
    return true;
  }

  function pickPreferredDoc(matches, pin) {
    if (!matches.length) return null;
    if (matches.length === 1) return matches[0];
    var prefer = pin.preferWorkKeys || [];
    for (var p = 0; p < prefer.length; p++) {
      for (var i = 0; i < matches.length; i++) {
        if (String(matches[i].key || "") === prefer[p]) return matches[i];
      }
    }
    var best = matches[0];
    var bestYear = matches[0].first_publish_year;
    if (bestYear == null || bestYear !== bestYear) bestYear = 9999;
    for (var j = 1; j < matches.length; j++) {
      var y = matches[j].first_publish_year;
      if (y == null || y !== y) continue;
      if (y < bestYear) {
        bestYear = y;
        best = matches[j];
      }
    }
    return best;
  }

  /**
   * @param {object[]} docs — Open Library search docs
   * @param {string} queryTitle
   * @param {string} [_queryAuthor] — reserved; pin uses query title shape only unless extended later
   * @returns {{ docs: object[], pinned: boolean, pinId: string|null, message: string|null }}
   */
  function filterCatalogDocs(docs, queryTitle, _queryAuthor) {
    var list = docs && docs.length ? docs.slice() : [];
    var pin = findPinForQuery(queryTitle);
    if (!pin) return { docs: list, pinned: false, pinId: null, message: null };
    var matches = [];
    for (var i = 0; i < list.length; i++) {
      if (docMatchesPin(list[i], pin)) matches.push(list[i]);
    }
    if (!matches.length) return { docs: list, pinned: false, pinId: pin.id, message: null };
    var chosen = pickPreferredDoc(matches, pin);
    if (!chosen) return { docs: list, pinned: false, pinId: pin.id, message: null };
    return {
      docs: [chosen],
      pinned: true,
      pinId: pin.id,
      message: "Halalit matched the main book for this title—not tie-ins or art editions.",
    };
  }

  global.HalalitCatalogPins = {
    PINS: PINS,
    VARIANT_IN_QUERY_RE: VARIANT_IN_QUERY_RE,
    NON_MAIN_DOC_TITLE_RE: NON_MAIN_DOC_TITLE_RE,
    queryWantsNonMainEdition: queryWantsNonMainEdition,
    findPinForQuery: findPinForQuery,
    filterCatalogDocs: filterCatalogDocs,
  };
})(typeof window !== "undefined" ? window : globalThis);
