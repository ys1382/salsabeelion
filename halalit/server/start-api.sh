#!/bin/bash
# Halalit Bookcheck AI + accounts API (port 8075). Run on VPS only — see README-BOOKCHECK-AI.md on server.
cd "$(dirname "$0")"
set -a
if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
fi
set +a
export HALALIT_LOOKUP_LOG="${HALALIT_LOOKUP_LOG:-$(pwd)/lookup-log.jsonl}"
export HALALIT_ACCOUNTS_DB="${HALALIT_ACCOUNTS_DB:-$(pwd)/halalit_accounts.sqlite}"
export HALALIT_BOOKCHECK_API_BIND="${HALALIT_BOOKCHECK_API_BIND:-127.0.0.1}"
export HALALIT_BOOKCHECK_API_PORT="${HALALIT_BOOKCHECK_API_PORT:-8075}"
export HALALIT_GEMINI_MODEL="${HALALIT_GEMINI_MODEL:-gemini-2.5-flash}"
export HALALIT_ANTHROPIC_MODEL="${HALALIT_ANTHROPIC_MODEL:-claude-sonnet-4-6}"
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  _anthrop="$(dirname "$(pwd)")/anthropic.key"
  if [[ -f "$_anthrop" ]]; then
    export ANTHROPIC_API_KEY="$(tr -d '\n\r' < "$_anthrop")"
  fi
fi
export KIDS_SITES_ANTHROPIC_KEY_PATH="${KIDS_SITES_ANTHROPIC_KEY_PATH:-$(dirname "$(pwd)")/anthropic.key}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SHARED=""
for candidate in \
  "$(dirname "$HERE")/_shared" \
  "$(dirname "$(dirname "$HERE")")/top/_shared" \
  "$(dirname "$(dirname "$HERE")")/_shared"; do
  if [[ -d "$candidate" ]]; then
    SHARED="$(cd "$candidate" && pwd)"
    break
  fi
done
if [[ -n "$SHARED" ]]; then
  export PYTHONPATH="${SHARED}${PYTHONPATH:+:$PYTHONPATH}"
fi
# Review snippets: DuckDuckGo lite by default (no key). Optional Brave — set BRAVE_SEARCH_API_KEY in .env.
exec python3 bookcheck_theme_api.py
