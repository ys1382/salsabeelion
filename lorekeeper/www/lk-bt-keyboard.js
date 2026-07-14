/**
 * LoreKeeper — Bluetooth / hardware keyboard mode on mobile (#11).
 */
(function (global) {
  var active = false;
  var lastTouch = 0;
  var TOUCH_GRACE_MS = 450;
  var INSET_THRESHOLD = 72;

  function isMobile() {
    return global.LoreKeeperMobileComfort && global.LoreKeeperMobileComfort.isMobile
      ? global.LoreKeeperMobileComfort.isMobile()
      : (global.innerWidth || 0) <= 720;
  }

  function kbInsetPx() {
    var raw = global.getComputedStyle(document.documentElement).getPropertyValue("--lk-kb-inset");
    return parseInt(String(raw || "0"), 10) || 0;
  }

  function isModifierOnly(e) {
    return e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta";
  }

  function likelyHardwareKey(e) {
    if (!isMobile() || !e || isModifierOnly(e)) return false;
    if (global.Date.now() - lastTouch < TOUCH_GRACE_MS) return false;
    if (kbInsetPx() > INSET_THRESHOLD) return false;
    return true;
  }

  function setActive(on) {
    if (active === on) return;
    active = on;
    document.body.classList.toggle("lk-bt-keyboard", on);
    try {
      global.dispatchEvent(
        new CustomEvent("lorekeeper-bt-keyboard-changed", { detail: { active: on } })
      );
    } catch (err) {
      global.dispatchEvent(new Event("lorekeeper-bt-keyboard-changed"));
    }
    if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.updateHeights) {
      global.LoreKeeperMobileAccessory.updateHeights();
    }
  }

  function onKeyDown(e) {
    if (!likelyHardwareKey(e)) return;

    if (!active) setActive(true);

    if (e.key === "Escape") {
      if (global.LoreKeeperMobileJot && document.body.classList.contains("lk-mobile-sidebar-capture")) {
        global.LoreKeeperMobileJot.endSidebarCapture();
        e.preventDefault();
        return;
      }
      if (global.LoreKeeperMobileComfort && global.LoreKeeperMobileComfort.isWritingMode()) {
        global.LoreKeeperMobileComfort.exitWritingMode();
        e.preventDefault();
      }
      return;
    }

    if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      global.dispatchEvent(new CustomEvent("lorekeeper-keyboard-save"));
      return;
    }

    if (
      document.body.classList.contains("lk-page-doc") &&
      document.body.classList.contains("lk-mobile-read") &&
      global.LoreKeeperMobileComfort &&
      !global.LoreKeeperMobileComfort.isWritingMode()
    ) {
      var t = e.target;
      var inSidebar =
        t &&
        (t.id === "docNoteBody" ||
          (t.closest && (t.closest("#docQuickNotePanel") || t.closest("#docAskPanel"))));
      if (!inSidebar && e.key && e.key.length === 1 && global.LoreKeeperMobileComfort.beginEditing) {
        global.LoreKeeperMobileComfort.beginEditing();
      }
    }

    if (
      document.body.classList.contains("lk-page-home") &&
      document.body.classList.contains("lk-mobile-read")
    ) {
      var panel = document.getElementById("noteEditorPanel");
      if (
        panel &&
        !panel.hidden &&
        global.LoreKeeperMobileComfort &&
        global.LoreKeeperMobileComfort.beginEditing &&
        e.key &&
        e.key.length === 1
      ) {
        global.LoreKeeperMobileComfort.beginEditing();
      }
    }
  }

  function onPointerDown() {
    lastTouch = global.Date.now();
    if (active) setActive(false);
  }

  function onViewportResize() {
    if (active && kbInsetPx() > INSET_THRESHOLD) setActive(false);
  }

  function init() {
    if (global.__lkBtKeyboardInit) return;
    global.__lkBtKeyboardInit = true;
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    if (global.visualViewport) {
      global.visualViewport.addEventListener("resize", onViewportResize);
    }
  }

  global.LoreKeeperBtKeyboard = {
    isActive: function () {
      return active;
    },
    init: init,
  };

  init();
})(typeof window !== "undefined" ? window : this);
