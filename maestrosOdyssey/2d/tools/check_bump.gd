extends RefCounted
# godot --path . --headless -- --check-bump
# A short press bumps a person. Holding slides around their side. A table, a crate,
# and a wall never slip. The café aisle from the door to the back stays open.
# Standing up leaves you in front of the chair.


static func run(host: Node) -> void:
	var interiors: Node = host.get_node("/root/Interiors")
	interiors.enter("dragons_brew")
	await host.get_tree().physics_frame
	await host.get_tree().physics_frame
	var room: Node = interiors.current
	var player := WorldManager.world_root.player as Player
	var table := room.get_node("Objects/cafe_table") as Node2D
	var cart := room.get_node("Objects/dish_cart") as Node2D
	var seat := room.get_node("Objects/cafe_seat") as Node2D
	var mara := _npc(host, "mara")

	await _hold(host, player, table.global_position + Vector2(0, 28), Vector2.UP, 70)
	await _expect(host, player.global_position.y > table.global_position.y,
		"table slipped: %s vs %s" % [player.global_position, table.global_position])

	await _hold(host, player, cart.global_position + Vector2(0, 24), Vector2.UP, 70)
	await _expect(host, player.global_position.y > cart.global_position.y,
		"crate slipped: %s vs %s" % [player.global_position, cart.global_position])

	await _place(host, player, mara.global_position + Vector2(0, 22))
	player.agent_input = Vector2.UP
	for _i in 8:
		await host.get_tree().physics_frame
	await _expect(host, player.global_position.y > mara.global_position.y,
		"short press walked through Mara: %s" % player.global_position)
	var closest := 999.0
	for _i in 90:
		await host.get_tree().physics_frame
		closest = minf(closest, player.global_position.distance_to(mara.global_position))
	await _expect(host, closest >= 8.0,
		"walked through Mara, closest %s" % closest)
	await _expect(host, player.global_position.y < mara.global_position.y \
			and absf(player.global_position.x - mara.global_position.x) > 8.0,
		"did not slide past Mara's side: %s mara %s" % [player.global_position, mara.global_position])

	await _place(host, player, seat.global_position + Vector2(0, 18))
	var gap := _gap_mid(table, seat)
	player.sit_on(seat)
	await _expect(host, player.seated and player.global_position.distance_to(gap) < 2.0,
		"not midway between chair and table: %s gap %s" % [player.global_position, gap])
	await _expect(host, seat.z_index < 0,
		"chair can still paint over the head")
	player.stand_up()
	await _expect(host, seat.z_index == 0, "chair draw order stuck behind")
	for _i in 8:
		await host.get_tree().physics_frame
	await _expect(host, player.global_position.y > seat.global_position.y,
		"chair drew over the player: %s seat %s" % [player.global_position, seat.global_position])

	var door: Vector2 = room.entry_point()
	await _hold(host, player, door, Vector2.UP, 180)
	await _expect(host, player.global_position.y > 4.0 and player.global_position.y < 32.0,
		"door-to-counter walk stopped at %s" % player.global_position)

	var spots := [Vector2(100, 120), Vector2(120, 120), Vector2(140, 120)]
	var used := 0
	for n in host.get_tree().get_nodes_in_group("npc"):
		if used >= spots.size():
			break
		(n as Node2D).global_position = spots[used]
		used += 1
	await _expect(host, used >= 3, "need three people for the crowd")
	await _hold(host, player, Vector2(120, 156), Vector2.UP, 200)
	await _expect(host, player.global_position.y < 90.0,
		"crowd jailed the player at %s" % player.global_position)

	var gs_wed: Node = host.get_node("/root/GameState")
	gs_wed.day_index = 3
	gs_wed._sync_clock()
	interiors.leave()
	await host.get_tree().physics_frame
	interiors.enter("dragons_brew")
	await host.get_tree().physics_frame
	await host.get_tree().physics_frame
	await _stand_by(host, player, "family_neighbor", Vector2(9 * 16 + 8, 3 * 16))
	await _stand_by(host, player, "family_aunt", Vector2(12 * 16 + 8, 4 * 16))
	await _stand_by(host, player, "family_brother", Vector2(9 * 16 + 8, 8 * 16))

	interiors.leave()
	await host.get_tree().physics_frame
	var gs: Node = host.get_node("/root/GameState")
	gs.day_index = 2
	gs._sync_clock()
	interiors.enter("dragons_brew")
	await host.get_tree().physics_frame
	await host.get_tree().physics_frame
	var tuesday: Node = interiors.current
	var extra := tuesday.get_node_or_null("Objects/cafe_tuesday_table") as Node2D
	await _expect(host, extra != null, "Tuesday table missing")
	await _hold(host, player, tuesday.entry_point(), Vector2.UP, 180)
	await _expect(host, player.global_position.y > 4.0 and player.global_position.y < 32.0,
		"Tuesday door-to-counter walk stopped at %s" % player.global_position)

	interiors.leave()
	await host.get_tree().physics_frame
	interiors.enter("player_house")
	await host.get_tree().physics_frame
	await host.get_tree().physics_frame
	var home: Node = interiors.current
	var crate := home.get_node("Objects/home_crate") as Node2D
	var home_seat := home.get_node_or_null("Objects/home_seat") as Node2D
	if home_seat != null:
		var home_table := home.get_node("Objects/home_table") as Node2D
		await _place(host, player, home_seat.global_position + Vector2(0, 18))
		var home_gap := _gap_mid(home_table, home_seat)
		player.sit_on(home_seat)
		await _expect(host, player.global_position.distance_to(home_gap) < 2.0,
			"not midway at home: %s gap %s" % [player.global_position, home_gap])
		await _expect(host, home_seat.z_index < 0, "home chair can paint over the head")
		player.stand_up()
	await _hold(host, player, crate.global_position + Vector2(0, 24), Vector2.UP, 70)
	await _expect(host, player.global_position.y > crate.global_position.y,
		"home crate slipped: %s" % player.global_position)
	await _hold(host, player, home.entry_point(), Vector2.UP, 160)
	await _expect(host, player.global_position.y < home.entry_point().y - 40.0,
		"house path sealed at %s" % player.global_position)

	print("bump: ok")
	host.get_tree().quit()


static func _stand_by(host: Node, player: Player, id: String, at: Vector2) -> void:
	var who := _npc(host, id)
	await _place(host, player, at)
	var nearest := player.global_position.distance_to(who.global_position)
	await _expect(host, nearest < 28.0 and nearest > 8.0,
		"cannot stand by %s at %s (dist %s)" % [id, player.global_position, nearest])


static func _npc(host: Node, id: String) -> Npc:
	for n in host.get_tree().get_nodes_in_group("npc"):
		if (n as Npc).npc_id == id:
			return n as Npc
	return null


static func _place(host: Node, player: Player, at: Vector2) -> void:
	player.agent_input = Vector2.ZERO
	player.velocity = Vector2.ZERO
	player._step_side = Vector2.ZERO
	player._push_held = 0.0
	player._push_dir = Vector2.ZERO
	player.collision_mask = player._walk_mask
	player.global_position = at
	await host.get_tree().physics_frame


static func _hold(host: Node, player: Player, at: Vector2, dir: Vector2, frames: int) -> void:
	await _place(host, player, at)
	player.agent_input = dir
	for _i in frames:
		await host.get_tree().physics_frame
	player.agent_input = Vector2.ZERO
	player.velocity = Vector2.ZERO


static func _gap_mid(table: Node2D, chair: Node2D) -> Vector2:
	var table_r := _prop_rect(table)
	var chair_r := _prop_rect(chair)
	var on_chair := Vector2(
		clampf(table_r.get_center().x, chair_r.position.x, chair_r.end.x),
		clampf(table_r.get_center().y, chair_r.position.y, chair_r.end.y))
	var on_table := Vector2(
		clampf(chair_r.get_center().x, table_r.position.x, table_r.end.x),
		clampf(chair_r.get_center().y, table_r.position.y, table_r.end.y))
	return (on_chair + on_table) * 0.5


static func _prop_rect(prop: Node2D) -> Rect2:
	var spr := prop.get_node_or_null("Sprite") as Sprite2D
	if spr == null or spr.texture == null:
		return Rect2()
	return Rect2(prop.global_position + spr.position, spr.texture.get_size())


static func _expect(host: Node, ok: bool, msg: String) -> void:
	if ok:
		return
	push_error(msg)
	host.get_tree().quit(1)
	await host.get_tree().create_timer(30.0).timeout
