#!/usr/bin/env bash
# Deploy HalalFlicks only — restarts ports 8088 (static) and 8089 (API).
# Owner-only via nginx hub cookie. Does NOT restart other kids sites.
#
# Usage:
#   bash top/scripts/deploy-halalflicks.sh [user@host] [remote_dir]
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

HALALFLICKS_PORT="${HALALFLICKS_PORT:-8088}"
HALALFLICKS_API_PORT="${HALALFLICKS_API_PORT:-8089}"
BIND="${BIND:-127.0.0.1}"

ssh_cmd() {
  ssh "${SSH_OPTS[@]}" "$@"
}

rsync_cmd() {
  rsync -avz "$@"
}

if [[ ! -d "$ROOT/halalflicks/www" ]]; then
  echo "Error: halalflicks/www not found." >&2
  exit 1
fi

echo "Syncing HalalFlicks to $HOST:~/$REMOTE_BASE/ ..."
ssh_cmd "$HOST" "mkdir -p ~/$REMOTE_BASE/ssl ~/$REMOTE_BASE/halalflicks ~/$REMOTE_BASE/halalflicks-server/config"

rsync_cmd "$ROOT/top/_shared/serve_static_https.py" "$ROOT/top/_shared/kids-watchdog.sh" "$HOST:~/$REMOTE_BASE/"
rsync_cmd "$ROOT/halalflicks/www/" "$HOST:~/$REMOTE_BASE/halalflicks/"
rsync_cmd "$ROOT/top/directory/www/index.html" "$HOST:~/$REMOTE_BASE/hub/index.html"
rsync_cmd "$ROOT/halalflicks/config/" "$HOST:~/$REMOTE_BASE/halalflicks-server/config/"
rsync_cmd \
  "$ROOT/halalflicks/halalflicks_api.py" \
  "$ROOT/halalflicks/halalflicks_scan.py" \
  "$HOST:~/$REMOTE_BASE/halalflicks-server/"

if [[ -f "$ROOT/halalflicks/.env" ]]; then
  rsync_cmd "$ROOT/halalflicks/.env" "$HOST:~/$REMOTE_BASE/halalflicks-server/.env"
  ssh_cmd "$HOST" "chmod 600 ~/$REMOTE_BASE/halalflicks-server/.env"
fi

ssh_cmd "$HOST" \
  REMOTE_BASE="$REMOTE_BASE" \
  HALALFLICKS_PORT="$HALALFLICKS_PORT" \
  HALALFLICKS_API_PORT="$HALALFLICKS_API_PORT" \
  BIND="$BIND" \
  'bash -s' << 'REMOTE'
set -euo pipefail
BASE="$HOME/$REMOTE_BASE"
SSL="$BASE/ssl"
mkdir -p "$SSL" "$BASE/halalflicks-server" "$BASE/halalflicks-server/cache/flickcheck"
ENV_FILE="$BASE/halalflicks-server/.env"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

# Reuse Halalit / HalaLyrics Gemini key when HalalFlicks key is not set.
if ! grep -q "^HALALFLICKS_GEMINI_API_KEY=" "$ENV_FILE" 2>/dev/null; then
  LEGACY_KEY=""
  if [[ -f "$BASE/oddtrove-server/.env" ]]; then
    LEGACY_KEY="$(grep "^HALALIT_GEMINI_API_KEY=" "$BASE/oddtrove-server/.env" 2>/dev/null | head -1 | cut -d= -f2- || true)"
    if [[ -z "$LEGACY_KEY" ]]; then
      LEGACY_KEY="$(grep "^GEMINI_API_KEY=" "$BASE/oddtrove-server/.env" 2>/dev/null | head -1 | cut -d= -f2- || true)"
    fi
  fi
  if [[ -z "$LEGACY_KEY" && -f "$BASE/halalyrics-server/.env" ]]; then
    LEGACY_KEY="$(grep "^HALALYRICS_GEMINI_API_KEY=" "$BASE/halalyrics-server/.env" 2>/dev/null | head -1 | cut -d= -f2- || true)"
  fi
  if [[ -n "$LEGACY_KEY" ]]; then
    printf "\nHALALFLICKS_GEMINI_API_KEY=%s\n" "$LEGACY_KEY" >> "$ENV_FILE"
  fi
fi
if ! grep -q "^HALALFLICKS_GEMINI_MODEL=" "$ENV_FILE" 2>/dev/null; then
  printf "HALALFLICKS_GEMINI_MODEL=%s\n" "gemini-2.5-flash-lite" >> "$ENV_FILE"
fi

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

echo "Smoke test: import halalflicks_api before restart..."
if ! (cd "$BASE/halalflicks-server" && PYTHONPATH="$BASE/halalflicks-server" python3 -c "import halalflicks_api"); then
  echo "Error: halalflicks_api import failed — leaving existing processes running." >&2
  exit 1
fi

pkill -f "serve_static_https.py $HALALFLICKS_PORT " 2>/dev/null || true
sleep 0.2
nohup python3 "$PY" "$HALALFLICKS_PORT" "$BASE/halalflicks" "$KEY" "$CERT" "$BIND" \
  </dev/null >"/tmp/kids-site-${HALALFLICKS_PORT}.log" 2>&1 &
echo "Started HalalFlicks static on port $HALALFLICKS_PORT ($BIND)"

wd_name="halalflicks-api-${HALALFLICKS_API_PORT}"
wd_pidfile="$(kids_watchdog_pidfile "$wd_name")"
kids_stop_watchdog "$wd_name" "halalflicks-api.log 2>&1"
pkill -f "halalflicks_api.py" 2>/dev/null || true
sleep 0.2
nohup bash -c '
  echo $$ > "'"$wd_pidfile"'"
  while true; do
    if [[ -f "'"$BASE"'/halalflicks-server/.env" ]]; then
      set -a
      # shellcheck disable=SC1091
      source "'"$BASE"'/halalflicks-server/.env"
      set +a
    fi
    HALALFLICKS_VETTED_PATH="'"$BASE"'/halalflicks-server/config/hand_vetted.json" \
    HALALFLICKS_REC_CATALOG_PATH="'"$BASE"'/halalflicks-server/config/rec_catalog.json" \
    HALALFLICKS_API_PORT="'"$HALALFLICKS_API_PORT"'" \
    HALALFLICKS_API_BIND="'"$BIND"'" \
      python3 "'"$BASE"'/halalflicks-server/halalflicks_api.py" >>/tmp/halalflicks-api.log 2>&1
    echo "HalalFlicks API exited — restarting in 2s" >>/tmp/halalflicks-api.log
    sleep 2
  done
  rm -f "'"$wd_pidfile"'"
' </dev/null >/dev/null 2>&1 &
echo "Started HalalFlicks API on port $HALALFLICKS_API_PORT ($BIND)"

sleep 1
curl -sk -o /dev/null -w "HalalFlicks static port ${HALALFLICKS_PORT}: %{http_code}\n" \
  "https://127.0.0.1:${HALALFLICKS_PORT}/" || true
curl -s -o /dev/null -w "HalalFlicks API port ${HALALFLICKS_API_PORT}: %{http_code}\n" \
  "http://127.0.0.1:${HALALFLICKS_API_PORT}/api/health" || true
REMOTE

echo ""
echo "Done. HalalFlicks only — other sites were not restarted."
echo "After nginx reload: https://oddtrove.art/halalflicks/ (owner gate)"
echo ""
echo "Gemini: reuses Halalit/HalaLyrics key on server when HALALFLICKS_GEMINI_API_KEY is unset."

if [[ "${HALALFLICKS_SKIP_NGINX:-0}" != "1" ]]; then
  echo "Syncing nginx config for /halalflicks/ ..."
  rsync_cmd "$ROOT/top/nginx/oddtrove.art.conf" "$HOST:/etc/nginx/sites-available/oddtrove.art"
  ssh_cmd "$HOST" "nginx -t && systemctl reload nginx"
fi

echo "Nginx reloaded (set HALALFLICKS_SKIP_NGINX=1 to skip)."
