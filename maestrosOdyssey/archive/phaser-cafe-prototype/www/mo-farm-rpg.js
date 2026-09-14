// ─────────────────────────────────────────────────────────────────────────────
//  Web Audio engine  (chiptune music + SFX, no external files)
// ─────────────────────────────────────────────────────────────────────────────
const moAudioActivity = { canvasVisible: true };

function moPageCanPlayAudio() {
  if (document.hidden || document.visibilityState === 'hidden') return false;
  if (typeof document.hasFocus === 'function' && !document.hasFocus()) return false;
  if (!moAudioActivity.canvasVisible) return false;
  return true;
}

const MoWebAudio = (() => {
  let ctx = null;
  let masterGain = null;
  let sfxGain = null;
  let musicTimeout = null;
  let musicPlaying = false;
  let stepTime = 0;
  let htmlPrimed = false;
  let htmlDoorOpen = null;
  let htmlDoorClose = null;

  function samplesToWavDataUri(samples, sampleRate) {
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      pcm[i] = s * 32767;
    }
    const bytes = new Uint8Array(44 + pcm.length * 2);
    const view = new DataView(bytes.buffer);
    const writeStr = (off, s) => { for (let j = 0; j < s.length; j++) bytes[off + j] = s.charCodeAt(j); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + pcm.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'data:audio/wav;base64,' + btoa(bin);
  }

  /** Wooden café door — smooth rising hinge creak, tiny latch click. No noise (reads as gravel). */
  function makeDoorOpenSamples(sampleRate) {
    const duration = 0.4;
    const n = Math.floor(sampleRate * duration);
    const out = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const attack = Math.min(1, t / 0.035);
      const release = Math.max(0, 1 - Math.max(0, t - 0.3) / 0.1);
      const env = attack * release;
      const trem = 0.84 + 0.16 * Math.sin(t * 8.5);
      const freq = 155 + Math.pow(t / duration, 1.35) * 320;
      phase += (2 * Math.PI * freq) / sampleRate;
      const body = Math.sin(phase);
      const wood = Math.sin(phase * 2.02) * 0.18 + Math.sin(phase * 3.1) * 0.06;
      out[i] = (body + wood) * env * trem * 0.5;
    }
    const click0 = Math.floor(n * 0.86);
    const clickN = Math.floor(sampleRate * 0.02);
    for (let j = 0; j < clickN && click0 + j < n; j++) {
      const ct = j / sampleRate;
      out[click0 + j] += Math.sin(2 * Math.PI * 480 * ct) * Math.exp(-ct * 80) * 0.1;
    }
    return out;
  }

  /** Café door shut — soft wooden bump into the frame. */
  function makeDoorCloseSamples(sampleRate) {
    const n = Math.floor(sampleRate * 0.13);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 30);
      const thud = Math.sin(2 * Math.PI * 64 * t) * 0.8;
      const frame = Math.sin(2 * Math.PI * 108 * t) * 0.14 * Math.exp(-t * 45);
      out[i] = (thud + frame) * env;
    }
    return out;
  }

  function doorOpenWavUri() {
    return samplesToWavDataUri(makeDoorOpenSamples(22050), 22050);
  }

  function doorCloseWavUri() {
    return samplesToWavDataUri(makeDoorCloseSamples(22050), 22050);
  }

  function doorSamplesToBuffer(open) {
    const sr = ctx.sampleRate;
    const samples = open ? makeDoorOpenSamples(sr) : makeDoorCloseSamples(sr);
    const buf = ctx.createBuffer(1, samples.length, sr);
    buf.getChannelData(0).set(samples);
    return buf;
  }

  function playDoorWeb(open) {
    const src = ctx.createBufferSource();
    src.buffer = doorSamplesToBuffer(open);
    const g = ctx.createGain();
    g.gain.value = 0.88;
    src.connect(g);
    connectSfx(g);
    src.start(ctx.currentTime);
  }

  function init() {
    if (ctx && ctx.state !== 'closed') return;
    ctx = null;
    masterGain = null;
    sfxGain = null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ctx = new Ctx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.28;
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.95;
    sfxGain.connect(masterGain);
    masterGain.connect(ctx.destination);
  }

  function primeSilentBuffer() {
    if (!ctx) return;
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) { /* ignore */ }
  }

  function primeHtmlDoorAudio() {
    if (htmlPrimed) return;
    try {
      htmlDoorOpen = new window.Audio(doorOpenWavUri());
      htmlDoorClose = new window.Audio(doorCloseWavUri());
      htmlDoorOpen.preload = 'auto';
      htmlDoorClose.preload = 'auto';
      const silent = new window.Audio(samplesToWavDataUri(new Float32Array(8), 22050));
      silent.volume = 0.01;
      const p = silent.play();
      if (p && typeof p.then === 'function') p.then(() => {}).catch(() => {});
      htmlPrimed = true;
    } catch (e) { /* ignore */ }
  }

  function playHtmlDoor(open) {
    const clip = open ? htmlDoorOpen : htmlDoorClose;
    if (!clip) return false;
    try {
      clip.currentTime = 0;
      clip.volume = 0.88;
      const p = clip.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      return true;
    } catch (e) {
      return false;
    }
  }

  function isReady() {
    return !!(ctx && ctx.state === 'running');
  }

  /** Must run inside a real click/key handler. */
  function unlock(onReady) {
    init();
    primeHtmlDoorAudio();
    if (!ctx) {
      if (typeof onReady === 'function') onReady();
      return;
    }
    primeSilentBuffer();
    const done = () => {
      if (!musicPlaying && moPageCanPlayAudio()) startMusic();
      if (typeof onReady === 'function') onReady();
    };
    if (ctx.state === 'suspended') {
      const resumed = ctx.resume();
      if (resumed && typeof resumed.then === 'function') resumed.then(done).catch(done);
      else done();
    } else {
      done();
    }
  }

  function connectSfx(node) {
    node.connect(sfxGain || masterGain);
  }

  function noiseBurst(startTime, duration, vol) {
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(vol, startTime);
    g.gain.linearRampToValueAtTime(0.0001, startTime + duration);
    src.connect(g);
    connectSfx(g);
    src.start(startTime);
  }

  function tone(freq, type, startTime, duration, vol = 1, env = true) {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (env) {
      g.gain.setValueAtTime(0.0001, startTime);
      g.gain.linearRampToValueAtTime(vol, startTime + 0.01);
      g.gain.linearRampToValueAtTime(0.0001, startTime + duration);
    } else {
      g.gain.setValueAtTime(vol, startTime);
      g.gain.linearRampToValueAtTime(0, startTime + duration);
    }
    osc.connect(g);
    connectSfx(g);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  const SCALE = [261.63, 293.66, 329.63, 392.00, 440.00,
                 523.25, 587.33, 659.25, 783.99, 880.00];
  const MELODY = [4,2,0,2,4,4,4, 2,2,2, 4,7,7, 4,2,0,2,4,4,4,4,2,2,4,2,0];
  const BASS   = [0,0,4,0,0,4,4, 0,0,4, 0,4,4, 0,0,4,0,0,4,4,0,0,4,0,0];
  const DUR    = 0.18;

  function playMusicBeat(step) {
    if (!musicPlaying || !ctx) return;
    if (!moPageCanPlayAudio()) {
      suspend(false);
      return;
    }
    try {
      const t = ctx.currentTime + 0.05;
      const mi = step % MELODY.length;
      tone(SCALE[MELODY[mi]],          'square',   t, DUR * 0.8, 0.55);
      tone(SCALE[MELODY[mi]] * 1.005,  'square',   t, DUR * 0.8, 0.28);
      tone(SCALE[BASS[mi]] / 2,        'triangle', t, DUR * 0.9, 0.45);
      if (step % 2 === 0) {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.15;
        const src = ctx.createBufferSource();
        const g2  = ctx.createGain();
        src.buffer = buf;
        g2.gain.setValueAtTime(0.35, t);
        g2.gain.linearRampToValueAtTime(0.0001, t + 0.04);
        src.connect(g2);
        g2.connect(masterGain);
        src.start(t);
      }
    } catch (e) { /* keep music loop alive */ }
    musicTimeout = setTimeout(() => playMusicBeat(step + 1), DUR * 1000);
  }

  function startMusic() {
    if (musicPlaying) return;
    if (!moPageCanPlayAudio()) return;
    musicPlaying = true;
    playMusicBeat(0);
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicTimeout) {
      clearTimeout(musicTimeout);
      musicTimeout = null;
    }
  }

  function suspend(hard) {
    stopMusic();
    try {
      if (htmlDoorOpen) {
        htmlDoorOpen.pause();
        htmlDoorOpen.currentTime = 0;
      }
      if (htmlDoorClose) {
        htmlDoorClose.pause();
        htmlDoorClose.currentTime = 0;
      }
      if (!ctx) return;
      if (hard) {
        if (ctx.state !== 'closed') ctx.close();
        ctx = null;
        masterGain = null;
        sfxGain = null;
        return;
      }
      if (ctx.state === 'running') {
        const p = ctx.suspend();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch (e) { /* ignore */ }
  }

  function sfxStep() {
    if (!isReady()) return;
    const now = ctx.currentTime;
    if (now - stepTime < 0.22) return;
    stepTime = now;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * 0.3;
    const src = ctx.createBufferSource();
    const g   = ctx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(0.65, now);
    g.gain.linearRampToValueAtTime(0.0001, now + 0.06);
    src.connect(g);
    connectSfx(g);
    src.start(now);
  }

  function sfxInteract() {
    if (!isReady()) return;
    const t = ctx.currentTime;
    tone(523.25, 'square', t,        0.08, 0.7);
    tone(659.25, 'square', t + 0.08, 0.08, 0.7);
    tone(783.99, 'square', t + 0.16, 0.15, 0.7);
  }

  function sfxClose() {
    if (!isReady()) return;
    const t = ctx.currentTime;
    tone(392.00, 'triangle', t,       0.07, 0.5);
    tone(329.63, 'triangle', t + 0.07, 0.07, 0.5);
  }

  /** Door — wood creak / latch thud (primed HTML clip, Web Audio fallback). */
  function sfxDoorOpen() {
    if (playHtmlDoor(true)) return;
    if (!isReady()) return;
    playDoorWeb(true);
  }

  function sfxDoorClose() {
    if (playHtmlDoor(false)) return;
    if (!isReady()) return;
    playDoorWeb(false);
  }

  return {
    unlock, isReady, startMusic, stopMusic, suspend,
    sfxStep, sfxInteract, sfxClose, sfxDoorOpen, sfxDoorClose,
  };
})();

function moSyncSceneAudioStarted() {
  const game = window.__moGame;
  if (!game || !game.scene) return;
  const scene = game.scene.getScene('GameScene');
  if (scene) scene.audioStarted = true;
}

function moUnlockAudioFromUserGesture(onReady) {
  MoWebAudio.unlock(() => {
    moSyncSceneAudioStarted();
    if (typeof onReady === 'function') onReady();
  });
}

window.MoAudio = {
  unlock: moUnlockAudioFromUserGesture,
  isReady: () => MoWebAudio.isReady(),
  suspend: (hard) => MoWebAudio.suspend(!!hard),
};

function moBindAudioLifecycle() {
  const suspendSoft = () => {
    if (!moPageCanPlayAudio()) MoWebAudio.suspend(false);
  };
  const suspendHard = () => MoWebAudio.suspend(true);

  window.addEventListener('pagehide', suspendHard);
  window.addEventListener('beforeunload', suspendHard);
  document.addEventListener('freeze', suspendHard, { capture: true });
  document.addEventListener('visibilitychange', suspendSoft);
  window.addEventListener('blur', suspendSoft);

  const gameEl = document.getElementById('game');
  if (gameEl && typeof IntersectionObserver === 'function') {
    const obs = new IntersectionObserver((entries) => {
      const entry = entries[0];
      moAudioActivity.canvasVisible = !!(entry && entry.isIntersecting && entry.intersectionRatio > 0);
      suspendSoft();
    }, { threshold: [0, 0.01] });
    obs.observe(gameEl);
  }

  // IDE embedded browsers (e.g. Cursor Glass) may skip normal tab-close events.
  window.setInterval(suspendSoft, 1000);
}
moBindAudioLifecycle();

function moBindAudioUnlock(el) {
  if (!el || el.__moAudioBound) return;
  el.__moAudioBound = true;
  el.addEventListener('click', () => moUnlockAudioFromUserGesture());
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') moUnlockAudioFromUserGesture();
  });
}

moBindAudioUnlock(document.getElementById('mo-visit-setup-continue'));
moBindAudioUnlock(document.getElementById('mo-restart-btn'));
document.getElementById('mo-language-picker')?.querySelectorAll('button').forEach(moBindAudioUnlock);
document.getElementById('game')?.addEventListener('pointerdown', () => moUnlockAudioFromUserGesture(), { passive: true });

// ─────────────────────────────────────────────────────────────────────────────
//  Pixel art constants
// ─────────────────────────────────────────────────────────────────────────────
const TILE   = 32;   // pixels per tile
const COLS   = 20;
const ROWS   = 16;
const W      = TILE * COLS;
const H      = TILE * ROWS;
const SCALE  = 2;   // pixel-art upscale
/** Community board canvas extends left + up from anchor tile; feet at bottom-right. See OUTSIDE_LAYOUT.board. */
const COMMUNITY_BOARD_CANVAS_W = 56;
const COMMUNITY_BOARD_CANVAS_H = 56;
const COMMUNITY_BOARD_LIFT = COMMUNITY_BOARD_CANVAS_H - TILE;
const COMMUNITY_BOARD_SHIFT = COMMUNITY_BOARD_CANVAS_W - TILE;
/** Meadow poppy patch — wide canvas anchored on one grass tile, blooms spread left/up. */
const POPPY_PATCH_CANVAS_W = 128;
const POPPY_PATCH_CANVAS_H = 96;
const POPPY_PATCH_LIFT = POPPY_PATCH_CANVAS_H - TILE;
const POPPY_PATCH_SHIFT = POPPY_PATCH_CANVAS_W - TILE;
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

// Decorative park lawn — light greens, breeze frames (not crop tiles).
const GRASS_VARIANT_COUNT = 6;
const GRASS_BREEZE_FRAMES = 12;
const GRASS_BREEZE_MS = 170;

const GRASS_PALETTE = {
  bases: ['#68c868', '#64c264', '#6ccc6c', '#60be60', '#66c866', '#62c462'],
  dither: '#58b858',
  shadow: '#4a9a4a',
  bladeLo: '#449c44',
  blade: '#6ecc6a',
  bladeMid: '#7ed87a',
  bladeHi: '#8ed88e',
};

/** 4×4 grid tufts — 12 of 16 cells per variant; clustered blades, not column carpet. */
function buildGrassTufts(variant) {
  const blades = [];
  const roots = [];
  const TUFT_SHAPES = [
    [{ dx: 0, h: 5 }, { dx: 1, h: 6, lean: 1 }, { dx: -1, h: 4, lean: -1 }],
    [{ dx: 0, h: 6 }, { dx: 1, h: 5, lean: 1 }, { dx: -1, h: 5 }, { dx: 1, h: 4 }],
    [{ dx: 0, h: 5, w: 2 }, { dx: 1, h: 5 }, { dx: -1, h: 4, lean: -1 }],
    [{ dx: 0, h: 4 }, { dx: 1, h: 5, lean: 1 }, { dx: -1, h: 4 }],
    [{ dx: 0, h: 6 }, { dx: 2, h: 4, lean: 1 }, { dx: -1, h: 5, lean: -1 }],
  ];

  for (let cell = 0; cell < 16; cell++) {
    if (((cell * 13 + variant * 17) % 16) >= 12) continue;
    const col = cell % 4;
    const row = (cell / 4) | 0;
    const bx = col * 8 + 3 + ((cell + variant) % 3);
    const by = row * 8 + 6 + ((cell + variant * 2) % 2);
    const shape = TUFT_SHAPES[(cell + variant) % TUFT_SHAPES.length];
    roots.push({ x: bx, y: by });
    shape.forEach((b) => {
      const h = Math.min(b.h, by + 1);
      if (h < 2) return;
      const blade = { x: bx + b.dx, y: by, h, lean: b.lean || 0 };
      if (b.w) blade.w = 2;
      blades.push(blade);
    });
  }

  [
    { bx: 1, by: 25, blades: [{ dx: 0, h: 5, lean: 1 }, { dx: 1, h: 4, lean: 1 }, { dx: 0, h: 4 }] },
    { bx: 30, by: 27, blades: [{ dx: 0, h: 5, lean: -1 }, { dx: -1, h: 4, lean: -1 }, { dx: 0, h: 5 }] },
  ].forEach((tuft) => {
    roots.push({ x: tuft.bx, y: tuft.by });
    tuft.blades.forEach((b) => {
      const h = Math.min(b.h, tuft.by + 1);
      if (h < 2) return;
      blades.push({ x: tuft.bx + b.dx, y: tuft.by, h, lean: b.lean || 0 });
    });
  });

  blades.sort((a, b) => a.y - b.y);
  return { blades, roots };
}

const GRASS_BLADE_SETS = [];
for (let v = 0; v < GRASS_VARIANT_COUNT; v++) {
  GRASS_BLADE_SETS.push(buildGrassTufts(v));
}

function drawGrassBase(ctx, ox, oy, variant) {
  const base = GRASS_PALETTE.bases[variant];
  const dither = GRASS_PALETTE.dither;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      px(ctx, ox + x, oy + y, (x + y + variant) % 2 ? dither : base);
    }
  }
}

function grassTexKey(variant, frame) {
  return 't_grass_' + variant + '_' + frame;
}

function grassBladePhase(blade) {
  return ((blade.x * 3 + blade.y * 5 + blade.h * 7) % GRASS_BREEZE_FRAMES) / GRASS_BREEZE_FRAMES;
}

function grassBreezeSway(breezeFrame, blade) {
  const t = ((breezeFrame / GRASS_BREEZE_FRAMES) + grassBladePhase(blade)) * Math.PI * 2;
  return Math.sin(t);
}

/** Cumulative lean — root fixed, tip arcs with breeze. */
function drawGrassBlade(ctx, ox, oy, blade, breezeFrame) {
  const { x, y, h, w, lean } = blade;
  const sway = grassBreezeSway(breezeFrame, blade);
  const baseW = w || 1;
  let curX = x + lean;
  for (let s = 0; s < h; s++) {
    if (s > 0) {
      const ratio = s / (h - 1);
      curX += sway * ratio * ratio * 0.42;
    }
    const drawX = Math.round(curX);
    const col = s === h - 1 ? GRASS_PALETTE.bladeHi
      : s === 0 ? GRASS_PALETTE.bladeLo
      : s >= h - 2 ? GRASS_PALETTE.bladeMid
      : GRASS_PALETTE.blade;
    const span = baseW > 1 && s < h - 1 ? baseW : 1;
    for (let dx = 0; dx < span; dx++) {
      px(ctx, ox + drawX + dx, oy + y - s, col);
    }
  }
}

function drawGrass(ctx, ox, oy, variant, breezeFrame) {
  const v = variant % GRASS_VARIANT_COUNT;
  const f = breezeFrame % GRASS_BREEZE_FRAMES;
  const { blades, roots } = GRASS_BLADE_SETS[v];
  drawGrassBase(ctx, ox, oy, v);
  roots.forEach(({ x, y }) => px(ctx, ox + x, oy + y, GRASS_PALETTE.shadow));
  blades.forEach((blade) => drawGrassBlade(ctx, ox, oy, blade, f));
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

/** Single flat flagstone overlay — sits on grass before sidewalk; lower in tile. */
function drawStepStoneOverlay(ctx, ox, oy, variant) {
  const sizes = [
    { w: 14, h: 11, y: 18, jx: 0 },
    { w: 12, h: 9, y: 20, jx: -1 },
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

/** County-park bulletin kiosk — fills 56×56 canvas left+up; feet at canvas bottom-right. */
function drawCommunityBoard(ctx, ox, oy) {
  const H = COMMUNITY_BOARD_CANVAS_H;
  const wood = '#5a4030';
  const woodHi = '#6b5038';
  const frame = '#4a3828';
  const cork = '#a08058';
  const corkSh = '#8a7050';
  const roof = '#3a5038';
  const roofHi = '#4a6048';
  const foot = oy + H;
  const cabL = ox + 8;
  const cabW = 32;

  rect(ctx, cabL + 4, foot - 14, 3, 10, wood);
  rect(ctx, cabL + cabW - 9, foot - 14, 3, 10, wood);
  rect(ctx, ox + 6, foot - 4, 36, 4, woodHi);
  rect(ctx, cabL, foot - 32, cabW, 18, corkSh);
  rect(ctx, cabL + 1, foot - 31, cabW - 2, 16, cork);
  rect(ctx, cabL, foot - 32, cabW, 1, frame);
  rect(ctx, cabL, foot - 15, cabW, 1, frame);
  rect(ctx, cabL, foot - 32, 1, 18, frame);
  rect(ctx, cabL + cabW - 1, foot - 32, 1, 18, frame);
  for (let i = 0; i < 5; i++) {
    const rw = 12 + 2 * i;
    rect(ctx, cabL + Math.floor((cabW - rw) / 2), foot - 42 + i, rw, 2, roof);
  }
  rect(ctx, cabL, foot - 33, cabW, 1, roofHi);
  rect(ctx, cabL + 3, foot - 28, 13, 9, '#e8dcc8');
  rect(ctx, cabL + 18, foot - 27, 11, 10, '#d4c8a8');
  px(ctx, cabL + 5, foot - 28, '#8a3030');
  px(ctx, cabL + 20, foot - 27, '#8a3030');
}

/** Feathery California-poppy basal leaf — blue-green. */
function drawPoppyFoliage(ctx, x, y) {
  const leaf = '#6a9878';
  const leafHi = '#88b898';
  px(ctx, x, y, leaf);
  px(ctx, x + 1, y, leafHi);
  px(ctx, x + 2, y, leaf);
  px(ctx, x, y + 1, leafHi);
  px(ctx, x + 1, y + 1, leaf);
}

/** One open papery poppy bloom — four wide silk petals, not a cup. */
function drawPoppyBloom(ctx, cx, cy, small) {
  const petal = '#f07028';
  const petalHi = '#ffc860';
  const petalMid = '#ff8838';
  const petalLo = '#d85818';
  const heart = '#b0c040';
  if (small) {
    px(ctx, cx, cy - 2, petalHi);
    px(ctx, cx - 1, cy - 1, petalMid);
    px(ctx, cx, cy - 1, petalHi);
    px(ctx, cx + 1, cy - 1, petalMid);
    px(ctx, cx - 2, cy, petalLo);
    px(ctx, cx - 1, cy, petal);
    px(ctx, cx, cy, heart);
    px(ctx, cx + 1, cy, petal);
    px(ctx, cx + 2, cy, petalLo);
    px(ctx, cx - 1, cy + 1, petalLo);
    px(ctx, cx, cy + 1, petalMid);
    px(ctx, cx + 1, cy + 1, petalLo);
    px(ctx, cx, cy + 2, petalLo);
    return;
  }
  px(ctx, cx - 1, cy - 4, petalHi);
  px(ctx, cx, cy - 5, petalHi);
  px(ctx, cx + 1, cy - 4, petalHi);
  px(ctx, cx, cy - 4, petalMid);
  px(ctx, cx - 3, cy - 3, petalLo);
  px(ctx, cx - 2, cy - 3, petal);
  px(ctx, cx - 1, cy - 3, petalMid);
  px(ctx, cx + 1, cy - 3, petalMid);
  px(ctx, cx + 2, cy - 3, petal);
  px(ctx, cx + 3, cy - 3, petalLo);
  px(ctx, cx - 4, cy - 2, petalLo);
  px(ctx, cx - 3, cy - 2, petal);
  px(ctx, cx - 2, cy - 2, petalMid);
  px(ctx, cx - 1, cy - 2, petal);
  px(ctx, cx, cy - 2, heart);
  px(ctx, cx + 1, cy - 2, petal);
  px(ctx, cx + 2, cy - 2, petalMid);
  px(ctx, cx + 3, cy - 2, petal);
  px(ctx, cx + 4, cy - 2, petalLo);
  px(ctx, cx - 3, cy - 1, petal);
  px(ctx, cx - 2, cy - 1, petalMid);
  px(ctx, cx - 1, cy - 1, petalHi);
  px(ctx, cx, cy - 1, petalMid);
  px(ctx, cx + 1, cy - 1, petalHi);
  px(ctx, cx + 2, cy - 1, petalMid);
  px(ctx, cx + 3, cy - 1, petal);
  px(ctx, cx - 2, cy, petalLo);
  px(ctx, cx - 1, cy, petalMid);
  px(ctx, cx, cy, petalLo);
  px(ctx, cx + 1, cy, petalMid);
  px(ctx, cx + 2, cy, petalLo);
  px(ctx, cx - 1, cy + 1, petalLo);
  px(ctx, cx, cy + 1, petalMid);
  px(ctx, cx + 1, cy + 1, petalLo);
  px(ctx, cx, cy + 2, petalLo);
}

/** One golden poppy plant — shared basal leaves, branching stems, several open blooms. */
function drawGoldenPoppyPlant(ctx, bx, by, tall) {
  const stem = '#358848';
  drawPoppyFoliage(ctx, bx - 3, by - 1);
  drawPoppyFoliage(ctx, bx + 1, by);
  drawPoppyFoliage(ctx, bx - 1, by + 1);
  drawPoppyFoliage(ctx, bx + 3, by);
  const stemTop = by - (tall ? 20 : 16);
  for (let y = by; y >= stemTop; y--) px(ctx, bx, y, stem);
  drawPoppyBloom(ctx, bx, stemTop - 2, false);
  const branchA = stemTop + 6;
  px(ctx, bx - 1, branchA, stem);
  px(ctx, bx - 2, branchA - 1, stem);
  px(ctx, bx - 3, branchA - 2, stem);
  drawPoppyBloom(ctx, bx - 4, branchA - 4, true);
  px(ctx, bx + 1, branchA + 2, stem);
  px(ctx, bx + 2, branchA + 1, stem);
  px(ctx, bx + 3, branchA, stem);
  drawPoppyBloom(ctx, bx + 4, branchA - 2, true);
  if (tall) {
    px(ctx, bx + 1, stemTop + 3, stem);
    px(ctx, bx + 2, stemTop + 2, stem);
    drawPoppyBloom(ctx, bx + 3, stemTop, true);
  }
}

/** Meadow pansy — cup-shaped golden petals, dark center (lone flower south of café). */
function drawMeadowPansy(ctx, ox, oy) {
  rect(ctx, ox, oy, 32, 32, 'rgba(0,0,0,0)');
  const stem = '#2d7a2d';
  const leaf = '#3a9a48';
  const petal = '#e8a820';
  const petalHi = '#ffd858';
  const petalSh = '#c07810';
  const center = '#2a2418';

  px(ctx, ox + 16, oy + 22, stem);
  px(ctx, ox + 16, oy + 23, stem);
  px(ctx, ox + 17, oy + 24, stem);
  px(ctx, ox + 17, oy + 25, stem);
  px(ctx, ox + 14, oy + 23, leaf);
  px(ctx, ox + 15, oy + 24, leaf);
  px(ctx, ox + 13, oy + 24, leaf);

  px(ctx, ox + 15, oy + 15, petalHi);
  px(ctx, ox + 16, oy + 14, petalHi);
  px(ctx, ox + 17, oy + 15, petalHi);
  px(ctx, ox + 15, oy + 16, petal);
  px(ctx, ox + 16, oy + 15, petal);
  px(ctx, ox + 17, oy + 16, petal);

  px(ctx, ox + 13, oy + 17, petal);
  px(ctx, ox + 14, oy + 16, petalHi);
  px(ctx, ox + 13, oy + 18, petalSh);
  px(ctx, ox + 14, oy + 17, petal);
  px(ctx, ox + 14, oy + 18, petal);

  px(ctx, ox + 18, oy + 17, petal);
  px(ctx, ox + 19, oy + 16, petalHi);
  px(ctx, ox + 19, oy + 18, petalSh);
  px(ctx, ox + 18, oy + 18, petal);
  px(ctx, ox + 17, oy + 17, petal);

  px(ctx, ox + 15, oy + 19, petal);
  px(ctx, ox + 16, oy + 20, petalSh);
  px(ctx, ox + 17, oy + 19, petal);
  px(ctx, ox + 16, oy + 19, petal);

  px(ctx, ox + 15, oy + 17, center);
  px(ctx, ox + 16, oy + 16, center);
  px(ctx, ox + 17, oy + 17, center);
  px(ctx, ox + 16, oy + 17, center);
  px(ctx, ox + 16, oy + 18, center);
}

/** Lone meadow flower south of the café — pansy. */
function drawGoldenPoppy(ctx, ox, oy) {
  drawMeadowPansy(ctx, ox, oy);
}

/** Three golden poppy plants in a triangle — apex toward the meadow's upper-right corner. */
function drawMeadowPoppyCluster(ctx, ox, oy) {
  rect(ctx, ox, oy, POPPY_PATCH_CANVAS_W, POPPY_PATCH_CANVAS_H, 'rgba(0,0,0,0)');
  drawGoldenPoppyPlant(ctx, ox + 108, oy + 18, true);
  drawGoldenPoppyPlant(ctx, ox + 48, oy + 86, false);
  drawGoldenPoppyPlant(ctx, ox + 102, oy + 86, true);
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

/** Flat stone under storefront — no inset blocks (those read as café-wall ghosts through the roof). */
function drawBuildingFoundation(ctx, ox, oy) {
  rect(ctx, ox, oy, 32, 32, '#5a5850');
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

/** Pitched terracotta roof — pantile courses, soft gable, flat ridge (no crown triangles). */
function drawStreetBuildingRoof(ctx, bw, wallTop) {
  const rowH = 5;
  const rows = 8;
  const tileW = 10;
  const baseY = wallTop - 2;
  const topY = baseY - rows * rowH;
  const terra = ['#8a4838', '#7a4030', '#9a5840', '#6a3828'];
  const terraHi = '#aa6848';
  const terraBase = '#7a4030';

  function rowSpan(i) {
    const t = i / (rows - 1);
    const curve = t * t;
    const inset = Math.round(curve * bw * 0.36);
    const overhang = Math.round((1 - t) * 5);
    return { left: inset - overhang, right: bw - inset + overhang };
  }

  function drawPantileRow(left, right, y, rowIndex) {
    const offset = (rowIndex % 2) * Math.floor(tileW / 2);
    for (let tx = left - offset; tx < right - 2; tx += tileW) {
      const tw = Math.min(tileW - 1, right - tx);
      if (tw < 3) continue;
      const ci = (Math.floor((tx - left) / tileW) + rowIndex) % terra.length;
      rect(ctx, tx, y + 1, tw, rowH - 1, terra[ci]);
      const archW = Math.max(2, tw - 3);
      rect(ctx, tx + 1, y, archW, 1, terraHi);
    }
  }

  const peak = rowSpan(rows - 1);
  const ridgeY = Math.max(0, topY - 1);
  const ridgeL = peak.left + 4;
  const ridgeR = peak.right - 4;
  const eave = rowSpan(0);

  ctx.fillStyle = terraBase;
  ctx.beginPath();
  ctx.moveTo(eave.left, baseY + 1);
  ctx.lineTo(eave.right, baseY + 1);
  for (let i = 0; i < rows; i++) {
    ctx.lineTo(rowSpan(i).right, baseY - (i + 1) * rowH);
  }
  ctx.lineTo(ridgeR, ridgeY);
  ctx.lineTo(ridgeL, ridgeY);
  for (let i = rows - 1; i >= 0; i--) {
    ctx.lineTo(rowSpan(i).left, baseY - (i + 1) * rowH);
  }
  ctx.closePath();
  ctx.fill();

  for (let i = 0; i < rows; i++) {
    const { left, right } = rowSpan(i);
    drawPantileRow(left, right, baseY - (i + 1) * rowH, i);
  }

  for (let rx = ridgeL; rx < ridgeR - 4; rx += 8) {
    rect(ctx, rx, ridgeY, 6, 3, '#9a5848');
    rect(ctx, rx + 1, ridgeY, 4, 1, '#b87858');
  }
}

/** Stem from soil up to the sill only — never a long line through the glass. */
function drawFacadeWindowStem(ctx, cx, soilY, sillBottom) {
  const stem = '#2d7a2d';
  for (let y = soilY; y >= sillBottom; y--) px(ctx, cx, y, stem);
}

/** Window-box daisy — blooms sit on the sill, tips touch lower glass. */
function drawFacadeWindowDaisy(ctx, cx, soilY, sillBottom, bloomTopY) {
  const petal = '#ece8dc';
  const center = '#d4b018';
  drawFacadeWindowStem(ctx, cx, soilY, sillBottom);
  px(ctx, cx - 1, bloomTopY + 2, petal);
  px(ctx, cx, bloomTopY + 2, center);
  px(ctx, cx + 1, bloomTopY + 2, petal);
  px(ctx, cx - 1, bloomTopY + 1, petal);
  px(ctx, cx, bloomTopY + 1, petal);
  px(ctx, cx + 1, bloomTopY + 1, petal);
  px(ctx, cx, bloomTopY, petal);
}

/** Window-box tulip — compact cup on the sill. */
function drawFacadeWindowTulip(ctx, cx, soilY, sillBottom, bloomTopY, petal) {
  drawFacadeWindowStem(ctx, cx, soilY, sillBottom);
  rect(ctx, cx - 1, bloomTopY + 1, 3, 3, petal);
  px(ctx, cx, bloomTopY, petal);
}

/** Window-box red poppy — compact cup on the sill. */
function drawFacadeWindowPoppy(ctx, cx, soilY, sillBottom, bloomTopY) {
  const petal = '#c83030';
  const petalLo = '#a82020';
  const center = '#2a1818';
  drawFacadeWindowStem(ctx, cx, soilY, sillBottom);
  px(ctx, cx, bloomTopY + 3, petal);
  px(ctx, cx - 1, bloomTopY + 2, petal);
  px(ctx, cx + 1, bloomTopY + 2, petal);
  px(ctx, cx, bloomTopY + 2, center);
  px(ctx, cx - 1, bloomTopY + 1, petalLo);
  px(ctx, cx, bloomTopY + 1, petal);
  px(ctx, cx + 1, bloomTopY + 1, petalLo);
  px(ctx, cx, bloomTopY, petal);
}

/** Back-row bloom — shorter, tucked just under front row. */
function drawFacadeBloomDot(ctx, cx, cy, type, color, soilY, sillBottom) {
  const petal = color || '#c84858';
  if (soilY != null) drawFacadeWindowStem(ctx, cx, soilY, sillBottom);
  if (type === 'daisy') {
    px(ctx, cx, cy, '#d4b018');
    px(ctx, cx - 1, cy, '#ece8dc');
    px(ctx, cx + 1, cy, '#ece8dc');
    px(ctx, cx, cy - 1, '#ece8dc');
  } else if (type === 'tulip') {
    rect(ctx, cx - 1, cy, 3, 2, petal);
    px(ctx, cx, cy - 1, petal);
  } else {
    px(ctx, cx, cy, '#2a1818');
    px(ctx, cx - 1, cy - 1, '#c83030');
    px(ctx, cx, cy - 1, '#c83030');
    px(ctx, cx + 1, cy - 1, '#c83030');
  }
}

/** Flowers + planter — natural sill height, blooms kiss lower glass. */
function drawFacadeWindowFlowers(ctx, wx, winY, winW, winH, flowers) {
  const bx = wx + 7;
  const bw = winW - 14;
  const sillBottom = winY + winH;
  const frontBloomTop = sillBottom - 8;
  const backBloomTop = sillBottom - 11;
  const boxH = 7;
  const boxY = sillBottom;
  const wood = '#5a4030';
  const woodHi = '#6a5040';
  const woodLo = '#4a3028';
  const soil = '#3a2818';
  const leaf = '#3a9a48';
  const leafLo = '#2d6a2d';

  const soilY = boxY + boxH - 3;
  for (let fx = bx + 3; fx < bx + bw - 3; fx += 3) {
    px(ctx, fx, soilY, leafLo);
    if (soilY - 1 >= boxY) px(ctx, fx + 1, soilY - 1, leaf);
  }

  flowers.forEach(({ type, x, color, row }) => {
    const cx = bx + x;
    if (row === 1) {
      drawFacadeBloomDot(ctx, cx, backBloomTop, type, color, soilY, sillBottom);
      return;
    }
    if (type === 'daisy') drawFacadeWindowDaisy(ctx, cx, soilY, sillBottom, frontBloomTop);
    else if (type === 'tulip') drawFacadeWindowTulip(ctx, cx, soilY, sillBottom, frontBloomTop, color || '#c84858');
    else if (type === 'poppy') drawFacadeWindowPoppy(ctx, cx, soilY, sillBottom, frontBloomTop);
  });

  rect(ctx, bx, boxY, bw, boxH, woodLo);
  rect(ctx, bx + 1, boxY + 1, bw - 2, boxH - 2, wood);
  rect(ctx, bx + 2, boxY + 1, bw - 4, boxH - 3, soil);
  rect(ctx, bx + 1, boxY + boxH - 1, bw - 2, 1, woodHi);
}

// One cohesive storefront (12×7 tiles)
function drawStreetBuildingFacade(ctx, bw, bh) {
  const brick = '#7a5848', brickD = '#6a4838', trim = '#5a3828';
  const gap = 2;
  const foundationH = 8;
  const awningH = 8;
  const winW = 72;
  const winH = 58;
  const winInset = 44;
  const wallTop = 42;

  const door = MoDoors.facadeDoorMetrics(bw, bh);
  const doorY = door.dy;
  const awningY = doorY - gap - awningH;
  const winY = awningY - gap - winH;

  drawStreetBuildingRoof(ctx, bw, wallTop);

  rect(ctx, 0, wallTop, bw, bh - wallTop, brick);
  for (let y = wallTop + 6; y < bh - foundationH; y += 10) rect(ctx, 4, y, bw - 8, 1, brickD);
  for (let x = 20; x < bw - 16; x += 28) {
    for (let y = wallTop + 2; y < bh - foundationH - 4; y += 10) rect(ctx, x, y, 1, 8, brickD);
  }

  const winBoxFlowers = [
    [
      { row: 1, type: 'daisy', x: 4 },
      { row: 1, type: 'poppy', x: 13 },
      { row: 1, type: 'tulip', x: 22, color: '#8868a8' },
      { row: 1, type: 'daisy', x: 31 },
      { row: 1, type: 'poppy', x: 40 },
      { row: 1, type: 'tulip', x: 49, color: '#e8b020' },
      { row: 0, type: 'tulip', x: 8, color: '#d84868' },
      { row: 0, type: 'daisy', x: 17 },
      { row: 0, type: 'poppy', x: 26 },
      { row: 0, type: 'daisy', x: 35 },
      { row: 0, type: 'poppy', x: 44 },
      { row: 0, type: 'tulip', x: 53, color: '#d84868' },
    ],
    [
      { row: 1, type: 'poppy', x: 4 },
      { row: 1, type: 'tulip', x: 13, color: '#e8b020' },
      { row: 1, type: 'daisy', x: 22 },
      { row: 1, type: 'poppy', x: 31 },
      { row: 1, type: 'daisy', x: 40 },
      { row: 1, type: 'tulip', x: 49, color: '#8868a8' },
      { row: 0, type: 'poppy', x: 8 },
      { row: 0, type: 'tulip', x: 17, color: '#d84868' },
      { row: 0, type: 'daisy', x: 26 },
      { row: 0, type: 'poppy', x: 35 },
      { row: 0, type: 'tulip', x: 44, color: '#e8b020' },
      { row: 0, type: 'daisy', x: 53 },
    ],
  ];

  const winSlots = [winInset, bw - winInset - winW];
  winSlots.forEach((wx, idx) => {
    rect(ctx, wx, winY, winW, winH, trim);
    rect(ctx, wx + 6, winY + 6, winW - 12, winH - 12, '#3a4858');
    rect(ctx, wx + 10, winY + 10, 18, 14, '#6a8898');
    rect(ctx, wx + winW - 28, winY + winH - 24, 18, 14, '#5a7888');
    drawFacadeWindowFlowers(ctx, wx, winY, winW, winH, winBoxFlowers[idx]);
  });

  const sign = MoDoors.facadeSignMetrics(bw, bh);
  rect(ctx, sign.sx, sign.sy, sign.sw, sign.sh, '#2a1810');
  rect(ctx, sign.sx + 4, sign.sy + 4, sign.sw - 8, sign.sh - 8, '#3a2820');
  rect(ctx, sign.sx + 8, sign.sy + 10, sign.sw - 16, 4, '#d4af6a');
  rect(ctx, sign.sx + 8, sign.sy + 18, sign.sw - 24, 3, '#c49a5a');
  rect(ctx, sign.sx + 8, sign.sy + 26, sign.sw - 32, 3, '#a08040');
  rect(ctx, sign.sx + 8, sign.sy + 34, Math.max(20, sign.sw - 44), 3, '#806030');

  const stripeW = 22;
  const stripeGap = 26;
  const stripeCount = 6;
  const awningSpan = stripeCount * stripeGap - 4;
  const awningStart = door.cx - awningSpan / 2;
  for (let i = 0; i < stripeCount; i++) {
    rect(ctx, awningStart + i * stripeGap, awningY, stripeW, awningH, i % 2 === 0 ? '#8a3040' : '#d4af6a');
  }
  rect(ctx, awningStart - 4, awningY + awningH, awningSpan + 8, 3, trim);

  rect(ctx, door.dx, doorY, door.dw, door.dh, '#3a2820');
  rect(ctx, door.dx + 2, doorY + 2, door.dw - 4, door.dh - 4, '#1a1008');
  rect(ctx, door.dx + 4, doorY + 5, door.dw - 8, door.dh - 10, '#3a3028');
  rect(ctx, door.dx + 7, doorY + 10, 5, 5, '#d4a860');
  rect(ctx, door.dx + door.dw - 6, doorY + door.dh - 14, 2, 3, '#d4af6a');
  rect(ctx, door.dx, doorY + door.dh - 2, door.dw, 3, '#4a3828');

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
const PLAYER_LOOK_ART_REV = 'y';
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
    faceSkin: { x: 5, y: 3, w: 7, h: 7 },
    eyes: [{ x: 6, y: 5 }, { x: 9, y: 5 }],
    hijabCheeks: [
      { col: 4, crownX: 3, crownW: 2, jawY: 7 },
      { col: 12, crownX: 11, crownW: 2, jawY: 7 },
    ],
  },
  1: {
    faceSkin: { x: 5, y: 2, w: 3, h: 7 },
    eyes: [{ x: 5, y: 5 }],
    hijabCheeks: [{ col: 4, crownX: 3, crownW: 1, jawY: 7 }],
  },
  2: {
    faceSkin: { x: 9, y: 2, w: 3, h: 7 },
    eyes: [{ x: 9, y: 5 }],
    hijabCheeks: [{ col: 8, crownX: 8, crownW: 1, jawY: 7 }],
  },
};

const HIJAB_COLORS = { skin: '#f0c080', hijab: '#6a7888', hijabDark: '#5a6878', eye: '#1a0a00' };

const JILBAB_COLORS = {
  jilbab: '#4a5668',
  jilbabLight: '#7a8898',
  jilbabDark: '#3a4450',
  shoe: '#2a3040',
  shoeDark: '#1a2030',
};

/** Octagon face opening — cut corners so skin reads rounded, not a square block. */
function drawHijabFaceSkinOctagon(ctx, ox, oy, dir, skin) {
  if (dir === 0) {
    rect(ctx, ox + 6, oy + 3, 5, 1, skin);
    rect(ctx, ox + 5, oy + 4, 7, 1, skin);
    rect(ctx, ox + 5, oy + 5, 7, 4, skin);
    rect(ctx, ox + 6, oy + 9, 5, 1, skin);
  } else if (dir === 1) {
    px(ctx, ox + 6, oy + 2, skin);
    rect(ctx, ox + 5, oy + 3, 3, 6, skin);
    px(ctx, ox + 6, oy + 9, skin);
  } else if (dir === 2) {
    px(ctx, ox + 9, oy + 2, skin);
    rect(ctx, ox + 8, oy + 3, 3, 6, skin);
    px(ctx, ox + 9, oy + 9, skin);
  }
}

/** Solid A-line robe undercoat — stops at hem; shoes sit below on their own row. */
function paintJilbabUndercoat(ctx, ox, oy, dir, hemY, C) {
  if (dir === 0) {
    for (let y = 10; y <= hemY; y++) {
      let left = 1;
      let width = 14;
      if (y === 10) {
        left = 1;
        width = 14;
      } else if (y === 11) {
        left = 2;
        width = 12;
      }
      rect(ctx, ox + left, oy + y, width, 1, C.jilbab);
    }
  } else {
    const h = hemY - 10 + 1;
    if (h > 0) {
      rect(ctx, ox + 1, oy + 10, 14, h, C.jilbab);
    }
  }
}

/** Close outer sprite edge so map does not bleed through at cols 0 and 15. */
function paintJilbabEdgeOutline(ctx, ox, oy, hemY, C) {
  for (let y = 10; y <= hemY && y < CHAR_H - 1; y++) {
    px(ctx, ox + 0, oy + y, C.jilbabDark);
    px(ctx, ox + 15, oy + y, C.jilbabDark);
  }
}

/** Fill robe from mid-skirt down to hem so ankles never read as erased gaps. */
function fillJilbabSkirtToHem(ctx, ox, oy, dir, hemY, C) {
  const top = 16;
  const h = hemY - top;
  if (h <= 0) return;

  if (dir === 0) {
    rect(ctx, ox + 1, oy + top, 14, h, C.jilbab);
    rect(ctx, ox + 1, oy + 11, 2, 4, C.jilbabLight);
    rect(ctx, ox + 13, oy + 11, 2, 4, C.jilbabLight);
    px(ctx, ox + 8, oy + 12, C.jilbabDark);
  } else if (dir === 1) {
    rect(ctx, ox + 1, oy + top, 13, h, C.jilbab);
    rect(ctx, ox + 2, oy + 11, 2, 4, C.jilbabLight);
    px(ctx, ox + 4, oy + 12, C.jilbabDark);
  } else if (dir === 2) {
    rect(ctx, ox + 2, oy + top, 13, h, C.jilbab);
    rect(ctx, ox + 12, oy + 11, 2, 4, C.jilbabLight);
    px(ctx, ox + 11, oy + 12, C.jilbabDark);
  } else if (dir === 3) {
    rect(ctx, ox + 1, oy + top, 14, h, C.jilbab);
    rect(ctx, ox + 1, oy + 11, 2, 4, C.jilbabLight);
    rect(ctx, ox + 13, oy + 11, 2, 4, C.jilbabLight);
  }
}

/** Hem line ends the robe; distinct shoes sit on the row below (not embedded in cloth). */
function drawJilbabHemAndFeet(ctx, ox, oy, dir, hemY, footX, legL, C) {
  const shoeY = hemY + 1;
  const shoeH = 3;

  if (dir === 0) {
    rect(ctx, ox + 1, oy + hemY, 14, 1, C.jilbab);
    px(ctx, ox + 1, oy + hemY, C.jilbabDark);
    px(ctx, ox + 14, oy + hemY, C.jilbabDark);
    px(ctx, ox + 7, oy + hemY, C.jilbabDark);
    px(ctx, ox + 8, oy + hemY, C.jilbabDark);
    const leftShoeX = 3 + legL;
    const rightShoeX = 9 - legL;
    rect(ctx, ox + leftShoeX, oy + shoeY, 4, shoeH, C.shoe);
    rect(ctx, ox + rightShoeX, oy + shoeY, 4, shoeH, C.shoe);
    rect(ctx, ox + leftShoeX, oy + shoeY + shoeH - 1, 4, 1, C.shoeDark);
    rect(ctx, ox + rightShoeX, oy + shoeY + shoeH - 1, 4, 1, C.shoeDark);
  } else if (dir === 1 || dir === 2) {
    rect(ctx, ox + 1, oy + hemY, 14, 1, C.jilbab);
    px(ctx, ox + 1, oy + hemY, C.jilbabDark);
    px(ctx, ox + 14, oy + hemY, C.jilbabDark);
    rect(ctx, ox + footX, oy + shoeY, 4, shoeH, C.shoe);
    rect(ctx, ox + footX, oy + shoeY + shoeH - 1, 4, 1, C.shoeDark);
  } else if (dir === 3) {
    rect(ctx, ox + 1, oy + hemY, 14, 1, C.jilbab);
    px(ctx, ox + 0, oy + hemY, C.jilbabDark);
    px(ctx, ox + 15, oy + hemY, C.jilbabDark);
    rect(ctx, ox + 3, oy + shoeY, 4, shoeH, C.shoe);
    rect(ctx, ox + 9, oy + shoeY, 4, shoeH, C.shoe);
    rect(ctx, ox + 3, oy + shoeY + shoeH - 1, 4, 1, C.shoeDark);
    rect(ctx, ox + 9, oy + shoeY + shoeH - 1, 4, 1, C.shoeDark);
  }
}

/** Small pixel smile for hijab face (all facings). */
function drawHijabSmile(ctx, ox, oy, dir) {
  const lip = '#c07050';
  if (dir === 0) {
    px(ctx, ox + 7, oy + 8, lip);
    px(ctx, ox + 9, oy + 8, lip);
    rect(ctx, ox + 7, oy + 9, 3, 1, lip);
  } else if (dir === 1) {
    px(ctx, ox + 5, oy + 8, lip);
    px(ctx, ox + 6, oy + 9, lip);
    px(ctx, ox + 7, oy + 9, lip);
  } else if (dir === 2) {
    px(ctx, ox + 10, oy + 8, lip);
    px(ctx, ox + 8, oy + 9, lip);
    px(ctx, ox + 9, oy + 9, lip);
  }
}

/** Hijab base wrap per facing — arc crown, cheek drapes, neck bridge into jilbab. */
function drawHijabBase(ctx, ox, oy, dir, hijab, hijabDark) {
  if (dir === 0) {
    px(ctx, ox + 2, oy + 1, hijab);
    px(ctx, ox + 3, oy + 1, hijab);
    rect(ctx, ox + 4, oy + 1, 8, 1, hijab);
    px(ctx, ox + 12, oy + 1, hijab);
    px(ctx, ox + 13, oy + 1, hijab);
    rect(ctx, ox + 2, oy + 2, 12, 1, hijab);
    rect(ctx, ox + 2, oy + 3, 2, 4, hijab);
    rect(ctx, ox + 12, oy + 3, 2, 4, hijab);
    px(ctx, ox + 4, oy + 3, hijabDark);
    px(ctx, ox + 5, oy + 3, hijabDark);
    px(ctx, ox + 11, oy + 3, hijabDark);
  } else if (dir === 1) {
    px(ctx, ox + 2, oy + 1, hijab);
    px(ctx, ox + 3, oy + 1, hijab);
    rect(ctx, ox + 4, oy + 1, 7, 1, hijab);
    rect(ctx, ox + 11, oy + 1, 3, 1, hijab);
    rect(ctx, ox + 3, oy + 2, 8, 1, hijab);
    px(ctx, ox + 2, oy + 2, hijab);
    rect(ctx, ox + 2, oy + 3, 2, 4, hijab);
    rect(ctx, ox + 11, oy + 2, 4, 6, hijab);
    px(ctx, ox + 4, oy + 3, hijabDark);
    rect(ctx, ox + 4, oy + 8, 1, 2, hijab);
  } else if (dir === 2) {
    px(ctx, ox + 12, oy + 1, hijab);
    rect(ctx, ox + 5, oy + 1, 7, 1, hijab);
    rect(ctx, ox + 2, oy + 1, 3, 1, hijab);
    px(ctx, ox + 13, oy + 1, hijab);
    rect(ctx, ox + 5, oy + 2, 8, 1, hijab);
    px(ctx, ox + 13, oy + 2, hijab);
    rect(ctx, ox + 12, oy + 3, 2, 4, hijab);
    rect(ctx, ox + 1, oy + 2, 4, 6, hijab);
    px(ctx, ox + 11, oy + 3, hijabDark);
    rect(ctx, ox + 11, oy + 8, 1, 2, hijab);
  } else if (dir === 3) {
    rect(ctx, ox + 2, oy + 2, 12, 9, hijab);
    rect(ctx, ox + 5, oy + 4, 6, 1, hijabDark);
    px(ctx, ox + 6, oy + 8, hijabDark);
    px(ctx, ox + 9, oy + 8, hijab);
  }
}

/** Hijab cheek accent on columns strictly outside faceSkin. */
function drawHijabCheekAccents(ctx, ox, oy, cheeks, hijab, hijabDark, dir) {
  const crownY = dir === 0 ? 2 : 3;
  for (let i = 0; i < cheeks.length; i++) {
    const c = cheeks[i];
    rect(ctx, ox + c.crownX, oy + crownY, c.crownW, 1, hijab);
    px(ctx, ox + c.col, oy + 4, hijabDark);
    rect(ctx, ox + c.col, oy + 5, 1, 2, hijab);
    if (c.jawY != null) {
      px(ctx, ox + c.col, oy + c.jawY, hijab);
    }
    if (dir === 0 && c.col === 4) {
      px(ctx, ox + 4, oy + 8, hijab);
    }
    if (dir === 0 && c.col === 12) {
      px(ctx, ox + 12, oy + 8, hijab);
    }
  }
}

function drawHijabFaceFromLayout(ctx, ox, oy, dir, skin, hijab) {
  const hijabDark = HIJAB_COLORS.hijabDark;
  skin = skin || HIJAB_COLORS.skin;

  if (dir === 3) {
    drawHijabBase(ctx, ox, oy, 3, hijab, hijabDark);
    bridgeHijabToJilbab(ctx, ox, oy, 3, hijab);
    return;
  }

  const layout = HIJAB_FACE_LAYOUT[dir];
  if (!layout) return;

  drawHijabBase(ctx, ox, oy, dir, hijab, hijabDark);

  drawHijabFaceSkinOctagon(ctx, ox, oy, dir, skin);
  for (let i = 0; i < layout.eyes.length; i++) {
    const e = layout.eyes[i];
    rect(ctx, ox + e.x, oy + e.y, 2, 2, HIJAB_COLORS.eye);
  }
  drawHijabSmile(ctx, ox, oy, dir);
  drawHijabCheekAccents(ctx, ox, oy, layout.hijabCheeks, hijab, hijabDark, dir);
  bridgeHijabToJilbab(ctx, ox, oy, dir, hijab);
}

/** Chin, neck, and profile gap fill — hijab meets jilbab with no see-through pixels. */
function bridgeHijabToJilbab(ctx, ox, oy, dir, hijab) {
  if (dir === 0) {
    rect(ctx, ox + 4, oy + 9, 2, 1, hijab);
    px(ctx, ox + 11, oy + 9, hijab);
    rect(ctx, ox + 2, oy + 7, 2, 3, hijab);
    rect(ctx, ox + 12, oy + 7, 2, 3, hijab);
  } else if (dir === 1) {
    rect(ctx, ox + 8, oy + 3, 3, 7, hijab);
    px(ctx, ox + 5, oy + 9, hijab);
    rect(ctx, ox + 2, oy + 7, 2, 3, hijab);
    rect(ctx, ox + 11, oy + 8, 3, 2, hijab);
  } else if (dir === 2) {
    rect(ctx, ox + 5, oy + 3, 3, 7, hijab);
    rect(ctx, ox + 11, oy + 4, 1, 4, hijab);
    px(ctx, ox + 10, oy + 9, hijab);
    rect(ctx, ox + 12, oy + 7, 2, 3, hijab);
    rect(ctx, ox + 2, oy + 8, 3, 2, hijab);
  } else if (dir === 3) {
    rect(ctx, ox + 1, oy + 10, 14, 1, hijab);
  }
}

/** Hijab + jilbab — per-direction head (no bare back, no ear skin, open face). */
function drawHijabFace(ctx, ox, oy, dir, skin, hijab) {
  drawHijabFaceFromLayout(ctx, ox, oy, dir, skin, hijab);
}
// END HIJAB_FACE_DRAW

// BEGIN JILBAB_BODY_DRAW
/** A-line jilbab — robe hem above; shoes visible below on the ground. */
function drawJilbabBody(ctx, ox, oy, dir, frame, palette) {
  const C = palette ? Object.assign({}, JILBAB_COLORS, palette) : JILBAB_COLORS;
  const walkOffset = (frame === 1 || frame === 3) ? 0 : 1;
  const legL = frame < 2 ? 1 : -1;
  const hemY = 19 + walkOffset;
  let footX;

  if (dir === 0) {
    footX = legL > 0 ? 6 : 8;
  } else if (dir === 1) {
    footX = 5 + legL;
  } else if (dir === 2) {
    footX = 8 - legL;
  } else {
    footX = 7;
  }

  paintJilbabUndercoat(ctx, ox, oy, dir, hemY, C);
  paintJilbabEdgeOutline(ctx, ox, oy, hemY, C);

  if (dir === 0) {
    rect(ctx, ox + 3, oy + 10, 10, 2, C.jilbab);
    rect(ctx, ox + 2, oy + 12, 11, 4, C.jilbab);
    fillJilbabSkirtToHem(ctx, ox, oy, 0, hemY, C);
    drawJilbabHemAndFeet(ctx, ox, oy, 0, hemY, footX, legL, C);
  } else if (dir === 1) {
    rect(ctx, ox + 8, oy + 10, 7, 9, C.jilbab);
    rect(ctx, ox + 4, oy + 10, 5, 9, C.jilbab);
    fillJilbabSkirtToHem(ctx, ox, oy, 1, hemY, C);
    drawJilbabHemAndFeet(ctx, ox, oy, 1, hemY, footX, legL, C);
  } else if (dir === 2) {
    rect(ctx, ox + 1, oy + 10, 7, 9, C.jilbab);
    rect(ctx, ox + 7, oy + 10, 5, 9, C.jilbab);
    fillJilbabSkirtToHem(ctx, ox, oy, 2, hemY, C);
    drawJilbabHemAndFeet(ctx, ox, oy, 2, hemY, footX, legL, C);
  } else if (dir === 3) {
    rect(ctx, ox + 1, oy + 10, 14, 9, C.jilbab);
    rect(ctx, ox + 0, oy + 17, 15, 2, C.jilbab);
    fillJilbabSkirtToHem(ctx, ox, oy, 3, hemY, C);
    drawJilbabHemAndFeet(ctx, ox, oy, 3, hemY, footX, legL, C);
  }
}

/** Front-facing portrait helper — elder portrait shares protagonist silhouette. */
function drawWomanJilbabFrontPortrait(ctx, ox, oy, options) {
  options = options || {};
  const skin = options.skin || HIJAB_COLORS.skin;
  const hijab = options.hijab || HIJAB_COLORS.hijab;
  const lip = options.lip || '#c07050';
  const frame = options.frame || 0;
  const palette = options.jilbabPalette || null;

  drawJilbabBody(ctx, ox, oy, 0, frame, palette);
  drawHijabBase(ctx, ox, oy, 0, hijab, options.hijabDark || HIJAB_COLORS.hijabDark);
  drawHijabFaceSkinOctagon(ctx, ox, oy, 0, skin);
  const layout = HIJAB_FACE_LAYOUT[0];
  for (let i = 0; i < layout.eyes.length; i++) {
    const e = layout.eyes[i];
    rect(ctx, ox + e.x, oy + e.y, 2, 2, HIJAB_COLORS.eye);
  }
  px(ctx, ox + 7, oy + 8, lip);
  px(ctx, ox + 9, oy + 8, lip);
  rect(ctx, ox + 7, oy + 9, 3, 1, lip);
  drawHijabCheekAccents(ctx, ox, oy, layout.hijabCheeks, hijab, options.hijabDark || HIJAB_COLORS.hijabDark, 0);
  bridgeHijabToJilbab(ctx, ox, oy, 0, hijab);
  rect(ctx, ox + 4, oy + 23, 8, 1, 'rgba(0,0,0,0.3)');
}

window.MoWomanJilbabDraw = {
  drawFrontPortrait: drawWomanJilbabFrontPortrait,
};
// END JILBAB_BODY_DRAW

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
    const hijab = HIJAB_COLORS.hijab;
    drawJilbabBody(ctx, ox, oy, dir, frame);
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
  'p': 26,
};

const SOLID_TILES = new Set([3, 4, 5, 8, 12, 13, 19, 20, 22, 23]);
/** Wall menu / strike / house-rules boards — partial solid, not full tile (see cafe M/K/H branch). */
const CAFE_WALL_SIGN_CHARS = new Set(['M', 'K', 'H']);

const OUTSIDE_BUILDING = MoDoors.OUTSIDE_BUILDING;

/** Single source of truth for outside street stack: door row → props → board → sidewalk. */
const OUTSIDE_LAYOUT = {
  propsRow: 11,
  board: { col: 3, row: 12 },
  sidewalkRow: 13,
  props: { flowerCol: 2, brewSignCol: 6 },
  stepStoneRows: [11, 12],
  sidewalkStartCol: 2,
  sidewalkEndCol: 17,
};

const COMMUNITY_BOARD = OUTSIDE_LAYOUT.board;
const BOARD_SIDEWALK = { col: OUTSIDE_LAYOUT.board.col, row: OUTSIDE_LAYOUT.sidewalkRow };
const OUTSIDE_SIDEWALK_ROW = OUTSIDE_LAYOUT.sidewalkRow;
/** Art-fitted blockers on the 56×56 community board canvas (includes legs/base). */
const COMMUNITY_BOARD_PROP_SOLIDS = [
  { left: 8, top: 24, width: 32, height: 32 },
  { left: 12, top: 42, width: 3, height: 18 },
  { left: 31, top: 42, width: 3, height: 18 },
  { left: 6, top: 52, width: 36, height: 8 },
];
/** Post feet on the sidewalk row under the kiosk (local px on that tile). */
const COMMUNITY_BOARD_SIDEWALK_POSTS = [
  { col: 1, row: OUTSIDE_LAYOUT.sidewalkRow, left: 40, top: 0, width: 4, height: 10 },
  { col: 2, row: OUTSIDE_LAYOUT.sidewalkRow, left: 14, top: 0, width: 4, height: 10 },
];
/** Freestanding brew sign — board + post (32×32 tile px). */
const BREW_SIGN_PROP_SOLIDS = [
  { left: 4, top: 6, width: 24, height: 16 },
  { left: 14, top: 20, width: 4, height: 12 },
];
/** Post stump on the grass tile south of the brew sign. */
const BREW_SIGN_POST_BELOW = { colOff: 0, rowOff: 1, left: 14, top: 0, width: 4, height: 10 };
/** Clear grass pixels between stacked outside props (board above sidewalk). */
const PROP_GRASS_GAP = 1;
/** Flagstones on approach rows — door column only, grass before sidewalk. */
const CAFE_STEP_STONES = OUTSIDE_LAYOUT.stepStoneRows.map((row, i) => ({ row, variant: i % 2 }));

/** @type {Array<{ map: string, col: number, row: number, title: string, text: string }>} */
const READABLES = [
  {
    map: 'outside',
    col: OUTSIDE_LAYOUT.board.col,
    row: OUTSIDE_LAYOUT.board.row,
    title: 'Neighborhood board',
    text: 'Dragon\'s Brew — down the brick path, mornings.\nPlaza market beyond the train station when you\'re ready to venture out.',
  },
  {
    map: 'outside',
    col: 8,
    row: 5,
    id: 'storefront_sign',
    title: 'Dragon\'s Brew — storefront sign',
    text: 'Warm drinks and breakfast. All species welcome at the counter.\nStep through the door when it\'s open.',
  },
  {
    map: 'outside',
    col: OUTSIDE_LAYOUT.props.brewSignCol,
    row: OUTSIDE_LAYOUT.propsRow,
    id: 'direction_sign',
    title: 'Direction sign',
    text: 'Dragon\'s Brew — follow the stepping stones to the door.',
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
    id: 'strike_board',
    map: 'cafe',
    col: 3,
    row: 1,
    title: 'Strike of the week',
    text: 'White sugar off the menu until the lot meets co-op standards.\nBrown sugar in the thermoses until further notice.',
  },
  {
    id: 'house_rules',
    map: 'cafe',
    col: 4,
    row: 1,
    title: 'House rules (wall sign)',
    text: 'Food & drink here:\n• No customer blood served here.\n• No bovine blood served here.\n• No lizard or cow meat. (Fish is fine.)\n\nWe reserve the right to refuse service due to racism, predator-attitude, fighting, loud arguments, smoking, drinking alcohol, and picking on customers.',
  },
];

function cafeStepStoneWorldX() {
  return MoDoors.outsideDoorWorldX() - (TILE * SCALE) / 2;
}

/** Sparkle anchors on painted façade sign — shares MoDoors.facadeSignMetrics with art. */
function facadeSignSparklePoints() {
  const b = OUTSIDE_BUILDING;
  const bx = b.left * TILE;
  const by = b.top * TILE;
  const sign = MoDoors.facadeSignMetrics(b.width * TILE, b.height * TILE);
  const sx = sign.sx;
  const sy = sign.sy;
  const sw = sign.sw;
  const sh = sign.sh;
  return [
    [bx + sx + 6, by + sy + 5], [bx + sx + Math.floor(sw / 2), by + sy + 3], [bx + sx + sw - 6, by + sy + 5],
    [bx + sx + 2, by + sy + 14], [bx + sx + sw - 2, by + sy + 14],
    [bx + sx + 2, by + sy + 26], [bx + sx + sw - 2, by + sy + 32],
    [bx + sx + 10, by + sy + sh - 4], [bx + sx + sw - 10, by + sy + sh - 4],
    [bx + sx + Math.floor(sw / 2), by + sy + sh - 6],
  ];
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
  if (item.map === 'outside' && item.id === 'storefront_sign') {
    return facadeSignSparklePoints();
  }
  if (item.map === 'outside' && item.id === 'direction_sign') {
    return readableBoardFrameLocs(
      OUTSIDE_LAYOUT.props.brewSignCol,
      OUTSIDE_LAYOUT.propsRow,
      4, 6, 24, 16
    );
  }
  if (item.map === 'outside' && item.col === COMMUNITY_BOARD.col && item.row === COMMUNITY_BOARD.row) {
    const tx = COMMUNITY_BOARD.col * TILE - COMMUNITY_BOARD_SHIFT;
    const ty = COMMUNITY_BOARD.row * TILE - COMMUNITY_BOARD_LIFT;
    return [
      [tx + 8, ty + 15], [tx + 24, ty + 8], [tx + 39, ty + 15],
      [tx + 8, ty + 18], [tx + 39, ty + 18],
      [tx + 8, ty + 31], [tx + 39, ty + 31],
      [tx + 11, ty + 22], [tx + 28, ty + 23],
      [tx + 10, ty + 38], [tx + 36, ty + 38],
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
  if (item.map === 'outside' && item.id === 'storefront_sign') return 'storefront';
  if (item.map === 'outside' && (item.id === 'direction_sign'
    || (item.col === COMMUNITY_BOARD.col && item.row === COMMUNITY_BOARD.row))) return 'wood';
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
    playerStart: { col: 5, feetRow: OUTSIDE_LAYOUT.sidewalkRow, facing: 'up' },
    mara: null,
    grid: [
      '...................p',
      '.1................1.',
      '..1....1....1.......',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '..f...B.............',
      '...S................',
      '..PPPPPPPPPPPPPPPP..',
      '....................',
      '....................',
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
      '#...................#',
      '#...................#',
      '#..*....*....*......#',
      '#..c....c....c......#',
      '#....*....*.........#',
      '#..o....c....o......#',
      '#...................#',
      '#...................#',
      '#........>.........#',
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

function isCafeSeatCell(col, row) {
  for (let i = 0; i < CAFE_SEATS.length; i++) {
    const s = CAFE_SEATS[i];
    if (s.col === col && s.row === row) return true;
  }
  return false;
}

function cafeTableFeetBlocked(feetX, feetY) {
  const u = TILE * SCALE;
  const col = Math.floor(feetX / u);
  const row = Math.floor((feetY - 1) / u);
  const grid = MAPS.cafe.grid;
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
  if (grid[row][col] === '*') return true;
  if (row + 1 < ROWS && grid[row + 1][col] === '*') {
    return feetY >= (row + 1) * u;
  }
  return false;
}

/** True when this café grid cell should block walking (furniture or structural wall). */
function cafeCellBlocksWalking(ch, col, row) {
  if (ch === '#' || ch === '|' || ch === '-') return true;
  if (CAFE_WALL_SIGN_CHARS.has(ch)) return true;
  if ((ch === 'c' || ch === 'o') && isCafeSeatCell(col, row)) return true;
  return false;
}

/** Tile south of seat when facing up (table north); player stands here and presses T. */
function seatApproachCell(seat) {
  switch (seat.facing) {
    case 'down': return { col: seat.col, row: seat.row - 1 };
    case 'left': return { col: seat.col + 1, row: seat.row };
    case 'right': return { col: seat.col - 1, row: seat.row };
    default: return { col: seat.col, row: seat.row + 1 };
  }
}

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
    for (let v = 0; v < GRASS_VARIANT_COUNT; v++) {
      for (let f = 0; f < GRASS_BREEZE_FRAMES; f++) {
        const key = grassTexKey(v, f);
        add(key, 32, 32, ctx => drawGrass(ctx, 0, 0, v, f));
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    add('t_grass',  32, 32, ctx => drawGrass(ctx, 0, 0, 0, 0));
    add('t_grass2', 32, 32, ctx => drawGrass(ctx, 0, 0, 1, 0));
    add('t_path',   32, 32, ctx => drawPath(ctx, 0, 0));
    add('t_water',  32, 32, ctx => drawWater(ctx, 0, 0, 0));
    add('t_water2', 32, 32, ctx => drawWater(ctx, 0, 0, 1));
    add('t_tree',   32, 64, ctx => drawTree(ctx, 0, 0));
    add('t_fence',  32, 32, ctx => drawFence(ctx, 0, 0));
    add('t_sign',   COMMUNITY_BOARD_CANVAS_W, COMMUNITY_BOARD_CANVAS_H, ctx => drawCommunityBoard(ctx, 0, 0));
    add('t_flower', 32, 32, ctx => drawGoldenPoppy(ctx, 0, 0));
    add('t_poppy_patch', POPPY_PATCH_CANVAS_W, POPPY_PATCH_CANVAS_H, ctx => drawMeadowPoppyCluster(ctx, 0, 0));
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
    for (let v = 0; v < 2; v++) {
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
    const fw = OUTSIDE_BUILDING.width * TILE;
    const fh = OUTSIDE_BUILDING.height * TILE;
    const bc = makeCanvas(fw, fh);
    drawStreetBuildingFacade(bc.getContext('2d'), fw, fh);
    this.textures.addCanvas('street_building', bc);
    this.textures.get('street_building').setFilter(Phaser.Textures.FilterMode.NEAREST);
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
    this.grassAnimTiles = [];
    this.grassBreezeFrame = 0;
    this.grassBreezeAcc = 0;

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
    const bootFromPhaser = () => {
      if (window.MoAudio) window.MoAudio.unlock();
    };
    this.input.keyboard.on('keydown', bootFromPhaser);
    this.input.on('pointerdown', bootFromPhaser);

    this.physics.add.collider(this.player, this.solidBodies);

    this._lastSafeX = this.player.x;
    this._lastSafeY = this.player.y;
    this.events.on('postupdate', this._rejectCafeTableFeet, this);

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
    return rx >= b.left && rx < b.left + b.width
      && ry >= b.top && ry < b.top + b.height;
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

  _grassVariantAt(rx, ry, tid) {
    const seed = rx * 17 + ry * 31 + (tid === 1 ? 53 : 0);
    return ((seed % GRASS_VARIANT_COUNT) + GRASS_VARIANT_COUNT) % GRASS_VARIANT_COUNT;
  }

  _placeGrassTile(wx, wy, rx, ry, tid) {
    const variant = this._grassVariantAt(rx, ry, tid);
    const phase = (rx + ry * 3) % GRASS_BREEZE_FRAMES;
    const frame = (this.grassBreezeFrame + phase) % GRASS_BREEZE_FRAMES;
    const img = this.add.image(wx, wy, grassTexKey(variant, frame))
      .setOrigin(0, 0)
      .setScale(SCALE);
    this.groundLayer.add(img);
    this.grassAnimTiles.push({ img, variant, phase });
    return img;
  }

  _placeOutsideGround(wx, wy, rx, ry, tid) {
    const ch = MAPS.outside.grid[ry][rx];
    if (this._isOutsideBuildingCell(rx, ry)) {
      const img = this.add.image(wx, wy, 't_bfoundation').setOrigin(0, 0).setScale(SCALE);
      this.groundLayer.add(img);
      return;
    }
    if (ch === 'P') {
      const img = this.add.image(wx, wy, 't_street').setOrigin(0, 0).setScale(SCALE);
      this.groundLayer.add(img);
      return;
    }
    this._placeGrassTile(wx, wy, rx, ry, tid);
  }

  _tickGrassBreeze(delta) {
    if (!this.grassAnimTiles.length) return;
    this.grassBreezeAcc += delta;
    while (this.grassBreezeAcc >= GRASS_BREEZE_MS) {
      this.grassBreezeAcc -= GRASS_BREEZE_MS;
      this.grassBreezeFrame = (this.grassBreezeFrame + 1) % GRASS_BREEZE_FRAMES;
      const globalFrame = this.grassBreezeFrame;
      this.grassAnimTiles.forEach(({ img, variant, phase }) => {
        const frame = (globalFrame + phase) % GRASS_BREEZE_FRAMES;
        img.setTexture(grassTexKey(variant, frame));
      });
    }
  }

  _playerGridCell() {
    const u = TILE * SCALE;
    const feetY = this.player.y + this.player.displayHeight * (1 - this.player.originY);
    return {
      col: Math.floor(this.player.x / u),
      row: Math.min(ROWS - 1, Math.max(0, Math.floor((feetY - 1) / u))),
    };
  }

  /** Block feet from entering a table cell or crossing its north edge from the tile above. */
  _rejectCafeTableFeet() {
    if (this.currentMap !== 'cafe' || this.playerSeated || this.dialogueActive || this.orderInputActive) return;
    const feetY = this.player.y + this.player.displayHeight * (1 - this.player.originY);
    if (!cafeTableFeetBlocked(this.player.x, feetY)) {
      this._lastSafeX = this.player.x;
      this._lastSafeY = this.player.y;
      return;
    }
    if (this._lastSafeX != null) {
      this.player.setPosition(this._lastSafeX, this._lastSafeY);
      this.player.body.setVelocity(0, 0);
      this.player.body.updateFromGameObject();
    }
  }

  /** Whole map cell is solid (chairs/stools, wall tiles). */
  _addGridCellSolid(col, row) {
    const u = TILE * SCALE;
    const wx = col * u;
    const wy = row * u;
    const body = this.add.rectangle(wx + u / 2, wy + u / 2, u, u);
    this.physics.add.existing(body, true);
    this.solidBodies.add(body);
  }

  /** Blocker aligned to prop art (local px from origin, usually tile or canvas top-left). */
  _addPropSolid(originX, originY, left, top, width, height) {
    const s = SCALE;
    const body = this.add.rectangle(
      originX + (left + width / 2) * s,
      originY + (top + height / 2) * s,
      width * s,
      height * s
    );
    this.physics.add.existing(body, true);
    this.solidBodies.add(body);
  }

  _placePropSolidList(originX, originY, rects) {
    rects.forEach((r) => {
      this._addPropSolid(originX, originY, r.left, r.top, r.width, r.height);
    });
  }

  _placeCommunityBoardSolids(anchorWx, anchorWy) {
    const imgX = anchorWx - COMMUNITY_BOARD_SHIFT * SCALE;
    const imgY = anchorWy - COMMUNITY_BOARD_LIFT * SCALE;
    this._placePropSolidList(imgX, imgY, COMMUNITY_BOARD_PROP_SOLIDS);
    const u = TILE * SCALE;
    COMMUNITY_BOARD_SIDEWALK_POSTS.forEach((p) => {
      this._addPropSolid(p.col * u, p.row * u, p.left, p.top, p.width, p.height);
    });
  }

  _placeBrewSignSolids(anchorCol, anchorRow, anchorWx, anchorWy) {
    this._placePropSolidList(anchorWx, anchorWy, BREW_SIGN_PROP_SOLIDS);
    const below = BREW_SIGN_POST_BELOW;
    const u = TILE * SCALE;
    this._addPropSolid(
      (anchorCol + below.colOff) * u,
      (anchorRow + below.rowOff) * u,
      below.left,
      below.top,
      below.width,
      below.height
    );
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
    this._lastSafeX = x;
    this._lastSafeY = y;
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
    this.grassAnimTiles = [];
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
            this._placeGrassTile(wx, wy, rx, ry, 0);
          }
          return;
        }

        if (mapKey === 'outside' && this._isOutsideBuildingCell(rx, ry)) {
          if (ry === b.top) return;
          this._placeOutsideGround(wx, wy, rx, ry, 0);
          return;
        }

        const tid = TILE_IDX[ch] ?? 0;

        if (tid === 4) {
          this._placeGrassTile(wx, wy, rx, ry, 0);
          const t = this.add.image(wx, wy - 32 * SCALE, 't_tree').setOrigin(0, 0).setScale(SCALE).setDepth(5);
          this.tallLayer.add(t);
          const body = this.add.rectangle(wx + 16 * SCALE, wy + 20 * SCALE, 14 * SCALE, 24 * SCALE);
          this.physics.add.existing(body, true);
          this.solidBodies.add(body);
        } else if (tid === 6 || tid === 7 || tid === 10 || tid === 26) {
          if (mapKey === 'outside') {
            this._placeOutsideGround(wx, wy, rx, ry, 0);
          } else {
            this._placeGrassTile(wx, wy, rx, ry, 0);
          }
          const overlayKey = tid === 6 ? 't_sign' : tid === 7 ? 't_flower' : tid === 26 ? 't_poppy_patch' : 't_brew';
          const propLift = tid === 6 ? COMMUNITY_BOARD_LIFT * SCALE
            : tid === 26 ? POPPY_PATCH_LIFT * SCALE : 0;
          const propShift = tid === 6 ? COMMUNITY_BOARD_SHIFT * SCALE
            : tid === 26 ? POPPY_PATCH_SHIFT * SCALE : 0;
          const s = this.add.image(wx - propShift, wy - propLift, overlayKey).setOrigin(0, 0).setScale(SCALE).setDepth(5);
          this.tallLayer.add(s);
          if (tid === 6 && mapKey === 'outside') {
            this._placeCommunityBoardSolids(wx, wy);
          } else if (tid === 10 && mapKey === 'outside') {
            this._placeBrewSignSolids(rx, ry, wx, wy);
          }
        } else if (mapKey === 'cafe' && ch === '*') {
          const img = this.add.image(wx, wy, 't_ctable').setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(img);
        } else if (mapKey === 'cafe' && CAFE_WALL_SIGN_CHARS.has(ch)) {
          const signKey = ch === 'M' ? 't_menu' : ch === 'K' ? 't_strike' : 't_hrules';
          const img = this.add.image(wx, wy, signKey).setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(img);
        } else if (tid === 13 && mapKey === 'cafe') {
          const floor = this.add.image(wx, wy, 't_cfloor').setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(floor);
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
        } else if (mapKey === 'cafe' && ch === '=') {
          const c = makeCanvas(32, 32);
          drawCafeTrimTile(c.getContext('2d'), 0, 0, grid, rx, ry);
          const key = 'cafe_trim_v2_' + rx + '_' + ry;
          if (!this.textures.exists(key)) this.textures.addCanvas(key, c);
          const img = this.add.image(wx, wy, key).setOrigin(0, 0).setScale(SCALE);
          this.groundLayer.add(img);
        } else {
          const onSidewalk = mapKey === 'outside' && ch === 'P';
          const boardWalk = onSidewalk && rx === BOARD_SIDEWALK.col && ry === OUTSIDE_SIDEWALK_ROW;
          const streetEnd = onSidewalk && (rx === 2 || rx === COLS - 3);
          if (boardWalk || streetEnd) {
            this._placeOutsideGround(wx, wy, rx, ry, 0);
            const img = this.add.image(wx, wy, 't_street_pad').setOrigin(0, 0).setScale(SCALE);
            this.groundLayer.add(img);
          } else if (mapKey === 'outside' && (tid === 0 || tid === 1) && !onSidewalk) {
            this._placeGrassTile(wx, wy, rx, ry, tid);
          } else {
            let key = onSidewalk ? 't_street' : (TILE_KEY[tid] ?? 't_grass');
            if (mapKey === 'cafe' && (tid === 0 || tid === 1)) key = 't_cfloor';
            const img = this.add.image(wx, wy, key).setOrigin(0, 0).setScale(SCALE);
            this.groundLayer.add(img);
          }

          if (SOLID_TILES.has(tid) && !(mapKey === 'cafe' && CAFE_WALL_SIGN_CHARS.has(ch))) {
            const body = this.add.rectangle(wx + 16 * SCALE, wy + 16 * SCALE, 32 * SCALE, 32 * SCALE);
            this.physics.add.existing(body, true);
            this.solidBodies.add(body);
          }
        }
      });
    });

    if (mapKey === 'cafe') {
      grid.forEach((row, ry) => {
        row.forEach((ch, rx) => {
          if (cafeCellBlocksWalking(ch, rx, ry)) {
            this._addGridCellSolid(rx, ry);
          }
        });
      });
    }

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
    if (this.audioStarted) MoWebAudio.sfxInteract();
  }

  _eatFood() {
    if (!this.plateWithPlayer || !this.foodPlate || !this.foodPlate.visible) return;
    if (!this.playerSeated && this._isDinePhase()) return;
    if (this.plateFullness <= 0) return;
    this.plateFullness -= 1;
    this._applyPlateBitesVisual();
    if (this.audioStarted) MoWebAudio.sfxInteract();
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
    if (this.audioStarted) MoWebAudio.sfxInteract();
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

  _ensureAudio(onReady) {
    if (window.MoAudio && typeof window.MoAudio.unlock === 'function') {
      window.MoAudio.unlock(onReady);
    } else {
      MoWebAudio.unlock(() => {
        this.audioStarted = true;
        if (typeof onReady === 'function') onReady();
      });
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
    const enteringCafe = this.currentMap === 'outside' && conf.exitTo === 'cafe';
    const leavingCafe = this.currentMap === 'cafe' && conf.exitTo === 'outside';
    if (enteringCafe) MoWebAudio.sfxDoorOpen();
    else if (leavingCafe) MoWebAudio.sfxDoorClose();
    this._loadMap(conf.exitTo, spawn);
  }

  _closeDialogue() {
    const kind = this.dialogueKind;
    if (kind === 'mara_order' && this.orderInputActive) {
      this.dialogueBox.setVisible(false);
      this.dialogueActive = false;
      this.dialogueKind = null;
      if (this.audioStarted) MoWebAudio.sfxClose();
      return;
    }
    if (kind === 'visit_beat') {
      const menuApi = window.DragonsBrewMenu;
      const prevPhase = menuApi && menuApi.getVisitPhase ? menuApi.getVisitPhase() : '';
      this.dialogueBox.setVisible(false);
      this.dialogueActive = false;
      this.dialogueKind = null;
      if (this.audioStarted) MoWebAudio.sfxClose();
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
    if (this.audioStarted) MoWebAudio.sfxClose();
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
    if (this.audioStarted) MoWebAudio.sfxInteract();
  }

  _closeVisitPanel() {
    if (!this.maraVisitWrap) return;
    this.visitPanelActive = false;
    this.maraVisitWrap.classList.remove('is-open');
    this.maraVisitWrap.setAttribute('aria-hidden', 'true');
    if (this.audioStarted) MoWebAudio.sfxClose();
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
      if (this.audioStarted) MoWebAudio.sfxInteract();
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
    if (playCloseSfx !== false && this.audioStarted) MoWebAudio.sfxClose();
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
    if (item.id === 'house_rules' && window.MoElderReport) {
      window.MoElderReport.markWallRead('house_rules');
    }
    if (item.id === 'strike_board' && window.MoElderReport) {
      window.MoElderReport.markWallRead('strike');
    }
    this._showDialogue(item.title + '\n\n' + body);
    if (this.audioStarted) MoWebAudio.sfxInteract();
  }

  /** Adjacent to a seat, facing it — chairs are solid; press T from the approach tile. */
  _chairUnderPlayer() {
    if (this.currentMap !== 'cafe') return null;
    const cell = this._playerGridCell();
    const u = TILE * SCALE;
    for (let i = 0; i < CAFE_SEATS.length; i++) {
      const seat = CAFE_SEATS[i];
      const approach = seatApproachCell(seat);
      if (cell.col !== approach.col || cell.row !== approach.row) continue;
      const sx = seat.col * u + u / 2;
      const sy = seat.row * u + u / 2;
      if (!this._facingToward(sx, sy)) continue;
      return seat;
    }
    return null;
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
    this._showDialogue('Walk up to a chair and press T to sit.');
  }

  _sitAt(seat) {
    this.playerSeated = true;
    this.seatAnchor = seat;
    this.facing = seat.facing || 'up';
    const pos = this._seatedPlayerPos(seat);
    this.player.setPosition(pos.x, pos.y);
    this.player.body.setVelocity(0, 0);
    this.player.body.moves = false;
    this.player.body.updateFromGameObject();
    this.player.setDepth(11);
    this.player.play(`idle-${this.facing}`, true);
    this._syncCupPosition();
    this._syncPlatePosition();
  }

  _standUp() {
    const seat = this.seatAnchor;
    this.playerSeated = false;
    this.seatAnchor = null;
    this.player.body.moves = true;
    this.player.body.setVelocity(0, 0);
    if (seat) {
      const approach = seatApproachCell(seat);
      const u = TILE * SCALE;
      const feetY = approach.row * u + u * 0.5;
      const footDrop = this.player.displayHeight * (1 - this.player.originY);
      this.facing = seat.facing || 'up';
      this.player.setPosition(approach.col * u + u / 2, feetY - footDrop);
      this.player.body.updateFromGameObject();
    }
    this._syncCupPosition();
    this._syncPlatePosition();
    this._applyPlayerDepth();
    if (this.audioStarted) MoWebAudio.sfxInteract();
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
    } else if (window.MoElderReport && window.MoElderReport.isReportPending && window.MoElderReport.isReportPending()) {
      this._showDialogue(
        'Mara sets down a cup. "Your elder is ready for that check-in — step outside when you can take the call."'
      );
    } else if (window.MoElderReport && window.MoElderReport.isAwaitingLanguageGoal && window.MoElderReport.isAwaitingLanguageGoal()) {
      this._showDialogue(
        'Mara nods toward the menu board. "A few more words from the wall in your pocket — then your elder will want to hear about the week."'
      );
    } else if (window.MoElderReport && window.MoElderReport.isDone && window.MoElderReport.isDone()) {
      if (window.MoElderReport.needsRevisit && window.MoElderReport.needsRevisit()) {
        this._showDialogue(
          'Mara smiles. "Your elder loved what you shared — she asked you to notice one more thing next time you\'re here."'
        );
      } else {
        this._showDialogue(
          'Mara wipes the counter. "Your elder sounded pleased. The room is yours whenever you\'re ready."'
        );
      }
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
    if (this.audioStarted) MoWebAudio.sfxInteract();
  }

  update(time, delta) {
    const { cursors, wasd, player } = this;
    const speed = 100 * SCALE;
    let vx = 0, vy = 0;

    this._tickGrassBreeze(delta);

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

    if (window.MoPrologue && window.MoPrologue.isActive && window.MoPrologue.isActive()) {
      player.setVelocity(0, 0);
      player.play(`idle-${this.facing}`, true);
      return;
    }

    if (window.MoElderReport && window.MoElderReport.isActive && window.MoElderReport.isActive()) {
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
        if (this.audioStarted) MoWebAudio.sfxInteract();
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
      const mapConf = MAPS[this.currentMap];
      if (!this._canUseDoor(mapConf)) MoWebAudio.sfxStep();
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
