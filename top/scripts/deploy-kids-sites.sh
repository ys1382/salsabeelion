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
HALALIT_PORT="${HALALIT_PORT:-8074}"
RPG_PORT="${RPG_PORT:-8078}"
HUB_OWNER_API_PORT="${HUB_OWNER_API_PORT:-8077}"
BIND="${BIND:-127.0.0.1}"
RPG_BIND="${RPG_BIND:-0.0.0.0}"

echo "Syncing static sites to $HOST:~/$REMOTE_BASE/ ..."
ssh "$HOST" "mkdir -p ~/$REMOTE_BASE/ssl ~/$REMOTE_BASE/hub ~/$REMOTE_BASE/maestros ~/$REMOTE_BASE/envdyst ~/$REMOTE_BASE/crocheter ~/$REMOTE_BASE/halalit ~/$REMOTE_BASE/rpg"

rsync -avz "$ROOT/top/_shared/serve_static_https.py" "$ROOT/top/_shared/hub_owner_api.py" "$HOST:~/$REMOTE_BASE/"
rsync -avz "$ROOT/top/directory/www/" "$HOST:~/$REMOTE_BASE/hub/"
rsync -avz "$ROOT/maestrosOdyssey/www/" "$HOST:~/$REMOTE_BASE/maestros/"
rsync -avz "$ROOT/envDyst/www/" "$HOST:~/$REMOTE_BASE/envdyst/"
rsync -avz "$ROOT/crocheter/www/" "$HOST:~/$REMOTE_BASE/crocheter/"
if [[ -d "$ROOT/halalit/www" ]]; then
  rsync -avz "$ROOT/halalit/www/" "$HOST:~/$REMOTE_BASE/halalit/"
else
  echo "Note: halalit/www not in this checkout — leaving existing halalit files on server."
fi
if [[ -d "$ROOT/rpg/www" ]]; then
  rsync -avz "$ROOT/rpg/www/" "$HOST:~/$REMOTE_BASE/rpg/"
fi

echo "Installing TLS certs (if missing) and starting HTTPS servers..."
ssh "$HOST" \
  REMOTE_BASE="$REMOTE_BASE" \
  HUB_PORT="$HUB_PORT" \
  MAESTROS_PORT="$MAESTROS_PORT" \
  ENVDYST_PORT="$ENVDYST_PORT" \
  CROCHETER_PORT="$CROCHETER_PORT" \
  HALALIT_PORT="$HALALIT_PORT" \
  RPG_PORT="$RPG_PORT" \
  HUB_OWNER_API_PORT="$HUB_OWNER_API_PORT" \
  BIND="$BIND" \
  RPG_BIND="$RPG_BIND" \
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

for port in "$HUB_PORT" "$MAESTROS_PORT" "$ENVDYST_PORT" "$CROCHETER_PORT" "$HALALIT_PORT" "$RPG_PORT"; do
  pkill -f "serve_static_https.py $port " 2>/dev/null || true
done
pkill -f "hub_owner_api.py" 2>/dev/null || true
sleep 0.6

start_one() {
  local port="$1" dir="$2" name="$3"
  local bind="${4:-$BIND}"
  nohup python3 "$PY" "$port" "$dir" "$KEY" "$CERT" "$bind" \
    </dev/null >"/tmp/kids-site-${port}.log" 2>&1 &
  echo "Started $name on port $port ($bind)"
}

start_one "$HUB_PORT" "$BASE/hub" "hub"
start_one "$MAESTROS_PORT" "$BASE/maestros" "maestrosOdyssey"
start_one "$ENVDYST_PORT" "$BASE/envdyst" "envDyst"
start_one "$CROCHETER_PORT" "$BASE/crocheter" "crocheter"
start_one "$HALALIT_PORT" "$BASE/halalit" "halalit"
if [[ -d "$BASE/rpg" ]]; then
  start_one "$RPG_PORT" "$BASE/rpg" "rpg" "$RPG_BIND"
fi

nohup python3 "$BASE/hub_owner_api.py" </dev/null >"/tmp/hub-owner-api.log" 2>&1 &
echo "Started hub owner API on port $HUB_OWNER_API_PORT ($BIND)"

sleep 1
for port in "$HUB_PORT" "$MAESTROS_PORT" "$ENVDYST_PORT" "$CROCHETER_PORT" "$HALALIT_PORT" "$RPG_PORT"; do
  curl -sk -o /dev/null -w "port ${port}: %{http_code}\n" "https://127.0.0.1:${port}/" || true
done
REMOTE

echo ""
echo "Done. Open https://157.230.130.12:${HUB_PORT}/ for the directory page."
echo "Maestro's Odyssey: https://157.230.130.12:${MAESTROS_PORT}/"
echo "envDyst:          https://157.230.130.12:${ENVDYST_PORT}/"
echo "Pixel Farm RPG:   https://157.230.130.12:${RPG_PORT}/"
echo "Halalit (public):  https://oddtrove.art/halalit/"
echo "crocheter:        https://oddtrove.art/crocheter/"
