/**
 * Designer-only affordances (same token as play.html reader-note bypass).
 * Visit any Halalit page with ?halalitDesigner=Inkblood once per browser, or ?halalitDesigner=off to clear.
 * Token is not shown in page copy; it lives in this file and designer bookmarks only.
 */
(function (global) {
  var DESIGNER_BYPASS_STORAGE = "halalitDesignerBypass";
  var DESIGNER_BYPASS_TOKEN = "Inkblood";

  function designerBypassActive() {
    try {
      return localStorage.getItem(DESIGNER_BYPASS_STORAGE) === "1";
    } catch (e) {
      return false;
    }
  }

  function applyDesignerUrlParamOnce() {
    try {
      var p = new URLSearchParams(global.location.search);
      if (!p.has("halalitDesigner")) return;
      var v = p.get("halalitDesigner");
      if (v === "off" || v === "0" || v === "") {
        global.localStorage.removeItem(DESIGNER_BYPASS_STORAGE);
      } else if (v === DESIGNER_BYPASS_TOKEN) {
        global.localStorage.setItem(DESIGNER_BYPASS_STORAGE, "1");
      }
      p.delete("halalitDesigner");
      var u = new URL(global.location.href);
      u.search = p.toString() ? "?" + p.toString() : "";
      global.history.replaceState({}, "", u.pathname + u.search + u.hash);
    } catch (e) {}
  }

  global.HalalitDesignerGate = {
    designerBypassActive: designerBypassActive,
    applyDesignerUrlParamOnce: applyDesignerUrlParamOnce
  };
})(typeof window !== "undefined" ? window : this);
