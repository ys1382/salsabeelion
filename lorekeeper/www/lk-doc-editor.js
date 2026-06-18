(function (global) {
  var PAGE_H = 1056;
  var PAGE_GAP = 14;
  var PAGE_LINE_BUFFER = 20;
  var PAD_OVERSHOOT = 10;
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
  var saveMaxTimer = null;

  function syncDocBodyFromEditor() {
    if (!doc || !quill || loading) return;
    if (global.LoreKeeperSpell && global.LoreKeeperSpell.clearQuillSpellMarks) {
      global.LoreKeeperSpell.clearQuillSpellMarks(quill);
    }
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

  function setSaveStatus(msg, state) {
    var el = document.getElementById("saveStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "lk-save-status is-" + (state || "idle");
  }

  function onEditorChange() {
    if (loading || !doc || !quill) return;
    updateWordCount();
    schedulePageChrome();
    queueSave();
  }

  function bindEditorInput() {
    if (!quill) return;
    if (quill.__lkChangeHandler) {
      quill.off("text-change", quill.__lkChangeHandler);
    }
    quill.__lkChangeHandler = function () {
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
    if (!doc || !quill || loading) return;
    syncDocBodyFromEditor();
    syncPageSetup();
    syncDocMeta();
    LoreKeeperDocuments.save(doc);
    LoreKeeperDocuments.setLastDocId(doc.id);
    var flush = LoreKeeperAccountStorage.flush({ keepalive: true });
    if (flush && flush.then) {
      flush.then(function (sent) {
        if (!sent) dirty = true;
      });
    }
  }

  function flushSave(force) {
    if (!doc) return;
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
          } else {
            dirty = true;
            setSaveStatus("Saved here — not synced to account yet", "error");
          }
          updateRestoreBackupUi();
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

  function syncDocMeta() {
    doc.title = document.getElementById("docTitle").value.trim() || doc.title;
    doc.workTag = document.getElementById("docWork").value.trim();
  }

  function applyDocFont() {
    if (!doc || !global.LoreKeeperFontCatalog) return;
    var fontId = doc.font || LoreKeeperFontCatalog.defaultId;
    var sel = document.getElementById("docFont");
    if (sel && sel.options.length) sel.value = fontId;
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

  function padToNextContentStart(y, m, unit, pageH) {
    var adj = y - m;
    var pageIdx = adj < 0 ? 0 : Math.floor(adj / unit);
    var greyStart = pageIdx * unit + pageH;
    if (y >= greyStart) pageIdx += 1;
    var target = pageIdx * unit + m;
    return Math.max(1, Math.ceil(target - y + PAD_OVERSHOOT));
  }

  function pushNodeToNextContentStart(node, el, m, unit, pageH) {
    applyPagePush(node, el, m, unit, pageH);
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
          if (joinIndex > 0) quill.deleteText(joinIndex - 1, 1, "silent");
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

  function getBlockLines(block, el) {
    var lines = [];
    var text = block.textContent || "";
    if (!text.length) return lines;
    var er = el.getBoundingClientRect();
    var range = document.createRange();
    var lastTop = null;

    for (var i = 0; i < text.length; i++) {
      if (!setRangeAtOffset(block, range, i)) continue;
      var rects = range.getClientRects();
      if (!rects.length) continue;
      var top = rects[0].top - er.top;
      var bottom = rects[rects.length - 1].bottom - er.top;
      if (lastTop === null || Math.abs(top - lastTop) > 0.75) {
        lines.push({ offset: i, top: top, bottom: bottom });
        lastTop = top;
      } else if (lines.length) {
        lines[lines.length - 1].bottom = Math.max(lines[lines.length - 1].bottom, bottom);
      }
    }
    if (!lines.length && block.offsetHeight) {
      var blockTop = blockBorderTop(block, el);
      lines.push({ offset: 0, top: blockTop, bottom: blockTop + block.offsetHeight });
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
    var adj = y - m;
    var pageIdx = adj < 0 ? 0 : Math.floor(adj / unit);
    return {
      pageIdx: pageIdx,
      contentEnd: pageIdx * unit + pageH - m - PAGE_LINE_BUFFER,
      greyStart: pageIdx * unit + pageH,
      nextContentStart: (pageIdx + 1) * unit + m,
    };
  }

  function lineOverflowsPage(line, m, unit, pageH) {
    var page = pageMetricsForY(line.top, m, unit, pageH);
    return line.bottom > page.contentEnd || line.top >= page.greyStart;
  }

  /** Page visuals only — auto line-splitting disabled (was freezing long docs). */
  function syncBlockPageGaps() {
    if (loading || !quill) return;
    clearPagePushes();
    removePagePads();
    updatePageChrome();
  }

  function scheduleBlockPageGaps() {
    schedulePageChrome();
  }

  function runPageLayoutSync() {
    updatePageChrome();
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
        strip.style.top = Math.max(0, g * unit + pageH - 4) + "px";
        strip.style.height = gap + 12 + "px";
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
  function initFontPicker() {
    if (fontPickerReady) return;
    var sel = document.getElementById("docFont");
    if (!sel || !global.LoreKeeperFontCatalog) return;
    fontPickerReady = true;
    sel.innerHTML = "";
    LoreKeeperFontCatalog.FONTS.forEach(function (font) {
      var opt = document.createElement("option");
      opt.value = font.id;
      opt.textContent = font.name;
      opt.style.fontFamily = font.family;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () {
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
    if (doc) applyDocFont();
    ensureChromeBack();
    ensureGapCover();
    global.LoreKeeperSpell.ready.then(function () {
      if (!quill) return;
      spellCtl = global.LoreKeeperSpell.bindQuill(quill, document.getElementById("docSpellFlags"));
    });
  }

  function loadDocIntoEditor() {
    loading = true;
    var html = doc.bodyHtml || "";
    if (global.LoreKeeperDocuments && global.LoreKeeperDocuments.normalizeBodyHtml) {
      html = LoreKeeperDocuments.normalizeBodyHtml(html);
      doc.bodyHtml = html;
    }
    loadHtmlIntoEditor(html);
    if (!isEmptyHtml(html) && !editorHasText()) {
      loadHtmlIntoEditor(html);
    }
    initFontPicker();
    loadPageSetupFields();
    updateWordCount();
    updatePageChrome();
    applyDocFont();
    updateRestoreBackupUi();
    global.requestAnimationFrame(function () {
      applyDocFont();
      if (!isEmptyHtml(html) && !editorHasText()) {
        loadHtmlIntoEditor(html);
        updateWordCount();
      }
      loading = false;
      bindEditorInput();
      updateRestoreBackupUi();
      try {
        runPageLayoutSync();
      } catch (e) {
        /* layout-only; never block load */
      }
      setSaveStatus("Up to date", "idle");
      quill.focus();
    });
  }

  function updateRestoreBackupUi() {
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
      var reason = snap.reason === "open" ? "from when you opened it" : "from an earlier save";
      hint.textContent = "Older version " + reason + " (" + when + ").";
      block.hidden = false;
      btn.disabled = false;
    } catch (e) {
      block.hidden = true;
      hint.textContent = "";
    }
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
    var hasText = !isEmptyHtml(doc.bodyHtml) || editorHasText();
    var msg = hasText
      ? "Replace what's on the page with the backup from " + when + "?"
      : "Restore the backup from " + when + "?";
    if (!confirm(msg)) return;

    var restored = LoreKeeperDocuments.restoreSnapshot(doc, restorable.index);
    if (!restored) {
      setSaveStatus("Could not restore backup.", "error");
      return;
    }
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
    updateRestoreBackupUi();
    setSaveStatus("Restored from backup.", "saved");
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
    global.addEventListener("pagehide", parkSave);
    global.addEventListener("visibilitychange", function () {
      if (global.document.visibilityState === "hidden") parkSave();
    });
    global.addEventListener("beforeunload", function () {
      if (!doc || !quill) return;
      loading = false;
      parkSave();
    });
  }

  document.getElementById("deleteDocBtn").addEventListener("click", function () {
    if (!confirm("Delete this whole document?")) return;
    LoreKeeperDocuments.delete(doc.id);
    global.location.href = "./index.html";
  });
  document.getElementById("restoreBackupBtn").addEventListener("click", restoreFromBackup);

  LoreKeeperDocuments.ready.then(function () {
    if (!LoreKeeperAccountStorage.isSignedIn()) {
      LoreKeeperAccountStorage.ensureSignedIn();
      return;
    }
    var id = docIdFromUrl();
    var raw = LoreKeeperDocuments.load().filter(function (d) {
      return d.id === id;
    })[0];
    if (!raw) {
      global.location.href = "./index.html";
      return;
    }
    var wasLegacy = raw.bodyFormat !== "html" || (raw.pages && raw.pages.length);
    LoreKeeperDocuments.snapshotBeforeEdit(raw);
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
    loadDocIntoEditor();
    bindMeta();
  });
})(typeof window !== "undefined" ? window : this);
