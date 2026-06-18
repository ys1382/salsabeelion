/**
 * Prepaid learning card — stub balance until prologue elder (#10).
 * Mexican pesos (MXN) only; no real payment APIs.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "mo_learning_card_balance";
  var STUB_START_MXN = 200;

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

  function formatPesos(amount) {
    return amount + " pesos";
  }

  function formatHudLabel(amount) {
    if (typeof amount !== "number") amount = getBalance();
    return "Learning card: " + formatPesos(amount);
  }

  function refreshHud() {
    var el = document.getElementById("mo-learning-card-hud");
    if (el) el.textContent = formatHudLabel(getBalance());
  }

  function initHud() {
    getBalance();
    refreshHud();
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
    tryPay: tryPay,
    formatPesos: formatPesos,
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
