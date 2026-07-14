/**
 * LoreKeeper — writing glossary (#3 snippets, #4 chips, #5 completion, #15 doc terms).
 */
(function (global) {
  var GLOSSARY_KEY = "lorekeeper_writing_glossary_v1";
  var CHIP_KINDS = ["character", "place", "faction", "species"];
  var MAX_CHIPS = 12;
  var MAX_COMPLETE = 5;
  var MIN_PREFIX = 2;

  var data = { snippets: [], pinned: [] };
  var readyResolve;
  var ready = new Promise(function (resolve) {
    readyResolve = resolve;
  });

  function normalize(raw) {
    return String(raw || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function normalizeWork(raw) {
    return normalize(raw).toLowerCase();
  }

  function load() {
    if (!global.LoreKeeperAccountStorage) return { snippets: [], pinned: [] };
    var raw = global.LoreKeeperAccountStorage.getItem(GLOSSARY_KEY);
    if (!raw) {
      data = { snippets: [], pinned: [] };
      return snapshot();
    }
    try {
      var parsed = JSON.parse(raw);
      data = {
        snippets: Array.isArray(parsed.snippets) ? parsed.snippets : [],
        pinned: Array.isArray(parsed.pinned) ? parsed.pinned.map(normalize).filter(Boolean) : [],
      };
    } catch (e) {
      data = { snippets: [], pinned: [] };
    }
    return snapshot();
  }

  function snapshot() {
    return {
      snippets: data.snippets.slice(),
      pinned: data.pinned.slice(),
    };
  }

  function persist() {
    if (!global.LoreKeeperAccountStorage) return;
    global.LoreKeeperAccountStorage.setItem(GLOSSARY_KEY, JSON.stringify(data));
    fireChanged();
  }

  function fireChanged() {
    try {
      global.dispatchEvent(new CustomEvent("lorekeeper-writing-glossary-changed"));
    } catch (e) {
      global.dispatchEvent(new Event("lorekeeper-writing-glossary-changed"));
    }
  }

  function uid() {
    return "g_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  function addSnippet(shortcut, text) {
    shortcut = normalize(shortcut).replace(/\s/g, "");
    text = normalize(text);
    if (!shortcut || !text) return false;
    if (data.snippets.some(function (s) { return s.shortcut.toLowerCase() === shortcut.toLowerCase(); })) {
      return false;
    }
    data.snippets.push({ id: uid(), shortcut: shortcut, text: text });
    persist();
    return true;
  }

  function removeSnippet(id) {
    var before = data.snippets.length;
    data.snippets = data.snippets.filter(function (s) {
      return s.id !== id;
    });
    if (data.snippets.length === before) return false;
    persist();
    return true;
  }

  function addPinned(term) {
    term = normalize(term);
    if (!term) return false;
    var key = term.toLowerCase();
    if (data.pinned.some(function (p) { return p.toLowerCase() === key; })) return false;
    data.pinned.push(term);
    persist();
    return true;
  }

  function removePinned(term) {
    var key = normalize(term).toLowerCase();
    var before = data.pinned.length;
    data.pinned = data.pinned.filter(function (p) {
      return p.toLowerCase() !== key;
    });
    if (data.pinned.length === before) return false;
    persist();
    return true;
  }

  function entryMatchesWork(entry, workTag) {
    if (!workTag) return false;
    var w = normalizeWork(workTag);
    return (entry.tags || []).some(function (t) {
      return normalizeWork(t) === w;
    });
  }

  function workEntryTitles(workTag) {
    if (!global.LoreKeeperEntries || !workTag) return [];
    return global.LoreKeeperEntries.load()
      .filter(function (e) {
        return CHIP_KINDS.indexOf(e.kind) >= 0 && entryMatchesWork(e, workTag) && normalize(e.title);
      })
      .sort(function (a, b) {
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      })
      .map(function (e) {
        return normalize(e.title);
      });
  }

  function extractDocTerms(doc) {
    if (!doc || !doc.loreTermsEnabled || !global.LoreKeeperDocuments) return [];
    var plain = global.LoreKeeperDocuments.bodyPlainText(doc.bodyHtml || "");
    if (!plain) return [];
    var matches = plain.match(/\b[A-Z][a-z]{2,}(?:['\u2019][A-Za-z]+)?\b/g) || [];
    var counts = {};
    matches.forEach(function (w) {
      counts[w] = (counts[w] || 0) + 1;
    });
    return Object.keys(counts).filter(function (w) {
      return counts[w] >= 2 || /^[A-Z]/.test(w);
    });
  }

  function uniquePush(list, seen, word) {
    var w = normalize(word);
    if (!w || w.length < 2) return;
    var key = w.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    list.push(w);
  }

  function allTerms(context) {
    context = context || {};
    var seen = {};
    var out = [];
    load();
    data.pinned.forEach(function (p) {
      uniquePush(out, seen, p);
    });
    data.snippets.forEach(function (s) {
      uniquePush(out, seen, s.text);
    });
    workEntryTitles(context.workTag).forEach(function (t) {
      uniquePush(out, seen, t);
    });
    if (context.doc) {
      extractDocTerms(context.doc).forEach(function (t) {
        uniquePush(out, seen, t);
      });
    }
    if (global.LoreKeeperSpellWords) {
      global.LoreKeeperSpellWords.load().forEach(function (t) {
        uniquePush(out, seen, t);
      });
    }
    return out;
  }

  function getChips(context) {
    load();
    var chips = [];
    var seen = {};
    function pushChip(label, insert) {
      var key = insert.toLowerCase();
      if (seen[key] || chips.length >= MAX_CHIPS) return;
      seen[key] = true;
      chips.push({ label: label, insert: insert });
    }
    data.pinned.forEach(function (p) {
      pushChip(p, p);
    });
    data.snippets.forEach(function (s) {
      pushChip(s.text, s.text);
    });
    workEntryTitles(context.workTag).forEach(function (t) {
      pushChip(t, t);
    });
    if (context.doc && context.doc.loreTermsEnabled) {
      extractDocTerms(context.doc)
        .slice(0, 6)
        .forEach(function (t) {
          pushChip(t, t);
        });
    }
    return chips;
  }

  function prefixMatches(prefix, context) {
    prefix = normalize(prefix);
    if (prefix.length < MIN_PREFIX) return [];
    var lower = prefix.toLowerCase();
    var matches = [];
    var seen = {};
    load();

    data.snippets.forEach(function (s) {
      if (s.shortcut.toLowerCase() === lower) {
        var key = s.text.toLowerCase();
        if (!seen[key]) {
          seen[key] = true;
          matches.push({ word: s.text, kind: "snippet" });
        }
      }
    });

    allTerms(context).forEach(function (term) {
      if (term.length <= prefix.length) return;
      if (term.toLowerCase().indexOf(lower) === 0) {
        var key = term.toLowerCase();
        if (!seen[key]) {
          seen[key] = true;
          matches.push({ word: term, kind: "lore" });
        }
      }
    });

    return matches.slice(0, MAX_COMPLETE);
  }

  function partialWordTextarea(el) {
    if (!el) return null;
    var val = el.value || "";
    var pos = el.selectionStart;
    if (pos == null) return null;
    var before = val.slice(0, pos);
    var m = before.match(/[A-Za-z\u2019']+$/);
    if (!m || m[0].length < MIN_PREFIX) return null;
    return { start: pos - m[0].length, end: pos, word: m[0] };
  }

  function partialWordQuill(quill) {
    if (!quill) return null;
    var sel = quill.getSelection();
    if (!sel) return null;
    var text = quill.getText(0, sel.index);
    var m = text.match(/[A-Za-z\u2019']+$/);
    if (!m || m[0].length < MIN_PREFIX) return null;
    return { start: sel.index - m[0].length, end: sel.index, word: m[0] };
  }

  function replacePartialTextarea(el, partial, replacement) {
    var val = el.value || "";
    el.value = val.slice(0, partial.start) + replacement + val.slice(partial.end);
    var pos = partial.start + replacement.length;
    el.selectionStart = pos;
    el.selectionEnd = pos;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
  }

  function replacePartialQuill(quill, partial, replacement) {
    quill.deleteText(partial.start, partial.end - partial.start, "user");
    quill.insertText(partial.start, replacement, "user");
    quill.setSelection(partial.start + replacement.length, 0, "user");
    quill.focus();
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

  global.LoreKeeperWritingGlossary = {
    GLOSSARY_KEY: GLOSSARY_KEY,
    ready: ready,
    load: load,
    addSnippet: addSnippet,
    removeSnippet: removeSnippet,
    addPinned: addPinned,
    removePinned: removePinned,
    getChips: getChips,
    prefixMatches: prefixMatches,
    partialWordTextarea: partialWordTextarea,
    partialWordQuill: partialWordQuill,
    replacePartialTextarea: replacePartialTextarea,
    replacePartialQuill: replacePartialQuill,
    extractDocTerms: extractDocTerms,
  };

  initWhenReady();
})(typeof window !== "undefined" ? window : this);
