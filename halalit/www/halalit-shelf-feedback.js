/**
 * Halalit — private family-shelf feedback from Book Quest reviews (signed-in account).
 * Not shown publicly; for owner curation and future Bookcheck hints.
 */
(function (global) {
  var KEY = "halalitShelfRuleFeedback";
  var CAP = 120;

  var RULE_FLAG_OPTIONS = [
    { id: "lgbtq", label: "LGBTQ identity or advocacy (centered or not)" },
    { id: "adult_romance", label: "Adult romance as a major thread" },
    { id: "sexual_content", label: "Sexual content" },
    { id: "romantic_tension", label: "Romantic tension I’d rather avoid" },
    { id: "illegitimate_children", label: "Plot centered on illegitimate children" },
    { id: "romanticized_crime", label: "Romanticized crime, cruelty, or “cool” harm" },
    { id: "teen_ya_age", label: "Teen/YA tone—not all-ages" },
    { id: "violence_intense", label: "Too much violence or intensity" },
    { id: "family_portrayed_negatively", label: "Family is portrayed negatively" },
    {
      id: "cultural_stereotype",
      label: "Cultural stereotyping or shallow/false representation (not whole-group demonization)",
    },
    {
      id: "group_demonization",
      label: "Demonizes an entire race, religion, ethnicity, or group",
    },
    { id: "pro_colonial_narrative", label: "Pro-colonial narrative" },
  ];

  function store() {
    return global.HalalitAccountStorage || null;
  }

  function loadAll() {
    try {
      var raw = store() ? store().getItem(KEY) : null;
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveAll(list) {
    try {
      if (store()) store().setItem(KEY, JSON.stringify(list));
    } catch (e) {}
  }

  /**
   * @param {object} entry
   * @param {string} entry.titlePlain
   * @param {string} [entry.bookId]
   * @param {string} entry.rating
   * @param {boolean} entry.doesntMeetRules
   * @param {string[]} [entry.ruleFlags]
   * @param {string} [entry.noteSnippet]
   * @param {string} [entry.reviewSource]
   */
  function append(entry) {
    if (!entry || !entry.titlePlain) return;
    var list = loadAll();
    list.push(
      Object.assign(
        {
          submittedAt: new Date().toISOString(),
          ruleFlags: [],
          doesntMeetRules: false,
        },
        entry
      )
    );
    if (list.length > CAP) list = list.slice(list.length - CAP);
    saveAll(list);
  }

  global.HalalitShelfFeedback = {
    KEY: KEY,
    RULE_FLAG_OPTIONS: RULE_FLAG_OPTIONS,
    loadAll: loadAll,
    append: append,
  };
})(typeof window !== "undefined" ? window : this);
