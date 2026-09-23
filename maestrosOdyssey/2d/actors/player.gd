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
## Idle sprite sits this far above the feet. Dropped a little while seated so
## the character reads as on the bench rather than standing in front of it.
const SPRITE_STAND := Vector2(0, -16)
const SPRITE_SIT := Vector2(0, -10)

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


func _ready() -> void:
	add_to_group("player")
	_sprite.sprite_frames = Sheet.player_frames()
	# The sheet's feet sit near the bottom of the 48x48 cell; lift the sprite so
	# the node origin is the feet (matches prop anchors and makes Y-sort work).
	_sprite.position = SPRITE_STAND
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
	else:
		velocity = velocity.move_toward(Vector2.ZERO, FRICTION * delta)
	move_and_slide()
	if not _attacking:
		_play("move" if input != Vector2.ZERO else "idle")
	_update_focus()


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
	if DialogueUI.close_key != key:
		return false
	DialogueUI.close()
	_after_panel_close()
	return true


func _after_panel_close() -> void:
	CafeOrder.on_speech_closed()
	if CafeOrder.open_box_on_close:
		CafeOrder.open_box_on_close = false
		DialogueUI.show_order_box()
	elif ElderReport.open_box_on_close:
		ElderReport.open_box_on_close = false
		DialogueUI.show_order_box(ElderReport.speaker_name())


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
	_stand_pos = global_position
	if host is PhysicsBody2D:
		add_collision_exception_with(host)
	collision_mask = 0
	global_position = host.global_position + Vector2(0, -4)
	velocity = Vector2.ZERO
	facing = Vector2.UP
	_sprite.position = SPRITE_SIT
	_play("idle")
	_sprite.frame = 0
	_sprite.pause()
	_place_held()


func stand_up(restore := true) -> void:
	if not seated:
		return
	seated = false
	collision_mask = _walk_mask
	_sprite.position = SPRITE_STAND
	if restore:
		global_position = _stand_pos
	velocity = Vector2.ZERO
	_play("idle")
	_place_held()


## Returns what happened, so a caller knows whether a model reply is still
## coming: "" (nothing/closed), "interactable", "sit", "give", or "talk". Only
## "talk" has a request in flight — the agent bridge used to await one
## unconditionally and sat through its whole timeout whenever an NPC simply
## took a gift.
func use_focus() -> String:
	# A second press closes an open panel rather than immediately re-triggering.
	# Order-box and speech-close must stay siblings: nesting the close under
	# is_ordering() made E a no-op on Mara's line, so the type box never opened.
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
	npc.attend(global_position)
	var gift := npc.accept_item()
	npc.met = true
	if npc.npc_id == "mara":
		var mara_line := CafeOrder.talk(npc)
		if mara_line != "":
			DialogueUI.show_line(npc.display_name, mara_line)
		return "talk"
	if npc.npc_id == "elder":
		var report := ElderReport.talk(npc)
		if report != "":
			DialogueUI.show_line(npc.display_name, report)
			return "talk"
	var phrase := CafePhrasesScript.line_for(npc.npc_id, GameState.day_index, ElderReport.needs_revisit)
	if phrase != "":
		npc.grant_if_any()
		CafeOrder.note_guest_spoke(npc.npc_id, phrase, true)
		DialogueUI.show_line(npc.display_name, phrase)
		return "talk"
	if npc.has_scripted() or GameState.offline_mode or not LLMClient.backend_available:
		if gift != "":
			DialogueUI.show_line(npc.display_name,
				"You hand over %s. They turn it over and over in their hands."
					% GameState.item_name(gift))
			return "give"
		npc.grant_if_any()
		var spoken := npc.next_scripted_line()
		CafeOrder.note_guest_spoke(npc.npc_id, spoken, false)
		DialogueUI.show_line(npc.display_name, spoken)
		return "talk"
	if gift != "":
		DialogueUI.show_thinking(npc.display_name)
		LLMClient.request_dialogue(npc.npc_id, "", gift)
		return "talk"
	DialogueUI.show_thinking(npc.display_name)
	LLMClient.request_dialogue(npc.npc_id, "")
	return "talk"


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
