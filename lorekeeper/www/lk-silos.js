/**
 * LoreKeeper — story silos (main draft + belonging notes) and Random ideas pile.
 * Grouping only; does not invent story text.
 */
(function (global) {
  var MIGRATE_FLAG = "lorekeeper_silos_migrate_v1";
  var RANDOM_KEY = "__random_ideas__";

  function membership() {
    return global.LoreKeeperWorkMembership || null;
  }

  function randomLabel() {
    var m = membership();
    return (m && m.RANDOM_IDEAS_LABEL) || "Random ideas";
  }

  function normalizeKey(text) {
    var m = membership();
    if (m && m.normalizeWorkKey) return m.normalizeWorkKey(text);
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function workTitleForDoc(doc) {
    if (!doc) return "";
    var work = String(doc.workTag || "").trim();
    if (work) return work;
    return String(doc.title || "").trim();
  }

  function displayTitleForDoc(doc) {
    return workTitleForDoc(doc) || String((doc && doc.title) || "Untitled").trim() || "Untitled";
  }

  function sortByUpdatedDesc(a, b) {
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  }

  /**
   * Build silo cards from current docs + notes.
   * Returns { silos: [...], randomIdeas: { notes, label } }
   */
  function buildSilos(docs, notes) {
    var m = membership();
    var docList = Array.isArray(docs) ? docs.slice() : [];
    var noteList = Array.isArray(notes) ? notes.slice() : [];
    var byKey = {};
    var order = [];

    function ensureSilo(title) {
      var key = normalizeKey(title);
      if (!key) return null;
      if (!byKey[key]) {
        byKey[key] = {
          key: key,
          title: String(title || "").trim() || "Untitled",
          docs: [],
          notes: [],
          isRandom: false,
        };
        order.push(key);
      } else if (title && String(title).trim().length > byKey[key].title.length) {
        // Prefer the longer canonical display title when soft-matching.
        byKey[key].title = String(title).trim();
      }
      return byKey[key];
    }

    docList.forEach(function (doc) {
      var title = displayTitleForDoc(doc);
      var silo = ensureSilo(title);
      if (silo) silo.docs.push(doc);
    });

    var assigned = {};
    noteList.forEach(function (note) {
      if (!note) return;
      if (m && m.noteIsUnassigned && m.noteIsUnassigned(note)) return;

      var matchedKey = null;
      var matchedTitle = "";

      // Prefer linked document's silo.
      var linked = String(note.linkedDocId || "").trim();
      if (linked) {
        for (var i = 0; i < docList.length; i++) {
          if (String(docList[i].id || "") === linked) {
            matchedTitle = displayTitleForDoc(docList[i]);
            matchedKey = normalizeKey(matchedTitle);
            break;
          }
        }
      }

      if (!matchedKey && m && m.noteBelongsToWork) {
        for (var k = 0; k < order.length; k++) {
          var silo = byKey[order[k]];
          if (m.noteBelongsToWork(note, silo.title)) {
            matchedKey = silo.key;
            matchedTitle = silo.title;
            break;
          }
        }
      }

      // Orphan tagged note — create a notes-only silo from first concrete tag.
      if (!matchedKey && m && m.noteBelongsToWork) {
        var tags = (note.tags || []).filter(function (t) {
          var s = String(t || "").trim();
          return s && !/^not\s*:/i.test(s) && !/^(?:idk|unassigned|unknown|no\s+work|any\s+work|tbd)/i.test(s);
        });
        if (tags.length) {
          matchedTitle = tags[0];
          matchedKey = normalizeKey(matchedTitle);
          ensureSilo(matchedTitle);
        }
      }

      if (matchedKey && byKey[matchedKey]) {
        byKey[matchedKey].notes.push(note);
        assigned[note.id] = true;
      }
    });

    Object.keys(byKey).forEach(function (key) {
      byKey[key].docs.sort(sortByUpdatedDesc);
      byKey[key].notes.sort(sortByUpdatedDesc);
    });

    order.sort(function (a, b) {
      var da = byKey[a].docs[0];
      var db = byKey[b].docs[0];
      var ta = (da && da.updatedAt) || (byKey[a].notes[0] && byKey[a].notes[0].updatedAt) || 0;
      var tb = (db && db.updatedAt) || (byKey[b].notes[0] && byKey[b].notes[0].updatedAt) || 0;
      return tb - ta;
    });

    var randomNotes = noteList
      .filter(function (n) {
        if (!n) return false;
        if (assigned[n.id]) return false;
        if (m && m.noteIsUnassigned) return m.noteIsUnassigned(n);
        return !(n.tags && n.tags.length);
      })
      .sort(sortByUpdatedDesc);

    return {
      silos: order.map(function (key) {
        return byKey[key];
      }),
      randomIdeas: {
        key: RANDOM_KEY,
        title: randomLabel(),
        docs: [],
        notes: randomNotes,
        isRandom: true,
      },
    };
  }

  function alreadyMigrated() {
    try {
      var Store = global.LoreKeeperAccountStorage;
      if (Store && Store.getItem) {
        return Store.getItem(MIGRATE_FLAG) === "1";
      }
      return localStorage.getItem(MIGRATE_FLAG) === "1";
    } catch (e) {
      return false;
    }
  }

  function markMigrated() {
    try {
      var Store = global.LoreKeeperAccountStorage;
      if (Store && Store.setItem) {
        Store.setItem(MIGRATE_FLAG, "1");
        return;
      }
      localStorage.setItem(MIGRATE_FLAG, "1");
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * One-time non-destructive migrate:
   * - Fill blank doc.workTag from title when missing
   * - Attach clear notes (linked doc / soft title match to a known story)
   * - Leave undecided notes unassigned → Random ideas pile
   * Returns { changedDocs, changedNotes }.
   */
  function migrateToSilos() {
    if (alreadyMigrated()) return { changedDocs: 0, changedNotes: 0, skipped: true };
    var m = membership();
    if (!m || !global.LoreKeeperDocuments || !global.LoreKeeperEntries) {
      return { changedDocs: 0, changedNotes: 0, skipped: true };
    }

    var docs = global.LoreKeeperDocuments.load() || [];
    var notes = global.LoreKeeperEntries.load() || [];
    var changedDocs = 0;
    var changedNotes = 0;
    var docsToSave = [];

    var knownWorks = [];
    docs.forEach(function (doc) {
      var title = displayTitleForDoc(doc);
      if (title) knownWorks.push(title);
      if (!String(doc.workTag || "").trim() && String(doc.title || "").trim()) {
        doc.workTag = String(doc.title).trim();
        docsToSave.push(doc);
        changedDocs += 1;
      }
    });

    // Dedupe known works by normalized key (prefer longer label).
    var workByKey = {};
    knownWorks.forEach(function (w) {
      var k = normalizeKey(w);
      if (!k) return;
      if (!workByKey[k] || w.length > workByKey[k].length) workByKey[k] = w;
    });
    var workTitles = Object.keys(workByKey).map(function (k) {
      return workByKey[k];
    });

    notes.forEach(function (note) {
      if (!note || !m.noteIsUnassigned(note)) return;

      var linked = String(note.linkedDocId || "").trim();
      if (linked) {
        for (var i = 0; i < docs.length; i++) {
          if (String(docs[i].id || "") === linked) {
            var wt = workTitleForDoc(docs[i]);
            if (wt) {
              note.tags = (note.tags || []).concat([wt]);
              note.updatedAt = Date.now();
              changedNotes += 1;
            }
            return;
          }
        }
      }

      var titleHits = [];
      workTitles.forEach(function (wt) {
        if (m.noteBelongsToWork(note, wt)) titleHits.push(wt);
      });
      // Only auto-assign when exactly one story matches clearly.
      if (titleHits.length === 1) {
        note.tags = (note.tags || []).filter(Boolean).concat([titleHits[0]]);
        note.updatedAt = Date.now();
        changedNotes += 1;
      }
    });

    docsToSave.forEach(function (doc) {
      global.LoreKeeperDocuments.save(doc);
    });
    if (changedNotes) {
      global.LoreKeeperEntries.save(notes);
    }
    markMigrated();
    return { changedDocs: changedDocs, changedNotes: changedNotes, skipped: false };
  }

  global.LoreKeeperSilos = {
    RANDOM_KEY: RANDOM_KEY,
    randomLabel: randomLabel,
    workTitleForDoc: workTitleForDoc,
    buildSilos: buildSilos,
    migrateToSilos: migrateToSilos,
    alreadyMigrated: alreadyMigrated,
  };
})(typeof window !== "undefined" ? window : globalThis);
