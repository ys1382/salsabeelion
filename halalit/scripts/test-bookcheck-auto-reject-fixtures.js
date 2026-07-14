#!/usr/bin/env node
/**
 * Client-side Bookcheck feedback-loop checks (buildAiSupplementText + policy hint).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const www = path.join(__dirname, "..", "www");

function loadGlobalScript(file, globalObj) {
  const code = fs.readFileSync(path.join(www, file), "utf8");
  vm.runInNewContext(code, globalObj, { filename: file });
}

const g = { window: {}, HalalitShelfThemes: null, HalalitFamilyShelfPolicy: null };
g.window = g;
loadGlobalScript("halalit-shelf-themes.js", g);
loadGlobalScript("halalit-family-shelf-policy.js", g);
loadGlobalScript("halalit-bookcheck-ai.js", g);

const AI = g.HalalitBookcheckAi;
const Policy = g.HalalitFamilyShelfPolicy;

const darkestStarsScan = {
  ok: true,
  themes: [
    {
      id: "lgbtq",
      present: false,
      confidence: "high",
      brief:
        "no confirmed on-page LGBTQ characters or relationships found in reviews or summaries; any perceived subtext is reader projection only.",
    },
    {
      id: "romantic_tension",
      present: true,
      confidence: "high",
      brief:
        "the romance is a YA-level clean romantic subplot between two teenage protagonists, not a mature-rated or explicit relationship.",
    },
    {
      id: "teen_ya_age",
      present: true,
      confidence: "high",
      brief: "the book is published as a Young Adult fantasy novel with a teenage protagonist.",
    },
  ],
};

const normalized = AI.normalizeAiThemeScan(JSON.parse(JSON.stringify(darkestStarsScan)));
const supplement = AI.buildAiSupplementText(normalized);
const doc = {
  title: "Even the Darkest Stars",
  author_name: ["Heather Fawcett"],
  subjects: ["Young adult fiction", "Fantasy fiction", "Romance"],
};
const blob =
  "Young adult fiction Fantasy fiction Romance love triangle climbing expedition " + supplement;
const hint = Policy.inferCatalogFamilyHint(doc, { supplementText: blob });

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

assert(!supplement || !/romantic subplot|love triangle/i.test(supplement), "AI supplement must not re-feed clean romance text");
assert(hint.tier === "flag_review", "catalog/wikipedia romance still flags flag_review");
assert(
  /romantic tension|teen\/ya tags plus romance/i.test(String(hint.detail || "")),
  "honest policy detail for YA romance"
);

const absolutelyScan = {
  ok: true,
  themes: [
    {
      id: "lgbtq",
      present: true,
      confidence: "high",
      brief: "Memoir centers on the author's experience as a gay teenager.",
    },
    { id: "teen_ya_age", present: true, confidence: "high", brief: "Young adult graphic memoir." },
  ],
};
const absNorm = AI.normalizeAiThemeScan(JSON.parse(JSON.stringify(absolutelyScan)));
assert(AI.aiLgbtqThemePresent(absNorm), "affirmative LGBTQ scan stays present");

if (failed) process.exit(1);
console.log("All client fixture checks passed.");
