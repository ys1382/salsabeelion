/**
 * LoreKeeper — mobile comfort core (#1, #7, #8) + read vs write (#13).
 */
(function (global) {
  var LARGE_SELECTION = 48;
  var LARGE_DELETE = 80;
  var TOAST_MS = 9000;
  var MOBILE_MQ = "(max-width: 720px)";

  var writingBar = null;
  var readBar = null;
  var undoToast = null;
  var undoTimer = null;
  var kbBound = false;
  var editTarget = null;

  function isMobile() {
    try {
      return global.matchMedia(MOBILE_MQ).matches;
    } catch (e) {
      return (global.innerWidth || 0) <= 720;
    }
  }

  function isWritingMode() {
    return document.body.classList.contains("lk-mobile-writing");
  }

  function syncKeyboardInset() {
    var vv = global.visualViewport;
    var inset = 0;
    if (vv) {
      inset = Math.max(0, Math.round(global.innerHeight - vv.height - vv.offsetTop));
    }
    document.documentElement.style.setProperty("--lk-kb-inset", inset + "px");
    return inset;
  }

  function bindKeyboardInset() {
    if (kbBound || !global.visualViewport) return;
    kbBound = true;
    var vv = global.visualViewport;
    var onVv = function () {
      syncKeyboardInset();
    };
    vv.addEventListener("resize", onVv);
    vv.addEventListener("scroll", onVv);
    syncKeyboardInset();
  }

  function scrollCaretIntoView(root) {
    var sel = global.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    if (root && !root.contains(range.startContainer)) return;
    var rect = range.getBoundingClientRect();
    if (!rect.height && !rect.width) return;
    var vv = global.visualViewport;
    var visibleBottom = vv ? vv.offsetTop + vv.height : global.innerHeight;
    var margin = 56;
    if (rect.bottom > visibleBottom - margin) {
      var delta = rect.bottom - (visibleBottom - margin);
      global.scrollBy({ top: delta, left: 0, behavior: "smooth" });
    }
  }

  function ensureWritingBar() {
    if (writingBar) return writingBar;
    writingBar = document.createElement("div");
    writingBar.className = "lk-mobile-writing-bar";
    writingBar.hidden = true;
    var back = document.createElement("a");
    back.className = "lk-mobile-writing-back";
    back.href = "./index.html";
    back.textContent = "← Documents";
    writingBar.appendChild(back);
    var hint = document.createElement("span");
    hint.className = "lk-bt-keyboard-hint muted";
    hint.textContent = "Keyboard";
    writingBar.appendChild(hint);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lk-btn secondary lk-mobile-writing-done";
    btn.textContent = "Done";
    btn.addEventListener("click", function () {
      exitWritingMode();
    });
    writingBar.appendChild(btn);
    document.body.appendChild(writingBar);
    return writingBar;
  }

  function ensureReadBar() {
    if (readBar) return readBar;
    readBar = document.createElement("div");
    readBar.className = "lk-mobile-read-bar";
    readBar.hidden = true;
    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "lk-btn lk-mobile-read-edit";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () {
      beginEditing();
    });
    readBar.appendChild(editBtn);
    if (document.body.classList.contains("lk-page-doc")) {
      var jotBtn = document.createElement("button");
      jotBtn.type = "button";
      jotBtn.className = "lk-btn secondary lk-mobile-read-jot";
      jotBtn.textContent = "Jot";
      jotBtn.addEventListener("click", function () {
        if (global.LoreKeeperMobileJot && global.LoreKeeperMobileJot.openDocQuickJot) {
          global.LoreKeeperMobileJot.openDocQuickJot();
        }
      });
      readBar.appendChild(jotBtn);
    }
    document.body.appendChild(readBar);
    return readBar;
  }

  function showReadBar() {
    if (!isMobile() || !editTarget || isWritingMode()) return;
    var bar = ensureReadBar();
    bar.hidden = false;
    document.body.classList.add("lk-mobile-read");
  }

  function hideReadBar() {
    if (readBar) readBar.hidden = true;
    document.body.classList.remove("lk-mobile-read");
  }

  function setEditTarget(target) {
    editTarget = target || null;
    if (editTarget && isMobile() && !isWritingMode()) {
      showReadBar();
    }
  }

  function lockTargetForRead() {
    if (!editTarget) return;
    if (editTarget.type === "quill" && editTarget.quill) {
      editTarget.quill.disable();
      editTarget.quill.blur();
    }
    if (editTarget.type === "textarea" && editTarget.el) {
      editTarget.el.readOnly = true;
      editTarget.el.blur();
    }
  }

  function unlockTargetForWrite() {
    if (!editTarget) return;
    if (editTarget.type === "quill" && editTarget.quill) {
      editTarget.quill.enable();
    }
    if (editTarget.type === "textarea" && editTarget.el) {
      editTarget.el.readOnly = false;
    }
  }

  function beginJotCapture(textarea) {
    if (!isMobile() || !textarea) return;
    document.body.classList.add("lk-note-jot");
    setEditTarget({ type: "textarea", el: textarea });
    hideReadBar();
    enterWritingMode();
    textarea.readOnly = false;
    textarea.focus();
    if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.setTarget) {
      global.LoreKeeperMobileAccessory.setTarget({ type: "textarea", el: textarea });
    }
    global.requestAnimationFrame(function () {
      scrollCaretIntoView(textarea);
    });
  }

  function beginEditing() {
    if (!isMobile() || !editTarget) return;
    hideReadBar();
    enterWritingMode();
    unlockTargetForWrite();
    if (editTarget.type === "quill" && editTarget.quill) {
      var resumeIdx = editTarget.quill.__lkResumeIndex;
      if (typeof resumeIdx === "number") {
        editTarget.quill.setSelection(resumeIdx, 0, "silent");
      }
      editTarget.quill.focus();
      if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.setTarget) {
        global.LoreKeeperMobileAccessory.setTarget({ type: "quill", quill: editTarget.quill });
      }
    } else if (editTarget.type === "textarea" && editTarget.el) {
      editTarget.el.focus();
      if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.setTarget) {
        global.LoreKeeperMobileAccessory.setTarget({ type: "textarea", el: editTarget.el });
      }
    }
  }

  function enterReadMode() {
    if (!isMobile()) return;
    lockTargetForRead();
    hideReadBar();
    document.body.classList.remove("lk-mobile-writing");
    if (writingBar) writingBar.hidden = true;
    if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.onWritingMode) {
      global.LoreKeeperMobileAccessory.onWritingMode(false);
    }
    syncKeyboardInset();
    showReadBar();
  }

  function enterWritingMode() {
    if (!isMobile()) return;
    document.body.classList.add("lk-mobile-writing");
    hideReadBar();
    var bar = ensureWritingBar();
    bar.hidden = false;
    bindKeyboardInset();
    syncKeyboardInset();
    if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.onWritingMode) {
      global.LoreKeeperMobileAccessory.onWritingMode(true);
    }
  }

  function exitWritingMode() {
    document.body.classList.remove("lk-mobile-writing");
    if (writingBar) writingBar.hidden = true;
    if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.onWritingMode) {
      global.LoreKeeperMobileAccessory.onWritingMode(false);
    }
    if (global.LoreKeeperMobileHandoff && global.LoreKeeperMobileHandoff.onWritingExit) {
      global.LoreKeeperMobileHandoff.onWritingExit();
    }
    if (isMobile() && editTarget) {
      enterReadMode();
      return;
    }
    hideReadBar();
  }

  function initDocReadMode(quill) {
    if (!isMobile() || !quill) return;
    setEditTarget({ type: "quill", quill: quill });
    enterReadMode();
  }

  function enterNoteReadMode(textarea) {
    if (!isMobile() || !textarea) return;
    setEditTarget({ type: "textarea", el: textarea });
    textarea.readOnly = true;
    showReadBar();
  }

  function exitNoteReadMode() {
    if (!isMobile()) return;
    var el = editTarget && editTarget.type === "textarea" ? editTarget.el : null;
    if (el) el.readOnly = false;
    editTarget = null;
    document.body.classList.remove("lk-note-jot");
    hideReadBar();
    document.body.classList.remove("lk-mobile-writing");
    if (writingBar) writingBar.hidden = true;
  }

  function hideUndoToast() {
    if (undoTimer) {
      clearTimeout(undoTimer);
      undoTimer = null;
    }
    if (undoToast) undoToast.hidden = true;
  }

  function ensureUndoToast() {
    if (undoToast) return undoToast;
    undoToast = document.createElement("div");
    undoToast.className = "lk-comfort-toast";
    undoToast.setAttribute("role", "status");
    undoToast.hidden = true;
    var msg = document.createElement("span");
    msg.className = "lk-comfort-toast-msg";
    undoToast.appendChild(msg);
    var undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "lk-btn secondary lk-comfort-undo-btn";
    undoBtn.textContent = "Undo";
    undoToast.appendChild(undoBtn);
    document.body.appendChild(undoToast);
    return undoToast;
  }

  function showUndoToast(message, onUndo) {
    var el = ensureUndoToast();
    var msg = el.querySelector(".lk-comfort-toast-msg");
    var btn = el.querySelector(".lk-comfort-undo-btn");
    if (msg) msg.textContent = message;
    el.hidden = false;
    syncKeyboardInset();
    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = setTimeout(hideUndoToast, TOAST_MS);
    if (btn) {
      var handler = function () {
        btn.removeEventListener("click", handler);
        hideUndoToast();
        if (onUndo) onUndo();
      };
      btn.addEventListener("click", handler);
    }
  }

  function deltaDeletedChars(delta) {
    if (!delta || !delta.ops) return 0;
    var n = 0;
    delta.ops.forEach(function (op) {
      if (op.delete) n += op.delete;
    });
    return n;
  }

  function shouldConfirmReplace(selectedLen, inputType) {
    if (!isMobile() || selectedLen < LARGE_SELECTION) return false;
    if (!inputType) return true;
    if (inputType.indexOf("delete") === 0) return false;
    return (
      inputType.indexOf("insert") === 0 ||
      inputType === "insertReplacementText" ||
      inputType === "insertFromPaste" ||
      inputType === "insertFromDrop"
    );
  }

  function isQuickNoteTextarea(el) {
    return el && el.id === "docNoteBody";
  }

  function bindTextarea(el, options) {
    if (!el || el.__lkComfortBound) return;
    el.__lkComfortBound = true;
    options = options || {};

    el.addEventListener("pointerdown", function () {
      if (!isMobile()) return;
      if (isQuickNoteTextarea(el)) {
        document.body.classList.add("lk-mobile-sidebar-capture");
        el.readOnly = false;
        if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.setTarget) {
          global.LoreKeeperMobileAccessory.setTarget({ type: "textarea", el: el });
        }
        return;
      }
      if (!isWritingMode()) return;
    });

    el.addEventListener("beforeinput", function (e) {
      if (!isMobile()) return;
      if (!isWritingMode() && !isQuickNoteTextarea(el)) return;
      if (isQuickNoteTextarea(el) && !document.body.classList.contains("lk-mobile-sidebar-capture")) return;
      var selLen = Math.abs(el.selectionEnd - el.selectionStart);
      if (!shouldConfirmReplace(selLen, e.inputType)) return;
      if (!global.confirm("Replace " + selLen + " selected characters?")) {
        e.preventDefault();
      }
    });

    el.addEventListener("focus", function () {
      if (!isMobile()) return;
      if (isQuickNoteTextarea(el)) {
        document.body.classList.add("lk-mobile-sidebar-capture");
        bindKeyboardInset();
        if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.setTarget) {
          global.LoreKeeperMobileAccessory.setTarget({ type: "textarea", el: el });
        }
        global.requestAnimationFrame(function () {
          scrollCaretIntoView(el);
        });
        return;
      }
      if (!isWritingMode()) return;
      bindKeyboardInset();
      if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.setTarget) {
        global.LoreKeeperMobileAccessory.setTarget({ type: "textarea", el: el });
      }
      global.requestAnimationFrame(function () {
        scrollCaretIntoView(el);
      });
    });

    var snapshot = null;
    el.addEventListener("beforeinput", function () {
      var canTrack =
        isWritingMode() ||
        (isQuickNoteTextarea(el) && document.body.classList.contains("lk-mobile-sidebar-capture"));
      if (!canTrack) return;
      snapshot = el.value;
    });

    el.addEventListener("input", function () {
      var canUndo =
        isWritingMode() ||
        (isQuickNoteTextarea(el) && document.body.classList.contains("lk-mobile-sidebar-capture"));
      if (!canUndo || !snapshot || snapshot === el.value) return;
      var removed = Math.max(0, snapshot.length - el.value.length);
      var prev = snapshot;
      snapshot = null;
      if (removed < LARGE_DELETE) return;
      showUndoToast("Replaced a lot of text — Undo?", function () {
        el.value = prev;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        if (options.onUndo) options.onUndo();
      });
    });
  }

  function bindQuill(quill) {
    if (!quill || quill.__lkComfortBound) return;
    quill.__lkComfortBound = true;
    var root = quill.root;

    root.addEventListener("focus", function (e) {
      if (!isMobile() || isWritingMode()) return;
      e.preventDefault();
      quill.blur();
    });

    root.addEventListener("beforeinput", function (e) {
      if (!isMobile() || !isWritingMode()) return;
      var sel = quill.getSelection();
      if (!sel || sel.length < LARGE_SELECTION) return;
      if (!shouldConfirmReplace(sel.length, e.inputType)) return;
      if (!global.confirm("Replace " + sel.length + " selected characters?")) {
        e.preventDefault();
      }
    });

    quill.on("selection-change", function (range, _old, source) {
      if (source !== "user" || !range || !isMobile() || !isWritingMode()) return;
      bindKeyboardInset();
      if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.setTarget) {
        global.LoreKeeperMobileAccessory.setTarget({ type: "quill", quill: quill });
      }
      global.requestAnimationFrame(function () {
        scrollCaretIntoView(root);
      });
    });

    quill.on("text-change", function (delta, _old, source) {
      if (source !== "user" || !isWritingMode()) return;
      var deleted = deltaDeletedChars(delta);
      if (deleted < LARGE_DELETE) return;
      showUndoToast("Replaced a lot of text — Undo?", function () {
        if (quill.history && quill.history.undo) {
          quill.history.undo();
        }
      });
    });
  }

  function initDocPage(quill) {
    bindKeyboardInset();
    if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.init) {
      global.LoreKeeperMobileAccessory.init();
    }
    if (quill) {
      bindQuill(quill);
      if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.registerQuill) {
        global.LoreKeeperMobileAccessory.registerQuill(quill);
      }
      if (global.LoreKeeperWritingComplete && global.LoreKeeperWritingComplete.bindQuill) {
        global.LoreKeeperWritingComplete.bindQuill(quill);
      }
      initDocReadMode(quill);
    }
    var noteBody = document.getElementById("docNoteBody");
    if (noteBody) {
      bindTextarea(noteBody);
      if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.registerTextarea) {
        global.LoreKeeperMobileAccessory.registerTextarea(noteBody);
      }
      if (global.LoreKeeperWritingComplete && global.LoreKeeperWritingComplete.bindTextarea) {
        global.LoreKeeperWritingComplete.bindTextarea(noteBody);
      }
    }
  }

  function initHomeNotes() {
    bindKeyboardInset();
    if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.init) {
      global.LoreKeeperMobileAccessory.init();
    }
    var noteBody = document.getElementById("noteBody");
    if (noteBody) {
      bindTextarea(noteBody);
      if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.registerTextarea) {
        global.LoreKeeperMobileAccessory.registerTextarea(noteBody);
      }
      if (global.LoreKeeperWritingComplete && global.LoreKeeperWritingComplete.bindTextarea) {
        global.LoreKeeperWritingComplete.bindTextarea(noteBody);
      }
    }
  }

  global.LoreKeeperMobileComfort = {
    isMobile: isMobile,
    isWritingMode: isWritingMode,
    enterWritingMode: enterWritingMode,
    exitWritingMode: exitWritingMode,
    beginEditing: beginEditing,
    beginJotCapture: beginJotCapture,
    initDocReadMode: initDocReadMode,
    enterNoteReadMode: enterNoteReadMode,
    exitNoteReadMode: exitNoteReadMode,
    bindTextarea: bindTextarea,
    bindQuill: bindQuill,
    initDocPage: initDocPage,
    initHomeNotes: initHomeNotes,
  };
})(typeof window !== "undefined" ? window : this);
