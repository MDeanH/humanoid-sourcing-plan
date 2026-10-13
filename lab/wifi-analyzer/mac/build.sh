#!/usr/bin/env bash
# Build WiFiAnalyzer.app with swiftc (no Xcode project) and run the logic tests.
#
#   lab/wifi-analyzer/mac/build.sh          -> build/WiFiAnalyzer.app
#
# Signing: ad hoc by default. macOS remembers the Location Services answer per signature, and an ad-hoc signature
# changes with every build, so after a rebuild macOS asks once more. To keep the answer across builds, sign with a
# stable identity: SIGN_ID=<sha1 from `security find-identity -v -p codesigning`> build.sh. (Picking one
# automatically made macOS ask for the password of the locked keychain holding it, 2026-10-13, so it is opt-in.)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/build"
APP="$OUT/WiFiAnalyzer.app"
mkdir -p "$OUT"

# Pure logic first: Format.swift with its tests, no CoreWLAN.
swiftc -O -swift-version 5 -o "$OUT/format-tests" "$HERE/Sources/Format.swift" "$HERE/Tests/main.swift"
"$OUT/format-tests" "$HERE/../testdata/channel-cases.tsv"

mkdir -p "$APP/Contents/MacOS"
cp "$HERE/Info.plist" "$APP/Contents/Info.plist"
swiftc -O -swift-version 5 -framework CoreWLAN -framework CoreLocation -framework AppKit \
  -o "$APP/Contents/MacOS/WiFiAnalyzer" "$HERE/Sources/Format.swift" "$HERE/Sources/main.swift"

# Register with LaunchServices so locationd knows it as an app (otherwise it logs "Launch Services does not
# know the client as a plugin or app" and never shows the prompt).
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
ID="${SIGN_ID:-}"
if [ -n "$ID" ] && codesign --force --sign "$ID" "$APP" 2>/dev/null; then
  echo "Built $APP (signed $ID)"
else
  # errSecInternalComponent means the keychain would not hand over the key (locked, or no GUI session).
  codesign --force --sign - "$APP"
  echo "Built $APP (signed ad hoc${ID:+; signing with $ID failed})"
fi
[ -x "$LSREGISTER" ] && "$LSREGISTER" -f "$APP"
