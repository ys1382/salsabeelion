extends Node
# Outdoor day / night look for the village street.
#
# Day stays bright. Night cools and dims the ground, trees, and houses; lamp
# posts cast a soft warm pool; house windows and doorways glow from indoors.
# Richer glass (sun, moon, stars) waits until after animation upgrades.
#
# Night falls while you are inside Dragon's Brew, so the street is night when
# you step out. Morning (night pass at home) fades the street back to day.

## 0 = full day, 1 = full night.
var amount := 0.0
## True after a café visit starts night, until morning resets the street.
var _want_night := false

const DAY := Color(1, 1, 1, 1)
## Cool, dim outdoor cast — grass, dirt, trees, house walls.
const NIGHT := Color(0.48, 0.52, 0.72, 1)

const FADE_IN_CAFE_S := 10.0
const FADE_TO_DAY_S := 2.2

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


## Street must read as night the moment you leave the café (instant — the fade
## already happened while the outdoor world was hidden).
func ensure_night() -> void:
	_want_night = true
	if _tween != null:
		_tween.kill()
		_tween = null
	amount = 1.0
	_apply(1.0)


func begin_day(duration: float = FADE_TO_DAY_S) -> void:
	_want_night = false
	_tween_to(0.0, duration)


func _on_entered(building_id: String) -> void:
	if building_id == "dragons_brew":
		begin_night()


func _on_left() -> void:
	# Only finish the café→night fade. Do not yank morning back to night.
	if _want_night:
		ensure_night()


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
		# Soft warm pool on the ground under the post — not on the wood.
		var pool := Sprite2D.new()
		pool.texture = _soft
		pool.centered = true
		pool.position = host.position + Vector2(0, 4)
		pool.scale = Vector2(0.9, 0.42)
		pool.modulate = Color(1.0, 0.7, 0.35, 0.55)
		pool.z_index = -1
		_add_add_blend(pool)
		_fx.add_child(pool)
		# Brighten each hanging lantern on the fixture itself.
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
