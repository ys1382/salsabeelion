/**
 * Scroll Scanner — owner preview only. Tab stays hidden until unlocked on this device.
 * Unlock once: add ?scrollscanner=preview to the Halalit URL (bookmark it).
 */
(function (global) {
  var STORAGE_KEY = "halalit_scroll_scanner_unlock";
  var PARAM = "scrollscanner";
  var PARAM_VALUE = "preview";

  function isUnlocked() {
    try {
      if (global.localStorage && global.localStorage.getItem(STORAGE_KEY) === "1") return true;
    } catch (e1) {}
    try {
      var loc = global.location;
      if (!loc || !loc.search) return false;
      var qs = new URLSearchParams(loc.search);
      if (qs.get(PARAM) === PARAM_VALUE) {
        try {
          if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, "1");
        } catch (e2) {}
        return true;
      }
    } catch (e3) {}
    return false;
  }

  function revealTab() {
    var btn = global.document && global.document.getElementById("tab-btn-scroll-scanner");
    if (btn) btn.hidden = false;
  }

  var unlocked = isUnlocked();
  if (unlocked) {
    if (global.document && global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", revealTab);
    } else {
      revealTab();
    }
  }

  global.HalalitScrollScannerUnlock = {
    isUnlocked: function () {
      return unlocked;
    },
  };
})(typeof window !== "undefined" ? window : this);
