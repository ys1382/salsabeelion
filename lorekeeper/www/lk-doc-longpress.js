/**
 * LoreKeeper — long-press gesture policy on doc Quill (#20).
 * Flagged typo → typo route (#21). Other words → lore route (#22).
 * Does not steal normal tap/selection/drag.
 */
(function (global) {
  var HOLD_MS = 520;
  var MOVE_PX = 14;
  var WORD_RE = /\b[A-Za-z]+(?:['\u2019][A-Za-z]+)?\b/;

  function expandRangeToWord(range) {
    if (!range || !range.collapsed) return null;
    var node = range.startContainer;
    var offset = range.startOffset;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    var text = node.textContent || "";
    if (!text) return null;
    var start = offset;
    var end = offset;
    while (start > 0 && /[A-Za-z'\u2019]/.test(text.charAt(start - 1))) start -= 1;
    while (end < text.length && /[A-Za-z'\u2019]/.test(text.charAt(end))) end += 1;
    if (end <= start) return null;
    var word = text.slice(start, end);
    if (!WORD_RE.test(word)) return null;
    var out = document.createRange();
    out.setStart(node, start);
    out.setEnd(node, end);
    return { range: out, word: word };
  }

  function wordAtPoint(root, x, y) {
    if (!root) return null;
    var range = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y);
    } else if (document.caretPositionFromPoint) {
      var pos = document.caretPositionFromPoint(x, y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (!range || !root.contains(range.startContainer)) return null;
    return expandRangeToWord(range);
  }

  function isDomSpellFlagged(node, root) {
    var el = node && node.nodeType === Node.ELEMENT_NODE ? node : node && node.parentElement;
    while (el && el !== root) {
      if (el.classList && el.classList.contains("lk-spell-error")) return true;
      el = el.parentElement;
    }
    return false;
  }

  function isPersonalWord(word) {
    if (!word || !global.LoreKeeperSpellWords) return false;
    return global.LoreKeeperSpellWords.has(word);
  }

  function classifyHold(word, domFlagged) {
    if (!word || word.length < 2) return null;
    if (isPersonalWord(word)) return "lore";
    if (domFlagged) return "typo";
    if (global.LoreKeeperSpell && global.LoreKeeperSpell.isOk && global.LoreKeeperSpell.shouldFlagWord) {
      if (global.LoreKeeperSpell.shouldFlagWord(word, "", null, [])) return "typo";
    } else if (global.LoreKeeperSpell && global.LoreKeeperSpell.isOk && !global.LoreKeeperSpell.isOk(word)) {
      return "typo";
    }
    return "lore";
  }

  function ensureToast() {
    var el = document.getElementById("docLongPressToast");
    if (el) return el;
    el = document.createElement("div");
    el.id = "docLongPressToast";
    el.className = "lk-longpress-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.hidden = true;
    var canvas = document.getElementById("docCanvas");
    if (canvas) canvas.appendChild(el);
    else document.body.appendChild(el);
    return el;
  }

  var toastTimer = null;

  function showToast(message, kind) {
    var el = ensureToast();
    el.textContent = message;
    el.className = "lk-longpress-toast is-" + (kind || "info");
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.hidden = true;
    }, 2800);
  }

  function dispatchRoute(route, detail) {
    try {
      global.dispatchEvent(
        new CustomEvent("lorekeeper-longpress-" + route, { detail: detail })
      );
    } catch (e) {
      global.dispatchEvent(new Event("lorekeeper-longpress-" + route));
    }
  }

  function routeTypo(word, clientX, clientY) {
    dispatchRoute("typo", { word: word, clientX: clientX, clientY: clientY });
  }

  function routeLore(word, clientX, clientY) {
    dispatchRoute("lore", { word: word, clientX: clientX, clientY: clientY });
  }

  function bindLongPress(quill) {
    if (!quill || !quill.root) return null;
    var root = quill.root;
    var pending = null;
    var armed = false;

    function cancel() {
      if (pending && pending.timer) clearTimeout(pending.timer);
      pending = null;
      armed = false;
      root.classList.remove("is-longpress-pending");
    }

    function onHold(clientX, clientY, targetNode) {
      var hit = wordAtPoint(root, clientX, clientY);
      if (!hit) {
        showToast("Hold on a word in your draft.", "info");
        return;
      }
      var flagged = isDomSpellFlagged(targetNode, root);
      var route = classifyHold(hit.word, flagged);
      if (!route) return;

      root.classList.add("is-longpress-armed");
      setTimeout(function () {
        root.classList.remove("is-longpress-armed");
      }, 180);

      if (route === "typo") routeTypo(hit.word, clientX, clientY);
      else routeLore(hit.word, clientX, clientY);
    }

    root.addEventListener(
      "contextmenu",
      function (e) {
        if (armed) e.preventDefault();
      },
      true
    );

    root.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      cancel();
      pending = {
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
        target: e.target,
        timer: setTimeout(function () {
          armed = true;
          onHold(pending.x, pending.y, pending.target);
          cancel();
        }, HOLD_MS),
      };
      root.classList.add("is-longpress-pending");
    });

    root.addEventListener("pointermove", function (e) {
      if (!pending || e.pointerId !== pending.pointerId) return;
      if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > MOVE_PX) cancel();
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      root.addEventListener(ev, cancel);
    });

    root.addEventListener("scroll", cancel, true);

    return { cancel: cancel };
  }

  global.LoreKeeperDocLongPress = {
    bind: bindLongPress,
    classifyHold: classifyHold,
    wordAtPoint: wordAtPoint,
    showToast: showToast,
    HOLD_MS: HOLD_MS,
  };
})(typeof window !== "undefined" ? window : this);
