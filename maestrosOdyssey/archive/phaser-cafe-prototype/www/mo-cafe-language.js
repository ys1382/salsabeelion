/**
 * Dragon's Brew — one café learning lane (Spanish or Arabic).
 * Culture keywords from peoples stay in their native tongue elsewhere — not overridden here.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "mo_cafe_language_lane";
  var VALID = { es: true, ar: true };

  function getLane() {
    try {
      var lane = localStorage.getItem(STORAGE_KEY);
      return VALID[lane] ? lane : "";
    } catch (e) {
      return "";
    }
  }

  function setLane(lane) {
    if (!VALID[lane]) return false;
    try {
      localStorage.setItem(STORAGE_KEY, lane);
    } catch (e) {
      return false;
    }
    syncOrderInputUi();
    if (window.MoLearningCard && typeof window.MoLearningCard.refreshHud === "function") {
      window.MoLearningCard.refreshHud();
    }
    return true;
  }

  function clearLane() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* private mode */ }
    syncOrderInputUi();
  }

  function needsPick() {
    return !getLane();
  }

  function laneLabel(lane) {
    lane = lane || getLane();
    if (lane === "ar") return "Arabic";
    if (lane === "es") return "Spanish";
    return "";
  }

  function itemLemma(item) {
    if (!item) return "";
    var lane = getLane();
    if (lane === "ar" && item.ar) return item.ar;
    if (lane === "es" && item.es) return item.es;
    return item.es || item.en || "";
  }

  /** Menu / order matching string for the active lane. */
  function itemMatchText(item) {
    return itemLemma(item);
  }

  function orderLanguageName() {
    return laneLabel() || "your café language";
  }

  function itemTranslit(item) {
    if (!item) return "";
    return item.arRom || "";
  }

  /** Wall-style label for quiz feedback (Arabic lane: translit — script). */
  function itemTeachingHint(item) {
    if (!item) return "";
    var lane = getLane();
    if (lane === "ar" && item.ar) {
      return (item.arRom || item.en) + " — " + item.ar;
    }
    return itemLemma(item);
  }

  function orderPlaceholder(mode) {
    var lang = orderLanguageName();
    if (getLane() === "ar") {
      if (mode === "quiz") {
        return "Type romanization or Arabic from the board, then Enter";
      }
      return "Type romanization (e.g. Qahwa) or Arabic, then Enter";
    }
    if (mode === "quiz") {
      return "Type the " + lang + " word from the board, then Enter";
    }
    return "Type your order in " + lang + ", then Enter";
  }

  function orderAriaLabel() {
    return "Your order in " + orderLanguageName();
  }

  /**
   * Fold café Arabic romanization for order/quiz matching.
   * Board marks: Q ق · ħ ح · kh خ · sh ش · gh غ · ' ع · ť ط · š ص · ď ض
   * Plain ASCII input still matches after fold.
   */
  function normalizeArabicRoman(text) {
    var s = String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[''`]/g, "");
    s = s.replace(/kh/g, "__kh__");
    s = s.replace(/sh/g, "__sh__");
    s = s.replace(/gh/g, "__gh__");
    s = s.replace(/[ħḥ]/g, "h");
    s = s.replace(/[šṣ]/g, "s");
    s = s.replace(/[ťţṭ]/g, "t");
    s = s.replace(/[ďḑḍ]/g, "d");
    s = s.replace(/__kh__/g, "kh");
    s = s.replace(/__sh__/g, "sh");
    s = s.replace(/__gh__/g, "gh");
    return s
      .replace(/[^\w\s\u0600-\u06FFáéíóúüñ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** In-world money label for the active café lane (same numeric balance; different fiction). */
  function formatMoney(amount) {
    amount = Math.max(0, Math.floor(amount));
    if (amount === 0) return "included";
    if (getLane() === "ar") {
      return amount + " dirham — درهم";
    }
    return amount + " pesos";
  }

  function formatMoneyShort(amount) {
    amount = Math.max(0, Math.floor(amount));
    if (getLane() === "ar") {
      return amount + " dirham";
    }
    return amount + " pesos";
  }

  function syncOrderInputUi() {
    var input = document.getElementById("mara-order-input");
    if (!input) return;
    var lane = getLane();
    input.dir = lane === "ar" ? "rtl" : "ltr";
    input.lang = lane === "ar" ? "ar" : lane === "es" ? "es" : "";
    input.placeholder = orderPlaceholder("order");
    input.setAttribute("aria-label", orderAriaLabel());
  }

  function showPicker() {
    var overlay = document.getElementById("mo-language-picker");
    if (!overlay) return;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    var hints = document.getElementById("controls-hints");
    if (hints) hints.classList.add("is-hidden");
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

  window.MoCafeLanguage = {
    getLane: getLane,
    setLane: setLane,
    clearLane: clearLane,
    needsPick: needsPick,
    laneLabel: laneLabel,
    itemLemma: itemLemma,
    itemTranslit: itemTranslit,
    itemTeachingHint: itemTeachingHint,
    itemMatchText: itemMatchText,
    orderLanguageName: orderLanguageName,
    orderPlaceholder: orderPlaceholder,
    orderAriaLabel: orderAriaLabel,
    normalizeArabicRoman: normalizeArabicRoman,
    formatMoney: formatMoney,
    formatMoneyShort: formatMoneyShort,
    syncOrderInputUi: syncOrderInputUi,
    showPicker: showPicker,
    hidePicker: hidePicker
  };
})();
