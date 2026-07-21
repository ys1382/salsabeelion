#!/usr/bin/env bash
# Deploy Habit Tree owner-beta — static only on port 8087.
# Reloads nginx unless HABIT_TREE_SKIP_NGINX=1.
# Does NOT restart Halalit or other kids sites.
#
# Usage:
#   bash top/scripts/deploy-habit-tree.sh [user@host] [remote_dir]
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

HABIT_TREE_PORT="${HABIT_TREE_PORT:-8087}"
BIND="${BIND:-127.0.0.1}"

ssh_cmd() {
  ssh "${SSH_OPTS[@]}" "$@"
}

rsync_cmd() {
  rsync -avz "$@"
}

if [[ ! -d "$ROOT/habitTree/www" ]]; then
  echo "Error: habitTree/www not found." >&2
  exit 1
fi

echo "Syncing Habit Tree to $HOST:~/$REMOTE_BASE/ ..."
ssh_cmd "$HOST" "mkdir -p ~/$REMOTE_BASE/ssl ~/$REMOTE_BASE/habit-tree"

rsync_cmd "$ROOT/top/_shared/serve_static_https.py" "$ROOT/top/_shared/kids-watchdog.sh" "$HOST:~/$REMOTE_BASE/"
rsync_cmd "$ROOT/habitTree/www/" "$HOST:~/$REMOTE_BASE/habit-tree/"

ssh_cmd "$HOST" \
  REMOTE_BASE="$REMOTE_BASE" \
  HABIT_TREE_PORT="$HABIT_TREE_PORT" \
  BIND="$BIND" \
  'bash -s' << 'REMOTE'
set -euo pipefail
BASE="$HOME/$REMOTE_BASE"
SSL="$BASE/ssl"
mkdir -p "$SSL" "$BASE/habit-tree"
if [[ ! -f "$SSL/key.pem" || ! -f "$SSL/cert.pem" ]]; then
  openssl req -x509 -newkey rsa:2048 \
    -keyout "$SSL/key.pem" -out "$SSL/cert.pem" \
    -days 825 -nodes \
    -subj "/CN=157.230.130.12" 2>/dev/null
fi
PY="$BASE/serve_static_https.py"
KEY="$SSL/key.pem"
CERT="$SSL/cert.pem"

pkill -f "serve_static_https.py $HABIT_TREE_PORT " 2>/dev/null || true
sleep 0.2
nohup python3 "$PY" "$HABIT_TREE_PORT" "$BASE/habit-tree" "$KEY" "$CERT" "$BIND" \
  </dev/null >"/tmp/kids-site-${HABIT_TREE_PORT}.log" 2>&1 &
echo "Started Habit Tree static on port $HABIT_TREE_PORT ($BIND)"

sleep 1
curl -sk -o /dev/null -w "Habit Tree static port ${HABIT_TREE_PORT}: %{http_code}\n" \
  "https://127.0.0.1:${HABIT_TREE_PORT}/" || true
REMOTE

echo ""
echo "Done. Habit Tree only — other sites were not restarted."
echo "After nginx reload: https://oddtrove.art/habit-tree/ (owner gate)"

if [[ "${HABIT_TREE_SKIP_NGINX:-0}" != "1" ]]; then
  echo "Syncing nginx config for /habit-tree/ ..."
  rsync_cmd "$ROOT/top/nginx/oddtrove.art.conf" "$HOST:/etc/nginx/sites-available/oddtrove.art"
  ssh_cmd "$HOST" "nginx -t && systemctl reload nginx"
  echo "Nginx reloaded."
else
  echo "Skipped nginx (HABIT_TREE_SKIP_NGINX=1)."
fi
