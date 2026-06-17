(function (global) {
  var PAGE_H = 1056;
  var PAGE_GAP = 24;
  var PAGE_UNIT = PAGE_H + PAGE_GAP;
  var MARGIN_PX = { narrow: 48, normal: 96, wide: 144 };

  var doc = null;
  var quill = null;
  var saveTimer = null;
  var chromeTimer = null;
  var dirty = false;
  var loading = false;
  var chromeOverlay = null;
  var decorLayer = null;

  function docIdFromUrl() {
    return new URLSearchParams(global.location.search).get("d") || "";
  }

  function editorEl() {
    return document.querySelector("#docEditor .ql-editor");
  }

  function marginPx() {
    return MARGIN_PX[doc.margins] || MARGIN_PX.normal;
  }

  function setSaveStatus(msg, ok) {
    var el = document.getElementById("saveStatus");
    el.textContent = msg || "";
    el.className = "lk-status lk-save-status" + (ok ? " ok" : "");
  }

  function flushSave(force) {
    if (!doc || loading) return;
    if (!force && !dirty) return;
    LoreKeeperDocuments.save(doc);
    LoreKeeperDocuments.setLastDocId(doc.id);
    LoreKeeperAccountStorage.flush();
    dirty = false;
    setSaveStatus("Saved", true);
  }

  function scheduleSave() {
    if (loading) return;
    dirty = true;
    setSaveStatus("Saving…");
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      flushSave(false);
    }, 500);
  }

  function syncPageSetup() {
    doc.margins = document.getElementById("docMargins").value || "normal";
    doc.lineSpacing = document.getElementById("docLineSpacing").value || "1.15";
    doc.headerText = document.getElementById("docHeader").value;
    doc.footerText = document.getElementById("docFooter").value;
    doc.showPageNumbers = document.getElementById("docPageNumbers").checked;
    doc.font = document.getElementById("docFont").value || LoreKeeperFontCatalog.defaultId;
  }

  function syncDocFromEditor() {
    if (!doc || !quill || loading) return;
    doc.bodyHtml = quill.root.innerHTML;
    doc.bodyFormat = "html";
    syncPageSetup();
  }

  function syncDocMeta() {
    doc.title = document.getElementById("docTitle").value.trim() || doc.title;
    doc.workTag = document.getElementById("docWork").value.trim();
  }

  function applyDocFont() {
    var fontId = doc.font || LoreKeeperFontCatalog.defaultId;
    document.getElementById("docFont").value = fontId;
    var el = editorEl();
    if (el) LoreKeeperFontCatalog.applyToElement(el, fontId);
  }

  function applyPageLayout() {
    var sheet = document.getElementById("docSheet");
    var el = editorEl();
    if (!sheet || !el) return;

    sheet.className =
      "lk-doc-sheet lk-margin-" + (doc.margins || "normal") + " lk-line-" + String(doc.lineSpacing || "1.15").replace(".", "");

    var m = marginPx();
    sheet.style.setProperty("--lk-page-h", PAGE_H + "px");
    sheet.style.setProperty("--lk-page-unit", PAGE_UNIT + "px");
    el.style.setProperty("--lk-margin-x", m + "px");
    el.style.setProperty("--lk-margin-y", m + "px");
    el.style.lineHeight = doc.lineSpacing || "1.15";
    el.style.background = "transparent";
    el.style.backgroundColor = "transparent";

    schedulePageChrome();
  }

  function loadPageSetupFields() {
    document.getElementById("docMargins").value = doc.margins || "normal";
    document.getElementById("docLineSpacing").value = doc.lineSpacing || "1.15";
    document.getElementById("docHeader").value = doc.headerText || "";
    document.getElementById("docFooter").value = doc.footerText || "";
    document.getElementById("docPageNumbers").checked = doc.showPageNumbers !== false;
    applyPageLayout();
    applyDocFont();
  }

  function countWords() {
    if (!quill) return 0;
    var text = quill.getText().trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }

  function updateWordCount() {
    var el = document.getElementById("wordCount");
    if (!el) return;
    var n = countWords();
    el.textContent = n + " word" + (n === 1 ? "" : "s");
  }

  function quillContainer() {
    return document.querySelector("#docEditor .ql-container");
  }

  function ensureDecorLayer() {
    if (decorLayer) return decorLayer;
    var container = quillContainer();
    if (!container) return null;
    decorLayer = document.createElement("div");
    decorLayer.className = "lk-page-decor-layer";
    decorLayer.setAttribute("aria-hidden", "true");
    container.insertBefore(decorLayer, container.firstChild);
    return decorLayer;
  }

  function ensureChromeOverlay() {
    if (chromeOverlay) return chromeOverlay;
    var container = quillContainer();
    if (!container) return null;
    chromeOverlay = document.createElement("div");
    chromeOverlay.className = "lk-page-chrome-layer";
    chromeOverlay.setAttribute("aria-hidden", "true");
    container.appendChild(chromeOverlay);
    return chromeOverlay;
  }

  function schedulePageChrome() {
    if (chromeTimer) clearTimeout(chromeTimer);
    chromeTimer = setTimeout(updatePageChrome, 60);
  }

  function updatePageChrome() {
    var el = editorEl();
    var decor = ensureDecorLayer();
    var overlay = ensureChromeOverlay();
    if (!el || !decor || !overlay || !doc) return;

    var pages = Math.max(1, Math.ceil(el.scrollHeight / PAGE_H));
    var minH = pages * PAGE_H + Math.max(0, pages - 1) * PAGE_GAP;
    el.style.minHeight = minH + "px";

    pages = Math.max(1, Math.ceil(Math.max(el.scrollHeight, minH) / PAGE_H));
    minH = pages * PAGE_H + Math.max(0, pages - 1) * PAGE_GAP;
    el.style.minHeight = minH + "px";

    decor.style.height = minH + "px";
    decor.innerHTML = "";
    overlay.style.height = minH + "px";
    overlay.innerHTML = "";

    for (var p = 0; p < pages; p++) {
      var sheet = document.createElement("div");
      sheet.className = "lk-page-sheet";
      sheet.style.top = p * PAGE_UNIT + "px";
      decor.appendChild(sheet);
    }

    var header = (doc.headerText || "").trim();
    var footer = (doc.footerText || "").trim();
    var numbers = doc.showPageNumbers !== false;
    var m = marginPx();

    for (var i = 0; i < pages; i++) {
      var top = i * PAGE_UNIT;
      if (header) {
        var head = document.createElement("div");
        head.className = "lk-page-chrome lk-page-chrome-header";
        head.style.top = top + 28 + "px";
        head.style.left = m + "px";
        head.style.right = m + "px";
        head.textContent = header;
        overlay.appendChild(head);
      }
      if (footer || numbers) {
        var foot = document.createElement("div");
        foot.className = "lk-page-chrome lk-page-chrome-footer";
        foot.style.top = top + PAGE_H - m + 8 + "px";
        foot.style.left = m + "px";
        foot.style.right = m + "px";
        var parts = [];
        if (footer) parts.push(footer);
        if (numbers) parts.push(String(i + 1));
        foot.textContent = parts.join(footer && numbers ? " · " : "");
        overlay.appendChild(foot);
      }
    }
  }

  function registerPageBreakBlot() {
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
    schedulePageChrome();
  }

  function initFontPicker() {
    var sel = document.getElementById("docFont");
    LoreKeeperFontCatalog.FONTS.forEach(function (font) {
      var opt = document.createElement("option");
      opt.value = font.id;
      opt.textContent = font.name;
      opt.style.fontFamily = font.family;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () {
      LoreKeeperFontCatalog.applyToElement(editorEl(), sel.value);
      syncDocFromEditor();
      scheduleSave();
    });
  }

  function initQuill() {
    registerPageBreakBlot();
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
    quill.on("text-change", function () {
      if (loading) return;
      syncDocFromEditor();
      updateWordCount();
      schedulePageChrome();
      scheduleSave();
    });
  }

  function loadDocIntoEditor() {
    loading = true;
    var html = doc.bodyHtml || "";
    quill.setContents([]);
    if (html) {
      quill.clipboard.dangerouslyPasteHTML(0, html, "silent");
    }
    loadPageSetupFields();
    syncDocFromEditor();
    updateWordCount();
    updatePageChrome();
    loading = false;
    quill.focus();
  }

  function bindMeta() {
    ["docTitle", "docWork", "docHeader", "docFooter"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", function () {
        syncDocMeta();
        syncPageSetup();
        schedulePageChrome();
        scheduleSave();
      });
    });
    ["docMargins", "docLineSpacing", "docPageNumbers"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", function () {
        syncPageSetup();
        applyPageLayout();
        scheduleSave();
      });
    });
    document.getElementById("insertPageBreakBtn").addEventListener("click", insertPageBreak);
    global.addEventListener("resize", schedulePageChrome);
    global.addEventListener("beforeunload", function () {
      if (!doc || !quill) return;
      loading = false;
      syncDocFromEditor();
      syncDocMeta();
      flushSave(true);
    });
  }

  document.getElementById("deleteDocBtn").addEventListener("click", function () {
    if (!confirm("Delete this whole document?")) return;
    LoreKeeperDocuments.delete(doc.id);
    global.location.href = "./index.html";
  });

  LoreKeeperDocuments.ready.then(function () {
    if (!LoreKeeperAccountStorage.isSignedIn()) {
      LoreKeeperAccountStorage.ensureSignedIn();
      return;
    }
    initFontPicker();
    initQuill();
    var id = docIdFromUrl();
    var raw = LoreKeeperDocuments.load().filter(function (d) {
      return d.id === id;
    })[0];
    if (!raw) {
      global.location.href = "./index.html";
      return;
    }
    var wasLegacy = raw.bodyFormat !== "html" || (raw.pages && raw.pages.length);
    doc = LoreKeeperDocuments.migrateToFlow(raw);
    doc = LoreKeeperDocuments.pageDefaults(doc);
    if (wasLegacy) {
      LoreKeeperDocuments.save(doc);
      LoreKeeperAccountStorage.flush();
    }
    LoreKeeperDocuments.setLastDocId(doc.id);
    document.getElementById("docTitle").value = doc.title || "";
    document.getElementById("docWork").value = doc.workTag || "";
    loadDocIntoEditor();
    bindMeta();
  });
})(typeof window !== "undefined" ? window : this);
