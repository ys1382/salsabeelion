(function () {
  "use strict";
  var statusEl = document.getElementById("deviceStatus");
  var scanBtn = document.getElementById("scanBtn");
  var handheld = window.BaneHandheld && window.BaneHandheld.isHandheld();

  if (!statusEl) return;

  if (handheld) {
    statusEl.textContent =
      "This looks like a phone or tablet — camera scan will live here later. For now, open the wildlife codex.";
    if (scanBtn) {
      scanBtn.hidden = false;
      scanBtn.setAttribute("aria-disabled", "true");
      scanBtn.disabled = true;
      scanBtn.title = "Camera scan not built yet — use the wildlife codex for now.";
      scanBtn.addEventListener("click", function () {
        statusEl.textContent =
          "Scan is not built yet. Trail Guide + Seek-style camera are on the roadmap. Codex works now.";
      });
    }
  } else {
    statusEl.textContent =
      "Desktop / laptop: browse the wildlife codex here. Open this site on a phone to use camera scan when it ships.";
  }
})();
