/**
 * LoreKeeper — Ask / recall (your notes and documents).
 */
(function (global) {
  function apiBase() {
    return global.LoreKeeperAccountStorage ? global.LoreKeeperAccountStorage.apiBase() : "";
  }

  function buildPayload(question) {
    var payload = { question: question || "" };
    if (global.LoreKeeperDocuments && typeof global.LoreKeeperDocuments.load === "function") {
      payload.documents = global.LoreKeeperDocuments.load();
    }
    if (global.LoreKeeperEntries && typeof global.LoreKeeperEntries.load === "function") {
      payload.entries = global.LoreKeeperEntries.load();
    }
    return payload;
  }

  function ask(question) {
    var base = apiBase();
    if (!base || !global.fetch) return Promise.resolve({ ok: false, error: "unavailable" });
    if (!global.LoreKeeperAccountStorage || !global.LoreKeeperAccountStorage.isSignedIn()) {
      return Promise.resolve({ ok: false, error: "not_signed_in" });
    }
    var flushPromise = Promise.resolve();
    if (global.LoreKeeperAccountStorage.flush) {
      flushPromise = global.LoreKeeperAccountStorage.flush();
    }
    return flushPromise
      .then(function () {
        return global.fetch(base + "/recall/ask", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(question)),
        });
      })
      .then(function (res) {
        return res.json().catch(function () {
          return { ok: false, error: "bad_response" };
        });
      })
      .catch(function () {
        return { ok: false, error: "network_error" };
      });
  }

  function friendlyError(code) {
    var map = {
      not_signed_in: "Sign in to ask LoreKeeper.",
      empty_question: "Type a question first.",
      unavailable: "Recall is not available right now.",
      network_error: "Could not reach LoreKeeper. Try again in a moment.",
      bad_response: "Something went wrong. Try again.",
    };
    return map[code] || "Something went wrong. Try again.";
  }

  global.LoreKeeperRecall = {
    ask: ask,
    friendlyError: friendlyError,
  };
})(typeof window !== "undefined" ? window : this);
