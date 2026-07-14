#!/usr/bin/env bash
# Sanity-check a lorekeeper-store.json backup before/after restore (#30).
set -euo pipefail

FILE="${1:?Usage: verify-store-json.sh path/to/lorekeeper-store.json}"

python3 - <<PY
import json, sys
path = "$FILE"
with open(path, encoding="utf-8") as f:
    data = json.load(f)
if not isinstance(data, dict):
    raise SystemExit("root must be object")
users = data.get("users")
if not isinstance(users, dict):
    raise SystemExit("missing users object")
print(f"OK — {len(users)} account(s), keys: {', '.join(sorted(data.keys()))}")
PY
