# Maestro's Odyssey — Godot build

Neighborhood game on the zij2d Godot engine with **authored** Dragon's Brew plot (lorebook wins). Live `/maestros/` serves the web export in `../www/`. Phaser snapshot: `../archive/phaser-cafe-prototype/`.

## Web (Odd Trove)

`python3 tools/make_placeholder_assets.py` once, then from this folder:

Godot 4.7.2 `--headless --export-release Web`

Copy `build/web/` over `../www/`, then copy `brew.html` to `index.html` so `/maestros/` still loads. The packer only picks up JSON under `generated/`, so the authored world is `generated/dragons_brew_world.json` (same file as `backend/`).

## Play locally (desktop)

Needs **Godot 4.7**. From this folder:

1. `python3 tools/make_placeholder_assets.py` — once, unless you already have the local art packs under `assets/`
2. Open `project.godot` and press Play

WASD to move. **T** talks (a second **T** closes the line). **E** goes in and out of a door, and still takes the card and uses the dish cart. **R** reads the menu and the house rules. **S** sits and stands when you are at a chair; otherwise **S** walks down. **D** sips, **F** eats, Enter sends an order. Tab for the journal.

Play starts at your cottage. A small arrow points to the next stop. Talk to the elder, pick up the learning card, go into Dragon's Brew, meet Mara, read the menu and house rules.

## What this first Godot slice includes

- Street + enterable Dragon's Brew
- Elder prologue and prepaid learning card
- Sit on benches with **S** (street bench and the café seat)
- Mara's locked Çampire line, then typed order after you read the menu (small cup/muffin in hand; sit and **D** sip / **F** eat)
- Mara's wings overlay (Çampire read on the shared villager sheet; tail later)
- Monday iguana + riverfolk neighbors (sea-ferry talk, merfolk not picking fights)
- Authored menu and house-rules boards

Not in this slice yet: pesos HUD, day clock, café-lane picker, week-one rotating cast beyond Monday, or train.

## Art

`assets/` is gitignored. The real Fan-tasy / Mystic Woods packs are **not** redistributable. Placeholders let Godot boot; drop the real packs in the same paths if you have them licensed for local use.

## Do not

- Invent canon with the LLM generator (Play does not call it)
- Web-export licensed art packs from `assets/` — placeholders only on Odd Trove
