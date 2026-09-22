extends Node
# Dragon's Brew order at Mara. Menu must be read first; then a typed line is
# matched against today's board. A paid order is one drink and one food. A
# match takes pesos from the learning card in the same reply — no extra pay
# tap, no kitchen wait. Sit to sip (D) and eat (F). After both are finished,
# stepping into your house turns the weekday. If the card can't cover any
# pair, Mara quizzes board words instead (cycling, not the same lemma on a
# loop). From Wednesday, a paid pair must use y (not and), and extras use con
# (not with). Add-ons are Spanish. A good quiz also lets home turn the weekday.

signal order_ready(lemmas: PackedStringArray)
signal order_cleared

## After Mara's "what's your order?" line, the next E opens the type box.
var open_box_on_close := false
var intro_done := false
var taken := false
var served: PackedStringArray = PackedStringArray()
var cup_left := 0
var muffin_left := 0
var _drink := ""
var _food := ""
## Board words ordered this play — used so practice skips what you already bought.
var ordered: PackedStringArray = PackedStringArray()
var _practicing := false
var _practice_lemma := ""
var _practice_en := ""
var _practice_earned := 0
var _practice_earned_day := 0
## Paid order fully sipped/eaten this café day. Survives leaving the café so
## home entry can turn the weekday. Not a bed — stepping inside is enough.
var meal_done := false

const NIGHT_PASS_LINE := "Night passes. It's morning."

const PRACTICE_PESOS := 12
const PRACTICE_MAX_DAY := 36

## Canon #26 unlocks. Day 1 is café / té / muffin, plus leche / azúcar.
## Later days add on; the full board stays after day 7. Add-ons are Spanish
## only. From Wednesday, extras use con. new_today marks a new café-lane lemma
## (cognates skip). prep is how you like it (calentado, frío) — not a new drink.
const ITEMS := [
	{"needles": ["chocolate caliente", "hot chocolate", "chocolate"], "lemma": "chocolate caliente", "en": "hot chocolate", "pesos": 48, "kind": "drink", "unlock_day": 2, "new_today": true},
	{"needles": ["espresso"], "lemma": "espresso", "en": "espresso", "pesos": 40, "kind": "drink", "unlock_day": 7, "new_today": false},
	{"needles": ["croissant"], "lemma": "croissant", "en": "croissant", "pesos": 32, "kind": "food", "unlock_day": 6, "new_today": false},
	{"needles": ["tostada", "toast"], "lemma": "tostada", "en": "toast", "pesos": 22, "kind": "food", "unlock_day": 3, "new_today": true},
	{"needles": ["galleta", "cookie"], "lemma": "galleta", "en": "cookie", "pesos": 24, "kind": "food", "unlock_day": 4, "new_today": true},
	{"needles": ["bolillo"], "lemma": "bolillo", "en": "bolillo roll", "pesos": 20, "kind": "food", "unlock_day": 5, "new_today": true},
	{"needles": ["leche"], "lemma": "leche", "en": "milk", "pesos": 0, "kind": "addon", "unlock_day": 1, "new_today": true},
	{"needles": ["azúcar", "azucar"], "lemma": "azúcar", "en": "sugar", "pesos": 0, "kind": "addon", "unlock_day": 1, "new_today": true},
	{"needles": ["crema"], "lemma": "crema", "en": "creamer", "pesos": 0, "kind": "addon", "unlock_day": 6, "new_today": true},
	{"needles": ["calentado", "calentada"], "lemma": "calentado", "en": "warmed", "pesos": 0, "kind": "prep", "unlock_day": 1, "new_today": false},
	{"needles": ["frío", "frio"], "lemma": "frío", "en": "iced", "pesos": 0, "kind": "prep", "unlock_day": 7, "new_today": true},
	{"needles": ["café", "cafe", "coffee"], "lemma": "café", "en": "coffee", "pesos": 35, "kind": "drink", "unlock_day": 1, "new_today": true},
	{"needles": ["muffin"], "lemma": "muffin", "en": "muffin", "pesos": 28, "kind": "food", "unlock_day": 1, "new_today": false},
	{"needles": ["té", "tea"], "lemma": "té", "en": "tea", "pesos": 30, "kind": "drink", "unlock_day": 1, "new_today": true},
]


func reset_session() -> void:
	ordered = PackedStringArray()
	_practice_earned = 0
	_practice_earned_day = 0
	intro_done = false
	meal_done = false
	GameState.cafe_meal_done = false
	_clear_order()


func reset_visit() -> void:
	open_box_on_close = false
	intro_done = false
	_clear_order()


## Hide the cup/food for this visit. Does not turn the weekday — home does,
## and only after the meal was finished.
func leave_cafe() -> void:
	if taken and cup_left <= 0 and muffin_left <= 0:
		_mark_meal_if_done()
	_clear_order()


func try_night_pass() -> bool:
	return GameState.try_night_pass()


func _clear_order() -> void:
	open_box_on_close = false
	taken = false
	served = PackedStringArray()
	cup_left = 0
	muffin_left = 0
	_drink = ""
	_food = ""
	_practicing = false
	_practice_lemma = ""
	_practice_en = ""
	order_cleared.emit()


func talk(npc: Npc) -> String:
	npc.met = true
	var lines = npc.data.get("scripted_lines", [])
	if typeof(lines) != TYPE_ARRAY or lines.size() < 3:
		return str(npc.data.get("opener", "..."))
	if not intro_done:
		intro_done = true
		npc.grant_if_any()
		return str(lines[0])
	if not GameState.known("menu_read"):
		return str(lines[1])
	if taken:
		return "That's already yours. Sit if you like — the room is for lingering."
	if too_broke_to_order():
		if not _begin_practice():
			return "Mara checks your card. \"Not quite enough for the board today — and you've already practiced what's up. Sit if you like.\""
		open_box_on_close = true
		return _practice_prompt()
	open_box_on_close = true
	return order_prompt()


func order_prompt() -> String:
	var names := _visible_lemmas(false)
	var board := ", ".join(names)
	if GameState.day_index == 3:
		return (
			"What's your order? (%s this morning.)\n\n"
			+ "Today I'd like you to say y instead of and — a drink y a food. "
			+ "Extras use con, like con azúcar."
		) % board
	if needs_y():
		return "What's your order? A drink y a food, con if you want extras. (%s this morning.)" % board
	return "What's your order? A drink and a food. (%s this morning.)" % board


## Wednesday onward (café day 3). Early week still accepts and / just both words.
func needs_y() -> bool:
	return GameState.day_index >= 3


func needs_con() -> bool:
	return GameState.day_index >= 3


func too_broke_to_order() -> bool:
	if not GameState.has_item("learning_card"):
		return false
	return GameState.card_balance < cheapest_pair_price()


## Cheapest drink plus cheapest food on today's board. Quiz only when the
## card can't cover any pair — not a forced cheap order.
func cheapest_pair_price() -> int:
	var drink_low := 9999
	var food_low := 9999
	for item in visible_items():
		var p := int(item["pesos"])
		if p <= 0:
			continue
		var kind := str(item["kind"])
		if kind == "drink":
			drink_low = mini(drink_low, p)
		elif kind == "food":
			food_low = mini(food_low, p)
	if drink_low == 9999 or food_low == 9999:
		return 9999
	return drink_low + food_low


func cheapest_price() -> int:
	return cheapest_pair_price()


func reply_for(text: String) -> String:
	var order := text.strip_edges()
	if _practicing:
		return _practice_reply(order)
	if order == "":
		return "Mara waits patiently. \"Take your time — look at the board again if you need to.\""
	var lemmas := match_lemmas(order)
	if lemmas.is_empty() or (_lemma_of_kind(lemmas, "drink") == "" and _lemma_of_kind(lemmas, "food") == ""):
		return (
			"Mara tilts her head. \"I didn't catch that — %s this morning?\""
		) % ", ".join(_visible_lemmas(false))
	var missing := _missing_half_line(lemmas)
	if missing != "":
		return missing
	if needs_y() and not _has_y(order):
		return _y_nudge(lemmas)
	var english := _english_extra_nudge(order, lemmas)
	if english != "":
		return english
	if needs_con() and _has_addon(lemmas) and not _has_con(order):
		return _con_nudge(lemmas)
	if not GameState.has_item("learning_card"):
		return "Mara glances at the reader. \"You'll want the learning card from the elder's basket first — no borrowing past zero.\""
	var total := order_total(lemmas)
	if total <= 0 or not GameState.try_pay(total):
		return (
			"Mara checks the register. \"%d pesos for this order.\"\n\n"
			+ "\"Your learning card only has %d pesos — I can't start it until you have enough on the card.\""
		) % [total, GameState.card_balance]
	taken = true
	open_box_on_close = false
	served = lemmas
	_drink = _lemma_of_kind(lemmas, "drink")
	_food = _lemma_of_kind(lemmas, "food")
	cup_left = 4 if _drink != "" else 0
	muffin_left = 3 if _food != "" else 0
	_remember(lemmas)
	order_ready.emit(lemmas)
	# Gold: ready in this same line, with a visible cup/food on the player.
	return (
		"Mara repeats it back, calm and clear: \"%s.\"\n\n"
		+ "That's %d pesos from your card. \"Here you go — that's ready.\""
	) % [_echo(lemmas), total]


func still_holding() -> bool:
	return cup_left > 0 or muffin_left > 0


func sip() -> bool:
	if cup_left <= 0:
		return false
	cup_left -= 1
	_mark_meal_if_done()
	return true


func bite() -> bool:
	if muffin_left <= 0:
		return false
	muffin_left -= 1
	_mark_meal_if_done()
	return true


func _mark_meal_if_done() -> void:
	if taken and cup_left <= 0 and muffin_left <= 0:
		meal_done = true
		GameState.note_cafe_meal_done()


func texture_for(lemmas: PackedStringArray = PackedStringArray()) -> Texture2D:
	if lemmas.is_empty():
		lemmas = served
	var drink := _lemma_of_kind(lemmas, "drink")
	var food := _lemma_of_kind(lemmas, "food")
	var has_food := muffin_left > 0 and food != ""
	var has_drink := cup_left > 0 and drink != ""
	if not has_food and not has_drink:
		return null
	var w := 16 if has_drink and has_food else 10
	var img := Image.create(w, 12, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	if has_drink:
		_draw_cup(img, 0, drink)
	if has_food:
		_draw_muffin(img, 8 if has_drink else 1, food)
	return ImageTexture.create_from_image(img)


func order_total(lemmas: PackedStringArray) -> int:
	var total := 0
	for item in ITEMS:
		if lemmas.has(str(item["lemma"])):
			total += int(item["pesos"])
	return total


func board_text() -> String:
	var drinks: Array = []
	var foods: Array = []
	var addons: Array = []
	var preps: Array = []
	for item in visible_items():
		var kind := str(item["kind"])
		if kind == "drink":
			drinks.append(item)
		elif kind == "food":
			foods.append(item)
		elif kind == "addon":
			addons.append(item)
		else:
			preps.append(item)
	var lines: PackedStringArray = ["Hoy / today", "", "Hot drinks"]
	for item in drinks:
		lines.append(_menu_line(item))
	if not foods.is_empty():
		lines.append("")
		lines.append("Food")
		for item in foods:
			lines.append(_menu_line(item))
	if not addons.is_empty():
		lines.append("")
		lines.append("Add-ons")
		for item in addons:
			lines.append(_menu_line(item))
	if not preps.is_empty():
		lines.append("")
		lines.append("Ask Mara")
		for item in preps:
			lines.append(_menu_line(item))
	for item in _new_today_items():
		lines.append("")
		lines.append("(New today: %s — %s)" % [str(item["lemma"]), str(item["en"])])
	lines.append("")
	if GameState.day_index < 7:
		lines.append("More of the board opens as the week goes on. One language at a time on the wall.")
	else:
		lines.append("One language at a time on the wall.")
	return "\n".join(lines)


func visible_items() -> Array:
	var day := mini(GameState.day_index, 7)
	var out: Array = []
	for d in range(1, day + 1):
		for item in ITEMS:
			if int(item["unlock_day"]) == d:
				out.append(item)
	return out


func match_lemmas(order: String) -> PackedStringArray:
	var hay := _fold(order)
	var items := visible_items()
	items.sort_custom(func(a, b): return _longest_needle(a) > _longest_needle(b))
	var found: PackedStringArray = []
	for item in items:
		for needle: String in item["needles"]:
			if _has_word(hay, needle):
				found.append(str(item["lemma"]))
				break
	return found


func _visible_lemmas(include_addons: bool) -> PackedStringArray:
	var names: PackedStringArray = []
	for item in visible_items():
		if not include_addons and _is_extra(item):
			continue
		names.append(str(item["lemma"]))
	return names


func _new_today_items() -> Array:
	var day := GameState.day_index
	if day < 1 or day > 7:
		return []
	var out: Array = []
	for item in ITEMS:
		if int(item["unlock_day"]) == day and bool(item.get("new_today", false)):
			out.append(item)
	return out


func _menu_line(item: Dictionary) -> String:
	if str(item["kind"]) == "prep":
		return "%s — %s" % [str(item["lemma"]), str(item["en"])]
	var pesos := int(item["pesos"])
	var price := "included" if pesos == 0 else "%d pesos" % pesos
	return "%s — %s (%s)" % [str(item["lemma"]), price, str(item["en"])]


func _echo(lemmas: PackedStringArray) -> String:
	var drink := _lemma_of_kind(lemmas, "drink")
	var food := _lemma_of_kind(lemmas, "food")
	var addons := _lemmas_of_kind(lemmas, "addon")
	if lemmas.has("frío") and drink != "":
		drink = drink + " frío"
	if lemmas.has("calentado") and food != "":
		food = food + " calentado"
	var core := ""
	if drink != "" and food != "":
		if needs_y() or GameState.week_number >= 2:
			core = drink + " y " + food
		else:
			core = drink + ", " + food
	elif drink != "":
		core = drink
	else:
		core = food
	if addons.is_empty():
		return core
	if needs_con() or GameState.week_number >= 2:
		return core + " con " + _join_y(addons)
	return core + ", " + ", ".join(addons)


func _is_real_order(lemmas: PackedStringArray) -> bool:
	return _lemma_of_kind(lemmas, "drink") != "" and _lemma_of_kind(lemmas, "food") != ""


func _has_y(order: String) -> bool:
	return _has_word(_fold(order), "y")


func _has_con(order: String) -> bool:
	return _has_word(_fold(order), "con")


func _y_nudge(lemmas: PackedStringArray) -> String:
	var drink := _lemma_of_kind(lemmas, "drink")
	var food := _lemma_of_kind(lemmas, "food")
	if _has_addon(lemmas):
		return (
			"Mara tilts her head, kind. \"Almost — here we say y, and extras use con. %s y %s con %s?\""
		) % [drink, food, _join_y(_lemmas_of_kind(lemmas, "addon"))]
	return (
		"Mara tilts her head, kind. \"Almost — here we say y. %s y %s?\""
	) % [drink, food]


func _con_nudge(lemmas: PackedStringArray) -> String:
	var drink := _lemma_of_kind(lemmas, "drink")
	var food := _lemma_of_kind(lemmas, "food")
	var extra := _join_y(_lemmas_of_kind(lemmas, "addon"))
	return (
		"Mara tilts her head, kind. \"Almost — extras use con. %s y %s con %s?\""
	) % [drink, food, extra]


func _missing_half_line(lemmas: PackedStringArray) -> String:
	var drink := _lemma_of_kind(lemmas, "drink")
	var food := _lemma_of_kind(lemmas, "food")
	if drink != "" and food == "":
		return (
			"Mara nods. \"%s — and something to eat with it? A food from the board too.\""
		) % drink
	if food != "" and drink == "":
		return (
			"Mara nods. \"%s — and a drink to go with it?\""
		) % food
	return ""


func _remember(lemmas: PackedStringArray) -> void:
	for lemma in lemmas:
		if _kind_of(lemma) == "addon" or _kind_of(lemma) == "prep":
			continue
		if not ordered.has(lemma):
			ordered.append(lemma)


func _begin_practice() -> bool:
	var pick := _practice_pick()
	if pick.is_empty():
		_practicing = false
		return false
	_practicing = true
	_practice_lemma = str(pick["lemma"])
	_practice_en = str(pick["en"])
	return true


func _practice_pick() -> Dictionary:
	if _practice_lemma != "" and not ordered.has(_practice_lemma):
		for item in visible_items():
			if _is_extra(item):
				continue
			if str(item["lemma"]) == _practice_lemma:
				return item
	var fresh: Array = []
	var any_item: Array = []
	for item in visible_items():
		if _is_extra(item):
			continue
		any_item.append(item)
		if not ordered.has(str(item["lemma"])):
			fresh.append(item)
	var pool: Array = fresh if not fresh.is_empty() else any_item
	if pool.is_empty():
		return {}
	if pool.size() > 1 and _practice_lemma != "":
		var rotated: Array = []
		for item in pool:
			if str(item["lemma"]) != _practice_lemma:
				rotated.append(item)
		if not rotated.is_empty():
			pool = rotated
	return pool[0]


func _practice_prompt() -> String:
	return (
		"Mara leans on the counter. \"Your card's a little short — but we can practice what's on the board.\"\n\n"
		+ "What do we call %s in Spanish? (Check the wall if you need to.)"
	) % _practice_en


func _practice_reply(attempt: String) -> String:
	_practicing = false
	open_box_on_close = false
	if attempt == "":
		return "Mara waits patiently. \"Take your time — look at the board again if you need to.\""
	if _practice_lemma == "" or not match_lemmas(attempt).has(_practice_lemma):
		return (
			"Mara points gently at the board. \"Not quite — look for %s up there. The word is %s. Come back when you're ready to try again.\""
		) % [_practice_en, _practice_lemma]
	var grant := _practice_grant()
	_remember(PackedStringArray([_practice_lemma]))
	meal_done = true
	GameState.note_cafe_meal_done()
	var line := "Mara smiles. \"That sounds lovely, dear.\""
	if grant > 0:
		line += " \"The learning program added %d pesos to your card for practice.\"" % grant
	else:
		line += " \"You've practiced plenty for today — the word will stick.\""
	line += " \"Say %s once more on your way out and it'll feel natural.\"" % _practice_lemma
	return line


func _practice_grant() -> int:
	if _practice_earned_day != GameState.day_index:
		_practice_earned_day = GameState.day_index
		_practice_earned = 0
	var room := PRACTICE_MAX_DAY - _practice_earned
	var grant := mini(PRACTICE_PESOS, room)
	if grant <= 0:
		return 0
	GameState.add_balance(grant)
	_practice_earned += grant
	return grant


func _lemma_of_kind(lemmas: PackedStringArray, kind: String) -> String:
	for item in ITEMS:
		if str(item["kind"]) == kind and lemmas.has(str(item["lemma"])):
			return str(item["lemma"])
	return ""


func _lemmas_of_kind(lemmas: PackedStringArray, kind: String) -> PackedStringArray:
	var out: PackedStringArray = []
	for item in ITEMS:
		var lemma := str(item["lemma"])
		if str(item["kind"]) == kind and lemmas.has(lemma):
			out.append(lemma)
	return out


func _has_addon(lemmas: PackedStringArray) -> bool:
	return not _lemmas_of_kind(lemmas, "addon").is_empty()


func _kind_of(lemma: String) -> String:
	for item in ITEMS:
		if str(item["lemma"]) == lemma:
			return str(item["kind"])
	return ""


func _is_extra(item: Dictionary) -> bool:
	var kind := str(item["kind"])
	return kind == "addon" or kind == "prep"


func _is_unlocked(lemma: String) -> bool:
	for item in visible_items():
		if str(item["lemma"]) == lemma:
			return true
	return false


func _join_y(parts: PackedStringArray) -> String:
	if parts.is_empty():
		return ""
	if parts.size() == 1:
		return parts[0]
	var head := PackedStringArray()
	for i in range(parts.size() - 1):
		head.append(parts[i])
	return ", ".join(head) + " y " + parts[parts.size() - 1]


func _english_extra_nudge(order: String, lemmas: PackedStringArray) -> String:
	var hay := _fold(order)
	var hints: PackedStringArray = []
	if _has_word(hay, "sugar") and _is_unlocked("azúcar") and not lemmas.has("azúcar"):
		hints.append("azúcar")
	if _has_word(hay, "milk") and _is_unlocked("leche") and not lemmas.has("leche"):
		hints.append("leche")
	if (_has_word(hay, "creamer") or _has_word(hay, "cream")) and _is_unlocked("crema") and not lemmas.has("crema"):
		hints.append("crema")
	if (_has_word(hay, "warmed") or _has_word(hay, "heated")) and _is_unlocked("calentado") and not lemmas.has("calentado"):
		hints.append("calentado")
	if (
		_has_word(hay, "iced")
		or _has_word(hay, "chilled")
		or _has_word(hay, "ice")
	) and _is_unlocked("frío") and not lemmas.has("frío"):
		hints.append("frío")
	if hints.is_empty():
		return ""
	return (
		"Mara nods at the board. \"That extra is %s — Spanish on this wall.\""
	) % _join_y(hints)


func _longest_needle(item: Dictionary) -> int:
	var n := 0
	for needle: String in item["needles"]:
		n = maxi(n, needle.length())
	return n


func _has_word(hay: String, needle: String) -> bool:
	var n := _fold(needle)
	if n == "":
		return false
	return (" " + hay + " ").find(" " + n + " ") >= 0


func _draw_cup(img: Image, ox: int, drink: String) -> void:
	var cream := Color(0.94, 0.93, 0.89)
	var inner := Color(0.91, 0.86, 0.78)
	var handle := Color(0.83, 0.69, 0.42)
	var foam := Color(0.91, 0.88, 0.82)
	var liquid := Color(0.48, 0.31, 0.16)
	if drink == "té":
		liquid = Color(0.77, 0.63, 0.35)
	elif drink == "chocolate caliente":
		liquid = Color(0.42, 0.22, 0.14)
	elif drink == "espresso":
		liquid = Color(0.28, 0.16, 0.10)
	_fill(img, ox + 1, 4, 6, 7, cream)
	_fill(img, ox + 2, 5, 4, 5, inner)
	_fill(img, ox + 0, 6, 2, 3, handle)
	_fill(img, ox + 2, 3, 4, 1, foam)
	var h := mini(cup_left, 4)
	if h > 0:
		_fill(img, ox + 2, 9 - h, 4, h, liquid)


func _draw_muffin(img: Image, ox: int, food: String = "muffin") -> void:
	var plate := Color(0.91, 0.88, 0.82)
	var cake := Color(0.77, 0.60, 0.35)
	var top := Color(0.83, 0.67, 0.42)
	if food == "tostada":
		cake = Color(0.86, 0.74, 0.52)
		top = Color(0.78, 0.58, 0.32)
	elif food == "croissant":
		cake = Color(0.86, 0.68, 0.38)
		top = Color(0.91, 0.76, 0.48)
	elif food == "galleta":
		cake = Color(0.72, 0.50, 0.28)
		top = Color(0.55, 0.34, 0.18)
	elif food == "bolillo":
		cake = Color(0.90, 0.80, 0.58)
		top = Color(0.82, 0.68, 0.42)
	_fill(img, ox, 9, 8, 2, plate)
	var h := mini(muffin_left, 3) + 1
	_fill(img, ox + 1, 9 - h, 6, h, cake)
	if muffin_left >= 2:
		_fill(img, ox + 2, 8 - h, 4, 2, top)


func _fill(img: Image, x: int, y: int, w: int, h: int, c: Color) -> void:
	for iy in range(y, y + h):
		for ix in range(x, x + w):
			if ix < 0 or iy < 0 or ix >= img.get_width() or iy >= img.get_height():
				continue
			img.set_pixel(ix, iy, c)


func _fold(s: String) -> String:
	var t := s.strip_edges().to_lower()
	t = t.replace("é", "e").replace("á", "a").replace("í", "i")
	t = t.replace("ó", "o").replace("ú", "u").replace("ü", "u").replace("ñ", "n")
	var out := ""
	for i in t.length():
		var ch := t.substr(i, 1)
		if ch >= "a" and ch <= "z":
			out += ch
		else:
			out += " "
	return out.strip_edges()
