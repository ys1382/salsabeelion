#!/usr/bin/env node
/**
 * Renders woman_jilbab head frames (4 directions) at 8× scale and runs pixel asserts.
 * Extracts draw code from mo-farm-rpg.js between HIJAB_FACE_DRAW markers — no drift.
 *
 * Usage (from repo root):
 *   node maestrosOdyssey/dev/render-hijab-sprite-sheet.js
 *
 * Requires: npm install canvas (optional — falls back to raw PNG via pure checks only)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const RPG = path.join(ROOT, 'www', 'mo-farm-rpg.js');
const OUT_PNG = path.join(__dirname, 'hijab-sprite-preview.png');

const CHAR_W = 16;
const CHAR_H = 24;
const SCALE = 8;
const DIRS = [
  { dir: 0, label: 'front' },
  { dir: 1, label: 'left' },
  { dir: 2, label: 'right' },
  { dir: 3, label: 'back' },
];

function extractHijabDrawBlock(src) {
  const start = src.indexOf('// BEGIN HIJAB_FACE_DRAW');
  const end = src.indexOf('// END HIJAB_FACE_DRAW');
  if (start < 0 || end < 0) throw new Error('HIJAB_FACE_DRAW markers not found in mo-farm-rpg.js');
  return src.slice(start, end + '// END HIJAB_FACE_DRAW'.length);
}

function hexRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function colorAt(data, w, x, y) {
  const i = (y * w + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

function matchesHex(px, hex) {
  const t = hexRgb(hex);
  return px.r === t.r && px.g === t.g && px.b === t.b;
}

function loadDrawApi() {
  const src = fs.readFileSync(RPG, 'utf8');
  const block = extractHijabDrawBlock(src);
  const sandbox = {
    rect: (ctx, x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    },
    px: (ctx, x, y, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    },
  };
  vm.runInNewContext(block + '\nthis.api = { HIJAB_FACE_LAYOUT, HIJAB_COLORS, drawHijabFaceFromLayout };', sandbox);
  return sandbox.api;
}

function renderHead(api, dir) {
  let createCanvas;
  try {
    createCanvas = require('canvas').createCanvas;
  } catch (e) {
    console.error('Install canvas package: npm install canvas');
    process.exit(1);
  }
  const canvas = createCanvas(CHAR_W, CHAR_H);
  const ctx = canvas.getContext('2d');
  api.drawHijabFaceFromLayout(ctx, 0, 0, dir, api.HIJAB_COLORS.skin, api.HIJAB_COLORS.hijab);
  return canvas;
}

function assertPixels(api, dir, data, w) {
  const errors = [];
  const layout = api.HIJAB_FACE_LAYOUT[dir];
  const C = api.HIJAB_COLORS;

  if (dir === 3) return errors;

  for (let i = 0; i < layout.eyes.length; i++) {
    const e = layout.eyes[i];
    const cx = e.x + 1;
    const cy = e.y + 1;
    const px = colorAt(data, w, cx, cy);
    if (!matchesHex(px, C.eye)) {
      errors.push(`dir ${dir}: eye center (${cx},${cy}) expected ${C.eye}, got rgb(${px.r},${px.g},${px.b})`);
    }
  }

  for (let i = 0; i < layout.hijabCheeks.length; i++) {
    const col = layout.hijabCheeks[i].col;
    const px = colorAt(data, w, col, 7);
    if (matchesHex(px, C.skin)) {
      errors.push(`dir ${dir}: hijab cheek col ${col} row 7 is skin (overlap)`);
    }
    if (!matchesHex(px, C.hijab) && !matchesHex(px, C.hijabDark)) {
      errors.push(`dir ${dir}: hijab cheek col ${col} row 7 not hijab color`);
    }
  }

  const fs = layout.faceSkin;
  const midX = fs.x + Math.floor(fs.w / 2);
  const midY = fs.y + 2;
  const mid = colorAt(data, w, midX, midY);
  if (!matchesHex(mid, C.skin)) {
    errors.push(`dir ${dir}: face interior (${midX},${midY}) expected skin`);
  }

  if (dir === 1) {
    const p = colorAt(data, w, 4, 7);
    if (matchesHex(p, C.skin)) errors.push('dir 1: col 4 row 7 must not be skin');
  }
  if (dir === 2) {
    const p = colorAt(data, w, 8, 7);
    if (matchesHex(p, C.skin)) errors.push('dir 2: col 8 row 7 must not be skin');
  }
  if (dir === 0) {
    const p = colorAt(data, w, 10, 5);
    if (matchesHex(p, C.hijab) || matchesHex(p, C.hijabDark)) {
      errors.push('dir 0: col 10 row 5 must not be hijab (inside face skin box)');
    }
  }

  return errors;
}

function main() {
  const api = loadDrawApi();
  let createCanvas;
  try {
    createCanvas = require('canvas').createCanvas;
  } catch (e) {
    console.error('canvas package required for preview PNG');
    process.exit(1);
  }

  const pad = 8;
  const panelW = CHAR_W * SCALE;
  const panelH = CHAR_H * SCALE + 20;
  const sheetW = panelW * 4 + pad * 5;
  const sheetH = panelH + pad * 2;
  const sheet = createCanvas(sheetW, sheetH);
  const sctx = sheet.getContext('2d');

  sctx.fillStyle = '#1a1a2e';
  sctx.fillRect(0, 0, sheetW, sheetH);

  const allErrors = [];

  DIRS.forEach((d, i) => {
    const head = renderHead(api, d.dir);
    const raw = head.getContext('2d').getImageData(0, 0, CHAR_W, CHAR_H);
    allErrors.push(...assertPixels(api, d.dir, raw.data, CHAR_W));

    const dx = pad + i * (panelW + pad);
    const dy = pad;
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(head, dx, dy, panelW, panelH);
    sctx.fillStyle = '#e8e0d0';
    sctx.font = '14px sans-serif';
    sctx.fillText(d.label, dx, dy + panelH + 16);
  });

  const buf = sheet.toBuffer('image/png');
  fs.writeFileSync(OUT_PNG, buf);
  console.log('Wrote', OUT_PNG);

  if (allErrors.length) {
    console.error('ASSERT FAILURES:');
    allErrors.forEach((e) => console.error(' -', e));
    process.exit(1);
  }
  console.log('All pixel asserts passed.');
}

main();
