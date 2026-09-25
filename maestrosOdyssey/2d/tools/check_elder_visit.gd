extends RefCounted
# godot --path . --headless -- --check-elder-visit
# Monday hint, then the same goodbye. Tuesday knock grows the pockets.


static func run(host: Node) -> void:
	var gs: Node = host.get_node("/root/GameState")
	var cafe: Node = host.get_node("/root/CafeOrder")
	var hud: Node = host.get_node("/root/Hud")
	var player := WorldManager.world_root.player as Player
	var arrow: Node = host.get_node("/root/WaypointHud")
	if Journal.is_open():
		Journal.dismiss()

	gs.day_index = 1
	gs._sync_clock()
	cafe.reset_session()
	cafe.taken = true
	cafe.carrying_dishes = true
	var hint: String = cafe.use_dish_cart()
	assert(hint.contains("blueberries"))
	assert(hint.contains("lonely"))
	assert(not hint.contains("Adiós"))
	assert(cafe.visit_hint)
	assert(not cafe.awaiting_bye)
	assert(cafe.take_visit_hint())
	var bye: String = cafe.cart_goodbye_line()
	assert(bye.contains("Adiós, and buenas noches"))
	var said: String = cafe.reply_for("Adiós, and buenas noches")
	assert(cafe.goodbye_done, said)
	assert(said == "Mara smiles and nods.")

	assert(gs.pocket_count() == 2)
	assert(hud._carry_buttons.size() == 2)
	gs.blueberries = 4
	gs.settle_slots()
	var home := WorldManager.world_root.entities["player_house"] as Node2D
	player.focus = home.get_node("Interact")
	player._unhandled_input(_key(KEY_K))
	assert(not Interiors.inside())
	assert(gs.blueberries == 4)

	DialogueUI.show_order_box()
	player._unhandled_input(_key(KEY_K))
	assert(DialogueUI.is_ordering())
	assert(not gs.elder_visit_pending)
	DialogueUI.close()

	gs.day_index = 2
	gs._sync_clock()
	gs.take_item("learning_card")
	gs.elder_morning_done = true
	WorldManager.world_root.settle_elder_day()
	var street: Npc = WorldManager.world_root._street_elder
	assert(not street.visible)
	assert(arrow.current_id() == "berry_patch")

	var door := WorldManager.world_root.entities["elder_house"] as Node2D
	player.focus = door.get_node("Interact")
	var use := InputEventAction.new()
	use.action = "interact"
	use.pressed = true
	player._unhandled_input(use)
	assert(not Interiors.inside())

	player._unhandled_input(_key(KEY_K))
	assert(Interiors.inside())
	assert(Interiors.current.building_id == "elder_house")
	assert(DialogueUI.body().contains("kindness is yours"))
	assert(gs.elder_visit_pending)
	DialogueUI.close()
	player._after_panel_close()
	assert(gs.has_satchel)
	assert(gs.blueberries == 0)
	assert(gs.pocket_count() == 5)
	hud._process(0.0)
	assert(hud._carry_buttons.size() == 5)
	var bag := player.get_node("Satchel") as Sprite2D
	assert(bag.visible)
	cafe.cup_left = 2
	player._refresh_worn()
	var held := player.get_node("Held") as Sprite2D
	assert(held.visible)
	assert(bag.visible)
	assert(held.texture != bag.texture)

	player._unhandled_input(_key(KEY_5))
	assert(gs.held_slot == 4)
	player._unhandled_input(_key(KEY_1))
	assert(gs.held_slot == 0)

	print("elder visit: ok")
	host.get_tree().quit()


static func _key(code: Key) -> InputEventKey:
	var press := InputEventKey.new()
	press.keycode = code
	press.pressed = true
	return press
