/**
 * LoreKeeper — mobile desktop handoff nudge (#10): opt-in, dismissible.
 */
(function (global) {
  var MOBILE_MQ = "(max-width: 720px)";
  var ENABLE_KEY = "lk-mobile-handoff-enabled";
  var DISMISS_FOREVER_KEY = "lk-mobile-handoff-dismissed";
  var SESSION_SHOWN_KEY = "lk-mobile-handoff-shown";
  var PENDING_KEY = "lk-mobile-handoff-pending";
  var MIN_PLAIN_CHARS = 180;
  var SHOW_DELAY_MS = 1200;

  var toast = null;
  var showTimer = null;

  function isMobile() {
    try {
      return global.matchMedia(MOBILE_MQ).matches;
    } catch (e) {
      return (global.innerWidth || 0) <= 720;
    }
  }

  function storage() {
    try {
      return global.localStorage;
    } catch (e) {
      return null;
    }
  }

  function session() {
    try {
      return global.sessionStorage;
    } catch (e) {
      return null;
    }
  }

  function isSignedIn() {
    return global.LoreKeeperAccountStorage && global.LoreKeeperAccountStorage.isSignedIn();
  }

  function isEnabled() {
    var ls = storage();
    return !!(ls && ls.getItem(ENABLE_KEY) === "1");
  }

  function setEnabled(on) {
    var ls = storage();
    if (!ls) return;
    if (on) ls.setItem(ENABLE_KEY, "1");
    else ls.removeItem(ENABLE_KEY);
  }

  function isDismissedForever() {
    var ls = storage();
    return !!(ls && ls.getItem(DISMISS_FOREVER_KEY) === "1");
  }

  function dismissForever() {
    var ls = storage();
    if (!ls) return;
    ls.setItem(DISMISS_FOREVER_KEY, "1");
    setEnabled(false);
    hideToast();
  }

  function sessionShown() {
    var ss = session();
    return !!(ss && ss.getItem(SESSION_SHOWN_KEY) === "1");
  }

  function markSessionShown() {
    var ss = session();
    if (ss) ss.setItem(SESSION_SHOWN_KEY, "1");
    if (ss) ss.removeItem(PENDING_KEY);
  }

  function setPending() {
    var ss = session();
    if (ss) ss.setItem(PENDING_KEY, "1");
  }

  function hasPending() {
    var ss = session();
    return !!(ss && ss.getItem(PENDING_KEY) === "1");
  }

  function plainLen(html) {
    if (!global.LoreKeeperDocuments || !global.LoreKeeperDocuments.bodyPlainText) return 0;
    return (global.LoreKeeperDocuments.bodyPlainText(html) || "").length;
  }

  function shouldConsider() {
    if (!isMobile() || !isSignedIn() || !isEnabled() || isDismissedForever() || sessionShown()) {
      return false;
    }
    if (document.body.classList.contains("lk-bt-keyboard")) return false;
    return true;
  }

  function hideToast() {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    if (toast) toast.hidden = true;
    document.body.classList.remove("lk-handoff-toast-visible");
  }

  function ensureToast() {
    if (toast) return toast;
    toast = document.createElement("div");
    toast.className = "lk-comfort-toast lk-handoff-toast";
    toast.hidden = true;
    toast.setAttribute("role", "status");

    var msg = document.createElement("p");
    msg.className = "lk-handoff-toast-msg";
    msg.textContent =
      "Saved to your account. On a computer, open LoreKeeper and sign in with the same email to keep writing.";
    toast.appendChild(msg);

    var actions = document.createElement("div");
    actions.className = "lk-handoff-toast-actions";

    var okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "lk-btn secondary";
    okBtn.textContent = "Got it";
    okBtn.addEventListener("click", function () {
      markSessionShown();
      hideToast();
    });
    actions.appendChild(okBtn);

    var neverBtn = document.createElement("button");
    neverBtn.type = "button";
    neverBtn.className = "lk-btn secondary";
    neverBtn.textContent = "Don't show again";
    neverBtn.addEventListener("click", function () {
      dismissForever();
    });
    actions.appendChild(neverBtn);

    toast.appendChild(actions);
    document.body.appendChild(toast);
    return toast;
  }

  function showToastNow() {
    if (!shouldConsider()) return;
    markSessionShown();
    var el = ensureToast();
    el.hidden = false;
    document.body.classList.add("lk-handoff-toast-visible");
  }

  function scheduleShow() {
    if (!shouldConsider()) return;
    if (showTimer) clearTimeout(showTimer);
    showTimer = setTimeout(function () {
      showTimer = null;
      if (!shouldConsider()) return;
      if (document.body.classList.contains("lk-mobile-writing")) {
        setPending();
        return;
      }
      showToastNow();
    }, SHOW_DELAY_MS);
  }

  function afterDocSynced(currentHtml) {
    if (!shouldConsider()) return;
    if (plainLen(currentHtml) < MIN_PLAIN_CHARS) return;
    if (document.body.classList.contains("lk-mobile-writing")) {
      setPending();
      return;
    }
    scheduleShow();
  }

  function onWritingExit() {
    if (!hasPending() || !shouldConsider()) return;
    scheduleShow();
  }

  function initAccountSettings() {
    var box = document.getElementById("mobileHandoffEnabled");
    var status = document.getElementById("mobileHandoffStatus");
    var resetBtn = document.getElementById("mobileHandoffResetBtn");
    if (!box || box.__lkHandoffBound) return;
    box.__lkHandoffBound = true;

    box.checked = isEnabled() && !isDismissedForever();

    box.addEventListener("change", function () {
      if (box.checked && isDismissedForever()) {
        var ls = storage();
        if (ls) ls.removeItem(DISMISS_FOREVER_KEY);
      }
      setEnabled(!!box.checked);
      if (status) {
        status.textContent = box.checked ? "Desktop handoff reminders on for this device." : "Off on this device.";
        status.className = "lk-status ok";
      }
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        var ls = storage();
        if (ls) ls.removeItem(DISMISS_FOREVER_KEY);
        var ss = session();
        if (ss) {
          ss.removeItem(SESSION_SHOWN_KEY);
          ss.removeItem(PENDING_KEY);
        }
        if (box.checked) setEnabled(true);
        if (status) {
          status.textContent = "Reminders reset on this device.";
          status.className = "lk-status ok";
        }
      });
    }
  }

  global.LoreKeeperMobileHandoff = {
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    afterDocSynced: afterDocSynced,
    onWritingExit: onWritingExit,
    initAccountSettings: initAccountSettings,
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (document.getElementById("mobileHandoffEnabled")) initAccountSettings();
    });
  } else if (document.getElementById("mobileHandoffEnabled")) {
    initAccountSettings();
  }
})(typeof window !== "undefined" ? window : this);
