extends RefCounted
# godot --path . --headless -- --check-door-arrow
# Indoors, with the next stop outside, the arrow stays on this room's door.
# It does not spin, and it does not chase the village. A stop already in the
# room (the dish cart) stays that stop. Outside, the elder is the target again.


static func run(host: Node) -> void:
	var interiors: Node = host.get_node("/root/Interiors")
	var arrow: Node = host.get_node("/root/WaypointHud")
	var player := WorldManager.world_root.player as Player
	if Journal.is_open():
		Journal.dismiss()

	interiors.enter("player_house")
	await host.get_tree().physics_frame
	await host.get_tree().physics_frame
	var home: Node = interiors.current
	var door := home.get_node("Objects/Doorway") as Node2D
	await _expect(host, arrow.current_id() == "elder",
		"house arrow label target changed: %s" % arrow.current_id())
	await _expect(host, arrow.marker_name(arrow.current_id()) == "Elder",
		"house label changed")
	await _walk_room(host, player, arrow, door)

	GameState.cafe_meal_done = true
	interiors.leave()
	await host.get_tree().physics_frame
	interiors.enter("dragons_brew")
	await host.get_tree().physics_frame
	await host.get_tree().physics_frame
	var cafe: Node = interiors.current
	var cafe_door := cafe.get_node("Objects/Doorway") as Node2D
	await _expect(host, arrow.current_id() == "player_house",
		"café exit arrow changed target: %s" % arrow.current_id())
	await _expect(host, arrow.marker_name("player_house") == "Home",
		"home label changed")
	await _walk_room(host, player, arrow, cafe_door)

	CafeOrder.carrying_dishes = true
	await host.get_tree().process_frame
	var cart := cafe.get_node("Objects/dish_cart") as Node2D
	var cart_at: Vector2 = arrow._target_pos(arrow.current_id())
	await _expect(host, arrow.current_id() == "dish_cart",
		"dishes did not keep the cart: %s" % arrow.current_id())
	await _expect(host, cart_at.distance_to(cart.global_position) < 1.0,
		"dish cart arrow left the cart")
	CafeOrder.carrying_dishes = false

	interiors.leave()
	await host.get_tree().physics_frame
	await host.get_tree().physics_frame
	await _expect(host, not interiors.inside(), "still indoors")
	await _expect(host, arrow.current_id() == "player_house",
		"outdoor arrow left home: %s" % arrow.current_id())
	var house := WorldManager.world_root.entities.get("player_house") as Node2D
	var outside_at: Vector2 = arrow._target_pos(arrow.current_id())
	await _expect(host, house != null and outside_at.distance_to(house.global_position) < 1.0,
		"outdoor arrow is not on the house")

	print("door arrow: ok")
	host.get_tree().quit()


static func _walk_room(host: Node, player: Player, arrow: Node, door: Node2D) -> void:
	player.set_physics_process(false)
	var spots := [
		door.global_position,
		door.global_position + Vector2(0, -40),
		door.global_position + Vector2(-80, -36),
		door.global_position + Vector2(80, -36),
		door.global_position + Vector2(0, -24),
	]
	for spot in spots:
		player.global_position = spot
		player.velocity = Vector2.ZERO
		for _warm in 40:
			player.global_position = spot
			player.velocity = Vector2.ZERO
			await host.get_tree().process_frame
		var spun := 0.0
		var prev: float = arrow._draw_rot
		var prev_pos: Vector2 = arrow._arrow.position
		var slipped := 0.0
		for _i in 10:
			player.global_position = spot
			player.velocity = Vector2.ZERO
			await host.get_tree().process_frame
			var aim: Vector2 = arrow._target_pos(arrow.current_id())
			await _expect(host, aim.distance_to(door.global_position) < 1.0,
				"arrow left the door for %s" % aim)
			var rot: float = arrow._draw_rot
			spun += absf(angle_difference(prev, rot))
			prev = rot
			slipped += arrow._arrow.position.distance_to(prev_pos)
			prev_pos = arrow._arrow.position
		await _expect(host, spun < 0.08,
			"arrow spun in place, turn %s at %s" % [spun, spot])
		await _expect(host, slipped < 8.0,
			"arrow jumped on the floor, slip %s at %s" % [slipped, spot])
		var delta := door.global_position - player.global_position
		if delta.length_squared() > 28.0 * 28.0:
			var want := Vector2.DOWN.angle() + PI * 0.5
			await _expect(host, absf(angle_difference(arrow._draw_rot, want)) < 0.2,
				"arrow swung off the door, rot %s want %s at %s" % [arrow._draw_rot, want, spot])
	player.set_physics_process(true)


static func _expect(host: Node, ok: bool, msg: String) -> void:
	if ok:
		return
	push_error(msg)
	host.get_tree().quit(1)
	await host.get_tree().create_timer(30.0).timeout
