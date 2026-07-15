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
assert(hint.tier !== "flag_review", "light YA romance must not auto-reject as flag_review");
assert(hint.tier === "teen_caution", "YA audience alone → teen_caution, not romance hard-reject");

const adultRomanceBlob =
  "Adult fiction Romance erotic romance mature-rated college romance central to the plot";
const adultDoc = {
  title: "Made-Up Spice Novel",
  author_name: ["Example Author"],
  subjects: ["Romance", "Adult fiction"],
};
const adultHint = Policy.inferCatalogFamilyHint(adultDoc, { supplementText: adultRomanceBlob });
assert(adultHint.tier === "flag_review", "adult/mature romance still auto-rejects");
assert(/adult or mature-rated romance/i.test(String(adultHint.detail || "")), "adult romance detail names level/type");

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

const firebornStyleScan = {
  ok: true,
  themes: [
    {
      id: "lgbtq",
      present: true,
      confidence: "medium",
      brief:
        "Antagonist male wizard becomes a woman through a disastrous attempt to steal magic; villain stays evil with no affirming identity arc.",
    },
    {
      id: "forced_gender_magic",
      present: true,
      confidence: "high",
      brief:
        "Forced magic gender-change on the antagonist via stolen magic—not affirming LGBTQ; may still feel uncomfortable for LGBTQ-avoiders.",
    },
  ],
};
const fbNorm = AI.normalizeAiThemeScan(JSON.parse(JSON.stringify(firebornStyleScan)));
assert(!AI.aiLgbtqThemePresent(fbNorm), "forced/magic gender-change alone must not hard-flag LGBTQ present");
const fbForced = (fbNorm.themes || []).find((t) => t && t.id === "forced_gender_magic");
assert(fbForced && fbForced.present, "forced_gender_magic caution theme stays present");
const fbSupp = AI.buildAiSupplementText(fbNorm);
assert(!/forced_gender_magic|Forced or magic gender-change/i.test(fbSupp || ""), "forced gender magic must not feed policy blob");
const fbSignals = AI.appendAiSignals([], fbNorm);
assert(
  fbSignals.some((s) => /forced or magic gender-change|forced_gender_magic/i.test(String(s))),
  "forced gender magic still appears as AI scan note"
);

loadGlobalScript("halalit-curated-shelf-warnings.js", g);
const Cur = g.HalalitCuratedShelfWarnings;
const firebornHand = Cur.userDiscretionParkedMatch("Fireborn", "Toby Forward");
assert(firebornHand && firebornHand.tier === "user_discretion", "Fireborn is user_discretion hand note");
assert(/forced|magic gender|gender-change|LGBTQ-avoiders/i.test(String(firebornHand.detail || "")), "Fireborn note covers soft LGBTQ-avoider caution");
assert(!/hardest auto-reject|won't recommend this book\./i.test(String(firebornHand.detail || "").split("\n")[0]), "Fireborn is not hardest reject framing");

if (failed) process.exit(1);
console.log("All client fixture checks passed.");
