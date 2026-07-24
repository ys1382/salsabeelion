/**
 * Bane of Extinction — require Odd Trove Google sign-in before play pages.
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

  global
    .fetch(base + "/api/auth/me", { credentials: "include" })
    .then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    })
    .then(function (pack) {
      var data = pack.data || {};
      if (data && data.ok && data.signedIn) {
        global.document.documentElement.classList.remove("auth-checking");
        return;
      }
      var url = base + "/account.html?return=" + encodeURIComponent(returnTo);
      if (pack.status === 403 || (data && data.error === "signups_disabled")) {
        url += "&paused=1";
      } else {
        url += "&signup=1";
      }
      global.location.replace(url);
    })
    .catch(function () {
      global.location.replace(
        base + "/account.html?signup=1&return=" + encodeURIComponent(returnTo)
      );
    });
})(typeof window !== "undefined" ? window : this);
