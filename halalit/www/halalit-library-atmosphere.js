/**
 * Halalit — ambient “miniature study” motion for Personal Library (CSS + light JS).
 * Slow parallax, soft dust, occasional lamp flicker (not tied to OS reduce-motion).
 */
(function (global) {
  var STAGE_FLAG = "__halalitLibraryParallax";

  function prefersReducedMotion() {
    try {
      return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  function hash32(str) {
    var h = 2166136261;
    var s = String(str || "");
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Deterministic float in [0, 1) from string + salt. */
  function frac(str, salt) {
    return (hash32(str + "\0" + salt) % 1000000) / 1000000;
  }

  function buildDustMotes(container, seedStr) {
    if (!container || container.getAttribute("data-dust-built") === "1") return;
    container.setAttribute("data-dust-built", "1");
    var n = 12;
    var frag = global.document.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      var m = global.document.createElement("span");
      m.className = "library-dust-mote";
      var x = frac(seedStr, "x" + i);
      var y = frac(seedStr, "y" + i);
      var s = 0.55 + frac(seedStr, "s" + i) * 1.35;
      var d = 38 + Math.floor(frac(seedStr, "d" + i) * 52);
      var dx = (frac(seedStr, "dx" + i) - 0.5) * 18;
      var dy = -22 - frac(seedStr, "dy" + i) * 40;
      var delay = -frac(seedStr, "t" + i) * d;
      m.style.left = (x * 100).toFixed(2) + "%";
      m.style.top = (y * 100).toFixed(2) + "%";
      m.style.width = s.toFixed(2) + "px";
      m.style.height = s.toFixed(2) + "px";
      m.style.setProperty("--dust-dur", d + "s");
      m.style.setProperty("--dust-dx", dx.toFixed(2) + "px");
      m.style.setProperty("--dust-dy", dy.toFixed(2) + "px");
      m.style.animationDelay = delay.toFixed(2) + "s";
      frag.appendChild(m);
    }
    container.appendChild(frag);
  }

  function ensureStageParallax(stage) {
    if (!stage || stage[STAGE_FLAG]) return;
    stage[STAGE_FLAG] = true;
    stage.__halalitParallaxPaused = false;
    var raf = null;
    var tx = 0;
    var ty = 0;
    var cx = 0;
    var cy = 0;
    function tick() {
      raf = null;
      if (stage.__halalitParallaxPaused) return;
      var diorama = stage.querySelector(".library-diorama");
      if (!diorama) return;
      cx += (tx - cx) * 0.055;
      cy += (ty - cy) * 0.055;
      diorama.style.setProperty("--lib-px", cx.toFixed(5));
      diorama.style.setProperty("--lib-py", cy.toFixed(5));
      if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) {
        raf = global.requestAnimationFrame(tick);
      }
    }
    function schedule() {
      if (raf == null) raf = global.requestAnimationFrame(tick);
    }
    function onMove(ev) {
      if (stage.__halalitParallaxPaused) return;
      var rect = stage.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      var nx = ((ev.clientX - rect.left) / rect.width - 0.5) * 2;
      var ny = ((ev.clientY - rect.top) / rect.height - 0.5) * 2;
      tx = Math.max(-1, Math.min(1, nx));
      ty = Math.max(-1, Math.min(1, ny));
      schedule();
    }
    function onLeave() {
      if (stage.__halalitParallaxPaused) return;
      tx = 0;
      ty = 0;
      schedule();
    }
    stage.addEventListener("mousemove", onMove, { passive: true });
    stage.addEventListener("mouseleave", onLeave, { passive: true });
    stage.addEventListener(
      "scroll",
      function () {
        stage.__halalitParallaxPaused = true;
        if (stage.__halalitParallaxScrollTimer) global.clearTimeout(stage.__halalitParallaxScrollTimer);
        stage.__halalitParallaxScrollTimer = global.setTimeout(function () {
          stage.__halalitParallaxScrollTimer = null;
          if (!stage.matches || !stage.matches(":hover")) stage.__halalitParallaxPaused = false;
        }, 480);
      },
      { passive: true }
    );

    stage.__halalitBindShelfParallaxPause = function bindShelfParallaxPause() {
      var shelf = stage.querySelector(".library-diorama__shelf-sway");
      if (!shelf || shelf.getAttribute("data-halalit-shelf-pause") === "1") return;
      shelf.setAttribute("data-halalit-shelf-pause", "1");
      shelf.addEventListener(
        "pointerenter",
        function () {
          stage.__halalitParallaxPaused = true;
          tx = cx;
          ty = cy;
          if (raf != null) {
            global.cancelAnimationFrame(raf);
            raf = null;
          }
        },
        { passive: true }
      );
      shelf.addEventListener(
        "pointerleave",
        function () {
          stage.__halalitParallaxPaused = false;
          schedule();
        },
        { passive: true }
      );
    };
  }

  /**
   * Call after #libraryStage innerHTML updates.
   * @param {HTMLElement | null} stage
   */
  function refresh(stage) {
    if (!stage) return;
    var diorama = stage.querySelector(".library-diorama");
    if (!diorama) return;
    var dust = diorama.querySelector(".library-diorama__dust");
    var seed = String(diorama.getAttribute("data-seed") || "halalit");
    if (dust && dust.getAttribute("data-dust-seed") !== seed) {
      dust.setAttribute("data-dust-seed", seed);
      dust.removeAttribute("data-dust-built");
      dust.textContent = "";
      buildDustMotes(dust, seed);
    }
    ensureStageParallax(stage);
    if (typeof stage.__halalitBindShelfParallaxPause === "function") {
      stage.__halalitBindShelfParallaxPause();
    }
  }

  global.HalalitLibraryAtmosphere = {
    refresh: refresh,
    prefersReducedMotion: prefersReducedMotion,
  };
})(typeof window !== "undefined" ? window : this);
