extends RefCounted
# Run from the real game: godot --path . -- --check-forest
# Monday points at the café. Tuesday leaves home toward the woods, P picks
# blueberries once, then the arrow goes on to the café. Saturday still cuts
# the dead tree into the sack.


static func run(host: Node) -> void:
	var gs: Node = host.get_node("/root/GameState")
	assert(gs.day_index == 1)
	assert(not gs.forest_morning())
	gs.take_item("learning_card")
	var elder := WorldManager.world_root.entities["elder"] as Npc
	elder.morning_done = true
	var arrow: Node = host.get_node("/root/WaypointHud")
	assert(arrow.current_id() == "dragons_brew")

	for other in [3, 4, 5, 7]:
		gs.day_index = other
		gs._sync_clock()
		assert(not gs.berry_morning())
		assert(not gs.berry_chore_open())
		assert(arrow.current_id() != "berry_patch")
		assert(not gs.forest_morning())

	gs.day_index = 2
	gs._sync_clock()
	assert(gs.weekday == "Tuesday")
	assert(gs.berry_morning())
	assert(not gs.forest_morning())
	assert(not gs.wood_chore_open())
	assert(not gs.carrying_sack())
	assert(gs.berry_chore_open())
	assert(arrow.current_id() == "berry_patch")
	_assert_goodbye(host, false)

	var interiors: Node = host.get_node("/root/Interiors")
	var player := WorldManager.world_root.player as Player
	interiors.enter("player_house", "")
	assert(interiors.inside())
	interiors.leave()
	assert(not interiors.inside())
	var mouth: Vector2 = interiors.forest_mouth_position()
	assert(mouth.x < player.global_position.x)
	assert(arrow.current_id() == "berry_patch")

	interiors.enter_clearing("forest_clearing")
	assert(interiors.inside())
	assert(player.facing.x < -0.5)
	var clearing: Node = interiors.current
	var bush := clearing.get_node("Objects/berry_bush_0") as Node2D
	var living := clearing.get_node("Objects/clearing_tree_n0") as Node2D
	var bush_sprite := bush.get_node("Sprite") as Sprite2D
	var tree_sprite := living.get_node("Sprite") as Sprite2D
	assert(bush.scale.is_equal_approx(Vector2.ONE))
	var bw := bush_sprite.texture.get_width()
	var bh := bush_sprite.texture.get_height()
	var th := tree_sprite.texture.get_height()
	assert(bw >= 24 and bw <= 48)
	assert(bh >= 20 and bh < int(float(th) * 0.65))
	assert(_blue_dots(bush) > 0)
	var tuft := clearing.get_node("Objects/clearing_bush_0") as Node2D
	assert(_blue_dots(tuft) == 0)

	player.global_position = bush.global_position + Vector2(0, 28)
	player.facing = Vector2.UP
	player._refresh_held()
	var held := player.get_node("Held") as Sprite2D
	assert(not held.visible)
	assert(clearing.berry_ready(player.global_position, player.facing))
	var press := InputEventKey.new()
	press.keycode = KEY_P
	press.pressed = true
	player._unhandled_input(press)
	assert(gs.blueberries == 4)
	assert(not gs.bush_has_berries("berry_bush_0"))
	assert(_blue_dots(bush) == 0)
	var hud: Node = host.get_node("/root/Hud")
	hud._process(0.0)
	assert(str(hud.berry_count.text).ends_with("4"))
	player._unhandled_input(press)
	assert(gs.blueberries == 4)
	player._refresh_held()
	assert(not held.visible)
	assert(not gs.carrying_sack())
	for bush_id in ["berry_bush_1", "berry_bush_2"]:
		var other_bush := clearing.get_node("Objects/" + bush_id) as Node2D
		player.global_position = other_bush.global_position + Vector2(0, 28)
		player.facing = Vector2.UP
		assert(player.try_pick())
	assert(gs.blueberries == 12)
	assert(not gs.berry_chore_open())
	assert(arrow.current_id() == "dragons_brew")
	var out_aim: Vector2 = arrow._exit_aim(arrow._target_pos("dragons_brew"))
	assert(out_aim.x > 0.5)
	assert(absf(out_aim.y) < 0.2)
	DialogueUI.close()
	interiors.leave()
	assert(not interiors.inside())
	interiors._travel_ready_at = 0

	gs.day_index = 6
	gs._sync_clock()
	assert(gs.weekday == "Saturday")
	assert(gs.forest_morning())
	assert(gs.wood_chore_open())
	assert(arrow.current_id() == "forest_clearing")

	interiors.enter_clearing("forest_clearing")
	assert(interiors.inside())
	assert(player.facing.x < -0.5)
	clearing = interiors.current
	assert(clearing.tree_standing())
	var dead := clearing.get_node("Objects/dead_tree") as Node2D
	living = clearing.get_node("Objects/clearing_tree_n0") as Node2D
	var dead_counts: Array = _needle_counts(dead)
	var live_counts: Array = _needle_counts(living)
	assert(dead_counts[0] > dead_counts[1])
	assert(live_counts[1] > live_counts[0])
	assert(clearing.get_node_or_null("Objects/outer_0") != null)

	player.global_position = dead.global_position + Vector2(0, 28)
	player.facing = Vector2.UP
	player._refresh_held()
	held = player.get_node("Held") as Sprite2D
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


static func _blue_dots(node: Node2D) -> int:
	var sprite := node.get_node("Sprite") as Sprite2D
	var img := sprite.texture.get_image()
	var n := 0
	for y in range(0, img.get_height(), 1):
		for x in range(0, img.get_width(), 1):
			var c := img.get_pixel(x, y)
			if c.a < 0.5:
				continue
			if c.b > c.g + 0.12 and c.b > c.r + 0.12:
				n += 1
	return n


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
