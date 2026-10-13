#!/usr/bin/env bash
# Build and run the native tests for the shared ESP32 logic.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${TMPDIR:-/tmp}/wifi-analyzer-common-test"
c++ -std=c++17 -Wall -Wextra -Werror -o "$OUT" "$HERE/test_common.cpp"
"$OUT" "$HERE/../../testdata/channel-cases.tsv"
