#!/usr/bin/env node
/**
 * Pure-math checks for mo-doors.js — run from repo root:
 *   node maestrosOdyssey/scripts/test-mo-doors.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const doorsPath = path.join(__dirname, '../www/mo-doors.js');
const code = fs.readFileSync(doorsPath, 'utf8');
const sandbox = { window: {}, console, globalThis: {} };
sandbox.window = sandbox;
vm.runInContext(code, vm.createContext(sandbox));
const MoDoors = sandbox.window.MoDoors;

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('ok:', msg);
  }
}

const anchor = MoDoors.getDoorAnchor();
const TILE = MoDoors.TILE;
const SCALE = MoDoors.SCALE;

assert(anchor.worldX === (8 * TILE + TILE / 2) * SCALE, 'door worldX at col 8 center');
assert(anchor.gridCol === 8 && anchor.outsideRow === 10, 'outside trigger at col 8 row 10');
assert(anchor.insideExitRow === 11, 'café exit row 11');

const spawnY = MoDoors.spriteCenterYForFeetRow(10);
const feetY = 10 * TILE * SCALE + TILE * SCALE * 0.5;
const expectedCenter = feetY - (24 * SCALE * 0.5);
assert(Math.abs(spawnY - expectedCenter) < 0.01, 'spawn Y matches feet row math');

const outsideTrigger = MoDoors.triggerCellRect('outside');
const passage = MoDoors.outsideDoorPassageRect();
assert(
  outsideTrigger.left < passage.right && outsideTrigger.right > passage.left
    && outsideTrigger.top < passage.bottom && outsideTrigger.bottom > passage.top,
  'outside trigger overlaps collision passage'
);

const cafeGrid = Array.from({ length: 16 }, () => Array(20).fill('.'));
cafeGrid[11][8] = '>';
assert(MoDoors.validateDoorLink(cafeGrid) === true, 'validateDoorLink passes with > at exit cell');

cafeGrid[11][8] = '#';
assert(MoDoors.validateDoorLink(cafeGrid) === false, 'validateDoorLink fails when > missing');

assert(
  MoDoors.playerOnDoorTrigger(8, 10, 'outside') === true,
  'on outside door tile'
);
assert(
  MoDoors.playerOnDoorTrigger(8, 11, 'outside') === false,
  'porch row 11 does not trigger outside enter'
);
assert(
  MoDoors.playerOnDoorTrigger(8, 11, 'cafe') === true,
  'on café exit tile'
);
assert(
  MoDoors.playerOnDoorTrigger(8, 10, 'cafe', { up: false, down: true, left: false, right: false }) === true,
  'café vestibule row 10 triggers exit'
);

const spawn = MoDoors.resolveExitSpawn(
  { exitSpawn: { x: 100, y: 200, facing: 'up' } },
  { x: 0, y: 0 },
  272
);
assert(spawn.x === 272 && spawn.y === 200 && spawn.facing === 'up', 'resolveExitSpawn keeps Y/facing, swaps X');

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nAll mo-doors checks passed.');
