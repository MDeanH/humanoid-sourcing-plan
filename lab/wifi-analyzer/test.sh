#!/usr/bin/env bash
# Every test that runs on a Mac: shared C++ logic, Swift formats, the dashboard (with its real server), the awk
# channel names in lab/linklog.sh, and lab/survey-summary.sh on sample logs of every format.
#
#   lab/wifi-analyzer/test.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LAB="$(cd "$HERE/.." && pwd)"
FIX="$HERE/testdata/channel-cases.tsv"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/wifi-analyzer-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

echo "== shared C++ logic (T-Deck, LoRa32 patch, watch)"
"$HERE/common/test/run.sh"

echo "== Mac formats (Swift)"
swiftc -O -swift-version 5 -o "$TMP/format-tests" "$HERE/mac/Sources/Format.swift" "$HERE/mac/Tests/main.swift"
"$TMP/format-tests" "$FIX"

echo "== dashboard (Python, real server on a free port)"
python3 -m unittest discover -s "$HERE/web" -p 'test_*.py' 2>&1 | tail -1

if [ -f "$HERE/pi5/test_pi5.py" ]; then
  echo "== Pi 5 parsers (Python)"
  python3 -m unittest discover -s "$HERE/pi5" -p 'test_*.py' 2>&1 | tail -1
fi

echo "== awk chan() in lab/linklog.sh agrees on every real channel"
CHAN="$(sed -n "/^CHAN='/,/return \"\" }'/p" "$LAB/linklog.sh" | sed "1s/^CHAN='//; \$s/'\$//")"
[ -n "$CHAN" ] || fail "could not read chan() from lab/linklog.sh"
awk -F'\t' "$CHAN"' !/^#/ && $4 != "-" { got = chan($3); if (got != $4) { print "awk chan(" $3 ") = " got ", want " $4; bad++ } n++ }
     END { if (bad) exit 1; print "  " n " channels agree" }' "$FIX" || fail "awk chan() disagrees"

echo "== lab/survey-summary.sh reads every format"
for s in mac tdeck pi5; do
  [ -d "$HERE/testdata/samples/$s" ] && [ -n "$(ls "$HERE/testdata/samples/$s")" ] || continue
  mkdir -p "$TMP/caps/sample-$s" && cp "$HERE/testdata/samples/$s/"* "$TMP/caps/sample-$s/"
  CAPTURE_DIR="$TMP/caps" "$LAB/survey-summary.sh" "sample-$s" > "$TMP/$s.out"
done
grep -q "link (this machine)" "$TMP/mac.out" || fail "Mac link lines not summarized"
grep -q "signal: worst -78 dBm" "$TMP/mac.out" || fail "Mac link signal"
grep -q "ping iphone" "$TMP/mac.out" || fail "iPhone probe not summarized"
grep -q "lost: 2 (50.0%), longest run of losses: 2 in a row from 2026-10-13T19:00:00.500Z" "$TMP/mac.out" || fail "iPhone losses"
grep -q "1 replies at 250 ms or more" "$TMP/mac.out" || fail "iPhone slow replies"
grep -q "Channels (.*), 2 scans" "$TMP/mac.out" || fail "Mac scan count"
grep -Eq "^6g37 +1 +0 +-80" "$TMP/mac.out" || fail "6 GHz channel row"
grep -Eq "^5g100 +1 +0 +-77 +- +- +DFS" "$TMP/mac.out" || fail "DFS flag"
grep -Eq "^9 +2026-10-13T19:44:00Z +near the robot AP +22.0 +0.0 +-78 +-71 +37 +poor" "$TMP/mac.out" || fail "map spot verdict (T-Deck -78 is poor)"
grep -Eq "^7 +.* far corner .* poor" "$TMP/mac.out" || fail "map spot 7"
grep -Eq "^2g11 +2 +2 +-54" "$TMP/tdeck.out" || fail "T-Deck uptime-stamped lines"
grep -q "Channels (.*), 2 scans" "$TMP/tdeck.out" || fail "T-Deck scan count"
grep -Eq "^5g36 +1 +1 +-71 +25 +-92" "$TMP/pi5.out" || fail "Pi 5 lines with channel-busy share from survey.tsv"
grep -q "Channels (.*), 2 scans" "$TMP/pi5.out" || fail "Pi 5 scan count"
echo "  survey-summary.sh read the Mac, iPhone, T-Deck and Pi 5 samples correctly"
echo "All tests passed."
