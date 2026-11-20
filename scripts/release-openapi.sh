#!/usr/bin/env bash
# Prints the pyn git ref whose OpenAPI document the release builds against: the pyn release named by min_server
# (tag v<X.Y.Z> or v<X.Y.Z>-title) when one exists, else main. Env: PYN_REPO (default avalon-initiative/pyn).
# Usage: scripts/release-openapi.sh [min_server]
set -euo pipefail

min="${1:-$(bash "$(dirname "$0")/min-server.sh")}"
repo="${PYN_REPO:-avalon-initiative/pyn}"

tags="$(gh api "repos/$repo/releases" --paginate --jq '.[].tag_name')"
tag="$(grep -E "^v${min//./\\.}(-.*)?\$" <<<"$tags" | head -n 1 || true)"
echo "${tag:-main}"
