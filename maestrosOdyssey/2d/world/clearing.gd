class_name Clearing
extends Interior
const Shade := preload("res://world/shade_path.gd")
# One outdoor screen: a grass clearing closed in by trees and bushes.
# The village is hidden the same way a house hides it. The tree-gap mouth
# is how you leave and come back.

const BACKDROP := Color(0.07, 0.12, 0.06)
## Grass and trees continue past the walkable rim so the woods don't stop
## at a hard edge. The camera may look into this band; you cannot walk it.
const WOODS_PAD := 5
const GRASS_BLEED := 6
const CHOPS_TO_FELL := 4
const CHOP_REACH := 52.0
const STUMP_ASSET := "prop.chopped_tree_1"

var _entry := Vector2i(9, 8)
var _exit: Array[Vector2i] = []
var _dead: Node2D
var _chops := 0
var _felled := false


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
	for y in range(-GRASS_BLEED, room.y + GRASS_BLEED):
		for x in range(-GRASS_BLEED, room.x + GRASS_BLEED):
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
	_apply_dead_tree()
	_add_outer_woods()

	var door := Marker2D.new()
	door.name = "Doorway"
	if not _exit.is_empty():
		door.position = Shade.center_of(_exit[0])
	_objects.add_child(door)

	_add_rim()


func camera_pad() -> int:
	return WOODS_PAD * TILE


func entry_point() -> Vector2:
	return Shade.center_of(_entry)


## Face away from the exit strip and into the woods.
func arrival_facing() -> Vector2:
	if _exit.is_empty():
		return Vector2.LEFT
	var acc := Vector2.ZERO
	for c in _exit:
		acc += Vector2(c)
	var into := Vector2(_entry) - acc / float(_exit.size())
	if into.length_squared() < 0.25:
		into = Vector2(room) * 0.5 - Vector2(_entry)
	if absf(into.x) >= absf(into.y):
		return Vector2.RIGHT if into.x > 0.0 else Vector2.LEFT
	return Vector2.DOWN if into.y > 0.0 else Vector2.UP


func tree_standing() -> bool:
	return not _felled and _dead != null and is_instance_valid(_dead)


func chop_ready(from: Vector2, facing: Vector2) -> bool:
	if not tree_standing():
		return false
	var to := _dead.global_position - from
	if to.length() > CHOP_REACH:
		return false
	if to.length() < 1.0:
		return true
	return facing.normalized().dot(to.normalized()) >= 0.35


## The player's normal swing. The tree stays whole until the last hit,
## then it is the existing stump. No half-cut shape.
func try_chop(from: Vector2, facing: Vector2) -> bool:
	if not chop_ready(from, facing):
		return false
	_chops += 1
	if _chops < CHOPS_TO_FELL:
		_flash(_dead)
		return true
	var tree := _dead
	_swap_stump(tree)
	GameState.note_wood_cut()
	DialogueUI.show_line("", "The dead tree comes down. You take the wood.")
	return true


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


func _apply_dead_tree() -> void:
	var tree := _objects.get_node_or_null("dead_tree") as Node2D
	if tree == null:
		return
	if GameState.wood_cut_today():
		_swap_stump(tree)
		return
	_dead = tree
	_felled = false
	_chops = 0
	_brown_needles(tree)


func _swap_stump(tree: Node2D) -> void:
	if tree == null or not is_instance_valid(tree):
		_felled = true
		_dead = null
		return
	var pos := tree.position
	tree.name = "felled_tree"
	tree.queue_free()
	var stump: Node2D = load(Catalog.object(STUMP_ASSET)["scene"]).instantiate()
	stump.name = "stump"
	stump.position = pos
	stump.y_sort_enabled = false
	_objects.add_child(stump)
	_dead = null
	_felled = true


## Same tree picture. Needles that were green become dead brown. The trunk
## is already brown, so those pixels stay.
func _brown_needles(node: Node2D) -> void:
	var sprite := node.get_node_or_null("Sprite") as Sprite2D
	if sprite == null or sprite.texture == null:
		return
	var img := sprite.texture.get_image()
	if img == null:
		return
	img = img.duplicate()
	if img.is_compressed():
		img.decompress()
	for y in img.get_height():
		for x in img.get_width():
			var c := img.get_pixel(x, y)
			if c.a < 0.08:
				continue
			if c.g <= c.r + 0.04 or c.g <= c.b:
				continue
			var shade := c.g
			img.set_pixel(x, y, Color(shade * 0.62, shade * 0.36, shade * 0.14, c.a))
	var tex := ImageTexture.create_from_image(img)
	sprite.texture = tex
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST


func _flash(node: Node2D) -> void:
	var sprite := node.get_node_or_null("Sprite") as CanvasItem
	if sprite == null:
		return
	sprite.modulate = Color(1.55, 1.3, 1.05)
	var tw := create_tween()
	tw.tween_property(sprite, "modulate", Color.WHITE, 0.12)


## A second ring, outside the walkable edge, so you see more woods
## when you walk up to the rim.
func _add_outer_woods() -> void:
	var n := 0
	var gap := _village_gap()
	var bushes := ["tree.bush_emerald_5", "tree.bush_emerald_6", "tree.bush_emerald_7"]
	for x in range(-1, room.x + 1, 2):
		_place_outer(bushes[n % bushes.size()], x, -1, n)
		n += 1
		_place_outer(bushes[n % bushes.size()], x, room.y, n)
		n += 1
	for y in range(1, room.y, 3):
		_place_outer(bushes[n % bushes.size()], -1, y, n)
		n += 1
		if not _in_gap(y, gap):
			_place_outer(bushes[n % bushes.size()], room.x, y, n)
			n += 1
	var trees := ["tree.tree_emerald_1", "tree.tree_emerald_2"]
	for x in range(-2, room.x + 2, 6):
		_place_outer(trees[n % trees.size()], x, -5, n)
		n += 1
		_place_outer(trees[n % trees.size()], x, room.y + 1, n)
		n += 1
	for y in range(0, room.y, 6):
		_place_outer(trees[n % trees.size()], -5, y, n)
		n += 1
		if not _in_gap(y, gap):
			_place_outer(trees[n % trees.size()], room.x + 1, y, n)
			n += 1


## East edge that faces the village. Outer trees stay off that mouth.
func _village_gap() -> Vector2i:
	var y0 := room.y
	var y1 := -1
	for c in _exit:
		if c.x < room.x - 3:
			continue
		y0 = mini(y0, c.y)
		y1 = maxi(y1, c.y)
	return Vector2i(y0, y1)


func _in_gap(y: int, gap: Vector2i) -> bool:
	return gap.y >= 0 and y >= gap.x - 1 and y <= gap.y + 1


func _place_outer(asset: String, x: int, y: int, n: int) -> void:
	_instance_interior_asset({
		"id": "outer_%d" % n,
		"asset": asset,
		"x": x,
		"y": y,
	})
