/**
 * Halalit — owner on-site hand vets (server-backed), merged into Bookcheck / Book Quest.
 */
(function (global) {
  var entries = [];
  var readyResolve;
  var ready = new Promise(function (resolve) {
    readyResolve = resolve;
  });
  var version = 0;

  function apiBase() {
    if (global.HalalitAccountStorage && global.HalalitAccountStorage.apiBase) {
      return global.HalalitAccountStorage.apiBase();
    }
    if (global.HalalitBookcheckConfig && typeof global.HalalitBookcheckConfig.apiBase === "function") {
      return global.HalalitBookcheckConfig.apiBase();
    }
    return "";
  }

  function norm(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function titleMatches(entryTitle, lookupTitle) {
    var a = norm(lookupTitle);
    var b = norm(entryTitle);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;
    return false;
  }

  function authorMatches(entryAuthor, lookupAuthor) {
    var ea = norm(entryAuthor);
    if (!ea) return true;
    var la = norm(lookupAuthor);
    if (!la) return false;
    if (la === ea) return true;
    if (la.indexOf(ea) >= 0 || ea.indexOf(la) >= 0) return true;
    return false;
  }

  function findEntry(title, author) {
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (titleMatches(e.title, title) && authorMatches(e.author, author)) return e;
    }
    return null;
  }

  function verifiedShape(entry) {
    var f = entry.flags || {};
    return {
      tier: "verified_clean",
      detail: entry.detail,
      ownerOnSite: true,
      requiresIslamicLiteratureInterest: !!f.requiresIslamicLiteratureInterest,
      requiresLightRomanceOptIn: !!f.requiresLightRomanceOptIn,
      requiresDeityMythologyOptIn: !!f.requiresDeityMythologyOptIn,
      requiresMagicOptIn: !!f.requiresMagicOptIn,
      requiresSubstanceOptIn: !!f.requiresSubstanceOptIn,
      requiresCulturalMisrepresentationOptIn: !!f.requiresCulturalMisrepresentationOptIn,
      negativeFamilyPortrayal: !!f.negativeFamilyPortrayal,
      excludesBookQuest: !!f.excludesBookQuest,
    };
  }

  function verifiedCleanMatch(title, author) {
    var e = findEntry(title, author);
    if (!e || e.tier !== "verified_clean") return null;
    return verifiedShape(e);
  }

  function matchHandVet(title, author) {
    var e = findEntry(title, author);
    if (!e) return null;
    if (e.tier === "verified_clean") {
      return { tier: "verified_clean", detail: e.detail, ownerOnSite: true };
    }
    if (e.tier === "no_recommend_fanservice") {
      return { tier: "flag_review", detail: e.detail, ownerOnSite: true, fanservice: true };
    }
    if (e.tier === "fanservice_caution") {
      return { tier: "fanservice_caution", detail: e.detail, ownerOnSite: true };
    }
    if (e.tier === "deity_comfort") {
      return { tier: "deity_comfort", detail: e.detail, ownerOnSite: true };
    }
    if (e.tier === "user_discretion") {
      return { tier: "user_discretion", detail: e.detail, ownerOnSite: true };
    }
    return { tier: "flag_review", detail: e.detail, ownerOnSite: true, parked: e.tier === "parked" };
  }

  function contentBandForTitle(title, author) {
    var e = findEntry(title, author);
    if (!e || e.tier !== "verified_clean" || !e.ageBand) return null;
    return e.ageBand;
  }

  function refresh() {
    var base = apiBase();
    if (!base) {
      readyResolve();
      return Promise.resolve(false);
    }
    return fetch(base + "/vets/public", { credentials: "include" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && Array.isArray(data.entries)) {
          entries = data.entries;
          version++;
        }
        return true;
      })
      .catch(function () {
        return false;
      })
      .finally(function () {
        readyResolve();
      });
  }

  function saveVet(payload) {
    var base = apiBase();
    return fetch(base + "/owner/vets/save", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok) return refresh().then(function () {
          return data;
        });
        return data;
      });
  }

  function saveVetSeries(payload) {
    var base = apiBase();
    return fetch(base + "/owner/vets/save-series", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok) return refresh().then(function () {
          return data;
        });
        return data;
      });
  }

  function deleteVet(id) {
    var base = apiBase();
    return fetch(base + "/owner/vets/delete", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok) return refresh().then(function () {
          return data;
        });
        return data;
      });
  }

  global.HalalitOwnerVetsRuntime = {
    ready: ready,
    refresh: refresh,
    getEntries: function () {
      return entries.slice();
    },
    getVersion: function () {
      return version;
    },
    findEntry: findEntry,
    verifiedCleanMatch: verifiedCleanMatch,
    matchHandVet: matchHandVet,
    contentBandForTitle: contentBandForTitle,
    saveVet: saveVet,
    saveVetSeries: saveVetSeries,
    deleteVet: deleteVet,
  };

  refresh();
})(typeof window !== "undefined" ? window : this);
