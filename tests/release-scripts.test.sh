#!/usr/bin/env bash
# Exercises scripts/release.sh, release-meta.sh and verify-release-version.sh in a throwaway repo
# with a bare origin and a stub gh. No network, nothing real is pushed.
set -uo pipefail

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
echo "$*" >>"$GH_LOG"
[[ "${GH_AUTH_FAIL:-}" == "1" && "$1" == "auth" ]] && exit 1
[[ "$1 $2" == "pr create" ]] && echo "https://example.invalid/pull/1"
exit 0
STUB
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH" GH_LOG="$tmp/gh.log"

setup() { # fresh work repo + bare origin, on main with version 0.1.0
  rm -rf "$tmp/origin.git" "$tmp/work"
  git init -q --bare -b main "$tmp/origin.git"
  git clone -q "$tmp/origin.git" "$tmp/work" 2>/dev/null
  cd "$tmp/work" || exit 1
  git config user.email t@example.invalid
  git config user.name t
  git config tag.gpgSign false
  git config commit.gpgSign false
  git switch -q -c main 2>/dev/null || true
  mkdir scripts
  cp "$src"/scripts/{release.sh,release-meta.sh,verify-release-version.sh} scripts/
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
setup; git tag v0.2.0; refuse "existing local tag" "already exists" VER=0.2.0 TITLE= YES=1
setup; git tag v0.2.0 && git push -q origin v0.2.0 && git tag -d v0.2.0 >/dev/null; refuse "existing remote tag" "already exists" VER=0.2.0 TITLE= YES=1
setup; refuse "bad version" "invalid version" VER=0.2 TITLE= YES=1
setup; refuse "version not greater" "not greater" VER=0.1.0 TITLE= YES=1
setup; refuse "lower version" "not greater" VER=0.0.9 TITLE= YES=1
setup; refuse "gh not authenticated" "gh is not authenticated" VER=0.2.0 TITLE= YES=1 GH_AUTH_FAIL=1
setup; refuse "gate fails" "checks failed" VER=0.2.0 TITLE= YES=1 GATE_FAIL=1
setup; refuse "no tty and no values" "not a terminal"
[[ -z "$(git status --porcelain)" ]]; expect "tree still clean" $?

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
grep -qx "img:v1.2.3" <<<"$out" && grep -qx "img:v1.2.3-first-stable" <<<"$out"; expect "meta titled tag pushes plain and full tags" $?
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
