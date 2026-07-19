(function () {
  "use strict";

  var API_CALLOUTS = "/bane-of-extinction/api/callouts";
  var STORAGE_KEY = "bane_last_id";
  var statusEl = document.getElementById("status");
  var listEl = document.getElementById("calloutList");
  var disclaimerEl = document.getElementById("disclaimer");
  var commonOut = document.getElementById("commonOut");
  var latinOut = document.getElementById("latinOut");
  var loadBtn = document.getElementById("loadFacts");
  var cultivarOn = document.getElementById("cultivarOn");
  var cultivarRow = document.getElementById("cultivarRow");
  var evidenceOn = document.getElementById("evidenceOn");
  var stillEl = document.getElementById("organismStill");
  var creditEl = document.getElementById("artCredit");
  var stillWrap = document.querySelector(".organism-still-wrap");

  var STILLS = {
    poppy: {
      src: "assets/california-poppy-subject.png",
      credit:
        "Still: California poppy subject cutout (Sedovo photo, CC BY-SA 3.0).",
      match: /poppy|eschscholzia/i,
    },
    sunflower: {
      src: "assets/common-sunflower-subject.png",
      credit:
        "Still: common sunflower subject cutout (Soph556 photo, CC BY-SA 3.0).",
      match: /sunflower|helianthus/i,
    },
  };

  var state = {
    commonName: "",
    latinName: "",
    cultivar: "",
    evidence: false,
    organismType: "flower",
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

  function applyStill(commonName, latinName) {
    if (!stillEl) return;
    var blob = (commonName || "") + " " + (latinName || "");
    var key;
    for (key in STILLS) {
      if (STILLS[key].match.test(blob)) {
        stillEl.hidden = false;
        if (stillWrap) stillWrap.hidden = false;
        stillEl.src = STILLS[key].src;
        stillEl.alt = commonName || key;
        if (creditEl) creditEl.textContent = STILLS[key].credit;
        return;
      }
    }
    if (commonName) {
      stillEl.hidden = true;
      if (creditEl) {
        creditEl.textContent =
          "No local still for this organism yet — facts still match the scan guess.";
      }
    }
  }

  function applyIdentity(id) {
    if (!id) return;
    var common =
      (id.commonName && String(id.commonName).trim()) ||
      (id.displayName &&
        String(id.displayName).replace(/\s*\(.*\)\s*$/, "").trim()) ||
      "";
    state.commonName = common;
    state.latinName = (id.latinName && String(id.latinName).trim()) || "";
    state.cultivar = (id.cultivar && String(id.cultivar).trim()) || "";
    state.evidence = !!id.evidence;
    state.organismType = id.organismType || "flower";
    if (commonOut) {
      commonOut.textContent = id.displayName || state.commonName || "Unknown";
    }
    if (latinOut) latinOut.textContent = state.latinName || "—";
    if (evidenceOn) evidenceOn.checked = state.evidence;
    syncCultivarToggle();
    applyStill(state.commonName, state.latinName);
  }

  function renderCallouts(callouts) {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!callouts || !callouts.length) {
      listEl.innerHTML =
        '<p class="callout-empty">No callouts returned. Try Load again.</p>';
      return;
    }
    callouts.forEach(function (c) {
      var article = document.createElement("article");
      article.className = "callout";
      article.dataset.anchor = c.anchor || "";
      article.innerHTML =
        '<div class="callout__tick" aria-hidden="true"></div>' +
        '<div class="callout__body">' +
        '<p class="callout__label"></p>' +
        '<p class="callout__fact"></p>' +
        "</div>";
      article.querySelector(".callout__label").textContent =
        c.label || c.anchor || "Note";
      article.querySelector(".callout__fact").textContent = c.fact || "";
      listEl.appendChild(article);
    });
  }

  function loadFacts() {
    if (!state.commonName) {
      setStatus("Scan a plant first (or use a demo below). Nothing is selected yet.");
      return;
    }
    setStatus("Asking Claude for callouts that match this identification…");
    if (loadBtn) loadBtn.disabled = true;
    var cultivar = "";
    if (
      isPoppy(state.commonName, state.latinName) &&
      cultivarOn &&
      cultivarOn.checked
    ) {
      cultivar = state.cultivar || "Watermelon Heaven";
    }
    var body = {
      commonName: state.commonName,
      latinName: state.latinName,
      cultivar: cultivar,
      evidence: !!(evidenceOn && evidenceOn.checked),
      organismType: state.organismType,
    };
    fetch(API_CALLOUTS, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { res: res, data: data };
        });
      })
      .then(function (pack) {
        var data = pack.data || {};
        if (!pack.res.ok || !data.ok) {
          throw new Error(
            (data && data.message) || (data && data.error) || "request_failed"
          );
        }
        // Keep scanned identity authoritative — do not let callouts rename it.
        if (commonOut) {
          commonOut.textContent =
            state.commonName +
            (state.cultivar && isPoppy(state.commonName, state.latinName)
              ? " (" + state.cultivar + ")"
              : "");
        }
        if (latinOut) latinOut.textContent = state.latinName || "—";
        applyStill(state.commonName, state.latinName);
        renderCallouts(data.callouts || []);
        if (disclaimerEl) {
          disclaimerEl.hidden = false;
          disclaimerEl.textContent =
            (data.disclaimer || "") +
            (data.source ? " · source: " + data.source : "");
        }
        setStatus(
          data.source && String(data.source).indexOf("fallback") === 0
            ? "Showing fallback facts (Claude unavailable)."
            : "Callouts loaded for: " + state.commonName + "."
        );
      })
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

  function decodeIdToken(token) {
    if (!token) return null;
    try {
      var b64 = String(token).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var json = decodeURIComponent(escape(atob(b64)));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function readScanId() {
    var params = new URLSearchParams(window.location.search || "");
    var fromScan = params.get("from") === "scan";
    var fromUrl = decodeIdToken(params.get("id") || "");
    if (fromUrl && (fromUrl.commonName || fromUrl.displayName)) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e2) {}
      return fromUrl;
    }
    // Only touch storage when arriving from a scan — never revive a stale poppy.
    if (!fromScan) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e3) {}
      return null;
    }
    var raw = null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
    } catch (e4) {}
    if (!raw) return null;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e5) {}
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e6) {}
    return JSON.parse(raw);
  }

  function wireDemo(btnId, id) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener("click", function () {
      applyIdentity(id);
      setStatus("Demo identity set. Loading callouts…");
      loadFacts();
    });
  }

  wireDemo("demoPoppy", {
    commonName: "California poppy",
    latinName: "Eschscholzia californica",
    cultivar: "",
    organismType: "flower",
    displayName: "California poppy",
  });
  wireDemo("demoSunflower", {
    commonName: "Common sunflower",
    latinName: "Helianthus annuus",
    cultivar: "",
    organismType: "flower",
    displayName: "Common sunflower",
  });

  var parsed = null;
  try {
    parsed = readScanId();
  } catch (e) {}
  if (parsed && (parsed.commonName || parsed.displayName)) {
    applyIdentity(parsed);
    setStatus(
      "From your scan: " +
        (parsed.displayName || parsed.commonName || "organism") +
        ". Loading callouts…"
    );
    loadFacts();
  } else {
    syncCultivarToggle();
    if (stillEl) stillEl.hidden = true;
    setStatus("Scan on a phone to learn a plant — or try a demo below.");
  }

  if (loadBtn) loadBtn.addEventListener("click", loadFacts);
})();
