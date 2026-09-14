/**
 * Day-8 elder report (#28) — natural conversation, hidden score, card upgrade.
 * Triggers when fiction week 2 starts AND week language goals are met (not balance = 0).
 */
(function () {
  "use strict";

  var DONE_KEY = "mo_elder_report_done";
  var PASS_KEY = "mo_elder_report_pass";
  var REVISIT_KEY = "mo_elder_needs_revisit";
  var READ_HOUSE_KEY = "mo_read_house_rules";
  var READ_STRIKE_KEY = "mo_read_strike_board";

  var UPGRADED_BALANCE = 400;
  var PASS_BUCKETS = 4;
  var TOTAL_BUCKETS = 5;

  var MIN_DISTINCT_ORDERED = 3;
  var MIN_MEMORIZED = 1;

  var STATE = {
    idle: "idle",
    prompt: "prompt",
    writing: "writing",
    response: "response",
    done: "done"
  };

  var phase = STATE.idle;
  var lastPass = false;

  function storageOn(key) {
    try { return localStorage.getItem(key) === "1"; } catch (e) { return false; }
  }

  function setStorageOn(key, on) {
    try {
      if (on) localStorage.setItem(key, "1");
      else localStorage.removeItem(key);
    } catch (e) { /* private mode */ }
  }

  function isDone() {
    return storageOn(DONE_KEY);
  }

  function passedReport() {
    return storageOn(PASS_KEY);
  }

  function needsRevisit() {
    return storageOn(REVISIT_KEY);
  }

  function fictionDayIndex() {
    var days = window.MoGameDays;
    return days && typeof days.getDayIndex === "function" ? days.getDayIndex() : 1;
  }

  function orderedKeys() {
    if (window.MoMenuQuiz && typeof window.MoMenuQuiz.getOrderedKeys === "function") {
      return window.MoMenuQuiz.getOrderedKeys();
    }
    return [];
  }

  function memorizedKeys() {
    if (window.MoMenuQuiz && typeof window.MoMenuQuiz.getMemorizedKeys === "function") {
      return window.MoMenuQuiz.getMemorizedKeys();
    }
    return [];
  }

  /** Week language goal — distinct orders + at least one word sticking, or strong ordering. */
  function weekLanguageGoalMet() {
    var ordered = orderedKeys();
    var memorized = memorizedKeys();
    if (ordered.length >= 4) return true;
    if (ordered.length >= MIN_DISTINCT_ORDERED && memorized.length >= MIN_MEMORIZED) return true;
    if (memorized.length >= 2) return true;
    return false;
  }

  function isAwaitingLanguageGoal() {
    return fictionDayIndex() >= 8 && !isDone() && !weekLanguageGoalMet();
  }

  function canOfferReport() {
    if (isDone()) return false;
    if (fictionDayIndex() < 8) return false;
    if (!weekLanguageGoalMet()) return false;
    if (window.MoPrologue && window.MoPrologue.needsPrologue && window.MoPrologue.needsPrologue()) return false;
    if (window.MoVisitSetup && window.MoVisitSetup.needsSetup && window.MoVisitSetup.needsSetup()) return false;
    return true;
  }

  function isReportPending() {
    return canOfferReport() && phase === STATE.idle;
  }

  function isActive() {
    return phase === STATE.prompt || phase === STATE.writing || phase === STATE.response;
  }

  function overlayEl() {
    return document.getElementById("mo-prologue-overlay");
  }

  function textEl() {
    return document.getElementById("mo-prologue-text");
  }

  function speakerEl() {
    return document.getElementById("mo-prologue-speaker");
  }

  function hintEl() {
    return document.getElementById("mo-prologue-hint");
  }

  function portraitEl() {
    return document.getElementById("mo-prologue-portrait");
  }

  function inputWrapEl() {
    return document.getElementById("mo-elder-report-input-wrap");
  }

  function inputEl() {
    return document.getElementById("mo-elder-report-input");
  }

  function submitBtnEl() {
    return document.getElementById("mo-elder-report-submit");
  }

  function isMuslimLook() {
    var look = "";
    if (window.MoProtagonistLook && typeof window.MoProtagonistLook.getLook === "function") {
      look = window.MoProtagonistLook.getLook() || "";
    }
    return look === "man_kufi" || look === "woman_jilbab";
  }

  function openerLine() {
    if (isMuslimLook()) {
      return "I haven't been to Dragon's Brew in quite some time, dear. Tell me about it — the food, the room, the community. Use whatever words you have, insha'Allah.";
    }
    return "I haven't been to Dragon's Brew in quite some time, dear. Tell me about it — the food, the room, the community. Use whatever words you have.";
  }

  function passLine() {
    return "That sounds lovely, dear.";
  }

  function revisitLine() {
    return "I love that place. Can you go back and find out more for me?";
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s\u0600-\u06FF]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function textMatchesAny(text, patterns) {
    return patterns.some(function (p) { return text.indexOf(p) >= 0; });
  }

  function scoreReport(text) {
    var t = normalize(text);
    if (!t) return { score: 0, buckets: 0, matched: [] };

    var menu = window.DragonsBrewMenu;
    var itemTerms = ["cafe", "café", "coffee", "tea", "té", "muffin", "chocolate", "espresso", "toast", "tostada",
      "croissant", "galleta", "cookie", "bolillo", "food", "drink", "menu", "qahwa", "shay", "azucar", "azúcar"];
    if (menu && typeof menu.getVisibleItems === "function") {
      var visible = menu.getVisibleItems();
      (visible.drinks || []).concat(visible.food || []).forEach(function (item) {
        if (!item) return;
        [item.en, item.es, item.ar, item.arRom].forEach(function (part) {
          if (!part) return;
          var n = normalize(part);
          if (n.length > 2) itemTerms.push(n);
        });
      });
    }
    orderedKeys().forEach(function (key) {
      if (menu && menu.getItemByKey && menu.getItemByKey(key)) {
        var item = menu.getItemByKey(key);
        [item.en, item.es, item.ar, item.arRom].forEach(function (part) {
          if (!part) return;
          var n = normalize(part);
          if (n.length > 2) itemTerms.push(n);
        });
      }
    });

    var buckets = [
      {
        id: "food_drink",
        hit: textMatchesAny(t, itemTerms)
      },
      {
        id: "mara",
        hit: textMatchesAny(t, ["mara", "barista", "campire", "counter", "wings", "tail"])
      },
      {
        id: "rules_strike",
        hit: storageOn(READ_HOUSE_KEY) || storageOn(READ_STRIKE_KEY) ||
          textMatchesAny(t, ["rule", "house", "blood", "racism", "strike", "sugar", "brown", "refuse", "welcome"])
      },
      {
        id: "room",
        hit: textMatchesAny(t, ["warm", "cozy", "community", "room", "feel", "friendly", "kind", "calm", "nice"])
      },
      {
        id: "neighbors",
        hit: textMatchesAny(t, ["species", "customer", "people", "neighbor", "fellow", "regular", "table", "room"])
      }
    ];

    var matched = buckets.filter(function (b) { return b.hit; });
    var score = matched.length / TOTAL_BUCKETS;
    return { score: score, buckets: matched.length, matched: matched.map(function (b) { return b.id; }) };
  }

  function setPrologueText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function setHudHidden(hidden) {
    var cardHud = document.getElementById("mo-learning-card-hud");
    var dayHud = document.getElementById("mo-day-hud");
    if (cardHud) cardHud.classList.toggle("is-prologue-hidden", !!hidden);
    if (dayHud) dayHud.classList.toggle("is-prologue-hidden", !!hidden);
  }

  function showOverlay(mode) {
    var overlay = overlayEl();
    if (!overlay) return;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    overlay.classList.remove("is-opening", "is-elder", "is-report");
    if (mode === "elder" || mode === "report") overlay.classList.add("is-elder");
    if (mode === "report") overlay.classList.add("is-report");
    var hints = document.getElementById("controls-hints");
    if (hints) hints.classList.add("is-hidden");
  }

  function hideOverlay() {
    var overlay = overlayEl();
    if (!overlay) return;
    overlay.classList.remove("is-open", "is-opening", "is-elder", "is-report");
    overlay.setAttribute("aria-hidden", "true");
    var wrap = inputWrapEl();
    if (wrap) {
      wrap.hidden = true;
      wrap.setAttribute("aria-hidden", "true");
    }
  }

  function showInput(show) {
    var wrap = inputWrapEl();
    var input = inputEl();
    var hint = hintEl();
    if (!wrap || !input) return;
    wrap.hidden = !show;
    wrap.setAttribute("aria-hidden", show ? "false" : "true");
    if (hint) {
      hint.textContent = show
        ? "Tell the elder in your own words — Enter to send, Shift+Enter for a new line"
        : "Space, E, or R — continue";
    }
    if (show) {
      input.value = "";
      window.setTimeout(function () { input.focus(); }, 80);
    }
  }

  function renderPrompt() {
    if (speakerEl()) speakerEl().textContent = "Community elder";
    setPrologueText(textEl(), openerLine());
    showInput(false);
    if (window.MoElderPortrait) {
      window.MoElderPortrait.refreshPortraitElement(portraitEl());
    }
  }

  function renderWriting() {
    setPrologueText(textEl(), "Take your time — what did you notice at Dragon's Brew?");
    showInput(true);
  }

  function renderResponse() {
    showInput(false);
    setPrologueText(textEl(), lastPass ? passLine() : revisitLine());
  }

  function upgradeCard() {
    var budget = UPGRADED_BALANCE;
    if (window.MoPrologue && typeof window.MoPrologue.WEEK_START_BUDGET === "number") {
      budget = window.MoPrologue.WEEK_START_BUDGET;
    }
    if (window.MoLearningCard && typeof window.MoLearningCard.setBalance === "function") {
      window.MoLearningCard.setBalance(budget);
    }
  }

  function completeReport() {
    phase = STATE.done;
    hideOverlay();
    setStorageOn(DONE_KEY, true);
    setStorageOn(PASS_KEY, lastPass);
    setStorageOn(REVISIT_KEY, !lastPass);
    upgradeCard();
    setHudHidden(false);
    if (window.MoControlsPanel && typeof window.MoControlsPanel.sync === "function") {
      window.MoControlsPanel.sync();
    }
  }

  function submitReport() {
    var input = inputEl();
    if (!input) return;
    var result = scoreReport(input.value);
    lastPass = result.buckets >= PASS_BUCKETS;
    phase = STATE.response;
    renderResponse();
  }

  function advance() {
    if (phase === STATE.prompt) {
      phase = STATE.writing;
      renderWriting();
      return true;
    }
    if (phase === STATE.response) {
      completeReport();
      return true;
    }
    return false;
  }

  function startReport() {
    if (!canOfferReport() || isActive()) return false;
    phase = STATE.prompt;
    lastPass = false;
    setHudHidden(true);
    showOverlay("report");
    renderPrompt();
    return true;
  }

  function tryOfferReport() {
    if (!canOfferReport()) return false;
    return startReport();
  }

  function markWallRead(kind) {
    if (kind === "house_rules") setStorageOn(READ_HOUSE_KEY, true);
    if (kind === "strike") setStorageOn(READ_STRIKE_KEY, true);
  }

  function reset() {
    phase = STATE.idle;
    lastPass = false;
    setStorageOn(DONE_KEY, false);
    setStorageOn(PASS_KEY, false);
    setStorageOn(REVISIT_KEY, false);
    setStorageOn(READ_HOUSE_KEY, false);
    setStorageOn(READ_STRIKE_KEY, false);
    hideOverlay();
    showInput(false);
  }

  function handleOverlayClick(event) {
    if (!isActive()) return;
    if (phase === STATE.writing) return;
    if (event.target && event.target.closest && event.target.closest("#mo-elder-report-input-wrap")) return;
    advance();
  }

  function handleKey(event) {
    if (!isActive()) return;
    if (phase === STATE.writing) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        submitReport();
      }
      return;
    }
    var key = event.key;
    if (key === " " || key === "e" || key === "E" || key === "r" || key === "R") {
      if (key === " ") event.preventDefault();
      advance();
    }
  }

  function init() {
    document.addEventListener("keydown", handleKey, true);
    var overlay = overlayEl();
    if (overlay) overlay.addEventListener("click", handleOverlayClick);
    var submit = submitBtnEl();
    if (submit) {
      submit.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (phase === STATE.writing) submitReport();
      });
    }
    var input = inputEl();
    if (input) {
      ["keydown", "keyup", "keypress", "input"].forEach(function (evt) {
        input.addEventListener(evt, function (e) {
          if (phase === STATE.writing) e.stopPropagation();
        });
      });
    }
    window.setTimeout(tryOfferReport, 600);
  }

  window.MoElderReport = {
    DONE_KEY: DONE_KEY,
    weekLanguageGoalMet: weekLanguageGoalMet,
    isAwaitingLanguageGoal: isAwaitingLanguageGoal,
    isReportPending: isReportPending,
    canOfferReport: canOfferReport,
    isActive: isActive,
    isDone: isDone,
    passedReport: passedReport,
    needsRevisit: needsRevisit,
    startReport: startReport,
    tryOfferReport: tryOfferReport,
    markWallRead: markWallRead,
    reset: reset,
    scoreReport: scoreReport
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
