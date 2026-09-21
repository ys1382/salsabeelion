extends RefCounted
# Cheap species extras drawn on top of the shared villager sheet. The packs on
# disk are one human, so Mara's Çampire read is wings for now — tail waits for
# a real sheet. Same idea as the Phaser café, as overlay sprites.


static func attach(host: Node2D, look: String) -> void:
	if look == "campire":
		_add(host, "Wings", _draw_wings(), Vector2(0, -20), -1)


static func face(host: Node2D, flip_h: bool) -> void:
	var wings := host.get_node_or_null("Wings") as Sprite2D
	if wings != null:
		wings.flip_h = flip_h


static func _add(host: Node2D, node_name: String, img: Image, pos: Vector2, z: int) -> void:
	var spr := Sprite2D.new()
	spr.name = node_name
	spr.texture = ImageTexture.create_from_image(img)
	spr.position = pos
	spr.z_index = z
	spr.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	host.add_child(spr)


static func _draw_wings() -> Image:
	# 64x32, pivot at centre. Two bat triangles with a body-wide gap.
	var img := Image.create(64, 32, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var wing := Color(0.07, 0.06, 0.10, 1)
	var edge := Color(0.18, 0.16, 0.22, 1)
	_fill_tri(img, Vector2i(28, 6), Vector2i(2, 26), Vector2i(26, 20), wing)
	_fill_tri(img, Vector2i(35, 6), Vector2i(61, 26), Vector2i(37, 20), wing)
	_fill_tri(img, Vector2i(28, 8), Vector2i(10, 22), Vector2i(26, 16), edge)
	_fill_tri(img, Vector2i(35, 8), Vector2i(53, 22), Vector2i(37, 16), edge)
	return img


static func _fill_tri(img: Image, a: Vector2i, b: Vector2i, c: Vector2i, col: Color) -> void:
	var minx := mini(a.x, mini(b.x, c.x))
	var maxx := maxi(a.x, maxi(b.x, c.x))
	var miny := mini(a.y, mini(b.y, c.y))
	var maxy := maxi(a.y, maxi(b.y, c.y))
	for y in range(miny, maxy + 1):
		for x in range(minx, maxx + 1):
			if x < 0 or y < 0 or x >= img.get_width() or y >= img.get_height():
				continue
			if _in_tri(Vector2(x + 0.5, y + 0.5), Vector2(a), Vector2(b), Vector2(c)):
				img.set_pixel(x, y, col)


static func _in_tri(p: Vector2, a: Vector2, b: Vector2, c: Vector2) -> bool:
	var v0 := c - a
	var v1 := b - a
	var v2 := p - a
	var dot00 := v0.dot(v0)
	var dot01 := v0.dot(v1)
	var dot02 := v0.dot(v2)
	var dot11 := v1.dot(v1)
	var dot12 := v1.dot(v2)
	var denom := dot00 * dot11 - dot01 * dot01
	if is_zero_approx(denom):
		return false
	var u := (dot11 * dot02 - dot01 * dot12) / denom
	var v := (dot00 * dot12 - dot01 * dot02) / denom
	return u >= 0.0 and v >= 0.0 and u + v <= 1.0
