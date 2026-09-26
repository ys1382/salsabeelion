class_name Npc
extends CharacterBody2D
# A villager placed by the world JSON. Carries its story data (persona, secret,
# knows_beats) so the dialogue layer can build a system prompt for it without
# looking anything up, and wanders gently if the world asked it to.

const SPEED := 18.0
const RUN_SPEED := 96.0
const WANDER_EVERY := 3.0
const WANDER_RADIUS := 40.0
## Cells east of the door-to-counter walk (x 6–8). A lap around the family table.
const TABLE_LAP := [
	Vector2i(11, 4), Vector2i(12, 4), Vector2i(12, 5), Vector2i(11, 5),
]
const LooksLib := preload("res://actors/looks.gd")

@onready var _sprite: AnimatedSprite2D = $Sprite

var data: Dictionary = {}
var npc_id: String = ""
var display_name: String = ""
## The canned opener covers the round trip to the model, but it is the same
## sentence every time. After the first hello it stops being a greeting and
## starts being a stuck record, so later visits get an ellipsis instead.
var met: bool = false
## Morning talk finished: her last scripted line was on screen, then that box closed.
var morning_done: bool = false
## Whether they have already been given what they were waiting for.
var _gave: bool = false
var _line_i: int = 0
var _granted: bool = false

var facing := Vector2.DOWN
var _home := Vector2.ZERO
var _heading := Vector2.ZERO
var _timer := 0.0
var _paused := 0.0
## Talk hold. Negative pause means "until the panel closes," not a timer.
var _talk_locked := false
var _facing_before := Vector2.DOWN
var _lap_i := 0
var _child := false


func setup(d: Dictionary) -> void:
	data = d
	npc_id = d["id"]
	display_name = d["name"]
	facing = _facing_from_data()


func _ready() -> void:
	add_to_group("npc")
	_child = str(data.get("look", "")) == "child"
	if _child:
		_sprite.sprite_frames = Sheet.player_frames()
		_sprite.scale = Vector2(0.62, 0.62)
	elif npc_id == "mara":
		_sprite.sprite_frames = Sheet.mara_frames()
	elif npc_id == "riverfolk_neighbor":
		_sprite.sprite_frames = Sheet.riverfolk_frames()
	else:
		_sprite.sprite_frames = Sheet.villager_frames()
	_sprite.position = Vector2(0, -16)
	LooksLib.apply_body_tint(_sprite, data)
	var look := str(data.get("look", ""))
	if look == "" and npc_id == "mara":
		look = "campire"
	LooksLib.attach(self, look)
	_home = position
	_timer = randf() * WANDER_EVERY
	if _child and GameState.child_settled:
		settle_beside_table()
		return
	_play("idle")


func _physics_process(delta: float) -> void:
	if str(data.get("movement", "")) == "table_run":
		_run_table(delta)
		return
	if data.get("movement", "idle") != "wander":
		return
	# A villager who strides off mid-conversation is maddening; zij3d had to add
	# the same courtesy pause after playtesting.
	if _paused < 0.0 or _paused > 0.0:
		if _paused > 0.0:
			_paused -= delta
		velocity = Vector2.ZERO
		_play("idle")
		return

	_timer -= delta
	if _timer <= 0.0:
		_timer = WANDER_EVERY
		if randf() < 0.4 or position.distance_to(_home) > WANDER_RADIUS:
			_heading = position.direction_to(_home) if position.distance_to(_home) > WANDER_RADIUS \
				else Vector2.ZERO
		else:
			_heading = Vector2.RIGHT.rotated(randf() * TAU)

	velocity = _heading * SPEED
	move_and_slide()
	if _heading != Vector2.ZERO:
		facing = _heading
	_play("move" if _heading != Vector2.ZERO else "idle")


## Run a lap around the family table. Stay off the middle walk.
func _run_table(_delta: float) -> void:
	if _paused < 0.0 or _paused > 0.0:
		if _paused > 0.0:
			_paused -= _delta
		velocity = Vector2.ZERO
		_play("idle")
		return
	var goal := Catalog.cell_to_anchor(TABLE_LAP[_lap_i])
	var to := goal - position
	if to.length() < 3.0:
		_lap_i = (_lap_i + 1) % TABLE_LAP.size()
		goal = Catalog.cell_to_anchor(TABLE_LAP[_lap_i])
		to = goal - position
	if to.length_squared() < 0.01:
		velocity = Vector2.ZERO
		_play("idle")
		return
	facing = to
	velocity = to.normalized() * RUN_SPEED
	move_and_slide()
	# Door-to-counter is cells 6–8. The lap starts at cell 9.
	var aisle_edge := 9 * Catalog.TILE + 2.0
	if position.x < aisle_edge:
		position.x = aisle_edge
		velocity.x = absf(velocity.x)
	_play("move")


func settle_beside_table() -> void:
	data["movement"] = "idle"
	position = Catalog.cell_to_anchor(Vector2i(11, 5))
	velocity = Vector2.ZERO
	facing = Vector2.UP
	_play("idle")
	if _heading != Vector2.ZERO:
		facing = _heading
	_play("move" if _heading != Vector2.ZERO else "idle")


func has_scripted() -> bool:
	var lines = data.get("scripted_lines", [])
	return typeof(lines) == TYPE_ARRAY and not lines.is_empty()


func next_scripted_line() -> String:
	var lines = data.get("scripted_lines", [])
	if typeof(lines) != TYPE_ARRAY or lines.is_empty():
		return str(data.get("opener", "..."))
	var i := mini(_line_i, lines.size() - 1)
	var line := str(lines[i])
	if _line_i < lines.size() - 1:
		_line_i += 1
	return line


## Every line still left in this talk, from the one they are due through the
## last. Later visits stick on that last line, so a one-line day can still close.
func scripted_pages() -> PackedStringArray:
	var lines = data.get("scripted_lines", [])
	var out := PackedStringArray()
	if typeof(lines) != TYPE_ARRAY or lines.is_empty():
		out.append(str(data.get("opener", "...")))
		return out
	var start := mini(_line_i, lines.size() - 1)
	for i in range(start, lines.size()):
		out.append(str(lines[i]))
	_line_i = lines.size() - 1
	return out


func grant_if_any() -> void:
	if _granted:
		return
	_granted = true
	var item := str(data.get("gives_item", ""))
	if item != "":
		GameState.take_item(item)
	var beat := str(data.get("reveal_beat", ""))
	if beat != "":
		GameState.reveal(beat)


## If this villager is waiting on something the player is now carrying, accept
## it and return the item id. Returns "" the rest of the time, and after the
## exchange has already happened.
func accept_item() -> String:
	var want: String = data.get("wants_item", "")
	if want == "" or _gave or not GameState.has_item(want):
		return ""
	_gave = true
	return want


## Idle pose from the world JSON (`up` / `down` / `left` / `right`). Missing
## or unknown values keep the default toward the camera.
func _facing_from_data() -> Vector2:
	match str(data.get("facing", "down")).to_lower():
		"up":
			return Vector2.UP
		"left":
			return Vector2.LEFT
		"right":
			return Vector2.RIGHT
		_:
			return Vector2.DOWN


## Called when the player starts talking: stop wandering and turn to face them.
## A bare attend still times out. A real conversation uses hold_talk instead.
func attend(to: Vector2, seconds: float = 8.0) -> void:
	if _talk_locked:
		hold_talk(to)
		return
	_paused = seconds
	_face_toward(to)
	_play("idle")


## Face the player and stay that way until release_talk. No timer.
func hold_talk(to: Vector2) -> void:
	if not _talk_locked:
		_facing_before = facing
		_talk_locked = true
	_paused = -1.0
	_heading = Vector2.ZERO
	_face_toward(to)
	_play("idle")


## Conversation over. Face the way they were, then wander may resume.
func release_talk() -> void:
	if not _talk_locked:
		return
	_talk_locked = false
	_paused = 0.0
	facing = _facing_before
	_play("idle")


func _face_toward(to: Vector2) -> void:
	var dir := global_position.direction_to(to)
	if dir.length_squared() < 0.0001:
		return
	# The up row is the back of the head, so it reads as looking away.
	# A talk uses the side face toward them instead.
	if dir.y < 0.0 and absf(dir.y) >= absf(dir.x):
		dir = Vector2(-1.0 if dir.x < 0.0 else 1.0, 0.0)
	facing = dir


func _play(state: String) -> void:
	var parts := Sheet.facing_suffix(facing)
	# Side row on this sheet already faces left. The shared helper flips
	# for a sheet that faces right, so undo that or they look the same way.
	var flip := bool(parts[1])
	# Villager side art faces left. The player sheet faces right.
	if parts[0] == "side" and not _child:
		flip = not flip
	_sprite.flip_h = flip
	LooksLib.face(self, flip)
	_sprite.play("%s_%s" % [state, parts[0]])
