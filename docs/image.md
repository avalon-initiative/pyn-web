# The image: serving, HTTPS and overrides

`ghcr.io/avalon-initiative/pyn-web` is [Caddy](https://caddyserver.com) (with the Cloudflare DNS module) serving the built app.
It runs as a non-root user, needs no capability and works with a read-only root filesystem. It serves the app with the
`index.html` fallback for client routes, caches the hashed files under `/assets/` for a year and never caches `index.html`,
sets a content security policy and the usual hardening headers, and proxies `/v1`, `/healthz` and `/readyz` to the API, so the
browser sees one origin. Request bodies are not limited or buffered, responses are streamed, and the timeouts are 300 seconds.

## Quick start

Plain HTTP on 8080, for use behind your own proxy, tunnel or load balancer (this is what the image does when `PYN_SITE` and
`PYN_TLS` are unset):

```bash
docker run --detach --publish 127.0.0.1:8080:8080 \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
  --env PYN_API_URL=http://pyn-core:7878 \
  ghcr.io/avalon-initiative/pyn-web:v<X.Y.Z>
```

HTTPS with a host name people use (`pyn.example.com` must reach ports 80 and 443 of this host; certificates are automatic):

```bash
docker run --detach --publish 80:80 --publish 443:443 --publish 443:443/udp \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
  --sysctl net.ipv4.ip_unprivileged_port_start=0 \
  --volume pyn-web-data:/data \
  --env PYN_API_URL=http://pyn-core:7878 --env PYN_SITE=pyn.example.com \
  ghcr.io/avalon-initiative/pyn-web:v<X.Y.Z>
```

The caps and the sysctl matter. The process is not root, so it binds 80 and 443 through the namespaced
`net.ipv4.ip_unprivileged_port_start` sysctl instead of a capability. The `/data` volume must persist: it holds the
certificates and the internal root, and losing it means new certificates (and, for `internal`, a new root every device
must trust again) and can hit public authorities' rate limits.

## Settings

| Variable                   | Default                | Meaning                                                                                                                                                                                                                                                  |
| -------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PYN_API_URL`              | `http://pyn-core:7878` | Address of the server (`http://` or `https://`, host and optional port, no path), or several separated by spaces or commas (see [Several servers](#several-servers)). Resolved on each new connection, so recreating the API container needs no restart. |
| `PYN_SITE`                 | unset                  | The host name or IP address people use, without scheme or port. Unset means plain HTTP on 8080.                                                                                                                                                          |
| `PYN_TLS`                  | see below              | `off`, `auto`, `internal`, `files` or `dns-cloudflare`.                                                                                                                                                                                                  |
| `PYN_TRUSTED_PROXY_RANGES` | empty                  | Addresses or ranges (space or comma separated) of proxies in front of this container. Never a private-range wildcard; `private_ranges`, `0.0.0.0/0` and `::/0` are rejected.                                                                             |
| `CF_API_TOKEN`             | unset                  | Cloudflare API token limited to the zone, for `dns-cloudflare`.                                                                                                                                                                                          |
| `CF_API_TOKEN_FILE`        | unset                  | A file holding that token (a Docker secret), used when `CF_API_TOKEN` is not set. The token is never printed.                                                                                                                                            |
| `PYN_ACCESS_LOG`           | `off`                  | `on` writes one JSON line per request to stderr. The log is JSON on stderr either way.                                                                                                                                                                   |

The mode when `PYN_TLS` is unset:

| `PYN_SITE`                                                                                                                          | Mode       |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| unset                                                                                                                               | `off`      |
| an IPv4 or IPv6 address, a single-label name, or a name ending `.lan`, `.local`, `.home.arpa`, `.internal`, `.test` or `.localhost` | `internal` |
| any other name                                                                                                                      | `auto`     |

| `PYN_TLS`        | What it does                                                                                                                                                                                                                 | Needs                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `off`            | Plain HTTP on 8080, no redirect, nothing is written to `/data`. `PYN_SITE` is ignored.                                                                                                                                       | nothing                                     |
| `auto`           | Public certificates from Let's Encrypt, with the fallback authority left enabled; renewal is automatic and short-lived certificates need no change. http redirects to https (308).                                           | `PYN_SITE`, ports 80 and 443 from outside   |
| `internal`       | Certificates from a local authority, valid for an IP address or a private name. http redirects to https. Each device trusts the root once; the entrypoint prints where it is (`/data/caddy/pki/authorities/local/root.crt`). | `PYN_SITE`, the `/data` volume              |
| `files`          | Your certificate and key, mounted at `/certs/tls.crt` and `/certs/tls.key`. Renewing means replacing the files and restarting.                                                                                               | `PYN_SITE`, both files                      |
| `dns-cloudflare` | Public certificates through the DNS challenge, so ports 80 and 443 need not be reachable from the internet and nothing else must be exposed.                                                                                 | `PYN_SITE` (a name), `CF_API_TOKEN` or file |

The entrypoint validates the combination and refuses to start with a clear message when it does not fit (an unknown mode,
missing certificate files or token, a TLS mode without `PYN_SITE`, an unusable or duplicated `PYN_API_URL` entry).

Fetch the internal root certificate from a running container:

```bash
docker cp <container>:/data/caddy/pki/authorities/local/root.crt ./pyn-root.crt
```

Limits to know about: the http-to-https redirect omits the port, so the real 443 must be published (otherwise use `off` and
your own proxy). Passkeys need a host name over https; an IP address is not allowed by the web standard. Public authorities
are not relied on for IP addresses, use `internal`.

## Several servers

List more than one server and one web container spreads `/v1` over them, so a load balancer needs one pairing of web
container and server no longer:

```bash
--env PYN_API_URL="http://10.0.0.11:7878 http://10.0.0.12:7878"
```

- Each entry is `scheme://host[:port]` with no path, query or credentials. The entrypoint refuses to start on a duplicate,
  a bad port, an entry that is not an address, or a mix of `http` and `https` (the proxy uses one transport for all).
- Requests go to the server with the fewest open connections (`least_conn`). Plain round robin ignores that a push, a
  download or a stream holds its connection for minutes, so it would pile long transfers on one copy; counting open
  connections keeps them level. There are no sticky sessions: the servers share their state, so any copy can answer any
  request.
- Each server's `/readyz` is checked every 5 seconds (2 second timeout, `200` expected, over `https` too when the upstreams
  are `https`). A copy answering `503` (draining, or its database or bucket is down) or not answering stops receiving
  traffic within one interval and returns when `/readyz` is `200` again. A refused or failed connection also counts
  against a server (3 failures in 10 seconds take it out for 10 seconds). When none is ready the web container answers `503`
  itself.
- A request is retried on another server only when the connection could not be made, so nothing was sent. A request that
  failed after the server received part of it, including a push or an upload that is streamed (the body is not buffered),
  is never replayed: the client gets a `502` and decides. Streaming, the missing body limit and the 300 second timeouts are
  the same as with one server.
- `/readyz` and `/healthz` through the web container are answered by one of the servers, chosen by the balancer, so with
  several servers they reflect that copy and not all of them. Neither is cached.
- With one server there are no health checks and no balancing: the container proxies as before, so an unready server
  answers with its own `503` rather than a gateway error, and `/v1` keeps reaching it.
- A name that resolves to several addresses is not expanded: Caddy would use one of the addresses per connection without
  health checking each. List every server explicitly.
- The container's own loopback `/health` (the image `HEALTHCHECK`) never depends on the servers.

## Behind a proxy, a tunnel or Cloudflare

The container sends the server one `X-Forwarded-For` entry, the real client, so the server's `PYN_TRUST_FORWARDED_FOR=true`
stays correct. The client address is the connection's peer unless the peer is in `PYN_TRUSTED_PROXY_RANGES`; then the
client is read from `CF-Connecting-IP`, else from `X-Forwarded-For` (right to left, the first address not listed).
`X-Forwarded-Proto` and `X-Forwarded-Host` from a listed proxy are kept; otherwise they are set from the request. List only
the addresses the proxy really connects from (for a container proxy, its address on the shared network), never a range that
includes clients. Set the server's `PYN_PUBLIC_URL` to the public `https://` address.

## Replacing the configuration

Mount a Caddyfile at `/etc/caddy/Caddyfile.custom` and it replaces the generated configuration entirely: `PYN_SITE`,
`PYN_TLS` and `PYN_API_URL` are then not interpreted (the file may read them itself with `{$NAME}`). The image's
`HEALTHCHECK` asks `http://127.0.0.1:8082/health`; keep a site like the one in
[docker/caddy/Caddyfile](../docker/caddy/Caddyfile) or override the health check. The generated files are in
[docker/caddy](../docker/caddy) and make a good starting point.

## Checks

`tests/docker/smoke.sh` (the `docker-build` job in `ci.yml`, manual dispatch only) runs the built image read-only with no
capabilities against stub APIs: the app and headers, `/readyz`, streaming, a large upload, the `off`, `internal` and `files`
modes, `caddy validate` of every mode, and two servers (spread, an unready or stopped server leaving rotation, no replay
of an interrupted upload). `tests/docker/entrypoint.test.sh` (part of `make check`) tests the entrypoint's
validation and mode detection without Docker.
