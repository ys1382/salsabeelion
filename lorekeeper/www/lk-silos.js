/**
 * LoreKeeper — story silos (main draft + belonging notes) and Random ideas pile.
 * Grouping only; does not invent story text.
 */
(function (global) {
  var MIGRATE_FLAG = "lorekeeper_silos_migrate_v1";
  var MIGRATE_TEST_DOC_FLAG = "lorekeeper_silos_migrate_v2_test_work_title";
  var RANDOM_KEY = "__random_ideas__";
  // One-shot owner clarification — this exact test doc only, not a lasting rule.
  var ONE_SHOT_RANDOM_DOC_TITLE = "smoke and mirrors work title";

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

  function isRandomIdeasDoc(doc) {
    return !!(doc && doc.randomIdeas);
  }

  function workTitleForDoc(doc) {
    if (!doc) return "";
    if (isRandomIdeasDoc(doc)) return "";
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

  /** Prefer a real storywriting draft over other docs in the same silo. */
  function sortDocsMainFirst(a, b) {
    function score(doc) {
      var t = normalizeKey(doc && doc.title);
      if (/storywriting\s+draft/.test(t)) return 3;
      if (/\bdraft\b/.test(t) && !/work\s+title/.test(t)) return 2;
      return 1;
    }
    var d = score(b) - score(a);
    if (d) return d;
    return sortByUpdatedDesc(a, b);
  }

  /**
   * Build silo cards from current docs + notes.
   * Returns { silos: [...], randomIdeas: { notes, docs, label } }
   */
  function buildSilos(docs, notes) {
    var m = membership();
    var docList = Array.isArray(docs) ? docs.slice() : [];
    var noteList = Array.isArray(notes) ? notes.slice() : [];
    var byKey = {};
    var order = [];
    var randomDocs = [];

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
      if (isRandomIdeasDoc(doc)) {
        randomDocs.push(doc);
        return;
      }
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

      // Prefer linked document's silo (skip links into Random ideas docs).
      var linked = String(note.linkedDocId || "").trim();
      if (linked) {
        for (var i = 0; i < docList.length; i++) {
          if (String(docList[i].id || "") === linked) {
            if (isRandomIdeasDoc(docList[i])) break;
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
      byKey[key].docs.sort(sortDocsMainFirst);
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

    randomDocs.sort(sortByUpdatedDesc);

    return {
      silos: order.map(function (key) {
        return byKey[key];
      }),
      randomIdeas: {
        key: RANDOM_KEY,
        title: randomLabel(),
        docs: randomDocs,
        notes: randomNotes,
        isRandom: true,
      },
    };
  }

  function flagGet(key) {
    try {
      var Store = global.LoreKeeperAccountStorage;
      if (Store && Store.getItem) return Store.getItem(key) === "1";
      return localStorage.getItem(key) === "1";
    } catch (e) {
      return false;
    }
  }

  function flagSet(key) {
    try {
      var Store = global.LoreKeeperAccountStorage;
      if (Store && Store.setItem) {
        Store.setItem(key, "1");
        return;
      }
      localStorage.setItem(key, "1");
    } catch (e) {
      /* ignore */
    }
  }

  function alreadyMigrated() {
    return flagGet(MIGRATE_FLAG);
  }

  function markMigrated() {
    flagSet(MIGRATE_FLAG);
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
      if (isRandomIdeasDoc(doc)) return;
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
            if (isRandomIdeasDoc(docs[i])) return;
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

  /**
   * One-shot owner clarification: move only the test doc titled
   * "smoke and mirrors work title" into Random ideas. Not a lasting product rule.
   */
  function migrateTestWorkTitleDoc() {
    if (flagGet(MIGRATE_TEST_DOC_FLAG)) {
      return { changedDocs: 0, skipped: true };
    }
    if (!global.LoreKeeperDocuments) {
      return { changedDocs: 0, skipped: true };
    }
    var docs = global.LoreKeeperDocuments.load() || [];
    var target = normalizeKey(ONE_SHOT_RANDOM_DOC_TITLE);
    var changed = 0;
    docs.forEach(function (doc) {
      if (!doc) return;
      if (normalizeKey(doc.title) !== target) return;
      if (doc.randomIdeas && !String(doc.workTag || "").trim()) return;
      doc.randomIdeas = true;
      doc.workTag = "";
      doc.updatedAt = Date.now();
      global.LoreKeeperDocuments.save(doc);
      changed += 1;
    });
    flagSet(MIGRATE_TEST_DOC_FLAG);
    return { changedDocs: changed, skipped: false };
  }

  /** Run all home silo migrations (v1 + one-shot test-doc move). */
  function migrateAll() {
    var a = migrateToSilos();
    var b = migrateTestWorkTitleDoc();
    return {
      changedDocs: (a.changedDocs || 0) + (b.changedDocs || 0),
      changedNotes: a.changedNotes || 0,
      skipped: !!(a.skipped && b.skipped),
    };
  }

  global.LoreKeeperSilos = {
    RANDOM_KEY: RANDOM_KEY,
    randomLabel: randomLabel,
    workTitleForDoc: workTitleForDoc,
    isRandomIdeasDoc: isRandomIdeasDoc,
    buildSilos: buildSilos,
    migrateToSilos: migrateToSilos,
    migrateTestWorkTitleDoc: migrateTestWorkTitleDoc,
    migrateAll: migrateAll,
    alreadyMigrated: alreadyMigrated,
  };
})(typeof window !== "undefined" ? window : globalThis);
