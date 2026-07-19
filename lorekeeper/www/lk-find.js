/**
 * LoreKeeper — plain find across documents and notes (not Ask / not AI).
 */
(function (global) {
  var MAX_HITS = 50;
  var SNIPPET_RADIUS = 48;
  var debounceTimer = null;

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeHay(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function docPlain(doc) {
    if (!doc) return "";
    if (global.LoreKeeperDocuments && global.LoreKeeperDocuments.bodyPlainText) {
      return global.LoreKeeperDocuments.bodyPlainText(doc.bodyHtml || "");
    }
    return String(doc.bodyHtml || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function snippetAround(hay, qLower) {
    var lower = hay.toLowerCase();
    var idx = lower.indexOf(qLower);
    if (idx < 0) {
      var short = hay.slice(0, SNIPPET_RADIUS * 2);
      return escapeHtml(short) + (hay.length > short.length ? "…" : "");
    }
    var start = Math.max(0, idx - SNIPPET_RADIUS);
    var end = Math.min(hay.length, idx + qLower.length + SNIPPET_RADIUS);
    var before = hay.slice(start, idx);
    var match = hay.slice(idx, idx + qLower.length);
    var after = hay.slice(idx + qLower.length, end);
    return (
      (start > 0 ? "…" : "") +
      escapeHtml(before) +
      "<mark>" +
      escapeHtml(match) +
      "</mark>" +
      escapeHtml(after) +
      (end < hay.length ? "…" : "")
    );
  }

  function collectHits(query) {
    var q = normalizeHay(query);
    if (!q) return { query: "", hits: [], truncated: false };
    var qLower = q.toLowerCase();
    var hits = [];

    var notes =
      global.LoreKeeperEntries && global.LoreKeeperEntries.load
        ? global.LoreKeeperEntries.load()
        : [];
    for (var i = 0; i < notes.length; i++) {
      var e = notes[i];
      if (!e) continue;
      var tags = Array.isArray(e.tags) ? e.tags.join(" ") : "";
      var noteHay = normalizeHay(
        (e.title || "") + " " + (e.body || "") + " " + tags + " " + (e.kind || "")
      );
      if (noteHay.toLowerCase().indexOf(qLower) === -1) continue;
      var kindLabel =
        global.LoreKeeperEntries && global.LoreKeeperEntries.kindLabel
          ? global.LoreKeeperEntries.kindLabel(e.kind)
          : e.kind || "Note";
      var work = Array.isArray(e.tags) && e.tags.length ? e.tags[0] : "";
      hits.push({
        type: "note",
        id: e.id,
        title: e.title || "Untitled note",
        work: work,
        kindLabel: kindLabel,
        snippet: snippetAround(noteHay, qLower),
        updatedAt: e.updatedAt || 0,
      });
    }

    var docs =
      global.LoreKeeperDocuments && global.LoreKeeperDocuments.load
        ? global.LoreKeeperDocuments.load()
        : [];
    for (var j = 0; j < docs.length; j++) {
      var d = docs[j];
      if (!d) continue;
      var body = docPlain(d);
      var docHay = normalizeHay((d.title || "") + " " + (d.workTag || "") + " " + body);
      if (docHay.toLowerCase().indexOf(qLower) === -1) continue;
      hits.push({
        type: "document",
        id: d.id,
        title: d.title || "Untitled document",
        work: d.workTag || "",
        kindLabel: "Document",
        snippet: snippetAround(docHay, qLower),
        updatedAt: d.updatedAt || 0,
      });
    }

    hits.sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    var truncated = hits.length > MAX_HITS;
    if (truncated) hits = hits.slice(0, MAX_HITS);
    return { query: q, hits: hits, truncated: truncated };
  }

  function openHit(hit) {
    if (!hit || !hit.id) return;
    if (hit.type === "document") {
      global.location.href = "./doc.html?d=" + encodeURIComponent(hit.id);
      return;
    }
    try {
      global.dispatchEvent(
        new CustomEvent("lorekeeper-open-note", { detail: { id: hit.id } })
      );
    } catch (err) {
      /* ignore */
    }
    var panel = document.getElementById("noteEditorPanel");
    if (panel && panel.scrollIntoView) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderResults(box, statusEl, result) {
    if (!box) return;
    box.innerHTML = "";
    if (!result.query) {
      if (statusEl) {
        statusEl.textContent = "Type a word or phrase to look through documents and notes.";
        statusEl.hidden = false;
      }
      return;
    }
    if (!result.hits.length) {
      if (statusEl) {
        statusEl.textContent = "No matches in your documents or notes.";
        statusEl.hidden = false;
      }
      return;
    }
    var label =
      result.hits.length +
      " match" +
      (result.hits.length === 1 ? "" : "es") +
      (result.truncated ? " (showing first " + MAX_HITS + ")" : "");
    if (statusEl) {
      statusEl.textContent = label;
      statusEl.hidden = false;
    }
    result.hits.forEach(function (hit) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lk-find-hit";
      var workBit = hit.work
        ? '<span class="muted"> · ' + escapeHtml(hit.work) + "</span>"
        : "";
      btn.innerHTML =
        '<span class="lk-find-hit-kind">' +
        escapeHtml(hit.kindLabel || hit.type) +
        "</span>" +
        "<strong>" +
        escapeHtml(hit.title) +
        "</strong>" +
        workBit +
        '<span class="lk-find-hit-snippet">' +
        hit.snippet +
        "</span>";
      btn.addEventListener("click", function () {
        openHit(hit);
      });
      li.appendChild(btn);
      box.appendChild(li);
    });
  }

  function runFind(input, listEl, statusEl) {
    var result = collectHits(input ? input.value : "");
    renderResults(listEl, statusEl, result);
  }

  function init() {
    var input = document.getElementById("findBox");
    var listEl = document.getElementById("findResults");
    var statusEl = document.getElementById("findStatus");
    var btn = document.getElementById("findBtn");
    if (!input || !listEl) return;

    function schedule() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        runFind(input, listEl, statusEl);
      }, 180);
    }

    input.addEventListener("input", schedule);
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        if (debounceTimer) clearTimeout(debounceTimer);
        runFind(input, listEl, statusEl);
      }
    });
    if (btn) {
      btn.addEventListener("click", function () {
        if (debounceTimer) clearTimeout(debounceTimer);
        runFind(input, listEl, statusEl);
      });
    }
    global.addEventListener("lorekeeper-data-hydrated", function () {
      if (normalizeHay(input.value)) runFind(input, listEl, statusEl);
    });
  }

  global.LoreKeeperFind = {
    init: init,
    search: collectHits,
  };
})(typeof window !== "undefined" ? window : this);
