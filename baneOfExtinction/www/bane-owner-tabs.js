/**
 * Logic grid tab. Hidden until the player is allowed (owner, or Office switch on).
 */
(function (global) {
  var nav = global.document.querySelector("nav.site-tabs");
  if (!nav) return;

  var tab = global.document.createElement("a");
  tab.href = "grid-example.html";
  tab.id = "ownerGridTab";
  tab.textContent = "Logic grid";
  tab.hidden = true;
  if (/grid-example\.html$/i.test(global.location.pathname || "")) {
    tab.setAttribute("aria-current", "page");
  }
  nav.appendChild(tab);

  var base = "/bane-of-extinction";
  var path = global.location.pathname || "";
  var idx = path.indexOf("/bane-of-extinction");
  if (idx >= 0) base = path.slice(0, idx + "/bane-of-extinction".length);

  global
    .fetch(base + "/api/auth/me", { credentials: "include" })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (data && data.signedIn && data.logicGridEnabled) tab.hidden = false;
    })
    .catch(function () {});
})(typeof window !== "undefined" ? window : this);
