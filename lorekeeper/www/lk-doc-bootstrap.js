/**
 * LoreKeeper doc editor — load heavy scripts after first paint.
 */
(function () {
  var scripts = [
    "./vendor/spell/typo.js",
    "./lk-spell-words.js?v=3",
    "./lk-spell.js?v=10",
    "./vendor/quill/1.3.7/dist/quill.min.js",
    "./lk-api-config.js?v=50",
    "./lk-account-storage.js?v=14",
    "./lk-auth-gate.js?v=3",
    "./lk-documents.js?v=53",
    "./lk-doc-collab.js?v=1",
    "./lk-entries.js?v=4",
    "./lk-work-membership.js?v=1",
    "./lk-font-loader.js?v=1",
    "./lk-font-catalog.js?v=56",
    "./lk-recall.js?v=10",
    "./lk-auth.js?v=3",
    "./lk-site-feedback.js?v=1",
    "./lk-ask-feedback.js?v=1",
    "./lk-tier-a-checklist.js?v=5",
    "./lk-doc-quick-note.js?v=55",
    "./lk-doc-ask.js?v=7",
    "./lk-doc-notes-list.js?v=1",
    "./lk-doc-update-nudge.js?v=1",
    "./lk-doc-longpress.js?v=4",
    "./lk-doc-typo-jump.js?v=1",
    "./lk-doc-lore-brief.js?v=1",
    "./lk-mobile-comfort.js?v=7",
    "./lk-writing-glossary.js?v=1",
    "./lk-mobile-accessory.js?v=3",
    "./lk-writing-complete.js?v=2",
    "./lk-mobile-jot.js?v=1",
    "./lk-bt-keyboard.js?v=1",
    "./lk-mobile-restore.js?v=1",
    "./lk-mobile-handoff.js?v=1",
    "./lk-doc-editor.js?v=79",
  ];

  function loadNext(index) {
    if (index >= scripts.length) return;
    var el = document.createElement("script");
    el.src = scripts[index];
    el.onload = function () {
      loadNext(index + 1);
    };
    el.onerror = function () {
      console.error("LoreKeeper: failed to load " + scripts[index]);
      loadNext(index + 1);
    };
    document.body.appendChild(el);
  }

  function start() {
    loadNext(0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
