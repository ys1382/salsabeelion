/**
 * Halalit — Wishlist library availability.
 * Favorites: save places, hover/focus a wishlist title for a soft tip across them.
 * Batch fallback: choose one library, check the first N wishlist titles.
 * Places: Central Park + Mission (city) + Cupertino (Santa Clara County).
 */
(function (global) {
  var BATCH_CAP = 10;
  var DELAY_MS = 400;
  var HOVER_DEBOUNCE_MS = 280;
  var CLIENT_CACHE_TTL_MS = 15 * 60 * 1000;
  var FAVORITES_KEY = "halalitLibraryFavoritePlaces";

  /** Keep in sync with server PLACES in library_catalog_check.py */
  var PLACES = [
    {
      placeId: "santa-clara-central-park",
      placeLabel: "Santa Clara Central Park Library",
      shortLabel: "Central Park",
    },
    {
      placeId: "santa-clara-mission",
      placeLabel: "Santa Clara Mission Branch Library",
      shortLabel: "Mission",
    },
    {
      placeId: "sccld-cupertino",
      placeLabel: "Cupertino Library (Santa Clara County)",
      shortLabel: "Cupertino",
    },
  ];

  var clientCache = Object.create(null);
  var tipGen = 0;
  var tipTimer = null;
  var tipEl = null;
  var tipHideTimer = null;

  function apiUrl() {
    var Cfg = global.HalalitBookcheckConfig;
    if (!Cfg || typeof Cfg.apiBase !== "function") return "";
    var base = Cfg.apiBase();
    if (!base) return "";
    if (base.indexOf("/halalit/api") !== -1 || /\/api$/.test(base)) {
      return base.replace(/\/$/, "") + "/library/check";
    }
    return base.replace(/\/$/, "") + "/api/library/check";
  }

  function storage() {
    return global.HalalitAccountStorage || null;
  }

  function wishList() {
    var Want = global.HalalitWantToRead;
    if (!Want || typeof Want.load !== "function") return [];
    var list = Want.load();
    return Array.isArray(list) ? list.slice() : [];
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function findPlace(placeId) {
    var id = String(placeId || "");
    for (var i = 0; i < PLACES.length; i++) {
      if (PLACES[i].placeId === id) return PLACES[i];
    }
    return null;
  }

  function selectedPlace() {
    var sel = document.getElementById("wishlistLibraryPlaceSelect");
    if (!sel) return null;
    return findPlace(sel.value);
  }

  function normalizeFavoriteIds(raw) {
    var out = [];
    var seen = Object.create(null);
    if (!Array.isArray(raw)) return out;
    for (var i = 0; i < raw.length; i++) {
      var id = String(raw[i] || "").trim();
      if (!id || seen[id] || !findPlace(id)) continue;
      seen[id] = true;
      out.push(id);
    }
    return out;
  }

  function loadFavorites() {
    var Store = storage();
    if (!Store || typeof Store.getItem !== "function") return [];
    try {
      var raw = Store.getItem(FAVORITES_KEY);
      if (!raw) return [];
      return normalizeFavoriteIds(JSON.parse(raw));
    } catch (e) {
      return [];
    }
  }

  function saveFavorites(ids) {
    var Store = storage();
    var cleaned = normalizeFavoriteIds(ids);
    if (!Store || typeof Store.setItem !== "function") return cleaned;
    try {
      Store.setItem(FAVORITES_KEY, JSON.stringify(cleaned));
    } catch (e) {}
    return cleaned;
  }

  function favoritePlaces() {
    var ids = loadFavorites();
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var p = findPlace(ids[i]);
      if (p) out.push(p);
    }
    return out;
  }

  function statusLabel(status, reason, shortLabel) {
    var short = shortLabel || "this library";
    if (status === "yes") return "Borrowable at " + short;
    if (status === "no") {
      if (reason === "not_in_catalog") return "Not in this library’s catalog";
      return "Not at " + short;
    }
    return "Couldn’t confirm";
  }

  function statusClass(status) {
    if (status === "yes") return "library-avail-row--yes";
    if (status === "no") return "library-avail-row--no";
    return "library-avail-row--uncertain";
  }

  function entryCacheKey(entry, placeId) {
    var Lib = global.HalalitPersonalLibrary;
    var title = entry && entry.title ? entry.title : "";
    var author = entry && entry.author ? entry.author : "";
    var nk =
      Lib && typeof Lib.normalizeKey === "function"
        ? Lib.normalizeKey(title, author)
        : String(title).toLowerCase() + "|" + String(author).toLowerCase();
    var isbn = entry && entry.isbn ? String(entry.isbn) : "";
    return String(placeId || "") + "|" + nk + "|" + isbn;
  }

  function cacheGet(entry, placeId) {
    var key = entryCacheKey(entry, placeId);
    var hit = clientCache[key];
    if (!hit) return null;
    if (Date.now() - hit.at > CLIENT_CACHE_TTL_MS) {
      delete clientCache[key];
      return null;
    }
    return hit.res;
  }

  function cacheSet(entry, placeId, res) {
    clientCache[entryCacheKey(entry, placeId)] = { at: Date.now(), res: res };
  }

  function checkOne(entry, placeId) {
    var cached = cacheGet(entry, placeId);
    if (cached) {
      return Promise.resolve(cached);
    }
    var url = apiUrl();
    if (!url) {
      return Promise.resolve({
        ok: false,
        status: "uncertain",
        reason: "api_unconfigured",
        title: entry.title || "",
        author: entry.author || "",
        catalogUrl: "",
      });
    }
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        title: entry.title || "",
        author: entry.author || "",
        isbn: entry.isbn || "",
        seriesName: entry.seriesName || "",
        placeId: placeId || "",
      }),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!body || typeof body !== "object") {
            return {
              ok: false,
              status: "uncertain",
              reason: "bad_response",
              title: entry.title || "",
              author: entry.author || "",
            };
          }
          body._httpOk = res.ok;
          cacheSet(entry, placeId, body);
          return body;
        });
      })
      .catch(function () {
        return {
          ok: false,
          status: "uncertain",
          reason: "network_error",
          title: entry.title || "",
          author: entry.author || "",
          catalogUrl: "",
        };
      });
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Check one wishlist entry across favorite places (sequential, cache-friendly).
   * @returns {Promise<{places: Array, yes: Array, no: Array, uncertain: Array}>}
   */
  function checkAcrossFavorites(entry, opts) {
    opts = opts || {};
    var places = opts.places || favoritePlaces();
    var delay = opts.delayMs != null ? opts.delayMs : DELAY_MS;
    var onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
    var rows = [];
    var chain = Promise.resolve();

    if (!entry || !places.length) {
      return Promise.resolve({ places: places, yes: [], no: [], uncertain: [], rows: [] });
    }

    places.forEach(function (place, idx) {
      chain = chain.then(function () {
        if (onProgress) onProgress(idx, places.length, place);
        return checkOne(entry, place.placeId).then(function (res) {
          var row = {
            place: place,
            status: res.status || "uncertain",
            reason: res.reason || "",
            matchTitle: res.matchTitle || null,
            catalogUrl: res.catalogUrl || "",
            libraryStatus: res.libraryStatus || null,
          };
          rows.push(row);
          if (idx < places.length - 1) return sleep(delay);
        });
      });
    });

    return chain.then(function () {
      var yes = [];
      var no = [];
      var uncertain = [];
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].status === "yes") yes.push(rows[i]);
        else if (rows[i].status === "no") no.push(rows[i]);
        else uncertain.push(rows[i]);
      }
      return { places: places, yes: yes, no: no, uncertain: uncertain, rows: rows };
    });
  }

  function formatYesTip(yesRows) {
    if (!yesRows.length) return "";
    var labels = yesRows.map(function (r) {
      return r.place.shortLabel || r.place.placeLabel;
    });
    if (labels.length === 1) {
      return "Currently available at " + labels[0] + " (one of your favorites).";
    }
    if (labels.length === 2) {
      return "Currently available at " + labels[0] + " and " + labels[1] + ".";
    }
    var last = labels[labels.length - 1];
    var head = labels.slice(0, -1).join(", ");
    return "Currently available at " + head + ", and " + last + ".";
  }

  function tipMessageFromResult(result) {
    if (!result || !result.places || !result.places.length) {
      return "Add favorite libraries below — then hover a wishlist book to see if it’s there.";
    }
    if (result.yes && result.yes.length) {
      return formatYesTip(result.yes);
    }
    if (result.uncertain && result.uncertain.length && !(result.no && result.no.length)) {
      return "Couldn’t confirm availability at your favorite libraries right now.";
    }
    if (result.uncertain && result.uncertain.length) {
      return "Not clearly available at your favorites (some checks couldn’t confirm).";
    }
    return "Not showing as borrowable at your favorite libraries right now.";
  }

  function ensureTipEl() {
    if (tipEl && tipEl.parentNode) return tipEl;
    tipEl = document.getElementById("wishlistAvailTip");
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.id = "wishlistAvailTip";
      tipEl.className = "library-avail-tip";
      tipEl.setAttribute("role", "status");
      tipEl.setAttribute("aria-live", "polite");
      tipEl.hidden = true;
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }

  function hideTipSoon() {
    if (tipHideTimer) clearTimeout(tipHideTimer);
    tipHideTimer = setTimeout(function () {
      tipHideTimer = null;
      var el = ensureTipEl();
      el.hidden = true;
      el.classList.remove("is-visible", "is-yes", "is-muted");
    }, 180);
  }

  function showTip(anchorEl, text, kind) {
    if (tipHideTimer) {
      clearTimeout(tipHideTimer);
      tipHideTimer = null;
    }
    var el = ensureTipEl();
    el.textContent = text || "";
    el.classList.toggle("is-yes", kind === "yes");
    el.classList.toggle("is-muted", kind === "muted" || kind === "checking");
    el.hidden = false;
    el.classList.add("is-visible");

    if (!anchorEl || !anchorEl.getBoundingClientRect) return;
    var rect = anchorEl.getBoundingClientRect();
    var tipW = Math.min(320, Math.max(180, el.offsetWidth || 240));
    var left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - tipW - 12));
    var top = rect.top - 12;
    el.style.width = tipW + "px";
    el.style.left = left + "px";
    // Place above when there’s room; otherwise below.
    requestAnimationFrame(function () {
      var h = el.offsetHeight || 40;
      var above = rect.top - h - 10;
      if (above >= 8) {
        el.style.top = above + "px";
        el.classList.remove("library-avail-tip--below");
      } else {
        el.style.top = rect.bottom + 10 + "px";
        el.classList.add("library-avail-tip--below");
      }
    });
  }

  function entryFromIndex(idx) {
    var list = wishList();
    if (idx < 0 || idx >= list.length) return null;
    return list[idx];
  }

  function runHoverCheck(anchorEl, entry) {
    tipGen += 1;
    var myGen = tipGen;
    var places = favoritePlaces();
    if (!places.length) {
      showTip(
        anchorEl,
        "Add favorite libraries below — then hover a wishlist book to see if it’s there.",
        "muted"
      );
      return;
    }
    if (!entry) return;

    showTip(anchorEl, "Checking your favorite libraries…", "checking");

    checkAcrossFavorites(entry, {
      places: places,
      delayMs: DELAY_MS,
      onProgress: function (idx, total) {
        if (myGen !== tipGen) return;
        showTip(
          anchorEl,
          "Checking your favorite libraries… (" + (idx + 1) + "/" + total + ")",
          "checking"
        );
      },
    }).then(function (result) {
      if (myGen !== tipGen) return;
      var kind = result.yes && result.yes.length ? "yes" : "muted";
      showTip(anchorEl, tipMessageFromResult(result), kind);
    });
  }

  function scheduleHoverCheck(anchorEl, entry) {
    if (tipTimer) clearTimeout(tipTimer);
    tipTimer = setTimeout(function () {
      tipTimer = null;
      runHoverCheck(anchorEl, entry);
    }, HOVER_DEBOUNCE_MS);
  }

  function cancelHoverSchedule() {
    if (tipTimer) {
      clearTimeout(tipTimer);
      tipTimer = null;
    }
    tipGen += 1;
    hideTipSoon();
  }

  function bindWishlistTipRoot(root) {
    if (!root || root.getAttribute("data-halalit-avail-tip") === "1") return;
    root.setAttribute("data-halalit-avail-tip", "1");

    root.addEventListener("pointerover", function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest("[data-halalit-index]") : null;
      if (!el || !root.contains(el)) return;
      if (ev.relatedTarget && el.contains(ev.relatedTarget)) return;
      var idx = parseInt(el.getAttribute("data-halalit-index"), 10);
      if (isNaN(idx)) return;
      scheduleHoverCheck(el, entryFromIndex(idx));
    });

    root.addEventListener("pointerout", function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest("[data-halalit-index]") : null;
      if (!el || !root.contains(el)) return;
      if (ev.relatedTarget && el.contains(ev.relatedTarget)) return;
      cancelHoverSchedule();
    });

    root.addEventListener("focusin", function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest("[data-halalit-index]") : null;
      if (!el || !root.contains(el)) return;
      var idx = parseInt(el.getAttribute("data-halalit-index"), 10);
      if (isNaN(idx)) return;
      scheduleHoverCheck(el, entryFromIndex(idx));
    });

    root.addEventListener("focusout", function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest("[data-halalit-index]") : null;
      if (!el || !root.contains(el)) return;
      if (ev.relatedTarget && el.contains(ev.relatedTarget)) return;
      cancelHoverSchedule();
    });
  }

  function refreshWishlistTips() {
    var stage = document.getElementById("wishlistStage");
    var list = document.getElementById("wishlistListItems");
    bindWishlistTipRoot(stage);
    bindWishlistTipRoot(list);

    function markFocusable(root) {
      if (!root) return;
      var nodes = root.querySelectorAll("[data-halalit-index]");
      for (var i = 0; i < nodes.length; i++) {
        if (!nodes[i].hasAttribute("tabindex")) nodes[i].setAttribute("tabindex", "0");
      }
    }
    markFocusable(stage);
    markFocusable(list);
  }

  function renderFavoritesUi() {
    var host = document.getElementById("wishlistLibraryFavorites");
    if (!host) return;
    var fav = loadFavorites();
    var favSet = Object.create(null);
    for (var f = 0; f < fav.length; f++) favSet[fav[f]] = true;

    var bits = [];
    bits.push('<p class="library-avail__fav-heading">Your favorite libraries</p>');
    bits.push(
      '<p class="library-avail__fav-hint">Save the places you actually use. Hover (or focus) a wishlist book to see if one of them has it — no need to pick a library each time.</p>'
    );
    bits.push('<ul class="library-avail__fav-list" role="list">');
    for (var i = 0; i < PLACES.length; i++) {
      var p = PLACES[i];
      var id = "wishlistFav_" + p.placeId;
      bits.push(
        '<li class="library-avail__fav-item">' +
          '<label class="library-avail__fav-label" for="' +
          escapeHtml(id) +
          '">' +
          '<input type="checkbox" class="library-avail__fav-check" id="' +
          escapeHtml(id) +
          '" data-place-id="' +
          escapeHtml(p.placeId) +
          '"' +
          (favSet[p.placeId] ? " checked" : "") +
          " /> " +
          '<span class="library-avail__fav-name">' +
          escapeHtml(p.placeLabel) +
          "</span></label></li>"
      );
    }
    bits.push("</ul>");
    host.innerHTML = bits.join("");

    host.querySelectorAll(".library-avail__fav-check").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var next = [];
        host.querySelectorAll(".library-avail__fav-check").forEach(function (box) {
          if (box.checked) next.push(box.getAttribute("data-place-id"));
        });
        saveFavorites(next);
      });
    });
  }

  function renderResults(host, rows, meta) {
    if (!host) return;
    var short = (meta && meta.shortLabel) || "this library";
    var bits = [];
    bits.push(
      '<p class="library-avail__summary">' + escapeHtml(meta.summary || "") + "</p>"
    );
    if (!rows.length) {
      host.innerHTML = bits.join("");
      return;
    }
    bits.push('<ul class="library-avail__list" role="list">');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var title = r.title || "";
      var author = r.author || "";
      var label = author ? title + " — " + author : title;
      var link = r.catalogUrl
        ? '<a class="library-avail__link" href="' +
          escapeHtml(r.catalogUrl) +
          '" target="_blank" rel="noopener noreferrer">Open on library site</a>'
        : "";
      var detail = "";
      if (r.status === "yes" && r.libraryStatus) {
        detail =
          ' <span class="muted">(' +
          escapeHtml(String(r.libraryStatus)) +
          " — still borrowable)</span>";
      } else if (r.matchTitle && r.matchTitle !== title) {
        detail =
          ' <span class="muted">(matched “' +
          escapeHtml(r.matchTitle) +
          '”)</span>';
      }
      bits.push(
        '<li class="library-avail-row ' +
          statusClass(r.status) +
          '">' +
          '<span class="library-avail-row__status">' +
          escapeHtml(statusLabel(r.status, r.reason, short)) +
          "</span>" +
          '<span class="library-avail-row__title">' +
          escapeHtml(label) +
          detail +
          "</span> " +
          link +
          "</li>"
      );
    }
    bits.push("</ul>");
    host.innerHTML = bits.join("");
  }

  function syncCheckButton() {
    var btn = document.getElementById("wishlistLibraryCheckBtn");
    var place = selectedPlace();
    if (!btn) return;
    if (btn.getAttribute("aria-busy") === "true") return;
    btn.disabled = !place;
    btn.textContent = place ? "Check library" : "Choose a library first";
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    btn.setAttribute("aria-busy", busy ? "true" : "false");
    if (busy) {
      btn.disabled = true;
      btn.textContent = "Checking…";
      return;
    }
    syncCheckButton();
  }

  function runCheck(opts) {
    opts = opts || {};
    var btn = opts.button || document.getElementById("wishlistLibraryCheckBtn");
    var host = opts.resultsEl || document.getElementById("wishlistLibraryCheckResults");
    var statusEl = opts.statusEl || document.getElementById("wishlistLibraryCheckStatus");
    var place = opts.place || selectedPlace();
    if (!place) {
      if (statusEl) {
        statusEl.textContent = "Choose a library from the list first.";
      }
      syncCheckButton();
      return Promise.resolve({ rows: [], skipped: 0 });
    }

    var list = wishList();
    if (!list.length) {
      if (statusEl) {
        statusEl.textContent = "Your wishlist is empty — add a title first.";
      }
      if (host) host.innerHTML = "";
      return Promise.resolve({ rows: [], skipped: 0 });
    }

    var capped = list.slice(0, BATCH_CAP);
    var skipped = Math.max(0, list.length - capped.length);
    setBusy(btn, true);
    if (statusEl) {
      statusEl.textContent =
        "Checking " +
        capped.length +
        " wishlist title" +
        (capped.length === 1 ? "" : "s") +
        " at " +
        place.placeLabel +
        "…";
    }
    if (host) host.innerHTML = "";

    var rows = [];
    var chain = Promise.resolve();
    capped.forEach(function (entry, idx) {
      chain = chain.then(function () {
        if (statusEl) {
          statusEl.textContent =
            "Checking " + (idx + 1) + " of " + capped.length + "…";
        }
        return checkOne(entry, place.placeId).then(function (res) {
          rows.push({
            title: entry.title || res.title || "",
            author: entry.author || res.author || "",
            status: res.status || "uncertain",
            reason: res.reason || "",
            matchTitle: res.matchTitle || null,
            catalogUrl: res.catalogUrl || "",
            libraryStatus: res.libraryStatus || null,
          });
          if (idx < capped.length - 1) return sleep(DELAY_MS);
        });
      });
    });

    return chain
      .then(function () {
        var yes = 0;
        var no = 0;
        var uncertain = 0;
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].status === "yes") yes++;
          else if (rows[i].status === "no") no++;
          else uncertain++;
        }
        var summary =
          place.placeLabel +
          ": " +
          yes +
          " borrowable, " +
          no +
          " not at this branch, " +
          uncertain +
          " couldn’t confirm.";
        if (skipped) {
          summary +=
            " Checked first " +
            capped.length +
            " of " +
            list.length +
            " (run again later for the rest).";
        }
        if (statusEl) statusEl.textContent = summary;
        renderResults(host, rows, {
          summary: summary,
          shortLabel: place.shortLabel,
        });
        return { rows: rows, skipped: skipped, place: place };
      })
      .finally(function () {
        setBusy(btn, false);
      });
  }

  function fillPlaceSelect(sel) {
    if (!sel) return;
    var prev = String(sel.value || "");
    var bits = ['<option value="">Choose library</option>'];
    for (var i = 0; i < PLACES.length; i++) {
      var p = PLACES[i];
      bits.push(
        '<option value="' +
          escapeHtml(p.placeId) +
          '">' +
          escapeHtml(p.placeLabel) +
          "</option>"
      );
    }
    sel.innerHTML = bits.join("");
    if (prev && findPlace(prev)) sel.value = prev;
  }

  function bind() {
    var btn = document.getElementById("wishlistLibraryCheckBtn");
    var sel = document.getElementById("wishlistLibraryPlaceSelect");
    fillPlaceSelect(sel);
    if (sel && sel.getAttribute("data-halalit-bound") !== "1") {
      sel.setAttribute("data-halalit-bound", "1");
      sel.addEventListener("change", syncCheckButton);
    }
    if (btn && btn.getAttribute("data-halalit-bound") !== "1") {
      btn.setAttribute("data-halalit-bound", "1");
      btn.addEventListener("click", function () {
        runCheck({ button: btn });
      });
    }
    if (global.document && global.document.documentElement.getAttribute("data-halalit-avail-account") !== "1") {
      global.document.documentElement.setAttribute("data-halalit-avail-account", "1");
      global.document.addEventListener("halalit-account-ready", function () {
        renderFavoritesUi();
      });
    }
    renderFavoritesUi();
    refreshWishlistTips();
    syncCheckButton();
  }

  global.HalalitLibraryAvail = {
    places: PLACES,
    favoritesKey: FAVORITES_KEY,
    loadFavorites: loadFavorites,
    saveFavorites: saveFavorites,
    favoritePlaces: favoritePlaces,
    checkOne: checkOne,
    checkAcrossFavorites: checkAcrossFavorites,
    runCheck: runCheck,
    refreshWishlistTips: refreshWishlistTips,
    bind: bind,
    apiUrl: apiUrl,
  };

  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})(typeof window !== "undefined" ? window : this);
