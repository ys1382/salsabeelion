/**
 * LoreKeeper — Ask / recall (your notes and documents).
 */
(function (global) {
  var ASK_TIMEOUT_MS = 180000;

  function apiBase() {
    return global.LoreKeeperAccountStorage ? global.LoreKeeperAccountStorage.apiBase() : "";
  }

  function shouldIncludeDocuments(options) {
    if (options.includeDocuments === true) return true;
    if (options.includeDocuments === false) return false;
    var scope = options.scope;
    return !!(scope && (scope.documentId || scope.workTitle));
  }

  function useServerCorpus(options) {
    if (options.sendClientCorpus === true) return false;
    if (options.useServerCorpus === false) return false;
    return true;
  }

  function buildPayload(question, options) {
    options = options || {};
    var payload = { question: question || "", mode: options.mode || "full" };
    if (options.scope && typeof options.scope === "object") {
      payload.scope = options.scope;
    }
    if (useServerCorpus(options)) {
      return payload;
    }
    if (
      shouldIncludeDocuments(options) &&
      global.LoreKeeperDocuments &&
      typeof global.LoreKeeperDocuments.load === "function"
    ) {
      payload.documents = global.LoreKeeperDocuments.load();
    }
    if (global.LoreKeeperEntries && typeof global.LoreKeeperEntries.load === "function") {
      payload.entries = global.LoreKeeperEntries.load();
    }
    return payload;
  }

  function payloadHasClientCorpus(payload) {
    return (
      (payload.entries && payload.entries.length) ||
      (payload.documents && payload.documents.length)
    );
  }

  function errorFromStatus(status) {
    if (status === 413) return "payload_too_large";
    if (status === 502 || status === 503) return "server_error";
    if (status === 504 || status === 408) return "ask_timeout";
    if (status >= 500) return "server_error";
    return "bad_response";
  }

  function fetchAsk(url, payload) {
    if (!global.fetch) return Promise.reject(new Error("no_fetch"));
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, ASK_TIMEOUT_MS)
      : null;
    return global
      .fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined,
      })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        return res
          .json()
          .catch(function () {
            return { ok: false, error: errorFromStatus(res.status) };
          })
          .then(function (data) {
            if (!res.ok) {
              if (data && data.ok === false && data.error) return data;
              return { ok: false, error: errorFromStatus(res.status) };
            }
            return data;
          });
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        if (err && err.name === "AbortError") {
          return { ok: false, error: "ask_timeout" };
        }
        return { ok: false, error: "network_error" };
      });
  }

  function runAsk(question, options, syncWarning) {
    var base = apiBase();
    if (!base) return Promise.resolve({ ok: false, error: "unavailable" });
    var payload = buildPayload(question, options);
    return fetchAsk(base + "/recall/ask", payload).then(function (data) {
      if (syncWarning && data && data.ok) {
        data.syncWarning = syncWarning;
      }
      return data;
    });
  }

  function ask(question, options) {
    options = options || {};
    var base = apiBase();
    if (!base || !global.fetch) return Promise.resolve({ ok: false, error: "unavailable" });
    if (!global.LoreKeeperAccountStorage || !global.LoreKeeperAccountStorage.isSignedIn()) {
      return Promise.resolve({ ok: false, error: "not_signed_in" });
    }

    var syncWarning = null;
    if (
      global.LoreKeeperAccountStorage.hasPending &&
      global.LoreKeeperAccountStorage.hasPending()
    ) {
      syncWarning = "Some notes may not have synced to your account yet — searching your account after sync.";
    }

    function afterSyncReady() {
      if (useServerCorpus(options)) {
        var pendingSync =
          global.LoreKeeperAccountStorage.hasPending &&
          global.LoreKeeperAccountStorage.hasPending();
        if (pendingSync) {
          return global.LoreKeeperAccountStorage.flush()
            .catch(function () {
              return 0;
            })
            .then(function () {
              return runAsk(question, options, syncWarning);
            });
        }
        return runAsk(question, options, syncWarning);
      }

      var payload = buildPayload(question, options);
      if (payloadHasClientCorpus(payload)) {
        return runAsk(question, options, syncWarning);
      }

      return global.LoreKeeperAccountStorage.flush()
        .catch(function () {
          return 0;
        })
        .then(function () {
          return runAsk(question, options, syncWarning);
        });
    }

    if (
      useServerCorpus(options) &&
      global.LoreKeeperAccountStorage.hasPending &&
      global.LoreKeeperAccountStorage.hasPending()
    ) {
      return afterSyncReady();
    }

    return afterSyncReady();
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Render Ask answers; bold known draft-vs-notes labels when present. */
  function formatAskAnswerHtml(text) {
    var raw = String(text || "");
    if (!raw) return "";
    var labels = [
      "This is what the main draft says:",
      "This is what your notes say:",
    ];
    var escaped = escapeHtml(raw);
    labels.forEach(function (label) {
      var escLabel = escapeHtml(label);
      escaped = escaped.split(escLabel).join("<strong>" + escLabel + "</strong>");
    });
    return escaped.replace(/\n/g, "<br>");
  }

  function friendlyError(code) {
    var map = {
      not_signed_in: "Sign in to ask LoreKeeper.",
      empty_question: "Type a question first.",
      unavailable: "Recall is not available right now.",
      network_error: "Could not reach LoreKeeper. Try again in a moment.",
      bad_response: "Something went wrong. Try again.",
      payload_too_large: "Too much saved text to send at once. Try a narrower question.",
      ask_timeout: "That took too long — try again, or ask a narrower question.",
      server_error: "LoreKeeper hit a server error. Try again in a moment.",
      sync_failed: "Could not sync your notes. Try again in a moment.",
      recall_failed: "Could not search your notes right now. Try again.",
    };
    return map[code] || "Something went wrong. Try again.";
  }

  global.LoreKeeperRecall = {
    ask: ask,
    friendlyError: friendlyError,
    formatAskAnswerHtml: formatAskAnswerHtml,
  };
})(typeof window !== "undefined" ? window : this);
