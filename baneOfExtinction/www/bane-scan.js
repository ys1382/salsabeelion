(function () {
  "use strict";

  var API = "/bane-of-extinction/api/wildlife-identify";
  var STORAGE_KEY = "bane_last_id";
  var ASSET_V = "20260719d";
  var LIVE_COACH_MS = 350;
  var BLUR_TOO_LOW = 36;
  var BLUR_SOFT = 70;
  var EDGE_TOO_LOW = 0.014;
  var EDGE_SOFT = 0.028;
  var FILL_TOO_LOW = 0.12;
  var FILL_SOFT = 0.2;
  var VARIANCE_TOO_LOW = 180;
  var VARIANCE_SOFT = 320;

  var desktopBlock = document.getElementById("desktopBlock");
  var scanUi = document.getElementById("scanUi");
  var scanStage = document.querySelector(".scan-stage");
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
  var redirectTimer = null;
  var coachTimer = null;
  var coachReady = false;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function isHandheld() {
    return window.BaneHandheld && window.BaneHandheld.isHandheld();
  }

  function saveRecord(record) {
    var packed = JSON.stringify(
      Object.assign({}, record, { savedAt: Date.now() })
    );
    try {
      sessionStorage.setItem(STORAGE_KEY, packed);
    } catch (e) {}
    try {
      localStorage.setItem(STORAGE_KEY, packed);
    } catch (e2) {}
  }

  function codexUrl(record) {
    var q = new URLSearchParams();
    q.set("from", "scan");
    q.set("v", ASSET_V);
    if (record.commonName) q.set("common", record.commonName);
    if (record.displayName) q.set("display", record.displayName);
    if (record.latinName) q.set("latin", record.latinName);
    if (record.cultivar) q.set("cultivar", record.cultivar);
    if (record.organismType) q.set("type", record.organismType);
    if (record.confidence) q.set("conf", record.confidence);
    if (record.evidence) q.set("evidence", "1");
    if (record.shortNote) q.set("note", String(record.shortNote).slice(0, 160));
    return "codex.html?" + q.toString();
  }

  function laplacianVariance(gray, w, h) {
    var sum = 0;
    var sumSq = 0;
    var n = 0;
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var i = y * w + x;
        var lap =
          -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w];
        sum += lap;
        sumSq += lap * lap;
        n++;
      }
    }
    if (!n) return 0;
    var mean = sum / n;
    return sumSq / n - mean * mean;
  }

  function edgeFraction(gray, w, h) {
    var hits = 0;
    var total = 0;
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var i = y * w + x;
        var gx = Math.abs(gray[i + 1] - gray[i - 1]);
        var gy = Math.abs(gray[i + w] - gray[i - w]);
        if (gx + gy > 28) hits++;
        total++;
      }
    }
    return total ? hits / total : 0;
  }

  /**
   * Fraction of guide-box tiles with real mid-scale structure (any color).
   * Empty wall / sky / bare wood → low. Leaves, blooms, bark, feathers → higher.
   */
  function subjectFillScore(gray, w, h) {
    var cols = 8;
    var rows = 10;
    var tileW = Math.max(1, Math.floor(w / cols));
    var tileH = Math.max(1, Math.floor(h / rows));
    var active = 0;
    var counted = 0;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x0 = c * tileW;
        var y0 = r * tileH;
        var x1 = Math.min(w, x0 + tileW);
        var y1 = Math.min(h, y0 + tileH);
        if (x1 - x0 < 3 || y1 - y0 < 3) continue;
        var sum = 0;
        var sumSq = 0;
        var edgeHits = 0;
        var n = 0;
        for (var y = y0 + 1; y < y1 - 1; y++) {
          for (var x = x0 + 1; x < x1 - 1; x++) {
            var i = y * w + x;
            var g = gray[i];
            sum += g;
            sumSq += g * g;
            var gx = Math.abs(gray[i + 1] - gray[i - 1]);
            var gy = Math.abs(gray[i + w] - gray[i - w]);
            if (gx + gy > 22) edgeHits++;
            n++;
          }
        }
        counted++;
        if (!n) continue;
        var mean = sum / n;
        var variance = sumSq / n - mean * mean;
        var edgeRate = edgeHits / n;
        if (variance > 90 || edgeRate > 0.06) active++;
      }
    }
    return counted ? active / counted : 0;
  }

  function analyzeOrganismFrame(vid) {
    if (!vid || !vid.videoWidth) {
      return { ok: false, hint: "Starting camera…", level: "wait" };
    }
    var vw = vid.videoWidth;
    var vh = vid.videoHeight;
    var sampleW = 320;
    var sampleH = Math.max(1, Math.round((vh / vw) * sampleW));
    var sample = document.createElement("canvas");
    sample.width = sampleW;
    sample.height = sampleH;
    var ctx = sample.getContext("2d");
    // Match the dashed guide box (~10% / 12% inset).
    var insetX = Math.round(vw * 0.1);
    var insetY = Math.round(vh * 0.12);
    var sw = Math.max(1, vw - insetX * 2);
    var sh = Math.max(1, vh - insetY * 2);
    ctx.drawImage(vid, insetX, insetY, sw, sh, 0, 0, sampleW, sampleH);
    var img = ctx.getImageData(0, 0, sampleW, sampleH);
    var d = img.data;
    var gray = new Float32Array(sampleW * sampleH);
    var brightness = 0;
    var brightSumSq = 0;
    for (var i = 0; i < sampleW * sampleH; i++) {
      var o = i * 4;
      var g = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
      gray[i] = g;
      brightness += g;
      brightSumSq += g * g;
    }
    var pixels = sampleW * sampleH;
    brightness /= pixels;
    var variance = brightSumSq / pixels - brightness * brightness;

    if (brightness < 32) {
      return {
        ok: false,
        hint: "Too dark — add light or aim toward the organism.",
        level: "bad",
      };
    }
    if (brightness > 248) {
      return {
        ok: false,
        hint: "Too bright — ease glare off the subject.",
        level: "bad",
      };
    }
    var blur = laplacianVariance(gray, sampleW, sampleH);
    if (blur < BLUR_TOO_LOW) {
      return { ok: false, hint: "Too blurry — hold still a second.", level: "bad" };
    }
    if (variance < VARIANCE_TOO_LOW) {
      return {
        ok: false,
        hint: "Looks empty — fill the dashed box with the organism or clear evidence.",
        level: "bad",
      };
    }
    var fill = subjectFillScore(gray, sampleW, sampleH);
    if (fill < FILL_TOO_LOW) {
      return {
        ok: false,
        hint: "Mostly background — move so the plant, animal, or evidence fills the box.",
        level: "bad",
      };
    }
    var edges = edgeFraction(gray, sampleW, sampleH);
    if (edges < EDGE_TOO_LOW) {
      return {
        ok: false,
        hint: "Subject looks faint — step a little closer or add light.",
        level: "bad",
      };
    }
    if (variance < VARIANCE_SOFT) {
      return {
        ok: false,
        hint: "Almost — put more of the organism inside the dashed box.",
        level: "soft",
      };
    }
    if (fill < FILL_SOFT) {
      return {
        ok: false,
        hint: "Aim so more of the organism fills the dashed box.",
        level: "soft",
      };
    }
    if (blur < BLUR_SOFT) {
      return { ok: false, hint: "Almost ready — hold still a moment.", level: "soft" };
    }
    if (edges < EDGE_SOFT) {
      return {
        ok: false,
        hint: "A touch closer or brighter — keep the subject in the box.",
        level: "soft",
      };
    }
    return {
      ok: true,
      hint: "Good — tap Capture & scan.",
      level: "good",
    };
  }

  function setLiveCoach(analysis) {
    if (!coachHint) return;
    if (!analysis) {
      coachHint.textContent =
        "Frame the organism (or clear evidence). Avoid faces/hands when you can.";
      if (scanStage) scanStage.className = "scan-stage";
      coachReady = false;
      if (captureBtn && stream && !busy) captureBtn.disabled = true;
      return;
    }
    coachHint.textContent = analysis.hint || "";
    if (scanStage) {
      scanStage.className = "scan-stage scan-stage--" + (analysis.level || "wait");
    }
    coachReady = !!analysis.ok;
    if (captureBtn && stream && !busy) captureBtn.disabled = !coachReady;
  }

  function stopLiveCoach() {
    if (coachTimer) {
      clearInterval(coachTimer);
      coachTimer = null;
    }
    coachReady = false;
  }

  function tickLiveCoach() {
    if (!video || !stream || busy) return;
    try {
      setLiveCoach(analyzeOrganismFrame(video));
    } catch (e) {
      setLiveCoach({
        ok: false,
        hint: "Point the camera at the organism or clear evidence.",
        level: "wait",
      });
    }
  }

  function startLiveCoach() {
    stopLiveCoach();
    tickLiveCoach();
    coachTimer = setInterval(tickLiveCoach, LIVE_COACH_MS);
  }

  function stopCamera() {
    stopLiveCoach();
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
    if (scanStage) scanStage.className = "scan-stage";
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
        if (stopCamBtn) stopCamBtn.hidden = false;
        startLiveCoach();
        setStatus("Camera ready. Wait for the green coach, then tap Capture & scan.");
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

  function openCodex() {
    if (!lastRecord || !lastRecord.commonName) {
      setStatus("Scan first, then open the codex.");
      return;
    }
    if (redirectTimer) {
      clearTimeout(redirectTimer);
      redirectTimer = null;
    }
    saveRecord(lastRecord);
    window.location.href = codexUrl(lastRecord);
  }

  function showResult(data) {
    lastRecord = {
      displayName: data.displayName || data.commonName || "",
      commonName: data.commonName || "",
      latinName: data.latinName || "",
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
    saveRecord(lastRecord);

    if (resultName) {
      resultName.textContent =
        lastRecord.displayName || lastRecord.commonName || "Unknown";
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
      "Got it: " +
        (lastRecord.displayName || lastRecord.commonName) +
        ". Opening wildlife codex in a moment…"
    );
    redirectTimer = setTimeout(openCodex, 1200);
  }

  function onCapture() {
    if (busy) {
      setStatus("Still scanning… please wait (often 10–20 seconds). One tap is enough.");
      return;
    }
    var check = analyzeOrganismFrame(video);
    setLiveCoach(check);
    if (!check.ok) {
      setStatus(check.hint || "Frame the organism first, then scan.");
      return;
    }
    busy = true;
    if (captureBtn) captureBtn.disabled = true;
    if (resultBox) resultBox.hidden = true;
    if (redirectTimer) {
      clearTimeout(redirectTimer);
      redirectTimer = null;
    }
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
      tickLiveCoach();
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
              throw new Error(
                "Photo too large for the server. Try again a bit farther back."
              );
            }
            throw new Error(
              "Bad response from scan API (HTTP " + res.status + "). Try again."
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
      })
      .catch(function (err) {
        clearInterval(tick);
        clearCanvas();
        setStatus("Scan failed: " + (err && err.message ? err.message : "error"));
        busy = false;
        if (stream) startLiveCoach();
        else if (captureBtn) captureBtn.disabled = true;
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
      if (redirectTimer) {
        clearTimeout(redirectTimer);
        redirectTimer = null;
      }
      if (resultBox) resultBox.hidden = true;
      lastRecord = null;
      startCamera();
    });
  }
  startCamera();
  window.addEventListener("pagehide", stopCamera);
})();
