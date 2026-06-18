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
    var inBlob = topic.textRe.test(blobText);
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

    var noteParts = [];
    if (tagHits.length)
      noteParts.push("Open Library tag: “" + tagHits.slice(0, 4).join("”; “") + "”");
    if (descHit) noteParts.push('Description: “' + descHit + "”");
    if (!tagHits.length && !descHit && inBlob) noteParts.push("Mentioned in combined catalog text for this edition.");

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
      for (var si = 0; si < hint.signals.length; si++) {
        var sig = String(hint.signals[si] || "").trim();
        if (!/^AI scan:/i.test(sig)) continue;
        rows.push({
          id: "ai_signal_" + si,
          label: "AI theme scan",
          status: "caution",
          note: sig.replace(/^AI scan:\s*/i, ""),
        });
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

    if (catalogOnly.length) {
      rows.push({
        id: "catalog_silent",
        label: "Catalog didn’t mention",
        status: "unknown",
        note:
          catalogOnly.slice(0, 6).join(", ") +
          (catalogOnly.length > 6 ? ", …" : "") +
          "—still possible in the story; Halalit adds hand notes when we’ve read a series.",
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
    report.hintTier = (opts.hint && opts.hint.tier) || report.tier;
    report.hintDetail = (opts.hint && opts.hint.detail) || "";
    if (report.isGraphic == null) {
      var descBlob = (opts.descriptionOnly || "") + " " + (opts.supplementText || "");
      report.isGraphic = titleLooksGraphic(title, descBlob.toLowerCase());
    }
    return attachExternalEvidence(report, opts);
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

  /**
   * @returns {{ status: 'hand_clean'|'reject'|'clear', reasons: string[] }}
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
      return { status: "hand_clean", reasons: [] };
    }

    if (tier === "user_discretion") {
      return { status: "clear", reasons: [] };
    }

    if (report && report.mode === "curated" && (tier === "flag_review" || tier === "teen_caution")) {
      if (report.parsedNote && report.parsedNote.bullets.length) {
        for (var b = 0; b < report.parsedNote.bullets.length; b++) push(report.parsedNote.bullets[b]);
      } else if (report.parsedNote && report.parsedNote.heading) {
        push(report.parsedNote.heading);
      }
      if (reasons.length) return { status: "reject", reasons: reasons };
    }

    if (tier === "flag_review" && hint.detail && !isGraphicUnvettedDetail(hint.detail)) {
      push(hint.detail);
    }

    if (report && report.dimensions) {
      for (var i = 0; i < report.dimensions.length; i++) {
        var row = report.dimensions[i];
        if (!row || row.status !== "concern") continue;
        if (row.id === "catalog_silent" || row.id === "blocklist") {
          push(row.note);
          continue;
        }
        push(row.label + ": " + row.note);
      }
    }

    if (reasons.length) return { status: "reject", reasons: reasons };
    return { status: "clear", reasons: [] };
  }

  function renderAutoRejectionHtml(report, hint) {
    hint = hint || {};
    if (!report) return "";
    if (reportIsHandSettled(report, hint)) return "";
    var ar = autoRejectionSummary(report, hint);
    if (ar.status !== "reject") return renderUnvettedGraphicNote(report);

    var html = '<div class="bookcheck-auto-reject">';
    html += '<p class="bookcheck-auto-reject-title"><strong>Automatic hard rejection</strong></p><ul>';
    html += "<li>Halalit’s firm rules—not softened; preview won’t turn this into a pass:</li>";
    for (var r = 0; r < ar.reasons.length && r < 6; r++) {
      html += "<li>" + escapeHtml(ar.reasons[r]) + "</li>";
    }
    html += "</ul></div>";
    return html + renderUnvettedGraphicNote(report);
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
    if (!Prefs || !report) return report;
    var r = report;
    if (r.parsedNote && r.parsedNote.bullets && r.parsedNote.bullets.length) {
      r = Object.assign({}, report);
      r.parsedNote = Object.assign({}, report.parsedNote);
      r.parsedNote.bullets = report.parsedNote.bullets.filter(function (b) {
        return !Prefs.shouldHideComfortText(b);
      });
    }
    if (report.dimensions && report.dimensions.length) {
      if (r === report) r = Object.assign({}, report);
      r.dimensions = report.dimensions.filter(function (d) {
        return !Prefs.shouldHideScanRow(d);
      });
    }
    if (report.external) {
      if (r === report) r = Object.assign({}, report);
      r.external = Object.assign({}, report.external);
      if (report.external.catalogHits && report.external.catalogHits.length) {
        r.external.catalogHits = report.external.catalogHits.filter(function (h) {
          return !Prefs.shouldHideThemeHit(h);
        });
      }
      if (report.external.wikipediaHits && report.external.wikipediaHits.length) {
        r.external.wikipediaHits = report.external.wikipediaHits.filter(function (h) {
          return !Prefs.shouldHideThemeHit(h);
        });
      }
      if (report.external.wikidataHits && report.external.wikidataHits.length) {
        r.external.wikidataHits = report.external.wikidataHits.filter(function (h) {
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
    var hint = { tier: report.hintTier || report.tier, detail: report.hintDetail || "" };

    html += renderAutoRejectionHtml(report, hint);

    if (report.summary) {
      html += '<p class="bookcheck-report-summary">' + escapeHtml(stripCjk(report.summary)) + "</p>";
    }

    if (report.familyAction) {
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
        if (crow && (crow.status === "concern" || crow.status === "caution")) concernRows.push(crow);
      }
    }

    html += '<div class="bookcheck-halalit-note">';
    html += '<p class="bookcheck-halalit-note-title">Plot &amp; themes</p><ul>';

    if (report.mode === "curated" && report.parsedNote && report.parsedNote.bullets.length) {
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

  function renderBookcheckReportHtml(report, opts) {
    if (!report) return "";
    opts = opts || {};
    if (opts.compact) return renderBookcheckReportHtmlCompact(report, opts);
    report = filterReportForPrefs(report);
    var html = "";

    if (report.bookLead) {
      html += '<p class="bookcheck-book-lead">' + escapeHtml(stripCjk(report.bookLead)) + "</p>";
    }

    if (report.familyAction) {
      html +=
        '<p class="bookcheck-action"><strong>What to do:</strong> ' + escapeHtml(report.familyAction) + "</p>";
    }

    html += renderAutoRejectionHtml(report, {
      tier: report.hintTier || report.tier,
      detail: report.hintDetail || "",
    });

    html += renderYouDecideLineHtml(report, {
      tier: report.hintTier || report.tier,
      detail: report.hintDetail || "",
    }, opts);

    if (report.summary) {
      html += '<p class="bookcheck-report-summary">' + escapeHtml(report.summary) + "</p>";
    }

    if (report.mode === "curated" && report.parsedNote && report.parsedNote.bullets.length) {
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

    if (report.dimensions && report.dimensions.length) {
      var scanTitle =
        report.mode === "curated" ? "Also from the catalog record" : "What we found for this book";
      html += '<div class="bookcheck-scan-wrap"><p class="bookcheck-scan-title">' + escapeHtml(scanTitle) + "</p>";
      html += '<ul class="bookcheck-scan">';
      for (var i = 0; i < report.dimensions.length; i++) {
        var d = report.dimensions[i];
        if (report.mode === "curated" && (d.id === "hand_check" || (d.id && String(d.id).indexOf("halalit_bullet_") === 0)))
          continue;
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

    if (report.descriptionExcerpt) {
      var desc = stripCjk(report.descriptionExcerpt);
      if (desc.length >= 24) {
        html +=
          '<blockquote class="bookcheck-catalog-desc"><strong>Publisher/catalog description for this edition:</strong> ' +
          escapeHtml(desc.length > 380 ? desc.slice(0, 377) + "…" : desc) +
          "</blockquote>";
      }
    }

    if (report.relevantSubjects && report.relevantSubjects.length) {
      html +=
        '<p class="bookcheck-subjects"><strong>Tags on this edition:</strong> ' +
        escapeHtml(report.relevantSubjects.join(" · ")) +
        "</p>";
    }

    if (report.gaps && report.gaps.length) {
      html += '<div class="bookcheck-gaps"><p class="bookcheck-gaps-title"><strong>For “' + escapeHtml(report.title) + "” specifically, catalogs miss</strong></p><ul>";
      for (var g = 0; g < report.gaps.length; g++) {
        html += "<li>" + escapeHtml(report.gaps[g]) + "</li>";
      }
      html += "</ul></div>";
    }

    html += renderExternalEvidenceHtml(report.external);

    html +=
      '<p class="bookcheck-sources muted">Sources: ' +
      escapeHtml(report.sourcesUsed) +
      (report.firstPublishYear ? " · first published " + report.firstPublishYear : "") +
      ". No Goodreads scraping.</p>";
    return html;
  }

  global.HalalitBookcheckReport = {
    build: buildBookcheckReport,
    youDecideLine: YOU_DECIDE_LINE,
    shouldShowYouDecideLine: shouldShowYouDecideLine,
    autoRejectionSummary: autoRejectionSummary,
    renderAutoRejectionHtml: renderAutoRejectionHtml,
    renderYouDecideLineHtml: renderYouDecideLineHtml,
    renderHtml: renderBookcheckReportHtml,
    renderHtmlCompact: renderBookcheckReportHtmlCompact,
  };
})(typeof window !== "undefined" ? window : this);
