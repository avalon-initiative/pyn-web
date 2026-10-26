#!/usr/bin/env bash
# Fails unless the version embedded in a release tag matches package.json.
# Usage: scripts/verify-release-version.sh v0.1.0[-optional-title]
set -euo pipefail

tag="${1:?usage: verify-release-version.sh <tag>}"
cd "$(git rev-parse --show-toplevel)"

if [[ ! "${tag#v}" =~ ^([0-9]+\.[0-9]+\.[0-9]+) ]]; then
  echo "verify-release-version: cannot derive X.Y.Z from tag '${tag}'"
  exit 1
fi
tag_version="${BASH_REMATCH[1]}"
pkg_version="$(node -p 'require("./package.json").version')"

if [[ "${tag_version}" != "${pkg_version}" ]]; then
  echo "verify-release-version: tag ${tag} is ${tag_version} but package.json is ${pkg_version}"
  exit 1
fi
echo "verify-release-version: ${tag} matches package.json (${pkg_version})"
