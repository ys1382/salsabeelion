class_name CafePhrases
extends RefCounted
# Week-one table talk. Same two sentence shapes each day, different board items.
# Monday keeps the ferry lines in the world file. From Tuesday the neighbors
# say these instead, so day 8 has a favorite drink, a favorite food, and an add-on.
# Ramp English → Spanish. First favorite lines must still be understandable;
# do not open on a full-Spanish sentence.

const _IGUANA := "iguana_neighbor"
const _RIVER := "riverfolk_neighbor"

const LINES := {
	2: {
		_IGUANA: "Té is my favorite.",
		_RIVER: "Have you tried their chocolate caliente? It is muy good.",
	},
	3: {
		_IGUANA: "El café is my favorite.",
		_RIVER: "Have you tried su tostada? It is muy buena.",
	},
	4: {
		_IGUANA: "La leche is mi favorita.",
		_RIVER: "Have you tried su galleta? Es muy buena.",
	},
	5: {
		_IGUANA: "El muffin es mi favorito.",
		_RIVER: "Have you tried su bolillo? Es muy bueno.",
	},
	6: {
		_IGUANA: "El croissant es mi favorito.",
		_RIVER: "I'll have what she's having.",
	},
	7: {
		_IGUANA: "Ask him again if you missed it.",
		_RIVER: "¿Ya probaste su espresso frío? Es muy bueno.",
	},
}

## After a thin day-8 answer, the table shows the shape to bring back:
## a drink with an add-on, and a food, each as a favorite.
const REVISIT := {
	_IGUANA: "El café con leche es mi favorito.",
	_RIVER: "La tostada es mi favorita.",
}


static func line_for(npc_id: String, day_index: int, revisit: bool) -> String:
	if revisit and REVISIT.has(npc_id):
		return str(REVISIT[npc_id])
	if npc_id != _IGUANA and npc_id != _RIVER:
		return ""
	var weekday := ((day_index - 1) % 7) + 1
	if not LINES.has(weekday):
		return ""
	var day: Dictionary = LINES[weekday]
	if not day.has(npc_id):
		return ""
	return str(day[npc_id])
