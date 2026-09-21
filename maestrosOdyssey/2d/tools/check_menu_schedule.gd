extends SceneTree
# Headless check that the café board follows fiction day, not the starter trio.


func _initialize() -> void:
	var gs: Node = root.get_node("GameState")
	var cafe: Node = root.get_node("CafeOrder")

	gs.day_index = 1
	gs._sync_clock()
	var d1: String = cafe.board_text()
	assert(d1.contains("café") and d1.contains("té") and d1.contains("muffin"))
	assert(not d1.contains("chocolate caliente"))
	assert(not d1.contains("tostada"))
	assert(cafe.match_lemmas("chocolate caliente").is_empty())
	assert(cafe.match_lemmas("té").has("té"))
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
	assert(d7.contains("espresso") and d7.contains("creamer") and d7.contains("croissant"))
	var late: PackedStringArray = cafe.match_lemmas("espresso y galleta")
	assert(late.has("espresso") and late.has("galleta"))

	gs.day_index = 1
	gs._sync_clock()
	cafe.reset_session()
	gs.take_item("learning_card")
	gs.card_balance = 10
	assert(cafe.too_broke_to_order())
	assert(cafe._begin_practice())
	assert(str(cafe._practice_lemma) == "café")
	var before := int(gs.card_balance)
	var practiced: String = cafe._practice_reply("coffee")
	assert(practiced.contains("12 pesos"), practiced)
	assert(int(gs.card_balance) == before + 12)
	cafe._remember(PackedStringArray(["café"]))
	assert(cafe.ordered.has("café"))
	assert(cafe._begin_practice())
	assert(str(cafe._practice_lemma) == "muffin")

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
	var kind := String(elder.reply_for(
		"Mara at the counter has wings. The café is warm. Neighbors at the table. House rules, no racism."
	))
	assert(kind.contains("lovely"), kind)
	assert(bool(elder.passed))
	assert(int(gs.card_balance) == 400)
	print("menu_schedule_runtime: ok")
	quit()
