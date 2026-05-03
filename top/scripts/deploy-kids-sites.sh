#!/usr/bin/env bash
# Deploy directory hub + maestrosOdyssey + envDyst + crocheter static sites to
# root@157.230.130.12 with HTTPS (self-signed) per port.
set -euo pipefail

HOST="${1:-root@157.230.130.12}"
REMOTE_BASE="${2:-kids-sites}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

HUB_PORT="${HUB_PORT:-8070}"
MAESTROS_PORT="${MAESTROS_PORT:-8071}"
ENVDYST_PORT="${ENVDYST_PORT:-8072}"
CROCHETER_PORT="${CROCHETER_PORT:-8073}"

echo "Syncing static sites to $HOST:~/$REMOTE_BASE/ ..."
ssh "$HOST" "mkdir -p ~/$REMOTE_BASE/ssl ~/$REMOTE_BASE/hub ~/$REMOTE_BASE/maestros ~/$REMOTE_BASE/envdyst ~/$REMOTE_BASE/crocheter"

rsync -avz "$ROOT/top/_shared/serve_static_https.py" "$HOST:~/$REMOTE_BASE/"
rsync -avz "$ROOT/top/directory/www/" "$HOST:~/$REMOTE_BASE/hub/"
rsync -avz "$ROOT/maestrosOdyssey/www/" "$HOST:~/$REMOTE_BASE/maestros/"
rsync -avz "$ROOT/envDyst/www/" "$HOST:~/$REMOTE_BASE/envdyst/"
rsync -avz "$ROOT/crocheter/www/" "$HOST:~/$REMOTE_BASE/crocheter/"

echo "Installing TLS certs (if missing) and starting HTTPS servers..."
ssh "$HOST" \
  REMOTE_BASE="$REMOTE_BASE" \
  HUB_PORT="$HUB_PORT" \
  MAESTROS_PORT="$MAESTROS_PORT" \
  ENVDYST_PORT="$ENVDYST_PORT" \
  CROCHETER_PORT="$CROCHETER_PORT" \
  'bash -s' << 'REMOTE'
set -e
BASE="$HOME/$REMOTE_BASE"
SSL="$BASE/ssl"
mkdir -p "$SSL"
if [[ ! -f "$SSL/key.pem" || ! -f "$SSL/cert.pem" ]]; then
  openssl req -x509 -newkey rsa:2048 \
    -keyout "$SSL/key.pem" -out "$SSL/cert.pem" \
    -days 825 -nodes \
    -subj "/CN=157.230.130.12" 2>/dev/null
fi
PY="$BASE/serve_static_https.py"
KEY="$SSL/key.pem"
CERT="$SSL/cert.pem"

for port in "$HUB_PORT" "$MAESTROS_PORT" "$ENVDYST_PORT" "$CROCHETER_PORT"; do
  pkill -f "serve_static_https.py $port " 2>/dev/null || true
done
sleep 0.6

start_one() {
  local port="$1" dir="$2" name="$3"
  nohup python3 "$PY" "$port" "$dir" "$KEY" "$CERT" \
    </dev/null >"/tmp/kids-site-${port}.log" 2>&1 &
  echo "Started $name on port $port"
}

start_one "$HUB_PORT" "$BASE/hub" "hub"
start_one "$MAESTROS_PORT" "$BASE/maestros" "maestrosOdyssey"
start_one "$ENVDYST_PORT" "$BASE/envdyst" "envDyst"
start_one "$CROCHETER_PORT" "$BASE/crocheter" "crocheter"

sleep 1
for port in "$HUB_PORT" "$MAESTROS_PORT" "$ENVDYST_PORT" "$CROCHETER_PORT"; do
  curl -sk -o /dev/null -w "port ${port}: %{http_code}\n" "https://127.0.0.1:${port}/" || true
done
REMOTE

echo ""
echo "Done. Open https://157.230.130.12:${HUB_PORT}/ for the directory page."
echo "Maestro's Odyssey: https://157.230.130.12:${MAESTROS_PORT}/"
echo "envDyst:          https://157.230.130.12:${ENVDYST_PORT}/"
echo "crocheter:        https://157.230.130.12:${CROCHETER_PORT}/"
