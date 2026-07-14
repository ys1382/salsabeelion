(function () {
  var DEFAULT_API = "https://oddtrove.art/cleanscreen/api";
  var parentMode = document.getElementById("parentMode");
  var apiBase = document.getElementById("apiBase");
  var status = document.getElementById("status");

  chrome.storage.local.get({ parentMode: false, apiBase: DEFAULT_API }, function (data) {
    parentMode.checked = Boolean(data.parentMode);
    apiBase.value = data.apiBase || DEFAULT_API;
  });

  document.getElementById("save").addEventListener("click", function () {
    chrome.storage.local.set(
      {
        parentMode: parentMode.checked,
        apiBase: (apiBase.value || DEFAULT_API).replace(/\/$/, ""),
      },
      function () {
        status.textContent = "Saved.";
      }
    );
  });
})();
