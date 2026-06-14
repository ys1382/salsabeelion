#!/bin/bash
# Double‑click in Finder → local server + browser.
# Finder’s PATH usually omits Homebrew’s python3 — we probe common paths.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
WWW="$HERE/www"
LOG="/tmp/crocheter-server-$$.log"

if [[ ! -d "$WWW" ]]; then
  osascript -e 'display alert "Crocheter: missing www folder" message "Expected crocheter/www next to this file."'
  exit 1
fi

pick_python() {
  local c p
  for c in "${HOME}/.pyenv/shims/python3" "${HOME}/.local/bin/python3" "/opt/homebrew/bin/python3" "/usr/local/bin/python3" "/usr/bin/python3"; do
    if [[ -x "$c" ]] && "$c" -c "import sys; sys.exit(0 if sys.version_info >= (3, 6) else 1)" 2>/dev/null; then
      echo "$c"
      return 0
    fi
  done
  p="$(command -v python3 2>/dev/null || true)"
  if [[ -n "$p" ]] && "$p" -c "pass" 2>/dev/null; then
    echo "$p"
    return 0
  fi
  return 1
}

PY="$(pick_python)" || {
  osascript -e 'display alert "Crocheter: Python 3 not found" message "Install Python 3 or Xcode Command Line Tools, then try again."'
  exit 1
}

cd "$WWW" || exit 1

PORT=""
for P in 8099 8171 8271 8371 8471; do
  if ! lsof -nP -iTCP:"$P" -sTCP:LISTEN >/dev/null 2>&1; then
    PORT="$P"
    break
  fi
done

if [[ -z "$PORT" ]]; then
  PORT="$((8700 + RANDOM % 200))"
fi

"$PY" -m http.server "$PORT" >"$LOG" 2>&1 &
SERV_PID=$!

ready=""
for ((_i = 0; _i < 30; _i++)); do
  if command -v curl >/dev/null 2>&1; then
    if curl -sf "http://127.0.0.1:${PORT}/offline-hub.html" >/dev/null 2>&1; then ready=1; break; fi
  else
    if [[ $_i -ge 15 ]]; then ready=1; break; fi
  fi
  if ! kill -0 "$SERV_PID" 2>/dev/null; then
    osascript -e "display alert \"Crocheter: server quit\" message \"Check ${LOG} in Finder (Go menu → Go to Folder → /tmp).\""
    exit 1
  fi
  sleep 0.15
done

if [[ -z "$ready" ]]; then
  kill "$SERV_PID" 2>/dev/null
  osascript -e "display alert \"Crocheter: server timeout\" message \"Try double‑click offline-hub.html in crocheter/www instead. Log: ${LOG}\""
  exit 1
fi

open "http://127.0.0.1:${PORT}/index.html#patterns"
echo ""
echo "Python: $PY"
echo "Site:    http://127.0.0.1:${PORT}/"
echo "(Opened index.html pattern hub.) No‑JS fallback: http://127.0.0.1:${PORT}/offline-hub.html"
echo "Log file: $LOG"
echo "Press Ctrl+C in this window to stop the server."
echo ""

cleanup() {
  kill "$SERV_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM
wait "$SERV_PID"
