class_name ShadePath
extends RefCounted
# A walkable ribbon of the same grass, tinted darker. Not a dirt road.


static func cell_of(pos: Vector2) -> Vector2i:
	return Vector2i(
		int(pos.x / float(Catalog.TILE)),
		int(pos.y / float(Catalog.TILE)))


static func center_of(cell: Vector2i) -> Vector2:
	return Vector2(
		cell.x * Catalog.TILE + Catalog.TILE * 0.5,
		cell.y * Catalog.TILE + Catalog.TILE * 0.5)


## Same raster as WorldBuilder._path_cells / worldgen._path_cells.
static func polyline_cells(path: Dictionary, size: Vector2i) -> Array[Vector2i]:
	var seen := {}
	var out: Array[Vector2i] = []
	var pts: Array = path.get("points", [])
	var half: int = int(path.get("width", 1)) / 2
	for i in range(pts.size() - 1):
		var a: Dictionary = pts[i]
		var b: Dictionary = pts[i + 1]
		var steps: int = maxi(absi(int(b["x"]) - int(a["x"])),
			absi(int(b["y"]) - int(a["y"])))
		steps = maxi(steps, 1)
		for s in range(steps + 1):
			var t := float(s) / float(steps)
			var cx := int(round(lerpf(float(a["x"]), float(b["x"]), t)))
			var cy := int(round(lerpf(float(a["y"]), float(b["y"]), t)))
			for dy in range(-half, half + 1):
				for dx in range(-half, half + 1):
					var c := Vector2i(cx + dx, cy + dy)
					if c.x >= 0 and c.y >= 0 and c.x < size.x and c.y < size.y \
							and not seen.has(c):
						seen[c] = true
						out.append(c)
	return out


static func mouth_cells(path: Dictionary, size: Vector2i) -> Array[Vector2i]:
	var mouth: Dictionary = path.get("mouth", {})
	var out: Array[Vector2i] = []
	# A w/h mouth is the gap between the border trees. Otherwise the west
	# column of the shaded path is the step that takes you in.
	if mouth.has("w") or mouth.has("h"):
		for c in rect_cells(mouth):
			if c.x >= 0 and c.y >= 0 and c.x < size.x and c.y < size.y:
				out.append(c)
		return out
	var mouth_x := int(mouth.get("x", -999))
	for c in polyline_cells(path, size):
		if c.x == mouth_x:
			out.append(c)
	return out


static func rect_cells(rect: Dictionary) -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	var x0 := int(rect.get("x", 0))
	var y0 := int(rect.get("y", 0))
	var w := int(rect.get("w", 1))
	var h := int(rect.get("h", 1))
	for y in range(y0, y0 + h):
		for x in range(x0, x0 + w):
			out.append(Vector2i(x, y))
	return out


static func paint(ground: TileMapLayer, cells: Array) -> void:
	if cells.is_empty() or ground == null:
		return
	var layer := TileMapLayer.new()
	layer.name = "Shade"
	layer.tile_set = ground.tile_set
	# Same grass tiles, drawn again a little darker. A flat colour would hide
	# the blades.
	layer.modulate = Color(0.55, 0.68, 0.5)
	for c in cells:
		var cell: Vector2i = c
		var src := ground.get_cell_source_id(cell)
		if src < 0:
			continue
		layer.set_cell(
			cell, src,
			ground.get_cell_atlas_coords(cell),
			ground.get_cell_alternative_tile(cell))
	ground.add_child(layer)
