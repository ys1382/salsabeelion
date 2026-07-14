#!/usr/bin/env bash
# Odd Trove — stop duplicate deploy watchdog loops on the VPS (sourced, not run directly).

kids_watchdog_pidfile() {
  printf '/tmp/kids-watchdog-%s.pid' "$1"
}

# Stop one watchdog by pidfile; optional legacy_pattern matches old bash -c loops (pkill -f).
kids_stop_watchdog() {
  local name="$1"
  local legacy_pattern="${2:-}"
  local pidfile
  pidfile="$(kids_watchdog_pidfile "$name")"
  if [[ -f "$pidfile" ]]; then
    local oldpid
    oldpid="$(tr -d '[:space:]' < "$pidfile" 2>/dev/null || true)"
    if [[ -n "$oldpid" ]] && kill -0 "$oldpid" 2>/dev/null; then
      kill "$oldpid" 2>/dev/null || true
      sleep 0.25
      if kill -0 "$oldpid" 2>/dev/null; then
        kill -9 "$oldpid" 2>/dev/null || true
      fi
    fi
    rm -f "$pidfile"
  fi
  if [[ -n "$legacy_pattern" ]]; then
    pkill -f "$legacy_pattern" 2>/dev/null || true
    sleep 0.15
  fi
}
