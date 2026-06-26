/**
 * Maestro's Odyssey — door anchor, collision passage, transition triggers, spawn.
 *
 * Invariants (tests enforce these):
 * - gridCol is derived from painted façade center, never hand-tuned
 * - café grid row 11 ">" must match gridCol (validateDoorLink)
 * - collision passage contains outside walk bands (rows 10–11)
 * - resolveExitSpawn snaps X to door tile center and Y via feetRow (actual sprite height)
 */
(function (root) {
  'use strict';

  var TILE = 32;
  var SCALE = 2;
  var CHAR_H = 24;
  var ROWS = 16;

  var OUTSIDE_BUILDING = { left: 3, top: 4, width: 12, height: 7, doorRow: 10 };
  var CAFE_DOOR_ROW = 10;
  var CAFE_EXIT_DOOR_ROW = 11;

  function facadeDoorMetrics(bw, bh) {
    var dw = 22;
    var dh = 40;
    var dx = Math.floor(bw / 2) - Math.floor(dw / 2);
    var dy = bh - 46;
    var panelTop = dy + 5;
    var panelH = dh - 10;
    return {
      dx: dx, dy: dy, dw: dw, dh: dh,
      cx: dx + dw / 2,
      cy: panelTop + panelH / 2,
    };
  }

  /** Grid column under the painted door center — single source for triggers and café ">". */
  function deriveDoorCol(building) {
    var bw = building.width * TILE;
    var bh = building.height * TILE;
    var door = facadeDoorMetrics(bw, bh);
    var worldCx = building.left * TILE + door.cx;
    return Math.round(worldCx / TILE);
  }

  function buildingDoorCol() {
    return deriveDoorCol(OUTSIDE_BUILDING);
  }

  /** Painted door panel in unscaled world pixels (building-local + map offset). */
  function facadeDoorWorldRect() {
    var b = OUTSIDE_BUILDING;
    var door = facadeDoorMetrics(b.width * TILE, b.height * TILE);
    var wx = b.left * TILE;
    var wy = b.top * TILE;
    var jamb = 2;
    return {
      left: wx + door.dx + jamb,
      top: wy + door.dy,
      right: wx + door.dx + door.dw - jamb,
      bottom: wy + door.dy + door.dh,
    };
  }

  function facadeDoorXBand() {
    var f = facadeDoorWorldRect();
    var doorCol = buildingDoorCol();
    var tileLeft = doorCol * TILE;
    var tileRight = tileLeft + TILE;
    return {
      left: Math.min(f.left, tileLeft + 1),
      right: Math.max(f.right, tileRight - 1),
    };
  }

  function facadeDoorXBandScaled() {
    var x = facadeDoorXBand();
    var s = SCALE;
    return { left: x.left * s, right: x.right * s };
  }

  function facadeDoorWorldRectScaled() {
    var f = facadeDoorWorldRect();
    var s = SCALE;
    return {
      left: f.left * s, top: f.top * s, right: f.right * s, bottom: f.bottom * s,
    };
  }

  /** Building collision cutout — façade door width, down through approach tiles. */
  function outsideDoorPassageRect() {
    var x = facadeDoorXBand();
    var b = OUTSIDE_BUILDING;
    var f = facadeDoorWorldRect();
    return {
      left: x.left,
      top: f.top,
      right: x.right,
      bottom: (b.doorRow + 2) * TILE,
    };
  }

  function spriteCenterYForFeetRow(row) {
    var u = TILE * SCALE;
    var feetY = row * u + u * 0.5;
    return feetY - (CHAR_H * SCALE * 0.5);
  }

  function doorTileCenterWorldX() {
    var doorCol = buildingDoorCol();
    return (doorCol * TILE + TILE / 2) * SCALE;
  }

  function getDoorAnchor() {
    var b = OUTSIDE_BUILDING;
    var doorCol = buildingDoorCol();
    var worldX = doorTileCenterWorldX();
    return {
      worldX: worldX,
      gridCol: doorCol,
      outsideRow: b.doorRow,
      outsideApproachRow: 11,
      insideExitRow: CAFE_EXIT_DOOR_ROW,
      insideEnterRow: CAFE_DOOR_ROW,
      passageRect: outsideDoorPassageRect(),
      outsideExitSpawnX: worldX,
      outsideExitSpawnY: spriteCenterYForFeetRow(b.doorRow),
      insideEnterSpawnY: spriteCenterYForFeetRow(CAFE_EXIT_DOOR_ROW),
    };
  }

  function outsideDoorPassageRectScaled() {
    var r = getDoorAnchor().passageRect;
    var s = SCALE;
    return { left: r.left * s, top: r.top * s, right: r.right * s, bottom: r.bottom * s };
  }

  function outsideDoorWorldX() {
    return getDoorAnchor().worldX;
  }

  function outsideDoorColumn() {
    return getDoorAnchor().gridCol;
  }

  function feetInDoorXBand(feetWorld, feetCol) {
    var band = facadeDoorXBandScaled();
    if (feetWorld.x >= band.left && feetWorld.x < band.right) return true;
    return feetCol === getDoorAnchor().gridCol;
  }

  function doorTriggerRows(mapKey, keys) {
    var anchor = getDoorAnchor();
    if (mapKey === 'outside') {
      var rows = [anchor.outsideRow];
      if (keys && keys.up) rows.push(anchor.outsideApproachRow);
      return rows;
    }
    if (mapKey === 'cafe') {
      return [anchor.insideExitRow, anchor.insideEnterRow];
    }
    return [];
  }

  /** Ground rows shown in debug — not the full wall cutout height. */
  function doorWalkBandRows(mapKey) {
    var anchor = getDoorAnchor();
    if (mapKey === 'outside') {
      return [anchor.outsideRow, anchor.outsideApproachRow];
    }
    if (mapKey === 'cafe') {
      return [anchor.insideEnterRow, anchor.insideExitRow];
    }
    return [];
  }

  function doorTriggerCells(mapKey, keys) {
    var col = getDoorAnchor().gridCol;
    return doorTriggerRows(mapKey, keys).map(function (row) {
      return { col: col, row: row };
    });
  }

  function doorTriggerCell(mapKey) {
    var cells = doorTriggerCells(mapKey, null);
    return cells.length ? cells[0] : null;
  }

  function feetGridCell(feetWorld) {
    var u = TILE * SCALE;
    return {
      col: Math.floor(feetWorld.x / u),
      row: Math.min(ROWS - 1, Math.max(0, Math.floor((feetWorld.y - 1) / u))),
    };
  }

  function playerOnDoorTrigger(feetCol, feetRow, mapKey, keys, feetWorld) {
    if (!feetWorld || !feetInDoorXBand(feetWorld, feetCol)) return false;
    var rows = doorTriggerRows(mapKey, keys);
    for (var i = 0; i < rows.length; i++) {
      if (feetRow === rows[i]) return true;
    }
    return false;
  }

  function intentFacingDoor(facing, keys, need) {
    if (!need) return true;
    if (facing === need) return true;
    if (!keys) return false;
    if (need === 'up' && (keys.up)) return true;
    if (need === 'down' && (keys.down)) return true;
    if (need === 'left' && (keys.left)) return true;
    if (need === 'right' && (keys.right)) return true;
    return false;
  }

  function canUseDoor(feetCol, feetRow, mapKey, facing, keys, doorFacing, feetWorld) {
    if (!playerOnDoorTrigger(feetCol, feetRow, mapKey, keys, feetWorld)) return false;
    return intentFacingDoor(facing, keys, doorFacing);
  }

  function resolveExitSpawn(mapConf, fallbackStart) {
    var anchor = getDoorAnchor();
    var spawn = Object.assign({}, mapConf.exitSpawn || fallbackStart);
    spawn.x = anchor.worldX;
    if (mapConf.exitTo === 'cafe') {
      spawn.feetRow = anchor.insideExitRow;
      spawn.facing = spawn.facing || 'up';
      delete spawn.y;
    } else if (mapConf.exitTo === 'outside') {
      spawn.feetRow = anchor.outsideRow;
      spawn.facing = spawn.facing || 'down';
      delete spawn.y;
    }
    return spawn;
  }

  function subtractRectFromCutout(rect, cut) {
    if (cut.right <= rect.left || cut.left >= rect.right || cut.bottom <= rect.top || cut.top >= rect.bottom) {
      return [rect];
    }
    var out = [];
    if (cut.top > rect.top) {
      out.push({ left: rect.left, top: rect.top, right: rect.right, bottom: cut.top });
    }
    if (cut.bottom < rect.bottom) {
      out.push({ left: rect.left, top: cut.bottom, right: rect.right, bottom: rect.bottom });
    }
    var midTop = Math.max(rect.top, cut.top);
    var midBottom = Math.min(rect.bottom, cut.bottom);
    if (midTop < midBottom) {
      if (cut.left > rect.left) {
        out.push({ left: rect.left, top: midTop, right: cut.left, bottom: midBottom });
      }
      if (cut.right < rect.right) {
        out.push({ left: cut.right, top: midTop, right: rect.right, bottom: midBottom });
      }
    }
    return out;
  }

  function tileSolidRectsAgainstPassage(rx, ry, passage) {
    var tile = {
      left: rx * TILE,
      top: ry * TILE,
      right: rx * TILE + TILE,
      bottom: ry * TILE + TILE,
    };
    return subtractRectFromCutout(tile, passage);
  }

  function rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function rowBandRectsScaled(rows) {
    var band = facadeDoorXBandScaled();
    var u = TILE * SCALE;
    return rows.map(function (row) {
      return { left: band.left, top: row * u, right: band.right, bottom: row * u + u };
    });
  }

  function triggerZoneRectsScaled(mapKey, keys) {
    return rowBandRectsScaled(doorTriggerRows(mapKey, keys));
  }

  function walkBandRectsScaled(mapKey) {
    return rowBandRectsScaled(doorWalkBandRows(mapKey));
  }

  function triggerCellRects(mapKey, keys) {
    return triggerZoneRectsScaled(mapKey, keys).map(function (r) {
      return {
        left: r.left / SCALE,
        top: r.top / SCALE,
        right: r.right / SCALE,
        bottom: r.bottom / SCALE,
      };
    });
  }

  function triggerCellRect(mapKey) {
    var cells = triggerCellRects(mapKey, null);
    return cells.length ? cells[0] : null;
  }

  function triggerCellRectScaled(mapKey, keys) {
    var rects = triggerZoneRectsScaled(mapKey, keys);
    return rects.length ? rects : null;
  }

  function validateDoorLink(cafeGrid) {
    var errors = [];
    var b = OUTSIDE_BUILDING;
    var doorCol = buildingDoorCol();
    var anchor = getDoorAnchor();
    var facade = facadeDoorWorldRect();
    var tileCx = doorCol * TILE + TILE / 2;
    var facadeCx = (facade.left + facade.right) / 2;
    if (Math.abs(tileCx - facadeCx) > TILE * 0.6) {
      errors.push('derived doorCol ' + doorCol + ' center drifts from painted door');
    }

    if (doorCol < b.left || doorCol >= b.left + b.width) {
      errors.push('derived doorCol ' + doorCol + ' outside building footprint');
    }
    if (b.doorRow < b.top || b.doorRow >= b.top + b.height) {
      errors.push('doorRow ' + b.doorRow + ' outside building footprint');
    }

    if (cafeGrid && cafeGrid[anchor.insideExitRow]) {
      var ch = cafeGrid[anchor.insideExitRow][anchor.gridCol];
      if (ch !== '>') {
        errors.push('café grid at col ' + anchor.gridCol + ' row ' + anchor.insideExitRow + ' is "' + ch + '", expected ">"');
      }
    }

    var passage = anchor.passageRect;
    var walkOutside = rowBandRectsScaled(doorWalkBandRows('outside'));
    walkOutside.forEach(function (band, i) {
      var unscaled = {
        left: band.left / SCALE,
        top: band.top / SCALE,
        right: band.right / SCALE,
        bottom: band.bottom / SCALE,
      };
      if (!rectsOverlap(passage, unscaled)) {
        errors.push('outside walk band ' + i + ' outside collision passage');
      }
    });

    if (errors.length) {
      console.error('[MoDoors] validateDoorLink failed:', errors.join('; '));
      return false;
    }
    return true;
  }

  var api = {
    TILE: TILE,
    SCALE: SCALE,
    OUTSIDE_BUILDING: OUTSIDE_BUILDING,
    CAFE_DOOR_ROW: CAFE_DOOR_ROW,
    CAFE_EXIT_DOOR_ROW: CAFE_EXIT_DOOR_ROW,
    facadeDoorMetrics: facadeDoorMetrics,
    deriveDoorCol: deriveDoorCol,
    doorTileCenterWorldX: doorTileCenterWorldX,
    facadeDoorWorldRect: facadeDoorWorldRect,
    facadeDoorWorldRectScaled: facadeDoorWorldRectScaled,
    facadeDoorXBandScaled: facadeDoorXBandScaled,
    outsideDoorPassageRect: outsideDoorPassageRect,
    outsideDoorPassageRectScaled: outsideDoorPassageRectScaled,
    getDoorAnchor: getDoorAnchor,
    outsideDoorWorldX: outsideDoorWorldX,
    outsideDoorColumn: outsideDoorColumn,
    doorTriggerRows: doorTriggerRows,
    doorWalkBandRows: doorWalkBandRows,
    walkBandRectsScaled: walkBandRectsScaled,
    triggerZoneRectsScaled: triggerZoneRectsScaled,
    doorTriggerCell: doorTriggerCell,
    triggerCellRect: triggerCellRect,
    triggerCellRectScaled: triggerCellRectScaled,
    feetGridCell: feetGridCell,
    playerOnDoorTrigger: playerOnDoorTrigger,
    intentFacingDoor: intentFacingDoor,
    canUseDoor: canUseDoor,
    resolveExitSpawn: resolveExitSpawn,
    tileSolidRectsAgainstPassage: tileSolidRectsAgainstPassage,
    spriteCenterYForFeetRow: spriteCenterYForFeetRow,
    validateDoorLink: validateDoorLink,
  };

  root.MoDoors = api;
})(typeof window !== 'undefined' ? window : globalThis);
