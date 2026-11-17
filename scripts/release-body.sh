#!/usr/bin/env bash
# Prints the release body: the `## TLDR` section of the tagged commit's pull request (when not empty), a blank line,
# then GitHub's generated notes. Without a TLDR it is the generated notes alone.
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
notes="$(gh api "repos/$GITHUB_REPOSITORY/releases/generate-notes" -f "tag_name=$tag" --jq .body | tr -d '\r')"

if [[ -n "${tldr//[[:space:]]/}" ]]; then
  printf '%s\n\n%s\n' "$tldr" "$notes"
else
  printf '%s\n' "$notes"
fi
