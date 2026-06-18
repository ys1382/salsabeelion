/**
 * Halalit Book Quest — owner age bands for hand-vetted recommendations.
 * Synced from HALALIT-HAND-VETTED-CLEAN-LIST.md (Jun 2026).
 *
 * Bands (cumulative): young_child ≤ older_child_young_teen ≤ older_teen_adult
 * - young_child: Kids
 * - older_child_young_teen: Older kids (and Kids)
 * - older_teen_adult: Teens/Adults (and both above)
 *
 * Two checks in matchesReaderBand:
 * 1. Content (intensity): title contentBand level must be ≤ reader level.
 * 2. Interest (fit): reader level must be ≤ interestThroughBand — picture books
 *    only fit young_child even when content is “Kids” clean.
 */
(function (global) {
  var BAND = {
    YOUNG_CHILD: "young_child",
    OLDER_CHILD_YOUNG_TEEN: "older_child_young_teen",
    OLDER_TEEN_ADULT: "older_teen_adult",
  };

  var BAND_LEVEL = {
    young_child: 1,
    older_child_young_teen: 2,
    older_teen_adult: 3,
  };

  var BAND_LABEL = {
    young_child: "Young Child Reader",
    older_child_young_teen: "Older Child / Young Teen Reader",
    older_teen_adult: "Older Teen / Adult Reader",
  };

  /** Book Quest REC_VARIANTS ids → content band. */
  var VARIANT_BAND = {
    "charlottes-web": BAND.YOUNG_CHILD,
    "winn-dixie": BAND.OLDER_CHILD_YOUNG_TEEN,
    "ameenas-ramadan-diary": BAND.OLDER_TEEN_ADULT,
    ivan: BAND.OLDER_CHILD_YOUNG_TEEN,
    frisby: BAND.YOUNG_CHILD,
    "girl-who-drank-moon": BAND.OLDER_CHILD_YOUNG_TEEN,
    "hidden-figures-young": BAND.OLDER_CHILD_YOUNG_TEEN,
    "green-deen": BAND.OLDER_TEEN_ADULT,
    "the-giver": BAND.OLDER_TEEN_ADULT,
    "the-giver-cl": BAND.OLDER_TEEN_ADULT,
    "benedict-society": BAND.OLDER_CHILD_YOUNG_TEEN,
    fablehaven: BAND.OLDER_CHILD_YOUNG_TEEN,
    "this-totally-bites": BAND.OLDER_CHILD_YOUNG_TEEN,
    "at-first-bite": BAND.OLDER_CHILD_YOUNG_TEEN,
    "harriet-the-spy": BAND.OLDER_CHILD_YOUNG_TEEN,
    "wolf-princess": BAND.OLDER_CHILD_YOUNG_TEEN,
    "zita-spacegirl": BAND.YOUNG_CHILD,
    "city-of-ember": BAND.OLDER_CHILD_YOUNG_TEEN,
    "brown-girl-dreaming": BAND.OLDER_CHILD_YOUNG_TEEN,
    "my-side-mountain": BAND.OLDER_CHILD_YOUNG_TEEN,
    hatchet: BAND.OLDER_TEEN_ADULT,
    "julie-wolves": BAND.OLDER_TEEN_ADULT,
    "brians-winter": BAND.OLDER_TEEN_ADULT,
    "echo-mountain": BAND.OLDER_CHILD_YOUNG_TEEN,
    "tuck-everlasting": BAND.OLDER_CHILD_YOUNG_TEEN,
    "wrinkle-in-time": BAND.OLDER_TEEN_ADULT,
    "when-you-reach-me": BAND.OLDER_CHILD_YOUNG_TEEN,
    hobbit: BAND.OLDER_TEEN_ADULT,
    "lord-of-the-rings": BAND.OLDER_TEEN_ADULT,
    wardrobe: BAND.OLDER_CHILD_YOUNG_TEEN,
    eragon: BAND.OLDER_TEEN_ADULT,
    "gregor-overlander": BAND.OLDER_CHILD_YOUNG_TEEN,
    "among-the-hidden": BAND.OLDER_CHILD_YOUNG_TEEN,
    "westing-game": BAND.OLDER_CHILD_YOUNG_TEEN,
    "last-kids-on-earth": BAND.OLDER_CHILD_YOUNG_TEEN,
    "we-are-the-ship": BAND.OLDER_TEEN_ADULT,
    "fortunately-the-milk": BAND.YOUNG_CHILD,
    "half-moon-investigations": BAND.OLDER_CHILD_YOUNG_TEEN,
    airman: BAND.OLDER_CHILD_YOUNG_TEEN,
    tidesong: BAND.OLDER_CHILD_YOUNG_TEEN,
    "kindred-dragons": BAND.OLDER_CHILD_YOUNG_TEEN,
    "babymouse-queen": BAND.YOUNG_CHILD,
  };

  /**
   * Oldest reader band that should still get this pick (interest/fit).
   * Default for unlisted variants: older_teen_adult.
   */
  var VARIANT_INTEREST_THROUGH = {
    "charlottes-web": BAND.OLDER_CHILD_YOUNG_TEEN,
    "winn-dixie": BAND.OLDER_TEEN_ADULT,
    "ameenas-ramadan-diary": BAND.OLDER_TEEN_ADULT,
    ivan: BAND.OLDER_TEEN_ADULT,
    frisby: BAND.OLDER_CHILD_YOUNG_TEEN,
    "girl-who-drank-moon": BAND.OLDER_TEEN_ADULT,
    "hidden-figures-young": BAND.OLDER_TEEN_ADULT,
    "green-deen": BAND.OLDER_TEEN_ADULT,
    "the-giver": BAND.OLDER_TEEN_ADULT,
    "the-giver-cl": BAND.OLDER_TEEN_ADULT,
    "benedict-society": BAND.OLDER_TEEN_ADULT,
    fablehaven: BAND.OLDER_TEEN_ADULT,
    "this-totally-bites": BAND.OLDER_CHILD_YOUNG_TEEN,
    "at-first-bite": BAND.OLDER_CHILD_YOUNG_TEEN,
    "harriet-the-spy": BAND.OLDER_TEEN_ADULT,
    "wolf-princess": BAND.OLDER_CHILD_YOUNG_TEEN,
    "zita-spacegirl": BAND.OLDER_CHILD_YOUNG_TEEN,
    tidesong: BAND.OLDER_CHILD_YOUNG_TEEN,
    "kindred-dragons": BAND.OLDER_CHILD_YOUNG_TEEN,
    "babymouse-queen": BAND.OLDER_CHILD_YOUNG_TEEN,
    "city-of-ember": BAND.OLDER_TEEN_ADULT,
    "brown-girl-dreaming": BAND.OLDER_TEEN_ADULT,
    "my-side-mountain": BAND.OLDER_TEEN_ADULT,
    hatchet: BAND.OLDER_TEEN_ADULT,
    "julie-wolves": BAND.OLDER_TEEN_ADULT,
    "brians-winter": BAND.OLDER_TEEN_ADULT,
    "tuck-everlasting": BAND.OLDER_TEEN_ADULT,
    "wrinkle-in-time": BAND.OLDER_TEEN_ADULT,
    "when-you-reach-me": BAND.OLDER_TEEN_ADULT,
    hobbit: BAND.OLDER_TEEN_ADULT,
    "lord-of-the-rings": BAND.OLDER_TEEN_ADULT,
    wardrobe: BAND.OLDER_TEEN_ADULT,
    eragon: BAND.OLDER_TEEN_ADULT,
    "gregor-overlander": BAND.OLDER_TEEN_ADULT,
    "among-the-hidden": BAND.OLDER_TEEN_ADULT,
    "westing-game": BAND.OLDER_TEEN_ADULT,
    "last-kids-on-earth": BAND.OLDER_CHILD_YOUNG_TEEN,
    "we-are-the-ship": BAND.OLDER_TEEN_ADULT,
    "fortunately-the-milk": BAND.OLDER_TEEN_ADULT,
    "half-moon-investigations": BAND.OLDER_TEEN_ADULT,
    airman: BAND.OLDER_TEEN_ADULT,
  };

  /** Illustrated / short novels that fit young + older child readers (not board books). */
  var TITLE_INTEREST_THROUGH_RULES = [
    {
      through: BAND.OLDER_TEEN_ADULT,
      titleRe: /\btale dark and grimm\b|\bin a glass grimmly\b|\bgrimm conclusion\b/i,
      authorRe: /gidwitz|adam\s*gidwitz/i,
    },
    {
      through: BAND.OLDER_TEEN_ADULT,
      titleRe: /fortunately,?\s*the milk/i,
      authorRe: /gaiman|neil/i,
    },
    {
      through: BAND.OLDER_TEEN_ADULT,
      titleRe: /\bgirl with the silver eyes\b/i,
      authorRe: /willo\s*davis\s*roberts|w\.?\s*d\.?\s*roberts/i,
    },
    {
      through: BAND.OLDER_CHILD_YOUNG_TEEN,
      titleRe: /\bpocket peaches\s*:\s*at the fair\b|\bpocket peaches\b(?!\s*:)/i,
      authorRe: /wang|dora\s*wang/i,
    },
  ];

  /** Board books / picture books / preschool read-aloud — young_child readers only. */
  var PICTURE_BOOK_INTEREST_RULES = [
    /very busy spider/i,
    /very hungry caterpillar/i,
    /goodnight moon/i,
    /where'?s spot\b/i,
    /brown bear,?\s*brown bear/i,
    /chicka chicka boom boom/i,
    /don'?t let the pigeon/i,
    /are you my mother/i,
    /guess how much i love you/i,
    /love you forever/i,
    /harold and the purple crayon/i,
    /the rainbow fish/i,
    /little engine that could/i,
    /green eggs and ham/i,
    /hop on pop/i,
    /fox in socks/i,
    /one fish two fish/i,
    /the cat in the hat comes back/i,
    /\bthe cat in the hat\b/i,
    /the lorax/i,
    /oh,?\s*the places you'?ll go/i,
    /the sneetches/i,
    /yertle the turtle/i,
    /bartholomew and the oobleck/i,
    /the 500 hats of bartholomew/i,
    /dr\.?\s*seuss'?s sleep book/i,
    /if i ran the zoo/i,
    /if i ran the circus/i,
    /horton hears a who/i,
    /curious george/i,
    /berenstain bears/i,
    /fancy nancy/i,
    /clifford the big red dog/i,
    /where the wild things are/i,
    /the giving tree/i,
    /where the sidewalk ends/i,
    /goodnight gorilla/i,
    /room on the broom/i,
    /the gruffalo/i,
    /corduroy/i,
    /make way for ducklings/i,
    /the snowy day/i,
    /press here/i,
    /no,?\s*david/i,
    /caps for sale/i,
    /go,?\s*dog\.?\s*go/i,
    /the paper bag princess/i,
    /the very quiet cricket/i,
    /enormous crocodile/i,
    /the giraffe and the pelly and me/i,
    /the magic finger/i,
  ];

  /** Title/author patterns for lookups outside REC_VARIANTS (longer rules first). */
  var TITLE_BAND_RULES = [
    {
      band: BAND.OLDER_TEEN_ADULT,
      titleRe: /\btale dark and grimm\b|\bin a glass grimmly\b|\bgrimm conclusion\b/i,
      authorRe: /gidwitz|adam\s*gidwitz/i,
    },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /to kill a mockingbird/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /watership down/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /white fang/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /magisterium/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /meesh the bad demon/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bgirl with the silver eyes\b/i, authorRe: /willo\s*davis\s*roberts|w\.?\s*d\.?\s*roberts/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /happily for now/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /wonder light|unicorns of the mist/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /call of the wild/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /queenie peavy/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /green deen/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /this changes everything/i, authorRe: /klein|naomi/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /ameena'?s ramadan diary/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /anne of green gables/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /\bamulet\b/i, authorRe: /kibuishi/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /the hobbit/i },
    {
      band: BAND.OLDER_TEEN_ADULT,
      titleRe: /lord of the rings|fellowship of the ring|the two towers|return of the king/i,
      authorRe: /tolkien|j\.?\s*r\.?\s*r\.?\s*tolkien/i,
    },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /hatchet/i, authorRe: /paulsen/i },
    { band: BAND.OLDER_TEEN_ADULT, titleRe: /brian'?s winter/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bairman\b/i, authorRe: /eoin\s*colfer/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /half moon investigations/i, authorRe: /eoin\s*colfer/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /artemis fowl/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /spirit animals/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /ranger'?s apprentice/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /fablehaven/i },
    {
      band: BAND.OLDER_CHILD_YOUNG_TEEN,
      titleRe: /\bland of roar\b|\breturn to roar\b|\bbattle for roar\b/i,
      authorRe: /mclachlan|jenny/i,
    },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /mysterious benedict/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bdragon slippers\b|\bdragon flight\b|\bdragon spear\b/i, authorRe: /george|jessica/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bwingbearer\b/i, authorRe: /liu|marjorie\s*m/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bshadow of the dragon\b(?!:\s*elspeth)/i, authorRe: /o'hearn|hearn|kate/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bcity of fire\b|\bcity of ice\b|\bcity of death\b/i, authorRe: /yep|laurence/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bland of elyon\b|\bdark hills divide\b|\bbeyond the valley of thorns\b/i, authorRe: /carman|patrick/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bwhen you trap a tiger\b/i, authorRe: /keller|tae/i },
    {
      band: BAND.OLDER_CHILD_YOUNG_TEEN,
      titleRe: /\blion,?\s+the\s+witch\s+and\s+the\s+wardrobe\b/i,
      authorRe: /c\.?\s*s\.?\s*lewis|cs\s*lewis/i,
    },
    {
      band: BAND.OLDER_CHILD_YOUNG_TEEN,
      titleRe: /\btrials of morrigan crow\b|\bnevermoor:\s*the trials of morrigan crow\b/i,
      authorRe: /townsend|jessica/i,
    },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /girl who drank the moon/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\btidesong\b|\btide song\b/i, authorRe: /wendy\s*xu|\bxu,?\s*wendy/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bkindred dragons\b/i, authorRe: /mensinga|sarah/i },
    { band: BAND.YOUNG_CHILD, titleRe: /\bbabymouse\b/i, authorRe: /holm|jennifer/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /graveyard book/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /spiderwick/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /gregor the overlander/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /among the hidden/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /last kids on earth/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /city of ember/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /brown girl dreaming/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bwonder\b/i, authorRe: /palacio|r\.?\s*j\.?\s*palacio/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /echo mountain/i, authorRe: /wolk|lauren\s*wolk/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bmanatee summer\b/i, authorRe: /griffith|evan/i },
    {
      band: BAND.OLDER_CHILD_YOUNG_TEEN,
      titleRe:
        /\bwing & claw\b|\bwing and claw\b|\bforest of wonders\b|\bcavern of secrets\b|\bbeast of stone\b/i,
      authorRe: /park|linda sue/i,
    },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bspark\b/i, authorRe: /durst|sarah\s*beth/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bspark\b/i, authorRe: /baron|chris/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bjinx\b|\bjinx'?s magic\b/i, authorRe: /blackwood|sage/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\blast bear\b/i, authorRe: /gold|hannah/i },
    {
      band: BAND.OLDER_CHILD_YOUNG_TEEN,
      titleRe: /\bwolf called wander\b|\bwhale of the wild\b|\ba whale of the wild\b/i,
      authorRe: /parry|rosanne/i,
    },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bwild rescuers\b|\bguardians of the taiga\b/i, authorRe: /stacyplays|stacy/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bgrace of wild things\b/i, authorRe: /fawcett|heather/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\bseekers of the (?:wild )?realm\b|\blegend of the realm\b/i, authorRe: /ott|alexandra/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /\banimal healer\b/i, authorRe: /st\.?\s*john|lauren/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /black beauty/i, authorRe: /sewell|anna/i },
    { band: BAND.OLDER_CHILD_YOUNG_TEEN, titleRe: /because of winn-dixie/i },
    { band: BAND.YOUNG_CHILD, titleRe: /fortunately,?\s*the milk/i, authorRe: /gaiman|neil/i },
    { band: BAND.YOUNG_CHILD, titleRe: /charlotte'?s web/i },
    { band: BAND.YOUNG_CHILD, titleRe: /curious george/i },
    { band: BAND.YOUNG_CHILD, titleRe: /goodnight moon/i },
    { band: BAND.YOUNG_CHILD, titleRe: /berenstain bears/i },
    { band: BAND.YOUNG_CHILD, titleRe: /fancy nancy/i },
    { band: BAND.YOUNG_CHILD, titleRe: /magic school bus/i },
    { band: BAND.YOUNG_CHILD, titleRe: /dr\.?\s*seuss|bartholomew|oobleck|fox in socks|green eggs and ham|hop on pop|horton hears|if i ran the|one fish two fish|yertle the turtle|sneetches/i },
    { band: BAND.YOUNG_CHILD, titleRe: /roald dahl|the bfg|matilda|james and the giant peach|the twits|the witches|enormous crocodile|giraffe and the pelly|magic finger/i },
    {
      band: BAND.YOUNG_CHILD,
      titleRe: /\bpocket peaches\s*:\s*at the fair\b|\bpocket peaches\b(?!\s*:)/i,
      authorRe: /wang|dora\s*wang/i,
    },
  ];

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[''`]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isPictureBookInterest(title) {
    var tl = norm(title);
    if (!tl) return false;
    for (var i = 0; i < PICTURE_BOOK_INTEREST_RULES.length; i++) {
      if (PICTURE_BOOK_INTEREST_RULES[i].test(tl)) return true;
    }
    return false;
  }

  /**
   * @param {string} [variantId]
   * @param {string} [title]
   * @param {string} [author]
   * @returns {string}
   */
  function interestThroughBand(variantId, title, author) {
    if (variantId && VARIANT_INTEREST_THROUGH[variantId]) return VARIANT_INTEREST_THROUGH[variantId];
    var tl = norm(title);
    var al = norm(author);
    if (tl) {
      for (var j = 0; j < TITLE_INTEREST_THROUGH_RULES.length; j++) {
        var ir = TITLE_INTEREST_THROUGH_RULES[j];
        if (!ir.titleRe.test(tl)) continue;
        if (ir.authorRe && al && !ir.authorRe.test(al)) continue;
        return ir.through;
      }
    }
    if (isPictureBookInterest(title)) return BAND.YOUNG_CHILD;
    var cb = contentBand(variantId, title, author);
    if (cb === BAND.YOUNG_CHILD) return BAND.OLDER_CHILD_YOUNG_TEEN;
    return BAND.OLDER_TEEN_ADULT;
  }

  /**
   * @param {string} readerBand
   * @param {string} interestThrough
   * @returns {boolean}
   */
  function readerFitsInterest(readerBand, interestThrough) {
    if (!readerBand || !interestThrough) return false;
    var rl = BAND_LEVEL[readerBand];
    var il = BAND_LEVEL[interestThrough];
    if (!rl || !il) return false;
    return rl <= il;
  }

  function contentBandForTitle(title, author) {
    var Ov = global.HalalitOwnerVetsRuntime;
    if (Ov && typeof Ov.contentBandForTitle === "function") {
      var ownerBand = Ov.contentBandForTitle(title, author);
      if (ownerBand) return ownerBand;
    }
    var tl = norm(title);
    var al = norm(author);
    if (!tl) return null;
    for (var i = 0; i < TITLE_BAND_RULES.length; i++) {
      var r = TITLE_BAND_RULES[i];
      if (!r.titleRe.test(tl)) continue;
      if (r.authorRe && al && !r.authorRe.test(al)) continue;
      return r.band;
    }
    return null;
  }

  /**
   * @param {string} [variantId]
   * @param {string} [title]
   * @param {string} [author]
   * @returns {string|null}
   */
  function contentBand(variantId, title, author) {
    if (variantId && VARIANT_BAND[variantId]) return VARIANT_BAND[variantId];
    var fromTitle = contentBandForTitle(title, author);
    if (fromTitle) return fromTitle;
    return BAND.OLDER_CHILD_YOUNG_TEEN;
  }

  /**
   * @param {string} readerBand
   * @param {string} titleBand
   * @returns {boolean}
   */
  function readerAllowsContentBand(readerBand, titleBand) {
    if (!readerBand || !titleBand) return false;
    var rl = BAND_LEVEL[readerBand];
    var tl = BAND_LEVEL[titleBand];
    if (!rl || !tl) return false;
    return tl <= rl;
  }

  /**
   * @param {string} readerBand
   * @param {string} [variantId]
   * @param {string} [title]
   * @param {string} [author]
   * @returns {boolean}
   */
  function matchesReaderBand(readerBand, variantId, title, author) {
    if (!readerBand) return false;
    var cb = contentBand(variantId, title, author);
    var ib = interestThroughBand(variantId, title, author);
    return readerAllowsContentBand(readerBand, cb) && readerFitsInterest(readerBand, ib);
  }

  global.HalalitBookQuestAgeRatings = {
    BAND: BAND,
    BAND_LABEL: BAND_LABEL,
    BAND_LEVEL: BAND_LEVEL,
    VARIANT_BAND: VARIANT_BAND,
    VARIANT_INTEREST_THROUGH: VARIANT_INTEREST_THROUGH,
    contentBand: contentBand,
    interestThroughBand: interestThroughBand,
    readerAllowsContentBand: readerAllowsContentBand,
    readerFitsInterest: readerFitsInterest,
    matchesReaderBand: matchesReaderBand,
  };
})(typeof window !== "undefined" ? window : this);
