(function (global) {
  function openDoc(id) {
    global.location.href = "./doc.html?d=" + encodeURIComponent(id);
  }

  function renderDocs() {
    var list = document.getElementById("docList");
    var status = document.getElementById("libraryStatus");
    var docs = LoreKeeperDocuments.loadSorted();
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
    var last = LoreKeeperDocuments.getLastDocId();
    if (last && LoreKeeperDocuments.find(last)) {
      var btn = document.getElementById("continueBtn");
      btn.hidden = false;
      btn.addEventListener("click", function () {
        openDoc(last);
      });
    }
    renderDocs();
  }

  function initNotes() {
    var editingId = null;
    var filterKind = document.getElementById("filterKind");
    var searchBox = document.getElementById("searchBox");
    var noteList = document.getElementById("noteList");
    var editorPanel = document.getElementById("noteEditorPanel");
    var listStatus = document.getElementById("noteListStatus");
    var editorStatus = document.getElementById("noteEditorStatus");
    var notesMorePanel = document.getElementById("notesMorePanel");
    var notesMoreLabel = document.getElementById("notesMoreLabel");
    var NOTES_MORE_KEY = "lk-notes-more-open";

    function syncNotesMoreLabel(count) {
      if (!notesMoreLabel) return;
      if (!count) notesMoreLabel.textContent = "Your notes";
      else notesMoreLabel.textContent = "Your notes (" + count + ")";
    }

    if (notesMorePanel) {
      try {
        if (localStorage.getItem(NOTES_MORE_KEY) === "1") notesMorePanel.open = true;
      } catch (e) {}
      notesMorePanel.addEventListener("toggle", function () {
        try {
          localStorage.setItem(NOTES_MORE_KEY, notesMorePanel.open ? "1" : "0");
        } catch (e) {}
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

    function setEditorStatus(msg, ok) {
      editorStatus.textContent = msg || "";
      editorStatus.className = "lk-status" + (ok ? " ok" : "");
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
      noteList.innerHTML = "";
      if (!items.length) {
        listStatus.textContent = total
          ? "No notes match this filter."
          : "No notes yet — add a scattered scrap when you need one.";
        return;
      }
      listStatus.textContent = items.length + " note" + (items.length === 1 ? "" : "s");
      items.sort(function (a, b) {
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
      items.forEach(function (e) {
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
    }

    function openNoteEditor(id) {
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
      document.getElementById("noteTags").value = entry && entry.tags ? entry.tags.join(", ") : "";
      document.getElementById("noteEditorHeading").textContent = entry ? "Edit note" : "New note";
      editorPanel.hidden = false;
      setEditorStatus("");
      document.getElementById("noteTitle").focus();
    }

    function closeNoteEditor() {
      editorPanel.hidden = true;
      editingId = null;
    }

    function saveNote() {
      var title = document.getElementById("noteTitle").value;
      var body = document.getElementById("noteBody").value;
      var fixedCount = 0;
      if (global.LoreKeeperSpell && global.LoreKeeperSpell.autocorrectText) {
        var bodyFix = LoreKeeperSpell.autocorrectText(body);
        var titleFix = LoreKeeperSpell.autocorrectText(title);
        if (bodyFix.text !== body) {
          body = bodyFix.text;
          document.getElementById("noteBody").value = body;
          fixedCount += bodyFix.fixed.length;
        }
        if (titleFix.text !== title) {
          title = titleFix.text;
          document.getElementById("noteTitle").value = title;
          fixedCount += titleFix.fixed.length;
        }
      }
      title = title.trim();
      body = body.trim();
      if (!title && !body) {
        setEditorStatus("Add a title or some text first.");
        return;
      }
      var now = Date.now();
      var list = LoreKeeperEntries.load();
      var found = false;
      list = list.map(function (e) {
        if (e.id !== editingId) return e;
        found = true;
        return {
          id: e.id,
          kind: document.getElementById("noteKind").value,
          title: title,
          body: body,
          tags: document
            .getElementById("noteTags")
            .value.split(",")
            .map(function (t) {
              return t.trim();
            })
            .filter(Boolean),
          createdAt: e.createdAt || now,
          updatedAt: now,
        };
      });
      if (!found) {
        list.push({
          id: editingId,
          kind: document.getElementById("noteKind").value,
          title: title,
          body: body,
          tags: document
            .getElementById("noteTags")
            .value.split(",")
            .map(function (t) {
              return t.trim();
            })
            .filter(Boolean),
          createdAt: now,
          updatedAt: now,
        });
      }
      LoreKeeperEntries.save(list);
      LoreKeeperAccountStorage.flush().then(function () {
        var msg = "Saved.";
        if (fixedCount) {
          msg =
            "Saved — fixed " +
            fixedCount +
            " spelling mistake" +
            (fixedCount === 1 ? "" : "s") +
            " (not on My words).";
        }
        setEditorStatus(msg, true);
        renderNotes();
        setTimeout(closeNoteEditor, 400);
      });
      return;
    }

    document.getElementById("newNoteBtn").addEventListener("click", function () {
      openNoteEditor(null);
    });
    document.getElementById("cancelNoteBtn").addEventListener("click", closeNoteEditor);
    document.getElementById("saveNoteBtn").addEventListener("click", saveNote);
    document.getElementById("deleteNoteBtn").addEventListener("click", function () {
      if (!editingId || !confirm("Delete this note?")) return;
      var list = LoreKeeperEntries.load().filter(function (e) {
        return e.id !== editingId;
      });
      LoreKeeperEntries.save(list);
      LoreKeeperAccountStorage.flush();
      closeNoteEditor();
      renderNotes();
    });
    filterKind.addEventListener("change", renderNotes);
    searchBox.addEventListener("input", renderNotes);
    document.getElementById("exportNotesBtn").addEventListener("click", function () {
      var blob = new Blob([LoreKeeperEntries.exportJson()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "lorekeeper-notes.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    renderNotes();
    LoreKeeperSpell.ready.then(function () {
      LoreKeeperSpell.bindTextarea(
        document.getElementById("noteBody"),
        document.getElementById("noteSpellFlags")
      );
    });
  }

  function initAsk() {
    var askBtn = document.getElementById("askBtn");
    var askQuestion = document.getElementById("askQuestion");
    var askStatus = document.getElementById("askStatus");
    var askAnswer = document.getElementById("askAnswer");
    var askSources = document.getElementById("askSources");

    askBtn.addEventListener("click", function () {
      var q = askQuestion.value.trim();
      if (!q) {
        askStatus.textContent = "Type a question first.";
        askStatus.hidden = false;
        return;
      }
      askStatus.textContent = "Searching documents and notes…";
      askStatus.hidden = false;
      askAnswer.hidden = true;
      askSources.hidden = true;
      askBtn.disabled = true;
      LoreKeeperRecall.ask(q)
        .then(function (res) {
          if (!res || !res.ok) {
            askStatus.textContent = LoreKeeperRecall.friendlyError(res && res.error);
            return;
          }
          askStatus.textContent = "From your saved writing.";
          askStatus.className = "lk-status ok";
          askAnswer.textContent = res.answer || "";
          askAnswer.hidden = !res.answer;
          askSources.innerHTML = "";
          if (res.sources && res.sources.length) {
            res.sources.forEach(function (src) {
              var li = document.createElement("li");
              var span = document.createElement("span");
              span.className = "lk-ask-source-btn";
              span.textContent = (src.title || "Untitled") + " (" + (src.kindLabel || "Note") + ")";
              li.appendChild(span);
              askSources.appendChild(li);
            });
            askSources.hidden = false;
          }
        })
        .catch(function () {
          askStatus.textContent = LoreKeeperRecall.friendlyError("network_error");
        })
        .finally(function () {
          askBtn.disabled = false;
        });
    });
  }

  Promise.all([LoreKeeperDocuments.ready, LoreKeeperAccountStorage.ready]).then(function () {
    if (!LoreKeeperAccountStorage.isSignedIn()) {
      LoreKeeperAccountStorage.ensureSignedIn();
      return;
    }
    initDocs();
    initNotes();
    initAsk();
  });
})(typeof window !== "undefined" ? window : this);
