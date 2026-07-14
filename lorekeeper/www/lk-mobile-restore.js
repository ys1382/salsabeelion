/**
 * LoreKeeper — mobile easy restore (#9): banner + version sheet with friendly times.
 */
(function (global) {
  var MOBILE_MQ = "(max-width: 720px)";
  var DISMISS_KEY = "lk-mobile-restore-dismiss";

  var banner = null;
  var sheet = null;
  var sheetList = null;
  var sheetBackdrop = null;
  var pendingRestorable = null;

  function isMobile() {
    try {
      return global.matchMedia(MOBILE_MQ).matches;
    } catch (e) {
      return (global.innerWidth || 0) <= 720;
    }
  }

  function docs() {
    return global.LoreKeeperDocuments;
  }

  function restoreApi() {
    return global.LoreKeeperDocRestore;
  }

  function dismissId(docId, snapAt) {
    return String(docId || "") + ":" + String(snapAt || 0);
  }

  function isDismissed(docId, snapAt) {
    try {
      var raw = global.sessionStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      var map = JSON.parse(raw);
      return !!(map && map[dismissId(docId, snapAt)]);
    } catch (e) {
      return false;
    }
  }

  function setDismissed(docId, snapAt) {
    try {
      var raw = global.sessionStorage.getItem(DISMISS_KEY);
      var map = raw ? JSON.parse(raw) : {};
      if (!map || typeof map !== "object") map = {};
      map[dismissId(docId, snapAt)] = true;
      global.sessionStorage.setItem(DISMISS_KEY, JSON.stringify(map));
    } catch (e) {
      /* ignore */
    }
  }

  function relativeWhen(ts) {
    if (!docs() || !docs().formatWhenRelative) return "earlier";
    return docs().formatWhenRelative(ts) || "earlier";
  }

  function ensureBanner() {
    if (banner) return banner;
    banner = document.createElement("div");
    banner.className = "lk-mobile-restore-banner";
    banner.hidden = true;
    banner.setAttribute("role", "status");

    var msg = document.createElement("p");
    msg.className = "lk-mobile-restore-msg";
    banner.appendChild(msg);

    var actions = document.createElement("div");
    actions.className = "lk-mobile-restore-actions";

    var restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "lk-btn lk-mobile-restore-go";
    restoreBtn.textContent = "Restore";
    restoreBtn.addEventListener("click", function () {
      if (!pendingRestorable || pendingRestorable.index == null) return;
      var when = relativeWhen(pendingRestorable.snap && pendingRestorable.snap.at);
      var api = restoreApi();
      if (api && api.restoreAtIndex && api.restoreAtIndex(pendingRestorable.index, when)) {
        closeSheet();
        sync();
      }
    });
    actions.appendChild(restoreBtn);

    var versionsBtn = document.createElement("button");
    versionsBtn.type = "button";
    versionsBtn.className = "lk-btn secondary lk-mobile-restore-versions";
    versionsBtn.textContent = "Versions";
    versionsBtn.addEventListener("click", openSheet);
    actions.appendChild(versionsBtn);

    var dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "lk-btn secondary lk-mobile-restore-dismiss";
    dismissBtn.setAttribute("aria-label", "Dismiss");
    dismissBtn.textContent = "×";
    dismissBtn.addEventListener("click", function () {
      if (pendingRestorable && pendingRestorable.snap) {
        var api = restoreApi();
        var docId = api && api.getDocId ? api.getDocId() : "";
        setDismissed(docId, pendingRestorable.snap.at);
      }
      hideBanner();
    });
    actions.appendChild(dismissBtn);

    banner.appendChild(actions);
    document.body.appendChild(banner);
    return banner;
  }

  function ensureSheet() {
    if (sheet) return sheet;
    sheetBackdrop = document.createElement("button");
    sheetBackdrop.type = "button";
    sheetBackdrop.className = "lk-mobile-restore-backdrop";
    sheetBackdrop.hidden = true;
    sheetBackdrop.setAttribute("aria-label", "Close versions");
    sheetBackdrop.addEventListener("click", closeSheet);

    sheet = document.createElement("div");
    sheet.className = "lk-mobile-restore-sheet";
    sheet.hidden = true;
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-label", "Version history");

    var head = document.createElement("div");
    head.className = "lk-mobile-restore-sheet-head";
    var title = document.createElement("h2");
    title.textContent = "Earlier versions";
    head.appendChild(title);
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "lk-btn secondary lk-mobile-restore-sheet-close";
    closeBtn.textContent = "Done";
    closeBtn.addEventListener("click", closeSheet);
    head.appendChild(closeBtn);
    sheet.appendChild(head);

    var hint = document.createElement("p");
    hint.className = "muted lk-mobile-restore-sheet-hint";
    hint.textContent = "Pick a save to put back on the page.";
    sheet.appendChild(hint);

    sheetList = document.createElement("ul");
    sheetList.className = "lk-mobile-restore-sheet-list";
    sheet.appendChild(sheetList);

    document.body.appendChild(sheetBackdrop);
    document.body.appendChild(sheet);
    return sheet;
  }

  function hideBanner() {
    if (banner) banner.hidden = true;
    document.body.classList.remove("lk-mobile-restore-visible");
    pendingRestorable = null;
  }

  function showBanner(restorable, docId) {
    if (!restorable || !restorable.snap) {
      hideBanner();
      return;
    }
    if (isDismissed(docId, restorable.snap.at)) {
      hideBanner();
      return;
    }
    pendingRestorable = restorable;
    var el = ensureBanner();
    var when = relativeWhen(restorable.snap.at);
    var msg = el.querySelector(".lk-mobile-restore-msg");
    if (msg) msg.textContent = "Earlier version from " + when + ".";
    el.hidden = false;
    document.body.classList.add("lk-mobile-restore-visible");
  }

  function openSheet() {
    var api = restoreApi();
    var docId = api && api.getDocId ? api.getDocId() : "";
    var currentHtml = api && api.getCurrentHtml ? api.getCurrentHtml() : "";
    if (!docId || !docs()) return;
    ensureSheet();
    sheetList.innerHTML = "";
    var snaps = docs().listSnapshots(docId) || [];
    if (!snaps.length) {
      var empty = document.createElement("li");
      empty.className = "muted";
      empty.textContent = "No saved versions yet.";
      sheetList.appendChild(empty);
    } else {
      var currentPlain = docs().bodyPlainText(currentHtml);
      snaps.forEach(function (snap, index) {
        if (!snap) return;
        var li = document.createElement("li");
        li.className = "lk-mobile-restore-sheet-item";
        var label = document.createElement("span");
        label.textContent = relativeWhen(snap.at);
        li.appendChild(label);
        var same = currentPlain && docs().bodyPlainText(snap.bodyHtml) === currentPlain;
        if (same) {
          var tag = document.createElement("span");
          tag.className = "lk-mobile-restore-current muted";
          tag.textContent = "Current";
          li.appendChild(tag);
        } else {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "lk-btn secondary";
          btn.textContent = "Restore";
          btn.addEventListener("click", function () {
            var when = relativeWhen(snap.at);
            if (api.restoreAtIndex && api.restoreAtIndex(index, when)) {
              closeSheet();
              sync();
            }
          });
          li.appendChild(btn);
        }
        sheetList.appendChild(li);
      });
    }
    sheet.hidden = false;
    sheetBackdrop.hidden = false;
    document.body.classList.add("lk-mobile-restore-sheet-open");
  }

  function closeSheet() {
    if (sheet) sheet.hidden = true;
    if (sheetBackdrop) sheetBackdrop.hidden = true;
    document.body.classList.remove("lk-mobile-restore-sheet-open");
  }

  function sync() {
    if (!isMobile() || !document.body.classList.contains("lk-page-doc")) {
      hideBanner();
      closeSheet();
      return;
    }
    var api = restoreApi();
    if (!api || !api.getDocId || !api.getCurrentHtml || !docs()) {
      hideBanner();
      return;
    }
    var docId = api.getDocId();
    if (!docId) {
      hideBanner();
      return;
    }
    var restorable = docs().restorableSnapshot(docId, api.getCurrentHtml());
    if (!restorable || !restorable.snap) {
      hideBanner();
      return;
    }
    showBanner(restorable, docId);
  }

  global.LoreKeeperMobileRestore = {
    sync: sync,
    closeSheet: closeSheet,
  };
})(typeof window !== "undefined" ? window : this);
