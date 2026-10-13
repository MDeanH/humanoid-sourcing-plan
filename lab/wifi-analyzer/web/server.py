#!/usr/bin/env python3
"""Wi-Fi analyzer dashboard for the Mac and the iPhone. Standard library only.

    python3 lab/wifi-analyzer/web/server.py <run-name> [--port 8765] [--host 0.0.0.0]

Reads the Mac analyzer's logs in ~/robot-lab-captures/<run-name>/ (airscan.tsv, linklog.tsv) and serves:
  channels   networks per channel and the strongest signal
  networks   every network heard, strongest first
  track      one network's signal over time
  link       the phone pings this server every 500 ms; round trips and losses go to iphone-probe.tsv in
             linklog.tsv's ping format, and a button adds a timestamped note to runlog.tsv
On the iPhone: Safari, http://<this Mac's name>.local:8765, then Share > Add to Home Screen.

Anyone on the same network can open the page while the server runs. Stop it with Control-C when done.
"""
import argparse
import datetime as dt
import json
import os
import re
import socket
import struct
import sys
import threading
import zlib
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import analyzer  # noqa: E402

STATIC = os.path.join(HERE, "static")
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
         ".css": "text/css; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png"}


class Tail:
    """Reads only what was appended to a log since the last call; starts over if the file shrinks."""

    def __init__(self, path):
        self.path, self.offset, self.partial = path, 0, b""

    def new_lines(self):
        try:
            size = os.path.getsize(self.path)
        except OSError:
            return []
        if size < self.offset:
            self.offset, self.partial = 0, b""
        with open(self.path, "rb") as f:
            f.seek(self.offset)
            data = f.read()
        self.offset += len(data)
        data = self.partial + data
        lines = data.split(b"\n")
        self.partial = lines.pop()
        return [l.decode("utf-8", "replace") for l in lines]


class Run:
    def __init__(self, run_dir):
        self.dir = run_dir
        self.lock = threading.Lock()
        self.scan = analyzer.ScanState()
        self.scan_tail = Tail(os.path.join(run_dir, "airscan.tsv"))
        self.link_tail = Tail(os.path.join(run_dir, "linklog.tsv"))
        self.group_tail = Tail(os.path.join(run_dir, "group.tsv"))   # written on a Pi 5 by group_listen.py
        self.link = None
        self.group = {}
        self.probe_lines = 0

    def refresh(self):
        with self.lock:
            for line in self.scan_tail.new_lines():
                self.scan.add_line(line)
            for line in self.link_tail.new_lines():
                r = analyzer.parse_link_line(line)
                if r and (r["connected"] or self.link is None or self.link["t"] <= r["t"]):
                    self.link = r
            for line in self.group_tail.new_lines():
                r = analyzer.parse_group_line(line)
                if r:
                    self.group[(r["kind"], r["id"])] = r

    def append(self, name, lines):
        if not lines:
            return
        with self.lock, open(os.path.join(self.dir, name), "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")


def icon_png(size=180):
    """Home-screen icon drawn here, so the repo holds no binary: dark tile, three signal bars."""
    bg, bars = (16, 20, 26), [(64, 200, 120), (230, 200, 60), (230, 80, 70)]
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            c = bg
            for i, col in enumerate(bars):
                x0 = size * (0.2 + 0.22 * i)
                top = size * (0.62 - 0.2 * i)
                if x0 <= x < x0 + size * 0.15 and top <= y < size * 0.82:
                    c = col
            row += bytes(c)
        rows.append(bytes(row))

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b""))


ICON = icon_png()


def make_handler(run, run_name):
    class Handler(BaseHTTPRequestHandler):
        server_version = "wifi-analyzer/1.0"

        def log_message(self, fmt, *args):  # one short line per request, pings excluded
            # self.path is not set when the request line itself is bad (a phone trying HTTPS first does that)
            if "/api/ping" not in (getattr(self, "path", "") or ""):
                sys.stderr.write("%s %s\n" % (self.client_address[0], fmt % args))

        def send(self, code, body, ctype="application/json", cache="no-store"):
            if isinstance(body, (dict, list)):
                body = json.dumps(body).encode()
            elif isinstance(body, str):
                body = body.encode()
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", cache)
            self.end_headers()
            self.wfile.write(body)

        def read_json(self, limit=2_000_000):
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > limit:
                return None
            try:
                return json.loads(self.rfile.read(n))
            except (ValueError, UnicodeDecodeError):
                return None

        def do_GET(self):
            u = urlparse(self.path)
            q = parse_qs(u.query)
            if u.path == "/api/ping":   # answered at once; the phone times the round trip
                return self.send(200, b'{"ok":1}')
            if u.path == "/api/state":
                run.refresh()
                now = dt.datetime.now(dt.timezone.utc)
                window = int((q.get("window") or ["900"])[0]) if (q.get("window") or ["900"])[0].isdigit() else 900
                with run.lock:
                    nets = run.scan.networks(now=now, window_s=window or None)
                    group = []
                    for g in sorted(run.group.values(), key=lambda g: (g["kind"], g["id"])):
                        t = analyzer.parse_iso(g["t"])
                        group.append(dict(g, age_s=int((now - t).total_seconds()) if t else None))
                    body = {"run": run_name, "now": analyzer.iso(now), "window_s": window, "group": group,
                            "networks": nets, "channels": analyzer.channels(nets),
                            "scans": len(run.scan.scans), "bad_lines": run.scan.bad_lines,
                            "link": run.link, "thresholds": {"good_dbm": analyzer.GOOD_DBM, "poor_dbm": analyzer.POOR_DBM,
                                                             "good_ms": analyzer.GOOD_MS, "poor_ms": analyzer.POOR_MS}}
                return self.send(200, body)
            if u.path == "/api/track":
                bssid = (q.get("bssid") or [""])[0].lower()
                if not re.match(r"^[0-9a-f]{2}(:[0-9a-f]{2}){5}$", bssid):
                    return self.send(400, {"error": "bssid"})
                run.refresh()
                with run.lock:
                    latest = run.scan.latest.get(bssid)
                    return self.send(200, {"bssid": bssid, "latest": latest, "points": run.scan.track(bssid)})
            if u.path in ("/", "/index.html"):
                return self.static("index.html")
            if u.path == "/icon-180.png":
                return self.send(200, ICON, "image/png", "public, max-age=86400")
            m = re.match(r"^/static/([A-Za-z0-9._-]+)$", u.path)
            if m:
                return self.static(m.group(1))
            return self.send(404, {"error": "not found"})

        def static(self, name):
            path = os.path.join(STATIC, name)
            ext = os.path.splitext(name)[1]
            if ext not in TYPES or not os.path.isfile(path):
                return self.send(404, {"error": "not found"})
            with open(path, "rb") as f:
                return self.send(200, f.read(), TYPES[ext], "no-cache")

        def do_POST(self):
            u = urlparse(self.path)
            now = dt.datetime.now(dt.timezone.utc)
            data = self.read_json()
            if data is None:
                return self.send(400, {"error": "json body"})
            if u.path == "/api/probe":
                lines = analyzer.probe_results(data, now)
                run.append("iphone-probe.tsv", lines)
                run.probe_lines += len(lines)
                return self.send(200, {"written": len(lines)})
            if u.path == "/api/note":
                text = analyzer.clean_note(data.get("text") if isinstance(data, dict) else "")
                if not text:
                    return self.send(400, {"error": "empty note"})
                line = analyzer.note_line(analyzer.iso(now), text)
                run.append("runlog.tsv", [line])
                return self.send(200, {"line": line})
            return self.send(404, {"error": "not found"})

    return Handler


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("run", help="run name: logs are read from and written to ~/robot-lab-captures/<run>/")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--host", default="0.0.0.0")
    p.add_argument("--capture-dir", default=os.environ.get("CAPTURE_DIR", os.path.expanduser("~/robot-lab-captures")))
    a = p.parse_args()
    if not re.match(r"^[A-Za-z0-9._-]{1,80}$", a.run) or a.run in (".", ".."):
        p.error("run name may use letters, digits, '.', '-' and '_' only")
    run_dir = os.path.join(a.capture_dir, a.run)
    os.makedirs(run_dir, exist_ok=True)
    run = Run(run_dir)
    run.refresh()
    srv = ThreadingHTTPServer((a.host, a.port), make_handler(run, a.run))
    host = socket.gethostname().split(".")[0]
    print("Serving run %s from %s" % (a.run, run_dir))
    print("Open http://%s.local:%d on the iPhone (or http://localhost:%d here). Control-C stops." % (host, a.port, a.port))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


if __name__ == "__main__":
    main()
