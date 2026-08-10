/**
 * LoreKeeper — remember last home focus (Ask / Word help / document) in this browser.
 */
(function (global) {
  var KEY = "lk-last-focus-v1";
  var PLACES = { ask: true, "word-help": true, doc: true };

  function get() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !PLACES[parsed.place]) return null;
      return {
        place: parsed.place,
        docId: parsed.docId ? String(parsed.docId) : "",
        at: parsed.at || 0,
      };
    } catch (e) {
      return null;
    }
  }

  function set(place, docId) {
    if (!PLACES[place]) return;
    try {
      var payload = { place: place, at: Date.now() };
      if (place === "doc" && docId) payload.docId = String(docId);
      global.localStorage.setItem(KEY, JSON.stringify(payload));
    } catch (e) {
      /* ignore */
    }
  }

  function setAsk() {
    set("ask");
  }

  function setWordHelp() {
    set("word-help");
  }

  function setDoc(docId) {
    if (!docId) return;
    set("doc", docId);
  }

  function scrollPanelToBottom(panelId) {
    var panel = document.getElementById(panelId);
    if (!panel || typeof panel.scrollIntoView !== "function") return;
    global.requestAnimationFrame(function () {
      panel.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  }

  global.LoreKeeperLastFocus = {
    get: get,
    set: set,
    setAsk: setAsk,
    setWordHelp: setWordHelp,
    setDoc: setDoc,
    scrollPanelToBottom: scrollPanelToBottom,
  };
})(typeof window !== "undefined" ? window : this);
