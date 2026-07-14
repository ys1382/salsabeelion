(function (global) {
  var LABELS = {
    non_married_romance: "Non-married romance",
    non_muslim_religious: "Non-Muslim religious music",
    sacred_language_casual: "Casual sacred language (god / hell / devil)",
    dark_despair: "Mental-health despair (not just spooky vibes)",
    profanity_substance: "Profanity, drugs, or suggestive body-heat (metaphor counts)",
  };

  function themeLabel(id) {
    return LABELS[id] || id;
  }

  function recHintLabel(hint) {
    if (hint === "likely_ok") return "Likely OK for strict rec list";
    if (hint === "likely_no_recommend") return "Likely not for rec list";
    return "Caution — preview before recommending";
  }

  global.HalaLyricsPolicy = {
    themeLabel: themeLabel,
    recHintLabel: recHintLabel,
  };
})(typeof window !== "undefined" ? window : this);
