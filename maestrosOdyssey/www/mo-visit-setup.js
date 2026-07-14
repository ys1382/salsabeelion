/**
 * Start-of-visit setup — café language + protagonist look on one dialog.
 */
(function () {
  "use strict";

  var pendingLane = "";
  var pendingLook = "";

  function needsSetup() {
    var lang = window.MoCafeLanguage;
    var look = window.MoProtagonistLook;
    if (lang && lang.needsPick && lang.needsPick()) return true;
    if (look && look.needsPick && look.needsPick()) return true;
    return false;
  }

  function syncContinueButton() {
    var btn = document.getElementById("mo-visit-setup-continue");
    if (!btn) return;
    var ready = !!pendingLane && !!pendingLook;
    btn.disabled = !ready;
    btn.setAttribute("aria-disabled", ready ? "false" : "true");
  }

  function markSelected(groupAttr, value) {
    var overlay = document.getElementById("mo-language-picker");
    if (!overlay) return;
    overlay.querySelectorAll("[" + groupAttr + "]").forEach(function (btn) {
      var on = btn.getAttribute(groupAttr) === value;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function refreshPlayerSprite() {
    var game = window.__moGame;
    if (!game || !game.scene) return;
    var scene = game.scene.getScene("GameScene");
    if (scene && typeof scene.refreshPlayerAppearance === "function") {
      scene.refreshPlayerAppearance();
    }
  }

  function applySetup() {
    var lang = window.MoCafeLanguage;
    var look = window.MoProtagonistLook;
    if (!lang || !look || !pendingLane || !pendingLook) return false;
    if (!lang.setLane(pendingLane)) return false;
    if (!look.setLook(pendingLook)) return false;
    hidePicker();
    refreshPlayerSprite();
    if (window.MoPrologue && window.MoPrologue.isInSetupPhase && window.MoPrologue.isInSetupPhase()) {
      window.MoPrologue.onSetupComplete();
      return true;
    }
    return true;
  }

  function showPicker() {
    var overlay = document.getElementById("mo-language-picker");
    if (!overlay) return;
    pendingLane = (window.MoCafeLanguage && window.MoCafeLanguage.getLane)
      ? window.MoCafeLanguage.getLane() : "";
    pendingLook = (window.MoProtagonistLook && window.MoProtagonistLook.getLook)
      ? window.MoProtagonistLook.getLook() : "";
    markSelected("data-cafe-lane", pendingLane);
    markSelected("data-protagonist-look", pendingLook);
    syncContinueButton();
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    var hints = document.getElementById("controls-hints");
    if (hints) hints.classList.add("is-hidden");
    var cont = document.getElementById("mo-visit-setup-continue");
    if (cont) cont.focus();
  }

  function hidePicker() {
    var overlay = document.getElementById("mo-language-picker");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    if (window.MoControlsPanel && typeof window.MoControlsPanel.sync === "function") {
      window.MoControlsPanel.sync();
    }
  }

  function initPicker() {
    var overlay = document.getElementById("mo-language-picker");
    if (!overlay) return;

    overlay.querySelectorAll("[data-cafe-lane]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (window.MoAudio && typeof window.MoAudio.unlock === "function") {
          window.MoAudio.unlock();
        }
        pendingLane = btn.getAttribute("data-cafe-lane") || "";
        markSelected("data-cafe-lane", pendingLane);
        syncContinueButton();
      });
    });

    overlay.querySelectorAll("[data-protagonist-look]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (window.MoAudio && typeof window.MoAudio.unlock === "function") {
          window.MoAudio.unlock();
        }
        pendingLook = btn.getAttribute("data-protagonist-look") || "";
        markSelected("data-protagonist-look", pendingLook);
        syncContinueButton();
      });
    });

    var cont = document.getElementById("mo-visit-setup-continue");
    if (cont) {
      cont.addEventListener("click", function () {
        if (cont.disabled) return;
        if (window.MoAudio && typeof window.MoAudio.unlock === "function") {
          window.MoAudio.unlock();
        }
        applySetup();
      });
    }

    if (needsSetup()) {
      if (!(window.MoPrologue && window.MoPrologue.needsPrologue && window.MoPrologue.needsPrologue())) {
        showPicker();
      }
    } else if (window.MoCafeLanguage && typeof window.MoCafeLanguage.syncOrderInputUi === "function") {
      window.MoCafeLanguage.syncOrderInputUi();
      if (window.MoLearningCard && typeof window.MoLearningCard.refreshHud === "function") {
        window.MoLearningCard.refreshHud();
      }
    }
  }

  window.MoVisitSetup = {
    needsSetup: needsSetup,
    showPicker: showPicker,
    hidePicker: hidePicker,
    applySetup: applySetup
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPicker);
  } else {
    initPicker();
  }
})();
