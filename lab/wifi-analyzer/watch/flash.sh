#!/usr/bin/env bash
# Flash the watch image at 0x0. This replaces Nori's watch firmware; the merged image also blanks the settings
# area (NVS), so no stored network survives. Get Nori's back by reflashing
# smart_nori_rover/esp32_nodes/nori_watch_control (see its README).
#
#   PORT=/dev/cu.usbmodemXXXX lab/wifi-analyzer/watch/flash.sh [image.bin]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BIN="${1:-$HERE/build/watch-wifi-analyzer.bin}"
[ -f "$BIN" ] || { echo "No image at $BIN. Run build.sh first." >&2; exit 1; }
: "${PORT:?set PORT to the watch, e.g. PORT=/dev/cu.usbmodem1101 (the T-Deck is also a usbmodem)}"
esptool --chip esp32s3 --port "$PORT" --baud "${BAUD:-921600}" write-flash 0x0 "$BIN"
