/**
 * Halalit — occasion-week curated picks on Home (Father's Week first; Mother's later).
 * Hand-vetted titles only; cover thumbnails respect HalalitCoverThumb.shouldShowCoverThumb.
 */
(function (global) {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  /** Owner Father's Week picks from halalit-curated-shelf-warnings.js */
  var FATHERS_WEEK_PICKS = [
    {
      title: "Fortunately, the Milk",
      author: "Neil Gaiman",
      line: "Dad pops out for milk and comes home with pirates, dinosaurs, and a story too tall to fit in a cereal bowl—perfect for sharing out loud.",
    },
    {
      title: "To Kill a Mockingbird",
      author: "Harper Lee",
      line: "In small-town Alabama, Scout Finch watches her father hold the line when prejudice closes in. A landmark novel for thoughtful older readers.",
    },
    {
      title: "Savvy",
      author: "Ingrid Law",
      line: "When Mibs Beaumont turns thirteen, her family\u2019s knack for magic arrives right on cue\u2014and she\u2019ll need every bit of it to reach her father in time. First book in the Beaumont series.",
    },
    {
      title: "Ramona and Her Father",
      author: "Beverly Cleary",
      line: "Mr. Quimby is out of work and feeling low, so seven-year-old Ramona rolls up her sleeves to cheer him up\u2014one earnest, ridiculous scheme at a time.",
      coverUrl: "https://covers.openlibrary.org/b/id/10582568-M.jpg",
    },
    {
      title: "Snow and Rose",
      author: "Emily Winfield Martin",
      line: "When their father vanishes into the woods, sisters Snow and Rose lean on each other\u2014and on their mother at home\u2014to break dark spells in a lush Grimm-inspired fairy tale.",
    },
    {
      title: "The Berenstain Bears and the Papa's Day Surprise",
      author: "Stan Berenstain",
      line: "Papa\u2019s Day is coming, and the cubs are bustling to line up a surprise he\u2019ll never see coming\u2014a sweet Father\u2019s Day story in the bear tree house.",
      coverRotate: -90,
    },
  ];

  function occasionApi() {
    return global.HalalitPacificOccasionBanner || null;
  }

  function fathersWeekActive() {
    var Occ = occasionApi();
    return Occ && typeof Occ.isWithinFathersWeek === "function" && Occ.isWithinFathersWeek();
  }

  function bookcheckHref(title, author) {
    var base = "./index.html#bookcheck";
    return base;
  }

  function renderCard(pick, index) {
    var id = "halalitFathersWeekCard" + String(index);
    return (
      '<article class="halalit-occasion-week-home__card" id="' +
      escapeHtml(id) +
      '">' +
      '<div class="halalit-occasion-week-home__cover" data-cover-slot="' +
      String(index) +
      '" aria-hidden="true"></div>' +
      '<div class="halalit-occasion-week-home__text">' +
      '<h3 class="halalit-occasion-week-home__book-title">' +
      escapeHtml(pick.title) +
      "</h3>" +
      '<p class="halalit-occasion-week-home__book-author muted">' +
      escapeHtml(pick.author) +
      "</p>" +
      '<p class="halalit-occasion-week-home__book-line">' +
      escapeHtml(pick.line) +
      "</p>" +
      '<p class="halalit-occasion-week-home__book-action">' +
      '<a href="' +
      bookcheckHref(pick.title, pick.author) +
      '">Look up in Bookcheck</a>' +
      "</p>" +
      "</div></article>"
    );
  }

  function paintCoverSlot(slot, pick, url) {
    if (!slot || !url) return;
    var rotate = pick.coverRotate;
    var rotateClass =
      rotate === 90 || rotate === -270
        ? " halalit-occasion-week-home__cover-img--rotate-90"
        : rotate === -90 || rotate === 270
          ? " halalit-occasion-week-home__cover-img--rotate-neg-90"
          : "";
    if (rotateClass) {
      slot.classList.add("halalit-occasion-week-home__cover--rotate-slot");
    }
    slot.innerHTML =
      '<img src="' +
      escapeHtml(url) +
      '" alt="' +
      escapeHtml(pick.title) +
      ' cover" width="100" height="150" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="halalit-occasion-week-home__cover-img' +
      rotateClass +
      '" />';
    slot.classList.add("halalit-occasion-week-home__cover--loaded");
  }

  function loadCovers(host, picks) {
    var Cover = global.HalalitCoverThumb;
    if (!Cover || typeof Cover.fetchCoverDoc !== "function") return;
    for (var i = 0; i < picks.length; i++) {
      (function (idx, pick) {
        var slot = host.querySelector('[data-cover-slot="' + idx + '"]');
        if (!slot) return;
        if (
          typeof Cover.shouldShowCoverThumbForHandVetted === "function" &&
          !Cover.shouldShowCoverThumbForHandVetted(pick.title, pick.author)
        ) {
          slot.classList.add("halalit-occasion-week-home__cover--skipped");
          return;
        }
        if (pick.coverUrl) {
          paintCoverSlot(slot, pick, pick.coverUrl);
          return;
        }
        Cover.fetchCoverDoc(pick.title, pick.author, { requireEligible: false }).then(function (doc) {
          if (!doc || !host.isConnected) return;
          if (
            typeof Cover.shouldShowCoverThumbForHandVetted === "function" &&
            !Cover.shouldShowCoverThumbForHandVetted(pick.title, pick.author)
          ) {
            return;
          }
          var url = Cover.coverUrlFromDoc(doc);
          if (!url) return;
          paintCoverSlot(slot, pick, url);
        });
      })(i, picks[i]);
    }
  }

  function renderFathersWeek(host) {
    if (!host || host.getAttribute("data-fathers-week-wired") === "1") return;
    host.setAttribute("data-fathers-week-wired", "1");
    host.hidden = false;
    host.className = "panel halalit-occasion-week-home halalit-occasion-week-home--fathers";
    host.innerHTML =
      '<h2 class="halalit-occasion-week-home__heading">Father\u2019s Week reads</h2>' +
      '<p class="halalit-occasion-week-home__lead">Hand-checked picks where dads and father-figures matter\u2014curated for Father\u2019s Week. Jacket photos come from Open Library when Halalit would recommend the book.</p>' +
      '<div class="halalit-occasion-week-home__grid" role="list">' +
      FATHERS_WEEK_PICKS.map(function (p, i) {
        return renderCard(p, i);
      }).join("") +
      "</div>";
    loadCovers(host, FATHERS_WEEK_PICKS);
  }

  function apply() {
    var host = global.document && global.document.getElementById("halalitFathersWeekHome");
    if (!host) return;
    if (!fathersWeekActive()) {
      host.hidden = true;
      host.innerHTML = "";
      host.removeAttribute("data-fathers-week-wired");
      return;
    }
    renderFathersWeek(host);
  }

  global.HalalitOccasionWeekHome = {
    apply: apply,
    FATHERS_WEEK_PICKS: FATHERS_WEEK_PICKS,
  };

  function boot() {
    apply();
    var Occ = occasionApi();
    if (Occ && typeof Occ.apply === "function") {
      var orig = Occ.apply;
      Occ.apply = function () {
        orig();
        apply();
      };
    }
  }

  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
