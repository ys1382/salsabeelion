#!/usr/bin/env bash
# Stage and commit only HalalFlicks vet config (and optional vet docs).
# Usage:
#   bash halalflicks/scripts/commit-vet-config.sh "HalalFlicks vet: record shown batch H"
#   bash halalflicks/scripts/commit-vet-config.sh "HalalFlicks vet: log owner decisions for batch G+H"
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

MSG="${1:-}"
if [[ -z "$MSG" ]]; then
  echo "Usage: $0 \"commit message\"" >&2
  exit 1
fi

# Allowed paths only — never www/, deploy, or unrelated files.
ALLOWED=(
  "halalflicks/config/hand_vetted.json"
  "halalflicks/config/parked.json"
  "halalflicks/config/vet_shown.json"
  "halalflicks/config/rec_catalog.json"
  "halalflicks/HALALFLICKS-ROADMAP-AND-TODO.md"
  ".cursor/rules/halalflicks-vet-no-repeat.mdc"
  "halalflicks/scripts/commit-vet-config.sh"
)

to_add=()
for path in "${ALLOWED[@]}"; do
  # porcelain: any status for this path means include it
  if [[ -n "$(git status --porcelain -- "$path" 2>/dev/null)" ]]; then
    to_add+=("$path")
  fi
done

if [[ ${#to_add[@]} -eq 0 ]]; then
  echo "Nothing to commit for HalalFlicks vet config."
  exit 0
fi

git add -- "${to_add[@]}"

if git diff --cached --quiet; then
  echo "Nothing staged after add (no changes)."
  exit 0
fi

git commit -m "$(cat <<EOF
$MSG

EOF
)"

echo "Committed HalalFlicks vet paths: ${to_add[*]}"
