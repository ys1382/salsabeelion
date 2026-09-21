extends Node
# Dragon's Brew day-one order at Mara. Menu must be read first; then a typed
# line is matched against the board (café, té, muffin). A match takes pesos
# from the learning card in the same reply — no extra pay tap, no kitchen wait.
# Sit to sip (D) and eat (F). Leaving after a paid order turns the weekday.

signal order_ready(lemmas: PackedStringArray)
signal order_cleared

## After Mara's "what's your order?" line, the next E opens the type box.
var open_box_on_close := false
var intro_done := false
var taken := false
var served: PackedStringArray = PackedStringArray()
var cup_left := 0
var muffin_left := 0
var _tea := false

## Longest names first so "café" wins over a stray "é".
const ITEMS := [
	{"needles": ["café", "cafe", "coffee"], "lemma": "café", "pesos": 35},
	{"needles": ["muffin"], "lemma": "muffin", "pesos": 28},
	{"needles": ["té", "te", "tea"], "lemma": "té", "pesos": 30},
]


func reset_visit() -> void:
	open_box_on_close = false
	intro_done = false
	_clear_order()


## Paid order this stay? Leaving the café then turns the weekday.
func leave_cafe() -> void:
	if taken:
		GameState.advance_day()
	_clear_order()


func _clear_order() -> void:
	open_box_on_close = false
	taken = false
	served = PackedStringArray()
	cup_left = 0
	muffin_left = 0
	_tea = false
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
	open_box_on_close = true
	return str(lines[2])


func reply_for(text: String) -> String:
	var order := text.strip_edges()
	if order == "":
		return "Mara waits patiently. \"Take your time — look at the board again if you need to.\""
	var lemmas := match_lemmas(order)
	if lemmas.is_empty():
		return "Mara tilts her head. \"I didn't catch that — café, té, or a muffin this morning?\""
	if not GameState.has_item("learning_card"):
		return "Mara glances at the reader. \"You'll want the learning card from the elder's basket first — no borrowing past zero.\""
	var total := order_total(lemmas)
	if not GameState.try_pay(total):
		return (
			"Mara checks the register. \"%d pesos for this order.\"\n\n"
			+ "\"Your learning card only has %d pesos — I can't start it until you have enough on the card.\""
		) % [total, GameState.card_balance]
	taken = true
	open_box_on_close = false
	served = lemmas
	_tea = lemmas.has("té") and not lemmas.has("café")
	cup_left = 4 if _has_drink(lemmas) else 0
	muffin_left = 3 if lemmas.has("muffin") else 0
	order_ready.emit(lemmas)
	var echo := ", ".join(lemmas)
	# Gold: ready in this same line, with a visible cup/muffin on the player.
	return (
		"Mara repeats it back, calm and clear: \"%s.\"\n\n"
		+ "That's %d pesos from your card. \"Here you go — that's ready.\""
	) % [echo, total]


func still_holding() -> bool:
	return cup_left > 0 or muffin_left > 0


func sip() -> bool:
	if cup_left <= 0:
		return false
	cup_left -= 1
	return true


func bite() -> bool:
	if muffin_left <= 0:
		return false
	muffin_left -= 1
	return true


func texture_for(lemmas: PackedStringArray = PackedStringArray()) -> Texture2D:
	if lemmas.is_empty():
		lemmas = served
	var has_muffin := muffin_left > 0 and lemmas.has("muffin")
	var has_drink := cup_left > 0 and _has_drink(lemmas)
	if not has_muffin and not has_drink:
		return null
	var w := 16 if has_drink and has_muffin else 10
	var img := Image.create(w, 12, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	if has_drink:
		_draw_cup(img, 0, _tea if lemmas == served else (lemmas.has("té") and not lemmas.has("café")))
	if has_muffin:
		_draw_muffin(img, 8 if has_drink else 1)
	return ImageTexture.create_from_image(img)


func order_total(lemmas: PackedStringArray) -> int:
	var total := 0
	for item in ITEMS:
		if lemmas.has(str(item["lemma"])):
			total += int(item["pesos"])
	return total


func _has_drink(lemmas: PackedStringArray) -> bool:
	return lemmas.has("té") or lemmas.has("café")


func _draw_cup(img: Image, ox: int, tea: bool) -> void:
	var cream := Color(0.94, 0.93, 0.89)
	var inner := Color(0.91, 0.86, 0.78)
	var handle := Color(0.83, 0.69, 0.42)
	var foam := Color(0.91, 0.88, 0.82)
	var liquid := Color(0.77, 0.63, 0.35) if tea else Color(0.48, 0.31, 0.16)
	_fill(img, ox + 1, 4, 6, 7, cream)
	_fill(img, ox + 2, 5, 4, 5, inner)
	_fill(img, ox + 0, 6, 2, 3, handle)
	_fill(img, ox + 2, 3, 4, 1, foam)
	var h := mini(cup_left, 4)
	if h > 0:
		_fill(img, ox + 2, 9 - h, 4, h, liquid)


func _draw_muffin(img: Image, ox: int) -> void:
	var plate := Color(0.91, 0.88, 0.82)
	var cake := Color(0.77, 0.60, 0.35)
	var top := Color(0.83, 0.67, 0.42)
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


func match_lemmas(order: String) -> PackedStringArray:
	var hay := _fold(order)
	var found: PackedStringArray = []
	for item in ITEMS:
		for needle: String in item["needles"]:
			if hay.find(_fold(needle)) >= 0:
				found.append(str(item["lemma"]))
				break
	return found


func _fold(s: String) -> String:
	return s.strip_edges().to_lower().replace("é", "e").replace("á", "a")
