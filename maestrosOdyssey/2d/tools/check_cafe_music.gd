extends RefCounted
# godot --path . --headless -- --check-cafe-music
# The café track fades in only inside Dragon's Brew, eases down under Mara,
# and fades out at the door. Night outside keeps the quiet cricket loop.


static func run(host: Node) -> void:
	var interiors: Node = host.get_node("/root/Interiors")
	if Journal.is_open():
		Journal.dismiss()
	await host.get_tree().process_frame
	await _expect(host, FileAccess.file_exists("res://audio/little_cafe.mp3"),
		"café track file is missing")
	await _expect(host, not DayNight.cafe_playing(), "café music played on the street")
	await _expect(host, not DayNight.crickets_playing(), "crickets played during the day")

	interiors.enter("dragons_brew")
	await host.get_tree().create_timer(0.35).timeout
	await _expect(host, DayNight.cafe_playing() and DayNight.cafe_looping(),
		"café music did not start looping")
	await _expect(host, DayNight.cafe_db() < DayNight.CAFE_DB - 8.0,
		"café music jumped in loud: %s" % DayNight.cafe_db())
	await _expect(host, not DayNight.crickets_playing(), "crickets played while ordering")
	await host.get_tree().create_timer(1.6).timeout
	await _expect(host, absf(DayNight.cafe_db() - DayNight.CAFE_DB) < 1.5,
		"café music did not settle: %s" % DayNight.cafe_db())

	var line := "What's your order? A drink y a food."
	DialogueUI.show_line("Mara", line)
	await host.get_tree().create_timer(0.55).timeout
	await _expect(host, MaraVoice.speaking(), "Mara did not speak over the café music")
	await _expect(host, DayNight.cafe_playing(), "café music stopped instead of easing down")
	await _expect(host, DayNight.cafe_db() < DayNight.CAFE_DB - 8.0,
		"café music did not ease down: %s" % DayNight.cafe_db())
	await _expect(host, not DayNight.crickets_playing(), "crickets played under her voice in the café")
	MaraVoice.stop()
	await host.get_tree().create_timer(0.9).timeout
	await _expect(host, absf(DayNight.cafe_db() - DayNight.CAFE_DB) < 2.0,
		"café music did not come back: %s" % DayNight.cafe_db())

	CafeOrder.awaiting_serve = false
	CafeOrder.carrying_dishes = false
	CafeOrder.awaiting_bye = false
	interiors.leave()
	await host.get_tree().create_timer(0.35).timeout
	await _expect(host, DayNight.cafe_playing(), "café music cut off at the door")
	await _expect(host, DayNight.cafe_db() < DayNight.CAFE_DB - 2.0,
		"café music did not fade out: %s" % DayNight.cafe_db())
	await _expect(host, DayNight.crickets_playing() and DayNight.crickets_db() < -40.0,
		"night crickets did not start quiet")
	await host.get_tree().create_timer(2.0).timeout
	await _expect(host, not DayNight.cafe_playing(), "café music stayed on the night street")
	await _expect(host, DayNight.crickets_playing() and DayNight.crickets_looping(),
		"night street lost the cricket loop")

	interiors.enter_clearing("forest_clearing")
	await host.get_tree().process_frame
	await _expect(host, not DayNight.cafe_playing(), "café music played in the forest")
	await _expect(host, DayNight.crickets_playing(), "crickets stopped at the campfire")
	interiors.leave()
	await host.get_tree().process_frame

	interiors.enter("player_house")
	await host.get_tree().create_timer(0.3).timeout
	await _expect(host, not DayNight.cafe_playing(), "café music played in the house")
	interiors.leave()

	print("cafe music: ok")
	host.get_tree().quit()


static func _expect(host: Node, ok: bool, message: String) -> void:
	if ok:
		return
	push_error(message)
	host.get_tree().quit(1)
