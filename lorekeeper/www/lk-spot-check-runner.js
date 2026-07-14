/**
 * LoreKeeper — spot-check runner (deferred — not loaded on Owner’s Office).
 * Kept in repo for a possible later build; see LOREKEEPER-ROADMAP-AND-TODO.md.
 */
(function (global) {
  var TARGET_PASS = 8;
  var ASK_TIMEOUT_MS = 180000;
  var SESSION_ROWS_KEY = "lorekeeper_spot_last_rows_v1";
  var activeSpotRows = [];

  function apiBase() {
    return global.LoreKeeperAccountStorage ? global.LoreKeeperAccountStorage.apiBase() : "";
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function saveRowsSession(rows) {
    try {
      global.sessionStorage.setItem(SESSION_ROWS_KEY, JSON.stringify(rows));
    } catch (e) {}
  }

  function loadRowsSession() {
    try {
      var raw = global.sessionStorage.getItem(SESSION_ROWS_KEY);
      if (!raw) return null;
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : null;
    } catch (e) {
      return null;
    }
  }

  function errorFromStatus(status) {
    if (status === 504 || status === 408) return "ask_timeout";
    if (status >= 500) return "server_error";
    return "bad_response";
  }

  function askQuestion(question, attempt) {
    attempt = attempt || 0;
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, ASK_TIMEOUT_MS)
      : null;
    return fetch(apiBase() + "/recall/ask", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question, mode: "full", spotCheck: true }),
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        return res
          .json()
          .catch(function () {
            return { ok: false, error: errorFromStatus(res.status), httpStatus: res.status };
          })
          .then(function (payload) {
            if (!res.ok && payload && !payload.error) {
              payload.ok = false;
              payload.error = errorFromStatus(res.status);
            }
            if (payload && res.status) payload.httpStatus = res.status;
            var err = (payload && payload.error) || "";
            var retryable =
              (!payload || !payload.ok) &&
              attempt < 2 &&
              err !== "ask_timeout" &&
              res.status !== 504 &&
              res.status !== 408;
            if (retryable) {
              return new Promise(function (resolve) {
                setTimeout(resolve, 1500 * (attempt + 1));
              }).then(function () {
                return askQuestion(question, attempt + 1);
              });
            }
            return payload || { ok: false, error: "bad_response" };
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

  function looksLikeScrap(answer) {
    var a = String(answer || "").trim();
    if (!a) return true;
    var low = a.toLowerCase();
    if (low.indexOf("from your entry") >= 0 && a.length < 420) return true;
    if (/^closest match from/i.test(a)) return true;
    if ((a.match(/•/g) || []).length >= 2 && a.length < 500) return true;
    if (low.indexOf("little is spelled out yet") >= 0) return true;
    if (low.indexOf("couldn't find anything about") >= 0) return true;
    return false;
  }

  function classifyResult(res) {
    if (!res || !res.ok) {
      var err = (res && res.error) || "bad_response";
      if (res && res.httpStatus) err = err + " (HTTP " + res.httpStatus + ")";
      if (err === "ask_timeout") {
        return {
          level: "fail",
          label: "Timed out",
          answer: "",
          error: "Ask took too long — try again or ask a narrower question.",
          meta: "",
          autoHint: "",
        };
      }
      return {
        level: "fail",
        label: "Error",
        answer: res && res.answer ? String(res.answer) : "",
        error: err,
        meta: "",
        autoHint: "",
      };
    }
    var answer = String(res.answer || "");
    var answerLow = answer.toLowerCase();
    var state = String(res.materialState || "");
    var meta =
      "State: " +
      (state || "—") +
      " · Engine: " +
      (res.recallEngine || "—") +
      (res.routerEngine ? " · Router: " + res.routerEngine : "") +
      (res.askIntent ? " · Intent: " + res.askIntent : "") +
      (res.sources && res.sources.length ? " · " + res.sources.length + " source(s)" : "");
    var autoHint = "";
    if (state === "nothing_saved" || answerLow.indexOf("nothing saved yet") >= 0) {
      autoHint = "Auto: likely Miss — confirm below.";
      return { level: "warn", label: "Miss / gap", answer: answer, error: "", meta: meta, autoHint: autoHint };
    }
    if (answerLow.indexOf("too scattered") >= 0) {
      autoHint = "Auto: scattered — often Over or Partly + dump.";
      return { level: "warn", label: "Scattered", answer: answer, error: "", meta: meta, autoHint: autoHint };
    }
    if (looksLikeScrap(answer)) {
      autoHint = "Auto: thin — rate manually.";
      return { level: "warn", label: "Thin / scraps", answer: answer, error: "", meta: meta, autoHint: autoHint };
    }
    autoHint = "Auto: looks OK — rate Pass or Miss using the hint for this slot.";
    return { level: "ok", label: "Answered", answer: answer, error: "", meta: meta, autoHint: autoHint };
  }

  function resolvePassDisplay(spotIdx, row, spotData, slot) {
    var custom =
      spotData && spotData.passCriteria && spotData.passCriteria[spotIdx]
        ? String(spotData.passCriteria[spotIdx]).trim()
        : "";
    if (!custom && row && row.passCriteria) {
      custom = String(row.passCriteria).trim();
    }
    var builtIn =
      (slot && slot.passHint) ||
      (global.LoreKeeperTierA && global.LoreKeeperTierA.spotPassHintForIndex
        ? global.LoreKeeperTierA.spotPassHintForIndex(spotIdx)
        : "");
    if (custom) {
      return { label: "Your pass line", text: custom, custom: true };
    }
    if (builtIn) {
      return { label: "What good looks like", text: builtIn, custom: false };
    }
    return null;
  }

  function manualScoreButtons(rowIndex, currentScore) {
    var TierA = global.LoreKeeperTierA;
    var scores = (TierA && TierA.MANUAL_SCORES) || [
      { id: "pass", label: "Pass" },
      { id: "wrong_type", label: "Wrong type" },
      { id: "miss", label: "Miss" },
      { id: "over", label: "Over" },
      { id: "mixed", label: "Mixed" },
    ];
    var html =
      '<div class="lk-spot-score" data-spot-index="' +
      rowIndex +
      '">';
    scores.forEach(function (s) {
      var active = currentScore === s.id ? " lk-spot-score__btn--active" : "";
      var passClass = s.id === "pass" ? " lk-spot-score__btn--pass" : "";
      html +=
        '<button type="button" class="lk-spot-score__btn' +
        active +
        passClass +
        '" data-score="' +
        escapeHtml(s.id) +
        '" data-index="' +
        rowIndex +
        '">' +
        escapeHtml(s.label) +
        "</button> ";
    });
    html += "</div>";
    if (currentScore && TierA && TierA.scoreLabel) {
      html +=
        '<p class="lk-spot-score__saved" aria-live="polite">' +
        escapeHtml(TierA.scoreLabel(currentScore)) +
        "</p>";
    }
    return html;
  }

  function renderSummary(rows) {
    var TierA = global.LoreKeeperTierA;
    var pass = 0;
    var scored = 0;
    rows.forEach(function (row) {
      if (row.manualScore) {
        scored += 1;
        if (row.manualScore === "pass") pass += 1;
      }
    });
    var target = (TierA && TierA.TARGET_PASS) || TARGET_PASS;
    var met = pass >= target && rows.length >= target;
    return (
      '<div class="lk-spot-summary' +
      (met ? " lk-spot-summary--met" : "") +
      '">' +
      "<strong>Manual score:</strong> " +
      pass +
      " / " +
      rows.length +
      " pass · aim for " +
      target +
      "/10 on your set" +
      (scored < rows.length ? " · rate each question below" : "") +
      (met ? " · quality bar met" : "") +
      "</div>"
    );
  }

  function renderRows(rows) {
    var TierA = global.LoreKeeperTierA;
    var spotData = TierA && TierA.loadSpotData ? TierA.loadSpotData() : null;
    var html = renderSummary(rows) + '<div class="lk-spot-results">';
    rows.forEach(function (row, i) {
      var spotIdx = row.spotIndex != null ? row.spotIndex : i;
      var passLine =
        spotData && spotData.passCriteria && spotData.passCriteria[spotIdx]
          ? spotData.passCriteria[spotIdx]
          : row.passCriteria || "";
      var passDisplay = resolvePassDisplay(spotIdx, row, spotData, slot);
      var slot = TierA && TierA.SPOT_SLOTS ? TierA.SPOT_SLOTS[spotIdx] : null;
      var manualScore =
        (spotData && spotData.manualScores && spotData.manualScores[spotIdx]) ||
        row.manualScore ||
        "";
      row.manualScore = manualScore;
      html +=
        '<article class="lk-spot-results__item lk-spot-results__item--' +
        row.level +
        '">' +
        '<p class="lk-spot-results__head">' +
        '<span class="lk-spot-results__badge">' +
        escapeHtml(row.label) +
        "</span> ";
      if (slot && slot.category) {
        html += '<span class="lk-tier-a-spot-cat">' + escapeHtml(slot.category) + "</span> ";
      }
      html += "<strong>Q" + (i + 1) + ".</strong> " + escapeHtml(row.question) + "</p>";
      if (passDisplay && passDisplay.text) {
        html +=
          '<p class="lk-spot-results__pass muted"><strong>' +
          escapeHtml(passDisplay.label) +
          ":</strong> " +
          escapeHtml(passDisplay.text) +
          "</p>";
      } else if (passLine) {
        html +=
          '<p class="lk-spot-results__pass muted"><strong>Pass line:</strong> ' +
          escapeHtml(passLine) +
          "</p>";
      }
      if (row.meta) {
        html += '<p class="lk-spot-results__meta muted">' + escapeHtml(row.meta) + "</p>";
      }
      if (row.autoHint) {
        html += '<p class="lk-spot-results__auto muted">' + escapeHtml(row.autoHint) + "</p>";
      }
      if (row.answer) {
        html += '<div class="lk-spot-results__answer">' + escapeHtml(row.answer) + "</div>";
      } else if (row.error) {
        html += '<p class="lk-spot-results__error muted">' + escapeHtml(row.error) + "</p>";
      }
      html += manualScoreButtons(spotIdx, manualScore);
      html +=
        '<p class="lk-spot-results__fix muted">Bad answer? <strong>It got this wrong</strong> on Ask.</p>';
      html += "</article>";
    });
    html += "</div>";
    return html;
  }

  function paintResults(out, rows) {
    activeSpotRows = rows;
    saveRowsSession(rows);
    out.innerHTML = renderRows(rows);
    if (global.LoreKeeperTierA && global.LoreKeeperTierA.renderTargetBar) {
      global.LoreKeeperTierA.renderTargetBar();
    }
  }

  function applyManualScore(spotIndex, scoreId) {
    var TierA = global.LoreKeeperTierA;
    if (TierA && TierA.setManualScore) {
      TierA.setManualScore(spotIndex, scoreId);
    }
    activeSpotRows.forEach(function (row) {
      if ((row.spotIndex != null ? row.spotIndex : -1) === spotIndex) {
        row.manualScore = scoreId;
      }
    });
    var out = document.getElementById("phase3SpotResults");
    if (out) paintResults(out, activeSpotRows);
  }

  function renderPending(pending) {
    if (!pending) return "";
    var lead =
      pending.phase === "sync"
        ? "Syncing notes, then asking question " + pending.n + " of " + pending.total + "…"
        : "Asking question " + pending.n + " of " + pending.total + "…";
    return (
      '<article class="lk-spot-results__item lk-spot-results__item--pending" aria-busy="true">' +
      '<p class="lk-spot-results__head">' +
      '<span class="lk-spot-results__badge">Working</span> ' +
      "<strong>Q" +
      pending.n +
      ".</strong> " +
      escapeHtml(pending.question) +
      "</p>" +
      '<p class="lk-spot-results__progress muted">' +
      escapeHtml(lead) +
      "</p>" +
      "</article>"
    );
  }

  function renderLive(rows, pending) {
    var html = "";
    if (rows.length) {
      html += renderRows(rows);
    }
    if (pending) {
      html += renderPending(pending);
    }
    return html;
  }

  function scrollPendingIntoView(out) {
    if (!out) return;
    var pending = out.querySelector(".lk-spot-results__item--pending");
    if (pending && pending.scrollIntoView) {
      pending.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function bindScoreDelegation(out) {
    if (!out || out.dataset.spotScoreBound === "1") return;
    out.dataset.spotScoreBound = "1";
    out.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest(".lk-spot-score__btn") : null;
      if (!btn || !out.contains(btn)) return;
      ev.preventDefault();
      ev.stopPropagation();
      var idx = parseInt(btn.getAttribute("data-index"), 10);
      var score = btn.getAttribute("data-score") || "";
      if (isNaN(idx)) return;
      applyManualScore(idx, score);
    });
  }

  function restoreLastResults(out) {
    var saved = loadRowsSession();
    if (!saved || !saved.length) return;
    var TierA = global.LoreKeeperTierA;
    if (TierA && TierA.loadSpotData) {
      var spotData = TierA.loadSpotData();
      saved.forEach(function (row) {
        var si = row.spotIndex;
        if (si == null) return;
        row.manualScore = (spotData.manualScores && spotData.manualScores[si]) || row.manualScore || "";
      });
    }
    paintResults(out, saved);
  }

  function spotPreflightIssues(spotData, Store) {
    var issues = [];
    if (
      Store &&
      Store.hasPending &&
      typeof Store.hasPending === "function" &&
      Store.hasPending()
    ) {
      issues.push("Notes still syncing — wait for Saved on home or in a doc before spot-check.");
    }
    var questions = (spotData && spotData.questions) || [];
    var passCriteria = (spotData && spotData.passCriteria) || {};
    var filled = 0;
    var missingPass = 0;
    questions.forEach(function (q, idx) {
      if (!String(q || "").trim()) return;
      filled += 1;
      if (!String(passCriteria[idx] || "").trim()) missingPass += 1;
    });
    if (filled && missingPass > 0) {
      issues.push(
        missingPass +
          " question(s) have no custom pass line — add one under each slot (or use the built-in hint)."
      );
    }
    if (filled) {
      issues.push(
        "Hard awareness/portrait questions work best with short tagged notes — not draft-only prose."
      );
    }
    return issues;
  }

  function renderPreflight(issues) {
    if (!issues || !issues.length) return "";
    var html = "<div class='lk-spot-preflight'><p><strong>Before you run</strong></p><ul>";
    issues.forEach(function (line) {
      html += "<li>" + escapeHtml(line) + "</li>";
    });
    html += "</ul></div>";
    return html;
  }

  function initSpotCheckRunner() {
    var btn = document.getElementById("phase3SpotRunBtn");
    var out = document.getElementById("phase3SpotResults");
    if (!out || !global.LoreKeeperTierA) return;

    bindScoreDelegation(out);
    restoreLastResults(out);

    if (!btn) return;
    if (btn.dataset.spotRunBound === "1") return;
    btn.dataset.spotRunBound = "1";

    var running = false;

    function setRunBusy(busy) {
      running = !!busy;
      btn.disabled = !!busy;
      btn.setAttribute("aria-busy", busy ? "true" : "false");
    }

    function releaseRun() {
      setRunBusy(false);
    }

    function failRun(message) {
      releaseRun();
      out.innerHTML =
        "<p class='muted'>" + escapeHtml(message || "Spot-check could not run.") + "</p>";
    }

    btn.addEventListener("click", function () {
      if (running) return;

      var TierA = global.LoreKeeperTierA;
      var persist = TierA.persistSpotQuestionsFromDom
        ? TierA.persistSpotQuestionsFromDom()
        : Promise.resolve();

      setRunBusy(true);

      persist
        .catch(function () {
          return null;
        })
        .then(function () {
          var spotData = TierA.loadSpotData ? TierA.loadSpotData() : { questions: [] };
          var questions = spotData.questions || [];
          var filledPairs = [];
          questions.forEach(function (q, idx) {
            if (String(q || "").trim()) {
              filledPairs.push({ index: idx, question: String(q).trim() });
            }
          });
          if (!filledPairs.length) {
            releaseRun();
            out.innerHTML =
              "<p class='muted'>Add spot-check questions in the fields above first.</p>";
            return;
          }

          var preflight = spotPreflightIssues(spotData, global.LoreKeeperAccountStorage);
          if (preflight.length) {
            out.innerHTML = renderPreflight(preflight);
          }

          var total = filledPairs.length;
          var rows = [];
          var idx = 0;
          var Store = global.LoreKeeperAccountStorage;
          var needsSync =
            Store && Store.hasPending && typeof Store.hasPending === "function" && Store.hasPending();
          var flush =
            needsSync && Store.flush
              ? Store.flush().catch(function () {
                  return null;
                })
              : Promise.resolve();

          function paint(pending) {
            out.innerHTML = renderLive(rows, pending);
            scrollPendingIntoView(out);
          }

          function finish() {
            try {
              filledPairs.forEach(function (pair, rowIdx) {
                if (!rows[rowIdx]) return;
                rows[rowIdx].spotIndex = pair.index;
                rows[rowIdx].manualScore =
                  (spotData.manualScores && spotData.manualScores[pair.index]) || "";
              });
              if (TierA.recordSpotRunSummary) {
                TierA.recordSpotRunSummary(filledPairs.length);
              }
              paintResults(out, rows);
            } catch (e) {
              releaseRun();
              out.innerHTML =
                "<p class='muted'>Spot-check finished but could not show results. Hard refresh and try again.</p>";
            } finally {
              releaseRun();
            }
          }

          function next() {
            if (idx >= filledPairs.length) {
              finish();
              return;
            }
            var pair = filledPairs[idx];
            var q = pair.question;
            var n = idx + 1;
            paint({ n: n, total: total, question: q, phase: "ask" });
            askQuestion(q)
              .then(function (res) {
                var c = classifyResult(res);
                rows.push({
                  question: q,
                  spotIndex: pair.index,
                  passCriteria: (spotData.passCriteria && spotData.passCriteria[pair.index]) || "",
                  level: c.level,
                  label: c.label,
                  answer: c.answer,
                  error: c.error,
                  meta: c.meta,
                  autoHint: c.autoHint,
                  manualScore: (spotData.manualScores && spotData.manualScores[pair.index]) || "",
                });
                idx += 1;
                setTimeout(next, 200);
              })
              .catch(function () {
                rows.push({
                  question: q,
                  spotIndex: pair.index,
                  level: "fail",
                  label: "Error",
                  answer: "",
                  error: "Could not reach Ask after retries.",
                  meta: "",
                  autoHint: "",
                  manualScore: "",
                });
                idx += 1;
                setTimeout(next, 200);
              });
          }

          paint({ n: 1, total: total, question: filledPairs[0].question, phase: "sync" });
          flush.then(next).catch(function () {
            failRun("Could not sync notes before spot-check.");
          });
        })
        .catch(function () {
          failRun("Could not save spot-check questions.");
        });
    });
  }

  global.LoreKeeperSpotCheck = {
    initSpotCheckRunner: initSpotCheckRunner,
    classifyResult: classifyResult,
  };
})(typeof window !== "undefined" ? window : this);
