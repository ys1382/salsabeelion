/**
 * Halalit — earned reading milestone badges (private).
 * Counts distinct finished titles on Personal Library; unlocks soft landmarks.
 * Not a spend shop; not one prize per book.
 */
(function (global) {
  var STORAGE_KEY = "halalitReadingMilestonesEarned";
  var ROOT_ID = "halalitReadingMilestones";
  var TOAST_ID = "halalitMilestoneToast";

  var THRESHOLDS = [
    { id: "m10", count: 10, title: "Ten stories remembered", line: "Your shelf is starting to feel lived-in." },
    { id: "m25", count: 25, title: "A growing shelf", line: "Twenty-five books remembered — quietly yours." },
    { id: "m50", count: 50, title: "Fifty stories remembered", line: "A solid stretch of reading on this shelf." },
    { id: "m100", count: 100, title: "A hundred on the shelf", line: "One hundred distinct titles remembered here." },
    { id: "m250", count: 250, title: "A well-traveled shelf", line: "Two hundred fifty stories — a long road of reading." },
    { id: "m500", count: 500, title: "Five hundred remembered", line: "Five hundred books on your private shelf." },
  ];

  function store() {
    return global.HalalitAccountStorage || null;
  }

  function loadEarnedIds() {
    try {
      var raw = store() ? store().getItem(STORAGE_KEY) : null;
      if (!raw && global.localStorage) raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.earned)) return [];
      return parsed.earned.map(String);
    } catch (e) {
      return [];
    }
  }

  function saveEarnedIds(ids) {
    var payload = JSON.stringify({ earned: ids, updatedAt: new Date().toISOString() });
    try {
      if (store()) store().setItem(STORAGE_KEY, payload);
      else if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, payload);
    } catch (e) {}
  }

  function bookKey(book) {
    var Lib = global.HalalitPersonalLibrary;
    if (Lib && typeof Lib.normalizeKey === "function") {
      return Lib.normalizeKey(book && book.title, book && book.author);
    }
    return (
      String((book && book.title) || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim() +
      "|" +
      String((book && book.author) || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  function countDistinctFinished() {
    var Lib = global.HalalitPersonalLibrary;
    if (!Lib || typeof Lib.load !== "function") return 0;
    var list = Lib.load() || [];
    var seen = {};
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (!b) continue;
      var title = String(b.title || b.titlePlain || "").trim();
      if (!title) continue;
      var k = bookKey(b);
      if (!k || k === "|") continue;
      if (seen[k]) continue;
      seen[k] = true;
      n++;
    }
    return n;
  }

  function syncEarnedFromCount(count) {
    var earned = loadEarnedIds();
    var newly = [];
    var set = {};
    for (var i = 0; i < earned.length; i++) set[earned[i]] = true;
    for (var t = 0; t < THRESHOLDS.length; t++) {
      var th = THRESHOLDS[t];
      if (count >= th.count && !set[th.id]) {
        set[th.id] = true;
        newly.push(th);
      }
    }
    if (!newly.length) return { earned: earned, newly: [] };
    var next = [];
    for (var u = 0; u < THRESHOLDS.length; u++) {
      if (set[THRESHOLDS[u].id]) next.push(THRESHOLDS[u].id);
    }
    saveEarnedIds(next);
    return { earned: next, newly: newly };
  }

  function thresholdById(id) {
    for (var i = 0; i < THRESHOLDS.length; i++) {
      if (THRESHOLDS[i].id === id) return THRESHOLDS[i];
    }
    return null;
  }

  function nextThreshold(count) {
    for (var i = 0; i < THRESHOLDS.length; i++) {
      if (count < THRESHOLDS[i].count) return THRESHOLDS[i];
    }
    return null;
  }

  function showToast(th) {
    if (!th || !global.document) return;
    var doc = global.document;
    var el = doc.getElementById(TOAST_ID);
    if (!el) {
      el = doc.createElement("div");
      el.id = TOAST_ID;
      el.className = "halalit-milestone-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      doc.body.appendChild(el);
    }
    el.innerHTML =
      '<p class="halalit-milestone-toast__eyebrow">Shelf milestone</p>' +
      "<p class=\"halalit-milestone-toast__title\">" +
      escapeHtml(th.title) +
      "</p>" +
      '<p class="halalit-milestone-toast__line">' +
      escapeHtml(th.line) +
      "</p>";
    el.hidden = false;
    el.classList.add("halalit-milestone-toast--show");
    if (el._hideTimer) clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(function () {
      el.classList.remove("halalit-milestone-toast--show");
      el.hidden = true;
    }, 5200);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderPanel(root, count, earnedIds) {
    var earnedSet = {};
    for (var i = 0; i < earnedIds.length; i++) earnedSet[earnedIds[i]] = true;
    var next = nextThreshold(count);

    var progressHtml = "";
    if (next) {
      var left = next.count - count;
      var pct = Math.max(0, Math.min(100, Math.round((count / next.count) * 100)));
      progressHtml =
        '<p class="halalit-milestones__progress">' +
        escapeHtml(String(count)) +
        " books remembered · next: <strong>" +
        escapeHtml(String(next.count)) +
        "</strong> (" +
        escapeHtml(String(left)) +
        " more)</p>" +
        '<div class="halalit-milestones__bar" role="progressbar" aria-valuemin="0" aria-valuemax="' +
        next.count +
        '" aria-valuenow="' +
        count +
        '" aria-label="Progress toward next milestone">' +
        '<span class="halalit-milestones__bar-fill" style="width:' +
        pct +
        '%"></span></div>';
    } else if (count > 0) {
      progressHtml =
        '<p class="halalit-milestones__progress">' +
        escapeHtml(String(count)) +
        " books remembered · you’ve reached every milestone on this shelf for now.</p>";
    } else {
      progressHtml =
        '<p class="halalit-milestones__progress muted">Finish books on your Personal Library shelf — milestones appear here, private to you.</p>';
    }

    var badges = [];
    for (var t = 0; t < THRESHOLDS.length; t++) {
      var th = THRESHOLDS[t];
      var got = !!earnedSet[th.id];
      badges.push(
        '<li class="halalit-milestones__badge' +
          (got ? " is-earned" : " is-locked") +
          '" title="' +
          escapeHtml(th.line) +
          '">' +
          '<span class="halalit-milestones__badge-count">' +
          escapeHtml(String(th.count)) +
          "</span>" +
          '<span class="halalit-milestones__badge-title">' +
          escapeHtml(got ? th.title : th.count + " books") +
          "</span>" +
          (got ? "" : '<span class="halalit-milestones__badge-state">Not yet</span>') +
          "</li>"
      );
    }

    root.innerHTML =
      '<div class="halalit-milestones panel">' +
      "<h3 class=\"halalit-milestones__heading\">Reading milestones</h3>" +
      '<p class="halalit-milestones__lead muted">Landmarks for books you’ve finished — private on this device or your account. Not a shop, not a public board.</p>' +
      progressHtml +
      '<ul class="halalit-milestones__list" aria-label="Milestone badges">' +
      badges.join("") +
      "</ul></div>";
  }

  /**
   * Sync earned badges from shelf count, refresh Personal Library panel, toast new unlocks.
   * @param {{ silent?: boolean }} opts — silent skips toast (e.g. first paint after huge import if preferred)
   */
  function refresh(opts) {
    opts = opts || {};
    var doc = global.document;
    if (!doc) return;
    var root = doc.getElementById(ROOT_ID);
    if (!root) return;

    var count = countDistinctFinished();
    var sync = syncEarnedFromCount(count);
    renderPanel(root, count, sync.earned);

    if (!opts.silent && sync.newly && sync.newly.length) {
      showToast(sync.newly[sync.newly.length - 1]);
    }
  }

  global.HalalitReadingMilestones = {
    STORAGE_KEY: STORAGE_KEY,
    THRESHOLDS: THRESHOLDS,
    countDistinctFinished: countDistinctFinished,
    refresh: refresh,
    loadEarnedIds: loadEarnedIds,
  };
})(typeof window !== "undefined" ? window : this);
