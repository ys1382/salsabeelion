/**
 * Wildlife codex learns — device cache + Odd Trove Google account sync.
 * One entry per species + life stage; stills are stylized field-guide art only (never raw camera).
 * Fact book entries sync in the same account blob (see BaneCodexFacts).
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "bane_codex_learned_v1";
  var MAX_ENTRIES = 48;
  var API_LEARNED = "/bane-of-extinction/api/learned";
  var API_ME = "/bane-of-extinction/api/auth/me";
  var GOOGLE_START =
    "https://oddtrove.art/hub/api/auth/google/start?return=" +
    encodeURIComponent("/bane-of-extinction/codex.html");

  var syncState = {
    signedIn: false,
    email: "",
    syncing: false,
    lastError: "",
  };

  function factsApi() {
    return global.BaneCodexFacts || null;
  }

  function readFactsLocal() {
    var F = factsApi();
    return F && F.readAll ? F.readAll() : [];
  }

  function writeFactsMerged(remoteFacts) {
    var F = factsApi();
    if (!F || !F.mergeLists || !F.writeAll) return readFactsLocal();
    var merged = F.mergeLists(F.readAll(), remoteFacts || []);
    F.writeAll(merged);
    return merged;
  }

  function slugPart(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function entryKey(record) {
    var latin = slugPart(record && record.latinName);
    var base = "";
    if (latin) base = "lat:" + latin;
    else {
      var common = slugPart(record && (record.commonName || record.displayName));
      if (common) base = "com:" + common;
    }
    if (!base) return "";
    var stage = slugPart(record && record.lifeStage) || "unspecified";
    return (base + "|st:" + stage).slice(0, 120);
  }

  function speciesOnlyKey(record) {
    var latin = slugPart(record && record.latinName);
    if (latin) return "lat:" + latin;
    var common = slugPart(record && (record.commonName || record.displayName));
    if (common) return "com:" + common;
    return "";
  }

  function migrateEntryKey(entry) {
    if (!entry || typeof entry !== "object") return entry;
    if (entry.key && String(entry.key).indexOf("|st:") >= 0) return entry;
    var next = entryKey(entry);
    if (next) entry.key = next;
    return entry;
  }

  function readAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list
        .map(migrateEntryKey)
        .filter(function (e) {
          return e && e.key && (e.commonName || e.displayName);
        });
    } catch (e) {
      return [];
    }
  }

  function writeAll(list) {
    var packed = JSON.stringify(list);
    try {
      localStorage.setItem(STORAGE_KEY, packed);
      return true;
    } catch (e) {
      var trimmed = list.slice();
      var i;
      for (i = trimmed.length - 1; i >= 0 && trimmed.length > 1; i--) {
        if (trimmed[i].stillBase64) {
          trimmed[i] = Object.assign({}, trimmed[i], {
            stillBase64: "",
            stillMime: "",
          });
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
            return true;
          } catch (e2) {}
        }
      }
      while (trimmed.length > 1) {
        trimmed.pop();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
          return true;
        } catch (e3) {}
      }
      return false;
    }
  }

  function mergeLists(local, remote) {
    var byKey = {};
    function take(src) {
      if (!src || !src.key) return;
      var prev = byKey[src.key];
      if (!prev) {
        byKey[src.key] = Object.assign({}, src);
        return;
      }
      var aSeen = Number(src.lastSeenAt) || 0;
      var bSeen = Number(prev.lastSeenAt) || 0;
      var newer = aSeen >= bSeen ? src : prev;
      var older = newer === src ? prev : src;
      var merged = Object.assign({}, newer);
      if (!merged.stillBase64 && older.stillBase64) {
        merged.stillBase64 = older.stillBase64;
        merged.stillMime = older.stillMime || "image/jpeg";
      }
      ["latinName", "cultivar", "bloomColor", "lifeStage", "shortNote", "organismType"].forEach(
        function (field) {
          if (!merged[field] && older[field]) merged[field] = older[field];
        }
      );
      merged.learnedAt = Math.min(
        Number(merged.learnedAt) || Date.now(),
        Number(older.learnedAt) || Date.now()
      );
      merged.encounterCount = Math.max(
        Number(merged.encounterCount) || 1,
        Number(older.encounterCount) || 1
      );
      byKey[src.key] = merged;
    }
    (remote || []).forEach(take);
    (local || []).forEach(take);
    return Object.keys(byKey)
      .map(function (k) {
        return byKey[k];
      })
      .sort(function (a, b) {
        return (Number(b.lastSeenAt) || 0) - (Number(a.lastSeenAt) || 0);
      })
      .slice(0, MAX_ENTRIES);
  }

  function upsert(record, still) {
    if (!record) return null;
    var key = entryKey(record);
    if (!key) return null;
    var list = readAll();
    var now = Date.now();
    var idx = -1;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].key === key) {
        idx = i;
        break;
      }
    }
    var prev = idx >= 0 ? list[idx] : null;
    var stillMime =
      (still && still.mimeType) ||
      (still && still.stillMime) ||
      (prev && prev.stillMime) ||
      "";
    var stillBase64 =
      (still && still.imageBase64) ||
      (still && still.stillBase64) ||
      (prev && prev.stillBase64) ||
      "";
    var entry = {
      key: key,
      displayName:
        (record.displayName || record.commonName || (prev && prev.displayName) || "").trim(),
      commonName:
        (record.commonName || (prev && prev.commonName) || "").trim(),
      latinName: (record.latinName || (prev && prev.latinName) || "").trim(),
      cultivar: (record.cultivar || (prev && prev.cultivar) || "").trim(),
      bloomColor: (record.bloomColor || (prev && prev.bloomColor) || "").trim(),
      organismType:
        (record.organismType || (prev && prev.organismType) || "other").trim(),
      lifeStage: (record.lifeStage || (prev && prev.lifeStage) || "").trim(),
      shortNote: (record.shortNote || (prev && prev.shortNote) || "").trim(),
      evidence: !!(record.evidence != null ? record.evidence : prev && prev.evidence),
      stillMime: stillMime.split(";")[0] || "",
      stillBase64: stillBase64,
      learnedAt: (prev && prev.learnedAt) || now,
      lastSeenAt: now,
      encounterCount: ((prev && prev.encounterCount) || 0) + 1,
    };
    if (idx >= 0) list.splice(idx, 1);
    list.unshift(entry);
    if (list.length > MAX_ENTRIES) list = list.slice(0, MAX_ENTRIES);
    writeAll(list);
    schedulePush();
    return entry;
  }

  function getByKey(key) {
    var list = readAll();
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].key === key) return list[i];
    }
    return null;
  }

  /** Still for this species + life stage (local library), if any. */
  function existingStillFor(record) {
    if (!record) return null;
    var key = entryKey(record);
    var entry = key ? getByKey(key) : null;
    if ((!entry || !entry.stillBase64) && speciesOnlyKey(record)) {
      var legacy = getByKey(speciesOnlyKey(record));
      if (
        legacy &&
        legacy.stillBase64 &&
        slugPart(legacy.lifeStage || "unspecified") ===
          slugPart((record && record.lifeStage) || "unspecified")
      ) {
        entry = legacy;
      }
    }
    if (!entry || !entry.stillBase64) return null;
    return {
      mimeType: (entry.stillMime || "image/jpeg").split(";")[0] || "image/jpeg",
      imageBase64: entry.stillBase64,
      fromCache: true,
      cacheKey: entry.key || key,
    };
  }

  function stillDataUrl(entry) {
    if (!entry || !entry.stillBase64) return "";
    var mime = (entry.stillMime || "image/jpeg").split(";")[0] || "image/jpeg";
    return "data:" + mime + ";base64," + entry.stillBase64;
  }

  function fetchJson(url, opts) {
    opts = opts || {};
    return fetch(url, {
      method: opts.method || "GET",
      credentials: "include",
      headers: opts.body
        ? { "Content-Type": "application/json" }
        : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      return res.json().then(function (data) {
        return { res: res, data: data || {} };
      });
    });
  }

  var pushTimer = null;
  function schedulePush() {
    if (!syncState.signedIn) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      pushToServer().catch(function () {});
    }, 400);
  }

  function refreshAuth() {
    return fetchJson(API_ME)
      .then(function (pack) {
        var data = pack.data || {};
        syncState.signedIn = !!(pack.res.ok && data.signedIn && data.email);
        syncState.email = syncState.signedIn ? String(data.email || "") : "";
        syncState.lastError = "";
        return syncState;
      })
      .catch(function () {
        syncState.signedIn = false;
        syncState.email = "";
        syncState.lastError = "auth_check_failed";
        return syncState;
      });
  }

  function applySavedBlob(data, fallbackEntries, fallbackFacts) {
    var saved = (data && data.entries) || fallbackEntries || [];
    writeAll(saved);
    if (factsApi() && factsApi().writeAll) {
      if (data && Array.isArray(data.facts)) {
        // Server already merged; trust its list.
        factsApi().writeAll(data.facts);
      } else if (fallbackFacts && fallbackFacts.length) {
        writeFactsMerged(fallbackFacts);
      }
    }
    return {
      signedIn: true,
      email: syncState.email,
      entries: readAll(),
      facts: readFactsLocal(),
    };
  }

  function pullAndMerge() {
    if (!syncState.signedIn) {
      return Promise.resolve({
        signedIn: false,
        entries: readAll(),
        facts: readFactsLocal(),
      });
    }
    syncState.syncing = true;
    return fetchJson(API_LEARNED)
      .then(function (pack) {
        var data = pack.data || {};
        if (pack.res.status === 401) {
          syncState.signedIn = false;
          syncState.email = "";
          return {
            signedIn: false,
            entries: readAll(),
            facts: readFactsLocal(),
          };
        }
        if (!pack.res.ok || !data.ok) {
          throw new Error((data && data.message) || "pull_failed");
        }
        var merged = mergeLists(readAll(), data.entries || []);
        writeAll(merged);
        var mergedFacts = writeFactsMerged(data.facts || []);
        return fetchJson(API_LEARNED, {
          method: "POST",
          body: { mode: "merge", entries: merged, facts: mergedFacts },
        }).then(function (savePack) {
          syncState.lastError = "";
          return applySavedBlob(savePack.data, merged, mergedFacts);
        });
      })
      .catch(function (err) {
        syncState.lastError = (err && err.message) || "sync_failed";
        return {
          signedIn: syncState.signedIn,
          entries: readAll(),
          facts: readFactsLocal(),
          error: syncState.lastError,
        };
      })
      .then(function (result) {
        syncState.syncing = false;
        return result;
      });
  }

  function pushToServer() {
    if (!syncState.signedIn) {
      return Promise.resolve({
        signedIn: false,
        entries: readAll(),
        facts: readFactsLocal(),
      });
    }
    syncState.syncing = true;
    var localFacts = readFactsLocal();
    return fetchJson(API_LEARNED, {
      method: "POST",
      body: { mode: "merge", entries: readAll(), facts: localFacts },
    })
      .then(function (pack) {
        var data = pack.data || {};
        if (pack.res.status === 401) {
          syncState.signedIn = false;
          syncState.email = "";
          return {
            signedIn: false,
            entries: readAll(),
            facts: readFactsLocal(),
          };
        }
        if (!pack.res.ok || !data.ok) {
          throw new Error((data && data.message) || "push_failed");
        }
        syncState.lastError = "";
        return applySavedBlob(data, readAll(), localFacts);
      })
      .catch(function (err) {
        syncState.lastError = (err && err.message) || "push_failed";
        return {
          signedIn: syncState.signedIn,
          entries: readAll(),
          facts: readFactsLocal(),
          error: syncState.lastError,
        };
      })
      .then(function (result) {
        syncState.syncing = false;
        return result;
      });
  }

  /** Check Google session, merge device + account, keep both in sync. */
  function syncNow() {
    return refreshAuth().then(function () {
      if (!syncState.signedIn) {
        return {
          signedIn: false,
          entries: readAll(),
          facts: readFactsLocal(),
        };
      }
      return pullAndMerge();
    });
  }

  function googleSignInUrl() {
    return GOOGLE_START;
  }

  function getSyncState() {
    return {
      signedIn: syncState.signedIn,
      email: syncState.email,
      syncing: syncState.syncing,
      lastError: syncState.lastError,
    };
  }

  global.BaneCodexCollection = {
    STORAGE_KEY: STORAGE_KEY,
    entryKey: entryKey,
    speciesOnlyKey: speciesOnlyKey,
    readAll: readAll,
    writeAll: writeAll,
    upsert: upsert,
    getByKey: getByKey,
    existingStillFor: existingStillFor,
    stillDataUrl: stillDataUrl,
    syncNow: syncNow,
    pushToServer: pushToServer,
    schedulePush: schedulePush,
    refreshAuth: refreshAuth,
    googleSignInUrl: googleSignInUrl,
    getSyncState: getSyncState,
  };
})(typeof window !== "undefined" ? window : this);
