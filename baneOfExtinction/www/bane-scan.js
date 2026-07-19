(function () {
  "use strict";

  var API = "/bane-of-extinction/api/wildlife-identify";
  var STORAGE_KEY = "bane_last_id";
  var desktopBlock = document.getElementById("desktopBlock");
  var scanUi = document.getElementById("scanUi");
  var video = document.getElementById("scanVideo");
  var canvas = document.getElementById("scanCanvas");
  var captureBtn = document.getElementById("captureBtn");
  var stopCamBtn = document.getElementById("stopCamBtn");
  var statusEl = document.getElementById("scanStatus");
  var coachHint = document.getElementById("coachHint");
  var stream = null;
  var busy = false;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function isHandheld() {
    return window.BaneHandheld && window.BaneHandheld.isHandheld();
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(function (t) {
        try {
          t.stop();
        } catch (e) {}
      });
      stream = null;
    }
    if (video) video.srcObject = null;
    if (captureBtn) captureBtn.disabled = true;
    if (stopCamBtn) stopCamBtn.hidden = true;
  }

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("This browser cannot open the camera.");
      return;
    }
    setStatus("Starting camera…");
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      .then(function (s) {
        stream = s;
        video.srcObject = s;
        return video.play();
      })
      .then(function () {
        if (captureBtn) captureBtn.disabled = false;
        if (stopCamBtn) stopCamBtn.hidden = false;
        if (coachHint) {
          coachHint.textContent =
            "Fill the frame with the organism or clear evidence. Then tap Capture & scan.";
        }
        setStatus("Camera ready.");
      })
      .catch(function (err) {
        setStatus(
          "Camera permission failed: " +
            (err && err.message ? err.message : "denied or unavailable")
        );
      });
  }

  function captureFrame() {
    if (!video || !canvas || !video.videoWidth) {
      throw new Error("Camera not ready");
    }
    var maxEdge = 1400;
    var vw = video.videoWidth;
    var vh = video.videoHeight;
    var scale = Math.min(1, maxEdge / Math.max(vw, vh));
    var w = Math.max(1, Math.round(vw * scale));
    var h = Math.max(1, Math.round(vh * scale));
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    var dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    var m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
    if (!m) throw new Error("Could not encode frame");
    return { mimeType: m[1], imageBase64: m[2] };
  }

  function clearCanvas() {
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 1;
    canvas.height = 1;
  }

  function onCapture() {
    if (busy) {
      setStatus("Still scanning… please wait (can take ~10–20 seconds).");
      return;
    }
    busy = true;
    if (captureBtn) captureBtn.disabled = true;
    var started = Date.now();
    var tick = setInterval(function () {
      var sec = Math.round((Date.now() - started) / 1000);
      setStatus(
        "Scanning with Gemini + Claude… " +
          sec +
          "s (photo will not be kept). One tap is enough."
      );
    }, 500);
    setStatus("Scanning with Gemini + Claude… photo will not be kept.");
    var payload;
    try {
      payload = captureFrame();
    } catch (e) {
      clearInterval(tick);
      busy = false;
      if (captureBtn) captureBtn.disabled = false;
      setStatus(e && e.message ? e.message : "Capture failed");
      return;
    }

    fetch(API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        // Drop local frame ASAP
        clearCanvas();
        payload.imageBase64 = "";
        return res.text().then(function (text) {
          var data = null;
          try {
            data = text ? JSON.parse(text) : {};
          } catch (parseErr) {
            if (res.status === 413) {
              throw new Error("Photo too large for the server. Try again a bit farther back.");
            }
            throw new Error(
              "Bad response from scan API (HTTP " +
                res.status +
                "). Try again — if this keeps happening, the server may be blocking the photo size."
            );
          }
          return { res: res, data: data || {} };
        });
      })
      .then(function (pack) {
        var data = pack.data || {};
        if (!pack.res.ok || !data.ok) {
          throw new Error(
            (data && data.message) || (data && data.error) || "identify_failed"
          );
        }
        var record = {
          displayName: data.displayName,
          commonName: data.commonName,
          latinName: data.latinName,
          cultivar: data.cultivar,
          evidence: data.evidence,
          organismType: data.organismType,
          confidence: data.confidence,
        };
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
        } catch (e) {}
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
        } catch (e2) {}
        clearInterval(tick);
        setStatus(
          "Looks like: " +
            (data.displayName || data.commonName) +
            " (" +
            (data.confidence || "?") +
            "). Opening codex…"
        );
        stopCamera();
        window.location.href = "codex.html?from=scan";
      })
      .catch(function (err) {
        clearInterval(tick);
        clearCanvas();
        setStatus("Scan failed: " + (err && err.message ? err.message : "error"));
        if (captureBtn) captureBtn.disabled = !stream;
      })
      .then(function () {
        busy = false;
      });
  }

  if (!isHandheld()) {
    if (desktopBlock) desktopBlock.hidden = false;
    if (scanUi) scanUi.hidden = true;
    setStatus("Open this page on a phone or tablet to scan.");
    return;
  }

  if (desktopBlock) desktopBlock.hidden = true;
  if (scanUi) scanUi.hidden = false;
  if (captureBtn) captureBtn.addEventListener("click", onCapture);
  if (stopCamBtn) stopCamBtn.addEventListener("click", stopCamera);
  startCamera();
  window.addEventListener("pagehide", stopCamera);
})();
