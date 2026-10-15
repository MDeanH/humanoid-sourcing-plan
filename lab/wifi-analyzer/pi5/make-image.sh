#!/usr/bin/env bash
# Build a ready-to-flash Raspberry Pi 5 image: Raspberry Pi OS Lite (64-bit) with the Wi-Fi analyzer installed.
#
#   lab/wifi-analyzer/pi5/make-image.sh        -> lab/wifi-analyzer/pi5/build/wifi-analyzer-pi5.img
#
# Then flash it with Raspberry Pi Imager: Choose OS > Use custom > this .img. In Imager's OS customisation set the
# hostname (wifi-lab), your user and password or SSH key, and the Wi-Fi country, and leave the Wi-Fi network empty
# so the Pi only listens. Nothing here creates a user or stores a password.
#
# Works on a Mac without mounting anything: the root file system is edited with debugfs, the boot partition with
# mtools. Needs python3, curl, debugfs and e2fsck (brew install e2fsprogs), mcopy and mdir (brew install mtools).
# The base image and packages are cached in ~/robot-lab-build/pi5, outside the repo.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$(cd "$HERE/.." && pwd)"
WORK="${WORK:-$HOME/robot-lab-build/pi5}"
OUT="$HERE/build/wifi-analyzer-pi5.img"
BASE_NAME=2026-10-06-raspios-trixie-arm64-lite
BASE_URL="https://downloads.raspberrypi.com/raspios_lite_arm64/images/raspios_lite_arm64-2026-10-06/$BASE_NAME.img.xz"
E2=/opt/homebrew/opt/e2fsprogs/sbin
DEBUGFS="$(command -v debugfs || echo "$E2/debugfs")"
E2FSCK="$(command -v e2fsck || echo "$E2/e2fsck")"
IMG="python3 $HERE/imgtool.py"
for t in "$DEBUGFS" "$E2FSCK"; do [ -x "$t" ] || { echo "missing $t: brew install e2fsprogs" >&2; exit 1; }; done
command -v mcopy >/dev/null || { echo "missing mcopy: brew install mtools" >&2; exit 1; }
mkdir -p "$WORK" "$HERE/build"

echo "== base image: $BASE_NAME"
if [ ! -f "$WORK/$BASE_NAME.img" ]; then
  [ -f "$WORK/$BASE_NAME.img.xz" ] || curl -fL -o "$WORK/$BASE_NAME.img.xz" "$BASE_URL"
  curl -fsSL -o "$WORK/$BASE_NAME.img.xz.sha256" "$BASE_URL.sha256"
  (cd "$WORK" && shasum -a 256 -c "$BASE_NAME.img.xz.sha256")
  $IMG xz "$WORK/$BASE_NAME.img.xz" "$WORK/$BASE_NAME.img"
fi
cp "$WORK/$BASE_NAME.img" "$OUT"

read -r BOOT_N _ BOOT_OFF _ < <($IMG parts "$OUT" | awk '$2 == "0c" || $2 == "0b" { print; exit }')
read -r ROOT_N _ ROOT_OFF _ < <($IMG parts "$OUT" | awk '$2 == "83" { print; exit }')
[ -n "${BOOT_N:-}" ] && [ -n "${ROOT_N:-}" ] || { echo "unexpected partition table" >&2; $IMG parts "$OUT" >&2; exit 1; }
ROOT="$WORK/root.ext4"
$IMG extract "$OUT" "$ROOT_N" "$ROOT"

echo "== packages for iPhone USB tethering (usbmuxd)"
"$DEBUGFS" -R "cat /var/lib/dpkg/status" "$ROOT" > "$WORK/dpkg-status" 2>/dev/null
CODENAME="$("$DEBUGFS" -R "cat /usr/lib/os-release" "$ROOT" 2>/dev/null | sed -n 's/^VERSION_CODENAME=//p')"   # /etc/os-release is a symlink
[ -n "$CODENAME" ] || { echo "could not read the release name from the image" >&2; exit 1; }
DEBS="$WORK/debs-$CODENAME"
mkdir -p "$DEBS"
if grep -qx 'Package: usbmuxd' "$WORK/dpkg-status"; then
  echo "usbmuxd is already in the image"
  NEED=""
else
  # the same two archives as the image's /etc/apt/sources.list.d (Raspberry Pi first, then Debian)
  BASES=("http://archive.raspberrypi.com/debian/" "https://deb.debian.org/debian/")
  EXTS=(gz xz)
  IDX=()
  for i in 0 1; do
    curl -fsSL -o "$WORK/Packages-$CODENAME-$i.${EXTS[$i]}" "${BASES[$i]}dists/$CODENAME/main/binary-arm64/Packages.${EXTS[$i]}"
    IDX+=("$WORK/Packages-$CODENAME-$i.${EXTS[$i]}")
  done
  NEED="$($IMG needs "$WORK/dpkg-status" "${IDX[@]}" -- usbmuxd)"
  while read -r file sum idx; do
    [ -n "$file" ] || continue
    deb="$DEBS/$(basename "$file")"
    [ -f "$deb" ] || curl -fsSL -o "$deb" "${BASES[$idx]}$file"
    got="$(shasum -a 256 "$deb" | cut -d' ' -f1)"
    [ "$sum" = "-" ] || [ "$got" = "$sum" ] || { echo "checksum mismatch for $deb" >&2; exit 1; }
    echo "  $(basename "$file")"
  done <<< "$NEED"
fi

echo "== installing the analyzer into the root file system"
CMDS="$WORK/debugfs-cmds"
put() { # local file, path in the image, mode
  printf 'write %s %s\nsif %s mode 0%s\nsif %s uid 0\nsif %s gid 0\n' "$1" "$2" "$2" "$3" "$2" "$2" >> "$CMDS"
}
: > "$CMDS"
for d in /opt/wifi-analyzer /opt/wifi-analyzer/web /opt/wifi-analyzer/web/static /opt/wifi-analyzer/pi5 /opt/wifi-analyzer/debs; do
  printf 'mkdir %s\nsif %s uid 0\nsif %s gid 0\n' "$d" "$d" "$d" >> "$CMDS"
done
put "$SRC/web/analyzer.py" /opt/wifi-analyzer/web/analyzer.py 100644
put "$SRC/web/server.py" /opt/wifi-analyzer/web/server.py 100644
for f in "$SRC"/web/static/*; do put "$f" "/opt/wifi-analyzer/web/static/$(basename "$f")" 100644; done
put "$HERE/wifi_scan.py" /opt/wifi-analyzer/pi5/wifi_scan.py 100755
put "$HERE/group_listen.py" /opt/wifi-analyzer/pi5/group_listen.py 100755
put "$HERE/rootfs/etc/NetworkManager/conf.d/90-wifi-analyzer.conf" /etc/NetworkManager/conf.d/90-wifi-analyzer.conf 100644
for u in "$HERE"/rootfs/etc/systemd/system/*.service; do
  n="$(basename "$u")"
  put "$u" "/etc/systemd/system/$n" 100644
  printf 'symlink /etc/systemd/system/multi-user.target.wants/%s /etc/systemd/system/%s\n' "$n" "$n" >> "$CMDS"
done
if [ -n "$NEED" ]; then
  while read -r file _ _; do
    [ -n "$file" ] && put "$DEBS/$(basename "$file")" "/opt/wifi-analyzer/debs/$(basename "$file")" 100644
  done <<< "$NEED"
fi
"$DEBUGFS" -w -f "$CMDS" "$ROOT" > "$WORK/debugfs.log" 2>&1
if grep -iE "error|not found|could not|failed" "$WORK/debugfs.log" | grep -v "^debugfs [0-9]"; then
  echo "debugfs reported problems (see $WORK/debugfs.log)" >&2; exit 1
fi
"$E2FSCK" -fn "$ROOT" > "$WORK/e2fsck.log" 2>&1 || { cat "$WORK/e2fsck.log" >&2; echo "file system check failed" >&2; exit 1; }
$IMG inject "$OUT" "$ROOT_N" "$ROOT"

echo "== settings on the boot partition"
mcopy -o -i "$OUT@@$BOOT_OFF" "$HERE/boot/wifi-analyzer.conf" ::/wifi-analyzer.conf

echo "== checking the result"
$IMG extract "$OUT" "$ROOT_N" "$ROOT"
for p in /opt/wifi-analyzer/pi5/wifi_scan.py /opt/wifi-analyzer/web/server.py /etc/systemd/system/wifi-analyzer-scan.service \
         /etc/systemd/system/multi-user.target.wants/wifi-analyzer-web.service /etc/NetworkManager/conf.d/90-wifi-analyzer.conf; do
  "$DEBUGFS" -R "stat $p" "$ROOT" 2>/dev/null | grep -q "Type:" || { echo "missing in image: $p" >&2; exit 1; }
done
"$DEBUGFS" -R "cat /opt/wifi-analyzer/pi5/wifi_scan.py" "$ROOT" 2>/dev/null | cmp -s - "$HERE/wifi_scan.py" || { echo "wifi_scan.py differs in the image" >&2; exit 1; }
mdir -i "$OUT@@$BOOT_OFF" ::/wifi-analyzer.conf > /dev/null
echo "Built $OUT ($(du -h "$OUT" | cut -f1)), sha256 $(shasum -a 256 "$OUT" | cut -c1-16)…"
echo "Flash with Raspberry Pi Imager (Use custom). Set hostname wifi-lab, your user and SSH key; leave Wi-Fi empty."
