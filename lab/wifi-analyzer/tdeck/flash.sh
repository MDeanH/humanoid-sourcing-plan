#!/usr/bin/env bash
# Flash the merged T-Deck image at 0x0. This replaces whatever the T-Deck runs (Meshtastic, for example).
# Restore Meshtastic later from https://flasher.meshtastic.org (device "LILYGO T-Deck").
#
#   lab/wifi-analyzer/tdeck/flash.sh [image.bin]       default: build/tdeck-wifi-analyzer.bin
#
# If esptool cannot connect: power the T-Deck off, hold the trackball down, power on, release after 2-3 s
# (black screen, backlight off = download mode), then run this again. Press reset afterwards to start the app.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BIN="${1:-$HERE/build/tdeck-wifi-analyzer.bin}"
[ -f "$BIN" ] || { echo "No image at $BIN. Run build.sh first." >&2; exit 1; }
if [ -z "${PORT:-}" ]; then
  set -- /dev/cu.usbmodem*
  [ "$#" = 1 ] && [ -e "$1" ] || { echo "Set PORT: found $# usbmodem ports ($*)" >&2; exit 1; }
  PORT="$1"
fi
esptool --chip esp32s3 --port "$PORT" --baud "${BAUD:-921600}" write-flash 0x0 "$BIN"
