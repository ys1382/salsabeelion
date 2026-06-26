/**
 * Mara menu quiz — when balance is positive but below cheapest visible item.
 * Memorize café-lane words not yet ordered; practice adds pesos to learning card.
 */
(function () {
  "use strict";

  var ORDERED_KEY = "mo_cafe_ordered_item_keys";
  var MEMORIZED_KEY = "mo_cafe_memorized_item_keys";
  var FAMILIARITY_KEY = "mo_cafe_item_familiarity";
  var QUIZ_EARNED_DAY_KEY = "mo_cafe_quiz_earned_day";
  var QUIZ_EARNED_AMOUNT_KEY = "mo_cafe_quiz_earned_amount";

  var REWARD_PESOS = 12;
  var MAX_EARN_PER_DAY = 36;
  var FAMILIARITY_TO_MEMORIZE = 3;

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* private mode */ }
  }

  function fictionDay() {
    var days = window.MoGameDays;
    return days && typeof days.getDayIndex === "function" ? days.getDayIndex() : 1;
  }

  function getOrderedKeys() {
    var list = readJson(ORDERED_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function getMemorizedKeys() {
    var list = readJson(MEMORIZED_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function getFamiliarityMap() {
    var map = readJson(FAMILIARITY_KEY, {});
    return map && typeof map === "object" ? map : {};
  }

  function getQuizEarnedToday() {
    var day = fictionDay();
    var storedDay = parseInt(localStorage.getItem(QUIZ_EARNED_DAY_KEY) || "0", 10);
    if (storedDay !== day) return 0;
    var n = parseInt(localStorage.getItem(QUIZ_EARNED_AMOUNT_KEY) || "0", 10);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function addQuizEarnings(amount) {
    var day = fictionDay();
    var earned = getQuizEarnedToday();
    var room = Math.max(0, MAX_EARN_PER_DAY - earned);
    var grant = Math.min(room, Math.max(0, Math.floor(amount)));
    if (grant <= 0) return 0;
    try {
      localStorage.setItem(QUIZ_EARNED_DAY_KEY, String(day));
      localStorage.setItem(QUIZ_EARNED_AMOUNT_KEY, String(earned + grant));
    } catch (e) { /* private mode */ }
    if (window.MoLearningCard && typeof window.MoLearningCard.addBalance === "function") {
      window.MoLearningCard.addBalance(grant);
    }
    return grant;
  }

  function itemPrice(item) {
    if (typeof item.pricePesos === "number") return item.pricePesos;
    return 30;
  }

  function getCheapestVisiblePrice() {
    var menu = window.DragonsBrewMenu;
    if (!menu || typeof menu.getVisibleItems !== "function") return 30;
    var visible = menu.getVisibleItems();
    var min = Infinity;
    (visible.drinks || []).concat(visible.food || []).forEach(function (item) {
      var p = itemPrice(item);
      if (p > 0 && p < min) min = p;
    });
    return min === Infinity ? 30 : min;
  }

  function isTooBrokeToOrder() {
    var card = window.MoLearningCard;
    if (!card || typeof card.getBalance !== "function") return false;
    var bal = card.getBalance();
    if (bal <= 0) return false;
    return bal < getCheapestVisiblePrice();
  }

  function getQuizPool() {
    var menu = window.DragonsBrewMenu;
    if (!menu || typeof menu.getVisibleItems !== "function") return [];
    var ordered = getOrderedKeys();
    var visible = menu.getVisibleItems();
    var pool = [];
    (visible.drinks || []).concat(visible.food || []).forEach(function (item) {
      if (!item || !item.key) return;
      if (item.addon) return;
      if (ordered.indexOf(item.key) >= 0) return;
      pool.push(item);
    });
    return pool;
  }

  function pickQuizItem() {
    var pool = getQuizPool();
    if (!pool.length) return null;
    var familiarity = getFamiliarityMap();
    var memorized = getMemorizedKeys();
    var fresh = pool.filter(function (item) {
      return memorized.indexOf(item.key) < 0 && (familiarity[item.key] || 0) < FAMILIARITY_TO_MEMORIZE;
    });
    var pickFrom = fresh.length ? fresh : pool;
    return pickFrom[Math.floor(Math.random() * pickFrom.length)];
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s\u0600-\u06FFáéíóúüñ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeRoman(text) {
    var lang = window.MoCafeLanguage;
    if (lang && typeof lang.normalizeArabicRoman === "function") {
      return lang.normalizeArabicRoman(text);
    }
    return String(text || "")
      .toLowerCase()
      .replace(/[''`]/g, "")
      .replace(/[^\w\s\u0600-\u06FFáéíóúüñ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function itemLemma(item) {
    var lang = window.MoCafeLanguage;
    if (lang && typeof lang.itemLemma === "function") return lang.itemLemma(item);
    return item.es || item.en || "";
  }

  function itemTeachingHint(item) {
    var lang = window.MoCafeLanguage;
    if (lang && typeof lang.itemTeachingHint === "function") return lang.itemTeachingHint(item);
    return itemLemma(item);
  }

  function answerMatches(item, attempt) {
    var a = normalize(attempt);
    var aRom = normalizeRoman(attempt);
    if (!a && !aRom) return false;
    var lemma = normalize(itemLemma(item));
    var rom = normalizeRoman(item.arRom || "");
    var en = normalize(item.en || "");
    if (lemma && (a === lemma || lemma.indexOf(a) >= 0 || a.indexOf(lemma) >= 0)) return true;
    if (rom && (aRom === rom || rom.indexOf(aRom) >= 0 || aRom.indexOf(rom) >= 0)) return true;
    if (en && (a === en || en.indexOf(a) >= 0)) return false;
    if (lemma) {
      var tokens = lemma.split(" ");
      if (tokens.some(function (tok) { return tok.length > 1 && (a === tok || a.indexOf(tok) >= 0); })) return true;
    }
    if (rom) {
      var romTokens = rom.split(" ").filter(function (tok) { return tok.length > 2; });
      if (romTokens.length > 1 && romTokens.every(function (tok) { return aRom.indexOf(tok) >= 0; })) return true;
    }
    return false;
  }

  function recordOrder(ordered) {
    if (!ordered) return;
    var keys = getOrderedKeys();
    var added = false;
    (ordered.drinks || []).concat(ordered.food || []).forEach(function (item) {
      if (!item || !item.key) return;
      if (keys.indexOf(item.key) < 0) {
        keys.push(item.key);
        added = true;
      }
    });
    if (added) writeJson(ORDERED_KEY, keys);
  }

  function bumpFamiliarity(itemKey) {
    var map = getFamiliarityMap();
    map[itemKey] = (map[itemKey] || 0) + 1;
    writeJson(FAMILIARITY_KEY, map);
    if (map[itemKey] >= FAMILIARITY_TO_MEMORIZE) {
      var mem = getMemorizedKeys();
      if (mem.indexOf(itemKey) < 0) {
        mem.push(itemKey);
        writeJson(MEMORIZED_KEY, mem);
      }
    }
    return map[itemKey];
  }

  function shouldOfferQuiz() {
    if (!isTooBrokeToOrder()) return false;
    if (getQuizEarnedToday() >= MAX_EARN_PER_DAY && getQuizPool().length === 0) return false;
    return getQuizPool().length > 0;
  }

  function canEarnMoreToday() {
    return getQuizEarnedToday() < MAX_EARN_PER_DAY;
  }

  function promptFor(item) {
    var lang = window.MoCafeLanguage && window.MoCafeLanguage.orderLanguageName
      ? window.MoCafeLanguage.orderLanguageName()
      : "Spanish";
    return (
      "Mara leans on the counter. \"Your card's a little short — but we can practice what's on the board.\"\n\n" +
      "What do we call " + item.en + " in " + lang + "? (Check the wall if you need to.)"
    );
  }

  function evaluateAnswer(item, attempt) {
    if (!item) {
      return { ok: false, line: "Mara tilts her head. \"Let's try another one from the board.\"" };
    }
    var lemma = itemTeachingHint(item);
    if (!answerMatches(item, attempt)) {
      return {
        ok: false,
        line:
          "Mara points gently at the board. \"Not quite — look for " +
          item.en +
          " up there. The word is " +
          lemma +
          ". Come back when you're ready to try again.\""
      };
    }
    var fam = bumpFamiliarity(item.key);
    var grant = canEarnMoreToday() ? addQuizEarnings(REWARD_PESOS) : 0;
    var memorized = getMemorizedKeys().indexOf(item.key) >= 0;
    var line = "Mara smiles. \"That sounds lovely, dear.\"";
    if (grant > 0) {
      var grantLabel = window.MoLearningCard && typeof window.MoLearningCard.formatMoney === "function"
        ? window.MoLearningCard.formatMoney(grant)
        : grant + " pesos";
      line += " \"The learning program added " + grantLabel + " to your card for practice.\"";
    } else if (!canEarnMoreToday()) {
      line += " \"You've practiced plenty for today — the word will stick.\"";
    }
    if (memorized && fam >= FAMILIARITY_TO_MEMORIZE) {
      line += " \"I think " + lemma + " is yours now.\"";
    } else {
      line += " \"Say " + lemma + " once more on your way out and it'll feel natural.\"";
    }
    return { ok: true, line: line, grant: grant, memorized: memorized };
  }

  function resetProgress() {
    try {
      localStorage.removeItem(ORDERED_KEY);
      localStorage.removeItem(MEMORIZED_KEY);
      localStorage.removeItem(FAMILIARITY_KEY);
      localStorage.removeItem(QUIZ_EARNED_DAY_KEY);
      localStorage.removeItem(QUIZ_EARNED_AMOUNT_KEY);
    } catch (e) { /* private mode */ }
  }

  window.MoMenuQuiz = {
    getCheapestVisiblePrice: getCheapestVisiblePrice,
    isTooBrokeToOrder: isTooBrokeToOrder,
    shouldOfferQuiz: shouldOfferQuiz,
    pickQuizItem: pickQuizItem,
    promptFor: promptFor,
    evaluateAnswer: evaluateAnswer,
    recordOrder: recordOrder,
    resetProgress: resetProgress,
    REWARD_PESOS: REWARD_PESOS,
    MAX_EARN_PER_DAY: MAX_EARN_PER_DAY
  };
})();
