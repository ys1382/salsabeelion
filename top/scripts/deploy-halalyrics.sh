#!/usr/bin/env bash
# Deploy HalaLyrics only — restarts ports 8083 (static) and 8084 (API).
# Does NOT restart Halalit, hub, LoreKeeper, or other kids sites.
#
# Usage:
#   bash top/scripts/deploy-halalyrics.sh [user@host] [remote_dir]
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

HALALYRICS_PORT="${HALALYRICS_PORT:-8083}"
HALALYRICS_API_PORT="${HALALYRICS_API_PORT:-8084}"
BIND="${BIND:-127.0.0.1}"

ssh_cmd() {
  ssh "${SSH_OPTS[@]}" "$@"
}

rsync_cmd() {
  rsync -avz "$@"
}

if [[ ! -d "$ROOT/halalyrics/www" ]]; then
  echo "Error: halalyrics/www not found." >&2
  exit 1
fi

echo "Syncing HalaLyrics to $HOST:~/$REMOTE_BASE/ ..."
ssh_cmd "$HOST" "mkdir -p ~/$REMOTE_BASE/ssl ~/$REMOTE_BASE/halalyrics ~/$REMOTE_BASE/halalyrics-server/config"

rsync_cmd "$ROOT/top/_shared/serve_static_https.py" "$ROOT/top/_shared/kids-watchdog.sh" "$HOST:~/$REMOTE_BASE/"
rsync_cmd "$ROOT/halalyrics/www/" "$HOST:~/$REMOTE_BASE/halalyrics/"
rsync_cmd "$ROOT/top/directory/www/index.html" "$HOST:~/$REMOTE_BASE/hub/index.html"
rsync_cmd "$ROOT/halalyrics/config/" "$HOST:~/$REMOTE_BASE/halalyrics-server/config/"
rsync_cmd \
  "$ROOT/halalyrics/halalyrics_api.py" \
  "$ROOT/halalyrics/halalyrics_scan.py" \
  "$HOST:~/$REMOTE_BASE/halalyrics-server/"

if [[ -f "$ROOT/halalyrics/.env" ]]; then
  rsync_cmd "$ROOT/halalyrics/.env" "$HOST:~/$REMOTE_BASE/halalyrics-server/.env"
  ssh_cmd "$HOST" "chmod 600 ~/$REMOTE_BASE/halalyrics-server/.env"
fi

ssh_cmd "$HOST" \
  REMOTE_BASE="$REMOTE_BASE" \
  HALALYRICS_PORT="$HALALYRICS_PORT" \
  HALALYRICS_API_PORT="$HALALYRICS_API_PORT" \
  BIND="$BIND" \
  'bash -s' << 'REMOTE'
set -euo pipefail
BASE="$HOME/$REMOTE_BASE"
SSL="$BASE/ssl"
mkdir -p "$SSL" "$BASE/halalyrics-server" "$BASE/halalyrics-server/cache/lrclib" "$BASE/halalyrics-server/cache/songcheck"
ENV_FILE="$BASE/halalyrics-server/.env"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

# Reuse Halalit Gemini key when HalaLyrics key is not set.
if ! grep -q "^HALALYRICS_GEMINI_API_KEY=" "$ENV_FILE" 2>/dev/null; then
  if [[ -f "$BASE/oddtrove-server/.env" ]]; then
    LEGACY_KEY="$(grep "^HALALIT_GEMINI_API_KEY=" "$BASE/oddtrove-server/.env" 2>/dev/null | head -1 | cut -d= -f2- || true)"
    if [[ -z "$LEGACY_KEY" ]]; then
      LEGACY_KEY="$(grep "^GEMINI_API_KEY=" "$BASE/oddtrove-server/.env" 2>/dev/null | head -1 | cut -d= -f2- || true)"
    fi
    if [[ -n "$LEGACY_KEY" ]]; then
      printf "\nHALALYRICS_GEMINI_API_KEY=%s\n" "$LEGACY_KEY" >> "$ENV_FILE"
    fi
  fi
fi
if ! grep -q "^HALALYRICS_GEMINI_MODEL=" "$ENV_FILE" 2>/dev/null; then
  if [[ -f "$BASE/oddtrove-server/.env" ]]; then
    LEGACY_MODEL="$(grep "^HALALIT_GEMINI_MODEL=" "$BASE/oddtrove-server/.env" 2>/dev/null | head -1 | cut -d= -f2- || true)"
  fi
  printf "HALALYRICS_GEMINI_MODEL=%s\n" "${LEGACY_MODEL:-gemini-2.5-flash-lite}" >> "$ENV_FILE"
fi
sed -i 's/^HALALYRICS_GEMINI_MODEL=gemini-2.5-flash$/HALALYRICS_GEMINI_MODEL=gemini-2.5-flash-lite/' "$ENV_FILE" 2>/dev/null || true

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

echo "Smoke test: import halalyrics_api before restart..."
if ! (cd "$BASE/halalyrics-server" && PYTHONPATH="$BASE/halalyrics-server" python3 -c "import halalyrics_api"); then
  echo "Error: halalyrics_api import failed — leaving existing processes running." >&2
  exit 1
fi

pkill -f "serve_static_https.py $HALALYRICS_PORT " 2>/dev/null || true
sleep 0.2
nohup python3 "$PY" "$HALALYRICS_PORT" "$BASE/halalyrics" "$KEY" "$CERT" "$BIND" \
  </dev/null >"/tmp/kids-site-${HALALYRICS_PORT}.log" 2>&1 &
echo "Started HalaLyrics static on port $HALALYRICS_PORT ($BIND)"

wd_name="halalyrics-api-${HALALYRICS_API_PORT}"
wd_pidfile="$(kids_watchdog_pidfile "$wd_name")"
kids_stop_watchdog "$wd_name" "halalyrics-api.log 2>&1"
pkill -f "halalyrics_api.py" 2>/dev/null || true
sleep 0.2
nohup bash -c '
  echo $$ > "'"$wd_pidfile"'"
  while true; do
    if [[ -f "'"$BASE"'/halalyrics-server/.env" ]]; then
      set -a
      # shellcheck disable=SC1091
      source "'"$BASE"'/halalyrics-server/.env"
      set +a
    fi
    HALALYRICS_VETTED_PATH="'"$BASE"'/halalyrics-server/config/hand_vetted.json" \
    HALALYRICS_API_PORT="'"$HALALYRICS_API_PORT"'" \
    HALALYRICS_API_BIND="'"$BIND"'" \
      python3 "'"$BASE"'/halalyrics-server/halalyrics_api.py" >>/tmp/halalyrics-api.log 2>&1
    echo "HalaLyrics API exited — restarting in 2s" >>/tmp/halalyrics-api.log
    sleep 2
  done
  rm -f "'"$wd_pidfile"'"
' </dev/null >/dev/null 2>&1 &
echo "Started HalaLyrics API on port $HALALYRICS_API_PORT ($BIND)"

sleep 1
curl -sk -o /dev/null -w "HalaLyrics static port ${HALALYRICS_PORT}: %{http_code}\n" \
  "https://127.0.0.1:${HALALYRICS_PORT}/" || true
curl -s -o /dev/null -w "HalaLyrics API port ${HALALYRICS_API_PORT}: %{http_code}\n" \
  "http://127.0.0.1:${HALALYRICS_API_PORT}/api/health" || true
REMOTE

echo ""
echo "Done. HalaLyrics only — other sites were not restarted."
echo "After nginx reload: https://oddtrove.art/halalyrics/"
echo ""
echo "Gemini: reuses Halalit key on server when HALALYRICS_GEMINI_API_KEY is unset."

if [[ "${HALALYRICS_SKIP_NGINX:-0}" != "1" ]]; then
  echo "Syncing nginx config for /halalyrics/ ..."
  rsync_cmd "$ROOT/top/nginx/oddtrove.art.conf" "$HOST:/etc/nginx/sites-available/oddtrove.art"
  ssh_cmd "$HOST" "nginx -t && systemctl reload nginx"
fi

echo "Nginx reloaded (set HALALYRICS_SKIP_NGINX=1 to skip)."
