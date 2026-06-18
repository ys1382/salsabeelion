/**
 * Halalit — Pacific Time (America/Los_Angeles) greeting banner for US
 * Mother's Week (2nd Sunday in May + 6 days) and Father's Week (3rd Sunday in June + 6 days).
 * No other calendar occasions are shown.
 */
(function (global) {
  var TZ = "America/Los_Angeles";
  var BANNER_ID = "halalitOccasionBanner";
  var MOTHERS_BODY_CLASS = "halalit-mothers-day";
  var FATHERS_BODY_CLASS = "halalit-fathers-day";
  /** Legacy thin bar id — removed from DOM if present. */
  var MOTHERS_TOPBAR_ID = "halalitMothersTopBar";
  var POPPY_L_ID = "halalitOccasionPoppyLeft";
  var POPPY_R_ID = "halalitOccasionPoppyRight";
  /** Legacy poppy ids — removed if present. */
  var LEGACY_POPPY_L_ID = "halalitMothersPoppyLeft";
  var LEGACY_POPPY_R_ID = "halalitMothersPoppyRight";
  var LEGACY_BOOK_L_ID = "halalitFathersBookLeft";
  var LEGACY_BOOK_R_ID = "halalitFathersBookRight";
  var OCCASION_WEEK_DAYS = 7;

  /** Original simple four-petal shape; gold-orange petals, warm brown center. */
  function simpleGoldPoppySvg() {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 34" width="24" height="26" focusable="false">' +
      '<g class="halalit-poppy__bloom">' +
      '<ellipse cx="16" cy="9.5" rx="6.2" ry="9" fill="#e8c078" transform="rotate(0 16 16.5)" opacity="0.93"/>' +
      '<ellipse cx="16" cy="9.5" rx="6.2" ry="9" fill="#d89e58" transform="rotate(90 16 16.5)" opacity="0.93"/>' +
      '<ellipse cx="16" cy="9.5" rx="6.2" ry="9" fill="#e2b46c" transform="rotate(180 16 16.5)" opacity="0.9"/>' +
      '<ellipse cx="16" cy="9.5" rx="6.2" ry="9" fill="#d09048" transform="rotate(270 16 16.5)" opacity="0.93"/>' +
      '<circle cx="16" cy="16.5" r="4" fill="#7a5c38"/>' +
      '<circle cx="16" cy="16.5" r="2.1" fill="#4a3826"/>' +
      "</g></svg>"
    );
  }

  function removeElById(doc, id) {
    var n = doc.getElementById(id);
    if (n && n.parentNode) n.parentNode.removeChild(n);
  }

  function removeOccasionPoppies(doc) {
    removeElById(doc, POPPY_L_ID);
    removeElById(doc, POPPY_R_ID);
    removeElById(doc, LEGACY_POPPY_L_ID);
    removeElById(doc, LEGACY_POPPY_R_ID);
    removeElById(doc, LEGACY_BOOK_L_ID);
    removeElById(doc, LEGACY_BOOK_R_ID);
  }

  function removeMothersDayDecor(doc) {
    if (!doc || !doc.body) return;
    doc.body.classList.remove(MOTHERS_BODY_CLASS);
    removeElById(doc, MOTHERS_TOPBAR_ID);
    removeOccasionPoppies(doc);
    var b = doc.getElementById(BANNER_ID);
    if (b) b.classList.remove("halalit-occasion-banner--mothers");
  }

  function removeFathersDayDecor(doc) {
    if (!doc || !doc.body) return;
    doc.body.classList.remove(FATHERS_BODY_CLASS);
    removeOccasionPoppies(doc);
    var b = doc.getElementById(BANNER_ID);
    if (b) b.classList.remove("halalit-occasion-banner--fathers");
  }

  function appendPoppy(doc, side) {
    var pl = doc.createElement("div");
    pl.id = side === "left" ? POPPY_L_ID : POPPY_R_ID;
    pl.className = "halalit-mothers-poppy halalit-mothers-poppy--" + side;
    pl.setAttribute("aria-hidden", "true");
    pl.innerHTML = simpleGoldPoppySvg();
    return pl;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function ymdPartsInPacific(now) {
    var fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    var s = fmt.format(now || new Date());
    var p = s.split("-");
    return { y: parseInt(p[0], 10), m: parseInt(p[1], 10), d: parseInt(p[2], 10) };
  }

  /** UTC millis for noon-ish instant that displays as this civil Y-M-D in Pacific. */
  function utcMsForPacificCivilDate(y, month, day) {
    var want = y + "-" + pad2(month) + "-" + pad2(day);
    var fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    var t = Date.UTC(y, month - 1, day, 12, 0, 0);
    var i;
    for (i = 0; i < 48; i++) {
      if (fmt.format(new Date(t)) === want) return t;
      t -= 3600000;
    }
    t = Date.UTC(y, month - 1, day, 12, 0, 0);
    for (i = 0; i < 48; i++) {
      if (fmt.format(new Date(t)) === want) return t;
      t += 3600000;
    }
    return Date.UTC(y, month - 1, day, 15, 0, 0);
  }

  function addDaysPacific(y, month, day, days) {
    return ymdPartsInPacific(new Date(utcMsForPacificCivilDate(y, month, day) + days * 86400000));
  }

  var wdFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });

  function weekdayShortPacific(y, month, day) {
    return wdFmt.format(new Date(utcMsForPacificCivilDate(y, month, day)));
  }

  /** 1-based n: 1st Sunday = 1, 2nd = 2, … Returns calendar day (1–31) or 0. */
  function nthSundayDayOfMonth(y, month, n) {
    var mdays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month === 2 && y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) mdays[1] = 29;
    var dim = mdays[month - 1];
    var count = 0;
    var d;
    for (d = 1; d <= dim; d++) {
      if (weekdayShortPacific(y, month, d) === "Sun") {
        count++;
        if (count === n) return d;
      }
    }
    return 0;
  }

  /** @returns {{ startMs: number, endMs: number } | null} */
  function occasionWeekRangeForYear(y, month, nthSunday) {
    var occasionDay = nthSundayDayOfMonth(y, month, nthSunday);
    if (!occasionDay) return null;
    var startMs = utcMsForPacificCivilDate(y, month, occasionDay);
    var endParts = addDaysPacific(y, month, occasionDay, OCCASION_WEEK_DAYS - 1);
    var endMs = utcMsForPacificCivilDate(endParts.y, endParts.m, endParts.d);
    return { startMs: startMs, endMs: endMs };
  }

  function isWithinOccasionWeek(today, month, nthSunday) {
    var range = occasionWeekRangeForYear(today.y, month, nthSunday);
    if (!range) return false;
    var nowMs = utcMsForPacificCivilDate(today.y, today.m, today.d);
    return nowMs >= range.startMs && nowMs <= range.endMs;
  }

  function isOccasionDay(today, month, nthSunday) {
    var occasionDay = nthSundayDayOfMonth(today.y, month, nthSunday);
    return occasionDay > 0 && today.m === month && today.d === occasionDay;
  }

  function isWithinMothersWeek(today) {
    return isWithinOccasionWeek(today, 5, 2);
  }

  function isWithinFathersWeek(today) {
    return isWithinOccasionWeek(today, 6, 3);
  }

  /** @returns {"mothers"|"fathers"|""} */
  function occasionKeyForNow() {
    var today = ymdPartsInPacific(new Date());
    if (isWithinMothersWeek(today)) return "mothers";
    if (isWithinFathersWeek(today)) return "fathers";
    return "";
  }

  /** @returns {{ title: string, which: string } | null} */
  function linesForKey(key) {
    var today = ymdPartsInPacific(new Date());
    if (key === "mothers") {
      var onMothersDay = isOccasionDay(today, 5, 2);
      return {
        title: onMothersDay ? "Happy Mother's Day" : "Happy Mother's Week",
        which: onMothersDay
          ? "Halalit's date is Pacific Time — welcome to Mother's Week (through the next six days)."
          : "Halalit's date is Pacific Time — US Mother's Week (second Sunday in May and the six days after).",
      };
    }
    if (key === "fathers") {
      var onFathersDay = isOccasionDay(today, 6, 3);
      return {
        title: onFathersDay ? "Happy Father's Day" : "Happy Father's Week",
        which: onFathersDay
          ? "Halalit's date is Pacific Time — welcome to Father's Week (through the next six days)."
          : "Halalit's date is Pacific Time — US Father's Week (third Sunday in June and the six days after).",
      };
    }
    return null;
  }

  /** Human-readable name for the active occasion, or empty string. */
  function occasionNameForNow() {
    var k = occasionKeyForNow();
    if (k === "mothers") return "US Mother's Week";
    if (k === "fathers") return "US Father's Week";
    return "";
  }

  function appendBannerInner(el, doc, title, sub) {
    el.appendChild(appendPoppy(doc, "left"));
    var inner = doc.createElement("div");
    inner.className = "halalit-occasion-banner__inner";
    inner.appendChild(title);
    inner.appendChild(sub);
    el.appendChild(inner);
    el.appendChild(appendPoppy(doc, "right"));
  }

  function apply() {
    var doc = global.document;
    if (!doc || !doc.body) return;
    var key = occasionKeyForNow();
    var existing = doc.getElementById(BANNER_ID);
    if (!key) {
      removeMothersDayDecor(doc);
      removeFathersDayDecor(doc);
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    if (key !== "mothers") removeMothersDayDecor(doc);
    if (key !== "fathers") removeFathersDayDecor(doc);
    var lines = linesForKey(key);
    if (!lines) return;
    var el = existing;
    if (!el) {
      el = doc.createElement("div");
      el.id = BANNER_ID;
      el.className = "halalit-occasion-banner";
      el.setAttribute("role", "status");
      doc.body.insertBefore(el, doc.body.firstChild);
    }
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
    el.className =
      "halalit-occasion-banner" +
      (key === "mothers" ? " halalit-occasion-banner--mothers" : "") +
      (key === "fathers" ? " halalit-occasion-banner--fathers" : "");
    var title = doc.createElement("strong");
    title.className = "halalit-occasion-banner__title";
    title.textContent = lines.title;
    var sub = doc.createElement("span");
    sub.className = "halalit-occasion-banner__which";
    sub.textContent = lines.which;
    if (key === "mothers") {
      doc.body.classList.add(MOTHERS_BODY_CLASS);
      appendBannerInner(el, doc, title, sub);
    } else if (key === "fathers") {
      doc.body.classList.add(FATHERS_BODY_CLASS);
      appendBannerInner(el, doc, title, sub);
    } else {
      el.appendChild(title);
      el.appendChild(sub);
    }
  }

  global.HalalitPacificOccasionBanner = {
    apply: apply,
    occasionKeyForNow: occasionKeyForNow,
    occasionNameForNow: occasionNameForNow,
    isWithinMothersWeek: function () {
      return isWithinMothersWeek(ymdPartsInPacific(new Date()));
    },
    isWithinFathersWeek: function () {
      return isWithinFathersWeek(ymdPartsInPacific(new Date()));
    },
    _tz: TZ,
    _occasionWeekDays: OCCASION_WEEK_DAYS,
  };

  function docReady() {
    return global.document && global.document.readyState !== "loading";
  }
  if (docReady()) apply();
  else global.document.addEventListener("DOMContentLoaded", apply);
})(typeof window !== "undefined" ? window : this);
