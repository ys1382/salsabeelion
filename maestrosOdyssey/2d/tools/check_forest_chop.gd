extends RefCounted
# Run from the real game: godot --path . -- --check-forest
# Monday and Tuesday point at the café. Saturday points at the woods, the
# dead tree is brown, four swings leave a stump and logs in the sack.


static func run(host: Node) -> void:
	var gs: Node = host.get_node("/root/GameState")
	assert(gs.day_index == 1)
	assert(not gs.forest_morning())
	gs.take_item("learning_card")
	var elder := WorldManager.world_root.entities["elder"] as Npc
	elder.morning_done = true
	var arrow: Node = host.get_node("/root/WaypointHud")
	assert(arrow.current_id() == "dragons_brew")

	gs.day_index = 2
	gs._sync_clock()
	assert(gs.weekday == "Tuesday")
	assert(not gs.forest_morning())
	assert(not gs.wood_chore_open())
	assert(arrow.current_id() == "dragons_brew")
	_assert_goodbye(host, false)

	gs.day_index = 6
	gs._sync_clock()
	assert(gs.weekday == "Saturday")
	assert(gs.forest_morning())
	assert(gs.wood_chore_open())
	assert(arrow.current_id() == "forest_clearing")

	var interiors: Node = host.get_node("/root/Interiors")
	interiors.enter_clearing("forest_clearing")
	assert(interiors.inside())
	var arrived := WorldManager.world_root.player as Player
	assert(arrived.facing.x < -0.5)
	var clearing: Node = interiors.current
	assert(clearing.tree_standing())
	var dead := clearing.get_node("Objects/dead_tree") as Node2D
	var living := clearing.get_node("Objects/clearing_tree_n0") as Node2D
	var dead_counts: Array = _needle_counts(dead)
	var live_counts: Array = _needle_counts(living)
	assert(dead_counts[0] > dead_counts[1])
	assert(live_counts[1] > live_counts[0])
	assert(clearing.get_node_or_null("Objects/outer_0") != null)

	var player := WorldManager.world_root.player as Player
	player.global_position = dead.global_position + Vector2(0, 28)
	player.facing = Vector2.UP
	player._refresh_held()
	var held := player.get_node("Held") as Sprite2D
	assert(held.visible)
	assert(clearing.chop_ready(player.global_position, player.facing))
	for _i in 4:
		player._attacking = false
		player.swing()
	assert(not clearing.tree_standing())
	assert(clearing.get_node_or_null("Objects/stump") != null)
	assert(gs.wood_cut_today())
	assert(gs.has_item("logs"))
	assert(not gs.wood_chore_open())
	assert(arrow.current_id() == "dragons_brew")
	player._refresh_held()
	assert(held.visible)
	DialogueUI.close()
	await _walk_forest_mouth(host, player, interiors, clearing)
	assert(gs.day_index == 6)
	_assert_goodbye(host, true)
	print("forest chop: ok")
	host.get_tree().quit()


## Off the village's left edge, into the east side of the woods, then back to that gap.
static func _walk_forest_mouth(host: Node, player: Player, interiors: Node, _clearing: Node) -> void:
	var shade := load("res://world/shade_path.gd")
	await host.get_tree().create_timer(0.6).timeout
	player.global_position = shade.center_of(Vector2i(44, 14))
	player.velocity = Vector2.ZERO
	player.agent_input = Vector2.RIGHT
	var left := false
	for _i in 180:
		await host.get_tree().physics_frame
		if not interiors.inside():
			left = true
			break
	player.agent_input = Vector2.ZERO
	assert(left)
	var back: Vector2 = interiors._return_from_forest()
	assert(player.global_position.distance_to(back) < 20.0)
	assert(player.facing.x > 0.5)
	await host.get_tree().create_timer(0.6).timeout
	player.global_position = shade.center_of(Vector2i(2, 8))
	player.velocity = Vector2.ZERO
	player.agent_input = Vector2.LEFT
	var entered := false
	for _i in 180:
		await host.get_tree().physics_frame
		if interiors.inside():
			entered = true
			break
	player.agent_input = Vector2.ZERO
	assert(entered)
	assert(player.facing.x < -0.5)
	var woods: Node = interiors.current
	assert(player.global_position.x > woods.room.x * 16 * 0.6)
	player.agent_input = Vector2.RIGHT
	var back_out := false
	for _i in 180:
		await host.get_tree().physics_frame
		if not interiors.inside():
			back_out = true
			break
	player.agent_input = Vector2.ZERO
	assert(back_out)
	assert(player.global_position.distance_to(back) < 24.0)
	assert(player.facing.x > 0.5)


## Goodbye still lets you out. The chilly line is Saturday only, after the nod.
static func _assert_goodbye(host: Node, wood_day: bool) -> void:
	var cafe: Node = host.get_node("/root/CafeOrder")
	cafe.reset_session()
	cafe.taken = true
	cafe._drink = "café"
	cafe._food = "muffin"
	cafe.served = PackedStringArray(["café", "muffin"])
	cafe.cup_left = 0
	cafe.muffin_left = 0
	cafe._mark_meal_if_done()
	var phrase := "Adiós, y buenas noches" if GameState.day_index >= 2 else "Adiós, and buenas noches"
	cafe.use_dish_cart()
	var said: String = cafe.reply_for(phrase)
	assert(cafe.goodbye_done, said)
	assert(cafe.may_leave())
	assert(said.begins_with("Mara smiles and nods."))
	if wood_day:
		assert(said.contains("chilly tonight"))
		assert(said.contains("light the fire"))
	else:
		assert(said == "Mara smiles and nods.")
	# The check is about the line, not ending the day.
	GameState.cafe_meal_done = false


static func _needle_counts(node: Node2D) -> Array:
	var sprite := node.get_node("Sprite") as Sprite2D
	var img := sprite.texture.get_image()
	var brown := 0
	var green := 0
	for y in range(0, img.get_height(), 2):
		for x in range(0, img.get_width(), 2):
			var c := img.get_pixel(x, y)
			if c.a < 0.5:
				continue
			if c.g > c.r + 0.08 and c.g > c.b:
				green += 1
			elif c.r > c.g and c.g > c.b and c.r > 0.12:
				brown += 1
	return [brown, green]
