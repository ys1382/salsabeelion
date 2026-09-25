extends SceneTree

const FeetBox := preload("res://world/feet_box.gd")
# godot --headless --path . -s res://tools/check_solid_span.gd
# Houses and furniture solids follow the picture, including the roof peak.
# A transparent corner beside the roof is not solid.


func _initialize() -> void:
	var ids := [
		"building.house_hay_1",
		"building.house_hay_2",
		"building.house_hay_3",
		"building.house_hay_4_purple",
		"prop.table_medium_1",
		"prop.sign_1",
		"prop.bulletinboard_1",
		"prop.crate_large_empty",
		"prop.barrel_small_empty",
		"prop.bench_1",
		"tree.tree_emerald_1",
		"prop.lamppost_3",
		"building.well_hay_1",
	]
	for id in ids:
		var node: StaticBody2D = load(Catalog.object(id)["scene"]).instantiate()
		root.add_child(node)
		FeetBox.apply(node, id)
		var sprite := node.get_node("Sprite") as Sprite2D
		var img := sprite.texture.get_image()
		if img.is_compressed():
			img.decompress()
		var top := 9999.0
		var solids := 0
		for child in node.get_children():
			if child is CollisionShape2D and str(child.name).begins_with("Solid"):
				solids += 1
				var shape := child as CollisionShape2D
				var rect := shape.shape as RectangleShape2D
				top = minf(top, shape.position.y - rect.size.y * 0.5)
		if solids == 0:
			push_error("%s has no solid" % id)
			quit(1)
			return
		var picture_top := sprite.position.y
		if top > picture_top + 2.0:
			push_error("%s solid starts at %s, picture at %s" % [id, top, picture_top])
			quit(1)
			return
		var corner := _clear_corner(img)
		if corner.x >= 0 and _hits(node, sprite.position + Vector2(corner) + Vector2(0.5, 0.5)):
			push_error("%s filled a clear corner at %s" % [id, corner])
			quit(1)
			return
		print(id, " solids ", solids, " top ", top, " picture ", picture_top)
		node.queue_free()
	var cafe: StaticBody2D = load(Catalog.object("prop.sign_1")["scene"]).instantiate()
	root.add_child(cafe)
	FeetBox.apply(cafe, "prop.sign_1")
	var painted = preload("res://world/street_sign.gd").new()
	cafe.add_child(painted)
	painted.setup("Dragon's Brew", false)
	if _hits(cafe, Vector2(0, 0)) or _hits(cafe, Vector2(0, -8)):
		push_error("cafe sign still has a street post")
		quit(1)
		return
	if cafe.collision_layer != 0:
		push_error("cafe sign still blocks the street")
		quit(1)
		return
	print("cafe hanging sign: ok")
	print("solid span: ok")
	quit()


func _clear_corner(img: Image) -> Vector2i:
	var w := img.get_width()
	var h := img.get_height()
	if img.get_pixel(0, 0).a <= 0.15:
		return Vector2i(0, 0)
	if img.get_pixel(w - 1, 0).a <= 0.15:
		return Vector2i(w - 1, 0)
	return Vector2i(-1, -1)


func _hits(body: StaticBody2D, local: Vector2) -> bool:
	for child in body.get_children():
		if not (child is CollisionShape2D) or not str(child.name).begins_with("Solid"):
			continue
		var shape := child as CollisionShape2D
		var rect := shape.shape as RectangleShape2D
		var box := Rect2(shape.position - rect.size * 0.5, rect.size)
		if box.has_point(local):
			return true
	return false
