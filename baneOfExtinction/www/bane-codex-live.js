(function () {
  "use strict";

  var API_CALLOUTS = "/bane-of-extinction/api/callouts";
  var STORAGE_KEY = "bane_last_id";
  var STILL_KEY = "bane_last_still";
  var RECENT_FACTS_KEY = "bane_callout_recent_v1";
  var FACT_SETS_KEY = "bane_callout_sets_v1";
  var FACT_POOL_KEY = "bane_fact_pool_v1";
  var FOCUS_MODE_KEY = "bane_focus_mode_v1";
  var GARDEN_FOCUS_KEY = "bane_garden_focus_v1"; // legacy migrate only
  var MAX_RECENT_FACTS = 24;
  var MAX_PRIOR_SETS = 12;
  var FACTS_PER_SERVE = 3;
  var POOL_MIN_BEFORE_REFILL = 3;
  var MAX_AGE_MS = 15 * 60 * 1000;
  var FOCUS_MODES = {
    walk: "Walk / wild",
    garden: "Garden",
    hiking: "Hiking",
    seashore: "Seashore",
    food: "Crops & Domestic Animals",
  };
  var statusEl = document.getElementById("status");
  var listEl = document.getElementById("calloutList");
  var disclaimerEl = document.getElementById("disclaimer");
  var commonOut = document.getElementById("commonOut");
  var latinOut = document.getElementById("latinOut");
  var loadBtn = document.getElementById("loadFacts");
  var cultivarOn = document.getElementById("cultivarOn");
  var cultivarRow = document.getElementById("cultivarRow");
  var evidenceOn = document.getElementById("evidenceOn");
  var focusModeEl = document.getElementById("focusMode");
  var stillEl = document.getElementById("organismStill");
  var creditEl = document.getElementById("artCredit");
  var metaEl = document.getElementById("organismMeta");
  var stillWrap = document.querySelector(".organism-still-wrap");
  var shelfEl = document.getElementById("codexShelf");
  var shelfGrid = document.getElementById("codexShelfGrid");
  var syncEl = document.getElementById("codexSync");
  var factBookProgress = document.getElementById("factBookProgress");
  var factBookLevel = document.getElementById("factBookLevel");
  var factBookNext = document.getElementById("factBookNext");
  var factBookKinds = document.getElementById("factBookKinds");
  var pageFactProgress = document.getElementById("pageFactProgress");
  var collectedFactsEl = document.getElementById("collectedFacts");
  var collectedFactsList = document.getElementById("collectedFactsList");

  var state = {
    commonName: "",
    latinName: "",
    cultivar: "",
    bloomColor: "",
    shortNote: "",
    evidence: false,
    organismType: "flower",
    lifeStage: "",
    fromScan: false,
    stillToken: "",
    generatedStill: null,
    collectionKey: "",
  };

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function isPoppy(commonName, latinName) {
    return /poppy|eschscholzia/i.test(
      (commonName || "") + " " + (latinName || "")
    );
  }

  function syncCultivarToggle() {
    var poppy = isPoppy(state.commonName, state.latinName);
    if (cultivarRow) cultivarRow.hidden = !poppy;
    if (cultivarOn) {
      if (!poppy) cultivarOn.checked = false;
      else if (state.cultivar && /watermelon/i.test(state.cultivar)) {
        cultivarOn.checked = true;
      }
    }
  }

  function setStillAlive(on) {
    if (!stillEl) return;
    if (on) stillEl.classList.add("organism-still--alive");
    else stillEl.classList.remove("organism-still--alive");
  }

  function showStill(src, alt, credit, alive) {
    if (!stillEl) return;
    stillEl.hidden = false;
    if (stillWrap) stillWrap.hidden = false;
    stillEl.src = src;
    stillEl.alt = alt || "Organism";
    setStillAlive(!!alive);
    if (creditEl) creditEl.textContent = credit || "";
  }

  function hideStill(credit) {
    if (stillEl) {
      stillEl.hidden = true;
      stillEl.removeAttribute("src");
      setStillAlive(false);
    }
    if (stillWrap) stillWrap.hidden = true;
    if (creditEl) creditEl.textContent = credit || "";
  }

  function applyStill() {
    if (state.stillToken) {
      var url = "/bane-of-extinction/api/still/" + encodeURIComponent(state.stillToken);
      var label = state.commonName || "Scanned organism";
      if (state.cultivar) label += " (" + state.cultivar + ")";
      showStill(
        url,
        label,
        "Semi-realistic field-guide art for this scan" +
          (state.lifeStage ? " (" + state.lifeStage + ")" : "") +
          (state.bloomColor ? " · " + state.bloomColor : "") +
          " — not your raw photo.",
        true
      );
      return;
    }
    if (state.generatedStill && state.generatedStill.dataUrl) {
      var g = state.generatedStill;
      var label2 = state.commonName || "Scanned organism";
      showStill(
        g.dataUrl,
        label2,
        "Semi-realistic codex art — same species" +
          (state.lifeStage ? " at " + state.lifeStage : "") +
          " — not your raw photo.",
        true
      );
      return;
    }
    hideStill(
      state.fromScan
        ? "No matching codex art for this scan yet — facts still follow the ID."
        : state.commonName
          ? "No codex art for this entry yet — facts still follow the ID."
          : "Scan on a phone to add an organism, or open one from your learned shelf."
    );
  }

  function applyIdentity(id, opts) {
    if (!id) return;
    opts = opts || {};
    var common =
      (id.commonName && String(id.commonName).trim()) ||
      (id.displayName &&
        String(id.displayName).replace(/\s*\(.*\)\s*$/, "").trim()) ||
      "";
    state.commonName = common;
    state.latinName = (id.latinName && String(id.latinName).trim()) || "";
    state.cultivar = (id.cultivar && String(id.cultivar).trim()) || "";
    state.bloomColor = (id.bloomColor && String(id.bloomColor).trim()) || "";
    state.shortNote = (id.shortNote && String(id.shortNote).trim()) || "";
    state.evidence = !!id.evidence;
    state.organismType = id.organismType || "flower";
    state.lifeStage = (id.lifeStage && String(id.lifeStage).trim()) || "";
    state.fromScan = !!opts.fromScan;
    state.stillToken =
      (opts.stillToken && String(opts.stillToken).trim()) ||
      (id.stillToken && String(id.stillToken).trim()) ||
      "";
    state.collectionKey =
      (opts.collectionKey && String(opts.collectionKey).trim()) ||
      (id.key && String(id.key).trim()) ||
      "";
    if (opts.generatedStill) state.generatedStill = opts.generatedStill;
    else if (!opts.keepStill) state.generatedStill = null;
    if (commonOut) {
      commonOut.textContent = id.displayName || state.commonName || "Unknown";
    }
    if (latinOut) {
      var latinLine = state.latinName || "—";
      if (state.lifeStage) latinLine += " · " + state.lifeStage;
      latinOut.textContent = latinLine;
    }
    if (metaEl && !opts.keepMeta) {
      metaEl.hidden = true;
      metaEl.textContent = "";
    }
    if (evidenceOn) evidenceOn.checked = state.evidence;
    syncCultivarToggle();
    applyStill();
    markShelfActive();
    renderPageFactProgress();
    renderCollectedFacts();
  }

  function renderCallouts(callouts) {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!callouts || !callouts.length) {
      listEl.innerHTML =
        '<p class="callout-empty">No callouts returned. Try Load again.</p>';
      return;
    }
    var Labels =
      (window.BaneCodexFacts && window.BaneCodexFacts.KIND_LABELS) || {};
    callouts.forEach(function (c, index) {
      var kind =
        (c && c.kind) ||
        (window.BaneCodexFacts && window.BaneCodexFacts.guessKind
          ? window.BaneCodexFacts.guessKind(c, index, callouts.length)
          : "notice");
      var article = document.createElement("article");
      article.className =
        "callout callout--" + kind + (c && c.buildsOn ? " callout--builds-on" : "");
      article.dataset.anchor = c.anchor || "";
      article.dataset.kind = kind;
      if (c && c.buildsOn) article.dataset.buildsOn = "1";
      article.innerHTML =
        '<div class="callout__tick" aria-hidden="true"></div>' +
        '<div class="callout__body">' +
        '<p class="callout__kind"></p>' +
        '<p class="callout__label"></p>' +
        '<p class="callout__fact"></p>' +
        "</div>";
      article.querySelector(".callout__kind").textContent = c && c.buildsOn
        ? (Labels[kind] || kind) + " · builds on what you learned"
        : Labels[kind] || kind;
      article.querySelector(".callout__label").textContent =
        c.label || c.anchor || "Note";
      article.querySelector(".callout__fact").textContent = c.fact || "";
      listEl.appendChild(article);
    });
  }

  function renderFactBookProgress() {
    if (!window.BaneCodexFacts) return;
    var info = window.BaneCodexFacts.factLevelInfo();
    if (factBookProgress) {
      factBookProgress.textContent = window.BaneCodexFacts.progressLabel(info);
    }
    if (factBookLevel) {
      factBookLevel.textContent =
        "Fact level " + info.level + " · " + info.name;
    }
    if (factBookNext) {
      factBookNext.textContent = window.BaneCodexFacts.nextLevelLabel(info);
    }
    if (factBookKinds) {
      var kc = info.kindCounts || {};
      var unlocked = (info.kinds || [])
        .map(function (k) {
          return (
            (window.BaneCodexFacts.KIND_LABELS[k] || k) +
            " " +
            (kc[k] || 0)
          );
        })
        .join(" · ");
      factBookKinds.textContent =
        "Collected by kind: " +
        (unlocked || "Noticing 0") +
        (info.blurb ? " — " + info.blurb : "");
    }
    renderPageFactProgress();
    renderCollectedFacts();
  }

  function renderPageFactProgress() {
    if (!pageFactProgress || !window.BaneCodexFacts) return;
    var key =
      state.collectionKey ||
      window.BaneCodexFacts.speciesKey({
        commonName: state.commonName,
        latinName: state.latinName,
      });
    if (!key || !state.commonName) {
      pageFactProgress.hidden = true;
      pageFactProgress.textContent = "";
      return;
    }
    pageFactProgress.hidden = false;
    pageFactProgress.textContent =
      "This page: " +
      window.BaneCodexFacts.speciesProgressLabel(key) +
      " facts learned (soft goal while packs grow).";
  }

  function renderCollectedFacts() {
    if (!collectedFactsEl || !collectedFactsList || !window.BaneCodexFacts) {
      return;
    }
    var key =
      state.collectionKey ||
      window.BaneCodexFacts.speciesKey({
        commonName: state.commonName,
        latinName: state.latinName,
      });
    var list = key ? window.BaneCodexFacts.factsForSpecies(key) : [];
    collectedFactsList.innerHTML = "";
    if (!list.length) {
      collectedFactsEl.hidden = true;
      return;
    }
    collectedFactsEl.hidden = false;
    var Labels = window.BaneCodexFacts.KIND_LABELS || {};
    list.slice(0, 24).forEach(function (f) {
      var li = document.createElement("li");
      li.className = "fact-book__item";
      li.innerHTML =
        '<p class="fact-book__item-meta"></p>' +
        '<p class="fact-book__item-fact"></p>';
      li.querySelector(".fact-book__item-meta").textContent =
        (Labels[f.kind] || f.kind || "Noticing") +
        (f.label ? " · " + f.label : "");
      li.querySelector(".fact-book__item-fact").textContent = f.fact || "";
      collectedFactsList.appendChild(li);
    });
  }

  function renderSpeciesMeta(data) {
    if (!metaEl) return;
    var range = String((data && data.nativeRange) || "").trim();
    var elsewhere = String((data && data.rangeElsewhere) || "").trim();
    var status = String((data && data.conservationStatus) || "").trim();
    var local = String((data && data.localStatus) || "").trim();
    var lens = String((data && data.placeLabel) || "").trim();
    var compare = String((data && data.compareNote) || "").trim();
    var credits = Array.isArray(data && data.openCredits)
      ? data.openCredits.filter(Boolean)
      : [];
    if (!credits.length && data && data.attribution) {
      credits = [String(data.attribution)];
    }
    var bits = [];
    if (status) bits.push("Status: " + status);
    if (range) bits.push(range);
    if (elsewhere) {
      bits.push(
        /^caution:/i.test(elsewhere) ? elsewhere : "Caution: " + elsewhere
      );
    }
    if (lens && local) bits.push("Looking at " + lens + ": " + local);
    else if (local) bits.push(local);
    else if (lens) bits.push("Looking at " + lens);
    if (compare) bits.push(compare);
    if (credits.length) bits.push("Credit: " + credits.join(" · "));
    if (!bits.length) {
      metaEl.hidden = true;
      metaEl.textContent = "";
      return;
    }
    metaEl.hidden = false;
    metaEl.textContent = bits.join(" · ");
  }

  function factPoolKey(common, latin, place, focusMode, factLevel) {
    var sk =
      (window.BaneCodexFacts &&
        window.BaneCodexFacts.speciesKey({
          commonName: common,
          latinName: latin,
        })) ||
      String(common || "").toLowerCase();
    var placeId = (place && (place.placeId || place.placeLabel)) || "none";
    return (
      sk +
      "|" +
      placeId +
      "|fm:" +
      (focusMode || "walk") +
      "|fl" +
      (factLevel || 1)
    );
  }

  function readFactPools() {
    try {
      var raw = localStorage.getItem(FACT_POOL_KEY);
      if (!raw) return {};
      var map = JSON.parse(raw);
      return map && typeof map === "object" ? map : {};
    } catch (e) {
      return {};
    }
  }

  function writeFactPools(map) {
    try {
      localStorage.setItem(FACT_POOL_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  function getFactPool(key) {
    var map = readFactPools();
    var pool = map[key];
    if (!pool || typeof pool !== "object") {
      return { unused: [], used: [], meta: null };
    }
    return {
      unused: Array.isArray(pool.unused) ? pool.unused.slice() : [],
      used: Array.isArray(pool.used) ? pool.used.slice() : [],
      meta: pool.meta || null,
    };
  }

  function saveFactPool(key, pool) {
    var map = readFactPools();
    map[key] = {
      unused: (pool.unused || []).slice(0, 40),
      used: (pool.used || []).slice(-80),
      meta: pool.meta || null,
    };
    writeFactPools(map);
  }

  function calloutFactText(c) {
    return String((c && c.fact) || "").trim();
  }

  function mergeCalloutsIntoPool(pool, callouts) {
    var seen = {};
    (pool.unused || [])
      .concat(pool.used || [])
      .forEach(function (c) {
        var t = calloutFactText(c).toLowerCase();
        if (t) seen[t] = true;
      });
    (callouts || []).forEach(function (c) {
      var t = calloutFactText(c).toLowerCase();
      if (!t || seen[t]) return;
      seen[t] = true;
      pool.unused.push(c);
    });
    return pool;
  }

  function takeFromPool(pool, n) {
    var taken = [];
    var buildIdx = -1;
    for (var i = 0; i < pool.unused.length; i++) {
      if (pool.unused[i] && pool.unused[i].buildsOn) {
        buildIdx = i;
        break;
      }
    }
    if (buildIdx >= 0) {
      var buildOne = pool.unused.splice(buildIdx, 1)[0];
      if (calloutFactText(buildOne)) {
        taken.push(buildOne);
        pool.used.push(buildOne);
      }
    }
    while (taken.length < n && pool.unused.length) {
      var next = pool.unused.shift();
      if (!calloutFactText(next)) continue;
      taken.push(next);
      pool.used.push(next);
    }
    return taken;
  }

  function allPoolFactTexts(pool) {
    return (pool.unused || [])
      .concat(pool.used || [])
      .map(calloutFactText)
      .filter(Boolean);
  }

  function applyCalloutPayload(data, opts) {
    opts = opts || {};
    var focusMode = getFocusMode();
    var place = placePayload();
    var callouts = data.callouts || [];
    if (commonOut) {
      commonOut.textContent =
        state.commonName +
        (state.cultivar && isPoppy(state.commonName, state.latinName)
          ? " (" + state.cultivar + ")"
          : "");
    }
    if (latinOut) latinOut.textContent = state.latinName || "—";
    applyStill();
    renderCallouts(callouts);
    renderSpeciesMeta(data);
    rememberCalloutFacts(state.commonName, state.latinName, callouts);
    rememberFactSetAndBuildOn(
      state.commonName,
      state.latinName,
      callouts,
      opts.buildOnPick || null
    );
    var collected = null;
    if (window.BaneCodexFacts && window.BaneCodexFacts.collectCallouts) {
      collected = window.BaneCodexFacts.collectCallouts(
        {
          key: state.collectionKey,
          commonName: state.commonName,
          latinName: state.latinName,
          displayName: state.commonName,
        },
        callouts,
        { gardenFocus: focusMode === "garden", focusMode: focusMode }
      );
    }
    renderFactBookProgress();
    renderShelf();
    if (disclaimerEl) {
      disclaimerEl.hidden = false;
      var creditBit =
        Array.isArray(data.openCredits) && data.openCredits.length
          ? " · " + data.openCredits.join(" · ")
          : data.attribution
            ? " · " + data.attribution
            : "";
      disclaimerEl.textContent =
        (data.disclaimer || "") +
        (data.source ? " · source: " + data.source : "") +
        creditBit;
    }
    var addedBit =
      collected && collected.added
        ? " · +" + collected.added + " new in your fact book"
        : " · fact book updated";
    var fromPool = opts.fromPool
      ? " · from your fact pool (" + (opts.poolLeft || 0) + " left)"
      : "";
    var focusLabel = FOCUS_MODES[focusMode] || focusMode;
    setStatus(
      data.source && String(data.source).indexOf("fallback") === 0
        ? "Showing fallback facts (Claude unavailable)." + addedBit
        : (opts.fromPool
            ? "Different facts from your pool for: "
            : "Callouts loaded for: ") +
            state.commonName +
            " · " +
            focusLabel +
            (place.placeLabel ? " · looking at " + place.placeLabel : "") +
            fromPool +
            addedBit +
            "."
    );
  }

  function fetchCalloutsFromServer(body) {
    return fetch(API_CALLOUTS, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().then(function (data) {
        return { res: res, data: data || {} };
      });
    });
  }

  function loadFacts() {
    if (!state.commonName) {
      setStatus("Scan a plant first (or open a learned entry). Nothing is selected yet.");
      return;
    }
    if (loadBtn) loadBtn.disabled = true;
    var cultivar = "";
    if (
      isPoppy(state.commonName, state.latinName) &&
      cultivarOn &&
      cultivarOn.checked
    ) {
      cultivar = state.cultivar || "Watermelon Heaven";
    }
    var place = placePayload();
    var focusMode = getFocusMode();
    var factInfo =
      window.BaneCodexFacts && window.BaneCodexFacts.factLevelInfo
        ? window.BaneCodexFacts.factLevelInfo()
        : null;
    var factLevel = factInfo ? factInfo.level : 1;
    var poolKey = factPoolKey(
      state.commonName,
      state.latinName,
      place,
      focusMode,
      factLevel
    );
    var pool = getFactPool(poolKey);

    function finishWithPoolServe(metaSource, buildOnPick) {
      var served = takeFromPool(pool, FACTS_PER_SERVE);
      saveFactPool(poolKey, pool);
      if (!served.length) {
        setStatus("No facts ready yet — try Load again.");
        return;
      }
      var payload = Object.assign({}, metaSource || pool.meta || {}, {
        ok: true,
        callouts: served,
        source: (metaSource && metaSource.source) || "fact-pool",
      });
      applyCalloutPayload(payload, {
        fromPool: true,
        poolLeft: pool.unused.length,
        buildOnPick: buildOnPick || null,
      });
    }

    function refillThenServe(buildOnPick) {
      setStatus(
        buildOnPick
          ? "Refilling your fact pool — one fact will build on what you already learned…"
          : "Refilling your fact pool with fresh callouts…"
      );
      var avoidFacts = allPoolFactTexts(pool).concat(
        getRecentFacts(state.commonName, state.latinName)
      );
      var body = {
        commonName: state.commonName,
        latinName: state.latinName,
        cultivar: cultivar,
        evidence: !!(evidenceOn && evidenceOn.checked),
        organismType: state.organismType,
        shortNote: state.shortNote || "",
        bloomColor: state.bloomColor || "",
        avoidFacts: avoidFacts.slice(0, 40),
        buildOnFact: buildOnPick && buildOnPick.fact ? buildOnPick.fact : "",
        placeId: place.placeId || "",
        placeLabel: place.placeLabel || "",
        region: place.region || "",
        habitat: place.habitat || "",
        habitatOnly: !!place.habitatOnly,
        comparePlaceId: place.comparePlaceId || "",
        comparePlaceLabel: place.comparePlaceLabel || "",
        season: place.season || "",
        focusMode: focusMode,
        gardenFocus: focusMode === "garden",
        factLevel: factLevel,
        factCount: factInfo ? factInfo.total : 0,
        poolRefill: true,
      };
      return fetchCalloutsFromServer(body).then(function (pack) {
        var data = pack.data || {};
        if (!pack.res.ok || !data.ok) {
          throw new Error(
            (data && data.message) || (data && data.error) || "request_failed"
          );
        }
        pool = mergeCalloutsIntoPool(pool, data.callouts || []);
        pool.meta = {
          nativeRange: data.nativeRange || "",
          rangeElsewhere: data.rangeElsewhere || "",
          conservationStatus: data.conservationStatus || "",
          statusSource: data.statusSource || "",
          rangeSource: data.rangeSource || "",
          attribution: data.attribution || "",
          openCredits: data.openCredits || [],
          localStatus: data.localStatus || "",
          placeLabel: data.placeLabel || place.placeLabel || "",
          compareNote: data.compareNote || "",
          disclaimer: data.disclaimer || "",
          source: data.source || "claude",
          focusMode: data.focusMode || focusMode,
          buildOnFact: data.buildOnFact || "",
        };
        saveFactPool(poolKey, pool);
        finishWithPoolServe(pool.meta, buildOnPick || null);
      });
    }

    var buildOnPick = pickNextBuildOnFact(state.commonName, state.latinName);
    var servePromise;
    // Later Loads for the same find: always ask Claude so one fact can deepen a
    // prior set. First encounter (no prior sets) keeps the local pool path.
    if (buildOnPick || pool.unused.length < POOL_MIN_BEFORE_REFILL) {
      servePromise = refillThenServe(buildOnPick);
    } else {
      setStatus("Pulling different facts from your pool…");
      servePromise = Promise.resolve().then(function () {
        finishWithPoolServe(pool.meta, null);
      });
    }

    servePromise
      .catch(function (err) {
        setStatus(
          "Could not load callouts: " +
            (err && err.message ? err.message : "error")
        );
      })
      .then(function () {
        if (loadBtn) loadBtn.disabled = false;
      });
  }

  function placePayload() {
    var Lens = window.BanePlaceLens;
    if (Lens && typeof Lens.apiPlacePayload === "function") {
      return Lens.apiPlacePayload();
    }
    return {};
  }

  function getFocusMode() {
    var raw = focusModeEl && focusModeEl.value ? focusModeEl.value : "walk";
    if (FOCUS_MODES[raw]) return raw;
    return "walk";
  }

  function readFocusModePref() {
    try {
      var saved = localStorage.getItem(FOCUS_MODE_KEY);
      if (saved && FOCUS_MODES[saved]) return saved;
      if (localStorage.getItem(GARDEN_FOCUS_KEY) === "1") return "garden";
    } catch (e) {}
    return "walk";
  }

  function writeFocusModePref(mode) {
    var next = FOCUS_MODES[mode] ? mode : "walk";
    try {
      localStorage.setItem(FOCUS_MODE_KEY, next);
      if (next === "garden") localStorage.setItem(GARDEN_FOCUS_KEY, "1");
      else localStorage.removeItem(GARDEN_FOCUS_KEY);
    } catch (e) {}
  }

  function syncFocusModeUi() {
    if (!focusModeEl) return;
    focusModeEl.value = readFocusModePref();
  }

  function recentFactsSpeciesKey(common, latin) {
    var focus = getFocusMode();
    var lat = String(latin || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    if (lat) return focus + "|lat:" + lat;
    var com = String(common || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    return com ? focus + "|com:" + com : "";
  }

  function readRecentFactsMap() {
    try {
      var raw = localStorage.getItem(RECENT_FACTS_KEY);
      if (!raw) return {};
      var map = JSON.parse(raw);
      return map && typeof map === "object" ? map : {};
    } catch (e) {
      return {};
    }
  }

  function getRecentFacts(common, latin) {
    var key = recentFactsSpeciesKey(common, latin);
    if (!key) return [];
    var map = readRecentFactsMap();
    var list = map[key];
    if (!Array.isArray(list)) return [];
    return list
      .map(function (f) {
        return String(f || "").trim();
      })
      .filter(Boolean)
      .slice(-MAX_RECENT_FACTS);
  }

  function rememberCalloutFacts(common, latin, callouts) {
    var key = recentFactsSpeciesKey(common, latin);
    if (!key || !callouts || !callouts.length) return;
    var map = readRecentFactsMap();
    var prev = Array.isArray(map[key]) ? map[key].slice() : [];
    var seen = {};
    prev.forEach(function (f) {
      var t = String(f || "").trim().toLowerCase();
      if (t) seen[t] = true;
    });
    callouts.forEach(function (c) {
      var fact = String((c && c.fact) || "").trim();
      if (!fact) return;
      var low = fact.toLowerCase();
      if (seen[low]) return;
      seen[low] = true;
      prev.push(fact);
    });
    map[key] = prev.slice(-MAX_RECENT_FACTS);
    try {
      localStorage.setItem(RECENT_FACTS_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  function readFactSetsMap() {
    try {
      var raw = localStorage.getItem(FACT_SETS_KEY);
      if (!raw) return {};
      var map = JSON.parse(raw);
      return map && typeof map === "object" ? map : {};
    } catch (e) {
      return {};
    }
  }

  function writeFactSetsMap(map) {
    try {
      localStorage.setItem(FACT_SETS_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  function getFactSetsState(common, latin) {
    var key = recentFactsSpeciesKey(common, latin);
    if (!key) return null;
    var map = readFactSetsMap();
    var st = map[key];
    if (!st || typeof st !== "object") {
      return { key: key, sets: [], nextSet: 0, hooked: [] };
    }
    return {
      key: key,
      sets: Array.isArray(st.sets) ? st.sets : [],
      nextSet: typeof st.nextSet === "number" ? st.nextSet : 0,
      hooked: Array.isArray(st.hooked) ? st.hooked : [],
    };
  }

  function saveFactSetsState(st) {
    if (!st || !st.key) return;
    var map = readFactSetsMap();
    map[st.key] = {
      sets: (st.sets || []).slice(-MAX_PRIOR_SETS),
      nextSet: st.nextSet || 0,
      hooked: (st.hooked || []).slice(-80),
    };
    writeFactSetsMap(map);
  }

  /** Pick one prior fact from the next unused prior set (rotate sets; wrap facts). */
  function pickNextBuildOnFact(common, latin) {
    var st = getFactSetsState(common, latin);
    if (!st || !st.sets.length) return null;
    var hooked = {};
    (st.hooked || []).forEach(function (f) {
      var t = String(f || "")
        .trim()
        .toLowerCase();
      if (t) hooked[t] = true;
    });
    var start =
      ((st.nextSet % st.sets.length) + st.sets.length) % st.sets.length;
    var step;
    for (step = 0; step < st.sets.length; step++) {
      var si = (start + step) % st.sets.length;
      var set = st.sets[si];
      if (!Array.isArray(set)) continue;
      for (var j = 0; j < set.length; j++) {
        var fact = String(set[j] || "").trim();
        if (!fact) continue;
        if (hooked[fact.toLowerCase()]) continue;
        return {
          key: st.key,
          fact: fact,
          setIndex: si,
          wrap: false,
        };
      }
    }
    // All prior facts already used as hooks — wrap and reuse from the next set.
    var wrapSet = st.sets[start];
    if (!Array.isArray(wrapSet) || !wrapSet.length) return null;
    var wrapFact = "";
    for (var k = 0; k < wrapSet.length; k++) {
      wrapFact = String(wrapSet[k] || "").trim();
      if (wrapFact) break;
    }
    if (!wrapFact) return null;
    return {
      key: st.key,
      fact: wrapFact,
      setIndex: start,
      wrap: true,
    };
  }

  function rememberFactSetAndBuildOn(common, latin, callouts, buildOnPick) {
    var st = getFactSetsState(common, latin);
    if (!st) return;
    var oldLen = st.sets.length;
    if (buildOnPick && buildOnPick.fact) {
      if (buildOnPick.wrap) st.hooked = [];
      var hookLow = String(buildOnPick.fact).trim().toLowerCase();
      var already = false;
      st.hooked.forEach(function (h) {
        if (String(h || "").trim().toLowerCase() === hookLow) already = true;
      });
      if (!already) st.hooked.push(String(buildOnPick.fact).trim());
      if (oldLen > 0) {
        // Next Load should pull from a different prior set when possible.
        st.nextSet = Number(buildOnPick.setIndex) + 1;
      }
    }
    var facts = (callouts || [])
      .map(function (c) {
        return String((c && c.fact) || "").trim();
      })
      .filter(Boolean);
    if (facts.length) {
      st.sets.push(facts);
      if (st.sets.length > MAX_PRIOR_SETS) {
        st.sets = st.sets.slice(-MAX_PRIOR_SETS);
      }
      if (st.nextSet >= st.sets.length) st.nextSet = 0;
    }
    saveFactSetsState(st);
  }

  function clearStored() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e2) {}
  }

  function clearStillStorage() {
    try {
      sessionStorage.removeItem(STILL_KEY);
    } catch (e) {}
    try {
      localStorage.removeItem(STILL_KEY);
    } catch (e2) {}
  }

  function parseStored(raw) {
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || !(obj.commonName || obj.displayName)) return null;
    // Handoff from scan page only — short TTL. Collection entries do not expire.
    if (obj.savedAt && Date.now() - Number(obj.savedAt) > MAX_AGE_MS) {
      return null;
    }
    return obj;
  }

  function readGeneratedStill() {
    var raw = null;
    try {
      raw = sessionStorage.getItem(STILL_KEY);
    } catch (e) {}
    if (!raw) {
      try {
        raw = localStorage.getItem(STILL_KEY);
      } catch (e2) {
        raw = null;
      }
    }
    if (!raw) return null;
    try {
      var obj = JSON.parse(raw);
      if (!obj || !obj.imageBase64) return null;
      if (obj.savedAt && Date.now() - Number(obj.savedAt) > MAX_AGE_MS) {
        return null;
      }
      var mime = (obj.mimeType || "image/png").split(";")[0] || "image/png";
      return {
        dataUrl: "data:" + mime + ";base64," + obj.imageBase64,
        mimeType: mime,
        imageBase64: obj.imageBase64,
        commonName: obj.commonName || "",
        latinName: obj.latinName || "",
        cultivar: obj.cultivar || "",
      };
    } catch (e3) {
      return null;
    }
  }

  function updateSyncStatus() {
    if (!syncEl || !window.BaneCodexCollection) return;
    var st =
      window.BaneCodexCollection.getSyncState &&
      window.BaneCodexCollection.getSyncState();
    if (!st) return;
    if (st.signedIn && st.email) {
      syncEl.innerHTML =
        "Synced to Google: <strong></strong> — learns and fact book follow this sign-in on other devices.";
      syncEl.querySelector("strong").textContent = st.email;
      return;
    }
    var url =
      (window.BaneCodexCollection.googleSignInUrl &&
        window.BaneCodexCollection.googleSignInUrl()) ||
      "#";
    syncEl.innerHTML =
      'Not synced yet. <a href="' +
      url +
      '">Sign in with Google</a> so learns and facts follow your account (not just this phone).';
  }

  function markShelfActive() {
    if (!shelfGrid) return;
    var buttons = shelfGrid.querySelectorAll(".codex-shelf__item");
    var i;
    for (i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (state.collectionKey && btn.dataset.key === state.collectionKey) {
        btn.classList.add("is-active");
      } else {
        btn.classList.remove("is-active");
      }
    }
  }

  function openLearnedEntry(entry, opts) {
    if (!entry) return;
    opts = opts || {};
    var still = null;
    var dataUrl =
      window.BaneCodexCollection && window.BaneCodexCollection.stillDataUrl
        ? window.BaneCodexCollection.stillDataUrl(entry)
        : "";
    if (dataUrl) {
      still = { dataUrl: dataUrl };
    }
    applyIdentity(entry, {
      fromScan: !!opts.fromScan,
      stillToken: "",
      generatedStill: still,
      collectionKey: entry.key,
    });
    setStatus(
      (opts.fromScan ? "From your scan: " : "From your learns: ") +
        (entry.displayName || entry.commonName || "organism") +
        (still ? " (matched art)" : "") +
        ". Loading callouts…"
    );
    loadFacts();
  }

  function renderShelf() {
    if (!shelfEl || !shelfGrid || !window.BaneCodexCollection) return;
    var list = window.BaneCodexCollection.readAll();
    shelfGrid.innerHTML = "";
    if (!list.length) {
      shelfEl.hidden = true;
      return;
    }
    shelfEl.hidden = false;
    list.forEach(function (entry) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "codex-shelf__item";
      btn.dataset.key = entry.key;
      var thumbHtml = "";
      var dataUrl = window.BaneCodexCollection.stillDataUrl(entry);
      if (dataUrl) {
        thumbHtml =
          '<img class="codex-shelf__thumb" alt="" src="' +
          dataUrl.replace(/"/g, "") +
          '" />';
      } else {
        thumbHtml = '<div class="codex-shelf__thumb codex-shelf__thumb--empty">?</div>';
      }
      var factBit = "";
      if (window.BaneCodexFacts && window.BaneCodexFacts.speciesProgressLabel) {
        factBit =
          '<p class="codex-shelf__facts"></p>';
      }
      btn.innerHTML =
        thumbHtml +
        '<p class="codex-shelf__name"></p>' +
        factBit;
      btn.querySelector(".codex-shelf__name").textContent =
        entry.displayName || entry.commonName || "Organism";
      var factsEl = btn.querySelector(".codex-shelf__facts");
      if (factsEl) {
        factsEl.textContent = window.BaneCodexFacts.speciesProgressLabel(
          entry.key
        );
      }
      btn.addEventListener("click", function () {
        openLearnedEntry(entry, { fromScan: false });
      });
      shelfGrid.appendChild(btn);
    });
    markShelfActive();
  }

  function rememberInCollection(record, still) {
    if (!window.BaneCodexCollection || !record) return null;
    var packedStill = null;
    if (still && still.imageBase64) {
      packedStill = {
        mimeType: still.mimeType || "image/jpeg",
        imageBase64: still.imageBase64,
      };
    } else if (still && still.dataUrl) {
      var m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(still.dataUrl);
      if (m) packedStill = { mimeType: m[1], imageBase64: m[2] };
    }
    var entry = window.BaneCodexCollection.upsert(record, packedStill);
    renderShelf();
    return entry;
  }

  function readScanId() {
    var params = new URLSearchParams(window.location.search || "");

    // Prefer plain query params from the scan page (most reliable).
    var common = (params.get("common") || "").trim();
    var display = (params.get("display") || "").trim();
    if (common || display) {
      clearStored();
      return {
        commonName: common || display,
        displayName: display || common,
        latinName: (params.get("latin") || "").trim(),
        cultivar: (params.get("cultivar") || "").trim(),
        bloomColor: (params.get("color") || "").trim(),
        organismType: (params.get("type") || "flower").trim(),
        lifeStage: (params.get("stage") || "").trim(),
        confidence: (params.get("conf") || "").trim(),
        evidence: params.get("evidence") === "1",
        shortNote: (params.get("note") || "").trim(),
        stillToken: (params.get("still") || "").trim(),
        fromScan: true,
      };
    }

    var raw = null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
    } catch (e) {}
    var fromSession = null;
    try {
      fromSession = parseStored(raw);
    } catch (e2) {}
    if (fromSession) {
      clearStored();
      fromSession.fromScan = true;
      return fromSession;
    }

    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e3) {
      raw = null;
    }
    var fromLocal = null;
    try {
      fromLocal = parseStored(raw);
    } catch (e4) {}
    if (fromLocal) {
      clearStored();
      fromLocal.fromScan = true;
      return fromLocal;
    }

    return null;
  }

  function bootCodex() {
    renderFactBookProgress();
    renderShelf();
    updateSyncStatus();

    var parsed = null;
    try {
      parsed = readScanId();
    } catch (e) {}
    var generated = null;
    try {
      generated = readGeneratedStill();
    } catch (e2) {}
    if (generated) {
      clearStillStorage();
    }
    if (parsed && (parsed.commonName || parsed.displayName)) {
      var remembered = rememberInCollection(parsed, generated);
      var entry =
        remembered ||
        Object.assign({}, parsed, {
          key:
            (window.BaneCodexCollection &&
              window.BaneCodexCollection.entryKey(parsed)) ||
            "",
          stillBase64: generated && generated.imageBase64,
          stillMime: generated && generated.mimeType,
        });
      var still = null;
      var dataUrl =
        window.BaneCodexCollection && window.BaneCodexCollection.stillDataUrl
          ? window.BaneCodexCollection.stillDataUrl(entry)
          : "";
      if (dataUrl) still = { dataUrl: dataUrl };
      else if (generated && generated.dataUrl) still = generated;
      applyIdentity(entry, {
        fromScan: true,
        stillToken: (!still && parsed.stillToken) || "",
        generatedStill: still,
        collectionKey: entry.key || "",
      });
      setStatus(
        "From your scan: " +
          (entry.displayName || entry.commonName || "organism") +
          (still || parsed.stillToken ? " (matched art)" : "") +
          ". Loading callouts…"
      );
      loadFacts();
      if (!still && parsed.stillToken && window.BaneCodexCollection) {
        fetch(
          "/bane-of-extinction/api/still/" + encodeURIComponent(parsed.stillToken),
          { credentials: "include" }
        )
          .then(function (res) {
            if (!res.ok) throw new Error("still");
            return res.blob();
          })
          .then(function (blob) {
            return new Promise(function (resolve) {
              var reader = new FileReader();
              reader.onload = function () {
                var m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(
                  String(reader.result || "")
                );
                resolve(m ? { mimeType: m[1], imageBase64: m[2] } : null);
              };
              reader.onerror = function () {
                resolve(null);
              };
              reader.readAsDataURL(blob);
            });
          })
          .then(function (packed) {
            if (!packed) return;
            var updated = window.BaneCodexCollection.upsert(entry, packed);
            renderShelf();
            applyIdentity(updated || entry, {
              fromScan: true,
              generatedStill: {
                dataUrl: "data:" + packed.mimeType + ";base64," + packed.imageBase64,
              },
              collectionKey: (updated && updated.key) || entry.key,
              keepStill: true,
            });
          })
          .catch(function () {});
      }
    } else {
      var learned =
        window.BaneCodexCollection && window.BaneCodexCollection.readAll
          ? window.BaneCodexCollection.readAll()
          : [];
      if (learned.length) {
        openLearnedEntry(learned[0], { fromScan: false });
      } else {
        syncCultivarToggle();
        hideStill(
          "After a scan, art matches that species and life stage — not your photo."
        );
        setStatus(
          "No learns yet. Use EcoLens on your phone."
        );
      }
    }
  }

  if (window.BaneCodexCollection && window.BaneCodexCollection.syncNow) {
    window.BaneCodexCollection.syncNow()
      .then(function () {
        bootCodex();
      })
      .catch(function () {
        bootCodex();
      });
  } else {
    bootCodex();
  }

  if (loadBtn) loadBtn.addEventListener("click", loadFacts);

  syncFocusModeUi();
  if (focusModeEl) {
    focusModeEl.addEventListener("change", function () {
      writeFocusModePref(getFocusMode());
      // Ready for reload; player hits Load for focus-aware facts.
    });
  }

  var placeRoot = document.getElementById("placeLensRoot");
  if (
    placeRoot &&
    window.BanePlaceLens &&
    typeof window.BanePlaceLens.renderPlaceLensUi === "function"
  ) {
    window.BanePlaceLens.renderPlaceLensUi(placeRoot);
  }
  window.addEventListener("bane-place-lens-change", function () {
    // Ready for reload; player hits Load Claude callouts when they want fresh place-aware facts.
  });
})();
