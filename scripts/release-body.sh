#!/usr/bin/env bash
# Prints the release body: the `## TLDR` section of the tagged commit's pull request (when not empty), the minimum
# server version, then GitHub's generated notes, each separated by a blank line.
# Env: GITHUB_REPOSITORY, GITHUB_SHA. Usage: scripts/release-body.sh <tag>
set -euo pipefail

tag="${1:?usage: release-body.sh <tag>}"

pr_body="$(gh api "repos/$GITHUB_REPOSITORY/commits/$GITHUB_SHA/pulls" --jq '.[0].body // ""')"
tldr="$(
  printf '%s\n' "$pr_body" | tr -d '\r' | awk '
    /^## TLDR[[:space:]]*$/ { on = 1; next }
    /^## / { on = 0 }
    on { print }
  ' | sed -e :a -e '/./,$!d' | sed -e :b -e '/^[[:space:]]*$/{$d;N;bb' -e '}'
)"
min_server="$(bash "$(dirname "$0")/min-server.sh")"
minimum="**Minimum pyn server:** $min_server (the app needs this server release or newer)."
notes="$(gh api "repos/$GITHUB_REPOSITORY/releases/generate-notes" -f "tag_name=$tag" --jq .body | tr -d '\r')"

if [[ -n "${tldr//[[:space:]]/}" ]]; then
  printf '%s\n\n%s\n\n%s\n' "$tldr" "$minimum" "$notes"
else
  printf '%s\n\n%s\n' "$minimum" "$notes"
fi
