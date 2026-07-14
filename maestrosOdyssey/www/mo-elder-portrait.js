/**
 * Gender-matched community elder portrait for prologue (#10).
 * Same 16×24 pixel grammar as protagonist sprites; modest dress only.
 */
(function () {
  "use strict";

  var CHAR_W = 16;
  var CHAR_H = 24;
  var SCALE = 4;

  function px(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function isMaleLook(look) {
    return look === "man_short" || look === "man_kufi";
  }

  /** Front-facing elder male — kufi and thobe, silver at temples. */
  function drawElderMale(ctx, ox, oy) {
    var skin = "#e0c8a8";
    var thobe = "#ece6dc";
    var thobeShade = "#d4ccc0";
    var kufi = "#e8e4dc";
    var kufiLine = "#b8b0a4";
    var silver = "#b0a898";
    var shoe = "#3a3028";

    rect(ctx, ox + 3, oy + 18, 10, 6, thobeShade);
    rect(ctx, ox + 3, oy + 21, 4, 3, shoe);
    rect(ctx, ox + 9, oy + 21, 4, 3, shoe);
    rect(ctx, ox + 2, oy + 10, 12, 9, thobe);
    rect(ctx, ox + 1, oy + 10, 2, 7, thobe);
    rect(ctx, ox + 13, oy + 10, 2, 7, thobe);
    rect(ctx, ox + 3, oy + 2, 10, 9, skin);
    rect(ctx, ox + 3, oy + 1, 10, 2, kufi);
    rect(ctx, ox + 4, oy + 2, 8, 1, kufiLine);
    rect(ctx, ox + 2, oy + 4, 1, 4, silver);
    rect(ctx, ox + 13, oy + 4, 1, 4, silver);
    rect(ctx, ox + 5, oy + 7, 2, 2, "#1a0a00");
    rect(ctx, ox + 9, oy + 7, 2, 2, "#1a0a00");
    rect(ctx, ox + 6, oy + 10, 4, 1, "#a88870");
    rect(ctx, ox + 5, oy + 11, 6, 1, silver);
    rect(ctx, ox + 4, oy + 23, 8, 1, "rgba(0,0,0,0.3)");
  }

  /** Front-facing elder female — same hijab/jilbab silhouette as protagonist. */
  function drawElderFemale(ctx, ox, oy) {
    if (window.MoWomanJilbabDraw && typeof window.MoWomanJilbabDraw.drawFrontPortrait === "function") {
      window.MoWomanJilbabDraw.drawFrontPortrait(ctx, ox, oy, {
        skin: "#e0c8a8",
        lip: "#a88870",
      });
      return;
    }
    var skin = "#e0c8a8";
    var hijab = "#6a7888";
    var hijabDark = "#5a6878";
    var jilbab = "#4a5668";
    var jilbabLight = "#7a8898";
    var jilbabDark = "#3a4450";
    var shoe = "#2a3040";
    var lip = "#a88870";

    rect(ctx, ox + 3, oy + 10, 10, 2, jilbab);
    rect(ctx, ox + 2, oy + 12, 11, 4, jilbab);
    rect(ctx, ox + 1, oy + 16, 13, 3, jilbab);
    rect(ctx, ox + 8, oy + 11, 1, 9, jilbabDark);
    rect(ctx, ox + 1, oy + 11, 2, 8, jilbabLight);
    rect(ctx, ox + 13, oy + 11, 2, 8, jilbabLight);
    rect(ctx, ox + 1, oy + 19, 14, 1, jilbab);
    rect(ctx, ox + 3, oy + 20, 4, 3, shoe);
    rect(ctx, ox + 9, oy + 20, 4, 3, shoe);
    px(ctx, ox + 3, oy + 1, hijab);
    rect(ctx, ox + 4, oy + 1, 8, 1, hijab);
    px(ctx, ox + 12, oy + 1, hijab);
    rect(ctx, ox + 3, oy + 2, 10, 1, hijab);
    rect(ctx, ox + 2, oy + 3, 2, 8, hijab);
    rect(ctx, ox + 12, oy + 3, 2, 8, hijab);
    rect(ctx, ox + 5, oy + 4, 6, 1, hijab);
    px(ctx, ox + 4, oy + 4, hijabDark);
    px(ctx, ox + 11, oy + 4, hijabDark);
    rect(ctx, ox + 6, oy + 5, 5, 1, skin);
    rect(ctx, ox + 5, oy + 6, 7, 1, skin);
    rect(ctx, ox + 5, oy + 7, 7, 4, skin);
    rect(ctx, ox + 6, oy + 11, 5, 1, skin);
    rect(ctx, ox + 6, oy + 7, 2, 2, "#1a0a00");
    rect(ctx, ox + 9, oy + 7, 2, 2, "#1a0a00");
    px(ctx, ox + 7, oy + 10, lip);
    px(ctx, ox + 9, oy + 10, lip);
    rect(ctx, ox + 7, oy + 11, 3, 1, lip);
    rect(ctx, ox + 4, oy + 23, 8, 1, "rgba(0,0,0,0.3)");
  }

  function drawToCanvas(canvas, look) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var w = CHAR_W * SCALE;
    var h = CHAR_H * SCALE;
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(SCALE, SCALE);
    if (isMaleLook(look)) {
      drawElderMale(ctx, 0, 0);
    } else {
      drawElderFemale(ctx, 0, 0);
    }
    ctx.restore();
  }

  function refreshPortraitElement(el, look) {
    if (!el) return;
    look = look || (window.MoProtagonistLook && window.MoProtagonistLook.getLook
      ? window.MoProtagonistLook.getLook() : "man_short");
    drawToCanvas(el, look);
  }

  window.MoElderPortrait = {
    isMaleLook: isMaleLook,
    drawToCanvas: drawToCanvas,
    refreshPortraitElement: refreshPortraitElement
  };
})();
