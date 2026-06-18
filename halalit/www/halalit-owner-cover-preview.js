/**
 * Owner’s Office — animated cartoony book prop with cover texture (testing only).
 */
(function (global) {
  function init(host) {
    if (!host || host.getAttribute("data-cover-preview-wired") === "1") {
      return host && host._coverPreviewApi ? host._coverPreviewApi : null;
    }
    host.setAttribute("data-cover-preview-wired", "1");
    host.hidden = false;
    host.setAttribute("data-cover-preview-ready", "1");

    var existingTitle = host.querySelector("h3");
    var titleHtml = existingTitle ? existingTitle.outerHTML : "<h3>Cover preview (testing only)</h3>";

    host.innerHTML =
      titleHtml +
      '<p class="owner-cover-preview__lead muted">Cartoony book prop with your cover inside — <strong>not on the public site</strong>. The book should bob right away. Tap <strong>Start camera</strong> or pick a photo below.</p>' +
      '<div class="owner-cover-preview-stage" data-cover-preview="stage">' +
      '<div class="owner-cover-book owner-cover-book--idle" data-cover-preview="book" aria-hidden="true">' +
      '<div class="owner-cover-book__shadow"></div>' +
      '<div class="owner-cover-book__pages"></div>' +
      '<div class="owner-cover-book__face">' +
      '<img data-cover-preview="img" alt="Cover preview" width="200" height="280" decoding="async" hidden />' +
      '<div class="owner-cover-book__placeholder" data-cover-preview="placeholder" aria-hidden="true"></div>' +
      '<div class="owner-cover-book__shine" aria-hidden="true"></div>' +
      "</div>" +
      '<div class="owner-cover-book__spine" aria-hidden="true"></div>' +
      "</div>" +
      "</div>" +
      '<p class="owner-cover-preview__status muted" data-cover-preview="status" aria-live="polite">Bobbing preview ready — pick a photo or start the camera.</p>' +
      '<p class="owner-cover-preview__label" data-cover-preview="label" hidden></p>' +
      '<label class="owner-cover-preview-upload">' +
      '<span class="import-btn owner-cover-preview-upload__btn">Pick a cover photo</span>' +
      '<input type="file" accept="image/*" data-cover-preview="file" hidden />' +
      "</label>";

    var img = host.querySelector('[data-cover-preview="img"]');
    var placeholder = host.querySelector('[data-cover-preview="placeholder"]');
    var label = host.querySelector('[data-cover-preview="label"]');
    var statusEl = host.querySelector('[data-cover-preview="status"]');
    var book = host.querySelector('[data-cover-preview="book"]');
    var fileInput = host.querySelector('[data-cover-preview="file"]');
    var lastUrl = "";

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg || "";
    }

    function applyCoverImage(dataUrl, meta) {
      meta = meta || {};
      if (!dataUrl || !img) return;
      if (dataUrl !== lastUrl) {
        lastUrl = dataUrl;
        img.src = dataUrl;
      }
      img.hidden = false;
      if (placeholder) placeholder.hidden = true;
      if (book) {
        book.hidden = false;
        book.classList.remove("owner-cover-book--idle");
      }
      var title = String(meta.title || "").trim();
      var author = String(meta.author || "").trim();
      if (label) {
        if (title && title !== "Live preview") {
          label.hidden = false;
          label.textContent = title + (author ? " by " + author : "");
        } else if (title === "Live preview") {
          label.hidden = false;
          label.textContent = "Live preview from camera";
        } else {
          label.hidden = true;
          label.textContent = "";
        }
      }
      if (img && title && title !== "Live preview") {
        img.alt = "Cover preview — " + title;
      }
    }

    var api = {
      setCover: function (dataUrl, meta) {
        applyCoverImage(dataUrl, meta);
        setStatus("Cover preview is live — still not on the public site.");
      },
      setStatus: setStatus,
      showIdle: function () {
        lastUrl = "";
        if (img) {
          img.removeAttribute("src");
          img.hidden = true;
        }
        if (placeholder) placeholder.hidden = false;
        if (book) {
          book.hidden = false;
          book.classList.add("owner-cover-book--idle");
        }
        if (label) {
          label.hidden = true;
          label.textContent = "";
        }
        setStatus("Bobbing preview ready — pick a photo or start the camera.");
      },
      clear: function () {
        api.showIdle();
      },
    };

    if (fileInput) {
      fileInput.addEventListener("change", function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          applyCoverImage(String(reader.result || ""), { title: file.name.replace(/\.[^.]+$/, "") });
          setStatus("Photo loaded — bobbing preview (not live yet). Start camera to try live capture.");
        };
        reader.readAsDataURL(file);
        fileInput.value = "";
      });
    }

    var uploadBtn = host.querySelector(".owner-cover-preview-upload__btn");
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener("click", function (ev) {
        ev.preventDefault();
        fileInput.click();
      });
    }

    api.showIdle();
    setStatus("Bobbing preview ready — pick a photo or start the camera.");
    host._coverPreviewApi = api;
    return api;
  }

  global.HalalitOwnerCoverPreview = {
    init: init,
  };
})(typeof window !== "undefined" ? window : this);
