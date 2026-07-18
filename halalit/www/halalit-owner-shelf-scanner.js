/**
 * Owner’s Office — shelf photo → multi-title list → owner-scanned TBR.
 * Never writes reader lookup logs. Photos are not kept after scan.
 */
(function (global) {
  var SHELF_CAPTURE_MAX_EDGE = 3000;
  var SHELF_JPEG_QUALITY = 0.9;
  var LIVE_COACH_MS = 350;
  var BLUR_TOO_LOW = 40;
  var BLUR_SOFT = 78;
  var EDGE_TOO_LOW = 0.016;
  var EDGE_SOFT = 0.032;
  var SPINE_FILL_TOO_LOW = 0.1;
  var SPINE_FILL_SOFT = 0.16;

  function apiUrl(suffix) {
    var Config = global.HalalitBookcheckConfig;
    if (Config && typeof Config.apiBase === "function") {
      var base = Config.apiBase();
      if (!base) return "";
      if (base.indexOf("/halalit/api") !== -1) return base + suffix;
      return base + "/api" + suffix;
    }
    return "";
  }

  function shelfIdentifyUrl() {
    var Config = global.HalalitBookcheckConfig;
    if (Config && typeof Config.ownerShelfIdentifyUrl === "function") {
      return Config.ownerShelfIdentifyUrl();
    }
    return apiUrl("/owner/shelf-identify");
  }

  function scannedTbrAddUrl() {
    return apiUrl("/owner/scanned-tbr/add");
  }

  function scannedTbrDeleteUrl() {
    return apiUrl("/owner/scanned-tbr/delete");
  }

  function fetchShelfIdentify(imageBase64, mimeType) {
    var url = shelfIdentifyUrl();
    if (!url || !global.fetch || !imageBase64) {
      return Promise.resolve({ ok: false, error: "unavailable" });
    }
    return global
      .fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          imageBase64: imageBase64,
          mimeType: mimeType || "image/jpeg",
        }),
      })
      .then(function (r) {
        return r.text().then(function (text) {
          var data = {};
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (e) {
              data = {
                ok: false,
                error: "bad_response",
                message: "Server returned an unexpected response (HTTP " + r.status + ").",
              };
            }
          }
          if (!data || typeof data !== "object") data = {};
          data.httpStatus = r.status;
          if (!data.ok && r.status >= 400 && !data.error) {
            data.error = "http_" + r.status;
          }
          return data;
        });
      })
      .catch(function () {
        return { ok: false, error: "network_error" };
      });
  }

  function addScannedTbr(books, source) {
    var url = scannedTbrAddUrl();
    if (!url || !global.fetch || !books || !books.length) {
      return Promise.resolve({ ok: false, error: "unavailable" });
    }
    return global
      .fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ books: books, source: source || "shelf" }),
      })
      .then(function (r) {
        return r.json().then(function (data) {
          return data || { ok: false };
        });
      })
      .catch(function () {
        return { ok: false, error: "network_error" };
      });
  }

  function deleteScannedTbr(id) {
    var url = scannedTbrDeleteUrl();
    if (!url || !global.fetch) return Promise.resolve({ ok: false });
    return global
      .fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: id }),
      })
      .then(function (r) {
        return r.json().then(function (data) {
          return data || { ok: false };
        });
      })
      .catch(function () {
        return { ok: false, error: "network_error" };
      });
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("no_file"));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || "");
        var comma = result.indexOf(",");
        if (comma < 0) {
          reject(new Error("bad_data_url"));
          return;
        }
        var mime = (result.slice(5, comma).split(";")[0] || file.type || "image/jpeg").trim();
        resolve({ base64: result.slice(comma + 1), mimeType: mime });
      };
      reader.onerror = function () {
        reject(new Error("read_failed"));
      };
      reader.readAsDataURL(file);
    });
  }

  function fileLooksHeic(file) {
    var type = String((file && file.type) || "").toLowerCase();
    var name = String((file && file.name) || "").toLowerCase();
    return type.indexOf("heic") !== -1 || type.indexOf("heif") !== -1 || /\.heic$/.test(name) || /\.heif$/.test(name);
  }

  function fileToImagePayload(file, maxEdge) {
    if (fileLooksHeic(file)) {
      return readFileAsBase64(file);
    }
    return fileToJpegBase64(file, maxEdge);
  }

  function fileToJpegBase64(file, maxEdge) {
    maxEdge = maxEdge || SHELF_CAPTURE_MAX_EDGE;
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("no_file"));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var payload = imageToJpegPayload(img, img.naturalWidth || img.width, img.naturalHeight || img.height, maxEdge);
          URL.revokeObjectURL(url);
          resolve(payload);
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("image_load_failed"));
      };
      img.src = url;
    });
  }

  function imageToJpegPayload(img, w, h, maxEdge) {
    maxEdge = maxEdge || SHELF_CAPTURE_MAX_EDGE;
    var scale = 1;
    if (Math.max(w, h) > maxEdge) scale = maxEdge / Math.max(w, h);
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    var canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, cw, ch);
    var dataUrl = canvas.toDataURL("image/jpeg", SHELF_JPEG_QUALITY);
    return {
      base64: dataUrl.replace(/^data:image\/jpeg;base64,/, ""),
      mimeType: "image/jpeg",
    };
  }

  function videoFrameToJpegBase64(video, maxEdge) {
    maxEdge = maxEdge || SHELF_CAPTURE_MAX_EDGE;
    if (!video || !video.videoWidth) return Promise.reject(new Error("no_video"));
    return Promise.resolve(
      imageToJpegPayload(video, video.videoWidth, video.videoHeight, maxEdge)
    );
  }

  function laplacianVariance(gray, w, h) {
    var sum = 0;
    var sumSq = 0;
    var n = 0;
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var i = y * w + x;
        var lap = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w];
        sum += lap;
        sumSq += lap * lap;
        n++;
      }
    }
    var mean = sum / n;
    return sumSq / n - mean * mean;
  }

  function verticalEdgeFraction(gray, w, h) {
    var hits = 0;
    var total = w * h;
    for (var y = 0; y < h; y++) {
      for (var x = 1; x < w - 1; x++) {
        var i = y * w + x;
        var grad = Math.abs(gray[i + 1] - gray[i - 1]);
        if (grad > 22) hits++;
      }
    }
    return hits / total;
  }

  /** Fraction of narrow columns that look spine-like (vertical texture), not empty shelf wood. */
  function spineFillScore(gray, w, h) {
    var colW = 8;
    var cols = Math.max(1, Math.floor(w / colW));
    var strong = 0;
    var y0 = Math.floor(h * 0.12);
    var y1 = Math.floor(h * 0.88);
    for (var c = 0; c < cols; c++) {
      var hits = 0;
      var total = 0;
      var x0 = c * colW;
      var x1 = Math.min(w - 1, x0 + colW);
      for (var y = y0; y < y1; y++) {
        for (var x = x0 + 1; x < x1; x++) {
          var i = y * w + x;
          var grad = Math.abs(gray[i + 1] - gray[i - 1]);
          if (grad > 16) hits++;
          total++;
        }
      }
      if (total && hits / total > 0.07) strong++;
    }
    return strong / cols;
  }

  function analyzeShelfFrame(video) {
    if (!video || !video.videoWidth) {
      return { ok: false, hint: "Starting camera…", level: "wait" };
    }
    var vw = video.videoWidth;
    var vh = video.videoHeight;
    var sampleW = 320;
    var sampleH = Math.max(1, Math.round((vh / vw) * sampleW));
    var canvas = document.createElement("canvas");
    canvas.width = sampleW;
    canvas.height = sampleH;
    var ctx = canvas.getContext("2d");
    var insetX = Math.round(vw * 0.08);
    var insetY = Math.round(vh * 0.1);
    var sw = Math.max(1, vw - insetX * 2);
    var sh = Math.max(1, vh - insetY * 2);
    ctx.drawImage(video, insetX, insetY, sw, sh, 0, 0, sampleW, sampleH);
    var img = ctx.getImageData(0, 0, sampleW, sampleH);
    var d = img.data;
    var gray = new Float32Array(sampleW * sampleH);
    var brightness = 0;
    for (var i = 0; i < sampleW * sampleH; i++) {
      var o = i * 4;
      var g = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
      gray[i] = g;
      brightness += g;
    }
    brightness /= sampleW * sampleH;
    if (brightness < 35) {
      return { ok: false, hint: "Too dark — add light or angle toward the shelf.", level: "bad" };
    }
    if (brightness > 245) {
      return { ok: false, hint: "Too bright — ease glare off the spines.", level: "bad" };
    }
    var blur = laplacianVariance(gray, sampleW, sampleH);
    if (blur < BLUR_TOO_LOW) {
      return { ok: false, hint: "Too blurry — hold still a second.", level: "bad" };
    }
    var fill = spineFillScore(gray, sampleW, sampleH);
    if (fill < SPINE_FILL_TOO_LOW) {
      return {
        ok: false,
        hint: "Mostly empty shelf — fill the dashed box with books (stay ~3–5 ft).",
        level: "bad",
      };
    }
    var edges = verticalEdgeFraction(gray, sampleW, sampleH);
    if (edges < EDGE_TOO_LOW) {
      return {
        ok: false,
        hint: "Spines look faint — step a little closer or more light (not nose-to-shelf).",
        level: "bad",
      };
    }
    if (fill < SPINE_FILL_SOFT) {
      return {
        ok: false,
        hint: "Aim so more books fill the dashed box — same distance is fine.",
        level: "soft",
      };
    }
    if (blur < BLUR_SOFT) {
      return { ok: false, hint: "Almost ready — hold still a moment.", level: "soft" };
    }
    if (edges < EDGE_SOFT) {
      return {
        ok: false,
        hint: "A touch closer or brighter — keep one shelf section in frame.",
        level: "soft",
      };
    }
    return {
      ok: true,
      hint: "Good — tap Capture & scan.",
      level: "good",
    };
  }

  function isSettledTitle(title, author, opts) {
    opts = opts || {};
    var Ui = global.HalalitOwnerVetUi;
    if (Ui && typeof Ui.isHandSettled === "function" && Ui.isHandSettled(title, author)) {
      return true;
    }
    if (typeof opts.rosterSettled === "function" && opts.rosterSettled(title, author)) {
      return true;
    }
    if (typeof opts.alreadyQueued === "function" && opts.alreadyQueued(title, author)) {
      return true;
    }
    return false;
  }

  function filterUnnoted(books, opts) {
    var keep = [];
    var skipped = [];
    (books || []).forEach(function (b) {
      var title = String((b && b.title) || "").trim();
      if (!title) return;
      var author = String((b && b.author) || "").trim();
      var status = String((b && b.status) || "").trim().toLowerCase();
      var confidence = (b && b.confidence) || "medium";
      if (status === "obstruction" || status === "author_unclear" || status === "partial") {
        keep.push({
          title: title,
          author: author,
          confidence: confidence,
          status: status,
          selected: false,
        });
        return;
      }
      if (!author) {
        keep.push({
          title: title,
          author: "",
          confidence: "low",
          status: "author_unclear",
          selected: false,
        });
        return;
      }
      if (isSettledTitle(title, author, opts)) {
        skipped.push({ title: title, author: author, reason: "settled" });
        return;
      }
      keep.push({
        title: title,
        author: author,
        confidence: confidence,
        status: "",
        selected: confidence !== "low",
      });
    });
    return { keep: keep, skipped: skipped };
  }

  function initShelfPanel(root, opts) {
    opts = opts || {};
    if (!root) return null;

    var statusEl = root.querySelector("[data-shelf='status']");
    var resultEl = root.querySelector("[data-shelf='result']");
    var listEl = root.querySelector("[data-shelf='list']");
    var skippedEl = root.querySelector("[data-shelf='skipped']");
    var previewEl = root.querySelector("[data-shelf='preview']");
    var video = root.querySelector("[data-shelf='video']");
    var liveEl = root.querySelector("[data-shelf='live']");
    var liveHint = root.querySelector("[data-shelf='liveHint']");
    var startCamBtn = root.querySelector("[data-shelf='startCam']");
    var snapBtn = root.querySelector("[data-shelf='snap']");
    var stopCamBtn = root.querySelector("[data-shelf='stopCam']");
    var readBtn = root.querySelector("[data-shelf='read']");
    var addBtn = root.querySelector("[data-shelf='add']");
    var camWrap = root.querySelector("[data-shelf='camWrap']");

    var stream = null;
    var pendingImage = null;
    var pendingBooks = [];
    var coachTimer = null;
    var coachReady = false;

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg || "";
    }

    function setResult(msg, kind) {
      if (!resultEl) return;
      if (!msg) {
        resultEl.hidden = true;
        resultEl.textContent = "";
        resultEl.className = "owner-shelf-result";
        return;
      }
      resultEl.hidden = false;
      resultEl.textContent = msg;
      resultEl.className = "owner-shelf-result owner-shelf-result--" + (kind || "info");
      try {
        resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (e) {}
    }

    function finishScan(msg, kind) {
      setStatus(msg || "");
      setResult(msg, kind || "info");
    }

    function setLiveCoach(analysis) {
      if (!liveEl || !liveHint) return;
      if (!analysis) {
        liveEl.hidden = true;
        liveEl.className = "owner-shelf-live";
        return;
      }
      liveEl.hidden = false;
      liveHint.textContent = analysis.hint || "";
      liveEl.className = "owner-shelf-live owner-shelf-live--" + (analysis.level || "wait");
      coachReady = !!analysis.ok;
      if (snapBtn) snapBtn.disabled = !coachReady;
    }

    function stopLiveCoach() {
      if (coachTimer) {
        clearInterval(coachTimer);
        coachTimer = null;
      }
      coachReady = false;
      setLiveCoach(null);
    }

    function tickLiveCoach() {
      if (!video || !stream) return;
      try {
        setLiveCoach(analyzeShelfFrame(video));
      } catch (e) {
        setLiveCoach({ ok: false, hint: "Point at one shelf section.", level: "wait" });
      }
    }

    function startLiveCoach() {
      stopLiveCoach();
      if (liveEl) liveEl.hidden = false;
      tickLiveCoach();
      coachTimer = setInterval(tickLiveCoach, LIVE_COACH_MS);
    }

    function wipePhoto() {
      pendingImage = null;
      if (previewEl) {
        previewEl.hidden = true;
        previewEl.innerHTML = "";
      }
      if (readBtn) readBtn.disabled = true;
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
      if (video) {
        video.srcObject = null;
        video.hidden = true;
      }
      if (camWrap) camWrap.hidden = true;
      if (snapBtn) snapBtn.disabled = true;
      if (stopCamBtn) stopCamBtn.hidden = true;
    }

    function renderList() {
      if (!listEl) return;
      listEl.innerHTML = "";
      if (!pendingBooks.length) {
        listEl.hidden = true;
        if (addBtn) addBtn.disabled = true;
        return;
      }
      listEl.hidden = false;
      pendingBooks.forEach(function (book) {
        var row = document.createElement("label");
        row.className = "owner-shelf-row";
        var check = document.createElement("input");
        check.type = "checkbox";
        check.checked = !!book.selected;
        check.addEventListener("change", function () {
          book.selected = !!check.checked;
          if (addBtn) {
            addBtn.disabled = !pendingBooks.some(function (b) {
              return b.selected;
            });
          }
        });
        var titleIn = document.createElement("input");
        titleIn.type = "text";
        titleIn.className = "owner-shelf-title";
        titleIn.value = book.title;
        titleIn.setAttribute("aria-label", "Title");
        titleIn.addEventListener("input", function () {
          book.title = titleIn.value;
        });
        var authorIn = document.createElement("input");
        authorIn.type = "text";
        authorIn.className = "owner-shelf-author";
        authorIn.value = book.author || "";
        authorIn.placeholder = "Author (required)";
        authorIn.setAttribute("aria-label", "Author");
        authorIn.addEventListener("input", function () {
          book.author = authorIn.value;
        });
        var conf = document.createElement("span");
        conf.className = "muted owner-shelf-conf";
        var statusLabel = "";
        if (book.status === "obstruction") statusLabel = "obstruction";
        else if (book.status === "author_unclear") statusLabel = "author unclear";
        else if (book.status === "partial") statusLabel = "partial";
        conf.textContent = [book.confidence || "", statusLabel].filter(Boolean).join(" · ");
        if (book.status) row.className += " owner-shelf-row--" + book.status;
        row.appendChild(check);
        row.appendChild(titleIn);
        row.appendChild(authorIn);
        row.appendChild(conf);
        listEl.appendChild(row);
      });
      if (addBtn) {
        addBtn.disabled = !pendingBooks.some(function (b) {
          return b.selected;
        });
      }
    }

    function renderSkipped(skipped) {
      if (!skippedEl) return;
      if (!skipped || !skipped.length) {
        skippedEl.hidden = true;
        skippedEl.textContent = "";
        return;
      }
      skippedEl.hidden = false;
      skippedEl.textContent =
        "Skipped — already noted (" +
        skipped.length +
        "): " +
        skipped
          .slice(0, 8)
          .map(function (s) {
            return s.title + (s.author ? " — " + s.author : "");
          })
          .join("; ") +
        (skipped.length > 8 ? "…" : "");
    }

    function formatIdentifyError(res) {
      if (!res) return "Could not read that photo. Try again.";
      if (res.error === "owner_only" || res.httpStatus === 403) {
        return "Owner sign-in required — open Owner’s Office while signed in as owner.";
      }
      if (res.error === "network_error") return "Network error — check connection and try again.";
      if (res.message) return String(res.message).slice(0, 220);
      if (res.httpStatus === 413) return "Photo too large — frame one shelf section.";
      return "Could not read that photo. Try closer, brighter light, or spines facing out.";
    }

    function runIdentifyWithPayload(payload) {
      if (!payload || !payload.base64) {
        finishScan("Start the camera coach and tap Capture & scan first.", "error");
        return;
      }
      finishScan("Scanning shelf… photo is not kept after this.", "busy");
      if (readBtn) readBtn.disabled = true;
      if (addBtn) addBtn.disabled = true;
      fetchShelfIdentify(payload.base64, payload.mimeType)
        .then(function (res) {
          wipePhoto();
          if (!res || !res.ok) {
            finishScan(formatIdentifyError(res), "error");
            return;
          }
          var rawCount = 0;
          var filtered = { keep: [], skipped: [] };
          try {
            var merged = (res.books || []).concat(res.incomplete || []);
            rawCount = merged.length;
            filtered = filterUnnoted(merged, {
              rosterSettled: opts.rosterSettled,
              alreadyQueued: opts.alreadyQueued,
            });
          } catch (err) {
            finishScan("Could not sort scan results — hard refresh and try again.", "error");
            return;
          }
          pendingBooks = filtered.keep;
          renderSkipped(filtered.skipped);
          renderList();
          var brief = res.brief ? " " + res.brief : "";
          var flagged = pendingBooks.filter(function (b) {
            return b.status === "obstruction" || b.status === "author_unclear" || b.status === "partial";
          }).length;
          if (!rawCount) {
            finishScan(
              "No clear title+author reads — one section of shelf, about 3–5 feet, good light." + brief,
              "error"
            );
            return;
          }
          if (!pendingBooks.length) {
            finishScan(
              "Read " +
                rawCount +
                " title" +
                (rawCount === 1 ? "" : "s") +
                " — all already on your lists or noted." +
                brief,
              "info"
            );
            return;
          }
          finishScan(
            "Found " +
              pendingBooks.length +
              " row" +
              (pendingBooks.length === 1 ? "" : "s") +
              (flagged ? " (" + flagged + " need author / obstruction check)" : "") +
              (filtered.skipped.length ? " (" + filtered.skipped.length + " already noted)" : "") +
              ". Photo discarded. Fix authors, uncheck mistakes, then add to Owner scanned TBR." +
              brief,
            "success"
          );
        })
        .catch(function () {
          wipePhoto();
          finishScan("Scan failed — network or server error. Try again in a moment.", "error");
        })
        .then(function () {
          if (readBtn) readBtn.disabled = true;
        });
    }

    function runIdentify() {
      if (!pendingImage) {
        finishScan("Start the camera coach and tap Capture & scan first.", "error");
        return;
      }
      runIdentifyWithPayload(pendingImage);
    }

    function acceptImage(payload, autoScan) {
      pendingImage = payload;
      if (autoScan !== false) {
        runIdentifyWithPayload(payload);
      } else {
        if (readBtn) readBtn.disabled = false;
        setStatus("Photo ready — tap Scan again. (Not kept after scan.)");
      }
    }

    function addSelected() {
      var books = pendingBooks
        .filter(function (b) {
          return b.selected && String(b.title || "").trim() && String(b.author || "").trim();
        })
        .map(function (b) {
          return { title: String(b.title).trim(), author: String(b.author || "").trim() };
        });
      if (!books.length) {
        setStatus("Select titles that have both title and author filled in.");
        return;
      }
      if (addBtn) addBtn.disabled = true;
      setStatus("Saving…");
      addScannedTbr(books, "shelf").then(function (res) {
        if (!res || !res.ok) {
          setStatus("Could not save. Try again.");
          if (addBtn) addBtn.disabled = false;
          return;
        }
        var n = res.addedCount || (res.added && res.added.length) || 0;
        var skip = res.skippedDuplicates || 0;
        setStatus(
          "Added " + n + " to Owner scanned TBR" + (skip ? " (" + skip + " already on the list)" : "") + "."
        );
        pendingBooks = [];
        renderList();
        if (typeof opts.onAdded === "function") opts.onAdded(res);
      });
    }

    if (startCamBtn) {
      startCamBtn.addEventListener("click", function () {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setStatus("Camera not available on this device.");
          return;
        }
        stopCamera();
        setStatus("Camera coach on — watch the hint, then Capture & scan.");
        navigator.mediaDevices
          .getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          })
          .then(function (s) {
            stream = s;
            if (video) {
              video.srcObject = s;
              video.hidden = false;
              video.play().catch(function () {});
            }
            if (camWrap) camWrap.hidden = false;
            if (snapBtn) snapBtn.disabled = true;
            if (stopCamBtn) stopCamBtn.hidden = false;
            startLiveCoach();
          })
          .catch(function () {
            setStatus("Camera permission denied — allow camera for Owner’s Office.");
          });
      });
    }

    if (snapBtn) {
      snapBtn.addEventListener("click", function () {
        if (!coachReady) {
          setStatus("Wait for Good — then tap Capture & scan.");
          return;
        }
        stopLiveCoach();
        videoFrameToJpegBase64(video, SHELF_CAPTURE_MAX_EDGE)
          .then(function (payload) {
            stopCamera();
            acceptImage(payload, true);
          })
          .catch(function () {
            setStatus("Could not capture frame.");
            startLiveCoach();
          });
      });
    }

    if (stopCamBtn) {
      stopCamBtn.addEventListener("click", stopCamera);
    }

    if (readBtn) {
      readBtn.addEventListener("click", runIdentify);
      readBtn.disabled = true;
    }
    if (addBtn) {
      addBtn.addEventListener("click", addSelected);
      addBtn.disabled = true;
    }

    return {
      stopCamera: stopCamera,
      addScannedTbr: addScannedTbr,
      filterUnnoted: filterUnnoted,
      isSettledTitle: isSettledTitle,
    };
  }

  global.HalalitOwnerShelfScanner = {
    init: initShelfPanel,
    fetchShelfIdentify: fetchShelfIdentify,
    addScannedTbr: addScannedTbr,
    deleteScannedTbr: deleteScannedTbr,
    filterUnnoted: filterUnnoted,
    isSettledTitle: isSettledTitle,
    fileToJpegBase64: fileToJpegBase64,
    fileToImagePayload: fileToImagePayload,
    analyzeShelfFrame: analyzeShelfFrame,
  };
})(typeof window !== "undefined" ? window : this);
