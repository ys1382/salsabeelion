/**
 * LoreKeeper — Phase 0 Tier A checklist + Ask quality playbook (owner account).
 */
(function (global) {
  var CHECKLIST_KEY = "lorekeeper_tier_a_checklist_v1";
  var TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

  var STORAGE_ITEMS = [
    { id: "storage_save_line", label: "Save line — doc sidebar shows Saved (not “not synced yet”)" },
    { id: "storage_refresh", label: "Refresh — hard refresh; last edits still there" },
    { id: "storage_second_device", label: "Second device — same account shows same content after save" },
    { id: "storage_tab_close", label: "Tab close — reopen doc; nothing lost (or restore backup works)" },
    { id: "storage_export", label: "Export — home JSON export matches what you expect" },
    { id: "storage_deploy", label: "Deploy blip — after deploy, sign in; nothing missing" },
  ];

  var ASK_ITEMS = [
    { id: "ask_save_before", label: "Save before Ask — wait for Saved before asking" },
    { id: "ask_name_work", label: "Name the work — in the question or doc Ask scope" },
    { id: "ask_tag_notes", label: "Tag notes — work title / character tags on notes" },
    { id: "ask_narrow", label: "Ask narrowly — one facet per question" },
    {
      id: "ask_coverage_wording",
      label: "Coverage wording — “summarize / what have I written” only when you want breadth",
    },
    { id: "ask_log_corrections", label: "Log corrections — It got this wrong → Owner’s Office" },
  ];

  function defaultChecklist() {
    var checks = {};
    STORAGE_ITEMS.concat(ASK_ITEMS).forEach(function (item) {
      checks[item.id] = false;
    });
    return { checks: checks, updatedAt: 0, startedAt: 0 };
  }

  function loadChecklist() {
    var Store = global.LoreKeeperAccountStorage;
    if (!Store || !Store.isSignedIn()) return defaultChecklist();
    var raw = Store.getItem(CHECKLIST_KEY);
    if (!raw) return defaultChecklist();
    try {
      var data = JSON.parse(raw);
      var base = defaultChecklist();
      if (data && data.checks && typeof data.checks === "object") {
        Object.keys(data.checks).forEach(function (k) {
          if (Object.prototype.hasOwnProperty.call(base.checks, k)) {
            base.checks[k] = !!data.checks[k];
          }
        });
      }
      base.updatedAt = data.updatedAt || 0;
      base.startedAt = data.startedAt || 0;
      return base;
    } catch (e) {
      return defaultChecklist();
    }
  }

  function saveChecklist(data) {
    var Store = global.LoreKeeperAccountStorage;
    if (!Store || !Store.isSignedIn()) return false;
    data.updatedAt = Date.now();
    return Store.setItem(CHECKLIST_KEY, JSON.stringify(data));
  }

  function countChecked(data) {
    var n = 0;
    var total = 0;
    var checks = (data && data.checks) || {};
    Object.keys(checks).forEach(function (k) {
      total += 1;
      if (checks[k]) n += 1;
    });
    return { done: n, total: total };
  }

  function renderCheckboxGroup(root, items, checks, onChange) {
    items.forEach(function (item) {
      var label = document.createElement("label");
      label.className = "lk-tier-a-check";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.checkId = item.id;
      input.checked = !!checks[item.id];
      input.addEventListener("change", function () {
        onChange(item.id, input.checked);
      });
      var span = document.createElement("span");
      span.textContent = item.label;
      label.appendChild(input);
      label.appendChild(span);
      root.appendChild(label);
    });
  }

  function renderCheatSheet(root) {
    if (!root) return;
    root.innerHTML =
      "<table class='lk-playbook-table'>" +
      "<thead><tr><th>You ask</th><th>You should get</th><th>Intent</th></tr></thead>" +
      "<tbody>" +
      "<tr><td>Who is Ella?</td><td>Short cast card</td><td>who_is</td></tr>" +
      "<tr><td>What is Ella? / What kind of person…?</td><td>Portrait paragraphs</td><td>character_portrait</td></tr>" +
      "<tr><td>What is Ella’s role?</td><td>One role line</td><td>narrow facet</td></tr>" +
      "<tr><td>How are A and B related?</td><td>Relationship only</td><td>relationship</td></tr>" +
      "<tr><td>What does Elara know…?</td><td>POV knowledge</td><td>knowledge</td></tr>" +
      "<tr><td>Where did I leave off?</td><td>Latest draft state</td><td>story_resume</td></tr>" +
      "<tr><td>What happens in the prologue?</td><td>Section summary</td><td>summarize_story</td></tr>" +
      "</tbody></table>" +
      "<p class='muted lk-playbook-table-note'>Repo reference: <code>LOREKEEPER-ASK-QUALITY-PLAYBOOK.md</code></p>";
  }

  function renderNoteStructureGuide(root) {
    if (!root) return;
    root.innerHTML =
      "<ul class='lk-playbook-list muted'>" +
      "<li><strong>Awareness notes</strong> — one short note per hard POV question: what they know <em>right now</em> (present tense), not future plans.</li>" +
      "<li><strong>Portrait notes</strong> — species, role, ties for “what is [name]?” — separate from planning/meta (“I wrote…”).</li>" +
      "<li><strong>Relationship entries</strong> for non-obvious ties (sibling, marriage, faction).</li>" +
      "<li><strong>Work tag</strong> on every note and document.</li>" +
      "<li><strong>Draft prose</strong> for scenes you expect Ask to summarize — scattered one-liners are hard to synthesize.</li>" +
      "<li><strong>Loose-end labels</strong> — <code>planned:</code> or <code>not drafted</code> for intentional gaps; <code>fix:</code> or <code>TODO fix</code> for contradictions to resolve; <code>draft only</code> when beats may change.</li>" +
      "</ul>" +
      "<p class='muted'><strong>Ask:</strong> <em>What's not written yet in [work]?</em> lists planned tags only. <em>What's flagged to fix?</em> lists fix tags. Canon audit skips planned notes.</p>" +
      "<p class='muted'>If portrait fails but you cannot find the name in your account in 30 seconds, fix notes before blaming the engine.</p>";
  }

  function initPhase0Office() {
    var mount = document.getElementById("phase0ChecklistMount");
    if (!mount || !global.LoreKeeperAccountStorage || !global.LoreKeeperAccountStorage.isOwner()) {
      return;
    }

    var checklist = loadChecklist();
    var statusEl = document.getElementById("phase0ChecklistStatus");
    var progressEl = document.getElementById("phase0ChecklistProgress");
    var twoWeekEl = document.getElementById("phase0TwoWeekStatus");

    function updateProgress() {
      var c = countChecked(checklist);
      if (progressEl) {
        progressEl.textContent = c.done + " / " + c.total + " checked";
        progressEl.className =
          "lk-tier-a-progress" + (c.done === c.total ? " lk-tier-a-progress--done" : "");
      }
      if (twoWeekEl) {
        if (!checklist.startedAt) {
          twoWeekEl.textContent = "Two-week run not started — click Start when you begin Phase 0.";
        } else {
          var elapsed = Date.now() - checklist.startedAt;
          var days = Math.floor(elapsed / (24 * 60 * 60 * 1000));
          var done = elapsed >= TWO_WEEKS_MS;
          twoWeekEl.textContent =
            (done ? "Two weeks complete — " : "Day " + days + " of 14 — ") +
            (done ? "keep habits if Ask still feels right." : "check items as you verify them.");
          twoWeekEl.className = "lk-tier-a-two-week" + (done ? " lk-tier-a-two-week--done" : "");
        }
      }
    }

    function persist() {
      saveChecklist(checklist);
      if (global.LoreKeeperAccountStorage.flush) {
        global.LoreKeeperAccountStorage.flush().then(function () {
          if (statusEl) {
            statusEl.textContent = "Saved.";
            statusEl.className = "lk-status ok";
            statusEl.hidden = false;
          }
        });
      }
      updateProgress();
    }

    function onCheck(id, checked) {
      checklist.checks[id] = checked;
      if (checked && !checklist.startedAt) {
        checklist.startedAt = Date.now();
      }
      persist();
    }

    var startBtn = document.getElementById("phase0StartTwoWeekBtn");
    if (startBtn) {
      startBtn.addEventListener("click", function () {
        if (!checklist.startedAt) {
          checklist.startedAt = Date.now();
          persist();
        }
      });
    }

    var storageRoot = document.getElementById("phase0StorageChecks");
    var askRoot = document.getElementById("phase0AskChecks");
    if (storageRoot) {
      storageRoot.innerHTML = "";
      renderCheckboxGroup(storageRoot, STORAGE_ITEMS, checklist.checks, onCheck);
    }
    if (askRoot) {
      askRoot.innerHTML = "";
      renderCheckboxGroup(askRoot, ASK_ITEMS, checklist.checks, onCheck);
    }

    renderCheatSheet(document.getElementById("phase0CheatSheet"));
    renderNoteStructureGuide(document.getElementById("phase0NoteGuide"));

    var resetBtn = document.getElementById("phase0ResetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (!confirm("Uncheck all Tier A items?")) return;
        checklist = defaultChecklist();
        saveChecklist(checklist);
        if (storageRoot) {
          storageRoot.querySelectorAll("input[type=checkbox]").forEach(function (el) {
            el.checked = false;
          });
        }
        if (askRoot) {
          askRoot.querySelectorAll("input[type=checkbox]").forEach(function (el) {
            el.checked = false;
          });
        }
        updateProgress();
        if (statusEl) {
          statusEl.textContent = "Checklist reset.";
          statusEl.className = "lk-status";
          statusEl.hidden = false;
        }
      });
    }

    updateProgress();
  }

  function initOwnerAskHints(beforeNode) {
    if (!beforeNode || !global.LoreKeeperAccountStorage) return;
    if (!global.LoreKeeperAccountStorage.isOwner()) return;
    if (
      beforeNode.previousElementSibling &&
      beforeNode.previousElementSibling.classList.contains("lk-tier-a-hints")
    ) {
      return;
    }
    var box = document.createElement("p");
    box.className = "lk-tier-a-hints muted";
    box.innerHTML =
      "<strong>Ask quality habits.</strong> Wait for <strong>Saved</strong> · name the work · one facet per question · " +
      'log failures with <strong>It got this wrong</strong> · <a href="./office.html">Owner’s Office playbook</a>.';
    beforeNode.parentNode.insertBefore(box, beforeNode);
  }

  global.LoreKeeperTierA = {
    initPhase0Office: initPhase0Office,
    initOwnerAskHints: initOwnerAskHints,
    loadChecklist: loadChecklist,
    countChecked: countChecked,
    STORAGE_ITEMS: STORAGE_ITEMS,
    ASK_ITEMS: ASK_ITEMS,
  };
})(typeof window !== "undefined" ? window : this);
