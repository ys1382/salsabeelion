#!/usr/bin/env bash
# Deploy Bane of Extinction owner-beta — static 8085 + API 8086.
# Also syncs hub index.html. Reloads nginx unless BANE_SKIP_NGINX=1.
# Uses shared ~/kids-sites/anthropic.key for Claude callouts (same as LoreKeeper).
# Does NOT restart Halalit or other kids sites.
#
# Usage:
#   bash top/scripts/deploy-bane-of-extinction.sh [user@host] [remote_dir]
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

BANE_PORT="${BANE_PORT:-8085}"
BANE_API_PORT="${BANE_API_PORT:-8086}"
BIND="${BIND:-127.0.0.1}"

ssh_cmd() {
  ssh "${SSH_OPTS[@]}" "$@"
}

rsync_cmd() {
  rsync -avz "$@"
}

if [[ ! -d "$ROOT/baneOfExtinction/www" ]]; then
  echo "Error: baneOfExtinction/www not found." >&2
  exit 1
fi
if [[ ! -f "$ROOT/baneOfExtinction/bane_api.py" ]]; then
  echo "Error: baneOfExtinction/bane_api.py not found." >&2
  exit 1
fi

echo "Syncing Bane of Extinction to $HOST:~/$REMOTE_BASE/ ..."
ssh_cmd "$HOST" "mkdir -p ~/$REMOTE_BASE/ssl ~/$REMOTE_BASE/bane-of-extinction ~/$REMOTE_BASE/bane-server/learned ~/$REMOTE_BASE/hub ~/$REMOTE_BASE/_shared"

rsync_cmd "$ROOT/top/_shared/serve_static_https.py" "$ROOT/top/_shared/kids-watchdog.sh" "$HOST:~/$REMOTE_BASE/"
rsync_cmd "$ROOT/top/_shared/oddtrove_sso.py" "$HOST:~/$REMOTE_BASE/_shared/oddtrove_sso.py"
rsync_cmd "$ROOT/baneOfExtinction/www/" "$HOST:~/$REMOTE_BASE/bane-of-extinction/"
rsync_cmd "$ROOT/baneOfExtinction/bane_api.py" "$HOST:~/$REMOTE_BASE/bane-server/bane_api.py"
rsync_cmd "$ROOT/top/directory/www/index.html" "$HOST:~/$REMOTE_BASE/hub/index.html"

ssh_cmd "$HOST" \
  REMOTE_BASE="$REMOTE_BASE" \
  BANE_PORT="$BANE_PORT" \
  BANE_API_PORT="$BANE_API_PORT" \
  BIND="$BIND" \
  'bash -s' << 'REMOTE'
set -euo pipefail
BASE="$HOME/$REMOTE_BASE"
SSL="$BASE/ssl"
mkdir -p "$SSL" "$BASE/bane-of-extinction" "$BASE/bane-server"
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

echo "Ensure Pillow for codex-still shrink..."
if ! python3 -c "from PIL import Image" 2>/dev/null; then
  apt-get install -y -qq python3-pil >/tmp/bane-pillow-apt.log 2>&1 || \
    python3 -m pip install --user --break-system-packages -q Pillow >/tmp/bane-pillow-pip.log 2>&1 || \
    echo "Pillow install skipped/failed (client still shrinks)" >&2
fi
python3 -c "from PIL import Image; print('Pillow OK', Image.__version__)" 2>/dev/null || true

echo "Smoke test: import bane_api before restart..."
if ! (cd "$BASE/bane-server" && PYTHONPATH="$BASE/_shared" python3 -c "import bane_api; assert bane_api.identity_from_cookie_header is not None"); then
  echo "Error: bane_api import failed — leaving existing processes running." >&2
  exit 1
fi

pkill -f "serve_static_https.py $BANE_PORT " 2>/dev/null || true
sleep 0.2
nohup python3 "$PY" "$BANE_PORT" "$BASE/bane-of-extinction" "$KEY" "$CERT" "$BIND" \
  </dev/null >"/tmp/kids-site-${BANE_PORT}.log" 2>&1 &
echo "Started Bane of Extinction static on port $BANE_PORT ($BIND)"

wd_name="bane-api-${BANE_API_PORT}"
wd_pidfile="$(kids_watchdog_pidfile "$wd_name")"
kids_stop_watchdog "$wd_name" "bane-api.log 2>&1"
pkill -f "bane_api.py" 2>/dev/null || true
sleep 0.2
nohup bash -c '
  echo $$ > "'"$wd_pidfile"'"
  while true; do
    if [[ -f "'"$BASE"'/oddtrove-server/.env" ]]; then
      set -a
      # shellcheck disable=SC1091
      source "'"$BASE"'/oddtrove-server/.env"
      set +a
    fi
    if [[ -f "'"$BASE"'/bane-server/.env" ]]; then
      set -a
      # shellcheck disable=SC1091
      source "'"$BASE"'/bane-server/.env"
      set +a
    fi
    BANE_API_PORT="'"$BANE_API_PORT"'" \
    BANE_API_BIND="'"$BIND"'" \
    BANE_SHARED_PATH="'"$BASE"'/_shared" \
    PYTHONPATH="'"$BASE"'/_shared" \
    KIDS_SITES_ANTHROPIC_KEY_PATH="'"$BASE"'/anthropic.key" \
      python3 "'"$BASE"'/bane-server/bane_api.py" >>/tmp/bane-api.log 2>&1
    echo "Bane API exited — restarting in 2s" >>/tmp/bane-api.log
    sleep 2
  done
  rm -f "'"$wd_pidfile"'"
' </dev/null >/dev/null 2>&1 &
echo "Started Bane API on port $BANE_API_PORT ($BIND)"

sleep 1
curl -sk -o /dev/null -w "Bane static port ${BANE_PORT}: %{http_code}\n" \
  "https://127.0.0.1:${BANE_PORT}/" || true
curl -s -o /dev/null -w "Bane API port ${BANE_API_PORT}: %{http_code}\n" \
  "http://127.0.0.1:${BANE_API_PORT}/api/health" || true

# Restart hub owner API so updated oddtrove_sso return allowlist (BoE) is live.
if [[ -f "$BASE/hub_owner_api.py" ]]; then
  pkill -f "hub_owner_api.py" 2>/dev/null || true
  sleep 0.2
  (
    cd "$BASE"
    if [[ -f "$BASE/oddtrove-server/.env" ]]; then
      set -a
      # shellcheck disable=SC1091
      source "$BASE/oddtrove-server/.env"
      set +a
    fi
    PYTHONPATH="$BASE/_shared" \
      nohup python3 "$BASE/hub_owner_api.py" </dev/null >/tmp/hub-owner-api.log 2>&1 &
  )
  echo "Restarted hub owner API (Google return → /bane-of-extinction/ allowed)"
fi
REMOTE

echo ""
echo "Done. Bane of Extinction only — other sites were not restarted."
echo "After nginx reload: https://oddtrove.art/bane-of-extinction/poppy.html (owner gate)"

if [[ "${BANE_SKIP_NGINX:-0}" != "1" ]]; then
  echo "Syncing nginx config for /bane-of-extinction/ ..."
  rsync_cmd "$ROOT/top/nginx/oddtrove.art.conf" "$HOST:/etc/nginx/sites-available/oddtrove.art"
  ssh_cmd "$HOST" "nginx -t && systemctl reload nginx"
  echo "Nginx reloaded."
else
  echo "Skipped nginx (BANE_SKIP_NGINX=1)."
fi
