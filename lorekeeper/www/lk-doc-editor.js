(function (global) {
  var PAGE_H = 1056;
  var PAGE_GAP = 14;
  var PAGE_LINE_BUFFER = 28;
  var PAD_OVERSHOOT = 6;
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
      quill.setSelection(index, 0, "user");
      quill.focus();
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

  function syncDocBodyFromEditor() {
    if (!doc || !quill || loading) return;
    if (global.LoreKeeperSpell && global.LoreKeeperSpell.clearQuillSpellMarks) {
      global.LoreKeeperSpell.clearQuillSpellMarks(quill);
    }
    var wordsBefore = editorContentWords();
    var root = quill.root.cloneNode(true);
    root.querySelectorAll(".lk-auto-page-gap").forEach(function (node) {
      node.remove();
    });
    root.querySelectorAll(".lk-page-pushed").forEach(function (node) {
      node.classList.remove("lk-page-pushed");
      node.style.marginTop = "";
    });
    mergeContinuationsInDom(root);
    var nextHtml = root.innerHTML;
    if (isEmptyHtml(nextHtml) && !isEmptyHtml(doc.bodyHtml)) return;
    var wordsAfter = String(nextHtml || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, "");
    // Refuse a save that would drop prose from a layout/merge glitch.
    if (wordsBefore && wordsAfter.length < wordsBefore.length) return;
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
    return document.querySelector("#docEditor .ql-editor");
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
    syncBlockPageGaps();
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
      syncBlockPageGaps();
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
    updateWordCount();
    if (syncingGaps) {
      gapResyncNeeded = true;
    } else {
      scheduleBlockPageGaps();
      schedulePageChrome();
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
  }

  function applyPageLayout() {
    var sheet = document.getElementById("docSheet");
    var el = editorEl();
    if (!sheet || !el) return;

    sheet.className =
      "lk-doc-sheet lk-margin-" + (doc.margins || "normal") + " lk-line-" + String(doc.lineSpacing || "1.15").replace(".", "");

    var m = marginPx();
    sheet.style.setProperty("--lk-page-h", PAGE_H + "px");
    sheet.style.setProperty("--lk-page-gap", PAGE_GAP + "px");
    el.style.setProperty("--lk-margin-x", m + "px");
    el.style.setProperty("--lk-margin-y", m + "px");
    el.style.lineHeight = doc.lineSpacing || "1.15";

    scheduleBlockPageGaps();
    schedulePageChrome();
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
    if (!quill) return 0;
    var text = quill.getText().replace(/\u00a0/g, " ").trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }

  function updateWordCount() {
    var el = document.getElementById("wordCount");
    if (!el) return;
    var n = countWords();
    el.textContent = n + " word" + (n === 1 ? "" : "s");
  }

  function schedulePageChrome() {
    if (chromeTimer) clearTimeout(chromeTimer);
    chromeTimer = setTimeout(updatePageChrome, 60);
  }

  function isManualPageBreak(node) {
    return node && node.classList && node.classList.contains("lk-page-break");
  }

  function isPagePad(node) {
    return node && node.classList && node.classList.contains("lk-auto-page-gap");
  }

  /** Prose only — skips page-pad / page-break embeds so layout sync cannot “lose” words. */
  function editorContentWords() {
    if (!quill) return "";
    var parts = [];
    var ops = quill.getContents().ops || [];
    for (var i = 0; i < ops.length; i++) {
      var ins = ops[i].insert;
      if (typeof ins === "string") parts.push(ins);
    }
    return parts.join("").replace(/\s+/g, "");
  }

  function clearPagePushes() {
    var el = editorEl();
    if (!el) return;
    el.querySelectorAll(".lk-page-pushed").forEach(function (node) {
      node.classList.remove("lk-page-pushed");
      node.style.marginTop = "";
    });
  }

  function applyPagePush(node, el, m, unit, pageH) {
    if (!node || !el) return;
    var top = blockBorderTop(node, el);
    var push = padToNextContentStart(top, m, unit, pageH);
    node.classList.add("lk-page-pushed");
    node.style.marginTop = push + "px";
  }

  function removePagePads() {
    if (!quill) return;
    var el = editorEl();
    if (!el) return;
    var nodes = el.querySelectorAll(".lk-auto-page-gap");
    for (var i = nodes.length - 1; i >= 0; i--) {
      var blot = global.Quill.find(nodes[i]);
      if (blot) blot.remove();
      else nodes[i].remove();
    }
  }

  function insertPagePadBefore(node, height) {
    if (!quill || !node || height <= 0) return;
    var blot = global.Quill.find(node);
    if (!blot) return;
    var index = quill.getIndex(blot);
    quill.insertEmbed(index, "pagePad", Math.ceil(height), "silent");
  }

  function pageIndexForY(y, unit, pageH) {
    if (y < pageH) return 0;
    return 1 + Math.floor((y - unit) / unit);
  }

  function whiteStartForPage(pageIdx, unit) {
    return pageIdx === 0 ? 0 : unit * pageIdx;
  }

  function padToNextContentStart(y, m, unit, pageH) {
    var pageIdx = pageIndexForY(y, unit, pageH);
    var whiteStart = whiteStartForPage(pageIdx, unit);
    var contentEnd = whiteStart + pageH - m - PAGE_LINE_BUFFER;
    var greyStart = whiteStart + pageH;
    var nextIdx = pageIdx;
    if (y >= greyStart - 1 || y > contentEnd) nextIdx = pageIdx + 1;
    var target = whiteStartForPage(nextIdx, unit) + (nextIdx === 0 ? m : 0);
    if (target <= y) {
      nextIdx += 1;
      target = whiteStartForPage(nextIdx, unit) + (nextIdx === 0 ? m : 0);
    }
    return Math.max(1, Math.ceil(target - y + PAD_OVERSHOOT));
  }

  function blockNeedsPagePush(blockTop, blockPage) {
    return blockTop > blockPage.contentEnd + 1 || blockTop >= blockPage.greyStart - 1;
  }

  function pushNodeToNextContentStart(node, el, m, unit, pageH) {
    if (!node) return;
    var top = blockBorderTop(node, el);
    var padH = padToNextContentStart(top, m, unit, pageH);
    if (padH > 0) insertPagePadBefore(node, padH);
  }

  function mergeContinuationsInDom(root) {
    if (!root) return;
    var kids = Array.from(root.children);
    for (var i = 1; i < kids.length; i++) {
      var node = kids[i];
      if (!node.classList || !node.classList.contains("lk-auto-continued")) continue;
      var prev = kids[i - 1];
      if (!prev || (prev.classList && prev.classList.contains("lk-auto-page-gap"))) continue;
      prev.innerHTML = prev.innerHTML + node.innerHTML;
      node.remove();
      kids = Array.from(root.children);
      i = Math.max(0, i - 1);
    }
    root.querySelectorAll(".lk-auto-continued").forEach(function (node) {
      node.classList.remove("lk-auto-continued");
    });
  }

  function mergeAutoContinuations() {
    if (!quill) return;
    var el = editorEl();
    if (!el) return;
    var node = el.firstElementChild;
    while (node) {
      var next = node.nextElementSibling;
      while (next && isPagePad(next)) next = next.nextElementSibling;
      if (!next) break;
      if (next.classList && next.classList.contains("lk-auto-continued")) {
        var nextBlot = global.Quill.find(next);
        if (nextBlot) {
          var joinIndex = quill.getIndex(nextBlot);
          if (joinIndex > 0) {
            var joinChar = quill.getText(joinIndex - 1, 1);
            // Only remove the paragraph break — never a real letter.
            if (joinChar === "\n") {
              quill.deleteText(joinIndex - 1, 1, "silent");
            }
          }
        }
        next = node.nextElementSibling;
        while (next && isPagePad(next)) next = next.nextElementSibling;
        continue;
      }
      node = next;
    }
    el.querySelectorAll(".lk-auto-continued").forEach(function (n) {
      n.classList.remove("lk-auto-continued");
    });
  }

  function setRangeAtOffset(container, range, offset) {
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    var node;
    var count = 0;
    while ((node = walker.nextNode())) {
      var len = node.length;
      if (count + len > offset) {
        range.setStart(node, offset - count);
        range.setEnd(node, Math.min(offset - count + 1, len));
        return true;
      }
      count += len;
    }
    return false;
  }

  function charOffsetForLineTop(block, range, screenTop) {
    var text = block.textContent || "";
    if (!text.length) return 0;
    var lo = 0;
    var hi = text.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (!setRangeAtOffset(block, range, mid)) {
        lo = mid + 1;
        continue;
      }
      var rects = range.getClientRects();
      if (!rects.length) {
        lo = mid + 1;
        continue;
      }
      if (rects[0].top < screenTop - 0.5) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function getBlockLines(block, el) {
    var lines = [];
    var er = el.getBoundingClientRect();
    var range = document.createRange();
    range.selectNodeContents(block);
    var rects = Array.prototype.slice.call(range.getClientRects());

    if (!rects.length) {
      var blockTop = blockBorderTop(block, el);
      var h = block.offsetHeight || 0;
      if (h) lines.push({ offset: 0, top: blockTop, bottom: blockTop + h });
      return lines;
    }

    var groups = [];
    for (var r = 0; r < rects.length; r++) {
      var rect = rects[r];
      if (rect.width < 0.5 && rect.height < 0.5) continue;
      var top = rect.top - er.top;
      var bottom = rect.bottom - er.top;
      var found = false;
      for (var g = 0; g < groups.length; g++) {
        if (Math.abs(groups[g].screenTop - rect.top) < 2) {
          groups[g].bottom = Math.max(groups[g].bottom, bottom);
          found = true;
          break;
        }
      }
      if (!found) groups.push({ screenTop: rect.top, top: top, bottom: bottom });
    }
    groups.sort(function (a, b) {
      return a.top - b.top;
    });

    for (var i = 0; i < groups.length; i++) {
      var offset = charOffsetForLineTop(block, range, groups[i].screenTop + 0.5);
      lines.push({ offset: offset, top: groups[i].top, bottom: groups[i].bottom });
    }
    return lines;
  }

  function isSplittableBlock(block) {
    if (!block || !block.tagName) return false;
    var tag = block.tagName.toUpperCase();
    return tag === "P" || tag === "H1" || tag === "H2" || tag === "H3";
  }

  function snapToWordStart(text, offset) {
    if (offset <= 0 || offset >= text.length) return offset;
    if (/\s/.test(text.charAt(offset))) return offset;
    if (offset > 0 && /\s/.test(text.charAt(offset - 1))) return offset;
    var i = offset;
    while (i > 0 && !/\s/.test(text.charAt(i - 1))) i--;
    return i > 0 ? i : offset;
  }

  function splitBlockAt(block, charOffset) {
    if (!isSplittableBlock(block)) return null;
    var text = block.textContent || "";
    charOffset = snapToWordStart(text, charOffset);
    if (charOffset <= 0 || charOffset >= text.length) return null;
    var blot = global.Quill.find(block);
    if (!blot) return null;
    var index = quill.getIndex(blot) + charOffset;
    quill.insertText(index, "\n", "silent");
    var next = block.nextElementSibling;
    while (next && isPagePad(next)) next = next.nextElementSibling;
    if (next && isSplittableBlock(next)) next.classList.add("lk-auto-continued");
    return next;
  }

  function blockBorderTop(block, el) {
    return block.getBoundingClientRect().top - el.getBoundingClientRect().top;
  }

  function pageMetricsForY(y, m, unit, pageH) {
    var pageIdx = pageIndexForY(y, unit, pageH);
    var whiteStart = whiteStartForPage(pageIdx, unit);
    return {
      pageIdx: pageIdx,
      contentEnd: whiteStart + pageH - m - PAGE_LINE_BUFFER,
      greyStart: whiteStart + pageH,
      contentStart: whiteStart + (pageIdx === 0 ? m : 0),
    };
  }

  function lineOverflowsPage(line, m, unit, pageH) {
    var page = pageMetricsForY(line.top, m, unit, pageH);
    return line.bottom > page.contentEnd + 1 || line.top > page.contentEnd + 1 || line.top >= page.greyStart;
  }

  function padTailAfterSplit(tail, el, m, unit, pageH) {
    if (!tail) return;
    var tailTop = blockBorderTop(tail, el);
    var tailPage = pageMetricsForY(tailTop, m, unit, pageH);
    if (blockNeedsPagePush(tailTop, tailPage)) {
      insertPagePadBefore(tail, padToNextContentStart(tailTop, m, unit, pageH));
    }
  }

  /** Line-aware pagination: split at line boundaries, gap spacers push overflow to next sheet. */
  function syncBlockPageGaps() {
    if (loading || syncingGaps || !quill) return;
    var el = editorEl();
    if (!el) return;

    syncingGaps = true;
    var wordsBefore = editorContentWords();
    var restoreDelta = quill.getContents();
    var aborted = false;

    removePagePads();
    clearPagePushes();
    mergeAutoContinuations();

    if (editorContentWords() !== wordsBefore) {
      quill.setContents(restoreDelta, "silent");
      aborted = true;
    } else {
      var metrics = pageMetrics();
      var pageH = metrics.pageH;
      var gap = metrics.gap;
      var unit = pageH + gap;
      var m = marginPx();
      var changed = true;
      var rounds = 0;

      while (changed && rounds < 12) {
        changed = false;
        rounds += 1;

        for (var i = 0; i < el.children.length; i++) {
          var block = el.children[i];
          if (isPagePad(block) || isManualPageBreak(block)) continue;

          var blockTop = blockBorderTop(block, el);
          var blockH = block.offsetHeight || 0;
          if (!blockH) continue;

          var blockPage = pageMetricsForY(blockTop, m, unit, pageH);

          if (blockNeedsPagePush(blockTop, blockPage)) {
            insertPagePadBefore(block, padToNextContentStart(blockTop, m, unit, pageH));
            changed = true;
            break;
          }

          if (!isSplittableBlock(block)) {
            if (blockTop + blockH > blockPage.contentEnd + 1) {
              pushNodeToNextContentStart(block, el, m, unit, pageH);
              changed = true;
              break;
            }
            continue;
          }

          var lines = getBlockLines(block, el);
          if (!lines.length) continue;

          var hit = -1;
          for (var L = 0; L < lines.length; L++) {
            if (lineOverflowsPage(lines[L], m, unit, pageH)) {
              hit = L;
              break;
            }
          }
          if (hit < 0) continue;

          var line = lines[hit];
          if (hit === 0 && line.offset <= 0) {
            pushNodeToNextContentStart(block, el, m, unit, pageH);
            changed = true;
            break;
          }

          if (line.offset > 0) {
            var tail = splitBlockAt(block, line.offset);
            padTailAfterSplit(tail, el, m, unit, pageH);
          } else {
            pushNodeToNextContentStart(block, el, m, unit, pageH);
          }
          changed = true;
          break;
        }
      }

      if (editorContentWords() !== wordsBefore) {
        quill.setContents(restoreDelta, "silent");
        aborted = true;
        gapResyncNeeded = false;
      }
    }

    syncingGaps = false;
    updatePageChrome();
    if (!aborted && gapResyncNeeded) {
      gapResyncNeeded = false;
      scheduleBlockPageGaps();
    } else if (aborted) {
      gapResyncNeeded = false;
    }
  }

  function scheduleBlockPageGaps() {
    if (gapTimer) clearTimeout(gapTimer);
    gapTimer = setTimeout(runPageLayoutSync, 32);
  }

  function runPageLayoutSync() {
    if (!quill || loading) return;
    syncBlockPageGaps();
    global.requestAnimationFrame(function () {
      if (!quill || loading) return;
      syncBlockPageGaps();
    });
  }

  function currentBodyHtmlForBackup() {
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

  function updatePageChrome() {
    var el = editorEl();
    if (!el) return;
    var metrics = pageMetrics();
    var pageH = metrics.pageH;
    var gap = metrics.gap;
    var unit = pageH + gap;
    var pages = Math.max(1, Math.ceil((el.scrollHeight + gap) / unit));
    var minH = Math.max(pageH, pages * pageH + Math.max(0, pages - 1) * gap, el.scrollHeight);
    el.style.minHeight = minH + "px";
    el.style.setProperty("--lk-page-gap", gap + "px");

    var cover = ensureGapCover();
    if (cover) {
      cover.style.height = minH + "px";
      cover.innerHTML = "";
      for (var g = 0; g < pages - 1; g++) {
        var strip = document.createElement("div");
        strip.className = "lk-page-gap-cover";
        strip.style.top = Math.max(0, g * unit + pageH - 14) + "px";
        strip.style.height = gap + 28 + "px";
        cover.appendChild(strip);
      }
    }

    var layer = ensureChromeBack();
    if (!layer || !doc) return;

    layer.style.height = minH + "px";
    layer.innerHTML = "";

    var m = marginPx();
    var header = (doc.headerText || "").trim();
    var footer = (doc.footerText || "").trim();
    var numbers = doc.showPageNumbers !== false;

    for (var i = 0; i < pages; i++) {
      var pageTop = i * unit;
      if (header) {
        var head = document.createElement("div");
        head.className = "lk-page-chrome lk-page-chrome-header";
        head.style.top = pageTop + 28 + "px";
        head.style.left = m + "px";
        head.style.right = m + "px";
        head.textContent = header;
        layer.appendChild(head);
      }
      if (footer || numbers) {
        var foot = document.createElement("div");
        foot.className = "lk-page-chrome lk-page-chrome-footer";
        foot.style.top = pageTop + pageH - m + 8 + "px";
        foot.style.left = m + "px";
        foot.style.right = m + "px";
        var parts = [];
        if (footer) parts.push(footer);
        if (numbers) parts.push(String(i + 1));
        foot.textContent = parts.join(footer && numbers ? " · " : "");
        layer.appendChild(foot);
      }
    }
  }

  function registerPageBreakBlot() {
    try {
      var BlockEmbed = global.Quill.import("blots/block/embed");

      function PageBreakBlot(domNode) {
        BlockEmbed.call(this, domNode);
      }
      PageBreakBlot.prototype = Object.create(BlockEmbed.prototype);
      PageBreakBlot.prototype.constructor = PageBreakBlot;
      PageBreakBlot.create = function () {
        var node = global.document.createElement("div");
        node.classList.add("lk-page-break");
        node.setAttribute("contenteditable", "false");
        node.setAttribute("aria-label", "Page break");
        return node;
      };
      PageBreakBlot.blotName = "pageBreak";
      PageBreakBlot.tagName = "div";

      global.Quill.register(PageBreakBlot);
    } catch (e) {
      /* already registered */
    }
  }

  function registerPagePadBlot() {
    try {
      var BlockEmbed = global.Quill.import("blots/block/embed");

      function PagePadBlot(domNode) {
        BlockEmbed.call(this, domNode);
      }
      PagePadBlot.prototype = Object.create(BlockEmbed.prototype);
      PagePadBlot.prototype.constructor = PagePadBlot;
      PagePadBlot.create = function (value) {
        var h = typeof value === "number" ? value : parseFloat(value) || PAGE_GAP;
        var node = global.document.createElement("div");
        node.classList.add("lk-auto-page-gap");
        node.setAttribute("contenteditable", "false");
        node.setAttribute("aria-hidden", "true");
        node.style.height = Math.max(1, Math.ceil(h)) + "px";
        return node;
      };
      PagePadBlot.blotName = "pagePad";
      PagePadBlot.tagName = "div";

      global.Quill.register(PagePadBlot);
    } catch (e) {
      /* already registered */
    }
  }

  function insertPageBreak() {
    if (!quill) return;
    var range = quill.getSelection(true);
    var index = range ? range.index : quill.getLength();
    quill.insertEmbed(index, "pageBreak", true, "user");
    quill.insertText(index + 1, "\n", "user");
    quill.setSelection(index + 2, 0);
    syncDocFromEditor();
    scheduleSave();
    scheduleBlockPageGaps();
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
    registerPageBreakBlot();
    registerPagePadBlot();
    quill = new global.Quill("#docEditor", {
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
    bindEditorInput();
    bindResumeCapture();
    if (doc) applyDocFont();
    ensureChromeBack();
    ensureGapCover();
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
    if (!isEmptyHtml(html) && !editorHasText()) {
      loadHtmlIntoEditor(html);
    }
  }

  function loadDocIntoEditor() {
    loading = true;
    var html = doc.bodyHtml || "";
    if (global.LoreKeeperDocuments && global.LoreKeeperDocuments.normalizeBodyHtml) {
      html = LoreKeeperDocuments.normalizeBodyHtml(html);
      doc.bodyHtml = html;
    }
    loadDocContentIntoEditor(html);
    initFontPicker();
    loadPageSetupFields();
    updateWordCount();
    updatePageChrome();
    applyDocFont();
    global.requestAnimationFrame(function () {
      applyDocFont();
      if (!isEmptyHtml(html) && !editorHasText()) {
        loadDocContentIntoEditor(html);
        updateWordCount();
        updatePageChrome();
      }
      try {
        runPageLayoutSync();
      } catch (e) {
        /* layout-only; never block load */
      }
      loading = false;
      bindEditorInput();
      bindResumeCapture();
      global.requestAnimationFrame(function () {
        restoreResumePosition();
        setSaveStatus("Up to date", "idle");
        setDocEditorReady();
        updateRestoreBackupUi();
        updateDocHistoryUi();
        attachWriteContext();
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
