/**
 * Halalit Bookcheck — AI theme API base URL (same host, port 8075 on production).
 */
(function (global) {
  function apiBase() {
    if (global.HALALIT_BOOKCHECK_AI_API_BASE) {
      return String(global.HALALIT_BOOKCHECK_AI_API_BASE).replace(/\/$/, "");
    }
    var loc = global.location;
    if (!loc || !loc.hostname) return "";
    var path = String(loc.pathname || "");
    if (path.indexOf("/halalit") !== -1) {
      var basePath = path.replace(/\/?index\.html?$/i, "").replace(/\/$/, "");
      if (basePath.slice(-7) !== "/halalit") {
        var idx = basePath.indexOf("/halalit");
        if (idx !== -1) basePath = basePath.slice(0, idx + "/halalit".length);
      }
      return loc.origin + basePath + "/api";
    }
    var port = global.HALALIT_BOOKCHECK_AI_API_PORT || "8075";
    return loc.protocol + "//" + loc.hostname + ":" + port;
  }

  function apiUrl(suffix) {
    var base = apiBase();
    if (!base) return "";
    if (base.indexOf("/halalit/api") !== -1) {
      return base + suffix;
    }
    return base + "/api" + suffix;
  }

  global.HalalitBookcheckConfig = {
    apiBase: apiBase,
    aiThemeScanUrl: function () {
      return apiUrl("/theme-scan");
    },
    aiCoverIdentifyUrl: function () {
      return apiUrl("/cover-identify");
    },
    ownerShelfIdentifyUrl: function () {
      return apiUrl("/owner/shelf-identify");
    },
    aiHealthUrl: function () {
      return apiUrl("/health");
    },
    lookupRecordUrl: function () {
      return apiUrl("/lookup/record");
    },
    lookupSignalUrl: function () {
      return apiUrl("/lookup/signal");
    },
    ownerReviewPendingUrl: function () {
      return apiUrl("/lookup/owner-review-pending");
    },
    libraryCheckUrl: function () {
      return apiUrl("/library/check");
    },
  };
})(typeof window !== "undefined" ? window : this);
