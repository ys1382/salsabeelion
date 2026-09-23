extends Node
# Autoload. Owns going inside a building and coming back out.
#
# The outdoor world is hidden and frozen rather than torn down, so the village is
# exactly as you left it when you step back out — villagers mid-wander, slimes
# where they were, nothing re-rolled. Rebuilding would also invalidate every
# node reference anything else is holding, which is the hazard WorldManager
# exists to guard against.

signal entered(building_id: String)
signal left()

var current: Interior = null

var _outside_pos := Vector2.ZERO
var _player: Player = null


func inside() -> bool:
	return current != null


## `flavour` is the door interactable's text, shown once the player is actually
## in the room — over the doorstep it would just be a panel in the way.
func enter(building_id: String, flavour: String = "") -> void:
	if inside():
		return
	var root := WorldManager.world_root
	if root == null:
		return
	var host := root.entities.get(building_id) as Node2D
	var p := root.player as Player
	if host == null or p == null:
		push_warning("cannot enter '%s': no such building" % building_id)
		return

	var asset := ""
	for entry in root.world.get("objects", []):
		if entry["id"] == building_id:
			asset = entry["asset"]
			break
	var footprint := Catalog.footprint(asset) if asset != "" else Vector2i(6, 6)

	_player = p
	if p.seated:
		p.stand_up(false)
	_outside_pos = p.global_position

	current = Interior.new()
	current.name = "Interior_%s" % building_id
	add_child(current)
	var spec := {}
	var interiors = root.world.get("interiors", {})
	if typeof(interiors) == TYPE_DICTIONARY:
		spec = interiors.get(building_id, {})
		if typeof(spec) != TYPE_DICTIONARY:
			spec = {}
	current.build(building_id, footprint,
		str(root.world.get("seed", root.world.get("title", ""))), spec)
	current.exit_requested.connect(leave)
	_spawn_tuesday_table(building_id, current)
	_spawn_inside_npcs(building_id, current)

	root.visible = false
	root.process_mode = Node.PROCESS_MODE_DISABLED

	p.reparent(current.get_node("Objects"), false)
	p.position = current.entry_point()
	# The room already sorts by feet. Leaving this on sorts the picture by the
	# head, so a table draws across the face.
	p.y_sort_enabled = false
	p.velocity = Vector2.ZERO
	p.agent_input = Vector2.ZERO
	_clamp_camera(p, current.pixel_size())

	entered.emit(building_id)
	# Wait a frame so the E that opened the door cannot also close the card.
	if building_id == "player_house" and CafeOrder.try_night_pass():
		call_deferred("_show_night_pass")
	elif flavour != "":
		DialogueUI.show_line("", flavour)
		DialogueUI.set_close_key("E")


func _show_night_pass() -> void:
	Journal.show_night_pass()


func leave() -> void:
	if not inside():
		return
	# Do not move the doorway. If the meal's dishes are still in hand, or Mara
	# is waiting on the Spanish goodbye, stay in the room and let her say so.
	if current.building_id == "dragons_brew" and not CafeOrder.may_leave():
		DialogueUI.show_line("Mara", CafeOrder.leave_blocked_line())
		return
	var root := WorldManager.world_root
	var p := _player
	current.exit_requested.disconnect(leave)

	if root != null and p != null and is_instance_valid(p):
		if p.seated:
			p.stand_up(false)
		root.visible = true
		root.process_mode = Node.PROCESS_MODE_INHERIT
		p.y_sort_enabled = true
		p.reparent(root.get_node("Objects"), false)
		# Back on the doorstep, not inside the wall. The saved position is where
		# they were standing when they pressed E, which is by definition a legal
		# tile they walked to.
		p.global_position = _outside_pos
		p.velocity = Vector2.ZERO
		p.agent_input = Vector2.ZERO
		if current != null and current.building_id == "dragons_brew":
			CafeOrder.leave_cafe()
		_clamp_camera(p, root.pixel_size())
		if current != null:
			for n in root.world.get("npcs", []):
				if str(n.get("inside", "")) == current.building_id:
					root.entities.erase(n["id"])

	current.queue_free()
	current = null
	_player = null
	DialogueUI.close()
	left.emit()


## Tuesday's extra table stays on the left. The middle walk from the door
## to the counter stays open every day.
func _spawn_tuesday_table(building_id: String, interior: Interior) -> void:
	if building_id != "dragons_brew" or GameState.weekday != "Tuesday":
		return
	interior._instance_interior_asset({
		"id": "cafe_tuesday_table",
		"asset": "prop.table_medium_1",
		"x": 2,
		"y": 7,
	})


func _spawn_inside_npcs(building_id: String, interior: Interior) -> void:
	var objects := interior.get_node_or_null("Objects") as Node2D
	var root := WorldManager.world_root
	if objects == null or root == null:
		return
	for n in root.world.get("npcs", []):
		if str(n.get("inside", "")) != building_id:
			continue
		if not _here_today(n):
			continue
		var npc: Npc = preload("res://actors/npc.tscn").instantiate()
		npc.setup(n)
		npc.name = n["id"]
		var ix := int(n.get("inside_x", interior.room.x / 2))
		var iy := int(n.get("inside_y", maxi(interior.room.y / 2, 2)))
		npc.position = Catalog.cell_to_anchor(Vector2i(ix, iy))
		npc.y_sort_enabled = false
		objects.add_child(npc)
		root.entities[n["id"]] = npc


## Empty weekdays means every day. Otherwise they only stand in the room
## on a listed weekday (Tuesday's table, and again the next Tuesday).
func _here_today(n: Dictionary) -> bool:
	var days = n.get("weekdays", [])
	if typeof(days) != TYPE_ARRAY or days.is_empty():
		return true
	for day in days:
		if str(day) == GameState.weekday:
			return true
	return false


func _clamp_camera(p: Player, px: Vector2i) -> void:
	var cam := p.get_node_or_null("Camera") as Camera2D
	if cam == null:
		return
	cam.limit_left = 0
	cam.limit_top = 0
	cam.limit_right = px.x
	cam.limit_bottom = px.y
	# The camera smooths towards its target; without this the first frame inside
	# is a pan across the whole room from wherever it was standing outdoors.
	cam.reset_smoothing()
