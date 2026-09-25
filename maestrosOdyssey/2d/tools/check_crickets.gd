extends RefCounted
# godot --path . --headless -- --check-crickets
# Silence in the daytime café, a quiet loop after you step out, silence again
# once morning comes. The campfire stays on the same loop.


static func run(host: Node) -> void:
	var interiors: Node = host.get_node("/root/Interiors")
	if Journal.is_open():
		Journal.dismiss()
	await host.get_tree().process_frame
	await _expect(host, not DayNight.crickets_playing(), "crickets played during the day")

	interiors.enter("dragons_brew")
	await host.get_tree().create_timer(0.4).timeout
	await _expect(host, not DayNight.crickets_playing(), "crickets played while ordering")
	await _expect(host, DayNight._want_night, "night did not start in the café")

	CafeOrder.awaiting_serve = false
	CafeOrder.carrying_dishes = false
	CafeOrder.awaiting_bye = false
	interiors.leave()
	await host.get_tree().process_frame
	await _expect(host, DayNight.crickets_playing() and DayNight.crickets_looping(),
		"crickets did not loop after leaving the café")
	await _expect(host, DayNight.crickets_db() < -40.0, "crickets started loud")
	await host.get_tree().create_timer(2.5).timeout
	await _expect(host, absf(DayNight.crickets_db() - DayNight.CRICKET_DB) < 1.0,
		"crickets did not settle quiet: %s" % DayNight.crickets_db())

	interiors.enter_clearing("forest_clearing")
	await host.get_tree().process_frame
	await _expect(host, DayNight.crickets_playing(), "crickets stopped at the campfire")
	interiors.leave()
	await host.get_tree().process_frame
	await _expect(host, DayNight.crickets_playing(), "crickets stopped on the walk home")

	interiors.enter("player_house")
	await host.get_tree().create_timer(0.3).timeout
	await _expect(host, DayNight.crickets_db() < DayNight.CRICKET_DB - 2.0,
		"crickets did not ease down indoors")
	await host.get_tree().create_timer(2.3).timeout
	await _expect(host, not DayNight.crickets_playing(), "crickets kept going indoors")
	interiors.leave()
	await host.get_tree().create_timer(2.5).timeout
	await _expect(host, DayNight.crickets_playing(), "crickets did not return outside at night")

	GameState.cafe_meal_done = true
	CafeOrder.meal_done = true
	interiors.enter("player_house")
	await host.get_tree().create_timer(2.6).timeout
	await _expect(host, not DayNight._want_night, "morning did not return")
	await _expect(host, not DayNight.crickets_playing(), "crickets stayed after morning")
	interiors.leave()
	await host.get_tree().process_frame
	await _expect(host, not DayNight.crickets_playing(), "crickets returned in the daytime")

	print("crickets: ok")
	host.get_tree().quit()


static func _expect(host: Node, ok: bool, message: String) -> void:
	if ok:
		return
	push_error(message)
	host.get_tree().quit(1)
