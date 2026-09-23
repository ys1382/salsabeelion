extends RefCounted
# Run from the real game: godot --path . -- --check-forest
# Monday still points at the café. Tuesday points at the woods, the dead
# tree is brown, four swings leave a stump and logs in hand.


static func run(host: Node) -> void:
	var gs: Node = host.get_node("/root/GameState")
	assert(gs.day_index == 1)
	assert(not gs.forest_morning())
	gs.take_item("learning_card")
	var arrow: Node = host.get_node("/root/WaypointHud")
	assert(arrow.current_id() == "dragons_brew")

	gs.day_index = 2
	gs._sync_clock()
	assert(gs.weekday == "Tuesday")
	assert(gs.forest_morning())
	assert(gs.wood_chore_open())
	assert(arrow.current_id() == "forest_clearing")

	var interiors: Node = host.get_node("/root/Interiors")
	interiors.enter_clearing("forest_clearing")
	assert(interiors.inside())
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
	print("forest chop: ok")
	host.get_tree().quit()


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
