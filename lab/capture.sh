#!/usr/bin/env bash
# Passive capture of the robot's traffic on the Mac mini's Internet Sharing network.
#
#   lab/capture.sh <run-name>          example: lab/capture.sh a2-run01-boot
#
# Environment (all optional):
#   IFACE   interface to listen on        default: bridge100 on a Mac (the Internet Sharing hotspot), wlan0 on a Raspberry Pi
#   SNAP    bytes kept per packet         default: 512        (headers plus the start of the payload: enough for
#                                                              DNS names and TLS server names. Use 96 for headers only.)
#   ROTATE  seconds per capture file      default: 600
#   CAPTURE_DIR  where runs are stored     default: ~/robot-lab-captures  (outside the repo on purpose, so captures cannot be committed or deployed)
#
# It only listens. It sends nothing and changes no firewall rules. Stop it with Control-C.
set -euo pipefail

RUN="${1:?usage: lab/capture.sh <run-name>   example: lab/capture.sh a2-run01-boot}"
if [ "$(uname)" = "Darwin" ]; then DEFAULT_IFACE="bridge100"; else DEFAULT_IFACE="wlan0"; fi
IFACE="${IFACE:-$DEFAULT_IFACE}"
SNAP="${SNAP:-512}"
ROTATE="${ROTATE:-600}"
HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="${CAPTURE_DIR:-$HOME/robot-lab-captures}/$RUN"

SUDO=""
[ "$(id -u)" -eq 0 ] || SUDO="sudo"

# tcpdump -D lists the interfaces it can open, one per line like "3.bridge100 [Up, Running]"
if ! $SUDO tcpdump -D 2>/dev/null | grep -qE "^[0-9]+\.${IFACE}( |\[|$)"; then
  echo "Interface '$IFACE' not found." >&2
  echo "Turn on Internet Sharing and join a device to your hotspot first, then check: sudo tcpdump -D" >&2
  exit 1
fi

mkdir -p "$DIR"
"$HERE/mark.sh" "$RUN" "capture start iface=$IFACE snaplen=$SNAP rotate=${ROTATE}s"
trap '"$HERE/mark.sh" "$RUN" "capture stop"; echo; echo "Saved in $DIR"' EXIT

echo "Capturing on $IFACE into $DIR  (Control-C to stop)"
# -n: no name lookups (the capture must not generate traffic of its own)
# -G/-w: start a new file every ROTATE seconds, named with the start time
# -Z: after opening the interface, drop root so the files belong to you
$SUDO tcpdump -i "$IFACE" -n -s "$SNAP" -G "$ROTATE" -w "$DIR/${RUN}-%Y%m%dT%H%M%S.pcap" -Z "${USER:-root}"
