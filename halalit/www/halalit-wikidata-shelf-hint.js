/**
 * Halalit — Wikidata genre/subject hints for Bookcheck (API only, CC0 data).
 * https://www.wikidata.org/wiki/Wikidata:Data_access
 */
(function (global) {
  var API = "https://www.wikidata.org/w/api.php";

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function wikiFetch(params) {
    params.set("format", "json");
    params.set("origin", "*");
    var url = API + "?" + params.toString();
    return global.fetch(url).then(function (r) {
      if (!r.ok) throw new Error("wikidata failed");
      return r.json();
    });
  }

  function searchEntities(query) {
    var params = new URLSearchParams();
    params.set("action", "wbsearchentities");
    params.set("search", query);
    params.set("language", "en");
    params.set("limit", "8");
    params.set("type", "item");
    return wikiFetch(params).then(function (data) {
      return (data && data.search) || [];
    });
  }

  function pickBestHit(title, author, hits) {
    if (!hits || !hits.length) return null;
    var must = norm(title).split(" ").filter(function (w) {
      return w.length > 2;
    });
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      var label = norm(h.label || "");
      var desc = norm(h.description || "");
      var sc = 0;
      if (label === norm(title)) sc += 100;
      if (label.indexOf(norm(title)) >= 0 || norm(title).indexOf(label) >= 0) sc += 70;
      var overlap = 0;
      for (var j = 0; j < must.length; j++) {
        if (label.indexOf(must[j]) >= 0 || desc.indexOf(must[j]) >= 0) overlap++;
      }
      if (must.length) sc += (overlap / must.length) * 40;
      if (author && desc.indexOf(norm(author).split(" ").pop()) >= 0) sc += 15;
      if (/book|novel|comic|manga|series|literature|fiction/.test(desc)) sc += 12;
      if (/film|album|song|video game|television series$/.test(desc)) sc -= 25;
      if (sc > bestScore) {
        bestScore = sc;
        best = h;
      }
    }
    return bestScore >= 55 ? best : null;
  }

  function collectLabelsFromEntityData(data, qid) {
    var labels = [];
    var entities = data && data.entities;
    if (!entities) return labels;
    var ent = entities[qid];
    if (!ent) return labels;
    if (ent.labels && ent.labels.en && ent.labels.en.value) labels.push(ent.labels.en.value);
    if (ent.aliases && ent.aliases.en) {
      for (var a = 0; a < ent.aliases.en.length; a++) {
        if (ent.aliases.en[a].value) labels.push(ent.aliases.en[a].value);
      }
    }
    var claims = ent.claims || {};
    var keys = Object.keys(claims);
    for (var i = 0; i < keys.length; i++) {
      var propClaims = claims[keys[i]];
      for (var c = 0; c < propClaims.length; c++) {
        var mainsnak = propClaims[c].mainsnak;
        if (!mainsnak || mainsnak.snaktype !== "value" || !mainsnak.datavalue) continue;
        var dv = mainsnak.datavalue;
        if (dv.type === "string" && dv.value) labels.push(dv.value);
        if (dv.type === "wikibase-entityid" && dv.value && dv.value.id) {
          var linked = entities[dv.value.id];
          if (linked && linked.labels && linked.labels.en && linked.labels.en.value) {
            labels.push(linked.labels.en.value);
          }
        }
      }
    }
    return labels;
  }

  function entityData(qid) {
    var url =
      "https://www.wikidata.org/wiki/Special:EntityData/" + encodeURIComponent(qid) + ".json";
    return global.fetch(url).then(function (r) {
      if (!r.ok) throw new Error("entity data failed");
      return r.json();
    });
  }

  /**
   * @returns {Promise<{
   *   itemLabel: string,
   *   itemDescription: string,
   *   qid: string,
   *   url: string,
   *   genreLabels: string[],
   *   themeHits: Array,
   *   scanText: string
   * }|null>}
   */
  function fetchShelfHint(title, author, opts) {
    opts = opts || {};
    var fast = !!opts.fast;
    var t = String(title || "").trim();
    var a = String(author || "").trim();
    if (!t) return Promise.resolve(null);
    var queries = fast
      ? [t + (a ? " " + a : "")]
      : [t + (a ? " " + a : ""), t + " book", t];
    var chain = Promise.resolve(null);
    queries.forEach(function (q) {
      chain = chain.then(function (found) {
        if (found) return found;
        return searchEntities(q).then(function (hits) {
          var hit = pickBestHit(t, a, hits);
          if (!hit || !hit.id) return null;
          return entityData(hit.id).then(function (data) {
            var labels = collectLabelsFromEntityData(data, hit.id);
            var scanText = labels.join(" ");
            var ST = global.HalalitShelfThemes;
            var themeHits = ST && ST.matchTextEvidence ? ST.matchTextEvidence(scanText) : [];
            var genreLike = [];
            for (var i = 0; i < labels.length; i++) {
              var lab = labels[i];
              if (/fiction|literature|comic|manga|novel|fantasy|romance|children|juvenile/i.test(lab)) {
                if (genreLike.indexOf(lab) === -1) genreLike.push(lab);
              }
            }
            return {
              itemLabel: hit.label || t,
              itemDescription: hit.description || "",
              qid: hit.id,
              url: "https://www.wikidata.org/wiki/" + hit.id,
              genreLabels: genreLike.slice(0, 12),
              themeHits: themeHits,
              scanText: scanText,
            };
          });
        });
      });
    });
    return chain.catch(function () {
      return null;
    });
  }

  global.HalalitWikidataShelfHint = {
    fetchShelfHint: fetchShelfHint,
  };
})(typeof window !== "undefined" ? window : this);
