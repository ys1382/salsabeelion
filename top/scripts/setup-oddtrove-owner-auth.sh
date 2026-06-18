#!/usr/bin/env bash
# Create or rotate HTTP basic auth for owner-only oddtrove.art paths (/envdyst/, /climatic-mysteries/).
# Run on the VPS (or via ssh). Updates ODDTROVE-OWNER-ACCESS.local.md locally when run from repo root.
set -euo pipefail

HOST="${1:-root@157.230.130.12}"
HTPASSWD_PATH="/etc/nginx/oddtrove-owner.htpasswd"
USER_NAME="${ODDTROVE_OWNER_USERNAME:-SmokyInk11}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOCAL_ACCESS="$ROOT/ODDTROVE-OWNER-ACCESS.local.md"

gen_password() {
  openssl rand -base64 18 | tr -d '/+=' | head -c 24
}

if [[ "${ODDTROVE_ROTATE_AUTH:-}" == "1" ]] || [[ "${ODDTROVE_ROTATE_AUTH:-}" == "yes" ]]; then
  PASS="$(gen_password)"
else
  PASS="${ODDTROVE_OWNER_PASSWORD:-$(gen_password)}"
fi

echo "Updating $HTPASSWD_PATH on $HOST for user $USER_NAME ..."
HASH="$(ssh "$HOST" "openssl passwd -apr1 '$PASS'")"
ssh "$HOST" "printf '%s:%s\n' '$USER_NAME' '$HASH' | sudo tee '$HTPASSWD_PATH' > /dev/null && sudo chmod 640 '$HTPASSWD_PATH' && sudo chown root:www-data '$HTPASSWD_PATH' && sudo nginx -t && sudo systemctl reload nginx"

if [[ -f "$LOCAL_ACCESS" ]]; then
  if grep -q '^- Password:' "$LOCAL_ACCESS"; then
    sed -i.bak "s/^- Password:.*/- Password: \`$PASS\`/" "$LOCAL_ACCESS" && rm -f "$LOCAL_ACCESS.bak"
  fi
  echo "Updated password in $LOCAL_ACCESS"
fi

echo "Done. Owner login: $USER_NAME (browser prompt at https://oddtrove.art/climatic-mysteries/ etc.)"
