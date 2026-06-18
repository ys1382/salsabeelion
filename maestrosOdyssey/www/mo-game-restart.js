/**
 * Restart this browser-tab play session — Mara intro, visit, learning-card balance.
 * Menu rotation in localStorage is kept unless owner clears site data.
 */
(function () {
  "use strict";

  var SESSION_KEYS = [
    "mo_mara_intro_done",
    "mo_menu_ready_for_order",
    "mo_cafe_visit_phase",
    "mo_cafe_order_text",
    "mo_cafe_order_total_pesos"
  ];

  function restartPlaySession() {
    try {
      SESSION_KEYS.forEach(function (key) {
        sessionStorage.removeItem(key);
      });
      localStorage.removeItem("mo_learning_card_balance");
      localStorage.removeItem("mo_dragons_brew_menu_v3");
      if (window.MoGameDays && typeof window.MoGameDays.reset === "function") {
        window.MoGameDays.reset();
      }
    } catch (e) { /* private mode */ }
    window.location.reload();
  }

  function initRestartButton() {
    var btn = document.getElementById("mo-restart-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (!window.confirm("Restart this visit? Mara intro, café week, and learning-card balance reset.")) return;
      restartPlaySession();
    });
  }

  window.MoGameRestart = { restartPlaySession: restartPlaySession };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRestartButton);
  } else {
    initRestartButton();
  }
})();
