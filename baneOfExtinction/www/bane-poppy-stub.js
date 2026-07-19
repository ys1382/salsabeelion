(function () {
  "use strict";

  var API = "/bane-of-extinction/api/callouts";
  var statusEl = document.getElementById("status");
  var listEl = document.getElementById("calloutList");
  var disclaimerEl = document.getElementById("disclaimer");
  var commonOut = document.getElementById("commonOut");
  var latinOut = document.getElementById("latinOut");
  var loadBtn = document.getElementById("loadFacts");
  var cultivarOn = document.getElementById("cultivarOn");
  var evidenceOn = document.getElementById("evidenceOn");

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
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
    setStatus("Asking Claude for California poppy callouts…");
    if (loadBtn) loadBtn.disabled = true;
    var body = {
      commonName: "California poppy",
      latinName: "Eschscholzia californica",
      cultivar: cultivarOn && cultivarOn.checked ? "Watermelon Heaven" : "",
      evidence: !!(evidenceOn && evidenceOn.checked),
    };
    fetch(API, {
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
        if (commonOut) commonOut.textContent = data.displayName || data.commonName || "California poppy";
        if (latinOut) latinOut.textContent = data.latinName || "Eschscholzia californica";
        renderCallouts(data.callouts || []);
        if (disclaimerEl) {
          disclaimerEl.hidden = false;
          disclaimerEl.textContent =
            (data.disclaimer || "") +
            (data.source ? " · source: " + data.source : "");
        }
        setStatus(
          data.source && String(data.source).indexOf("fallback") === 0
            ? "Showing fallback facts (Claude unavailable). You can still judge the layout."
            : "Callouts loaded. Scroll the list on the right of the poppy."
        );
      })
      .catch(function (err) {
        setStatus("Could not load callouts: " + (err && err.message ? err.message : "error"));
      })
      .then(function () {
        if (loadBtn) loadBtn.disabled = false;
      });
  }

  if (loadBtn) loadBtn.addEventListener("click", loadFacts);
})();
