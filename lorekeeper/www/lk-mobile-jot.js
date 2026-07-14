/**
 * LoreKeeper — phone quick jot (#12): fast plain capture on home + doc sidebar.
 */
(function (global) {
  var LAST_WORK_KEY = "lk-last-work-tag";

  function lastWorkTag() {
    try {
      return global.localStorage.getItem(LAST_WORK_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function rememberWorkTag(tag) {
    var t = String(tag || "").trim();
    if (!t) return;
    try {
      global.localStorage.setItem(LAST_WORK_KEY, t);
    } catch (e) {
      /* ignore */
    }
  }

  function isMobile() {
    return global.LoreKeeperMobileComfort && global.LoreKeeperMobileComfort.isMobile
      ? global.LoreKeeperMobileComfort.isMobile()
      : (global.innerWidth || 0) <= 720;
  }

  function openDocQuickJot() {
    if (!isMobile()) return;
    if (global.LoreKeeperDocSidebar) {
      global.LoreKeeperDocSidebar.setTab("note");
      global.LoreKeeperDocSidebar.setOpen(true);
    }
    var el = document.getElementById("docNoteBody");
    if (!el) return;
    document.body.classList.add("lk-mobile-sidebar-capture");
    el.readOnly = false;
    if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.setTarget) {
      global.LoreKeeperMobileAccessory.setTarget({ type: "textarea", el: el });
    }
    el.focus();
    global.requestAnimationFrame(function () {
      var panel = document.getElementById("docQuickNotePanel");
      if (panel && panel.scrollIntoView) {
        panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  }

  function endSidebarCapture() {
    document.body.classList.remove("lk-mobile-sidebar-capture");
    if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.setTarget) {
      global.LoreKeeperMobileAccessory.setTarget(null);
    }
  }

  function bindDocNoteBlur() {
    var el = document.getElementById("docNoteBody");
    if (!el || el.__lkJotBlurBound) return;
    el.__lkJotBlurBound = true;
    el.addEventListener("blur", function () {
      global.setTimeout(function () {
        if (!document.body.classList.contains("lk-mobile-sidebar-capture")) return;
        var active = document.activeElement;
        var shell = document.getElementById("lkMobileAccessory");
        if (el === active) return;
        if (shell && shell.contains(active)) return;
        endSidebarCapture();
      }, 120);
    });
  }

  function openHomeQuickJot() {
    if (!isMobile()) {
      global.dispatchEvent(new CustomEvent("lorekeeper-open-note", { detail: { quickJot: false } }));
      return;
    }
    global.dispatchEvent(
      new CustomEvent("lorekeeper-open-note", {
        detail: { quickJot: true, workTag: lastWorkTag() },
      })
    );
  }

  function init() {
    bindDocNoteBlur();
    if (global.location.pathname.indexOf("index.html") >= 0 || /\/lorekeeper\/?$/.test(global.location.pathname)) {
      if (global.location.hash === "#jot" && isMobile()) {
        global.setTimeout(openHomeQuickJot, 0);
      }
    }
  }

  global.LoreKeeperMobileJot = {
    lastWorkTag: lastWorkTag,
    rememberWorkTag: rememberWorkTag,
    openHomeQuickJot: openHomeQuickJot,
    openDocQuickJot: openDocQuickJot,
    endSidebarCapture: endSidebarCapture,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : this);
