#!/usr/bin/env bash
# Build the T-Deck Wi-Fi analyzer and merge it into one image that flashes at 0x0.
#
#   lab/wifi-analyzer/tdeck/build.sh        -> build/tdeck-wifi-analyzer.bin
#
# Fetches LilyGO's T-Deck repo (for its patched TFT_eSPI, which LilyGO did not upstream) into
# ~/robot-lab-build/lilygo-tdeck at the commit whose pins were checked, outside this repo.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LILYGO_DIR="${LILYGO_DIR:-$HOME/robot-lab-build/lilygo-tdeck}"
LILYGO_COMMIT=1dddf6e0d3aaa74cd4e10ba02938865b99682391   # 2026-09-29; pins checked against examples/UnitTest/utilities.h
command -v pio >/dev/null || { echo "PlatformIO not found. On a Mac: brew install platformio" >&2; exit 1; }
command -v esptool >/dev/null || { echo "esptool not found: python3 -m pip install esptool" >&2; exit 1; }

[ -d "$LILYGO_DIR/.git" ] || git clone -q https://github.com/Xinyuan-LilyGO/T-Deck.git "$LILYGO_DIR"
git -C "$LILYGO_DIR" fetch -q origin "$LILYGO_COMMIT" 2>/dev/null || true
git -C "$LILYGO_DIR" checkout -q "$LILYGO_COMMIT"
grep -q 'Setup210_LilyGo_T_Deck.h' "$LILYGO_DIR/lib/TFT_eSPI/User_Setup_Select.h" ||
  { echo "LilyGO's TFT_eSPI no longer selects the T-Deck setup" >&2; exit 1; }

# Only TFT_eSPI is taken from LilyGO's lib/ (the rest of that folder is not referenced).
export TDECK_LILYGO_LIB="$HERE/.pio/lilygo-lib"
mkdir -p "$TDECK_LILYGO_LIB"
rsync -a --delete "$LILYGO_DIR/lib/TFT_eSPI/" "$TDECK_LILYGO_LIB/TFT_eSPI/"

(cd "$HERE" && pio run -e tdeck)

B="$HERE/.pio/build/tdeck"
BOOT_APP0="$HOME/.platformio/packages/framework-arduinoespressif32/tools/partitions/boot_app0.bin"
mkdir -p "$HERE/build"
OUT="$HERE/build/tdeck-wifi-analyzer.bin"
# dio/80m in the image header, as LilyGO's own esptool line (firmware/README.MD); the app then runs in QIO.
esptool --chip esp32s3 merge-bin -o "$OUT" --flash-mode dio --flash-freq 80m --flash-size 16MB \
  0x0 "$B/bootloader.bin" 0x8000 "$B/partitions.bin" 0xe000 "$BOOT_APP0" 0x10000 "$B/firmware.bin"
echo "Built $OUT"
