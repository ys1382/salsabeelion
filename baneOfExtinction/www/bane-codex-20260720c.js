(function () {
  "use strict";

  var API_CALLOUTS = "/bane-of-extinction/api/callouts";
  var STORAGE_KEY = "bane_last_id";
  var STILL_KEY = "bane_last_still";
  var MAX_AGE_MS = 15 * 60 * 1000;
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

  /* Demo-only cutouts — never used as a fallback for real scans. */
  var DEMO_STILLS = {
    poppy: {
      src: "assets/california-poppy-subject.png",
      credit:
        "Demo still: California poppy subject cutout (Sedovo photo, CC BY-SA 3.0).",
      match: /poppy|eschscholzia/i,
    },
    sunflower: {
      src: "assets/common-sunflower-subject.png",
      credit:
        "Demo still: common sunflower subject cutout (Soph556 photo, CC BY-SA 3.0).",
      match: /sunflower|helianthus/i,
    },
    philodendron: {
      src: "assets/sweetheart-philodendron-subject.png",
      credit:
        "Demo still: sweetheart philodendron subject cutout (CC-licensed photo).",
      match: /philodendron|hederaceum|heartleaf|sweetheart/i,
    },
  };

  var state = {
    commonName: "",
    latinName: "",
    cultivar: "",
    evidence: false,
    organismType: "flower",
    fromScan: false,
    generatedStill: null,
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

  function applyDemoStill(commonName, latinName) {
    var blob = (commonName || "") + " " + (latinName || "");
    var key;
    for (key in DEMO_STILLS) {
      if (DEMO_STILLS[key].match.test(blob)) {
        showStill(
          DEMO_STILLS[key].src,
          commonName || key,
          DEMO_STILLS[key].credit,
          true
        );
        return;
      }
    }
    hideStill("Demo has no local still for this organism.");
  }

  function applyStill() {
    if (state.generatedStill && state.generatedStill.dataUrl) {
      var g = state.generatedStill;
      var label = state.commonName || "Scanned organism";
      if (state.cultivar) label += " (" + state.cultivar + ")";
      showStill(
        g.dataUrl,
        label,
        "Codex art matched to this scan" +
          (state.commonName ? " (" + state.commonName + ")" : "") +
          " — not your raw photo, not a generic stub.",
        true
      );
      return;
    }
    if (state.fromScan) {
      hideStill(
        "No matching codex art for this scan yet — facts still follow the ID. " +
          "Generic poppy/sunflower stubs are not used for scans."
      );
      return;
    }
    applyDemoStill(state.commonName, state.latinName);
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
    state.evidence = !!id.evidence;
    state.organismType = id.organismType || "flower";
    state.fromScan = !!opts.fromScan;
    if (opts.generatedStill) state.generatedStill = opts.generatedStill;
    else if (!opts.keepStill) state.generatedStill = null;
    if (commonOut) {
      commonOut.textContent = id.displayName || state.commonName || "Unknown";
    }
    if (latinOut) latinOut.textContent = state.latinName || "—";
    if (evidenceOn) evidenceOn.checked = state.evidence;
    syncCultivarToggle();
    applyStill();
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
        if (commonOut) {
          commonOut.textContent =
            state.commonName +
            (state.cultivar && isPoppy(state.commonName, state.latinName)
              ? " (" + state.cultivar + ")"
              : "");
        }
        if (latinOut) latinOut.textContent = state.latinName || "—";
        applyStill();
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
        commonName: obj.commonName || "",
        latinName: obj.latinName || "",
        cultivar: obj.cultivar || "",
      };
    } catch (e3) {
      return null;
    }
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
        organismType: (params.get("type") || "flower").trim(),
        confidence: (params.get("conf") || "").trim(),
        evidence: params.get("evidence") === "1",
        shortNote: (params.get("note") || "").trim(),
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

  function wireDemo(btnId, id) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener("click", function () {
      clearStored();
      clearStillStorage();
      applyIdentity(id, { fromScan: false, generatedStill: null });
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
  var generated = null;
  try {
    generated = readGeneratedStill();
  } catch (e2) {}
  if (generated) {
    clearStillStorage();
  }
  if (parsed && (parsed.commonName || parsed.displayName)) {
    applyIdentity(parsed, {
      fromScan: true,
      generatedStill: generated,
    });
    setStatus(
      "From your scan: " +
        (parsed.displayName || parsed.commonName || "organism") +
        (generated ? " (matched codex art)" : "") +
        ". Loading callouts…"
    );
    loadFacts();
  } else {
    syncCultivarToggle();
    hideStill(
      "After a scan, codex art is built to match that ID (color and form) — not a generic stub."
    );
    setStatus(
      "No scan loaded. Use Wildlife camera scan on your phone, or try a demo below."
    );
  }

  if (loadBtn) loadBtn.addEventListener("click", loadFacts);
})();
