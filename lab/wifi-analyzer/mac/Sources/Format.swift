// Pure logic for the Mac scanner: channel names, log lines, options, and which cached networks are new.
// No CoreWLAN or AppKit here, so Tests/main.swift can check all of it on any Mac.
import Foundation

// MARK: - Channel names (shared format: 2g6, 5g36, 6g37)

/// A channel name from a band in GHz (2, 5 or 6) and a channel number. Nil if the pair is not a Wi-Fi channel.
func channelName(bandGHz: Int, channel: Int) -> String? {
    switch bandGHz {
    case 2 where (1...14).contains(channel): return "2g\(channel)"
    // 20 MHz primaries: 5 GHz 32-144 and 149-177 in steps of 4; 6 GHz 1, 5, 9 ... 233
    case 5 where ((32...144).contains(channel) && channel % 4 == 0) || ((149...177).contains(channel) && (channel - 149) % 4 == 0):
        return "5g\(channel)"
    case 6 where (1...233).contains(channel) && (channel - 1) % 4 == 0: return "6g\(channel)"
    default: return nil
    }
}

/// A channel name from a centre frequency in MHz. Same ranges as the awk `chan()` in lab/linklog.sh and lab/airscan.sh.
func channelName(frequencyMHz f: Int) -> String? {
    if f == 2484 { return "2g14" }
    if (2412...2472).contains(f), (f - 2407) % 5 == 0 { return "2g\((f - 2407) / 5)" }
    if (5160...5885).contains(f), f % 5 == 0 { return channelName(bandGHz: 5, channel: (f - 5000) / 5) }
    if (5955...7115).contains(f), (f - 5950) % 5 == 0 { return channelName(bandGHz: 6, channel: (f - 5950) / 5) }
    return nil
}

// MARK: - Field cleaning

/// Lowercase aa:bb:cc:dd:ee:ff, or nil. Accepts single-digit octets ("a:b:c:d:e:f") and dashes.
func normalizeBSSID(_ raw: String) -> String? {
    let parts = raw.split(whereSeparator: { $0 == ":" || $0 == "-" })
    guard parts.count == 6 else { return nil }
    var out: [String] = []
    for p in parts {
        guard (1...2).contains(p.count), let v = UInt8(p, radix: 16) else { return nil }
        out.append(String(format: "%02x", v))
    }
    return out.joined(separator: ":")
}

/// A network name safe for one TSV field: tabs, line breaks and other control characters become spaces.
func cleanName(_ name: String?) -> String {
    guard let name else { return "" }
    return String(name.unicodeScalars.map { CharacterSet.controlCharacters.contains($0) ? " " : Character($0) })
}

private let utcFormatter: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: "UTC")
    f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'"
    return f
}()

/// UTC to the second, the clock lab/mark.sh and lab/linklog.sh use.
func utcStamp(_ date: Date) -> String { utcFormatter.string(from: date) }

/// A number without a trailing ".0": 866.0 -> "866", 5.5 -> "5.5".
func plainNumber(_ v: Double) -> String {
    v.rounded() == v ? String(Int(v)) : String(format: "%.1f", v)
}

// MARK: - Log lines

/// airscan.tsv: time, BSSID, channel, signal dBm, name. Nil when a field is unusable, so a bad line is never written.
func scanLine(time: String, bssid: String, channel: String, signal: Int, name: String?) -> String? {
    guard let b = normalizeBSSID(bssid), isChannelName(channel), (-120...0).contains(signal) else { return nil }
    return "\(time)\t\(b)\t\(channel)\t\(signal)\t\(cleanName(name))"
}

/// linklog.tsv, the same 11 fields lab/linklog.sh writes for a Mac:
/// time, kind, device, signal, noise, channel, rate Mbit/s, inactive ms, tx retries, tx failed, round trip ms.
func linkLine(time: String, device: String, signal: Int, noise: Int?, channel: String?, rateMbps: Double?) -> String {
    let n = noise.map(String.init) ?? ""
    let r = rateMbps.map(plainNumber) ?? ""
    return "\(time)\tlink\t\(cleanName(device))\t\(signal)\t\(n)\t\(channel ?? "")\t\(r)\t\t\t\t"
}

func notConnectedLine(time: String) -> String { "\(time)\tlink\tnot-connected\t\t\t\t\t\t\t\t" }

/// runlog.tsv, as lab/mark.sh writes it: time, note.
func noteLine(time: String, note: String) -> String { "\(time)\t\(cleanName(note))" }

func isChannelName(_ c: String) -> Bool {
    guard c.count >= 3, let band = Int(c.prefix(1)), c.dropFirst().first == "g", let n = Int(c.dropFirst(2)) else { return false }
    return channelName(bandGHz: band, channel: n) == c
}

// MARK: - Options

struct Options: Equatable {
    var run: String
    var captureDir: String
    var scanEvery: Double = 10
    var linkEvery: Double = 1
    var maxAge: Double = 60      // on the first read, skip networks macOS last heard longer ago than this
    var seconds: Double = 0      // stop after this many seconds; 0 runs until quit
}

enum OptionError: Error, Equatable { case bad(String) }

/// Run names become a folder under the capture directory, so only letters, digits, dot, dash and underscore.
func isValidRunName(_ s: String) -> Bool {
    !s.isEmpty && s.count <= 80 && s != "." && s != ".." &&
        s.unicodeScalars.allSatisfy { CharacterSet.alphanumerics.contains($0) && $0.isASCII || "._-".unicodeScalars.contains($0) }
}

func parseOptions(_ args: [String], home: String, env: [String: String], now: Date) throws -> Options {
    var o = Options(run: "mac-" + utcStamp(now).replacingOccurrences(of: ":", with: "").replacingOccurrences(of: "-", with: ""),
                    captureDir: env["CAPTURE_DIR"] ?? home + "/robot-lab-captures")
    var i = 0
    func value() throws -> String {
        i += 1
        guard i < args.count else { throw OptionError.bad("\(args[i - 1]) needs a value") }
        return args[i]
    }
    func seconds(_ name: String, min: Double) throws -> Double {
        let raw = try value()
        guard let v = Double(raw), v >= min, v.isFinite else { throw OptionError.bad("\(name) must be a number of seconds, at least \(plainNumber(min))") }
        return v
    }
    while i < args.count {
        let a = args[i]
        switch a {
        case "--run": o.run = try value()
        case "--capture-dir": o.captureDir = try value()
        case "--scan-every": o.scanEvery = try seconds(a, min: 1)
        case "--link-every": o.linkEvery = try seconds(a, min: 1)
        case "--max-age": o.maxAge = try seconds(a, min: 0)
        case "--seconds": o.seconds = try seconds(a, min: 0)
        default:
            if a.hasPrefix("-psn_") || a == "-NSDocumentRevisionsDebugMode" { if a.hasPrefix("-NS") { i += 1 }; break } // added by LaunchServices / Xcode
            throw OptionError.bad("unknown option \(a)")
        }
        i += 1
    }
    guard isValidRunName(o.run) else { throw OptionError.bad("run name may use letters, digits, '.', '-' and '_' only") }
    return o
}

// MARK: - Which cached networks are new

/// One network from macOS's scan cache. `heardAt` is when macOS last heard it (now minus the cache's age), if known.
struct CacheEntry {
    var bssid: String
    var channel: String
    var signal: Int
    var name: String?
    var heardAt: Date?
}

/// Reading the cache sends nothing, but the cache only changes when macOS itself scans. This keeps track of what was
/// already written, so each observation is logged once and stale entries are not passed off as fresh.
struct NewObservations {
    private var lastHeard: [String: Date] = [:]          // by BSSID, when the entry has an age
    private var lastSeen: [String: String] = [:]         // by BSSID, "channel signal" when it has none
    let startedAt: Date
    let maxAge: TimeInterval

    init(startedAt: Date, maxAge: TimeInterval) { self.startedAt = startedAt; self.maxAge = maxAge }

    /// The entries not logged before, and the time to stamp them with: the latest time macOS heard any of them,
    /// so one macOS scan becomes one scan in airscan.tsv. Entries without an age count as new when their channel or
    /// signal changed, stamped `now`.
    mutating func take(_ entries: [CacheEntry], now: Date) -> (stamp: Date, entries: [CacheEntry]) {
        var fresh: [CacheEntry] = []
        var stamp: Date?
        for e in entries {
            guard let key = normalizeBSSID(e.bssid) else { continue }
            if let heard = e.heardAt {
                if heard < startedAt.addingTimeInterval(-maxAge) { continue }
                // the age is measured at read time, so the same observation reads a few ms apart; 1 s apart is a new one
                if let last = lastHeard[key], heard.timeIntervalSince(last) < 1 { continue }
                lastHeard[key] = heard
                stamp = max(stamp ?? heard, heard)
            } else {
                let sig = "\(e.channel) \(e.signal)"
                if lastSeen[key] == sig { continue }
                lastSeen[key] = sig
                stamp = max(stamp ?? now, now)
            }
            fresh.append(e)
        }
        return (min(stamp ?? now, now), fresh)
    }
}
