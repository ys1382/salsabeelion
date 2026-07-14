/**
 * LoreKeeper — prefix word completion on mobile (#5).
 */
(function (global) {
  var bar = null;
  var bound = false;

  function isMobile() {
    return global.LoreKeeperMobileComfort && global.LoreKeeperMobileComfort.isMobile
      ? global.LoreKeeperMobileComfort.isMobile()
      : (global.innerWidth || 0) <= 720;
  }

  function getContext(target) {
    if (!target) return {};
    if (typeof target.getContext === "function") return target.getContext() || {};
    if (target.el && typeof target.el.__lkWriteContext === "function") {
      return target.el.__lkWriteContext() || {};
    }
    if (target.quill && typeof target.quill.__lkWriteContext === "function") {
      return target.quill.__lkWriteContext() || {};
    }
    return {};
  }

  function getActiveTarget() {
    return global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.getTarget
      ? global.LoreKeeperMobileAccessory.getTarget()
      : null;
  }

  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = "lkWritingCompleteBar";
    bar.className = "lk-writing-complete-bar";
    bar.hidden = true;
    bar.setAttribute("role", "listbox");
    bar.setAttribute("aria-label", "Word suggestions");
    var accessory = document.getElementById("lkMobileAccessory");
    if (accessory) accessory.insertBefore(bar, accessory.firstChild);
    else document.body.appendChild(bar);
    return bar;
  }

  function hideBar() {
    if (!bar) return;
    bar.hidden = true;
    bar.innerHTML = "";
    if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.updateHeights) {
      global.LoreKeeperMobileAccessory.updateHeights();
    }
  }

  function showSuggestions(matches, partial, target) {
    if (!matches.length || !partial || !target || !global.LoreKeeperWritingGlossary) {
      hideBar();
      return;
    }
    var el = ensureBar();
    el.innerHTML = "";
    matches.forEach(function (m) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lk-writing-complete-opt";
      btn.setAttribute("role", "option");
      btn.textContent = m.word;
      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
      });
      btn.addEventListener("click", function () {
        if (target.type === "textarea" && target.el) {
          global.LoreKeeperWritingGlossary.replacePartialTextarea(target.el, partial, m.word);
        } else if (target.type === "quill" && target.quill) {
          global.LoreKeeperWritingGlossary.replacePartialQuill(target.quill, partial, m.word);
        }
        hideBar();
        refresh();
      });
      el.appendChild(btn);
    });
    el.hidden = false;
    if (global.LoreKeeperMobileAccessory && global.LoreKeeperMobileAccessory.updateHeights) {
      global.LoreKeeperMobileAccessory.updateHeights();
    }
  }

  function isCaptureActive() {
    return (
      document.body.classList.contains("lk-mobile-writing") ||
      document.body.classList.contains("lk-mobile-sidebar-capture")
    );
  }

  function refresh() {
    if (!isMobile() || !isCaptureActive()) {
      hideBar();
      return;
    }
    var target = getActiveTarget();
    var G = global.LoreKeeperWritingGlossary;
    if (!target || !G) {
      hideBar();
      return;
    }
    var partial = null;
    if (target.type === "textarea" && target.el) {
      partial = G.partialWordTextarea(target.el);
    } else if (target.type === "quill" && target.quill) {
      partial = G.partialWordQuill(target.quill);
    }
    if (!partial) {
      hideBar();
      return;
    }
    var matches = G.prefixMatches(partial.word, getContext(target));
    showSuggestions(matches, partial, target);
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    global.addEventListener("lorekeeper-writing-glossary-changed", refresh);
    if (global.LoreKeeperMobileAccessory) {
      var orig = global.LoreKeeperMobileAccessory.setTarget;
      if (orig && !global.LoreKeeperMobileAccessory.__lkCompleteHooked) {
        global.LoreKeeperMobileAccessory.__lkCompleteHooked = true;
        global.LoreKeeperMobileAccessory.setTarget = function (t) {
          orig(t);
          refresh();
        };
        var onMode = global.LoreKeeperMobileAccessory.onWritingMode;
        global.LoreKeeperMobileAccessory.onWritingMode = function (on) {
          onMode(on);
          if (!on) hideBar();
          else refresh();
        };
      }
    }
  }

  function bindTextarea(el) {
    if (!el || el.__lkCompleteBound) return;
    el.__lkCompleteBound = true;
    bindOnce();
    el.addEventListener("input", refresh);
    el.addEventListener("keyup", refresh);
    el.addEventListener("click", function () {
      setTimeout(refresh, 0);
    });
  }

  function bindQuill(quill) {
    if (!quill || quill.__lkCompleteBound) return;
    quill.__lkCompleteBound = true;
    bindOnce();
    quill.on("text-change", function (_d, _o, source) {
      if (source === "user") refresh();
    });
    quill.on("selection-change", function (range, _o, source) {
      if (source === "user" && range) refresh();
    });
  }

  global.LoreKeeperWritingComplete = {
    bindTextarea: bindTextarea,
    bindQuill: bindQuill,
    refresh: refresh,
  };
})(typeof window !== "undefined" ? window : this);
