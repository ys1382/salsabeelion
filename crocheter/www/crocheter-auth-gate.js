/**
 * Crocheter — require sign-in before any page except account.html.
 */
(function (global) {
  if (/account\.html$/i.test(global.location.pathname || "")) return;

  var path = global.location.pathname || "";
  var idx = path.indexOf("/crocheter");
  var base = idx >= 0 ? path.slice(0, idx + "/crocheter".length) : "/crocheter";
  var returnTo = path + (global.location.search || "") + (global.location.hash || "");

  global.document.documentElement.classList.add("auth-checking");

  global
    .fetch(base + "/api/auth/me", { credentials: "include" })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (data && data.ok && data.signedIn) {
        global.document.documentElement.classList.remove("auth-checking");
        return;
      }
      var url = base + "/account.html?return=" + encodeURIComponent(returnTo);
      if (!data || !data.signedIn) url += "&signup=1";
      global.location.replace(url);
    })
    .catch(function () {
      global.location.replace(
        base + "/account.html?signup=1&return=" + encodeURIComponent(returnTo)
      );
    });
})(typeof window !== "undefined" ? window : this);
