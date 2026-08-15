/**
 * Halalit — Bookcheck: parents look up a title against family-shelf recommendation rules.
 */
(function (global) {
  var LEGACY_SKIP_KEYS = [
    "halalit_bookcheck_skip_deity_comfort",
    "halalit_bookcheck_skip_family_community",
    "halalit_bookcheck_skip_light_romance",
    "halalit_bookcheck_skip_magic",
    "halalit_bookcheck_skip_substance",
  ];

  var GRAPHIC_FORMAT_RE =
    /\bcomic books?\b|\bgraphic novels?\b|\bgraphic books?\b|\bmanga\b|\bcomics\b|\bgraphic fiction\b|\bsketchbooks?\b|\bart books?\b/i;
  var YOUTH_CATALOG_RE =
    /juvenile fiction|juvenile works|juvenile literature|children'?s fiction|children'?s stories|young readers|picture books/i;

  var bookcheckPanels = {};

  var DEFAULT_BOOKCHECK_IDS = {
    title: "bookcheckTitle",
    author: "bookcheckAuthor",
    lookup: "bookcheckLookup",
    status: "bookcheckLookupStatus",
    matchBox: "bookcheckMatchBox",
    matchLead: "bookcheckMatchLead",
    matchList: "bookcheckMatchList",
    verdict: "bookcheckVerdict",
    seriesNote: "bookcheckSeriesNote",
    wikiNote: "bookcheckWikiNote",
    wikidataNote: "bookcheckWikidataNote",
  };

  var bookcheckChaseStylesInjected = false;

  var BOOKCHECK_CHASE_FACTS = [
    "Halalit tip: Tap any cover on your shelf to see why it's there.",
    "Did you know: A group of cats is called a clowder.",
    "Reading tip: It's okay to abandon a book that isn't clicking.",
    "Did you know: The Tale of Genji is often called the world's first novel.",
    "Halalit tip: Book Quest remembers what you've already read on this device.",
    "Did you know: Libraries existed in ancient Mesopotamia.",
    "Reading tip: Re-read favorites — comfort reads count.",
    "The cat approves of bookmark use. (This one is self-aware.)",
    "Did you know: Some books are written without using the letter E.",
    "Halalit can't hand-check every book — Bookcheck helps you decide faster.",
    "Reading tip: Ask your kid what they noticed — not just what happened.",
    "Did you know: Audiobooks count as reading if that's how you enjoy stories.",
    "Halalit tip: Add the author when titles are super common.",
    "Did you know: The word novel came from Italian novella — a new little story.",
    "This loading cat has read zero pages. It is purely vibing.",
    "Reading tip: Comics and graphic novels are real reading.",
    "Did you know: Public libraries lend more items per year than most bookstores sell.",
    "Halalit tip: Export your shelf from My TBR if you want a backup file.",
  ];

  var BOOKCHECK_CHASE_CAT_LINES = [
    "the cat is fetching your answer",
    "still sniffing the shelves",
    "paws crossed this one is easy",
    "breaking the fourth wall: please hold",
    "cat tax: you wait, we hunt themes",
    "the cat believes in you",
    "somewhere, a librarian nods approvingly",
    "not a real skeleton — just a cat with a job",
    "the text is evasive. the cat is quicker.",
    "end-credits energy, but for book themes",
  ];

  var BOOKCHECK_CHASE_CATALOG_STATUS = [
    "Reading the catalog…",
    "Searching Open Library…",
    "Sniffing out the right edition…",
  ];

  var BOOKCHECK_CHASE_THEME_STATUS = [
    "Checking themes…",
    "Scanning for shelf flags…",
    "Asking the theme scanner…",
    "Reading Wikipedia & Wikidata…",
  ];

  function isBookcheckChaseSpotlightLine(line) {
    if (!line) return false;
    return (
      /did you know/i.test(line) ||
      /purely vibing|clowder|without using the letter e|world'?s first novel|novella —/i.test(line) ||
      /self-aware|fourth wall|cat tax|not a real skeleton|end-credits|zero pages|approves of bookmark/i.test(line)
    );
  }

  function injectBookcheckChaseStyles() {
    if (bookcheckChaseStylesInjected || typeof document === "undefined") return;
    bookcheckChaseStylesInjected = true;
    var style = document.createElement("style");
    style.id = "halalit-bookcheck-chase-styles";
    style.textContent =
      ".bookcheck-chase-loader{margin:0.55rem 0 0.75rem;padding:0.65rem 0.7rem 0.7rem;border-radius:12px;background:linear-gradient(180deg,rgba(255,248,235,0.72),rgba(245,232,210,0.5));border:1px dashed rgba(180,150,110,0.42);}" +
      ".bookcheck-chase-scene{position:relative;height:3.6rem;overflow:hidden;border-radius:8px;background:linear-gradient(180deg,rgba(255,255,255,0.15),rgba(139,115,88,0.08));border-bottom:3px solid rgba(139,115,88,0.22);}" +
      ".bookcheck-chase-scene::after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:repeating-linear-gradient(90deg,rgba(139,115,88,0.35) 0 8px,transparent 8px 14px);}" +
      ".bookcheck-chase-banner{position:absolute;left:6%;bottom:6px;z-index:2;padding:0.22rem 0.62rem;background:#f7ebd4;border:2px solid #8b7358;box-shadow:2px 2px 0 rgba(60,45,30,0.12);white-space:nowrap;transform-origin:50% 100%;}" +
      ".bookcheck-chase-scene--cat-near .bookcheck-chase-banner{animation:bookcheckBannerNervous 0.32s ease-in-out infinite;}" +
      ".bookcheck-chase-scene--cat-near .bookcheck-chase-banner::after{opacity:1;}" +
      ".bookcheck-chase-banner::after{content:'!';position:absolute;top:-0.55rem;right:-0.15rem;font-size:0.75rem;font-weight:800;color:#b85c38;opacity:0;transition:opacity 0.12s;}" +
      ".bookcheck-chase-text{font-size:0.8rem;color:#5c4a38;font-style:italic;line-height:1.2;}" +
      ".bookcheck-chase-cat{position:absolute;bottom:4px;left:76%;z-index:1;width:36px;height:30px;transform-origin:50% 100%;transition:none;}" +
      ".bookcheck-chase-cat[data-hop=\"0\"]{left:76%;transform:translateY(0) scale(1,1);}" +
      ".bookcheck-chase-cat[data-hop=\"1\"]{left:58%;transform:translateY(-14px) scale(1.07,0.88);}" +
      ".bookcheck-chase-cat[data-hop=\"2\"]{left:52%;transform:translateY(0) scale(1.14,0.82);}" +
      ".bookcheck-chase-cat[data-hop=\"3\"]{left:38%;transform:translateY(-16px) scale(1.07,0.88);}" +
      ".bookcheck-chase-cat[data-hop=\"4\"]{left:30%;transform:translateY(0) scale(1.14,0.82);}" +
      ".bookcheck-chase-cat[data-hop=\"5\"]{left:22%;transform:translateY(-10px) scale(1.05,0.92);}" +
      ".bookcheck-chase-cat::before{content:'';position:absolute;left:50%;bottom:0;width:12px;height:7px;margin-left:-6px;border-radius:50%;background:rgba(139,115,88,0.4);opacity:0;transform:scale(0.35);}" +
      ".bookcheck-chase-cat[data-hop=\"2\"]::before,.bookcheck-chase-cat[data-hop=\"4\"]::before,.bookcheck-chase-cat[data-hop=\"5\"]::before{opacity:0.85;transform:scale(1.35);}" +
      ".bookcheck-chase-aside{margin:0.42rem 0 0;font-size:0.76rem;line-height:1.35;color:#7a6348;font-style:italic;min-height:1.2em;}" +
      ".bookcheck-chase-aside--silly{font-size:0.95rem;font-weight:650;line-height:1.35;color:#5c3d28;letter-spacing:0.01em;}" +
      ".bookcheck-chase-fact{margin:0.28rem 0 0;font-size:0.76rem;line-height:1.35;color:#8a7358;opacity:0.94;min-height:2.2em;}" +
      ".bookcheck-chase-fact--spotlight{font-size:1rem;font-weight:650;line-height:1.4;color:#4a3525;opacity:1;padding:0.38rem 0.55rem;margin-top:0.4rem;border-radius:8px;background:rgba(255,235,200,0.62);border-left:3px solid rgba(200,140,70,0.72);box-shadow:0 1px 0 rgba(255,255,255,0.45) inset;}" +
      ".bookcheck-pixel-cat-wrap{transform-origin:50% 100%;}" +
      ".bookcheck-pixel-cat{position:relative;width:34px;height:24px;transform-origin:50% 100%;animation:bookcheckCatHopBob 0.26s steps(2) infinite;}" +
      ".bookcheck-pixel-cat span{position:absolute;image-rendering:pixelated;}" +
      ".bookcheck-pixel-cat__ear{width:0;height:0;border-left:3px solid transparent;border-right:3px solid transparent;border-bottom:6px solid #d8893c;}" +
      ".bookcheck-pixel-cat__ear--l{left:20px;bottom:15px;}" +
      ".bookcheck-pixel-cat__ear--r{left:26px;bottom:16px;}" +
      ".bookcheck-pixel-cat__head{left:20px;bottom:6px;width:12px;height:11px;background:#e8a04a;border:1px solid #6b4423;border-radius:4px 6px 3px 2px;}" +
      ".bookcheck-pixel-cat__head::before{content:'';position:absolute;left:6px;top:4px;width:2px;height:2px;background:#2b2118;}" +
      ".bookcheck-pixel-cat__head::after{content:'';position:absolute;left:10px;top:6px;width:2px;height:2px;background:#c9742f;}" +
      ".bookcheck-pixel-cat__torso{left:4px;bottom:3px;width:23px;height:11px;background:#d8893c;border:1px solid #6b4423;border-radius:7px 8px 4px 4px;}" +
      ".bookcheck-pixel-cat__tail{left:0;bottom:9px;width:8px;height:4px;background:#c9742f;border:1px solid #6b4423;border-radius:3px;transform-origin:100% 50%;animation:bookcheckCatTailHop 0.5s ease-in-out infinite alternate;}" +
      ".bookcheck-pixel-cat__leg{width:3px;height:5px;bottom:0;border-radius:0 0 1px 1px;}" +
      ".bookcheck-pixel-cat__leg--fnear{left:22px;background:#6b4423;animation:bookcheckCatTrotA 0.26s steps(2) infinite;}" +
      ".bookcheck-pixel-cat__leg--ffar{left:19px;height:4px;background:#a5673a;animation:bookcheckCatTrotB 0.26s steps(2) infinite;}" +
      ".bookcheck-pixel-cat__leg--bnear{left:7px;background:#6b4423;animation:bookcheckCatTrotB 0.26s steps(2) infinite;}" +
      ".bookcheck-pixel-cat__leg--bfar{left:10px;height:4px;background:#a5673a;animation:bookcheckCatTrotA 0.26s steps(2) infinite;}" +
      ".bookcheck-chase-cat--idle{animation-play-state:paused;}" +
      ".bookcheck-chase-cat--idle::before{animation-play-state:paused;opacity:0;}" +
      ".bookcheck-chase-cat--idle .bookcheck-pixel-cat{animation:bookcheckCatIdleBob 0.9s ease-in-out infinite;}" +
      ".bookcheck-chase-cat--idle .bookcheck-pixel-cat__tail{animation:bookcheckCatTailIdle 1.1s ease-in-out infinite alternate;}" +
      ".bookcheck-chase-cat--idle .bookcheck-pixel-cat__head{animation:bookcheckCatBlink 2.2s steps(1,end) infinite;}" +
      ".bookcheck-chase-cat--idle .bookcheck-pixel-cat__leg{animation:none;}" +
      ".catalog-lookup-row--chase-active .bookcheck-chase-sr-status{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}" +
      ".bookcheck-verdict--wait{border-color:rgba(180,150,110,0.45);}" +
      ".bookcheck-vet-banner--ai-wait{margin-bottom:0.45rem;}" +
      ".bookcheck-retry-scan-btn{margin-top:0.55rem;}" +
      "@keyframes bookcheckBannerNervous{0%,100%{transform:rotate(0deg) translateX(0);}25%{transform:rotate(-2deg) translateX(-2px);}75%{transform:rotate(2deg) translateX(2px);}}" +
      "@keyframes bookcheckCatHopBob{0%{transform:translateY(0);}100%{transform:translateY(-2px);}}" +
      "@keyframes bookcheckCatTailHop{0%{transform:rotate(-16deg);}100%{transform:rotate(24deg);}}" +
      "@keyframes bookcheckCatTrotA{0%{transform:translateX(-1px);}100%{transform:translateX(2px);}}" +
      "@keyframes bookcheckCatTrotB{0%{transform:translateX(2px);}100%{transform:translateX(-1px);}}" +
      "@keyframes bookcheckCatIdleBob{0%,100%{transform:translateY(0);}50%{transform:translateY(-2px);}}" +
      "@keyframes bookcheckCatTailIdle{0%{transform:rotate(-12deg);}100%{transform:rotate(16deg);}}" +
      "@keyframes bookcheckCatBlink{0%,92%,100%{transform:scaleY(1);}94%{transform:scaleY(0.12);}}" +
      ".bookcheck-chase-loader--pounce .bookcheck-chase-cat{animation:none;}" +
      ".bookcheck-chase-loader--pounce .bookcheck-chase-banner{animation:none;}" +
      ".bookcheck-chase-loader--pounce .bookcheck-pixel-cat-wrap{animation:bookcheckCatPounce 0.48s ease-out forwards;}" +
      ".bookcheck-chase-loader--pounce{animation:bookcheckChaseFadeOut 0.52s ease-out forwards;}" +
      "@keyframes bookcheckCatPounce{0%{transform:scale(-1,1) translateX(0) translateY(0);}42%{transform:scale(-1.1,1.1) translateX(-1.4rem) translateY(-0.6rem);}100%{transform:scale(-1,1) translateX(-1.85rem) translateY(0);}}" +
      "@keyframes bookcheckChaseFadeOut{0%,62%{opacity:1;}100%{opacity:0;}}" +
      ".bookcheck-chase-loader--reduced .bookcheck-chase-cat{left:30%;transform:none;}" +
      ".bookcheck-chase-loader--reduced .bookcheck-chase-banner{animation:none;}" +
      ".bookcheck-chase-loader--reduced .bookcheck-pixel-cat-wrap{animation:none;transform:scaleX(-1);}" +
      ".bookcheck-chase-loader--reduced .bookcheck-pixel-cat,.bookcheck-chase-loader--reduced .bookcheck-pixel-cat__leg,.bookcheck-chase-loader--reduced .bookcheck-pixel-cat__tail{animation:none;}" +
      "@media (prefers-reduced-motion:reduce){.bookcheck-chase-cat::before,.bookcheck-chase-scene--cat-near .bookcheck-chase-banner,.bookcheck-pixel-cat,.bookcheck-pixel-cat__leg,.bookcheck-pixel-cat__tail{animation:none !important;}.bookcheck-chase-cat{left:30%;transform:none !important;}.bookcheck-pixel-cat-wrap{transform:scaleX(-1);}.bookcheck-chase-loader--pounce .bookcheck-pixel-cat-wrap{animation:none !important;}.bookcheck-chase-loader--pounce{animation:bookcheckChaseFadeOut 0.25s ease-out forwards;}}";
    document.head.appendChild(style);
  }

  function buildBookcheckPixelCatEl() {
    var cat = document.createElement("div");
    cat.className = "bookcheck-pixel-cat";
    cat.setAttribute("aria-hidden", "true");

    function part(cls) {
      var el = document.createElement("span");
      el.className = cls;
      return el;
    }

    var tail = part("bookcheck-pixel-cat__tail");
    var legFfar = part("bookcheck-pixel-cat__leg bookcheck-pixel-cat__leg--ffar");
    var legBfar = part("bookcheck-pixel-cat__leg bookcheck-pixel-cat__leg--bfar");
    var torso = part("bookcheck-pixel-cat__torso");
    var legFnear = part("bookcheck-pixel-cat__leg bookcheck-pixel-cat__leg--fnear");
    var legBnear = part("bookcheck-pixel-cat__leg bookcheck-pixel-cat__leg--bnear");
    var head = part("bookcheck-pixel-cat__head");
    var earL = part("bookcheck-pixel-cat__ear bookcheck-pixel-cat__ear--l");
    var earR = part("bookcheck-pixel-cat__ear bookcheck-pixel-cat__ear--r");

    cat.appendChild(tail);
    cat.appendChild(legFfar);
    cat.appendChild(legBfar);
    cat.appendChild(torso);
    cat.appendChild(legFnear);
    cat.appendChild(legBnear);
    cat.appendChild(earL);
    cat.appendChild(earR);
    cat.appendChild(head);
    return cat;
  }

  function createBookcheckChaseLoader(statusEl, lookupRowEl) {
    if (!statusEl || !statusEl.parentNode) return null;
    injectBookcheckChaseStyles();
    statusEl.classList.add("bookcheck-chase-sr-status");

    var root = document.createElement("div");
    root.className = "bookcheck-chase-loader";
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");

    var scene = document.createElement("div");
    scene.className = "bookcheck-chase-scene";

    var banner = document.createElement("div");
    banner.className = "bookcheck-chase-banner";

    var text = document.createElement("span");
    text.className = "bookcheck-chase-text";

    banner.appendChild(text);

    var catEl = document.createElement("div");
    catEl.className = "bookcheck-chase-cat";

    var catWrap = document.createElement("div");
    catWrap.className = "bookcheck-pixel-cat-wrap";
    catWrap.appendChild(buildBookcheckPixelCatEl());
    catEl.appendChild(catWrap);

    scene.appendChild(banner);
    scene.appendChild(catEl);

    var aside = document.createElement("p");
    aside.className = "bookcheck-chase-aside";

    var fact = document.createElement("p");
    fact.className = "bookcheck-chase-fact";

    root.appendChild(scene);
    root.appendChild(aside);
    root.appendChild(fact);

    var anchor = lookupRowEl && lookupRowEl.parentNode ? lookupRowEl : statusEl.parentNode;
    if (anchor.nextSibling) anchor.parentNode.insertBefore(root, anchor.nextSibling);
    else anchor.parentNode.appendChild(root);

    var factIdx = 0;
    var captionIdx = 0;
    var asideIdx = 0;
    var factTimer = null;
    var captionTimer = null;
    var asideTimer = null;
    var pounceTimer = null;
    var idleBeatTimer = null;
    var idleClearTimer = null;
    var hopTimer = null;
    var hopStep = 0;
    var hopDir = 1;
    var visibleAt = 0;
    var visible = false;
    var CHASE_MIN_MS = 2000;
    var currentPhase = "catalog";
    var reducedMotion = false;

    try {
      reducedMotion =
        global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (eReduced) {
      reducedMotion = false;
    }

    function statusPoolForPhase(phase) {
      return phase === "themes" ? BOOKCHECK_CHASE_THEME_STATUS : BOOKCHECK_CHASE_CATALOG_STATUS;
    }

    function nextCaption() {
      var pool = statusPoolForPhase(currentPhase);
      return pool[captionIdx % pool.length];
    }

    function rotateFact() {
      var line = BOOKCHECK_CHASE_FACTS[factIdx % BOOKCHECK_CHASE_FACTS.length];
      fact.textContent = line;
      fact.classList.toggle("bookcheck-chase-fact--spotlight", isBookcheckChaseSpotlightLine(line));
      factIdx += 1;
    }

    function rotateAside() {
      aside.textContent = BOOKCHECK_CHASE_CAT_LINES[asideIdx % BOOKCHECK_CHASE_CAT_LINES.length];
      aside.classList.add("bookcheck-chase-aside--silly");
      asideIdx += 1;
    }

    function rotateCaption() {
      text.textContent = nextCaption();
      captionIdx += 1;
    }

    function clearTimers() {
      if (factTimer) {
        clearInterval(factTimer);
        factTimer = null;
      }
      if (captionTimer) {
        clearInterval(captionTimer);
        captionTimer = null;
      }
      if (asideTimer) {
        clearInterval(asideTimer);
        asideTimer = null;
      }
      if (pounceTimer) {
        clearTimeout(pounceTimer);
        pounceTimer = null;
      }
      if (idleBeatTimer) {
        clearInterval(idleBeatTimer);
        idleBeatTimer = null;
      }
      if (idleClearTimer) {
        clearTimeout(idleClearTimer);
        idleClearTimer = null;
      }
      if (hopTimer) {
        clearInterval(hopTimer);
        hopTimer = null;
      }
      scene.classList.remove("bookcheck-chase-scene--cat-near");
      catEl.classList.remove("bookcheck-chase-cat--idle");
    }

    function syncHopFace() {
      catWrap.style.transform = hopDir < 0 ? "scaleX(-1)" : "scaleX(1)";
    }

    function syncHopVisual() {
      catEl.setAttribute("data-hop", String(hopStep));
      if (hopStep >= 4) scene.classList.add("bookcheck-chase-scene--cat-near");
      else scene.classList.remove("bookcheck-chase-scene--cat-near");
      syncHopFace();
    }

    function startHopLoop() {
      if (hopTimer) {
        clearInterval(hopTimer);
        hopTimer = null;
      }
      if (reducedMotion) {
        hopStep = 3;
        syncHopVisual();
        return;
      }
      hopStep = 0;
      hopDir = 1;
      syncHopVisual();
      hopTimer = setInterval(function () {
        if (!visible || reducedMotion || catEl.classList.contains("bookcheck-chase-cat--idle")) return;
        hopStep += hopDir;
        if (hopStep >= 5) {
          hopDir = -1;
          hopStep = 4;
        } else if (hopStep <= 0) {
          hopDir = 1;
          hopStep = 1;
        }
        syncHopVisual();
      }, 340);
    }

    function startIdleBeats() {
      if (reducedMotion) return;
      idleBeatTimer = setInterval(function () {
        if (!visible || reducedMotion) return;
        catEl.classList.add("bookcheck-chase-cat--idle");
        if (idleClearTimer) clearTimeout(idleClearTimer);
        idleClearTimer = setTimeout(function () {
          catEl.classList.remove("bookcheck-chase-cat--idle");
          idleClearTimer = null;
        }, 450);
      }, 5200);
    }

    function setRowActive(active) {
      if (!lookupRowEl) return;
      if (active) lookupRowEl.classList.add("catalog-lookup-row--chase-active");
      else lookupRowEl.classList.remove("catalog-lookup-row--chase-active");
    }

    return {
      isVisible: function () {
        return visible;
      },
      start: function (phase) {
        currentPhase = phase || "catalog";
        clearTimers();
        root.hidden = false;
        root.classList.remove("bookcheck-chase-loader--pounce");
        root.classList.toggle("bookcheck-chase-loader--reduced", reducedMotion);
        visible = true;
        visibleAt = Date.now();
        setRowActive(true);
        captionIdx = 0;
        asideIdx = 0;
        rotateCaption();
        rotateAside();
        rotateFact();
        factTimer = setInterval(rotateFact, 2500);
        captionTimer = setInterval(rotateCaption, 2800);
        asideTimer = setInterval(rotateAside, 3200);
        startIdleBeats();
        startHopLoop();
      },
      setPhase: function (phase) {
        if (!visible) return;
        currentPhase = phase || currentPhase;
        rotateCaption();
      },
      hide: function () {
        clearTimers();
        root.hidden = true;
        root.classList.remove("bookcheck-chase-loader--pounce");
        visible = false;
        setRowActive(false);
      },
      pounceAndHide: function (cb) {
        if (!visible) {
          if (cb) cb();
          return;
        }
        var wait = Math.max(0, CHASE_MIN_MS - (Date.now() - visibleAt));
        if (pounceTimer) {
          clearTimeout(pounceTimer);
          pounceTimer = null;
        }
        pounceTimer = setTimeout(function () {
          pounceTimer = null;
          clearTimers();
          if (!visible) {
            if (cb) cb();
            return;
          }
          if (reducedMotion) {
            root.hidden = true;
            visible = false;
            setRowActive(false);
            if (cb) cb();
            return;
          }
          hopStep = 5;
          syncHopVisual();
          root.classList.add("bookcheck-chase-loader--pounce");
          pounceTimer = setTimeout(function () {
            root.hidden = true;
            root.classList.remove("bookcheck-chase-loader--pounce");
            visible = false;
            setRowActive(false);
            pounceTimer = null;
            if (cb) cb();
          }, 520);
        }, wait);
      },
    };
  }

  function bookcheckEl(panel, ids, key) {
    var id = (ids && ids[key]) || DEFAULT_BOOKCHECK_IDS[key];
    return id ? panel.querySelector("#" + id) : null;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  /** Multi-line curated notes: first line title, following lines become a short list. */
  function formatNoteHtml(text) {
    var raw = String(text || "").trim();
    if (!raw) return "";
    var lines = raw
      .split(/\n+/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
    if (lines.length <= 1) return escapeHtml(raw);
    var html = '<div class="bookcheck-note-block">';
    html += '<p class="bookcheck-note-title">' + escapeHtml(lines[0]) + "</p>";
    html += '<ul class="bookcheck-note-lines">';
    for (var i = 1; i < lines.length; i++) {
      html += "<li>" + escapeHtml(lines[i]) + "</li>";
    }
    return html + "</ul></div>";
  }

  function normalizeOlTitle(doc) {
    var t = doc && doc.title;
    if (Array.isArray(t)) return String(t[0] || "").trim();
    return String(t || "").trim();
  }

  function normKey(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function authorsFromDoc(doc) {
    return Array.isArray(doc && doc.author_name) && doc.author_name.length ? doc.author_name : [];
  }

  function authorLine(doc) {
    var names = authorsFromDoc(doc);
    return names.length ? names.join(", ") : "";
  }

  function authorScore(queryAuthor, doc) {
    var q = normKey(queryAuthor);
    if (!q) return 0;
    var names = authorsFromDoc(doc);
    if (!names.length) return 0;
    var best = 0;
    for (var i = 0; i < names.length; i++) {
      var a = normKey(names[i]);
      if (!a) continue;
      if (a === q) best = Math.max(best, 100);
      else if (a.indexOf(q) !== -1 || q.indexOf(a) !== -1) best = Math.max(best, 88);
      else {
        var qt = q.split(" ").filter(Boolean);
        var at = a.split(" ").filter(Boolean);
        var as = {};
        for (var j = 0; j < at.length; j++) as[at[j]] = true;
        var inter = 0;
        for (var k = 0; k < qt.length; k++) if (as[qt[k]]) inter++;
        if (qt.length) best = Math.max(best, (inter / qt.length) * 72);
      }
    }
    return best;
  }

  function titleScore(queryTitle, candidateTitle) {
    var q = normKey(queryTitle);
    var c = normKey(candidateTitle);
    if (!q || !c) return 0;
    if (c === q) return 100;
    if (c.indexOf(q) !== -1 || q.indexOf(c) !== -1) return 88;
    var qt = q.split(" ").filter(Boolean);
    var cs = {};
    var ct = c.split(" ").filter(Boolean);
    for (var i = 0; i < ct.length; i++) cs[ct[i]] = true;
    var inter = 0;
    for (var j = 0; j < qt.length; j++) if (cs[qt[j]]) inter++;
    if (!qt.length) return 0;
    return (inter / qt.length) * 72;
  }

  function queryMentionsVolume(queryTitle) {
    return /\b(book|vol|volume)\s*#?\s*\d+\b/i.test(String(queryTitle || ""));
  }

  /** Catalog row adds "… 4" when the reader only typed the series name — e.g. Inkheart → Inkheart 4. */
  function isSpuriousVolumeMatch(queryTitle, docOrTitle) {
    if (queryMentionsVolume(queryTitle)) return false;
    var ttl =
      docOrTitle && docOrTitle.title != null
        ? normalizeOlTitle(docOrTitle)
        : String(docOrTitle || "").trim();
    if (!ttl) return false;
    var qn = normKey(queryTitle);
    var cn = normKey(ttl);
    var m = cn.match(/^(.+?)\s+(\d+)$/);
    if (!m) return false;
    var base = m[1].trim();
    if (!base || !qn) return false;
    return base === qn || cn.indexOf(qn + " ") === 0;
  }

  function shouldSyncCatalogTitle(enteredTitle, catalogTitle) {
    if (!enteredTitle || !catalogTitle) return false;
    if (isSpuriousVolumeMatch(enteredTitle, { title: catalogTitle })) return false;
    return titleScore(enteredTitle, catalogTitle) >= 88;
  }

  /** Prefer rows with subject tags (family-shelf heuristics need them). */
  function subjectRichness(doc) {
    var n = 0;
    if (doc && doc.subject_facet && doc.subject_facet.length) n = doc.subject_facet.length;
    else if (doc && doc.subject && doc.subject.length) n = doc.subject.length;
    return Math.min(n, 24);
  }

  function scoreDoc(doc, queryTitle, queryAuthor, rankIndex) {
    var ttl = normalizeOlTitle(doc);
    var ts = titleScore(queryTitle, ttl);
    var as = authorScore(queryAuthor, doc);
    var authorWeight = queryAuthor ? 0.38 : 0;
    var titleWeight = 1 - authorWeight;
    var subN = subjectRichness(doc);
    var blended = ts * titleWeight + as * authorWeight + subN * 1.25 + (1 - rankIndex / 14) * 2;
    if (subN === 0) blended -= 48;
    if (isSpuriousVolumeMatch(queryTitle, doc)) blended -= 120;
    return { doc: doc, score: blended, titleScore: ts, authorScore: as };
  }

  function dedupeKey(doc) {
    var workKey = doc && doc.key;
    if (workKey && String(workKey).indexOf("/works/") === 0) return "w:" + workKey;
    var ttl = normKey(normalizeOlTitle(doc));
    var auth = normKey(authorLine(doc).split(",")[0]);
    return "t:" + ttl + "|" + auth;
  }

  /**
   * Collapse duplicate catalog rows (same work or same title+author), keep strongest match.
   */
  function refineCatalogDocs(docs, queryTitle, queryAuthor) {
    if (!docs || !docs.length) return [];
    var scored = [];
    for (var i = 0; i < docs.length; i++) scored.push(scoreDoc(docs[i], queryTitle, queryAuthor, i));
    scored.sort(function (a, b) {
      return b.score - a.score;
    });
    var byKey = {};
    var out = [];
    for (var j = 0; j < scored.length; j++) {
      var row = scored[j];
      var key = dedupeKey(row.doc);
      if (byKey[key]) continue;
      byKey[key] = true;
      out.push(row);
    }
    return out;
  }

  /** Ignore catalog rows that only share loose word overlap (e.g. wonderlight → Wonder-Light). */
  var MIN_CONFIDENT_TITLE_SCORE = 72;

  function filterConfidentCatalogMatches(refined, queryAuthor, queryTitle) {
    if (!refined || !refined.length) return [];
    var out = [];
    for (var i = 0; i < refined.length; i++) {
      var row = refined[i];
      if (queryTitle && isSpuriousVolumeMatch(queryTitle, row.doc)) continue;
      if (row.titleScore >= MIN_CONFIDENT_TITLE_SCORE) out.push(row);
      else if (queryAuthor && row.authorScore >= 92 && row.titleScore >= 50) out.push(row);
    }
    return out;
  }

  function refineCatalogMatches(docs, queryTitle, queryAuthor) {
    return refineCatalogDocs(docs, queryTitle, queryAuthor).filter(function (row) {
      return !isSpuriousVolumeMatch(queryTitle, row.doc);
    });
  }

  function shouldAutoPick(refined, queryAuthor) {
    if (!refined.length) return false;
    if (refined.length === 1) return refined[0].titleScore >= MIN_CONFIDENT_TITLE_SCORE;
    var best = refined[0];
    var second = refined[1];
    if (best.titleScore >= 98 && (!second || second.titleScore < 85)) return true;
    if (best.score - second.score >= 14 && best.titleScore >= 88) return true;
    if (queryAuthor && best.authorScore >= 92 && second.authorScore < 70) return true;
    var sameTitle = normKey(normalizeOlTitle(best.doc));
    var allSameTitle = true;
    for (var i = 1; i < refined.length; i++) {
      if (normKey(normalizeOlTitle(refined[i].doc)) !== sameTitle) {
        allSameTitle = false;
        break;
      }
    }
    if (allSameTitle && best.titleScore >= 85 && best.score - second.score >= 6) return true;
    return false;
  }

  function matchButtonLabel(doc) {
    var ttl = normalizeOlTitle(doc) || "Untitled";
    var auth = authorLine(doc) || "author unknown";
    var yr = doc && doc.first_publish_year;
    if (yr && yr === yr) return ttl + " — " + auth + " (" + String(yr) + ")";
    return ttl + " — " + auth;
  }

  function applyCatalogPinToRaw(raw, queryTitle, queryAuthor) {
    var Pins = global.HalalitCatalogPins;
    if (!Pins || typeof Pins.filterCatalogDocs !== "function") {
      return { docs: raw || [], pinMessage: null };
    }
    var pack = Pins.filterCatalogDocs(raw || [], queryTitle, queryAuthor);
    return { docs: pack.docs, pinMessage: pack.pinned ? pack.message : null };
  }

  function buildOpenLibraryQueryUrl(title, author) {
    var params = new URLSearchParams();
    params.set("limit", "12");
    params.set("fields", "key,title,author_name,subject,subject_facet,first_publish_year,cover_i,isbn");
    var t = String(title || "").trim();
    var a = String(author || "").trim();
    if (t) params.set("title", t);
    if (a) params.set("author", a);
    if (!t && !a) return null;
    return "https://openlibrary.org/search.json?" + params.toString();
  }

  function normalizeLooseTitle(title) {
    var t = String(title || "").trim();
    if (!t) return "";
    return t
      .replace(/\bbook\s*#?\s*\d+\b/gi, " ")
      .replace(/\bvolume\s*#?\s*\d+\b/gi, " ")
      .replace(/\bvol\.?\s*#?\s*\d+\b/gi, " ")
      .replace(/[#]\s*\d+\b/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function buildOpenLibraryFallbackQUrl(title, author) {
    var params = new URLSearchParams();
    params.set("limit", "18");
    params.set("fields", "key,title,author_name,subject,subject_facet,first_publish_year,cover_i,isbn");
    var t = String(title || "").trim();
    var loose = normalizeLooseTitle(t);
    var a = String(author || "").trim();
    var q = [t, loose !== t ? loose : "", a].filter(Boolean).join(" ").trim();
    if (!q) return null;
    params.set("q", q);
    return "https://openlibrary.org/search.json?" + params.toString();
  }

  function inferHint(doc, supplementText) {
    var Policy = global.HalalitFamilyShelfPolicy;
    if (Policy && typeof Policy.inferCatalogFamilyHint === "function") {
      var opts = supplementText ? { supplementText: supplementText } : undefined;
      return Policy.inferCatalogFamilyHint(doc, opts);
    }
    return { tier: "unclear", detail: "Catalog check unavailable—use the guidelines and your own reading." };
  }

  function handVetHintFor(title, author, altTitle, altAuthor) {
    var VS = global.HalalitBookcheckVetSource;
    if (!VS || typeof VS.resolveHandVetHint !== "function") return null;
    var hand = VS.resolveHandVetHint(title, author);
    if (hand) return hand;
    if (altTitle || altAuthor) {
      return VS.resolveHandVetHint(altTitle || title, altAuthor || "");
    }
    return null;
  }

  /** Hand-vetted or owner curated WARNINGS — skip extra catalog/AI pass. */
  function isSettledHandHint(hint, title, author) {
    if (handVetHintFor(title, author)) return true;
    if (!hint) return false;
    if (hint.tier === "verified_clean" || hint.tier === "fanservice_caution") return true;
    var VS = global.HalalitBookcheckVetSource;
    if (VS && typeof VS.curatedMatch === "function" && VS.curatedMatch(title, author)) return true;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.verifiedCleanMatch === "function" && Cur.verifiedCleanMatch(title, author)) {
      return true;
    }
    return false;
  }

  function fetchCatalogSupplement(doc) {
    var key = doc && doc.key;
    if (!key || String(key).indexOf("/works/") !== 0) return Promise.resolve({ combined: "", description: "" });
    return global
      .fetch("https://openlibrary.org" + key + ".json")
      .then(function (r) {
        if (!r.ok) return { combined: "", description: "" };
        return r.json();
      })
      .then(function (work) {
        if (!work || typeof work !== "object") return { combined: "", description: "" };
        var desc = "";
        var d = work.description;
        if (typeof d === "string") desc = d;
        else if (d && typeof d.value === "string") desc = d.value;
        var parts = [];
        if (desc) parts.push(desc);
        if (work.subjects && work.subjects.length) parts = parts.concat(work.subjects);
        return { combined: parts.join(" "), description: desc };
      })
      .catch(function () {
        return { combined: "", description: "" };
      });
  }

  function buildFamilyReport(title, author, doc, hint, supplementPack, hadWikipedia, wikipedia, wikidata, meta) {
    var Report = global.HalalitBookcheckReport;
    if (!Report || typeof Report.build !== "function") return null;
    var pack = supplementPack || { combined: "", description: "" };
    meta = meta || {};
    return Report.build({
      title: title,
      author: author,
      doc: doc,
      hint: hint,
      supplementText: pack.combined,
      descriptionOnly: pack.description,
      hadWikipedia: !!hadWikipedia,
      wikipedia: wikipedia || null,
      wikidata: wikidata || null,
      aiScanOk: !!meta.aiScanOk,
      fanserviceNotChecked: !!meta.fanserviceNotChecked,
      aiSeriesNote: meta.aiSeriesNote || "",
      aiThemes: meta.aiThemes || [],
      aiLgbtqDenied: !!meta.aiLgbtqDenied,
      aiLgbtqPresent: !!meta.aiLgbtqPresent,
    });
  }

  function familyPortrayalParagraph(familyPortrayal, inlineDetail) {
    if (inlineDetail || !familyPortrayal || !familyPortrayal.detail) return "";
    var label = familyPortrayal.label || "Family is portrayed negatively";
    return " " + label + ": " + familyPortrayal.detail;
  }

  function deityComfortParagraph(deityComfort, inlineDetail) {
    if (inlineDetail || !deityComfort || !deityComfort.detail) return "";
    var label = deityComfort.label || "Deity or mythology (comfort note)";
    return " " + label + ": " + deityComfort.detail;
  }

  function bookcheckYouDecideLine() {
    var R = global.HalalitBookcheckReport;
    return (R && R.youDecideLine) || "Halalit hasn’t read this cover to cover—you decide what fits your home.";
  }

  function appendYouDecideParagraph(body, tier, opts) {
    opts = opts || {};
    if (opts.experienced) return body;
    var R = global.HalalitBookcheckReport;
    if (!R || typeof R.shouldShowYouDecideLine !== "function") return body;
    if (
      !R.shouldShowYouDecideLine(null, { tier: tier }, { vetSource: opts.vetSource })
    ) {
      return body;
    }
    var line = bookcheckYouDecideLine();
    if (body && body.indexOf("you decide") !== -1) return body;
    return (body ? body + " " : "") + line;
  }

  function shortVerdictBody(tier, hintDetail, inlineDetail) {
    if (!inlineDetail) return hintDetail || "";
    if (hintDetail) return "";
    if (tier === "deity_comfort") return "Comfort note—not a ban.";
    if (tier === "teen_caution") return "Teen/YA — check themes below.";
    if (tier === "verified_clean") return "Hand-checked for the family shelf.";
    if (tier === "flag_review") return "Outside Halalit’s hardest auto-reject rules.";
    if (tier === "user_discretion") {
      return "Hand-checked parent discretion—not LGBTQ, adult-romance, or hardest fanservice auto-reject.";
    }
    if (tier === "preview_caution") return "Comics or manga—preview before kids read.";
    if (tier === "fanservice_caution") return "Hand-checked comic—lighter fanservice caution.";
    if (tier === "likely_youth" || tier === "not_verified") return "Children’s tags aren’t a clean pass.";
    return bookcheckYouDecideLine();
  }

  function formatSignalsHtml(signals) {
    if (!signals || !signals.length) return "";
    var html = '<ul class="bookcheck-signals">';
    for (var i = 0; i < signals.length; i++) {
      html += "<li>" + escapeHtml(signals[i]) + "</li>";
    }
    return html + "</ul>";
  }

  function subjectBlobFromDoc(doc) {
    var parts = [];
    if (doc && doc.subject_facet && doc.subject_facet.length) parts = doc.subject_facet.slice(0, 24);
    else if (doc && doc.subject && doc.subject.length) parts = doc.subject.slice(0, 24);
    return parts.join(" ").toLowerCase();
  }

  function clearLegacyBookcheckSkipKeys() {
    try {
      if (!global.localStorage) return;
      for (var i = 0; i < LEGACY_SKIP_KEYS.length; i++) {
        global.localStorage.removeItem(LEGACY_SKIP_KEYS[i]);
      }
    } catch (e) {
      /* ignore */
    }
  }

  function filterComfortNoteText(text) {
    var lines = String(text || "").split("\n");
    var kept = [];
    for (var i = 0; i < lines.length; i++) {
      var line = String(lines[i] || "").trim();
      if (!line || shouldHideComfortText(line)) continue;
      kept.push(line);
    }
    return kept.join("\n").trim();
  }

  function shouldHideComfortText(text) {
    var Policy = global.HalalitFamilyShelfPolicy;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (!Cur || typeof Cur.comfortNoteCategories !== "function") return false;
    var cats = Cur.comfortNoteCategories(text);
    if (!cats.length || !Policy) return false;
    if (cats.indexOf("deity") !== -1 && Policy.bookQuestAllowsDeityMythology && !Policy.bookQuestAllowsDeityMythology()) {
      return true;
    }
    if (
      cats.indexOf("family") !== -1 &&
      Policy.bookQuestAllowsFamilyCommunityTone &&
      !Policy.bookQuestAllowsFamilyCommunityTone()
    ) {
      return true;
    }
    if (cats.indexOf("romance") !== -1 && Policy.bookQuestAllowsLightRomance && !Policy.bookQuestAllowsLightRomance()) {
      return true;
    }
    if (cats.indexOf("magic") !== -1 && Policy.bookQuestAllowsMagic && !Policy.bookQuestAllowsMagic()) {
      return true;
    }
    if (cats.indexOf("substance") !== -1 && Policy.bookQuestAllowsSubstance && !Policy.bookQuestAllowsSubstance()) {
      return true;
    }
    if (
      cats.indexOf("cultural") !== -1 &&
      Policy.bookQuestAllowsCulturalMisrepresentation &&
      !Policy.bookQuestAllowsCulturalMisrepresentation()
    ) {
      return true;
    }
    if (
      cats.indexOf("mental_health") !== -1 &&
      Policy.mentalHealthComfortAppliesToReaderBand &&
      Policy.mentalHealthComfortAppliesToReaderBand(Policy.getBookQuestReaderAgeBand()) &&
      Policy.bookQuestAllowsMentalHealthComfort &&
      !Policy.bookQuestAllowsMentalHealthComfort()
    ) {
      return true;
    }
    return false;
  }

  function shouldHideScanRow(row) {
    if (row && row.id === "catalog_silent") return true;
    var Report = global.HalalitBookcheckReport;
    if (Report && typeof Report.themeBriefDeniesIssue === "function" && Report.themeBriefDeniesIssue(row && row.note)) {
      return true;
    }
    var Policy = global.HalalitFamilyShelfPolicy;
    if (!row || !row.label || !Policy) return false;
    if (/cultural misrepresentation|cultural-representation note/i.test(String(row.label))) {
      return (
        typeof Policy.bookQuestAllowsCulturalMisrepresentation === "function" &&
        !Policy.bookQuestAllowsCulturalMisrepresentation()
      );
    }
    return false;
  }

  function shouldHideThemeHit() {
    return false;
  }

  function culturalNoteVisible() {
    var Policy = global.HalalitFamilyShelfPolicy;
    return !(
      Policy &&
      typeof Policy.bookQuestAllowsCulturalMisrepresentation === "function" &&
      !Policy.bookQuestAllowsCulturalMisrepresentation()
    );
  }

  var BOOKCHECK_LOOKUP_COUNT_KEY = "halalit_bookcheck_completed_lookups";
  var BOOKCHECK_EXPERIENCED_THRESHOLD = 3;

  function getBookcheckCompletedLookups() {
    try {
      if (!global.localStorage) return 0;
      var n = parseInt(global.localStorage.getItem(BOOKCHECK_LOOKUP_COUNT_KEY), 10);
      return isNaN(n) || n < 0 ? 0 : n;
    } catch (e) {
      return 0;
    }
  }

  function recordBookcheckEnrichComplete() {
    try {
      if (!global.localStorage) return;
      global.localStorage.setItem(
        BOOKCHECK_LOOKUP_COUNT_KEY,
        String(getBookcheckCompletedLookups() + 1)
      );
    } catch (e) {
      /* ignore */
    }
  }

  function isExperiencedBookcheckUser() {
    return getBookcheckCompletedLookups() >= BOOKCHECK_EXPERIENCED_THRESHOLD;
  }

  function syncBookcheckAiNotice(panel) {
    var notice =
      (panel && panel.querySelector("#bookcheck-ai-notice")) ||
      (typeof document !== "undefined" && document.getElementById("bookcheck-ai-notice"));
    if (notice) notice.hidden = isExperiencedBookcheckUser();
  }

  global.HalalitBookcheckPrefs = {
    shouldHideComfortText: shouldHideComfortText,
    shouldHideScanRow: shouldHideScanRow,
    shouldHideThemeHit: shouldHideThemeHit,
    filterComfortNoteText: filterComfortNoteText,
    culturalNoteVisible: culturalNoteVisible,
    isExperiencedBookcheckUser: isExperiencedBookcheckUser,
    recordBookcheckEnrichComplete: recordBookcheckEnrichComplete,
  };

  function displayHintTier(tier) {
    return tier;
  }

  function bookcheckShelfOpts(Policy) {
    if (!Policy || typeof Policy.getBookQuestReaderAgeBand !== "function") return null;
    var band = Policy.getBookQuestReaderAgeBand();
    return {
      allowDeityMythology:
        typeof Policy.bookQuestAllowsDeityMythology === "function" && Policy.bookQuestAllowsDeityMythology(),
      allowFamilyCommunityTone:
        typeof Policy.bookQuestAllowsFamilyCommunityTone === "function" &&
        Policy.bookQuestAllowsFamilyCommunityTone(),
      allowLightRomance:
        typeof Policy.bookQuestAllowsLightRomance === "function" && Policy.bookQuestAllowsLightRomance(),
      allowMagic: typeof Policy.bookQuestAllowsMagic === "function" && Policy.bookQuestAllowsMagic(),
      allowSubstance:
        typeof Policy.bookQuestAllowsSubstance === "function" && Policy.bookQuestAllowsSubstance(),
      allowCulturalMisrepresentation:
        typeof Policy.bookQuestAllowsCulturalMisrepresentation === "function" &&
        Policy.bookQuestAllowsCulturalMisrepresentation(),
      allowMentalHealthComfort:
        typeof Policy.bookQuestAllowsMentalHealthComfort === "function" &&
        Policy.bookQuestAllowsMentalHealthComfort(),
      requireReaderAgeBand: !!band,
      readerAgeBand: band,
      variantId: null,
    };
  }

  /** Softer verdict when a title fails only because of shared reader prefs (not a hard ban). */
  function bookcheckPrefVerdictOverride(title, author, Policy, shelfTier) {
    if (!Policy || typeof Policy.isEligibleForFamilyShelf !== "function") return null;
    var opts = bookcheckShelfOpts(Policy);
    if (!opts || Policy.isEligibleForFamilyShelf(title, author, shelfTier, opts)) return null;
    if (Policy.hardExclusionDetailForTitle && Policy.hardExclusionDetailForTitle(title, author)) return null;

    if (
      ((shelfTier === "deity_comfort" || shelfTier === "verified_clean") &&
        Policy.bookQuestDeityMythologyBlock &&
        Policy.bookQuestDeityMythologyBlock(title, author) &&
        Policy.bookQuestAllowsDeityMythology &&
        !Policy.bookQuestAllowsDeityMythology()) ||
      (shelfTier === "deity_comfort" &&
        Policy.bookQuestAllowsDeityMythology &&
        !Policy.bookQuestAllowsDeityMythology())
    ) {
      return {
        kind: "maybe",
        headline: "Outside your settings — deity or mythology",
        body:
          "Folklore or mythology treated as real—some readers skip these. You excluded deity/mythology in Advanced recommendations settings (shared with Book Quest). Not calling it inappropriate.",
      };
    }
    if (
      Policy.bookQuestNegativeFamilyPortrayalBlock &&
      Policy.bookQuestNegativeFamilyPortrayalBlock(title, author) &&
      Policy.bookQuestAllowsFamilyCommunityTone &&
      !Policy.bookQuestAllowsFamilyCommunityTone()
    ) {
      return {
        kind: "maybe",
        headline: "Outside your settings — negative family portrayal",
        body:
          "A parent or guardian is cast as unfair or villain-like—not merely annoying family friction. You excluded that theme in Advanced recommendations settings.",
      };
    }
    if (
      Policy.bookQuestLightRomanceBlock &&
      Policy.bookQuestLightRomanceBlock(title, author) &&
      Policy.bookQuestAllowsLightRomance &&
      !Policy.bookQuestAllowsLightRomance()
    ) {
      return {
        kind: "maybe",
        headline: "Outside your settings — light romance",
        body:
          "Hand-checked light romance—crushes, light dating, or a prom—not adult, dark, or LGBTQ romance. You excluded light romance in Advanced recommendations settings.",
      };
    }
    if (
      Policy.bookQuestMagicBlock &&
      Policy.bookQuestMagicBlock(title, author) &&
      Policy.bookQuestAllowsMagic &&
      !Policy.bookQuestAllowsMagic()
    ) {
      return {
        kind: "maybe",
        headline: "Outside your settings — magic",
        body:
          "Fantasy magic in an otherwise hand-verified title. You excluded magic in Advanced recommendations settings—the book may still be clean for another reader.",
      };
    }
    if (
      Policy.bookQuestSubstanceBlock &&
      Policy.bookQuestSubstanceBlock(title, author) &&
      Policy.bookQuestAllowsSubstance &&
      !Policy.bookQuestAllowsSubstance()
    ) {
      return {
        kind: "maybe",
        headline: "Outside your settings — alcohol or similar",
        body:
          "Light alcohol or similar mentions in an otherwise hand-verified title. You excluded alcohol/drug-related content in Advanced recommendations settings.",
      };
    }
    if (
      Policy.bookQuestCulturalMisrepresentationBlock &&
      Policy.bookQuestCulturalMisrepresentationBlock(title, author) &&
      Policy.bookQuestAllowsCulturalMisrepresentation &&
      !Policy.bookQuestAllowsCulturalMisrepresentation()
    ) {
      return {
        kind: "maybe",
        headline: "Outside your settings — cultural misrepresentation",
        body:
          "Hand-checked cultural misrepresentation notes—not group demonization. You excluded cultural misrepresentation in Advanced recommendations settings.",
      };
    }
    if (
      Policy.bookQuestMentalHealthComfortBlock &&
      Policy.bookQuestMentalHealthComfortBlock(title, author) &&
      Policy.mentalHealthComfortAppliesToReaderBand &&
      Policy.mentalHealthComfortAppliesToReaderBand(opts.readerAgeBand) &&
      Policy.bookQuestAllowsMentalHealthComfort &&
      !Policy.bookQuestAllowsMentalHealthComfort()
    ) {
      return {
        kind: "maybe",
        headline: "Outside your settings — mental-health weight",
        body:
          "Hand-checked mental-health comfort note—not a ban. You excluded mental-health weight in Advanced recommendations settings for Older Child/Young Teen and Older Teen/Adult readers.",
      };
    }
    if (
      opts.requireReaderAgeBand &&
      Policy.bookQuestMatchesReaderAge &&
      !Policy.bookQuestMatchesReaderAge(title, author, null, opts.readerAgeBand)
    ) {
      return {
        kind: "maybe",
        headline: "Outside your reader age band",
        body:
          "This hand-vetted title doesn’t fit the reader age band you chose above (same setting as Book Quest). Pick a different band or title if you want Halalit to treat it as a good fit.",
      };
    }
    return null;
  }

  function pickContextBlanket(doc, title, author, hintTier) {
    if (
      hintTier === "flag_review" ||
      hintTier === "verified_clean" ||
      hintTier === "user_discretion" ||
      hintTier === "deity_comfort" ||
      hintTier === "preview_caution" ||
      hintTier === "fanservice_caution"
    )
      return "";
    var titleBlob = String(title || "").toLowerCase();
    var subjectBlob = subjectBlobFromDoc(doc);
    var titleLooksGraphic = GRAPHIC_FORMAT_RE.test(titleBlob);
    var subjectLooksGraphic = GRAPHIC_FORMAT_RE.test(subjectBlob);
    if (titleLooksGraphic || subjectLooksGraphic) {
      return "Comics/manga: preview panels—even when the age label looks young.";
    }
    if (
      YOUTH_CATALOG_RE.test(subjectBlob) ||
      hintTier === "not_verified" ||
      hintTier === "unclear" ||
      hintTier === "likely_youth"
    ) {
      return "Children’s tags don’t catch everything—catalogs miss small concerns.";
    }
    return "";
  }

  function verdictFor(
    title,
    author,
    hintTier,
    hintDetail,
    matchedTitle,
    matchedAuthor,
    familyPortrayal,
    deityComfort,
    contextBlanket,
    policyTier,
    opts
  ) {
    var inlineDetail = opts && opts.detailShownInMatchLead;
    var signals = (opts && opts.signals) || [];
    var familyAction = (opts && opts.familyAction) || "";
    var Policy = global.HalalitFamilyShelfPolicy;
    var shelfTier = policyTier || hintTier;
    var shelfOpts = Policy ? bookcheckShelfOpts(Policy) : null;
    var fpPara = familyPortrayalParagraph(familyPortrayal, inlineDetail);
    var dcPara = deityComfortParagraph(deityComfort, inlineDetail);

    var matchLine = "";
    if (matchedTitle) {
      matchLine =
        "Catalog match: <strong>" +
        escapeHtml(matchedTitle) +
        "</strong>" +
        (matchedAuthor ? " · " + escapeHtml(matchedAuthor) : "");
    }

    var prefOverride =
      Policy && typeof bookcheckPrefVerdictOverride === "function"
        ? bookcheckPrefVerdictOverride(title, author, Policy, shelfTier)
        : null;
    if (prefOverride) {
      return {
        kind: prefOverride.kind,
        headline: prefOverride.headline,
        body: prefOverride.body + fpPara + dcPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: (opts && opts.familyAction) || "",
        signals: (opts && opts.signals) || [],
      };
    }
    var blocked =
      Policy && typeof Policy.hardExclusionDetailForTitle === "function" && Policy.hardExclusionDetailForTitle(title, author);
    var eligible =
      Policy && typeof Policy.isEligibleForFamilyShelf === "function"
        ? Policy.isEligibleForFamilyShelf(title, author, shelfTier, shelfOpts)
        : shelfTier !== "flag_review" && shelfTier !== "deity_comfort";

    if (shelfTier === "deity_comfort") {
      return {
        kind: "maybe",
        headline: "Deity or mythology — comfort note",
        body:
          shortVerdictBody("deity_comfort", hintDetail, inlineDetail) ||
          (hintDetail ||
            "Folklore or mythology treated as real—some readers skip these. Halalit won’t Book Quest this; not calling it inappropriate.") +
          fpPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "fanservice_caution" || shelfTier === "fanservice_caution") {
      return {
        kind: "maybe",
        headline: "Comics — lighter fanservice caution",
        body:
          shortVerdictBody("fanservice_caution", hintDetail, inlineDetail) ||
          (hintDetail || "Hand-checked comic with some panel risk—preview human characters and outfits.") + fpPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "user_discretion" || shelfTier === "user_discretion") {
      return {
        kind: "maybe",
        headline: "Parent discretion",
        body:
          shortVerdictBody("user_discretion", hintDetail, inlineDetail) ||
          (hintDetail ||
            "Hand-checked parent discretion—not LGBTQ, adult-romance, or hardest fanservice auto-reject.") +
          fpPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "ai_likely_pass") {
      return {
        kind: "maybe",
        headline: "AI likely okay — not hand-checked",
        body: (hintDetail || "AI theme scan only—not owner hand-vetted.") + fpPara + dcPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "ai_manual_review") {
      return {
        kind: "maybe",
        headline: "AI flagged for review — not hand-checked",
        body: (hintDetail || "AI flagged possible concerns—not a hand reject.") + fpPara + dcPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "ai_likely_reject") {
      return {
        kind: "maybe",
        headline: "AI likely rejection — not manually checked",
        body: (hintDetail || "AI likely fails Halalit rules—not hand-rejected by the owner.") + fpPara + dcPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (blocked || hintTier === "flag_review" || !eligible) {
      var vetSource = opts && opts.vetSource;
      return {
        kind: "no",
        headline:
          vetSource === "agent_flagged" ? "Halalit agent flag — not hand-read" : "Automatic hard rejection",
        body:
          shortVerdictBody("flag_review", hintDetail, inlineDetail) ||
          hintDetail ||
          "Outside Halalit’s hardest auto-reject rules.",
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "preview_caution") {
      return {
        kind: "maybe",
        headline: "Preview before your kids read",
        body:
          shortVerdictBody("preview_caution", hintDetail, inlineDetail) ||
          (hintDetail || "Comics and manga need a quick parent preview—catalogs miss a lot.") + fpPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "teen_caution") {
      return {
        kind: "maybe",
        headline: fpPara ? "Teen/YA — family note" : "Teen/YA — see themes",
        body:
          shortVerdictBody("teen_caution", hintDetail, inlineDetail) ||
          (hintDetail || "Teen/YA on its own isn’t a reject—check the themes below.") + fpPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "verified_clean") {
      return {
        kind: "yes",
        headline: dcPara ? "Good fit — deity or mythology note" : fpPara ? "Good fit — family note" : "Good fit for Halalit’s family shelf",
        body:
          shortVerdictBody("verified_clean", hintDetail, inlineDetail) ||
          (hintDetail || "Hand-checked for the family shelf.") + fpPara + dcPara,
        matchLine: matchLine,
        contextBlanket: "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    if (hintTier === "likely_youth" || hintTier === "not_verified" || hintTier === "unclear") {
      var youthHead =
        signals.length && signals.indexOf("Comics, manga, or graphic novel") !== -1
          ? "Preview recommended"
          : fpPara
            ? "Not hand-read — family note"
            : "Not hand-read yet";
      return {
        kind: "maybe",
        headline: youthHead,
        body: appendYouDecideParagraph(
          shortVerdictBody(hintTier, hintDetail, inlineDetail) ||
            (hintDetail ||
              (hintTier === "likely_youth"
                ? "Tagged children’s fiction—not a hand-read pass."
                : "Not hand-read yet.")) + fpPara,
          hintTier,
          opts
        ),
        matchLine: matchLine,
        contextBlanket: contextBlanket || "",
        familyAction: familyAction,
        signals: signals,
      };
    }
    return {
      kind: "maybe",
      headline: fpPara ? "Not hand-read — family note" : "Not hand-read yet",
      body: appendYouDecideParagraph(
        shortVerdictBody("unclear", hintDetail, inlineDetail) || (hintDetail || bookcheckYouDecideLine()) + fpPara,
        "unclear",
        opts
      ),
      matchLine: matchLine,
      contextBlanket: contextBlanket || "",
      familyAction: familyAction,
      signals: signals,
    };
  }

  function verdictActionHtml(v, opts) {
    opts = opts || {};
    var parts = "";
    if (v.familyAction && !opts.hideFamilyAction) {
      parts +=
        '<p class="bookcheck-action"><strong>What to do:</strong> ' + escapeHtml(v.familyAction) + "</p>";
    }
    if (v.signals && v.signals.length) {
      parts += '<div class="bookcheck-signals-wrap"><p class="bookcheck-signals-title">What we noticed</p>';
      parts += formatSignalsHtml(v.signals);
      parts += "</div>";
    }
    return parts;
  }

  function init(panel, opts) {
    opts = opts || {};
    if (!panel || panel.getAttribute("data-bookcheck-wired") === "1") return;
    panel.setAttribute("data-bookcheck-wired", "1");
    clearLegacyBookcheckSkipKeys();
    syncBookcheckAiNotice(panel);
    var ids = Object.assign({}, DEFAULT_BOOKCHECK_IDS, opts.ids || {});
    var titleIn = bookcheckEl(panel, ids, "title");
    var authorIn = bookcheckEl(panel, ids, "author");
    var lookupBtn = bookcheckEl(panel, ids, "lookup");
    var statusEl = bookcheckEl(panel, ids, "status");
    var lookupRowEl = statusEl ? statusEl.closest(".catalog-lookup-row") : null;
    var chaseLoader = createBookcheckChaseLoader(statusEl, lookupRowEl);
    var matchBox = bookcheckEl(panel, ids, "matchBox");
    var matchLead = bookcheckEl(panel, ids, "matchLead");
    var matchList = bookcheckEl(panel, ids, "matchList");
    var verdictBox = bookcheckEl(panel, ids, "verdict");
    var seriesNoteEl = bookcheckEl(panel, ids, "seriesNote");
    var wikiNoteEl = bookcheckEl(panel, ids, "wikiNote");
    var wikidataNoteEl = bookcheckEl(panel, ids, "wikidataNote");

    var catalogMeta = {
      hintTier: null,
      hintDetail: null,
      agentFlag: false,
      familyPortrayal: null,
      culturalRepresentation: null,
      faithInStory: null,
      parentNote: null,
      authorOtherWorks: null,
      deityComfort: null,
      hintSignals: [],
      hintFamilyAction: "",
      familyReport: null,
      hadWikipedia: false,
      wikipedia: null,
      wikidata: null,
      matchedTitle: "",
      matchedAuthor: "",
      coverUrl: "",
      lastDoc: null,
      vetSource: null,
      aiStaging: null,
      aiScanOk: false,
      aiSeriesNote: "",
      aiThemes: [],
      aiLgbtqDenied: false,
      aiLgbtqPresent: false,
      aiScanMeta: null,
      fanserviceNotChecked: false,
      lookupLogTitle: "",
      lookupLogAuthor: "",
      lookupRecorded: false,
      ownerTesting: !!opts.ownerTesting,
      fromScanner: false,
      compactReport: false,
      lookupGen: 0,
      enrichPending: false,
      earlyAiPromise: null,
      lookupAiStartedAt: 0,
      aiScanTimedOut: false,
    };

    var lookupGenCounter = 0;
    var EXTERNAL_HINT_TIMEOUT_MS = 2500;
    var AI_THEME_SCAN_TIMEOUT_MS = 14000;
    var AI_THEME_SCAN_MIN_WAIT_MS = 5000;

    function promiseWithTimeout(promise, ms, fallback) {
      return new Promise(function (resolve) {
        var settled = false;
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          resolve(fallback);
        }, ms);
        Promise.resolve(promise)
          .then(function (val) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(val);
          })
          .catch(function () {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(fallback);
          });
      });
    }

    function isCurrentLookup(gen) {
      return gen === catalogMeta.lookupGen;
    }

    function releaseLookupBtn() {
      if (lookupBtn) lookupBtn.disabled = false;
    }

    var Policy = global.HalalitFamilyShelfPolicy;

    function lookupLogTitleAuthor(title, author, meta) {
      meta = meta || catalogMeta;
      var logTitle = (meta && meta.lookupLogTitle) || title || "";
      var logAuthor = meta && meta.lookupLogAuthor != null ? meta.lookupLogAuthor : author || "";
      var VSlog = global.HalalitBookcheckVetSource;
      if (VSlog && typeof VSlog.canonicalBarcodeBook === "function") {
        var canon = VSlog.canonicalBarcodeBook(logTitle, logAuthor);
        if (canon) {
          if (canon.title) logTitle = canon.title;
          if (canon.author) logAuthor = canon.author;
        }
      }
      var Runtime = global.HalalitOwnerVetsRuntime;
      if (Runtime && typeof Runtime.findEntry === "function" && logTitle) {
        var vet = Runtime.findEntry(logTitle, logAuthor || "");
        if (vet && vet.author) logAuthor = vet.author;
      }
      return { title: logTitle, author: logAuthor || "" };
    }

    function recordLookupForOwner(title, author, signalOpts) {
      if (catalogMeta.ownerTesting) {
        if (catalogMeta.fromScanner) maybeAddOwnerScannedFromScanner(title, author);
        return Promise.resolve();
      }
      signalOpts = signalOpts || {};
      var Config = global.HalalitBookcheckConfig;
      var url = Config && typeof Config.lookupRecordUrl === "function" ? Config.lookupRecordUrl() : "";
      if (!url || !global.fetch) return Promise.resolve();
      var log = lookupLogTitleAuthor(title, author);
      if (!log.title) return Promise.resolve();

      var Store = global.HalalitAccountStorage;
      var ownerScan =
        !!catalogMeta.fromScanner &&
        Store &&
        typeof Store.isOwner === "function" &&
        Store.isOwner();
      if (ownerScan) {
        maybeAddOwnerScannedFromScanner(log.title, log.author);
      }

      var already = !!catalogMeta.lookupRecorded;
      catalogMeta.lookupRecorded = true;
      var body = {
        title: log.title,
        author: log.author,
        enteredTitle: catalogMeta.lookupLogTitle || log.title,
        enteredAuthor: catalogMeta.lookupLogAuthor || "",
        ownerTesting: !!catalogMeta.ownerTesting,
        fromScanner: !!catalogMeta.fromScanner,
      };
      if (signalOpts.summary || signalOpts.autoReject || signalOpts.themes || signalOpts.bucket || signalOpts.explainers) {
        if (signalOpts.summary) body.summary = signalOpts.summary;
        if (signalOpts.bucket) body.bucket = signalOpts.bucket;
        if (signalOpts.themes) body.themes = signalOpts.themes;
        if (signalOpts.explainers) body.explainers = signalOpts.explainers;
        body.autoReject = !!signalOpts.autoReject;
      }
      var postUrl = url;
      var signalOnly = already && (signalOpts.summary || signalOpts.autoReject || signalOpts.themes);
      if (signalOnly && Config && typeof Config.lookupSignalUrl === "function") {
        postUrl = Config.lookupSignalUrl();
      } else if (signalOnly) {
        postUrl = url.replace(/\/lookup\/record\/?$/, "/lookup/signal");
      } else if (already) {
        return Promise.resolve();
      }
      return global
        .fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        })
        .catch(function () {})
        .then(function () {});
    }

    function maybeAddOwnerScannedFromScanner(title, author) {
      if (!catalogMeta.fromScanner) return;
      if (catalogMeta.ownerScannedTbrAttempted) return;
      title = String(title || "").trim();
      if (!title) return;
      author = String(author || "").trim();
      var Store = global.HalalitAccountStorage;
      var isOwner =
        (Store && typeof Store.isOwner === "function" && Store.isOwner()) ||
        !!catalogMeta.ownerTesting;
      if (!isOwner) return;
      var Shelf = global.HalalitOwnerShelfScanner;
      if (!Shelf || typeof Shelf.addScannedTbr !== "function") return;
      if (typeof Shelf.isSettledTitle === "function" && Shelf.isSettledTitle(title, author)) {
        return;
      }
      catalogMeta.ownerScannedTbrAttempted = true;
      Shelf.addScannedTbr([{ title: title, author: author }], "scroll").catch(function () {});
    }

    function ownerSignalFromCatalogMeta(title, author) {
      var autoReject = false;
      var explainers = [];
      var Report = global.HalalitBookcheckReport;
      if (catalogMeta.familyReport && Report && typeof Report.autoRejectionSummary === "function") {
        var ar = Report.autoRejectionSummary(catalogMeta.familyReport, {
          tier: catalogMeta.hintTier,
          detail: catalogMeta.hintDetail,
          agentFlag: !!catalogMeta.agentFlag,
        });
        if (ar && ar.status === "reject") {
          autoReject = true;
          explainers = ar.explainers || ar.reasons || [];
        }
      }
      var themes = (catalogMeta.aiThemes || []).map(function (t) {
        return {
          id: t && t.id,
          present: !!(t && t.present),
          brief: t && t.brief ? String(t.brief) : "",
        };
      });
      var summary = "";
      if (autoReject && explainers.length) {
        summary = "HalaLit flagged: " + explainers.slice(0, 3).join("; ") + ".";
      } else if (themes.length) {
        var hard = {
          lgbtq: "LGBTQ themes in reviews/scans",
          adult_romance: "adult romance",
          illegitimate_children: "plot centered on illegitimate children",
          romanticized_crime: "glorified toxic or criminal behavior",
          group_demonization: "group demonization",
          pro_colonial_narrative: "pro-colonial narrative",
          crude_profanity: "harsh/crude profanity",
        };
        var labels = [];
        for (var i = 0; i < themes.length; i++) {
          var row = themes[i];
          if (!row || !row.present || !hard[row.id]) continue;
          labels.push(hard[row.id]);
        }
        if (labels.length) {
          summary = "HalaLit scanners found: " + labels.join("; ") + ".";
          autoReject = true;
        }
      }
      return {
        summary: summary,
        autoReject: autoReject,
        themes: themes,
        explainers: explainers,
        bucket: autoReject ? "bookcheck" : "tbr",
      };
    }

    function resetUi() {
      var keepOwnerTesting = !!opts.ownerTesting || !!catalogMeta.ownerTesting;
      catalogMeta = {
        hintTier: null,
        hintDetail: null,
        agentFlag: false,
        familyPortrayal: null,
        deityComfort: null,
        hintSignals: [],
        hintFamilyAction: "",
        familyReport: null,
        hadWikipedia: false,
        wikipedia: null,
        wikidata: null,
        matchedTitle: "",
        matchedAuthor: "",
        coverUrl: "",
        lastDoc: null,
        vetSource: null,
        aiStaging: null,
        aiScanOk: false,
        aiSeriesNote: "",
        aiThemes: [],
        aiLgbtqDenied: false,
        aiLgbtqPresent: false,
        fanserviceNotChecked: false,
        lookupLogTitle: "",
        lookupLogAuthor: "",
        lookupRecorded: false,
        ownerTesting: keepOwnerTesting,
        fromScanner: false,
        compactReport: false,
        enrichPending: false,
        earlyAiPromise: null,
        lookupAiStartedAt: 0,
        aiScanTimedOut: false,
      };
      if (matchBox) {
        matchBox.classList.remove("is-visible");
        if (matchLead) matchLead.textContent = "";
        if (matchList) matchList.innerHTML = "";
      }
      if (verdictBox) {
        verdictBox.hidden = true;
        verdictBox.innerHTML = "";
        verdictBox.className = "bookcheck-verdict";
      }
      if (seriesNoteEl) {
        seriesNoteEl.hidden = true;
        seriesNoteEl.innerHTML = "";
      }
      if (statusEl) statusEl.textContent = "";
      if (chaseLoader) chaseLoader.hide();
      if (wikiNoteEl) {
        wikiNoteEl.hidden = true;
        wikiNoteEl.innerHTML = "";
      }
      if (wikidataNoteEl) {
        wikidataNoteEl.hidden = true;
        wikidataNoteEl.innerHTML = "";
      }
    }

    function showWikiNote(wiki) {
      if (!wikiNoteEl || !wiki || !wiki.text) return;
      var html = "<strong>Wikipedia</strong> (verify yourself";
      if (wiki.plot) html += "; plot section scanned for all Halalit shelf themes the blurb may omit";
      html += "): ";
      if (wiki.intro) {
        var intro = wiki.intro.length > 220 ? wiki.intro.slice(0, 217) + "…" : wiki.intro;
        html += "<em>Intro:</em> " + escapeHtml(intro);
      }
      if (wiki.plot) {
        var plot = wiki.plot.length > 280 ? wiki.plot.slice(0, 277) + "…" : wiki.plot;
        html +=
          (wiki.intro ? " <em>" + escapeHtml(wiki.plotSectionTitle || "Plot") + ":</em> " : "") +
          escapeHtml(plot);
      }
      if (!wiki.intro && !wiki.plot) {
        var excerpt = wiki.text.length > 320 ? wiki.text.slice(0, 317) + "…" : wiki.text;
        html += escapeHtml(excerpt);
      }
      html +=
        ' <a href="' +
        escapeHtml(wiki.url) +
        '" target="_blank" rel="noopener noreferrer">Open “' +
        escapeHtml(wiki.pageTitle) +
        "”</a>. May be wrong or spoiler-heavy.";
      wikiNoteEl.hidden = false;
      wikiNoteEl.innerHTML = html;
    }

    function showWikidataNote(wd) {
      if (!wikidataNoteEl || !wd) return;
      var html = "<strong>Wikidata</strong> (CC0 linked data): “" + escapeHtml(wd.itemLabel) + "”";
      if (wd.itemDescription) html += " — " + escapeHtml(wd.itemDescription);
      if (wd.themeHits && wd.themeHits.length) {
        html += ". <strong>Shelf themes on this item:</strong> ";
        var parts = [];
        for (var i = 0; i < wd.themeHits.length && i < 6; i++) {
          parts.push(wd.themeHits[i].label);
        }
        html += escapeHtml(parts.join(" · "));
      } else if (wd.genreLabels && wd.genreLabels.length) {
        html += ". <strong>Linked labels:</strong> " + escapeHtml(wd.genreLabels.slice(0, 6).join(" · "));
      } else {
        html += ". No Halalit shelf themes matched on this Wikidata item.";
      }
      html +=
        ' <a href="' +
        escapeHtml(wd.url) +
        '" target="_blank" rel="noopener noreferrer">View ' +
        escapeHtml(wd.qid) +
        "</a>.";
      wikidataNoteEl.hidden = false;
      wikidataNoteEl.innerHTML = html;
    }

    function tierRank(tier) {
      if (tier === "flag_review") return 4;
      if (tier === "deity_comfort") return 3;
      if (tier === "teen_caution") return 3;
      if (tier === "verified_clean") return 3;
      if (tier === "preview_caution") return 2;
      if (tier === "user_discretion") return 2;
      if (tier === "fanservice_caution") return 2;
      if (tier === "ai_likely_reject") return 2;
      if (tier === "ai_manual_review") return 2;
      if (tier === "ai_likely_pass") return 1;
      if (tier === "unclear" || tier === "not_verified") return 2;
      if (tier === "likely_youth") return 2;
      return 0;
    }

    function strongerHint(a, b) {
      return tierRank(a.tier) >= tierRank(b.tier) ? a : b;
    }

    function syncAiStagingMeta(title, author) {
      var VS = global.HalalitBookcheckVetSource;
      catalogMeta.aiStaging = null;
      if (!VS || typeof VS.resolveHandVetHint !== "function") return;
      if (VS.resolveHandVetHint(title, author)) return;
      if (typeof VS.resolveAiStagingHint === "function") {
        catalogMeta.aiStaging = VS.resolveAiStagingHint(title, author);
      }
    }

    function applyVetSourceMeta(title, author, doc) {
      var VS = global.HalalitBookcheckVetSource;
      if (!VS || typeof VS.resolveVetSource !== "function") return;
      syncAiStagingMeta(title, author);
      var useDoc = doc || catalogMeta.lastDoc;
      var isGraphic =
        typeof VS.titleLooksGraphic === "function" && VS.titleLooksGraphic(title, author, useDoc);
      catalogMeta.fanserviceNotChecked =
        isGraphic &&
        catalogMeta.hintTier !== "verified_clean" &&
        catalogMeta.hintTier !== "fanservice_caution";
      catalogMeta.vetSource = VS.resolveVetSource(title, author, catalogMeta.hintTier, {
        aiScanOk: !!catalogMeta.aiScanOk,
        aiStaging: catalogMeta.aiStaging,
      });
    }

    function mergeAiIntoHint(hint, aiResult, doc, supplementPack, enteredTitle, enteredAuthor) {
      var nextHint = hint;
      var AI = global.HalalitBookcheckAi;
      if (aiResult && aiResult.ok && AI && hint && hint.ownerAiThemeAbsent) {
        if (typeof AI.filterAiResultForOwnerAbsent === "function") {
          aiResult = AI.filterAiResultForOwnerAbsent(aiResult, hint.ownerAiThemeAbsent);
        }
      }
      if (!aiResult || !aiResult.ok || !AI) return nextHint;
      catalogMeta.aiScanOk = true;
      catalogMeta.aiSeriesNote = aiResult.seriesNote || "";
      catalogMeta.aiThemes =
        typeof AI.presentThemeBriefs === "function" ? AI.presentThemeBriefs(aiResult) : [];
      catalogMeta.aiLgbtqDenied =
        typeof AI.aiLgbtqThemeDenied === "function" ? AI.aiLgbtqThemeDenied(aiResult) : false;
      catalogMeta.aiLgbtqPresent =
        typeof AI.aiLgbtqThemePresent === "function" ? AI.aiLgbtqThemePresent(aiResult) : false;
      catalogMeta.aiScanMeta = {
        reviewSnippetCount: aiResult.reviewSnippetCount || 0,
        reviewSearchUsed: !!aiResult.reviewSearchUsed,
        geminiOk: !!aiResult.geminiOk,
        claudeOk: !!aiResult.claudeOk,
        claudeSkipped: !!aiResult.claudeSkipped,
        reviewSearchError: aiResult.reviewSearchError || "",
      };
      var aiText = AI.buildAiSupplementText(aiResult);
      if (aiText && doc) {
        var blobIn = ((supplementPack && supplementPack.combined) || "") + " " + aiText;
        nextHint = strongerHint(inferHint(doc, blobIn), hint);
      } else if (aiText) {
        nextHint = strongerHint(
          inferHint(
            {
              title: enteredTitle,
              author_name: enteredAuthor
                ? enteredAuthor.split(/\s*,\s*/).map(function (s) {
                    return s.trim();
                  }).filter(Boolean)
                : [],
            },
            aiText
          ),
          hint
        );
      }
      nextHint.signals = AI.appendAiSignals(nextHint.signals, aiResult);
      if (hint && hint.ownerAiThemeAbsent && typeof AI.filterAiSignalsForOwnerAbsent === "function") {
        nextHint.signals = AI.filterAiSignalsForOwnerAbsent(nextHint.signals, hint.ownerAiThemeAbsent);
      }
      var Pol = global.HalalitFamilyShelfPolicy;
      if (Pol && typeof Pol.reconcileHintLgbtqWithAiScan === "function") {
        nextHint = Pol.reconcileHintLgbtqWithAiScan(
          nextHint,
          aiResult,
          doc,
          supplementPack && supplementPack.combined ? supplementPack.combined : ""
        );
      }
      nextHint.familyAction =
        Pol && typeof Pol.familyActionLine === "function"
          ? Pol.familyActionLine(nextHint.tier, nextHint.signals || [], enteredTitle)
          : nextHint.familyAction;
      return nextHint;
    }

    function aiThemeScanConfigured() {
      var Config = global.HalalitBookcheckConfig;
      var AI = global.HalalitBookcheckAi;
      var url = Config && typeof Config.aiThemeScanUrl === "function" ? Config.aiThemeScanUrl() : "";
      return !!(AI && typeof AI.fetchThemeScan === "function" && url);
    }

    function aiScanFailedNeedsRetry(aiResult, preHint, enteredTitle, enteredAuthor) {
      if (!aiThemeScanConfigured()) return false;
      if (handVetHintFor(enteredTitle, enteredAuthor)) return false;
      if (isSettledHandHint(preHint, enteredTitle, enteredAuthor)) return false;
      if (aiResult && aiResult.ok) return false;
      if (aiResult && aiResult.error === "ai_unconfigured") return false;
      return true;
    }

    function showAiScanTimeoutVerdict(title, author, aiResult) {
      if (!verdictBox) return;
      var experienced = isExperiencedBookcheckUser();
      var err = aiResult && aiResult.error;
      var headline = experienced
        ? "Theme scan timed out — try again."
        : "Theme scan didn't finish in time.";
      var body = experienced
        ? "Halalit didn't get AI theme results yet. Tap Check again — catalog-only isn't shown as a finished answer here."
        : "The theme scanner is still warming up or the connection was slow. Tap <strong>Check this title</strong> again in a moment. Halalit won't show a catalog-only \"we don't know\" answer when a theme scan was expected.";
      verdictBox.className = "bookcheck-verdict bookcheck-verdict--wait";
      verdictBox.hidden = false;
      verdictBox.innerHTML =
        '<p class="bookcheck-vet-banner bookcheck-vet-banner--ai-wait muted"><strong>' +
        escapeHtml(headline) +
        "</strong></p>" +
        '<p class="bookcheck-verdict__body">' +
        body +
        '</p><button type="button" class="import-btn bookcheck-retry-scan-btn">Check again</button>';
      var retryBtn = verdictBox.querySelector(".bookcheck-retry-scan-btn");
      if (retryBtn) {
        retryBtn.onclick = function () {
          runLookup();
        };
      }
      if (statusEl) {
        statusEl.textContent =
          err === "network_error"
            ? "Theme scan couldn't reach the server — try again."
            : "Theme scan timed out — try again.";
      }
      if (catalogMeta.fromScanner) scrollScannerResultIntoView();
    }

    function finishAiScanTimeout(doc, ttl, auth, enteredTitle, enteredAuthor, wiki, wd, aiResult) {
      catalogMeta.enrichPending = false;
      catalogMeta.lastDoc = doc || null;
      catalogMeta.matchedTitle = ttl || "";
      catalogMeta.matchedAuthor = auth || "";
      catalogMeta.aiScanOk = false;
      catalogMeta.aiScanTimedOut = true;
      catalogMeta.hintTier = null;
      catalogMeta.hintDetail = null;
      catalogMeta.familyReport = null;
      catalogMeta.vetSource = null;
      if (wiki && wiki.text) showWikiNote(wiki);
      if (wd && wd.scanText) showWikidataNote(wd);
      function revealTimeout() {
        showAiScanTimeoutVerdict(enteredTitle, enteredAuthor, aiResult);
        recordLookupForOwner(enteredTitle, enteredAuthor);
        finishEnrichStatus(aiResult);
        releaseLookupBtn();
      }
      if (chaseLoader && chaseLoader.isVisible()) {
        chaseLoader.pounceAndHide(revealTimeout);
      } else {
        revealTimeout();
      }
    }

    function finishEnrichStatus(aiResult) {
      if (!statusEl) return;
      if (aiResult && aiResult.error === "ai_unconfigured") {
        statusEl.textContent = "Catalog done—AI theme scan is not set up on the server yet.";
      } else if (catalogMeta.fromScanner && !(aiResult && aiResult.ok)) {
        statusEl.textContent =
          "Bookcheck finished, but Google theme scan did not run — the server may be offline or busy. Try again in a moment.";
      } else if (catalogMeta.aiScanOk) {
        statusEl.textContent = "Lookup complete.";
      } else {
        statusEl.textContent = "Lookup complete.";
      }
    }

    function startEarlyAiScan(title, author) {
      var AI = global.HalalitBookcheckAi;
      if (!AI || typeof AI.fetchThemeScan !== "function" || !aiThemeScanConfigured()) return;
      var VS = global.HalalitBookcheckVetSource;
      var isGraphic =
        VS && typeof VS.titleLooksGraphic === "function" && VS.titleLooksGraphic(title, author, null);
      catalogMeta.lookupAiStartedAt = Date.now();
      catalogMeta.earlyAiPromise = AI.fetchThemeScan(title, author, isGraphic, {
        fromScanner: !!catalogMeta.fromScanner,
      });
    }

    function mergeEnrichedHint(doc, ttl, auth, preHint, olPack, wiki, wd, aiResult, enteredTitle, enteredAuthor) {
      var combined = (olPack && olPack.combined) || "";
      var hadWiki = !!(wiki && wiki.text);
      if (hadWiki) combined += (combined ? " " : "") + wiki.text;
      if (wd && wd.scanText) combined += (combined ? " " : "") + wd.scanText;
      var hint = preHint;
      if (combined.trim()) {
        hint = doc
          ? inferHint(doc, combined)
          : inferHint(
              {
                title: enteredTitle,
                author_name: enteredAuthor
                  ? enteredAuthor.split(/\s*,\s*/).map(function (s) {
                      return s.trim();
                    }).filter(Boolean)
                  : [],
              },
              combined
            );
      }
      hint = strongerHint(hint, preHint);
      hint = pinHandVetHint(hint, enteredTitle, enteredAuthor, ttl, auth);
      catalogMeta.aiScanOk = !!(aiResult && aiResult.ok);
      if (!catalogMeta.aiScanOk) catalogMeta.aiSeriesNote = "";
      if (olPack) olPack.combined = combined;
      hint = mergeAiIntoHint(hint, aiResult, doc, olPack, enteredTitle, enteredAuthor);
      return pinHandVetHint(hint, enteredTitle, enteredAuthor, ttl, auth);
    }

    function enrichHintsAndFinish(doc, ttl, auth, preHint) {
      var gen = catalogMeta.lookupGen;
      catalogMeta.enrichPending = true;
      var Wiki = global.HalalitWikipediaShelfHint;
      var WD = global.HalalitWikidataShelfHint;
      var AI = global.HalalitBookcheckAi;
      var qTitle = ttl || (titleIn && titleIn.value) || "";
      var qAuth = auth || (authorIn && authorIn.value) || "";
      var enteredTitle = titleIn ? String(titleIn.value || "").trim() : qTitle;
      var enteredAuthor = authorIn ? String(authorIn.value || "").trim() : qAuth;

      if (statusEl) statusEl.textContent = "Checking themes…";
      if (chaseLoader && !chaseLoader.isVisible()) chaseLoader.start("themes");
      else if (chaseLoader) chaseLoader.setPhase("themes");

      var olP = promiseWithTimeout(
        fetchCatalogSupplement(doc),
        EXTERNAL_HINT_TIMEOUT_MS,
        { combined: "", description: "" }
      );
      var wikiP =
        Wiki && typeof Wiki.fetchShelfHint === "function"
          ? promiseWithTimeout(Wiki.fetchShelfHint(qTitle, qAuth, { fast: true }), EXTERNAL_HINT_TIMEOUT_MS, null)
          : Promise.resolve(null);
      var wdP =
        WD && typeof WD.fetchShelfHint === "function"
          ? promiseWithTimeout(WD.fetchShelfHint(qTitle, qAuth, { fast: true }), EXTERNAL_HINT_TIMEOUT_MS, null)
          : Promise.resolve(null);
      var aiStarted = catalogMeta.lookupAiStartedAt || Date.now();
      var aiBudget = Math.max(
        AI_THEME_SCAN_MIN_WAIT_MS,
        AI_THEME_SCAN_TIMEOUT_MS - (Date.now() - aiStarted)
      );
      var aiP =
        catalogMeta.earlyAiPromise ||
        (AI && typeof AI.fetchThemeScan === "function" && aiThemeScanConfigured()
          ? promiseWithTimeout(
              AI.fetchThemeScan(
                enteredTitle,
                enteredAuthor,
                global.HalalitBookcheckVetSource &&
                  typeof global.HalalitBookcheckVetSource.titleLooksGraphic === "function" &&
                  global.HalalitBookcheckVetSource.titleLooksGraphic(ttl || qTitle, auth || qAuth, doc),
                { fromScanner: !!catalogMeta.fromScanner }
              ),
              aiBudget,
              { ok: false, error: "timeout" }
            )
          : Promise.resolve(null));
      catalogMeta.earlyAiPromise = null;

      Promise.all([olP, wikiP, wdP, aiP]).then(function (parts) {
        if (!isCurrentLookup(gen)) return;
        var olPack = parts[0] || { combined: "", description: "" };
        var wiki = parts[1];
        var wd = parts[2];
        var aiResult = parts[3];
        var hadWiki = !!(wiki && wiki.text);
        if (hadWiki) showWikiNote(wiki);
        if (wd && wd.scanText) showWikidataNote(wd);
        catalogMeta.wikipedia = wiki;
        catalogMeta.wikidata = wd;
        if (aiScanFailedNeedsRetry(aiResult, preHint, enteredTitle, enteredAuthor)) {
          finishAiScanTimeout(doc, ttl, auth, enteredTitle, enteredAuthor, wiki, wd, aiResult);
          recordBookcheckEnrichComplete();
          syncBookcheckAiNotice(panel);
          return;
        }
        var hint = mergeEnrichedHint(
          doc,
          ttl,
          auth,
          preHint,
          olPack,
          wiki,
          wd,
          aiResult,
          enteredTitle,
          enteredAuthor
        );
        catalogMeta.enrichPending = false;
        finishApplyDoc(doc, ttl, auth, hint, olPack, hadWiki, wiki, wd);
        finishEnrichStatus(aiResult);
        recordBookcheckEnrichComplete();
        syncBookcheckAiNotice(panel);
        releaseLookupBtn();
      });
    }

    function showSeriesNote(title, author) {
      if (!seriesNoteEl) return;
      var SE = global.HalalitSeriesExpectation;
      if (!SE || typeof SE.match !== "function" || typeof SE.line !== "function") {
        seriesNoteEl.hidden = true;
        seriesNoteEl.innerHTML = "";
        return;
      }
      var ent = SE.match(title, author);
      if (!ent || (typeof SE.isDismissed === "function" && SE.isDismissed(ent.id))) {
        seriesNoteEl.hidden = true;
        seriesNoteEl.innerHTML = "";
        return;
      }
      seriesNoteEl.hidden = false;
      seriesNoteEl.innerHTML =
        '<div class="series-expectation-strip__item">' +
        "<span class=\"series-expectation-strip__text\"><strong>Series · " +
        escapeHtml(ent.label) +
        "</strong> — " +
        escapeHtml(SE.line("before", ent)) +
        "</span>" +
        '<button type="button" class="series-expectation-strip__dismiss" data-dismiss-expectation="' +
        escapeHtml(ent.id) +
        '" aria-label="Dismiss ' +
        escapeHtml(ent.label) +
        ' heads-up">×</button></div>';
      var dismissBtn = seriesNoteEl.querySelector("[data-dismiss-expectation]");
      if (dismissBtn) {
        dismissBtn.onclick = function () {
          if (typeof SE.dismissId === "function") SE.dismissId(ent.id);
          seriesNoteEl.hidden = true;
          seriesNoteEl.innerHTML = "";
        };
      }
    }

    function maybeShowOwnerReviewPending(title, author, v, meta) {
      if (catalogMeta.ownerTesting) return;
      if (!verdictBox || verdictBox.hidden || !v || v.kind === "no") return;
      var Ui = global.HalalitOwnerVetUi;
      if (Ui && typeof Ui.isHandSettled === "function" && Ui.isHandSettled(title, author)) return;
      var vs = meta.vetSource || "";
      if (vs === "hand_vetted" || vs === "owner_rejected" || vs.indexOf("ai_") === 0) return;
      if (meta.familyReport && global.HalalitBookcheckReport) {
        var ar = global.HalalitBookcheckReport.autoRejectionSummary(meta.familyReport, {
          tier: meta.hintTier,
          detail: meta.hintDetail,
          agentFlag: !!meta.agentFlag,
        });
        if (ar && ar.status === "reject") return;
      }
      var Config = global.HalalitBookcheckConfig;
      if (!Config || typeof Config.ownerReviewPendingUrl !== "function") return;

      function insertPendingNote(html) {
        if (!verdictBox || verdictBox.hidden) return;
        var old = verdictBox.querySelector(".bookcheck-owner-review-pending");
        if (old) old.remove();
        var note = document.createElement("p");
        note.className = "bookcheck-owner-review-pending muted";
        note.setAttribute("role", "note");
        note.innerHTML = html;
        var headline = verdictBox.querySelector(".bookcheck-verdict__headline");
        if (headline && headline.parentNode) {
          headline.parentNode.insertBefore(note, headline.nextSibling);
        } else {
          verdictBox.appendChild(note);
        }
      }

      recordLookupForOwner(title, author, ownerSignalFromCatalogMeta(title, author)).then(function () {
        var log = lookupLogTitleAuthor(title, author, meta);
        var url =
          Config.ownerReviewPendingUrl() +
          "?title=" +
          encodeURIComponent(log.title || "") +
          "&author=" +
          encodeURIComponent(log.author || "");
        return fetch(url, { credentials: "same-origin" }).then(function (res) {
          return res.ok ? res.json() : null;
        });
      }).then(function (data) {
        if (!data || !data.pending) return;
        if (data.kind === "popular") {
          insertPendingNote(
            isExperiencedBookcheckUser()
              ? "<strong>Hand vet in progress.</strong>"
              : "<strong>Hand vet in progress:</strong> The owner will soon examine this text and be able to confirm whether Halalit would recommend it."
          );
        } else {
          insertPendingNote(
            isExperiencedBookcheckUser()
              ? "Added to the owner’s hand-check list."
              : "The owner of the site has been informed and your search has been added to the list of books to hand-check."
          );
        }
      }).catch(function () {});
    }

    function aiScanQualityLineHtml(meta, experienced) {
      if (!experienced || !meta || !meta.aiScanOk || !meta.aiScanMeta) return "";
      var sm = meta.aiScanMeta;
      var parts = ["Scan: " + (sm.reviewSnippetCount || 0) + " review snippets"];
      parts.push("Gemini " + (sm.geminiOk ? "✓" : "✗"));
      if (!sm.claudeSkipped) {
        parts.push("Claude " + (sm.claudeOk ? "✓" : "✗"));
      }
      if (!sm.reviewSearchUsed && sm.reviewSearchError) {
        parts.push("web search unavailable");
      }
      return '<p class="bookcheck-scan-quality muted">' + escapeHtml(parts.join(" · ")) + "</p>";
    }

    function showVerdict(title, author) {
      if (!verdictBox) return;
      if (catalogMeta.enrichPending) return;
      applyCompactReportFlags();
      var experienced = isExperiencedBookcheckUser();
      var displayTier = displayHintTier(catalogMeta.hintTier);
      var blanket = experienced
        ? ""
        : pickContextBlanket(
            catalogMeta.lastDoc,
            catalogMeta.matchedTitle || title,
            catalogMeta.matchedAuthor || author,
            displayTier
          );
      var detailInLead =
        matchBox &&
        matchBox.classList.contains("is-visible") &&
        matchLead &&
        String(matchLead.textContent || "").trim().length > 0;
      var v = verdictFor(
        title,
        author,
        displayTier,
        catalogMeta.hintDetail,
        catalogMeta.matchedTitle,
        catalogMeta.matchedAuthor,
        catalogMeta.familyPortrayal,
        catalogMeta.deityComfort,
        blanket,
        catalogMeta.hintTier,
        {
          detailShownInMatchLead: detailInLead,
          signals: catalogMeta.hintSignals,
          familyAction: catalogMeta.hintFamilyAction,
          vetSource: catalogMeta.vetSource,
          experienced: experienced,
        }
      );
      var vetBanner = "";
      var VS = global.HalalitBookcheckVetSource;
      var autoReject = false;
      var ar = null;
      if (catalogMeta.familyReport && global.HalalitBookcheckReport) {
        ar =
          typeof global.HalalitBookcheckReport.autoRejectionSummary === "function"
            ? global.HalalitBookcheckReport.autoRejectionSummary(catalogMeta.familyReport, {
                tier: catalogMeta.hintTier,
                detail: catalogMeta.hintDetail,
                agentFlag: !!catalogMeta.agentFlag,
              })
            : null;
        autoReject = !!(ar && ar.status === "reject");
      }
      if (!autoReject && VS && typeof VS.bannerHtml === "function") {
        applyVetSourceMeta(title, author, catalogMeta.lastDoc);
        vetBanner = VS.bannerHtml(catalogMeta.vetSource, {
          fanserviceNotChecked: catalogMeta.fanserviceNotChecked,
          aiSeriesNote: catalogMeta.aiSeriesNote,
          experienced: experienced,
        });
      }
      var headline = v.headline;
      if (autoReject) {
        headline = "";
      } else if (catalogMeta.compactReport && catalogMeta.familyReport && global.HalalitBookcheckReport) {
        if (catalogMeta.vetSource === "hand_vetted" || catalogMeta.hintTier === "verified_clean") {
          headline = "Hand-checked — vetted";
        } else if (catalogMeta.hintTier === "user_discretion") {
          headline = "Hand-checked — your discretion";
        } else if (
          catalogMeta.hintTier === "fanservice_caution" ||
          catalogMeta.hintTier === "preview_caution" ||
          catalogMeta.hintTier === "deity_comfort"
        ) {
          headline = "Hand-checked — see note";
        } else if (catalogMeta.vetSource === "agent_flagged") {
          headline = "Halalit agent flag — not hand-read";
        } else if (catalogMeta.vetSource === "ai_staging_likely_reject") {
          headline = "AI likely rejection — not manually checked";
        } else if (catalogMeta.vetSource === "ai_staging_manual_review") {
          headline = "AI flagged for review — not hand-checked";
        } else if (catalogMeta.vetSource === "ai_staging_likely_pass") {
          headline = "AI likely okay — not hand-checked";
        } else if (catalogMeta.vetSource === "owner_rejected" || catalogMeta.hintTier === "flag_review") {
          headline = "Hand-flagged";
        } else if (catalogMeta.fanserviceNotChecked || catalogMeta.familyReport.isGraphic) {
          headline = "Preview panels first";
        } else if (catalogMeta.vetSource === "ai_themes") {
          headline = "AI scan — no hard-rule flags";
        } else if (catalogMeta.vetSource === "catalog_only") {
          headline = "AI scan unavailable — catalog only";
        } else {
          headline = "Not hand-read — hard rules look clear";
        }
      } else if (catalogMeta.compactReport) {
        if (catalogMeta.vetSource === "hand_vetted" || catalogMeta.hintTier === "verified_clean") {
          headline = "Hand-checked — vetted";
        } else if (catalogMeta.hintTier === "user_discretion") {
          headline = "Hand-checked — your discretion";
        } else if (catalogMeta.vetSource === "agent_flagged") {
          headline = "Halalit agent flag — not hand-read";
        } else if (catalogMeta.vetSource === "ai_staging_likely_reject") {
          headline = "AI likely rejection — not manually checked";
        } else if (catalogMeta.vetSource === "ai_staging_manual_review") {
          headline = "AI flagged for review — not hand-checked";
        } else if (catalogMeta.vetSource === "ai_staging_likely_pass") {
          headline = "AI likely okay — not hand-checked";
        } else if (catalogMeta.vetSource === "owner_rejected" || catalogMeta.hintTier === "flag_review") {
          headline = "Hand-flagged";
        } else if (catalogMeta.vetSource === "ai_themes") {
          headline =
            v.kind === "no"
              ? "AI flagged concerns — not hand-read"
              : "Not hand-read — no AI red flags";
        } else if (catalogMeta.vetSource === "catalog_only") {
          headline = "AI scan unavailable — catalog only";
        } else if (catalogMeta.hintTier === "fanservice_caution" || catalogMeta.hintTier === "preview_caution") {
          headline = "Hand-checked — preview first";
        } else {
          headline =
            v.kind === "no"
              ? "Likely not clean"
              : v.kind === "yes"
                ? "Hand-checked clean"
                : "Not hand-read yet";
        }
      }
      verdictBox.className = "bookcheck-verdict bookcheck-verdict--" + v.kind;
      verdictBox.hidden = false;
      var coverBlock = "";
      var CoverThumb = global.HalalitCoverThumb;
      var shelfOptsForCover = Policy ? bookcheckShelfOpts(Policy) : null;
      var allowCoverThumb =
        CoverThumb &&
        typeof CoverThumb.shouldShowCoverThumb === "function" &&
        CoverThumb.shouldShowCoverThumb(title, author, catalogMeta.hintTier, shelfOptsForCover);
      if (allowCoverThumb) {
        var coverUrl = catalogMeta.coverUrl;
        if (!coverUrl && catalogMeta.lastDoc && typeof CoverThumb.coverUrlFromDoc === "function") {
          coverUrl = CoverThumb.coverUrlFromDoc(catalogMeta.lastDoc) || "";
        }
        if (coverUrl && typeof CoverThumb.thumbHtml === "function") {
          coverBlock = CoverThumb.thumbHtml(coverUrl, catalogMeta.matchedTitle || title || "Book cover");
        }
      }
      verdictBox.innerHTML =
        vetBanner +
        coverBlock +
        (headline
          ? '<p class="bookcheck-verdict__headline">' + escapeHtml(headline) + "</p>"
          : "") +
        aiScanQualityLineHtml(catalogMeta, experienced) +
        (catalogMeta.familyReport && global.HalalitBookcheckReport
          ? global.HalalitBookcheckReport.renderHtml(catalogMeta.familyReport, {
              compact: catalogMeta.compactReport || autoReject,
              vetSource: catalogMeta.vetSource,
              experienced: experienced,
            })
          : verdictActionHtml(v, { hideFamilyAction: catalogMeta.compactReport || autoReject })) +
        (v.body &&
        !autoReject &&
        !(catalogMeta.familyReport && catalogMeta.familyReport.mode === "curated") &&
        !(
          experienced &&
          catalogMeta.familyReport &&
          catalogMeta.familyReport.mode === "catalog"
        )
          ? '<div class="bookcheck-verdict__body">' + formatNoteHtml(v.body) + "</div>"
          : "") +
        (v.contextBlanket && !autoReject
          ? "<p class=\"bookcheck-verdict__blanket muted\">" + escapeHtml(v.contextBlanket) + "</p>"
          : "") +
        (v.matchLine && !catalogMeta.compactReport && !autoReject
          ? "<p class=\"bookcheck-verdict__match muted\">" + v.matchLine + "</p>"
          : "");
      if (catalogMeta.compactReport) {
        if (seriesNoteEl) {
          seriesNoteEl.hidden = true;
          seriesNoteEl.innerHTML = "";
        }
      } else {
        if (wikiNoteEl && catalogMeta.wikipedia) {
          showWikiNote(catalogMeta.wikipedia);
        }
        if (wikidataNoteEl && catalogMeta.wikidata) {
          showWikidataNote(catalogMeta.wikidata);
        }
        showSeriesNote(title, author);
      }
      if (catalogMeta.fromScanner) {
        scrollScannerResultIntoView();
      }
      maybeShowOwnerReviewPending(title, author, v, catalogMeta);
      try {
        global.dispatchEvent(
          new CustomEvent("halalit-bookcheck-verdict", {
            detail: { title: title, author: author },
          })
        );
      } catch (eEvt) {}
    }

    function scrollScannerResultIntoView() {
      if (!verdictBox || verdictBox.hidden) return;
      function go() {
        try {
          verdictBox.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (eScroll) {
          verdictBox.scrollIntoView(true);
        }
        try {
          verdictBox.focus({ preventScroll: true });
        } catch (eFocus) {
          /* ignore */
        }
      }
      if (typeof global.requestAnimationFrame === "function") {
        global.requestAnimationFrame(function () {
          global.requestAnimationFrame(go);
        });
      } else {
        global.setTimeout(go, 0);
      }
    }

    function catalogHintLeadHtml(hint) {
      var showTier = displayHintTier(hint.tier);
      var cls =
        showTier === "verified_clean"
          ? "catalog-hint-ok"
          : showTier === "flag_review" || showTier === "teen_caution"
            ? "catalog-hint-warn"
            : showTier === "deity_comfort" ||
                showTier === "preview_caution" ||
                showTier === "fanservice_caution" ||
                showTier === "user_discretion"
              ? "catalog-hint-neutral"
            : showTier === "not_verified" || showTier === "unclear" || showTier === "likely_youth"
              ? "catalog-hint-neutral"
              : "";
      var html = '<div class="catalog-hint-lead ' + cls + '">' + formatNoteHtml(filterComfortNoteText(hint.detail)) + "</div>";
      if (hint.familyPortrayal && hint.familyPortrayal.detail) {
        html +=
          '<div class="catalog-hint-note"><strong>' +
          escapeHtml(hint.familyPortrayal.label || "Family is portrayed negatively") +
          "</strong>" +
          formatNoteHtml(hint.familyPortrayal.detail) +
          "</div>";
      }
      if (hint.mentalHealthComfort && hint.mentalHealthComfort.detail) {
        var mhDetail = filterComfortNoteText(hint.mentalHealthComfort.detail);
        if (mhDetail) {
          html +=
            '<div class="catalog-hint-note"><strong>' +
            escapeHtml(hint.mentalHealthComfort.label || "Mental-health comfort note") +
            "</strong>" +
            formatNoteHtml(mhDetail) +
            "</div>";
        }
      }
      if (hint.culturalRepresentation && hint.culturalRepresentation.detail && culturalNoteVisible()) {
        html +=
          '<div class="catalog-hint-note"><strong>' +
          escapeHtml(hint.culturalRepresentation.label || "Cultural misrepresentation") +
          "</strong>" +
          formatNoteHtml(hint.culturalRepresentation.detail) +
          "</div>";
      }
      if (hint.proColonialCaution && hint.proColonialCaution.detail) {
        html +=
          '<div class="catalog-hint-note"><strong>' +
          escapeHtml(hint.proColonialCaution.label || "Pro-colonial narrative (read with care)") +
          "</strong>" +
          formatNoteHtml(hint.proColonialCaution.detail) +
          "</div>";
      }
      if (hint.faithInStory && hint.faithInStory.detail) {
        html +=
          '<div class="catalog-hint-note"><strong>' +
          escapeHtml(hint.faithInStory.label || "Christian faith in the story (not deity/mythology)") +
          "</strong>" +
          formatNoteHtml(hint.faithInStory.detail) +
          "</div>";
      }
      if (hint.parentNote && hint.parentNote.detail) {
        html +=
          '<div class="catalog-hint-note"><strong>' +
          escapeHtml(hint.parentNote.label || "Notes for parents") +
          "</strong>" +
          formatNoteHtml(hint.parentNote.detail) +
          "</div>";
      }
      if (hint.authorOtherWorks && hint.authorOtherWorks.detail) {
        html +=
          '<div class="catalog-hint-note catalog-hint-note--warning"><strong>' +
          escapeHtml(hint.authorOtherWorks.label || "WARNING:") +
          "</strong>" +
          formatNoteHtml(hint.authorOtherWorks.detail) +
          "</div>";
      }
      if (hint.deityComfort && hint.deityComfort.detail) {
        html +=
          '<div class="catalog-hint-note"><strong>' +
          escapeHtml(hint.deityComfort.label || "Deity or mythology (comfort note)") +
          "</strong>" +
          formatNoteHtml(hint.deityComfort.detail) +
          "</div>";
      }
      return html;
    }

    function hasSoftRomanceForCompact(meta) {
      meta = meta || {};
      var signals = meta.hintSignals || [];
      for (var i = 0; i < signals.length; i++) {
        if (/romance or relationship|romantic tension|romantic subplot|crush|dating/i.test(String(signals[i] || ""))) {
          return true;
        }
      }
      if (/romantic tension|romance tags|romantic subplot|crush on|light romance|relationship thread/i.test(String(meta.hintDetail || ""))) {
        return true;
      }
      var themes = meta.aiThemes || [];
      for (var t = 0; t < themes.length; t++) {
        var th = themes[t];
        if (!th || !th.present) continue;
        if (th.id === "romantic_tension" || th.id === "adult_romance") return true;
      }
      var report = meta.familyReport;
      if (report && report.dimensions) {
        for (var d = 0; d < report.dimensions.length; d++) {
          var row = report.dimensions[d];
          if (!row) continue;
          if (row.id === "romantic_tension" || row.id === "romance" || row.id === "adult_romance") {
            if (row.status === "caution" || row.status === "concern") return true;
          }
          if (/romantic|romance|dating|crush/i.test(String(row.label || "") + " " + String(row.note || ""))) {
            if (row.status === "caution" || row.status === "concern") return true;
          }
        }
      }
      if (report && report.aiThemes) {
        for (var a = 0; a < report.aiThemes.length; a++) {
          var at = report.aiThemes[a];
          if (at && (at.id === "romantic_tension" || at.id === "adult_romance") && at.present !== false) return true;
        }
      }
      return false;
    }

    function applyCompactReportFlags() {
      if (hasSoftRomanceForCompact(catalogMeta)) {
        catalogMeta.compactReport = true;
      }
    }

    function finishApplyDoc(doc, ttl, auth, hint, supplementPack, hadWikipedia, wikipedia, wikidata) {
      catalogMeta.lastDoc = doc || null;
      catalogMeta.hintTier = hint.tier;
      catalogMeta.hintDetail = hint.detail;
      catalogMeta.agentFlag = !!hint.agentFlag;
      catalogMeta.familyPortrayal = hint.familyPortrayal || null;
      catalogMeta.culturalRepresentation = hint.culturalRepresentation || null;
      catalogMeta.proColonialCaution = hint.proColonialCaution || null;
      catalogMeta.faithInStory = hint.faithInStory || null;
      catalogMeta.parentNote = hint.parentNote || null;
      catalogMeta.authorOtherWorks = hint.authorOtherWorks || null;
      catalogMeta.deityComfort = hint.deityComfort || null;
      catalogMeta.hintSignals = hint.signals || [];
      catalogMeta.hintFamilyAction = hint.familyAction || "";
      catalogMeta.hadWikipedia = !!hadWikipedia;
      catalogMeta.wikipedia = wikipedia || catalogMeta.wikipedia;
      catalogMeta.wikidata = wikidata || catalogMeta.wikidata;
      var enteredTitle = titleIn ? String(titleIn.value || "").trim() : ttl;
      var enteredAuthor = authorIn ? String(authorIn.value || "").trim() : auth;
      applyVetSourceMeta(enteredTitle, enteredAuthor, doc);
      catalogMeta.familyReport = buildFamilyReport(
        enteredTitle,
        enteredAuthor,
        doc,
        hint,
        supplementPack,
        hadWikipedia,
        catalogMeta.wikipedia,
        catalogMeta.wikidata,
        {
          aiScanOk: catalogMeta.aiScanOk,
          fanserviceNotChecked: catalogMeta.fanserviceNotChecked,
          aiSeriesNote: catalogMeta.aiSeriesNote,
          aiThemes: catalogMeta.aiThemes || [],
          aiLgbtqDenied: !!catalogMeta.aiLgbtqDenied,
          aiLgbtqPresent: !!catalogMeta.aiLgbtqPresent,
        }
      );
      applyCompactReportFlags();
      catalogMeta.matchedTitle = ttl;
      catalogMeta.matchedAuthor = auth;
      var CoverMeta = global.HalalitCoverThumb;
      var PolicyCover = global.HalalitFamilyShelfPolicy;
      var shelfOptsCover = PolicyCover ? bookcheckShelfOpts(PolicyCover) : null;
      var mayShowCover =
        CoverMeta &&
        typeof CoverMeta.shouldShowCoverThumb === "function" &&
        CoverMeta.shouldShowCoverThumb(enteredTitle, enteredAuthor, catalogMeta.hintTier, shelfOptsCover);
      catalogMeta.coverUrl =
        mayShowCover && typeof CoverMeta.coverUrlFromDoc === "function" ? CoverMeta.coverUrlFromDoc(doc) || "" : "";
      if (matchBox && matchLead) {
        if (!catalogMeta.compactReport) {
          matchLead.innerHTML = catalogHintLeadHtml(hint);
          matchBox.classList.add("is-visible");
        } else if (matchBox) {
          matchBox.classList.remove("is-visible");
        }
        if (matchList) matchList.innerHTML = "";
      }
      function revealVerdict() {
        showVerdict(enteredTitle, enteredAuthor);
        recordLookupForOwner(enteredTitle, enteredAuthor, ownerSignalFromCatalogMeta(enteredTitle, enteredAuthor));
      }
      if (chaseLoader && chaseLoader.isVisible()) {
        chaseLoader.pounceAndHide(revealVerdict);
      } else {
        revealVerdict();
      }
    }

    function applyDoc(doc) {
      var ttl = normalizeOlTitle(doc);
      var auth = Array.isArray(doc.author_name) && doc.author_name.length ? doc.author_name.join(", ") : "";
      var enteredTitle = titleIn ? String(titleIn.value || "").trim() : "";
      var enteredAuthor = authorIn ? String(authorIn.value || "").trim() : "";
      var VSdoc = global.HalalitBookcheckVetSource;
      var handOnEntered = handVetHintFor(enteredTitle, enteredAuthor, ttl, auth);
      if (handOnEntered) {
        finishApplyDoc(doc, ttl, auth, handOnEntered, { combined: "", description: "" }, false, null, null);
        releaseLookupBtn();
        return;
      }
      var aiPreHint = null;
      if (VSdoc && typeof VSdoc.resolveAiStagingHint === "function") {
        aiPreHint = VSdoc.resolveAiStagingHint(enteredTitle, enteredAuthor);
      }
      if (titleIn && ttl && shouldSyncCatalogTitle(enteredTitle, ttl)) titleIn.value = ttl;
      var canonDoc =
        VSdoc && typeof VSdoc.canonicalBarcodeBook === "function"
          ? VSdoc.canonicalBarcodeBook(enteredTitle, enteredAuthor)
          : null;
      if (authorIn && auth) {
        if (
          canonDoc &&
          canonDoc.author &&
          (!enteredAuthor || authorScore(canonDoc.author, doc) >= authorScore(auth, doc))
        ) {
          authorIn.value = canonDoc.author;
        } else if (!enteredAuthor || authorScore(enteredAuthor, doc) >= 88) {
          authorIn.value = auth;
        }
      }
      var preHint = inferHint(doc);
      if (aiPreHint) {
        preHint = strongerHint(
          {
            tier: aiPreHint.tier,
            detail: aiPreHint.detail,
            signals: preHint.signals || [],
            familyAction: preHint.familyAction || "",
          },
          preHint
        );
      }
      if (isSettledHandHint(preHint, enteredTitle, enteredAuthor)) {
        finishApplyDoc(doc, ttl, auth, preHint, { combined: "", description: "" }, false, null, null);
        releaseLookupBtn();
        return;
      }
      enrichHintsAndFinish(doc, ttl, auth, preHint);
    }

    function pinHandVetHint(hint, title, author, altTitle, altAuthor) {
      var hand = handVetHintFor(title, author, altTitle, altAuthor);
      if (!hand) return hint;
      var merged = Object.assign({}, hand);
      if (hint) {
        if ((!merged.signals || !merged.signals.length) && hint.signals && hint.signals.length) {
          merged.signals = hint.signals;
        }
        var AI = global.HalalitBookcheckAi;
        if (
          merged.ownerAiThemeAbsent &&
          AI &&
          typeof AI.filterAiSignalsForOwnerAbsent === "function" &&
          merged.signals &&
          merged.signals.length
        ) {
          merged.signals = AI.filterAiSignalsForOwnerAbsent(merged.signals, merged.ownerAiThemeAbsent);
        }
        merged = mergeHandAdvisories(merged, title, author);
      }
      return merged;
    }

    function mergeHandAdvisories(hint, title, author) {
      var Policy = global.HalalitFamilyShelfPolicy;
      if (!Policy || !hint) return hint;
      var merged = Object.assign({}, hint);
      if (typeof Policy.parentNoteAdvisory === "function") {
        var pn = Policy.parentNoteAdvisory(title, author);
        if (pn) merged.parentNote = pn;
      }
      if (typeof Policy.faithInStoryAdvisory === "function") {
        var fs = Policy.faithInStoryAdvisory(title, author);
        if (fs) merged.faithInStory = fs;
      }
      if (typeof Policy.familyPortrayalAdvisory === "function") {
        var fp = Policy.familyPortrayalAdvisory(title, author);
        if (fp) merged.familyPortrayal = fp;
      }
      if (typeof Policy.mentalHealthComfortAdvisory === "function") {
        var mh = Policy.mentalHealthComfortAdvisory(title, author);
        if (mh) merged.mentalHealthComfort = mh;
      }
      if (typeof Policy.proColonialCautionAdvisory === "function") {
        var pc = Policy.proColonialCautionAdvisory(title, author);
        if (pc) merged.proColonialCaution = pc;
      }
      if (typeof Policy.culturalRepresentationAdvisory === "function") {
        var cr = Policy.culturalRepresentationAdvisory(title, author);
        if (cr) merged.culturalRepresentation = cr;
      }
      if (typeof Policy.authorOtherWorksAdvisory === "function") {
        var aw = Policy.authorOtherWorksAdvisory(title, author);
        if (aw) merged.authorOtherWorks = aw;
      }
      return merged;
    }

    function applyHandVetHint(handHint, ownTitle, ownAuthor) {
      handHint = mergeHandAdvisories(handHint, ownTitle, ownAuthor);
      catalogMeta.hintTier = handHint.tier;
      catalogMeta.hintDetail = handHint.detail;
      catalogMeta.hintSignals = handHint.signals || [];
      catalogMeta.hintFamilyAction = handHint.familyAction || "";
      catalogMeta.parentNote = handHint.parentNote || null;
      catalogMeta.familyReport = buildFamilyReport(
        ownTitle,
        ownAuthor,
        null,
        handHint,
        { combined: "", description: "" },
        false,
        null,
        null
      );
      applyCompactReportFlags();
      catalogMeta.aiScanOk = false;
      applyVetSourceMeta(ownTitle, ownAuthor, null);
      function revealHandVet() {
        showVerdict(ownTitle, ownAuthor);
        recordLookupForOwner(ownTitle, ownAuthor);
        if (statusEl) {
          statusEl.textContent =
            handHint.tier === "verified_clean"
              ? "Matched Halalit’s hand-verified list."
              : handHint.tier === "preview_caution"
                ? "Children’s comic or manga—preview recommended."
                : handHint.tier === "fanservice_caution"
                  ? "Hand-checked comic—lighter fanservice caution."
                  : handHint.tier === "deity_comfort"
                    ? "Catalog or notes mention deity or mythology (comfort note)."
                    : "Matched Halalit’s hand-checked rules.";
        }
        releaseLookupBtn();
      }
      if (chaseLoader && chaseLoader.isVisible()) {
        chaseLoader.pounceAndHide(revealHandVet);
      } else {
        revealHandVet();
      }
    }

    function runLookupCore() {
      var ownTitle = titleIn ? String(titleIn.value || "").trim() : "";
      var ownAuthor = authorIn ? String(authorIn.value || "").trim() : "";
      if (!ownTitle) {
        if (statusEl) statusEl.textContent = "Type a title first.";
        return;
      }
      lookupGenCounter += 1;
      var lookupGen = lookupGenCounter;
      var keepFromScanner = catalogMeta.fromScanner;
      var keepCompact = catalogMeta.compactReport;
      resetUi();
      catalogMeta.lookupGen = lookupGen;
      catalogMeta.fromScanner = keepFromScanner;
      catalogMeta.compactReport = keepCompact;
      catalogMeta.lookupLogTitle = ownTitle;
      catalogMeta.lookupLogAuthor = ownAuthor;
      catalogMeta.earlyAiPromise = null;
      catalogMeta.lookupAiStartedAt = 0;
      catalogMeta.aiScanTimedOut = false;
      if (lookupBtn) lookupBtn.disabled = true;
      if (statusEl) statusEl.textContent = "Searching catalog…";
      if (chaseLoader) chaseLoader.start("catalog");
      startEarlyAiScan(ownTitle, ownAuthor);
      var Policy = global.HalalitFamilyShelfPolicy;
      if (Policy && typeof Policy.hardExclusionDetailForTitle === "function") {
        var earlyDetail = Policy.hardExclusionDetailForTitle(ownTitle, ownAuthor);
        if (earlyDetail) {
          catalogMeta.hintTier = "flag_review";
          catalogMeta.hintDetail = earlyDetail;
          catalogMeta.hintSignals = [];
          catalogMeta.hintFamilyAction =
            typeof Policy.familyActionLine === "function"
              ? Policy.familyActionLine("flag_review", [], ownTitle)
              : "";
          catalogMeta.familyReport = buildFamilyReport(
            ownTitle,
            ownAuthor,
            null,
            { tier: "flag_review", detail: earlyDetail, signals: [], familyAction: catalogMeta.hintFamilyAction },
            { combined: "", description: "" },
            false,
            null,
            null
          );
          catalogMeta.aiScanOk = false;
          applyVetSourceMeta(ownTitle, ownAuthor, null);
          function revealHardExclusion() {
            showVerdict(ownTitle, ownAuthor);
            recordLookupForOwner(ownTitle, ownAuthor);
            if (statusEl) statusEl.textContent = "Matched Halalit’s never-recommend rules (hardest tier).";
            releaseLookupBtn();
          }
          if (chaseLoader && chaseLoader.isVisible()) {
            chaseLoader.pounceAndHide(revealHardExclusion);
          } else {
            revealHardExclusion();
          }
          return;
        }
      }
      var handHint = handVetHintFor(ownTitle, ownAuthor);
      if (handHint) {
        applyHandVetHint(handHint, ownTitle, ownAuthor);
        return;
      }
      var preCatalogHint = inferHint({
        title: ownTitle,
        author_name: ownAuthor ? ownAuthor.split(/\s*,\s*/).map(function (s) { return s.trim(); }).filter(Boolean) : [],
      });
      if (isSettledHandHint(preCatalogHint, ownTitle, ownAuthor)) {
        applyHandVetHint(preCatalogHint, ownTitle, ownAuthor);
        return;
      }
      var url = buildOpenLibraryQueryUrl(ownTitle, ownAuthor);
      if (!url) return;
      if (chaseLoader && !chaseLoader.isVisible()) chaseLoader.start("catalog");
      function finishLookupDocs(raw, fromFallback) {
        var pinPack = applyCatalogPinToRaw(raw, ownTitle, ownAuthor);
        raw = pinPack.docs;
        var refined = filterConfidentCatalogMatches(
          refineCatalogMatches(raw || [], ownTitle, ownAuthor),
          ownAuthor,
          ownTitle
        );
        if (!refined.length) {
          var noHitHint = inferHint({
            title: ownTitle,
            author_name: ownAuthor
              ? ownAuthor.split(/\s*,\s*/).map(function (s) {
                  return s.trim();
                }).filter(Boolean)
              : [],
          });
          var VSno = global.HalalitBookcheckVetSource;
          var aiNo =
            VSno && typeof VSno.resolveAiStagingHint === "function"
              ? VSno.resolveAiStagingHint(ownTitle, ownAuthor)
              : null;
          if (aiNo) {
            noHitHint = strongerHint(
              {
                tier: aiNo.tier,
                detail: aiNo.detail,
                signals: noHitHint.signals || [],
                familyAction: noHitHint.familyAction || "",
              },
              noHitHint
            );
          }
          enrichHintsAndFinish(null, ownTitle, ownAuthor, noHitHint);
          return;
        }
          if (shouldAutoPick(refined, ownAuthor)) {
            applyDoc(refined[0].doc);
            if (statusEl) statusEl.textContent = "Checking themes…";
            if (chaseLoader) chaseLoader.setPhase("themes");
            return;
          }
          if (chaseLoader) chaseLoader.hide();
          if (statusEl) statusEl.textContent = "A few different books share that name—pick the one you mean:";
          releaseLookupBtn();
          if (matchBox && matchLead && matchList) {
            matchLead.textContent = "These look like different books, not just duplicate editions:";
            matchBox.classList.add("is-visible");
            matchList.innerHTML = "";
            for (var i = 0; i < refined.length; i++) {
              (function (doc) {
                var li = document.createElement("li");
                var b = document.createElement("button");
                b.type = "button";
                b.textContent = matchButtonLabel(doc);
                b.addEventListener("click", function () {
                  if (chaseLoader) chaseLoader.start("themes");
                  applyDoc(doc);
                  if (statusEl) statusEl.textContent = "Checking themes…";
                });
                li.appendChild(b);
                matchList.appendChild(li);
              })(refined[i].doc);
            }
          }
      }
      global
        .fetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error("lookup failed");
          return r.json();
        })
        .then(function (data) {
          var raw = (data && data.docs) || [];
          var refined = refineCatalogMatches(raw, ownTitle, ownAuthor);
          if (refined.length) {
            finishLookupDocs(raw, false);
            return;
          }
          var fallbackUrl = buildOpenLibraryFallbackQUrl(ownTitle, ownAuthor);
          if (!fallbackUrl) {
            finishLookupDocs(raw, false);
            return;
          }
          if (statusEl) statusEl.textContent = "Trying a broader catalog search…";
          if (chaseLoader) chaseLoader.setPhase("catalog");
          global
            .fetch(fallbackUrl)
            .then(function (r2) {
              if (!r2.ok) throw new Error("lookup failed");
              return r2.json();
            })
            .then(function (data2) {
              finishLookupDocs((data2 && data2.docs) || [], true);
            })
            .catch(function () {
              finishLookupDocs(raw, false);
            });
        })
        .catch(function () {
          if (chaseLoader) chaseLoader.hide();
          releaseLookupBtn();
          catalogMeta.hintTier = "unclear";
          catalogMeta.hintDetail = "Couldn’t reach Open Library—try again when you’re online.";
          if (statusEl) statusEl.textContent = "Lookup failed.";
          showVerdict(ownTitle, ownAuthor);
        });
    }

    function runLookup() {
      runLookupCore();
    }

    function refreshBookcheckDisplay() {
      if (catalogMeta.enrichPending) return;
      if (!catalogMeta.hintTier) return;
      var title = titleIn ? titleIn.value.trim() : "";
      var author = authorIn ? authorIn.value.trim() : "";
      if (matchBox && matchLead && matchBox.classList.contains("is-visible")) {
        matchLead.innerHTML = catalogHintLeadHtml({
          tier: catalogMeta.hintTier,
          detail: catalogMeta.hintDetail,
          familyPortrayal: catalogMeta.familyPortrayal,
          culturalRepresentation: catalogMeta.culturalRepresentation,
          faithInStory: catalogMeta.faithInStory,
          parentNote: catalogMeta.parentNote,
          authorOtherWorks: catalogMeta.authorOtherWorks,
          deityComfort: catalogMeta.deityComfort,
        });
      }
      showVerdict(title, author);
    }

    function wireBookcheckExcludePref(boxId, allowsFn, setAllowsFn) {
      var Policy = global.HalalitFamilyShelfPolicy;
      var box = panel.querySelector(boxId);
      if (!box || !Policy || typeof allowsFn !== "function" || typeof setAllowsFn !== "function") return;
      box.checked = !allowsFn.call(Policy);
      box.addEventListener("change", function () {
        setAllowsFn.call(Policy, !box.checked);
        refreshBookcheckDisplay();
      });
    }

    function wireBookcheckReaderAge() {
      var Policy = global.HalalitFamilyShelfPolicy;
      var fieldset = panel.querySelector("#bookcheckReaderAgeFieldset");
      if (!fieldset || !Policy || typeof Policy.getBookQuestReaderAgeBand !== "function") return;
      var current = Policy.getBookQuestReaderAgeBand();
      fieldset.querySelectorAll('input[name="bookcheckReaderAge"]').forEach(function (radio) {
        radio.checked = current === radio.value;
        radio.addEventListener("change", function () {
          if (radio.checked && typeof Policy.setBookQuestReaderAgeBand === "function") {
            Policy.setBookQuestReaderAgeBand(radio.value);
            refreshBookcheckDisplay();
          }
        });
      });
    }

    wireBookcheckReaderAge();
    var PolicyRef = global.HalalitFamilyShelfPolicy;
    if (!Policy) Policy = PolicyRef;
    if (PolicyRef) {
      wireBookcheckExcludePref(
        "#bookcheckExcludeDeityMythology",
        PolicyRef.bookQuestAllowsDeityMythology,
        PolicyRef.setBookQuestAllowsDeityMythology
      );
      wireBookcheckExcludePref(
        "#bookcheckExcludeNegativeFamilyPortrayal",
        PolicyRef.bookQuestAllowsFamilyCommunityTone,
        PolicyRef.setBookQuestAllowsFamilyCommunityTone
      );
      wireBookcheckExcludePref(
        "#bookcheckExcludeLightRomance",
        PolicyRef.bookQuestAllowsLightRomance,
        PolicyRef.setBookQuestAllowsLightRomance
      );
      wireBookcheckExcludePref(
        "#bookcheckExcludeMagic",
        PolicyRef.bookQuestAllowsMagic,
        PolicyRef.setBookQuestAllowsMagic
      );
      wireBookcheckExcludePref(
        "#bookcheckExcludeSubstance",
        PolicyRef.bookQuestAllowsSubstance,
        PolicyRef.setBookQuestAllowsSubstance
      );
      wireBookcheckExcludePref(
        "#bookcheckExcludeCulturalMisrepresentation",
        PolicyRef.bookQuestAllowsCulturalMisrepresentation,
        PolicyRef.setBookQuestAllowsCulturalMisrepresentation
      );
      wireBookcheckExcludePref(
        "#bookcheckExcludeMentalHealth",
        PolicyRef.bookQuestAllowsMentalHealthComfort,
        PolicyRef.setBookQuestAllowsMentalHealthComfort
      );
    }

    if (lookupBtn) lookupBtn.addEventListener("click", runLookup);
    var OwnerVetsRuntime = global.HalalitOwnerVetsRuntime;
    if (OwnerVetsRuntime && OwnerVetsRuntime.ready) {
      OwnerVetsRuntime.ready.then(function () {
        if (catalogMeta.enrichPending) return;
        if (!catalogMeta.hintTier) return;
        var title = titleIn ? titleIn.value.trim() : "";
        var author = authorIn ? authorIn.value.trim() : "";
        if (!title) return;
        var hand = handVetHintFor(title, author, catalogMeta.matchedTitle, catalogMeta.matchedAuthor);
        if (hand) applyHandVetHint(hand, title, author);
        else refreshBookcheckDisplay();
      });
    }
    if (titleIn) {
      titleIn.addEventListener("input", resetUi);
      titleIn.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          runLookup();
        }
      });
    }
    if (authorIn) authorIn.addEventListener("input", resetUi);

    function prefillAndLookup(title, author, lookupOpts) {
      lookupOpts = lookupOpts || {};
      if (titleIn) titleIn.value = String(title || "").trim();
      if (authorIn) authorIn.value = String(author || "").trim();
      resetUi();
      catalogMeta.fromScanner = !!lookupOpts.fromScanner;
      catalogMeta.compactReport = !!lookupOpts.fromScanner || !!lookupOpts.ownerTesting;
      catalogMeta.ownerTesting = lookupOpts.ownerTesting !== undefined ? !!lookupOpts.ownerTesting : !!opts.ownerTesting;
      runLookup();
      if (!lookupOpts.fromScanner && titleIn) {
        try {
          titleIn.focus({ preventScroll: true });
        } catch (eFocus) {
          titleIn.focus();
        }
      }
    }

    if (panel.id) bookcheckPanels[panel.id] = { prefillAndLookup: prefillAndLookup };
    if (opts.primary !== false && (opts.primary || !bookcheckPanels.__primary)) {
      bookcheckPanels.__primary = bookcheckPanels[panel.id];
    }

    bookcheckPrefillAndLookup = prefillAndLookup;
  }

  var bookcheckPrefillAndLookup = null;

  global.HalalitBookcheck = {
    init: init,
    prefillAndLookup: function (title, author, lookupOpts) {
      lookupOpts = lookupOpts || {};
      var panelId = lookupOpts.panelId;
      var api =
        (panelId && bookcheckPanels[panelId]) ||
        bookcheckPanels.__primary ||
        (typeof bookcheckPrefillAndLookup === "function" ? { prefillAndLookup: bookcheckPrefillAndLookup } : null);
      if (api && typeof api.prefillAndLookup === "function") {
        api.prefillAndLookup(title, author, lookupOpts);
      }
    },
  };
})(typeof window !== "undefined" ? window : this);
