#!/usr/bin/env bash
# Prints the `gh release create` flag for a tag: --latest when its X.Y.Z is the highest among the existing
# release tags (the title slug is ignored), else --latest=false (a backport).
# Env: GITHUB_REPOSITORY. Usage: scripts/release-latest.sh v1.0.0[-title]
set -euo pipefail

tag="${1:?usage: release-latest.sh <tag>}"
[[ "$tag" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)(-.+)?$ ]] || { echo "release-latest: bad tag '$tag'" >&2; exit 1; }
version="${BASH_REMATCH[1]}"

existing="$(gh api "repos/$GITHUB_REPOSITORY/releases" --paginate --jq '.[].tag_name')"
highest="$(
  { printf '%s\n' "$existing" | sed -nE 's/^v([0-9]+\.[0-9]+\.[0-9]+)(-.*)?$/\1/p'; echo "$version"; } | sort -V | tail -n 1
)"

if [[ "$highest" == "$version" ]]; then echo "--latest"; else echo "--latest=false"; fi
