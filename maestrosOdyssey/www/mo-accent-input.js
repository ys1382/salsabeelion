/* macOS press-and-hold accent menu on the Godot web type box.
   The hidden text field shows the system picker, but each key repeat was
   also typed into the box (eeeee). A pick should leave one accented letter. */
(function () {
	var held = null;
	var applying = false;
	var settledAt = 0;
	var landed = "";
	var composing = false;

	function lettersOf(text) {
		return Array.from(text || "");
	}

	function fold(ch) {
		return ch.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
	}

	function isLetter(key) {
		return lettersOf(key).length === 1 && /\p{L}/u.test(key);
	}

	function isAccentOf(ch, base) {
		if (!isLetter(ch) || !isLetter(base) || ch === base) {
			return false;
		}
		var accent = fold(ch);
		var plain = fold(base);
		if (!accent || !plain) {
			return false;
		}
		return accent === plain || accent.charAt(0) === plain.charAt(0);
	}

	function recentlySettled() {
		return Date.now() - settledAt < 120;
	}

	function markSettled(ch) {
		settledAt = Date.now();
		landed = ch || landed;
		held = null;
	}

	function sendKey(ime, key, code) {
		var opts = { key: key, code: code || "", bubbles: true, cancelable: true };
		ime.dispatchEvent(new KeyboardEvent("keydown", opts));
		ime.dispatchEvent(new KeyboardEvent("keyup", opts));
	}

	function backspaces(ime, count) {
		for (var i = 0; i < count; i++) {
			sendKey(ime, "Backspace", "Backspace");
		}
	}

	function typeChars(ime, text) {
		lettersOf(text).forEach(function (ch) {
			sendKey(ime, ch, "");
		});
	}

	function pickChar(text) {
		var chars = lettersOf(text);
		return chars.length === 1 ? text : (chars.pop() || "");
	}

	/* One base letter is already in the box. Swap it for the pick. */
	function landPick(ime, text) {
		var ch = pickChar(text);
		if (!ch || applying || (recentlySettled() && ch === landed)) {
			return false;
		}
		applying = true;
		backspaces(ime, 1);
		typeChars(ime, ch);
		applying = false;
		if (ime.textContent) {
			ime.textContent = "";
		}
		markSettled(ch);
		return true;
	}

	/* Godot already committed the pick on top of that base letter. */
	function peelCommit(ime, text) {
		if (!text || applying || (recentlySettled() && text === landed)) {
			return;
		}
		var chars = lettersOf(text);
		applying = true;
		backspaces(ime, chars.length + 1);
		typeChars(ime, text);
		applying = false;
		if (ime.textContent) {
			ime.textContent = "";
		}
		markSettled(text);
	}

	function hook(ime) {
		if (!ime || ime.getAttribute("data-mo-accent") === "1") {
			return;
		}
		ime.setAttribute("data-mo-accent", "1");

		ime.addEventListener("keydown", function (evt) {
			if (applying) {
				return;
			}
			if (recentlySettled() && evt.key === landed) {
				evt.stopImmediatePropagation();
				evt.preventDefault();
				return;
			}
			if (evt.key === "Escape") {
				held = null;
				return;
			}
			if (evt.repeat && isLetter(evt.key)) {
				if (!held || held.key !== evt.key) {
					held = { key: evt.key, repeats: 0 };
				}
				held.repeats += 1;
				evt.stopImmediatePropagation();
				evt.preventDefault();
				return;
			}
			if (held && held.repeats > 0 && /^[1-9]$/.test(evt.key)) {
				evt.stopImmediatePropagation();
				return;
			}
			if (!composing && !evt.repeat && isLetter(evt.key)) {
				if (held && held.repeats > 0 && isAccentOf(evt.key, held.key)) {
					evt.stopImmediatePropagation();
					evt.preventDefault();
					landPick(ime, evt.key);
					return;
				}
				held = { key: evt.key, repeats: 0 };
			}
		}, true);

		ime.addEventListener("compositionstart", function () {
			composing = true;
		}, true);

		ime.addEventListener("beforeinput", function (evt) {
			if (applying || composing || !held) {
				return;
			}
			var data = evt.data || "";
			var type = evt.inputType || "";
			if (type === "insertReplacementText" && lettersOf(data).length === 1) {
				if (recentlySettled() && data === landed) {
					evt.preventDefault();
					return;
				}
				evt.preventDefault();
				landPick(ime, data);
				return;
			}
			if (type === "insertText" && held.repeats > 0 && isAccentOf(data, held.key)) {
				if (recentlySettled() && data === landed) {
					evt.preventDefault();
					return;
				}
				evt.preventDefault();
				landPick(ime, data);
			}
		}, true);

		ime.addEventListener("input", function (evt) {
			if (applying || composing || recentlySettled() || !held || held.repeats < 1) {
				return;
			}
			var data = evt.data || "";
			var ch = lettersOf(data)[0] || "";
			if (!ch || ch === held.key) {
				return;
			}
			if (evt.inputType === "insertReplacementText" || isAccentOf(ch, held.key)) {
				landPick(ime, ch);
			}
		}, true);

		ime.addEventListener("compositionend", function (evt) {
			var data = evt.data || "";
			var started = composing;
			composing = false;
			if (!started || !data) {
				return;
			}
			if (recentlySettled() && (data === landed || pickChar(data) === landed)) {
				applying = true;
				backspaces(ime, lettersOf(data).length);
				applying = false;
				return;
			}
			if (!held || held.repeats < 1 || data === held.key) {
				return;
			}
			peelCommit(ime, data);
		}, false);
	}

	function watch() {
		document.querySelectorAll("div.ime").forEach(hook);
	}

	var observer = new MutationObserver(watch);
	observer.observe(document.documentElement, { childList: true, subtree: true });
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", watch);
	} else {
		watch();
	}
})();
