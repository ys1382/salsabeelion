/**
 * LoreKeeper — entry list load/save (human-written notes only).
 */
(function (global) {
  var KINDS = [
    { id: "note", label: "Note — anything else" },
    { id: "character", label: "Character" },
    { id: "relationship", label: "Relationship" },
    { id: "politics", label: "Politics & intrigue" },
    { id: "place", label: "Place / setting" },
    { id: "scene", label: "Scene" },
    { id: "visual", label: "Visual / illustration" },
    { id: "design", label: "Design & typography" },
    { id: "dialogue", label: "Dialogue & voice" },
    { id: "plot", label: "Plot & structure" },
    { id: "script", label: "Script" },
    { id: "event", label: "Event" },
    { id: "faction", label: "Faction / group" },
    { id: "species", label: "Species / world rules" },
    { id: "theme", label: "Theme & motif" },
    { id: "reference", label: "Reference / inspo" },
  ];

  function uid() {
    return "e_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
  }

  function loadEntries() {
    var Store = global.LoreKeeperAccountStorage;
    if (!Store || !Store.isSignedIn()) return [];
    var raw = Store.getItem(Store.ENTRIES_KEY);
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveEntries(list) {
    var Store = global.LoreKeeperAccountStorage;
    if (!Store || !Store.isSignedIn()) return false;
    return Store.setItem(Store.ENTRIES_KEY, JSON.stringify(list || []));
  }

  function kindLabel(id) {
    for (var i = 0; i < KINDS.length; i++) {
      if (KINDS[i].id === id) return KINDS[i].label;
    }
    return "Note";
  }

  function parseTags(text) {
    return String(text || "")
      .split(",")
      .map(function (t) {
        return t.trim();
      })
      .filter(Boolean);
  }

  function spellFixTitleBody(title, body) {
    return {
      title: String(title || "").trim(),
      body: String(body || "").trim(),
      fixedCount: 0,
    };
  }

  function buildEntry(opts) {
    opts = opts || {};
    var now = Date.now();
    var spell = spellFixTitleBody(opts.title, opts.body);
    var entry = {
      id: opts.id || uid(),
      kind: opts.kind || "note",
      title: spell.title,
      body: spell.body,
      tags: parseTags(opts.tagsText),
      createdAt: opts.createdAt || now,
      updatedAt: now,
    };
    if (opts.linkedDocId) entry.linkedDocId = opts.linkedDocId;
    if (opts.linkedDocTitle) entry.linkedDocTitle = opts.linkedDocTitle;
    return { entry: entry, fixedCount: spell.fixedCount, title: spell.title, body: spell.body };
  }

  function prepareSave(opts) {
    var built = buildEntry(opts);
    if (!built.entry.title && !built.entry.body) {
      return { ok: false, error: "Add a title or some text first." };
    }
    return {
      ok: true,
      entry: built.entry,
      fixedCount: built.fixedCount,
      title: built.title,
      body: built.body,
    };
  }

  function upsertInList(list, entry) {
    var found = false;
    list = (list || []).map(function (e) {
      if (e.id !== entry.id) return e;
      found = true;
      return {
        id: entry.id,
        kind: entry.kind,
        title: entry.title,
        body: entry.body,
        tags: entry.tags,
        createdAt: e.createdAt || entry.createdAt,
        updatedAt: entry.updatedAt,
        linkedDocId: entry.linkedDocId || e.linkedDocId,
        linkedDocTitle: entry.linkedDocTitle || e.linkedDocTitle,
      };
    });
    if (!found) list.push(entry);
    return list;
  }

  global.LoreKeeperEntries = {
    KINDS: KINDS,
    uid: uid,
    load: loadEntries,
    save: saveEntries,
    kindLabel: kindLabel,
    parseTags: parseTags,
    prepareSave: prepareSave,
    upsertInList: upsertInList,
    exportJson: function () {
      return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entries: loadEntries() }, null, 2);
    },
    importJson: function (text) {
      var parsed = JSON.parse(text);
      var entries = parsed && parsed.entries ? parsed.entries : parsed;
      if (!Array.isArray(entries)) throw new Error("bad_format");
      saveEntries(entries);
      return entries.length;
    },
  };
})(typeof window !== "undefined" ? window : this);
