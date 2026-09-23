extends SceneTree

const CafePhrasesScript := preload("res://ui/cafe_phrases.gd")
# Headless check that the café board follows fiction day, not the starter trio.


func _initialize() -> void:
	var gs: Node = root.get_node("GameState")
	var cafe: Node = root.get_node("CafeOrder")

	gs.day_index = 1
	gs._sync_clock()
	var d1: String = cafe.board_text()
	assert(d1.contains("café") and d1.contains("té") and d1.contains("muffin"))
	assert(d1.contains("leche") and d1.contains("azúcar") and d1.contains("calentado"))
	assert(not d1.contains("chocolate caliente"))
	assert(not d1.contains("tostada"))
	assert(not d1.contains("crema"))
	assert(not d1.contains("frío"))
	assert(cafe.match_lemmas("chocolate caliente").is_empty())
	assert(cafe.match_lemmas("té").has("té"))
	assert(cafe.match_lemmas("leche").has("leche"))
	assert(cafe.match_lemmas("azúcar").has("azúcar"))
	assert(not cafe.match_lemmas("sugar").has("azúcar"))
	assert(not cafe.match_lemmas("milk").has("leche"))
	var combo: PackedStringArray = cafe.match_lemmas("coffee muffin")
	assert(combo.has("café") and combo.has("muffin"))
	assert(cafe.match_lemmas("tostada").is_empty())

	gs.day_index = 2
	gs._sync_clock()
	var d2: String = cafe.board_text()
	assert(d2.contains("chocolate caliente"), d2)
	assert(d2.contains("New today: chocolate caliente"))
	assert(cafe.match_lemmas("hot chocolate").has("chocolate caliente"))
	assert(cafe.match_lemmas("tostada").is_empty())

	gs.day_index = 7
	gs._sync_clock()
	var d7: String = cafe.board_text()
	assert(d7.contains("espresso") and d7.contains("crema") and d7.contains("croissant") and d7.contains("frío"))
	var late: PackedStringArray = cafe.match_lemmas("espresso y galleta")
	assert(late.has("espresso") and late.has("galleta"))

	gs.day_index = 1
	gs._sync_clock()
	cafe.reset_session()
	gs.take_item("learning_card")
	gs.card_balance = 70
	assert(not cafe.too_broke_to_order())
	assert(int(cafe.cheapest_pair_price()) == 58)
	gs.card_balance = 0
	assert(cafe.too_broke_to_order())
	gs.card_balance = 10
	assert(cafe.too_broke_to_order())
	assert(cafe._begin_practice())
	assert(str(cafe._practice_lemma) == "café")
	var before := int(gs.card_balance)
	var practiced: String = cafe._practice_reply("coffee")
	assert(practiced.contains("12 pesos"), practiced)
	assert(int(gs.card_balance) == before + 12)
	assert(cafe.ordered.has("café"))
	assert(bool(cafe.meal_done))
	assert(cafe._begin_practice())
	assert(str(cafe._practice_lemma) == "muffin")
	var muffin_q: String = cafe._practice_reply("muffin")
	assert(muffin_q.contains("lovely"), muffin_q)
	assert(cafe.ordered.has("muffin"))
	assert(cafe._begin_practice())
	assert(str(cafe._practice_lemma) == "té")

	cafe.reset_session()
	gs.take_item("learning_card")
	gs.card_balance = 400
	var drink_only: String = cafe.reply_for("café")
	assert(drink_only.contains("food"), drink_only)
	assert(not drink_only.contains("Here you go"))
	var food_only: String = cafe.reply_for("muffin")
	assert(food_only.contains("drink"), food_only)
	assert(not food_only.contains("Here you go"))
	var pair: String = cafe.reply_for("café muffin")
	assert(pair.contains("Here you go"), pair)
	assert(int(gs.card_balance) == 337)

	cafe.reset_session()
	gs.take_item("learning_card")
	gs.card_balance = 400
	var sugar_en: String = cafe.reply_for("café muffin sugar")
	assert(sugar_en.contains("azúcar"), sugar_en)
	assert(not sugar_en.contains("Here you go"))
	assert(int(gs.card_balance) == 400)
	var with_azucar: String = cafe.reply_for("café muffin azúcar")
	assert(with_azucar.contains("Here you go"), with_azucar)
	assert(with_azucar.contains("azúcar"), with_azucar)
	assert(int(gs.card_balance) == 337)

	cafe.reset_session()
	gs.take_item("learning_card")
	gs.card_balance = 400
	var iced_early: String = cafe.reply_for("iced coffee muffin")
	assert(iced_early.contains("Here you go"), iced_early)
	assert(not iced_early.contains("frío"), iced_early)

	cafe.reset_session()
	gs.take_item("learning_card")
	gs.card_balance = 400
	var frio_early: String = cafe.reply_for("café muffin frío")
	assert(frio_early.contains("Here you go"), frio_early)
	assert(not frio_early.contains("frío"), frio_early)
	assert(not frio_early.contains("wall yet"), frio_early)

	cafe.reset_session()
	gs.take_item("learning_card")
	gs.card_balance = 400
	var cream_early: String = cafe.reply_for("café muffin cream")
	assert(cream_early.contains("Here you go"), cream_early)
	assert(not cream_early.contains("crema"), cream_early)

	cafe.reset_session()
	gs.take_item("learning_card")
	gs.card_balance = 400
	var crema_early: String = cafe.reply_for("café muffin crema")
	assert(crema_early.contains("Here you go"), crema_early)
	assert(not crema_early.contains("crema"), crema_early)

	cafe.reset_session()
	gs.take_item("learning_card")
	gs.card_balance = 400
	var warmed: String = cafe.reply_for("café muffin calentado")
	assert(warmed.contains("Here you go"), warmed)
	assert(warmed.contains("calentado"), warmed)
	assert(int(gs.card_balance) == 337)

	gs.day_index = 2
	gs._sync_clock()
	cafe.reset_session()
	gs.take_item("learning_card")
	gs.card_balance = 400
	var tue: String = cafe.reply_for("café muffin")
	assert(tue.contains("Here you go"), tue)
	assert(not cafe.needs_y())

	gs.day_index = 3
	gs._sync_clock()
	cafe.reset_session()
	gs.take_item("learning_card")
	gs.card_balance = 400
	assert(cafe.needs_y())
	var wed: String = cafe.order_prompt()
	assert(wed.contains("say y instead of and"), wed)
	assert(wed.contains("drink y a food"), wed)
	assert(wed.contains("con azúcar"), wed)
	var no_y: String = cafe.reply_for("té muffin")
	assert(no_y.contains("we say y"), no_y)
	assert(not no_y.contains("Here you go"))
	assert(int(gs.card_balance) == 400)
	var with_and: String = cafe.reply_for("té and muffin")
	assert(with_and.contains("we say y"), with_and)
	assert(not with_and.contains("Here you go"))
	var with_y: String = cafe.reply_for("té y muffin")
	assert(with_y.contains("Here you go"), with_y)
	assert(with_y.contains("té y muffin") or with_y.contains(" y "), with_y)
	assert(int(gs.card_balance) == 342)

	cafe.reset_session()
	gs.take_item("learning_card")
	gs.card_balance = 400
	var no_con: String = cafe.reply_for("té y muffin azúcar")
	assert(no_con.contains("extras use con"), no_con)
	assert(not no_con.contains("Here you go"))
	assert(int(gs.card_balance) == 400)
	var with_con: String = cafe.reply_for("té y muffin con azúcar")
	assert(with_con.contains("Here you go"), with_con)
	assert(with_con.contains("con azúcar"), with_con)
	assert(int(gs.card_balance) == 342)

	gs.day_index = 4
	gs._sync_clock()
	var thu: String = cafe.order_prompt()
	assert(thu.contains("drink y a food"), thu)
	assert(not thu.contains("instead of and"), thu)

	gs.day_index = 6
	gs._sync_clock()
	var d6: String = cafe.board_text()
	assert(d6.contains("crema"), d6)
	assert(not d6.contains("frío"), d6)
	cafe.reset_session()
	gs.take_item("learning_card")
	gs.card_balance = 400
	var cream_en: String = cafe.reply_for("café y muffin cream")
	assert(cream_en.contains("crema"), cream_en)
	assert(not cream_en.contains("Here you go"))
	var cream_ok: String = cafe.reply_for("café y muffin con crema")
	assert(cream_ok.contains("Here you go"), cream_ok)
	assert(cream_ok.contains("crema"), cream_ok)
	assert(int(gs.card_balance) == 337)

	gs.day_index = 7
	gs._sync_clock()
	cafe.reset_session()
	gs.take_item("learning_card")
	gs.card_balance = 400
	var iced_en: String = cafe.reply_for("iced espresso y muffin")
	assert(iced_en.contains("frío"), iced_en)
	assert(not iced_en.contains("Here you go"))
	assert(int(gs.card_balance) == 400)
	var iced_ok: String = cafe.reply_for("espresso frío y muffin")
	assert(iced_ok.contains("Here you go"), iced_ok)
	assert(iced_ok.contains("frío"), iced_ok)
	assert(int(gs.card_balance) == 332)

	gs.day_index = 8
	gs._sync_clock()
	var elder: Node = root.get_node("ElderReport")
	elder.reset()
	cafe.ordered = PackedStringArray()
	assert(not elder.can_offer())
	cafe.ordered = PackedStringArray(["café", "té", "muffin"])
	assert(elder.can_offer())
	gs.take_item("learning_card")
	gs.card_balance = 40
	elder.awaiting = true
	var kind := String(elder.reply_for("El café con leche y el muffin son mis favoritos."))
	assert(kind.contains("lovely"), kind)
	assert(bool(elder.passed))
	assert(int(gs.card_balance) == 400)
	elder.reset()
	gs.card_balance = 40
	elder.awaiting = true
	var thin := String(elder.reply_for("The café is warm. Neighbors at the table."))
	assert(thin.contains("find out more"), thin)
	assert(not bool(elder.passed))
	assert(CafePhrasesScript.line_for("iguana_neighbor", 1, false) == "")
	assert(CafePhrasesScript.line_for("iguana_neighbor", 2, false).to_lower().contains("té"))
	assert(CafePhrasesScript.line_for("riverfolk_neighbor", 3, false).contains("tostada"))
	assert(CafePhrasesScript.line_for("riverfolk_neighbor", 5, false).contains("bolillo"))
	assert(CafePhrasesScript.line_for("iguana_neighbor", 6, false).contains("croissant"))
	assert(CafePhrasesScript.line_for("riverfolk_neighbor", 7, false).contains("espresso"))
	assert(CafePhrasesScript.line_for("iguana_neighbor", 8, true).contains("con leche"))
	gs.day_index = 1
	gs._sync_clock()
	cafe.reset_session()
	assert(cafe.may_leave())
	cafe.taken = true
	cafe._drink = "café"
	cafe._food = "muffin"
	cafe.served = PackedStringArray(["café", "muffin"])
	cafe.cup_left = 0
	cafe.muffin_left = 0
	cafe._mark_meal_if_done()
	assert(cafe.carrying_dishes)
	assert(not cafe.may_leave())
	assert(cafe.leave_blocked_line().contains("dish cart"))
	var put: String = cafe.use_dish_cart()
	assert(put.contains("Adiós, and buenas noches"), put)
	assert(put.contains("good night"), put)
	assert(cafe.awaiting_bye)
	assert(not cafe.carrying_dishes)
	var wrong: String = cafe.reply_for("goodbye")
	assert(cafe.awaiting_bye, wrong)
	assert(not wrong.contains("Adiós"))
	var early_y: String = cafe.reply_for("adios y buenas noches")
	assert(cafe.awaiting_bye, early_y)
	var said: String = cafe.reply_for("Adiós, and buenas noches")
	assert(cafe.goodbye_done, said)
	assert(cafe.may_leave())
	assert(said == "Mara smiles and nods.")

	gs.day_index = 3
	gs._sync_clock()
	assert(gs.weekday == "Wednesday")
	cafe.reset_session()
	cafe.taken = true
	cafe._drink = "té"
	cafe._food = "muffin"
	cafe.served = PackedStringArray(["té", "muffin"])
	cafe.cup_left = 0
	cafe.muffin_left = 0
	cafe._mark_meal_if_done()
	var night_line: String = cafe.use_dish_cart()
	assert(night_line.contains("Adiós, y buenas noches"), night_line)
	assert(night_line.contains("good night"), night_line)
	var night_bad: String = cafe.reply_for("adios and buenas noches")
	assert(cafe.awaiting_bye, night_bad)
	assert(not night_bad.contains("buenas noches"))
	var night_ok: String = cafe.reply_for("adiós, y buenas noches")
	assert(cafe.goodbye_done, night_ok)
	assert(night_ok == "Mara smiles and nods.")
	assert(cafe.may_leave())

	gs.day_index = 8
	gs._sync_clock()
	cafe.reset_session()
	cafe.taken = true
	cafe._drink = "café"
	cafe._food = "muffin"
	cafe.served = PackedStringArray(["café", "muffin"])
	cafe.cup_left = 0
	cafe.muffin_left = 0
	cafe._mark_meal_if_done()
	var later: String = cafe.use_dish_cart()
	assert(later.contains("Adiós, y buenas noches"), later)
	var later_ok: String = cafe.reply_for("adios y buenas noches")
	assert(later_ok == "Mara smiles and nods.")

	# Seated guests hold the cup at the counter until their last line, then
	# Mara calls three seconds after that box closes. Pickup is a later talk.
	gs.day_index = 1
	gs._sync_clock()
	cafe.reset_session()
	gs.world = {
		"npcs": [
			{"id": "mara", "inside": "dragons_brew"},
			{
				"id": "iguana_neighbor",
				"inside": "dragons_brew",
				"scripted_lines": ["Ferry talk.", "Merfolk aren't picking fights."],
			},
			{
				"id": "riverfolk_neighbor",
				"inside": "dragons_brew",
				"scripted_lines": ["Coffee first.", "People still need to get home."],
			},
			{
				"id": "werewolf_fiance",
				"inside": "dragons_brew",
				"weekdays": ["Tuesday"],
				"scripted_lines": ["Morning.", "We're here for the tea."],
			},
		],
	}
	gs.take_item("learning_card")
	gs.card_balance = 400
	var held: String = cafe.reply_for("café and muffin")
	assert(held.contains("I'll call you when it's ready"), held)
	assert(not held.contains("Here you go"), held)
	assert(bool(cafe.awaiting_serve))
	assert(not cafe.may_leave())
	assert(int(cafe.cup_left) == 0)
	assert(int(gs.card_balance) == 400 - 63)
	cafe.note_guest_spoke("iguana_neighbor", "Ferry talk.", false)
	cafe.note_guest_spoke("werewolf_fiance", "We're here for the tea.", false)
	assert(not cafe._tables_heard())
	cafe.on_speech_closed()
	assert(float(cafe._callout_left) < 0.0)
	cafe.note_guest_spoke("iguana_neighbor", "Merfolk aren't picking fights.", false)
	cafe.note_guest_spoke("riverfolk_neighbor", "People still need to get home.", false)
	assert(cafe._tables_heard())
	var early: String = cafe._counter_while_waiting()
	assert(early.contains("Give the room a moment"), early)
	assert(bool(cafe.awaiting_serve))
	cafe.on_speech_closed()
	assert(float(cafe._callout_left) == 3.0)
	cafe._process(3.0)
	assert(bool(cafe.called_out))
	assert(float(cafe._callout_left) < 0.0)
	var picked: String = cafe._counter_while_waiting()
	assert(picked.contains("Here you go"), picked)
	assert(not bool(cafe.awaiting_serve))
	assert(int(cafe.cup_left) == 4)
	assert(cafe.may_leave())
	gs.world = {}
	cafe.reset_session()
	print("menu_schedule_runtime: ok")
	quit()
