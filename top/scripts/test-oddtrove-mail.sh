#!/usr/bin/env bash
# Send one test password-reset email using server .env mail settings.
# Usage (on VPS): bash test-oddtrove-mail.sh you@example.com
set -euo pipefail

TO="${1:-}"
if [[ -z "$TO" ]]; then
  echo "Usage: $0 recipient@example.com"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SHARED="$ROOT/top/_shared"
if [[ -d "$(dirname "$ROOT")/kids-sites/_shared" ]]; then
  SHARED="$(dirname "$ROOT")/kids-sites/_shared"
fi

ENV_FILE="${ODDTROVE_MAIL_ENV:-$ROOT/halalit/server/.env}"
if [[ -f /root/kids-sites/oddtrove-server/.env ]]; then
  ENV_FILE="/root/kids-sites/oddtrove-server/.env"
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export PYTHONPATH="${SHARED}${PYTHONPATH:+:$PYTHONPATH}"
python3 - <<PY
from oddtrove_transactional_mail import mail_configured, send_password_reset

if not mail_configured():
    raise SystemExit("Mail not configured — set ODDTROVE_SMTP_* or ODDTROVE_RESEND_API_KEY in .env")

ok = send_password_reset(
    to_email="${TO}",
    reset_url="https://oddtrove.art/halalit/reset-password.html?token=test-only",
    site_name="Odd Trove test",
)
raise SystemExit(0 if ok else 1)
PY

echo "Test mail sent to ${TO}"
