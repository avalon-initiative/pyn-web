#!/usr/bin/env bash
# Smoke test of the built image (default pyn-web:ci): runs it read-only with no capabilities against a stub API and checks
# the app, headers, streaming, large uploads, and the off, internal and files TLS modes. Needs Docker, curl, jq, openssl.
# Binds host ports 8080, 80 and 443. Run from the repository root after `npm run build` and `docker build -t pyn-web:ci .`.
set -euo pipefail

IMAGE=${1:-pyn-web:ci}
STUB_IMAGE=python:3.14-alpine3.24@sha256:5862d971d1f0ae26b258cefa4e893556b1d3aba81bd2ff30888704ad378bab67
UPLOAD_MIB=${UPLOAD_MIB:-512}
MEM_LIMIT_MIB=${MEM_LIMIT_MIB:-256}
work=$(mktemp -d)
repo=$(cd "$(dirname "$0")/../.." && pwd)

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    docker ps -a || true
    docker logs web 2>&1 | tail -n 40 || true
  fi
  docker rm -f web pyn-core >/dev/null 2>&1 || true
  docker network rm smoke >/dev/null 2>&1 || true
  docker volume rm smoke-data >/dev/null 2>&1 || true
  rm -rf "$work"
  exit "$status"
}
trap cleanup EXIT

step() { echo "== $*"; }
die() { echo "FAIL: $*" >&2; exit 1; }
eq() { [ "$1" = "$2" ] || die "$3: got '$1', want '$2'"; }
# has <pattern> <command...>: the command's output contains the pattern (case-insensitive) (captured first, so no SIGPIPE under pipefail).
has() {
  local pattern=$1 out
  shift
  out=$("$@" 2>&1) || return 1
  grep -qi -- "$pattern" <<<"$out"
}

# start_web <docker run args...>: the hardened flags every deployment uses, then waits for the loopback health site.
start_web() {
  docker rm -f web >/dev/null 2>&1 || true
  docker run -d --name web --network smoke --read-only --tmpfs /tmp --cap-drop ALL \
    --security-opt no-new-privileges --sysctl net.ipv4.ip_unprivileged_port_start=0 \
    -v smoke-data:/data -e PYN_API_URL=http://pyn-core:8080 "$@" "$IMAGE" >/dev/null
  for _ in $(seq 60); do
    docker exec web wget -q -O /dev/null http://127.0.0.1:8082/health 2>/dev/null && return 0
    [ "$(docker inspect -f '{{.State.Running}}' web)" = true ] || die "web exited at start"
    sleep 1
  done
  die "web did not become healthy"
}

# seen <curl args...>: the X-Forwarded-For and X-Forwarded-Proto the stub saw for a /v1/ request.
seen() { curl -fsS "$@" | jq -r '.headers["X-Forwarded-For"] + " " + .headers["X-Forwarded-Proto"]'; }

# wait_tls <curl args...>: the first handshake can land before Caddy has issued the certificate at start-up, so retry briefly.
wait_tls() {
  for _ in $(seq 20); do
    curl -fsS -o /dev/null "$@" 2>/dev/null && return 0
    sleep 0.5
  done
  return 1
}

step "stub API"
docker network create smoke >/dev/null
docker volume create smoke-data >/dev/null
docker run -d --name pyn-core --network smoke -v "$repo/tests/docker/stub-api.py:/stub.py:ro" "$STUB_IMAGE" python3 -I /stub.py 8080 >/dev/null
sleep 2

step "config validates in every mode"
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$work/tls.key" -out "$work/tls.crt" -days 2 -subj /CN=127.0.0.1 \
  -addext subjectAltName=IP:127.0.0.1 2>/dev/null
chmod 0755 "$work"
chmod 0644 "$work/tls.key" "$work/tls.crt"
validate() { # validate <name> <env...>
  local name=$1 out
  shift
  if ! out=$(docker run --rm --read-only --tmpfs /tmp --cap-drop ALL -v "$work:/certs:ro" -e PYN_API_URL=http://pyn-core:8080 "$@" \
    --entrypoint caddy "$IMAGE" validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1); then
    echo "$out"
    die "caddy validate failed for $name"
  fi
  echo "valid: $name"
}
validate off -e PYN_TLS=off
validate unset-site-default
validate auto -e PYN_SITE=pyn.example.com -e PYN_TLS=auto
validate internal -e PYN_SITE=192.168.1.10 -e PYN_TLS=internal
validate files -e PYN_SITE=127.0.0.1 -e PYN_TLS=files
validate dns-cloudflare -e PYN_SITE=pyn.example.com -e PYN_TLS=dns-cloudflare -e CF_API_TOKEN=abcdefghijklmnopqrstuvwxyz0123456789ABCD
validate access-log -e PYN_ACCESS_LOG=on
validate trusted-proxies -e PYN_TRUSTED_PROXY_RANGES="10.0.0.1/32 172.18.0.0/16"
has dns.providers.cloudflare docker run --rm --entrypoint caddy "$IMAGE" list-modules || die "cloudflare module missing"

step "fails fast with a clear message"
fail_check() { # fail_check <expected text> <env...>
  want=$1; shift
  if out=$(docker run --rm "$@" "$IMAGE" 2>&1); then die "container started but should fail: $*"; fi
  grep -q -- "$want" <<<"$out" || die "no '$want' in: $out"
  echo "ok: $want"
}
fail_check "unknown PYN_TLS=bogus" -e PYN_TLS=bogus -e PYN_SITE=pyn.example.com
fail_check "needs PYN_SITE" -e PYN_TLS=internal
fail_check "needs both /certs/tls.crt and /certs/tls.key" -e PYN_TLS=files -e PYN_SITE=pyn.example.com
fail_check "needs CF_API_TOKEN" -e PYN_TLS=dns-cloudflare -e PYN_SITE=pyn.example.com
fail_check "PYN_API_URL is not set" -e PYN_API_URL=

step "off mode: plain HTTP on 8080"
start_web -p 127.0.0.1:8080:8080
web=http://127.0.0.1:8080
has '<div id="app">' curl -fsS "$web/some/client/route" || die "SPA fallback"
headers=$(curl -fsS -D - -o /dev/null "$web/")
for h in 'content-security-policy: default-src' 'x-content-type-options: nosniff' 'x-frame-options: DENY' \
  'referrer-policy: same-origin' 'permissions-policy: camera=()' 'cache-control: no-cache'; do
  grep -qi "^$h" <<<"$headers" || die "missing header: $h"
done
if grep -qi '^server:' <<<"$headers"; then die "Server header is exposed"; fi
asset=$(grep -o '/assets/[^"]*\.js' dist/index.html | head -n 1)
test -n "$asset" || die "no asset found in dist/index.html"
assethead=$(curl -fsSI "$web$asset")
grep -qi '^cache-control: public, max-age=31536000, immutable' <<<"$assethead" || die "asset caching"
eq "$(curl -s -o /dev/null -w '%{http_code}' "$web/")" 200 "off mode serves the app without a redirect"
eq "$(curl -s -o /dev/null -w '%{redirect_url}' "$web/")" "" "off mode redirect"
eq "$(curl -s -o /dev/null -w '%{http_code}' "$web/healthz")" 200 "/healthz reaches the stub"
eq "$(curl -fsS "$web/v1/ping" | jq -r .path)" /v1/ping "/v1 is forwarded"
ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' web)
if curl -s --max-time 3 "http://$ip:8082/health" >/dev/null; then die "health site is reachable from outside the container"; fi

step "off mode: X-Forwarded-For is exactly one entry"
xff=$(seen -H 'X-Forwarded-For: 6.6.6.6, 7.7.7.7' "$web/v1/ping")
case $xff in *6.6.6.6* | *7.7.7.7* | *,*) die "client-supplied X-Forwarded-For leaked: $xff" ;; esac
eq "${xff##* }" http "X-Forwarded-Proto"

step "off mode: a streamed response arrives while it is still open"
start=$(date +%s.%N)
first=
while read -r _; do [ -n "$first" ] || first=$(date +%s.%N); done < <(curl -fsSN "$web/v1/stream")
end=$(date +%s.%N)
test -n "$first" || die "no streamed data"
awk -v s="$start" -v f="$first" -v e="$end" 'BEGIN { exit !(f - s < 1.5 && e - s >= 2.5) }' || die "not streamed: first chunk after $(awk -v s="$start" -v f="$first" 'BEGIN { print f - s }')s"

step "off mode: a ${UPLOAD_MIB} MiB upload streams through with bounded memory"
truncate -s "${UPLOAD_MIB}M" "$work/big.bin"
curl -fsS -T "$work/big.bin" -X POST "$web/v1/upload" -o "$work/upload.json" || die "upload failed"
eq "$(jq -r .got "$work/upload.json")" $((UPLOAD_MIB * 1024 * 1024)) "bytes the stub received"
if peak=$(docker exec web cat /sys/fs/cgroup/memory.peak 2>/dev/null); then
  echo "peak memory $((peak / 1048576)) MiB"
  [ "$peak" -lt $((MEM_LIMIT_MIB * 1048576)) ] || die "memory grew with the upload: $((peak / 1048576)) MiB"
else
  echo "warning: no cgroup v2 memory.peak, memory not checked"
fi

step "internal mode (the default for an IP address): redirect, own certificate authority, forwarded headers"
docker rm -f web >/dev/null
docker volume rm smoke-data >/dev/null
docker volume create smoke-data >/dev/null
start_web -e PYN_SITE=127.0.0.1 -p 127.0.0.1:80:80 -p 127.0.0.1:443:443
docker logs web >"$work/web.log" 2>&1
grep -q 'TLS internal for 127.0.0.1' "$work/web.log" || die "entrypoint does not name the mode"
grep -q '/data/caddy/pki/authorities/local/root.crt' "$work/web.log" || die "entrypoint does not name the root certificate"
for _ in $(seq 30); do
  docker cp web:/data/caddy/pki/authorities/local/root.crt "$work/root.crt" 2>/dev/null && break
  sleep 1
done
test -s "$work/root.crt" || die "root certificate was not created"
wait_tls --cacert "$work/root.crt" https://127.0.0.1/ || true
eq "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' http://127.0.0.1/some/route)" "308 https://127.0.0.1/some/route" "http redirect"
has '<div id="app">' curl -fsSv --cacert "$work/root.crt" https://127.0.0.1/some/route || { curl -sv --cacert "$work/root.crt" https://127.0.0.1/some/route 2>&1 | head -40; docker logs web 2>&1 | tail -15; die "https SPA with the exported root"; }
if curl -fsS https://127.0.0.1/ >/dev/null 2>&1; then die "certificate verified without the exported root"; fi
xff=$(seen --cacert "$work/root.crt" -H 'X-Forwarded-For: 6.6.6.6' https://127.0.0.1/v1/ping)
[[ $xff =~ ^[0-9.]+\ https$ && $xff != 6.6.6.6* ]] || die "want one real client address and https, got: $xff"
has '^content-security-policy:' curl -fsS -D - -o /dev/null --cacert "$work/root.crt" https://127.0.0.1/ || die "headers over https"
fp=$(openssl x509 -in "$work/root.crt" -noout -fingerprint -sha256)
start_web -e PYN_SITE=127.0.0.1 -p 127.0.0.1:80:80 -p 127.0.0.1:443:443
docker cp web:/data/caddy/pki/authorities/local/root.crt "$work/root2.crt"
eq "$(openssl x509 -in "$work/root2.crt" -noout -fingerprint -sha256)" "$fp" "root certificate persists in the data volume"

step "files mode: the certificate from the mount"
start_web -e PYN_SITE=127.0.0.1 -e PYN_TLS=files -v "$work/tls.crt:/certs/tls.crt:ro" -v "$work/tls.key:/certs/tls.key:ro" \
  -p 127.0.0.1:80:80 -p 127.0.0.1:443:443
wait_tls --cacert "$work/tls.crt" https://127.0.0.1/ || true
has '<div id="app">' curl -fsS --cacert "$work/tls.crt" https://127.0.0.1/some/route || die "https with the mounted certificate"
eq "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/)" 308 "http redirect in files mode"
eq "$(curl -fsS --cacert "$work/tls.crt" https://127.0.0.1/v1/ping | jq -r .path)" /v1/ping "/v1 over https"

step "a mounted Caddyfile.custom replaces the generated configuration"
printf ':8081 {\n\trespond "custom"\n}\nhttp://127.0.0.1:8082 {\n\tbind 127.0.0.1\n\trespond /health ok\n}\n' >"$work/Caddyfile.custom"
start_web -v "$work/Caddyfile.custom:/etc/caddy/Caddyfile.custom:ro" -p 127.0.0.1:8081:8081
eq "$(curl -fsS http://127.0.0.1:8081/)" custom "custom Caddyfile response"

echo "image smoke test passed"
