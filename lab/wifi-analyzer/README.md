# Wi-Fi analyzer: Mac mini, iPhone, T-Deck, LoRa32 and watch

Purpose: find out why the A2 Ultra loses its Wi-Fi link in the convention hall, by listening to the radio around the robot from several places at once. It complements `lab/venue-dropouts.md` and `lab/venue-survey.md`.

## Rules

- Listen only. Every Wi-Fi scan is passive (no probe requests). Nothing joins a network, deauthenticates, injects, replays or captures frames, and there are no attack features, not even disabled ones. Nothing here is based on ESP32 Marauder.
- Logs hold only BSSID, channel, signal and network name (and, for the link tests, round-trip times).
- Logs go to `~/robot-lab-captures/<run>/`, or to the boards' own SD cards, never into this repo. They hold other people's network names: keep them private and share only counts per channel.
- The one thing the group transmits is its own status, as a once-a-second Bluetooth advert at 0 dBm (see [Group link](#group-link)). The iPhone's link test sends small requests to our own Mac.

## What each device does

| Device | What it does | Bands | Logs | Status |
|---|---|---|---|---|
| Mac mini (`mac/`) | Logs every network macOS hears, and its own link every second | 2.4, 5, 6 GHz | `airscan.tsv`, `linklog.tsv` | Link log verified on this Mac. Network log waits for Location Services permission: **unverified** |
| iPhone (`web/`) | Dashboard served by the Mac: channels, networks, track, link test | none of its own (iOS has no Wi-Fi scan API) | `iphone-probe.tsv`, `runlog.tsv` on the Mac | Loaded in Safari on the iPhone 17 Pro Max over Wi-Fi; link test verified (457 pings). Add to Home Screen not yet done |
| LilyGO T-Deck (`tdeck/`) | Handheld scanner: channels, networks, track one network; logs to SD | 2.4 GHz only | `/wifi/scanNNN.tsv` on its SD card, and USB serial | Scans, SD card found, keyboard found, group link both ways: verified. Screen content, trackball and keys: **unverified** (see below) |
| LilyGO LoRa32 T3 V1.6.1 (`lora32-paxcounter/`) | Paxcounter: counts Wi-Fi devices nearby (crowd size); sends the count to the group | 2.4 GHz only | Paxcounter's own table on SD, if a card is in | Counting and broadcast verified (heard by the T-Deck). OLED and SD: **unverified** |
| Waveshare ESP32-S3 AMOLED 2.06 watch (`watch/`) | Wrist display of the group, plus its own scan | 2.4 GHz only | none | Runs on its battery; scans and group link verified. Screen content and touch: **unverified** |
| Raspberry Pi 5 (`pi5/`) | The Mac's job without the Mac: passive scans every 10 s, the iPhone dashboard (by USB tethering or Ethernet), and the group's Bluetooth reports | 2.4, 5 GHz | `airscan.tsv`, `survey.tsv`, `linklog.tsv`, `group.tsv`, `iphone-probe.tsv` | Ready-to-flash image built and its contents checked on the Mac. Not yet run on a Pi: **unverified** |
| Flipper Zero (`flipper/`, `devboard/`) | Not built. It has no Wi-Fi radio and needs the official Wi-Fi Devboard, which we do not have | | | Skipped |

The ESP32 boards (T-Deck, LoRa32, watch) hear 2.4 GHz only. The robot's link may well be on 5 GHz, so only the Mac and the Pi 5 see 5 GHz, and only the Mac sees 6 GHz. Without the Mac or the Pi, the iPhone has nothing to show: iOS cannot scan Wi-Fi and Safari cannot hear the group's Bluetooth adverts. The scans then live on the T-Deck and watch screens and the T-Deck's SD card.

"Verified" here means run on the real device on 2026-10-13, at the Mac's desk, not at the venue and not with the robot.

## Shared log format

`lab/survey-summary.sh <run>` reads every device's logs. Tab-separated, no header, one line per network per scan:

```
time	BSSID (lowercase)	channel	signal dBm	name
2026-10-13T19:00:00Z	aa:bb:cc:dd:ee:ff	5g36	-61	Hall A
T+000123.4	aa:bb:cc:dd:ee:ff	2g6	-70
```

- Time is UTC to the second, or `T+seconds.tenths` since power-on on boards with no clock (T-Deck).
- Channels are named by band: `2g6`, `5g36`, `6g37`. Only 20 MHz primary channels are valid (5 GHz: 32-144 and 149-177 in steps of 4; 6 GHz: 1, 5, 9 ... 233).
- An empty name is a hidden network.
- `linklog.tsv` and `iphone-probe.tsv` use the 11-field format `lab/linklog.sh` writes (time, kind, device, signal, noise, channel, rate, inactive, retries, failed, round trip). The phone's lines are `ping` lines with millisecond times and `lost` for no reply within 2 s.
- `runlog.tsv` is `lab/mark.sh`'s format: time, note.

To summarize a board's SD log, copy it into a run folder of its own and name it `airscan.tsv`:

```
mkdir -p ~/robot-lab-captures/tdeck-hall-1 && cp /Volumes/SD/wifi/scan000.tsv ~/robot-lab-captures/tdeck-hall-1/airscan.tsv
lab/survey-summary.sh tdeck-hall-1
```

The summary always lists channels 1, 6, 11 and the non-radar 5 GHz channels, so a 2.4 GHz-only board shows empty 5 GHz rows: that means "not heard by this board", not "quiet".

Thresholds: Clearpath's -67 dBm or better is good and below -75 dBm is poor; FIRST's round trip under 50 ms is good and 250 ms or more is poor.

## Mac mini (`mac/`)

```
lab/wifi-analyzer/mac/build.sh                       # tests Format.swift, builds build/WiFiAnalyzer.app
lab/wifi-analyzer/mac/run.sh venue-run01 [--seconds 600]
```

Swift, CoreWLAN, `swiftc`, no Xcode project. It is an app bundle because macOS 14 and later hide network names and BSSIDs from apps without Location Services permission, and a bare command-line tool is judged by the terminal's permission instead. It asks when its window comes to the front; if no prompt appears, switch it on in System Settings > Privacy & Security > Location Services > Wi-Fi Analyzer.

**How it stays passive.** CoreWLAN's public scan call makes macOS send probe requests: airportd's log for a test scan on 2026-10-13 lists every 2.4 GHz channel, the non-radar 5 GHz channels and the 6 GHz PSC channels as `active`. The private call that takes a scan type is refused unless the app has Apple's `com.apple.wifi.scan` entitlement ("not entitled for com.apple.wifi.scan, will not allow request"). So the app never asks for a scan. Every 10 s it reads the scan cache macOS keeps from its own scanning, and writes each network once per time macOS heard it, stamped with that time (from the cache's per-network age). The cost: it logs only as often as macOS scans by itself, which on this Mac, idle and connected, was once in a five-minute watch. Treat the Mac's network log as occasional snapshots, not a 10-second series. The link log is every second.

Signing is ad hoc by default; after a rebuild macOS asks for Location Services again. `SIGN_ID=<sha1> build.sh` signs with a stable identity instead (the Apple Development identity on this Mac lives in the locked `nori-signing` keychain, which is why picking it automatically made macOS ask for that keychain's password).

## Dashboard for the Mac and the iPhone (`web/`)

```
python3 lab/wifi-analyzer/web/server.py venue-run01        # same run name as the Mac app
```

Standard-library Python on port 8765. On the iPhone, open `http://fridays-Mac-mini.local:8765` in Safari, then Share > Add to Home Screen. Safari first tries HTTPS (the server logs one "Bad request version" line) and then loads over HTTP.

- Channels: networks per channel from the last 15 minutes, bar colour from the strongest signal, 1/6/11 marked, DFS channels dotted. The Mac's own link underneath.
- Networks: strongest first; tap to track.
- Track: one network's signal at every time the Mac heard it, with the -67 and -75 lines.
- Link test: the phone requests a tiny reply every 500 ms and times it; no reply in 2 s is lost. Results go to `iphone-probe.tsv`. While the link is down they wait on the phone and are sent when it returns, so outages are recorded too. "Add note" appends to `runlog.tsv`. `?label=ipad` names another device; `?autostart=1` starts the test on load.

Anyone on the same network can open the page while the server runs. Stop it when done.

### Location map

Indoors, GPS does not work, and Safari gives a plain-HTTP page no location anyway. So the map is a walk-and-tap survey, the way Wi-Fi site surveys are done:

1. On Map, tap "Floor plan…" and choose a photo or screenshot of the hall plan or a booth sketch (JPEG, PNG, WebP or HEIC). With no plan, a plain grid is shown.
2. Start the link test on Link. Optionally pick the robot's network on Track, and have a T-Deck track it.
3. Walk to each spot the robot or the operator will use. Tap "Mark where I am", tap the spot on the plan, and name it.

Each spot records:

- the last 20 s of the phone's link test (round trip, losses);
- the T-Deck's tracked signal, if a T-Deck tracked something within the last 15 s;
- the scanner's latest reading of the network picked on Track, if it is under 30 s old;
- the LoRa32's crowd count, if under 2 minutes old.

A reading older than that was measured somewhere else, so it is left out. Only devices that walk with you measure the spot: the phone, the T-Deck, a carried Pi. A Mac on a desk measures the desk.

The map colours each spot and fills the area between spots by inverse-distance weighting, out to about a fifth of the plan and no further. The colour shows the measure you choose: phone round trip, phone losses, T-Deck signal, scanner signal or crowd. Green is good, yellow fair, red poor, using the -67/-75 dBm and 50/250 ms limits; for losses, good is 1% or less and poor 5% or more (our choice). Spots go to `map-points.tsv` (append-only; "Undo last" appends an undo line) and the plan to `floorplan.<ext>`, both in the run folder. `lab/survey-summary.sh` writes `summary/map.tsv`: one row per spot with its readings and its worst grade.

## T-Deck (`tdeck/`)

PlatformIO, Arduino framework, ESP32-S3. `build.sh` fetches LilyGO's T-Deck repo at the commit whose pins were checked (for their patched TFT_eSPI) and writes `build/tdeck-wifi-analyzer.bin`, one image for 0x0.

Pins, all checked against Xinyuan-LilyGO/T-Deck at `1dddf6e` (`examples/UnitTest/utilities.h`), all as in the brief: power enable GPIO10 high; ST7789 320x240 on SPI SCK 40, MOSI 41, MISO 38, CS 12, DC 11, backlight 42, reset not wired; keyboard I2C SDA 18, SCL 8, address 0x55 (0x00 = no key); trackball up 3, down 15, left 1, right 2, click 0; SD CS 39 on the same SPI bus; LoRa CS 9 held high (the radio is never used).

- Screens (trackball left/right): CHANNELS (bars for 1-13, 1/6/11 marked), NETWORKS (by signal; up/down, click to track), TRACK (big dBm, min/avg/max, history graph, -67/-75 lines and a warning bar; scans only that network's channel), GROUP (what the LoRa32 and the watch report).
- Keys: `r` SD logging on/off, `p` pause. Logging starts by itself at power-on when a card is in (a new `/wifi/scanNNN.tsv` each time), so it logs with no computer attached. Times are uptime.
- USB serial echoes every log line, `# ` status lines, and takes the same keys plus `w a s d` and Enter for the trackball, `S` for a raw screenshot (`tools/shot.py --swap`), `L` to read the newest SD log back.
- Platform pinned to `espressif32@6.4.0` (Arduino core 2.0.11): LilyGO says their TFT_eSPI fails above core 2.0.14, and the newest official platform ships 2.0.17.

Flash (this replaces Meshtastic):

```
lab/wifi-analyzer/tdeck/build.sh
PORT=/dev/cu.usbmodemXXXX lab/wifi-analyzer/tdeck/flash.sh
```

Here esptool reset it into download mode by itself. If it cannot: power off, hold the trackball, power on, release after 2-3 s (black screen), flash, then reset. To put Meshtastic back, use https://flasher.meshtastic.org (it lists "LILYGO T-Deck"; checked 2026-10-13: up, and the T-Deck target is `t-deck`).

Measured on 2026-10-13 at the desk: a passive pass over 13 channels takes 3.37 s, and the T-Deck heard 3-4 networks where the Mac's cache held about 18 on 2.4 GHz, most of them at -80 to -95 dBm. Pausing Bluetooth during Wi-Fi scans did not change that, so the T-Deck's PCB antenna is the likely limit: it shows the strong networks that matter for interference, not the faint ones. Arduino core 2.0.11 also reports a passive scan as failed after 20x the dwell time while the driver is still scanning; the firmware waits for its own deadline instead.

Not verified: what the panel itself shows (the screenshots are the frame buffer the firmware pushes to it), trackball and key presses by hand (serial equivalents were used), and SD file contents after `L` was fixed.

## LoRa32 with Paxcounter (`lora32-paxcounter/`)

The board is a LilyGO TTGO LoRa32 T3 V1.6.1 (ESP32-PICO-D4, 4 MB, SX1276), identified with esptool. `build.sh` builds ESP32-Paxcounter (pinned commit, v3.8.0-12) with Paxcounter's own board file for this board, changed to listen only: LoRaWAN off (the radio is never configured, so it never transmits), OTA and its Wi-Fi join off, boot menu off, BLE counter off, US Eastern time zone. A small patch (`groupbeacon.cpp`) puts each count in the group advert. `DEBUG_LEVEL=0` is the build to leave running; upstream warns other levels leak RAM over time. Counts appear on serial only at level 4.

```
DEBUG_LEVEL=0 lab/wifi-analyzer/lora32-paxcounter/build.sh
lab/wifi-analyzer/lora32-paxcounter/flash.sh ~/robot-lab-build/paxcounter/paxcounter-t3v161-listen-debug0.bin
```

Paxcounter sniffs Wi-Fi management frames to count devices, keeps only salted hashes in memory, and outputs counts. That is more than "BSSID, channel, signal, name", and it was added at Michael's request on 2026-10-13. It counts in 60 s windows (count resets each cycle).

This board ran the Nori teleop remote (`nori_remote boot (teleop v1.1, Qw/ST Pad input)`). Rebuild that from `smart_nori_rover/esp32_nodes/nori_remote/` to put it back; no flash backup was taken, at Michael's request.

## Watch (`watch/`)

Waveshare ESP32-S3-Touch-AMOLED-2.06. Built with arduino-cli, esp32 core 3.3.10 and GFX Library for Arduino 1.6.6, the toolchain Nori's watch firmware was verified with; pins and display init are copied from `smart_nori_rover/esp32_nodes/nori_watch_control`. The code lives in `watch_app.cpp` so arduino-cli has no prototypes to generate: its bundled ctags is an Intel binary, and `build.sh` points it at a native universal-ctags on Macs without Rosetta.

- Pages, changed by a tap anywhere or the BOOT button: GROUP, TRACK (whatever a T-Deck is tracking, big, with the warnings), CHANNELS (its own scan).
- Own passive scan every 10 s (5.6 s per pass); summary in its advert.
- USB serial: `# ` lines, group updates, `n` next page, `S` screenshot (`tools/shot.py`).

Flashing replaces Nori's watch firmware (wrist e-stop, FOLLOW/STOP, TALK). Reflash `nori_watch_control` from `smart_nori_rover` to get it back.

Not verified: what the glass shows, and whether a finger lands where expected. On the bench it changed page three times in 90 s with nobody known to be touching it; the build after that requires two touch readings in a row and on-panel coordinates, but has not been flashed (the watch was unplugged).

## Group link

Each board sends a 27-byte non-connectable Bluetooth LE advert once a second at 0 dBm: manufacturer data under company ID 0xFFFF (reserved for internal use) with magic `RW`, the board kind and ID, a sequence number, flags (scan data, paused, logging, tracking, Paxcounter count, display and input health), networks heard, the Paxcounter count, networks per channel 1-13, the strongest network and the tracked network. The format is in `common/wifilogic/src/groupframe.h`. The T-Deck and the watch listen with passive scans (no scan requests) and pause listening during their own Wi-Fi scans. Nobody can connect to the adverts; nothing joins a network.

## Raspberry Pi 5 (`pi5/`)

A ready-to-flash Raspberry Pi OS Lite image with the analyzer built in (`pi5/make-image.sh`), or `pi5/install.sh` for a Pi already set up. It covers 2.4 and 5 GHz (no 6 GHz), scans passively every 10 s, serves the same dashboard plus a Group tab, and listens to the T-Deck, LoRa32 and watch over Bluetooth. Details, Wi-Fi limits and the first hardware test: `pi5/README.md`.

## Tests

```
lab/wifi-analyzer/test.sh
```

Runs the shared C++ logic tests (`common/test/`), the Swift format tests (`mac/build.sh` runs them first), the Python dashboard tests including the real server end to end (`web/test_analyzer.py`), and `lab/survey-summary.sh` on sample logs of every format (`testdata/`). All implementations, and the awk `chan()` in `lab/linklog.sh`, are checked against one channel fixture, `testdata/channel-cases.tsv`.

## Restoring the devices

| Device | Was running | To restore |
|---|---|---|
| T-Deck | Meshtastic | https://flasher.meshtastic.org, LILYGO T-Deck |
| LoRa32 | Nori teleop remote | `smart_nori_rover/esp32_nodes/nori_remote` (arduino-cli, fqbn `esp32:esp32:esp32`) |
| Watch | `nori_watch_control` | `smart_nori_rover/esp32_nodes/nori_watch_control` (its README has the arduino-cli lines) |
