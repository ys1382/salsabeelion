#!/usr/bin/env bash
# Deploy CleanScreen only — restarts ports 8081 (static) and 8082 (API).
# Does NOT restart Halalit, hub, LoreKeeper, or other kids sites.
#
# Usage:
#   bash top/scripts/deploy-cleanscreen.sh [user@host] [remote_dir]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

HOST="${1:-root@157.230.130.12}"
REMOTE_BASE="${2:-kids-sites}"

SSH_OPTS=(
  -o ConnectTimeout=30
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=3
)
export RSYNC_RSH="ssh ${SSH_OPTS[*]}"

CLEANSCREEN_PORT="${CLEANSCREEN_PORT:-8081}"
CLEANSCREEN_API_PORT="${CLEANSCREEN_API_PORT:-8082}"
BIND="${BIND:-127.0.0.1}"

ssh_cmd() {
  ssh "${SSH_OPTS[@]}" "$@"
}

rsync_cmd() {
  rsync -avz "$@"
}

if [[ ! -d "$ROOT/cleanscreen/www" ]]; then
  echo "Error: cleanscreen/www not found." >&2
  exit 1
fi

if [[ "${CLEANSCREEN_SKIP_TESTS:-0}" != "1" ]]; then
  echo "Running CleanScreen filter tests..."
  (cd "$ROOT/cleanscreen" && python3 -m unittest discover -s tests -q)
fi

echo "Syncing CleanScreen to $HOST:~/$REMOTE_BASE/ ..."
ssh_cmd "$HOST" "mkdir -p ~/$REMOTE_BASE/ssl ~/$REMOTE_BASE/cleanscreen ~/$REMOTE_BASE/cleanscreen-data ~/$REMOTE_BASE/cleanscreen-server/config"

rsync_cmd "$ROOT/top/_shared/serve_static_https.py" "$ROOT/top/_shared/kids-watchdog.sh" "$HOST:~/$REMOTE_BASE/"
rsync_cmd "$ROOT/cleanscreen/www/" "$HOST:~/$REMOTE_BASE/cleanscreen/"
rsync_cmd "$ROOT/top/directory/www/index.html" "$HOST:~/$REMOTE_BASE/hub/index.html"
rsync_cmd "$ROOT/cleanscreen/config/" "$HOST:~/$REMOTE_BASE/cleanscreen-server/config/"
rsync_cmd \
  "$ROOT/cleanscreen/cleanscreen_api.py" \
  "$ROOT/cleanscreen/cleanscreen_filter.py" \
  "$HOST:~/$REMOTE_BASE/cleanscreen-server/"

if [[ -f "$ROOT/cleanscreen/.env" ]]; then
  rsync_cmd "$ROOT/cleanscreen/.env" "$HOST:~/$REMOTE_BASE/cleanscreen-server/.env"
  ssh_cmd "$HOST" "chmod 600 ~/$REMOTE_BASE/cleanscreen-server/.env"
fi

ssh_cmd "$HOST" \
  REMOTE_BASE="$REMOTE_BASE" \
  CLEANSCREEN_PORT="$CLEANSCREEN_PORT" \
  CLEANSCREEN_API_PORT="$CLEANSCREEN_API_PORT" \
  BIND="$BIND" \
  'bash -s' << 'REMOTE'
set -euo pipefail
BASE="$HOME/$REMOTE_BASE"
SSL="$BASE/ssl"
mkdir -p "$SSL" "$BASE/cleanscreen-data" "$BASE/cleanscreen-server"
if [[ ! -f "$SSL/key.pem" || ! -f "$SSL/cert.pem" ]]; then
  openssl req -x509 -newkey rsa:2048 \
    -keyout "$SSL/key.pem" -out "$SSL/cert.pem" \
    -days 825 -nodes \
    -subj "/CN=157.230.130.12" 2>/dev/null
fi
PY="$BASE/serve_static_https.py"
KEY="$SSL/key.pem"
CERT="$SSL/cert.pem"
# shellcheck source=/dev/null
source "$BASE/kids-watchdog.sh"

echo "Smoke test: import cleanscreen_api before restart..."
if ! (cd "$BASE/cleanscreen-server" && PYTHONPATH="$BASE/cleanscreen-server" python3 -c "import cleanscreen_api"); then
  echo "Error: cleanscreen_api import failed — leaving existing processes running." >&2
  exit 1
fi

pkill -f "serve_static_https.py $CLEANSCREEN_PORT " 2>/dev/null || true
sleep 0.2
nohup python3 "$PY" "$CLEANSCREEN_PORT" "$BASE/cleanscreen" "$KEY" "$CERT" "$BIND" \
  </dev/null >"/tmp/kids-site-${CLEANSCREEN_PORT}.log" 2>&1 &
echo "Started CleanScreen static on port $CLEANSCREEN_PORT ($BIND)"

wd_name="cleanscreen-api-${CLEANSCREEN_API_PORT}"
wd_pidfile="$(kids_watchdog_pidfile "$wd_name")"
kids_stop_watchdog "$wd_name" "cleanscreen-api.log 2>&1"
pkill -f "cleanscreen_api.py" 2>/dev/null || true
sleep 0.2
nohup bash -c '
  echo $$ > "'"$wd_pidfile"'"
  while true; do
    if [[ -f "'"$BASE"'/cleanscreen-server/.env" ]]; then
      set -a
      # shellcheck disable=SC1091
      source "'"$BASE"'/cleanscreen-server/.env"
      set +a
    fi
    CLEANSCREEN_DATA_PATH="'"$BASE"'/cleanscreen-data" \
    CLEANSCREEN_API_PORT="'"$CLEANSCREEN_API_PORT"'" \
    CLEANSCREEN_API_BIND="'"$BIND"'" \
      python3 "'"$BASE"'/cleanscreen-server/cleanscreen_api.py" >>/tmp/cleanscreen-api.log 2>&1
    echo "CleanScreen API exited — restarting in 2s" >>/tmp/cleanscreen-api.log
    sleep 2
  done
  rm -f "'"$wd_pidfile"'"
' </dev/null >/dev/null 2>&1 &
echo "Started CleanScreen API on port $CLEANSCREEN_API_PORT ($BIND)"

sleep 1
curl -sk -o /dev/null -w "CleanScreen static port ${CLEANSCREEN_PORT}: %{http_code}\n" \
  "https://127.0.0.1:${CLEANSCREEN_PORT}/" || true
curl -s -o /dev/null -w "CleanScreen API port ${CLEANSCREEN_API_PORT}: %{http_code}\n" \
  "http://127.0.0.1:${CLEANSCREEN_API_PORT}/api/health" || true
REMOTE

echo ""
echo "Done. CleanScreen only — other sites were not restarted."
echo "After nginx reload: https://oddtrove.art/cleanscreen/ (owner gate)"
echo ""
echo "Optional: set BRAVE_SEARCH_API_KEY in ~/kids-sites/cleanscreen-server/.env on the VPS."

if [[ "${CLEANSCREEN_SKIP_NGINX:-0}" != "1" ]]; then
  echo "Syncing nginx config for /cleanscreen/ ..."
  rsync_cmd "$ROOT/top/nginx/oddtrove.art.conf" "$HOST:/etc/nginx/sites-available/oddtrove.art"
  ssh_cmd "$HOST" "nginx -t && systemctl reload nginx"
fi

echo "Nginx reloaded (set CLEANSCREEN_SKIP_NGINX=1 to skip)."
