/**
 * LoreKeeper — flowing documents (saved per account, private).
 */
(function (global) {
  var DOCUMENTS_KEY = "lorekeeper_documents_v1";
  var DOCUMENT_BACKUPS_KEY = "lorekeeper_document_backups_v1";
  var LAST_DOC_KEY = "lorekeeper_last_doc_v1";
  var MAX_SNAPSHOTS = 2;

  function uid(prefix) {
    return (prefix || "d") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function plainTextToHtml(text) {
    var chunks = String(text || "").split(/\n\n+/);
    if (!chunks.length) return "";
    return chunks
      .map(function (chunk) {
        if (!chunk.trim()) return "";
        return "<p>" + escapeHtml(chunk).replace(/\n/g, "<br>") + "</p>";
      })
      .filter(Boolean)
      .join("");
  }

  function isEmptyHtml(html) {
    var text = String(html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return !text;
  }

  function stripLayoutHtml(html) {
    return String(html || "").replace(
      /<div[^>]*class="[^"]*lk-auto-page-gap[^"]*"[^>]*><\/div>/gi,
      ""
    );
  }

  function bodyPlainText(html) {
    return stripLayoutHtml(html)
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function bodyTextDiffers(a, b) {
    return bodyPlainText(a) !== bodyPlainText(b);
  }

  function normalizeBodyHtml(html) {
    var s = String(html || "").trim();
    if (!s || isEmptyHtml(s)) return "";
    if (s.indexOf("<") === -1) return plainTextToHtml(s);
    return s;
  }

  function rememberBodyBackup(doc) {
    if (!doc || isEmptyHtml(doc.bodyHtml)) return;
    doc.bodyHtmlBackup = doc.bodyHtml;
    doc.bodyHtmlBackupAt = Date.now();
    pushSnapshot(doc.id, doc.bodyHtml, "save", doc.title);
  }

  function loadBackups() {
    var Store = global.LoreKeeperAccountStorage;
    if (!Store || !Store.isSignedIn()) return {};
    var raw = Store.getItem(DOCUMENT_BACKUPS_KEY);
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveBackups(map) {
    var Store = global.LoreKeeperAccountStorage;
    if (!Store || !Store.isSignedIn()) return false;
    return Store.setItem(DOCUMENT_BACKUPS_KEY, JSON.stringify(map || {}));
  }

  function dedupeSnapshotsByText(snapshots) {
    var out = [];
    var seen = {};
    var list = Array.isArray(snapshots) ? snapshots : [];
    for (var i = 0; i < list.length; i++) {
      var snap = list[i];
      if (!snap || isEmptyHtml(snap.bodyHtml)) continue;
      var plain = bodyPlainText(snap.bodyHtml);
      if (!plain || seen[plain]) continue;
      seen[plain] = true;
      out.push(snap);
    }
    return out;
  }

  function pushSnapshot(docId, bodyHtml, reason, title) {
    if (!docId || isEmptyHtml(bodyHtml)) return false;
    var map = loadBackups();
    var entry = map[docId] || { snapshots: [] };
    var snapshots = dedupeSnapshotsByText(
      Array.isArray(entry.snapshots) ? entry.snapshots.slice() : []
    );
    var nextPlain = bodyPlainText(bodyHtml);
    var next = {
      bodyHtml: bodyHtml,
      at: Date.now(),
      reason: reason || "save",
      title: title || "",
    };
    if (snapshots.length && bodyPlainText(snapshots[0].bodyHtml) === nextPlain) {
      snapshots[0] = next;
    } else {
      snapshots.unshift(next);
    }
    snapshots = dedupeSnapshotsByText(snapshots);
    if (snapshots.length > MAX_SNAPSHOTS) snapshots = snapshots.slice(0, MAX_SNAPSHOTS);
    map[docId] = { snapshots: snapshots, latest: snapshots[0] };
    saveBackups(map);
    return true;
  }

  function latestSnapshot(docId) {
    if (!docId) return null;
    var entry = loadBackups()[docId];
    if (!entry) return null;
    if (entry.latest && !isEmptyHtml(entry.latest.bodyHtml)) return entry.latest;
    var snaps = entry.snapshots || [];
    for (var i = 0; i < snaps.length; i++) {
      if (snaps[i] && !isEmptyHtml(snaps[i].bodyHtml)) return snaps[i];
    }
    return null;
  }

  function restorableSnapshot(docId, currentHtml) {
    if (!docId) return null;
    var entry = loadBackups()[docId];
    if (!entry || !entry.snapshots || !entry.snapshots.length) return null;
    var currentText = bodyPlainText(currentHtml);
    if (!currentText) return null;
    var snaps = entry.snapshots;
    for (var i = 0; i < snaps.length; i++) {
      var snap = snaps[i];
      if (!snap || isEmptyHtml(snap.bodyHtml)) continue;
      if (bodyPlainText(snap.bodyHtml) !== currentText) {
        return { snap: snap, index: i };
      }
    }
    return null;
  }

  function snapshotBeforeEdit() {
    return false;
  }

  function restoreBodyIfNeeded(doc) {
    if (!doc) return doc;
    if (!isEmptyHtml(doc.bodyHtml)) return doc;
    if (!isEmptyHtml(doc.bodyHtmlBackup)) {
      doc.bodyHtml = doc.bodyHtmlBackup;
      return doc;
    }
    var snap = latestSnapshot(doc.id);
    if (snap && !isEmptyHtml(snap.bodyHtml)) {
      doc.bodyHtml = snap.bodyHtml;
      doc.bodyHtmlBackup = snap.bodyHtml;
      doc.bodyHtmlBackupAt = snap.at || Date.now();
      doc.bodyRestoredFrom = "backup";
      return doc;
    }
    if (doc.pages && doc.pages.length) {
      doc = migrateToFlow(doc);
    }
    return doc;
  }

  function migrateToFlow(doc) {
    if (!doc) return doc;
    var pages = doc.pages || [];
    var hasPageText = pages.some(function (page) {
      return page && String(page.body || "").trim();
    });
    var needsFromPages =
      pages.length > 0 && (doc.bodyFormat !== "html" || (isEmptyHtml(doc.bodyHtml) && hasPageText));
    if (!needsFromPages) {
      if (doc.bodyFormat !== "html") {
        doc.bodyHtml = doc.bodyHtml || "";
        doc.bodyFormat = "html";
        doc.font = doc.font || "arial";
      }
      return doc;
    }
    var parts = [];
    pages.forEach(function (page, idx) {
      if (!page || typeof page !== "object") return;
      var title = String(page.title || "").trim();
      var body = String(page.body || "").trim();
      var genericTitle = !title || title === "Page 1" || /^Page \d+$/.test(title);
      if (!genericTitle || pages.length > 1) {
        parts.push("<h2>" + escapeHtml(title || "Page " + (idx + 1)) + "</h2>");
      }
      if (body) parts.push(plainTextToHtml(body));
    });
    doc.bodyHtml = parts.join("") || doc.bodyHtml || "";
    doc.bodyFormat = "html";
    doc.font = doc.font || (pages[0] && pages[0].font) || "arial";
    return restoreBodyIfNeeded(doc);
  }

  function loadRaw() {
    var Store = global.LoreKeeperAccountStorage;
    if (!Store || !Store.isSignedIn()) return [];
    var raw = Store.getItem(DOCUMENTS_KEY);
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveRaw(list) {
    var Store = global.LoreKeeperAccountStorage;
    if (!Store || !Store.isSignedIn()) return false;
    return Store.setItem(DOCUMENTS_KEY, JSON.stringify(list || []));
  }

  function sortDocs(list) {
    return list.slice().sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }

  function findDoc(id) {
    var docs = loadRaw();
    for (var i = 0; i < docs.length; i++) {
      if (docs[i].id === id) return migrateToFlow(docs[i]);
    }
    return null;
  }

  function touchDoc(doc) {
    doc.updatedAt = Date.now();
    return doc;
  }

  function pageDefaults(doc) {
    if (!doc.margins) doc.margins = "normal";
    if (!doc.lineSpacing) doc.lineSpacing = "1.15";
    if (doc.headerText == null) doc.headerText = "";
    if (doc.footerText == null) doc.footerText = "";
    if (doc.showPageNumbers == null) doc.showPageNumbers = true;
    if (!doc.font) doc.font = "arial";
    if (doc.loreTermsEnabled == null) doc.loreTermsEnabled = false;
    return doc;
  }

  function createDocument(title, workTag) {
    var now = Date.now();
    var doc = pageDefaults({
      id: uid("d"),
      title: title || "Untitled document",
      workTag: workTag || title || "",
      bodyHtml: "",
      bodyFormat: "html",
      font: "arial",
      margins: "normal",
      lineSpacing: "1.15",
      headerText: "",
      footerText: "",
      showPageNumbers: true,
      createdAt: now,
      updatedAt: now,
    });
    var docs = loadRaw();
    docs.push(doc);
    saveRaw(docs);
    setLastDocId(doc.id);
    global.LoreKeeperAccountStorage.flush();
    return doc;
  }

  function compactBackupsForDoc(docId) {
    if (!docId) return;
    var map = loadBackups();
    var entry = map[docId];
    if (!entry || !Array.isArray(entry.snapshots) || !entry.snapshots.length) return;
    var snapshots = dedupeSnapshotsByText(entry.snapshots).slice(0, MAX_SNAPSHOTS);
    if (snapshots.length === entry.snapshots.length) return;
    map[docId] = { snapshots: snapshots, latest: snapshots[0] || entry.latest };
    saveBackups(map);
  }

  function saveDocument(doc) {
    if (!doc || !doc.id) return false;
    compactBackupsForDoc(doc.id);
    touchDoc(doc);
    var docs = loadRaw();
    var found = false;
    var prior = null;
    docs.forEach(function (d) {
      if (d.id === doc.id) prior = d;
    });
    if (prior && !isEmptyHtml(prior.bodyHtml) && isEmptyHtml(doc.bodyHtml)) {
      doc.bodyHtml = prior.bodyHtml;
      if (prior.bodyHtmlBackup && isEmptyHtml(doc.bodyHtmlBackup)) {
        doc.bodyHtmlBackup = prior.bodyHtmlBackup;
        doc.bodyHtmlBackupAt = prior.bodyHtmlBackupAt;
      }
    }
    if (isEmptyHtml(doc.bodyHtml)) {
      var snap = latestSnapshot(doc.id);
      if (snap && !isEmptyHtml(snap.bodyHtml)) {
        doc.bodyHtml = snap.bodyHtml;
        doc.bodyHtmlBackup = snap.bodyHtml;
        doc.bodyHtmlBackupAt = snap.at || Date.now();
      }
    }
    rememberBodyBackup(doc);
    docs = docs.map(function (d) {
      if (d.id === doc.id) {
        found = true;
        return doc;
      }
      return d;
    });
    if (!found) docs.push(doc);
    var ok = saveRaw(docs);
    return ok !== false;
  }

  function deleteDocument(id) {
    var docs = loadRaw().filter(function (d) {
      return d.id !== id;
    });
    saveRaw(docs);
    if (getLastDocId() === id) setLastDocId("");
    global.LoreKeeperAccountStorage.flush();
  }

  function setLastDocId(id) {
    var Store = global.LoreKeeperAccountStorage;
    if (!Store || !Store.isSignedIn()) return;
    Store.setItem(LAST_DOC_KEY, id || "");
  }

  function getLastDocId() {
    var Store = global.LoreKeeperAccountStorage;
    if (!Store || !Store.isSignedIn()) return "";
    return Store.getItem(LAST_DOC_KEY) || "";
  }

  function formatWhen(ts) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  }

  function formatWhenRelative(ts) {
    if (!ts) return "";
    var diff = Math.max(0, Date.now() - ts);
    var sec = Math.floor(diff / 1000);
    if (sec < 45) return "just now";
    var min = Math.floor(sec / 60);
    if (min < 60) return min === 1 ? "1 minute ago" : min + " minutes ago";
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr === 1 ? "about an hour ago" : "about " + hr + " hours ago";
    var day = Math.floor(hr / 24);
    if (day === 1) return "yesterday";
    if (day < 7) return day + " days ago";
    return formatWhen(ts);
  }

  function exportJson() {
    return JSON.stringify(
      { version: 2, exportedAt: new Date().toISOString(), documents: loadRaw() },
      null,
      2
    );
  }

  function restoreSnapshot(doc, index) {
    if (!doc || !doc.id) return null;
    var snaps = listSnapshots(doc.id);
    var snap = snaps[index || 0];
    if (!snap || isEmptyHtml(snap.bodyHtml)) return null;
    doc.bodyHtml = snap.bodyHtml;
    doc.bodyHtmlBackup = snap.bodyHtml;
    doc.bodyHtmlBackupAt = snap.at || Date.now();
    saveDocument(doc);
    if (global.LoreKeeperAccountStorage && global.LoreKeeperAccountStorage.flush) {
      global.LoreKeeperAccountStorage.flush();
    }
    return doc;
  }

  global.LoreKeeperDocuments = {
    DOCUMENTS_KEY: DOCUMENTS_KEY,
    uid: uid,
    migrateToFlow: migrateToFlow,
    ready: global.LoreKeeperAccountStorage
      ? global.LoreKeeperAccountStorage.ready
      : Promise.resolve(),
    load: loadRaw,
    loadSorted: function () {
      return sortDocs(loadRaw());
    },
    find: function (id) {
      var doc = findDoc(id);
      if (doc) {
        doc.bodyHtml = normalizeBodyHtml(doc.bodyHtml);
        restoreBodyIfNeeded(doc);
      }
      return doc ? pageDefaults(doc) : null;
    },
    pageDefaults: pageDefaults,
    create: createDocument,
    save: saveDocument,
    delete: deleteDocument,
    setLastDocId: setLastDocId,
    getLastDocId: getLastDocId,
    formatWhen: formatWhen,
    formatWhenRelative: formatWhenRelative,
    exportJson: exportJson,
    normalizeBodyHtml: normalizeBodyHtml,
    bodyPlainText: bodyPlainText,
    bodyTextDiffers: bodyTextDiffers,
    snapshotBeforeEdit: snapshotBeforeEdit,
    latestSnapshot: latestSnapshot,
    restorableSnapshot: restorableSnapshot,
    listSnapshots: function (docId) {
      var entry = loadBackups()[docId];
      return dedupeSnapshotsByText(entry && entry.snapshots ? entry.snapshots.slice() : []);
    },
    restoreSnapshot: restoreSnapshot,
  };
})(typeof window !== "undefined" ? window : this);
