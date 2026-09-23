extends CanvasLayer
# Small arrow at the top of the screen. Points at the next place to go:
# elder → basket → café → home after a finished meal. Not a map.
# Stays up near a lookalike house. Fades only when the actual stop is in reach
# (Talk to the elder, Take the basket, Go inside the café / your cottage).

const INK := Color(0.96, 0.90, 0.78)
const OUTLINE := Color(0.08, 0.07, 0.05, 0.9)
const TOP := 22.0
const FADE_IN := 0.18
const FADE_OUT := 0.35

var _root: Node2D
var _parts: Array[Polygon2D] = []
var _wanted := false
var _fade: Tween


func _ready() -> void:
	layer = 16
	process_mode = Node.PROCESS_MODE_ALWAYS
	_root = Node2D.new()
	_root.modulate.a = 0.0
	add_child(_root)
	_add_arrow(OUTLINE, 1.25)
	_add_arrow(INK, 1.0)
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


func _poly(pts: PackedVector2Array, color: Color, scale_mul: float) -> Polygon2D:
	var p := Polygon2D.new()
	p.polygon = pts
	p.color = color
	p.scale = Vector2(scale_mul, scale_mul)
	_root.add_child(p)
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
	if GameState.has_item("learning_card"):
		return "dragons_brew"
	if _elder_met():
		return "card_basket"
	return "elder"


## True only when the focused person/door/item is this stop — not a nearby house.
func at_destination() -> bool:
	var id := current_id()
	if id == "":
		return false
	if id == "dish_cart":
		return _focus_id() == "dish_cart"
	if id != "elder" and id != "card_basket" and id != "dragons_brew" and id != "player_house":
		return _focus_id() == id
	if Interiors.inside() and Interiors.current != null:
		return Interiors.current.building_id == id
	return _focus_id() == id


func _process(_delta: float) -> void:
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
	var size := get_viewport().get_visible_rect().size
	var pos := Vector2(size.x * 0.5, TOP)
	var rot := player.global_position.direction_to(target).angle() + PI * 0.5
	for i in _parts.size():
		_parts[i].rotation = rot
		_parts[i].position = pos + (Vector2(0, 1) if i < 2 else Vector2.ZERO)
	_set_wanted(true)


func _set_wanted(on: bool) -> void:
	if on == _wanted:
		return
	_wanted = on
	if _fade != null:
		_fade.kill()
	if on:
		show()
		_fade = create_tween()
		_fade.tween_property(_root, "modulate:a", 1.0, FADE_IN)
	else:
		_fade = create_tween()
		_fade.tween_property(_root, "modulate:a", 0.0, FADE_OUT)
		_fade.tween_callback(hide)


func _player() -> Node2D:
	var root := WorldManager.world_root
	if root == null:
		return null
	return root.player as Node2D


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
