(() => {
  const core = window.StitchCalculatorCore;
  const form = document.getElementById("calc-form");
  const urlInput = document.getElementById("pattern-url");
  const rowsInput = document.getElementById("pattern-rows");
  const questionInput = document.getElementById("pattern-question");
  const statusEl = document.getElementById("status");
  const outputEl = document.getElementById("output");
  const helpQueryInput = document.getElementById("help-query");
  const helpResultsEl = document.getElementById("help-results");
  const SITUATION_TERMS = [
    "joining", "join", "brim", "edges", "edge", "ends", "same piece", "two pieces",
    "through both layers", "both layers", "seam", "hat", "beanie", "rounds", "ribbing", "attach",
  ];
  const ABBR_ONLY = /^(sl\s*st|sc|dc|hdc|flo|blo)$/i;

  const HELP_DOCS = [
    {
      title: "Slip stitch on the same piece",
      type: "contextual help",
      url: "./context-help.html#slst-same-piece",
      tags: ["sl st", "slip stitch", "same piece", "same panel", "within piece"],
    },
    {
      title: "Slip stitch to join rounds",
      type: "contextual help",
      url: "./context-help.html#slst-join-rounds",
      tags: ["sl st", "slip stitch", "join rounds", "joining rounds", "round join"],
    },
    {
      title: "Joining two edges with slip stitch",
      type: "contextual help",
      url: "./context-help.html#slst-two-edges",
      tags: ["sl st", "slip stitch", "join edges", "two edges", "two ends", "joining two different ends"],
    },
    {
      title: "Slip stitch through both layers",
      type: "contextual help",
      url: "./context-help.html#slst-both-layers",
      tags: ["sl st", "slip stitch", "through both layers", "both loops", "two layers"],
    },
    {
      title: "Joining a beanie brim with slip stitches",
      type: "contextual help",
      url: "./context-help.html#beanie-brim-join",
      tags: ["waffle beanie brim slip stitch", "beanie brim", "join brim", "brim to body", "hat brim"],
    },
    {
      title: "Attaching ribbing to a hat body",
      type: "contextual help",
      url: "./context-help.html#attach-ribbing-hat-body",
      tags: ["attach ribbing", "hat body", "ribbing brim", "join brim with slip stitch"],
    },
    {
      title: "Slip stitch dictionary entry",
      type: "stitch dictionary",
      url: "./dictionary.html",
      tags: ["sl st", "slip stitch", "abbreviation", "definition"],
    },
    {
      title: "Single crochet (sc) and double crochet (dc) dictionary recap",
      type: "stitch dictionary",
      url: "./dictionary.html",
      tags: ["sc", "dc", "hdc", "abbreviation", "stitch count"],
    },
  ];

  function setStatus(message, type) {
    statusEl.textContent = message || "";
    statusEl.className = type ? `status ${type}` : "status";
  }

  function renderResult(result) {
    outputEl.innerHTML = "";
    const fields = [
      ["Likely row number", result.rowNumber ?? "Unknown"],
      ["Repeat position", result.repeatPosition ?? "Unknown"],
      ["Stitch count", result.stitchCount ?? "Unknown"],
      ["Confidence", result.confidenceLevel || "low"],
      ["Result", result.resultType || "unclear"],
      ["Short reason", result.reasoning || "No reasoning available"],
    ];
    fields.forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "result-row";
      row.innerHTML = `<strong>${label}:</strong> <span>${value}</span>`;
      outputEl.appendChild(row);
    });
    if (result.mismatchDetected) {
      const warning = document.createElement("div");
      warning.className = "result-row";
      warning.innerHTML = "<strong>Warning:</strong> <span>Calculated stitch math mismatches explicit stitch count.</span>";
      outputEl.appendChild(warning);
    }
  }

  function normalizeQuery(text) {
    return text
      .toLowerCase()
      .replace(/\bsl\s*st\b/g, "slip stitch")
      .replace(/\bsc\b/g, "single crochet")
      .replace(/\bdc\b/g, "double crochet")
      .replace(/\bhdc\b/g, "half double crochet")
      .replace(/\bblo\b/g, "back loop only")
      .replace(/\bflo\b/g, "front loop only");
  }

  function queryHasSituation(text) {
    return SITUATION_TERMS.some((term) => text.includes(term));
  }

  function scoreHelpDoc(doc, query) {
    if (!query) return -1;
    const normalized = normalizeQuery(query);
    const hasSituationCue = queryHasSituation(normalized);
    const abbreviationOnly = ABBR_ONLY.test(query.trim());
    let score = 0;
    for (const tag of doc.tags) {
      const tagLower = tag.toLowerCase();
      if (normalized.includes(tagLower)) score += 3;
      const words = tagLower.split(/\s+/);
      if (words.some((word) => normalized.includes(word))) score += 1;
    }
    if (abbreviationOnly && doc.type === "stitch dictionary") score += 6;
    if (abbreviationOnly && doc.type === "contextual help") score -= 2;
    if (hasSituationCue && doc.type === "contextual help") score += 8;
    if (hasSituationCue && doc.type === "stitch dictionary") score -= 1;
    if (!hasSituationCue && doc.type === "stitch dictionary") score += 1;
    return score;
  }

  function renderHelpResults(query) {
    helpResultsEl.innerHTML = "";
    const trimmed = query.trim();
    if (!trimmed) return;
    const ranked = HELP_DOCS
      .map((doc) => ({ doc, score: scoreHelpDoc(doc, trimmed) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
    if (!ranked.length) {
      helpResultsEl.innerHTML = "<div class='help-item'>No close help match yet. Try a shorter phrase like \"sl st join brim\".</div>";
      return;
    }
    ranked.forEach(({ doc }) => {
      const item = document.createElement("div");
      item.className = "help-item";
      item.innerHTML = `<a href="${doc.url}">${doc.title}</a><span class="help-type">${doc.type}</span>`;
      helpResultsEl.appendChild(item);
    });
  }

  async function isAllowedByRobots(url) {
    try {
      const target = new URL(url);
      const robotsUrl = `${target.origin}/robots.txt`;
      const res = await fetch(robotsUrl, { cache: "no-store" });
      if (!res.ok) return true;
      const text = await res.text();
      const lines = text.split(/\r?\n/).map((line) => line.trim());
      let applies = false;
      const disallows = [];
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.startsWith("user-agent:")) {
          applies = lower.includes("*");
        } else if (applies && lower.startsWith("disallow:")) {
          const rule = line.split(":")[1] ? line.split(":")[1].trim() : "";
          disallows.push(rule);
        }
      }
      return !disallows.some((rule) => rule === "/" || (rule && target.pathname.startsWith(rule)));
    } catch {
      return false;
    }
  }

  async function fetchPatternText(url) {
    const allowed = await isAllowedByRobots(url);
    if (!allowed) {
      throw new Error("This pattern URL appears disallowed by robots.txt. Paste only relevant rows manually.");
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Pattern URL could not be accessed. Paste only relevant rows/repeats manually.");
    }
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Calculating...", "");
    outputEl.innerHTML = "";

    const url = urlInput.value.trim();
    const rows = rowsInput.value.trim();
    const question = questionInput.value.trim();

    if (!question) {
      setStatus("Please enter a row-position question.", "error");
      return;
    }
    if (!url && !rows) {
      setStatus("Add either a URL or the relevant rows/repeat section.", "error");
      return;
    }

    let sourceText = rows;
    if (!sourceText && url) {
      try {
        sourceText = await fetchPatternText(url);
      } catch (error) {
        setStatus(`${error.message} If unavailable, paste only relevant rows/repeat text manually.`, "error");
        return;
      }
    }

    const result = core.analyzePattern({
      patternText: sourceText,
      question,
    });

    renderResult(result);
    if (result.uncertainty) {
      setStatus("Uncertain result. Paste only the exact rows/repeat section around your question.", "warn");
    } else if (result.mismatchDetected) {
      setStatus("Potential mismatch detected between parsed math and explicit stitch count.", "warn");
    } else {
      setStatus("Calculation complete.", "ok");
    }
  });

  helpQueryInput.addEventListener("input", () => {
    renderHelpResults(helpQueryInput.value);
  });
})();
