extends RefCounted
# godot --path . --headless -- --check-slots
# 1 holds out slot 1. 2 holds out slot 2. P stores into the open crate or
# barrel and empties the hands. P on a stored stack brings it back.
# The learning card never goes into either container.


static func run(host: Node) -> void:
	var gs: Node = host.get_node("/root/GameState")
	var hud: Node = host.get_node("/root/Hud")
	var player := WorldManager.world_root.player as Player
	var held := player.get_node("Held") as Sprite2D
	var interiors: Node = host.get_node("/root/Interiors")
	if Journal.is_open():
		Journal.dismiss()
	gs.take_item("learning_card")
	gs.blueberries = 4
	gs.logs = 2
	if not gs.has_item("logs"):
		gs.take_item("logs")
	hud._process(0.0)
	assert(str((hud._carry_buttons[0].get_node("Mark") as Label).text) == "1")
	assert(str((hud._carry_buttons[1].get_node("Mark") as Label).text) == "2")
	assert(str((hud._carry_buttons[0].get_node("Count") as Label).text) == "4")
	assert(str((hud._carry_buttons[1].get_node("Count") as Label).text) == "2")

	var one := _key(KEY_1)
	var two := _key(KEY_2)
	var place := _key(KEY_P)
	player._unhandled_input(one)
	player._refresh_held()
	assert(gs.held_slot == 0)
	assert(held.visible)
	assert(held.texture == hud.icon_for("blueberries"))
	hud._process(0.0)
	_assert_bright(hud._carry_buttons[0], true)
	_assert_bright(hud._carry_buttons[1], false)

	player._unhandled_input(two)
	player._refresh_held()
	assert(gs.held_slot == 1)
	assert(held.texture == hud.icon_for("logs"))
	hud._process(0.0)
	_assert_bright(hud._carry_buttons[1], true)

	gs.logs = 0
	player._refresh_held()
	assert(not held.visible)
	gs.logs = 2

	interiors.enter("player_house", "")
	var home: Node = interiors.current
	await _stand_at(host, player, home.get_node("Objects/home_crate") as Node2D)
	assert(str((player.focus as Interactable).data.get("id", "")) == "home_crate_look")
	player._unhandled_input(one)
	_use(player)
	assert(hud.crate_open)
	assert(not hud.barrel_open)
	player._unhandled_input(place)
	assert(gs.blueberries == 0)
	assert(gs.crate_count("blueberries") == 4)
	assert(gs.barrel_count("blueberries") == 0)
	player._refresh_held()
	assert(not held.visible)
	hud._process(0.0)
	hud._on_crate_slot(0)
	player._unhandled_input(place)
	assert(gs.blueberries == 4)
	assert(gs.crate_count("blueberries") == 0)
	assert(gs.held_slot == 0)
	player._refresh_held()
	assert(held.texture == hud.icon_for("blueberries"))
	_use(player)
	assert(not hud.storage_open())

	await _stand_at(host, player, home.get_node("Objects/home_barrel") as Node2D)
	assert(str((player.focus as Interactable).data.get("id", "")) == "home_barrel_look")
	player._unhandled_input(two)
	_use(player)
	assert(hud.barrel_open)
	assert(not hud.crate_open)
	var stage: int = gs.campfire_stage
	var stowed: int = gs.wood_stowed_day
	player._unhandled_input(place)
	assert(gs.logs == 0)
	assert(gs.barrel_count("logs") == 2)
	assert(gs.crate_count("logs") == 0)
	assert(gs.campfire_stage == stage)
	assert(gs.wood_stowed_day == stowed)
	player._refresh_held()
	assert(not held.visible)
	hud._process(0.0)
	hud._on_crate_slot(0)
	player._unhandled_input(place)
	assert(gs.logs == 2)
	assert(gs.barrel_count("logs") == 0)
	assert(gs.held_slot == 1)
	player._refresh_held()
	assert(held.texture == hud.icon_for("logs"))
	assert(gs.has_item("logs"))

	assert(not gs.place_stack("learning_card", "crate"))
	assert(not gs.place_stack("learning_card", "barrel"))
	assert(gs.crate_count("learning_card") == 0)
	assert(gs.barrel_count("learning_card") == 0)
	assert(gs.has_item("learning_card"))
	assert((hud._card_button.get_node("Icon") as TextureRect).texture != null)

	var berries: int = gs.blueberries
	var slot: int = gs.held_slot
	DialogueUI.show_order_box()
	player._unhandled_input(one)
	player._unhandled_input(two)
	player._unhandled_input(place)
	assert(gs.held_slot == slot)
	assert(gs.blueberries == berries)
	assert(gs.logs == 2)
	DialogueUI.close()

	_use(player)
	assert(not hud.storage_open())

	var cafe: Node = host.get_node("/root/CafeOrder")
	cafe.carrying_dishes = true
	var cart_line: String = cafe.use_dish_cart()
	assert(cart_line.contains("dish cart"))
	assert(not hud.storage_open())
	assert(gs.barrel_count("logs") == 0)
	assert(gs.crate_count("blueberries") == 0)

	interiors.leave()
	assert(gs.blueberries == 4)
	assert(gs.logs == 2)
	interiors.enter("dragons_brew", "")
	assert(gs.blueberries == 4)
	assert(gs.logs == 2)
	assert(gs.barrel_count("logs") == 0)

	print("carry slots: ok")
	host.get_tree().quit()


static func _key(code: Key) -> InputEventKey:
	var press := InputEventKey.new()
	press.keycode = code
	press.pressed = true
	return press


static func _use(player: Player) -> void:
	var use := InputEventAction.new()
	use.action = "interact"
	use.pressed = true
	player._unhandled_input(use)


static func _stand_at(host: Node, player: Player, prop: Node2D) -> void:
	player.agent_input = Vector2.ZERO
	player.velocity = Vector2.ZERO
	player.global_position = prop.global_position + Vector2(0, 24)
	player.facing = Vector2.UP
	await host.get_tree().physics_frame
	player.agent_input = Vector2.UP
	for _i in 40:
		await host.get_tree().physics_frame
	player.agent_input = Vector2.ZERO
	player.velocity = Vector2.ZERO
	player.facing = Vector2.UP
	await host.get_tree().physics_frame
	player._update_focus()
	if player.focus is Interactable:
		return
	var shape := player._reach.get_node("Shape") as CollisionShape2D
	var q := PhysicsShapeQueryParameters2D.new()
	q.shape = shape.shape
	q.transform = shape.global_transform
	q.collision_mask = player._reach.collision_mask
	q.collide_with_areas = true
	q.collide_with_bodies = false
	for row in player.get_world_2d().direct_space_state.intersect_shape(q, 8):
		if row.collider is Interactable:
			var id := str((row.collider as Interactable).data.get("id", ""))
			if id == "home_crate_look" or id == "home_barrel_look":
				player.focus = row.collider
				return


static func _assert_bright(btn: Button, want: bool) -> void:
	var box := btn.get_theme_stylebox("normal") as StyleBoxFlat
	var bright: bool = box.border_color.r > 0.8
	assert(bright == want)
