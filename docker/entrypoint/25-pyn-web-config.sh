#!/bin/sh
# Writes the host configuration the app reads at start (/config.json) from the environment.
# Blank or bad settings warn and fall back to the defaults; only a failed write is fatal.
set -eu

out=${PYN_CONFIG_OUT:-/etc/nginx/conf.d/config.json}
font=$(printf '%s' "${PYN_FONT_SET:-}" | tr 'A-Z' 'a-z')
pack=null

case "$font" in
  '') font=default ;;
  *[!a-z0-9-]*)
    echo "pyn-web: PYN_FONT_SET '$font' is not a font set id, using the default" >&2
    font=default ;;
esac

if [ -n "${PYN_ICON_PACK_FILE:-}" ]; then
  if [ ! -r "$PYN_ICON_PACK_FILE" ]; then
    echo "pyn-web: cannot read PYN_ICON_PACK_FILE '$PYN_ICON_PACK_FILE', using the built-in icons" >&2
  elif [ "$(tr -d ' \t\r\n' < "$PYN_ICON_PACK_FILE" | cut -c1)" != '{' ]; then
    echo "pyn-web: PYN_ICON_PACK_FILE '$PYN_ICON_PACK_FILE' is not a JSON object, using the built-in icons" >&2
  else
    pack=$(cat "$PYN_ICON_PACK_FILE")
  fi
fi

printf '{"font_set":"%s","icon_pack":%s}\n' "$font" "$pack" > "$out"
