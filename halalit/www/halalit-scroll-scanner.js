/**
 * Halalit Scroll Scanner — cover vision + barcode + lettering fallback → Bookcheck.
 */
(function (global) {
  var VISION_INTERVAL_MS = 2600;
  var OCR_INTERVAL_MS = 3200;
  var MAX_EDGE = 960;
  var BARCODE_MAX_EDGE = 1280;
  var BARCODE_POLYFILL_ESM =
    "https://cdn.jsdelivr.net/npm/@undecaf/barcode-detector-polyfill@0.9.21/+esm";
  var FRAME_INSET_X = 0.08;
  var FRAME_INSET_Y = 0.1;
  var TESSERACT_SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  var ISBN_LOOKUP_TIMEOUT_MS = 9000;

  var SCANNER_LEGACY_IDS = {
    video: "scrollScannerVideo",
    canvas: "scrollScannerCanvas",
    ocrCanvas: "scrollScannerOcrCanvas",
    status: "scrollScannerStatus",
    result: "scrollScannerResult",
    altList: "scrollScannerAltList",
    confirm: "scrollScannerConfirm",
    rescan: "scrollScannerRescan",
    start: "scrollScannerStart",
    permissionNote: "scrollScannerPermissionNote",
    live: "scrollScannerLive",
    liveHint: "scrollScannerLiveHint",
    liveTitle: "scrollScannerLiveTitle",
    liveAuthor: "scrollScannerLiveAuthor",
    titleEdit: "scrollScannerTitleEdit",
    authorEdit: "scrollScannerAuthorEdit",
    catalog: "scrollScannerCatalog",
    catalogList: "scrollScannerCatalogList",
    cameraWrap: "scrollScannerCameraWrap",
    modeCover: "scrollScannerModeCover",
    modeBarcode: "scrollScannerModeBarcode",
    torch: "scrollScannerTorch",
  };

  var scannerControllers = {};

  function scannerQuery(panel, key) {
    if (!panel) return null;
    var el = panel.querySelector('[data-scanner="' + key + '"]');
    if (el) return el;
    var id = SCANNER_LEGACY_IDS[key];
    return id ? panel.querySelector("#" + id) : null;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function cleanLine(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .replace(/[|_`~\\]/g, "")
      .replace(/\s+([,.;:])/g, "$1")
      .trim();
  }

  function normKey(title, author) {
    return (
      String(title || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim() +
      "|" +
      String(author || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
    );
  }

  function looksLikeNoise(line) {
    if (!line || line.length < 3) return true;
    if (/^\d[\d\s\-]*$/.test(line)) return true;
    if (/^isbn\b/i.test(line)) return true;
    if (/^www\./i.test(line)) return true;
    if (/^[A-Za-z]\s+[A-Za-z]\s+[A-Za-z]$/.test(line)) return true;
    if ((line.match(/[A-Za-z]/g) || []).length < 3) return true;
    return false;
  }

  function isPlausibleBookLine(line, kind) {
    if (!line || line.length < 4 || line.length > 90) return false;
    if (looksLikeNoise(line)) return false;
    if (/[{}[\]/@#$%^*+=<>]/.test(line)) return false;
    var letters = line.match(/[A-Za-z]/g);
    if (!letters || letters.length < 4) return false;
    if (letters.length / line.length < 0.62) return false;
    var words = line.split(/\s+/).filter(Boolean);
    if (!words.length) return false;
    var realWords = 0;
    for (var i = 0; i < words.length; i++) {
      var core = words[i].replace(/[^A-Za-z'.-]/g, "");
      if (core.length >= 2 && /[aeiouAEIOU]/.test(core)) realWords++;
    }
    if (!realWords) return false;
    if (kind === "author") return words.length >= 2 || /^[A-Z][a-z]+/.test(words[0]);
    return words.join(" ").length >= 4;
  }

  var PROMO_CREDIT_RE =
    /\b(?:new\s+)?(?:introduction|intro|foreword|preface|afterword|with\s+an\s+introduction)\s+by\b/i;

  function isPromoCreditLine(line) {
    return PROMO_CREDIT_RE.test(line);
  }

  function looksLikePersonName(line) {
    var words = String(line || "")
      .split(/\s+/)
      .filter(Boolean);
    if (words.length < 2 || words.length > 5) return false;
    if (/\b(the|a|an)\s+/i.test(line)) return false;
    var caps = 0;
    for (var i = 0; i < words.length; i++) {
      if (/^[A-Z][a-z]{2,}/.test(words[i]) || /^[A-Z]\.?$/.test(words[i])) caps++;
    }
    return caps >= 2;
  }

  function maybeSwapTitleAuthor(title, author) {
    var t = String(title || "").trim();
    var a = String(author || "").trim();
    if (!t || !a) return { title: t, author: a };
    var tName = looksLikePersonName(t);
    var aName = looksLikePersonName(a);
    var tScore = titleCandidateScore(t);
    var aScore = titleCandidateScore(a);
    if (tName && !aName && aScore > 0 && (!isAcceptableTitle(t) || aScore >= tScore)) {
      return { title: a, author: t };
    }
    if (!isAcceptableTitle(t) && isAcceptableTitle(a)) {
      return { title: a, author: t };
    }
    return { title: t, author: a };
  }

  function isAcceptableTitle(title) {
    if (!title || !isPlausibleBookLine(title, "title")) return false;
    if (looksLikePersonName(title)) return false;
    return titleCandidateScore(title) > 0;
  }

  function lettersOnlyTitle(title) {
    return String(title || "")
      .replace(/[^A-Za-z]/g, "")
      .trim();
  }

  function looseCatalogTitle(title) {
    var chunks = String(title || "").match(/[A-Za-z]{3,}/g);
    return chunks ? chunks.join(" ") : "";
  }

  function wordCenterY(word) {
    return (word.bbox.y0 + word.bbox.y1) / 2;
  }

  function groupWordsIntoLines(words, mergePx) {
    if (!words.length) return [];
    var sorted = words.slice().sort(function (a, b) {
      if (Math.abs(a.bbox.y0 - b.bbox.y0) > 8) return a.bbox.y0 - b.bbox.y0;
      return a.bbox.x0 - b.bbox.x0;
    });
    var lineGroups = [];
    var current = [];
    var lineY = null;
    for (var i = 0; i < sorted.length; i++) {
      var w = sorted[i];
      var y = w.bbox.y0;
      if (lineY === null || Math.abs(y - lineY) <= mergePx) {
        current.push(w);
        if (lineY === null) lineY = y;
      } else {
        lineGroups.push(current);
        current = [w];
        lineY = y;
      }
    }
    if (current.length) lineGroups.push(current);
    var out = [];
    for (var g = 0; g < lineGroups.length; g++) {
      lineGroups[g].sort(function (a, b) {
        return a.bbox.x0 - b.bbox.x0;
      });
      var text = cleanLine(
        lineGroups[g]
          .map(function (w) {
            return w.text;
          })
          .join(" ")
      );
      if (text) out.push(text);
    }
    return out;
  }

  function stripPromoFromLine(line) {
    var cleaned = cleanLine(line);
    if (!cleaned) return "";
    var promoAt = cleaned.search(PROMO_CREDIT_RE);
    if (promoAt > 6) return cleanLine(cleaned.slice(0, promoAt));
    if (isPromoCreditLine(cleaned)) return "";
    return cleaned;
  }

  function expandLineCandidates(rawLine) {
    var out = [];
    var seen = {};
    function push(line) {
      var c = cleanLine(line);
      if (!c || seen[c]) return;
      seen[c] = true;
      out.push(c);
    }
    push(rawLine);
    push(stripPromoFromLine(rawLine));
    var pieces = cleanLine(rawLine).split(/\s+(?:introduction|intro|foreword|preface|afterword)\s+by\s+/i);
    if (pieces.length > 1) push(pieces[0]);
    return out;
  }

  function titleCandidateScore(line) {
    if (!isPlausibleBookLine(line, "title")) return -1;
    if (isPromoCreditLine(line)) return -1;
    if (looksLikePersonName(line) && !/\bthe\b/i.test(line)) return -1;
    var score = line.length;
    if (/\bthe\s+[a-z]/i.test(line)) score += 18;
    if (/\b(a|an)\s+[a-z]/i.test(line)) score += 8;
    if (!/\s/.test(line) && line.length >= 7) score += 14;
    if (/\bby\b/i.test(line)) score -= 20;
    if (/\b(edition|anniversary|classic|bestseller|winner)\b/i.test(line)) score -= 6;
    return score;
  }

  function authorCandidateScore(line, title) {
    if (!line || line === title) return -1;
    if (isPromoCreditLine(line)) return -1;
    if (!isPlausibleBookLine(line, "author") && !looksLikePersonName(line)) return -1;
    var score = line.length;
    if (looksLikePersonName(line)) score += 16;
    if (/\bthe\b/i.test(line)) score -= 12;
    if (PROMO_CREDIT_RE.test(line)) score -= 30;
    return score;
  }

  function parseCoverText(raw) {
    var rawLines = String(raw || "").split(/\n/);
    var titleCandidates = [];
    var authorCandidates = [];
    var seenTitle = {};

    for (var i = 0; i < rawLines.length; i++) {
      var rawLine = cleanLine(rawLines[i]);
      if (!rawLine) continue;

      if (isPromoCreditLine(rawLine)) continue;

      var byOnly = rawLine.match(/^(?:by|BY)\s+(.+)$/);
      if (byOnly) {
        var byName = cleanLine(byOnly[1]);
        if (!isPromoCreditLine(byName) && authorCandidateScore(byName, "") > 0) {
          authorCandidates.push(byName);
        }
        continue;
      }

      var expanded = expandLineCandidates(rawLine);
      for (var e = 0; e < expanded.length; e++) {
        var piece = expanded[e];
        if (!piece || isPromoCreditLine(piece)) continue;
        var tScore = titleCandidateScore(piece);
        if (tScore > 0 && !seenTitle[piece]) {
          seenTitle[piece] = true;
          titleCandidates.push({ line: piece, score: tScore });
        }
        var aScore = authorCandidateScore(piece, "");
        if (aScore > 0) authorCandidates.push(piece);
      }
    }

    titleCandidates.sort(function (a, b) {
      return b.score - a.score;
    });

    var title = titleCandidates.length ? titleCandidates[0].line : "";
    var author = "";
    var bestAuthorScore = -1;
    for (var a = 0; a < authorCandidates.length; a++) {
      var cand = authorCandidates[a];
      var ascore = authorCandidateScore(cand, title);
      if (ascore > bestAuthorScore) {
        bestAuthorScore = ascore;
        author = cand;
      }
    }

    var alternatives = [];
    for (var k = 0; k < titleCandidates.length; k++) {
      var altTitle = titleCandidates[k].line;
      if (altTitle === title) continue;
      if (titleCandidateScore(altTitle) < 0) continue;
      alternatives.push({ title: altTitle, author: author });
      if (alternatives.length >= 2) break;
    }

    var confidence = "none";
    if (title && author) confidence = "high";
    else if (title) confidence = "medium";

    var bestEffortTitle = title;
    if (!bestEffortTitle && titleCandidates.length) bestEffortTitle = titleCandidates[0].line;
    if (!bestEffortTitle && rawLines.length) {
      for (var r = 0; r < rawLines.length; r++) {
        var rawTry = stripPromoFromLine(cleanLine(rawLines[r]));
        if (rawTry && !isPromoCreditLine(rawTry) && lettersOnlyTitle(rawTry).length >= 5) {
          bestEffortTitle = rawTry;
          break;
        }
      }
    }

    return {
      title: title,
      author: author,
      bestEffortTitle: bestEffortTitle,
      confidence: confidence,
      alternatives: alternatives,
      brief: title ? "Read from cover lettering on your device." : "",
    };
  }

  function collectTitleCandidates(raw) {
    var titleCandidates = [];
    var seenTitle = {};
    var rawLines = String(raw || "").split(/\n/);
    for (var i = 0; i < rawLines.length; i++) {
      var rawLine = cleanLine(rawLines[i]);
      if (!rawLine || isPromoCreditLine(rawLine)) continue;
      var expanded = expandLineCandidates(rawLine);
      for (var e = 0; e < expanded.length; e++) {
        var piece = expanded[e];
        if (!piece || isPromoCreditLine(piece)) continue;
        if (looksLikePersonName(piece)) continue;
        var tScore = titleCandidateScore(piece);
        if (tScore > 0 && !seenTitle[piece]) {
          seenTitle[piece] = true;
          titleCandidates.push({ line: piece, score: tScore });
        }
      }
    }
    titleCandidates.sort(function (a, b) {
      return b.score - a.score;
    });
    return titleCandidates;
  }

  function pickAuthorFromText(raw, title) {
    var best = "";
    var bestScore = -1;
    var rawLines = String(raw || "").split(/\n/);
    for (var i = 0; i < rawLines.length; i++) {
      var line = cleanLine(rawLines[i]);
      if (!line || isPromoCreditLine(line)) continue;
      var byOnly = line.match(/^(?:by|BY)\s+(.+)$/);
      if (byOnly) line = cleanLine(byOnly[1]);
      var score = authorCandidateScore(line, title);
      if (score > bestScore) {
        bestScore = score;
        best = line;
      }
    }
    return best;
  }

  function parseSpatialOcrResult(result, cropHeight) {
    var words = (result && result.data && result.data.words) || [];
    if (!words.length) return null;

    var titleWords = [];
    var authorWords = [];
    var splitY = cropHeight * 0.56;
    var mergePx = Math.max(10, Math.round(cropHeight * 0.05));

    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (!w.text || String(w.text).trim().length < 1) continue;
      if (typeof w.confidence === "number" && w.confidence > 0 && w.confidence < 10) continue;
      if (wordCenterY(w) < splitY) titleWords.push(w);
      else authorWords.push(w);
    }

    var titleLines = groupWordsIntoLines(titleWords, mergePx);
    var authorLines = groupWordsIntoLines(authorWords, mergePx);
    var titleCandidates = collectTitleCandidates(titleLines.join("\n"));
    var title = titleCandidates.length ? titleCandidates[0].line : "";
    var author = pickAuthorFromText(authorLines.join("\n"), title);

    var alternatives = [];
    for (var k = 1; k < titleCandidates.length; k++) {
      alternatives.push({ title: titleCandidates[k].line, author: author });
      if (alternatives.length >= 2) break;
    }

    var confidence = author ? "high" : "medium";
    var bestEffortTitle = title;
    if (!bestEffortTitle && titleLines.length) {
      for (var tl = 0; tl < titleLines.length; tl++) {
        var tryLine = stripPromoFromLine(titleLines[tl]);
        if (tryLine && lettersOnlyTitle(tryLine).length >= 5) {
          bestEffortTitle = tryLine;
          break;
        }
      }
    }

    if (!title && !bestEffortTitle && !author) return null;

    return {
      title: title,
      author: author,
      bestEffortTitle: bestEffortTitle,
      confidence: confidence,
      alternatives: alternatives,
      brief: "Read from cover lettering on your device.",
    };
  }

  function fieldGuessFromParsed(parsed) {
    if (!parsed) return null;
    if (parsed.title && isAcceptableTitle(parsed.title)) {
      return { title: parsed.title, author: parsed.author || "", strong: true };
    }
    if (parsed.bestEffortTitle && lettersOnlyTitle(parsed.bestEffortTitle).length >= 4) {
      return { title: parsed.bestEffortTitle, author: parsed.author || "", strong: false };
    }
    if (parsed.author && looksLikePersonName(parsed.author)) {
      return {
        title: parsed.bestEffortTitle || parsed.title || "",
        author: parsed.author,
        strong: false,
        authorOnly: true,
      };
    }
    return null;
  }

  function enrichParsedFromRawText(parsed, rawText) {
    parsed = parsed || {};
    if (fieldGuessFromParsed(parsed)) return parsed;
    var fallback = parseCoverText(rawText || "");
    if (!parsed.title && fallback.title) parsed.title = fallback.title;
    if (!parsed.author && fallback.author) parsed.author = fallback.author;
    if (!parsed.bestEffortTitle && fallback.bestEffortTitle) parsed.bestEffortTitle = fallback.bestEffortTitle;
    if (!parsed.alternatives && fallback.alternatives) parsed.alternatives = fallback.alternatives;
    return parsed;
  }

  function catalogNorm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function catalogTitleScore(queryTitle, candidateTitle) {
    var q = catalogNorm(queryTitle);
    var c = catalogNorm(candidateTitle);
    if (!q || !c) return 0;
    if (c === q) return 100;
    if (c.indexOf(q) !== -1 || q.indexOf(c) !== -1) return 84;
    var qw = q.split(" ").filter(Boolean);
    var cw = {};
    var ct = c.split(" ").filter(Boolean);
    for (var i = 0; i < ct.length; i++) cw[ct[i]] = true;
    var hit = 0;
    for (var j = 0; j < qw.length; j++) if (cw[qw[j]]) hit++;
    if (!qw.length) return 0;
    return (hit / qw.length) * 72;
  }

  function catalogAuthorScore(queryAuthor, doc) {
    var q = catalogNorm(queryAuthor);
    if (!q) return 0;
    var names = doc && doc.author_name;
    if (!names || !names.length) return 0;
    var best = 0;
    for (var i = 0; i < names.length; i++) {
      var a = catalogNorm(names[i]);
      if (!a) continue;
      if (a === q) best = Math.max(best, 100);
      else if (a.indexOf(q) !== -1 || q.indexOf(a) !== -1) best = Math.max(best, 86);
    }
    return best;
  }

  function catalogDocTitle(doc) {
    var t = doc && doc.title;
    if (Array.isArray(t)) return String(t[0] || "").trim();
    return String(t || "").trim();
  }

  function catalogDocAuthor(doc) {
    var names = doc && doc.author_name;
    return names && names.length ? String(names[0] || "").trim() : "";
  }

  function buildCatalogSearchUrl(title, author) {
    var params = new URLSearchParams();
    params.set("limit", "10");
    params.set("fields", "key,title,author_name,first_publish_year");
    var t = String(title || "").trim();
    var a = String(author || "").trim();
    if (t) params.set("title", t);
    if (a) params.set("author", a);
    if (!t && !a) return "";
    return "https://openlibrary.org/search.json?" + params.toString();
  }

  function buildCatalogFallbackUrl(title, author) {
    var params = new URLSearchParams();
    params.set("limit", "12");
    params.set("fields", "key,title,author_name,first_publish_year");
    var t = looseCatalogTitle(title) || String(title || "").trim();
    var a = String(author || "").trim();
    var q = [t, a].filter(Boolean).join(" ").trim();
    if (!q) return "";
    params.set("q", q);
    return "https://openlibrary.org/search.json?" + params.toString();
  }

  function buildCatalogAuthorUrl(author) {
    var params = new URLSearchParams();
    params.set("limit", "12");
    params.set("fields", "key,title,author_name,first_publish_year");
    var a = String(author || "").trim();
    if (!a) return "";
    params.set("author", a);
    return "https://openlibrary.org/search.json?" + params.toString();
  }

  function fetchCatalogDocs(url) {
    if (!url || !global.fetch) return Promise.resolve([]);
    return global
      .fetch(url)
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        return (data && data.docs) || [];
      })
      .catch(function () {
        return [];
      });
  }

  function rankCatalogDocs(docs, queryTitle, queryAuthor) {
    var rows = [];
    var qTitle = catalogNorm(queryTitle);
    var authorLed = qTitle.length < 3 && catalogNorm(queryAuthor).length >= 3;
    for (var i = 0; i < (docs || []).length; i++) {
      var doc = docs[i];
      var ttl = catalogDocTitle(doc);
      if (!ttl) continue;
      var author = catalogDocAuthor(doc);
      var score;
      if (authorLed) {
        score = catalogAuthorScore(queryAuthor, doc);
        if (score < 50) continue;
        score += Math.min(catalogTitleScore(queryTitle, ttl), 40) * 0.25;
      } else {
        score = catalogTitleScore(queryTitle, ttl) + catalogAuthorScore(queryAuthor, doc) * 0.35;
        if (score < 26) continue;
      }
      rows.push({ title: ttl, author: author, score: score });
    }
    rows.sort(function (a, b) {
      return b.score - a.score;
    });
    var out = [];
    var seen = {};
    for (var k = 0; k < rows.length; k++) {
      var key = catalogNorm(rows[k].title) + "|" + catalogNorm(rows[k].author);
      if (seen[key]) continue;
      seen[key] = true;
      out.push(rows[k]);
      if (out.length >= 4) break;
    }
    return out;
  }

  function normalizeBarcodeIsbn(raw) {
    var digits = String(raw || "").replace(/[^0-9Xx]/g, "");
    if (digits.length === 13 && (digits.indexOf("978") === 0 || digits.indexOf("979") === 0)) return digits;
    if (digits.length === 10) return digits;
    if (digits.length > 13) return digits.slice(0, 13);
    return digits.length >= 10 ? digits : "";
  }

  function fetchJsonWithTimeout(url, ms) {
    if (!global.fetch || !url) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var settled = false;
      var timer = global.setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve(null);
      }, ms || ISBN_LOOKUP_TIMEOUT_MS);
      global
        .fetch(url)
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (settled) return;
          settled = true;
          global.clearTimeout(timer);
          resolve(data);
        })
        .catch(function () {
          if (settled) return;
          settled = true;
          global.clearTimeout(timer);
          resolve(null);
        });
    });
  }

  function lookupIsbn(isbn) {
    if (!isbn) return Promise.resolve(null);
    var url =
      "https://openlibrary.org/search.json?limit=1&fields=title,author_name&isbn=" +
      encodeURIComponent(isbn);
    return fetchJsonWithTimeout(url, ISBN_LOOKUP_TIMEOUT_MS).then(function (data) {
      var doc = data && data.docs && data.docs[0];
      if (!doc) return null;
      var match = { title: catalogDocTitle(doc), author: catalogDocAuthor(doc) };
      var VS = global.HalalitBookcheckVetSource;
      if (VS && typeof VS.canonicalBarcodeBook === "function") {
        match = VS.canonicalBarcodeBook(match.title, match.author);
      }
      return match && match.title ? match : null;
    });
  }

  function canvasToJpegPayload(canvas) {
    if (!canvas) return null;
    try {
      var dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      var m = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return null;
      return { mimeType: m[1], imageBase64: m[2] };
    } catch (e1) {
      return null;
    }
  }

  function loadTesseract() {
    if (global.Tesseract) return Promise.resolve(global.Tesseract);
    return new Promise(function (resolve, reject) {
      var existing = global.document && global.document.getElementById("halalitTesseractScript");
      if (existing) {
        existing.addEventListener("load", function () {
          resolve(global.Tesseract);
        });
        existing.addEventListener("error", reject);
        return;
      }
      var script = global.document.createElement("script");
      script.id = "halalitTesseractScript";
      script.src = TESSERACT_SRC;
      script.async = true;
      script.onload = function () {
        resolve(global.Tesseract);
      };
      script.onerror = function () {
        reject(new Error("tesseract_load_failed"));
      };
      global.document.head.appendChild(script);
    });
  }

  function init(panel, opts) {
    opts = opts || {};
    if (!panel || panel.getAttribute("data-scroll-scanner-wired") === "1") return;
    panel.setAttribute("data-scroll-scanner-wired", "1");

    var ownerTesting = !!opts.ownerTesting;
    var bookcheckPanelId = opts.bookcheckPanelId || "ownerTestBookcheckPanel";
    var coverPreview = opts.coverPreview || null;

    var video = scannerQuery(panel, "video");
    var canvas = scannerQuery(panel, "canvas");
    var ocrCanvas = scannerQuery(panel, "ocrCanvas");
    var statusEl = scannerQuery(panel, "status");
    var resultEl = scannerQuery(panel, "result");
    var altList = scannerQuery(panel, "altList");
    var confirmBtn = scannerQuery(panel, "confirm");
    var rescanBtn = scannerQuery(panel, "rescan");
    var startBtn = scannerQuery(panel, "start");
    var permissionNote = scannerQuery(panel, "permissionNote");
    var liveOverlay = scannerQuery(panel, "live");
    var liveHint = scannerQuery(panel, "liveHint");
    var liveTitle = scannerQuery(panel, "liveTitle");
    var liveAuthor = scannerQuery(panel, "liveAuthor");
    var titleEdit = scannerQuery(panel, "titleEdit");
    var authorEdit = scannerQuery(panel, "authorEdit");
    var catalogWrap = scannerQuery(panel, "catalog");
    var catalogList = scannerQuery(panel, "catalogList");
    var cameraWrap = scannerQuery(panel, "cameraWrap");
    var modeCoverBtn = scannerQuery(panel, "modeCover");
    var modeBarcodeBtn = scannerQuery(panel, "modeBarcode");
    var torchBtn = scannerQuery(panel, "torch");

    if (confirmBtn && ownerTesting) {
      confirmBtn.textContent = "Run test Bookcheck";
    }

    var stream = null;
    var scanTimer = null;
    var ocrBusy = false;
    var visionBusy = false;
    var paused = false;
    var tabActive = !!ownerTesting;
    var currentPick = null;
    var ocrWorker = null;
    var stableKey = "";
    var stableCount = 0;
    var authorStableKey = "";
    var authorStableCount = 0;
    var authorLocked = false;
    var scanMode = "cover";
    var catalogTimer = null;
    var catalogFetchId = 0;
    var ocrFailCount = 0;
    var ocrPassCount = 0;
    var visionFailStreak = 0;
    var visionUnavailable = false;
    var lastVisionAt = 0;
    var lastOcrAt = 0;
    var barcodeBusy = false;
    var barcodeLookupGen = 0;
    var barcodeDetectorPromise = null;
    var barcodePolyfillActive = false;
    var torchOn = false;
    var torchAvailable = false;
    var previewCropCanvas = null;
    var previewFrameCanvas = null;
    var lastCoverPreviewAt = 0;
    var coverPreviewTimer = null;
    var COVER_PREVIEW_MS = 450;

    function startOwnerCoverPreviewLoop() {
      if (!ownerTesting || coverPreviewTimer) return;
      if (coverPreview && typeof coverPreview.setStatus === "function") {
        coverPreview.setStatus("Camera on — live cover preview updating…");
      }
      coverPreviewTimer = global.setInterval(function () {
        if (!stream || scanMode !== "cover") return;
        pushOwnerCoverPreview();
      }, COVER_PREVIEW_MS);
    }

    function stopOwnerCoverPreviewLoop() {
      if (coverPreviewTimer) {
        global.clearInterval(coverPreviewTimer);
        coverPreviewTimer = null;
      }
    }

    function captureCoverArtForPreview() {
      if (!video || !video.videoWidth) return null;
      if (!previewFrameCanvas && global.document) {
        previewFrameCanvas = global.document.createElement("canvas");
      }
      if (!previewCropCanvas && global.document) {
        previewCropCanvas = global.document.createElement("canvas");
      }
      if (!previewFrameCanvas || !previewCropCanvas) return null;
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      var scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
      var w = Math.max(1, Math.round(vw * scale));
      var h = Math.max(1, Math.round(vh * scale));
      previewFrameCanvas.width = w;
      previewFrameCanvas.height = h;
      var ctx = previewFrameCanvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);
      var x = Math.round(w * FRAME_INSET_X);
      var y = Math.round(h * FRAME_INSET_Y);
      var cw = Math.max(1, Math.round(w * (1 - 2 * FRAME_INSET_X)));
      var ch = Math.max(1, Math.round(h * (1 - 2 * FRAME_INSET_Y)));
      previewCropCanvas.width = cw;
      previewCropCanvas.height = ch;
      var pctx = previewCropCanvas.getContext("2d");
      if (!pctx) return null;
      pctx.drawImage(previewFrameCanvas, x, y, cw, ch, 0, 0, cw, ch);
      return previewCropCanvas;
    }

    function pushOwnerCoverPreview() {
      if (!ownerTesting || !coverPreview || typeof coverPreview.setCover !== "function") return;
      var art = captureCoverArtForPreview();
      var payload = canvasToJpegPayload(art);
      if (!payload) return;
      var fields = readFromEditFields();
      var Q = global.HalalitLookupQuality;
      var meta = { title: "", author: "" };
      if (!Q || !Q.isGarbage(fields.title, fields.author)) {
        meta.title = fields.title;
        meta.author = fields.author;
      } else {
        meta.title = "Live preview";
      }
      coverPreview.setCover("data:" + payload.mimeType + ";base64," + payload.imageBase64, meta);
    }

    function maybeUpdateOwnerCoverPreview() {
      if (!ownerTesting || !stream || scanMode !== "cover") return;
      var now = Date.now();
      if (now - lastCoverPreviewAt < COVER_PREVIEW_MS) return;
      lastCoverPreviewAt = now;
      pushOwnerCoverPreview();
    }

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg || "";
    }

    function setLiveOverlay(opts) {
      opts = opts || {};
      if (!liveOverlay) return;
      if (opts.hidden) {
        liveOverlay.hidden = true;
        liveOverlay.classList.remove("scroll-scanner-live--found");
        return;
      }
      liveOverlay.hidden = false;
      if (liveHint) liveHint.textContent = opts.hint || "Reading cover";
      if (liveTitle) liveTitle.textContent = opts.title || "";
      if (liveAuthor) liveAuthor.textContent = opts.author ? "by " + opts.author : "";
      if (opts.found) liveOverlay.classList.add("scroll-scanner-live--found");
      else liveOverlay.classList.remove("scroll-scanner-live--found");
    }

    function readFromEditFields() {
      return {
        title: titleEdit ? String(titleEdit.value || "").trim() : "",
        author: authorEdit ? String(authorEdit.value || "").trim() : "",
      };
    }

    function updateConfirmBtn() {
      var fields = readFromEditFields();
      if (confirmBtn) confirmBtn.disabled = !fields.title;
    }

    function syncEditFields(title, author, brief) {
      var swapped = maybeSwapTitleAuthor(title, author);
      title = swapped.title;
      author = swapped.author;
      var Q = global.HalalitLookupQuality;
      if (
        ownerTesting &&
        Q &&
        Q.isGarbage(title, author) &&
        brief &&
        brief.indexOf("Picked from the catalog") === -1 &&
        brief.indexOf("You chose this reading") === -1
      ) {
        setStatus(
          "Cover read looks mixed up — the animated preview still updates from the camera. Fix the fields, pick Did you mean?, or type by hand."
        );
        pushOwnerCoverPreview();
        return;
      }
      if (titleEdit) titleEdit.value = String(title || "").trim();
      if (authorEdit) authorEdit.value = String(author || "").trim();
      currentPick = {
        title: String(title || "").trim(),
        author: String(author || "").trim(),
        brief: brief || "",
      };
      updateConfirmBtn();
      scheduleCatalogLookup();
      var Q = global.HalalitLookupQuality;
      if (
        !ownerTesting &&
        Q &&
        Q.isGarbage(currentPick.title, currentPick.author) &&
        brief &&
        brief.indexOf("Picked from the catalog") === -1 &&
        brief.indexOf("You chose this reading") === -1
      ) {
        Q.reportMalfunction(currentPick.title, currentPick.author, "cover_read");
        setStatus(
          "Cover read looks mixed up — fix the title and author fields, or type the book name by hand."
        );
      }
    }

    function hideCatalogSuggestions() {
      if (catalogWrap) catalogWrap.hidden = true;
      if (catalogList) catalogList.innerHTML = "";
    }

    function showCatalogSuggestions(items) {
      if (!catalogList || !catalogWrap) return;
      catalogList.innerHTML = "";
      if (!items || !items.length) {
        catalogWrap.hidden = true;
        return;
      }
      catalogWrap.hidden = false;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var li = global.document.createElement("li");
        var btn = global.document.createElement("button");
        btn.type = "button";
        btn.className = "import-btn scroll-scanner-alt-btn";
        btn.textContent = item.title + (item.author ? " — " + item.author : "");
        (function (row) {
          btn.addEventListener("click", function () {
            syncEditFields(row.title, row.author, "Picked from the catalog.");
            setLiveOverlay({
              hint: "Found",
              title: row.title,
              author: row.author || "",
              found: true,
            });
            paused = true;
            setStatus("Catalog match chosen. Tap Run Bookcheck when ready.");
          });
        })(item);
        li.appendChild(btn);
        catalogList.appendChild(li);
      }
    }

    function scheduleCatalogLookup() {
      if (catalogTimer) global.clearTimeout(catalogTimer);
      catalogTimer = global.setTimeout(runCatalogLookup, 700);
    }

    function runCatalogLookup() {
      if (!global.fetch) return;
      var fields = readFromEditFields();
      var hasTitle = fields.title.length >= 3;
      var hasAuthor = fields.author.length >= 3;
      if (!hasTitle && !hasAuthor) {
        hideCatalogSuggestions();
        return;
      }
      var fetchId = ++catalogFetchId;
      var primary = hasTitle ? buildCatalogSearchUrl(fields.title, fields.author) : "";
      var loose = hasTitle ? looseCatalogTitle(fields.title) : "";
      var looseUrl =
        loose && loose !== fields.title ? buildCatalogSearchUrl(loose, fields.author) : "";
      var fallback = hasTitle ? buildCatalogFallbackUrl(fields.title, fields.author) : "";
      var authorUrl = hasAuthor ? buildCatalogAuthorUrl(fields.author) : "";

      Promise.all([
        primary ? fetchCatalogDocs(primary) : Promise.resolve([]),
        looseUrl ? fetchCatalogDocs(looseUrl) : Promise.resolve([]),
        fallback && fallback !== primary ? fetchCatalogDocs(fallback) : Promise.resolve([]),
        authorUrl ? fetchCatalogDocs(authorUrl) : Promise.resolve([]),
      ]).then(function (batches) {
        if (fetchId !== catalogFetchId) return;
        var merged = [];
        var seenKey = {};
        for (var b = 0; b < batches.length; b++) {
          var docs = batches[b] || [];
          for (var d = 0; d < docs.length; d++) {
            var doc = docs[d];
            var k = String((doc && doc.key) || "") + catalogDocTitle(doc);
            if (seenKey[k]) continue;
            seenKey[k] = true;
            merged.push(doc);
          }
        }
        var ranked = rankCatalogDocs(merged, loose || fields.title, fields.author);
        showCatalogSuggestions(ranked);
      });
    }

    function clearResult() {
      currentPick = null;
      stableKey = "";
      stableCount = 0;
      authorStableKey = "";
      authorStableCount = 0;
      authorLocked = false;
      ocrFailCount = 0;
      ocrPassCount = 0;
      visionFailStreak = 0;
      visionUnavailable = false;
      lastVisionAt = 0;
      lastOcrAt = 0;
      barcodeBusy = false;
      barcodeLookupGen += 1;
      if (resultEl) resultEl.hidden = true;
      if (resultEl) resultEl.innerHTML = "";
      if (altList) altList.innerHTML = "";
      if (titleEdit) titleEdit.value = "";
      if (authorEdit) authorEdit.value = "";
      hideCatalogSuggestions();
      if (confirmBtn) confirmBtn.disabled = true;
      setLiveOverlay({ hidden: true });
    }

    function terminateWorker() {
      if (ocrWorker && typeof ocrWorker.terminate === "function") {
        ocrWorker.terminate().catch(function () {});
      }
      ocrWorker = null;
    }

    function getVideoTrack() {
      if (!stream) return null;
      var tracks = stream.getVideoTracks();
      return tracks && tracks.length ? tracks[0] : null;
    }

    function probeTorchAvailable(track) {
      if (!track) return false;
      try {
        if (typeof track.getCapabilities === "function") {
          var caps = track.getCapabilities();
          if (caps && caps.torch === true) return true;
        }
      } catch (eCap) {}
      var ua = String((global.navigator && global.navigator.userAgent) || "");
      if (/android/i.test(ua)) {
        try {
          if (typeof track.getSettings === "function") {
            var settings = track.getSettings();
            if (settings && settings.facingMode === "environment") return true;
          }
        } catch (eSet) {}
      }
      return false;
    }

    function applyTorchState(on) {
      var track = getVideoTrack();
      if (!track) return Promise.resolve(false);
      var want = !!on;
      var tries = [
        function () {
          return track.applyConstraints({ advanced: [{ torch: want }] });
        },
        function () {
          return track.applyConstraints({ torch: want });
        },
      ];
      function attempt(i) {
        if (i >= tries.length) return Promise.resolve(false);
        return tries[i]()
          .then(function () {
            return true;
          })
          .catch(function () {
            return attempt(i + 1);
          });
      }
      return attempt(0);
    }

    function syncTorchUi() {
      if (!torchBtn) return;
      if (!stream || !torchAvailable) {
        torchBtn.hidden = true;
        torchBtn.setAttribute("aria-pressed", "false");
        torchBtn.textContent = "Light off";
        torchBtn.classList.remove("scroll-scanner-torch--on");
        torchBtn.setAttribute("aria-label", "Scanner light off");
        return;
      }
      torchBtn.hidden = false;
      torchBtn.textContent = torchOn ? "Light on" : "Light off";
      torchBtn.setAttribute("aria-pressed", torchOn ? "true" : "false");
      torchBtn.setAttribute("aria-label", torchOn ? "Scanner light on" : "Scanner light off");
      if (torchOn) torchBtn.classList.add("scroll-scanner-torch--on");
      else torchBtn.classList.remove("scroll-scanner-torch--on");
    }

    function refreshTorchAvailability() {
      var track = getVideoTrack();
      torchAvailable = probeTorchAvailable(track);
      if (!torchAvailable) {
        torchOn = false;
      }
      syncTorchUi();
    }

    function setTorch(on) {
      if (!torchAvailable) return Promise.resolve(false);
      return applyTorchState(on).then(function (ok) {
        if (ok) torchOn = !!on;
        else if (on) torchAvailable = false;
        syncTorchUi();
        return ok;
      });
    }

    function stopCamera() {
      stopOwnerCoverPreviewLoop();
      if (ownerTesting && coverPreview && typeof coverPreview.clear === "function") {
        coverPreview.clear();
      }
      if (scanTimer) {
        global.clearInterval(scanTimer);
        scanTimer = null;
      }
      if (torchOn || torchAvailable) {
        applyTorchState(false).catch(function () {});
      }
      torchOn = false;
      torchAvailable = false;
      syncTorchUi();
      if (stream) {
        var tracks = stream.getTracks();
        for (var i = 0; i < tracks.length; i++) tracks[i].stop();
        stream = null;
      }
      if (video) {
        video.srcObject = null;
      }
      terminateWorker();
      ocrBusy = false;
      visionBusy = false;
      barcodeBusy = false;
      paused = false;
      if (startBtn) startBtn.hidden = false;
    }

    function scanningOverlayForMode() {
      if (scanMode === "barcode") {
        return {
          hint: "Barcode mode",
          title: "ISBN strip in the band",
          author: "",
        };
      }
      return {
        hint: "Reading cover",
        title: "Title in the upper half",
        author: "Author in the lower half",
      };
    }

    function resumeScanning(msg) {
      paused = false;
      barcodeBusy = false;
      ocrBusy = false;
      visionBusy = false;
      if (stream) {
        startScanLoop();
        if (msg) setStatus(msg);
        setLiveOverlay(scanningOverlayForMode());
      } else if (startBtn) {
        startBtn.hidden = false;
        setStatus(msg || "Tap Start camera to scan again.");
      }
    }

    function probeVisionAvailability() {
      var Config = global.HalalitBookcheckConfig;
      var url = Config && typeof Config.aiHealthUrl === "function" ? Config.aiHealthUrl() : "";
      if (!url || !global.fetch) {
        visionUnavailable = true;
        return;
      }
      global
        .fetch(url)
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (!data || !data.aiConfigured) visionUnavailable = true;
        })
        .catch(function () {
          visionUnavailable = true;
        });
    }

    function preprocessForOcr(ctx, w, h) {
      var img = ctx.getImageData(0, 0, w, h);
      var d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        gray = (gray - 72) * 1.4;
        if (gray < 0) gray = 0;
        if (gray > 255) gray = 255;
        d[i] = d[i + 1] = d[i + 2] = gray;
      }
      ctx.putImageData(img, 0, 0);
    }

    function captureFullFrameCanvas() {
      if (!video || !canvas || !video.videoWidth) return null;
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      var scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
      var w = Math.max(1, Math.round(vw * scale));
      var h = Math.max(1, Math.round(vh * scale));
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);
      return canvas;
    }

    function loadBarcodePolyfillConstructor() {
      if (global.__halalitBarcodePolyfill) return Promise.resolve(global.__halalitBarcodePolyfill);
      return import(BARCODE_POLYFILL_ESM)
        .then(function (mod) {
          global.__halalitBarcodePolyfill = mod.BarcodeDetectorPolyfill;
          return global.__halalitBarcodePolyfill;
        })
        .catch(function () {
          return null;
        });
    }

    function buildNativeBarcodeDetector() {
      if (!global.BarcodeDetector) return Promise.resolve(null);
      return global.BarcodeDetector.getSupportedFormats()
        .then(function (formats) {
          var wanted = ["ean_13", "ean_8", "upc_a", "upc_e"];
          var picked = [];
          for (var i = 0; i < wanted.length; i++) {
            if (formats.indexOf(wanted[i]) !== -1) picked.push(wanted[i]);
          }
          return new global.BarcodeDetector({
            formats: picked.length ? picked : ["ean_13", "ean_8"],
          });
        })
        .catch(function () {
          return new global.BarcodeDetector({ formats: ["ean_13", "ean_8"] });
        });
    }

    function getBarcodeDetector() {
      if (!barcodeDetectorPromise) {
        barcodeDetectorPromise = buildNativeBarcodeDetector()
          .then(function (native) {
            if (native) return native;
            return loadBarcodePolyfillConstructor().then(function (Polyfill) {
              if (!Polyfill) return null;
              barcodePolyfillActive = true;
              return new Polyfill();
            });
          })
          .catch(function () {
            return null;
          });
      }
      return barcodeDetectorPromise;
    }

    function noteBarcodeUnavailable() {
      if (scanMode !== "barcode") return;
      setStatus(
        "Barcode scan is not available in this browser yet. Use Front cover mode and Did you mean?, or type the title."
      );
    }

    function captureBarcodeCandidates() {
      if (!video || !canvas || !ocrCanvas || !video.videoWidth) return [];
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      var scale = Math.min(1, BARCODE_MAX_EDGE / Math.max(vw, vh));
      var w = Math.max(1, Math.round(vw * scale));
      var h = Math.max(1, Math.round(vh * scale));
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      if (!ctx) return [];
      ctx.drawImage(video, 0, 0, w, h);

      var regions =
        scanMode === "barcode"
          ? [
              { x: 0.05, y: 0.3, rw: 0.9, rh: 0.4 },
              { x: 0.05, y: 0.45, rw: 0.9, rh: 0.4 },
              { x: 0, y: 0, rw: 1, rh: 1 },
            ]
          : [
              { x: 0.08, y: 0.34, rw: 0.84, rh: 0.32 },
              { x: 0, y: 0, rw: 1, rh: 1 },
            ];

      var out = [];
      for (var i = 0; i < regions.length; i++) {
        var r = regions[i];
        var x = Math.round(w * r.x);
        var y = Math.round(h * r.y);
        var cw = Math.max(1, Math.round(w * r.rw));
        var ch = Math.max(1, Math.round(h * r.rh));
        ocrCanvas.width = cw;
        ocrCanvas.height = ch;
        var octx = ocrCanvas.getContext("2d");
        if (!octx) continue;
        octx.drawImage(canvas, x, y, cw, ch, 0, 0, cw, ch);
        out.push(ocrCanvas);
      }
      return out;
    }

    function detectBarcodeOnCandidates(detector, candidates, idx, done) {
      if (!detector || !candidates || idx >= candidates.length || paused) {
        done(null);
        return;
      }
      detector
        .detect(candidates[idx])
        .then(function (codes) {
          if (codes && codes.length) {
            done(codes);
            return;
          }
          detectBarcodeOnCandidates(detector, candidates, idx + 1, done);
        })
        .catch(function () {
          detectBarcodeOnCandidates(detector, candidates, idx + 1, done);
        });
    }

    function applyScanMode(nextMode) {
      scanMode = nextMode === "barcode" ? "barcode" : "cover";
      if (cameraWrap) {
        if (scanMode === "barcode") cameraWrap.classList.add("scroll-scanner-camera-wrap--barcode");
        else cameraWrap.classList.remove("scroll-scanner-camera-wrap--barcode");
      }
      if (modeCoverBtn) {
        modeCoverBtn.classList.toggle("scroll-scanner-mode-btn--active", scanMode === "cover");
      }
      if (modeBarcodeBtn) {
        modeBarcodeBtn.classList.toggle("scroll-scanner-mode-btn--active", scanMode === "barcode");
      }
      if (scanMode === "barcode") {
        getBarcodeDetector().then(function (det) {
          if (!det) noteBarcodeUnavailable();
        });
        if (stream) {
          setStatus("Fill the wide band with the ISBN barcode. Hold steady a few inches away.");
          setLiveOverlay({
            hint: "Barcode mode",
            title: "ISBN strip in the band",
            author: "",
          });
        }
      } else if (stream) {
        setStatus("Keep the title in the upper half of the box.");
        setLiveOverlay({
          hint: "Reading cover",
          title: "Title in the upper half",
          author: "Author in the lower half",
        });
      }
    }

    function handleBookIdentified(match, opts) {
      opts = opts || {};
      if (!match || !String(match.title || "").trim()) return;
      if (ownerTesting && match.source === "vision") {
        return;
      }
      if (!ownerTesting) paused = true;
      ocrBusy = false;
      visionBusy = false;
      barcodeBusy = false;
      var label =
        match.source === "barcode"
          ? "Matched from barcode."
          : match.source === "vision"
            ? "Matched from cover art."
            : "Read from cover lettering.";
      syncEditFields(match.title, match.author || "", label);
      setLiveOverlay({
        hint: "Found",
        title: match.title,
        author: match.author || "",
        found: true,
      });
      if (opts.autoRun && !ownerTesting) {
        setStatus("Found " + match.title + ". Opening Bookcheck…");
        global.setTimeout(function () {
          runBookcheck();
        }, 500);
      } else {
        pushOwnerCoverPreview();
        setStatus(
          ownerTesting
            ? "Found " + match.title + ". Cover preview updated — tap Run test Bookcheck when ready."
            : "Found " + match.title + ". Tap Run Bookcheck when ready."
        );
        updateConfirmBtn();
      }
    }

    function tryBarcode() {
      if (barcodeBusy || paused || !tabActive) return;
      var candidates = captureBarcodeCandidates();
      if (!candidates.length) return;
      barcodeBusy = true;
      var lookupGen = barcodeLookupGen;
      function finishBarcode() {
        barcodeBusy = false;
      }
      function barcodeLookupFailed(reason) {
        if (lookupGen !== barcodeLookupGen || paused) return;
        finishBarcode();
        resumeScanning(
          reason ||
            "Could not look up that barcode — try again, use Front cover mode, or type the title."
        );
      }
      getBarcodeDetector()
        .then(function (detector) {
          if (lookupGen !== barcodeLookupGen) {
            finishBarcode();
            return;
          }
          if (!detector) {
            finishBarcode();
            noteBarcodeUnavailable();
            return;
          }
          detectBarcodeOnCandidates(detector, candidates, 0, function (codes) {
            if (lookupGen !== barcodeLookupGen || !codes || !codes.length || paused) {
              finishBarcode();
              return;
            }
            for (var i = 0; i < codes.length; i++) {
              var isbn = normalizeBarcodeIsbn(codes[i].rawValue);
              if (!isbn) continue;
              setLiveOverlay({
                hint: "Reading",
                title: "Barcode found…",
                author: "",
              });
              setStatus("Barcode found. Looking up the book…");
              lookupIsbn(isbn).then(function (match) {
                if (lookupGen !== barcodeLookupGen) return;
                if (!match || !match.title || paused) {
                  barcodeLookupFailed(
                    "No book found for that barcode — try Front cover mode or type the title."
                  );
                  return;
                }
                finishBarcode();
                handleBookIdentified(
                  {
                    title: match.title,
                    author: match.author || "",
                    source: "barcode",
                    confidence: "high",
                  },
                  { autoRun: !ownerTesting }
                );
              });
              return;
            }
            finishBarcode();
          });
        })
        .catch(function () {
          finishBarcode();
        });
    }

    function tryVision() {
      if (ownerTesting) return;
      if (visionBusy || paused || visionUnavailable) return;
      var crop = captureCropForOcr();
      if (!crop) return;
      var payload = canvasToJpegPayload(crop);
      if (!payload) return;
      var AI = global.HalalitBookcheckAi;
      if (!AI || typeof AI.fetchCoverIdentify !== "function") {
        visionUnavailable = true;
        return;
      }
      visionBusy = true;
      var visionTimeout = global.setTimeout(function () {
        visionBusy = false;
        visionFailStreak += 1;
      }, 10000);
      AI.fetchCoverIdentify(payload.imageBase64, payload.mimeType)
        .then(function (data) {
          global.clearTimeout(visionTimeout);
          visionBusy = false;
          if (paused) return;
          data = data || {};
          if (data.error === "ai_unconfigured" || data.error === "unavailable") {
            visionUnavailable = true;
            return;
          }
          if (!data.ok || !data.title || data.confidence === "none" || data.confidence === "low") {
            visionFailStreak += 1;
            return;
          }
          visionFailStreak = 0;
          handleBookIdentified(
            {
              title: data.title,
              author: data.author || "",
              source: "vision",
              confidence: data.confidence,
            },
            { autoRun: data.confidence === "high" && !ownerTesting }
          );
        })
        .catch(function () {
          global.clearTimeout(visionTimeout);
          visionBusy = false;
          visionFailStreak += 1;
        });
    }

    function captureCropForOcr() {
      if (!video || !canvas || !ocrCanvas || !video.videoWidth) return null;
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      var scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
      var w = Math.max(1, Math.round(vw * scale));
      var h = Math.max(1, Math.round(vh * scale));
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);

      var x = Math.round(w * FRAME_INSET_X);
      var y = Math.round(h * FRAME_INSET_Y);
      var cw = Math.max(1, Math.round(w * (1 - 2 * FRAME_INSET_X)));
      var ch = Math.max(1, Math.round(h * (1 - 2 * FRAME_INSET_Y)));
      ocrCanvas.width = cw;
      ocrCanvas.height = ch;
      var octx = ocrCanvas.getContext("2d");
      if (!octx) return null;
      octx.drawImage(canvas, x, y, cw, ch, 0, 0, cw, ch);
      preprocessForOcr(octx, cw, ch);
      return ocrCanvas;
    }

    function showPick(pick) {
      if (!pick) return;
      syncEditFields(pick.title, pick.author, pick.brief || "");
      if (resultEl) resultEl.hidden = true;
    }

    function showAlternatives(alts, showLabel) {
      if (!altList) return;
      altList.innerHTML = "";
      if (!alts || !alts.length) return;
      if (showLabel) {
        var lead = global.document.createElement("p");
        lead.className = "muted";
        lead.style.fontSize = "0.85rem";
        lead.style.margin = "0.35rem 0 0.4rem";
        lead.textContent = "Not sure? Pick a line:";
        altList.appendChild(lead);
      }
      var ul = global.document.createElement("ul");
      ul.className = "scroll-scanner-alt-list";
      for (var i = 0; i < alts.length; i++) {
        var alt = alts[i];
        if (!alt || !alt.title || !isAcceptableTitle(alt.title)) continue;
        var li = global.document.createElement("li");
        var btn = global.document.createElement("button");
        btn.type = "button";
        btn.className = "import-btn scroll-scanner-alt-btn";
        btn.textContent = alt.title + (alt.author ? " — " + alt.author : "");
        (function (row) {
          btn.addEventListener("click", function () {
            syncEditFields(row.title, row.author, "You chose this reading of the cover.");
            setLiveOverlay({
              hint: "Found",
              title: row.title,
              author: row.author || "",
              found: true,
            });
            paused = true;
            setStatus("You picked a line. Fix the fields if needed, then Run Bookcheck.");
          });
        })(alt);
        li.appendChild(btn);
        ul.appendChild(li);
      }
      if (ul.childNodes.length) altList.appendChild(ul);
    }

    function handleParsed(parsed) {
      ocrBusy = false;
      ocrPassCount += 1;
      if (authorLocked) {
        ocrBusy = false;
        return;
      }

      var guess = fieldGuessFromParsed(parsed);
      if (!guess) {
        ocrFailCount += 1;
        setLiveOverlay({
          hint: "Still looking",
          title: ocrFailCount >= 3 ? "Type the title below" : "Hold the title steady",
          author: "",
        });
        setStatus(
          ocrFailCount >= 3
            ? "This cover is hard to read. Type the title below — Did you mean? will help."
            : "Still reading… title in the upper half of the box."
        );
        showAlternatives([]);
        return;
      }
      ocrFailCount = 0;

      var trackKey = normKey(
        guess.strong && parsed.title ? parsed.title : guess.title,
        guess.author
      );
      if (trackKey === stableKey) stableCount += 1;
      else {
        stableKey = trackKey;
        stableCount = 1;
      }

      if (guess.authorOnly) {
        var authorKey = normKey("", guess.author);
        if (authorKey === authorStableKey) authorStableCount += 1;
        else {
          authorStableKey = authorKey;
          authorStableCount = 1;
        }
        if (authorEdit) authorEdit.value = String(guess.author || "").trim();
        scheduleCatalogLookup();
        if (authorStableCount >= 2 && looksLikePersonName(guess.author)) {
          authorLocked = true;
          syncEditFields("", guess.author, "Read the author — pick the title from Did you mean? below.");
          setLiveOverlay({
            hint: "Found author",
            title: "Pick title below",
            author: guess.author,
            found: true,
          });
          setStatus("Got the author. Pick your book under Did you mean?.");
          showAlternatives([]);
          return;
        }
        setLiveOverlay({
          hint: "Reading",
          title: "Reading author…",
          author: guess.author || "",
        });
        setStatus("Reading the author… hold the name in the lower half of the box.");
        showAlternatives([]);
        return;
      }

      if (stableCount >= (ownerTesting ? 2 : 1)) {
        syncEditFields(
          guess.title,
          guess.author,
          guess.strong
            ? "Read from cover lettering on your device."
            : "Best guess from the cover — check Did you mean? below."
        );
      }

      setLiveOverlay({
        hint: stableCount >= 2 && guess.strong ? "Found" : "Reading",
        title: guess.title || "",
        author: guess.author || "",
        found: stableCount >= 2 && guess.strong,
      });

      if (stableCount < 2 || !guess.strong) {
        setStatus(
          guess.strong
            ? "Reading the cover… hold steady a moment longer."
            : guess.authorOnly
              ? "Reading the author… hold the name in the lower half of the box."
              : "Messy read — fix the title or tap Did you mean? below."
        );
        showAlternatives([]);
        return;
      }

      showPick(parsed);
      showAlternatives(parsed.alternatives, true);
      if (!ownerTesting) paused = true;
      if (parsed.author) {
        setStatus(
          ownerTesting
            ? "Best read so far — check Did you mean? or fix fields. Cover preview keeps updating."
            : "Found title and author. Tap Run Bookcheck, or pick from Did you mean?."
        );
      } else {
        setStatus(
          ownerTesting
            ? "Best title read — check Did you mean? Cover preview keeps updating."
            : "Found a title. Tap Run Bookcheck, or pick from Did you mean?."
        );
      }
    }

    function ensureWorker(Tesseract) {
      if (ocrWorker) return Promise.resolve(ocrWorker);
      return Tesseract.createWorker("eng")
        .then(function (worker) {
          return worker
            .setParameters({
              tessedit_pageseg_mode: "11",
            })
            .then(function () {
              ocrWorker = worker;
              return worker;
            });
        });
    }

    function recognizeWithTimeout(worker, target, ms) {
      return new Promise(function (resolve, reject) {
        var done = false;
        var timer = global.setTimeout(function () {
          if (done) return;
          done = true;
          reject(new Error("ocr_timeout"));
        }, ms || 14000);
        worker
          .recognize(target)
          .then(function (result) {
            if (done) return;
            done = true;
            global.clearTimeout(timer);
            resolve(result);
          })
          .catch(function (err) {
            if (done) return;
            done = true;
            global.clearTimeout(timer);
            reject(err);
          });
      });
    }

    function tryOcrFallback() {
      if (ocrBusy || paused) return;
      var Tesseract = global.Tesseract;
      if (!Tesseract) return;
      var target = captureCropForOcr();
      if (!target) return;
      ocrBusy = true;
      lastOcrAt = Date.now();
      ensureWorker(Tesseract)
        .then(function (worker) {
          return recognizeWithTimeout(worker, target, 12000);
        })
        .then(function (result) {
          var cropH = target.height || 0;
          var text = result && result.data && result.data.text ? result.data.text : "";
          var parsed = parseSpatialOcrResult(result, cropH) || {};
          parsed = enrichParsedFromRawText(parsed, text);
          handleParsed(parsed);
        })
        .catch(function () {
          ocrBusy = false;
        });
    }

    function sendFrame() {
      if (!tabActive || paused) return;
      if (scanMode === "barcode") {
        tryBarcode();
        return;
      }
      tryBarcode();
      if (paused) return;

      var now = Date.now();
      if (!authorLocked && !ocrBusy && now - lastOcrAt >= OCR_INTERVAL_MS) {
        tryOcrFallback();
      }
      if (!visionUnavailable && !visionBusy && now - lastVisionAt >= VISION_INTERVAL_MS) {
        lastVisionAt = now;
        tryVision();
      }
      maybeUpdateOwnerCoverPreview();
    }

    function waitForVideoReady(thenStart) {
      var tries = 0;
      function tick() {
        tries += 1;
        if (video && video.videoWidth > 0 && video.videoHeight > 0) {
          thenStart();
          return;
        }
        if (tries > 80) {
          setStatus("Camera is on but not ready yet. Wait a second, or type the title below.");
          thenStart();
          return;
        }
        global.requestAnimationFrame(tick);
      }
      tick();
    }

    function startScanLoop() {
      if (scanTimer) return;
      scanTimer = global.setInterval(sendFrame, 500);
    }

    function startCamera() {
      if (!global.navigator || !global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia) {
        setStatus("Camera is not available here. Try your phone browser on HTTPS.");
        if (permissionNote) permissionNote.hidden = false;
        return;
      }
      setStatus("Starting camera…");
      if (permissionNote) permissionNote.hidden = true;
      loadTesseract().catch(function () {});
      global.navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
        .then(function (s) {
          stream = s;
          if (video) {
            video.srcObject = s;
            return video.play();
          }
        })
        .then(function () {
          clearResult();
          paused = false;
          lastVisionAt = Date.now();
          lastOcrAt = 0;
          probeVisionAvailability();
          getBarcodeDetector().catch(function () {});
          if (scanMode === "barcode") {
            setStatus("Fill the wide band with the ISBN barcode. Hold steady a few inches away.");
            setLiveOverlay({
              hint: "Barcode mode",
              title: "ISBN strip in the band",
              author: "",
            });
          } else {
            setStatus("Keep the title in the upper half of the box. Or switch to Barcode mode for the back.");
            setLiveOverlay({
              hint: "Reading cover",
              title: "Title in the upper half",
              author: "Author in the lower half",
            });
          }
          waitForVideoReady(function () {
            refreshTorchAvailability();
            startScanLoop();
            if (ownerTesting && scanMode === "cover") {
              startOwnerCoverPreviewLoop();
              pushOwnerCoverPreview();
            }
          });
          if (startBtn) startBtn.hidden = true;
        })
        .catch(function () {
          setStatus("Camera permission was blocked. Allow camera access and try again.");
          if (permissionNote) permissionNote.hidden = false;
        });
    }

    function resetScan() {
      barcodeLookupGen += 1;
      clearResult();
      paused = false;
      barcodeBusy = false;
      ocrBusy = false;
      visionBusy = false;
      visionFailStreak = 0;
      lastVisionAt = Date.now();
      lastOcrAt = 0;
      authorLocked = false;
      authorStableKey = "";
      authorStableCount = 0;
      if (!stream) {
        if (startBtn) startBtn.hidden = false;
        setStatus("Tap Start camera to scan again.");
        return;
      }
      startScanLoop();
      if (scanMode === "barcode") {
        setStatus("Fill the wide band with the ISBN barcode. Hold steady a few inches away.");
        setLiveOverlay({
          hint: "Barcode mode",
          title: "ISBN strip in the band",
          author: "",
        });
      } else {
        setStatus("Keep the title in the upper half of the box. Or switch to Barcode mode for the back.");
        setLiveOverlay({
          hint: "Reading cover",
          title: "Title in the upper half",
          author: "Author in the lower half",
        });
      }
    }

    function runBookcheck() {
      var fields = readFromEditFields();
      if (!fields.title) return;
      var Q = global.HalalitLookupQuality;
      if (Q && Q.isGarbage(fields.title, fields.author)) {
        if (!ownerTesting) {
          Q.reportMalfunction(fields.title, fields.author, "bookcheck_blocked");
        }
        setStatus(
          "That doesn't look like a real book title yet. Fix the fields or type the title by hand before running Bookcheck."
        );
        return;
      }
      var title = fields.title;
      var author = fields.author;
      stopCamera();
      if (ownerTesting) {
        if (global.HalalitBookcheck && typeof global.HalalitBookcheck.prefillAndLookup === "function") {
          global.HalalitBookcheck.prefillAndLookup(title, author, {
            fromScanner: true,
            ownerTesting: true,
            panelId: bookcheckPanelId,
          });
        }
        setStatus("Test Bookcheck ran below — not logged as a reader lookup.");
        return;
      }
      var F = global.HalalitSiteFlags;
      if (F && typeof F.isEnabled === "function" && !F.isEnabled("bookcheckEnabled")) {
        setStatus("Bookcheck is paused right now — try again later or type the title on the Bookcheck tab.");
        return;
      }
      var bcBtn = global.document && global.document.getElementById("tab-btn-bookcheck");
      if (bcBtn && bcBtn.hidden) {
        setStatus("Bookcheck isn't available on this device — open Halalit on your phone to run a lookup.");
        return;
      }
      function launchBookcheckLookup() {
        if (global.HalalitBookcheck && typeof global.HalalitBookcheck.prefillAndLookup === "function") {
          global.HalalitBookcheck.prefillAndLookup(title, author, { fromScanner: true });
        }
      }
      if (global.HalalitTabs && typeof global.HalalitTabs.goToBookcheck === "function") {
        global.HalalitTabs.goToBookcheck();
      } else if (bcBtn) {
        bcBtn.click();
      }
      if (typeof global.requestAnimationFrame === "function") {
        global.requestAnimationFrame(function () {
          global.requestAnimationFrame(launchBookcheckLookup);
        });
      } else {
        global.setTimeout(launchBookcheckLookup, 0);
      }
    }

    function wireModeButton(btn, mode) {
      if (!btn) return;
      var lastTap = 0;
      function pickMode() {
        var now = Date.now();
        if (now - lastTap < 350) return;
        lastTap = now;
        applyScanMode(mode);
      }
      btn.addEventListener("click", pickMode);
      btn.addEventListener(
        "touchend",
        function (e) {
          e.preventDefault();
          pickMode();
        },
        { passive: false }
      );
    }
    wireModeButton(modeCoverBtn, "cover");
    wireModeButton(modeBarcodeBtn, "barcode");
    if (torchBtn) {
      torchBtn.addEventListener("click", function () {
        if (!stream || !torchAvailable) return;
        var next = !torchOn;
        setTorch(next).then(function (ok) {
          if (!ok && next) {
            setStatus("This browser can’t keep the scanner light on. Move to a brighter spot or type the title.");
          }
        });
      });
    }
    if (startBtn) {
      startBtn.addEventListener("click", function () {
        startCamera();
      });
    }
    if (rescanBtn) {
      rescanBtn.addEventListener("click", function () {
        resetScan();
      });
    }
    if (confirmBtn) {
      confirmBtn.addEventListener("click", runBookcheck);
    }
    if (titleEdit) {
      titleEdit.addEventListener("input", function () {
        updateConfirmBtn();
        scheduleCatalogLookup();
      });
    }
    if (authorEdit) {
      authorEdit.addEventListener("input", function () {
        scheduleCatalogLookup();
      });
    }

    var controller = {
      setTabActive: function (active) {
        tabActive = !!active;
        if (!ownerTesting) {
          var sugWrap = global.document && global.document.querySelector(".halalit-suggestion-wrap");
          if (sugWrap) {
            sugWrap.style.pointerEvents = tabActive ? "none" : "";
            sugWrap.style.visibility = tabActive ? "hidden" : "";
          }
        }
        if (tabActive) {
          if (!stream) {
            if (startBtn) startBtn.hidden = false;
            setStatus(
              ownerTesting
                ? "Testing lab — tap Start camera. Cover preview animates below; not logged as a reader lookup."
                : "Tap Start camera to try Scroll Scanner."
            );
          } else {
            resumeScanning();
          }
        } else {
          stopCamera();
          if (startBtn) startBtn.hidden = false;
          setLiveOverlay({ hidden: true });
          setStatus("");
        }
      },
    };
    if (panel.id) scannerControllers[panel.id] = controller;
    if (opts.primary !== false && (opts.primary || !scannerControllers.__primary)) {
      scannerControllers.__primary = controller;
    }
    global.HalalitScrollScanner = {
      setTabActive: function (active) {
        if (scannerControllers.__primary) scannerControllers.__primary.setTabActive(active);
      },
      setPanelActive: function (panelId, active) {
        if (scannerControllers[panelId]) scannerControllers[panelId].setTabActive(active);
      },
    };
  }

  global.HalalitScrollScanner = global.HalalitScrollScanner || {
    setTabActive: function () {},
  };

  global.HalalitScrollScannerInit = init;
})(typeof window !== "undefined" ? window : this);
