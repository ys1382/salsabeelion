/**
 * Halalit — Bookcheck family report: title-specific, evidence-based, curated-first.
 */
(function (global) {
  var YOU_DECIDE_LINE =
    "Halalit hasn’t read this cover to cover—you decide what fits your home.";

  var SCAN_TOPICS = [
    { id: "audience", label: "Age band", subjectRe: /juvenile|children|young adult|teen|ya fiction|picture book/i, textRe: /young adult|teen fiction|teenage readers/i },
    { id: "lgbtq", label: "LGBTQ themes", subjectRe: /lgbt|lesbian|gay|homosexual|queer|transgender|same[- ]sex|gender identity/i, textRe: /\blgbtq?\b|lesbian|gay\b|homosexual|queer\b|transgender|they\/them|two[- ]moms?|same[- ]sex/i },
    { id: "romance", label: "Romance or dating", subjectRe: /romance|dating|love stories/i, textRe: /romantic|love triangle|dating|betrothal|crush on/i },
    {
      id: "forced_gender_magic",
      label: "Forced or magic gender-change",
      subjectRe: /gender transform|body swap|sex change|forced gender/i,
      textRe:
        /(?:turned|transforms?|transformed|becomes?) (?:into )?(?:a )?(?:man|woman|girl|boy)|gender[- ](?:change|swap|transform)|body[- ]swap|magical(?:ly)? (?:changed|swapped) (?:sex|gender)|steal(?:s|ing)?[^.]{0,48}(?:body|magic)[^.]{0,48}(?:woman|man|girl|boy)|forced (?:into )?(?:a )?(?:female|male) (?:body|form)/i,
    },
    { id: "modesty", label: "Sexual content or fanservice", subjectRe: /erotica|sexual/i, textRe: /fanservice|fan service|ecchi|panty|sexualized|immodest|explicit/i },
    { id: "illegitimacy", label: "Illegitimate-children plot", subjectRe: /illegitim|born out of wedlock|bastardy/i, textRe: /illegitim|born out of wedlock|unwed mother/i },
    { id: "violence", label: "Violence or horror", subjectRe: /horror|murder|violence/i, textRe: /graphic violence|serial killer|torture|horror fiction|true crime/i },
    {
      id: "crude_profanity",
      label: "Harsh swearing or slurs",
      subjectRe: /profan|vulgar|swear|obscene|offensive language|explicit language/i,
      textRe: null,
    },
    { id: "substance", label: "Alcohol, smoking, or drugs", subjectRe: /alcohol|smoking|drugs/i, textRe: /\balcohol\b|\bwine\b|\bdrunk\b|\bsmok(?:e|ing)\b|\bmarijuana\b|\bweed\b/i },
    { id: "family_tone", label: "Family portrayed harshly", subjectRe: /family conflict|dysfunctional/i, textRe: /neglect|abusive|cruel (?:mother|father)|hostile (?:mother|father)|family[- ]bashing/i },
    { id: "deity", label: "Deity or mythology", subjectRe: /mythology|folklore|gods|goddesses|religion/i, textRe: /\bmythology\b|\bgods\b|\bdemigod|\bpantheon\b|\bfolklore\b.*\bfantasy/i },
    { id: "format", label: "Comics or manga", subjectRe: /comic|graphic novel|manga/i, textRe: /\bcomic\b|\bgraphic novel\b|\bmanga\b/i },
    { id: "crime_tone", label: "Crime or cruelty tone", subjectRe: /true crime|crime fiction/i, textRe: /vigilante|romanticized crime|serial killer/i },
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeOlTitle(doc) {
    var t = doc && doc.title;
    if (Array.isArray(t)) return String(t[0] || "").trim();
    return String(t || "").trim();
  }

  function authorsFromDoc(doc) {
    return Array.isArray(doc && doc.author_name) && doc.author_name.length ? doc.author_name.join(", ") : "";
  }

  function subjectListFromDoc(doc) {
    var raw = [];
    if (doc && doc.subject_facet && doc.subject_facet.length) raw = doc.subject_facet.slice(0, 40);
    else if (doc && doc.subject && doc.subject.length) raw = doc.subject.slice(0, 40);
    return raw
      .map(function (s) {
        return String(s || "").trim();
      })
      .filter(Boolean);
  }

  function parseBookNote(detail) {
    var lines = String(detail || "")
      .split(/\n+/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
    if (!lines.length) return { heading: "", bullets: [], closing: "" };
    var closing = "";
    var bullets = lines.slice(1);
    if (bullets.length && /^(won't|outside|halalit|not inappropriate)/i.test(bullets[bullets.length - 1])) {
      closing = bullets.pop();
    }
    return { heading: lines[0], bullets: bullets, closing: closing };
  }

  function subjectsHit(subjects, re) {
    var out = [];
    for (var i = 0; i < subjects.length; i++) {
      if (re.test(subjects[i])) out.push(subjects[i]);
    }
    return out;
  }

  function snippetFromDescription(desc, re) {
    var text = String(desc || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    var m = text.match(re);
    if (!m || !m[0]) return "";
    var idx = text.toLowerCase().indexOf(m[0].toLowerCase());
    if (idx < 0) return "";
    var start = Math.max(0, idx - 55);
    var end = Math.min(text.length, idx + m[0].length + 85);
    var bit = text.slice(start, end).trim();
    if (start > 0) bit = "…" + bit;
    if (end < text.length) bit = bit + "…";
    return bit;
  }

  function titleLooksGraphic(title, blobText) {
    return /\bcomic|graphic|manga\b/i.test(title) || /\bcomic books?|graphic novels?|manga\b/i.test(blobText);
  }

  function bookLead(title, author, doc) {
    var catTitle = normalizeOlTitle(doc) || title;
    var catAuth = authorsFromDoc(doc) || author;
    var yr = doc && doc.first_publish_year;
    var bits = ['We matched Open Library’s “' + catTitle + "”"];
    if (catAuth) bits[0] += " by " + catAuth;
    if (yr) bits[0] += " (" + yr + ")";
    bits[0] += ".";
    return bits[0];
  }

  function buildSpecificAction(tier, title, parsed, graphic, hint) {
    var name = parsed.heading || title;
    if (tier === "verified_clean") {
      return "“" + name + "” is on Halalit’s hand-verified family shelf—read the note below for any comfort details.";
    }
    if (tier === "flag_review") {
      return "Outside Halalit’s hardest auto-reject rules—the note below says why.";
    }
    if (tier === "user_discretion") {
      return (
        "“" +
        name +
        "” is hand-checked parent discretion—not LGBTQ, adult-romance, or hardest fanservice auto-reject. Read the note and decide."
      );
    }
    if (tier === "deity_comfort") {
      return (
        "“" +
        name +
        "” may work for your home if deity or mythology in stories is fine—Halalit can use it in Book Quest when you haven’t excluded deity/mythology in Advanced recommendations settings."
      );
    }
    if (tier === "teen_caution") {
      return "“" + title + "” reads as teen/YA—not Halalit’s all-ages band. Read it yourself or wait.";
    }
    if (tier === "fanservice_caution") {
      return "“" + name + "” is a hand-checked comic with lighter fanservice caution—preview human characters and outfits; Halalit won’t auto-recommend.";
    }
    if (tier === "preview_caution" || graphic) {
      return "Flip through “" + title + "” yourself before kids read—especially if it’s comics or manga.";
    }
    if (hint && hint.familyAction) return hint.familyAction;
    return "Use what we found below, preview if you can, then decide for your home.";
  }

  function buildSpecificSummary(tier, title, author, parsed, evidenceRows, graphic) {
    var name = parsed.heading || title;
    if (tier === "verified_clean") {
      return "Halalit hand-checked “" + name + "”" + (author ? " (" + author + ")" : "") + " and lists it on the family shelf.";
    }
    if (tier === "user_discretion") {
      return (
        "Halalit hand-checked “" +
        name +
        "”" +
        (author ? " (" + author + ")" : "") +
        "—reader discretion; not an auto-reject."
      );
    }
    if (tier === "flag_review" && parsed.bullets.length) {
      return "Halalit hand-checked “" + name + "”" + (author ? " (" + author + ")" : "") + "—not on the family shelf.";
    }
    if (tier === "fanservice_caution" && parsed.bullets.length) {
      return (
        "Halalit hand-checked “" +
        name +
        "”" +
        (author ? " (" + author + ")" : "") +
        "—lighter fanservice caution on a comic, not the heavy no-recommend list."
      );
    }
    if (tier === "deity_comfort" && parsed.bullets.length) {
      return (
        "Halalit hand-checked “" +
        name +
        "”" +
        (author ? " (" + author + ")" : "") +
        "—deity or mythology comfort note; Book Quest includes it when you haven’t excluded deity/mythology in Advanced settings."
      );
    }
    if (evidenceRows.length) {
      return (
        "For “" +
        title +
        "”" +
        (author ? " by " + author : "") +
        ", the catalog" +
        (graphic ? " and format (comics/manga)" : "") +
        " flagged " +
        evidenceRows.length +
        " thing" +
        (evidenceRows.length === 1 ? "" : "s") +
        " below—not a hand-read pass."
      );
    }
    if (graphic) {
      return "“" + title + "” looks like comics or manga—panel art isn’t checked here; preview yourself.";
    }
    return "No hand note yet and nothing strong in the catalog we pulled.";
  }

  function themeBriefDeniesIssue(text) {
    var AI = global.HalalitBookcheckAi;
    if (AI && typeof AI.themeBriefDeniesPresence === "function") {
      if (AI.themeBriefDeniesPresence("", text)) return true;
    }
    var t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return false;
    if (lgbtqBriefDeniesContent(t)) return true;
    return (
      /\b(?:no (?:explicit )?(?:mention of )?|without (?:explicit )?|(?:do|does|don't|doesn't) not (?:contain|include|feature|indicate|show|depict|mention|suggest)|not indicate any|no evidence of)\b/i.test(
        t
      ) ||
      /\b(?:not mature[- ]rated|not a mature[- ]rated|not mature[- ]rated or explicit|clean and age[- ]appropriate|typical for a ya|published (?:and marketed )?as (?:a )?(?:young adult|ya)|age[- ]appropriate romantic subplot|perceived subtext is reader projection)\b/i.test(
        t
      ) ||
      /\b(?:plot|summaries|reviews|catalog)[^.]{0,48}(?:do|does) not (?:indicate|mention|suggest|show|contain|include)\b/i.test(
        t
      )
    );
  }

  function explainerIsLowValueRejectReason(text) {
    if (themeBriefDeniesIssue(text) || lgbtqBriefDeniesContent(text)) return true;
    return /\bpublished (?:and marketed )?as (?:a )?(?:young adult|ya)|(?:young adult|ya) fantasy with a teenage protagonist|teenage protagonist|typical for a ya|not mature[- ]rated|not a mature[- ]rated|without adult romance|no confirmed on[- ]page|reader (?:speculation|projection)|perceived subtext is reader projection|age[- ]appropriate romantic subplot|clean,? age[- ]appropriate romantic/i.test(
      String(text || "")
    );
  }

  function meaningfulAutoRejectFallback(report, hint) {
    hint = hint || {};
    if (hint.detail && !isGraphicUnvettedDetail(hint.detail)) {
      if (!hintDetailIsLgbtqPolicy(hint.detail) || !lgbtqStanceAbsent(report, hint)) {
        var detailEx = explainerFromCuratedBullet(hint.detail, report, hint);
        if (detailEx && !explainerIsLowValueRejectReason(detailEx)) return [detailEx];
      }
    }
    if (report && report.dimensions) {
      for (var i = 0; i < report.dimensions.length; i++) {
        var row = report.dimensions[i];
        if (!row || row.status !== "concern") continue;
        if (row.id === "lgbtq" && lgbtqStanceAbsent(report, hint)) continue;
        if (row.id === "policy" && hintDetailIsLgbtqPolicy(row.note) && lgbtqStanceAbsent(report, hint)) continue;
        var dimEx = explainerFromDimension(row, report, hint);
        if (dimEx && !explainerIsLowValueRejectReason(dimEx) && !isBoilerplateExplainer(dimEx)) return [dimEx];
      }
    }
    if (report && report.aiThemes) {
      for (var a = 0; a < report.aiThemes.length; a++) {
        var aiEx = explainerFromAiTheme(report.aiThemes[a], report, hint);
        if (aiEx && !explainerIsLowValueRejectReason(aiEx)) return [aiEx];
      }
    }
    return ["outside Halalit's family shelf rules—see the notes below"];
  }

  function prioritizeAutoRejectExplainers(explainers, report, hint) {
    if (!explainers || !explainers.length) return meaningfulAutoRejectFallback(report, hint);
    var strong = [];
    for (var i = 0; i < explainers.length; i++) {
      if (!explainerIsLowValueRejectReason(explainers[i])) strong.push(explainers[i]);
    }
    if (strong.length) return strong.slice(0, 3);
    return meaningfulAutoRejectFallback(report, hint);
  }

  function scanRowNoteIsAbsenceOnly(note, tagHits) {
    if (tagHits && tagHits.length) return false;
    return themeBriefDeniesIssue(note);
  }

  function scanRowFromEvidence(topic, subjects, description, blobText) {
    var Policy = global.HalalitFamilyShelfPolicy;
    if (topic.id === "crude_profanity") {
      var combined = [description, blobText].join(" ");
      if (Policy && typeof Policy.textMentionsCrudeProfanity === "function" && Policy.textMentionsCrudeProfanity(combined)) {
        var tagHits = subjectsHit(subjects, topic.subjectRe);
        var descHit = snippetFromDescription(description, /\bf+\W*u+\W*c+\W*k|\bbitch|\bsh+\W*i+\W*t|\bnigg/i);
        if (!descHit && Policy.textMentionsCrudeProfanity(description)) {
          descHit = snippetFromDescription(description, /\w+/);
        }
        var noteParts = [];
        if (tagHits.length)
          noteParts.push("Open Library tag: “" + tagHits.slice(0, 4).join("”; “") + "”");
        if (descHit) noteParts.push('Description: “' + descHit + "”");
        if (!tagHits.length && !descHit) noteParts.push("Harsh swearing or slurs in catalog or plot text for this edition.");
        return { id: topic.id, label: topic.label, status: "concern", note: noteParts.join(" · ") };
      }
      return null;
    }
    var tagHits = subjectsHit(subjects, topic.subjectRe);
    var descHit = snippetFromDescription(description, topic.textRe);
    if (descHit && themeBriefDeniesIssue(descHit)) descHit = "";
    var inBlob = topic.textRe.test(blobText);
    if (inBlob && themeBriefDeniesIssue(description + " " + blobText)) inBlob = false;
    if (topic.id === "lgbtq" && !tagHits.length && lgbtqBriefDeniesContent(description + " " + blobText)) {
      return null;
    }
    if (!tagHits.length && !descHit && !inBlob) return null;

    var status = "caution";
    if (topic.id === "lgbtq" || topic.id === "illegitimacy") status = "concern";
    if (topic.id === "romance") {
      var teenBlob = /young adult|teen fiction|ya fiction|juvenile fiction/i.test(
        subjects.join(" ") + " " + blobText
      );
      if (teenBlob || /young adult|teen fiction|ya fiction/i.test(description)) status = "concern";
    }
    if (topic.id === "modesty" && /fanservice|fan service|ecchi|sexualized|immodest/i.test(blobText + " " + description)) {
      status = "concern";
    }
    if (topic.id === "format") status = "caution";
    if (topic.id === "forced_gender_magic") status = "caution";

    var noteParts = [];
    if (tagHits.length)
      noteParts.push("Open Library tag: “" + tagHits.slice(0, 4).join("”; “") + "”");
    if (descHit) noteParts.push('Description: “' + descHit + "”");
    if (!tagHits.length && !descHit && inBlob) noteParts.push("Mentioned in combined catalog text for this edition.");

    if (scanRowNoteIsAbsenceOnly(noteParts.join(" · "), tagHits)) return null;

    return { id: topic.id, label: topic.label, status: status, note: noteParts.join(" · ") };
  }

  function buildCuratedReport(opts, handTier, handDetail) {
    var title = opts.title || "";
    var author = opts.author || "";
    var parsed = parseBookNote(handDetail);
    var doc = opts.doc;
    var subjects = subjectListFromDoc(doc);
    var description = opts.descriptionOnly || "";
    var graphic = titleLooksGraphic(title, subjects.join(" ").toLowerCase());

    var rows = [];
    rows.push({
      id: "hand_check",
      label: "Halalit read this",
      status: handTier === "verified_clean" ? "ok" : "concern",
      note: parsed.heading || handDetail,
    });

    for (var i = 0; i < parsed.bullets.length; i++) {
      var bullet = parsed.bullets[i];
      var comfortLabel = null;
      var CurBullets = global.HalalitCuratedShelfWarnings;
      if (CurBullets && typeof CurBullets.comfortNoteCategories === "function") {
        var comfortCats = CurBullets.comfortNoteCategories(bullet);
        if (comfortCats.indexOf("magic") >= 0) comfortLabel = "Halalit comfort note (fantasy magic)";
        else if (comfortCats.indexOf("deity") >= 0) comfortLabel = "Halalit comfort note (deity or mythology)";
        else if (comfortCats.indexOf("romance") >= 0) comfortLabel = "Halalit comfort note (light romance)";
        else if (comfortCats.indexOf("substance") >= 0) comfortLabel = "Halalit comfort note (alcohol or similar)";
        else if (comfortCats.indexOf("mental_health") >= 0) comfortLabel = "Halalit mental-health comfort note";
        else if (comfortCats.indexOf("family") >= 0) comfortLabel = "Halalit family-tone note";
      }
      rows.push({
        id: "halalit_bullet_" + i,
        label: comfortLabel || "From Halalit’s note",
        status:
          handTier === "verified_clean" ? (comfortLabel ? "caution" : "ok") : comfortLabel ? "caution" : "concern",
        note: bullet,
      });
    }

    if (opts.hint && opts.hint.familyPortrayal && opts.hint.familyPortrayal.detail) {
      var fpCur = parseBookNote(opts.hint.familyPortrayal.detail);
      if (fpCur.heading) {
        rows.push({
          id: "family_heading",
          label: opts.hint.familyPortrayal.label || "Family is portrayed negatively",
          status: "caution",
          note: fpCur.heading,
        });
      }
      for (var fp = 0; fp < fpCur.bullets.length; fp++) {
        rows.push({
          id: "family_bullet_" + fp,
          label: "Halalit family-tone note",
          status: "caution",
          note: fpCur.bullets[fp],
        });
      }
    }

    if (opts.hint && opts.hint.culturalRepresentation && opts.hint.culturalRepresentation.detail) {
      var crCur = parseBookNote(opts.hint.culturalRepresentation.detail);
      if (crCur.heading) {
        rows.push({
          id: "cultural_heading",
          label: opts.hint.culturalRepresentation.label || "Cultural misrepresentation",
          status: "caution",
          note: crCur.heading,
        });
      }
      for (var cr = 0; cr < crCur.bullets.length; cr++) {
        rows.push({
          id: "cultural_bullet_" + cr,
          label: "Halalit cultural-representation note",
          status: "caution",
          note: crCur.bullets[cr],
        });
      }
    }

    if (opts.hint && opts.hint.proColonialCaution && opts.hint.proColonialCaution.detail) {
      var pcCur = parseBookNote(opts.hint.proColonialCaution.detail);
      if (pcCur.heading) {
        rows.push({
          id: "pro_colonial_heading",
          label: opts.hint.proColonialCaution.label || "Pro-colonial narrative (read with care)",
          status: "caution",
          note: pcCur.heading,
        });
      }
      for (var pc = 0; pc < pcCur.bullets.length; pc++) {
        rows.push({
          id: "pro_colonial_bullet_" + pc,
          label: "Halalit pro-colonial caution",
          status: "caution",
          note: pcCur.bullets[pc],
        });
      }
    }

    if (opts.hint && opts.hint.faithInStory && opts.hint.faithInStory.detail) {
      var fsCur = parseBookNote(opts.hint.faithInStory.detail);
      if (fsCur.heading) {
        rows.push({
          id: "faith_heading",
          label: opts.hint.faithInStory.label || "Christian faith in the story (not deity/mythology)",
          status: "caution",
          note: fsCur.heading,
        });
      }
      for (var fs = 0; fs < fsCur.bullets.length; fs++) {
        rows.push({
          id: "faith_bullet_" + fs,
          label: "Halalit faith-in-story note",
          status: "caution",
          note: fsCur.bullets[fs],
        });
      }
    }

    if (opts.hint && opts.hint.parentNote && opts.hint.parentNote.detail) {
      var pnCur = parseBookNote(opts.hint.parentNote.detail);
      if (pnCur.heading) {
        rows.push({
          id: "parent_heading",
          label: opts.hint.parentNote.label || "Notes for parents",
          status: "caution",
          note: pnCur.heading,
        });
      }
      for (var pn = 0; pn < pnCur.bullets.length; pn++) {
        rows.push({
          id: "parent_bullet_" + pn,
          label: "Notes for parents",
          status: "caution",
          note: pnCur.bullets[pn],
        });
      }
    }

    if (opts.hint && opts.hint.authorOtherWorks && opts.hint.authorOtherWorks.detail) {
      var awCur = parseBookNote(opts.hint.authorOtherWorks.detail);
      if (awCur.heading) {
        rows.push({
          id: "author_other_heading",
          label: opts.hint.authorOtherWorks.label || "WARNING:",
          status: "caution",
          note: awCur.heading,
        });
      }
      for (var aw = 0; aw < awCur.bullets.length; aw++) {
        rows.push({
          id: "author_other_bullet_" + aw,
          label: "WARNING: author's other works",
          status: "caution",
          note: awCur.bullets[aw],
        });
      }
    }

    if (handTier !== "verified_clean") {
      for (var t = 0; t < SCAN_TOPICS.length; t++) {
        var extra = scanRowFromEvidence(SCAN_TOPICS[t], subjects, description, "");
        if (extra && rows.length < 14) {
          var dup = false;
          for (var r = 0; r < rows.length; r++) {
            if (rows[r].note && extra.note && rows[r].note.indexOf(extra.note.slice(0, 24)) >= 0) dup = true;
          }
          if (!dup) rows.push(extra);
        }
      }
    }

    return {
      mode: "curated",
      title: title,
      author: author,
      tier: handTier,
      isGraphic: graphic,
      bookLead: bookLead(title, author, doc),
      parsedNote: parsed,
      familyAction: buildSpecificAction(handTier, title, parsed, graphic, opts.hint),
      summary: buildSpecificSummary(handTier, title, author, parsed, [], graphic),
      dimensions: rows,
      descriptionExcerpt: description ? description.replace(/\s+/g, " ").trim().slice(0, 400) : "",
      relevantSubjects: subjects.slice(0, 8),
      gaps: graphic
        ? ["Panel art and volume-to-volume tone—even with a Halalit note, preview new volumes."]
        : ["How themes build in later volumes if the series continues."],
      sourcesUsed:
        "Halalit hand-checked note" +
        (subjects.length ? ", plus Open Library tags" : "") +
        (description ? " and description" : "") +
        (opts.hadWikipedia ? " and Wikipedia" : ""),
      firstPublishYear: doc && doc.first_publish_year ? doc.first_publish_year : null,
      catalogOnly: [],
    };
  }

  function buildCatalogReport(opts) {
    var Policy = global.HalalitFamilyShelfPolicy;
    var title = opts.title || normalizeOlTitle(opts.doc) || "";
    var author = opts.author || authorsFromDoc(opts.doc) || "";
    var doc = opts.doc || { title: title, author_name: author ? author.split(/\s*,\s*/) : [] };
    var hint = opts.hint || { tier: "unclear", detail: "" };
    var subjects = subjectListFromDoc(doc);
    var description = opts.descriptionOnly || "";
    var supplement = opts.supplementText || "";
    var blobText = (subjects.join(" ") + " " + supplement).toLowerCase();
    var tier = hint.tier || "unclear";
    var graphic = titleLooksGraphic(title, blobText);

    var rows = [];
    var catalogOnly = [];

    if (hint.familyPortrayal && hint.familyPortrayal.detail) {
      var fp = parseBookNote(hint.familyPortrayal.detail);
      for (var f = 0; f < fp.bullets.length; f++) {
        rows.push({
          id: "family_" + f,
          label: "Halalit family-tone note",
          status: "caution",
          note: fp.bullets[f],
        });
      }
    }

    if (hint.culturalRepresentation && hint.culturalRepresentation.detail) {
      var cr = parseBookNote(hint.culturalRepresentation.detail);
      for (var c = 0; c < cr.bullets.length; c++) {
        rows.push({
          id: "cultural_" + c,
          label: "Halalit cultural-representation note",
          status: "caution",
          note: cr.bullets[c],
        });
      }
    }

    if (hint.proColonialCaution && hint.proColonialCaution.detail) {
      var pcHint = parseBookNote(hint.proColonialCaution.detail);
      for (var pcx = 0; pcx < pcHint.bullets.length; pcx++) {
        rows.push({
          id: "pro_colonial_" + pcx,
          label: "Halalit pro-colonial caution",
          status: "caution",
          note: pcHint.bullets[pcx],
        });
      }
    }

    if (hint.faithInStory && hint.faithInStory.detail) {
      var fsHint = parseBookNote(hint.faithInStory.detail);
      for (var fsx = 0; fsx < fsHint.bullets.length; fsx++) {
        rows.push({
          id: "faith_" + fsx,
          label: "Halalit faith-in-story note",
          status: "caution",
          note: fsHint.bullets[fsx],
        });
      }
    }

    if (hint.authorOtherWorks && hint.authorOtherWorks.detail) {
      var awHint = parseBookNote(hint.authorOtherWorks.detail);
      for (var awx = 0; awx < awHint.bullets.length; awx++) {
        rows.push({
          id: "author_other_" + awx,
          label: "WARNING: author's other works",
          status: "caution",
          note: awHint.bullets[awx],
        });
      }
    }

    if (hint.parentNote && hint.parentNote.detail) {
      var pnCat = parseBookNote(hint.parentNote.detail);
      for (var pn = 0; pn < pnCat.bullets.length; pn++) {
        rows.push({
          id: "parent_" + pn,
          label: hint.parentNote.label || "Notes for parents",
          status: "caution",
          note: pnCat.bullets[pn],
        });
      }
    }

    if (hint.deityComfort && hint.deityComfort.detail && !(Policy && Policy.deityComfortBlocked)) {
      var dc = parseBookNote(hint.deityComfort.detail);
      rows.push({
        id: "deity_hand",
        label: "Halalit comfort note",
        status: "caution",
        note: dc.bullets[0] || dc.heading || hint.deityComfort.detail.split("\n")[0],
      });
    } else if (tier === "deity_comfort" && hint.detail) {
      var dcMain = parseBookNote(hint.detail);
      if (dcMain.heading) {
        rows.push({
          id: "deity_heading",
          label: "Halalit comfort note",
          status: "caution",
          note: dcMain.heading,
        });
      }
      for (var di = 0; di < dcMain.bullets.length; di++) {
        rows.push({
          id: "deity_bullet_" + di,
          label: "From Halalit’s note",
          status: "caution",
          note: dcMain.bullets[di],
        });
      }
    }

    if (hint.detail && tier === "flag_review" && !global.HalalitCuratedShelfWarnings) {
      rows.push({ id: "policy", label: "Halalit rule", status: "concern", note: hint.detail });
    } else if (hint.detail && tier === "flag_review") {
      var Cur = global.HalalitCuratedShelfWarnings;
      if (!Cur || !Cur.match(title, author)) {
        rows.push({ id: "policy", label: "Halalit rule", status: "concern", note: hint.detail });
      }
    }

    for (var i = 0; i < SCAN_TOPICS.length; i++) {
      var hit = scanRowFromEvidence(SCAN_TOPICS[i], subjects, description, blobText);
      if (hit) rows.push(hit);
      else catalogOnly.push(SCAN_TOPICS[i].label);
    }

    if (hint.signals && hint.signals.length) {
      var aiScanNotes = [];
      for (var si = 0; si < hint.signals.length; si++) {
        var sig = String(hint.signals[si] || "").trim();
        if (!/^AI scan:/i.test(sig)) continue;
        var aiNote = sig.replace(/^AI scan:\s*/i, "");
        if (aiNote && themeBriefEmbedsLgbtqDenial(aiNote)) continue;
        if (aiNote && themeBriefDeniesIssue(aiNote)) continue;
        if (aiNote && aiScanNotes.indexOf(aiNote) === -1) aiScanNotes.push(aiNote);
      }
      if (aiScanNotes.length) {
        var hasHardConcern = rows.some(function (r) {
          return r && r.status === "concern";
        });
        if (!hasHardConcern) {
          rows.push({
            id: "ai_scan",
            label: "AI theme scan",
            status: "caution",
            note: aiScanNotes.join("; "),
          });
        }
      }
    }

    if (Policy && Policy.hardExclusionDetailForTitle) {
      var ex = Policy.hardExclusionDetailForTitle(title, author);
      if (ex) {
        rows.push({ id: "blocklist", label: "Halalit blocklist", status: "concern", note: ex });
      }
    }

    if (graphic && !rows.some(function (r) { return r.id === "format"; })) {
      rows.push({
        id: "format",
        label: "Comics or manga",
        status: "caution",
        note:
          "This edition is tagged or titled as comics/manga—Open Library rarely describes panel-level fanservice.",
      });
    }

    var parsed = { heading: title, bullets: [], closing: "" };
    return {
      mode: "catalog",
      title: title,
      author: author,
      tier: tier,
      isGraphic: graphic,
      bookLead: doc && doc.key ? bookLead(title, author, doc) : "No exact Open Library match—we judged from the title you typed.",
      parsedNote: parsed,
      familyAction: buildSpecificAction(tier, title, parsed, graphic, hint),
      summary: buildSpecificSummary(tier, title, author, parsed, rows.filter(function (r) {
        return r.status === "concern" || r.status === "caution";
      }), graphic),
      dimensions: rows,
      descriptionExcerpt: description ? description.replace(/\s+/g, " ").trim().slice(0, 400) : "",
      relevantSubjects: subjects.filter(function (s) {
        return /juvenile|children|teen|comic|graphic|manga|romance|lgbt|fiction|fantasy/i.test(s);
      }).slice(0, 10),
      gaps: graphic
        ? [
            "Panel-level fanservice and immodesty (flip through the book)",
            "Tone shifts mid-series when tags stay “juvenile fiction”",
          ]
        : ["Plot-centering when tags are thin (e.g. narcissism played for laughs, LGBTQ in later volumes)"],
      sourcesUsed:
        (doc && doc.key ? "Open Library edition" : "Title you typed") +
        (description ? ", publisher description" : "") +
        (subjects.length ? ", subject tags" : "") +
        (opts.hadWikipedia ? ", Wikipedia intro" : ""),
      firstPublishYear: doc && doc.first_publish_year ? doc.first_publish_year : null,
      catalogOnly: catalogOnly,
    };
  }

  function attachExternalEvidence(report, opts) {
    var subjects = subjectListFromDoc(opts.doc || {});
    var ST = global.HalalitShelfThemes;
    var catalogHits =
      ST && ST.matchCatalogSubjects
        ? ST.matchCatalogSubjects(subjects)
        : global.HalalitFamilyShelfPolicy && global.HalalitFamilyShelfPolicy.catalogThemeHits
          ? global.HalalitFamilyShelfPolicy.catalogThemeHits(subjects)
          : [];
    var wikiHits = [];
    var wdHits = [];
    if (opts.wikipedia && ST && ST.matchTextEvidence) {
      var wtxt = (opts.wikipedia.intro || "") + " " + (opts.wikipedia.plot || "");
      wikiHits = ST.matchTextEvidence(wtxt);
    }
    if (opts.wikidata && opts.wikidata.themeHits) {
      wdHits = opts.wikidata.themeHits;
    } else if (opts.wikidata && opts.wikidata.scanText && ST && ST.matchTextEvidence) {
      wdHits = ST.matchTextEvidence(opts.wikidata.scanText);
    }
    report.external = {
      catalogHits: catalogHits,
      themeIndex: opts.hint && opts.hint.themeIndex ? opts.hint.themeIndex : null,
      wikipedia: opts.wikipedia || null,
      wikipediaHits: wikiHits,
      wikidata: opts.wikidata || null,
      wikidataHits: wdHits,
    };
    return report;
  }

  function applyOwnerAiThemeAbsent(report, hint) {
    if (!report || !hint || !hint.ownerAiThemeAbsent) return report;
    var absent = hint.ownerAiThemeAbsent;
    var r = Object.assign({}, report);

    if (absent.lgbtq) {
      r.aiLgbtqPresent = false;
      r.aiLgbtqDenied = true;
      r.aiThemes = (report.aiThemes || []).filter(function (theme) {
        return !(theme && theme.id === "lgbtq");
      });
    }

    var stripIds = [];
    if (absent.deity_mythology) stripIds.push("deity_mythology", "deity");
    if (absent.romantic_tension) stripIds.push("romantic_tension", "romance");
    if (stripIds.length) {
      r.aiThemes = (r.aiThemes || []).filter(function (theme) {
        return !(theme && stripIds.indexOf(theme.id) >= 0);
      });
    }

    if (absent.deity_mythology) {
      r.deityComfort = null;
    }

    r.dimensions = (report.dimensions || []).filter(function (row) {
      if (!row) return false;
      if (absent.lgbtq && row.id === "lgbtq") return false;
      if (absent.deity_mythology && (row.id === "deity" || row.id === "deity_hand" || /deity or mythology/i.test(row.label || ""))) {
        return false;
      }
      if (absent.romantic_tension && (row.id === "romance" || /romance or dating/i.test(row.label || ""))) return false;
      if (row.id === "ai_scan") {
        var note = String(row.note || "");
        if (absent.lgbtq && /lgbtq/i.test(note)) return false;
        if (absent.deity_mythology && /deity|mythology/i.test(note)) return false;
        if (absent.romantic_tension && /romantic/i.test(note)) return false;
      }
      return true;
    });

    if (report.external) {
      r.external = Object.assign({}, report.external);
      if (r.external.catalogHits) {
        r.external.catalogHits = r.external.catalogHits.filter(function (hit) {
          if (!hit) return false;
          if (absent.lgbtq && (hit.id === "lgbtq" || /lgbtq/i.test(hit.label || ""))) return false;
          if (absent.deity_mythology && (hit.id === "deity_mythology" || hit.id === "deity" || /deity|mythology/i.test(hit.label || ""))) {
            return false;
          }
          if (absent.romantic_tension && (hit.id === "romantic_tension" || hit.id === "romance" || /romance/i.test(hit.label || ""))) {
            return false;
          }
          return true;
        });
      }
      if (r.external.wikipediaHits) {
        r.external.wikipediaHits = r.external.wikipediaHits.filter(function (hit) {
          if (!hit) return false;
          if (absent.lgbtq && (hit.id === "lgbtq" || textLooksLikeLgbtqWarning((hit.label || "") + " " + (hit.snippet || "")))) {
            return false;
          }
          if (absent.deity_mythology && (hit.id === "deity_mythology" || /deity|mythology/i.test((hit.label || "") + " " + (hit.snippet || "")))) {
            return false;
          }
          return true;
        });
      }
      if (r.external.wikidataHits) {
        r.external.wikidataHits = r.external.wikidataHits.filter(function (hit) {
          if (!hit) return false;
          if (absent.lgbtq && (hit.id === "lgbtq" || textLooksLikeLgbtqWarning((hit.label || "") + " " + (hit.snippet || "")))) {
            return false;
          }
          if (absent.deity_mythology && (hit.id === "deity_mythology" || /deity|mythology/i.test((hit.label || "") + " " + (hit.snippet || "")))) {
            return false;
          }
          return true;
        });
      }
    }

    return r;
  }

  function buildBookcheckReport(opts) {
    var title = opts.title || normalizeOlTitle(opts.doc) || "";
    var author = opts.author || authorsFromDoc(opts.doc) || "";
    var report;
    var Cur = global.HalalitCuratedShelfWarnings;
    if (Cur) {
      var verified = Cur.verifiedCleanMatch(title, author);
      if (verified) report = buildCuratedReport(opts, "verified_clean", verified.detail);
      else {
        var flagged = Cur.match(title, author);
        if (flagged) report = buildCuratedReport(opts, flagged.tier, flagged.detail);
        else if (typeof Cur.deityComfortMatch === "function") {
          var deityHand = Cur.deityComfortMatch(title, author);
          if (deityHand) report = buildCuratedReport(opts, "deity_comfort", deityHand.detail);
        }
      }
    }
    if (!report) report = buildCatalogReport(opts);
    report.aiScanOk = !!opts.aiScanOk;
    report.fanserviceNotChecked = !!opts.fanserviceNotChecked;
    report.aiSeriesNote = opts.aiSeriesNote || "";
    report.aiThemes = opts.aiThemes || [];
    report.aiLgbtqDenied = !!opts.aiLgbtqDenied;
    report.aiLgbtqPresent = !!opts.aiLgbtqPresent;
    report.hintTier = (opts.hint && opts.hint.tier) || report.tier;
    report.hintDetail = (opts.hint && opts.hint.detail) || "";
    report.agentFlag = !!(opts.hint && opts.hint.agentFlag);
    if (Cur && !report.agentFlag) {
      var agentHit = Cur.match(title, author);
      if (agentHit && agentHit.agentFlag) report.agentFlag = true;
    }
    if (report.isGraphic == null) {
      var descBlob = (opts.descriptionOnly || "") + " " + (opts.supplementText || "");
      report.isGraphic = titleLooksGraphic(title, descBlob.toLowerCase());
    }
    return applyOwnerAiThemeAbsent(
      applyLgbtqStanceFilters(attachExternalEvidence(report, opts), opts.hint),
      opts.hint
    );
  }

  var GRAPHIC_UNVETTED_DETAIL_RE =
    /Comics, manga, graphic novels, sketchbooks, and art books need a Halalit hand-check/i;

  function isGraphicUnvettedDetail(detail) {
    return GRAPHIC_UNVETTED_DETAIL_RE.test(String(detail || ""));
  }

  function reportTierIsHandClean(report, hint) {
    hint = hint || {};
    var tier = hint.tier || (report && (report.hintTier || report.tier)) || "";
    return tier === "verified_clean";
  }

  function reportIsHandSettled(report, hint) {
    if (!report) return false;
    if (report.mode === "curated") return true;
    hint = hint || {};
    var tier = hint.tier || report.hintTier || report.tier || "";
    return (
      tier === "verified_clean" ||
      tier === "user_discretion" ||
      tier === "fanservice_caution" ||
      tier === "preview_caution" ||
      tier === "deity_comfort" ||
      tier === "flag_review" ||
      tier === "teen_caution"
    );
  }

  function renderUnvettedGraphicNote(report) {
    if (!report || report.mode === "curated") return "";
    if (!(report.fanserviceNotChecked || report.isGraphic)) return "";
    return (
      '<div class="bookcheck-graphic-note"><p><strong>Graphic novel:</strong> panel art and fanservice are ' +
      "<em>not</em> checked by AI or catalog tags—preview the book yourself even when plot themes look fine.</p></div>"
    );
  }

  function vetSourceIsAiOrHand(vetSource) {
    if (!vetSource) return false;
    if (vetSource === "hand_vetted" || vetSource === "owner_rejected") return true;
    return String(vetSource).indexOf("ai_") === 0;
  }

  function shouldShowYouDecideLine(report, hint, opts) {
    hint = hint || {};
    opts = opts || {};
    if (opts.experienced) return false;
    if (vetSourceIsAiOrHand(opts.vetSource)) return false;
    if (report && report.mode === "curated") return false;
    var tier = hint.tier || (report && (report.hintTier || report.tier)) || "";
    if (
      tier === "verified_clean" ||
      tier === "user_discretion" ||
      tier === "fanservice_caution" ||
      tier === "preview_caution" ||
      tier === "deity_comfort" ||
      tier === "flag_review" ||
      tier === "ai_likely_pass" ||
      tier === "ai_manual_review" ||
      tier === "ai_likely_reject"
    ) {
      return false;
    }
    var ar = autoRejectionSummary(report, hint);
    return ar.status !== "reject";
  }

  function renderYouDecideLineHtml(report, hint, opts) {
    if (!shouldShowYouDecideLine(report, hint, opts)) return "";
    return '<p class="bookcheck-you-decide muted"><strong>You decide:</strong> ' + escapeHtml(YOU_DECIDE_LINE) + "</p>";
  }

  var REJECT_AI_THEME_IDS = {
    lgbtq: true,
    adult_romance: true,
    illegitimate_children: true,
    crude_profanity: true,
    group_demonization: true,
    pro_colonial_narrative: true,
    teen_ya_age: true,
    violence_intense: true,
    romanticized_crime: true,
    family_portrayed_negatively: true,
    cultural_stereotype: true,
    substance: true,
    deity_mythology: true,
  };

  function isGenericAutoRejectBrief(brief) {
    return /^(LGBTQ representation noted in scan text|mentioned in combined catalog)/i.test(
      String(brief || "").trim()
    );
  }

  function lgbtqBriefDeniesContent(text) {
    var AI = global.HalalitBookcheckAi;
    if (AI && typeof AI.lgbtqBriefDeniesContent === "function") {
      return AI.lgbtqBriefDeniesContent(text);
    }
    return /\b(?:do|does) not (?:contain|include|feature|indicate|show|depict)|not indicate any lgbtq|no lgbtq\b|(?:no|not) confirmed on[- ]page|reader speculation or subtext only|not confirmed on[- ]page lgbtq|(?:does|do) not feature confirmed on[- ]page|heterosexual romance\b[^.!?]{0,96}\b(?:does|do) not feature\b/i.test(
      String(text || "")
    );
  }

  function themeBriefEmbedsLgbtqDenial(text) {
    var AI = global.HalalitBookcheckAi;
    if (AI && typeof AI.themeBriefEmbedsLgbtqDenial === "function") {
      return AI.themeBriefEmbedsLgbtqDenial(text);
    }
    return lgbtqBriefDeniesContent(text);
  }

  function stripEmbeddedLgbtqDenial(text) {
    var AI = global.HalalitBookcheckAi;
    if (AI && typeof AI.stripLgbtqDenialClause === "function") {
      return AI.stripLgbtqDenialClause(text);
    }
    return String(text || "");
  }

  function scanNoteHidesLgbtqDenial(note, report, hint) {
    var n = String(note || "");
    if (!n) return false;
    if (themeBriefDeniesIssue(n) || themeBriefEmbedsLgbtqDenial(n)) {
      if (lgbtqStancePresent(report, hint)) return true;
    }
    return false;
  }

  function hintDetailIsLgbtqPolicy(detail) {
    var Policy = global.HalalitFamilyShelfPolicy;
    if (Policy && typeof Policy.hintDetailIsLgbtqPolicy === "function") {
      return Policy.hintDetailIsLgbtqPolicy(detail);
    }
    return /lgbtq identity|lgbtq themes|mention lgbtq|flags lgbtq representation/i.test(String(detail || ""));
  }

  function catalogReportAffirmsLgbtq(report) {
    if (!report) return false;
    if (report.external && report.external.catalogHits) {
      for (var c = 0; c < report.external.catalogHits.length; c++) {
        var hit = report.external.catalogHits[c];
        if (hit && (hit.id === "lgbtq" || /lgbtq/i.test(hit.label || ""))) return true;
      }
    }
    if (report.dimensions) {
      for (var d = 0; d < report.dimensions.length; d++) {
        var row = report.dimensions[d];
        if (row && row.id === "lgbtq" && /open library tag/i.test(String(row.note || ""))) return true;
      }
    }
    return false;
  }

  function catalogDescriptionAffirmsLgbtq(report, hint) {
    hint = hint || {};
    if (hint.detail && hintDetailIsLgbtqPolicy(hint.detail)) return true;
    if (!report || !report.dimensions) return false;
    for (var i = 0; i < report.dimensions.length; i++) {
      var row = report.dimensions[i];
      if (!row || row.id !== "lgbtq") continue;
      var note = String(row.note || "");
      if (/open library tag/i.test(note)) continue;
      if (textLooksLikeLgbtqWarning(note) && !lgbtqBriefDeniesContent(note)) return true;
    }
    return false;
  }

  function curatedNoteAffirmsLgbtq(report) {
    if (!report || report.mode !== "curated" || !report.parsedNote || !report.parsedNote.bullets) return false;
    for (var b = 0; b < report.parsedNote.bullets.length; b++) {
      var bullet = String(report.parsedNote.bullets[b] || "");
      if (textLooksLikeLgbtqWarning(bullet) && !lgbtqBriefDeniesContent(bullet)) return true;
    }
    return false;
  }

  function reportAiAffirmsLgbtq(report) {
    if (!report) return false;
    if (report.aiLgbtqPresent) return true;
    if (report.aiThemes) {
      for (var i = 0; i < report.aiThemes.length; i++) {
        if (report.aiThemes[i] && report.aiThemes[i].id === "lgbtq") return true;
      }
    }
    return false;
  }

  /** @returns {'present'|'absent'|'unknown'} */
  function resolveLgbtqStance(report, hint) {
    hint = hint || {};
    if (hint.ownerAiThemeAbsent && hint.ownerAiThemeAbsent.lgbtq) return "absent";
    if (report && report.aiLgbtqDenied) return "absent";
    if (catalogReportAffirmsLgbtq(report) || reportAiAffirmsLgbtq(report)) return "present";
    if (curatedNoteAffirmsLgbtq(report)) return "present";
    if (catalogDescriptionAffirmsLgbtq(report, hint)) return "present";
    return "unknown";
  }

  function lgbtqStanceAbsent(report, hint) {
    return resolveLgbtqStance(report, hint) === "absent";
  }

  function lgbtqStancePresent(report, hint) {
    return resolveLgbtqStance(report, hint) === "present";
  }

  function textLooksLikeLgbtqWarning(text) {
    var t = String(text || "").toLowerCase();
    if (lgbtqBriefDeniesContent(t)) return false;
    return /lgbtq|same[- ]sex|two[- ]moms|two[- ]dads|gay character|lesbian|queer character|transgender|non[- ]binary identity/.test(
      t
    );
  }

  function stripLgbtqDenialFromAiScanNote(note) {
    var parts = String(note || "").split(/\s*;\s*/);
    var kept = [];
    for (var i = 0; i < parts.length; i++) {
      var chunk = parts[i];
      if (themeBriefEmbedsLgbtqDenial(chunk)) {
        chunk = stripEmbeddedLgbtqDenial(chunk);
        if (!chunk || themeBriefEmbedsLgbtqDenial(chunk)) continue;
      }
      if (lgbtqBriefDeniesContent(chunk) && /lgbtq/i.test(chunk)) continue;
      kept.push(chunk);
    }
    return kept.join("; ");
  }

  function applyLgbtqStanceFilters(report, hint) {
    if (!report) return report;
    var stance = resolveLgbtqStance(report, hint);
    if (stance === "unknown") return report;
    var r = Object.assign({}, report);

    if (stance === "absent") {
      r.aiThemes = (report.aiThemes || []).filter(function (theme) {
        return !(theme && theme.id === "lgbtq");
      });
      r.dimensions = (report.dimensions || []).filter(function (row) {
        if (!row) return false;
        if (row.id === "lgbtq") return false;
        if (row.id === "policy" && hintDetailIsLgbtqPolicy(row.note)) return false;
        if (textLooksLikeLgbtqWarning(row.note) && /lgbtq/i.test(String(row.label || ""))) return false;
        return true;
      });
      if (report.external) {
        r.external = Object.assign({}, report.external);
        r.external.catalogHits = (report.external.catalogHits || []).filter(function (hit) {
          return !(hit && (hit.id === "lgbtq" || /lgbtq/i.test(hit.label || "")));
        });
        r.external.wikipediaHits = (report.external.wikipediaHits || []).filter(function (hit) {
          return !(hit && (hit.id === "lgbtq" || textLooksLikeLgbtqWarning((hit.label || "") + " " + (hit.snippet || ""))));
        });
        r.external.wikidataHits = (report.external.wikidataHits || []).filter(function (hit) {
          return !(hit && (hit.id === "lgbtq" || textLooksLikeLgbtqWarning((hit.label || "") + " " + (hit.snippet || ""))));
        });
      }
      if (hintDetailIsLgbtqPolicy(r.hintDetail)) r.hintDetail = "";
    }

    if (stance === "present") {
      r.dimensions = (report.dimensions || [])
        .map(function (row) {
          if (!row) return row;
          if (row.id === "lgbtq" && lgbtqBriefDeniesContent(row.note)) return null;
          if (themeBriefEmbedsLgbtqDenial(row.note)) {
            if (row.id === "ai_scan" || row.id === "romance" || /romantic/i.test(String(row.label || ""))) {
              var cleanedNote = stripLgbtqDenialFromAiScanNote(row.note);
              if (!cleanedNote || themeBriefEmbedsLgbtqDenial(cleanedNote)) return null;
              return Object.assign({}, row, { note: cleanedNote });
            }
            return null;
          }
          if (row.id === "ai_scan" && lgbtqBriefDeniesContent(row.note)) {
            var cleaned = stripLgbtqDenialFromAiScanNote(row.note);
            if (!cleaned) return null;
            return Object.assign({}, row, { note: cleaned });
          }
          return row;
        })
        .filter(Boolean);
      r.aiThemes = (report.aiThemes || []).filter(function (theme) {
        if (!theme) return false;
        if (theme.id === "lgbtq" && lgbtqBriefDeniesContent(theme.brief)) return false;
        if (theme.id !== "lgbtq" && themeBriefEmbedsLgbtqDenial(theme.brief)) return false;
        return true;
      });
    }

    return r;
  }

  function reportAiDeniesLgbtq(report, hint) {
    return lgbtqStanceAbsent(report, hint);
  }

  function cleanAutoRejectExplainer(text) {
    var t = stripCjk(text).replace(/\s+/g, " ").trim();
    t = t.replace(/^Owner:\s*/i, "");
    t = t.replace(/^Halalit\s+/i, "");
    t = t.replace(/\s*[—–-]\s*Halalit won't.*$/i, "");
    t = t.replace(/\s*Halalit won't recommend.*$/i, "");
    if (t.length > 220) t = t.slice(0, 217) + "…";
    return t;
  }

  function lowercaseExplainerStart(s) {
    s = String(s || "").trim();
    if (!s) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  function lgbtqExplainerFromText(text) {
    var t = String(text || "").toLowerCase();
    if (/two[- ]dads?|two fathers|both (?:his |her |the )?(?:dad|father)s?\b|gay (?:dad|father|parent)s?/.test(t)) {
      return "the protagonist's parents are both men";
    }
    if (/two[- ]moms?|two mothers|both (?:his |her |the )?(?:mom|mother)s?\b|lesbian (?:parent|mother|couple)/.test(t)) {
      return "the protagonist's parents are both women";
    }
    if (/same[- ]sex (?:couple|relationship|romance|crush|kiss|dating|marriage)/.test(t)) {
      return "it includes a same-sex romantic relationship";
    }
    if (/non[- ]binary|transgender|gender[- ]fluid|they\/them/.test(t)) {
      return "it includes transgender or non-binary identity in the cast";
    }
    return "";
  }

  var MATURE_ADULT_ROMANCE_RE =
    /\b(?:college|university|campus|new adult|\bna fiction\b|mature[- ]rated|explicit|open[- ]door|sexual content|erotic romance|graphic romance|off[- ]campus|hockey romance)\b/i;

  var EXPLICIT_ADULT_ROMANCE_RE =
    /\b(?:explicit|open[- ]door|sexual content|sex scenes|erotic romance|graphic romance)\b/i;

  function romanceBandFromText(text) {
    var t = String(text || "").toLowerCase();
    if (EXPLICIT_ADULT_ROMANCE_RE.test(t)) return "explicit_adult";
    if (MATURE_ADULT_ROMANCE_RE.test(t)) return "mature_adult";
    return "";
  }

  function romanceExplainerFromText(text) {
    var t = String(text || "");
    var band = romanceBandFromText(t);
    if (band === "explicit_adult") {
      return "the plot centers on an explicit mature-rated romantic relationship—not all-ages";
    }
    if (band === "mature_adult") {
      if (/college|university|campus|students?/i.test(t)) {
        return "the plot centers on a mature-rated college romance—not all-ages";
      }
      return "the plot centers on a mature-rated romantic relationship—not all-ages";
    }
    return "";
  }

  function topicExplainerTemplate(id, note) {
    var blob = String(note || "").toLowerCase();
    if (id === "lgbtq") {
      var lg = lgbtqExplainerFromText(blob);
      if (lg) return lg;
      return "it includes LGBTQ characters or relationships";
    }
    if (id === "romance" || id === "adult_romance" || id === "romantic_tension") {
      var rom = romanceExplainerFromText(note || blob);
      if (rom) return rom;
      if (id === "adult_romance") {
        if (/explicit|sexual|erotic/.test(blob)) {
          return "the plot centers on an explicit mature-rated romantic relationship—not all-ages";
        }
        return "the plot centers on a mature-rated romantic relationship—not all-ages";
      }
      if (/explicit|sexual|erotic|college|university|new adult|mature/.test(blob)) {
        return "the plot centers on a mature-rated romantic relationship—not all-ages";
      }
      return "";
    }
    if (id === "modesty") return "sexual content or fanservice shows up in catalog or plot text";
    if (id === "audience" || id === "teen_ya_age") return "it's written for teen or YA—not Halalit's all-ages shelf";
    if (id === "illegitimacy" || id === "illegitimate_children") {
      return "the plot centers on a child born out of wedlock";
    }
    if (id === "violence" || id === "violence_intense") return "violence or horror is prominent";
    if (id === "crude_profanity") return "harsh swearing or slurs appear in the story";
    if (id === "substance") return "alcohol, drugs, or smoking is part of the story";
    if (id === "deity" || id === "deity_mythology") return "deity or mythology is treated as real in the story";
    if (id === "format") return "it's comics or manga Halalit hasn't hand-vetted panel-by-panel";
    if (id === "family_tone" || id === "family_portrayed_negatively") {
      return "parents or family are portrayed harshly";
    }
    if (id === "crime_tone" || id === "romanticized_crime") return "crime or cruelty is romanticized";
    if (id === "group_demonization") return "it condemns an entire people group";
    if (id === "pro_colonial_narrative") return "it frames colonial or imperial rule as natural or good";
    if (id === "cultural_stereotype") return "it relies on shallow or false cultural stereotypes";
    if (note && note.length <= 180) return lowercaseExplainerStart(cleanAutoRejectExplainer(note));
    return "";
  }

  function explainerFromAiTheme(theme, report, hint) {
    if (!theme || !theme.id || !REJECT_AI_THEME_IDS[theme.id]) return "";
    if (hint && hint.ownerAiThemeAbsent && hint.ownerAiThemeAbsent[theme.id]) return "";
    if (themeBriefDeniesIssue(theme.brief)) return "";
    if (theme.id === "lgbtq" && lgbtqStanceAbsent(report, hint)) return "";
    if (theme.id === "teen_ya_age") return topicExplainerTemplate("teen_ya_age", theme.brief);
    var brief = cleanAutoRejectExplainer(theme.brief || "");
    var lg = lgbtqExplainerFromText(brief);
    if (lg) return lg;
    if (theme.id === "adult_romance" || theme.id === "romantic_tension") {
      var romAi = romanceExplainerFromText(brief);
      if (romAi) return romAi;
    }
    if (brief && !isGenericAutoRejectBrief(brief) && !explainerIsLowValueRejectReason(brief)) {
      return lowercaseExplainerStart(brief);
    }
    return topicExplainerTemplate(theme.id, brief);
  }

  function explainerFromDimension(row, report, hint) {
    if (!row) return "";
    if (themeBriefDeniesIssue(row.note)) return "";
    if (row.id === "lgbtq" && lgbtqStanceAbsent(report, hint)) return "";
    if (lgbtqBriefDeniesContent(row.note) && lgbtqStancePresent(report, hint)) return "";
    var note = stripCjk(row.note || "");
    var descMatch = note.match(/Description:\s*[“"]([^”"]+)[”"]/i);
    if (descMatch && descMatch[1]) {
      var snippet = descMatch[1].trim();
      if (row.id === "lgbtq") {
        var lg = lgbtqExplainerFromText(snippet);
        if (lg) return lg;
        return lowercaseExplainerStart(snippet);
      }
      return lowercaseExplainerStart(snippet);
    }

    if (row.id === "ai_scan") {
      var parts = note.split(/\s*;\s*/);
      for (var p = 0; p < parts.length; p++) {
        var chunk = parts[p];
        var dash = chunk.indexOf(" — ");
        if (dash >= 0) chunk = chunk.slice(dash + 3);
        chunk = cleanAutoRejectExplainer(chunk.replace(/^[^:]+:\s*/, ""));
        if (chunk.length < 16 || isGenericAutoRejectBrief(chunk)) continue;
        if (themeBriefDeniesIssue(chunk) || themeBriefEmbedsLgbtqDenial(chunk)) continue;
        var lgScan = lgbtqExplainerFromText(chunk);
        if (lgScan) return lgScan;
        var romScan = romanceExplainerFromText(chunk);
        if (romScan) return romScan;
        return lowercaseExplainerStart(chunk);
      }
    }

    if (row.id && String(row.id).indexOf("halalit_bullet_") === 0) {
      return lowercaseExplainerStart(cleanAutoRejectExplainer(note));
    }

    if (row.id === "blocklist" || row.id === "policy" || row.id === "hand_check") {
      var block = cleanAutoRejectExplainer(note);
      if (block) return lowercaseExplainerStart(block);
    }

    if (row.id === "lgbtq") {
      var lgbtq = lgbtqExplainerFromText(note);
      if (lgbtq) return lgbtq;
      if (/open library tag/i.test(note)) {
        return "the Open Library record tags this edition with LGBTQ-related subjects";
      }
    }

    return topicExplainerTemplate(row.id, note);
  }

  function explainerFromCuratedBullet(bullet, report, hint) {
    var b = cleanAutoRejectExplainer(bullet);
    if (!b) return "";
    var policy = explainerFromPolicyDetail(b, report, hint);
    if (policy) return policy;
    var lg = lgbtqExplainerFromText(b);
    if (lg) return lg;
    var first = b.match(/^[^.!?]+[.!?]?/);
    if (first && first[0].length >= 20) b = first[0].trim();
    return lowercaseExplainerStart(b);
  }

  function isBoilerplateExplainer(text) {
    return /^(it falls outside|outside halalit.?s family shelf|shelf rules)/i.test(String(text || "").trim());
  }

  function explainerFromPolicyDetail(detail, report, hint) {
    var d = String(detail || "").toLowerCase();
    if (/tags mention lgbtq|lgbtq identity or related themes/.test(d)) {
      if (lgbtqStanceAbsent(report, hint)) return "";
      return "catalog tags point to LGBTQ characters or relationships in this edition";
    }
    if (/description or notes mention lgbtq|flags lgbtq representation/.test(d)) {
      if (lgbtqStanceAbsent(report, hint)) return "";
      return "the catalog description or notes mention LGBTQ themes";
    }
    if (/tags mention illegitimacy|born out of wedlock/.test(d)) {
      return "catalog tags point to an illegitimate-child storyline";
    }
    if (/adult romance|mature[- ]rated|college romance|new adult romance|explicit mature|notes mention adult or mature/.test(d)) {
      return romanceExplainerFromText(detail) || "the plot centers on a mature-rated romantic relationship—not all-ages";
    }
    if (/romantic tension|romance as the main/.test(d)) {
      var romPol = romanceExplainerFromText(detail);
      if (romPol) return romPol;
      /* Light romantic tension is not an automatic reject — no explainer here. */
    }
    if (/harsh swearing|slurs|profan/.test(d)) {
      return "catalog or plot text flags harsh swearing or slurs";
    }
    if (/pro[- ]colonial|colonial framing/.test(d)) {
      return "it carries a pro-colonial or imperial framing";
    }
    if (/group demon|condemn an entire/.test(d)) {
      return "it condemns an entire people group";
    }
    if (/teen|young adult|ya fiction/.test(d)) {
      return "it's tagged or written for teen or YA—not Halalit's all-ages shelf";
    }
    if (/fanservice|sexualized|comics, manga/.test(d)) {
      return "it's comics or manga with content Halalit hasn't hand-vetted panel-by-panel";
    }
    return "";
  }

  function explainerFromReasonText(reason, report, hint) {
    var r = stripCjk(reason).trim();
    if (!r) return "";
    var parts = r.match(/^([^:]+):\s*(.+)$/);
    if (parts) {
      var label = parts[1].trim();
      var note = parts[2].trim();
      var idByLabel = {
        "LGBTQ themes": "lgbtq",
        "Romance or dating": "romance",
        "Sexual content or fanservice": "modesty",
        "Age band": "audience",
        "Illegitimate-children plot": "illegitimacy",
        "Violence or horror": "violence",
        "Harsh swearing or slurs": "crude_profanity",
        "Alcohol, smoking, or drugs": "substance",
        "Deity or mythology": "deity",
        "Comics or manga": "format",
        "Family portrayed harshly": "family_tone",
        "Crime or cruelty tone": "crime_tone",
        "Halalit blocklist": "blocklist",
        "Halalit rule": "policy",
      };
      var ex = explainerFromDimension(
        {
          id: idByLabel[label] || "",
          note: note,
          status: "concern",
        },
        report,
        hint
      );
      if (ex && !isBoilerplateExplainer(ex)) return ex;
    }
    var policy = explainerFromPolicyDetail(r, report, hint);
    if (policy) return policy;
    return explainerFromCuratedBullet(r, report, hint);
  }

  function vagueExplainerFallback(report, hint) {
    hint = hint || {};
    if (report && report.dimensions) {
      for (var i = 0; i < report.dimensions.length; i++) {
        var row = report.dimensions[i];
        if (!row || row.status !== "concern" || row.id === "catalog_silent") continue;
        var t = explainerFromDimension(row, report, hint);
        if (t && !isBoilerplateExplainer(t) && !explainerIsLowValueRejectReason(t)) return [t];
      }
    }
    if (hint.detail && !isGraphicUnvettedDetail(hint.detail)) {
      var policy = explainerFromPolicyDetail(hint.detail, report, hint);
      if (policy) return [policy];
      var curated = explainerFromCuratedBullet(hint.detail, report, hint);
      if (curated && !isBoilerplateExplainer(curated)) return [curated];
    }
    if (report && report.external && report.external.catalogHits && report.external.catalogHits.length) {
      var hit = report.external.catalogHits[0];
      if (hit && hit.label && hit.tags && hit.tags.length) {
        return [
          "the Open Library record flags " +
            hit.label.toLowerCase() +
            " (" +
            hit.tags.slice(0, 3).join(", ") +
            ")",
        ];
      }
    }
    return [
      "catalog and theme clues point to a family-shelf concern, but Halalit doesn't have a specific plot beat on file for this edition yet",
    ];
  }

  function explainerAffirmsLgbtq(text) {
    var t = String(text || "");
    if (!t || lgbtqBriefDeniesContent(t) || themeBriefDeniesIssue(t)) return false;
    return textLooksLikeLgbtqWarning(t) || /catalog description or notes mention lgbtq|catalog tags point to lgbtq/i.test(t);
  }

  function dedupeLgbtqAutoRejectExplainers(explainers, report, hint) {
    if (!explainers || !explainers.length) return explainers || [];
    var affirm = [];
    var deny = [];
    var other = [];
    for (var i = 0; i < explainers.length; i++) {
      var ex = explainers[i];
      if (lgbtqBriefDeniesContent(ex) || themeBriefEmbedsLgbtqDenial(ex) || /not confirmed on[- ]page|reader speculation or subtext only/i.test(ex)) {
        deny.push(ex);
      } else if (explainerAffirmsLgbtq(ex)) {
        affirm.push(ex);
      } else {
        other.push(ex);
      }
    }
    if (affirm.length && deny.length) {
      if (lgbtqStanceAbsent(report, hint)) {
        if (other.length) return other.slice(0, 3);
        if (affirm.length) return affirm.concat(other).slice(0, 3);
        return [];
      }
      return affirm.concat(other).slice(0, 3);
    }
    if (lgbtqStanceAbsent(report, hint)) {
      var kept = other.concat(affirm).filter(function (ex) {
        return (
          !lgbtqBriefDeniesContent(ex) &&
          !themeBriefEmbedsLgbtqDenial(ex) &&
          !themeBriefDeniesIssue(ex) &&
          !explainerIsLowValueRejectReason(ex) &&
          !/not confirmed on[- ]page|reader (?:speculation|projection)|perceived subtext is reader projection/i.test(ex)
        );
      });
      if (kept.length) return kept.slice(0, 3);
      return [];
    }
    if (lgbtqStancePresent(report, hint) && deny.length) {
      other = other.filter(function (ex) {
        return !themeBriefEmbedsLgbtqDenial(ex);
      });
      return affirm.concat(other).slice(0, 3);
    }
    return explainers.slice(0, 3);
  }

  function policyDetailAutoRejectExplainer(detail, report, hint) {
    if (!detail) return "";
    var policy = explainerFromPolicyDetail(detail, report, hint);
    if (policy) return policy;
    var curated = explainerFromCuratedBullet(detail, report, hint);
    if (curated && !isBoilerplateExplainer(curated) && !explainerIsLowValueRejectReason(curated)) return curated;
    return "";
  }

  function finalizeAutoRejectExplainers(report, hint, reasons) {
    hint = hint || {};
    var explainers = [];
    var seen = {};

    if (hint.detail && (hint.tier === "flag_review" || (report && report.hintTier === "flag_review"))) {
      var policyEx = policyDetailAutoRejectExplainer(hint.detail, report, hint);
      if (policyEx) {
        explainers.push(policyEx);
        seen[policyEx.toLowerCase()] = true;
      }
    }

    if (reasons && reasons.length) {
      for (var r = 0; r < reasons.length && explainers.length < 3; r++) {
        var ex = explainerFromReasonText(reasons[r], report, hint);
        if (!ex || isBoilerplateExplainer(ex) || themeBriefDeniesIssue(ex) || explainerIsLowValueRejectReason(ex)) continue;
        if (lgbtqStancePresent(report, hint) && themeBriefEmbedsLgbtqDenial(ex)) continue;
        var key = ex.toLowerCase();
        if (seen[key]) continue;
        seen[key] = true;
        explainers.push(ex);
      }
    }
    if (!explainers.length) explainers = collectAutoRejectExplainers(report, hint);
    if (!explainers.length) explainers = vagueExplainerFallback(report, hint);
    explainers = prioritizeAutoRejectExplainers(explainers.slice(0, 6), report, hint);
    return dedupeLgbtqAutoRejectExplainers(explainers.slice(0, 3), report, hint);
  }

  function collectAutoRejectExplainers(report, hint) {
    hint = hint || {};
    var explainers = [];
    var seen = {};
    var tier = hint.tier || (report && (report.hintTier || report.tier)) || "";

    function add(text) {
      var e = cleanAutoRejectExplainer(text);
      if (!e || explainerIsLowValueRejectReason(e) || themeBriefDeniesIssue(e)) return;
      if (lgbtqStancePresent(report, hint) && themeBriefEmbedsLgbtqDenial(e)) return;
      if (lgbtqBriefDeniesContent(e) && lgbtqStancePresent(report, hint)) return;
      if (textLooksLikeLgbtqWarning(e) && lgbtqStanceAbsent(report, hint)) return;
      var key = e.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      explainers.push(lowercaseExplainerStart(e));
    }

    if (report && report.mode === "curated" && report.parsedNote && report.parsedNote.bullets.length) {
      for (var b = 0; b < report.parsedNote.bullets.length && explainers.length < 3; b++) {
        add(explainerFromCuratedBullet(report.parsedNote.bullets[b], report, hint));
      }
    }

    if (tier === "flag_review" && hint.detail && !isGraphicUnvettedDetail(hint.detail)) {
      if (!hintDetailIsLgbtqPolicy(hint.detail) || !lgbtqStanceAbsent(report, hint)) {
        add(explainerFromCuratedBullet(hint.detail, report, hint));
      }
    }

    if (report && report.dimensions) {
      for (var i = 0; i < report.dimensions.length && explainers.length < 3; i++) {
        var row = report.dimensions[i];
        if (!row || row.status !== "concern") continue;
        if (row.id === "catalog_silent") continue;
        add(explainerFromDimension(row, report, hint));
      }
    }

    if (report && report.aiThemes && report.aiThemes.length) {
      for (var a = 0; a < report.aiThemes.length && explainers.length < 3; a++) {
        add(explainerFromAiTheme(report.aiThemes[a], report, hint));
      }
    }

    if (report && report.dimensions && explainers.length < 3) {
      for (var c = 0; c < report.dimensions.length && explainers.length < 3; c++) {
        var caution = report.dimensions[c];
        if (!caution || caution.status !== "caution" || caution.id !== "ai_scan") continue;
        add(explainerFromDimension(caution, report, hint));
      }
    }

    if (report && report.external && report.external.wikipediaHits && explainers.length < 3) {
      for (var w = 0; w < report.external.wikipediaHits.length && explainers.length < 3; w++) {
        var wh = report.external.wikipediaHits[w];
        if (!wh || !wh.snippet) continue;
        if (lgbtqStanceAbsent(report, hint) && (wh.id === "lgbtq" || textLooksLikeLgbtqWarning(wh.label + " " + wh.snippet))) {
          continue;
        }
        if (wh.id === "lgbtq" || /lgbtq|gay|lesbian|queer|same[- ]sex/i.test(wh.label + " " + wh.snippet)) {
          var lgWiki = lgbtqExplainerFromText(wh.snippet);
          add(lgWiki || lowercaseExplainerStart(wh.snippet));
        }
      }
    }

    if (report && report.external && report.external.catalogHits && explainers.length < 3) {
      for (var ch = 0; ch < report.external.catalogHits.length && explainers.length < 3; ch++) {
        var catHit = report.external.catalogHits[ch];
        if (!catHit || !catHit.tags || !catHit.tags.length) continue;
        if (lgbtqStanceAbsent(report, hint)) continue;
        if (catHit.id === "lgbtq" || /lgbtq/i.test(catHit.label || "")) {
          add(
            "the Open Library record tags this edition with LGBTQ-related subjects (" +
              catHit.tags.slice(0, 3).join(", ") +
              ")"
          );
        }
      }
    }

    if (!explainers.length && report && report.descriptionExcerpt) {
      if (!lgbtqStanceAbsent(report, hint)) {
        var lgDesc = lgbtqExplainerFromText(report.descriptionExcerpt);
        if (lgDesc) add(lgDesc);
        else if (!lgbtqBriefDeniesContent(report.descriptionExcerpt)) add(report.descriptionExcerpt);
      }
    }

    return explainers.slice(0, 3);
  }

  /**
   * @returns {{ status: 'hand_clean'|'reject'|'clear', reasons: string[], explainers: string[] }}
   */
  function autoRejectionSummary(report, hint) {
    hint = hint || {};
    var tier = hint.tier || (report && (report.hintTier || report.tier)) || "";
    var reasons = [];
    var seen = {};

    function push(reason) {
      var r = stripCjk(String(reason || "")).trim();
      if (!r || seen[r]) return;
      seen[r] = true;
      reasons.push(r);
    }

    if (reportTierIsHandClean(report, hint)) {
      return { status: "hand_clean", reasons: [], explainers: [] };
    }

    if (tier === "user_discretion") {
      return { status: "clear", reasons: [], explainers: [] };
    }

    if (report && report.mode === "curated" && (tier === "flag_review" || tier === "teen_caution")) {
      if (report.parsedNote && report.parsedNote.bullets.length) {
        for (var b = 0; b < report.parsedNote.bullets.length; b++) push(report.parsedNote.bullets[b]);
      } else if (report.parsedNote && report.parsedNote.heading) {
        push(report.parsedNote.heading);
      }
      if (reasons.length) {
        return {
          status: "reject",
          reasons: reasons,
          explainers: finalizeAutoRejectExplainers(report, hint, reasons),
        };
      }
    }

    if (tier === "flag_review" && hint.detail && !isGraphicUnvettedDetail(hint.detail)) {
      if (!hintDetailIsLgbtqPolicy(hint.detail) || !lgbtqStanceAbsent(report, hint)) {
        push(hint.detail);
      }
    }

    if (report && report.dimensions) {
      for (var i = 0; i < report.dimensions.length; i++) {
        var row = report.dimensions[i];
        if (!row || row.status !== "concern") continue;
        if (row.id === "lgbtq" && lgbtqStanceAbsent(report, hint)) continue;
        if (row.id === "policy" && hintDetailIsLgbtqPolicy(row.note) && lgbtqStanceAbsent(report, hint)) continue;
        if (row.id === "catalog_silent" || row.id === "blocklist") {
          push(row.note);
          continue;
        }
        push(row.label + ": " + row.note);
      }
    }

    if (reasons.length) {
      return {
        status: "reject",
        reasons: reasons,
        explainers: finalizeAutoRejectExplainers(report, hint, reasons),
      };
    }
    return { status: "clear", reasons: [], explainers: [] };
  }

  function autoRejectBookPhrase(report) {
    var title = stripCjk(report && report.title) || "this book";
    var author = stripCjk(report && report.author) || "";
    var quoted = "'" + title + "'";
    if (author) return author + "'s " + quoted;
    return quoted;
  }

  function hasAutoReject(report, hint) {
    return autoRejectionSummary(report, hint).status === "reject";
  }

  function autoRejectLeadLabel(report, hint) {
    hint = hint || {};
    if (hint.agentFlag || (report && report.agentFlag)) {
      return "Halalit flagged (not hand-read):";
    }
    return "Automatic rejection:";
  }

  function renderAutoRejectionHtml(report, hint) {
    hint = hint || {};
    if (!report) return "";
    if (reportTierIsHandClean(report, hint)) return renderUnvettedGraphicNote(report);
    var ar = autoRejectionSummary(report, hint);
    if (ar.status !== "reject") return renderUnvettedGraphicNote(report);

    var explainers = finalizeAutoRejectExplainers(report, hint, ar.reasons || []);

    var html = '<div class="bookcheck-auto-reject">';
    html +=
      '<p class="bookcheck-auto-reject-lead"><strong>' +
      escapeHtml(autoRejectLeadLabel(report, hint)) +
      "</strong> " +
      escapeHtml(autoRejectBookPhrase(report)) +
      " is not recommended by Halalit because:</p>";
    if (explainers.length === 1) {
      html +=
        '<p class="bookcheck-auto-reject-detail">' + escapeHtml(explainers[0]) + ".</p>";
    } else {
      html += '<ul class="bookcheck-auto-reject-detail">';
      for (var e = 0; e < explainers.length && e < 3; e++) {
        html += "<li>" + escapeHtml(explainers[e]) + "</li>";
      }
      html += "</ul>";
    }
    html += "</div>";
    return html;
  }

  function renderExternalEvidenceHtml(ext) {
    if (!ext) return "";
    var items = [];
    var h;
    if (ext.catalogHits && ext.catalogHits.length) {
      for (h = 0; h < ext.catalogHits.length; h++) {
        var ch = ext.catalogHits[h];
        items.push(
          ch.label +
            " — Open Library tag" +
            (ch.tags.length === 1 ? "" : "s") +
            ': “' +
            ch.tags.slice(0, 4).join("”; “") +
            "”"
        );
      }
    }
    if (ext.themeIndex && ext.themeIndex.detail) {
      items.push(ext.themeIndex.detail + " (“" + (ext.themeIndex.listName || "Halalit approved list") + "”)");
    }
    if (ext.wikipediaHits && ext.wikipediaHits.length) {
      for (h = 0; h < ext.wikipediaHits.length; h++) {
        var wh = ext.wikipediaHits[h];
        items.push(
          wh.label +
            " — Wikipedia: “" +
            (wh.snippet || "mentioned") +
            "”"
        );
      }
    } else if (ext.wikipedia && ext.wikipedia.plot) {
      items.push(
        "Wikipedia “" +
          (ext.wikipedia.plotSectionTitle || "Plot") +
          "” section scanned for Halalit shelf themes."
      );
    }
    if (ext.wikidataHits && ext.wikidataHits.length) {
      for (h = 0; h < ext.wikidataHits.length; h++) {
        var dh = ext.wikidataHits[h];
        items.push(dh.label + " — Wikidata: “" + (dh.snippet || "linked label") + "”");
      }
    }
    if (!items.length) return "";
    var html =
      '<div class="bookcheck-external"><p class="bookcheck-external-title">How we know (besides the blurb) — all Halalit shelf themes</p><ul>';
    for (var i = 0; i < items.length; i++) {
      html += "<li>" + escapeHtml(items[i]) + "</li>";
    }
    html += "</ul></div>";
    return html;
  }

  function statusLabel(status) {
    if (status === "ok") return "Clear";
    if (status === "caution") return "Preview";
    if (status === "concern") return "Concern";
    return "Silent";
  }

  function filterReportForPrefs(report) {
    var Prefs = global.HalalitBookcheckPrefs;
    if (!report) return report;
    var hint = {
      tier: report.hintTier || report.tier,
      detail: report.hintDetail || "",
      agentFlag: !!report.agentFlag,
    };
    var r = applyLgbtqStanceFilters(report, hint);
    if (!Prefs) return r;
    if (r.parsedNote && r.parsedNote.bullets && r.parsedNote.bullets.length) {
      r = Object.assign({}, r);
      r.parsedNote = Object.assign({}, r.parsedNote);
      r.parsedNote.bullets = r.parsedNote.bullets.filter(function (b) {
        return !Prefs.shouldHideComfortText(b);
      });
    }
    if (r.dimensions && r.dimensions.length) {
      r = Object.assign({}, r);
      r.dimensions = r.dimensions.filter(function (d) {
        return !Prefs.shouldHideScanRow(d);
      });
    }
    if (r.external) {
      r = Object.assign({}, r);
      r.external = Object.assign({}, r.external);
      if (r.external.catalogHits && r.external.catalogHits.length) {
        r.external.catalogHits = r.external.catalogHits.filter(function (h) {
          return !Prefs.shouldHideThemeHit(h);
        });
      }
      if (r.external.wikipediaHits && r.external.wikipediaHits.length) {
        r.external.wikipediaHits = r.external.wikipediaHits.filter(function (h) {
          return !Prefs.shouldHideThemeHit(h);
        });
      }
      if (r.external.wikidataHits && r.external.wikidataHits.length) {
        r.external.wikidataHits = r.external.wikidataHits.filter(function (h) {
          return !Prefs.shouldHideThemeHit(h);
        });
      }
    }
    return r;
  }

  function stripCjk(s) {
    return String(s || "")
      .replace(/[\u3000-\u9fff\uf900-\ufaff\uac00-\ud7af]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function renderBookcheckReportHtmlCompact(report, opts) {
    if (!report) return "";
    opts = opts || {};
    report = filterReportForPrefs(report);
    var html = "";
    var hint = {
      tier: report.hintTier || report.tier,
      detail: report.hintDetail || "",
      agentFlag: !!report.agentFlag,
    };
    var slim = shouldSlimCatalogReport(report, hint, opts);
    var autoReject = hasAutoReject(report, hint);

    html += renderAutoRejectionHtml(report, hint);
    if (autoReject) return html;

    if (report.summary && !slim) {
      html += '<p class="bookcheck-report-summary">' + escapeHtml(stripCjk(report.summary)) + "</p>";
    }

    if (report.familyAction && !slim && !autoReject) {
      html +=
        '<p class="bookcheck-action"><strong>What to do:</strong> ' +
        escapeHtml(stripCjk(report.familyAction)) +
        "</p>";
    }

    html += renderYouDecideLineHtml(report, hint, opts);

    var concernRows = [];
    if (report.mode !== "curated" && report.dimensions && report.dimensions.length) {
      for (var cr = 0; cr < report.dimensions.length; cr++) {
        var crow = report.dimensions[cr];
        if (!crow || (crow.status !== "concern" && crow.status !== "caution")) continue;
        if (crow.id === "catalog_silent" || crow.status === "unknown") continue;
        if (themeBriefDeniesIssue(crow.note) || scanNoteHidesLgbtqDenial(crow.note, report, hint)) continue;
        if (crow.id === "ai_scan" && opts.vetSource === "ai_themes") continue;
        concernRows.push(crow);
      }
    }

    var plotExtras =
      (report.mode === "curated" &&
        report.parsedNote &&
        report.parsedNote.bullets.length) ||
      concernRows.length ||
      report.aiSeriesNote ||
      (report.external &&
        ((report.external.wikipediaHits && report.external.wikipediaHits.length) ||
          (report.external.wikipedia && report.external.wikipedia.plot)));

    if (!plotExtras) {
      if (report.descriptionExcerpt) {
        var descOnly = stripCjk(report.descriptionExcerpt);
        if (descOnly.length >= 24) {
          html +=
            '<blockquote class="bookcheck-catalog-desc"><strong>Catalog blurb:</strong> ' +
            escapeHtml(descOnly.length > 220 ? descOnly.slice(0, 217) + "…" : descOnly) +
            "</blockquote>";
        }
      }
      return html;
    }

    html += '<div class="bookcheck-halalit-note">';
    html += '<p class="bookcheck-halalit-note-title">Plot &amp; themes</p><ul>';

    if (!autoReject && report.mode === "curated" && report.parsedNote && report.parsedNote.bullets.length) {
      for (var b = 0; b < report.parsedNote.bullets.length; b++) {
        var bullet = stripCjk(report.parsedNote.bullets[b]);
        if (!bullet) continue;
        html += "<li>" + escapeHtml(bullet) + "</li>";
      }
    }

    var shown = 0;
    for (var d = 0; d < concernRows.length; d++) {
      var row = concernRows[d];
      var note = stripCjk(row.note);
      if (!note) continue;
      html +=
        "<li><strong>" +
        escapeHtml(row.label) +
        ":</strong> " +
        escapeHtml(note) +
        "</li>";
      shown += 1;
      if (shown >= 6) break;
    }

    if (report.aiSeriesNote) {
      html += "<li><strong>Series:</strong> " + escapeHtml(stripCjk(report.aiSeriesNote)) + "</li>";
    }

    if (report.external) {
      var extBits = [];
      if (report.external.wikipediaHits && report.external.wikipediaHits.length) {
        for (var wh = 0; wh < report.external.wikipediaHits.length && wh < 2; wh++) {
          extBits.push(
            report.external.wikipediaHits[wh].label +
              " (Wikipedia): " +
              stripCjk(report.external.wikipediaHits[wh].snippet || "mentioned")
          );
        }
      } else if (report.external.wikipedia && report.external.wikipedia.plot) {
        extBits.push(
          "Wikipedia plot scanned for themes—Halalit did not hand-read the book."
        );
      }
      if (report.external.catalogHits && report.external.catalogHits.length) {
        for (var ch = 0; ch < report.external.catalogHits.length && ch < 2; ch++) {
          extBits.push(
            report.external.catalogHits[ch].label +
              " — catalog tag: " +
              stripCjk((report.external.catalogHits[ch].tags || []).slice(0, 2).join(", "))
          );
        }
      }
      for (var eb = 0; eb < extBits.length; eb++) {
        html += "<li>" + escapeHtml(extBits[eb]) + "</li>";
      }
    }

    html += "</ul></div>";

    if (report.descriptionExcerpt) {
      var desc = stripCjk(report.descriptionExcerpt);
      if (desc.length >= 24) {
        html +=
          '<blockquote class="bookcheck-catalog-desc"><strong>Catalog blurb:</strong> ' +
          escapeHtml(desc.length > 220 ? desc.slice(0, 217) + "…" : desc) +
          "</blockquote>";
      }
    }

    return html;
  }

  function shouldSlimCatalogReport(report, hint, opts) {
    if (!opts || !opts.experienced) return false;
    if (!report || report.mode !== "catalog") return false;
    return !reportIsHandSettled(report, hint);
  }

  function renderBookcheckReportHtml(report, opts) {
    if (!report) return "";
    opts = opts || {};
    if (opts.compact) return renderBookcheckReportHtmlCompact(report, opts);
    report = filterReportForPrefs(report);
    var html = "";
    var hint = {
      tier: report.hintTier || report.tier,
      detail: report.hintDetail || "",
      agentFlag: !!report.agentFlag,
    };
    var slim = shouldSlimCatalogReport(report, hint, opts);
    var autoReject = hasAutoReject(report, hint);

    if (report.bookLead && !slim && !autoReject) {
      html += '<p class="bookcheck-book-lead">' + escapeHtml(stripCjk(report.bookLead)) + "</p>";
    }

    if (report.familyAction && !slim && !autoReject) {
      html +=
        '<p class="bookcheck-action"><strong>What to do:</strong> ' + escapeHtml(report.familyAction) + "</p>";
    }

    html += renderAutoRejectionHtml(report, hint);
    if (autoReject) return html;

    html += renderYouDecideLineHtml(report, hint, opts);

    if (report.summary && !slim && !autoReject) {
      html += '<p class="bookcheck-report-summary">' + escapeHtml(report.summary) + "</p>";
    }

    if (!autoReject && report.mode === "curated" && report.parsedNote && report.parsedNote.bullets.length) {
      html += '<div class="bookcheck-halalit-note">';
      html += '<p class="bookcheck-halalit-note-title">' + escapeHtml(report.parsedNote.heading) + "</p>";
      html += "<ul>";
      for (var b = 0; b < report.parsedNote.bullets.length; b++) {
        html += "<li>" + escapeHtml(report.parsedNote.bullets[b]) + "</li>";
      }
      html += "</ul>";
      if (
        report.parsedNote.closing &&
        !(global.HalalitBookcheckPrefs && global.HalalitBookcheckPrefs.shouldHideComfortText(report.parsedNote.closing))
      ) {
        html += '<p class="bookcheck-halalit-closing muted">' + escapeHtml(report.parsedNote.closing) + "</p>";
      }
      html += "</div>";
    }

    if (!autoReject && report.dimensions && report.dimensions.length) {
      var scanTitle =
        report.mode === "curated" ? "Also from the catalog record" : "What we found for this book";
      html += '<div class="bookcheck-scan-wrap"><p class="bookcheck-scan-title">' + escapeHtml(scanTitle) + "</p>";
      html += '<ul class="bookcheck-scan">';
      for (var i = 0; i < report.dimensions.length; i++) {
        var d = report.dimensions[i];
        if (report.mode === "curated" && (d.id === "hand_check" || (d.id && String(d.id).indexOf("halalit_bullet_") === 0)))
          continue;
        if (d.id === "catalog_silent" || d.status === "unknown") continue;
        if (d.id === "ai_scan" && opts.vetSource === "ai_themes") continue;
        if (themeBriefDeniesIssue(d.note) || scanNoteHidesLgbtqDenial(d.note, report, hint)) continue;
        html +=
          '<li class="bookcheck-scan-row bookcheck-scan-row--' +
          escapeHtml(d.status) +
          '"><span class="bookcheck-scan-label">' +
          escapeHtml(d.label) +
          '</span><span class="bookcheck-scan-status">' +
          escapeHtml(statusLabel(d.status)) +
          '</span><span class="bookcheck-scan-note">' +
          escapeHtml(d.note) +
          "</span></li>";
      }
      html += "</ul></div>";
    }

    if (!autoReject && report.descriptionExcerpt) {
      var desc = stripCjk(report.descriptionExcerpt);
      if (desc.length >= 24) {
        html +=
          '<blockquote class="bookcheck-catalog-desc"><strong>Publisher/catalog description for this edition:</strong> ' +
          escapeHtml(desc.length > 380 ? desc.slice(0, 377) + "…" : desc) +
          "</blockquote>";
      }
    }

    if (!autoReject && report.relevantSubjects && report.relevantSubjects.length) {
      html +=
        '<p class="bookcheck-subjects"><strong>Tags on this edition:</strong> ' +
        escapeHtml(report.relevantSubjects.join(" · ")) +
        "</p>";
    }

    if (!autoReject && report.gaps && report.gaps.length && !slim) {
      html += '<div class="bookcheck-gaps"><p class="bookcheck-gaps-title"><strong>For “' + escapeHtml(report.title) + "” specifically, catalogs miss</strong></p><ul>";
      for (var g = 0; g < report.gaps.length; g++) {
        html += "<li>" + escapeHtml(report.gaps[g]) + "</li>";
      }
      html += "</ul></div>";
    }

    if (!autoReject && !slim) {
      html += renderExternalEvidenceHtml(report.external);
    }

    if (!autoReject && !slim) {
      html +=
        '<p class="bookcheck-sources muted">Sources: ' +
        escapeHtml(report.sourcesUsed) +
        (report.firstPublishYear ? " · first published " + report.firstPublishYear : "") +
        ". No Goodreads scraping.</p>";
    }
    return html;
  }

  global.HalalitBookcheckReport = {
    build: buildBookcheckReport,
    youDecideLine: YOU_DECIDE_LINE,
    shouldShowYouDecideLine: shouldShowYouDecideLine,
    autoRejectionSummary: autoRejectionSummary,
    hasAutoReject: hasAutoReject,
    renderAutoRejectionHtml: renderAutoRejectionHtml,
    renderYouDecideLineHtml: renderYouDecideLineHtml,
    renderHtml: renderBookcheckReportHtml,
    renderHtmlCompact: renderBookcheckReportHtmlCompact,
    themeBriefDeniesIssue: themeBriefDeniesIssue,
  };
})(typeof window !== "undefined" ? window : this);
