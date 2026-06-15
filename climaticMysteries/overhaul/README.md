# Bane of Extinction — overhaul staging (not live)

Work here stays **off the site** until you promote it. The live game is still `boe/app.html`, `boe/assets/`, etc.

## Workflow

1. **Build the new version** under `boe/overhaul/` (copy `MANIFEST.example.json` to your own manifest when ready).
2. **List every file** that should replace live paths in the manifest `promote` list.
3. When you are ready to ship, tell the agent something like:
   - *Complete the overhaul now with `boe/overhaul/MANIFEST.json`*
   - *Ship the Boe overhaul using `boe/overhaul/summer/MANIFEST.json`*

The agent should read that manifest and run the promote script — no extra questions unless something is missing or broken.

## Manifest

- Copy `MANIFEST.example.json` → e.g. `MANIFEST.json` or `summer/MANIFEST.json`.
- Paths in `from` / `to` are relative to **`boe/`** (repo folder root for Bane).
- Set `"deploy": true` to push to oddtrove after promoting; `false` keeps changes local only.
- Set `"archive_before": true` (default) to snapshot current live `boe/` into `boe/_archive/` first.

## Preview locally

From `boe/`, open the staged file in a browser file URL, or temporarily point `serve.py` at a copy — **do not** edit live `app.html` while the overhaul is still in staging unless you mean to.

## After promote

Live files update in place. Staging folder is left as-is so you can diff or redo. Old live tree is in `_archive/` if archiving was on.
