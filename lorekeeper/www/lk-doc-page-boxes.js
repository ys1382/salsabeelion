/**
 * LoreKeeper — real page boxes for documents.
 * Stacked white sheets; overflow lines move whole to the next page.
 * Save joins pages into one continuous bodyHtml (no layout chrome saved).
 */
(function (global) {
  var PAGE_H = 1056;
  var PAGE_GAP = 14;
  var MARGIN_PX = { narrow: 48, normal: 96, wide: 144 };

  var quill = null;
  var getDoc = null;
  var onAfterReflow = null;
  var stackEl = null;
  var pageHtmls = [];
  var activeIndex = 0;
  var syncing = false;
  var bound = false;
  /** Off until multi-page split is proven not to clip. Tall growing sheet = full text. */
  var ALLOW_MULTI_PAGE = false;
  var ALLOW_TYPE_OVERFLOW = false;

  function doc() {
    return getDoc ? getDoc() : null;
  }

  function marginPx() {
    var d = doc();
    return MARGIN_PX[(d && d.margins) || "normal"] || MARGIN_PX.normal;
  }

  function pageHeightPx() {
    var sheet = document.getElementById("docSheet");
    if (!sheet) return PAGE_H;
    var raw = (global.getComputedStyle(sheet).getPropertyValue("--lk-page-h") || "").trim();
    if (raw.endsWith("px")) return parseFloat(raw) || PAGE_H;
    if (raw.endsWith("vh")) return (parseFloat(raw) / 100) * (global.innerHeight || 800);
    return PAGE_H;
  }

  function gapPx() {
    var sheet = document.getElementById("docSheet");
    if (!sheet) return PAGE_GAP;
    return parseFloat(global.getComputedStyle(sheet).getPropertyValue("--lk-page-gap")) || PAGE_GAP;
  }

  /** Usable ink height inside one sheet (below header chrome, above footer). */
  function contentHeightPx() {
    var m = marginPx();
    return Math.max(120, pageHeightPx() - m * 2);
  }

  function isEmptyHtml(html) {
    var text = String(html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return !text;
  }

  function stripLayout(html) {
    return String(html || "")
      .replace(/<div[^>]*class="[^"]*lk-auto-page-gap[^"]*"[^>]*><\/div>/gi, "")
      .replace(/<div[^>]*class="[^"]*lk-page-break[^"]*"[^>]*><\/div>/gi, "");
  }

  function plainWords(html) {
    return stripLayout(html)
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, "");
  }

  function ensureStack() {
    stackEl = document.getElementById("docPagesStack");
    if (stackEl) return stackEl;
    var host = document.getElementById("docEditor");
    if (!host) return null;
    stackEl = document.createElement("div");
    stackEl.id = "docPagesStack";
    stackEl.className = "lk-pages-stack";
    var mount = document.getElementById("docQuillMount");
    if (mount && mount.parentNode === host) host.insertBefore(stackEl, mount);
    else host.appendChild(stackEl);
    return stackEl;
  }

  function moveToolbarAboveStack() {
    var host = document.getElementById("docEditor");
    if (!host || !stackEl) return;
    var toolbar = host.querySelector(".ql-toolbar");
    if (toolbar && toolbar.parentNode === host && toolbar.nextSibling !== stackEl) {
      host.insertBefore(toolbar, stackEl);
    }
  }

  function quillHtml() {
    if (!quill) return "";
    var root = quill.root.cloneNode(true);
    root.querySelectorAll(".lk-auto-page-gap, .lk-page-break").forEach(function (n) {
      n.remove();
    });
    root.querySelectorAll(".lk-auto-continued").forEach(function (n) {
      n.classList.remove("lk-auto-continued");
    });
    return root.innerHTML;
  }

  function setQuillHtml(html) {
    if (!quill) return;
    var saved = stripLayout(String(html || "").trim());
    quill.setContents([]);
    if (!saved) {
      quill.setText("");
      return;
    }
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
  }

  function measureWidth() {
    var sheet = document.getElementById("docSheet");
    return Math.max(280, (sheet && sheet.clientWidth) || 816);
  }

  function buildMeasureEl() {
    var m = marginPx();
    var el = document.createElement("div");
    el.className = "ql-editor lk-page-measure";
    el.setAttribute("aria-hidden", "true");
    var w = Math.max(200, measureWidth() - m * 2);
    el.style.cssText =
      "position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none;" +
      "width:" +
      w +
      "px;box-sizing:border-box;height:auto;overflow:visible;padding:0;" +
      "line-height:" +
      ((doc() && doc().lineSpacing) || "1.15") +
      ";";
    var d = doc();
    if (d && global.LoreKeeperFontCatalog) {
      LoreKeeperFontCatalog.applyToElement(el, d.font || LoreKeeperFontCatalog.defaultId);
    }
    document.body.appendChild(el);
    return el;
  }

  function blockFits(measure, html, maxH) {
    measure.innerHTML = html || "<p><br></p>";
    return measure.scrollHeight <= maxH + 1;
  }

  /** Split one block HTML so the head fits in maxH; returns { head, tail }. */
  function splitBlockHtmlToFit(blockHtml, maxH) {
    var measure = buildMeasureEl();
    measure.innerHTML = blockHtml;
    var block = measure.firstElementChild;
    if (!block) {
      measure.remove();
      return { head: blockHtml, tail: "" };
    }
    if (measure.scrollHeight <= maxH + 1) {
      measure.remove();
      return { head: blockHtml, tail: "" };
    }

    var text = block.textContent || "";
    if (!text.length) {
      measure.remove();
      return { head: "", tail: blockHtml };
    }

    var tag = (block.tagName || "P").toLowerCase();
    var lo = 0;
    var hi = text.length;
    var best = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var slice = text.slice(0, mid);
      // snap back to previous space when mid is mid-word
      if (mid > 0 && mid < text.length && !/\s/.test(text.charAt(mid)) && !/\s/.test(text.charAt(mid - 1))) {
        var s = mid;
        while (s > 0 && !/\s/.test(text.charAt(s - 1))) s--;
        if (s > 0) mid = s;
      }
      measure.innerHTML = "<" + tag + ">" + escapeText(text.slice(0, mid)) + "</" + tag + ">";
      if (measure.scrollHeight <= maxH + 1) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    measure.remove();
    if (best <= 0) return { head: "", tail: blockHtml };
    if (best >= text.length) return { head: blockHtml, tail: "" };
    return {
      head: "<" + tag + ">" + escapeText(text.slice(0, best)) + "</" + tag + ">",
      tail: "<" + tag + ">" + escapeText(text.slice(best).replace(/^\s+/, "")) + "</" + tag + ">",
    };
  }

  function escapeText(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function paginateFullHtml(html) {
    var clean = stripLayout(html);
    if (isEmptyHtml(clean)) return [""];

    var maxH = contentHeightPx();
    var measure = buildMeasureEl();
    var wrap = document.createElement("div");
    wrap.innerHTML = clean;
    var blocks = Array.prototype.slice.call(wrap.children);
    if (!blocks.length) {
      measure.remove();
      return [clean];
    }

    var pages = [];
    var parts = [];
    var used = 0;
    var i = 0;
    var guard = 0;
    var maxSteps = Math.max(64, blocks.length * 4);
    var started = Date.now();
    var BUDGET_MS = 100;

    function flush() {
      if (!parts.length) return;
      pages.push(parts.join(""));
      parts = [];
      used = 0;
    }

    while (i < blocks.length && guard < maxSteps) {
      guard += 1;
      if (Date.now() - started > BUDGET_MS) {
        // Too slow — keep Phase A tall single page instead of freezing the tab.
        measure.remove();
        return [clean];
      }
      var blockHtml = blocks[i].outerHTML;
      measure.innerHTML = blockHtml;
      var h = measure.scrollHeight || 0;

      if (h > maxH + 1) {
        flush();
        // Skip expensive binary-split when over budget; put whole block on next page pack.
        if (Date.now() - started > BUDGET_MS * 0.7) {
          pages.push(blockHtml);
          i += 1;
          continue;
        }
        measure.remove();
        var split = splitBlockHtmlToFit(blockHtml, maxH);
        measure = buildMeasureEl();
        if (split.head) pages.push(split.head);
        if (split.tail && !isEmptyHtml(split.tail) && split.tail !== blockHtml) {
          var tmp = document.createElement("div");
          tmp.innerHTML = split.tail;
          if (tmp.firstElementChild) {
            blocks.splice(i + 1, 0, tmp.firstElementChild);
          } else {
            pages.push(split.tail);
          }
        } else if (split.tail && !isEmptyHtml(split.tail)) {
          pages.push(split.tail);
        }
        i += 1;
        continue;
      }

      if (parts.length && used + h > maxH + 1) {
        flush();
      }
      parts.push(blockHtml);
      used += h;
      i += 1;
    }
    flush();
    measure.remove();
    return pages.length ? pages : [clean];
  }

  var pendingPaginateHtml = null;
  var paginateTimer = null;

  /** Make Quill’s height:100% trap expand to the real draft height. */
  function forceGrowToContent() {
    if (ALLOW_MULTI_PAGE && pageHtmls.length > 1) return;
    if (!quill || !quill.root || !quill.container) return;
    var editor = quill.root;
    var container = quill.container;
    var sheet = container.closest ? container.closest(".lk-page-sheet") : null;
    var body = container.parentNode;
    var pageH = pageHeightPx();
    var m = marginPx();

    [editor, container].forEach(function (el) {
      if (!el || !el.style) return;
      el.style.height = "auto";
      el.style.maxHeight = "none";
      el.style.minHeight = "0";
      el.style.overflow = "visible";
      el.style.overflowY = "visible";
    });
    if (body && body.style) {
      body.style.height = "auto";
      body.style.maxHeight = "none";
      body.style.minHeight = "0";
      body.style.overflow = "visible";
    }
    if (sheet && sheet.style) {
      sheet.classList.add("is-growing");
      sheet.style.height = "auto";
      sheet.style.maxHeight = "none";
      sheet.style.overflow = "visible";
      var needed = Math.max(pageH, (editor.scrollHeight || 0) + m * 2 + 48);
      sheet.style.minHeight = needed + "px";
    }
  }

  function loadFromBodyHtml(html) {
    var clean = stripLayout(html || "");
    pendingPaginateHtml = null;
    // Always show the full draft on one growing sheet — no clip, no deferred split.
    pageHtmls = [clean];
    activeIndex = 0;
    syncing = true;
    try {
      renderStack();
      setQuillHtml(clean);
      forceGrowToContent();
      global.requestAnimationFrame(function () {
        forceGrowToContent();
        global.requestAnimationFrame(forceGrowToContent);
      });
    } catch (e) {
      /* keep going */
    }
    syncing = false;
    if (onAfterReflow) onAfterReflow();
  }

  /** Kept for Phase B later — currently a no-op while multi-page is off. */
  function schedulePaginateAfterReady() {
    pendingPaginateHtml = null;
  }

  function headerFooterHtml(pageNum, pageCount) {
    var d = doc();
    if (!d) return { header: "", footer: "" };
    var header = (d.headerText || "").trim();
    var footer = (d.footerText || "").trim();
    var numbers = d.showPageNumbers !== false;
    var footParts = [];
    if (footer) footParts.push(footer);
    if (numbers) footParts.push(String(pageNum));
    return {
      header: header,
      footer: footParts.join(footer && numbers ? " · " : ""),
    };
  }

  function captureActiveIntoArray() {
    if (!quill || activeIndex < 0) return;
    while (pageHtmls.length <= activeIndex) pageHtmls.push("");
    var html = quillHtml();
    // Never replace stored prose with an empty editor snapshot during load/layout.
    if (isEmptyHtml(html) && !isEmptyHtml(pageHtmls[activeIndex])) return;
    pageHtmls[activeIndex] = html;
  }

  function joinedHtml() {
    captureActiveIntoArray();
    return pageHtmls
      .map(function (h) {
        return stripLayout(h);
      })
      .filter(function (h, i, arr) {
        // keep at least one page; drop trailing empties except the last kept earlier
        return !isEmptyHtml(h) || i === 0 || i < arr.length - 1;
      })
      .join("");
  }

  function trimTrailingEmptyPages() {
    while (pageHtmls.length > 1 && isEmptyHtml(pageHtmls[pageHtmls.length - 1])) {
      if (activeIndex === pageHtmls.length - 1) break;
      pageHtmls.pop();
    }
  }

  function renderStack() {
    var stack = ensureStack();
    if (!stack || !quill) return;
    var canvas = document.getElementById("docCanvas");
    var savedScroll = canvas ? canvas.scrollTop : 0;
    moveToolbarAboveStack();
    captureActiveIntoArray();
    trimTrailingEmptyPages();
    if (!pageHtmls.length) pageHtmls = [""];
    // Phase A fallback only: collapse to one page when multi-page is off.
    if (!ALLOW_MULTI_PAGE && pageHtmls.length > 1) {
      pageHtmls = [pageHtmls.join("")];
      activeIndex = 0;
    }
    if (activeIndex >= pageHtmls.length) activeIndex = pageHtmls.length - 1;
    if (activeIndex < 0) activeIndex = 0;

    var container = quill.container;
    // Detach Quill before wiping the stack — never destroy the editor DOM.
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    var pageCount = pageHtmls.length;
    var growMode = !ALLOW_MULTI_PAGE || pageCount === 1;
    var pageH = pageHeightPx();
    var contentH = contentHeightPx();
    stack.innerHTML = "";

    for (var i = 0; i < pageCount; i++) {
      var sheet = document.createElement("div");
      sheet.className =
        "lk-page-sheet" +
        (i === activeIndex ? " is-active" : "") +
        (growMode ? " is-growing" : "");
      sheet.setAttribute("data-page", String(i));
      if (growMode) {
        sheet.style.minHeight = pageH + "px";
        sheet.style.height = "auto";
        sheet.style.overflow = "visible";
      } else {
        sheet.style.height = pageH + "px";
        sheet.style.overflow = "hidden";
      }
      sheet.style.marginBottom = gapPx() + "px";

      var hf = headerFooterHtml(i + 1, pageCount);
      if (hf.header) {
        var head = document.createElement("div");
        head.className = "lk-page-sheet-chrome lk-page-sheet-header";
        head.textContent = hf.header;
        sheet.appendChild(head);
      }

      var body = document.createElement("div");
      body.className = "lk-page-sheet-body";
      var m = marginPx();
      body.style.padding = m + "px";

      if (i === activeIndex) {
        body.classList.add("lk-page-sheet-body-active");
        body.appendChild(container);
        if (growMode) {
          container.style.height = "auto";
          container.style.minHeight = contentH + "px";
        } else {
          container.style.height = contentH + "px";
        }
      } else {
        var staticEd = document.createElement("div");
        staticEd.className = "ql-editor lk-page-static";
        staticEd.innerHTML = pageHtmls[i] || "<p><br></p>";
        staticEd.style.minHeight = contentH + "px";
        if (growMode) {
          staticEd.style.maxHeight = "none";
          staticEd.style.overflow = "visible";
        } else {
          staticEd.style.maxHeight = contentH + "px";
          staticEd.style.overflow = "hidden";
        }
        body.appendChild(staticEd);
        sheet.addEventListener(
          "click",
          (function (idx) {
            return function () {
              activatePage(idx);
            };
          })(i)
        );
      }
      sheet.appendChild(body);

      if (hf.footer) {
        var foot = document.createElement("div");
        foot.className = "lk-page-sheet-chrome lk-page-sheet-footer";
        foot.textContent = hf.footer;
        sheet.appendChild(foot);
      }

      stack.appendChild(sheet);
    }

    var editor = quill.root;
    if (editor) {
      editor.style.minHeight = contentH + "px";
      editor.style.padding = "0";
      editor.style.background = "transparent";
      editor.style.boxShadow = "none";
      if (growMode) {
        editor.style.maxHeight = "none";
        editor.style.height = "auto";
        editor.style.overflow = "visible";
      } else {
        editor.style.maxHeight = contentH + "px";
        editor.style.height = contentH + "px";
        // Phase B: scroll inside the page until Phase C moves overflow to the next sheet.
        editor.style.overflow = "auto";
      }
    }
    if (canvas) {
      canvas.scrollTop = savedScroll;
    }
  }

  function activatePage(index, caretIndex) {
    if (!quill || syncing) return;
    if (index < 0) index = 0;
    captureActiveIntoArray();
    if (index >= pageHtmls.length) {
      pageHtmls.push("");
      index = pageHtmls.length - 1;
    }
    activeIndex = index;
    syncing = true;
    renderStack();
    setQuillHtml(pageHtmls[activeIndex] || "");
    if (typeof caretIndex === "number") {
      try {
        quill.setSelection(Math.max(0, Math.min(caretIndex, Math.max(0, quill.getLength() - 1))), 0, "silent");
      } catch (e) {
        /* ignore */
      }
    }
    syncing = false;
    reflowActive(true);
    if (onAfterReflow) onAfterReflow();
  }

  function ensureNextPage() {
    if (activeIndex + 1 >= pageHtmls.length) pageHtmls.push("");
  }

  function prependToPage(index, html) {
    if (!html || isEmptyHtml(html)) return;
    while (pageHtmls.length <= index) pageHtmls.push("");
    var existing = pageHtmls[index] || "";
    pageHtmls[index] = html + existing;
  }

  function activeOverflows() {
    if (!quill) return false;
    return quill.root.scrollHeight > contentHeightPx() + 2;
  }

  /**
   * Move whole overflowing lines/blocks from the active page onto the next sheet.
   * Returns true if caret should follow onto the next page.
   */
  function pushOverflowToNextPage() {
    if (!quill || !activeOverflows()) return false;
    var maxH = contentHeightPx();
    var el = quill.root;
    var wordsBefore = plainWords(el.innerHTML);
    var moved = "";
    var follow = false;
    var sel = quill.getSelection();
    var caret = sel ? sel.index : null;
    var guard = 0;

    while (activeOverflows() && el.children.length && guard < 40) {
      guard += 1;
      var last = el.children[el.children.length - 1];
      if (!last) break;

      var lastTop = last.offsetTop;
      var lastBottom = lastTop + last.offsetHeight;
      if (lastBottom <= maxH + 1 && el.scrollHeight <= maxH + 2) break;

      // If the whole last block starts past the fold, move it entirely.
      if (lastTop > maxH - 2) {
        var blot = global.Quill.find(last);
        var start = blot ? quill.getIndex(blot) : Math.max(0, quill.getLength() - 2);
        var len = blot ? blot.length() : 1;
        var html = last.outerHTML;
        quill.deleteText(start, len, "silent");
        moved = html + moved;
        if (caret !== null && caret >= start) follow = true;
        continue;
      }

      // Split the last block at the first line that crosses the fold.
      var range = document.createRange();
      range.selectNodeContents(last);
      var rects = Array.prototype.slice.call(range.getClientRects());
      var er = el.getBoundingClientRect();
      var cutOffset = -1;
      var text = last.textContent || "";
      for (var r = 0; r < rects.length; r++) {
        var bottom = rects[r].bottom - er.top;
        if (bottom > maxH + 1) {
          // find char offset for this line
          cutOffset = charOffsetForScreenTop(last, rects[r].top);
          break;
        }
      }
      if (cutOffset < 0) {
        // fallback: move whole block
        var blot2 = global.Quill.find(last);
        var start2 = blot2 ? quill.getIndex(blot2) : Math.max(0, quill.getLength() - 2);
        var len2 = blot2 ? blot2.length() : 1;
        moved = last.outerHTML + moved;
        quill.deleteText(start2, len2, "silent");
        if (caret !== null && caret >= start2) follow = true;
        continue;
      }
      cutOffset = snapWord(text, cutOffset);
      if (cutOffset <= 0) {
        var blot3 = global.Quill.find(last);
        var start3 = blot3 ? quill.getIndex(blot3) : 0;
        var len3 = blot3 ? blot3.length() : 1;
        moved = last.outerHTML + moved;
        quill.deleteText(start3, len3, "silent");
        if (caret !== null && caret >= start3) follow = true;
        continue;
      }
      var blot4 = global.Quill.find(last);
      if (!blot4) break;
      var abs = quill.getIndex(blot4) + cutOffset;
      var remainLen = Math.max(0, quill.getLength() - 1 - abs);
      if (remainLen <= 0) break;
      // Extract remaining HTML via temporary split
      quill.insertText(abs, "\n", "silent");
      var next = last.nextElementSibling;
      if (next) {
        moved = next.outerHTML + moved;
        var nb = global.Quill.find(next);
        if (nb) quill.deleteText(quill.getIndex(nb), nb.length(), "silent");
        else next.remove();
      }
      if (caret !== null && caret >= abs) follow = true;
    }

    var wordsAfter = plainWords(el.innerHTML) + plainWords(moved);
    if (wordsBefore && wordsAfter.length < wordsBefore.length) {
      // Safety: refuse a destructive move — restore by not applying moved (already deleted though).
      // Caller should abort via joined word guard on save; here just stop looping.
      return false;
    }

    if (moved) {
      ensureNextPage();
      prependToPage(activeIndex + 1, moved);
    }
    return follow && !!moved;
  }

  function charOffsetForScreenTop(block, screenTop) {
    var text = block.textContent || "";
    if (!text.length) return 0;
    var range = document.createRange();
    var lo = 0;
    var hi = text.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (!setRangeAt(block, range, mid)) {
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

  function setRangeAt(container, range, offset) {
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

  function snapWord(text, offset) {
    if (offset <= 0 || offset >= text.length) return offset;
    if (/\s/.test(text.charAt(offset))) return offset;
    if (offset > 0 && /\s/.test(text.charAt(offset - 1))) return offset;
    var i = offset;
    while (i > 0 && !/\s/.test(text.charAt(i - 1))) i--;
    return i > 0 ? i : offset;
  }

  function reflowActive(skipFollow) {
    // Phase C enables typing overflow; Phase B is display split only.
    if (!ALLOW_MULTI_PAGE || !ALLOW_TYPE_OVERFLOW) return;
    if (!quill || syncing) return;
    syncing = true;
    var follow = false;
    var rounds = 0;
    while (activeOverflows() && rounds < 24) {
      rounds += 1;
      if (pushOverflowToNextPage()) follow = true;
      else break;
    }
    captureActiveIntoArray();
    // Keep a blank next page ready when the active page is nearly full (optional — skip)
    trimTrailingEmptyPages();
    if (follow && !skipFollow) {
      var next = activeIndex + 1;
      syncing = false;
      activatePage(next, 0);
      return;
    }
    renderStack();
    setQuillHtml(pageHtmls[activeIndex] || "");
    syncing = false;
  }

  function applyLayoutVars() {
    var sheet = document.getElementById("docSheet");
    if (!sheet) return;
    sheet.style.setProperty("--lk-page-h", PAGE_H + "px");
    sheet.style.setProperty("--lk-page-gap", PAGE_GAP + "px");
    sheet.className =
      "lk-doc-sheet lk-margin-" +
      ((doc() && doc().margins) || "normal") +
      " lk-line-" +
      String((doc() && doc().lineSpacing) || "1.15").replace(".", "");
  }

  function scheduleReflow() {
    if (!ALLOW_MULTI_PAGE || !ALLOW_TYPE_OVERFLOW) {
      if (onAfterReflow) onAfterReflow();
      return;
    }
    if (syncing) return;
    global.requestAnimationFrame(function () {
      if (syncing) return;
      reflowActive(false);
      if (onAfterReflow) onAfterReflow();
    });
  }

  function insertPageBreak() {
    if (!quill) return;
    var range = quill.getSelection(true);
    var index = range ? range.index : Math.max(0, quill.getLength() - 1);
    var len = Math.max(0, quill.getLength() - 1);
    var after = "";
    if (index < len) {
      var tailLen = len - index;
      var delta = quill.getContents(index, tailLen);
      quill.deleteText(index, tailLen, "user");
      var holder = document.createElement("div");
      holder.style.cssText = "position:absolute;left:-9999px;top:0;height:0;overflow:hidden;";
      document.body.appendChild(holder);
      try {
        var tmp = new global.Quill(holder, { theme: "snow", modules: { toolbar: false } });
        tmp.setContents(delta, "silent");
        after = tmp.root.innerHTML;
      } catch (e) {
        after = "";
      }
      holder.remove();
    }
    captureActiveIntoArray();
    ensureNextPage();
    if (after) prependToPage(activeIndex + 1, after);
    activatePage(activeIndex + 1, 0);
  }

  function bind(opts) {
    if (bound) return;
    bound = true;
    quill = opts.quill;
    getDoc = opts.getDoc;
    onAfterReflow = opts.onAfterReflow || null;
    ensureStack();
    moveToolbarAboveStack();
    applyLayoutVars();
  }

  function refreshChrome() {
    applyLayoutVars();
    // Never rebuild the stack here — that jumps scroll to the top.
  }

  global.LoreKeeperDocPageBoxes = {
    bind: bind,
    loadFromBodyHtml: loadFromBodyHtml,
    scheduleReflow: scheduleReflow,
    schedulePaginateAfterReady: schedulePaginateAfterReady,
    reflowNow: function () {
      reflowActive(false);
    },
    getJoinedHtml: function () {
      var html = joinedHtml();
      return stripLayout(html);
    },
    getActiveQuill: function () {
      return quill;
    },
    refreshChrome: refreshChrome,
    insertPageBreak: insertPageBreak,
    activatePage: activatePage,
    isSyncing: function () {
      return syncing;
    },
    PAGE_H: PAGE_H,
    PAGE_GAP: PAGE_GAP,
  };
})(typeof window !== "undefined" ? window : globalThis);
