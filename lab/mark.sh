#!/usr/bin/env bash
# Add a timestamped note to a run's log, so each phase of a test can be matched to the capture later.
#
#   lab/mark.sh <run-name> "what just happened"
#   lab/mark.sh a2-run01-boot "robot powered on"
#
# Notes go to ~/robot-lab-captures/<run-name>/runlog.tsv in UTC, the same clock the capture files use.
set -euo pipefail

RUN="${1:?usage: lab/mark.sh <run-name> \"note\"}"
shift
[ "$#" -gt 0 ] || { echo "usage: lab/mark.sh <run-name> \"note\"" >&2; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="${CAPTURE_DIR:-$HOME/robot-lab-captures}/$RUN"
mkdir -p "$DIR"
printf '%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$DIR/runlog.tsv"
echo "marked: $*"
