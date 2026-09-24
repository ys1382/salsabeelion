extends RefCounted
# godot --path . --headless -- --check-cafe-arrow
# First step inside points at the menu, then Mara. After the order, one
# arrow points at the next unheard person, then the next, then Mara again,
# then the chair once the food is in hand. No mark over a head.


static func run(host: Node) -> void:
	var interiors: Node = host.get_node("/root/Interiors")
	var arrow: Node = host.get_node("/root/WaypointHud")
	var player := WorldManager.world_root.player as Player
	if Journal.is_open():
		Journal.dismiss()

	interiors.enter("dragons_brew")
	await host.get_tree().physics_frame
	await host.get_tree().physics_frame
	var room: Node = interiors.current
	var menu := room.get_node("Objects/drink_menu") as Node2D
	await _expect(host, arrow.current_id() == "drink_menu",
		"first step did not point at the menu: %s" % arrow.current_id())
	await _aim_at(host, player, arrow, menu, "drink_menu")
	GameState.reveal("menu_read")
	await host.get_tree().process_frame
	var mara := _npc(host, "mara")
	await _expect(host, arrow.current_id() == "mara",
		"menu did not hand the arrow to Mara: %s" % arrow.current_id())
	await _stand_on(host, player, arrow, mara)

	CafeOrder.awaiting_serve = true
	CafeOrder.called_out = false
	CafeOrder.clear_table_rounds()

	var first := str(arrow.current_id())
	var first_npc := _npc(host, first)
	await _expect(host, first_npc != null, "first stop is not a person: %s" % first)
	await _stand_on(host, player, arrow, first_npc)

	CafeOrder.note_guest_spoke(first, "", true)
	var second := str(arrow.current_id())
	await _expect(host, second != "" and second != first,
		"arrow stayed on %s after that talk" % first)
	await _expect(host, second != "mara", "arrow jumped to Mara early")
	var second_npc := _npc(host, second)
	await _expect(host, second_npc != null, "next stop is not a person: %s" % second)
	await _stand_on(host, player, arrow, second_npc)

	CafeOrder.note_guest_spoke(second, "", true)
	await host.get_tree().process_frame
	await _expect(host, arrow.current_id() == "mara",
		"arrow did not return to Mara: %s" % arrow.current_id())
	await _stand_on(host, player, arrow, mara)
	CafeOrder.awaiting_serve = false
	CafeOrder.taken = true
	CafeOrder.cup_left = 4
	CafeOrder.muffin_left = 3
	await host.get_tree().process_frame
	var seat := room.get_node("Objects/cafe_seat") as Node2D
	await _expect(host, arrow.current_id() == "cafe_seat",
		"food did not point at the chair: %s" % arrow.current_id())
	await _aim_at(host, player, arrow, seat, "cafe_seat")

	print("cafe arrow: ok")
	host.get_tree().quit()


static func _stand_on(host: Node, player: Player, arrow: Node, person: Npc) -> void:
	player.set_physics_process(false)
	var spot := person.global_position + Vector2(56, 40)
	player.global_position = spot
	player.velocity = Vector2.ZERO
	for _i in 20:
		player.global_position = spot
		await host.get_tree().process_frame
	var id := str(arrow.current_id())
	await _expect(host, id == person.npc_id, "arrow left %s for %s" % [person.npc_id, id])
	await _expect(host, arrow.get_child_count() == 2, "a second mark is still on the hud")
	await _expect(host, arrow._arrow.visible, "the screen arrow is hidden")
	var aim: Vector2 = arrow._target_pos(id)
	await _expect(host, aim.distance_to(person.global_position) < 1.0,
		"arrow is not on %s" % person.npc_id)
	var cam := player.get_node("Camera") as Camera2D
	var xform := cam.get_canvas_transform()
	var screen_person := xform * person.global_position
	var screen_player := xform * player.global_position
	var point := screen_person - screen_player
	await _expect(host, point.length_squared() > 36.0, "standing on the person")
	point = point.normalized()
	var dock := screen_person - point * 72.0
	var head := xform * (person.global_position + Vector2(0, -34))
	await _expect(host, arrow._arrow.position.distance_to(dock) < 24.0,
		"arrow did not sit on %s (got %s want %s)" % [person.display_name, arrow._arrow.position, dock])
	await _expect(host, arrow._arrow.position.distance_to(head) > 20.0,
		"arrow is a mark over %s" % person.display_name)
	var want := point.angle() + PI * 0.5
	await _expect(host, absf(angle_difference(arrow._draw_rot, want)) < 0.45,
		"arrow does not point at %s" % person.display_name)
	player.set_physics_process(true)


static func _aim_at(host: Node, player: Player, arrow: Node, spot: Node2D, want_id: String) -> void:
	player.set_physics_process(false)
	var stand := spot.global_position + Vector2(56, 40)
	player.global_position = stand
	player.velocity = Vector2.ZERO
	for _i in 20:
		player.global_position = stand
		await host.get_tree().process_frame
	var id := str(arrow.current_id())
	await _expect(host, id == want_id, "arrow left %s for %s" % [want_id, id])
	await _expect(host, arrow.get_child_count() == 2, "a second mark is still on the hud")
	await _expect(host, arrow._arrow.visible, "the screen arrow is hidden")
	var aim: Vector2 = arrow._target_pos(id)
	await _expect(host, aim.distance_to(spot.global_position) < 1.0,
		"arrow is not on %s" % want_id)
	var cam := player.get_node("Camera") as Camera2D
	var xform := cam.get_canvas_transform()
	var screen_spot := xform * spot.global_position
	var screen_player := xform * player.global_position
	var point := screen_spot - screen_player
	await _expect(host, point.length_squared() > 36.0, "standing on %s" % want_id)
	point = point.normalized()
	var dock := screen_spot - point * 72.0
	await _expect(host, arrow._arrow.position.distance_to(dock) < 24.0,
		"arrow did not sit on %s (got %s want %s)" % [want_id, arrow._arrow.position, dock])
	var want := point.angle() + PI * 0.5
	await _expect(host, absf(angle_difference(arrow._draw_rot, want)) < 0.45,
		"arrow does not point at %s" % want_id)
	player.set_physics_process(true)


static func _npc(host: Node, id: String) -> Npc:
	for n in host.get_tree().get_nodes_in_group("npc"):
		if (n as Npc).npc_id == id:
			return n as Npc
	return null


static func _expect(host: Node, ok: bool, msg: String) -> void:
	if ok:
		return
	push_error(msg)
	host.get_tree().quit(1)
	await host.get_tree().create_timer(30.0).timeout
