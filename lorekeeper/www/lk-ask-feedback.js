/**
 * LoreKeeper — owner-only Ask recall correction notes (site only, Owner's Office).
 */
(function (global) {
  var lastAsk = null;

  function setFeedbackStatus(el, msg, ok) {
    if (!el) return;
    el.textContent = msg || "";
    el.className = "lk-status" + (ok ? " ok" : "");
    el.hidden = !msg;
  }

  function initAskFeedback(opts) {
    opts = opts || {};
    var page = opts.page || "home";
    var wrongBtn = document.getElementById(opts.wrongBtnId);
    var correctionWrap = document.getElementById(opts.correctionWrapId);
    var correctionEl = document.getElementById(opts.correctionId);
    var saveBtn = document.getElementById(opts.saveFeedbackBtnId);
    var feedbackStatus = document.getElementById(opts.feedbackStatusId);

    if (!wrongBtn || !correctionWrap || !correctionEl || !saveBtn) return;
    if (!global.LoreKeeperAccountStorage || !global.LoreKeeperAuth) return;

    function showOwnerControls() {
      if (!global.LoreKeeperAccountStorage.isOwner()) return;
      wrongBtn.hidden = false;
    }

    if (global.LoreKeeperAccountStorage.ready) {
      global.LoreKeeperAccountStorage.ready.then(showOwnerControls);
    } else {
      showOwnerControls();
    }

    wrongBtn.addEventListener("click", function () {
      if (!lastAsk) {
        setFeedbackStatus(feedbackStatus, "Ask something first so LoreKeeper has an answer to compare.");
        return;
      }
      var open = correctionWrap.hidden;
      correctionWrap.hidden = !open;
      wrongBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) correctionEl.focus();
      if (!open) setFeedbackStatus(feedbackStatus, "");
    });

    saveBtn.addEventListener("click", function () {
      var note = correctionEl.value.trim();
      if (!note) {
        setFeedbackStatus(feedbackStatus, "Type what it got wrong first.");
        return;
      }
      if (!lastAsk) {
        setFeedbackStatus(feedbackStatus, "Ask something first.");
        return;
      }
      if (!global.LoreKeeperAccountStorage.isSignedIn()) {
        setFeedbackStatus(feedbackStatus, "Sign in to save feedback.");
        return;
      }
      saveBtn.disabled = true;
      var meta = {
        page: page,
        question: lastAsk.question || "",
        answer: lastAsk.answer || "",
        materialState: lastAsk.materialState || "",
      };
      if (lastAsk.scope) meta.scope = lastAsk.scope;

      global.LoreKeeperAuth.submitFeedback("ask_recall_wrong", note, meta)
        .then(function (res) {
          if (!res || !res.ok) {
            setFeedbackStatus(feedbackStatus, "Could not save. Try again.");
            return;
          }
          correctionEl.value = "";
          correctionWrap.hidden = true;
          wrongBtn.setAttribute("aria-expanded", "false");
          setFeedbackStatus(feedbackStatus, "Saved — see Owner’s Office.", true);
        })
        .catch(function () {
          setFeedbackStatus(feedbackStatus, "Could not save. Try again.");
        })
        .finally(function () {
          saveBtn.disabled = false;
        });
    });
  }

  function recordLastAsk(snapshot) {
    if (!snapshot) {
      lastAsk = null;
      return;
    }
    lastAsk = {
      question: snapshot.question || "",
      answer: snapshot.answer || "",
      materialState: snapshot.materialState || "",
      scope: snapshot.scope || null,
    };
  }

  global.LoreKeeperAskFeedback = {
    initAskFeedback: initAskFeedback,
    recordLastAsk: recordLastAsk,
  };
})(typeof window !== "undefined" ? window : this);
