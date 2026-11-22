# The image

`ghcr.io/avalon-initiative/pyn-web` is a small nginx (the unprivileged build) serving the built app. It speaks plain HTTP on
port 8080: HTTPS comes from a proxy in front of it. It serves the app with the `index.html` fallback for client routes,
caches the hashed files under `/assets/` for a year and never caches `index.html`, sets a content security policy and the
usual hardening headers, and forwards `/v1`, `/healthz` and `/readyz` to the API, so the browser sees one origin. Request
bodies are not limited or buffered, responses are streamed, and the timeouts are 300 seconds.

## Running it

```bash
docker run --detach --publish 127.0.0.1:8080:8080 \
  --read-only --tmpfs /tmp --tmpfs /etc/nginx/conf.d:uid=101,gid=101 --cap-drop ALL \
  --env PYN_API_URL=http://pyn-core:7878 \
  ghcr.io/avalon-initiative/pyn-web:v<X.Y.Z>
```

The process runs as a non-root user and needs no capability. The root filesystem can be read-only; the two tmpfs mounts are
what it writes to: `/tmp` for nginx's temporary files, and `/etc/nginx/conf.d` (owned by the container user, uid and gid 101) where the start-up script renders the configuration from the template.

## Settings

| Variable      | Default                | Meaning                                                                                                                                      |
| ------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `PYN_API_URL` | `http://pyn-core:7878` | Address of the server (`scheme://host:port`, no path): one upstream. Resolved per request, so recreating the API container needs no restart. |

There is nothing else to set. Several servers are a load balancer's job, not this container's.

## Paths

| Path                  | Answered by                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/v1/...`             | The API, streamed (no request or response buffering).                                                                    |
| `/healthz`, `/readyz` | The API, unchanged status and body, `Cache-Control: no-store`, not buffered. The app's fallback page never answers them. |
| `/nginx-health`       | The container itself (`ok`), for its `HEALTHCHECK`. It does not depend on the API.                                       |
| anything else         | The app; unknown paths get `index.html` so client routes work.                                                           |

A load balancer or orchestrator that should take a container out of rotation when the server is not ready checks `/readyz`
through this container; `/nginx-health` only says the container is up.

## Behind a proxy and `PYN_TRUSTED_PROXIES`

The container passes `Host` unchanged and sends `X-Forwarded-For`, `X-Forwarded-Proto` and `X-Forwarded-Host` to the API.
`X-Forwarded-Proto` and `X-Forwarded-Host` already set by a proxy in front are kept; otherwise they come from the request.
`X-Forwarded-For` is the incoming value with the address the container saw the connection from appended
(`$proxy_add_x_forwarded_for`), so the container is one more hop that appends.

The server reads the client from the right of `X-Forwarded-For` (`PYN_TRUSTED_PROXIES` entries from the end, default 1) and
only when `PYN_TRUST_FORWARDED_FOR=true`. The value to set is therefore 1 plus the number of proxies in front of the web
container that append to the header:

| In front of the web container                                       | Server sees          | `PYN_TRUSTED_PROXIES` |
| ------------------------------------------------------------------- | -------------------- | --------------------- |
| Nothing (clients connect to the container directly)                 | `client`             | `1` (default)         |
| One TLS proxy or balancer that sets or appends the client's address | `client, proxy`      | `2`                   |
| A CDN and then such a proxy, both appending                         | `client, cdn, proxy` | `3`                   |

A proxy that does not touch the header adds no entry. Count only proxies you trust to append, and set the server's
`PYN_PUBLIC_URL` to the public `https://` address. No `PYN_ALLOWED_ORIGINS` entry is needed: the app and the API share one
origin.

## Checks

The `docker-build` job in `ci.yml` (manual dispatch only) builds the image and runs it read-only with no capabilities against
a stub API (`tests/docker/stub-api.py`): the app and its fallback, the headers, the proxy reaching the API by name,
`/healthz`, and `/readyz` with 200 and 503 passed through and never answered by the app.
