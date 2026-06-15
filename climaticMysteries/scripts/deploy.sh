#!/usr/bin/env bash
# Deploy Boe static files to root@157.230.130.12:~/boe
# Does not use --delete so large Godot binaries already on the server are kept if missing locally.
set -euo pipefail

HOST="${1:-root@157.230.130.12}"
REMOTE_DIR="${2:-boe}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT"

echo "Syncing to $HOST:~/$REMOTE_DIR/ ..."
rsync -avz \
  app.html \
  index.html \
  godot.html \
  serve.py \
  index.js \
  index.audio.position.worklet.js \
  index.audio.worklet.js \
  index.png \
  index.icon.png \
  index.apple-touch-icon.png \
  "$HOST:~/$REMOTE_DIR/"
# Preserve directory name on remote (trailing slash on assets/ would flatten files into ~/boe).
rsync -avz "$ROOT/assets" "$HOST:~/$REMOTE_DIR/"

if [[ -f index.wasm && -f index.pck ]]; then
  rsync -avz index.wasm index.pck "$HOST:~/$REMOTE_DIR/"
else
  echo "Note: index.wasm / index.pck not present here (often gitignored); leaving existing copies on server."
fi

PORT="${3:-8060}"
echo "Restarting serve.py on $HOST (port $PORT)..."
ssh "$HOST" "REMOTE_DIR='$REMOTE_DIR' PORT='$PORT'" 'bash -s' << 'REMOTE'
set -e
pkill -f "serve.py.*$PORT" 2>/dev/null || true
sleep 0.5
cd ~/"$REMOTE_DIR"
if [[ ! -f key.pem ]] || [[ ! -f cert.pem ]]; then
  openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost" 2>/dev/null
fi
nohup python3 serve.py "$PORT" . key.pem cert.pem </dev/null >/tmp/boe.log 2>&1 &
sleep 1
curl -sk -o /dev/null -w "index: %{http_code}\n" "https://localhost:$PORT/index.html" || true
curl -sk -o /dev/null -w "app: %{http_code}\n" "https://localhost:$PORT/app.html" || true
REMOTE

echo "Done. Open https://157.230.130.12:$PORT/ (animated app at / and /app.html; Godot at /godot.html)."
