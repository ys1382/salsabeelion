/**
 * Fiction café week — Mon→Sun, advances after completed visit (#12).
 * Separate from real-calendar menu streak in mo-dragons-brew-menu.js.
 */
(function () {
  "use strict";

  var DAY_INDEX_KEY = "mo_cafe_day_index";
  var SESSION_VISIT_DONE = "mo_cafe_session_visit_done";
  var WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  function sessionOn(key) {
    try { return sessionStorage.getItem(key) === "1"; } catch (e) { return false; }
  }

  function setSessionOn(key, on) {
    try {
      if (on) sessionStorage.setItem(key, "1");
      else sessionStorage.removeItem(key);
    } catch (e) { /* private mode */ }
  }

  function parseIndex(raw) {
    var n = parseInt(raw, 10);
    if (!isFinite(n) || n < 1) return 1;
    return n;
  }

  function getDayIndex() {
    try {
      var raw = localStorage.getItem(DAY_INDEX_KEY);
      if (raw === null || raw === "") return 1;
      return parseIndex(raw);
    } catch (e) {
      return 1;
    }
  }

  function getWeekdayName(dayIndex) {
    dayIndex = dayIndex != null ? dayIndex : getDayIndex();
    return WEEKDAYS[(dayIndex - 1) % 7];
  }

  function getWeekNumber(dayIndex) {
    dayIndex = dayIndex != null ? dayIndex : getDayIndex();
    return Math.floor((dayIndex - 1) / 7) + 1;
  }

  function formatHudLabel(dayIndex) {
    dayIndex = dayIndex != null ? dayIndex : getDayIndex();
    var wd = getWeekdayName(dayIndex);
    var wk = getWeekNumber(dayIndex);
    if (dayIndex >= 8) {
      return wd + " · week " + wk;
    }
    return wd + " · café day " + dayIndex;
  }

  function hasCompletedVisitToday() {
    return sessionOn(SESSION_VISIT_DONE);
  }

  function onVisitCompleted() {
    setSessionOn(SESSION_VISIT_DONE, true);
    try {
      localStorage.setItem(DAY_INDEX_KEY, String(getDayIndex() + 1));
    } catch (e) { /* private mode */ }
    refreshHud();
  }

  function isDay8OrLater() {
    return getDayIndex() >= 8;
  }

  function reset() {
    setSessionOn(SESSION_VISIT_DONE, false);
    try {
      localStorage.removeItem(DAY_INDEX_KEY);
    } catch (e) { /* private mode */ }
    refreshHud();
  }

  function refreshHud() {
    var el = document.getElementById("mo-day-hud");
    if (el) el.textContent = formatHudLabel();
  }

  function initHud() {
    refreshHud();
  }

  window.MoGameDays = {
    getDayIndex: getDayIndex,
    getWeekdayName: getWeekdayName,
    getWeekNumber: getWeekNumber,
    formatHudLabel: formatHudLabel,
    hasCompletedVisitToday: hasCompletedVisitToday,
    onVisitCompleted: onVisitCompleted,
    isDay8OrLater: isDay8OrLater,
    reset: reset,
    refreshHud: refreshHud,
    initHud: initHud
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHud);
  } else {
    initHud();
  }
})();
