/**
 * Wildlife Walk — timer, notice prompts, buddy feed, learned stills on trail.
 * No camera / getUserMedia. Ever. EcoLens stays on its own page.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "bane_wildlife_walk_v1";
  var NOTICE_MS_CURIOUS = 3 * 60 * 1000;
  var NOTICE_MS_QUIET = 5 * 60 * 1000;

  var BUDDIES = [
    {
      id: "ground-squirrel",
      name: "California ground squirrel",
      latin: "Otospermophilus beecheyi",
      short: "Squirrel",
      foods: [
        { id: "acorn", label: "Acorn" },
        { id: "seeds", label: "Seeds" },
        { id: "apple", label: "Apple bit" },
      ],
    },
    {
      id: "american-crow",
      name: "American crow",
      latin: "Corvus brachyrhynchos",
      short: "Crow",
      foods: [
        { id: "seeds", label: "Seeds" },
        { id: "berry", label: "Berry" },
        { id: "insect", label: "Insect find" },
      ],
    },
    {
      id: "mule-deer",
      name: "Mule deer",
      latin: "Odocoileus hemionus",
      short: "Deer",
      foods: [
        { id: "leaf", label: "Leaf browse" },
        { id: "apple", label: "Apple bit" },
        { id: "acorn", label: "Acorn" },
      ],
    },
    {
      id: "annas-hummingbird",
      name: "Anna’s hummingbird",
      latin: "Calypte anna",
      short: "Hummer",
      foods: [
        { id: "nectar", label: "Nectar" },
        { id: "flower", label: "Flower sip" },
        { id: "tiny-insect", label: "Tiny insect" },
      ],
    },
  ];

  var NOTICES = [
    {
      prompt: "What kind of trees are near you?",
      choices: [
        { id: "street", label: "Street trees" },
        { id: "forest", label: "Forest / grove" },
        { id: "yard", label: "Yard / garden tree" },
        { id: "none", label: "No trees right now" },
      ],
    },
    {
      prompt: "Any water in view?",
      choices: [
        { id: "lake", label: "Lake / pond" },
        { id: "creek", label: "Creek / ditch" },
        { id: "ocean", label: "Ocean / bay" },
        { id: "puddle", label: "Puddle only" },
        { id: "none", label: "No water" },
      ],
    },
    {
      prompt: "What’s the light like overhead?",
      choices: [
        { id: "open", label: "Open sky" },
        { id: "shade", label: "Shade / canopy" },
        { id: "mixed", label: "Mixed light" },
      ],
    },
    {
      prompt: "What edge are you near?",
      choices: [
        { id: "pavement", label: "Pavement / curb" },
        { id: "garden", label: "Garden bed" },
        { id: "trail", label: "Dirt / trail" },
        { id: "lawn", label: "Lawn / grass" },
      ],
    },
    {
      prompt: "Any soft sound worth noticing?",
      choices: [
        { id: "birds", label: "Birdsong" },
        { id: "wind", label: "Wind in leaves" },
        { id: "water", label: "Water sound" },
        { id: "quiet", label: "Mostly quiet" },
      ],
    },
  ];

  var MOTION_KEYS = ["idle", "walk", "run", "eat", "stand", "rest"];

  var state = null;
  var session = {
    active: false,
    startedAt: 0,
    accruedMs: 0,
    tickTimer: null,
    noticeTimer: null,
    motion: "walk",
    eatUntil: 0,
  };

  var els = {};

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function defaultState() {
    return {
      enabled: false,
      buddyId: BUDDIES[0].id,
      totalMinutes: 0,
      sessionMinutesPartial: 0,
      streak: 0,
      lastCareDay: "",
      noticesToday: 0,
      feeds: {},
      unlockedMotions: { idle: true, walk: true },
      quietMode: false,
      learnedBuddyKey: "",
      noticeDay: "",
    };
  }

  function readState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return defaultState();
      var base = defaultState();
      Object.keys(base).forEach(function (k) {
        if (obj[k] !== undefined) base[k] = obj[k];
      });
      if (!base.unlockedMotions || typeof base.unlockedMotions !== "object") {
        base.unlockedMotions = { idle: true, walk: true };
      }
      base.unlockedMotions.idle = true;
      base.unlockedMotions.walk = true;
      if (!base.feeds || typeof base.feeds !== "object") base.feeds = {};
      return base;
    } catch (e) {
      return defaultState();
    }
  }

  function writeState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function buddyById(id) {
    for (var i = 0; i < BUDDIES.length; i++) {
      if (BUDDIES[i].id === id) return BUDDIES[i];
    }
    return BUDDIES[0];
  }

  function learnedEntries() {
    var C = global.BaneCodexCollection;
    if (!C || !C.readAll) return [];
    return C.readAll();
  }

  function stillUrl(entry) {
    var C = global.BaneCodexCollection;
    if (!C || !C.stillDataUrl) return "";
    return C.stillDataUrl(entry) || "";
  }

  function factList() {
    var F = global.BaneCodexFacts;
    if (!F || !F.readAll) return [];
    return F.readAll();
  }

  function factLevel() {
    var F = global.BaneCodexFacts;
    if (!F || !F.factLevelInfo) return { level: 1, total: 0, name: "Curious notice" };
    return F.factLevelInfo();
  }

  function unlockFromFacts() {
    var facts = factList();
    var info = factLevel();
    var u = state.unlockedMotions;
    u.idle = true;
    u.walk = true;
    if (info.level >= 2 || info.total >= 8) u.run = true;
    if (info.level >= 2) u.rest = true;
    facts.forEach(function (f) {
      var blob = String((f && f.fact) || "") + " " + String((f && f.label) || "");
      blob = blob.toLowerCase();
      if (/\b(eat|eats|eating|forag|feed|nectar|browse|diet)\b/.test(blob)) u.eat = true;
      if (/\b(run|runs|running|dash|flee|flight|fly|flies|flying|hop|sprint)\b/.test(blob)) u.run = true;
      if (/\b(stand|stands|standing|still|perch|perched|pause)\b/.test(blob)) u.stand = true;
      if (/\b(rest|rests|resting|sleep|roost|nap)\b/.test(blob)) u.rest = true;
      if (/\b(walk|walks|walking|amble|trot)\b/.test(blob)) u.walk = true;
    });
    state.unlockedMotions = u;
  }

  function markCareToday() {
    var day = todayKey();
    if (state.lastCareDay === day) return;
    var y = new Date();
    y.setDate(y.getDate() - 1);
    var yesterday =
      y.getFullYear() + "-" + (y.getMonth() + 1) + "-" + y.getDate();
    if (state.lastCareDay === yesterday) state.streak += 1;
    else state.streak = 1;
    state.lastCareDay = day;
  }

  function setStatus(msg) {
    if (els.status) els.status.textContent = msg || "";
  }

  function formatMinutes(n) {
    var m = Math.floor(Number(n) || 0);
    if (m < 60) return m + " min";
    var h = Math.floor(m / 60);
    var r = m % 60;
    return h + "h " + r + "m";
  }

  function sessionElapsedMs() {
    if (!session.active) return session.accruedMs;
    return session.accruedMs + (Date.now() - session.startedAt);
  }

  function refreshStats() {
    var liveMin = state.totalMinutes + sessionElapsedMs() / 60000;
    if (els.statTime) els.statTime.textContent = formatMinutes(liveMin);
    if (els.statStreak) els.statStreak.textContent = String(state.streak || 0);
    if (els.statNotices) els.statNotices.textContent = String(state.noticesToday || 0);
    var info = factLevel();
    if (els.statFacts) {
      els.statFacts.textContent = info.total + " · L" + info.level;
    }
  }

  function placeCritters() {
    var root = els.critters;
    if (!root) return;
    root.innerHTML = "";
    var list = learnedEntries().filter(function (e) {
      return stillUrl(e);
    });
    if (els.trailEmpty) {
      els.trailEmpty.hidden = list.length > 0;
    }
    var max = Math.min(list.length, 16);
    for (var i = 0; i < max; i++) {
      var entry = list[i];
      var el = document.createElement("div");
      el.className = "trail-critter";
      el.title = entry.commonName || entry.displayName || "Learned neighbor";
      var left = 8 + ((i * 17) % 78);
      var bottom = 38 + ((i * 11) % 28);
      el.style.left = left + "%";
      el.style.bottom = bottom + "%";
      var src = stillUrl(entry);
      if (src) {
        var img = document.createElement("img");
        img.src = src;
        img.alt = entry.commonName || entry.displayName || "Learned";
        el.appendChild(img);
      } else {
        var fb = document.createElement("div");
        fb.className = "trail-critter__fallback";
        fb.textContent = (entry.commonName || entry.displayName || "?").slice(0, 18);
        el.appendChild(fb);
      }
      root.appendChild(el);
    }
  }

  function learnedBuddyStill() {
    if (!state.learnedBuddyKey) return "";
    var list = learnedEntries();
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === state.learnedBuddyKey) return stillUrl(list[i]);
    }
    return "";
  }

  function applyBuddyFigure() {
    var fig = els.buddyFigure;
    if (!fig) return;
    var b = buddyById(state.buddyId);
    var still = learnedBuddyStill();
    var motion = "idle";
    if (session.active && Date.now() < session.eatUntil && state.unlockedMotions.eat) {
      motion = "eat";
    } else if (session.active) {
      motion = state.unlockedMotions.run ? "run" : "walk";
    } else if (state.unlockedMotions.stand) {
      motion = "stand";
    } else if (state.unlockedMotions.rest) {
      motion = "rest";
    }
    if (!state.unlockedMotions[motion]) motion = "idle";

    fig.className = "buddy-figure is-" + motion;
    if (still) {
      fig.classList.add("has-still");
      fig.style.backgroundImage = "url(" + still + ")";
      fig.textContent = "";
    } else {
      fig.classList.remove("has-still");
      fig.style.backgroundImage = "";
      fig.innerHTML = '<span class="buddy-figure__label"></span>';
      fig.querySelector(".buddy-figure__label").textContent = b.short;
    }
    session.motion = motion;
  }

  function refreshMotions() {
    unlockFromFacts();
    var root = els.motionChips;
    if (!root) return;
    root.innerHTML = "";
    MOTION_KEYS.forEach(function (k) {
      var on = !!state.unlockedMotions[k];
      var chip = document.createElement("span");
      chip.className = "motion-chip" + (on ? " is-on" : "");
      chip.textContent = k + (on ? "" : " · locked");
      root.appendChild(chip);
    });
    applyBuddyFigure();
    writeState();
  }

  function renderBuddyPicks() {
    var root = els.buddyGrid;
    if (!root) return;
    root.innerHTML = "";
    BUDDIES.forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "buddy-pick";
      btn.setAttribute("aria-pressed", state.buddyId === b.id ? "true" : "false");
      btn.innerHTML =
        '<span class="buddy-pick__name"></span><span class="buddy-pick__latin"></span>';
      btn.querySelector(".buddy-pick__name").textContent = b.name;
      btn.querySelector(".buddy-pick__latin").textContent = b.latin;
      btn.addEventListener("click", function () {
        state.buddyId = b.id;
        state.learnedBuddyKey = "";
        writeState();
        renderBuddyPicks();
        renderFeed();
        applyBuddyFigure();
        setStatus("Buddy set to " + b.name + ".");
      });
      root.appendChild(btn);
    });

    var learned = learnedEntries().slice(0, 8);
    learned.forEach(function (entry) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "buddy-pick";
      var pressed = state.learnedBuddyKey === entry.key;
      btn.setAttribute("aria-pressed", pressed ? "true" : "false");
      var name = entry.commonName || entry.displayName || "Learned neighbor";
      btn.innerHTML =
        '<span class="buddy-pick__name"></span><span class="buddy-pick__latin"></span>';
      btn.querySelector(".buddy-pick__name").textContent = "Learned · " + name;
      btn.querySelector(".buddy-pick__latin").textContent =
        entry.latinName || "from your codex";
      btn.addEventListener("click", function () {
        state.learnedBuddyKey = entry.key;
        writeState();
        renderBuddyPicks();
        renderFeed();
        applyBuddyFigure();
        setStatus("Buddy art from your learned " + name + ".");
      });
      root.appendChild(btn);
    });
  }

  function renderFeed() {
    var row = els.feedRow;
    if (!row) return;
    row.innerHTML = "";
    var b = buddyById(state.buddyId);
    b.foods.forEach(function (food) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn secondary";
      var n = (state.feeds[b.id + ":" + food.id] || 0);
      btn.textContent = food.label + (n ? " · " + n : "");
      btn.disabled = !state.enabled;
      btn.addEventListener("click", function () {
        if (!state.enabled) return;
        var key = b.id + ":" + food.id;
        state.feeds[key] = (state.feeds[key] || 0) + 1;
        state.unlockedMotions.eat = true;
        markCareToday();
        session.eatUntil = Date.now() + 4000;
        session.motion = "eat";
        writeState();
        renderFeed();
        refreshStats();
        refreshMotions();
        setStatus("Fed " + b.short + " " + food.label.toLowerCase() + " — a food they eat in real life.");
      });
      row.appendChild(btn);
    });
  }

  function hideNotice() {
    if (els.noticeCard) els.noticeCard.hidden = true;
  }

  function showNotice() {
    if (!state.enabled || !session.active || !els.noticeCard) return;
    var pack = NOTICES[Math.floor(Math.random() * NOTICES.length)];
    els.noticePrompt.textContent = pack.prompt;
    els.noticeChoices.innerHTML = "";
    pack.choices.forEach(function (c) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn secondary";
      btn.textContent = c.label;
      btn.addEventListener("click", function () {
        state.noticesToday += 1;
        markCareToday();
        writeState();
        refreshStats();
        hideNotice();
        setStatus("Noticed: " + c.label + ". Your on-screen walk keeps going.");
        scheduleNotice();
      });
      els.noticeChoices.appendChild(btn);
    });
    var skip = document.createElement("button");
    skip.type = "button";
    skip.className = "btn secondary";
    skip.textContent = "Skip for now";
    skip.addEventListener("click", function () {
      hideNotice();
      scheduleNotice();
      setStatus("Skipped — quiet is fine.");
    });
    els.noticeChoices.appendChild(skip);
    els.noticeCard.hidden = false;
  }

  function clearNoticeTimer() {
    if (session.noticeTimer) {
      clearTimeout(session.noticeTimer);
      session.noticeTimer = null;
    }
  }

  function scheduleNotice() {
    clearNoticeTimer();
    if (!session.active || !state.enabled) return;
    var ms = state.quietMode ? NOTICE_MS_QUIET : NOTICE_MS_CURIOUS;
    session.noticeTimer = setTimeout(showNotice, ms);
  }

  function setWalkingUi(on) {
    if (els.trail) els.trail.classList.toggle("is-walking", !!on);
    if (els.party) els.party.classList.toggle("is-walking", !!on);
  }

  function clearTick() {
    if (session.tickTimer) {
      clearInterval(session.tickTimer);
      session.tickTimer = null;
    }
  }

  function bankSessionMinutes() {
    var ms = sessionElapsedMs();
    var add = Math.floor(ms / 60000);
    var rem = ms % 60000;
    if (add > 0) {
      state.totalMinutes += add;
      markCareToday();
    }
    session.accruedMs = rem;
    session.startedAt = Date.now();
    writeState();
  }

  function stopWalk(reason) {
    if (!session.active) return;
    bankSessionMinutes();
    session.active = false;
    clearTick();
    clearNoticeTimer();
    hideNotice();
    setWalkingUi(false);
    applyBuddyFigure();
    refreshStats();
    if (els.startBtn) els.startBtn.hidden = false;
    if (els.stopBtn) els.stopBtn.hidden = true;
    setStatus(reason || "Walk paused. Camera was never part of this page.");
  }

  function startWalk() {
    if (!state.enabled) {
      setStatus("Turn Wildlife Walk on first — this page never uses the camera.");
      return;
    }
    if (session.active) return;
    session.active = true;
    session.startedAt = Date.now();
    session.motion = state.unlockedMotions.run ? "run" : "walk";
    setWalkingUi(true);
    applyBuddyFigure();
    if (els.startBtn) els.startBtn.hidden = true;
    if (els.stopBtn) els.stopBtn.hidden = false;
    clearTick();
    session.tickTimer = setInterval(function () {
      if (Date.now() >= session.eatUntil && session.motion === "eat") {
        session.motion = state.unlockedMotions.run ? "run" : "walk";
        applyBuddyFigure();
      }
      if (sessionElapsedMs() >= 60000) bankSessionMinutes();
      refreshStats();
    }, 1000);
    scheduleNotice();
    markCareToday();
    writeState();
    refreshStats();
    setStatus("Walk on — notice the world when you’re ready. No camera here.");
  }

  function applyEnabledUi() {
    var on = !!state.enabled;
    if (els.offPanel) els.offPanel.hidden = on;
    if (els.onPanel) els.onPanel.hidden = !on;
    if (els.toggle) els.toggle.checked = on;
    if (!on && session.active) stopWalk("Wildlife Walk turned off.");
    renderFeed();
  }

  function bind() {
    els.toggle = document.getElementById("walkEnabled");
    els.offPanel = document.getElementById("walkOffPanel");
    els.onPanel = document.getElementById("walkOnPanel");
    els.status = document.getElementById("walkStatus");
    els.statTime = document.getElementById("walkStatTime");
    els.statStreak = document.getElementById("walkStatStreak");
    els.statNotices = document.getElementById("walkStatNotices");
    els.statFacts = document.getElementById("walkStatFacts");
    els.trail = document.getElementById("trailStage");
    els.party = document.getElementById("trailParty");
    els.critters = document.getElementById("trailCritters");
    els.trailEmpty = document.getElementById("trailEmpty");
    els.buddyFigure = document.getElementById("buddyFigure");
    els.buddyGrid = document.getElementById("buddyGrid");
    els.feedRow = document.getElementById("feedRow");
    els.motionChips = document.getElementById("motionChips");
    els.noticeCard = document.getElementById("noticeCard");
    els.noticePrompt = document.getElementById("noticePrompt");
    els.noticeChoices = document.getElementById("noticeChoices");
    els.startBtn = document.getElementById("walkStart");
    els.stopBtn = document.getElementById("walkStop");
    els.quietMode = document.getElementById("walkQuiet");
    els.factLine = document.getElementById("walkFactLine");

    if (els.toggle) {
      els.toggle.addEventListener("change", function () {
        state.enabled = !!els.toggle.checked;
        writeState();
        applyEnabledUi();
        setStatus(
          state.enabled
            ? "Wildlife Walk on. Still no camera — EcoLens is a separate tab."
            : "Wildlife Walk off. Nothing is listening or filming."
        );
      });
    }

    if (els.startBtn) els.startBtn.addEventListener("click", startWalk);
    if (els.stopBtn) els.stopBtn.addEventListener("click", function () {
      stopWalk("Walk stopped.");
    });
    if (els.quietMode) {
      els.quietMode.checked = !!state.quietMode;
      els.quietMode.addEventListener("change", function () {
        state.quietMode = !!els.quietMode.checked;
        writeState();
        if (session.active) scheduleNotice();
        setStatus(state.quietMode ? "Quiet cadence — fewer prompts." : "Curious cadence — prompts a bit more often.");
      });
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden && session.active) {
        bankSessionMinutes();
      }
    });
    global.addEventListener("pagehide", function () {
      if (session.active) {
        bankSessionMinutes();
        session.active = false;
        clearTick();
        clearNoticeTimer();
      }
    });
  }

  function refreshFactLine() {
    var info = factLevel();
    if (!els.factLine) return;
    els.factLine.innerHTML =
      "Fact book: <strong>" +
      info.total +
      "</strong> facts · level " +
      info.level +
      " (" +
      info.name +
      "). Behavior facts unlock buddy motions. " +
      '<a href="codex.html">Open wildlife codex</a>';
  }

  function boot() {
    state = readState();
    var day = todayKey();
    if (state.noticeDay !== day) {
      state.noticesToday = 0;
      state.noticeDay = day;
      writeState();
    }
    bind();
    applyEnabledUi();
    placeCritters();
    renderBuddyPicks();
    renderFeed();
    refreshMotions();
    refreshStats();
    refreshFactLine();
    setStatus("This tab never opens the camera. EcoLens is separate.");

    var C = global.BaneCodexCollection;
    if (C && C.syncNow) {
      C.syncNow().then(function () {
        placeCritters();
        renderBuddyPicks();
        refreshMotions();
        refreshStats();
        refreshFactLine();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : this);
