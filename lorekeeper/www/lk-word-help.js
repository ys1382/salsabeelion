/**
 * LoreKeeper — Word help (language suggestions on typed phrases only).
 */
(function (global) {
  var TIMEOUT_MS = 90000;

  function apiBase() {
    return global.LoreKeeperAccountStorage ? global.LoreKeeperAccountStorage.apiBase() : "";
  }

  function friendlyError(code) {
    if (code === "empty_query") return "Type a word or phrase first.";
    if (code === "word_help_unavailable") {
      return "Word help is not available on this server right now.";
    }
    if (code === "not_signed_in") return "Sign in to use Word help.";
    if (code === "word_help_failed") return "Could not get suggestions — try again in a moment.";
    if (code === "network_error") return "Network error — check your connection.";
    return "Something went wrong — try again.";
  }

  function ask(query) {
    if (!global.fetch) return Promise.reject(new Error("no_fetch"));
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, TIMEOUT_MS)
      : null;
    return global
      .fetch(apiBase() + "/word-help/ask", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query || "" }),
        signal: controller ? controller.signal : undefined,
      })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        return res.json().then(function (data) {
          if (!res.ok) {
            data = data || {};
            data.error = data.error || "bad_response";
            data.ok = false;
          }
          return data;
        });
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        if (err && err.name === "AbortError") {
          return { ok: false, error: "timeout" };
        }
        return { ok: false, error: "network_error" };
      });
  }

  function init() {
    var btn = document.getElementById("wordHelpBtn");
    var input = document.getElementById("wordHelpQuery");
    var status = document.getElementById("wordHelpStatus");
    var answer = document.getElementById("wordHelpAnswer");
    if (!btn || !input || btn.dataset.lkBound === "1") return;
    btn.dataset.lkBound = "1";

    function run() {
      var q = input.value.trim();
      if (!q) {
        status.textContent = friendlyError("empty_query");
        status.className = "lk-status err";
        status.hidden = false;
        return;
      }
      if (global.LoreKeeperLastFocus && global.LoreKeeperLastFocus.setWordHelp) {
        global.LoreKeeperLastFocus.setWordHelp();
      }
      status.textContent = "Looking up wording…";
      status.className = "lk-status";
      status.hidden = false;
      answer.hidden = true;
      btn.disabled = true;
      ask(q)
        .then(function (res) {
          if (!res || !res.ok) {
            status.textContent = friendlyError(res && res.error);
            status.className = "lk-status err";
            return;
          }
          status.textContent = "Suggestions only — not added to your notes.";
          status.className = "lk-status ok";
          answer.textContent = res.answer || "";
          answer.hidden = !res.answer;
        })
        .catch(function () {
          status.textContent = friendlyError("network_error");
          status.className = "lk-status err";
        })
        .then(function () {
          btn.disabled = false;
        });
    }

    btn.addEventListener("click", run);
    input.addEventListener("keydown", function (ev) {
      if (ev.isComposing) return;
      if (ev.key === "Enter") {
        ev.preventDefault();
        run();
        return;
      }
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        var start = input.selectionStart;
        var end = input.selectionEnd;
        var val = input.value;
        input.value = val.slice(0, start) + "\n" + val.slice(end);
        input.selectionStart = input.selectionEnd = start + 1;
      }
    });
  }

  global.LoreKeeperWordHelp = {
    ask: ask,
    friendlyError: friendlyError,
    init: init,
  };
})(typeof window !== "undefined" ? window : this);
