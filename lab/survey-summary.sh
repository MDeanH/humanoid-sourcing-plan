#!/usr/bin/env bash
# Summarize a venue survey run: link quality from linklog.tsv and iphone-probe.tsv, channel crowding from airscan.tsv
# and survey.tsv.
#
#   lab/survey-summary.sh <run-name>
#
# lab/linklog.sh and lab/airscan.sh run this when you stop them. Run it by hand to re-read a run.
#
# Environment (optional):
#   OURS         our own network name, flagged in the channel table      example: OURS=A2-LAB
#   CAPTURE_DIR  where runs are stored                                    default: ~/robot-lab-captures
#
# iphone-probe.tsv is the phone's link test from lab/wifi-analyzer/web/server.py, in linklog.tsv's ping format;
# map-points.tsv is that dashboard's walk-and-tap location map.
#
# Output in ~/robot-lab-captures/<run-name>/summary/:
#   link.txt       per device: samples, losses and the longest outage with its start time, signal spread
#   channels.tsv   per channel: networks heard, how many at -75 dBm or stronger, the strongest, busy share, noise
#   map.tsv        per tapped spot: phone round trip and losses, T-Deck and scanner signal, crowd, worst grade
# Rough guide (sources in lab/venue-dropouts.md): signal at -67 dBm or better is good and below -75 dBm is poor;
# round trip under 50 ms is responsive and 250 ms or more is poor.
set -euo pipefail

RUN="${1:?usage: lab/survey-summary.sh <run-name>}"
DIR="${CAPTURE_DIR:-$HOME/robot-lab-captures}/$RUN"
OUT="$DIR/summary"
OURS="${OURS:-}"
[ -d "$DIR" ] || { echo "No run at $DIR" >&2; exit 1; }
mkdir -p "$OUT"

LINKS=()
[ -s "$DIR/linklog.tsv" ] && LINKS+=("$DIR/linklog.tsv")
[ -s "$DIR/iphone-probe.tsv" ] && LINKS+=("$DIR/iphone-probe.tsv")
if [ "${#LINKS[@]}" -gt 0 ]; then
  awk -F'\t' '
    function seen(k) { if (!(k in order)) { order[k] = ++nk; keys[nk] = k } }
    function sig(k, v) {
      if (v == "") return
      v += 0; sn[k]++; ss[k] += v
      if (!(k in smin) || v < smin[k]) smin[k] = v
      if (!(k in smax) || v > smax[k]) smax[k] = v
      if (v < -67) s67[k]++
      if (v < -75) s75[k]++
    }
    function outage(k, t, isdown) { # longest run of bad samples and when it started
      if (!isdown) { run[k] = 0; return }
      if (!run[k]) runat[k] = t
      run[k]++
      if (run[k] > mx[k]) { mx[k] = run[k]; mxat[k] = runat[k] }
    }
    function counter(store, k, v) { # a driver counter; a drop means it reset, e.g. after a reconnect
      if (v == "") return
      v += 0
      if ((store SUBSEP k) in last) tot[store, k] += (v >= last[store, k] ? v - last[store, k] : v)
      last[store, k] = v
    }
    $2 == "ping" {
      k = "ping " $3; seen(k); n[k]++
      outage(k, $1, $11 == "lost")
      if ($11 == "lost") lost[k]++
      else { r = $11 + 0; rs[k] += r; rn[k]++; if (r > rmax[k]) rmax[k] = r; if (r >= 250) slow[k]++ }
      next
    }
    $2 == "link" {
      k = "link (this machine)"; seen(k); n[k]++
      outage(k, $1, $3 == "not-connected")
      if ($3 == "not-connected") down[k]++
      else sig(k, $4)
      next
    }
    $2 == "station" {
      if (!($1 in stt)) { stt[$1] = 1; nst++ }
      if ($3 == "none") next
      k = "station " $3; seen(k); n[k]++; sig(k, $4)
      if ($8 != "" && $8 + 0 > imax[k]) { imax[k] = $8 + 0; imaxat[k] = $1 }
      counter("r", k, $9); counter("f", k, $10)
    }
    END {
      if (!nk) print "No samples."
      for (i = 1; i <= nk; i++) {
        k = keys[i]; print k
        if (k ~ /^station /) printf "  present in %d of %d samples\n", n[k], nst
        else printf "  samples: %d\n", n[k]
        if (k ~ /^ping /) {
          printf "  lost: %d (%.1f%%)", lost[k], 100 * lost[k] / n[k]
          if (mx[k]) printf ", longest run of losses: %d in a row from %s", mx[k], mxat[k]
          printf "\n"
          if (rn[k]) printf "  round trip: average %.1f ms, worst %.1f ms, %d replies at 250 ms or more\n", rs[k] / rn[k], rmax[k], slow[k]
        }
        if (k ~ /^link /) {
          printf "  not connected: %d samples", down[k]
          if (mx[k]) printf ", longest %d in a row from %s", mx[k], mxat[k]
          printf "\n"
        }
        if (sn[k]) printf "  signal: worst %d dBm, average %.0f dBm, best %d dBm; below -67: %.0f%%, below -75: %.0f%%\n", smin[k], ss[k] / sn[k], smax[k], 100 * s67[k] / sn[k], 100 * s75[k] / sn[k]
        if (k in imaxat) printf "  longest silence the hotspot heard (inactive time): %d ms at %s\n", imax[k], imaxat[k]
        if (("r" SUBSEP k) in last) printf "  tx retries during run: %d, tx failed: %d\n", tot["r", k], tot["f", k]
      }
    }' "${LINKS[@]}" > "$OUT/link.txt"
  echo "Link quality ($OUT/link.txt):"
  cat "$OUT/link.txt"
fi

if [ -s "$DIR/airscan.tsv" ] || [ -s "$DIR/survey.tsv" ]; then
  [ -s "$DIR/survey.tsv" ] && SV="$DIR/survey.tsv" || SV=/dev/null
  [ -s "$DIR/airscan.tsv" ] && AS="$DIR/airscan.tsv" || AS=/dev/null
  awk -F'\t' -v OFS='\t' -v ours="$OURS" -v sv="$SV" '
    function add(c) { if (c != "" && !(c in chans)) { chans[c] = 1; top[c] = -999 } }
    FILENAME == sv {   # time, channel, noise, active ms, busy ms
      c = $2; add(c); noise[c] = $3
      a = $4 + 0; b = $5 + 0
      if (c in pa && a >= pa[c]) { act[c] += a - pa[c]; busy[c] += b - pb[c] } else { act[c] += a; busy[c] += b }
      pa[c] = a; pb[c] = b
      next
    }
    {                  # time, BSSID, channel, signal, name
      c = $3; if (c == "") next
      add(c); scans[$1] = 1
      k = $2 "|" c
      if (!(k in best) || $4 + 0 > best[k]) best[k] = $4 + 0
      if (ours != "" && $5 == ours) mine[c] = 1
    }
    END {
      # channels that do not overlap on 2.4 GHz, and the 5 GHz channels outside the US radar (DFS) range,
      # listed even when nothing was heard on them: an empty channel is the finding we want
      split("2g1 2g6 2g11 5g36 5g40 5g44 5g48 5g149 5g153 5g157 5g161 5g165", base, " ")
      for (i in base) add(base[i])
      for (k in best) {
        split(k, p, "|"); c = p[2]; nb[c]++
        if (best[k] >= -75) strong[c]++
        if (best[k] > top[c]) top[c] = best[k]
      }
      for (c in chans) {
        num = substr(c, 3) + 0
        dfs = (c ~ /^5g/ && num >= 52 && num <= 144) ? "DFS" : ""
        pct = (act[c] > 0) ? sprintf("%.0f", 100 * busy[c] / act[c]) : ""
        print substr(c, 1, 1), num, c, nb[c] + 0, strong[c] + 0, (top[c] > -999 ? top[c] : ""), pct, noise[c], dfs, (c in mine ? "ours" : "")
      }
    }' "$SV" "$AS" | sort -t "$(printf '\t')" -k1,1n -k2,2n | cut -f3- > "$OUT/channels.body"
  { printf 'channel\tnetworks\tat -75 or stronger\tstrongest dBm\tbusy %%\tnoise dBm\tradar rule\tours\n'; cat "$OUT/channels.body"; } > "$OUT/channels.tsv"
  rm -f "$OUT/channels.body"
  echo
  echo "Channels ($OUT/channels.tsv), $(cut -f1 "$AS" | sort -u | wc -l | tr -d ' ') scans:"
  # pad columns for reading; blank cells show as "-"
  awk -F'\t' '{ for (i = 1; i <= NF; i++) { v[NR, i] = ($i == "" ? "-" : $i); if (length(v[NR, i]) > w[i]) w[i] = length(v[NR, i]) }
                if (NF > nf) nf = NF }
              END { for (r = 1; r <= NR; r++) { for (i = 1; i <= nf; i++) printf("%-" w[i] "s  ", v[r, i]); printf "\n" } }' "$OUT/channels.tsv"
fi

if [ -s "$DIR/map-points.tsv" ]; then   # time, x, y, label, phone ms, loss %, pings, BSSID, scan dBm, age, T-Deck dBm, ch, crowd
  awk -F'\t' -v OFS='\t' '
    function g_ms(v)   { return v == "" ? "" : (v + 0 < 50 ? "good" : (v + 0 >= 250 ? "poor" : "fair")) }
    function g_loss(v) { return v == "" ? "" : (v + 0 <= 1 ? "good" : (v + 0 >= 5 ? "poor" : "fair")) }
    function g_dbm(v)  { return v == "" ? "" : (v + 0 >= -67 ? "good" : (v + 0 < -75 ? "poor" : "fair")) }
    function worse(a, b) { return (a == "poor" || b == "poor") ? "poor" : ((a == "fair" || b == "fair") ? "fair" : (a != "" ? a : b)) }
    NF == 13 { if ($4 == "#undo") { if (n) n--; next } line[++n] = $0 }
    END {
      print "spot", "time", "label", "phone ms", "phone lost %", "T-Deck dBm", "scanner dBm", "crowd", "worst"
      for (i = 1; i <= n; i++) {
        split(line[i], f, "\t")
        w = worse(worse(g_ms(f[5]), g_loss(f[6])), worse(g_dbm(f[11]), g_dbm(f[9])))
        print i, f[1], (f[4] == "" ? "(no label)" : f[4]), f[5], f[6], f[11], f[9], f[13], (w == "" ? "no readings" : w)
      }
    }' "$DIR/map-points.tsv" > "$OUT/map.tsv"
  echo
  echo "Map spots ($OUT/map.tsv):"
  awk -F'\t' '{ for (i = 1; i <= NF; i++) { v[NR, i] = ($i == "" ? "-" : $i); if (length(v[NR, i]) > w[i]) w[i] = length(v[NR, i]) }
                if (NF > nf) nf = NF }
              END { for (r = 1; r <= NR; r++) { for (i = 1; i <= nf; i++) printf("%-" w[i] "s  ", v[r, i]); printf "\n" } }' "$OUT/map.tsv"
fi
