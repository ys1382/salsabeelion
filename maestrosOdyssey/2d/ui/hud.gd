extends CanvasLayer
# Autoload. After the player picks up the learning card: weekday, week, and
# pesos — three short lines, top-left. Hearts stay off; this is not a fighting
# game.
#
# It reads GameState each frame rather than holding a reference: the VLM
# repair pass tears the whole world down and rebuilds it mid-load, so any
# cached flag here would go stale.

const PAD := 10
const LINE := 16
const INK := Color(0.96, 0.90, 0.78)

var _day: Label
var _week: Label
var _pesos: Label
var _carry: PanelContainer
var berry_count: Label


func _ready() -> void:
	layer = 15
	_day = _make_line(0)
	_week = _make_line(LINE)
	_pesos = _make_line(LINE * 2)
	_carry = PanelContainer.new()
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.10, 0.09, 0.08, 0.92)
	box.border_color = Color(0.45, 0.38, 0.26)
	box.set_border_width_all(2)
	box.set_content_margin_all(6)
	_carry.add_theme_stylebox_override("panel", box)
	_carry.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_carry.offset_top = -36
	_carry.offset_bottom = -8
	_carry.grow_horizontal = Control.GROW_DIRECTION_BOTH
	berry_count = Label.new()
	berry_count.add_theme_font_size_override("font_size", 13)
	berry_count.add_theme_color_override("font_color", INK)
	berry_count.add_theme_color_override("font_outline_color", Color.BLACK)
	berry_count.add_theme_constant_override("outline_size", 3)
	berry_count.text = "Blueberries  0"
	_carry.add_child(berry_count)
	_carry.hide()
	add_child(_carry)


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


func _process(_delta: float) -> void:
	if not GameState.has_item("learning_card"):
		_day.hide()
		_week.hide()
		_pesos.hide()
		_carry.hide()
		return
	_day.text = GameState.weekday
	_week.text = "Week %d" % GameState.week_number
	_pesos.text = "%d pesos" % GameState.card_balance
	_day.show()
	_week.show()
	_pesos.show()
	if GameState.blueberries > 0:
		berry_count.text = "Blueberries  %d" % GameState.blueberries
		_carry.show()
	else:
		_carry.hide()
