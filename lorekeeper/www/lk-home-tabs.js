/**
 * LoreKeeper home — Stories / Find / Idea spinner / Word help / Feedback (Halalit-style site tabs).
 * Ask LoreKeeper lives on the Stories page (not its own top tab).
 */
(function (global) {
  var TAB_META = [
    { btn: "tab-btn-stories", panel: "panel-stories", hash: "" },
    { btn: "tab-btn-find", panel: "panel-find", hash: "#find" },
    { btn: "tab-btn-spinner", panel: "panel-spinner", hash: "#spinner" },
    { btn: "tab-btn-word-help", panel: "panel-word-help", hash: "#word-help" },
    { btn: "tab-btn-feedback", panel: "panel-feedback", hash: "#feedback" },
  ];

  var spinnerReady = false;
  var wordHelpReady = false;

  function lastFocus() {
    return global.LoreKeeperLastFocus || null;
  }

  function tabIndexForPanel(panelId) {
    for (var i = 0; i < TAB_META.length; i++) {
      if (TAB_META[i].panel === panelId) return i;
    }
    return 0;
  }

  function focusFindInput() {
    var findBox = document.getElementById("findBox");
    if (!findBox || typeof findBox.focus !== "function") return;
    global.requestAnimationFrame(function () {
      try {
        findBox.focus({ preventScroll: true });
      } catch (e1) {
        findBox.focus();
      }
    });
  }

  function scrollToAsk(opts) {
    opts = opts || {};
    var askQ = document.getElementById("askQuestion");
    var askPanel = document.getElementById("panel-ask");
    var target = askQ || askPanel;
    if (!target || typeof target.scrollIntoView !== "function") return;
    global.requestAnimationFrame(function () {
      target.scrollIntoView({
        block: opts.block || "nearest",
        behavior: opts.behavior || "smooth",
      });
      if (opts.focus && askQ && typeof askQ.focus === "function") {
        try {
          askQ.focus({ preventScroll: true });
        } catch (e1) {
          askQ.focus();
        }
      }
    });
  }

  function selectTab(index, opts) {
    opts = opts || {};
    if (typeof index !== "number" || index < 0 || index >= TAB_META.length) index = 0;
    for (var i = 0; i < TAB_META.length; i++) {
      var b = document.getElementById(TAB_META[i].btn);
      var p = document.getElementById(TAB_META[i].panel);
      var on = i === index;
      if (b) {
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
      }
      if (p) p.hidden = !on;
    }
    var cur = TAB_META[index];
    if (cur && cur.panel === "panel-spinner" && !spinnerReady) {
      spinnerReady = true;
      if (global.LoreKeeperSpinner && typeof global.LoreKeeperSpinner.init === "function") {
        global.LoreKeeperSpinner.init();
      }
    }
    if (cur && cur.panel === "panel-word-help" && !wordHelpReady) {
      wordHelpReady = true;
      if (global.LoreKeeperWordHelp && typeof global.LoreKeeperWordHelp.init === "function") {
        global.LoreKeeperWordHelp.init();
      }
    }

    var lf = lastFocus();
    if (opts.userPick && lf) {
      if (cur && cur.panel === "panel-word-help") lf.setWordHelp();
      if (opts.markAsk && cur && cur.panel === "panel-stories") lf.setAsk();
    }

    if (opts.resumeScroll && lf && cur) {
      if (opts.scrollAsk || (lf.get && lf.get() && lf.get().place === "ask")) {
        scrollToAsk({ behavior: "auto", block: "end" });
      } else {
        lf.scrollPanelToBottom(cur.panel);
      }
    } else if (opts.scrollAsk && cur && cur.panel === "panel-stories" && !opts.skipScroll) {
      scrollToAsk({ focus: true });
    } else if (cur && cur.panel === "panel-find" && !opts.skipScroll) {
      focusFindInput();
    }

    try {
      var tail = opts.hashOverride != null ? opts.hashOverride : cur ? cur.hash || "" : "";
      var u = window.location.pathname + window.location.search + tail;
      window.history.replaceState({}, "", u);
    } catch (e1) {}
  }

  function goToAsk(opts) {
    opts = opts || {};
    selectTab(tabIndexForPanel("panel-stories"), {
      userPick: true,
      markAsk: true,
      scrollAsk: true,
      hashOverride: "#ask",
      skipScroll: !!opts.skipScroll,
    });
  }

  function applyHash() {
    var h = (window.location.hash || "").toLowerCase();
    var lf = lastFocus();
    var focus = lf && lf.get ? lf.get() : null;

    if (!h || h === "#" || h === "#stories" || h === "#home") {
      if (focus && focus.place === "word-help") {
        selectTab(tabIndexForPanel("panel-word-help"), { resumeScroll: true, skipScroll: true });
        return;
      }
      if (focus && focus.place === "ask") {
        selectTab(0, { resumeScroll: true, skipScroll: true, scrollAsk: true, hashOverride: "#ask" });
        return;
      }
      selectTab(0, { skipScroll: true });
      return;
    }

    if (h === "#find" || h === "#search") {
      selectTab(tabIndexForPanel("panel-find"), { userPick: true });
    } else if (h === "#spinner" || h === "#idea-spinner") {
      selectTab(tabIndexForPanel("panel-spinner"));
    } else if (h === "#word-help" || h === "#thesaurus") {
      selectTab(tabIndexForPanel("panel-word-help"), { userPick: true });
    } else if (h === "#feedback") {
      selectTab(tabIndexForPanel("panel-feedback"));
    } else if (h === "#ask") {
      goToAsk();
    } else {
      selectTab(0);
    }
  }

  function init() {
    var nav = document.querySelector(".lk-site-tabs");
    if (!nav || nav.dataset.lkBound === "1") return;
    nav.dataset.lkBound = "1";
    for (var t = 0; t < TAB_META.length; t++) {
      (function (idx) {
        var btn = document.getElementById(TAB_META[idx].btn);
        if (!btn) return;
        btn.addEventListener("click", function () {
          selectTab(idx, { userPick: true });
        });
      })(t);
    }
    window.addEventListener("hashchange", applyHash);
    applyHash();
  }

  global.LoreKeeperHomeTabs = {
    init: init,
    goTo: function (panelId) {
      if (panelId === "panel-ask") {
        goToAsk();
        return;
      }
      selectTab(tabIndexForPanel(panelId), { userPick: true });
    },
    goToAsk: goToAsk,
  };
})(typeof window !== "undefined" ? window : this);
