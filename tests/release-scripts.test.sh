#!/usr/bin/env bash
# Exercises scripts/release.sh, ci-green-for-tree.sh, release-meta.sh and verify-release-version.sh in a throwaway repo
# with a bare origin and a stub gh. No network, nothing real is pushed.
set -uo pipefail
unset YES VER TITLE SKIP_CHECKS FORCE_CHECKS GH_API_FAIL GH_REPO GITHUB_REPOSITORY

src="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fails=0

ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }
expect() { # expect <name> <condition-exit-code>
  if [[ "$2" -eq 0 ]]; then ok "$1"; else bad "$1"; fi
}

mkdir "$tmp/bin"
cat >"$tmp/bin/gh" <<'STUB'
#!/usr/bin/env bash
if [[ "$1" == "api" ]]; then # answers from the JSON files in $GH_FIX through the real --jq filter
  ep="$2"; shift 2; q=.
  while [[ $# -gt 0 ]]; do [[ "$1" == "--jq" ]] && q="$2"; shift; done
  [[ -z "${GH_API_FAIL:-}" ]] || exit 1
  case "$ep" in
    */pulls) f="$GH_FIX/pulls.json" ;;
    */git/commits/*) f="$GH_FIX/commit-${ep##*/}.json" ;;
    */actions/runs*) f="$GH_FIX/runs.json" ;;
    *) exit 1 ;;
  esac
  [[ -f "$f" ]] || exit 1
  exec jq -r "$q" "$f"
fi
echo "$*" >>"$GH_LOG"
[[ "${GH_AUTH_FAIL:-}" == "1" && "$1" == "auth" ]] && exit 1
[[ "$1 $2" == "pr create" ]] && echo "https://example.invalid/pull/1"
exit 0
STUB
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH" GH_LOG="$tmp/gh.log" GH_FIX="$tmp/fix"

setup() { # fresh work repo + bare origin, on main with version 0.1.0
  rm -rf "$tmp/origin.git" "$tmp/work" "$GH_FIX"; mkdir -p "$GH_FIX"
  git init -q --bare -b main "$tmp/origin.git"
  git clone -q "$tmp/origin.git" "$tmp/work" 2>/dev/null
  cd "$tmp/work" || exit 1
  git config user.email t@example.invalid
  git config user.name t
  git config tag.gpgSign false
  git config commit.gpgSign false
  git switch -q -c main 2>/dev/null || true
  mkdir scripts
  cp "$src"/scripts/{release.sh,release-meta.sh,verify-release-version.sh,ci-green-for-tree.sh} scripts/
  printf '#!/usr/bin/env bash\necho gate-ran >>"$GATE_LOG"\n[[ "${GATE_FAIL:-}" != 1 ]]\n' >scripts/release-checks.sh
  printf '{\n  "name": "x",\n  "version": "0.1.0",\n  "lockfileVersion": 3,\n  "packages": {\n    "": { "name": "x", "version": "0.1.0" }\n  }\n}\n' >package-lock.json
  printf '{\n  "name": "x",\n  "version": "0.1.0"\n}\n' >package.json
  git add -A && git commit -q -m init && git push -q -u origin main
  : >"$GH_LOG"
  : >"$tmp/gate.log"
  export GATE_LOG="$tmp/gate.log"
  unset GATE_FAIL GH_AUTH_FAIL
}

run() { bash scripts/release.sh "$@" </dev/null >"$tmp/out" 2>&1; local rc=$?; [[ -n "${DEBUG:-}" ]] && cat "$tmp/out"; return $rc; }
origin_has() { git --git-dir="$tmp/origin.git" rev-parse -q --verify "$1" >/dev/null; }

# happy path with a title
setup
VER=0.2.0 TITLE="First stable build!" YES=1 run release
expect "release succeeds" $?
[[ "$(git branch --show-current)" == "release-v0.2.0" ]]; expect "on release branch" $?
[[ "$(git log -1 --format=%s)" == "[noissue] - Release v0.2.0-First-stable-build" ]]; expect "commit subject" $?
files="$(git show --name-only --format= HEAD)"
[[ "$(wc -l <<<"$files")" -eq 2 ]] && grep -qx package.json <<<"$files" && grep -qx package-lock.json <<<"$files"; expect "only version files changed" $?
grep -q '"version": "0.2.0"' package.json && grep -q '"version": "0.2.0"' package-lock.json; expect "both files bumped" $?
origin_has refs/heads/release-v0.2.0; expect "branch pushed" $?
! origin_has refs/heads/main@{0} 2>/dev/null; [[ "$(git --git-dir="$tmp/origin.git" rev-parse main)" == "$(git rev-parse main)" ]]; expect "main untouched" $?
! git tag | grep -q .; expect "no local tag" $?
[[ -z "$(git --git-dir="$tmp/origin.git" tag)" ]]; expect "no remote tag" $?
grep -q '^pr create .*--title \[noissue\] - Release v0.2.0-First-stable-build' "$GH_LOG"; expect "gh pr create called" $?
[[ -s "$tmp/gate.log" ]]; expect "gate ran" $?

# no title, answered no: nothing pushed
setup
VER=0.1.1 TITLE= run release
expect "non-tty without YES fails" $([[ $? -ne 0 ]] && echo 0 || echo 1)
setup
VER=0.1.1 TITLE= YES=1 SKIP_CHECKS=1 run release
[[ ! -s "$tmp/gate.log" ]]; expect "SKIP_CHECKS skips the gate" $?
[[ "$(git log -1 --format=%s)" == "[noissue] - Release v0.1.1" ]]; expect "untitled tag subject" $?

# refusals change nothing
refuse() { # refuse <name> <expected-text> [env...]
  local name="$1" text="$2"; shift 2
  env "$@" bash scripts/release.sh release </dev/null >"$tmp/out" 2>&1
  local rc=$?
  [[ $rc -ne 0 ]] && grep -q "$text" "$tmp/out" &&
    [[ -z "$(git branch --list 'release-*')" ]] && [[ ! -s "$GH_LOG" || "$(grep -c 'pr create' "$GH_LOG")" == 0 ]]
  expect "refuse: $name" $?
}
setup; echo x >dirty; refuse "dirty tree" "not clean" VER=0.2.0 TITLE= YES=1
setup; git switch -q -c other; refuse "not on main" "not on main" VER=0.2.0 TITLE= YES=1
setup; git clone -q "$tmp/origin.git" "$tmp/other" 2>/dev/null; (cd "$tmp/other" && git config user.email t@e.invalid && git config user.name t && git commit -q --allow-empty -m up && git push -q origin main); rm -rf "$tmp/other"
refuse "behind origin" "not up to date" VER=0.2.0 TITLE= YES=1
setup; git tag v0.2.0-old; refuse "other local tag, same version" "already exists" VER=0.2.0 TITLE= YES=1
setup; git tag v0.2.0-old && git push -q origin v0.2.0-old && git tag -d v0.2.0-old >/dev/null; refuse "other remote tag, same version" "already exists" VER=0.2.0 TITLE=new YES=1
setup; git tag v0.2.0; refuse "existing local tag" "already exists" VER=0.2.0 TITLE= YES=1
setup; git tag v0.2.0 && git push -q origin v0.2.0 && git tag -d v0.2.0 >/dev/null; refuse "existing remote tag" "already exists" VER=0.2.0 TITLE= YES=1
setup; refuse "bad version" "invalid version" VER=0.2 TITLE= YES=1
setup; refuse "version not greater" "not greater" VER=0.1.0 TITLE= YES=1
setup; refuse "lower version" "not greater" VER=0.0.9 TITLE= YES=1
setup; refuse "gh not authenticated" "gh is not authenticated" VER=0.2.0 TITLE= YES=1 GH_AUTH_FAIL=1
setup; refuse "gate fails" "checks failed" VER=0.2.0 TITLE= YES=1 GATE_FAIL=1
setup; refuse "no tty and no values" "not a terminal"
[[ -z "$(git status --porcelain)" ]]; expect "tree still clean" $?

# ci-green-for-tree.sh: a passing CI run on a PR head with the same tree, else non-zero with a reason
head=1111111111111111111111111111111111111111
fixtures() { # fixtures <pr-head-tree> <ci-conclusion>
  printf '[{"number":7,"head":{"sha":"%s"}}]\n' "$head" >"$GH_FIX/pulls.json"
  printf '{"tree":{"sha":"%s"}}\n' "$1" >"$GH_FIX/commit-$head.json"
  printf '{"workflow_runs":[{"name":"Other","conclusion":"failure","created_at":"2026-01-02T00:00:00Z","html_url":"x"},{"name":"CI","conclusion":%s,"status":"in_progress","created_at":"2026-01-01T00:00:00Z","html_url":"https://example.invalid/run/1"}]}\n' "$2" >"$GH_FIX/runs.json"
}
green() { bash scripts/ci-green-for-tree.sh "$@" </dev/null >"$tmp/out" 2>&1; }
green_refused() { # green_refused <name> <expected-text> [env...]
  local name="$1" text="$2"; shift 2
  env "$@" bash scripts/ci-green-for-tree.sh origin/main </dev/null >"$tmp/out" 2>&1
  local rc=$?
  [[ $rc -ne 0 ]] && grep -q "$text" "$tmp/out"; expect "tree check: $name" $?
}
setup
tree="$(git rev-parse 'origin/main^{tree}')"
other=2222222222222222222222222222222222222222
fixtures "$tree" '"success"'
green origin/main; expect "tree check passes on a matching tree with a green run" $?
grep -q "PR #7 (https://example.invalid/run/1)" "$tmp/out"; expect "tree check names the PR and run" $?
green; expect "tree check defaults to HEAD" $?
fixtures "$other" '"success"'; green_refused "refuses a different tree" "different tree"
fixtures "$tree" '"failure"'; green_refused "refuses a failing run" "is failure"
fixtures "$tree" null; green_refused "refuses a run still in progress" "is in_progress"
printf '{"workflow_runs":[{"name":"Other","conclusion":"success","created_at":"2026-01-01T00:00:00Z","html_url":"x"}]}\n' >"$GH_FIX/runs.json"
green_refused "refuses a head with no CI run" "is none"
printf '[]\n' >"$GH_FIX/pulls.json"; green_refused "refuses a commit with no pull request" "no pull request"
fixtures "$tree" '"success"'; green_refused "says why on an API error" "cannot decide" GH_API_FAIL=1
green nonexistent; expect "tree check fails on an unknown commit" $([[ $? -ne 0 ]] && echo 0 || echo 1)

# release.sh: the gate is skipped on a green tree; FORCE_CHECKS and a non-matching tree run it
setup
tree="$(git rev-parse 'origin/main^{tree}')"
fixtures "$tree" '"success"'
refuse "FORCE_CHECKS runs the gate despite a green tree" "checks failed" VER=0.2.0 TITLE= YES=1 FORCE_CHECKS=1 GATE_FAIL=1
refuse "SKIP_CHECKS with FORCE_CHECKS" "contradict" VER=0.2.0 TITLE= YES=1 SKIP_CHECKS=1 FORCE_CHECKS=1
VER=0.2.0 TITLE= YES=1 FORCE_CHECKS=1 run release; [[ -s "$tmp/gate.log" ]]; expect "FORCE_CHECKS runs the gate" $?
setup
tree="$(git rev-parse 'origin/main^{tree}')"
fixtures "$tree" '"success"'
VER=0.2.0 TITLE= YES=1 GATE_FAIL=1 run release; expect "a green tree skips the failing gate" $?
[[ ! -s "$tmp/gate.log" ]]; expect "the gate did not run on a green tree" $?
grep -q "skipping the local checks; ci-green-for-tree: tree .* passed CI on PR #7" "$tmp/out"; expect "the skip says why" $?
setup
fixtures "$other" '"success"'; refuse "a different tree still runs the gate" "checks failed" VER=0.2.0 TITLE= YES=1 GATE_FAIL=1
fixtures "$tree" '"failure"'; refuse "a failing CI run still runs the gate" "checks failed" VER=0.2.0 TITLE= YES=1 GATE_FAIL=1
VER=0.2.0 TITLE= YES=1 GATE_FAIL=1 SKIP_CHECKS=1 GH_API_FAIL=1 run release; expect "SKIP_CHECKS wins without any CI data" $?

# publish on a simulated squash merge
setup
VER=0.2.0 TITLE="Big one" YES=1 run release
git switch -q main
git merge -q --squash release-v0.2.0 >/dev/null && git commit -q -m "[noissue] - Release v0.2.0-Big-one (#12)" && git push -q origin main
YES=1 run publish
expect "publish succeeds" $?
origin_has refs/tags/v0.2.0-Big-one; expect "tag pushed" $?
[[ "$(git --git-dir="$tmp/origin.git" rev-parse 'v0.2.0-Big-one^{commit}')" == "$(git rev-parse HEAD)" ]]; expect "tag on merged commit" $?
[[ "$(git cat-file -t v0.2.0-Big-one)" == tag ]]; expect "tag is annotated" $?
[[ "$(git --git-dir="$tmp/origin.git" tag | wc -l)" -eq 1 ]]; expect "only the tag pushed" $?
YES=1 run publish
[[ $? -ne 0 ]] && grep -q "already exists" "$tmp/out"; expect "publish refuses existing tag" $?

setup
YES=1 run publish
[[ $? -ne 0 ]] && grep -q "not a squash-merged release commit" "$tmp/out"; expect "publish refuses non-release HEAD" $?
git commit -q --allow-empty -m "[noissue] - Release v0.3.0 (#5)" && git push -q origin main
YES=1 run publish
[[ $? -ne 0 ]] && grep -q "package.json is 0.1.0" "$tmp/out"; expect "publish refuses version mismatch" $?
git switch -q -c other
YES=1 run publish
[[ $? -ne 0 ]] && grep -q "not on main" "$tmp/out"; expect "publish refuses off main" $?

# release-meta: pre-release flag and image tags
meta() { bash scripts/release-meta.sh "$1" img; }
for t in v1.0.0 v1.0.0-first-stable v1.0.0-Big-One v1.0.0-prerequisites v1.0.0-bethany v1.0.0-release-candidate; do
  grep -qx "prerelease=false" <<<"$(meta $t)"; expect "meta $t is not a pre-release" $?
done
for t in v1.0.0-alpha v1.0.0-beta.1 v1.0.0-rc1 v1.0.0-RC-2 v1.0.0-pre v1.0.0-Pre-release v1.0.0-Alpha.3 v1.0.0-beta-2; do
  grep -qx "prerelease=true" <<<"$(meta $t)"; expect "meta $t is a pre-release" $?
done
out="$(meta v1.2.3)"
[[ "$(sed -n '/^image_tags<</,/^EOF$/p' <<<"$out" | grep -c '^img:')" == 1 ]] && grep -qx "img:v1.2.3" <<<"$out"; expect "meta plain tag pushes plain version only" $?
out="$(meta v1.2.3-first-stable)"
[[ "$(sed -n '/^image_tags<</,/^EOF$/p' <<<"$out" | grep -c '^img:')" == 1 ]] && grep -qx "img:v1.2.3" <<<"$out"; expect "meta titled tag pushes the plain version only" $?
bash scripts/release-meta.sh nonsense >/dev/null 2>&1; expect "meta rejects a bad tag" $([[ $? -ne 0 ]] && echo 0 || echo 1)

# verify-release-version
verify() { bash scripts/verify-release-version.sh "$1" >/dev/null 2>&1; }
verify v0.1.0; expect "verify accepts matching tag" $?
verify v0.1.0-First-stable; expect "verify accepts titled tag" $?
verify v0.2.0; expect "verify rejects mismatch" $([[ $? -ne 0 ]] && echo 0 || echo 1)
verify nonsense; expect "verify rejects a bad tag" $([[ $? -ne 0 ]] && echo 0 || echo 1)

echo
if [[ $fails -ne 0 ]]; then echo "$fails failed"; exit 1; fi
echo "all passed"
