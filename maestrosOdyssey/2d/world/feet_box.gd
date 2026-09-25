extends RefCounted
# Tables, benches, crates, barrels, signs, notice boards, and houses take
# their solid shape from the opaque pixels of the picture. Empty corners
# stay empty, so the space beside a roof is not a wall. People, trees, and
# rocks keep the shapes they already have. The player's feet box is untouched.


const SHAPE := {
	"table": true,
	"bench": true,
	"container": true,
	"notice": true,
	"sign": true,
	"house": true,
}


static func apply(node: Node, asset_id: String) -> void:
	if node == null or not (node is CollisionObject2D):
		return
	if not Catalog.has_object(asset_id):
		return
	var kind := str(Catalog.object(asset_id).get("kind", ""))
	if not SHAPE.has(kind):
		return
	var body := node as CollisionObject2D
	var sprite := body.get_node_or_null("Sprite") as Sprite2D
	if sprite == null or sprite.texture == null:
		return
	var img := sprite.texture.get_image()
	if img == null:
		return
	if img.is_compressed():
		img.decompress()
	var runs := _runs(img)
	if runs.is_empty():
		return
	for child in body.get_children():
		if child is CollisionPolygon2D:
			(child as CollisionPolygon2D).disabled = true
			(child as Node).queue_free()
		elif child is CollisionShape2D and str(child.name).begins_with("Solid"):
			(child as Node).queue_free()
	var i := 0
	for run in runs:
		var shape := CollisionShape2D.new()
		shape.name = "Solid%d" % i
		var rect := RectangleShape2D.new()
		rect.size = Vector2(run[2], run[3])
		shape.shape = rect
		shape.position = sprite.position + Vector2(run[0], run[1])
		body.add_child(shape)
		i += 1


## Each run is center_x, center_y, width, height in sprite pixels.
## A transparent gap on a row is not bridged, so a doorway or a roof corner stays open.
static func _runs(img: Image) -> Array:
	var w := img.get_width()
	var h := img.get_height()
	var open: Array = []
	var out: Array = []
	for y in h:
		var spans: Array = []
		var x := 0
		while x < w:
			if img.get_pixel(x, y).a <= 0.15:
				x += 1
				continue
			var x0 := x
			while x < w and img.get_pixel(x, y).a > 0.15:
				x += 1
			spans.append([x0, x])
		var next: Array = []
		for span in spans:
			var x0: int = span[0]
			var x1: int = span[1]
			var joined := false
			for run in open:
				if run[0] == x0 and run[1] == x1 and run[3] == y:
					run[3] = y + 1
					next.append(run)
					joined = true
					break
			if not joined:
				next.append([x0, x1, y, y + 1])
		for run in open:
			if run[3] != y + 1:
				out.append(_box(run))
		open = next
	for run in open:
		out.append(_box(run))
	return out


static func _box(run: Array) -> Array:
	var x0: int = run[0]
	var x1: int = run[1]
	var y0: int = run[2]
	var y1: int = run[3]
	return [
		(x0 + x1) * 0.5,
		(y0 + y1) * 0.5,
		x1 - x0,
		y1 - y0,
	]
