extends CanvasLayer
# Direction for the next stop. On the street, and for the way home, a compass
# arrow sits on the screen edge, then bounces on the place once you can see it.
# In the café, the next person gets a small mark over their head instead,
# so two people at one table don't share one arrow.

const INK := Color(0.96, 0.90, 0.78)
const OUTLINE := Color(0.08, 0.07, 0.05, 0.9)
const MARGIN := 28.0
const FADE_IN := 0.18
const FADE_OUT := 0.35
const FOLLOW := 10.0
const BOUNCE_SPEED := 7.0
const BOUNCE_PX := 5.0
const DOCK_GAP := 72.0
## The café door sits on the bottom edge of a small room. A big gap
## throws the home arrow into the floor. A short gap stays on the door.
const DOOR_DOCK := 28.0

var _arrow: Node2D
var _label: Label
var _mark: Node2D
var _parts: Array[Polygon2D] = []
var _wanted := false
var _fade: Tween
var _has_pos := false
var _draw_pos := Vector2.ZERO
var _draw_rot := 0.0
var _bob := 0.0
var _last_point := Vector2.DOWN
var _door_docked := false
var _aim_id := ""


func _ready() -> void:
	layer = 16
	process_mode = Node.PROCESS_MODE_ALWAYS
	_arrow = Node2D.new()
	_arrow.modulate.a = 0.0
	_arrow.scale = Vector2(1.35, 1.35)
	add_child(_arrow)
	_add_arrow(OUTLINE, 1.25)
	_add_arrow(INK, 1.0)
	_label = Label.new()
	_label.add_theme_font_size_override("font_size", 12)
	_label.add_theme_color_override("font_color", INK)
	_label.add_theme_color_override("font_outline_color", Color.BLACK)
	_label.add_theme_constant_override("outline_size", 4)
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label.modulate.a = 0.0
	add_child(_label)
	_mark = Node2D.new()
	_mark.modulate.a = 0.0
	_mark.visible = false
	add_child(_mark)
	_add_mark(OUTLINE, 1.35)
	_add_mark(INK, 1.0)
	hide()


func _add_arrow(color: Color, scale_mul: float) -> void:
	var shaft := _poly(
		PackedVector2Array([
			Vector2(-3, 6), Vector2(3, 6), Vector2(3, -2), Vector2(-3, -2),
		]),
		color, scale_mul)
	var head := _poly(
		PackedVector2Array([
			Vector2(0, -12), Vector2(8, 2), Vector2(-8, 2),
		]),
		color, scale_mul)
	_parts.append(shaft)
	_parts.append(head)


## A small downward mark. Used over the next person in the café,
## instead of the compass, so two people at one table don't share it.
func _add_mark(color: Color, scale_mul: float) -> void:
	var p := Polygon2D.new()
	p.polygon = PackedVector2Array([
		Vector2(0, 7), Vector2(7, -4), Vector2(-7, -4),
	])
	p.color = color
	p.scale = Vector2(scale_mul, scale_mul)
	_mark.add_child(p)


func _poly(pts: PackedVector2Array, color: Color, scale_mul: float) -> Polygon2D:
	var p := Polygon2D.new()
	p.polygon = pts
	p.color = color
	p.scale = Vector2(scale_mul, scale_mul)
	_arrow.add_child(p)
	return p


## elder → card basket → Dragon's Brew → dish cart → home (after the meal).
func current_id() -> String:
	if GameState.world.is_empty():
		return ""
	if CafeOrder.carrying_dishes:
		return "dish_cart"
	var table := CafeOrder.nav_target()
	if table != "":
		return table
	if GameState.day_index >= 8 and not ElderReport.done:
		return "elder"
	if GameState.cafe_meal_done:
		return "player_house"
	if GameState.wood_chore_open():
		return "forest_clearing"
	if GameState.has_item("learning_card"):
		return "dragons_brew"
	if elder_met():
		return "card_basket"
	return "elder"


func marker_name(id: String) -> String:
	match id:
		"elder":
			return "Elder"
		"card_basket":
			return "Basket"
		"dragons_brew":
			return "Café"
		"player_house":
			return "Home"
		"forest_clearing":
			return "Woods"
		"dish_cart":
			return "Dishes"
		"mara":
			return "Mara"
		_:
			var node := _entity(id)
			if node is Npc:
				var full := (node as Npc).display_name
				if full == "":
					return "Here"
				return full.split(" ")[0]
			return "Here"


## True only when the focused person/door/item is this stop — not a nearby house.
func at_destination() -> bool:
	var id := current_id()
	if id == "":
		return false
	if id == "forest_clearing":
		if not Interiors.inside() or Interiors.current == null:
			return false
		if Interiors.current.building_id != "forest_clearing":
			return false
		if Interiors.current.has_method("tree_standing") \
				and Interiors.current.tree_standing():
			var body := _player() as Player
			if body != null and Interiors.current.has_method("chop_ready") \
					and Interiors.current.chop_ready(body.global_position, body.facing):
				return true
			return false
		return true
	if id == "dish_cart":
		return _focus_id() == "dish_cart"
	if id != "elder" and id != "card_basket" and id != "dragons_brew" and id != "player_house":
		return _focus_id() == id
	if Interiors.inside() and Interiors.current != null:
		if Interiors.current.building_id == id:
			return true
		# At the café door on the way home. Fade here; it comes back outside.
		return _facing_exit()
	return _focus_id() == id


func elder_met() -> bool:
	return _elder_met()


func _process(delta: float) -> void:
	if Journal.is_open():
		_set_wanted(false)
		return
	var id := current_id()
	if id == "" or at_destination():
		_set_wanted(false)
		return
	var target := _target_pos(id)
	var player := _player()
	if target == Vector2.ZERO or player == null:
		_set_wanted(false)
		return
	var cam := _camera()
	if cam == null:
		_set_wanted(false)
		return
	var xform := cam.get_canvas_transform()
	var screen_target := xform * target
	var screen_player := xform * player.global_position
	var view := get_viewport().get_visible_rect().size
	_bob += delta
	if _over_person(id) and _in_view(screen_target, view, 12.0):
		var head := xform * (target + Vector2(0, -34))
		var bob := sin(_bob * BOUNCE_SPEED) * 4.0
		_arrow.visible = false
		_label.visible = false
		_mark.visible = true
		_mark.position = head + Vector2(0, bob)
		_set_wanted(true)
		return
	_arrow.visible = true
	_mark.visible = false
	_label.visible = true
	var point := screen_target - screen_player
	if point.length_squared() < 36.0:
		point = _last_point
	else:
		point = point.normalized()
		_last_point = point
	var exit_door := _pointing_outside()
	if _aim_id != id:
		_aim_id = id
		_door_docked = false
		_has_pos = false
	var on_screen := _in_view(screen_target, view, MARGIN)
	if exit_door:
		var inset := _edge_inset(screen_target, view)
		# Stay on the screen edge until the door is clearly in the room,
		# so the arrow does not flicker on and off the bottom of the café.
		if _door_docked:
			_door_docked = inset > 40.0
		else:
			_door_docked = inset > 78.0
		on_screen = _door_docked
	elif _over_person(id):
		# Off screen, point toward them. Do not bounce onto the person beside them.
		on_screen = false
	var gap := DOOR_DOCK if exit_door else DOCK_GAP
	var desired := screen_target - point * gap if on_screen \
		else _edge_point(view * 0.5, point, view, MARGIN)
	desired = _clear_tasks(desired)
	var desired_rot := point.angle() + PI * 0.5
	if not _has_pos:
		_draw_pos = desired
		_draw_rot = desired_rot
		_has_pos = true
	else:
		var t := 1.0 - exp(-FOLLOW * delta)
		_draw_pos = _draw_pos.lerp(desired, t)
		_draw_rot = lerp_angle(_draw_rot, desired_rot, t)
	var shown := _draw_pos
	if on_screen:
		shown -= point * sin(_bob * BOUNCE_SPEED) * BOUNCE_PX
	_arrow.position = shown
	_arrow.rotation = _draw_rot
	_label.text = marker_name(id)
	_label.reset_size()
	_label.position = _label_pos(shown, point, _label.size, view)
	_set_wanted(true)


## The next person to hear, while you are in the room with them.
func _over_person(id: String) -> bool:
	if not Interiors.inside() or Interiors.current == null:
		return false
	if id == "" or id == "dish_cart" or id == "dragons_brew" \
			or id == "player_house" or id == "elder" or id == "card_basket":
		return false
	var person := _entity(id)
	return person is Npc


## The next stop is not this room, so the arrow aims at the way out.
func _pointing_outside() -> bool:
	return (
		Interiors.inside()
		and Interiors.current != null
		and Interiors.current.building_id != current_id()
	)


func _facing_exit() -> bool:
	var p := _player() as Player
	if p == null or not (p.focus is Interactable):
		return false
	return (p.focus as Interactable).verb == "leave"


func _edge_inset(screen: Vector2, view: Vector2) -> float:
	return minf(minf(screen.x, view.x - screen.x), minf(screen.y, view.y - screen.y))


func _in_view(screen: Vector2, view: Vector2, margin: float) -> bool:
	return (
		screen.x > margin and screen.y > margin
		and screen.x < view.x - margin and screen.y < view.y - margin
	)


## Where a ray from `origin` along `dir` meets the inset screen.
func _edge_point(origin: Vector2, dir: Vector2, view: Vector2, margin: float) -> Vector2:
	var min_p := Vector2(margin, margin)
	var max_p := view - min_p
	var t := INF
	if absf(dir.x) > 0.001:
		var tx := (max_p.x - origin.x) / dir.x if dir.x > 0.0 else (min_p.x - origin.x) / dir.x
		if tx > 0.0:
			t = minf(t, tx)
	if absf(dir.y) > 0.001:
		var ty := (max_p.y - origin.y) / dir.y if dir.y > 0.0 else (min_p.y - origin.y) / dir.y
		if ty > 0.0:
			t = minf(t, ty)
	if t == INF:
		return origin.clamp(min_p, max_p)
	return (origin + dir * t).clamp(min_p, max_p)


## The name sits just past the blunt end, above that edge.
## If the point is already above the tail, the name stays on the tail side.
func _label_pos(arrow_pos: Vector2, point: Vector2, lab_size: Vector2, view: Vector2) -> Vector2:
	var tail := -point if point.length_squared() > 0.01 else Vector2.DOWN
	var blunt := arrow_pos + tail * 16.0
	var pos := Vector2(blunt.x - lab_size.x * 0.5, blunt.y - lab_size.y - 3.0)
	if point.y < -0.45:
		pos.y = blunt.y + 4.0
	pos = _clear_tasks(pos + lab_size * 0.5) - lab_size * 0.5
	var m := 4.0
	pos.x = clampf(pos.x, m, maxf(m, view.x - lab_size.x - m))
	pos.y = clampf(pos.y, m, maxf(m, view.y - lab_size.y - m))
	return pos


func _clear_tasks(pos: Vector2) -> Vector2:
	var box := TaskList.screen_rect().grow(8.0)
	if box.size == Vector2.ZERO or not box.has_point(pos):
		return pos
	return Vector2(box.position.x - 14.0, pos.y)


func _set_wanted(on: bool) -> void:
	if on == _wanted:
		return
	_wanted = on
	if _fade != null:
		_fade.kill()
	if on:
		show()
		_label.show()
		_fade = create_tween()
		_fade.tween_property(_arrow, "modulate:a", 1.0, FADE_IN)
		_fade.parallel().tween_property(_label, "modulate:a", 1.0, FADE_IN)
		_fade.parallel().tween_property(_mark, "modulate:a", 1.0, FADE_IN)
	else:
		_has_pos = false
		_fade = create_tween()
		_fade.tween_property(_arrow, "modulate:a", 0.0, FADE_OUT)
		_fade.parallel().tween_property(_label, "modulate:a", 0.0, FADE_OUT)
		_fade.parallel().tween_property(_mark, "modulate:a", 0.0, FADE_OUT)
		_fade.tween_callback(hide)


func _player() -> Node2D:
	var root := WorldManager.world_root
	if root == null:
		return null
	return root.player as Node2D


func _camera() -> Camera2D:
	var player := _player()
	if player == null:
		return null
	return player.get_node_or_null("Camera") as Camera2D


func _elder_met() -> bool:
	var root := WorldManager.world_root
	if root == null:
		return false
	var npc := root.entities.get("elder") as Npc
	return npc != null and npc.met


func _focus_id() -> String:
	var p := _player() as Player
	if p == null or p.focus == null:
		return ""
	if p.focus is Npc:
		return (p.focus as Npc).npc_id
	if p.focus is Interactable:
		var it := p.focus as Interactable
		if it.enters != "":
			return it.enters
		return str(it.data.get("id", ""))
	return ""


func _entity(id: String) -> Node2D:
	var root := WorldManager.world_root
	if root == null:
		return null
	var node := root.entities.get(id) as Node2D
	if node != null and is_instance_valid(node):
		return node
	return null


func _target_pos(id: String) -> Vector2:
	if id == "":
		return Vector2.ZERO
	if id == "forest_clearing":
		if Interiors.inside() and Interiors.current != null \
				and Interiors.current.building_id == "forest_clearing" \
				and Interiors.current.has_method("tree_standing") \
				and Interiors.current.tree_standing():
			var tree := Interiors.current.get_node_or_null("Objects/dead_tree") as Node2D
			if tree != null:
				return tree.global_position
		return Interiors.forest_mouth_position()
	if id != "dish_cart" and id != "dragons_brew" and id != "player_house" \
			and id != "elder" and id != "card_basket":
		var person := _entity(id)
		if person != null:
			return person.global_position
	if id == "dish_cart" and Interiors.inside() and Interiors.current != null \
			and Interiors.current.building_id == "dragons_brew":
		var cart := Interiors.current.get_node_or_null("Objects/dish_cart") as Node2D
		if cart != null:
			return cart.global_position
	if Interiors.inside() and Interiors.current != null \
			and Interiors.current.building_id != id:
		var door := Interiors.current.get_node_or_null("Objects/Doorway") as Node2D
		if door != null:
			return door.global_position
	var root := WorldManager.world_root
	if root == null:
		return Vector2.ZERO
	var node := root.entities.get(id) as Node2D
	if node != null and is_instance_valid(node):
		return node.global_position
	return Vector2.ZERO
