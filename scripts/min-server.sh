#!/usr/bin/env bash
# Prints min_server (the oldest pyn server release this app needs) from min-server.json.
set -euo pipefail

file="$(dirname "$0")/../min-server.json"
min="$(jq -er .min_server "$file")"
if [[ ! "$min" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "min-server: '$min' in $file is not X.Y.Z" >&2
  exit 1
fi
echo "$min"
