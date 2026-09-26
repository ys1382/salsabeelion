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

	cafe.cup_left = 0
	cafe.muffin_left = 0
	cafe.carrying_dishes = false
	gs.logs = 2
	gs.settle_slots()
	gs.held_slot = gs.carry_slot.find("logs")
	assert(gs.give_held("family_aunt") == "refuse")
	assert(gs.logs == 2)
	assert(gs.give_held("family_brother") == "take")
	assert(gs.logs == 0)
	gs.blueberries = 4
	gs.settle_slots()
	gs.held_slot = gs.carry_slot.find("blueberries")
	var elder_npc: Npc = WorldManager.world_root.entities["elder"]
	player.focus = elder_npc
	player._unhandled_input(_key(KEY_G))
	assert(gs.blueberries == 4)
	assert(DialogueUI.body().contains("keep"))
	assert(gs.has_satchel)
	assert(gs.pocket_count() == 5)
	DialogueUI.close()
	gs.take_item("learning_card")
	gs.card_balance = 400
	gs.settle_slots()
	gs.held_slot = gs.carry_slot.find("learning_card")
	assert(gs.offer_item() == "")
	assert(gs.give_held("family_neighbor") == "")
	assert(gs.has_item("learning_card"))
	assert(gs.card_balance == 400)
	player.focus = elder_npc
	player._unhandled_input(_key(KEY_G))
	assert(DialogueUI.body().contains("stays"))
	assert(gs.has_item("learning_card"))
	assert(gs.card_balance == 400)
	DialogueUI.close()
	cafe.cup_left = 2
	assert(gs.offer_item() == "")
	cafe.cup_left = 0
	DialogueUI.show_order_box()
	player._unhandled_input(_key(KEY_G))
	assert(DialogueUI.is_ordering())
	assert(not gs.elder_visit_pending)
	DialogueUI.close()

	gs.day_index = 3
	gs._sync_clock()
	var heard: Array[String] = []
	for n in cafe._guest_dicts():
		heard.append(str(n.get("id", "")))
	assert(heard.has("family_neighbor"))
	assert(not heard.has("family_child"))
	gs.has_satchel = true
	gs.carry_slot = ["", "", "", "", ""] as Array[String]
	cafe._drink = "té"
	cafe._food = "muffin"
	cafe.taken = true
	cafe.awaiting_serve = false
	assert(cafe._put_in_hands())
	assert(gs.carry_slot.has("cafe_drink"))
	assert(gs.carry_slot.has("cafe_food"))
	assert(int(cafe.cup_left) == 4)
	assert(gs.offer_item() == "")
	assert(not gs.place_stack("cafe_drink"))
	for i in gs.carry_slot.size():
		gs.carry_slot[i] = "logs"
	gs.logs = 2
	cafe.cup_left = 0
	cafe.muffin_left = 0
	assert(not cafe._put_in_hands())
	assert(int(cafe.cup_left) == 0)
	gs.carry_slot = ["cafe_drink", "cafe_food", "", "", ""] as Array[String]
	cafe.awaiting_bye = false
	cafe.goodbye_done = false
	cafe.carrying_dishes = true
	cafe.cup_left = 0
	cafe.muffin_left = 0
	cafe.use_dish_cart()
	assert(not gs.carry_slot.has("cafe_drink"))
	assert(not gs.carry_slot.has("cafe_food"))

	gs.day_index = 3
	gs._sync_clock()
	cafe.cup_left = 4
	cafe.muffin_left = 3
	cafe.taken = true
	assert(not gs.person_honks("Elder"))
	assert(not gs.player_honks())
	cafe.muffin_left = 0
	gs.gain_gooseberries()
	assert(gs.gooseberries == 4)
	assert(gs.carry_slot.has("gooseberries"))
	assert(int(cafe.cup_left) == 4)
	gs.held_slot = gs.carry_slot.find("gooseberries")
	assert(gs.give_held("family_child") == "refuse")
	assert(gs.give_held("mara") == "refuse")
	assert(gs.gooseberries == 4)
	assert(gs.give_held("family_aunt") == "take")
	assert(gs.gooseberries == 2)
	assert(not gs.player_honks())
	assert(not gs.person_honks("Family aunt"))
	player.seated = false
	assert(player.try_bite())
	assert(gs.gooseberries == 1)
	assert(gs.player_honks())
	assert(DialogueUI.body().contains("eat one"))
	DialogueUI.close()
	gs.player_honk = false
	gs.blueberries = 4
	gs.settle_slots()
	gs.held_slot = gs.carry_slot.find("blueberries")
	assert(player.try_bite())
	assert(gs.blueberries == 3)
	assert(not gs.player_honks())
	gs.logs = 2
	gs.settle_slots()
	gs.held_slot = gs.carry_slot.find("logs")
	assert(not player.try_bite())
	assert(gs.logs == 2)
	gs.held_slot = gs.carry_slot.find("gooseberries")
	assert(not gs.holding_pocket_drink())
	assert(not player.try_sip())
	assert(gs.gooseberries == 1)
	player.seated = true
	cafe.cup_left = 4
	cafe.muffin_left = 3
	assert(player.try_sip())
	assert(int(cafe.cup_left) == 3)
	assert(player.try_bite())
	assert(int(cafe.muffin_left) == 2)
	assert(gs.gooseberries == 1)
	player.seated = false
	cafe.cup_left = 0
	cafe.muffin_left = 0
	DialogueUI.show_order_box()
	player._unhandled_input(_key(KEY_D))
	player._unhandled_input(_key(KEY_F))
	assert(DialogueUI.is_ordering())
	assert(gs.gooseberries == 1)
	DialogueUI.close()
	gs.day_index = 4
	gs._sync_clock()
	assert(gs.can_knock_goose())
	assert(not gs.can_knock_elder())
	var pockets := int(gs.pocket_count())
	player.focus = door.get_node("Interact")
	player._unhandled_input(_key(KEY_K))
	assert(Interiors.inside())
	assert(gs.gooseberries == 1)
	assert(not gs.player_honks())
	assert(not gs.person_honks("Elder"))
	assert(not gs.elder_visit_pending)
	assert(gs.has_satchel)
	assert(gs.pocket_count() == pockets)
	DialogueUI.close()
	cafe.open_box_on_close = false
	player._after_panel_close()
	if DialogueUI.is_open() or DialogueUI.is_ordering():
		DialogueUI.close()
	assert(gs.has_satchel)
	assert(gs.pocket_count() == pockets)
	gs.held_slot = gs.carry_slot.find("gooseberries")
	assert(gs.offer_item() == "gooseberries")
	player.focus = elder_npc
	player._unhandled_input(_key(KEY_G))
	assert(gs.gooseberries == 0)
	assert(not gs.person_honks("Elder"))
	assert(not gs.player_honks())
	assert(DialogueUI.body().contains("take"))
	player._unhandled_input(_key(KEY_T))
	assert(gs.person_honks("Elder"))
	assert(not gs.player_honks())
	assert(DialogueUI.body().contains("eats one"))
	player._unhandled_input(_key(KEY_T))
	assert(DialogueUI.is_ordering())
	DialogueUI._on_order_submitted("yes")
	assert(DialogueUI.body().contains("not eaten"))
	assert(not gs.player_honks())
	assert(gs.gooseberries == 0)
	assert(gs.goose_reply("no") == "You leave it.")
	assert(gs.has_satchel)
	assert(gs.pocket_count() == pockets)
	DialogueUI.close()
	gs.gooseberries = 4
	gs.player_honk = true
	gs.goose_ask = false
	gs.settle_slots()
	gs.held_slot = gs.carry_slot.find("gooseberries")
	cafe.open_box_on_close = false
	player.focus = elder_npc
	player._unhandled_input(_key(KEY_G))
	assert(gs.gooseberries == 2)
	assert(not gs.goose_ask)
	player._unhandled_input(_key(KEY_T))
	assert(gs.person_honks("Elder"))
	player._unhandled_input(_key(KEY_T))
	assert(not DialogueUI.is_ordering())
	assert(not gs.goose_ask)
	assert(gs.player_honks())
	gs.advance_day()
	assert(not gs.person_honks("Elder"))
	assert(not gs.player_honks())
	assert(ResourceLoader.exists(gs.HONK_PATH))
	var honk = load(gs.HONK_PATH)
	assert(honk.get_length() > 0.25 and honk.get_length() < 1.2)
	assert(not ResourceLoader.exists(gs.LAUGH_PATH))

	print("elder visit: ok")
	host.get_tree().quit()


static func _key(code: Key) -> InputEventKey:
	var press := InputEventKey.new()
	press.keycode = code
	press.pressed = true
	return press
