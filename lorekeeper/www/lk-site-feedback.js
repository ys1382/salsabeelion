/**
 * LoreKeeper — private writer → owner messages (Halalit-style box, LK colors).
 */
(function (global) {
  function setStatus(el, msg, ok) {
    if (!el) return;
    el.textContent = msg || "";
    el.hidden = !msg;
    el.classList.toggle("is-ok", !!ok);
  }

  function init(opts) {
    opts = opts || {};
    var sendBtn = global.document.getElementById(opts.sendBtnId);
    var textEl = global.document.getElementById(opts.textId);
    var statusEl = global.document.getElementById(opts.statusId);
    if (!sendBtn || !textEl || sendBtn.dataset.lkBound === "1") return;
    sendBtn.dataset.lkBound = "1";

    sendBtn.addEventListener("click", function () {
      var msg = String(textEl.value || "").trim();
      if (!msg) {
        setStatus(statusEl, "Write a short note first.");
        return;
      }
      var Store = global.LoreKeeperAccountStorage;
      var Auth = global.LoreKeeperAuth;
      if (!Store || !Auth) {
        setStatus(statusEl, "Could not send right now. Try again.");
        return;
      }
      if (!Store.isSignedIn()) {
        Store.ensureSignedIn();
        setStatus(statusEl, "Sign in first to send feedback.");
        return;
      }
      setStatus(statusEl, "Sending…");
      var meta = typeof opts.metaFn === "function" ? opts.metaFn() || {} : opts.meta || {};
      Auth.submitFeedback(opts.source || "site", msg, meta).then(function (res) {
        if (res && res.ok) {
          textEl.value = "";
          setStatus(statusEl, "Sent privately to the owner. Thank you.", true);
        } else {
          setStatus(
            statusEl,
            res && res.error === "not_signed_in"
              ? "Sign in first to send feedback."
              : "Could not send right now. Try again."
          );
        }
      });
    });
  }

  global.LoreKeeperSiteFeedback = { init: init };
})(typeof window !== "undefined" ? window : this);
