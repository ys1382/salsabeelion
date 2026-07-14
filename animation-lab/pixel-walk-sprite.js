/**
 * Reusable pixel walk sheet: 4 directions × 4 frames (16×24 each).
 * Drawn on canvas → Phaser texture. Tweak drawCharFrame for any character.
 */
(function (global) {
  const CHAR_W = 16;
  const CHAR_H = 24;
  const CHAR_FRAMES = 4;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function px(ctx, ox, oy, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x, oy + y, 1, 1);
  }

  function tri(ctx, ox, oy, x1, y1, x2, y2, x3, y3, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ox + x1, oy + y1);
    ctx.lineTo(ox + x2, oy + y2);
    ctx.lineTo(ox + x3, oy + y3);
    ctx.closePath();
    ctx.fill();
  }

  function wingRoot(ctx, ox, oy, x, y, color) {
    px(ctx, ox, oy, x, y, color);
    px(ctx, ox, oy, x + 1, y, color);
    px(ctx, ox, oy, x, y + 1, color);
  }

  /** Soft rounded shape with simple shading. */
  function drawSegment(ctx, ox, oy, x, y, w, h, base, light, dark) {
    rect(ctx, ox + x, oy + y, w, h, base);
    if (w > 2 && h > 2) {
      rect(ctx, ox + x + 1, oy + y, w - 2, 1, light);
      px(ctx, ox, oy, x, y, light);
      rect(ctx, ox + x, oy + y + h - 1, w, 1, dark);
    }
  }

  function drawStripesH(ctx, ox, oy, x, y, w, h) {
    const Y = '#f0c830';
    const YL = '#ffe878';
    const BK = '#1a1410';
    drawSegment(ctx, ox, oy, x, y, w, h, Y, YL, '#c8a018');
    for (let sy = y + 1; sy < y + h - 1; sy += 2) {
      rect(ctx, ox + x + 1, oy + sy, Math.max(1, w - 2), 1, BK);
    }
  }

  /** Side profile — ring stripes run along the body length. */
  function drawStripesV(ctx, ox, oy, x, y, w, h) {
    const Y = '#f0c830';
    const YL = '#ffe878';
    const BK = '#1a1410';
    drawSegment(ctx, ox, oy, x, y, w, h, Y, YL, '#c8a018');
    for (let sx = x + 1; sx < x + w - 1; sx += 2) {
      rect(ctx, ox + sx, oy + y + 1, 1, Math.max(1, h - 2), BK);
    }
  }

  /** Symmetric oval taper — same inset on left and right per band. */
  function drawBeeBodyVertical(ctx, ox, oy, y0, bands) {
    const TH = '#f0c830';
    const THL = '#ffe060';
    const BK = '#1a1410';
    bands.forEach((band) => {
      const x = 8 - Math.floor(band.w / 2);
      if (band.kind === 'stripe') {
        drawStripesH(ctx, ox, oy, x, y0 + band.y, band.w, band.h);
      } else if (band.kind === 'thorax') {
        drawSegment(ctx, ox, oy, x, y0 + band.y, band.w, band.h, TH, THL, '#c8a018');
        const stripeX = x + 1;
        const stripeW = Math.max(1, band.w - 2);
        rect(ctx, ox + stripeX, oy + y0 + band.y + Math.floor(band.h / 2), stripeW, 1, BK);
      } else if (band.kind === 'stinger') {
        drawSegment(ctx, ox, oy, x, y0 + band.y, band.w, band.h, BK, '#2a2018', '#0a0808');
        px(ctx, ox, oy, 8, y0 + band.y - 1, BK);
      }
      if (band.round) {
        const top = y0 + band.y;
        const bottom = top + band.h - 1;
        const left = x;
        const right = x + band.w - 1;
        px(ctx, ox, oy, left - 1, top, band.roundColor || '#f0c830');
        px(ctx, ox, oy, right + 1, top, band.roundColor || '#f0c830');
        px(ctx, ox, oy, left - 1, bottom, band.roundColor || '#c8a018');
        px(ctx, ox, oy, right + 1, bottom, band.roundColor || '#c8a018');
      }
    });
  }

  function drawBeeHeadVertical(ctx, ox, oy, y, facingDown) {
    const HD = '#2a2018';
    const HDL = '#3a3028';
    const x = 3;
    const w = 10;
    drawSegment(ctx, ox, oy, x, y, w, 6, HD, HDL, '#1a1008');
    px(ctx, ox, oy, x - 1, y, HD);
    px(ctx, ox, oy, x + w, y, HD);
    px(ctx, ox, oy, x - 1, y + 1, HD);
    px(ctx, ox, oy, x + w, y + 1, HD);
    if (facingDown) {
      rect(ctx, ox + 5, oy + y + 3, 2, 2, '#0a0810');
      rect(ctx, ox + 9, oy + y + 3, 2, 2, '#0a0810');
      px(ctx, ox, oy, 5, y + 3, '#ffffff');
      px(ctx, ox, oy, 9, y + 3, '#ffffff');
      rect(ctx, ox + 7, oy + y + 5, 2, 1, '#1a3040');
      px(ctx, ox, oy, 5, y + 6, '#1a1410');
      px(ctx, ox, oy, 10, y + 6, '#1a1410');
    } else {
      rect(ctx, ox + 5, oy + y + 1, 6, 2, '#1a1810');
      px(ctx, ox, oy, 4, y + 2, HD);
      px(ctx, ox, oy, 11, y + 2, HD);
    }
    rect(ctx, ox + x, oy + y + 6, w, 1, 'rgba(0,0,0,0.25)');
  }

  /**
   * Flying south — head at bottom; body bands centered on x=8.
   */
  function drawBeeFlyingDown(ctx, ox, oy) {
    drawBeeBodyVertical(ctx, ox, oy, 0, [
      { y: 1, w: 4, h: 3, kind: 'stinger' },
      { y: 4, w: 8, h: 4, kind: 'stripe', round: true },
      { y: 8, w: 6, h: 4, kind: 'stripe', round: true },
      { y: 12, w: 6, h: 4, kind: 'thorax' },
    ]);
    drawBeeHeadVertical(ctx, ox, oy, 16, true);
  }

  /**
   * Flying north — head at top; same symmetric body, flipped stack.
   */
  function drawBeeFlyingUp(ctx, ox, oy) {
    drawBeeHeadVertical(ctx, ox, oy, 1, false);
    drawBeeBodyVertical(ctx, ox, oy, 0, [
      { y: 7, w: 6, h: 4, kind: 'thorax' },
      { y: 11, w: 8, h: 4, kind: 'stripe', round: true },
      { y: 15, w: 6, h: 4, kind: 'stripe', round: true },
      { y: 19, w: 4, h: 3, kind: 'stinger' },
    ]);
    px(ctx, ox, oy, 5, 22, '#1a1410');
    px(ctx, ox, oy, 10, 22, '#1a1410');
    rect(ctx, ox + 4, oy + 23, 8, 1, 'rgba(0,0,0,0.25)');
  }

  function drawBeeBodySide(ctx, ox, oy, facingLeft) {
    if (facingLeft) {
      drawStripesV(ctx, ox, oy, 4, 8, 5, 6);
      drawStripesV(ctx, ox, oy, 8, 8, 5, 6);
      drawStripesV(ctx, ox, oy, 11, 9, 4, 5);
      drawSegment(ctx, ox, oy, 13, 10, 3, 4, '#1a1410', '#2a2018', '#0a0808');
      px(ctx, ox, oy, 5, 14, '#1a1410');
      px(ctx, ox, oy, 8, 14, '#1a1410');
      px(ctx, ox, oy, 11, 14, '#1a1410');
    } else {
      drawStripesV(ctx, ox, oy, 7, 8, 5, 6);
      drawStripesV(ctx, ox, oy, 3, 8, 5, 6);
      drawStripesV(ctx, ox, oy, 1, 9, 4, 5);
      drawSegment(ctx, ox, oy, 0, 10, 3, 4, '#1a1410', '#2a2018', '#0a0808');
      px(ctx, ox, oy, 10, 14, '#1a1410');
      px(ctx, ox, oy, 7, 14, '#1a1410');
      px(ctx, ox, oy, 4, 14, '#1a1410');
    }
    rect(ctx, ox + 3, oy + 21, 10, 1, 'rgba(0,0,0,0.25)');
  }

  function drawBeeHeadSide(ctx, ox, oy, facingLeft) {
    const HD = '#2a2018';
    const HDL = '#3a3028';
    if (facingLeft) {
      drawSegment(ctx, ox, oy, 0, 7, 5, 6, HD, HDL, '#1a1008');
      rect(ctx, ox + 2, oy + 10, 2, 2, '#0a0810');
      px(ctx, ox, oy, 2, 10, '#ffffff');
      px(ctx, ox, oy, 0, 6, HD);
      px(ctx, ox, oy, 1, 5, HD);
      px(ctx, ox, oy, 2, 5, HD);
    } else {
      drawSegment(ctx, ox, oy, 11, 7, 5, 6, HD, HDL, '#1a1008');
      rect(ctx, ox + 12, oy + 10, 2, 2, '#0a0810');
      px(ctx, ox, oy, 13, 10, '#ffffff');
      px(ctx, ox, oy, 14, 6, HD);
      px(ctx, ox, oy, 13, 5, HD);
      px(ctx, ox, oy, 12, 5, HD);
    }
  }

  function drawCharFrame(ctx, fx, fy, dir, frame) {
    const ox = fx * CHAR_W;
    const oy = fy * CHAR_H;

    ctx.clearRect(ox, oy, CHAR_W, CHAR_H);

    if (dir === 0) {
      drawWingsVertical(ctx, ox, oy, frame, 14);
      drawBeeFlyingDown(ctx, ox, oy);
    } else if (dir === 1) {
      drawWingsSide(ctx, ox, oy, true, frame);
      drawBeeHeadSide(ctx, ox, oy, true);
      drawBeeBodySide(ctx, ox, oy, true);
    } else if (dir === 2) {
      drawWingsSide(ctx, ox, oy, false, frame);
      drawBeeHeadSide(ctx, ox, oy, false);
      drawBeeBodySide(ctx, ox, oy, false);
    } else {
      drawWingsVertical(ctx, ox, oy, frame, 9);
      drawBeeFlyingUp(ctx, ox, oy);
    }
  }

  /**
   * Front/back wings — one big triangle per side, flap by spreading wide/narrow.
   * Drawn behind the body so stripes stay visible; lobes extend past the thorax.
   */
  function drawWingsVertical(ctx, ox, oy, frame, thoraxY) {
    const up = '#eef8ff';
    const mid = '#c8e4f8';
    const down = '#a8cce8';
    const edge = '#5090c0';
    const p = frame % 4;
    const ty = thoraxY;

    const shapes = [
      {
        l: [[4, ty], [0, 1], [2, ty + 4]],
        r: [[11, ty], [15, 1], [13, ty + 4]],
        c: up,
      },
      {
        l: [[5, ty], [1, ty - 2], [2, ty + 3]],
        r: [[10, ty], [14, ty - 2], [13, ty + 3]],
        c: mid,
      },
      {
        l: [[4, ty], [0, ty + 5], [2, 21]],
        r: [[11, ty], [15, ty + 5], [13, 21]],
        c: down,
      },
      {
        l: [[5, ty], [1, ty + 2], [2, ty - 2]],
        r: [[10, ty], [14, ty + 2], [13, ty - 2]],
        c: mid,
      },
    ];
    const s = shapes[p];

    tri(ctx, ox, oy, s.l[0][0], s.l[0][1], s.l[1][0], s.l[1][1], s.l[2][0], s.l[2][1], s.c);
    tri(ctx, ox, oy, s.r[0][0], s.r[0][1], s.r[1][0], s.r[1][1], s.r[2][0], s.r[2][1], s.c);
    px(ctx, ox, oy, s.l[1][0], s.l[1][1], edge);
    px(ctx, ox, oy, s.l[2][0], s.l[2][1], edge);
    px(ctx, ox, oy, s.r[1][0], s.r[1][1], edge);
    px(ctx, ox, oy, s.r[2][0], s.r[2][1], edge);
    wingRoot(ctx, ox, oy, 3, ty - 1, mid);
    wingRoot(ctx, ox, oy, 11, ty - 1, mid);
  }

  function drawWingsSide(ctx, ox, oy, facingLeft, frame) {
    const up = '#eef8ff';
    const mid = '#c8e4f8';
    const down = '#a8cce8';
    const edge = '#5090c0';
    const p = frame % 4;
    const ay = 10;

    if (facingLeft) {
      const ax = 6;
      const shapes = [
        { pts: [[ax, ay], [0, 1], [14, 2]], c: up },
        { pts: [[ax, ay], [1, 4], [13, 5]], c: mid },
        { pts: [[ax, ay], [2, 14], [13, 12]], c: down },
        { pts: [[ax, ay], [1, 7], [12, 7]], c: mid },
      ];
      const s = shapes[p];
      tri(ctx, ox, oy, s.pts[0][0], s.pts[0][1], s.pts[1][0], s.pts[1][1], s.pts[2][0], s.pts[2][1], s.c);
      px(ctx, ox, oy, s.pts[1][0], s.pts[1][1], edge);
      px(ctx, ox, oy, s.pts[2][0], s.pts[2][1], edge);
      wingRoot(ctx, ox, oy, ax - 1, ay - 1, mid);
    } else {
      const ax = 9;
      const shapes = [
        { pts: [[ax, ay], [15, 1], [2, 2]], c: up },
        { pts: [[ax, ay], [14, 4], [3, 5]], c: mid },
        { pts: [[ax, ay], [13, 14], [3, 12]], c: down },
        { pts: [[ax, ay], [14, 7], [4, 7]], c: mid },
      ];
      const s = shapes[p];
      tri(ctx, ox, oy, s.pts[0][0], s.pts[0][1], s.pts[1][0], s.pts[1][1], s.pts[2][0], s.pts[2][1], s.c);
      px(ctx, ox, oy, s.pts[1][0], s.pts[1][1], edge);
      px(ctx, ox, oy, s.pts[2][0], s.pts[2][1], edge);
      wingRoot(ctx, ox, oy, ax - 2, ay - 1, mid);
    }
  }

  function drawGrassTile(ctx, ox, oy, variant) {
    const base = variant === 1 ? '#4a7c3f' : '#3d6b35';
    rect(ctx, ox, oy, 32, 32, base);
    const details = variant === 1
      ? [[4, 5], [12, 20], [24, 8], [28, 18], [8, 26]]
      : [[6, 10], [18, 4], [10, 22], [26, 14], [20, 28]];
    details.forEach(([dx, dy]) => {
      ctx.fillStyle = '#5a9c4f';
      ctx.fillRect(ox + dx, oy + dy, 1, 1);
      ctx.fillRect(ox + dx + 1, oy + dy, 1, 1);
    });
  }

  function buildPlayerTexture(scene) {
    const c = makeCanvas(CHAR_W * CHAR_FRAMES, CHAR_H * 4);
    const ctx = c.getContext('2d');
    for (let dir = 0; dir < 4; dir++) {
      for (let frame = 0; frame < CHAR_FRAMES; frame++) {
        drawCharFrame(ctx, frame, dir, dir, frame);
      }
    }
    scene.textures.addCanvas('player', c);
    const tex = scene.textures.get('player');
    const dirNames = ['down', 'left', 'right', 'up'];
    dirNames.forEach((dirName, dir) => {
      for (let i = 0; i < CHAR_FRAMES; i++) {
        tex.add(`${dirName}${i}`, 0, CHAR_W * i, dir * CHAR_H, CHAR_W, CHAR_H);
      }
    });
  }

  function buildGrassTexture(scene, key, variant) {
    const c = makeCanvas(32, 32);
    drawGrassTile(c.getContext('2d'), 0, 0, variant);
    scene.textures.addCanvas(key, c);
  }

  global.PixelWalkSprite = {
    CHAR_W,
    CHAR_H,
    CHAR_FRAMES,
    drawCharFrame,
    buildPlayerTexture,
    buildGrassTexture,
  };
})(window);
