"""Pure logic for the dashboard: parse the shared logs, sum up channels, format probe and note lines.

Standard library only. No sockets or files here, so web/test_analyzer.py can check all of it.

Shared scan format (airscan.tsv and the boards' scanNNN.tsv), tab-separated, no header, one line per network
per scan: time, BSSID (lowercase), channel (2g6, 5g36, 6g37), signal dBm (integer), name.
"""
import datetime as _dt
import re

GOOD_DBM = -67   # Clearpath: -67 dBm or better is good
POOR_DBM = -75   # below -75 dBm is poor
GOOD_MS = 50     # FIRST: a round trip under 50 ms is responsive
POOR_MS = 250    # 250 ms or more is poor

_BSSID = re.compile(r"^[0-9a-f]{2}(:[0-9a-f]{2}){5}$")
_LABEL = re.compile(r"[^A-Za-z0-9._-]")


def channel_name(band_ghz, channel):
    """2g6, 5g36, 6g37, or None. 20 MHz primaries only, as in Format.swift and wifilogic.h."""
    c = channel
    ok = ((band_ghz == 2 and 1 <= c <= 14)
          or (band_ghz == 5 and ((32 <= c <= 144 and c % 4 == 0) or (149 <= c <= 177 and (c - 149) % 4 == 0)))
          or (band_ghz == 6 and 1 <= c <= 233 and (c - 1) % 4 == 0))
    return "%dg%d" % (band_ghz, c) if ok else None


def channel_from_freq(mhz):
    if mhz == 2484:
        return channel_name(2, 14)
    if 2412 <= mhz <= 2472 and (mhz - 2407) % 5 == 0:
        return channel_name(2, (mhz - 2407) // 5)
    if 5160 <= mhz <= 5885 and mhz % 5 == 0:
        return channel_name(5, (mhz - 5000) // 5)
    if 5955 <= mhz <= 7115 and (mhz - 5950) % 5 == 0:
        return channel_name(6, (mhz - 5950) // 5)
    return None


def split_channel(name):
    """'5g36' -> (5, 36), or None if it is not a valid channel name."""
    m = re.match(r"^([256])g(\d{1,3})$", name or "")
    if not m:
        return None
    band, num = int(m.group(1)), int(m.group(2))
    return (band, num) if channel_name(band, num) == name else None


def grade(dbm):
    return "good" if dbm >= GOOD_DBM else ("poor" if dbm < POOR_DBM else "fair")


def ping_grade(ms):
    if ms is None:
        return "lost"
    return "good" if ms < GOOD_MS else ("poor" if ms >= POOR_MS else "fair")


def parse_scan_line(line):
    """One line of the shared scan format, as a dict, or None for anything malformed."""
    f = line.rstrip("\r\n").split("\t")
    if len(f) != 5 or not f[0]:
        return None
    t, bssid, ch, sig, name = f
    if not _BSSID.match(bssid) or not split_channel(ch):
        return None
    try:
        s = int(sig)
    except ValueError:
        return None
    if not -120 <= s <= 0:
        return None
    return {"t": t, "bssid": bssid, "ch": ch, "dbm": s, "name": name}


def parse_iso(t):
    """UTC times as the logs write them (2026-10-13T14:00:00Z, optionally with .mmm). None for uptime stamps."""
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%fZ"):
        try:
            return _dt.datetime.strptime(t, fmt).replace(tzinfo=_dt.timezone.utc)
        except (ValueError, TypeError):
            pass
    return None


def iso(dt, ms=False):
    dt = dt.astimezone(_dt.timezone.utc)
    if ms:
        return dt.strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (dt.microsecond // 1000)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


class ScanState:
    """Everything the dashboard needs from airscan.tsv, fed one line at a time (the server tails the file)."""

    def __init__(self, history_per_bssid=2000):
        self.latest = {}      # bssid -> last parsed line
        self.history = {}     # bssid -> [(time, dbm)]
        self.scans = set()    # distinct scan times
        self.bad_lines = 0
        self.keep = history_per_bssid

    def add_line(self, line):
        if not line.strip():
            return
        r = parse_scan_line(line)
        if r is None:
            self.bad_lines += 1
            return
        self.scans.add(r["t"])
        prev = self.latest.get(r["bssid"])
        if prev is None or r["t"] >= prev["t"]:
            self.latest[r["bssid"]] = r
        h = self.history.setdefault(r["bssid"], [])
        h.append((r["t"], r["dbm"]))
        if len(h) > self.keep:
            del h[: len(h) - self.keep]

    def networks(self, now=None, window_s=None):
        """Latest reading per network, strongest first. With window_s, only networks heard within it."""
        out = []
        for r in self.latest.values():
            age = None
            t = parse_iso(r["t"])
            if now is not None and t is not None:
                age = max(0, int((now - t).total_seconds()))
                if window_s is not None and age > window_s:
                    continue
            out.append(dict(r, age_s=age, grade=grade(r["dbm"])))
        out.sort(key=lambda r: (-r["dbm"], r["bssid"]))
        return out

    def track(self, bssid):
        return [{"t": t, "dbm": d} for t, d in sorted(self.history.get(bssid, []))]


# 2.4 GHz channels that do not overlap, and 5 GHz channels outside the US radar (DFS) range: always listed,
# because an empty channel is the finding we want (same list as lab/survey-summary.sh).
BASE_CHANNELS = ["2g1", "2g6", "2g11", "5g36", "5g40", "5g44", "5g48", "5g149", "5g153", "5g157", "5g161", "5g165"]


def channels(networks):
    """Per channel: networks, how many at -75 dBm or stronger, strongest, DFS flag. Sorted by band then number."""
    table = {c: {"ch": c, "networks": 0, "strong": 0, "strongest": None} for c in BASE_CHANNELS}
    for n in networks:
        row = table.setdefault(n["ch"], {"ch": n["ch"], "networks": 0, "strong": 0, "strongest": None})
        row["networks"] += 1
        if n["dbm"] >= POOR_DBM:
            row["strong"] += 1
        if row["strongest"] is None or n["dbm"] > row["strongest"]:
            row["strongest"] = n["dbm"]
    rows = []
    for row in table.values():
        band, num = split_channel(row["ch"])
        row["band"] = band
        row["num"] = num
        row["dfs"] = band == 5 and 52 <= num <= 144
        row["main"] = row["ch"] in ("2g1", "2g6", "2g11")
        rows.append(row)
    rows.sort(key=lambda r: (r["band"], r["num"]))
    return rows


def clean_label(label, default="iphone"):
    s = _LABEL.sub("", label or "")[:32]
    return s or default


def clean_note(text):
    s = re.sub(r"[\x00-\x1f\x7f]", " ", text or "").strip()
    return s[:300]


def probe_line(t, label, rtt_ms):
    """linklog.tsv's ping line: time, 'ping', device, 7 empty fields, round trip ms or 'lost' (11 fields)."""
    rtt = "lost" if rtt_ms is None else ("%.1f" % rtt_ms)
    return "%s\tping\t%s\t\t\t\t\t\t\t\t%s" % (t, clean_label(label), rtt)


def note_line(t, text):
    """runlog.tsv, as lab/mark.sh writes it: time, note."""
    return "%s\t%s" % (t, clean_note(text))


# ---- group adverts (format in common/wifilogic/src/groupframe.h) -----------------------------------------------

KINDS = {1: "T-Deck", 2: "LoRa32", 3: "Watch", 4: "Mac"}
F_SCAN, F_PAUSED, F_LOGGING, F_TRACKING, F_PAX, F_HW_DISPLAY, F_HW_INPUT = 1, 2, 4, 8, 16, 32, 64


def _s8(b):
    return b - 256 if b > 127 else b


def decode_group_msd(m):
    """Manufacturer data (company ID first) -> dict, or None if it is not one of ours."""
    if len(m) < 25 or m[0] != 0xFF or m[1] != 0xFF:
        return None
    p = m[2:]
    if p[0:2] != b"RW" or p[2] != 1:
        return None
    if not 1 <= p[3] <= 4:
        return None
    ch = [0] * 14
    for c in range(1, 14):
        b = p[11 + (c - 1) // 2]
        ch[c] = (b & 0x0F) if (c & 1) else (b >> 4)
    return {"kind": KINDS[p[3]], "id": "%04x" % (p[4] | p[5] << 8), "seq": p[6], "flags": p[7], "nets": p[8],
            "pax": p[9] | p[10] << 8, "chcount": ch[1:], "best_ch": p[18], "best_dbm": _s8(p[19]),
            "track_ch": p[20], "track_dbm": _s8(p[21]), "age_s": p[22]}


def decode_group_adv(adv):
    """Raw advertisement data (a list of AD structures) -> dict, or None."""
    i = 0
    while i < len(adv):
        n = adv[i]
        if n == 0 or i + 1 + n > len(adv):
            return None
        if adv[i + 1] == 0xFF:
            r = decode_group_msd(bytes(adv[i + 2:i + 1 + n]))
            if r:
                return r
        i += 1 + n
    return None


def group_line(t, frame, advert_rssi):
    """group.tsv: time, kind, id, seq, flags, nets, pax, best_ch, best_dbm, track_ch, track_dbm, advert_rssi,
    networks on channels 1..13 (comma-separated)."""
    f = frame
    return "\t".join(str(v) for v in (t, f["kind"], f["id"], f["seq"], f["flags"], f["nets"], f["pax"], f["best_ch"],
                                      f["best_dbm"], f["track_ch"], f["track_dbm"], advert_rssi,
                                      ",".join(str(c) for c in f["chcount"])))


def parse_group_line(line):
    f = line.rstrip("\r\n").split("\t")
    if len(f) != 13 or f[1] not in KINDS.values():
        return None
    try:
        nums = [int(v) for v in f[3:12]]
        chs = [int(v) for v in f[12].split(",")]
    except ValueError:
        return None
    if len(chs) != 13:
        return None
    keys = ("seq", "flags", "nets", "pax", "best_ch", "best_dbm", "track_ch", "track_dbm", "advert_rssi")
    r = {"t": f[0], "kind": f[1], "id": f[2], "chcount": chs}
    r.update(zip(keys, nums))
    return r


def parse_link_line(line):
    """The Mac's own link from linklog.tsv ('link' lines only)."""
    f = line.rstrip("\r\n").split("\t")
    if len(f) != 11 or f[1] != "link":
        return None
    def num(v):
        try:
            return float(v) if "." in v else int(v)
        except ValueError:
            return None
    return {"t": f[0], "device": f[2], "dbm": num(f[3]), "noise": num(f[4]), "ch": f[5] or None,
            "rate": num(f[6]), "connected": f[2] != "not-connected"}


def probe_results(payload, now):
    """Validate a batch of link-test results from the phone. Returns probe lines; drops anything malformed.

    payload: {"label": "iphone", "results": [{"t": <ms since epoch, phone clock>, "rtt": <ms or null>}, ...]}
    Times more than a day off the server's clock are dropped (a phone with a wrong clock).
    """
    label = clean_label(payload.get("label") if isinstance(payload, dict) else None)
    results = payload.get("results") if isinstance(payload, dict) else None
    lines = []
    if not isinstance(results, list):
        return lines
    for r in results[:20000]:
        if not isinstance(r, dict):
            continue
        t, rtt = r.get("t"), r.get("rtt")
        if not isinstance(t, (int, float)) or isinstance(t, bool):
            continue
        when = _dt.datetime.fromtimestamp(t / 1000.0, _dt.timezone.utc)
        if abs((when - now).total_seconds()) > 86400:
            continue
        if rtt is not None and (not isinstance(rtt, (int, float)) or isinstance(rtt, bool) or not 0 <= rtt < 60000):
            continue
        lines.append(probe_line(iso(when, ms=True), label, rtt))
    return lines
