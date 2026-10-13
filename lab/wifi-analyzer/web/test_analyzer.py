"""Tests for web/analyzer.py and the server's HTTP endpoints. Standard library only.

    python3 -m unittest discover -s lab/wifi-analyzer/web -p 'test_*.py'
"""
import datetime as dt
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import analyzer as a  # noqa: E402
import server  # noqa: E402

FIXTURE = os.path.join(HERE, "..", "testdata", "channel-cases.tsv")
NOW = dt.datetime(2026, 10, 13, 19, 0, 0, tzinfo=dt.timezone.utc)


class Channels(unittest.TestCase):
    def test_shared_fixture(self):
        rows = 0
        with open(FIXTURE) as f:
            for line in f:
                if line.startswith("#") or not line.strip():
                    continue
                band, ch, mhz, want = line.rstrip("\n").split("\t")
                want = None if want == "-" else want
                self.assertEqual(a.channel_name(int(band), int(ch)), want, line)
                self.assertEqual(a.channel_from_freq(int(mhz)), want, line)
                rows += 1
        self.assertGreaterEqual(rows, 20)

    def test_split(self):
        self.assertEqual(a.split_channel("5g36"), (5, 36))
        self.assertIsNone(a.split_channel("5g37"))
        self.assertIsNone(a.split_channel("x6"))


class Lines(unittest.TestCase):
    def test_scan_line(self):
        r = a.parse_scan_line("2026-10-13T19:00:00Z\taa:bb:cc:dd:ee:ff\t5g36\t-61\tHall A\n")
        self.assertEqual(r, {"t": "2026-10-13T19:00:00Z", "bssid": "aa:bb:cc:dd:ee:ff", "ch": "5g36", "dbm": -61, "name": "Hall A"})
        r = a.parse_scan_line("T+000123.4\taa:bb:cc:dd:ee:ff\t2g6\t-70\t")   # board with no clock, hidden name
        self.assertEqual(r["t"], "T+000123.4")
        self.assertEqual(r["name"], "")
        for bad in ["2026\tAA:BB:CC:DD:EE:FF\t2g6\t-50\tx",      # uppercase BSSID
                    "2026\taa:bb:cc:dd:ee:ff\t2g6\t-50",          # 4 fields
                    "2026\taa:bb:cc:dd:ee:ff\t5g37\t-50\tx",      # not a channel
                    "2026\taa:bb:cc:dd:ee:ff\t2g6\t5\tx",         # positive dBm
                    "2026\taa:bb:cc:dd:ee:ff\t2g6\t-5.5\tx"]:     # not an integer
            self.assertIsNone(a.parse_scan_line(bad), bad)

    def test_probe_line_matches_linklog(self):
        line = a.probe_line("2026-10-13T19:00:00.500Z", "iphone", 12.34)
        f = line.split("\t")
        self.assertEqual(len(f), 11)
        self.assertEqual((f[1], f[2], f[10]), ("ping", "iphone", "12.3"))
        self.assertEqual(a.probe_line("t", "my phone!", None).split("\t")[2:], ["myphone"] + [""] * 7 + ["lost"])

    def test_note_line(self):
        self.assertEqual(a.note_line("t", "robot\tat booth\n"), "t\trobot at booth")

    def test_link_line(self):
        r = a.parse_link_line("2026-10-13T19:10:05Z\tlink\ten1\t-35\t-95\t5g36\t866\t\t\t\t")
        self.assertEqual((r["dbm"], r["noise"], r["ch"], r["rate"], r["connected"]), (-35, -95, "5g36", 866, True))
        r = a.parse_link_line("2026-10-13T19:10:05Z\tlink\tnot-connected\t\t\t\t\t\t\t\t")
        self.assertFalse(r["connected"])
        self.assertIsNone(a.parse_link_line("t\tping\t1.2.3.4\t\t\t\t\t\t\t\t3.1"))

    def test_grades(self):
        self.assertEqual([a.grade(d) for d in (-67, -68, -75, -76)], ["good", "fair", "fair", "poor"])
        self.assertEqual([a.ping_grade(m) for m in (49.9, 50, 249.9, 250, None)], ["good", "fair", "fair", "poor", "lost"])

    def test_probe_results(self):
        t = NOW.timestamp() * 1000
        lines = a.probe_results({"label": "iphone", "results": [
            {"t": t, "rtt": 8.5}, {"t": t + 500, "rtt": None},
            {"t": t - 3 * 86400 * 1000, "rtt": 1},     # phone clock days off: dropped
            {"t": "x", "rtt": 1}, {"t": t, "rtt": -3}, {"t": t, "rtt": True}, "junk"]}, NOW)
        self.assertEqual(lines, ["2026-10-13T19:00:00.000Z\tping\tiphone\t\t\t\t\t\t\t\t8.5",
                                 "2026-10-13T19:00:00.500Z\tping\tiphone\t\t\t\t\t\t\t\tlost"])
        self.assertEqual(a.probe_results("nonsense", NOW), [])


class State(unittest.TestCase):
    def test_networks_and_channels(self):
        s = a.ScanState()
        for line in ["2026-10-13T18:50:00Z\taa:aa:aa:aa:aa:01\t5g36\t-70\tA",
                     "2026-10-13T18:55:00Z\taa:aa:aa:aa:aa:01\t5g36\t-60\tA",
                     "2026-10-13T18:55:00Z\taa:aa:aa:aa:aa:02\t2g6\t-80\tB",
                     "2026-10-13T17:00:00Z\taa:aa:aa:aa:aa:03\t6g37\t-50\tC",
                     "garbage", ""]:
            s.add_line(line)
        self.assertEqual(s.bad_lines, 1)
        nets = s.networks(now=NOW, window_s=900)
        self.assertEqual([n["bssid"] for n in nets], ["aa:aa:aa:aa:aa:01", "aa:aa:aa:aa:aa:02"])   # C is 2 h old
        self.assertEqual(nets[0]["dbm"], -60)
        self.assertEqual(nets[0]["age_s"], 300)
        ch = {r["ch"]: r for r in a.channels(nets)}
        self.assertEqual((ch["5g36"]["networks"], ch["5g36"]["strong"], ch["5g36"]["strongest"]), (1, 1, -60))
        self.assertEqual((ch["2g6"]["networks"], ch["2g6"]["strong"]), (1, 0))
        self.assertEqual(ch["2g11"]["networks"], 0)    # base channels listed even when empty
        self.assertTrue(ch["2g6"]["main"])
        order = [r["ch"] for r in a.channels(nets)]
        self.assertEqual(order[:3], ["2g1", "2g6", "2g11"])
        self.assertEqual(s.track("aa:aa:aa:aa:aa:01"), [{"t": "2026-10-13T18:50:00Z", "dbm": -70},
                                                       {"t": "2026-10-13T18:55:00Z", "dbm": -60}])
        all_nets = s.networks(now=NOW, window_s=None)
        self.assertEqual(len(all_nets), 3)


class Map(unittest.TestCase):
    def test_point_freshness(self):
        scan = {"t": "2026-10-13T18:59:50Z", "bssid": "aa:aa:aa:aa:aa:01", "dbm": -63}
        group = [{"t": "2026-10-13T18:59:55Z", "kind": "T-Deck", "flags": a.F_TRACKING | a.F_SCAN, "track_dbm": -71, "track_ch": 11},
                 {"t": "2026-10-13T18:58:30Z", "kind": "LoRa32", "flags": a.F_PAX, "pax": 37},
                 {"t": "2026-10-13T18:50:00Z", "kind": "T-Deck", "flags": a.F_TRACKING, "track_dbm": -40, "track_ch": 1}]
        p = a.make_map_point(NOW, {"x": 0.25, "y": 0.5, "label": "booth\tfront", "phone": {"n": 40, "lost": 2, "avg_ms": 31.26}}, scan, group)
        self.assertEqual((p["x"], p["y"], p["label"]), (0.25, 0.5, "booth front"))
        self.assertEqual((p["phone_n"], p["phone_loss_pct"], p["phone_ms"]), (40, 5.0, 31.3))
        self.assertEqual((p["scan_dbm"], p["scan_age_s"]), (-63, 10))
        self.assertEqual((p["tdeck_dbm"], p["tdeck_ch"], p["pax"]), (-71, 11, 37))   # the 10-minute-old T-Deck report is ignored
        old = a.make_map_point(NOW, {"x": 1, "y": 0}, dict(scan, t="2026-10-13T18:58:00Z"), [])
        self.assertNotIn("scan_dbm", old)          # 2 min old: measured somewhere else
        self.assertNotIn("phone_ms", old)
        with self.assertRaises(ValueError):
            a.make_map_point(NOW, {"x": 1.5, "y": 0}, None, [])

    def test_lines_and_undo(self):
        p1 = a.make_map_point(NOW, {"x": 0.1, "y": 0.2, "label": "a"}, None, [])
        p2 = a.make_map_point(NOW, {"x": 0.3, "y": 0.4, "label": "b", "phone": {"n": 2, "lost": 1, "avg_ms": 10}}, None, [])
        undo = a.map_point_line({"t": "t", "x": 0, "y": 0, "label": a.UNDO})
        lines = [a.map_point_line(p1), a.map_point_line(p2), undo, a.map_point_line(p2), "junk"]
        self.assertEqual(len(a.map_point_line(p1).split("\t")), len(a.MAP_FIELDS))
        pts = a.parse_map_points(lines)
        self.assertEqual([p["label"] for p in pts], ["a", "b"])
        self.assertEqual((pts[1]["phone_loss_pct"], pts[1]["phone_ms"], pts[0]["phone_ms"]), (50.0, 10.0, None))
        self.assertEqual(a.parse_map_points([undo, undo]), [])
        spoof = a.make_map_point(NOW, {"x": 0, "y": 0, "label": a.UNDO}, None, [])   # a label cannot fake an undo
        self.assertEqual(a.parse_map_points([a.map_point_line(p1), a.map_point_line(spoof)])[1]["label"], "undo")


class Http(unittest.TestCase):
    """Starts the real server on a free port against a temporary run folder."""

    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.mkdtemp()
        run_dir = os.path.join(cls.dir, "run1")
        os.makedirs(run_dir)
        now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with open(os.path.join(run_dir, "airscan.tsv"), "w") as f:
            f.write("%s\taa:aa:aa:aa:aa:01\t5g36\t-60\tA\n%s\taa:aa:aa:aa:aa:02\t2g6\t-80\tB\n" % (now, now))
        with open(os.path.join(run_dir, "linklog.tsv"), "w") as f:
            f.write("%s\tlink\ten1\t-35\t-95\t5g36\t866\t\t\t\t\n" % now)
        cls.rundata = server.Run(run_dir)
        cls.srv = server.ThreadingHTTPServer(("127.0.0.1", 0), server.make_handler(cls.rundata, "run1"))
        cls.base = "http://127.0.0.1:%d" % cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()
        shutil.rmtree(cls.dir)

    def get(self, path):
        with urllib.request.urlopen(self.base + path) as r:
            return r.status, r.headers.get("Content-Type"), r.read()

    def post(self, path, obj):
        req = urllib.request.Request(self.base + path, data=json.dumps(obj).encode(), method="POST",
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_pages(self):
        code, ctype, body = self.get("/")
        self.assertEqual(code, 200)
        self.assertIn(b"apple-touch-icon", body)
        code, ctype, body = self.get("/icon-180.png")
        self.assertEqual((code, ctype, body[:8]), (200, "image/png", b"\x89PNG\r\n\x1a\n"))
        for p in ("/static/app.js", "/static/style.css", "/static/manifest.webmanifest"):
            self.assertEqual(self.get(p)[0], 200, p)
        with self.assertRaises(urllib.error.HTTPError):
            self.get("/static/../server.py")

    def test_state_and_track(self):
        _, _, body = self.get("/api/state")
        d = json.loads(body)
        self.assertEqual(d["run"], "run1")
        self.assertEqual([n["bssid"] for n in d["networks"]], ["aa:aa:aa:aa:aa:01", "aa:aa:aa:aa:aa:02"])
        self.assertEqual(d["link"]["dbm"], -35)
        _, _, body = self.get("/api/track?bssid=AA:AA:AA:AA:AA:01")
        self.assertEqual(len(json.loads(body)["points"]), 1)
        # appended lines are picked up on the next request
        with open(os.path.join(self.rundata.dir, "airscan.tsv"), "a") as f:
            f.write("2026-10-13T19:00:01Z\taa:aa:aa:aa:aa:01\t5g36\t-62\tA\n")
        _, _, body = self.get("/api/track?bssid=aa:aa:aa:aa:aa:01")
        self.assertEqual(len(json.loads(body)["points"]), 2)

    def test_group(self):
        _, _, body = self.get("/api/state")
        self.assertEqual(json.loads(body)["group"], [])
        now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with open(os.path.join(HERE, "..", "testdata", "group-frame.tsv")) as f:
            hexv = [l for l in f if l.strip() and not l.startswith("#")][0].split("\t")[0]
        frame = a.decode_group_adv(bytes.fromhex(hexv))
        with open(os.path.join(self.rundata.dir, "group.tsv"), "a") as f:
            f.write(a.group_line(now, frame, -61) + "\n" + "junk line\n")
        _, _, body = self.get("/api/state")
        g = json.loads(body)["group"]
        self.assertEqual([(m["kind"], m["id"], m["pax"], m["advert_rssi"]) for m in g], [("T-Deck", "99ad", 513, -61)])
        self.assertLessEqual(g[0]["age_s"], 5)

    def test_map(self):
        png = server.icon_png(16)
        req = urllib.request.Request(self.base + "/api/floorplan", data=png, method="POST", headers={"Content-Type": "image/png"})
        with urllib.request.urlopen(req) as r:
            self.assertEqual(r.status, 200)
        code, ctype, body = self.get("/floorplan")
        self.assertEqual((code, ctype, body), (200, "image/png", png))
        bad = urllib.request.Request(self.base + "/api/floorplan", data=b"x", method="POST", headers={"Content-Type": "text/plain"})
        with self.assertRaises(urllib.error.HTTPError):
            urllib.request.urlopen(bad)
        code, d = self.post("/api/mark", {"x": 0.5, "y": 0.5, "label": "centre", "bssid": "aa:aa:aa:aa:aa:01",
                                          "phone": {"n": 40, "lost": 0, "avg_ms": 22}})
        self.assertEqual(code, 200)
        self.assertEqual(d["point"]["scan_dbm"], -60)          # the scanner heard that network moments ago
        self.assertEqual(self.post("/api/mark", {"x": "left", "y": 0})[0], 400)
        _, _, body = self.get("/api/map")
        m = json.loads(body)
        self.assertTrue(m["floorplan"])
        self.assertEqual([p["label"] for p in m["points"]], ["centre"])
        code, d = self.post("/api/map/undo", {})
        self.assertEqual((code, d["points"]), (200, []))

    def test_ping_probe_note(self):
        self.assertEqual(self.get("/api/ping?s=1")[0], 200)
        t = dt.datetime.now(dt.timezone.utc).timestamp() * 1000
        code, d = self.post("/api/probe", {"label": "iphone", "results": [{"t": t, "rtt": 4.2}, {"t": t + 500, "rtt": None}]})
        self.assertEqual((code, d["written"]), (200, 2))
        with open(os.path.join(self.rundata.dir, "iphone-probe.tsv")) as f:
            lines = f.read().splitlines()
        self.assertEqual([l.split("\t")[10] for l in lines[-2:]], ["4.2", "lost"])
        code, d = self.post("/api/note", {"text": "robot at the far corner"})
        self.assertEqual(code, 200)
        with open(os.path.join(self.rundata.dir, "runlog.tsv")) as f:
            self.assertTrue(f.read().rstrip("\n").endswith("\trobot at the far corner"))
        self.assertEqual(self.post("/api/note", {"text": "  "})[0], 400)


if __name__ == "__main__":
    unittest.main()
