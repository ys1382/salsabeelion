(function (global) {
  var KEY = "halalyricsPrefs";

  function empty() {
    return {
      likes: "",
      dislikes: "",
      preferInstrumentals: false,
      disneyKidsOk: true,
      updatedAt: 0,
    };
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return empty();
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return empty();
      return {
        likes: String(data.likes || ""),
        dislikes: String(data.dislikes || ""),
        preferInstrumentals: !!data.preferInstrumentals,
        disneyKidsOk: data.disneyKidsOk !== false,
        updatedAt: Number(data.updatedAt) || 0,
      };
    } catch (e) {
      return empty();
    }
  }

  function save(prefs) {
    var next = {
      likes: String((prefs && prefs.likes) || "").trim().slice(0, 800),
      dislikes: String((prefs && prefs.dislikes) || "").trim().slice(0, 800),
      preferInstrumentals: !!(prefs && prefs.preferInstrumentals),
      disneyKidsOk: prefs && prefs.disneyKidsOk === false ? false : true,
      updatedAt: Date.now(),
    };
    try {
      global.localStorage.setItem(KEY, JSON.stringify(next));
    } catch (e) {
      /* ignore */
    }
    return next;
  }

  function clear() {
    try {
      global.localStorage.removeItem(KEY);
    } catch (e) {
      /* ignore */
    }
    return empty();
  }

  /** Split free-text prefs into simple tokens for ranking. */
  function tokens(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(function (t) {
        return t.length > 2;
      });
  }

  global.HalaLyricsPrefs = {
    load: load,
    save: save,
    clear: clear,
    tokens: tokens,
    empty: empty,
  };
})(typeof window !== "undefined" ? window : this);
