extends CanvasLayer
# Autoload. Two pieces of on-screen text: a small verb prompt that follows what
# the player is standing next to ("T — Talk", "R — Read"), and a panel for the line itself.
# Built in code so there is no .tscn to keep in sync with the script.
#
# The panel grows to fit its line rather than living in a fixed rect. At a 360px
# logical height a fixed box held about five wrapped lines and silently clipped
# anything longer, so a villager who ran on lost the end of their sentence.

const PAD := 10
const BODY_SIZE := 11
const SPEAKER_SIZE := 12
const HINT_SIZE := 11
const SPACING := 4
## Never eat more than this share of the screen; past it the body scrolls.
const MAX_SCREEN_FRACTION := 0.55

var _prompt: Label
var _panel: PanelContainer
var _box: VBoxContainer
var _speaker: Label
var _body: RichTextLabel
var _hint: Label
var _order: LineEdit
## Wall-sign close-up: one paper that holds the whole copy.
var _sign: PanelContainer
var _sign_body: RichTextLabel
var _sign_text := ""
## Which key dismisses the open panel. Talk lines use T, the menu and house
## rules use R, and a door, basket, cart, or look uses E.
var close_key := "T"


func _ready() -> void:
	layer = 10

	_prompt = Label.new()
	_prompt.add_theme_font_size_override("font_size", 12)
	_prompt.add_theme_color_override("font_outline_color", Color.BLACK)
	_prompt.add_theme_constant_override("outline_size", 4)
	_prompt.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_prompt.offset_top = -104
	_prompt.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_prompt.hide()
	add_child(_prompt)

	_panel = PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.09, 0.11, 0.94)
	sb.border_color = Color(0.45, 0.38, 0.26)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(4)
	sb.set_content_margin_all(PAD)
	_panel.add_theme_stylebox_override("panel", sb)
	_panel.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_panel.offset_left = PAD * 2
	_panel.offset_right = -PAD * 2
	_panel.offset_bottom = -PAD
	_panel.hide()
	add_child(_panel)

	_box = VBoxContainer.new()
	_box.add_theme_constant_override("separation", SPACING)
	_panel.add_child(_box)

	_speaker = Label.new()
	_speaker.add_theme_font_size_override("font_size", SPEAKER_SIZE)
	_speaker.add_theme_color_override("font_color", Color(1, 0.86, 0.5))
	_box.add_child(_speaker)

	_body = RichTextLabel.new()
	_body.bbcode_enabled = false
	_body.scroll_active = true
	_body.fit_content = true
	_body.add_theme_font_size_override("normal_font_size", BODY_SIZE)
	_box.add_child(_body)

	_hint = Label.new()
	_hint.add_theme_font_size_override("font_size", HINT_SIZE)
	_hint.add_theme_color_override("font_color", Color(0.78, 0.74, 0.62))
	_hint.text = "T — Close"
	_hint.hide()
	_box.add_child(_hint)

	_order = LineEdit.new()
	_order.placeholder_text = "Type your order, then Enter"
	_order.add_theme_font_size_override("font_size", BODY_SIZE)
	_order.text_submitted.connect(_on_order_submitted)
	_order.hide()
	_box.add_child(_order)

	_build_sign()


func show_prompt(text: String) -> void:
	if is_open():
		return
	_prompt.text = text
	_prompt.show()


func hide_prompt() -> void:
	_prompt.hide()


## The one-frame placeholder while a model reply is in flight. Deliberately not
## a sentence: showing the NPC's canned opener here and then swapping in the
## real line read as the character saying two different things a second apart.
func show_thinking(speaker: String) -> void:
	show_line(speaker, "…")


## `more` means this person still has another box after this one. T then says
## next. The last box, and any one-line talk, still says close.
func show_line(speaker: String, text: String, more := false, speak := true) -> void:
	_hide_sign()
	_prompt.hide()
	_order.hide()
	_order.release_focus()
	_speaker.text = speaker
	_speaker.visible = speaker != ""
	_body.text = text
	_body.show()
	close_key = "T"
	_hint.text = "T — Next" if more else "T — Close"
	_hint.show()
	_fit(text, speaker != "")
	_panel.show()
	if speak and GameState.person_honks(speaker):
		MaraVoice.note_line("", "")
		GameState.play_honk()
	elif GameState.honk_playing():
		GameState.hold_voice(speaker, text)
	else:
		MaraVoice.note_line(speaker, text)


## Close-up of a wall sign. One paper: title and rules together, not a thin
## header bar over an empty panel.
func show_sign(text: String) -> void:
	_prompt.hide()
	_order.hide()
	_order.release_focus()
	_panel.hide()
	_sign_text = text
	_sign_body.text = text.strip_edges()
	close_key = "R"
	_sign.show()


## After show_line, when this panel is not talk. The hint follows the key.
func set_close_key(key: String) -> void:
	close_key = key
	_hint.text = "%s — Close" % key


func show_order_box(speaker: String = "Mara", keep_line: String = "") -> void:
	_hide_sign()
	_prompt.hide()
	_speaker.text = speaker
	_speaker.visible = true
	_order.text = ""
	if keep_line != "":
		_body.text = keep_line
		_body.show()
	else:
		_body.hide()
	_hint.hide()
	if speaker == "Elder":
		_order.placeholder_text = "Yes or no, then Enter"
	elif CafeOrder.awaiting_bye:
		_order.placeholder_text = CafeOrder.goodbye_box_hint()
	else:
		_order.placeholder_text = "Type your order, then Enter"
	_order.show()
	_panel.show()
	if keep_line != "":
		_fit(keep_line, speaker != "")
		_panel.offset_top -= 36
	else:
		_panel.offset_top = -(SPEAKER_SIZE + SPACING + 28 + PAD * 2 + PAD)
	_order.call_deferred("grab_focus")


func is_ordering() -> bool:
	return _panel.visible and _order.visible


func _on_order_submitted(text: String) -> void:
	_order.hide()
	_order.release_focus()
	if GameState.goose_ask:
		GameState.goose_ask = false
		show_line("", GameState.goose_reply(text))
		return
	if GameState.player_honks():
		GameState.play_honk()
	if ElderReport.awaiting:
		show_line(ElderReport.speaker_name(), ElderReport.reply_for(text))
	else:
		show_line("Mara", CafeOrder.reply_for(text))


## Sizes the panel to the wrapped text. Font.get_multiline_string_size gives the
## real wrapped height for a given width, so this needs no layout frame — doing
## it after a frame instead made the box pop up small and then jump.
func _fit(text: String, has_speaker: bool) -> void:
	var screen := get_viewport().get_visible_rect().size
	var inner := screen.x - PAD * 4 - PAD * 2       # panel margins, then padding
	var font := _body.get_theme_font("normal_font")
	if font == null:
		font = ThemeDB.fallback_font
	var body_h := font.get_multiline_string_size(
		text, HORIZONTAL_ALIGNMENT_LEFT, inner, BODY_SIZE).y
	var h := body_h + PAD * 2
	if has_speaker:
		h += float(SPEAKER_SIZE) + SPACING
	h += float(HINT_SIZE) + SPACING
	var capped := minf(h, screen.y * MAX_SCREEN_FRACTION)
	# fit_content would force the label to its full height and overflow the cap;
	# turn it off in the rare case the line is long enough to need scrolling.
	var needs_scroll := h > capped
	_body.fit_content = not needs_scroll
	if needs_scroll:
		var extra := float(HINT_SIZE) + SPACING
		if has_speaker:
			extra += float(SPEAKER_SIZE) + SPACING
		_body.custom_minimum_size.y = maxf(24.0, capped - PAD * 2 - extra)
	else:
		_body.custom_minimum_size.y = 0
	_panel.offset_top = -(capped + PAD)


func is_open() -> bool:
	return _panel.visible or _sign.visible


func is_sign_open() -> bool:
	return _sign.visible


## A menu, an order box, or someone talking. The door's welcome line
## has no speaker, so it does not count.
func blocks_arrow() -> bool:
	if is_sign_open() or is_ordering():
		return true
	return _panel.visible and _speaker.visible


## What the panel is currently saying. The agent bridge reads this to assert on
## lines the game produces locally — item pickups, locked_text, gift lines —
## which never go through the model and so never reach dialogue_received.
func body() -> String:
	if _sign.visible:
		return _sign_text
	return _body.text


func close() -> void:
	_order.hide()
	_order.release_focus()
	_hint.hide()
	_body.show()
	_panel.hide()
	_hide_sign()


func _hide_sign() -> void:
	_sign.hide()
	_sign_text = ""


func _wood_panel(bg: Color, border: Color, margin: int = 8) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(2)
	sb.set_content_margin_all(margin)
	p.add_theme_stylebox_override("panel", sb)
	return p


func _build_sign() -> void:
	# One paper. Sit a little below the top so the first line stays on screen.
	_sign = _wood_panel(Color(0.87, 0.82, 0.72), Color(0.42, 0.28, 0.16))
	_sign.set_anchors_preset(Control.PRESET_CENTER)
	_sign.offset_left = -220
	_sign.offset_right = 220
	_sign.offset_top = -144
	_sign.offset_bottom = 170
	_sign.hide()
	add_child(_sign)

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", SPACING)
	_sign.add_child(col)

	_sign_body = RichTextLabel.new()
	_sign_body.bbcode_enabled = false
	_sign_body.scroll_active = true
	_sign_body.fit_content = false
	_sign_body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_sign_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_sign_body.add_theme_font_size_override("normal_font_size", BODY_SIZE)
	_sign_body.add_theme_color_override("default_color", Color(0.22, 0.16, 0.10))
	col.add_child(_sign_body)

	var sign_hint := Label.new()
	sign_hint.add_theme_font_size_override("font_size", HINT_SIZE)
	sign_hint.add_theme_color_override("font_color", Color(0.42, 0.32, 0.22))
	sign_hint.text = "R — Close"
	col.add_child(sign_hint)
