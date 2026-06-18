/**
 * Dragon's Brew — wall menu + fiction-day unlock schedule (#26).
 * Eight commonplace drinks / ten foods — no lattes or syrup rotation here.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "mo_dragons_brew_menu_v3";
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
    if (opts && typeof opts.pricePesos === "number") item.pricePesos = opts.pricePesos;
    return item;
  }

  /** Canon hot drinks at Dragon's Brew (8 max) — see MO-ROADMAP menu canon. */
  var CANON_DRINKS = [
    entry("coffee", "coffee", "café", { caffeinated: true, tier: 1, pricePesos: 35 }),
    entry("tea", "tea", "té", { caffeinated: true, tier: 1, pricePesos: 30 }),
    entry("hot_chocolate", "hot chocolate", "chocolate caliente", { tier: 2, pricePesos: 48 }),
    entry("americano", "americano", "americano", { caffeinated: true, tier: 2, pricePesos: 38 }),
    entry("espresso", "espresso", "espresso", { caffeinated: true, tier: 2, pricePesos: 40 }),
    entry("decaf", "decaf coffee", "descafeinado", { tier: 2, pricePesos: 35 }),
    entry("herbal_tea", "herbal tea", "té de hierbas", { tier: 2, pricePesos: 32 }),
    entry("cafe_de_olla", "pot coffee", "café de olla", { caffeinated: true, tier: 2, pricePesos: 42 })
  ];

  /** +1 drink per fiction day through day 7 (all 8 visible). */
  var DRINK_UNLOCK_BY_DAY = {
    1: ["coffee", "tea", "hot_chocolate"],
    2: ["americano"],
    3: ["espresso"],
    4: ["decaf"],
    5: ["herbal_tea"],
    6: ["cafe_de_olla"]
  };

  /** All canon café food — staggered unlock by fiction day. */
  var CANON_FOOD = [
    entry("muffin", "muffin", "muffin", { food: true, tier: 2, pricePesos: 28 }),
    entry("toast", "toast", "tostada", { food: true, tier: 2, pricePesos: 22, foodTag: "toast_bread" }),
    entry("croissant", "croissant", "croissant", { food: true, tier: 2, pricePesos: 32 }),
    entry("bagel", "bagel", "bagel", { food: true, tier: 2, pricePesos: 36 }),
    entry("galleta", "cookie", "galleta", { food: true, tier: 2, pricePesos: 24 }),
    entry("concha", "concha", "concha", { food: true, tier: 2, pricePesos: 26 }),
    entry("bolillo", "bolillo roll", "bolillo", { food: true, tier: 2, pricePesos: 20 }),
    entry("empanada", "empanada", "empanada", { food: true, tier: 2, pricePesos: 34 }),
    entry("churro", "churro", "churro", { food: true, tier: 2, pricePesos: 30 }),
    entry("toast_tortilla", "tortilla toast", "tostada", { food: true, tier: 2, pricePesos: 22, foodTag: "toast_tortilla" })
  ];

  var FOOD_UNLOCK_BY_DAY = {
    1: ["muffin", "toast"],
    2: ["croissant"],
    3: ["bagel"],
    4: ["galleta"],
    5: ["concha"],
    6: ["bolillo"],
    7: ["empanada", "churro"]
  };

  /** Static add-ons only — syrup pool reserved for future mountain café. */
  var STARTER_ADDONS = [
    entry("sugar", "sugar", "azúcar", { addon: true, tier: 1, pricePesos: 0 }),
    entry("creamer", "creamer", "creamer", { addon: true, tier: 2, pricePesos: 0 })
  ];

  /** Reserved for future minotaur mountain menu — not served at Dragon's Brew. */
  var MOUNTAIN_MENU_POOL = [
    entry("latte", "latte", "latte", { caffeinated: true, tier: 2 }),
    entry("mocha", "mocha", "mocha", { caffeinated: true, tier: 2 }),
    entry("hazelnut", "hazelnut", "avellana", { addon: true, tier: 4 })
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

  function getUnlockedDrinkKeys(day) {
    day = day || fictionDayIndex();
    if (day >= 7) {
      return CANON_DRINKS.map(function (item) { return item.key; });
    }
    return cumulativeKeys(DRINK_UNLOCK_BY_DAY, day);
  }

  function getUnlockedFoodKeys(day, state) {
    day = day || fictionDayIndex();
    state = state || loadState();
    var keys = cumulativeKeys(FOOD_UNLOCK_BY_DAY, Math.min(day, 7));
    if (day >= 8 && state.seenFoodKeys.indexOf("toast") >= 0 && keys.indexOf("toast_tortilla") < 0) {
      keys.push("toast_tortilla");
    }
    return keys;
  }

  function getNewTodayKeys(day) {
    day = day || fictionDayIndex();
    var drinks = keysNewAtDay(DRINK_UNLOCK_BY_DAY, day);
    var food = keysNewAtDay(FOOD_UNLOCK_BY_DAY, day);
    if (day === 8) {
      var state = loadState();
      if (state.seenFoodKeys.indexOf("toast") >= 0) food.push("toast_tortilla");
    }
    return { drinks: drinks, food: food };
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

  function priceLabel(pesos) {
    if (pesos === 0) return "included";
    return pesos + " pesos";
  }

  function menuLine(item) {
    var line = item.es + " — " + item.en;
    if (typeof item.pricePesos === "number") {
      line += " — " + priceLabel(item.pricePesos);
    }
    return line;
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
    var day = fictionDayIndex();
    var drinkKeys = getUnlockedDrinkKeys(day);
    var foodKeys = getUnlockedFoodKeys(day, state);
    return {
      drinks: drinkKeys.map(function (k) { return BY_KEY[k]; }).filter(Boolean),
      food: foodKeys.map(function (k) { return BY_KEY[k]; }).filter(Boolean),
      addons: STARTER_ADDONS.slice()
    };
  }

  function formatMenuText() {
    var day = fictionDayIndex();
    var visible = getVisibleItems();
    var lines = ["Hot drinks"];
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
    newToday.drinks.concat(newToday.food).forEach(function (key) {
      if (added[key]) return;
      var item = BY_KEY[key];
      if (!item) return;
      added[key] = true;
      lines.push("");
      lines.push("(New today: " + item.es + " — " + item.en + ")");
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
    if (days && days.isDay8OrLater && days.isDay8OrLater()) return false;
    return hasMaraIntroDone() && sessionOn(SESSION_MENU_READY);
  }

  function markMaraTalk() {
    var state = loadState();
    state.maraTalkDate = todayKey();
    saveState(state);
    tryCompleteOrderDay(state);
  }

  /**
   * Placeholder until mic / writing check ships: menu read + Mara talk same day counts.
   * Replace with API success callback when Spanglish ordering is live.
   */
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

  /** For future API: pass true when player orders correctly in Spanish. */
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

  function matchOrderItems(orderText) {
    var order = (orderText || "").toLowerCase();
    var visible = getVisibleItems();
    var items = visible.drinks.concat(visible.food).concat(visible.addons);
    items.sort(function (a, b) {
      var la = Math.max(a.en.length, a.es.length);
      var lb = Math.max(b.en.length, b.es.length);
      return lb - la;
    });

    var matched = {};
    var drinks = [];
    var food = [];
    var addons = [];
    items.forEach(function (item) {
      if (matched[item.key]) return;
      var en = item.en.toLowerCase();
      var es = (item.es || item.en).toLowerCase();
      if (order.indexOf(en) >= 0 || order.indexOf(es) >= 0) {
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

  /** Best-effort total from typed order vs visible menu names (en / es). */
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

  function visitReplyText() {
    var order = getOrderText();
    if (order) {
      return 'Mara repeats it back, calm and clear: "' + order + '."\n\n"Perfect — I\'ll get that started."';
    }
    return 'Mara nods. "Got it — I\'ll get that started."';
  }

  function visitPayText() {
    var total = getOrderTotalPesos();
    var card = window.MoLearningCard;
    var balance = card && typeof card.getBalance === "function" ? card.getBalance() : 0;
    var totalLabel = priceLabel(total);

    if (balance < total) {
      return (
        'Mara checks the register. "' + totalLabel + ' for this order."\n\n' +
        '"Your learning card only has ' + balance + ' pesos — I can\'t start it until you have enough on the card."'
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
    return (
      'The reader blinks red — not enough on the learning card for ' + priceLabel(total) + '.\n\n' +
      '"Come back when you\'ve got at least ' + total + ' pesos loaded," Mara says gently. "No borrowing past zero."'
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

  /** After a non-empty order: start reply → pay → drink → done. */
  function beginVisitAfterOrder(orderText) {
    setOrderText(orderText);
    setOrderTotalPesos(estimateOrderTotalPesos(orderText));
    setVisitPhase("reply");
  }

  /** Close on a visit beat: advance phase; return next line or null to end visit. */
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
    var ordered = getOrderedItems();
    markFoodSeen(ordered.food.map(function (item) { return item.key; }));
    setVisitPhase("");
    setOrderText("");
    setOrderTotalPesos(0);
    setSessionOn(SESSION_MENU_READY, true);
    recordOrderSuccess(true);
    visitJustCompleted = true;
    if (window.MoGameDays && typeof window.MoGameDays.onVisitCompleted === "function") {
      window.MoGameDays.onVisitCompleted();
    }
  }

  function abandonVisit() {
    setVisitPhase("");
    setOrderText("");
    setOrderTotalPesos(0);
  }

  window.DragonsBrewMenu = {
    formatMenuText: formatMenuText,
    getVisibleItems: getVisibleItems,
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
    rotateMenu: rotateMenu,
    STREAK_TO_ROTATE: STREAK_TO_ROTATE,
    CANON_DRINKS: CANON_DRINKS,
    CANON_FOOD: CANON_FOOD,
    getUnlockedDrinkKeys: getUnlockedDrinkKeys,
    getUnlockedFoodKeys: getUnlockedFoodKeys,
    MOUNTAIN_MENU_POOL: MOUNTAIN_MENU_POOL
  };
})();
