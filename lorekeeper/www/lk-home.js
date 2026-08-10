(function (global) {
  function openDoc(id) {
    if (id && global.LoreKeeperLastFocus && global.LoreKeeperLastFocus.setDoc) {
      global.LoreKeeperLastFocus.setDoc(id);
    }
    global.location.href = "./doc.html?d=" + encodeURIComponent(id);
  }

  function pinDocIdFromFocus() {
    var lf = global.LoreKeeperLastFocus;
    if (!lf || !lf.get) return "";
    var focus = lf.get();
    if (!focus || focus.place !== "doc" || !focus.docId) return "";
    return focus.docId;
  }

  function applyPinnedDocOrder(cards, pinDocId) {
    if (!pinDocId || !cards || !cards.length) return cards;
    var next = cards.slice();
    for (var i = 0; i < next.length; i++) {
      var silo = next[i];
      var docs = (silo && silo.docs) || [];
      var docIdx = -1;
      for (var j = 0; j < docs.length; j++) {
        if (docs[j] && docs[j].id === pinDocId) {
          docIdx = j;
          break;
        }
      }
      if (docIdx < 0) continue;
      var reorderedDocs = docs.slice();
      var pinned = reorderedDocs.splice(docIdx, 1)[0];
      reorderedDocs.unshift(pinned);
      var pinnedSilo = {};
      for (var key in silo) {
        if (Object.prototype.hasOwnProperty.call(silo, key)) pinnedSilo[key] = silo[key];
      }
      pinnedSilo.docs = reorderedDocs;
      next.splice(i, 1);
      next.unshift(pinnedSilo);
      return next;
    }
    return cards;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var openNoteEditorRef = null;
  var refreshSilosRef = null;
  var NOTES_LIST_PREF_KEY = "lk-silo-notes-list-v1";
  var NOTES_MODE_CLOSED = "closed";
  var NOTES_MODE_OPEN = "open";
  var NOTES_MODE_FULL = "full";
  var noteEditorHomeParent = null;
  var noteEditorHomeNext = null;
  var parkedNoteSiloKey = null;

  function noteMatchesFilter(note, kind, q) {
    if (kind && note.kind !== kind) return false;
    if (!q) return true;
    var hay = ((note.title || "") + " " + (note.body || "") + " " + (note.tags || []).join(" ")).toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function rememberNoteEditorHome() {
    var panel = document.getElementById("noteEditorPanel");
    if (!panel || noteEditorHomeParent) return;
    noteEditorHomeParent = panel.parentNode;
    noteEditorHomeNext = panel.nextSibling;
  }

  function restoreNoteEditorHome() {
    var panel = document.getElementById("noteEditorPanel");
    if (!panel || !noteEditorHomeParent) return;
    if (panel.parentNode === noteEditorHomeParent) {
      panel.classList.remove("lk-note-editor-inline");
      return;
    }
    if (noteEditorHomeNext && noteEditorHomeNext.parentNode === noteEditorHomeParent) {
      noteEditorHomeParent.insertBefore(panel, noteEditorHomeNext);
    } else {
      noteEditorHomeParent.appendChild(panel);
    }
    panel.classList.remove("lk-note-editor-inline");
  }

  function findSiloSectionByKey(siloKey) {
    var list = document.getElementById("siloList");
    if (!list || !siloKey) return null;
    var sections = list.querySelectorAll(".lk-silo");
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getAttribute("data-silo-key") === siloKey) return sections[i];
    }
    return null;
  }

  function parkNoteEditorInSilo(siloKey) {
    rememberNoteEditorHome();
    var panel = document.getElementById("noteEditorPanel");
    if (!panel || !siloKey) return false;
    // Full screen hides other panels; nesting under a silo would blank the editor.
    if (document.body.classList.contains("lk-note-fullscreen")) return false;
    var section = findSiloSectionByKey(siloKey);
    if (!section) return false;
    var notesWrap = section.querySelector(".lk-silo-notes");
    if (!notesWrap) return false;
    var noteList = notesWrap.querySelector(".lk-entry-list");
    if (noteList) {
      if (noteList.nextSibling) notesWrap.insertBefore(panel, noteList.nextSibling);
      else notesWrap.appendChild(panel);
    } else {
      notesWrap.appendChild(panel);
    }
    panel.classList.add("lk-note-editor-inline");
    parkedNoteSiloKey = siloKey;
    return true;
  }

  function scrollNoteEditorIntoView() {
    var panel = document.getElementById("noteEditorPanel");
    if (!panel || panel.hidden || typeof panel.scrollIntoView !== "function") return;
    global.requestAnimationFrame(function () {
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function scrollNoteEditorIntoViewIfNeeded() {
    var panel = document.getElementById("noteEditorPanel");
    if (!panel || panel.hidden || typeof panel.scrollIntoView !== "function") return;
    global.requestAnimationFrame(function () {
      var rect = panel.getBoundingClientRect();
      var vh = global.innerHeight || 0;
      // Already near where the writer was looking — don't yank the page.
      if (rect.top >= 0 && rect.top <= vh * 0.8) return;
      if (rect.bottom > 0 && rect.top < vh) return;
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function placeNoteEditorNearSilo(siloKey, opts) {
    opts = opts || {};
    rememberNoteEditorHome();
    var parked = !!(siloKey && parkNoteEditorInSilo(siloKey));
    if (!parked) {
      restoreNoteEditorHome();
      parkedNoteSiloKey = null;
    }
    if (opts.scroll === "always") scrollNoteEditorIntoView();
    else if (opts.scroll !== false) scrollNoteEditorIntoViewIfNeeded();
    return parked;
  }

  function focusWithoutScroll(el) {
    if (!el || typeof el.focus !== "function") return;
    try {
      el.focus({ preventScroll: true });
    } catch (err) {
      el.focus();
    }
  }

  function siloKeyForNoteId(noteId) {
    if (!noteId || !global.LoreKeeperSilos) return "";
    var built = LoreKeeperSilos.buildSilos(LoreKeeperDocuments.loadSorted(), LoreKeeperEntries.load());
    var cards = (built.silos || []).concat(built.randomIdeas ? [built.randomIdeas] : []);
    for (var i = 0; i < cards.length; i++) {
      var siloNotes = (cards[i] && cards[i].notes) || [];
      for (var j = 0; j < siloNotes.length; j++) {
        if (siloNotes[j] && siloNotes[j].id === noteId) return cards[i].key || "";
      }
    }
    return "";
  }

  function siloKeyForWorkTag(workTag) {
    var raw = String(workTag || "").trim();
    if (!raw) return "";
    if (global.LoreKeeperWorkMembership && global.LoreKeeperWorkMembership.normalizeWorkKey) {
      var normalized = global.LoreKeeperWorkMembership.normalizeWorkKey(raw);
      if (normalized) return normalized;
    }
    return raw.toLowerCase().replace(/\s+/g, " ");
  }

  function loadNotesListPrefs() {
    try {
      var raw = global.localStorage.getItem(NOTES_LIST_PREF_KEY);
      if (!raw) return { modes: {}, touched: false };
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { modes: {}, touched: false };
      var modes = parsed.modes && typeof parsed.modes === "object" ? parsed.modes : {};
      return { modes: modes, touched: !!parsed.touched };
    } catch (e) {
      return { modes: {}, touched: false };
    }
  }

  function saveNotesListPrefs(prefs) {
    try {
      global.localStorage.setItem(
        NOTES_LIST_PREF_KEY,
        JSON.stringify({
          modes: (prefs && prefs.modes) || {},
          touched: !!(prefs && prefs.touched),
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function normalizeNotesMode(mode) {
    if (mode === NOTES_MODE_CLOSED || mode === NOTES_MODE_FULL) return mode;
    return NOTES_MODE_OPEN;
  }

  function defaultOpenSiloKey(cards) {
    var pinDocId = pinDocIdFromFocus();
    if (pinDocId && cards && cards.length) {
      for (var i = 0; i < cards.length; i++) {
        var silo = cards[i];
        var docs = (silo && silo.docs) || [];
        for (var j = 0; j < docs.length; j++) {
          if (docs[j] && docs[j].id === pinDocId) return silo.key || "";
        }
      }
    }
    if (cards && cards.length && cards[0] && !cards[0].isRandom) return cards[0].key || "";
    return cards && cards[0] ? cards[0].key || "" : "";
  }

  function notesModeForSilo(prefs, siloKey, defaultOpenKey) {
    if (prefs.modes && Object.prototype.hasOwnProperty.call(prefs.modes, siloKey)) {
      return normalizeNotesMode(prefs.modes[siloKey]);
    }
    if (!prefs.touched) {
      return siloKey && siloKey === defaultOpenKey ? NOTES_MODE_OPEN : NOTES_MODE_CLOSED;
    }
    return NOTES_MODE_OPEN;
  }

  function setNotesMode(siloKey, mode) {
    if (!siloKey) return;
    var prefs = loadNotesListPrefs();
    prefs.modes[siloKey] = normalizeNotesMode(mode);
    prefs.touched = true;
    saveNotesListPrefs(prefs);
  }

  function setAllNotesModes(keys, mode) {
    var prefs = loadNotesListPrefs();
    var nextMode = normalizeNotesMode(mode);
    if (nextMode === NOTES_MODE_FULL) nextMode = NOTES_MODE_OPEN;
    (keys || []).forEach(function (key) {
      if (key) prefs.modes[key] = nextMode;
    });
    prefs.touched = true;
    saveNotesListPrefs(prefs);
  }

  function renderSilos() {
    var list = document.getElementById("siloList");
    var status = document.getElementById("libraryStatus");
    if (!list || !global.LoreKeeperSilos) return;

    var filterKind = document.getElementById("filterKind");
    var searchBox = document.getElementById("searchBox");
    var kind = filterKind ? filterKind.value : "";
    var q = searchBox ? searchBox.value.trim().toLowerCase() : "";

    var docs = LoreKeeperDocuments.loadSorted();
    var notes = LoreKeeperEntries.load();
    var built = LoreKeeperSilos.buildSilos(docs, notes);
    var cards = built.silos.slice();
    cards.push(built.randomIdeas);
    cards = applyPinnedDocOrder(cards, pinDocIdFromFocus());

    var editorPanelLive = document.getElementById("noteEditorPanel");
    var editorWasOpen = !!(editorPanelLive && !editorPanelLive.hidden);
    var keepParkKey = parkedNoteSiloKey;
    rememberNoteEditorHome();
    restoreNoteEditorHome();

    list.innerHTML = "";
    var storyCount = built.silos.length;
    var noteCount = notes.length;
    if (!storyCount && !built.randomIdeas.notes.length && !built.randomIdeas.docs.length && !docs.length) {
      status.textContent = "No stories yet — create a document to start a silo.";
      refreshAskSiloOptions(built);
      return;
    }
    status.textContent =
      storyCount +
      " stor" +
      (storyCount === 1 ? "y" : "ies") +
      (built.randomIdeas.notes.length || built.randomIdeas.docs.length
        ? " · " +
          (built.randomIdeas.notes.length + built.randomIdeas.docs.length) +
          " in Random ideas"
        : "") +
      (noteCount ? " · " + noteCount + " note" + (noteCount === 1 ? "" : "s") : "");

    var notesPrefs = loadNotesListPrefs();
    var defaultOpenKey = defaultOpenSiloKey(cards);

    cards.forEach(function (silo) {
      var filteredNotes = (silo.notes || []).filter(function (n) {
        return noteMatchesFilter(n, kind, q);
      });
      var filteredDocs = (silo.docs || []).filter(function (d) {
        if (!q) return true;
        return String(d.title || "")
          .toLowerCase()
          .indexOf(q) !== -1;
      });
      if (kind || q) {
        if (!filteredDocs.length && !filteredNotes.length) return;
      }

      var siloKey = silo.key || "";
      var notesMode = notesModeForSilo(notesPrefs, siloKey, defaultOpenKey);

      var section = document.createElement("section");
      section.className = "lk-silo" + (silo.isRandom ? " is-random" : "");
      section.setAttribute("data-silo-key", siloKey);

      var heading = document.createElement("h3");
      heading.className = "lk-silo-title";
      heading.textContent = silo.title || "Untitled";
      section.appendChild(heading);

      if (silo.isRandom) {
        var lead = document.createElement("p");
        lead.className = "muted lk-silo-lead";
        lead.textContent = "Undecided scraps — not tied to a story yet.";
        section.appendChild(lead);
      }

      var docList = document.createElement("ul");
      docList.className = "lk-doc-list lk-silo-docs";
      if (!filteredDocs.length && !silo.isRandom) {
        var emptyDoc = document.createElement("li");
        emptyDoc.className = "muted lk-silo-empty";
        emptyDoc.textContent = "No main draft yet for this story.";
        docList.appendChild(emptyDoc);
      }
      filteredDocs.forEach(function (doc, idx) {
        var li = document.createElement("li");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "lk-doc-open";
        var label = silo.isRandom
          ? "Document"
          : idx === 0
            ? "Main draft"
            : "Document";
        btn.innerHTML =
          "<span class='lk-silo-doc-label'>" +
          escapeHtml(label) +
          "</span><strong>" +
          escapeHtml(doc.title || "Untitled") +
          "</strong><br><span class='muted'>" +
          LoreKeeperDocuments.formatWhen(doc.updatedAt) +
          "</span>";
        btn.addEventListener("click", function () {
          openDoc(doc.id);
        });
        li.appendChild(btn);
        docList.appendChild(li);
      });
      if (filteredDocs.length || !silo.isRandom) {
        section.appendChild(docList);
      }

      var notesWrap = document.createElement("div");
      notesWrap.className =
        "lk-silo-notes" +
        (notesMode === NOTES_MODE_CLOSED ? " is-collapsed" : "") +
        (notesMode === NOTES_MODE_FULL ? " is-full" : "");
      notesWrap.setAttribute("data-notes-mode", notesMode);

      var notesHead = document.createElement("div");
      notesHead.className = "lk-silo-notes-head";

      var notesHeading = document.createElement("h4");
      notesHeading.className = "lk-silo-notes-title";
      notesHeading.textContent = silo.isRandom
        ? "Notes (" + filteredNotes.length + ")"
        : "Notes for this story (" + filteredNotes.length + ")";
      notesHead.appendChild(notesHeading);

      var toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "lk-silo-notes-toggle";
      var notesOpen = notesMode !== NOTES_MODE_CLOSED;
      toggleBtn.setAttribute("aria-expanded", notesOpen ? "true" : "false");
      toggleBtn.textContent = notesOpen ? "Hide notes" : "Show notes";
      toggleBtn.addEventListener("click", function () {
        var next = notesMode === NOTES_MODE_CLOSED ? NOTES_MODE_OPEN : NOTES_MODE_CLOSED;
        setNotesMode(siloKey, next);
        renderSilos();
      });
      notesHead.appendChild(toggleBtn);
      notesWrap.appendChild(notesHead);

      if (notesOpen && filteredNotes.length) {
        var fullBtn = document.createElement("button");
        fullBtn.type = "button";
        fullBtn.className = "lk-btn secondary lk-silo-notes-full-btn";
        if (notesMode === NOTES_MODE_FULL) {
          fullBtn.textContent = "Show short list";
          fullBtn.title = "Back to the short scroll list";
          fullBtn.addEventListener("click", function () {
            setNotesMode(siloKey, NOTES_MODE_OPEN);
            renderSilos();
          });
        } else {
          fullBtn.textContent = "Expand to full list";
          fullBtn.title = "Show every note for this story (no scroll box)";
          fullBtn.addEventListener("click", function () {
            setNotesMode(siloKey, NOTES_MODE_FULL);
            renderSilos();
          });
        }
        notesWrap.appendChild(fullBtn);
      }

      var noteList = document.createElement("ul");
      noteList.className = "lk-entry-list";
      if (!filteredNotes.length) {
        var emptyNote = document.createElement("li");
        emptyNote.className = "muted lk-silo-empty";
        emptyNote.textContent = silo.isRandom
          ? filteredDocs.length
            ? "No unassigned notes in Random ideas."
            : "No Random ideas yet — leave the story title blank on a new note."
          : "No notes in this silo yet.";
        noteList.appendChild(emptyNote);
      } else {
        filteredNotes.forEach(function (e) {
          var li = document.createElement("li");
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "lk-entry-open";
          btn.innerHTML =
            '<span class="lk-entry-kind">' +
            escapeHtml(LoreKeeperEntries.kindLabel(e.kind)) +
            "</span><br><strong>" +
            escapeHtml(e.title || "Untitled") +
            "</strong>";
          btn.addEventListener("click", function () {
            if (openNoteEditorRef) openNoteEditorRef(e.id, { siloKey: silo.key });
          });
          li.appendChild(btn);
          noteList.appendChild(li);
        });
      }
      notesWrap.appendChild(noteList);

      if (!silo.isRandom) {
        var addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "lk-btn secondary lk-silo-add-note";
        addBtn.textContent = "Add note to this story";
        addBtn.addEventListener("click", function () {
          if (openNoteEditorRef) openNoteEditorRef(null, { workTag: silo.title, siloKey: silo.key });
        });
        notesWrap.appendChild(addBtn);
      }

      section.appendChild(notesWrap);
      list.appendChild(section);
    });

    refreshAskSiloOptions(built);
    // Keep the editor at page root while full screen — re-parking under a silo
    // blanks the screen because those panels are display:none in that mode.
    if (
      editorWasOpen &&
      keepParkKey &&
      !document.body.classList.contains("lk-note-fullscreen")
    ) {
      parkNoteEditorInSilo(keepParkKey);
    } else if (editorWasOpen && keepParkKey) {
      parkedNoteSiloKey = keepParkKey;
    }
  }

  function collectRenderedSiloKeys() {
    var list = document.getElementById("siloList");
    if (!list) return [];
    var keys = [];
    list.querySelectorAll("[data-silo-key]").forEach(function (el) {
      var key = el.getAttribute("data-silo-key") || "";
      if (key && keys.indexOf(key) === -1) keys.push(key);
    });
    return keys;
  }

  function expandAllNotesLists() {
    var prefs = loadNotesListPrefs();
    var keys = Object.keys(prefs.modes || {});
    collectRenderedSiloKeys().forEach(function (k) {
      if (keys.indexOf(k) === -1) keys.push(k);
    });
    setAllNotesModes(keys, NOTES_MODE_OPEN);
    renderSilos();
  }

  function collapseAllNotesLists() {
    var prefs = loadNotesListPrefs();
    var keys = Object.keys(prefs.modes || {});
    collectRenderedSiloKeys().forEach(function (k) {
      if (keys.indexOf(k) === -1) keys.push(k);
    });
    setAllNotesModes(keys, NOTES_MODE_CLOSED);
    renderSilos();
  }

  function refreshAskSiloOptions(built) {
    var sel = document.getElementById("askSilo");
    if (!sel) return;
    var prev = sel.value;
    var options = built || { silos: [], randomIdeas: { title: "Random ideas", key: "__random_ideas__" } };
    sel.innerHTML = "";
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a story…";
    sel.appendChild(placeholder);
    (options.silos || []).forEach(function (silo) {
      var opt = document.createElement("option");
      opt.value = "work:" + silo.title;
      opt.textContent = silo.title;
      sel.appendChild(opt);
    });
    var rand = document.createElement("option");
    rand.value = "random";
    rand.textContent = (options.randomIdeas && options.randomIdeas.title) || "Random ideas";
    sel.appendChild(rand);
    if (prev) {
      sel.value = prev;
      if (sel.value !== prev) sel.value = "";
    }
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
        openDoc(LoreKeeperDocuments.getLastDocId());
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
        document.getElementById("newDocStatus").textContent = "Add a document or story title.";
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
    refreshSilosRef = renderSilos;
    renderSilos();
    global.addEventListener("lorekeeper-data-hydrated", function () {
      if (global.LoreKeeperSilos && global.LoreKeeperSilos.migrateAll) {
        var mig = global.LoreKeeperSilos.migrateAll();
        if (mig && (mig.changedDocs || mig.changedNotes) && LoreKeeperAccountStorage.flush) {
          LoreKeeperAccountStorage.flush();
        }
      }
      renderSilos();
      syncContinueButton();
    });
  }

  function initNotes() {
    var editingId = null;
    var filterKind = document.getElementById("filterKind");
    var searchBox = document.getElementById("searchBox");
    var editorPanel = document.getElementById("noteEditorPanel");
    var editorStatus = document.getElementById("noteEditorStatus");
    var noteSyncBanner = document.getElementById("noteSyncBanner");
    var noteSyncRetryBtn = document.getElementById("noteSyncRetryBtn");
    var retryNoteSyncBtn = document.getElementById("retryNoteSyncBtn");
    var noteFullscreenBtn = document.getElementById("noteFullscreenBtn");
    var saveCloseTimer = null;
    var SAVE_STATUS_MS = 10000;

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
      var wantOn = !!on;
      var wasOn = document.body.classList.contains("lk-note-fullscreen");
      if (wantOn === wasOn) {
        syncNoteFullscreenButton();
        return;
      }
      if (wantOn) {
        // Lift out of a silo so fullscreen CSS can hide other panels without
        // also hiding this editor (a display:none ancestor would swallow it).
        rememberNoteEditorHome();
        restoreNoteEditorHome();
        document.body.classList.add("lk-note-fullscreen");
        syncNoteFullscreenButton();
        focusWithoutScroll(document.getElementById("noteBody"));
        return;
      }
      document.body.classList.remove("lk-note-fullscreen");
      syncNoteFullscreenButton();
      if (parkedNoteSiloKey && editorPanel && !editorPanel.hidden) {
        parkNoteEditorInSilo(parkedNoteSiloKey);
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
      var parkKey =
        opts.siloKey ||
        (entry && entry.id ? siloKeyForNoteId(entry.id) : "") ||
        (opts.workTag ? siloKeyForWorkTag(opts.workTag) : "") ||
        (tagsVal ? siloKeyForWorkTag(String(tagsVal).split(",")[0]) : "");
      // Park while still hidden so focus cannot yank the page to the bottom slot.
      placeNoteEditorNearSilo(parkKey, { scroll: false });
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
        focusWithoutScroll(document.getElementById("noteTitle"));
      }
      scrollNoteEditorIntoViewIfNeeded();
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

    openNoteEditorRef = openNoteEditor;

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
      restoreNoteEditorHome();
      parkedNoteSiloKey = null;
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
      renderSilos();
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
      if (global.LoreKeeperHomeTabs && typeof global.LoreKeeperHomeTabs.goTo === "function") {
        global.LoreKeeperHomeTabs.goTo("panel-stories");
      }
      var d = (e && e.detail) || {};
      if (d.id) {
        openNoteEditor(d.id, { siloKey: d.siloKey || "" });
        return;
      }
      openNoteEditor(null, {
        quickJot: !!d.quickJot,
        workTag: d.workTag || "",
        siloKey: d.siloKey || (d.workTag ? siloKeyForWorkTag(d.workTag) : ""),
      });
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
      renderSilos();
      updateNoteSyncBanner();
      LoreKeeperAccountStorage.flush().then(function () {
        updateNoteSyncBanner();
      });
    });
    filterKind.addEventListener("change", renderSilos);
    searchBox.addEventListener("input", renderSilos);
    var expandAllNotesBtn = document.getElementById("expandAllNotesBtn");
    var collapseAllNotesBtn = document.getElementById("collapseAllNotesBtn");
    if (expandAllNotesBtn) expandAllNotesBtn.addEventListener("click", expandAllNotesLists);
    if (collapseAllNotesBtn) collapseAllNotesBtn.addEventListener("click", collapseAllNotesLists);
    document.getElementById("exportNotesBtn").addEventListener("click", function () {
      var blob = new Blob([LoreKeeperEntries.exportJson()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "lorekeeper-notes.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    global.addEventListener("lorekeeper-data-hydrated", renderSilos);
    global.addEventListener("lorekeeper-keyboard-save", function () {
      if (!editorPanel || editorPanel.hidden) return;
      saveNote();
    });
  }

  function scopeFromAskSilo() {
    var sel = document.getElementById("askSilo");
    var val = sel ? String(sel.value || "").trim() : "";
    if (!val) return null;
    if (val === "random") {
      return { mode: "random_ideas" };
    }
    if (val.indexOf("work:") === 0) {
      return { mode: "work", workTitle: val.slice(5) };
    }
    return null;
  }

  function initAsk() {
    var askBtn = document.getElementById("askBtn");
    var askQuestion = document.getElementById("askQuestion");
    var askStatus = document.getElementById("askStatus");
    var askAnswer = document.getElementById("askAnswer");
    var askSources = document.getElementById("askSources");
    if (!askBtn || !askQuestion) return;

    var ASK_CONTINUE_KEY = "lk-ask-continue";

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
        askStatus.textContent = "Your turn — reply in Ask to narrow Random ideas.";
      } else if (res.recallScope === "floaters" || res.recallScope === "random_ideas") {
        askStatus.textContent = "From your Random ideas pile only.";
      } else if (res.materialState === "summarizable") {
        askStatus.textContent = "Summary from this story’s notes and draft.";
      } else if (res.materialState === "fragments_only") {
        askStatus.textContent =
          "Partial — not enough saved yet for a full summary.";
      } else if (res.materialState === "nothing_saved") {
        askStatus.textContent = "Nothing saved on that yet in this silo.";
      }
    }

    function showFinalAnswer(res, q, scope) {
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
          scope: scope || null,
        });
      }
    }

    function runAskRequest(q, askOpts) {
      askStatus.textContent = "Searching this silo…";
      askStatus.className = "lk-status";
      askStatus.hidden = false;
      clearAnswerUi();
      askBtn.disabled = true;
      var slowTimer = setTimeout(function () {
        if (askBtn.disabled) {
          askStatus.textContent =
            "Still searching — complex questions can take a minute…";
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
          showFinalAnswer(res, q, askOpts && askOpts.scope);
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

    askBtn.addEventListener("click", function () {
      var q = askQuestion.value.trim();
      if (!q) {
        askStatus.textContent = "Type a question first.";
        askStatus.hidden = false;
        return;
      }
      var scope = scopeFromAskSilo();
      if (!scope) {
        askStatus.textContent = "Choose a story (or Random ideas) first.";
        askStatus.className = "lk-status err";
        askStatus.hidden = false;
        return;
      }
      if (global.LoreKeeperLastFocus && global.LoreKeeperLastFocus.setAsk) {
        global.LoreKeeperLastFocus.setAsk();
      }
      var askOpts = { includeDocuments: true, scope: scope };
      var pending = loadAskContinue();
      if (pending) askOpts.askContinue = pending;
      runAskRequest(q, askOpts);
    });

    askQuestion.addEventListener("keydown", function (e) {
      if (e.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        askBtn.click();
        return;
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
    if (global.LoreKeeperSilos && global.LoreKeeperSilos.migrateAll) {
      var mig = global.LoreKeeperSilos.migrateAll();
      if (mig && (mig.changedDocs || mig.changedNotes) && LoreKeeperAccountStorage.flush) {
        LoreKeeperAccountStorage.flush();
      }
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
    if (pinDocIdFromFocus()) {
      global.scrollTo(0, 0);
      var stories = document.querySelector(".lk-panel");
      if (stories && typeof stories.scrollIntoView === "function") {
        stories.scrollIntoView({ block: "start", behavior: "auto" });
      }
    }
  });
})(typeof window !== "undefined" ? window : this);
