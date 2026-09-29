extends RefCounted
# godot --path . --headless -- --check-pie-light
# After the Saturday pie is finished, a small pool shows the ground and the
# trees. Lamp posts stay out that night. Morning clears it. Any other night
# keeps the lamps.


static func run(host: Node) -> void:
	var gs: Node = host.get_node("/root/GameState")
	var cafe: Node = host.get_node("/root/CafeOrder")
	var rooms: Node = host.get_node("/root/Interiors")
	var sky: Node = host.get_node("/root/DayNight")
	gs.skip_to_morning(6)
	await host.get_tree().process_frame
	var root: Node = WorldManager.world_root
	var player := root.player as Player
	await _expect(host, player.get_node_or_null("SugarplumSparkles") != null,
		"sugarplum sparkles were removed")
	await _expect(host, not gs.sugarplum_sparkle, "pie night turned on the sugarplum sparkles")
	await _expect(host, cafe.board_text().contains("golden apple pie"), "the pie left the board")

	sky.begin_night(0.0)
	await host.get_tree().process_frame
	await _expect(host, not gs.pie_light, "the pool showed up before the pie was finished")
	await _expect(host, _lamps_on(), "lamp posts were out before the pie")
	await _expect(host, _windows_on(), "windows were dark on a normal night")
	rooms.enter_clearing("forest_clearing")
	await host.get_tree().process_frame
	await _expect(host, rooms.current.get_node_or_null("PieLightVeil") == null,
		"skipping the pie still darkened the woods")
	rooms.leave()
	await host.get_tree().create_timer(0.6).timeout

	cafe.taken = true
	cafe.awaiting_serve = false
	cafe._food = "golden apple pie"
	cafe.muffin_left = 1
	cafe.cup_left = 0
	cafe.bite()
	await host.get_tree().process_frame
	await _expect(host, gs.pie_light, "finishing the pie did not light the pool")
	await _expect(host, not _lamps_on(), "lamp posts stayed lit on the pie night")
	await _expect(host, _windows_on(), "windows went dark on the pie night")
	await _expect(host, root.get_node_or_null("Objects/campfire") != null, "the campfire was removed")
	var fire := root.get_node_or_null("Objects/campfire") as CanvasItem
	await _expect(host, fire != null and _near(fire.modulate.r, 0.48),
		"the pool lit the campfire")
	var house := _sprite(root, "building.house")
	var tree := _sprite(root, "tree.tree")
	await _expect(host, house != null and _reveal_of(house) == 0.0, "a house took the foot light")
	await _expect(host, tree != null and _reveal_of(tree) == 1.0, "trees stayed dark inside the pool")
	var ground := root.get_node_or_null("Ground") as CanvasItem
	var street := root.get_node_or_null("PieStreetVeil") as CanvasItem
	await _expect(host, ground != null and ground.material == null, "the ground shader swallowed the street")
	await _expect(host, street != null and _radius(street) <= 64.0, "the pool lights the whole street")
	await _expect(host, root.get_node_or_null("Objects/PiePool") == null, "the pool was parented over the houses")
	await _expect(host, ground.get_node_or_null("PiePool") != null, "no pool on the ground")

	rooms.enter_clearing("forest_clearing")
	await host.get_tree().process_frame
	var veil := rooms.current.get_node_or_null("PieLightVeil") as CanvasItem
	await _expect(host, veil != null, "the woods stayed fully lit after the pie")
	await _expect(host, _radius(veil) <= 64.0, "the pool lights the whole woods")
	await _shot(host, "/tmp/mo-pie-woods.png")
	rooms.leave()
	await host.get_tree().create_timer(0.6).timeout
	await _shot(host, "/tmp/mo-pie-street.png")

	gs.advance_day()
	sky.begin_day(0.0)
	await host.get_tree().process_frame
	await _expect(host, not gs.pie_light, "morning did not clear the pool")
	await _expect(host, house.material == null, "the house kept the pie-night shade")
	await _expect(host, tree.material == null, "a tree kept the pie-night shade")
	sky.begin_night(0.0)
	await host.get_tree().process_frame
	await _expect(host, _lamps_on(), "Sunday night turned the lamp posts off")
	cafe._food = "galleta"
	cafe.muffin_left = 1
	cafe.cup_left = 0
	cafe.taken = true
	cafe.bite()
	await _expect(host, not gs.pie_light, "a cookie turned the pool on")
	await _expect(host, _lamps_on(), "a cookie turned the lamp posts off")

	print("pie light: ok")
	host.get_tree().quit()


static func _lamps_on() -> bool:
	var tree := Engine.get_main_loop() as SceneTree
	var any := false
	for node in tree.get_nodes_in_group("lamp_glow"):
		any = true
		if node is CanvasItem and not (node as CanvasItem).visible:
			return false
	return any


static func _windows_on() -> bool:
	var root := WorldManager.world_root
	var fx := root.get_node_or_null("NightFx") if root != null else null
	if fx == null or not (fx as CanvasItem).visible:
		return false
	for child in fx.get_children():
		if child.is_in_group("lamp_glow"):
			continue
		if child is CanvasItem and (child as CanvasItem).visible:
			return true
	return false


static func _sprite(root: Node, prefix: String) -> Sprite2D:
	for id in root.entities:
		var node: Node = root.entities[id]
		if node == null or not node.has_meta("mo_asset"):
			continue
		if not str(node.get_meta("mo_asset")).begins_with(prefix):
			continue
		var sprite := node.get_node_or_null("Sprite") as Sprite2D
		if sprite != null:
			return sprite
	return null


static func _reveal_of(item: CanvasItem) -> float:
	var mat := item.material as ShaderMaterial
	if mat == null:
		return -1.0
	return float(mat.get_shader_parameter("can_reveal"))


static func _radius(item: CanvasItem) -> float:
	var mat := item.material as ShaderMaterial
	if mat == null:
		return 999.0
	return float(mat.get_shader_parameter("light_radius"))


static func _near(a: float, b: float) -> bool:
	return absf(a - b) < 0.02


static func _shot(host: Node, path: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	var img := host.get_viewport().get_texture().get_image()
	if img != null:
		img.save_png(path)


static func _expect(host: Node, ok: bool, msg: String) -> void:
	if ok:
		return
	push_error(msg)
	host.get_tree().quit(1)
	await host.get_tree().create_timer(30.0).timeout
