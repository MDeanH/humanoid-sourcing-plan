#!/usr/bin/env bash
# Build the watch firmware with arduino-cli, the toolchain nori_watch_control was verified with
# (esp32 core 3.3.10, GFX Library for Arduino 1.6.6), and merge one image that flashes at 0x0.
#
#   lab/wifi-analyzer/watch/build.sh      -> build/watch-wifi-analyzer.bin
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
FQBN="esp32:esp32:esp32s3:CDCOnBoot=cdc,PSRAM=opi,PartitionScheme=huge_app"
command -v arduino-cli >/dev/null || { echo "arduino-cli not found: brew install arduino-cli" >&2; exit 1; }
arduino-cli core list | grep -q '^esp32:esp32 *3\.3\.10' || echo "warning: tested with esp32:esp32 3.3.10" >&2
arduino-cli lib list | grep -q 'GFX Library for Arduino *1\.6\.6' || echo "warning: tested with GFX Library for Arduino 1.6.6" >&2
mkdir -p "$HERE/build"
# arduino-cli's bundled ctags is an Intel binary. On Apple silicon without Rosetta, point it at a native
# universal-ctags (brew install universal-ctags) for this build only. The sketch keeps its code in a .cpp file,
# so ctags has no prototypes to produce and the two ctags flavours give the same result.
CTAGS_ARGS=()
if ! arch -x86_64 /usr/bin/true 2>/dev/null && [ -x /opt/homebrew/bin/ctags ]; then
  CT="$HOME/robot-lab-build/ctags-arm64"
  mkdir -p "$CT" && ln -sf /opt/homebrew/bin/ctags "$CT/ctags"
  CTAGS_ARGS=(--build-property "runtime.tools.ctags.path=$CT" --build-property "tools.ctags.path=$CT")
fi
arduino-cli compile --fqbn "$FQBN" --library "$HERE/../common/wifilogic" --output-dir "$HERE/build/out" \
  ${CTAGS_ARGS[@]+"${CTAGS_ARGS[@]}"} "$HERE"
CORE="$(ls -d "$HOME/Library/Arduino15/packages/esp32/hardware/esp32/"* | tail -1)"
O="$HERE/build/out"
esptool --chip esp32s3 merge-bin -o "$HERE/build/watch-wifi-analyzer.bin" --flash-mode dio --flash-freq 80m --flash-size keep \
  0x0 "$O/watch.ino.bootloader.bin" 0x8000 "$O/watch.ino.partitions.bin" \
  0xe000 "$CORE/tools/partitions/boot_app0.bin" 0x10000 "$O/watch.ino.bin"
echo "Built $HERE/build/watch-wifi-analyzer.bin"
