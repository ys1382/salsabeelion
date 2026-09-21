extends Node
# Dragon's Brew day-one order at Mara. Menu must be read first; then a typed
# line is matched against the board (café, té, muffin). Pay / cup / dine stay
# out of this slice.

## After Mara's "what's your order?" line, the next E opens the type box.
var open_box_on_close := false
var intro_done := false
var taken := false

## Longest names first so "café" wins over a stray "é".
const ITEMS := [
	{"needles": ["café", "cafe", "coffee"], "lemma": "café"},
	{"needles": ["muffin"], "lemma": "muffin"},
	{"needles": ["té", "te", "tea"], "lemma": "té"},
]


func reset_visit() -> void:
	open_box_on_close = false
	intro_done = false
	taken = false


func talk(npc: Npc) -> String:
	npc.met = true
	var lines = npc.data.get("scripted_lines", [])
	if typeof(lines) != TYPE_ARRAY or lines.size() < 3:
		return str(npc.data.get("opener", "..."))
	if not intro_done:
		intro_done = true
		npc.grant_if_any()
		return str(lines[0])
	if not GameState.known("menu_read"):
		return str(lines[1])
	if taken:
		return "I've got yours started. Sit when you like — the room is for lingering."
	open_box_on_close = true
	return str(lines[2])


func reply_for(text: String) -> String:
	var order := text.strip_edges()
	if order == "":
		return "Mara waits patiently. \"Take your time — look at the board again if you need to.\""
	var lemmas := match_lemmas(order)
	if lemmas.is_empty():
		return "Mara tilts her head. \"I didn't catch that — café, té, or a muffin this morning?\""
	taken = true
	open_box_on_close = false
	var echo := ", ".join(lemmas)
	return "Mara repeats it back, calm and clear: \"%s.\"\n\n\"Perfect — I'll get that started.\"" % echo


func match_lemmas(order: String) -> PackedStringArray:
	var hay := _fold(order)
	var found: PackedStringArray = []
	for item in ITEMS:
		for needle: String in item["needles"]:
			if hay.find(_fold(needle)) >= 0:
				found.append(str(item["lemma"]))
				break
	return found


func _fold(s: String) -> String:
	return s.strip_edges().to_lower().replace("é", "e").replace("á", "a")
