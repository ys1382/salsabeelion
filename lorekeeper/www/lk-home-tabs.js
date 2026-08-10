/**
 * LoreKeeper home — Ask / Idea spinner / Word help tabs (Halalit-style).
 */
(function (global) {
  var TAB_META = [
    { btn: "tab-btn-ask", panel: "panel-ask", hash: "#ask" },
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
      if (cur && cur.panel === "panel-ask") lf.setAsk();
      if (cur && cur.panel === "panel-word-help") lf.setWordHelp();
    }

    if (opts.resumeScroll && lf && cur) {
      lf.scrollPanelToBottom(cur.panel);
    } else if (cur && cur.panel === "panel-ask" && !opts.skipScroll) {
      var askQ = document.getElementById("askQuestion");
      if (askQ && typeof askQ.scrollIntoView === "function") {
        global.requestAnimationFrame(function () {
          askQ.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      }
    }

    try {
      var tail = cur ? cur.hash || "" : "";
      var u = window.location.pathname + window.location.search + tail;
      window.history.replaceState({}, "", u);
    } catch (e1) {}
  }

  function applyHash() {
    var h = (window.location.hash || "").toLowerCase();
    var lf = lastFocus();
    var focus = lf && lf.get ? lf.get() : null;

    if (!h || h === "#") {
      if (focus && focus.place === "word-help") {
        selectTab(tabIndexForPanel("panel-word-help"), { resumeScroll: true, skipScroll: true });
        return;
      }
      if (focus && focus.place === "ask") {
        selectTab(tabIndexForPanel("panel-ask"), { resumeScroll: true, skipScroll: true });
        return;
      }
      selectTab(0, { skipScroll: true });
      return;
    }

    if (h === "#spinner" || h === "#idea-spinner") {
      selectTab(tabIndexForPanel("panel-spinner"));
    } else if (h === "#word-help" || h === "#thesaurus") {
      selectTab(tabIndexForPanel("panel-word-help"), { userPick: true });
    } else if (h === "#feedback") {
      selectTab(tabIndexForPanel("panel-feedback"));
    } else if (h === "#ask") {
      selectTab(tabIndexForPanel("panel-ask"), { userPick: true });
    } else {
      selectTab(0);
    }
  }

  function init() {
    var nav = document.querySelector(".lk-tools-tabs");
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
      selectTab(tabIndexForPanel(panelId), { userPick: true });
    },
  };
})(typeof window !== "undefined" ? window : this);
