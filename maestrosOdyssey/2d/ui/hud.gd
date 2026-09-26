extends CanvasLayer
# Autoload. After the player picks up the learning card: weekday, week, and
# pesos — three short lines, top-left. Hearts stay off; this is not a fighting
# game.
#
# The bottom row is slot 1 and slot 2. Berries, logs, or the one learning
# card sit in those boxes. A small 1 and 2 stay on them. The home crate and
# the home barrel each open the same row of storage boxes.

const PAD := 10
const LINE := 16
const INK := Color(0.96, 0.90, 0.78)
const FILL := Color(0.14, 0.10, 0.07, 0.92)
const GOLD := Color(0.55, 0.42, 0.26)
const GOLD_BRIGHT := Color(0.95, 0.78, 0.38)
const SLOT := 22
## Two pockets until the satchel, then five. Empty ones stay.
const CRATE_SLOTS := 8
const GAP := 2

var _day: Label
var _week: Label
var _pesos: Label
var _bar_host: CenterContainer
var _bar: HBoxContainer
var _crate_panel: PanelContainer
var _crate_row: HBoxContainer
var _carry_buttons: Array[Button] = []
var _crate_buttons: Array[Button] = []
var berry_count: Label
var crate_open := false
var barrel_open := false
## Stored stack the next Pick will bring back. Empty string if none.
var crate_choice := ""

var _berry_tex: Texture2D
var _goose_tex: Texture2D
var _log_tex: Texture2D
var _card_tex: Texture2D
var _card_button: Button
var _card_settled := false


var _day_skip: Control
var _owner_gate_done := false


func _ready() -> void:
	layer = 15
	process_mode = Node.PROCESS_MODE_ALWAYS
	_day = _make_line(0)
	_week = _make_line(LINE)
	_pesos = _make_line(LINE * 2)
	_berry_tex = _draw_berries()
	_goose_tex = _draw_gooseberries()
	_log_tex = _draw_log()
	_card_tex = _draw_card()
	_build_bar()
	_build_crate()
	_build_day_skip()
	get_viewport().size_changed.connect(_place_day_skip)
	_gate_day_skip()
	GameState.item_taken.connect(_on_item_taken)


func _make_line(y: float) -> Label:
	var lab := Label.new()
	lab.add_theme_font_size_override("font_size", 13)
	lab.add_theme_color_override("font_color", INK)
	lab.add_theme_color_override("font_outline_color", Color.BLACK)
	lab.add_theme_constant_override("outline_size", 4)
	lab.position = Vector2(PAD, PAD + y)
	lab.hide()
	add_child(lab)
	return lab


func _build_bar() -> void:
	_bar_host = CenterContainer.new()
	_bar_host.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_bar_host)
	_bar = HBoxContainer.new()
	_bar.add_theme_constant_override("separation", GAP)
	_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bar_host.add_child(_bar)
	_fill_pockets(2)
	_bar.hide()


func _fill_pockets(n: int) -> void:
	for child in _bar.get_children():
		child.queue_free()
	_carry_buttons.clear()
	var width := float(n * SLOT + (n - 1) * GAP)
	_pin_bottom(_bar_host, width, -34, -6)
	for i in n:
		var btn := _make_slot(false, i)
		_bar.add_child(btn)
		_carry_buttons.append(btn)
		_add_mark(btn, str(i + 1))
	if _carry_buttons.is_empty():
		return
	_card_button = _carry_buttons[0]
	berry_count = _count_label(_carry_buttons[0])


## Owner test. Not a story control. Top-right, clear of talk and the pockets.
func _build_day_skip() -> void:
	var stack := VBoxContainer.new()
	stack.name = "DaySkip"
	stack.add_theme_constant_override("separation", 2)
	stack.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(stack)
	_day_skip = stack
	var top := HBoxContainer.new()
	var bottom := HBoxContainer.new()
	for row in [top, bottom]:
		row.add_theme_constant_override("separation", 2)
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		stack.add_child(row)
	for day in range(2, 9):
		var btn := Button.new()
		btn.text = "Day %d" % day
		btn.focus_mode = Control.FOCUS_NONE
		btn.add_theme_font_size_override("font_size", 10)
		btn.custom_minimum_size = Vector2(44, 18)
		btn.pressed.connect(GameState.skip_to_morning.bind(day))
		if day <= 5:
			top.add_child(btn)
		else:
			bottom.add_child(btn)
	_place_day_skip()


func _place_day_skip() -> void:
	if _day_skip == null:
		return
	var need := _day_skip.get_combined_minimum_size().x
	var w := get_viewport().get_visible_rect().size.x
	_day_skip.position = Vector2(maxf(8.0, w - need - 64.0), 6.0)


func _gate_day_skip() -> void:
	if _day_skip == null:
		return
	if not OS.has_feature("web"):
		_owner_gate_done = true
		_day_skip.show()
		return
	_day_skip.hide()
	GameState.day_skip_allowed = false


func _build_crate() -> void:
	_crate_panel = PanelContainer.new()
	_crate_panel.add_theme_stylebox_override("panel", _panel_box())
	# Above the talk prompt, so "T — Talk" stays readable.
	_pin_bottom(_crate_panel, 214, -168, -128)
	_crate_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	_crate_panel.hide()
	add_child(_crate_panel)
	var center := CenterContainer.new()
	_crate_panel.add_child(center)
	_crate_row = HBoxContainer.new()
	_crate_row.add_theme_constant_override("separation", GAP)
	center.add_child(_crate_row)
	for i in CRATE_SLOTS:
		var btn := _make_slot(true, i)
		_crate_row.add_child(btn)
		_crate_buttons.append(btn)


func _pin_bottom(node: Control, width: float, top: float, bottom: float) -> void:
	node.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	node.offset_left = -width * 0.5
	node.offset_right = width * 0.5
	node.offset_top = top
	node.offset_bottom = bottom


func _panel_box() -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = FILL
	box.border_color = GOLD
	box.set_border_width_all(2)
	box.set_content_margin_all(6)
	box.set_corner_radius_all(3)
	return box


func _make_slot(in_crate: bool, index: int) -> Button:
	var btn := Button.new()
	btn.focus_mode = Control.FOCUS_NONE
	btn.custom_minimum_size = Vector2(SLOT, SLOT)
	btn.mouse_filter = Control.MOUSE_FILTER_STOP
	var icon := TextureRect.new()
	icon.name = "Icon"
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
	icon.set_anchors_preset(Control.PRESET_FULL_RECT)
	icon.offset_left = 3
	icon.offset_top = 2
	icon.offset_right = -3
	icon.offset_bottom = -6
	btn.add_child(icon)
	var num := Label.new()
	num.name = "Count"
	num.mouse_filter = Control.MOUSE_FILTER_IGNORE
	num.add_theme_font_size_override("font_size", 9)
	num.add_theme_color_override("font_color", INK)
	num.add_theme_color_override("font_outline_color", Color.BLACK)
	num.add_theme_constant_override("outline_size", 2)
	num.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	num.offset_left = -18
	num.offset_top = -12
	num.offset_right = -1
	num.offset_bottom = -1
	num.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	btn.add_child(num)
	if in_crate:
		btn.pressed.connect(_on_crate_slot.bind(index))
	elif index >= 0:
		btn.pressed.connect(_on_carry_slot.bind(index))
	return btn


func _add_mark(btn: Button, text: String) -> void:
	var mark := Label.new()
	mark.name = "Mark"
	mark.text = text
	mark.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mark.add_theme_font_size_override("font_size", 8)
	mark.add_theme_color_override("font_color", INK)
	mark.add_theme_color_override("font_outline_color", Color.BLACK)
	mark.add_theme_constant_override("outline_size", 2)
	mark.position = Vector2(1, -1)
	btn.add_child(mark)


func _count_label(btn: Button) -> Label:
	return btn.get_node("Count") as Label


func _read_page_skip() -> void:
	if not OS.has_feature("web"):
		return
	var skip := int(JavaScriptBridge.eval("Number(window.MO_SKIP_DAY || 0)", true))
	if skip < 2 or skip > 8:
		return
	JavaScriptBridge.eval("window.MO_SKIP_DAY = 0", true)
	GameState.day_skip_allowed = true
	GameState.skip_to_morning(skip)


func _process(_delta: float) -> void:
	_read_page_skip()
	var on_you := GameState.has_item("learning_card")
	if not on_you and not GameState.card_picked_up:
		_day.hide()
		_week.hide()
		_pesos.hide()
		_bar.hide()
		_close_crate()
		return
	if on_you:
		_day.text = GameState.weekday
		_week.text = "Week %d" % GameState.week_number
		_pesos.text = "%d pesos" % GameState.card_balance
		_day.show()
		_week.show()
		_pesos.show()
	else:
		_day.hide()
		_week.hide()
		_pesos.hide()
	_bar.show()
	if _carry_buttons.size() != GameState.pocket_count():
		_fill_pockets(GameState.pocket_count())
	if (crate_open or barrel_open) and not _at_home():
		_close_crate()
	GameState.settle_slots()
	_paint_carry()
	_paint_card()
	var store := _open_store()
	_paint(_crate_buttons, GameState.store_ids(store), true)
	if crate_choice != "" and GameState.store_count(store, crate_choice) <= 0:
		crate_choice = ""


func toggle_crate() -> void:
	_toggle_store("crate")


func toggle_barrel() -> void:
	_toggle_store("barrel")


func _toggle_store(which: String) -> void:
	var already := (which == "crate" and crate_open) or (which == "barrel" and barrel_open)
	if already:
		_close_crate()
		return
	_close_crate()
	crate_choice = ""
	if which == "barrel":
		barrel_open = true
	else:
		crate_open = true
	_crate_panel.show()


func _close_crate() -> void:
	crate_open = false
	barrel_open = false
	crate_choice = ""
	if _crate_panel != null:
		_crate_panel.hide()


func storage_open() -> bool:
	return crate_open or barrel_open


func _open_store() -> String:
	return "barrel" if barrel_open else "crate"


func crate_prompt() -> String:
	if not storage_open():
		return "E — Open"
	var bits: PackedStringArray = ["E — Close"]
	if crate_choice != "":
		bits.append("P — Pick")
	elif GameState.carry_count(GameState.held_item()) > 0:
		bits.append("P — Place")
	return "   ".join(bits)


func _on_carry_slot(index: int) -> void:
	# The learning card is not slot 1 or slot 2.
	if index < 0 or index >= GameState.pocket_count():
		return
	GameState.select_slot(index)
	crate_choice = ""


func _on_crate_slot(index: int) -> void:
	var ids := GameState.store_ids(_open_store())
	if index < 0 or index >= ids.size():
		return
	crate_choice = ids[index]


func _paint_carry() -> void:
	var found_card: Button = null
	for i in _carry_buttons.size():
		var btn := _carry_buttons[i]
		var item_id := GameState.slot_item(i)
		var icon := btn.get_node("Icon") as TextureRect
		var num := btn.get_node("Count") as Label
		var n := GameState.carry_count(item_id)
		if item_id == "" or n <= 0:
			icon.texture = null
			num.text = ""
			_reset_icon(icon)
		elif item_id == "learning_card":
			icon.texture = _card_tex
			icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
			num.text = ""
			found_card = btn
		elif item_id == "cafe_drink" or item_id == "cafe_food":
			icon.texture = icon_for(item_id)
			num.text = ""
			_reset_icon(icon)
		else:
			icon.texture = icon_for(item_id)
			num.text = str(n)
			_reset_icon(icon)
			if item_id == "blueberries":
				berry_count = num
		_style_slot(btn, i == GameState.held_slot)
	if found_card != _card_button:
		_card_settled = false
	_card_button = found_card


func _paint(buttons: Array[Button], ids: Array[String], in_crate: bool) -> void:
	for i in buttons.size():
		var btn := buttons[i]
		var item_id := ids[i] if i < ids.size() else ""
		var icon := btn.get_node("Icon") as TextureRect
		var num := btn.get_node("Count") as Label
		var bright := false
		if item_id == "":
			icon.texture = null
			num.text = ""
		else:
			icon.texture = icon_for(item_id)
			var n := GameState.store_count(_open_store(), item_id) if in_crate else GameState.carry_count(item_id)
			num.text = "" if item_id == "learning_card" else str(n)
			if in_crate:
				bright = item_id == crate_choice
		_style_slot(btn, bright)


func _style_slot(btn: Button, bright: bool) -> void:
	var box := StyleBoxFlat.new()
	box.bg_color = FILL
	box.border_color = GOLD_BRIGHT if bright else GOLD
	box.set_border_width_all(2 if bright else 1)
	box.set_corner_radius_all(2)
	btn.add_theme_stylebox_override("normal", box)
	btn.add_theme_stylebox_override("hover", box)
	btn.add_theme_stylebox_override("pressed", box)
	btn.add_theme_stylebox_override("focus", box)


func _paint_card() -> void:
	if _card_button == null:
		return
	var icon := _card_button.get_node("Icon") as TextureRect
	var num := _card_button.get_node("Count") as Label
	icon.texture = _card_tex
	num.text = ""
	if not _card_settled:
		_card_settled = true
		icon.offset_left = 1
		icon.offset_right = -1
		_settle_card(icon)


func _on_item_taken(item: Dictionary) -> void:
	if str(item.get("id", "")) != "learning_card":
		return
	_card_settled = false


func _settle_card(icon: TextureRect) -> void:
	icon.offset_top = -14.0
	icon.offset_bottom = -20.0
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_QUAD)
	tween.set_ease(Tween.EASE_OUT)
	tween.tween_property(icon, "offset_top", 3.0, 0.35)
	tween.parallel().tween_property(icon, "offset_bottom", -3.0, 0.35)


func icon_for(item_id: String) -> Texture2D:
	if item_id == "logs":
		return _log_tex
	if item_id == "gooseberries":
		return _goose_tex
	if item_id == "learning_card":
		return _card_tex
	if item_id == "cafe_drink" or item_id == "cafe_food":
		return CafeOrder.slot_icon(item_id)
	return _berry_tex


func _reset_icon(icon: TextureRect) -> void:
	icon.offset_left = 3
	icon.offset_top = 2
	icon.offset_right = -3
	icon.offset_bottom = -6


## A wide cream card with a dull gold edge and a small café cup.
## Not a bank card: no chip, no stripe, no brand colors.
func _draw_card() -> Texture2D:
	var img := Image.create(16, 16, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var paper := Color(0.94, 0.88, 0.74, 1.0)
	var edge := Color(0.55, 0.42, 0.26, 1.0)
	var cup := Color(0.48, 0.30, 0.16, 1.0)
	var inside := Color(0.72, 0.48, 0.28, 1.0)
	for x in range(2, 14):
		img.set_pixel(x, 5, edge)
		img.set_pixel(x, 11, edge)
	for y in range(6, 11):
		img.set_pixel(1, y, edge)
		img.set_pixel(14, y, edge)
	for x in range(2, 14):
		for y in range(6, 11):
			img.set_pixel(x, y, paper)
	img.set_pixel(2, 5, Color(0, 0, 0, 0))
	img.set_pixel(13, 5, Color(0, 0, 0, 0))
	img.set_pixel(2, 11, Color(0, 0, 0, 0))
	img.set_pixel(13, 11, Color(0, 0, 0, 0))
	img.set_pixel(2, 6, edge)
	img.set_pixel(13, 6, edge)
	img.set_pixel(2, 10, edge)
	img.set_pixel(13, 10, edge)
	for x in range(6, 10):
		img.set_pixel(x, 7, cup)
	img.set_pixel(6, 8, cup)
	img.set_pixel(7, 8, inside)
	img.set_pixel(8, 8, inside)
	img.set_pixel(9, 8, cup)
	img.set_pixel(10, 8, cup)
	for x in range(6, 10):
		img.set_pixel(x, 9, cup)
	return ImageTexture.create_from_image(img)


func _at_home() -> bool:
	return (
		Interiors.inside()
		and Interiors.current != null
		and Interiors.current.building_id == "player_house"
	)


## A few berry dots, the same blue the bushes use.
func _draw_berries() -> Texture2D:
	var img := Image.create(16, 16, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var leaf := Color(0.22, 0.42, 0.22, 1.0)
	var dot := Color(0.18, 0.28, 0.72, 1.0)
	for p in [Vector2i(4, 10), Vector2i(5, 10), Vector2i(4, 11), Vector2i(8, 8), Vector2i(9, 8)]:
		img.set_pixel(p.x, p.y, leaf)
	for p in [Vector2i(6, 6), Vector2i(7, 6), Vector2i(6, 7), Vector2i(10, 9), Vector2i(11, 9), Vector2i(10, 10), Vector2i(5, 12), Vector2i(8, 5)]:
		img.set_pixel(p.x, p.y, dot)
	return ImageTexture.create_from_image(img)


func _draw_gooseberries() -> Texture2D:
	var img := Image.create(16, 16, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var leaf := Color(0.22, 0.42, 0.22, 1.0)
	var dot := Color(0.55, 0.62, 0.28, 1.0)
	for p in [Vector2i(4, 10), Vector2i(5, 10), Vector2i(8, 8)]:
		img.set_pixel(p.x, p.y, leaf)
	for p in [Vector2i(6, 6), Vector2i(7, 6), Vector2i(10, 9), Vector2i(11, 9), Vector2i(5, 12)]:
		img.set_pixel(p.x, p.y, dot)
	return ImageTexture.create_from_image(img)


## A short cut log, warm brown like the crate wood.
func _draw_log() -> Texture2D:
	var img := Image.create(16, 16, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var wood := Color(0.55, 0.34, 0.16, 1.0)
	var end := Color(0.72, 0.52, 0.28, 1.0)
	var ring := Color(0.40, 0.24, 0.12, 1.0)
	for x in range(3, 13):
		for y in range(6, 10):
			img.set_pixel(x, y, wood)
	for y in range(6, 10):
		img.set_pixel(3, y, end)
		img.set_pixel(12, y, ring)
	img.set_pixel(4, 7, ring)
	img.set_pixel(4, 8, ring)
	return ImageTexture.create_from_image(img)
