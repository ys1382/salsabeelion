/**
 * Wildlife fact book — collected callout facts + separate fact levels.
 * Mission / account levels stay on missions.html; this track only grows with learning.
 * Soft totals until curated packs exist (no hard app-wide fact ceiling yet).
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "bane_codex_facts_v1";
  var MAX_FACTS = 400;
  var SOFT_PER_SPECIES = 12;

  /** Fact levels — separate from mission L1/L2/L3. Kinds unlock with commitment. */
  var FACT_LEVELS = [
    {
      level: 1,
      name: "Curious notice",
      need: 0,
      kinds: ["notice"],
      blurb: "Everyday noticing — what you’d spot on a walk or in a bed.",
    },
    {
      level: 2,
      name: "Neighbor kindness",
      need: 8,
      kinds: ["notice", "help"],
      blurb: "Gentle help tips join the mix — small kindnesses for this species’ world.",
    },
    {
      level: 3,
      name: "Species wonder",
      need: 20,
      kinds: ["notice", "help", "wonder"],
      blurb: "Wonder facts open up — cooler species-own quirks alongside noticing.",
    },
    {
      level: 4,
      name: "Field learner",
      need: 40,
      kinds: ["notice", "help", "wonder"],
      blurb: "Soft stretch goal while the fact library is still growing.",
    },
  ];

  var KIND_LABELS = {
    notice: "Noticing",
    help: "Kindness",
    wonder: "Wonder",
  };

  function slugPart(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function speciesKey(record) {
    if (record && record.speciesKey) return String(record.speciesKey);
    if (record && record.key && /^(lat|com):/.test(record.key)) return record.key;
    var latin = slugPart(record && record.latinName);
    if (latin) return "lat:" + latin;
    var common = slugPart(record && (record.commonName || record.displayName));
    if (common) return "com:" + common;
    return "";
  }

  function normalizeFactText(fact) {
    return String(fact || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function factId(factText) {
    var t = normalizeFactText(factText);
    if (!t) return "";
    var h = 2166136261;
    var i;
    for (i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return "f:" + (h >>> 0).toString(16);
  }

  function guessKind(callout, index, total) {
    var raw = String((callout && callout.kind) || "").toLowerCase().trim();
    if (raw === "help" || raw === "kindness" || raw === "tip") return "help";
    if (raw === "wonder" || raw === "species") return "wonder";
    if (raw === "notice" || raw === "everyday" || raw === "noticing") return "notice";
    var fact = String((callout && callout.fact) || "").toLowerCase();
    var label = String((callout && callout.label) || "").toLowerCase();
    var blob = label + " " + fact;
    if (
      /\b(kindness|leave (it|them|a)|skip |bagging|don’t spray|dont spray|help tip|small help)\b/.test(
        blob
      )
    ) {
      return "help";
    }
    if (
      /\b(trick of its own|species.?own|wonder|on its own|in the tropics those)\b/.test(
        blob
      )
    ) {
      return "wonder";
    }
    if (total > 1 && index === total - 1) return "wonder";
    if (total >= 3 && index === Math.floor(total / 2)) return "help";
    return "notice";
  }

  function readAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.filter(function (e) {
        return e && e.id && e.fact;
      });
    } catch (e) {
      return [];
    }
  }

  function writeAll(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_FACTS)));
      return true;
    } catch (e) {
      var trimmed = list.slice(0, Math.min(list.length, MAX_FACTS));
      while (trimmed.length > 0) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
          return true;
        } catch (e2) {
          trimmed = trimmed.slice(0, Math.floor(trimmed.length * 0.75));
        }
      }
      return false;
    }
  }

  function sanitizeFact(raw) {
    if (!raw || typeof raw !== "object") return null;
    var fact = String(raw.fact || "").trim().slice(0, 480);
    if (!fact) return null;
    var id = String(raw.id || "").trim() || factId(fact);
    if (!id) return null;
    var kind = String(raw.kind || "notice").toLowerCase();
    if (kind !== "help" && kind !== "wonder") kind = "notice";
    var sk = String(raw.speciesKey || "").trim();
    if (!sk) sk = speciesKey(raw);
    try {
      var learnedAt = Number(raw.learnedAt) || Date.now();
    } catch (e) {
      learnedAt = Date.now();
    }
    return {
      id: id.slice(0, 48),
      fact: fact,
      label: String(raw.label || "").trim().slice(0, 60),
      kind: kind,
      speciesKey: sk.slice(0, 100),
      commonName: String(raw.commonName || "").trim().slice(0, 120),
      latinName: String(raw.latinName || "").trim().slice(0, 160),
      gardenFocus: !!raw.gardenFocus,
      learnedAt: learnedAt,
    };
  }

  function mergeLists(local, remote) {
    var byId = {};
    function take(src) {
      var entry = sanitizeFact(src);
      if (!entry) return;
      var prev = byId[entry.id];
      if (!prev) {
        byId[entry.id] = entry;
        return;
      }
      var newer =
        Number(entry.learnedAt) <= Number(prev.learnedAt) ? entry : prev;
      var older = newer === entry ? prev : entry;
      var merged = Object.assign({}, newer);
      if (!merged.label && older.label) merged.label = older.label;
      if (!merged.speciesKey && older.speciesKey) merged.speciesKey = older.speciesKey;
      if (!merged.commonName && older.commonName) merged.commonName = older.commonName;
      if (!merged.latinName && older.latinName) merged.latinName = older.latinName;
      merged.learnedAt = Math.min(
        Number(merged.learnedAt) || Date.now(),
        Number(older.learnedAt) || Date.now()
      );
      byId[entry.id] = merged;
    }
    (remote || []).forEach(take);
    (local || []).forEach(take);
    return Object.keys(byId)
      .map(function (k) {
        return byId[k];
      })
      .sort(function (a, b) {
        return (Number(b.learnedAt) || 0) - (Number(a.learnedAt) || 0);
      })
      .slice(0, MAX_FACTS);
  }

  function countFacts() {
    return readAll().length;
  }

  function factsForSpecies(key) {
    var sk = String(key || "");
    if (!sk) return [];
    return readAll().filter(function (f) {
      return f.speciesKey === sk;
    });
  }

  function kindCounts(list) {
    var out = { notice: 0, help: 0, wonder: 0 };
    (list || readAll()).forEach(function (f) {
      var k = f.kind || "notice";
      if (out[k] == null) out[k] = 0;
      out[k] += 1;
    });
    return out;
  }

  function factLevelInfo(totalOverride) {
    var total = totalOverride != null ? Number(totalOverride) : countFacts();
    var current = FACT_LEVELS[0];
    var next = null;
    var i;
    for (i = 0; i < FACT_LEVELS.length; i++) {
      if (total >= FACT_LEVELS[i].need) current = FACT_LEVELS[i];
      else {
        next = FACT_LEVELS[i];
        break;
      }
    }
    var toNext = next ? Math.max(0, next.need - total) : 0;
    var softTotal = next
      ? next.need
      : Math.max(current.need, total + 6, FACT_LEVELS[FACT_LEVELS.length - 1].need);
    return {
      level: current.level,
      name: current.name,
      blurb: current.blurb,
      kinds: current.kinds.slice(),
      total: total,
      softTotal: softTotal,
      softCapKnown: !next,
      next: next
        ? {
            level: next.level,
            name: next.name,
            need: next.need,
            toNext: toNext,
            blurb: next.blurb,
          }
        : null,
      kindCounts: kindCounts(),
    };
  }

  function allowedKinds() {
    return factLevelInfo().kinds;
  }

  function collectCallouts(record, callouts, opts) {
    opts = opts || {};
    if (!callouts || !callouts.length) return { added: 0, facts: [] };
    var sk = speciesKey(record);
    var list = readAll();
    var byId = {};
    list.forEach(function (f) {
      byId[f.id] = f;
    });
    var added = 0;
    var now = Date.now();
    var total = callouts.length;
    var collected = [];
    callouts.forEach(function (c, index) {
      var fact = String((c && c.fact) || "").trim();
      if (!fact) return;
      var id = factId(fact);
      if (!id || byId[id]) {
        if (byId[id]) collected.push(byId[id]);
        return;
      }
      var entry = sanitizeFact({
        id: id,
        fact: fact,
        label: (c && c.label) || "",
        kind: guessKind(c, index, total),
        speciesKey: sk,
        commonName: (record && (record.commonName || record.displayName)) || "",
        latinName: (record && record.latinName) || "",
        gardenFocus: !!opts.gardenFocus,
        learnedAt: now,
      });
      if (!entry) return;
      byId[id] = entry;
      list.unshift(entry);
      collected.push(entry);
      added += 1;
    });
    if (added) {
      writeAll(list.slice(0, MAX_FACTS));
      if (global.BaneCodexCollection && global.BaneCodexCollection.schedulePush) {
        global.BaneCodexCollection.schedulePush();
      }
    }
    return { added: added, facts: collected };
  }

  function progressLabel(info) {
    info = info || factLevelInfo();
    if (info.softCapKnown) {
      return info.total + " learned · more still coming";
    }
    return info.total + " / ~" + info.softTotal;
  }

  function nextLevelLabel(info) {
    info = info || factLevelInfo();
    if (!info.next) {
      return "Fact level " + info.level + " · " + info.name + " (soft stretch)";
    }
    return (
      info.next.toNext +
      " more to fact level " +
      info.next.level +
      " · " +
      info.next.name
    );
  }

  function speciesProgressLabel(key) {
    var n = factsForSpecies(key).length;
    return n + " / ~" + SOFT_PER_SPECIES;
  }

  global.BaneCodexFacts = {
    STORAGE_KEY: STORAGE_KEY,
    MAX_FACTS: MAX_FACTS,
    SOFT_PER_SPECIES: SOFT_PER_SPECIES,
    FACT_LEVELS: FACT_LEVELS,
    KIND_LABELS: KIND_LABELS,
    factId: factId,
    speciesKey: speciesKey,
    guessKind: guessKind,
    readAll: readAll,
    writeAll: writeAll,
    mergeLists: mergeLists,
    sanitizeFact: sanitizeFact,
    countFacts: countFacts,
    factsForSpecies: factsForSpecies,
    kindCounts: kindCounts,
    factLevelInfo: factLevelInfo,
    allowedKinds: allowedKinds,
    collectCallouts: collectCallouts,
    progressLabel: progressLabel,
    nextLevelLabel: nextLevelLabel,
    speciesProgressLabel: speciesProgressLabel,
  };
})(typeof window !== "undefined" ? window : this);
