/**
 * Crocheter — pattern progress and prefs: local device storage by default;
 * server-backed when signed in (device data migrates on first sign-in).
 */
(function (global) {
  var cache = {};
  var signedIn = false;
  var userEmail = "";
  var isOwner = false;
  var readyResolve;
  var ready = new Promise(function (resolve) {
    readyResolve = resolve;
  });
  var flushTimer = null;
  var pending = {};

  var MIGRATION_KEYS = [
    "crocheter_demo_v1",
    "crocheter_demo_v2",
    "crocheter_difficulty_overrides_v1",
  ];

  function apiBase() {
    if (global.CrocheterApiConfig && typeof global.CrocheterApiConfig.apiBase === "function") {
      return global.CrocheterApiConfig.apiBase();
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

  function fetchJson(url, opts) {
    opts = opts || {};
    opts.credentials = "include";
    if (opts.body && typeof opts.body !== "string") {
      opts.headers = opts.headers || {};
      if (!opts.headers["Content-Type"]) opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: "bad_response" };
      });
    });
  }

  function scheduleFlush() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushPending, 450);
  }

  function flushPending() {
    if (!signedIn) return;
    var keys = Object.keys(pending);
    if (!keys.length) return;
    var batch = {};
    keys.forEach(function (k) {
      if (pending[k] === "__delete__") batch[k] = "";
      else batch[k] = pending[k];
    });
    pending = {};
    fetchJson(apiBase() + "/user/data/bulk", { method: "POST", body: { data: batch } }).catch(function () {
      keys.forEach(function (k) {
        if (batch[k] !== undefined) pending[k] = batch[k] || "__delete__";
      });
      scheduleFlush();
    });
  }

  function hydrateFromServer(data) {
    cache = {};
    if (data && typeof data === "object") {
      Object.keys(data).forEach(function (k) {
        cache[k] = data[k];
      });
    }
  }

  function cacheHasValue(key) {
    return Object.prototype.hasOwnProperty.call(cache, key) && cache[key] != null && cache[key] !== "";
  }

  function backfillCacheFromDevice() {
    if (!signedIn || !global.localStorage) return false;
    var changed = false;
    MIGRATION_KEYS.forEach(function (k) {
      if (cacheHasValue(k)) return;
      var local = localGetItem(k);
      if (local != null && local !== "") {
        cache[k] = local;
        pending[k] = local;
        changed = true;
      }
    });
    if (changed) scheduleFlush();
    return changed;
  }

  function clearMigratedDeviceKeys() {
    MIGRATION_KEYS.forEach(function (k) {
      if (cacheHasValue(k)) localRemoveItem(k);
    });
  }

  function collectLocalDeviceData() {
    var out = {};
    if (!global.localStorage) return out;
    MIGRATION_KEYS.forEach(function (k) {
      try {
        var v = global.localStorage.getItem(k);
        if (v != null && v !== "") out[k] = v;
      } catch (e) {}
    });
    return out;
  }

  function localGetItem(key) {
    if (!global.localStorage) return null;
    try {
      return global.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function localSetItem(key, value) {
    if (!global.localStorage) return false;
    try {
      global.localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function localRemoveItem(key) {
    if (!global.localStorage) return;
    try {
      global.localStorage.removeItem(key);
    } catch (e) {}
  }

  function copyAccountCacheToDevice() {
    if (!global.localStorage || !cache) return;
    Object.keys(cache).forEach(function (k) {
      if (cache[k] != null && cache[k] !== "") localSetItem(k, cache[k]);
    });
  }

  function migrateFromDevice() {
    if (!signedIn) return Promise.resolve(false);
    backfillCacheFromDevice();
    var local = collectLocalDeviceData();
    if (!Object.keys(local).length) return Promise.resolve(true);
    return fetchJson(apiBase() + "/user/data/bulk", { method: "POST", body: { data: local } })
      .then(function (res) {
        if (res && res.ok) {
          return fetchJson(apiBase() + "/user/data", { method: "GET" }).then(function (all) {
            if (all && all.ok) hydrateFromServer(all.data);
            backfillCacheFromDevice();
            clearMigratedDeviceKeys();
            return true;
          });
        }
        backfillCacheFromDevice();
        return false;
      })
      .catch(function () {
        backfillCacheFromDevice();
        return false;
      });
  }

  function refreshSession() {
    return fetchJson(apiBase() + "/auth/me", { method: "GET" })
      .then(function (me) {
        if (me && me.ok && me.signedIn) {
          signedIn = true;
          userEmail = me.email || "";
          isOwner = !!me.isOwner;
          return fetchJson(apiBase() + "/user/data", { method: "GET" }).then(function (all) {
            if (all && all.ok) hydrateFromServer(all.data);
            backfillCacheFromDevice();
            return migrateFromDevice();
          });
        }
        signedIn = false;
        userEmail = "";
        isOwner = false;
        cache = {};
        return false;
      })
      .catch(function () {
        signedIn = false;
        return false;
      });
  }

  function init() {
    refreshSession().finally(function () {
      readyResolve();
      try {
        global.dispatchEvent(new CustomEvent("crocheter-account-ready", { detail: { signedIn: signedIn } }));
      } catch (e) {
        global.dispatchEvent(new Event("crocheter-account-ready"));
      }
      updateAuthBar();
    });
  }

  function updateAuthBar() {
    var bar = global.document && global.document.getElementById("crocheterAuthBar");
    if (!bar) return;
    if (signedIn) {
      var label = userEmail ? userEmail.split("@")[0] : "Account";
      var studioPath = global.CrocheterAccountStorage.STUDIO_PATH || "./studio.html";
      var ownerLink = isOwner ? ' · <a href="' + studioPath + '">Owner’s Office</a>' : "";
      bar.innerHTML =
        'Signed in as <a href="./account.html">' +
        escapeHtml(label) +
        "</a>" +
        ownerLink +
        ' · <button type="button" class="auth-signout" id="crocheterSignOutBtn">Sign out</button>';
      var btn = global.document.getElementById("crocheterSignOutBtn");
      if (btn) {
        btn.addEventListener("click", function () {
          CrocheterAccountStorage.signOut().then(function () {
            global.location.reload();
          });
        });
      }
    } else {
      bar.innerHTML =
        '<a href="./account.html">Sign in</a> <span class="muted">— progress saves on this device; sign in to sync</span>';
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  global.CrocheterAccountStorage = {
    STUDIO_PATH: "./studio.html",
    ready: ready,
    apiBase: apiBase,
    isSignedIn: function () {
      return signedIn;
    },
    isOwner: function () {
      return isOwner;
    },
    getEmail: function () {
      return userEmail;
    },
    getItem: function (key) {
      if (signedIn) {
        if (cacheHasValue(key)) return cache[key];
        var local = localGetItem(key);
        if (local != null && local !== "") {
          cache[key] = local;
          pending[key] = local;
          scheduleFlush();
          return local;
        }
        return null;
      }
      return localGetItem(key);
    },
    setItem: function (key, value) {
      if (!signedIn) return localSetItem(key, value);
      cache[key] = value;
      pending[key] = value;
      scheduleFlush();
      return true;
    },
    removeItem: function (key) {
      if (!signedIn) {
        localRemoveItem(key);
        return;
      }
      delete cache[key];
      pending[key] = "__delete__";
      scheduleFlush();
    },
    isDeviceStorage: function () {
      return !signedIn;
    },
    ensureSignedIn: function () {
      var ret = encodeURIComponent(
        (global.location.pathname || "") + (global.location.search || "") + (global.location.hash || "")
      );
      global.location.href = "./account.html?return=" + ret;
    },
    refreshSession: refreshSession,
    migrateFromDevice: migrateFromDevice,
    signOut: function () {
      return fetchJson(apiBase() + "/auth/logout", { method: "POST", body: {} }).then(function () {
        copyAccountCacheToDevice();
        signedIn = false;
        userEmail = "";
        isOwner = false;
        cache = {};
        pending = {};
        return true;
      });
    },
    flush: flushPending,
  };

  init();
})(typeof window !== "undefined" ? window : this);
