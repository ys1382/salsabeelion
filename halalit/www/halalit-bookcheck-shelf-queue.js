/**
 * Halalit — Bookcheck queue from Personal Library (same-browser local shelf).
 */
(function (global) {
  var SETTLED_TIERS = {
    verified_clean: true,
    user_discretion: true,
    flag_review: true,
    preview_caution: true,
    fanservice_caution: true,
    deity_comfort: true,
    teen_caution: true,
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function plainLine(book) {
    var Lib = global.HalalitPersonalLibrary;
    if (Lib && typeof Lib.plainLine === "function") return Lib.plainLine(book);
    var t = String((book && book.title) || "").trim();
    var a = String((book && book.author) || "").trim();
    if (!t) return "";
    return a ? t + " by " + a : t;
  }

  function classifyBook(title, author) {
    var Policy = global.HalalitFamilyShelfPolicy;
    var tier = "unclear";
    var detail = "";
    if (Policy && typeof Policy.inferCatalogFamilyHint === "function") {
      var hint = Policy.inferCatalogFamilyHint({
        title: title,
        author_name: author ? [author] : [],
      });
      tier = hint && hint.tier ? hint.tier : "unclear";
      detail = hint && hint.detail ? hint.detail : "";
    }
    return {
      tier: tier,
      detail: detail,
      settled: !!SETTLED_TIERS[tier],
    };
  }

  function tierSummary(tier) {
    if (tier === "verified_clean") return "Hand-verified";
    if (tier === "user_discretion") return "Reader discretion";
    if (tier === "flag_review") return "Flagged / excluded";
    if (tier === "preview_caution") return "Comic preview";
    if (tier === "fanservice_caution") return "Comic caution";
    if (tier === "deity_comfort") return "Deity comfort";
    if (tier === "teen_caution") return "Teen/YA";
    return "Needs lookup";
  }

  function buildRows(books) {
    var settled = [];
    var queue = [];
    for (var i = 0; i < books.length; i++) {
      var book = books[i];
      var title = String((book && book.title) || "").trim();
      if (!title) continue;
      var author = String((book && book.author) || "").trim();
      var cls = classifyBook(title, author);
      var row = {
        title: title,
        author: author,
        label: plainLine(book),
        tier: cls.tier,
        detail: cls.detail,
        hasAuthor: !!author,
      };
      if (cls.settled) settled.push(row);
      else queue.push(row);
    }
    queue.sort(function (a, b) {
      if (a.hasAuthor !== b.hasAuthor) return a.hasAuthor ? -1 : 1;
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });
    settled.sort(function (a, b) {
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });
    return { settled: settled, queue: queue, total: settled.length + queue.length };
  }

  /**
   * @param {object[]} books
   * @param {"vet"|"full"|"settled"} mode
   */
  function buildCopyText(books, mode) {
    var built = buildRows(books || []);
    var lines = [];
    var m = mode === "full" ? "full" : mode === "settled" ? "settled" : "vet";
    if (m === "full") {
      for (var i = 0; i < books.length; i++) {
        var ln = plainLine(books[i]);
        if (ln) lines.push(ln);
      }
      lines.sort(function (a, b) {
        return a.localeCompare(b, undefined, { sensitivity: "base" });
      });
      var headerFull =
        "# Personal Library — full shelf (" +
        String(lines.length) +
        (lines.length === 1 ? " title" : " titles") +
        ")\n# Paste into Cursor chat so Halalit can help vet / Bookcheck.\n\n";
      return { text: headerFull + lines.join("\n"), count: lines.length, mode: m };
    }
    var rows = m === "settled" ? built.settled : built.queue;
    for (var j = 0; j < rows.length; j++) {
      if (rows[j].label) lines.push(rows[j].label);
    }
    var headerVet =
      m === "settled"
        ? "# Personal Library — already on Halalit hand lists (" +
          String(lines.length) +
          (lines.length === 1 ? " title" : " titles") +
          ")\n# Paste into Cursor chat if you want a second pass.\n\n"
        : "# Personal Library — vet queue (" +
          String(lines.length) +
          (lines.length === 1 ? " title" : " titles") +
          ")\n# Not on Halalit hand lists yet. Paste into Cursor chat to vet with Bookcheck help.\n\n";
    return { text: headerVet + lines.join("\n"), count: lines.length, mode: m };
  }

  function loadBooks() {
    var Lib = global.HalalitPersonalLibrary;
    return Lib && typeof Lib.load === "function" ? Lib.load() : [];
  }

  function copyToClipboard(text) {
    if (!text) return Promise.reject(new Error("empty"));
    if (global.navigator && global.navigator.clipboard && typeof global.navigator.clipboard.writeText === "function") {
      return global.navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) resolve();
        else reject(new Error("copy failed"));
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * @param {"vet"|"full"|"settled"} mode
   * @param {HTMLElement|null} statusEl
   * @param {HTMLTextAreaElement|null} pasteTa
   */
  function copyForChat(mode, statusEl, pasteTa) {
    var pack = buildCopyText(loadBooks(), mode);
    if (pasteTa) {
      pasteTa.value = pack.text;
      pasteTa.hidden = !pack.count;
    }
    if (!pack.count) {
      if (statusEl) statusEl.textContent = "Nothing to copy yet.";
      return Promise.resolve(false);
    }
    return copyToClipboard(pack.text)
      .then(function () {
        if (statusEl) {
          statusEl.textContent =
            "Copied " +
            String(pack.count) +
            (pack.count === 1 ? " title" : " titles") +
            " — paste into Cursor chat.";
        }
        return true;
      })
      .catch(function () {
        if (statusEl) {
          statusEl.textContent =
            "Select the box below and copy (" +
            String(pack.count) +
            (pack.count === 1 ? " title" : " titles") +
            ").";
        }
        if (pasteTa) {
          pasteTa.hidden = false;
          try {
            pasteTa.focus();
            pasteTa.select();
          } catch (eFocus) {
            /* ignore */
          }
        }
        return false;
      });
  }

  function renderList(ul, rows, onPick) {
    if (!ul) return;
    ul.innerHTML = "";
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bookcheck-shelf-queue__btn";
      btn.innerHTML =
        '<span class="bookcheck-shelf-queue__title">' +
        escapeHtml(row.label) +
        '</span><span class="bookcheck-shelf-queue__meta">' +
        escapeHtml(tierSummary(row.tier)) +
        "</span>";
      btn.addEventListener("click", function (t, a) {
        return function () {
          if (typeof onPick === "function") onPick(t, a);
        };
      })(row.title, row.author);
      li.appendChild(btn);
      ul.appendChild(li);
    }
  }

  function init(root) {
    if (!root) return;
    var summaryEl = root.querySelector("#bookcheckShelfSummary");
    var emptyEl = root.querySelector("#bookcheckShelfEmpty");
    var settledWrap = root.querySelector("#bookcheckShelfSettledWrap");
    var settledList = root.querySelector("#bookcheckShelfSettledList");
    var queueWrap = root.querySelector("#bookcheckShelfQueueWrap");
    var queueList = root.querySelector("#bookcheckShelfQueueList");
    var refreshBtn = root.querySelector("#bookcheckShelfRefresh");
    var copyVetBtn = root.querySelector("#bookcheckCopyVetQueue");
    var copyFullBtn = root.querySelector("#bookcheckCopyFullShelf");
    var copyStatusEl = root.querySelector("#bookcheckCopyStatus");
    var pasteTa = root.querySelector("#bookcheckShelfPaste");
    var pasteLabel = root.querySelector("#bookcheckShelfPasteLabel");

    function onPick(title, author) {
      var Bc = global.HalalitBookcheck;
      if (Bc && typeof Bc.prefillAndLookup === "function") Bc.prefillAndLookup(title, author);
    }

    function updatePastePreview(books) {
      if (!pasteTa) return;
      var pack = buildCopyText(books, "vet");
      pasteTa.value = pack.text;
      var show = pack.count > 0;
      pasteTa.hidden = !show;
      if (pasteLabel) pasteLabel.hidden = !show;
    }

    function refresh() {
      var books = loadBooks();
      var n = books.length;
      if (emptyEl) emptyEl.hidden = n > 0;
      if (!n) {
        if (summaryEl) summaryEl.textContent = "";
        if (settledWrap) settledWrap.hidden = true;
        if (queueWrap) queueWrap.hidden = true;
        if (settledList) settledList.innerHTML = "";
        if (queueList) queueList.innerHTML = "";
        updatePastePreview(books);
        return;
      }
      var built = buildRows(books);
      if (summaryEl) {
        summaryEl.textContent =
          String(n) +
          (n === 1 ? " book" : " books") +
          " on your shelf — " +
          String(built.queue.length) +
          (built.queue.length === 1 ? " needs" : " need") +
          " a full Bookcheck run, " +
          String(built.settled.length) +
          " already match Halalit’s hand lists.";
      }
      renderList(settledList, built.settled, onPick);
      renderList(queueList, built.queue, onPick);
      if (settledWrap) settledWrap.hidden = !built.settled.length;
      if (queueWrap) queueWrap.hidden = !built.queue.length;
      updatePastePreview(books);
    }

    if (refreshBtn) refreshBtn.addEventListener("click", refresh);
    if (copyVetBtn) {
      copyVetBtn.addEventListener("click", function () {
        copyForChat("vet", copyStatusEl, pasteTa);
      });
    }
    if (copyFullBtn) {
      copyFullBtn.addEventListener("click", function () {
        copyForChat("full", copyStatusEl, pasteTa);
      });
    }
    try {
      global.addEventListener("storage", function (ev) {
        if (ev && ev.key === "halalitAlreadyReadBooks") refresh();
      });
    } catch (eStorage) {
      /* ignore */
    }

    refresh();
    return { refresh: refresh };
  }

  global.HalalitBookcheckShelfQueue = {
    init: init,
    buildRows: buildRows,
    buildCopyText: buildCopyText,
    copyForChat: copyForChat,
    refresh: null,
  };
})(typeof window !== "undefined" ? window : this);
