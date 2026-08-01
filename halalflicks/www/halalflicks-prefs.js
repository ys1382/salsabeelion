(function (global) {
  var KEY = "halalflicksPrefs";

  function empty() {
    return {
      likes: "",
      dislikes: "",
      animationOk: true,
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
        animationOk: data.animationOk !== false,
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
      animationOk: prefs && prefs.animationOk === false ? false : true,
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

  global.HalalFlicksPrefs = {
    load: load,
    save: save,
    clear: clear,
    tokens: tokens,
    empty: empty,
  };
})(typeof window !== "undefined" ? window : this);
