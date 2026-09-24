extends RefCounted
# Furniture keeps a short box at the feet. The pack's polygons are the whole
# sprite, which reads as a full-body wall and fills an aisle. Trees, houses,
# and rocks stay as they are — those are the outdoor walls.


const FEET_H := 8.0
const TRIM := {
	"table": true,
	"bench": true,
	"container": true,
	"notice": true,
	"sign": true,
}


static func apply(node: Node, asset_id: String) -> void:
	if node == null or not (node is CollisionObject2D):
		return
	if not Catalog.has_object(asset_id):
		return
	var kind := str(Catalog.object(asset_id).get("kind", ""))
	if not TRIM.has(kind):
		return
	var body := node as CollisionObject2D
	var polys: Array[CollisionPolygon2D] = []
	var aabb := Rect2()
	var have := false
	for child in body.get_children():
		if child is CollisionPolygon2D:
			var poly := child as CollisionPolygon2D
			if poly.disabled or poly.polygon.size() < 3:
				continue
			polys.append(poly)
			for p in poly.polygon:
				if not have:
					aabb = Rect2(p, Vector2.ZERO)
					have = true
				else:
					aabb = aabb.expand(p)
	if not have or aabb.size.y <= FEET_H + 2.0:
		return
	var w := clampf(aabb.size.x * 0.8, 10.0, aabb.size.x)
	var rect := RectangleShape2D.new()
	rect.size = Vector2(w, FEET_H)
	var shape := CollisionShape2D.new()
	shape.name = "Feet"
	shape.shape = rect
	var bottom := aabb.position.y + aabb.size.y
	shape.position = Vector2(aabb.get_center().x, bottom - FEET_H * 0.5)
	body.add_child(shape)
	for poly in polys:
		poly.disabled = true
		poly.queue_free()
