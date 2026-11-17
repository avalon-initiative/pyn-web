#!/usr/bin/env bash
# Prints the release facts derived from a tag as key=value lines: version, image_tags.
# The tag is v<X.Y.Z>[-title]; the title changes nothing. The image is tagged with the plain version only.
# Usage: scripts/release-meta.sh v1.0.0[-title] [image-repo]
set -euo pipefail

tag="${1:?usage: release-meta.sh <tag> [image-repo]}"
image="${2:-ghcr.io/avalon-initiative/pyn-web}"

if [[ ! "$tag" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)(-(.+))?$ ]]; then
  echo "release-meta: cannot derive X.Y.Z from tag '$tag'" >&2
  exit 1
fi
version="${BASH_REMATCH[1]}"

echo "version=$version"
echo "image_tags<<EOF"
echo "$image:v$version"
echo "EOF"
