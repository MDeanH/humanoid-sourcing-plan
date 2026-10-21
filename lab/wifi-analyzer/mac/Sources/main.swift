// Mac mini Wi-Fi analyzer: logs every network macOS hears (2.4, 5 and 6 GHz) to airscan.tsv, and this Mac's own
// link once a second to linklog.tsv, in the formats lab/survey-summary.sh reads.
//
// It sends nothing. CoreWLAN's public scan call makes macOS send probe requests on every non-radar channel (seen in
// airportd's log, 2026-10-13), and the call that takes a scan type is refused to apps without Apple's private
// com.apple.wifi.scan entitlement. So this app never asks for a scan: every 10 s it reads the scan cache macOS keeps
// from its own scanning, and writes each network once per time macOS heard it, stamped with that time.
//
// Since macOS 14, CoreWLAN hides network names and BSSIDs from apps without Location Services permission, so this
// is an app bundle with NSLocationWhenInUseUsageDescription that asks first and waits for the answer.
//
//   open -n build/WiFiAnalyzer.app --args --run <name> [--seconds N]      (run.sh does this)
import AppKit
import CoreLocation
import CoreWLAN

final class LogFile {
    private let handle: FileHandle
    let path: String
    init(_ path: String) throws {
        self.path = path
        if !FileManager.default.fileExists(atPath: path) { FileManager.default.createFile(atPath: path, contents: nil) }
        guard let h = FileHandle(forWritingAtPath: path) else { throw CocoaError(.fileWriteNoPermission) }
        handle = h
        handle.seekToEndOfFile()
    }
    func write(_ lines: [String]) {
        guard !lines.isEmpty else { return }
        handle.write((lines.joined(separator: "\n") + "\n").data(using: .utf8)!)
    }
}

final class Analyzer: NSObject, NSApplicationDelegate, CLLocationManagerDelegate {
    let opts: Options
    let location = CLLocationManager()
    let client = CWWiFiClient.shared()
    var started = false
    var observations: NewObservations
    var scanLog: LogFile!, linkLog: LogFile!, runLog: LogFile!
    var timers: [Timer] = []
    var window: NSWindow!
    var textView: NSTextView!
    var statusLines: [String] = []
    var writtenScans = 0, writtenNetworks = 0, hiddenBssid = 0

    init(opts: Options) {
        self.opts = opts
        observations = NewObservations(startedAt: Date(), maxAge: opts.maxAge)
    }

    var runDir: String { opts.captureDir + "/" + opts.run }

    // MARK: app lifecycle

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        buildWindow()
        do {
            try FileManager.default.createDirectory(atPath: runDir, withIntermediateDirectories: true)
            scanLog = try LogFile(runDir + "/airscan.tsv")
            linkLog = try LogFile(runDir + "/linklog.tsv")
            runLog = try LogFile(runDir + "/runlog.tsv")
        } catch {
            show("Cannot write to \(runDir): \(error.localizedDescription)")
            return
        }
        mark("macscan start run=\(opts.run) scan-every=\(plainNumber(opts.scanEvery))s link-every=\(plainNumber(opts.linkEvery))s (reads the macOS scan cache; sends nothing)")
        show("Run folder: \(runDir)")
        // The link needs no permission, so it is logged from the start.
        sampleLink()
        timers.append(Timer.scheduledTimer(withTimeInterval: opts.linkEvery, repeats: true) { [weak self] _ in self?.sampleLink() })
        show("Logging this Mac's link every \(plainNumber(opts.linkEvery)) s. Waiting for Location Services (needed for network names and BSSIDs)...")
        show("If no prompt appears: System Settings > Privacy & Security > Location Services > Wi-Fi Analyzer: on.")
        NSApp.activate(ignoringOtherApps: true)
        if opts.seconds > 0 {
            Timer.scheduledTimer(withTimeInterval: opts.seconds, repeats: false) { _ in NSApp.terminate(nil) }
        }
    }

    // macOS shows the Location prompt only to the app in front, so ask once the window is active (and again
    // each time it comes to the front while still undecided). Also checks for a switch flipped in Settings.
    func applicationDidBecomeActive(_ notification: Notification) {
        if location.delegate == nil { location.delegate = self }   // the delegate is told the current status at once
        else { locationManagerDidChangeAuthorization(location) }
    }

    func applicationWillTerminate(_ notification: Notification) {
        if runLog != nil {
            mark("macscan stop: \(writtenScans) cache updates, \(writtenNetworks) network lines")
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    // MARK: Location Services

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorized:
            show("Location Services: allowed.")
            mark("location authorized")
            start()
        case .denied, .restricted:
            show("Location Services: denied. Network names and BSSIDs stay hidden, so nothing is logged.")
            show("Allow WiFiAnalyzer in System Settings > Privacy & Security > Location Services, then run it again.")
            mark("location denied: not scanning")
        @unknown default:
            show("Location Services: unknown status \(manager.authorizationStatus.rawValue)")
        }
    }

    // MARK: logging

    func start() {
        guard !started else { return }
        guard let iface = client.interface() else {
            show("No Wi-Fi interface found.")
            mark("no Wi-Fi interface")
            return
        }
        started = true
        show("Interface \(iface.interfaceName ?? "?"). Reading the scan cache every \(plainNumber(opts.scanEvery)) s.")
        readCache()
        timers.append(Timer.scheduledTimer(withTimeInterval: opts.scanEvery, repeats: true) { [weak self] _ in self?.readCache() })
    }

    /// Milliseconds since macOS last heard this network, from the CoreWiFi record behind CWNetwork. Private and
    /// read-only; nil if this macOS does not have it, and then NewObservations falls back to change detection.
    func ageMs(_ n: CWNetwork) -> Double? {
        guard n.responds(to: NSSelectorFromString("coreWiFiScanResult")),
              let r = n.value(forKey: "coreWiFiScanResult") as? NSObject,
              r.responds(to: NSSelectorFromString("age")),
              let age = r.value(forKey: "age") as? NSNumber else { return nil }
        return age.doubleValue
    }

    func readCache() {
        guard let iface = client.interface() else { return }
        let now = Date()
        let cached = iface.cachedScanResults() ?? []
        var entries: [CacheEntry] = []
        var noBssid = 0
        for n in cached {
            guard let ch = n.wlanChannel, let b = n.bssid else { noBssid += 1; continue }
            let band: Int
            switch ch.channelBand {
            case .band2GHz: band = 2
            case .band5GHz: band = 5
            case .band6GHz: band = 6
            default: continue
            }
            guard let name = channelName(bandGHz: band, channel: ch.channelNumber) else { continue }
            let heard = ageMs(n).map { now.addingTimeInterval(-$0 / 1000) }
            entries.append(CacheEntry(bssid: b, channel: name, signal: n.rssiValue, name: n.ssid, heardAt: heard))
        }
        hiddenBssid = noBssid
        let (stamp, fresh) = observations.take(entries, now: now)
        guard !fresh.isEmpty else {
            show("\(utcStamp(now)) cache: \(cached.count) networks, none new since the last write (macOS has not scanned)")
            return
        }
        let t = utcStamp(stamp)
        let lines = fresh.compactMap { scanLine(time: t, bssid: $0.bssid, channel: $0.channel, signal: $0.signal, name: $0.name) }
        scanLog.write(lines)
        writtenScans += 1
        writtenNetworks += lines.count
        var bands: [String: Int] = [:]
        for e in fresh { bands[String(e.channel.prefix(2)), default: 0] += 1 }
        let byBand = "2.4 GHz \(bands["2g"] ?? 0), 5 GHz \(bands["5g"] ?? 0), 6 GHz \(bands["6g"] ?? 0)"
        show("\(utcStamp(now)) wrote \(lines.count) networks heard at \(t) (\(byBand))" + (noBssid > 0 ? "; \(noBssid) without a BSSID" : ""))
    }

    func sampleLink() {
        guard let iface = client.interface() else { return }
        let t = utcStamp(Date())
        let rssi = iface.rssiValue()
        guard rssi != 0, let ch = iface.wlanChannel() else {
            linkLog.write([notConnectedLine(time: t)])
            return
        }
        let band = ch.channelBand == .band2GHz ? 2 : ch.channelBand == .band5GHz ? 5 : ch.channelBand == .band6GHz ? 6 : 0
        let noise = iface.noiseMeasurement()
        linkLog.write([linkLine(time: t, device: iface.interfaceName ?? "wifi", signal: rssi, noise: noise == 0 ? nil : noise,
                                channel: channelName(bandGHz: band, channel: ch.channelNumber), rateMbps: iface.transmitRate())])
    }

    func mark(_ note: String) { runLog?.write([noteLine(time: utcStamp(Date()), note: note)]) }

    // MARK: window

    func show(_ line: String) {
        print(line)
        statusLines.append(line)
        if statusLines.count > 200 { statusLines.removeFirst(statusLines.count - 200) }
        textView?.string = statusLines.joined(separator: "\n")
        textView?.scrollToEndOfDocument(nil)
    }

    func buildWindow() {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 760, height: 360),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Wi-Fi Analyzer: \(opts.run)"
        let scroll = NSTextView.scrollableTextView()
        scroll.frame = window.contentView!.bounds
        scroll.autoresizingMask = [.width, .height]
        textView = scroll.documentView as? NSTextView
        textView.isEditable = false
        textView.font = NSFont.monospacedSystemFont(ofSize: 11, weight: .regular)
        window.contentView!.addSubview(scroll)
        window.center()
        window.makeKeyAndOrderFront(nil)
    }

    func buildMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(NSMenuItem(title: "Quit Wi-Fi Analyzer", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        appItem.submenu = appMenu
        NSApp.mainMenu = main
    }
}

// MARK: - main

let opts: Options
do {
    opts = try parseOptions(Array(CommandLine.arguments.dropFirst()), home: NSHomeDirectory(),
                            env: ProcessInfo.processInfo.environment, now: Date())
} catch {
    let msg: String
    if case OptionError.bad(let m) = error { msg = m } else { msg = "\(error)" }
    FileHandle.standardError.write("WiFiAnalyzer: \(msg)\n".data(using: .utf8)!)
    exit(2)
}
let app = NSApplication.shared
app.setActivationPolicy(.regular)
let analyzer = Analyzer(opts: opts)
app.delegate = analyzer
app.run()
