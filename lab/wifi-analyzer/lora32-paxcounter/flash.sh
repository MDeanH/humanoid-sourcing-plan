#!/usr/bin/env bash
# Flash a merged Paxcounter image to the LoRa32 at 0x0. This replaces whatever the board runs.
#
#   lab/wifi-analyzer/lora32-paxcounter/flash.sh <image.bin>
#
# Environment: PORT (default: the only /dev/cu.usbserial-* port), BAUD (default 460800; use 115200 if it fails).
# The board's USB bridge resets it into the bootloader by itself; no buttons needed.
set -euo pipefail
BIN="${1:?usage: flash.sh <image.bin>}"
[ -f "$BIN" ] || { echo "No file $BIN" >&2; exit 1; }
if [ -z "${PORT:-}" ]; then
  set -- /dev/cu.usbserial-*
  [ "$#" = 1 ] && [ -e "$1" ] || { echo "Set PORT: found $# usbserial ports ($*)" >&2; exit 1; }
  PORT="$1"
fi
esptool --chip esp32 --port "$PORT" --baud "${BAUD:-460800}" write-flash 0x0 "$BIN"
