# Halalit — lofi reader nook demo (archived)

This folder preserves the **Pollinations + reader-look** experiment that placed a framed “lofi girl” style reading-nook illustration under the interactive CSS bookshelf on Personal Library.

It was **removed from the public site** (May 2026) because the generative art did not match the flat spine UI and felt like wallpaper layered on top of the shelf.

## What’s here

| File | Purpose |
|------|---------|
| `halalit-reader-look.js` | Home-page reader appearance (localStorage) |
| `halalit-library-scene.js` | Pollinations prompt + framed nook HTML |
| `demo.html` | Standalone preview: sample spines + reader nook |
| `demo-styles.css` | Layout/CSS for the nook + diorama (extracted from `www/index.html`) |

## How to preview

From this folder, serve locally (or open `demo.html` via a static server so Pollinations images load):

```bash
cd halalit/.cursor/demos/reader-nook-lofi
python3 -m http.server 8765
```

Then open `http://localhost:8765/demo.html`.

## Re-attaching to the live site later

1. Copy `halalit-reader-look.js` and `halalit-library-scene.js` back into `halalit/www/`.
2. Restore the reader-look panel, nook CSS, and `libraryReaderNookHtml` / `withPaintedRoom` wiring in `www/index.html` (see git history before this split).
3. Prefer **one authored illustration** or a tighter art pipeline before shipping publicly again—the style mismatch was the main issue, not the code structure.

## Public site after split

`www/index.html` Personal Library is **interactive spines only** (CSS diorama, long-press delete, Open Library enrich). No avatar, no Pollinations on the shelf page.
