/**
 * LoreKeeper — computer voice typing into notes and the document.
 * Phone is out of scope. Popup first, then browser mic permission.
 */
(function (global) {
  var CONSENT_KEY = "lk-voice-type-consent";
  var MOBILE_MQ = "(max-width: 720px)";

  var dialog = null;
  var recognition = null;
  var session = null;
  var wantListen = false;
  var pendingTarget = null;
  var activeButton = null;
  var statusEl = null;
  var mqBound = false;
  var fnBound = false;
  var lastFnAt = 0;
  var boundTargets = { homeNote: null, docNote: null, quill: null };
  var FN_DOUBLE_MS = 550;

  function isComputer() {
    try {
      return !global.matchMedia(MOBILE_MQ).matches;
    } catch (e) {
      return (global.innerWidth || 0) > 720;
    }
  }

  function speechCtor() {
    return global.SpeechRecognition || global.webkitSpeechRecognition || null;
  }

  function hasConsent() {
    try {
      return global.localStorage.getItem(CONSENT_KEY) === "yes";
    } catch (e) {
      return false;
    }
  }

  function saveConsent() {
    try {
      global.localStorage.setItem(CONSENT_KEY, "yes");
    } catch (e) {
      /* ignore */
    }
  }

  function needsSpaceBefore(before, incoming) {
    if (!incoming) return false;
    if (/^[\s.,!?;:)\]}'"]/.test(incoming)) return false;
    if (!before) return false;
    if (/\s$/.test(before)) return false;
    if (/[\(\["']$/.test(before)) return false;
    return true;
  }

  function liveFromEvent(event) {
    var parts = [];
    var i;
    for (i = 0; i < event.results.length; i++) {
      var t = event.results[i][0] && event.results[i][0].transcript;
      t = String(t || "")
        .replace(/\s+/g, " ")
        .trim();
      if (t) parts.push(t);
    }
    return parts.join(" ");
  }

  function charBefore(target, index) {
    if (index <= 0) return "";
    if (target.kind === "textarea") {
      return target.el.value.charAt(index - 1);
    }
    try {
      return target.quill.getText(index - 1, 1) || "";
    } catch (e) {
      return "";
    }
  }

  function replaceRange(target, index, len, text) {
    text = text || "";
    if (target.kind === "textarea") {
      var el = target.el;
      var v = el.value;
      el.value = v.slice(0, index) + text + v.slice(index + len);
      var caret = index + text.length;
      el.selectionStart = el.selectionEnd = caret;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    var quill = target.quill;
    if (len > 0) quill.deleteText(index, len, "user");
    if (text) quill.insertText(index, text, "user");
    quill.setSelection(index + text.length, 0, "silent");
  }

  function startAnchor(target) {
    if (target.kind === "textarea") {
      var el = target.el;
      var a = el.selectionStart;
      var b = el.selectionEnd;
      if (typeof a !== "number") a = el.value.length;
      if (typeof b !== "number") b = a;
      return { anchor: Math.min(a, b), liveLen: Math.abs(b - a) };
    }
    var quill = target.quill;
    var range = null;
    try {
      range = quill.getSelection(true);
    } catch (e) {
      range = null;
    }
    if (range) return { anchor: range.index, liveLen: range.length || 0 };
    var idx =
      typeof quill.__lkResumeIndex === "number"
        ? quill.__lkResumeIndex
        : Math.max(0, quill.getLength() - 1);
    return { anchor: idx, liveLen: 0 };
  }

  function applyLive(text) {
    if (!session) return;
    var insert = text || "";
    if (insert && needsSpaceBefore(charBefore(session.target, session.anchor), insert)) {
      insert = " " + insert;
    }
    replaceRange(session.target, session.anchor, session.liveLen, insert);
    session.liveLen = insert.length;
  }

  function setStatus(msg) {
    if (!statusEl) {
      statusEl = document.createElement("p");
      statusEl.className = "lk-voice-type-status muted";
      statusEl.setAttribute("role", "status");
      statusEl.hidden = true;
      document.body.appendChild(statusEl);
    }
    if (!msg) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = msg;
  }

  function setButtonListening(btn, on) {
    if (!btn) return;
    btn.classList.toggle("is-listening", !!on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.textContent = on ? "Stop" : "Voice type";
  }

  function stopListening() {
    wantListen = false;
    if (recognition) {
      try {
        recognition.onend = null;
        recognition.onerror = null;
        recognition.onresult = null;
        recognition.stop();
      } catch (e) {
        /* ignore */
      }
      recognition = null;
    }
    session = null;
    pendingTarget = null;
    if (activeButton) {
      setButtonListening(activeButton, false);
      activeButton = null;
    }
    setStatus("");
  }

  function requestBrowserMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.resolve();
    }
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (stream && stream.getTracks) {
        stream.getTracks().forEach(function (t) {
          try {
            t.stop();
          } catch (e) {
            /* ignore */
          }
        });
      }
    });
  }

  function beginRecognition(target) {
    var Ctor = speechCtor();
    if (!Ctor) {
      setStatus("Voice typing needs Chrome or Edge on this computer.");
      return;
    }
    stopListening();
    wantListen = true;
    activeButton = target.button;
    setButtonListening(activeButton, true);
    var pos = startAnchor(target);
    session = {
      target: target,
      anchor: pos.anchor,
      liveLen: pos.liveLen,
    };
    if (target.kind === "textarea") {
      try {
        target.el.focus();
      } catch (e) {
        /* ignore */
      }
    } else if (target.quill && target.quill.focus) {
      target.quill.focus();
    }

    function startRec() {
      if (!wantListen) return;
      var rec = new Ctor();
      recognition = rec;
      rec.lang = (navigator.language || "en-US").toString();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = function (event) {
        if (!wantListen || !session) return;
        applyLive(liveFromEvent(event));
      };
      rec.onerror = function (event) {
        var err = event && event.error;
        if (err === "no-speech" || err === "aborted") return;
        if (err === "not-allowed" || err === "service-not-allowed") {
          setStatus("Microphone was blocked. Allow it for this site, then try again.");
          stopListening();
          return;
        }
        setStatus("Voice typing stopped. Try again if you still want it.");
        stopListening();
      };
      rec.onend = function () {
        if (!wantListen || !session) return;
        session.anchor += session.liveLen;
        session.liveLen = 0;
        global.setTimeout(function () {
          if (!wantListen) return;
          startRec();
        }, 120);
      };
      try {
        rec.start();
        setStatus("Listening — press Fn twice to stop, or click Stop.");
      } catch (e) {
        setStatus("Could not start the microphone. Try Chrome or Edge.");
        stopListening();
      }
    }

    startRec();
  }

  function afterAllow(target) {
    saveConsent();
    requestBrowserMic()
      .then(function () {
        beginRecognition(target);
      })
      .catch(function () {
        setStatus("Microphone was blocked. Allow it for this site, then try again.");
        stopListening();
      });
  }

  function hideDialog() {
    if (!dialog) return;
    dialog.hidden = true;
    pendingTarget = null;
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("div");
    dialog.className = "lk-voice-type-modal";
    dialog.hidden = true;
    dialog.innerHTML =
      '<div class="lk-voice-type-backdrop" data-voice-dismiss="1"></div>' +
      '<div class="lk-voice-type-dialog" role="dialog" aria-modal="true" aria-labelledby="lkVoiceTypeTitle">' +
      "<h2 id=\"lkVoiceTypeTitle\">Voice typing</h2>" +
      "<p>LoreKeeper can type what you say into this note or document.</p>" +
      "<p>Your browser will ask for the microphone next. Chrome and Edge may send that audio to the company that made the browser to turn it into words. LoreKeeper does not keep a recording. Only the words that appear in the box are saved with your writing.</p>" +
      "<p>After you allow it, press the <strong>Fn</strong> key twice to start, like Notes. Leaving this tab turns it off — press Fn twice again when you come back. You can still type, and you can stop anytime.</p>" +
      '<div class="lk-voice-type-actions">' +
      '<button type="button" class="lk-btn" id="lkVoiceTypeAllow">Allow microphone</button>' +
      '<button type="button" class="lk-btn secondary" id="lkVoiceTypeNotNow">Not now</button>' +
      "</div></div>";
    document.body.appendChild(dialog);
    dialog.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-voice-dismiss") === "1") {
        hideDialog();
      }
    });
    var allow = dialog.querySelector("#lkVoiceTypeAllow");
    var notNow = dialog.querySelector("#lkVoiceTypeNotNow");
    if (allow) {
      allow.addEventListener("click", function () {
        var target = pendingTarget;
        hideDialog();
        if (target) afterAllow(target);
      });
    }
    if (notNow) {
      notNow.addEventListener("click", hideDialog);
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && dialog && !dialog.hidden) {
        hideDialog();
      } else if (e.key === "Escape" && wantListen) {
        stopListening();
      }
    });
    return dialog;
  }

  function showDialog(target) {
    pendingTarget = target;
    var el = ensureDialog();
    el.hidden = false;
    var allow = el.querySelector("#lkVoiceTypeAllow");
    if (allow && allow.focus) allow.focus();
  }

  function onMicClick(target) {
    if (!isComputer()) return;
    if (wantListen && activeButton === target.button) {
      stopListening();
      return;
    }
    if (wantListen) stopListening();
    if (!speechCtor()) {
      setStatus("Voice typing needs Chrome or Edge on this computer.");
      return;
    }
    if (hasConsent()) {
      afterAllow(target);
      return;
    }
    showDialog(target);
  }

  function makeButton() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lk-btn secondary lk-voice-type-btn";
    btn.textContent = "Voice type";
    btn.setAttribute("aria-pressed", "false");
    btn.title = "Press Fn twice (or click) to speak into this box";
    return btn;
  }

  function bindTextarea(el, host) {
    if (!el || el.__lkVoiceBound) return;
    el.__lkVoiceBound = true;
    var btn = makeButton();
    var target = { kind: "textarea", el: el, button: btn };
    if (el.id === "noteBody") boundTargets.homeNote = target;
    if (el.id === "docNoteBody") boundTargets.docNote = target;
    btn.addEventListener("click", function () {
      onMicClick(target);
    });
    (host || el.parentNode).appendChild(btn);
  }

  function bindQuill(quill) {
    if (!quill || quill.__lkVoiceBound) return;
    quill.__lkVoiceBound = true;
    var toolbar =
      document.querySelector("#docEditor .ql-toolbar") ||
      (quill.container && quill.container.parentNode
        ? quill.container.parentNode.querySelector(".ql-toolbar")
        : null) ||
      document.querySelector(".lk-doc-sheet .ql-toolbar");
    var btn = makeButton();
    btn.classList.add("lk-voice-type-btn--doc");
    var target = { kind: "quill", quill: quill, button: btn };
    boundTargets.quill = target;
    btn.addEventListener("click", function () {
      onMicClick(target);
    });
    if (toolbar) toolbar.appendChild(btn);
    else if (quill.container && quill.container.parentNode) {
      quill.container.parentNode.insertBefore(btn, quill.container);
    }
  }

  function isFnKey(e) {
    if (!e || e.repeat) return false;
    var key = e.key || "";
    var code = e.code || "";
    if (key === "Fn" || key === "FnLock") return true;
    if (code === "Fn" || code === "FnLeft" || code === "FnRight") return true;
    return false;
  }

  function isFocusedIn(el, ae) {
    if (!el || !ae) return false;
    return ae === el || (el.contains && el.contains(ae));
  }

  function targetFromFocus() {
    var ae = document.activeElement;
    if (boundTargets.homeNote && isFocusedIn(boundTargets.homeNote.el, ae)) {
      return boundTargets.homeNote;
    }
    if (boundTargets.docNote && isFocusedIn(boundTargets.docNote.el, ae)) {
      return boundTargets.docNote;
    }
    if (
      boundTargets.quill &&
      boundTargets.quill.quill &&
      boundTargets.quill.quill.root &&
      isFocusedIn(boundTargets.quill.quill.root, ae)
    ) {
      return boundTargets.quill;
    }
    var notePanel = document.getElementById("noteEditorPanel");
    if (notePanel && !notePanel.hidden && boundTargets.homeNote) return boundTargets.homeNote;
    var docNotePanel = document.getElementById("docQuickNotePanel");
    if (docNotePanel && !docNotePanel.hidden && boundTargets.docNote) {
      if (ae && ae.closest && ae.closest("#docQuickNotePanel")) return boundTargets.docNote;
    }
    if (boundTargets.quill) return boundTargets.quill;
    return null;
  }

  function onDoubleFn() {
    if (!isComputer()) return;
    if (dialog && !dialog.hidden) return;
    if (wantListen) {
      stopListening();
      return;
    }
    var target = targetFromFocus();
    if (!target) {
      setStatus("Open a note or document, then press Fn twice to voice type.");
      return;
    }
    onMicClick(target);
  }

  function onFnKeyDown(e) {
    if (!isComputer() || !isFnKey(e)) return;
    var now = Date.now();
    if (now - lastFnAt <= FN_DOUBLE_MS) {
      lastFnAt = 0;
      if (e.cancelable) e.preventDefault();
      onDoubleFn();
      return;
    }
    lastFnAt = now;
  }

  function bindGlobalControls() {
    if (fnBound) return;
    fnBound = true;
    document.addEventListener("keydown", onFnKeyDown, true);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") stopListening();
    });
  }

  function bindResizeStop() {
    if (mqBound) return;
    mqBound = true;
    bindGlobalControls();
    global.addEventListener("pagehide", stopListening);
    if (!global.matchMedia) return;
    try {
      var mq = global.matchMedia(MOBILE_MQ);
      var onChange = function (e) {
        if (e.matches) stopListening();
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch (e) {
      /* ignore */
    }
  }

  function initHome() {
    if (!isComputer()) return;
    bindResizeStop();
    var noteBody = document.getElementById("noteBody");
    var toolbar = document.querySelector("#noteEditorPanel .lk-toolbar");
    if (noteBody) bindTextarea(noteBody, toolbar);
  }

  function initDoc(quill) {
    if (!isComputer()) return;
    bindResizeStop();
    var noteBody = document.getElementById("docNoteBody");
    var actions = document.querySelector("#docQuickNotePanel .lk-doc-note-actions");
    if (noteBody) bindTextarea(noteBody, actions);
    if (quill) bindQuill(quill);
  }

  global.LoreKeeperVoiceType = {
    initHome: initHome,
    initDoc: initDoc,
    stop: stopListening,
  };
})(typeof window !== "undefined" ? window : this);
