(function () {
  const STORAGE_KEY = "crocheter_demo_v2";
  const defaultSkills = [
    { id: "ch", label: "Chain (ch)", ok: false },
    { id: "sc", label: "Single crochet (sc)", ok: false },
    { id: "slst", label: "Slip stitch (sl st)", ok: false },
    { id: "dc", label: "Double crochet (dc)", ok: false },
    { id: "tr", label: "Treble crochet (tr)", ok: false },
    { id: "mr", label: "Magic ring", ok: false },
  ];

  const patternId = document.body.dataset.patternId;
  const p = CrocheterPatterns.byId[patternId];
  if (!p) return;

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }
  function save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage blocked */
    }
  }
  let data = load();

  const VALID_EXPERIENCE = ["all", "beginner", "easy", "intermediate", "intermediate-advanced", "advanced"];

  function migrateExperience(val) {
    if (val === "beginner-intermediate") return "easy";
    if (VALID_EXPERIENCE.includes(val)) return val;
    return "all";
  }
  if (!data.experience) data.experience = "all";
  data.experience = migrateExperience(data.experience);
  if (!VALID_EXPERIENCE.includes(data.experience)) {
    data.experience = "all";
  }
  if (data.patternsHubListVersion !== 2) {
    data.patternsHubListVersion = 2;
    data.experience = "all";
  }

  if (!data.checksByPattern) data.checksByPattern = {};
  const allIds = Object.keys(CrocheterPatterns.byId);
  allIds.forEach((id) => {
    const def = CrocheterPatterns.byId[id];
    if (!data.checksByPattern[id]) data.checksByPattern[id] = def.steps.map(() => false);
    if (data.checksByPattern[id].length !== def.steps.length) {
      data.checksByPattern[id] = def.steps.map(() => false);
    }
  });
  if (!data.skills) data.skills = defaultSkills.map((s) => ({ ...s }));

  const stepsEl = document.getElementById("steps");
  const skillsEl = document.getElementById("skills");
  const focusEl = document.getElementById("focus");
  const patternTitle = document.querySelector(".pattern-title");
  const patternMeta = document.querySelector(".meta");
  const patternPreview = document.getElementById("patternPreview");
  if (patternPreview) {
    patternPreview.decoding = "async";
    patternPreview.fetchPriority = "high";
  }
  const toast = document.getElementById("toast");

  function renderDifficultyPanel() {
    const adminOn = typeof URL !== "undefined" && new URLSearchParams(location.search).get("admin") === "1";
    if (!adminOn) {
      return;
    }

    const c = p.difficulty;
    const eff = CrocheterPatterns.effectiveDifficultyDisplay(p);
    const src = CrocheterPatterns.overrideSource(p);
    const panel = document.createElement("section");
    panel.className = "pattern-difficulty-panel";
    panel.setAttribute("aria-label", "Pattern difficulty classification");

    const h = document.createElement("h3");
    h.textContent = "Difficulty (auto classifier)";
    panel.appendChild(h);

    const effP = document.createElement("p");
    effP.className = "effective";
    effP.innerHTML =
      eff.overridden ?
        "<strong>" +
        eff.effectiveHuman +
        "</strong> <span>(" +
        (src === "local" ? "browser override — " : src === "data" ? "published override — " : "") +
        "auto estimate: " +
        c.labelHuman +
        ")</span>" :
        "<strong>" + c.labelHuman + "</strong> <span>(automatic estimate)</span>";
    panel.appendChild(effP);

    const scoreP = document.createElement("p");
    scoreP.className = "score";
    scoreP.textContent = "Score " + c.score + " · appears in hubs: " + c.matchingLevels.join(", ").replace(/intermediate-advanced/g, "intermediate–advanced");
    panel.appendChild(scoreP);

    const reasonsTitle = document.createElement("strong");
    reasonsTitle.textContent = "Why:";
    panel.appendChild(reasonsTitle);
    const ul = document.createElement("ul");
    ul.className = "reasons";
    const reasons =
      c.reasons && c.reasons.length ?
        c.reasons :
        ["Straightforward stitches and construction for this demo library."];
    reasons.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r;
      ul.appendChild(li);
    });
    panel.appendChild(ul);

    const feats = document.createElement("pre");
    feats.className = "features-detected";
    feats.textContent =
      "Signals merged for scoring (explicit pattern.features + inferred from title/steps):\n" +
      JSON.stringify(CrocheterDifficulty.mergeFeatures(p), null, 2);

    panel.appendChild(feats);

    const box = document.createElement("div");
    box.className = "pattern-admin-box";
    const lab = document.createElement("label");
    lab.setAttribute("for", "difficultyAdminSel");
    lab.textContent = "Adjust manually (saved in this browser)";
    box.appendChild(lab);
    const sel = document.createElement("select");
    sel.id = "difficultyAdminSel";
    const levels = CrocheterDifficulty.LEVEL_ORDER;
    const localSlug = CrocheterPatterns.overrideSource(p) === "local" ? CrocheterPatterns.mergedDifficultyOverride(p) : null;
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Clear browser override —";
    empty.selected = !localSlug;
    sel.appendChild(empty);
    levels.forEach((slug) => {
      const opt = document.createElement("option");
      opt.value = slug;
      opt.textContent = CrocheterDifficulty.DISPLAY_LABEL[slug] || slug;
      opt.selected = !!(localSlug && localSlug === slug);
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => {
      const key = CrocheterPatterns.OVERRIDE_STORAGE_KEY;
      let map = {};
      try {
        map = JSON.parse(localStorage.getItem(key) || "{}") || {};
      } catch {
        map = {};
      }
      if (!sel.value) {
        delete map[patternId];
      } else {
        map[patternId] = sel.value;
      }
      localStorage.setItem(key, JSON.stringify(map));
      location.reload();
    });
    box.appendChild(sel);
    const hint = document.createElement("p");
    hint.className = "pattern-admin-hint";
    hint.innerHTML =
      "Overrides live in localStorage (<code>" +
      CrocheterPatterns.OVERRIDE_STORAGE_KEY +
      "</code>). Set <code>difficultyOverride</code> in <code>patterns-data.js</code> for shipped defaults.";
    box.appendChild(hint);
    panel.appendChild(box);

    patternMeta.insertAdjacentElement("afterend", panel);
  }

  function activeChecks() {
    return data.checksByPattern[patternId];
  }

  function currentIndex() {
    const checks = activeChecks();
    const i = checks.findIndex((c) => !c);
    return i === -1 ? checks.length - 1 : i;
  }

  function renderSkills() {
    skillsEl.innerHTML = "";
    data.skills.forEach((s) => {
      const li = document.createElement("li");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = s.ok;
      cb.addEventListener("change", () => {
        s.ok = cb.checked;
        save(data);
      });
      li.appendChild(cb);
      const span = document.createElement("span");
      span.textContent = s.label;
      li.appendChild(span);
      skillsEl.appendChild(li);
    });
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function renderSteps() {
    const cur = currentIndex();
    const focus = focusEl.checked;
    const checks = activeChecks();
    patternTitle.textContent = p.title;
    patternMeta.textContent = p.meta;
    patternPreview.src = p.preview;
    patternPreview.alt = p.title + " preview";
    document.body.classList.toggle("focus-mode", focus);
    stepsEl.innerHTML = "";
    p.steps.forEach((def, i) => {
      const li = document.createElement("li");
      if (focus && i === cur) li.classList.add("current");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = checks[i];
      cb.addEventListener("change", () => {
        checks[i] = cb.checked;
        save(data);
        renderSteps();
        if (checks.every(Boolean)) {
          showToast("Soft applause from the room—you finished without rush.");
        }
      });
      const body = document.createElement("div");
      body.className = "step-body";
      body.innerHTML = "<strong>Step " + (i + 1) + " · " + def.title + "</strong><br/>" + def.html;
      li.appendChild(cb);
      li.appendChild(body);
      stepsEl.appendChild(li);
    });
  }

  focusEl.addEventListener("change", renderSteps);
  document.getElementById("resetProg").addEventListener("click", () => {
    data.checksByPattern[patternId] = p.steps.map(() => false);
    save(data);
    renderSteps();
    showToast("Progress cleared. Take it one stitch at a time.");
  });

  save(data);
  renderSkills();
  renderSteps();
  renderDifficultyPanel();
})();
