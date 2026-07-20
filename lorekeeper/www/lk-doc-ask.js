/**
 * LoreKeeper — Ask panel on doc.html (#19): work- or document-scoped recall.
 */
(function (global) {
  function setStatus(msg, ok) {
    var el = document.getElementById("docAskStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "lk-status" + (ok ? " ok" : "");
    el.hidden = !msg;
  }

  function scopeFromUi(getDoc) {
    var doc = getDoc ? getDoc() : null;
    var workEl = document.getElementById("docWork");
    var modeEl = document.querySelector('input[name="docAskScope"]:checked');
    var mode = (modeEl && modeEl.value) || "document";
    var work =
      (doc && doc.workTag) ||
      (workEl && workEl.value.trim()) ||
      "";
    // Document Ask always binds to the open doc. Title is not a work tag —
    // without a real work tag, fall back to document-only so we never search
    // the whole account or ask “which project?”
    if (mode === "work" && !work && doc && doc.id) {
      mode = "document";
    }
    return {
      mode: mode,
      workTitle: work,
      documentId: doc && doc.id,
    };
  }

  function scopeHint(scope) {
    if (scope.mode === "document") {
      return "Searching this document and notes linked to it.";
    }
    if (scope.workTitle) {
      return "Searching notes and documents tagged “" + scope.workTitle + "”.";
    }
    return "Searching your saved writing for this project.";
  }

  function renderAnswer(res) {
    var answerEl = document.getElementById("docAskAnswer");
    var sourcesEl = document.getElementById("docAskSources");
    if (!answerEl || !sourcesEl) return;

    answerEl.innerHTML =
      global.LoreKeeperRecall && global.LoreKeeperRecall.formatAskAnswerHtml
        ? global.LoreKeeperRecall.formatAskAnswerHtml(res.answer || "")
        : "";
    if (
      !(global.LoreKeeperRecall && global.LoreKeeperRecall.formatAskAnswerHtml)
    ) {
      answerEl.textContent = res.answer || "";
    }
    answerEl.hidden = !res.answer;
    sourcesEl.innerHTML = "";
    if (res.sources && res.sources.length) {
      res.sources.forEach(function (src) {
        var li = document.createElement("li");
        var span = document.createElement("span");
        span.className = "lk-ask-source-btn";
        span.textContent =
          (src.title || "Untitled") + " (" + (src.kindLabel || "Note") + ")";
        li.appendChild(span);
        sourcesEl.appendChild(li);
      });
      sourcesEl.hidden = false;
    } else {
      sourcesEl.hidden = true;
    }
  }

  function materialStatus(res) {
    if (res.needsConfirm) {
      return "Pick which notes to use, then summarize.";
    }
    if (res.materialState === "summarizable") {
      return "Summary from your notes and drafts.";
    }
    if (res.materialState === "fragments_only") {
      return "Partial — not enough saved yet for a full summary.";
    }
    if (res.materialState === "nothing_saved") {
      return "Nothing saved on that yet.";
    }
    return "From your saved writing.";
  }

  function initDocAsk(getDoc, flushSave) {
    var askBtn = document.getElementById("docAskBtn");
    var questionEl = document.getElementById("docAskQuestion");
    if (!askBtn || !questionEl || !global.LoreKeeperRecall) return;

    function clearAnswerUi() {
      var answerEl = document.getElementById("docAskAnswer");
      var sourcesEl = document.getElementById("docAskSources");
      if (answerEl) {
        answerEl.hidden = true;
        answerEl.innerHTML = "";
      }
      if (sourcesEl) {
        sourcesEl.hidden = true;
        sourcesEl.innerHTML = "";
      }
    }

    function awaitPark() {
      var parked = flushSave ? flushSave(true) : null;
      return Promise.resolve(parked).catch(function () {
        return null;
      });
    }

    function runAskRequest(q, scope, askOpts) {
      setStatus(scopeHint(scope));
      clearAnswerUi();
      askBtn.disabled = true;
      return awaitPark()
        .then(function () {
          return global.LoreKeeperRecall.ask(q, askOpts);
        })
        .then(function (res) {
          if (!res || !res.ok) {
            setStatus(global.LoreKeeperRecall.friendlyError(res && res.error));
            return;
          }
          setStatus(materialStatus(res), true);
          renderAnswer(res);
          if (global.LoreKeeperAskFeedback && global.LoreKeeperAskFeedback.recordLastAsk) {
            global.LoreKeeperAskFeedback.recordLastAsk({
              question: q,
              answer: res.answer || "",
              materialState: res.materialState || "",
              scope: scope,
            });
          }
        })
        .catch(function () {
          setStatus(global.LoreKeeperRecall.friendlyError("network_error"));
        })
        .finally(function () {
          askBtn.disabled = false;
        });
    }

    askBtn.addEventListener("click", function () {
      var q = questionEl.value.trim();
      if (!q) {
        setStatus("Type a question first.");
        return;
      }
      if (!global.LoreKeeperAccountStorage.isSignedIn()) {
        setStatus(global.LoreKeeperRecall.friendlyError("not_signed_in"));
        return;
      }
      var scope = scopeFromUi(getDoc);
      // Straight to answer — no confirm-sources checkbox step.
      runAskRequest(q, scope, { scope: scope });
    });

    questionEl.addEventListener("keydown", function (e) {
      if (e.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        askBtn.click();
        return;
      }
    });

    if (global.LoreKeeperAskFeedback && global.LoreKeeperAskFeedback.initAskFeedback) {
      global.LoreKeeperAskFeedback.initAskFeedback({
        page: "doc",
        wrongBtnId: "docAskWrongBtn",
        correctionWrapId: "docAskCorrectionWrap",
        correctionId: "docAskCorrection",
        saveFeedbackBtnId: "docAskSaveFeedbackBtn",
        feedbackStatusId: "docAskFeedbackStatus",
      });
    }
    var askField =
      questionEl && questionEl.closest ? questionEl.closest(".lk-field") : null;
    if (global.LoreKeeperTierA && askField) {
      global.LoreKeeperTierA.initOwnerAskHints(askField);
    }
  }

  global.LoreKeeperDocAsk = {
    initDocAsk: initDocAsk,
    scopeFromUi: scopeFromUi,
  };
})(typeof window !== "undefined" ? window : this);
