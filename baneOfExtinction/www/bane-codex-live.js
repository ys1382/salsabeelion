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
  var shelfEl = document.getElementById("codexShelf");
  var shelfGrid = document.getElementById("codexShelfGrid");
  var syncEl = document.getElementById("codexSync");

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
    if (evidenceOn) evidenceOn.checked = state.evidence;
    syncCultivarToggle();
    applyStill();
    markShelfActive();
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
      shortNote: state.shortNote || "",
      bloomColor: state.bloomColor || "",
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
        "Synced to Google: <strong></strong> — learns follow this sign-in on other devices.";
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
      '">Sign in with Google</a> so learns follow your account (not just this phone).';
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
      btn.innerHTML =
        thumbHtml +
        '<p class="codex-shelf__name"></p>';
      btn.querySelector(".codex-shelf__name").textContent =
        entry.displayName || entry.commonName || "Organism";
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

  function wireDemo(btnId, id) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener("click", function () {
      clearStored();
      clearStillStorage();
      state.collectionKey = "";
      applyIdentity(id, { fromScan: false, generatedStill: null });
      markShelfActive();
      setStatus("Demo identity set. Loading callouts…");
      loadFacts();
    });
  }

  wireDemo("demoPoppy", {
    commonName: "California poppy",
    latinName: "Eschscholzia californica",
    cultivar: "",
    organismType: "flower",
    lifeStage: "flowering",
    displayName: "California poppy",
  });
  wireDemo("demoSunflower", {
    commonName: "Common sunflower",
    latinName: "Helianthus annuus",
    cultivar: "",
    organismType: "flower",
    lifeStage: "flowering",
    displayName: "Common sunflower",
  });

  function bootCodex() {
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
          "No learns yet. Use Wildlife camera scan on your phone, or try a demo below."
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
})();
