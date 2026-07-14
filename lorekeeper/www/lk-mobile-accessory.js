/**
 * LoreKeeper — mobile accessory row (#2): shortcuts + scrollable big letters + lore chips (#4).
 */
(function (global) {
  var MODE_KEY = "lk-mobile-accessory-mode";
  var SHORTCUTS = [
    { label: ".", text: "." },
    { label: ",", text: "," },
    { label: "\u201c", text: "\u201c" },
    { label: "\u2019", text: "\u2019" },
    { label: "\u2014", text: "\u2014" },
    { label: "\u2026", text: "\u2026" },
    { label: "?", text: "?" },
    { label: "!", text: "!" },
    { label: ":", text: ":" },
    { label: ";", text: ";" },
    { label: "\u00b6", text: "\n", title: "New paragraph" },
    { label: "Space", text: " " },
  ];
  var LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

  var shell = null;
  var shortcutsPanel = null;
  var chipCount = 0;
  var activeTarget = null;
  var currentMode = "shortcuts";

  function isMobile() {
    return global.LoreKeeperMobileComfort && global.LoreKeeperMobileComfort.isMobile
      ? global.LoreKeeperMobileComfort.isMobile()
      : (global.innerWidth || 0) <= 720;
  }

  function isWriting() {
    return document.body.classList.contains("lk-mobile-writing");
  }

  function getContext() {
    if (!activeTarget) return {};
    if (typeof activeTarget.getContext === "function") return activeTarget.getContext() || {};
    if (activeTarget.el && typeof activeTarget.el.__lkWriteContext === "function") {
      return activeTarget.el.__lkWriteContext() || {};
    }
    if (activeTarget.quill && typeof activeTarget.quill.__lkWriteContext === "function") {
      return activeTarget.quill.__lkWriteContext() || {};
    }
    return {};
  }

  function loadMode() {
    try {
      var saved = global.localStorage.getItem(MODE_KEY);
      if (saved === "letters" || saved === "shortcuts") currentMode = saved;
    } catch (e) {
      /* ignore */
    }
  }

  function saveMode(mode) {
    currentMode = mode;
    try {
      global.localStorage.setItem(MODE_KEY, mode);
    } catch (e) {
      /* ignore */
    }
  }

  function updateHeights() {
    var show = shell && !shell.hidden;
    if (!show) {
      document.documentElement.style.setProperty("--lk-accessory-h", "0px");
      document.documentElement.style.setProperty("--lk-complete-h", "0px");
      return;
    }
    var completeBar = document.getElementById("lkWritingCompleteBar");
    var hasComplete = completeBar && !completeBar.hidden;
    var h = 5.25;
    if (chipCount > 0) h += 2.15;
    if (hasComplete) h += 2.35;
    document.documentElement.style.setProperty("--lk-accessory-h", h + "rem");
    document.documentElement.style.setProperty("--lk-complete-h", "0px");
  }

  function isSidebarCapture() {
    return document.body.classList.contains("lk-mobile-sidebar-capture");
  }

  function updateVisibility() {
    if (!shell) return;
    var show = isMobile() && activeTarget && (isWriting() || isSidebarCapture());
    shell.hidden = !show;
    if (show) refreshChips();
    updateHeights();
  }

  function setTarget(target) {
    activeTarget = target || null;
    updateVisibility();
  }

  function getTarget() {
    return activeTarget;
  }

  function onWritingMode(on) {
    if (!on && !isSidebarCapture()) {
      activeTarget = null;
    }
    updateVisibility();
  }

  function insertIntoTextarea(el, text) {
    if (!el) return;
    var start = el.selectionStart;
    var end = el.selectionEnd;
    if (start == null || end == null) return;
    var val = el.value || "";
    el.value = val.slice(0, start) + text + val.slice(end);
    var pos = start + text.length;
    el.selectionStart = pos;
    el.selectionEnd = pos;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
  }

  function insertIntoQuill(quill, text) {
    if (!quill) return;
    var sel = quill.getSelection(true);
    var index = sel ? sel.index : Math.max(0, quill.getLength() - 1);
    quill.insertText(index, text, "user");
    quill.setSelection(index + text.length, 0, "user");
    quill.focus();
  }

  function insertText(text) {
    if (!activeTarget) return;
    if (activeTarget.type === "textarea" && activeTarget.el) {
      insertIntoTextarea(activeTarget.el, text);
      return;
    }
    if (activeTarget.type === "quill" && activeTarget.quill) {
      insertIntoQuill(activeTarget.quill, text);
    }
  }

  function armButton(btn, text, title) {
    if (title) btn.title = title;
    btn.addEventListener("mousedown", function (e) {
      e.preventDefault();
    });
    btn.addEventListener("click", function () {
      insertText(text);
    });
  }

  function truncateLabel(label) {
    var s = String(label || "");
    return s.length > 14 ? s.slice(0, 12) + "\u2026" : s;
  }

  function buildShortcuts(panel) {
    panel.innerHTML = "";
    panel.className = "lk-mobile-accessory-shortcuts-wrap";

    var punct = document.createElement("div");
    punct.className = "lk-mobile-accessory-scroll lk-mobile-accessory-punct";
    SHORTCUTS.forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lk-mobile-accessory-key";
      btn.textContent = item.label;
      armButton(btn, item.text, item.title || item.label);
      punct.appendChild(btn);
    });
    panel.appendChild(punct);

    var chips = document.createElement("div");
    chips.className = "lk-mobile-accessory-scroll lk-mobile-accessory-chips";
    chips.setAttribute("aria-label", "Names and snippets");
    chipCount = 0;
    if (global.LoreKeeperWritingGlossary) {
      var list = global.LoreKeeperWritingGlossary.getChips(getContext());
      chipCount = list.length;
      if (!list.length) {
        var hint = document.createElement("span");
        hint.className = "lk-mobile-accessory-chips-hint muted";
        hint.textContent = "Add snippets or character notes for chips";
        chips.appendChild(hint);
      } else {
        list.forEach(function (chip) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "lk-mobile-accessory-key lk-mobile-accessory-chip";
          btn.textContent = truncateLabel(chip.label);
          btn.title = chip.insert;
          armButton(btn, chip.insert, chip.insert);
          chips.appendChild(btn);
        });
      }
    }
    panel.appendChild(chips);
    updateHeights();
  }

  function refreshChips() {
    if (!shortcutsPanel) return;
    buildShortcuts(shortcutsPanel);
  }

  function buildLetters(panel) {
    panel.innerHTML = "";
    panel.className = "lk-mobile-accessory-scroll lk-mobile-accessory-letters";
    LETTERS.forEach(function (ch) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lk-mobile-accessory-key lk-mobile-accessory-key--letter";
      btn.textContent = ch;
      armButton(btn, ch);
      panel.appendChild(btn);
    });
    var spaceBtn = document.createElement("button");
    spaceBtn.type = "button";
    spaceBtn.className = "lk-mobile-accessory-key lk-mobile-accessory-key--wide";
    spaceBtn.textContent = "Space";
    armButton(spaceBtn, " ");
    panel.appendChild(spaceBtn);
  }

  function setMode(mode) {
    saveMode(mode);
    if (!shell) return;
    var tabs = shell.querySelectorAll(".lk-mobile-accessory-tab");
    var panels = shell.querySelectorAll(".lk-mobile-accessory-panel");
    tabs.forEach(function (tab) {
      var on = tab.getAttribute("data-mode") === mode;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-panel") !== mode;
    });
  }

  function ensureShell() {
    if (shell) return shell;
    loadMode();
    shell = document.createElement("div");
    shell.id = "lkMobileAccessory";
    shell.className = "lk-mobile-accessory";
    shell.hidden = true;
    shell.setAttribute("role", "toolbar");
    shell.setAttribute("aria-label", "Writing shortcuts");

    var tabs = document.createElement("div");
    tabs.className = "lk-mobile-accessory-tabs";
    tabs.setAttribute("role", "tablist");

    ["shortcuts", "letters"].forEach(function (mode) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "lk-mobile-accessory-tab";
      tab.setAttribute("role", "tab");
      tab.setAttribute("data-mode", mode);
      tab.textContent = mode === "shortcuts" ? "Shortcuts" : "Letters";
      tab.addEventListener("mousedown", function (e) {
        e.preventDefault();
      });
      tab.addEventListener("click", function () {
        setMode(mode);
      });
      tabs.appendChild(tab);
    });
    shell.appendChild(tabs);

    shortcutsPanel = document.createElement("div");
    shortcutsPanel.className = "lk-mobile-accessory-panel";
    shortcutsPanel.setAttribute("data-panel", "shortcuts");
    shortcutsPanel.setAttribute("role", "tabpanel");
    buildShortcuts(shortcutsPanel);
    shell.appendChild(shortcutsPanel);

    var lettersPanel = document.createElement("div");
    lettersPanel.className = "lk-mobile-accessory-panel";
    lettersPanel.setAttribute("data-panel", "letters");
    lettersPanel.setAttribute("role", "tabpanel");
    lettersPanel.hidden = true;
    buildLetters(lettersPanel);
    shell.appendChild(lettersPanel);

    document.body.appendChild(shell);
    setMode(currentMode);

    if (!global.__lkAccessoryGlossaryListener) {
      global.__lkAccessoryGlossaryListener = true;
      global.addEventListener("lorekeeper-writing-glossary-changed", refreshChips);
    }

    return shell;
  }

  function registerTextarea(el) {
    if (!el || el.__lkAccessoryBound) return;
    el.__lkAccessoryBound = true;
    ensureShell();
    el.addEventListener("focus", function () {
      if (!isMobile()) return;
      setTarget({ type: "textarea", el: el });
    });
  }

  function registerQuill(quill) {
    if (!quill || quill.__lkAccessoryBound) return;
    quill.__lkAccessoryBound = true;
    ensureShell();
    var root = quill.root;
    root.addEventListener("focus", function () {
      if (!isMobile()) return;
      setTarget({ type: "quill", quill: quill });
    });
  }

  function init() {
    ensureShell();
  }

  global.LoreKeeperMobileAccessory = {
    init: init,
    registerTextarea: registerTextarea,
    registerQuill: registerQuill,
    setTarget: setTarget,
    getTarget: getTarget,
    onWritingMode: onWritingMode,
    refreshChips: refreshChips,
    updateHeights: updateHeights,
    insertText: insertText,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : this);
