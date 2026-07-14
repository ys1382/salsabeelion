/**
 * Maestro's Odyssey — café street door (grid-only transitions).
 *
 * Rules:
 * - One door column (derived from façade art); café ">" must match.
 * - Triggers: feet on door column + listed row only (no pixel bands).
 * - Spawns: { col, feetRow, facing } only — scene converts with sprite size.
 * - Façade math is for collision cutout + painted art, not enter/exit position.
 */
(function (root) {
  'use strict';

  var TILE = 32;
  var SCALE = 2;
  var ROWS = 16;

  var OUTSIDE_BUILDING = { left: 3, top: 4, width: 12, height: 7, doorRow: 10 };
  var CAFE_INSIDE_ROW = 10;
  var CAFE_EXIT_ROW = 11;
  var OUTSIDE_APPROACH_ROW = 11;

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

  /** Painted storefront sign board — façade-local px; must match drawStreetBuildingFacade. */
  function facadeSignMetrics(bw, bh) {
    var gap = 2;
    var awningH = 8;
    var winH = 58;
    var door = facadeDoorMetrics(bw, bh);
    var awningY = door.dy - gap - awningH;
    var winY = awningY - gap - winH;
    var sw = 80;
    var sh = 50;
    var sx = Math.floor(door.cx - sw / 2);
    var sy = winY - gap - sh;
    if (sy < 44) sy = 44;
    return { sx: sx, sy: sy, sw: sw, sh: sh };
  }

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

  function doorTileBandScaled() {
    var col = buildingDoorCol();
    var u = TILE * SCALE;
    return { left: col * u, right: (col + 1) * u };
  }

  function facadeDoorWorldRectScaled() {
    var f = facadeDoorWorldRect();
    var s = SCALE;
    return {
      left: f.left * s, top: f.top * s, right: f.right * s, bottom: f.bottom * s,
    };
  }

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

  function getDoorAnchor() {
    var b = OUTSIDE_BUILDING;
    var doorCol = buildingDoorCol();
    return {
      gridCol: doorCol,
      outsideRow: b.doorRow,
      outsideApproachRow: OUTSIDE_APPROACH_ROW,
      insideEnterRow: CAFE_INSIDE_ROW,
      insideExitRow: CAFE_EXIT_ROW,
      passageRect: outsideDoorPassageRect(),
    };
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

  function doorWalkBandRows(mapKey) {
    return doorTriggerRows(mapKey, { up: true, down: true, left: false, right: false });
  }

  function rowTileRectsScaled(rows) {
    var band = doorTileBandScaled();
    var u = TILE * SCALE;
    return rows.map(function (row) {
      return { left: band.left, top: row * u, right: band.right, bottom: row * u + u };
    });
  }

  function playerOnDoorTrigger(feetCol, feetRow, mapKey, keys) {
    if (feetCol !== getDoorAnchor().gridCol) return false;
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
    if (need === 'up' && keys.up) return true;
    if (need === 'down' && keys.down) return true;
    if (need === 'left' && keys.left) return true;
    if (need === 'right' && keys.right) return true;
    return false;
  }

  function canUseDoor(feetCol, feetRow, mapKey, facing, keys, doorFacing) {
    if (!playerOnDoorTrigger(feetCol, feetRow, mapKey, keys)) return false;
    return intentFacingDoor(facing, keys, doorFacing);
  }

  /** Grid-only spawn after a door transition — pass to scene _spawnPlayer. */
  function spawnForTransition(toMapKey) {
    var anchor = getDoorAnchor();
    if (toMapKey === 'cafe') {
      return { col: anchor.gridCol, feetRow: anchor.insideEnterRow, facing: 'up' };
    }
    if (toMapKey === 'outside') {
      return { col: anchor.gridCol, feetRow: anchor.outsideApproachRow, facing: 'down' };
    }
    return null;
  }

  function spritePosFromGrid(col, feetRow, displayHeight, originY) {
    var u = TILE * SCALE;
    var x = col * u + u * 0.5;
    var feetY = feetRow * u + u * 0.5;
    var footDrop = displayHeight * (1 - originY);
    return { x: x, y: feetY - footDrop };
  }

  function outsideDoorPassageRectScaled() {
    var r = getDoorAnchor().passageRect;
    var s = SCALE;
    return { left: r.left * s, top: r.top * s, right: r.right * s, bottom: r.bottom * s };
  }

  function outsideDoorWorldX() {
    var col = buildingDoorCol();
    return (col * TILE + TILE / 2) * SCALE;
  }

  function outsideDoorColumn() {
    return buildingDoorCol();
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

  function walkBandRectsScaled(mapKey) {
    return rowTileRectsScaled(doorWalkBandRows(mapKey));
  }

  function triggerZoneRectsScaled(mapKey, keys) {
    return rowTileRectsScaled(doorTriggerRows(mapKey, keys));
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
    if (cafeGrid && cafeGrid[anchor.insideExitRow]) {
      var ch = cafeGrid[anchor.insideExitRow][anchor.gridCol];
      if (ch !== '>') {
        errors.push('café grid at col ' + anchor.gridCol + ' row ' + anchor.insideExitRow + ' is "' + ch + '", expected ">"');
      }
    }
    var passage = anchor.passageRect;
    var walkOutside = rowTileRectsScaled(doorWalkBandRows('outside'));
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
    CAFE_DOOR_ROW: CAFE_INSIDE_ROW,
    CAFE_EXIT_DOOR_ROW: CAFE_EXIT_ROW,
    facadeDoorMetrics: facadeDoorMetrics,
    facadeSignMetrics: facadeSignMetrics,
    deriveDoorCol: deriveDoorCol,
    facadeDoorWorldRect: facadeDoorWorldRect,
    facadeDoorWorldRectScaled: facadeDoorWorldRectScaled,
    doorTileBandScaled: doorTileBandScaled,
    outsideDoorPassageRect: outsideDoorPassageRect,
    outsideDoorPassageRectScaled: outsideDoorPassageRectScaled,
    getDoorAnchor: getDoorAnchor,
    outsideDoorWorldX: outsideDoorWorldX,
    outsideDoorColumn: outsideDoorColumn,
    doorTriggerRows: doorTriggerRows,
    doorWalkBandRows: doorWalkBandRows,
    walkBandRectsScaled: walkBandRectsScaled,
    triggerZoneRectsScaled: triggerZoneRectsScaled,
    triggerCellRectScaled: triggerCellRectScaled,
    playerOnDoorTrigger: playerOnDoorTrigger,
    intentFacingDoor: intentFacingDoor,
    canUseDoor: canUseDoor,
    spawnForTransition: spawnForTransition,
    spritePosFromGrid: spritePosFromGrid,
    tileSolidRectsAgainstPassage: tileSolidRectsAgainstPassage,
    validateDoorLink: validateDoorLink,
  };

  root.MoDoors = api;
})(typeof window !== 'undefined' ? window : globalThis);
