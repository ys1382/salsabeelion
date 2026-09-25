extends RefCounted
# godot --path . --headless -- --check-learning-card
# The basket grants one warm card in the left slot. Pesos stay the top-left
# line and still drop when you pay. Place does not put the card in the crate.


static func run(host: Node) -> void:
	var gs: Node = host.get_node("/root/GameState")
	var hud: Node = host.get_node("/root/Hud")
	if Journal.is_open():
		Journal.dismiss()
	await host.get_tree().process_frame
	assert(not gs.has_item("learning_card"))
	hud._process(0.0)
	assert(not hud._bar.visible)
	assert(not hud._pesos.visible)

	assert(gs.take_item("learning_card"))
	assert(gs.card_balance == 400)
	hud._process(0.0)
	assert(hud._bar.visible)
	assert(str(hud._pesos.text) == "400 pesos")
	var card: Button = hud._card_button
	var icon := card.get_node("Icon") as TextureRect
	var num := card.get_node("Count") as Label
	assert(icon.texture != null)
	assert(num.text == "")
	_assert_warm_card(icon.texture)
	assert(hud._carry_buttons.size() == 2)

	assert(gs.try_pay(35))
	hud._process(0.0)
	assert(str(hud._pesos.text) == "365 pesos")
	assert(gs.has_item("learning_card"))

	gs.blueberries = 4
	gs.logs = 1
	hud._process(0.0)
	assert(str(hud.berry_count.text) == "4")
	assert(num.text == "")
	assert(hud._carry_buttons.size() == 2)
	gs.blueberries = 0
	hud._process(0.0)
	assert(str(hud.berry_count.text) == "")
	assert(str((hud._carry_buttons[1].get_node("Count") as Label).text) == "1")
	assert(str((hud._carry_buttons[0].get_node("Mark") as Label).text) == "1")
	assert(str((hud._carry_buttons[1].get_node("Mark") as Label).text) == "2")
	gs.blueberries = 4
	hud._process(0.0)

	hud._on_carry_slot(-1)
	var press := InputEventKey.new()
	press.keycode = KEY_P
	press.pressed = true
	var player := WorldManager.world_root.player as Player
	player._unhandled_input(press)
	assert(not gs.place_stack("learning_card"))
	assert(gs.crate_count("learning_card") == 0)
	assert(gs.has_item("learning_card"))
	assert(gs.blueberries == 4)
	assert(icon.texture != null)
	assert(num.text == "")

	await host.get_tree().create_timer(0.45).timeout
	assert(absf(icon.offset_top - 3.0) < 0.5)
	print("learning card slot: ok")
	host.get_tree().quit()


static func _assert_warm_card(tex: Texture2D) -> void:
	var img := tex.get_image()
	var min_x := 16
	var min_y := 16
	var max_x := 0
	var max_y := 0
	var cream := 0
	var gold := 0
	var dark_row := {}
	for y in img.get_height():
		var dark := 0
		var ink := 0
		for x in img.get_width():
			var c := img.get_pixel(x, y)
			if c.a < 0.5:
				continue
			ink += 1
			min_x = mini(min_x, x)
			min_y = mini(min_y, y)
			max_x = maxi(max_x, x)
			max_y = maxi(max_y, y)
			assert(c.b < 0.55 or c.r > c.b, "card has a cold blue pixel")
			assert(c.r > 0.25 and c.g > 0.18, "card has gray or black plastic")
			if c.r > 0.85 and c.g > 0.75 and c.b > 0.55 and c.b < 0.85:
				cream += 1
			if c.r > 0.4 and c.r < 0.7 and c.g > 0.25 and c.g < 0.55 and c.b < 0.4:
				gold += 1
			if c.r < 0.35 and c.g < 0.35 and c.b < 0.35:
				dark += 1
		if ink > 0:
			dark_row[y] = dark
	var wide := max_x - min_x + 1
	var tall := max_y - min_y + 1
	assert(wide > tall, "card is not a wide flat rectangle")
	assert(float(wide) / float(tall) > 1.4, "card is not credit-card shaped")
	assert(cream >= 8, "card is missing cream paper")
	assert(gold >= 8, "card is missing a dull gold edge")
	for y in dark_row:
		assert(int(dark_row[y]) < 6, "card has a stripe")
