/**
 * Halalit — small framed reading-nook illustration (Personal Library only).
 * Kept separate from the CSS shelf wall so it is not a stretched full-bleed “wallpaper” layer.
 */
(function (global) {
  var SCENE_PROMPT_VERSION = "v5";
  /** 4:3 — displayed with object-fit:contain so layout never stretches the figure wide. */
  var PIXEL_W = 720;
  var PIXEL_H = 540;

  var HALALIT_LIBRARY_STYLE =
    "Flat graphic illustration matte gouache or editorial print look cohesive with simple UI props, " +
    "clean shapes limited palette walnut burgundy cream dusty rose amber lamp glow, " +
    "soft cel shading minimal outlines no photoreal skin no glossy 3D render no hyperdetail no cinematic lens blur, " +
    "calm slice-of-life all-ages family-friendly, single readable focal scene not a panoramic wallpaper";

  function hash32(str) {
    var h = 2166136261;
    var s = String(str || "");
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readerPhrase() {
    var Look = global.HalalitReaderLook;
    if (!Look || typeof Look.load !== "function") {
      return "reader in modest long-sleeved layered clothing";
    }
    var o = Look.load();
    var parts = [];
    if (o.skinTone) parts.push(o.skinTone);
    if (o.hair) parts.push(o.hair);
    if (o.outfit) parts.push(o.outfit);
    if (parts.length) return parts.join(", ");
    return "reader in modest long-sleeved layered clothing in calm colors";
  }

  function modestyClause() {
    var Look = global.HalalitReaderLook;
    if (Look && typeof Look.modestyClauseForArt === "function") return Look.modestyClauseForArt();
    return "modest dress long sleeves full length only face head and hands show skin";
  }

  function seedMaterial() {
    var Look = global.HalalitReaderLook;
    var updated = "";
    if (Look && typeof Look.load === "function") {
      var o = Look.load();
      updated = o.updatedAt || "";
    }
    return SCENE_PROMPT_VERSION + "|" + readerPhrase() + "|" + updated;
  }

  function buildSubjectPrompt() {
    return (
      "One framed illustration of a cozy reading nook not edge-to-edge wallpaper: " +
      "one adult " +
      readerPhrase() +
      " sitting in wingback armchair reading an open book, centered composition medium shot, " +
      "simple warm wall or subtle damask behind chair no bookshelves no book spines no titles no shelf clutter " +
      "(the real book collection is separate UI above this image), " +
      "small wooden side table with golden reading lamp, shallow room depth, no cat no animals"
    );
  }

  function buildFullPrompt() {
    return buildSubjectPrompt() + ". " + HALALIT_LIBRARY_STYLE + ". " + modestyClause();
  }

  function buildPollinationsUrl() {
    var maxLen = 1400;
    var p = buildFullPrompt();
    if (p.length > maxLen) p = p.slice(0, maxLen);
    var seed = hash32(seedMaterial()) % 2000000000 || 1;
    var path = "https://image.pollinations.ai/prompt/" + encodeURIComponent(p);
    return (
      path +
      "?width=" +
      String(PIXEL_W) +
      "&height=" +
      String(PIXEL_H) +
      "&model=flux&nologo=true&enhance=false&seed=" +
      encodeURIComponent(String(seed))
    );
  }

  function paintImgAttrs() {
    return (
      'src="' +
      escapeAttr(buildPollinationsUrl()) +
      '" alt="" width="' +
      String(PIXEL_W) +
      '" height="' +
      String(PIXEL_H) +
      '" decoding="async" loading="lazy" referrerpolicy="no-referrer" ' +
      'onload="var d=this.closest(&#39;.library-diorama&#39;);if(d)d.classList.add(&#39;library-diorama--has-paint&#39;);" ' +
      'onerror="var d=this.closest(&#39;.library-diorama&#39;);if(d){d.classList.remove(&#39;library-diorama--has-paint&#39;);}var f=this.closest(&#39;.library-reader-nook__frame&#39;);if(f)f.remove();"'
    );
  }

  /** Framed panel inside `.library-reader-nook` — never full-bleed behind spines. */
  function readerNookPaintHtml() {
    return (
      '<div class="library-reader-nook__frame" role="img" aria-label="Illustration of your reader in a reading nook">' +
      '<div class="library-reader-nook__paint">' +
      "<img " +
      paintImgAttrs() +
      " />" +
      "</div>" +
      "</div>"
    );
  }

  /** @deprecated Personal Library uses readerNookPaintHtml only. */
  function ambientPaintHtml() {
    return readerNookPaintHtml();
  }

  global.HalalitLibraryScene = {
    readerNookPaintHtml: readerNookPaintHtml,
    ambientPaintHtml: ambientPaintHtml,
    buildPollinationsUrl: buildPollinationsUrl,
    seedMaterial: seedMaterial,
  };
})(typeof window !== "undefined" ? window : this);
