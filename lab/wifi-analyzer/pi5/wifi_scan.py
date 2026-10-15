#!/usr/bin/env python3
"""Raspberry Pi 5 Wi-Fi scanner: does on the Pi what the Mac app does on the Mac. Standard library and iw only.

Every SCAN_EVERY seconds: `iw dev <IFACE> scan passive` (no probe requests: iw leaves out the SSID list, and the
Pi's brcmfmac driver then scans passively) -> airscan.tsv in the shared format, and `iw survey dump` -> survey.tsv
where the driver reports it. Once a second, if the Pi itself is joined to a network: `iw dev <IFACE> link` ->
linklog.tsv. It never joins, configures or disturbs a network; it only reads what the driver hears.

Runs as a systemd service (wifi-analyzer-scan.service). Settings come from /boot/firmware/wifi-analyzer.conf, which
can be edited from any computer by putting the SD card in it. Logs go to /var/lib/wifi-analyzer/captures/<run>/.
"""
import argparse
import datetime as dt
import os
import re
import subprocess
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "web"))
import analyzer  # noqa: E402

DEFAULTS = {"IFACE": "wlan0", "SCAN_EVERY": "10", "COUNTRY": "US", "RUN": "auto", "LINK_EVERY": "1", "WIFI_CLIENT": "no"}
CONFIG_PATHS = ["/boot/firmware/wifi-analyzer.conf", "/etc/wifi-analyzer.conf"]
STATE_DIR = os.environ.get("WIFI_ANALYZER_STATE", "/var/lib/wifi-analyzer")      # captures, boot counter
RUNTIME_DIR = os.environ.get("WIFI_ANALYZER_RUNTIME", "/run/wifi-analyzer")      # this boot's run name


# ---- pure parsing (tested in test_pi5.py) -----------------------------------------------------------------------

def parse_config(text):
    """KEY=value lines; # comments; quotes optional. Unknown keys kept, invalid values fall back to defaults."""
    cfg = dict(DEFAULTS)
    for line in text.splitlines():
        line = line.split("#", 1)[0].strip()
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        cfg[k.strip().upper()] = v.strip().strip('"').strip("'")
    if not re.match(r"^[A-Za-z0-9_.-]{1,15}$", cfg["IFACE"]):
        cfg["IFACE"] = DEFAULTS["IFACE"]
    if not re.match(r"^[A-Z]{2}$", cfg["COUNTRY"].upper()):
        cfg["COUNTRY"] = DEFAULTS["COUNTRY"]
    cfg["COUNTRY"] = cfg["COUNTRY"].upper()
    for k, lo in (("SCAN_EVERY", 5), ("LINK_EVERY", 1)):
        try:
            cfg[k] = max(lo, int(float(cfg[k])))
        except ValueError:
            cfg[k] = int(DEFAULTS[k])
    if cfg["RUN"] != "auto" and not re.match(r"^[A-Za-z0-9._-]{1,80}$", cfg["RUN"]):
        cfg["RUN"] = "auto"
    return cfg


def run_name(cfg, boot_no, now):
    """'auto' -> pi5-b0007-20261013T1900Z: the boot number keeps names unique when the clock is wrong (no network)."""
    if cfg["RUN"] != "auto":
        return cfg["RUN"]
    return "pi5-b%04d-%s" % (boot_no, now.strftime("%Y%m%dT%H%MZ"))


def _ssid(raw):
    """iw prints non-printable SSID bytes as \\xNN; decode them back, then keep the name TSV-safe."""
    try:
        b = re.sub(r"\\(x[0-9a-fA-F]{2}|\\)", lambda m: "\\" if m.group(1) == "\\" else chr(int(m.group(1)[1:], 16)),
                   raw).encode("latin-1")
        s = b.decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        s = raw
    return re.sub(r"[\x00-\x1f\x7f]", " ", s)


def parse_iw_scan(text, t):
    """`iw dev X scan` output -> shared-format lines (time, BSSID, channel, dBm, name). Skips what it cannot name."""
    out, cur = [], None

    def flush():
        if cur and cur.get("bssid") and cur.get("ch") and cur.get("dbm") is not None:
            out.append("%s\t%s\t%s\t%d\t%s" % (t, cur["bssid"], cur["ch"], cur["dbm"], cur.get("name", "")))

    for line in text.splitlines():
        m = re.match(r"^BSS ([0-9a-fA-F:]{17})", line)
        if m:
            flush()
            cur = {"bssid": m.group(1).lower()}
            continue
        if cur is None:
            continue
        s = line.strip()
        if s.startswith("freq:"):
            try:
                cur["ch"] = analyzer.channel_from_freq(int(float(s.split()[1])))
            except (IndexError, ValueError):
                pass
        elif s.startswith("signal:"):
            try:
                cur["dbm"] = int(round(float(s.split()[1])))
            except (IndexError, ValueError):
                pass
        elif line.startswith("\tSSID:"):
            cur["name"] = _ssid(line[len("\tSSID:"):].lstrip(" "))
    flush()
    return out


def parse_iw_link(text, t, iface):
    """`iw dev X link` -> one linklog.tsv line (11 fields, as lab/linklog.sh writes), or a not-connected line."""
    if "Not connected" in text or "Connected to" not in text:
        return "%s\tlink\tnot-connected\t\t\t\t\t\t\t\t" % t, False
    ch = sig = rate = ""
    for s in (l.strip() for l in text.splitlines()):
        if s.startswith("freq:"):
            try:
                ch = analyzer.channel_from_freq(int(float(s.split()[1]))) or ""
            except (IndexError, ValueError):
                pass
        elif s.startswith("signal:"):
            sig = s.split()[1]
        elif s.startswith("tx bitrate:"):
            rate = s.split()[2]
    try:
        sig = str(int(round(float(sig))))
    except ValueError:
        sig = ""
    try:
        rate = analyzer_number(rate)
    except ValueError:
        rate = ""
    return "%s\tlink\t%s\t%s\t\t%s\t%s\t\t\t\t" % (t, iface, sig, ch, rate), True


def analyzer_number(v):
    f = float(v)
    return str(int(f)) if f == int(f) else "%.1f" % f


def parse_survey(text, t):
    """`iw dev X survey dump` -> survey.tsv lines (time, channel, noise dBm, active ms, busy ms), like lab/airscan.sh."""
    out, cur = [], {}

    def flush():
        if cur.get("ch") and cur.get("active") is not None:
            out.append("%s\t%s\t%s\t%s\t%s" % (t, cur["ch"], cur.get("noise", ""), cur["active"], cur.get("busy", "")))

    for s in (l.strip() for l in text.splitlines()):
        if s.startswith("frequency:"):
            flush()
            cur = {}
            try:
                cur["ch"] = analyzer.channel_from_freq(int(float(s.split()[1])))
            except (IndexError, ValueError):
                pass
        elif s.startswith("noise:"):
            cur["noise"] = s.split()[1]
        elif s.startswith("channel active time:"):
            cur["active"] = s.split()[3]
        elif s.startswith("channel busy time:"):
            cur["busy"] = s.split()[3]
    flush()
    return out


# ---- the service --------------------------------------------------------------------------------------------------

def utc():
    return dt.datetime.now(dt.timezone.utc)


def stamp():
    return analyzer.iso(utc())


def sh(*cmd, timeout=30):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout, r.stderr.strip()
    except (OSError, subprocess.TimeoutExpired) as e:
        return 1, "", str(e)


class Logs:
    def __init__(self, run_dir):
        self.dir = run_dir
        os.makedirs(run_dir, exist_ok=True)
        self.lock = threading.Lock()

    def add(self, name, lines):
        if lines:
            with self.lock, open(os.path.join(self.dir, name), "a", encoding="utf-8") as f:
                f.write("\n".join(lines) + "\n")

    def note(self, text):
        print(text, flush=True)
        self.add("runlog.tsv", [analyzer.note_line(stamp(), text)])


def load_config():
    for p in CONFIG_PATHS:
        try:
            with open(p, encoding="utf-8") as f:
                return parse_config(f.read()), p
        except OSError:
            continue
    return parse_config(""), "defaults"


def next_boot_number():
    path = os.path.join(STATE_DIR, "boot-count")
    try:
        with open(path) as f:
            n = int(f.read().strip() or 0) + 1
    except (OSError, ValueError):
        n = 1
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(path, "w") as f:
        f.write("%d\n" % n)
    return n


def link_loop(cfg, logs, stop):
    """Logs this Pi's own link once a second, but only once it has been joined to a network at least once."""
    ever = False
    while not stop.is_set():
        code, out, _ = sh("iw", "dev", cfg["IFACE"], "link", timeout=5)
        line, connected = parse_iw_link(out if code == 0 else "", stamp(), cfg["IFACE"])
        if connected and not ever:
            ever = True
            logs.note("this Pi joined a network on %s: logging its link every %ds" % (cfg["IFACE"], cfg["LINK_EVERY"]))
        if ever:
            logs.add("linklog.tsv", [line])
        stop.wait(cfg["LINK_EVERY"])


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--once", action="store_true", help="one scan to stdout, then exit (for testing on a Pi)")
    a = p.parse_args()
    cfg, src = load_config()
    if a.once:
        code, out, err = sh("iw", "dev", cfg["IFACE"], "scan", "passive")
        print("\n".join(parse_iw_scan(out, stamp())) or err)
        return 0 if code == 0 else 1

    run = run_name(cfg, next_boot_number(), utc())
    cap = os.path.join(STATE_DIR, "captures")
    logs = Logs(os.path.join(cap, run))
    os.makedirs(RUNTIME_DIR, exist_ok=True)
    with open(os.path.join(RUNTIME_DIR, "current-run"), "w") as f:   # the dashboard and group listener read this
        f.write(run + "\n")
    code, sync, _ = sh("timedatectl", "show", "-p", "NTPSynchronized", "--value", timeout=5)
    logs.note("pi5 scan start run=%s iface=%s every=%ds country=%s config=%s clock_synced=%s (passive scans; joins nothing)"
              % (run, cfg["IFACE"], cfg["SCAN_EVERY"], cfg["COUNTRY"], src, sync.strip() or "unknown"))

    # Radio on, regulatory domain set (5 GHz channels need it), interface up. None of this joins a network.
    # NetworkManager leaves wlan0 alone (90-wifi-analyzer.conf), so it does not scan actively in the background.
    # WIFI_CLIENT=yes hands it back, for a Pi that should also join your own network.
    if cfg.get("WIFI_CLIENT", "no").lower() in ("yes", "true", "1"):
        sh("nmcli", "device", "set", cfg["IFACE"], "managed", "yes", timeout=10)
        logs.note("WIFI_CLIENT=yes: NetworkManager manages %s (it may scan actively while it looks for networks)" % cfg["IFACE"])
    for cmd in (("rfkill", "unblock", "wifi"), ("iw", "reg", "set", cfg["COUNTRY"]), ("ip", "link", "set", cfg["IFACE"], "up")):
        code, _, err = sh(*cmd, timeout=10)
        if code != 0:
            logs.note("%s failed: %s" % (" ".join(cmd), err))

    stop = threading.Event()
    threading.Thread(target=link_loop, args=(cfg, logs, stop), daemon=True).start()
    last_err, scans = "", 0
    try:
        while True:
            t0 = time.monotonic()
            t = stamp()
            code, out, err = sh("iw", "dev", cfg["IFACE"], "scan", "passive", timeout=60)
            if code == 0:
                lines = parse_iw_scan(out, t)
                logs.add("airscan.tsv", lines)
                scans += 1
                if scans == 1 or scans % 60 == 0:
                    logs.note("scan %d: %d networks in %.1f s" % (scans, len(lines), time.monotonic() - t0))
                last_err = ""
            elif err != last_err:   # e.g. "Device or resource busy" while another scan runs; logged once per kind
                logs.note("scan failed: %s" % err)
                last_err = err
            code, out, _ = sh("iw", "dev", cfg["IFACE"], "survey", "dump", timeout=10)
            if code == 0:
                logs.add("survey.tsv", parse_survey(out, t))
            time.sleep(max(0.0, cfg["SCAN_EVERY"] - (time.monotonic() - t0)))
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        logs.note("pi5 scan stop after %d scans" % scans)
    return 0


if __name__ == "__main__":
    sys.exit(main())
