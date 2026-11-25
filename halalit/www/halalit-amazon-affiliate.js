/**
 * Owner Amazon Associates links — only titles with an explicit short URL here.
 * The Associates sentence is shown on every Book Wander book, every hand-checked
 * Bookcheck result, and every Book Quest pick. New books on those lists get it
 * from the page, not from a per-title paste. Add a url only when the owner sends one.
 * Each outbound link also needs a visible "(paid link)" label (FTC + Associates).
 */
(function (global) {
  var SITE_STATEMENT = "As an Amazon Associate I earn from qualifying purchases.";

  var ENTRIES = [
    {
      titleRe: /\bhow to change everything\b/i,
      authorRe: /klein|naomi|stefoff/i,
      url: "https://amzn.to/4A1dUqn",
    },
    {
      titleRe: /\bguess how much i love you\b/i,
      url: "https://link.amazon/B079Ud3g6",
    },
    {
      titleRe: /\bare you my mother\b/i,
      authorRe: /eastman/i,
      url: "https://link.amazon/B0fn3GMDN",
    },
    {
      titleRe: /\bbartholomew and the oobleck\b/i,
      authorRe: /seuss|geisel/i,
      url: "https://link.amazon/B0bel79GH",
    },
    {
      titleRe: /\bberenstain bears and the messy room\b/i,
      authorRe: /berenstain/i,
      url: "https://link.amazon/B08HY4dAd",
    },
    {
      titleRe: /\bvery busy spider\b/i,
      authorRe: /carle|eric/i,
      url: "https://link.amazon/B0ijjS2jU",
    },
    {
      titleRe: /\bthe twits\b|\btwits\b/i,
      authorRe: /dahl|roald/i,
      url: "https://link.amazon/B0eMTQzdk",
    },
    {
      titleRe: /\bwhere the wild things are\b/i,
      authorRe: /sendak|maurice/i,
      url: "https://link.amazon/B0h43jxah",
    },
    {
      titleRe: /\bsneetches\b/i,
      authorRe: /seuss|geisel/i,
      url: "https://link.amazon/B0dt6sY5o",
    },
    {
      titleRe: /\brainbow fish\b(?!\s+(?:to|and)\b)/i,
      authorRe: /pfister|marcus/i,
      url: "https://link.amazon/B08Nem4RJ",
    },
    {
      titleRe: /\bmagic finger\b/i,
      authorRe: /dahl|roald/i,
      url: "https://link.amazon/B00uw9tHq",
    },
    {
      titleRe: /\bcat in the hat comes back\b/i,
      authorRe: /seuss|geisel/i,
      url: "https://link.amazon/B0eCAgRY1",
    },
    {
      titleRe: /\benormous crocodile\b/i,
      authorRe: /dahl|roald/i,
      url: "https://link.amazon/B0fMdGsCq",
    },
    {
      titleRe: /\bgiraffe(?: and)? the pelly and me\b/i,
      authorRe: /dahl|roald/i,
      url: "https://link.amazon/B0eJoYjHD",
    },
    {
      titleRe: /\blittle engine that could\b/i,
      authorRe: /piper|watty|munk/i,
      url: "https://link.amazon/B089e4tRM",
    },
    {
      titleRe: /\bthe lorax\b|\blorax\b/i,
      authorRe: /seuss|geisel/i,
      url: "https://link.amazon/B0izJjQoQ",
    },
  ];

  function linkForBook(title, author) {
    var tl = String(title || "").toLowerCase();
    var al = String(author || "").toLowerCase();
    if (!tl) return null;
    for (var i = 0; i < ENTRIES.length; i++) {
      var e = ENTRIES[i];
      if (!e.titleRe.test(tl)) continue;
      if (e.authorRe && al && !e.authorRe.test(al)) continue;
      return { url: e.url, label: "View on Amazon" };
    }
    return null;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Sentence on every book. Amazon button only when this title has an owner URL. */
  function blockHtml(title, author) {
    var hit = linkForBook(title, author);
    var linkRow = "";
    if (hit && hit.url) {
      var label = hit.label || "View on Amazon";
      linkRow =
        '<p class="halalit-affiliate__row">' +
        '<a class="halalit-affiliate__link" href="' +
        escapeHtml(hit.url) +
        '" target="_blank" rel="noopener noreferrer sponsored">' +
        escapeHtml(label) +
        "</a> " +
        '<span class="halalit-affiliate__tag">(paid link)</span>' +
        "</p>";
    }
    return (
      '<div class="halalit-affiliate">' +
      '<p class="halalit-affiliate__statement">' +
      escapeHtml(SITE_STATEMENT) +
      "</p>" +
      linkRow +
      "</div>"
    );
  }

  global.HalalitAmazonAffiliate = {
    SITE_STATEMENT: SITE_STATEMENT,
    linkForBook: linkForBook,
    blockHtml: blockHtml,
  };
})(typeof window !== "undefined" ? window : global);