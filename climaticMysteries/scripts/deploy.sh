#!/usr/bin/env bash
# Deploy Climatic Mysteries static files to root@157.230.130.12:~/climatic-mysteries
# Does not use --delete so large Godot binaries already on the server are kept if missing locally.
set -euo pipefail

HOST="${1:-root@157.230.130.12}"
REMOTE_DIR="${2:-climatic-mysteries}"
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
# Preserve directory name on remote (trailing slash on assets/ would flatten files into ~/climatic-mysteries).
rsync -avz "$ROOT/assets" "$HOST:~/$REMOTE_DIR/"

if [[ -f index.wasm && -f index.pck ]]; then
  rsync -avz index.wasm index.pck "$HOST:~/$REMOTE_DIR/"
else
  echo "Note: index.wasm / index.pck not present here (often gitignored); leaving existing copies on server."
fi

PORT="${3:-8060}"
echo "Restarting serve.py on $HOST (port $PORT, bind 127.0.0.1)..."
ssh "$HOST" "REMOTE_DIR='$REMOTE_DIR' PORT='$PORT'" 'bash -s' << 'REMOTE'
set -e
pid=$(ss -tlnp 2>/dev/null | grep ":$PORT " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; fi
sleep 0.5
cd ~/"$REMOTE_DIR"
if [[ ! -f key.pem ]] || [[ ! -f cert.pem ]]; then
  openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost" 2>/dev/null
fi
nohup python3 serve.py "$PORT" . key.pem cert.pem 127.0.0.1 </dev/null >/tmp/climatic-mysteries.log 2>&1 &
sleep 1
curl -sk -o /dev/null -w "index: %{http_code}\n" "https://127.0.0.1:$PORT/index.html" || true
curl -sk -o /dev/null -w "app: %{http_code}\n" "https://127.0.0.1:$PORT/app.html" || true
REMOTE

echo "Done. Owner-only: https://oddtrove.art/climatic-mysteries/ (browser login). Backend is localhost-only on port $PORT."
