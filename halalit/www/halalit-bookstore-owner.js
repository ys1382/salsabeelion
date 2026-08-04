/**
 * Owner’s Office — bookstore inventory dashboard controls.
 */
(function () {
  function apiRoot() {
    var Cfg = window.HalalitBookcheckConfig;
    if (!Cfg || typeof Cfg.apiBase !== "function") return "";
    return String(Cfg.apiBase() || "").replace(/\/$/, "");
  }

  function url(path) {
    var root = apiRoot();
    if (!root) return "";
    if (root.indexOf("/halalit/api") !== -1 || /\/api$/.test(root)) {
      return root + path.replace(/^\/api/, "");
    }
    return root + path;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function loadDashboard() {
    var status = el("bookstoreDashStatus");
    var host = el("bookstoreDashStores");
    var reviews = el("bookstoreDashReviews");
    if (!host) return;
    var endpoint = url("/api/owner/bookstore/dashboard");
    if (!endpoint) {
      if (status) status.textContent = "API not configured.";
      return;
    }
    if (status) status.textContent = "Loading…";
    fetch(endpoint, { credentials: "include" })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        if (!res.ok || !res.j || !res.j.ok) {
          if (status) status.textContent = "Could not load bookstore dashboard (owner only).";
          return;
        }
        if (status) status.textContent = "";
        var stores = res.j.stores || [];
        var html = "";
        stores.forEach(function (s) {
          html += '<div class="office-section--nested" style="margin-bottom:0.6rem">';
          html +=
            "<strong>" +
            (s.name || s.store_id) +
            "</strong> <span class=\"muted\">(" +
            s.store_id +
            ")</span>";
          html +=
            "<p class=\"hint\">Active: " +
            (s.active_listings || 0) +
            " · Stale: " +
            (s.stale_listings || 0) +
            " · Unavailable: " +
            (s.unavailable_listings || 0) +
            " · Review queue: " +
            (s.match_review_pending || 0) +
            (s.paused ? " · PAUSED" : "") +
            (s.needs_repair ? " · NEEDS REPAIR" : "") +
            "</p>";
          html +=
            '<p class="hint">Last attempt: ' +
            (s.last_attempt_at ? new Date(s.last_attempt_at * 1000).toLocaleString() : "—") +
            " · Last success: " +
            (s.last_success_at ? new Date(s.last_success_at * 1000).toLocaleString() : "—") +
            "</p>";
          if (s.last_error) {
            html += '<p class="hint">Last error: ' + String(s.last_error).slice(0, 200) + "</p>";
          }
          html +=
            '<p><button type="button" class="copy-btn bookstore-run" data-store="' +
            s.store_id +
            '" data-job="' +
            (s.store_id === "sample_fixture" ? "fixture_refresh" : "isbn_watchlist") +
            '">Run now</button> ';
          html +=
            '<button type="button" class="copy-btn bookstore-pause" data-store="' +
            s.store_id +
            '" data-paused="' +
            (s.paused ? "0" : "1") +
            '">' +
            (s.paused ? "Unpause" : "Pause") +
            "</button> ";
          html +=
            '<button type="button" class="copy-btn bookstore-repair" data-store="' +
            s.store_id +
            '">Mark needs repair</button></p>';
          html += "</div>";
        });
        host.innerHTML = html || "<p class=\"hint\">No stores seeded yet.</p>";

        var rev = res.j.match_reviews || [];
        if (reviews) {
          if (!rev.length) {
            reviews.innerHTML = "<p class=\"hint\">No match reviews waiting.</p>";
          } else {
            reviews.innerHTML = rev
              .map(function (r) {
                return (
                  "<p><strong>" +
                  (r.listing_title || "Listing") +
                  "</strong> @ " +
                  (r.store_id || "") +
                  " — conf " +
                  (r.confidence != null ? r.confidence : "?") +
                  ' <button type="button" class="copy-btn bookstore-false" data-id="' +
                  r.id +
                  '">False match</button></p>'
                );
              })
              .join("");
          }
        }
      })
      .catch(function () {
        if (status) status.textContent = "Network error loading bookstore dashboard.";
      });
  }

  function post(path, body) {
    return fetch(url(path), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json();
    });
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.classList) return;
    if (t.classList.contains("bookstore-run")) {
      post("/api/owner/bookstore/run", {
        storeId: t.getAttribute("data-store"),
        jobType: t.getAttribute("data-job") || "isbn_watchlist",
      }).then(loadDashboard);
    }
    if (t.classList.contains("bookstore-pause")) {
      post("/api/owner/bookstore/flags", {
        storeId: t.getAttribute("data-store"),
        paused: t.getAttribute("data-paused") === "1",
      }).then(loadDashboard);
    }
    if (t.classList.contains("bookstore-repair")) {
      post("/api/owner/bookstore/flags", {
        storeId: t.getAttribute("data-store"),
        needsRepair: true,
        paused: true,
      }).then(loadDashboard);
    }
    if (t.classList.contains("bookstore-false")) {
      post("/api/owner/bookstore/match-review", {
        reviewId: Number(t.getAttribute("data-id")),
        action: "false_match",
      }).then(loadDashboard);
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    if (el("bookstoreDashStores")) loadDashboard();
  });

  window.HalalitBookstoreOwnerDash = { reload: loadDashboard };
})();
