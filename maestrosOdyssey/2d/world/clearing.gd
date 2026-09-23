class_name Clearing
extends Interior
const Shade := preload("res://world/shade_path.gd")
# One outdoor screen: a grass clearing closed in by trees and bushes.
# The village is hidden the same way a house hides it. The tree-gap mouth
# is how you leave and come back.

const BACKDROP := Color(0.07, 0.12, 0.06)

var _entry := Vector2i(9, 8)
var _exit: Array[Vector2i] = []


func build_clearing(id: String, spec: Dictionary) -> void:
	building_id = id
	var room_spec: Dictionary = spec.get("room", {})
	room = Vector2i(int(room_spec.get("x", 20)), int(room_spec.get("y", 14)))
	var entry: Dictionary = spec.get("entry", {})
	_entry = Vector2i(int(entry.get("x", 9)), int(entry.get("y", 8)))
	_exit = Shade.rect_cells(spec.get("exit", {}))

	y_sort_enabled = true
	var void_rect := ColorRect.new()
	void_rect.name = "Void"
	void_rect.color = BACKDROP
	void_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	void_rect.z_index = -100
	var span := (room + Vector2i(40, 40)) * TILE
	void_rect.position = Vector2(-span) * 0.5 + Vector2(room * TILE) * 0.5
	void_rect.size = Vector2(span)
	add_child(void_rect)

	_floor = TileMapLayer.new()
	_floor.name = "Floor"
	_floor.tile_set = Catalog.tileset("Tileset_Ground")
	_floor.z_index = -50
	add_child(_floor)
	var grass := Catalog.terrain_index("Tileset_Ground", "Grass")
	var cells: Array[Vector2i] = []
	for y in range(-FLOOR_BLEED, room.y + FLOOR_BLEED):
		for x in range(-FLOOR_BLEED, room.x + FLOOR_BLEED):
			cells.append(Vector2i(x, y))
	_floor.set_cells_terrain_connect(cells, 0, grass)
	# Whole clearing is the darker forest grass — not just a path strip.
	Shade.paint(_floor, cells)

	_objects = Node2D.new()
	_objects.name = "Objects"
	_objects.y_sort_enabled = true
	add_child(_objects)

	for entry_obj in spec.get("objects", []):
		_instance_interior_asset(entry_obj)

	var door := Marker2D.new()
	door.name = "Doorway"
	if not _exit.is_empty():
		door.position = Shade.center_of(_exit[0])
	_objects.add_child(door)

	_add_rim()


func entry_point() -> Vector2:
	return Shade.center_of(_entry)


func covers_exit(pos: Vector2) -> bool:
	return _exit.has(Shade.cell_of(pos))


func _add_rim() -> void:
	var body := StaticBody2D.new()
	body.name = "Bounds"
	body.collision_layer = 1
	body.collision_mask = 0
	add_child(body)
	var exit_set := {}
	for c in _exit:
		exit_set[c] = true
	for y in room.y:
		for x in room.x:
			if x != 0 and y != 0 and x != room.x - 1 and y != room.y - 1:
				continue
			var cell := Vector2i(x, y)
			if exit_set.has(cell):
				continue
			var shape := CollisionShape2D.new()
			var rect := RectangleShape2D.new()
			rect.size = Vector2(TILE, TILE)
			shape.shape = rect
			shape.position = Vector2(x * TILE, y * TILE) + Vector2(TILE, TILE) * 0.5
			body.add_child(shape)
