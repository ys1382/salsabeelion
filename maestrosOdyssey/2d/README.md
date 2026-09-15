# Maestro's Odyssey — Godot build

New local build of the neighborhood game, using the zij2d Godot engine with **authored** Dragon's Brew plot (lorebook wins). This does **not** replace the live Phaser café on `/maestros/`.

Old Phaser café snapshot: `../archive/phaser-cafe-prototype/`.

## Play

Needs **Godot 4.6**. From this folder:

1. `python3 tools/make_placeholder_assets.py` — once, unless you already have the local art packs under `assets/`
2. Open `project.godot` and press Play

WASD to move, **E** to talk / read / go inside, Tab for the journal.

Play starts on the block. Talk to the elder, pick up the learning card, go into Dragon's Brew, meet Mara, read the menu and house rules.

## What this first Godot slice includes

- Street + enterable Dragon's Brew
- Elder prologue and prepaid learning card
- Mara's locked Çampire line, then menu / order talk
- Monday iguana + riverfolk neighbors (sea-ferry talk, merfolk not picking fights)
- Authored menu and house-rules boards

Not in this slice yet: typed orders, pesos HUD, day clock, café-lane picker, week-one rotating cast beyond Monday, train, or a web export for Odd Trove.

## Art

`assets/` is gitignored. The real Fan-tasy / Mystic Woods packs are **not** redistributable. Placeholders let Godot boot; drop the real packs in the same paths if you have them licensed for local use.

## Do not

- Invent canon with the LLM generator (Play does not call it)
- Deploy this folder to `/maestros/` — live site still rsyncs `../www/`
