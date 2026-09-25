extends Node
# Mara's café voice. One Mexican Spanish neural woman (es-MX-DaliaNeural)
# for the Spanish words and the English lines. Clips are local files on the
# same kind of player as the night crickets. No browser speech, no system
# voice, no network. A missing clip leaves the on-screen line alone.

const VOICE := "es-MX-DaliaNeural"

const CLIPS := {
	"order": preload("res://audio/mara_order.mp3"),
	"y": preload("res://audio/mara_y.mp3"),
	"con": preload("res://audio/mara_con.mp3"),
	"un": preload("res://audio/mara_un.mp3"),
	"una": preload("res://audio/mara_una.mp3"),
	"bye_and": preload("res://audio/mara_bye_and.mp3"),
	"bye_y": preload("res://audio/mara_bye_y.mp3"),
}

var _player: AudioStreamPlayer
var _queue: PackedStringArray = PackedStringArray()
var _speaking := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_player = AudioStreamPlayer.new()
	_player.name = "Mara"
	_player.process_mode = Node.PROCESS_MODE_ALWAYS
	_player.finished.connect(_on_finished)
	add_child(_player)


func note_line(speaker: String, text: String) -> void:
	_halt()
	if speaker != "Mara":
		DayNight.duck_for_voice(false)
		return
	play_ids(ids_for(text))


func ids_for(text: String) -> PackedStringArray:
	if text.contains("Adiós, y buenas noches"):
		return PackedStringArray(["bye_y"])
	if text.contains("Adiós, and buenas noches"):
		return PackedStringArray(["bye_and"])
	if not text.begins_with("What's your order?"):
		return PackedStringArray()
	var out := PackedStringArray(["order"])
	var flat := _flat(text)
	if " y " in flat:
		out.append("y")
	if " con " in flat:
		out.append("con")
	if "un and una" in flat or "un or una" in flat:
		out.append("un")
		out.append("una")
	return out


func play_ids(ids: PackedStringArray) -> void:
	_queue = ids.duplicate()
	if _queue.is_empty():
		_speaking = false
		DayNight.duck_for_voice(false)
		return
	_speaking = true
	DayNight.duck_for_voice(true)
	_play_next()


func speaking() -> bool:
	return _speaking or (_player != null and _player.playing)


func stop() -> void:
	_halt()
	DayNight.duck_for_voice(false)


func _halt() -> void:
	_queue = PackedStringArray()
	_speaking = false
	if _player != null and _player.playing:
		_player.stop()


func _play_next() -> void:
	while not _queue.is_empty():
		var id := str(_queue[0])
		_queue.remove_at(0)
		var stream: AudioStream = CLIPS.get(id)
		if stream == null:
			continue
		_player.stream = stream
		_player.play()
		return
	_speaking = false
	DayNight.duck_for_voice(false)


func _on_finished() -> void:
	if not _speaking:
		return
	_play_next()


func _flat(text: String) -> String:
	var out := text.to_lower()
	for mark in ["—", "–", ".", ",", "?", "!", ":", ";", "\"", "'"]:
		out = out.replace(mark, " ")
	while "  " in out:
		out = out.replace("  ", " ")
	return " " + out.strip_edges() + " "
