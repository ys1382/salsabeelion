/**
 * LoreKeeper — local spellcheck (Typo.js + Hunspell). No outside AI; flags typos only.
 */
(function (global) {
  /** Words + contractions (isn't, don't) — old regex split at the apostrophe into "isn". */
  var WORD_RE = /\b[A-Za-z]+(?:['\u2019][A-Za-z]+)?\b/g;
  var typo = null;
  var loadFailed = false;
  var readyResolve;
  var ready = new Promise(function (resolve) {
    readyResolve = resolve;
  });
  var debounceTimers = new WeakMap();
  var FLAG_HOLD_MS = 480;
  var FLAG_MOVE_PX = 10;
  var textareaJump = { key: "", indices: [], cursor: 0, textarea: null };

  /** Latin / fixed phrases — do not flag pieces like "se" in "per se". */
  var ALLOWED_PHRASES = [
    "per se",
    "ad hoc",
    "et cetera",
    "de facto",
    "et al",
    "et al.",
    "vice versa",
    "status quo",
    "bona fide",
    "a priori",
    "a posteriori",
    "per capita",
    "pro bono",
    "ad nauseam",
    "modus operandi",
    "quid pro quo",
    "de jure",
    "vis-a-vis",
    "vis à vis",
    "prima facie",
    "sui generis",
    "ipso facto",
    "in situ",
    "in vitro",
    "in vivo",
    "per annum",
    "mea culpa",
    "alma mater",
    "ex officio",
    "post hoc",
    "inter alia",
    "mutatis mutandis",
    "deus ex machina",
    "persona non grata",
  ];

  /** Valid English the US Hunspell list often misses — not story names. */
  var EXTRA_DICT_WORDS = {
    amongst: true,
    whilst: true,
    okay: true,
    ok: true,
    grey: true,
    fulfil: true,
    fulfilment: true,
    focussed: true,
    furore: true,
    judgement: true,
    learnt: true,
    smelt: true,
    spelt: true,
    dreamt: true,
    burnt: true,
    spoilt: true,
  };

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function phrasePattern(phrase) {
    var parts = String(phrase).trim().split(/\s+/);
    return new RegExp("\\b" + parts.map(escapeRegExp).join("\\s+") + "\\b", "gi");
  }

  function getPhraseRanges(text) {
    var ranges = [];
    if (!text) return ranges;
    ALLOWED_PHRASES.forEach(function (phrase) {
      var re = phrasePattern(phrase);
      var m;
      re.lastIndex = 0;
      while ((m = re.exec(text))) {
        ranges.push([m.index, m.index + m[0].length]);
      }
    });
    return ranges;
  }

  function isInAllowedPhrase(index, length, ranges) {
    var end = index + length;
    var i;
    for (i = 0; i < ranges.length; i++) {
      if (index >= ranges[i][0] && end <= ranges[i][1]) return true;
    }
    return false;
  }

  function normalizeSpellText(text) {
    return String(text || "").replace(/[\u2018\u2019\u2032`´]/g, "'");
  }

  function isContractionPrefix(word, text, index) {
    if (index == null || !text) return false;
    return /^['\u2019][a-z]{1,3}\b/i.test(text.slice(index + word.length));
  }

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

  function looksLikeProperNoun(word) {
    if (!word || word.length < 2) return false;
    if (/^[A-Z][a-z]+(?:'[a-z]+)?$/.test(word)) return true;
    if (/^[A-Z][a-z]*[A-Z][a-z]+$/.test(word)) return true;
    return false;
  }

  function isOk(word) {
    if (!word) return true;
    if (word.length <= 2) return true;
    if (/^\d+$/.test(word)) return true;
    if (/^[A-Z]{2,}$/.test(word) && word.length <= 4) return true;
    if (looksLikeProperNoun(word)) return true;
    if (EXTRA_DICT_WORDS[word.toLowerCase()]) return true;
    if (global.LoreKeeperSpellWords) {
      if (global.LoreKeeperSpellWords.has(word)) return true;
      var base = stripPossessive(word);
      if (base !== word && global.LoreKeeperSpellWords.has(base)) return true;
    }
    return dictOk(word);
  }

  function likelyTypo(word) {
    if (confidentSuggestion(word)) return true;
    if (!typo || word !== word.toLowerCase() || word.length < 3) return false;
    var suggestions = typo.suggest(word);
    if (!suggestions || !suggestions.length) return false;
    var top = suggestions[0];
    if (!top || top.toLowerCase() === word.toLowerCase() || !dictOk(top)) return false;
    var dist = levenshtein(word.toLowerCase(), top.toLowerCase());
    if (dist === 1) return !suggestionTie(word.toLowerCase(), suggestions, levenshtein, 1);
    if (word.length >= 5 && dist === 2) {
      return !suggestionTie(word.toLowerCase(), suggestions, levenshtein, 2);
    }
    return false;
  }

  function shouldFlagWord(word, text, index, phraseRanges) {
    if (isOk(word)) return false;
    if (looksLikeProperNoun(word)) return false;
    if (isContractionPrefix(word, text, index)) return false;
    if (index != null && phraseRanges && isInAllowedPhrase(index, word.length, phraseRanges)) {
      return false;
    }
    return likelyTypo(word);
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
    if (word !== word.toLowerCase()) return null;
    if (word.length < 4) return null;

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

    if (word.length >= 5 && hasAdjacentSwap(wl, tl)) {
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
    return { text: text, fixed: [] };
  }

  function findMisspellings(text) {
    if (!text || !typo) return [];
    var normalized = normalizeSpellText(text);
    var out = [];
    var seen = {};
    var phraseRanges = getPhraseRanges(normalized);
    var m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(normalized))) {
      var w = m[0];
      if (!shouldFlagWord(w, normalized, m.index, phraseRanges)) continue;
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

  function findWordIndicesSimple(text, word) {
    if (!word) return [];
    var re = new RegExp("\\b" + escapeRegExp(word) + "\\b", "gi");
    var out = [];
    var m;
    while ((m = re.exec(text))) {
      out.push(m.index);
    }
    return out;
  }

  function showJumpToast(message) {
    if (global.LoreKeeperDocLongPress && global.LoreKeeperDocLongPress.showToast) {
      global.LoreKeeperDocLongPress.showToast(message, "typo");
      return;
    }
    var el = document.getElementById("lkSpellJumpToast");
    if (!el) {
      el = document.createElement("p");
      el.id = "lkSpellJumpToast";
      el.className = "lk-longpress-toast is-typo";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.hidden = true;
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    clearTimeout(showJumpToast._timer);
    showJumpToast._timer = setTimeout(function () {
      el.hidden = true;
    }, 2800);
  }

  function jumpInTextarea(textarea, word) {
    if (!textarea || !word) return;
    var text = textarea.value || "";
    var key = word.toLowerCase();
    var indices = findWordIndicesSimple(text, word);
    if (!indices.length) {
      showJumpToast("No matches for “" + word + "” in this note.");
      return;
    }
    if (textareaJump.key !== key || textareaJump.textarea !== textarea) {
      textareaJump.key = key;
      textareaJump.textarea = textarea;
      textareaJump.indices = indices;
      textareaJump.cursor = 0;
    } else {
      textareaJump.cursor = (textareaJump.cursor + 1) % indices.length;
    }
    var at = indices[textareaJump.cursor];
    textarea.focus();
    textarea.setSelectionRange(at, at + word.length);
    var lineHeight = parseInt(global.getComputedStyle(textarea).lineHeight, 10) || 20;
    var line = (text.slice(0, at).match(/\n/g) || []).length + 1;
    textarea.scrollTop = Math.max(0, (line - 2) * lineHeight);
    textarea.classList.add("is-typo-jump-flash");
    setTimeout(function () {
      textarea.classList.remove("is-typo-jump-flash");
    }, 650);
    showJumpToast(
      "Typo “" +
        word +
        "”: " +
        (textareaJump.cursor + 1) +
        " of " +
        indices.length +
        " — hold the flag again for next"
    );
  }

  function bindSpellFlagBtn(btn, word, jumpOpts) {
    var pending = null;
    var didHold = false;

    btn.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      didHold = false;
      pending = {
        x: e.clientX,
        y: e.clientY,
        timer: setTimeout(function () {
          didHold = true;
          btn.classList.add("is-flag-hold");
          if (jumpOpts && jumpOpts.onJump) jumpOpts.onJump(word);
          pending = null;
          setTimeout(function () {
            btn.classList.remove("is-flag-hold");
          }, 220);
        }, FLAG_HOLD_MS),
      };
    });

    function cancel() {
      if (pending && pending.timer) clearTimeout(pending.timer);
      pending = null;
    }

    btn.addEventListener("pointermove", function (e) {
      if (!pending) return;
      if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > FLAG_MOVE_PX) cancel();
    });
    btn.addEventListener("pointerup", cancel);
    btn.addEventListener("pointercancel", cancel);

    btn.addEventListener("click", function (e) {
      if (didHold) {
        e.preventDefault();
        e.stopPropagation();
        didHold = false;
        return;
      }
      if (global.LoreKeeperSpellWords) global.LoreKeeperSpellWords.add(word);
    });
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

  function renderFlags(container, words, jumpOpts) {
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
    lead.textContent = "Possible typos (won't change your text): ";
    container.appendChild(lead);
    words.forEach(function (word) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lk-spell-flag";
      btn.textContent = word;
      btn.title =
        jumpOpts && jumpOpts.onJump
          ? "Hold to find “" + word + "” in your text — tap to keep in My words"
          : "Add “" + word + "” to My words so it is never flagged";
      bindSpellFlagBtn(btn, word, jumpOpts);
      container.appendChild(btn);
    });
    var hint = document.createElement("span");
    hint.className = "muted lk-spell-flags-hint";
    hint.textContent =
      jumpOpts && jumpOpts.onJump
        ? " — hold a flagged word to find it, tap to keep"
        : " — tap a word to keep it";
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
      renderFlags(flagsEl, findMisspellings(textarea.value), {
        onJump: function (word) {
          jumpInTextarea(textarea, word);
        },
      });
    }

    textarea.addEventListener("input", function () {
      textareaJump.key = "";
      textareaJump.indices = [];
      textareaJump.cursor = 0;
    });

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
    var text = normalizeSpellText(quill.getText());
    var phraseRanges = getPhraseRanges(text);
    var m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(text))) {
      if (shouldFlagWord(m[0], text, m.index, phraseRanges)) {
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
      renderFlags(flagsEl, findMisspellings(quill.getText()), {
        onJump: function (word) {
          if (global.LoreKeeperDocTypoJump && global.LoreKeeperDocTypoJump.advance) {
            global.LoreKeeperDocTypoJump.advance(quill, word, null, null);
          }
        },
      });
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
    var path = String((global.location && global.location.pathname) || "");
    if (/doc\.html$/i.test(path)) {
      startDictionaryLoad();
      return;
    }
    readyResolve();
  }

  var dictLoadStarted = false;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (!global.document) {
        reject(new Error("no_document"));
        return;
      }
      if (global.document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var tag = global.document.createElement("script");
      tag.src = src;
      tag.onload = function () {
        resolve();
      };
      tag.onerror = function () {
        reject(new Error("script_load"));
      };
      global.document.head.appendChild(tag);
    });
  }

  function spellAssetBase() {
    var base = spellBase();
    return base.indexOf("/vendor/spell/") >= 0 ? base.replace(/vendor\/spell\/$/, "") : "./";
  }

  function startDictionaryLoad() {
    if (dictLoadStarted) return ready;
    dictLoadStarted = true;
    var assetBase = spellAssetBase();
    Promise.resolve()
      .then(function () {
        if (!global.Typo) return loadScript(assetBase + "vendor/spell/typo.js");
      })
      .then(function () {
        if (!global.LoreKeeperSpellWords) return loadScript(assetBase + "lk-spell-words.js?v=3");
      })
      .then(function () {
        var waits = [global.LoreKeeperAccountStorage ? global.LoreKeeperAccountStorage.ready : Promise.resolve()];
        if (global.LoreKeeperSpellWords && global.LoreKeeperSpellWords.ready) {
          waits.push(global.LoreKeeperSpellWords.ready);
        }
        return Promise.all(waits);
      })
      .then(loadDictionary)
      .then(function () {
        readyResolve();
      })
      .catch(function () {
        loadFailed = true;
        readyResolve();
      });
    return ready;
  }

  function ensureLoaded() {
    if (typo || loadFailed) return ready;
    return startDictionaryLoad();
  }

  global.LoreKeeperSpell = {
    ready: ready,
    ensureLoaded: ensureLoaded,
    isOk: isOk,
    shouldFlagWord: shouldFlagWord,
    findMisspellings: findMisspellings,
    autocorrectText: autocorrectText,
    bindTextarea: bindTextarea,
    bindQuill: bindQuill,
    clearQuillSpellMarks: clearQuillSpellMarks,
    registerQuillSpellBlot: registerQuillSpellBlot,
  };

  init();
})(typeof window !== "undefined" ? window : this);
