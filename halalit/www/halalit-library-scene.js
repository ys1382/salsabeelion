/**
 * Halalit — painted Personal Library background (reader in chair) behind CSS book spines.
 * Uses home-page reader look when set; same art mood as Book Quest; no cat.
 */
(function (global) {
  var SCENE_PROMPT_VERSION = "v3";
  var PIXEL_W = 1024;
  var PIXEL_H = 576;

  var HALALIT_LIBRARY_STYLE =
    "Warm Halalit library mood walnut amber golden lamplight wood shelves cozy scholarly hush, soft stylized cinematic illustration calm slice-of-life, gentle anime-influenced linework normal realistic eye size not chibi not huge cartoon eyes, simplified symmetric faces medium-wide shot, burgundy cream dusty rose muted palette painterly shading, all-ages family-friendly, no photoreal skin texture no hyperdetail no glossy CGI";

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
      "Wide cozy private library interior composition for a book game UI overlay: " +
      "left two-thirds empty wooden bookshelf with bare horizontal ledges completely empty no books no spines no titles no objects on shelves, " +
      "right third one adult " +
      readerPhrase() +
      " sitting in wingback armchair holding open book reading, no cat no animals, " +
      "soft golden table lamp glow walnut wood, clear separation between empty shelf zone and reader zone"
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

  /** Inside `.library-diorama__ambient`, behind lamp glow. */
  function ambientPaintHtml() {
    var url = buildPollinationsUrl();
    return (
      '<div class="library-diorama__painted" aria-hidden="true">' +
      '<img src="' +
      escapeAttr(url) +
      '" alt="" width="' +
      String(PIXEL_W) +
      '" height="' +
      String(PIXEL_H) +
      '" decoding="async" loading="lazy" referrerpolicy="no-referrer" ' +
      'onload="var d=this.closest(&#39;.library-diorama&#39;);if(d)d.classList.add(&#39;library-diorama--has-paint&#39;);" ' +
      'onerror="var d=this.closest(&#39;.library-diorama&#39;);if(d){d.classList.remove(&#39;library-diorama--has-paint&#39;);}var p=this.parentElement;if(p)p.remove();" />' +
      "</div>"
    );
  }

  global.HalalitLibraryScene = {
    ambientPaintHtml: ambientPaintHtml,
    buildPollinationsUrl: buildPollinationsUrl,
    seedMaterial: seedMaterial,
  };
})(typeof window !== "undefined" ? window : this);
