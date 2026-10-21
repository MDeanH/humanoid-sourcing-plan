#!/usr/bin/env python3
"""Raspberry Pi 5: listen for the group's Bluetooth adverts (T-Deck, LoRa32 Paxcounter, watch) -> group.tsv.

Passive LE scan through a raw HCI socket (Python standard library, Linux only): the controller listens and sends no
scan requests. One line per sender per new sequence number, so group.tsv holds every new report. Runs as
wifi-analyzer-group.service and writes into the run folder wifi-analyzer-scan.service created.
"""
import os
import socket
import struct
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "web"))
import analyzer  # noqa: E402

STATE_DIR = os.environ.get("WIFI_ANALYZER_STATE", "/var/lib/wifi-analyzer")
RUNTIME_DIR = os.environ.get("WIFI_ANALYZER_RUNTIME", "/run/wifi-analyzer")
HCI_DEV = int(os.environ.get("HCI_DEV", "0"))

# HCI constants (Bluetooth Core spec, vol 4 part E; Linux include/net/bluetooth/hci.h)
SOL_HCI, HCI_FILTER = 0, 2
HCI_COMMAND_PKT, HCI_EVENT_PKT = 0x01, 0x04
EVT_CMD_COMPLETE, EVT_CMD_STATUS, EVT_LE_META = 0x0E, 0x0F, 0x3E
LE_ADV_REPORT, LE_EXT_ADV_REPORT = 0x02, 0x0D
OGF_LE = 0x08
OCF_LE_SET_SCAN_PARAMETERS, OCF_LE_SET_SCAN_ENABLE = 0x000B, 0x000C


# ---- pure (tested in test_pi5.py) ---------------------------------------------------------------------------------

def hci_command(ogf, ocf, params=b""):
    return struct.pack("<BHB", HCI_COMMAND_PKT, (ogf << 10) | ocf, len(params)) + params


def scan_parameters(passive=True, interval_ms=100, window_ms=100):
    """LE Set Scan Parameters: type 0 = passive, interval/window in 0.625 ms units, public address, accept all."""
    units = lambda ms: max(4, min(0x4000, int(ms / 0.625)))
    return struct.pack("<BHHBB", 0x00 if passive else 0x01, units(interval_ms), units(window_ms), 0x00, 0x00)


def event_filter():
    """struct hci_ufilter: packet type mask, two 32-bit event masks, opcode."""
    ev = [0, 0]
    for e in (EVT_CMD_COMPLETE, EVT_CMD_STATUS, EVT_LE_META):
        ev[e >> 5] |= 1 << (e & 31)
    return struct.pack("<IIIH", 1 << HCI_EVENT_PKT, ev[0], ev[1], 0)


def _s8(b):
    return b - 256 if b > 127 else b


def parse_adv_reports(pkt):
    """An HCI event packet -> [(address, rssi, advertising data)] for legacy and extended LE advertising reports."""
    if len(pkt) < 5 or pkt[0] != HCI_EVENT_PKT or pkt[1] != EVT_LE_META:
        return []
    sub, p, out = pkt[3], pkt[4:], []
    try:
        if sub == LE_ADV_REPORT:
            n, i = p[0], 1
            for _ in range(n):
                addr = ":".join("%02x" % b for b in reversed(p[i + 2:i + 8]))
                dlen = p[i + 8]
                data = bytes(p[i + 9:i + 9 + dlen])
                rssi = _s8(p[i + 9 + dlen])
                out.append((addr, rssi, data))
                i += 10 + dlen
        elif sub == LE_EXT_ADV_REPORT:
            n, i = p[0], 1
            for _ in range(n):
                addr = ":".join("%02x" % b for b in reversed(p[i + 3:i + 9]))
                rssi = _s8(p[i + 13])
                dlen = p[i + 23]
                data = bytes(p[i + 24:i + 24 + dlen])
                out.append((addr, rssi, data))
                i += 24 + dlen
    except IndexError:
        return out
    return out


class Dedup:
    """Passes each sender's frame once per sequence number."""

    def __init__(self):
        self.last = {}

    def new(self, frame):
        key = (frame["kind"], frame["id"])
        if self.last.get(key) == frame["seq"]:
            return False
        self.last[key] = frame["seq"]
        return True


# ---- the service --------------------------------------------------------------------------------------------------

def current_run(timeout_s=120):
    path = os.path.join(RUNTIME_DIR, "current-run")
    end = time.time() + timeout_s
    while time.time() < end:
        try:
            with open(path) as f:
                run = f.read().strip()
            if run:
                return run
        except OSError:
            pass
        time.sleep(1)
    raise SystemExit("no run started (is wifi-analyzer-scan.service running?)")


def main():
    run = current_run()
    run_dir = os.path.join(STATE_DIR, "captures", run)
    os.makedirs(run_dir, exist_ok=True)
    out_path = os.path.join(run_dir, "group.tsv")
    sock = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_RAW, socket.BTPROTO_HCI)
    sock.bind((HCI_DEV,))
    sock.setsockopt(SOL_HCI, HCI_FILTER, event_filter())
    sock.send(hci_command(OGF_LE, OCF_LE_SET_SCAN_ENABLE, bytes([0, 0])))   # stop any scan first
    time.sleep(0.1)
    sock.send(hci_command(OGF_LE, OCF_LE_SET_SCAN_PARAMETERS, scan_parameters(passive=True)))
    time.sleep(0.1)
    sock.send(hci_command(OGF_LE, OCF_LE_SET_SCAN_ENABLE, bytes([1, 0])))   # enable, no duplicate filtering
    with open(os.path.join(run_dir, "runlog.tsv"), "a") as f:
        f.write(analyzer.note_line(analyzer.iso(analyzer._dt.datetime.now(analyzer._dt.timezone.utc)),
                                   "group listen start hci%d (passive BLE scan)" % HCI_DEV) + "\n")
    print("listening on hci%d -> %s" % (HCI_DEV, out_path), flush=True)
    dedup, heard = Dedup(), 0
    try:
        while True:
            pkt = sock.recv(512)
            if len(pkt) >= 7 and pkt[1] == EVT_CMD_COMPLETE and pkt[6] != 0:
                print("HCI command 0x%04x failed with status 0x%02x" % (pkt[4] | pkt[5] << 8, pkt[6]), flush=True)
            for addr, rssi, data in parse_adv_reports(pkt):
                frame = analyzer.decode_group_adv(data)
                if frame and dedup.new(frame):
                    t = analyzer.iso(analyzer._dt.datetime.now(analyzer._dt.timezone.utc))
                    with open(out_path, "a") as f:
                        f.write(analyzer.group_line(t, frame, rssi) + "\n")
                    heard += 1
                    if heard <= 3:
                        print("heard %s %s from %s" % (frame["kind"], frame["id"], addr), flush=True)
    except KeyboardInterrupt:
        pass
    finally:
        try:
            sock.send(hci_command(OGF_LE, OCF_LE_SET_SCAN_ENABLE, bytes([0, 0])))
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
