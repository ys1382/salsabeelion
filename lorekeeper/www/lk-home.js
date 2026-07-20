(function (global) {
  function openDoc(id) {
    global.location.href = "./doc.html?d=" + encodeURIComponent(id);
  }

  function renderDocs() {
    var list = document.getElementById("docList");
    var status = document.getElementById("libraryStatus");
    var docs = LoreKeeperDocuments.loadSorted();
    if (!docs.length && list.children.length) {
      status.textContent = "Syncing documents…";
      return;
    }
    list.innerHTML = "";
    if (!docs.length) {
      status.textContent = "No documents yet.";
      return;
    }
    status.textContent = docs.length + " document" + (docs.length === 1 ? "" : "s");
    docs.forEach(function (doc) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lk-doc-open";
      var work = doc.workTag ? doc.workTag + " · " : "";
      btn.innerHTML =
        "<strong>" +
        (doc.title || "Untitled").replace(/</g, "&lt;") +
        "</strong><br><span class='muted'>" +
        work +
        LoreKeeperDocuments.formatWhen(doc.updatedAt) +
        "</span>";
      btn.addEventListener("click", function () {
        openDoc(doc.id);
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function syncContinueButton() {
    var btn = document.getElementById("continueBtn");
    if (!btn) return;
    var last = LoreKeeperDocuments.getLastDocId();
    if (!last) {
      btn.hidden = true;
      return;
    }
    var doc = LoreKeeperDocuments.find(last);
    if (!doc) {
      if (!btn.hidden && btn.getAttribute("data-last-id") === last) {
        return;
      }
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    btn.setAttribute("data-last-id", last);
    btn.textContent = doc.title ? "Continue: " + doc.title : "Continue writing";
    if (!btn.__lkBound) {
      btn.__lkBound = true;
      btn.addEventListener("click", function () {
        openDoc(last);
      });
    }
  }

  function initDocs() {
    document.getElementById("newDocBtn").addEventListener("click", function () {
      document.getElementById("newDocPanel").hidden = false;
      document.getElementById("newDocTitle").focus();
    });
    document.getElementById("cancelNewDocBtn").addEventListener("click", function () {
      document.getElementById("newDocPanel").hidden = true;
    });
    document.getElementById("createDocBtn").addEventListener("click", function () {
      var title = document.getElementById("newDocTitle").value.trim();
      var work = document.getElementById("newDocWork").value.trim();
      if (!title && !work) {
        document.getElementById("newDocStatus").textContent = "Add a document or work title.";
        return;
      }
      var doc = LoreKeeperDocuments.create(title || work, work || title);
      openDoc(doc.id);
    });
    document.getElementById("exportDocsBtn").addEventListener("click", function () {
      var blob = new Blob([LoreKeeperDocuments.exportJson()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "lorekeeper-documents.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    syncContinueButton();
    renderDocs();
    global.addEventListener("lorekeeper-data-hydrated", function () {
      renderDocs();
      syncContinueButton();
    });
  }

  function initNotes() {
    var editingId = null;
    var filterKind = document.getElementById("filterKind");
    var searchBox = document.getElementById("searchBox");
    var noteList = document.getElementById("noteList");
    var noteListPager = document.getElementById("noteListPager");
    var noteListPagerStatus = document.getElementById("noteListPagerStatus");
    var noteListPrev = document.getElementById("noteListPrev");
    var noteListNext = document.getElementById("noteListNext");
    var editorPanel = document.getElementById("noteEditorPanel");
    var listStatus = document.getElementById("noteListStatus");
    var editorStatus = document.getElementById("noteEditorStatus");
    var noteSyncBanner = document.getElementById("noteSyncBanner");
    var noteSyncRetryBtn = document.getElementById("noteSyncRetryBtn");
    var retryNoteSyncBtn = document.getElementById("retryNoteSyncBtn");
    var notesMorePanel = document.getElementById("notesMorePanel");
    var notesMoreToggle = document.getElementById("notesMoreToggle");
    var notesMoreBody = document.getElementById("notesMoreBody");
    var notesMoreLabel = document.getElementById("notesMoreLabel");
    var noteFullscreenBtn = document.getElementById("noteFullscreenBtn");
    var NOTES_MORE_KEY = "lk-notes-more-open";
    var saveCloseTimer = null;
    var SAVE_STATUS_MS = 10000;

    var NOTES_VIEWPORT = 4;
    var noteListOffset = 0;

    function isNotesMoreOpen() {
      return !!(notesMorePanel && notesMorePanel.classList.contains("is-open"));
    }

    function syncNoteListPager(totalFiltered) {
      if (!noteListPager || !noteListPagerStatus || !noteListPrev || !noteListNext) return;
      if (totalFiltered <= NOTES_VIEWPORT) {
        noteListPager.hidden = true;
        return;
      }
      noteListPager.hidden = false;
      var start = noteListOffset + 1;
      var end = Math.min(noteListOffset + NOTES_VIEWPORT, totalFiltered);
      noteListPagerStatus.textContent = "Showing " + start + "–" + end + " of " + totalFiltered;
      noteListPrev.disabled = noteListOffset <= 0;
      noteListNext.disabled = noteListOffset + NOTES_VIEWPORT >= totalFiltered;
    }

    function setNotesMoreOpen(open) {
      if (!notesMorePanel || !notesMoreBody || !notesMoreToggle) return;
      var on = !!open;
      notesMorePanel.classList.toggle("is-open", on);
      notesMoreToggle.setAttribute("aria-expanded", on ? "true" : "false");
      try {
        localStorage.setItem(NOTES_MORE_KEY, on ? "1" : "0");
      } catch (e) {}
      if (on) renderNotes();
    }

    function syncNotesMoreLabel(count) {
      if (!notesMoreLabel) return;
      if (!count) notesMoreLabel.textContent = "Your notes";
      else notesMoreLabel.textContent = "Your notes (" + count + ")";
    }

    if (notesMorePanel && notesMoreToggle) {
      var notesMoreStoredOpen = false;
      try {
        notesMoreStoredOpen = localStorage.getItem(NOTES_MORE_KEY) === "1";
      } catch (e) {}
      setNotesMoreOpen(notesMoreStoredOpen);
      notesMoreToggle.addEventListener("click", function () {
        setNotesMoreOpen(!isNotesMoreOpen());
      });
    }

    if (noteListPrev) {
      noteListPrev.addEventListener("click", function () {
        noteListOffset = Math.max(0, noteListOffset - NOTES_VIEWPORT);
        renderNotes();
      });
    }
    if (noteListNext) {
      noteListNext.addEventListener("click", function () {
        var count = filteredNotes().length;
        noteListOffset = Math.min(
          Math.max(0, count - NOTES_VIEWPORT),
          noteListOffset + NOTES_VIEWPORT
        );
        renderNotes();
      });
    }

    LoreKeeperEntries.KINDS.forEach(function (k) {
      var o1 = document.createElement("option");
      o1.value = k.id;
      o1.textContent = k.label;
      filterKind.appendChild(o1);
      var o2 = document.createElement("option");
      o2.value = k.id;
      o2.textContent = k.label;
      document.getElementById("noteKind").appendChild(o2);
    });

    var noteTagsEl = document.getElementById("noteTags");
    if (noteTagsEl) {
      noteTagsEl.addEventListener("input", function () {
        if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.refreshChips) {
          global.LoreKeeperMobileAccessory.refreshChips();
        }
        if (global.LoreKeeperWritingComplete && global.LoreKeeperWritingComplete.refresh) {
          global.LoreKeeperWritingComplete.refresh();
        }
      });
    }

    function setEditorStatus(msg, ok) {
      editorStatus.textContent = msg || "";
      editorStatus.className = "lk-status" + (ok ? " ok" : ok === false ? " err" : "");
      if (retryNoteSyncBtn) retryNoteSyncBtn.hidden = true;
    }

    function updateNoteSyncBanner() {
      var show = LoreKeeperAccountStorage.hasPending();
      if (noteSyncBanner) noteSyncBanner.hidden = !show;
    }

    function retryNoteSync() {
      LoreKeeperAccountStorage.retrySync().then(function (sent) {
        refreshSaveSyncStatus();
        if (!sent && !editorPanel.hidden) {
          setEditorStatus("Still not synced — check your connection and try again.", false);
          if (retryNoteSyncBtn) retryNoteSyncBtn.hidden = false;
        }
      });
    }

    function filteredNotes() {
      var q = searchBox.value.trim().toLowerCase();
      var kind = filterKind.value;
      return LoreKeeperEntries.load().filter(function (e) {
        if (kind && e.kind !== kind) return false;
        if (!q) return true;
        var hay = ((e.title || "") + " " + (e.body || "") + " " + (e.tags || []).join(" ")).toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    }

    function renderNotes() {
      var items = filteredNotes();
      var total = LoreKeeperEntries.load().length;
      syncNotesMoreLabel(total);
      items.sort(function (a, b) {
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
      if (noteListOffset >= items.length) noteListOffset = 0;
      if (noteListOffset < 0) noteListOffset = 0;
      noteList.innerHTML = "";
      if (!items.length) {
        listStatus.textContent = total
          ? "No notes match this filter."
          : "No notes yet — add a scattered scrap when you need one.";
        syncNoteListPager(0);
        return;
      }
      var pageItems =
        items.length > NOTES_VIEWPORT
          ? items.slice(noteListOffset, noteListOffset + NOTES_VIEWPORT)
          : items;
      listStatus.textContent = items.length + " note" + (items.length === 1 ? "" : "s");
      pageItems.forEach(function (e) {
        var li = document.createElement("li");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "lk-entry-open";
        var tag = e.tags && e.tags.length ? " · " + e.tags[0] : "";
        btn.innerHTML =
          '<span class="lk-entry-kind">' +
          LoreKeeperEntries.kindLabel(e.kind) +
          "</span><br><strong>" +
          (e.title || "Untitled").replace(/</g, "&lt;") +
          "</strong><span class='muted'>" +
          tag +
          "</span>";
        btn.addEventListener("click", function () {
          openNoteEditor(e.id);
        });
        li.appendChild(btn);
        noteList.appendChild(li);
      });
      syncNoteListPager(items.length);
    }

    function syncNoteFullscreenButton() {
      if (!noteFullscreenBtn) return;
      var on = document.body.classList.contains("lk-note-fullscreen");
      noteFullscreenBtn.textContent = on ? "Exit full screen" : "Full screen";
      noteFullscreenBtn.setAttribute("aria-pressed", on ? "true" : "false");
      noteFullscreenBtn.title = on ? "Exit full screen (Esc)" : "Full screen";
    }

    function setNoteFullscreen(on) {
      if (
        global.LoreKeeperMobileComfort &&
        global.LoreKeeperMobileComfort.isMobile &&
        global.LoreKeeperMobileComfort.isMobile()
      ) {
        if (on && global.LoreKeeperMobileComfort.beginEditing) {
          global.LoreKeeperMobileComfort.beginEditing();
        }
        return;
      }
      document.body.classList.toggle("lk-note-fullscreen", !!on);
      syncNoteFullscreenButton();
      if (on) {
        var focusEl = document.getElementById("noteBody");
        if (focusEl) focusEl.focus();
      }
    }

    function exitNoteFullscreen() {
      if (!document.body.classList.contains("lk-note-fullscreen")) return;
      setNoteFullscreen(false);
    }

    function openNoteEditor(id, opts) {
      opts = opts || {};
      var entry = null;
      if (id) {
        LoreKeeperEntries.load().some(function (e) {
          if (e.id === id) {
            entry = e;
            return true;
          }
        });
      }
      editingId = entry ? entry.id : LoreKeeperEntries.uid();
      document.getElementById("noteKind").value = entry ? entry.kind || "note" : "note";
      document.getElementById("noteTitle").value = entry ? entry.title || "" : "";
      document.getElementById("noteBody").value = entry ? entry.body || "" : "";
      var tagsVal = entry && entry.tags ? entry.tags.join(", ") : "";
      if (!tagsVal && opts.workTag) tagsVal = opts.workTag;
      if (!tagsVal && global.LoreKeeperMobileJot && global.LoreKeeperMobileJot.lastWorkTag) {
        tagsVal = global.LoreKeeperMobileJot.lastWorkTag();
      }
      document.getElementById("noteTags").value = tagsVal;
      document.getElementById("noteEditorHeading").textContent = opts.quickJot
        ? "Quick jot"
        : entry
          ? "Edit note"
          : "New note";
      exitNoteFullscreen();
      editorPanel.hidden = false;
      setEditorStatus("");
      syncNoteFullscreenButton();
      var bodyEl = document.getElementById("noteBody");
      var details = document.getElementById("noteDetailsPanel");
      if (details) details.open = !opts.quickJot && !!entry;
      if (global.LoreKeeperMobileComfort && global.LoreKeeperMobileComfort.isMobile()) {
        if (opts.quickJot && global.LoreKeeperMobileComfort.beginJotCapture) {
          global.LoreKeeperMobileComfort.beginJotCapture(bodyEl);
        } else if (global.LoreKeeperMobileComfort.enterNoteReadMode) {
          document.body.classList.remove("lk-note-jot");
          global.LoreKeeperMobileComfort.enterNoteReadMode(bodyEl);
        }
      } else {
        document.getElementById("noteTitle").focus();
      }
      if (global.LoreKeeperSpell && LoreKeeperSpell.ensureLoaded) {
        LoreKeeperSpell.ensureLoaded().then(function () {
          LoreKeeperSpell.bindTextarea(bodyEl, document.getElementById("noteSpellFlags"));
          if (bodyEl) {
            bodyEl.__lkWriteContext = function () {
              return {
                workTag: document.getElementById("noteTags").value.trim(),
                doc: null,
              };
            };
          }
        });
      }
    }

    function closeNoteEditor() {
      exitNoteFullscreen();
      if (global.LoreKeeperMobileComfort && global.LoreKeeperMobileComfort.exitNoteReadMode) {
        global.LoreKeeperMobileComfort.exitNoteReadMode();
      }
      if (saveCloseTimer) {
        clearTimeout(saveCloseTimer);
        saveCloseTimer = null;
      }
      editorPanel.hidden = true;
      editingId = null;
    }

    function scheduleCloseAfterSave() {
      if (saveCloseTimer) clearTimeout(saveCloseTimer);
      saveCloseTimer = setTimeout(function () {
        saveCloseTimer = null;
        closeNoteEditor();
      }, SAVE_STATUS_MS);
    }

    function refreshSaveSyncStatus() {
      updateNoteSyncBanner();
      if (LoreKeeperAccountStorage.hasPending()) {
        setEditorStatus("Saved on this device — not synced to account yet.", false);
        if (retryNoteSyncBtn) retryNoteSyncBtn.hidden = false;
        return;
      }
      setEditorStatus("Synced to your account.", true);
    }

    function saveNote() {
      var prep = LoreKeeperEntries.prepareSave({
        id: editingId,
        kind: document.getElementById("noteKind").value,
        title: document.getElementById("noteTitle").value,
        body: document.getElementById("noteBody").value,
        tagsText: document.getElementById("noteTags").value,
        createdAt: editingId
          ? (function () {
              var existing = null;
              LoreKeeperEntries.load().some(function (e) {
                if (e.id === editingId) {
                  existing = e;
                  return true;
                }
              });
              return existing && existing.createdAt;
            })()
          : undefined,
      });
      if (!prep.ok) {
        setEditorStatus(prep.error);
        return;
      }
      if (prep.fixedCount) {
        document.getElementById("noteTitle").value = prep.title;
        document.getElementById("noteBody").value = prep.body;
      }
      var list = LoreKeeperEntries.upsertInList(LoreKeeperEntries.load(), prep.entry);
      LoreKeeperEntries.save(list);
      var msg = "Saved.";
      if (prep.fixedCount) {
        msg =
          "Saved — fixed " +
          prep.fixedCount +
          " spelling mistake" +
          (prep.fixedCount === 1 ? "" : "s") +
          " (not on My words).";
      }
      setEditorStatus(msg, true);
      if (global.LoreKeeperMobileJot && global.LoreKeeperMobileJot.rememberWorkTag) {
        global.LoreKeeperMobileJot.rememberWorkTag(document.getElementById("noteTags").value);
      }
      renderNotes();
      updateNoteSyncBanner();
      scheduleCloseAfterSave();
      LoreKeeperAccountStorage.flush().then(function () {
        refreshSaveSyncStatus();
      });
      return;
    }

    document.getElementById("newNoteBtn").addEventListener("click", function () {
      openNoteEditor(null);
    });
    var quickJotBtn = document.getElementById("quickJotBtn");
    if (quickJotBtn) {
      quickJotBtn.addEventListener("click", function () {
        if (global.LoreKeeperMobileJot && global.LoreKeeperMobileJot.openHomeQuickJot) {
          global.LoreKeeperMobileJot.openHomeQuickJot();
        } else {
          openNoteEditor(null, { quickJot: true });
        }
      });
    }
    global.addEventListener("lorekeeper-open-note", function (e) {
      var d = (e && e.detail) || {};
      openNoteEditor(null, { quickJot: !!d.quickJot, workTag: d.workTag || "" });
    });
    if (noteFullscreenBtn) {
      noteFullscreenBtn.addEventListener("click", function () {
        setNoteFullscreen(!document.body.classList.contains("lk-note-fullscreen"));
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (editorPanel.hidden || !document.body.classList.contains("lk-note-fullscreen")) return;
      e.preventDefault();
      exitNoteFullscreen();
    });
    document.getElementById("cancelNoteBtn").addEventListener("click", closeNoteEditor);
    document.getElementById("saveNoteBtn").addEventListener("click", saveNote);
    if (retryNoteSyncBtn) retryNoteSyncBtn.addEventListener("click", retryNoteSync);
    if (noteSyncRetryBtn) noteSyncRetryBtn.addEventListener("click", retryNoteSync);
    global.addEventListener("lorekeeper-sync-failed", updateNoteSyncBanner);
    global.addEventListener("lorekeeper-sync-ok", updateNoteSyncBanner);
    updateNoteSyncBanner();
    document.getElementById("deleteNoteBtn").addEventListener("click", function () {
      if (!editingId || !confirm("Delete this note?")) return;
      var list = LoreKeeperEntries.load().filter(function (e) {
        return e.id !== editingId;
      });
      LoreKeeperEntries.save(list);
      closeNoteEditor();
      renderNotes();
      updateNoteSyncBanner();
      LoreKeeperAccountStorage.flush().then(function () {
        updateNoteSyncBanner();
      });
    });
    filterKind.addEventListener("change", function () {
      noteListOffset = 0;
      renderNotes();
    });
    searchBox.addEventListener("input", function () {
      noteListOffset = 0;
      renderNotes();
    });
    document.getElementById("exportNotesBtn").addEventListener("click", function () {
      var blob = new Blob([LoreKeeperEntries.exportJson()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "lorekeeper-notes.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    global.addEventListener("lorekeeper-open-note", function (ev) {
      var id = ev && ev.detail && ev.detail.id;
      if (!id) return;
      openNoteEditor(id);
      if (editorPanel && editorPanel.scrollIntoView) {
        editorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    renderNotes();
    global.addEventListener("lorekeeper-data-hydrated", renderNotes);
    global.addEventListener("lorekeeper-keyboard-save", function () {
      if (!editorPanel || editorPanel.hidden) return;
      saveNote();
    });
  }

  function initAsk() {
    var askBtn = document.getElementById("askBtn");
    var askQuestion = document.getElementById("askQuestion");
    var askStatus = document.getElementById("askStatus");
    var askAnswer = document.getElementById("askAnswer");
    var askSources = document.getElementById("askSources");
    if (!askBtn || !askQuestion) return;

    var ASK_CONTINUE_KEY = "lk-ask-continue";
    var pendingQuestion = "";
    var confirmUi = null;

    function loadAskContinue() {
      try {
        var raw = global.sessionStorage.getItem(ASK_CONTINUE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch (e) {
        return null;
      }
    }

    function saveAskContinue(cont) {
      try {
        if (cont && typeof cont === "object") {
          global.sessionStorage.setItem(ASK_CONTINUE_KEY, JSON.stringify(cont));
        } else {
          global.sessionStorage.removeItem(ASK_CONTINUE_KEY);
        }
      } catch (e) {
        /* ignore */
      }
    }

    function clearAnswerUi() {
      askAnswer.hidden = true;
      askAnswer.innerHTML = "";
      askSources.hidden = true;
      askSources.innerHTML = "";
      if (confirmUi) confirmUi.hide();
    }

    function renderSources(res) {
      askSources.innerHTML = "";
      if (res.sources && res.sources.length) {
        res.sources.forEach(function (src) {
          var li = document.createElement("li");
          var span = document.createElement("span");
          span.className = "lk-ask-source-btn";
          span.textContent =
            (src.title || "Untitled") + " (" + (src.kindLabel || "Note") + ")";
          li.appendChild(span);
          askSources.appendChild(li);
        });
        askSources.hidden = false;
      }
    }

    function applyAnswerStatus(res) {
      askStatus.textContent = res.syncWarning || "From your saved writing.";
      askStatus.className = "lk-status ok";
      if (res.askContinue) {
        askStatus.textContent = "Your turn — reply in Ask to narrow floaters.";
      } else if (res.needsConfirm) {
        askStatus.textContent = "Pick which notes to use, then summarize.";
      } else if (res.recallScope === "floaters") {
        askStatus.textContent = "From your floating / unspecified notes only.";
      } else if (res.materialState === "summarizable") {
        askStatus.textContent = "Summary from your notes and drafts.";
      } else if (res.materialState === "fragments_only") {
        askStatus.textContent =
          "Partial — not enough saved yet for a full summary.";
      } else if (res.materialState === "nothing_saved") {
        askStatus.textContent = "Nothing saved on that yet.";
      }
    }

    function showFinalAnswer(res, q) {
      if (confirmUi) confirmUi.hide();
      applyAnswerStatus(res);
      if (global.LoreKeeperRecall.formatAskAnswerHtml) {
        askAnswer.innerHTML = global.LoreKeeperRecall.formatAskAnswerHtml(
          res.answer || ""
        );
      } else {
        askAnswer.textContent = res.answer || "";
      }
      askAnswer.hidden = !res.answer;
      renderSources(res);
      if (global.LoreKeeperAskFeedback && global.LoreKeeperAskFeedback.recordLastAsk) {
        global.LoreKeeperAskFeedback.recordLastAsk({
          question: q,
          answer: res.answer || "",
          materialState: res.materialState || "",
        });
      }
    }

    function runAskRequest(q, askOpts) {
      askStatus.textContent = "Searching documents and notes…";
      askStatus.className = "lk-status";
      askStatus.hidden = false;
      clearAnswerUi();
      askBtn.disabled = true;
      var slowTimer = setTimeout(function () {
        if (askBtn.disabled) {
          askStatus.textContent =
            "Still searching your notes — complex questions can take a minute…";
        }
      }, 12000);
      return LoreKeeperRecall.ask(q, askOpts)
        .then(function (res) {
          if (!res || !res.ok) {
            askStatus.textContent = LoreKeeperRecall.friendlyError(res && res.error);
            askStatus.className = "lk-status err";
            return;
          }
          if (res.askContinue && typeof res.askContinue === "object") {
            saveAskContinue(res.askContinue);
          } else {
            saveAskContinue(null);
          }
          if (res.needsConfirm && res.candidates && res.candidates.length && confirmUi) {
            pendingQuestion = q;
            applyAnswerStatus(res);
            if (global.LoreKeeperRecall.formatAskAnswerHtml) {
              askAnswer.innerHTML = global.LoreKeeperRecall.formatAskAnswerHtml(
                res.answer || ""
              );
            } else {
              askAnswer.textContent = res.answer || "";
            }
            askAnswer.hidden = !res.answer;
            confirmUi.show(res.candidates);
            return;
          }
          showFinalAnswer(res, q);
        })
        .catch(function () {
          askStatus.textContent = LoreKeeperRecall.friendlyError("network_error");
          askStatus.className = "lk-status err";
        })
        .finally(function () {
          clearTimeout(slowTimer);
          askBtn.disabled = false;
        });
    }

    if (global.LoreKeeperRecall && global.LoreKeeperRecall.bindConfirmSources) {
      confirmUi = global.LoreKeeperRecall.bindConfirmSources(
        {
          wrapId: "askConfirm",
          listId: "askConfirmList",
          confirmBtnId: "askConfirmBtn",
          cancelBtnId: "askConfirmCancel",
        },
        {
          onEmpty: function () {
            askStatus.textContent = LoreKeeperRecall.friendlyError("no_sources_selected");
            askStatus.className = "lk-status err";
            askStatus.hidden = false;
          },
          onConfirm: function (ids) {
            var q = pendingQuestion || askQuestion.value.trim();
            if (!q) return;
            runAskRequest(q, {
              includeDocuments: false,
              askPhase: "answer",
              confirmedSourceIds: ids,
            });
          },
          onCancel: function () {
            pendingQuestion = "";
            askStatus.textContent = "Canceled — ask again when ready.";
            askStatus.className = "lk-status";
            askAnswer.hidden = true;
          },
        }
      );
    }

    askBtn.addEventListener("click", function () {
      var q = askQuestion.value.trim();
      if (!q) {
        askStatus.textContent = "Type a question first.";
        askStatus.hidden = false;
        return;
      }
      pendingQuestion = q;
      var askOpts = { includeDocuments: false, askPhase: "preview" };
      var pending = loadAskContinue();
      if (pending) askOpts.askContinue = pending;
      runAskRequest(q, askOpts);
    });

    askQuestion.addEventListener("keydown", function (e) {
      if (e.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        askBtn.click();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        var start = askQuestion.selectionStart;
        var end = askQuestion.selectionEnd;
        var val = askQuestion.value;
        askQuestion.value = val.slice(0, start) + "\n" + val.slice(end);
        askQuestion.selectionStart = askQuestion.selectionEnd = start + 1;
      }
    });

    if (global.LoreKeeperAskFeedback && global.LoreKeeperAskFeedback.initAskFeedback) {
      global.LoreKeeperAskFeedback.initAskFeedback({
        page: "home",
        wrongBtnId: "askWrongBtn",
        correctionWrapId: "askCorrectionWrap",
        correctionId: "askCorrection",
        saveFeedbackBtnId: "askSaveFeedbackBtn",
        feedbackStatusId: "askFeedbackStatus",
      });
    }
    var askField =
      askQuestion && askQuestion.closest ? askQuestion.closest(".lk-field") : null;
    if (global.LoreKeeperTierA && askField) {
      global.LoreKeeperTierA.initOwnerAskHints(askField);
    }
  }

  Promise.all([
    LoreKeeperDocuments.ready,
    LoreKeeperAccountStorage.ready,
    LoreKeeperAccountStorage.waitForData
      ? LoreKeeperAccountStorage.waitForData({ content: true })
      : LoreKeeperDocuments.ready,
  ]).then(function () {
    if (!LoreKeeperAccountStorage.isSignedIn()) {
      LoreKeeperAccountStorage.ensureSignedIn();
      return;
    }
    initDocs();
    initNotes();
    if (global.LoreKeeperFind && typeof global.LoreKeeperFind.init === "function") {
      global.LoreKeeperFind.init();
    }
    initAsk();
    if (global.LoreKeeperMobileComfort && global.LoreKeeperMobileComfort.initHomeNotes) {
      global.LoreKeeperMobileComfort.initHomeNotes();
    }
    if (global.LoreKeeperHomeTabs && typeof global.LoreKeeperHomeTabs.init === "function") {
      global.LoreKeeperHomeTabs.init();
    }
    if (global.LoreKeeperSiteFeedback) {
      global.LoreKeeperSiteFeedback.init({
        sendBtnId: "homeFeedbackSend",
        textId: "homeFeedbackText",
        statusId: "homeFeedbackStatus",
        source: "site",
      });
    }
  });
})(typeof window !== "undefined" ? window : this);
