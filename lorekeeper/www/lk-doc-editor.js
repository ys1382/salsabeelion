(function (global) {
  var PAGE_H = 1056;
  var PAGE_GAP = 14;
  /** Keep whole lines clear of bottom margin / page edge (no mid-line clips). */
  var PAGE_LINE_BUFFER = 40;
  var PAD_OVERSHOOT = 10;
  var PAGE_SYNC_MAX_ROUNDS = 48;
  var MARGIN_PX = { narrow: 48, normal: 96, wide: 144 };

  var doc = null;
  var quill = null;
  var spellCtl = null;
  var saveTimer = null;
  var chromeTimer = null;
  var gapTimer = null;
  var dirty = false;
  var loading = false;
  var syncingGaps = false;
  /** User typed while a gap sync was running — run layout again after. */
  var gapResyncNeeded = false;
  var saveMaxTimer = null;
  var resumeCaptureTimer = null;
  /** After Delete document — block park/flush from re-saving that one doc. */
  var discardOnLeave = false;

  function docTextLength() {
    if (!quill) return 0;
    return Math.max(0, quill.getLength() - 1);
  }

  function captureResumePosition() {
    if (!doc || !quill || loading) return;
    var range = quill.getSelection();
    var index = range && typeof range.index === "number" ? range.index : docTextLength();
    doc.lastCaretIndex = Math.max(0, Math.min(index, docTextLength()));
    quill.__lkResumeIndex = doc.lastCaretIndex;
    var canvas = document.getElementById("docCanvas");
    if (canvas) doc.lastScrollTop = canvas.scrollTop;
  }

  function scrollIndexIntoView(index, length) {
    if (!quill) return;
    length = length || 0;
    var probe = length || 1;
    quill.setSelection(index, length, "silent");
    var bounds = quill.getBounds(index, probe);
    if (!bounds) return;
    var canvas = document.getElementById("docCanvas");
    var editor = quill.root;
    if (!canvas || !editor) return;
    var editorTop =
      editor.getBoundingClientRect().top - canvas.getBoundingClientRect().top + canvas.scrollTop;
    var target = editorTop + bounds.top - canvas.clientHeight * 0.35;
    canvas.scrollTop = Math.max(0, target);
  }

  function restoreResumePosition() {
    if (!quill || !doc) return;
    var canvas = document.getElementById("docCanvas");
    // Prefer saved canvas scroll when present — don't yank the reader back to the caret.
    if (canvas && typeof doc.lastScrollTop === "number" && doc.lastScrollTop > 0) {
      canvas.scrollTop = doc.lastScrollTop;
      var len = docTextLength();
      var index =
        typeof doc.lastCaretIndex === "number" && doc.lastCaretIndex >= 0
          ? Math.min(doc.lastCaretIndex, len)
          : len;
      quill.__lkResumeIndex = index;
      var isMobile = global.LoreKeeperMobileComfort && global.LoreKeeperMobileComfort.isMobile();
      if (!isMobile) {
        try {
          quill.setSelection(index, 0, "silent");
        } catch (e) {
          /* ignore */
        }
      }
      return;
    }
    var len = docTextLength();
    var index;
    if (typeof doc.lastCaretIndex === "number" && doc.lastCaretIndex >= 0) {
      index = Math.min(doc.lastCaretIndex, len);
    } else {
      index = len;
    }
    quill.__lkResumeIndex = index;
    scrollIndexIntoView(index, 0);
    var isMobile = global.LoreKeeperMobileComfort && global.LoreKeeperMobileComfort.isMobile();
    if (!isMobile) {
      quill.setSelection(index, 0, "silent");
    }
  }

  function bindResumeCapture() {
    if (!quill || quill.__lkResumeBound) return;
    quill.__lkResumeBound = true;
    quill.on("selection-change", function (range, _old, source) {
      if (loading || !doc || !range || source === "silent") return;
      doc.lastCaretIndex = Math.max(0, Math.min(range.index, docTextLength()));
      quill.__lkResumeIndex = doc.lastCaretIndex;
      if (resumeCaptureTimer) clearTimeout(resumeCaptureTimer);
      resumeCaptureTimer = setTimeout(function () {
        resumeCaptureTimer = null;
        if (!doc || !quill || loading) return;
        var canvas = document.getElementById("docCanvas");
        if (canvas) doc.lastScrollTop = canvas.scrollTop;
        LoreKeeperDocuments.save(doc);
      }, 1200);
    });
  }

  function htmlWordCount(html) {
    var text = String(html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }

  function syncDocBodyFromEditor() {
    if (!doc || !quill || loading) return;
    if (global.LoreKeeperSpell && global.LoreKeeperSpell.clearQuillSpellMarks) {
      global.LoreKeeperSpell.clearQuillSpellMarks(quill);
    }
    if (global.LoreKeeperDocPageBoxes && global.LoreKeeperDocPageBoxes.getJoinedHtml) {
      var joined = LoreKeeperDocPageBoxes.getJoinedHtml();
      if (isEmptyHtml(joined) && !isEmptyHtml(doc.bodyHtml)) return;
      // Never let a clipped page layout wipe a longer saved draft.
      var before = htmlWordCount(doc.bodyHtml);
      var after = htmlWordCount(joined);
      if (before > 40 && after < Math.floor(before * 0.95)) {
        setSaveStatus("Save blocked — editor looked shorter than your draft. Refresh or restore a version.", "error");
        return;
      }
      doc.bodyHtml = joined;
      doc.bodyFormat = "html";
      return;
    }
    var wordsBefore = editorContentWords();
    var root = quill.root.cloneNode(true);
    root.querySelectorAll(".lk-auto-page-gap").forEach(function (node) {
      node.remove();
    });
    var nextHtml = root.innerHTML;
    if (isEmptyHtml(nextHtml) && !isEmptyHtml(doc.bodyHtml)) return;
    var wordsAfter = String(nextHtml || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, "");
    if (wordsBefore && wordsAfter.length < wordsBefore.length) return;
    if (htmlWordCount(doc.bodyHtml) > 40 && htmlWordCount(nextHtml) < Math.floor(htmlWordCount(doc.bodyHtml) * 0.95)) {
      return;
    }
    doc.bodyHtml = nextHtml;
    doc.bodyFormat = "html";
  }

  function queueSave() {
    if (loading || !doc) return;
    dirty = true;
    setSaveStatus("Saving…", "saving");
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      flushSave(false);
    }, 300);
    if (!saveMaxTimer) {
      saveMaxTimer = setTimeout(function () {
        saveMaxTimer = null;
        flushSave(true);
      }, 1500);
    }
  }

  function markEdited() {
    queueSave();
  }

  function docIdFromUrl() {
    return new URLSearchParams(global.location.search).get("d") || "";
  }

  function editorEl() {
    return document.querySelector("#docEditor .ql-editor") || document.querySelector("#docQuillMount .ql-editor");
  }

  function marginPx() {
    return MARGIN_PX[doc.margins] || MARGIN_PX.normal;
  }

  function pageMetrics() {
    var el = editorEl();
    if (!el) return { pageH: PAGE_H, gap: PAGE_GAP };
    var cs = global.getComputedStyle(el);
    var pageH = PAGE_H;
    var pageHRaw = (cs.getPropertyValue("--lk-page-h") || "").trim();
    if (pageHRaw.endsWith("px")) {
      pageH = parseFloat(pageHRaw) || PAGE_H;
    } else if (pageHRaw.endsWith("vh")) {
      pageH = (parseFloat(pageHRaw) / 100) * (global.innerHeight || 800);
    }
    var gap = parseFloat(cs.getPropertyValue("--lk-page-gap")) || PAGE_GAP;
    return { pageH: pageH, gap: gap };
  }

  function ensureChromeBack() {
    var container = document.querySelector("#docEditor .ql-container");
    if (!container) return null;
    var layer = container.querySelector(".lk-page-chrome-back");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "lk-page-chrome-back";
      layer.setAttribute("aria-hidden", "true");
      container.insertBefore(layer, container.firstChild);
    }
    return layer;
  }

  function ensureGapCover() {
    var container = document.querySelector("#docEditor .ql-container");
    if (!container) return null;
    var layer = container.querySelector(".lk-page-gap-front");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "lk-page-gap-front";
      layer.setAttribute("aria-hidden", "true");
      container.appendChild(layer);
    }
    return layer;
  }

  function setRetrySyncVisible(show) {
    var btn = document.getElementById("retrySyncBtn");
    if (btn) btn.hidden = !show;
  }

  function setDocEditorReady() {
    document.body.classList.add("lk-doc-ready");
    var loading = document.getElementById("docLoading");
    if (loading) loading.hidden = true;
  }

  function showDocLoadError(message, backHref) {
    var loading = document.getElementById("docLoading");
    if (!loading) return;
    loading.innerHTML =
      "<p>" +
      message +
      (backHref ? ' <a href="' + backHref + '">← Back to documents</a>' : "") +
      "</p>";
    loading.hidden = false;
  }

  function setSaveStatus(msg, state) {
    var el = document.getElementById("saveStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "lk-save-status is-" + (state || "idle");
    var needsRetry =
      state === "error" &&
      msg &&
      (msg.indexOf("not synced") >= 0 || msg.indexOf("Couldn") >= 0);
    setRetrySyncVisible(!!needsRetry);
  }

  function applyRestoredDocument(restored, statusMsg) {
    doc = restored;
    loading = true;
    loadHtmlIntoEditor(doc.bodyHtml || "");
    initFontPicker();
    loadPageSetupFields();
    updateWordCount();
    updatePageChrome();
    loading = false;
    applyDocFont();
    runPageLayoutSync();
    dirty = false;
    setSaveStatus(statusMsg || "Restored from history.", "saved");
    updateRestoreBackupUi();
    updateDocHistoryUi();
    if (global.LoreKeeperDocCollab) LoreKeeperDocCollab.bumpLoaded(doc);
    if (global.LoreKeeperMobileComfort && global.LoreKeeperMobileComfort.isMobile()) {
      if (global.LoreKeeperMobileComfort.initDocReadMode) {
        global.LoreKeeperMobileComfort.initDocReadMode(quill);
      }
    } else if (quill) {
      quill.focus();
    }
  }

  function restoreDocAtSnapshotIndex(index, whenLabel) {
    if (!doc || !global.LoreKeeperDocuments) return false;
    var when = whenLabel || "earlier";
    var hasText = !isEmptyHtml(doc.bodyHtml) || editorHasText();
    var msg = hasText
      ? "Replace what's on the page with the version from " + when + "?"
      : "Restore the version from " + when + "?";
    if (!confirm(msg)) return false;
    var restored = LoreKeeperDocuments.restoreSnapshot(doc, index);
    if (!restored) {
      setSaveStatus("Could not restore that version.", "error");
      return false;
    }
    applyRestoredDocument(restored);
    return true;
  }

  var mobileRestoreTimer = null;
  function scheduleMobileRestoreSync() {
    if (mobileRestoreTimer) clearTimeout(mobileRestoreTimer);
    mobileRestoreTimer = setTimeout(function () {
      mobileRestoreTimer = null;
      if (global.LoreKeeperMobileRestore && global.LoreKeeperMobileRestore.sync) {
        global.LoreKeeperMobileRestore.sync();
      }
    }, 400);
  }

  function syncMobileRestoreUi() {
    if (global.LoreKeeperMobileRestore && global.LoreKeeperMobileRestore.sync) {
      global.LoreKeeperMobileRestore.sync();
    }
  }

  function updateDocHistoryUi() {
    var list = document.getElementById("docHistoryList");
    var block = document.getElementById("docHistoryBlock");
    if (!list || !block || !doc || !global.LoreKeeperDocuments) return;
    list.innerHTML = "";
    var snaps = LoreKeeperDocuments.listSnapshots(doc.id) || [];
    if (!snaps.length) {
      var empty = document.createElement("li");
      empty.className = "muted";
      empty.textContent = "No earlier versions yet — they appear when you save real changes.";
      list.appendChild(empty);
      return;
    }
    snaps.forEach(function (snap, index) {
      if (!snap || isEmptyHtml(snap.bodyHtml)) return;
      var li = document.createElement("li");
      li.className = "lk-history-item";
      var when = LoreKeeperDocuments.formatWhen(snap.at) || "earlier";
      var label = document.createElement("span");
      label.textContent = when;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lk-btn secondary lk-history-restore";
      btn.textContent = "Restore";
      btn.addEventListener("click", function () {
        restoreDocAtSnapshotIndex(index, when);
      });
      li.appendChild(label);
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function hideStaleBanner() {
    var banner = document.getElementById("docStaleBanner");
    if (banner) banner.hidden = true;
  }

  function showStaleBanner() {
    var banner = document.getElementById("docStaleBanner");
    if (banner) banner.hidden = false;
  }

  function reloadDocFromServer() {
    if (!doc || !global.LoreKeeperDocuments || !global.LoreKeeperAccountStorage) return;
    LoreKeeperAccountStorage.refreshSession().then(function () {
      var fresh = LoreKeeperDocuments.find(doc.id);
      if (!fresh) return;
      doc = fresh;
      loading = true;
      loadHtmlIntoEditor(doc.bodyHtml || "");
      document.getElementById("docTitle").value = doc.title || "";
      document.getElementById("docWork").value = doc.workTag || "";
      initFontPicker();
      loadPageSetupFields();
      updateWordCount();
      updatePageChrome();
      loading = false;
      applyDocFont();
      runPageLayoutSync();
      dirty = false;
      hideStaleBanner();
      setSaveStatus("Reloaded latest from your account.", "saved");
      updateRestoreBackupUi();
      updateDocHistoryUi();
      if (global.LoreKeeperDocCollab) LoreKeeperDocCollab.markLoaded(doc);
    });
  }

  function initDocCollab() {
    var hint = document.getElementById("docCollabHint");
    if (hint && global.LoreKeeperDocCollab) {
      hint.textContent = LoreKeeperDocCollab.policyHint;
    }
    var reloadBtn = document.getElementById("docReloadRemoteBtn");
    var dismissBtn = document.getElementById("docDismissStaleBtn");
    if (reloadBtn) reloadBtn.addEventListener("click", reloadDocFromServer);
    if (dismissBtn) {
      dismissBtn.addEventListener("click", function () {
        hideStaleBanner();
        if (global.LoreKeeperDocCollab && doc) LoreKeeperDocCollab.bumpLoaded(doc);
      });
    }
    if (!global.LoreKeeperDocCollab) return;
    function pollRemote() {
      if (!doc || dirty || loading) return;
      LoreKeeperDocCollab.checkRemoteNewer(
        function () {
          return doc && doc.id;
        },
        function () {
          showStaleBanner();
        }
      );
    }
    global.document.addEventListener("visibilitychange", function () {
      if (global.document.visibilityState === "hidden") {
        parkSave();
      } else {
        pollRemote();
      }
    });
    global.setInterval(pollRemote, 45000);
  }

  function onEditorChange() {
    if (loading || !doc || !quill) return;
    if (global.LoreKeeperDocPageBoxes && LoreKeeperDocPageBoxes.isSyncing && LoreKeeperDocPageBoxes.isSyncing()) {
      return;
    }
    updateWordCount();
    if (syncingGaps) {
      gapResyncNeeded = true;
    } else {
      scheduleBlockPageGaps();
      // Do not refreshChrome/rebuild pages on every keystroke — that resets scroll to top.
    }
    queueSave();
    scheduleMobileRestoreSync();
  }

  function bindEditorInput() {
    if (!quill) return;
    if (quill.__lkChangeHandler) {
      quill.off("text-change", quill.__lkChangeHandler);
    }
    quill.__lkChangeHandler = function (_delta, _old, source) {
      if (source === "silent") return;
      onEditorChange();
    };
    quill.on("text-change", quill.__lkChangeHandler);
    var root = quill.root;
    if (root && !root.__lkKeyBound) {
      root.__lkKeyBound = true;
      root.addEventListener("keyup", onEditorChange);
      root.addEventListener("paste", function () {
        setTimeout(onEditorChange, 0);
      });
    }
  }

  function parkSave() {
    if (discardOnLeave || !doc || !quill || loading) return Promise.resolve();
    captureResumePosition();
    syncDocBodyFromEditor();
    syncPageSetup();
    syncDocMeta();
    LoreKeeperDocuments.save(doc);
    LoreKeeperDocuments.setLastDocId(doc.id);
    var flush = LoreKeeperAccountStorage.flush({ keepalive: true });
    if (flush && flush.then) {
      return flush.then(function (sent) {
        if (!sent) dirty = true;
        return sent;
      });
    }
    return Promise.resolve(flush);
  }

  function flushSave(force) {
    if (discardOnLeave || !doc) return;
    if (!force && !dirty) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (saveMaxTimer) {
      clearTimeout(saveMaxTimer);
      saveMaxTimer = null;
    }
    try {
      captureResumePosition();
      syncDocBodyFromEditor();
      syncPageSetup();
      syncDocMeta();
      setSaveStatus("Saving…", "saving");
      var ok = LoreKeeperDocuments.save(doc);
      if (!ok) {
        dirty = true;
        setSaveStatus("Couldn’t save", "error");
        return;
      }
      LoreKeeperDocuments.setLastDocId(doc.id);
      dirty = false;
      setSaveStatus("Saving to account…", "saving");
      var flushPromise = LoreKeeperAccountStorage.flush();
      if (flushPromise && flushPromise.then) {
        flushPromise.then(function (sent) {
          if (sent) {
            setSaveStatus("Saved", "saved");
            if (global.LoreKeeperDocCollab) LoreKeeperDocCollab.bumpLoaded(doc);
            if (global.LoreKeeperMobileHandoff && global.LoreKeeperMobileHandoff.afterDocSynced) {
              LoreKeeperMobileHandoff.afterDocSynced(currentBodyHtmlForBackup());
            }
          } else {
            dirty = true;
            setSaveStatus("Saved here — not synced to account yet", "error");
          }
          updateRestoreBackupUi();
          updateDocHistoryUi();
        });
      } else {
        setSaveStatus("Saved", "saved");
        updateRestoreBackupUi();
      }
    } catch (err) {
      dirty = true;
      setSaveStatus("Couldn’t save", "error");
    }
  }

  function scheduleSave() {
    markEdited();
  }

  function syncPageSetup() {
    var margins = document.getElementById("docMargins");
    var lineSpacing = document.getElementById("docLineSpacing");
    var header = document.getElementById("docHeader");
    var footer = document.getElementById("docFooter");
    var pageNums = document.getElementById("docPageNumbers");
    var fontSel = document.getElementById("docFont");
    doc.margins = (margins && margins.value) || doc.margins || "normal";
    doc.lineSpacing = (lineSpacing && lineSpacing.value) || doc.lineSpacing || "1.15";
    if (header) doc.headerText = header.value;
    if (footer) doc.footerText = footer.value;
    if (pageNums) doc.showPageNumbers = pageNums.checked;
    if (fontSel && fontSel.value) {
      doc.font = fontSel.value;
    } else if (!doc.font && global.LoreKeeperFontCatalog) {
      doc.font = LoreKeeperFontCatalog.defaultId;
    }
  }

  function syncDocFromEditor() {
    syncDocBodyFromEditor();
    syncPageSetup();
  }

  function isEmptyHtml(html) {
    var text = String(html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return !text;
  }

  function appendPlainBlockToDoc(plainText) {
    if (!doc || !quill) return { ok: false, error: "No document open." };
    var text = String(plainText || "").replace(/\r\n/g, "\n").trim();
    if (!text) return { ok: false, error: "Write something to append." };
    if (text.length > 400 && !confirm("Append about " + text.length + " characters to the bottom of this page?")) {
      return { ok: false, error: "" };
    }

    var wasDisabled = quill.isEnabled && !quill.isEnabled();
    if (wasDisabled) quill.enable();

    loading = true;
    var hadContent = !!quill.getText().trim();
    var index = Math.max(0, quill.getLength() - 1);
    if (hadContent) {
      quill.insertText(index, "\n\n", "user");
      index = Math.max(0, quill.getLength() - 1);
    }

    var escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    var paras = escaped.split(/\n\s*\n/).filter(function (p) {
      return p.length > 0;
    });
    if (!paras.length) paras = [escaped];
    var html = paras
      .map(function (p) {
        return "<p>" + p.split(/\n/).join("<br>") + "</p>";
      })
      .join("");
    quill.clipboard.dangerouslyPasteHTML(index, html, "user");

    if (wasDisabled) quill.disable();

    loading = false;
    syncDocBodyFromEditor();
    updateWordCount();
    scheduleBlockPageGaps();
    schedulePageChrome();
    dirty = true;
    queueSave();

    var root = quill.root;
    if (root && root.lastElementChild) {
      root.lastElementChild.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    return { ok: true };
  }

  function editorHasText() {
    if (global.LoreKeeperDocPageBoxes && LoreKeeperDocPageBoxes.getJoinedHtml) {
      return !isEmptyHtml(LoreKeeperDocPageBoxes.getJoinedHtml());
    }
    if (!quill) return false;
    return !!quill.getText().trim();
  }

  function stripAutoPadsFromHtml(html) {
    return String(html || "").replace(
      /<div[^>]*class="[^"]*lk-auto-page-gap[^"]*"[^>]*><\/div>/gi,
      ""
    );
  }

  function loadHtmlIntoEditor(html) {
    if (!quill) return;
    var saved = stripAutoPadsFromHtml(String(html || "").trim());
    if (global.LoreKeeperDocuments && global.LoreKeeperDocuments.normalizeBodyHtml) {
      saved = LoreKeeperDocuments.normalizeBodyHtml(saved);
    }
    if (global.LoreKeeperDocPageBoxes && LoreKeeperDocPageBoxes.loadFromBodyHtml) {
      LoreKeeperDocPageBoxes.loadFromBodyHtml(saved || "");
      return;
    }
    quill.setContents([]);
    if (!saved) return;
    if (saved.indexOf("<") === -1) {
      quill.setText(saved);
      return;
    }
    try {
      var delta = quill.clipboard.convert(saved);
      quill.setContents(delta, "silent");
    } catch (e) {
      quill.clipboard.dangerouslyPasteHTML(0, saved, "silent");
    }
    if (!editorHasText() && !isEmptyHtml(saved)) {
      quill.clipboard.dangerouslyPasteHTML(0, saved, "api");
    }
    if (!editorHasText() && !isEmptyHtml(saved)) {
      var plain = saved
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (plain) quill.setText(plain);
    }
  }

  function writeContext() {
    var workEl = document.getElementById("docWork");
    return {
      workTag: (doc && doc.workTag) || (workEl && workEl.value.trim()) || "",
      doc: doc,
    };
  }

  function attachWriteContext() {
    var fn = writeContext;
    if (quill) quill.__lkWriteContext = fn;
    var noteBody = document.getElementById("docNoteBody");
    if (noteBody) noteBody.__lkWriteContext = fn;
  }

  function syncDocMeta() {
    doc.title = document.getElementById("docTitle").value.trim() || doc.title;
    doc.workTag = document.getElementById("docWork").value.trim();
    var loreTerms = document.getElementById("docLoreTerms");
    if (loreTerms) doc.loreTermsEnabled = !!loreTerms.checked;
  }

  function applyDocFont() {
    if (!doc || !global.LoreKeeperFontCatalog) return;
    var fontId = doc.font || LoreKeeperFontCatalog.defaultId;
    var sel = document.getElementById("docFont");
    if (sel && sel.options.length && sel.value) {
      sel.value = LoreKeeperFontCatalog.pickerIdFor
        ? LoreKeeperFontCatalog.pickerIdFor(fontId)
        : fontId;
    }
    LoreKeeperFontCatalog.applyToElement(editorEl(), fontId);
    document.querySelectorAll(".lk-page-static, .lk-page-measure").forEach(function (node) {
      LoreKeeperFontCatalog.applyToElement(node, fontId);
    });
  }

  function applyPageLayout() {
    var sheet = document.getElementById("docSheet");
    if (!sheet || !doc) return;

    sheet.className =
      "lk-doc-sheet lk-margin-" + (doc.margins || "normal") + " lk-line-" + String(doc.lineSpacing || "1.15").replace(".", "");

    sheet.style.setProperty("--lk-page-h", PAGE_H + "px");
    sheet.style.setProperty("--lk-page-gap", PAGE_GAP + "px");
    var el = editorEl();
    if (el) {
      var m = marginPx();
      el.style.setProperty("--lk-margin-x", m + "px");
      el.style.setProperty("--lk-margin-y", m + "px");
      el.style.lineHeight = doc.lineSpacing || "1.15";
    }
    if (global.LoreKeeperDocPageBoxes) LoreKeeperDocPageBoxes.refreshChrome();
    else {
      scheduleBlockPageGaps();
      schedulePageChrome();
    }
  }

  function loadPageSetupFields() {
    document.getElementById("docMargins").value = doc.margins || "normal";
    document.getElementById("docLineSpacing").value = doc.lineSpacing || "1.15";
    document.getElementById("docHeader").value = doc.headerText || "";
    document.getElementById("docFooter").value = doc.footerText || "";
    document.getElementById("docPageNumbers").checked = doc.showPageNumbers !== false;
    var loreTerms = document.getElementById("docLoreTerms");
    if (loreTerms) loreTerms.checked = !!doc.loreTermsEnabled;
    applyPageLayout();
    applyDocFont();
  }

  function countWords() {
    var text = "";
    if (global.LoreKeeperDocPageBoxes && LoreKeeperDocPageBoxes.getJoinedHtml) {
      text = String(LoreKeeperDocPageBoxes.getJoinedHtml() || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\u00a0/g, " ")
        .trim();
    } else if (quill) {
      text = quill.getText().replace(/\u00a0/g, " ").trim();
    }
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }

  function updateWordCount() {
    var el = document.getElementById("wordCount");
    if (!el) return;
    var n = countWords();
    el.textContent = n + " word" + (n === 1 ? "" : "s");
  }

  function editorContentWords() {
    if (global.LoreKeeperDocPageBoxes && global.LoreKeeperDocPageBoxes.getJoinedHtml) {
      return String(LoreKeeperDocPageBoxes.getJoinedHtml() || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, "");
    }
    if (!quill) return "";
    var parts = [];
    var ops = quill.getContents().ops || [];
    for (var i = 0; i < ops.length; i++) {
      var ins = ops[i].insert;
      if (typeof ins === "string") parts.push(ins);
    }
    return parts.join("").replace(/\s+/g, "");
  }

  function scheduleBlockPageGaps() {
    if (global.LoreKeeperDocPageBoxes) LoreKeeperDocPageBoxes.scheduleReflow();
  }

  function runPageLayoutSync() {
    if (global.LoreKeeperDocPageBoxes) LoreKeeperDocPageBoxes.reflowNow();
  }

  function schedulePageChrome() {
    if (chromeTimer) clearTimeout(chromeTimer);
    chromeTimer = setTimeout(function () {
      if (global.LoreKeeperDocPageBoxes) LoreKeeperDocPageBoxes.refreshChrome();
    }, 60);
  }

  function updatePageChrome() {
    if (global.LoreKeeperDocPageBoxes) LoreKeeperDocPageBoxes.refreshChrome();
  }

  function currentBodyHtmlForBackup() {
    if (global.LoreKeeperDocPageBoxes && LoreKeeperDocPageBoxes.getJoinedHtml) {
      return stripAutoPadsFromHtml(LoreKeeperDocPageBoxes.getJoinedHtml());
    }
    if (!quill) return stripAutoPadsFromHtml(doc && doc.bodyHtml ? doc.bodyHtml : "");
    var root = quill.root.cloneNode(true);
    root.querySelectorAll(".lk-auto-page-gap").forEach(function (node) {
      node.remove();
    });
    return root.innerHTML;
  }

  function findRestorableBackup() {
    if (!doc || !global.LoreKeeperDocuments) return null;
    return LoreKeeperDocuments.restorableSnapshot(doc.id, currentBodyHtmlForBackup());
  }

  function normalizeBodyHtml(html) {
    if (global.LoreKeeperDocuments && global.LoreKeeperDocuments.normalizeBodyHtml) {
      return LoreKeeperDocuments.normalizeBodyHtml(html);
    }
    return String(html || "").trim();
  }

  function insertPageBreak() {
    if (!quill) return;
    if (global.LoreKeeperDocPageBoxes && LoreKeeperDocPageBoxes.insertPageBreak) {
      LoreKeeperDocPageBoxes.insertPageBreak();
    }
    syncDocFromEditor();
    scheduleSave();
    schedulePageChrome();
  }

  var fontPickerReady = false;

  function rebuildFontPickerOptions() {
    var sel = document.getElementById("docFont");
    if (!sel || !global.LoreKeeperFontCatalog) return;
    var searchEl = document.getElementById("docFontSearch");
    var query = searchEl ? searchEl.value : "";
    var wantId = LoreKeeperFontCatalog.pickerIdFor(
      (doc && doc.font) || LoreKeeperFontCatalog.defaultId
    );
    sel.innerHTML = "";
    var groups = LoreKeeperFontCatalog.pickerFontsGrouped
      ? LoreKeeperFontCatalog.pickerFontsGrouped(query)
      : [];
    var matched = false;
    if (groups.length) {
      groups.forEach(function (group) {
        var og = document.createElement("optgroup");
        og.label = group.label;
        group.fonts.forEach(function (font) {
          var opt = document.createElement("option");
          opt.value = font.id;
          opt.textContent = LoreKeeperFontCatalog.pickerDisplayName
            ? LoreKeeperFontCatalog.pickerDisplayName(font)
            : font.name;
          if (font.systemFallback && font.fallbackNote) {
            opt.title = font.fallbackNote;
            opt.setAttribute("data-system-fallback", "1");
          }
          opt.style.fontFamily = font.family;
          if (font.weight) opt.style.fontWeight = String(font.weight);
          og.appendChild(opt);
        });
        sel.appendChild(og);
      });
      matched = true;
    }
    if (!matched) {
      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "No fonts match";
      empty.disabled = true;
      sel.appendChild(empty);
      return;
    }
    var hasWant = false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === wantId) {
        hasWant = true;
        break;
      }
    }
    sel.value = hasWant ? wantId : sel.options[0].value;
  }

  function initFontPicker() {
    if (fontPickerReady) return;
    var sel = document.getElementById("docFont");
    if (!sel || !global.LoreKeeperFontCatalog) return;
    fontPickerReady = true;
    rebuildFontPickerOptions();
    var searchEl = document.getElementById("docFontSearch");
    if (searchEl) {
      searchEl.addEventListener("input", function () {
        rebuildFontPickerOptions();
      });
    }
    sel.addEventListener("change", function () {
      if (!sel.value) return;
      if (doc) doc.font = sel.value;
      applyDocFont();
      syncDocFromEditor();
      scheduleSave();
    });
  }

  function initQuill() {
    if (quill || !global.Quill) return;
    if (global.LoreKeeperSpell) global.LoreKeeperSpell.registerQuillSpellBlot();
    var host = document.getElementById("docEditor");
    var mount = document.getElementById("docQuillMount");
    if (host && !mount) {
      if (!document.getElementById("docPagesStack")) {
        var stack = document.createElement("div");
        stack.id = "docPagesStack";
        stack.className = "lk-pages-stack";
        host.appendChild(stack);
      }
      mount = document.createElement("div");
      mount.id = "docQuillMount";
      host.appendChild(mount);
    }
    if (!mount) return;
    quill = new global.Quill("#docQuillMount", {
      theme: "snow",
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline"],
          [{ list: "ordered" }, { list: "bullet" }],
        ],
      },
      placeholder: "Pick up where you left off — messy is fine. Your words only.",
    });
    if (global.LoreKeeperDocPageBoxes && LoreKeeperDocPageBoxes.bind) {
      LoreKeeperDocPageBoxes.bind({
        quill: quill,
        getDoc: function () {
          return doc;
        },
        onAfterReflow: function () {
          updateWordCount();
        },
      });
    }
    bindEditorInput();
    bindResumeCapture();
    if (doc) applyDocFont();
    if (global.LoreKeeperMobileComfort && global.LoreKeeperMobileComfort.initDocPage) {
      global.LoreKeeperMobileComfort.initDocPage(quill);
    }
    global.LoreKeeperSpell.ready.then(function () {
      if (!quill) return;
      spellCtl = global.LoreKeeperSpell.bindQuill(quill, document.getElementById("docSpellFlags"));
      if (global.LoreKeeperDocLongPress && global.LoreKeeperDocLongPress.bind) {
        global.LoreKeeperDocLongPress.bind(quill);
      }
      if (global.LoreKeeperDocTypoJump && global.LoreKeeperDocTypoJump.init) {
        global.LoreKeeperDocTypoJump.init(quill);
      }
      if (global.LoreKeeperDocLoreBrief && global.LoreKeeperDocLoreBrief.init) {
        global.LoreKeeperDocLoreBrief.init(
          function () {
            return doc;
          },
          parkSave
        );
      }
      attachWriteContext();
    });
  }

  function loadDocContentIntoEditor(html) {
    loadHtmlIntoEditor(html);
  }

  function loadDocIntoEditor() {
    loading = true;
    var html = doc.bodyHtml || "";
    // Clear "Loading…" before heavy Quill paste / pagination so the UI never looks stuck.
    global.requestAnimationFrame(function () {
      setDocEditorReady();
    });
    try {
      if (global.LoreKeeperDocuments && global.LoreKeeperDocuments.normalizeBodyHtml) {
        html = LoreKeeperDocuments.normalizeBodyHtml(html);
        doc.bodyHtml = html;
      }
      loadDocContentIntoEditor(html);
      initFontPicker();
      loadPageSetupFields();
      updateWordCount();
      applyDocFont();
    } catch (e) {
      console.error("LoreKeeper: document load failed", e);
    }
    global.requestAnimationFrame(function () {
      loading = false;
      bindEditorInput();
      bindResumeCapture();
      setSaveStatus("Up to date", "idle");
      setDocEditorReady();
      updateRestoreBackupUi();
      updateDocHistoryUi();
      attachWriteContext();
      if (global.LoreKeeperDocPageBoxes && LoreKeeperDocPageBoxes.schedulePaginateAfterReady) {
        LoreKeeperDocPageBoxes.schedulePaginateAfterReady();
      }
      global.requestAnimationFrame(function () {
        try {
          restoreResumePosition();
        } catch (e2) {
          /* ignore */
        }
      });
    });
  }

  function updateRestoreBackupUi() {
    if (loading) return;
    var block = document.getElementById("docBackupBlock");
    var hint = document.getElementById("docBackupHint");
    var btn = document.getElementById("restoreBackupBtn");
    if (!block || !hint || !btn) return;
    block.hidden = true;
    hint.textContent = "";
    if (!doc || !global.LoreKeeperDocuments) return;

    try {
      var restorable = findRestorableBackup();
      if (!restorable || !restorable.snap || isEmptyHtml(restorable.snap.bodyHtml)) return;

      var snap = restorable.snap;
      var when = LoreKeeperDocuments.formatWhen(snap.at) || "an earlier save";
      hint.textContent = "Older version from " + when + ".";
      block.hidden = false;
      btn.disabled = false;
    } catch (e) {
      block.hidden = true;
      hint.textContent = "";
    }
    syncMobileRestoreUi();
  }

  function restoreFromBackup() {
    if (!doc || !global.LoreKeeperDocuments) return;
    var restorable = findRestorableBackup();
    if (!restorable || !restorable.snap || isEmptyHtml(restorable.snap.bodyHtml)) {
      setSaveStatus("No older backup found for this document.", "error");
      updateRestoreBackupUi();
      return;
    }
    var snap = restorable.snap;
    var when = LoreKeeperDocuments.formatWhen(snap.at) || "earlier";
    if (
      global.LoreKeeperMobileComfort &&
      global.LoreKeeperMobileComfort.isMobile() &&
      LoreKeeperDocuments.formatWhenRelative
    ) {
      when = LoreKeeperDocuments.formatWhenRelative(snap.at) || when;
    }
    restoreDocAtSnapshotIndex(restorable.index, when);
  }

  function initDocSidebarShell(getDoc) {
    var layout = document.getElementById("docLayout");
    var shell = document.getElementById("docSidebarShell");
    var toggle = document.getElementById("docSidebarToggle");
    var tabSettings = document.getElementById("docSidebarTabSettings");
    var tabNote = document.getElementById("docSidebarTabNote");
    var tabAsk = document.getElementById("docSidebarTabAsk");
    var tabNotes = document.getElementById("docSidebarTabNotes");
    var notePanel = document.getElementById("docQuickNotePanel");
    var askPanel = document.getElementById("docAskPanel");
    var notesPanel = document.getElementById("docNotesPanel");
    if (!layout || !shell || !toggle) return;

    var SIDEBAR_OPEN_KEY = "lk-doc-sidebar-open";
    var SIDEBAR_TAB_KEY = "lk-doc-sidebar-tab";

    function setOpen(open) {
      layout.classList.toggle("is-sidebar-collapsed", !open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Hide sidebar" : "Show sidebar");
      toggle.title = open ? "Hide sidebar" : "Show sidebar";
      var icon = toggle.querySelector(".lk-doc-sidebar-rail-icon");
      if (icon) icon.textContent = open ? "‹" : "›";
      global.dispatchEvent(new Event("resize"));
    }

    function setTab(tab) {
      var isSettings = tab === "settings";
      var isNote = tab === "note";
      var isAsk = tab === "ask";
      var isNotes = tab === "notes";
      shell.classList.toggle("is-sidebar-tab-settings", isSettings);
      shell.classList.toggle("is-sidebar-tab-note", isNote);
      shell.classList.toggle("is-sidebar-tab-ask", isAsk);
      shell.classList.toggle("is-sidebar-tab-notes", isNotes);
      if (tabSettings) {
        tabSettings.classList.toggle("is-active", isSettings);
        tabSettings.setAttribute("aria-selected", isSettings ? "true" : "false");
      }
      if (tabNote) {
        tabNote.classList.toggle("is-active", isNote);
        tabNote.setAttribute("aria-selected", isNote ? "true" : "false");
      }
      if (tabAsk) {
        tabAsk.classList.toggle("is-active", isAsk);
        tabAsk.setAttribute("aria-selected", isAsk ? "true" : "false");
      }
      if (tabNotes) {
        tabNotes.classList.toggle("is-active", isNotes);
        tabNotes.setAttribute("aria-selected", isNotes ? "true" : "false");
      }
      if (notePanel) notePanel.hidden = !isNote;
      if (askPanel) askPanel.hidden = !isAsk;
      if (notesPanel) notesPanel.hidden = !isNotes;
      if (isNote) {
        setOpen(true);
        if (global.LoreKeeperDocQuickNote && global.LoreKeeperDocQuickNote.syncWorkTitle) {
          global.LoreKeeperDocQuickNote.syncWorkTitle();
        }
      }
      if (isAsk) {
        setOpen(true);
      }
      if (isNotes) {
        setOpen(true);
        if (global.LoreKeeperDocNotesList && global.LoreKeeperDocNotesList.refresh) {
          global.LoreKeeperDocNotesList.refresh();
        }
      }
      try {
        localStorage.setItem(SIDEBAR_TAB_KEY, tab);
      } catch (e) {}
    }

    var storedOpen;
    try {
      storedOpen = localStorage.getItem(SIDEBAR_OPEN_KEY);
    } catch (e) {}
    setOpen(storedOpen !== "0");

    var storedTab;
    try {
      storedTab = localStorage.getItem(SIDEBAR_TAB_KEY);
    } catch (e) {}
    if (storedTab === "note") {
      setTab("note");
    } else if (storedTab === "ask") {
      setTab("ask");
    } else if (storedTab === "notes") {
      setTab("notes");
    } else {
      setTab("settings");
    }

    toggle.addEventListener("click", function () {
      var nextOpen = layout.classList.contains("is-sidebar-collapsed");
      setOpen(nextOpen);
      try {
        localStorage.setItem(SIDEBAR_OPEN_KEY, nextOpen ? "1" : "0");
      } catch (e) {}
    });

    if (tabSettings) {
      tabSettings.addEventListener("click", function () {
        setTab("settings");
      });
    }
    if (tabNote) {
      tabNote.addEventListener("click", function () {
        setTab("note");
      });
    }
    if (tabAsk) {
      tabAsk.addEventListener("click", function () {
        setTab("ask");
      });
    }
    if (tabNotes) {
      tabNotes.addEventListener("click", function () {
        setTab("notes");
      });
    }

    if (global.initDocQuickNote) {
      global.initDocQuickNote(getDoc);
    }
    if (global.LoreKeeperDocAsk && global.LoreKeeperDocAsk.initDocAsk) {
      global.LoreKeeperDocAsk.initDocAsk(getDoc, parkSave);
    }
    if (global.initDocNotesList) {
      global.initDocNotesList(getDoc);
    }
    if (global.LoreKeeperDocUpdateNudge && global.LoreKeeperDocUpdateNudge.init) {
      global.LoreKeeperDocUpdateNudge.init();
    }

    global.LoreKeeperDocSidebar = {
      setTab: setTab,
      setOpen: setOpen,
    };
  }

  function bindMeta() {
    ["docTitle", "docWork", "docHeader", "docFooter"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", function () {
        syncDocMeta();
        syncPageSetup();
        schedulePageChrome();
        if (id === "docWork" && global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.refreshChips) {
          global.LoreKeeperMobileAccessory.refreshChips();
        }
        scheduleSave();
      });
    });
    ["docMargins", "docLineSpacing", "docPageNumbers", "docLoreTerms"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", function () {
        syncPageSetup();
        if (id === "docLoreTerms") syncDocMeta();
        applyPageLayout();
        if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.refreshChips) {
          global.LoreKeeperMobileAccessory.refreshChips();
        }
        scheduleSave();
      });
    });
    document.getElementById("insertPageBreakBtn").addEventListener("click", insertPageBreak);
    global.addEventListener("resize", schedulePageChrome);
    global.addEventListener("pagehide", parkSave);
    global.addEventListener("visibilitychange", function () {
      if (global.document.visibilityState === "hidden") parkSave();
    });
    global.addEventListener("beforeunload", function () {
      if (!doc || !quill) return;
      loading = false;
      parkSave();
    });
    global.addEventListener("lorekeeper-keyboard-save", function () {
      flushSave(true);
    });
  }

  document.getElementById("deleteDocBtn").addEventListener("click", function () {
    if (!doc || !doc.id) return;
    if (!confirm("Delete this whole document?")) return;
    var idToDelete = doc.id;
    discardOnLeave = true;
    dirty = false;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (saveMaxTimer) {
      clearTimeout(saveMaxTimer);
      saveMaxTimer = null;
    }
    doc = null;
    LoreKeeperDocuments.delete(idToDelete);
    function goHome() {
      global.location.href = "./index.html";
    }
    var flush = LoreKeeperAccountStorage.flush({ keepalive: true });
    if (flush && flush.then) {
      var navigated = false;
      function leaveOnce() {
        if (navigated) return;
        navigated = true;
        goHome();
      }
      // Second flush covers an older in-flight save that finished after delete.
      flush
        .then(function () {
          return LoreKeeperAccountStorage.flush({ keepalive: true });
        })
        .then(leaveOnce, leaveOnce);
      global.setTimeout(leaveOnce, 2500);
    } else {
      goHome();
    }
  });
  document.getElementById("restoreBackupBtn").addEventListener("click", restoreFromBackup);
  var retrySyncBtn = document.getElementById("retrySyncBtn");
  if (retrySyncBtn) {
    retrySyncBtn.addEventListener("click", function () {
      flushSave(true);
    });
  }
  initDocSidebarShell(function () {
    return doc;
  });

  Promise.all([
    LoreKeeperDocuments.ready,
    LoreKeeperAccountStorage.waitForData
      ? LoreKeeperAccountStorage.waitForData({ content: true })
      : LoreKeeperDocuments.ready,
  ]).then(function () {
    if (!LoreKeeperAccountStorage.isSignedIn()) {
      LoreKeeperAccountStorage.ensureSignedIn();
      return;
    }
    var id = docIdFromUrl();
    var raw = LoreKeeperDocuments.load().filter(function (d) {
      return d.id === id;
    })[0];
    if (!raw) {
      showDocLoadError("That document wasn’t found.", "./index.html");
      global.setTimeout(function () {
        global.location.href = "./index.html";
      }, 2800);
      return;
    }
    var wasLegacy = raw.bodyFormat !== "html" || (raw.pages && raw.pages.length);
    doc = LoreKeeperDocuments.migrateToFlow(raw);
    doc = LoreKeeperDocuments.pageDefaults(doc);
    if (LoreKeeperDocuments.normalizeBodyHtml) {
      doc.bodyHtml = LoreKeeperDocuments.normalizeBodyHtml(doc.bodyHtml);
    }
    if (isEmptyHtml(doc.bodyHtml)) {
      var snap = LoreKeeperDocuments.latestSnapshot(doc.id);
      if (snap && !isEmptyHtml(snap.bodyHtml)) {
        doc.bodyHtml = snap.bodyHtml;
        doc.bodyHtmlBackup = snap.bodyHtml;
        doc.bodyHtmlBackupAt = snap.at || Date.now();
      }
    }
    if (doc.bodyHtmlBackup && isEmptyHtml(doc.bodyHtml) && !isEmptyHtml(doc.bodyHtmlBackup)) {
      doc.bodyHtml = doc.bodyHtmlBackup;
    }
    if (wasLegacy && !isEmptyHtml(doc.bodyHtml)) {
      LoreKeeperDocuments.save(doc);
      LoreKeeperAccountStorage.flush();
    }
    LoreKeeperDocuments.setLastDocId(doc.id);
    document.getElementById("docTitle").value = doc.title || "";
    document.getElementById("docWork").value = doc.workTag || "";
    if (!quill) initQuill();
    if (!quill) {
      showDocLoadError("Editor didn’t load — try a hard refresh.", "./index.html");
      return;
    }
    loadDocIntoEditor();
    bindMeta();
    if (global.LoreKeeperDocCollab) LoreKeeperDocCollab.markLoaded(doc);
    initDocCollab();
    updateDocHistoryUi();
    if (global.LoreKeeperSiteFeedback) {
      global.LoreKeeperSiteFeedback.init({
        sendBtnId: "docFeedbackSend",
        textId: "docFeedbackText",
        statusId: "docFeedbackStatus",
        source: "documents",
        metaFn: function () {
          return { docId: doc && doc.id, docTitle: doc && doc.title };
        },
      });
    }
  });
  global.LoreKeeperDocRestore = {
    getDocId: function () {
      return doc && doc.id;
    },
    getCurrentHtml: function () {
      return currentBodyHtmlForBackup();
    },
    restoreAtIndex: restoreDocAtSnapshotIndex,
  };
  global.LoreKeeperDocEditor = {
    appendPlainBlock: appendPlainBlockToDoc,
  };
})(typeof window !== "undefined" ? window : this);
