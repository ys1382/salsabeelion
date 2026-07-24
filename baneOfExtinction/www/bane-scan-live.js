(function () {
  "use strict";

  var API = "/bane-of-extinction/api/wildlife-identify";
  var API_STILL = "/bane-of-extinction/api/codex-still";
  var STORAGE_KEY = "bane_last_id";
  var STILL_KEY = "bane_last_still";
  var ASSET_V = "20260722live";
  var LIVE_COACH_MS = 350;
  var BLUR_TOO_LOW = 36;
  var BLUR_SOFT = 55;
  var EDGE_TOO_LOW = 0.014;
  var EDGE_SOFT = 0.022;
  var FILL_TOO_LOW = 0.12;
  var FILL_SOFT = 0.16;
  var VARIANCE_TOO_LOW = 180;
  var VARIANCE_SOFT = 260;
  var IDENTIFY_TIMEOUT_MS = 90000;
  var STILL_TIMEOUT_MS = 70000;
  var DRIVE_BURST_FRAMES = 5;
  var MODE_DRIVE_KEY = "bane_ecolens_drive_v1";
  var MODE_NIGHT_KEY = "bane_ecolens_night_v1";
  var MODE_CAMO_KEY = "bane_ecolens_camo_v1";
  var ASSISTS_OPEN_KEY = "bane_ecolens_assists_open_v1";

  var desktopBlock = document.getElementById("desktopBlock");
  var scanUi = document.getElementById("scanUi");
  var scanStage = document.querySelector(".scan-stage");
  var video = document.getElementById("scanVideo");
  var canvas = document.getElementById("scanCanvas");
  var captureBtn = document.getElementById("captureBtn");
  var stopCamBtn = document.getElementById("stopCamBtn");
  var statusEl = document.getElementById("scanStatus");
  var waitWisdomEl = document.getElementById("waitWisdom");
  var waitWisdomText = document.getElementById("waitWisdomText");
  var coachHint = document.getElementById("coachHint");
  var ecolensAssists = document.getElementById("ecolensAssists");
  var assistsSummary = document.getElementById("assistsSummary");
  var modeDriveEl = document.getElementById("modeDrive");
  var modeNightEl = document.getElementById("modeNight");
  var modeCamoEl = document.getElementById("modeCamo");
  var modeNoteEl = document.getElementById("modeNote");
  var resultBox = document.getElementById("scanResult");
  var resultHeading = document.getElementById("resultHeading");
  var resultName = document.getElementById("resultName");
  var resultLatin = document.getElementById("resultLatin");
  var resultMeta = document.getElementById("resultMeta");
  var confirmActions = document.getElementById("confirmActions");
  var learnedActions = document.getElementById("learnedActions");
  var confirmRightBtn = document.getElementById("confirmRightBtn");
  var notThisBtn = document.getElementById("notThisBtn");
  var googleThisBtn = document.getElementById("googleThisBtn");
  var openCodexBtn = document.getElementById("openCodexBtn");
  var rescanBtn = document.getElementById("rescanBtn");
  var rescanAfterBtn = document.getElementById("rescanAfterBtn");
  var stream = null;
  var busy = false;
  var lastRecord = null;
  var redirectTimer = null;
  /** Raw capture kept in memory only until confirm / dry / leave — never disk. */
  var pendingPhoto = null;
  var altQueue = [];
  var rejectedNames = [];
  var idRounds = 0;
  var MAX_ID_ROUNDS = 3;
  var PHOTO_IDLE_MS = 10 * 60 * 1000;
  var photoIdleTimer = null;
  var awaitingConfirm = false;
  var waitWisdomTimer = null;
  var waitWisdomQueue = [];
  var WAIT_WISDOM_MS = 7500;
  /** Generic wait-screen wisdom — not species facts. Three vibes: justice, small help, systems+agency. */
  var WAIT_WISDOM = [
    "If an “eco-friendly” product ignores human rights, it isn’t environmentally friendly. Oppression won’t build a sustainable world.",
    "Green labels mean little when workers or communities are harmed to make the product.",
    "A little help every day still counts — even when the big systems feel stuck.",
    "Tiny steady habits add up. They don’t replace systemic change; they sit beside it.",
    "Needing staples in plastic isn’t your fault. Refuse the extras when you can.",
    "Companies choose the wrap. You can still cut waste where a real choice exists.",
    "If they won’t change the packaging, boycott is the louder step after everyday refuse.",
    "The onus is on companies to offer unpackaged options. Your refuse and boycott still push them.",
  ];
  var coachTimer = null;
  var coachReady = false;
  var lastCoachLevel = "wait";
  var viewZoom = 1;
  var ZOOM_MIN = 1;
  var ZOOM_MAX = 4;
  var hwZoomSupported = false;
  var hwZoomMin = 1;
  var hwZoomMax = 1;
  var videoTrack = null;
  var pinchStartDist = 0;
  var pinchStartZoom = 1;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function shuffleCopy(list) {
    var out = list.slice();
    var i;
    for (i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function showNextWaitWisdom() {
    if (!waitWisdomText) return;
    if (!waitWisdomQueue.length) {
      waitWisdomQueue = shuffleCopy(WAIT_WISDOM);
    }
    waitWisdomText.textContent = waitWisdomQueue.shift() || "";
  }

  function startWaitWisdom() {
    if (!waitWisdomEl || !waitWisdomText) return;
    if (waitWisdomTimer) return;
    waitWisdomEl.hidden = false;
    showNextWaitWisdom();
    waitWisdomTimer = setInterval(showNextWaitWisdom, WAIT_WISDOM_MS);
  }

  function stopWaitWisdom() {
    if (waitWisdomTimer) {
      clearInterval(waitWisdomTimer);
      waitWisdomTimer = null;
    }
    if (waitWisdomEl) waitWisdomEl.hidden = true;
    if (waitWisdomText) waitWisdomText.textContent = "";
  }

  function nameKey(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function wipePendingPhoto(reason) {
    if (pendingPhoto) {
      pendingPhoto.imageBase64 = "";
      pendingPhoto = null;
    }
    if (photoIdleTimer) {
      clearTimeout(photoIdleTimer);
      photoIdleTimer = null;
    }
    clearCanvas();
    hideFreezeFrame();
    if (reason) {
      try {
        console.info("bane_scan wipe_photo", reason);
      } catch (e) {}
    }
  }

  function armPhotoIdleWipe() {
    if (photoIdleTimer) clearTimeout(photoIdleTimer);
    photoIdleTimer = setTimeout(function () {
      if (!pendingPhoto) return;
      wipePendingPhoto("idle_timeout");
      awaitingConfirm = false;
      altQueue = [];
      rejectedNames = [];
      idRounds = 0;
      if (resultBox) resultBox.hidden = true;
      setStatus(
        "Photo cleared after sitting too long (not stored). Scan again when ready."
      );
      stopWaitWisdom();
      startCamera();
    }, PHOTO_IDLE_MS);
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

  function clearStill() {
    try {
      sessionStorage.removeItem(STILL_KEY);
    } catch (e) {}
    try {
      localStorage.removeItem(STILL_KEY);
    } catch (e2) {}
  }

  function saveStill(still) {
    if (!still || !still.imageBase64) {
      clearStill();
      return false;
    }
    var packed = JSON.stringify({
      mimeType: still.mimeType || "image/png",
      imageBase64: still.imageBase64,
      commonName: still.commonName || "",
      latinName: still.latinName || "",
      cultivar: still.cultivar || "",
      matched: !!still.matched,
      savedAt: Date.now(),
    });
    var ok = false;
    try {
      sessionStorage.setItem(STILL_KEY, packed);
      ok = true;
    } catch (e) {}
    try {
      localStorage.setItem(STILL_KEY, packed);
      ok = true;
    } catch (e2) {}
    return ok;
  }

  /** Shrink a data-URL still for phone storage (async). */
  function shrinkStillForPhone(still) {
    return new Promise(function (resolve) {
      if (!still || !still.imageBase64) {
        resolve(null);
        return;
      }
      var mime = still.mimeType || "image/png";
      var src = "data:" + mime + ";base64," + still.imageBase64;
      var img = new Image();
      img.onload = function () {
        try {
          var maxEdge = 640;
          var scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          var ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          var out = c.toDataURL("image/jpeg", 0.82);
          var m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(out);
          if (!m) {
            resolve(still);
            return;
          }
          resolve({
            mimeType: m[1],
            imageBase64: m[2],
            matched: still.matched,
            commonName: still.commonName,
            latinName: still.latinName,
            cultivar: still.cultivar,
          });
        } catch (e) {
          resolve(still);
        }
      };
      img.onerror = function () {
        resolve(still);
      };
      img.src = src;
    });
  }

  function codexUrl(record) {
    var q = new URLSearchParams();
    q.set("from", "scan");
    q.set("v", ASSET_V);
    if (record.commonName) q.set("common", record.commonName);
    if (record.displayName) q.set("display", record.displayName);
    if (record.latinName) q.set("latin", record.latinName);
    if (record.cultivar) q.set("cultivar", record.cultivar);
    if (record.bloomColor) q.set("color", record.bloomColor);
    if (record.organismType) q.set("type", record.organismType);
    if (record.confidence) q.set("conf", record.confidence);
    if (record.evidence) q.set("evidence", "1");
    if (record.shortNote) q.set("note", String(record.shortNote).slice(0, 160));
    if (record.stillToken) q.set("still", record.stillToken);
    if (record.lifeStage) q.set("stage", record.lifeStage);
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

  function softZoomFactor() {
    return hwZoomSupported ? 1 : viewZoom;
  }

  function modeFlags() {
    return {
      drive: !!(modeDriveEl && modeDriveEl.checked),
      night: !!(modeNightEl && modeNightEl.checked),
      camo: !!(modeCamoEl && modeCamoEl.checked),
    };
  }

  function coachThresholds() {
    var m = modeFlags();
    var t = {
      blurTooLow: BLUR_TOO_LOW,
      blurSoft: BLUR_SOFT,
      edgeTooLow: EDGE_TOO_LOW,
      edgeSoft: EDGE_SOFT,
      fillTooLow: FILL_TOO_LOW,
      fillSoft: FILL_SOFT,
      varianceTooLow: VARIANCE_TOO_LOW,
      varianceSoft: VARIANCE_SOFT,
      brightnessLow: 32,
    };
    if (m.drive) {
      t.blurTooLow = 12;
      t.blurSoft = 26;
      t.fillTooLow = 0.08;
      t.fillSoft = 0.12;
      t.varianceTooLow = 110;
      t.varianceSoft = 170;
    }
    if (m.night) {
      t.brightnessLow = 8;
      t.edgeTooLow *= 0.55;
      t.edgeSoft *= 0.6;
      t.varianceTooLow *= 0.65;
      t.varianceSoft *= 0.7;
    }
    if (m.camo) {
      t.fillTooLow = Math.min(t.fillTooLow, 0.05);
      t.fillSoft = Math.min(t.fillSoft, 0.09);
      t.varianceTooLow = Math.min(t.varianceTooLow, 70);
      t.varianceSoft = Math.min(t.varianceSoft, 110);
      t.edgeTooLow = Math.min(t.edgeTooLow, 0.006);
      t.edgeSoft = Math.min(t.edgeSoft, 0.012);
    }
    return t;
  }

  function applyStageClass(level) {
    if (!scanStage) return;
    var m = modeFlags();
    var cls = "scan-stage";
    if (level) cls += " scan-stage--" + level;
    if (m.drive) cls += " scan-stage--drive";
    if (m.night) cls += " scan-stage--night";
    if (m.camo) cls += " scan-stage--camo";
    scanStage.className = cls;
  }

  function updateModeNote() {
    if (!modeNoteEl) return;
    var m = modeFlags();
    var bits = [];
    if (m.drive) {
      bits.push(
        "Drive: picks the sharpest of a short burst. Fast blur past a window can still fail."
      );
    }
    if (m.night) {
      bits.push(
        "Night vision: digital boost only — no flash. Needs a little ambient light; pitch black stays noisy."
      );
    }
    if (m.camo) {
      bits.push(
        "Camouflage: boosts contrast so you can spot cryptic finds. ID may still miss a well-hidden animal."
      );
    }
    if (!bits.length) {
      modeNoteEl.hidden = true;
      modeNoteEl.textContent = "";
      return;
    }
    modeNoteEl.hidden = false;
    modeNoteEl.textContent = bits.join(" ");
  }

  function updateAssistsSummary() {
    var m = modeFlags();
    var labels = [];
    if (m.drive) labels.push("Drive");
    if (m.night) labels.push("Night");
    if (m.camo) labels.push("Camo");
    if (assistsSummary) {
      assistsSummary.textContent = labels.length ? labels.join(" · ") : "Off";
    }
    if (ecolensAssists) {
      ecolensAssists.classList.toggle("ecolens-assists--active", labels.length > 0);
    }
  }

  function setAssistsOpen(open) {
    if (!ecolensAssists) return;
    var next = !!open;
    // Native <details> — browser handles show/hide; we only sync open + memory.
    if (next) ecolensAssists.setAttribute("open", "");
    else ecolensAssists.removeAttribute("open");
    try {
      if (next) localStorage.setItem(ASSISTS_OPEN_KEY, "1");
      else localStorage.removeItem(ASSISTS_OPEN_KEY);
    } catch (e) {}
  }

  function syncAssistsOpenFromPref() {
    // Default closed so Drive / Night / Camo start collapsed.
    var open = false;
    try {
      open = localStorage.getItem(ASSISTS_OPEN_KEY) === "1";
    } catch (e) {}
    setAssistsOpen(open);
  }

  function bindAssistsToggle() {
    if (!ecolensAssists) return;
    ecolensAssists.addEventListener("toggle", function () {
      try {
        if (ecolensAssists.open) localStorage.setItem(ASSISTS_OPEN_KEY, "1");
        else localStorage.removeItem(ASSISTS_OPEN_KEY);
      } catch (e) {}
    });
  }

  function readModePref(key) {
    try {
      return localStorage.getItem(key) === "1";
    } catch (e) {
      return false;
    }
  }

  function writeModePref(key, on) {
    try {
      if (on) localStorage.setItem(key, "1");
      else localStorage.removeItem(key);
    } catch (e) {}
  }

  function syncModeUiFromPrefs() {
    if (modeDriveEl) modeDriveEl.checked = readModePref(MODE_DRIVE_KEY);
    if (modeNightEl) modeNightEl.checked = readModePref(MODE_NIGHT_KEY);
    if (modeCamoEl) modeCamoEl.checked = readModePref(MODE_CAMO_KEY);
    updateModeNote();
    updateAssistsSummary();
    applyStageClass(lastCoachLevel || "wait");
  }

  function onModeChange() {
    writeModePref(MODE_DRIVE_KEY, !!(modeDriveEl && modeDriveEl.checked));
    writeModePref(MODE_NIGHT_KEY, !!(modeNightEl && modeNightEl.checked));
    writeModePref(MODE_CAMO_KEY, !!(modeCamoEl && modeCamoEl.checked));
    updateModeNote();
    updateAssistsSummary();
    applyStageClass(lastCoachLevel || "wait");
    if (stream && !busy) tickLiveCoach();
  }

  function videoCropRect(vw, vh) {
    var z = softZoomFactor();
    if (!(z > 1.01)) {
      return { sx: 0, sy: 0, sw: vw, sh: vh };
    }
    var sw = vw / z;
    var sh = vh / z;
    return {
      sx: (vw - sw) / 2,
      sy: (vh - sh) / 2,
      sw: sw,
      sh: sh,
    };
  }

  function applyZoomVisual() {
    if (!video) return;
    if (hwZoomSupported) {
      video.style.transform = "";
    } else {
      video.style.transform = "scale(" + viewZoom + ")";
    }
  }

  function mapSoftToHardwareZoom(soft) {
    if (!hwZoomSupported) return soft;
    var t = (soft - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return hwZoomMin + t * (hwZoomMax - hwZoomMin);
  }

  function setZoom(z) {
    var next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    viewZoom = next;
    if (hwZoomSupported && videoTrack) {
      var hwZ = mapSoftToHardwareZoom(next);
      var tryHw = function (constraints) {
        return videoTrack.applyConstraints(constraints);
      };
      tryHw({ advanced: [{ zoom: hwZ }] })
        .catch(function () {
          return tryHw({ zoom: hwZ });
        })
        .catch(function () {
          hwZoomSupported = false;
          applyZoomVisual();
        });
    }
    applyZoomVisual();
  }

  function initZoomFromTrack() {
    videoTrack = null;
    hwZoomSupported = false;
    hwZoomMin = 1;
    hwZoomMax = 1;
    viewZoom = 1;
    if (stream) {
      var tracks = stream.getVideoTracks();
      videoTrack = tracks && tracks[0] ? tracks[0] : null;
    }
    if (videoTrack && typeof videoTrack.getCapabilities === "function") {
      try {
        var caps = videoTrack.getCapabilities();
        if (caps && caps.zoom && caps.zoom.max > caps.zoom.min) {
          hwZoomSupported = true;
          hwZoomMin = caps.zoom.min;
          hwZoomMax = caps.zoom.max;
        }
      } catch (e) {}
    }
    applyZoomVisual();
  }

  function touchDistance(a, b) {
    var dx = a.clientX - b.clientX;
    var dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function bindPinchZoom() {
    if (!scanStage) return;
    scanStage.addEventListener(
      "touchstart",
      function (e) {
        if (busy || !stream) return;
        if (e.touches.length === 2) {
          e.preventDefault();
          pinchStartDist = touchDistance(e.touches[0], e.touches[1]);
          pinchStartZoom = viewZoom;
        }
      },
      { passive: false }
    );
    scanStage.addEventListener(
      "touchmove",
      function (e) {
        if (busy || !stream) return;
        if (e.touches.length === 2 && pinchStartDist > 0) {
          e.preventDefault();
          var d = touchDistance(e.touches[0], e.touches[1]);
          if (d > 0) setZoom(pinchStartZoom * (d / pinchStartDist));
        }
      },
      { passive: false }
    );
    scanStage.addEventListener("touchend", function (e) {
      if (e.touches.length < 2) pinchStartDist = 0;
    });
    scanStage.addEventListener("touchcancel", function () {
      pinchStartDist = 0;
    });
  }

  function analyzeOrganismFrame(vid) {
    if (!vid || !vid.videoWidth) {
      return { ok: false, hint: "Starting camera…", level: "wait" };
    }
    var vw = vid.videoWidth;
    var vh = vid.videoHeight;
    var crop = videoCropRect(vw, vh);
    var sampleW = 320;
    var sampleH = Math.max(1, Math.round((crop.sh / crop.sw) * sampleW));
    var sample = document.createElement("canvas");
    sample.width = sampleW;
    sample.height = sampleH;
    var ctx = sample.getContext("2d");
    // Match the dashed guide box (~10% / 12% inset) inside the zoomed view.
    var insetX = Math.round(crop.sw * 0.1);
    var insetY = Math.round(crop.sh * 0.12);
    var sw = Math.max(1, crop.sw - insetX * 2);
    var sh = Math.max(1, crop.sh - insetY * 2);
    ctx.drawImage(
      vid,
      crop.sx + insetX,
      crop.sy + insetY,
      sw,
      sh,
      0,
      0,
      sampleW,
      sampleH
    );
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
    var m = modeFlags();
    var th = coachThresholds();

    if (brightness < th.brightnessLow) {
      return {
        ok: false,
        hint: m.night
          ? "Still too dark for night vision — need a little ambient light (no flash)."
          : "Too dark — try Night vision, or move toward ambient light (no flash).",
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
    if (blur < th.blurTooLow) {
      return {
        ok: false,
        hint: m.drive
          ? "Still too smeared — slow a touch or wait for a steadier moment."
          : "Too blurry — hold still a second.",
        level: "bad",
      };
    }
    if (variance < th.varianceTooLow) {
      return {
        ok: false,
        hint: m.camo
          ? "Looks empty even with camouflage assist — fill the box with a find (living, evidence, rock, mineral, empty shell, or outdoor object like plastic/asphalt)."
          : "Looks empty — fill the dashed box with a find (living, evidence, rock, mineral, empty shell, or outdoor object like plastic/asphalt).",
        level: "bad",
      };
    }
    var fill = subjectFillScore(gray, sampleW, sampleH);
    if (fill < th.fillTooLow) {
      return {
        ok: false,
        hint: "Mostly background — move so the plant, animal, evidence, rock, empty shell, or outdoor object fills the box.",
        level: "bad",
      };
    }
    var edges = edgeFraction(gray, sampleW, sampleH);
    if (edges < th.edgeTooLow) {
      return {
        ok: false,
        hint: m.camo
          ? "Still too faint — try Camouflage framing closer, or scan clear evidence."
          : m.night
            ? "Subject looks faint — night vision needs a bit more ambient light or closer framing."
            : "Subject looks faint — step a little closer or find better light.",
        level: "bad",
      };
    }
    if (variance < th.varianceSoft) {
      return {
        ok: false,
        hint: "Almost — put more of the nature find inside the dashed box.",
        level: "soft",
      };
    }
    if (fill < th.fillSoft) {
      return {
        ok: false,
        hint: "Aim so more of the nature find fills the dashed box.",
        level: "soft",
      };
    }
    if (blur < th.blurSoft) {
      return {
        ok: false,
        hint: m.drive
          ? "Almost — Drive will grab a burst; hold as steady as you can."
          : "Almost ready — hold still a moment.",
        level: "soft",
      };
    }
    if (edges < th.edgeSoft) {
      return {
        ok: false,
        hint: m.camo
          ? "A touch closer — keep the cryptic subject in the box."
          : "A touch closer or brighter — keep the subject in the box.",
        level: "soft",
      };
    }
    var goodHint = "Good — tap Capture & scan.";
    if (m.drive) goodHint = "Good — Drive will pick the sharpest burst frame.";
    else if (viewZoom > 1.05) goodHint = "Good — tap Capture & scan. (Pinch to adjust zoom)";
    else goodHint = "Good — tap Capture & scan. Pinch to zoom if needed.";
    if (m.night) goodHint += " Night vision on.";
    if (m.camo) goodHint += " Camouflage assist on.";
    return {
      ok: true,
      hint: goodHint,
      level: "good",
    };
  }

  function setLiveCoach(analysis) {
    if (!coachHint) return;
    if (!analysis) {
      coachHint.textContent =
        "Frame a find (living neighbor, evidence, rock, mineral, empty shell, or outdoor object like plastic/asphalt). Avoid faces/hands when you can.";
      lastCoachLevel = "wait";
      applyStageClass("wait");
      coachReady = false;
      if (captureBtn && stream && !busy) captureBtn.disabled = true;
      return;
    }
    coachHint.textContent = analysis.hint || "";
    lastCoachLevel = analysis.level || "wait";
    applyStageClass(lastCoachLevel);
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
        hint: "Point the camera at a find (living, evidence, rock, mineral, empty shell, or outdoor object like plastic/asphalt).",
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
    pinchStartDist = 0;
    if (stream) {
      stream.getTracks().forEach(function (t) {
        try {
          t.stop();
        } catch (e) {}
      });
      stream = null;
    }
    videoTrack = null;
    hwZoomSupported = false;
    viewZoom = 1;
    if (video) {
      video.srcObject = null;
      video.style.transform = "";
    }
    if (captureBtn) captureBtn.disabled = true;
    if (stopCamBtn) stopCamBtn.hidden = true;
    if (scanStage && !busy) applyStageClass("wait");
  }

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("This browser cannot open the camera.");
      return;
    }
    hideFreezeFrame();
    clearCanvas();
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
        initZoomFromTrack();
        return video.play();
      })
      .then(function () {
        if (stopCamBtn) stopCamBtn.hidden = false;
        startLiveCoach();
        setStatus(
          "Camera ready. Pinch to zoom in the frame, wait for green, then Capture & scan."
        );
      })
      .catch(function (err) {
        setStatus(
          "Camera permission failed: " +
            (err && err.message ? err.message : "denied or unavailable")
        );
      });
  }

  function stretchLuminanceForNight(imgData) {
    var d = imgData.data;
    var n = d.length / 4;
    var min = 255;
    var max = 0;
    var i;
    var o;
    var y;
    for (i = 0; i < n; i++) {
      o = i * 4;
      y = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
      if (y < min) min = y;
      if (y > max) max = y;
    }
    var range = Math.max(12, max - min);
    var gain = Math.min(4.2, 210 / range);
    for (i = 0; i < n; i++) {
      o = i * 4;
      d[o] = Math.max(0, Math.min(255, (d[o] - min) * gain));
      d[o + 1] = Math.max(0, Math.min(255, (d[o + 1] - min) * gain));
      d[o + 2] = Math.max(0, Math.min(255, (d[o + 2] - min) * gain));
    }
  }

  function boostContrastForCamo(imgData) {
    var d = imgData.data;
    var mid = 128;
    var factor = 1.35;
    for (var i = 0; i < d.length; i += 4) {
      d[i] = Math.max(0, Math.min(255, mid + (d[i] - mid) * factor));
      d[i + 1] = Math.max(0, Math.min(255, mid + (d[i + 1] - mid) * factor));
      d[i + 2] = Math.max(0, Math.min(255, mid + (d[i + 2] - mid) * factor));
    }
  }

  function scoreDrawnFrameBlur(ctx, w, h) {
    var sampleW = Math.min(320, w);
    var sampleH = Math.max(1, Math.round((h / w) * sampleW));
    var sample = document.createElement("canvas");
    sample.width = sampleW;
    sample.height = sampleH;
    var sctx = sample.getContext("2d");
    sctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, sampleW, sampleH);
    var img = sctx.getImageData(0, 0, sampleW, sampleH);
    var d = img.data;
    var gray = new Float32Array(sampleW * sampleH);
    for (var i = 0; i < sampleW * sampleH; i++) {
      var o = i * 4;
      gray[i] = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
    }
    return laplacianVariance(gray, sampleW, sampleH);
  }

  function drawCaptureToCanvas() {
    if (!video || !canvas || !video.videoWidth) {
      throw new Error("Camera not ready");
    }
    var maxEdge = 1400;
    var vw = video.videoWidth;
    var vh = video.videoHeight;
    var crop = videoCropRect(vw, vh);
    var scale = Math.min(1, maxEdge / Math.max(crop.sw, crop.sh));
    var w = Math.max(1, Math.round(crop.sw * scale));
    var h = Math.max(1, Math.round(crop.sh * scale));
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(
      video,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      w,
      h
    );
    var modes = modeFlags();
    if (modes.night || modes.camo) {
      var img = ctx.getImageData(0, 0, w, h);
      if (modes.night) stretchLuminanceForNight(img);
      if (modes.camo) boostContrastForCamo(img);
      ctx.putImageData(img, 0, 0);
    }
    return { ctx: ctx, w: w, h: h, blur: scoreDrawnFrameBlur(ctx, w, h) };
  }

  function encodeCanvasFrame() {
    var dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    var m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
    if (!m) throw new Error("Could not encode frame");
    return { mimeType: m[1], imageBase64: m[2] };
  }

  function captureFrame() {
    drawCaptureToCanvas();
    return encodeCanvasFrame();
  }

  function waitTwoFrames() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
  }

  function captureBestBurst() {
    var modes = modeFlags();
    var count = modes.drive ? DRIVE_BURST_FRAMES : 1;
    var bestBlur = -1;
    var bestPayload = null;
    var bestImage = null;
    var i = 0;

    function takeNext() {
      var drawn = drawCaptureToCanvas();
      if (drawn.blur >= bestBlur) {
        bestBlur = drawn.blur;
        bestPayload = encodeCanvasFrame();
        bestImage = drawn.ctx.getImageData(0, 0, drawn.w, drawn.h);
      }
      i += 1;
      if (i >= count) {
        if (bestImage && canvas) {
          canvas.width = bestImage.width;
          canvas.height = bestImage.height;
          canvas.getContext("2d").putImageData(bestImage, 0, 0);
        }
        return Promise.resolve(bestPayload);
      }
      return waitTwoFrames().then(takeNext);
    }

    return takeNext();
  }

  function clearCanvas() {
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 1;
    canvas.height = 1;
  }

  function hideFreezeFrame() {
    if (canvas) {
      canvas.hidden = true;
      canvas.classList.remove("scan-stage__freeze");
    }
    if (video) video.style.visibility = "";
    applyStageClass(lastCoachLevel || "wait");
  }

  function showFreezeFrame() {
    if (!canvas) return;
    canvas.classList.add("scan-stage__freeze");
    canvas.hidden = false;
    if (video) video.style.visibility = "hidden";
    if (scanStage) {
      applyStageClass("processing");
    }
    if (coachHint) {
      coachHint.textContent =
        "Photo captured — camera off. Identifying & making codex art…";
    }
  }

  function openCodex() {
    if (!lastRecord || !lastRecord.commonName) {
      setStatus("Confirm a guess first, then open the codex.");
      return;
    }
    if (redirectTimer) {
      clearTimeout(redirectTimer);
      redirectTimer = null;
    }
    wipePendingPhoto("open_codex");
    saveRecord(lastRecord);
    window.location.href = codexUrl(lastRecord);
  }

  function googleThisGuess() {
    var common =
      (lastRecord && (lastRecord.displayName || lastRecord.commonName)) || "";
    var latin = (lastRecord && lastRecord.latinName) || "";
    var q = (common + " " + latin).trim();
    if (!q) {
      setStatus("No name to search yet.");
      return;
    }
    var url =
      "https://www.google.com/search?q=" + encodeURIComponent(q);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function recordFromIdData(data) {
    return {
      displayName: data.displayName || data.commonName || "",
      commonName: data.commonName || "",
      latinName: data.latinName || "",
      cultivar: data.cultivar || "",
      bloomColor: data.bloomColor || "",
      evidence: !!data.evidence,
      organismType: data.organismType || "flower",
      lifeStage: data.lifeStage || "",
      confidence: data.confidence || "",
      shortNote: data.shortNote || "",
      stillToken: data.stillToken || "",
      hasStill: false,
      geminiName:
        data.sources && data.sources.gemini
          ? data.sources.gemini.commonName
          : "",
      claudeName:
        data.sources && data.sources.claude
          ? data.sources.claude.commonName
          : "",
    };
  }

  function buildAltQueue(data, currentCommon) {
    var cur = nameKey(currentCommon);
    var seen = {};
    if (cur) seen[cur] = true;
    rejectedNames.forEach(function (n) {
      var k = nameKey(n);
      if (k) seen[k] = true;
    });
    var out = [];
    (data.alternatives || []).forEach(function (item) {
      if (!item || typeof item !== "object") return;
      var c = String(item.commonName || "").trim();
      if (!c) return;
      var k = nameKey(c);
      if (seen[k]) return;
      seen[k] = true;
      out.push({
        commonName: c,
        latinName: String(item.latinName || "").trim(),
        displayName: c,
        cultivar: "",
        bloomColor: data.bloomColor || "",
        evidence: !!data.evidence,
        organismType: data.organismType || "other",
        lifeStage: data.lifeStage || "",
        confidence: "low",
        shortNote: "Another possible match.",
        alternatives: [],
      });
    });
    return out;
  }

  function setConfirmUi(mode) {
    // mode: "confirm" | "learned"
    if (confirmActions) confirmActions.hidden = mode !== "confirm";
    if (learnedActions) learnedActions.hidden = mode !== "learned";
    if (resultHeading) {
      resultHeading.textContent =
        mode === "learned" ? "Learned" : "Is this your find?";
    }
  }

  function showConfirmGuess(data) {
    lastRecord = recordFromIdData(data);
    altQueue = buildAltQueue(data, lastRecord.commonName);
    awaitingConfirm = true;
    armPhotoIdleWipe();
    setConfirmUi("confirm");
    if (resultName) {
      resultName.textContent =
        lastRecord.displayName || lastRecord.commonName || "Unknown";
    }
    if (resultLatin) resultLatin.textContent = lastRecord.latinName || "—";
    if (resultMeta) {
      var bits = [];
      if (lastRecord.confidence) bits.push("confidence: " + lastRecord.confidence);
      if (lastRecord.lifeStage) bits.push("stage: " + lastRecord.lifeStage);
      if (data.alreadyLearned) bits.push("already on your shelf");
      if (lastRecord.bloomColor) bits.push("color: " + lastRecord.bloomColor);
      if (altQueue.length) {
        bits.push(altQueue.length + " other guess" + (altQueue.length === 1 ? "" : "es") + " ready");
      }
      bits.push("photo held until you confirm (not saved)");
      if (lastRecord.shortNote) bits.push(lastRecord.shortNote);
      resultMeta.textContent = bits.join(" · ");
    }
    if (resultBox) resultBox.hidden = false;
    setStatus(
      "Is this " +
        (lastRecord.displayName || lastRecord.commonName) +
        "? Confirm, try another guess, or Google it."
    );
    if (coachHint) {
      coachHint.textContent =
        "Check the name. This looks right keeps it; Not this tries another guess. Photo clears when you leave.";
    }
    if (confirmRightBtn) confirmRightBtn.disabled = false;
    if (notThisBtn) notThisBtn.disabled = false;
    if (googleThisBtn) googleThisBtn.disabled = false;
  }

  function learnAndFinish(stillPayload) {
    awaitingConfirm = false;
    setConfirmUi("learned");

    function finishLearn(stillToSave) {
      if (window.BaneCodexCollection && lastRecord.commonName) {
        window.BaneCodexCollection.upsert(
          lastRecord,
          stillToSave && stillToSave.imageBase64
            ? {
                mimeType: stillToSave.mimeType || "image/jpeg",
                imageBase64: stillToSave.imageBase64,
              }
            : null
        );
        if (window.BaneCodexCollection.syncNow) {
          window.BaneCodexCollection.syncNow().catch(function () {});
        }
      }
      wipePendingPhoto("confirmed");
      saveRecord(lastRecord);
      if (resultName) {
        resultName.textContent =
          lastRecord.displayName || lastRecord.commonName || "Unknown";
      }
      if (resultLatin) resultLatin.textContent = lastRecord.latinName || "—";
      if (resultMeta) {
        var bits = [];
        if (lastRecord.confidence) bits.push("confidence: " + lastRecord.confidence);
        if (lastRecord.lifeStage) bits.push("stage: " + lastRecord.lifeStage);
        if (lastRecord.bloomColor) bits.push("color: " + lastRecord.bloomColor);
        if (lastRecord.hasStill) bits.push("codex art ready");
        else bits.push("codex art unavailable — facts still match ID");
        if (lastRecord.shortNote) bits.push(lastRecord.shortNote);
        resultMeta.textContent = bits.join(" · ");
      }
      if (resultBox) resultBox.hidden = false;
      setStatus(
        "Learned: " +
          (lastRecord.displayName || lastRecord.commonName) +
          (lastRecord.hasStill ? " + matching art" : "") +
          ". Photo wiped. Opening wildlife codex…"
      );
      redirectTimer = setTimeout(openCodex, 700);
    }

    if (stillPayload && stillPayload.imageBase64) {
      shrinkStillForPhone({
        mimeType: stillPayload.mimeType || "image/jpeg",
        imageBase64: stillPayload.imageBase64,
        commonName: lastRecord.commonName,
        latinName: lastRecord.latinName,
        cultivar: lastRecord.cultivar,
        matched: true,
      }).then(finishLearn);
      return;
    }
    if (stillPayload && stillPayload.url) {
      fetch(stillPayload.url, { credentials: "include" })
        .then(function (res) {
          if (!res.ok) throw new Error("still_fetch");
          return res.blob();
        })
        .then(function (blob) {
          return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onload = function () {
              var dataUrl = String(reader.result || "");
              var m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
              if (!m) {
                resolve(null);
                return;
              }
              resolve({ mimeType: m[1], imageBase64: m[2] });
            };
            reader.onerror = function () {
              resolve(null);
            };
            reader.readAsDataURL(blob);
          });
        })
        .then(function (still) {
          if (still && still.imageBase64) {
            return shrinkStillForPhone(
              Object.assign({}, still, {
                commonName: lastRecord.commonName,
                latinName: lastRecord.latinName,
                cultivar: lastRecord.cultivar,
                matched: true,
              })
            );
          }
          return null;
        })
        .then(finishLearn)
        .catch(function () {
          finishLearn(null);
        });
      return;
    }
    finishLearn(null);
  }

  function onConfirmRight() {
    if (busy || !lastRecord || !lastRecord.commonName) return;
    if (!awaitingConfirm) return;
    busy = true;
    if (confirmRightBtn) confirmRightBtn.disabled = true;
    if (notThisBtn) notThisBtn.disabled = true;
    startWaitWisdom();
    setStatus("Looks right — making matching codex art, then wiping the photo…");
    var photo = pendingPhoto;
    requestCodexStill(photo, lastRecord)
      .then(function (stillInfo) {
        if (stillInfo) {
          lastRecord.stillToken = stillInfo.token || lastRecord.stillToken || "";
          lastRecord.hasStill = !!(
            stillInfo.token ||
            stillInfo.imageBase64 ||
            stillInfo.url
          );
        }
        learnAndFinish(stillInfo || null);
      })
      .catch(function () {
        learnAndFinish(null);
      })
      .then(function () {
        stopWaitWisdom();
        busy = false;
      });
  }

  function giveUpGuesses(message) {
    wipePendingPhoto("guesses_exhausted");
    awaitingConfirm = false;
    altQueue = [];
    rejectedNames = [];
    idRounds = 0;
    lastRecord = null;
    if (resultBox) resultBox.hidden = true;
    setStatus(
      message ||
        "Ran out of guesses for this photo — photo wiped (never stored). Try a clearer scan."
    );
    stopWaitWisdom();
    if (coachHint) {
      coachHint.textContent =
        "Frame the organism again when ready. Nothing from that photo was kept.";
    }
    busy = false;
    startCamera();
  }

  function applyNextGuess(data) {
    showConfirmGuess(data);
    busy = false;
  }

  function onNotThis() {
    if (busy || !awaitingConfirm || !lastRecord) return;
    var wrong =
      lastRecord.displayName || lastRecord.commonName || "";
    if (wrong) {
      var k = nameKey(wrong);
      var already = rejectedNames.some(function (n) {
        return nameKey(n) === k;
      });
      if (!already) rejectedNames.push(wrong);
    }

    while (altQueue.length) {
      var next = altQueue.shift();
      if (!next || !next.commonName) continue;
      if (
        rejectedNames.some(function (n) {
          return nameKey(n) === nameKey(next.commonName);
        })
      ) {
        continue;
      }
      applyNextGuess(next);
      setStatus(
        "Trying another guess: " +
          (next.displayName || next.commonName) +
          ". Still holding the photo until you confirm."
      );
      return;
    }

    if (!pendingPhoto || !pendingPhoto.imageBase64) {
      giveUpGuesses(
        "No photo left to retry — wiped. Scan again when ready."
      );
      return;
    }
    if (idRounds >= MAX_ID_ROUNDS) {
      giveUpGuesses();
      return;
    }

    busy = true;
    if (notThisBtn) notThisBtn.disabled = true;
    if (confirmRightBtn) confirmRightBtn.disabled = true;
    startWaitWisdom();
    setStatus("Asking for a different guess (photo still in memory only)…");
    identifyWithPending()
      .then(function (data) {
        idRounds += 1;
        stopWaitWisdom();
        applyNextGuess(data);
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : "";
        if (
          (err && err.code === "guesses_exhausted") ||
          msg.indexOf("guesses_exhausted") >= 0 ||
          msg.indexOf("Ran out") >= 0
        ) {
          giveUpGuesses();
          return;
        }
        giveUpGuesses(
          "Could not find another guess — photo wiped. " + (msg || "Scan again.")
        );
      });
  }

  function identifyWithPending() {
    if (!pendingPhoto || !pendingPhoto.imageBase64) {
      return Promise.reject(new Error("photo_cleared"));
    }
    return fetchJson(
      API,
      {
        imageBase64: pendingPhoto.imageBase64,
        mimeType: pendingPhoto.mimeType || "image/jpeg",
        wantCodexStill: false,
        shelfHints: shelfHintsForIdentify(),
        rejectedNames: rejectedNames.slice(),
      },
      IDENTIFY_TIMEOUT_MS
    ).then(function (pack) {
      var data = pack.data || {};
      if (!pack.res.ok || !data.ok) {
        var err = new Error(
          (data && data.message) || (data && data.error) || "identify_failed"
        );
        err.code = data && data.error;
        throw err;
      }
      return data;
    });
  }

  function resetScanSession() {
    if (redirectTimer) {
      clearTimeout(redirectTimer);
      redirectTimer = null;
    }
    stopWaitWisdom();
    wipePendingPhoto("rescan");
    awaitingConfirm = false;
    altQueue = [];
    rejectedNames = [];
    idRounds = 0;
    lastRecord = null;
    if (resultBox) resultBox.hidden = true;
    setConfirmUi("confirm");
    startCamera();
  }

  function parseJsonResponse(res, text) {
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
    return data || {};
  }

  function fetchJson(url, bodyObj, timeoutMs) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = null;
    if (ctrl && timeoutMs > 0) {
      timer = setTimeout(function () {
        try {
          ctrl.abort();
        } catch (e) {}
      }, timeoutMs);
    }
    return fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (res) {
        return res.text().then(function (text) {
          return { res: res, data: parseJsonResponse(res, text) };
        });
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
  }

  function stillInfoFromPayload(data) {
    if (!data) return null;
    var cs = data.codexStill || null;
    if (data.stillToken || (cs && (cs.token || cs.imageBase64 || cs.url))) {
      return {
        token: data.stillToken || (cs && cs.token) || "",
        url: data.stillUrl || (cs && cs.url) || "",
        mimeType: (cs && cs.mimeType) || data.mimeType || "image/jpeg",
        imageBase64: (cs && cs.imageBase64) || data.imageBase64 || "",
      };
    }
    if (data.ok && (data.imageBase64 || data.token || data.url)) {
      return {
        token: data.token || "",
        url: data.url || "",
        mimeType: data.mimeType || "image/jpeg",
        imageBase64: data.imageBase64 || "",
      };
    }
    return null;
  }

  function requestCodexStill(payload, idData) {
    if (!idData || !idData.commonName) {
      return Promise.resolve(null);
    }
    var Col = window.BaneCodexCollection;
    if (Col && Col.existingStillFor) {
      var local = Col.existingStillFor(idData);
      if (local && local.imageBase64) {
        return Promise.resolve(local);
      }
    }
    var meta = {
      commonName: idData.commonName || "",
      latinName: idData.latinName || "",
      cultivar: idData.cultivar || "",
      organismType: idData.organismType || "",
      lifeStage: idData.lifeStage || "",
      shortNote: (
        (idData.bloomColor || "") +
        " " +
        (idData.shortNote || "")
      ).trim(),
    };
    // Shared stage library first (no photo) — one still per species+stage for everyone.
    function generateFresh() {
      if (!payload || !payload.imageBase64) return Promise.resolve(null);
      return fetchJson(
        API_STILL,
        Object.assign({}, meta, {
          imageBase64: payload.imageBase64,
          mimeType: payload.mimeType || "image/jpeg",
        }),
        STILL_TIMEOUT_MS
      )
        .then(function (genPack) {
          var gen = genPack.data || {};
          if (!genPack.res.ok || !gen.ok) return null;
          return stillInfoFromPayload(gen);
        })
        .catch(function () {
          return null;
        });
    }
    return fetchJson(
      API_STILL,
      Object.assign({}, meta, { lookupOnly: true }),
      Math.min(12000, STILL_TIMEOUT_MS)
    )
      .then(function (pack) {
        var data = pack.data || {};
        if (pack.res.ok && data.ok) {
          var hit = stillInfoFromPayload(data);
          if (hit && (hit.imageBase64 || hit.token || hit.url)) return hit;
        }
        return generateFresh();
      })
      .catch(function () {
        return generateFresh();
      });
  }

  function shelfHintsForIdentify() {
    if (!window.BaneCodexCollection || !window.BaneCodexCollection.readAll) {
      return [];
    }
    try {
      return window.BaneCodexCollection.readAll()
        .map(function (e) {
          return {
            commonName: e.commonName || e.displayName || "",
            latinName: e.latinName || "",
          };
        })
        .filter(function (e) {
          return e.commonName || e.latinName;
        })
        .slice(0, 48);
    } catch (err) {
      return [];
    }
  }

  function onCapture() {
    if (busy) {
      setStatus("Still working on your photo… please wait. One tap is enough.");
      return;
    }
    var check = analyzeOrganismFrame(video);
    setLiveCoach(check);
    if (!check.ok) {
      setStatus(check.hint || "Frame a nature find first, then scan.");
      return;
    }
    busy = true;
    if (captureBtn) captureBtn.disabled = true;
    if (resultBox) resultBox.hidden = true;
    if (redirectTimer) {
      clearTimeout(redirectTimer);
      redirectTimer = null;
    }
    wipePendingPhoto("new_capture");
    awaitingConfirm = false;
    altQueue = [];
    rejectedNames = [];
    idRounds = 0;
    lastRecord = null;
    var started = Date.now();
    startWaitWisdom();
    var tick = setInterval(function () {
      var sec = Math.round((Date.now() - started) / 1000);
      setStatus(
        "Working on your photo… " + sec + "s (identifying). Camera is off."
      );
    }, 500);
    var modes = modeFlags();
    setStatus(
      modes.drive
        ? "Grabbing a short Drive burst — picking the sharpest frame…"
        : "Photo captured — camera off. Identifying…"
    );

    captureBestBurst()
      .then(function (payload) {
        if (!payload || !payload.imageBase64) {
          throw new Error("Capture failed");
        }
        showFreezeFrame();
        stopCamera();
        // Hold raw bytes in memory only — never session/local storage.
        pendingPhoto = {
          imageBase64: payload.imageBase64,
          mimeType: payload.mimeType || "image/jpeg",
        };
        armPhotoIdleWipe();
        setStatus("Photo captured — held in memory. Identifying…");
        return identifyWithPending();
      })
      .then(function (data) {
        clearInterval(tick);
        stopWaitWisdom();
        hideFreezeFrame();
        clearCanvas();
        idRounds = 1;
        showConfirmGuess(data);
        busy = false;
        if (captureBtn) captureBtn.disabled = false;
      })
      .catch(function (err) {
        clearInterval(tick);
        stopWaitWisdom();
        wipePendingPhoto("identify_failed");
        hideFreezeFrame();
        var msg = err && err.message ? err.message : "error";
        if (err && err.name === "AbortError") {
          msg = "Scan timed out — try again with a clearer frame.";
        }
        setStatus("Scan failed: " + msg + " Photo wiped.");
        busy = false;
        if (captureBtn) captureBtn.disabled = false;
        startCamera();
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
  syncModeUiFromPrefs();
  syncAssistsOpenFromPref();
  bindAssistsToggle();
  if (modeDriveEl) modeDriveEl.addEventListener("change", onModeChange);
  if (modeNightEl) modeNightEl.addEventListener("change", onModeChange);
  if (modeCamoEl) modeCamoEl.addEventListener("change", onModeChange);
  bindPinchZoom();
  if (captureBtn) captureBtn.addEventListener("click", onCapture);
  if (stopCamBtn) stopCamBtn.addEventListener("click", stopCamera);
  if (confirmRightBtn) confirmRightBtn.addEventListener("click", onConfirmRight);
  if (notThisBtn) notThisBtn.addEventListener("click", onNotThis);
  if (googleThisBtn) googleThisBtn.addEventListener("click", googleThisGuess);
  if (openCodexBtn) openCodexBtn.addEventListener("click", openCodex);
  if (rescanBtn) rescanBtn.addEventListener("click", resetScanSession);
  if (rescanAfterBtn) rescanAfterBtn.addEventListener("click", resetScanSession);
  startCamera();
  window.addEventListener("pagehide", function () {
    wipePendingPhoto("pagehide");
    stopCamera();
  });
  window.addEventListener("beforeunload", function () {
    wipePendingPhoto("beforeunload");
  });
})();
