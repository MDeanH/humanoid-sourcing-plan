"""Tests for the Pi 5 scanner and group listener parsers, on sample iw output and hand-built HCI packets.

    python3 -m unittest discover -s lab/wifi-analyzer/pi5 -p 'test_*.py'

The samples follow iw 6.x's output format; they are not captured from a Pi.
"""
import datetime as dt
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "web"))
import analyzer  # noqa: E402
import group_listen as gl  # noqa: E402
import imgtool  # noqa: E402
import wifi_scan as ws  # noqa: E402

T = "2026-10-13T19:00:00Z"

SCAN = (
    "BSS 02:00:00:00:00:21(on wlan0)\n"
    "\tlast seen: 1234.567s [boottime]\n"
    "\tTSF: 123456789 usec (0d, 00:02:03)\n"
    "\tfreq: 2437.0\n"
    "\tbeacon interval: 100 TUs\n"
    "\tcapability: ESS Privacy ShortSlotTime (0x0411)\n"
    "\tsignal: -48.00 dBm\n"
    "\tlast seen: 0 ms ago\n"
    "\tSSID: test-net-a\n"
    "\tSupported rates: 1.0* 2.0* 5.5* 11.0* 6.0 9.0 12.0 18.0 \n"
    "\tDS Parameter set: channel 6\n"
    "BSS 02:00:00:00:00:22(on wlan0) -- associated\n"
    "\tfreq: 5180\n"
    "\tsignal: -71.40 dBm\n"
    "\tSSID: caf\\xc3\\xa9\\x09tab\\\\x\n"
    "\tRSN:\t * Version: 1\n"
    "BSS 02:00:00:00:00:23(on wlan0)\n"
    "\tfreq: 5500.0\n"
    "\tsignal: -80.00 dBm\n"
    "\tSSID: \n"
    "BSS 02:00:00:00:00:24(on wlan0)\n"
    "\tfreq: 2400\n"                       # not a channel: skipped
    "\tsignal: -60.00 dBm\n"
    "\tSSID: odd\n"
    "BSS 02:00:00:00:00:25(on wlan0)\n"
    "\tfreq: 6135\n"
    "\tsignal: -82.00 dBm\n"
    "\tSSID: six\n"
)

LINK = (
    "Connected to 02:00:00:00:00:22 (on wlan0)\n"
    "\tSSID: lab\n"
    "\tfreq: 5180\n"
    "\tRX: 1234 bytes (12 packets)\n"
    "\tTX: 567 bytes (8 packets)\n"
    "\tsignal: -52 dBm\n"
    "\trx bitrate: 433.3 MBit/s VHT-MCS 9 80MHz short GI VHT-NSS 1\n"
    "\ttx bitrate: 390.0 MBit/s VHT-MCS 8 80MHz short GI VHT-NSS 1\n"
)

SURVEY = (
    "Survey data from wlan0\n"
    "\tfrequency:\t\t\t5180 MHz [in use]\n"
    "\tnoise:\t\t\t\t-92 dBm\n"
    "\tchannel active time:\t\t1234 ms\n"
    "\tchannel busy time:\t\t56 ms\n"
    "Survey data from wlan0\n"
    "\tfrequency:\t\t\t2412 MHz\n"
)


class Scan(unittest.TestCase):
    def test_parse_scan(self):
        lines = ws.parse_iw_scan(SCAN, T)
        self.assertEqual(lines, [
            T + "\t02:00:00:00:00:21\t2g6\t-48\ttest-net-a",
            T + "\t02:00:00:00:00:22\t5g36\t-71\tcafé tab\\x",
            T + "\t02:00:00:00:00:23\t5g100\t-80\t",
            T + "\t02:00:00:00:00:25\t6g37\t-82\tsix",
        ])
        for l in lines:   # every line is valid in the shared format
            self.assertIsNotNone(analyzer.parse_scan_line(l), l)

    def test_link(self):
        line, up = ws.parse_iw_link(LINK, T, "wlan0")
        self.assertTrue(up)
        self.assertEqual(line, T + "\tlink\twlan0\t-52\t\t5g36\t390\t\t\t\t")
        self.assertEqual(len(line.split("\t")), 11)
        line, up = ws.parse_iw_link("Not connected.\n", T, "wlan0")
        self.assertFalse(up)
        self.assertEqual(analyzer.parse_link_line(line)["connected"], False)
        self.assertEqual(analyzer.parse_link_line(ws.parse_iw_link(LINK, T, "wlan0")[0])["dbm"], -52)

    def test_survey(self):
        self.assertEqual(ws.parse_survey(SURVEY, T), [T + "\t5g36\t-92\t1234\t56"])

    def test_config(self):
        c = ws.parse_config("# comment\nIFACE=wlan1\nSCAN_EVERY = 2\ncountry='gb'\nRUN=hall-a\n")
        self.assertEqual((c["IFACE"], c["SCAN_EVERY"], c["COUNTRY"], c["RUN"]), ("wlan1", 5, "GB", "hall-a"))
        c = ws.parse_config("IFACE=wlan0; rm -rf /\nCOUNTRY=USA\nRUN=../x\nSCAN_EVERY=soon\n")
        self.assertEqual((c["IFACE"], c["COUNTRY"], c["RUN"], c["SCAN_EVERY"]), ("wlan0", "US", "auto", 10))

    def test_run_name(self):
        now = dt.datetime(2026, 10, 13, 19, 5, tzinfo=dt.timezone.utc)
        self.assertEqual(ws.run_name(ws.parse_config(""), 7, now), "pi5-b0007-20261013T1905Z")
        self.assertEqual(ws.run_name(ws.parse_config("RUN=hall-a"), 7, now), "hall-a")


def vector():
    with open(os.path.join(HERE, "..", "testdata", "group-frame.tsv")) as f:
        row = [l for l in f if l.strip() and not l.startswith("#")][0].rstrip("\n").split("\t")
    return bytes.fromhex(row[0]), row[1:]


class Group(unittest.TestCase):
    def test_decode_shared_vector(self):
        adv, want = vector()
        f = analyzer.decode_group_adv(adv)
        got = [f["kind"], f["id"], str(f["seq"]), str(f["flags"]), str(f["nets"]), str(f["pax"]),
               ",".join(str(c) for c in f["chcount"]), str(f["best_ch"]), str(f["best_dbm"]),
               str(f["track_ch"]), str(f["track_dbm"]), str(f["age_s"])]
        self.assertEqual(got, want)

    def test_not_ours(self):
        adv, _ = vector()
        self.assertIsNone(analyzer.decode_group_adv(adv[:20]))
        other = bytearray(adv); other[2:4] = b"\x4c\x00"     # Apple's company ID
        self.assertIsNone(analyzer.decode_group_adv(bytes(other)))
        flags_first = bytes([2, 0x01, 0x06]) + adv           # a flags AD structure first
        self.assertEqual(analyzer.decode_group_adv(flags_first)["id"], "99ad")

    def test_hci_legacy_report(self):
        adv, _ = vector()
        addr = bytes([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff])   # little-endian on the wire
        report = bytes([gl.LE_ADV_REPORT, 1, 0x03, 0x00]) + addr + bytes([len(adv)]) + adv + bytes([256 - 60])
        pkt = bytes([gl.HCI_EVENT_PKT, gl.EVT_LE_META, len(report)]) + report
        r = gl.parse_adv_reports(pkt)
        self.assertEqual(r, [("ff:ee:dd:cc:bb:aa", -60, adv)])

    def test_hci_extended_report(self):
        adv, _ = vector()
        addr = bytes(range(1, 7))
        body = (bytes([0x10, 0x00, 0x00]) + addr + bytes([1, 0, 0xFF, 0x7F, 256 - 55, 0, 0, 0]) + bytes(6)
                + bytes([len(adv)]) + adv)
        report = bytes([gl.LE_EXT_ADV_REPORT, 1]) + body
        pkt = bytes([gl.HCI_EVENT_PKT, gl.EVT_LE_META, len(report)]) + report
        self.assertEqual(gl.parse_adv_reports(pkt), [("06:05:04:03:02:01", -55, adv)])

    def test_hci_commands(self):
        self.assertEqual(gl.hci_command(gl.OGF_LE, gl.OCF_LE_SET_SCAN_ENABLE, b"\x01\x00"), bytes.fromhex("010c20020100"))
        self.assertEqual(gl.scan_parameters(passive=True)[0], 0x00)            # passive: no scan requests
        self.assertEqual(gl.scan_parameters(), bytes.fromhex("00a000a0000000"))   # 100 ms = 160 units
        self.assertEqual(len(gl.event_filter()), 14)
        self.assertEqual(gl.parse_adv_reports(b"\x04\x0e\x04\x01\x0b\x20\x00"), [])   # command complete

    def test_group_lines_round_trip(self):
        adv, _ = vector()
        f = analyzer.decode_group_adv(adv)
        line = analyzer.group_line(T, f, -60)
        r = analyzer.parse_group_line(line)
        self.assertEqual((r["kind"], r["id"], r["seq"], r["pax"], r["track_dbm"], r["advert_rssi"]), ("T-Deck", "99ad", 200, 513, -77, -60))
        self.assertEqual(r["chcount"], list(range(1, 14)))
        d = gl.Dedup()
        self.assertTrue(d.new(f))
        self.assertFalse(d.new(f))
        self.assertTrue(d.new(dict(f, seq=201)))


class Image(unittest.TestCase):
    def test_mbr(self):
        sec = bytearray(512)
        sec[446 + 4] = 0x0C
        sec[446 + 8:446 + 16] = (8192).to_bytes(4, "little") + (1048576).to_bytes(4, "little")
        sec[462 + 4] = 0x83
        sec[462 + 8:462 + 16] = (1056768).to_bytes(4, "little") + (4194304).to_bytes(4, "little")
        sec[510:512] = b"\x55\xaa"
        self.assertEqual(imgtool.parse_mbr(bytes(sec)), [(1, 0x0C, 8192 * 512, 1048576 * 512), (2, 0x83, 1056768 * 512, 4194304 * 512)])
        with self.assertRaises(ValueError):
            imgtool.parse_mbr(bytes(512))

    def test_resolve(self):
        status = imgtool.parse_stanzas(
            "Package: libc6\nStatus: install ok installed\n\n"
            "Package: libusb-1.0-0\nStatus: install ok installed\nProvides: libusb\n\n"
            "Package: gone\nStatus: deinstall ok config-files\n")
        have = imgtool.installed(status)
        self.assertEqual(have, {"libc6", "libusb-1.0-0", "libusb"})
        debian = imgtool.parse_stanzas(
            "Package: usbmuxd\nDepends: libc6 (>= 2.34), libimobiledevice-1.0-6 (>= 1.3), libusb-1.0-0, adduser | passwd\n"
            "Pre-Depends: init-system-helpers\nFilename: pool/u/usbmuxd.deb\nSHA256: aa\n\n"
            "Package: libimobiledevice-1.0-6\nDepends: libplist-2.0-4, libssl3t64\nFilename: pool/l/limd.deb\nSHA256: bb\n\n"
            "Package: libplist-2.0-4\nFilename: pool/l/plist.deb\nSHA256: cc\n\n"
            "Package: openssl-libs\nProvides: libssl3t64\nFilename: pool/o/ssl.deb\nSHA256: dd\n\n"
            "Package: adduser\nFilename: pool/a/adduser.deb\nSHA256: ee\n\n"
            "Package: init-system-helpers\nFilename: pool/i/ish.deb\nSHA256: ff\n")
        order = [s["Package"] for s, _ in imgtool.resolve(["usbmuxd"], have, [(0, debian)])]
        self.assertEqual(order, ["init-system-helpers", "libplist-2.0-4", "openssl-libs", "libimobiledevice-1.0-6", "adduser", "usbmuxd"])
        with self.assertRaises(KeyError):
            imgtool.resolve(["nothere"], have, [(0, debian)])


if __name__ == "__main__":
    unittest.main()
