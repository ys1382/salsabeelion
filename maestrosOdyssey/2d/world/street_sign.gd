extends Node2D
# Dragon's Brew, painted on a wooden board hung from the post.
# Houses are not labeled. The arrow does that job.
# Indoor boards (menu, house rules) stay press-E.

const CAPTIONS := {
	"cafe_sign": "Dragon's Brew",
}

const INK := Color(0.20, 0.09, 0.04)
const PLANK_A := Color(0.62, 0.40, 0.20)
const PLANK_B := Color(0.52, 0.32, 0.16)
const PLANK_C := Color(0.44, 0.26, 0.12)
const WOOD_DARK := Color(0.26, 0.14, 0.07)
const POST := Color(0.38, 0.23, 0.12)
const FONT_SIZE := 6

var caption := ""
var _lines: PackedStringArray = PackedStringArray()


static func caption_for(id: String) -> String:
	return str(CAPTIONS.get(id, ""))


func setup(text: String, _on_house: bool) -> void:
	caption = text
	_lines = PackedStringArray()
	if text == "":
		return
	var split_at := text.find(" ")
	if split_at > 0:
		_lines.append(text.substr(0, split_at))
		_lines.append(text.substr(split_at + 1))
	else:
		_lines.append(text)
	position = Vector2.ZERO
	z_index = 12
	var sprite := get_parent().get_node_or_null("Sprite") as CanvasItem
	if sprite != null:
		sprite.hide()
	queue_redraw()


func _draw() -> void:
	if _lines.is_empty():
		return
	var font := ThemeDB.fallback_font
	var widest := 0.0
	for line in _lines:
		widest = maxf(widest, font.get_string_size(line, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE).x)
	var line_h := font.get_height(FONT_SIZE)
	var board := Vector2(maxf(widest + 8.0, 28.0), line_h * _lines.size() + 5.0)
	var top := Vector2(-board.x * 0.5, -22.0 - board.y)
	# Post and a short arm the board hangs from.
	draw_rect(Rect2(Vector2(-1.5, top.y + board.y), Vector2(3, -top.y - board.y + 2)), POST)
	draw_rect(Rect2(Vector2(-3, -1), Vector2(6, 3)), WOOD_DARK)
	draw_rect(Rect2(Vector2(-3, top.y - 3), Vector2(6, 2)), WOOD_DARK)
	draw_line(Vector2(-board.x * 0.28, top.y - 2), Vector2(-board.x * 0.28, top.y), WOOD_DARK, 1.0)
	draw_line(Vector2(board.x * 0.28, top.y - 2), Vector2(board.x * 0.28, top.y), WOOD_DARK, 1.0)
	draw_rect(Rect2(top + Vector2(-1, -1), board + Vector2(2, 2)), WOOD_DARK)
	var plank_h := board.y / 3.0
	var tones: Array[Color] = [PLANK_A, PLANK_B, PLANK_C]
	for i in 3:
		draw_rect(Rect2(top + Vector2(0, plank_h * i), Vector2(board.x, plank_h + 0.5)), tones[i])
	var y := top.y + 2.0 + font.get_ascent(FONT_SIZE)
	for line in _lines:
		var w := font.get_string_size(line, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE).x
		var x := top.x + (board.x - w) * 0.5
		draw_string(font, Vector2(x, y), line, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE, INK)
		y += line_h
