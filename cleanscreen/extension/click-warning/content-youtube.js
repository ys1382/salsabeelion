(function () {
  var HOVER_DELAY_MS = 350;
  var checkTimer = null;
  var lastKey = "";
  var tooltipEl = null;
  var modalEl = null;
  var pendingNav = null;

  var REASON_LABELS = {
    video_heavy: "Streaming / video site (not on the vetted list)",
    fanfic_host: "Fan fiction site",
    substance_retail: "Alcohol or tobacco retail",
    parent_only_site: "Parent-only site (kid mode)",
    profanity: "Profanity in title or description",
    sexual_content: "Sexual content",
    hostile_or_hate: "Hostile or hateful language",
    substance_promotion: "Substance promotion",
    lgbtq_themes: "LGBTQ themes on the open web",
    romance: "Romance themes",
    fanservice: "Fanservice",
    invalid_url: "Invalid link",
  };

  function reasonLabel(code) {
    return REASON_LABELS[code] || code || "CleanScreen filter";
  }

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement("div");
    tooltipEl.className = "cs-click-warn-tooltip";
    tooltipEl.hidden = true;
    document.documentElement.appendChild(tooltipEl);
    return tooltipEl;
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.hidden = true;
  }

  function showTooltip(x, y, text) {
    var el = ensureTooltip();
    el.textContent = text;
    el.hidden = false;
    el.style.left = Math.min(x + 12, window.innerWidth - 320) + "px";
    el.style.top = Math.min(y + 12, window.innerHeight - 80) + "px";
  }

  function closeModal() {
    if (modalEl && modalEl.parentNode) {
      modalEl.parentNode.removeChild(modalEl);
    }
    modalEl = null;
    pendingNav = null;
  }

  function showModal(payload, onContinue) {
    closeModal();
    modalEl = document.createElement("div");
    modalEl.className = "cs-click-warn-modal-backdrop";
    modalEl.innerHTML =
      '<div class="cs-click-warn-modal" role="dialog" aria-labelledby="csWarnTitle">' +
      '<h2 id="csWarnTitle">CleanScreen would not recommend this</h2>' +
      "<p class=\"cs-click-warn-reason\"></p>" +
      '<p class="cs-click-warn-title"></p>' +
      '<div class="cs-click-warn-actions">' +
      '<button type="button" class="cs-click-warn-back">Go back</button>' +
      '<button type="button" class="cs-click-warn-continue">Continue anyway</button>' +
      "</div>" +
      '<p class="cs-click-warn-note">Owner beta · same rules as CleanScreen Search</p>' +
      "</div>";
    modalEl.querySelector(".cs-click-warn-reason").textContent = reasonLabel(payload.reason);
    modalEl.querySelector(".cs-click-warn-title").textContent = payload.title || payload.url || "";
    modalEl.querySelector(".cs-click-warn-back").addEventListener("click", closeModal);
    modalEl.querySelector(".cs-click-warn-continue").addEventListener("click", function () {
      closeModal();
      if (typeof onContinue === "function") onContinue();
    });
    modalEl.addEventListener("click", function (ev) {
      if (ev.target === modalEl) closeModal();
    });
    document.documentElement.appendChild(modalEl);
  }

  function checkWithApi(url, title, snippet) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage(
        { type: "check", url: url, title: title, snippet: snippet },
        function (resp) {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: "extension_error" });
            return;
          }
          if (!resp || resp.status !== 200 || !resp.body || !resp.body.ok) {
            resolve(resp && resp.body ? resp.body : { ok: false, error: "check_failed" });
            return;
          }
          resolve(resp.body);
        }
      );
    });
  }

  function cardFromTarget(target) {
    var node = target;
    while (node && node !== document.body) {
      if (node.matches && node.matches("ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer")) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function metadataFromCard(card) {
    if (!card) return null;
    var link =
      card.querySelector("a#video-title-link") ||
      card.querySelector("a#video-title") ||
      card.querySelector("a.ytd-thumbnail") ||
      card.querySelector('a[href*="/watch"]') ||
      card.querySelector('a[href*="/shorts/"]');
    if (!link) return null;
    var href = link.href || link.getAttribute("href") || "";
    if (href && href.startsWith("/")) {
      href = "https://www.youtube.com" + href;
    }
    var titleEl =
      card.querySelector("#video-title") ||
      card.querySelector("yt-formatted-string#video-title") ||
      link;
    var channelEl =
      card.querySelector("ytd-channel-name") ||
      card.querySelector("#channel-name") ||
      card.querySelector("#text-container.ytd-channel-name");
    var title = titleEl ? (titleEl.textContent || "").trim() : "";
    var channel = channelEl ? (channelEl.textContent || "").trim() : "";
    return { url: href, title: title, snippet: channel };
  }

  function metadataFromWatchPage() {
    var url = window.location.href;
    var titleEl = document.querySelector("h1 yt-formatted-string, h1.title");
    var channelEl = document.querySelector("#owner #channel-name a, ytd-channel-name a");
    return {
      url: url,
      title: titleEl ? (titleEl.textContent || "").trim() : document.title,
      snippet: channelEl ? (channelEl.textContent || "").trim() : "",
    };
  }

  document.addEventListener(
    "mouseover",
    function (ev) {
      var card = cardFromTarget(ev.target);
      if (!card) {
        hideTooltip();
        return;
      }
      var meta = metadataFromCard(card);
      if (!meta || !meta.url) return;
      var key = meta.url + "|" + meta.title;
      if (key === lastKey && tooltipEl && !tooltipEl.hidden) return;
      if (checkTimer) clearTimeout(checkTimer);
      checkTimer = setTimeout(function () {
        checkWithApi(meta.url, meta.title, meta.snippet).then(function (body) {
          if (!body.ok || body.allow) {
            hideTooltip();
            return;
          }
          lastKey = key;
          showTooltip(ev.clientX, ev.clientY, "Heads-up: " + reasonLabel(body.reason));
        });
      }, HOVER_DELAY_MS);
    },
    true
  );

  document.addEventListener(
    "mouseout",
    function (ev) {
      var card = cardFromTarget(ev.target);
      if (!card) return;
      if (checkTimer) clearTimeout(checkTimer);
      hideTooltip();
    },
    true
  );

  document.addEventListener(
    "click",
    function (ev) {
      var card = cardFromTarget(ev.target);
      if (!card) return;
      var meta = metadataFromCard(card);
      if (!meta || !meta.url) return;
      if (!meta.url.includes("/watch") && !meta.url.includes("/shorts/")) return;

      ev.preventDefault();
      ev.stopPropagation();

      checkWithApi(meta.url, meta.title, meta.snippet).then(function (body) {
        if (body.ok && body.allow) {
          window.location.href = meta.url;
          return;
        }
        if (body.ok && !body.allow) {
          showModal(body, function () {
            window.location.href = meta.url;
          });
          return;
        }
        window.location.href = meta.url;
      });
    },
    true
  );

  var watchChecked = false;
  function tryWatchPageHook() {
    if (watchChecked) return;
    if (!window.location.pathname.startsWith("/watch")) return;
    watchChecked = true;
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      var meta = metadataFromWatchPage();
      if (!meta.url || attempts > 20) {
        clearInterval(timer);
        return;
      }
      var video = document.querySelector("video");
      if (!video) return;
      clearInterval(timer);
      checkWithApi(meta.url, meta.title, meta.snippet).then(function (body) {
        if (!body.ok || body.allow) return;
        try {
          video.pause();
        } catch (_e) {
          /* ignore */
        }
        showModal(body, function () {
          try {
            video.play();
          } catch (_e2) {
            /* ignore */
          }
        });
      });
    }, 500);
  }

  tryWatchPageHook();
  window.addEventListener("yt-navigate-finish", function () {
    watchChecked = false;
    tryWatchPageHook();
  });
})();
