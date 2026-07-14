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
    var work =
      (doc && doc.workTag) ||
      (workEl && workEl.value.trim()) ||
      (doc && doc.title) ||
      "";
    return {
      mode: (modeEl && modeEl.value) || "work",
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
      setStatus(scopeHint(scope));
      document.getElementById("docAskAnswer").hidden = true;
      document.getElementById("docAskSources").hidden = true;
      askBtn.disabled = true;
      if (flushSave) flushSave(true);
      global.LoreKeeperRecall.ask(q, { scope: scope })
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
    });

    questionEl.addEventListener("keydown", function (e) {
      if (e.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        askBtn.click();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        var start = questionEl.selectionStart;
        var end = questionEl.selectionEnd;
        var val = questionEl.value;
        questionEl.value = val.slice(0, start) + "\n" + val.slice(end);
        questionEl.selectionStart = questionEl.selectionEnd = start + 1;
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
