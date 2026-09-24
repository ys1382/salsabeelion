extends RefCounted
# godot --path . --headless -- --check-talk-face
# Two people face each other for the whole panel. Feet do not move.
# A sign does not turn anyone. After close, the other person faces as before.


static func run(host: Node) -> void:
	var interiors: Node = host.get_node("/root/Interiors")
	interiors.enter("dragons_brew")
	await host.get_tree().physics_frame
	await host.get_tree().physics_frame
	var player := WorldManager.world_root.player as Player
	var mara := _npc(host, "mara")
	var before_mara := mara.facing
	var feet := mara.global_position + Vector2(-28, 6)
	player.global_position = feet
	player.facing = Vector2.DOWN
	var player_at := player.global_position
	var mara_at := mara.global_position

	player._talk_npc(mara)
	await host.get_tree().physics_frame
	await _expect(host, DialogueUI.is_open(), "Mara talk did not open")
	await _expect(host, _looks_at(player.facing, mara.global_position - player.global_position),
		"player did not face Mara: %s" % player.facing)
	await _expect(host, _looks_at(mara.facing, player.global_position - mara.global_position),
		"Mara did not face the player: %s" % mara.facing)
	await _expect(host, not mara._sprite.flip_h,
		"Mara looked away on the side view")
	player.agent_input = Vector2.LEFT
	for _i in 200:
		await host.get_tree().physics_frame
	await _expect(host, player.global_position.distance_to(player_at) < 1.0,
		"player walked during talk: %s" % player.global_position)
	await _expect(host, mara.global_position.distance_to(mara_at) < 1.0,
		"Mara walked during talk: %s" % mara.global_position)
	await _expect(host, _looks_at(mara.facing, player.global_position - mara.global_position),
		"Mara looked away during the panel: %s" % mara.facing)
	await _expect(host, _looks_at(player.facing, mara.global_position - player.global_position),
		"player looked away during the panel: %s" % player.facing)

	DialogueUI.close()
	player._after_panel_close()
	await host.get_tree().physics_frame
	await _expect(host, not DialogueUI.is_open(), "panel stayed open")
	await _expect(host, mara.facing.dot(before_mara) > 0.9,
		"Mara did not return to her old facing: %s vs %s" % [mara.facing, before_mara])

	var sign_face := player.facing
	DialogueUI.show_sign("House rules stay put.")
	await host.get_tree().physics_frame
	await _expect(host, player.facing.dot(sign_face) > 0.9, "a sign turned the player")
	DialogueUI.close()
	player._after_panel_close()

	var room: Node = interiors.current
	var seat := room.get_node("Objects/cafe_seat") as Node2D
	player.global_position = seat.global_position + Vector2(0, 18)
	player.sit_on(seat)
	var sat := player.global_position
	var spr := player._sprite.position
	player._talk_npc(mara)
	await host.get_tree().physics_frame
	await _expect(host, player.seated, "talk stood the player up")
	await _expect(host, player.global_position.distance_to(sat) < 1.0,
		"talk moved seated feet: %s" % player.global_position)
	await _expect(host, player._sprite.position.distance_to(spr) < 0.1,
		"talk moved the sit sprite")
	await _expect(host, _looks_at(mara.facing, player.global_position - mara.global_position),
		"seated talk did not turn Mara")
	DialogueUI.close()
	player._after_panel_close()
	player.stand_up()

	var elder := _npc(host, "elder")
	player.global_position = elder.global_position + Vector2(4, -22)
	player._talk_npc(elder)
	await host.get_tree().physics_frame
	await _expect(host, Sheet.facing_suffix(elder.facing)[0] != "up",
		"elder showed the back of their head: %s" % elder.facing)
	await _expect(host, _looks_side_toward(elder.facing, player.global_position.x - elder.global_position.x),
		"elder did not turn toward the player standing above: %s" % elder.facing)
	await _expect(host, elder._sprite.flip_h,
		"elder profile looked the same way as a right-facing stand")
	await _expect(host, Sheet.facing_suffix(player.facing)[0] != Sheet.facing_suffix(elder.facing)[0],
		"elder lined up with the player")
	DialogueUI.close()
	player._after_panel_close()
	print("talk-face check ok")
	host.get_tree().quit(0)


static func _looks_side_toward(facing: Vector2, x_to_player: float) -> bool:
	var got: Array = Sheet.facing_suffix(facing)
	if got[0] != "side":
		return false
	return bool(got[1]) == (x_to_player < 0.0)


static func _looks_at(facing: Vector2, toward: Vector2) -> bool:
	if facing.length_squared() < 0.0001 or toward.length_squared() < 0.0001:
		return false
	var got: Array = Sheet.facing_suffix(facing)
	var want: Array = Sheet.facing_suffix(toward)
	return got[0] == want[0] and got[1] == want[1]


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
