/**
 * LoreKeeper — rare “Update document?” cadence at bottom of main draft.
 * ~every 3 days; dismiss forever; short feedback path for custom schedule.
 * Does not rewrite prose — focuses the editor so the writer can paste/edit.
 */
(function (global) {
  var DISMISS_KEY = "lk_doc_update_nudge_dismissed";
  var LAST_SHOWN_KEY = "lk_doc_update_nudge_last_shown";
  var CADENCE_MS = 3 * 24 * 60 * 60 * 1000;

  function storageGet(key) {
    try {
      return global.localStorage ? global.localStorage.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      if (global.localStorage) global.localStorage.setItem(key, value);
    } catch (e) {
      /* ignore */
    }
  }

  function shouldShow() {
    if (storageGet(DISMISS_KEY) === "1") return false;
    var last = parseInt(storageGet(LAST_SHOWN_KEY) || "0", 10);
    if (!last || isNaN(last)) return true;
    return Date.now() - last >= CADENCE_MS;
  }

  function markShown() {
    storageSet(LAST_SHOWN_KEY, String(Date.now()));
  }

  function focusEditor() {
    var editor = global.document.getElementById("docEditor");
    if (editor) {
      editor.scrollIntoView({ behavior: "smooth", block: "end" });
      var ql =
        editor.querySelector(".ql-editor") ||
        (global.document.querySelector &&
          global.document.querySelector("#docSheet .ql-editor"));
      if (ql && typeof ql.focus === "function") {
        try {
          ql.focus();
        } catch (e) {
          /* ignore */
        }
      }
    }
  }

  function openFeedback() {
    var box = global.document.getElementById("docFeedbackBox");
    var text = global.document.getElementById("docFeedbackText");
    if (box && typeof box.open !== "undefined") box.open = true;
    if (text) {
      if (!String(text.value || "").trim()) {
        text.value =
          "Update-document reminder: I'd like a different schedule (e.g. weekly / never / …).";
      }
      text.focus();
      text.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function hide(el) {
    if (el) el.hidden = true;
  }

  function init() {
    var el = global.document.getElementById("docUpdateNudge");
    if (!el) return;
    if (!shouldShow()) {
      hide(el);
      return;
    }
    el.hidden = false;
    markShown();

    var yesBtn = global.document.getElementById("docUpdateNudgeYes");
    var dismissBtn = global.document.getElementById("docUpdateNudgeDismiss");
    var feedbackBtn = global.document.getElementById("docUpdateNudgeFeedback");

    if (yesBtn && !yesBtn.dataset.lkBound) {
      yesBtn.dataset.lkBound = "1";
      yesBtn.addEventListener("click", function () {
        hide(el);
        focusEditor();
      });
    }
    if (dismissBtn && !dismissBtn.dataset.lkBound) {
      dismissBtn.dataset.lkBound = "1";
      dismissBtn.addEventListener("click", function () {
        storageSet(DISMISS_KEY, "1");
        hide(el);
      });
    }
    if (feedbackBtn && !feedbackBtn.dataset.lkBound) {
      feedbackBtn.dataset.lkBound = "1";
      feedbackBtn.addEventListener("click", function () {
        openFeedback();
      });
    }
  }

  global.LoreKeeperDocUpdateNudge = { init: init };
})(typeof window !== "undefined" ? window : this);
