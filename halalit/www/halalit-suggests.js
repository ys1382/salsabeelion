/**
 * Book Wander (Halalit Suggests) — browse hand-vetted recommendations.
 * Age gate, spotlight, themed rooms, series lobby (next unread), trusted search.
 */
(function (global) {
  var PREFILL_KEY = "halalitSuggestsBookcheckPrefill";
  var BAND_RANK = {
    young_child: 1,
    older_child_young_teen: 2,
    older_teen_adult: 3,
  };

  function Data() {
    return global.HalalitSuggestsData || null;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function normTitle(t) {
    return String(t || "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function titleMatches(a, b) {
    var na = normTitle(a);
    var nb = normTitle(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.indexOf(nb) !== -1 || nb.indexOf(na) !== -1) return true;
    return false;
  }

  function getReaderBand() {
    var Policy = global.HalalitFamilyShelfPolicy;
    if (Policy && typeof Policy.getBookQuestReaderAgeBand === "function") {
      return Policy.getBookQuestReaderAgeBand();
    }
    try {
      return global.localStorage.getItem("halalitBookQuestReaderAgeBand") || null;
    } catch (e) {
      return null;
    }
  }

  function setReaderBand(band) {
    var Policy = global.HalalitFamilyShelfPolicy;
    if (Policy && typeof Policy.setBookQuestReaderAgeBand === "function") {
      Policy.setBookQuestReaderAgeBand(band);
      return;
    }
    try {
      global.localStorage.setItem("halalitBookQuestReaderAgeBand", band);
    } catch (e) {}
  }

  function bandFitsReader(bookBand, readerBand) {
    if (!readerBand || !BAND_RANK[readerBand]) return false;
    if (!bookBand || !BAND_RANK[bookBand]) return true;
    return BAND_RANK[bookBand] <= BAND_RANK[readerBand];
  }

  function loadAlreadyRead() {
    var Lib = global.HalalitPersonalLibrary;
    if (Lib && typeof Lib.load === "function") {
      try {
        return Lib.load() || [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  function isAlreadyRead(title, author, shelf) {
    shelf = shelf || loadAlreadyRead();
    for (var i = 0; i < shelf.length; i++) {
      var b = shelf[i];
      var bt = String(b.title || "").trim();
      if (!bt && b.titlePlain) {
        var Lib = global.HalalitPersonalLibrary;
        if (Lib && typeof Lib.parseTitlePlain === "function") {
          bt = Lib.parseTitlePlain(b.titlePlain).title || b.titlePlain;
        } else {
          bt = b.titlePlain;
        }
      }
      if (titleMatches(bt, title)) return true;
      if (b.titlePlain && titleMatches(b.titlePlain, title)) return true;
    }
    return false;
  }

  /** Earliest volume not on Already read; null if all read. */
  function seriesRepresentative(series, shelf) {
    shelf = shelf || loadAlreadyRead();
    var vols = series.volumes || [];
    if (!vols.length) return null;
    for (var i = 0; i < vols.length; i++) {
      if (!isAlreadyRead(vols[i].title, vols[i].author, shelf)) {
        return { volume: vols[i], index: i, series: series };
      }
    }
    return null;
  }

  function bookcheckHref(title, author) {
    try {
      global.sessionStorage.setItem(
        PREFILL_KEY,
        JSON.stringify({ title: title || "", author: author || "" })
      );
    } catch (e) {}
    if (global.HalalitTabs && typeof global.HalalitTabs.goToBookcheck === "function") {
      return "./index.html#bookcheck";
    }
    return "./index.html#bookcheck";
  }

  function openBookcheck(title, author) {
    try {
      global.sessionStorage.setItem(
        PREFILL_KEY,
        JSON.stringify({ title: title || "", author: author || "" })
      );
    } catch (e) {}
    if (global.HalalitTabs && typeof global.HalalitTabs.goToBookcheck === "function") {
      global.HalalitTabs.goToBookcheck();
      if (typeof consumeBookcheckPrefill === "function") consumeBookcheckPrefill();
      return false;
    }
    return true;
  }

  /** Called from index.html after Bookcheck init */
  function consumeBookcheckPrefill() {
    var raw;
    try {
      raw = global.sessionStorage.getItem(PREFILL_KEY);
      global.sessionStorage.removeItem(PREFILL_KEY);
    } catch (e) {
      return;
    }
    if (!raw) return;
    var data;
    try {
      data = JSON.parse(raw);
    } catch (e2) {
      return;
    }
    if (!data || !data.title) return;
    var BC = global.HalalitBookcheck;
    if (BC && typeof BC.prefillAndLookup === "function") {
      BC.prefillAndLookup(data.title, data.author || "");
    }
  }

  function activeOccasionThemeId() {
    var Occ = global.HalalitPacificOccasionBanner;
    if (!Occ) return null;
    if (typeof Occ.isWithinFathersWeek === "function" && Occ.isWithinFathersWeek()) return "fathers";
    if (typeof Occ.isWithinMothersWeek === "function" && Occ.isWithinMothersWeek()) return "mothers";
    return null;
  }

  function filterByAge(items, readerBand, getBand) {
    var out = [];
    for (var i = 0; i < items.length; i++) {
      if (bandFitsReader(getBand(items[i]), readerBand)) out.push(items[i]);
    }
    return out;
  }

  var COVER_STORE = "halalitSuggestsCoverV2:";
  /** Checked jackets. Open Library’s live search misses these two. */
  var KNOWN_COVERS = {
    "charlotte s web|e b white": "https://covers.openlibrary.org/b/id/8461797-M.jpg",
    "the last bear|hannah gold": "https://covers.openlibrary.org/b/id/13143857-M.jpg",
  };

  function knownCoverUrl(title, author) {
    return KNOWN_COVERS[coverKey(title, author)] || "";
  }

  function straightApostrophe(s) {
    return String(s || "").replace(/[\u2018\u2019\u201B\u2032]/g, "'");
  }
  var coverMem = {};
  var coverQueue = [];
  var coverActive = 0;
  var coverGen = 0;
  var coverNextAt = 0;
  var coverPumpTimer = null;
  var COVER_MAX = 1;

  function coverKey(title, author) {
    return normTitle(title) + "|" + normTitle(author || "");
  }

  function readStoredCover(key) {
    if (coverMem[key]) return coverMem[key];
    try {
      var stored = global.sessionStorage && global.sessionStorage.getItem(COVER_STORE + key);
      if (stored) coverMem[key] = stored;
      return stored || "";
    } catch (e) {
      return "";
    }
  }

  function writeStoredCover(key, url) {
    coverMem[key] = url;
    try {
      if (global.sessionStorage) global.sessionStorage.setItem(COVER_STORE + key, url);
    } catch (e2) {}
  }

  function forgetStoredCover(key) {
    delete coverMem[key];
    try {
      if (global.sessionStorage) global.sessionStorage.removeItem(COVER_STORE + key);
    } catch (e3) {}
  }

  function coverImgHtml(url, title) {
    return (
      '<img src="' +
      escapeHtml(url) +
      '" alt="' +
      escapeHtml(title) +
      ' cover" width="100" height="150" decoding="async" referrerpolicy="no-referrer" class="halalit-suggests__cover-img" />'
    );
  }

  function showCover(slot, title, author, url) {
    if (!slot || !url) return;
    var key = coverKey(title, author);
    slot.innerHTML = coverImgHtml(url, title);
    slot.classList.add("halalit-suggests__cover--loaded");
    var img = slot.querySelector("img");
    if (!img) return;
    img.addEventListener("error", function () {
      if (slot.getAttribute("data-cover-retry") === "1") return;
      slot.setAttribute("data-cover-retry", "1");
      if (readStoredCover(key) === url) forgetStoredCover(key);
      slot.classList.remove("halalit-suggests__cover--loaded");
      slot.innerHTML = "";
      coverQueue.push({
        slot: slot,
        title: title,
        author: author || "",
        key: key,
        gen: coverGen,
      });
      pumpCoverQueue();
    });
  }

  function coverCandidatesFromDoc(doc, Cover) {
    var urls = [];
    var seen = {};
    function add(url) {
      if (!url || seen[url]) return;
      seen[url] = true;
      urls.push(url);
    }
    if (Cover && typeof Cover.coverUrlFromDoc === "function") add(Cover.coverUrlFromDoc(doc));
    if (doc && doc.cover_i != null && doc.cover_i === doc.cover_i) {
      add("https://covers.openlibrary.org/b/id/" + String(doc.cover_i) + "-M.jpg");
    }
    var isbns = doc && doc.isbn;
    if (isbns && isbns.length) {
      for (var i = 0; i < isbns.length && urls.length < 5; i++) {
        var isbn = String(isbns[i]).replace(/[^0-9Xx]/g, "");
        if (isbn.length === 10 || isbn.length === 13) {
          add("https://covers.openlibrary.org/b/isbn/" + isbn + "-M.jpg");
        }
      }
    }
    return urls;
  }

  function probeCoverUrl(url) {
    return new Promise(function (resolve) {
      var img = new global.Image();
      var done = false;
      function finish(ok) {
        if (done) return;
        done = true;
        resolve(ok ? url : "");
      }
      img.onload = function () {
        finish((img.naturalWidth || 0) > 2 && (img.naturalHeight || 0) > 2);
      };
      img.onerror = function () {
        finish(false);
      };
      try {
        img.referrerPolicy = "no-referrer";
      } catch (e4) {}
      img.src = url;
    });
  }

  function firstRealCover(urls) {
    var i = 0;
    function next() {
      if (i >= urls.length) return Promise.resolve("");
      var url = urls[i];
      i += 1;
      return probeCoverUrl(url).then(function (ok) {
        if (ok) return ok;
        return next();
      });
    }
    return next();
  }

  function retryCoverJob(job) {
    if (job.gen !== coverGen || !job.slot || !job.slot.isConnected) return;
    job.tries = (job.tries || 0) + 1;
    if (job.tries >= 4) return;
    coverQueue.push(job);
    coverNextAt = Math.max(coverNextAt, Date.now() + 700 * job.tries);
  }

  function runCoverJob(job) {
    var pinned = knownCoverUrl(job.title, job.author);
    if (pinned) {
      writeStoredCover(job.key, pinned);
      if (job.gen === coverGen && job.slot.isConnected) {
        showCover(job.slot, job.title, job.author, pinned);
      }
      coverActive = Math.max(0, coverActive - 1);
      pumpCoverQueue();
      return;
    }
    var Cover = global.HalalitCoverThumb;
    Cover.fetchCoverDoc(job.title, job.author, { requireEligible: false })
      .then(function (doc) {
        if (job.gen !== coverGen || !job.slot.isConnected) return "skip";
        if (!doc) return "";
        return firstRealCover(coverCandidatesFromDoc(doc, Cover));
      })
      .then(function (url) {
        if (url === "skip") return;
        if (job.gen !== coverGen || !job.slot.isConnected) return;
        if (!url) {
          retryCoverJob(job);
          return;
        }
        writeStoredCover(job.key, url);
        showCover(job.slot, job.title, job.author, url);
      })
      .catch(function () {
        retryCoverJob(job);
      })
      .then(function () {
        coverActive = Math.max(0, coverActive - 1);
        pumpCoverQueue();
      });
  }

  function pumpCoverQueue() {
    if (coverPumpTimer) return;
    var wait = coverNextAt - Date.now();
    if (wait > 0) {
      coverPumpTimer = global.setTimeout(function () {
        coverPumpTimer = null;
        pumpCoverQueue();
      }, wait);
      return;
    }
    while (coverActive < COVER_MAX && coverQueue.length) {
      var job = coverQueue.shift();
      if (!job || job.gen !== coverGen || !job.slot || !job.slot.isConnected) continue;
      var cached = readStoredCover(job.key);
      if (cached) {
        showCover(job.slot, job.title, job.author, cached);
        continue;
      }
      coverActive += 1;
      coverNextAt = Date.now() + 450;
      runCoverJob(job);
      coverPumpTimer = global.setTimeout(function () {
        coverPumpTimer = null;
        pumpCoverQueue();
      }, 450);
      return;
    }
  }

  function paintCover(slot, title, author) {
    if (!slot) return;
    var Cover = global.HalalitCoverThumb;
    if (!Cover || typeof Cover.fetchCoverDoc !== "function") return;
    if (
      typeof Cover.shouldShowCoverThumbForHandVetted === "function" &&
      !Cover.shouldShowCoverThumbForHandVetted(straightApostrophe(title), straightApostrophe(author))
    ) {
      slot.classList.add("halalit-suggests__cover--omit");
      return;
    }
    var key = coverKey(title, author);
    var pinned = knownCoverUrl(title, author);
    if (pinned) {
      writeStoredCover(key, pinned);
      showCover(slot, title, author, pinned);
      return;
    }
    var cached = readStoredCover(key);
    if (cached) {
      showCover(slot, title, author, cached);
      return;
    }
    coverQueue.push({
      slot: slot,
      title: title,
      author: author || "",
      key: key,
      gen: coverGen,
    });
    pumpCoverQueue();
  }

  var LIST_REJECT = { flag_review: true };
  var LIST_DISCRETION = {
    user_discretion: true,
    fanservice_caution: true,
    preview_caution: true,
    teen_caution: true,
  };
  var bookBlurbToken = 0;

  function noteLines(detail) {
    var parts = String(detail || "").split(/\n+/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var line = parts[i].replace(/\s+/g, " ").trim();
      if (!line) continue;
      if (isTitleHeader(line)) continue;
      out.push(line);
    }
    return out;
  }

  function isTitleHeader(line) {
    if (/hand-verified|reads as clean|parent|preview|magic|family/i.test(line)) return false;
    if (line.length > 88) return false;
    if (/[.!?]/.test(line)) return false;
    return true;
  }

  function lineMentionsLgbtq(line) {
    return /\blgbtq?\b|\blesbian\b|\bgay\b|\btransgender\b|\bnon-?binary\b|\bqueer\b/i.test(line);
  }

  function readerLine(line) {
    return String(line || "")
      .replace(/\s*(?:—|–|-)\s*Book Quest includes[\s\S]*$/i, "")
      .replace(/\s*Book Quest includes when otherwise clean[\s\S]*$/i, "")
      .replace(/\s*Halalit.s Book Quest includes[\s\S]*$/i, "")
      .trim();
  }

  function pushUnique(arr, line) {
    var key = String(line || "").toLowerCase();
    if (!key) return;
    for (var i = 0; i < arr.length; i++) {
      if (String(arr[i]).toLowerCase() === key) return;
    }
    arr.push(line);
  }

  function collectDetails(title, author) {
    title = straightApostrophe(title);
    author = straightApostrophe(author);
    var Cur = global.HalalitCuratedShelfWarnings;
    var lines = [];
    var hint = null;
    var VS = global.HalalitBookcheckVetSource;
    if (VS && typeof VS.resolveHandVetHint === "function") hint = VS.resolveHandVetHint(title, author);
    if (hint && hint.detail) {
      var fromHint = noteLines(hint.detail);
      for (var i = 0; i < fromHint.length; i++) pushUnique(lines, fromHint[i]);
    }
    if (!Cur) return { hint: hint, lines: lines };
    var extras = [];
    if (typeof Cur.familyPortrayalMatch === "function") extras.push(Cur.familyPortrayalMatch(title, author));
    if (typeof Cur.mentalHealthComfortMatch === "function") extras.push(Cur.mentalHealthComfortMatch(title, author));
    if (typeof Cur.deityComfortMatch === "function") extras.push(Cur.deityComfortMatch(title, author));
    if (typeof Cur.parentNoteMatch === "function") extras.push(Cur.parentNoteMatch(title, author));
    if (typeof Cur.culturalRepresentationMatch === "function") extras.push(Cur.culturalRepresentationMatch(title, author));
    if (typeof Cur.faithInStoryMatch === "function") extras.push(Cur.faithInStoryMatch(title, author));
    if (typeof Cur.proseGraphicAdaptationMatch === "function") extras.push(Cur.proseGraphicAdaptationMatch(title, author));
    for (var e = 0; e < extras.length; e++) {
      var hit = extras[e];
      if (!hit || !hit.detail) continue;
      var more = noteLines(hit.detail);
      for (var m = 0; m < more.length; m++) pushUnique(lines, more[m]);
    }
    return { hint: hint, lines: lines };
  }

  function boxStatus(lines) {
    if (!lines.length) return { word: "Nothing noted", tone: "clear" };
    if (/preview|discretion|sensitive readers/i.test(lines.join(" "))) return { word: "Preview", tone: "preview" };
    return { word: "A note", tone: "note" };
  }

  function pageKind(hint) {
    if (!hint || !hint.tier) return "unknown";
    if (LIST_REJECT[hint.tier]) return "reject";
    if (LIST_DISCRETION[hint.tier]) return "discretion";
    if (hint.tier === "verified_clean" || hint.tier === "deity_comfort") return "clean";
    if (/won'?t recommend|outside halalit|hard reject/i.test(String(hint.detail || ""))) return "reject";
    return "clean";
  }

  function buildBookPageModel(title, author) {
    var pack = collectDetails(title, author);
    var kind = pageKind(pack.hint);
    if (kind === "reject" || kind === "discretion") {
      return {
        kind: kind,
        verdict: kind === "reject" ? "Halalit won’t recommend this." : "This one is your call.",
        reasons: pack.lines.slice(),
        boxes: null,
        also: [],
        handChecked: true,
      };
    }
    if (kind === "unknown") {
      return {
        kind: "unknown",
        verdict: "Halalit hasn’t read this closely yet.",
        reasons: [],
        boxes: null,
        also: [],
        handChecked: false,
      };
    }
    var buckets = { lovely: [], scary: [], romance: [], substance: [], beliefs: [] };
    var also = [];
    var lovelyRe =
      /hand-verified|reads as clean|week pick|stewardship|pro-nature|great family|clean overall|clean in owner|clean for/i;
    var strongRe =
      /preview|discretion|alcohol|drug|morphine|smoking|wine|romance|immodest|outfit|kissing|parent negativ|parent-bash|mental-health|divorced|magic|fantasy|deity|mytholog|scary|violence|horror|killing|grief|injured|sensitive readers|dark-mentality/i;
    for (var n = 0; n < pack.lines.length; n++) {
      var line = readerLine(pack.lines[n]);
      if (!line || lineMentionsLgbtq(line)) continue;
      if (lovelyRe.test(line) && !strongRe.test(line)) pushUnique(buckets.lovely, line);
      else if (/alcohol|drug|morphine|smoking|wine|substance/i.test(line)) pushUnique(buckets.substance, line);
      else if (/romance|immodest|outfit|kissing|modesty/i.test(line)) pushUnique(buckets.romance, line);
      else if (
        /magic|fantasy|deity|mytholog|family portray|parent negativ|parent-bash|mental-health|divorced|guardian/i.test(
          line
        )
      ) {
        pushUnique(buckets.beliefs, line);
      } else if (/scary|violence|horror|killing|grief|injured|sensitive readers|dark-mentality/i.test(line)) {
        pushUnique(buckets.scary, line);
      } else if (lovelyRe.test(line)) pushUnique(buckets.lovely, line);
      else pushUnique(also, line);
    }
    if (!buckets.lovely.length) buckets.lovely.push("Halalit hand-checked this for the family shelf.");
    function box(titleText, lines, lovely) {
      var status = boxStatus(lines);
      if (lovely && status.tone !== "preview") status = { word: "Clear", tone: "clear" };
      return { title: titleText, status: status.word, tone: status.tone, lines: lines };
    }
    var boxes = [
      box("What’s lovely", buckets.lovely, true),
      box("Scariness", buckets.scary, false),
      box("Romance and modesty", buckets.romance, false),
      box("Substances", buckets.substance, false),
      box("Magic, beliefs, and family", buckets.beliefs, false),
    ];
    var preview = false;
    for (var b = 0; b < boxes.length; b++) {
      if (boxes[b].tone === "preview") preview = true;
    }
    if (!preview && /preview|discretion|sensitive readers/i.test(also.join(" "))) preview = true;
    return {
      kind: "clean",
      verdict: preview ? "Hand-checked, with a few things to preview." : "Hand-checked. Halalit would suggest this.",
      reasons: [],
      boxes: boxes,
      also: also,
      handChecked: true,
    };
  }

  function plainDescription(raw) {
    var s = String(raw || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (s.length > 700) {
      var cut = s.slice(0, 700);
      var dot = cut.lastIndexOf(". ");
      s = (dot > 240 ? cut.slice(0, dot + 1) : cut) + "…";
    }
    return s;
  }

  function descriptionFromWork(work) {
    if (!work || typeof work !== "object") return "";
    var d = work.description;
    if (typeof d === "string") return d;
    if (d && typeof d.value === "string") return d.value;
    return "";
  }

  function loadBookBlurb(title, author, el) {
    bookBlurbToken += 1;
    var token = bookBlurbToken;
    var quiet = "Halalit doesn’t have a short description for this one yet.";
    function setText(text) {
      if (token !== bookBlurbToken || !el) return;
      el.textContent = text || quiet;
    }
    if (!el) return;
    var Cover = global.HalalitCoverThumb;
    if (!Cover || typeof Cover.fetchCoverDoc !== "function" || !global.fetch) {
      setText(quiet);
      return;
    }
    el.textContent = "Looking up a short description…";
    Cover.fetchCoverDoc(title, author)
      .then(function (doc) {
        if (token !== bookBlurbToken) return null;
        if (!doc) {
          setText(quiet);
          return null;
        }
        var first = doc.first_sentence;
        var quick = "";
        if (Array.isArray(first)) quick = first.join(" ");
        else if (typeof first === "string") quick = first;
        var key = doc.key;
        if (!key || String(key).indexOf("/works/") !== 0) {
          setText(plainDescription(quick) || quiet);
          return null;
        }
        return global
          .fetch("https://openlibrary.org" + key + ".json")
          .then(function (res) {
            if (!res.ok) return null;
            return res.json();
          })
          .then(function (work) {
            setText(plainDescription(descriptionFromWork(work) || quick) || quiet);
          });
      })
      .catch(function () {
        setText(quiet);
      });
  }

  function shelfHasTitle(list, title) {
    if (!list || !list.length) return false;
    for (var i = 0; i < list.length; i++) {
      var row = list[i] || {};
      if (titleMatches(row.title || row.titlePlain || "", title)) return true;
    }
    return false;
  }

  function cardHtml(opts) {
    var title = opts.title;
    var author = opts.author || "";
    var badge = opts.badge || "";
    var meta = opts.meta || "";
    var coverId = opts.coverId;
    var openPage = !!opts.openPage;
    var themes = opts.themeIds && opts.themeIds.length ? opts.themeIds.join("|") : "";
    var pageAttrs = openPage
      ? ' data-suggests-bookpage="1" tabindex="0" data-title="' +
        escapeHtml(title) +
        '" data-author="' +
        escapeHtml(author) +
        '" data-age="' +
        escapeHtml(opts.ageBand || "") +
        '" data-themes="' +
        escapeHtml(themes) +
        '" data-series="' +
        escapeHtml(opts.seriesName || "") +
        '"'
      : "";
    var action = openPage
      ? '<p class="halalit-suggests__action"><a href="#suggests">Open this book</a></p>'
      : '<p class="halalit-suggests__action"><a href="' +
        escapeHtml(bookcheckHref(title, author)) +
        '" data-suggests-bookcheck="1" data-title="' +
        escapeHtml(title) +
        '" data-author="' +
        escapeHtml(author) +
        '">Look up in Bookcheck</a></p>';
    return (
      '<article class="halalit-suggests__card' +
      (openPage ? " halalit-suggests__card--page" : "") +
      '"' +
      pageAttrs +
      ">" +
      '<div class="halalit-suggests__cover" data-cover-id="' +
      escapeHtml(coverId) +
      '" aria-hidden="true"></div>' +
      '<div class="halalit-suggests__text">' +
      (badge ? '<p class="halalit-suggests__badge">' + escapeHtml(badge) + "</p>" : "") +
      '<h3 class="halalit-suggests__book-title">' +
      escapeHtml(title) +
      "</h3>" +
      (author
        ? '<p class="halalit-suggests__book-author muted">' + escapeHtml(author) + "</p>"
        : "") +
      (meta ? '<p class="halalit-suggests__meta muted">' + escapeHtml(meta) + "</p>" : "") +
      action +
      "</div></article>"
    );
  }

  function bandLabel(band) {
    var Age = global.HalalitBookQuestAgeRatings;
    if (Age && Age.BAND_LABELS && Age.BAND_LABELS[band]) return Age.BAND_LABELS[band];
    if (band === "young_child") return "Young Child";
    if (band === "older_child_young_teen") return "Older Child / Young Teen";
    if (band === "older_teen_adult") return "Older Teen / Adult";
    return band || "";
  }

  function mount(root) {
    var D = Data();
    if (!root || !D) return;
    if (root.getAttribute("data-suggests-mounted") === "1") return;
    root.setAttribute("data-suggests-mounted", "1");

    var state = {
      readerBand: getReaderBand(),
      view: "home",
      themeId: null,
      search: "",
      seeMore: false,
      seeMoreOffset: 0,
      book: null,
    };

    function allStandaloneForBand() {
      return filterByAge(D.STANDALONES, state.readerBand, function (b) {
        return b.ageBand;
      });
    }

    function seriesCardsForBand() {
      var shelf = loadAlreadyRead();
      var cards = [];
      for (var i = 0; i < D.SERIES.length; i++) {
        var s = D.SERIES[i];
        var rep = seriesRepresentative(s, shelf);
        if (!rep) continue;
        if (!bandFitsReader(rep.volume.ageBand, state.readerBand)) continue;
        cards.push({
          series: s,
          rep: rep,
          kind: "series",
        });
      }
      return cards;
    }

    function spotlightList() {
      var spots = [];
      var stand = allStandaloneForBand().filter(function (b) {
        return b.spotlight;
      });
      for (var i = 0; i < stand.length; i++) spots.push({ kind: "book", book: stand[i] });
      var series = seriesCardsForBand();
      for (var j = 0; j < series.length && spots.length < D.SPOTLIGHT_COUNT; j++) {
        spots.push(series[j]);
      }
      return spots.slice(0, D.SPOTLIGHT_COUNT);
    }

    function themeBooks(themeId) {
      var out = [];
      var stand = allStandaloneForBand();
      for (var i = 0; i < stand.length; i++) {
        var ids = stand[i].themeIds || [];
        if (ids.indexOf(themeId) !== -1) out.push({ kind: "book", book: stand[i] });
      }
      var series = seriesCardsForBand();
      for (var j = 0; j < series.length; j++) {
        var tids = series[j].series.themeIds || [];
        if (tids.indexOf(themeId) !== -1) out.push(series[j]);
      }
      return out;
    }

    function searchHits(q) {
      q = normTitle(q);
      if (!q) return [];
      var hits = [];
      var stand = allStandaloneForBand();
      for (var i = 0; i < stand.length; i++) {
        var b = stand[i];
        var hay = normTitle(b.title + " " + (b.author || ""));
        if (hay.indexOf(q) !== -1) hits.push({ kind: "book", book: b });
      }
      var series = seriesCardsForBand();
      for (var j = 0; j < series.length; j++) {
        var s = series[j];
        var hay2 = normTitle(s.series.name + " " + s.rep.volume.title + " " + (s.rep.volume.author || ""));
        if (hay2.indexOf(q) !== -1) hits.push(s);
      }
      return hits;
    }

    function renderItem(item, coverPrefix, idx, openPage) {
      if (openPage == null) openPage = true;
      if (item.kind === "series") {
        var vol = item.rep.volume;
        var step = item.rep.index + 1;
        return cardHtml({
          title: vol.title,
          author: vol.author,
          badge: item.series.name,
          meta: "Next unread · book " + step + " of " + item.series.volumes.length,
          coverId: coverPrefix + idx,
          openPage: openPage,
          ageBand: vol.ageBand,
          themeIds: item.series.themeIds || [],
          seriesName: item.series.name,
        });
      }
      var book = item.book;
      return cardHtml({
        title: book.title,
        author: book.author,
        meta: bandLabel(book.ageBand),
        coverId: coverPrefix + idx,
        openPage: openPage,
        ageBand: book.ageBand,
        themeIds: book.themeIds || [],
      });
    }

    function themeName(id) {
      for (var i = 0; i < D.THEMES.length; i++) {
        if (D.THEMES[i].id === id) return D.THEMES[i].name;
      }
      return "";
    }

    function listHtml(lines) {
      if (!lines || !lines.length) return "<li>Halalit parked this, and the note didn’t include a reason.</li>";
      var html = "";
      for (var i = 0; i < lines.length; i++) html += "<li>" + escapeHtml(lines[i]) + "</li>";
      return html;
    }

    function renderBookPage() {
      var book = state.book;
      if (!book || !book.title) return renderHome();
      var model = buildBookPageModel(book.title, book.author);
      var onWish = shelfHasTitle(global.HalalitWantToRead && global.HalalitWantToRead.load(), book.title);
      var onFinished = shelfHasTitle(loadAlreadyRead(), book.title);
      var reasonHtml = "";
      if (model.kind === "reject" || model.kind === "discretion") {
        reasonHtml =
          '<section class="halalit-suggests__reason"><h3>' +
          (model.kind === "reject" ? "Why Halalit won’t recommend this" : "Why this is your call") +
          "</h3><ul>" +
          listHtml(model.reasons) +
          "</ul></section>";
      }
      var boxesHtml = "";
      if (model.boxes) {
        boxesHtml = '<div class="halalit-suggests__boxes">';
        for (var b = 0; b < model.boxes.length; b++) {
          var box = model.boxes[b];
          var lines = "";
          for (var li = 0; li < box.lines.length; li++) {
            lines += "<p>" + escapeHtml(box.lines[li]) + "</p>";
          }
          boxesHtml +=
            '<section class="halalit-suggests__box halalit-suggests__box--' +
            escapeHtml(box.tone) +
            '"><h3 class="halalit-suggests__box-title">' +
            escapeHtml(box.title) +
            '</h3><p class="halalit-suggests__box-status">' +
            escapeHtml(box.status) +
            "</p>" +
            lines +
            "</section>";
        }
        boxesHtml += "</div>";
      }
      var alsoHtml = "";
      if (model.also && model.also.length) {
        alsoHtml = '<section class="halalit-suggests__also"><h3>Also noted</h3><ul>' + listHtml(model.also) + "</ul></section>";
      }
      var tags = [];
      if (book.ageBand) tags.push(bandLabel(book.ageBand));
      if (model.handChecked) tags.push("Hand-checked");
      var themeIds = book.themeIds || [];
      for (var t = 0; t < themeIds.length; t++) {
        var name = themeName(themeIds[t]);
        if (name) tags.push(name);
      }
      var tagsHtml = "";
      for (var g = 0; g < tags.length; g++) {
        tagsHtml += '<span class="halalit-suggests__tag">' + escapeHtml(tags[g]) + "</span>";
      }
      return (
        '<section class="halalit-suggests__panel">' +
        '<button type="button" class="halalit-suggests__text-btn" data-back-home>← Back to Book Wander</button>' +
        '<div class="halalit-suggests__book">' +
        '<div class="halalit-suggests__cover halalit-suggests__book-cover" data-cover-id="bookpage" aria-hidden="true"></div>' +
        "<div>" +
        (book.seriesName ? '<p class="halalit-suggests__badge">' + escapeHtml(book.seriesName) + "</p>" : "") +
        "<h2>" +
        escapeHtml(book.title) +
        "</h2>" +
        (book.author ? '<p class="halalit-suggests__book-author">' + escapeHtml(book.author) + "</p>" : "") +
        '<p class="halalit-suggests__verdict">' +
        escapeHtml(model.verdict) +
        "</p>" +
        '<div class="halalit-suggests__shelf-row">' +
        '<button type="button" class="halalit-suggests__shelf-btn" data-shelf="wish"' +
        (onWish ? " disabled" : "") +
        ">" +
        (onWish ? "On wishlist" : "Wishlist") +
        "</button>" +
        '<button type="button" class="halalit-suggests__shelf-btn" data-shelf="finished"' +
        (onFinished ? " disabled" : "") +
        ">" +
        (onFinished ? "On finished" : "Finished") +
        "</button></div>" +
        '<p class="halalit-suggests__shelf-status muted" data-shelf-status></p>' +
        "</div></div>" +
        reasonHtml +
        '<h3 class="halalit-suggests__blurb-title">About this book</h3>' +
        '<p class="halalit-suggests__blurb" data-book-blurb>Looking up a short description…</p>' +
        boxesHtml +
        alsoHtml +
        (tagsHtml ? '<div class="halalit-suggests__tags">' + tagsHtml + "</div>" : "") +
        "</section>"
      );
    }

    function loadCoversFor(host, items, prefix) {
      for (var i = 0; i < items.length; i++) {
        var slot = host.querySelector('[data-cover-id="' + prefix + i + '"]');
        var title;
        var author;
        if (items[i].kind === "series") {
          title = items[i].rep.volume.title;
          author = items[i].rep.volume.author;
        } else {
          title = items[i].book.title;
          author = items[i].book.author;
        }
        paintCover(slot, title, author);
      }
    }

    function renderAgeGate() {
      return (
        '<section class="halalit-suggests__panel">' +
        "<h2>Who is reading?</h2>" +
        '<p class="halalit-suggests__lead">Book Wander only shows hand-checked books that fit the same age band as Book Quest and Bookcheck. Pick one to browse.</p>' +
        '<div class="halalit-suggests__age-row" role="group" aria-label="Reader age band">' +
        '<button type="button" class="halalit-suggests__age-btn" data-band="young_child">Young Child</button>' +
        '<button type="button" class="halalit-suggests__age-btn" data-band="older_child_young_teen">Older Child / Young Teen</button>' +
        '<button type="button" class="halalit-suggests__age-btn" data-band="older_teen_adult">Older Teen / Adult</button>' +
        "</div></section>"
      );
    }

    function occasionBannerHtml() {
      var occ = activeOccasionThemeId();
      if (!occ) return "";
      var theme = null;
      for (var i = 0; i < D.THEMES.length; i++) {
        if (D.THEMES[i].id === occ) theme = D.THEMES[i];
      }
      if (!theme) return "";
      return (
        '<p class="halalit-suggests__occasion" role="status">' +
        "This week’s highlight: <strong>" +
        escapeHtml(theme.name) +
        '</strong> — <button type="button" class="halalit-suggests__text-btn" data-open-theme="' +
        escapeHtml(theme.id) +
        '">Open room</button>' +
        "</p>"
      );
    }

    function renderHome() {
      var spots = spotlightList();
      var themesHtml = D.THEMES.map(function (t) {
        var highlight = activeOccasionThemeId() === t.id ? " halalit-suggests__room--highlight" : "";
        return (
          '<button type="button" class="halalit-suggests__room' +
          highlight +
          '" data-open-theme="' +
          escapeHtml(t.id) +
          '">' +
          "<strong>" +
          escapeHtml(t.name) +
          "</strong>" +
          "<span>" +
          escapeHtml(t.blurb) +
          "</span></button>"
        );
      }).join("");

      var series = seriesCardsForBand();
      var seriesHtml = series
        .slice(0, 12)
        .map(function (item, idx) {
          return renderItem(item, "ser", idx);
        })
        .join("");

      var spotHtml = spots
        .map(function (item, idx) {
          return renderItem(item, "spot", idx, true);
        })
        .join("");

      return (
        '<section class="halalit-suggests__panel">' +
        '<div class="halalit-suggests__toolbar">' +
        "<h2>Book Wander</h2>" +
        '<button type="button" class="halalit-suggests__text-btn" data-change-age">Age: ' +
        escapeHtml(bandLabel(state.readerBand)) +
        " · change</button>" +
        "</div>" +
        '<p class="halalit-suggests__lead">Books Halalit would suggest — hand-checked only. No public reviews; use Bookcheck for a title’s note, and feedback boxes if you want to tell the owner something private.</p>' +
        occasionBannerHtml() +
        '<label class="halalit-suggests__search-label" for="halalitSuggestsSearch">Search trusted titles</label>' +
        '<input type="search" id="halalitSuggestsSearch" class="halalit-suggests__search" placeholder="Title or author…" value="' +
        escapeHtml(state.search) +
        '" />' +
        (state.search
          ? '<div class="halalit-suggests__grid" data-grid="search">' +
            searchHits(state.search)
              .map(function (item, idx) {
                return renderItem(item, "search", idx);
              })
              .join("") +
            "</div>"
          : "") +
        (state.search
          ? ""
          : "<h3 class=\"halalit-suggests__sub\">Spotlight</h3>" +
            '<div class="halalit-suggests__grid" data-grid="spot">' +
            spotHtml +
            "</div>" +
            '<p class="halalit-suggests__more-wrap"><button type="button" class="halalit-suggests__more" data-see-more>See more trusted titles</button></p>' +
            "<h3 class=\"halalit-suggests__sub\">Themed rooms</h3>" +
            '<div class="halalit-suggests__rooms">' +
            themesHtml +
            "</div>" +
            "<h3 class=\"halalit-suggests__sub\">Series lobby</h3>" +
            '<p class="halalit-suggests__lead muted">Each card shows the first unread book in the line (from your Already read list).</p>' +
            '<div class="halalit-suggests__grid" data-grid="ser">' +
            (seriesHtml || '<p class="muted">No series left to discover in this age band—or you’ve finished the ones listed.</p>') +
            "</div>") +
        "</section>"
      );
    }

    function renderSeeMore() {
      var all = allStandaloneForBand().map(function (b) {
        return { kind: "book", book: b };
      });
      var series = seriesCardsForBand();
      var merged = all.concat(series);
      var page = merged.slice(0, state.seeMoreOffset + D.SEE_MORE_PAGE);
      var html = page
        .map(function (item, idx) {
          return renderItem(item, "more", idx);
        })
        .join("");
      var moreBtn =
        page.length < merged.length
          ? '<p class="halalit-suggests__more-wrap"><button type="button" class="halalit-suggests__more" data-see-more-again>Show more</button></p>'
          : "";
      return (
        '<section class="halalit-suggests__panel">' +
        '<button type="button" class="halalit-suggests__text-btn" data-back-home>← Back to Book Wander</button>' +
        "<h2>More trusted titles</h2>" +
        '<p class="halalit-suggests__lead">Still only Halalit hand-checked books for ' +
        escapeHtml(bandLabel(state.readerBand)) +
        ".</p>" +
        '<div class="halalit-suggests__grid" data-grid="more">' +
        html +
        "</div>" +
        moreBtn +
        "</section>"
      );
    }

    function renderTheme() {
      var theme = null;
      for (var i = 0; i < D.THEMES.length; i++) {
        if (D.THEMES[i].id === state.themeId) theme = D.THEMES[i];
      }
      if (!theme) return renderHome();
      var items = themeBooks(theme.id);
      var html = items
        .map(function (item, idx) {
          return renderItem(item, "theme", idx);
        })
        .join("");
      return (
        '<section class="halalit-suggests__panel">' +
        '<button type="button" class="halalit-suggests__text-btn" data-back-home>← Back to Book Wander</button>' +
        "<h2>" +
        escapeHtml(theme.name) +
        "</h2>" +
        '<p class="halalit-suggests__lead">' +
        escapeHtml(theme.blurb) +
        "</p>" +
        '<div class="halalit-suggests__grid" data-grid="theme">' +
        (html || '<p class="muted">No titles in this room for your age band yet.</p>') +
        "</div></section>"
      );
    }

    function fitBookPanel() {
      if (state.view !== "book") return;
      var panel = root.querySelector(".halalit-suggests__panel");
      if (!panel) return;
      var top = panel.getBoundingClientRect().top;
      if (top < 0) top = 0;
      panel.style.minHeight = Math.max(280, global.innerHeight - top) + "px";
    }

    function paint() {
      coverGen += 1;
      coverQueue = [];
      if (state.readerBand && state.view === "book") root.classList.add("halalit-suggests--book");
      else root.classList.remove("halalit-suggests--book");
      if (!state.readerBand) {
        root.innerHTML = renderAgeGate();
      } else if (state.view === "book") {
        root.innerHTML = renderBookPage();
      } else if (state.view === "seeMore") {
        root.innerHTML = renderSeeMore();
      } else if (state.view === "theme") {
        root.innerHTML = renderTheme();
      } else {
        root.innerHTML = renderHome();
      }
      wire();
      var grids = root.querySelectorAll("[data-grid]");
      for (var g = 0; g < grids.length; g++) {
        var grid = grids[g];
        var prefix = grid.getAttribute("data-grid");
        var items;
        if (prefix === "spot") items = spotlightList();
        else if (prefix === "ser") items = seriesCardsForBand().slice(0, 12);
        else if (prefix === "search") items = searchHits(state.search);
        else if (prefix === "more") {
          var all = allStandaloneForBand()
            .map(function (b) {
              return { kind: "book", book: b };
            })
            .concat(seriesCardsForBand());
          items = all.slice(0, state.seeMoreOffset + D.SEE_MORE_PAGE);
        } else if (prefix === "theme") items = themeBooks(state.themeId);
        else items = [];
        loadCoversFor(grid, items, prefix);
      }
      if (state.view === "book" && state.book) {
        paintCover(root.querySelector('[data-cover-id="bookpage"]'), state.book.title, state.book.author);
        loadBookBlurb(state.book.title, state.book.author, root.querySelector("[data-book-blurb]"));
        fitBookPanel();
      }
    }

    global.addEventListener("resize", function () {
      if (state.view === "book") fitBookPanel();
    });

    function wire() {
      var ageBtns = root.querySelectorAll("[data-band]");
      for (var i = 0; i < ageBtns.length; i++) {
        ageBtns[i].addEventListener("click", function (ev) {
          var band = ev.currentTarget.getAttribute("data-band");
          setReaderBand(band);
          state.readerBand = band;
          state.view = "home";
          paint();
        });
      }
      var changeAge = root.querySelector("[data-change-age]");
      if (changeAge) {
        changeAge.addEventListener("click", function () {
          state.readerBand = null;
          paint();
        });
      }
      var openThemes = root.querySelectorAll("[data-open-theme]");
      for (var t = 0; t < openThemes.length; t++) {
        openThemes[t].addEventListener("click", function (ev) {
          state.themeId = ev.currentTarget.getAttribute("data-open-theme");
          state.view = "theme";
          state.search = "";
          paint();
        });
      }
      var back = root.querySelector("[data-back-home]");
      if (back) {
        back.addEventListener("click", function () {
          state.view = "home";
          state.themeId = null;
          paint();
        });
      }
      var more = root.querySelector("[data-see-more]");
      if (more) {
        more.addEventListener("click", function () {
          state.view = "seeMore";
          state.seeMoreOffset = 0;
          paint();
        });
      }
      var moreAgain = root.querySelector("[data-see-more-again]");
      if (moreAgain) {
        moreAgain.addEventListener("click", function () {
          state.seeMoreOffset += D.SEE_MORE_PAGE;
          paint();
        });
      }
      var search = root.querySelector("#halalitSuggestsSearch");
      if (search) {
        var timer = null;
        search.addEventListener("input", function () {
          var val = search.value;
          clearTimeout(timer);
          timer = setTimeout(function () {
            state.search = val;
            paint();
            var el = root.querySelector("#halalitSuggestsSearch");
            if (el) {
              el.focus();
              try {
                el.setSelectionRange(el.value.length, el.value.length);
              } catch (e) {}
            }
          }, 220);
        });
      }
      function openBookPageFrom(el) {
        var themes = String(el.getAttribute("data-themes") || "")
          .split("|")
          .filter(function (id) {
            return !!id;
          });
        state.book = {
          title: el.getAttribute("data-title") || "",
          author: el.getAttribute("data-author") || "",
          ageBand: el.getAttribute("data-age") || "",
          themeIds: themes,
          seriesName: el.getAttribute("data-series") || "",
        };
        state.view = "book";
        state.search = "";
        paint();
      }
      var pageCards = root.querySelectorAll("[data-suggests-bookpage]");
      for (var p = 0; p < pageCards.length; p++) {
        pageCards[p].addEventListener("click", function (ev) {
          ev.preventDefault();
          openBookPageFrom(ev.currentTarget);
        });
        pageCards[p].addEventListener("keydown", function (ev) {
          if (ev.key !== "Enter" && ev.key !== " ") return;
          ev.preventDefault();
          openBookPageFrom(ev.currentTarget);
        });
      }
      var shelfBtns = root.querySelectorAll("[data-shelf]");
      for (var s = 0; s < shelfBtns.length; s++) {
        shelfBtns[s].addEventListener("click", function (ev) {
          var btn = ev.currentTarget;
          var book = state.book;
          if (!book || !book.title) return;
          var status = root.querySelector("[data-shelf-status]");
          var kind = btn.getAttribute("data-shelf");
          var ok = false;
          if (kind === "wish" && global.HalalitWantToRead && typeof global.HalalitWantToRead.add === "function") {
            ok = global.HalalitWantToRead.add({
              title: book.title,
              author: book.author || "",
              source: "book_wander",
            });
          } else if (kind === "finished" && global.HalalitPersonalLibrary && typeof global.HalalitPersonalLibrary.add === "function") {
            var today = new Date();
            var month = String(today.getMonth() + 1);
            var day = String(today.getDate());
            if (month.length < 2) month = "0" + month;
            if (day.length < 2) day = "0" + day;
            ok = global.HalalitPersonalLibrary.add({
              title: book.title,
              author: book.author || "",
              source: "book_wander",
              finishedAt: today.getFullYear() + "-" + month + "-" + day,
            });
          }
          if (!ok) {
            if (status) status.textContent = "Couldn’t save that just now.";
            return;
          }
          btn.disabled = true;
          btn.textContent = kind === "wish" ? "On wishlist" : "On finished";
          if (status) {
            status.textContent = kind === "wish" ? "Saved to your wishlist." : "Saved to Already read.";
          }
        });
      }
      var bcLinks = root.querySelectorAll("a[data-suggests-bookcheck]");
      for (var b = 0; b < bcLinks.length; b++) {
        bcLinks[b].addEventListener("click", function (ev) {
          var a = ev.currentTarget;
          var stay = openBookcheck(a.getAttribute("data-title"), a.getAttribute("data-author"));
          if (!stay) ev.preventDefault();
        });
      }
    }

    paint();
  }

  function bootPage() {
    var path = (global.location && global.location.pathname) || "";
    if (!/suggests\.html$/i.test(path)) return;
    var root = global.document && global.document.getElementById("halalitSuggestsRoot");
    if (root) mount(root);
  }

  global.HalalitSuggests = {
    mount: mount,
    bootPage: bootPage,
    consumeBookcheckPrefill: consumeBookcheckPrefill,
    seriesRepresentative: seriesRepresentative,
    PREFILL_KEY: PREFILL_KEY,
  };

  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", bootPage);
  } else {
    bootPage();
  }
})(typeof window !== "undefined" ? window : globalThis);
