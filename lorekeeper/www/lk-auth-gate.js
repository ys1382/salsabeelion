/**
 * LoreKeeper — require sign-in before any page except account.html.
 */
(function (global) {
  if (/account\.html$/i.test(global.location.pathname || "")) return;

  var path = global.location.pathname || "";
  var idx = path.indexOf("/lorekeeper");
  var base = idx >= 0 ? path.slice(0, idx + "/lorekeeper".length) : "/lorekeeper";
  var returnTo = path + (global.location.search || "") + (global.location.hash || "");

  global.document.documentElement.classList.add("auth-checking");

  var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timeout = setTimeout(function () {
    if (controller) controller.abort();
  }, 12000);

  global
    .fetch(base + "/api/auth/me", {
      credentials: "include",
      signal: controller ? controller.signal : undefined,
    })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      clearTimeout(timeout);
      if (data && data.ok && data.signedIn) {
        global.document.documentElement.classList.remove("auth-checking");
        return;
      }
      var url = base + "/account.html?return=" + encodeURIComponent(returnTo);
      if (!data || !data.signedIn) url += "&signup=1";
      global.location.replace(url);
    })
    .catch(function () {
      clearTimeout(timeout);
      global.document.documentElement.classList.remove("auth-checking");
      global.location.replace(
        base +
          "/account.html?api_down=1&return=" +
          encodeURIComponent(returnTo)
      );
    });
})(typeof window !== "undefined" ? window : this);
