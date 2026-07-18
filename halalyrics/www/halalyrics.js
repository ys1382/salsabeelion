(function () {
  var Policy = window.HalaLyricsPolicy;
  var Shelf = window.HalaLyricsShelf;
  var Prefs = window.HalaLyricsPrefs;
  var lastCatalog = [];

  function apiUrl(path) {
    var base = window.location.origin + "/halalyrics/api";
    return base + path;
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function setTab(which) {
    var tabs = ["songcheck", "recommend", "shelf"];
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
      empty.textContent = "No songs saved yet.";
      ul.appendChild(empty);
      return;
    }
    list.forEach(function (row) {
      var li = document.createElement("li");
      var label = document.createElement("span");
      var artist = row.artist ? " — " + row.artist : "";
      label.innerHTML =
        "<strong>" +
        esc(row.title) +
        "</strong>" +
        esc(artist) +
        ' <span class="muted">(' +
        esc(Shelf.tagLabel(row.tag)) +
        ")</span>";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Remove";
      btn.addEventListener("click", function () {
        Shelf.remove(row.title, row.artist);
        renderShelf();
      });
      li.appendChild(label);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  function searchLink(service, title, artist) {
    var q = encodeURIComponent((title + " " + (artist || "")).trim());
    if (service === "spotify") return "https://open.spotify.com/search/" + q;
    if (service === "ytmusic") return "https://music.youtube.com/search?q=" + q;
    return "https://www.youtube.com/results?search_query=" + q;
  }

  function scoreSong(song, prefs) {
    var score = 0;
    var themes = (song.themes || []).map(function (t) {
      return String(t).toLowerCase();
    });
    var blob = (
      (song.title || "") +
      " " +
      (song.artist || "") +
      " " +
      (song.note || "") +
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
    if (prefs.preferInstrumentals && themes.indexOf("instrumental") >= 0) score += 3;
    if (!prefs.disneyKidsOk && themes.indexOf("disney_kids") >= 0) score -= 8;
    return score;
  }

  function rankCatalog(songs) {
    var prefs = Prefs.load();
    return songs
      .slice()
      .map(function (song) {
        return { song: song, score: scoreSong(song, prefs) };
      })
      .filter(function (row) {
        return row.score > -5;
      })
      .sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.song.title || "").localeCompare(String(b.song.title || ""));
      })
      .map(function (row) {
        return row.song;
      });
  }

  function fillPrefsForm() {
    var prefs = Prefs.load();
    document.getElementById("prefsLikes").value = prefs.likes || "";
    document.getElementById("prefsDislikes").value = prefs.dislikes || "";
    document.getElementById("prefsInstrumentals").checked = !!prefs.preferInstrumentals;
    document.getElementById("prefsDisney").checked = prefs.disneyKidsOk !== false;
  }

  function renderRecommendations(songs) {
    var ul = document.getElementById("recommendList");
    ul.innerHTML = "";
    var ranked = rankCatalog(songs || []);
    if (!ranked.length) {
      var empty = document.createElement("li");
      empty.className = "muted";
      empty.textContent = "No curated matches yet — try another theme, or clear the search to browse all.";
      ul.appendChild(empty);
      return;
    }
    ranked.forEach(function (song) {
      var li = document.createElement("li");
      var artist = song.artist ? " — " + song.artist : "";
      var themes = (song.themes || []).join(", ");
      li.innerHTML =
        "<strong>" +
        esc(song.title) +
        "</strong>" +
        esc(artist) +
        (song.note ? '<p class="rec-meta">' + esc(song.note) + "</p>" : "") +
        (themes ? '<p class="rec-themes">Themes: ' + esc(themes) + "</p>" : "");
      var actions = document.createElement("div");
      actions.className = "rec-actions";

      var shelfBtn = document.createElement("button");
      shelfBtn.type = "button";
      shelfBtn.textContent = "Add to shelf";
      shelfBtn.addEventListener("click", function () {
        Shelf.add({ title: song.title, artist: song.artist || "", tag: "want" });
        shelfBtn.textContent = "On shelf";
      });

      var checkBtn = document.createElement("button");
      checkBtn.type = "button";
      checkBtn.textContent = "Songcheck";
      checkBtn.addEventListener("click", function () {
        document.getElementById("songTitle").value = song.title || "";
        document.getElementById("songArtist").value = song.artist || "";
        setTab("songcheck");
        document.getElementById("songcheckForm").requestSubmit();
      });

      var spotify = document.createElement("a");
      spotify.href = searchLink("spotify", song.title, song.artist);
      spotify.target = "_blank";
      spotify.rel = "noopener noreferrer";
      spotify.textContent = "Spotify search";

      var yt = document.createElement("a");
      yt.href = searchLink("ytmusic", song.title, song.artist);
      yt.target = "_blank";
      yt.rel = "noopener noreferrer";
      yt.textContent = "YT Music search";

      actions.appendChild(shelfBtn);
      actions.appendChild(checkBtn);
      actions.appendChild(spotify);
      actions.appendChild(yt);
      li.appendChild(actions);
      ul.appendChild(li);
    });
  }

  function loadRecommendations(theme) {
    var status = document.getElementById("recommendStatus");
    var btn = document.getElementById("recommendBtn");
    var q = (theme || "").trim();
    status.textContent = q ? "Matching curated songs…" : "Loading curated list…";
    btn.disabled = true;
    var url = apiUrl("/recommend/catalog") + (q ? "?theme=" + encodeURIComponent(q) : "");
    return fetch(url)
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
        lastCatalog = data.songs || [];
        status.textContent =
          lastCatalog.length +
          (q ? " match" + (lastCatalog.length === 1 ? "" : "es") + " for “" + q + "”" : " curated song" + (lastCatalog.length === 1 ? "" : "s")) +
          " — still check yourself before listening.";
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
    if (recOk) return "ok";
    return "warn";
  }


  function renderScanSummary(scan, streaming) {
    if (!scan.summary && !streaming) return "";
    var cls = "scan-summary" + (streaming ? " scanning" : "");
    return '<p class="' + cls + '" id="scanSummaryLive">' + esc(scan.summary || "") + "</p>";
  }

  function renderScanDetails(scan) {
    var html = "";
    if (scan.word_refs && scan.word_refs.length) {
      html += "<p><strong>Language flags:</strong> " + esc(scan.word_refs.join("; ")) + "</p>";
    }
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

  function renderLyricsExpandable(lyricsText, sourceLabel) {
    if (!lyricsText) return "";
    var source =
      sourceLabel === "lrclib"
        ? '<p class="muted lyrics-source">From LRCLIB — expand to preview.</p>'
        : "";
    return (
      '<details class="lyrics-expand">' +
      '<summary class="lyrics-expand-summary">' +
      '<span class="lyrics-expand-title"><strong>Lyrics</strong></span>' +
      '<span class="lyrics-expand-toggle" aria-hidden="true"></span>' +
      "</summary>" +
      '<div class="lyrics-expand-body">' +
      '<pre class="lyrics-text">' +
      esc(lyricsText) +
      "</pre>" +
      source +
      "</div></details>"
    );
  }

  function renderPartialResult(lookup) {
    var box = document.getElementById("songcheckResult");
    box.hidden = false;
    var artist = lookup.artist ? " — " + lookup.artist : "";
    var html = "<h2>" + esc(lookup.title) + esc(artist) + "</h2>";

    if (lookup.lrclib && lookup.lrclib.albumName) {
      html += '<p class="muted">Album: ' + esc(lookup.lrclib.albumName) + "</p>";
    }

    if (lookup.handVetted && lookup.handNote) {
      html +=
        '<p><span class="badge ' +
        (lookup.recOk ? "ok" : "bad") +
        '">Hand-vetted</span> ' +
        esc(lookup.handNote) +
        "</p>";
    } else {
      html += '<p><span class="badge warn">Not hand-vetted yet</span></p>';
    }

    if (lookup.lyricsText) {
      html += renderLyricsExpandable(lookup.lyricsText, lookup.lyricsSource);
    }

    html +=
      '<p class="scan-status scanning" id="scanStatusLine">' +
      '<span class="scan-pulse" aria-hidden="true"></span> Scanning themes…</p>';
    html += renderScanSummary({ summary: "" }, true);
    html += '<div id="scanDetailsSlot"></div>';

    box.innerHTML = html;
  }

  function updateStreamingSummary(text) {
    var el = document.getElementById("scanSummaryLive");
    if (el) {
      el.textContent = text || "";
      el.classList.remove("scanning");
    }
    var status = document.getElementById("scanStatusLine");
    if (status && text) {
      status.textContent = "Reading scan…";
      status.classList.remove("scanning");
    }
  }

  function renderResult(data) {
    var box = document.getElementById("songcheckResult");
    box.hidden = false;
    var artist = data.artist ? " — " + data.artist : "";
    var html = "<h2>" + esc(data.title) + esc(artist) + "</h2>";

    if (data.lrclib && data.lrclib.albumName) {
      html += '<p class="muted">Album: ' + esc(data.lrclib.albumName) + "</p>";
    }

    if (data.handVetted && data.handNote) {
      html +=
        '<p><span class="badge ' +
        (data.recOk ? "ok" : "bad") +
        '">Hand-vetted</span> ' +
        esc(data.handNote) +
        "</p>";
    } else if (!data.instrumental && data.recStatus === "unknown") {
      html += '<p><span class="badge warn">Not hand-vetted yet</span></p>';
    }

    var scan = data.aiScan || {};
    if (scan.ok) {
      html +=
        '<p><span class="badge ' +
        badgeClass(data.recOk, data.recStatus) +
        '">AI scan</span> ' +
        esc(Policy.recHintLabel(scan.rec_hint)) +
        "</p>";
      html += renderScanSummary(scan, false);
      if (data.lyricsText) {
        html += renderLyricsExpandable(data.lyricsText, data.lyricsSource);
      }
      html += renderScanDetails(scan);
      if (!data.lyricsText && data.lyricsSource && data.lyricsSource !== "none") {
        html +=
          '<p class="muted">Lyrics were scanned but not shown here — Songcheck flagged concerns for a strict rec list.</p>';
      }
    } else if (data.instrumental || scan.error === "instrumental") {
      html +=
        '<p><span class="badge ok">Instrumental</span> LRCLIB lists this track but has no lyrics — likely instrumental. Songcheck scans words only; use your own judgment for family-friendly picks.</p>';
      if (data.lrclib && data.lrclib.albumName) {
        html += '<p class="muted">Album: ' + esc(data.lrclib.albumName) + "</p>";
      }
    } else if (scan.error === "no_lyrics") {
      html += '<p class="muted">No lyrics found in LRCLIB for this title and artist. Songcheck cannot run without them.</p>';
    } else if (scan.error === "gemini_key_missing") {
      html += '<p class="muted">Google scan not configured on server yet.</p>';
    } else if (scan.error) {
      html += '<p class="muted">AI scan unavailable (' + esc(scan.error) + ").</p>";
    }

    if (!scan.ok && data.lyricsText) {
      html += renderLyricsExpandable(data.lyricsText, data.lyricsSource);
    }

    box.innerHTML = html;
  }

  function songcheckErrorMessage(data) {
    var code = data && data.error;
    if (code === "lrclib_error") return "Lyrics lookup timed out — try again in a moment.";
    if (code === "server_error") return "Server hiccup — try again.";
    if (code === "title_required") return "Enter a song title.";
    return code || "Songcheck failed.";
  }

  function isRetryableSongcheckFailure(data, httpStatus) {
    if (!data) return true;
    if (data.ok) return false;
    if (data.error === "no_lyrics" || data.error === "title_required") return false;
    if (data.error === "lrclib_error" || data.error === "server_error") return true;
    if (httpStatus === 502 || httpStatus === 504) return true;
    return false;
  }

  function mergeLookupScan(lookup, scan) {
    var merged = {
      ok: true,
      title: lookup.title,
      artist: lookup.artist,
      lyricsSource: lookup.lyricsSource || "lrclib",
      lyricsFound: !!lookup.lyricsFound,
      handVetted: lookup.handVetted,
      handNote: scan.handNote || lookup.handNote,
      recOk: scan.recOk,
      recStatus: scan.recStatus,
      lrclib: lookup.lrclib || scan.lrclib,
      aiScan: scan.aiScan || {},
      instrumental: lookup.instrumental,
    };
    if (scan.lyricsText) merged.lyricsText = scan.lyricsText;
    else if (lookup.lyricsText) merged.lyricsText = lookup.lyricsText;
    return merged;
  }

  function fetchJson(path, body) {
    return fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (data) {
        data.httpStatus = r.status;
        return data;
      });
    });
  }

  function parseSseChunk(buffer) {
    var events = [];
    var parts = buffer.split("\n\n");
    var rest = parts.pop() || "";
    parts.forEach(function (block) {
      if (!block.trim()) return;
      var eventName = "message";
      var dataLine = "";
      block.split("\n").forEach(function (line) {
        if (line.indexOf("event:") === 0) eventName = line.slice(6).trim();
        if (line.indexOf("data:") === 0) dataLine = line.slice(5).trim();
      });
      if (!dataLine) return;
      try {
        events.push({ event: eventName, data: JSON.parse(dataLine) });
      } catch (e) {
        /* ignore malformed chunk */
      }
    });
    return { events: events, rest: rest };
  }

  function streamScan(lookup, attempt) {
    var status = document.getElementById("songcheckStatus");
    status.textContent = "Scanning themes…";

    return fetch(apiUrl("/songcheck/scan/stream"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: lookup.title,
        artist: lookup.artist,
        lyrics: lookup.lyricsText,
        handVetted: lookup.handVetted,
        lrclib: lookup.lrclib,
      }),
    })
      .then(function (response) {
        if (!response.ok && response.status !== 200) {
          return response.text().then(function () {
            throw { httpStatus: response.status, error: "server_error" };
          });
        }
        if (!response.body || !response.body.getReader) {
          return fetchJson("/songcheck/scan", {
            title: lookup.title,
            artist: lookup.artist,
            lyrics: lookup.lyricsText,
            handVetted: lookup.handVetted,
          }).then(function (scan) {
            if (!scan.ok) throw scan;
            status.textContent = "Done.";
            renderResult(mergeLookupScan(lookup, scan));
          });
        }

        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";
        var finalResult = null;
        var scanError = null;

        function pump() {
          return reader.read().then(function (chunk) {
            if (chunk.done) {
              if (scanError) throw scanError;
              if (finalResult) {
                status.textContent = "Done.";
                renderResult(mergeLookupScan(lookup, finalResult));
                return;
              }
              throw { error: "server_error" };
            }
            buffer += decoder.decode(chunk.value, { stream: true });
            var parsed = parseSseChunk(buffer);
            buffer = parsed.rest;
            parsed.events.forEach(function (ev) {
              if (ev.event === "partial" && ev.data.summary) {
                updateStreamingSummary(ev.data.summary);
              } else if (ev.event === "error") {
                scanError = ev.data;
              } else if (ev.event === "result") {
                finalResult = ev.data;
              }
            });
            return pump();
          });
        }

        return pump();
      })
      .catch(function (err) {
        if (isRetryableSongcheckFailure(err, err && err.httpStatus) && attempt < 2) {
          return new Promise(function (resolve) {
            setTimeout(resolve, 500);
          }).then(function () {
            return runSongcheck(lookup.title, lookup.artist, attempt + 1);
          });
        }
        status.textContent = songcheckErrorMessage(err);
        renderResult(
          mergeLookupScan(lookup, {
            aiScan: (err && err.aiScan) || { ok: false, error: (err && err.error) || "gemini_network_error" },
          })
        );
      });
  }

  function runSongcheck(title, artist, attempt) {
    var status = document.getElementById("songcheckStatus");
    status.textContent =
      attempt > 1 ? "Lyrics lookup was slow — retrying once…" : "Looking up lyrics…";
    document.getElementById("songcheckResult").hidden = true;

    return fetchJson("/songcheck/lookup", { title: title, artist: artist })
      .then(function (lookup) {
        if (lookup.cached && lookup.full) {
          status.textContent = "Done.";
          renderResult(lookup.full);
          return;
        }
        if (!lookup.ok) {
          if (isRetryableSongcheckFailure(lookup, lookup.httpStatus) && attempt < 2) {
            return new Promise(function (resolve) {
              setTimeout(resolve, 500);
            }).then(function () {
              return runSongcheck(title, artist, attempt + 1);
            });
          }
          if (lookup.error === "no_lyrics") {
            status.textContent = "No lyrics found in LRCLIB — Songcheck cannot run.";
            if (lookup.handVetted && lookup.handNote) {
              renderResult({
                ok: true,
                title: title,
                artist: artist,
                handVetted: lookup.handVetted,
                handNote: lookup.handNote,
                recOk: lookup.recOk,
                recStatus: "hand_vetted",
                lyricsSource: "none",
                aiScan: { ok: false, error: "no_lyrics" },
              });
            }
          } else {
            status.textContent = songcheckErrorMessage(lookup);
          }
          return;
        }
        if (lookup.instrumental) {
          status.textContent = "Done.";
          renderResult(lookup);
          return;
        }
        renderPartialResult(lookup);
        return streamScan(lookup, attempt);
      })
      .catch(function () {
        if (attempt < 2) {
          return new Promise(function (resolve) {
            setTimeout(resolve, 500);
          }).then(function () {
            return runSongcheck(title, artist, attempt + 1);
          });
        }
        status.textContent = "Network error — try again.";
      });
  }

  document.getElementById("tab-songcheck").addEventListener("click", function () {
    setTab("songcheck");
  });
  document.getElementById("tab-recommend").addEventListener("click", function () {
    setTab("recommend");
  });
  document.getElementById("tab-shelf").addEventListener("click", function () {
    setTab("shelf");
  });

  document.getElementById("songcheckForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var status = document.getElementById("songcheckStatus");
    var btn = document.getElementById("songcheckBtn");
    var title = document.getElementById("songTitle").value.trim();
    var artist = document.getElementById("songArtist").value.trim();
    if (!title) return;
    btn.disabled = true;
    status.textContent = "Looking up lyrics…";
    document.getElementById("songcheckResult").hidden = true;

    runSongcheck(title, artist, 1).finally(function () {
      btn.disabled = false;
    });
  });

  document.getElementById("recommendForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    loadRecommendations(document.getElementById("recommendTheme").value);
  });

  document.getElementById("prefsForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    Prefs.save({
      likes: document.getElementById("prefsLikes").value,
      dislikes: document.getElementById("prefsDislikes").value,
      preferInstrumentals: document.getElementById("prefsInstrumentals").checked,
      disneyKidsOk: document.getElementById("prefsDisney").checked,
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

  document.getElementById("shelfAddForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    Shelf.add({
      title: document.getElementById("shelfTitle").value.trim(),
      artist: document.getElementById("shelfArtist").value.trim(),
      tag: document.getElementById("shelfTag").value,
    });
    document.getElementById("shelfTitle").value = "";
    document.getElementById("shelfArtist").value = "";
    renderShelf();
  });

  renderShelf();
})();
