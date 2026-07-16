/**
 * Owner’s Office — shelf photo → multi-title list → owner-scanned TBR.
 * Never writes reader lookup logs.
 */
(function (global) {
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
        return r.json().then(function (data) {
          data = data || {};
          data.httpStatus = r.status;
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

  function fileToJpegBase64(file, maxEdge) {
    maxEdge = maxEdge || 1600;
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("no_file"));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var scale = 1;
          if (Math.max(w, h) > maxEdge) scale = maxEdge / Math.max(w, h);
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, cw, ch);
          var dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          var b64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
          URL.revokeObjectURL(url);
          resolve({ base64: b64, mimeType: "image/jpeg" });
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

  function videoFrameToJpegBase64(video, maxEdge) {
    maxEdge = maxEdge || 1600;
    if (!video || !video.videoWidth) return Promise.reject(new Error("no_video"));
    var w = video.videoWidth;
    var h = video.videoHeight;
    var scale = 1;
    if (Math.max(w, h) > maxEdge) scale = maxEdge / Math.max(w, h);
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    var canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, cw, ch);
    var dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return Promise.resolve({
      base64: dataUrl.replace(/^data:image\/jpeg;base64,/, ""),
      mimeType: "image/jpeg",
    });
  }

  function isSettledTitle(title, author, opts) {
    opts = opts || {};
    var Ui = global.HalalitOwnerVetUi;
    if (Ui && typeof Ui.isHandSettled === "function" && Ui.isHandSettled(title, author)) {
      return true;
    }
    var VS = global.HalalitBookcheckVetSource;
    if (VS && typeof VS.resolveHandVetHint === "function") {
      var hint = VS.resolveHandVetHint(title, author || "");
      if (hint && hint.tier) return true;
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
      if (isSettledTitle(title, author, opts)) {
        skipped.push({ title: title, author: author, reason: "settled" });
        return;
      }
      keep.push({
        title: title,
        author: author,
        confidence: (b && b.confidence) || "medium",
        selected: true,
      });
    });
    return { keep: keep, skipped: skipped };
  }

  function initShelfPanel(root, opts) {
    opts = opts || {};
    if (!root) return null;

    var statusEl = root.querySelector("[data-shelf='status']");
    var listEl = root.querySelector("[data-shelf='list']");
    var skippedEl = root.querySelector("[data-shelf='skipped']");
    var previewEl = root.querySelector("[data-shelf='preview']");
    var fileInput = root.querySelector("[data-shelf='file']");
    var video = root.querySelector("[data-shelf='video']");
    var startCamBtn = root.querySelector("[data-shelf='startCam']");
    var snapBtn = root.querySelector("[data-shelf='snap']");
    var stopCamBtn = root.querySelector("[data-shelf='stopCam']");
    var readBtn = root.querySelector("[data-shelf='read']");
    var addBtn = root.querySelector("[data-shelf='add']");
    var camWrap = root.querySelector("[data-shelf='camWrap']");

    var stream = null;
    var pendingImage = null;
    var pendingBooks = [];

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg || "";
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
      if (video) {
        video.srcObject = null;
        video.hidden = true;
      }
      if (camWrap) camWrap.hidden = true;
      if (snapBtn) snapBtn.disabled = true;
      if (stopCamBtn) stopCamBtn.hidden = true;
    }

    function showPreview(dataUrl) {
      if (!previewEl) return;
      previewEl.hidden = !dataUrl;
      previewEl.innerHTML = dataUrl
        ? '<img src="' + dataUrl + '" alt="Shelf photo preview" />'
        : "";
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
      pendingBooks.forEach(function (book, idx) {
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
        authorIn.placeholder = "Author (optional)";
        authorIn.setAttribute("aria-label", "Author");
        authorIn.addEventListener("input", function () {
          book.author = authorIn.value;
        });
        var conf = document.createElement("span");
        conf.className = "muted owner-shelf-conf";
        conf.textContent = book.confidence || "";
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
        "Skipped — already noted (" + skipped.length + "): " +
        skipped
          .slice(0, 8)
          .map(function (s) {
            return s.title + (s.author ? " — " + s.author : "");
          })
          .join("; ") +
        (skipped.length > 8 ? "…" : "");
    }

    function acceptImage(payload) {
      pendingImage = payload;
      showPreview("data:image/jpeg;base64," + payload.base64);
      if (readBtn) readBtn.disabled = false;
      setStatus("Photo ready — tap Read shelf titles.");
    }

    function runIdentify() {
      if (!pendingImage) {
        setStatus("Add a shelf photo first.");
        return;
      }
      setStatus("Reading shelf…");
      if (readBtn) readBtn.disabled = true;
      if (addBtn) addBtn.disabled = true;
      fetchShelfIdentify(pendingImage.base64, pendingImage.mimeType).then(function (res) {
        if (readBtn) readBtn.disabled = false;
        if (!res || !res.ok) {
          setStatus(
            (res && res.message) ||
              (res && res.error === "owner_only"
                ? "Owner sign-in required."
                : "Could not read that photo. Try closer or brighter.")
          );
          return;
        }
        var filtered = filterUnnoted(res.books || [], {
          rosterSettled: opts.rosterSettled,
          alreadyQueued: opts.alreadyQueued,
        });
        pendingBooks = filtered.keep;
        renderSkipped(filtered.skipped);
        renderList();
        var brief = res.brief ? " " + res.brief : "";
        if (!pendingBooks.length) {
          setStatus(
            "No unnoted titles in this photo." +
              (filtered.skipped.length ? " (" + filtered.skipped.length + " already noted.)" : "") +
              brief
          );
        } else {
          setStatus(
            "Found " +
              pendingBooks.length +
              " unnoted title" +
              (pendingBooks.length === 1 ? "" : "s") +
              ". Uncheck any mistakes, then add to Owner scanned TBR." +
              brief
          );
        }
      });
    }

    function addSelected() {
      var books = pendingBooks
        .filter(function (b) {
          return b.selected && String(b.title || "").trim();
        })
        .map(function (b) {
          return { title: String(b.title).trim(), author: String(b.author || "").trim() };
        });
      if (!books.length) {
        setStatus("Select at least one title.");
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
          "Added " +
            n +
            " to Owner scanned TBR" +
            (skip ? " (" + skip + " already on the list)" : "") +
            "."
        );
        pendingBooks = [];
        renderList();
        if (typeof opts.onAdded === "function") opts.onAdded(res);
      });
    }

    if (fileInput) {
      fileInput.addEventListener("change", function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        setStatus("Preparing photo…");
        fileToJpegBase64(file)
          .then(acceptImage)
          .catch(function () {
            setStatus("Could not open that image.");
          });
        fileInput.value = "";
      });
    }

    if (startCamBtn) {
      startCamBtn.addEventListener("click", function () {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setStatus("Camera not available — use Choose photo instead.");
          return;
        }
        stopCamera();
        setStatus("Starting camera…");
        navigator.mediaDevices
          .getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } },
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
            if (snapBtn) snapBtn.disabled = false;
            if (stopCamBtn) stopCamBtn.hidden = false;
            setStatus("Point at the shelf, then Capture.");
          })
          .catch(function () {
            setStatus("Camera permission denied — use Choose photo instead.");
          });
      });
    }

    if (snapBtn) {
      snapBtn.addEventListener("click", function () {
        videoFrameToJpegBase64(video)
          .then(acceptImage)
          .catch(function () {
            setStatus("Could not capture frame.");
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
  };
})(typeof window !== "undefined" ? window : this);
