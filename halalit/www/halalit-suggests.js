/**
 * Halalit Suggests — browse hand-vetted recommendations.
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
    return "./index.html#bookcheck";
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

  function paintCover(slot, title, author) {
    if (!slot) return;
    var Cover = global.HalalitCoverThumb;
    if (!Cover || typeof Cover.fetchCoverDoc !== "function") return;
    if (
      typeof Cover.shouldShowCoverThumbForHandVetted === "function" &&
      !Cover.shouldShowCoverThumbForHandVetted(title, author)
    ) {
      slot.classList.add("halalit-suggests__cover--omit");
      return;
    }
    Cover.fetchCoverDoc(title, author, { requireEligible: false }).then(function (doc) {
      if (!doc || !slot.isConnected) return;
      var url = Cover.coverUrlFromDoc(doc);
      if (!url) return;
      slot.innerHTML =
        '<img src="' +
        escapeHtml(url) +
        '" alt="' +
        escapeHtml(title) +
        ' cover" width="100" height="150" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="halalit-suggests__cover-img" />';
      slot.classList.add("halalit-suggests__cover--loaded");
    });
  }

  function cardHtml(opts) {
    var title = opts.title;
    var author = opts.author || "";
    var badge = opts.badge || "";
    var meta = opts.meta || "";
    var coverId = opts.coverId;
    return (
      '<article class="halalit-suggests__card">' +
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
      '<p class="halalit-suggests__action"><a href="' +
      escapeHtml(bookcheckHref(title, author)) +
      '">Look up in Bookcheck</a></p>' +
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

    var state = {
      readerBand: getReaderBand(),
      view: "home",
      themeId: null,
      search: "",
      seeMore: false,
      seeMoreOffset: 0,
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

    function renderItem(item, coverPrefix, idx) {
      if (item.kind === "series") {
        var vol = item.rep.volume;
        var step = item.rep.index + 1;
        return cardHtml({
          title: vol.title,
          author: vol.author,
          badge: item.series.name,
          meta: "Next unread · book " + step + " of " + item.series.volumes.length,
          coverId: coverPrefix + idx,
        });
      }
      var book = item.book;
      return cardHtml({
        title: book.title,
        author: book.author,
        meta: bandLabel(book.ageBand),
        coverId: coverPrefix + idx,
      });
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
        '<p class="halalit-suggests__lead">Halalit Suggests only shows hand-checked books that fit the same age band as Book Quest and Bookcheck. Pick one to browse.</p>' +
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
          return renderItem(item, "spot", idx);
        })
        .join("");

      return (
        '<section class="halalit-suggests__panel">' +
        '<div class="halalit-suggests__toolbar">' +
        "<h2>Halalit Suggests</h2>" +
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
                return renderItem(item, "q", idx);
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
        '<button type="button" class="halalit-suggests__text-btn" data-back-home>← Back to Suggests</button>' +
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
        '<button type="button" class="halalit-suggests__text-btn" data-back-home>← Back to Suggests</button>' +
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

    function paint() {
      if (!state.readerBand) {
        root.innerHTML = renderAgeGate();
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
    }

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
    }

    paint();
  }

  function bootPage() {
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
