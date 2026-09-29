extends Node2D
# Outdoor campfire behind the player's house. Nothing here is drawn indoors.
#
# Stage 1 is the pack's unlit stone ring. Stage 2 is the pack's animated
# campfire (32×32, eight frames) — the flame and the stones together.

const PIT_TEX := preload("res://assets/The Fan-tasy Tileset (Free)/Art/Props/Fireplace_1.png")
const FLAME_TEX := preload("res://assets/The Fan-tasy Tileset (Free)/Art/Props/Animation/Campfire.png")

var _visual: Node2D
var _shown := -1


func _ready() -> void:
	GameState.campfire_changed.connect(apply_stage)
	apply_stage()


func apply_stage() -> void:
	var stage := GameState.campfire_stage
	if stage == _shown:
		return
	_shown = stage
	if _visual != null:
		var old := _visual
		_visual = null
		old.free()
	if stage <= 0:
		return
	_visual = _pit() if stage == 1 else _flame()
	add_child(_visual)


func _pit() -> Node2D:
	var body := StaticBody2D.new()
	body.collision_layer = 1
	body.collision_mask = 0
	# Back of the ring. The picture sorts from here, so standing below it
	# draws you in front instead of leaving stones on your hair.
	var sort_y := -26.0
	body.position = Vector2(0, sort_y)
	var sprite := Sprite2D.new()
	sprite.name = "Pit"
	sprite.texture = PIT_TEX
	sprite.centered = false
	sprite.position = Vector2(-15, -26) - body.position
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	body.add_child(sprite)
	# The whole ring, including the middle. A short foot let you walk through the stones.
	body.add_child(_stones(Vector2(30, 26), Vector2(0, -13) - body.position))
	return body


## The sheet is one campfire, two tiles tall: flame on top, stones below.
func _flame() -> Node2D:
	var body := StaticBody2D.new()
	body.collision_layer = 1
	body.collision_mask = 0
	var frames := SpriteFrames.new()
	frames.add_animation("burn")
	frames.set_animation_speed("burn", 10.0)
	frames.set_animation_loop("burn", true)
	for i in 8:
		var atlas := AtlasTexture.new()
		atlas.atlas = FLAME_TEX
		atlas.region = Rect2(i * 32, 0, 32, 32)
		frames.add_frame("burn", atlas)
	# Back of the stones, under the flame. Same reason as the unlit ring.
	var sort_y := -18.0
	body.position = Vector2(0, sort_y)
	var sprite := AnimatedSprite2D.new()
	sprite.name = "Flame"
	sprite.sprite_frames = frames
	sprite.centered = false
	sprite.position = Vector2(-16, -32) - body.position
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	sprite.play("burn")
	body.add_child(sprite)
	# Stones only. The flame above the ring is not a wall.
	body.add_child(_stones(Vector2(30, 18), Vector2(0, -9) - body.position))
	return body


func _stones(size: Vector2, at: Vector2) -> CollisionShape2D:
	var shape := CollisionShape2D.new()
	shape.name = "SolidStones"
	var rect := RectangleShape2D.new()
	rect.size = size
	shape.shape = rect
	shape.position = at
	return shape
