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
		var widest := 0
		for line in lines:
			widest = maxi(widest, _line_width(line))
		var board_w := float(maxi(widest + 4, 16))
		if int(board_w) % 2 == 1:
			board_w += 1.0
		var board := Vector2(board_w, 12.0)
		var top := Vector2(-board.x * 0.5, -board.y)
		draw_rect(Rect2(top, board), sign.WOOD_DARK)
		var plank_h := board.y / 3.0
		var tones: Array[Color] = [sign.PLANK_A, sign.PLANK_B, sign.PLANK_C]
		for i in 3:
			draw_rect(Rect2(top + Vector2(1, plank_h * i), Vector2(board.x - 2, plank_h)), tones[i])
		var y := int(top.y) + 1
		for line in lines:
			var x := int(round(top.x + (board.x - _line_width(line)) * 0.5))
			_draw_line(x, y, line, sign.INK)
			y += 6


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


	## Five-pixel letters. The system font at this size either smears or fills in.
	const _GLYPHS := {
		"D": ["1110", "1001", "1001", "1001", "1110"],
		"r": ["110", "101", "100", "100", "100"],
		"a": ["011", "001", "111", "101", "111"],
		"g": ["011", "101", "011", "001", "110"],
		"o": ["010", "101", "101", "101", "010"],
		"n": ["110", "101", "101", "101", "101"],
		"'": ["1", "1", "0", "0", "0"],
		"s": ["011", "100", "010", "001", "110"],
		"B": ["110", "101", "110", "101", "110"],
		"e": ["111", "100", "110", "100", "111"],
		"w": ["10101", "10101", "10101", "10101", "01110"],
	}


	func _line_width(line: String) -> int:
		var width := 0
		for i in line.length():
			var rows: PackedStringArray = _GLYPHS.get(line[i], PackedStringArray())
			if rows.is_empty():
				continue
			if width > 0:
				width += 1
			width += rows[0].length()
		return width


	func _draw_line(x: int, y: int, line: String, ink: Color) -> void:
		var cursor := x
		for i in line.length():
			var rows: PackedStringArray = _GLYPHS.get(line[i], PackedStringArray())
			if rows.is_empty():
				continue
			if cursor != x:
				cursor += 1
			for row in rows.size():
				var bits: String = rows[row]
				for col in bits.length():
					if bits[col] == "1":
						draw_rect(Rect2(cursor + col, y + row, 1, 1), ink)
			cursor += rows[0].length()
