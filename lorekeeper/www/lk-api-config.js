/**
 * LoreKeeper — API base URL (nginx /lorekeeper/api/ on production).
 */
(function (global) {
  function apiBase() {
    if (global.LOREKEEPER_API_BASE) {
      return String(global.LOREKEEPER_API_BASE).replace(/\/$/, "");
    }
    var loc = global.location;
    if (!loc || !loc.hostname) return "";
    var path = String(loc.pathname || "");
    if (path.indexOf("/lorekeeper") !== -1) {
      var basePath = path.replace(/\/?[^/]*\.html?$/i, "").replace(/\/$/, "");
      if (basePath.slice(-11) !== "/lorekeeper") {
        var idx = basePath.indexOf("/lorekeeper");
        if (idx !== -1) basePath = basePath.slice(0, idx + "/lorekeeper".length);
      }
      return loc.origin + basePath + "/api";
    }
    var port = global.LOREKEEPER_API_PORT || "8080";
    return loc.protocol + "//" + loc.hostname + ":" + port + "/api";
  }

  global.LoreKeeperApiConfig = { apiBase: apiBase };
})(typeof window !== "undefined" ? window : this);
