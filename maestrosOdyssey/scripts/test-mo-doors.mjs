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
const building = MoDoors.OUTSIDE_BUILDING;
const derivedCol = MoDoors.deriveDoorCol(building);

assert(derivedCol === 9, 'deriveDoorCol returns 9 for current building');
assert(anchor.gridCol === derivedCol, 'anchor.gridCol matches deriveDoorCol');
assert(anchor.outsideRow === 10, 'outside trigger row 10');
assert(anchor.insideExitRow === 11, 'café exit row 11');

const expectedWorldX = (derivedCol * TILE + TILE / 2) * SCALE;
assert(anchor.worldX === expectedWorldX, 'worldX is door tile center (col 9 → 608)');
assert(
  anchor.worldX === MoDoors.doorTileCenterWorldX(),
  'worldX matches doorTileCenterWorldX',
);

const spawnY = MoDoors.spriteCenterYForFeetRow(10);
const feetY = 10 * TILE * SCALE + TILE * SCALE * 0.5;
const expectedCenter = feetY - (24 * SCALE * 0.5);
assert(Math.abs(spawnY - expectedCenter) < 0.01, 'spawn Y matches feet row math');

const outsideTrigger = MoDoors.triggerCellRect('outside');
const passage = MoDoors.outsideDoorPassageRect();
assert(
  outsideTrigger.left < passage.right && outsideTrigger.right > passage.left
    && outsideTrigger.top < passage.bottom && outsideTrigger.bottom > passage.top,
  'outside trigger overlaps collision passage',
);

const cafeGrid = Array.from({ length: 16 }, () => Array(20).fill('.'));
cafeGrid[11][anchor.gridCol] = '>';
assert(MoDoors.validateDoorLink(cafeGrid) === true, 'validateDoorLink passes with > at exit cell');

cafeGrid[11][anchor.gridCol] = '#';
assert(MoDoors.validateDoorLink(cafeGrid) === false, 'validateDoorLink fails when > missing');

const col = anchor.gridCol;
const feetWorld = { x: anchor.worldX, y: anchor.outsideExitSpawnY + 24 };

assert(
  MoDoors.playerOnDoorTrigger(col, 10, 'outside', null, feetWorld) === true,
  'on outside door tile',
);
assert(
  MoDoors.playerOnDoorTrigger(col, 11, 'outside', null, feetWorld) === false,
  'porch row 11 does not trigger outside enter without up key',
);
assert(
  MoDoors.playerOnDoorTrigger(col, 11, 'outside', { up: true, down: false, left: false, right: false }, feetWorld) === true,
  'porch row 11 triggers outside enter when pressing up',
);
assert(
  MoDoors.playerOnDoorTrigger(col, 11, 'cafe', null, feetWorld) === true,
  'on café exit tile',
);
assert(
  MoDoors.playerOnDoorTrigger(col, 10, 'cafe', { up: false, down: true, left: false, right: false }, feetWorld) === true,
  'café vestibule row 10 triggers exit',
);

const spawnOut = MoDoors.resolveExitSpawn(
  { exitTo: 'outside', exitSpawn: { x: 100, y: 200, facing: 'down' } },
  { x: 0, y: 0 },
);
assert(
  spawnOut.x === expectedWorldX && spawnOut.feetRow === 10 && spawnOut.facing === 'down' && spawnOut.y === undefined,
  'resolveExitSpawn to outside uses tile X and feetRow 10',
);

const spawnIn = MoDoors.resolveExitSpawn(
  { exitTo: 'cafe', exitSpawn: { x: 50, y: 99, facing: 'up' } },
  { x: 0, y: 0 },
);
assert(
  spawnIn.x === expectedWorldX && spawnIn.feetRow === 11 && spawnIn.facing === 'up' && spawnIn.y === undefined,
  'resolveExitSpawn to café uses tile X and feetRow 11',
);

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nAll mo-doors checks passed.');
