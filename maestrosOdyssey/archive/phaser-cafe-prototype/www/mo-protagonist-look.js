/**
 * Protagonist appearance for this visit (pixel sprite variant).
 */
(function () {
  "use strict";

  var STORAGE_KEY = "mo_protagonist_look";
  var VALID = {
    man_short: true,
    woman_long: true,
    man_kufi: true,
    woman_jilbab: true
  };

  function getLook() {
    try {
      var look = localStorage.getItem(STORAGE_KEY);
      return VALID[look] ? look : "";
    } catch (e) {
      return "";
    }
  }

  function setLook(look) {
    if (!VALID[look]) return false;
    try {
      localStorage.setItem(STORAGE_KEY, look);
    } catch (e) {
      return false;
    }
    return true;
  }

  function clearLook() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* private mode */ }
  }

  function needsPick() {
    return !getLook();
  }

  function lookLabel(look) {
    look = look || getLook();
    if (look === "woman_long") return "Woman · long hair";
    if (look === "man_kufi") return "Man · kufi & thobe";
    if (look === "woman_jilbab") return "Woman · hijab & jilbab";
    if (look === "man_short") return "Man · short hair";
    return "";
  }

  window.MoProtagonistLook = {
    getLook: getLook,
    setLook: setLook,
    clearLook: clearLook,
    needsPick: needsPick,
    lookLabel: lookLabel,
    VALID: VALID
  };
})();
