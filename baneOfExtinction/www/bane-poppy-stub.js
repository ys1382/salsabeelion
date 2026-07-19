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
  var evidenceOn = document.getElementById("evidenceOn");
  var stillEl = document.getElementById("organismStill");
  var creditEl = document.getElementById("artCredit");

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
    commonName: "California poppy",
    latinName: "Eschscholzia californica",
    cultivar: "Watermelon Heaven",
    evidence: false,
    organismType: "flower",
  };

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function applyStill(commonName, latinName) {
    if (!stillEl) return;
    var blob = (commonName || "") + " " + (latinName || "");
    var key;
    for (key in STILLS) {
      if (STILLS[key].match.test(blob)) {
        stillEl.src = STILLS[key].src;
        stillEl.alt = commonName || key;
        if (creditEl) creditEl.textContent = STILLS[key].credit;
        return;
      }
    }
  }

  function applyIdentity(id) {
    if (!id) return;
    state.commonName = id.commonName || state.commonName;
    state.latinName = id.latinName || "";
    state.cultivar = id.cultivar || "";
    state.evidence = !!id.evidence;
    state.organismType = id.organismType || state.organismType;
    if (commonOut) commonOut.textContent = id.displayName || state.commonName;
    if (latinOut) latinOut.textContent = state.latinName || "—";
    if (evidenceOn) evidenceOn.checked = state.evidence;
    if (cultivarOn) {
      cultivarOn.checked = !!(
        state.cultivar && /watermelon/i.test(state.cultivar)
      );
    }
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
      article.querySelector(".callout__label").textContent = c.label || c.anchor || "Note";
      article.querySelector(".callout__fact").textContent = c.fact || "";
      listEl.appendChild(article);
    });
  }

  function loadFacts() {
    setStatus("Asking Claude for callouts that match this identification…");
    if (loadBtn) loadBtn.disabled = true;
    var cultivar = "";
    if (cultivarOn && cultivarOn.checked) {
      cultivar = state.cultivar || "Watermelon Heaven";
    } else if (state.cultivar && !(cultivarOn && cultivarOn.checked)) {
      cultivar = state.cultivar;
      if (/watermelon/i.test(cultivar) && cultivarOn && !cultivarOn.checked) {
        cultivar = "";
      }
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
          throw new Error((data && data.message) || (data && data.error) || "request_failed");
        }
        if (commonOut) commonOut.textContent = data.displayName || data.commonName || state.commonName;
        if (latinOut) latinOut.textContent = data.latinName || state.latinName || "—";
        applyStill(
          data.commonName || state.commonName,
          data.latinName || state.latinName
        );
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
            : "Callouts loaded for: " + (data.displayName || data.commonName || "this organism") + "."
        );
      })
      .catch(function (err) {
        setStatus("Could not load callouts: " + (err && err.message ? err.message : "error"));
      })
      .then(function () {
        if (loadBtn) loadBtn.disabled = false;
      });
  }

  // Restore last camera ID if present
  try {
    var raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      applyIdentity(parsed);
      setStatus(
        "From your last scan: " +
          (parsed.displayName || parsed.commonName || "organism") +
          ". Loading callouts…"
      );
      sessionStorage.removeItem(STORAGE_KEY);
      loadFacts();
    }
  } catch (e) {}

  if (loadBtn) loadBtn.addEventListener("click", loadFacts);
})();
