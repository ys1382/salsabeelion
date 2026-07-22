/**
 * Bane of Extinction — place lens (no GPS).
 * Halalit-style favorite places on this device + "looking at" / compare lenses.
 * Facts and browse lists follow the chosen place, not where the phone is.
 */
(function (global) {
  "use strict";

  var FAV_KEY = "bane_favorite_places_v1";
  var LENS_KEY = "bane_looking_at_place_v1";
  var COMPARE_KEY = "bane_compare_place_v1";

  /** Curated starter places — expand with regional packs later. No backyard options. */
  var PLACES = [
    {
      placeId: "socal-coast",
      label: "Southern California coast",
      initials: "SC",
      region: "socal",
      habitat: "coast",
      habitatOnly: false,
    },
    {
      placeId: "norcal-oak",
      label: "Northern California oak woodland",
      initials: "NO",
      region: "norcal",
      habitat: "woodland",
      habitatOnly: false,
    },
    {
      placeId: "habitat-urban",
      label: "Urban (any region)",
      initials: "UR",
      region: "",
      habitat: "urban",
      habitatOnly: true,
    },
    {
      placeId: "habitat-suburban",
      label: "Suburban (any region)",
      initials: "SU",
      region: "",
      habitat: "suburban",
      habitatOnly: true,
    },
    {
      placeId: "habitat-city",
      label: "City (any region)",
      initials: "CI",
      region: "",
      habitat: "city",
      habitatOnly: true,
    },
    {
      placeId: "habitat-beach",
      label: "Beach / shore (any region)",
      initials: "BH",
      region: "",
      habitat: "coast",
      habitatOnly: true,
    },
    {
      placeId: "habitat-forest",
      label: "Forest / woodland (any region)",
      initials: "FW",
      region: "",
      habitat: "woodland",
      habitatOnly: true,
    },
  ];

  /** Old placeIds → current (drop personal backyard lenses). */
  var PLACE_ID_MIGRATIONS = {
    "socal-backyard": "habitat-suburban",
    "norcal-backyard": "habitat-suburban",
    "habitat-garden": "habitat-suburban",
  };

  /**
   * Starter browse pack: species you may see in a place, with local role.
   * role: native | introduced | invasive | houseplant | planted | unknown
   */
  var SPECIES_BY_PLACE = {
    "socal-coast": [
      {
        common: "California poppy",
        latin: "Eschscholzia californica",
        role: "native",
        note: "State flower; common on dry slopes and open coastal edges.",
      },
      {
        common: "Ice plant",
        latin: "Carpobrotus edulis",
        role: "invasive",
        note: "Spreads on dunes and bluffs; crowds out native coastal plants.",
      },
      {
        common: "Western gull",
        latin: "Larus occidentalis",
        role: "native",
        note: "Common shoreline bird along the SoCal coast.",
      },
    ],
    "norcal-oak": [
      {
        common: "Coast live oak",
        latin: "Quercus agrifolia",
        role: "native",
        note: "Keystone oak woodland tree in much of coastal Northern & Central CA.",
      },
      {
        common: "California poppy",
        latin: "Eschscholzia californica",
        role: "native",
        note: "Often in sunny openings near oak woodland.",
      },
      {
        common: "English ivy",
        latin: "Hedera helix",
        role: "invasive",
        note: "Climbs trunks and carpets understory; remove when safe to do so.",
      },
    ],
    "habitat-urban": [
      {
        common: "Common sunflower",
        latin: "Helianthus annuus",
        role: "planted",
        note: "Planters and neighborhood beds; birds and bees still visit.",
      },
      {
        common: "Eucalyptus",
        latin: "Eucalyptus spp.",
        role: "introduced",
        note: "Street and park trees in many cities — not native to CA.",
      },
      {
        common: "Sweetheart philodendron",
        latin: "Philodendron hederaceum",
        role: "houseplant",
        note: "Windowsill plant — keep indoors; don’t dump it outside.",
      },
    ],
    "habitat-suburban": [
      {
        common: "California poppy",
        latin: "Eschscholzia californica",
        role: "unknown",
        note: "Native in CA; elsewhere may be a planted ornamental. Pick a region for sharper status.",
      },
      {
        common: "Common sunflower",
        latin: "Helianthus annuus",
        role: "planted",
        note: "Common in neighborhood plantings for pollinators — status still depends on region.",
      },
      {
        common: "Sweetheart philodendron",
        latin: "Philodendron hederaceum",
        role: "houseplant",
        note: "Typical indoor plant; keep out of wild habitats.",
      },
    ],
    "habitat-city": [
      {
        common: "Common sunflower",
        latin: "Helianthus annuus",
        role: "planted",
        note: "Park beds and downtown planters; birds and bees still visit.",
      },
      {
        common: "Eucalyptus",
        latin: "Eucalyptus spp.",
        role: "introduced",
        note: "Street and park trees in many cities — not a native California oak story.",
      },
    ],
    "habitat-beach": [
      {
        common: "Ice plant",
        latin: "Carpobrotus edulis",
        role: "invasive",
        note: "Often invasive on West Coast dunes — don’t plant on wild shorelines.",
      },
      {
        common: "Western gull",
        latin: "Larus occidentalis",
        role: "native",
        note: "Common Pacific shore bird (region packs refine further).",
      },
    ],
    "habitat-forest": [
      {
        common: "English ivy",
        latin: "Hedera helix",
        role: "invasive",
        note: "Often invasive in U.S. woodlands; region packs refine further.",
      },
      {
        common: "Coast live oak",
        latin: "Quercus agrifolia",
        role: "unknown",
        note: "Native in coastal CA oak woodland — pick a CA region for a clearer label.",
      },
    ],
  };

  function migratePlaceId(placeId) {
    var id = String(placeId || "").trim();
    if (!id) return "";
    return PLACE_ID_MIGRATIONS[id] || id;
  }

  function findPlace(placeId) {
    var id = migratePlaceId(placeId);
    if (!id) return null;
    for (var i = 0; i < PLACES.length; i++) {
      if (PLACES[i].placeId === id) return PLACES[i];
    }
    return null;
  }

  function normalizeFavoriteIds(ids) {
    var out = [];
    var seen = Object.create(null);
    if (!Array.isArray(ids)) return out;
    for (var i = 0; i < ids.length; i++) {
      var id = migratePlaceId(ids[i]);
      if (!id || seen[id] || !findPlace(id)) continue;
      seen[id] = true;
      out.push(id);
    }
    return out;
  }

  function loadFavorites() {
    try {
      var raw = localStorage.getItem(FAV_KEY);
      if (!raw) return [];
      return normalizeFavoriteIds(JSON.parse(raw));
    } catch (e) {
      return [];
    }
  }

  function saveFavorites(ids) {
    var cleaned = normalizeFavoriteIds(ids);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(cleaned));
    } catch (e) {}
    return cleaned;
  }

  function favoritePlaces() {
    var ids = loadFavorites();
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var p = findPlace(ids[i]);
      if (p) out.push(p);
    }
    return out;
  }

  function loadLookingAt() {
    try {
      var raw = String(localStorage.getItem(LENS_KEY) || "").trim();
      var id = migratePlaceId(raw);
      if (!findPlace(id)) return "";
      if (id && id !== raw) {
        try {
          localStorage.setItem(LENS_KEY, id);
        } catch (e2) {}
      }
      return id;
    } catch (e) {
      return "";
    }
  }

  function saveLookingAt(placeId) {
    var id = String(placeId || "").trim();
    if (id && !findPlace(id)) id = "";
    try {
      if (id) localStorage.setItem(LENS_KEY, id);
      else localStorage.removeItem(LENS_KEY);
    } catch (e) {}
    return id;
  }

  function loadCompare() {
    try {
      var raw = String(localStorage.getItem(COMPARE_KEY) || "").trim();
      var id = migratePlaceId(raw);
      if (!findPlace(id)) return "";
      if (id && id !== raw) {
        try {
          localStorage.setItem(COMPARE_KEY, id);
        } catch (e2) {}
      }
      return id;
    } catch (e) {
      return "";
    }
  }

  function saveCompare(placeId) {
    var id = String(placeId || "").trim();
    if (id && !findPlace(id)) id = "";
    try {
      if (id) localStorage.setItem(COMPARE_KEY, id);
      else localStorage.removeItem(COMPARE_KEY);
    } catch (e) {}
    return id;
  }

  /** Active lens: looking-at, else first favorite, else empty (skip place). */
  function activePlaceId() {
    var looking = loadLookingAt();
    if (looking) return looking;
    var fav = loadFavorites();
    return fav.length ? fav[0] : "";
  }

  function activePlace() {
    return findPlace(activePlaceId());
  }

  function comparePlace() {
    var id = loadCompare();
    var active = activePlaceId();
    if (!id || id === active) return null;
    return findPlace(id);
  }

  function currentSeason() {
    var m = new Date().getMonth(); // 0–11
    if (m >= 2 && m <= 4) return "spring";
    if (m >= 5 && m <= 7) return "summer";
    if (m >= 8 && m <= 10) return "fall";
    return "winter";
  }

  function seasonLabel(season) {
    var s = String(season || currentSeason());
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function speciesForPlace(placeId) {
    var id = migratePlaceId(placeId);
    var list = SPECIES_BY_PLACE[id];
    return Array.isArray(list) ? list.slice() : [];
  }

  function roleLabel(role) {
    var r = String(role || "unknown").toLowerCase();
    if (r === "native") return "Native here";
    if (r === "invasive") return "Invasive here";
    if (r === "introduced") return "Introduced here";
    if (r === "planted") return "Often planted";
    if (r === "houseplant") return "Houseplant (not wild here)";
    return "Status unclear for this lens";
  }

  function apiPlacePayload() {
    var place = activePlace();
    var compare = comparePlace();
    return {
      placeId: place ? place.placeId : "",
      placeLabel: place ? place.label : "",
      region: place ? place.region || "" : "",
      habitat: place ? place.habitat || "" : "",
      habitatOnly: !!(place && place.habitatOnly),
      comparePlaceId: compare ? compare.placeId : "",
      comparePlaceLabel: compare ? compare.label : "",
      season: currentSeason(),
    };
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fillSelect(sel, selectedId, includeSkip) {
    if (!sel) return;
    var bits = [];
    if (includeSkip) {
      bits.push('<option value="">Skip place (habitat cues only later)</option>');
    }
    var favIds = loadFavorites();
    var favSet = Object.create(null);
    for (var f = 0; f < favIds.length; f++) favSet[favIds[f]] = true;

    var favPlaces = [];
    var otherPlaces = [];
    for (var i = 0; i < PLACES.length; i++) {
      var p = PLACES[i];
      if (favSet[p.placeId]) favPlaces.push(p);
      else otherPlaces.push(p);
    }

    function optGroup(label, list) {
      if (!list.length) return;
      bits.push('<optgroup label="' + escapeHtml(label) + '">');
      for (var j = 0; j < list.length; j++) {
        var pl = list[j];
        bits.push(
          '<option value="' +
            escapeHtml(pl.placeId) +
            '"' +
            (pl.placeId === selectedId ? " selected" : "") +
            ">" +
            escapeHtml(pl.initials + " · " + pl.label) +
            "</option>"
        );
      }
      bits.push("</optgroup>");
    }

    optGroup("Favorites", favPlaces);
    optGroup(favPlaces.length ? "All places" : "Places", otherPlaces);
    sel.innerHTML = bits.join("");
  }

  function renderBrowseList(host, placeId) {
    if (!host) return;
    var place = findPlace(placeId);
    var list = speciesForPlace(placeId);
    if (!place) {
      host.innerHTML =
        '<p class="place-lens__browse-empty">Pick a place above to browse species you might see there (native and invasive). BoE does not use GPS — this is only the place you’re looking at.</p>';
      return;
    }
    if (!list.length) {
      host.innerHTML =
        '<p class="place-lens__browse-empty">No starter species pack for <strong>' +
        escapeHtml(place.label) +
        "</strong> yet. Regional packs will grow over time.</p>";
      return;
    }
    var bits = [];
    bits.push(
      '<p class="place-lens__browse-heading">You might see near <strong>' +
        escapeHtml(place.label) +
        "</strong> <span class=\"place-lens__season\">(" +
        escapeHtml(seasonLabel()) +
        ")</span></p>"
    );
    bits.push('<ul class="place-lens__species" role="list">');
    for (var i = 0; i < list.length; i++) {
      var sp = list[i];
      bits.push(
        '<li class="place-lens__species-item">' +
          '<span class="place-lens__role place-lens__role--' +
          escapeHtml(sp.role || "unknown") +
          '">' +
          escapeHtml(roleLabel(sp.role)) +
          "</span> " +
          "<strong>" +
          escapeHtml(sp.common) +
          "</strong> " +
          '<em class="place-lens__latin">' +
          escapeHtml(sp.latin) +
          "</em>" +
          '<p class="place-lens__species-note">' +
          escapeHtml(sp.note || "") +
          "</p></li>"
      );
    }
    bits.push("</ul>");
    host.innerHTML = bits.join("");
  }

  function renderPlaceLensUi(root) {
    if (!root) return;
    var fav = loadFavorites();
    var favSet = Object.create(null);
    for (var i = 0; i < fav.length; i++) favSet[fav[i]] = true;

    var looking = activePlaceId();
    var compareId = loadCompare();
    if (compareId && compareId === looking) compareId = "";

    var bits = [];
    bits.push('<div class="place-lens">');
    bits.push('<p class="place-lens__heading">Looking-at places</p>');
    bits.push(
      '<p class="place-lens__hint">Like Halalit favorite libraries: check places you care about. Facts follow the place you’re <strong>looking at</strong> — not GPS. For all BoE knows, you’re reading about somewhere you know.</p>'
    );

    bits.push('<p class="place-lens__sub">Your favorite places</p>');
    bits.push('<ul class="place-lens__fav-list" role="list">');
    for (var p = 0; p < PLACES.length; p++) {
      var place = PLACES[p];
      var cid = "baneFav_" + place.placeId;
      bits.push(
        '<li class="place-lens__fav-item">' +
          '<label class="place-lens__fav-label" for="' +
          escapeHtml(cid) +
          '">' +
          '<input type="checkbox" class="place-lens__fav-check" id="' +
          escapeHtml(cid) +
          '" data-place-id="' +
          escapeHtml(place.placeId) +
          '"' +
          (favSet[place.placeId] ? " checked" : "") +
          " /> " +
          '<span><strong class="place-lens__initials">' +
          escapeHtml(place.initials) +
          "</strong> " +
          escapeHtml(place.label) +
          (place.habitatOnly
            ? ' <span class="place-lens__tag">habitat only</span>'
            : "") +
          "</span></label></li>"
      );
    }
    bits.push("</ul>");

    bits.push('<div class="place-lens__controls">');
    bits.push(
      '<label class="place-lens__field" for="baneLookingAt">Looking at' +
        '<select id="baneLookingAt" class="place-lens__select"></select></label>'
    );
    bits.push(
      '<label class="place-lens__field" for="baneComparePlace">Compare with (optional)' +
        '<select id="baneComparePlace" class="place-lens__select"></select></label>'
    );
    bits.push("</div>");

    bits.push(
      '<p class="place-lens__privacy" role="note">No GPS. Season uses today’s date on this device (' +
        escapeHtml(seasonLabel()) +
        ").</p>"
    );
    bits.push('<div class="place-lens__browse" id="banePlaceBrowse"></div>');
    bits.push("</div>");

    root.innerHTML = bits.join("");

    var lookSel = document.getElementById("baneLookingAt");
    var cmpSel = document.getElementById("baneComparePlace");
    fillSelect(lookSel, looking, true);
    fillSelect(cmpSel, compareId, true);
    if (cmpSel) {
      // Extra blank already via includeSkip; relabel first option
      var first = cmpSel.querySelector('option[value=""]');
      if (first) first.textContent = "No compare";
    }

    function refreshBrowseAndNotify() {
      renderBrowseList(
        document.getElementById("banePlaceBrowse"),
        activePlaceId()
      );
      try {
        global.dispatchEvent(
          new CustomEvent("bane-place-lens-change", {
            detail: apiPlacePayload(),
          })
        );
      } catch (e) {}
    }

    root.querySelectorAll(".place-lens__fav-check").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var next = [];
        root.querySelectorAll(".place-lens__fav-check").forEach(function (box) {
          if (box.checked) next.push(box.getAttribute("data-place-id"));
        });
        saveFavorites(next);
        var stillLooking = activePlaceId();
        fillSelect(lookSel, stillLooking, true);
        fillSelect(cmpSel, loadCompare(), true);
        var firstCmp = cmpSel && cmpSel.querySelector('option[value=""]');
        if (firstCmp) firstCmp.textContent = "No compare";
        refreshBrowseAndNotify();
      });
    });

    if (lookSel) {
      lookSel.addEventListener("change", function () {
        saveLookingAt(lookSel.value || "");
        var cmp = loadCompare();
        if (cmp && cmp === (lookSel.value || "")) {
          saveCompare("");
          fillSelect(cmpSel, "", true);
          var fc = cmpSel && cmpSel.querySelector('option[value=""]');
          if (fc) fc.textContent = "No compare";
        }
        refreshBrowseAndNotify();
      });
    }
    if (cmpSel) {
      cmpSel.addEventListener("change", function () {
        var v = cmpSel.value || "";
        if (v && v === activePlaceId()) v = "";
        saveCompare(v);
        refreshBrowseAndNotify();
      });
    }

    refreshBrowseAndNotify();
  }

  global.BanePlaceLens = {
    PLACES: PLACES,
    findPlace: findPlace,
    loadFavorites: loadFavorites,
    saveFavorites: saveFavorites,
    favoritePlaces: favoritePlaces,
    loadLookingAt: loadLookingAt,
    saveLookingAt: saveLookingAt,
    loadCompare: loadCompare,
    saveCompare: saveCompare,
    activePlaceId: activePlaceId,
    activePlace: activePlace,
    comparePlace: comparePlace,
    currentSeason: currentSeason,
    seasonLabel: seasonLabel,
    speciesForPlace: speciesForPlace,
    roleLabel: roleLabel,
    apiPlacePayload: apiPlacePayload,
    renderPlaceLensUi: renderPlaceLensUi,
    renderBrowseList: renderBrowseList,
  };
})(typeof window !== "undefined" ? window : globalThis);
