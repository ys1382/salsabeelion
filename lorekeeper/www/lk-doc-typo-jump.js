/**
 * LoreKeeper — press-and-hold typo → jump through occurrences in this doc (#21).
 */
(function (global) {
  var state = {
    wordKey: "",
    indices: [],
    cursor: 0,
  };

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function docText(quill) {
    return quill.getText().replace(/\u00a0/g, " ");
  }

  function findWordIndices(text, word) {
    if (!word) return [];
    var re = new RegExp("\\b" + escapeRegExp(word) + "\\b", "gi");
    var out = [];
    var m;
    while ((m = re.exec(text))) {
      out.push(m.index);
    }
    return out;
  }

  function nearestIndex(indices, target) {
    if (!indices.length) return 0;
    var best = 0;
    var bestDist = Infinity;
    var i;
    for (i = 0; i < indices.length; i++) {
      var d = Math.abs(indices[i] - target);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  function textIndexAtPoint(quill, root, x, y) {
    if (!global.LoreKeeperDocLongPress || !global.LoreKeeperDocLongPress.wordAtPoint) return 0;
    var hit = global.LoreKeeperDocLongPress.wordAtPoint(root, x, y);
    if (!hit || !hit.range) return 0;
    quill.focus();
    var sel = global.getSelection();
    if (!sel) return 0;
    sel.removeAllRanges();
    sel.addRange(hit.range);
    var q = quill.getSelection(true);
    return q && typeof q.index === "number" ? q.index : 0;
  }

  function scrollToOccurrence(quill, index, length) {
    quill.setSelection(index, length, "user");
    var bounds = quill.getBounds(index, length);
    if (!bounds) return;
    var canvas = document.getElementById("docCanvas");
    var editor = quill.root;
    if (!canvas || !editor) return;
    var editorTop = editor.getBoundingClientRect().top - canvas.getBoundingClientRect().top + canvas.scrollTop;
    var target = editorTop + bounds.top - canvas.clientHeight * 0.28;
    canvas.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    editor.classList.add("is-typo-jump-flash");
    setTimeout(function () {
      editor.classList.remove("is-typo-jump-flash");
    }, 650);
  }

  function showToast(message) {
    if (global.LoreKeeperDocLongPress && global.LoreKeeperDocLongPress.showToast) {
      global.LoreKeeperDocLongPress.showToast(message, "typo");
      return;
    }
    var el = document.getElementById("docLongPressToast");
    if (!el) return;
    el.textContent = message;
    el.className = "lk-longpress-toast is-typo";
    el.hidden = false;
  }

  function resetIfPersonal(word) {
    if (!word || !global.LoreKeeperSpellWords) return false;
    return global.LoreKeeperSpellWords.has(word);
  }

  function advance(quill, word, clientX, clientY) {
    if (!quill || !word) return;
    if (resetIfPersonal(word)) return;

    var key = word.toLowerCase();
    var text = docText(quill);
    var indices = findWordIndices(text, word);
    if (!indices.length) {
      showToast("No matches for “" + word + "” in this document.");
      state.wordKey = "";
      state.indices = [];
      state.cursor = 0;
      return;
    }

    if (state.wordKey !== key) {
      state.wordKey = key;
      state.indices = indices;
      var holdIdx = textIndexAtPoint(quill, quill.root, clientX, clientY);
      state.cursor = nearestIndex(indices, holdIdx);
    } else {
      state.cursor = (state.cursor + 1) % indices.length;
    }

    var at = state.indices[state.cursor];
    scrollToOccurrence(quill, at, word.length);
    var label =
      "Typo “" +
      word +
      "”: " +
      (state.cursor + 1) +
      " of " +
      indices.length +
      " — hold again for next";
    showToast(label);
  }

  function initTypoJump(quill) {
    if (!quill) return;
    global.addEventListener("lorekeeper-longpress-typo", function (e) {
      var detail = (e && e.detail) || {};
      advance(quill, detail.word, detail.clientX, detail.clientY);
    });
    quill.on("text-change", function (_delta, _old, source) {
      if (source !== "user") return;
      state.wordKey = "";
      state.indices = [];
      state.cursor = 0;
    });
  }

  global.LoreKeeperDocTypoJump = {
    init: initTypoJump,
    advance: advance,
    findWordIndices: findWordIndices,
  };
})(typeof window !== "undefined" ? window : this);
