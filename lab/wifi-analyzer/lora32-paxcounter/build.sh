#!/usr/bin/env bash
# Build ESP32-Paxcounter for the LilyGO TTGO LoRa32 T3 V1.6.1 (ESP32-PICO-D4, SX1276), set up to listen only:
# LoRaWAN off (the radio is never configured, so it never transmits), OTA and its Wi-Fi join off, BLE counter off.
# Output: one merged image that flashes at 0x0 (the ESP32 bootloader sits at 0x1000; merge-bin pads the start with 0xFF) with lab/wifi-analyzer/lora32-paxcounter/flash.sh.
#
#   lab/wifi-analyzer/lora32-paxcounter/build.sh
#
# Environment (all optional):
#   BUILD_DIR    where Paxcounter is cloned and built     default: ~/robot-lab-build/paxcounter  (outside the repo)
#   DEBUG_LEVEL  0..5. Upstream: "For production run set to 0, otherwise device will leak RAM while running!"
#                Counts appear on the serial port only at 4 (debug). Default: 0.
#   PAX_COMMIT   Paxcounter commit to build             default: the one tested here
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="${BUILD_DIR:-$HOME/robot-lab-build/paxcounter}"
DEBUG_LEVEL="${DEBUG_LEVEL:-0}"
PAX_COMMIT="${PAX_COMMIT:-92784ccc02eb441acaba4020c4527ec71296f748}"   # v3.8.0-12, 2026-10-04
SRC="$BUILD_DIR/src"
case "$DEBUG_LEVEL" in [0-5]) ;; *) echo "DEBUG_LEVEL must be 0..5" >&2; exit 1 ;; esac
command -v pio >/dev/null || { echo "PlatformIO not found. On a Mac: brew install platformio" >&2; exit 1; }

mkdir -p "$BUILD_DIR"
[ -d "$SRC/.git" ] || git clone -q https://github.com/cyberman54/ESP32-Paxcounter.git "$SRC"
git -C "$SRC" fetch -q origin "$PAX_COMMIT" 2>/dev/null || true
git -C "$SRC" checkout -q --force "$PAX_COMMIT"
git -C "$SRC" clean -q -fdx -e .pio    # drop earlier edits, keep the toolchain cache

# Paxcounter's build script needs these; the samples hold placeholders only, no keys.
cp "$SRC/shared/loraconf_sample.h" "$SRC/shared/loraconf.h"
cp "$SRC/shared/ota_sample.conf" "$SRC/shared/ota.conf"
cp "$HERE/robotlab_t3v161.h" "$SRC/shared/hal/robotlab_t3v161.h"

# Settings. Each edit must match exactly once, so an upstream change fails the build instead of passing silently.
edit() { # file, sed expression, pattern that must then be present
  sed -i.bak -E "$2" "$1" && rm -f "$1.bak"
  grep -qE "$3" "$1" || { echo "edit failed in $1: $2" >&2; exit 1; }
}
cp "$SRC/shared/paxcounter_orig.conf" "$SRC/shared/paxcounter.conf"
CONF="$SRC/shared/paxcounter.conf"
edit "$CONF" 's/^(#define USE_OTA[[:space:]]+)1/\10/' '^#define USE_OTA[[:space:]]+0'
edit "$CONF" 's/^(#define TIME_SYNC_LORAWAN[[:space:]]+)1/\10/' '^#define TIME_SYNC_LORAWAN[[:space:]]+0'
edit "$CONF" 's/^(#define BLECOUNTER[[:space:]]+)[01]/\10/' '^#define BLECOUNTER[[:space:]]+0'
edit "$CONF" 's/^(#define WIFICOUNTER[[:space:]]+)[01]/\11/' '^#define WIFICOUNTER[[:space:]]+1'
edit "$CONF" 's/^(#define BOOTMENU[[:space:]]+)[01]/\10/' '^#define BOOTMENU[[:space:]]+0'
edit "$CONF" 's|^(#define TIME_SYNC_TIMEZONE[[:space:]]+)"[^"]*"|\1"EST5EDT,M3.2.0,M11.1.0"|' 'EST5EDT'

# Group link: broadcast the count in a BLE advert for the T-Deck and the watch (groupbeacon.cpp).
cp "$HERE/groupbeacon.cpp" "$SRC/src/groupbeacon.cpp"
cp "$HERE/groupbeacon.h" "$SRC/include/groupbeacon.h"
cp "$HERE/../common/wifilogic/src/groupframe.h" "$SRC/include/groupframe.h"
insert_after() { # file, exact line to find (must occur once), text to insert after it
  local n
  n=$(grep -cxF "$2" "$1" || true)
  [ "$n" = 1 ] || { echo "expected one line '$2' in $1, found $n" >&2; exit 1; }
  awk -v key="$2" -v add="$3" '{ print } $0 == key { print add }' "$1" > "$1.new" && mv "$1.new" "$1"
}
insert_after "$SRC/src/senddata.cpp" '#include "senddata.h"' '#include "groupbeacon.h"'
insert_after "$SRC/src/senddata.cpp" '           count.wifi_count, count.ble_count);' '  groupbeacon_update(count.wifi_count);'
insert_after "$SRC/src/main.cpp" '    init_libpax();' '    groupbeacon_init();'
grep -q '^#include "groupbeacon.h"' "$SRC/include/main.h" 2>/dev/null || \
  insert_after "$SRC/src/main.cpp" '#include "main.h"' '#include "groupbeacon.h"'

cp "$SRC/platformio_orig.ini" "$SRC/platformio.ini"
INI="$SRC/platformio.ini"
edit "$INI" 's/^halfile = ttgov21new\.h/halfile = robotlab_t3v161.h/' '^halfile = robotlab_t3v161\.h'
edit "$INI" "s/^debug_level = [0-9]/debug_level = $DEBUG_LEVEL/" "^debug_level = $DEBUG_LEVEL"
[ "$(grep -c '^halfile = ' "$INI")" = 1 ] || { echo "more than one board selected in $INI" >&2; exit 1; }

(cd "$SRC" && pio run -e usb)

B="$SRC/.pio/build/usb"
FW_DIR="$HOME/.platformio/packages/framework-arduinoespressif32"
BOOT_APP0="$FW_DIR/tools/partitions/boot_app0.bin"
[ -f "$BOOT_APP0" ] || { echo "boot_app0.bin not found under $FW_DIR" >&2; exit 1; }
OUT="$BUILD_DIR/paxcounter-t3v161-listen-debug$DEBUG_LEVEL.bin"
esptool --chip esp32 merge-bin -o "$OUT" --flash-mode dio --flash-freq 40m --flash-size 4MB \
  0x1000 "$B/bootloader.bin" 0x8000 "$B/partitions.bin" 0xe000 "$BOOT_APP0" 0x10000 "$(ls "$B"/firmware_*.bin | head -1)"
echo "Built $OUT"
echo "Flash with: lab/wifi-analyzer/lora32-paxcounter/flash.sh $OUT"
