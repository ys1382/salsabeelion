/**
 * Crocheter — API base URL (nginx /crocheter/api/ on production).
 */
(function (global) {
  function apiBase() {
    if (global.CROCHETER_API_BASE) {
      return String(global.CROCHETER_API_BASE).replace(/\/$/, "");
    }
    var loc = global.location;
    if (!loc || !loc.hostname) return "";
    var path = String(loc.pathname || "");
    if (path.indexOf("/crocheter") !== -1) {
      var basePath = path.replace(/\/?[^/]*\.html?$/i, "").replace(/\/$/, "");
      if (basePath.slice(-10) !== "/crocheter") {
        var idx = basePath.indexOf("/crocheter");
        if (idx !== -1) basePath = basePath.slice(0, idx + "/crocheter".length);
      }
      return loc.origin + basePath + "/api";
    }
    var port = global.CROCHETER_API_PORT || "8076";
    return loc.protocol + "//" + loc.hostname + ":" + port + "/api";
  }

  global.CrocheterApiConfig = {
    apiBase: apiBase,
  };
})(typeof window !== "undefined" ? window : this);
