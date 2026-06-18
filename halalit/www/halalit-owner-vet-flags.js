/**
 * Halalit — owner on-site vet flag checkboxes (shared with Bookcheck / Book Quest).
 */
(function (global) {
  var FLAG_DEFS = [
    { key: "requiresMagicOptIn", label: "Magic opt-in (Book Quest & Bookcheck)" },
    { key: "requiresDeityMythologyOptIn", label: "Deity / mythology opt-in" },
    { key: "requiresLightRomanceOptIn", label: "Light romance opt-in" },
    { key: "requiresSubstanceOptIn", label: "Alcohol / drug mentions opt-in" },
    { key: "requiresCulturalMisrepresentationOptIn", label: "Cultural misrepresentation opt-in" },
    { key: "negativeFamilyPortrayal", label: "Negative family portrayal (parent note)" },
    { key: "requiresIslamicLiteratureInterest", label: "Islamic-literature interest shelf" },
    { key: "excludesBookQuest", label: "Off Book Quest (hand-checked but don’t suggest)" },
  ];

  function flagsHtml(idPrefix) {
    var id = idPrefix || "ownerVet";
    var parts = ['<p class="owner-vet-flags-lead muted">Same flags as code hand-vets—readers only see them if their settings allow.</p>'];
    for (var i = 0; i < FLAG_DEFS.length; i++) {
      var f = FLAG_DEFS[i];
      var slug = f.key.replace(/^requires/, "").replace(/OptIn$/, "");
      parts.push(
        '<label><input type="checkbox" id="' +
          id +
          "Flag" +
          slug +
          '" data-vet-flag="' +
          f.key +
          '" /> ' +
          f.label +
          "</label>"
      );
    }
    return parts.join("");
  }

  function readFlags(root, idPrefix) {
    var id = idPrefix || "ownerVet";
    var wrap = root.querySelector("#" + id + "FlagsWrap");
    if (!wrap) return {};
    var out = {};
    var boxes = wrap.querySelectorAll("[data-vet-flag]");
    for (var i = 0; i < boxes.length; i++) {
      var key = boxes[i].getAttribute("data-vet-flag");
      if (key) out[key] = !!boxes[i].checked;
    }
    return out;
  }

  function writeFlags(root, idPrefix, flags) {
    var id = idPrefix || "ownerVet";
    var wrap = root.querySelector("#" + id + "FlagsWrap");
    if (!wrap || !flags) return;
    var boxes = wrap.querySelectorAll("[data-vet-flag]");
    for (var i = 0; i < boxes.length; i++) {
      var key = boxes[i].getAttribute("data-vet-flag");
      boxes[i].checked = !!(key && flags[key]);
    }
  }

  global.HalalitOwnerVetFlags = {
    FLAG_DEFS: FLAG_DEFS,
    flagsHtml: flagsHtml,
    readFlags: readFlags,
    writeFlags: writeFlags,
  };
})(typeof window !== "undefined" ? window : this);
