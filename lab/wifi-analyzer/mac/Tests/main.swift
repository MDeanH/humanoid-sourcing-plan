// Tests for Format.swift. build.sh compiles this with Format.swift alone and runs it before building the app.
import Foundation

var checks = 0, fails = 0
func check(_ ok: Bool, _ what: String, line: Int = #line) {
    checks += 1
    if !ok { fails += 1; print("FAIL line \(line): \(what)") }
}
func eq<T: Equatable>(_ a: T, _ b: T, line: Int = #line) { check(a == b, "\(a) != \(b)", line: line) }

// Shared fixture: the same cases the C++, Python and awk implementations are checked against.
let fixture = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "lab/wifi-analyzer/testdata/channel-cases.tsv"
let rows = (try? String(contentsOfFile: fixture, encoding: .utf8))?.split(separator: "\n").filter { !$0.hasPrefix("#") } ?? []
check(rows.count >= 20, "fixture rows")
for row in rows {
    let f = row.split(separator: "\t").map(String.init)
    guard f.count == 4, let band = Int(f[0]), let ch = Int(f[1]), let mhz = Int(f[2]) else { check(false, "bad row \(row)"); continue }
    let want = f[3] == "-" ? nil : f[3]
    eq(channelName(bandGHz: band, channel: ch), want)
    eq(channelName(frequencyMHz: mhz), want)
    if let w = want { check(isChannelName(w), "isChannelName \(w)") }
}
check(!isChannelName("2g0") && !isChannelName("7g1") && !isChannelName("2g") && !isChannelName("g6"), "bad names")

eq(normalizeBSSID("AA:BB:CC:0D:0E:0F"), "aa:bb:cc:0d:0e:0f")
eq(normalizeBSSID("a:b:c:d:e:f"), "0a:0b:0c:0d:0e:0f")
eq(normalizeBSSID("aa-bb-cc-dd-ee-ff"), "aa:bb:cc:dd:ee:ff")
eq(normalizeBSSID("aa:bb:cc:dd:ee"), nil)
eq(normalizeBSSID("zz:bb:cc:dd:ee:ff"), nil)
eq(cleanName("Expo\tHall\nB"), "Expo Hall B")
eq(cleanName(nil), "")
eq(plainNumber(866), "866")
eq(plainNumber(5.5), "5.5")

let t0 = Date(timeIntervalSince1970: 1_791_900_000)   // 2026-10-13T14:00:00Z
eq(utcStamp(t0), "2026-10-13T14:00:00Z")
eq(scanLine(time: "T", bssid: "AA:BB:CC:DD:EE:FF", channel: "5g36", signal: -61, name: "Hall\tA"), "T\taa:bb:cc:dd:ee:ff\t5g36\t-61\tHall A")
eq(scanLine(time: "T", bssid: "aa:bb:cc:dd:ee:ff", channel: "6g37", signal: -80, name: nil), "T\taa:bb:cc:dd:ee:ff\t6g37\t-80\t")
eq(scanLine(time: "T", bssid: "aa:bb:cc:dd:ee:ff", channel: "5g37", signal: -80, name: nil), nil)    // 37 is not a 5 GHz channel
eq(scanLine(time: "T", bssid: "aa:bb:cc:dd:ee:ff", channel: "2g6", signal: 3, name: nil), nil)
eq(scanLine(time: "T", bssid: "not-a-bssid", channel: "2g6", signal: -50, name: nil), nil)

// linklog.tsv: the 11 fields lab/linklog.sh writes, signal in field 4, channel in 6, round trip last
let link = linkLine(time: "T", device: "en1", signal: -39, noise: -95, channel: "5g36", rateMbps: 866)
eq(link.split(separator: "\t", omittingEmptySubsequences: false).count, 11)
eq(link, "T\tlink\ten1\t-39\t-95\t5g36\t866\t\t\t\t")
eq(notConnectedLine(time: "T").split(separator: "\t", omittingEmptySubsequences: false).count, 11)
eq(noteLine(time: "T", note: "robot at\tbooth"), "T\trobot at booth")

// options
let home = "/Users/x"
do {
    let o = try parseOptions(["--run", "venue-1", "--seconds", "60", "-psn_0_12345"], home: home, env: [:], now: t0)
    eq(o.run, "venue-1"); eq(o.seconds, 60); eq(o.scanEvery, 10); eq(o.captureDir, "/Users/x/robot-lab-captures")
    let d = try parseOptions([], home: home, env: ["CAPTURE_DIR": "/tmp/c"], now: t0)
    eq(d.run, "mac-20261013T140000Z"); eq(d.captureDir, "/tmp/c")
} catch { check(false, "options threw \(error)") }
for bad in [["--run", "../x"], ["--run", "a/b"], ["--scan-every", "0"], ["--seconds"], ["--bogus"]] {
    check((try? parseOptions(bad, home: home, env: [:], now: t0)) == nil, "should reject \(bad)")
}

// new observations from the scan cache
var obs = NewObservations(startedAt: t0, maxAge: 60)
let a = CacheEntry(bssid: "aa:aa:aa:aa:aa:01", channel: "5g36", signal: -50, name: "A", heardAt: t0.addingTimeInterval(-5))
let b = CacheEntry(bssid: "aa:aa:aa:aa:aa:02", channel: "2g6", signal: -70, name: "B", heardAt: t0.addingTimeInterval(-3))
let old = CacheEntry(bssid: "aa:aa:aa:aa:aa:03", channel: "2g1", signal: -80, name: "C", heardAt: t0.addingTimeInterval(-600))
var r = obs.take([a, b, old], now: t0)
eq(r.entries.count, 2)                                  // heard before the run started and too long ago: skipped
eq(r.stamp, t0.addingTimeInterval(-3))                  // one macOS scan, one stamp: the latest heard time
r = obs.take([a, b], now: t0.addingTimeInterval(10))   // same observations, read again 10 s later
eq(r.entries.count, 0)
var a2 = a; a2.heardAt = a.heardAt!.addingTimeInterval(0.004)   // the same observation, age read a few ms apart
r = obs.take([a2], now: t0.addingTimeInterval(20))
eq(r.entries.count, 0)
a2.heardAt = t0.addingTimeInterval(25); a2.signal = -55       // macOS heard it again
r = obs.take([a2, b], now: t0.addingTimeInterval(30))
eq(r.entries.count, 1); eq(r.entries.first?.signal, -55); eq(r.stamp, t0.addingTimeInterval(25))
// without an age, an entry counts as new when its channel or signal changes
var c = CacheEntry(bssid: "aa:aa:aa:aa:aa:04", channel: "6g37", signal: -60, name: "D", heardAt: nil)
r = obs.take([c], now: t0.addingTimeInterval(40)); eq(r.entries.count, 1); eq(r.stamp, t0.addingTimeInterval(40))
r = obs.take([c], now: t0.addingTimeInterval(50)); eq(r.entries.count, 0)
c.signal = -61
r = obs.take([c], now: t0.addingTimeInterval(60)); eq(r.entries.count, 1)
// a heard time in the future (clock skew) is never stamped later than now
let future = CacheEntry(bssid: "aa:aa:aa:aa:aa:05", channel: "2g11", signal: -40, name: "E", heardAt: t0.addingTimeInterval(500))
r = obs.take([future], now: t0.addingTimeInterval(70)); eq(r.stamp, t0.addingTimeInterval(70))

print("mac format: \(checks) checks, \(fails) failed")
exit(fails == 0 ? 0 : 1)
