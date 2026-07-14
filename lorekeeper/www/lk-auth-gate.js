/**
 * LoreKeeper — require sign-in before any page except account.html.
 * Auth check runs once in lk-account-storage.js; this script only redirects if needed.
 */
(function (global) {
  if (/account\.html$/i.test(global.location.pathname || "")) return;

  var path = global.location.pathname || "";
  var idx = path.indexOf("/lorekeeper");
  var base = idx >= 0 ? path.slice(0, idx + "/lorekeeper".length) : "/lorekeeper";
  var returnTo = path + (global.location.search || "") + (global.location.hash || "");

  global.document.documentElement.classList.add("auth-checking");

  function finish(signedIn) {
    global.document.documentElement.classList.remove("auth-checking");
    if (signedIn) return;
    global.location.replace(base + "/account.html?return=" + encodeURIComponent(returnTo) + "&signup=1");
  }

  if (global.LoreKeeperAccountStorage && global.LoreKeeperAccountStorage.ready) {
    global.LoreKeeperAccountStorage.ready.then(function () {
      finish(global.LoreKeeperAccountStorage.isSignedIn());
    });
    return;
  }

  global.addEventListener("lorekeeper-account-ready", function (ev) {
    var signedIn = ev && ev.detail ? !!ev.detail.signedIn : false;
    finish(signedIn);
  });
})(typeof window !== "undefined" ? window : this);
