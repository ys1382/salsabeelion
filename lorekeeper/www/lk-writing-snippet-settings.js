/**
 * LoreKeeper — account UI for writing snippets and pinned names (#3).
 */
(function (global) {
  function setStatus(msg, ok) {
    var el = document.getElementById("writingGlossaryStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "lk-status" + (ok ? " ok" : "");
  }

  function renderSnippets() {
    var list = document.getElementById("writingSnippetList");
    if (!list || !global.LoreKeeperWritingGlossary) return;
    var data = global.LoreKeeperWritingGlossary.load();
    list.innerHTML = "";
    if (!data.snippets.length) {
      var empty = document.createElement("li");
      empty.className = "muted";
      empty.textContent = "No snippets yet — e.g. ms → Marcus";
      list.appendChild(empty);
      return;
    }
    data.snippets.forEach(function (s) {
      var li = document.createElement("li");
      var label = document.createElement("span");
      label.textContent = s.shortcut + " \u2192 " + s.text;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lk-btn secondary lk-spell-word-remove";
      btn.textContent = "Remove";
      btn.addEventListener("click", function () {
        global.LoreKeeperWritingGlossary.removeSnippet(s.id);
        renderSnippets();
      });
      li.appendChild(label);
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function renderPinned() {
    var list = document.getElementById("writingPinnedList");
    if (!list || !global.LoreKeeperWritingGlossary) return;
    var data = global.LoreKeeperWritingGlossary.load();
    var pinned = data.pinned.slice().sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
    list.innerHTML = "";
    if (!pinned.length) {
      var empty = document.createElement("li");
      empty.className = "muted";
      empty.textContent = "Pin cast and place names for mobile chips.";
      list.appendChild(empty);
      return;
    }
    pinned.forEach(function (term) {
      var li = document.createElement("li");
      var label = document.createElement("span");
      label.textContent = term;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lk-btn secondary lk-spell-word-remove";
      btn.textContent = "Remove";
      btn.addEventListener("click", function () {
        global.LoreKeeperWritingGlossary.removePinned(term);
        renderPinned();
      });
      li.appendChild(label);
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function addSnippet() {
    var shortcut = document.getElementById("writingSnippetShortcut");
    var text = document.getElementById("writingSnippetText");
    if (!shortcut || !text || !global.LoreKeeperWritingGlossary) return;
    if (!global.LoreKeeperAccountStorage || !global.LoreKeeperAccountStorage.isSignedIn()) {
      setStatus("Sign in to save snippets.");
      return;
    }
    if (!global.LoreKeeperWritingGlossary.addSnippet(shortcut.value, text.value)) {
      setStatus("Add a shortcut and text — shortcut must be unique.");
      return;
    }
    shortcut.value = "";
    text.value = "";
    setStatus("Snippet saved.", true);
    renderSnippets();
  }

  function addPinned() {
    var input = document.getElementById("writingPinnedInput");
    if (!input || !global.LoreKeeperWritingGlossary) return;
    if (!global.LoreKeeperAccountStorage || !global.LoreKeeperAccountStorage.isSignedIn()) {
      setStatus("Sign in to save pinned names.");
      return;
    }
    if (!global.LoreKeeperWritingGlossary.addPinned(input.value)) {
      setStatus("Type a name — or it is already pinned.");
      return;
    }
    input.value = "";
    setStatus("Pinned for mobile chips.", true);
    renderPinned();
  }

  function refresh() {
    if (!global.LoreKeeperWritingGlossary) return;
    global.LoreKeeperWritingGlossary.ready.then(function () {
      renderSnippets();
      renderPinned();
    });
  }

  function init() {
    var snippetBtn = document.getElementById("writingSnippetAddBtn");
    var pinnedBtn = document.getElementById("writingPinnedAddBtn");
    if (snippetBtn && !snippetBtn.__lkBound) {
      snippetBtn.__lkBound = true;
      snippetBtn.addEventListener("click", addSnippet);
    }
    if (pinnedBtn && !pinnedBtn.__lkBound) {
      pinnedBtn.__lkBound = true;
      pinnedBtn.addEventListener("click", addPinned);
    }
    if (!global.__lkGlossaryListener) {
      global.__lkGlossaryListener = true;
      global.addEventListener("lorekeeper-writing-glossary-changed", refresh);
    }
    refresh();
  }

  global.LoreKeeperWritingSnippetSettings = { init: init, refresh: refresh };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : this);
