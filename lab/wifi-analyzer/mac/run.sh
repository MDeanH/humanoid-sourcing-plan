#!/usr/bin/env bash
# Start the Mac analyzer through LaunchServices, so macOS treats it as its own app for Location Services
# (a binary run straight from a shell is judged by the shell's permission, and names stay hidden).
#
#   lab/wifi-analyzer/mac/run.sh <run-name> [--seconds N]
#
# Logs go to ~/robot-lab-captures/<run-name>/: airscan.tsv, linklog.tsv, runlog.tsv. Quit with Command-Q.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RUN="${1:?usage: lab/wifi-analyzer/mac/run.sh <run-name> [--seconds N]}"
shift
APP="$HERE/build/WiFiAnalyzer.app"
[ -d "$APP" ] || "$HERE/build.sh"
DIR="${CAPTURE_DIR:-$HOME/robot-lab-captures}/$RUN"
mkdir -p "$DIR"
# -W waits until the app quits; -n starts a fresh instance; stdout goes to the run folder.
open -W -n "$APP" --stdout "$DIR/mac-app.log" --stderr "$DIR/mac-app.log" --args --run "$RUN" "$@"
echo "Done. Logs in $DIR"
