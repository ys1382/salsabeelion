extends Node
# Day-8 elder check-in (#28). Natural talk, hidden score, card refill.
# Uses the same type box as Mara — no full-screen overlay.

var open_box_on_close := false
var awaiting := false
var done := false
var passed := false
var needs_revisit := false

const SPEAKER := "Elder"
const ASK := "I haven't been to Dragon's Brew in quite some time, dear. Tell me your favorite drink and your favorite food — the way they say it there, with something extra like con leche."


func reset() -> void:
	open_box_on_close = false
	awaiting = false
	done = false
	passed = false
	needs_revisit = false


func speaker_name() -> String:
	return SPEAKER


func week_language_goal_met() -> bool:
	return CafeOrder.ordered.size() >= 3


func can_offer() -> bool:
	return GameState.day_index >= 8 and not done and week_language_goal_met()


func talk(npc: Npc) -> String:
	npc.met = true
	if done:
		if needs_revisit:
			done = false
			open_box_on_close = true
			awaiting = true
			return ASK
		return "That still sounds lovely, dear. Dragon's Brew will be there in the morning."
	if GameState.day_index < 8:
		return ""
	if not week_language_goal_met():
		return "I love that you went. A few more words from the wall in your pocket — then I'll want to hear about the week."
	open_box_on_close = true
	awaiting = true
	return ASK


func reply_for(text: String) -> String:
	awaiting = false
	open_box_on_close = false
	var report := text.strip_edges()
	if report == "":
		awaiting = true
		open_box_on_close = true
		return "Take your time — your favorite drink and your favorite food, with something like con leche."
	passed = _favorites_ok(report)
	done = true
	needs_revisit = not passed
	GameState.refill_card()
	if passed:
		return "That sounds lovely, dear."
	return "I love that place. Can you go back and find out more for me?"


## A drink, a food, the favorite word, and an add-on joined with con or y.
## Café con leche y muffin son mis favoritos. Gender on favorito can be loose.
func _favorites_ok(report: String) -> bool:
	var tokens := _tokens(report)
	if not _has_token_prefix(tokens, "favorit"):
		return false
	if not _has_token(tokens, ["cafe", "te", "chocolate", "espresso"]):
		return false
	if not _has_token(tokens, ["muffin", "tostada", "galleta", "bolillo", "croissant"]):
		return false
	if not _has_token(tokens, ["con", "y"]):
		return false
	return _has_token(tokens, ["leche", "azucar", "crema"])


func _tokens(report: String) -> PackedStringArray:
	var parts := _fold(report).split(" ", false)
	var tokens := PackedStringArray()
	for part in parts:
		if part != "":
			tokens.append(part)
	return tokens


func _has_token(tokens: PackedStringArray, words: Array) -> bool:
	for token in tokens:
		if words.has(token):
			return true
	return false


func _has_token_prefix(tokens: PackedStringArray, prefix: String) -> bool:
	for token in tokens:
		if token.begins_with(prefix):
			return true
	return false


func _fold(s: String) -> String:
	var t := s.strip_edges().to_lower()
	t = t.replace("é", "e").replace("á", "a").replace("í", "i")
	t = t.replace("ó", "o").replace("ú", "u").replace("ü", "u").replace("ñ", "n")
	var out := ""
	for i in t.length():
		var ch := t.substr(i, 1)
		if ch >= "a" and ch <= "z":
			out += ch
		else:
			out += " "
	return out.strip_edges()
