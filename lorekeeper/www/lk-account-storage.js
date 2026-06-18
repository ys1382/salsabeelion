/**
 * LoreKeeper — notes on the server only when signed in (no anonymous note storage).
 */
(function (global) {
  var ENTRIES_KEY = "lorekeeper_entries_v1";
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

  function apiBase() {
    return global.LoreKeeperApiConfig ? global.LoreKeeperApiConfig.apiBase() : "";
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

  function flushPending(options) {
    options = options || {};
    if (!signedIn) return Promise.resolve(0);
    var keys = Object.keys(pending);
    if (!keys.length) return Promise.resolve(0);
    var sent = keys.length;
    var batch = {};
    keys.forEach(function (k) {
      if (pending[k] === "__delete__") batch[k] = "";
      else batch[k] = pending[k];
    });
    pending = {};
    return fetch(apiBase() + "/user/data/bulk", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: batch }),
      keepalive: !!options.keepalive,
    })
      .then(function (res) {
        return res.json().catch(function () {
          return { ok: false, error: "bad_response" };
        });
      })
      .then(function (data) {
        if (data && data.ok) return sent;
        keys.forEach(function (k) {
          if (batch[k] !== undefined) pending[k] = batch[k] || "__delete__";
        });
        scheduleFlush();
        return 0;
      })
      .catch(function () {
        keys.forEach(function (k) {
          if (batch[k] !== undefined) pending[k] = batch[k] || "__delete__";
        });
        scheduleFlush();
        return 0;
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

  function refreshSession() {
    return fetchJson(apiBase() + "/auth/me", { method: "GET" })
      .then(function (me) {
        if (me && me.ok && me.signedIn) {
          signedIn = true;
          userEmail = me.email || "";
          isOwner = !!me.isOwner;
          return fetchJson(apiBase() + "/user/data", { method: "GET" }).then(function (all) {
            if (all && all.ok) hydrateFromServer(all.data);
            return true;
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
        global.dispatchEvent(new CustomEvent("lorekeeper-account-ready", { detail: { signedIn: signedIn } }));
      } catch (e) {
        global.dispatchEvent(new Event("lorekeeper-account-ready"));
      }
      updateAuthBar();
    });
  }

  function updateAuthBar() {
    var bar = global.document && global.document.getElementById("lkAuthBar");
    if (!bar) return;
    if (signedIn) {
      var label = userEmail ? userEmail.split("@")[0] : "Account";
      var ownerLink = isOwner ? ' · <a href="./office.html">Owner’s Office</a>' : "";
      bar.innerHTML =
        'Signed in as <a href="./account.html">' +
        escapeHtml(label) +
        "</a>" +
        ownerLink +
        ' · <button type="button" class="lk-signout" id="lkSignOutBtn">Sign out</button>';
      var btn = global.document.getElementById("lkSignOutBtn");
      if (btn) {
        btn.addEventListener("click", function () {
          LoreKeeperAccountStorage.signOut().then(function () {
            global.location.href = "./account.html";
          });
        });
      }
    } else {
      bar.innerHTML = '<a href="./account.html">Sign in</a>';
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  global.LoreKeeperAccountStorage = {
    ENTRIES_KEY: ENTRIES_KEY,
    OFFICE_PATH: "./office.html",
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
      if (!signedIn) return null;
      if (cacheHasValue(key)) return cache[key];
      return null;
    },
    setItem: function (key, value) {
      if (!signedIn) return false;
      cache[key] = value;
      pending[key] = value;
      scheduleFlush();
      return true;
    },
    removeItem: function (key) {
      if (!signedIn) return;
      delete cache[key];
      pending[key] = "__delete__";
      scheduleFlush();
    },
    ensureSignedIn: function () {
      var ret = encodeURIComponent(
        (global.location.pathname || "") + (global.location.search || "") + (global.location.hash || "")
      );
      global.location.href = "./account.html?return=" + ret;
    },
    refreshSession: refreshSession,
    signOut: function () {
      return fetchJson(apiBase() + "/auth/logout", { method: "POST", body: {} }).then(function () {
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
