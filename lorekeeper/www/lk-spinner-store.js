/**
 * LoreKeeper — idea spinner banks (per account, private).
 */
(function (global) {
  var SPINNER_KEY = "lorekeeper_spinner_v1";

  var DEFAULT_COLUMNS = [
    { id: "who", label: "Character / species", words: [], locked: false, current: "" },
    { id: "act", label: "Action", words: [], locked: false, current: "" },
    { id: "obj", label: "Object", words: [], locked: false, current: "" },
    { id: "where", label: "Setting / biome", words: [], locked: false, current: "" },
    { id: "twist", label: "Twist / constraint", words: [], locked: false, current: "" },
  ];

  function store() {
    return global.LoreKeeperAccountStorage;
  }

  function defaults() {
    return {
      template: "nudge",
      columns: DEFAULT_COLUMNS.map(function (col) {
        return {
          id: col.id,
          label: col.label,
          words: col.words.slice(),
          locked: false,
          current: "",
        };
      }),
    };
  }

  function normalizeColumn(col, fallback) {
    return {
      id: col.id || fallback.id,
      label: String(col.label || fallback.label).trim() || fallback.label,
      words: Array.isArray(col.words)
        ? col.words.map(function (w) {
            return String(w || "").trim();
          }).filter(Boolean)
        : [],
      locked: !!col.locked,
      current: String(col.current || "").trim(),
    };
  }

  function load() {
    var data = defaults();
    var S = store();
    if (!S || !S.isSignedIn()) return data;
    var raw = S.getItem(SPINNER_KEY);
    if (!raw) return data;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.template) data.template = parsed.template;
      if (parsed && Array.isArray(parsed.columns)) {
        data.columns = DEFAULT_COLUMNS.map(function (fallback, i) {
          var col = parsed.columns[i] || parsed.columns.find(function (c) {
            return c && c.id === fallback.id;
          });
          return normalizeColumn(col || {}, fallback);
        });
      }
    } catch (e) {
      /* keep defaults */
    }
    return data;
  }

  function save(data) {
    var S = store();
    if (!S || !S.isSignedIn()) return false;
    var payload = {
      template: data.template || "nudge",
      columns: (data.columns || []).map(function (col) {
        return {
          id: col.id,
          label: col.label,
          words: col.words || [],
          locked: !!col.locked,
          current: col.current || "",
        };
      }),
    };
    return S.setItem(SPINNER_KEY, JSON.stringify(payload));
  }

  global.LoreKeeperSpinnerStore = {
    SPINNER_KEY: SPINNER_KEY,
    defaults: defaults,
    load: load,
    save: save,
  };
})(typeof window !== "undefined" ? window : this);
