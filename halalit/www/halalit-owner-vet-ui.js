/**
 * Halalit — owner-only on-site vet form (Owner’s Office + Bookcheck).
 */
(function (global) {
  var DISCRETION_DEFAULT_NOTE =
    "Owner marked reader discretion—some content to weigh yourself. Not fanservice, LGBTQ, or adult-romance auto-reject.";

  var TIER_LABELS = {
    verified_clean: "Hand-checked clean",
    user_discretion: "User's discretion",
    flag_review: "Hand-rejected — no recommend",
    parked: "Parked (off Book Quest)",
    no_recommend_fanservice: "Known fanservice — no recommend",
    fanservice_caution: "Comic caution",
    deity_comfort: "Deity / mythology comfort",
  };

  var REJECT_TIERS = {
    flag_review: true,
    parked: true,
    no_recommend_fanservice: true,
    fanservice_caution: true,
    deity_comfort: true,
  };

  function isRejectTier(tier) {
    return !!(tier && REJECT_TIERS[tier]);
  }

  function isDiscretionTier(tier) {
    return tier === "user_discretion";
  }

  function saveLabelForTier(tier) {
    if (tier === "verified_clean") return "Save vet on site";
    if (isDiscretionTier(tier)) return "Save discretion on site";
    return "Save reject on site";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  /** Tell the browser fields are saved — stops “changes may not be saved” on reload. */
  function markFieldClean(el) {
    if (!el || el.disabled) return;
    var tag = el.tagName;
    if (tag === "SELECT") {
      for (var i = 0; i < el.options.length; i++) {
        el.options[i].defaultSelected = el.options[i].selected;
      }
      return;
    }
    if (el.type === "checkbox" || el.type === "radio") {
      el.defaultChecked = el.checked;
      return;
    }
    if ("defaultValue" in el) el.defaultValue = el.value;
  }

  function markOwnerVetPaneClean(root, id) {
    if (!root) return;
    var form = root.querySelector("#" + id + "Form");
    if (form && form.elements) {
      for (var i = 0; i < form.elements.length; i++) {
        markFieldClean(form.elements[i]);
      }
    }
    var extraIds = [id + "SeriesName", id + "SeriesAuthor", id + "SeriesMax"];
    for (var j = 0; j < extraIds.length; j++) {
      markFieldClean(root.querySelector("#" + extraIds[j]));
    }
  }

  function formHtml(opts) {
    opts = opts || {};
    var id = opts.idPrefix || "ownerVet";
    return (
      '<form class="owner-vet-form" id="' +
      id +
      'Form">' +
      '<label class="owner-vet-field">Title<input type="text" id="' +
      id +
      'Title" required autocomplete="off" /></label>' +
      '<label class="owner-vet-field">Author <span class="muted">(optional)</span><input type="text" id="' +
      id +
      'Author" autocomplete="off" /></label>' +
      '<label class="owner-vet-field">Verdict<select id="' +
      id +
      'Tier">' +
      '<option value="verified_clean">Hand-checked clean</option>' +
      '<option value="user_discretion">User\'s discretion</option>' +
      '<option value="flag_review">Hand-reject — no recommend</option>' +
      '<option value="parked">Parked (off Book Quest)</option>' +
      '<option value="no_recommend_fanservice">Known fanservice</option>' +
      '<option value="fanservice_caution">Comic caution</option>' +
      '<option value="deity_comfort">Deity / mythology comfort</option>' +
      "</select></label>" +
      '<div id="' +
      id +
      'AgeWrap" class="owner-vet-age-wrap">' +
      '<label class="owner-vet-field">Age band<select id="' +
      id +
      'Age">' +
      '<option value="young_child">Kids</option>' +
      '<option value="older_child_young_teen" selected>Older kids</option>' +
      '<option value="older_teen_adult">Teens / Adults</option>' +
      "</select></label></div>" +
      '<label class="owner-vet-field">Note for Bookcheck<textarea id="' +
      id +
      'Detail" rows="3" maxlength="4000" placeholder="Short note readers may see on Bookcheck"></textarea></label>' +
      '<div id="' +
      id +
      'FlagsWrap" class="owner-vet-flags">' +
      (global.HalalitOwnerVetFlags && global.HalalitOwnerVetFlags.flagsHtml
        ? global.HalalitOwnerVetFlags.flagsHtml(id)
        : "") +
      "</div>" +
      '<button type="submit" class="import-btn owner-vet-save" id="' +
      id +
      'SaveBtn">Save vet on site</button>' +
      '<p class="owner-vet-status muted" id="' +
      id +
      'Status" aria-live="polite"></p>' +
      "</form>" +
      seriesBulkHtml(id)
    );
  }

  function seriesBulkHtml(id) {
    return (
      '<details class="office-section office-section--nested owner-vet-series-wrap" id="' +
      id +
      'SeriesSection">' +
      '<summary class="office-section__summary">' +
      '<span class="office-section__title"><strong>Whole series</strong></span>' +
      '<span class="office-section__toggle" aria-hidden="true"></span>' +
      "</summary>" +
      '<div class="office-section__body">' +
      '<p class="muted owner-vet-series-lead">Halalit finds numbered volumes in the public catalog, then saves each book with the same verdict, note, age band, and flags as the single-title form above.</p>' +
      '<label class="owner-vet-field">Series name<input type="text" id="' +
      id +
      'SeriesName" autocomplete="off" placeholder="e.g. Fablehaven" /></label>' +
      '<label class="owner-vet-field">Series author <span class="muted">(helps accuracy)</span><input type="text" id="' +
      id +
      'SeriesAuthor" autocomplete="off" /></label>' +
      '<label class="owner-vet-field">Max books <span class="muted">(optional — blank = all found, up to 50)</span><input type="number" id="' +
      id +
      'SeriesMax" min="1" max="50" step="1" inputmode="numeric" /></label>' +
      '<div class="owner-vet-mode-row" role="group" aria-label="Series vet or reject">' +
      '<button type="button" class="copy-btn" id="' +
      id +
      'SeriesVetBtn">Vet whole series</button>' +
      '<button type="button" class="copy-btn" id="' +
      id +
      'SeriesDiscretionBtn">Discretion whole series</button>' +
      '<button type="button" class="copy-btn" id="' +
      id +
      'SeriesRejectBtn">Reject whole series</button>' +
      "</div>" +
      '<p class="owner-vet-status muted" id="' +
      id +
      'SeriesStatus" aria-live="polite"></p>' +
      "</div></details>"
    );
  }

  function seriesDetailNote(seriesName, tier, baseDetail) {
    var tag = "Series: " + seriesName;
    if (baseDetail) return baseDetail + " · " + tag;
    if (tier === "verified_clean") return "Hand-vetted on site — " + seriesName + " series.";
    if (isDiscretionTier(tier)) return "Reader discretion on site — " + seriesName + " series.";
    return "Hand-rejected on site — " + seriesName + " series.";
  }

  function seriesTierForMode(root, id, mode) {
    if (mode === "vet") return "verified_clean";
    if (mode === "discretion") return "user_discretion";
    var tierEl = root.querySelector("#" + id + "Tier");
    var picked = tierEl ? tierEl.value : "flag_review";
    return isRejectTier(picked) ? picked : "flag_review";
  }

  function readVetPayloadFields(root, id, tier) {
    var detailEl = root.querySelector("#" + id + "Detail");
    var payload = {
      tier: tier,
      detail: detailEl ? String(detailEl.value || "").trim() : "",
    };
    if (tier === "verified_clean") {
      var ageEl = root.querySelector("#" + id + "Age");
      if (ageEl) payload.ageBand = ageEl.value;
      payload.flags =
        global.HalalitOwnerVetFlags && global.HalalitOwnerVetFlags.readFlags
          ? global.HalalitOwnerVetFlags.readFlags(root, id)
          : {};
    }
    return payload;
  }

  function wireSeriesBulk(root, opts) {
    opts = opts || {};
    var id = opts.idPrefix || "ownerVet";
    var section = root.querySelector("#" + id + "SeriesSection");
    if (!section || section.getAttribute("data-series-wired") === "1") return;
    section.setAttribute("data-series-wired", "1");
    var statusEl = root.querySelector("#" + id + "SeriesStatus");
    var busy = false;

    function runSeries(mode) {
      if (busy) return;
      var Store = global.HalalitAccountStorage;
      var Runtime = global.HalalitOwnerVetsRuntime;
      var SE = global.HalalitSeriesExpand;
      if (!Store || !Store.isSignedIn() || !Store.isOwner()) {
        if (statusEl) statusEl.textContent = "Owner sign-in required.";
        return;
      }
      if (!Runtime || !Runtime.saveVetSeries || !SE || typeof SE.expandIntentToBooks !== "function") {
        if (statusEl) statusEl.textContent = "Series lookup is not available here.";
        return;
      }
      var seriesName = root.querySelector("#" + id + "SeriesName");
      var seriesAuthor = root.querySelector("#" + id + "SeriesAuthor");
      var seriesMax = root.querySelector("#" + id + "SeriesMax");
      var name = seriesName ? String(seriesName.value || "").trim() : "";
      var author = seriesAuthor ? String(seriesAuthor.value || "").trim() : "";
      if (!name) {
        if (statusEl) statusEl.textContent = "Type a series name first.";
        return;
      }
      var maxRaw = seriesMax ? parseInt(String(seriesMax.value || "").trim(), 10) : NaN;
      var intent = {
        searchTitle: name,
        author: author,
        mode: maxRaw > 0 && maxRaw <= 50 ? "first" : "all",
      };
      if (intent.mode === "first") intent.firstCount = maxRaw;
      var tier = seriesTierForMode(root, id, mode);
      busy = true;
      if (statusEl) statusEl.textContent = "Looking up “" + name + "” in the catalog…";
      SE.expandIntentToBooks(intent)
        .then(function (result) {
          result = result || {};
          var books = result.books || [];
          if (!books.length) {
            busy = false;
            if (statusEl) {
              statusEl.textContent =
                result.message || "No numbered volumes found for that series. Try adding the author.";
            }
            return;
          }
          var fields = readVetPayloadFields(root, id, tier);
          fields.seriesLabel = name;
          fields.detail = seriesDetailNote(name, tier, fields.detail);
          fields.books = books;
          if (statusEl) {
            statusEl.textContent =
              "Saving " + books.length + " title" + (books.length === 1 ? "" : "s") + "…";
          }
          return Runtime.saveVetSeries(fields).then(function (res) {
            busy = false;
            if (res && res.ok) {
              markOwnerVetPaneClean(root, id);
              if (statusEl) {
                statusEl.textContent =
                  (isRejectTier(tier) ? "Rejected " : isDiscretionTier(tier) ? "Saved discretion for " : "Vetted ") +
                  (res.count || books.length) +
                  " book" +
                  ((res.count || books.length) === 1 ? "" : "s") +
                  " — live on Bookcheck now.";
              }
              if (typeof opts.onSaved === "function") opts.onSaved(res);
            } else if (statusEl) {
              statusEl.textContent = "Could not save the series. Try again.";
            }
          });
        })
        .catch(function () {
          busy = false;
          if (statusEl) statusEl.textContent = "Series lookup failed. Check your connection.";
        });
    }

    var vetBtn = root.querySelector("#" + id + "SeriesVetBtn");
    var discretionBtn = root.querySelector("#" + id + "SeriesDiscretionBtn");
    var rejectBtn = root.querySelector("#" + id + "SeriesRejectBtn");
    if (vetBtn) vetBtn.addEventListener("click", function () { runSeries("vet"); });
    if (discretionBtn) discretionBtn.addEventListener("click", function () { runSeries("discretion"); });
    if (rejectBtn) rejectBtn.addEventListener("click", function () { runSeries("reject"); });
  }

  function wireForm(root, opts) {
    opts = opts || {};
    var id = opts.idPrefix || "ownerVet";
    var form = root.querySelector("#" + id + "Form");
    if (!form || form.getAttribute("data-wired") === "1") return;
    form.setAttribute("data-wired", "1");
    var tierEl = root.querySelector("#" + id + "Tier");
    var ageWrap = root.querySelector("#" + id + "AgeWrap");
    var flagsWrap = root.querySelector("#" + id + "FlagsWrap");
    var statusEl = root.querySelector("#" + id + "Status");
    var saveBtn = root.querySelector("#" + id + "SaveBtn");

    function syncTierUi() {
      var tier = tierEl ? tierEl.value : "verified_clean";
      var clean = tier === "verified_clean";
      if (ageWrap) ageWrap.hidden = !clean;
      if (flagsWrap) flagsWrap.hidden = !clean;
      if (saveBtn) {
        saveBtn.textContent = saveLabelForTier(tier);
        saveBtn.classList.toggle("owner-vet-save--reject", isRejectTier(tier));
        saveBtn.classList.toggle("owner-vet-save--discretion", isDiscretionTier(tier));
      }
    }
    if (tierEl) {
      tierEl.addEventListener("change", syncTierUi);
      syncTierUi();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var Store = global.HalalitAccountStorage;
      var Runtime = global.HalalitOwnerVetsRuntime;
      if (!Store || !Store.isSignedIn() || !Store.isOwner()) {
        if (statusEl) statusEl.textContent = "Owner sign-in required.";
        return;
      }
      if (!Runtime || !Runtime.saveVet) return;
      var tier = tierEl ? tierEl.value : "verified_clean";
      var payload = {
        title: root.querySelector("#" + id + "Title").value.trim(),
        author: root.querySelector("#" + id + "Author").value.trim(),
        tier: tier,
        detail: root.querySelector("#" + id + "Detail").value.trim(),
      };
      if (tier === "verified_clean") {
        payload.ageBand = root.querySelector("#" + id + "Age").value;
        payload.flags =
          global.HalalitOwnerVetFlags && global.HalalitOwnerVetFlags.readFlags
            ? global.HalalitOwnerVetFlags.readFlags(root, id)
            : {};
      }
      if (statusEl) statusEl.textContent = "Saving…";
      Runtime.saveVet(payload).then(function (res) {
        if (res && res.ok) {
          if (statusEl) {
            statusEl.textContent = isRejectTier(tier)
              ? "Rejected on site — live on Bookcheck now."
              : isDiscretionTier(tier)
                ? "Saved as reader discretion — live on Bookcheck now."
                : "Saved — live on Bookcheck now.";
          }
          markOwnerVetPaneClean(root, id);
          if (typeof opts.onSaved === "function") opts.onSaved(res.entry);
        } else if (statusEl) {
          statusEl.textContent = "Could not save. Try again.";
        }
      });
    });
    markOwnerVetPaneClean(root, id);
    wireSeriesBulk(root, opts);
  }

  function fillForm(root, title, author, opts) {
    opts = opts || {};
    var id = opts.idPrefix || "ownerVet";
    var titleEl = root.querySelector("#" + id + "Title");
    var authorEl = root.querySelector("#" + id + "Author");
    var tierEl = root.querySelector("#" + id + "Tier");
    var detailEl = root.querySelector("#" + id + "Detail");
    if (titleEl && title) titleEl.value = title;
    if (authorEl) authorEl.value = author || "";
    var Runtime = global.HalalitOwnerVetsRuntime;
    var loadedExisting = false;
    if (Runtime && Runtime.findEntry && title) {
      var existing = Runtime.findEntry(title, author || "");
      if (existing) {
        loadedExisting = true;
        if (tierEl) tierEl.value = existing.tier;
        if (detailEl) detailEl.value = existing.detail || "";
        if (existing.ageBand) {
          var ageEl = root.querySelector("#" + id + "Age");
          if (ageEl) ageEl.value = existing.ageBand;
        }
        if (global.HalalitOwnerVetFlags && global.HalalitOwnerVetFlags.writeFlags) {
          global.HalalitOwnerVetFlags.writeFlags(root, id, existing.flags || {});
        }
      }
    }
    if (!loadedExisting && opts.presetTier && tierEl) {
      tierEl.value = opts.presetTier;
      if (detailEl && !String(detailEl.value || "").trim()) {
        if (isRejectTier(opts.presetTier)) detailEl.value = "Hand-rejected on site by the owner.";
        else if (isDiscretionTier(opts.presetTier)) detailEl.value = DISCRETION_DEFAULT_NOTE;
      }
    }
    if (tierEl) tierEl.dispatchEvent(new Event("change"));
    var seriesNameEl = root.querySelector("#" + id + "SeriesName");
    var seriesAuthorEl = root.querySelector("#" + id + "SeriesAuthor");
    if (opts.fillSeries && seriesNameEl && title) seriesNameEl.value = title;
    if (opts.fillSeries && seriesAuthorEl && author) seriesAuthorEl.value = author;
    markOwnerVetPaneClean(root, id);
  }

  function isCleanVetted(title, author) {
    var Runtime = global.HalalitOwnerVetsRuntime;
    if (Runtime && Runtime.findEntry) {
      var onSite = Runtime.findEntry(title, author || "");
      if (onSite && onSite.tier === "verified_clean") return true;
    }
    var VS = global.HalalitBookcheckVetSource;
    if (VS && typeof VS.resolveHandVetHint === "function") {
      var hint = VS.resolveHandVetHint(title, author || "");
      if (hint && hint.tier === "verified_clean") return true;
    }
    return false;
  }

  function hasOnSiteReject(title, author) {
    var Runtime = global.HalalitOwnerVetsRuntime;
    if (!Runtime || !Runtime.findEntry) return false;
    var onSite = Runtime.findEntry(title, author || "");
    return !!(onSite && isRejectTier(onSite.tier));
  }

  function hasOnSiteDiscretion(title, author) {
    var Runtime = global.HalalitOwnerVetsRuntime;
    if (!Runtime || !Runtime.findEntry) return false;
    var onSite = Runtime.findEntry(title, author || "");
    return !!(onSite && isDiscretionTier(onSite.tier));
  }

  /** True when hand-vet, on-site reject/discretion, or coded shelf rules already settled this title. */
  function isHandSettled(title, author) {
    if (isCleanVetted(title, author)) return true;
    if (hasOnSiteReject(title, author)) return true;
    if (hasOnSiteDiscretion(title, author)) return true;
    var VS = global.HalalitBookcheckVetSource;
    if (VS && typeof VS.resolveHandVetHint === "function") {
      var hint = VS.resolveHandVetHint(title, author || "");
      if (hint && hint.tier) {
        if (hint.tier === "verified_clean" || isDiscretionTier(hint.tier)) return true;
        if (isRejectTier(hint.tier)) return true;
        if (
          hint.tier === "flag_review" ||
          hint.tier === "preview_caution" ||
          hint.tier === "teen_caution" ||
          hint.tier === "fanservice_caution"
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function presetFormMode(root, opts) {
    opts = opts || {};
    fillForm(root, opts.title || "", opts.author || "", opts);
  }

  function renderVetList(container, list, onDelete) {
    if (!container) return;
    container.innerHTML = "";
    if (!list || !list.length) {
      container.textContent = "No on-site vets yet.";
      return;
    }
    list.forEach(function (entry) {
      var row = document.createElement("div");
      row.className = "owner-vet-list-item";
      var label = TIER_LABELS[entry.tier] || entry.tier;
      row.innerHTML =
        "<strong>" +
        escapeHtml(entry.title) +
        "</strong>" +
        (entry.author ? " <span class=\"muted\">by " + escapeHtml(entry.author) + "</span>" : "") +
        " — " +
        escapeHtml(label) +
        (entry.ageBand ? " · " + escapeHtml(entry.ageBand.replace(/_/g, " ")) : "") +
        (entry.source === "cursor_roster" ? " <span class=\"muted\">· Cursor list</span>" : "");
      if (onDelete) {
        var del = document.createElement("button");
        del.type = "button";
        del.className = "copy-btn";
        del.textContent = "Remove";
        del.addEventListener("click", function () {
          onDelete(entry);
        });
        row.appendChild(del);
      }
      container.appendChild(row);
    });
  }

  global.HalalitOwnerVetUi = {
    formHtml: formHtml,
    wireForm: wireForm,
    wireSeriesBulk: wireSeriesBulk,
    fillForm: fillForm,
    presetFormMode: presetFormMode,
    isCleanVetted: isCleanVetted,
    hasOnSiteReject: hasOnSiteReject,
    hasOnSiteDiscretion: hasOnSiteDiscretion,
    isHandSettled: isHandSettled,
    isRejectTier: isRejectTier,
    isDiscretionTier: isDiscretionTier,
    renderVetList: renderVetList,
  };
})(typeof window !== "undefined" ? window : this);
