/**
 * Halalit Bookcheck — Google Gemini theme scan (server-side API).
 */
(function (global) {
  var EXCLUDE_FROM_AI_BLOB = {
    sexual_content: true,
    graphic_format: true,
  };

  var LGBTQ_EVIDENCE_RE =
    /\b(?:lgbtq\+?|lesbian|gay\b|homosexual|queer\b|bisexual|pansexual|asexual|aromantic|transgender|non[- ]?binary|gender[- ]fluid|gender[- ]nonconforming|they\/them|two[- ]moms?|two[- ]dads?|same[- ]sex|enby|sapphic)\b/i;

  var LGBTQ_ABSENT_RE =
    /\bno (?:explicit )?(?:mention of )?lgbtq|no lgbtq|without (?:explicit )?lgbtq|(?:do|does) not (?:contain|include|feature|indicate|show|depict)|not indicate any lgbtq|no (?:gay|lesbian|queer|transgender|non[- ]binary)\b|(?:no|not) confirmed on[- ]page(?:\s+(?:lgbtq|representation|lgbtq\+?\s*representation))?|reader speculation or subtext only|not confirmed on[- ]page lgbtq|(?:does|do) not feature confirmed on[- ]page|not feature confirmed on[- ]page|heterosexual romance\b[^.!?]{0,96}\b(?:does|do) not feature\b/i;

  var PROJECTION_ONLY_RE =
    /\b(?:could be read as|read as queer|some readers?|fans? speculate|fan theor(?:y|ies)|shipping|subtext only|not explicitly|no explicit|may be queer|hope (?:for|they)|projecting|queer coding|wlw subtext|sapphic subtext|ambiguous friendship|close friendship between girls|fangirl(?:ing)? over|not openly lgbtq|none of the characters is openly)\b/i;

  var EXPLICIT_LGBTQ_IN_STORY_RE =
    /\b(?:wouldn['’]t matter if (?:she|he|they) were attracted|attracted to (?:her|his|their) (?:female|male|same[- ]sex)|same[- ]sex (?:crush|attraction|couple|relationship|parents|marriage)|two moms?|two dads?|two mothers?|two fathers?|(?:openly )?(?:gay|lesbian|bisexual|queer|transgender|non[- ]?binary) character|don['’]t assume (?:she|he|they)['’]?s straight)\b/i;

  var MATURE_ADULT_ROMANCE_RE =
    /\b(?:college|university|campus|new adult|\bna fiction\b|mature[- ]rated|explicit|open[- ]door|sexual content|erotic romance|graphic romance|off[- ]campus|hockey romance)\b/i;

  var EXPLICIT_ADULT_ROMANCE_RE =
    /\b(?:explicit|open[- ]door|sexual content|sex scenes|erotic romance|graphic romance)\b/i;

  function lgbtqBriefDeniesContent(text) {
    return LGBTQ_ABSENT_RE.test(String(text || ""));
  }

  /** Romance/other theme briefs that mainly deny on-page LGBTQ — not a separate plot flag. */
  function themeBriefEmbedsLgbtqDenial(text) {
    var t = String(text || "");
    if (!t.trim()) return false;
    if (lgbtqBriefDeniesContent(t)) return true;
    return /\b(?:does|do) not feature\b[^.!?]{0,72}\b(?:lgbtq|on[- ]page)\b/i.test(t);
  }

  function stripLgbtqDenialClause(text) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    t = t.replace(
      /\s*(?:[,;]|—|–|-|\band\b)\s*(?:it\s+)?(?:does|do)\s+not\s+feature\b[^.!?]*(?:[.!?]|$)/gi,
      "."
    );
    t = t.replace(
      /\s*(?:[,;]|—|–|-)\s*(?:there\s+(?:is|are)\s+)?(?:no|not)\b[^.!?]*(?:on[- ]page\s+)?lgbtq[^.!?]*(?:[.!?]|$)/gi,
      "."
    );
    return t.replace(/\s+/g, " ").replace(/\.\s*\./g, ".").trim().replace(/\.$/, "");
  }

  function sanitizeNonLgbtqThemeBriefs(data) {
    if (!data || !data.themes) return data;
    for (var i = 0; i < data.themes.length; i++) {
      var row = data.themes[i];
      if (!row || row.id === "lgbtq" || !row.brief) continue;
      if (!themeBriefEmbedsLgbtqDenial(row.brief)) continue;
      var cleaned = stripLgbtqDenialClause(row.brief);
      if (!cleaned || themeBriefEmbedsLgbtqDenial(cleaned)) {
        row.present = false;
        continue;
      }
      row.brief = cleaned;
    }
    return data;
  }

  function themeBriefIsProjectionOnly(text) {
    var t = String(text || "");
    if (!t.trim()) return false;
    if (EXPLICIT_LGBTQ_IN_STORY_RE.test(t)) return false;
    return PROJECTION_ONLY_RE.test(t);
  }

  function downgradeProjectionThemes(data) {
    if (!data || !data.themes) return data;
    for (var i = 0; i < data.themes.length; i++) {
      var row = data.themes[i];
      if (!row || !row.present) continue;
      if (row.id === "lgbtq" && themeBriefIsProjectionOnly(row.brief)) {
        row.present = false;
        if (!row.brief || !lgbtqBriefDeniesContent(row.brief)) {
          row.brief =
            (row.brief ? row.brief + " " : "") +
            "Reader speculation or subtext only—not confirmed on-page LGBTQ representation.";
        }
      }
      if (row.id === "deity_mythology" && themeBriefIsProjectionOnly(row.brief)) {
        row.present = false;
      }
      if (row.id === "romantic_tension" && themeBriefIsProjectionOnly(row.brief)) {
        row.present = false;
      }
    }
    return data;
  }

  function filterAiResultForOwnerAbsent(aiResult, ownerAiThemeAbsent) {
    if (!aiResult || !ownerAiThemeAbsent) return aiResult;
    var out = Object.assign({}, aiResult);
    if (!out.themes) return out;
    out.themes = out.themes.filter(function (row) {
      return !(row && row.id && ownerAiThemeAbsent[row.id]);
    });
    return out;
  }

  function filterAiSignalsForOwnerAbsent(signals, ownerAiThemeAbsent) {
    if (!ownerAiThemeAbsent || !signals || !signals.length) return signals || [];
    return signals.filter(function (sig) {
      var s = String(sig || "");
      if (ownerAiThemeAbsent.lgbtq && /AI scan:.*lgbtq/i.test(s)) return false;
      if (ownerAiThemeAbsent.deity_mythology && /AI scan:.*deity|AI scan:.*mythology/i.test(s)) return false;
      if (ownerAiThemeAbsent.romantic_tension && /AI scan:.*romantic/i.test(s)) return false;
      return true;
    });
  }

  function otherAiLgbtqEvidenceBlob(data, lgbtqRow) {
    var parts = [String(data.seriesNote || "")];
    for (var i = 0; i < data.themes.length; i++) {
      var row = data.themes[i];
      if (!row || row === lgbtqRow || row.id === "lgbtq") continue;
      parts.push(String(row.brief || ""));
    }
    return parts.join(" ");
  }

  function aiThemeRow(themes, id) {
    for (var i = 0; i < themes.length; i++) {
      if (themes[i] && themes[i].id === id) return themes[i];
    }
    return null;
  }

  function enforceAdultRomanceTheme(data) {
    if (!data || !data.themes) return data;
    var blobParts = [String(data.seriesNote || "")];
    for (var i = 0; i < data.themes.length; i++) {
      blobParts.push(String((data.themes[i] && data.themes[i].brief) || ""));
    }
    var blob = blobParts.join(" ");
    var adultRow = aiThemeRow(data.themes, "adult_romance");
    if (adultRow && themeBriefDeniesPresence("adult_romance", adultRow.brief)) {
      adultRow.present = false;
      return data;
    }
    if (!blobAffirmsMatureRomance(blob)) return data;

    var adult = aiThemeRow(data.themes, "adult_romance");
    var tension = aiThemeRow(data.themes, "romantic_tension");
    if (!adult) {
      adult = { id: "adult_romance", present: true, confidence: "medium", brief: "" };
      data.themes.push(adult);
    } else {
      adult.present = true;
    }
    if (tension && tension.present) {
      var tensionBlob = String(tension.brief || "") + " " + blob;
      if (MATURE_ADULT_ROMANCE_RE.test(tensionBlob)) tension.present = false;
    }
    var brief = String(adult.brief || "").trim();
    if (!brief || !/mature|rated|explicit|college|new adult/i.test(brief)) {
      if (EXPLICIT_ADULT_ROMANCE_RE.test(blob)) {
        adult.brief = "Explicit mature-rated romance is central to the plot—not all-ages.";
      } else if (/college|university|campus/i.test(blob)) {
        adult.brief = "Mature-rated college romance is central to the plot—not all-ages.";
      } else {
        adult.brief = "Mature-rated romantic relationship is a major plot thread—not all-ages.";
      }
    }
    if (!adult.confidence || adult.confidence === "unknown" || adult.confidence === "low") {
      adult.confidence = "medium";
    }
    return data;
  }

  function finishAiThemeScan(data) {
    data = enforceAdultRomanceTheme(data);
    return enforceAbsentBriefs(data);
  }

  function normalizeAiThemeScan(data) {
    data = data || {};
    if (!data.ok || !data.themes || !data.themes.length) return data;
    data = downgradeProjectionThemes(data);
    data = sanitizeNonLgbtqThemeBriefs(data);
    var lgbtq = null;
    for (var j = 0; j < data.themes.length; j++) {
      if (data.themes[j] && data.themes[j].id === "lgbtq") {
        lgbtq = data.themes[j];
        break;
      }
    }
    if (lgbtq && !lgbtq.present && lgbtqBriefDeniesContent(lgbtq.brief)) {
      if (!lgbtqAffirmativeEvidence(otherAiLgbtqEvidenceBlob(data, lgbtq))) return finishAiThemeScan(data);
    }
    if (lgbtq && lgbtq.present && themeBriefIsProjectionOnly(lgbtq.brief)) {
      lgbtq.present = false;
      return finishAiThemeScan(data);
    }
    var blob = String(data.seriesNote || "");
    for (var i = 0; i < data.themes.length; i++) {
      var theme = data.themes[i];
      if (theme && theme.id === "lgbtq" && theme === lgbtq && !theme.present) continue;
      blob += " " + String((theme && theme.brief) || "");
    }
    if (!lgbtqAffirmativeEvidence(blob)) return finishAiThemeScan(data);
    if (!lgbtq) {
      lgbtq = { id: "lgbtq", present: true, confidence: "medium", brief: "LGBTQ representation noted in scan text." };
      data.themes.push(lgbtq);
    } else if (!lgbtq.present) {
      lgbtq.present = true;
      if (!lgbtq.brief) lgbtq.brief = "LGBTQ representation noted in scan text.";
      if (!lgbtq.confidence || lgbtq.confidence === "unknown" || lgbtq.confidence === "low") {
        lgbtq.confidence = "medium";
      }
    }
    return finishAiThemeScan(data);
  }

  var ADULT_ROMANCE_ABSENT_RE =
    /\b(?:not|no)\s+(?:a\s+)?(?:mature[- ]rated|explicit|adult romance)|not mature[- ]rated or explicit|not a mature[- ]rated or explicit|clean and age[- ]appropriate|typical for a ya|would be clean|age[- ]appropriate, not|age[- ]appropriate romantic subplot|not a major plot thread|ya[- ]level clean|clean romantic subplot/i;

  /** Themes that must not feed catalog policy when brief only describes clean/YA audience. */
  var EXCLUDE_AUDIENCE_FROM_POLICY_BLOB = {
    teen_ya_age: true,
  };

  function isCleanYaOnlyBrief(text) {
    var t = String(text || "");
    if (!t.trim()) return false;
    if (ADULT_ROMANCE_ABSENT_RE.test(t)) return true;
    return /\b(?:published (?:and marketed )?as (?:a )?(?:young adult|ya)|(?:young adult|ya) fantasy with a teenage protagonist|teenage protagonist|typical for a ya)\b/i.test(
      t
    );
  }

  function shouldExcludeFromPolicyBlob(row) {
    if (!row || !row.present) return true;
    if (EXCLUDE_FROM_AI_BLOB[row.id]) return true;
    if (EXCLUDE_AUDIENCE_FROM_POLICY_BLOB[row.id]) return true;
    if (themeBriefDeniesPresence(row.id, row.brief)) return true;
    if (row.id !== "lgbtq" && themeBriefEmbedsLgbtqDenial(row.brief)) return true;
    /* Light romantic tension never feeds catalog hard-reject; adult_romance still does. */
    if (row.id === "romantic_tension") return true;
    return false;
  }

  /** True only when LGBTQ is affirmed on-page — not denial/subtext-only mentions of the word LGBTQ. */
  function lgbtqAffirmativeEvidence(text) {
    var t = String(text || "");
    if (!t.trim()) return false;
    if (EXPLICIT_LGBTQ_IN_STORY_RE.test(t)) return true;
    if (!LGBTQ_EVIDENCE_RE.test(t)) return false;
    if (themeBriefIsProjectionOnly(t) && !EXPLICIT_LGBTQ_IN_STORY_RE.test(t)) return false;
    var stripped = t
      .replace(/\bno[^.!?]{0,120}lgbtq[^.!?]*/gi, " ")
      .replace(/\b(?:not|no)\s+confirmed\s+on[- ]page[^.!?]*/gi, " ")
      .replace(/\bperceived subtext is reader projection[^.!?]*/gi, " ")
      .replace(/\breader (?:speculation|projection)[^.!?]*/gi, " ")
      .replace(/\b(?:does|do) not (?:contain|include|feature|indicate)[^.!?]{0,96}lgbtq[^.!?]*/gi, " ");
    stripped = stripped.replace(/\s+/g, " ").trim();
    if (!stripped || lgbtqBriefDeniesContent(stripped)) return false;
    return LGBTQ_EVIDENCE_RE.test(stripped);
  }

  var CRUDE_PROFANITY_ABSENT_RE =
    /no (?:information to suggest|evidence of).{0,48}(?:harsh swearing|crude profanity|profan)|no harsh swearing|does not contain.{0,48}profan|without harsh swearing/i;

  var FAMILY_NEGATIVE_ABSENT_RE =
    /(?:are|is) not portrayed as (?:unfair|hostile|villain)|family members themselves are not portrayed|not portrayed as unfair, hostile, or villainized/i;

  function themeBriefDeniesPresence(themeId, text) {
    var t = String(text || "");
    if (!t.trim()) return false;
    if (themeId === "lgbtq" || (!themeId && lgbtqBriefDeniesContent(t))) return lgbtqBriefDeniesContent(t);
    if (themeId === "adult_romance" && ADULT_ROMANCE_ABSENT_RE.test(t)) return true;
    if (themeId === "romantic_tension" && isCleanYaOnlyBrief(t)) return true;
    if (themeId === "crude_profanity" && CRUDE_PROFANITY_ABSENT_RE.test(t)) return true;
    if (themeId === "family_portrayed_negatively" && FAMILY_NEGATIVE_ABSENT_RE.test(t)) return true;
    if (/there is no (?:information|evidence|confirmed)|does not (?:contain|include|feature|center)|the plot does not|no indication that|reader (?:speculation|projection)|perceived subtext is reader projection|not identified in reviews/i.test(t)) {
      return true;
    }
    return false;
  }

  function blobAffirmsMatureRomance(blob) {
    var b = String(blob || "");
    if (ADULT_ROMANCE_ABSENT_RE.test(b)) return false;
    var re = MATURE_ADULT_ROMANCE_RE;
    var m;
    var lastIndex = 0;
    while ((m = re.exec(b))) {
      var window = b.slice(Math.max(0, m.index - 42), m.index).toLowerCase();
      if (!/\b(?:not|no|without|isn't|aren't|doesn't|do not|would be clean)\s*$/.test(window)) return true;
      lastIndex = re.lastIndex;
      if (lastIndex === m.index) re.lastIndex++;
    }
    return false;
  }

  function enforceAbsentBriefs(data) {
    if (!data || !data.themes) return data;
    for (var i = 0; i < data.themes.length; i++) {
      var row = data.themes[i];
      if (!row) continue;
      if (themeBriefDeniesPresence(row.id, row.brief)) row.present = false;
    }
    return data;
  }

  function aiLgbtqThemeDenied(aiResult) {
    if (!aiResult || !aiResult.ok || !aiResult.themes) return false;
    for (var i = 0; i < aiResult.themes.length; i++) {
      var row = aiResult.themes[i];
      if (row && row.id === "lgbtq" && !row.present) return true;
    }
    return false;
  }

  function aiLgbtqThemePresent(aiResult) {
    if (!aiResult || !aiResult.ok || !aiResult.themes) return false;
    for (var i = 0; i < aiResult.themes.length; i++) {
      var row = aiResult.themes[i];
      if (row && row.id === "lgbtq" && row.present) return true;
    }
    return false;
  }

  function themeLabel(id) {
    var ST = global.HalalitShelfThemes;
    if (ST && typeof ST.themeById === "function") {
      var t = ST.themeById(id);
      if (t && t.label) return t.label;
    }
    return id;
  }

  function buildAiSupplementText(aiResult) {
    if (!aiResult || !aiResult.ok || !aiResult.themes || !aiResult.themes.length) return "";
    var chunks = [];
    for (var i = 0; i < aiResult.themes.length; i++) {
      var row = aiResult.themes[i];
      if (shouldExcludeFromPolicyBlob(row)) continue;
      chunks.push(themeLabel(row.id));
      if (row.brief) chunks.push(row.brief);
    }
    return chunks.join(" ");
  }

  function appendAiSignals(signals, aiResult) {
    var out = (signals || []).slice();
    if (!aiResult || !aiResult.ok || !aiResult.themes) return out;
    for (var i = 0; i < aiResult.themes.length; i++) {
      var row = aiResult.themes[i];
      if (!row.present || EXCLUDE_FROM_AI_BLOB[row.id]) continue;
      var brief = row.brief ? String(row.brief) : "";
      if (themeBriefDeniesPresence(row.id, brief)) continue;
      if (row.id !== "lgbtq" && themeBriefEmbedsLgbtqDenial(brief)) {
        brief = stripLgbtqDenialClause(brief);
        if (!brief || themeBriefEmbedsLgbtqDenial(brief)) continue;
      }
      var line = "AI scan: " + themeLabel(row.id);
      if (row.confidence && row.confidence !== "unknown") line += " (" + row.confidence + " confidence)";
      if (brief) line += " — " + brief;
      if (out.indexOf(line) === -1) out.push(line);
    }
    return out;
  }

  /**
   * @param {string} title
   * @param {string} author
   * @param {boolean} isGraphicFormat
   * @returns {Promise<object|null>}
   */
  function fetchThemeScan(title, author, isGraphicFormat, opts) {
    opts = opts || {};
    var Config = global.HalalitBookcheckConfig;
    var url = Config && typeof Config.aiThemeScanUrl === "function" ? Config.aiThemeScanUrl() : "";
    if (!url || !global.fetch) return Promise.resolve(null);
    return global
      .fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title,
          author: author || "",
          isGraphicFormat: !!isGraphicFormat,
          fromScanner: !!opts.fromScanner,
        }),
      })
      .then(function (r) {
        return r.json().then(function (data) {
          data = normalizeAiThemeScan(data || {});
          data.httpStatus = r.status;
          return data;
        });
      })
      .catch(function () {
        return { ok: false, error: "network_error" };
      });
  }

  function fetchCoverIdentify(imageBase64, mimeType) {
    var Config = global.HalalitBookcheckConfig;
    var url =
      Config && typeof Config.aiCoverIdentifyUrl === "function" ? Config.aiCoverIdentifyUrl() : "";
    if (!url || !global.fetch || !imageBase64) return Promise.resolve({ ok: false, error: "unavailable" });
    return global
      .fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          imageBase64: imageBase64,
          mimeType: mimeType || "image/jpeg",
        }),
      })
      .then(function (r) {
        return r.json().then(function (data) {
          data = data || {};
          data.httpStatus = r.status;
          return data;
        });
      })
      .catch(function () {
        return { ok: false, error: "network_error" };
      });
  }

  function presentThemeBriefs(aiResult) {
    var out = [];
    if (!aiResult || !aiResult.ok || !aiResult.themes) return out;
    for (var i = 0; i < aiResult.themes.length; i++) {
      var row = aiResult.themes[i];
      if (!row || !row.present) continue;
      if (themeBriefDeniesPresence(row.id, row.brief)) continue;
      if (row.id !== "lgbtq" && themeBriefEmbedsLgbtqDenial(row.brief)) continue;
      out.push({
        id: row.id || "",
        brief: String(row.brief || "").trim(),
        confidence: row.confidence || "",
      });
    }
    return out;
  }

  global.HalalitBookcheckAi = {
    fetchThemeScan: fetchThemeScan,
    fetchCoverIdentify: fetchCoverIdentify,
    buildAiSupplementText: buildAiSupplementText,
    appendAiSignals: appendAiSignals,
    presentThemeBriefs: presentThemeBriefs,
    normalizeAiThemeScan: normalizeAiThemeScan,
    aiLgbtqThemeDenied: aiLgbtqThemeDenied,
    aiLgbtqThemePresent: aiLgbtqThemePresent,
    filterAiResultForOwnerAbsent: filterAiResultForOwnerAbsent,
    filterAiSignalsForOwnerAbsent: filterAiSignalsForOwnerAbsent,
    themeBriefIsProjectionOnly: themeBriefIsProjectionOnly,
    lgbtqBriefDeniesContent: lgbtqBriefDeniesContent,
    themeBriefEmbedsLgbtqDenial: themeBriefEmbedsLgbtqDenial,
    themeBriefDeniesPresence: themeBriefDeniesPresence,
    stripLgbtqDenialClause: stripLgbtqDenialClause,
  };
})(typeof window !== "undefined" ? window : this);
