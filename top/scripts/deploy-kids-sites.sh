#!/usr/bin/env bash
# Deploy directory hub + maestrosOdyssey + envDyst + crocheter static sites to
# root@157.230.130.12 with HTTPS (self-signed) per port.
#
# Usage:
#   bash top/scripts/deploy-kids-sites.sh [user@host] [remote_dir]
#   bash top/scripts/deploy-kids-sites.sh --site=halalit [user@host] [remote_dir]
#
# Sites: hub, maestros, envdyst, crocheter, halalit, rpg, lorekeeper, all (default).
# LoreKeeper-only deploy: use top/scripts/deploy-lorekeeper.sh (does not restart Halalit).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SITE="all"
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --site=*)
      SITE="${arg#--site=}"
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

ssh_cmd() {
  ssh "${SSH_OPTS[@]}" "$@"
}

if [[ "$SITE" == "lorekeeper" ]]; then
  exec "$SCRIPT_DIR/deploy-lorekeeper.sh" "$HOST" "$REMOTE_BASE"
fi

site_enabled() {
  [[ "$SITE" == "all" || "$SITE" == "$1" ]]
}

HUB_PORT="${HUB_PORT:-8070}"
MAESTROS_PORT="${MAESTROS_PORT:-8071}"
ENVDYST_PORT="${ENVDYST_PORT:-8072}"
CROCHETER_PORT="${CROCHETER_PORT:-8073}"
HALALIT_PORT="${HALALIT_PORT:-8074}"
RPG_PORT="${RPG_PORT:-8078}"
HUB_OWNER_API_PORT="${HUB_OWNER_API_PORT:-8077}"
LOREKEEPER_PORT="${LOREKEEPER_PORT:-8079}"
LOREKEEPER_API_PORT="${LOREKEEPER_API_PORT:-8080}"
BIND="${BIND:-127.0.0.1}"
RPG_BIND="${RPG_BIND:-0.0.0.0}"

echo "Deploy site filter: $SITE"
echo "Syncing static sites to $HOST:~/$REMOTE_BASE/ ..."
ssh_cmd "$HOST" "mkdir -p ~/$REMOTE_BASE/ssl ~/$REMOTE_BASE/hub ~/$REMOTE_BASE/maestros ~/$REMOTE_BASE/envdyst ~/$REMOTE_BASE/crocheter ~/$REMOTE_BASE/halalit ~/$REMOTE_BASE/rpg ~/$REMOTE_BASE/lorekeeper ~/$REMOTE_BASE/lorekeeper-data"

needs_static_py=false
for s in hub maestros envdyst crocheter halalit rpg lorekeeper; do
  if site_enabled "$s"; then needs_static_py=true; fi
done
if [[ "$needs_static_py" == true ]]; then
  rsync -avz "$ROOT/top/_shared/serve_static_https.py" "$ROOT/top/_shared/kids-watchdog.sh" "$HOST:~/$REMOTE_BASE/"
fi
if site_enabled halalit || site_enabled crocheter || site_enabled lorekeeper || site_enabled all; then
  ssh_cmd "$HOST" "mkdir -p ~/$REMOTE_BASE/_shared"
  rsync -avz \
    "$ROOT/top/_shared/oddtrove_password_reset.py" \
    "$ROOT/top/_shared/oddtrove_transactional_mail.py" \
    "$ROOT/top/_shared/oddtrove_google_oauth.py" \
    "$ROOT/top/_shared/oddtrove_sso.py" \
    "$HOST:~/$REMOTE_BASE/_shared/"
fi
if site_enabled hub || site_enabled all; then
  ssh_cmd "$HOST" "mkdir -p ~/$REMOTE_BASE/_shared"
  rsync -avz "$ROOT/top/_shared/hub_owner_api.py" "$HOST:~/$REMOTE_BASE/"
  rsync -avz "$ROOT/top/_shared/oddtrove_sso.py" "$ROOT/top/_shared/oddtrove_google_oauth.py" "$HOST:~/$REMOTE_BASE/_shared/"
fi
if site_enabled maestros || site_enabled all; then
  rsync -avz "$ROOT/maestrosOdyssey/serve.py" "$HOST:~/$REMOTE_BASE/"
fi
if site_enabled hub; then
  rsync -avz "$ROOT/top/directory/www/" "$HOST:~/$REMOTE_BASE/hub/"
fi
if site_enabled maestros; then
  echo "Running Maestro's pre-deploy verify..."
  bash "$ROOT/maestrosOdyssey/scripts/verify-maestros.sh"
  if [[ ! -f "$ROOT/maestrosOdyssey/www/vendor/phaser/3.60.0/dist/phaser.min.js" ]]; then
    echo "Vendoring Maestro's Phaser (self-hosted)..."
    bash "$ROOT/maestrosOdyssey/scripts/fetch-phaser.sh"
  fi
  rsync -avz "$ROOT/maestrosOdyssey/www/" "$HOST:~/$REMOTE_BASE/maestros/"
fi
if site_enabled envdyst; then
  rsync -avz "$ROOT/envDyst/www/" "$HOST:~/$REMOTE_BASE/envdyst/"
fi
if site_enabled lorekeeper || site_enabled all; then
  if [[ -d "$ROOT/lorekeeper/www" ]]; then
    if [[ ! -f "$ROOT/lorekeeper/www/vendor/quill/1.3.7/dist/quill.min.js" ]]; then
      echo "Vendoring LoreKeeper Quill editor (self-hosted)..."
      bash "$ROOT/lorekeeper/scripts/fetch-quill.sh"
    fi
    if [[ ! -f "$ROOT/lorekeeper/www/lk-fonts-hosted.css" ]] || [[ "${LOREKEEPER_FETCH_FONTS:-0}" == "1" ]]; then
      echo "Fetching LoreKeeper self-hosted fonts..."
      bash "$ROOT/lorekeeper/scripts/fetch-doc-fonts.sh"
    fi
    rsync -avz "$ROOT/lorekeeper/www/" "$HOST:~/$REMOTE_BASE/lorekeeper/"
    rsync -avz "$ROOT/lorekeeper/scripts/" "$HOST:~/$REMOTE_BASE/lorekeeper/scripts/"
    rsync -avz "$ROOT/lorekeeper/STORAGE-BACKUP.md" "$HOST:~/$REMOTE_BASE/lorekeeper/"
    shopt -s nullglob
    lk_py=( "$ROOT/lorekeeper"/lorekeeper_*.py )
    if [[ ${#lk_py[@]} -gt 0 ]]; then
      rsync -avz "${lk_py[@]}" "$HOST:~/$REMOTE_BASE/"
    fi
  fi
fi
if site_enabled crocheter; then
  rsync -avz "$ROOT/crocheter/www/" "$HOST:~/$REMOTE_BASE/crocheter/"
  ssh_cmd "$HOST" "mkdir -p ~/$REMOTE_BASE/crocheter-data"
  shopt -s nullglob
  cr_py=( "$ROOT/crocheter"/crocheter_*.py )
  if [[ ${#cr_py[@]} -gt 0 ]]; then
    rsync -avz "${cr_py[@]}" "$HOST:~/$REMOTE_BASE/"
  fi
fi
if site_enabled halalit; then
  if [[ -d "$ROOT/halalit/www" ]]; then
    rsync -avz "$ROOT/halalit/www/" "$HOST:~/$REMOTE_BASE/halalit/"
  else
    echo "Note: halalit/www not in this checkout — leaving existing halalit files on server."
  fi
  if [[ -d "$ROOT/halalit/server" ]]; then
    ssh_cmd "$HOST" "mkdir -p ~/$REMOTE_BASE/oddtrove-server"
    rsync -avz \
      --exclude '.env' \
      --exclude 'halalit_accounts.sqlite' \
      --exclude '*.local.sqlite' \
      --exclude 'lookup-log.jsonl' \
      --exclude '__pycache__' \
      "$ROOT/halalit/server/" "$HOST:~/$REMOTE_BASE/oddtrove-server/"
  fi
fi
if site_enabled rpg; then
  if [[ -d "$ROOT/rpg/www" ]]; then
    rsync -avz "$ROOT/rpg/www/" "$HOST:~/$REMOTE_BASE/rpg/"
  fi
fi

ANTHROPIC_KEY_LOCAL="$ROOT/anthropic.key"
if site_enabled maestros || site_enabled lorekeeper || site_enabled crocheter || site_enabled all; then
  if [[ -z "${ANTHROPIC_API_KEY:-}" && -f "$ANTHROPIC_KEY_LOCAL" ]]; then
    export ANTHROPIC_API_KEY="$(tr -d '\n\r' < "$ANTHROPIC_KEY_LOCAL")"
  fi
  if [[ -f "$ANTHROPIC_KEY_LOCAL" ]]; then
    rsync -avz "$ANTHROPIC_KEY_LOCAL" "$HOST:~/$REMOTE_BASE/anthropic.key"
    ssh_cmd "$HOST" "chmod 600 ~/$REMOTE_BASE/anthropic.key"
    echo "Synced anthropic.key to server (contents not shown)."
  elif [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    tmp_key="$(mktemp)"
    printf '%s' "$ANTHROPIC_API_KEY" > "$tmp_key"
    rsync -avz "$tmp_key" "$HOST:~/$REMOTE_BASE/anthropic.key"
    rm -f "$tmp_key"
    ssh_cmd "$HOST" "chmod 600 ~/$REMOTE_BASE/anthropic.key"
    echo "Synced anthropic.key from ANTHROPIC_API_KEY (not shown)."
  fi
fi

echo "Installing TLS certs (if missing) and restarting backends (rolling, one site at a time)..."
ssh_cmd "$HOST" \
  REMOTE_BASE="$REMOTE_BASE" \
  SITE="$SITE" \
  HUB_PORT="$HUB_PORT" \
  MAESTROS_PORT="$MAESTROS_PORT" \
  ENVDYST_PORT="$ENVDYST_PORT" \
  CROCHETER_PORT="$CROCHETER_PORT" \
  CROCHETER_API_PORT="${CROCHETER_API_PORT:-8076}" \
  HALALIT_PORT="${HALALIT_PORT}" \
  RPG_PORT="$RPG_PORT" \
  LOREKEEPER_PORT="$LOREKEEPER_PORT" \
  LOREKEEPER_API_PORT="$LOREKEEPER_API_PORT" \
  HUB_OWNER_API_PORT="$HUB_OWNER_API_PORT" \
  CROCHETER_API_PORT="${CROCHETER_API_PORT:-8076}" \
  ODDTROVE_CROCHETER_OWNER_EMAIL="${ODDTROVE_CROCHETER_OWNER_EMAIL:-nightofhonour@gmail.com}" \
  BIND="$BIND" \
  RPG_BIND="$RPG_BIND" \
  'bash -s' << 'REMOTE'
set -euo pipefail
BASE="$HOME/$REMOTE_BASE"
SSL="$BASE/ssl"
SITE="${SITE:-all}"
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

site_enabled() {
  [[ "$SITE" == "all" || "$SITE" == "$1" ]]
}

ANTHROPIC_KEY_FILE="$BASE/anthropic.key"
if [[ -z "${ANTHROPIC_API_KEY:-}" && -f "$ANTHROPIC_KEY_FILE" ]]; then
  export ANTHROPIC_API_KEY="$(tr -d '\n\r' < "$ANTHROPIC_KEY_FILE")"
fi
# Google OAuth + shared SSO secret (shared .env on Halalit server)
if [[ -f "$BASE/oddtrove-server/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^ODDTROVE_(GOOGLE_(CLIENT_ID|CLIENT_SECRET|STATE_SECRET)|SSO_SECRET)=' "$BASE/oddtrove-server/.env" || true)
  set +a
fi
# shellcheck source=/dev/null
source "$BASE/kids-watchdog.sh"

restart_static_port() {
  local port="$1" dir="$2" name="$3"
  local bind="${4:-$BIND}"
  pkill -f "serve_static_https.py $port " 2>/dev/null || true
  sleep 0.15
  nohup python3 "$PY" "$port" "$dir" "$KEY" "$CERT" "$bind" \
    </dev/null >"/tmp/kids-site-${port}.log" 2>&1 &
  echo "Started $name on port $port ($bind)"
}

start_maestros() {
  local wd_name="maestros-${MAESTROS_PORT}"
  local wd_pidfile
  wd_pidfile="$(kids_watchdog_pidfile "$wd_name")"
  kids_stop_watchdog "$wd_name" "kids-site-${MAESTROS_PORT}.log 2>&1"
  pkill -f "serve.py $MAESTROS_PORT " 2>/dev/null || true
  sleep 0.15
  nohup bash -c '
    echo $$ > "'"$wd_pidfile"'"
    while true; do
      ANTHROPIC_API_KEY="'"${ANTHROPIC_API_KEY:-}"'" \
      KIDS_SITES_BASE="'"$BASE"'" \
      KIDS_SITES_ANTHROPIC_KEY_PATH="'"$ANTHROPIC_KEY_FILE"'" \
        python3 "'"$BASE"'/serve.py" "'"$MAESTROS_PORT"'" "'"$KEY"'" "'"$CERT"'" "'"$BASE"'/maestros" "'"$BIND"'" \
        >>/tmp/kids-site-'"$MAESTROS_PORT"'.log 2>&1
      echo "Maestro serve.py exited — restarting in 2s" >>/tmp/kids-site-'"$MAESTROS_PORT"'.log
      sleep 2
    done
    rm -f "'"$wd_pidfile"'"
  ' </dev/null >/dev/null 2>&1 &
  echo "Started maestrosOdyssey (serve.py) on port $MAESTROS_PORT ($BIND)"
  if [[ -n "${ANTHROPIC_API_KEY:-}" ]] || [[ -f "$ANTHROPIC_KEY_FILE" ]]; then
    echo "Maestro Claude API: Anthropic key loaded"
  else
    echo "Note: Maestro Claude API disabled — set ANTHROPIC_API_KEY or $ANTHROPIC_KEY_FILE"
  fi
}

start_lorekeeper_api() {
  echo "Smoke test: import lorekeeper_api before restart..."
  if ! (cd "$BASE" && PYTHONPATH="$BASE" python3 -c "import lorekeeper_api"); then
    echo "Error: lorekeeper_api import failed — leaving existing LoreKeeper API running." >&2
    return 1
  fi
  local wd_name="lorekeeper-api-${LOREKEEPER_API_PORT}"
  local wd_pidfile
  wd_pidfile="$(kids_watchdog_pidfile "$wd_name")"
  kids_stop_watchdog "$wd_name" "lorekeeper-api.log 2>&1"
  pkill -f "lorekeeper_api.py" 2>/dev/null || true
  sleep 0.15
  mkdir -p "$BASE/lorekeeper-data"
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
      ODDTROVE_GOOGLE_CLIENT_ID="'"${ODDTROVE_GOOGLE_CLIENT_ID:-}"'" \
      ODDTROVE_GOOGLE_CLIENT_SECRET="'"${ODDTROVE_GOOGLE_CLIENT_SECRET:-}"'" \
      ODDTROVE_GOOGLE_STATE_SECRET="'"${ODDTROVE_GOOGLE_STATE_SECRET:-}"'" \
      ODDTROVE_SSO_SECRET="'"${ODDTROVE_SSO_SECRET:-}"'" \
        python3 "'"$BASE"'/lorekeeper_api.py" >>/tmp/lorekeeper-api.log 2>&1
      echo "LoreKeeper API exited — restarting in 2s" >>/tmp/lorekeeper-api.log
      sleep 2
    done
    rm -f "'"$wd_pidfile"'"
  ' </dev/null >/dev/null 2>&1 &
  echo "Started LoreKeeper API on port $LOREKEEPER_API_PORT ($BIND)"
  if [[ -x "$BASE/lorekeeper/scripts/backup-lorekeeper-store.sh" ]]; then
    LOREKEEPER_BASE="$BASE" bash "$BASE/lorekeeper/scripts/backup-lorekeeper-store.sh" || true
    bash "$BASE/lorekeeper/scripts/install-backup-cron.sh" 2>/dev/null || true
  fi
  if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    echo "LoreKeeper RAG: Anthropic key loaded (same ANTHROPIC_API_KEY as Maestro's Odyssey)"
  else
    echo "Note: LoreKeeper RAG disabled — set ANTHROPIC_API_KEY or $ANTHROPIC_KEY_FILE on server"
  fi
}

start_halalit_api() {
  if [[ ! -d "$BASE/oddtrove-server" || ! -f "$BASE/oddtrove-server/start-api.sh" ]]; then
    return 0
  fi
  local wd_name="halalit-bookcheck-api"
  local wd_pidfile
  wd_pidfile="$(kids_watchdog_pidfile "$wd_name")"
  kids_stop_watchdog "$wd_name" "kids-site-ai-8075.log 2>&1"
  pkill -f "bookcheck_theme_api.py" 2>/dev/null || true
  sleep 0.15
  chmod +x "$BASE/oddtrove-server/start-api.sh"
  if [[ -f /root/halalit/.env ]] && ! grep -q "^HALALIT_GEMINI_API_KEY=" "$BASE/oddtrove-server/.env" 2>/dev/null; then
    LEGACY_KEY="$(grep "^GEMINI_API_KEY=" /root/halalit/.env 2>/dev/null | head -1 | cut -d= -f2- || true)"
    if [[ -n "$LEGACY_KEY" ]]; then
      printf "\nHALALIT_GEMINI_API_KEY=%s\n" "$LEGACY_KEY" >> "$BASE/oddtrove-server/.env"
    fi
  fi
  if ! grep -q "^HALALIT_GEMINI_MODEL=" "$BASE/oddtrove-server/.env" 2>/dev/null; then
    printf "HALALIT_GEMINI_MODEL=gemini-2.5-flash\n" >> "$BASE/oddtrove-server/.env"
  fi
  nohup bash -c '
    echo $$ > "'"$wd_pidfile"'"
    while true; do
      ANTHROPIC_API_KEY="'"${ANTHROPIC_API_KEY:-}"'" \
      KIDS_SITES_ANTHROPIC_KEY_PATH="'"$ANTHROPIC_KEY_FILE"'" \
      HALALIT_ANTHROPIC_MODEL="'"${HALALIT_ANTHROPIC_MODEL:-claude-sonnet-4-6}"'" \
      BRAVE_SEARCH_API_KEY="'"${BRAVE_SEARCH_API_KEY:-}"'" \
      "'"$BASE"'/oddtrove-server/start-api.sh" >>/tmp/kids-site-ai-8075.log 2>&1
      echo "Halalit Bookcheck API exited — restarting in 2s" >>/tmp/kids-site-ai-8075.log
      sleep 2
    done
    rm -f "'"$wd_pidfile"'"
  ' </dev/null >/dev/null 2>&1 &
  echo "Started Halalit Bookcheck API on port ${HALALIT_BOOKCHECK_API_PORT:-8075} ($BIND)"
  if [[ -n "${ANTHROPIC_API_KEY:-}" ]] || [[ -f "$ANTHROPIC_KEY_FILE" ]]; then
    echo "Halalit Bookcheck: Claude + Gemini dual theme scan (Anthropic key loaded)"
  else
    echo "Note: Halalit Bookcheck Claude disabled — Gemini only until anthropic.key is on server"
  fi
  echo "Halalit Bookcheck review search: DuckDuckGo lite (no key). Optional BRAVE_SEARCH_API_KEY in oddtrove-server/.env."
}

start_crocheter_api() {
  if [[ ! -f "$BASE/crocheter_api.py" ]]; then
    return 0
  fi
  local port="${CROCHETER_API_PORT:-8076}"
  local wd_name="crocheter-api"
  local wd_pidfile
  wd_pidfile="$(kids_watchdog_pidfile "$wd_name")"
  kids_stop_watchdog "$wd_name" "crocheter-api.log 2>&1"
  pkill -f "crocheter_api.py" 2>/dev/null || true
  sleep 0.15
  mkdir -p "$BASE/crocheter-data"
  nohup bash -c '
    echo $$ > "'"$wd_pidfile"'"
    while true; do
      CROCHETER_DATA_PATH="'"$BASE"'/crocheter-data/crocheter-store.json" \
      CROCHETER_SECRET_PATH="'"$BASE"'/crocheter-data/crocheter.secret" \
      CROCHETER_API_PORT="'"$port"'" \
      CROCHETER_API_BIND="'"$BIND"'" \
      KIDS_SITES_BASE="'"$BASE"'" \
      PYTHONPATH="'"$BASE"'/_shared" \
      ANTHROPIC_API_KEY="'"${ANTHROPIC_API_KEY:-}"'" \
      ODDTROVE_CROCHETER_OWNER_EMAIL="'"${ODDTROVE_CROCHETER_OWNER_EMAIL:-nightofhonour@gmail.com}"'" \
      ODDTROVE_GOOGLE_CLIENT_ID="'"${ODDTROVE_GOOGLE_CLIENT_ID:-}"'" \
      ODDTROVE_GOOGLE_CLIENT_SECRET="'"${ODDTROVE_GOOGLE_CLIENT_SECRET:-}"'" \
      ODDTROVE_GOOGLE_STATE_SECRET="'"${ODDTROVE_GOOGLE_STATE_SECRET:-}"'" \
      ODDTROVE_SSO_SECRET="'"${ODDTROVE_SSO_SECRET:-}"'" \
        python3 "'"$BASE"'/crocheter_api.py" >>/tmp/crocheter-api.log 2>&1
      echo "Crocheter API exited — restarting in 2s" >>/tmp/crocheter-api.log
      sleep 2
    done
    rm -f "'"$wd_pidfile"'"
  ' </dev/null >/dev/null 2>&1 &
  echo "Started Crocheter API on port $port ($BIND)"
  if [[ -n "${ANTHROPIC_API_KEY:-}" ]] || [[ -f "$ANTHROPIC_KEY_FILE" ]]; then
    echo "Crocheter Ask: Anthropic key loaded"
  else
    echo "Note: Crocheter Ask disabled — set ANTHROPIC_API_KEY or $ANTHROPIC_KEY_FILE on server"
  fi
}

if site_enabled hub; then
  restart_static_port "$HUB_PORT" "$BASE/hub" "hub"
fi
if site_enabled maestros; then
  start_maestros
fi
if site_enabled envdyst; then
  restart_static_port "$ENVDYST_PORT" "$BASE/envdyst" "envDyst"
fi
if site_enabled crocheter; then
  restart_static_port "$CROCHETER_PORT" "$BASE/crocheter" "crocheter"
  start_crocheter_api || true
fi
if site_enabled halalit; then
  restart_static_port "$HALALIT_PORT" "$BASE/halalit" "halalit"
  start_halalit_api
fi
if site_enabled rpg; then
  if [[ -d "$BASE/rpg" ]]; then
    restart_static_port "$RPG_PORT" "$BASE/rpg" "rpg" "$RPG_BIND"
  fi
fi
if site_enabled lorekeeper || site_enabled all; then
  if [[ -d "$BASE/lorekeeper" ]]; then
    restart_static_port "$LOREKEEPER_PORT" "$BASE/lorekeeper" "lorekeeper"
    start_lorekeeper_api || true
  fi
fi
if site_enabled hub || site_enabled all; then
  pkill -f "hub_owner_api.py" 2>/dev/null || true
  sleep 0.15
  ODDTROVE_GOOGLE_CLIENT_ID="${ODDTROVE_GOOGLE_CLIENT_ID:-}" \
  ODDTROVE_GOOGLE_CLIENT_SECRET="${ODDTROVE_GOOGLE_CLIENT_SECRET:-}" \
  ODDTROVE_GOOGLE_STATE_SECRET="${ODDTROVE_GOOGLE_STATE_SECRET:-}" \
  ODDTROVE_SSO_SECRET="${ODDTROVE_SSO_SECRET:-}" \
  PYTHONPATH="$BASE/_shared" \
    nohup python3 "$BASE/hub_owner_api.py" </dev/null >"/tmp/hub-owner-api.log" 2>&1 &
  echo "Started hub API (owner + Google SSO) on port $HUB_OWNER_API_PORT ($BIND)"
  if [[ -n "${ODDTROVE_GOOGLE_CLIENT_ID:-}" ]]; then
    echo "Google SSO: client id loaded"
  else
    echo "Note: Google SSO not configured — set ODDTROVE_GOOGLE_CLIENT_ID/SECRET in oddtrove-server/.env"
  fi
fi

sleep 1
for port in "$HUB_PORT" "$MAESTROS_PORT" "$ENVDYST_PORT" "$CROCHETER_PORT" "$HALALIT_PORT" "$RPG_PORT" "$LOREKEEPER_PORT"; do
  curl -sk -o /dev/null -w "port ${port}: %{http_code}\n" "https://127.0.0.1:${port}/" || true
done
curl -s -o /dev/null -w "LoreKeeper API port ${LOREKEEPER_API_PORT}: %{http_code}\n" "http://127.0.0.1:${LOREKEEPER_API_PORT}/api/auth/me" || true
curl -s -o /dev/null -w "Halalit Bookcheck API port ${HALALIT_BOOKCHECK_API_PORT:-8075}: %{http_code}\n" "http://127.0.0.1:${HALALIT_BOOKCHECK_API_PORT:-8075}/api/health" || true
curl -s -o /dev/null -w "Crocheter API port ${CROCHETER_API_PORT:-8076}: %{http_code}\n" "http://127.0.0.1:${CROCHETER_API_PORT:-8076}/api/health" || true
REMOTE

echo ""
echo "Done. Open https://157.230.130.12:${HUB_PORT}/ for the directory page."
echo "Maestro's Odyssey: https://157.230.130.12:${MAESTROS_PORT}/"
echo "envDyst:          https://157.230.130.12:${ENVDYST_PORT}/"
echo "Pixel Farm RPG:   https://157.230.130.12:${RPG_PORT}/"
echo "Halalit (public):  https://oddtrove.art/halalit/"
echo "LoreKeeper:       https://oddtrove.art/lorekeeper/ (public beta; account sign-in) — use deploy-lorekeeper.sh for LK-only"
echo "crocheter:        https://oddtrove.art/crocheter/"
