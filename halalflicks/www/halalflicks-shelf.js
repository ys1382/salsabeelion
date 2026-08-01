(function (global) {
  var KEY = "halalflicksShelf";
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

  function normalizeKey(title, year) {
    function norm(s) {
      return String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
    }
    return norm(title) + "|" + norm(year);
  }

  function add(entry) {
    var list = load();
    var key = normalizeKey(entry.title, entry.year);
    var next = list.filter(function (row) {
      return normalizeKey(row.title, row.year) !== key;
    });
    next.unshift({
      title: String(entry.title || "").trim(),
      year: String(entry.year || "").trim(),
      tag: entry.tag || "want",
      addedAt: Date.now(),
    });
    save(next);
    return next;
  }

  function remove(title, year) {
    var key = normalizeKey(title, year);
    var next = load().filter(function (row) {
      return normalizeKey(row.title, row.year) !== key;
    });
    save(next);
    return next;
  }

  global.HalalFlicksShelf = {
    load: load,
    add: add,
    remove: remove,
    tagLabel: function (tag) {
      if (tag === "watched") return "Already watched";
      if (tag === "favorite") return "Favorite";
      return "Want to watch";
    },
  };
})(typeof window !== "undefined" ? window : this);
