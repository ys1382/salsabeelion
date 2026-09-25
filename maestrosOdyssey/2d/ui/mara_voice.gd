extends Node
# Mara's café voice. One Mexican Spanish neural woman (es-MX-DaliaNeural)
# for the Spanish words and the English lines. Clips are local files on the
# same kind of player as the night crickets. No browser speech, no system
# voice, no network. A missing clip leaves the on-screen line alone.

const VOICE := "es-MX-DaliaNeural"
const Lines := preload("res://ui/mara_phrases.gd")
const CLIPS: Dictionary = Lines.CLIPS

var _phrases: Array = []

var _player: AudioStreamPlayer
var _queue: PackedStringArray = PackedStringArray()
var _speaking := false
## Bumped when a line is cut off, so a web build can advance clips by length
## without the finished signal starting the next word twice.
var _token := 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_player = AudioStreamPlayer.new()
	_player.name = "Mara"
	_player.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(_player)
	for row in Lines.ROWS:
		var needle := _core(str(row[0]))
		_phrases.append({"needle": needle, "id": str(row[1]), "len": needle.length()})
	_phrases.sort_custom(func(a, b): return int(a["len"]) > int(b["len"]))


func note_line(speaker: String, text: String) -> void:
	var hers := speaker == "Mara" or (speaker == "" and text.contains("Mara"))
	if not hers:
		_halt()
		DayNight.duck_for_voice(false)
		return
	_halt()
	play_ids(ids_for(text))


## Every phrase of hers that appears in the line, in the order she says them.
## A longer sentence wins over the single word inside it. Parenthetical
## board hints stay on screen and are not spoken.
func ids_for(text: String) -> PackedStringArray:
	var flat := _core(_strip_parens(text))
	var spans: Array = []
	for phrase in _phrases:
		var needle := str(phrase["needle"])
		if needle == "":
			continue
		var at := flat.find(needle)
		if at < 0:
			continue
		var end := at + needle.length()
		# The spaces around a phrase are only there so "y" does not match
		# inside "your". They are not part of the words, so two sentences
		# that sit next to each other do not count as overlapping.
		if needle.begins_with(" "):
			at += 1
		if needle.ends_with(" "):
			end -= 1
		var covered := false
		for span in spans:
			if at < int(span["end"]) and end > int(span["at"]):
				covered = true
				break
		if covered:
			continue
		spans.append({"at": at, "end": end, "id": str(phrase["id"])})
	spans.sort_custom(func(a, b): return int(a["at"]) < int(b["at"]))
	var out := PackedStringArray()
	for span in spans:
		out.append(str(span["id"]))
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
	_token += 1
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
		var token := _token
		var wait := maxf(stream.get_length(), 0.2)
		get_tree().create_timer(wait).timeout.connect(_advance.bind(token), CONNECT_ONE_SHOT)
		return
	_speaking = false
	DayNight.duck_for_voice(false)


func _advance(token: int) -> void:
	if token != _token or not _speaking:
		return
	_play_next()


func _strip_parens(text: String) -> String:
	var out := ""
	var depth := 0
	for i in text.length():
		var c := text[i]
		if c == "(":
			depth += 1
		elif c == ")" and depth > 0:
			depth -= 1
		elif depth == 0:
			out += c
	return out


func _core(text: String) -> String:
	var out := text.to_lower()
	for mark in ["'", "’", "‘", "`"]:
		out = out.replace(mark, "")
	for mark in ["—", "–", ".", ",", "?", "!", ":", ";", "\"", "¿", "¡"]:
		out = out.replace(mark, " ")
	while "  " in out:
		out = out.replace("  ", " ")
	return " " + out.strip_edges() + " "
