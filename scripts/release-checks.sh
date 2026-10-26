#!/usr/bin/env bash
# Pre-release gate: the CI checks plus the production build.
# `make release` runs it before changing anything; the release workflow runs it too.
# PYN_OPENAPI (path or URL) selects the OpenAPI document for the drift check.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "release-checks: format"
npm run format:check
echo "release-checks: lint"
npm run lint
echo "release-checks: type-check"
npm run typecheck
echo "release-checks: tests"
npm test
echo "release-checks: release scripts"
bash tests/release-scripts.test.sh >/dev/null
echo "release-checks: build"
npm run build
echo "release-checks: api drift"
npm run api:check
echo "release-checks: public boundary"
python3 scripts/check_public_boundary.py

echo "release-checks: all checks passed"
