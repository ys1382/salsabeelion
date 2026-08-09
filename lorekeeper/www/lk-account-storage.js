/**
 * LoreKeeper — sign-in required; account data syncs to the server.
 * localStorage mirrors signed-in data on this device as a sync buffer (not anonymous storage).
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
  var lastSync = { ok: true, at: 0, error: null, pendingCount: 0 };
  var flushPromise = null;
  var retryAttempt = 0;
  var lifecycleBound = false;
  var AUTH_CACHE_KEY = "lk_auth_me_v1";
  var AUTH_CACHE_MS = 30 * 60 * 1000;
  var FETCH_TIMEOUT_MS = 15000;
  var FAST_MIRROR_KEYS = [
    "lorekeeper_entries_v1",
    "lorekeeper_documents_v1",
    "lorekeeper_last_doc_v1",
    "lorekeeper_spell_words_v1",
  ];
  var serverHydratePromise = null;
  var contentHydratePromise = null;
  var dataHydrated = false;
  var contentHydrated = false;

  function dispatchSyncEvent(name, detail) {
    try {
      global.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {
      global.dispatchEvent(new Event(name));
    }
  }

  function updateSyncState(ok, error) {
    lastSync.ok = !!ok;
    lastSync.at = Date.now();
    lastSync.error = error || null;
    lastSync.pendingCount = Object.keys(pending).length;
    if (!ok) dispatchSyncEvent("lorekeeper-sync-failed", { error: lastSync.error });
    else if (lastSync.pendingCount === 0) dispatchSyncEvent("lorekeeper-sync-ok", {});
  }

  function apiBase() {
    return global.LoreKeeperApiConfig ? global.LoreKeeperApiConfig.apiBase() : "";
  }

  function accountPrefix(email) {
    if (!email) return "lk_u_anon_";
    var s = String(email).trim().toLowerCase();
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return "lk_u_" + (h >>> 0).toString(36) + "_";
  }

  function localMirrorKey(dataKey) {
    return accountPrefix(userEmail) + dataKey;
  }

  function pendingManifestKey() {
    return accountPrefix(userEmail) + "__pending";
  }

  function localGetItem(dataKey) {
    if (!global.localStorage || !userEmail) return null;
    try {
      return global.localStorage.getItem(localMirrorKey(dataKey));
    } catch (e) {
      return null;
    }
  }

  function localSetItem(dataKey, value) {
    if (!global.localStorage || !userEmail) return false;
    try {
      global.localStorage.setItem(localMirrorKey(dataKey), value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function localRemoveItem(dataKey) {
    if (!global.localStorage || !userEmail) return;
    try {
      global.localStorage.removeItem(localMirrorKey(dataKey));
    } catch (e) {}
  }

  function readPendingManifest() {
    if (!global.localStorage || !userEmail) return [];
    try {
      var raw = global.localStorage.getItem(pendingManifestKey());
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writePendingManifest(keys) {
    if (!global.localStorage || !userEmail) return;
    try {
      if (!keys.length) global.localStorage.removeItem(pendingManifestKey());
      else global.localStorage.setItem(pendingManifestKey(), JSON.stringify(keys));
    } catch (e) {}
  }

  function markPendingKey(dataKey) {
    var keys = readPendingManifest();
    if (keys.indexOf(dataKey) >= 0) return;
    keys.push(dataKey);
    writePendingManifest(keys);
  }

  function clearPendingKeys(syncedKeys) {
    if (!syncedKeys.length) return;
    var keys = readPendingManifest().filter(function (k) {
      return syncedKeys.indexOf(k) < 0;
    });
    writePendingManifest(keys);
  }

  function clearLocalMirrorForAccount(email) {
    if (!global.localStorage || !email) return;
    var prefix = accountPrefix(email);
    var toRemove = [];
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) toRemove.push(k);
      }
      toRemove.forEach(function (k) {
        global.localStorage.removeItem(k);
      });
    } catch (e) {}
  }

  function mirrorWrite(dataKey, value) {
    if (value === "__delete__") localRemoveItem(dataKey);
    else localSetItem(dataKey, value);
  }

  function readCachedAuthMe() {
    if (!global.sessionStorage) return null;
    try {
      var raw = global.sessionStorage.getItem(AUTH_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.ok || !parsed.signedIn) return null;
      if (Date.now() - (parsed.at || 0) > AUTH_CACHE_MS) return null;
      return {
        ok: true,
        signedIn: true,
        email: parsed.email || "",
        isOwner: !!parsed.isOwner,
      };
    } catch (e) {
      return null;
    }
  }

  function cacheAuthMe(me) {
    if (!me || !me.ok || !me.signedIn) return;
    try {
      global.sessionStorage.setItem(
        AUTH_CACHE_KEY,
        JSON.stringify({
          ok: true,
          signedIn: true,
          email: me.email || "",
          isOwner: !!me.isOwner,
          at: Date.now(),
        })
      );
    } catch (e) {}
  }

  function dispatchDataHydrated() {
    dataHydrated = true;
    try {
      global.dispatchEvent(new CustomEvent("lorekeeper-data-hydrated"));
    } catch (e) {
      global.dispatchEvent(new Event("lorekeeper-data-hydrated"));
    }
  }

  function hydrateFromLocalMirrorFast() {
    if (!signedIn || !global.localStorage || !userEmail) return false;
    var hydrated = false;
    FAST_MIRROR_KEYS.forEach(function (dataKey) {
      var val = localGetItem(dataKey);
      if (val != null && val !== "") {
        cache[dataKey] = val;
        hydrated = true;
      }
    });
    return hydrated;
  }

  function plainWordCount(html) {
    var text = String(html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }

  /** Prefer longer bodyHtml per document so a clipped local mirror cannot wipe the server draft. */
  function mergeDocumentsPreferLonger(localRaw, serverRaw) {
    var localList;
    var serverList;
    try {
      localList = JSON.parse(localRaw);
      serverList = JSON.parse(serverRaw);
    } catch (e) {
      return localRaw;
    }
    if (!Array.isArray(localList) || !Array.isArray(serverList)) return localRaw;
    var byId = {};
    serverList.forEach(function (d) {
      if (d && d.id) byId[d.id] = d;
    });
    var changed = false;
    localList.forEach(function (d, i) {
      if (!d || !d.id || !byId[d.id]) return;
      var s = byId[d.id];
      var lw = plainWordCount(d.bodyHtml);
      var sw = plainWordCount(s.bodyHtml);
      if (sw > 40 && sw > lw && lw < Math.floor(sw * 0.95)) {
        localList[i] = s;
        changed = true;
      }
    });
    // Keep server-only docs too.
    serverList.forEach(function (s) {
      if (!s || !s.id) return;
      var found = localList.some(function (d) {
        return d && d.id === s.id;
      });
      if (!found) {
        localList.push(s);
        changed = true;
      }
    });
    return changed ? JSON.stringify(localList) : localRaw;
  }

  function mergeIntoCache(data) {
    if (!data || typeof data !== "object") return;
    var queued = false;
    Object.keys(data).forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(pending, k)) return;
      var local = localGetItem(k);
      if (local != null && local !== "" && local !== data[k]) {
        if (k === "lorekeeper_documents_v1") {
          var merged = mergeDocumentsPreferLonger(local, data[k]);
          if (merged !== local && plainWordCountSum(merged) >= plainWordCountSum(local)) {
            cache[k] = merged;
            localSetItem(k, merged);
            return;
          }
        }
        cache[k] = local;
        pending[k] = local;
        markPendingKey(k);
        queued = true;
        return;
      }
      cache[k] = data[k];
    });
    if (queued) scheduleFlush();
  }

  function plainWordCountSum(docsRaw) {
    try {
      var list = JSON.parse(docsRaw);
      if (!Array.isArray(list)) return 0;
      var n = 0;
      list.forEach(function (d) {
        n += plainWordCount(d && d.bodyHtml);
      });
      return n;
    } catch (e) {
      return 0;
    }
  }

  function hydrateFromServer(data) {
    cache = {};
    mergeIntoCache(data);
  }

  function fetchUserData(profile) {
    var url = apiBase() + "/user/data?profile=" + encodeURIComponent(profile || "full");
    return fetchJson(url, { method: "GET" });
  }

  function startBackgroundServerHydrate() {
    if (serverHydratePromise) return serverHydratePromise;
    serverHydratePromise = fetchUserData("home")
      .then(function (all) {
        if (all && all.ok) {
          mergeIntoCache(all.data);
          dataHydrated = true;
          dispatchDataHydrated();
        }
        reconcilePendingManifest();
        return !!(all && all.ok);
      })
      .catch(function () {
        reconcilePendingManifest();
        updateSyncState(false, "network_error");
        return false;
      });
    return serverHydratePromise;
  }

  function startContentHydrate() {
    if (contentHydrated) return Promise.resolve(true);
    if (contentHydratePromise) return contentHydratePromise;
    contentHydratePromise = fetchUserData("content")
      .then(function (all) {
        if (all && all.ok) {
          mergeIntoCache(all.data);
          contentHydrated = true;
          dispatchDataHydrated();
        }
        return !!(all && all.ok);
      })
      .catch(function () {
        return false;
      });
    return contentHydratePromise;
  }

  function reconcilePendingManifest() {
    if (!signedIn || !global.localStorage) return;
    var manifest = readPendingManifest();
    if (!manifest.length) return;
    var stillPending = [];
    manifest.forEach(function (dataKey) {
      var local = localGetItem(dataKey);
      if (local == null || local === "") return;
      if (cacheHasValue(dataKey) && cache[dataKey] === local) return;
      cache[dataKey] = local;
      pending[dataKey] = local;
      stillPending.push(dataKey);
    });
    writePendingManifest(stillPending);
    if (!stillPending.length) return;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(function () {
      flushTimer = null;
      flushPending();
    }, 8000);
  }

  function applySignedInFromMe(me) {
    if (!me || !me.ok || !me.signedIn) {
      signedIn = false;
      userEmail = "";
      isOwner = false;
      return false;
    }
    signedIn = true;
    userEmail = me.email || "";
    isOwner = !!me.isOwner;
    bindLifecycle();
    hydrateFromLocalMirrorFast();
    reconcilePendingManifest();
    startBackgroundServerHydrate();
    return true;
  }

  function fetchAuthMe(options) {
    options = options || {};
    if (!options.networkOnly) {
      var cached = readCachedAuthMe();
      if (cached) return Promise.resolve(cached);
    }
    return fetchJson(apiBase() + "/auth/me", { method: "GET" }).then(function (me) {
      if (me && me.ok && me.signedIn) cacheAuthMe(me);
      return me;
    });
  }

  function refreshSession() {
    return fetchAuthMe({ networkOnly: true })
      .then(function (me) {
        if (applySignedInFromMe(me)) return true;
        signedIn = false;
        userEmail = "";
        isOwner = false;
        cache = {};
        serverHydratePromise = null;
        contentHydratePromise = null;
        dataHydrated = false;
        contentHydrated = false;
        return false;
      })
      .catch(function () {
        if (signedIn && readCachedAuthMe()) return true;
        signedIn = false;
        return false;
      });
  }

  function fetchJson(url, opts) {
    opts = opts || {};
    opts.credentials = "include";
    if (opts.body && typeof opts.body !== "string") {
      opts.headers = opts.headers || {};
      if (!opts.headers["Content-Type"]) opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    var timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : FETCH_TIMEOUT_MS;
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, timeoutMs)
      : null;
    if (controller) opts.signal = controller.signal;
    return fetch(url, opts)
      .then(function (res) {
        if (timer) clearTimeout(timer);
        return res.json().catch(function () {
          return { ok: false, error: "bad_response" };
        });
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        if (err && err.name === "AbortError") return { ok: false, error: "timeout" };
        return { ok: false, error: "network_error" };
      });
  }

  function scheduleFlush() {
    if (flushTimer) clearTimeout(flushTimer);
    retryAttempt = 0;
    flushTimer = setTimeout(function () {
      flushTimer = null;
      flushPending();
    }, 450);
  }

  function scheduleRetryFlush() {
    if (flushTimer) clearTimeout(flushTimer);
    var delays = [2000, 5000, 15000];
    var delay = delays[Math.min(retryAttempt, delays.length - 1)];
    retryAttempt += 1;
    flushTimer = setTimeout(function () {
      flushTimer = null;
      flushPending();
    }, delay);
  }

  function takePendingBatch() {
    var keys = Object.keys(pending);
    if (!keys.length) return { keys: [], batch: {} };
    var batch = {};
    keys.forEach(function (k) {
      if (pending[k] === "__delete__") batch[k] = "";
      else batch[k] = pending[k];
    });
    pending = {};
    return { keys: keys, batch: batch };
  }

  function requeueBatch(keys, batch) {
    keys.forEach(function (k) {
      if (batch[k] !== undefined) pending[k] = batch[k] || "__delete__";
    });
  }

  function sendBatch(keys, batch, options) {
    var sent = keys.length;
    return fetch(apiBase() + "/user/data/bulk", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: batch }),
      keepalive: !!(options && options.keepalive),
    })
      .then(function (res) {
        return res.json().catch(function () {
          return { ok: false, error: "bad_response" };
        });
      })
      .then(function (data) {
        if (data && data.ok) {
          clearPendingKeys(keys);
          retryAttempt = 0;
          updateSyncState(true, null);
          return sent;
        }
        requeueBatch(keys, batch);
        updateSyncState(false, (data && data.error) || "sync_failed");
        scheduleRetryFlush();
        return 0;
      })
      .catch(function () {
        requeueBatch(keys, batch);
        updateSyncState(false, "network_error");
        scheduleRetryFlush();
        return 0;
      });
  }

  function flushPending(options) {
    options = options || {};
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!signedIn) return Promise.resolve(0);
    if (!Object.keys(pending).length) return Promise.resolve(0);
    if (flushPromise) {
      return flushPromise.then(function () {
        return flushPending(options);
      });
    }
    var taken = takePendingBatch();
    if (!taken.keys.length) return Promise.resolve(0);
    flushPromise = sendBatch(taken.keys, taken.batch, options).finally(function () {
      flushPromise = null;
      if (Object.keys(pending).length && !flushTimer) scheduleFlush();
    });
    return flushPromise;
  }

  function parkPendingSync() {
    if (!signedIn || !Object.keys(pending).length) return;
    flushPending({ keepalive: true });
  }

  function bindLifecycle() {
    if (lifecycleBound || !global.addEventListener) return;
    lifecycleBound = true;
    global.addEventListener("pagehide", parkPendingSync);
    if (global.document) {
      global.document.addEventListener("visibilitychange", function () {
        if (global.document.visibilityState === "hidden") parkPendingSync();
      });
    }
    global.addEventListener("online", function () {
      if (signedIn && Object.keys(pending).length) {
        retryAttempt = 0;
        flushPending();
      }
    });
  }

  function cacheHasValue(key) {
    return Object.prototype.hasOwnProperty.call(cache, key) && cache[key] != null && cache[key] !== "";
  }

  function init() {
    var cached = readCachedAuthMe();
    if (cached && applySignedInFromMe(cached)) {
      readyResolve();
      try {
        global.dispatchEvent(
          new CustomEvent("lorekeeper-account-ready", { detail: { signedIn: true } })
        );
      } catch (e) {
        global.dispatchEvent(new Event("lorekeeper-account-ready"));
      }
      updateAuthBar();
      fetchAuthMe({ networkOnly: true })
        .then(function (me) {
          if (me && me.ok && me.signedIn) {
            var email = me.email || "";
            var owner = !!me.isOwner;
            if (email !== userEmail || owner !== isOwner) {
              applySignedInFromMe(me);
              updateAuthBar();
            }
            return;
          }
          if (me && me.ok && !me.signedIn) {
            signedIn = false;
            userEmail = "";
            isOwner = false;
            try {
              global.sessionStorage.removeItem(AUTH_CACHE_KEY);
            } catch (e) {}
            updateAuthBar();
          }
        })
        .catch(function () {});
      return;
    }
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
      var local = localGetItem(key);
      if (local != null && local !== "") {
        cache[key] = local;
        return local;
      }
      return null;
    },
    setItem: function (key, value) {
      if (!signedIn) return false;
      cache[key] = value;
      pending[key] = value;
      mirrorWrite(key, value);
      markPendingKey(key);
      scheduleFlush();
      return true;
    },
    removeItem: function (key) {
      if (!signedIn) return;
      delete cache[key];
      pending[key] = "__delete__";
      mirrorWrite(key, "__delete__");
      markPendingKey(key);
      scheduleFlush();
    },
    ensureSignedIn: function () {
      var ret = encodeURIComponent(
        (global.location.pathname || "") + (global.location.search || "") + (global.location.hash || "")
      );
      global.location.href = "./account.html?return=" + ret;
    },
    refreshSession: refreshSession,
    waitForData: function (options) {
      options = options || {};
      var chain;
      if (dataHydrated) {
        chain = Promise.resolve(true);
      } else if (serverHydratePromise) {
        chain = serverHydratePromise;
      } else {
        chain = refreshSession();
      }
      if (options.content && !contentHydrated) {
        chain = chain.then(function () {
          return startContentHydrate();
        });
      }
      return chain;
    },
    loadContent: startContentHydrate,
    signOut: function () {
      var email = userEmail;
      return fetchJson(apiBase() + "/auth/logout", { method: "POST", body: {} }).then(function () {
        clearLocalMirrorForAccount(email);
        try {
          global.sessionStorage.removeItem(AUTH_CACHE_KEY);
        } catch (e) {}
        serverHydratePromise = null;
        contentHydratePromise = null;
        dataHydrated = false;
        contentHydrated = false;
        signedIn = false;
        userEmail = "";
        isOwner = false;
        cache = {};
        pending = {};
        return true;
      });
    },
    flush: flushPending,
    hasPending: function () {
      return Object.keys(pending).length > 0;
    },
    getSyncStatus: function () {
      return {
        ok: lastSync.ok,
        at: lastSync.at,
        error: lastSync.error,
        pendingCount: Object.keys(pending).length,
      };
    },
    retrySync: function () {
      retryAttempt = 0;
      return flushPending();
    },
  };

  init();
})(typeof window !== "undefined" ? window : this);
