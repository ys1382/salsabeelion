(function (global) {
  var KEY = "halalyricsShelf";
  var CAP = 500;

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function save(list) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP)));
    } catch (e) {
      /* ignore */
    }
  }

  function normalizeKey(title, artist) {
    function norm(s) {
      return String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
    }
    return norm(title) + "|" + norm(artist);
  }

  function add(entry) {
    var list = load();
    var key = normalizeKey(entry.title, entry.artist);
    var next = list.filter(function (row) {
      return normalizeKey(row.title, row.artist) !== key;
    });
    next.unshift({
      title: String(entry.title || "").trim(),
      artist: String(entry.artist || "").trim(),
      tag: entry.tag || "want",
      addedAt: Date.now(),
    });
    save(next);
    return next;
  }

  function remove(title, artist) {
    var key = normalizeKey(title, artist);
    var next = load().filter(function (row) {
      return normalizeKey(row.title, row.artist) !== key;
    });
    save(next);
    return next;
  }

  global.HalaLyricsShelf = {
    load: load,
    add: add,
    remove: remove,
    tagLabel: function (tag) {
      if (tag === "heard") return "Already heard";
      if (tag === "favorite") return "Favorite";
      return "Want to hear";
    },
  };
})(typeof window !== "undefined" ? window : this);
