extends CanvasLayer
# Today, top right. One line until you click it, then the morning's steps.
# The arrow still shows the way. This says what the step is.

const INK := Color(0.96, 0.90, 0.78)
const DIM := Color(0.78, 0.72, 0.60)
const DONE := Color(0.62, 0.70, 0.52)

var _open := false
var _panel: PanelContainer
var _header: Button
var _list: VBoxContainer
var _rows: Array[Label] = []


func _ready() -> void:
	layer = 18
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build()


func _build() -> void:
	var host := Control.new()
	host.set_anchors_preset(Control.PRESET_FULL_RECT)
	host.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(host)

	_panel = PanelContainer.new()
	_panel.anchor_left = 1.0
	_panel.anchor_right = 1.0
	_panel.anchor_top = 0.0
	_panel.offset_left = -196
	_panel.offset_top = 8
	_panel.offset_right = -8
	_panel.offset_bottom = 28
	_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	_panel.add_theme_stylebox_override("panel", _box())
	host.add_child(_panel)

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 2)
	_panel.add_child(col)

	_header = Button.new()
	_header.flat = true
	_header.alignment = HORIZONTAL_ALIGNMENT_LEFT
	_header.clip_text = false
	_header.add_theme_font_size_override("font_size", 12)
	_header.add_theme_color_override("font_color", INK)
	_header.add_theme_color_override("font_hover_color", Color(1, 0.96, 0.86))
	_header.add_theme_color_override("font_pressed_color", INK)
	_header.pressed.connect(_toggle)
	col.add_child(_header)

	_list = VBoxContainer.new()
	_list.add_theme_constant_override("separation", 1)
	_list.hide()
	col.add_child(_list)
	for _i in 12:
		var lab := Label.new()
		lab.add_theme_font_size_override("font_size", 11)
		lab.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
		lab.add_theme_constant_override("outline_size", 3)
		lab.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		lab.hide()
		_list.add_child(lab)
		_rows.append(lab)


func _box() -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.14, 0.10, 0.07, 0.88)
	box.border_color = Color(0.55, 0.42, 0.26)
	box.set_border_width_all(1)
	box.set_content_margin_all(6)
	box.corner_radius_top_left = 3
	box.corner_radius_top_right = 3
	box.corner_radius_bottom_left = 3
	box.corner_radius_bottom_right = 3
	return box


func _toggle() -> void:
	_open = not _open
	_list.visible = _open


func _process(_delta: float) -> void:
	if Journal.is_open() or GameState.world.is_empty():
		_panel.hide()
		return
	var steps := _steps()
	if steps.is_empty():
		_panel.hide()
		return
	_panel.show()
	var current := ""
	for step in steps:
		if str(step.get("state", "")) == "now":
			current = str(step["text"])
			break
	if current == "":
		current = str(steps[0]["text"])
	_header.text = ("v  Today" if _open else ">  " + current)
	for i in _rows.size():
		var lab := _rows[i]
		if i >= steps.size():
			lab.hide()
			continue
		var step: Dictionary = steps[i]
		var state := str(step.get("state", ""))
		if state == "done":
			lab.text = "x  " + str(step["text"])
			lab.add_theme_color_override("font_color", DONE)
		elif state == "now":
			lab.text = ">  " + str(step["text"])
			lab.add_theme_color_override("font_color", INK)
		else:
			lab.text = "-  " + str(step["text"])
			lab.add_theme_color_override("font_color", DIM)
		lab.show()
	if not _open:
		for lab in _rows:
			lab.hide()
	var need := _panel.get_combined_minimum_size()
	var view_w := get_viewport().get_visible_rect().size.x
	var width := clampf(need.x, 140.0, maxf(140.0, view_w - 20.0))
	_panel.offset_right = -8
	_panel.offset_left = -8 - width
	_panel.offset_top = 8
	_panel.offset_bottom = 8 + need.y


func screen_rect() -> Rect2:
	if _panel == null or not _panel.visible:
		return Rect2()
	return _panel.get_global_rect()


func _steps() -> Array[Dictionary]:
	var rows: Array[Dictionary] = []
	if GameState.day_index >= 8 and not ElderReport.done:
		rows.append({"text": "Talk to the elder", "state": "now"})
		return rows

	var met := WaypointHud.elder_met()
	var card := GameState.has_item("learning_card")
	var menu := GameState.known("menu_read")
	var in_cafe := _in_cafe()
	var homeward := (
		GameState.cafe_meal_done
		and not CafeOrder.carrying_dishes
		and not CafeOrder.awaiting_bye
		and not CafeOrder.still_holding()
	)
	var ordered := (
		CafeOrder.taken
		or CafeOrder.awaiting_serve
		or CafeOrder.still_holding()
		or CafeOrder.meal_done
		or CafeOrder.awaiting_bye
		or CafeOrder.goodbye_done
		or homeward
	)
	var serve := CafeOrder.serve_step()
	var plated := (
		CafeOrder.taken
		or CafeOrder.awaiting_serve
		or CafeOrder.carrying_dishes
		or CafeOrder.awaiting_bye
		or CafeOrder.goodbye_done
	)
	var bits: Array[Dictionary] = [
		{"text": "Talk to the elder", "done": met},
		{"text": "Take the card", "done": card},
	]
	# Saturday of week one cuts wood first. Other mornings stay the café.
	# Once the meal is finished, home ends the day even if the tree was skipped.
	if GameState.forest_morning() and not GameState.cafe_meal_done:
		bits.append({
			"text": "Cut wood in the forest",
			"done": GameState.wood_cut_today(),
		})
	elif GameState.forest_morning() and GameState.wood_cut_today():
		bits.append({"text": "Cut wood in the forest", "done": true})
	bits.append_array([
		{"text": "Go to Dragon's Brew", "done": in_cafe or menu or ordered},
		{"text": "Read the menu", "done": menu or ordered},
		{"text": "Order a drink and a food", "done": ordered},
	])
	if CafeOrder.has_table_guests():
		bits.append({
			"text": "Hear the tables",
			"done": homeward or CafeOrder.meal_done or CafeOrder.still_holding()
				or serve == "wait" or serve == "pickup",
		})
		bits.append({
			"text": "Pick up your order",
			"done": CafeOrder.still_holding() or CafeOrder.meal_done or homeward,
		})
	bits.append({"text": "Finish your meal", "done": CafeOrder.meal_done or homeward})
	if plated:
		bits.append({
			"text": "Put the dishes away",
			"done": CafeOrder.awaiting_bye or CafeOrder.goodbye_done or homeward,
		})
		bits.append({
			"text": "Say goodbye",
			"done": CafeOrder.goodbye_done or homeward,
		})
	if GameState.forest_morning() and GameState.wood_cut_today():
		bits.append({
			"text": "Light the campfire",
			"done": GameState.wood_stowed_today(),
		})
	bits.append({"text": "Go home", "done": false})

	var found_now := false
	for bit in bits:
		var state := "later"
		if bool(bit["done"]):
			state = "done"
		elif not found_now:
			state = "now"
			found_now = true
		rows.append({"text": bit["text"], "state": state})
	return rows


func _in_cafe() -> bool:
	return (
		Interiors.inside()
		and Interiors.current != null
		and Interiors.current.building_id == "dragons_brew"
	)
