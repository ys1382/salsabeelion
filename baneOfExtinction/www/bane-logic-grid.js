/**
 * Logic grid — full game, owner-only until Office switch logicGridPublic.
 * Boards use learned-codex facts + generated stills (never camera photos).
 */
(function (global) {
  "use strict";

  var API = "/bane-of-extinction/api/logic-grid-puzzle";
  var ME = "/bane-of-extinction/api/auth/me";
  var PROGRESS_KEY = "bane_logic_grid_v1";
  var ACTIVE_KEY = "bane_logic_grid_active_v1";
  var MIN_SPECIES = 4;

  var puzzle = null;
  var state = {};
  var clueUsed = [];
  var usedOrder = [];
  var clickTimers = {};
  var auth = { signedIn: false, isOwner: false, logicGridEnabled: false };
  var stillsByName = {};

  function $(id) {
    return global.document.getElementById(id);
  }

  function readProgress() {
    try {
      var raw = global.localStorage.getItem(PROGRESS_KEY);
      var obj = raw ? JSON.parse(raw) : {};
      if (!obj || typeof obj !== "object") obj = {};
      return {
        solved: Array.isArray(obj.solved) ? obj.solved.slice() : [],
        usedSpecies: Array.isArray(obj.usedSpecies) ? obj.usedSpecies.slice() : [],
        codexSolves: Number(obj.codexSolves) || 0,
      };
    } catch (e) {
      return { solved: [], usedSpecies: [], codexSolves: 0 };
    }
  }

  function writeProgress(prog) {
    try {
      global.localStorage.setItem(PROGRESS_KEY, JSON.stringify(prog));
    } catch (e) {}
  }

  function readActive() {
    try {
      var raw = global.sessionStorage.getItem(ACTIVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeActive(board) {
    try {
      if (!board) global.sessionStorage.removeItem(ACTIVE_KEY);
      else global.sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(board));
    } catch (e) {}
  }

  function uniqueSpecies(entries) {
    var Coll = global.BaneCodexCollection;
    var byKey = {};
    (entries || []).forEach(function (e) {
      if (!e) return;
      var sk = Coll && Coll.speciesOnlyKey ? Coll.speciesOnlyKey(e) : "";
      if (!sk) sk = String(e.key || "").split("|")[0];
      if (!sk) return;
      var prev = byKey[sk];
      if (!prev || (Number(e.lastSeenAt) || 0) >= (Number(prev.lastSeenAt) || 0)) {
        var copy = Object.assign({}, e);
        copy.speciesKey = sk;
        byKey[sk] = copy;
      }
    });
    return Object.keys(byKey).map(function (k) {
      return byKey[k];
    });
  }

  function typeBucket(entry) {
    var t = String((entry && entry.organismType) || "other").toLowerCase();
    if (/bird|mammal|reptile|amphibian|fish/.test(t)) return "animal";
    if (/insect|spider|bug/.test(t)) return "bug";
    if (/flower|plant|tree|fungus/.test(t)) return "plant";
    if (/rock|mineral|shell|fossil/.test(t)) return "geo";
    if (/plastic|asphalt|pavement|concrete|glass|metal|curb|object|packaging/.test(t))
      return "object";
    return "other";
  }

  function pickFour(species, usedKeys) {
    var used = {};
    (usedKeys || []).forEach(function (k) {
      used[String(k)] = true;
    });
    var unused = [];
    var reused = [];
    species.forEach(function (s) {
      if (used[s.speciesKey]) reused.push(s);
      else unused.push(s);
    });
    unused.sort(function (a, b) {
      return (Number(b.lastSeenAt) || 0) - (Number(a.lastSeenAt) || 0);
    });
    reused.sort(function (a, b) {
      return (Number(b.lastSeenAt) || 0) - (Number(a.lastSeenAt) || 0);
    });
    var pool = unused.concat(reused);
    var picked = [];
    var seenType = {};
    pool.forEach(function (s) {
      if (picked.length >= MIN_SPECIES) return;
      var bucket = typeBucket(s);
      if (seenType[bucket] && picked.length + (pool.length - picked.length) > MIN_SPECIES) {
        return;
      }
      seenType[bucket] = true;
      picked.push(s);
    });
    pool.forEach(function (s) {
      if (picked.length >= MIN_SPECIES) return;
      var already = picked.some(function (p) {
        return p.speciesKey === s.speciesKey;
      });
      if (!already) picked.push(s);
    });
    return picked.slice(0, MIN_SPECIES);
  }

  function knownFactTexts() {
    var F = global.BaneCodexFacts;
    if (!F || !F.readAll) return [];
    return F.readAll()
      .map(function (f) {
        return f && f.fact;
      })
      .filter(Boolean);
  }

  function farUnlocked(prog) {
    return auth.isOwner || (prog.codexSolves || 0) >= 1;
  }

  function cellKey(catA, iA, catB, iB) {
    if (catA < catB) return catA + ":" + iA + "|" + catB + ":" + iB;
    return catB + ":" + iB + "|" + catA + ":" + iA;
  }

  function nSize() {
    return (puzzle && puzzle.n) || 4;
  }

  function uniquenessX(rowCat, colCat, ri, ci) {
    var n = nSize();
    var j, i;
    for (j = 0; j < n; j++) {
      if (j !== ci && (state[cellKey(rowCat, ri, colCat, j)] || "") === "yes") return true;
    }
    for (i = 0; i < n; i++) {
      if (i !== ri && (state[cellKey(rowCat, i, colCat, ci)] || "") === "yes") return true;
    }
    return false;
  }

  function displayMark(rowCat, colCat, ri, ci) {
    var user = state[cellKey(rowCat, ri, colCat, ci)] || "";
    if (user === "yes") return "yes";
    if (user === "x") return "x";
    if (uniquenessX(rowCat, colCat, ri, ci)) return "x";
    return "";
  }

  function toggleX(rowCat, colCat, ri, ci) {
    var key = cellKey(rowCat, ri, colCat, ci);
    var cur = state[key] || "";
    if (cur === "yes" || cur === "x") {
      state[key] = "";
      return;
    }
    if (uniquenessX(rowCat, colCat, ri, ci)) return;
    state[key] = "x";
  }

  function lockMatch(rowCat, colCat, ri, ci) {
    var key = cellKey(rowCat, ri, colCat, ci);
    var n = nSize();
    var j, i, other;
    if ((state[key] || "") === "yes") {
      state[key] = "";
      return;
    }
    for (j = 0; j < n; j++) {
      if (j === ci) continue;
      other = cellKey(rowCat, ri, colCat, j);
      if ((state[other] || "") === "yes") state[other] = "";
    }
    for (i = 0; i < n; i++) {
      if (i === ri) continue;
      other = cellKey(rowCat, i, colCat, ci);
      if ((state[other] || "") === "yes") state[other] = "";
    }
    state[key] = "yes";
  }

  function markLabel(mark) {
    if (mark === "x") return "×";
    if (mark === "yes") return "●";
    return "";
  }

  function cats() {
    return puzzle.cats;
  }

  function colHead(id) {
    var box = global.document.createElement("div");
    box.className = "col-head";
    var lab = global.document.createElement("div");
    lab.className = "cat-lab";
    lab.textContent = cats()[id].title;
    box.appendChild(lab);
    var labs = global.document.createElement("div");
    labs.className = "col-labs";
    var shorts = cats()[id].short || cats()[id].items;
    shorts.forEach(function (name, i) {
      var span = global.document.createElement("span");
      span.textContent = name;
      span.title = cats()[id].items[i];
      labs.appendChild(span);
    });
    box.appendChild(labs);
    return box;
  }

  function rowHead(id) {
    var box = global.document.createElement("div");
    box.className = "row-head";
    var lab = global.document.createElement("div");
    lab.className = "cat-lab";
    lab.textContent = cats()[id].title;
    box.appendChild(lab);
    var names = global.document.createElement("div");
    names.className = "names";
    cats()[id].items.forEach(function (name, i) {
      var label = (cats()[id].short && cats()[id].short[i]) || name;
      var span = global.document.createElement("span");
      span.title = name;
      if (id === "species") {
        var src = stillsByName[name] || stillsByName[name.toLowerCase()];
        if (src) {
          var img = global.document.createElement("img");
          img.className = "grid-still";
          img.alt = "";
          img.src = src;
          span.appendChild(img);
        }
      }
      var t = global.document.createElement("em");
      t.textContent = label;
      span.appendChild(t);
      names.appendChild(span);
    });
    box.appendChild(names);
    return box;
  }

  function hasSubgrid(rowCat, colCat) {
    var order = puzzle.catOrder || ["species", "where", "trait", "origin"];
    return order.indexOf(rowCat) < order.indexOf(colCat);
  }

  function subgridTable(rowCat, colCat) {
    var table = global.document.createElement("table");
    table.className = "sub";
    cats()[rowCat].items.forEach(function (rowName, ri) {
      var tr = global.document.createElement("tr");
      cats()[colCat].items.forEach(function (colName, ci) {
        var td = global.document.createElement("td");
        var mark = displayMark(rowCat, colCat, ri, ci);
        var btn = global.document.createElement("button");
        btn.type = "button";
        btn.className = "cell-btn" + (mark ? " is-" + mark : "");
        btn.textContent = markLabel(mark);
        btn.setAttribute(
          "aria-label",
          rowName +
            " × " +
            colName +
            (mark === "x" ? ", crossed out" : mark === "yes" ? ", locked match" : ", empty")
        );
        btn.addEventListener("click", function () {
          var key = cellKey(rowCat, ri, colCat, ci);
          if (clickTimers[key]) {
            global.clearTimeout(clickTimers[key]);
            delete clickTimers[key];
            return;
          }
          clickTimers[key] = global.setTimeout(function () {
            delete clickTimers[key];
            toggleX(rowCat, colCat, ri, ci);
            renderBoards();
          }, 280);
        });
        btn.addEventListener("dblclick", function (e) {
          e.preventDefault();
          var key = cellKey(rowCat, ri, colCat, ci);
          if (clickTimers[key]) {
            global.clearTimeout(clickTimers[key]);
            delete clickTimers[key];
          }
          lockMatch(rowCat, colCat, ri, ci);
          renderBoards();
        });
        td.appendChild(btn);
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    return table;
  }

  function renderBoards() {
    var host = $("boards");
    if (!host || !puzzle) return;
    host.innerHTML = "";
    var wrap = global.document.createElement("div");
    wrap.className = "logic-l";
    wrap.appendChild(global.document.createElement("div"));
    (puzzle.colGroups || ["origin", "trait", "where"]).forEach(function (id) {
      wrap.appendChild(colHead(id));
    });
    (puzzle.rowGroups || ["species", "where", "trait"]).forEach(function (rowCat) {
      wrap.appendChild(rowHead(rowCat));
      (puzzle.colGroups || ["origin", "trait", "where"]).forEach(function (colCat) {
        if (!hasSubgrid(rowCat, colCat)) {
          var skip = global.document.createElement("div");
          skip.className = "logic-l__skip";
          skip.setAttribute("aria-hidden", "true");
          wrap.appendChild(skip);
          return;
        }
        wrap.appendChild(subgridTable(rowCat, colCat));
      });
    });
    host.appendChild(wrap);
  }

  function renderClues() {
    var list = $("clueList");
    if (!list || !puzzle) return;
    list.innerHTML = "";
    var clues = puzzle.clues || [];
    var order = [];
    clues.forEach(function (_c, i) {
      if (!clueUsed[i]) order.push(i);
    });
    usedOrder.forEach(function (i) {
      order.push(i);
    });
    order.forEach(function (i) {
      var li = global.document.createElement("li");
      var btn = global.document.createElement("button");
      btn.type = "button";
      btn.className = "clue-btn" + (clueUsed[i] ? " is-used" : "");
      btn.textContent = clues[i];
      btn.addEventListener("click", function () {
        if (!clueUsed[i]) {
          clueUsed[i] = true;
          usedOrder.push(i);
        } else {
          clueUsed[i] = false;
          usedOrder = usedOrder.filter(function (x) {
            return x !== i;
          });
        }
        renderClues();
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function collectNewFacts() {
    var F = global.BaneCodexFacts;
    if (!F || !F.collectCallouts || !puzzle || !puzzle.newFacts) return;
    puzzle.newFacts.forEach(function (fact) {
      F.collectCallouts(
        {
          speciesKey: fact.speciesKey,
          commonName: fact.commonName,
          latinName: fact.latinName,
        },
        [{ fact: fact.fact, label: fact.label, kind: fact.kind }]
      );
    });
  }

  function markSolved() {
    if (!puzzle || !puzzle.boardId) return;
    var prog = readProgress();
    if (prog.solved.indexOf(puzzle.boardId) >= 0) return;
    prog.solved.push(puzzle.boardId);
    if (puzzle.kind === "codex") {
      prog.codexSolves = (prog.codexSolves || 0) + 1;
      (puzzle.species || []).forEach(function (s) {
        var k = s.speciesKey || s.commonName;
        if (k && prog.usedSpecies.indexOf(k) < 0) prog.usedSpecies.push(k);
      });
    }
    writeProgress(prog);
    writeActive(null);
    renderPicker();
  }

  function checkBoard() {
    var status = $("checkStatus");
    if (!puzzle || !status) return;
    var missing = false;
    var wrong = false;
    var n = nSize();
    var sol = puzzle.solution || {};
    (puzzle.pairIds || []).forEach(function (pid) {
      var parts = pid.split("|");
      var a = parts[0];
      var b = parts[1];
      var mapping = sol[pid] || sol[b + "|" + a];
      if (!mapping) mapping = [];
      for (var i = 0; i < n; i++) {
        var yesAt = -1;
        var yesCount = 0;
        for (var j = 0; j < n; j++) {
          if ((state[cellKey(a, i, b, j)] || "") === "yes") {
            yesCount += 1;
            yesAt = j;
          }
        }
        if (yesCount !== 1) missing = true;
        else if (yesAt !== mapping[i]) wrong = true;
      }
    });
    if (wrong) {
      status.textContent =
        "Some locked matches are not right. A two-sided clue is marked where those two labels meet — then you still have to carry it to the other little squares yourself.";
      return;
    }
    if (missing) {
      status.textContent = "Lock one match in each little square of the L (the green dot), then check again.";
      return;
    }
    collectNewFacts();
    markSolved();
    status.textContent = puzzle.winNote || "That’s the set.";
  }

  function showOnly(id) {
    ["denied", "needMore", "loading", "puzzle"].forEach(function (key) {
      var el = $(key);
      if (el) el.hidden = key !== id;
    });
    var bar = $("boardBar");
    if (bar) bar.hidden = id === "denied";
  }

  function renderPicker() {
    var bar = $("boardBar");
    if (!bar) return;
    var prog = readProgress();
    var farBtn = $("farBtn");
    var farNote = $("farNote");
    if (farBtn) {
      farBtn.disabled = !farUnlocked(prog);
    }
    if (farNote) {
      if (farUnlocked(prog)) {
        farNote.textContent = auth.isOwner && prog.codexSolves < 1
          ? "Later board — preview for you. Players unlock this after one neighbor puzzle."
          : "Far neighbors — species most people never stand next to.";
      } else {
        farNote.textContent =
          "Far-neighbor boards (snow leopard and friends) unlock after you finish one puzzle from your own codex.";
      }
    }
  }

  function resetBoard() {
    Object.keys(clickTimers).forEach(function (k) {
      global.clearTimeout(clickTimers[k]);
    });
    clickTimers = {};
    state = {};
    clueUsed = (puzzle.clues || []).map(function () {
      return false;
    });
    usedOrder = [];
    var status = $("checkStatus");
    if (status) status.textContent = "";
    renderBoards();
    renderClues();
  }

  function applyPuzzle(data, stillMap) {
    puzzle = data;
    stillsByName = stillMap || {};
    if (data.species) {
      data.species.forEach(function (s) {
        var name = s.commonName;
        if (name && s.stillUrl && !stillsByName[name]) stillsByName[name] = s.stillUrl;
      });
    }
    showOnly("puzzle");
    renderPicker();
    resetBoard();
  }

  function needMoreCopy(have, extraMessage) {
    var need = Math.max(0, MIN_SPECIES - (have || 0));
    var el = $("needMoreText");
    if (!el) return;
    if (extraMessage) {
      el.textContent = extraMessage;
      return;
    }
    el.textContent =
      (need
        ? "Learn " + need + " more safe neighbor" + (need === 1 ? "" : "s") + " to unlock a logic grid. "
        : "Scan another safe neighbor to unlock a fresh board — there are only so many new facts in one jasmine hedge. ") +
      "Use EcoLens on plants, bugs, rocks, empty shells, and calm wildlife you already share space with. Do not crowd animals that can bite or surprise you.";
  }

  function loadCodexBoard(forceNew) {
    var Coll = global.BaneCodexCollection;
    var entries = Coll && Coll.readAll ? Coll.readAll() : [];
    var species = uniqueSpecies(entries);
    var prog = readProgress();
    if (species.length < MIN_SPECIES) {
      needMoreCopy(species.length);
      showOnly("needMore");
      renderPicker();
      var bar = $("boardBar");
      if (bar) bar.hidden = false;
      return;
    }
    if (!forceNew) {
      var active = readActive();
      if (active && active.kind === "codex" && active.cats) {
        var stillMap = {};
        species.forEach(function (s) {
          var url = Coll.stillDataUrl ? Coll.stillDataUrl(s) : "";
          if (url) stillMap[s.commonName || s.displayName] = url;
        });
        applyPuzzle(active, stillMap);
        return;
      }
    }
    var picked = pickFour(species, prog.usedSpecies);
    var stillMap = {};
    var payloadSpecies = picked.map(function (s) {
      var url = Coll.stillDataUrl ? Coll.stillDataUrl(s) : "";
      var name = s.commonName || s.displayName;
      if (url) stillMap[name] = url;
      return {
        speciesKey: s.speciesKey,
        commonName: name,
        latinName: s.latinName || "",
        organismType: s.organismType || "",
        lifeStage: s.lifeStage || "",
      };
    });
    showOnly("loading");
    fetch(API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        board: "codex",
        species: payloadSpecies,
        knownFacts: knownFactTexts(),
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { res: res, data: data || {} };
        });
      })
      .then(function (pack) {
        var data = pack.data;
        if (data.needMore) {
          needMoreCopy(data.haveSpecies, data.message);
          showOnly("needMore");
          var bar = $("boardBar");
          if (bar) bar.hidden = false;
          return;
        }
        if (!data.ok || !data.cats) {
          needMoreCopy(
            species.length,
            (data && data.message) ||
              "Could not build a neighbor puzzle. Try again, or scan one more safe neighbor."
          );
          showOnly("needMore");
          var bar2 = $("boardBar");
          if (bar2) bar2.hidden = false;
          return;
        }
        writeActive(data);
        applyPuzzle(data, stillMap);
      })
      .catch(function () {
        needMoreCopy(
          species.length,
          "Could not reach the puzzle helper. Try again in a moment."
        );
        showOnly("needMore");
      });
  }

  function loadFarBoard(forceNew) {
    var prog = readProgress();
    if (!farUnlocked(prog)) {
      needMoreCopy(0, "Finish one puzzle from your own wildlife codex first — then far neighbors open.");
      showOnly("needMore");
      var bar = $("boardBar");
      if (bar) bar.hidden = false;
      renderPicker();
      return;
    }
    if (!forceNew) {
      var active = readActive();
      if (active && active.kind === "far" && active.cats) {
        applyPuzzle(active, {});
        return;
      }
    }
    showOnly("loading");
    fetch(API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ board: "far" }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok || !data.cats) {
          needMoreCopy(0, (data && data.message) || "Could not load the far-neighbor board.");
          showOnly("needMore");
          return;
        }
        writeActive(data);
        applyPuzzle(data, {});
      })
      .catch(function () {
        needMoreCopy(0, "Could not load the far-neighbor board. Try again in a moment.");
        showOnly("needMore");
      });
  }

  function bind() {
    var checkBtn = $("checkBtn");
    var resetBtn = $("resetBtn");
    var newBtn = $("newBoardBtn");
    var codexBtn = $("codexBtn");
    var farBtn = $("farBtn");
    if (checkBtn) checkBtn.addEventListener("click", checkBoard);
    if (resetBtn) resetBtn.addEventListener("click", resetBoard);
    if (newBtn)
      newBtn.addEventListener("click", function () {
        writeActive(null);
        if (puzzle && puzzle.kind === "far") loadFarBoard(true);
        else loadCodexBoard(true);
      });
    if (codexBtn) codexBtn.addEventListener("click", function () {
      writeActive(null);
      loadCodexBoard(true);
    });
    if (farBtn) farBtn.addEventListener("click", function () {
      writeActive(null);
      loadFarBoard(true);
    });
  }

  function start() {
    bind();
    fetch(ME, { credentials: "include" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        auth = {
          signedIn: !!(data && data.signedIn),
          isOwner: !!(data && data.isOwner),
          logicGridEnabled: !!(data && data.logicGridEnabled),
        };
        if (!auth.logicGridEnabled) {
          showOnly("denied");
          return;
        }
        var Coll = global.BaneCodexCollection;
        var ready = Coll && Coll.syncNow ? Coll.syncNow() : Promise.resolve();
        return ready.then(function () {
          renderPicker();
          var bar = $("boardBar");
          if (bar) bar.hidden = false;
          loadCodexBoard(false);
        });
      })
      .catch(function () {
        showOnly("denied");
      });
  }

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(typeof window !== "undefined" ? window : this);
