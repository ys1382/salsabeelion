/**
 * LoreKeeper — browse notes for this document/work (filtered).
 */
(function (global) {
  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function workAndDoc(getDoc) {
    var doc = typeof getDoc === "function" ? getDoc() : null;
    var workEl = document.getElementById("docWork");
    var work =
      (doc && doc.workTag) ||
      (workEl && workEl.value.trim()) ||
      (doc && doc.title) ||
      "";
    return { work: work, docId: (doc && doc.id) || "" };
  }

  function renderList(getDoc) {
    var listEl = document.getElementById("docNotesList");
    var emptyEl = document.getElementById("docNotesEmpty");
    var metaEl = document.getElementById("docNotesMeta");
    if (!listEl || !global.LoreKeeperEntries || !global.LoreKeeperWorkMembership) return;

    var ctx = workAndDoc(getDoc);
    var all = global.LoreKeeperEntries.load() || [];
    var visible = global.LoreKeeperWorkMembership.filterEntriesVisibleForWork(
      all,
      ctx.work,
      ctx.docId
    );

    // Newest first
    visible = visible.slice().sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    listEl.innerHTML = "";
    if (metaEl) {
      metaEl.textContent = ctx.work
        ? "Showing notes for “" + ctx.work + "” only (Random ideas stay on Home)."
        : "Set a story title in Settings to filter notes.";
    }

    if (!visible.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    visible.forEach(function (entry) {
      var li = document.createElement("li");
      li.className = "lk-doc-notes-item";
      var kind = global.LoreKeeperEntries.kindLabel
        ? global.LoreKeeperEntries.kindLabel(entry.kind)
        : entry.kind || "Note";
      var title = entry.title || "(untitled)";
      var floating =
        global.LoreKeeperWorkMembership.noteIsUnassigned(entry) &&
        !global.LoreKeeperWorkMembership.noteBelongsToWork(entry, ctx.work, ctx.docId);
      var badge = floating ? '<span class="lk-doc-notes-badge">random</span>' : "";
      var href = "./index.html#note-" + encodeURIComponent(entry.id);
      li.innerHTML =
        '<a class="lk-doc-notes-link" href="' +
        href +
        '">' +
        '<span class="lk-doc-notes-title">' +
        escapeHtml(title) +
        "</span>" +
        '<span class="lk-doc-notes-kind">' +
        escapeHtml(kind) +
        "</span>" +
        badge +
        "</a>";
      listEl.appendChild(li);
    });
  }

  function initDocNotesList(getDoc) {
    var refreshBtn = document.getElementById("docNotesRefreshBtn");
    function refresh() {
      renderList(getDoc);
    }
    if (refreshBtn) {
      refreshBtn.addEventListener("click", refresh);
    }
    global.addEventListener("lorekeeper-data-hydrated", refresh);
    var workEl = document.getElementById("docWork");
    if (workEl) {
      workEl.addEventListener("change", refresh);
      workEl.addEventListener("blur", refresh);
    }
    global.LoreKeeperDocNotesList = global.LoreKeeperDocNotesList || {};
    global.LoreKeeperDocNotesList.refresh = refresh;
    refresh();
  }

  global.LoreKeeperDocNotesList = {
    init: initDocNotesList,
    refresh: function () {},
  };
  global.initDocNotesList = initDocNotesList;
})(typeof window !== "undefined" ? window : globalThis);
