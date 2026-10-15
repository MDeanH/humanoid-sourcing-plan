# Raspberry Pi 5: the Mac's job, in a pocket

The Pi 5 does what the Mac mini does in this kit (passive scans, the iPhone dashboard and link test) and also listens to the group's Bluetooth adverts (T-Deck, LoRa32, watch). It runs from a power bank.

Status, 2026-10-13: built and tested on the Mac only. The scanner, Bluetooth and image parsers pass their tests on sample `iw` output and hand-built Bluetooth packets, and the image's contents were checked with `debugfs` and `e2fsck`. **Nothing here has run on a Pi yet**: booting, the services, passive scanning on the real radio, the Bluetooth listener and iPhone USB tethering are all unverified.

## What the Pi 5's Wi-Fi can and cannot do

| | Pi 5 (built-in CYW43455, brcmfmac driver) | Mac mini (this one) |
|---|---|---|
| Bands | 2.4 and 5 GHz. **No 6 GHz.** | 2.4, 5 and 6 GHz |
| Passive scans | Yes, on request: `iw scan passive` sends no SSID list, and brcmfmac then sets `BRCMF_SCANTYPE_PASSIVE` (rpi-6.12.y `cfg80211.c`, "Performing passive scan"). Read in the source, **unverified on hardware** | Not on request: the public CoreWLAN scan probes actively and the passive one needs an Apple-only entitlement, so the Mac only reads what macOS scanned by itself |
| Scan cadence | Every 10 s, as set | As often as macOS scans (once in 5 min at the desk) |
| Network names | Visible to root, no permission prompt | Hidden unless Location Services is allowed |
| Channel-busy counters (`iw survey dump`) | Likely only some channels, or none; written to `survey.tsv` when reported | None |
| Antenna | PCB antenna; a metal case costs signal. Use a plastic case | Built in |
| Monitor mode | Not supported by brcmfmac, and not wanted here | Not used |

Other limits:

- The Wi-Fi and Bluetooth share one radio chip, so Bluetooth listening and Wi-Fi scanning take turns.
- Scanning and hosting a hotspot on the same radio do not mix, which is one reason this Pi does not run a hotspot.
- No clock battery is fitted by default. With no network the clock starts from the last saved time and drifts, so each run name carries a boot number and the run log says whether the clock was synchronized. USB tethering or Ethernet gives it real time.
- For 6 GHz, add a USB adapter whose Linux driver supports 6 GHz (MediaTek MT7921AU-based ones are commonly used; untested here) and set `IFACE=wlan1`.
- While NetworkManager manages `wlan0` and is not connected, it keeps scanning actively to find networks. The image therefore tells it to leave `wlan0` alone (`/etc/NetworkManager/conf.d/90-wifi-analyzer.conf`). `WIFI_CLIENT=yes` gives it back, for a Pi that should also join your own network.

## Build the image (on the Mac)

```
brew install e2fsprogs mtools          # once
lab/wifi-analyzer/pi5/make-image.sh    # -> lab/wifi-analyzer/pi5/build/wifi-analyzer-pi5.img (about 2.9 GB)
```

It downloads Raspberry Pi OS Lite 64-bit (Trixie, 2026-10-06, about 550 MB, checksum verified) into `~/robot-lab-build/pi5`. It adds the analyzer to the root file system with `debugfs` and to the boot partition with `mtools`, so nothing is mounted. It also bundles `usbmuxd` and the four libraries it needs from the Raspberry Pi and Debian archives (checksums checked against their package indexes). Those are installed on first boot, for iPhone USB tethering. The image is not committed to the repo.

## Flash it

Raspberry Pi Imager: Choose Device > Raspberry Pi 5, Choose OS > Use custom > `wifi-analyzer-pi5.img`, choose the card. In Imager's OS customisation:

- Hostname: `wifi-lab` (the dashboard is then `http://wifi-lab.local:8765`)
- Your user, and a password or SSH key (Imager stores them; nothing in this image creates a user)
- Wireless LAN country: US
- Leave the Wi-Fi network empty: the Pi only listens.

## Reach it from the iPhone

**USB (no other network needed):**

1. On the iPhone, turn on Settings > Personal Hotspot.
2. Connect the iPhone to one of the Pi's USB-A ports. The USB-C port on the Pi is for power only.
3. Tap Trust on the iPhone.
4. Open `http://wifi-lab.local:8765` in Safari. If the name does not resolve, try `http://172.20.10.2:8765`, the first address the hotspot hands out.

Whether USB tethering works without "Allow Others to Join", and whether the iPhone's own hotspot Wi-Fi then stays silent, is unverified. Over USB the link test measures the cable, not Wi-Fi.

**Ethernet:** plug the Pi into the booth router and put the iPhone on that router's Wi-Fi. The link test then measures the phone's real Wi-Fi path, which is what it is for.

**A Pi that is already set up:** copy this repo to it and run `sudo lab/wifi-analyzer/pi5/install.sh`. If the Pi is reached over Wi-Fi, the installer leaves `wlan0` with NetworkManager (`WIFI_CLIENT=yes`) so it does not cut your own session.

## What runs

| Service | Does | Writes |
|---|---|---|
| `wifi-analyzer-scan` | `iw dev wlan0 scan passive` every 10 s; `iw survey dump`; this Pi's own link once a second, only once it has joined a network | `airscan.tsv`, `survey.tsv`, `linklog.tsv`, `runlog.tsv` |
| `wifi-analyzer-group` | Passive Bluetooth LE scan through a raw HCI socket for the group's adverts | `group.tsv` (one line per new report) |
| `wifi-analyzer-web` | The same dashboard as on the Mac, with a Group tab | `iphone-probe.tsv`, `runlog.tsv` |
| `wifi-analyzer-firstboot` | Installs the bundled `usbmuxd` packages once | |

Logs: `/var/lib/wifi-analyzer/captures/<run>/`, one run per boot (`pi5-b0003-20261014T1300Z`) or `RUN=` in the settings. Copy a run to the Mac and summarize it:

```
scp -r wifi-lab.local:/var/lib/wifi-analyzer/captures/pi5-b0003-20261014T1300Z ~/robot-lab-captures/
lab/survey-summary.sh pi5-b0003-20261014T1300Z
```

Settings: `wifi-analyzer.conf` on the boot partition (`/boot/firmware/` on the Pi, or the `bootfs` volume when the card is in a computer): interface, scan interval, country, run name, `WIFI_CLIENT`.

Check it on the Pi:

```
systemctl status wifi-analyzer-scan wifi-analyzer-group wifi-analyzer-web
sudo python3 /opt/wifi-analyzer/pi5/wifi_scan.py --once      # one passive scan to the screen
```

## First test on hardware (to do)

1. Boot the image; check all four services are active and `wifi_scan.py --once` lists networks.
2. Confirm the scan is passive from the driver itself, without capturing anything. Run `echo 'module brcmfmac +p' | sudo tee /sys/kernel/debug/dynamic_debug/control`, then `sudo dmesg -w | grep -i "passive scan"` while a scan runs. This needs a kernel with dynamic debug, and brcmfmac's SCAN debug messages may also need its `debug=` module parameter. Until then "passive" rests on the driver source.
3. Check `group.tsv` fills while the T-Deck, LoRa32 and watch run.
4. USB tethering from the iPhone; then the dashboard and link test from Safari.
5. Leave it running from a power bank for a few hours; check memory and that logs keep growing.
