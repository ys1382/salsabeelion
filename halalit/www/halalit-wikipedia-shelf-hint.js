/**
 * Halalit — Wikipedia intro + Plot/Synopsis for Bookcheck (MediaWiki API only).
 */
(function (global) {
  var API = "https://en.wikipedia.org/w/api.php";

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function titleScore(query, pageTitle) {
    var q = norm(query);
    var t = norm(pageTitle);
    if (!q || !t) return 0;
    if (t === q) return 100;
    if (t.indexOf(q) !== -1 || q.indexOf(t) !== -1) return 82;
    var qt = q.split(" ").filter(Boolean);
    var set = {};
    var tt = t.split(" ").filter(Boolean);
    for (var i = 0; i < tt.length; i++) set[tt[i]] = true;
    var inter = 0;
    for (var j = 0; j < qt.length; j++) if (set[qt[j]]) inter++;
    return qt.length ? (inter / qt.length) * 65 : 0;
  }

  function significantTokens(s) {
    var stop = {
      the: 1, a: 1, an: 1, of: 1, and: 1, in: 1, on: 1, for: 1, to: 1, by: 1,
      book: 1, books: 1, novel: 1, novels: 1, series: 1, story: 1
    };
    var parts = norm(s).split(" ").filter(Boolean);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var w = parts[i];
      if (w.length < 3 || stop[w]) continue;
      out.push(w);
    }
    return out;
  }

  function overlapCount(tokens, text) {
    if (!tokens.length) return 0;
    var blob = " " + norm(text) + " ";
    var n = 0;
    for (var i = 0; i < tokens.length; i++) {
      if (blob.indexOf(" " + tokens[i] + " ") !== -1) n++;
    }
    return n;
  }

  function wikiFetch(params) {
    var url = API + "?" + params.toString() + "&format=json&origin=*";
    return global.fetch(url).then(function (r) {
      if (!r.ok) throw new Error("wiki failed");
      return r.json();
    });
  }

  function searchPages(query) {
    var params = new URLSearchParams();
    params.set("action", "query");
    params.set("list", "search");
    params.set("srlimit", "6");
    params.set("srsearch", query);
    return wikiFetch(params).then(function (data) {
      return (data && data.query && data.query.search) || [];
    });
  }

  function pageExtract(pageTitle) {
    var params = new URLSearchParams();
    params.set("action", "query");
    params.set("prop", "extracts");
    params.set("exintro", "1");
    params.set("explaintext", "1");
    params.set("titles", pageTitle);
    return wikiFetch(params).then(function (data) {
      var pages = data && data.query && data.query.pages;
      if (!pages) return "";
      var keys = Object.keys(pages);
      for (var i = 0; i < keys.length; i++) {
        var p = pages[keys[i]];
        if (p && p.extract) return String(p.extract).trim();
      }
      return "";
    });
  }

  function stripHtml(html) {
    return String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function pageSections(pageTitle) {
    var params = new URLSearchParams();
    params.set("action", "parse");
    params.set("page", pageTitle);
    params.set("prop", "sections");
    return wikiFetch(params).then(function (data) {
      return (data && data.parse && data.parse.sections) || [];
    });
  }

  function sectionText(pageTitle, sectionIndex) {
    var params = new URLSearchParams();
    params.set("action", "parse");
    params.set("page", pageTitle);
    params.set("section", String(sectionIndex));
    params.set("prop", "text");
    return wikiFetch(params).then(function (data) {
      var html = data && data.parse && data.parse.text && data.parse.text["*"];
      return stripHtml(html || "");
    });
  }

  function pagePlotSection(pageTitle) {
    return pageSections(pageTitle).then(function (sections) {
      var pick = null;
      for (var i = 0; i < sections.length; i++) {
        var line = String(sections[i].line || "").trim();
        if (!line) continue;
        if (/^plot\b|^synopsis\b|^summary\b/i.test(line) && !/infobox|box summary/i.test(line)) {
          pick = sections[i];
          break;
        }
      }
      if (!pick || pick.index == null) return { title: "", text: "" };
      return sectionText(pageTitle, pick.index).then(function (text) {
        return { title: pick.line, text: String(text || "").trim() };
      });
    });
  }

  function pickBestSearchHit(title, author, hits) {
    if (!hits || !hits.length) return null;
    var q = norm(title) + " " + norm(author);
    var mustTokens = significantTokens(title);
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      var sc = titleScore(title, h.title) + titleScore(q, h.title) * 0.35;
      if (h.snippet && /novel|book|series|children|young adult|fantasy|comic|manga/.test(h.snippet)) sc += 8;
      var supportText = String(h.title || "") + " " + String(h.snippet || "");
      var overlap = overlapCount(mustTokens, supportText);
      if (mustTokens.length >= 2 && overlap < 2) sc -= 30;
      else if (mustTokens.length >= 1 && overlap < 1) sc -= 20;
      if (sc > bestScore) {
        bestScore = sc;
        best = h;
      }
    }
    if (bestScore < 40) return null;
    if (best) {
      var bestSupport = String(best.title || "") + " " + String(best.snippet || "");
      var bestOverlap = overlapCount(mustTokens, bestSupport);
      if (mustTokens.length >= 2 && bestOverlap < 2) return null;
      if (mustTokens.length >= 1 && bestOverlap < 1) return null;
    }
    return best;
  }

  /**
   * @returns {Promise<{
   *   text: string,
   *   intro: string,
   *   plot: string,
   *   plotSectionTitle: string,
   *   pageTitle: string,
   *   url: string
   * }|null>}
   */
  function buildHintFromHit(hit, fetchPlot) {
    if (!hit) return Promise.resolve(null);
    return pageExtract(hit.title).then(function (intro) {
      intro = intro || "";
      if (!fetchPlot || intro.length >= 120) {
        if (!intro || intro.length < 40) return null;
        return {
          text: intro,
          intro: intro,
          plot: "",
          plotSectionTitle: "",
          pageTitle: hit.title,
          url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(hit.title.replace(/ /g, "_")),
        };
      }
      return pagePlotSection(hit.title).then(function (plotBlock) {
        plotBlock = plotBlock || { title: "", text: "" };
        var plot = plotBlock.text || "";
        var combined = intro;
        if (plot) combined += (combined ? "\n\n" : "") + plot;
        if (!combined || combined.length < 40) return null;
        return {
          text: combined,
          intro: intro,
          plot: plot,
          plotSectionTitle: plotBlock.title || "Plot",
          pageTitle: hit.title,
          url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(hit.title.replace(/ /g, "_")),
        };
      });
    });
  }

  function fetchShelfHint(title, author, opts) {
    opts = opts || {};
    var fast = !!opts.fast;
    var t = String(title || "").trim();
    var a = String(author || "").trim();
    if (!t) return Promise.resolve(null);
    var queries = fast
      ? [t + (a ? " " + a : "")]
      : [t + (a ? " " + a : ""), t + " book", t + " novel"];
    var chain = Promise.resolve(null);
    queries.forEach(function (q) {
      chain = chain.then(function (found) {
        if (found) return found;
        return searchPages(q).then(function (hits) {
          var hit = pickBestSearchHit(t, a, hits);
          return buildHintFromHit(hit, !fast);
        });
      });
    });
    return chain.catch(function () {
      return null;
    });
  }

  global.HalalitWikipediaShelfHint = {
    fetchShelfHint: fetchShelfHint,
  };
})(typeof window !== "undefined" ? window : this);
