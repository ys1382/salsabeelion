(function () {
  var DEFAULT_API = "https://oddtrove.art/cleanscreen/api";

  function apiBase() {
    return new Promise(function (resolve) {
      chrome.storage.local.get({ apiBase: DEFAULT_API }, function (data) {
        resolve(String(data.apiBase || DEFAULT_API).replace(/\/$/, ""));
      });
    });
  }

  function parentMode() {
    return new Promise(function (resolve) {
      chrome.storage.local.get({ parentMode: false }, function (data) {
        resolve(Boolean(data.parentMode));
      });
    });
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || msg.type !== "check") {
      return false;
    }
    Promise.all([apiBase(), parentMode()])
      .then(function (parts) {
        var base = parts[0];
        var mode = parts[1];
        return fetch(base + "/check", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: msg.url || "",
            title: msg.title || "",
            snippet: msg.snippet || "",
            parentMode: mode,
          }),
        }).then(function (resp) {
          return resp.json().then(function (body) {
            return { status: resp.status, body: body };
          });
        });
      })
      .then(function (result) {
        sendResponse(result);
      })
      .catch(function (err) {
        sendResponse({
          status: 0,
          body: { ok: false, error: "network_failed", detail: String(err) },
        });
      });
    return true;
  });
})();
