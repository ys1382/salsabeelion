class_name Player
extends CharacterBody2D
# 8-way movement on a 4-directional sheet: the art has down/side/up rows only,
# so diagonals pick the dominant axis and left is the side row flipped.
#
# The collider is a small ellipse at the character's feet, not the whole 48x48
# cell — top-down games read correctly when only the feet collide, and it lets
# the player tuck under the overhanging parts of trees and roofs.

const CafePhrasesScript := preload("res://ui/cafe_phrases.gd")
const StreetSignScript := preload("res://world/street_sign.gd")
const SACK_TEX := preload("res://assets/The Fan-tasy Tileset (Free)/Art/Props/Sack_3.png")
const SPEED := 70.0
const ACCEL := 900.0
const FRICTION := 1100.0
## Villagers live on this layer. Furniture and walls stay on the environment
## layer. People are never turned off — you slide around them.
const NPC_LAYER := 8
## A tap only bumps. Holding longer than this starts the sideways slide.
const PERSON_BUMP_S := 0.30

const MAX_HP := 5
## After a hit you are untouchable for this long, and flash. Without it a slime
## sitting on top of you drains the whole bar in well under a second and the
## player never learns what hit them.
const INVULN_S := 1.2
## Reach of a swing, and how wide a cone counts as "in front of me". The dot
## product against `facing` is what stops a swing from hitting something behind.
const ATTACK_REACH := 26.0
const ATTACK_CONE := 0.35
const ATTACK_DAMAGE := 1
## Long enough to read the death animation before the world snaps back.
const RESPAWN_S := 1.6
## Idle sprite sits this far above the feet. There is no sit pose on the sheet,
## so a seat uses the same upright stand.
const SPRITE_STAND := Vector2(0, -16)

signal interact_pressed
signal health_changed(current: int, maximum: int)
signal died

@onready var _sprite: AnimatedSprite2D = $Sprite
@onready var _reach: Area2D = $InteractArea

var facing := Vector2.DOWN
var hp: int = MAX_HP
## Where to put the player back after a defeat. Set by the WorldBuilder, which
## is the only thing that knows the world's player_start.
var spawn_point := Vector2.ZERO

var _attacking := false
var _invuln := 0.0
var _dead := false
## Set by the agent bridge to drive the player without keyboard input; zero
## means "use the real input". Public so test/agent_bridge.gd can steer.
var agent_input := Vector2.ZERO
var focus: Node = null
var seated := false
var _stand_pos := Vector2.ZERO
var _walk_mask := 1
var _held: Sprite2D
var _seat: Node2D = null
var _seat_z := 0
var _push_dir := Vector2.ZERO
var _push_held := 0.0
## Which way we are sliding off the person we bumped. Zero until the hold
## is long enough. Collision stays on the whole time.
var _step_side := Vector2.ZERO
## Person we are mid-conversation with. Null for signs, doors, and the menu.
var _talk_with: Npc = null
## Boxes left in this talk. Empty for a single beat (Mara, a one-line day,
## the day-8 report). T advances until the last box, which is the only close.
var _pages: PackedStringArray = PackedStringArray()
var _page := 0
## Sit pose could not show this facing. Applied if we stand while the panel is open.
var _face_on_stand := Vector2.ZERO


func _ready() -> void:
	add_to_group("player")
	_sprite.sprite_frames = Sheet.player_frames()
	# The sheet's feet sit near the bottom of the 48x48 cell; lift the sprite so
	# the node origin is the feet (matches prop anchors and makes Y-sort work).
	_sprite.position = SPRITE_STAND
	collision_mask |= NPC_LAYER
	_walk_mask = collision_mask
	_sprite.animation_finished.connect(_on_anim_finished)
	_held = Sprite2D.new()
	_held.name = "Held"
	_held.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_held.z_index = 2
	_held.hide()
	add_child(_held)
	CafeOrder.order_ready.connect(_on_order_ready)
	CafeOrder.order_cleared.connect(_refresh_held)
	GameState.carry_changed.connect(_refresh_held)
	Interiors.entered.connect(func(_id): _refresh_held())
	Interiors.left.connect(_refresh_held)
	_play("idle")


func _physics_process(delta: float) -> void:
	if _invuln > 0.0:
		_invuln -= delta
		# Flash while it lasts, then make sure the sprite ends up fully opaque —
		# an odd number of frames would otherwise leave it stuck half-faded.
		_sprite.modulate.a = 0.35 if int(_invuln * 12.0) % 2 == 0 else 1.0
		if _invuln <= 0.0:
			_sprite.modulate.a = 1.0
	if _dead:
		velocity = Vector2.ZERO
		move_and_slide()
		return

	var input := agent_input if agent_input != Vector2.ZERO \
		else Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if DialogueUI.is_ordering():
		velocity = Vector2.ZERO
		move_and_slide()
		_play("idle")
		return
	if _talking():
		velocity = Vector2.ZERO
		move_and_slide()
		if not seated:
			_play("idle")
		else:
			_place_held()
		_update_focus()
		return
	if seated:
		# Stay seated unless S. D is sip (and walk-right when standing);
		# walking must not stand or sit you.
		velocity = Vector2.ZERO
		move_and_slide()
		_place_held()
		_update_focus()
		return
	if _attacking:
		input = Vector2.ZERO
	if input != Vector2.ZERO:
		velocity = velocity.move_toward(input.normalized() * SPEED, ACCEL * delta)
		facing = input
		_steer_past_person(input)
	else:
		velocity = velocity.move_toward(Vector2.ZERO, FRICTION * delta)
	var before := global_position
	move_and_slide()
	_update_person_bump(delta, input, before)
	if not _attacking:
		_play("move" if input != Vector2.ZERO else "idle")
	_update_focus()


## People stop you. Hold the same way and you slide off to the open side,
## still bumping them. You never overlap their body. Furniture does not do this.
func _steer_past_person(input: Vector2) -> void:
	if _step_side == Vector2.ZERO or _push_held < PERSON_BUMP_S:
		return
	var dir := _held_axis(input)
	var forward := 0.0
	if not _shoulder_blocked(dir, _step_side):
		forward = SPEED * 0.9
	velocity = _step_side * SPEED * 1.35 + dir * forward


func _update_person_bump(delta: float, input: Vector2, before: Vector2) -> void:
	if seated:
		return
	if input == Vector2.ZERO:
		_clear_bump()
		return
	var dir := _held_axis(input)
	if dir != _push_dir:
		_push_dir = dir
		_push_held = 0.0
		_step_side = Vector2.ZERO
	var moved := global_position.distance_to(before)
	if _pushing_into_person(dir, moved):
		_push_held += delta
		if _push_held >= PERSON_BUMP_S and _step_side == Vector2.ZERO:
			_step_side = _clearer_side(dir)
	elif _step_side == Vector2.ZERO:
		_push_held = 0.0
	elif not _still_beside(dir):
		_clear_bump()
	if _step_side != Vector2.ZERO and _env_blocked(global_position + _step_side * 14.0):
		var other := -_step_side
		if not _env_blocked(global_position + other * 14.0):
			_step_side = other


func _clear_bump() -> void:
	_push_dir = Vector2.ZERO
	_push_held = 0.0
	_step_side = Vector2.ZERO


func _pushing_into_person(dir: Vector2, moved: float) -> bool:
	if _blocked_by_person():
		return true
	return moved < 0.45 and _person_ahead(dir)


func _blocked_by_person() -> bool:
	for i in get_slide_collision_count():
		if get_slide_collision(i).get_collider() is Npc:
			return true
	return false


func _person_ahead(dir: Vector2) -> bool:
	for n in get_tree().get_nodes_in_group("npc"):
		var npc := n as Node2D
		if npc == null or not is_instance_valid(npc):
			continue
		var to := npc.global_position - global_position
		var along := to.dot(dir)
		if along < 2.0 or along > 20.0:
			continue
		if (to - dir * along).length() <= 14.0:
			return true
	return false


## Still on their shoulder. Used so the slide keeps going until you are past,
## instead of turning back into their front.
func _still_beside(dir: Vector2) -> bool:
	var side_axis := Vector2(-dir.y, dir.x)
	for n in get_tree().get_nodes_in_group("npc"):
		var npc := n as Node2D
		if npc == null or not is_instance_valid(npc):
			continue
		var to := npc.global_position - global_position
		var along := to.dot(dir)
		if along > -14.0 and along < 20.0 and absf(to.dot(side_axis)) < 22.0:
			return true
	return false


## Someone is still in the way of stepping forward on this side, so we only
## slide along the row until the end of it opens.
func _shoulder_blocked(dir: Vector2, side: Vector2) -> bool:
	for n in get_tree().get_nodes_in_group("npc"):
		var npc := n as Node2D
		if npc == null or not is_instance_valid(npc):
			continue
		var to := npc.global_position - global_position
		var along := to.dot(dir)
		var lateral := to.dot(side)
		if along > -4.0 and along < 18.0 and lateral > -8.0 and lateral < 16.0:
			return true
	return false


func _clearer_side(dir: Vector2) -> Vector2:
	var left := Vector2(-dir.y, dir.x)
	var right := -left
	var left_wall := _env_blocked(global_position + left * 16.0)
	var right_wall := _env_blocked(global_position + right * 16.0)
	if left_wall and not right_wall:
		return right
	if right_wall and not left_wall:
		return left
	if _people_on_side(dir, left) <= _people_on_side(dir, right):
		return left
	return right


func _people_on_side(dir: Vector2, side: Vector2) -> int:
	var n := 0
	for body in get_tree().get_nodes_in_group("npc"):
		var npc := body as Node2D
		if npc == null or not is_instance_valid(npc):
			continue
		var to := npc.global_position - global_position
		var along := to.dot(dir)
		var lateral := to.dot(side)
		if along > -12.0 and along < 28.0 and lateral > 4.0 and lateral < 48.0:
			n += 1
	return n


func _env_blocked(at: Vector2) -> bool:
	var space := get_world_2d().direct_space_state
	var shape := CircleShape2D.new()
	shape.radius = 6.0
	var q := PhysicsShapeQueryParameters2D.new()
	q.shape = shape
	q.transform = Transform2D(0.0, at)
	q.collision_mask = 1
	q.collide_with_areas = false
	q.exclude = [get_rid()]
	return not space.intersect_shape(q, 1).is_empty()


func _held_axis(input: Vector2) -> Vector2:
	if absf(input.x) >= absf(input.y):
		return Vector2(signf(input.x), 0.0)
	return Vector2(0.0, signf(input.y))


# --- interaction -------------------------------------------------------------

## Nearest thing in reach wins, so standing between a bench and a villager
## doesn't flicker between prompts.
##
## People break ties. Only a tie: an earlier "NPCs always beat scenery" rule
## meant a single villager wandering past a chest made the chest impossible to
## open, which is worse than the problem it fixed. The actual fix was capping
## interactable reach boxes (see Interactable.MAX_REACH_TILES); distances are
## comparable again, so nearest genuinely wins.
func _update_focus() -> void:
	var best: Node = null
	var best_score := INF
	for area in _reach.get_overlapping_areas():
		if area is Interactable:
			# Outdoor place names are already painted on the sign.
			if StreetSignScript.caption_for(str((area as Interactable).data.get("id", ""))) != "":
				continue
			var d := global_position.distance_squared_to((area as Node2D).global_position)
			# Prefer the drink menu / house rules over the exit when both are
			# in reach — otherwise Leave steals the prompt and R does nothing.
			d += _focus_bias(area as Interactable)
			if d < best_score:
				best_score = d
				best = area
	for body in _reach.get_overlapping_bodies():
		if body is Npc:
			var d := global_position.distance_squared_to((body as Node2D).global_position)
			if d <= best_score:   # <= so a person wins an exact tie
				best_score = d
				best = body
	focus = best

	if DialogueUI.is_open():
		return
	if seated:
		var bits: PackedStringArray = []
		if CafeOrder.cup_left > 0:
			bits.append("D — Sip")
		if CafeOrder.muffin_left > 0:
			bits.append("F — Eat")
		bits.append("S — Stand")
		DialogueUI.show_prompt("   ".join(bits))
		return
	if focus is Interactable:
		var it := focus as Interactable
		DialogueUI.show_prompt("%s — %s" % [_prompt_key(it), it.prompt()])
	elif focus is Npc:
		DialogueUI.show_prompt("T — Talk to %s" % (focus as Npc).display_name)
	elif _chop_prompt():
		DialogueUI.show_prompt("J — Chop")
	elif _pick_prompt():
		DialogueUI.show_prompt("P — Pick")
	else:
		DialogueUI.hide_prompt()


## Leave is a big reach box by the door. Nudge it so wall boards win nearby.
func _focus_bias(it: Interactable) -> float:
	if it.verb == "leave":
		return 900.0
	if _prompt_key(it) == "R":
		return -120.0
	return 0.0


func _unhandled_input(event: InputEvent) -> void:
	if DialogueUI.is_ordering():
		if event.is_action_pressed("ui_cancel"):
			DialogueUI.close()
			_end_talk_face()
			get_viewport().set_input_as_handled()
		return
	if _key_down(event, KEY_P):
		if try_pick():
			get_viewport().set_input_as_handled()
		return
	if seated and event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_D or event.physical_keycode == KEY_D:
			if try_sip():
				get_viewport().set_input_as_handled()
				return
		if event.keycode == KEY_F or event.physical_keycode == KEY_F:
			if try_bite():
				get_viewport().set_input_as_handled()
				return
		if _key_down(event, KEY_S) and not DialogueUI.is_open():
			stand_up()
			get_viewport().set_input_as_handled()
			return
	if _key_down(event, KEY_T):
		if _try_close("T"):
			get_viewport().set_input_as_handled()
			return
		if not DialogueUI.is_open() and focus is Npc:
			_talk_npc(focus as Npc)
			get_viewport().set_input_as_handled()
		return
	if _key_down(event, KEY_R):
		# A person with lines left is not a sign. R must not dismiss them.
		if _more_lines():
			get_viewport().set_input_as_handled()
			return
		# Menu / house-rules: R always reads when you are at the board, even if
		# a door line or other panel is still open (order box stays alone).
		if focus is Interactable and _prompt_key(focus as Interactable) == "R":
			if DialogueUI.is_ordering():
				return
			if DialogueUI.is_open():
				if DialogueUI.close_key == "R" and DialogueUI.is_sign_open():
					DialogueUI.close()
					_after_panel_close()
					get_viewport().set_input_as_handled()
					return
				DialogueUI.close()
				_after_panel_close()
			_use_prop(focus as Interactable)
			get_viewport().set_input_as_handled()
			return
		if _try_close("R"):
			get_viewport().set_input_as_handled()
		return
	if _key_down(event, KEY_S) and not seated and not DialogueUI.is_open() \
			and focus is Interactable and _prompt_key(focus as Interactable) == "S":
		var host := (focus as Interactable).get_parent() as Node2D
		if host != null:
			sit_on(host)
		get_viewport().set_input_as_handled()
		return
	if event.is_action_pressed("interact"):
		interact_pressed.emit()
		if _more_lines():
			get_viewport().set_input_as_handled()
			return
		if _try_close("E"):
			get_viewport().set_input_as_handled()
			return
		if DialogueUI.is_open() or seated:
			return
		if focus is Interactable and _prompt_key(focus as Interactable) == "E":
			_use_prop(focus as Interactable)
			get_viewport().set_input_as_handled()
	elif event.is_action_pressed("attack"):
		swing()


func _key_down(event: InputEvent, key: Key) -> bool:
	return event is InputEventKey and event.pressed and not event.echo \
		and (event.keycode == key or event.physical_keycode == key)


## T talks. R is only the drink menu and the house-rules board. S sits.
## E is doors, plus the basket, the dish cart, and the looks left on E.
func _prompt_key(it: Interactable) -> String:
	var id := str(it.data.get("id", ""))
	if id == "drink_menu" or id == "house_board":
		return "R"
	if it.verb == "sit" and it.enters == "" and it.gives == "":
		return "S"
	return "E"


func _try_close(key: String) -> bool:
	if DialogueUI.is_ordering() or not DialogueUI.is_open():
		return false
	# Middle boxes advance. That is not a close: no heard mark beyond the
	# line now showing, no callout timer, and they keep facing each other.
	if _more_lines():
		if key != "T":
			return false
		_advance_page()
		return true
	if DialogueUI.close_key != key:
		return false
	_clear_pages()
	DialogueUI.close()
	_after_panel_close()
	return true


func _after_panel_close() -> void:
	_mark_elder_morning()
	_clear_pages()
	CafeOrder.on_speech_closed()
	if CafeOrder.open_box_on_close:
		CafeOrder.open_box_on_close = false
		DialogueUI.show_order_box()
	elif ElderReport.open_box_on_close:
		ElderReport.open_box_on_close = false
		DialogueUI.show_order_box(ElderReport.speaker_name())
	if not DialogueUI.is_open():
		_end_talk_face()


# --- combat -------------------------------------------------------------------

func swing() -> void:
	if _attacking or _dead:
		return
	_attacking = true
	_play("attack")
	_strike()


## Hits every enemy in a cone in front of the player. Deliberately a one-shot
## geometric query rather than a hitbox Area2D: the swing lasts four frames, so
## an area would have to be enabled and disabled in step with the animation, and
## whether a hit registers would depend on frame timing. This always resolves.
func _strike() -> void:
	var dir := facing.normalized()
	for enemy in get_tree().get_nodes_in_group("enemy"):
		var e := enemy as Node2D
		if e == null or not is_instance_valid(e):
			continue
		var to := e.global_position - global_position
		if to.length() > ATTACK_REACH or dir.dot(to.normalized()) < ATTACK_CONE:
			continue
		if e.has_method("take_damage"):
			e.take_damage(ATTACK_DAMAGE, dir)
	var place := Interiors.current
	if place != null and place.has_method("try_chop"):
		place.try_chop(global_position, facing)


func take_damage(amount: int) -> void:
	if _dead or _invuln > 0.0 or amount <= 0:
		return
	hp = maxi(0, hp - amount)
	_invuln = INVULN_S
	health_changed.emit(hp, MAX_HP)
	if hp == 0:
		_die()


func _die() -> void:
	_dead = true
	_attacking = false
	died.emit()
	_sprite.play("death")
	await get_tree().create_timer(RESPAWN_S).timeout
	if not is_instance_valid(self):
		return
	# Respawn rather than end the run. This is a mystery for children: losing
	# the story you have pieced together because a slime cornered you would be
	# a punishment out of all proportion, so beats are untouched.
	stand_up(false)
	global_position = spawn_point
	hp = MAX_HP
	_dead = false
	_invuln = INVULN_S
	_sprite.modulate.a = 1.0
	health_changed.emit(hp, MAX_HP)
	_play("idle")


func sit_on(host: Node2D) -> void:
	if seated or host == null or not is_instance_valid(host):
		return
	seated = true
	_clear_bump()
	_stand_pos = global_position
	_seat = host
	if host is PhysicsBody2D:
		add_collision_exception_with(host)
	collision_mask = 0
	global_position = _seat_gap(host)
	_draw_seat_behind()
	velocity = Vector2.ZERO
	_sprite.position = SPRITE_STAND
	_play("idle")
	_sprite.frame = 0
	_sprite.pause()
	_place_held()


func stand_up(restore := true) -> void:
	if not seated:
		return
	seated = false
	_clear_bump()
	collision_mask = _walk_mask
	_sprite.position = SPRITE_STAND
	if _seat != null and is_instance_valid(_seat):
		if _seat is PhysicsBody2D:
			remove_collision_exception_with(_seat)
		if _seat is CanvasItem:
			(_seat as CanvasItem).z_index = _seat_z
	if restore:
		global_position = _stand_pos
		_stand_clear_of_seat()
	_seat = null
	velocity = Vector2.ZERO
	if _face_on_stand != Vector2.ZERO and _talking():
		facing = _face_on_stand
	_face_on_stand = Vector2.ZERO
	_play("idle")
	_place_held()


## Midway on the floor between the chair picture and the nearest table.
## The chair is drawn behind for this sit, so it does not cover the head.
func _seat_gap(host: Node2D) -> Vector2:
	var table := _nearest_table(host)
	if table == null:
		facing = Vector2.UP
		return host.global_position + Vector2(0, 8)
	var chair_r := _prop_rect(host)
	var table_r := _prop_rect(table)
	var on_chair := _closest_on_rect(chair_r, table_r.get_center())
	var on_table := _closest_on_rect(table_r, chair_r.get_center())
	var mid := (on_chair + on_table) * 0.5
	var toward := table_r.get_center() - mid
	facing = Vector2.UP if toward.length_squared() < 1.0 else toward.normalized()
	return mid


## While you are in the gap the chair's feet may be closer to the camera.
## Drop its draw order so the upright sprite stays in front of it.
func _draw_seat_behind() -> void:
	if _seat is CanvasItem:
		_seat_z = (_seat as CanvasItem).z_index
		(_seat as CanvasItem).z_index = -2


func _nearest_table(host: Node2D) -> Node2D:
	var parent := host.get_parent()
	if parent == null:
		return null
	var best: Node2D = null
	var best_d := INF
	for child in parent.get_children():
		if child == host or not (child is Node2D):
			continue
		if not str(child.name).to_lower().contains("table"):
			continue
		var d := host.global_position.distance_squared_to((child as Node2D).global_position)
		if d < best_d:
			best_d = d
			best = child as Node2D
	return best


func _closest_on_rect(rect: Rect2, point: Vector2) -> Vector2:
	if rect.size == Vector2.ZERO:
		return point
	return Vector2(
		clampf(point.x, rect.position.x, rect.end.x),
		clampf(point.y, rect.position.y, rect.end.y))


func _prop_rect(prop: Node2D) -> Rect2:
	var spr := prop.get_node_or_null("Sprite") as Sprite2D
	if spr == null or spr.texture == null:
		return Rect2()
	return Rect2(prop.global_position + spr.position, spr.texture.get_size())


## Back on the side you came from, south of the chair's feet when that was the
## approach. Otherwise the chair's box shoves you north and the chair draws
## over your head.
func _stand_clear_of_seat() -> void:
	if _seat == null or not is_instance_valid(_seat):
		return
	var away := _stand_pos - _seat.global_position
	if away.length_squared() < 1.0:
		away = Vector2.DOWN
	var pos := _seat.global_position + away.normalized() * 14.0
	if pos.y < _seat.global_position.y + 10.0:
		pos.y = _seat.global_position.y + 10.0
	global_position = pos


## Returns what happened, so a caller knows whether a model reply is still
## coming: "" (nothing/closed), "interactable", "sit", "give", or "talk". Only
## "talk" has a request in flight — the agent bridge used to await one
## unconditionally and sat through its whole timeout whenever an NPC simply
## took a gift.
func use_focus() -> String:
	# A second press closes an open panel rather than immediately re-triggering.
	# Order-box and speech-close must stay siblings: nesting the close under
	# is_ordering() made E a no-op on Mara's line, so the type box never opened.
	if _more_lines():
		return ""
	if DialogueUI.is_ordering():
		return ""
	if DialogueUI.is_open():
		DialogueUI.close()
		_after_panel_close()
		return ""
	if seated:
		stand_up()
		return ""
	if focus is Interactable:
		var it := focus as Interactable
		if it.verb == "sit" and it.enters == "" and it.gives == "":
			var host := it.get_parent() as Node2D
			if host != null:
				sit_on(host)
			return "sit"
		return _use_prop(it)
	if focus is Npc:
		return _talk_npc(focus as Npc)
	return ""


func _use_prop(it: Interactable) -> String:
	var line := it.use()
	_refresh_held()
	# Entering a building and leaving one both return "" — the change of
	# scene IS the response, and an empty panel over it would just be in
	# the way.
	if line != "":
		var id := str(it.data.get("id", ""))
		# Wall boards use the full paper close-up — the bottom chat strip
		# clipped the drink menu so it looked blank.
		if id == "house_board" or id == "drink_menu":
			DialogueUI.show_sign(line)
		else:
			DialogueUI.show_line("", line)
			DialogueUI.set_close_key("E")
	return "interactable"


func _talk_npc(npc: Npc) -> String:
	var gift := npc.accept_item()
	npc.met = true
	_clear_pages()
	if npc.npc_id == "mara":
		var mara_pages := CafeOrder.talk_pages(npc)
		if mara_pages.size() > 1:
			_open_pages(npc, mara_pages)
		elif mara_pages.size() == 1:
			_begin_talk_face(npc)
			DialogueUI.show_line(npc.display_name, mara_pages[0])
		return "talk"
	if npc.npc_id == "elder":
		var report := ElderReport.talk(npc)
		if report != "":
			_begin_talk_face(npc)
			DialogueUI.show_line(npc.display_name, report)
			return "talk"
	var phrase := CafePhrasesScript.line_for(npc.npc_id, GameState.day_index, ElderReport.needs_revisit)
	if phrase != "":
		npc.grant_if_any()
		CafeOrder.note_guest_spoke(npc.npc_id, phrase, true)
		_begin_talk_face(npc)
		DialogueUI.show_line(npc.display_name, phrase)
		return "talk"
	if npc.has_scripted() or GameState.offline_mode or not LLMClient.backend_available:
		if gift != "":
			_begin_talk_face(npc)
			DialogueUI.show_line(npc.display_name,
				"You hand over %s. They turn it over and over in their hands."
					% GameState.item_name(gift))
			return "give"
		npc.grant_if_any()
		_open_pages(npc, npc.scripted_pages())
		return "talk"
	if gift != "":
		_begin_talk_face(npc)
		DialogueUI.show_thinking(npc.display_name)
		LLMClient.request_dialogue(npc.npc_id, "", gift)
		return "talk"
	_begin_talk_face(npc)
	DialogueUI.show_thinking(npc.display_name)
	LLMClient.request_dialogue(npc.npc_id, "")
	return "talk"


func _more_lines() -> bool:
	return _pages.size() > 1 and _page < _pages.size() - 1


func _clear_pages() -> void:
	_pages = PackedStringArray()
	_page = 0


## Show the current box. A middle line is not a close, so the guest is not
## marked heard unless this text is already their last line for the visit.
func _open_pages(npc: Npc, lines: PackedStringArray) -> void:
	_pages = lines
	_page = 0
	_show_page(npc)


func _show_page(npc: Npc) -> void:
	if _pages.is_empty():
		return
	var line := _pages[_page]
	CafeOrder.note_guest_spoke(npc.npc_id, line, false)
	_begin_talk_face(npc)
	DialogueUI.show_line(npc.display_name, line, _more_lines())


func _advance_page() -> void:
	if not _more_lines() or _talk_with == null or not is_instance_valid(_talk_with):
		return
	_page += 1
	_show_page(_talk_with)


func _talking() -> bool:
	return _talk_with != null and is_instance_valid(_talk_with) \
		and DialogueUI.is_open() and not DialogueUI.is_sign_open()


## Turn toward them. Feet stay put. A sit pose only turns when that idle row exists.
func _begin_talk_face(npc: Npc) -> void:
	_talk_with = npc
	var feet := global_position
	var spr := _sprite.position
	npc.hold_talk(feet)
	var to := feet.direction_to(npc.global_position)
	if to.length_squared() < 0.0001:
		return
	if seated and not _sit_shows(to):
		_face_on_stand = to
		return
	_face_on_stand = Vector2.ZERO
	facing = to
	_play("idle")
	global_position = feet
	_sprite.position = spr
	if seated:
		_sprite.frame = 0
		_sprite.pause()


func _sit_shows(to: Vector2) -> bool:
	var parts: Array = Sheet.facing_suffix(to)
	if _sprite.sprite_frames == null:
		return false
	return _sprite.sprite_frames.has_animation("idle_%s" % parts[0])


## The arrow waits for this close. A middle box never gets here.
## Day-8 report lines are not her morning script, so they do not count.
func _mark_elder_morning() -> void:
	if _talk_with == null or not is_instance_valid(_talk_with):
		return
	if _talk_with.npc_id != "elder" or _talk_with.morning_done:
		return
	var lines = _talk_with.data.get("scripted_lines", [])
	if typeof(lines) != TYPE_ARRAY or lines.is_empty():
		return
	if DialogueUI.body() != str(lines[lines.size() - 1]):
		return
	_talk_with.morning_done = true


func _end_talk_face() -> void:
	_face_on_stand = Vector2.ZERO
	if _talk_with != null and is_instance_valid(_talk_with):
		_talk_with.release_talk()
	_talk_with = null


func _on_anim_finished() -> void:
	if _sprite.animation.begins_with("attack"):
		_attacking = false


func _on_order_ready(_lemmas: PackedStringArray) -> void:
	_refresh_held()


func try_sip() -> bool:
	if not seated or DialogueUI.is_open() or DialogueUI.is_ordering():
		return false
	if not CafeOrder.sip():
		return false
	_refresh_held()
	return true


func try_bite() -> bool:
	if not seated or DialogueUI.is_open() or DialogueUI.is_ordering():
		return false
	if not CafeOrder.bite():
		return false
	_refresh_held()
	return true


func _chop_prompt() -> bool:
	var place := Interiors.current
	if place == null or not place.has_method("chop_ready"):
		return false
	return place.chop_ready(global_position, facing)


func _pick_prompt() -> bool:
	var place := Interiors.current
	if place == null or not place.has_method("berry_ready"):
		return false
	return place.berry_ready(global_position, facing)


func try_pick() -> bool:
	if DialogueUI.is_open() or DialogueUI.is_ordering() or seated:
		return false
	var place := Interiors.current
	if place == null or not place.has_method("try_pick_berries"):
		return false
	var ok: bool = place.try_pick_berries(global_position, facing)
	if ok:
		_refresh_held()
	return ok


func _refresh_held() -> void:
	if _held == null:
		return
	# The cup and plate stay as they are. The sack never replaces them.
	if CafeOrder.still_holding():
		_held.texture = CafeOrder.texture_for()
		_held.show()
		_place_held()
		return
	# Axe while the dead tree is still up. After it falls, the sack shows.
	if _axe_out():
		_held.texture = _axe_texture()
		_held.show()
		_place_held()
		return
	if GameState.carrying_sack() and not _in_cafe():
		_held.texture = SACK_TEX
		_held.show()
		_place_held()
		return
	_hide_held()


func _in_cafe() -> bool:
	return (
		Interiors.inside()
		and Interiors.current != null
		and Interiors.current.building_id == "dragons_brew"
	)


func _axe_out() -> bool:
	if not GameState.forest_morning():
		return false
	var place := Interiors.current
	if place == null or not place.has_method("tree_standing"):
		return false
	return place.tree_standing()


func _axe_texture() -> Texture2D:
	var img := Image.create(16, 16, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var handle := Color(0.55, 0.34, 0.16)
	var grip := Color(0.40, 0.24, 0.12)
	var blade := Color(0.78, 0.80, 0.84)
	var edge := Color(0.55, 0.58, 0.62)
	for y in range(5, 15):
		img.set_pixel(7, y, handle)
		img.set_pixel(8, y, grip)
	for x in range(4, 13):
		img.set_pixel(x, 3, blade)
		img.set_pixel(x, 4, blade)
		img.set_pixel(x, 5, edge)
	img.set_pixel(3, 4, blade)
	img.set_pixel(13, 4, edge)
	return ImageTexture.create_from_image(img)


func _hide_held() -> void:
	if _held != null:
		_held.hide()
		_held.texture = null


func _place_held() -> void:
	if _held == null or not _held.visible:
		return
	var left := facing.x < -0.3
	var up := facing.y < -0.3
	_held.flip_h = left
	if seated:
		_held.position = Vector2(-4 if left else 4, 2)
		_held.z_index = 2
		return
	if up:
		_held.position = Vector2(6, -14)
		_held.z_index = -1
	else:
		_held.position = Vector2(-7 if left else 7, -8)
		_held.z_index = 2


func _play(state: String) -> void:
	if _dead:
		return
	var parts := Sheet.facing_suffix(facing)
	_sprite.flip_h = parts[1]
	var anim := "%s_%s" % [state, parts[0]]
	if _sprite.animation != anim or not _sprite.is_playing():
		_sprite.play(anim)
	_place_held()
