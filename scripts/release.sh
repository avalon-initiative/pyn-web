#!/usr/bin/env bash
# Release flow. `release` bumps the version on a branch and opens a PR; `publish` tags the merged commit.
# Env: VER, TITLE, SKIP_CHECKS=1 (release); YES=1 answers every prompt yes. See docs/releasing.md.
set -euo pipefail

cmd="${1:-}"
cd "$(git rev-parse --show-toplevel)"

die() { echo "release: $*" >&2; exit 1; }

# Prompts need a terminal unless the answer was given up front.
ask() { # ask <prompt> <var> [default]
  local prompt="$1" var="$2" reply
  if [[ ! -t 0 ]]; then
    die "stdin is not a terminal; pass VER=x.y.z TITLE=\"...\" YES=1 (see docs/releasing.md)"
  fi
  read -r -p "$prompt" reply
  printf -v "$var" '%s' "$reply"
}

confirm() { # confirm <prompt>
  [[ "${YES:-}" == "1" ]] && return 0
  [[ -t 0 ]] || die "stdin is not a terminal; pass YES=1 to confirm (see docs/releasing.md)"
  local reply
  read -r -p "$1" reply
  [[ "$reply" == "y" || "$reply" == "Y" ]]
}

pkg_version() { node -p "require('./package.json').version"; }

preconditions() {
  [[ "$(git branch --show-current)" == "main" ]] || die "not on main"
  [[ -z "$(git status --porcelain)" ]] || die "working tree is not clean"
  git fetch -q origin main || die "git fetch origin main failed"
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || die "main is not up to date with origin/main (pull first)"
}

tag_exists() {
  git rev-parse -q --verify "refs/tags/$1" >/dev/null && return 0
  [[ -n "$(git ls-remote --tags origin "refs/tags/$1")" ]]
}

cleanup_hint() {
  local rc=$?
  [[ $rc -eq 0 ]] || echo "release: failed; clean up with: git switch main && git branch -D $release_branch" >&2
}

release() {
  preconditions
  gh auth status >/dev/null 2>&1 || die "gh is not authenticated (gh auth login)"
  if [[ -z "${VER:-}" || -z "${TITLE+x}" || "${YES:-}" != "1" ]]; then
    [[ -t 0 ]] || die "stdin is not a terminal; pass VER=x.y.z TITLE=\"...\" YES=1 (see docs/releasing.md)"
  fi

  if [[ "${SKIP_CHECKS:-}" == "1" ]]; then
    echo "release: skipping pre-release checks (SKIP_CHECKS=1)"
  else
    echo "release: running pre-release checks (scripts/release-checks.sh)"
    bash scripts/release-checks.sh || die "pre-release checks failed; nothing was changed"
  fi

  local current ver title slug tag branch
  current="$(pkg_version)"
  ver="${VER:-}"
  [[ -n "$ver" ]] || ask "Release version (current: $current): " ver
  [[ "$ver" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "invalid version '$ver' (expected X.Y.Z)"
  [[ "$ver" != "$current" && "$(printf '%s\n%s\n' "$current" "$ver" | sort -V | tail -n 1)" == "$ver" ]] ||
    die "version $ver is not greater than the current $current"
  if [[ -n "${TITLE+x}" ]]; then title="$TITLE"; else ask "Release title (optional): " title; fi
  slug="$(printf '%s' "$title" | sed -E 's/[[:space:]]+/-/g; s/[^A-Za-z0-9._-]//g; s/^-+//; s/-+$//')"
  tag="v$ver"
  [[ -z "$slug" ]] || tag="$tag-$slug"
  tag_exists "$tag" && die "tag $tag already exists (locally or on origin)"
  branch="release-v$ver"
  git rev-parse -q --verify "refs/heads/$branch" >/dev/null && die "branch $branch already exists"

  release_branch="$branch"
  trap cleanup_hint EXIT
  git switch -q -c "$branch"
  npm version --no-git-tag-version "$ver" >/dev/null
  git add -- package.json package-lock.json
  local subject="[noissue] - Release $tag"
  git commit -q -m "$subject"

  echo "release: tag $tag, version $ver"
  git diff --stat HEAD~1 HEAD
  local body="Release $tag: bumps package.json and package-lock.json to $ver.

The tag is created on the merged commit after this PR is squash-merged, with \`make release-publish\`."
  if confirm "Push the branch and open the pull request? [y/N] "; then
    git push -q -u origin "$branch"
    gh pr create --base main --head "$branch" --title "$subject" --body "$body"
  else
    echo "release: later, run:"
    echo "  git push -u origin $branch"
    echo "  gh pr create --base main --head $branch --title \"$subject\""
  fi
  trap - EXIT
}

publish() {
  preconditions
  local subject tag ver
  subject="$(git log -1 --format=%s)"
  local re='^\[noissue\] - Release (v([0-9]+\.[0-9]+\.[0-9]+)(-[A-Za-z0-9._-]+)?) \(#[0-9]+\)$'
  [[ "$subject" =~ $re ]] ||
    die "HEAD is not a squash-merged release commit ('[noissue] - Release v<ver>[-title] (#N)'): $subject"
  tag="${BASH_REMATCH[1]}"
  ver="${BASH_REMATCH[2]}"
  [[ "$(pkg_version)" == "$ver" ]] || die "package.json is $(pkg_version) at HEAD but the commit releases $ver"
  tag_exists "$tag" && die "tag $tag already exists (locally or on origin)"
  confirm "Create tag $tag on $(git rev-parse --short HEAD) and push it? This starts the release pipeline. [y/N] " ||
    die "aborted; nothing was tagged"
  git tag -a "$tag" -m "$tag"
  git push -q origin "refs/tags/$tag"
  echo "release: pushed $tag"
}

case "$cmd" in
  release) release ;;
  publish) publish ;;
  *) die "usage: scripts/release.sh release|publish" ;;
esac
