extends Node
# Day-8 elder check-in (#28). Natural talk, hidden score, card refill.
# Uses the same type box as Mara — no full-screen overlay.

var open_box_on_close := false
var awaiting := false
var done := false
var passed := false
var needs_revisit := false
## One café line from the send-back has been heard. She will not take the
## second report until then.
var detail_heard := false

const SPEAKER := "Elder"
const ASK := "I haven't been to Dragon's Brew in quite some time, dear. Tell me your favorite drink and your favorite food, the way they say it there, with something extra. Include their word for favorite. The drink or the food by itself is not enough."
## Same errand as ASK. She says it again when the first answer was thin,
## and again if you come back before you have heard it at the café.
const SEND_BACK := "I love that place. Can you go back and find out more for me? I still need a favorite drink and a favorite food, their word for favorite in the line, and something extra. The names alone won't do."
const TAKE_TIME := "Take your time. Include their word for favorite with the drink, the food, and something extra. The names alone won't do."


func reset() -> void:
	open_box_on_close = false
	awaiting = false
	done = false
	passed = false
	needs_revisit = false
	detail_heard = false


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
			return _revisit_ask()
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
		return TAKE_TIME
	passed = _favorites_ok(report)
	done = true
	needs_revisit = not passed
	if needs_revisit:
		detail_heard = false
	GameState.refill_card()
	if passed:
		return "That sounds lovely, dear."
	return SEND_BACK


## The table said one of the lines she sent you to hear.
func note_detail_heard(line: String) -> void:
	if not needs_revisit:
		return
	for said in CafePhrases.REVISIT.values():
		if line == str(said):
			detail_heard = true
			return


## Before the detail, she repeats the errand and does not open the type box.
## After it, she asks for the same favorites again.
func _revisit_ask() -> String:
	if not detail_heard:
		open_box_on_close = false
		awaiting = false
		return SEND_BACK
	done = false
	open_box_on_close = true
	awaiting = true
	return ASK


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
