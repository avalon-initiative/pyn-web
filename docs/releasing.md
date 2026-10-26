# Releasing

A release is a `v<X.Y.Z>[-title]` tag on a commit on `main`. Pushing the tag runs `.github/workflows/release.yml`, which
builds the app and publishes a GitHub Release. pyn-web is an application, so nothing is published to a package registry.

## Cut a release

`main` is protected, so the version bump lands by PR and the tag goes on the merged commit.

1. Branch from a current `main`, then run the checks, bump `package.json`/`package-lock.json`, commit and tag locally:

   ```bash
   export NODE_AUTH_TOKEN=$(gh auth token)
   make release VER=0.1.0 TITLE="Some title"   # tag v0.1.0-Some-title; TITLE is optional (tag v0.1.0)
   ```

   `make release` aborts without changing anything if `scripts/release-checks.sh` fails (format, lint, typecheck, tests,
   build, API drift, public boundary). `make release-skip-tests` skips the checks.

2. Delete the local tag (it points at the pre-merge commit), push the branch and open the PR for the bump:

   ```bash
   git tag -d v0.1.0-Some-title
   git push -u origin HEAD
   ```

3. After the PR is squash-merged, tag the merged commit and push only the tag. This push is what releases:

   ```bash
   git checkout main && git pull
   git tag -a v0.1.0-Some-title -m v0.1.0-Some-title
   git push origin v0.1.0-Some-title
   ```

The workflow refuses a tag whose commit is not on `main`, or whose `X.Y.Z` differs from `package.json`
(`scripts/verify-release-version.sh`).

## What the workflow does

1. Checks the tagged commit is on `main` and the tag matches `package.json`.
2. Picks the OpenAPI document: `docs/generated/openapi.json` of the `pyn` release with the same tag if it exists, else
   `pyn` `main` (as CI does).
3. Runs `scripts/release-checks.sh`, which includes `npm run build`.
4. Packs `dist/` as `pyn-web-<tag>.tar.gz`, writes `SHA256SUMS`, and creates the GitHub Release with both and
   generated notes.

## Deploying the tarball

```bash
sha256sum -c SHA256SUMS
mkdir -p /srv/pyn-web && tar -xzf pyn-web-<tag>.tar.gz -C /srv/pyn-web
```

The app is static files. It calls the API at `location.origin` (`src/api/http.ts`), with paths under `/v1`, so the web
root and the API must share one origin. Serve `/srv/pyn-web` with a web server or reverse proxy that:

- proxies `/v1` and `/healthz` to `pyn-server`;
- falls back to `index.html` for every other path (client-side routing, history mode).

There is no build-time or runtime setting for a separate API origin.
