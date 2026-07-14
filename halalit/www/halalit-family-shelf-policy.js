/**
 * Halalit — family-shelf suitability for recommendations and community titles.
 * Juvenile / children's catalog tags alone do not qualify a book.
 */
(function (global) {
  function store() {
    return global.HalalitAccountStorage || null;
  }

  /** Open Library subject_facet / subject strings that rule a title out for the family shelf. */
  var FAMILY_SHELF_SUBJECT_WARN_RE =
    /illegitim|born out of wedlock|out[- ]of[- ]wedlock|unwed mothers?|bastardy|children of unmarried parents/i;

  var LGBTQ_SUBJECT_WARN_RE =
    /\blgbt\b|lesbian|gay men|gay teen|homosexual|queer fiction|gender identity|transgender|same[- ]sex/i;

  /** Descriptions, Wikipedia intros, and deeper catalog text — broader than subject tags alone. */
  var LGBTQ_TEXT_RE =
    /\blgbtq?\b|lesbian|gay\b|homosexual|queer\b|transgender|non[- ]?binary|they\/them|two[- ]moms?|two[- ]mothers?|two[- ]dads?|two[- ]fathers?|same[- ]sex marriage|gender[- ]fluid|bisexual|nonbinary/i;

  var LGBTQ_ABSENT_RE =
    /\bno (?:explicit )?(?:mention of )?lgbtq|no lgbtq|without (?:explicit )?lgbtq|(?:do|does) not (?:contain|include|feature|indicate|show|depict)|not indicate any lgbtq|no (?:gay|lesbian|queer|transgender|non[- ]binary)\b/i;

  var GRAPHIC_FORMAT_RE =
    /\bcomic books?\b|\bgraphic novels?\b|\bgraphic books?\b|\bmanga\b|\bcomics\b|\bgraphic fiction\b|\bsketchbooks?\b|\bart books?\b/i;

  var FANSERVICE_TEXT_RE =
    /\bfanservice\b|\bfan service\b|\becchi\b|panty shot|pantyshot|revealing (?:outfit|clothing|costume)|sexualized|sexualised|immodest(?:y)?\b/i;

  /** Romance / relationship tags when the book is not clearly all-ages children's. */
  var ROMANCE_SUBJECT_RE =
    /\bromance\b|romantic fiction|love stories|romantic love|dating fiction|romantic relationships/i;

  /** Extra scan on descriptions or review snippets when Bookcheck fetches them. */
  var SUPPLEMENT_THEME_RE =
    /romantic tension|romantic subplot|love triangle|betrothed|betrothal|crush on|sexual tension|erotic romance|adult romance|fantasy horror|young adult series/i;

  /** Catalog subjects or descriptions suggesting deity, spirits, or mythology treated as real. */
  var DEITY_MYTHOLOGY_STRONG_RE =
    /\bmythology\b|\bmythological\b|\b(?:gods|goddesses|deities)\b|\bdemigods?\b|\bolympians?\b|\bpantheon\b|\b(?:norse|greek|roman|egyptian|celtic|chinese|japanese|hindu|aztec|mayan|african|korean|vietnamese|irish|welsh)\s+(?:mythology|myths?|legends?|folklore)\b|\bjade emperor\b|\bcelestial being\b|\bimmortals?\b.*\b(?:emperor|realm|palace|heaven)\b/i;

  var DEITY_COMFORT_DETAIL =
    "Deity, spirits, or folklore treated as real—some readers skip these. Halalit won’t Book Quest this; not calling it inappropriate.";

  var EXCLUSION_ILLEGITIMATE_CHILDREN_DETAIL =
    "Excluded: plot centers on children born out of wedlock—not OK for Halalit’s family shelf, even with juvenile tags.";

  var EXCLUSION_GROUP_DEMONIZATION_DETAIL =
    "Excluded: demonizes a whole race, religion, ethnicity, or people group (naming specific injustice is fine).";

  var EXCLUSION_PRO_COLONIAL_DETAIL =
    "Won’t recommend: pro-colonial narrative—imperial or colonial framing treated as natural or good.";

  /** Hardest never-recommend (Book Quest + family shelf): illegitimacy-centered plot, LGBTQ-centered plot, adult romance, harsh swearing/slurs, hardcore group demonization, pro-colonial narrative. */
  var EXCLUSION_CRUDE_PROFANITY_DETAIL =
    "Excluded: harsh swearing or crude language (slurs, sexual swear words, and rear-end or bodily-function curses)—outside Halalit’s family shelf.";

  var NONFICTION_RELIABILITY_DISCRETION_DETAIL =
    "Nonfiction—Halalit has not hand-checked factual reliability or content cleanliness. Preview and decide as a family; Halalit won’t recommend until the owner vets it.";

  var NONFICTION_SIGNAL_LABEL = "Nonfiction (catalog)—factual reliability not hand-checked";

  var ADULT_REALISTIC_FICTION_DISCRETION_DETAIL =
    "Adult-range realistic fiction—Halalit has not hand-checked content cleanliness for your family. Preview and decide; Halalit won’t recommend until the owner vets it.";

  var ADULT_REALISTIC_SIGNAL_LABEL =
    "Adult-range realistic fiction (catalog)—content cleanliness not hand-checked";

  /** Hard-ban patterns — catalog/plot/title scan; not an exhaustive list of every rude word. */
  var CRUDE_PROFANITY_PATTERNS = [
    /\bf+\W*u+\W*c+\W*k(?:ing|ed|er|ers|s)?\b/i,
    /\bmother\s*f+\W*u+\W*c+\W*k(?:er|ers|ing)?\b/i,
    /\bmf+\W*er\b|\bmother\s*f+\W*er\b/i,
    /\bbitch(?:es)?\b/i,
    /\bson\s*of\s*a\s*bitch\b/i,
    /\bsh+\W*i+\W*t+(?:ty|s|ting|ted)?\b/i,
    /\bbull\s*sh+\W*i+\W*t\b/i,
    /\bcrap(?:py)?\b/i,
    /\bass(?:hole|wipe)?\b/i,
    /\b(?:bad|dumb|smart|jack|kick\s*your)\s*ass(?:es)?\b/i,
    /\bpiss(?:ed|ing|es)?\b/i,
    /\bdouche(?:bag|y|s)?\b/i,
    /\bcunt(?:s)?\b/i,
    /\bdick(?:head|s)?\b/i,
    /\bcock(?:sucker|s)?\b/i,
    /\bpuss(?:y|ies)\b/i,
    /\bwhor(?:e|es)\b/i,
    /\bslut(?:ty|s)?\b/i,
    /\bgoddamn(?:ed|it)?\b/i,
    /\bnigg(?:a|er|as|ers)\b/i,
    /\bn+\W*i+\W*g+\W*g+\W*[ae3]*\W*r?s?\b/i,
    /\bf+\s*[\*\-_\.]+\s*ck\b/i,
    /\bsh+\s*[\*\-_\.]+\s*t\b/i,
  ];

  var CRUDE_PROFANITY_SUBJECT_RE = /profan|vulgar|swear|obscene|offensive language|explicit language/i;

  function textMentionsCrudeProfanity(text) {
    var raw = String(text || "");
    if (!raw.trim()) return false;
    var lowered = raw.toLowerCase();
    for (var i = 0; i < CRUDE_PROFANITY_PATTERNS.length; i++) {
      if (CRUDE_PROFANITY_PATTERNS[i].test(lowered)) return true;
    }
    var collapsed = lowered.replace(/[^a-z0-9]+/g, " ");
    if (/\bfuck|\bbitch|\bshit|\bnigger|\bnigga|\bcunt\b/.test(collapsed)) return true;
    return false;
  }

  function crudeProfanityDetailForText(text) {
    return textMentionsCrudeProfanity(text) ? EXCLUSION_CRUDE_PROFANITY_DETAIL : null;
  }

  var GRAPHIC_UNVETTED_DETAIL =
    "Comics, manga, graphic novels, sketchbooks, and art books need a Halalit hand-check before recommendations or Book Quest—catalog tags are not enough.";

  var BOOKQUEST_EXCLUDE_DEITY_KEY = "halalit_bookquest_exclude_deity_mythology";
  var BOOKQUEST_EXCLUDE_FAMILY_PORTRAYAL_KEY = "halalit_bookquest_exclude_negative_family_portrayal";
  var BOOKQUEST_EXCLUDE_LIGHT_ROMANCE_KEY = "halalit_bookquest_exclude_light_romance";
  var BOOKQUEST_EXCLUDE_MAGIC_KEY = "halalit_bookquest_exclude_magic";
  var BOOKQUEST_EXCLUDE_SUBSTANCE_KEY = "halalit_bookquest_exclude_alcohol_drug";
  var BOOKQUEST_EXCLUDE_CULTURAL_MISREPRESENTATION_KEY = "halalit_bookquest_exclude_cultural_misrepresentation";
  var BOOKQUEST_EXCLUDE_MENTAL_HEALTH_KEY = "halalit_bookquest_exclude_mental_health";
  /** Legacy opt-in keys — cleared when saving exclude prefs. */
  var BOOKQUEST_LEGACY_ALLOW_KEYS = [
    "halalit_bookquest_allow_deity_mythology",
    "halalit_bookquest_allow_family_community_tone",
    "halalit_bookquest_allow_light_romance",
    "halalit_bookquest_allow_magic",
    "halalit_bookquest_allow_alcohol_drug",
    "halalit_bookquest_allow_cultural_misrepresentation",
  ];

  function clearLegacyBookQuestAllowKeys() {
    try {
      if (!store()) return;
      for (var i = 0; i < BOOKQUEST_LEGACY_ALLOW_KEYS.length; i++) {
        store().removeItem(BOOKQUEST_LEGACY_ALLOW_KEYS[i]);
      }
    } catch (e) {
      /* ignore */
    }
  }

  function bookQuestPrefAllows(excludeKey) {
    try {
      return !(store() && store().getItem(excludeKey) === "1");
    } catch (e) {
      return true;
    }
  }

  function setBookQuestPrefAllows(excludeKey, allows) {
    try {
      if (!store()) return;
      if (allows) store().removeItem(excludeKey);
      else store().setItem(excludeKey, "1");
      clearLegacyBookQuestAllowKeys();
    } catch (e) {
      /* ignore */
    }
  }

  function bookQuestAllowsLightRomance() {
    return bookQuestPrefAllows(BOOKQUEST_EXCLUDE_LIGHT_ROMANCE_KEY);
  }

  function setBookQuestAllowsLightRomance(on) {
    setBookQuestPrefAllows(BOOKQUEST_EXCLUDE_LIGHT_ROMANCE_KEY, !!on);
  }

  function bookQuestAllowsDeityMythology() {
    return bookQuestPrefAllows(BOOKQUEST_EXCLUDE_DEITY_KEY);
  }

  function setBookQuestAllowsDeityMythology(on) {
    setBookQuestPrefAllows(BOOKQUEST_EXCLUDE_DEITY_KEY, !!on);
  }

  function bookQuestAllowsFamilyCommunityTone() {
    return bookQuestPrefAllows(BOOKQUEST_EXCLUDE_FAMILY_PORTRAYAL_KEY);
  }

  function setBookQuestAllowsFamilyCommunityTone(on) {
    setBookQuestPrefAllows(BOOKQUEST_EXCLUDE_FAMILY_PORTRAYAL_KEY, !!on);
  }

  function bookQuestAllowsMagic() {
    return bookQuestPrefAllows(BOOKQUEST_EXCLUDE_MAGIC_KEY);
  }

  function setBookQuestAllowsMagic(on) {
    setBookQuestPrefAllows(BOOKQUEST_EXCLUDE_MAGIC_KEY, !!on);
  }

  function bookQuestAllowsSubstance() {
    return bookQuestPrefAllows(BOOKQUEST_EXCLUDE_SUBSTANCE_KEY);
  }

  function setBookQuestAllowsSubstance(on) {
    setBookQuestPrefAllows(BOOKQUEST_EXCLUDE_SUBSTANCE_KEY, !!on);
  }

  function bookQuestAllowsCulturalMisrepresentation() {
    return bookQuestPrefAllows(BOOKQUEST_EXCLUDE_CULTURAL_MISREPRESENTATION_KEY);
  }

  function setBookQuestAllowsCulturalMisrepresentation(on) {
    setBookQuestPrefAllows(BOOKQUEST_EXCLUDE_CULTURAL_MISREPRESENTATION_KEY, !!on);
  }

  function bookQuestAllowsMentalHealthComfort() {
    return bookQuestPrefAllows(BOOKQUEST_EXCLUDE_MENTAL_HEALTH_KEY);
  }

  function setBookQuestAllowsMentalHealthComfort(on) {
    setBookQuestPrefAllows(BOOKQUEST_EXCLUDE_MENTAL_HEALTH_KEY, !!on);
  }

  /** Mental-health comfort opt-out applies only for older-child / teen+ bands—not young child. */
  function mentalHealthComfortAppliesToReaderBand(readerBand) {
    var band = readerBand || getBookQuestReaderAgeBand();
    if (!band || band === "young_child") return false;
    return band === "older_child_young_teen" || band === "older_teen_adult";
  }

  var BOOKQUEST_READER_AGE_KEY = "halalitBookQuestReaderAgeBand";
  var VALID_READER_AGE_BANDS = {
    young_child: true,
    older_child_young_teen: true,
    older_teen_adult: true,
  };

  function getBookQuestReaderAgeBand() {
    try {
      if (!store()) return null;
      var v = store().getItem(BOOKQUEST_READER_AGE_KEY);
      return VALID_READER_AGE_BANDS[v] ? v : null;
    } catch (e) {
      return null;
    }
  }

  function setBookQuestReaderAgeBand(band) {
    try {
      if (!store() || !VALID_READER_AGE_BANDS[band]) return;
      store().setItem(BOOKQUEST_READER_AGE_KEY, band);
    } catch (e) {
      /* ignore */
    }
  }

  function bookQuestMatchesReaderAge(title, author, variantId, readerBand) {
    var Age = global.HalalitBookQuestAgeRatings;
    if (!Age || typeof Age.matchesReaderBand !== "function") return true;
    var rb = readerBand || getBookQuestReaderAgeBand();
    if (!rb) return false;
    return Age.matchesReaderBand(rb, variantId, title, author);
  }

  function curatedWarningBlocksFamilyShelf(title, author, opts) {
    if (verifiedCleanHint(title, author)) return false;
    var cw = curatedWarning(title, author);
    if (!cw) return false;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (opts && opts.allowLightRomance && Cur && typeof Cur.bookQuestLightRomanceUnblocks === "function") {
      if (Cur.bookQuestLightRomanceUnblocks(title, author, cw)) return false;
    }
    if (opts && opts.allowFamilyCommunityTone) {
      if (
        Cur &&
        typeof Cur.bookQuestFamilyCommunityToneUnblocks === "function" &&
        Cur.bookQuestFamilyCommunityToneUnblocks(title, author, cw)
      ) {
        return false;
      }
    }
    if (opts && opts.allowMagic) {
      if (Cur && typeof Cur.bookQuestMagicUnblocks === "function" && Cur.bookQuestMagicUnblocks(title, author, cw)) {
        return false;
      }
    }
    if (opts && opts.allowSubstance) {
      if (
        Cur &&
        typeof Cur.bookQuestSubstanceUnblocks === "function" &&
        Cur.bookQuestSubstanceUnblocks(title, author, cw)
      ) {
        return false;
      }
    }
    if (opts && opts.allowDeityMythology) {
      if (
        Cur &&
        typeof Cur.bookQuestDeityUnblocks === "function" &&
        Cur.bookQuestDeityUnblocks(title, author, cw)
      ) {
        return false;
      }
    }
    return true;
  }

  /** Curated deity/mythology gate only—null if another concern blocks Book Quest. */
  function bookQuestDeityMythologyBlock(title, author) {
    var vc = verifiedCleanHint(title, author);
    if (vc && vc.requiresDeityMythologyOptIn) return vc;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.deityComfortMatch === "function") {
      var dc = Cur.deityComfortMatch(title, author);
      if (
        dc &&
        dc.detail &&
        typeof Cur.bookQuestDeityUnblocks === "function" &&
        Cur.bookQuestDeityUnblocks(title, author, dc)
      ) {
        return dc;
      }
    }
    return null;
  }

  /** Curated light-romance gate—null if another concern blocks Book Quest. */
  function bookQuestLightRomanceBlock(title, author) {
    var vc = verifiedCleanHint(title, author);
    if (vc && vc.requiresLightRomanceOptIn) return vc;
    if (vc && vc.requiresDeityMythologyOptIn) return null;
    var cw = curatedWarning(title, author);
    if (!cw) return null;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.bookQuestLightRomanceUnblocks === "function" && Cur.bookQuestLightRomanceUnblocks(title, author, cw)) {
      return cw;
    }
    return null;
  }

  /** Curated negative-family-portrayal gate only—null if another concern blocks Book Quest. */
  function bookQuestFamilyCommunityToneBlock(title, author) {
    var cw = curatedWarning(title, author);
    if (!cw) return null;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (
      Cur &&
      typeof Cur.bookQuestFamilyCommunityToneUnblocks === "function" &&
      Cur.bookQuestFamilyCommunityToneUnblocks(title, author, cw)
    ) {
      return cw;
    }
    return null;
  }

  /** Hand-checked advisory or verified-clean notes with sustained negative family portrayal. */
  function bookQuestNegativeFamilyPortrayalBlock(title, author) {
    if (bookQuestFamilyCommunityToneBlock(title, author)) return bookQuestFamilyCommunityToneBlock(title, author);
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.bookQuestNegativeFamilyPortrayalMatch === "function") {
      return Cur.bookQuestNegativeFamilyPortrayalMatch(title, author);
    }
    return null;
  }

  /** Curated fantasy-magic gate only—null if another concern blocks Book Quest. */
  function bookQuestMagicBlock(title, author) {
    var vc = verifiedCleanHint(title, author);
    if (vc && vc.requiresMagicOptIn) return vc;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.titleSuggestsFantasyMagic === "function" && Cur.titleSuggestsFantasyMagic(title) && !vc) {
      return {
        tier: "magic_comfort",
        detail: "Fantasy magic in this title—fine to skip if your family doesn’t read that.",
      };
    }
    var cw = curatedWarning(title, author);
    if (!cw) return null;
    if (Cur && typeof Cur.bookQuestMagicUnblocks === "function" && Cur.bookQuestMagicUnblocks(title, author, cw)) {
      return cw;
    }
    return null;
  }

  /** Curated light alcohol/drug gate only—null if another concern blocks Book Quest. */
  function bookQuestSubstanceBlock(title, author) {
    var vc = verifiedCleanHint(title, author);
    if (vc && vc.requiresSubstanceOptIn) return vc;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (
      Cur &&
      typeof Cur.curatedDetailSubstanceOptIn === "function" &&
      Cur.curatedDetailSubstanceOptIn(title, author)
    ) {
      return { tier: "substance_comfort", detail: "Light alcohol or similar mentions in hand-checked notes." };
    }
    var cw = curatedWarning(title, author);
    if (!cw) return null;
    if (
      Cur &&
      typeof Cur.bookQuestSubstanceUnblocks === "function" &&
      Cur.bookQuestSubstanceUnblocks(title, author, cw)
    ) {
      return cw;
    }
    return null;
  }

  /** Curated cultural-misrepresentation gate only—not group demonization. */
  /** Curated mental-health weight gate—null if title has no flagged mental-health comfort note. */
  function bookQuestMentalHealthComfortBlock(title, author) {
    var vc = verifiedCleanHint(title, author);
    if (vc && vc.requiresMentalHealthComfortOptIn) return vc;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.mentalHealthComfortMatch === "function") {
      return Cur.mentalHealthComfortMatch(title, author);
    }
    return null;
  }

  function bookQuestCulturalMisrepresentationBlock(title, author) {
    var vc = verifiedCleanHint(title, author);
    if (vc && vc.requiresCulturalMisrepresentationOptIn) return vc;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.culturalRepresentationMatch === "function" && Cur.culturalRepresentationMatch(title, author)) {
      return { tier: "cultural_comfort", detail: "Cultural misrepresentation in hand-checked notes." };
    }
    return null;
  }

  /**
   * Hand-maintained exclusions: plot centers on illegitimate children even when tagged juvenile fiction.
   * Match on normalized title + author (author substring allowed when multiple authors listed).
   */
  var BLOCKED_BY_TITLE = [
    { title: "the secret starling", author: "judith rossell" },
    { title: "secret starling", author: "judith rossell" },
  ];

  /** Hand-maintained exclusions: demonizes an entire race, religion, ethnicity, or similar group. */
  var BLOCKED_GROUP_DEMONIZATION_BY_TITLE = [];

  function normalizeTitleKey(title, author) {
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

  function normalizeOlTitle(doc) {
    var t = doc && doc.title;
    if (Array.isArray(t)) return String(t[0] || "").trim();
    return String(t || "").trim();
  }

  function authorsFromDoc(doc) {
    return Array.isArray(doc && doc.author_name) && doc.author_name.length ? doc.author_name.join(", ") : "";
  }

  function foldAccents(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function normTitle(title) {
    return foldAccents(String(title || ""))
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function normAuthor(author) {
    return String(author || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function curatedWarning(title, author) {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.userDiscretionParkedMatch === "function") {
      var parked = Cur.userDiscretionParkedMatch(title, author);
      if (parked) return parked;
    }
    if (Cur && typeof Cur.noRecommendKnownFanserviceMatch === "function") {
      var fanservice = Cur.noRecommendKnownFanserviceMatch(title, author);
      if (fanservice) return fanservice;
    }
    if (Cur && typeof Cur.match === "function") return Cur.match(title, author);
    return null;
  }

  function noRecommendKnownFanservice(title, author) {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.noRecommendKnownFanserviceMatch === "function") {
      return !!Cur.noRecommendKnownFanserviceMatch(title, author);
    }
    return false;
  }

  function graphicFanserviceCautionHint(title, author) {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.graphicFanserviceCautionMatch === "function") {
      return Cur.graphicFanserviceCautionMatch(title, author);
    }
    return null;
  }

  function isGraphicFanserviceCaution(title, author) {
    return !!graphicFanserviceCautionHint(title, author);
  }

  function deityComfortDetailText() {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && Cur.deityComfortDetail) return String(Cur.deityComfortDetail);
    return DEITY_COMFORT_DETAIL;
  }

  /** Hard exclusions and curated flag_review — no deity comfort layer. */
  function deityComfortBlocked(title, author) {
    if (hardExclusionDetailForTitle(title, author)) return true;
    if (curatedWarning(title, author)) return true;
    return false;
  }

  function deityComfortLabelText() {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && Cur.deityComfortLabel) return String(Cur.deityComfortLabel);
    return "Deity or mythology (comfort note)";
  }

  function textSuggestsDeityMythology(text) {
    var blob = String(text || "").toLowerCase();
    if (!blob) return false;
    if (DEITY_MYTHOLOGY_STRONG_RE.test(blob)) return true;
    if (/\bfolklore\b/.test(blob) && /\b(?:fantasy|magic|myth|fairy|juvenile|children)/.test(blob)) return true;
    return false;
  }

  /**
   * @param {string} title
   * @param {string} author
   * @param {string} [textBlob]
   * @param {{ forVerifiedClean?: boolean }} [opts]
   * @returns {{ label: string, detail: string }|null}
   */
  function deityComfortNote(title, author, textBlob, opts) {
    if (deityComfortBlocked(title, author)) return null;
    var forVerified = opts && opts.forVerifiedClean;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (
      forVerified &&
      Cur &&
      typeof Cur.faithInStoryMatch === "function" &&
      Cur.faithInStoryMatch(title, author)
    ) {
      return null;
    }
    if (Cur && typeof Cur.deityComfortMatch === "function") {
      var manual = Cur.deityComfortMatch(title, author);
      if (manual) {
        return {
          label: deityComfortLabelText(),
          detail: forVerified && Cur.deityComfortDetailVerified ? String(Cur.deityComfortDetailVerified) : manual.detail,
        };
      }
    }
    if (!textBlob || !textSuggestsDeityMythology(textBlob)) return null;
    var detail = deityComfortDetailText();
    if (forVerified && Cur && Cur.deityComfortDetailVerified) detail = String(Cur.deityComfortDetailVerified);
    return { label: deityComfortLabelText(), detail: detail };
  }

  /**
   * Full-tier block (not hand-verified). @returns {{ tier: string, detail: string }|null}
   */
  function deityComfortAdvisory(title, author, textBlob) {
    if (verifiedCleanHint(title, author)) return null;
    var note = deityComfortNote(title, author, textBlob);
    if (!note) return null;
    return { tier: "deity_comfort", detail: note.detail };
  }

  function maybeApplyDeityComfort(result, title, author, textBlob) {
    if (!result || result.tier === "flag_review") return result;
    if (result.tier === "verified_clean") {
      if (result.ownerAiThemeAbsent && result.ownerAiThemeAbsent.deity_mythology) return result;
      var noteOnClean = deityComfortNote(title, author, textBlob, { forVerifiedClean: true });
      if (!noteOnClean) return result;
      return Object.assign({}, result, { deityComfort: noteOnClean });
    }
    var dc = deityComfortAdvisory(title, author, textBlob);
    if (dc) return dc;
    return result;
  }

  function verifiedCleanHint(title, author) {
    var Ov = global.HalalitOwnerVetsRuntime;
    if (Ov && typeof Ov.verifiedCleanMatch === "function") {
      var ownerMatch = Ov.verifiedCleanMatch(title, author);
      if (ownerMatch) return ownerMatch;
    }
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.verifiedCleanMatch === "function") return Cur.verifiedCleanMatch(title, author);
    return null;
  }

  function isHandVerifiedClean(title, author) {
    return !!verifiedCleanHint(title, author);
  }

  var COMMUNITY_TITLES_KEY = "halalitCommunityTitleSubmissions";

  /** Personal Library, want-to-read, or affirmed community titles show Islamic-literature interest. */
  function readerHasIslamicLiteratureInterest() {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (!Cur || typeof Cur.readerTitleSignalsIslamicLiteratureInterest !== "function") return false;

    function check(title, author, titlePlain) {
      if (Cur.readerTitleSignalsIslamicLiteratureInterest(title || "", author || "")) return true;
      if (titlePlain && Cur.readerTitleSignalsIslamicLiteratureInterest(String(titlePlain), "")) return true;
      return false;
    }

    var Lib = global.HalalitPersonalLibrary;
    if (Lib && typeof Lib.load === "function") {
      var shelf = Lib.load();
      for (var i = 0; i < shelf.length; i++) {
        var e = shelf[i];
        if (check(e.title, e.author, e.titlePlain)) return true;
        if (e.titlePlain && Lib.parseTitlePlain) {
          var sp = Lib.parseTitlePlain(e.titlePlain);
          if (check(sp.title, sp.author, null)) return true;
        }
      }
    }

    if (global.HalalitWantToRead && typeof global.HalalitWantToRead.load === "function") {
      var want = global.HalalitWantToRead.load();
      for (var w = 0; w < want.length; w++) {
        var we = want[w];
        if (check(we.title, we.author, we.titlePlain)) return true;
      }
    }

    try {
      if (!store()) return false;
      var raw = store().getItem(COMMUNITY_TITLES_KEY);
      if (!raw) return false;
      var comm = JSON.parse(raw);
      if (!Array.isArray(comm)) return false;
      for (var c = 0; c < comm.length; c++) {
        var ce = comm[c];
        if (check(ce.title, ce.author, ce.titlePlain)) return true;
      }
    } catch (err) {
      return false;
    }
    return false;
  }

  function familyPortrayalAdvisory(title, author) {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.familyPortrayalMatch === "function") return Cur.familyPortrayalMatch(title, author);
    return null;
  }

  function attachFamilyPortrayalAdvisory(result, title, author) {
    if (!result || typeof result !== "object") return result;
    var fp = familyPortrayalAdvisory(title, author);
    if (!fp) return result;
    return Object.assign({}, result, { familyPortrayal: fp });
  }

  function mentalHealthComfortAdvisory(title, author) {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.mentalHealthComfortMatch === "function") return Cur.mentalHealthComfortMatch(title, author);
    return null;
  }

  function attachMentalHealthComfortAdvisory(result, title, author) {
    if (!result || typeof result !== "object") return result;
    var mh = mentalHealthComfortAdvisory(title, author);
    if (!mh) return result;
    return Object.assign({}, result, { mentalHealthComfort: mh });
  }

  function culturalRepresentationAdvisory(title, author) {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.culturalRepresentationMatch === "function") return Cur.culturalRepresentationMatch(title, author);
    return null;
  }

  function attachCulturalRepresentationAdvisory(result, title, author) {
    if (!result || typeof result !== "object") return result;
    var cr = culturalRepresentationAdvisory(title, author);
    if (!cr) return result;
    return Object.assign({}, result, { culturalRepresentation: cr });
  }

  function proColonialCautionAdvisory(title, author) {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.proColonialCautionMatch === "function") return Cur.proColonialCautionMatch(title, author);
    return null;
  }

  function attachProColonialCautionAdvisory(result, title, author) {
    if (!result || typeof result !== "object") return result;
    var pc = proColonialCautionAdvisory(title, author);
    if (!pc) return result;
    return Object.assign({}, result, { proColonialCaution: pc });
  }

  function faithInStoryAdvisory(title, author) {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.faithInStoryMatch === "function") return Cur.faithInStoryMatch(title, author);
    return null;
  }

  function attachFaithInStoryAdvisory(result, title, author) {
    if (!result || typeof result !== "object") return result;
    var fs = faithInStoryAdvisory(title, author);
    if (!fs) return result;
    return Object.assign({}, result, { faithInStory: fs });
  }

  function parentNoteAdvisory(title, author) {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.parentNoteMatch === "function") return Cur.parentNoteMatch(title, author);
    return null;
  }

  function attachParentNoteAdvisory(result, title, author) {
    if (!result || typeof result !== "object") return result;
    var pn = parentNoteAdvisory(title, author);
    if (!pn) return result;
    return Object.assign({}, result, { parentNote: pn });
  }

  function authorOtherWorksAdvisory(title, author) {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.authorOtherWorksMatch === "function") return Cur.authorOtherWorksMatch(title, author);
    return null;
  }

  function attachAuthorOtherWorksAdvisory(result, title, author) {
    if (!result || typeof result !== "object") return result;
    var aw = authorOtherWorksAdvisory(title, author);
    if (!aw) return result;
    return Object.assign({}, result, { authorOtherWorks: aw });
  }

  /** @returns {object|null} matching block entry */
  function titleMatchesBlockedList(title, author, list) {
    var tl = normTitle(title);
    var al = normAuthor(author);
    if (!tl) return null;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var titleOk = tl === e.title || tl.indexOf(e.title) >= 0;
      if (!titleOk) continue;
      if (!e.author) return e;
      if (!al) return e;
      if (al.indexOf(e.author) >= 0) return e;
    }
    return null;
  }

  function titleMatchesBlocked(title, author) {
    return titleMatchesBlockedList(title, author, BLOCKED_BY_TITLE);
  }

  function titleMatchesGroupDemonizationBlocked(title, author) {
    return titleMatchesBlockedList(title, author, BLOCKED_GROUP_DEMONIZATION_BY_TITLE);
  }

  function titleMatchesProColonialBlocked(title, author) {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.proColonialNoRecommendMatch === "function") {
      return !!Cur.proColonialNoRecommendMatch(title, author);
    }
    return false;
  }

  function proColonialExclusionDetailForTitle(title, author) {
    if (!titleMatchesProColonialBlocked(title, author)) return null;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.proColonialNoRecommendMatch === "function") {
      var hit = Cur.proColonialNoRecommendMatch(title, author);
      if (hit && hit.detail) return hit.detail;
    }
    return EXCLUSION_PRO_COLONIAL_DETAIL;
  }

  /** @returns {string|null} hardest never-recommend */
  function hardExclusionDetailForTitle(title, author) {
    if (titleMatchesBlocked(title, author)) return EXCLUSION_ILLEGITIMATE_CHILDREN_DETAIL;
    if (titleMatchesGroupDemonizationBlocked(title, author)) return EXCLUSION_GROUP_DEMONIZATION_DETAIL;
    var proColonial = proColonialExclusionDetailForTitle(title, author);
    if (proColonial) return proColonial;
    var profanity = crudeProfanityDetailForText(title);
    if (profanity) return profanity;
    return null;
  }

  function subjectBlob(doc, supplementText) {
    var parts = [];
    if (doc && doc.subject_facet && doc.subject_facet.length) parts = doc.subject_facet.slice(0, 24);
    else if (doc && doc.subject && doc.subject.length) parts = doc.subject.slice(0, 24);
    var blob = parts.join(" ").toLowerCase();
    if (supplementText) blob += " " + String(supplementText).toLowerCase();
    return blob.trim();
  }

  function titleLooksNonfiction(title) {
    var tl = normTitle(title);
    if (!tl) return false;
    if (/\b(biograph|autobiograph|memoir|cookbook|field guide|atlas|encyclopedia|true story)\b/i.test(tl)) return true;
    if (/\bhistory of\b/i.test(tl) && !/\bfiction\b/i.test(tl)) return true;
    return false;
  }

  /** Open Library subjects, descriptions, or title heuristics — not a guarantee. */
  function catalogBlobLooksNonfiction(blob, title) {
    var b = String(blob || "").toLowerCase();
    var tl = normTitle(title);
    if (/\bnonfiction\b|\bnon-fiction\b/.test(b)) return true;
    if (/\bbiograph|\bautobiograph|\bmemoir/.test(b)) return true;
    if (/\bcookery\b|\bcookbook\b/.test(b)) return true;
    if (/\bhistory\b/.test(b) && !/\bfiction\b|\bnovel\b|\bromance\b/.test(b)) return true;
    if (/\btrue stor(?:y|ies)\b|\btrue account/.test(b)) return true;
    if (
      /\bjuvenile literature\b|\bjuvenile works\b|\bchildren'?s nonfiction\b/.test(b) &&
      /\b(biograph|history|science|nature|social stud|mathematic|inventions?)\b/.test(b)
    ) {
      return true;
    }
    return titleLooksNonfiction(tl);
  }

  /** Literary / contemporary / domestic fiction for teen+ readers—not genre fantasy, SF, mystery, or nonfiction. */
  function catalogBlobLooksAdultRealisticFiction(blob, title) {
    if (catalogBlobLooksNonfiction(blob, title)) return false;
    var b = String(blob || "").toLowerCase();
    if (!b) return false;
    if (
      /juvenile fiction|juvenile works|children'?s fiction|children'?s stories|picture books|young readers|chapter books/.test(
        b
      ) &&
      !/\bteen\b|\byoung adult\b|\bya\b/.test(b)
    ) {
      return false;
    }
    if (/\bfantasy fiction\b|\bscience fiction\b|\bimaginary places\b|\bdystop/.test(b) && !/\bliterary\b|\bdomestic\b/.test(b)) {
      return false;
    }
    if (/\bmystery fiction\b|\bthriller fiction\b|\bhorror fiction\b/.test(b) && !/\bliterary\b|\bdomestic\b|\brealistic\b/.test(b)) {
      return false;
    }
    if (
      /\badult fiction\b|\bliterary fiction\b|\bdomestic fiction\b|\brealistic fiction\b|\bfamily saga\b|\bpsychological fiction\b|\bdomestic life\b|\bcontemporary fiction\b/.test(
        b
      )
    ) {
      return true;
    }
    if (
      /\bteen fiction\b|\byoung adult fiction\b|\bya fiction\b|\bcoming of age\b/.test(b) &&
      !/\bfantasy\b|\bscience fiction\b|\bmagic\b|\bmystery fiction\b/.test(b)
    ) {
      return true;
    }
    return false;
  }

  function bookQuestVariantIsRealisticFiction(genre) {
    return genre === "realistic_fiction" || genre === "realistic";
  }

  function isTeenBlob(blob) {
    return (
      /\bteen fiction\b|\bteenage\b|\byoung adult\b|\bya fiction\b|\bya\b/.test(blob) ||
      (/\bteen\b/.test(blob) && /fiction|novel|stories/.test(blob))
    );
  }

  function titleLooksGraphic(title) {
    return GRAPHIC_FORMAT_RE.test(normTitle(title));
  }

  function blobLooksGraphic(blob, title) {
    return GRAPHIC_FORMAT_RE.test(blob) || titleLooksGraphic(title);
  }

  /** Comics/manga/graphic novels — recommend only when owner (or future team) hand-verified. */
  function graphicFormatNeedsHandCheck(title, author, blob) {
    if (isHandVerifiedClean(title, author)) return false;
    if (isGraphicFanserviceCaution(title, author)) return false;
    var b = String(blob || "");
    return blobLooksGraphic(b, title);
  }

  function blobMentionsLgbtq(blob) {
    var b = String(blob || "");
    if (LGBTQ_SUBJECT_WARN_RE.test(b)) return true;
    if (!LGBTQ_TEXT_RE.test(b)) return false;
    if (LGBTQ_ABSENT_RE.test(b)) return false;
    return true;
  }

  function hintDetailIsLgbtqPolicy(detail) {
    return /lgbtq identity|lgbtq themes|mention lgbtq|flags lgbtq representation/i.test(String(detail || ""));
  }

  function subjectListAffirmsLgbtq(subjects) {
    var blob = (subjects || []).join(" ");
    return LGBTQ_SUBJECT_WARN_RE.test(blob);
  }

  function subjectsFromOlDoc(doc) {
    var raw = [];
    if (doc && doc.subject_facet && doc.subject_facet.length) raw = doc.subject_facet.slice(0, 40);
    else if (doc && doc.subject && doc.subject.length) raw = doc.subject.slice(0, 40);
    return raw
      .map(function (s) {
        return String(s || "").trim();
      })
      .filter(Boolean);
  }

  function signalMentionsLgbtq(signal) {
    return /lgbtq themes in catalog|lgbtq themes flagged by ai|ai scan:\s*lgbtq/i.test(String(signal || ""));
  }

  function filterLgbtqSignals(signals) {
    var out = [];
    for (var i = 0; i < (signals || []).length; i++) {
      if (!signalMentionsLgbtq(signals[i])) out.push(signals[i]);
    }
    return out;
  }

  /**
   * Keep catalog tier/detail aligned with AI LGBTQ scan — no warn + deny at once.
   */
  function reconcileHintLgbtqWithAiScan(hint, aiResult, doc, supplementCombined) {
    if (!hint || !aiResult || !aiResult.ok) return hint;
    var AI = global.HalalitBookcheckAi;
    var denied =
      AI && typeof AI.aiLgbtqThemeDenied === "function" ? AI.aiLgbtqThemeDenied(aiResult) : false;
    var present =
      AI && typeof AI.aiLgbtqThemePresent === "function" ? AI.aiLgbtqThemePresent(aiResult) : false;
    var tagsAffirm = subjectListAffirmsLgbtq(subjectsFromOlDoc(doc));
    var out = Object.assign({}, hint);
    out.signals = filterLgbtqSignals(out.signals || []);

    if (denied && !present && !tagsAffirm) {
      if (out.tier === "flag_review" && hintDetailIsLgbtqPolicy(out.detail)) {
        var fallback = inferCatalogFamilyHint(
          doc || { title: "" },
          supplementCombined
            ? { supplementText: supplementCombined, skipDescriptionLgbtq: true }
            : { skipDescriptionLgbtq: true }
        );
        out.tier = fallback.tier;
        out.detail = fallback.detail;
        out.signals = filterLgbtqSignals(fallback.signals || out.signals);
      }
      return out;
    }

    if (
      (present || tagsAffirm) &&
      out.tier !== "verified_clean" &&
      out.tier !== "user_discretion" &&
      out.tier !== "fanservice_caution"
    ) {
      out.tier = "flag_review";
      if (tagsAffirm) {
        out.detail = LGBTQ_SUBJECT_WARN_RE.test(subjectsFromOlDoc(doc).join(" "))
          ? "Tags mention LGBTQ identity or related themes—outside Halalit’s family shelf."
          : "Description or notes mention LGBTQ themes—outside Halalit’s family shelf.";
      } else {
        out.detail = "AI theme scan flags LGBTQ representation—outside Halalit’s family shelf.";
      }
      var lgbtqSignal = tagsAffirm
        ? "LGBTQ themes in catalog or description"
        : "LGBTQ themes flagged by AI theme scan";
      if (out.signals.indexOf(lgbtqSignal) === -1) out.signals = out.signals.concat([lgbtqSignal]);
    }
    return out;
  }

  /**
   * Short, family-facing bullets from catalog + description text (not hand-curated nuance).
   * @param {string} blob
   * @param {string} title
   * @returns {string[]}
   */
  function collectPracticalSignals(blob, title) {
    var signals = [];
    var b = String(blob || "");
    var tl = normTitle(title);
    if (!b && !tl) return signals;
    if (blob && blobMentionsLgbtq(b)) signals.push("LGBTQ themes in catalog or description");
    if (textMentionsCrudeProfanity(b) || textMentionsCrudeProfanity(tl)) {
      signals.push("Harsh swearing or slurs in catalog or description");
    }
    if (isTeenBlob(b)) signals.push("Teen or young-adult audience");
    if (ROMANCE_SUBJECT_RE.test(b) || SUPPLEMENT_THEME_RE.test(b)) signals.push("Romance or relationship thread mentioned");
    if (FAMILY_SHELF_SUBJECT_WARN_RE.test(b)) signals.push("Illegitimacy or similar in catalog tags");
    if (blobLooksGraphic(b, tl)) signals.push("Comics, manga, graphic novel, sketchbook, or art book");
    if (FANSERVICE_TEXT_RE.test(b)) signals.push("Suggestive or fanservice content mentioned");
    if (/juvenile fiction|juvenile works|children'?s fiction|children'?s stories|picture books|young readers/.test(b)) {
      signals.push("Tagged as children's or juvenile fiction");
    }
    if (catalogBlobLooksNonfiction(b, title)) signals.push(NONFICTION_SIGNAL_LABEL);
    if (catalogBlobLooksAdultRealisticFiction(b, title)) signals.push(ADULT_REALISTIC_SIGNAL_LABEL);
    if (textSuggestsDeityMythology(b)) signals.push("Deity, spirits, or mythology");
    var out = [];
    for (var i = 0; i < signals.length; i++) {
      if (out.indexOf(signals[i]) === -1) out.push(signals[i]);
    }
    return out;
  }

  /**
   * One plain “what to do” line for Bookcheck families.
   * @param {string} tier
   * @param {string[]} signals
   * @param {string} title
   */
  function familyActionLine(tier, signals, title, opts) {
    opts = opts || {};
    var sig = signals || [];
    var experienced = opts.experienced;
    if (experienced == null) {
      var Prefs = global.HalalitBookcheckPrefs;
      if (Prefs && typeof Prefs.isExperiencedBookcheckUser === "function") {
        experienced = Prefs.isExperiencedBookcheckUser();
      }
    }
    var graphic = blobLooksGraphic(sig.join(" "), title) || sig.indexOf("Comics, manga, or graphic novel") !== -1;
    if (tier === "flag_review") {
      return "Outside Halalit's family shelf—pick another title unless you plan to read this yourself first and judge.";
    }
    if (tier === "user_discretion") {
      if (sig.indexOf(NONFICTION_SIGNAL_LABEL) !== -1) {
        return experienced
          ? "Nonfiction — not hand reliability-checked yet."
          : "Nonfiction without a hand reliability check—Halalit won’t recommend until the owner vets; preview and decide.";
      }
      if (sig.indexOf(ADULT_REALISTIC_SIGNAL_LABEL) !== -1) {
        return experienced
          ? "Adult realistic fiction — not hand content-checked yet."
          : "Adult-range realistic fiction without a hand content check—Halalit won’t recommend until the owner vets; preview and decide.";
      }
      return "Hand-checked parent discretion—not LGBTQ, adult-romance, or hardest fanservice auto-reject. Read the note and decide.";
    }
    if (tier === "verified_clean") {
      return "A strong fit for Halalit's family shelf—read the notes below for any comfort details.";
    }
    if (tier === "deity_comfort") {
      return "OK for many families; skip if you avoid deity or mythology treated as real in stories.";
    }
    if (tier === "teen_caution") {
      return "Teen or YA—not the same as all-ages. Read it yourself first or wait until your kids are older.";
    }
    if (tier === "fanservice_caution") {
      return "Hand-checked comic with lighter fanservice caution than the heavy auto-reject list—Halalit won’t auto-recommend; preview human characters and outfits.";
    }
    if (tier === "preview_caution" || (graphic && tier !== "verified_clean")) {
      return experienced
        ? "Preview panels and tone before kids read."
        : "Preview the art and tone yourself before kids read—especially panels in comics, manga, sketchbooks, and art books.";
    }
    if (sig.length) {
      return experienced
        ? "Catalog hint — preview or skip."
        : "Catalog hints a concern but Halalit hasn't hand-checked this book—preview or skip unless you already know it.";
    }
    if (tier === "likely_youth" || tier === "not_verified") {
      return experienced
        ? "Not hand-vetted — preview if unsure."
        : "Looks like children's fiction but Halalit hasn't verified it—skim the first chapter or stick to authors you trust.";
    }
    if (tier === "unclear") {
      return experienced
        ? "No strong catalog match — add author or preview."
        : "We couldn't match this book well—fix the spelling, add the author, or preview before sharing with kids.";
    }
    return experienced
      ? "Not hand-vetted — preview if unsure."
      : "Not hand-verified—preview before you hand it to kids if you're unsure.";
  }

  function attachPracticalMeta(result, blob, title) {
    if (!result || typeof result !== "object") return result;
    var signals = collectPracticalSignals(blob, title);
    result.signals = signals;
    result.familyAction = familyActionLine(result.tier, signals, title);
    return result;
  }

  /**
   * Heuristic from Open Library subject tags — not a guarantee; parents still decide.
   * opts.supplementText — optional description/review text from a deeper catalog fetch.
   * Returns { tier, detail, familyPortrayal?: { label, detail } } — familyPortrayal is advisory only.
   */
  function inferCatalogFamilyHint(doc, opts) {
    var ttl = normalizeOlTitle(doc);
    var auth = authorsFromDoc(doc);
    var supplement = opts && opts.supplementText ? String(opts.supplementText) : "";

    var blob = subjectBlob(doc, supplement);

    function done(result) {
      if (textMentionsCrudeProfanity(ttl) || (blob && textMentionsCrudeProfanity(blob))) {
        result = {
          tier: "flag_review",
          detail: EXCLUSION_CRUDE_PROFANITY_DETAIL,
        };
      }
      result = attachFamilyPortrayalAdvisory(result, ttl, auth);
      result = attachMentalHealthComfortAdvisory(result, ttl, auth);
      result = attachCulturalRepresentationAdvisory(result, ttl, auth);
      result = attachProColonialCautionAdvisory(result, ttl, auth);
      result = attachFaithInStoryAdvisory(result, ttl, auth);
      result = attachParentNoteAdvisory(result, ttl, auth);
      result = attachAuthorOtherWorksAdvisory(result, ttl, auth);
      result = maybeApplyDeityComfort(result, ttl, auth, blob);
      return attachPracticalMeta(result, blob, ttl);
    }

    var hardExclusion = hardExclusionDetailForTitle(ttl, auth);
    if (hardExclusion) {
      return done({
        tier: "flag_review",
        detail: hardExclusion,
      });
    }

    var verified = verifiedCleanHint(ttl, auth);
    if (verified) return done(verified);

    var curated = curatedWarning(ttl, auth);
    if (curated) return done(curated);

    var fanserviceCaution = graphicFanserviceCautionHint(ttl, auth);
    if (fanserviceCaution) return done(fanserviceCaution);

    var Theme = global.HalalitThemeIndex;
    if (Theme && typeof Theme.match === "function") {
      var themeHit = Theme.match(ttl, auth);
      if (themeHit && themeHit.themes && themeHit.themes.length) {
        var src =
          themeHit.detail +
          (themeHit.listName
            ? "\n(Source: " + themeHit.listName + " — Halalit-approved list, not Goodreads.)"
            : "");
        var listTier = themeHit.shelfTier || "flag_review";
        if (listTier === "comfort") {
          return done({ tier: "deity_comfort", detail: src, themeIndex: themeHit });
        }
        if (listTier === "caution") {
          return done({ tier: "preview_caution", detail: src, themeIndex: themeHit });
        }
        return done({ tier: "flag_review", detail: src, themeIndex: themeHit });
      }
    }

    var teen = blob ? isTeenBlob(blob) : false;

    if (
      blob &&
      SUPPLEMENT_THEME_RE.test(blob) &&
      !/children'?s stories|picture books/.test(blob) &&
      !isHandVerifiedClean(ttl, auth)
    ) {
      return done({
        tier: "flag_review",
        detail: "Notes mention romantic tension—Halalit flags this even when romance isn’t the main plot.",
      });
    }

    if (blob && FAMILY_SHELF_SUBJECT_WARN_RE.test(blob)) {
      return done({
        tier: "flag_review",
        detail: "Tags mention illegitimacy or similar—won’t treat as family-shelf clean.",
      });
    }

    if (blob && blobMentionsLgbtq(blob)) {
      var skipDescLgbtq = opts && opts.skipDescriptionLgbtq;
      var tagsOnlyLgbtq = LGBTQ_SUBJECT_WARN_RE.test(blob);
      if (!(skipDescLgbtq && !tagsOnlyLgbtq)) {
        return done({
          tier: "flag_review",
          detail:
            tagsOnlyLgbtq
              ? "Tags mention LGBTQ identity or related themes—outside Halalit’s family shelf."
              : "Description or notes mention LGBTQ themes—outside Halalit’s family shelf.",
        });
      }
    }

    if (blob && FANSERVICE_TEXT_RE.test(blob) && blobLooksGraphic(blob, ttl)) {
      return done({
        tier: "flag_review",
        detail:
          GRAPHIC_UNVETTED_DETAIL +
          " Catalog also mentions suggestive or fanservice content—only add after a hand-check.",
      });
    }

    if (!isHandVerifiedClean(ttl, auth)) {
      if (blob && catalogBlobLooksNonfiction(blob, ttl)) {
        return done({
          tier: "user_discretion",
          detail: NONFICTION_RELIABILITY_DISCRETION_DETAIL,
        });
      }
      if (titleLooksNonfiction(ttl)) {
        return done({
          tier: "user_discretion",
          detail: NONFICTION_RELIABILITY_DISCRETION_DETAIL,
        });
      }
      if (blob && catalogBlobLooksAdultRealisticFiction(blob, ttl)) {
        return done({
          tier: "user_discretion",
          detail: ADULT_REALISTIC_FICTION_DISCRETION_DETAIL,
        });
      }
    }

    if (!blob) {
      return done({
        tier: "unclear",
        detail: "No useful content tags on this row—try the author or another edition.",
      });
    }

    var warn =
      /erotica|explicit|sexual|pornograph|horror fiction|serial killer|true crime/.test(blob) &&
      !/juvenile|children|young adult|ya/.test(blob);
    if (warn) {
      return done({
        tier: "flag_review",
        detail: "Tags lean adult or intense—not verified for young shelves.",
      });
    }

    if (blob && ROMANCE_SUBJECT_RE.test(blob) && !isHandVerifiedClean(ttl, auth)) {
      if (teen || /young adult|ya fiction/.test(blob)) {
        return done({
          tier: "flag_review",
          detail: "Teen/YA tags plus romance—Halalit flags for the family shelf.",
        });
      }
      if (!/children'?s fiction|children'?s stories|picture books|juvenile fiction/.test(blob)) {
        return done({
          tier: "flag_review",
          detail: "Romance tags without a clear all-ages children’s label—preview first.",
        });
      }
    }

    if (teen) {
      return done({
        tier: "teen_caution",
        detail: "Teen/YA tags—a different age band than Halalit’s all-ages family shelf (genre doesn’t change that).",
      });
    }

    var youth =
      /juvenile fiction|juvenile works|juvenile literature|child readers|young readers|children'?s/.test(blob);
    if (youth && blobLooksGraphic(blob, ttl)) {
      return done({
        tier: "not_verified",
        detail:
          "Tagged children’s fiction—not hand-verified clean from tags alone. " +
          "Graphic novel: Halalit still runs plot/theme checks below; panel art and fanservice need your eyes.",
      });
    }
    if (youth) {
      return done({
        tier: "not_verified",
        detail: "Tagged children’s fiction—not hand-verified clean from tags alone.",
      });
    }

    return done({
      tier: "unclear",
      detail: "Not clearly children’s fiction and not hand-verified—no clean call from tags.",
    });
  }

  function bookQuestBlocksMarvelousLandOz(title, author) {
    var tl = normTitle(title);
    if (!tl || !/\bmarvelous land of oz\b|\bmarvellous land of oz\b/i.test(tl)) return false;
    var al = normAuthor(author);
    if (al && !/baum|frank/i.test(al)) return false;
    return true;
  }

  function bookQuestBlocksAsoue(title, author) {
    var tl = normTitle(title);
    if (!tl || !/\ba series of unfortunate events\b|\bbad beginning\b|\breptile room\b|\bwide window\b|\bmiserable mill\b|\bvile village\b|\bersatz elevator\b|\bhostile hospital\b|\bcarnivorous carnival\b|\bslippery slope\b|\bgrim grotto\b|\bpenultimate peril\b/i.test(tl)) {
      return false;
    }
    var al = normAuthor(author);
    if (al && !/snicket|handler|lemony/i.test(al)) return false;
    return true;
  }

  function bookQuestBlocksLastUnicorn(title, author) {
    var tl = normTitle(title);
    if (!tl || !/\bthe last unicorn\b|\blast unicorn\b|\btwo hearts\b/i.test(tl)) return false;
    var al = normAuthor(author);
    if (al && !/beagle|peter\s*s\.?\s*beagle|peter\s*beagle/i.test(al)) return false;
    return true;
  }

  function bookQuestBlocksShadowMagic(title, author) {
    var tl = normTitle(title);
    if (!tl || !/\bshadow magic\b|\bdream magic\b|\bburning magic\b/i.test(tl)) return false;
    var al = normAuthor(author);
    if (al && !/khan|joshua\s*khan|chadda|sarwat\s*chadda/i.test(al)) return false;
    return true;
  }

  function bookQuestBlocksBeetVandelBuster(title, author) {
    var tl = normTitle(title);
    if (
      !tl ||
      !/\bbeet the vandel buster\b|\bbouken ou beet\b|\bboken ou beet\b|\bboukenoh beet\b|\badventure king beet\b|\bvandel buster excellion\b/i.test(
        tl
      )
    ) {
      return false;
    }
    var al = normAuthor(author);
    if (al && !/sanjo|riku|inada|koji/i.test(al)) return false;
    return true;
  }

  function bookQuestBlocksSchoolForGoodAndEvil(title, author) {
    var tl = normTitle(title);
    if (
      !tl ||
      !/\bschool for good and evil\b|\ba school for good and evil\b|\bworld without princes\b|\blast ever after\b|\bever never handbook\b|\bquests for glory\b|\bcrystal of time\b|\bone true king\b|\brise of the school for good and evil\b|\bfall of the school for good and evil\b/i.test(
        tl
      )
    ) {
      return false;
    }
    var al = normAuthor(author);
    if (al && !/chainani|soman\s*chainani/i.test(al)) return false;
    return true;
  }

  function bookQuestBlocksAminaKhanSeries(title, author) {
    var tl = normTitle(title);
    if (!tl || !/\bamina'?s voice\b|\bamina'?s song\b|\bamina'?s picture\b/i.test(tl)) return false;
    var al = normAuthor(author);
    if (al && !/khan|hena\s*khan/i.test(al)) return false;
    return true;
  }

  function bookQuestBlocksChristiePoirot(title, author) {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.christiePoirotMysteryMatch === "function") {
      return Cur.christiePoirotMysteryMatch(title, author);
    }
    return false;
  }

  function bookQuestBlocksSecretWorldOfBriarRose(title, author) {
    var tl = normTitle(title);
    if (!tl || !/\bsecret world of briar rose\b/i.test(tl)) return false;
    var al = normAuthor(author);
    if (al && !/pham|cindy\s*pham/i.test(al)) return false;
    return true;
  }

  function bookQuestBlocksEtherWitch(title, author) {
    var tl = normTitle(title);
    if (
      !tl ||
      !/\bether witch\b|\bconfronting the crafty concubine\b|\bcrafty concubine\b|\bdivining of a devil\b/i.test(tl)
    ) {
      return false;
    }
    var al = normAuthor(author);
    if (al && !/delemhach|emilie\s*nikota/i.test(al)) return false;
    return true;
  }

  function bookQuestBlocksCruelIsTheLight(title, author) {
    var tl = normTitle(title);
    if (!tl || !/\bcruel is the light\b/i.test(tl)) return false;
    var al = normAuthor(author);
    if (al && !/clark|sophie\s*clark/i.test(al)) return false;
    return true;
  }

  function bookQuestBlocksKeeperOfTheLostCities(title, author) {
    var tl = normTitle(title);
    if (
      !tl ||
      !/\bkeeper of the lost cities\b|\bkeepers of the lost cities\b|\beverblaze\b|\bneverseen\b|\blodestar\b|\bnightfall\b|\bstellarlune\b|\bunraveling\b|\bflashback\b|\blegacy\b/i.test(
        tl
      )
    ) {
      return false;
    }
    var al = normAuthor(author);
    if (al && !/messenger|shannon/i.test(al)) return false;
    return true;
  }

  function isEligibleForFamilyShelf(title, author, catalogHintTier, opts) {
    var allowDeity = opts ? !!opts.allowDeityMythology : bookQuestAllowsDeityMythology();
    var allowLightRomance = opts ? !!opts.allowLightRomance : bookQuestAllowsLightRomance();
    var allowMagic = opts ? !!opts.allowMagic : bookQuestAllowsMagic();
    var allowSubstance = opts ? !!opts.allowSubstance : bookQuestAllowsSubstance();
    var allowFamilyPortrayal = opts ? !!opts.allowFamilyCommunityTone : bookQuestAllowsFamilyCommunityTone();
    var allowCulturalMisrepresentation = opts
      ? !!opts.allowCulturalMisrepresentation
      : bookQuestAllowsCulturalMisrepresentation();
    var allowMentalHealthComfort =
      opts && typeof opts.allowMentalHealthComfort === "boolean"
        ? opts.allowMentalHealthComfort
        : bookQuestAllowsMentalHealthComfort();
    var readerBand = opts && opts.readerAgeBand ? opts.readerAgeBand : getBookQuestReaderAgeBand();
    if (hardExclusionDetailForTitle(title, author)) return false;
    var Ov = global.HalalitOwnerVetsRuntime;
    if (Ov && typeof Ov.findEntry === "function") {
      var onSite = Ov.findEntry(title, author);
      if (onSite && onSite.tier === "user_discretion") return false;
    }
    if (noRecommendKnownFanservice(title, author)) return false;
    if (isGraphicFanserviceCaution(title, author)) return false;
    if (curatedWarningBlocksFamilyShelf(title, author, opts)) return false;
    var verified = verifiedCleanHint(title, author);
    if (
      verified &&
      verified.requiresIslamicLiteratureInterest &&
      !readerHasIslamicLiteratureInterest()
    )
      return false;
    if (verified && verified.negativeFamilyPortrayal && !allowFamilyPortrayal) return false;
    if (verified && verified.requiresLightRomanceOptIn && !allowLightRomance) return false;
    if (verified && verified.requiresDeityMythologyOptIn && !allowDeity) return false;
    if (verified && verified.requiresMagicOptIn && !allowMagic) return false;
    if (verified && verified.requiresSubstanceOptIn && !allowSubstance) return false;
    if (verified && verified.requiresCulturalMisrepresentationOptIn && !allowCulturalMisrepresentation) return false;
    if (!allowMagic && bookQuestMagicBlock(title, author)) return false;
    if (!allowMagic) {
      var CurMagic = global.HalalitCuratedShelfWarnings;
      if (
        CurMagic &&
        typeof CurMagic.titleSuggestsFantasyMagic === "function" &&
        CurMagic.titleSuggestsFantasyMagic(title)
      ) {
        return false;
      }
    }
    if (!allowSubstance && bookQuestSubstanceBlock(title, author)) return false;
    if (!allowCulturalMisrepresentation && bookQuestCulturalMisrepresentationBlock(title, author)) return false;
    if (!allowFamilyPortrayal && bookQuestNegativeFamilyPortrayalBlock(title, author)) return false;
    if (
      !allowMentalHealthComfort &&
      mentalHealthComfortAppliesToReaderBand(readerBand) &&
      bookQuestMentalHealthComfortBlock(title, author)
    ) {
      return false;
    }
    if (opts && opts.requireReaderAgeBand) {
      if (!getBookQuestReaderAgeBand()) return false;
      if (bookQuestBlocksMarvelousLandOz(title, author)) return false;
      if (bookQuestBlocksAsoue(title, author)) return false;
      if (bookQuestBlocksLastUnicorn(title, author)) return false;
      if (bookQuestBlocksShadowMagic(title, author)) return false;
      if (bookQuestBlocksSchoolForGoodAndEvil(title, author)) return false;
      if (bookQuestBlocksBeetVandelBuster(title, author)) return false;
      if (bookQuestBlocksCruelIsTheLight(title, author)) return false;
      if (bookQuestBlocksEtherWitch(title, author)) return false;
      if (bookQuestBlocksSecretWorldOfBriarRose(title, author)) return false;
      if (bookQuestBlocksChristiePoirot(title, author)) return false;
      if (bookQuestBlocksAminaKhanSeries(title, author)) return false;
      if (bookQuestBlocksKeeperOfTheLostCities(title, author)) return false;
      if (!bookQuestMatchesReaderAge(title, author, opts.variantId, opts.readerAgeBand)) return false;
      if (verified && verified.excludesBookQuest) return false;
      if (opts.variantGenre === "nonfiction" && !verified) return false;
      if (bookQuestVariantIsRealisticFiction(opts.variantGenre) && !verified) return false;
    }
    if (verified || catalogHintTier === "verified_clean") return true;
    if (
      catalogHintTier === "flag_review" ||
      catalogHintTier === "user_discretion" ||
      catalogHintTier === "preview_caution" ||
      catalogHintTier === "teen_caution" ||
      catalogHintTier === "fanservice_caution"
    )
      return false;
    if (catalogHintTier === "deity_comfort" && !allowDeity) return false;
    if (!allowDeity && deityComfortAdvisory(title, author)) return false;
    if (titleLooksGraphic(title) && !isHandVerifiedClean(title, author)) return false;
    if (!verified && titleLooksNonfiction(title)) return false;
    return true;
  }

  /**
   * Same rules as isEligibleForFamilyShelf, for a single "Title by Author" string (Book Quest variants, etc.).
   * @param {string} titlePlain
   * @param {(s: string) => {title: string, author: string}} [parseTitlePlain]
   */
  function isTitlePlainEligible(titlePlain, parseTitlePlain, opts) {
    var parse =
      parseTitlePlain ||
      function (s) {
        var str = String(s || "").trim();
        var by = str.toLowerCase().lastIndexOf(" by ");
        if (by > 0) {
          return { title: str.slice(0, by).trim(), author: str.slice(by + 4).trim() };
        }
        return { title: str, author: "" };
      };
    var p = parse(titlePlain);
    return isEligibleForFamilyShelf(p.title, p.author, null, opts);
  }

  /** @deprecated use HalalitShelfThemes.matchCatalogSubjects */
  function lgbtqSubjectTagsFromList(subjects) {
    var ST = global.HalalitShelfThemes;
    if (!ST || !ST.matchCatalogSubjects) return [];
    var hits = ST.matchCatalogSubjects(subjects);
    var out = [];
    for (var i = 0; i < hits.length; i++) {
      if (hits[i].id === "lgbtq") out = out.concat(hits[i].tags);
    }
    return out;
  }

  global.HalalitFamilyShelfPolicy = {
    normalizeTitleKey: normalizeTitleKey,
    titleMatchesBlocked: titleMatchesBlocked,
    titleMatchesGroupDemonizationBlocked: titleMatchesGroupDemonizationBlocked,
    titleMatchesProColonialBlocked: titleMatchesProColonialBlocked,
    proColonialExclusionDetailForTitle: proColonialExclusionDetailForTitle,
    hardExclusionDetailForTitle: hardExclusionDetailForTitle,
    exclusionIllegitimateChildrenDetail: EXCLUSION_ILLEGITIMATE_CHILDREN_DETAIL,
    exclusionGroupDemonizationDetail: EXCLUSION_GROUP_DEMONIZATION_DETAIL,
    exclusionProColonialDetail: EXCLUSION_PRO_COLONIAL_DETAIL,
    exclusionCrudeProfanityDetail: EXCLUSION_CRUDE_PROFANITY_DETAIL,
    textMentionsCrudeProfanity: textMentionsCrudeProfanity,
    crudeProfanityDetailForText: crudeProfanityDetailForText,
    crudeProfanitySubjectRe: CRUDE_PROFANITY_SUBJECT_RE,
    familyPortrayalAdvisory: familyPortrayalAdvisory,
    mentalHealthComfortAdvisory: mentalHealthComfortAdvisory,
    parentNoteAdvisory: parentNoteAdvisory,
    deityComfortAdvisory: deityComfortAdvisory,
    deityComfortNote: deityComfortNote,
    deityComfortBlocked: deityComfortBlocked,
    textSuggestsDeityMythology: textSuggestsDeityMythology,
    inferCatalogFamilyHint: inferCatalogFamilyHint,
    collectPracticalSignals: collectPracticalSignals,
    familyActionLine: familyActionLine,
    lgbtqSubjectTagsFromList: lgbtqSubjectTagsFromList,
    hintDetailIsLgbtqPolicy: hintDetailIsLgbtqPolicy,
    subjectListAffirmsLgbtq: subjectListAffirmsLgbtq,
    reconcileHintLgbtqWithAiScan: reconcileHintLgbtqWithAiScan,
    filterLgbtqSignals: filterLgbtqSignals,
    catalogThemeHits: function (subjects) {
      var ST = global.HalalitShelfThemes;
      return ST && ST.matchCatalogSubjects ? ST.matchCatalogSubjects(subjects) : [];
    },
    bookQuestAllowsDeityMythology: bookQuestAllowsDeityMythology,
    setBookQuestAllowsDeityMythology: setBookQuestAllowsDeityMythology,
    bookQuestDeityMythologyBlock: bookQuestDeityMythologyBlock,
    bookQuestAllowsLightRomance: bookQuestAllowsLightRomance,
    setBookQuestAllowsLightRomance: setBookQuestAllowsLightRomance,
    bookQuestLightRomanceBlock: bookQuestLightRomanceBlock,
    bookQuestAllowsFamilyCommunityTone: bookQuestAllowsFamilyCommunityTone,
    setBookQuestAllowsFamilyCommunityTone: setBookQuestAllowsFamilyCommunityTone,
    bookQuestFamilyCommunityToneBlock: bookQuestFamilyCommunityToneBlock,
    bookQuestNegativeFamilyPortrayalBlock: bookQuestNegativeFamilyPortrayalBlock,
    bookQuestAllowsMagic: bookQuestAllowsMagic,
    setBookQuestAllowsMagic: setBookQuestAllowsMagic,
    bookQuestMagicBlock: bookQuestMagicBlock,
    bookQuestAllowsSubstance: bookQuestAllowsSubstance,
    setBookQuestAllowsSubstance: setBookQuestAllowsSubstance,
    bookQuestSubstanceBlock: bookQuestSubstanceBlock,
    bookQuestAllowsCulturalMisrepresentation: bookQuestAllowsCulturalMisrepresentation,
    setBookQuestAllowsCulturalMisrepresentation: setBookQuestAllowsCulturalMisrepresentation,
    bookQuestCulturalMisrepresentationBlock: bookQuestCulturalMisrepresentationBlock,
    bookQuestAllowsMentalHealthComfort: bookQuestAllowsMentalHealthComfort,
    setBookQuestAllowsMentalHealthComfort: setBookQuestAllowsMentalHealthComfort,
    mentalHealthComfortAppliesToReaderBand: mentalHealthComfortAppliesToReaderBand,
    bookQuestMentalHealthComfortBlock: bookQuestMentalHealthComfortBlock,
    getBookQuestReaderAgeBand: getBookQuestReaderAgeBand,
    setBookQuestReaderAgeBand: setBookQuestReaderAgeBand,
    bookQuestMatchesReaderAge: bookQuestMatchesReaderAge,
    readerHasIslamicLiteratureInterest: readerHasIslamicLiteratureInterest,
    isEligibleForFamilyShelf: isEligibleForFamilyShelf,
    isTitlePlainEligible: isTitlePlainEligible,
    graphicUnvettedDetail: GRAPHIC_UNVETTED_DETAIL,
    titleLooksGraphic: titleLooksGraphic,
    graphicFormatNeedsHandCheck: graphicFormatNeedsHandCheck,
    noRecommendKnownFanservice: noRecommendKnownFanservice,
    graphicFanserviceCautionHint: graphicFanserviceCautionHint,
    isGraphicFanserviceCaution: isGraphicFanserviceCaution,
    titleLooksNonfiction: titleLooksNonfiction,
    catalogBlobLooksNonfiction: catalogBlobLooksNonfiction,
    nonfictionReliabilityDiscretionDetail: NONFICTION_RELIABILITY_DISCRETION_DETAIL,
    catalogBlobLooksAdultRealisticFiction: catalogBlobLooksAdultRealisticFiction,
    bookQuestVariantIsRealisticFiction: bookQuestVariantIsRealisticFiction,
    adultRealisticFictionDiscretionDetail: ADULT_REALISTIC_FICTION_DISCRETION_DETAIL,
  };
})(typeof window !== "undefined" ? window : this);
