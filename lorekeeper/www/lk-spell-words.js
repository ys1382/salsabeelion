/**
 * LoreKeeper — personal spelling words (per account, not mixed into notes/docs).
 */
(function (global) {
  var SPELL_WORDS_KEY = "lorekeeper_spell_words_v1";
  var words = [];
  var readyResolve;
  var ready = new Promise(function (resolve) {
    readyResolve = resolve;
  });

  function normalize(raw) {
    return String(raw || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function load() {
    var raw = global.LoreKeeperAccountStorage.getItem(SPELL_WORDS_KEY);
    if (!raw) {
      words = [];
      return words.slice();
    }
    try {
      var parsed = JSON.parse(raw);
      words = Array.isArray(parsed)
        ? parsed.map(normalize).filter(Boolean)
        : [];
    } catch (e) {
      words = [];
    }
    return words.slice();
  }

  function persist() {
    global.LoreKeeperAccountStorage.setItem(SPELL_WORDS_KEY, JSON.stringify(words));
  }

  function has(word) {
    load();
    var key = normalize(word).toLowerCase();
    if (!key) return false;
    return words.some(function (w) {
      return w.toLowerCase() === key;
    });
  }

  function add(word) {
    var clean = normalize(word);
    if (!clean || has(clean)) return false;
    words.push(clean);
    persist();
    try {
      global.dispatchEvent(new CustomEvent("lorekeeper-spell-words-changed"));
    } catch (e) {
      global.dispatchEvent(new Event("lorekeeper-spell-words-changed"));
    }
    return true;
  }

  function remove(word) {
    var key = normalize(word).toLowerCase();
    var before = words.length;
    words = words.filter(function (w) {
      return w.toLowerCase() !== key;
    });
    if (words.length === before) return false;
    persist();
    try {
      global.dispatchEvent(new CustomEvent("lorekeeper-spell-words-changed"));
    } catch (e) {
      global.dispatchEvent(new Event("lorekeeper-spell-words-changed"));
    }
    return true;
  }

  function initWhenReady() {
    if (!global.LoreKeeperAccountStorage) {
      setTimeout(initWhenReady, 0);
      return;
    }
    global.LoreKeeperAccountStorage.ready.then(function () {
      load();
      readyResolve();
    });
  }

  global.LoreKeeperSpellWords = {
    SPELL_WORDS_KEY: SPELL_WORDS_KEY,
    ready: ready,
    load: load,
    has: has,
    add: add,
    remove: remove,
  };

  initWhenReady();
})(typeof window !== "undefined" ? window : this);
