extends CanvasLayer
# Autoload. After the player picks up the learning card: weekday, week, and
# pesos — three short lines, top-left. Hearts stay off; this is not a fighting
# game.
#
# The bottom row is what you are carrying. Empty boxes stay so it reads as a
# bar. The home crate opens a second row of the same boxes.

const PAD := 10
const LINE := 16
const INK := Color(0.96, 0.90, 0.78)
const FILL := Color(0.14, 0.10, 0.07, 0.92)
const GOLD := Color(0.55, 0.42, 0.26)
const GOLD_BRIGHT := Color(0.95, 0.78, 0.38)
const SLOT := 22
const SLOTS := 8
const GAP := 2

var _day: Label
var _week: Label
var _pesos: Label
var _bar: HBoxContainer
var _crate_panel: PanelContainer
var _crate_row: HBoxContainer
var _carry_buttons: Array[Button] = []
var _crate_buttons: Array[Button] = []
var berry_count: Label
var crate_open := false
## Bottom box the next Place will move. Empty string if none.
var chosen_carry := ""
## Crate stack the next Pick will bring back. Empty string if none.
var crate_choice := ""

var _berry_tex: Texture2D
var _log_tex: Texture2D


func _ready() -> void:
	layer = 15
	_day = _make_line(0)
	_week = _make_line(LINE)
	_pesos = _make_line(LINE * 2)
	_berry_tex = _draw_berries()
	_log_tex = _draw_log()
	_build_bar()
	_build_crate()


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
	var host := CenterContainer.new()
	_pin_bottom(host, 190, -34, -6)
	host.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(host)
	_bar = HBoxContainer.new()
	_bar.add_theme_constant_override("separation", GAP)
	_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	host.add_child(_bar)
	for i in SLOTS:
		var btn := _make_slot(false, i)
		_bar.add_child(btn)
		_carry_buttons.append(btn)
	berry_count = _count_label(_carry_buttons[0])
	_bar.hide()


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
	for i in SLOTS:
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
	else:
		btn.pressed.connect(_on_carry_slot.bind(index))
	return btn


func _count_label(btn: Button) -> Label:
	return btn.get_node("Count") as Label


func _process(_delta: float) -> void:
	if not GameState.has_item("learning_card"):
		_day.hide()
		_week.hide()
		_pesos.hide()
		_bar.hide()
		_close_crate()
		return
	_day.text = GameState.weekday
	_week.text = "Week %d" % GameState.week_number
	_pesos.text = "%d pesos" % GameState.card_balance
	_day.show()
	_week.show()
	_pesos.show()
	_bar.show()
	if crate_open and not _at_home():
		_close_crate()
	_paint(_carry_buttons, GameState.carry_ids(), false)
	_paint(_crate_buttons, GameState.crate_ids(), true)
	if chosen_carry != "" and GameState.carry_count(chosen_carry) <= 0:
		chosen_carry = ""
	if crate_choice != "" and GameState.crate_count(crate_choice) <= 0:
		crate_choice = ""
	if chosen_carry == "" and crate_choice == "" and not GameState.carry_ids().is_empty():
		chosen_carry = GameState.carry_ids()[0]


func toggle_crate() -> void:
	if crate_open:
		_close_crate()
	else:
		crate_open = true
		crate_choice = ""
		_crate_panel.show()


func _close_crate() -> void:
	crate_open = false
	crate_choice = ""
	if _crate_panel != null:
		_crate_panel.hide()


func crate_prompt() -> String:
	if not crate_open:
		return "E — Open"
	var bits: PackedStringArray = ["E — Close"]
	if crate_choice != "":
		bits.append("P — Pick")
	elif chosen_carry != "" and GameState.carry_count(chosen_carry) > 0:
		bits.append("P — Place")
	return "   ".join(bits)


func _on_carry_slot(index: int) -> void:
	var ids := GameState.carry_ids()
	if index < 0 or index >= ids.size():
		return
	chosen_carry = ids[index]
	crate_choice = ""


func _on_crate_slot(index: int) -> void:
	var ids := GameState.crate_ids()
	if index < 0 or index >= ids.size():
		return
	crate_choice = ids[index]
	chosen_carry = ""


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
			icon.texture = _icon_for(item_id)
			var n := GameState.crate_count(item_id) if in_crate else GameState.carry_count(item_id)
			num.text = str(n)
			if in_crate:
				bright = item_id == crate_choice
			else:
				bright = item_id == chosen_carry and crate_choice == ""
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


func _icon_for(item_id: String) -> Texture2D:
	if item_id == "logs":
		return _log_tex
	return _berry_tex


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
