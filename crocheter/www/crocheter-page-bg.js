/* Synced with Dictionary / Gallery via localStorage crocheter_demo_v1.pageBg */
(function (w, d) {
  "use strict";
  var V1_KEY = "crocheter_demo_v1";
  var LEVELS = ["default", "pink", "blue", "green", "yellow", "purple"];

  function readPageBg() {
    try {
      var o = JSON.parse(w.localStorage.getItem(V1_KEY) || "{}");
      return (o && o.pageBg) || null;
    } catch (e) {
      return null;
    }
  }

  function applyPageBg(slug) {
    if (slug && slug !== "default" && LEVELS.indexOf(slug) !== -1) {
      d.body.setAttribute("data-page-bg", slug);
      return;
    }
    d.body.removeAttribute("data-page-bg");
  }

  /** Run as early as possible after <body> opens (minimal flash). */
  applyPageBg(readPageBg());

  function persistPageBg(val) {
    var slug =
      val && val !== "default" && LEVELS.indexOf(val) !== -1 ?
        val :
        null;
    try {
      var o = JSON.parse(w.localStorage.getItem(V1_KEY) || "{}") || {};
      if (slug) o.pageBg = slug;
      else delete o.pageBg;
      w.localStorage.setItem(V1_KEY, JSON.stringify(o));
    } catch (e) {
      /* private mode — still apply visually */
    }
    applyPageBg(slug);
  }

  function initSelect(id) {
    var sel = d.getElementById(id);
    if (!sel || sel.dataset.pageBgBound === "1") return;
    sel.dataset.pageBgBound = "1";
    var cur = readPageBg();
    sel.value =
      cur && LEVELS.indexOf(cur) !== -1 && cur !== "default" ?
        cur :
      "default";
    sel.addEventListener("change", function () {
      persistPageBg(sel.value);
    });
  }

  w.CrocheterPageBg = {
    initSelect,
    persistPageBg,
    applyPageBg,
  };

  function autoInit() {
    initSelect("pageBgSel");
  }
  if (d.readyState === "loading") {
    d.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
})(typeof window !== "undefined" ? window : globalThis, document);
