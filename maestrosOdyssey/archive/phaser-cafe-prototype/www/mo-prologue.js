/**
 * Prologue (#10) — Stardew-shaped opener, setup, elder grant, learning card.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "mo_prologue_done";
  var WEEK_START_BUDGET = 400;

  var STATE = {
    idle: "idle",
    opening: "opening",
    setup: "setup",
    elder: "elder",
    done: "done"
  };

  var phase = STATE.idle;
  var beatIndex = 0;

  var OPENER_BEATS = [
    "You live on this block.",
    "Mornings start quiet here.",
    "Someone wanted to see you before you head out."
  ];

  function currencyWord() {
    var lane = window.MoCafeLanguage && window.MoCafeLanguage.getLane
      ? window.MoCafeLanguage.getLane() : "es";
    return lane === "ar" ? "dirham" : "pesos";
  }

  function formatBudget() {
    var lang = window.MoCafeLanguage;
    if (lang && typeof lang.formatMoney === "function") {
      return lang.formatMoney(WEEK_START_BUDGET);
    }
    return WEEK_START_BUDGET + " " + currencyWord();
  }

  function getProtagonistLook() {
    if (window.MoProtagonistLook && typeof window.MoProtagonistLook.getLook === "function") {
      return window.MoProtagonistLook.getLook() || "";
    }
    return "";
  }

  function isMuslimLook(look) {
    return look === "man_kufi" || look === "woman_jilbab";
  }

  function elderBeats() {
    var money = formatBudget();
    var muslim = isMuslimLook(getProtagonistLook());
    var cardOffer = muslim
      ? "I'd like for you to have one, insha'Allah."
      : "I'd like you to have one.";
    var cardRules = "When the balance reads zero, that's the end of it. We don't borrow past zero, so you never owe more than what's on the card.";
    if (muslim) {
      cardRules += " Alhamdulillah, you can avoid going into debt with <em>this</em> card.\n\n*Laughs*";
    }
    var greeting = muslim
      ? "Good morning, dear. I'm one of the elders who helps look after this block. You've been part of the neighborhood for a while now, masha'Allah."
      : "Good morning, dear. I'm one of the elders who helps look after this block. You've been part of the neighborhood for a while now.";
    var dragonsBrew = muslim
      ? "Dragon's Brew down the path is the kindest place to start. It's a warm room with a good counter, and every species is welcome there, alhamdulillah. Take your mornings there when you're ready, insha'Allah."
      : "Dragon's Brew down the path is the kindest place to start. It's a warm room with a good counter, and every species is welcome there. Take your mornings there when you're ready.";
    var checkIn = muslim
      ? "On the same weekday next week, I'll check in with you, insha'Allah. I'd love to hear about the food, the feel of the room, and the community you meet there."
      : "On the same weekday next week, I'll check in with you. I'd love to hear about the food, the feel of the room, and the community you meet there.";
    var handoff = muslim
      ? "Here — this is yours now. Take your time. The street is waiting whenever you're ready to go, insha'Allah."
      : "Here — this is yours now. Take your time. The street is waiting whenever you're ready to go.";
    return [
      greeting,
      "When someone wants to learn the block properly — not just pass through like a tourist — the community keeps a learning card for them. " + cardOffer,
      "I'm loading yours with about a week's worth of meals at the counter — " + money + ". Use it when you order. " + cardRules,
      dragonsBrew,
      "While you're there, notice the menu, the house rules on the wall, and the people who share the room — not gossip, nothing like that. Just what a good neighbor would notice, with kind eyes.",
      checkIn,
      handoff
    ];
  }

  function isDone() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function needsPrologue() {
    return !isDone();
  }

  function isActive() {
    return phase !== STATE.idle && phase !== STATE.done;
  }

  function isInSetupPhase() {
    return phase === STATE.setup;
  }

  function markDone() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch (e) { /* private mode */ }
  }

  function clearDone() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* private mode */ }
  }

  function overlayEl() {
    return document.getElementById("mo-prologue-overlay");
  }

  function textEl() {
    return document.getElementById("mo-prologue-text");
  }

  function portraitEl() {
    return document.getElementById("mo-prologue-portrait");
  }

  function hintEl() {
    return document.getElementById("mo-prologue-hint");
  }

  function setHudDuringPrologue(hidden) {
    var cardHud = document.getElementById("mo-learning-card-hud");
    var dayHud = document.getElementById("mo-day-hud");
    if (cardHud) {
      cardHud.classList.toggle("is-prologue-hidden", !!hidden);
      if (hidden) cardHud.textContent = "Learning card: —";
    }
    if (dayHud) dayHud.classList.toggle("is-prologue-hidden", !!hidden);
  }

  function showOverlay(mode) {
    var overlay = overlayEl();
    if (!overlay) return;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    overlay.classList.remove("is-opening", "is-elder");
    if (mode === "opening") overlay.classList.add("is-opening");
    if (mode === "elder") overlay.classList.add("is-elder");
    var hints = document.getElementById("controls-hints");
    if (hints) hints.classList.add("is-hidden");
  }

  function hideOverlay() {
    var overlay = overlayEl();
    if (!overlay) return;
    overlay.classList.remove("is-open", "is-opening", "is-elder");
    overlay.setAttribute("aria-hidden", "true");
  }

  function currentBeats() {
    if (phase === STATE.opening) return OPENER_BEATS;
    if (phase === STATE.elder) return elderBeats();
    return [];
  }

  function setPrologueText(el, text) {
    if (!el) return;
    if (text.indexOf("<em>") !== -1) {
      el.innerHTML = text.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");
    } else {
      el.textContent = text;
    }
  }

  function renderBeat() {
    var beats = currentBeats();
    var text = beats[beatIndex] || "";
    setPrologueText(textEl(), text);
    if (phase === STATE.elder && window.MoElderPortrait) {
      window.MoElderPortrait.refreshPortraitElement(portraitEl());
    }
  }

  function beginOpening() {
    phase = STATE.opening;
    beatIndex = 0;
    setHudDuringPrologue(true);
    showOverlay("opening");
    renderBeat();
  }

  function beginSetup() {
    phase = STATE.setup;
    beatIndex = 0;
    hideOverlay();
    if (window.MoVisitSetup && typeof window.MoVisitSetup.showPicker === "function") {
      window.MoVisitSetup.showPicker();
    }
  }

  function beginElder() {
    phase = STATE.elder;
    beatIndex = 0;
    showOverlay("elder");
    renderBeat();
  }

  function complete() {
    phase = STATE.done;
    hideOverlay();
    markDone();
    if (window.MoLearningCard && typeof window.MoLearningCard.setBalance === "function") {
      window.MoLearningCard.setBalance(WEEK_START_BUDGET);
    }
    setHudDuringPrologue(false);
    if (window.MoControlsPanel && typeof window.MoControlsPanel.sync === "function") {
      window.MoControlsPanel.sync();
    }
    if (window.MoCafeLanguage && typeof window.MoCafeLanguage.syncOrderInputUi === "function") {
      window.MoCafeLanguage.syncOrderInputUi();
    }
    refreshPlayerSprite();
    if (window.MoElderReport && typeof window.MoElderReport.tryOfferReport === "function") {
      window.setTimeout(function () { window.MoElderReport.tryOfferReport(); }, 400);
    }
  }

  function refreshPlayerSprite() {
    var game = window.__moGame;
    if (!game || !game.scene) return;
    var scene = game.scene.getScene("GameScene");
    if (scene && typeof scene.refreshPlayerAppearance === "function") {
      scene.refreshPlayerAppearance();
    }
  }

  function advance() {
    if (!isActive()) return false;
    if (phase === STATE.setup) return false;

    var beats = currentBeats();
    if (beatIndex < beats.length - 1) {
      beatIndex += 1;
      renderBeat();
      return true;
    }

    if (phase === STATE.opening) {
      beginSetup();
      return true;
    }
    if (phase === STATE.elder) {
      complete();
      return true;
    }
    return false;
  }

  function onSetupComplete() {
    if (phase !== STATE.setup) return;
    beginElder();
  }

  function start() {
    if (!needsPrologue()) {
      phase = STATE.done;
      setHudDuringPrologue(false);
      return;
    }
    beginOpening();
  }

  function handleKey(event) {
    if (!isActive() || phase === STATE.setup) return;
    var key = event.key;
    if (key === " " || key === "e" || key === "E" || key === "r" || key === "R") {
      if (key === " ") event.preventDefault();
      if (window.MoAudio && typeof window.MoAudio.unlock === "function") {
        window.MoAudio.unlock();
      }
      advance();
    }
  }

  function init() {
    document.addEventListener("keydown", handleKey, true);
    var overlay = overlayEl();
    if (overlay) {
      overlay.addEventListener("click", function () {
        if (isActive() && phase !== STATE.setup) advance();
      });
    }
    if (needsPrologue()) {
      start();
    } else {
      phase = STATE.done;
      setHudDuringPrologue(false);
    }
  }

  window.MoPrologue = {
    STORAGE_KEY: STORAGE_KEY,
    WEEK_START_BUDGET: WEEK_START_BUDGET,
    needsPrologue: needsPrologue,
    isActive: isActive,
    isInSetupPhase: isInSetupPhase,
    start: start,
    advance: advance,
    complete: complete,
    onSetupComplete: onSetupComplete,
    clearDone: clearDone,
    beginOpening: beginOpening
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
