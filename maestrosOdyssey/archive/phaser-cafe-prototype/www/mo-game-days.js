/**
 * Fiction café week — Mon→Sun, advances after completed visit (#12).
 * Separate from real-calendar menu streak in mo-dragons-brew-menu.js.
 */
(function () {
  "use strict";

  var DAY_INDEX_KEY = "mo_cafe_day_index";
  var VISIT_DONE_PREFIX = "mo_cafe_visit_done_day_";
  var SESSION_AWAITING_EXIT = "mo_cafe_visit_finished_awaiting";
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

  function hasCompletedVisitForDay(dayIndex) {
    return sessionOn(VISIT_DONE_PREFIX + (dayIndex != null ? dayIndex : getDayIndex()));
  }

  function hasAwaitingDayAdvance() {
    return sessionOn(SESSION_AWAITING_EXIT);
  }

  function setVisitFinishedAwaitingExit() {
    setSessionOn(SESSION_AWAITING_EXIT, true);
  }

  function clearAwaitingDayAdvance() {
    setSessionOn(SESSION_AWAITING_EXIT, false);
  }

  function hasCompletedVisitToday() {
    return hasCompletedVisitForDay(getDayIndex()) || hasAwaitingDayAdvance();
  }

  function migrateLegacyVisitFlag() {
    try {
      if (sessionStorage.getItem("mo_cafe_session_visit_done") === "1") {
        sessionStorage.removeItem("mo_cafe_session_visit_done");
      }
    } catch (e) { /* private mode */ }
  }

  function clearCompletedVisitFlags() {
    try {
      var toRemove = [];
      for (var i = 0; i < sessionStorage.length; i++) {
        var k = sessionStorage.key(i);
        if (k && k.indexOf(VISIT_DONE_PREFIX) === 0) toRemove.push(k);
      }
      toRemove.forEach(function (key) { sessionStorage.removeItem(key); });
      sessionStorage.removeItem("mo_cafe_session_visit_done");
      sessionStorage.removeItem(SESSION_AWAITING_EXIT);
    } catch (e) { /* private mode */ }
  }

  function advanceDayOnExit() {
    if (!hasAwaitingDayAdvance()) return false;
    clearAwaitingDayAdvance();
    onVisitCompleted();
    return true;
  }

  function onVisitCompleted() {
    var day = getDayIndex();
    var flagKey = VISIT_DONE_PREFIX + day;
    if (sessionOn(flagKey)) return;
    setSessionOn(flagKey, true);
    try {
      localStorage.setItem(DAY_INDEX_KEY, String(day + 1));
    } catch (e) { /* private mode */ }
    refreshHud();
    if (window.MoElderReport && typeof window.MoElderReport.tryOfferReport === "function") {
      window.setTimeout(function () { window.MoElderReport.tryOfferReport(); }, 900);
    }
  }

  function isDay8OrLater() {
    return getDayIndex() >= 8;
  }

  function reset() {
    clearCompletedVisitFlags();
    clearAwaitingDayAdvance();
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
    migrateLegacyVisitFlag();
    refreshHud();
  }

  window.MoGameDays = {
    getDayIndex: getDayIndex,
    getWeekdayName: getWeekdayName,
    getWeekNumber: getWeekNumber,
    formatHudLabel: formatHudLabel,
    hasCompletedVisitToday: hasCompletedVisitToday,
    hasCompletedVisitForDay: hasCompletedVisitForDay,
    hasAwaitingDayAdvance: hasAwaitingDayAdvance,
    setVisitFinishedAwaitingExit: setVisitFinishedAwaitingExit,
    advanceDayOnExit: advanceDayOnExit,
    onVisitCompleted: onVisitCompleted,
    isDay8OrLater: isDay8OrLater,
    clearCompletedVisitFlags: clearCompletedVisitFlags,
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
