#!/usr/bin/env bash
# Exercises docker/caddy/entrypoint.sh in dry-run mode (it prints the derived settings instead of starting Caddy). No Docker needed.
set -uo pipefail

src="$(cd "$(dirname "$0")/../.." && pwd)/docker/caddy/entrypoint.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fails=0
mkdir "$tmp/certs"
touch "$tmp/certs/tls.crt" "$tmp/certs/tls.key"
printf 'secret-token-value' >"$tmp/token"

ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; echo "$out" | sed 's/^/     | /'; fails=$((fails + 1)); }

# run <env assignments...>: sets $out and $rc
run() {
  out="$(env -i PATH="$PATH" PYN_ENTRYPOINT_DRY_RUN=1 PYN_API_URL=http://pyn-core:7878 PYN_CERT_DIR="$tmp/certs" \
    PYN_CADDYFILE_CUSTOM="$tmp/none" "$@" sh "$src" 2>&1)"
  rc=$?
}
# mode <name> <expected PYN_TLS> <expected PYN_SITE> <env...>
mode() {
  local name="$1" tls="$2" site="$3"; shift 3
  run "$@"
  if [[ $rc -eq 0 && "$out" == *" PYN_SITE=$site PYN_TLS=$tls "* ]]; then ok "$name"; else bad "$name (want tls=$tls site=$site)"; fi
}
# fails <name> <message fragment> <env...>
fails_with() {
  local name="$1" msg="$2"; shift 2
  run "$@"
  if [[ $rc -ne 0 && "$out" == *"$msg"* ]]; then ok "$name"; else bad "$name"; fi
}

mode "nothing set means off on :8080" off http://:8080
mode "PYN_TLS=off with a site ignores the site" off http://:8080 PYN_TLS=off PYN_SITE=pyn.example.com
mode "public name defaults to auto" auto pyn.example.com PYN_SITE=pyn.example.com
mode "IPv4 defaults to internal" internal 192.168.1.10 PYN_SITE=192.168.1.10
mode "IPv6 is bracketed and internal" internal '[fd00::1]' PYN_SITE=fd00::1
mode "bracketed IPv6 is kept" internal '[fd00::1]' PYN_SITE='[fd00::1]'
for n in nas.lan pyn.local pyn.home.arpa pyn.internal pyn.test pyn.localhost pyn localhost NAS.LAN pyn.lan.; do
  mode "private name $n defaults to internal" internal "$n" PYN_SITE="$n"
done
mode "dotted public name is auto" auto sub.pyn.example.co.uk PYN_SITE=sub.pyn.example.co.uk
mode "explicit internal for a public name" internal pyn.example.com PYN_SITE=pyn.example.com PYN_TLS=internal
mode "files with both files" files pyn.example.com PYN_SITE=pyn.example.com PYN_TLS=files
mode "dns-cloudflare with a token" dns-cloudflare pyn.example.com PYN_SITE=pyn.example.com PYN_TLS=dns-cloudflare CF_API_TOKEN=x

fails_with "unknown mode" "unknown PYN_TLS=bogus" PYN_TLS=bogus PYN_SITE=a.example.com
fails_with "files without the key" "needs both" PYN_TLS=files PYN_SITE=a.example.com PYN_CERT_DIR="$tmp/missing"
fails_with "a TLS mode without a site" "needs PYN_SITE" PYN_TLS=internal
fails_with "files without a site" "needs PYN_SITE" PYN_TLS=files
fails_with "dns-cloudflare without a site" "needs PYN_SITE" PYN_TLS=dns-cloudflare CF_API_TOKEN=x
fails_with "dns-cloudflare without a token" "needs CF_API_TOKEN" PYN_TLS=dns-cloudflare PYN_SITE=a.example.com
fails_with "dns-cloudflare with an IP" "not an IP address" PYN_TLS=dns-cloudflare PYN_SITE=10.0.0.1 CF_API_TOKEN=x
fails_with "site with a scheme" "without scheme" PYN_SITE=https://a.example.com
fails_with "site with a port" "without scheme" PYN_SITE=a.example.com:8443
fails_with "API url missing" "PYN_API_URL is not set" PYN_API_URL=
fails_with "API url without a scheme" "must start with http" PYN_API_URL=pyn-core:7878
fails_with "trusted range private_ranges" "would trust every client" PYN_TRUSTED_PROXY_RANGES=private_ranges
fails_with "trusted range 0.0.0.0/0" "would trust every client" PYN_TRUSTED_PROXY_RANGES="10.0.0.1 0.0.0.0/0"

run PYN_API_URL=http://pyn-core:7878/// PYN_TRUSTED_PROXY_RANGES=10.0.0.1/32,172.18.0.5
if [[ "$out" == *"PYN_API_URL=http://pyn-core:7878 PYN_TRUSTED_PROXY_RANGES=10.0.0.1/32 172.18.0.5"* ]]; then ok "normalises API url and ranges"; else bad "normalises API url and ranges"; fi

run PYN_TLS=dns-cloudflare PYN_SITE=a.example.com CF_API_TOKEN_FILE="$tmp/token"
if [[ $rc -eq 0 && "$out" != *secret-token-value* ]]; then ok "token from a file is accepted and never printed"; else bad "token from a file"; fi
fails_with "unreadable token file" "not a readable file" CF_API_TOKEN_FILE="$tmp/nope"

run PYN_TLS=internal PYN_SITE=192.168.1.10
if [[ "$out" == *"root certificate"*"/data/caddy/pki/authorities/local/root.crt"* && "$out" == *"docker cp"* ]]; then ok "internal prints the root certificate location"; else bad "internal prints the root certificate location"; fi

touch "$tmp/custom"
run PYN_CADDYFILE_CUSTOM="$tmp/custom" PYN_TLS=bogus PYN_API_URL=
if [[ $rc -eq 0 && "$out" == *"run: $tmp/custom "* ]]; then ok "a custom Caddyfile skips validation"; else bad "a custom Caddyfile skips validation"; fi

# The default TLS server name must never be empty (Caddy rejects an empty default_sni), whatever the mode.
mkdir -p "$tmp/fakebin"
printf '#!/bin/sh\necho "sni=$PYN_DEFAULT_SNI"\n' >"$tmp/fakebin/caddy"
chmod +x "$tmp/fakebin/caddy"
sni_of() { env -i PATH="$tmp/fakebin:/usr/bin:/bin" PYN_API_URL=http://x:1 "$@" sh "$src" 2>&1 | grep '^sni=' || true; }
[[ "$(sni_of)" == "sni=localhost" ]] && ok "off mode names a non-empty default server name" || bad "off mode names a non-empty default server name"
[[ "$(sni_of PYN_SITE=192.168.7.239)" == "sni=192.168.7.239" ]] && ok "an IP site is the default server name" || bad "an IP site is the default server name"
[[ "$(sni_of PYN_SITE=pyn.example.com PYN_TLS=auto)" == "sni=pyn.example.com" ]] && ok "a host name is the default server name" || bad "a host name is the default server name"

echo
if [[ $fails -eq 0 ]]; then echo "all entrypoint tests passed"; else echo "$fails failed"; exit 1; fi
