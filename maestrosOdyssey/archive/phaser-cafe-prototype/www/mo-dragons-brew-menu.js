/**
 * Dragon's Brew — wall menu + fiction-day unlock schedule (#26).
 * Generic core: four drinks / five foods — one café lane (ES or AR) via MoCafeLanguage.
 * New lemmas: 1–2 per fiction day max.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "mo_dragons_brew_menu_v5";
  var SESSION_MARA_INTRO_DONE = "mo_mara_intro_done";
  var SESSION_MENU_READY = "mo_menu_ready_for_order";
  var SESSION_VISIT_PHASE = "mo_cafe_visit_phase";
  var SESSION_ORDER_TEXT = "mo_cafe_order_text";
  var SESSION_ORDER_TOTAL = "mo_cafe_order_total_pesos";

  function sessionOn(key) {
    try { return sessionStorage.getItem(key) === "1"; } catch (e) { return false; }
  }

  function setSessionOn(key, on) {
    try {
      if (on) sessionStorage.setItem(key, "1");
      else sessionStorage.removeItem(key);
    } catch (e) { /* private mode */ }
  }

  function entry(key, en, es, opts) {
    var item = {
      key: key,
      en: en,
      es: es || en,
      caffeinated: !!(opts && opts.caffeinated),
      addon: !!(opts && opts.addon),
      food: !!(opts && opts.food),
      tier: (opts && opts.tier) || 2
    };
    if (opts && opts.ar) item.ar = opts.ar;
    if (opts && opts.arRom) item.arRom = opts.arRom;
    if (opts && typeof opts.pricePesos === "number") item.pricePesos = opts.pricePesos;
    if (opts && opts.foodTag) item.foodTag = opts.foodTag;
    return item;
  }

  /** Canon hot drinks (4) — see MO-ROADMAP menu canon. */
  var CANON_DRINKS = [
    entry("coffee", "coffee", "café", { ar: "قهوة", arRom: "Qahwa", caffeinated: true, tier: 1, pricePesos: 35 }),
    entry("tea", "tea", "té", { ar: "شاي", arRom: "shay", caffeinated: true, tier: 1, pricePesos: 30 }),
    entry("hot_chocolate", "hot chocolate", "chocolate caliente", { ar: "شوكولاتة ساخنة", arRom: "shukulata sakhina", tier: 2, pricePesos: 48 }),
    entry("espresso", "espresso", "espresso", { ar: "قهوة مركزة", arRom: "Qahwa murakkaza", caffeinated: true, tier: 2, pricePesos: 40 })
  ];

  var DRINK_UNLOCK_BY_DAY = {
    1: ["coffee", "tea"],
    2: ["hot_chocolate"],
    7: ["espresso"]
  };

  /** Generic café food (5). */
  var CANON_FOOD = [
    entry("muffin", "muffin", "muffin", { ar: "كعكة", arRom: "ka'ka", food: true, tier: 2, pricePesos: 28 }),
    entry("toast", "toast", "tostada", { ar: "خبز محمص", arRom: "khubz muħammaš", food: true, tier: 2, pricePesos: 22, foodTag: "toast_bread" }),
    entry("croissant", "croissant", "croissant", { ar: "فطيرة", arRom: "faťīra", food: true, tier: 2, pricePesos: 32 }),
    entry("galleta", "cookie", "galleta", { ar: "بسكويت", arRom: "biskwit", food: true, tier: 2, pricePesos: 24 }),
    entry("bolillo", "bolillo roll", "bolillo", { ar: "رغيف", arRom: "raghif", food: true, tier: 2, pricePesos: 20 })
  ];

  var FOOD_UNLOCK_BY_DAY = {
    1: ["muffin"],
    3: ["toast"],
    4: ["galleta"],
    5: ["bolillo"],
    6: ["croissant"]
  };

  /** 1–2 new lemmas in the active café language per fiction day. */
  var NEW_WORD_BY_DAY = {
    1: ["coffee", "tea"],
    2: ["hot_chocolate"],
    3: ["toast"],
    4: ["galleta"],
    5: ["bolillo"],
    6: ["sugar"]
  };

  var STARTER_ADDONS = [
    entry("sugar", "sugar", "azúcar", { ar: "سكر", arRom: "sukkar", addon: true, tier: 1, pricePesos: 0 }),
    entry("creamer", "creamer", "creamer", { ar: "حليب", arRom: "ħaleeb", addon: true, tier: 2, pricePesos: 0 })
  ];

  var ADDON_UNLOCK_BY_DAY = {
    6: ["sugar"],
    7: ["creamer"]
  };

  /** Reserved for future minotaur mountain / post-train café — not served at Dragon's Brew. */
  var MOUNTAIN_MENU_POOL = [
    entry("latte", "latte", "latte", { ar: "لاتيه", caffeinated: true, tier: 2 }),
    entry("mocha", "mocha", "mocha", { ar: "موكا", caffeinated: true, tier: 2 }),
    entry("hazelnut", "hazelnut", "avellana", { ar: "بندق", addon: true, tier: 4 }),
    entry("americano", "americano", "americano", { caffeinated: true, tier: 2, pricePesos: 38 }),
    entry("decaf", "decaf coffee", "descafeinado", { tier: 2, pricePesos: 35 }),
    entry("herbal_tea", "herbal tea", "té de hierbas", { tier: 2, pricePesos: 32 }),
    entry("cafe_de_olla", "pot coffee", "café de olla", { caffeinated: true, tier: 2, pricePesos: 42 }),
    entry("bagel", "bagel", "bagel", { food: true, tier: 2, pricePesos: 36 }),
    entry("concha", "concha", "concha", { food: true, tier: 2, pricePesos: 26 }),
    entry("empanada", "empanada", "empanada", { food: true, tier: 2, pricePesos: 34 }),
    entry("churro", "churro", "churro", { food: true, tier: 2, pricePesos: 30 }),
    entry("toast_tortilla", "tortilla toast", "tostada", { food: true, tier: 2, pricePesos: 22, foodTag: "toast_tortilla" })
  ];

  var BY_KEY = {};
  CANON_DRINKS.concat(CANON_FOOD).concat(STARTER_ADDONS).forEach(function (item) {
    BY_KEY[item.key] = item;
  });

  var STREAK_TO_ROTATE = 3;

  function fictionDayIndex() {
    var days = window.MoGameDays;
    return days && typeof days.getDayIndex === "function" ? days.getDayIndex() : 1;
  }

  function cumulativeKeys(schedule, day) {
    var keys = [];
    for (var d = 1; d <= day; d++) {
      (schedule[d] || []).forEach(function (k) {
        if (keys.indexOf(k) < 0) keys.push(k);
      });
    }
    return keys;
  }

  function keysNewAtDay(schedule, day) {
    return (schedule[day] || []).slice();
  }

  function itemLemma(item) {
    var lang = window.MoCafeLanguage;
    if (lang && typeof lang.itemLemma === "function") return lang.itemLemma(item);
    return item.es || item.en;
  }

  function getUnlockedDrinkKeys(day) {
    day = day || fictionDayIndex();
    return cumulativeKeys(DRINK_UNLOCK_BY_DAY, Math.min(day, 7));
  }

  function getUnlockedFoodKeys(day) {
    day = day || fictionDayIndex();
    return cumulativeKeys(FOOD_UNLOCK_BY_DAY, Math.min(day, 7));
  }

  function getUnlockedAddonKeys(day) {
    day = day || fictionDayIndex();
    return cumulativeKeys(ADDON_UNLOCK_BY_DAY, Math.min(day, 7));
  }

  function getNewTodayKeys(day) {
    day = day || fictionDayIndex();
    var wordKeys = keysNewAtDay(NEW_WORD_BY_DAY, day);
    var drinks = [];
    var food = [];
    var addons = [];
    wordKeys.forEach(function (key) {
      var item = BY_KEY[key];
      if (!item) return;
      if (item.addon) addons.push(key);
      else if (item.food) food.push(key);
      else drinks.push(key);
    });
    return { drinks: drinks, food: food, addons: addons };
  }

  function defaultState() {
    return {
      orderStreak: 0,
      lastOrderDate: "",
      menuViewedDate: "",
      maraTalkDate: "",
      seenFoodKeys: []
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      var state = Object.assign(defaultState(), parsed);
      if (!Array.isArray(state.seenFoodKeys)) state.seenFoodKeys = [];
      return state;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* private mode */ }
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function yesterdayKey() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function priceLabel(amount) {
    var lang = window.MoCafeLanguage;
    if (lang && typeof lang.formatMoney === "function") {
      return lang.formatMoney(amount);
    }
    if (amount === 0) return "included";
    return amount + " pesos";
  }

  function menuLine(item) {
    var lang = window.MoCafeLanguage;
    var lane = lang && typeof lang.getLane === "function" ? lang.getLane() : "es";
    var line;
    if (lane === "ar" && item.ar) {
      line = (item.arRom || item.en) + " — " + item.ar + " — " + item.en;
    } else {
      line = itemLemma(item) + " — " + item.en;
    }
    if (typeof item.pricePesos === "number") {
      line += " — " + priceLabel(item.pricePesos);
    }
    return line;
  }

  function newTodayLine(item) {
    var lang = window.MoCafeLanguage;
    var lane = lang && typeof lang.getLane === "function" ? lang.getLane() : "es";
    if (lane === "ar" && item.ar) {
      return "(New today: " + (item.arRom || item.en) + " — " + item.ar + " — " + item.en + ")";
    }
    return "(New today: " + itemLemma(item) + " — " + item.en + ")";
  }

  function markFoodSeen(keys) {
    var state = loadState();
    var changed = false;
    (keys || []).forEach(function (k) {
      if (state.seenFoodKeys.indexOf(k) < 0) {
        state.seenFoodKeys.push(k);
        changed = true;
      }
    });
    if (changed) saveState(state);
  }

  function getVisibleItems(state) {
    state = state || loadState();
    var drinkKeys = getUnlockedDrinkKeys();
    var foodKeys = getUnlockedFoodKeys();
    var addonKeys = getUnlockedAddonKeys();
    return {
      drinks: drinkKeys.map(function (k) { return BY_KEY[k]; }).filter(Boolean),
      food: foodKeys.map(function (k) { return BY_KEY[k]; }).filter(Boolean),
      addons: addonKeys.map(function (k) { return BY_KEY[k]; }).filter(Boolean)
    };
  }

  function formatMenuText() {
    var day = fictionDayIndex();
    var visible = getVisibleItems();
    var lane = window.MoCafeLanguage && window.MoCafeLanguage.laneLabel
      ? window.MoCafeLanguage.laneLabel()
      : "Spanish";
    var lines = ["Hot drinks (" + lane + ")"];
    visible.drinks.forEach(function (item) {
      lines.push(menuLine(item));
    });
    if (visible.food.length) {
      lines.push("");
      lines.push("Food");
      visible.food.forEach(function (item) {
        lines.push(menuLine(item));
      });
    }
    if (visible.addons.length) {
      lines.push("");
      lines.push("Add-ons");
      visible.addons.forEach(function (item) {
        lines.push(menuLine(item));
      });
    }
    var newToday = getNewTodayKeys(day);
    var added = {};
    newToday.drinks.concat(newToday.food).concat(newToday.addons).forEach(function (key) {
      if (added[key]) return;
      var item = BY_KEY[key];
      if (!item) return;
      added[key] = true;
      lines.push("");
      lines.push(newTodayLine(item));
    });
    lines.push("");
    lines.push("(Brown sugar in the thermoses this week — see strike board.)");
    return lines.join("\n");
  }

  /** Legacy real-calendar streak — kept until vocab tracker (#25) replaces it. */
  function rotateMenu(state) {
    state = state || loadState();
    saveState(state);
    return false;
  }

  function markMenuViewed() {
    var state = loadState();
    state.menuViewedDate = todayKey();
    saveState(state);
    var visible = getVisibleItems(state);
    markFoodSeen(visible.food.map(function (item) { return item.key; }));
    if (hasMaraIntroDone()) setSessionOn(SESSION_MENU_READY, true);
    tryCompleteOrderDay(state);
  }

  function hasMenuViewed() {
    return !!loadState().menuViewedDate;
  }

  function markMaraIntroDone() {
    setSessionOn(SESSION_MARA_INTRO_DONE, true);
    setSessionOn(SESSION_MENU_READY, false);
  }

  function hasMaraIntroDone() {
    return sessionOn(SESSION_MARA_INTRO_DONE);
  }

  function markMaraMet() {
    markMaraIntroDone();
  }

  function hasMaraMet() {
    return hasMaraIntroDone();
  }

  function canTakeMaraOrder() {
    var days = window.MoGameDays;
    if (days && days.hasCompletedVisitToday && days.hasCompletedVisitToday()) return false;
    if (window.MoElderReport && window.MoElderReport.isActive && window.MoElderReport.isActive()) return false;
    if (window.MoMenuQuiz && window.MoMenuQuiz.isTooBrokeToOrder && window.MoMenuQuiz.isTooBrokeToOrder()) return false;
    if (window.MoVisitSetup && window.MoVisitSetup.needsSetup && window.MoVisitSetup.needsSetup()) return false;
    if (window.MoCafeLanguage && window.MoCafeLanguage.needsPick && window.MoCafeLanguage.needsPick()) return false;
    return hasMaraIntroDone() && sessionOn(SESSION_MENU_READY);
  }

  function markMaraTalk() {
    var state = loadState();
    state.maraTalkDate = todayKey();
    saveState(state);
    tryCompleteOrderDay(state);
  }

  function tryCompleteOrderDay(state) {
    state = state || loadState();
    var today = todayKey();
    if (state.menuViewedDate !== today || state.maraTalkDate !== today) return false;
    if (state.lastOrderDate === today) return false;

    if (state.lastOrderDate === yesterdayKey()) {
      state.orderStreak += 1;
    } else {
      state.orderStreak = 1;
    }
    state.lastOrderDate = today;

    if (state.orderStreak >= STREAK_TO_ROTATE) {
      rotateMenu(state);
    } else {
      saveState(state);
    }
    return true;
  }

  function recordOrderSuccess(success) {
    if (!success) {
      var state = loadState();
      state.orderStreak = 0;
      state.lastOrderDate = "";
      saveState(state);
      return;
    }
    tryCompleteOrderDay();
  }

  function getVisitPhase() {
    try { return sessionStorage.getItem(SESSION_VISIT_PHASE) || ""; } catch (e) { return ""; }
  }

  function setVisitPhase(phase) {
    try {
      if (phase) sessionStorage.setItem(SESSION_VISIT_PHASE, phase);
      else sessionStorage.removeItem(SESSION_VISIT_PHASE);
    } catch (e) { /* private mode */ }
  }

  function getOrderText() {
    try { return sessionStorage.getItem(SESSION_ORDER_TEXT) || ""; } catch (e) { return ""; }
  }

  function setOrderText(text) {
    try {
      if (text) sessionStorage.setItem(SESSION_ORDER_TEXT, text);
      else sessionStorage.removeItem(SESSION_ORDER_TEXT);
    } catch (e) { /* private mode */ }
  }

  function getOrderTotalPesos() {
    try {
      var raw = sessionStorage.getItem(SESSION_ORDER_TOTAL);
      if (raw === null || raw === "") return 0;
      var n = parseInt(raw, 10);
      return isFinite(n) && n >= 0 ? n : 0;
    } catch (e) { return 0; }
  }

  function setOrderTotalPesos(amount) {
    try {
      if (amount > 0) sessionStorage.setItem(SESSION_ORDER_TOTAL, String(Math.floor(amount)));
      else sessionStorage.removeItem(SESSION_ORDER_TOTAL);
    } catch (e) { /* private mode */ }
  }

  function itemPricePesos(item) {
    if (typeof item.pricePesos === "number") return item.pricePesos;
    if (item.tier === 1) return 35;
    if (item.tier === 3) return 45;
    return 40;
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

  function orderMatchesItem(orderRaw, item) {
    var order = orderRaw || "";
    var orderLower = order.toLowerCase();
    var orderNorm = normalizeRoman(order);
    var en = item.en.toLowerCase();
    var es = (item.es || item.en).toLowerCase();
    var ar = item.ar || "";
    var rom = normalizeRoman(item.arRom || "");
    var lemma = itemLemma(item);

    if (orderLower.indexOf(en) >= 0) return true;
    if (orderLower.indexOf(es) >= 0) return true;
    if (ar && order.indexOf(ar) >= 0) return true;
    if (lemma && order.indexOf(lemma) >= 0) return true;
    if (rom && orderNorm.indexOf(rom) >= 0) return true;
    if (rom) {
      var tokens = rom.split(" ").filter(function (tok) { return tok.length > 2; });
      if (tokens.length > 1 && tokens.every(function (tok) { return orderNorm.indexOf(tok) >= 0; })) return true;
    }
    return false;
  }

  function matchOrderItems(orderText) {
    var order = orderText || "";
    var visible = getVisibleItems();
    var items = visible.drinks.concat(visible.food).concat(visible.addons);
    items.sort(function (a, b) {
      var la = Math.max(a.en.length, (a.es || "").length, (a.ar || "").length, (a.arRom || "").length);
      var lb = Math.max(b.en.length, (b.es || "").length, (b.ar || "").length, (b.arRom || "").length);
      return lb - la;
    });

    var matched = {};
    var drinks = [];
    var food = [];
    var addons = [];
    items.forEach(function (item) {
      if (matched[item.key]) return;
      if (orderMatchesItem(order, item)) {
        matched[item.key] = true;
        if (item.food) food.push(item);
        else if (item.addon) addons.push(item);
        else drinks.push(item);
      }
    });

    if (!drinks.length && !food.length && !addons.length && order) {
      drinks.push(BY_KEY.coffee || visible.drinks[0]);
    }

    return { drinks: drinks, food: food, addons: addons };
  }

  function getOrderedItems(orderText) {
    return matchOrderItems(orderText != null ? orderText : getOrderText());
  }

  function orderHasDrink(orderText) {
    return getOrderedItems(orderText).drinks.length > 0;
  }

  function orderHasFood(orderText) {
    return getOrderedItems(orderText).food.length > 0;
  }

  function estimateOrderTotalPesos(orderText) {
    var order = (orderText || "").toLowerCase();
    if (!order) return 35;

    var matched = matchOrderItems(orderText);
    var total = 0;
    matched.drinks.concat(matched.food).concat(matched.addons).forEach(function (item) {
      total += itemPricePesos(item);
    });

    if (total > 0) return total;
    return 35;
  }

  var visitJustCompleted = false;

  function consumeVisitComplete() {
    var done = visitJustCompleted;
    visitJustCompleted = false;
    return done;
  }

  function isVisitInProgress() {
    var phase = getVisitPhase();
    return phase === "reply" || phase === "pay" || phase === "pickup" || phase === "dine";
  }

  function fictionWeekNumber() {
    var days = window.MoGameDays;
    return days && typeof days.getWeekNumber === "function" ? days.getWeekNumber() : 1;
  }

  /** Native café lemmas for Mara read-back — not the player's romanization or English. */
  function orderEchoLemmaList(orderText) {
    var matched = getOrderedItems(orderText);
    var lemmas = [];
    matched.drinks.concat(matched.food).concat(matched.addons).forEach(function (item) {
      var lemma = itemLemma(item);
      if (lemma && lemmas.indexOf(lemma) < 0) lemmas.push(lemma);
    });
    return lemmas;
  }

  function orderEchoPhrase(orderText) {
    var lemmas = orderEchoLemmaList(orderText);
    if (!lemmas.length) return "";
    if (lemmas.length === 1) return lemmas[0];

    var week = fictionWeekNumber();
    var lang = window.MoCafeLanguage;
    var lane = lang && typeof lang.getLane === "function" ? lang.getLane() : "es";

    if (week < 2) {
      if (lane === "ar") return lemmas.join("\u060C ");
      return lemmas.join(", ");
    }
    if (lane === "ar") return lemmas.join(" \u0648");
    return lemmas.join(" y ");
  }

  function visitReplyText() {
    var order = getOrderText();
    if (order) {
      var echo = orderEchoPhrase(order);
      if (echo) {
        return 'Mara repeats it back, calm and clear: "' + echo + '."\n\n"Perfect — I\'ll get that started."';
      }
    }
    return 'Mara nods. "Got it — I\'ll get that started."';
  }

  function visitPayText() {
    var total = getOrderTotalPesos();
    var card = window.MoLearningCard;
    var balance = card && typeof card.getBalance === "function" ? card.getBalance() : 0;
    var totalLabel = priceLabel(total);
    var balanceLabel = card && typeof card.formatMoney === "function"
      ? card.formatMoney(balance)
      : balance + " pesos";

    if (balance < total) {
      return (
        'Mara checks the register. "' + totalLabel + ' for this order."\n\n' +
        '"Your learning card only has ' + balanceLabel + ' — I can\'t start it until you have enough on the card."'
      );
    }

    return (
      'She taps the register. "' + totalLabel + ' total."\n\n' +
      '"Tap your learning card on the reader when you\'re ready. I\'ll take it from your balance — nothing more than what\'s on the card."'
    );
  }

  function visitCantAffordText() {
    var total = getOrderTotalPesos();
    var card = window.MoLearningCard;
    var balance = card && typeof card.getBalance === "function" ? card.getBalance() : 0;
    var needLabel = card && typeof card.formatMoney === "function"
      ? card.formatMoney(total)
      : total + " pesos";
    return (
      'The reader blinks red — not enough on the learning card for ' + priceLabel(total) + '.\n\n' +
      '"Come back when you\'ve got at least ' + needLabel + ' loaded," Mara says gently. "No borrowing past zero."'
    );
  }

  function visitPickupText() {
    var hasFood = orderHasFood();
    var hasDrink = orderHasDrink();
    var parts = [];
    if (hasDrink) parts.push("your drink");
    if (hasFood) parts.push("your food");
    var bundle = parts.length === 2 ? parts.join(" and ") : (parts[0] || "your order");
    return (
      'Mara sets ' + bundle + ' on the counter — warm cup, plate if you ordered food.\n\n' +
      '"There on the counter when you\'re ready. Grab a table and enjoy — take your time."'
    );
  }

  function getVisitDialogue(phase) {
    if (phase === "reply") return visitReplyText();
    if (phase === "pay") return visitPayText();
    if (phase === "pickup") return visitPickupText();
    return "";
  }

  function beginVisitAfterOrder(orderText) {
    setOrderText(orderText);
    setOrderTotalPesos(estimateOrderTotalPesos(orderText));
    setVisitPhase("reply");
  }

  function advanceVisitPhase() {
    var phase = getVisitPhase();
    if (phase === "reply") {
      setVisitPhase("pay");
      return getVisitDialogue("pay");
    }
    if (phase === "pay") {
      var total = getOrderTotalPesos();
      var card = window.MoLearningCard;
      var paid = card && typeof card.tryPay === "function" && card.tryPay(total);
      if (!paid || !paid.ok) {
        abandonVisit();
        return visitCantAffordText();
      }
      setVisitPhase("pickup");
      return getVisitDialogue("pickup");
    }
    if (phase === "pickup") {
      setVisitPhase("dine");
      return null;
    }
    return null;
  }

  function completeVisit() {
    if (getVisitPhase() !== "dine") return;
    var days = window.MoGameDays;
    if (days && days.hasCompletedVisitForDay && days.hasCompletedVisitForDay(days.getDayIndex())) return;
    if (days && days.hasAwaitingDayAdvance && days.hasAwaitingDayAdvance()) return;
    var ordered = getOrderedItems();
    if (window.MoMenuQuiz && typeof window.MoMenuQuiz.recordOrder === "function") {
      window.MoMenuQuiz.recordOrder(ordered);
    }
    markFoodSeen(ordered.food.map(function (item) { return item.key; }));
    setVisitPhase("");
    setOrderText("");
    setOrderTotalPesos(0);
    setSessionOn(SESSION_MENU_READY, true);
    recordOrderSuccess(true);
    visitJustCompleted = true;
    if (days && typeof days.setVisitFinishedAwaitingExit === "function") {
      days.setVisitFinishedAwaitingExit();
    }
  }

  function abandonVisit() {
    setVisitPhase("");
    setOrderText("");
    setOrderTotalPesos(0);
  }

  function resetSessionState() {
    setSessionOn(SESSION_MARA_INTRO_DONE, false);
    setSessionOn(SESSION_MENU_READY, false);
    setVisitPhase("");
    setOrderText("");
    setOrderTotalPesos(0);
    visitJustCompleted = false;
  }

  function getItemByKey(key) {
    return BY_KEY[key] || null;
  }

  window.DragonsBrewMenu = {
    formatMenuText: formatMenuText,
    getVisibleItems: getVisibleItems,
    getItemByKey: getItemByKey,
    getOrderedItems: getOrderedItems,
    orderHasDrink: orderHasDrink,
    orderHasFood: orderHasFood,
    markMenuViewed: markMenuViewed,
    hasMenuViewed: hasMenuViewed,
    markMaraMet: markMaraMet,
    hasMaraMet: hasMaraMet,
    markMaraIntroDone: markMaraIntroDone,
    hasMaraIntroDone: hasMaraIntroDone,
    canTakeMaraOrder: canTakeMaraOrder,
    markMaraTalk: markMaraTalk,
    recordOrderSuccess: recordOrderSuccess,
    beginVisitAfterOrder: beginVisitAfterOrder,
    getVisitPhase: getVisitPhase,
    getVisitDialogue: getVisitDialogue,
    advanceVisitPhase: advanceVisitPhase,
    isVisitInProgress: isVisitInProgress,
    consumeVisitComplete: consumeVisitComplete,
    completeVisit: completeVisit,
    abandonVisit: abandonVisit,
    resetSessionState: resetSessionState,
    rotateMenu: rotateMenu,
    STREAK_TO_ROTATE: STREAK_TO_ROTATE,
    CANON_DRINKS: CANON_DRINKS,
    CANON_FOOD: CANON_FOOD,
    getUnlockedDrinkKeys: getUnlockedDrinkKeys,
    getUnlockedFoodKeys: getUnlockedFoodKeys,
    MOUNTAIN_MENU_POOL: MOUNTAIN_MENU_POOL
  };
})();
