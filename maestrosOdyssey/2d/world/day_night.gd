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
# Two loops, same kind of player. A light café track plays only inside
# Dragon's Brew. Crickets start when you step out into that night, stay on
# for the walk home and the campfire, and ease off indoors or when morning
# returns. They stay off while you are ordering.

## 0 = full day, 1 = full night.
var amount := 0.0
## True after a café visit starts night, until morning resets the street.
var _want_night := false
## Saturday pie night only. Ground and trees show inside a small circle.
const POOL_RADIUS := 52.0
const REVEAL_SHADER := preload("res://world/pie_light.gdshader")
const VEIL_SHADER := preload("res://world/pie_veil.gdshader")

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
## Light background under the room. The file is already a normal music
## level, so this stays under Mara instead of boosting it.
const CAFE_DB := -14.0
const CAFE_SILENT_DB := -80.0
## Eased down while she is speaking, so the line stays clear. Not silence.
const CAFE_DUCK_DB := -28.0
const CAFE_FADE_S := 1.6
const CAFE_MUSIC := preload("res://audio/little_cafe.mp3")

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
var _cafe_tween: Tween
var _cafe: AudioStreamPlayer
## True only while a Mara clip is playing. Never starts the night loop by itself.
var _voice_duck := false
var _fx: Node2D
var _layers: Array[CanvasItem] = []
var _soft: Texture2D
var _window_tex: Texture2D
var _builder: WorldBuilder
var _reveal_on := false
var _mat_reveal: ShaderMaterial
var _mat_dark: ShaderMaterial
var _painted: Array[CanvasItem] = []
var _pool: Sprite2D
var _veil: Sprite2D
var _veil_mat: ShaderMaterial
var _street_veil: Sprite2D
var _street_veil_mat: ShaderMaterial
var _campfire: CanvasItem
var _campfire_mod := Color.WHITE


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_soft = _make_soft_circle(96, Color(1.0, 0.72, 0.35, 1.0))
	_window_tex = _make_window_glow(14, 10)
	Interiors.entered.connect(_on_entered)
	Interiors.left.connect(_on_left)
	_ensure_crickets()
	_ensure_cafe()


## Call after every WorldBuilder.build() so FX and layer refs stay live.
func attach(builder: WorldBuilder) -> void:
	_builder = builder
	_painted.clear()
	_reveal_on = false
	_mat_reveal = null
	_mat_dark = null
	_pool = null
	_campfire = null
	_street_veil = null
	_street_veil_mat = null
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
	elif building_id == "forest_clearing":
		_ensure_veil()
		_sync_crickets()
	else:
		_sync_crickets()
	_sync_cafe()


func _on_left() -> void:
	_veil = null
	# Only finish the café→night fade. Do not yank morning back to night.
	if _want_night:
		ensure_night()
	else:
		_sync_crickets()
	_sync_cafe()


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


## Ease the night loop, or the café track, down for a spoken line, then
## bring it back. This does not start crickets in the daytime or the café.
func duck_for_voice(on: bool) -> void:
	if _voice_duck == on:
		return
	_voice_duck = on
	if _outdoor_night():
		_ensure_crickets()
		if on:
			_fade_crickets(CRICKET_DUCK_DB, true, 0.35)
		else:
			_fade_crickets(CRICKET_DB, true, 0.7)
	if _in_cafe():
		_ensure_cafe()
		if on:
			_fade_cafe(CAFE_DUCK_DB, true, 0.35)
		else:
			_fade_cafe(CAFE_DB, true, 0.7)


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


func cafe_playing() -> bool:
	return _cafe != null and _cafe.playing


func cafe_looping() -> bool:
	var stream := _cafe.stream if _cafe != null else null
	return stream is AudioStreamMP3 and (stream as AudioStreamMP3).loop


func cafe_db() -> float:
	if _cafe == null:
		return CAFE_SILENT_DB
	return _cafe.volume_db


func _in_cafe() -> bool:
	if not Interiors.inside():
		return false
	var room := Interiors.current
	return room != null and room.building_id == "dragons_brew"


func _ensure_cafe() -> void:
	if _cafe != null:
		return
	var stream := CAFE_MUSIC.duplicate() as AudioStreamMP3
	stream.loop = true
	_cafe = AudioStreamPlayer.new()
	_cafe.name = "CafeMusic"
	_cafe.process_mode = Node.PROCESS_MODE_ALWAYS
	_cafe.stream = stream
	_cafe.volume_db = CAFE_SILENT_DB
	add_child(_cafe)


func _sync_cafe() -> void:
	_ensure_cafe()
	if _in_cafe():
		var db := CAFE_DUCK_DB if _voice_duck else CAFE_DB
		var dur := 0.35 if _voice_duck else CAFE_FADE_S
		_fade_cafe(db, true, dur)
	else:
		_fade_cafe(CAFE_SILENT_DB, false, CAFE_FADE_S)


func _fade_cafe(target_db: float, keep: bool, duration: float = -1.0) -> void:
	if duration < 0.0:
		duration = CAFE_FADE_S
	if keep:
		if _cafe.playing and absf(_cafe.volume_db - target_db) < 0.4:
			return
		if not _cafe.playing:
			_cafe.volume_db = CAFE_SILENT_DB
			_cafe.play()
	elif not _cafe.playing:
		return
	if _cafe_tween != null:
		_cafe_tween.kill()
		_cafe_tween = null
	_cafe_tween = create_tween()
	_cafe_tween.set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	_cafe_tween.tween_property(_cafe, "volume_db", target_db, duration) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	if not keep:
		_cafe_tween.tween_callback(_stop_cafe)


func _stop_cafe() -> void:
	if _cafe != null and _cafe.playing:
		_cafe.stop()
	if _cafe != null:
		_cafe.volume_db = CAFE_SILENT_DB


func sync_pie_light() -> void:
	_apply(amount)
	_ensure_veil()


func _process(_delta: float) -> void:
	if not _reveal_on and _veil == null:
		return
	var pos := _feet()
	if _mat_reveal != null:
		_mat_reveal.set_shader_parameter("light_pos", pos)
	if _mat_dark != null:
		_mat_dark.set_shader_parameter("light_pos", pos)
	if _pool != null and is_instance_valid(_pool):
		var on_street := _reveal_on and not _in_woods() and not _indoors_room()
		_pool.visible = on_street
		if on_street and _pool.get_parent() != null:
			_pool.position = _pool.get_parent().to_local(pos)
	if _veil != null and is_instance_valid(_veil) and _veil_mat != null:
		_veil_mat.set_shader_parameter("light_pos", pos)
		if _veil.get_parent() != null:
			_veil.position = _veil.get_parent().to_local(pos)
	if _street_veil != null and is_instance_valid(_street_veil) and _street_veil_mat != null:
		_street_veil_mat.set_shader_parameter("light_pos", pos)
		if _street_veil.get_parent() != null:
			_street_veil.position = _street_veil.get_parent().to_local(pos)


func _apply(v: float) -> void:
	var pie := GameState.pie_light and v >= 0.999
	var tint := DAY.lerp(NIGHT, clampf(v, 0.0, 1.0))
	for layer in _layers:
		if not is_instance_valid(layer):
			continue
		# Pie night paints its own dark, so the street tint would stack.
		layer.modulate = Color.WHITE if pie else tint
	if pie:
		_install_reveal()
	else:
		_clear_reveal()
	_set_lamp_glow(not pie)
	if _fx != null and is_instance_valid(_fx):
		_fx.modulate = Color(1, 1, 1, clampf(v, 0.0, 1.0))
		_fx.visible = v > 0.01


func _feet() -> Vector2:
	if _builder != null and is_instance_valid(_builder) and _builder.player != null:
		return _builder.player.global_position
	return Vector2.ZERO


func _indoors_room() -> bool:
	if not Interiors.inside():
		return false
	var room := Interiors.current
	return room != null and room.building_id != "forest_clearing"


func _in_woods() -> bool:
	if not Interiors.inside():
		return false
	var room := Interiors.current
	return room != null and room.building_id == "forest_clearing"


func _install_reveal() -> void:
	if _reveal_on or _builder == null or not is_instance_valid(_builder):
		return
	_reveal_on = true
	_mat_reveal = _make_light_mat(1.0)
	_mat_dark = _make_light_mat(0.0)
	for layer in _layers:
		if is_instance_valid(layer) and str(layer.name) == "Objects":
			_paint_tree(layer)
	# Ground stays a flat picture. A veil darkens it, with a hole at the feet.
	# Tile maps do not report a usable position in a shader, so the hole is a sprite.
	_set_ground_z(-2)
	_ensure_street_veil()
	_ensure_pool()
	var pos := _feet()
	_mat_reveal.set_shader_parameter("light_pos", pos)
	_mat_dark.set_shader_parameter("light_pos", pos)


func _paint_tree(node: Node) -> void:
	var player := _builder.player if _builder != null else null
	for child in node.get_children():
		if child == player or str(child.name) == "PiePool":
			continue
		# The fire keeps its own look. The foot pool does not brighten it.
		if str(child.name) == "campfire" and child is CanvasItem:
			_campfire = child
			_campfire_mod = _campfire.modulate
			_campfire.modulate = NIGHT
			continue
		if child is Sprite2D or child is AnimatedSprite2D:
			_assign(child, _reveal_ok(child))
		_paint_tree(child)


func _reveal_ok(node: Node) -> bool:
	var n: Node = node
	while n != null:
		if str(n.name) == "campfire":
			return false
		if n.has_meta("mo_asset"):
			return str(n.get_meta("mo_asset")).begins_with("tree.")
		if n is TileMapLayer and str(n.name) in ["Ground", "Water", "Road", "Shade"]:
			return true
		n = n.get_parent()
	return false


func _assign(item: CanvasItem, reveal: bool) -> void:
	item.material = _mat_reveal if reveal else _mat_dark
	_painted.append(item)


func _make_light_mat(reveal: float) -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	mat.shader = REVEAL_SHADER
	mat.set_shader_parameter("can_reveal", reveal)
	mat.set_shader_parameter("light_radius", POOL_RADIUS)
	mat.set_shader_parameter("night_tint", NIGHT)
	return mat


func _clear_reveal() -> void:
	if not _reveal_on and _painted.is_empty():
		return
	for item in _painted:
		if is_instance_valid(item):
			item.material = null
	_painted.clear()
	_reveal_on = false
	_mat_reveal = null
	_mat_dark = null
	if _campfire != null and is_instance_valid(_campfire):
		_campfire.modulate = _campfire_mod
	_campfire = null
	if _pool != null and is_instance_valid(_pool):
		_pool.visible = false
	_set_ground_z(0)
	_drop_veil()
	_drop_street_veil()


func _ensure_pool() -> void:
	var ground := _builder.get_node_or_null("Ground") as Node2D if _builder != null else null
	if ground == null:
		return
	if _pool != null and is_instance_valid(_pool):
		return
	_pool = Sprite2D.new()
	_pool.name = "PiePool"
	_pool.texture = _soft
	_pool.centered = true
	_pool.scale = Vector2(1.15, 0.9)
	_pool.modulate = Color(1.0, 0.86, 0.55, 0.28)
	_add_add_blend(_pool)
	ground.add_child(_pool)
	_pool.visible = false


func _set_ground_z(z: int) -> void:
	for layer in _layers:
		if not is_instance_valid(layer) or str(layer.name) == "Objects":
			continue
		layer.z_index = z


func _ensure_street_veil() -> void:
	if _builder == null or not is_instance_valid(_builder):
		return
	if _street_veil != null and is_instance_valid(_street_veil):
		return
	_street_veil = _make_veil_sprite("PieStreetVeil")
	_street_veil.z_index = -1
	_street_veil_mat = _street_veil.material as ShaderMaterial
	_builder.add_child(_street_veil)
	_street_veil.position = _builder.to_local(_feet())


func _drop_street_veil() -> void:
	if _street_veil != null and is_instance_valid(_street_veil):
		_street_veil.queue_free()
	_street_veil = null
	_street_veil_mat = null


func _make_veil_sprite(node_name: String) -> Sprite2D:
	var veil := Sprite2D.new()
	veil.name = node_name
	var img := Image.create(4, 4, false, Image.FORMAT_RGBA8)
	img.fill(Color.WHITE)
	veil.texture = ImageTexture.create_from_image(img)
	veil.centered = true
	veil.scale = Vector2(900, 900)
	var mat := ShaderMaterial.new()
	mat.shader = VEIL_SHADER
	mat.set_shader_parameter("light_radius", POOL_RADIUS)
	mat.set_shader_parameter("night_tint", NIGHT)
	mat.set_shader_parameter("light_pos", _feet())
	veil.material = mat
	return veil


func _ensure_veil() -> void:
	if not _reveal_on or not _in_woods():
		_drop_veil()
		return
	var room := Interiors.current
	if room == null:
		return
	if _veil != null and is_instance_valid(_veil) and _veil.get_parent() == room:
		return
	_drop_veil()
	_veil = _make_veil_sprite("PieLightVeil")
	_veil.z_as_relative = false
	_veil.z_index = 40
	_veil_mat = _veil.material as ShaderMaterial
	room.add_child(_veil)
	_veil.position = room.to_local(_feet())


func _drop_veil() -> void:
	if _veil != null and is_instance_valid(_veil):
		_veil.queue_free()
	_veil = null
	_veil_mat = null


func _set_lamp_glow(show_lamps: bool) -> void:
	# Posts stay. Only the hanging light is out, and only on the pie night.
	for node in get_tree().get_nodes_in_group("lamp_glow"):
		if node is CanvasItem:
			(node as CanvasItem).visible = show_lamps


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
			lantern.add_to_group("lamp_glow")
			_add_add_blend(lantern)
			_fx.add_child(lantern)
			var core := Sprite2D.new()
			core.texture = _soft
			core.centered = true
			core.position = host.position + offset
			core.scale = Vector2(0.08, 0.07)
			core.modulate = Color(1.0, 0.95, 0.7, 1.0)
			core.z_index = 3
			core.add_to_group("lamp_glow")
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
