/**
 * Halalit — secondhand vetted (Bookcheck staging list only).
 * Owner hypotheses from catalog/reputation—not cover-to-cover hand reads.
 * Does NOT add VERIFIED_CLEAN or Book Quest picks. Sync from
 * halalit/.cursor/private/HALALIT-SECONDHAND-VETTED.md when entries change.
 */
(function (global) {
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  var ENTRIES = [
    {
      displayTitle: "Little Women",
      displayAuthor: "Louisa May Alcott",
      titleRe: /little women/i,
      authorRe: /louisa\s*may\s*alcott|alcott/i,
      ageBand: "TBD",
      detail:
        "Secondhand vetted—not hand-read cover-to-cover yet. Classic family drama; preview period attitudes and romance beats when you read. Watch follow-ups in the March line (*Good Wives* / combined editions).",
      watch: "Later March books; 19th-century faith/morality frame.",
    },
    {
      displayTitle: "A Series of Unfortunate Events",
      displayAuthor: "Lemony Snicket",
      titleRe: /series of unfortunate events|unfortunate events/i,
      authorRe: /lemony\s*snicket|handler|snicket/i,
      ageBand: "TBD",
      detail:
        "Secondhand vetted—staging note; Halalit may also show hand-checked notes in code for this line. Heavy death, tragedy, and scary tone; vet book 1 before assuming the rest.",
      watch: "Full series length; Kids vs older bands; later-volume surprises.",
    },
    {
      displayTitle: "A Wrinkle in Time",
      displayAuthor: "Madeleine L'Engle",
      titleRe: /wrinkle in time/i,
      authorRe: /l.?engle|madeleine/i,
      ageBand: "TBD",
      detail:
        "Secondhand vetted—not fully hand-read for the whole Time Quintet. Preview deity/magic comfort themes; do not treat books 3+ as vetted until you read them.",
      watch: "*A Wind in the Door* and later volumes; spiritual undertones; edition differences.",
    },
    {
      displayTitle: "Wonder",
      displayAuthor: "R. J. Palacio",
      titleRe: /\bwonder\b/i,
      authorRe: /palacio|r\.?\s*j\.?\s*palacio/i,
      ageBand: "TBD",
      detail:
        "Secondhand vetted—not hand-read cover-to-cover yet. Likely middle-grade fit on core Halalit rules; verify bullying tone, sequels, and age band when you read.",
      watch: "Sequels and companion titles; intensity for youngest readers.",
    },
    {
      displayTitle: "As Long as the Lemon Trees Bloom",
      displayAuthor: "Zoulfa Katouh",
      titleRe: /lemon trees bloom|lemon trees grow/i,
      authorRe: /katouh|zoulfa/i,
      ageBand: "Adults",
      detail:
        "Secondhand vetted—not hand-read yet. War/Syria setting—likely content-clean on Halalit romance/LGBTQ rules but heavy trauma and loss; Adults band for interest and intensity.",
      watch: "Confirm title/edition; full read before any verified-clean promotion.",
    },
    {
      displayTitle: "Jane Eyre",
      displayAuthor: "Charlotte Brontë",
      titleRe: /jane eyre/i,
      authorRe: /charlotte\s*bront|bronte/i,
      ageBand: "Adults",
      detail:
        "Secondhand vetted—not hand-read cover-to-cover yet. Not on verified-clean or Book Quest. Preview Gothic intensity, Rochester romance arc, and period morality.",
      watch: "Attic wife portrayal; power imbalance; not for young-child readers.",
    },
    {
      displayTitle: "Jane Austen novels",
      displayAuthor: "Jane Austen",
      authorLine: true,
      titleRe: null,
      authorRe: /\bausten\b/i,
      ageBand: "TBD per title",
      detail:
        "Secondhand vetted—author line only; vet each novel separately (*Pride and Prejudice*, *Emma*, etc.). Regency courtship and class; not a whole-author verified-clean call.",
      watch: "*Northanger Abbey* Gothic parody; elopement beats; abridgments don’t count as hand-vet.",
    },
  ];

  function matchEntry(title, author) {
    var tl = norm(title);
    var al = norm(author);
    for (var i = 0; i < ENTRIES.length; i++) {
      var e = ENTRIES[i];
      if (e.authorLine) {
        if (!al || !e.authorRe.test(al)) continue;
        return e;
      }
      if (!e.titleRe || !tl || !e.titleRe.test(title)) continue;
      if (e.authorRe && al && !e.authorRe.test(author)) continue;
      return e;
    }
    return null;
  }

  function formatDetail(entry) {
    if (!entry) return "";
    var parts = [entry.detail];
    if (entry.watch) parts.push("Watch: " + entry.watch);
    if (entry.ageBand) parts.push("Age sort (owner): " + entry.ageBand);
    parts.push("Not hand-verified—Halalit won’t Book Quest this from secondhand alone.");
    return parts.join("\n");
  }

  function match(title, author) {
    var entry = matchEntry(title, author);
    if (!entry) return null;
    return {
      tier: "secondhand_vetted",
      displayTitle: entry.displayTitle,
      displayAuthor: entry.displayAuthor,
      detail: formatDetail(entry),
      watch: entry.watch || "",
      ageBand: entry.ageBand || "",
      authorLine: !!entry.authorLine,
    };
  }

  function listForBookcheck() {
    var out = [];
    for (var i = 0; i < ENTRIES.length; i++) {
      out.push({
        title: ENTRIES[i].displayTitle,
        author: ENTRIES[i].displayAuthor,
        authorLine: !!ENTRIES[i].authorLine,
      });
    }
    return out;
  }

  global.HalalitSecondhandVetted = {
    match: match,
    listForBookcheck: listForBookcheck,
    entries: ENTRIES,
  };
})(typeof window !== "undefined" ? window : this);
