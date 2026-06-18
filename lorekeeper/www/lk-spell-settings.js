/**
 * LoreKeeper — My spelling words panel (account page).
 */
(function (global) {
  function renderList() {
    var list = document.getElementById("spellWordList");
    if (!list || !global.LoreKeeperSpellWords) return;
    var words = LoreKeeperSpellWords.load().sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
    list.innerHTML = "";
    if (!words.length) {
      var empty = document.createElement("li");
      empty.className = "muted";
      empty.textContent = "No words yet — add character names and place names here.";
      list.appendChild(empty);
      return;
    }
    words.forEach(function (word) {
      var li = document.createElement("li");
      var label = document.createElement("span");
      label.textContent = word;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lk-btn secondary lk-spell-word-remove";
      btn.textContent = "Remove";
      btn.addEventListener("click", function () {
        LoreKeeperSpellWords.remove(word);
        renderList();
      });
      li.appendChild(label);
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function setStatus(msg, ok) {
    var el = document.getElementById("spellWordStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "lk-status" + (ok ? " ok" : "");
  }

  function addFromInput() {
    var input = document.getElementById("spellWordInput");
    if (!input || !global.LoreKeeperSpellWords) return;
    var word = input.value.trim();
    if (!word) {
      setStatus("Type a word first.");
      return;
    }
    if (!global.LoreKeeperAccountStorage || !global.LoreKeeperAccountStorage.isSignedIn()) {
      setStatus("Sign in to save spelling words.");
      return;
    }
    if (global.LoreKeeperSpellWords.has(word)) {
      setStatus("That word is already on your list.");
      input.value = "";
      return;
    }
    if (!global.LoreKeeperSpellWords.add(word)) {
      setStatus("Could not add that word — try again.");
      return;
    }
    input.value = "";
    setStatus("Added “" + word + "”.", true);
    renderList();
  }

  function init() {
    var addBtn = document.getElementById("spellWordAddBtn");
    var input = document.getElementById("spellWordInput");
    if (addBtn && !addBtn.__lkSpellBound) {
      addBtn.__lkSpellBound = true;
      addBtn.addEventListener("click", addFromInput);
    }
    if (input && !input.__lkSpellBound) {
      input.__lkSpellBound = true;
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          addFromInput();
        }
      });
    }
    if (!global.__lkSpellWordsListener) {
      global.__lkSpellWordsListener = true;
      global.addEventListener("lorekeeper-spell-words-changed", renderList);
    }
    refresh();
  }

  function refresh() {
    if (!global.LoreKeeperSpellWords) return;
    global.LoreKeeperSpellWords.ready.then(renderList);
  }

  function boot() {
    init();
  }

  global.LoreKeeperSpellSettings = { init: init, refresh: refresh };

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : this);
