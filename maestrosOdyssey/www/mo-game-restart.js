/**
 * Restart this browser-tab play session — Mara intro, visit, learning-card balance.
 * Soft-restarts Phaser when possible (no full Phaser re-download).
 * Owner-only site: hard refresh (Shift+reload) clears the same state as Restart.
 */
(function () {
  "use strict";

  var HARD_RELOAD_INTENT_KEY = "mo_hard_reload_intent";
  var lastShiftKeyAt = 0;

  var SESSION_KEYS = [
    "mo_mara_intro_done",
    "mo_menu_ready_for_order",
    "mo_cafe_visit_phase",
    "mo_cafe_order_text",
    "mo_cafe_order_total_pesos",
    "mo_cafe_session_visit_done",
    "mo_cafe_visit_finished_awaiting"
  ];

  var LOCAL_STORAGE_KEYS = [
    "mo_learning_card_balance",
    "mo_dragons_brew_menu_v3",
    "mo_dragons_brew_menu_v4",
    "mo_dragons_brew_menu_v5",
    "mo_cafe_day_index",
    "mo_cafe_language_lane",
    "mo_protagonist_look",
    "mo_cafe_ordered_item_keys",
    "mo_cafe_memorized_item_keys",
    "mo_cafe_item_familiarity",
    "mo_cafe_quiz_earned_day",
    "mo_cafe_quiz_earned_amount"
  ];

  function markHardReloadIntent() {
    try {
      sessionStorage.setItem(HARD_RELOAD_INTENT_KEY, "1");
    } catch (e) { /* private mode */ }
  }

  function isHardReloadNavigation() {
    try {
      if (sessionStorage.getItem(HARD_RELOAD_INTENT_KEY) === "1") {
        sessionStorage.removeItem(HARD_RELOAD_INTENT_KEY);
        return true;
      }
    } catch (e) { /* private mode */ }
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      if (!nav || nav.type !== "reload" || nav.transferSize <= 0) return false;
      if (nav.deliveryType === "cache" || nav.deliveryType === "navigational-prefetch") return false;
      var resources = performance.getEntriesByType && performance.getEntriesByType("resource");
      if (!resources || !resources.length) return false;
      for (var i = 0; i < resources.length; i++) {
        var r = resources[i];
        if (!r || !r.name) continue;
        if (r.name.indexOf("mo-game-restart.js") === -1) continue;
        if (r.transferSize > 0 && r.deliveryType !== "cache") return true;
      }
    } catch (e2) { /* old browsers */ }
    return false;
  }

  function isHardReloadShortcut(event) {
    if (!event) return false;
    if (event.key === "F5" && event.shiftKey) return true;
    if ((event.key === "r" || event.key === "R") && event.shiftKey && (event.metaKey || event.ctrlKey)) {
      return true;
    }
    return false;
  }

  window.addEventListener("keydown", function (event) {
    if (event.key === "Shift") lastShiftKeyAt = Date.now();
    if (isHardReloadShortcut(event)) markHardReloadIntent();
  }, true);

  window.addEventListener("beforeunload", function () {
    if (Date.now() - lastShiftKeyAt < 800) markHardReloadIntent();
  });

  function hideDomOverlays() {
    var orderWrap = document.getElementById("mara-order-wrap");
    var visitWrap = document.getElementById("mara-visit-wrap");
    var orderInput = document.getElementById("mara-order-input");
    if (orderWrap) {
      orderWrap.classList.remove("is-open");
      orderWrap.setAttribute("aria-hidden", "true");
    }
    if (visitWrap) {
      visitWrap.classList.remove("is-open");
      visitWrap.setAttribute("aria-hidden", "true");
    }
    if (orderInput) orderInput.value = "";
  }

  function clearPlayStorage() {
    try {
      SESSION_KEYS.forEach(function (key) {
        sessionStorage.removeItem(key);
      });
      if (window.MoGameDays && typeof window.MoGameDays.clearCompletedVisitFlags === "function") {
        window.MoGameDays.clearCompletedVisitFlags();
      }
      LOCAL_STORAGE_KEYS.forEach(function (key) {
        localStorage.removeItem(key);
      });
      if (window.MoProtagonistLook && typeof window.MoProtagonistLook.clearLook === "function") {
        window.MoProtagonistLook.clearLook();
      }
      if (window.MoCafeLanguage && typeof window.MoCafeLanguage.clearLane === "function") {
        window.MoCafeLanguage.clearLane();
      }
      if (window.MoMenuQuiz && typeof window.MoMenuQuiz.resetProgress === "function") {
        window.MoMenuQuiz.resetProgress();
      }
    } catch (e) { /* private mode */ }
  }

  function applyHardReloadResetIfNeeded() {
    if (!isHardReloadNavigation()) return false;
    clearPlayStorage();
    return true;
  }

  function refreshHudAfterReset() {
    if (window.MoGameDays && typeof window.MoGameDays.reset === "function") {
      window.MoGameDays.reset();
    }
    if (window.MoMenuQuiz && typeof window.MoMenuQuiz.resetProgress === "function") {
      window.MoMenuQuiz.resetProgress();
    }
    if (window.MoLearningCard && typeof window.MoLearningCard.setBalance === "function") {
      window.MoLearningCard.setBalance(window.MoLearningCard.STUB_START_MXN);
    }
    if (window.MoControlsPanel && typeof window.MoControlsPanel.resetDismiss === "function") {
      window.MoControlsPanel.resetDismiss();
    }
  }

  function softRestartPhaser() {
    var game = window.__moGame;
    if (!game || !game.scene) return false;
    var scene = game.scene.getScene("GameScene");
    if (!scene || !scene.scene) return false;
    scene.scene.restart();
    return true;
  }

  function setRestartBusy(busy) {
    var btn = document.getElementById("mo-restart-btn");
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = busy ? "Restarting…" : "Restart";
  }

  function restartPlaySession() {
    setRestartBusy(true);
    try {
      if (window.DragonsBrewMenu && typeof window.DragonsBrewMenu.resetSessionState === "function") {
        window.DragonsBrewMenu.resetSessionState();
      }
      clearPlayStorage();
      refreshHudAfterReset();
      hideDomOverlays();
      if (window.MoVisitSetup && typeof window.MoVisitSetup.showPicker === "function") {
        window.MoVisitSetup.showPicker();
      } else if (window.MoCafeLanguage && typeof window.MoCafeLanguage.showPicker === "function") {
        window.MoCafeLanguage.showPicker();
      }
      if (softRestartPhaser()) {
        setRestartBusy(false);
        return;
      }
    } catch (e) { /* fall through to hard reload */ }
    window.location.reload();
  }

  function initRestartButton() {
    var btn = document.getElementById("mo-restart-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (!window.confirm("Restart this visit? Language, your look, Mara intro, café week, and learning-card balance reset.")) return;
      restartPlaySession();
    });
  }

  window.MoGameRestart = {
    restartPlaySession: restartPlaySession,
    clearPlayStorage: clearPlayStorage
  };

  applyHardReloadResetIfNeeded();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRestartButton);
  } else {
    initRestartButton();
  }
})();
