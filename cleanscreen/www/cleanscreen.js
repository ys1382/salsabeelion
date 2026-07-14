(function (global) {
  var API = "/cleanscreen/api";
  var MODE_KEY = "cleanscreen_parent_mode";

  var form = document.getElementById("searchForm");
  var input = document.getElementById("searchInput");
  var searchBtn = document.getElementById("searchBtn");
  var searchStatus = document.getElementById("searchStatus");
  var resultsMeta = document.getElementById("resultsMeta");
  var resultsList = document.getElementById("resultsList");
  var emptyState = document.getElementById("emptyState");
  var parentModeToggle = document.getElementById("parentModeToggle");

  var feedbackToggle = document.getElementById("feedbackToggle");
  var feedbackPanel = document.getElementById("feedbackPanel");
  var feedbackText = document.getElementById("feedbackText");
  var feedbackSend = document.getElementById("feedbackSend");
  var feedbackCancel = document.getElementById("feedbackCancel");
  var feedbackStatus = document.getElementById("feedbackStatus");
  var chipButtons = document.querySelectorAll(".chip");

  var lastQuery = "";
  var feedbackKind = "general";
  var reportUrl = "";

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isParentMode() {
    return !!(parentModeToggle && parentModeToggle.checked);
  }

  function setParentMode(on) {
    if (!parentModeToggle) return;
    parentModeToggle.checked = !!on;
    try {
      if (on) global.sessionStorage.setItem(MODE_KEY, "1");
      else global.sessionStorage.removeItem(MODE_KEY);
    } catch (e) {
      /* ignore */
    }
    var url = new URL(global.location.href);
    if (on) url.searchParams.set("parent", "1");
    else url.searchParams.delete("parent");
    global.history.replaceState({}, "", url.toString());
  }

  function loadParentMode() {
    var params = new URLSearchParams(global.location.search);
    if (params.get("parent") === "1") {
      setParentMode(true);
      return;
    }
    try {
      setParentMode(global.sessionStorage.getItem(MODE_KEY) === "1");
    } catch (e2) {
      setParentMode(false);
    }
  }

  function setSearchStatus(text, isError) {
    searchStatus.textContent = text || "";
    searchStatus.classList.toggle("error", !!isError);
  }

  function readQueryFromUrl() {
    var q = new URLSearchParams(global.location.search).get("q");
    if (q) {
      input.value = q;
      runSearch(q);
    }
  }

  function renderResults(payload) {
    var kept = (payload && payload.results) || [];
    var dropped = payload.droppedCount || 0;
    var raw = payload.rawCount || 0;
    resultsList.innerHTML = "";

    if (!kept.length) {
      resultsMeta.hidden = true;
      emptyState.hidden = false;
      var modeHint = payload.parentMode
        ? " Parent mode is on — streaming, fanservice hubs, and bypass tools stay out."
        : " Kid mode uses the allowlist plus filtered open web. Try parent mode for news, forums, or shopping — or send feedback if a site should be vetted.";
      emptyState.textContent =
        raw > 0
          ? "Nothing passed the filter for this search. We removed " +
            dropped +
            " result" +
            (dropped === 1 ? "" : "s") +
            "." +
            modeHint
          : "No results came back from the search provider. Try again in a moment.";
      return;
    }

    emptyState.hidden = true;
    resultsMeta.hidden = false;
    resultsMeta.textContent =
      "Showing " +
      kept.length +
      " filtered result" +
      (kept.length === 1 ? "" : "s") +
      (dropped ? " (" + dropped + " removed)" : "") +
      (payload.parentMode ? " · parent mode" : " · kid mode") +
      (payload.provider ? " · via " + payload.provider.replace(/_/g, " ") : "");

    for (var i = 0; i < kept.length; i++) {
      var row = kept[i];
      var li = document.createElement("li");
      li.className = "result";
      li.innerHTML =
        '<h2><a href="' +
        escapeHtml(row.url) +
        '" rel="noopener noreferrer" target="_blank">' +
        escapeHtml(row.title || row.url) +
        "</a></h2>" +
        '<div class="url">' +
        escapeHtml(row.url) +
        "</div>" +
        "<p>" +
        escapeHtml(row.snippet || "") +
        "</p>" +
        '<div class="result-actions"><button type="button" class="report-btn" data-url="' +
        escapeHtml(row.url) +
        '">Report this result</button></div>';
      resultsList.appendChild(li);
    }

    var reportBtns = resultsList.querySelectorAll(".report-btn");
    for (var r = 0; r < reportBtns.length; r++) {
      reportBtns[r].addEventListener("click", onReportClick);
    }
  }

  function onReportClick(ev) {
    var btn = ev.currentTarget;
    reportUrl = btn.getAttribute("data-url") || "";
    feedbackKind = "bad_result";
    setChipKind("bad_result");
    openFeedback();
    feedbackText.value =
      "Please review this result:\n" +
      reportUrl +
      "\n\nQuery: " +
      (lastQuery || "") +
      "\nMode: " +
      (isParentMode() ? "parent" : "kid");
    feedbackText.focus();
  }

  function runSearch(query) {
    query = String(query || "").trim();
    if (query.length < 2) {
      setSearchStatus("Type at least two characters.", true);
      return;
    }
    lastQuery = query;
    reportUrl = "";
    searchBtn.disabled = true;
    setSearchStatus("Searching and filtering…");
    resultsList.innerHTML = "";
    emptyState.hidden = true;
    resultsMeta.hidden = true;

    var url = new URL(global.location.href);
    url.searchParams.set("q", query);
    if (isParentMode()) url.searchParams.set("parent", "1");
    else url.searchParams.delete("parent");
    global.history.replaceState({}, "", url.toString());

    global
      .fetch(API + "/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ q: query, parentMode: isParentMode() }),
      })
      .then(function (r) {
        return r.json().then(function (data) {
          data = data || {};
          data.httpStatus = r.status;
          return data;
        });
      })
      .then(function (data) {
        searchBtn.disabled = false;
        if (!data.ok) {
          var hint = data.hint ? " " + data.hint : "";
          setSearchStatus(
            data.error === "brave_key_missing" || data.error === "ddg_parse_empty"
              ? "Search provider is not ready on the server." + hint
              : "Search failed (" + (data.error || data.httpStatus) + ")." + hint,
            true
          );
          return;
        }
        setSearchStatus("");
        renderResults(data);
      })
      .catch(function () {
        searchBtn.disabled = false;
        setSearchStatus("Network error — try again.", true);
      });
  }

  function setChipKind(kind) {
    feedbackKind = kind || "general";
    for (var i = 0; i < chipButtons.length; i++) {
      var btn = chipButtons[i];
      var on = btn.getAttribute("data-kind") === feedbackKind;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function openFeedback() {
    feedbackPanel.hidden = false;
    feedbackToggle.setAttribute("aria-expanded", "true");
  }

  function closeFeedback() {
    feedbackPanel.hidden = true;
    feedbackToggle.setAttribute("aria-expanded", "false");
    feedbackStatus.textContent = "";
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    runSearch(input.value);
  });

  if (parentModeToggle) {
    parentModeToggle.addEventListener("change", function () {
      setParentMode(parentModeToggle.checked);
      if (lastQuery) runSearch(lastQuery);
    });
  }

  feedbackToggle.addEventListener("click", function () {
    if (feedbackPanel.hidden) openFeedback();
    else closeFeedback();
  });

  feedbackCancel.addEventListener("click", closeFeedback);

  for (var c = 0; c < chipButtons.length; c++) {
    chipButtons[c].addEventListener("click", function (ev) {
      setChipKind(ev.currentTarget.getAttribute("data-kind"));
    });
  }

  feedbackSend.addEventListener("click", function () {
    var msg = String(feedbackText.value || "").trim();
    if (!msg) {
      feedbackStatus.textContent = "Write a short note first.";
      return;
    }
    feedbackStatus.textContent = "Sending…";
    global
      .fetch(API + "/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: msg,
          kind: feedbackKind,
          query: lastQuery,
          url: reportUrl,
          parentMode: isParentMode(),
        }),
      })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.ok) {
          feedbackText.value = "";
          reportUrl = "";
          feedbackStatus.textContent = "Sent privately. Thank you.";
          global.setTimeout(closeFeedback, 1400);
          return;
        }
        feedbackStatus.textContent =
          data && data.error === "rate_limited"
            ? "Too many notes in a short time — try again later."
            : "Could not send right now.";
      })
      .catch(function () {
        feedbackStatus.textContent = "Could not send right now.";
      });
  });

  loadParentMode();
  readQueryFromUrl();
})(window);
