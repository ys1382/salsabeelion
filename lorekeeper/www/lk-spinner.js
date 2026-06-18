(function (global) {
  var state = null;
  var saveTimer = null;

  var COLUMN_ORDER = ["who", "act", "obj", "where", "twist"];

  function picksFromColumns(columns) {
    var p = {};
    (columns || []).forEach(function (col) {
      if (col.current) p[col.id] = col.current;
    });
    return p;
  }

  function cleanJoin(parts) {
    return parts
      .filter(Boolean)
      .join(" ")
      .replace(/\s+([,.;!?])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .replace(/ ,/g, ",")
      .trim();
  }

  function lc(phrase) {
    var w = String(phrase || "").trim();
    if (!w) return "";
    return w.charAt(0).toLowerCase() + w.slice(1);
  }

  function aAn(phrase) {
    var w = lc(phrase);
    if (!w) return "";
    if (/^(a|an|the|some|any)\s/i.test(w)) return w;
    if (/s$/i.test(w) && w.length > 3 && !/ss$/i.test(w)) return w;
    return (/^[aeiou]/i.test(w) ? "an " : "a ") + w;
  }

  function inPlace(where) {
    var w = lc(where);
    if (!w) return "";
    if (/^(in|at|on|inside|within|under|above|behind|near|beyond)\s/i.test(w)) return w;
    return "in " + aAn(w);
  }

  function subject(who) {
    var w = lc(who);
    if (!w) return "";
    if (/^(a|an|the|some)\s/i.test(w)) return w;
    return aAn(w);
  }

  function settingPhrase(where) {
    var w = lc(where);
    if (!w) return "";
    if (/^(in|at|on|inside|within|under|above|behind|near|beyond)\s/i.test(w)) return w;
    return "living in " + aAn(w);
  }

  var STATIVE_VERBS = /^(live|lived|love|loved|fear|feared|hate|hated|hide|hid|stay|stayed|belong|belonged|grow|grew|wait|waited|dream|dreamed|dreamt)$/i;

  function actionPhrase(act) {
    var w = lc(act);
    if (!w) return "";
    if (w.split(/\s+/).length >= 3) return w;
    if (/^to\s/.test(w)) return w;
    if (/ing$/i.test(w)) return "started " + w;
    if (STATIVE_VERBS.test(w)) return "had always " + w;
    if (/ed$/i.test(w) && w.length > 3) return "one day " + w;
    if (/^(is|was|are|were|has|have|had|can|could|will|would|must)\b/i.test(w)) return w;
    return "suddenly " + w;
  }

  function objectPhrase(obj, act) {
    var o = lc(obj);
    var a = lc(act || "");
    if (!o) return "";
    if (/^(with|using|holding|carrying|without)\s/i.test(o)) return o;
    var noun = aAn(o);
    if (/^(find|found|discover|discovered|steal|stole|lose|lost|hide|hid|carry|carried|pick|picked|grab|grabbed|see|saw|spot|spotted|need|needed|want|wanted)\b/.test(a)) {
      return noun;
    }
    if (/^(kick|kicked|push|pushed|drop|dropped|throw|threw|trip|tripped)\b/.test(a)) {
      return "over " + noun;
    }
    return "while dealing with " + noun;
  }

  function twistPhrase(twist) {
    var w = lc(twist);
    if (!w) return "";
    if (/^(and|but|yet|only|except|because|when|while|if)\b/i.test(w)) return w;
    if (w.split(/\s+/).length >= 4) return w;
    if (/^(every|no one|nobody|someone|everyone|the whole)\b/i.test(w)) return w + " changed everything";
    if (/^(a|an|the)\s/i.test(w)) return "the real surprise was " + w;
    return "the real surprise involved " + aAn(w);
  }

  var TEMPLATES = {
    nudge: {
      label: "What if…?",
      build: function (p) {
        if (p.who && p.act && p.obj && p.where && p.twist) {
          return cleanJoin([
            "What if",
            subject(p.who) + ",",
            settingPhrase(p.where) + ",",
            actionPhrase(p.act),
            objectPhrase(p.obj, p.act) + " —",
            "and",
            twistPhrase(p.twist) + "?",
          ]);
        }
        if (p.who && p.where && p.twist) {
          return cleanJoin([
            "What if",
            subject(p.who) + ",",
            settingPhrase(p.where) + ",",
            (p.act ? actionPhrase(p.act) : "woke up one morning") + " —",
            "and",
            twistPhrase(p.twist) + "?",
          ]);
        }
        if (p.who && p.act && p.where) {
          return cleanJoin([
            "What if",
            subject(p.who) + ",",
            settingPhrase(p.where) + ",",
            actionPhrase(p.act) + "?",
          ]);
        }
        if (p.who && p.obj) {
          return cleanJoin([
            "What if",
            subject(p.who),
            "crossed paths with",
            aAn(p.obj) + "?",
          ]);
        }
        if (p.who) {
          return cleanJoin(["What if", subject(p.who), "was not who everyone thought?"]);
        }
        var bits = COLUMN_ORDER.map(function (id) {
          return lc(p[id]);
        }).filter(Boolean);
        return "What if " + bits.join(", and then ") + "?";
      },
    },
    question: {
      label: "Where could it go?",
      build: function (p) {
        if (p.who && p.where) {
          return cleanJoin([
            "Where could your story go if",
            subject(p.who) + ",",
            settingPhrase(p.where) + ",",
            (p.act ? actionPhrase(p.act) : "had to change course"),
            p.obj ? objectPhrase(p.obj, p.act) : "",
            "— and",
            p.twist ? twistPhrase(p.twist) : "nothing was quite what it seemed",
            "?",
          ]);
        }
        if (p.where && p.twist) {
          return cleanJoin([
            "What might happen",
            inPlace(p.where),
            "if",
            twistPhrase(p.twist) + "?",
          ]);
        }
        var bits = COLUMN_ORDER.map(function (id) {
          return lc(p[id]);
        }).filter(Boolean);
        return "Where could your project go if " + bits.join(", and ") + "?";
      },
    },
    next_beat: {
      label: "Possible next beat",
      build: function (p) {
        var lead = "A possible next beat:";
        if (p.who && p.act) {
          return cleanJoin([
            lead,
            subject(p.who) + ",",
            p.where ? settingPhrase(p.where) + "," : "",
            actionPhrase(p.act),
            p.obj ? objectPhrase(p.obj, p.act) + "." : ".",
            p.twist ? "Consider this twist: " + twistPhrase(p.twist) + "." : "",
          ]);
        }
        if (p.who && p.where) {
          return cleanJoin([
            lead,
            "put",
            subject(p.who),
            inPlace(p.where) + ".",
            p.twist ? twistPhrase(p.twist).charAt(0).toUpperCase() + twistPhrase(p.twist).slice(1) + "." : "",
          ]);
        }
        var bits = COLUMN_ORDER.map(function (id) {
          return lc(p[id]);
        }).filter(Boolean);
        return lead + " " + bits.join(" → ") + ".";
      },
    },
    constraint: {
      label: "Try this constraint",
      build: function (p) {
        if (p.twist) {
          return cleanJoin([
            "Try a scene where",
            twistPhrase(p.twist).replace(/^the real surprise (was|involved) /, ""),
            p.who ? "— for " + subject(p.who) : "",
            p.where ? inPlace(p.where) + "." : ".",
            p.obj ? "Make " + aAn(p.obj) + " matter to the moment." : "",
          ]);
        }
        var bits = COLUMN_ORDER.map(function (id) {
          return lc(p[id]);
        }).filter(Boolean);
        return "Try a scene built around: " + bits.join(" · ") + ".";
      },
    },
  };

  function pickRandom(list) {
    if (!list || !list.length) return "";
    return list[Math.floor(Math.random() * list.length)];
  }

  function wordsFromTextarea(text) {
    return String(text || "")
      .split(/\n+/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);
  }

  function wordsToTextarea(words) {
    return (words || []).join("\n");
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      LoreKeeperSpinnerStore.save(state);
      LoreKeeperAccountStorage.flush();
    }, 400);
  }

  function activePicks() {
    return picksFromColumns(state.columns);
  }

  function hasAnyPick(picks) {
    return COLUMN_ORDER.some(function (id) {
      return !!picks[id];
    });
  }

  function buildPrompt() {
    var picks = activePicks();
    if (!hasAnyPick(picks)) {
      return "Add a few words to your banks below, then spin again. This is only a nudge — not an assignment.";
    }
    var tpl = TEMPLATES[state.template] || TEMPLATES.nudge;
    return tpl.build(picks);
  }

  function renderResult() {
    var el = document.getElementById("spinnerResult");
    if (!el) return;
    el.textContent = buildPrompt();
  }

  function renderColumns() {
    var row = document.getElementById("spinnerColumns");
    if (!row) return;
    row.innerHTML = "";
    state.columns.forEach(function (col, index) {
      var card = document.createElement("div");
      card.className = "lk-spin-col" + (col.current ? "" : " lk-spin-col-empty");

      var label = document.createElement("p");
      label.className = "lk-spin-col-label";
      label.textContent = col.label;

      var word = document.createElement("p");
      word.className = "lk-spin-col-word";
      word.textContent = col.current || "—";

      var lockBtn = document.createElement("button");
      lockBtn.type = "button";
      lockBtn.className = "lk-spin-lock" + (col.locked ? " is-locked" : "");
      lockBtn.setAttribute("aria-pressed", col.locked ? "true" : "false");
      lockBtn.title = col.locked ? "Unpin this column" : "Pin on next spin";
      lockBtn.textContent = col.locked ? "Pinned" : "Pin";
      lockBtn.addEventListener("click", function () {
        col.locked = !col.locked;
        renderColumns();
        scheduleSave();
      });

      card.appendChild(label);
      card.appendChild(word);
      card.appendChild(lockBtn);
      row.appendChild(card);
    });
  }

  function renderBanks() {
    var wrap = document.getElementById("spinnerBanks");
    if (!wrap) return;
    wrap.innerHTML = "";
    state.columns.forEach(function (col, index) {
      var block = document.createElement("div");
      block.className = "lk-spin-bank";

      var labelField = document.createElement("label");
      labelField.className = "lk-field";
      labelField.innerHTML = "Column label <input type='text' data-bank-label='" + index + "' value='' />";
      labelField.querySelector("input").value = col.label;
      labelField.querySelector("input").addEventListener("input", function (e) {
        col.label = e.target.value;
        renderColumns();
        scheduleSave();
      });

      var wordsField = document.createElement("label");
      wordsField.className = "lk-field";
      wordsField.textContent = "Your words (one per line)";
      var ta = document.createElement("textarea");
      ta.rows = 4;
      ta.placeholder = "Add your own species, places, objects…";
      ta.value = wordsToTextarea(col.words);
      ta.addEventListener("input", function (e) {
        col.words = wordsFromTextarea(e.target.value);
        scheduleSave();
      });
      wordsField.appendChild(ta);

      block.appendChild(labelField);
      block.appendChild(wordsField);
      wrap.appendChild(block);
    });
  }

  function spin() {
    state.columns.forEach(function (col) {
      if (col.locked && col.current) return;
      if (!col.words.length) {
        col.current = "";
        return;
      }
      col.current = pickRandom(col.words);
    });
    renderColumns();
    renderResult();
    scheduleSave();
  }

  function copyResult() {
    var text = buildPrompt();
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      return global.navigator.clipboard.writeText(text).then(function () {
        setStatus("Copied.", true);
      });
    }
    setStatus("Copy not available in this browser.", false);
    return Promise.resolve();
  }

  function setStatus(msg, ok) {
    var el = document.getElementById("spinnerStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "lk-status" + (ok ? " ok" : "");
  }

  function bindUi() {
    document.getElementById("spinBtn").addEventListener("click", spin);
    document.getElementById("copyPromptBtn").addEventListener("click", function () {
      copyResult();
    });
    document.getElementById("templateSelect").addEventListener("change", function (e) {
      state.template = e.target.value;
      renderResult();
      scheduleSave();
    });
  }

  function init() {
    state = LoreKeeperSpinnerStore.load();
    document.getElementById("templateSelect").value = state.template || "nudge";
    renderBanks();
    renderColumns();
    renderResult();
    bindUi();
  }

  LoreKeeperAccountStorage.ready.then(function () {
    if (!LoreKeeperAccountStorage.isSignedIn()) {
      LoreKeeperAccountStorage.ensureSignedIn();
      return;
    }
    init();
  });
})(typeof window !== "undefined" ? window : this);
