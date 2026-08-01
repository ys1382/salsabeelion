(function (global) {
  var LABELS = {
    non_married_romance: "Non-married romance / dating plot",
    violence_fright: "Violence, gore, or intense fright",
    profanity_substance: "Profanity, drugs, or alcohol push",
    adult_sexual: "Adult sexual content / fanservice",
    sacred_or_other_faith: "Other-faith worship or casual sacred language",
  };

  function themeLabel(id) {
    return LABELS[id] || id;
  }

  function recHintLabel(hint) {
    if (hint === "likely_ok") return "Likely OK for strict rec list";
    if (hint === "likely_no_recommend") return "Likely not for rec list";
    return "Caution — preview before recommending";
  }

  global.HalalFlicksPolicy = {
    themeLabel: themeLabel,
    recHintLabel: recHintLabel,
  };
})(typeof window !== "undefined" ? window : this);
