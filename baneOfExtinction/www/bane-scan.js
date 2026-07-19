(function () {
  "use strict";

  var API = "/bane-of-extinction/api/wildlife-identify";
  var STORAGE_KEY = "bane_last_id";
  var ASSET_V = "20260719a";
  var desktopBlock = document.getElementById("desktopBlock");
  var scanUi = document.getElementById("scanUi");
  var video = document.getElementById("scanVideo");
  var canvas = document.getElementById("scanCanvas");
  var captureBtn = document.getElementById("captureBtn");
  var stopCamBtn = document.getElementById("stopCamBtn");
  var statusEl = document.getElementById("scanStatus");
  var coachHint = document.getElementById("coachHint");
  var resultBox = document.getElementById("scanResult");
  var resultName = document.getElementById("resultName");
  var resultLatin = document.getElementById("resultLatin");
  var resultMeta = document.getElementById("resultMeta");
  var openCodexBtn = document.getElementById("openCodexBtn");
  var rescanBtn = document.getElementById("rescanBtn");
  var stream = null;
  var busy = false;
  var lastRecord = null;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function isHandheld() {
    return window.BaneHandheld && window.BaneHandheld.isHandheld();
  }

  function encodeId(record) {
    try {
      var json = JSON.stringify(record);
      return btoa(unescape(encodeURIComponent(json)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    } catch (e) {
      return "";
    }
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
        setStatus("Camera ready. One tap — wait until it finishes (often 10–20s).");
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

  function showResult(data) {
    lastRecord = {
      displayName: data.displayName,
      commonName: data.commonName,
      latinName: data.latinName,
      cultivar: data.cultivar || "",
      evidence: !!data.evidence,
      organismType: data.organismType || "flower",
      confidence: data.confidence || "",
      shortNote: data.shortNote || "",
      geminiName:
        data.sources && data.sources.gemini
          ? data.sources.gemini.commonName
          : "",
      claudeName:
        data.sources && data.sources.claude
          ? data.sources.claude.commonName
          : "",
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lastRecord));
    } catch (e) {}
    // Clear any stale localStorage leftover from older builds
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e2) {}

    if (resultName) {
      resultName.textContent = lastRecord.displayName || lastRecord.commonName || "Unknown";
    }
    if (resultLatin) resultLatin.textContent = lastRecord.latinName || "—";
    if (resultMeta) {
      var bits = [];
      if (lastRecord.confidence) bits.push("confidence: " + lastRecord.confidence);
      if (lastRecord.geminiName) bits.push("Gemini: " + lastRecord.geminiName);
      if (lastRecord.claudeName) bits.push("Claude: " + lastRecord.claudeName);
      if (lastRecord.shortNote) bits.push(lastRecord.shortNote);
      resultMeta.textContent = bits.join(" · ");
    }
    if (resultBox) resultBox.hidden = false;
    setStatus(
      "Scan finished. If this name is wrong, the models misread the photo — not the codex defaulting to poppy."
    );
  }

  function openCodex() {
    if (!lastRecord || !lastRecord.commonName) {
      setStatus("Scan first, then open the codex.");
      return;
    }
    var token = encodeId(lastRecord);
    var url = "codex.html?from=scan&v=" + ASSET_V;
    if (token) url += "&id=" + encodeURIComponent(token);
    window.location.href = url;
  }

  function onCapture() {
    if (busy) {
      setStatus("Still scanning… please wait (often 10–20 seconds). One tap is enough.");
      return;
    }
    busy = true;
    if (captureBtn) captureBtn.disabled = true;
    if (resultBox) resultBox.hidden = true;
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
                "). Try again."
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
        clearInterval(tick);
        stopCamera();
        showResult(data);
        if (captureBtn) captureBtn.disabled = true;
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
  if (openCodexBtn) openCodexBtn.addEventListener("click", openCodex);
  if (rescanBtn) {
    rescanBtn.addEventListener("click", function () {
      if (resultBox) resultBox.hidden = true;
      lastRecord = null;
      startCamera();
    });
  }
  startCamera();
  window.addEventListener("pagehide", stopCamera);
})();
