/**
 * Halalit Bookcheck — how this result was vetted (hand vs AI vs catalog).
 */
(function (global) {
  var SETTLED_HAND_TIERS = {
    verified_clean: true,
    user_discretion: true,
    flag_review: true,
    preview_caution: true,
    fanservice_caution: true,
    deity_comfort: true,
    teen_caution: true,
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function foldAccents(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function extractLatinAuthor(author) {
    var s = String(author || "").trim();
    if (!s) return "";
    var bracket = s.match(/\[([A-Za-z][^\]]+)\]/);
    if (bracket) return bracket[1].trim();
    var latin = s
      .replace(/[\u3000-\u9fff\uf900-\ufaff\u3040-\u30ff]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (/[A-Za-z]{2,}/.test(latin)) return latin;
    return s;
  }

  /**
   * Barcode catalogs often return Japanese titles — map to English hand-vet keys.
   */
  function canonicalBarcodeBook(title, author) {
    var t = String(title || "").trim();
    var a = String(author || "").trim();
    var latin = extractLatinAuthor(a);
    var blob = foldAccents(t + " " + a + " " + latin).toLowerCase();

    if (
      /ポケットモンスター|ポケモン|pocket\s*monsters?\s*special/i.test(t + " " + latin) ||
      (/\bpokemon\b|\bpocket\s*monsters?\b|special/i.test(blob) &&
        /kusaka|hidenori|日下/i.test(a + " " + latin + " " + t))
    ) {
      return {
        title: "Pokemon Adventures",
        author: /kusaka/i.test(latin) ? latin : "Hidenori Kusaka",
      };
    }
    if (/^heidi$/i.test(foldAccents(t).trim())) {
      return {
        title: "Heidi",
        author: /spyri|johanna/i.test(blob)
          ? /spyri/i.test(foldAccents(latin || a))
            ? latin || "Johanna Spyri"
            : latin || a
          : "Johanna Spyri",
      };
    }
    if (/\bheidi\b/i.test(foldAccents(t)) && /spyri|johanna/i.test(blob)) {
      return {
        title: "Heidi",
        author: /spyri/i.test(foldAccents(latin || a)) ? latin || "Johanna Spyri" : latin || a,
      };
    }
    if (/\bfablehaven\b/i.test(foldAccents(t)) && /mull|brandon/i.test(blob)) {
      return {
        title: "Fablehaven",
        author: /mull/i.test(foldAccents(latin || a)) ? latin || "Brandon Mull" : latin || a,
      };
    }
    if (latin && latin !== a) {
      return { title: t, author: latin };
    }
    return { title: t, author: a };
  }

  function handMatchVariants(title, author) {
    var canon = canonicalBarcodeBook(title, author);
    var latin = extractLatinAuthor(author);
    var variants = [];
    var seen = {};
    function push(t, a) {
      var key = foldAccents(String(t || "")).toLowerCase() + "|" + foldAccents(String(a || "")).toLowerCase();
      if (!t || seen[key]) return;
      seen[key] = true;
      variants.push({ title: t, author: a || "" });
    }
    push(title, author);
    push(canon.title, canon.author);
    if (latin && latin !== author) push(title, latin);
    return variants;
  }

  function curatedMatch(title, author) {
    var Cur = global.HalalitCuratedShelfWarnings;
    if (!Cur || typeof Cur.match !== "function") return null;
    return Cur.match(title, author);
  }

  /**
   * Direct hand-vet lookup — title/author variants before catalog noise.
   * @returns {{ tier: string, detail: string, signals: string[], familyAction?: string }|null}
   */
  function resolveHandVetHint(title, author) {
    var Cur = global.HalalitCuratedShelfWarnings;
    var Policy = global.HalalitFamilyShelfPolicy;
    if (!Cur) return null;
    var variants = handMatchVariants(title, author);
    var Ov = global.HalalitOwnerVetsRuntime;
    for (var i = 0; i < variants.length; i++) {
      var t = variants[i].title;
      var a = variants[i].author;
      if (Ov && typeof Ov.matchHandVet === "function") {
        var ownerVet = Ov.matchHandVet(t, a);
        if (ownerVet) {
          if (ownerVet.tier === "verified_clean") {
            var verifiedOwner =
              typeof Ov.verifiedCleanMatch === "function" ? Ov.verifiedCleanMatch(t, a) : ownerVet;
            return {
              tier: "verified_clean",
              detail: (verifiedOwner && verifiedOwner.detail) || ownerVet.detail,
              signals: [],
              familyAction:
                Policy && typeof Policy.familyActionLine === "function"
                  ? Policy.familyActionLine("verified_clean", [], t)
                  : "",
            };
          }
          return {
            tier: ownerVet.tier,
            detail: ownerVet.detail,
            signals: [],
            familyAction:
              Policy && typeof Policy.familyActionLine === "function"
                ? Policy.familyActionLine(ownerVet.tier, [], t)
                : "",
          };
        }
      }
      if (Policy && typeof Policy.hardExclusionDetailForTitle === "function") {
        var hard = Policy.hardExclusionDetailForTitle(t, a);
        if (hard) {
          return {
            tier: "flag_review",
            detail: hard,
            signals: [],
            familyAction:
              Policy && typeof Policy.familyActionLine === "function"
                ? Policy.familyActionLine("flag_review", [], t)
                : "",
          };
        }
      }
      if (typeof Cur.noRecommendKnownFanserviceMatch === "function") {
        var fanservice = Cur.noRecommendKnownFanserviceMatch(t, a);
        if (fanservice) {
          return {
            tier: fanservice.tier || "flag_review",
            detail: fanservice.detail,
            signals: [],
            familyAction:
              Policy && typeof Policy.familyActionLine === "function"
                ? Policy.familyActionLine("flag_review", [], t)
                : "",
          };
        }
      }
      if (typeof Cur.verifiedCleanMatch === "function") {
        var verified = Cur.verifiedCleanMatch(t, a);
        if (verified) {
          return {
            tier: "verified_clean",
            detail: verified.detail,
            ownerAiThemeAbsent: verified.ownerAiThemeAbsent || null,
            signals: [],
            familyAction:
              Policy && typeof Policy.familyActionLine === "function"
                ? Policy.familyActionLine("verified_clean", [], t)
                : "",
          };
        }
      }
      if (typeof Cur.graphicFanserviceCautionMatch === "function") {
        var caution = Cur.graphicFanserviceCautionMatch(t, a);
        if (caution) {
          return {
            tier: caution.tier || "fanservice_caution",
            detail: caution.detail,
            signals: [],
            familyAction:
              Policy && typeof Policy.familyActionLine === "function"
                ? Policy.familyActionLine("fanservice_caution", [], t)
                : "",
          };
        }
      }
      var matched = Cur.match(t, a);
      if (matched) {
        return {
          tier: matched.tier,
          detail: matched.detail,
          agentFlag: !!matched.agentFlag,
          signals: [],
          familyAction:
            Policy && typeof Policy.familyActionLine === "function"
              ? Policy.familyActionLine(matched.tier, [], t)
              : "",
        };
      }
      if (typeof Cur.deityComfortMatch === "function") {
        var deity = Cur.deityComfortMatch(t, a);
        if (deity) {
          return {
            tier: deity.tier || "deity_comfort",
            detail: deity.detail,
            signals: [],
            familyAction:
              Policy && typeof Policy.familyActionLine === "function"
                ? Policy.familyActionLine("deity_comfort", [], t)
                : "",
          };
        }
      }
    }
    return null;
  }

  function titleLooksGraphic(title, author, doc) {
    var Policy = global.HalalitFamilyShelfPolicy;
    if (!Policy) return false;
    if (typeof Policy.titleLooksGraphic === "function" && Policy.titleLooksGraphic(title)) return true;
    if (doc && typeof Policy.inferCatalogFamilyHint === "function") {
      var blob = "";
      if (doc.subject_facet && doc.subject_facet.length) blob = doc.subject_facet.join(" ").toLowerCase();
      else if (doc.subject && doc.subject.length) blob = doc.subject.join(" ").toLowerCase();
      if (blob && typeof Policy.blobLooksGraphic === "function" && Policy.blobLooksGraphic(blob, title)) return true;
      if (typeof Policy.graphicFormatNeedsHandCheck === "function" && Policy.graphicFormatNeedsHandCheck(title, author, blob)) {
        return true;
      }
    }
    return false;
  }

  function resolveAiStagingHint(title, author) {
    var Ai = global.HalalitAiVetStaging;
    if (!Ai || typeof Ai.match !== "function") return null;
    var variants = handMatchVariants(title, author);
    for (var i = 0; i < variants.length; i++) {
      var hit = Ai.match(variants[i].title, variants[i].author);
      if (hit) return hit;
    }
    return null;
  }

  function vetSourceForAiStaging(tier) {
    if (tier === "ai_likely_pass") return "ai_staging_likely_pass";
    if (tier === "ai_manual_review") return "ai_staging_manual_review";
    if (tier === "ai_likely_reject") return "ai_staging_likely_reject";
    return null;
  }

  /**
   * @returns {'hand_vetted'|'owner_rejected'|'agent_flagged'|'ai_staging_likely_pass'|'ai_staging_manual_review'|'ai_staging_likely_reject'|'ai_themes'|'catalog_only'}
   */
  function resolveVetSource(title, author, hintTier, opts) {
    opts = opts || {};
    var Policy = global.HalalitFamilyShelfPolicy;
    if (Policy && typeof Policy.hardExclusionDetailForTitle === "function") {
      if (Policy.hardExclusionDetailForTitle(title, author)) return "owner_rejected";
    }
    var hand = resolveHandVetHint(title, author);
    if (hand && hand.agentFlag) return "agent_flagged";
    var curated = curatedMatch(title, author);
    if (curated && curated.agentFlag) return "agent_flagged";
    if (hand && SETTLED_HAND_TIERS[hand.tier]) return "hand_vetted";
    if (hintTier === "verified_clean" || hintTier === "user_discretion") return "hand_vetted";
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur && typeof Cur.verifiedCleanMatch === "function" && Cur.verifiedCleanMatch(title, author)) {
      return "hand_vetted";
    }
    if (curated && SETTLED_HAND_TIERS[hintTier]) return "hand_vetted";
    if (opts.aiStaging && opts.aiStaging.tier) {
      var staged = vetSourceForAiStaging(opts.aiStaging.tier);
      if (staged) return staged;
    }
    if (opts.aiScanOk) return "ai_themes";
    return "catalog_only";
  }

  function bannerHtml(vetSource, opts) {
    opts = opts || {};
    var experienced = !!opts.experienced;
    var parts = [];
    if (vetSource === "hand_vetted") {
      parts.push(
        '<p class="bookcheck-vet-banner bookcheck-vet-banner--hand"><strong>Hand-checked by Halalit.</strong> ' +
          "Owner vetting—not an AI guess.</p>"
      );
    } else if (vetSource === "owner_rejected") {
      parts.push(
        '<p class="bookcheck-vet-banner bookcheck-vet-banner--reject"><strong>Halalit hand rule.</strong> ' +
          "This title is on our won’t-recommend or flag list.</p>"
      );
    } else if (vetSource === "agent_flagged") {
      parts.push(
        '<p class="bookcheck-vet-banner bookcheck-vet-banner--agent-flag"><strong>Halalit agent flag — not hand-read.</strong> ' +
          (experienced
            ? "Plot flag from agent scan."
            : "Plot flag from Halalit’s agent scan—you haven’t hand-read this book.") +
          "</p>"
      );
    } else if (vetSource === "ai_staging_likely_pass") {
      parts.push(
        '<p class="bookcheck-vet-banner bookcheck-vet-banner--ai-staging-pass"><strong>' +
          (experienced ? "AI likely okay — not hand-checked." : "AI likely okay — not hand-checked.") +
          "</strong> " +
          (experienced
            ? "Theme scan only."
            : "Theme scan only. The owner has not read this cover to cover—it is not verified clean.") +
          "</p>"
      );
    } else if (vetSource === "ai_staging_manual_review") {
      parts.push(
        '<p class="bookcheck-vet-banner bookcheck-vet-banner--ai-staging-review"><strong>' +
          (experienced ? "AI flagged — not hand-checked." : "AI flagged for review — not hand-checked.") +
          "</strong> " +
          (experienced
            ? "Possible concerns from AI."
            : "Possible concerns from AI—not a hand reject. Owner still needs to read it.") +
          "</p>"
      );
    } else if (vetSource === "ai_staging_likely_reject") {
      parts.push(
        '<p class="bookcheck-vet-banner bookcheck-vet-banner--ai-staging-reject"><strong>' +
          (experienced ? "AI likely reject — not hand-checked." : "AI likely rejection — not manually checked.") +
          "</strong> " +
          (experienced
            ? "AI thinks this may fail Halalit rules."
            : "AI thinks this may fail Halalit rules. Not hand-vetted or hand-rejected by the owner yet.") +
          "</p>"
      );
    } else if (vetSource === "ai_themes") {
      parts.push(
        '<p class="bookcheck-vet-banner bookcheck-vet-banner--ai"><strong>' +
          (experienced ? "AI theme scan — not hand-read." : "AI-checked for themes; human vetting takes time.") +
          "</strong> " +
          (experienced
            ? ""
            : "Google AI scanned for Halalit’s theme list (LGBTQ, magic, romance, etc.). " +
              "This is <em>not</em> a hand-read pass and does not mean the book is “safe.”") +
          "</p>"
      );
    } else {
      parts.push(
        '<p class="bookcheck-vet-banner bookcheck-vet-banner--catalog muted"><strong>' +
          (experienced ? "Catalog only — no AI scan." : "Catalog and public sources only.") +
          "</strong> " +
          (experienced ? "" : "AI theme scan did not run or was unavailable—preview if you’re unsure.") +
          "</p>"
      );
    }
    if (opts.fanserviceNotChecked) {
      parts.push(
        '<p class="bookcheck-vet-banner bookcheck-vet-banner--fanservice muted"><strong>' +
          (experienced ? "Comics — preview panels yourself." : "Fanservice / panel art:") +
          "</strong> " +
          (experienced
            ? ""
            : "not checked yet. Halalit does not use AI for comic or manga art—hand-vet or preview the panels yourself.") +
          "</p>"
      );
    }
    if (opts.aiSeriesNote) {
      parts.push(
        '<p class="bookcheck-vet-banner bookcheck-vet-banner--series muted">' + escapeHtml(opts.aiSeriesNote) + "</p>"
      );
    }
    return parts.join("");
  }

  global.HalalitBookcheckVetSource = {
    resolveVetSource: resolveVetSource,
    resolveHandVetHint: resolveHandVetHint,
    resolveAiStagingHint: resolveAiStagingHint,
    canonicalBarcodeBook: canonicalBarcodeBook,
    extractLatinAuthor: extractLatinAuthor,
    bannerHtml: bannerHtml,
    titleLooksGraphic: titleLooksGraphic,
    curatedMatch: curatedMatch,
  };
})(typeof window !== "undefined" ? window : this);
