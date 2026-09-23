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
	var sprite := Sprite2D.new()
	sprite.name = "Pit"
	sprite.texture = PIT_TEX
	sprite.centered = false
	sprite.position = Vector2(-15, -26)
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	body.add_child(sprite)
	body.add_child(_feet(Vector2(22, 12), Vector2(0, -6)))
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
	var sprite := AnimatedSprite2D.new()
	sprite.name = "Flame"
	sprite.sprite_frames = frames
	sprite.centered = false
	sprite.position = Vector2(-16, -32)
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	sprite.play("burn")
	body.add_child(sprite)
	body.add_child(_feet(Vector2(24, 12), Vector2(0, -6)))
	return body


func _feet(size: Vector2, at: Vector2) -> CollisionShape2D:
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = size
	shape.shape = rect
	shape.position = at
	return shape
