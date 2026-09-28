extends RefCounted
# godot --path . --headless -- --check-golden-apple
# Gold dots stay on the tree beside the elder's house. Saturday of week one
# puts golden apple pie on the board instead of the cookie, once.


static func run(host: Node) -> void:
	var gs: Node = host.get_node("/root/GameState")
	var cafe: Node = host.get_node("/root/CafeOrder")
	var rooms: Node = host.get_node("/root/Interiors")
	gs.skip_to_morning(6)
	await host.get_tree().process_frame
	var root: Node = WorldManager.world_root
	var apple := root.entities["border_tree_s2"] as Node2D
	var plum := root.entities["sugarplum_tree"] as Node2D
	var bush := root.entities["border_bush_elder_a"] as Node2D
	await _expect(host, _gold_count(apple) > 8, "no gold dots on the tree by her house")
	await _expect(host, not _has_meta(plum, "apple_tex"), "gold dots landed on the sugarplum tree")
	await _expect(host, not _has_meta(bush, "apple_tex"), "gold dots landed on a bush")

	var board: String = cafe.board_text()
	await _expect(host, board.contains("golden apple pie"), board)
	await _expect(host, board.contains("24 pesos"), board)
	await _expect(host, not board.contains("galleta") and not board.contains("cookie"), board)
	await _expect(host, not board.contains("tart"), board)

	rooms.enter("dragons_brew")
	await host.get_tree().physics_frame
	await host.get_tree().physics_frame
	await _expect(host, rooms.inside() and rooms.current.building_id == "dragons_brew",
		"did not walk into the café")
	var player := root.player as Player
	await _stand(host, player, Vector2(120, 103))
	await _expect(host, player.focus is Npc and (player.focus as Npc).npc_id == "mara",
		"the counter no longer faces Mara")
	# From the door, step right of the counter and walk up to the board.
	# The strike board is on the far left, so a path under x 90 went around it.
	await _stand(host, player, Vector2(120, 150))
	var min_x := await _walk(host, player, [Vector2(148, 140), Vector2(148, 64)])
	await _expect(host, min_x > 90.0, "the walk still goes around the strike board")
	await _expect(host, player.global_position.distance_to(Vector2(148, 64)) < 18.0,
		"could not walk past the counter to the menu: %s" % player.global_position)
	await _expect(host, player.focus is Interactable \
			and str((player.focus as Interactable).data.get("id", "")) == "drink_menu",
		"cannot read the menu from the open aisle: %s" % player.global_position)
	var inside_board: String = cafe.board_text()
	await _expect(host, inside_board.contains("golden apple pie") and not inside_board.contains("galleta"),
		inside_board)
	rooms.leave()
	await host.get_tree().physics_frame
	await _expect(host, not rooms.inside(), "did not walk back out of the café")

	cafe.reset_session()
	gs.card_balance = 400
	var pie: String = cafe.reply_for("un café y golden apple pie")
	await _expect(host, pie.contains("59 pesos"), pie)
	await _expect(host, pie.contains("golden apple pie"), pie)
	await _expect(host, not pie.contains("una golden") and not pie.contains("un golden"), pie)
	await _expect(host, not pie.contains("y  golden"), pie)
	await _expect(host, int(gs.card_balance) == 341, pie)
	await _expect(host, _gold_count(apple) > 8, "gold dots left the tree after the pie")

	gs.day_index = 5
	gs._sync_clock()
	var friday: String = cafe.board_text()
	await _expect(host, friday.contains("galleta") and friday.contains("cookie"), friday)
	await _expect(host, not friday.contains("golden apple"), friday)

	gs.day_index = 7
	gs._sync_clock()
	var sunday: String = cafe.board_text()
	await _expect(host, sunday.contains("sugarplum juice"), sunday)
	await _expect(host, sunday.contains("galleta"), sunday)
	await _expect(host, not sunday.contains("espresso"), sunday)
	await _expect(host, not sunday.contains("golden apple"), sunday)

	print("golden apple: ok")
	host.get_tree().quit()


static func _walk(host: Node, player: Player, spots: Array) -> float:
	var min_x := player.global_position.x
	for spot in spots:
		var goal: Vector2 = spot
		for _step in 120:
			var delta := goal - player.global_position
			if delta.length() < 6.0:
				break
			player.agent_input = delta.normalized()
			await host.get_tree().physics_frame
			min_x = minf(min_x, player.global_position.x)
		player.agent_input = Vector2.ZERO
		player.velocity = Vector2.ZERO
	await host.get_tree().physics_frame
	player._update_focus()
	return min_x


static func _stand(host: Node, player: Player, at: Vector2) -> void:
	player.agent_input = Vector2.ZERO
	player.velocity = Vector2.ZERO
	player.global_position = at
	await host.get_tree().physics_frame
	player._update_focus()


static func _has_meta(node: Node2D, key: String) -> bool:
	var sprite := node.get_node_or_null("Sprite") as Sprite2D
	return sprite != null and sprite.has_meta(key)


static func _gold_count(tree: Node2D) -> int:
	var sprite := tree.get_node_or_null("Sprite") as Sprite2D
	if sprite == null or sprite.texture == null:
		return 0
	var img := sprite.texture.get_image()
	if img == null:
		return 0
	var n := 0
	for y in img.get_height():
		for x in img.get_width():
			var c := img.get_pixel(x, y)
			if c.a > 0.9 and c.r > 0.9 and c.g > 0.65 and c.g < 0.85 and c.b < 0.3:
				n += 1
	return n


static func _expect(host: Node, ok: bool, msg: String) -> void:
	if ok:
		return
	push_error(msg)
	host.get_tree().quit(1)
	await host.get_tree().create_timer(30.0).timeout
