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
	await _expect(host, DialogueUI._hint.text == "T — Next",
		"unread menu should keep Mara talking: %s" % DialogueUI._hint.text)
	var hello := DialogueUI.body()
	await _expect(host, player._try_close("T"), "T did not reach the menu line")
	await host.get_tree().physics_frame
	await _expect(host, DialogueUI.is_open(), "menu line closed early")
	await _expect(host, DialogueUI.body() != hello, "menu line did not show")
	await _expect(host, DialogueUI._hint.text == "T — Close",
		"menu line should close so you can go read it: %s" % DialogueUI._hint.text)
	await _expect(host, _looks_at(mara.facing, player.global_position - mara.global_position),
		"Mara looked away on the menu line")

	await _expect(host, player._try_close("T"), "menu line did not close")
	await host.get_tree().physics_frame
	await _expect(host, not DialogueUI.is_ordering(), "menu line opened the order box")
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

	# Menu already read: hello continues into the order, and that last box
	# still opens the type box.
	CafeOrder.intro_done = false
	GameState.reveal("menu_read")
	player.global_position = mara.global_position + Vector2(-28, 6)
	player._talk_npc(mara)
	await host.get_tree().physics_frame
	await _expect(host, DialogueUI._hint.text == "T — Next",
		"menu-first hello closed: %s" % DialogueUI._hint.text)
	await _expect(host, player._try_close("T"), "T did not reach the order")
	await host.get_tree().physics_frame
	await _expect(host, DialogueUI.is_open(), "order line closed early")
	await _expect(host, DialogueUI.body().contains("order"),
		"order line missing: %s" % DialogueUI.body())
	await _expect(host, DialogueUI._hint.text == "T — Close",
		"order line should close: %s" % DialogueUI._hint.text)
	await _expect(host, player._try_close("T"), "order line did not close")
	await host.get_tree().physics_frame
	await _expect(host, DialogueUI.is_ordering(), "order line did not open the type box")
	DialogueUI.close()
	player._after_panel_close()

	var elder := _npc(host, "elder")
	var elder_before := elder.facing
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
	var arrow: Node = host.get_node("/root/WaypointHud")
	var tasks: Node = host.get_node("/root/TaskList")
	var first := DialogueUI.body()
	await _expect(host, arrow.current_id() == "elder",
		"arrow left the elder on the first line: %s" % arrow.current_id())
	await _expect(host, _task_now(tasks) == "Talk to the elder",
		"talk step left early: %s" % _task_now(tasks))
	await _expect(host, DialogueUI._hint.text == "T — Next",
		"first box offered close: %s" % DialogueUI._hint.text)
	await _expect(host, not player._try_close("R"), "R dismissed a middle box")
	await _expect(host, not player._try_close("E"), "E dismissed a middle box")
	await _expect(host, DialogueUI.is_open() and DialogueUI.body() == first,
		"R or E changed the first box")
	await _expect(host, player._try_close("T"), "T did not advance")
	await host.get_tree().physics_frame
	await _expect(host, DialogueUI.is_open(), "first box closed the talk")
	await _expect(host, DialogueUI.body() != first, "T did not show the next line")
	await _expect(host, _looks_side_toward(elder.facing, player.global_position.x - elder.global_position.x),
		"elder looked away on the next box: %s" % elder.facing)
	await _expect(host, _looks_at(player.facing, elder.global_position - player.global_position),
		"player looked away on the next box: %s" % player.facing)
	var guard := 0
	while DialogueUI._hint.text != "T — Close" and guard < 12:
		await _expect(host, player._try_close("T"), "could not reach the last box")
		await _expect(host, DialogueUI.is_open(), "closed before the last box")
		guard += 1
	await _expect(host, DialogueUI._hint.text == "T — Close",
		"last box did not offer close: %s" % DialogueUI._hint.text)
	await _expect(host, arrow.current_id() == "elder",
		"arrow left the elder while the last line was still up: %s" % arrow.current_id())
	await _expect(host, _task_now(tasks) == "Talk to the elder",
		"talk step finished before the last line closed: %s" % _task_now(tasks))
	GameState.take_item("learning_card")
	await _expect(host, arrow.current_id() == "elder",
		"an early card moved the arrow: %s" % arrow.current_id())
	GameState.inventory.erase("learning_card")
	await _expect(host, player._try_close("T"), "last box did not close")
	await host.get_tree().physics_frame
	await _expect(host, not DialogueUI.is_open(), "last box stayed open")
	await _expect(host, elder.facing.dot(elder_before) > 0.9,
		"elder did not turn back after the talk: %s vs %s" % [elder.facing, elder_before])
	await _expect(host, elder.morning_done, "morning talk did not count as finished")
	await _expect(host, arrow.current_id() == "card_basket",
		"arrow did not move to the basket: %s" % arrow.current_id())
	await _expect(host, _task_now(tasks) == "Take the card",
		"take-the-card did not become the step: %s" % _task_now(tasks))
	interiors.leave()
	await host.get_tree().physics_frame
	GameState.take_item("learning_card")
	await _expect(host, arrow.current_id() == "dragons_brew",
		"card did not point at the café: %s" % arrow.current_id())
	GameState.day_index = 8
	ElderReport.done = false
	await _expect(host, arrow.current_id() == "elder",
		"day 8 did not point at the elder: %s" % arrow.current_id())
	print("talk-face check ok")
	host.get_tree().quit(0)


static func _task_now(tasks: Node) -> String:
	for step in tasks._steps():
		if str(step.get("state", "")) == "now":
			return str(step.get("text", ""))
	return ""


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
