/**
 * LoreKeeper — press-and-hold word → brief lore gloss from your notes (#22).
 */
(function (global) {
  var cardEl = null;
  var dismissBound = false;
  var pending = false;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function workScope(getDoc) {
    if (global.LoreKeeperDocAsk && global.LoreKeeperDocAsk.scopeFromUi) {
      var s = global.LoreKeeperDocAsk.scopeFromUi(getDoc);
      return {
        mode: "work",
        workTitle: s.workTitle || "",
        documentId: s.documentId || "",
      };
    }
    var doc = getDoc ? getDoc() : null;
    var workEl = document.getElementById("docWork");
    var work =
      (doc && doc.workTag) ||
      (workEl && workEl.value.trim()) ||
      (doc && doc.title) ||
      "";
    return {
      mode: "work",
      workTitle: work,
      documentId: doc && doc.id,
    };
  }

  function questionForWord(word, workTitle) {
    var w = (word || "").trim();
    var prefix = workTitle ? "In " + workTitle + ", " : "";
    if (/^character\s+[a-z0-9]+$/i.test(w)) {
      return prefix + "who is " + w + "?";
    }
    if (/^[A-Z][a-z]/.test(w)) {
      return prefix + "who is " + w + "?";
    }
    return prefix + "what do I have about " + w + "?";
  }

  function stripFooter(text) {
    return String(text || "")
      .replace(/\n*— From your notes only\.[^\n]*$/i, "")
      .replace(/\n*— Pulled from your notes only\.[^\n]*$/i, "")
      .trim();
  }

  function briefGloss(answer) {
    var text = stripFooter(answer);
    if (!text) return "";
    var chunks = text.split(/\n\s*\n/);
    var body = chunks.length > 1 ? chunks.slice(1).join(" ") : text;
    body = body.replace(/^[A-Za-z0-9 ,.'-]+\n\n/, "").trim();
    var sentences = body.match(/[^.!?]+[.!?]+(?:\s|$)/g);
    if (sentences && sentences.length) {
      return sentences.slice(0, 2).join(" ").trim();
    }
    if (body.length > 280) {
      return body.slice(0, 277).replace(/\s+\S*$/, "") + "…";
    }
    return body;
  }

  function ensureCard() {
    if (cardEl) return cardEl;
    cardEl = document.createElement("aside");
    cardEl.id = "docLoreBriefCard";
    cardEl.className = "lk-lore-brief-card";
    cardEl.hidden = true;
    cardEl.setAttribute("role", "dialog");
    cardEl.setAttribute("aria-label", "Lore brief");
    var canvas = document.getElementById("docCanvas");
    (canvas || document.body).appendChild(cardEl);
    return cardEl;
  }

  function positionCard(clientX, clientY) {
    var card = ensureCard();
    var canvas = document.getElementById("docCanvas");
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    card.hidden = false;
    card.style.visibility = "hidden";
    card.style.left = "0";
    card.style.top = "0";
    var cw = card.offsetWidth || 280;
    var ch = card.offsetHeight || 120;
    var left = clientX - rect.left + canvas.scrollLeft - cw * 0.5;
    var top = clientY - rect.top + canvas.scrollTop - ch - 12;
    left = Math.max(8, Math.min(left, canvas.clientWidth - cw - 8));
    top = Math.max(8, Math.min(top, canvas.scrollTop + canvas.clientHeight - ch - 8));
    if (top < canvas.scrollTop + 8) {
      top = clientY - rect.top + canvas.scrollTop + 18;
    }
    card.style.left = left + "px";
    card.style.top = top + "px";
    card.style.visibility = "visible";
  }

  function bindDismiss() {
    if (dismissBound) return;
    dismissBound = true;
    document.addEventListener(
      "pointerdown",
      function (e) {
        if (!cardEl || cardEl.hidden) return;
        if (cardEl.contains(e.target)) return;
        hideCard();
      },
      true
    );
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hideCard();
    });
  }

  function hideCard() {
    if (!cardEl) return;
    cardEl.hidden = true;
    cardEl.innerHTML = "";
  }

  function renderCard(word, gloss, sources, materialState) {
    var card = ensureCard();
    var status =
      materialState === "nothing_saved"
        ? "Nothing saved on that yet."
        : materialState === "fragments_only"
          ? "Partial — thin notes only."
          : "";
    var html =
      '<button type="button" class="lk-lore-brief-close" aria-label="Close">×</button>' +
      '<p class="lk-lore-brief-word">' +
      escapeHtml(word) +
      "</p>" +
      '<p class="lk-lore-brief-gloss">' +
      escapeHtml(gloss || status || "No gloss from your notes.") +
      "</p>";
    if (sources && sources.length) {
      html += '<ul class="lk-lore-brief-sources">';
      sources.slice(0, 4).forEach(function (src, i) {
        var title = escapeHtml(src.title || "Untitled");
        var kind = escapeHtml(src.kindLabel || "Note");
        var excerpt = escapeHtml((src.excerpt || "").slice(0, 220));
        html +=
          '<li><button type="button" class="lk-lore-brief-source" data-idx="' +
          i +
          '">' +
          title +
          " <span class=\"muted\">(" +
          kind +
          ")</span></button>" +
          (excerpt
            ? '<p class="lk-lore-brief-excerpt" hidden id="loreExcerpt' +
              i +
              '">' +
              excerpt +
              "</p>"
            : "") +
          "</li>";
      });
      html += "</ul>";
    }
    html +=
      '<p class="muted lk-lore-brief-foot">From your notes only — not a dictionary.</p>';
    card.innerHTML = html;
    card.querySelector(".lk-lore-brief-close").addEventListener("click", hideCard);
    card.querySelectorAll(".lk-lore-brief-source").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = btn.getAttribute("data-idx");
        var ex = document.getElementById("loreExcerpt" + idx);
        if (!ex) return;
        ex.hidden = !ex.hidden;
      });
    });
  }

  function showLoading(word, clientX, clientY) {
    var card = ensureCard();
    card.innerHTML =
      '<p class="lk-lore-brief-word">' +
      escapeHtml(word) +
      '</p><p class="lk-lore-brief-gloss muted">Searching your notes…</p>';
    card.hidden = false;
    positionCard(clientX, clientY);
    bindDismiss();
  }

  function lookup(word, clientX, clientY, getDoc, flushSave) {
    if (!word || pending) return;
    if (!global.LoreKeeperRecall) return;
    if (!global.LoreKeeperAccountStorage || !global.LoreKeeperAccountStorage.isSignedIn()) {
      renderCard(word, global.LoreKeeperRecall.friendlyError("not_signed_in"), [], "nothing_saved");
      positionCard(clientX, clientY);
      bindDismiss();
      return;
    }

    var scope = workScope(getDoc);
    var question = questionForWord(word, scope.workTitle);
    pending = true;
    showLoading(word, clientX, clientY);
    if (flushSave) flushSave();

    global.LoreKeeperRecall.ask(question, { mode: "brief", scope: scope })
      .then(function (res) {
        if (!res || !res.ok) {
          renderCard(
            word,
            global.LoreKeeperRecall.friendlyError(res && res.error),
            [],
            "nothing_saved"
          );
          positionCard(clientX, clientY);
          return;
        }
        var gloss = briefGloss(res.answer || "");
        renderCard(word, gloss, res.sources || [], res.materialState || "");
        positionCard(clientX, clientY);
      })
      .catch(function () {
        renderCard(
          word,
          global.LoreKeeperRecall.friendlyError("network_error"),
          [],
          "nothing_saved"
        );
        positionCard(clientX, clientY);
      })
      .finally(function () {
        pending = false;
      });
  }

  function initLoreBrief(getDoc, flushSave) {
    global.addEventListener("lorekeeper-longpress-lore", function (e) {
      var detail = (e && e.detail) || {};
      lookup(detail.word, detail.clientX, detail.clientY, getDoc, flushSave);
    });
  }

  global.LoreKeeperDocLoreBrief = {
    init: initLoreBrief,
    lookup: lookup,
    briefGloss: briefGloss,
    questionForWord: questionForWord,
  };
})(typeof window !== "undefined" ? window : this);
