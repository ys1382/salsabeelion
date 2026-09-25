extends Node
# Autoload. The player's side of the story: which beats they have uncovered,
# what that unlocks, and whether the mystery is solved.
#
# The backend keeps its own copy of this and gates NPC dialogue on it. The two
# must not drift, so reveal() reports upward — see LLMClient.reveal_beat().

signal cast_changed
## Fired once per beat, the first time it is uncovered. Carries the whole beat
## dictionary so the UI can show its description without looking it up.
signal beat_revealed(beat: Dictionary)
## Fired once per session, when the last of ending.condition_beats lands.
## Rival-less worlds only — a world with a rival goes through
## showdown_started/game_won instead. Still emitted at the very end (from
## notify_boss_defeated) for anything that only ever listened to this one.
signal finale_reached(text: String)
## Fired the first time each item is picked up.
signal item_taken(item: Dictionary)
## Axe, sack, or back to empty hands. The café cup still wins while it is out.
signal carry_changed
## The outdoor campfire behind the house changed stage (pit, or lit).
signal campfire_changed
## The rival escalating: a rumor becoming common talk, or minions/the boss
## needing to exist in the live scene. Mechanics only — WorldManager is the
## one thing that should act on these; Journal only toasts the rumors.
signal world_event(evt: Dictionary)
## All condition beats are known and the rival shows itself. `taunt` is its
## first line; Journal puts up the showdown card, and calling begin_showdown()
## once it is dismissed is what actually spawns the boss (see journal.gd for
## why the unpause has to happen first).
signal showdown_started(rival: Dictionary, taunt: String)
## The boss is beaten. `text` is the rival's defeat line plus the ending.
signal game_won(text: String)

var offline_mode: bool = false
var world: Dictionary = {}          # the validated world JSON for this session
var revealed_beats: Array[String] = []
var inventory: Array[String] = []
var cast: Array = []
var title: String = ""

## Stub clock + wallet until the day-advance and Mara pay tasks land.
## HUD stays blank until the player actually takes the learning card.
const CARD_START_PESOS := 400
const WEEKDAYS := [
	"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
]
var day_index: int = 1
var weekday: String = "Monday"
var week_number: int = 1
var card_balance: int = 0
## Paid café meal fully drained. Survives leaving Dragon's Brew so home can
## turn the weekday. Cleared when the night-pass card fires.
var cafe_meal_done: bool = false
## Weekday index on which the dead tree last fell. 0 means not yet today.
var wood_cut_day: int = 0
## 0 nothing, 1 unlit stone pit, 2 the pack's lit campfire. Stays for the run.
var campfire_stage: int = 0
## Weekday index on which today's wood went onto the fire. 0 means not yet.
var wood_stowed_day: int = 0
## Berries in hand. The bottom box shows this number.
var blueberries: int = 0
## Cut wood still in hand. The log box uses this number, then goes away on the fire.
var logs: int = 0
## Home crate and home barrel. Same item ids as the bottom row. Each keeps
## its own stacks for the whole play. Storing wood does not touch the fire.
var crate: Dictionary = {}
var barrel: Dictionary = {}
## What is sitting in slot 1 and slot 2. Empty string means that box is free.
## The learning card uses one of these when it is on you.
var carry_slot: Array[String] = ["", ""]
## 0 is slot 1. 1 is slot 2.
var held_slot: int = 0
## True after the basket hands over the card. Storing it does not clear this.
var card_picked_up: bool = false
const STACK_IDS: Array[String] = ["blueberries", "logs"]
## Bush id -> day_index it was last picked. Dots stay gone until the next Tuesday.
var berry_picked: Dictionary = {}
const BERRY_BUSHES: Array[String] = ["berry_bush_0", "berry_bush_1", "berry_bush_2"]
const BERRY_HANDFUL := 4

## "explore" -> "showdown_pending" (card up, boss not spawned yet) ->
## "showdown" (boss alive) -> "won". Worlds with no rival skip straight from
## "explore" to "won" via the legacy finale_reached path.
var phase: String = "explore"

var _finale_shown: bool = false
var _acts_fired: int = 0


func is_browser() -> bool:
	return OS.get_name() == "Web" or OS.has_feature("web")


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	# Maestro's Odyssey ships authored canon. Generation is opt-in (--online).
	offline_mode = not args.has("--online")
	if args.has("--offline") or OS.get_environment("ZIJ_OFFLINE") == "1":
		offline_mode = true
	if args.has("--online"):
		offline_mode = false
	# Browser builds have no local FastAPI. Never wait on 127.0.0.1:8000.
	if is_browser():
		offline_mode = true


## Adopting a world resets the story with it. The VLM repair pass rebuilds the
## scene mid-load, so this must be safe to call more than once.
func set_world(w: Dictionary) -> void:
	world = w
	title = str(w.get("title", ""))
	revealed_beats.clear()
	inventory.clear()
	day_index = 1
	card_balance = 0
	cafe_meal_done = false
	wood_cut_day = 0
	campfire_stage = 0
	wood_stowed_day = 0
	blueberries = 0
	logs = 0
	crate.clear()
	barrel.clear()
	carry_slot = ["", ""]
	held_slot = 0
	card_picked_up = false
	berry_picked.clear()
	_sync_clock()
	if has_node("/root/CafeOrder"):
		CafeOrder.reset_session()
	if has_node("/root/ElderReport"):
		ElderReport.reset()
	_finale_shown = false
	_acts_fired = 0
	phase = "explore"


func beat(beat_id: String) -> Dictionary:
	for b in world.get("beats", []):
		if b["id"] == beat_id:
			return b
	return {}


func known(beat_id: String) -> bool:
	return revealed_beats.has(beat_id)


func rival() -> Dictionary:
	return world.get("rival", {})


# --- the bag -----------------------------------------------------------------

func item(item_id: String) -> Dictionary:
	for i in world.get("items", []):
		if i["id"] == item_id:
			return i
	return {}


func has_item(item_id: String) -> bool:
	return item_id != "" and inventory.has(item_id)


func card_is_stored() -> bool:
	return (
		not has_item("learning_card")
		and (crate_count("learning_card") > 0 or barrel_count("learning_card") > 0)
	)


## The card is in slot 1 or slot 2, whether or not you are holding it out.
func card_in_slot() -> bool:
	return has_item("learning_card") and carry_slot.has("learning_card")


## Pesos come off only while you are holding the card out.
func card_held_out() -> bool:
	return held_item() == "learning_card"


## Items are kept once taken — nothing consumes them. Handing the smith their
## tongs shouldn't make the tongs vanish from a child's bag with no explanation,
## and there is no second use for anything, so keeping them costs nothing.
func take_item(item_id: String) -> bool:
	if item_id == "" or inventory.has(item_id):
		return false
	inventory.append(item_id)
	if item_id == "learning_card":
		if not card_picked_up:
			card_balance = CARD_START_PESOS
			card_picked_up = true
		var index := _empty_slot()
		if index >= 0:
			carry_slot[index] = "learning_card"
			held_slot = index
	elif item_id == "logs":
		_fill_empty("logs")
	item_taken.emit(item(item_id))
	return true


func try_pay(amount: int) -> bool:
	if amount <= 0 or not card_held_out():
		return false
	if card_balance < amount:
		return false
	card_balance -= amount
	return true


func add_balance(amount: int) -> void:
	if amount <= 0 or not has_item("learning_card"):
		return
	card_balance += amount


func refill_card(amount: int = CARD_START_PESOS) -> void:
	if not has_item("learning_card"):
		return
	card_balance = amount


func note_cafe_meal_done() -> void:
	cafe_meal_done = true


func try_night_pass() -> bool:
	if not cafe_meal_done:
		return false
	cafe_meal_done = false
	if has_node("/root/CafeOrder"):
		CafeOrder.meal_done = false
		CafeOrder.clear_table_rounds()
	advance_day()
	return true


func advance_day() -> void:
	day_index += 1
	_sync_clock()
	# Yesterday's bundle is done. Only Saturday asks for wood again, next week.
	# Berries, and anything already in the crate or the barrel, stay.
	logs = 0
	inventory.erase("logs")
	_clear_slot("logs")
	# Outdoor street returns to morning while you are still inside the house.
	if has_node("/root/DayNight"):
		DayNight.begin_day()
	carry_changed.emit()


## Saturday of week one only. Every other morning is the café, same as Monday.
func forest_morning() -> bool:
	return week_number == 1 and day_index == 6


## Every Tuesday. Not the wood day, and not the other mornings.
func berry_morning() -> bool:
	return weekday == "Tuesday"


func bush_has_berries(bush_id: String) -> bool:
	var picked := int(berry_picked.get(bush_id, 0))
	if picked <= 0:
		return true
	return day_index >= _next_tuesday_after(picked)


func _next_tuesday_after(from_day: int) -> int:
	var d := from_day + 1
	while ((d - 1) % 7) != 1:
		d += 1
	return d


func berries_waiting() -> bool:
	for id in BERRY_BUSHES:
		if bush_has_berries(id):
			return true
	return false


## Arrow's first job on Tuesday, until each bush has been picked.
func berry_chore_open() -> bool:
	return berry_morning() and berries_waiting() and not cafe_meal_done


func note_berry_pick(bush_id: String) -> bool:
	if bush_id == "" or not bush_has_berries(bush_id):
		return false
	berry_picked[bush_id] = day_index
	blueberries += BERRY_HANDFUL
	_fill_empty("blueberries")
	carry_changed.emit()
	return true


func wood_cut_today() -> bool:
	return wood_cut_day == day_index and day_index > 0


## The arrow's first job, until the tree is down. A finished meal still
## sends you home — the café loop is allowed later the same day.
func wood_chore_open() -> bool:
	return forest_morning() and not wood_cut_today() and not cafe_meal_done


func note_wood_cut() -> void:
	wood_cut_day = day_index
	logs += 1
	if not has_item("logs"):
		take_item("logs")
	carry_changed.emit()


## Forest mornings start with the sack from home, until today's wood is on the fire.
func carrying_sack() -> bool:
	return forest_morning() and not wood_stowed_today()


func wood_stowed_today() -> bool:
	return wood_stowed_day == day_index and day_index > 0


## Cut wood still in the sack, ready for the campfire.
func wood_for_fire() -> bool:
	return wood_cut_today() and not wood_stowed_today() and logs > 0


func campfire_prompt() -> String:
	if wood_for_fire():
		if campfire_stage <= 0:
			return "Build"
		if campfire_stage == 1:
			return "Light"
		return "Add wood"
	return "Look"


## Outdoor only. The spot behind the house calls this. Returns the line to show.
func tend_campfire() -> String:
	if wood_for_fire():
		if campfire_stage <= 0:
			campfire_stage = 1
			campfire_changed.emit()
			return "You set the stones in a ring, a little way behind the house."
		if campfire_stage == 1:
			campfire_stage = 2
			_stow_wood()
			return "You set the wood in and light it. The campfire catches."
		_stow_wood()
		return "You add the wood. The fire takes it."
	if campfire_stage >= 2:
		return "The campfire is going."
	if campfire_stage == 1:
		return "The stones are set. They still need wood."
	return "Open ground behind the house. It would hold a fire."


func _stow_wood() -> void:
	wood_stowed_day = day_index
	logs = 0
	inventory.erase("logs")
	_clear_slot("logs")
	campfire_changed.emit()
	carry_changed.emit()


func slot_item(index: int) -> String:
	if index < 0 or index >= carry_slot.size():
		return ""
	return carry_slot[index]


func held_item() -> String:
	return slot_item(held_slot)


func select_slot(index: int) -> void:
	if index < 0 or index >= carry_slot.size():
		return
	if held_slot == index:
		carry_changed.emit()
		return
	held_slot = index
	carry_changed.emit()


## Bottom-row stacks. The learning card is one object, not a stack.
func carry_ids() -> Array[String]:
	var ids: Array[String] = []
	if blueberries > 0:
		ids.append("blueberries")
	if logs > 0:
		ids.append("logs")
	return ids


func carry_count(item_id: String) -> int:
	if item_id == "blueberries":
		return blueberries
	if item_id == "logs":
		return logs
	if item_id == "learning_card" and has_item("learning_card"):
		return 1
	return 0


func crate_ids() -> Array[String]:
	return _store_ids(crate)


func barrel_ids() -> Array[String]:
	return _store_ids(barrel)


func _store_ids(bag: Dictionary) -> Array[String]:
	var ids: Array[String] = []
	for item_id in ["blueberries", "logs", "learning_card"]:
		if int(bag.get(item_id, 0)) > 0:
			ids.append(item_id)
	return ids


func crate_count(item_id: String) -> int:
	return int(crate.get(item_id, 0))


func barrel_count(item_id: String) -> int:
	return int(barrel.get(item_id, 0))


func store_ids(store: String) -> Array[String]:
	return barrel_ids() if store == "barrel" else crate_ids()


func store_count(store: String, item_id: String) -> int:
	return barrel_count(item_id) if store == "barrel" else crate_count(item_id)


## The held stack, or the one learning card, goes into that container.
## Wood here is storage, not the fire. Storing the card keeps its pesos.
func place_stack(item_id: String, store: String = "crate") -> bool:
	if item_id == "" or held_item() != item_id:
		return false
	if store != "crate" and store != "barrel":
		return false
	var bag := barrel if store == "barrel" else crate
	if item_id == "learning_card":
		if not has_item("learning_card"):
			return false
		bag["learning_card"] = 1
		inventory.erase("learning_card")
		_clear_slot("learning_card")
		carry_changed.emit()
		return true
	var n := carry_count(item_id)
	if n <= 0:
		return false
	bag[item_id] = int(bag.get(item_id, 0)) + n
	_clear_carry(item_id)
	carry_changed.emit()
	return true


## The whole stored stack comes back to its bottom slot, and that slot is held out.
func take_stack(item_id: String, store: String = "crate") -> bool:
	if store != "crate" and store != "barrel":
		return false
	var bag := barrel if store == "barrel" else crate
	var n := int(bag.get(item_id, 0))
	if n <= 0:
		return false
	if item_id == "learning_card":
		var open := _empty_slot()
		if open < 0:
			return false
		bag.erase(item_id)
		if not inventory.has("learning_card"):
			inventory.append("learning_card")
		carry_slot[open] = "learning_card"
		held_slot = open
		carry_changed.emit()
		return true
	bag.erase(item_id)
	if item_id == "blueberries":
		blueberries += n
	elif item_id == "logs":
		logs += n
		if not has_item("logs"):
			take_item("logs")
	_fill_empty(item_id)
	var index := carry_slot.find(item_id)
	if index >= 0:
		held_slot = index
	carry_changed.emit()
	return true


func _clear_carry(item_id: String) -> void:
	if item_id == "blueberries":
		blueberries = 0
	elif item_id == "logs":
		logs = 0
		inventory.erase("logs")
	_clear_slot(item_id)


func _clear_slot(item_id: String) -> void:
	for i in carry_slot.size():
		if carry_slot[i] == item_id:
			carry_slot[i] = ""


func _empty_slot() -> int:
	return carry_slot.find("")


func _fill_empty(item_id: String) -> void:
	if item_id == "" or carry_slot.has(item_id):
		return
	if item_id == "learning_card":
		if not has_item("learning_card"):
			return
	elif carry_count(item_id) <= 0:
		return
	var index := _empty_slot()
	if index >= 0:
		carry_slot[index] = item_id


## Put berries, logs, and the card into free boxes. Counts set by a test
## still show up. A full row leaves the extra waiting.
func settle_slots() -> void:
	for i in carry_slot.size():
		var item_id := carry_slot[i]
		if item_id == "":
			continue
		if item_id == "learning_card":
			if not has_item("learning_card"):
				carry_slot[i] = ""
		elif carry_count(item_id) <= 0:
			carry_slot[i] = ""
	if has_item("learning_card"):
		_fill_empty("learning_card")
	if blueberries > 0:
		_fill_empty("blueberries")
	if logs > 0:
		_fill_empty("logs")


func _sync_clock() -> void:
	weekday = WEEKDAYS[(day_index - 1) % WEEKDAYS.size()]
	week_number = int((day_index - 1) / 7) + 1


## The item's display name, falling back to the raw id so a world with a
## dangling reference still says something rather than showing an empty string.
func item_name(item_id: String) -> String:
	var i := item(item_id)
	return str(i.get("name", item_id)) if not i.is_empty() else item_id


## What the player is working toward. The one thing fixed in advance.
func goal() -> String:
	return str(world.get("goal", {}).get("summary", ""))


func goal_detail() -> String:
	return str(world.get("goal", {}).get("detail", ""))


## How much of the goal is accounted for. Beats no longer form a chain, so
## progress is a count of an unordered set rather than a position in a queue.
func progress() -> Array:
	var conds: Array = world.get("ending", {}).get("condition_beats", [])
	var have := 0
	for c in conds:
		if known(str(c)):
			have += 1
	return [have, conds.size()]


func reveal(beat_id: String) -> void:
	if beat_id == "" or revealed_beats.has(beat_id):
		return
	revealed_beats.append(beat_id)
	# Keep the server's story state in step; it decides what NPCs may say.
	LLMClient.reveal_beat(beat_id)
	beat_revealed.emit(beat(beat_id))
	_escalate()
	_check_finale()


## Every ending condition uncovered. Public so a playtest can assert the story
## is actually completable — the thing validate_world() cannot check.
func solved() -> bool:
	var conds: Array = world.get("ending", {}).get("condition_beats", [])
	if conds.is_empty():
		return false
	for c in conds:
		if not known(str(c)):
			return false
	return true


## Same table as worldgen.escalation_act() on the backend — mirrored here
## because the client always learns of a reveal before the server does: an
## interactable's beat only reaches the backend as an echo of what the client
## already knows, and an NPC-revealed beat arrives at the backend FIRST but at
## the client in the very same response. There is no single moment the server
## could fire a client-visible event from without missing half of them, so the
## mechanics live here and the server's matching copy only drives dialogue
## flavor (moods, rumors folded into world_facts).
static func _escalation_act(n: int, t: int) -> int:
	if t <= 0 or n <= 0:
		return 0
	if n >= t:
		return 4
	return clampi((3 * n + t - 1) / t, 1, 3)


## A ratchet: fires every act crossed since the last reveal, in order, never
## just the latest. Acts 1-3 are a rumor turning into common talk plus (at 2
## and 3) a wave of minions; act 4 is the showdown, and is handled by
## _check_finale()/begin_showdown() instead — reaching it here just stops the
## ratchet from re-firing acts 1-3 on every later reveal.
func _escalate() -> void:
	var riv := rival()
	if riv.is_empty():
		return
	var prog := progress()
	var act := _escalation_act(prog[0], prog[1])
	var rumors: Array = riv.get("rumors", [])
	while _acts_fired < act:
		_acts_fired += 1
		if _acts_fired <= 3:
			var i := _acts_fired - 1
			if i < rumors.size():
				world_event.emit({"type": "rumor", "line": str(rumors[i])})
			if _acts_fired == 2 or _acts_fired == 3:
				world_event.emit({"type": "spawn_minions", "count": _acts_fired})


func _check_finale() -> void:
	if _finale_shown or not solved():
		return
	_finale_shown = true
	var riv := rival()
	if riv.is_empty():
		phase = "won"
		finale_reached.emit(str(world.get("ending", {}).get("finale", "")))
		return
	phase = "showdown_pending"
	var taunts: Array = riv.get("taunts", [])
	showdown_started.emit(riv, str(taunts[0]) if not taunts.is_empty() else "")


## Called once the showdown card is dismissed — see journal.gd, which unpauses
## the tree BEFORE calling this, precisely so the boss never spawns into a
## still-paused game (the failure mode that used to latch a scripted playtest).
func begin_showdown() -> void:
	phase = "showdown"
	world_event.emit({"type": "spawn_boss"})


func notify_boss_defeated() -> void:
	phase = "won"
	var riv := rival()
	var ending_text := str(world.get("ending", {}).get("finale", ""))
	var text := str(riv.get("defeat", "")).strip_edges()
	if text != "":
		text += "\n\n"
	text += ending_text
	game_won.emit(text)
	finale_reached.emit(ending_text)  # legacy listeners


func set_cast(new_cast: Array, new_title: String) -> void:
	cast = new_cast
	title = new_title
	cast_changed.emit()
