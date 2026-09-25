extends RefCounted
# godot --path . --headless -- --check-mara-voice
# One Mexican woman for Spanish and English. Text stays up. Daytime stays
# quiet. Night crickets ease down under her voice, then come back.


static func run(host: Node) -> void:
	if Journal.is_open():
		Journal.dismiss()
	await host.get_tree().process_frame

	await _expect(host, MaraVoice.VOICE == "es-MX-DaliaNeural",
		"voice is not the one Mexican woman")
	for id in ["order", "y", "con", "un", "una", "bye_and", "bye_y"]:
		var stream: AudioStream = MaraVoice.CLIPS.get(id)
		await _expect(host, stream != null and stream.get_length() > 0.4,
			"missing mara clip %s" % id)

	var monday: PackedStringArray = MaraVoice.ids_for(CafeOrder.order_prompt())
	await _expect(host, monday.size() == 1 and monday[0] == "order",
		"monday prompt voiced extra words: %s" % str(monday))

	var teach := "What's your order? Un or una, then a drink y a food, con if you want extras."
	var taught: PackedStringArray = MaraVoice.ids_for(teach)
	await _expect(host, taught == PackedStringArray(["order", "y", "con", "un", "una"]),
		"teaching line missed a word: %s" % str(taught))
	var bye: PackedStringArray = MaraVoice.ids_for(
		"Mara looks over. \"Adiós, y buenas noches.\" That means goodbye, and good night.")
	await _expect(host, bye.size() == 1 and bye[0] == "bye_y",
		"goodbye used the wrong clip: %s" % str(bye))
	var bye_and: PackedStringArray = MaraVoice.ids_for("Adiós, and buenas noches")
	await _expect(host, bye_and.size() == 1 and bye_and[0] == "bye_and",
		"monday goodbye used the wrong clip")

	var prompt := CafeOrder.order_prompt()
	DialogueUI.show_line("Mara", prompt)
	await host.get_tree().create_timer(0.35).timeout
	await _expect(host, DialogueUI.body() == prompt, "order text left the screen")
	await _expect(host, MaraVoice.speaking(), "order prompt did not speak")
	await _expect(host, not DayNight.crickets_playing(),
		"crickets played under her voice in the daytime")

	DialogueUI.show_line("Mara", "Mara smiles. \"The door's there when you're ready.\"")
	await host.get_tree().create_timer(0.25).timeout
	await _expect(host, DialogueUI.body().contains("door's there"),
		"a line without a clip hid the text")
	await _expect(host, not MaraVoice.speaking(), "a missing line beeped or spoke")
	await _expect(host, not DayNight.crickets_playing(), "daytime crickets started late")

	MaraVoice.play_ids(PackedStringArray(["not_a_clip"]))
	await host.get_tree().process_frame
	await _expect(host, not MaraVoice.speaking(), "a missing file beeped")
	await _expect(host, DialogueUI.body().contains("door's there"),
		"a missing clip cleared the line")

	DayNight.begin_night(0.0)
	await host.get_tree().create_timer(2.6).timeout
	await _expect(host, DayNight.crickets_playing(), "night crickets did not start")
	await _expect(host, absf(DayNight.crickets_db() - DayNight.CRICKET_DB) < 1.5,
		"night crickets did not settle: %s" % DayNight.crickets_db())

	var night_line := "What's your order? A drink y a food."
	DialogueUI.show_line("Mara", night_line)
	await host.get_tree().create_timer(0.55).timeout
	await _expect(host, DialogueUI.body() == night_line, "night line left the screen")
	await _expect(host, MaraVoice.speaking(), "she did not speak at night")
	await _expect(host, DayNight.crickets_playing(), "crickets stopped instead of easing down")
	await _expect(host, DayNight.crickets_db() < DayNight.CRICKET_DB - 8.0,
		"crickets did not ease down: %s" % DayNight.crickets_db())

	var waited := 0.0
	while MaraVoice.speaking() and waited < 8.0:
		await host.get_tree().create_timer(0.2).timeout
		waited += 0.2
	await _expect(host, not MaraVoice.speaking(), "voice did not finish")
	await host.get_tree().create_timer(1.0).timeout
	await _expect(host, DayNight.crickets_playing(), "crickets did not come back")
	await _expect(host, absf(DayNight.crickets_db() - DayNight.CRICKET_DB) < 2.0,
		"crickets did not return to the night level: %s" % DayNight.crickets_db())

	print("mara voice: ok")
	host.get_tree().quit()


static func _expect(host: Node, ok: bool, message: String) -> void:
	if ok:
		return
	push_error(message)
	host.get_tree().quit(1)
