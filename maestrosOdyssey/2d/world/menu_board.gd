extends Node2D
# Café drink menu, drawn as a standing chalkboard on the menu spot only.
# MENU is readable before you press anything. R still opens the full list.
# House rules and outdoor place signs are separate pictures.

const CHALK := Color(0.93, 0.90, 0.78)
const CHALK_FAINT := Color(0.93, 0.90, 0.78, 0.45)
const BOARD := Color(0.14, 0.24, 0.18)
const FRAME := Color(0.48, 0.30, 0.15)
const FRAME_DARK := Color(0.28, 0.16, 0.08)
const FONT_SIZE := 8

const BOARD_W := 40.0
const BOARD_H := 36.0
const FRAME_T := 3.0
const LEG_H := 7.0


func setup() -> void:
	var sprite := get_parent().get_node_or_null("Sprite") as CanvasItem
	if sprite != null:
		sprite.hide()
	_match_solid()
	queue_redraw()


## The sign picture is hidden. The solid shape is this chalkboard, legs included,
## with the gap between the legs left open.
func _match_solid() -> void:
	var body := get_parent() as CollisionObject2D
	if body == null:
		return
	for child in body.get_children():
		if child is CollisionPolygon2D:
			(child as CollisionPolygon2D).disabled = true
			(child as Node).queue_free()
		elif child is CollisionShape2D and str(child.name).begins_with("Solid"):
			(child as Node).queue_free()
	var top := Vector2(-BOARD_W * 0.5, -(LEG_H + BOARD_H))
	var frame_pos := top + Vector2(-FRAME_T, -FRAME_T)
	var frame_size := Vector2(BOARD_W + FRAME_T * 2.0, BOARD_H + FRAME_T * 2.0)
	_add_box(body, "SolidBoard", frame_pos, frame_size)
	var leg := Vector2(3, LEG_H)
	_add_box(body, "SolidLegL", Vector2(-BOARD_W * 0.34, -LEG_H), leg)
	_add_box(body, "SolidLegR", Vector2(BOARD_W * 0.34 - 3.0, -LEG_H), leg)


func _add_box(body: CollisionObject2D, box_name: String, pos: Vector2, size: Vector2) -> void:
	var shape := CollisionShape2D.new()
	shape.name = box_name
	var rect := RectangleShape2D.new()
	rect.size = size
	shape.shape = rect
	shape.position = pos + size * 0.5
	body.add_child(shape)


func _draw() -> void:
	var top := Vector2(-BOARD_W * 0.5, -(LEG_H + BOARD_H))
	# Two short legs so it reads as a board standing on the floor.
	draw_rect(Rect2(Vector2(-BOARD_W * 0.34, -LEG_H), Vector2(3, LEG_H)), FRAME_DARK)
	draw_rect(Rect2(Vector2(BOARD_W * 0.34 - 3, -LEG_H), Vector2(3, LEG_H)), FRAME_DARK)
	draw_rect(Rect2(top + Vector2(-FRAME_T, -FRAME_T), Vector2(BOARD_W + FRAME_T * 2, BOARD_H + FRAME_T * 2)), FRAME_DARK)
	draw_rect(Rect2(top + Vector2(-FRAME_T + 1, -FRAME_T + 1), Vector2(BOARD_W + FRAME_T * 2 - 2, BOARD_H + FRAME_T * 2 - 2)), FRAME)
	draw_rect(Rect2(top, Vector2(BOARD_W, BOARD_H)), BOARD)

	var font := ThemeDB.fallback_font
	var label := "MENU"
	var text_w := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE).x
	var y := top.y + 3.0 + font.get_ascent(FONT_SIZE)
	draw_string(font, Vector2(top.x + (BOARD_W - text_w) * 0.5, y), label, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE, CHALK)

	# Short chalk marks under the title, so the board looks like a list
	# from across the room. The real items still open on R.
	var line_y := y + 5.0
	for i in 4:
		var inset := 7.0 if i % 2 == 0 else 11.0
		draw_line(
			Vector2(top.x + inset, line_y),
			Vector2(top.x + BOARD_W - inset, line_y),
			CHALK_FAINT,
			1.0
		)
		line_y += 5.0
