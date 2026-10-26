# Releasing

A release is a `v<X.Y.Z>[-title]` tag on a commit on `main`. The title is a free-text slug (`v1.0.0-first-stable`); it
names the release and does not make it a pre-release. Pushing the tag runs `.github/workflows/release.yml`, which builds
the app, publishes the container image `ghcr.io/avalon-initiative/pyn-web` and creates a GitHub Release with the tarball.
pyn-web is an application, so nothing is published to a package registry. There is no `latest` tag.

## Cut a release

`main` is protected, so the version bump lands by PR and the tag goes on the merged commit.

1. From a clean, current `main`, start the release:

   ```bash
   export NODE_AUTH_TOKEN=$(gh auth token)
   make release                                   # prompts for the version and an optional title
   make release VER=0.2.0 TITLE="Some title"      # tag v0.2.0-Some-title; TITLE is optional (tag v0.2.0)
   ```

   It refuses unless you are on `main`, the tree is clean, `main` matches `origin/main` and `gh` is authenticated. It runs
   `scripts/release-checks.sh` (format, lint, typecheck, tests, build, API drift, public boundary), then creates
   `release-v<ver>`, bumps `package.json` and `package-lock.json`, commits `[noissue] - Release <tag>` and, on `y`, pushes
   the branch and opens the PR. `make release-skip-tests` (or `SKIP_CHECKS=1`) skips the checks. The version must be greater
   than the current one and the tag must not exist locally or on origin. Nothing is deleted if a step fails; the message
   says how to clean up.

2. Squash-merge the PR (the commit subject becomes `[noissue] - Release <tag> (#N)`).

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

## Pre-releases and image tags

`scripts/release-meta.sh` derives both from the tag.

| Tag                                       | GitHub Release | Image tag |
| ----------------------------------------- | -------------- | --------- |
| `v1.0.0`                                  | release        | `v1.0.0`  |
| `v1.0.0-first-stable`                     | release        | `v1.0.0`  |
| `v1.0.0-rc.1`, `-beta`, `-alpha2`, `-pre` | pre-release    | `v1.0.0`  |

A title is a pre-release only when it starts with `alpha`, `beta`, `rc` or `pre` (case-insensitive) followed by the end,
`.`, `-` or a digit; `v1.0.0-prerequisites` is a normal release. The image carries only the plain `:v<X.Y.Z>`
(no title, no `latest`); the title lives in the git tag and the GitHub Release. Because the image tag would be overwritten,
`make release` refuses a version for which any `v<X.Y.Z>` or `v<X.Y.Z>-*` tag exists, locally or on origin.

## What the workflow does

1. Checks the tagged commit is on `main` and the tag matches `package.json`.
2. Picks the OpenAPI document: `docs/generated/openapi.json` of the `pyn` release with the same tag if it exists, else
   `pyn` `main` (as CI does).
3. Runs `scripts/release-checks.sh`, which includes `npm run build`.
4. Packs `dist/` as `pyn-web-<tag>.tar.gz` and writes `SHA256SUMS`; both, and `dist/` itself, are handed to the later jobs.
5. Builds the image from that same `dist/` for linux/amd64 and linux/arm64 and pushes `ghcr.io/avalon-initiative/pyn-web:v<X.Y.Z>`.
   The Dockerfile only copies files (no Node, no registry token in the build), so the multi-platform build needs no
   emulation.
6. Creates the GitHub Release with the tarball, `SHA256SUMS` and generated notes, once the image is pushed. It is marked as a pre-release only for
   an `alpha`, `beta`, `rc` or `pre` title (see above).

If a run fails after the image push, fix forward with a new patch version rather than re-tagging. After the first push the
org owner must set the `pyn-web` package on ghcr.io to public (GitHub Packages settings); it starts private.

`docker-build` in `ci.yml` (manual `workflow_dispatch` only, never on pull requests) builds the image from a fresh build and
smoke-tests it read-only against a stub API; run it before a release that touches `Dockerfile` or `docker/`.

## Running the image

```bash
docker run --detach --publish 127.0.0.1:8080:8080 \
  --read-only --tmpfs /tmp --tmpfs /etc/nginx/conf.d --cap-drop ALL \
  --env PYN_API_URL=http://pyn-core:7878 \
  ghcr.io/avalon-initiative/pyn-web:v<X.Y.Z>
```

The container is nginx (unprivileged, port 8080, non-root). It serves the app with the `index.html` fallback for client
routes, caches the hashed files under `/assets/` for a year and never caches `index.html`, sets a content security policy
and the usual hardening headers, and proxies `/v1` and `/healthz` to the API, so the browser sees one origin.

| Variable      | Default                | Meaning                                                                                                                       |
| ------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `PYN_API_URL` | `http://pyn-core:7878` | Address of `pyn-core` (`scheme://host:port`, no path). Resolved per request, so recreating the API container needs no restart |

The proxy passes `Host` unchanged and sends `X-Forwarded-For`, `X-Forwarded-Proto` and `X-Forwarded-Host` (values already
set by a TLS-terminating proxy in front are kept). Set the server's `PYN_PUBLIC_URL` to the public `https://` address, and
`PYN_TRUST_FORWARDED_FOR=true` so rate limits see client addresses. No `PYN_ALLOWED_ORIGINS` entry is needed: the app and
the API share one origin. `/nginx-health` answers from the container itself and backs its `HEALTHCHECK`.

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
