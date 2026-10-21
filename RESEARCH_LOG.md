# Research log

## 2026-10-11 — Merge build planner and sourcing plan into one site

- Start: 2026-10-11 20:30 UTC
- End: 2026-10-11 21:20 UTC (approx.)
- Duration: about 50 minutes

### Question
Build the merged five-tab site described in `merge-strategy.md` from the two existing Netlify sites.

### Sources
- https://humanoid-build-planner.netlify.app (index.html, styles.css, app.js, data.js, classes.js, bom.js, robot.js), fetched 2026-10-11.
- https://humanoid-compliance-notes.netlify.app, fetched 2026-10-11.
- https://humanoid-sourcing-plan.netlify.app — HTTP 404 "Not Found" on fetch; Netlify project `a905d604-59ef-40ea-a382-ae74e6680f47` shows an empty `currentDeploy`, and its deploy id returned 404 from the Netlify API.
- GitHub `MDeanH/humanoid-sourcing-plan` — empty repository (no branches, no commits) at session start.
- world-atlas 2.0.2 `land-110m.json` (jsdelivr); d3-geo 3.1.1, d3-array 3.2.4, topojson-client 3.1.0 (jsdelivr).

### Conclusion
The build planner's content was fully recoverable and is the basis of the Overview, Robot, and Checklist tabs. The sourcing-plan site described in the merge strategy (robot SVG with pins, globe with supplier pins, timeline, capital estimates, physical space, events, contacts) has never been deployed and has no source in the repo, so its content could not be recovered. The Robot, Globe, and Timeline tabs were rebuilt from the build planner's per-part origin notes and the compliance notes' component-by-component guide. Supplier pins are candidates or third-party-reported names from those notes, placed at HQ or main-plant cities. Timeline milestones are either fixed regulatory dates from the notes or proposed sequencing back-planned from January 1, 2028. The build planner's 3D viewer (three.js) was not carried over; the merge strategy marks it optional and prefers the SVG.

### Open questions
- Does a copy of the original sourcing-plan site exist locally (capital estimates, physical space, events, contacts tabs)? If so, that content can be merged in; none of it is on Netlify or GitHub.
- Supplier HQ locations and the Allied Motion → Allient rename are from general knowledge and were not verified by web search in this session.
- Should the merged site keep the X2, A3, and D1 classes from the build planner? This build models the A2 Ultra class only. (Answered in the next entry: the 3D viewer carries all four classes.)

## 2026-10-12 — 3D viewer port and SpaceX design-language research

- Start: 2026-10-11 21:05 UTC (approx.)
- End: 2026-10-12 02:50 UTC (approx.)
- Duration: about 5 hours 45 minutes, nearly all of it a background multi-agent workflow (research and port in parallel, then rounds of independent browser QA and fixes). The workflow was stopped by the user's request during fix round 1 to wrap up.

### Question
Add the build planner's 3D robots to the merged site, and improve the site design in the style of spacex.com.

### Sources
- Build planner source (app.js, robot.js, data.js, classes.js, bom.js), re-read in full from the deployed site; a runnable baseline copy was used for visual and behavioral comparison.
- spacex.com: per the research agent, WebFetch returned only the title because the site is an Angular single-page app, so it fetched the HTML shell with curl, then the global stylesheet, the main bundle, and 67 lazy chunks to read the actual tokens, fonts, and component CSS. Third-party "design system" write-ups were used only as corroboration and conflict with the live CSS in places; the agent says several look machine-generated. I have not independently re-checked the agent's reading of spacex.com.
- Google Fonts css2 endpoints, checked by the agent for Barlow, Barlow Semi Condensed, Saira Semi Condensed, Titillium Web, Roboto Mono, JetBrains Mono, and Geist Mono.
- three.js (vendored from the build planner's deploy) and the viewer's own headless-Chromium test suites (about 224 assertions by the author) plus three independent QA lenses (functional, visual, lifecycle) over two rounds.

### Conclusion
- The 3D viewer ported cleanly into a mountable module with a full and a hero variant. Verified in a final smoke test: all four classes plus both and lineup load at 1440 and 390 px with zero console errors and zero failed requests, A2 example plan scores 70.0%, and the hero renders on a transparent background.
- Design language (agent's reading of the live CSS, saved in `docs/design-spec.md`): pure black canvas, one near-white (`#F0F0FA`) used at stepped opacities, D-DIN for UI and headings, Roboto Mono for data, uppercase tracked labels, 1 px hairlines, one 4 px ghost button that inverts on hover, no accent color, no cards or shadows, one viewport-tall scene per message, slow eased motion. Closest free fonts: Barlow family for display, Roboto Mono or JetBrains Mono for data.
- QA round 0 found 4 major and 16 minor issues; 19 were fixed. Round 1 found 4 different major issues (tablet-width layout, a camera NaN when setView runs on a zero-size stage, framing when changed while hidden) plus minors. Fix round 1 was interrupted, so those are listed in `agent/memory/handoff.md` as reported but not re-tested.
- Not done: wiring the viewer into the page, the hero on the Overview, and the redesign itself. The live site is unchanged.

### Open questions
- Is a SpaceX-style monochrome palette acceptable for a compliance tool whose pass, fail, and open states are currently color coded? The design spec suggests shape and label first, with a single desaturated tint as a last resort.
- The origin colors (US green, China red, third-country amber) carry meaning on the globe and in the planner; the redesign needs a decision on whether they stay.
- Should `dev/` and `docs/` be excluded from the public Netlify publish?

## 2026-10-12 — Robot-first turntable site, SpaceX-style redesign, three-way review

- Start: 2026-10-12 03:05 UTC (approx.)
- End: 2026-10-12 04:55 UTC (approx.)
- Duration: about 1 hour 50 minutes of wall-clock time, with a background agent building the interactive robot variant in parallel for most of it and three independent review agents running at the end.

### Question
Make the robot the first and main page, have the pages spin around on a turntable, make clicking a part spin around to the globe, and raise the design quality in the style of spacex.com.

### Sources
- `docs/design-spec.md` (the earlier research: the agent's reading of spacex.com's own stylesheet), applied as the design system. I did not re-check spacex.com this session.
- The existing build planner data and viewer, and the site data carried over from the first merged site.
- Google Fonts css2 endpoints for Barlow (400 to 700) and Roboto Mono (400, 500), checked with a 200 and real font-face blocks.
- Headless Chromium (Playwright) runs: about 60 behaviour checks across three suites, screenshots at six viewport sizes, frozen mid-spin frames captured by pausing the ring's Web Animation, and three independent review agents (visual design against the spec; behaviour and robustness including hostile URLs and failure injection; accessibility and performance with axe-core and timing measurements).

### Conclusion
- Interpretation: "pages spin around on a turntable" was built as six stations on the faces of a CSS 3D drum that spins to the target, with a mid-spin pull-back; the robot also takes a turn of its own as the ring leaves it. "Clicking on parts spins around to the globe" is the robot turning to the part, then the ring spinning to the globe, filtered to that part's suppliers. This reading was my own; the user can redirect.
- The interactive robot (transparent canvas, hotspots, drag, turntable, `spinTo`) was built as a new viewer variant by a background agent against a written contract, and passed its own checks and mine.
- Review outcomes: the visual review found 4 must-fix, 8 should-fix and several polish items (hint and focus-bar collisions, label legibility over the silver body, a Planner that broke the flat language, off-palette bars, off-axis left edges, a leaky mobile menu, dim past milestones). The accessibility review found 7 major issues (skip link, arrow-key collisions, hotspot tab order, menu semantics, tap targets, reduced-motion globe, clipped menu at 360 px) and two performance majors (the full 3D stack downloaded on every cold load; an import waterfall). The behaviour review found 2 majors (a malformed URL escape or a prototype-key value killed the boot; focus lost after every globe filter click) and 9 minors. All were fixed except the items listed below, and each fix has a regression check in `tests/e2e/`.
- Measured: memory is flat over 60 navigations (about 14.4 MB), hidden stations cost 0 animation frames, WebGL contexts stay at two, layout shift is under 0.03 everywhere. The 3D engine no longer loads on a cold load of any station other than the robot or the planner.

### Open questions
- Real-device performance is unmeasured: the test browser renders WebGL in software at about 3 fps.
- Not fixed: hotspots do not test occlusion; the Planner still looks denser than the other stations; fonts are not self-hosted; assets are not fingerprinted for long caching; two WebGL driver warnings per load come from the software renderer.
- Is the muted tint on origin and status (US, China, third country; confirmed, in progress, open) acceptable, or should the site go purely monochrome?
- Should `dev/`, `docs/`, `tests/` and `agent/` be hidden from the public deploy?

## 2026-10-12 — A2 Ethernet, depth-camera recording, LilyGO pairing

- Start: 2026-10-12 07:40 UTC (approx.)
- End: 2026-10-12 08:30 UTC (approx.)
- Duration: about 50 minutes, mostly searches and two page fetches.

### Question
The A2 has an Ethernet port: how do we listen on it? How do we scan and record objects with the A2's RGB-D camera, and what is the Pi 5's role? How do a T-Deck and a LilyGO LoRa32 T3 V1.6.1 (marked 868/915) work together?

### Sources
- AgiBot A2 Ultra product page https://www.agibot.com/products/A2_Ultra (RGB-D head camera listed; no Ethernet port listed).
- AgiBot AimDK A2 sensor-data guide https://open.agibot.com/docs/en/aimdk/a2/v2_0/dev_guide/07-04-sensor_data (sensors as ROS 2 topics; only the listing was read).
- AgiBot X2 SDK notes (ROS 2 Humble, wired addresses 10.0.1.2 and 10.0.1.41; developer mode disables native motion control). X2, not A2.
- Meshtastic hardware page for the TTGO LoRa32 https://meshtastic.org/docs/hardware/devices/community-supported/lilygo/lora/ (firmware support phased out; recommends T3S3; battery note).
- Meshtastic Python CLI page https://meshtastic.org/docs/software/python/cli/ (install, `--set`, `--sendtext`, `--nodes`).
- LilyGO wiki and ESPHome device page for the T3 V1.6.1 (specs, SX1276/SX1278).
- Meshtastic community forum posts on message size (about 200 bytes; unofficial).

### Conclusion
- The A2's Ethernet addressing and purpose are unverified. First step is a look-only capture. For passive capture prefer a managed switch with a mirror port; a Pi 5 inline bridge works in principle but is untested and puts the Pi in the path.
- Depth recording is feasible in principle through the documented ROS 2 sensor topics and rosbag2, with offline reconstruction on the Mac mini. Subscribing is not purely passive. No topic names, access method or reconstruction results were verified.
- The T3 V1.6.1 is a fixed-node board; the T-Deck is the handheld. Meshtastic marks the T3 as phased out, so this link may not survive firmware updates. The 868/915 marking means the SX1276 version, region US for Florida.
- Written up in `lab/ethernet-and-scan.md` and `lab/status-link.md`.

### Open questions
- How is the A2's Ethernet port addressed, and is it a developer port?
- Can the A2's sensor topics be read from an external machine, and does that need developer mode or affect the warranty?
- Does the current Meshtastic firmware still run on the T3 V1.6.1 (silkscreen 20210134)?
- Is the default Meshtastic channel key public (believed yes, unverified)?
- Does a Pi 5 keep up with recording RGB-D at full rate?

## 2026-10-13 — Venue RF survey with the Flipper and LilyGO boards

- Start: 2026-10-13 17:06 UTC
- End: 2026-10-13 17:20 UTC (approx.)
- Duration: about 15 minutes, mostly searches.

### Question
How can one analysis with the Flipper Zero and the LilyGO boards help prevent interference with the A2 Ultra at the convention center?

### Sources
- Flipper docs, Sub-GHz https://docs.flipper.net/zero/sub-ghz (CC1101 bands 300-348, 387-464, 779-928 MHz; Frequency Analyzer exists). The -90 dBm threshold and "strongest signal only" behaviour came from a community mirror of older docs, unverified on current firmware.
- FCC jammer enforcement https://www.fcc.gov/general/jammer-enforcement (Section 333 and related penalties).
- Smart City Holdings fine for Wi-Fi blocking at convention centers including OCCC https://www.hotel-online.com/news/fcc-fines-tech-company-over-wi-fi-blocking ; Marriott Gaylord Opryland fine https://test.tsnn.com/node/848966 .
- Example exhibitor network policies banning exhibitor access points: SC conference https://sc22.supercomputing.org/scinet/scinet-exhibitors/sc-network-policy/index.htm ; a sample contract clause https://lawinsider.com/clause/wireless/_4 . OCCC's own policy was not found.
- LilyGO T-Deck wiki https://wiki.lilygo.cc/get_started/en/Wearable/T-Deck/T-Deck.html (ESP32-S3, 2.4 GHz Wi-Fi only, SX1262).

### Conclusion
- The Flipper covers the sub-GHz bands, so it can find the e-stop remote's band (if it is in range) and watch it on site. The LilyGO boards cover 915 MHz LoRa and 2.4 GHz. None of them see 5 GHz, so the Pi 5 does the Wi-Fi survey.
- Nothing we own can or may stop other people's radios. The survey's value is channel choice, a go or no-go on the e-stop and status link, and data for the venue's IT team.
- Venue rules may ban exhibitor access points, which would replace the lab Wi-Fi plan with a venue-provided network. Check the exhibitor kit first.
- Written up in `lab/venue-survey.md`. The Wi-Fi log one-liner was tested only on sample `iw` output.
- From general knowledge, not searched this session: 2.4 GHz channels 1, 6, 11 do not overlap; US 5 GHz channels 36-48 and 149-165 are outside the radar-sharing range; venue intrusion-prevention systems can contain rogue access points; the Meshtastic screens show signal, SNR and channel use.

### Open questions
- Which convention center and show, and what does its exhibitor wireless policy say?
- What band is the A2's e-stop remote on? Does the A2 support 5 GHz Wi-Fi?
- Does the Flipper own a Wi-Fi devboard? It would add a 2.4 GHz view but not 5 GHz.

## 2026-10-13 — Mac mini for the venue Wi-Fi survey

- Start: 2026-10-13 17:10 UTC
- End: 2026-10-13 17:16 UTC (approx.)
- Duration: about 6 minutes.

### Question
Can the Mac mini do the venue survey's Wi-Fi part instead of the Pi 5?

### Sources
- Intuitibits on the `airport` deprecation and `wdutil` https://www.intuitibits.com/fp8g ; Apple developer forums https://developer.apple.com/forums/thread/749274 and https://developer.apple.com/forums/thread/802997 (redacted network names on Tahoe).
- Jamf community on `wdutil info` redaction from 14.5 https://tucwu38334.lithium.com/t5/jamf-pro/collecting-active-ssid-with-macos-sonoma-14-4-and-later/m-p/311680 .
- iMore and How-To Geek guides to Wireless Diagnostics Scan https://www.imore.com/how-use-macos-wireless-diagnostics-get-best-possible-wifi-settings-your-area , https://www.howtogeek.com/211034/troubleshoot-and-analyze-your-mac%E2%80%99s-wi-fi-with-the-wireless-diagnostics-tool .
- Retailer listings for the M5 Pro Mac mini with Wi-Fi 7 (Apple N1), e.g. https://www.scan.co.uk/products/mac-mini-apple-m5-pro-chip-with-15core-cpu-and-16core-gpu-24gb-512gb-ssd . Not checked against Apple's spec page.

### Conclusion
- Yes for Wi-Fi, through the Wireless Diagnostics Scan window, captured as screenshots. A scripted log is unreliable on current macOS because of the `airport` removal and name redaction.
- Its advantage over the Pi 5 is 6 GHz, if the model has Wi-Fi 6E or 7. Its drawback is portability, so it covers the booth and the Pi covers the walk.
- Added to `lab/venue-survey.md`.

### Open questions
- Which Mac mini model and macOS version does Michael have?
- Does the Scan window still exist and still show nearby networks unredacted on the current macOS?

## 2026-10-13 — Signal loss at a convention center: survey method and scripts

- Start: 2026-10-13 17:01 UTC (approx.)
- End: 2026-10-13 17:20 UTC (approx.)
- Duration: about 19 minutes: twelve searches, three page fetches, writing and stub-testing three scripts, and merging with a parallel session's venue note.

### Question
The A2 Ultra loses signal inside the convention center. How do we run a signal analysis to prevent it?

### Sources
- AgiBot A2 Ultra product page https://agibot.com/products/A2_Ultra (Wi-Fi and 4G/5G) and AimDK A2 overview v1.3 https://open.agibot.com/docs/en/aimdk/a2/v1_3/dev_guide/01-a2_overview (Orin hotspot; from V1.2 the x86 Wi-Fi carries internet traffic, else the 5G module; debug ports 192.168.2.50 fixed and DHCP). Fetched.
- FIRST Tech Challenge wireless troubleshooting at events (ping thresholds, retry rates, interference sources, non-radio causes, jamming illegal). Fetched.
- Clearpath Robotics Wi-Fi fundamentals (-67 good, -75 poor; 20 MHz in congested spaces; DFS channel breaks; more APs at lower power). Fetched.
- Supercomputing (SCinet) network policies 2017 to 2026 and ExCeL London wireless policy (exhibitor access points and hotspots banned or need approval). Search snippets only.
- FCC fines: Marriott $600,000 (2014), Smart City $750,000 (2015) for blocking hotspots at venues. Several news sources agree.
- Body loss: UCC outdoor body-to-body study (up to 40 dB at 2.45 GHz), a 2 to 6 GHz tissue thesis (loss rises with frequency). Snippets only; no crowd-level figure found.
- Tools: Apple forum threads on the `airport` CLI retirement in Sonoma 14.4 and `wdutil`; 2017-18 posts on AirPort Utility's iOS scanner; field-test mode guides; tinySA Ultra reviews.
- Convention center DAS press releases (Las Vegas, San Diego, Hawaii): neutral-host in-building cellular is common but varies by venue and carrier.

### Conclusion
- First split the problem by link: iPad-to-robot Wi-Fi (control), robot-to-internet (Wi-Fi or 5G), the e-stop remote, or a non-radio cause such as brown-outs while walking. Each has a different fix.
- Venues commonly ban or require approval for exhibitor access points, which includes the robot's own hotspot; ask the venue's network provider for approval, a clean 5 GHz non-DFS channel, a wired drop, and the DAS carrier list. They may not jam, by FCC precedent.
- Measure at the booth twice, at load-in and during show hours, because crowds add both bodies in the path and competing radios.
- Fix order: wire what you can, then a venue-assigned clean channel at 20 MHz, then short line-of-sight links with the access point above the crowd, then neighbour coordination; do not depend on cellular for control.
- Written up in `lab/venue-dropouts.md`, with `lab/linklog.sh`, `lab/airscan.sh` and `lab/survey-summary.sh`, tested against stubbed `iw`, `ping` and `wdutil` output only.
- A parallel session wrote `lab/venue-survey.md` (one-time receive-only RF survey: exhibitor rules, Flipper e-stop band, LoRa, Mac scan window) at the same time. I renamed mine, cut the overlap, and cross-linked the two.

### Open questions
- How does the A2 control app connect: the robot's hotspot, or a network both join? Which Wi-Fi generation and bands does the A2 support?
- What does the A2 do when the e-stop remote's link drops, and what band does the remote use?
- Can the control app or the demo run over a wired port?
- Does the Pi 5's built-in Wi-Fi report station retries and survey (channel busy) counters? Many drivers report only part of them.
- Is the `wdutil info` format assumed in `linklog.sh` right on the current macOS?
- Which venue, and what are its wireless policy and in-building cellular carriers? The parallel session's sources tie the 2015 Smart City fine to the Orange County Convention Center, among others; whether that is our venue is unknown.

## 2026-10-13 — Wi-Fi analyzer on the Mac mini, iPhone, T-Deck, LoRa32 and watch

- Start: 2026-10-13 17:57 UTC
- End: 2026-10-13 19:27 UTC (commit time; corrected, the first draft of this entry said 19:40)
- Duration: about 1 hour 30 minutes, building and testing on the real devices at the Mac's desk.

### Question
Build a listen-only Wi-Fi signal analyzer across the Mac mini, the iPhone, the T-Deck and (if a Wi-Fi Devboard exists) the Flipper, logging in one format that `lab/survey-summary.sh` reads. Mid-session Michael added the LilyGO LoRa32 (as Paxcounter) and the ESP32 watch, linked as a group that feeds the T-Deck and the watch.

### Sources
- CoreWLAN SDK headers and the runtime method list of `CWInterface`/`CWNetwork` on macOS 27.2; airportd's unified log during test scans (scan types per channel; the entitlement refusal).
- Xinyuan-LilyGO/T-Deck at `1dddf6e` (examples/UnitTest/utilities.h, SD.ino, Keyboard_T_Deck_Master.ino, TFT_eSPI Setup210), its README and firmware/README.MD; LilyGO T-Deck wiki pages (the URL in the brief now returns 404; current pages under wiki.lilygo.cc/products/t-deck-series/).
- https://flasher.meshtastic.org (HTTP 200, lists LILYGO T-Deck) and https://api.meshtastic.org/resource/deviceHardware (T_DECK, target `t-deck`).
- arduino-esp32 2.0.11 `WiFiScan.cpp` (scan timeout), 2.0.17 and 3.3.10 headers; TFT_eSPI issue #3329.
- cyberman54/ESP32-Paxcounter at `92784cc` (shared/hal/ttgov21new.h, paxcounter_orig.conf, build.py); libpax `blescan.cpp` (passive BLE scan).
- `smart_nori_rover/esp32_nodes/nori_watch_control` README and source (watch pins, display init, verification ledger).

### Conclusion
- A passive Wi-Fi scan cannot be requested on macOS by an ordinary app. The public CoreWLAN scan probes actively on all 2.4 GHz channels, non-radar 5 GHz and the 6 GHz PSC channels (airportd log); the private call with a scan type is refused without Apple's `com.apple.wifi.scan` entitlement. The Mac app therefore reads macOS's own scan cache (per-network age gives the time each was heard) and sends nothing. Idle and connected, this Mac refreshed that cache once in five minutes, so its network log is sparse snapshots. Its link log (every second) works; the network log is unverified until Location Services is allowed.
- iPhone: the dashboard loaded in Safari on the iPhone 17 Pro Max over Wi-Fi (after one HTTPS attempt, which the server now tolerates) and its link test logged 457 pings, 0 lost, 55 ms average, worst 1.3 s. iOS offers no Wi-Fi scan API, so the phone shows the Mac's scans.
- T-Deck: every pin in the brief matches LilyGO's examples. Passive scans work after working around core 2.0.11's early "scan failed" (it times out at 20x the dwell while the driver is still scanning). It heard 3-4 networks on 2.4 GHz where the Mac's cache held about 18, most at -80 to -95 dBm; pausing Bluetooth did not help, so its antenna is the likely limit.
- LoRa32 (T3 V1.6.1, ESP32-PICO-D4) runs Paxcounter built listen-only (LoRaWAN, OTA and boot menu off) with a patch that broadcasts its count. Counts of 2-4 Wi-Fi devices per 60 s window at the desk. It previously ran the Nori teleop remote; no flash backup was taken, at Michael's request; the source is in smart_nori_rover.
- Watch: the analyzer replaced Nori's watch firmware. Its scans (3-7 networks) and adverts were heard by the T-Deck while it ran on its own battery. Its USB serial worked with this firmware, though the Nori README records that it never had.
- Group link: non-connectable BLE adverts, 1 per second at 0 dBm, company ID 0xFFFF; T-Deck and watch listen passively. Verified both ways on the bench (T-Deck hears LoRa32 and watch; watch shows LoRa32 and T-Deck, including the T-Deck's tracked network).
- Flipper: skipped; Michael has no Wi-Fi Devboard.
- Existing script: `lab/airscan.sh` uses `iw dev <if> scan`, which is an active scan (probe requests); `iw ... scan passive` would match the listen-only rule. Not changed here.
- Written up in `lab/wifi-analyzer/README.md`; tests in `lab/wifi-analyzer/test.sh`.

### Open questions
- Does macOS scan more often at the venue (weaker signal, roaming) than at the desk? The Mac's network log depends on it.
- What does each screen look like on the glass, and do the trackball, keys and watch touch behave? Frame-buffer screenshots were checked; the panels and inputs were not.
- Were the watch's three unexplained page changes in 90 s phantom touches? A stricter touch check is built but not yet flashed.
- Does the LoRa32 have an SD card, and does Paxcounter's table on it work?
- Raspberry Pi 5 version (asked for at the end of the session): its built-in Wi-Fi covers 2.4 and 5 GHz, not 6 GHz; whether brcmfmac honours `iw scan passive` is unverified.

## 2026-10-13 — Raspberry Pi 5 version of the Mac's job

- Start: 2026-10-13 19:00 UTC (approx.; the Pi request came in during the first entry's work)
- End: 2026-10-13 19:40 UTC (commit time; corrected, the first draft said 20:10, a guess written before checking the clock)
- Duration: about 40 minutes, on the Mac; no Pi was reachable.

### Question
Build a Raspberry Pi 5 OS that does what the Mac does (scan, log, serve the iPhone), for portability, with the Pi's Wi-Fi limits understood.

### Sources
- raspberrypi/linux rpi-6.12.y, `drivers/net/wireless/broadcom/brcm80211/brcmfmac/cfg80211.c` (brcmf_escan_prep: with no SSIDs, "Performing passive scan", `BRCMF_SCANTYPE_PASSIVE`).
- iw `scan.c` (the `passive` argument omits NL80211_ATTR_SCAN_SSIDS).
- Raspberry Pi OS Lite arm64 2026-10-06 (Trixie) image from downloads.raspberrypi.com, SHA-256 verified; its /var/lib/dpkg/status, apt sources and cloud-init files read with debugfs and mtools.
- Package indexes: archive.raspberrypi.com/debian trixie main arm64 (Packages.gz; there is no .xz) and deb.debian.org trixie main arm64.

### Conclusion
- The Pi 5's built-in radio covers 2.4 and 5 GHz, not 6 GHz. Unlike the Mac it can be asked for a passive scan: `iw scan passive` sends no SSID list and brcmfmac then scans passively (from the source; unverified on hardware). It can scan every 10 s and sees network names without a permission prompt.
- NetworkManager scans actively while it manages an unconnected Wi-Fi device, so the image marks wlan0 unmanaged; `WIFI_CLIENT=yes` reverses that.
- Built `pi5/make-image.sh` (Raspberry Pi OS Lite plus the analyzer, edited with debugfs and mtools, no mounting) and `pi5/install.sh`. The image passes e2fsck, contains every program the services call, and bundles usbmuxd plus four libraries for iPhone USB tethering. Services: passive scans, a raw-HCI passive Bluetooth listener for the group (`group.tsv`), and the dashboard with a new Group tab.
- `lab/airscan.sh` (`iw scan` without `passive`) sends probe requests; noted, not changed.
- Nothing has run on a Pi yet.

### Open questions
- Does the image boot and do the services start? Is brcmfmac's scan really passive (check with its dynamic debug output)?
- Does iPhone USB tethering need "Allow Others to Join", and does the phone's hotspot Wi-Fi then transmit?
- Does the raw HCI listener coexist with bluetoothd on the Pi 5 (legacy versus extended scan commands)?
- Do the bundled .debs install against the image's newer library versions?

## 2026-10-13 — Location map with signal analysis

- Start: 2026-10-13 19:40 UTC
- End: 2026-10-13 19:47 UTC
- Duration: about 7 minutes.

### Question
Add a location map to the signal analysis.

### Sources
None beyond this repo. GPS does not work indoors, and browsers give the Geolocation API only to secure (HTTPS) pages, so Safari would not offer it on this plain-HTTP dashboard (general knowledge, not tested here).

### Conclusion
- Built a walk-and-tap map in the dashboard. Upload a floor plan, tap where you stand, and the spot records what the moving devices measure there: the phone's link test over the last 20 s, the T-Deck's tracked signal, the scanner's reading of the tracked network and the LoRa32's crowd count. Each reading is kept only if recent enough, so one measured elsewhere is not attributed to the spot.
- The map colours spots and fills between them by inverse-distance weighting, limited to the neighbourhood of measured spots. `survey-summary.sh` gains a per-spot table with a worst-of verdict.
- Tested with unit tests (freshness rules, append-only undo, upload) and in the browser at phone width with synthetic spots. Not yet walked with the real devices.

### Open questions
- Is a 20 s window per spot right? A shorter one is quicker to walk; a longer one catches more intermittent drops.
- Should the T-Deck mark spots itself (a key that sends a "mark" in its advert), so the phone is not needed for marking?

## 2026-10-15: Fact-check of a Grok summary (IFS Unleashed, unions, A2 compute, Nori)

Start 17:25 UTC, end 17:35 UTC, about 10 minutes.

### Sources
- IFS announcement, 17 Dec 2025: https://www.ifs.com/news/corporate/ifs-announces-ifs-unleashed-and-ifs-connect-series
- NVIDIA Jetson AGX Orin technical brief: https://nvidia.com/content/dam/en-zz/Solutions/gtcf21/jetson-orin/nvidia-jetson-agx-orin-technical-brief.pdf
- TechForce TIM-E press release (company-issued): https://www.nasdaq.com/press-release/techforce-robotics-deploys-tim-e-autonomous-service-robot-del-mar-california-hotel and Hotel Dive: https://www.hoteldive.com/news/hotel-robot-labor-efficiency/813064/
- Hotel Trades Council contract summary: https://hotelworkers.org/news/enhanced-job-security
- AimDK A2 overview v1.3 (already in this log).

### Conclusion
- Confirmed: IFS Unleashed 12-16 Oct 2026 in Orlando. AGX Orin 64GB figures (2048 CUDA cores, 275 INT8 TOPS, 64GB LPDDR5). A2 has an x86 board and an Orin board on Ethernet (AimDK). TIM-E at Homewood Suites Del Mar under robotics-as-a-service, hauling linen and waste bins.
- Contradicted: the NYC hotel agreement (1 Jul 2026 to 30 Jun 2034) requires 120 days' notice and bargaining before new technology, not "up to six months".
- Not verified: IFS ticket prices and attendance, TIM-E's ~$150/day, the $100k housekeeper figure, "two-thirds of UNITE HERE members", the x86 being 16-core or locked, the photographed connector, which radio the e-stop remote uses. Grok wrote "AGBot"; the maker is AgiBot.

### Open questions
- Full text of the NYC technology and wage clauses.
- TIM-E actual pricing (ask TechForce directly).

## 2026-10-20 — Accuracy review of the CHM2045 study guide (chm2045-guide-preview.netlify.app)

- Start: 2026-10-20 21:02 UTC
- End: 2026-10-20 23:45 UTC
- Duration: about 2 h 45 min, of which about 1.5 h was waiting out the account's session usage limit (hit 21:25 UTC, reset 22:30 UTC, review resumed 22:56 UTC).

### Question
Review https://chm2045-guide-preview.netlify.app (General Chemistry I notes, chapters 6 to 9, 24 pages plus the element data behind the periodic-table views) for accuracy.

### Sources
- The site itself, rendered in headless Chromium with all steps revealed, both wordings captured and animation captions sampled; its 77 figure scripts and the exported element data.
- Silberberg and Amateis, Chemistry: The Molecular Nature of Matter and Change, 8th ed. (from knowledge; the publisher's table of contents and the printed figures were not retrievable online).
- NIST ionization energies; https://en.wikipedia.org/wiki/Fluorine_compounds and https://en.wikipedia.org/wiki/Oxidation_state (oxygen and fluorine oxidation states); https://chem-textbook.ucalgary.ca/?p=8102 (effective nuclear charge); Slater's rules.
- Method: agent workflows, one reviewer per page (two on the six overview pages and Worksheet 5), one refuting verifier per finding with a tie-breaker on uncertainty; 40 findings judged, 24 confirmed, 16 rejected. Full report: `docs/chm2045-guide-accuracy-review.md`.

### Conclusion
- All worked-problem answers and multiple-choice keys on the site are correct (every calculation recomputed in Python). Definitions, sign conventions, trends, configurations and the 118-row element table check out, with one exception.
- Substantive: the oxidation-number figure gives O "+6/−2" and F "+7/−1" (chemically impossible; F is −1 only, O at most +2). Root cause is the group-number rule applied to every p-block row in assets/js/elements.js; it shows on Lecture 23, the Lecture 26 fluorine card and the periodic-table tool.
- Ten minor slips (wrong sign in a live calorimeter line, three wrong distractor or sig-fig notes on Worksheet 5, a wrong figure cross-reference, "984 kJ" missing "/mol", a wrong sig-fig justification, "7.4 The nuclear atom" mislabel in three places, nobelium 1.5 vs 1.3, interpolated numbers in mid-sweep captions) and ten loose-wording items, none changing an answer.
- Navigation and constants: all 303 topic links resolve, home-page counts match, constants consistent, no console errors.

### Open questions
- What Silberberg's printed Figure 8.22 lists for O and F, and Figure 9.21 for No; not retrievable online.
- The figure-script text was not reviewed separately and the planned third pass did not run (usage limit), so other mid-animation interpolated readouts may exist.
- Whether the guide should annotate worksheet-inherited oddities (CO2 laser at 1.05 μm, fictional ΔH values in Worksheet 5) consistently; it does so for some and not others.

### Update 2026-10-21 (15:25 UTC)
An independent reviewer rechecked the report and the live site. Outcome recorded in `docs/chm2045-guide-accuracy-review.md` (addendum and remaining-work list). Reversed: the Worksheet 5 Q8 bomb-calorimeter rejection (ΔH − ΔE = −3.7 kJ/mol for benzene, larger than the worksheet's answer). Qualified: "every answer right" (Sample Problem 6.6 is −55.5 unrounded; the textbook's −55.4 is premature rounding). Added: the worksheet's ozone value (−427 kJ vs about −285 kJ from NIST), the Sb2O5 "weakly basic" label (acidic to amphoteric), superoxides in the oxygen wording, a source note for nobelium. Confirmed fixed on the live site: O/F oxidation numbers, Q7/Q9 notes, Q8 ΔE label, SP 6.6, hydrogen energy qualifier, calorimeter dividend, ammonia explanation, Lecture 19 energy labels. Still open on the live site at 15:25 UTC: Sb2O5 label, Q11 ozone note, nobelium source, "7.4 The nuclear atom" on the home page and Lecture 20 (the Chapter 7 topic list no longer shows it), and the sweep readouts (rendered check: interpolated values appear between tiles with an arrow label; a clarity issue, not an error).
