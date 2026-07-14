#!/usr/bin/env bash
# Deploy LoreKeeper only — restarts ports 8079 (static) and 8080 (API).
# Does NOT restart Halalit, hub, Crocheter, Maestro's, or envDyst.
#
# Usage:
#   bash top/scripts/deploy-lorekeeper.sh [user@host] [remote_dir]
#   bash top/scripts/deploy-lorekeeper.sh --lk-code-only [user@host] [remote_dir]
#
# --lk-code-only skips fonts/ rsync (faster when only .py or small JS changed).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

LK_CODE_ONLY=0
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --lk-code-only)
      LK_CODE_ONLY=1
      ;;
    *)
      POSITIONAL+=("$arg")
      ;;
  esac
done

HOST="${POSITIONAL[0]:-root@157.230.130.12}"
REMOTE_BASE="${POSITIONAL[1]:-kids-sites}"

SSH_OPTS=(
  -o ConnectTimeout=30
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=3
)
export RSYNC_RSH="ssh ${SSH_OPTS[*]}"

LOREKEEPER_PORT="${LOREKEEPER_PORT:-8079}"
LOREKEEPER_API_PORT="${LOREKEEPER_API_PORT:-8080}"
BIND="${BIND:-127.0.0.1}"

ssh_cmd() {
  ssh "${SSH_OPTS[@]}" "$@"
}

rsync_cmd() {
  rsync -avz "$@"
}

if [[ ! -d "$ROOT/lorekeeper/www" ]]; then
  echo "Error: lorekeeper/www not found in this checkout." >&2
  exit 1
fi

shopt -s nullglob
lk_py=( "$ROOT/lorekeeper"/lorekeeper_*.py )
if [[ ${#lk_py[@]} -eq 0 ]]; then
  echo "Error: no lorekeeper_*.py modules found." >&2
  exit 1
fi

if [[ "${LOREKEEPER_SKIP_TESTS:-0}" != "1" ]]; then
  if python3 -m pytest --version >/dev/null 2>&1; then
    echo "Running LoreKeeper tests (set LOREKEEPER_SKIP_TESTS=1 to skip)..."
    (cd "$ROOT" && python3 -m pytest lorekeeper/tests/ -q)
  else
    echo "Note: pytest not available locally — skipping LoreKeeper tests."
  fi
fi

if [[ ! -f "$ROOT/lorekeeper/www/vendor/quill/1.3.7/dist/quill.min.js" ]]; then
  echo "Vendoring LoreKeeper Quill editor (self-hosted)..."
  bash "$ROOT/lorekeeper/scripts/fetch-quill.sh"
fi
if [[ ! -f "$ROOT/lorekeeper/www/lk-fonts-hosted.css" ]] || [[ "${LOREKEEPER_FETCH_FONTS:-0}" == "1" ]]; then
  echo "Fetching LoreKeeper self-hosted fonts..."
  bash "$ROOT/lorekeeper/scripts/fetch-doc-fonts.sh"
fi

echo "Syncing LoreKeeper to $HOST:~/$REMOTE_BASE/ ..."
if [[ "$LK_CODE_ONLY" == "1" ]]; then
  echo "Mode: --lk-code-only (skipping fonts/ rsync)"
fi
ssh_cmd "$HOST" "mkdir -p ~/$REMOTE_BASE/ssl ~/$REMOTE_BASE/lorekeeper ~/$REMOTE_BASE/lorekeeper-data"

rsync_cmd "$ROOT/top/_shared/serve_static_https.py" "$ROOT/top/_shared/kids-watchdog.sh" "$HOST:~/$REMOTE_BASE/"
ssh_cmd "$HOST" "mkdir -p ~/$REMOTE_BASE/_shared"
rsync_cmd \
  "$ROOT/top/_shared/oddtrove_password_reset.py" \
  "$ROOT/top/_shared/oddtrove_transactional_mail.py" \
  "$HOST:~/$REMOTE_BASE/_shared/"
if [[ "$LK_CODE_ONLY" == "1" ]]; then
  rsync_cmd --exclude 'fonts/' "$ROOT/lorekeeper/www/" "$HOST:~/$REMOTE_BASE/lorekeeper/"
else
  rsync_cmd "$ROOT/lorekeeper/www/" "$HOST:~/$REMOTE_BASE/lorekeeper/"
fi
rsync_cmd "$ROOT/lorekeeper/scripts/" "$HOST:~/$REMOTE_BASE/lorekeeper/scripts/"
rsync_cmd "$ROOT/lorekeeper/STORAGE-BACKUP.md" "$HOST:~/$REMOTE_BASE/lorekeeper/"
rsync_cmd "${lk_py[@]}" "$HOST:~/$REMOTE_BASE/"

ANTHROPIC_KEY_LOCAL="$ROOT/anthropic.key"
if [[ -z "${ANTHROPIC_API_KEY:-}" && -f "$ANTHROPIC_KEY_LOCAL" ]]; then
  export ANTHROPIC_API_KEY="$(tr -d '\n\r' < "$ANTHROPIC_KEY_LOCAL")"
fi
if [[ -f "$ANTHROPIC_KEY_LOCAL" ]]; then
  rsync_cmd "$ANTHROPIC_KEY_LOCAL" "$HOST:~/$REMOTE_BASE/anthropic.key"
  ssh_cmd "$HOST" "chmod 600 ~/$REMOTE_BASE/anthropic.key"
  echo "Synced anthropic.key to server (contents not shown)."
elif [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  tmp_key="$(mktemp)"
  printf '%s' "$ANTHROPIC_API_KEY" > "$tmp_key"
  rsync_cmd "$tmp_key" "$HOST:~/$REMOTE_BASE/anthropic.key"
  rm -f "$tmp_key"
  ssh_cmd "$HOST" "chmod 600 ~/$REMOTE_BASE/anthropic.key"
  echo "Synced anthropic.key from ANTHROPIC_API_KEY (not shown)."
fi

echo "Import check + restart LoreKeeper backends only..."
ssh_cmd "$HOST" \
  REMOTE_BASE="$REMOTE_BASE" \
  LOREKEEPER_PORT="$LOREKEEPER_PORT" \
  LOREKEEPER_API_PORT="$LOREKEEPER_API_PORT" \
  BIND="$BIND" \
  'bash -s' << 'REMOTE'
set -euo pipefail
BASE="$HOME/$REMOTE_BASE"
SSL="$BASE/ssl"
mkdir -p "$SSL" "$BASE/lorekeeper-data"
if [[ ! -f "$SSL/key.pem" || ! -f "$SSL/cert.pem" ]]; then
  openssl req -x509 -newkey rsa:2048 \
    -keyout "$SSL/key.pem" -out "$SSL/cert.pem" \
    -days 825 -nodes \
    -subj "/CN=157.230.130.12" 2>/dev/null
fi
PY="$BASE/serve_static_https.py"
KEY="$SSL/key.pem"
CERT="$SSL/cert.pem"

ANTHROPIC_KEY_FILE="$BASE/anthropic.key"
if [[ -z "${ANTHROPIC_API_KEY:-}" && -f "$ANTHROPIC_KEY_FILE" ]]; then
  export ANTHROPIC_API_KEY="$(tr -d '\n\r' < "$ANTHROPIC_KEY_FILE")"
fi
# shellcheck source=/dev/null
source "$BASE/kids-watchdog.sh"

echo "Smoke test: import lorekeeper_api before restart..."
if ! (cd "$BASE" && PYTHONPATH="$BASE" python3 -c "import lorekeeper_api"); then
  echo "Error: lorekeeper_api import failed — leaving existing LoreKeeper processes running." >&2
  exit 1
fi

restart_static() {
  pkill -f "serve_static_https.py $LOREKEEPER_PORT " 2>/dev/null || true
  sleep 0.2
  nohup python3 "$PY" "$LOREKEEPER_PORT" "$BASE/lorekeeper" "$KEY" "$CERT" "$BIND" \
    </dev/null >"/tmp/kids-site-${LOREKEEPER_PORT}.log" 2>&1 &
  echo "Started lorekeeper static on port $LOREKEEPER_PORT ($BIND)"
}

restart_api() {
  local wd_name="lorekeeper-api-${LOREKEEPER_API_PORT}"
  local wd_pidfile
  wd_pidfile="$(kids_watchdog_pidfile "$wd_name")"
  kids_stop_watchdog "$wd_name" "lorekeeper-api.log 2>&1"
  pkill -f "lorekeeper_api.py" 2>/dev/null || true
  sleep 0.2
  nohup bash -c '
    echo $$ > "'"$wd_pidfile"'"
    while true; do
      LOREKEEPER_DATA_PATH="'"$BASE"'/lorekeeper-data/lorekeeper-store.json" \
      LOREKEEPER_SECRET_PATH="'"$BASE"'/lorekeeper-data/lorekeeper.secret" \
      ODDTROVE_LOREKEEPER_OWNER_EMAIL="'"${ODDTROVE_LOREKEEPER_OWNER_EMAIL:-nightofhonour@gmail.com}"'" \
      LOREKEEPER_API_PORT="'"$LOREKEEPER_API_PORT"'" \
      LOREKEEPER_API_BIND="'"$BIND"'" \
      KIDS_SITES_BASE="'"$BASE"'" \
      PYTHONPATH="'"$BASE"'/_shared" \
      ANTHROPIC_API_KEY="'"${ANTHROPIC_API_KEY:-}"'" \
        python3 "'"$BASE"'/lorekeeper_api.py" >>/tmp/lorekeeper-api.log 2>&1
      echo "LoreKeeper API exited — restarting in 2s" >>/tmp/lorekeeper-api.log
      sleep 2
    done
    rm -f "'"$wd_pidfile"'"
  ' </dev/null >/dev/null 2>&1 &
  echo "Started LoreKeeper API on port $LOREKEEPER_API_PORT ($BIND)"
}

restart_static
restart_api

if [[ -x "$BASE/lorekeeper/scripts/backup-lorekeeper-store.sh" ]]; then
  LOREKEEPER_BASE="$BASE" bash "$BASE/lorekeeper/scripts/backup-lorekeeper-store.sh" || true
fi
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "LoreKeeper RAG: Anthropic key loaded"
else
  echo "Note: LoreKeeper RAG disabled — set ANTHROPIC_API_KEY or $ANTHROPIC_KEY_FILE on server"
  echo "      (or LOREKEEPER_RAG=0 in the API env to silence Ask RAG attempts)"
fi

sleep 1
curl -sk -o /dev/null -w "LoreKeeper static port ${LOREKEEPER_PORT}: %{http_code}\n" \
  "https://127.0.0.1:${LOREKEEPER_PORT}/" || true
api_code="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${LOREKEEPER_API_PORT}/api/auth/me" || echo "000")"
echo "LoreKeeper API port ${LOREKEEPER_API_PORT}: ${api_code}"
if [[ "$api_code" != "200" && "$api_code" != "401" ]]; then
  echo "Warning: LoreKeeper API health check returned ${api_code} — see /tmp/lorekeeper-api.log" >&2
fi
REMOTE

echo ""
echo "Done. LoreKeeper only — Halalit and other sites were not restarted."
echo "LoreKeeper: https://oddtrove.art/lorekeeper/ (owner gate)"
