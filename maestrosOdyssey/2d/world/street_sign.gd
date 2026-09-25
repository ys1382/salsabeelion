extends Node2D
# Dragon's Brew hangs above the café door. No post.
# Houses are not labeled. The arrow does that job.
# Indoor boards (menu, house rules) stay press-R.

const CAPTIONS := {
	"cafe_sign": "Dragon's Brew",
}

## Bottom of the grey attic band. The board is 12px tall so it stays under the roof.
const CAFE_BOARD_AT := Vector2(33, -32)
const INK := Color(0.20, 0.09, 0.04)
const PLANK_A := Color(0.62, 0.40, 0.20)
const PLANK_B := Color(0.52, 0.32, 0.16)
const PLANK_C := Color(0.44, 0.26, 0.12)
const WOOD_DARK := Color(0.26, 0.14, 0.07)
const FONT_SIZE := 3

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
	var sprite := get_parent().get_node_or_null("Sprite") as CanvasItem
	if sprite != null:
		sprite.hide()
	_clear_street_solid()
	visible = false
	var building := _cafe_building()
	if building == null:
		return
	var board := HangingBoard.new()
	board.name = "CafeHangingSign"
	board.position = CAFE_BOARD_AT
	board.z_index = 1
	board.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	building.add_child(board)


func _cafe_building() -> Node2D:
	var prop := get_parent()
	if prop == null:
		return null
	var layer := prop.get_parent()
	if layer == null:
		return null
	return layer.get_node_or_null("dragons_brew") as Node2D


## The old arrow sign sat in the street. Nothing solid stays there.
func _clear_street_solid() -> void:
	var body := get_parent() as CollisionObject2D
	if body == null:
		return
	body.collision_layer = 0
	var drop: Array[Node] = []
	for child in body.get_children():
		if child is CollisionPolygon2D or (child is CollisionShape2D and str(child.name).begins_with("Solid")):
			drop.append(child)
	for child in drop:
		body.remove_child(child)
		child.queue_free()


class HangingBoard extends Node2D:
	func _draw() -> void:
		var sign: Node = _sign()
		if sign == null:
			return
		var lines: PackedStringArray = sign._lines
		if lines.is_empty():
			return
		var font := _pixel_font()
		var widest := 0.0
		for line in lines:
			widest = maxf(widest, font.get_string_size(line, HORIZONTAL_ALIGNMENT_LEFT, -1, sign.FONT_SIZE).x)
		var line_h := font.get_height(sign.FONT_SIZE)
		var board_w: float = ceil((widest + 4.0) / 2.0) * 2.0
		var board := Vector2(maxf(board_w, 16.0), 12.0)
		var top := Vector2(-board.x * 0.5, -board.y)
		draw_rect(Rect2(top, board), sign.WOOD_DARK)
		var plank_h := board.y / 3.0
		var tones: Array[Color] = [sign.PLANK_A, sign.PLANK_B, sign.PLANK_C]
		for i in 3:
			draw_rect(Rect2(top + Vector2(1, plank_h * i), Vector2(board.x - 2, plank_h)), tones[i])
		var y := top.y + 1.0 + font.get_ascent(sign.FONT_SIZE)
		for line in lines:
			var w := font.get_string_size(line, HORIZONTAL_ALIGNMENT_LEFT, -1, sign.FONT_SIZE).x
			var x := top.x + (board.x - w) * 0.5
			draw_string(font, Vector2(round(x), round(y)), line, HORIZONTAL_ALIGNMENT_LEFT, -1, sign.FONT_SIZE, sign.INK)
			y += line_h


	func _sign() -> Node:
		var prop := get_parent()
		if prop == null:
			return null
		var layer := prop.get_parent()
		if layer == null:
			return null
		var street := layer.get_node_or_null("cafe_sign")
		if street == null:
			return null
		return street.get_node_or_null("StreetSign")


	func _pixel_font() -> Font:
		var src := ThemeDB.fallback_font
		if not (src is FontFile):
			return src
		var copy := (src as FontFile).duplicate() as FontFile
		copy.antialiasing = TextServer.FONT_ANTIALIASING_NONE
		copy.hinting = TextServer.HINTING_NONE
		copy.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED
		return copy
