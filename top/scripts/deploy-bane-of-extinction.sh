#!/usr/bin/env bash
# Deploy Bane of Extinction owner-beta static only — port 8085.
# Also syncs hub index.html. Reloads nginx unless BANE_SKIP_NGINX=1.
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

echo "Syncing Bane of Extinction to $HOST:~/$REMOTE_BASE/ ..."
ssh_cmd "$HOST" "mkdir -p ~/$REMOTE_BASE/ssl ~/$REMOTE_BASE/bane-of-extinction ~/$REMOTE_BASE/hub"

rsync_cmd "$ROOT/top/_shared/serve_static_https.py" "$HOST:~/$REMOTE_BASE/"
rsync_cmd "$ROOT/baneOfExtinction/www/" "$HOST:~/$REMOTE_BASE/bane-of-extinction/"
rsync_cmd "$ROOT/top/directory/www/index.html" "$HOST:~/$REMOTE_BASE/hub/index.html"

ssh_cmd "$HOST" \
  REMOTE_BASE="$REMOTE_BASE" \
  BANE_PORT="$BANE_PORT" \
  BIND="$BIND" \
  'bash -s' << 'REMOTE'
set -euo pipefail
BASE="$HOME/$REMOTE_BASE"
SSL="$BASE/ssl"
mkdir -p "$SSL" "$BASE/bane-of-extinction"
if [[ ! -f "$SSL/key.pem" || ! -f "$SSL/cert.pem" ]]; then
  openssl req -x509 -newkey rsa:2048 \
    -keyout "$SSL/key.pem" -out "$SSL/cert.pem" \
    -days 825 -nodes \
    -subj "/CN=157.230.130.12" 2>/dev/null
fi
PY="$BASE/serve_static_https.py"
KEY="$SSL/key.pem"
CERT="$SSL/cert.pem"

pkill -f "serve_static_https.py $BANE_PORT " 2>/dev/null || true
sleep 0.2
nohup python3 "$PY" "$BANE_PORT" "$BASE/bane-of-extinction" "$KEY" "$CERT" "$BIND" \
  </dev/null >"/tmp/kids-site-${BANE_PORT}.log" 2>&1 &
echo "Started Bane of Extinction static on port $BANE_PORT ($BIND)"

sleep 1
curl -sk -o /dev/null -w "Bane static port ${BANE_PORT}: %{http_code}\n" \
  "https://127.0.0.1:${BANE_PORT}/" || true
REMOTE

echo ""
echo "Done. Bane of Extinction only — other sites were not restarted."
echo "After nginx reload: https://oddtrove.art/bane-of-extinction/ (owner gate)"

if [[ "${BANE_SKIP_NGINX:-0}" != "1" ]]; then
  echo "Syncing nginx config for /bane-of-extinction/ ..."
  rsync_cmd "$ROOT/top/nginx/oddtrove.art.conf" "$HOST:/etc/nginx/sites-available/oddtrove.art"
  ssh_cmd "$HOST" "nginx -t && systemctl reload nginx"
  echo "Nginx reloaded."
else
  echo "Skipped nginx (BANE_SKIP_NGINX=1)."
fi
