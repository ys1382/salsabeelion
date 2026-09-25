extends Node2D
# Small purple dots that ride with the player after sugarplum juice.
# They blink. They are not a light and they do not reveal the forest.

var _t := 0.0
var _fade := 0.0

const _SPOTS: Array[Vector2] = [
	Vector2(-10, -20),
	Vector2(9, -24),
	Vector2(12, -10),
	Vector2(-7, -8),
	Vector2(1, -30),
]


func _process(delta: float) -> void:
	var on := GameState.sugarplum_sparkle
	if on:
		_fade = 1.0
	elif _fade > 0.0:
		_fade = maxf(0.0, _fade - delta * 2.0)
	visible = _fade > 0.0
	if not visible:
		return
	_t += delta
	queue_redraw()


func _draw() -> void:
	for i in _SPOTS.size():
		var blink := sin(_t * 7.0 + float(i) * 1.4)
		if blink < 0.05:
			continue
		var a := (0.45 + 0.55 * blink) * _fade
		draw_circle(_SPOTS[i], 1.6, Color(0.50, 0.20, 0.64, a))
