#!/bin/sh
# Validates the PYN_* settings, derives the TLS mode, then starts Caddy.
set -eu

CADDYFILE=${PYN_CADDYFILE:-/etc/caddy/Caddyfile}
CUSTOM=${PYN_CADDYFILE_CUSTOM:-/etc/caddy/Caddyfile.custom}
CERT_DIR=${PYN_CERT_DIR:-/certs}
ROOT_CRT=${XDG_DATA_HOME:-/data}/caddy/pki/authorities/local/root.crt

fail() {
	echo "pyn-web: $*" >&2
	exit 1
}

# A token file (a Docker or Kubernetes secret) fills CF_API_TOKEN when it is not set.
if [ -z "${CF_API_TOKEN:-}" ] && [ -n "${CF_API_TOKEN_FILE:-}" ]; then
	[ -r "$CF_API_TOKEN_FILE" ] || fail "CF_API_TOKEN_FILE is not a readable file: $CF_API_TOKEN_FILE"
	CF_API_TOKEN=$(cat "$CF_API_TOKEN_FILE")
	export CF_API_TOKEN
fi

run() {
	if [ "${PYN_ENTRYPOINT_DRY_RUN:-}" = 1 ]; then
		echo "run: $1 PYN_SITE=${PYN_SITE:-} PYN_TLS=${PYN_TLS:-} PYN_API_URL=${PYN_API_URL:-} PYN_TRUSTED_PROXY_RANGES=${PYN_TRUSTED_PROXY_RANGES:-} PYN_LB=${PYN_LB:-}"
		exit 0
	fi
	exec caddy run --config "$1" --adapter caddyfile
}

if [ -f "$CUSTOM" ]; then
	echo "pyn-web: using the mounted $CUSTOM; PYN_SITE, PYN_TLS and PYN_API_URL are not interpreted"
	run "$CUSTOM"
fi

[ -n "${PYN_API_URL:-}" ] || fail "PYN_API_URL is not set (the server address, for example http://pyn-core:7878)"

# One address or several, separated by spaces or commas; each is scheme://host[:port] with no path.
upstreams=
count=0
first_scheme=
for u in $(printf '%s' "$PYN_API_URL" | tr ',' ' '); do
	u=${u%"${u##*[!/]}"}
	case $u in
	http://* | https://*) ;;
	*) fail "PYN_API_URL entries must start with http:// or https://: $u" ;;
	esac
	scheme=${u%%://*}
	[ -z "$first_scheme" ] || [ "$scheme" = "$first_scheme" ] ||
		fail "PYN_API_URL entries must all use the same scheme (Caddy shares one transport): $u"
	first_scheme=$scheme
	hostport=${u#*://}
	case $hostport in
	*/* | *\?* | *@* | *\#*) fail "PYN_API_URL entries are scheme://host[:port] with no path, query or credentials: $u" ;;
	esac
	case $hostport in
	\[*\]) host=$hostport port= ;;
	\[*\]:*) host=${hostport%%]*}] port=${hostport##*]:} ;;
	*:*:*) fail "PYN_API_URL: bracket an IPv6 address, as http://[::1]:7878: $u" ;;
	*:*) host=${hostport%%:*} port=${hostport#*:} ;;
	*) host=$hostport port= ;;
	esac
	[ -n "$host" ] && [ "$host" != "[]" ] || fail "PYN_API_URL entry has no host: $u"
	case $port in
	*[!0-9]*) fail "PYN_API_URL entry has an invalid port: $u" ;;
	esac
	if [ -n "$port" ] && { [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; }; then
		fail "PYN_API_URL entry has an invalid port: $u"
	fi
	key=$(printf '%s' "$u" | tr 'A-Z' 'a-z')
	for seen in $upstreams; do
		[ "$(printf '%s' "$seen" | tr 'A-Z' 'a-z')" != "$key" ] || fail "PYN_API_URL lists the same server twice: $u"
	done
	upstreams="${upstreams:+$upstreams }$u"
	count=$((count + 1))
done
[ "$count" -gt 0 ] || fail "PYN_API_URL is not set (the server address, for example http://pyn-core:7878)"
PYN_API_URL=$upstreams
export PYN_API_URL
# One server is proxied as is; several are balanced and health checked (docker/caddy/lb).
if [ "$count" -gt 1 ]; then PYN_LB=multi; else PYN_LB=single; fi
export PYN_LB

# Space separated; commas are accepted too.
ranges=$(printf '%s' "${PYN_TRUSTED_PROXY_RANGES:-}" | tr ',' ' ')
for r in $ranges; do
	case $r in
	private_ranges | 0.0.0.0/0* | ::/0*)
		fail "PYN_TRUSTED_PROXY_RANGES must list the real proxy addresses; $r would trust every client"
		;;
	esac
done
PYN_TRUSTED_PROXY_RANGES=$ranges
export PYN_TRUSTED_PROXY_RANGES

site=${PYN_SITE:-}
mode=${PYN_TLS:-}

# Echoes: ip, private or public. The name is lower-cased and without a trailing dot.
site_kind() {
	n=$(printf '%s' "$1" | tr 'A-Z' 'a-z')
	n=${n%.}
	case $n in
	\[*\] | *:*)
		echo ip
		return
		;;
	*[!0-9.]*) ;;
	*.*.*.*)
		echo ip
		return
		;;
	esac
	case $n in
	*.lan | *.local | *.home.arpa | *.internal | *.test | *.localhost) echo private ;;
	*.*) echo public ;;
	*) echo private ;;
	esac
}

if [ -n "$site" ]; then
	case $site in
	*://* | */* | *\?* | *@*) fail "PYN_SITE is a host name or IP address only, without scheme, path or port: $site" ;;
	\[*\]) ;;
	*:*:*) site="[$site]" ;;
	*:*) fail "PYN_SITE is a host name or IP address only, without scheme, path or port: $site" ;;
	esac
	kind=$(site_kind "$site")
fi

if [ -z "$mode" ]; then
	if [ -z "$site" ]; then
		mode=off
	elif [ "$kind" = public ]; then
		mode=auto
	else
		mode=internal
	fi
fi

case $mode in
off | auto | internal | files | dns-cloudflare) ;;
*) fail "unknown PYN_TLS=$mode (expected auto, internal, dns-cloudflare, files or off)" ;;
esac

if [ "$mode" = off ]; then
	[ -z "$site" ] || echo "pyn-web: PYN_TLS=off, so PYN_SITE=$site is ignored"
	site=
else
	[ -n "$site" ] || fail "PYN_TLS=$mode needs PYN_SITE, the host name or IP address people use (no scheme or port)"
fi

case $mode in
files)
	[ -r "$CERT_DIR/tls.crt" ] && [ -r "$CERT_DIR/tls.key" ] ||
		fail "PYN_TLS=files needs both $CERT_DIR/tls.crt and $CERT_DIR/tls.key (mount them)"
	;;
dns-cloudflare)
	[ -n "${CF_API_TOKEN:-}" ] || fail "PYN_TLS=dns-cloudflare needs CF_API_TOKEN, or CF_API_TOKEN_FILE pointing at a file holding it"
	[ "$kind" != ip ] || fail "PYN_TLS=dns-cloudflare needs a host name in a Cloudflare zone, not an IP address: $site"
	;;
auto)
	[ "$kind" = public ] ||
		echo "pyn-web: warning: PYN_TLS=auto needs a public host name reachable on ports 80 and 443; $site will most likely not get a certificate (use internal)" >&2
	;;
esac

export PYN_TLS="$mode"
export PYN_SITE="${site:-http://:8080}"
# A client that connects to an IP sends no server name; behind Docker the address it reached is the container's, so name the certificate to use.
sni=${site#[}
sni=${sni%]}
export PYN_DEFAULT_SNI="${sni:-localhost}"

case $mode in
off) echo "pyn-web: TLS off, plain HTTP on :8080 (terminate TLS in front of this container)" ;;
auto) echo "pyn-web: TLS auto for $site (public certificates; ports 80 and 443 must be reachable)" ;;
internal)
	echo "pyn-web: TLS internal for $site (local authority; each device must trust its root certificate once)"
	echo "pyn-web: root certificate, created on first start: $ROOT_CRT"
	echo "pyn-web: fetch it with: docker cp <container>:$ROOT_CRT ./pyn-root.crt"
	;;
files) echo "pyn-web: TLS files for $site ($CERT_DIR/tls.crt and tls.key)" ;;
dns-cloudflare) echo "pyn-web: TLS dns-cloudflare for $site (DNS-01 through the Cloudflare API)" ;;
esac

run "$CADDYFILE"
