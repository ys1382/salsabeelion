(function () {
  var Policy = window.HalalFlicksPolicy;
  var Shelf = window.HalalFlicksShelf;
  var Prefs = window.HalalFlicksPrefs;
  var lastCatalog = [];

  function apiUrl(path) {
    return window.location.origin + "/halalflicks/api" + path;
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function setTab(which) {
    var tabs = ["flickcheck", "recommend", "shelf"];
    tabs.forEach(function (name) {
      var on = which === name;
      var tab = document.getElementById("tab-" + name);
      var panel = document.getElementById("panel-" + name);
      if (tab) {
        tab.classList.toggle("active", on);
        tab.setAttribute("aria-selected", on ? "true" : "false");
      }
      if (panel) panel.hidden = !on;
    });
    if (which === "shelf") renderShelf();
    if (which === "recommend") {
      fillPrefsForm();
      if (!lastCatalog.length) loadRecommendations("");
    }
  }

  function renderShelf() {
    var list = Shelf.load();
    var ul = document.getElementById("shelfList");
    ul.innerHTML = "";
    if (!list.length) {
      var empty = document.createElement("li");
      empty.className = "muted";
      empty.textContent = "No movies saved yet.";
      ul.appendChild(empty);
      return;
    }
    list.forEach(function (row) {
      var li = document.createElement("li");
      var label = document.createElement("span");
      var year = row.year ? " (" + row.year + ")" : "";
      label.innerHTML =
        "<strong>" +
        esc(row.title) +
        "</strong>" +
        esc(year) +
        ' <span class="muted">(' +
        esc(Shelf.tagLabel(row.tag)) +
        ")</span>";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Remove";
      btn.addEventListener("click", function () {
        Shelf.remove(row.title, row.year);
        renderShelf();
      });
      li.appendChild(label);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  function searchLink(service, title, year) {
    var q = encodeURIComponent((title + " " + (year || "") + " movie").trim());
    if (service === "justwatch") return "https://www.justwatch.com/us/search?q=" + encodeURIComponent(title);
    if (service === "imdb") return "https://www.imdb.com/find/?q=" + q;
    return "https://www.youtube.com/results?search_query=" + q + "+trailer";
  }

  function scoreMovie(movie, prefs) {
    var score = 0;
    var themes = (movie.themes || []).map(function (t) {
      return String(t).toLowerCase();
    });
    var blob = (
      (movie.title || "") +
      " " +
      (movie.year || "") +
      " " +
      (movie.note || "") +
      " " +
      themes.join(" ")
    ).toLowerCase();
    Prefs.tokens(prefs.likes).forEach(function (tok) {
      if (themes.indexOf(tok) >= 0) score += 4;
      else if (blob.indexOf(tok) >= 0) score += 2;
    });
    Prefs.tokens(prefs.dislikes).forEach(function (tok) {
      if (themes.indexOf(tok) >= 0 || blob.indexOf(tok) >= 0) score -= 5;
    });
    if (!prefs.animationOk && themes.indexOf("animation") >= 0) score -= 8;
    return score;
  }

  function rankCatalog(movies) {
    var prefs = Prefs.load();
    return movies
      .slice()
      .map(function (movie) {
        return { movie: movie, score: scoreMovie(movie, prefs) };
      })
      .filter(function (row) {
        return row.score > -5;
      })
      .sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.movie.title || "").localeCompare(String(b.movie.title || ""));
      })
      .map(function (row) {
        return row.movie;
      });
  }

  function fillPrefsForm() {
    var prefs = Prefs.load();
    document.getElementById("prefsLikes").value = prefs.likes || "";
    document.getElementById("prefsDislikes").value = prefs.dislikes || "";
    document.getElementById("prefsAnimation").checked = prefs.animationOk !== false;
  }

  function renderRecommendations(movies) {
    var ul = document.getElementById("recommendList");
    ul.innerHTML = "";
    var ranked = rankCatalog(movies || []);
    if (!ranked.length) {
      var empty = document.createElement("li");
      empty.className = "muted";
      empty.textContent =
        "No curated matches yet — add titles to the owner catalog, or clear the search to browse all.";
      ul.appendChild(empty);
      return;
    }
    ranked.forEach(function (movie) {
      var li = document.createElement("li");
      var year = movie.year ? " (" + movie.year + ")" : "";
      var themes = (movie.themes || []).join(", ");
      li.innerHTML =
        "<strong>" +
        esc(movie.title) +
        "</strong>" +
        esc(year) +
        (movie.note ? '<p class="rec-meta">' + esc(movie.note) + "</p>" : "") +
        (themes ? '<p class="rec-themes">Themes: ' + esc(themes) + "</p>" : "");
      var actions = document.createElement("div");
      actions.className = "rec-actions";

      var shelfBtn = document.createElement("button");
      shelfBtn.type = "button";
      shelfBtn.textContent = "Add to shelf";
      shelfBtn.addEventListener("click", function () {
        Shelf.add({ title: movie.title, year: movie.year || "", tag: "want" });
        shelfBtn.textContent = "On shelf";
      });

      var checkBtn = document.createElement("button");
      checkBtn.type = "button";
      checkBtn.textContent = "Flickcheck";
      checkBtn.addEventListener("click", function () {
        document.getElementById("movieTitle").value = movie.title || "";
        document.getElementById("movieYear").value = movie.year || "";
        setTab("flickcheck");
        document.getElementById("flickcheckForm").requestSubmit();
      });

      var jw = document.createElement("a");
      jw.href = searchLink("justwatch", movie.title, movie.year);
      jw.target = "_blank";
      jw.rel = "noopener noreferrer";
      jw.textContent = "JustWatch search";

      var yt = document.createElement("a");
      yt.href = searchLink("youtube", movie.title, movie.year);
      yt.target = "_blank";
      yt.rel = "noopener noreferrer";
      yt.textContent = "Trailer search";

      actions.appendChild(shelfBtn);
      actions.appendChild(checkBtn);
      actions.appendChild(jw);
      actions.appendChild(yt);
      li.appendChild(actions);
      ul.appendChild(li);
    });
  }

  function loadRecommendations(theme) {
    var status = document.getElementById("recommendStatus");
    var btn = document.getElementById("recommendBtn");
    var q = (theme || "").trim();
    status.textContent = q ? "Matching curated movies…" : "Loading curated list…";
    btn.disabled = true;
    var url = apiUrl("/recommend/catalog") + (q ? "?theme=" + encodeURIComponent(q) : "");
    return fetch(url, { credentials: "include" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok) {
          status.textContent = "Could not load recommendations.";
          lastCatalog = [];
          renderRecommendations([]);
          return;
        }
        lastCatalog = data.movies || [];
        status.textContent =
          lastCatalog.length +
          (q
            ? " match" + (lastCatalog.length === 1 ? "" : "es") + " for “" + q + "”"
            : " curated movie" + (lastCatalog.length === 1 ? "" : "s")) +
          " — still check yourself before watching.";
        renderRecommendations(lastCatalog);
      })
      .catch(function () {
        status.textContent = "Network error — try again.";
        lastCatalog = [];
        renderRecommendations([]);
      })
      .finally(function () {
        btn.disabled = false;
      });
  }

  function badgeClass(recOk, recStatus) {
    if (recStatus === "hand_vetted") return recOk ? "ok" : "bad";
    if (recOk || recStatus === "likely_ok") return "ok";
    if (recStatus === "likely_no_recommend") return "bad";
    return "warn";
  }

  function renderScanDetails(scan) {
    var html = "";
    if (scan.problem_notes && scan.problem_notes.length) {
      html += '<ul class="theme-list">';
      scan.problem_notes.forEach(function (note) {
        html += "<li>" + esc(note) + "</li>";
      });
      html += "</ul>";
    }
    if (scan.themes && scan.themes.length) {
      var flagged = scan.themes.filter(function (row) {
        return row.present;
      });
      if (flagged.length) {
        html += '<ul class="theme-list">';
        flagged.forEach(function (row) {
          html +=
            "<li><strong>" +
            esc(Policy.themeLabel(row.id)) +
            "</strong>" +
            (row.brief ? " — " + esc(row.brief) : "") +
            (row.confidence && row.confidence !== "unknown"
              ? ' <span class="muted">(' + esc(row.confidence) + ")</span>"
              : "") +
            "</li>";
        });
        html += "</ul>";
      }
    }
    return html;
  }

  function renderSynopsisExpandable(text, source) {
    if (!text) return "";
    var label =
      source === "wikipedia"
        ? "Plot (Wikipedia fallback)"
        : source === "user"
          ? "Synopsis you pasted"
          : "Synopsis";
    return (
      '<details class="synopsis-expand">' +
      "<summary>" +
      esc(label) +
      "</summary>" +
      '<div class="synopsis-body">' +
      esc(text) +
      "</div></details>"
    );
  }

  function renderResult(data) {
    var box = document.getElementById("flickcheckResult");
    box.hidden = false;
    var year = data.year ? " (" + data.year + ")" : "";
    var html = "<h2>" + esc(data.title) + esc(year) + "</h2>";

    if (data.wikipedia && data.wikipedia.title) {
      html += '<p class="muted">Matched: ' + esc(data.wikipedia.title);
      if (data.wikipedia.description) html += " — " + esc(data.wikipedia.description);
      html += "</p>";
    }

    if (data.handVetted && data.handNote) {
      html +=
        '<p><span class="badge ' +
        (data.recOk ? "ok" : "bad") +
        '">Hand-vetted</span> ' +
        esc(data.handNote) +
        "</p>";
    } else if (data.recStatus === "unknown") {
      html += '<p><span class="badge warn">Not hand-vetted yet</span></p>';
    }

    var scan = data.aiScan || {};
    if (scan.ok && !scan.skipped) {
      html +=
        '<p><span class="badge ' +
        badgeClass(data.recOk, data.recStatus) +
        '">AI scan</span> ' +
        esc(Policy.recHintLabel(scan.rec_hint)) +
        "</p>";
      if (scan.summary) {
        html += '<p class="scan-summary">' + esc(scan.summary) + "</p>";
      }
      html += renderSynopsisExpandable(data.synopsisText, data.synopsisSource);
      html += renderScanDetails(scan);
    } else if (scan.skipped) {
      html += renderSynopsisExpandable(data.synopsisText, data.synopsisSource);
    } else if (scan.error === "no_synopsis") {
      html +=
        '<p class="muted">No synopsis found. Paste a plot summary (or trailer notes) and run Flickcheck again.</p>';
    } else if (scan.error === "gemini_key_missing") {
      html += '<p class="muted">Google scan not configured on server yet.</p>';
    } else if (scan.error) {
      html += '<p class="muted">AI scan unavailable (' + esc(scan.error) + ").</p>";
      html += renderSynopsisExpandable(data.synopsisText, data.synopsisSource);
    }

    var actions = document.createElement("div");
    actions.className = "rec-actions";
    actions.style.marginTop = "0.85rem";

    box.innerHTML = html;

    var shelfBtn = document.createElement("button");
    shelfBtn.type = "button";
    shelfBtn.textContent = "Add to shelf";
    shelfBtn.addEventListener("click", function () {
      Shelf.add({ title: data.title, year: data.year || "", tag: "want" });
      shelfBtn.textContent = "On shelf";
    });
    actions.appendChild(shelfBtn);

    var jw = document.createElement("a");
    jw.href = searchLink("justwatch", data.title, data.year);
    jw.target = "_blank";
    jw.rel = "noopener noreferrer";
    jw.textContent = "JustWatch search";
    actions.appendChild(jw);

    box.appendChild(actions);
  }

  document.getElementById("tab-flickcheck").addEventListener("click", function () {
    setTab("flickcheck");
  });
  document.getElementById("tab-recommend").addEventListener("click", function () {
    setTab("recommend");
  });
  document.getElementById("tab-shelf").addEventListener("click", function () {
    setTab("shelf");
  });

  document.getElementById("flickcheckForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var title = document.getElementById("movieTitle").value.trim();
    var year = document.getElementById("movieYear").value.trim();
    var synopsis = document.getElementById("movieSynopsis").value.trim();
    var status = document.getElementById("flickcheckStatus");
    var btn = document.getElementById("flickcheckBtn");
    if (!title) {
      status.textContent = "Enter a movie title.";
      return;
    }
    status.textContent = "Running Flickcheck…";
    btn.disabled = true;
    document.getElementById("flickcheckResult").hidden = true;

    fetch(apiUrl("/flickcheck"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title: title, year: year, synopsis: synopsis }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          data.httpStatus = res.status;
          return data;
        });
      })
      .then(function (data) {
        if (!data.ok && data.error === "title_required") {
          status.textContent = "Enter a movie title.";
          return;
        }
        if (!data.ok) {
          status.textContent = "Flickcheck failed — try again.";
          return;
        }
        status.textContent = "Done.";
        renderResult(data);
      })
      .catch(function () {
        status.textContent = "Network error — try again.";
      })
      .finally(function () {
        btn.disabled = false;
      });
  });

  document.getElementById("recommendForm").addEventListener("submit", function (e) {
    e.preventDefault();
    loadRecommendations(document.getElementById("recommendTheme").value);
  });

  document.getElementById("prefsForm").addEventListener("submit", function (e) {
    e.preventDefault();
    Prefs.save({
      likes: document.getElementById("prefsLikes").value,
      dislikes: document.getElementById("prefsDislikes").value,
      animationOk: document.getElementById("prefsAnimation").checked,
    });
    document.getElementById("prefsStatus").textContent = "Preferences saved on this browser.";
    renderRecommendations(lastCatalog);
  });

  document.getElementById("prefsClear").addEventListener("click", function () {
    Prefs.clear();
    fillPrefsForm();
    document.getElementById("prefsStatus").textContent = "Preferences cleared.";
    renderRecommendations(lastCatalog);
  });

  document.getElementById("shelfAddForm").addEventListener("submit", function (e) {
    e.preventDefault();
    Shelf.add({
      title: document.getElementById("shelfTitle").value,
      year: document.getElementById("shelfYear").value,
      tag: document.getElementById("shelfTag").value,
    });
    document.getElementById("shelfTitle").value = "";
    document.getElementById("shelfYear").value = "";
    renderShelf();
  });
})();
