/**
 * Halalit Bookcheck — Google Gemini theme scan (server-side API).
 */
(function (global) {
  var EXCLUDE_FROM_AI_BLOB = {
    sexual_content: true,
    graphic_format: true,
  };

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
      if (!row.present || EXCLUDE_FROM_AI_BLOB[row.id]) continue;
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
      var line = "AI scan: " + themeLabel(row.id);
      if (row.confidence && row.confidence !== "unknown") line += " (" + row.confidence + " confidence)";
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
          data = data || {};
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

  global.HalalitBookcheckAi = {
    fetchThemeScan: fetchThemeScan,
    fetchCoverIdentify: fetchCoverIdentify,
    buildAiSupplementText: buildAiSupplementText,
    appendAiSignals: appendAiSignals,
  };
})(typeof window !== "undefined" ? window : this);
