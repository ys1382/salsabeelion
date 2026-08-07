/**
 * Halalit — Available from bookstores (specific locations, not generic chains).
 * Favorites work like libraries: B&N Stevens Creek, Kepler's Menlo Park, etc.
 */
(function (global) {
  var FAVORITES_KEY = "halalitBookstoreFavoritePlaces";
  var FAVORITES_BACKUP_KEY = "halalitBookstoreFavoritePlaces_device_backup";
  var PLACES = [];

  function apiRoot() {
    var Cfg = global.HalalitBookcheckConfig;
    if (!Cfg || typeof Cfg.apiBase !== "function") return "";
    return String(Cfg.apiBase() || "").replace(/\/$/, "");
  }

  function joinApi(suffix) {
    var root = apiRoot();
    if (!root) return "";
    if (root.indexOf("/halalit/api") !== -1 || /\/api$/.test(root)) {
      return root + suffix.replace(/^\/api/, "");
    }
    return root + suffix;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeExternalHref(url) {
    var u = String(url || "").trim();
    if (!/^https?:\/\//i.test(u)) return "";
    return u;
  }

  function loadFavorites() {
    try {
      var Store = global.HalalitAccountStorage;
      var raw =
        Store && typeof Store.getItem === "function"
          ? Store.getItem(FAVORITES_KEY)
          : null;
      if (!raw && global.localStorage) {
        raw = global.localStorage.getItem(FAVORITES_BACKUP_KEY);
      }
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  function saveFavorites(ids) {
    var json = JSON.stringify(ids || []);
    try {
      var Store = global.HalalitAccountStorage;
      if (Store && typeof Store.setItem === "function") Store.setItem(FAVORITES_KEY, json);
    } catch (e) {}
    try {
      if (global.localStorage) global.localStorage.setItem(FAVORITES_BACKUP_KEY, json);
    } catch (e2) {}
  }

  function favoritePlaces() {
    var fav = loadFavorites();
    var set = Object.create(null);
    fav.forEach(function (id) {
      set[id] = true;
    });
    var out = PLACES.filter(function (p) {
      return set[p.placeId];
    });
    if (out.length) return out;
    return PLACES.filter(function (p) {
      return p.favoriteDefault;
    });
  }

  function renderFavorites() {
    var host = document.getElementById("wishlistBookstoreFavorites");
    if (!host) return;
    var fav = loadFavorites();
    var favSet = Object.create(null);
    fav.forEach(function (id) {
      favSet[id] = true;
    });
    if (!fav.length) {
      PLACES.forEach(function (p) {
        if (p.favoriteDefault) favSet[p.placeId] = true;
      });
    }
    var html =
      '<p class="library-avail__fav-heading">Your favorite bookstore locations</p>' +
      '<p class="library-avail__fav-hint">Pick specific shops (e.g. Barnes &amp; Noble on Stevens Creek), not a generic chain. Halalit does not sell books — confirm stock at that store.</p>';
    PLACES.forEach(function (p) {
      var id = "wishlistBookstoreFav_" + p.placeId;
      html +=
        '<label class="library-avail__fav-item" for="' +
        escapeHtml(id) +
        '">' +
        '<input type="checkbox" id="' +
        escapeHtml(id) +
        '" data-place-id="' +
        escapeHtml(p.placeId) +
        '"' +
        (favSet[p.placeId] ? " checked" : "") +
        " /> " +
        escapeHtml(p.placeLabel || p.shortLabel) +
        (p.city ? ' <span class="muted">(' + escapeHtml(p.city) + ")</span>" : "") +
        "</label>";
    });
    html +=
      '<div class="library-avail__add" style="margin-top:0.6rem">' +
      '<label class="library-avail__add-label" for="wishlistBookstoreAddLabel">Add a bookstore location</label>' +
      '<input type="text" class="library-avail__add-input" id="wishlistBookstoreAddLabel" placeholder="e.g. Barnes &amp; Noble — Stevens Creek, Santa Clara County" maxlength="200" />' +
      '<label class="library-avail__add-label" for="wishlistBookstoreAddUrl">Store page link (optional)</label>' +
      '<input type="url" class="library-avail__add-input" id="wishlistBookstoreAddUrl" placeholder="https://stores.barnesandnoble.com/store/…" />' +
      '<label class="library-avail__add-label" for="wishlistBookstoreAddAddress">Street address (optional)</label>' +
      '<input type="text" class="library-avail__add-input" id="wishlistBookstoreAddAddress" placeholder="3600 Stevens Creek Blvd, San Jose, CA" maxlength="200" />' +
      '<button type="button" class="import-btn library-avail__add-btn" id="wishlistBookstoreAddBtn">Add location</button>' +
      '<p class="library-avail__add-status" id="wishlistBookstoreAddStatus" aria-live="polite"></p>' +
      "</div>";
    host.innerHTML = html;

    host.querySelectorAll('input[type="checkbox"][data-place-id]').forEach(function (box) {
      box.addEventListener("change", function () {
        var next = [];
        host.querySelectorAll('input[type="checkbox"][data-place-id]').forEach(function (b) {
          if (b.checked) next.push(b.getAttribute("data-place-id"));
        });
        saveFavorites(next);
      });
    });

    var addBtn = document.getElementById("wishlistBookstoreAddBtn");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var statusEl = document.getElementById("wishlistBookstoreAddStatus");
        var labelEl = document.getElementById("wishlistBookstoreAddLabel");
        var urlEl = document.getElementById("wishlistBookstoreAddUrl");
        var addrEl = document.getElementById("wishlistBookstoreAddAddress");
        var label = labelEl ? String(labelEl.value || "").trim() : "";
        if (!label) {
          if (statusEl) statusEl.textContent = "Add a location name first.";
          return;
        }
        var endpoint = joinApi("/api/bookstore/places/add");
        if (!endpoint) {
          if (statusEl) statusEl.textContent = "API not configured.";
          return;
        }
        if (statusEl) statusEl.textContent = "Saving…";
        fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label,
            website: urlEl ? urlEl.value : "",
            streetAddress: addrEl ? addrEl.value : "",
          }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (j) {
            if (!j || !j.ok) {
              if (statusEl) statusEl.textContent = (j && j.error) || "Could not add location.";
              return;
            }
            var favs = loadFavorites();
            if (favs.indexOf(j.placeId) === -1) favs.push(j.placeId);
            saveFavorites(favs);
            if (statusEl) statusEl.textContent = "Added " + (j.placeLabel || label) + ".";
            loadPlaces().then(renderFavorites);
          })
          .catch(function () {
            if (statusEl) statusEl.textContent = "Network error adding location.";
          });
      });
    }
  }

  function loadPlaces() {
    var url = joinApi("/api/bookstore/places");
    if (!url) return Promise.resolve([]);
    return fetch(url, { credentials: "include" })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        PLACES = (j && j.places) || [];
        return PLACES;
      })
      .catch(function () {
        PLACES = [];
        return PLACES;
      });
  }

  function renderListings(host, payload) {
    if (!host) return;
    var listings = (payload && payload.listings) || [];
    var disclaimer =
      (payload && payload.disclaimer) ||
      "Specific store locations only. Confirm before visiting. Halalit does not sell books.";
    var empty =
      (payload && payload.empty_message) ||
      "None of your favorite bookstores showed this title as in stock or orderable.";

    var html = '<section class="halalit-bookstore-avail" aria-label="Available from bookstores">';
    html += "<h3>Available from your bookstore locations</h3>";
    html += '<p class="halalit-bookstore-avail__disclaimer">' + escapeHtml(disclaimer) + "</p>";

    if (!listings.length) {
      html += '<p class="halalit-bookstore-avail__empty">' + escapeHtml(empty) + "</p>";
      html += "</section>";
      host.innerHTML = html;
      return;
    }

    html += '<ul class="halalit-bookstore-avail__list">';
    listings.forEach(function (item) {
      var productHref = safeExternalHref(item.product_url);
      var storeHref = safeExternalHref(item.store_url) || productHref;
      var fresh = item.freshness || {};
      var summary = fresh.summary || fresh.label || "";
      var title = item.place_label || item.location || item.store_name || "Bookstore";
      var addr = item.address || item.street_address || "";
      var price =
        item.price != null
          ? (item.currency || "USD") + " " + Number(item.price).toFixed(2)
          : "";
      var claim = item.claim_headline || "";
      var kind = item.claim_kind || "";
      var meta = [item.condition, item.format, price].filter(Boolean).join(" · ");
      html += '<li class="halalit-bookstore-avail__item">';
      html += '<div class="halalit-bookstore-avail__meta">';
      html += "<strong>" + escapeHtml(title) + "</strong>";
      if (addr) html += "<p>" + escapeHtml(addr) + "</p>";
      if (claim) {
        html +=
          '<p class="halalit-bookstore-avail__fresh"><strong>' +
          escapeHtml(claim) +
          "</strong></p>";
      }
      if (kind === "order_online") {
        html +=
          '<p class="halalit-bookstore-avail__note">Online ordering — not a promise it’s on this store’s shelf.</p>';
      }
      if (kind === "in_stock_here") {
        html +=
          '<p class="halalit-bookstore-avail__note">Shop product page listed this as in stock — still confirm in person.</p>';
      }
      if (meta) html += "<p>" + escapeHtml(meta) + "</p>";
      if (summary && kind === "in_stock_here") {
        html +=
          '<p class="halalit-bookstore-avail__fresh">' + escapeHtml(summary) + "</p>";
      }
      html +=
        '<p class="halalit-bookstore-avail__seller">' +
        escapeHtml(item.seller_note || "Sold by this bookstore — not by Halalit.") +
        "</p>";
      html += "</div><p class=\"halalit-bookstore-avail__actions\">";
      var cta = item.cta_primary || "View at bookstore";
      if (productHref || storeHref) {
        html +=
          '<a class="import-btn" href="' +
          escapeHtml(productHref || storeHref) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(cta) +
          "</a> ";
      }
      if (storeHref && productHref && storeHref !== productHref && kind === "in_stock_here") {
        html +=
          '<a class="import-btn" href="' +
          escapeHtml(storeHref) +
          '" target="_blank" rel="noopener noreferrer">View at bookstore</a> ';
      }
      if (addr) {
        var maps =
          "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr);
        html +=
          '<a class="import-btn" href="' +
          escapeHtml(maps) +
          '" target="_blank" rel="noopener noreferrer">Get directions</a>';
      }
      html += "</p></li>";
    });
    html += "</ul></section>";
    host.innerHTML = html;
  }

  function fetchInventory(opts) {
    opts = opts || {};
    var url = joinApi("/api/bookstore/inventory");
    if (!url) {
      return Promise.resolve({
        ok: false,
        listings: [],
        empty_message: "Bookstore check is not configured on this host yet.",
      });
    }
    var placeIds = opts.placeIds;
    if (!placeIds) {
      placeIds = favoritePlaces().map(function (p) {
        return p.placeId;
      });
    }
    return fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: opts.title || "",
        author: opts.author || "",
        isbn: opts.isbn || "",
        placeIds: placeIds,
      }),
    }).then(function (r) {
      return r.json();
    });
  }

  function mountForBook(host, opts) {
    if (!host) return Promise.resolve();
    host.innerHTML =
      '<p class="halalit-bookstore-avail__loading">Checking your bookstore shelves…</p>';
    return fetchInventory(opts)
      .then(function (payload) {
        renderListings(host, payload);
      })
      .catch(function () {
        renderListings(host, {
          listings: [],
          empty_message: "Could not load bookstore listings right now.",
        });
      });
  }

  global.HalalitBookstoreAvail = {
    fetchInventory: fetchInventory,
    renderListings: renderListings,
    mountForBook: mountForBook,
    loadPlaces: loadPlaces,
    favoritePlaces: favoritePlaces,
  };

  document.addEventListener("DOMContentLoaded", function () {
    loadPlaces().then(function () {
      renderFavorites();
      if (!loadFavorites().length) {
        var defaults = PLACES.filter(function (p) {
          return p.favoriteDefault;
        }).map(function (p) {
          return p.placeId;
        });
        if (defaults.length) saveFavorites(defaults);
        renderFavorites();
      }
    });

    var btn = document.getElementById("wishlistBookstoreCheckBtn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var host = document.getElementById("wishlistBookstoreAvail");
      var books = [];
      try {
        if (global.HalalitWantToRead && typeof global.HalalitWantToRead.load === "function") {
          books = global.HalalitWantToRead.load() || [];
        }
      } catch (e) {}
      var first = books[0] || {};
      var title = first.title || first.name || "";
      var author = first.author || "";
      var isbn = first.isbn || first.isbn13 || first.isbn_13 || "";
      if (!title && !isbn) {
        renderListings(host, {
          listings: [],
          empty_message: "Add a wishlist title first, then check your favorite bookstore locations.",
        });
        return;
      }
      mountForBook(host, { title: title, author: author, isbn: isbn });
    });
  });
})(typeof window !== "undefined" ? window : globalThis);
