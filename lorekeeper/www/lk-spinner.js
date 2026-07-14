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

  function lc(phrase) {
    var w = String(phrase || "").trim();
    if (!w) return "";
    return w.charAt(0).toLowerCase() + w.slice(1);
  }

  function aAn(phrase) {
    var w = lc(phrase);
    if (!w) return "";
    if (/^(a|an|the|some|any)\s/i.test(w)) return w;
    return (/^[aeiou]/i.test(w) ? "an " : "a ") + w;
  }

  function inPlace(where) {
    var w = lc(where);
    if (!w) return "";
    if (/^(in|at|on|inside|within|under|above|behind|near|beyond|through|across|between)\s/i.test(w)) return w;
    return "in " + aAn(w);
  }

  function whoPart(who) {
    var w = lc(who);
    if (!w) return "";
    if (/^(a|an|the|some)\s/i.test(w)) return w;
    return aAn(w);
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

  function isIntransitiveAct(act) {
    var a = lc(act);
    if (!a) return false;
    if (/\basleep\b/.test(a)) return true;
    if (/\b(sleep|slept|rest|rested|wait|waited|hide|hid|sit|sat|stay|stayed|listen|watched|dream|dreamed|dreamt|lie|lay|linger|lingered|pause|paused|breathe|breathed|meditate|meditated)\b/.test(a)) {
      return true;
    }
    return false;
  }

  function isTransitiveAct(act) {
    var a = lc(act);
    if (!a) return false;
    var first = a.split(/\s+/)[0];
    return /^(find|found|discover|discovered|steal|stole|lose|lost|carry|carried|pick|picked|grab|grabbed|see|saw|spot|spotted|need|needed|want|wanted|drop|dropped|throw|threw|kick|kicked|push|pushed|take|took|bring|brought|open|opened|close|closed|catch|caught|hold|held|use|used|eat|ate|drink|drank|read|write|wrote|tell|told|show|showed|give|gave|leave|left|send|sent|break|broke|fix|fixed|build|built|make|made|pull|pulled|lift|lifted|touch|touched|strike|struck|cut|slice|sliced|burn|burned|burnt|bury|buried|dig|dug|plant|planted|save|saved|free|freed|trap|trapped|release|released|chase|chased|follow|followed|track|tracked|hunt|hunted|fight|fought|attack|attacked|defend|defended|protect|protected|rescue|rescued|betray|betrayed|trust|trusted|forget|forgot|remember|remembered|learn|learned|teach|taught|ask|asked|answer|answered|call|called|name|named|claim|claimed|seal|sealed|unlock|unlocked|lock|locked|reach|reached|touch|touched|meet|met|greet|greeted|warn|warned|threaten|threatened|offer|offered|refuse|refused|accept|accepted|choose|chose|decide|decided|start|started|begin|began|end|ended|finish|finished|complete|completed|destroy|destroyed|create|created|forge|forged|craft|crafted|repair|repaired|mend|mended|heal|healed|hurt|harm|harmed|help|helped|serve|served|feed|fed|cook|cooked|clean|cleaned|wash|washed|dress|dressed|pack|packed|unpack|unpacked|load|loaded|unload|unloaded|bind|bound|tie|tied|untie|untied|wrap|wrapped|unwrap|unwrapped|hide|hid|conceal|concealed|reveal|revealed|expose|exposed|cover|covered|uncover|uncovered|light|lit|ignite|ignited|extinguish|extinguished|extinguish|extinguished)\b/i.test(first);
  }

  function pickOne(list) {
    if (!list || !list.length) return "";
    return list[Math.floor(Math.random() * list.length)];
  }

  function capPeriod(text) {
    var t = String(text || "").trim();
    if (!t) return "";
    return t.charAt(0).toUpperCase() + t.replace(/[.?!]+$/, "") + ".";
  }

  function withArticlePhrase(prefix, phrase) {
    var w = lc(phrase);
    if (/^(a|an|the)\s/i.test(w)) return prefix + " " + w + ".";
    return prefix + " a " + w + ".";
  }

  function hasLeadingPrep(phrase) {
    return /^(with|using|holding|carrying|fending|guarding|clutching|protecting|defending|watching|without|near|beside|over|under|around|through|into|onto|off|from|against|between|among|behind|before|after|during|while)\s/i.test(lc(phrase));
  }

  function participialObject(obj) {
    var noun = aAn(obj);
    return pickOne([
      "holding " + noun,
      "fending off " + noun,
      "guarding " + noun,
      "clutching " + noun,
    ]);
  }

  /** Act + object as one verb phrase: "fell asleep holding a knife", "found a knife". */
  function verbPhrase(act, obj) {
    var a = act ? lc(act) : "";
    var rawObj = obj ? String(obj).trim() : "";
    if (!a && rawObj) return "encounters " + aAn(rawObj);
    if (!a) return "";
    if (!rawObj) return a;
    if (hasLeadingPrep(rawObj)) return cleanJoin([a, lc(rawObj)]);
    if (isTransitiveAct(a)) return cleanJoin([a, aAn(rawObj)]);
    return cleanJoin([a, participialObject(rawObj)]);
  }

  /** One scene beat: who → verb phrase → setting. */
  function assembleSceneBeat(p) {
    var who = p.who ? whoPart(p.who) : "";
    var vp = verbPhrase(p.act, p.obj);
    var where = p.where ? inPlace(p.where) : "";

    if (who && vp && where) return cleanJoin([who, vp, where]);
    if (who && vp) return cleanJoin([who, vp]);
    if (who && where) return cleanJoin([who, where]);
    if (who && p.obj && !p.act) return cleanJoin([who, "encounters", aAn(p.obj), where]);
    if (vp && where) return cleanJoin([who || "someone", vp, where]);
    if (vp) return cleanJoin([who || "someone", vp]);
    if (where) return cleanJoin([who || "something happens", where]);
    if (p.obj) return cleanJoin([who || "someone", "crosses paths with", aAn(p.obj)]);
    return "";
  }

  /** Twist bank phrase → one complete readable sentence (your words, light framing only). */
  function twistReadable(raw) {
    var text = String(raw || "").trim();
    if (!text) return "";
    var w = lc(text);
    var words = text.split(/\s+/);

    if (/^(and|but|yet|except|because|when|while|if|so|there|someone|one|nobody|everyone|no one|what if|it turns out|turns out)\b/i.test(w)) {
      return capPeriod(text);
    }
    if (words.length >= 6 || /[.?!]$/.test(text)) return capPeriod(text);

    if (/\b(identity|disguise|alias|impostor|double life|secret past|hidden name|not who they seem|undercover)\b/i.test(w)) {
      return withArticlePhrase("One character in the story has", text);
    }

    if (/\b(betrayal|traitor|loyalty|trust|ally|enemy)\b/i.test(w)) {
      return capPeriod("Someone's " + w + " may not be what it seems");
    }

    if (/^(only|no|never|always|every|nothing|everything|must|can't|cannot)\b/i.test(w)) {
      return capPeriod(text);
    }

    if (/\b(wrong|mistaken|misread|innocent|guilty|accused|revealed|hidden|truth|lie)\b/i.test(w)) {
      return capPeriod("What if " + w);
    }

    if (words.length <= 4) {
      return capPeriod("What if " + w + " changes what happens next");
    }

    return capPeriod("What if " + w);
  }

  function twistLine(twist) {
    var sentence = twistReadable(twist);
    if (!sentence) return "";
    return "Potential Twist: " + sentence;
  }

  function formatTwoBeat(opener, scene, twist) {
    if (!scene) return "";
    var line1 = opener(scene);
    if (!twist) return line1;
    return line1 + "\n" + twistLine(twist);
  }

  function withTwistLine(line1, twist) {
    if (!line1) return twist ? twistLine(twist) : "";
    if (!twist) return line1;
    return line1 + "\n" + twistLine(twist);
  }

  function fallbackBits(p) {
    return COLUMN_ORDER.filter(function (id) {
      return id !== "twist";
    }).map(function (id) {
      return lc(p[id]);
    }).filter(Boolean);
  }

  var TEMPLATES = {
    nudge: {
      label: "What if…?",
      build: function (p) {
        var scene = assembleSceneBeat(p);
        if (!scene) {
          var fallback = fallbackBits(p);
          return fallback.length ? withTwistLine("What if " + fallback.join(" · ") + "?", p.twist) : "";
        }
        return formatTwoBeat(function (s) { return "What if " + s + "?"; }, scene, p.twist);
      },
    },
    question: {
      label: "Where could it go?",
      build: function (p) {
        var scene = assembleSceneBeat(p);
        if (!scene) {
          var fallback = fallbackBits(p);
          return fallback.length ? withTwistLine("Where could your story go with " + fallback.join(" · ") + "?", p.twist) : "";
        }
        return formatTwoBeat(function (s) { return "Where could your story go if " + s + "?"; }, scene, p.twist);
      },
    },
    next_beat: {
      label: "Possible next beat",
      build: function (p) {
        var scene = assembleSceneBeat(p);
        if (!scene) {
          var fallback = fallbackBits(p);
          return fallback.length ? withTwistLine("A possible next beat: " + fallback.join(" → ") + ".", p.twist) : "";
        }
        return formatTwoBeat(function (s) { return "A possible next beat: " + s + "."; }, scene, p.twist);
      },
    },
    constraint: {
      label: "Try this constraint",
      build: function (p) {
        var scene = assembleSceneBeat(p);
        if (p.twist) {
          var twistOnly = twistLine(p.twist);
          if (scene) {
            return "Try a scene where " + scene + ".\n" + twistOnly;
          }
          return twistOnly.replace(/^Potential Twist: /, "Try a scene built around: ");
        }
        if (scene) return "Try a scene where " + scene + ".";
        var fallback = fallbackBits(p);
        return fallback.length ? "Try a scene built around: " + fallback.join(" · ") + "." : "";
      },
    },
  };

  /* Regression picks (manual):
   * phoenix / fell asleep / knife / meadow / secret identity
   *   → What if a phoenix fell asleep holding a knife in a meadow?
   *      Potential Twist: One character in the story has a secret identity.
   */

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
    if (!hasAnyPick(picks)) return "";
    var tpl = TEMPLATES[state.template] || TEMPLATES.nudge;
    return tpl.build(picks);
  }

  function renderResult() {
    var el = document.getElementById("spinnerResult");
    if (!el) return;
    var text = buildPrompt();
    if (!text) {
      el.textContent = "";
      el.classList.add("is-empty");
      return;
    }
    el.classList.remove("is-empty");
    el.textContent = text;
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
    var hasWords = state.columns.some(function (col) {
      return col.words.length > 0;
    });
    if (!hasWords) {
      setStatus("Add words to your banks below, then spin.", false);
      return;
    }
    setStatus("", true);
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
    if (!text) {
      setStatus("Spin first, then copy your nudge.", false);
      return Promise.resolve();
    }
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
    var spinBtn = document.getElementById("spinBtn");
    var copyBtn = document.getElementById("copyPromptBtn");
    var tpl = document.getElementById("templateSelect");
    if (spinBtn) spinBtn.addEventListener("click", spin);
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        copyResult();
      });
    }
    if (tpl) {
      tpl.addEventListener("change", function (e) {
        state.template = e.target.value;
        renderResult();
        scheduleSave();
      });
    }
  }

  var initialized = false;

  function init() {
    if (initialized) return;
    if (!document.getElementById("spinnerBanks")) return;
    initialized = true;
    state = LoreKeeperSpinnerStore.load();
    var tpl = document.getElementById("templateSelect");
    if (tpl) tpl.value = state.template || "nudge";
    renderBanks();
    renderColumns();
    renderResult();
    bindUi();
  }

  global.LoreKeeperSpinner = { init: init };

  if (document.getElementById("spinnerBanks")) {
    LoreKeeperAccountStorage.ready.then(function () {
      if (!LoreKeeperAccountStorage.isSignedIn()) {
        LoreKeeperAccountStorage.ensureSignedIn();
        return;
      }
      if (!document.getElementById("panel-spinner")) {
        init();
      }
    });
  }
})(typeof window !== "undefined" ? window : this);
