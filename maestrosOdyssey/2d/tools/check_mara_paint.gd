extends SceneTree
# godot --headless --path . -s res://tools/check_mara_paint.gd
# Mara's copy of the villager sheet: lighter brown hair, darker brown skin.
# Shirt, pants, and boots stay the original colors. No whole-sprite wash.


func _initialize() -> void:
	var frames := Sheet.mara_frames()
	var plain := Sheet.villager_frames()
	var painted: Image = (frames.get_frame_texture("idle_down", 0) as AtlasTexture).get_image()
	var original: Image = (plain.get_frame_texture("idle_down", 0) as AtlasTexture).get_image()
	_expect(_hex(painted.get_pixel(16, 20)) == "70482e", "face should be the darker brown")
	_expect(_hex(painted.get_pixel(14, 10)) == "8f5a34", "hair should be the lighter brown")
	_expect(_same(painted.get_pixel(16, 26), original.get_pixel(16, 26)), "shirt pixel stays")
	_expect(_same(painted.get_pixel(14, 38), original.get_pixel(14, 38)), "boot pixel stays")
	_expect(frames.get_animation_names().has("move_down"), "same walk, not a new one")
	_expect(_same(painted.get_pixel(17, 18), original.get_pixel(17, 18)), "eyes stay")
	print("mara paint: ok")
	quit()


func _same(a: Color, b: Color) -> bool:
	return _hex(a) == _hex(b) and is_equal_approx(a.a, b.a)


func _hex(c: Color) -> String:
	return "%02x%02x%02x" % [
		clampi(int(round(c.r * 255.0)), 0, 255),
		clampi(int(round(c.g * 255.0)), 0, 255),
		clampi(int(round(c.b * 255.0)), 0, 255),
	]


func _expect(ok: bool, msg: String) -> void:
	if ok:
		return
	push_error(msg)
	quit(1)
