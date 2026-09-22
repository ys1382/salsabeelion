/**
 * LoreKeeper — multi-tab / multi-device policy for documents (#28).
 * An older tab must not save over a newer copy. Other tabs get a reload prompt — no automatic merge.
 */
(function (global) {
  var TAB_ID =
    (function () {
      try {
        var existing = global.sessionStorage.getItem("lkTabId");
        if (existing) return existing;
        var id = "tab_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
        global.sessionStorage.setItem("lkTabId", id);
        return id;
      } catch (e) {
        return "tab_" + Date.now();
      }
    })();

  var loadedUpdatedAt = 0;
  var POLICY_HINT =
    "A tab with older text will not save over a newer copy. If two tabs disagree, LoreKeeper asks you to reload — it does not merge two versions.";

  function markLoaded(doc) {
    loadedUpdatedAt = (doc && doc.updatedAt) || 0;
  }

  function bumpLoaded(doc) {
    if (doc && doc.updatedAt) loadedUpdatedAt = doc.updatedAt;
  }

  function isStaleVsStore(docId) {
    if (!docId || !global.LoreKeeperDocuments) return false;
    var fresh = global.LoreKeeperDocuments.find(docId);
    if (!fresh || !fresh.updatedAt) return false;
    return fresh.updatedAt > loadedUpdatedAt + 400;
  }

  function checkRemoteNewer(getDocId, onStale) {
    if (!getDocId || !onStale || !global.LoreKeeperDocuments || !global.LoreKeeperAccountStorage) {
      return Promise.resolve(false);
    }
    var id = getDocId();
    if (!id || !global.LoreKeeperAccountStorage.isSignedIn()) return Promise.resolve(false);
    return global.LoreKeeperAccountStorage.refreshSession().then(function () {
      var fresh = global.LoreKeeperDocuments.find(id);
      if (!fresh || !fresh.updatedAt) return false;
      if (fresh.updatedAt > loadedUpdatedAt + 400) {
        onStale(fresh);
        return true;
      }
      return false;
    });
  }

  global.LoreKeeperDocCollab = {
    tabId: TAB_ID,
    policyHint: POLICY_HINT,
    markLoaded: markLoaded,
    bumpLoaded: bumpLoaded,
    isStaleVsStore: isStaleVsStore,
    checkRemoteNewer: checkRemoteNewer,
  };
})(typeof window !== "undefined" ? window : this);
