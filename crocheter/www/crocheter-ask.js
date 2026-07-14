/**
 * Crocheter — Crochet Help (general crochet Q&A via API).
 */
(function (global) {
  var ASK_TIMEOUT_MS = 90000;

  function apiBase() {
    return global.CrocheterApiConfig ? global.CrocheterApiConfig.apiBase() : "";
  }

  function friendlyError(code) {
    var map = {
      not_signed_in: "Sign in to use Crochet Help.",
      empty_question: "Type a crochet question first.",
      ask_disabled: "Crochet Help is paused right now.",
      ask_unavailable: "The helper isn't available right now. Try again later.",
      creators_out_of_scope:
        "I stick to stitches, yarn, and technique — not YouTube or social media creators.",
      brand_compare_out_of_scope:
        "I don't compare brands. Ask about fiber content or how a yarn behaves instead.",
      ask_failed: "Something went wrong answering that. Try again in a moment.",
      bad_response: "Couldn't reach the site right now.",
      network_error: "Network hiccup — try again.",
    };
    return map[code] || "Something went wrong. Try again.";
  }

  function askQuestion(question) {
    if (!global.fetch) return Promise.reject(new Error("no_fetch"));
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, ASK_TIMEOUT_MS)
      : null;
    return global
      .fetch(apiBase() + "/ask", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question }),
        signal: controller ? controller.signal : undefined,
      })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        return res.json().catch(function () {
          return { ok: false, error: "bad_response" };
        });
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        if (err && err.name === "AbortError") {
          return { ok: false, error: "ask_failed" };
        }
        return { ok: false, error: "network_error" };
      });
  }

  function checkSiteFlags() {
    return global.fetch(apiBase() + "/auth/me", { credentials: "include" })
      .then(function (res) {
        return res.json();
      })
      .catch(function () {
        return null;
      });
  }

  function initAskPage() {
    var form = document.getElementById("ask-form");
    var questionEl = document.getElementById("ask-question");
    var statusEl = document.getElementById("ask-status");
    var answerEl = document.getElementById("ask-answer");
    var btn = document.getElementById("ask-btn");
    var pausedEl = document.getElementById("paused");
    if (!form || !questionEl) return;

    checkSiteFlags().then(function (me) {
      var flags = me && me.siteFlags;
      if (flags && flags.askHelperEnabled === false) {
        if (pausedEl) pausedEl.hidden = false;
        if (form) form.hidden = true;
      }
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var q = questionEl.value.trim();
      if (!q) {
        statusEl.textContent = friendlyError("empty_question");
        statusEl.className = "status error";
        return;
      }
      btn.disabled = true;
      statusEl.textContent = "Thinking…";
      statusEl.className = "status";
      answerEl.hidden = true;
      answerEl.textContent = "";

      askQuestion(q).then(function (res) {
        btn.disabled = false;
        if (res && res.ok && res.answer) {
          statusEl.textContent = "";
          statusEl.className = "status ok";
          answerEl.textContent = res.answer;
          answerEl.hidden = false;
          return;
        }
        var code = (res && res.error) || "ask_failed";
        if (res && res.answer && !res.ok) {
          statusEl.textContent = "";
          answerEl.textContent = res.answer;
          answerEl.hidden = false;
          statusEl.className = "status warn";
          return;
        }
        statusEl.textContent = friendlyError(code);
        statusEl.className = "status error";
      });
    });
  }

  global.CrocheterAsk = {
    askQuestion: askQuestion,
    friendlyError: friendlyError,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAskPage);
  } else {
    initAskPage();
  }
})(typeof window !== "undefined" ? window : this);
