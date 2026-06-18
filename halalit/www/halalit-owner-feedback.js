/**
 * Halalit — private reader → owner messages (Book Quest, Bookcheck, tips slot).
 */
(function (global) {
  function apiBase() {
    if (global.HalalitAccountStorage && global.HalalitAccountStorage.apiBase) {
      return global.HalalitAccountStorage.apiBase();
    }
    if (global.HalalitBookcheckConfig && global.HalalitBookcheckConfig.apiBase) {
      return global.HalalitBookcheckConfig.apiBase();
    }
    return "";
  }

  function ensureSignedIn() {
    if (global.HalalitAccountStorage && global.HalalitAccountStorage.isSignedIn()) return true;
    if (global.HalalitAccountStorage) {
      global.HalalitAccountStorage.ensureSignedIn();
    } else {
      global.location.href = "./account.html?return=" + encodeURIComponent(global.location.pathname);
    }
    return false;
  }

  function submit(source, message, meta) {
    if (!ensureSignedIn()) return Promise.resolve({ ok: false, error: "not_signed_in" });
    var base = apiBase();
    if (!base || !global.fetch) return Promise.resolve({ ok: false, error: "unavailable" });
    return global
      .fetch(base + "/feedback/submit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: source,
          message: message || "",
          meta: meta || {},
        }),
      })
      .then(function (r) {
        return r.json().catch(function () {
          return { ok: false, error: "bad_response" };
        });
      });
  }

  function submitBookQuest(review) {
    if (!review || !review.titlePlain) return Promise.resolve({ ok: false });
    var parts = [];
    if (review.rating) parts.push("Rating: " + review.rating);
    if (review.noteSnippet) parts.push(review.noteSnippet);
    if (review.ruleFlags && review.ruleFlags.length) {
      parts.push("Flags: " + review.ruleFlags.join(", "));
    }
    return submit("bookquest", parts.join(" — ") || review.rating || "review", review);
  }

  function initBookcheckFeedback() {
    var sendBtn = global.document.getElementById("bookcheckFeedbackSend");
    var textEl = global.document.getElementById("bookcheckFeedbackText");
    var statusEl = global.document.getElementById("bookcheckFeedbackStatus");
    if (!sendBtn || !textEl) return;

    sendBtn.addEventListener("click", function () {
      var msg = String(textEl.value || "").trim();
      if (!msg) {
        if (statusEl) statusEl.textContent = "Write a short note first.";
        return;
      }
      if (statusEl) statusEl.textContent = "Sending…";
      var titleEl = global.document.getElementById("bookcheckTitle");
      var authorEl = global.document.getElementById("bookcheckAuthor");
      submit("bookcheck", msg, {
        title: titleEl ? String(titleEl.value || "").trim() : "",
        author: authorEl ? String(authorEl.value || "").trim() : "",
      }).then(function (res) {
        if (res && res.ok) {
          textEl.value = "";
          if (statusEl) statusEl.textContent = "Sent privately to the owner. Thank you.";
        } else if (statusEl) {
          statusEl.textContent =
            res && res.error === "not_signed_in"
              ? "Sign in first to send feedback."
              : "Could not send right now. Try again.";
        }
      });
    });
  }

  function initSuggestionSlot() {
    var slot = global.document.getElementById("halalitSuggestionSlot");
    var panel = global.document.getElementById("halalitSuggestionPanel");
    var textEl = global.document.getElementById("halalitSuggestionText");
    var sendBtn = global.document.getElementById("halalitSuggestionSend");
    var closeBtn = global.document.getElementById("halalitSuggestionClose");
    var statusEl = global.document.getElementById("halalitSuggestionStatus");
    if (!slot || !panel) return;

    function closePanel() {
      panel.hidden = true;
      slot.setAttribute("aria-expanded", "false");
    }

    slot.addEventListener("click", function () {
      var open = panel.hidden;
      panel.hidden = !open;
      slot.setAttribute("aria-expanded", open ? "true" : "false");
      if (open && textEl) textEl.focus();
    });

    if (closeBtn) closeBtn.addEventListener("click", closePanel);

    if (sendBtn && textEl) {
      sendBtn.addEventListener("click", function () {
        var msg = String(textEl.value || "").trim();
        if (!msg) {
          if (statusEl) statusEl.textContent = "Write your suggestion first.";
          return;
        }
        if (statusEl) statusEl.textContent = "Sending…";
        submit("tips_box", msg, {}).then(function (res) {
          if (res && res.ok) {
            textEl.value = "";
            if (statusEl) statusEl.textContent = "Sent privately. Thank you!";
            global.setTimeout(closePanel, 1400);
          } else if (statusEl) {
            statusEl.textContent =
              res && res.error === "not_signed_in"
                ? "Sign in to send a suggestion."
                : "Could not send. Try again.";
          }
        });
      });
    }
  }

  global.HalalitOwnerFeedback = {
    submit: submit,
    submitBookQuest: submitBookQuest,
    initBookcheckFeedback: initBookcheckFeedback,
    initSuggestionSlot: initSuggestionSlot,
  };

  function boot() {
    initSuggestionSlot();
    if (global.HalalitAccountStorage && global.HalalitAccountStorage.ready) {
      global.HalalitAccountStorage.ready.then(initBookcheckFeedback);
    } else {
      initBookcheckFeedback();
    }
  }

  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : this);
