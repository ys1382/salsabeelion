/**
 * Halalit — Wishlist library availability.
 * Save favorite places, hit Check, then see library initials on matching wishlist spines.
 * Places: Central Park (SC) + Mission (M) + Cupertino (C, Santa Clara County).
 */
(function (global) {
  var BATCH_CAP = 10;
  var DELAY_MS = 400;
  var CLIENT_CACHE_TTL_MS = 15 * 60 * 1000;
  var FAVORITES_KEY = "halalitLibraryFavoritePlaces";

  /** Keep in sync with server PLACES in library_catalog_check.py */
  var PLACES = [
    {
      placeId: "santa-clara-central-park",
      placeLabel: "Santa Clara Central Park Library",
      shortLabel: "Central Park",
      initials: "SC",
    },
    {
      placeId: "santa-clara-mission",
      placeLabel: "Santa Clara Mission Branch Library",
      shortLabel: "Mission",
      initials: "M",
    },
    {
      placeId: "sccld-cupertino",
      placeLabel: "Cupertino Library (Santa Clara County)",
      shortLabel: "Cupertino",
      initials: "C",
    },
  ];

  var clientCache = Object.create(null);
  /** storageIndex → [{ initials, placeLabel, catalogUrl }] */
  var lastMarksByIndex = Object.create(null);

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
    // Only cache firm yes/no — not timeouts / uncertain blips.
    if (!res || (res.status !== "yes" && res.status !== "no")) return;
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
          rows.push({
            place: place,
            status: res.status || "uncertain",
            reason: res.reason || "",
            matchTitle: res.matchTitle || null,
            catalogUrl: res.catalogUrl || "",
            libraryStatus: res.libraryStatus || null,
          });
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

  function marksHtml(marks) {
    if (!marks || !marks.length) return "";
    var bits = ['<span class="bs-lib-marks" aria-hidden="true">'];
    for (var i = 0; i < marks.length; i++) {
      bits.push(
        '<span class="bs-lib-mark" title="' +
          escapeHtml(marks[i].placeLabel || marks[i].initials) +
          '">' +
          escapeHtml(marks[i].initials) +
          "</span>"
      );
    }
    bits.push("</span>");
    return bits.join("");
  }

  function listMarksHtml(marks) {
    if (!marks || !marks.length) return "";
    var labels = marks.map(function (m) {
      return m.initials;
    });
    return (
      '<span class="library-list-view__lib-marks" title="' +
      escapeHtml(
        marks
          .map(function (m) {
            return m.placeLabel || m.initials;
          })
          .join(", ")
      ) +
      '">' +
      escapeHtml(labels.join(" · ")) +
      "</span>"
    );
  }

  function clearSpineMarks() {
    lastMarksByIndex = Object.create(null);
    var stage = document.getElementById("wishlistStage");
    var list = document.getElementById("wishlistListItems");
    [stage, list].forEach(function (root) {
      if (!root) return;
      root.querySelectorAll(".bs-lib-marks, .library-list-view__lib-marks").forEach(function (el) {
        el.remove();
      });
    });
  }

  function applySpineMarks() {
    var stage = document.getElementById("wishlistStage");
    var list = document.getElementById("wishlistListItems");

    function paint(root, isList) {
      if (!root) return;
      var nodes = root.querySelectorAll("[data-halalit-index]");
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var idx = String(el.getAttribute("data-halalit-index") || "");
        var marks = lastMarksByIndex[idx];
        el.querySelectorAll(".bs-lib-marks, .library-list-view__lib-marks").forEach(function (old) {
          old.remove();
        });
        if (!marks || !marks.length) continue;
        if (isList) {
          var titleSpan = el.querySelector(".library-list-view__title");
          if (titleSpan) {
            titleSpan.insertAdjacentHTML("beforeend", " " + listMarksHtml(marks));
          } else {
            el.insertAdjacentHTML("beforeend", listMarksHtml(marks));
          }
        } else {
          if (!el.classList.contains("book-spine")) continue;
          el.classList.add("book-spine--lib-marks");
          el.insertAdjacentHTML("beforeend", marksHtml(marks));
        }
      }
    }

    paint(stage, false);
    paint(list, true);
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
      '<p class="library-avail__fav-hint">Check the places you use, then hit <strong>Check libraries</strong>. Matching wishlist spines get initials (not a hover tip). Halalit does not assume you need to borrow — only that a borrowable copy showed up.</p>'
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
          '<span class="library-avail__fav-name"><strong class="library-avail__fav-initials">' +
          escapeHtml(p.initials) +
          "</strong> " +
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
        syncCheckButton();
      });
    });
  }

  function renderLegend() {
    var host = document.getElementById("wishlistLibraryInitialsLegend");
    if (!host) return;
    var parts = [];
    for (var i = 0; i < PLACES.length; i++) {
      var p = PLACES[i];
      parts.push(
        "<strong>" +
          escapeHtml(p.initials) +
          "</strong> = " +
          escapeHtml(p.shortLabel) +
          (p.placeId === "sccld-cupertino" ? " (county)" : "")
      );
    }
    host.innerHTML =
      '<p class="library-avail__legend">' +
      "Spine initials (after Check): " +
      parts.join(" · ") +
      ". Means a <strong>borrowable</strong> copy showed in that catalog (checked out still counts). Halalit is not the library.</p>";
  }

  function renderResults(host, rows) {
    if (!host) return;
    var bits = [];
    if (!rows.length) {
      host.innerHTML = "";
      return;
    }
    bits.push('<ul class="library-avail__list" role="list">');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var title = r.title || "";
      var author = r.author || "";
      var label = author ? title + " — " + author : title;
      var initials =
        r.yesMarks && r.yesMarks.length
          ? r.yesMarks
              .map(function (m) {
                return m.initials;
              })
              .join(" · ")
          : "—";
      var detail = "";
      if (r.yesMarks && r.yesMarks.length) {
        detail =
          ' <span class="muted">(' +
          escapeHtml(
            r.yesMarks
              .map(function (m) {
                return m.placeLabel;
              })
              .join(", ")
          ) +
          ")</span>";
      } else if (r.note) {
        detail = ' <span class="muted">(' + escapeHtml(r.note) + ")</span>";
      }
      bits.push(
        '<li class="library-avail-row ' +
          (r.yesMarks && r.yesMarks.length ? "library-avail-row--yes" : "library-avail-row--no") +
          '">' +
          '<span class="library-avail-row__status">' +
          escapeHtml(initials) +
          "</span>" +
          '<span class="library-avail-row__title">' +
          escapeHtml(label) +
          detail +
          "</span></li>"
      );
    }
    bits.push("</ul>");
    host.innerHTML = bits.join("");
  }

  function syncCheckButton() {
    var btn = document.getElementById("wishlistLibraryCheckBtn");
    var places = favoritePlaces();
    if (!btn) return;
    if (btn.getAttribute("aria-busy") === "true") return;
    btn.disabled = !places.length;
    btn.textContent = places.length ? "Check libraries" : "Choose favorites first";
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
    var places = opts.places || favoritePlaces();

    if (!places.length) {
      if (statusEl) statusEl.textContent = "Choose at least one favorite library first.";
      syncCheckButton();
      return Promise.resolve({ rows: [], skipped: 0 });
    }

    var list = wishList();
    if (!list.length) {
      if (statusEl) statusEl.textContent = "Your wishlist is empty — add a title first.";
      if (host) host.innerHTML = "";
      clearSpineMarks();
      return Promise.resolve({ rows: [], skipped: 0 });
    }

    var capped = list.slice(0, BATCH_CAP);
    var skipped = Math.max(0, list.length - capped.length);
    clearSpineMarks();
    setBusy(btn, true);
    if (statusEl) {
      statusEl.textContent =
        "Checking " +
        capped.length +
        " wishlist title" +
        (capped.length === 1 ? "" : "s") +
        " at " +
        places.length +
        " favorite" +
        (places.length === 1 ? "" : "s") +
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
        return checkAcrossFavorites(entry, { places: places, delayMs: DELAY_MS }).then(
          function (result) {
            var yesMarks = (result.yes || []).map(function (r) {
              return {
                initials: r.place.initials,
                placeLabel: r.place.placeLabel,
                catalogUrl: r.catalogUrl || "",
              };
            });
            // storage index matches Want.load() order for the capped slice
            if (yesMarks.length) {
              lastMarksByIndex[String(idx)] = yesMarks;
            }
            var note = "";
            if (!yesMarks.length) {
              if (result.uncertain && result.uncertain.length) note = "couldn’t confirm";
              else note = "not at favorites";
            }
            rows.push({
              title: entry.title || "",
              author: entry.author || "",
              yesMarks: yesMarks,
              note: note,
            });
            applySpineMarks();
            if (idx < capped.length - 1) return sleep(DELAY_MS);
          }
        );
      });
    });

    return chain
      .then(function () {
        var withMarks = 0;
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].yesMarks && rows[i].yesMarks.length) withMarks++;
        }
        var summary =
          withMarks +
          " of " +
          capped.length +
          " checked title" +
          (capped.length === 1 ? "" : "s") +
          " match a favorite library (initials on the spine).";
        if (skipped) {
          summary +=
            " Checked first " +
            capped.length +
            " of " +
            list.length +
            " (run again later for the rest).";
        }
        if (statusEl) statusEl.textContent = summary;
        renderResults(host, rows);
        applySpineMarks();
        return { rows: rows, skipped: skipped, places: places };
      })
      .finally(function () {
        setBusy(btn, false);
      });
  }

  function bind() {
    var btn = document.getElementById("wishlistLibraryCheckBtn");
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
        syncCheckButton();
      });
    }
    renderFavoritesUi();
    renderLegend();
    syncCheckButton();
    applySpineMarks();
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
    applySpineMarks: applySpineMarks,
    clearSpineMarks: clearSpineMarks,
    bind: bind,
    apiUrl: apiUrl,
  };

  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})(typeof window !== "undefined" ? window : this);
