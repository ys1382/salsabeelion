/**
 * LoreKeeper — compact new-note panel on doc.html (same store as home).
 */
(function (global) {
  function setStatus(msg, ok) {
    var el = document.getElementById("docNoteStatus");
    if (!el) return;
    el.innerHTML = msg || "";
    el.className = "lk-status" + (ok ? " ok" : "");
  }

  function syncWorkTitle(getDoc) {
    var workEl = document.getElementById("docNoteWork");
    var docWork = document.getElementById("docWork");
    if (!workEl) return;
    var doc = getDoc ? getDoc() : null;
    var work = (doc && doc.workTag) || (docWork && docWork.value.trim()) || "";
    if (work) workEl.value = work;
  }

  function resetForm(keepKind) {
    var titleEl = document.getElementById("docNoteTitle");
    var bodyEl = document.getElementById("docNoteBody");
    if (titleEl) titleEl.value = "";
    if (bodyEl) bodyEl.value = "";
    if (!keepKind) {
      var kindEl = document.getElementById("docNoteKind");
      if (kindEl) kindEl.value = "note";
    }
  }

  function initDocQuickNote(getDoc) {
    var kindSel = document.getElementById("docNoteKind");
    var saveBtn = document.getElementById("docNoteSaveBtn");
    var appendBtn = document.getElementById("docNoteAppendBtn");
    if (!kindSel || !saveBtn || !global.LoreKeeperEntries) return;

    kindSel.innerHTML = "";
    LoreKeeperEntries.KINDS.forEach(function (k) {
      var opt = document.createElement("option");
      opt.value = k.id;
      opt.textContent = k.label;
      kindSel.appendChild(opt);
    });

    if (appendBtn && !appendBtn.__lkBound) {
      appendBtn.__lkBound = true;
      appendBtn.addEventListener("click", function () {
        if (!global.LoreKeeperDocEditor || !global.LoreKeeperDocEditor.appendPlainBlock) {
          setStatus("Page editor is still loading — try again in a moment.");
          return;
        }
        var bodyEl = document.getElementById("docNoteBody");
        var result = global.LoreKeeperDocEditor.appendPlainBlock(bodyEl && bodyEl.value);
        if (!result || !result.ok) {
          if (result && result.error) setStatus(result.error);
          return;
        }
        if (bodyEl) bodyEl.value = "";
        setStatus("Appended to the bottom of this page.", true);
        if (global.LoreKeeperMobileJot && global.LoreKeeperMobileJot.endSidebarCapture) {
          global.LoreKeeperMobileJot.endSidebarCapture();
        }
        if (global.LoreKeeperMobileComfort && global.LoreKeeperMobileComfort.isMobile()) {
          var panel = document.getElementById("docQuickNotePanel");
          if (panel) panel.scrollIntoView({ block: "nearest" });
        }
      });
    }

    saveBtn.addEventListener("click", function () {
      if (!LoreKeeperAccountStorage.isSignedIn()) {
        setStatus("Sign in to save notes.");
        return;
      }
      var doc = getDoc ? getDoc() : null;
      var prep = LoreKeeperEntries.prepareSave({
        id: LoreKeeperEntries.uid(),
        kind: document.getElementById("docNoteKind").value,
        title: document.getElementById("docNoteTitle").value,
        body: document.getElementById("docNoteBody").value,
        tagsText: document.getElementById("docNoteWork").value,
        linkedDocId: doc && doc.id,
        linkedDocTitle: doc && doc.title,
      });
      if (!prep.ok) {
        setStatus(prep.error);
        return;
      }
      if (prep.fixedCount) {
        document.getElementById("docNoteTitle").value = prep.title;
        document.getElementById("docNoteBody").value = prep.body;
      }
      var list = LoreKeeperEntries.upsertInList(LoreKeeperEntries.load(), prep.entry);
      LoreKeeperEntries.save(list);
      if (LoreKeeperEntries.rememberBackup) {
        LoreKeeperEntries.rememberBackup(prep.entry);
      }
      LoreKeeperAccountStorage.flush().then(function () {
        var msg = 'Saved — on your <a href="./index.html">home notes</a> list.';
        if (prep.fixedCount) {
          msg =
            "Saved — fixed " +
            prep.fixedCount +
            " spelling mistake" +
            (prep.fixedCount === 1 ? "" : "s") +
            '. On your <a href="./index.html">home notes</a> list.';
        }
        setStatus(msg, true);
        resetForm(true);
        syncWorkTitle(getDoc);
        if (global.LoreKeeperDocNotesList && global.LoreKeeperDocNotesList.refresh) {
          global.LoreKeeperDocNotesList.refresh();
        }
        var titleEl = document.getElementById("docNoteTitle");
        if (titleEl) titleEl.focus();
      });
    });

    global.LoreKeeperDocQuickNote = {
      syncWorkTitle: function () {
        syncWorkTitle(getDoc);
      },
    };
  }

  global.initDocQuickNote = initDocQuickNote;
})(typeof window !== "undefined" ? window : this);
