#!/usr/bin/env bash
# Download woff2 (regular, bold, italic) for LoreKeeper fonts — self-hosted on Odd Trove only.
# Build-time fetch from Google Fonts; readers never contact Google at write time.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/www/fonts/woff2"
CSS="$ROOT/www/lk-fonts-hosted.css"
mkdir -p "$OUT"

HOSTED=(
  "Amatic SC" "Caveat" "Comfortaa" "Comic Neue" "Courier Prime" "Crimson Text"
  "Dancing Script" "EB Garamond" "Grenze Gotisch" "Indie Flower" "Lato" "Lexend"
  "Lobster" "Lora" "Merriweather" "Montserrat" "Nunito" "Open Sans" "Oswald"
  "Pacifico" "Playfair Display" "Poppins" "PT Sans" "PT Serif" "Raleway" "Roboto"
  "Roboto Mono" "Roboto Slab" "Rubik" "Source Sans 3" "Source Serif 4" "Spectral"
  "Ubuntu" "Work Sans" "Inter" "Libre Baskerville" "Fira Sans" "Bitter" "Cormorant"
  "Josefin Sans" "Manrope" "Noto Sans" "Noto Serif" "Oxygen" "Quicksand" "Barlow"
  "Anton" "Permanent Marker" "Great Vibes" "Satisfy" "Shadows Into Light"
  "Bebas Neue" "Inconsolata" "DM Sans" "DM Serif Display" "Mukta" "Karla"
  "Archivo" "Titillium Web" "Heebo" "Kanit" "Signika" "Signika Negative"
  "Arimo" "Tinos" "Cousine" "Cardo" "Vollkorn" "Alegreya" "Alegreya Sans"
  "IBM Plex Sans" "IBM Plex Serif" "IBM Plex Mono"
  "Elsie Swash Caps" "Kaushan Script" "Cinzel" "Uncial Antiqua" "Special Elite"
)

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
: > "$CSS"
echo "/* Self-hosted open fonts for LoreKeeper — SIL OFL / Apache licensed Google Fonts */" >> "$CSS"

for NAME in "${HOSTED[@]}"; do
  case "$NAME" in
    Spectral) W="0,400;0,500;0,600;0,700;0,800;1,400" ;;
    "Grenze Gotisch") W="0,400;0,500;0,600;0,700;0,900;1,400" ;;
    *) W="0,400;0,700;1,400" ;;
  esac
  python3 - "$NAME" "$OUT" "$CSS" "$UA" "$W" <<'PY'
import re, subprocess, sys, urllib.parse

name, out_dir, css_path, ua, wght_spec = sys.argv[1:6]
slug = name.lower().replace(" ", "-")
enc = urllib.parse.quote(name)
url = (
    "https://fonts.googleapis.com/css2?family="
    + enc.replace(" ", "+")
    + ":ital,wght@"
    + wght_spec
    + "&display=swap"
)
proc = subprocess.run(
    ["curl", "-fsSL", url, "-H", f"User-Agent: {ua}"],
    capture_output=True,
    text=True,
    check=False,
)
if proc.returncode != 0 or not proc.stdout.strip():
    print(f"skip (css): {name}", file=sys.stderr)
    sys.exit(0)

blocks = re.findall(r"@font-face\s*\{[^}]+\}", proc.stdout, flags=re.I)
if not blocks:
    print(f"skip (faces): {name}", file=sys.stderr)
    sys.exit(0)

seen = set()
css_bits = []
for block in blocks:
    url_m = re.search(r"url\((https://[^)]+\.woff2)\)", block)
    if not url_m:
        continue
    style = "italic" if re.search(r"font-style\s*:\s*italic", block, re.I) else "normal"
    weight_m = re.search(r"font-weight\s*:\s*(\d+)", block)
    weight = weight_m.group(1) if weight_m else "400"
    key = (style, weight)
    if key in seen:
        continue
    seen.add(key)
    suffix = f"{weight}" if style == "normal" else f"{weight}-italic"
    fname = f"{slug}-{suffix}.woff2"
    fpath = f"{out_dir}/{fname}"
    dl = subprocess.run(["curl", "-fsSL", url_m.group(1), "-o", fpath], check=False)
    if dl.returncode != 0:
        continue
    safe = name.replace('"', '\\"')
    css_bits.append(
        f'@font-face {{\n'
        f'  font-family: "{safe}";\n'
        f'  font-style: {style};\n'
        f'  font-weight: {weight};\n'
        f'  font-display: swap;\n'
        f'  src: url("/lorekeeper/fonts/woff2/{fname}") format("woff2");\n'
        f"}}\n"
    )

if not css_bits:
    print(f"skip (woff2): {name}", file=sys.stderr)
    sys.exit(0)

with open(css_path, "a", encoding="utf-8") as f:
    f.write("\n".join(css_bits))
    f.write("\n")
print(f"ok: {name} ({len(css_bits)} faces)")
PY
done

echo "Wrote $CSS and fonts in $OUT"
