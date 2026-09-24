extends RefCounted
# godot --path . --headless -- --check-cafe-arrow
# After the order, one screen arrow points at the next unheard person,
# then the next, then Mara once she has called. No mark over a head.


static func run(host: Node) -> void:
	var interiors: Node = host.get_node("/root/Interiors")
	var arrow: Node = host.get_node("/root/WaypointHud")
	var player := WorldManager.world_root.player as Player
	if Journal.is_open():
		Journal.dismiss()

	interiors.enter("dragons_brew")
	await host.get_tree().physics_frame
	await host.get_tree().physics_frame
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
	await _expect(host, arrow.current_id() != "mara",
		"arrow pointed at Mara before she called")
	CafeOrder.called_out = true
	await host.get_tree().process_frame
	var mara := _npc(host, "mara")
	await _expect(host, arrow.current_id() == "mara",
		"arrow did not move to Mara: %s" % arrow.current_id())
	await _stand_on(host, player, arrow, mara)

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
