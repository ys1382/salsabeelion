(function () {
  "use strict";
  var statusEl = document.getElementById("deviceStatus");
  var scanBtn = document.getElementById("scanBtn");
  var handheld = window.BaneHandheld && window.BaneHandheld.isHandheld();

  if (!statusEl) return;

  if (handheld) {
    statusEl.textContent =
      "Phone/tablet detected — use Wildlife camera scan, then open the codex for callouts.";
    var deskLink = document.getElementById("scanLinkDesktop");
    if (deskLink) deskLink.hidden = true;
    if (scanBtn) {
      scanBtn.hidden = false;
      scanBtn.disabled = false;
      scanBtn.removeAttribute("aria-disabled");
      scanBtn.addEventListener("click", function () {
        window.location.href = "scan.html";
      });
    }
  } else {
    statusEl.textContent =
      "Desktop: browse the wildlife codex here. Open Bane on a phone for camera scan.";
  }
})();
