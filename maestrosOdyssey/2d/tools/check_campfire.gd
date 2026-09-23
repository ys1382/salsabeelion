extends RefCounted
# godot --path . --headless -- --check-campfire
# Forest morning starts with the sack. After the cut, the wood stays in it.
# Behind the house: unlit pit, then the pack's animated campfire. Outdoor only.


static func run(host: Node) -> void:
	var gs: Node = host.get_node("/root/GameState")
	var player := WorldManager.world_root.player as Player
	var held := player.get_node("Held") as Sprite2D

	assert(gs.day_index == 1)
	assert(not gs.carrying_sack())
	player._refresh_held()
	assert(not held.visible)

	gs.day_index = 2
	gs._sync_clock()
	assert(not gs.forest_morning())
	assert(not gs.carrying_sack())

	gs.day_index = 6
	gs._sync_clock()
	assert(gs.weekday == "Saturday")
	assert(gs.forest_morning())
	assert(gs.carrying_sack())
	player._refresh_held()
	assert(held.visible)
	assert(held.texture.resource_path.ends_with("Sack_3.png"))

	var root := WorldManager.world_root
	var spot := root.entities["campfire"] as Node2D
	assert(spot != null)
	assert(spot.get_parent().name == "Objects")
	assert(spot.get_node_or_null("Interact") != null)
	assert(gs.campfire_stage == 0)
	assert(spot.get_node_or_null("Pit") == null)

	var interiors: Node = host.get_node("/root/Interiors")
	interiors.enter_clearing("forest_clearing")
	player._refresh_held()
	assert(held.visible)
	assert(not held.texture.resource_path.ends_with("Sack_3.png"))
	var clearing: Node = interiors.current
	var dead := clearing.get_node("Objects/dead_tree") as Node2D
	player.global_position = dead.global_position + Vector2(0, 28)
	player.facing = Vector2.UP
	for _i in 4:
		player._attacking = false
		player.swing()
	assert(gs.wood_cut_today())
	assert(gs.has_item("logs"))
	assert(gs.wood_for_fire())
	interiors.leave()
	player._refresh_held()
	assert(held.visible)
	assert(held.texture.resource_path.ends_with("Sack_3.png"))

	var it := spot.get_node("Interact") as Interactable
	player.global_position = spot.global_position + Vector2(0, 28)
	player.facing = Vector2.UP
	await _shot(host, "campfire_sack.png")

	assert(it.prompt() == "Build")
	var built := it.use()
	assert(gs.campfire_stage == 1)
	assert("stones" in built)
	assert(spot.get_node_or_null("Pit") != null or _named(spot, "Pit"))
	assert(gs.carrying_sack())
	await _shot(host, "campfire_pit.png")

	assert(it.prompt() == "Light")
	var lit := it.use()
	assert(gs.campfire_stage == 2)
	assert("campfire" in lit.to_lower())
	assert(not gs.carrying_sack())
	assert(not gs.has_item("logs"))
	assert(gs.wood_cut_today())
	player._refresh_held()
	assert(not held.visible)
	var flame := _named(spot, "Flame") as AnimatedSprite2D
	assert(flame != null)
	assert(flame.sprite_frames.get_frame_count("burn") == 8)
	var frame: AtlasTexture = flame.sprite_frames.get_frame_texture("burn", 0)
	assert(frame.region.size == Vector2(32, 32))
	assert(flame.is_playing())
	assert(_named(spot, "Pit") == null)
	await _shot(host, "campfire_lit.png")

	# The fire stays outside. Stepping into the house does not bring it along.
	interiors.enter("player_house", "")
	assert(interiors.inside())
	assert(interiors.current.get_node_or_null("Objects/campfire") == null)
	assert(interiors.current.get_node_or_null("Objects/Pit") == null)
	var home_assets := ""
	for child in interiors.current.get_node("Objects").get_children():
		home_assets += child.name + " "
	assert(not ("Fireplace" in home_assets))
	assert(not ("Flame" in home_assets))
	interiors.leave()

	# One fire this week. Sunday is a normal café morning; the lit fire stays.
	var arrow: Node = host.get_node("/root/WaypointHud")
	gs.cafe_meal_done = true
	assert(not gs.wood_for_fire())
	assert(arrow.current_id() == "player_house")
	gs.advance_day()
	assert(gs.day_index == 7)
	assert(gs.weekday == "Sunday")
	assert(not gs.forest_morning())
	assert(not gs.carrying_sack())
	assert(gs.campfire_stage == 2)
	assert(not gs.wood_for_fire())
	assert(it.prompt() == "Look")
	gs.cafe_meal_done = false
	gs.take_item("learning_card")
	assert(arrow.current_id() == "dragons_brew")
	player._refresh_held()
	assert(not held.visible)

	print("campfire: ok")
	host.get_tree().quit()


static func _shot(host: Node, name: String) -> void:
	if host.get_tree() == null or DisplayServer.get_name() == "headless":
		return
	await host.get_tree().process_frame
	await RenderingServer.frame_post_draw
	var img := host.get_viewport().get_texture().get_image()
	if img == null or img.get_width() < 2:
		return
	var dir := ProjectSettings.globalize_path("res://test_output/")
	DirAccess.make_dir_recursive_absolute(dir)
	img.save_png(dir + name)


static func _named(node: Node, wanted: String) -> Node:
	if node.name == wanted:
		return node
	for child in node.get_children():
		var found := _named(child, wanted)
		if found != null:
			return found
	return null
