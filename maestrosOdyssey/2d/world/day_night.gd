extends Node
# Outdoor day / night look for the village street.
#
# Day stays bright. Night cools and dims the ground, trees, and houses; lamp
# posts cast a soft warm pool; house windows and doorways glow from indoors.
# Richer glass (sun, moon, stars) waits until after animation upgrades.
#
# Night falls while you are inside Dragon's Brew, so the street is night when
# you step out. Morning (night pass at home) fades the street back to day.
#
# Crickets are the only ambience. They start when you step out into that
# night, stay on for the walk home and the campfire, and ease off indoors
# or when morning returns. The café stay itself stays quiet.

## 0 = full day, 1 = full night.
var amount := 0.0
## True after a café visit starts night, until morning resets the street.
var _want_night := false

const DAY := Color(1, 1, 1, 1)
## Cool, dim outdoor cast — grass, dirt, trees, house walls.
const NIGHT := Color(0.48, 0.52, 0.72, 1)

const FADE_IN_CAFE_S := 10.0
const FADE_TO_DAY_S := 2.2
## The recording is very quiet. This brings it up to a normal
## listening level, so a low computer volume is enough.
const CRICKET_DB := 16.0
const CRICKET_SILENT_DB := -80.0
## Quieter while Mara is speaking, so the line stays clear. Not silence.
const CRICKET_DUCK_DB := -2.0
const CRICKETS := preload("res://audio/crickets_night.mp3")

## Dark window rectangles in texture pixels (top-left of the house PNG).
const WINDOWS := {
	"building.house_hay_1": [
		Rect2(15, 70, 10, 6),
		Rect2(61, 70, 10, 6),
	],
	"building.house_hay_2": [
		Rect2(12, 59, 10, 6),
		Rect2(84, 91, 10, 6),
		Rect2(130, 91, 10, 6),
	],
}

## Soft doorway warmth — texture-space centers near the door planks.
const DOORS := {
	"building.house_hay_1": [Vector2(44, 82)],
	"building.house_hay_2": [Vector2(28, 70), Vector2(107, 104)],
}

var _tween: Tween
var _cricket_tween: Tween
var _crickets: AudioStreamPlayer
## True only while a Mara clip is playing. Never starts the night loop by itself.
var _voice_duck := false
var _fx: Node2D
var _layers: Array[CanvasItem] = []
var _soft: Texture2D
var _window_tex: Texture2D


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_soft = _make_soft_circle(96, Color(1.0, 0.72, 0.35, 1.0))
	_window_tex = _make_window_glow(14, 10)
	Interiors.entered.connect(_on_entered)
	Interiors.left.connect(_on_left)
	_ensure_crickets()


## Call after every WorldBuilder.build() so FX and layer refs stay live.
func attach(builder: WorldBuilder) -> void:
	_clear_fx()
	_layers.clear()
	if builder == null:
		return
	for name in ["Ground", "Water", "Road", "Objects"]:
		var n := builder.get_node_or_null(name) as CanvasItem
		if n != null:
			_layers.append(n)
	_fx = Node2D.new()
	_fx.name = "NightFx"
	_fx.z_index = 20
	builder.add_child(_fx)
	_place_house_glows(builder)
	_place_lamp_pools(builder)
	_apply(amount)


func begin_night(duration: float = FADE_IN_CAFE_S) -> void:
	_want_night = true
	_tween_to(1.0, duration)
	_sync_crickets()


## Street must read as night the moment you leave the café (instant — the fade
## already happened while the outdoor world was hidden).
func ensure_night() -> void:
	_want_night = true
	if _tween != null:
		_tween.kill()
		_tween = null
	amount = 1.0
	_apply(1.0)
	_sync_crickets()


func begin_day(duration: float = FADE_TO_DAY_S) -> void:
	_want_night = false
	_tween_to(0.0, duration)
	_sync_crickets()


func _on_entered(building_id: String) -> void:
	if building_id == "dragons_brew":
		begin_night()
	else:
		_sync_crickets()


func _on_left() -> void:
	# Only finish the café→night fade. Do not yank morning back to night.
	if _want_night:
		ensure_night()
	else:
		_sync_crickets()


func _tween_to(target: float, duration: float) -> void:
	if _tween != null:
		_tween.kill()
		_tween = null
	if is_equal_approx(amount, target):
		_apply(target)
		return
	if duration <= 0.0:
		amount = target
		_apply(amount)
		return
	_tween = create_tween()
	_tween.set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	_tween.tween_method(_set_amount, amount, target, duration) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


func _set_amount(v: float) -> void:
	amount = v
	_apply(v)


## True when the night street (or the campfire clearing) should carry crickets.
func crickets_playing() -> bool:
	return _crickets != null and _crickets.playing


func crickets_looping() -> bool:
	var stream := _crickets.stream if _crickets != null else null
	return stream is AudioStreamMP3 and (stream as AudioStreamMP3).loop


func crickets_db() -> float:
	if _crickets == null:
		return CRICKET_SILENT_DB
	return _crickets.volume_db


func _outdoor_night() -> bool:
	if not _want_night:
		return false
	if not Interiors.inside():
		return true
	var room := Interiors.current
	return room != null and room.building_id == "forest_clearing"


func _ensure_crickets() -> void:
	if _crickets != null:
		return
	var stream := CRICKETS.duplicate() as AudioStreamMP3
	stream.loop = true
	_crickets = AudioStreamPlayer.new()
	_crickets.name = "Crickets"
	_crickets.process_mode = Node.PROCESS_MODE_ALWAYS
	_crickets.stream = stream
	_crickets.volume_db = CRICKET_SILENT_DB
	add_child(_crickets)


## Ease the night loop down for a spoken line, then bring it back.
## Daytime and the café stay quiet — this does not start crickets.
func duck_for_voice(on: bool) -> void:
	if _voice_duck == on:
		return
	_voice_duck = on
	if not _outdoor_night():
		return
	_ensure_crickets()
	if on:
		_fade_crickets(CRICKET_DUCK_DB, true, 0.35)
	else:
		_fade_crickets(CRICKET_DB, true, 0.7)


func _sync_crickets() -> void:
	_ensure_crickets()
	if _outdoor_night():
		var db := CRICKET_DUCK_DB if _voice_duck else CRICKET_DB
		var dur := 0.35 if _voice_duck else FADE_TO_DAY_S
		_fade_crickets(db, true, dur)
	else:
		_fade_crickets(CRICKET_SILENT_DB, false)


func _fade_crickets(target_db: float, keep: bool, duration: float = -1.0) -> void:
	if duration < 0.0:
		duration = FADE_TO_DAY_S
	if keep:
		if _crickets.playing and absf(_crickets.volume_db - target_db) < 0.4:
			return
		if not _crickets.playing:
			_crickets.volume_db = CRICKET_SILENT_DB
			_crickets.play()
	elif not _crickets.playing:
		return
	if _cricket_tween != null:
		_cricket_tween.kill()
		_cricket_tween = null
	_cricket_tween = create_tween()
	_cricket_tween.set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	_cricket_tween.tween_property(_crickets, "volume_db", target_db, duration) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	if not keep:
		_cricket_tween.tween_callback(_stop_crickets)


func _stop_crickets() -> void:
	if _crickets != null and _crickets.playing:
		_crickets.stop()
	if _crickets != null:
		_crickets.volume_db = CRICKET_SILENT_DB


func _apply(v: float) -> void:
	var tint := DAY.lerp(NIGHT, clampf(v, 0.0, 1.0))
	for layer in _layers:
		if is_instance_valid(layer):
			layer.modulate = tint
	if _fx != null and is_instance_valid(_fx):
		_fx.modulate = Color(1, 1, 1, clampf(v, 0.0, 1.0))
		_fx.visible = v > 0.01


func _place_house_glows(builder: WorldBuilder) -> void:
	for entry in builder.world.get("objects", []):
		var asset := str(entry.get("asset", ""))
		if not WINDOWS.has(asset):
			continue
		var host := builder.entities.get(entry["id"]) as Node2D
		if host == null:
			continue
		var sprite := host.get_node_or_null("Sprite") as Sprite2D
		if sprite == null or sprite.texture == null:
			continue
		# _fx sits at the world origin, so host.position is the right local space.
		var origin := host.position + sprite.position
		for rect in WINDOWS[asset]:
			var glow := Sprite2D.new()
			glow.texture = _window_tex
			glow.centered = true
			glow.position = origin + Vector2(rect.position.x + rect.size.x * 0.5,
				rect.position.y + rect.size.y * 0.5)
			glow.scale = Vector2(rect.size.x / 10.0, rect.size.y / 6.0)
			glow.z_index = 1
			_add_add_blend(glow)
			_fx.add_child(glow)
		for door in DOORS.get(asset, []):
			var spill := Sprite2D.new()
			spill.texture = _soft
			spill.centered = true
			spill.position = origin + door
			spill.scale = Vector2(0.22, 0.16)
			spill.modulate = Color(1.0, 0.78, 0.4, 0.55)
			spill.z_index = 0
			_add_add_blend(spill)
			_fx.add_child(spill)


func _place_lamp_pools(builder: WorldBuilder) -> void:
	# LampPost_3.png: feet at host origin; sprite at (-23, -62); lantern
	# glass centers at about (-19, -37) and (18, -37) in host space.
	const FIXTURES := [Vector2(-19, -37), Vector2(18, -37)]
	for entry in builder.world.get("objects", []):
		if str(entry.get("asset", "")) != "prop.lamppost_3":
			continue
		var host := builder.entities.get(entry["id"]) as Node2D
		if host == null:
			continue
		# Ground pools under the post read as a second lantern on the dirt.
		# Keep light on the hanging fixtures only.
		for offset in FIXTURES:
			var lantern := Sprite2D.new()
			lantern.texture = _soft
			lantern.centered = true
			lantern.position = host.position + offset
			lantern.scale = Vector2(0.2, 0.16)
			lantern.modulate = Color(1.0, 0.9, 0.45, 1.0)
			lantern.z_index = 2
			_add_add_blend(lantern)
			_fx.add_child(lantern)
			var core := Sprite2D.new()
			core.texture = _soft
			core.centered = true
			core.position = host.position + offset
			core.scale = Vector2(0.08, 0.07)
			core.modulate = Color(1.0, 0.95, 0.7, 1.0)
			core.z_index = 3
			_add_add_blend(core)
			_fx.add_child(core)


func _add_add_blend(item: CanvasItem) -> void:
	var mat := CanvasItemMaterial.new()
	mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	item.material = mat


func _clear_fx() -> void:
	if _fx != null and is_instance_valid(_fx):
		_fx.queue_free()
	_fx = null


func _make_soft_circle(size: int, color: Color) -> Texture2D:
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	var center := Vector2(size * 0.5, size * 0.5)
	var radius := size * 0.5
	for y in size:
		for x in size:
			var d := Vector2(x + 0.5, y + 0.5).distance_to(center) / radius
			var a := clampf(1.0 - d, 0.0, 1.0)
			a *= a
			img.set_pixel(x, y, Color(color.r, color.g, color.b, color.a * a))
	return ImageTexture.create_from_image(img)


func _make_window_glow(w: int, h: int) -> Texture2D:
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	var warm := Color(1.0, 0.82, 0.35, 1.0)
	for y in h:
		for x in w:
			var edge_x := minf(float(x), float(w - 1 - x)) / maxf(float(w) * 0.5, 1.0)
			var edge_y := minf(float(y), float(h - 1 - y)) / maxf(float(h) * 0.5, 1.0)
			var a := clampf(minf(edge_x, edge_y) * 1.4, 0.35, 1.0)
			img.set_pixel(x, y, Color(warm.r, warm.g, warm.b, a))
	return ImageTexture.create_from_image(img)
