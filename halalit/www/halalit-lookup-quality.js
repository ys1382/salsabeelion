/**
 * Halalit — detect garbled scroll-scanner / OCR title+author reads.
 */
(function (global) {
  var PAREN_FRAGMENT_RE = /(?:^\s*[A-Za-z]\)|\(\s*[A-Za-z]\s*\)|\)\s*[a-z]{1,3}\s*$)/;

  function coreWord(w) {
    return String(w || "").replace(/[^A-Za-z'.-]/g, "");
  }

  function lineGarbage(line, kind) {
    line = String(line || "").trim();
    if (!line) return false;
    if (PAREN_FRAGMENT_RE.test(line)) return true;
    var letters = line.replace(/[^A-Za-z]/g, "");
    if (letters.length < 3) return true;
    if (letters.length / Math.max(line.length, 1) < 0.55) return true;
    var words = line.split(/\s+/).filter(Boolean);
    if (!words.length) return true;

    var realWords = 0;
    var longWords = 0;
    for (var i = 0; i < words.length; i++) {
      var core = coreWord(words[i]);
      if (core.length >= 2 && /[aeiouAEIOU]/.test(core)) realWords++;
      if (core.length >= 4 && /[aeiouAEIOU]/.test(core)) longWords++;
    }
    if (!realWords) return true;

    var cores = [];
    for (var j = 0; j < words.length; j++) {
      var c = coreWord(words[j]);
      if (c) cores.push(c);
    }
    if (cores.length && cores.every(function (c) {
      return c.length <= 3;
    })) {
      return true;
    }

    if (kind === "title") {
      if (longWords === 0 && words.join(" ").length < 14) return true;
    }
    if (kind === "author") {
      if (longWords === 0 && words.length <= 2 && letters.length < 8) return true;
    }
    return false;
  }

  function isGarbage(title, author) {
    title = String(title || "").trim();
    author = String(author || "").trim();
    if (!title) return true;
    if (lineGarbage(title, "title")) return true;
    if (author && lineGarbage(author, "author")) return true;
    return false;
  }

  function reportMalfunction(title, author, phase) {
    var base =
      global.HalalitAccountStorage && global.HalalitAccountStorage.apiBase
        ? global.HalalitAccountStorage.apiBase()
        : global.HalalitBookcheckConfig && global.HalalitBookcheckConfig.apiBase
          ? global.HalalitBookcheckConfig.apiBase()
          : "";
    if (!base || !global.fetch) return;
    var key = "halalitScannerAlert:" + phase + ":" + title + "|" + author;
    try {
      if (global.sessionStorage && global.sessionStorage.getItem(key)) return;
      if (global.sessionStorage) global.sessionStorage.setItem(key, "1");
    } catch (e) {}
    global.fetch(base + "/scanner/malfunction-report", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title,
        author: author || "",
        phase: phase || "cover_read",
      }),
    }).catch(function () {});
  }

  global.HalalitLookupQuality = {
    isGarbage: isGarbage,
    reportMalfunction: reportMalfunction,
  };
})(typeof window !== "undefined" ? window : this);
