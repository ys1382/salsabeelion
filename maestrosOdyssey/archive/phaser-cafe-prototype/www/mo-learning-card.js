/**
 * Prepaid learning card — balance granted at prologue elder (#10).
 * Spanish lane → pesos (MXN). Arabic lane → dirham (درهم). Same numbers; no real payment APIs.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "mo_learning_card_balance";
  var STUB_START_MXN = 410;

  function prologuePending() {
    return window.MoPrologue && window.MoPrologue.needsPrologue && window.MoPrologue.needsPrologue();
  }

  function parseBalance(raw) {
    var n = parseInt(raw, 10);
    if (!isFinite(n) || n < 0) return null;
    return n;
  }

  function setBalance(amount) {
    var n = Math.max(0, Math.floor(amount));
    try {
      localStorage.setItem(STORAGE_KEY, String(n));
    } catch (e) { /* private mode */ }
    refreshHud();
    return n;
  }

  function getBalance() {
    if (prologuePending()) {
      return 0;
    }
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null || raw === "") {
        return setBalance(STUB_START_MXN);
      }
      var balance = parseBalance(raw);
      if (balance === null) {
        return setBalance(STUB_START_MXN);
      }
      return balance;
    } catch (e) {
      return STUB_START_MXN;
    }
  }

  function formatMoney(amount) {
    var lang = window.MoCafeLanguage;
    if (lang && typeof lang.formatMoney === "function") {
      return lang.formatMoney(amount);
    }
    return amount + " pesos";
  }

  function formatHudLabel(amount) {
    if (prologuePending()) {
      return "Learning card: —";
    }
    if (typeof amount !== "number") amount = getBalance();
    return "Learning card: " + formatMoney(amount);
  }

  function refreshHud() {
    var el = document.getElementById("mo-learning-card-hud");
    if (el) el.textContent = formatHudLabel(getBalance());
  }

  function initHud() {
    if (prologuePending()) {
      refreshHud();
      return;
    }
    getBalance();
    refreshHud();
  }

  function addBalance(amount) {
    amount = Math.max(0, Math.floor(amount));
    if (!amount) return getBalance();
    return setBalance(getBalance() + amount);
  }

  function tryPay(amount) {
    amount = Math.max(0, Math.floor(amount));
    var balance = getBalance();
    if (balance < amount) {
      return { ok: false, balance: balance, amount: amount };
    }
    var newBalance = setBalance(balance - amount);
    return { ok: true, balance: newBalance, amount: amount };
  }

  window.MoLearningCard = {
    STORAGE_KEY: STORAGE_KEY,
    STUB_START_MXN: STUB_START_MXN,
    getBalance: getBalance,
    setBalance: setBalance,
    addBalance: addBalance,
    tryPay: tryPay,
    formatMoney: formatMoney,
    formatPesos: formatMoney,
    formatHudLabel: formatHudLabel,
    refreshHud: refreshHud,
    initHud: initHud
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHud);
  } else {
    initHud();
  }
})();
