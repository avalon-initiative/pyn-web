#!/bin/sh
# Writes the host configuration the app reads at start (/config.json) from the environment.
set -eu

out=/etc/nginx/conf.d/config.json
font=${PYN_FONT_SET:-default}
pack=null

case "$font" in
  *[!a-z0-9-]*) echo "pyn-web: PYN_FONT_SET '$font' is not a font set id" >&2; exit 1 ;;
esac

if [ -n "${PYN_ICON_PACK_FILE:-}" ]; then
  [ -r "$PYN_ICON_PACK_FILE" ] || { echo "pyn-web: cannot read PYN_ICON_PACK_FILE '$PYN_ICON_PACK_FILE'" >&2; exit 1; }
  pack=$(cat "$PYN_ICON_PACK_FILE")
fi

printf '{"font_set":"%s","icon_pack":%s}\n' "$font" "$pack" > "$out"
