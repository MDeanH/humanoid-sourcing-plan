#!/usr/bin/env bash
# Turn a run's capture files into small summary tables you can read and share.
# The raw .pcap files stay private; the summaries hold names, addresses, counts and times only.
#
#   lab/summarize.sh <run-name>
#
# Needs tshark, which comes with Wireshark (wireshark.org). Output goes to ~/robot-lab-captures/<run-name>/summary/:
#   dns-queries.tsv     time (epoch seconds), client address, name asked for
#   dns-count.tsv       how many times each name was asked for, most first
#   tls-sni.tsv         time, client, server address, TLS server name (from the handshake)
#   tls-sni-count.tsv   how many handshakes per server name, most first
#   ip-conversations.txt  bytes and packets per address pair
set -euo pipefail

RUN="${1:?usage: lab/summarize.sh <run-name>}"
command -v tshark >/dev/null 2>&1 || { echo "tshark not found. Install Wireshark from wireshark.org; it includes tshark." >&2; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="${CAPTURE_DIR:-$HOME/robot-lab-captures}/$RUN"
OUT="$DIR/summary"

shopt -s nullglob
files=("$DIR"/*.pcap)
[ "${#files[@]}" -gt 0 ] || { echo "No .pcap files in $DIR" >&2; exit 1; }

mkdir -p "$OUT"
: > "$OUT/dns-queries.tsv"; : > "$OUT/tls-sni.tsv"; : > "$OUT/ip-conversations.txt"

for f in "${files[@]}"; do
  echo "reading $(basename "$f")"
  # DNS questions, IPv4 and IPv6 clients
  tshark -r "$f" -Y 'dns.flags.response == 0 && !icmp && !icmpv6' -T fields -E separator='	' \
    -e frame.time_epoch -e ip.src -e ipv6.src -e dns.qry.name 2>/dev/null \
    | awk -F'\t' '{ src = ($2 != "" ? $2 : $3); print $1 "\t" src "\t" $4 }' >> "$OUT/dns-queries.tsv" || true
  # TLS ClientHello: the server name the client asks for
  tshark -r "$f" -Y 'tls.handshake.type == 1' -T fields -E separator='	' \
    -e frame.time_epoch -e ip.src -e ipv6.src -e ip.dst -e ipv6.dst -e tls.handshake.extensions_server_name 2>/dev/null \
    | awk -F'\t' '{ src = ($2 != "" ? $2 : $3); dst = ($4 != "" ? $4 : $5); print $1 "\t" src "\t" dst "\t" $6 }' >> "$OUT/tls-sni.tsv" || true
  tshark -r "$f" -q -z conv,ip 2>/dev/null >> "$OUT/ip-conversations.txt" || true
done

count_by() { # count_by <file> <column>
  awk -F'\t' -v c="$2" '$c != "" { n[$c]++ } END { for (k in n) printf "%d\t%s\n", n[k], k }' "$1" | sort -rn
}
count_by "$OUT/dns-queries.tsv" 3 > "$OUT/dns-count.tsv"
count_by "$OUT/tls-sni.tsv" 4 > "$OUT/tls-sni-count.tsv"

echo
echo "Summary written to $OUT"
echo "Top names asked for:"; head -10 "$OUT/dns-count.tsv"
echo "Top TLS server names:"; head -10 "$OUT/tls-sni-count.tsv"
