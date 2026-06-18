/**
 * Halalit — family-shelf theme definitions for Bookcheck (catalog tags, plot text, Wikidata).
 * Aligns with Book Quest feedback flags and Bookcheck guidelines.
 */
(function (global) {
  /**
   * shelfTier: flag_review = off Halalit shelf; caution = preview/note; comfort = deity-style note
   * @type {Array<{id: string, label: string, shelfTier: string, subjectRe: RegExp, textRe: RegExp}>}
   */
  var THEMES = [
    {
      id: "lgbtq",
      label: "LGBTQ identity or advocacy",
      shelfTier: "flag_review",
      subjectRe:
        /\blgbt\b|lesbian|gay men|gay teen|gay\b|homosexual|queer fiction|gender identity|transgender|same[- ]sex|bisexual|nonbinary/i,
      textRe:
        /\blgbtq?\b|lesbian|gay\b|homosexual|queer\b|transgender|non[- ]?binary|they\/them|two[- ]moms?|two[- ]mothers?|two[- ]dads?|two[- ]fathers?|same[- ]sex marriage|gender[- ]fluid|bisexual|nonbinary/i,
    },
    {
      id: "adult_romance",
      label: "Adult romance as a major thread",
      shelfTier: "flag_review",
      subjectRe: /\badult romance\b|erotic romance|romantic love fiction/i,
      textRe: /adult romance|erotic romance|romance as the main|central romance/i,
    },
    {
      id: "sexual_content",
      label: "Sexual content or fanservice",
      shelfTier: "flag_review",
      subjectRe: /erotica|sexual content|pornograph/i,
      textRe:
        /\bfanservice\b|\bfan service\b|\becchi\b|panty shot|sexualized|sexualised|immodest|explicit sexual|pornograph/i,
    },
    {
      id: "romantic_tension",
      label: "Romantic tension or dating",
      shelfTier: "caution",
      subjectRe: /\bromance\b|romantic fiction|love stories|dating fiction|romantic relationships/i,
      textRe:
        /romantic tension|romantic subplot|love triangle|betrothed|betrothal|crush on|sexual tension|dating/i,
    },
    {
      id: "illegitimate_children",
      label: "Plot centered on illegitimate children",
      shelfTier: "flag_review",
      subjectRe: /illegitim|born out of wedlock|out[- ]of[- ]wedlock|bastardy|unwed mothers?|children of unmarried parents/i,
      textRe: /illegitim|born out of wedlock|out[- ]of[- ]wedlock|bastardy|unwed mother/i,
    },
    {
      id: "romanticized_crime",
      label: "Romanticized crime or cruelty",
      shelfTier: "flag_review",
      subjectRe: /true crime|vigilante/i,
      textRe: /vigilante|romanticized crime|anti[- ]?hero criminal|cool.*crime/i,
    },
    {
      id: "teen_ya_age",
      label: "Teen or young-adult audience",
      shelfTier: "caution",
      subjectRe: /teen fiction|young adult|ya fiction|adolescent/i,
      textRe: /\bteen fiction\b|\bteenage\b|\byoung adult\b|\bya fiction\b|\bya\b/i,
    },
    {
      id: "violence_intense",
      label: "Violence or horror intensity",
      shelfTier: "caution",
      subjectRe: /horror fiction|graphic violence|true crime|murder|serial killer/i,
      textRe: /graphic violence|\bgory\b|serial killer|torture|horror fiction|true crime|war crimes/i,
    },
    {
      id: "family_portrayed_negatively",
      label: "Family portrayed harshly",
      shelfTier: "caution",
      subjectRe: /family conflict|dysfunctional famil|abused children|neglected children/i,
      textRe: /neglect|abusive|cruel (?:mother|father|parent)|hostile (?:mother|father|parent)|family[- ]bashing/i,
    },
    {
      id: "cultural_stereotype",
      label: "Cultural stereotyping or shallow representation",
      shelfTier: "caution",
      subjectRe: /stereotyp|orientalist|cultural insensitiv|misrepresentation/i,
      textRe:
        /stereotyp|cultur(?:al)?(?:ly)? insensitive|shallow representation|false representation|caricatur|orientalist/i,
    },
    {
      id: "group_demonization",
      label: "Demonizes a whole group",
      shelfTier: "flag_review",
      subjectRe: /antisemit|anti[- ]muslim|xenophob|group demonization/i,
      textRe: /demoniz(?:e|es|ing) (?:an entire|all|every)|all (?:muslims|jews|christians|whites|blacks) are/i,
    },
    {
      id: "pro_colonial_narrative",
      label: "Pro-colonial narrative",
      shelfTier: "flag_review",
      subjectRe: /colonialism|imperialism|british empire/i,
      textRe: /pro[- ]colonial|white man'?s burden|civilizing mission|empire.*glorif/i,
    },
    {
      id: "crude_profanity",
      label: "Harsh swearing or slurs",
      shelfTier: "flag_review",
      subjectRe: /profan|vulgar|swear|obscene|offensive language|explicit language/i,
      textRe: /\bf+\W*u+\W*c+\W*k|\bbitch|\bsh+\W*i+\W*t|\bnigg|\bcunt\b|\basshole|\bgoddamn/i,
    },
    {
      id: "deity_mythology",
      label: "Deity or mythology treated as real",
      shelfTier: "comfort",
      subjectRe: /mythology|folklore|gods|goddesses|deities|demigod|olympian/i,
      textRe:
        /\bmythology\b|\bmythological\b|\b(?:gods|goddesses|deities)\b|\bdemigods?\b|\bpantheon\b|\bfolklore\b.*\b(?:fantasy|magic)/i,
    },
    {
      id: "graphic_format",
      label: "Comics, manga, or graphic novel",
      shelfTier: "flag_review",
      subjectRe: /comic books?|graphic novels?|manga|graphic fiction/i,
      textRe: /\bcomic books?\b|\bgraphic novels?\b|\bmanga\b/i,
    },
    {
      id: "substance",
      label: "Alcohol, smoking, or drugs",
      shelfTier: "caution",
      subjectRe: /alcohol|drug use|smoking|substance abuse/i,
      textRe: /\balcohol\b|\bwine\b|\bdrunk\b|\bsmok(?:e|ing)\b|\bmarijuana\b|\bweed\b|\bdrugs?\b/i,
    },
  ];

  function themeById(id) {
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].id === id) return THEMES[i];
    }
    return null;
  }

  function worstShelfTier(themeIds) {
    var rank = { comfort: 0, caution: 1, flag_review: 2 };
    var worst = "caution";
    var w = 0;
    for (var i = 0; i < themeIds.length; i++) {
      var t = themeById(themeIds[i]);
      if (!t) continue;
      var r = rank[t.shelfTier] != null ? rank[t.shelfTier] : 1;
      if (r > w) {
        w = r;
        worst = t.shelfTier;
      }
    }
    return worst;
  }

  /**
   * @param {string[]} subjects
   * @returns {Array<{id: string, label: string, shelfTier: string, tags: string[]}>}
   */
  function matchCatalogSubjects(subjects) {
    var out = [];
    if (!subjects || !subjects.length) return out;
    for (var t = 0; t < THEMES.length; t++) {
      var theme = THEMES[t];
      var tags = [];
      for (var i = 0; i < subjects.length; i++) {
        var s = String(subjects[i] || "").trim();
        if (s && theme.subjectRe.test(s) && tags.indexOf(s) === -1) tags.push(s);
      }
      if (tags.length) {
        out.push({ id: theme.id, label: theme.label, shelfTier: theme.shelfTier, tags: tags });
      }
    }
    return out;
  }

  /**
   * @param {string} text
   * @returns {Array<{id: string, label: string, shelfTier: string, snippet: string}>}
   */
  function matchTextEvidence(text) {
    var out = [];
    var blob = String(text || "");
    if (!blob.trim()) return out;
    var Policy = global.HalalitFamilyShelfPolicy;
    for (var t = 0; t < THEMES.length; t++) {
      var theme = THEMES[t];
      if (theme.id === "crude_profanity") {
        if (Policy && typeof Policy.textMentionsCrudeProfanity === "function" && Policy.textMentionsCrudeProfanity(blob)) {
          out.push({
            id: theme.id,
            label: theme.label,
            shelfTier: theme.shelfTier,
            snippet: snippetAround(blob, theme.textRe) || "harsh language",
          });
        }
        continue;
      }
      if (!theme.textRe.test(blob)) continue;
      var snippet = snippetAround(blob, theme.textRe);
      out.push({
        id: theme.id,
        label: theme.label,
        shelfTier: theme.shelfTier,
        snippet: snippet,
      });
    }
    return out;
  }

  function snippetAround(text, re) {
    var m = text.match(re);
    if (!m || !m[0]) return "";
    var idx = text.toLowerCase().indexOf(m[0].toLowerCase());
    if (idx < 0) return m[0];
    var start = Math.max(0, idx - 50);
    var end = Math.min(text.length, idx + m[0].length + 70);
    var bit = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (start > 0) bit = "…" + bit;
    if (end < text.length) bit = bit + "…";
    return bit;
  }

  global.HalalitShelfThemes = {
    THEMES: THEMES,
    themeById: themeById,
    worstShelfTier: worstShelfTier,
    matchCatalogSubjects: matchCatalogSubjects,
    matchTextEvidence: matchTextEvidence,
  };
})(typeof window !== "undefined" ? window : this);
