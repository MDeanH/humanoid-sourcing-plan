#!/usr/bin/env bash
# Log Wi-Fi link quality every second, so a dropout can be matched to where the robot was and what it was doing.
#
#   lab/linklog.sh <run-name>          example: lab/linklog.sh venue-run02-showhours
#
# What it reads depends on the machine:
#   Raspberry Pi running the lab hotspot (IFACE in AP mode): each joined device (robot, iPad) as the hotspot hears it:
#     signal, bitrate, inactive time, tx retries and tx failures (iw station dump).
#   Linux as a Wi-Fi client: this machine's own signal, channel and bitrate (iw link).
#   Mac as a Wi-Fi client: this Mac's signal, noise, channel and rate (sudo wdutil info). Untested on a Mac.
# All three only read counters the Wi-Fi driver already keeps. They send nothing.
#
# Environment (all optional):
#   IFACE     Wi-Fi interface              default: wlan0 on Linux, en0 on a Mac
#   INTERVAL  seconds between samples      default: 1 (the minimum)
#   PING      address to ping once per sample, for round-trip time and loss. Off by default because it sends
#             traffic (one small packet per sample). Point it only at our own robot or iPad.
#   CAPTURE_DIR  where runs are stored     default: ~/robot-lab-captures  (outside the repo on purpose)
#
# Output: ~/robot-lab-captures/<run-name>/linklog.tsv, one line per device per sample, tab-separated:
#   time UTC, kind (link|station|ping), device, signal dBm, noise dBm, channel, rate Mbit/s,
#   inactive ms, tx retries, tx failed, round trip ms ("lost" if no reply)
# Blank means not reported. Stop with Control-C; lab/survey-summary.sh then runs on the log.
set -euo pipefail

RUN="${1:?usage: lab/linklog.sh <run-name>   example: lab/linklog.sh venue-run02-showhours}"
if [ "$(uname)" = "Darwin" ]; then OS=mac; DEFAULT_IFACE=en0; else OS=linux; DEFAULT_IFACE=wlan0; fi
IFACE="${IFACE:-$DEFAULT_IFACE}"
INTERVAL="${INTERVAL:-1}"
PING="${PING:-}"
# sample times are whole seconds, and the summary counts samples by time, so samples must be at least a second apart
awk -v i="$INTERVAL" 'BEGIN { exit !(i + 0 >= 1) }' || { echo "INTERVAL must be 1 second or more" >&2; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="${CAPTURE_DIR:-$HOME/robot-lab-captures}/$RUN"
OUT="$DIR/linklog.tsv"

SUDO=""
[ "$(id -u)" -eq 0 ] || SUDO="sudo"

# Frequency in MHz to a channel name like 2g6, 5g36 or 6g37 (5 and 6 GHz reuse channel numbers).
CHAN='function chan(f) { f = int(f)
  if (f == 2484) return "2g14"
  if (f >= 2412 && f <= 2472) return "2g" (f - 2407) / 5
  if (f >= 5160 && f <= 5885) return "5g" (f - 5000) / 5
  if (f >= 5955 && f <= 7115) return "6g" (f - 5950) / 5
  return "" }'

link_linux() { # this machine as a client
  iw dev "$IFACE" link 2>/dev/null | awk -v t="$1" "$CHAN"'
    /^Not connected/ { down = 1 }
    /^Connected to/ { dev = $3 }
    $1 == "freq:" { ch = chan($2) }
    $1 == "signal:" { sig = $2 + 0 }
    $1 == "tx" && $2 == "bitrate:" { rate = $3 + 0 }
    END {
      if (dev != "") printf "%s\tlink\t%s\t%s\t\t%s\t%s\t\t\t\t\n", t, dev, sig, ch, rate
      else printf "%s\tlink\tnot-connected\t\t\t\t\t\t\t\t\n", t
    }'
}

stations_linux() { # each device joined to this machine's hotspot
  local ch
  ch=$(iw dev "$IFACE" info 2>/dev/null | awk "$CHAN"'$1 == "channel" { gsub(/[(]/, "", $3); print chan($3) }')
  iw dev "$IFACE" station dump 2>/dev/null | awk -v t="$1" -v ch="$ch" '
    function flush() {
      if (dev != "") printf "%s\tstation\t%s\t%s\t\t%s\t%s\t%s\t%s\t%s\t\n", t, dev, sig, ch, rate, inact, retr, fail
      dev = sig = rate = inact = retr = fail = ""
    }
    /^Station / { flush(); dev = $2; n++ }
    $1 == "inactive" && $2 == "time:" { inact = $3 + 0 }
    $1 == "tx" && $2 == "retries:" { retr = $3 + 0 }
    $1 == "tx" && $2 == "failed:" { fail = $3 + 0 }
    $1 == "signal:" { sig = $2 + 0 }
    $1 == "tx" && $2 == "bitrate:" { rate = $3 + 0 }
    END { flush(); if (!n) printf "%s\tstation\tnone\t\t\t%s\t\t\t\t\t\n", t, ch }'
}

link_mac() { # wdutil prints sections (NETWORK, WIFI, BLUETOOTH...) of "    Key : value" lines
  $SUDO wdutil info 2>/dev/null | awk -v t="$1" '
    /^[A-Z][A-Z ]*$/ { sec = $0; next }
    sec == "WIFI" && index($0, " : ") {
      k = substr($0, 1, index($0, " : ") - 1); gsub(/^[ \t]+|[ \t]+$/, "", k)
      v = substr($0, index($0, " : ") + 3); gsub(/^[ \t]+|[ \t]+$/, "", v)
      if (k == "Interface Name") ifn = v
      else if (k == "RSSI") sig = v + 0
      else if (k == "Noise") noise = v + 0
      else if (k == "Channel") ch = v
      else if (k == "Tx Rate") rate = v + 0
    }
    END {
      if (sig != "" && sig != 0) printf "%s\tlink\t%s\t%s\t%s\t%s\t%s\t\t\t\t\n", t, (ifn != "" ? ifn : "wifi"), sig, noise, ch, rate
      else printf "%s\tlink\tnot-connected\t\t\t\t\t\t\t\t\n", t
    }'
}

ping_once() {
  local out rtt
  if [ "$OS" = mac ]; then out=$(ping -n -c 1 -W 1000 "$PING" 2>/dev/null || true)   # macOS -W is milliseconds
  else out=$(ping -n -c 1 -W 1 "$PING" 2>/dev/null || true); fi                       # Linux -W is seconds
  rtt=$(printf '%s\n' "$out" | sed -n 's/.*time[=<]\([0-9.]*\) *ms.*/\1/p' | head -1)
  printf '%s\tping\t%s\t\t\t\t\t\t\t\t%s\n' "$1" "$PING" "${rtt:-lost}"
}

if [ "$OS" = mac ]; then
  SAMPLE=link_mac
  [ -z "$SUDO" ] || sudo -v   # ask for the password once, before the loop
else
  command -v iw >/dev/null 2>&1 || { echo "iw not found. On Raspberry Pi OS: sudo apt install -y iw" >&2; exit 1; }
  iw dev "$IFACE" info >/dev/null 2>&1 || { echo "Interface '$IFACE' not found. List them with: iw dev" >&2; exit 1; }
  if iw dev "$IFACE" info | grep -q 'type AP'; then SAMPLE=stations_linux; else SAMPLE=link_linux; fi
fi

mkdir -p "$DIR"
"$HERE/mark.sh" "$RUN" "linklog start iface=$IFACE mode=$SAMPLE interval=${INTERVAL}s ping=${PING:-off}"
trap '"$HERE/mark.sh" "$RUN" "linklog stop"; echo; "$HERE/survey-summary.sh" "$RUN" || true' EXIT
trap 'exit 0' INT TERM

echo "Logging $IFACE ($SAMPLE${PING:+, ping $PING}) into $OUT  (Control-C to stop)"
while :; do
  t=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  "$SAMPLE" "$t" >> "$OUT"
  [ -z "$PING" ] || ping_once "$t" >> "$OUT"
  sleep "$INTERVAL"
done
