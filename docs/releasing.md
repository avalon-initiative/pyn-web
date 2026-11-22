# Releasing

A release is a `v<X.Y.Z>[-title]` tag on a commit on `main`. The title is a free-text slug (`v1.0.0-first-stable`); it
names the release and changes no flag. Pushing the tag runs `.github/workflows/release.yml`, which builds
the app, publishes the container image `ghcr.io/avalon-initiative/pyn-web` and creates a GitHub Release with the tarball.
pyn-web is an application, so nothing is published to a package registry. There is no `latest` tag.

The web release is versioned independently of the server: its tag need not match any `pyn` server tag, and no release
requires a specific server version. What the app needs is stated as `min_server`, below.

## The minimum server version

`min-server.json` holds `min_server`, the oldest `pyn` server release this app needs. It is used three ways:

- at load the app compares it with `version` from `GET /v1/capabilities` and shows a non-blocking warning when the server
  is older. A newer server never triggers it, nor does a server that reports no version, nor a pre-release of an equal or
  newer `X.Y.Z` (only `X.Y.Z` is compared, numerically; `src/state/server-compat.state.ts`);
- the release notes state it (`scripts/release-body.sh`);
- the release job takes the OpenAPI document from the `pyn` release named by it, or from `main` when no such release
  exists yet (`scripts/release-openapi.sh`).

Bump `min_server` in the same pull request that starts using an API an older server lacks (a new endpoint or field the
app depends on), setting it to the first server release that has it, or to the next planned one while that is unreleased.
Leave it alone otherwise: a UI-only change needs no bump, and a server that is ahead is always fine because the API only
grows within `/v1`.

## Cut a release

`main` is protected, so the version bump lands by PR and the tag goes on the merged commit.

1. From a clean, current `main`, start the release:

   ```bash
   export NODE_AUTH_TOKEN=$(gh auth token)
   make release                                   # prompts for the version and an optional title
   make release VER=0.2.0 TITLE="Some title"      # tag v0.2.0-Some-title; TITLE is optional (tag v0.2.0)
   ```

   It refuses unless you are on `main`, the tree is clean, `main` matches `origin/main` and `gh` is authenticated. It runs
   `scripts/release-checks.sh` (format, lint, typecheck, tests, build, API drift, public boundary) unless
   [CI already passed on this tree](#when-the-checks-are-skipped), then creates
   `release-v<ver>`, bumps `package.json` and `package-lock.json`, commits `[RELEASE] - <tag>` and, on `y`, pushes
   the branch and opens the PR. `make release-skip-tests` (or `SKIP_CHECKS=1`) skips the checks and `FORCE_CHECKS=1` always runs them. The version must be greater
   than the current one and the tag must not exist locally or on origin. Nothing is deleted if a step fails; the message
   says how to clean up.

2. Squash-merge the PR (the commit subject becomes `[RELEASE] - <tag> (#N)`; the earlier `[noissue] - Release <tag> (#N)` form is still accepted by `make release-publish`).

3. Tag the merged commit and push only the tag. This push is what releases:

   ```bash
   git switch main && git pull
   make release-publish
   ```

   It checks that `main` is current, that HEAD is the squash-merged release commit and that `package.json` at HEAD matches,
   then asks before creating the annotated tag and pushing it. `YES=1` answers the prompts for scripted use; without a
   terminal and without `YES=1` (or `VER`/`TITLE` for `make release`) the scripts fail instead of waiting.

The scripts are `scripts/release.sh` and are tested against a throwaway repo, bare origin and stub `gh` by
`make release-test` (also part of `scripts/release-checks.sh`).

The workflow refuses a tag whose commit is not on `main`, or whose `X.Y.Z` differs from `package.json`
(`scripts/verify-release-version.sh`).

## When the checks are skipped

The checks would repeat what CI already ran on the release pull request. [`scripts/ci-green-for-tree.sh`](../scripts/ci-green-for-tree.sh)
`[<commit>]` exits 0 only when the commit came from a pull request whose head has the same git tree and whose latest `CI`
run concluded `success`. It prints one line saying which pull request and run satisfied it, or why not; any error is non-zero.

`make release` runs it on `origin/main`, the commit the release branch is cut from, and skips the local checks with a message
when it passes. `FORCE_CHECKS=1` runs them regardless; `SKIP_CHECKS=1` skips them without looking; both together is refused.
It fails safe: when the check cannot decide (another pull request merged in between so the tree differs, a failed or missing
CI run, an API error), the checks simply run. A squash merge of an unchanged release branch keeps the pull request's tree,
which is the normal case. The tag workflow is unaffected: it always runs its checks, because they share a build with the packaging.

## Latest, the release text and image tags

There is no pre-release: a release is final, and a fix is a new patch. The workflow creates the GitHub Release with
`--latest` when the tag's `X.Y.Z` is the highest among the existing release tags (`scripts/release-latest.sh`, title ignored)
and with `--latest=false` otherwise, so a backport to an older line never takes Latest.

The release body is the `## TLDR` section of the release pull request (the pull request of the tagged commit, from that
heading to the next `## ` heading) followed by GitHub's generated "What's Changed"; with no TLDR text it is the generated
notes alone (`scripts/release-body.sh`). `make release` opens the pull request with an empty `## TLDR` section: fill it in
before merging.

`scripts/release-meta.sh` derives the image tag from the tag: `v1.0.0` and `v1.0.0-first-stable` both give `v1.0.0`. The
image carries only the plain `:v<X.Y.Z>` (no title, no `latest`); the title lives in the git tag and the GitHub Release.
Because the image tag would be overwritten, `make release` refuses a version for which any `v<X.Y.Z>` or `v<X.Y.Z>-*` tag
exists, locally or on origin.

## What the workflow does

1. Checks the tagged commit is on `main` and the tag matches `package.json`.
2. Picks the OpenAPI document: `docs/generated/openapi.json` of the `pyn` release named by `min_server` if it exists, else
   `pyn` `main` (as CI does). It never looks for a `pyn` tag equal to the web tag.
3. Runs `scripts/release-checks.sh`, which includes `npm run build`.
4. Packs `dist/` as `pyn-web-<tag>.tar.gz` and writes `SHA256SUMS`; both, and `dist/` itself, are handed to the later jobs.
5. Builds the image from that same `dist/` for linux/amd64 and linux/arm64 and pushes `ghcr.io/avalon-initiative/pyn-web:v<X.Y.Z>`.
   The Dockerfile only copies files (no Node, no registry token in the build), so the multi-platform build needs no
   emulation.
6. Creates the GitHub Release with the tarball, `SHA256SUMS` and the body described above, once the image is pushed. It is
   Latest only when its version is the highest.

If a run fails after the image push, fix forward with a new patch version rather than re-tagging. After the first push the
org owner must set the `pyn-web` package on ghcr.io to public (GitHub Packages settings); it starts private.

`docker-build` in `ci.yml` (manual `workflow_dispatch` only, never on pull requests) builds the image from a fresh build and
smoke-tests it read-only against a stub API (`tests/docker/smoke.sh`) and cross-builds arm64; run it before a release that
touches `Dockerfile` or `docker/`.

## Running the image

The image is Caddy serving the app and proxying the API; the settings, the HTTPS modes and the overrides are in
[image.md](image.md).

## Deploying the tarball

The tarball and `SHA256SUMS` stay on every release for hosts that serve static files themselves.

```bash
sha256sum -c SHA256SUMS
mkdir -p /srv/pyn-web && tar -xzf pyn-web-<tag>.tar.gz -C /srv/pyn-web
```

The app is static files. It calls the API at `location.origin` (`src/api/http.ts`), with paths under `/v1`, so the web
root and the API must share one origin. Serve `/srv/pyn-web` with a web server or reverse proxy that:

- proxies `/v1` and `/healthz` to `pyn-server`;
- falls back to `index.html` for every other path (client-side routing, history mode).

There is no build-time or runtime setting for a separate API origin.
