/**
 * Bane of Extinction — require Odd Trove Google sign-in before play pages.
 * Same cookie as the hub / Halalit / Crocheter / LoreKeeper (oddtrove_session).
 * Skips account.html (sign-in lives there).
 */
(function (global) {
  var path = global.location.pathname || "";
  if (/account\.html$/i.test(path)) return;

  var idx = path.indexOf("/bane-of-extinction");
  var base =
    idx >= 0 ? path.slice(0, idx + "/bane-of-extinction".length) : "/bane-of-extinction";
  var returnTo = path + (global.location.search || "") + (global.location.hash || "");

  global.document.documentElement.classList.add("auth-checking");

  function goAccount(extra) {
    var url =
      base + "/account.html?return=" + encodeURIComponent(returnTo) + (extra || "&signup=1");
    global.location.replace(url);
  }

  function allowIn() {
    global.document.documentElement.classList.remove("auth-checking");
  }

  function checkBane() {
    return global
      .fetch(base + "/api/auth/me", { credentials: "include" })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data || {} };
        });
      });
  }

  /** Hub SSO is the source of truth for Odd Trove Google. */
  function checkHub() {
    return global
      .fetch("/hub/api/auth/me", { credentials: "include" })
      .then(function (res) {
        return res.json().then(function (data) {
          return data || {};
        });
      })
      .catch(function () {
        return {};
      });
  }

  checkBane()
    .then(function (pack) {
      var data = pack.data || {};
      if (data.ok && data.signedIn) {
        allowIn();
        return;
      }
      if (pack.status === 403 || data.error === "signups_disabled") {
        goAccount("&paused=1");
        return;
      }
      // Already on Odd Trove Google? Let them in after BoE registers the account row.
      return checkHub().then(function (hub) {
        if (hub && hub.ok && hub.signedIn) {
          // Cookie is present — retry BoE once (registers player on first hit).
          return checkBane().then(function (pack2) {
            if (pack2.data && pack2.data.ok && pack2.data.signedIn) {
              allowIn();
              return;
            }
            if (pack2.status === 403 || (pack2.data && pack2.data.error === "signups_disabled")) {
              goAccount("&paused=1");
              return;
            }
            // Hub says signed in but BoE still doesn't — send to account with soft copy.
            goAccount("&sso=1");
          });
        }
        goAccount("&signup=1");
      });
    })
    .catch(function () {
      checkHub().then(function (hub) {
        if (hub && hub.ok && hub.signedIn) {
          goAccount("&sso=1");
        } else {
          goAccount("&signup=1");
        }
      });
    });
})(typeof window !== "undefined" ? window : this);
