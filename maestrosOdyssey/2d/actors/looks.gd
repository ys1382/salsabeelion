extends RefCounted
# Cheap species extras drawn on top of the shared villager sheet. The packs on
# disk are one human, so Mara's Çampire read is wings for now — tail waits for
# a real sheet. Same idea as the Phaser café, as overlay sprites.
#
# Other species still use a light wash on the shared sheet. Mara does not:
# a wash dyes the shirt and pants. Her hair and skin are repainted on her
# own copy of the same frames (see Sheet.mara_frames). No new walk.

const SPECIES_TINT := {
	"vampire": {"hex": "#e8e6ee", "wash": 0.12},
	"werewolf": {"hex": "#6e6e72", "wash": 0.18},
	"lizardfolk": {"hex": "#3f8f5a", "wash": 0.28},
	"merfolk": {"hex": "#3a6db0", "wash": 0.28},
	"dragonfolk": {"hex": "#b33a32", "wash": 0.28},
}


static func species_of(data: Dictionary) -> String:
	var look := str(data.get("look", "")).to_lower()
	if look == "campire":
		return "campire"
	var species := str(data.get("species", "")).to_lower()
	if SPECIES_TINT.has(species):
		return species
	var blob := (str(data.get("role", "")) + " " + str(data.get("name", ""))).to_lower()
	if "lizardfolk" in blob or "iguana" in blob:
		return "lizardfolk"
	if "merfolk" in blob:
		return "merfolk"
	if "dragonfolk" in blob:
		return "dragonfolk"
	if "werewolf" in blob:
		return "werewolf"
	if "vampire" in blob:
		return "vampire"
	return ""


static func apply_body_tint(sprite: CanvasItem, data: Dictionary) -> void:
	# Leave Mara at full color. Her JSON tint key stays, but it must not
	# wash the whole picture or the clothes go brown with her.
	if species_of(data) == "campire":
		sprite.modulate = Color.WHITE
		return
	var key := species_of(data)
	if key != "" and SPECIES_TINT.has(key):
		var spec: Dictionary = SPECIES_TINT[key]
		var col := Color(String(spec["hex"]))
		sprite.modulate = col.lerp(Color.WHITE, float(spec["wash"]))
		return
	var tint := str(data.get("tint", ""))
	if tint.is_valid_html_color():
		sprite.modulate = Color(tint).lerp(Color.WHITE, 0.6)


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
	# Copper-brown rim. These wing pixels stay as they are.
	var wing := Color(0.12, 0.09, 0.10, 1)
	var edge := Color(0.42, 0.28, 0.18, 1)
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
