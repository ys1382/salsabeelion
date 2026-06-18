/**
 * Halalit — reader appearance for the Personal Library room (chosen on the home page).
 * Saved in this browser only. Play and the shelf do not prompt for this.
 */
(function (global) {
  var STORAGE_KEY = "halalitReaderLook";
  var MAX_FIELD = 280;

  function defaultLook() {
    return {
      outfit: "",
      hair: "",
      skinTone: "",
      updatedAt: null,
    };
  }

  function trimField(s) {
    return String(s || "")
      .trim()
      .slice(0, MAX_FIELD);
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultLook();
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return defaultLook();
      return {
        outfit: trimField(o.outfit),
        hair: trimField(o.hair),
        skinTone: trimField(o.skinTone),
        updatedAt: o.updatedAt || null,
      };
    } catch (e) {
      return defaultLook();
    }
  }

  function save(partial) {
    var cur = load();
    if (partial && typeof partial === "object") {
      if (partial.outfit != null) cur.outfit = trimField(partial.outfit);
      if (partial.hair != null) cur.hair = trimField(partial.hair);
      if (partial.skinTone != null) cur.skinTone = trimField(partial.skinTone);
    }
    cur.updatedAt = new Date().toISOString();
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(cur));
    } catch (e) {
      return false;
    }
    return true;
  }

  /** Plain summary for image prompts later (modesty rules always applied separately). */
  function descriptionForArt() {
    var o = load();
    var parts = [];
    if (o.skinTone) parts.push("skin tone: " + o.skinTone);
    if (o.hair) parts.push("hair: " + o.hair);
    if (o.outfit) parts.push("clothing: " + o.outfit);
    return parts.join("; ");
  }

  function hasAnyChoice() {
    var o = load();
    return !!(o.outfit || o.hair || o.skinTone);
  }

  /** Always appended when generating library art. */
  function modestyClauseForArt() {
    return (
      "Modest dress only: long sleeves and full-length layered clothing, no bare arms legs or torso, " +
      "only face head and hands may show skin, no revealing necklines, " +
      "if party or evening wear use rich colors and fabric detail but keep abaya-level coverage, " +
      "honor abaya hijab or head covering only when the reader asked for them"
    );
  }

  function bindHomePanel() {
    var outfitEl = global.document.getElementById("readerLookOutfit");
    var hairEl = global.document.getElementById("readerLookHair");
    var skinEl = global.document.getElementById("readerLookSkinTone");
    var saveBtn = global.document.getElementById("readerLookSave");
    var statusEl = global.document.getElementById("readerLookStatus");
    if (!outfitEl || !saveBtn) return;

    var cur = load();
    outfitEl.value = cur.outfit;
    if (hairEl) hairEl.value = cur.hair;
    if (skinEl) skinEl.value = cur.skinTone;

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg;
    }

    if (cur.updatedAt) {
      setStatus("Your saved reader is on this device. Change anything below and press Save again.");
    }

    saveBtn.addEventListener("click", function () {
      var ok = save({
        outfit: outfitEl.value,
        hair: hairEl ? hairEl.value : "",
        skinTone: skinEl ? skinEl.value : "",
      });
      if (!ok) {
        setStatus("Could not save — this browser may be blocking storage.");
        return;
      }
      setStatus("Saved on this device. Book Quest play will not ask about your look; your Personal Library will use it for the reader in the chair.");
      try {
        global.dispatchEvent(new CustomEvent("halalit-reader-look-saved"));
      } catch (e2) {}
    });
  }

  function init() {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", bindHomePanel);
    } else {
      bindHomePanel();
    }
  }

  init();

  global.HalalitReaderLook = {
    KEY: STORAGE_KEY,
    load: load,
    save: save,
    hasAnyChoice: hasAnyChoice,
    descriptionForArt: descriptionForArt,
    modestyClauseForArt: modestyClauseForArt,
  };
})(typeof window !== "undefined" ? window : this);
