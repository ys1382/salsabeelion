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
const ROWS   = 15;
const W      = TILE * COLS;
const H      = TILE * ROWS;
const SCALE  = 2;   // pixel-art upscale
const DIALOGUE_MARGIN = 36;
const DIALOGUE_PAD_X = 40;
const DIALOGUE_TEXT_PAD_Y = 14;
const DIALOGUE_TEXT_SLACK = 14;
const DIALOGUE_MIN_H = 80;
const DIALOGUE_TOP_CLEARANCE = 56;
const DIALOGUE_BASE_FONT = 13;
const DIALOGUE_MIN_FONT = 9;

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

function drawStreetPath(ctx, ox, oy) {
  rect(ctx, ox, oy, 32, 32, '#5a5850');
  [[4,8],[14,4],[22,12],[8,18],[18,24]].forEach(([dx, dy]) => {
    rect(ctx, ox + dx, oy + dy, 3, 2, '#4a4840');
  });
  rect(ctx, ox, oy, 32, 2, '#6a6860');
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

// Draw a sign  (32×32)
function drawSign(ctx, ox, oy) {
  // post
  rect(ctx, ox+14, oy+20, 4, 12, '#6b3d1e');
  // board
  rect(ctx, ox+4, oy+6, 24, 16, '#c4a35a');
  rect(ctx, ox+5, oy+7, 22, 14, '#d4b36a');
  // writing lines
  rect(ctx, ox+8, oy+10, 16, 2, '#7a5a20');
  rect(ctx, ox+8, oy+15, 12, 2, '#7a5a20');
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

function drawBrewSign(ctx, ox, oy) {
  drawFacadeWall(ctx, ox, oy);
  rect(ctx, ox + 2, oy + 5, 28, 20, '#2a1810');
  rect(ctx, ox + 4, oy + 7, 24, 3, '#d4af6a');
  rect(ctx, ox + 4, oy + 12, 20, 2, '#c49a5a');
  rect(ctx, ox + 4, oy + 16, 16, 2, '#c49a5a');
  rect(ctx, ox + 4, oy + 20, 12, 2, '#a08040');
}

// One cohesive storefront (8×5 tiles) — no grass gaps, reads as a real building
function drawStreetBuildingFacade(ctx, bw, bh) {
  const brick = '#7a5848', brickD = '#6a4838', trim = '#5a3828';

  // roof + overhang shadow
  rect(ctx, 0, 0, bw, 38, '#3a2830');
  for (let i = 0; i < 7; i++) {
    rect(ctx, 0, 6 + i * 4, bw, 3, i % 2 === 0 ? '#4a3848' : '#3a2830');
  }
  rect(ctx, 0, 34, bw, 6, '#2a1820');
  rect(ctx, 4, 38, bw - 8, 4, 'rgba(0,0,0,0.25)');

  // main wall
  rect(ctx, 0, 42, bw, bh - 42, brick);
  for (let y = 48; y < bh - 8; y += 10) rect(ctx, 4, y, bw - 8, 1, brickD);
  for (let x = 20; x < bw - 16; x += 28) {
    for (let y = 44; y < bh - 12; y += 10) rect(ctx, x, y, 1, 8, brickD);
  }

  // left window
  rect(ctx, 28, 58, 52, 44, trim);
  rect(ctx, 34, 64, 40, 32, '#3a4858');
  rect(ctx, 36, 66, 14, 12, '#6a8898');

  // right window
  rect(ctx, bw - 80, 58, 52, 44, trim);
  rect(ctx, bw - 74, 64, 40, 32, '#3a4858');
  rect(ctx, bw - 72, 66, 14, 12, '#6a8898');

  // sign board (center)
  rect(ctx, 88, 52, 80, 50, '#2a1810');
  rect(ctx, 92, 58, 72, 4, '#d4af6a');
  rect(ctx, 92, 66, 58, 3, '#c49a5a');
  rect(ctx, 92, 74, 44, 3, '#a08040');
  rect(ctx, 92, 82, 30, 3, '#806030');

  // awning
  for (let i = 0; i < 6; i++) {
    rect(ctx, 52 + i * 26, 108, 22, 18, i % 2 === 0 ? '#8a3040' : '#d4af6a');
  }
  rect(ctx, 48, 124, bw - 96, 4, trim);

  // door (center-bottom)
  const dx = Math.floor(bw / 2) - 28;
  rect(ctx, dx, 118, 56, 38, '#3a2820');
  rect(ctx, dx + 4, 122, 48, 30, '#1a1008');
  rect(ctx, dx + 10, 128, 36, 20, '#3a3028');
  rect(ctx, dx + 14, 132, 8, 8, '#d4a860');
  rect(ctx, dx + 44, 142, 3, 4, '#d4af6a');
  rect(ctx, dx + 2, 152, 52, 6, '#4a3828');

  // foundation sill
  rect(ctx, 0, bh - 8, bw, 8, trim);
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
  rect(ctx, ox + 8, oy + 10, 16, 8, '#6b3d1e');
  rect(ctx, ox + 14, oy + 18, 4, 8, '#5a3020');
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

// ─────────────────────────────────────────────────────────────────────────────
//  Character spritesheet  (4 rows × 4 frames, each frame 16×24)
//  Rows: down, left, right, up
// ─────────────────────────────────────────────────────────────────────────────
const CHAR_W = 16, CHAR_H = 24, CHAR_FRAMES = 4;
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

function drawCharFrame(ctx, fx, fy, dir, frame) {
  const ox = fx * CHAR_W, oy = fy * CHAR_H;
  const skin = '#f0c080', hair = '#5a3010', shirt = '#3a7ac8', pants = '#2a3a6a', shoe = '#2a1a0a';

  // clear
  ctx.clearRect(ox, oy, CHAR_W, CHAR_H);

  // legs / walk bob
  const walkOffset = (frame === 1 || frame === 3) ? 0 : 1;
  const legL = frame < 2 ? 1 : -1;

  if (dir !== 3) { // not up — show shoes
    rect(ctx, ox+3+legL, oy+18+walkOffset, 4, 4, pants);
    rect(ctx, ox+9-legL, oy+18+walkOffset, 4, 4, pants);
    rect(ctx, ox+3+legL, oy+21+walkOffset, 4, 3, shoe);
    rect(ctx, ox+9-legL, oy+21+walkOffset, 4, 3, shoe);
  } else {
    rect(ctx, ox+3, oy+18, 10, 6, pants);
  }

  // body
  rect(ctx, ox+3, oy+10, 10, 9, shirt);

  // arms — shirt sleeves to wrist, bare hands
  if (dir !== 3) {
    rect(ctx, ox+1, oy+10, 2, 6, shirt);
    rect(ctx, ox+13, oy+10, 2, 6, shirt);
    rect(ctx, ox+1, oy+16, 2, 2, skin);
    rect(ctx, ox+13, oy+16, 2, 2, skin);
  } else {
    rect(ctx, ox+1, oy+10, 2, 7, shirt);
    rect(ctx, ox+13, oy+10, 2, 7, shirt);
  }

  // head
  rect(ctx, ox+3, oy+2, 10, 9, skin);

  // hair
  rect(ctx, ox+3, oy+2, 10, 3, hair);
  if (dir === 3) { // up — show back of head
    rect(ctx, ox+3, oy+2, 10, 5, hair);
  }

  // face (only for down/left/right)
  if (dir === 0) { // down
    rect(ctx, ox+5, oy+7, 2, 2, '#1a0a00'); // eyes
    rect(ctx, ox+9, oy+7, 2, 2, '#1a0a00');
    rect(ctx, ox+6, oy+10, 4, 1, '#c07050'); // mouth
  } else if (dir === 1) { // left
    rect(ctx, ox+5, oy+7, 2, 2, '#1a0a00');
    rect(ctx, ox+5, oy+10, 3, 1, '#c07050');
  } else if (dir === 2) { // right
    rect(ctx, ox+9, oy+7, 2, 2, '#1a0a00');
    rect(ctx, ox+8, oy+10, 3, 1, '#c07050');
  }

  // shadow
  rect(ctx, ox+4, oy+23, 8, 1, 'rgba(0,0,0,0.3)');
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
  'h': 19, 'n': 20, 'w': 21, 'R': 22, 'A': 23, 'H': 24,
};

const SOLID_TILES = new Set([3, 4, 5, 8, 12, 13, 14, 16, 17, 19, 20, 22, 23]);

/** @type {Array<{ map: string, col: number, row: number, title: string, text: string }>} */
const READABLES = [
  {
    map: 'outside',
    col: 3,
    row: 12,
    title: 'Neighborhood board',
    text: 'Dragon\'s Brew — down the brick path, mornings.\nPlaza market beyond the train station when you\'re ready to venture out.',
  },
  {
    map: 'outside',
    col: 8,
    row: 7,
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

const OUTSIDE_BUILDING = { left: 5, top: 6, width: 8, height: 5, doorCol: 8, doorRow: 10 };
const CAFE_DOOR_ROW = 9;

const MAPS = {
  outside: {
    backgroundColor: '#1a1a2e',
    doorTile: 'D',
    doorPos: { col: OUTSIDE_BUILDING.doorCol, row: OUTSIDE_BUILDING.doorRow },
    doorFacing: 'up',
    exitTo: 'cafe',
    exitSpawn: { col: OUTSIDE_BUILDING.doorCol, row: CAFE_DOOR_ROW, facing: 'up' },
    playerStart: { col: 4, row: 11 },
    mara: null,
    grid: [
      '####################',
      '#1................1#',
      '#..1....1....1.....#',
      '#..................#',
      '#...wwwwwwwwww.....#',
      '#...w........w.....#',
      '#...w........w.....#',
      '#...w........w.....#',
      '#...w........w.....#',
      '#...w........w.....#',
      '#...PPPPPPPPPP.....#',
      '#..S..f............#',
      '#..................#',
      '#..................#',
      '####################',
    ].map(r => r.split('')),
  },
  cafe: {
    backgroundColor: '#241818',
    doorTile: '>',
    doorPos: { col: OUTSIDE_BUILDING.doorCol, row: CAFE_DOOR_ROW },
    doorFacing: 'down',
    exitTo: 'outside',
    exitSpawn: { col: OUTSIDE_BUILDING.doorCol, row: OUTSIDE_BUILDING.doorRow, facing: 'down' },
    playerStart: { col: OUTSIDE_BUILDING.doorCol, row: CAFE_DOOR_ROW, facing: 'up' },
    mara: { col: 10, row: 2 },
    grid: [
      '####################',
      '#||||||||||||||||||#',
      '#|MKH.............|#',
      '#=**===-------===**#',
      '#=................=#',
      '#=................=#',
      '#=................=#',
      '#=................=#',
      '#=................=#',
      '#|||||||>||||||||||#',
      '#=................=#',
      '#=................=#',
      '#=................=#',
      '#=................=#',
      '####################',
    ].map(r => r.split('')),
  },
};

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
    add('t_sign',   32, 32, ctx => drawSign(ctx, 0, 0));
    add('t_flower', 32, 32, ctx => drawFlower(ctx, 0, 0, '#ff6688'));
    add('t_wall',   32, 32, ctx => drawBuildingWall(ctx, 0, 0));
    add('t_door',   32, 32, ctx => drawDoorEnter(ctx, 0, 0));
    add('t_brew',   32, 32, ctx => drawBrewSign(ctx, 0, 0));
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
    add('t_exit',   32, 32, ctx => drawExitDoor(ctx, 0, 0));
    add('t_menu',   32, 32, ctx => drawMenuBoard(ctx, 0, 0));
    add('t_strike', 32, 32, ctx => drawStrikeBoard(ctx, 0, 0));
    add('t_hrules', 32, 32, ctx => drawHouseRulesBoard(ctx, 0, 0));
    add('t_book',   32, 32, ctx => drawBookOnFloor(ctx, 0, 0));
    add('t_street', 32, 32, ctx => drawStreetPath(ctx, 0, 0));
    const bc = makeCanvas(OUTSIDE_BUILDING.width * 32, OUTSIDE_BUILDING.height * 32);
    drawStreetBuildingFacade(bc.getContext('2d'), bc.width, bc.height);
    this.textures.addCanvas('street_building', bc);
  }

  _buildCharTexture() {
    // 4 dirs × 4 frames, each 16×24  → canvas 64×96
    const c = makeCanvas(CHAR_W * CHAR_FRAMES, CHAR_H * 4);
    const ctx = c.getContext('2d');
    for (let dir = 0; dir < 4; dir++) {
      for (let frame = 0; frame < CHAR_FRAMES; frame++) {
        drawCharFrame(ctx, frame, dir, dir, frame);
      }
    }
    this.textures.addCanvas('player', c);
    this.textures.get('player').add('down0',  0,  0,  0, CHAR_W, CHAR_H);
    this.textures.get('player').add('down1',  0, CHAR_W,  0, CHAR_W, CHAR_H);
    this.textures.get('player').add('down2',  0, CHAR_W*2,0, CHAR_W, CHAR_H);
    this.textures.get('player').add('down3',  0, CHAR_W*3,0, CHAR_W, CHAR_H);
    for (let dir = 0; dir < 4; dir++) {
      const dirName = ['down','left','right','up'][dir];
      this.textures.get('player').add(`${dirName}0`, 0, 0,          dir*CHAR_H, CHAR_W, CHAR_H);
      this.textures.get('player').add(`${dirName}1`, 0, CHAR_W,     dir*CHAR_H, CHAR_W, CHAR_H);
      this.textures.get('player').add(`${dirName}2`, 0, CHAR_W*2,   dir*CHAR_H, CHAR_W, CHAR_H);
      this.textures.get('player').add(`${dirName}3`, 0, CHAR_W*3,   dir*CHAR_H, CHAR_W, CHAR_H);
    }
  }

  _buildNPCTexture() {
    const c = makeCanvas(NPC_W, NPC_H);
    const ctx = c.getContext('2d');
    drawNPC(ctx, 0, 0);
    this.textures.addCanvas('npc', c);
  }

  create() {
    this.currentMap = 'outside';
    this.transitionCooldown = 0;

    this.groundLayer = this.add.container(0, 0);
    this.tallLayer   = this.add.container(0, 0);
    this.solidBodies = this.physics.add.staticGroup();

    this.player = this.physics.add.sprite(0, 0, 'player');
    this.player.setScale(SCALE);
    this.player.setDepth(10);
    this.player.body.setSize(10 * SCALE, 8 * SCALE);
    this.player.body.setOffset(3 * SCALE, 16 * SCALE);

    const dirs = ['down','left','right','up'];
    dirs.forEach(dir => {
      this.anims.create({
        key: `walk-${dir}`,
        frames: [0,1,2,3].map(i => ({ key: 'player', frame: `${dir}${i}` })),
        frameRate: 8,
        repeat: -1
      });
      this.anims.create({
        key: `idle-${dir}`,
        frames: [{ key: 'player', frame: `${dir}0` }],
        frameRate: 1,
        repeat: 0
      });
    });
    this.player.play('idle-down');
    this.facing = 'down';

    this.npc = this.add.image(0, 0, 'npc').setScale(SCALE).setDepth(10).setVisible(false);

    // ── dialogue box (screen-fixed; laid out to stay inside visible area) ───
    this.dialogueActive = false;
    this.dialogueKind = null;
    this.orderInputActive = false;
    this.dialogueBox = this.add.container(0, 0).setDepth(50).setScrollFactor(0).setVisible(false);
    this.dialogueBg = this.add.rectangle(0, 0, W * SCALE - DIALOGUE_PAD_X * 2, DIALOGUE_MIN_H, 0x000000, 0.82).setOrigin(0.5, 0);
    this.dialogueBorder = this.add.rectangle(0, 0, W * SCALE - DIALOGUE_PAD_X * 2, DIALOGUE_MIN_H).setStrokeStyle(2, 0xffe066).setOrigin(0.5, 0);
    this.dialogueText = this.add.text(0, DIALOGUE_TEXT_PAD_Y, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      lineSpacing: 4,
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
      '(Give your order in spanish by typing on keyboard. Hold letters to see the forms they can take to type it in spanish.)';

    this.maraOrderWrap = document.getElementById('mara-order-wrap');
    this.maraOrderInput = document.getElementById('mara-order-input');
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

    this._loadMap('outside');
  }

  _isOutsideBuildingCell(rx, ry) {
    const b = OUTSIDE_BUILDING;
    return rx >= b.left && rx < b.left + b.width && ry >= b.top && ry < b.top + b.height;
  }

  _isOutsideDoorCell(rx, ry) {
    const b = OUTSIDE_BUILDING;
    return rx === b.doorCol && ry === b.doorRow;
  }

  /** Solid walls except the door and sidewalk path on the porch row. */
  _isOutsideBuildingSolid(rx, ry) {
    if (!this._isOutsideBuildingCell(rx, ry)) return false;
    if (this._isOutsideDoorCell(rx, ry)) return false;
    const porchRow = OUTSIDE_BUILDING.top + OUTSIDE_BUILDING.height - 1;
    if (ry === porchRow && MAPS.outside.grid[ry][rx] === 'P') return false;
    return true;
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
    if (ch === 'P' && ry >= 10) return 't_street';
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

  _canUseDoor(conf) {
    const cell = this._playerCenterCell();
    if (!this._isDoorTile(conf, conf.grid, cell.col, cell.row)) return false;
    return !conf.doorFacing || this.facing === conf.doorFacing;
  }

  _isDoorTile(conf, grid, col, row) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    if (conf.doorPos && col === conf.doorPos.col && row === conf.doorPos.row) return true;
    return grid[row][col] === conf.doorTile;
  }

  _tilePos(col, row) {
    return {
      x: col * TILE * SCALE + (TILE / 2) * SCALE,
      y: row * TILE * SCALE + (TILE / 2) * SCALE,
    };
  }

  _spawnPlayer(spawn) {
    const u = TILE * SCALE;
    this.player.setPosition(
      spawn.col * u + u / 2,
      spawn.row * u + u / 2
    );
    if (spawn.facing) {
      this.facing = spawn.facing;
      this.player.play(`idle-${this.facing}`, true);
    }
    this.player.body.updateFromGameObject();
  }

  _loadMap(mapKey, spawn) {
    this.currentMap = mapKey;
    const mapData = MAPS[mapKey];
    const grid = mapData.grid;

    this.groundLayer.removeAll(true);
    this.tallLayer.removeAll(true);
    this.solidBodies.clear(true, true);
    if (this.streetBuildingImg) {
      this.streetBuildingImg.destroy();
      this.streetBuildingImg = null;
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

        if (mapKey === 'outside' && ch === 'w' && rx >= b.left && rx < b.left + b.width) {
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
        } else if (tid === 13) {
          const floor = this.add.image(wx, wy, 't_cfloor').setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(floor);
          const bar = this.add.image(wx, wy, 't_counter_bar').setOrigin(0, 0).setScale(SCALE).setDepth(11);
          this.tallLayer.add(bar);
          const body = this.add.rectangle(wx + 16 * SCALE, wy + 16 * SCALE, 32 * SCALE, 32 * SCALE);
          this.physics.add.existing(body, true);
          this.solidBodies.add(body);
        } else if (mapKey === 'cafe' && ch === '>') {
          const floor = this.add.image(wx, wy, 't_cfloor').setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(floor);
          const door = this.add.image(wx, wy, 't_exit').setOrigin(0, 0).setScale(SCALE).setDepth(11);
          this.tallLayer.add(door);
        } else {
          const useStreet = mapKey === 'outside' && ch === 'P' && ry >= 10;
          let key = useStreet ? 't_street' : (TILE_KEY[tid] ?? 't_grass');
          if (mapKey === 'cafe' && (tid === 0 || tid === 1)) key = 't_cfloor';
          const img = this.add.image(wx, wy, key).setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(img);

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

      for (let ry = b.top; ry < b.top + b.height; ry++) {
        for (let rx = b.left; rx < b.left + b.width; rx++) {
          if (!this._isOutsideBuildingSolid(rx, ry)) continue;
          const wx = rx * TILE * SCALE + 16 * SCALE;
          const wy = ry * TILE * SCALE + 16 * SCALE;
          const body = this.add.rectangle(wx, wy, 32 * SCALE, 32 * SCALE);
          this.physics.add.existing(body, true);
          this.solidBodies.add(body);
        }
      }
    }

    this._spawnPlayer(spawn || mapData.playerStart);

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

    this.transitionCooldown = 150;
    if (this.dialogueActive) this._closeDialogue();
    if (this.orderInputActive) this._closeMaraOrderInput();
  }

  _checkDoorTransition() {
    if (this.transitionCooldown > 0) return;

    const conf = MAPS[this.currentMap];
    if (!this._canUseDoor(conf)) return;

    const spawn = conf.exitSpawn || MAPS[conf.exitTo].playerStart;
    this._loadMap(conf.exitTo, spawn);
    if (this.audioStarted) Audio.sfxInteract();
  }

  _closeDialogue() {
    const openOrderInput = this.dialogueKind === 'mara_order';
    this.dialogueBox.setVisible(false);
    this.dialogueActive = false;
    this.dialogueKind = null;
    if (this.audioStarted) Audio.sfxClose();
    if (openOrderInput) this._openMaraOrderInput();
  }

  _syncMaraOrderInputPosition() {
    if (!this.maraOrderWrap || !this.game.canvas) return;
    const cam = this.cameras.main;
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = rect.width / cam.width;
    const scaleY = rect.height / cam.height;
    const boxW = cam.width - DIALOGUE_PAD_X * 2;
    const boxH = 44;
    const top = rect.top + (cam.height - DIALOGUE_MARGIN - boxH) * scaleY;
    this.maraOrderWrap.style.left = (rect.left + DIALOGUE_PAD_X * scaleX) + 'px';
    this.maraOrderWrap.style.width = (boxW * scaleX) + 'px';
    this.maraOrderWrap.style.top = top + 'px';
    this.maraOrderWrap.style.height = (boxH * scaleY) + 'px';
    if (this.maraOrderInput) {
      this.maraOrderInput.style.fontSize = Math.max(11, Math.round(13 * scaleY)) + 'px';
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

  _openMaraOrderInput() {
    if (!this.maraOrderWrap || !this.maraOrderInput) return;
    this.orderInputActive = true;
    this._setGameKeyboardForOrderInput(true);
    this.maraOrderInput.value = '';
    this.maraOrderWrap.classList.add('is-open');
    this.maraOrderWrap.setAttribute('aria-hidden', 'false');
    this._syncMaraOrderInputPosition();
    requestAnimationFrame(() => {
      if (this.orderInputActive && this.maraOrderInput) this.maraOrderInput.focus();
    });
  }

  _closeMaraOrderInput() {
    if (!this.maraOrderWrap || !this.maraOrderInput) return;
    this.orderInputActive = false;
    this._setGameKeyboardForOrderInput(false);
    this.maraOrderWrap.classList.remove('is-open');
    this.maraOrderWrap.setAttribute('aria-hidden', 'true');
    this.maraOrderInput.blur();
    if (this.audioStarted) Audio.sfxClose();
  }

  _submitMaraOrder() {
    const text = (this.maraOrderInput && this.maraOrderInput.value || '').trim();
    this._closeMaraOrderInput();
    if (window.DragonsBrewMenu) {
      DragonsBrewMenu.recordOrderSuccess(!!text);
    }
    if (text && this.audioStarted) Audio.sfxInteract();
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
    if (!menuApi || !menuApi.hasMaraMet()) {
      if (menuApi) menuApi.markMaraMet();
      this._showDialogue(this.maraFirstDialogue);
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
      this._showDialogue(this.maraFirstDialogue);
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

    this._checkDoorTransition();
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
window.addEventListener('resize', () => game.scale.refresh());
