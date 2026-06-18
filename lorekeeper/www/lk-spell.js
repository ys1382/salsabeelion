/**
 * LoreKeeper — local spellcheck (Typo.js + Hunspell). No outside AI; flags typos only.
 */
(function (global) {
  var WORD_RE = /\b[A-Za-z']+\b/g;
  var typo = null;
  var loadFailed = false;
  var readyResolve;
  var ready = new Promise(function (resolve) {
    readyResolve = resolve;
  });
  var debounceTimers = new WeakMap();

  function spellBase() {
    var loc = global.location;
    if (!loc || !loc.pathname) return "./vendor/spell/";
    var path = String(loc.pathname || "");
    if (path.indexOf("/lorekeeper") !== -1) {
      var basePath = path.replace(/\/?[^/]*\.html?$/i, "").replace(/\/$/, "");
      if (basePath.slice(-11) !== "/lorekeeper") {
        var idx = basePath.indexOf("/lorekeeper");
        if (idx !== -1) basePath = basePath.slice(0, idx + "/lorekeeper".length);
      }
      return loc.origin + basePath + "/vendor/spell/";
    }
    return "./vendor/spell/";
  }

  function fetchText(url) {
    return fetch(url, { credentials: "same-origin" }).then(function (res) {
      if (!res.ok) throw new Error("spell_dict");
      return res.text();
    });
  }

  function loadDictionary() {
    if (!global.Typo) return Promise.reject(new Error("no_typo"));
    var base = spellBase();
    return Promise.all([fetchText(base + "en_US.aff"), fetchText(base + "en_US.dic")]).then(function (parts) {
      typo = new global.Typo("en_US", parts[0], parts[1], { platform: "any" });
    });
  }

  function stripPossessive(word) {
    if (word.length > 3 && word.slice(-2) === "'s") return word.slice(0, -2);
    if (word.length > 2 && word.charAt(word.length - 1) === "'") return word.slice(0, -1);
    return word;
  }

  function dictOk(word) {
    if (!typo || !word) return true;
    if (typo.check(word)) return true;
    var stripped = stripPossessive(word);
    if (stripped !== word && typo.check(stripped)) return true;
    return false;
  }

  function isOk(word) {
    if (!word) return true;
    if (word.length < 2) return true;
    if (/^\d+$/.test(word)) return true;
    if (/^[A-Z]{2,}$/.test(word) && word.length <= 4) return true;
    if (global.LoreKeeperSpellWords) {
      if (global.LoreKeeperSpellWords.has(word)) return true;
      var base = stripPossessive(word);
      if (base !== word && global.LoreKeeperSpellWords.has(base)) return true;
    }
    return dictOk(word);
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var row = [];
    var i;
    for (i = 0; i <= b.length; i++) row[i] = i;
    for (i = 1; i <= a.length; i++) {
      var prev = i;
      var j;
      for (j = 1; j <= b.length; j++) {
        var val = row[j - 1];
        if (a.charAt(i - 1) !== b.charAt(j - 1)) {
          val = Math.min(val, row[j], row[j - 1]) + 1;
        }
        row[j - 1] = prev;
        prev = val;
      }
      row[b.length] = prev;
    }
    return row[b.length];
  }

  function matchCase(from, to) {
    if (!from || !to) return to;
    if (from === from.toUpperCase()) return to.toUpperCase();
    if (from.charAt(0) === from.charAt(0).toUpperCase()) {
      return to.charAt(0).toUpperCase() + to.slice(1);
    }
    return to;
  }

  function letterKey(w) {
    return String(w || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .split("")
      .sort()
      .join("");
  }

  function hasAdjacentSwap(a, b) {
    if (a.length !== b.length || a.length < 2) return false;
    var al = a.toLowerCase();
    var bl = b.toLowerCase();
    if (al === bl) return false;
    var i;
    for (i = 0; i < al.length - 1; i++) {
      if (al.charAt(i) !== bl.charAt(i) || al.charAt(i + 1) !== bl.charAt(i + 1)) {
        var swapped = al.slice(0, i) + al.charAt(i + 1) + al.charAt(i) + al.slice(i + 2);
        if (swapped === bl) return true;
        return false;
      }
    }
    return false;
  }

  function suggestionTie(wordLow, suggestions, distanceFn, maxDist) {
    if (!suggestions || suggestions.length < 2) return false;
    var topDist = distanceFn(wordLow, suggestions[0].toLowerCase());
    if (topDist > maxDist) return false;
    var i;
    for (i = 1; i < Math.min(suggestions.length, 5); i++) {
      var cand = suggestions[i];
      if (!cand) continue;
      if (distanceFn(wordLow, cand.toLowerCase()) <= maxDist && cand.toLowerCase() !== suggestions[0].toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  function confidentSuggestion(word) {
    if (!typo || isOk(word)) return null;
    var suggestions = typo.suggest(word);
    if (!suggestions || !suggestions.length) return null;
    var top = suggestions[0];
    if (!top || top.toLowerCase() === word.toLowerCase()) return null;
    if (!dictOk(top)) return null;

    var wl = word.toLowerCase();
    var tl = top.toLowerCase();
    var dist = levenshtein(wl, tl);

    if (dist === 1) {
      if (suggestionTie(wl, suggestions, levenshtein, 1)) return null;
      return matchCase(word, top);
    }

    if (word.length === top.length && word.length >= 4 && letterKey(word) === letterKey(top)) {
      var j;
      for (j = 1; j < Math.min(suggestions.length, 5); j++) {
        if (letterKey(suggestions[j]) === letterKey(word) && suggestions[j].toLowerCase() !== tl) {
          return null;
        }
      }
      return matchCase(word, top);
    }

    if (hasAdjacentSwap(wl, tl)) {
      if (suggestionTie(wl, suggestions, function (a, b) {
        return hasAdjacentSwap(a, b) ? 1 : 99;
      }, 1)) {
        return null;
      }
      return matchCase(word, top);
    }

    return null;
  }

  function autocorrectText(text) {
    if (!text || !typo || loadFailed) return { text: text, fixed: [] };
    var fixed = [];
    var out = text.replace(WORD_RE, function (word) {
      if (isOk(word)) return word;
      var rep = confidentSuggestion(word);
      if (!rep) return word;
      fixed.push({ from: word, to: rep });
      return rep;
    });
    return { text: out, fixed: fixed };
  }

  function findMisspellings(text) {
    if (!text || !typo) return [];
    var out = [];
    var seen = {};
    var m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(text))) {
      var w = m[0];
      if (isOk(w)) continue;
      var key = w.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      out.push(w);
    }
    return out;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function showSpellStatus(flagsEl) {
    if (!flagsEl) return;
    if (loadFailed) {
      flagsEl.hidden = false;
      flagsEl.textContent = "Spelling list could not load — hard refresh the page and try again.";
      flagsEl.className = "lk-spell-flags lk-spell-flags--warn";
      return;
    }
    if (!typo) return;
    flagsEl.className = "lk-spell-flags";
  }

  function renderFlags(container, words) {
    if (!container) return;
    if (loadFailed) {
      showSpellStatus(container);
      return;
    }
    container.className = "lk-spell-flags";
    container.innerHTML = "";
    if (!words.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    var lead = document.createElement("span");
    lead.className = "lk-spell-flags-lead";
    lead.textContent = "Possible typos: ";
    container.appendChild(lead);
    words.forEach(function (word) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lk-spell-flag";
      btn.textContent = word;
      btn.title = "Add “" + word + "” to My words so it is never flagged";
      btn.addEventListener("click", function () {
        if (global.LoreKeeperSpellWords) global.LoreKeeperSpellWords.add(word);
      });
      container.appendChild(btn);
    });
    var hint = document.createElement("span");
    hint.className = "muted lk-spell-flags-hint";
    hint.textContent = " — tap a word to keep it";
    container.appendChild(hint);
  }

  function debounceInput(el, fn, ms) {
    el.addEventListener("input", function () {
      var t = debounceTimers.get(el);
      if (t) clearTimeout(t);
      t = setTimeout(fn, ms);
      debounceTimers.set(el, t);
    });
  }

  function bindTextarea(textarea, flagsEl) {
    if (!textarea) return;
    textarea.setAttribute("spellcheck", "false");
    textarea.setAttribute("autocorrect", "off");
    textarea.setAttribute("autocapitalize", "off");

    function run() {
      renderFlags(flagsEl, findMisspellings(textarea.value));
    }

    debounceInput(textarea, run, 450);
    global.addEventListener("lorekeeper-spell-words-changed", run);
    global.LoreKeeperSpell.ready.then(function () {
      showSpellStatus(flagsEl);
      run();
    });
  }

  function registerQuillSpellBlot() {
    if (!global.Quill || global.Quill.__lkSpellBlot) return;
    var Inline = global.Quill.import("blots/inline");
    function SpellError() {
      Inline.apply(this, arguments);
    }
    SpellError.prototype = Object.create(Inline.prototype);
    SpellError.prototype.constructor = SpellError;
    SpellError.blotName = "lkSpell";
    SpellError.className = "lk-spell-error";
    SpellError.tagName = "SPAN";
    global.Quill.register(SpellError, true);
    global.Quill.__lkSpellBlot = true;
  }

  function clearQuillSpellMarks(quill) {
    if (!quill) return;
    quill.formatText(0, quill.getLength(), "lkSpell", false, "silent");
  }

  function applyQuillSpellMarks(quill) {
    if (!quill || !typo) return;
    clearQuillSpellMarks(quill);
    var text = quill.getText();
    var m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(text))) {
      if (!isOk(m[0])) {
        quill.formatText(m.index, m[0].length, "lkSpell", true, "silent");
      }
    }
  }

  function bindQuill(quill, flagsEl) {
    if (!quill) return;
    registerQuillSpellBlot();
    var root = quill.root;
    if (root) {
      root.setAttribute("spellcheck", "false");
      root.setAttribute("autocorrect", "off");
    }

    function run() {
      renderFlags(flagsEl, findMisspellings(quill.getText()));
      applyQuillSpellMarks(quill);
    }

    quill.on("text-change", function (_delta, _old, source) {
      if (source !== "user") return;
      var t = debounceTimers.get(quill);
      if (t) clearTimeout(t);
      t = setTimeout(run, 450);
      debounceTimers.set(quill, t);
    });
    global.addEventListener("lorekeeper-spell-words-changed", run);
    run();
    return {
      clearMarks: function () {
        clearQuillSpellMarks(quill);
      },
      refresh: run,
    };
  }

  function init() {
    Promise.all([
      global.LoreKeeperSpellWords ? global.LoreKeeperSpellWords.ready : Promise.resolve(),
      global.LoreKeeperAccountStorage ? global.LoreKeeperAccountStorage.ready : Promise.resolve(),
    ])
      .then(loadDictionary)
      .then(function () {
        readyResolve();
      })
      .catch(function () {
        loadFailed = true;
        readyResolve();
      });
  }

  global.LoreKeeperSpell = {
    ready: ready,
    isOk: isOk,
    findMisspellings: findMisspellings,
    autocorrectText: autocorrectText,
    bindTextarea: bindTextarea,
    bindQuill: bindQuill,
    clearQuillSpellMarks: clearQuillSpellMarks,
    registerQuillSpellBlot: registerQuillSpellBlot,
  };

  init();
})(typeof window !== "undefined" ? window : this);
