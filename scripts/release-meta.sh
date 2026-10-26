#!/usr/bin/env bash
# Prints the release facts derived from a tag as key=value lines: version, prerelease (true|false), image_tags.
# The tag is v<X.Y.Z>[-title]; only a title starting alpha, beta, rc or pre (case-insensitive) is a pre-release.
# The image is tagged with the plain version only; the title lives in the git tag and the GitHub Release.
# Usage: scripts/release-meta.sh v1.0.0[-title] [image-repo]
set -euo pipefail

tag="${1:?usage: release-meta.sh <tag> [image-repo]}"
image="${2:-ghcr.io/avalon-initiative/pyn-web}"

if [[ ! "$tag" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)(-(.+))?$ ]]; then
  echo "release-meta: cannot derive X.Y.Z from tag '$tag'" >&2
  exit 1
fi
version="${BASH_REMATCH[1]}"
suffix="${BASH_REMATCH[3]}"

pre=false
shopt -s nocasematch
if [[ "$suffix" =~ ^(alpha|beta|rc|pre)($|[.0-9-]) ]]; then pre=true; fi

tags="$image:v$version"

echo "version=$version"
echo "prerelease=$pre"
echo "image_tags<<EOF"
echo "$tags"
echo "EOF"
