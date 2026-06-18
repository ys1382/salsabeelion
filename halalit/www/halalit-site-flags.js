/**
 * Halalit — owner-controlled feature switches (public read).
 */
(function (global) {
  var flags = {
    bookQuestEnabled: true,
    bookcheckEnabled: true,
    scrollScannerEnabled: true,
    signupsEnabled: true,
  };
  var readyResolve;
  var ready = new Promise(function (r) {
    readyResolve = r;
  });

  function apiBase() {
    if (global.HalalitBookcheckConfig && global.HalalitBookcheckConfig.apiBase) {
      return global.HalalitBookcheckConfig.apiBase();
    }
    return "";
  }

  function isEnabled(key) {
    return flags[key] !== false;
  }

  function init() {
    var base = apiBase();
    if (!base) {
      readyResolve();
      return;
    }
    fetch(base + "/site/flags", { credentials: "include" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && data.flags) {
          Object.keys(data.flags).forEach(function (k) {
            flags[k] = data.flags[k];
          });
        }
      })
      .catch(function () {})
      .finally(function () {
        readyResolve();
        try {
          global.dispatchEvent(new Event("halalit-site-flags-ready"));
        } catch (e) {}
      });
  }

  global.HalalitSiteFlags = {
    ready: ready,
    isEnabled: isEnabled,
    all: function () {
      return Object.assign({}, flags);
    },
  };

  init();
})(typeof window !== "undefined" ? window : this);
