/**
 * Halalit — Wishlist library availability (practice).
 * Choose a library from the dropdown, then check borrowable copies at that branch
 * (checked out OK). Places: Central Park (city) + Cupertino (Santa Clara County).
 */
(function (global) {
  var BATCH_CAP = 10;
  var DELAY_MS = 400;

  /** Keep in sync with server PLACES in library_catalog_check.py */
  var PLACES = [
    {
      placeId: "santa-clara-central-park",
      placeLabel: "Santa Clara Central Park Library",
      shortLabel: "Central Park",
    },
    {
      placeId: "sccld-cupertino",
      placeLabel: "Cupertino Library (Santa Clara County)",
      shortLabel: "Cupertino",
    },
  ];

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

  function checkOne(entry, placeId) {
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

  function renderResults(host, rows, meta) {
    if (!host) return;
    var short = (meta && meta.shortLabel) || "this library";
    var bits = [];
    bits.push(
      '<p class="library-avail__summary">' +
        escapeHtml(meta.summary || "") +
        "</p>"
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

  function bind() {
    var btn = document.getElementById("wishlistLibraryCheckBtn");
    var sel = document.getElementById("wishlistLibraryPlaceSelect");
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
    syncCheckButton();
  }

  global.HalalitLibraryAvail = {
    places: PLACES,
    checkOne: checkOne,
    runCheck: runCheck,
    bind: bind,
    apiUrl: apiUrl,
  };

  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})(typeof window !== "undefined" ? window : this);
