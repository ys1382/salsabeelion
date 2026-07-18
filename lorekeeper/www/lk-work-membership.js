/**
 * LoreKeeper — which notes belong on a document / work view.
 * Mirrors lorekeeper_work_membership.py (keep rules in sync).
 */
(function (global) {
  var IDK_TAG =
    /^(?:idk(?:\s+which\s+work(?:\s+this(?:\s+(?:is|belongs(?:\s+to)?))?)?)?|unassigned|unknown(?:\s+work)?|no\s+work|any\s+work|tbd(?:\s+work)?)\.?$/i;
  var IDK_PHRASE =
    /\b(?:idk\s+which\s+work|don'?t\s+know\s+which\s+work|not\s+sure\s+which\s+work|unassigned|no\s+specific\s+work|which\s+work\s+this\s+(?:belongs|will\s+belong)\s+to)\b/i;
  var NOT_TAG = /^not\s*:\s*(.+)$/i;
  var EXCLUDE_PHRASE =
    /(?:doesn'?t\s+(?:belong|fit)\s+(?:in|to)|does\s+not\s+(?:belong|fit)\s+(?:in|to)|won'?t\s+be\s+in|will\s+not\s+be\s+in|not\s+for|not\s+in|exclude(?:d)?\s+from|rules?\s+out)\s+(.+?)(?:[.!?\n]|$)/gi;

  function normalizeWorkKey(text) {
    var cleaned = String(text || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    return cleaned.replace(/['']s\b/g, "").replace(/['']/g, "");
  }

  function entryBlob(entry) {
    return String((entry && entry.title) || "") + "\n" + String((entry && entry.body) || "");
  }

  function concreteWorkTags(entry) {
    var tags = (entry && entry.tags) || [];
    var out = [];
    for (var i = 0; i < tags.length; i++) {
      var tag = String(tags[i] || "").trim();
      if (!tag) continue;
      if (NOT_TAG.test(tag)) {
        NOT_TAG.lastIndex = 0;
        continue;
      }
      NOT_TAG.lastIndex = 0;
      if (IDK_TAG.test(tag)) continue;
      out.push(tag);
    }
    return out;
  }

  function noteIsUnassigned(entry) {
    if (!entry) return false;
    if (concreteWorkTags(entry).length) return false;
    return true;
  }

  function noteExcludesWork(entry, workTitle) {
    var work = normalizeWorkKey(workTitle);
    if (!work || !entry) return false;
    var tags = entry.tags || [];
    for (var i = 0; i < tags.length; i++) {
      var tag = String(tags[i] || "").trim();
      var m = tag.match(NOT_TAG);
      if (m && normalizeWorkKey(m[1]) === work) return true;
    }
    var blob = entryBlob(entry);
    var re = new RegExp(EXCLUDE_PHRASE.source, "gi");
    var match;
    while ((match = re.exec(blob))) {
      var candidate = normalizeWorkKey(match[1]);
      if (!candidate) continue;
      if (candidate === work || candidate.indexOf(work) >= 0 || work.indexOf(candidate) >= 0) {
        return true;
      }
    }
    return false;
  }

  function noteBelongsToWork(entry, workTitle, documentId) {
    if (!entry) return false;
    var docId = String(documentId || "").trim();
    if (docId && String(entry.linkedDocId || "").trim() === docId) return true;

    var work = normalizeWorkKey(workTitle);
    if (!work) return false;

    var tags = concreteWorkTags(entry);
    for (var i = 0; i < tags.length; i++) {
      if (normalizeWorkKey(tags[i]) === work) return true;
    }

    var title = normalizeWorkKey(entry.title || "");
    var titleBase = title.split(" / ")[0].trim();
    if (title.indexOf(work) >= 0 || titleBase.indexOf(work) >= 0) return true;
    return false;
  }

  function noteBelongsToOtherWork(entry, workTitle) {
    if (!entry) return false;
    var work = normalizeWorkKey(workTitle);
    var tags = concreteWorkTags(entry);
    if (!tags.length) return false;
    if (!work) return true;
    for (var i = 0; i < tags.length; i++) {
      if (normalizeWorkKey(tags[i]) === work) return false;
    }
    return true;
  }

  function noteVisibleForWork(entry, workTitle, documentId) {
    if (!entry) return false;
    if (noteBelongsToWork(entry, workTitle, documentId)) return true;
    if (noteBelongsToOtherWork(entry, workTitle)) return false;
    if (noteIsUnassigned(entry)) return !noteExcludesWork(entry, workTitle);
    return false;
  }

  function filterEntriesVisibleForWork(entries, workTitle, documentId) {
    var list = entries || [];
    var work = String(workTitle || "").trim();
    var docId = String(documentId || "").trim();
    if (!work && !docId) return list.slice();
    return list.filter(function (e) {
      return noteVisibleForWork(e, work, docId);
    });
  }

  global.LoreKeeperWorkMembership = {
    normalizeWorkKey: normalizeWorkKey,
    noteIsUnassigned: noteIsUnassigned,
    noteExcludesWork: noteExcludesWork,
    noteBelongsToWork: noteBelongsToWork,
    noteBelongsToOtherWork: noteBelongsToOtherWork,
    noteVisibleForWork: noteVisibleForWork,
    filterEntriesVisibleForWork: filterEntriesVisibleForWork,
  };
})(typeof window !== "undefined" ? window : globalThis);
