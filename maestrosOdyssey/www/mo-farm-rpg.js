// ─────────────────────────────────────────────────────────────────────────────
//  Web Audio engine  (chiptune music + SFX, no external files)
// ─────────────────────────────────────────────────────────────────────────────
const Audio = (() => {
  let ctx = null;
  let masterGain = null;
  let musicTimeout = null;
  let musicPlaying = false;
  let stepTime = 0;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(ctx.destination);
  }

  function tone(freq, type, startTime, duration, vol = 1, env = true) {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (env) {
      g.gain.setValueAtTime(0, startTime);
      g.gain.linearRampToValueAtTime(vol, startTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    } else {
      g.gain.setValueAtTime(vol, startTime);
      g.gain.linearRampToValueAtTime(0, startTime + duration);
    }
    osc.connect(g);
    g.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  // Simple chiptune — pentatonic melody in C: C D E G A
  const SCALE = [261.63, 293.66, 329.63, 392.00, 440.00,
                 523.25, 587.33, 659.25, 783.99, 880.00];
  const MELODY = [4,2,0,2,4,4,4, 2,2,2, 4,7,7, 4,2,0,2,4,4,4,4,2,2,4,2,0];
  const BASS   = [0,0,4,0,0,4,4, 0,0,4, 0,4,4, 0,0,4,0,0,4,4,0,0,4,0,0];
  const DUR    = 0.18; // seconds per note

  function playMusicBeat(step) {
    if (!musicPlaying) return;
    const t = ctx.currentTime + 0.05;
    const mi = step % MELODY.length;
    tone(SCALE[MELODY[mi]],          'square',   t, DUR * 0.8, 0.6);
    tone(SCALE[MELODY[mi]] * 1.005,  'square',   t, DUR * 0.8, 0.3); // slight detune
    tone(SCALE[BASS[mi]] / 2,        'triangle', t, DUR * 0.9, 0.5);
    // hi-hat on even beats
    if (step % 2 === 0) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.15;
      const src = ctx.createBufferSource();
      const g2  = ctx.createGain();
      src.buffer = buf;
      g2.gain.setValueAtTime(0.4, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      src.connect(g2);
      g2.connect(masterGain);
      src.start(t);
    }
    musicTimeout = setTimeout(() => playMusicBeat(step + 1), DUR * 1000);
  }

  function startMusic() {
    if (musicPlaying) return;
    musicPlaying = true;
    playMusicBeat(0);
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicTimeout) clearTimeout(musicTimeout);
  }

  function sfxStep() {
    const now = ctx.currentTime;
    if (now - stepTime < 0.22) return; // throttle
    stepTime = now;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * 0.3;
    const src = ctx.createBufferSource();
    const g   = ctx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(0.6, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    src.connect(g);
    g.connect(masterGain);
    src.start(now);
  }

  function sfxInteract() {
    const t = ctx.currentTime;
    tone(523.25, 'square', t,        0.08, 0.7);
    tone(659.25, 'square', t + 0.08, 0.08, 0.7);
    tone(783.99, 'square', t + 0.16, 0.15, 0.7);
  }

  function sfxClose() {
    const t = ctx.currentTime;
    tone(392.00, 'triangle', t,       0.07, 0.5);
    tone(329.63, 'triangle', t + 0.07, 0.07, 0.5);
  }

  return { init, startMusic, stopMusic, sfxStep, sfxInteract, sfxClose };
})();

// ─────────────────────────────────────────────────────────────────────────────
//  Pixel art constants
// ─────────────────────────────────────────────────────────────────────────────
const TILE   = 32;   // pixels per tile
const COLS   = 20;
const ROWS   = 16;
const W      = TILE * COLS;
const H      = TILE * ROWS;
const SCALE  = 2;   // pixel-art upscale
const DIALOGUE_MARGIN = 40;
const DIALOGUE_PAD_X = 40;
const DIALOGUE_TEXT_PAD_Y = 18;
const DIALOGUE_TEXT_SLACK = 18;
const DIALOGUE_MIN_H = 96;
const DIALOGUE_TOP_CLEARANCE = 72;
const DIALOGUE_BASE_FONT = 17;
const DIALOGUE_MIN_FONT = 12;
const DIALOGUE_LINE_HEIGHT = 26;
const DIALOGUE_ORDER_BOX_H = 54;

// ─────────────────────────────────────────────────────────────────────────────
//  Pixel drawing helpers  (draws onto an offscreen canvas → Phaser texture)
// ─────────────────────────────────────────────────────────────────────────────
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// Draw a single grass tile  (32×32)
function drawGrass(ctx, ox, oy, variant) {
  const base = variant === 1 ? '#4a7c3f' : '#3d6b35';
  rect(ctx, ox, oy, 32, 32, base);
  // small detail tufts
  const details = variant === 1
    ? [[4,5],[12,20],[24,8],[28,18],[8,26]]
    : [[6,10],[18,4],[10,22],[26,14],[20,28]];
  details.forEach(([dx, dy]) => {
    px(ctx, ox+dx, oy+dy, '#5a9c4f');
    px(ctx, ox+dx+1, oy+dy, '#5a9c4f');
  });
}

// Draw a path tile  (32×32, horizontal)
function drawPath(ctx, ox, oy) {
  rect(ctx, ox, oy, 32, 32, '#8a8070');
  [[2,4],[9,10],[17,6],[24,14],[6,20],[20,26]].forEach(([dx, dy]) => {
    rect(ctx, ox + dx, oy + dy, 2, 2, '#7a7060');
  });
  rect(ctx, ox, oy + 28, 32, 4, '#6a6058');
}

function drawStreetPath(ctx, ox, oy, topGrassGap = 0) {
  const y0 = topGrassGap;
  const h = 32 - topGrassGap;
  rect(ctx, ox, oy + y0, 32, h, '#5a5850');
  [[4, 8], [14, 4], [22, 12], [8, 18], [18, 24]].forEach(([dx, dy]) => {
    if (dy + 2 > y0) rect(ctx, ox + dx, oy + dy, 3, 2, '#4a4840');
  });
  rect(ctx, ox, oy + y0, 32, 2, '#6a6860');
}

/** Single flat flagstone overlay — sits on grass or porch; narrow, path-toned. */
function drawStepStoneOverlay(ctx, ox, oy, variant) {
  const sizes = [
    { w: 14, h: 11, y: 16, jx: 0 },
    { w: 12, h: 9, y: 18, jx: -1 },
    { w: 13, h: 10, y: 15, jx: 1 },
  ];
  const sz = sizes[variant % 3];
  const s = {
    x: ox + Math.floor((32 - sz.w) / 2) + sz.jx,
    y: oy + sz.y,
    w: sz.w,
    h: sz.h,
  };
  rect(ctx, s.x + 1, s.y + 2, s.w, s.h, 'rgba(0,0,0,0.2)');
  rect(ctx, s.x, s.y, s.w, s.h, '#6a6560');
  rect(ctx, s.x + 1, s.y + 1, s.w - 2, s.h - 2, '#8a8078');
  rect(ctx, s.x + 2, s.y + 2, s.w - 5, s.h - 4, '#9a9088');
  rect(ctx, s.x + s.w - 4, s.y + s.h - 3, 3, 2, '#5a5550');
  px(ctx, s.x + 4, s.y + 4, '#5a5550');
  px(ctx, s.x + s.w - 6, s.y + 5, '#7a7570');
}

// Draw a water tile  (32×32)
function drawWater(ctx, ox, oy, frame) {
  rect(ctx, ox, oy, 32, 32, '#2a6e9e');
  const shift = frame % 2 === 0 ? 0 : 2;
  for (let i = 0; i < 4; i++) {
    rect(ctx, ox + 2 + i*8 + shift, oy+10, 5, 2, '#4a9ec0');
    rect(ctx, ox + 5 + i*8 - shift, oy+20, 5, 2, '#4a9ec0');
  }
}

// Draw a tree  (32×48 in a 32×64 frame — trunk at bottom)
function drawTree(ctx, ox, oy) {
  // shadow
  rect(ctx, ox+8, oy+60, 16, 4, 'rgba(0,0,0,0.25)');
  // trunk
  rect(ctx, ox+13, oy+42, 6, 18, '#6b3d1e');
  rect(ctx, ox+14, oy+44, 1, 14, '#8b5c2e');
  // canopy layers
  rect(ctx, ox+6,  oy+28, 20, 16, '#2d7a2d');
  rect(ctx, ox+4,  oy+16, 24, 16, '#3a9a3a');
  rect(ctx, ox+8,  oy+6,  16, 14, '#4ab04a');
  rect(ctx, ox+10, oy+2,  12, 8,  '#55c055');
  // highlight
  rect(ctx, ox+10, oy+8,  4,  6,  '#6adc5a');
}

// Draw a fence tile  (32×32)
function drawFence(ctx, ox, oy) {
  rect(ctx, ox, oy, 32, 32, 'rgba(0,0,0,0)');
  rect(ctx, ox, oy+8,  32, 4, '#8b5c2e');
  rect(ctx, ox, oy+20, 32, 4, '#8b5c2e');
  rect(ctx, ox+4,  oy+4, 4, 24, '#a06c3e');
  rect(ctx, ox+24, oy+4, 4, 24, '#a06c3e');
}

// Draw a wooden post sign  (32×32) — freestanding sidewalk prop
function drawSign(ctx, ox, oy) {
  rect(ctx, ox + 14, oy + 20, 4, 12, '#6b3d1e');
  rect(ctx, ox + 4, oy + 6, 24, 16, '#c4a35a');
  rect(ctx, ox + 5, oy + 7, 22, 14, '#d4b36a');
  rect(ctx, ox + 8, oy + 10, 16, 2, '#7a5a20');
  rect(ctx, ox + 8, oy + 15, 12, 2, '#7a5a20');
}

/** County-park style neighborhood bulletin kiosk (32×32). */
function drawCommunityBoard(ctx, ox, oy) {
  rect(ctx, ox + 5, oy + 17, 3, 12, '#5a4030');
  rect(ctx, ox + 24, oy + 17, 3, 12, '#5a4030');
  rect(ctx, ox + 5, oy + 27, 22, 2, '#6b5038');
  rect(ctx, ox + 4, oy + 8, 24, 14, '#8a7050');
  rect(ctx, ox + 5, oy + 9, 22, 12, '#a08058');
  rect(ctx, ox + 3, oy + 7, 26, 2, '#4a3828');
  rect(ctx, ox + 3, oy + 21, 26, 2, '#4a3828');
  rect(ctx, ox + 3, oy + 7, 2, 16, '#4a3828');
  rect(ctx, ox + 27, oy + 7, 2, 16, '#4a3828');
  for (let i = 0; i < 5; i++) {
    rect(ctx, ox + 9 + i, oy + 2 + i, 14 - 2 * i, 2, '#3a5038');
  }
  rect(ctx, ox + 7, oy + 6, 18, 2, '#4a6048');
  rect(ctx, ox + 7, oy + 11, 8, 5, '#e8dcc8');
  rect(ctx, ox + 17, oy + 10, 7, 6, '#d4c8a8');
  px(ctx, ox + 10, oy + 10, '#8a3030');
  px(ctx, ox + 20, oy + 9, '#8a3030');
}

// Draw a flower  (32×32)
function drawFlower(ctx, ox, oy, color) {
  rect(ctx, ox, oy, 32, 32, 'rgba(0,0,0,0)');
  // stem
  px(ctx, ox+16, oy+22, '#2d7a2d');
  px(ctx, ox+16, oy+23, '#2d7a2d');
  px(ctx, ox+16, oy+24, '#2d7a2d');
  // petals
  [[15,18],[17,18],[14,19],[18,19],[15,21],[17,21]].forEach(([dx,dy]) => px(ctx, ox+dx, oy+dy, color));
  // center
  px(ctx, ox+16, oy+19, '#ffe066');
  px(ctx, ox+16, oy+20, '#ffe066');
}

function drawBuildingWall(ctx, ox, oy) {
  rect(ctx, ox, oy, 32, 32, '#5a4038');
  for (let y = 2; y < 32; y += 8) rect(ctx, ox, oy + y, 32, 1, '#4a3028');
  for (let x = 8; x < 32; x += 16) {
    for (let y = 0; y < 32; y += 8) rect(ctx, ox + x, oy + y, 1, 8, '#4a3028');
  }
}

function drawFacadeWall(ctx, ox, oy) {
  rect(ctx, ox, oy, 32, 32, '#7a5848');
  for (let y = 3; y < 30; y += 7) rect(ctx, ox + 1, oy + y, 30, 1, '#6a4838');
  for (let x = 5; x < 28; x += 14) {
    for (let y = 1; y < 28; y += 7) rect(ctx, ox + x, oy + y, 1, 6, '#6a4838');
  }
  rect(ctx, ox, oy + 28, 32, 4, '#5a3828');
}

function drawFacadeWindow(ctx, ox, oy) {
  drawFacadeWall(ctx, ox, oy);
  rect(ctx, ox + 6, oy + 6, 20, 18, '#3a2830');
  rect(ctx, ox + 8, oy + 8, 16, 14, '#4a6878');
  rect(ctx, ox + 9, oy + 9, 5, 6, '#6a8898');
  rect(ctx, ox + 6, oy + 6, 20, 2, '#8a6858');
  rect(ctx, ox + 6, oy + 22, 20, 2, '#8a6858');
}

function drawSidewalk(ctx, ox, oy) {
  rect(ctx, ox, oy, 32, 32, '#8a9088');
  for (let x = 1; x < 31; x += 8) rect(ctx, ox + x, oy + 2, 1, 28, '#7a8078');
  rect(ctx, ox, oy + 2, 32, 1, '#9aa098');
  rect(ctx, ox, oy + 28, 32, 4, '#6a6058');
}

/** Neutral tile under the outside storefront — no grass bleed. */
function drawBuildingFoundation(ctx, ox, oy) {
  rect(ctx, ox, oy, 32, 32, '#6a6058');
  rect(ctx, ox + 2, oy + 2, 28, 28, '#5a5850');
  rect(ctx, ox, oy + 28, 32, 4, '#4a4840');
  rect(ctx, ox, oy, 32, 2, '#7a7870');
}

function drawRoofTile(ctx, ox, oy) {
  rect(ctx, ox, oy, 32, 32, '#3a2830');
  for (let i = 0; i < 5; i++) {
    rect(ctx, ox, oy + 4 + i * 5, 32, 4, i % 2 === 0 ? '#4a3848' : '#3a2838');
  }
  rect(ctx, ox, oy + 26, 32, 6, '#2a1820');
}

function drawAwningTile(ctx, ox, oy) {
  drawFacadeWall(ctx, ox, oy);
  for (let i = 0; i < 5; i++) {
    rect(ctx, ox + 2 + i * 6, oy + 10, 5, 10, i % 2 === 0 ? '#8a3040' : '#d4af6a');
  }
  rect(ctx, ox + 2, oy + 20, 28, 3, '#5a3828');
}

function drawDoorEnter(ctx, ox, oy) {
  drawFacadeWall(ctx, ox, oy);
  rect(ctx, ox + 5, oy + 2, 22, 28, '#3a2820');
  rect(ctx, ox + 7, oy + 4, 18, 24, '#1a1008');
  rect(ctx, ox + 9, oy + 8, 14, 16, '#4a3828');
  rect(ctx, ox + 10, oy + 10, 4, 4, '#d4a860');
  rect(ctx, ox + 21, oy + 18, 2, 3, '#d4af6a');
  rect(ctx, ox + 6, oy + 28, 20, 4, '#5a4030');
}

/** Freestanding Dragon's Brew sidewalk sign — miniature wooden post sign. */
function drawFreestandingBrewSign(ctx, ox, oy) {
  drawSign(ctx, ox, oy);
}

// One cohesive storefront (12×7 tiles) — no grass gaps, reads as a real building
function drawStreetBuildingFacade(ctx, bw, bh) {
  const brick = '#7a5848', brickD = '#6a4838', trim = '#5a3828';
  const gap = 2;
  const foundationH = 8;
  const doorH = 40;
  const awningH = 8;
  const winW = 72;
  const winH = 58;
  const winInset = 44;

  const door = MoDoors.facadeDoorMetrics(bw, bh);
  const awningY = door.dy - gap - awningH;
  const winY = awningY - gap - winH;

  // roof + overhang shadow
  rect(ctx, 0, 0, bw, 38, '#3a2830');
  for (let i = 0; i < 7; i++) {
    rect(ctx, 0, 6 + i * 4, bw, 3, i % 2 === 0 ? '#4a3848' : '#3a2830');
  }
  rect(ctx, 0, 34, bw, 6, '#2a1820');
  rect(ctx, 4, 38, bw - 8, 4, 'rgba(0,0,0,0.25)');

  // main wall
  rect(ctx, 0, 42, bw, bh - 42, brick);
  for (let y = 48; y < bh - foundationH; y += 10) rect(ctx, 4, y, bw - 8, 1, brickD);
  for (let x = 20; x < bw - 16; x += 28) {
    for (let y = 44; y < bh - foundationH - 4; y += 10) rect(ctx, x, y, 1, 8, brickD);
  }

  // two side windows — taller/wider, clear of door and awning
  const winSlots = [winInset, bw - winInset - winW];
  winSlots.forEach((wx) => {
    rect(ctx, wx, winY, winW, winH, trim);
    rect(ctx, wx + 6, winY + 6, winW - 12, winH - 12, '#3a4858');
    rect(ctx, wx + 10, winY + 10, 18, 14, '#6a8898');
    rect(ctx, wx + winW - 28, winY + winH - 24, 18, 14, '#5a7888');
  });

  // awning — stripes only over the door bay
  const stripeW = 22;
  const stripeGap = 26;
  const stripeCount = 6;
  const awningSpan = stripeCount * stripeGap - 4;
  const awningStart = door.cx - awningSpan / 2;
  for (let i = 0; i < stripeCount; i++) {
    rect(ctx, awningStart + i * stripeGap, awningY, stripeW, awningH, i % 2 === 0 ? '#8a3040' : '#d4af6a');
  }
  rect(ctx, awningStart - 4, awningY + awningH, awningSpan + 8, 3, trim);

  // door (center-bottom — narrow portrait rectangle, real-world proportions)
  rect(ctx, door.dx, door.dy, door.dw, door.dh, '#3a2820');
  rect(ctx, door.dx + 2, door.dy + 2, door.dw - 4, door.dh - 4, '#1a1008');
  rect(ctx, door.dx + 4, door.dy + 5, door.dw - 8, door.dh - 10, '#3a3028');
  rect(ctx, door.dx + 7, door.dy + 10, 5, 5, '#d4a860');
  rect(ctx, door.dx + door.dw - 6, door.dy + door.dh - 14, 2, 3, '#d4af6a');
  rect(ctx, door.dx, door.dy + door.dh - 2, door.dw, 3, '#4a3828');

  // foundation sill
  rect(ctx, 0, bh - foundationH, bw, foundationH, trim);
}

function drawCafeFloor(ctx, ox, oy) {
  rect(ctx, ox, oy, 32, 32, '#5a4030');
  rect(ctx, ox, oy + 15, 32, 1, '#4a3028');
  rect(ctx, ox + 15, oy, 1, 32, '#4a3028');
}

function drawCafeWall(ctx, ox, oy) {
  rect(ctx, ox, oy, 32, 32, '#3a2830');
  rect(ctx, ox + 2, oy + 2, 28, 28, '#2a1820');
  rect(ctx, ox + 6, oy + 6, 4, 4, '#4a3848');
  rect(ctx, ox + 22, oy + 10, 4, 4, '#4a3848');
}

function drawCafeTrim(ctx, ox, oy) {
  drawCafeFloor(ctx, ox, oy);
  rect(ctx, ox, oy, 32, 3, '#3a2830');
  rect(ctx, ox, oy + 3, 3, 29, '#3a2830');
  rect(ctx, ox + 29, oy + 3, 3, 29, '#3a2830');
}

/** Trim tile — skip side pillars when outer wall is already beside this cell. */
function drawCafeTrimTile(ctx, ox, oy, grid, rx, ry) {
  const wallEastWest = (x) => {
    if (x < 0 || x >= grid[0].length) return true;
    const c = grid[ry][x];
    return isCafeWallChar(c) || c === '-';
  };
  drawCafeFloor(ctx, ox, oy);
  rect(ctx, ox, oy, 32, 3, '#3a2830');
  if (!wallEastWest(rx - 1)) rect(ctx, ox, oy + 3, 3, 29, '#3a2830');
  if (!wallEastWest(rx + 1)) rect(ctx, ox + 29, oy + 3, 3, 29, '#3a2830');
}

function isCafeWallChar(ch) {
  return ch === '#' || ch === '|';
}

function isCafeFloorChar(ch) {
  return ch === '.' || ch === '>' || ch === 'c' || ch === 'o' || ch === '*' || ch === 'M' || ch === 'K' || ch === 'H' || ch === 'b';
}

/** Neighbor-aware café wall tile — cleaner corners and long runs. */
function drawCafeBorderTile(ctx, ox, oy, grid, rx, ry) {
  const ch = grid[ry][rx];
  const solid = (x, y) => {
    if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return true;
    const c = grid[y][x];
    if (isCafeFloorChar(c) || c === '=') return true;
    return isCafeWallChar(c) || c === '-';
  };
  const n = solid(rx, ry - 1);
  const s = solid(rx, ry + 1);
  const w = solid(rx - 1, ry);
  const e = solid(rx + 1, ry);

  if (ch === '#') {
    rect(ctx, ox, oy, 32, 32, '#2a1820');
    rect(ctx, ox + 2, oy + 2, 28, 28, '#3a2830');
    if (!n) rect(ctx, ox + 2, oy + 2, 28, 4, '#4a3848');
    if (!s) rect(ctx, ox + 2, oy + 26, 28, 4, '#4a3848');
    if (!w) rect(ctx, ox + 2, oy + 2, 4, 28, '#4a3848');
    if (!e) rect(ctx, ox + 26, oy + 2, 4, 28, '#4a3848');
    return;
  }

  drawCafeWall(ctx, ox, oy);
  if (!n) rect(ctx, ox + 4, oy, 24, 3, '#4a3848');
  if (!s) rect(ctx, ox + 4, oy + 29, 24, 3, '#4a3848');
  if (!w) rect(ctx, ox, oy + 4, 3, 24, '#4a3848');
  if (!e) rect(ctx, ox + 29, oy + 4, 3, 24, '#4a3848');
}

function drawFoodSilhouette(ctx, x, y, key) {
  if (key === 'muffin') {
    rect(ctx, x, y + 4, 10, 8, '#c49a5a');
    rect(ctx, x + 1, y + 2, 8, 4, '#d4aa6a');
  } else if (key === 'croissant') {
    rect(ctx, x, y + 6, 12, 5, '#d4af6a');
    rect(ctx, x + 2, y + 3, 8, 4, '#c49a5a');
  } else if (key === 'bagel') {
    rect(ctx, x + 1, y + 4, 10, 8, '#b88858');
    rect(ctx, x + 4, y + 6, 4, 4, '#5a4030');
  } else {
    rect(ctx, x, y + 5, 12, 6, '#d4b896');
    rect(ctx, x + 1, y + 4, 10, 2, '#c49a5a');
  }
}

function drawDisplayCaseWide(ctx, w, h, foodItems) {
  const items = (foodItems || []).slice(0, 4);
  rect(ctx, 0, h - 14, w, 14, '#6b3d1e');
  rect(ctx, 0, h - 17, w, 4, '#8b5c2e');
  rect(ctx, 4, 8, w - 8, h - 26, '#3a2830');
  rect(ctx, 6, 10, w - 12, h - 30, '#88a8c8');
  rect(ctx, 8, 12, w - 16, h - 34, 'rgba(200,220,240,0.35)');
  const slotW = Math.floor((w - 16) / Math.max(1, items.length));
  items.forEach((item, i) => {
    const sx = 8 + i * slotW + Math.floor(slotW / 2) - 6;
    drawFoodSilhouette(ctx, sx, 14, item.key);
  });
  rect(ctx, 4, h - 20, w - 8, 2, '#a06c3e');
}

function drawBarStool(ctx, ox, oy) {
  drawCafeFloor(ctx, ox, oy);
  rect(ctx, ox + 12, oy + 4, 8, 4, '#5a3020');
  rect(ctx, ox + 14, oy + 8, 4, 12, '#6b4423');
  rect(ctx, ox + 10, oy + 20, 12, 3, '#4a2818');
}

function drawPatronSeated(ctx, ox, oy, shirt, hair) {
  rect(ctx, ox + 4, oy + 14, 8, 6, '#2a3048');
  rect(ctx, ox + 5, oy + 8, 6, 7, shirt || '#48a868');
  rect(ctx, ox + 5, oy + 2, 6, 5, hair || '#2a1810');
  rect(ctx, ox + 6, oy + 5, 2, 2, '#1a0a00');
  rect(ctx, ox + 9, oy + 5, 2, 2, '#1a0a00');
}

/** Plate on table — bites 0–3 (3 = full). */
function drawFoodPlate(ctx, ox, oy, bites) {
  const level = Math.max(0, Math.min(3, bites == null ? 3 : bites));
  rect(ctx, ox + 1, oy + 6, 14, 8, '#e8e0d0');
  rect(ctx, ox + 2, oy + 7, 12, 6, '#f0ece4');
  if (level >= 3) {
    rect(ctx, ox + 4, oy + 8, 8, 4, '#d4aa6a');
    rect(ctx, ox + 5, oy + 7, 6, 2, '#c49a5a');
  } else if (level >= 2) {
    rect(ctx, ox + 5, oy + 8, 6, 3, '#d4aa6a');
  } else if (level >= 1) {
    rect(ctx, ox + 6, oy + 9, 4, 2, '#c49a5a');
  }
}

function drawCounter(ctx, ox, oy) {
  drawCafeFloor(ctx, ox, oy);
  drawCounterBar(ctx, ox, oy);
}

function drawCounterBar(ctx, ox, oy) {
  rect(ctx, ox + 2, oy + 2, 28, 7, '#3a2830');
  rect(ctx, ox + 4, oy + 4, 5, 4, '#c8b8a0');
  rect(ctx, ox + 11, oy + 3, 10, 6, '#2a2028');
  rect(ctx, ox + 13, oy + 5, 6, 3, '#88a8c8');
  rect(ctx, ox + 22, oy + 4, 6, 4, '#e8e0d0');
  rect(ctx, ox, oy + 10, 32, 12, '#8b5c2e');
  rect(ctx, ox, oy + 10, 32, 3, '#a06c3e');
  rect(ctx, ox, oy + 20, 32, 4, '#6b3d1e');
  rect(ctx, ox + 4, oy + 22, 5, 6, '#5a3020');
  rect(ctx, ox + 23, oy + 22, 5, 6, '#5a3020');
}

function drawCafeTable(ctx, ox, oy) {
  drawCafeFloor(ctx, ox, oy);
  rect(ctx, ox + 3, oy + 5, 26, 12, '#6b3d1e');
  rect(ctx, ox + 5, oy + 7, 22, 8, '#9a7048');
  rect(ctx, ox + 7, oy + 8, 18, 6, '#b88858');
  rect(ctx, ox + 5, oy + 17, 4, 5, '#5a3020');
  rect(ctx, ox + 23, oy + 17, 4, 5, '#5a3020');
}

/** Floor chair — sits on tile south of table; player faces up toward table. */
function drawCafeChair(ctx, ox, oy) {
  drawCafeFloor(ctx, ox, oy);
  rect(ctx, ox + 9, oy + 2, 14, 5, '#5a3020');
  rect(ctx, ox + 10, oy + 7, 12, 8, '#6b4423');
  rect(ctx, ox + 9, oy + 15, 14, 3, '#4a2818');
}

function drawExitDoor(ctx, ox, oy) {
  drawCafeFloor(ctx, ox, oy);
  rect(ctx, ox + 4, oy + 8, 24, 22, '#3d2818');
  rect(ctx, ox + 6, oy + 10, 20, 18, '#5a4030');
  rect(ctx, ox + 8, oy + 12, 16, 14, '#2a1810');
  rect(ctx, ox + 9, oy + 14, 6, 8, '#6a5848');
  rect(ctx, ox + 20, oy + 20, 2, 3, '#d4af6a');
  rect(ctx, ox + 3, oy + 28, 26, 4, '#4a3028');
}

/** Tiny green cross-star for door twinkle overlay. */
function drawDoorSpark(ctx, ox, oy) {
  rect(ctx, ox + 3, oy, 2, 8, '#9affc8');
  rect(ctx, ox, oy + 3, 8, 2, '#9affc8');
  px(ctx, ox + 3, oy + 3, '#e8fff4');
  px(ctx, ox + 4, oy + 3, '#e8fff4');
  px(ctx, ox + 3, oy + 4, '#e8fff4');
  px(ctx, ox + 4, oy + 4, '#e8fff4');
}

function drawMenuBoard(ctx, ox, oy) {
  drawCafeWall(ctx, ox, oy);
  rect(ctx, ox + 3, oy + 5, 26, 22, '#e8e0d0');
  rect(ctx, ox + 6, oy + 8, 20, 2, '#5a4030');
  rect(ctx, ox + 6, oy + 12, 16, 2, '#5a4030');
  rect(ctx, ox + 6, oy + 16, 18, 2, '#5a4030');
}

function drawStrikeBoard(ctx, ox, oy) {
  drawCafeWall(ctx, ox, oy);
  rect(ctx, ox + 4, oy + 6, 24, 20, '#2a4030');
  rect(ctx, ox + 6, oy + 8, 20, 2, '#c8e8c8');
  rect(ctx, ox + 6, oy + 13, 14, 2, '#a8c8a8');
  rect(ctx, ox + 6, oy + 18, 16, 2, '#a8c8a8');
}

function drawHouseRulesBoard(ctx, ox, oy) {
  drawCafeWall(ctx, ox, oy);
  rect(ctx, ox + 3, oy + 5, 26, 22, '#ddd0b8');
  rect(ctx, ox + 5, oy + 7, 22, 1, '#8a6040');
  rect(ctx, ox + 6, oy + 10, 18, 2, '#5a4030');
  rect(ctx, ox + 6, oy + 14, 16, 2, '#5a4030');
  rect(ctx, ox + 6, oy + 18, 14, 2, '#5a4030');
}

function drawBookOnFloor(ctx, ox, oy) {
  drawCafeFloor(ctx, ox, oy);
  rect(ctx, ox + 10, oy + 14, 12, 8, '#8b4518');
  rect(ctx, ox + 11, oy + 15, 10, 6, '#d4b896');
  rect(ctx, ox + 12, oy + 16, 8, 1, '#6b3d1e');
}

/** fullness 0–4: visible drink layers in the cup (4 = full). forTable = rim toward seated player. */
function drawDrinkCup(ctx, ox, oy, fullness, forTable) {
  const level = Math.max(0, Math.min(4, fullness == null ? 4 : fullness));
  if (forTable) {
    rect(ctx, ox + 2, oy + 2, 8, 9, '#f0ece4');
    rect(ctx, ox + 3, oy + 3, 6, 6, level > 0 ? '#e8dcc8' : '#f5f0e8');
    rect(ctx, ox + 1, oy + 4, 2, 4, '#d4af6a');
    rect(ctx, ox + 3, oy + 12, 6, 2, '#e8e0d0');
    const bands = [
      { y: oy + 9, h: 2, color: '#7a4e28' },
      { y: oy + 7, h: 2, color: '#8b5a2b' },
      { y: oy + 6, h: 1, color: '#9a6535' },
      { y: oy + 5, h: 1, color: '#8b5a2b' },
    ];
    for (let i = 0; i < level; i++) {
      const b = bands[i];
      rect(ctx, ox + 3, b.y, 6, b.h, b.color);
    }
    return;
  }
  rect(ctx, ox + 2, oy + 5, 8, 9, '#f0ece4');
  rect(ctx, ox + 3, oy + 6, 6, 6, level > 0 ? '#e8dcc8' : '#f5f0e8');
  rect(ctx, ox + 1, oy + 7, 2, 4, '#d4af6a');
  rect(ctx, ox + 3, oy + 3, 6, 2, '#e8e0d0');
  const bands = [
    { y: oy + 10, h: 2, color: '#7a4e28' },
    { y: oy + 8, h: 2, color: '#8b5a2b' },
    { y: oy + 7, h: 1, color: '#9a6535' },
    { y: oy + 6, h: 1, color: '#8b5a2b' },
  ];
  for (let i = bands.length - 1; i >= bands.length - level; i--) {
    const b = bands[i];
    rect(ctx, ox + 3, b.y, 6, b.h, b.color);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Character spritesheet  (4 rows × 4 frames, each frame 16×24)
//  Rows: down, left, right, up
// ─────────────────────────────────────────────────────────────────────────────
const CHAR_W = 16, CHAR_H = 24, CHAR_FRAMES = 4;
const PLAYER_LOOK_ART_REV = 's';
const NPC_W = 28, NPC_H = CHAR_H; // wider canvas so wings read at 2× scale

function tri(ctx, x1, y1, x2, y2, x3, y3, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

function getProtagonistLook() {
  if (window.MoProtagonistLook && typeof window.MoProtagonistLook.getLook === 'function') {
    const look = window.MoProtagonistLook.getLook();
    if (look) return look;
  }
  return 'man_short';
}

/** Same eyes + mouth as casual looks — keeps every protagonist readable at 16×24. */
function drawCharFace(ctx, ox, oy, dir, skin) {
  skin = skin || '#f0c080';
  if (dir === 3) return;
  rect(ctx, ox + 3, oy + 2, 10, 9, skin);
  if (dir === 0) {
    rect(ctx, ox + 5, oy + 7, 2, 2, '#1a0a00');
    rect(ctx, ox + 9, oy + 7, 2, 2, '#1a0a00');
    rect(ctx, ox + 6, oy + 10, 4, 1, '#c07050');
  } else if (dir === 1) {
    rect(ctx, ox + 5, oy + 7, 2, 2, '#1a0a00');
    rect(ctx, ox + 5, oy + 10, 3, 1, '#c07050');
  } else if (dir === 2) {
    rect(ctx, ox + 9, oy + 7, 2, 2, '#1a0a00');
    rect(ctx, ox + 8, oy + 10, 3, 1, '#c07050');
  }
}

// BEGIN HIJAB_FACE_DRAW
/** Per-direction face regions — hijab cheek cols never overlap faceSkin. */
const HIJAB_FACE_LAYOUT = {
  0: {
    faceSkin: { x: 5, y: 5, w: 7, h: 7 },
    eyes: [{ x: 6, y: 7 }, { x: 9, y: 7 }],
    hijabCheeks: [
      { col: 4, crownX: 3, crownW: 2 },
      { col: 12, crownX: 12, crownW: 1 },
    ],
  },
  1: {
    faceSkin: { x: 5, y: 4, w: 3, h: 7 },
    eyes: [{ x: 5, y: 7 }],
    hijabCheeks: [{ col: 4, crownX: 4, crownW: 1 }],
  },
  2: {
    faceSkin: { x: 9, y: 4, w: 3, h: 7 },
    eyes: [{ x: 9, y: 7 }],
    hijabCheeks: [{ col: 8, crownX: 8, crownW: 1 }],
  },
};

const HIJAB_COLORS = { skin: '#f0c080', hijab: '#5a6878', hijabDark: '#4a5668', eye: '#1a0a00' };

/** Small pixel smile for hijab face (all facings). */
function drawHijabSmile(ctx, ox, oy, dir) {
  const lip = '#c07050';
  if (dir === 0) {
    px(ctx, ox + 7, oy + 10, lip);
    px(ctx, ox + 9, oy + 10, lip);
    rect(ctx, ox + 7, oy + 11, 3, 1, lip);
  } else if (dir === 1) {
    px(ctx, ox + 5, oy + 10, lip);
    px(ctx, ox + 6, oy + 11, lip);
    px(ctx, ox + 7, oy + 11, lip);
  } else if (dir === 2) {
    px(ctx, ox + 10, oy + 10, lip);
    px(ctx, ox + 8, oy + 11, lip);
    px(ctx, ox + 9, oy + 11, lip);
  }
}

/** Hijab cheek accent on columns strictly outside faceSkin. */
function drawHijabCheekAccents(ctx, ox, oy, cheeks, hijab, hijabDark, dir) {
  const crownY = dir === 0 ? 4 : 5;
  for (let i = 0; i < cheeks.length; i++) {
    const c = cheeks[i];
    rect(ctx, ox + c.crownX, oy + crownY, c.crownW, 2, hijab);
    px(ctx, ox + c.col, oy + 6, hijabDark);
    rect(ctx, ox + c.col, oy + 7, 1, 2, hijab);
  }
}

function drawHijabFaceFromLayout(ctx, ox, oy, dir, skin, hijab) {
  const hijabDark = HIJAB_COLORS.hijabDark;
  skin = skin || HIJAB_COLORS.skin;

  if (dir === 3) {
    rect(ctx, ox + 2, oy + 2, 12, 9, hijab);
    rect(ctx, ox + 3, oy + 3, 10, 7, hijabDark);
    rect(ctx, ox + 4, oy + 5, 8, 2, hijab);
    return;
  }

  const layout = HIJAB_FACE_LAYOUT[dir];
  if (!layout) return;

  if (dir === 0) {
    rect(ctx, ox + 3, oy + 1, 10, 3, hijab);
    rect(ctx, ox + 2, oy + 3, 2, 3, hijab);
    rect(ctx, ox + 12, oy + 3, 2, 3, hijab);
    rect(ctx, ox + 5, oy + 4, 7, 1, hijab);
    rect(ctx, ox + 4, oy + 4, 1, 1, hijabDark);
    rect(ctx, ox + 12, oy + 4, 1, 1, hijabDark);
    rect(ctx, ox + 1, oy + 9, 2, 2, hijab);
    rect(ctx, ox + 13, oy + 9, 2, 2, hijab);
    rect(ctx, ox + 3, oy + 12, 10, 1, hijabDark);
  } else if (dir === 1) {
    rect(ctx, ox + 8, oy + 1, 7, 10, hijab);
    rect(ctx, ox + 2, oy + 1, 12, 3, hijab);
    rect(ctx, ox + 2, oy + 3, 2, 3, hijab);
    rect(ctx, ox + 4, oy + 4, 3, 1, hijabDark);
    rect(ctx, ox + 1, oy + 9, 2, 2, hijab);
    rect(ctx, ox + 1, oy + 10, 3, 2, hijabDark);
  } else if (dir === 2) {
    rect(ctx, ox + 1, oy + 1, 7, 10, hijab);
    rect(ctx, ox + 2, oy + 1, 12, 3, hijab);
    rect(ctx, ox + 12, oy + 3, 2, 3, hijab);
    rect(ctx, ox + 9, oy + 4, 3, 1, hijabDark);
    rect(ctx, ox + 13, oy + 9, 2, 2, hijab);
    rect(ctx, ox + 12, oy + 10, 3, 2, hijabDark);
  }

  const fs = layout.faceSkin;
  rect(ctx, ox + fs.x, oy + fs.y, fs.w, fs.h, skin);
  for (let i = 0; i < layout.eyes.length; i++) {
    const e = layout.eyes[i];
    rect(ctx, ox + e.x, oy + e.y, 2, 2, HIJAB_COLORS.eye);
  }
  drawHijabSmile(ctx, ox, oy, dir);
  drawHijabCheekAccents(ctx, ox, oy, layout.hijabCheeks, hijab, hijabDark, dir);
}

/** Hijab + jilbab — per-direction head (no bare back, no ear skin, open face). */
function drawHijabFace(ctx, ox, oy, dir, skin, hijab) {
  drawHijabFaceFromLayout(ctx, ox, oy, dir, skin, hijab);
}
// END HIJAB_FACE_DRAW

function drawCharFrame(ctx, fx, fy, dir, frame, look) {
  const ox = fx * CHAR_W, oy = fy * CHAR_H;
  look = look || getProtagonistLook();
  const skin = '#f0c080';
  const walkOffset = (frame === 1 || frame === 3) ? 0 : 1;
  const legL = frame < 2 ? 1 : -1;
  const shoe = '#2a1a0a';

  ctx.clearRect(ox, oy, CHAR_W, CHAR_H);

  if (look === 'man_kufi') {
    const thobe = '#f2ece2', thobeShade = '#ddd4c8', kufi = '#f8f6f0', kufiLine = '#c8c0b4';
    if (dir !== 3) {
      rect(ctx, ox + 3 + legL, oy + 18 + walkOffset, 4, 4, thobeShade);
      rect(ctx, ox + 9 - legL, oy + 18 + walkOffset, 4, 4, thobeShade);
      rect(ctx, ox + 3 + legL, oy + 21 + walkOffset, 4, 3, shoe);
      rect(ctx, ox + 9 - legL, oy + 21 + walkOffset, 4, 3, shoe);
    } else {
      rect(ctx, ox + 3, oy + 18, 10, 6, thobeShade);
    }
    rect(ctx, ox + 2, oy + 10, 12, 9, thobe);
    if (dir !== 3) {
      rect(ctx, ox + 1, oy + 10, 2, 6, thobe);
      rect(ctx, ox + 13, oy + 10, 2, 6, thobe);
      rect(ctx, ox + 1, oy + 16, 2, 2, skin);
      rect(ctx, ox + 13, oy + 16, 2, 2, skin);
    } else {
      rect(ctx, ox + 1, oy + 10, 2, 7, thobe);
      rect(ctx, ox + 13, oy + 10, 2, 7, thobe);
      rect(ctx, ox + 3, oy + 2, 10, 5, kufi);
    }
    if (dir !== 3) {
      drawCharFace(ctx, ox, oy, dir, skin);
      rect(ctx, ox + 3, oy + 1, 10, 2, kufi);
      rect(ctx, ox + 4, oy + 2, 8, 1, kufiLine);
    }
    rect(ctx, ox + 4, oy + 23, 8, 1, 'rgba(0,0,0,0.3)');
    return;
  }

  if (look === 'woman_jilbab') {
    const hijab = '#5a6878', jilbab = '#4a5668', jilbabLight = '#6a7888', shoeD = '#2a3040';
    if (dir !== 3) {
      rect(ctx, ox + 3 + legL, oy + 18 + walkOffset, 4, 4, jilbab);
      rect(ctx, ox + 9 - legL, oy + 18 + walkOffset, 4, 4, jilbab);
      rect(ctx, ox + 3 + legL, oy + 21 + walkOffset, 4, 3, shoeD);
      rect(ctx, ox + 9 - legL, oy + 21 + walkOffset, 4, 3, shoeD);
    } else {
      rect(ctx, ox + 2, oy + 10, 12, 14, jilbab);
      drawHijabFace(ctx, ox, oy, dir, skin, hijab);
      rect(ctx, ox + 4, oy + 23, 8, 1, 'rgba(0,0,0,0.3)');
      return;
    }
    rect(ctx, ox + 2, oy + 10, 12, 9, jilbab);
    rect(ctx, ox + 1, oy + 17, 14, 4, jilbab);
    if (dir !== 3) {
      rect(ctx, ox + 1, oy + 11, 2, 5, jilbabLight);
      rect(ctx, ox + 13, oy + 11, 2, 5, jilbabLight);
    }
    drawHijabFace(ctx, ox, oy, dir, skin, hijab);
    rect(ctx, ox + 4, oy + 23, 8, 1, 'rgba(0,0,0,0.3)');
    return;
  }

  const hair = look === 'woman_long' ? '#4a2818' : '#5a3010';
  const shirt = look === 'woman_long' ? '#4a88b8' : '#3a7ac8';
  const pants = '#2a3a6a';

  if (dir !== 3) {
    rect(ctx, ox + 3 + legL, oy + 18 + walkOffset, 4, 4, pants);
    rect(ctx, ox + 9 - legL, oy + 18 + walkOffset, 4, 4, pants);
    rect(ctx, ox + 3 + legL, oy + 21 + walkOffset, 4, 3, shoe);
    rect(ctx, ox + 9 - legL, oy + 21 + walkOffset, 4, 3, shoe);
  } else {
    rect(ctx, ox + 3, oy + 18, 10, 6, pants);
  }

  rect(ctx, ox + 3, oy + 10, 10, 9, shirt);

  if (dir !== 3) {
    rect(ctx, ox + 1, oy + 10, 2, 6, shirt);
    rect(ctx, ox + 13, oy + 10, 2, 6, shirt);
    rect(ctx, ox + 1, oy + 16, 2, 2, skin);
    rect(ctx, ox + 13, oy + 16, 2, 2, skin);
  } else {
    rect(ctx, ox + 1, oy + 10, 2, 7, shirt);
    rect(ctx, ox + 13, oy + 10, 2, 7, shirt);
  }

  rect(ctx, ox + 3, oy + 2, 10, 9, skin);

  if (look === 'woman_long') {
    rect(ctx, ox + 3, oy + 2, 10, 3, hair);
    if (dir === 0) {
      rect(ctx, ox + 2, oy + 4, 2, 8, hair);
      rect(ctx, ox + 12, oy + 4, 2, 8, hair);
      rect(ctx, ox + 4, oy + 11, 2, 2, hair);
      rect(ctx, ox + 10, oy + 11, 2, 2, hair);
    } else if (dir === 1) {
      rect(ctx, ox + 2, oy + 3, 3, 9, hair);
      rect(ctx, ox + 4, oy + 11, 2, 2, hair);
    } else if (dir === 2) {
      rect(ctx, ox + 11, oy + 3, 3, 9, hair);
      rect(ctx, ox + 10, oy + 11, 2, 2, hair);
    }
    if (dir === 3) {
      rect(ctx, ox + 2, oy + 2, 12, 8, hair);
    }
  } else {
    rect(ctx, ox + 3, oy + 2, 10, 3, hair);
    if (dir === 3) {
      rect(ctx, ox + 3, oy + 2, 10, 5, hair);
    }
  }

  if (dir === 0) {
    rect(ctx, ox + 5, oy + 7, 2, 2, '#1a0a00');
    rect(ctx, ox + 9, oy + 7, 2, 2, '#1a0a00');
    rect(ctx, ox + 6, oy + 10, 4, 1, '#c07050');
  } else if (dir === 1) {
    rect(ctx, ox + 5, oy + 7, 2, 2, '#1a0a00');
    rect(ctx, ox + 5, oy + 10, 3, 1, '#c07050');
  } else if (dir === 2) {
    rect(ctx, ox + 9, oy + 7, 2, 2, '#1a0a00');
    rect(ctx, ox + 8, oy + 10, 3, 1, '#c07050');
  }

  rect(ctx, ox + 4, oy + 23, 8, 1, 'rgba(0,0,0,0.3)');
}

// ─────────────────────────────────────────────────────────────────────────────
//  Mara — Çampire barista (bat wings, cat tail, feline eyes)
//  Drawn on NPC_W×NPC_H canvas; body centered; wings/tail drawn last so they read.
// ─────────────────────────────────────────────────────────────────────────────
function drawNPC(ctx, ox, oy) {
  const bx = ox + 6; // 16px body centered in 28px-wide canvas
  const skin = '#e8d0c8', hair = '#2a1820', shirt = '#4a6080', apron = '#e8e0d0';
  const pants = '#2a3048', shoe = '#1a1020';
  const wing = '#101018', wingEdge = '#282830';
  const tailC = '#8a5030', tailTip = '#c07848';
  const eyeGrn = '#88cc44', slit = '#1a1020';

  // black bat wings — triangular, behind body
  tri(ctx, bx + 3, oy + 8, bx - 11, oy + 21, bx + 1, oy + 18, wing);
  tri(ctx, bx + 13, oy + 8, bx + 27, oy + 21, bx + 15, oy + 18, wing);
  px(ctx, bx - 11, oy + 21, wingEdge);
  px(ctx, bx + 27, oy + 21, wingEdge);

  // cat tail — thick curl visible beside her right leg
  rect(ctx, bx + 10, oy + 16, 2, 3, tailC);
  rect(ctx, bx + 12, oy + 18, 3, 2, tailC);
  rect(ctx, bx + 14, oy + 19, 3, 2, tailC);
  rect(ctx, bx + 16, oy + 20, 3, 2, tailC);
  rect(ctx, bx + 18, oy + 21, 3, 2, tailC);
  rect(ctx, bx + 20, oy + 22, 2, 2, tailTip);
  px(ctx, bx + 21, oy + 23, tailTip);

  rect(ctx, bx + 3, oy + 18, 4, 6, pants);
  rect(ctx, bx + 9, oy + 18, 4, 6, pants);
  rect(ctx, bx + 3, oy + 21, 4, 3, shoe);
  rect(ctx, bx + 9, oy + 21, 4, 3, shoe);
  rect(ctx, bx + 3, oy + 10, 10, 9, shirt);
  rect(ctx, bx + 4, oy + 12, 8, 7, apron);
  // arms — sleeves to wrist, bare hands (drawn over wings)
  rect(ctx, bx + 1, oy + 10, 2, 6, shirt);
  rect(ctx, bx + 13, oy + 10, 2, 6, shirt);
  rect(ctx, bx + 1, oy + 16, 2, 2, skin);
  rect(ctx, bx + 13, oy + 16, 2, 2, skin);
  rect(ctx, bx + 3, oy + 2, 10, 9, skin);
  rect(ctx, bx + 3, oy + 2, 10, 4, hair);
  rect(ctx, bx + 5, oy + 7, 2, 2, eyeGrn);
  rect(ctx, bx + 9, oy + 7, 2, 2, eyeGrn);
  px(ctx, bx + 6, oy + 7, slit);
  px(ctx, bx + 10, oy + 7, slit);
  rect(ctx, bx + 6, oy + 10, 4, 1, '#c07050');

  rect(ctx, bx + 4, oy + 23, 8, 1, 'rgba(0,0,0,0.3)');
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAPS — outside street + Dragon's Brew interior
// ─────────────────────────────────────────────────────────────────────────────
const TILE_IDX = {
  '.': 0, '1': 1, 'P': 2, 'W': 3, 'T': 4, 'F': 5, 'S': 6, 'f': 7,
  '#': 8, 'D': 9, 'B': 10, '=': 11, '|': 12, '-': 13, '*': 14, '>': 15,
  'M': 16, 'K': 17, 'b': 18,
  'h': 19, 'n': 20, 'w': 21, 'R': 22, 'A': 23, 'H': 24, 'o': 25,
};

const SOLID_TILES = new Set([3, 4, 5, 8, 12, 13, 14, 16, 17, 19, 20, 22, 23]);

/** @type {Array<{ map: string, col: number, row: number, title: string, text: string }>} */
const READABLES = [
  {
    map: 'outside',
    col: 3,
    row: 13,
    title: 'Neighborhood board',
    text: 'Dragon\'s Brew — down the brick path, mornings.\nPlaza market beyond the train station when you\'re ready to venture out.',
  },
  {
    map: 'outside',
    col: 6,
    row: 12,
    title: 'Dragon\'s Brew — storefront sign',
    text: 'Warm drinks and breakfast. All species welcome at the counter.\nStep through the door when it\'s open.',
  },
  {
    id: 'dragons_brew_menu',
    map: 'cafe',
    col: 2,
    row: 1,
    title: 'Drink menu',
    dynamic: true,
  },
  {
    map: 'cafe',
    col: 3,
    row: 1,
    title: 'Strike of the week',
    text: 'White sugar off the menu until the lot meets co-op standards.\nBrown sugar in the thermoses until further notice.',
  },
  {
    map: 'cafe',
    col: 4,
    row: 1,
    title: 'House rules (wall sign)',
    text: 'Food & drink here:\n• No customer blood served here.\n• No bovine blood served here.\n• No lizard or cow meat. (Fish is fine.)\n\nWe reserve the right to refuse service due to racism, predator-attitude, fighting, loud arguments, smoking, drinking alcohol, and picking on customers.',
  },
];

const OUTSIDE_BUILDING = MoDoors.OUTSIDE_BUILDING;
const COMMUNITY_BOARD = { col: 3, row: 12 };
const BOARD_SIDEWALK = { col: 3, row: 13 };
/** Clear grass pixels between stacked outside props (board above sidewalk). */
const PROP_GRASS_GAP = 1;
/** Three flagstones: porch sill → grass → grass lip before sidewalk (not on sidewalk row). */
const CAFE_STEP_STONES = [
  { row: 10, variant: 0 },
  { row: 11, variant: 1 },
  { row: 12, variant: 2 },
];

function cafeStepStoneWorldX() {
  return MoDoors.outsideDoorWorldX();
}

/** Sparkle anchors on the door frame (local px) — jamb, header, sill; not the panel. */
function doorSparkleLocalPoints(mapKey) {
  if (mapKey === 'outside') {
    const bh = OUTSIDE_BUILDING.height * TILE;
    const { dx, dy, dw, dh } = MoDoors.facadeDoorMetrics(OUTSIDE_BUILDING.width * TILE, bh);
    return [
      [dx + 4, dy + 2], [dx + Math.floor(dw / 2), dy + 1], [dx + dw - 4, dy + 2],
      [dx + 1, dy + 10], [dx + 1, dy + 22], [dx + 1, dy + 32],
      [dx + dw - 2, dy + 10], [dx + dw - 2, dy + 22], [dx + dw - 2, dy + 32],
      [dx + 5, dy + dh - 3], [dx + dw - 5, dy + dh - 3],
    ];
  }
  if (mapKey === 'cafe') {
    const fx = 4;
    const fy = 8;
    const fw = 24;
    const fh = 22;
    return [
      [fx + 4, fy + 1], [fx + Math.floor(fw / 2), fy + 1], [fx + fw - 4, fy + 1],
      [fx + 1, fy + 6], [fx + 1, fy + 14], [fx + 1, fy + 19],
      [fx + fw - 2, fy + 6], [fx + fw - 2, fy + 14], [fx + fw - 2, fy + 19],
      [fx + 6, fy + fh - 2], [fx + fw - 6, fy + fh - 2],
    ];
  }
  return [];
}

function doorSparkleWorldPoints(mapKey) {
  const s = SCALE;
  const locs = doorSparkleLocalPoints(mapKey);
  if (!locs.length) return [];
  if (mapKey === 'outside') {
    const b = OUTSIDE_BUILDING;
    const bx = b.left * TILE;
    const by = b.top * TILE;
    return locs.map(([x, y]) => ({ x: (bx + x) * s, y: (by + y) * s }));
  }
  const anchor = MoDoors.getDoorAnchor();
  const doorLeft = MoDoors.outsideDoorWorldX() - (TILE * s) / 2;
  const ty = anchor.insideExitRow * TILE * s;
  return locs.map(([x, y]) => ({ x: doorLeft + x * s, y: ty + y * s }));
}

function readableBoardFrameLocs(col, row, bx, by, bw, bh) {
  const tx = col * TILE;
  const ty = row * TILE;
  const x = tx + bx;
  const y = ty + by;
  return [
    [x + 3, y + 2], [x + Math.floor(bw / 2), y + 1], [x + bw - 3, y + 2],
    [x + 1, y + Math.floor(bh / 2)], [x + bw - 1, y + Math.floor(bh / 2)],
    [x + 4, y + bh - 2], [x + bw - 4, y + bh - 2],
  ];
}

/** Blue sparkle anchors on readable sign frames (READABLES only — not UI hints). */
function readableSparkleLocalPoints(item) {
  if (item.map === 'outside' && item.col === 6) {
    const tx = 6 * TILE;
    const ty = 11 * TILE;
    return [
      [tx + 6, ty + 7], [tx + 16, ty + 6], [tx + 26, ty + 7],
      [tx + 5, ty + 12], [tx + 27, ty + 12],
      [tx + 8, ty + 10], [tx + 24, ty + 10],
      [tx + 10, ty + 20], [tx + 22, ty + 20],
      [tx + 16, ty + 21],
    ];
  }
  if (item.map === 'outside' && item.col === 3) {
    const tx = 3 * TILE;
    const ty = 12 * TILE;
    return [
      [tx + 4, ty + 8], [tx + 16, ty + 3], [tx + 28, ty + 8],
      [tx + 3, ty + 12], [tx + 29, ty + 12],
      [tx + 3, ty + 20], [tx + 29, ty + 20],
      [tx + 8, ty + 14], [tx + 22, ty + 16],
      [tx + 6, ty + 24], [tx + 26, ty + 24],
    ];
  }
  if (item.map === 'cafe' && item.id === 'dragons_brew_menu') {
    return readableBoardFrameLocs(2, 1, 3, 5, 26, 22);
  }
  if (item.map === 'cafe' && item.col === 3) {
    return readableBoardFrameLocs(3, 1, 4, 6, 24, 20);
  }
  if (item.map === 'cafe' && item.col === 4) {
    return readableBoardFrameLocs(4, 1, 3, 5, 26, 22);
  }
  return [];
}

function readableSparkleStyle(item) {
  if (item.map === 'outside' && (item.col === 6 || item.col === 3)) return 'wood';
  return 'light';
}

const READABLE_SPARKLE_STYLES = {
  wood: { main: 0x98d8ff, peak: 0xf0faff, alphaBase: 0.32, alphaPulse: 0.52 },
  storefront: { main: 0xa8e0ff, peak: 0xf4fcff, alphaBase: 0.30, alphaPulse: 0.54 },
  light: { main: 0x2a60b8, peak: 0x5090e8, alphaBase: 0.38, alphaPulse: 0.50, outline: 0x143060 },
};

function readableSparkleWorldPoints(mapKey) {
  const s = SCALE;
  const out = [];
  READABLES.forEach((item) => {
    if (item.map !== mapKey) return;
    const style = readableSparkleStyle(item);
    readableSparkleLocalPoints(item).forEach(([x, y]) => {
      out.push({ x: x * s, y: y * s, style });
    });
  });
  return out;
}

function seatSparkleLocalPoints(seat) {
  const tx = seat.col * TILE;
  const ty = seat.row * TILE;
  if (seat.barStool) {
    return [
      [tx + 13, ty + 5], [tx + 19, ty + 5],
      [tx + 14, ty + 10], [tx + 18, ty + 10],
      [tx + 11, ty + 21], [tx + 21, ty + 21],
    ];
  }
  return [
    [tx + 11, ty + 3], [tx + 21, ty + 3],
    [tx + 10, ty + 9], [tx + 22, ty + 9],
    [tx + 12, ty + 16], [tx + 20, ty + 16],
  ];
}

function talkableSparkleLocalPoints(npc) {
  const ox = npc.col * TILE;
  const oy = npc.row * TILE;
  const cx = ox + NPC_W / 2;
  return [
    [ox + 1, oy + 6], [cx, oy + 1], [ox + NPC_W - 1, oy + 6],
    [ox - 1, oy + 11], [ox + NPC_W + 1, oy + 11],
    [ox + 4, oy + 20], [ox + NPC_W - 4, oy + 20],
    [ox + 20, oy + 18], [ox - 4, oy + 18],
  ];
}

function seatSparkleWorldPoints(mapKey) {
  if (mapKey !== 'cafe') return [];
  const s = SCALE;
  return CAFE_SEATS.flatMap((seat) =>
    seatSparkleLocalPoints(seat).map(([x, y]) => ({ x: x * s, y: y * s, style: 'seat' }))
  );
}

function talkableSparkleWorldPoints(mapKey) {
  const mara = MAPS[mapKey].mara;
  if (!mara) return [];
  const s = SCALE;
  return talkableSparkleLocalPoints(mara).map(([x, y]) => ({ x: x * s, y: y * s, style: 'talk' }));
}

const SEAT_TALK_SPARKLE_STYLES = {
  seat: { main: 0xff6868, peak: 0xffd4d4, alphaBase: 0.28, alphaPulse: 0.48 },
  talk: { main: 0xff80c8, peak: 0xffe4f4, alphaBase: 0.28, alphaPulse: 0.50 },
};

const MAPS = {
  outside: {
    backgroundColor: '#1a1a2e',
    doorTile: 'D',
    doorPos: { col: MoDoors.getDoorAnchor().gridCol, row: MoDoors.getDoorAnchor().outsideRow },
    doorFacing: 'up',
    exitTo: 'cafe',
    playerStart: { col: 4, row: 11 },
    mara: null,
    grid: [
      '####################',
      '#1................1#',
      '#..1....1....1.....#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..PPPPPPPPPPPP....#',
      '#.f...B............#',
      '#..S...............#',
      '#PPPPPPPPPPPPPPPPPP#',
      '#..................#',
      '####################',
    ].map(r => r.split('')),
  },
  cafe: {
    backgroundColor: '#241818',
    doorTile: '>',
    doorPos: { col: MoDoors.getDoorAnchor().gridCol, row: MoDoors.getDoorAnchor().insideExitRow },
    doorFacing: 'down',
    exitTo: 'outside',
    playerStart: {
      col: MoDoors.getDoorAnchor().gridCol,
      feetRow: MoDoors.getDoorAnchor().insideEnterRow,
      facing: 'up',
    },
    mara: { col: 10, row: 2 },
    grid: [
      '####################',
      '#|MKH..............|#',
      '#|------------------|#',
      '#=................=#',
      '#=................=#',
      '#=.*....*....*....=#',
      '#=.c....c....c....=#',
      '#=....*....*......=#',
      '#=..o....c....o..=#',
      '#=................=#',
      '#=........*.......=#',
      '#.|||||||>||||||||.#',
      '#.......|||c.......#',
      '#..................#',
      '#..................#',
      '#..................#',
      '####################',
    ].map(r => r.split('')),
  },
};

/** Floor dining — sit on `c` or bar stool `o`; table is `*` directly north when present. */
function buildCafeSeats() {
  const grid = MAPS.cafe.grid;
  const seats = [];
  grid.forEach((row, ry) => {
    row.forEach((ch, rx) => {
      if (ch !== 'c' && ch !== 'o') return;
      const tableRow = ry - 1;
      const hasTable = tableRow >= 0 && grid[tableRow][rx] === '*';
      if (ch === 'c' && !hasTable) return;
      seats.push({
        col: rx,
        row: ry,
        facing: 'up',
        barStool: ch === 'o',
        tableCol: hasTable ? rx : null,
        tableRow: hasTable ? tableRow : null,
      });
    });
  });
  return seats;
}

const CAFE_SEATS = buildCafeSeats();
const CAFE_COUNTER = { row: 3, left: 3, right: 16 };
const COUNTER_CUP = { col: 11, row: 3 };
const COUNTER_PLATE = { col: 13, row: 3 };

/** Silent background customers — visual only until Monday plot (#13). */
const CAFE_PATRONS = [
  { seatCol: 3, seatRow: 6, shirt: '#c85848', hair: '#2a1810' },
  { seatCol: 15, seatRow: 6, shirt: '#48a868', hair: '#1a1010' },
  { seatCol: 10, seatRow: 8, shirt: '#8868c8', hair: '#4a3018' },
];
/** Player center Y when seated — over chair cushion (see drawCafeChair oy+7..15). */
const CAFE_CHAIR_SIT_Y = 11;

// ─────────────────────────────────────────────────────────────────────────────
//  Phaser Game
// ─────────────────────────────────────────────────────────────────────────────
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  preload() {
    // Build all textures programmatically — no external files needed
    this._buildTileTextures();
    this._buildCharTexture();
    this._buildNPCTexture();
    this._buildCupTexture();
  }

  _buildTileTextures() {
    // One canvas per tile type — avoids crop offset bugs
    const add = (key, w, h, fn) => {
      const c = makeCanvas(w, h);
      fn(c.getContext('2d'));
      this.textures.addCanvas(key, c);
    };
    add('t_grass',  32, 32, ctx => drawGrass(ctx, 0, 0, 0));
    add('t_grass2', 32, 32, ctx => drawGrass(ctx, 0, 0, 1));
    add('t_path',   32, 32, ctx => drawPath(ctx, 0, 0));
    add('t_water',  32, 32, ctx => drawWater(ctx, 0, 0, 0));
    add('t_water2', 32, 32, ctx => drawWater(ctx, 0, 0, 1));
    add('t_tree',   32, 64, ctx => drawTree(ctx, 0, 0));
    add('t_fence',  32, 32, ctx => drawFence(ctx, 0, 0));
    add('t_sign',   32, 32, ctx => drawCommunityBoard(ctx, 0, 0));
    add('t_flower', 32, 32, ctx => drawFlower(ctx, 0, 0, '#ff6688'));
    add('t_wall',   32, 32, ctx => drawBuildingWall(ctx, 0, 0));
    add('t_door',   32, 32, ctx => drawDoorEnter(ctx, 0, 0));
    add('t_brew',   32, 32, ctx => drawFreestandingBrewSign(ctx, 0, 0));
    add('t_facade', 32, 32, ctx => drawFacadeWall(ctx, 0, 0));
    add('t_fwin',   32, 32, ctx => drawFacadeWindow(ctx, 0, 0));
    add('t_swalk',  32, 32, ctx => drawSidewalk(ctx, 0, 0));
    add('t_roof',   32, 32, ctx => drawRoofTile(ctx, 0, 0));
    add('t_awning', 32, 32, ctx => drawAwningTile(ctx, 0, 0));
    add('t_cfloor', 32, 32, ctx => drawCafeFloor(ctx, 0, 0));
    add('t_cwall',  32, 32, ctx => drawCafeWall(ctx, 0, 0));
    add('t_counter',32, 32, ctx => drawCounter(ctx, 0, 0));
    add('t_counter_bar', 32, 32, ctx => drawCounterBar(ctx, 0, 0));
    add('t_ctable', 32, 32, ctx => drawCafeTable(ctx, 0, 0));
    add('t_cchair', 32, 32, ctx => drawCafeChair(ctx, 0, 0));
    add('t_exit',   32, 32, ctx => drawExitDoor(ctx, 0, 0));
    add('t_menu',   32, 32, ctx => drawMenuBoard(ctx, 0, 0));
    add('t_strike', 32, 32, ctx => drawStrikeBoard(ctx, 0, 0));
    add('t_hrules', 32, 32, ctx => drawHouseRulesBoard(ctx, 0, 0));
    add('t_book',   32, 32, ctx => drawBookOnFloor(ctx, 0, 0));
    add('t_street', 32, 32, ctx => drawStreetPath(ctx, 0, 0));
    add('t_street_pad', 32, 32, ctx => drawStreetPath(ctx, 0, 0, PROP_GRASS_GAP));
    for (let v = 0; v < 3; v++) {
      add('t_step_ov_' + v, 32, 32, ctx => drawStepStoneOverlay(ctx, 0, 0, v));
    }
    add('t_bfoundation', 32, 32, ctx => drawBuildingFoundation(ctx, 0, 0));
    add('t_ctrim', 32, 32, ctx => drawCafeTrim(ctx, 0, 0));
    add('t_bstool', 32, 32, ctx => drawBarStool(ctx, 0, 0));
    add('t_spark', 8, 8, ctx => drawDoorSpark(ctx, 0, 0));
    const cw = (CAFE_COUNTER.right - CAFE_COUNTER.left + 1) * 32;
    const cc = makeCanvas(cw, 32);
    const foodItems = window.DragonsBrewMenu && DragonsBrewMenu.getVisibleItems
      ? DragonsBrewMenu.getVisibleItems().food
      : [];
    drawDisplayCaseWide(cc.getContext('2d'), cw, 32, foodItems);
    this.textures.addCanvas('cafe_display_case', cc);
    CAFE_PATRONS.forEach((p, i) => {
      const pc = makeCanvas(16, 24);
      drawPatronSeated(pc.getContext('2d'), 0, 0, p.shirt, p.hair);
      this.textures.addCanvas('patron_' + i, pc);
    });
    const bc = makeCanvas(OUTSIDE_BUILDING.width * 32, OUTSIDE_BUILDING.height * 32);
    drawStreetBuildingFacade(bc.getContext('2d'), bc.width, bc.height);
    this.textures.addCanvas('street_building', bc);
  }

  _ensurePlayerTexture(look) {
    look = look || getProtagonistLook();
    const texKey = 'player_' + look + '_' + PLAYER_LOOK_ART_REV;
    if (this.textures.exists(texKey)) return texKey;

    const c = makeCanvas(CHAR_W * CHAR_FRAMES, CHAR_H * 4);
    const ctx = c.getContext('2d');
    for (let dir = 0; dir < 4; dir++) {
      for (let frame = 0; frame < CHAR_FRAMES; frame++) {
        drawCharFrame(ctx, frame, dir, dir, frame, look);
      }
    }
    this.textures.addCanvas(texKey, c);
    const tex = this.textures.get(texKey);
    for (let dir = 0; dir < 4; dir++) {
      const dirName = ['down', 'left', 'right', 'up'][dir];
      for (let frame = 0; frame < CHAR_FRAMES; frame++) {
        tex.add(`${dirName}${frame}`, 0, frame * CHAR_W, dir * CHAR_H, CHAR_W, CHAR_H);
      }
    }
    return texKey;
  }

  _buildCharTexture() {
    this._ensurePlayerTexture(getProtagonistLook());
  }

  _rebuildPlayerAnims(texKey) {
    const dirs = ['down', 'left', 'right', 'up'];
    dirs.forEach(dir => {
      if (this.anims.exists(`walk-${dir}`)) this.anims.remove(`walk-${dir}`);
      if (this.anims.exists(`idle-${dir}`)) this.anims.remove(`idle-${dir}`);
      this.anims.create({
        key: `walk-${dir}`,
        frames: [0, 1, 2, 3].map(i => ({ key: texKey, frame: `${dir}${i}` })),
        frameRate: 8,
        repeat: -1
      });
      this.anims.create({
        key: `idle-${dir}`,
        frames: [{ key: texKey, frame: `${dir}0` }],
        frameRate: 1,
        repeat: 0
      });
    });
  }

  refreshPlayerAppearance() {
    if (!this.player) return;
    const facing = this.facing || 'down';
    const texKey = this._ensurePlayerTexture();
    this._rebuildPlayerAnims(texKey);
    this.player.setTexture(texKey, `${facing}0`);
    const animKey = (this.player.body && (this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0))
      ? `walk-${facing}` : `idle-${facing}`;
    if (this.anims.exists(animKey)) {
      this.player.play(animKey, true);
    }
  }

  _buildNPCTexture() {
    const c = makeCanvas(NPC_W, NPC_H);
    const ctx = c.getContext('2d');
    drawNPC(ctx, 0, 0);
    this.textures.addCanvas('npc', c);
  }

  _buildCupTexture() {
    for (let level = 0; level <= 4; level++) {
      const c = makeCanvas(12, 16);
      drawDrinkCup(c.getContext('2d'), 0, 0, level, false);
      this.textures.addCanvas(`drink_cup_${level}`, c);
      const ct = makeCanvas(12, 16);
      drawDrinkCup(ct.getContext('2d'), 0, 0, level, true);
      this.textures.addCanvas(`drink_cup_table_${level}`, ct);
    }
    for (let bites = 0; bites <= 3; bites++) {
      const c = makeCanvas(16, 16);
      drawFoodPlate(c.getContext('2d'), 0, 0, bites);
      this.textures.addCanvas(`food_plate_${bites}`, c);
    }
  }

  create() {
    this.currentMap = 'outside';
    this.transitionCooldown = 0;

    this.groundLayer = this.add.container(0, 0);
    this.tallLayer   = this.add.container(0, 0);
    this.solidBodies = this.physics.add.staticGroup();

    const playerTex = this._ensurePlayerTexture(getProtagonistLook() || 'man_short');
    this.player = this.physics.add.sprite(0, 0, playerTex);
    this.player.setScale(SCALE);
    this.player.setDepth(10);
    this.player.body.setSize(10 * SCALE, 8 * SCALE);
    this.player.body.setOffset(3 * SCALE, 16 * SCALE);

    const dirs = ['down','left','right','up'];
    this._rebuildPlayerAnims(playerTex);
    this.player.play('idle-down');
    this.facing = 'down';

    this.npc = this.add.image(0, 0, 'npc').setScale(SCALE).setDepth(10).setVisible(false);

    // ── dialogue box (screen-fixed; laid out to stay inside visible area) ───
    this.dialogueActive = false;
    this.dialogueKind = null;
    this.orderInputActive = false;
    this.orderInputMode = 'order';
    this.quizItem = null;
    this.visitPanelActive = false;
    this.playerSeated = false;
    this.seatAnchor = null;
    this.sitHintAt = 0;
    this.drinkCup = null;
    this.cupWithPlayer = false;
    this.cupFullness = 0;
    this.foodPlate = null;
    this.plateWithPlayer = false;
    this.plateFullness = 0;
    this.patronSprites = [];
    this.cafeDisplayCase = null;
    this.dialogueBox = this.add.container(0, 0).setDepth(50).setScrollFactor(0).setVisible(false);
    this.dialogueBg = this.add.rectangle(0, 0, W * SCALE - DIALOGUE_PAD_X * 2, DIALOGUE_MIN_H, 0x000000, 0.82).setOrigin(0.5, 0);
    this.dialogueBorder = this.add.rectangle(0, 0, W * SCALE - DIALOGUE_PAD_X * 2, DIALOGUE_MIN_H).setStrokeStyle(2, 0xffe066).setOrigin(0.5, 0);
    this.dialogueText = this.add.text(0, DIALOGUE_TEXT_PAD_Y, '', {
      fontFamily: 'monospace',
      fontSize: DIALOGUE_BASE_FONT + 'px',
      lineSpacing: 6,
      color: '#fffbe8',
      wordWrap: { width: W * SCALE - DIALOGUE_PAD_X * 2 - 40 },
      align: 'center',
    }).setOrigin(0.5, 0);
    this.dialogueBox.add([this.dialogueBg, this.dialogueBorder, this.dialogueText]);
    this.scale.on('resize', this._onDialogueResize, this);

    this.maraFirstDialogue =
      '*Laughs gently*\n\n' +
      'She waves her left hand, easy—a small gesture, as if waving away your nervousness.\n\n' +
      '"You\'re fine, there\'s not a lot of my kind in this area. I\'m a Çampire—' +
      'vampire and werecat ancestry somewhere down the line. The wings plus the tail are a fun conversation starter."';
    this.maraOrderHint =
      'Type your order in the language you chose for the café, then press Enter.\n' +
      '(Spanish: hold letters for accents. Arabic: romanization like Qahwa is fine.)';

    this.maraOrderWrap = document.getElementById('mara-order-wrap');
    this.maraOrderInput = document.getElementById('mara-order-input');
    this.maraVisitWrap = document.getElementById('mara-visit-wrap');
    this.maraVisitText = document.getElementById('mara-visit-text');
    if (this.maraOrderInput) {
      const stopKeyBubble = (e) => {
        if (!this.orderInputActive) return;
        e.stopPropagation();
      };
      ['keydown', 'keyup', 'keypress', 'input', 'compositionstart', 'compositionupdate', 'compositionend'].forEach((evt) => {
        this.maraOrderInput.addEventListener(evt, stopKeyBubble);
      });
      this.maraOrderInput.addEventListener('keydown', (e) => {
        if (!this.orderInputActive) return;
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          this._closeMaraOrderInput();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this._submitMaraOrder();
        }
      });
    }

    // ── input ────────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' });
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.tKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    this.dKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.fKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);

    this.audioStarted = false;
    this.input.keyboard.on('keydown', () => {
      if (!this.audioStarted) {
        Audio.init();
        Audio.startMusic();
        this.audioStarted = true;
      }
    });

    this.physics.add.collider(this.player, this.solidBodies);

    this.cameras.main.setBounds(0, 0, W * SCALE, H * SCALE);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.streetBuildingImg = null;

    if (window.MoDoors) {
      MoDoors.validateDoorLink(MAPS.cafe.grid);
    }
    this.doorDebugEnabled = typeof location !== 'undefined'
      && new URLSearchParams(location.search).get('doorDebug') === '1';
    if (this.doorDebugEnabled) {
      this.doorDebugGfx = this.add.graphics().setDepth(99999);
    }

    this._loadMap('outside');
  }

  _isOutsideBuildingCell(rx, ry) {
    const b = OUTSIDE_BUILDING;
    return rx >= b.left && rx < b.left + b.width && ry >= b.top && ry < b.top + b.height;
  }

  _playerFeetWorld() {
    return {
      x: this.player.x,
      y: this.player.y + this.player.displayHeight * (1 - this.player.originY),
    };
  }

  /** Solid café footprint except the narrow façade door opening. */
  _isOutsideBuildingSolid(rx, ry) {
    if (!this._isOutsideBuildingCell(rx, ry)) return false;
    return MoDoors.tileSolidRectsAgainstPassage(rx, ry, MoDoors.outsideDoorPassageRect()).length > 0;
  }

  /** When north of the café facade, draw the player behind the building image. */
  _applyPlayerDepth() {
    const ySort = 10 + this.player.y / (H * SCALE);
    if (this.currentMap === 'outside') {
      const b = OUTSIDE_BUILDING;
      const cell = this._playerGridCell();
      const inFacadeSpan = cell.col >= b.left && cell.col < b.left + b.width;
      if (inFacadeSpan && cell.row < b.top) {
        this.player.setDepth(5);
        if (this.npc.visible) this.npc.setDepth(5);
        return;
      }
    }
    this.player.setDepth(ySort);
    if (this.npc.visible) {
      this.npc.setDepth(10 + this.npc.y / (H * SCALE));
    }
  }

  _outsideGroundKey(rx, ry) {
    const ch = MAPS.outside.grid[ry][rx];
    if (this._isOutsideBuildingCell(rx, ry)) return 't_bfoundation';
    if (ch === 'P' && ry >= 10) return 't_street';
    if (ch === 'P' && ry === OUTSIDE_BUILDING.doorRow) return 't_street';
    return 't_grass';
  }

  _playerGridCell() {
    const u = TILE * SCALE;
    const feetY = this.player.y + this.player.displayHeight * (1 - this.player.originY);
    return {
      col: Math.floor(this.player.x / u),
      row: Math.min(ROWS - 1, Math.max(0, Math.floor((feetY - 1) / u))),
    };
  }

  /** Which tile the player is standing on (sprite center). */
  _playerCenterCell() {
    const u = TILE * SCALE;
    return {
      col: Math.floor(this.player.x / u),
      row: Math.min(ROWS - 1, Math.max(0, Math.floor(this.player.y / u))),
    };
  }

  _playerOnDoorTile(conf) {
    if (this.currentMap === 'outside' || this.currentMap === 'cafe') {
      const feet = this._playerGridCell();
      return MoDoors.playerOnDoorTrigger(
        feet.col, feet.row, this.currentMap, this._doorInputKeys()
      );
    }
    const feet = this._playerGridCell();
    const center = this._playerCenterCell();
    const on = (cell) => this._isDoorTile(conf, conf.grid, cell.col, cell.row);
    return on(feet) || on(center);
  }

  _doorInputKeys() {
    const { cursors, wasd } = this;
    return {
      up: cursors.up.isDown || wasd.up.isDown,
      down: cursors.down.isDown || wasd.down.isDown,
      left: cursors.left.isDown || wasd.left.isDown,
      right: cursors.right.isDown || wasd.right.isDown,
    };
  }

  _canUseDoor(conf) {
    const feet = this._playerGridCell();
    return MoDoors.canUseDoor(
      feet.col, feet.row, this.currentMap, this.facing, this._doorInputKeys(), conf.doorFacing
    );
  }

  _isDoorTile(conf, grid, col, row) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    const dp = conf.doorPos;
    if (dp && col === dp.col && row === dp.row) return true;
    if (grid[row][col] === conf.doorTile) return true;
    return false;
  }

  _tilePos(col, row) {
    return {
      x: col * TILE * SCALE + (TILE / 2) * SCALE,
      y: row * TILE * SCALE + (TILE / 2) * SCALE,
    };
  }

  _placeCafeChairs() {
    const u = TILE * SCALE;
    CAFE_SEATS.forEach((seat) => {
      const key = seat.barStool ? 't_bstool' : 't_cchair';
      const chair = this.add.image(seat.col * u, seat.row * u, key)
        .setOrigin(0, 0)
        .setScale(SCALE)
        .setDepth(9);
      this.groundLayer.add(chair);
    });
  }

  _placeCafePatrons() {
    if (this.patronSprites.length) {
      this.patronSprites.forEach((s) => s.destroy());
      this.patronSprites = [];
    }
    const u = TILE * SCALE;
    CAFE_PATRONS.forEach((p, i) => {
      const pos = this._seatedPlayerPos({ col: p.seatCol, row: p.seatRow });
      const spr = this.add.image(pos.x, pos.y, 'patron_' + i)
        .setScale(SCALE)
        .setDepth(11);
      this.patronSprites.push(spr);
    });
  }

  _placeCafeCounter() {
    const u = TILE * SCALE;
    const c = CAFE_COUNTER;
    if (this.cafeDisplayCase) {
      this.cafeDisplayCase.destroy();
      this.cafeDisplayCase = null;
    }
    this.cafeDisplayCase = this.add.image(
      c.left * u,
      c.row * u,
      'cafe_display_case'
    ).setOrigin(0, 0).setScale(SCALE).setDepth(11);
    this.tallLayer.add(this.cafeDisplayCase);
    for (let col = c.left; col <= c.right; col++) {
      const wx = col * u + 16 * SCALE;
      const wy = c.row * u + 16 * SCALE;
      const body = this.add.rectangle(wx, wy, 32 * SCALE, 32 * SCALE);
      this.physics.add.existing(body, true);
      this.solidBodies.add(body);
    }
  }

  _spawnPlayer(spawn) {
    const u = TILE * SCALE;
    let x;
    let y;
    if (spawn.col != null && spawn.feetRow != null && window.MoDoors) {
      const pos = MoDoors.spritePosFromGrid(
        spawn.col, spawn.feetRow, this.player.displayHeight, this.player.originY
      );
      x = pos.x;
      y = pos.y;
    } else {
      x = spawn.x != null ? spawn.x : spawn.col * u + u / 2;
      if (spawn.y != null) {
        y = spawn.y;
      } else if (spawn.feetRow != null) {
        const feetY = spawn.feetRow * u + u * 0.5;
        const footDrop = this.player.displayHeight * (1 - this.player.originY);
        y = feetY - footDrop;
      } else if (spawn.row != null) {
        y = spawn.row * u + u / 2;
      } else {
        y = 0;
      }
    }
    this.player.setPosition(x, y);
    if (spawn.facing) {
      this.facing = spawn.facing;
      this.player.play(`idle-${this.facing}`, true);
    }
    this.player.body.updateFromGameObject();
  }

  _destroyDoorSparkles() {
    if (this.sparkleTimer) {
      this.sparkleTimer.remove(false);
      this.sparkleTimer = null;
    }
    if (this.doorSparkleGfx) {
      this.doorSparkleGfx.destroy();
      this.doorSparkleGfx = null;
    }
    this.doorSparklePts = null;
    this.doorSparkPhase = null;
    if (this.readableSparkleGfx) {
      this.readableSparkleGfx.destroy();
      this.readableSparkleGfx = null;
    }
    this.readableSparklePts = null;
    this.readableSparkPhase = null;
    if (this.seatSparkleGfx) {
      this.seatSparkleGfx.destroy();
      this.seatSparkleGfx = null;
    }
    this.seatSparklePts = null;
    this.seatSparkPhase = null;
    if (this.talkSparkleGfx) {
      this.talkSparkleGfx.destroy();
      this.talkSparkleGfx = null;
    }
    this.talkSparklePts = null;
    this.talkSparkPhase = null;
  }

  _drawSparkleSet(gfx, pts, phases, mainColor, peakColor, alphaBase, alphaPulse, styleLookup) {
    if (!gfx || !pts || !pts.length) return;
    const t = this.time.now * 0.001;
    pts.forEach((pt, i) => {
      const phase = phases[i];
      const pulse = 0.5 + 0.5 * Math.sin(t * (1.4 + i * 0.13) + phase);
      const st = (styleLookup && pt.style && styleLookup[pt.style])
        ? styleLookup[pt.style]
        : { main: mainColor, peak: peakColor, alphaBase, alphaPulse };
      const alpha = st.alphaBase + pulse * st.alphaPulse;
      const size = i % 2 === 0 ? 3 : 2;
      if (st.outline) {
        gfx.fillStyle(st.outline, alpha * 0.65);
        gfx.fillRect(pt.x - size / 2 - 1, pt.y - size / 2 - 1, size + 2, size + 2);
      }
      gfx.fillStyle(st.main, alpha);
      gfx.fillRect(pt.x - size / 2, pt.y - size / 2, size, size);
      if (pulse > 0.55) {
        gfx.fillStyle(st.peak, alpha * 0.8);
        gfx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
      }
    });
  }

  _drawAmbientSparkles() {
    if (this.doorSparkleGfx) {
      this.doorSparkleGfx.clear();
      this._drawSparkleSet(
        this.doorSparkleGfx,
        this.doorSparklePts,
        this.doorSparkPhase,
        0xb2ffd8,
        0xf0fff8,
        this.currentMap === 'outside' ? 0.24 : 0.22,
        this.currentMap === 'outside' ? 0.44 : 0.40
      );
    }
    if (this.readableSparkleGfx) {
      this.readableSparkleGfx.clear();
      this._drawSparkleSet(
        this.readableSparkleGfx,
        this.readableSparklePts,
        this.readableSparkPhase,
        0x88c8ff,
        0xe8f4ff,
        0.24,
        0.44,
        READABLE_SPARKLE_STYLES
      );
    }
    if (this.seatSparkleGfx) {
      this.seatSparkleGfx.clear();
      this._drawSparkleSet(
        this.seatSparkleGfx,
        this.seatSparklePts,
        this.seatSparkPhase,
        0xff6868,
        0xffd4d4,
        0.28,
        0.48,
        SEAT_TALK_SPARKLE_STYLES
      );
    }
    if (this.talkSparkleGfx) {
      this.talkSparkleGfx.clear();
      this._drawSparkleSet(
        this.talkSparkleGfx,
        this.talkSparklePts,
        this.talkSparkPhase,
        0xff80c8,
        0xffe4f4,
        0.28,
        0.50,
        SEAT_TALK_SPARKLE_STYLES
      );
    }
  }

  _createDoorSparkles() {
    this._destroyDoorSparkles();
    const doorPts = doorSparkleWorldPoints(this.currentMap);
    const readPts = readableSparkleWorldPoints(this.currentMap);
    const seatPts = seatSparkleWorldPoints(this.currentMap);
    const talkPts = talkableSparkleWorldPoints(this.currentMap);
    if (!doorPts.length && !readPts.length && !seatPts.length && !talkPts.length) return;

    if (doorPts.length) {
      this.doorSparklePts = doorPts;
      this.doorSparkPhase = doorPts.map(() => Math.random() * Math.PI * 2);
      this.doorSparkleGfx = this.add.graphics().setDepth(11);
    }
    if (readPts.length) {
      this.readableSparklePts = readPts;
      this.readableSparkPhase = readPts.map(() => Math.random() * Math.PI * 2);
      this.readableSparkleGfx = this.add.graphics().setDepth(11);
    }
    if (seatPts.length) {
      this.seatSparklePts = seatPts;
      this.seatSparkPhase = seatPts.map(() => Math.random() * Math.PI * 2);
      this.seatSparkleGfx = this.add.graphics().setDepth(10);
    }
    if (talkPts.length) {
      this.talkSparklePts = talkPts;
      this.talkSparkPhase = talkPts.map(() => Math.random() * Math.PI * 2);
      this.talkSparkleGfx = this.add.graphics().setDepth(13);
    }
    this._drawAmbientSparkles();
    this.sparkleTimer = this.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => this._drawAmbientSparkles(),
    });
  }

  _loadMap(mapKey, spawn) {
    this.currentMap = mapKey;
    const mapData = MAPS[mapKey];
    const grid = mapData.grid;

    this.groundLayer.removeAll(true);
    this.tallLayer.removeAll(true);
    this.solidBodies.clear(true, true);
    this._destroyDoorSparkles();
    if (this.streetBuildingImg) {
      this.streetBuildingImg.destroy();
      this.streetBuildingImg = null;
    }

    if (this.cafeDisplayCase) {
      this.cafeDisplayCase.destroy();
      this.cafeDisplayCase = null;
    }
    if (this.patronSprites.length) {
      this.patronSprites.forEach((s) => s.destroy());
      this.patronSprites = [];
    }

    this.cameras.main.setBackgroundColor(mapData.backgroundColor);

    const TILE_KEY = [
      't_grass','t_grass2','t_path','t_water','t_tree','t_fence','t_sign','t_flower',
      't_wall','t_door','t_brew','t_cfloor','t_cwall','t_counter','t_ctable','t_exit',
      't_menu','t_strike','t_book',
      't_facade','t_fwin','t_swalk','t_roof','t_awning','t_hrules',
    ];

    grid.forEach((row, ry) => {
      row.forEach((ch, rx) => {
        const wx = rx * TILE * SCALE;
        const wy = ry * TILE * SCALE;
        const b = OUTSIDE_BUILDING;

        if (mapKey === 'outside' && ch === 'w' && rx >= b.left - 1 && rx <= b.left + b.width) {
          if (!this._isOutsideBuildingCell(rx, ry)) {
            const g = this.add.image(wx, wy, 't_grass').setOrigin(0, 0).setScale(SCALE);
            this.groundLayer.add(g);
          }
          return;
        }

        if (mapKey === 'outside' && this._isOutsideBuildingCell(rx, ry)) {
          const img = this.add.image(wx, wy, this._outsideGroundKey(rx, ry)).setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(img);
          return;
        }

        const tid = TILE_IDX[ch] ?? 0;

        if (tid === 4) {
          const g = this.add.image(wx, wy, 't_grass').setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(g);
          const t = this.add.image(wx, wy - 32 * SCALE, 't_tree').setOrigin(0, 0).setScale(SCALE).setDepth(5);
          this.tallLayer.add(t);
          const body = this.add.rectangle(wx + 16 * SCALE, wy + 20 * SCALE, 14 * SCALE, 24 * SCALE);
          this.physics.add.existing(body, true);
          this.solidBodies.add(body);
        } else if (tid === 6 || tid === 7 || tid === 10) {
          let gKey = 't_grass';
          if (mapKey === 'outside') gKey = this._outsideGroundKey(rx, ry);
          const g = this.add.image(wx, wy, gKey).setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(g);
          const overlayKey = tid === 6 ? 't_sign' : tid === 7 ? 't_flower' : 't_brew';
          const s = this.add.image(wx, wy, overlayKey).setOrigin(0, 0).setScale(SCALE).setDepth(5);
          this.tallLayer.add(s);
        } else if (tid === 13 && mapKey === 'cafe') {
          const floor = this.add.image(wx, wy, 't_cfloor').setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(floor);
          const body = this.add.rectangle(wx + 16 * SCALE, wy + 16 * SCALE, 32 * SCALE, 32 * SCALE);
          this.physics.add.existing(body, true);
          this.solidBodies.add(body);
        } else if (mapKey === 'cafe' && (ch === 'c' || ch === 'o')) {
          const floor = this.add.image(wx, wy, 't_cfloor').setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(floor);
        } else if (mapKey === 'cafe' && ch === '>') {
          const floor = this.add.image(wx, wy, 't_cfloor').setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(floor);
          const door = this.add.image(MoDoors.outsideDoorWorldX(), wy, 't_exit')
            .setOrigin(0.5, 0)
            .setScale(SCALE)
            .setDepth(11);
          this.tallLayer.add(door);
        } else if (mapKey === 'cafe' && (ch === '#' || ch === '|')) {
          const c = makeCanvas(32, 32);
          drawCafeBorderTile(c.getContext('2d'), 0, 0, grid, rx, ry);
          const key = 'cafe_border_v2_' + rx + '_' + ry;
          if (!this.textures.exists(key)) this.textures.addCanvas(key, c);
          const img = this.add.image(wx, wy, key).setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(img);
          const body = this.add.rectangle(wx + 16 * SCALE, wy + 16 * SCALE, 32 * SCALE, 32 * SCALE);
          this.physics.add.existing(body, true);
          this.solidBodies.add(body);
        } else if (mapKey === 'cafe' && ch === '=') {
          const c = makeCanvas(32, 32);
          drawCafeTrimTile(c.getContext('2d'), 0, 0, grid, rx, ry);
          const key = 'cafe_trim_v2_' + rx + '_' + ry;
          if (!this.textures.exists(key)) this.textures.addCanvas(key, c);
          const img = this.add.image(wx, wy, key).setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(img);
        } else {
          const useStreet = mapKey === 'outside' && ch === 'P' && ry >= 10;
          const boardWalk = mapKey === 'outside' && rx === BOARD_SIDEWALK.col && ry === BOARD_SIDEWALK.row;
          if (boardWalk) {
            const gKey = this._outsideGroundKey(rx, ry);
            const g = this.add.image(wx, wy, gKey).setOrigin(0, 0).setScale(SCALE);
            this.groundLayer.add(g);
            const img = this.add.image(wx, wy, 't_street_pad').setOrigin(0, 0).setScale(SCALE);
            this.groundLayer.add(img);
          } else {
            let key = useStreet ? 't_street' : (TILE_KEY[tid] ?? 't_grass');
            if (mapKey === 'cafe' && (tid === 0 || tid === 1)) key = 't_cfloor';
            const img = this.add.image(wx, wy, key).setOrigin(0, 0).setScale(SCALE);
            this.groundLayer.add(img);
          }

          if (SOLID_TILES.has(tid)) {
            const body = this.add.rectangle(wx + 16 * SCALE, wy + 16 * SCALE, 32 * SCALE, 32 * SCALE);
            this.physics.add.existing(body, true);
            this.solidBodies.add(body);
          }
        }
      });
    });

    if (mapKey === 'outside') {
      const b = OUTSIDE_BUILDING;
      this.streetBuildingImg = this.add.image(
        b.left * TILE * SCALE,
        b.top * TILE * SCALE,
        'street_building'
      ).setOrigin(0, 0).setScale(SCALE).setDepth(6);

      const passage = MoDoors.outsideDoorPassageRect();
      const s = SCALE;
      for (let ry = b.top; ry < b.top + b.height; ry++) {
        for (let rx = b.left; rx < b.left + b.width; rx++) {
          const clips = MoDoors.tileSolidRectsAgainstPassage(rx, ry, passage);
          clips.forEach((clip) => {
            const w = (clip.right - clip.left) * s;
            const h = (clip.bottom - clip.top) * s;
            if (w < 1 || h < 1) return;
            const wx = (clip.left + clip.right) / 2 * s;
            const wy = (clip.top + clip.bottom) / 2 * s;
            const body = this.add.rectangle(wx, wy, w, h);
            this.physics.add.existing(body, true);
            this.solidBodies.add(body);
          });
        }
      }

      CAFE_STEP_STONES.forEach((st) => {
        const wx = cafeStepStoneWorldX();
        const wy = st.row * TILE * SCALE;
        const img = this.add.image(wx, wy, 't_step_ov_' + st.variant)
          .setOrigin(0, 0)
          .setScale(SCALE)
          .setDepth(7);
        this.groundLayer.add(img);
      });
    }

    this._spawnPlayer(spawn || mapData.playerStart);

    if (mapKey === 'cafe') {
      this._placeCafeCounter();
      this._placeCafeChairs();
      this._placeCafePatrons();
    }

    if (mapData.mara) {
      const m = mapData.mara;
      this.npc.setVisible(true);
      this.npc.setPosition(
        m.col * TILE * SCALE + (NPC_W / 2) * SCALE,
        m.row * TILE * SCALE + (NPC_H / 2) * SCALE
      );
      this.npc.setDepth(12);
    } else {
      this.npc.setVisible(false);
    }

    this.transitionCooldown = 400;
    this.playerSeated = false;
    this.seatAnchor = null;
    this.player.body.moves = true;
    this.player.body.setVelocity(0, 0);
    if (this.dialogueActive) this._closeDialogue();
    if (this.orderInputActive) this._closeMaraOrderInput();
    if (this.visitPanelActive) this._closeVisitPanel();
    if (mapKey !== 'cafe' && window.DragonsBrewMenu && typeof DragonsBrewMenu.abandonVisit === 'function') {
      DragonsBrewMenu.abandonVisit();
    }
    if (mapKey !== 'cafe') {
      this._hideCup();
      this._hidePlate();
    }

    if (window.MoControlsPanel && typeof window.MoControlsPanel.sync === 'function') {
      window.MoControlsPanel.sync();
    }

    this._createDoorSparkles();
  }

  _ensurePlateSprite() {
    if (!this.foodPlate) {
      this.foodPlate = this.add.image(0, 0, 'food_plate_3').setScale(SCALE).setDepth(14).setVisible(false);
    }
    return this.foodPlate;
  }

  _applyPlateBitesVisual() {
    if (!this.foodPlate) return;
    const level = Math.max(0, Math.min(3, this.plateFullness | 0));
    this.foodPlate.setTexture(`food_plate_${level}`);
  }

  _hidePlate() {
    this.plateWithPlayer = false;
    this.plateFullness = 0;
    if (this.foodPlate) this.foodPlate.setVisible(false);
  }

  _showCounterOrder() {
    if (this.currentMap !== 'cafe') return;
    const menuApi = window.DragonsBrewMenu;
    const u = TILE * SCALE;
    if (menuApi && menuApi.orderHasDrink && menuApi.orderHasDrink()) {
      const cup = this._ensureCupSprite();
      cup.setPosition(
        COUNTER_CUP.col * u + u / 2,
        COUNTER_CUP.row * u + u - 4 * SCALE
      );
      this.cupFullness = 4;
      this._applyCupFullnessVisual();
      cup.setVisible(true);
      this.cupWithPlayer = false;
      cup.setDepth(14);
    }
    if (menuApi && menuApi.orderHasFood && menuApi.orderHasFood()) {
      const plate = this._ensurePlateSprite();
      plate.setPosition(
        COUNTER_PLATE.col * u + u / 2,
        COUNTER_PLATE.row * u + u / 2
      );
      this.plateFullness = 3;
      this._applyPlateBitesVisual();
      plate.setVisible(true);
      this.plateWithPlayer = false;
      plate.setDepth(14);
    }
  }

  _pickupOrderFromCounter() {
    const menuApi = window.DragonsBrewMenu;
    if (menuApi && menuApi.orderHasDrink && menuApi.orderHasDrink()) {
      this.cupFullness = 4;
      this._applyCupFullnessVisual();
      this.cupWithPlayer = true;
      this._ensureCupSprite().setVisible(true);
    } else {
      if (this.drinkCup) this.drinkCup.setVisible(false);
      this.cupWithPlayer = false;
    }
    if (menuApi && menuApi.orderHasFood && menuApi.orderHasFood()) {
      this.plateFullness = 3;
      this._applyPlateBitesVisual();
      this.plateWithPlayer = true;
      this._ensurePlateSprite().setVisible(true);
    } else {
      if (this.foodPlate) this.foodPlate.setVisible(false);
      this.plateWithPlayer = false;
    }
    this._syncCupPosition();
    this._syncPlatePosition();
  }

  _isDinePhase() {
    const menuApi = window.DragonsBrewMenu;
    return menuApi && menuApi.getVisitPhase && menuApi.getVisitPhase() === 'dine';
  }

  _needsDrinkForVisit() {
    const menuApi = window.DragonsBrewMenu;
    return menuApi && menuApi.orderHasDrink && menuApi.orderHasDrink();
  }

  _needsFoodForVisit() {
    const menuApi = window.DragonsBrewMenu;
    return menuApi && menuApi.orderHasFood && menuApi.orderHasFood();
  }

  _checkDineComplete() {
    if (!this._isDinePhase() || !this.playerSeated) return false;
    if (this._needsDrinkForVisit() && this.cupFullness > 0) return false;
    if (this._needsFoodForVisit() && this.plateFullness > 0) return false;
    return true;
  }

  _tryCompleteDine() {
    if (!this._checkDineComplete()) return;
    const menuApi = window.DragonsBrewMenu;
    if (menuApi && typeof menuApi.completeVisit === 'function') menuApi.completeVisit();
    this._hideCup();
    this._hidePlate();
    this._showDialogue('You finish at the table. Mara smiles from the counter — "Step outside when you\'re ready — that\'s when the week turns."');
    if (this.audioStarted) Audio.sfxInteract();
  }

  _eatFood() {
    if (!this.plateWithPlayer || !this.foodPlate || !this.foodPlate.visible) return;
    if (!this.playerSeated && this._isDinePhase()) return;
    if (this.plateFullness <= 0) return;
    this.plateFullness -= 1;
    this._applyPlateBitesVisual();
    if (this.audioStarted) Audio.sfxInteract();
    this._tryCompleteDine();
  }

  _syncPlatePosition() {
    if (!this.foodPlate || !this.foodPlate.visible || !this.plateWithPlayer) return;
    const u = TILE * SCALE;

    if (this.playerSeated && this.seatAnchor && this.seatAnchor.tableCol != null) {
      const tc = this.seatAnchor.tableCol;
      const tr = this.seatAnchor.tableRow;
      this.foodPlate.setPosition(tc * u + u / 2 + 8 * SCALE, tr * u + u / 2 + 2 * SCALE);
      this.foodPlate.setDepth(10 + (tr * u + u / 2) / (H * SCALE));
      return;
    }

    const hand = 9 * SCALE;
    let dx = hand;
    let dy = 10 * SCALE;
    if (this.facing === 'left') { dx = -hand; dy = 10 * SCALE; }
    else if (this.facing === 'right') { dx = hand; dy = 10 * SCALE; }
    else if (this.facing === 'up') { dx = hand * 0.75; dy = 8 * SCALE; }
    else { dx = hand * 0.55; dy = hand * 0.95; }
    this.foodPlate.setPosition(this.player.x + dx, this.player.y + dy);
    this.foodPlate.setDepth(this.player.depth + 1);
  }

  _ensureCupSprite() {
    if (!this.drinkCup) {
      this.drinkCup = this.add.image(0, 0, 'drink_cup_4')
        .setScale(SCALE)
        .setDepth(14)
        .setVisible(false);
    }
    return this.drinkCup;
  }

  _cupOnTable() {
    return !!(this.playerSeated && this.seatAnchor && this.seatAnchor.tableCol != null);
  }

  _applyCupFullnessVisual() {
    if (!this.drinkCup) return;
    const level = Math.max(0, Math.min(4, this.cupFullness | 0));
    const prefix = this._cupOnTable() ? 'drink_cup_table_' : 'drink_cup_';
    this.drinkCup.setTexture(`${prefix}${level}`);
  }

  _sipDrink() {
    if (!this.cupWithPlayer || !this.drinkCup || !this.drinkCup.visible) return;
    if (this._isDinePhase() && !this.playerSeated) return;
    if (this.cupFullness <= 0) return;
    this.cupFullness -= 1;
    this._applyCupFullnessVisual();
    if (this.audioStarted) Audio.sfxInteract();
    this._tryCompleteDine();
  }

  _showCounterCup() {
    if (this.currentMap !== 'cafe') return;
    const cup = this._ensureCupSprite();
    const u = TILE * SCALE;
    cup.setPosition(
      COUNTER_CUP.col * u + u / 2,
      COUNTER_CUP.row * u + u / 2 - 6 * SCALE
    );
    cup.setVisible(true);
    this.cupWithPlayer = false;
    cup.setDepth(14);
  }

  _giveCupToPlayer() {
    if (this.currentMap !== 'cafe') return;
    const cup = this._ensureCupSprite();
    this.cupFullness = 4;
    this._applyCupFullnessVisual();
    cup.setVisible(true);
    this.cupWithPlayer = true;
    this._syncCupPosition();
  }

  _hideCup() {
    this.cupWithPlayer = false;
    this.cupFullness = 0;
    if (this.drinkCup) this.drinkCup.setVisible(false);
  }

  _syncCupPosition() {
    if (!this.drinkCup || !this.drinkCup.visible || !this.cupWithPlayer) return;
    const u = TILE * SCALE;

    if (this.playerSeated && this.seatAnchor && this.seatAnchor.tableCol != null) {
      const tc = this.seatAnchor.tableCol;
      const tr = this.seatAnchor.tableRow;
      this.drinkCup.setPosition(tc * u + u / 2, tr * u + u / 2 + 2 * SCALE);
      this.drinkCup.setDepth(10 + (tr * u + u / 2) / (H * SCALE));
      this._applyCupFullnessVisual();
      return;
    }

    const hand = 9 * SCALE;
    let dx = hand;
    let dy = 6 * SCALE;
    if (this.facing === 'left') { dx = -hand; dy = 6 * SCALE; }
    else if (this.facing === 'right') { dx = hand; dy = 6 * SCALE; }
    else if (this.facing === 'up') { dx = hand * 0.75; dy = 4 * SCALE; }
    else { dx = hand * 0.55; dy = hand * 0.85; }
    this.drinkCup.setPosition(this.player.x + dx, this.player.y + dy);
    this.drinkCup.setDepth(this.player.depth + 1);
    this._applyCupFullnessVisual();
  }

  _syncVisitPhaseCup() {
    const menuApi = window.DragonsBrewMenu;
    if (!menuApi) return;
    if (menuApi.getVisitPhase && menuApi.getVisitPhase() === 'pickup') {
      this._showCounterOrder();
    }
  }

  _checkDoorTransition() {
    if (this.transitionCooldown > 0) return;
    if (this._isDinePhase()) return;

    const conf = MAPS[this.currentMap];
    if (!this._canUseDoor(conf)) return;

    if (this.currentMap === 'cafe' && conf.exitTo === 'outside') {
      if (window.MoGameDays && typeof window.MoGameDays.advanceDayOnExit === 'function') {
        window.MoGameDays.advanceDayOnExit();
      }
    }

    const spawn = MoDoors.spawnForTransition(conf.exitTo);
    if (!spawn) return;
    this._loadMap(conf.exitTo, spawn);
    if (this.audioStarted) Audio.sfxInteract();
  }

  _closeDialogue() {
    const kind = this.dialogueKind;
    if (kind === 'mara_order' && this.orderInputActive) {
      this.dialogueBox.setVisible(false);
      this.dialogueActive = false;
      this.dialogueKind = null;
      if (this.audioStarted) Audio.sfxClose();
      return;
    }
    if (kind === 'visit_beat') {
      const menuApi = window.DragonsBrewMenu;
      const prevPhase = menuApi && menuApi.getVisitPhase ? menuApi.getVisitPhase() : '';
      this.dialogueBox.setVisible(false);
      this.dialogueActive = false;
      this.dialogueKind = null;
      if (this.audioStarted) Audio.sfxClose();
      if (menuApi && typeof menuApi.advanceVisitPhase === 'function') {
        const nextText = menuApi.advanceVisitPhase();
        const newPhase = menuApi.getVisitPhase ? menuApi.getVisitPhase() : '';
        if (nextText) {
          this._showDialogue(nextText, 'visit_beat');
          this._syncVisitPhaseCup();
        } else if (prevPhase === 'pickup' && newPhase === 'dine') {
          this._pickupOrderFromCounter();
          this._showDialogue(
            'Sit at a table — press D to sip your drink, F to eat if you ordered food. Finish before you go.'
          );
        }
      }
      return;
    }
    if (kind === 'mara_intro' && window.DragonsBrewMenu) {
      DragonsBrewMenu.markMaraIntroDone();
    }
    this.dialogueBox.setVisible(false);
    this.dialogueActive = false;
    this.dialogueKind = null;
    if (this.audioStarted) Audio.sfxClose();
    if (kind === 'mara_order') this._openMaraOrderInput('order');
    if (kind === 'mara_quiz') this._openMaraOrderInput('quiz');
  }

  _syncVisitPanelPosition() {
    if (!this.maraVisitWrap || !this.game.canvas) return;
    const cam = this.cameras.main;
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = rect.width / cam.width;
    const scaleY = rect.height / cam.height;
    const boxW = cam.width - DIALOGUE_PAD_X * 2;
    const lines = (this.maraVisitText && this.maraVisitText.textContent || '').split('\n').length;
    const boxH = Math.min(
      cam.height - DIALOGUE_MARGIN - DIALOGUE_TOP_CLEARANCE,
      Math.max(DIALOGUE_MIN_H, 68 + lines * DIALOGUE_LINE_HEIGHT)
    );
    const top = rect.top + (cam.height - DIALOGUE_MARGIN - boxH) * scaleY;
    this.maraVisitWrap.style.left = (rect.left + DIALOGUE_PAD_X * scaleX) + 'px';
    this.maraVisitWrap.style.width = (boxW * scaleX) + 'px';
    this.maraVisitWrap.style.height = (boxH * scaleY) + 'px';
    this.maraVisitWrap.style.top = top + 'px';
    this.maraVisitWrap.style.fontSize = Math.max(14, Math.round(DIALOGUE_BASE_FONT * scaleY)) + 'px';
  }

  _showVisitPanel(text) {
    if (!this.maraVisitWrap || !this.maraVisitText) return;
    if (this.dialogueActive) {
      this.dialogueBox.setVisible(false);
      this.dialogueActive = false;
      this.dialogueKind = null;
    }
    this.visitPanelActive = true;
    this.maraVisitText.textContent = text;
    this.maraVisitWrap.classList.add('is-open');
    this.maraVisitWrap.setAttribute('aria-hidden', 'false');
    this._syncVisitPanelPosition();
    if (this.audioStarted) Audio.sfxInteract();
  }

  _closeVisitPanel() {
    if (!this.maraVisitWrap) return;
    this.visitPanelActive = false;
    this.maraVisitWrap.classList.remove('is-open');
    this.maraVisitWrap.setAttribute('aria-hidden', 'true');
    if (this.audioStarted) Audio.sfxClose();
  }

  _advanceVisitPanel() {
    const menuApi = window.DragonsBrewMenu;
    if (!menuApi || typeof menuApi.advanceVisitPhase !== 'function') {
      this._closeVisitPanel();
      return;
    }
    const nextText = menuApi.advanceVisitPhase();
    if (nextText) {
      this.maraVisitText.textContent = nextText;
      this._syncVisitPanelPosition();
      if (this.audioStarted) Audio.sfxInteract();
      return;
    }
    this._closeVisitPanel();
  }

  _syncMaraOrderInputPosition() {
    if (!this.maraOrderWrap || !this.game.canvas) return;
    const cam = this.cameras.main;
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = rect.width / cam.width;
    const scaleY = rect.height / cam.height;
    const boxW = cam.width - DIALOGUE_PAD_X * 2;
    const boxH = DIALOGUE_ORDER_BOX_H;
    const top = rect.top + (cam.height - DIALOGUE_MARGIN - boxH) * scaleY;
    this.maraOrderWrap.style.left = (rect.left + DIALOGUE_PAD_X * scaleX) + 'px';
    this.maraOrderWrap.style.width = (boxW * scaleX) + 'px';
    this.maraOrderWrap.style.top = top + 'px';
    this.maraOrderWrap.style.height = (boxH * scaleY) + 'px';
    if (this.maraOrderInput) {
      this.maraOrderInput.style.fontSize = Math.max(14, Math.round(DIALOGUE_BASE_FONT * scaleY)) + 'px';
    }
  }

  _setGameKeyboardForOrderInput(active) {
    const kb = this.input && this.input.keyboard;
    if (!kb) return;
    if (active) {
      kb.enabled = false;
      if (typeof kb.disableGlobalCapture === 'function') kb.disableGlobalCapture();
    } else {
      if (typeof kb.enableGlobalCapture === 'function') kb.enableGlobalCapture();
      kb.enabled = true;
    }
  }

  _openMaraOrderInput(mode) {
    if (!this.maraOrderWrap || !this.maraOrderInput) return;
    this.orderInputMode = mode === 'quiz' ? 'quiz' : 'order';
    this.orderInputActive = true;
    this._setGameKeyboardForOrderInput(true);
    this.maraOrderInput.value = '';
    if (this.maraOrderInput) {
      var langApi = window.MoCafeLanguage;
      var placeholder = langApi && typeof langApi.orderPlaceholder === 'function'
        ? langApi.orderPlaceholder(this.orderInputMode === 'quiz' ? 'quiz' : 'order')
        : (this.orderInputMode === 'quiz'
          ? 'Type the word from the board, then Enter'
          : 'Type your order, then Enter');
      this.maraOrderInput.placeholder = placeholder;
      if (langApi && typeof langApi.syncOrderInputUi === 'function') langApi.syncOrderInputUi();
    }
    this.maraOrderWrap.classList.add('is-open');
    this.maraOrderWrap.setAttribute('aria-hidden', 'false');
    this._syncMaraOrderInputPosition();
    requestAnimationFrame(() => {
      if (this.orderInputActive && this.maraOrderInput) this.maraOrderInput.focus();
    });
  }

  _closeMaraOrderInput(playCloseSfx) {
    if (!this.maraOrderWrap || !this.maraOrderInput) return;
    this.orderInputActive = false;
    this.orderInputMode = 'order';
    this.quizItem = null;
    this._setGameKeyboardForOrderInput(false);
    this.maraOrderWrap.classList.remove('is-open');
    this.maraOrderWrap.setAttribute('aria-hidden', 'true');
    this.maraOrderInput.blur();
    if (playCloseSfx !== false && this.audioStarted) Audio.sfxClose();
  }

  _submitMaraOrder() {
    const text = (this.maraOrderInput && this.maraOrderInput.value || '').trim();
    const menuApi = window.DragonsBrewMenu;
    const quizApi = window.MoMenuQuiz;
    const mode = this.orderInputMode;
    const quizItem = this.quizItem;
    this._closeMaraOrderInput(false);
    if (mode === 'quiz' && quizApi && typeof quizApi.evaluateAnswer === 'function') {
      if (!text) {
        var langName = window.MoCafeLanguage && window.MoCafeLanguage.orderLanguageName
          ? window.MoCafeLanguage.orderLanguageName()
          : 'your café language';
        this._showDialogue('Mara waits. "Peek at the board — then tell me the ' + langName + ' word when you\'re ready."');
        return;
      }
      const result = quizApi.evaluateAnswer(quizItem, text);
      this._showDialogue(result.line || 'Mara nods toward the menu board.');
      this.quizItem = null;
      return;
    }
    if (!text) {
      this._showDialogue(
        'Mara waits patiently. "Take your time — look at the board again if you need to."'
      );
      return;
    }
    if (!menuApi || typeof menuApi.beginVisitAfterOrder !== 'function') {
      this._showDialogue(
        'Something didn\'t load right — hard-refresh the page (Shift+reload) and try again.'
      );
      return;
    }
    menuApi.beginVisitAfterOrder(text);
    this._showDialogue(menuApi.getVisitDialogue('reply'), 'visit_beat');
  }

  _pinDialogueBox() {
    const cam = this.cameras.main;
    const boxH = this._dialogueBoxH || DIALOGUE_MIN_H;
    this.dialogueBox.setPosition(
      cam.scrollX,
      cam.scrollY + cam.height - DIALOGUE_MARGIN - boxH
    );
  }

  _layoutDialogueBox() {
    const cam = this.cameras.main;
    const boxW = cam.width - DIALOGUE_PAD_X * 2;
    const wrapW = Math.max(120, boxW - 40);
    const text = this.dialogueText.text;
    const available = cam.height - DIALOGUE_MARGIN - DIALOGUE_TOP_CLEARANCE;
    let fontSize = DIALOGUE_BASE_FONT;
    let boxH = DIALOGUE_MIN_H;

    while (fontSize >= DIALOGUE_MIN_FONT) {
      this.dialogueText.setFontSize(fontSize);
      this.dialogueText.setWordWrapWidth(wrapW, true);
      this.dialogueText.setText(text);
      const textH = Math.ceil(this.dialogueText.getBounds().height);
      const needed = textH + DIALOGUE_TEXT_PAD_Y * 2 + DIALOGUE_TEXT_SLACK;
      boxH = Math.max(DIALOGUE_MIN_H, Math.min(available, needed));
      if (needed <= available) break;
      fontSize -= 1;
    }

    this._dialogueBoxH = boxH;
    const boxX = cam.width / 2;
    this.dialogueBg.setSize(boxW, boxH);
    this.dialogueBorder.setSize(boxW, boxH);
    this.dialogueBg.setPosition(boxX, 0);
    this.dialogueBorder.setPosition(boxX, 0);
    this.dialogueText.setPosition(boxX, DIALOGUE_TEXT_PAD_Y);
    this._pinDialogueBox();
  }

  _onDialogueResize() {
    if (this.dialogueActive) this._layoutDialogueBox();
    if (this.orderInputActive) this._syncMaraOrderInputPosition();
    if (this.visitPanelActive) this._syncVisitPanelPosition();
  }

  _showDialogue(text, kind) {
    this.dialogueKind = kind || null;
    this.dialogueText.setText(text);
    this._layoutDialogueBox();
    this.dialogueBox.setVisible(true);
    this.dialogueActive = true;
  }

  _facingToward(wx, wy) {
    const dx = wx - this.player.x;
    const dy = wy - this.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 24 * SCALE) return true;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    switch (this.facing) {
      case 'down':  return dy > 0 && ady >= adx * 0.45;
      case 'up':    return dy < 0 && ady >= adx * 0.45;
      case 'left':  return dx < 0 && adx >= ady * 0.45;
      case 'right': return dx > 0 && adx >= ady * 0.45;
      default: return false;
    }
  }

  _findNearbyReadable() {
    const range = 88 * SCALE;
    let best = null;
    let bestDist = range;
    READABLES.forEach((item) => {
      if (item.map !== this.currentMap) return;
      const wx = item.col * TILE * SCALE + 16 * SCALE;
      const wy = item.row * TILE * SCALE + 16 * SCALE;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, wx, wy);
      if (dist > range || !this._facingToward(wx, wy)) return;
      if (dist < bestDist) {
        best = item;
        bestDist = dist;
      }
    });
    return best;
  }

  _openRead(item) {
    var body = item.text;
    if (item.dynamic && item.id === 'dragons_brew_menu' && window.DragonsBrewMenu) {
      body = DragonsBrewMenu.formatMenuText();
      DragonsBrewMenu.markMenuViewed();
    }
    this._showDialogue(item.title + '\n\n' + body);
    if (this.audioStarted) Audio.sfxInteract();
  }

  /** Feet tile must be `c` on the café map — no snap from adjacent floor. */
  _chairUnderPlayer() {
    if (this.currentMap !== 'cafe') return null;
    const cell = this._playerGridCell();
    if (cell.col < 0 || cell.col >= COLS || cell.row < 0 || cell.row >= ROWS) return null;
    if (MAPS.cafe.grid[cell.row][cell.col] !== 'c' && MAPS.cafe.grid[cell.row][cell.col] !== 'o') return null;
    return CAFE_SEATS.find((s) => s.col === cell.col && s.row === cell.row) || null;
  }

  _seatedPlayerPos(seat) {
    const u = TILE * SCALE;
    return {
      x: seat.col * u + u / 2,
      y: seat.row * u + CAFE_CHAIR_SIT_Y * SCALE,
    };
  }

  _showSitHint() {
    const now = this.time.now;
    if (this.dialogueActive || now - this.sitHintAt < 2200) return;
    this.sitHintAt = now;
    this._showDialogue('Stand on the chair.');
  }

  _sitAt(seat) {
    this.playerSeated = true;
    this.seatAnchor = seat;
    this.facing = 'up';
    const pos = this._seatedPlayerPos(seat);
    this.player.setPosition(pos.x, pos.y);
    this.player.body.setVelocity(0, 0);
    this.player.body.moves = false;
    this.player.body.updateFromGameObject();
    this.player.setDepth(11);
    this.player.play('idle-up', true);
    this._syncCupPosition();
    this._syncPlatePosition();
  }

  _standUp() {
    this.playerSeated = false;
    this.seatAnchor = null;
    this.player.body.moves = true;
    this.player.body.setVelocity(0, 0);
    this._syncCupPosition();
    this._syncPlatePosition();
    this._applyPlayerDepth();
    if (this.audioStarted) Audio.sfxInteract();
  }

  _canTalkToMara() {
    if (this.currentMap !== 'cafe' || !this.npc.visible) return false;
    const dx = this.npc.x - this.player.x;
    const dy = this.npc.y - this.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 72 * SCALE) return false;
    return this._facingToward(this.npc.x, this.npc.y);
  }

  _openMaraDialogue() {
    var menuApi = window.DragonsBrewMenu;
    if (!menuApi || !menuApi.hasMaraIntroDone()) {
      if (menuApi && typeof menuApi.abandonVisit === 'function') menuApi.abandonVisit();
      this._hideCup();
      this._hidePlate();
      this._showDialogue(this.maraFirstDialogue, 'mara_intro');
    } else if (window.MoGameDays && window.MoGameDays.isDay8OrLater && window.MoGameDays.isDay8OrLater()) {
      this._showDialogue(
        'Mara smiles. "Week two already — your elder will check in soon. For now, the room is yours."'
      );
    } else if (window.MoGameDays && window.MoGameDays.hasAwaitingDayAdvance && window.MoGameDays.hasAwaitingDayAdvance()) {
      this._showDialogue(
        'Mara wipes the counter. "Whenever you\'re ready — step outside. The weekday turns when you leave the café."'
      );
    } else if (window.MoMenuQuiz && window.MoMenuQuiz.shouldOfferQuiz && window.MoMenuQuiz.shouldOfferQuiz()) {
      const quizItem = window.MoMenuQuiz.pickQuizItem();
      if (quizItem) {
        this.quizItem = quizItem;
        this._showDialogue(window.MoMenuQuiz.promptFor(quizItem), 'mara_quiz');
      } else {
        this._showDialogue(
          'Mara checks your card. "Not quite enough for the board today — read the menu and we\'ll practice what you haven\'t ordered yet."'
        );
      }
    } else if (window.MoGameDays && window.MoGameDays.hasCompletedVisitToday && window.MoGameDays.hasCompletedVisitToday()) {
      this._showDialogue(
        'Mara sets down a rag. "You already finished this café day — the next weekday is ready when you are."'
      );
    } else if (menuApi.isVisitInProgress()) {
      const phase = menuApi.getVisitPhase();
      if (phase === 'dine') {
        this._showDialogue('Mara glances your way. "Take your time at the table — finish up when you\'re ready."');
      } else {
        this._showDialogue(menuApi.getVisitDialogue(phase), 'visit_beat');
        this._syncVisitPhaseCup();
      }
    } else if (menuApi.canTakeMaraOrder()) {
      menuApi.markMaraTalk();
      this._showDialogue(
        'Mara wipes the counter. "What\'s your order?"\n\n' + this.maraOrderHint,
        'mara_order'
      );
    } else if (menuApi) {
      this._showDialogue(
        'Mara nods toward the drink menu on the wall. "Take a look at the board first—then come back when you\'re ready to order."'
      );
    } else {
      this._showDialogue(this.maraFirstDialogue, 'mara_intro');
    }
    if (this.audioStarted) Audio.sfxInteract();
  }

  update(time, delta) {
    const { cursors, wasd, player } = this;
    const speed = 100 * SCALE;
    let vx = 0, vy = 0;

    if (this.transitionCooldown > 0) {
      this.transitionCooldown = Math.max(0, this.transitionCooldown - delta);
    }

    if (this.orderInputActive) {
      player.setVelocity(0, 0);
      player.play(`idle-${this.facing}`, true);
      return;
    }

    if (window.MoVisitSetup && window.MoVisitSetup.needsSetup && window.MoVisitSetup.needsSetup()) {
      player.setVelocity(0, 0);
      player.play(`idle-${this.facing}`, true);
      return;
    }

    const left  = cursors.left.isDown  || wasd.left.isDown;
    const right = cursors.right.isDown || wasd.right.isDown;
    const up    = cursors.up.isDown    || wasd.up.isDown;
    const down  = cursors.down.isDown  || wasd.down.isDown;

    // close dialogue — Space, E, or R
    if (this.dialogueActive && (
      Phaser.Input.Keyboard.JustDown(this.spaceKey) ||
      Phaser.Input.Keyboard.JustDown(this.eKey) ||
      Phaser.Input.Keyboard.JustDown(this.rKey)
    )) {
      this._closeDialogue();
      return;
    }

    // R — read sign, board, book, etc.
    if (Phaser.Input.Keyboard.JustDown(this.rKey)) {
      const readable = this._findNearbyReadable();
      if (readable) {
        this._openRead(readable);
        return;
      }
    }

    // E near Mara — first-interaction dialogue
    if (Phaser.Input.Keyboard.JustDown(this.eKey) && this._canTalkToMara()) {
      this._openMaraDialogue();
      return;
    }

    if (this.dialogueActive) {
      this._pinDialogueBox();
      player.setVelocity(0, 0);
      player.play(`idle-${this.facing}`, true);
      return;
    }

    if (this.playerSeated) {
      if (Phaser.Input.Keyboard.JustDown(this.tKey)) {
        this._standUp();
        return;
      }
      if (Phaser.Input.Keyboard.JustDown(this.dKey)) {
        this._sipDrink();
        return;
      }
      if (Phaser.Input.Keyboard.JustDown(this.fKey)) {
        this._eatFood();
        return;
      }
      player.setVelocity(0, 0);
      this.facing = 'up';
      player.setDepth(11);
      this._syncCupPosition();
      this._syncPlatePosition();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.tKey)) {
      const seat = this._chairUnderPlayer();
      if (seat) {
        this._sitAt(seat);
        if (this.audioStarted) Audio.sfxInteract();
        return;
      }
      if (this.currentMap === 'cafe') {
        this._showSitHint();
      }
    }

    if (left)  { vx = -speed; this.facing = 'left'; }
    if (right) { vx =  speed; this.facing = 'right'; }
    if (up)    { vy = -speed; this.facing = 'up'; }
    if (down)  { vy =  speed; this.facing = 'down'; }

    player.setVelocity(vx, vy);

    if (vx !== 0 || vy !== 0) {
      player.play(`walk-${this.facing}`, true);
      if (this.audioStarted) Audio.sfxStep();
    } else {
      player.play(`idle-${this.facing}`, true);
    }

    // update player depth — behind storefront when approaching from the north
    this._applyPlayerDepth();
    this._syncCupPosition();
    this._syncPlatePosition();

    this._checkDoorTransition();
    if (this.doorDebugEnabled && this.doorDebugGfx) {
      this._drawDoorDebug();
    }
  }

  _drawDoorDebug() {
    const g = this.doorDebugGfx;
    g.clear();
    const walkBands = MoDoors.walkBandRectsScaled(this.currentMap);
    walkBands.forEach((band) => {
      g.fillStyle(0x00ff00, 0.25);
      g.fillRect(band.left, band.top, band.right - band.left, band.bottom - band.top);
    });
    const facade = MoDoors.facadeDoorWorldRectScaled();
    if (this.currentMap === 'outside') {
      g.lineStyle(2, 0x88ff88, 0.5);
      g.strokeRect(facade.left, facade.top, facade.right - facade.left, facade.bottom - facade.top);
    }
    const keys = this._doorInputKeys();
    const triggers = MoDoors.triggerCellRectScaled(this.currentMap, keys) || [];
    triggers.forEach((trigger) => {
      g.fillStyle(0xffff00, 0.45);
      g.fillRect(trigger.left, trigger.top, trigger.right - trigger.left, trigger.bottom - trigger.top);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
const GAME_W = W * SCALE;
const GAME_H = H * SCALE;

const config = {
  type: Phaser.AUTO,
  width:  GAME_W,
  height: GAME_H,
  parent: 'game',
  backgroundColor: '#5a4038',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: GameScene
};

const game = new Phaser.Game(config);
window.__moGame = game;
window.addEventListener('resize', () => game.scale.refresh());
