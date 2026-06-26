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
const col = MoDoors.deriveDoorCol(MoDoors.OUTSIDE_BUILDING);

assert(col === 9, 'deriveDoorCol returns 9');
assert(anchor.gridCol === 9, 'gridCol is 9');
assert(anchor.insideEnterRow === 10, 'café enter row 10');
assert(anchor.insideExitRow === 11, 'café exit row 11');
assert(anchor.outsideApproachRow === 11, 'outside approach row 11');

const enter = MoDoors.spawnForTransition('cafe');
assert(enter.col === 9 && enter.feetRow === 10 && enter.facing === 'up', 'enter spawn col 9 row 10 up');

const exit = MoDoors.spawnForTransition('outside');
assert(exit.col === 9 && exit.feetRow === 11 && exit.facing === 'down', 'exit spawn col 9 row 11 down');

const pos = MoDoors.spritePosFromGrid(9, 10, 48, 0.5);
assert(pos.x === (9 * TILE + TILE / 2) * SCALE, 'sprite X at tile center');
assert(Math.abs(pos.y - (10 * TILE * SCALE + TILE * SCALE * 0.5 - 24)) < 0.01, 'sprite Y from feet row');

assert(MoDoors.playerOnDoorTrigger(9, 10, 'outside') === true, 'outside row 10 on door col');
assert(MoDoors.playerOnDoorTrigger(8, 10, 'outside') === false, 'wrong col fails');
assert(
  MoDoors.playerOnDoorTrigger(9, 11, 'outside', { up: true, down: false, left: false, right: false }) === true,
  'outside row 11 with up',
);
assert(MoDoors.playerOnDoorTrigger(9, 11, 'cafe') === true, 'café exit row');
assert(
  MoDoors.playerOnDoorTrigger(9, 10, 'cafe', { up: false, down: true, left: false, right: false }) === true,
  'café inside row 10',
);

const cafeGrid = Array.from({ length: 16 }, () => Array(20).fill('.'));
cafeGrid[11][9] = '>';
assert(MoDoors.validateDoorLink(cafeGrid) === true, 'validateDoorLink passes');

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nAll mo-doors checks passed.');
