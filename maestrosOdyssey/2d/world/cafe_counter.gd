extends StaticBody2D
# A long wooden café counter, drawn the same way the cup is drawn.
# The art pack has no counter piece. No bottle shelf, no bottles, no taps.
#
# Mara stands just north of it (smaller y). The player walks up from the
# door and stops on the south face. The middle walk stays open until that face.

## Pixel span in the café. Left stays clear of the bench. The right end stops
## short of the neighbors' table so you can walk past it to the menu.
const LEFT := 98
const RIGHT := 136
const TOP := 76
const BOTTOM := 94
## Solid from here down, so Mara's feet are not inside the wood.
const SOLID_TOP := 84


func _ready() -> void:
	collision_layer = 1
	collision_mask = 0
	y_sort_enabled = false
	position = Vector2((LEFT + RIGHT) * 0.5, BOTTOM)

	var w := RIGHT - LEFT
	var h := BOTTOM - TOP
	var sprite := Sprite2D.new()
	sprite.name = "Sprite"
	sprite.centered = false
	sprite.texture = _wood(w, h)
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	sprite.position = Vector2(-w * 0.5, -h)
	add_child(sprite)

	var shape := CollisionShape2D.new()
	shape.name = "Solid"
	var rect := RectangleShape2D.new()
	rect.size = Vector2(w, BOTTOM - SOLID_TOP)
	shape.shape = rect
	shape.position = Vector2(0, -(BOTTOM - SOLID_TOP) * 0.5)
	add_child(shape)


func _wood(w: int, h: int) -> ImageTexture:
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	var boards := [
		Color(0.74, 0.52, 0.30),
		Color(0.64, 0.43, 0.24),
		Color(0.80, 0.58, 0.34),
		Color(0.58, 0.38, 0.20),
	]
	var gap := Color(0.34, 0.20, 0.11)
	var face := Color(0.42, 0.26, 0.14)
	var plank_h := 4
	for y in h:
		var board: Color = boards[int(y / plank_h) % boards.size()]
		for x in w:
			var c := board
			if y % plank_h == 0:
				c = gap
			elif y >= h - 3:
				c = face
			img.set_pixel(x, y, c)
	return ImageTexture.create_from_image(img)
