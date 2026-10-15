#!/usr/bin/env bash
# Log every Wi-Fi network heard, every 30 seconds, to see how crowded each channel is at the booth.
#
#   lab/airscan.sh <run-name>          example: lab/airscan.sh venue-run01-loadin
#
# Linux only: a Raspberry Pi or a Linux laptop. On a Mac use Wireless Diagnostics' Scan window instead
# (macOS has had no supported command-line scanner since Sonoma 14.4).
#
# A scan sends probe requests, the same as any phone looking for Wi-Fi. It sends nothing to the robot and joins nothing.
# Do not scan on the interface that runs the lab hotspot: it may fail or disturb the hotspot. Use a second
# Wi-Fi adapter (IFACE=wlan1), or run this before the hotspot is up.
#
# Environment (all optional):
#   IFACE       Wi-Fi interface            default: wlan0
#   SCAN_EVERY  seconds between scans      default: 30
#   CAPTURE_DIR where runs are stored      default: ~/robot-lab-captures  (outside the repo on purpose)
#
# Output in ~/robot-lab-captures/<run-name>/, tab-separated:
#   airscan.tsv  time UTC, BSSID, channel, signal dBm, network name          one line per network per scan
#   survey.tsv   time UTC, channel, noise dBm, active ms, busy ms            the adapter's own channel-busy counters,
#                where the driver reports them (many report only the channel in use; some report none)
# Stop with Control-C; lab/survey-summary.sh then runs on the logs.
set -euo pipefail

RUN="${1:?usage: lab/airscan.sh <run-name>   example: lab/airscan.sh venue-run01-loadin}"
IFACE="${IFACE:-wlan0}"
SCAN_EVERY="${SCAN_EVERY:-30}"
awk -v i="$SCAN_EVERY" 'BEGIN { exit !(i + 0 >= 1) }' || { echo "SCAN_EVERY must be 1 second or more" >&2; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="${CAPTURE_DIR:-$HOME/robot-lab-captures}/$RUN"

[ "$(uname)" != "Darwin" ] || { echo "Linux only. On a Mac, Option-click the Wi-Fi icon, open Wireless Diagnostics, then Window > Scan." >&2; exit 1; }
command -v iw >/dev/null 2>&1 || { echo "iw not found. On Raspberry Pi OS: sudo apt install -y iw" >&2; exit 1; }
iw dev "$IFACE" info >/dev/null 2>&1 || { echo "Interface '$IFACE' not found. List them with: iw dev" >&2; exit 1; }
if iw dev "$IFACE" info | grep -q 'type AP'; then
  echo "$IFACE is running a hotspot. Scan with a second adapter instead: IFACE=wlan1 lab/airscan.sh $RUN" >&2; exit 1
fi

SUDO=""
[ "$(id -u)" -eq 0 ] || SUDO="sudo"

CHAN='function chan(f) { f = int(f)
  if (f == 2484) return "2g14"
  if (f >= 2412 && f <= 2472) return "2g" (f - 2407) / 5
  if (f >= 5160 && f <= 5885) return "5g" (f - 5000) / 5
  if (f >= 5955 && f <= 7115) return "6g" (f - 5950) / 5
  return "" }'

scan_once() {
  $SUDO iw dev "$IFACE" scan 2>/dev/null | awk -v t="$1" "$CHAN"'
    function flush() { if (b != "") printf "%s\t%s\t%s\t%s\t%s\n", t, b, chan(f), s, ssid; b = f = s = ssid = "" }
    /^BSS / { flush(); b = $2; sub(/\(.*/, "", b) }
    $1 == "freq:" { f = $2 }
    $1 == "signal:" { s = $2 + 0 }
    /^\tSSID: / { ssid = substr($0, 8); gsub(/\t/, " ", ssid) }
    END { flush() }'
}

survey_once() {
  iw dev "$IFACE" survey dump 2>/dev/null | awk -v t="$1" "$CHAN"'
    function flush() { if (f != "" && act != "") printf "%s\t%s\t%s\t%s\t%s\n", t, chan(f), nz, act, busy; f = nz = act = busy = "" }
    $1 == "frequency:" { flush(); f = $2 }
    $1 == "noise:" { nz = $2 + 0 }
    $1 == "channel" && $2 == "active" { act = $4 + 0 }
    $1 == "channel" && $2 == "busy" { busy = $4 + 0 }
    END { flush() }'
}

mkdir -p "$DIR"
[ -z "$SUDO" ] || sudo -v
"$HERE/mark.sh" "$RUN" "airscan start iface=$IFACE every=${SCAN_EVERY}s"
trap '"$HERE/mark.sh" "$RUN" "airscan stop"; echo; "$HERE/survey-summary.sh" "$RUN" || true' EXIT
trap 'exit 0' INT TERM

echo "Scanning on $IFACE every ${SCAN_EVERY}s into $DIR  (Control-C to stop)"
while :; do
  t=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  scan_once "$t" >> "$DIR/airscan.tsv"
  survey_once "$t" >> "$DIR/survey.tsv"
  echo "$t  $(awk -F'\t' -v t="$t" '$1 == t' "$DIR/airscan.tsv" | wc -l | tr -d ' ') networks heard"
  sleep "$SCAN_EVERY"
done
