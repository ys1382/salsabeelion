#!/usr/bin/env bash
# Push Anthropic API key to Odd Trove server and restart MO + LoreKeeper API.
# Key is never printed. Run from repo root in your own Terminal (not chat).
#
# Option A — env var (paste key only in Terminal):
#   ANTHROPIC_API_KEY='sk-ant-...' bash top/scripts/push-anthropic-key.sh
#
# Option B — file at repo root (gitignored if you add anthropic.key locally):
#   bash top/scripts/push-anthropic-key.sh
#
# Option C — secure prompt (no echo):
#   bash top/scripts/push-anthropic-key.sh --prompt
set -euo pipefail

HOST="${1:-root@157.230.130.12}"
REMOTE_BASE="${2:-kids-sites}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

MAESTROS_PORT="${MAESTROS_PORT:-8071}"
LOREKEEPER_API_PORT="${LOREKEEPER_API_PORT:-8080}"
BIND="${BIND:-127.0.0.1}"

load_key() {
  if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    printf '%s' "$ANTHROPIC_API_KEY"
    return 0
  fi
  local f
  for f in "$ROOT/anthropic.key" "$ROOT/maestrosOdyssey/anthropic.key"; do
    if [[ -f "$f" ]]; then
      tr -d '\n\r' < "$f"
      return 0
    fi
  done
  if [[ "${1:-}" == "--prompt" ]]; then
    local key
    read -r -s -p "Anthropic API key (hidden): " key
    echo ""
    if [[ -n "$key" ]]; then
      printf '%s' "$key"
      return 0
    fi
  fi
  return 1
}

KEY="$(load_key "${1:-}")" || {
  echo "No Anthropic key found."
  echo "Set ANTHROPIC_API_KEY, add anthropic.key at repo root, or run with --prompt."
  exit 1
}

tmp="$(mktemp)"
chmod 600 "$tmp"
printf '%s' "$KEY" > "$tmp"
unset KEY ANTHROPIC_API_KEY

ssh "$HOST" "mkdir -p ~/$REMOTE_BASE/ssl ~/$REMOTE_BASE/lorekeeper-data"
rsync -avz "$tmp" "$HOST:~/$REMOTE_BASE/anthropic.key"
rm -f "$tmp"
ssh "$HOST" "chmod 600 ~/$REMOTE_BASE/anthropic.key"

echo "Key saved on server. Restarting Maestro's + LoreKeeper API..."

ssh "$HOST" \
  REMOTE_BASE="$REMOTE_BASE" \
  MAESTROS_PORT="$MAESTROS_PORT" \
  LOREKEEPER_API_PORT="$LOREKEEPER_API_PORT" \
  BIND="$BIND" \
  'bash -s' << 'REMOTE'
set -euo pipefail
BASE="$HOME/$REMOTE_BASE"
SSL="$BASE/ssl"
KEY_PEM="$SSL/key.pem"
CERT="$SSL/cert.pem"
ANTHROPIC_KEY_FILE="$BASE/anthropic.key"
export ANTHROPIC_API_KEY="$(tr -d '\n\r' < "$ANTHROPIC_KEY_FILE")"

pkill -f "serve.py $MAESTROS_PORT " 2>/dev/null || true
pkill -f "lorekeeper_api.py" 2>/dev/null || true
sleep 0.5

nohup env \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  KIDS_SITES_BASE="$BASE" \
  KIDS_SITES_ANTHROPIC_KEY_PATH="$ANTHROPIC_KEY_FILE" \
  python3 "$BASE/serve.py" "$MAESTROS_PORT" "$KEY_PEM" "$CERT" "$BASE/maestros" "$BIND" \
  </dev/null >"/tmp/kids-site-${MAESTROS_PORT}.log" 2>&1 &

nohup bash -c '
  while true; do
    LOREKEEPER_DATA_PATH="'"$BASE"'/lorekeeper-data/lorekeeper-store.json" \
    LOREKEEPER_SECRET_PATH="'"$BASE"'/lorekeeper-data/lorekeeper.secret" \
    ODDTROVE_LOREKEEPER_OWNER_EMAIL="'"${ODDTROVE_LOREKEEPER_OWNER_EMAIL:-nightofhonour@gmail.com}"'" \
    LOREKEEPER_API_PORT="'"$LOREKEEPER_API_PORT"'" \
    LOREKEEPER_API_BIND="'"$BIND"'" \
    KIDS_SITES_BASE="'"$BASE"'" \
    ANTHROPIC_API_KEY="'"$ANTHROPIC_API_KEY"'" \
      python3 "'"$BASE"'/lorekeeper_api.py" >>/tmp/lorekeeper-api.log 2>&1
    echo "LoreKeeper API exited — restarting in 2s" >>/tmp/lorekeeper-api.log
    sleep 2
  done
' </dev/null >/dev/null 2>&1 &

sleep 1
python3 - <<PY
import json, os, sys, urllib.request
sys.path.insert(0, "$BASE")
os.environ["KIDS_SITES_BASE"] = "$BASE"
os.environ["ANTHROPIC_API_KEY"] = open("$ANTHROPIC_KEY_FILE", encoding="utf-8").read().strip()
from lorekeeper_rag import anthropic_api_key, rag_enabled
lk_ok = bool(anthropic_api_key()) and rag_enabled()
print("LoreKeeper RAG:", "ready" if lk_ok else "missing key")

req = urllib.request.Request(
    "https://127.0.0.1:$MAESTROS_PORT/api/evaluate",
    data=json.dumps({"target": "hola", "attempt": "hola", "stage": 1}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
ctx = __import__("ssl").create_default_context()
ctx.check_hostname = False
ctx.verify_mode = __import__("ssl").CERT_NONE
try:
    with urllib.request.urlopen(req, context=ctx, timeout=25) as r:
        body = json.loads(r.read().decode())
    mo_ok = "error" not in body
except Exception as exc:
    mo_ok = False
    body = {"error": str(exc)}
print("Maestro Claude API:", "ready" if mo_ok else body.get("error", "failed"))
PY
REMOTE

echo "Done."
